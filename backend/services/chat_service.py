from __future__ import annotations

import uuid
from typing import Any

import structlog

from exceptions import WorkspaceNotFoundError
from repos.chat_repo import ConversationRepository
from schemas.chat import ChatResponse, MessageRole
from services.llm_service import LLMService
from services.query_engine import QueryEngine

logger = structlog.get_logger()


class ChatService:
    """Orchestrates the natural language → SQL → result formatting pipeline."""

    def __init__(
        self,
        llm_service: LLMService,
        query_engine: QueryEngine,
        conversation_repo: ConversationRepository,
    ) -> None:
        self._llm = llm_service
        self._query_engine = query_engine
        self._conversations = conversation_repo
        
        # We handle relationship_repo dynamically to prevent massive constructor rewrites elsewhere for now
        from repos.relationship_repo import RelationshipRepository
        # We instantiate a transient repo using the conversation_repo's session so they share the connection
        self._relationships = RelationshipRepository(self._conversations._session)


    async def _build_schema_context_str(self, workspace_id: str) -> str:
        """Fetch tables and schemas from DuckDB and format into text for LLM."""
        table_names = self._query_engine.get_table_names(workspace_id)
        if not table_names:
            raise WorkspaceNotFoundError(uuid.UUID(workspace_id) if len(workspace_id) == 36 else uuid.UUID(int=0))

        context_lines = []
        for name in table_names:
            preview = self._query_engine.get_table_preview(workspace_id, name, rows=0)
            col_names = ", ".join(preview["columns"])
            context_lines.append(f"Table: {name}")
            context_lines.append(f"Columns: {col_names}")
            context_lines.append(f"Total Rows: {preview['total_rows']}\n")
            
        # Also fetch relationships if they exist
        rels = await self._relationships.list_by_workspace(workspace_id)
        if rels:
             context_lines.append("\nKnown Logical Relationships (Use these for JOIN clauses):")
             for r in rels:
                 context_lines.append(f"- {r.table_a}.{r.column_a} is linked to {r.table_b}.{r.column_b} (Suggested {r.join_type} JOIN)")
                 
        return "\n".join(context_lines)

    async def process_question(
        self,
        workspace_id: str,
        message: str,
        conversation_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
    ) -> ChatResponse:
        """Process user query and return answer.

        Error-handling contract: we commit the conversation + the user message
        up-front so that a failure in the LLM or query stages still leaves a
        trace in history (and the user can re-open the conversation from the
        sidebar). On failure we also persist an assistant error message before
        re-raising, so the UI can show something meaningful next time.
        """
        log = logger.bind(workspace=workspace_id, conversation=conversation_id)

        # 1. Prepare conversation (or create new if None provided)
        if conversation_id is None:
            conv = await self._conversations.create_conversation(workspace_id, title=message[:50])
            conversation_id = conv.id
        else:
            conv = await self._conversations.get_conversation(conversation_id)
            if not conv:
                raise ValueError("Conversation not found")

        # 2. Add user message and commit now — so a later LLM failure doesn't
        #    roll this back. Any downstream persistence happens as a new txn.
        await self._conversations.add_message(
            conversation_id=conversation_id,
            role=MessageRole.USER,
            content=message,
        )
        await self._conversations._session.commit()

        try:
            # 3. Build schema context
            self._query_engine.refresh_tables(workspace_id)
            schema_context = await self._build_schema_context_str(workspace_id)

            # 4. Generate SQL from natural language
            sql_result = await self._llm.text_to_sql(
                question=message,
                schema_context=schema_context,
                dialect="duckdb",
            )

            # 5. Execute SQL safely
            query_result = await self._query_engine.execute_safe(
                workspace_id=workspace_id,
                sql=sql_result.sql,
            )

            # 6. Format response with LLM
            data_dicts: list[dict[str, Any]] = list(query_result["data"])  # type: ignore
            formatted = await self._llm.format_answer(
                question=message,
                sql=sql_result.sql,
                data=data_dicts,
            )

            # 7. Persist AI Assistant Response
            await self._conversations.add_message(
                conversation_id=conversation_id,
                role=MessageRole.ASSISTANT,
                content=formatted.answer,
                sql=sql_result.sql,
                chart_config=formatted.chart_config,
            )

            return ChatResponse(
                answer=formatted.answer,
                sql=sql_result.sql,
                data=data_dicts,
                chart_config=formatted.chart_config,
                conversation_id=conversation_id,
                execution_time_ms=query_result.get("execution_time_ms", 0),  # type: ignore
            )
        except Exception as exc:
            # Persist an error trace so the user sees it in history on reload.
            log.error("Chat pipeline failed", error=str(exc), error_type=type(exc).__name__)
            error_text = f"I couldn't answer that. ({type(exc).__name__}: {exc})"
            try:
                await self._conversations._session.rollback()
                await self._conversations.add_message(
                    conversation_id=conversation_id,
                    role=MessageRole.ASSISTANT,
                    content=error_text,
                )
                await self._conversations._session.commit()
            except Exception as persist_err:  # noqa: BLE001
                log.error("Failed to persist error message", error=str(persist_err))
            raise
