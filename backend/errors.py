"""Typed application errors → clean HTTP responses with self-explanatory detail.

A single FastAPI handler (in main.py) turns any AppError into a JSON response
{"detail": ...} with the right status code, so the mobile app can show a clear
message instead of a blunt "HTTP 500".
"""
from typing import Optional


class AppError(Exception):
    status_code: int = 500
    detail: str = "Something went wrong."

    def __init__(self, detail: Optional[str] = None):
        if detail:
            self.detail = detail
        super().__init__(self.detail)


class SchemaNotReadyError(AppError):
    """A required table/column/function is missing — a migration hasn't been run."""

    status_code = 503
    detail = (
        "Database setup is incomplete — a required table or column is missing. "
        "Run the latest SQL migration in the Supabase SQL Editor, then try again."
    )


class DatabaseError(AppError):
    """The database is unreachable or returned an unexpected error."""

    status_code = 502
    detail = "The database is unavailable right now. Please try again in a moment."


class AIUnavailableError(AppError):
    """Every model in the failover pool is busy / rate-limited / failing."""

    status_code = 503
    detail = (
        "The System is overloaded — every AI model is busy or rate-limited right now. "
        "Wait a minute and try again."
    )
