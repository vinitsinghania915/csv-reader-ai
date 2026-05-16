from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class Dashboard(Base):
    """A saved collection of pinned charts/metrics scoped to a workspace."""

    __tablename__ = "dashboards"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)


class DashboardWidget(Base):
    """One pinned item on a dashboard: a saved SQL + chart config.

    `chart_config` follows the same shape as the chat-time `ChartConfig`
    schema (chart_type, x_axis, y_axis, title). For metric widgets it
    can be null and we just render the first column of the first row.
    """

    __tablename__ = "dashboard_widgets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("dashboards.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    widget_type: Mapped[str] = mapped_column(String(20), default="chart")  # chart | metric | table
    sql: Mapped[str] = mapped_column(Text, nullable=False)
    chart_config: Mapped[dict] = mapped_column(JSON, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)
