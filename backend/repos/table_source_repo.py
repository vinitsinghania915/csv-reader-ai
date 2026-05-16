from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.table_source import TableSource


class TableSourceRepository:
    """Data access for per-table source metadata."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(
        self,
        workspace_id: str,
        table_name: str,
        source_type: str,
        origin: Optional[str] = None,
        spreadsheet_id: Optional[str] = None,
        tab_title: Optional[str] = None,
    ) -> TableSource:
        existing = await self.get(workspace_id, table_name)
        if existing is None:
            row = TableSource(
                workspace_id=workspace_id,
                table_name=table_name,
                source_type=source_type,
                origin=origin,
                spreadsheet_id=spreadsheet_id,
                tab_title=tab_title,
            )
            self._session.add(row)
            await self._session.flush()
            return row

        existing.source_type = source_type
        existing.origin = origin
        existing.spreadsheet_id = spreadsheet_id
        existing.tab_title = tab_title
        existing.last_synced_at = datetime.now(timezone.utc)
        await self._session.flush()
        return existing

    async def touch_synced(self, workspace_id: str, table_name: str) -> None:
        row = await self.get(workspace_id, table_name)
        if row is not None:
            row.last_synced_at = datetime.now(timezone.utc)
            await self._session.flush()

    async def get(self, workspace_id: str, table_name: str) -> Optional[TableSource]:
        return (
            await self._session.execute(
                select(TableSource).where(
                    TableSource.workspace_id == workspace_id,
                    TableSource.table_name == table_name,
                )
            )
        ).scalar_one_or_none()

    async def list_by_workspace(self, workspace_id: str) -> list[TableSource]:
        result = await self._session.execute(
            select(TableSource).where(TableSource.workspace_id == workspace_id)
        )
        return list(result.scalars().all())

    async def delete(self, workspace_id: str, table_name: str) -> None:
        await self._session.execute(
            delete(TableSource).where(
                TableSource.workspace_id == workspace_id,
                TableSource.table_name == table_name,
            )
        )
