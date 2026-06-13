"""Solo Leveling Council — FastAPI backend.

Endpoints write to Supabase instantly (durable queue); the in-process worker
does the slow AI orchestration. The user id always comes from a verified JWT.
"""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import books as book_data
import exercise_db
from ranks import hunter_status
from auth import get_current_user_id
from config import settings
from errors import AppError
from llm import (
    generate_career_paths,
    generate_chapter_notes,
    generate_gate,
    generate_missions,
    generate_resources,
    generate_study_plan,
    generate_workout,
    polish_mission,
)
from models import BookInput, ContentReport, LogSubmission, MissionInput, ProfileUpdate
from supabase_client import db, delete_auth_user
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
    profile = await db.select_one("users", filters={"id": f"eq.{user_id}"}) or {}
    profile.update(hunter_status(profile.get("total_xp", 0)))  # rank, level, xp bar
    return profile


@app.put("/api/me/profile")
async def update_profile(
    body: ProfileUpdate, user_id: str = Depends(get_current_user_id)
):
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if payload:
        await db.update("users", payload, filters={"id": f"eq.{user_id}"})
    return await db.select_one("users", filters={"id": f"eq.{user_id}"}) or {}


@app.delete("/api/me/account")
async def delete_account(user_id: str = Depends(get_current_user_id)):
    """Full, irreversible account + data deletion (Apple/Google requirement).
    Deleting the auth user cascades through public.users to every feature table."""
    ok = await delete_auth_user(user_id)
    if not ok:
        raise HTTPException(status_code=502, detail="Account deletion failed. Please try again.")
    return {"status": "deleted"}


@app.post("/api/me/report_content")
async def report_content(body: ContentReport, user_id: str = Depends(get_current_user_id)):
    """Flag AI-generated output (genAI/UGC store requirement)."""
    await db.insert(
        "content_reports",
        {"user_id": user_id, "kind": body.kind, "content": body.content},
    )
    return {"status": "received"}


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
        await db.rpc("award_xp", {"p_user_id": user_id, "p_xp": m.get("xp_reward") or 50})
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
    # Give the LLM the real exercise catalog (filtered to the Hunter's equipment) so
    # every exercise maps to demo photos; enrich() attaches the image URLs after.
    catalog = ""
    if await exercise_db.load_catalog():
        catalog = exercise_db.catalog_block(profile.get("equipment") or "")
    plan = await generate_workout(profile, catalog)
    exercise_db.enrich(plan.exercises)
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
        await db.rpc("award_xp", {"p_user_id": user_id, "p_xp": w.get("xp_reward") or 60})
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


# ── The Academy (book → System-designed study campaign) ──────────────────────
_CHAPTER_INTELLECT_REWARD = 4
_BOOK_FINISH_BONUS = 6


@app.get("/api/me/books")
async def list_books(user_id: str = Depends(get_current_user_id)):
    return await db.select_rows(
        "books",
        filters={"user_id": f"eq.{user_id}"},
        order="created_at",
        desc=True,
        limit=30,
    )


@app.post("/api/me/books")
async def enroll_book(body: BookInput, user_id: str = Depends(get_current_user_id)):
    """Look the book up (Open Library), find legal free text (Gutenberg/Archive for
    public-domain works), then have the System design the study campaign."""
    profile = await db.select_one("users", filters={"id": f"eq.{user_id}"}) or {}

    meta = None
    try:
        meta = await book_data.search_book(body.title, body.author)
    except Exception as e:  # noqa: BLE001 — book lookup is best-effort
        print(f"[academy] open library lookup failed: {e!r}", flush=True)
    if not meta:
        meta = {"title": body.title, "author": body.author, "subjects": [], "pages": None,
                "ol_work_key": "", "cover_url": "", "ebook_access": "", "ia_ids": []}

    toc: list = []
    try:
        toc = await book_data.get_toc(meta.get("ol_work_key") or "")
    except Exception as e:  # noqa: BLE001
        print(f"[academy] toc scan failed: {e!r}", flush=True)

    free = {"free_text_url": "", "free_reader_url": ""}
    try:
        free = await book_data.resolve_free_text(meta)
    except Exception as e:  # noqa: BLE001
        print(f"[academy] free-text resolve failed: {e!r}", flush=True)

    plan = await generate_study_plan(profile, meta, toc, body.level)

    book = await db.insert_returning(
        "books",
        {
            "user_id": user_id,
            "title": meta.get("title") or body.title,
            "author": meta.get("author") or body.author,
            "cover_url": meta.get("cover_url") or "",
            "ol_work_key": meta.get("ol_work_key") or "",
            "ebook_access": meta.get("ebook_access") or "",
            "free_text_url": free["free_text_url"],
            "free_reader_url": free["free_reader_url"],
        },
    )
    chapters = []
    for ch in sorted(plan.chapters, key=lambda c: c.ordinal):
        chapters.append(
            await db.insert_returning(
                "book_chapters",
                {
                    "user_id": user_id,
                    "book_id": book["id"],
                    "ordinal": ch.ordinal,
                    "title": ch.title,
                    "objective": ch.objective,
                    "key_concepts": ch.key_concepts,
                    "youtube_query": ch.youtube_query,
                    "xp_reward": ch.xp_reward,
                },
            )
        )
    return {"book": book, "chapters": chapters}


