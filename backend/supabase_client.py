"""Thin async Supabase client over PostgREST + GoTrue (httpx only).

Avoids the heavy `supabase` SDK (realtime/storage/iceberg) — smaller install,
no native build deps, faster cold start, and natively async (no thread pool).

The service-role key bypasses RLS and is used for all DB ops here; it must never
leave the backend. JWT verification uses the anon key + the caller's token.

All requests go through `_do`, which translates failures into typed AppErrors so
the API can return self-explanatory messages (missing table → SchemaNotReady,
unreachable → DatabaseError).
"""
from typing import Any, Optional

import httpx

from config import settings
from errors import DatabaseError, SchemaNotReadyError

REST_URL = f"{settings.supabase_url}/rest/v1"
AUTH_URL = f"{settings.supabase_url}/auth/v1"

_SERVICE_HEADERS = {
    "apikey": settings.supabase_service_role_key,
    "Authorization": f"Bearer {settings.supabase_service_role_key}",
    "Content-Type": "application/json",
}

# PostgREST / Postgres codes that mean "the schema isn't set up" (run a migration):
#   PGRST202 missing function · PGRST204 missing column (write) · PGRST205 missing table
#   42P01 undefined_table · 42703 undefined_column · 42883 undefined_function
_SCHEMA_CODES = {"PGRST202", "PGRST204", "PGRST205", "42P01", "42703", "42883"}

_client = httpx.AsyncClient(timeout=30.0)


def _raise_for_status(resp: httpx.Response) -> None:
    if resp.status_code < 400:
        return
    code, msg = "", ""
    try:
        body = resp.json()
        code = str(body.get("code", "") or "")
        msg = str(body.get("message", "") or "")
    except Exception:  # noqa: BLE001 — non-JSON error body
        msg = (resp.text or "")[:200]
    if code in _SCHEMA_CODES or resp.status_code == 404:
        raise SchemaNotReadyError(
            f"Database setup is incomplete ({msg or 'missing table/column'}). "
            "Run the latest SQL migration in the Supabase SQL Editor, then try again."
        )
    raise DatabaseError(f"Database error {resp.status_code}: {msg or 'request failed'}")


class _DB:
    """Filters are PostgREST operator strings, e.g. {'id': 'eq.<uuid>'}."""

    async def _do(
        self,
        method: str,
        path: str,
        *,
        params: Optional[dict] = None,
        json: Any = None,
        headers: Optional[dict] = None,
    ) -> httpx.Response:
        try:
            resp = await _client.request(
                method,
                f"{REST_URL}/{path}",
                params=params,
                json=json,
                headers=headers or _SERVICE_HEADERS,
            )
        except httpx.HTTPError as e:  # connect/timeout/transport → DB unreachable
            raise DatabaseError(
                "Could not reach the database. Check your connection and try again."
            ) from e
        _raise_for_status(resp)
        return resp

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
        resp = await self._do("GET", table, params=params)
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
        resp = await self._do("GET", table, params=params, headers=headers)
        content_range = resp.headers.get("content-range", "")
        if "/" in content_range:
            total = content_range.split("/")[-1]
            if total.isdigit():
                return int(total)
        return len(resp.json())

    async def insert(self, table: str, row: dict) -> None:
        headers = {**_SERVICE_HEADERS, "Prefer": "return=minimal"}
        await self._do("POST", table, json=row, headers=headers)

    async def update(self, table: str, values: dict, *, filters: dict) -> None:
        headers = {**_SERVICE_HEADERS, "Prefer": "return=minimal"}
        await self._do("PATCH", table, params=filters, json=values, headers=headers)

    async def insert_returning(self, table: str, row: dict) -> dict:
        headers = {**_SERVICE_HEADERS, "Prefer": "return=representation"}
        resp = await self._do("POST", table, json=row, headers=headers)
        data = resp.json()
        return data[0] if isinstance(data, list) and data else data

    async def delete(self, table: str, *, filters: dict) -> None:
        headers = {**_SERVICE_HEADERS, "Prefer": "return=minimal"}
        await self._do("DELETE", table, params=filters, headers=headers)

    async def rpc(self, fn: str, params: Optional[dict] = None) -> Any:
        resp = await self._do("POST", f"rpc/{fn}", json=params or {})
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
