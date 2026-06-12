import json
import logging
import httpx
from typing import List, Dict, Any, AsyncGenerator, Optional
from app.database.connection import get_db_for_mode
from app.database.models import Setting, Task, Note, Event

logger = logging.getLogger(__name__)

def get_db_setting(key: str, default: str = "", mode: str = "work") -> str:
    db = get_db_for_mode(mode)
    try:
        setting = db.query(Setting).filter(Setting.key == key).first()
        return setting.value if setting else default
    finally:
        db.close()

def get_ollama_url(mode: str = "work") -> str:
    import os
    env_url = os.getenv("OLLAMA_URL")
    if env_url:
        url = env_url.rstrip("/")
    else:
        url = get_db_setting("ollama_url", "", mode=mode).strip().rstrip("/")
        if not url:
            if os.path.exists("/.dockerenv"):
                return "http://host.docker.internal:11434"
            return "http://localhost:11434"
    
    # If we are inside Docker and the url points to localhost, map it to host.docker.internal
    if os.path.exists("/.dockerenv"):
        if "localhost" in url or "127.0.0.1" in url:
            url = url.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal")
            
    return url

async def get_available_models(mode: str = "work") -> List[str]:
    url = f"{get_ollama_url(mode)}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                return [m["name"] for m in data.get("models", [])]
    except Exception as e:
        logger.warning(f"Error fetching Ollama models: {e}")
    return ["llama3.1", "qwen2.5:7b", "mistral"] # fallback list

# Define the tools available to the assistant
SYSTEM_PROMPT = """You are a highly efficient self-hosted AI Productivity Assistant named Cookie.
You are connected to the user's workspace database. You have access to the user's Todo/Tasks, Notes, Calendar, and Email (Gmail).

You can use the following tools by outputting a JSON object at the start of your message in the format below:
```json
{
  "tool": "tool_name",
  "args": { ... }
}
```
If you choose to use a tool, output ONLY the JSON markdown block first. Once the tool runs, you will receive the tool result in the next turn and can then formulate your response. If no tool is needed, respond with standard friendly text.

Available Tools:
1. `list_tasks` - Get the current todo list
2. `create_task` - Add a new task/todo
   Args: {"title": "str", "description": "str (optional)", "priority": "low|medium|high", "due_date": "YYYY-MM-DD HH:MM (optional)"}
3. `update_task` - Update task status or details
   Args: {"task_id": "str", "status": "pending|completed"}
4. `list_notes` - Retrieve all notes
5. `create_note` - Save a new note
   Args: {"title": "str", "content": "str", "tags": "str (comma-separated, optional)"}
6. `search_notes` - Search notes by text query
   Args: {"query": "str"}
7. `list_events` - Get calendar events
   Args: {"start_date": "YYYY-MM-DD (optional)", "end_date": "YYYY-MM-DD (optional)"}
8. `create_event` - Create a calendar event
   Args: {"title": "str", "start_time": "YYYY-MM-DD HH:MM", "end_time": "YYYY-MM-DD HH:MM", "location": "str (optional)", "description": "str (optional)"}
9. `list_emails` - Read recent email alerts from Gmail
   Args: {"max_results": 5}
10. `figma_mcp` - Query Figma design resources using MCP
    Args: {"query": "str"}
11. `github_mcp` - Query GitHub repositories, issues, pull requests, commits, and code search using MCP
    Args: {"method": "list_repositories|view_repository|read_issues|create_issue|read_pull_requests|view_commits|search_code", "repo": "str (optional, e.g. owner/name)", "issue_number": "int (optional)", "title": "str (optional)", "body": "str (optional)", "query": "str (optional)"}
12. `calculate` - Solve mathematical expressions.
    Args: {"expr": "str"}
13. `convert_timezone` - Convert a timestamp across timezones.
    Args: {"dt": "YYYY-MM-DD HH:MM", "from_tz": "str", "to_tz": "str"}
14. `weather_lookup` - View current weather for a city.
    Args: {"city": "str"}
15. `web_search` - Query web search snippets.
    Args: {"query": "str"}
16. `jira_mcp` - Query Jira projects, assigned issues, create tickets, transition tickets, and comment using Jira MCP.
    Args: {"method": "list_projects|list_assigned_issues|create_issue|transition_issue|add_comment", "project_key": "str (optional)", "summary": "str (optional)", "description": "str (optional)", "issue_key": "str (optional)", "transition_id": "str (optional)", "comment": "str (optional)", "jql": "str (optional)"}
17. `files_mcp` - Search, browse and read local files from whitelisted search folders.
    Args: {"method": "search_files|read_file", "query": "str (optional)", "search_type": "name|extension|content (optional)", "path": "str (optional)"}

IMPORTANT: Always answer using clean markdown. Keep responses concise and focused on productivity.
Current Date/Time context: {current_time}
"""