@app.get("/api/me/books/{book_id}/chapters")
async def list_chapters(book_id: int, user_id: str = Depends(get_current_user_id)):
    return await db.select_rows(
        "book_chapters",
        filters={"book_id": f"eq.{book_id}", "user_id": f"eq.{user_id}"},
        order="ordinal",
    )


@app.post("/api/me/books/{book_id}/chapters/{chapter_id}/complete")
async def complete_chapter(
    book_id: int, chapter_id: int, user_id: str = Depends(get_current_user_id)
):
    ch = await db.select_one(
        "book_chapters",
        filters={"id": f"eq.{chapter_id}", "book_id": f"eq.{book_id}", "user_id": f"eq.{user_id}"},
    )
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    book_completed = False
    if ch.get("status") != "completed":
        await db.update(
            "book_chapters",
            {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()},
            filters={"id": f"eq.{chapter_id}", "user_id": f"eq.{user_id}"},
        )
        reward = _CHAPTER_INTELLECT_REWARD
        remaining = await db.count_rows(
            "book_chapters",
            filters={"book_id": f"eq.{book_id}", "user_id": f"eq.{user_id}", "status": "eq.active"},
        )
        if remaining == 0:
            await db.update(
                "books",
                {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()},
                filters={"id": f"eq.{book_id}", "user_id": f"eq.{user_id}"},
            )
            reward += _BOOK_FINISH_BONUS
            book_completed = True
        await db.rpc(
            "apply_stat_deltas",
            {"p_user_id": user_id, "p_intellect": reward, "p_wealth": 0, "p_strength": 0},
        )
        chapter_xp = (ch.get("xp_reward") or 40) + (40 if book_completed else 0)
        await db.rpc("award_xp", {"p_user_id": user_id, "p_xp": chapter_xp})
    return {"status": "completed", "chapter_id": chapter_id, "book_completed": book_completed}


@app.post("/api/me/books/{book_id}/chapters/{chapter_id}/notes")
async def chapter_notes(
    book_id: int, chapter_id: int, user_id: str = Depends(get_current_user_id)
):
    ch = await db.select_one(
        "book_chapters",
        filters={"id": f"eq.{chapter_id}", "book_id": f"eq.{book_id}", "user_id": f"eq.{user_id}"},
    )
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if ch.get("notes"):
        return {"notes": ch["notes"]}  # idempotent: generated once, stored
    book = await db.select_one(
        "books", filters={"id": f"eq.{book_id}", "user_id": f"eq.{user_id}"}
    ) or {}
    profile = await db.select_one("users", filters={"id": f"eq.{user_id}"}) or {}
    result = await generate_chapter_notes(profile, book.get("title") or "", ch)
    await db.update(
        "book_chapters",
        {"notes": result.notes},
        filters={"id": f"eq.{chapter_id}", "user_id": f"eq.{user_id}"},
    )
    return {"notes": result.notes}


@app.delete("/api/me/books/{book_id}")
async def delete_book(book_id: int, user_id: str = Depends(get_current_user_id)):
    await db.delete(
        "books", filters={"id": f"eq.{book_id}", "user_id": f"eq.{user_id}"}
    )
    return {"status": "deleted", "book_id": book_id}


# ── Career Compass (interest + growth driven field guidance) ─────────────────
async def _create_career(user_id: str) -> list:
    profile = await db.select_one("users", filters={"id": f"eq.{user_id}"}) or {}
    paths = await generate_career_paths(profile)
    created = []
    for p in paths:
        created.append(
            await db.insert_returning(
                "career_paths",
                {
                    "user_id": user_id,
                    "field": p.field,
                    "fit_reason": p.fit_reason,
                    "growth_outlook": p.growth_outlook,
                    "demand": p.demand,
                    "key_skills": p.key_skills,
                    "first_step": p.first_step,
                },
            )
        )
    return created


@app.get("/api/me/career")
async def list_career(user_id: str = Depends(get_current_user_id)):
    return await db.select_rows(
        "career_paths",
        filters={"user_id": f"eq.{user_id}"},
        order="created_at",
        desc=True,
        limit=20,
    )


