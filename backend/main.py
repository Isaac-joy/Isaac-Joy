"""Solo Leveling Council — FastAPI backend.

Endpoints write to Supabase instantly (durable queue); the in-process worker
does the slow AI orchestration. The user id always comes from a verified JWT.
"""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from auth import get_current_user_id
from config import settings
from models import LogSubmission, ProfileUpdate
from supabase_client import db
from worker import council_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(council_worker())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        await db.aclose()


app = FastAPI(title="Solo Leveling Council API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
