from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class GoalRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=1500, description="Natural language description of learning goal and background")
    current_level: Optional[str] = Field("auto", description="Learner level: beginner, intermediate, advanced, or auto")
    target_timeframe: Optional[str] = Field(None, description="Desired completion timeframe, e.g. '3 months', '6 weeks'")
    target_role: Optional[str] = Field(None, description="Target career role, e.g. 'React Developer', 'Full Stack Engineer'")
    weekly_hours: Optional[int] = Field(None, ge=1, le=80, description="Available study hours per week")
    user_id: Optional[str] = Field(None, description="Optional user ID for tracking")


class ParsedProfile(BaseModel):
    current_level: str
    target_role: str
    timeframe: str
    weekly_commitment_hours: int
    primary_skills_needed: List[str]
    prerequisites_to_bridge: List[str]


class RecommendedCourse(BaseModel):
    id: str
    title: str
    topic: str
    slug: str
    difficulty: str
    estimated_duration: str
    total_hours: int
    resource_types: List[str]
    relevance_score: float
    why_relevant: str
    topics_covered: List[str]
    learning_sequence: List[Dict[str, Any]]
    key_skills_acquired: List[str]
    capstone_project: Dict[str, Any]


class LearningPhase(BaseModel):
    phase_number: int
    phase_title: str
    course_id: str
    course_title: str
    duration_weeks: float
    weekly_focus: str
    milestone_goal: str
    actionable_project: str


class KeyTakeaway(BaseModel):
    title: str
    description: str
    icon: str = "fa-check"


class NextStepDetails(BaseModel):
    course_title: str
    module_title: str
    action_item: str
    hands_on_project: str
    estimated_time: str


class DAGNode(BaseModel):
    id: str
    title: str
    level: int  # Topological rank / depth level in DAG (0, 1, 2, 3...)
    phase: int
    category: str  # Foundation, Core, Advanced, Framework, Capstone
    estimated_hours: int
    duration_label: str
    course_id: str
    course_title: str
    prerequisites: List[str] = []
    key_topics: List[str] = []
    hands_on_project: Optional[str] = None
    status: str = "pending"  # unlocked, in_progress, pending


class DAGEdge(BaseModel):
    from_node: str
    to_node: str
    label: str = "unlocks"


class DAGGraph(BaseModel):
    nodes: List[DAGNode] = []
    edges: List[DAGEdge] = []


class RecommendationResponse(BaseModel):
    success: bool = True
    query_id: str
    learner_profile: ParsedProfile
    summary: str
    why_recommended: str
    why_recommended_points: List[KeyTakeaway] = []
    immediate_next_step: str
    next_step_details: Optional[NextStepDetails] = None
    learning_sequence: List[LearningPhase]
    dag_graph: DAGGraph = DAGGraph()
    recommended_courses: List[RecommendedCourse]
    alternative_paths: List[str] = []
    created_at: str


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=2000)
    context_query_id: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    suggested_prompts: List[str] = []
