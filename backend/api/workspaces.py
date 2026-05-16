"""Workspace API routes — CRUD for workspaces and table access.

All routes require authentication. Ownership is enforced: a user can only
see workspaces they own.
"""

from pathlib import Path
from uuid import UUID
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from exceptions import AppError, WorkspaceNotFoundError
from models.user import User
from repos.relationship_repo import RelationshipRepository
from repos.table_source_repo import TableSourceRepository
from repos.workspace_repo import WorkspaceRepository
from schemas.workspace import RelationshipCreateRequest, RelationshipInfo
from services.query_engine import QueryEngine
from utils.auth import get_current_user
from utils.database import get_db_session

logger = structlog.get_logger()
settings = get_settings()

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

_query_engine = QueryEngine(parquet_base_path=settings.PARQUET_STORAGE_PATH)


async def _require_owned_workspace(
    workspace_id: str, user: User, session: AsyncSession
) -> None:
    """404 if the workspace doesn't exist; 404 (not 403) if the user doesn't own it.

    Returning 404 in both cases avoids leaking existence to other users.
    """
    repo = WorkspaceRepository(session)
    ws = await repo.get(workspace_id)
    if ws is None or ws.user_id != user.id:
        try:
            wid = UUID(workspace_id)
        except ValueError:
            wid = UUID(int=0)
        raise WorkspaceNotFoundError(wid)


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class RenameWorkspaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


@router.get("")
async def list_workspaces(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, list[dict[str, object]]]:
    """List every workspace the current user owns."""
    repo = WorkspaceRepository(session)
    base = Path(settings.PARQUET_STORAGE_PATH)
    out: list[dict[str, object]] = []
    for ws in await repo.list_for_user(user.id):
        parquet_count = 0
        ws_dir = base / ws.id
        if ws_dir.exists():
            parquet_count = len(list(ws_dir.glob("*.parquet")))
        out.append(
            {
                "id": ws.id,
                "name": ws.name,
                "table_count": parquet_count,
                "created_at": ws.created_at.isoformat(),
                "updated_at": ws.updated_at.isoformat(),
            }
        )
    return {"workspaces": out}


@router.post("")
async def create_workspace(
    req: CreateWorkspaceRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    repo = WorkspaceRepository(session)
    ws = await repo.create(user_id=user.id, name=req.name)
    return {"id": ws.id, "name": ws.name, "created_at": ws.created_at.isoformat()}


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    await _require_owned_workspace(workspace_id, user, session)
    repo = WorkspaceRepository(session)
    ws = await repo.get(workspace_id)
    _query_engine.refresh_tables(workspace_id)
    table_names = _query_engine.get_table_names(workspace_id)

    tables = []
    for name in table_names:
        preview = _query_engine.get_table_preview(workspace_id, name, rows=0)
        tables.append(
            {
                "name": name,
                "total_rows": preview["total_rows"],
                "columns": preview["columns"],
            }
        )

    return {
        "id": workspace_id,
        "name": ws.name if ws else workspace_id,
        "tables": tables,
    }


@router.patch("/{workspace_id}")
async def rename_workspace(
    workspace_id: str,
    req: RenameWorkspaceRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    await _require_owned_workspace(workspace_id, user, session)
    repo = WorkspaceRepository(session)
    ws = await repo.rename(workspace_id, req.name)
    return {"id": ws.id, "name": ws.name}  # type: ignore[union-attr]


@router.get("/{workspace_id}/tables")
async def list_tables(
    workspace_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, list[dict[str, object]]]:
    await _require_owned_workspace(workspace_id, user, session)

    _query_engine.refresh_tables(workspace_id)
    table_names = _query_engine.get_table_names(workspace_id)

    source_repo = TableSourceRepository(session)
    sources = {s.table_name: s for s in await source_repo.list_by_workspace(workspace_id)}

    tables = []
    for name in table_names:
        preview = _query_engine.get_table_preview(workspace_id, name, rows=0)
        source = sources.get(name)
        tables.append(
            {
                "name": name,
                "total_rows": preview["total_rows"],
                "column_count": len(preview["columns"]),
                "source_type": source.source_type if source else "csv",
                "origin": source.origin if source else None,
                "last_synced_at": source.last_synced_at.isoformat() if source else None,
                "resyncable": bool(
                    source
                    and source.source_type == "google_sheets"
                    and source.spreadsheet_id
                    and source.tab_title
                ),
            }
        )
    return {"tables": tables}


@router.get("/{workspace_id}/tables/{table_name}")
async def get_table_preview(
    workspace_id: str,
    table_name: str,
    rows: int = Query(default=100, ge=1, le=1000),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    await _require_owned_workspace(workspace_id, user, session)

    _query_engine.refresh_tables(workspace_id)
    preview = _query_engine.get_table_preview(workspace_id, table_name, rows=rows)

    return {
        "name": table_name,
        "columns": preview["columns"],
        "data": preview["data"],
        "total_rows": preview["total_rows"],
    }


@router.post("/{workspace_id}/query")
async def execute_query(
    workspace_id: str,
    body: dict[str, str],
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    await _require_owned_workspace(workspace_id, user, session)

    sql = body.get("sql", "")
    if not sql.strip():
        raise ValueError("SQL query is required")

    _query_engine.refresh_tables(workspace_id)
    result = await _query_engine.execute_safe(workspace_id, sql)
    return result


@router.get("/{workspace_id}/relationships", response_model=list[RelationshipInfo])
async def get_relationships(
    workspace_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[RelationshipInfo]:
    await _require_owned_workspace(workspace_id, user, session)
    repo = RelationshipRepository(session)
    rels = await repo.list_by_workspace(workspace_id)
    return [
        RelationshipInfo(
            id=r.id,
            table_a=r.table_a,
            column_a=r.column_a,
            table_b=r.table_b,
            column_b=r.column_b,
            join_type=r.join_type,
        )
        for r in rels
    ]


@router.post("/{workspace_id}/relationships", response_model=RelationshipInfo)
async def create_relationship(
    workspace_id: str,
    req: RelationshipCreateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> RelationshipInfo:
    await _require_owned_workspace(workspace_id, user, session)
    repo = RelationshipRepository(session)
    r = await repo.add_relationship(
        workspace_id=workspace_id,
        table_a=req.table_a,
        column_a=req.column_a,
        table_b=req.table_b,
        column_b=req.column_b,
        join_type=req.join_type.value,
    )
    return RelationshipInfo(
        id=r.id,
        table_a=r.table_a,
        column_a=r.column_a,
        table_b=r.table_b,
        column_b=r.column_b,
        join_type=r.join_type,
    )
