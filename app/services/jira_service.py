import os
import json
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin
from cryptography.fernet import Fernet
import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database.models import JiraConfig, UserActionLog
from app.database.connection import get_db_for_mode

# Helper for encryption/decryption
def _get_fernet() -> Fernet:
    import base64
    key = os.getenv("JIRA_ENC_KEY")
    if not key:
        # Stable default fallback key (32 bytes url-safe base64-encoded)
        key = base64.urlsafe_b64encode(b"mickey_default_secret_key_32_byt")
    # Ensure key is bytes
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)

def encrypt_token(token: str) -> str:
    f = _get_fernet()
    return f.encrypt(token.encode()).decode()

def decrypt_token(enc_token: str) -> str:
    f = _get_fernet()
    return f.decrypt(enc_token.encode()).decode()

class JiraService:
    def __init__(self, mode: str = "work"):
        self.mode = mode
        self.db: Session = get_db_for_mode(mode)
        self.base_url: Optional[str] = None
        self.email: Optional[str] = None
        self.token: Optional[str] = None
        self._load_config()

    def _load_config(self):
        cfg = self.db.query(JiraConfig).filter(JiraConfig.mode == self.mode).first()
        if cfg:
            self.base_url = cfg.url.rstrip('/')
            self.email = cfg.email
            self.token = decrypt_token(cfg.encrypted_token)
        else:
            self.base_url = None
            self.email = None
            self.token = None

    def _check_config(self):
        if not self.base_url or not self.email or not self.token:
            raise HTTPException(status_code=404, detail="Jira configuration not found for active mode. Please configure Jira under the MCP settings first.")

    def _auth_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Basic {self._basic_auth()}",
            "Accept": "application/json",
        }

    def _basic_auth(self) -> str:
        import base64
        auth_str = f"{self.email}:{self.token}"
        return base64.b64encode(auth_str.encode()).decode()

    async def _request(self, method: str, path: str, params: Dict[str, Any] = None, json_body: Dict[str, Any] = None) -> Any:
        """Perform an authenticated request to Jira. Automatically retries deprecated /rest/api/3/search -> /rest/api/3/search/jql when detected.
        Returns parsed JSON when possible, otherwise raw text.
        """
        self._check_config()
        base_path = path
        url = urljoin(self.base_url + '/', path.lstrip('/'))
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.request(method, url, headers=self._auth_headers(), params=params, json=json_body)

            # Unauthorized
            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid Jira credentials")

            # Handle errors and possible deprecation migration to /search/jql
            if resp.status_code >= 400:
                # Try to parse JSON body for structured errors
                try:
                    err_json = resp.json()
                except Exception:
                    err_json = None

                # Detect migration hint
                migrate_hint = False
                if resp.status_code == 410:
                    migrate_hint = True
                if isinstance(err_json, dict):
                    emsgs = err_json.get('errorMessages') or []
                    # check list or single string
                    if isinstance(emsgs, str):
                        emsgs = [emsgs]
                    for m in emsgs or []:
                        try:
                            if isinstance(m, str) and ('search/jql' in m.lower() or 'change-2046' in m.lower() or 'migrate' in m.lower()):
                                migrate_hint = True
                                break
                        except Exception:
                            continue

                # If endpoint is legacy /rest/api/3/search, retry with /rest/api/3/search/jql once
                if migrate_hint and '/rest/api/3/search' in base_path and '/rest/api/3/search/jql' not in base_path:
                    new_path = base_path.replace('/rest/api/3/search', '/rest/api/3/search/jql')
                    new_url = urljoin(self.base_url + '/', new_path.lstrip('/'))
                    resp2 = await client.request(method, new_url, headers=self._auth_headers(), params=params, json=json_body)
                    if resp2.status_code >= 400:
                        try:
                            err2 = resp2.json()
                        except Exception:
                            err2 = None
                        if isinstance(err2, dict):
                            detail2 = err2.get('errorMessages') or err2.get('errors') or err2
                        else:
                            detail2 = resp2.text

                        # Try to parse double-encoded JSON strings
                        try:
                            import json as _json
                            if isinstance(detail2, str):
                                parsed2 = _json.loads(detail2)
                                if isinstance(parsed2, (dict, list)):
                                    detail2 = parsed2
                        except Exception:
                            pass

                        raise HTTPException(status_code=resp2.status_code, detail=detail2)
                    try:
                        return resp2.json()
                    except Exception:
                        return resp2.text

                # Otherwise return structured detail when possible
                if isinstance(err_json, dict):
                    detail = err_json.get('errorMessages') or err_json.get('errors') or err_json
                else:
                    detail = resp.text

                # If detail is a JSON-encoded string (double-encoded), try to parse it into an object
                try:
                    import json as _json
                    if isinstance(detail, str):
                        parsed = _json.loads(detail)
                        if isinstance(parsed, (dict, list)):
                            detail = parsed
                except Exception:
                    pass

                raise HTTPException(status_code=resp.status_code, detail=detail)

            # Success
            try:
                return resp.json()
            except Exception:
                return resp.text

    # ---------------------------- API methods ---------------------------------
    async def list_projects(self) -> List[Dict[str, Any]]:
        data = await self._request("GET", "/rest/api/3/project/search")
        return data.get("values", [])

    async def list_boards(self, project_id: str) -> List[Dict[str, Any]]:
        data = await self._request("GET", f"/rest/agile/1.0/board", params={"projectKeyOrId": project_id})
        return data.get("values", [])

    async def list_sprints(self, board_id: str) -> List[Dict[str, Any]]:
        data = await self._request("GET", f"/rest/agile/1.0/board/{board_id}/sprint")
        return data.get("values", [])

    async def list_assigned_issues(self, jql: str = None) -> List[Dict[str, Any]]:
        if not jql:
            jql = f"assignee = currentUser() ORDER BY updated DESC"
        
        fields_list = ["summary", "status", "issuetype", "description", "comment", "priority", "assignee", "project", "created"]
        
        # Use POST /rest/api/3/search/jql by default (supports long or complex JQL and avoids URL length limits)
        try:
            data = await self._request(
                "POST", 
                "/rest/api/3/search/jql", 
                json_body={"jql": jql, "maxResults": 100, "fields": fields_list}
            )
        except HTTPException as he:
            # If POST fails, try GET fallback and legacy endpoints
            fields_str = ",".join(fields_list)
            try:
                data = await self._request(
                    "GET", 
                    "/rest/api/3/search/jql", 
                    params={"jql": jql, "maxResults": 100, "fields": fields_str}
                )
            except HTTPException:
                try:
                    data = await self._request(
                        "GET", 
                        "/rest/api/3/search", 
                        params={"jql": jql, "maxResults": 100, "fields": fields_str}
                    )
                except Exception:
                    raise he

        # Normalize response shapes
        if isinstance(data, dict):
            # API may return {"issues": [...]}
            if 'issues' in data and isinstance(data['issues'], list):
                return data['issues']
            # Or return list under other keys
            for k in ['results', 'data']:
                if k in data and isinstance(data[k], list):
                    return data[k]
            # Or some tenants return the list directly in the top-level dict - check common patterns
            # If the dict has numeric keys resembling list, convert
            try:
                # detect list-like dict
                if all(isinstance(int(k), int) for k in data.keys() if isinstance(k, str)):
                    return [data[k] for k in sorted(data.keys(), key=lambda x: int(x))]
            except Exception:
                pass
            return []
        if isinstance(data, list):
            return data
        return []

    async def create_issue(self, project_key: str, summary: str, description: str = "", issue_type: str = "Task") -> Dict[str, Any]:
        # Convert plain-text description to Atlassian Document Format (ADF) for Jira v3 compatibility
        if isinstance(description, str) and description.strip():
            desc_val = {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": description
                            }
                        ]
                    }
                ]
            }
        else:
            desc_val = None

        payload = {
            "fields": {
                "project": {"key": project_key},
                "summary": summary,
                "issuetype": {"name": issue_type},
            }
        }
        if desc_val:
            payload["fields"]["description"] = desc_val

        return await self._request("POST", "/rest/api/3/issue", json_body=payload)

    async def update_issue(self, issue_key: str, fields: Dict[str, Any]) -> Dict[str, Any]:
        payload = {"fields": fields}
        return await self._request("PUT", f"/rest/api/3/issue/{issue_key}", json_body=payload)

    async def transition_issue(self, issue_key: str, transition_id: str) -> Dict[str, Any]:
        payload = {"transition": {"id": transition_id}}
        return await self._request("POST", f"/rest/api/3/issue/{issue_key}/transitions", json_body=payload)

    async def get_transitions(self, issue_key: str) -> Dict[str, Any]:
        return await self._request("GET", f"/rest/api/3/issue/{issue_key}/transitions")

    async def add_comment(self, issue_key: str, comment: str) -> Dict[str, Any]:
        # Convert plain-text comment to Atlassian Document Format (ADF) for Jira v3 compatibility
        if isinstance(comment, str) and comment.strip():
            body_val = {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": comment
                            }
                        ]
                    }
                ]
            }
        else:
            body_val = comment

        payload = {"body": body_val}
        return await self._request("POST", f"/rest/api/3/issue/{issue_key}/comment", json_body=payload)

    async def assign_issue(self, issue_key: str, assignee_account_id: str) -> Dict[str, Any]:
        payload = {"accountId": assignee_account_id}
        return await self._request("PUT", f"/rest/api/3/issue/{issue_key}/assignee", json_body=payload)

    # Logging helper
    def log_action(self, action: str, details: Optional[str] = None):
        log = UserActionLog(action_type=action, details=details)
        self.db.add(log)
        self.db.commit()
