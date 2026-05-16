"""FastAPI application entry point.

Wires together all routes, middleware, exception handlers,
and startup/shutdown lifecycle events.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from exceptions import AppError

logger = structlog.get_logger()
settings = get_settings()


# ── Lifecycle ───────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and shutdown lifecycle."""
    logger.info(
        "Starting up",
        app=settings.APP_NAME,
        debug=settings.DEBUG,
        version=settings.API_VERSION,
    )

    # Ensure storage directories exist
    from pathlib import Path

    Path(settings.PARQUET_STORAGE_PATH).mkdir(parents=True, exist_ok=True)
    Path("./data").mkdir(parents=True, exist_ok=True)

    # Initialize sqlite persistence DB tables
    from utils.database import engine
    from models.base import Base
    import models.chat  # noqa: F401 - trigger registry
    import models.workspace # noqa: F401
    import models.oauth  # noqa: F401
    import models.table_source  # noqa: F401
    import models.user  # noqa: F401
    import models.dashboard  # noqa: F401
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    logger.info("Shutting down")


# ── App ─────────────────────────────────────────────────────────────────


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    description="Conversational data analytics platform — upload CSVs, Excel files, and talk to your data.",
    lifespan=lifespan,
)


# ── CORS ────────────────────────────────────────────────────────────────


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global Exception Handler ───────────────────────────────────────────


@app.exception_handler(AppError)
async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
    """Convert all AppError subclasses to structured JSON responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.code,
            "message": exc.message,
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unexpected errors — log and return 500."""
    logger.error("Unexpected error", error=str(exc), type=type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={
            "error": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred. Please try again.",
        },
    )


# ── Routes ──────────────────────────────────────────────────────────────


from api.auth import router as auth_router  # noqa: E402
from api.chat import router as chat_router  # noqa: E402
from api.connectors import router as connectors_router  # noqa: E402
from api.dashboards import router as dashboards_router  # noqa: E402
from api.upload import router as upload_router  # noqa: E402
from api.workspaces import router as workspaces_router  # noqa: E402

app.include_router(upload_router, prefix=f"/api/{settings.API_VERSION}")
app.include_router(workspaces_router, prefix=f"/api/{settings.API_VERSION}")
app.include_router(chat_router, prefix=f"/api/{settings.API_VERSION}")
app.include_router(auth_router, prefix=f"/api/{settings.API_VERSION}")
app.include_router(connectors_router, prefix=f"/api/{settings.API_VERSION}")
app.include_router(dashboards_router, prefix=f"/api/{settings.API_VERSION}")


# ── Health Check ────────────────────────────────────────────────────────


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    """Health check endpoint for deployment monitoring."""
    return {"status": "healthy", "app": settings.APP_NAME, "version": settings.API_VERSION}