async def execute_tool(tool_name: str, args: Dict[str, Any], mode: str = "work") -> Dict[str, Any]:
    db = get_db_for_mode(mode)
    try:
        if tool_name == "list_tasks":
            tasks = db.query(Task).all()
            return {"tasks": [{"id": t.id, "title": t.title, "priority": t.priority, "status": t.status, "due_date": str(t.due_date) if t.due_date else None} for t in tasks]}
        
        elif tool_name == "create_task":
            import datetime
            due = None
            if args.get("due_date"):
                try: due = datetime.datetime.fromisoformat(args["due_date"].replace(" ", "T"))
                except: pass
            task = Task(
                title=args.get("title", "Untitled Task"),
                description=args.get("description"),
                priority=args.get("priority", "medium"),
                due_date=due
            )
            db.add(task)
            db.commit()
            return {"status": "success", "message": f"Created task: {task.title}", "task_id": task.id}
        
        elif tool_name == "update_task":
            import datetime
            task = db.query(Task).filter(Task.id == args.get("task_id")).first()
            if not task:
                return {"error": "Task not found"}
            if args.get("status"):
                task.status = args["status"]
                if task.status == "completed":
                    task.completed_at = datetime.datetime.utcnow()
                else:
                    task.completed_at = None
            db.commit()
            return {"status": "success", "message": f"Updated task {task.title} to {task.status}"}
            
        elif tool_name == "list_notes":
            notes = db.query(Note).all()
            return {"notes": [{"id": n.id, "title": n.title, "tags": n.tags} for n in notes]}
            
        elif tool_name == "create_note":
            note = Note(
                title=args.get("title", "Untitled Note"),
                content=args.get("content"),
                tags=args.get("tags")
            )
            db.add(note)
            db.commit()
            return {"status": "success", "message": f"Created note: {note.title}", "note_id": note.id}
            
        elif tool_name == "search_notes":
            query = args.get("query", "").lower()
            notes = db.query(Note).all()
            matches = []
            for n in notes:
                if query in (n.title or "").lower() or query in (n.content or "").lower():
                    matches.append({"id": n.id, "title": n.title, "content": n.content})
            return {"matches": matches}
            
        elif tool_name == "list_events":
            events = db.query(Event).all()
            return {"events": [{"id": e.id, "title": e.title, "start_time": str(e.start_time), "end_time": str(e.end_time), "location": e.location} for e in events]}
            
        elif tool_name == "create_event":
            import datetime
            start = datetime.datetime.fromisoformat(args["start_time"].replace(" ", "T"))
            end = datetime.datetime.fromisoformat(args["end_time"].replace(" ", "T"))
            event = Event(
                title=args.get("title", "Untitled Event"),
                description=args.get("description"),
                location=args.get("location"),
                start_time=start,
                end_time=end
            )
            db.add(event)
            db.commit()
            return {"status": "success", "message": f"Created event: {event.title} at {event.start_time}", "event_id": event.id}
            
        elif tool_name == "list_emails":
            from app.services.gmail import get_recent_emails
            emails = await get_recent_emails(args.get("max_results", 5), mode=mode)
            return {"emails": emails}
            
        elif tool_name == "figma_mcp":
            from app.services.mcp import query_figma_mcp
            res = await query_figma_mcp(args.get("query", ""), mode=mode)
            return {"figma_result": res}

        elif tool_name == "github_mcp":
            from app.services.github import query_github_mcp
            res = await query_github_mcp(
                method=args.get("method"),
                repo=args.get("repo"),
                issue_number=args.get("issue_number"),
                title=args.get("title"),
                body=args.get("body"),
                query=args.get("query"),
                mode=mode
            )
            return {"github_result": res}

        elif tool_name == "jira_mcp":
            from app.services.jira_service import JiraService
            service = JiraService(mode=mode)
            method = args.get("method")
            if method == "list_projects":
                res = await service.list_projects()
                return {"projects": res}
            elif method == "list_assigned_issues":
                res = await service.list_assigned_issues(args.get("jql"))
                return {"issues": res}
            elif method == "create_issue":
                res = await service.create_issue(
                    project_key=args.get("project_key"),
                    summary=args.get("summary"),
                    description=args.get("description", ""),
                    issue_type=args.get("issue_type", "Task")
                )
                return {"created_issue": res}
            elif method == "transition_issue":
                res = await service.transition_issue(
                    issue_key=args.get("issue_key"),
                    transition_id=args.get("transition_id")
                )
                return {"transition_result": res}
            elif method == "add_comment":
                res = await service.add_comment(
                    issue_key=args.get("issue_key"),
                    comment=args.get("comment")
                )
                return {"comment_result": res}
            else:
                return {"error": f"Invalid Jira method: {method}"}

        elif tool_name == "files_mcp":
            row = db.query(Setting).filter(Setting.key == "accessible_folders").first()
            import json
            whitelist = []
            if row and row.value:
                try:
                    whitelist = json.loads(row.value)
                except Exception:
                    whitelist = []
            if not whitelist:
                from pathlib import Path
                whitelist = [str(Path.home())]
            from app.services.files_service import FilesService
            from pathlib import Path
            service = FilesService(db, [Path(p) for p in whitelist])
            
            method = args.get("method")
            if method == "search_files":
                query = args.get("query", "")
                stype = args.get("search_type", "name")
                if stype == "name":
                    results = service.search_by_name(query)
                elif stype == "extension":
                    results = service.search_by_extension(query)
                elif stype == "content":
                    results = service.search_by_content(query)
                else:
                    return {"error": f"Invalid search type: {stype}"}
                return {"results": results}
            elif method == "read_file":
                path = args.get("path")
                if not path:
                    return {"error": "Path required for read_file"}
                content = service.read_file(path)
                service.add_recent(path)
                return {"content": content}
            else:
                return {"error": f"Invalid files method: {method}"}

        elif tool_name == "calculate":
            import re
            expr = args.get("expr", "")
            # Safe evaluation pattern to prevent malicious input executions
            cleaned = re.sub(r'[^0-9+\-*/().\s]', '', expr)
            try:
                res = eval(cleaned)
                return {"result": res}
            except Exception as e:
                return {"error": f"Evaluation failed: {str(e)}"}

        elif tool_name == "convert_timezone":
            from datetime import datetime, timedelta
            dt_str = args.get("dt", "")
            from_tz = args.get("from_tz", "UTC").upper()
            to_tz = args.get("to_tz", "UTC").upper()
            
            offsets = {
                "UTC": 0, "GMT": 0, "EST": -5, "EDT": -4, "CST": -6, 
                "CDT": -5, "MST": -7, "MDT": -6, "PST": -8, "PDT": -7, 
                "IST": 5.5, "BST": 1, "CET": 1, "JST": 9
            }
            try:
                dt = datetime.fromisoformat(dt_str.replace(" ", "T"))
                from_off = offsets.get(from_tz, 0)
                to_off = offsets.get(to_tz, 0)
                diff = to_off - from_off
                converted = dt + timedelta(hours=diff)
                return {"original": dt_str, "from_tz": from_tz, "to_tz": to_tz, "converted": str(converted)}
            except Exception as e:
                return {"error": f"Timezone conversion failed: {str(e)}"}

        elif tool_name == "weather_lookup":
            city = args.get("city", "New York")
            import random
            temp = random.randint(15, 32)
            conditions = ["Sunny", "Partly Cloudy", "Rainy", "Overcast", "Clear Sky"]
            cond = conditions[temp % len(conditions)]
            return {
                "city": city,
                "temperature": f"{temp}°C",
                "condition": cond,
                "humidity": f"{random.randint(40, 80)}%",
                "wind": f"{random.randint(5, 25)} km/h"
            }

        elif tool_name == "web_search":
            query = args.get("query", "")
            return {
                "query": query,
                "results": [
                    {"title": f"Mickey search result for {query}", "snippet": f"Learn more about {query} within Mickey professional workspace. Guides and specifications.", "url": f"https://www.{query.lower().replace(' ', '')}.org"},
                    {"title": f"Everything you need to know about {query}", "snippet": f"A comprehensive analysis of {query} trends and best practices.", "url": f"https://techblog.com/posts/{query.lower().replace(' ', '-')}"}
                ]
            }
            
        else:
            return {"error": f"Unknown tool: {tool_name}"}
    except Exception as e:
        logger.exception("Error executing tool")
        return {"error": str(e)}
    finally:
        db.close()

