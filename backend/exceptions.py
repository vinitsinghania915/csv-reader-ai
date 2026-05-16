"""Custom exception hierarchy — structured, typed, consistent error handling.

All application errors extend AppError, which is caught by the global
exception handler in main.py and returned as a JSON response with
a stable error code and human-readable message.
"""

from __future__ import annotations

from uuid import UUID


class AppError(Exception):
    """Base exception for all application errors."""

    def __init__(
        self,
        message: str,
        code: str,
        status_code: int = 500,
    ) -> None:
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


# ── File Validation ─────────────────────────────────────────────────────


class FileValidationError(AppError):
    """Raised when an uploaded file fails validation."""

    def __init__(self, reason: str) -> None:
        super().__init__(
            message=f"File validation failed: {reason}",
            code="FILE_VALIDATION_ERROR",
            status_code=400,
        )


class FileTooLargeError(FileValidationError):
    """Raised when an uploaded file exceeds the size limit."""

    def __init__(self, size_mb: float, max_mb: float = 2048) -> None:
        super().__init__(
            f"File size {size_mb:.0f}MB exceeds limit of {max_mb:.0f}MB",
        )


class UnsupportedFileTypeError(FileValidationError):
    """Raised when the file type is not supported."""

    SUPPORTED_TYPES = {".csv", ".tsv", ".xlsx", ".xls"}

    def __init__(self, file_type: str) -> None:
        supported = ", ".join(sorted(self.SUPPORTED_TYPES))
        super().__init__(
            f"Unsupported file type '{file_type}'. Supported: {supported}",
        )


# ── Resource Not Found ──────────────────────────────────────────────────


class WorkspaceNotFoundError(AppError):
    """Raised when a workspace does not exist."""

    def __init__(self, workspace_id: UUID) -> None:
        super().__init__(
            message=f"Workspace '{workspace_id}' not found",
            code="WORKSPACE_NOT_FOUND",
            status_code=404,
        )


class TableNotFoundError(AppError):
    """Raised when a table does not exist in the workspace."""

    def __init__(self, table_name: str, workspace_id: UUID) -> None:
        super().__init__(
            message=f"Table '{table_name}' not found in workspace '{workspace_id}'",
            code="TABLE_NOT_FOUND",
            status_code=404,
        )


class ConversationNotFoundError(AppError):
    """Raised when a conversation does not exist."""

    def __init__(self, conversation_id: UUID) -> None:
        super().__init__(
            message=f"Conversation '{conversation_id}' not found",
            code="CONVERSATION_NOT_FOUND",
            status_code=404,
        )


# ── Ingestion ───────────────────────────────────────────────────────────


class IngestionError(AppError):
    """Raised when file ingestion (CSV/Excel → Parquet) fails."""

    def __init__(self, filename: str, reason: str) -> None:
        super().__init__(
            message=f"Failed to ingest '{filename}': {reason}",
            code="INGESTION_ERROR",
            status_code=422,
        )


# ── Query ───────────────────────────────────────────────────────────────


class QueryExecutionError(AppError):
    """Raised when a DuckDB query fails."""

    def __init__(self, reason: str, sql: str | None = None) -> None:
        detail = f"Query execution failed: {reason}"
        if sql:
            detail += f" | SQL: {sql[:200]}"
        super().__init__(
            message=detail,
            code="QUERY_EXECUTION_ERROR",
            status_code=422,
        )


# ── LLM ─────────────────────────────────────────────────────────────────


class LLMProviderError(AppError):
    """Raised when the LLM provider returns an error."""

    def __init__(self, provider: str, reason: str) -> None:
        super().__init__(
            message=f"LLM provider '{provider}' error: {reason}",
            code="LLM_PROVIDER_ERROR",
            status_code=502,
        )


class LLMKeyNotConfiguredError(AppError):
    """Raised when no API key is configured for the selected LLM provider."""

    def __init__(self, provider: str) -> None:
        super().__init__(
            message=f"No API key configured for '{provider}'. Add one in Settings.",
            code="LLM_KEY_NOT_CONFIGURED",
            status_code=400,
        )


# ── Auth ────────────────────────────────────────────────────────────────


class AuthenticationError(AppError):
    """Raised when authentication fails."""

    def __init__(self, reason: str = "Invalid or expired token") -> None:
        super().__init__(
            message=reason,
            code="AUTHENTICATION_ERROR",
            status_code=401,
        )
