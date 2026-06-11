import httpx
import logging
from typing import Dict, Any
from app.database.connection import get_db_for_mode
from app.database.models import Setting

logger = logging.getLogger(__name__)

def get_figma_credentials(mode: str = "work") -> tuple[str, str]:
    db = get_db_for_mode(mode)
    try:
        token = db.query(Setting).filter(Setting.key == "figma_access_token").first()
        mcp_url = db.query(Setting).filter(Setting.key == "mcp_figma_url").first()
        return (token.value if token else "", mcp_url.value if mcp_url else "")
    finally:
        db.close()

async def query_figma_mcp(query: str, mode: str = "work") -> Dict[str, Any]:
    token, mcp_url = get_figma_credentials(mode)
    
    # If a custom MCP URL is provided, forward the request to the MCP server
    if mcp_url:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(mcp_url, json={"method": "tools/call", "params": {"name": "query_figma", "arguments": {"query": query}}})
                if resp.status_code == 200:
                    return resp.json()
        except Exception as e:
            logger.error(f"Failed to query external Figma MCP at {mcp_url}: {e}")
            return {"error": f"Figma MCP server unreachable: {str(e)}"}

    # If a raw Figma personal access token is configured, query Figma directly
    if token:
        # Check if the query is a file key (e.g. UUID-like or alpha-numeric)
        file_key = query.strip()
        url = f"https://api.figma.com/v1/files/{file_key}"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, headers={"X-Figma-Token": token})
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "name": data.get("name"),
                        "lastModified": data.get("lastModified"),
                        "thumbnailUrl": data.get("thumbnailUrl"),
                        "version": data.get("version"),
                        "components": list(data.get("components", {}).keys())[:10]
                    }
                else:
                    return {"error": f"Figma API returned status code {resp.status_code}: {resp.text}"}
        except Exception as e:
            logger.error(f"Figma API connection failed: {e}")
            return {"error": f"Figma API connection failed: {str(e)}"}

    # Fallback/Mock Design Tokens for a premium SaaS professional tool
    return {
        "status": "mocked",
        "info": "Figma integration is in Sandbox mode. Configure figma_access_token in Settings for production API.",
        "project": "Mickey Professional Design System v1",
        "colors": {
            "slate-900": "#0f172a",
            "slate-800": "#1e293b",
            "indigo-600": "#4f46e5",
            "emerald-500": "#10b981",
            "background": "#ffffff",
            "dark-background": "#09090b"
        },
        "components": [
            {"name": "SidebarRail", "status": "Ready", "description": "Left sidebar icon container"},
            {"name": "ActivityTaskRow", "status": "Ready", "description": "Task item with priority tag and checkbox"},
            {"name": "CalendarGrid", "status": "Design Lock", "description": "Interactive monthly grid layout"},
            {"name": "ChatInputArea", "status": "Refining", "description": "Prompt textarea with model selector"}
        ],
        "typography": {
            "font-family": "Inter, system-ui, sans-serif",
            "heading-1": "30px / font-weight: 700",
            "body-text": "14px / font-weight: 400"
        }
    }
