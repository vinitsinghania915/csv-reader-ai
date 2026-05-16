from __future__ import annotations

from datetime import datetime

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class TableSource(Base):
    """Per-table provenance: where the data in `{workspace}/{table}.parquet` came from.

    Enables source-type icons in the UI and drives re-sync for cloud connectors
    (Google Sheets today, others later).
    """

    __tablename__ = "table_sources"

    workspace_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    table_name: Mapped[str] = mapped_column(String(200), primary_key=True)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)  # csv/tsv/excel/google_sheets
    origin: Mapped[str] = mapped_column(Text, nullable=True)  # original filename or sheet URL
    spreadsheet_id: Mapped[str] = mapped_column(String(200), nullable=True)
    tab_title: Mapped[str] = mapped_column(String(200), nullable=True)
    last_synced_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
