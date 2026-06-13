"""Pydantic models — the contracts between LLMs, the API, and the mobile UI."""
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Council output (one combined Gemini call returns all three personas) ──
class PersonaAudit(BaseModel):
    persona: str
    audit: str
    brutal_truth: str
    action: str


class CouncilAudit(BaseModel):
    audits: List[PersonaAudit]


# ── Synthesizer output — the strict UI contract ──
class Quest(BaseModel):
    title: str
    description: str
    category: str
    difficulty: str
    xp_reward: int
    penalty_for_failure: str


class StatAdjustments(BaseModel):
    intellect_delta: int = 0
    wealth_delta: int = 0
    strength_delta: int = 0


class SystemVerdict(BaseModel):
    system_verdict: str
    quests: List[Quest]
    stat_adjustments: StatAdjustments
    memory_update: str = ""  # System's refreshed dossier on the Hunter (carried forward)


# ── Missions (System-generated daily + user-editable, System-polished) ──
class Mission(BaseModel):
    title: str
    description: str = ""
    category: str = "general"
    xp_reward: int = 50


class MissionList(BaseModel):
    missions: List[Mission]


class MissionPolish(BaseModel):
    title: str
    description: str
    rationale: str


# ── Workouts (System-designed, equipment-aware) ──────────────────────────────
class Exercise(BaseModel):
    name: str
    exercise_id: str = ""       # free-exercise-db id; picked by the LLM from the catalog
    sets: int = 0
    reps: str = ""       # "10-12", "to failure", or "" if duration-based
    duration: str = ""   # "30s", "5 min", or "" if rep-based
    target: str = ""     # muscle group / focus
    equipment: str = ""  # equipment used, or "bodyweight"
    notes: str = ""      # one short form cue
    images: List[str] = []  # demo photo frames, attached server-side from the catalog


class WorkoutPlan(BaseModel):
    title: str
    exercises: List[Exercise]


# ── Academy (book → System-designed study campaign) ──────────────────────────
class BookChapterPlan(BaseModel):
    ordinal: int = 1
    title: str
    objective: str = ""
    key_concepts: List[str] = []
    youtube_query: str = ""
    xp_reward: int = 40


class StudyPlan(BaseModel):
    chapters: List[BookChapterPlan]


class ChapterNotes(BaseModel):
    notes: str


class BookInput(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    author: str = Field(default="", max_length=200)
    level: str = Field(default="", max_length=120)  # e.g. "Class 11", "Undergraduate"


# ── Career Compass (interest + growth driven field guidance) ─────────────────
class CareerPath(BaseModel):
    field: str
    fit_reason: str = ""
    growth_outlook: str = ""
    demand: str = "Growing"
    key_skills: List[str] = []
    first_step: str = ""


class CareerList(BaseModel):
    paths: List[CareerPath]


# ── Resources (System-curated books / courses / tools per goal) ──────────────
class Resource(BaseModel):
    title: str
    author: str = ""
    type: str = "book"   # book | course | tool | channel | article
    category: str = "general"
    reason: str = ""


class ResourceList(BaseModel):
    resources: List[Resource]


# ── API request bodies ──
class LogSubmission(BaseModel):
    log_data: str = Field(min_length=1, max_length=10_000)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    occupation: Optional[str] = None
    academic_goal: Optional[str] = None
    financial_system: Optional[str] = None
    wealth_goal: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    physical_goal: Optional[str] = None
    equipment: Optional[str] = None
    interests: Optional[str] = None
    education_level: Optional[str] = None


class MissionInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: str = "general"


class ContentReport(BaseModel):
    kind: str = Field(default="verdict", max_length=40)
    content: str = Field(default="", max_length=4000)
