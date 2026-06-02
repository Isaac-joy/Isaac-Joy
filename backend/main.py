"""Solo Leveling Council — FastAPI backend.

Endpoints write to Supabase instantly (durable queue); the in-process worker
does the slow AI orchestration. The user id always comes from a verified JWT.
"""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth import get_current_user_id
from config import settings
from errors import AppError
from llm import (
    generate_missions,
    generate_resources,
    generate_workout,
    polish_mission,
)
from models import LogSubmission, MissionInput, ProfileUpdate
from supabase_client import db
from worker import council_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run several queue workers concurrently so simultaneous reports don't serialize.
    workers = [
        asyncio.create_task(council_worker()) for _ in range(settings.worker_concurrency)
    ]
    try:
        yield
    finally:
        for w in workers:
            w.cancel()
        await asyncio.gather(*workers, return_exceptions=True)
        await db.aclose()


app = FastAPI(title="Solo Leveling Council API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def _app_error_handler(request: Request, exc: AppError):
    # Typed DB/AI failures → clean JSON the app can show verbatim.
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/")
async def health():
    return {"status": "ok"}


@app.post("/api/evaluate_day")
async def submit_daily_log(
    body: LogSubmission, user_id: str = Depends(get_current_user_id)
):
    # Per-user daily cap — protects the shared ~50/day free-tier quota.
    start = (
        datetime.now(timezone.utc)
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .strftime("%Y-%m-%dT%H:%M:%SZ")
    )
    used = await db.count_rows(
        "daily_logs",
        filters={"user_id": f"eq.{user_id}", "created_at": f"gte.{start}"},
    )
    if used >= settings.max_submissions_per_user_per_day:
        raise HTTPException(
            status_code=429,
            detail="Daily submission limit reached. The Council rests until tomorrow.",
        )

    await db.insert(
        "daily_logs",
        {"user_id": user_id, "log_data": body.log_data, "status": "pending"},
    )
    return {"status": "success", "message": "Log secured in database. The Council is evaluating..."}


@app.get("/api/me/quests")
async def my_quests(user_id: str = Depends(get_current_user_id)):
    rows = await db.select_rows(
        "active_quests",
        filters={"user_id": f"eq.{user_id}"},
        order="created_at",
        desc=True,
        limit=1,
    )
    return rows[0] if rows else {}


@app.get("/api/me/logs")
async def my_logs(user_id: str = Depends(get_current_user_id)):
    return await db.select_rows(
        "daily_logs",
        columns="id,status,created_at,processed_at",
        filters={"user_id": f"eq.{user_id}"},
        order="created_at",
        desc=True,
        limit=10,
    )


@app.get("/api/me/profile")
async def my_profile(user_id: str = Depends(get_current_user_id)):
    return await db.select_one("users", filters={"id": f"eq.{user_id}"}) or {}


@app.put("/api/me/profile")
async def update_profile(
    body: ProfileUpdate, user_id: str = Depends(get_current_user_id)
):
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if payload:
        await db.update("users", payload, filters={"id": f"eq.{user_id}"})
    return await db.select_one("users", filters={"id": f"eq.{user_id}"}) or {}


# ── Missions ────────────────────────────────────────────────────────────────
_CATEGORY_STAT = {
    "intellect": (3, 0, 0),
    "wealth": (0, 3, 0),
    "strength": (0, 0, 3),
    "general": (1, 0, 0),
}


def _today_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .strftime("%Y-%m-%dT%H:%M:%SZ")
    )


@app.get("/api/me/missions")
async def list_missions(user_id: str = Depends(get_current_user_id)):
    return await db.select_rows(
        "missions",
        filters={"user_id": f"eq.{user_id}"},
        order="created_at",
        desc=True,
        limit=50,
    )


@app.post("/api/me/missions/generate")
async def generate_today_missions(user_id: str = Depends(get_current_user_id)):
    # Idempotent per day: if the System already issued today's missions, return them.
    today = _today_iso()
    existing = await db.select_rows(
        "missions",
        filters={
            "user_id": f"eq.{user_id}",
            "source": "eq.system",
            "created_at": f"gte.{today}",
        },
        order="created_at",
        desc=True,
    )
    if existing:
        return existing
    profile = await db.select_one("users", filters={"id": f"eq.{user_id}"}) or {}
    missions = await generate_missions(profile)
    created = []
    for m in missions:
        created.append(
            await db.insert_returning(
                "missions",
                {
                    "user_id": user_id,
                    "title": m.title,
                    "description": m.description,
                    "category": m.category,
                    "xp_reward": m.xp_reward,
                    "source": "system",
                },
            )
        )
    return created


@app.post("/api/me/missions")
async def add_mission(body: MissionInput, user_id: str = Depends(get_current_user_id)):
    return await db.insert_returning(
        "missions",
        {
            "user_id": user_id,
            "title": body.title,
            "description": body.description,
            "category": body.category,
            "source": "user",
        },
    )


@app.put("/api/me/missions/{mission_id}")
async def edit_mission(
    mission_id: int, body: MissionInput, user_id: str = Depends(get_current_user_id)
):
    await db.update(
        "missions",
        {"title": body.title, "description": body.description, "category": body.category},
        filters={"id": f"eq.{mission_id}", "user_id": f"eq.{user_id}"},
    )
    return (
        await db.select_one(
            "missions", filters={"id": f"eq.{mission_id}", "user_id": f"eq.{user_id}"}
        )
        or {}
    )


