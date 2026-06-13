"""Hunter Rank + Level derived from total_xp (the Solo Leveling progression spine).

Rank is the E->SS ladder (the canonical 'awakening/promotion' arc); Level scales
smoothly with XP. Both are computed from a single monotonic counter so progression
only ever climbs — no demotions from one bad day (the brutal verdict is the stick;
XP is the carrot that keeps people returning).
"""

# (rank, xp floor to reach it) — ascending.
RANK_THRESHOLDS = [
    ("E", 0),
    ("D", 500),
    ("C", 1500),
    ("B", 4000),
    ("A", 9000),
    ("S", 18000),
    ("SS", 35000),
]


def hunter_status(total_xp) -> dict:
    xp = max(0, int(total_xp or 0))
    level = int((xp / 50) ** 0.5) + 1  # lvl1 @0xp, ~lvl11 @5k, ~lvl27 @35k

    rank, rank_floor = "E", 0
    next_rank, next_floor = None, None
    for i, (r, floor) in enumerate(RANK_THRESHOLDS):
        if xp >= floor:
            rank, rank_floor = r, floor
            if i + 1 < len(RANK_THRESHOLDS):
                next_rank, next_floor = RANK_THRESHOLDS[i + 1]
            else:
                next_rank, next_floor = None, None

    if next_floor is not None:
        span = next_floor - rank_floor
        progress = (xp - rank_floor) / span if span else 1.0
        to_next = max(0, next_floor - xp)
    else:
        progress, to_next = 1.0, 0

    return {
        "total_xp": xp,
        "level": level,
        "rank": rank,
        "next_rank": next_rank,
        "xp_to_next_rank": to_next,
        "rank_progress": round(progress, 3),
    }
