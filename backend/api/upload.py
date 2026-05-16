"""Upload API routes — handles file upload and ingestion.

Supports two modes:
    1. Direct upload (< 50 MB): Single POST with the file
    2. Chunked upload (≥ 50 MB): Init → upload chunks → finalize

Routes are THIN — they validate input, delegate to services, return response.
"""

from pathlib import Path
from uuid import UUID, uuid4
from typing import Optional, Union

import structlog
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from exceptions import FileTooLargeError, UnsupportedFileTypeError, WorkspaceNotFoundError
from models.user import User
from repos.table_source_repo import TableSourceRepository
from repos.workspace_repo import WorkspaceRepository
from schemas.upload import (
    ColumnSchema,
    SourceType,
    TableInfo,
    UploadResponse,
)
from services.ingestion.csv_adapter import CSVAdapter
from services.ingestion.excel_adapter import ExcelAdapter
from utils.auth import get_current_user
from utils.database import get_db_session

logger = structlog.get_logger()
settings = get_settings()

router = APIRouter(prefix="/upload", tags=["upload"])

# Supported file extensions
SUPPORTED_EXTENSIONS = {".csv", ".tsv", ".xlsx", ".xls"}


def _validate_file(filename: str, file_size: int) -> None:
    """Validate file type and size. Raises on failure (fail fast)."""
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise UnsupportedFileTypeError(ext)

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file_size > max_bytes:
        raise FileTooLargeError(
            size_mb=file_size / 1024 / 1024,
            max_mb=float(settings.MAX_UPLOAD_SIZE_MB),
        )


def _get_adapter(
    file_path: Path, table_name: Optional[str] = None
) -> Union[CSVAdapter, ExcelAdapter]:
    """Return the correct source adapter based on file extension.

    Principle: Factory pattern — single point for adapter selection.
    """
    ext = file_path.suffix.lower()
    if ext in {".csv", ".tsv"}:
        return CSVAdapter(file_path, table_name=table_name)
    if ext in {".xlsx", ".xls"}:
        return ExcelAdapter(file_path)
    raise UnsupportedFileTypeError(ext)


@router.post("", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    workspace_id: Optional[str] = Form(default=None),
    workspace_name: Optional[str] = Form(default=None),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> UploadResponse:
    """Upload a file and ingest it into a workspace owned by the current user.

    If `workspace_id` is omitted, a new workspace is created and returned.
    If `workspace_id` is provided but belongs to another user, returns 404.
    """
    if not file.filename:
        raise UnsupportedFileTypeError("(no filename)")

    log = logger.bind(filename=file.filename, user_id=str(user.id))

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Validate
    _validate_file(file.filename, file_size)

    # Resolve workspace: existing (owned by user) or freshly-created.
    ws_repo = WorkspaceRepository(session)
    if workspace_id:
        ws = await ws_repo.get(workspace_id)
        if ws is None or ws.user_id != user.id:
            raise WorkspaceNotFoundError(UUID(workspace_id) if len(workspace_id) == 36 else UUID(int=0))
        ws_id = ws.id
    else:
        default_name = workspace_name or Path(file.filename).stem or "New workspace"
        ws = await ws_repo.create(user_id=user.id, name=default_name)
        ws_id = ws.id
    log = log.bind(workspace_id=ws_id, size_mb=f"{file_size / 1024 / 1024:.1f}")

    # Save temp file
    temp_dir = Path("./data/temp")
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_path = temp_dir / f"{uuid4()}_{file.filename}"

    try:
        temp_path.write_bytes(content)
        log.info("File saved to temp")

        # Select adapter and ingest — preserve original filename as table name
        clean_table_name = Path(file.filename).stem
        adapter = _get_adapter(temp_path, table_name=clean_table_name)
        workspace_path = Path(settings.PARQUET_STORAGE_PATH) / ws_id

        tables = await adapter.ingest(workspace_path)
        log.info("Ingestion complete", tables=len(tables))

        source_repo = TableSourceRepository(session)
        for t in tables:
            await source_repo.upsert(
                workspace_id=ws_id,
                table_name=t.name,
                source_type=t.source_type.value,
                origin=file.filename,
            )
        await ws_repo.touch(ws_id)

        return UploadResponse(
            workspace_id=UUID(ws_id),
            tables=tables,
        )

    finally:
        # Always clean up temp file
        if temp_path.exists():
            temp_path.unlink()
            log.debug("Temp file cleaned up")
