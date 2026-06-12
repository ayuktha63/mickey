import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.api.routes import router

# Configure logging
BASE_DIR = Path(__file__).resolve().parent
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(BASE_DIR / "app.log", mode="a")
    ]
)
logger = logging.getLogger("workspace")

app = FastAPI(
    title="Mickey AI Productivity Workspace",
    description="A simple, premium self-hosted productivity workspace incorporating AI assistant, tasks, notes, calendar, and Gmail integration.",
    version="1.0.0"
)

# Resolve paths dynamically
static_dir = BASE_DIR / "app" / "static"

# Ensure static directory exists
static_dir.mkdir(parents=True, exist_ok=True)

# Mount static files to serve CSS, JS
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Include workspace routers
app.include_router(router)

logger.info("Mickey AI Productivity Workspace routes and static endpoints initialized.")

if __name__ == "__main__":
    import uvicorn
    # Defaulting to 8000 for local deployment
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
