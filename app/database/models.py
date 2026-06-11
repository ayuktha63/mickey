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
