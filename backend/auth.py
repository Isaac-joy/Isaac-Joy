"""JWT auth dependency. The user id is derived from a verified Supabase token,
never trusted from the request body."""
from fastapi import Header, HTTPException

from supabase_client import verify_jwt


async def get_current_user_id(authorization: str = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    user_id = await verify_jwt(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id
