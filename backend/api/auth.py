"""Auth routes — Google OAuth sign-in (with Sheets/Drive scopes bundled).

On first callback, we upsert a User row, issue a signed session cookie,
and — dev-only convenience — claim any orphan workspace directories
(parquet folders with no DB row) for this user so their prior data
is visible in the /workspaces listing.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional
from urllib.parse import urlencode

import structlog
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from models.user import User, Workspace
from repos.workspace_repo import WorkspaceRepository
from services.google_oauth_service import (
    begin_login,
    disconnect,
    get_connection_status,
    handle_callback,
)
from utils.auth import get_current_user, get_optional_user
from utils.database import get_db_session
from utils.session import SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, sign_session

logger = structlog.get_logger()
settings = get_settings()

router = APIRouter(prefix="/auth", tags=["auth"])


def _cookie_is_secure() -> bool:
    return settings.BACKEND_URL.startswith("https://")


def _set_session_cookie(response: Response, user_id: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=sign_session(user_id),
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=_cookie_is_secure(),
        samesite="lax",
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")


@router.get("/google/login")
async def google_login(
    next: Optional[str] = Query(default="/workspaces"),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    """Start Google OAuth. `next` is the frontend path to return to after sign-in."""
    auth_url = await begin_login(session, next_url=next)
    return RedirectResponse(url=auth_url, status_code=302)


@router.get("/google/callback")
async def google_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    """Handle Google's redirect: upsert user, set session cookie, redirect to app."""
    if error:
        qs = urlencode({"auth_error": error})
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/?{qs}", status_code=302)
    if not code or not state:
        qs = urlencode({"auth_error": "missing_code_or_state"})
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/?{qs}", status_code=302)

    user, next_url = await handle_callback(session, code=code, state=state)
    await _claim_orphan_workspaces(session, user)

    target_path = next_url or "/workspaces"
    if not target_path.startswith("/"):
        target_path = "/workspaces"
    response = RedirectResponse(url=f"{settings.FRONTEND_URL}{target_path}", status_code=302)
    _set_session_cookie(response, str(user.id))
    return response


@router.get("/me")
async def me(user: Optional[User] = Depends(get_optional_user)) -> dict[str, object]:
    """Return the currently signed-in user, or null."""
    if user is None:
        return {"user": None}
    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "avatar_url": user.avatar_url,
        }
    }


@router.post("/logout")
async def logout() -> Response:
    response = JSONResponse(content={"ok": True})
    _clear_session_cookie(response)
    return response


@router.get("/google/status")
async def google_status(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    row = await get_connection_status(session, user.id)
    if row is None:
        return {"connected": False}
    return {
        "connected": True,
        "email": row.google_account_email or user.email,
        "connected_at": row.created_at.isoformat(),
    }


@router.post("/google/disconnect")
async def google_disconnect(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    removed = await disconnect(session, user.id)
    return {"removed": removed}


async def _claim_orphan_workspaces(session: AsyncSession, user: User) -> None:
    """DEV-ONLY: On sign-in, assign any parquet directories with no DB row to this user.

    This is a transitional helper — before we added the Workspace table,
    workspace identity was implicit in the filesystem. Remove this call
    before deploying publicly.
    """
    base = Path(settings.PARQUET_STORAGE_PATH)
    if not base.exists():
        return
    existing_ids = {
        w.id
        for w in (await session.execute(select(Workspace))).scalars().all()
    }
    repo = WorkspaceRepository(session)
    claimed = 0
    for ws_dir in sorted(base.iterdir()):
        if not ws_dir.is_dir():
            continue
        if ws_dir.name in existing_ids:
            continue
        parquet_count = len(list(ws_dir.glob("*.parquet")))
        if parquet_count == 0:
            continue
        await repo.create(
            user_id=user.id,
            name=f"Workspace {ws_dir.name[:8]}",
            workspace_id=ws_dir.name,
        )
        claimed += 1
    if claimed:
        logger.info("Claimed orphan workspaces", user=str(user.id), count=claimed)
