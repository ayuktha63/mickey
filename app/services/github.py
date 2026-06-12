import httpx
import logging
from typing import Dict, Any, Optional
from app.database.connection import get_db_for_mode
from app.database.models import Setting

logger = logging.getLogger(__name__)

def get_github_credentials(mode: str = "work") -> tuple[str, str]:
    """
    Retrieve GitHub Personal Access Token (PAT) and custom MCP URL for the selected mode (Work vs Personal).
    Supports falling back to environment variables and cross-mode databases if settings rows do not exist.
    """
    import os
    db = get_db_for_mode(mode)
    token_val = None
    mcp_url_val = None
    try:
        token_row = db.query(Setting).filter(Setting.key == "github_access_token").first()
        mcp_url_row = db.query(Setting).filter(Setting.key == "mcp_github_url").first()
        if token_row is not None:
            token_val = token_row.value
        if mcp_url_row is not None:
            mcp_url_val = mcp_url_row.value
    finally:
        db.close()

    # Fallback to environment variables if not present in database
    # An empty string "" row in the DB indicates an explicit disconnection, which bypasses fallback
    if token_val is None or token_val == "":
        env_key = f"GITHUB_TOKEN_{mode.upper()}"
        token_val = os.environ.get(env_key) or os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN") or ""
        
    if not token_val:
        # Fallback to checking the other workspace mode's database
        other_mode = "personal" if mode == "work" else "work"
        other_db = get_db_for_mode(other_mode)
        try:
            other_token_row = other_db.query(Setting).filter(Setting.key == "github_access_token").first()
            if other_token_row and other_token_row.value:
                token_val = other_token_row.value
                logger.info(f"Using GitHub token from {other_mode} mode as fallback.")
        except Exception:
            pass
        finally:
            other_db.close()

    if mcp_url_val is None or mcp_url_val == "":
        env_mcp_key = f"MCP_GITHUB_URL_{mode.upper()}"
        mcp_url_val = os.environ.get(env_mcp_key) or os.environ.get("MCP_GITHUB_URL") or ""

    if not mcp_url_val:
        other_mode = "personal" if mode == "work" else "work"
        other_db = get_db_for_mode(other_mode)
        try:
            other_mcp_url_row = other_db.query(Setting).filter(Setting.key == "mcp_github_url").first()
            if other_mcp_url_row and other_mcp_url_row.value:
                mcp_url_val = other_mcp_url_row.value
                logger.info(f"Using GitHub MCP URL from {other_mode} mode as fallback.")
        except Exception:
            pass
        finally:
            other_db.close()
        
    return token_val or "", mcp_url_val or ""


