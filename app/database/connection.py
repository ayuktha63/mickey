import os
import shutil
from pathlib import Path
from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Detect if running on Vercel or similar read-only serverless environment
IS_VERCEL = os.environ.get("VERCEL") is not None

if IS_VERCEL:
    DATABASE_DIR = "/tmp"
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    # Copy pre-existing SQLite databases to /tmp if they exist and are not already there
    for db_name in ["workspace_work.db", "workspace_personal.db"]:
        dest_path = Path(DATABASE_DIR) / db_name
        src_path_root = BASE_DIR / db_name
        src_path_data = BASE_DIR / "data" / db_name
        
        src_path = None
        if src_path_data.exists():
            src_path = src_path_data
        elif src_path_root.exists():
            src_path = src_path_root
            
        if src_path and not dest_path.exists():
            try:
                shutil.copy2(src_path, dest_path)
            except Exception as e:
                print(f"Failed to copy {db_name} to /tmp: {e}")
else:
    DATABASE_DIR = os.getenv("DATABASE_DIR", ".")

DATABASE_URL_WORK = f"sqlite:///{DATABASE_DIR}/workspace_work.db"
DATABASE_URL_PERSONAL = f"sqlite:///{DATABASE_DIR}/workspace_personal.db"

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
