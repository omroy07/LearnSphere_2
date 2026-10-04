import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import init_db, get_all_courses, get_course_by_id

client = TestClient(app)


def setup_module():
    init_db()


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "learnsphere-ai-assistant"


def test_get_all_courses():
    response = client.get("/api/ai/content")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total"] == 8
    topics = [c["topic"] for c in data["courses"]]
    assert "JavaScript" in topics
    assert "React" in topics
    assert "Python" in topics
    assert "Machine Learning" in topics


def test_filter_courses_by_topic():
    response = client.get("/api/ai/content?topic=React")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert data["courses"][0]["topic"] == "React"


def test_filter_courses_by_difficulty():
    response = client.get("/api/ai/content?difficulty=Beginner")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for c in data["courses"]:
        assert c["difficulty"] == "Beginner"


def test_get_course_detail():
    response = client.get("/api/ai/content/course-react-engineering")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    course = data["course"]
    assert course["id"] == "course-react-engineering"
    assert len(course["learning_sequence"]) >= 4
    assert len(course["topics_covered"]) >= 5
    assert "capstone_project" in course


def test_get_invalid_course_returns_404():
    response = client.get("/api/ai/content/non-existent-course-id")
    assert response.status_code == 404


def test_recommendation_javascript_to_react():
    # Primary user requirement test case
    payload = {
        "query": "I know basic JavaScript and want to become a React developer in 3 months.",
        "current_level": "auto",
        "target_timeframe": "3 months"
    }
    response = client.post("/api/ai/recommend", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["query_id"].startswith("ls-query-")

    profile = data["learner_profile"]
    assert "React" in profile["target_role"]
    assert profile["current_level"] in ["Intermediate", "Beginner"]
    assert "3 months" in profile["timeframe"]

    rec_titles = [c["title"] for c in data["recommended_courses"]]
    # Should include Modern JavaScript bridge and React
    assert any("JavaScript" in t for t in rec_titles)
    assert any("React" in t for t in rec_titles)

    # Learning sequence should have phases
    seq = data["learning_sequence"]
    assert len(seq) >= 2
    assert seq[0]["phase_number"] == 1
    assert "JavaScript" in seq[0]["course_title"]
    assert "React" in seq[1]["course_title"]

    assert len(data["immediate_next_step"]) > 20
    assert len(data["why_recommended"]) > 20


def test_recommendation_beginner_machine_learning():
    payload = {
        "query": "I am a complete beginner and want to learn Machine Learning in 4 months."
    }
    response = client.post("/api/ai/recommend", json=payload)
    assert response.status_code == 200
    data = response.json()
    rec_titles = [c["title"] for c in data["recommended_courses"]]
    # Should recommend Python first as prerequisite, then ML
    assert any("Python" in t for t in rec_titles)
    assert any("Machine Learning" in t for t in rec_titles)


def test_empty_query_returns_400():
    response = client.post("/api/ai/recommend", json={"query": "  "})
    assert response.status_code in [400, 422]


def test_followup_chat():
    payload = {
        "message": "What portfolio project should I build after finishing the React course?",
        "session_id": "test-session-123"
    }
    response = client.post("/api/ai/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "test-session-123"
    assert len(data["reply"]) > 10
    assert len(data["suggested_prompts"]) > 0


def test_catalog_stats():
    response = client.get("/api/ai/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_courses"] == 8
    assert data["total_curriculum_hours"] > 200
    assert data["total_learning_modules"] >= 30
