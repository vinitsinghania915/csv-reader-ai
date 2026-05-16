from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import Workspace


class WorkspaceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, workspace_id: str) -> Optional[Workspace]:
        return (
            await self._session.execute(
                select(Workspace).where(Workspace.id == workspace_id)
            )
        ).scalar_one_or_none()

    async def list_for_user(self, user_id: UUID) -> list[Workspace]:
        result = await self._session.execute(
            select(Workspace)
            .where(Workspace.user_id == user_id)
            .order_by(Workspace.updated_at.desc())
        )
        return list(result.scalars().all())

    async def create(self, user_id: UUID, name: str, workspace_id: Optional[str] = None) -> Workspace:
        ws = Workspace(
            id=workspace_id or str(uuid4()),
            user_id=user_id,
            name=name,
        )
        self._session.add(ws)
        await self._session.flush()
        return ws

    async def get_or_create(
        self, user_id: UUID, workspace_id: str, default_name: str = "Untitled workspace"
    ) -> Workspace:
        existing = await self.get(workspace_id)
        if existing is not None:
            return existing
        return await self.create(user_id=user_id, name=default_name, workspace_id=workspace_id)

    async def touch(self, workspace_id: str) -> None:
        ws = await self.get(workspace_id)
        if ws is not None:
            ws.updated_at = datetime.now(timezone.utc)
            await self._session.flush()

    async def rename(self, workspace_id: str, name: str) -> Optional[Workspace]:
        ws = await self.get(workspace_id)
        if ws is None:
            return None
        ws.name = name
        ws.updated_at = datetime.now(timezone.utc)
        await self._session.flush()
        return ws
