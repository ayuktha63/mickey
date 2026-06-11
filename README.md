# Odysseus: Self-Hosted AI Productivity Workspace

Odysseus is a clean, modern, and lightweight personal AI workspace. It consolidates daily productivity tools—**Tasks/Todo**, **Notes**, **Calendar**, **Gmail Feeds**, and **Figma MCP Sandboxes**—into a single web interface backed by a local AI model (running through Ollama). 

The assistant has deep context of your productivity database, enabling it to read, create, and modify tasks, notes, and calendar events directly.

---

## Technical Stack

- **Backend**: FastAPI (Python 3.11+)
- **ORM / Database**: SQLAlchemy / SQLite
- **Frontend**: Vanilla JS, Jinja2 Templates, custom styled-CSS (Zinc & Slate dark standard SaaS palette)
- **Local AI Integrations**: Ollama (supports `llama3.1`, `qwen2.5`, etc. with local JSON-based tool loops)
- **Email Access**: Secure IMAP for Gmail Inbox feeds
- **Design Integration**: Figma PAT API with custom SSE/HTTP Model Context Protocol (MCP) server endpoints

---

## Project Structure

```text
ai-productivity-workspace/
├── app/
│   ├── api/
│   │   └── routes.py         # REST and WebSocket/Stream API endpoints
│   ├── database/
│   │   ├── connection.py     # SQLite connection manager & session lifecycle
│   │   └── models.py         # SQLAlchemy schemas (users, tasks, notes, events, conversations, settings)
│   ├── models/
│   │   └── schemas.py        # Pydantic schemas for request/response serialization
│   ├── services/
│   │   ├── gmail.py          # Secure Gmail client with mock onboard fallback
│   │   ├── mcp.py            # Figma direct API client / external MCP router
│   │   └── ollama.py         # Ollama streaming client & JSON-pattern tool executor
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css     # Clean modern SaaS styling (dark/light themes)
│   │   └── js/
│   │       └── app.js        # Client-side state router & streaming chat response handler
│   └── templates/
│       └── index.html        # Main dashboard UI HTML
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── main.py                   # FastAPI Application Entrypoint
└── README.md                 # Setup & configuration guide
```

---

## Setup & Local Installation

### Prerequisites
- [Python 3.11](https://www.python.org/downloads/) or higher installed locally.
- [Ollama](https://ollama.com) installed and running.

### 1. Set Up and Run Locally
Clone or open this folder in your terminal and follow these steps:

1. **Create and Activate a Virtual Environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the FastAPI Development Server:**
   ```bash
   python main.py
   ```
   The application will boot up at **`http://localhost:8000`**. Open this address in your web browser.

---

## Docker Deployment

To run Odysseus in containerized sandbox environments:

1. **Build and Run Containers:**
   ```bash
   docker compose up --build
   ```

2. **Accessing the app**:
   Navigate to **`http://localhost:8000`** in your browser. All data will persist inside `./data/workspace.db` on your local host workspace directory.

---

## Configuration & Feature Guide

To unleash the full capabilities of the assistant, click on the **Settings** tab in the workspace sidebar.

### 1. Local AI Model Integration (Ollama)
1. Install [Ollama](https://ollama.com).
2. Download a model that handles local tool calling or reasoning (e.g. Llama 3.1):
   ```bash
   ollama run llama3.1
   ```
3. Enter your **Ollama Base Endpoint URL** (default is `http://localhost:11434`) and click **Check Ollama status** to pull the list of installed local models.
4. Select `llama3.1` (or your preferred local model) and save settings.
5. In the **AI Assistant** panel, you can now interact using streamed tool executions! Try prompting:
   - *"Create a task for project review on Friday"*
   - *"What tasks are due today?"*
   - *"Write a note summarizing my layout ideas"*

### 2. Gmail IMAP Inbox Linking
1. Open your Google Account page, select **Security**.
2. Under "How you sign in to Google", select **2-Step Verification** and set it up if you haven't already.
3. At the bottom of the page, click **App passwords**.
4. Enter an app name (e.g., "Odysseus AI Workspace") and generate a **16-character code**.
5. Paste this generated key into the **Google App Password** field in Odysseus Settings, along with your Gmail email address.
6. The dashboard widget and AI Assistant can now read and query recent inbox email subjects.

### 3. Figma Design Tool (MCP) Linking
- **Direct Integration**: Generate a Figma Personal Access Token (PAT) from your Figma Account Settings. Paste it into settings. Enter a Figma File Key (the string in the URL `figma.com/file/KEY/...`) in the AI chat to pull and analyze components.
- **Model Context Protocol (MCP) Integration**: If you run an external Figma Model Context Protocol server (e.g., SSE-based), specify the endpoint URL in the **Custom Figma MCP Server Endpoint** field to route tools queries directly to it.
- **Sandbox Mode**: When no keys are configured, Odysseus falls back gracefully to a mock design tokens library representing standard design specifications.

---

## Troubleshooting & Tips
- **SQLite locked error**: The SQLAlchemy engine is configured with `check_same_thread: False` to support FastAPI's asynchronous thread pool safely.
- **Ollama Timeout**: If running heavy local models, the HTTPX client connection handles timeouts up to 60 seconds. Make sure your hardware is capable of processing queries within this window or use smaller models (e.g., `qwen2.5:3b`, `phi3`).
