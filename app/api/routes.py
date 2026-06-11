import datetime
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import httpx
from pathlib import Path

from app.database.connection import get_db, Base, engines, SessionLocal, get_db_for_mode
from app.database.models import Task, Note, Event, Conversation, Message, Setting, EcosystemLog
from app.models import schemas
from app.services import ollama, gmail, mcp

# Auto-create tables on startup for both databases
for mode_name, eng in engines.items():
    Base.metadata.create_all(bind=eng)

router = APIRouter()

# Locate templates directory
templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent.parent / "templates"))

@router.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# ── DASHBOARD ──
@router.get("/api/dashboard")
def get_dashboard_summary(db: Session = Depends(get_db)):
    today = datetime.datetime.utcnow().date()
    start_of_today = datetime.datetime.combine(today, datetime.time.min)
    end_of_today = datetime.datetime.combine(today, datetime.time.max)
    
    # Fetch today's tasks
    tasks = db.query(Task).filter(
        Task.status == "pending"
    ).order_by(Task.due_date.asc(), Task.priority.desc()).limit(10).all()
    
    # Fetch upcoming events (next 7 days)
    seven_days_later = start_of_today + datetime.timedelta(days=7)
    events = db.query(Event).filter(
        Event.start_time >= start_of_today,
        Event.start_time <= seven_days_later
    ).order_by(Event.start_time.asc()).limit(10).all()
    
    # Fetch recent notes
    notes = db.query(Note).order_by(Note.updated_at.desc()).limit(5).all()
    
    return {
        "tasks": [{"id": t.id, "title": t.title, "priority": t.priority, "status": t.status, "due_date": t.due_date.isoformat() if t.due_date else None} for t in tasks],
        "events": [{"id": e.id, "title": e.title, "start_time": e.start_time.isoformat(), "end_time": e.end_time.isoformat(), "location": e.location} for e in events],
        "notes": [{"id": n.id, "title": n.title, "updated_at": n.updated_at.isoformat()} for n in notes]
    }

# ── TASKS ──
@router.get("/api/tasks", response_model=List[schemas.TaskResponse])
def read_tasks(db: Session = Depends(get_db)):
    return db.query(Task).order_by(Task.status.desc(), Task.due_date.asc(), Task.priority.desc()).all()