async def query_github_mcp(
    method: str,
    repo: Optional[str] = None,
    issue_number: Optional[int] = None,
    title: Optional[str] = None,
    body: Optional[str] = None,
    query: Optional[str] = None,
    mode: str = "work"
) -> Dict[str, Any]:
    """
    Core GitHub interface. Uses custom MCP server if mcp_github_url is configured;
    otherwise makes direct, rate-limit & error-handled REST API calls to GitHub.
    """
    token, mcp_url = get_github_credentials(mode)

    logger.info(f"GitHub query: method={method}, mode={mode}, has_token={bool(token)}, has_mcp={bool(mcp_url)}")

    # Auto-resolve default repository if not specified
    if method in ["view_repository", "read_issues", "create_issue", "read_pull_requests", "view_commits"]:
        if not repo or "/" not in repo:
            repos_res = await query_github_mcp("list_repositories", mode=mode)
            if "repositories" in repos_res and repos_res["repositories"]:
                repo = repos_res["repositories"][0]["name"]
                logger.info(f"Auto-resolved missing repo argument to first available repo: '{repo}'")
            else:
                err_msg = repos_res.get("error") if isinstance(repos_res, dict) else None
                return {
                    "error": f"Missing or invalid repository argument. Format must be 'owner/repo'. Auto-resolution failed: {err_msg or 'No repositories found.'}"
                }

    # ── MCP ROUTE ──
    if mcp_url:
        mcp_payload = {
            "method": "tools/call",
            "params": {
                "name": method,
                "arguments": {
                    "repo": repo,
                    "issue_number": issue_number,
                    "title": title,
                    "body": body,
                    "query": query
                }
            }
        }
        logger.info(f"Forwarding to external GitHub MCP at {mcp_url} with payload {mcp_payload}")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(mcp_url, json=mcp_payload)
                logger.info(f"External MCP response status: {resp.status_code}")
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"MCP server returned error status {resp.status_code}: {resp.text}"}
        except Exception as e:
            logger.exception("Failed to communicate with external GitHub MCP")
            return {"error": f"GitHub MCP server unreachable: {str(e)}"}

    # ── DIRECT REST API ROUTE ──
    if not token:
        return {
            "status": "error",
            "error": "GitHub Personal Access Token (PAT) not configured. Please set it up in Settings."
        }

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Mickey-Workspace-Agent"
    }

    async def make_github_request(http_method: str, url: str, json_body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                if http_method == "GET":
                    resp = await client.get(url, headers=headers)
                elif http_method == "POST":
                    resp = await client.post(url, headers=headers, json=json_body)
                else:
                    return {"error": f"Unsupported HTTP method: {http_method}"}
                
                logger.info(f"GitHub REST call: {http_method} {url} -> status {resp.status_code}")

                # Error handling
                if resp.status_code == 401:
                    return {"error": "GitHub authentication failed: Invalid Personal Access Token (PAT)."}
                elif resp.status_code == 403:
                    # Check for rate limiting
                    if resp.headers.get("X-RateLimit-Remaining") == "0":
                        return {"error": "GitHub rate limit exceeded. Please try again later."}
                    return {"error": "Access denied. Check your token scope or missing organization permissions."}
                elif resp.status_code == 404:
                    return {"error": "Repository, resource, or page not found. Ensure the token has private repo access."}
                elif resp.status_code >= 500:
                    return {"error": f"GitHub server error: Received status {resp.status_code}."}
                
                if resp.status_code in [200, 201]:
                    return {"status": "success", "data": resp.json()}
                
                return {"error": f"Unexpected GitHub API response {resp.status_code}: {resp.text}"}
        except httpx.NetworkError as ne:
            logger.error(f"GitHub network connection failed: {ne}")
            return {"error": f"GitHub server unreachable: network connection failed."}
        except Exception as ex:
            logger.exception("Failed to execute GitHub REST API call")
            return {"error": f"GitHub request failed: {str(ex)}"}

    # Route request by method
    try:
        if method == "list_repositories":
            url = "https://api.github.com/user/repos?sort=updated&per_page=20"
            res = await make_github_request("GET", url)
            if "error" in res: return res
            repos_data = res["data"]
            return {
                "repositories": [
                    {
                        "name": r.get("full_name"),
                        "private": r.get("private"),
                        "html_url": r.get("html_url"),
                        "description": r.get("description"),
                        "stars": r.get("stargazers_count"),
                        "updated_at": r.get("updated_at")
                    } for r in repos_data
                ]
            }

        elif method == "view_repository":
            if not repo or "/" not in repo:
                return {"error": "Missing or invalid repository argument. Format must be 'owner/repo'."}
            url = f"https://api.github.com/repos/{repo}"
            res = await make_github_request("GET", url)
            if "error" in res: return res
            r = res["data"]
            return {
                "name": r.get("full_name"),
                "private": r.get("private"),
                "html_url": r.get("html_url"),
                "description": r.get("description"),
                "stars": r.get("stargazers_count"),
                "watchers": r.get("watchers_count"),
                "forks": r.get("forks_count"),
                "open_issues_count": r.get("open_issues_count"),
                "default_branch": r.get("default_branch")
            }

        elif method == "read_issues":
            if not repo or "/" not in repo:
                return {"error": "Missing or invalid repository argument. Format must be 'owner/repo'."}
            url = f"https://api.github.com/repos/{repo}/issues?state=open&per_page=15"
            res = await make_github_request("GET", url)
            if "error" in res: return res
            issues_data = res["data"]
            # Exclude pull requests (GitHub API lists PRs as issues in this endpoint, filter them out)
            return {
                "issues": [
                    {
                        "number": i.get("number"),
                        "title": i.get("title"),
                        "user": i.get("user", {}).get("login"),
                        "state": i.get("state"),
                        "created_at": i.get("created_at"),
                        "html_url": i.get("html_url")
                    } for i in issues_data if "pull_request" not in i
                ]
            }

        elif method == "create_issue":
            if not repo or "/" not in repo:
                return {"error": "Missing or invalid repository argument. Format must be 'owner/repo'."}
            if not title:
                return {"error": "Missing required issue title."}
            url = f"https://api.github.com/repos/{repo}/issues"
            payload = {"title": title, "body": body or ""}
            res = await make_github_request("POST", url, payload)
            if "error" in res: return res
            i = res["data"]
            return {
                "status": "success",
                "number": i.get("number"),
                "title": i.get("title"),
                "html_url": i.get("html_url"),
                "state": i.get("state")
            }

        elif method == "read_pull_requests":
            if not repo or "/" not in repo:
                return {"error": "Missing or invalid repository argument. Format must be 'owner/repo'."}
            url = f"https://api.github.com/repos/{repo}/pulls?state=open&per_page=15"
            res = await make_github_request("GET", url)
            if "error" in res: return res
            pulls_data = res["data"]
            return {
                "pull_requests": [
                    {
                        "number": p.get("number"),
                        "title": p.get("title"),
                        "user": p.get("user", {}).get("login"),
                        "state": p.get("state"),
                        "created_at": p.get("created_at"),
                        "html_url": p.get("html_url"),
                        "branch_from": p.get("head", {}).get("ref"),
                        "branch_to": p.get("base", {}).get("ref")
                    } for p in pulls_data
                ]
            }

        elif method == "view_commits":
            if not repo or "/" not in repo:
                return {"error": "Missing or invalid repository argument. Format must be 'owner/repo'."}
            url = f"https://api.github.com/repos/{repo}/commits?per_page=15"
            res = await make_github_request("GET", url)
            if "error" in res: return res
            commits_data = res["data"]
            return {
                "commits": [
                    {
                        "sha": c.get("sha")[:8] if c.get("sha") else "",
                        "author": c.get("commit", {}).get("author", {}).get("name"),
                        "message": c.get("commit", {}).get("message"),
                        "date": c.get("commit", {}).get("author", {}).get("date"),
                        "html_url": c.get("html_url")
                    } for c in commits_data
                ]
            }

        elif method == "search_code":
            if not query:
                return {"error": "Missing required code search query."}
            # Add repo qualifier if present
            url = f"https://api.github.com/search/code?q={query}"
            if repo and "/" in repo:
                url += f"+repo:{repo}"
            res = await make_github_request("GET", url)
            if "error" in res: return res
            search_data = res["data"]
            return {
                "total_count": search_data.get("total_count", 0),
                "incomplete_results": search_data.get("incomplete_results", False),
                "items": [
                    {
                        "name": item.get("name"),
                        "path": item.get("path"),
                        "repository": item.get("repository", {}).get("full_name"),
                        "html_url": item.get("html_url")
                    } for item in search_data.get("items", [])[:15]
                ]
            }

        else:
            return {"error": f"Unsupported GitHub service method: {method}"}
    except Exception as e:
        logger.exception("GitHub request execution error")
        return {"error": str(e)}
