from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


def utc_now() -> datetime:
    """Helper for timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)
