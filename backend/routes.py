from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query

from backend.database import (
    get_all_courses,
    get_course_by_id,
    get_recent_queries,
)
from backend.models import (
    GoalRequest,
    RecommendationResponse,
    ChatRequest,
    ChatResponse,
)
from backend.ai_engine import (
    get_personalized_recommendation,
    handle_followup_chat,
)

router = APIRouter(prefix="/api/ai", tags=["AI Learning Assistant"])


@router.get("/content", summary="List all structured learning courses")
def list_courses(
    topic: Optional[str] = Query(None, description="Filter by topic (e.g. JavaScript, React, Python, etc.)"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty (Beginner, Intermediate, Advanced)"),
):
    try:
        courses = get_all_courses(topic=topic, difficulty=difficulty)
        return {
            "success": True,
            "total": len(courses),
            "courses": courses,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch content: {str(e)}")


@router.get("/content/{course_id}", summary="Get detailed information for a single course")
def get_course_detail(course_id: str):
    course = get_course_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail=f"Course '{course_id}' not found.")
    return {"success": True, "course": course}


@router.post("/recommend", response_model=RecommendationResponse, summary="Get personalized learning recommendations")
def recommend_path(req: GoalRequest):
    if not req.query or len(req.query.strip()) < 3:
        raise HTTPException(status_code=400, detail="Query must be at least 3 characters long.")
    try:
        return get_personalized_recommendation(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")


@router.post("/chat", response_model=ChatResponse, summary="Conversational follow-up assistant")
def chat_with_assistant(req: ChatRequest):
    if not req.message or len(req.message.strip()) == 0:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    try:
        return handle_followup_chat(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.get("/history", summary="Get recent recommendation history")
def query_history(limit: int = Query(10, ge=1, le=50)):
    try:
        queries = get_recent_queries(limit=limit)
        return {"success": True, "history": queries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"History error: {str(e)}")


@router.get("/stats", summary="Get content catalog and usage statistics")
def catalog_stats():
    try:
        all_courses = get_all_courses()
        topics = list({c["topic"] for c in all_courses})
        difficulties = list({c["difficulty"] for c in all_courses})
        total_hours = sum(c.get("total_hours", 0) for c in all_courses)
        total_modules = sum(len(c.get("learning_sequence", [])) for c in all_courses)

        return {
            "success": True,
            "total_courses": len(all_courses),
            "topics_count": len(topics),
            "topics": sorted(topics),
            "difficulties": sorted(difficulties),
            "total_curriculum_hours": total_hours,
            "total_learning_modules": total_modules,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats error: {str(e)}")
