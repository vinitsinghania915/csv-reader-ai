"""Pydantic schemas for upload request/response contracts."""

from __future__ import annotations

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class SourceType(str, Enum):
    """Data source type identifier."""

    CSV = "csv"
    TSV = "tsv"
    EXCEL = "excel"
    GOOGLE_SHEETS = "google_sheets"


class ColumnDType(str, Enum):
    """Column data type enum for schema display."""

    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    UNKNOWN = "unknown"


# ── Column & Table Schemas ──────────────────────────────────────────────


class ColumnStats(BaseModel):
    """Statistical summary for a single column."""

    null_count: int = 0
    unique_count: int = 0
    min_value: str | None = None
    max_value: str | None = None
    mean_value: float | None = None
    sample_values: list[str] = Field(default_factory=list, max_length=5)


class ColumnSchema(BaseModel):
    """Schema definition for a single column."""

    name: str
    dtype: ColumnDType
    stats: ColumnStats = Field(default_factory=ColumnStats)


class TableInfo(BaseModel):
    """Metadata for a single ingested table."""

    name: str
    columns: list[ColumnSchema]
    row_count: int
    source_type: SourceType
    file_size_bytes: int = 0
    parquet_path: str = ""


# ── Upload Schemas ──────────────────────────────────────────────────────


class UploadResponse(BaseModel):
    """Response after a successful direct (small file) upload."""

    workspace_id: UUID
    tables: list[TableInfo]


class ChunkInitRequest(BaseModel):
    """Request to initialize a chunked upload."""

    filename: str = Field(..., min_length=1, max_length=255)
    file_size: int = Field(..., gt=0, description="Total file size in bytes")
    workspace_id: UUID


class ChunkInitResponse(BaseModel):
    """Response after initializing a chunked upload."""

    upload_id: UUID
    chunk_size: int = 5_242_880  # 5 MB


class ChunkUploadResponse(BaseModel):
    """Response after receiving a single chunk."""

    chunk_index: int
    received: bool = True


class ChunkFinalizeRequest(BaseModel):
    """Request to finalize a chunked upload and trigger ingestion."""

    upload_id: UUID


class UploadStatus(str, Enum):
    """Status of a file upload/ingestion."""

    UPLOADING = "uploading"
    PROCESSING = "processing"
    COMPLETE = "complete"
    ERROR = "error"


class UploadStatusResponse(BaseModel):
    """Response for polling upload/ingestion status."""

    status: UploadStatus
    progress: float = Field(0.0, ge=0.0, le=1.0)
    tables: list[TableInfo] | None = None
    error_message: str | None = None
