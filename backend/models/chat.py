from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional
import uuid

from sqlalchemy import JSON, String, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class Conversation(Base):
    """A chat session within a workspace."""
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), default="New Conversation")
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    
    # Relationships
    messages: Mapped[list[Message]] = relationship(
        "Message", 
        back_populates="conversation", 
        cascade="all, delete-orphan",
        order_by="Message.created_at.asc()"
    )


class Message(Base):
    """A single chat message from either user or system (LLM)."""
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), 
        index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' or 'system' / 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Extended context specific to LLM / AI outputs
    sql_executed: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    chart_config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    # the execution_data should ideallly be transient to avoid inflating SQLite DB
    # but we will store small sample arrays or ignore saving massive JSONs for now.
    
    created_at: Mapped[datetime] = mapped_column(default=utc_now)

    conversation: Mapped[Conversation] = relationship(
        "Conversation", 
        back_populates="messages"
    )
