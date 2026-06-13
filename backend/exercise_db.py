"""free-exercise-db catalog (public domain, 873 exercises with photo frames).

Fetched once and cached in memory. Used two ways:
1. candidates() — equipment-filtered list injected into the workout prompt so the
   LLM picks REAL exercises by id (guaranteed image match).
2. enrich() — attaches image URLs + canonical muscle data to generated exercises,
   with fuzzy name matching as the fallback for free-form LLM output.
"""
import re
import time

import httpx

CATALOG_URL = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json"
IMG_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/"

_catalog: list[dict] = []
_by_id: dict[str, dict] = {}
_loaded_at: float = 0.0
_TTL = 7 * 24 * 3600  # refresh weekly


async def load_catalog() -> bool:
    """Fetch + cache the catalog. Returns True if a catalog is available."""
    global _catalog, _by_id, _loaded_at
    if _catalog and time.time() - _loaded_at < _TTL:
        return True
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(CATALOG_URL)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:  # noqa: BLE001 — keep stale catalog on refresh failure
        print(f"[exercise_db] catalog fetch failed: {e!r}", flush=True)
        return bool(_catalog)
    _catalog = data
    _by_id = {e["id"]: e for e in data}
    _loaded_at = time.time()
    print(f"[exercise_db] catalog loaded: {len(_catalog)} exercises", flush=True)
    return True


# Map free-text user equipment to the catalog's equipment vocabulary.
_EQUIP_MAP = [
    ("dumbbell", "dumbbell"),
    ("barbell", "barbell"),
    ("kettlebell", "kettlebells"),
    ("band", "bands"),
    ("cable", "cable"),
    ("machine", "machine"),
    ("medicine ball", "medicine ball"),
    ("med ball", "medicine ball"),
    ("exercise ball", "exercise ball"),
    ("swiss ball", "exercise ball"),
    ("stability ball", "exercise ball"),
    ("foam", "foam roll"),
    ("ez bar", "e-z curl bar"),
    ("e-z", "e-z curl bar"),
    ("curl bar", "e-z curl bar"),
]


def _allowed_equipment(user_equipment: str) -> set:
    txt = (user_equipment or "").lower()
    # Bodyweight is always available; pull-up bar exercises are filed under it too.
    allowed = {"body only", None, "other"}
    if "gym" in txt:  # "full gym", "gym access" → everything
        return {e.get("equipment") for e in _catalog}
    for keyword, equip in _EQUIP_MAP:
        if keyword in txt:
            allowed.add(equip)
    return allowed


def candidates(user_equipment: str, cap: int = 450) -> list[dict]:
    """Equipment-matched exercises, beginner/intermediate first."""
    allowed = _allowed_equipment(user_equipment)
    pool = [e for e in _catalog if e.get("equipment") in allowed]
    order = {"beginner": 0, "intermediate": 1, "expert": 2}
    pool.sort(key=lambda e: order.get(e.get("level"), 1))
    return pool[:cap]


def catalog_block(user_equipment: str) -> str:
    """Compact 'id | name | equipment | muscles' lines for the workout prompt."""
    lines = []
    for e in candidates(user_equipment):
        muscles = ",".join(e.get("primaryMuscles", [])[:2])
        lines.append(f"{e['id']} | {e['name']} | {e.get('equipment') or 'bodyweight'} | {muscles}")
    return "\n".join(lines)


_WORD = re.compile(r"[a-z]+")


def _tokens(s: str) -> set:
    return set(_WORD.findall((s or "").lower()))


def _match_by_name(name: str):
    """Best token-overlap match for free-form exercise names; None if weak."""
    want = _tokens(name)
    if not want:
        return None
    best, best_score = None, 0.0
    for e in _catalog:
        have = _tokens(e["name"])
        if not have:
            continue
        overlap = len(want & have)
        score = overlap / max(len(want | have), 1)
        if score > best_score:
            best, best_score = e, score
    return best if best_score >= 0.5 else None


def enrich(exercises) -> None:
    """Attach image URLs (and fill gaps) from the catalog, in place."""
    for ex in exercises:
        entry = _by_id.get(ex.exercise_id) or _match_by_name(ex.name)
        if not entry:
            ex.exercise_id = ""
            ex.images = []
            continue
        ex.exercise_id = entry["id"]
        ex.images = [IMG_BASE + p for p in entry.get("images", [])[:2]]
        if not ex.target and entry.get("primaryMuscles"):
            ex.target = ", ".join(entry["primaryMuscles"][:2])
        if not ex.equipment:
            ex.equipment = entry.get("equipment") or "bodyweight"
