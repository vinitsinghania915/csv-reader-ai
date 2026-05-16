from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from config import get_settings
from exceptions import WorkspaceNotFoundError
from models.user import User
from repos.chat_repo import ConversationRepository
from repos.workspace_repo import WorkspaceRepository
from schemas.chat import ChatRequest, ChatResponse, ConversationSummary
from services.chat_service import ChatService
from services.llm_service import LLMService
from services.query_engine import QueryEngine
from utils.auth import get_current_user
from utils.database import get_db_session

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/workspaces/{workspace_id}/chat", tags=["chat"])

_query_engine = QueryEngine(parquet_base_path=settings.PARQUET_STORAGE_PATH)


async def _require_owned(workspace_id: str, user: User, session: AsyncSession) -> None:
    repo = WorkspaceRepository(session)
    ws = await repo.get(workspace_id)
    if ws is None or ws.user_id != user.id:
        try:
            wid = UUID(workspace_id)
        except ValueError:
            wid = UUID(int=0)
        raise WorkspaceNotFoundError(wid)


def get_chat_service(session: AsyncSession = Depends(get_db_session)) -> ChatService:
    llm = LLMService(api_key=settings.OPENAI_API_KEY)
    repo = ConversationRepository(session)
    return ChatService(llm_service=llm, query_engine=_query_engine, conversation_repo=repo)


@router.post("", response_model=ChatResponse)
async def submit_question(
    workspace_id: str,
    request: ChatRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    chat_svc: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    """Ask a natural language question against a workspace."""
    await _require_owned(workspace_id, user, session)
    logger.info("Chat request received", workspace=workspace_id, user_id=str(user.id))
    return await chat_svc.process_question(
        workspace_id=workspace_id,
        message=request.message,
        conversation_id=request.conversation_id,
    )


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    workspace_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ConversationSummary]:
    """Retrieve history of conversations for a given workspace."""
    await _require_owned(workspace_id, user, session)
    repo = ConversationRepository(session)
    conversations = await repo.list_by_workspace(workspace_id)

    return [
        ConversationSummary(
            id=c.id,
            title=c.title,
            last_message="",
            created_at=c.created_at,
        )
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    workspace_id: str,
    conversation_id: UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    """Return a conversation with all its messages (for rehydrating chat UI)."""
    await _require_owned(workspace_id, user, session)
    repo = ConversationRepository(session)
    conv = await repo.get_conversation(conversation_id)
    if conv is None or conv.workspace_id != workspace_id:
        return {"id": None, "messages": []}
    messages = sorted(conv.messages, key=lambda m: m.created_at)
    return {
        "id": str(conv.id),
        "title": conv.title,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "sql": m.sql_executed,
                "chart_config": m.chart_config,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }
