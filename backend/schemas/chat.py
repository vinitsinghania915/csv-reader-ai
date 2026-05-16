"""Pydantic schemas for chat request/response contracts."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class ChartType(str, Enum):
    """Supported chart types for auto-visualization."""

    BAR = "bar"
    LINE = "line"
    PIE = "pie"
    SCATTER = "scatter"
    AREA = "area"


# ── Chat ────────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    """Request to send a natural language question."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="User's natural language question",
    )
    conversation_id: UUID | None = Field(
        None,
        description="Existing conversation to continue. None starts a new conversation.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "message": "What are the top 5 products by revenue?",
                "conversation_id": None,
            }
        }
    }


class ChartConfig(BaseModel):
    """Chart configuration returned by the LLM for auto-visualization."""

    chart_type: ChartType
    x_axis: str
    y_axis: str
    title: str
    color: str | None = None


class ChatResponse(BaseModel):
    """Response for a chat message — includes answer, SQL, data, and chart config."""

    answer: str
    sql: str
    data: list[dict[str, object]] | None = None
    chart_config: ChartConfig | None = None
    conversation_id: UUID
    execution_time_ms: int = 0


# ── Conversation History ────────────────────────────────────────────────


class MessageRole(str, Enum):
    """Message role in a conversation."""

    USER = "user"
    ASSISTANT = "assistant"


class ConversationMessage(BaseModel):
    """A single message in a conversation."""

    role: MessageRole
    content: str
    sql: str | None = None
    data: list[dict[str, object]] | None = None
    chart_config: ChartConfig | None = None
    created_at: datetime


class ConversationSummary(BaseModel):
    """Lightweight conversation info for list views."""

    id: UUID
    title: str
    last_message: str
    message_count: int = 0
    created_at: datetime


class ConversationDetail(BaseModel):
    """Full conversation with all messages."""

    id: UUID
    title: str
    messages: list[ConversationMessage] = Field(default_factory=list)
    created_at: datetime


# ── Suggestions ─────────────────────────────────────────────────────────


class SuggestionsResponse(BaseModel):
    """AI-generated suggested questions based on the workspace schema."""

    suggestions: list[str] = Field(default_factory=list, max_length=10)


# ── Raw Query ───────────────────────────────────────────────────────────


class RawQueryRequest(BaseModel):
    """Request to execute raw SQL (advanced users)."""

    sql: str = Field(..., min_length=1, max_length=10000)


class RawQueryResponse(BaseModel):
    """Response for a raw SQL query."""

    columns: list[str]
    data: list[dict[str, object]]
    row_count: int
    execution_time_ms: int
