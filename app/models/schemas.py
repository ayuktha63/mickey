from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class MessageBase(BaseModel):
    role: str
    content: str

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: str
    conversation_id: str
    created_at: datetime
    class Config:
        from_attributes = True

class ConversationBase(BaseModel):
    title: Optional[str] = "New Chat"
    model_name: Optional[str] = "default"

class ConversationCreate(ConversationBase):
    pass

class ConversationResponse(ConversationBase):
    id: str
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    status: Optional[str] = "pending"
    due_date: Optional[datetime] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None

class TaskResponse(TaskBase):
    id: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class NoteBase(BaseModel):
    title: str
    content: Optional[str] = None
    tags: Optional[str] = None

class NoteCreate(NoteBase):
    pass

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[str] = None

class NoteResponse(NoteBase):
    id: str
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: datetime
    end_time: datetime
    all_day: Optional[bool] = False

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    all_day: Optional[bool] = None

class EventResponse(EventBase):
    id: str
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    model_name: Optional[str] = None

class SettingsUpdate(BaseModel):
    ollama_url: Optional[str] = None
    selected_model: Optional[str] = None
    gmail_address: Optional[str] = None
    gmail_app_password: Optional[str] = None
    figma_access_token: Optional[str] = None
    mcp_figma_url: Optional[str] = None
    clock_style: Optional[str] = None
    water_reminder_enabled: Optional[bool] = None
    water_reminder_interval: Optional[int] = None
    system_name: Optional[str] = None
    assistant_name: Optional[str] = None
    clock_format: Optional[str] = None
    # Biometric Sync Keys
    mickey_face_template: Optional[str] = None
    mickey_fingerprint_template: Optional[str] = None
    mickey_username: Optional[str] = None
    mickey_password: Optional[str] = None
    mickey_bio_enrolled: Optional[str] = None
    mickey_pass_enrolled: Optional[str] = None
    # GitHub Integration Keys
    github_access_token: Optional[str] = None
    mcp_github_url: Optional[str] = None

class SyncEcosystemPayload(BaseModel):
    active_time: int
    idle_time: int
    locked_time: int
    sleep_time: int
    focus_delta: int
    learning_delta: int
    break_delta: int

