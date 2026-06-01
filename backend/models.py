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


# ── Synthesizer output (DeepSeek R1) — the strict UI contract ──
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