@app.post("/api/me/missions/polish")
async def polish_mission_endpoint(
    body: MissionInput, user_id: str = Depends(get_current_user_id)
):
    profile = await db.select_one("users", filters={"id": f"eq.{user_id}"}) or {}
    suggestion = await polish_mission(profile, body.title, body.description)
    return suggestion.model_dump()


@app.post("/api/me/missions/{mission_id}/complete")
async def complete_mission(mission_id: int, user_id: str = Depends(get_current_user_id)):
    m = await db.select_one(
        "missions", filters={"id": f"eq.{mission_id}", "user_id": f"eq.{user_id}"}
    )
    if not m:
        raise HTTPException(status_code=404, detail="Mission not found")
    if m.get("status") != "completed":
        await db.update(
            "missions",
            {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()},
            filters={"id": f"eq.{mission_id}", "user_id": f"eq.{user_id}"},
        )
        di, dw, ds = _CATEGORY_STAT.get(m.get("category") or "general", (1, 0, 0))
        await db.rpc(
            "apply_stat_deltas",
            {"p_user_id": user_id, "p_intellect": di, "p_wealth": dw, "p_strength": ds},
        )
    return {"status": "completed", "mission_id": mission_id}


@app.delete("/api/me/missions/{mission_id}")
async def delete_mission(mission_id: int, user_id: str = Depends(get_current_user_id)):
    await db.delete(
        "missions", filters={"id": f"eq.{mission_id}", "user_id": f"eq.{user_id}"}
    )
    return {"status": "deleted", "mission_id": mission_id}


# ── Workouts (System-designed, equipment-aware) ──────────────────────────────
_WORKOUT_STRENGTH_REWARD = 5


async def _create_workout(user_id: str) -> dict:
    profile = await db.select_one("users", filters={"id": f"eq.{user_id}"}) or {}
    plan = await generate_workout(profile)
    return await db.insert_returning(
        "workouts",
        {
            "user_id": user_id,
            "title": plan.title,
            "exercises": [e.model_dump() for e in plan.exercises],
            "equipment": profile.get("equipment") or "",
            "source": "system",
        },
    )


@app.get("/api/me/workout")
async def get_workout(user_id: str = Depends(get_current_user_id)):
    rows = await db.select_rows(
        "workouts",
        filters={"user_id": f"eq.{user_id}"},
        order="created_at",
        desc=True,
        limit=1,
    )
    return rows[0] if rows else {}


@app.post("/api/me/workout/generate")
async def generate_today_workout(user_id: str = Depends(get_current_user_id)):
    # Idempotent per day: return today's session if it already exists.
    today = _today_iso()
    existing = await db.select_rows(
        "workouts",
        filters={"user_id": f"eq.{user_id}", "created_at": f"gte.{today}"},
        order="created_at",
        desc=True,
        limit=1,
    )
    if existing:
        return existing[0]
    return await _create_workout(user_id)


@app.post("/api/me/workout/regenerate")
async def regenerate_workout(user_id: str = Depends(get_current_user_id)):
    # Drop today's sessions and forge a fresh one (e.g. after changing equipment).
    today = _today_iso()
    await db.delete(
        "workouts",
        filters={"user_id": f"eq.{user_id}", "created_at": f"gte.{today}"},
    )
    return await _create_workout(user_id)


@app.post("/api/me/workout/{workout_id}/complete")
async def complete_workout(workout_id: int, user_id: str = Depends(get_current_user_id)):
    w = await db.select_one(
        "workouts", filters={"id": f"eq.{workout_id}", "user_id": f"eq.{user_id}"}
    )
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")
    if w.get("status") != "completed":
        await db.update(
            "workouts",
            {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()},
            filters={"id": f"eq.{workout_id}", "user_id": f"eq.{user_id}"},
        )
        await db.rpc(
            "apply_stat_deltas",
            {
                "p_user_id": user_id,
                "p_intellect": 0,
                "p_wealth": 0,
                "p_strength": _WORKOUT_STRENGTH_REWARD,
            },
        )
    return {"status": "completed", "workout_id": workout_id}


# ── Resources (System-curated books / courses / tools per goal) ──────────────
async def _create_resources(user_id: str) -> list:
    profile = await db.select_one("users", filters={"id": f"eq.{user_id}"}) or {}
    resources = await generate_resources(profile)
    created = []
    for r in resources:
        created.append(
            await db.insert_returning(
                "resources",
                {
                    "user_id": user_id,
                    "title": r.title,
                    "author": r.author,
                    "type": r.type,
                    "category": r.category,
                    "reason": r.reason,
                },
            )
        )
    return created


@app.get("/api/me/resources")
async def list_resources(user_id: str = Depends(get_current_user_id)):
    return await db.select_rows(
        "resources",
        filters={"user_id": f"eq.{user_id}"},
        order="created_at",
        desc=True,
        limit=50,
    )


@app.post("/api/me/resources/generate")
async def generate_resources_endpoint(user_id: str = Depends(get_current_user_id)):
    # Idempotent: if the System already curated a shelf, return it.
    existing = await db.select_rows(
        "resources",
        filters={"user_id": f"eq.{user_id}"},
        order="created_at",
        desc=True,
        limit=50,
    )
    if existing:
        return existing
    return await _create_resources(user_id)


@app.post("/api/me/resources/refresh")
async def refresh_resources(user_id: str = Depends(get_current_user_id)):
    await db.delete("resources", filters={"user_id": f"eq.{user_id}"})
    return await _create_resources(user_id)
