"""Connector routes — non-file data sources (Google Sheets, later Airtable, etc.).

Mirrors the /upload response shape so the frontend can treat all sources
uniformly after ingestion.
"""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from exceptions import AppError, WorkspaceNotFoundError
from models.user import User
from repos.table_source_repo import TableSourceRepository
from repos.workspace_repo import WorkspaceRepository
from schemas.upload import UploadResponse
from services.google_oauth_service import load_credentials
from services.ingestion.gsheet_adapter import (
    GoogleSheetsAdapter,
    _safe_table_name,
    extract_spreadsheet_id,
)
from utils.auth import get_current_user
from utils.database import get_db_session

logger = structlog.get_logger()
settings = get_settings()

router = APIRouter(prefix="/connectors/gsheet", tags=["connectors"])


async def _resolve_workspace(
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


class GSheetDiscoverRequest(BaseModel):
    workspace_id: str = Field(..., min_length=1)
    spreadsheet_url: str = Field(..., min_length=10)


class GSheetTabInfo(BaseModel):
    title: str


class GSheetDiscoverResponse(BaseModel):
    spreadsheet_id: str
    title: str
    tabs: list[GSheetTabInfo]


class GSheetImportRequest(BaseModel):
    workspace_id: str = Field(..., min_length=1)
    spreadsheet_url: str = Field(..., min_length=10)
    tabs: list[str] | None = Field(
        default=None,
        description="Which tabs to import. None = all tabs.",
    )


@router.post("/discover", response_model=GSheetDiscoverResponse)
async def discover_tabs(
    req: GSheetDiscoverRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> GSheetDiscoverResponse:
    """List all tabs in a spreadsheet. Uses the caller's Google credentials."""
    await _resolve_workspace(req.workspace_id, user, session)
    creds = await load_credentials(session, user.id)
    spreadsheet_id = extract_spreadsheet_id(req.spreadsheet_url)
    adapter = GoogleSheetsAdapter(creds, spreadsheet_id)
    meta = adapter._fetch_metadata()  # noqa: SLF001
    return GSheetDiscoverResponse(
        spreadsheet_id=spreadsheet_id,
        title=meta.get("properties", {}).get("title", spreadsheet_id),
        tabs=[GSheetTabInfo(title=t) for t in adapter.detect_tables()],
    )


@router.post("/import", response_model=UploadResponse)
async def import_sheet(
    req: GSheetImportRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> UploadResponse:
    """Ingest selected tabs from a Google Sheet into the workspace."""
    await _resolve_workspace(req.workspace_id, user, session)
    creds = await load_credentials(session, user.id)
    spreadsheet_id = extract_spreadsheet_id(req.spreadsheet_url)

    adapter = GoogleSheetsAdapter(creds, spreadsheet_id)
    workspace_path = Path(settings.PARQUET_STORAGE_PATH) / req.workspace_id

    selected = req.tabs or adapter.detect_tables()
    title_by_safe: dict[str, str] = {_safe_table_name(t): t for t in selected}

    tables = await adapter.ingest(workspace_path, selected_tabs=req.tabs)

    source_repo = TableSourceRepository(session)
    for t in tables:
        await source_repo.upsert(
            workspace_id=req.workspace_id,
            table_name=t.name,
            source_type=t.source_type.value,
            origin=req.spreadsheet_url,
            spreadsheet_id=spreadsheet_id,
            tab_title=title_by_safe.get(t.name),
        )
    await WorkspaceRepository(session).touch(req.workspace_id)

    logger.info(
        "Google Sheet imported",
        workspace=req.workspace_id,
        spreadsheet=spreadsheet_id,
        tables=len(tables),
    )
    return UploadResponse(workspace_id=UUID(req.workspace_id), tables=tables)


class GSheetResyncResponse(BaseModel):
    workspace_id: str
    table_name: str
    row_count: int
    last_synced_at: str


@router.post("/{table_name}/resync", response_model=GSheetResyncResponse)
async def resync_sheet(
    table_name: str,
    workspace_id: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> GSheetResyncResponse:
    """Re-pull the latest rows for a previously-imported Google Sheet tab."""
    await _resolve_workspace(workspace_id, user, session)

    source_repo = TableSourceRepository(session)
    row = await source_repo.get(workspace_id, table_name)
    if row is None or row.source_type != "google_sheets":
        raise AppError(
            message=f"Table '{table_name}' is not a Google Sheet in this workspace.",
            code="RESYNC_NOT_APPLICABLE",
            status_code=400,
        )
    if not row.spreadsheet_id or not row.tab_title:
        raise AppError(
            message="Missing spreadsheet_id or tab_title on table source record — cannot resync.",
            code="RESYNC_METADATA_MISSING",
            status_code=409,
        )

    creds = await load_credentials(session, user.id)
    adapter = GoogleSheetsAdapter(creds, row.spreadsheet_id)
    workspace_path = Path(settings.PARQUET_STORAGE_PATH) / workspace_id
    tables = await adapter.ingest(workspace_path, selected_tabs=[row.tab_title])

    if not tables:
        raise AppError(
            message=f"Tab '{row.tab_title}' returned no rows — nothing synced.",
            code="RESYNC_EMPTY",
            status_code=422,
        )

    updated = tables[0]
    await source_repo.touch_synced(workspace_id, table_name)
    await WorkspaceRepository(session).touch(workspace_id)
    refreshed = await source_repo.get(workspace_id, table_name)

    logger.info(
        "Google Sheet resynced",
        workspace=workspace_id,
        table=table_name,
        rows=updated.row_count,
    )
    return GSheetResyncResponse(
        workspace_id=workspace_id,
        table_name=table_name,
        row_count=updated.row_count,
        last_synced_at=(refreshed.last_synced_at if refreshed else row.last_synced_at).isoformat(),
    )
