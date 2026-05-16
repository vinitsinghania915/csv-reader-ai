"""Google Sheets source adapter — Sheets API → Polars → Parquet.

Discovers every tab in a spreadsheet and writes one Parquet per tab,
mirroring the Excel adapter's semantics. Unlike CSV/Excel, this adapter
is constructed from Google OAuth credentials rather than a local path.

Polars infers types after the fact (all cell values come back as strings
from the Sheets API). For MVP this matches user expectations — we can
upgrade to a richer type-detection pass later.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import polars as pl
import structlog
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from exceptions import IngestionError
from schemas.upload import ColumnSchema, SourceType, TableInfo
from services.ingestion.base import SourceAdapter
from services.ingestion.csv_adapter import _extract_column_stats, _polars_dtype_to_column_dtype

logger = structlog.get_logger()

_SPREADSHEET_ID_RE = re.compile(r"/spreadsheets/d/([a-zA-Z0-9-_]+)")


def extract_spreadsheet_id(url_or_id: str) -> str:
    """Accept a full Sheets URL or a bare spreadsheet ID."""
    m = _SPREADSHEET_ID_RE.search(url_or_id)
    if m:
        return m.group(1)
    if re.fullmatch(r"[a-zA-Z0-9-_]{20,}", url_or_id):
        return url_or_id
    raise IngestionError(
        filename=url_or_id,
        reason="Could not parse a Google Spreadsheet ID from the provided value.",
    )


def _safe_table_name(name: str) -> str:
    """Sanitize a sheet tab name for use as a Parquet filename + SQL identifier."""
    cleaned = re.sub(r"[^A-Za-z0-9_]+", "_", name).strip("_")
    return cleaned or "sheet"


class GoogleSheetsAdapter(SourceAdapter):
    """Adapter for Google Sheets → Parquet conversion.

    Each tab (worksheet) becomes one Parquet file — same as the Excel adapter.
    """

    def __init__(self, credentials: Credentials, spreadsheet_id: str) -> None:
        self._creds = credentials
        self._spreadsheet_id = spreadsheet_id
        self._sheets_api = build("sheets", "v4", credentials=credentials, cache_discovery=False)
        self._metadata: dict | None = None

    def _fetch_metadata(self) -> dict:
        if self._metadata is None:
            try:
                self._metadata = (
                    self._sheets_api.spreadsheets()
                    .get(spreadsheetId=self._spreadsheet_id, fields="properties.title,sheets.properties")
                    .execute()
                )
            except HttpError as exc:
                raise IngestionError(
                    filename=self._spreadsheet_id,
                    reason=f"Failed to load spreadsheet metadata: {exc}",
                ) from exc
        return self._metadata

    def _tab_titles(self) -> list[str]:
        meta = self._fetch_metadata()
        return [s["properties"]["title"] for s in meta.get("sheets", [])]

    def detect_tables(self) -> list[str]:
        return self._tab_titles()

    def _read_tab_dataframe(self, tab_title: str) -> pl.DataFrame:
        """Fetch a tab as a Polars DataFrame with Polars-inferred types."""
        try:
            resp = (
                self._sheets_api.spreadsheets()
                .values()
                .get(
                    spreadsheetId=self._spreadsheet_id,
                    range=tab_title,
                    valueRenderOption="UNFORMATTED_VALUE",
                    dateTimeRenderOption="FORMATTED_STRING",
                )
                .execute()
            )
        except HttpError as exc:
            raise IngestionError(
                filename=f"{self._spreadsheet_id}!{tab_title}",
                reason=f"Failed to read tab values: {exc}",
            ) from exc

        rows = resp.get("values", [])
        if not rows:
            return pl.DataFrame()

        header = rows[0]
        # Pad / dedupe header (Sheets can return ragged rows)
        seen: dict[str, int] = {}
        clean_header: list[str] = []
        for i, h in enumerate(header):
            name = str(h).strip() or f"col_{i + 1}"
            if name in seen:
                seen[name] += 1
                name = f"{name}_{seen[name]}"
            else:
                seen[name] = 0
            clean_header.append(name)

        data_rows = rows[1:]
        width = len(clean_header)
        padded = [(row + [None] * width)[:width] for row in data_rows]

        df = pl.DataFrame(
            {clean_header[i]: [r[i] for r in padded] for i in range(width)},
            strict=False,
        )
        # Try to coerce numeric / date-looking columns so downstream stats/ charts work
        for col in df.columns:
            s = df[col]
            if s.dtype == pl.Utf8 or s.dtype == pl.Object:
                coerced = _try_numeric(s)
                if coerced is not None:
                    df = df.with_columns(coerced.alias(col))
        return df

    def get_schema(self) -> list[ColumnSchema]:
        titles = self._tab_titles()
        if not titles:
            return []
        df = self._read_tab_dataframe(titles[0])
        return [
            ColumnSchema(
                name=col,
                dtype=_polars_dtype_to_column_dtype(df[col].dtype),
                stats=_extract_column_stats(df[col]),
            )
            for col in df.columns
        ]

    async def ingest(
        self,
        workspace_path: Path,
        selected_tabs: list[str] | None = None,
    ) -> list[TableInfo]:
        log = logger.bind(spreadsheet=self._spreadsheet_id)

        all_tabs = self._tab_titles()
        tabs_to_import = selected_tabs or all_tabs

        invalid = set(tabs_to_import) - set(all_tabs)
        if invalid:
            raise IngestionError(
                filename=self._spreadsheet_id,
                reason=f"Tabs not found: {invalid}. Available: {all_tabs}",
            )

        workspace_path.mkdir(parents=True, exist_ok=True)
        tables: list[TableInfo] = []

        for tab in tabs_to_import:
            tab_log = log.bind(tab=tab)
            tab_log.info("Ingesting Google Sheet tab")

            df = self._read_tab_dataframe(tab)
            if df.is_empty():
                tab_log.warning("Skipping empty tab")
                continue

            safe_name = _safe_table_name(tab)
            parquet_path = workspace_path / f"{safe_name}.parquet"
            df.write_parquet(parquet_path, compression="zstd")
            parquet_size = os.path.getsize(parquet_path)

            columns = [
                ColumnSchema(
                    name=col,
                    dtype=_polars_dtype_to_column_dtype(df[col].dtype),
                    stats=_extract_column_stats(df[col]),
                )
                for col in df.columns
            ]

            tables.append(
                TableInfo(
                    name=safe_name,
                    columns=columns,
                    row_count=len(df),
                    source_type=SourceType.GOOGLE_SHEETS,
                    file_size_bytes=parquet_size,
                    parquet_path=str(parquet_path),
                )
            )
            tab_log.info(
                "Tab ingested",
                rows=len(df),
                columns=len(df.columns),
                parquet_kb=f"{parquet_size / 1024:.1f}",
            )

        log.info("Google Sheets ingestion complete", tables_created=len(tables))
        return tables


def _try_numeric(s: pl.Series) -> pl.Series | None:
    """Best-effort coercion of a string series to numeric. Returns None if it loses data."""
    non_null = s.drop_nulls()
    if non_null.is_empty():
        return None
    try:
        cast = s.cast(pl.Float64, strict=False)
    except Exception:  # noqa: BLE001
        return None
    if cast.null_count() > s.null_count():
        return None
    return cast
