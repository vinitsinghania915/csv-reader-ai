"""FastAPI dependencies for authenticated routes."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from exceptions import AuthenticationError
from models.user import User
from utils.database import get_db_session
from utils.session import SESSION_COOKIE_NAME, read_session


async def get_current_user(
    session: AsyncSession = Depends(get_db_session),
    csv_reader_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> User:
    """Return the currently-signed-in user or raise 401.

    Use on protected routes:
        async def endpoint(user: User = Depends(get_current_user)): ...
    """
    user_id = read_session(csv_reader_session)
    if user_id is None:
        raise AuthenticationError("Sign in required")
    try:
        user_uuid = UUID(user_id)
    except ValueError as exc:
        raise AuthenticationError("Invalid session") from exc
    user = (
        await session.execute(select(User).where(User.id == user_uuid))
    ).scalar_one_or_none()
    if user is None:
        raise AuthenticationError("User not found")
    return user


async def get_optional_user(
    session: AsyncSession = Depends(get_db_session),
    csv_reader_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> Optional[User]:
    """Return the current user if signed in, else None. Use for public-but-personalizable routes."""
    user_id = read_session(csv_reader_session)
    if user_id is None:
        return None
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        return None
    return (
        await session.execute(select(User).where(User.id == user_uuid))
    ).scalar_one_or_none()