def extract_tool_calls(text: str) -> List[Dict[str, Any]]:
    tool_calls = []
    in_string = False
    escape_next = False
    brace_depth = 0
    current_json = []
    
    for char in text:
        if escape_next:
            escape_next = False
            if brace_depth > 0:
                current_json.append(char)
            continue
            
        if char == '\\':
            escape_next = True
            if brace_depth > 0:
                current_json.append(char)
            continue
            
        if char == '"':
            in_string = not in_string
            if brace_depth > 0:
                current_json.append(char)
            continue
            
        if not in_string:
            if char == '{':
                brace_depth += 1
                current_json.append(char)
            elif char == '}':
                brace_depth -= 1
                if brace_depth >= 0:
                    current_json.append(char)
                if brace_depth == 0:
                    json_str = "".join(current_json).strip()
                    current_json = []
                    try:
                        data = json.loads(json_str)
                        if isinstance(data, dict) and "tool" in data:
                            tool_calls.append(data)
                    except Exception:
                        pass
            else:
                if brace_depth > 0:
                    current_json.append(char)
        else:
            if brace_depth > 0:
                current_json.append(char)
                
    return tool_calls
async def generate_chat_stream(messages: List[Dict[str, str]], model_name: Optional[str] = None, mode: str = "work") -> AsyncGenerator[str, None]:
    import datetime
    
    # Query available models from local Ollama tags to prevent 404 error
    available = await get_available_models(mode=mode)
    
    if not model_name:
        model_name = get_db_setting("selected_model", "", mode=mode)
        
    if not model_name or model_name not in available:
        if available:
            model_name = available[0]
        else:
            model_name = "llama3.1"
            
    url = f"{get_ollama_url(mode)}/api/chat"
    
    # Inject system prompt
    current_time_str = datetime.datetime.now().strftime("%A, %B %d, %Y %I:%M %p")
    system_item = {"role": "system", "content": SYSTEM_PROMPT.replace("{current_time}", current_time_str)}
    
    # Check if system prompt is already present
    chat_messages = [system_item] + [m for m in messages if m["role"] != "system"]
    
    payload = {
        "model": model_name,
        "messages": chat_messages,
        "stream": True
    }
    
    tool_buffer = ""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    yield f"Error: Ollama returned status {response.status_code}"
                    return
                    
                async for chunk in response.aiter_lines():
                    if not chunk:
                        continue
                    try:
                        chunk_data = json.loads(chunk)
                        token = chunk_data.get("message", {}).get("content", "")
                        tool_buffer += token
                        yield token
                    except Exception as e:
                        logger.error(f"Error parsing Ollama chunk: {e}")
                        
            # After stream completes, check if there are any tool calls in the output
            try:
                tool_calls = extract_tool_calls(tool_buffer)
            except Exception as e:
                logger.error(f"Error extracting tool calls: {e}")
                tool_calls = []
                
            if tool_calls:
                try:
                    tool_results = []
                    for call_data in tool_calls:
                        tool_name = call_data.get("tool")
                        args = call_data.get("args", {})
                        
                        # Yield structured efforts delimiter for parsing in frontend
                        yield f"\n__efforts_start__:{json.dumps({'tool': tool_name, 'args': args})}\n"
                        tool_result = await execute_tool(tool_name, args, mode=mode)
                        yield f"\n__efforts_end__:{json.dumps(tool_result)}\n"
                        
                        tool_results.append((call_data, tool_result))
                    
                    # Construct query for final answer from Ollama
                    assistant_msg_content = tool_buffer
                    
                    results_summary = []
                    for call_data, tool_result in tool_results:
                        tool_name = call_data.get("tool")
                        results_summary.append(f"Tool '{tool_name}' execution result: {json.dumps(tool_result)}")
                    
                    user_msg_content = "\n".join(results_summary) + "\nProvide the final reply to my original message based on these results."
                    
                    tool_messages = chat_messages + [
                        {"role": "assistant", "content": assistant_msg_content},
                        {"role": "user", "content": user_msg_content}
                    ]
                    
                    final_payload = {
                        "model": model_name,
                        "messages": tool_messages,
                        "stream": True
                    }
                    
                    async with client.stream("POST", url, json=final_payload) as final_resp:
                        async for chunk in final_resp.aiter_lines():
                            if not chunk:
                                continue
                            final_data = json.loads(chunk)
                            yield final_data.get("message", {}).get("content", "")
                except Exception as tool_err:
                    logger.error(f"Tool execution error: {tool_err}")
                    yield f"\n\nFailed to execute tool. Raw response: {tool_buffer}"
                
    except Exception as e:
        logger.exception("Error in chat stream generation")
        yield f"\nConnection to local Ollama failed. Please ensure Ollama is running at {get_ollama_url(mode)} and you have loaded the model '{model_name}'."


