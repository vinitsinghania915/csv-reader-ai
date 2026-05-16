from __future__ import annotations

import uuid
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.workspace import Relationship


class RelationshipRepository:
    """Data access layer for inter-table Relationships."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_workspace(self, workspace_id: str) -> list[Relationship]:
        """Get all defined relationships for a workspace context."""
        stmt = (
            select(Relationship)
            .where(Relationship.workspace_id == workspace_id)
            .order_by(Relationship.created_at.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def add_relationship(
        self,
        workspace_id: str,
        table_a: str,
        column_a: str,
        table_b: str,
        column_b: str,
        join_type: str = "INNER",
    ) -> Relationship:
        """Create a new logical JOIN mapping between datasets."""
        # Simple duplicate checking
        stmt = select(Relationship).where(
            Relationship.workspace_id == workspace_id,
            Relationship.table_a == table_a,
            Relationship.column_a == column_a,
            Relationship.table_b == table_b,
            Relationship.column_b == column_b,
        )
        existing = (await self._session.execute(stmt)).scalar_one_or_none()
        if existing:
            return existing

        rel = Relationship(
            workspace_id=workspace_id,
            table_a=table_a,
            column_a=column_a,
            table_b=table_b,
            column_b=column_b,
            join_type=join_type,
        )
        self._session.add(rel)
        await self._session.flush()
        return rel

    async def delete_relationship(self, relationship_id: UUID) -> bool:
        """Delete a relationship by ID."""
        stmt = select(Relationship).where(Relationship.id == relationship_id)
        result = await self._session.execute(stmt)
        rel = result.scalar_one_or_none()
        if rel:
            await self._session.delete(rel)
            await self._session.flush()
            return True
        return False
