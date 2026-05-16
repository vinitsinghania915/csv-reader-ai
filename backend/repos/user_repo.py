from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert_from_google(
        self, google_sub: str, email: str, name: Optional[str], avatar_url: Optional[str]
    ) -> User:
        existing = (
            await self._session.execute(select(User).where(User.google_sub == google_sub))
        ).scalar_one_or_none()
        if existing is None:
            existing = (
                await self._session.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()
        if existing is None:
            user = User(
                google_sub=google_sub,
                email=email,
                name=name or email,
                avatar_url=avatar_url,
            )
            self._session.add(user)
            await self._session.flush()
            return user

        existing.google_sub = google_sub
        existing.email = email
        if name:
            existing.name = name
        if avatar_url:
            existing.avatar_url = avatar_url
        existing.last_login_at = datetime.now(timezone.utc)
        await self._session.flush()
        return existing
