import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

from dotenv import load_dotenv

from backend.database import (
    get_all_courses,
    get_course_by_id,
    save_user_query,
    save_chat_message,
    get_chat_history,
)
from backend.models import (
    GoalRequest,
    RecommendationResponse,
    ParsedProfile,
    RecommendedCourse,
    LearningPhase,
    ChatRequest,
    ChatResponse,
    DAGNode,
    DAGEdge,
    DAGGraph,
    KeyTakeaway,
    NextStepDetails,
)

load_dotenv()

# Check for Gemini API key
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
gemini_client = None

if GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
    try:
        from google import genai
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print(f"[AI ENGINE] Successfully initialized Google Gemini Client with model {GEMINI_MODEL}")
    except Exception as e:
        print(f"[AI ENGINE] Could not initialize Google GenAI: {e}. Using deterministic semantic engine.")


# --- Semantic Similarity / TF-IDF Vectorizer helper ---
def compute_semantic_relevance(query: str, courses: List[Dict[str, Any]]) -> List[Tuple[Dict[str, Any], float]]:
    """
    Computes semantic similarity scores between the user query and the course catalog
    using TF-IDF term-frequency and keyword domain matching.
    """
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity

        # Build document corpus for each course
        docs = []
        for c in courses:
            doc = (
                f"{c['title']} {c['topic']} {c['difficulty']} "
                f"{c['description']} {' '.join(c.get('topics_covered', []))} "
                f"{' '.join(c.get('target_roles', []))} {' '.join(c.get('key_skills_acquired', []))}"
            )
            docs.append(doc)

        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        tfidf_matrix = vectorizer.fit_transform(docs)
        query_vec = vectorizer.transform([query])
        sim_scores = cosine_similarity(query_vec, tfidf_matrix)[0]

        scored = []
        for idx, course in enumerate(courses):
            base_score = float(sim_scores[idx])

            # Heuristic domain boosts
            query_lower = query.lower()
            topic_lower = course["topic"].lower()
            title_lower = course["title"].lower()

            bonus = 0.0
            # Java vs JavaScript boundary check
            clean_query = query_lower.replace("javascript", " ") if "javascript" in query_lower else query_lower
            if course["id"] == "course-java-springboot":
                if re.search(r"\bjava\b", clean_query):
                    bonus += 0.40
            else:
                if re.search(rf"\b{re.escape(topic_lower)}\b", query_lower):
                    bonus += 0.40

            if any(term in query_lower for term in [course["slug"]]):
                bonus += 0.25

            # Role matching bonus
            for role in course.get("target_roles", []):
                if re.search(rf"\b{re.escape(role.lower())}\b", query_lower):
                    bonus += 0.35

            final_score = min(0.99, base_score + bonus)
            scored.append((course, final_score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored
    except Exception as e:
        print(f"[AI ENGINE] Fallback in TF-IDF calculation: {e}")
        # Fallback keyword scoring
        query_tokens = set(re.findall(r"\w+", query.lower()))
        scored = []
        for c in courses:
            text = f"{c['title']} {c['topic']} {c['description']} {' '.join(c.get('topics_covered', []))}".lower()
            words = set(re.findall(r"\w+", text))
            common = len(query_tokens.intersection(words))
            score = common / max(1, len(query_tokens))
            scored.append((c, score))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored


def parse_learner_profile(query: str, explicit_level: Optional[str] = None, explicit_timeframe: Optional[str] = None) -> ParsedProfile:
    """
    Extracts current level, target role, timeframe, and weekly study hours from natural language query.
    """
    q = query.lower()

    # Determine Current Level
    detected_level = "Beginner"
    if explicit_level and explicit_level.lower() != "auto":
        detected_level = explicit_level.capitalize()
    else:
        if any(term in q for term in ["advanced", "experienced", "production", "senior", "lead developer"]):
            detected_level = "Advanced"
        elif any(term in q for term in ["intermediate", "know basic", "knows basic", "some experience", "have built", "familiar with", "worked with"]):
            detected_level = "Intermediate"
        elif any(term in q for term in ["beginner", "starting out", "scratch", "new to", "no experience", "zero"]):
            detected_level = "Beginner"

    # Determine Target Role / Ambition
    target_role = "Software Developer"
    if any(k in q for k in ["react developer", "frontend developer", "frontend engineer", "front end", "react"]):
        target_role = "React Frontend Developer"
    elif any(k in q for k in ["full stack", "fullstack", "mern", "web developer"]):
        target_role = "Full Stack Web Developer"
    elif any(k in q for k in ["node", "backend", "api developer", "backend engineer"]):
        target_role = "Backend Node.js Engineer"
    elif any(k in q for k in ["machine learning", "ml engineer", "data scientist", "ai engineer"]):
        target_role = "Machine Learning Engineer"
    elif any(k in q for k in ["python developer", "data analyst", "python"]):
        target_role = "Python Software Engineer"
    elif re.search(r"\bjava\b", q.replace("javascript", " ")):
        target_role = "Java Enterprise Backend Engineer"
    elif any(k in q for k in ["sql", "database administrator", "dba", "data engineer"]):
        target_role = "Database & SQL Specialist"

    # Determine Timeframe
    timeframe = explicit_timeframe if explicit_timeframe else "3 months"
    match = re.search(r"(\d+)\s*(months?|weeks?|years?|days?)", q)
    if match:
        timeframe = f"{match.group(1)} {match.group(2)}"

    # Determine Weekly hours
    weekly_hours = 6
    hour_match = re.search(r"(\d+)\s*(hours|hrs|hr)\s*(per|\/|a)?\s*week", q)
    if hour_match:
        weekly_hours = int(hour_match.group(1))

    # Identify primary skills needed
    skills = []
    if "react" in q or "frontend" in target_role.lower():
        skills.extend(["Modern JavaScript ES6+", "React Hooks", "State Management", "Component Composition", "REST API Integration"])
    if "node" in q or "backend" in target_role.lower():
        skills.extend(["Node.js Runtime", "Express APIs", "JWT Authentication", "Database Architecture"])
    if "python" in q:
        skills.extend(["Python OOP", "Data Structures", "Scripting", "Packaging"])
    if "machine learning" in q or "data scientist" in target_role.lower():
        skills.extend(["NumPy & Pandas", "Scikit-Learn", "Model Training", "Model Evaluation", "FastAPI Serving"])
    if re.search(r"\bjava\b", q.replace("javascript", " ")):
        skills.extend(["Core Java & JVM", "OOP Principles", "Java Collections", "Spring Boot 3 REST"])
    if "sql" in q or "database" in q:
        skills.extend(["Relational Schema Design", "Complex Joins", "Aggregations & Window Functions", "Query Optimization"])

    if not skills:
        skills = ["Foundational Syntax", "Data Structures", "Building Applied Projects", "Version Control"]

    # Prerequisites to bridge
    bridges = []
    if "react" in q and ("basic javascript" in q or "beginner" in detected_level.lower()):
        bridges.append("Solidify Asynchronous JavaScript (Promises, async/await, Array methods) before React")
    if "machine learning" in q and "python" not in q:
        bridges.append("Ensure Python programming fundamentals are solid before mathematical modeling")
    if "full stack" in q:
        bridges.append("Review Frontend React and Backend Express independently before combining")

    return ParsedProfile(
        current_level=detected_level,
        target_role=target_role,
        timeframe=timeframe,
        weekly_commitment_hours=weekly_hours,
        primary_skills_needed=skills,
        prerequisites_to_bridge=bridges,
    )


def build_dag_graph(ordered_courses: List[Dict[str, Any]], profile: ParsedProfile) -> DAGGraph:
    """
    Constructs a Directed Acyclic Graph (DAG) representing the complete technical
    skill dependency tree across all recommended modules and courses.
    """
    nodes: List[DAGNode] = []
    edges: List[DAGEdge] = []

    level = 0
    prev_node_id = None

    for c_idx, course in enumerate(ordered_courses):
        phase_num = c_idx + 1
        modules = course.get("learning_sequence", [])
        total_mods = len(modules)

        for m_idx, mod in enumerate(modules):
            node_id = f"dag-{course['slug']}-m{m_idx+1}"

            # Categorize the node cleanly
            category = "Core Architecture"
            if level == 0 and (course.get("difficulty", "").lower() == "beginner" or m_idx == 0):
                category = "Foundational Gateway"
            elif m_idx == total_mods - 1:
                category = "Capstone Milestone"
            elif any(k in mod.get("title", "").lower() for k in ["spring", "react", "express", "fastapi"]):
                category = "Enterprise Framework"
            elif any(k in mod.get("title", "").lower() for k in ["stream", "jpa", "auth", "advanced", "tuning", "window"]):
                category = "Advanced Pattern"

            # Parse hours from duration string (e.g., "1 week (6 hours)" -> 6)
            hours = 6
            h_match = re.search(r"(\d+)\s*(hours|hrs)", mod.get("duration", ""))
            if h_match:
                hours = int(h_match.group(1))

            status = "in_progress" if level == 0 else "pending"
            prereqs = [prev_node_id] if prev_node_id else []

            node = DAGNode(
                id=node_id,
                title=mod.get("title", f"Module {m_idx+1}"),
                level=level,
                phase=phase_num,
                category=category,
                estimated_hours=hours,
                duration_label=mod.get("duration", "1 week"),
                course_id=course["id"],
                course_title=course["title"],
                prerequisites=prereqs,
                key_topics=mod.get("topics", []),
                hands_on_project=mod.get("hands_on_project"),
                status=status
            )
            nodes.append(node)

            if prev_node_id:
                edges.append(DAGEdge(
                    from_node=prev_node_id,
                    to_node=node_id,
                    label="unlocks"
                ))

            prev_node_id = node_id
            level += 1

    return DAGGraph(nodes=nodes, edges=edges)


def build_why_recommended_points(ordered_courses: List[Dict[str, Any]], profile: ParsedProfile) -> List[KeyTakeaway]:
    points = []
    
    # 1. Target Role Fit
    points.append(KeyTakeaway(
        title="Target Role Alignment",
        description=f"Curated specifically for becoming a {profile.target_role}. Bridges your current level ({profile.current_level}) directly to production enterprise competence without unrelated topics.",
        icon="fa-bullseye"
    ))
    
    # 2. Pacing & Feasibility
    total_hours = sum(c.get("total_hours", 0) for c in ordered_courses)
    weeks = max(2, round(total_hours / max(4, profile.weekly_commitment_hours)))
    points.append(KeyTakeaway(
        title="Pacing & Schedule Feasibility",
        description=f"At your committed pace of ~{profile.weekly_commitment_hours} hrs/week, you will complete {total_hours} total curriculum hours across ~{weeks} weeks, fitting your {profile.timeframe} target.",
        icon="fa-clock"
    ))
    
    # 3. Prerequisite Bridge
    first_c = ordered_courses[0]
    points.append(KeyTakeaway(
        title="Grounded Prerequisite Bridge",
        description=f"Solidifies foundational syntax and design patterns in '{first_c['title']}' before introducing framework complexity, avoiding common junior knowledge gaps.",
        icon="fa-bridge"
    ))
    
    # 4. Capstone Portfolio Impact
    last_c = ordered_courses[-1]
    capstone_name = last_c.get("capstone_project", {}).get("title", "Production Microservice")
    points.append(KeyTakeaway(
        title="Verifiable Portfolio Artifact",
        description=f"Culminates with delivering '{capstone_name}', a resume-ready project featuring persistence, testing, and clean code that recruiters look for in technical interviews.",
        icon="fa-trophy"
    ))
    
    return points


def build_next_step_details(first_course: Dict[str, Any], profile: ParsedProfile) -> NextStepDetails:
    first_module = first_course.get("learning_sequence", [{}])[0]
    return NextStepDetails(
        course_title=first_course["title"],
        module_title=first_module.get("title", "Module 1"),
        action_item=first_module.get("summary", "Master the foundational environment and code syntax"),
        hands_on_project=first_module.get("hands_on_project", "Build initial interactive practice exercise"),
        estimated_time=first_module.get("duration", "Week 1 (6 hours)")
    )


def generate_heuristic_recommendation(
    goal_req: GoalRequest,
    courses: List[Dict[str, Any]],
    scored_courses: List[Tuple[Dict[str, Any], float]],
    profile: ParsedProfile,
) -> RecommendationResponse:
    """
    Deterministic rule-based & semantic engine that selects courses,
    orders them by dependency sequence, and generates tailored guidance.
    """
    query_id = f"ls-query-{uuid.uuid4().hex[:8]}"
    query_lower = goal_req.query.lower()

    # Filter top relevant courses (threshold score > 0.08 or top 3)
    relevant_scored = [sc for sc in scored_courses if sc[1] > 0.08]
    if not relevant_scored:
        relevant_scored = scored_courses[:3]

    selected_courses_map = {}
    for c, score in relevant_scored[:4]:
        selected_courses_map[c["id"]] = (c, score)

    # Prerequisite chaining logic:
    # 1. If React is selected and user knows only "basic javascript" or is beginner:
    if "course-react-engineering" in selected_courses_map:
        if ("basic" in query_lower or "beginner" in profile.current_level.lower()) and "course-js-core" not in selected_courses_map:
            js_course = get_course_by_id("course-js-core")
            if js_course:
                selected_courses_map["course-js-core"] = (js_course, 0.85)

    # 2. If Machine Learning is selected and user is beginner or hasn't mastered Python:
    if "course-ml-foundations" in selected_courses_map:
        if "course-python-mastery" not in selected_courses_map:
            py_course = get_course_by_id("course-python-mastery")
            if py_course:
                selected_courses_map["course-python-mastery"] = (py_course, 0.88)

    # 3. If Full-stack is requested, ensure backend and frontend courses are present
    if "fullstack" in query_lower or "full stack" in query_lower:
        for cid in ["course-react-engineering", "course-nodejs-backend", "course-sql-database"]:
            if cid not in selected_courses_map:
                c = get_course_by_id(cid)
                if c:
                    selected_courses_map[cid] = (c, 0.75)

    # Order courses logically:
    # Order hierarchy: Beginner foundations -> Intermediate core -> Specialized -> Capstone
    difficulty_order = {"Beginner": 1, "Intermediate": 2, "Advanced": 3}
    topic_prereq_order = {
        "JavaScript": 1,
        "Python": 1,
        "SQL": 2,
        "React": 3,
        "Node.js": 3,
        "Java": 3,
        "Machine Learning": 4,
        "Full Stack Web Development": 5,
    }

    ordered_courses_tuples = list(selected_courses_map.values())
    ordered_courses_tuples.sort(
        key=lambda item: (
            difficulty_order.get(item[0]["difficulty"], 2),
            topic_prereq_order.get(item[0]["topic"], 3),
        )
    )

    ordered_raw_courses = [item[0] for item in ordered_courses_tuples]

    # Build RecommendedCourse models
    rec_models = []
    for c, score in ordered_courses_tuples:
        # Generate custom why_relevant
        why_rel = f"Directly aligns with your target of becoming a {profile.target_role}."
        if c["topic"] == "JavaScript" and "react" in query_lower:
            why_rel = "Bridges your basic JavaScript understanding to modern ES6+ patterns, closures, and async/await needed to write idiomatic React."
        elif c["topic"] == "React":
            why_rel = "Provides the core component, hooks, and routing architecture required for modern frontend engineering."
        elif c["topic"] == "Python" and "machine learning" in query_lower:
            why_rel = "Establishes data structure, algorithm, and scripting competence required before tackling ML algorithms."
        elif c["topic"] == "Node.js":
            why_rel = "Teaches server-side REST architecture and authentication to make your applications full-stack."
        elif c["topic"] == "SQL":
            why_rel = "Essential for designing normalized databases, writing analytical queries, and connecting data backends."
        elif c["topic"] == "Machine Learning":
            why_rel = "Guides you through hands-on Scikit-Learn pipelines, feature engineering, and model deployment."
        elif c["topic"] == "Java":
            why_rel = "Covers core object-oriented principles, JVM memory architecture, and Spring Boot 3 microservice persistence."

        rec_models.append(
            RecommendedCourse(
                id=c["id"],
                title=c["title"],
                topic=c["topic"],
                slug=c["slug"],
                difficulty=c["difficulty"],
                estimated_duration=c["estimated_duration"],
                total_hours=c["total_hours"],
                resource_types=c.get("resource_types", []),
                relevance_score=round(score, 2),
                why_relevant=why_rel,
                topics_covered=c.get("topics_covered", []),
                learning_sequence=c.get("learning_sequence", []),
                key_skills_acquired=c.get("key_skills_acquired", []),
                capstone_project=c.get("capstone_project", {}),
            )
        )

    # Generate Learning Sequence Phases
    learning_sequence = []
    total_weeks = 0.0

    for idx, c in enumerate(ordered_raw_courses):
        phase_num = idx + 1
        est_weeks = max(2.0, round(c["total_hours"] / max(4, profile.weekly_commitment_hours), 1))
        total_weeks += est_weeks

        phase_title = f"Phase {phase_num}: Master {c['title']}"
        weekly_focus = f"Dedicate ~{profile.weekly_commitment_hours} hours/week exploring {c['topic']} concepts and coding exercises."
        milestone_goal = f"Complete all modules and successfully deliver the capstone project: {c['capstone_project'].get('title', 'Course Project')}."
        actionable_project = c["capstone_project"].get("title", f"{c['topic']} Applied Project")

        learning_sequence.append(
            LearningPhase(
                phase_number=phase_num,
                phase_title=phase_title,
                course_id=c["id"],
                course_title=c["title"],
                duration_weeks=est_weeks,
                weekly_focus=weekly_focus,
                milestone_goal=milestone_goal,
                actionable_project=actionable_project,
            )
        )

    # Formulate customized concise summary (no giant monolithic paragraphs!)
    summary = (
        f"Customized milestone path to advance from **{profile.current_level}** to a proficient **{profile.target_role}** "
        f"within **{profile.timeframe}**. Structured into progressive phases at ~**{profile.weekly_commitment_hours} hours/week** "
        f"balancing foundational logic with hands-on capstone engineering."
    )

    why_recommended = (
        f"This sequence systematically prevents knowledge gaps by building solid architecture before high-level frameworks. "
        f"Every phase delivers an interactive milestone project to prove competency."
    )

    # Structured points & next step details
    why_points = build_why_recommended_points(ordered_raw_courses, profile)
    next_step_details = build_next_step_details(ordered_raw_courses[0], profile)

    # Immediate next step string
    first_course = ordered_raw_courses[0]
    first_module = first_course.get("learning_sequence", [{}])[0]
    immediate_next_step = (
        f"Begin today with **{first_course['title']}** — Start with **{first_module.get('title', 'Module 1')}**: "
        f"{first_module.get('summary', 'Review core syntax and foundational logic')}. "
        f"Hands-on goal for this week: *{first_module.get('hands_on_project', 'Complete initial practice exercise')}*."
    )

    # Build the full DAG dependency graph!
    dag_graph = build_dag_graph(ordered_raw_courses, profile)

    alternatives = [
        "Increase study time to 12-15 hours/week to complete the roadmap in half the time.",
        "Add an interactive Git & GitHub version control module to your workflow for portfolio sharing.",
        "Team up with a peer in the LearnSphere Community channel for weekly code reviews."
    ]

    now_iso = datetime.now(timezone.utc).isoformat()

    # Save to database
    save_user_query(
        query_id=query_id,
        query_text=goal_req.query,
        parsed_current_level=profile.current_level,
        parsed_target_role=profile.target_role,
        parsed_timeframe=profile.timeframe,
        recommended_courses=[rc.model_dump() for rc in rec_models],
        learning_sequence=[lp.model_dump() for lp in learning_sequence],
        why_relevant=why_recommended,
        immediate_next_step=immediate_next_step,
        summary=summary,
        user_id=goal_req.user_id,
    )

    return RecommendationResponse(
        success=True,
        query_id=query_id,
        learner_profile=profile,
        summary=summary,
        why_recommended=why_recommended,
        why_recommended_points=why_points,
        immediate_next_step=immediate_next_step,
        next_step_details=next_step_details,
        learning_sequence=learning_sequence,
        dag_graph=dag_graph,
        recommended_courses=rec_models,
        alternative_paths=alternatives,
        created_at=now_iso,
    )


def generate_gemini_recommendation(
    goal_req: GoalRequest,
    courses: List[Dict[str, Any]],
    scored_courses: List[Tuple[Dict[str, Any], float]],
    profile: ParsedProfile,
) -> Optional[RecommendationResponse]:
    """
    Uses Gemini LLM to synthesize rich, grounded natural language reasoning
    based on the retrieved LearnSphere catalog.
    """
    if not gemini_client:
        return None

    # Retrieve candidate courses
    candidate_courses = [item[0] for item in scored_courses[:5]]
    catalog_summary = []
    for c in candidate_courses:
        catalog_summary.append({
            "id": c["id"],
            "title": c["title"],
            "topic": c["topic"],
            "difficulty": c["difficulty"],
            "description": c["description"],
            "prerequisites": c["prerequisites"],
            "estimated_duration": c["estimated_duration"],
            "total_hours": c["total_hours"],
            "topics_covered": c["topics_covered"],
            "capstone_project": c["capstone_project"],
        })

    prompt = f"""You are the official AI Learning Assistant for LearnSphere.
A learner has described their learning goal and background:
"{goal_req.query}"

Learner Profile Details:
- Detected Current Level: {profile.current_level}
- Target Ambition: {profile.target_role}
- Desired Timeframe: {profile.timeframe}
- Weekly Commitment: {profile.weekly_commitment_hours} hours/week

Below is the verified LearnSphere structured content catalog available:
{json.dumps(catalog_summary, indent=2)}

TASK:
1. Select the best 1 to 4 courses from the LearnSphere catalog that bridge the learner's current level to their goal.
2. Formulate a logical, sequential learning path with phases.
3. Keep text concise and actionable (NO long monolithic paragraphs).
4. Provide structured "why_recommended_points" with 3 to 4 distinct key takeaway cards (Target Alignment, Pacing Feasibility, Prerequisite Bridge, Portfolio Deliverable).
5. Provide structured "next_step_details" with course_title, module_title, action_item, hands_on_project, estimated_time.

You MUST respond strictly with valid JSON conforming to this exact structure:
{{
  "summary": "Concise 2-3 sentence overview of this milestone path",
  "why_recommended": "Brief 2-sentence overall rationale summary",
  "why_recommended_points": [
    {{
      "title": "Target Role Alignment",
      "description": "Short explanation of how this path maps to their ambition",
      "icon": "fa-bullseye"
    }},
    {{
      "title": "Pacing & Feasibility",
      "description": "Short explanation of weekly hours and timeline feasibility",
      "icon": "fa-clock"
    }},
    {{
      "title": "Prerequisite Bridge",
      "description": "Short explanation of foundational skills solidified first",
      "icon": "fa-bridge"
    }},
    {{
      "title": "Portfolio Deliverable",
      "description": "Short explanation of the capstone project built",
      "icon": "fa-trophy"
    }}
  ],
  "immediate_next_step": "Precise instruction of which course, module, and hands-on lab to start today",
  "next_step_details": {{
    "course_title": "Course Title",
    "module_title": "Module 1: ...",
    "action_item": "Specific action to do today",
    "hands_on_project": "Hands-on coding exercise for this week",
    "estimated_time": "Week 1 (6 hours)"
  }},
  "recommended_course_ids": ["course-java-springboot"],
  "learning_sequence": [
    {{
      "phase_number": 1,
      "phase_title": "Phase 1: ...",
      "course_id": "course-java-springboot",
      "course_title": "...",
      "duration_weeks": 4.0,
      "weekly_focus": "...",
      "milestone_goal": "...",
      "actionable_project": "..."
    }}
  ],
  "alternative_paths": [
    "Optional suggestion 1",
    "Optional suggestion 2"
  ]
}}
Only return the raw JSON object, no markdown code fence and no extra commentary.
"""

    try:
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        raw_text = (response.text or "").strip()
        # Remove markdown fence if present
        raw_text = re.sub(r"^```(json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)

        parsed = json.loads(raw_text)

        query_id = f"ls-query-{uuid.uuid4().hex[:8]}"

        rec_course_ids = parsed.get("recommended_course_ids", [])
        rec_models = []
        raw_courses = []
        for cid in rec_course_ids:
            c = get_course_by_id(cid)
            if c:
                raw_courses.append(c)
                rec_models.append(
                    RecommendedCourse(
                        id=c["id"],
                        title=c["title"],
                        topic=c["topic"],
                        slug=c["slug"],
                        difficulty=c["difficulty"],
                        estimated_duration=c["estimated_duration"],
                        total_hours=c["total_hours"],
                        resource_types=c.get("resource_types", []),
                        relevance_score=0.95,
                        why_relevant=f"Selected by AI as a core milestone for {profile.target_role}.",
                        topics_covered=c.get("topics_covered", []),
                        learning_sequence=c.get("learning_sequence", []),
                        key_skills_acquired=c.get("key_skills_acquired", []),
                        capstone_project=c.get("capstone_project", {}),
                    )
                )

        if not rec_models:
            # If Gemini returned invalid IDs, fallback to heuristic
            return None

        phases = []
        for p in parsed.get("learning_sequence", []):
            phases.append(LearningPhase(**p))

        # Build DAG Graph from verified courses
        dag_graph = build_dag_graph(raw_courses, profile)

        # Parse why_recommended_points
        why_points = []
        raw_points = parsed.get("why_recommended_points", [])
        if isinstance(raw_points, list) and len(raw_points) > 0:
            for pt in raw_points:
                try:
                    why_points.append(KeyTakeaway(
                        title=pt.get("title", "Key Takeaway"),
                        description=pt.get("description", ""),
                        icon=pt.get("icon", "fa-check")
                    ))
                except Exception:
                    pass
        if not why_points:
            why_points = build_why_recommended_points(raw_courses, profile)

        # Parse next_step_details
        raw_next = parsed.get("next_step_details", {})
        if isinstance(raw_next, dict) and "course_title" in raw_next:
            try:
                next_step_details = NextStepDetails(
                    course_title=raw_next.get("course_title", raw_courses[0]["title"]),
                    module_title=raw_next.get("module_title", "Module 1"),
                    action_item=raw_next.get("action_item", "Start initial foundational lab"),
                    hands_on_project=raw_next.get("hands_on_project", "Build starter exercise"),
                    estimated_time=raw_next.get("estimated_time", "Week 1 (6 hours)")
                )
            except Exception:
                next_step_details = build_next_step_details(raw_courses[0], profile)
        else:
            next_step_details = build_next_step_details(raw_courses[0], profile)

        now_iso = datetime.now(timezone.utc).isoformat()

        # Save to database
        save_user_query(
            query_id=query_id,
            query_text=goal_req.query,
            parsed_current_level=profile.current_level,
            parsed_target_role=profile.target_role,
            parsed_timeframe=profile.timeframe,
            recommended_courses=[rc.model_dump() for rc in rec_models],
            learning_sequence=[lp.model_dump() for lp in phases],
            why_relevant=parsed.get("why_recommended", ""),
            immediate_next_step=parsed.get("immediate_next_step", ""),
            summary=parsed.get("summary", ""),
            user_id=goal_req.user_id,
        )

        return RecommendationResponse(
            success=True,
            query_id=query_id,
            learner_profile=profile,
            summary=parsed.get("summary", ""),
            why_recommended=parsed.get("why_recommended", ""),
            why_recommended_points=why_points,
            immediate_next_step=parsed.get("immediate_next_step", ""),
            next_step_details=next_step_details,
            learning_sequence=phases,
            dag_graph=dag_graph,
            recommended_courses=rec_models,
            alternative_paths=parsed.get("alternative_paths", []),
            created_at=now_iso,
        )
    except Exception as e:
        print(f"[AI ENGINE] Gemini generation error: {e}. Falling back to deterministic engine.")
        return None


def get_personalized_recommendation(goal_req: GoalRequest) -> RecommendationResponse:
    """
    Main entry point for generating personalized recommendations:
    1. Loads structured courses from SQLite.
    2. Computes semantic relevance vector scores.
    3. Parses learner profile.
    4. Tries Gemini LLM with grounded catalog; falls back to deterministic heuristic engine.
    """
    courses = get_all_courses()
    scored_courses = compute_semantic_relevance(goal_req.query, courses)
    profile = parse_learner_profile(goal_req.query, goal_req.current_level, goal_req.target_timeframe)

    # Attempt Gemini generation if client is configured
    if gemini_client:
        llm_response = generate_gemini_recommendation(goal_req, courses, scored_courses, profile)
        if llm_response:
            return llm_response

    # Fallback to rule-based & semantic progression engine
    return generate_heuristic_recommendation(goal_req, courses, scored_courses, profile)


def handle_followup_chat(chat_req: ChatRequest) -> ChatResponse:
    """
    Handles conversational follow-up questions from the learner regarding their plan.
    """
    session_id = chat_req.session_id or f"sess-{uuid.uuid4().hex[:8]}"
    msg_id = f"msg-{uuid.uuid4().hex[:8]}"

    # Save user message
    save_chat_message(session_id, "user", chat_req.message, msg_id, chat_req.context_query_id)
    history = get_chat_history(session_id, limit=8)

    all_courses = get_all_courses()
    catalog_brief = ", ".join([f"{c['title']} ({c['topic']}, {c['difficulty']})" for c in all_courses])

    if gemini_client:
        try:
            history_prompt = "\n".join([f"{h['role'].upper()}: {h['message']}" for h in history])
            prompt = (
                f"You are the LearnSphere AI Learning Assistant.\n"
                f"Available LearnSphere Courses: {catalog_brief}\n\n"
                f"Conversation History:\n{history_prompt}\n\n"
                f"Respond to the learner's latest question with helpful, encouraging, and concrete advice grounded in LearnSphere's courses.\n"
                f"Be concise, practical, and clear."
            )
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            reply = (response.text or "").strip()
        except Exception as e:
            print(f"[AI ENGINE] Chat LLM error: {e}")
            reply = generate_heuristic_chat_reply(chat_req.message)
    else:
        reply = generate_heuristic_chat_reply(chat_req.message)

    # Save assistant message
    asst_msg_id = f"msg-{uuid.uuid4().hex[:8]}"
    save_chat_message(session_id, "assistant", reply, asst_msg_id, chat_req.context_query_id)

    suggested = [
        "How many hours per week should I dedicate to labs?",
        "What projects will best showcase my skills to employers?",
        "Can I skip straight to the intermediate course?"
    ]

    return ChatResponse(session_id=session_id, reply=reply, suggested_prompts=suggested)


def generate_heuristic_chat_reply(message: str) -> str:
    """
    Rule-based intelligent chat response when LLM is unavailable.
    """
    m = message.lower()
    if any(k in m for k in ["hours", "time", "pace", "schedule", "busy", "part-time"]):
        return (
            "If your schedule is tight, we recommend breaking your study time into 45-minute daily focus sessions "
            "rather than long weekend marathons. Dedicating 5–7 hours across 4–5 days yields significantly higher retention "
            "and allows your subconscious mind to absorb programming patterns between sessions."
        )
    elif any(k in m for k in ["skip", "prerequisite", "direct", "fast"]):
        return (
            "While you can jump directly into intermediate topics like React or Spring Boot, learners who brush up on core foundations "
            "(such as ES6+ closures, async/await, or Java Streams) solve debugging issues 3x faster. We recommend reviewing the first module's "
            "interactive quiz first—if you score 85%+, feel free to skip ahead!"
        )
    elif any(k in m for k in ["project", "portfolio", "resume", "job", "hire"]):
        return (
            "The capstone projects in each course are specifically designed for your portfolio! For example, the E-Commerce Storefront in React "
            "and the Loan Prediction API in Machine Learning demonstrate real-world architecture, error handling, and deployability that recruiters look for."
        )
    elif any(k in m for k in ["stuck", "error", "difficult", "hard", "help"]):
        return (
            "Getting stuck is a natural part of coding! Try breaking down the problem: log each intermediate variable, "
            "check MDN or official documentation, and re-read the module cheatsheet. You can also paste specific error messages here for guidance."
        )
    else:
        return (
            "Great question! LearnSphere's structured content provides step-by-step guidance, interactive labs, and practical capstone projects. "
            "Focus on completing each module's hands-on exercise before moving to the next. What specific topic or milestone would you like to explore next?"
        )
