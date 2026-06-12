import datetime
import uuid
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from .connection import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, default="New Chat")
    model_name = Column(String, default="default")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    id = Column(String, primary_key=True, default=generate_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False) # "user", "assistant", "system"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String, default="medium") # "low", "medium", "high"
    status = Column(String, default="pending") # "pending", "completed"
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class Note(Base):
    __tablename__ = "notes"
    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    tags = Column(String, nullable=True) # comma separated tags
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class Event(Base):
    __tablename__ = "events"
    __tablename_alternative__ = "events"
    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    all_day = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(Text, nullable=True)

class EcosystemLog(Base):
    __tablename__ = "ecosystem_logs"
    id = Column(String, primary_key=True, default=generate_uuid)
    date = Column(String, unique=True, index=True)  # YYYY-MM-DD
    active_time = Column(Integer, default=0)       # in seconds
    idle_time = Column(Integer, default=0)         # in seconds
    locked_time = Column(Integer, default=0)       # in seconds
    sleep_time = Column(Integer, default=0)        # in seconds
    focus_score = Column(Integer, default=0)       # focus points (e.g. task done)
    learning_score = Column(Integer, default=0)    # learning points (e.g. note created, chat sent)
    break_score = Column(Integer, default=0)       # break points (e.g. water breaks done)

class RecentFile(Base):
    __tablename__ = "recent_files"
    id = Column(String, primary_key=True, default=generate_uuid)
    path = Column(String, nullable=False, index=True)
    size = Column(Integer, nullable=False)
    last_opened = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class FavoriteFolder(Base):
    __tablename__ = "favorite_folders"
    id = Column(String, primary_key=True, default=generate_uuid)
    path = Column(String, nullable=False, unique=True)
    added_at = Column(DateTime, default=datetime.datetime.utcnow)

class UserActionLog(Base):
    __tablename__ = "user_action_logs"
    id = Column(String, primary_key=True, default=generate_uuid)
    action_type = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class JiraConfig(Base):
    __tablename__ = "jira_configs"
    id = Column(String, primary_key=True, default=generate_uuid)
    mode = Column(String, nullable=False)  # "work" or "personal"
    url = Column(String, nullable=False)
    email = Column(String, nullable=False)
    encrypted_token = Column(String, nullable=False)
    connection_status = Column(String, default="disconnected")

class BrowserConfig(Base):
    __tablename__ = "browser_configs"
    id = Column(String, primary_key=True, default=generate_uuid)
    mode = Column(String, nullable=False)
    default_browser = Column(String, default="chrome")
    automation_enabled = Column(Boolean, default=False)
    monitoring_enabled = Column(Boolean, default=False)
    form_filling_enabled = Column(Boolean, default=False)
    page_summarization_enabled = Column(Boolean, default=False)
    download_monitoring_enabled = Column(Boolean, default=False)

class MCPLog(Base):
    __tablename__ = "mcp_logs"
    id = Column(String, primary_key=True, default=generate_uuid)
    mcp_name = Column(String, nullable=False)
    action = Column(String, nullable=False)
    details = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)



