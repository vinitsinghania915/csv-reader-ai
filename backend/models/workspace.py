from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class Relationship(Base):
    """Tracks visual joins between tables across multiple sources in a workspace."""
    __tablename__ = "relationships"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    table_a: Mapped[str] = mapped_column(String(100), nullable=False)
    column_a: Mapped[str] = mapped_column(String(100), nullable=False)
    
    table_b: Mapped[str] = mapped_column(String(100), nullable=False)
    column_b: Mapped[str] = mapped_column(String(100), nullable=False)
    
    join_type: Mapped[str] = mapped_column(String(20), default="INNER")
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
