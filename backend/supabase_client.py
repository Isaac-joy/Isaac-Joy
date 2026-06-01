"""Thin async Supabase client over PostgREST + GoTrue (httpx only).

Avoids the heavy `supabase` SDK (realtime/storage/iceberg) — smaller install,
no native build deps, faster cold start, and natively async (no thread pool).

The service-role key bypasses RLS and is used for all DB ops here; it must never
leave the backend. JWT verification uses the anon key + the caller's token.
"""
from typing import Any, Optional

import httpx

from config import settings

REST_URL = f"{settings.supabase_url}/rest/v1"
AUTH_URL = f"{settings.supabase_url}/auth/v1"

_SERVICE_HEADERS = {
    "apikey": settings.supabase_service_role_key,
    "Authorization": f"Bearer {settings.supabase_service_role_key}",
    "Content-Type": "application/json",
}

_client = httpx.AsyncClient(timeout=30.0)


class _DB:
    """Filters are PostgREST operator strings, e.g. {'id': 'eq.<uuid>'}."""

    async def select_rows(
        self,
        table: str,
        *,
        filters: Optional[dict] = None,
        columns: str = "*",
        order: Optional[str] = None,
        desc: bool = False,
        limit: Optional[int] = None,
    ) -> list[dict]:
        params: dict[str, str] = {"select": columns}
        for col, expr in (filters or {}).items():
            params[col] = expr
        if order:
            params["order"] = f"{order}.{'desc' if desc else 'asc'}"
        if limit is not None:
            params["limit"] = str(limit)
        resp = await _client.get(
            f"{REST_URL}/{table}", params=params, headers=_SERVICE_HEADERS
        )
        resp.raise_for_status()
        return resp.json()

    async def select_one(self, table: str, *, filters: dict) -> Optional[dict]:
        rows = await self.select_rows(table, filters=filters, limit=1)
        return rows[0] if rows else None

    async def count_rows(self, table: str, *, filters: dict) -> int:
        params: dict[str, str] = {"select": "id"}
        for col, expr in filters.items():
            params[col] = expr
        params["limit"] = "1"
        headers = {**_SERVICE_HEADERS, "Prefer": "count=exact"}
        resp = await _client.get(f"{REST_URL}/{table}", params=params, headers=headers)
        resp.raise_for_status()
        content_range = resp.headers.get("content-range", "")
        if "/" in content_range:
            total = content_range.split("/")[-1]
            if total.isdigit():
                return int(total)
        return len(resp.json())

    async def insert(self, table: str, row: dict) -> None:
        headers = {**_SERVICE_HEADERS, "Prefer": "return=minimal"}
        resp = await _client.post(f"{REST_URL}/{table}", json=row, headers=headers)
        resp.raise_for_status()

    async def update(self, table: str, values: dict, *, filters: dict) -> None:
        headers = {**_SERVICE_HEADERS, "Prefer": "return=minimal"}
        resp = await _client.patch(
            f"{REST_URL}/{table}", params=filters, json=values, headers=headers
        )
        resp.raise_for_status()

    async def rpc(self, fn: str, params: Optional[dict] = None) -> Any:
        resp = await _client.post(
            f"{REST_URL}/rpc/{fn}", json=params or {}, headers=_SERVICE_HEADERS
        )
        resp.raise_for_status()
        if resp.status_code == 204 or not resp.content:
            return None
        return resp.json()

    async def aclose(self) -> None:
        await _client.aclose()


db = _DB()


async def verify_jwt(token: str) -> Optional[str]:
    """Validate a Supabase user JWT via GoTrue; return the user id or None."""
    headers = {"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"}
    try:
        resp = await _client.get(f"{AUTH_URL}/user", headers=headers, timeout=10.0)
    except httpx.HTTPError:
        return None
    if resp.status_code != 200:
        return None
    return resp.json().get("id")
