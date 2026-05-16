"""Dashboard API routes — persisted, auto-refreshing views of pinned queries."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from exceptions import AppError, WorkspaceNotFoundError
from models.user import User
from repos.dashboard_repo import DashboardRepository, WidgetRepository
from repos.workspace_repo import WorkspaceRepository
from services.query_engine import QueryEngine
from utils.auth import get_current_user
from utils.database import get_db_session

logger = structlog.get_logger()
settings = get_settings()

router = APIRouter(tags=["dashboards"])

_query_engine = QueryEngine(parquet_base_path=settings.PARQUET_STORAGE_PATH)


async def _require_owned_workspace(
    workspace_id: str, user: User, session: AsyncSession
) -> None:
    repo = WorkspaceRepository(session)
    ws = await repo.get(workspace_id)
    if ws is None or ws.user_id != user.id:
        try:
            wid = UUID(workspace_id)
        except ValueError:
            wid = UUID(int=0)
        raise WorkspaceNotFoundError(wid)


async def _require_owned_dashboard(
    dashboard_id: UUID, user: User, session: AsyncSession
):
    d_repo = DashboardRepository(session)
    d = await d_repo.get(dashboard_id)
    if d is None:
        raise AppError(message="Dashboard not found.", code="DASHBOARD_NOT_FOUND", status_code=404)
    await _require_owned_workspace(d.workspace_id, user, session)
    return d


async def _require_owned_widget(
    widget_id: UUID, user: User, session: AsyncSession
):
    w_repo = WidgetRepository(session)
    w = await w_repo.get(widget_id)
    if w is None:
        raise AppError(message="Widget not found.", code="WIDGET_NOT_FOUND", status_code=404)
    d = await _require_owned_dashboard(w.dashboard_id, user, session)
    return w, d


# ── Schemas ─────────────────────────────────────────────────────────────


class CreateDashboardRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class RenameDashboardRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class CreateWidgetRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    sql: str = Field(..., min_length=1)
    chart_config: Optional[dict] = None
    widget_type: str = Field(default="chart")


class UpdateWidgetRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    sql: Optional[str] = None
    chart_config: Optional[dict] = None
    position: Optional[int] = None


# ── Workspace-scoped dashboard CRUD ─────────────────────────────────────


@router.get("/workspaces/{workspace_id}/dashboards")
async def list_dashboards(
    workspace_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, list[dict[str, object]]]:
    await _require_owned_workspace(workspace_id, user, session)
    repo = DashboardRepository(session)
    items = await repo.list_for_workspace(workspace_id)
    return {
        "dashboards": [
            {
                "id": str(d.id),
                "name": d.name,
                "created_at": d.created_at.isoformat(),
                "updated_at": d.updated_at.isoformat(),
            }
            for d in items
        ]
    }


@router.post("/workspaces/{workspace_id}/dashboards")
async def create_dashboard(
    workspace_id: str,
    req: CreateDashboardRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    await _require_owned_workspace(workspace_id, user, session)
    repo = DashboardRepository(session)
    d = await repo.create(workspace_id=workspace_id, name=req.name)
    return {"id": str(d.id), "name": d.name, "workspace_id": workspace_id}


@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(
    dashboard_id: UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    d = await _require_owned_dashboard(dashboard_id, user, session)
    w_repo = WidgetRepository(session)
    widgets = await w_repo.list_for_dashboard(dashboard_id)
    return {
        "id": str(d.id),
        "name": d.name,
        "workspace_id": d.workspace_id,
        "created_at": d.created_at.isoformat(),
        "updated_at": d.updated_at.isoformat(),
        "widgets": [
            {
                "id": str(w.id),
                "title": w.title,
                "widget_type": w.widget_type,
                "sql": w.sql,
                "chart_config": w.chart_config,
                "position": w.position,
            }
            for w in widgets
        ],
    }


@router.patch("/dashboards/{dashboard_id}")
async def rename_dashboard(
    dashboard_id: UUID,
    req: RenameDashboardRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    await _require_owned_dashboard(dashboard_id, user, session)
    repo = DashboardRepository(session)
    d = await repo.rename(dashboard_id, req.name)
    return {"id": str(d.id), "name": d.name}  # type: ignore[union-attr]


@router.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    await _require_owned_dashboard(dashboard_id, user, session)
    repo = DashboardRepository(session)
    ok = await repo.delete(dashboard_id)
    return {"deleted": ok}


# ── Widget CRUD ─────────────────────────────────────────────────────────


@router.post("/dashboards/{dashboard_id}/widgets")
async def add_widget(
    dashboard_id: UUID,
    req: CreateWidgetRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    await _require_owned_dashboard(dashboard_id, user, session)
    repo = WidgetRepository(session)
    w = await repo.create(
        dashboard_id=dashboard_id,
        title=req.title,
        sql=req.sql,
        chart_config=req.chart_config,
        widget_type=req.widget_type,
    )
    return {
        "id": str(w.id),
        "dashboard_id": str(w.dashboard_id),
        "title": w.title,
        "widget_type": w.widget_type,
        "position": w.position,
    }


@router.patch("/widgets/{widget_id}")
async def update_widget(
    widget_id: UUID,
    req: UpdateWidgetRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    await _require_owned_widget(widget_id, user, session)
    repo = WidgetRepository(session)
    w = await repo.update(
        widget_id,
        title=req.title,
        sql=req.sql,
        chart_config=req.chart_config,
        position=req.position,
    )
    return {
        "id": str(w.id),  # type: ignore[union-attr]
        "title": w.title,  # type: ignore[union-attr]
        "sql": w.sql,  # type: ignore[union-attr]
    }


@router.delete("/widgets/{widget_id}")
async def delete_widget(
    widget_id: UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    await _require_owned_widget(widget_id, user, session)
    repo = WidgetRepository(session)
    ok = await repo.delete(widget_id)
    return {"deleted": ok}


@router.get("/widgets/{widget_id}/data")
async def get_widget_data(
    widget_id: UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    """Execute the widget's SQL against its dashboard's workspace. Hot path for
    dashboard rendering — no LLM involved."""
    widget, dashboard = await _require_owned_widget(widget_id, user, session)
    _query_engine.refresh_tables(dashboard.workspace_id)
    result = await _query_engine.execute_safe(dashboard.workspace_id, widget.sql)
    return {
        "widget_id": str(widget.id),
        "title": widget.title,
        "chart_config": widget.chart_config,
        "data": result.get("data", []),
        "columns": result.get("columns", []),
        "execution_time_ms": result.get("execution_time_ms", 0),
    }
