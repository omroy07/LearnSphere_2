import html
import os
import uvicorn
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.database import init_db
from backend.routes import router as ai_router
from backend.ai_engine import gemini_client, GEMINI_MODEL


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and seed structured content
    print("[SERVER] Initializing LearnSphere AI Learning Assistant database...")
    init_db()
    print("[SERVER] Database initialized and content verified.")
    yield


app = FastAPI(
    title="LearnSphere AI Learning Assistant API",
    description="Backend API powering personalized curriculum recommendations, semantic content retrieval, and AI tutoring for LearnSphere.",
    version="2.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend Vite dev server (port 5173), production URLs, and local requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount AI Learning Assistant routes
app.include_router(ai_router)


# Health check
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "learnsphere-ai-assistant",
        "version": "2.0.0",
        "ai_provider": "google-gemini" if gemini_client else "deterministic-semantic-engine",
    }


# Legacy /chat compatibility for home.html & review.html AI Tutor
class LegacyChatRequest(BaseModel):
    message: str


@app.post("/chat")
def legacy_chat(payload: LegacyChatRequest):
    user_input = payload.message.strip()
    if not user_input:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    if gemini_client:
        try:
            guardrails = (
                "You are an encouraging educational tutor for LearnSphere. "
                "Help the student with concepts in programming, computer science, mathematics, or science. "
                "Keep responses concise, clear, and actionable."
            )
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=f"{guardrails}\n\nUser: {user_input}",
            )
            raw = (response.text or "").strip()
            safe_text = html.escape(raw).replace("\n", "<br>")
            return {"reply": safe_text}
        except Exception as e:
            print(f"[LEGACY CHAT ERROR] {e}")

    # Fallback response
    return {
        "reply": f"Hello! I am your LearnSphere Assistant. You asked about: '{html.escape(user_input)}'. Explore our structured courses or visit the AI Assistant tab for a personalized learning roadmap!"
    }


# Legacy /explain_mistake compatibility
class ExplainMistakeRequest(BaseModel):
    question: str
    learnerAnswer: str
    correctAnswer: str
    topic: Optional[str] = "general"


@app.post("/explain_mistake")
def legacy_explain_mistake(payload: ExplainMistakeRequest):
    if gemini_client:
        try:
            prompt = (
                f"You are a helpful educational tutor. A learner answered a question incorrectly.\n"
                f"Topic: {payload.topic}\n"
                f"Question: {payload.question}\n"
                f"Learner's answer: {payload.learnerAnswer}\n"
                f"Correct answer: {payload.correctAnswer}\n\n"
                f"Explain concisely: 1) Why the learner's answer is mistaken. 2) The core principle behind the correct answer."
            )
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            raw = (response.text or "").strip()
            return {"reply": html.escape(raw).replace("\n", "<br>")}
        except Exception as e:
            print(f"[EXPLAIN MISTAKE ERROR] {e}")

    return {
        "reply": f"The correct answer is '{html.escape(payload.correctAnswer)}' because it directly satisfies the problem constraints, whereas '{html.escape(payload.learnerAnswer)}' misses key foundational conditions."
    }


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=5000, reload=True)