@app.post("/api/me/career/generate")
async def generate_career_endpoint(user_id: str = Depends(get_current_user_id)):
    # Idempotent: return the existing compass if the System already charted it.
    existing = await db.select_rows(
        "career_paths",
        filters={"user_id": f"eq.{user_id}"},
        order="created_at",
        desc=True,
        limit=20,
    )
    if existing:
        return existing
    return await _create_career(user_id)


@app.post("/api/me/career/refresh")
async def refresh_career(user_id: str = Depends(get_current_user_id)):
    await db.delete("career_paths", filters={"user_id": f"eq.{user_id}"})
    return await _create_career(user_id)


# ── Gates (weekly System-opened dungeon challenge) ───────────────────────────
_GATE_CLEAR_STAT_BONUS = 6
_VALID_STATS = ("intellect", "wealth", "strength")


def _weakest_stat(profile: dict) -> str:
    vals = {s: profile.get(s, 0) or 0 for s in _VALID_STATS}
    return min(vals, key=vals.get)


def _parse_ts(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except ValueError:
        return None


async def _create_gate(user_id: str) -> dict:
    profile = await db.select_one("users", filters={"id": f"eq.{user_id}"}) or {}
    weakest = _weakest_stat(profile)
    plan = await generate_gate(profile, weakest)
    target = plan.target_stat if plan.target_stat in _VALID_STATS else weakest
    deadline = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    return await db.insert_returning(
        "gates",
        {
            "user_id": user_id,
            "title": plan.title,
            "description": plan.description,
            "objectives": [{"text": o, "done": False} for o in plan.objectives],
            "rank": plan.rank,
            "target_stat": target,
            "reward_xp": plan.reward_xp,
            "deadline": deadline,
        },
    )


async def _latest_gate(user_id: str):
    rows = await db.select_rows(
        "gates", filters={"user_id": f"eq.{user_id}"}, order="opened_at", desc=True, limit=1
    )
    if not rows:
        return None
    gate = rows[0]
    # Lazy collapse: an active Gate past its deadline with unfinished objectives fails.
    if gate.get("status") == "active":
        deadline = _parse_ts(gate.get("deadline"))
        objs = gate.get("objectives") or []
        all_done = bool(objs) and all(o.get("done") for o in objs)
        if deadline and deadline < datetime.now(timezone.utc) and not all_done:
            await db.update("gates", {"status": "collapsed"}, filters={"id": f"eq.{gate['id']}"})
            gate["status"] = "collapsed"
    return gate


@app.get("/api/me/gate")
async def get_gate(user_id: str = Depends(get_current_user_id)):
    return await _latest_gate(user_id) or {}


@app.post("/api/me/gate/open")
async def open_gate(user_id: str = Depends(get_current_user_id)):
    gate = await _latest_gate(user_id)
    if gate and gate.get("status") == "active":
        return gate  # one active Gate at a time
    return await _create_gate(user_id)


@app.post("/api/me/gate/regenerate")
async def regenerate_gate(user_id: str = Depends(get_current_user_id)):
    await db.update(
        "gates", {"status": "collapsed"},
        filters={"user_id": f"eq.{user_id}", "status": "eq.active"},
    )
    return await _create_gate(user_id)


@app.post("/api/me/gate/{gate_id}/objective/{index}")
async def toggle_gate_objective(
    gate_id: int, index: int, user_id: str = Depends(get_current_user_id)
):
    gate = await db.select_one(
        "gates", filters={"id": f"eq.{gate_id}", "user_id": f"eq.{user_id}"}
    )
    if not gate:
        raise HTTPException(status_code=404, detail="Gate not found")
    objs = gate.get("objectives") or []
    if index < 0 or index >= len(objs):
        raise HTTPException(status_code=400, detail="Invalid objective")
    if gate.get("status") != "active":
        return {"status": gate.get("status"), "objectives": objs, "cleared": False}
    objs[index]["done"] = not objs[index].get("done")
    all_done = all(o.get("done") for o in objs)
    update = {"objectives": objs}
    if all_done:
        update["status"] = "cleared"
        update["cleared_at"] = datetime.now(timezone.utc).isoformat()
    await db.update("gates", update, filters={"id": f"eq.{gate_id}", "user_id": f"eq.{user_id}"})
    if all_done:
        await db.rpc("award_xp", {"p_user_id": user_id, "p_xp": gate.get("reward_xp") or 150})
        stat = gate.get("target_stat") if gate.get("target_stat") in _VALID_STATS else "intellect"
        deltas = {"p_user_id": user_id, "p_intellect": 0, "p_wealth": 0, "p_strength": 0}
        deltas[f"p_{stat}"] = _GATE_CLEAR_STAT_BONUS
        await db.rpc("apply_stat_deltas", deltas)
    return {
        "status": update.get("status", "active"),
        "objectives": objs,
        "cleared": all_done,
        "reward_xp": gate.get("reward_xp") or 150,
    }
