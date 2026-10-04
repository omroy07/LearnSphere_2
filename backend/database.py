import json
import os
import sqlite3
import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_DIR = Path(__file__).resolve().parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "learnsphere_assistant.db"
SEED_FILE = Path(__file__).resolve().parent / "seed_data.json"


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS learning_content (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        topic TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        difficulty TEXT NOT NULL,
        description TEXT NOT NULL,
        prerequisites TEXT NOT NULL,
        estimated_duration TEXT NOT NULL,
        total_hours INTEGER NOT NULL,
        resource_types TEXT NOT NULL,
        target_roles TEXT NOT NULL,
        topics_covered TEXT NOT NULL,
        learning_sequence TEXT NOT NULL,
        key_skills_acquired TEXT NOT NULL,
        capstone_project TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS ix_learning_content_topic ON learning_content(topic);
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS ix_learning_content_difficulty ON learning_content(difficulty);
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_queries (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        query_text TEXT NOT NULL,
        parsed_current_level TEXT,
        parsed_target_role TEXT,
        parsed_timeframe TEXT,
        recommended_courses TEXT NOT NULL,
        learning_sequence TEXT NOT NULL,
        why_relevant TEXT NOT NULL,
        immediate_next_step TEXT NOT NULL,
        summary TEXT,
        created_at TEXT NOT NULL
    );
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS ix_user_queries_created_at ON user_queries(created_at DESC);
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_interactions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        message TEXT NOT NULL,
        context_query_id TEXT,
        created_at TEXT NOT NULL
    );
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS ix_chat_session ON chat_interactions(session_id);
    """)

    conn.commit()
    conn.close()

    # Seed content if table is empty or update if updated
    seed_database_if_needed()


def seed_database_if_needed(force: bool = False):
    if not SEED_FILE.exists():
        return

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM learning_content")
    count = cursor.fetchone()[0]

    if count > 0 and not force:
        conn.close()
        return

    with open(SEED_FILE, "r", encoding="utf-8") as f:
        courses = json.load(f)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    for c in courses:
        cursor.execute("""
        INSERT INTO learning_content (
            id, title, topic, slug, difficulty, description, prerequisites,
            estimated_duration, total_hours, resource_types, target_roles,
            topics_covered, learning_sequence, key_skills_acquired,
            capstone_project, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            topic=excluded.topic,
            slug=excluded.slug,
            difficulty=excluded.difficulty,
            description=excluded.description,
            prerequisites=excluded.prerequisites,
            estimated_duration=excluded.estimated_duration,
            total_hours=excluded.total_hours,
            resource_types=excluded.resource_types,
            target_roles=excluded.target_roles,
            topics_covered=excluded.topics_covered,
            learning_sequence=excluded.learning_sequence,
            key_skills_acquired=excluded.key_skills_acquired,
            capstone_project=excluded.capstone_project
        """, (
            c["id"],
            c["title"],
            c["topic"],
            c["slug"],
            c["difficulty"],
            c["description"],
            json.dumps(c.get("prerequisites", [])),
            c["estimated_duration"],
            c.get("total_hours", 0),
            json.dumps(c.get("resource_types", [])),
            json.dumps(c.get("target_roles", [])),
            json.dumps(c.get("topics_covered", [])),
            json.dumps(c.get("learning_sequence", [])),
            json.dumps(c.get("key_skills_acquired", [])),
            json.dumps(c.get("capstone_project", {})),
            now
        ))

    conn.commit()
    conn.close()


def get_all_courses(topic: Optional[str] = None, difficulty: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM learning_content WHERE 1=1"
    params = []

    if topic and topic.lower() != "all":
        query += " AND LOWER(topic) = LOWER(?)"
        params.append(topic)
    if difficulty and difficulty.lower() != "all":
        query += " AND LOWER(difficulty) = LOWER(?)"
        params.append(difficulty)

    query += " ORDER BY total_hours ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "title": r["title"],
            "topic": r["topic"],
            "slug": r["slug"],
            "difficulty": r["difficulty"],
            "description": r["description"],
            "prerequisites": json.loads(r["prerequisites"]),
            "estimated_duration": r["estimated_duration"],
            "total_hours": r["total_hours"],
            "resource_types": json.loads(r["resource_types"]),
            "target_roles": json.loads(r["target_roles"]),
            "topics_covered": json.loads(r["topics_covered"]),
            "learning_sequence": json.loads(r["learning_sequence"]),
            "key_skills_acquired": json.loads(r["key_skills_acquired"]),
            "capstone_project": json.loads(r["capstone_project"]),
            "created_at": r["created_at"],
        })
    return results


def get_course_by_id(course_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM learning_content WHERE id = ? OR slug = ?", (course_id, course_id))
    r = cursor.fetchone()
    conn.close()

    if not r:
        return None

    return {
        "id": r["id"],
        "title": r["title"],
        "topic": r["topic"],
        "slug": r["slug"],
        "difficulty": r["difficulty"],
        "description": r["description"],
        "prerequisites": json.loads(r["prerequisites"]),
        "estimated_duration": r["estimated_duration"],
        "total_hours": r["total_hours"],
        "resource_types": json.loads(r["resource_types"]),
        "target_roles": json.loads(r["target_roles"]),
        "topics_covered": json.loads(r["topics_covered"]),
        "learning_sequence": json.loads(r["learning_sequence"]),
        "key_skills_acquired": json.loads(r["key_skills_acquired"]),
        "capstone_project": json.loads(r["capstone_project"]),
        "created_at": r["created_at"],
    }


def save_user_query(
    query_id: str,
    query_text: str,
    parsed_current_level: str,
    parsed_target_role: str,
    parsed_timeframe: str,
    recommended_courses: List[Any],
    learning_sequence: List[Any],
    why_relevant: str,
    immediate_next_step: str,
    summary: str = "",
    user_id: Optional[str] = None
):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    cursor.execute("""
    INSERT INTO user_queries (
        id, user_id, query_text, parsed_current_level, parsed_target_role,
        parsed_timeframe, recommended_courses, learning_sequence, why_relevant,
        immediate_next_step, summary, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        query_id,
        user_id,
        query_text,
        parsed_current_level,
        parsed_target_role,
        parsed_timeframe,
        json.dumps(recommended_courses),
        json.dumps(learning_sequence),
        why_relevant,
        immediate_next_step,
        summary,
        now
    ))
    conn.commit()
    conn.close()


def get_recent_queries(limit: int = 10) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM user_queries ORDER BY created_at DESC LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "user_id": r["user_id"],
            "query_text": r["query_text"],
            "parsed_current_level": r["parsed_current_level"],
            "parsed_target_role": r["parsed_target_role"],
            "parsed_timeframe": r["parsed_timeframe"],
            "recommended_courses": json.loads(r["recommended_courses"]),
            "learning_sequence": json.loads(r["learning_sequence"]),
            "why_relevant": r["why_relevant"],
            "immediate_next_step": r["immediate_next_step"],
            "summary": r["summary"],
            "created_at": r["created_at"],
        })
    return results


def save_chat_message(session_id: str, role: str, message: str, message_id: str, context_query_id: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    cursor.execute("""
    INSERT INTO chat_interactions (id, session_id, role, message, context_query_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (message_id, session_id, role, message, context_query_id, now))
    conn.commit()
    conn.close()


def get_chat_history(session_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT role, message, created_at FROM chat_interactions
    WHERE session_id = ?
    ORDER BY created_at ASC
    LIMIT ?
    """, (session_id, limit))
    rows = cursor.fetchall()
    conn.close()

    return [{"role": r["role"], "message": r["message"], "created_at": r["created_at"]} for r in rows]
