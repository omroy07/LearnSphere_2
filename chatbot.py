"""
chatbot.py - Entrypoint for LearnSphere AI Learning Assistant & AI Tutor Services.
Runs the upgraded FastAPI backend on port 5000.
"""
import os
import uvicorn
from backend.main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    print(f"Starting LearnSphere AI Learning Assistant on http://127.0.0.1:{port} ...")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=debug_mode)
