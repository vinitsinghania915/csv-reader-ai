from __future__ import annotations

import uuid
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.chat import Conversation, Message
from schemas.chat import ChartConfig, MessageRole


class ConversationRepository:
    """Data access layer for Conversations and Messages."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_conversation(self, conversation_id: UUID) -> Conversation | None:
        """Fetch conversation and all associated messages."""
        stmt = (
            select(Conversation)
            .where(Conversation.id == conversation_id)
            .options(selectinload(Conversation.messages))
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_conversation(self, workspace_id: str, title: str) -> Conversation:
        """Create a new conversation session."""
        conversation = Conversation(workspace_id=workspace_id, title=title)
        self._session.add(conversation)
        await self._session.flush()
        return conversation

    async def add_message(
        self,
        conversation_id: UUID,
        role: MessageRole,
        content: str,
        sql: str | None = None,
        chart_config: ChartConfig | None = None,
    ) -> Message:
        """Push a new message to an existing conversation."""
        config_dict = None
        if chart_config:
            config_dict = chart_config.model_dump()
            
        message = Message(
            conversation_id=conversation_id,
            role=role.value,
            content=content,
            sql_executed=sql,
            chart_config=config_dict,
        )
        self._session.add(message)
        await self._session.flush()
        return message

    async def list_by_workspace(self, workspace_id: str) -> list[Conversation]:
        """Get all historical conversations for a given workspace context."""
        stmt = (
            select(Conversation)
            .where(Conversation.workspace_id == workspace_id)
            .order_by(Conversation.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
