"""The Council worker — pulls from the durable queue, never lets the loop die.

Topology note: this runs in-process with the API (MVP choice). On a sleeping
free-tier host it only advances while the service is awake; an inbound request
wakes it and drains the queue. To migrate to an out-of-process worker later,
this same module can be launched as its own entrypoint with zero code changes.
"""
import asyncio
from datetime import datetime, timezone

from config import settings
from llm import run_council, run_synthesizer
from supabase_client import db

_REPORT_XP = 30  # XP for showing up and reporting honestly (drives Rank/Level)


async def _claim_next() -> dict | None:
    rows = await db.rpc("claim_next_log")
    return rows[0] if rows else None


async def _complete(log: dict, verdict, audits) -> None:
    await db.insert("active_quests", {
        "user_id": log["user_id"],
        "log_id": log["id"],
        "system_verdict": verdict.system_verdict,
        "quests": [q.model_dump() for q in verdict.quests],
        "stat_adjustments": verdict.stat_adjustments.model_dump(),
        "council": audits.model_dump(),  # the Council's audits + in-character debate
    })
    sa = verdict.stat_adjustments
    await db.rpc("apply_stat_deltas", {
        "p_user_id": log["user_id"],
        "p_intellect": sa.intellect_delta,
        "p_wealth": sa.wealth_delta,
        "p_strength": sa.strength_delta,
    })
    await db.rpc("award_xp", {"p_user_id": log["user_id"], "p_xp": _REPORT_XP})
    # Carry the System's evolving memory forward so it "knows" the Hunter over time.
    memory = (getattr(verdict, "memory_update", "") or "").strip()
    if memory:
        await db.update(
            "users",
            {"hunter_memory": memory[:1200]},
            filters={"id": f"eq.{log['user_id']}"},
        )
    await db.update(
        "daily_logs",
        {"status": "completed", "processed_at": datetime.now(timezone.utc).isoformat()},
        filters={"id": f"eq.{log['id']}"},
    )


async def _fail(log: dict, err: Exception) -> None:
    attempts = (log.get("attempts") or 0) + 1
    status = "failed" if attempts >= settings.max_attempts else "pending"
    await db.update(
        "daily_logs",
        {"status": status, "attempts": attempts, "last_error": str(err)[:500]},
        filters={"id": f"eq.{log['id']}"},
    )


async def _process(log: dict) -> None:
    user = await db.select_one("users", filters={"id": f"eq.{log['user_id']}"})
    if not user:
        raise ValueError(f"user {log['user_id']} not found")
    audits = await run_council(user, log["log_data"])
    verdict = await run_synthesizer(user, audits)
    await _complete(log, verdict, audits)


async def council_worker() -> None:
    while True:
        try:
            log = await _claim_next()
            if log:
                try:
                    await _process(log)
                except Exception as e:  # noqa: BLE001 — one bad log must not stop the queue
                    await _fail(log, e)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 — claim/transport errors: back off, keep looping
            pass
        finally:
            # Single rest point — respects free-tier RPM and idles when empty.
            await asyncio.sleep(settings.worker_poll_seconds)
