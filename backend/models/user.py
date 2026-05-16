from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class User(Base):
    """Authenticated end-user. Created on first Google sign-in."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    google_sub: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    last_login_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)


class Workspace(Base):
    """A user-owned container for uploaded tables.

    The canonical identifier used in URLs and on-disk paths is `id` (UUID str).
    Parquet files live under `data/parquets/<id>/*.parquet`.
    """

    __tablename__ = "workspaces_v2"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)