@router.post("/api/tasks", response_model=schemas.TaskResponse)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    db_task = Task(
        title=task.title,
        description=task.description,
        priority=task.priority,
        status=task.status,
        due_date=task.due_date
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.put("/api/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task(task_id: str, task_update: schemas.TaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    for field, value in task_update.model_dump(exclude_unset=True).items():
        setattr(db_task, field, value)
        if field == "status" and value == "completed":
            db_task.completed_at = datetime.datetime.utcnow()
        elif field == "status" and value == "pending":
            db_task.completed_at = None
            
    db.commit()
    db.refresh(db_task)
    return db_task

@router.delete("/api/tasks/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(db_task)
    db.commit()
    return {"status": "success"}

# ── NOTES ──
@router.get("/api/notes", response_model=List[schemas.NoteResponse])
def read_notes(q: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Note)
    if q:
        query = query.filter(Note.title.ilike(f"%{q}%") | Note.content.ilike(f"%{q}%"))
    return query.order_by(Note.updated_at.desc()).all()

@router.post("/api/notes", response_model=schemas.NoteResponse)
def create_note(note: schemas.NoteCreate, db: Session = Depends(get_db)):
    db_note = Note(
        title=note.title,
        content=note.content,
        tags=note.tags
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

@router.put("/api/notes/{note_id}", response_model=schemas.NoteResponse)
def update_note(note_id: str, note_update: schemas.NoteUpdate, db: Session = Depends(get_db)):
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    for field, value in note_update.model_dump(exclude_unset=True).items():
        setattr(db_note, field, value)
    db.commit()
    db.refresh(db_note)
    return db_note

@router.delete("/api/notes/{note_id}")
def delete_note(note_id: str, db: Session = Depends(get_db)):
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(db_note)
    db.commit()
    return {"status": "success"}

# ── EVENTS ──
@router.get("/api/events", response_model=List[schemas.EventResponse])
def read_events(db: Session = Depends(get_db)):
    return db.query(Event).order_by(Event.start_time.asc()).all()

@router.post("/api/events", response_model=schemas.EventResponse)
def create_event(event: schemas.EventCreate, db: Session = Depends(get_db)):
    db_event = Event(
        title=event.title,
        description=event.description,
        location=event.location,
        start_time=event.start_time,
        end_time=event.end_time,
        all_day=event.all_day
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

@router.put("/api/events/{event_id}", response_model=schemas.EventResponse)
def update_event(event_id: str, event_update: schemas.EventUpdate, db: Session = Depends(get_db)):
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, value in event_update.model_dump(exclude_unset=True).items():
        setattr(db_event, field, value)
    db.commit()
    db.refresh(db_event)
    return db_event

@router.delete("/api/events/{event_id}")
def delete_event(event_id: str, db: Session = Depends(get_db)):
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(db_event)
    db.commit()
    return {"status": "success"}

# ── CHAT ──
@router.get("/api/conversations", response_model=List[schemas.ConversationResponse])
def get_conversations(db: Session = Depends(get_db)):
    return db.query(Conversation).order_by(Conversation.updated_at.desc()).all()

@router.get("/api/conversations/{conv_id}/messages", response_model=List[schemas.MessageResponse])
def get_messages(conv_id: str, db: Session = Depends(get_db)):
    return db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.created_at.asc()).all()

@router.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"status": "success"}

@router.post("/api/chat")
async def chat_interaction(req: schemas.ChatRequest, request: Request, db: Session = Depends(get_db)):
    mode = request.headers.get("x-workspace-mode", "work").lower()
    conv_id = req.conversation_id
    if not conv_id:
        # Create a new conversation
        # Auto-name based on query snippet
        title = req.message[:30] + "..." if len(req.message) > 30 else req.message
        conv = Conversation(title=title, model_name=req.model_name or "default")
        db.add(conv)
        db.commit()
        db.refresh(conv)
        conv_id = conv.id
    else:
        conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
            
    # Save user message
    user_msg = Message(conversation_id=conv_id, role="user", content=req.message)
    db.add(user_msg)
    db.commit()
    
    # Retrieve chat history
    db_messages = db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.created_at.asc()).all()
    history = [{"role": m.role, "content": m.content} for m in db_messages]
    
    # We yield tokens and at the end save the aggregated response
    async def stream_response():
        # First send the conversation ID metadata chunk
        yield f"__metadata__:{json.dumps({'conversation_id': conv_id})}\n"
        
        full_response = ""
        async for token in ollama.generate_chat_stream(history, req.model_name, mode=mode):
            full_response += token
            yield token
            
        # Save assistant message
        db_session = get_db_for_mode(mode)
        try:
            assistant_msg = Message(conversation_id=conv_id, role="assistant", content=full_response)
            db_session.add(assistant_msg)
            # Update conversation timestamp
            db_conv = db_session.query(Conversation).filter(Conversation.id == conv_id).first()
            if db_conv:
                db_conv.updated_at = datetime.datetime.utcnow()
            db_session.commit()
        finally:
            db_session.close()

    return StreamingResponse(stream_response(), media_type="text/plain")

# ── MODELS ──
@router.get("/api/models")
async def list_models(request: Request):
    mode = request.headers.get("x-workspace-mode", "work").lower()
    models = await ollama.get_available_models(mode=mode)
    return {"models": models}

# ── SETTINGS ──
@router.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    # Retrieve all settings keys
    keys = [
        "ollama_url", "selected_model", "gmail_address", "gmail_app_password", 
        "figma_access_token", "mcp_figma_url", "clock_style", "water_reminder_enabled", 
        "water_reminder_interval", "system_name", "assistant_name", "clock_format",
        "mickey_face_template", "mickey_fingerprint_template", "mickey_username", 
        "mickey_password", "mickey_bio_enrolled", "mickey_pass_enrolled",
        "github_access_token", "mcp_github_url"
    ]
    res = {}
    for k in keys:
        row = db.query(Setting).filter(Setting.key == k).first()
        res[k] = row.value if row else ""
    return res

@router.post("/api/settings")
def save_settings(req: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    sync_fields = [
        "system_name", "assistant_name", "clock_format", "clock_style",
        "mickey_face_template", "mickey_fingerprint_template", "mickey_username", 
        "mickey_password", "mickey_bio_enrolled", "mickey_pass_enrolled"
    ]
    for field, value in req.model_dump(exclude_unset=True).items():
        if value is None:
            continue
        if field in sync_fields:
            from app.database.connection import get_db_for_mode
            for m in ["work", "personal"]:
                m_db = get_db_for_mode(m)
                try:
                    row = m_db.query(Setting).filter(Setting.key == field).first()
                    if not row:
                        row = Setting(key=field, value=str(value))
                        m_db.add(row)
                    else:
                        row.value = str(value)
                    m_db.commit()
                except Exception as e:
                    print(f"Error syncing field {field} for mode {m}:", e)
                finally:
                    m_db.close()
        else:
            row = db.query(Setting).filter(Setting.key == field).first()
            if not row:
                row = Setting(key=field, value=str(value)) # ensure stored as string
                db.add(row)
            else:
                row.value = str(value)
    db.commit()
    return {"status": "success"}

# ── GMAIL TEST ──
@router.get("/api/gmail/recent")
async def check_gmail_emails(request: Request, limit: int = 5, bypass_cache: bool = False):
    mode = request.headers.get("x-workspace-mode", "work").lower()
    emails = await gmail.get_recent_emails(limit, mode=mode, bypass_cache=bypass_cache)
    return {"emails": emails}

# ── ECOSYSTEM & SCREEN TIME ──
@router.post("/api/ecosystem/sync")
def sync_ecosystem(payload: schemas.SyncEcosystemPayload, db: Session = Depends(get_db)):
    import datetime
    current_date = datetime.date.today().strftime("%Y-%m-%d")
    
    log = db.query(EcosystemLog).filter(EcosystemLog.date == current_date).first()
    if not log:
        log = EcosystemLog(
            date=current_date,
            active_time=payload.active_time,
            idle_time=payload.idle_time,
            locked_time=payload.locked_time,
            sleep_time=payload.sleep_time,
            focus_score=payload.focus_delta,
            learning_score=payload.learning_delta,
            break_score=payload.break_delta
        )
        db.add(log)
    else:
        log.active_time += payload.active_time
        log.idle_time += payload.idle_time
        log.locked_time += payload.locked_time
        log.sleep_time += payload.sleep_time
        log.focus_score += payload.focus_delta
        log.learning_score += payload.learning_delta
        log.break_score += payload.break_delta
    db.commit()
    return {"status": "success"}

@router.get("/api/ecosystem/status")
def get_ecosystem_status(db: Session = Depends(get_db)):
    logs = db.query(EcosystemLog).order_by(EcosystemLog.date.asc()).all()
    
    total_active = sum(l.active_time for l in logs)
    total_idle = sum(l.idle_time for l in logs)
    total_locked = sum(l.locked_time for l in logs)
    total_sleep = sum(l.sleep_time for l in logs)
    
    total_focus = sum(l.focus_score for l in logs)
    total_learning = sum(l.learning_score for l in logs)
    total_break = sum(l.break_score for l in logs)
    total_pollution = total_idle // 600
    
    active_hours = total_active / 3600.0
    
    # Growth progression stages (Seed -> Sprout -> Grassland -> Small Garden -> Garden -> Park -> Village -> Town -> Forest -> Valley -> Continent -> Ecosystem World)
    stage = "🌱 Seed"
    if active_hours >= 240:
        stage = "🌎 Ecosystem World"
    elif active_hours >= 220:
        stage = "🌍 Continent"
    elif active_hours >= 180:
        stage = "🏞️ Valley"
    elif active_hours >= 140:
        stage = "🌳 Forest"
    elif active_hours >= 100:
        stage = "🏘️ Town"
    elif active_hours >= 80:
        stage = "🏡 Village"
    elif active_hours >= 60:
        stage = "🌴 Park"
    elif active_hours >= 40:
        stage = "🌲 Garden"
    elif active_hours >= 20:
        stage = "🌳 Small Garden"
    elif active_hours >= 10:
        stage = "🌾 Grassland"
    elif active_hours >= 5:
        stage = "🌿 Sprout"
        
    positive_sum = total_focus + total_learning + total_break
    if positive_sum + total_pollution == 0:
        health_score = 100
    else:
        health_score = int(100 * positive_sum / (positive_sum + total_pollution))
        
    history = []
    for l in logs:
        history.append({
            "date": l.date,
            "active_time": l.active_time,
            "idle_time": l.idle_time,
            "locked_time": l.locked_time,
            "sleep_time": l.sleep_time,
            "focus_score": l.focus_score,
            "learning_score": l.learning_score,
            "break_score": l.break_score
        })
        
    return {
        "active_hours": round(active_hours, 2),
        "stage": stage,
        "health_score": health_score,
        "lifetime": {
            "active": total_active,
            "idle": total_idle,
            "locked": total_locked,
            "sleep": total_sleep,
            "focus": total_focus,
            "learning": total_learning,
            "break": total_break,
            "pollution": total_pollution
        },
        "history": history
    }

# ── GITHUB MCP & REST API INTEGRATION ──
@router.post("/api/github/validate")
async def validate_github(req: schemas.SettingsUpdate, request: Request):
    token = req.github_access_token
    mcp_url = req.mcp_github_url
    
    if not token and not mcp_url:
        mode = request.headers.get("x-workspace-mode", "work").lower()
        from app.services.github import get_github_credentials
        token, mcp_url = get_github_credentials(mode)
        
    if not token and not mcp_url:
        return {"status": "disconnected", "message": "GitHub Access Token or MCP URL is not configured."}
        
    if mcp_url:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(mcp_url, json={"method": "tools/list", "params": {}})
                if resp.status_code == 200:
                    return {"status": "connected", "message": "Successfully connected to external GitHub MCP Server."}
                else:
                    return {"status": "error", "message": f"MCP server returned status {resp.status_code}: {resp.text}"}
        except Exception as e:
            return {"status": "error", "message": f"Could not reach external GitHub MCP server: {str(e)}"}
            
    if token:
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Mickey-Workspace-Agent"
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get("https://api.github.com/user", headers=headers)
                if resp.status_code == 200:
                    user_data = resp.json()
                    return {
                        "status": "connected",
                        "username": user_data.get("login"),
                        "name": user_data.get("name"),
                        "message": f"Successfully authenticated as {user_data.get('login')}."
                    }
                elif resp.status_code == 401:
                    return {"status": "error", "message": "Invalid Personal Access Token."}
                else:
                    return {"status": "error", "message": f"GitHub API returned error {resp.status_code}."}
        except Exception as e:
            return {"status": "error", "message": f"GitHub connection failed: {str(e)}"}

@router.post("/api/github-mcp")
async def local_github_mcp(req: Dict[str, Any], request: Request):
    method = req.get("method")
    params = req.get("params", {})
    tool_name = params.get("name")
    arguments = params.get("arguments", {})
    
    mode = request.headers.get("x-workspace-mode", "work").lower()
    from app.services.github import query_github_mcp
    
    if method == "tools/list":
        return {
            "tools": [
                {"name": "list_repositories", "description": "List user repositories"},
                {"name": "view_repository", "description": "Get detailed repository stats"},
                {"name": "read_issues", "description": "List open issues in a repository"},
                {"name": "create_issue", "description": "Create a new issue"},
                {"name": "read_pull_requests", "description": "List open pull requests"},
                {"name": "view_commits", "description": "List repository commits"},
                {"name": "search_code", "description": "Search code within repositories"}
            ]
        }
        
    if method == "tools/call" and tool_name:
        res = await query_github_mcp(
            method=tool_name,
            repo=arguments.get("repo"),
            issue_number=arguments.get("issue_number"),
            title=arguments.get("title"),
            body=arguments.get("body"),
            query=arguments.get("query"),
            mode=mode
        )
        return res
        
    return {"error": "Invalid JSON-RPC or MCP request format."}
