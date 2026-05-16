from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.dashboard import Dashboard, DashboardWidget


class DashboardRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, dashboard_id: UUID) -> Optional[Dashboard]:
        return (
            await self._session.execute(
                select(Dashboard).where(Dashboard.id == dashboard_id)
            )
        ).scalar_one_or_none()

    async def list_for_workspace(self, workspace_id: str) -> list[Dashboard]:
        result = await self._session.execute(
            select(Dashboard)
            .where(Dashboard.workspace_id == workspace_id)
            .order_by(Dashboard.updated_at.desc())
        )
        return list(result.scalars().all())

    async def create(self, workspace_id: str, name: str) -> Dashboard:
        d = Dashboard(workspace_id=workspace_id, name=name)
        self._session.add(d)
        await self._session.flush()
        return d

    async def rename(self, dashboard_id: UUID, name: str) -> Optional[Dashboard]:
        d = await self.get(dashboard_id)
        if d is None:
            return None
        d.name = name
        await self._session.flush()
        return d

    async def delete(self, dashboard_id: UUID) -> bool:
        d = await self.get(dashboard_id)
        if d is None:
            return False
        await self._session.delete(d)
        await self._session.flush()
        return True


class WidgetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, widget_id: UUID) -> Optional[DashboardWidget]:
        return (
            await self._session.execute(
                select(DashboardWidget).where(DashboardWidget.id == widget_id)
            )
        ).scalar_one_or_none()

    async def list_for_dashboard(self, dashboard_id: UUID) -> list[DashboardWidget]:
        result = await self._session.execute(
            select(DashboardWidget)
            .where(DashboardWidget.dashboard_id == dashboard_id)
            .order_by(DashboardWidget.position.asc(), DashboardWidget.created_at.asc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        dashboard_id: UUID,
        title: str,
        sql: str,
        chart_config: Optional[dict] = None,
        widget_type: str = "chart",
    ) -> DashboardWidget:
        next_position = (
            await self._session.execute(
                select(func.coalesce(func.max(DashboardWidget.position), -1) + 1).where(
                    DashboardWidget.dashboard_id == dashboard_id
                )
            )
        ).scalar_one()
        w = DashboardWidget(
            dashboard_id=dashboard_id,
            title=title,
            sql=sql,
            chart_config=chart_config,
            widget_type=widget_type,
            position=int(next_position or 0),
        )
        self._session.add(w)
        await self._session.flush()
        return w

    async def update(
        self,
        widget_id: UUID,
        title: Optional[str] = None,
        sql: Optional[str] = None,
        chart_config: Optional[dict] = None,
        position: Optional[int] = None,
    ) -> Optional[DashboardWidget]:
        w = await self.get(widget_id)
        if w is None:
            return None
        if title is not None:
            w.title = title
        if sql is not None:
            w.sql = sql
        if chart_config is not None:
            w.chart_config = chart_config
        if position is not None:
            w.position = position
        await self._session.flush()
        return w

    async def delete(self, widget_id: UUID) -> bool:
        result = await self._session.execute(
            delete(DashboardWidget).where(DashboardWidget.id == widget_id)
        )
        return result.rowcount > 0  # type: ignore[return-value]
