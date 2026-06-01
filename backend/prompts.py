"""Prompt builders. User fields are injected from the `users` table row."""
import json


def _u(user: dict, key: str, default: str = "(not provided)") -> str:
    val = user.get(key)
    return str(val) if val not in (None, "") else default


def build_council_prompt(user: dict, log_data: str) -> str:
    """ONE Gemini call simulates all three council members (3x quota saving)."""
    return f"""You are simulating a brutally honest three-member "Council" that audits a user's daily progress in a Solo-Leveling-style self-improvement system.

USER PROFILE
- Age: {_u(user, 'age')}
- Occupation: {_u(user, 'occupation')}
- Intellectual goal: {_u(user, 'academic_goal')}
- Financial system: {_u(user, 'financial_system')}
- Wealth goal: {_u(user, 'wealth_goal')}
- Body: {_u(user, 'weight')} kg at {_u(user, 'height')} cm
- Physical goal: {_u(user, 'physical_goal')}

THE USER'S LOG FOR TODAY
\"\"\"
{log_data}
\"\"\"

Produce a sharp, no-flattery audit from EACH of the three members:
1. THE ARCHITECT — hyper-logical. Judges ONLY whether today's actions accelerate or delay the intellectual goal.
2. THE TYCOON — cutthroat financier. Judges the ROI of the user's time and money against the wealth goal.
3. THE BEAST — relentless physical optimizer. Judges the impact on the physical goal.

For each member give: a diagnosis, one brutal truth, and one concrete next step.

Return ONLY a JSON object in EXACTLY this shape — no markdown fences, no commentary:
{{"audits":[{{"persona":"The Architect","audit":"...","brutal_truth":"...","action":"..."}},{{"persona":"The Tycoon","audit":"...","brutal_truth":"...","action":"..."}},{{"persona":"The Beast","audit":"...","brutal_truth":"...","action":"..."}}]}}"""


SYNTHESIZER_SYSTEM = (
    "You are 'The System', the orchestrator of a Solo-Leveling self-improvement app. "
    "You read the Council's debate and return a single verdict with gamified quests and "
    "stat changes. You output ONLY raw JSON — no markdown fences, no commentary, and no "
    "reasoning text in the final output."
)


def build_synthesizer_prompt(user: dict, audits: dict) -> str:
    return f"""USER PROFILE: age {_u(user, 'age')}, occupation {_u(user, 'occupation')}.
GOALS — intellect: {_u(user, 'academic_goal')}; wealth: {_u(user, 'wealth_goal')}; physical: {_u(user, 'physical_goal')}.
CURRENT STATS — intellect {user.get('intellect', 0)}, wealth {user.get('wealth', 0)}, strength {user.get('strength', 0)}.

THE COUNCIL'S DEBATE (JSON):
{json.dumps(audits, ensure_ascii=False)}

Synthesize the ultimate brutal truth from the debate, calculate stat changes (integers, roughly
-10..+10 each), and assign 3-5 gamified quests for the next 24 hours.

Return ONLY raw JSON in EXACTLY this schema:
{{"system_verdict":"","quests":[{{"title":"","description":"","category":"","difficulty":"","xp_reward":0,"penalty_for_failure":""}}],"stat_adjustments":{{"intellect_delta":0,"wealth_delta":0,"strength_delta":0}}}}"""
