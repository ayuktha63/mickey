import os
from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL_WORK = "sqlite:///./workspace_work.db"
DATABASE_URL_PERSONAL = "sqlite:///./workspace_personal.db"

# Create two independent engines
engines = {
    "work": create_engine(DATABASE_URL_WORK, connect_args={"check_same_thread": False}),
    "personal": create_engine(DATABASE_URL_PERSONAL, connect_args={"check_same_thread": False})
}

# Create sessionmakers for both
Sessions = {
    "work": sessionmaker(autocommit=False, autoflush=False, bind=engines["work"]),
    "personal": sessionmaker(autocommit=False, autoflush=False, bind=engines["personal"])
}

# Fallbacks for legacy single-db imports
engine = engines["work"]
SessionLocal = Sessions["work"]

Base = declarative_base()

def get_db_for_mode(mode: str):
    target_mode = mode.lower() if mode else "work"
    if target_mode not in Sessions:
        target_mode = "work"
    return Sessions[target_mode]()

def get_db(request: Request):
    mode = request.headers.get("x-workspace-mode", "work").lower()
    if mode not in Sessions:
        mode = "work"
    db = Sessions[mode]()
    try:
        yield db
    finally:
        db.close()
