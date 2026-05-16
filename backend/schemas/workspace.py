"""Pydantic schemas for workspace request/response contracts."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field

from schemas.upload import TableInfo


# ── Workspace ───────────────────────────────────────────────────────────


class WorkspaceCreateRequest(BaseModel):
    """Request to create a new workspace."""

    name: str = Field(..., min_length=1, max_length=100, description="Workspace name")


class WorkspaceUpdateRequest(BaseModel):
    """Request to update workspace details."""

    name: str = Field(..., min_length=1, max_length=100)


class WorkspaceSummary(BaseModel):
    """Lightweight workspace info for list views."""

    id: UUID
    name: str
    table_count: int = 0
    created_at: datetime


class WorkspaceDetail(BaseModel):
    """Full workspace info with tables and relationships."""

    id: UUID
    name: str
    tables: list[TableInfo] = Field(default_factory=list)
    relationships: list[RelationshipInfo] = Field(default_factory=list)
    created_at: datetime


# ── Relationships ───────────────────────────────────────────────────────


class JoinType(str, Enum):
    """SQL join type."""

    INNER = "inner"
    LEFT = "left"
    RIGHT = "right"
    FULL = "full"


class RelationshipCreateRequest(BaseModel):
    """Request to create a relationship between two tables."""

    table_a: str = Field(..., description="Source table name")
    column_a: str = Field(..., description="Source column name")
    table_b: str = Field(..., description="Target table name")
    column_b: str = Field(..., description="Target column name")
    join_type: JoinType = JoinType.INNER


class RelationshipInfo(BaseModel):
    """Relationship metadata."""

    id: UUID
    table_a: str
    column_a: str
    table_b: str
    column_b: str
    join_type: JoinType


class RelationshipSuggestion(BaseModel):
    """Auto-suggested relationship based on column name/type matching."""

    table_a: str
    column_a: str
    table_b: str
    column_b: str
    confidence: float = Field(..., ge=0.0, le=1.0)


# Fix forward reference
from enum import Enum  # noqa: E402

WorkspaceDetail.model_rebuild()
