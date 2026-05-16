"""CSV/TSV source adapter — Polars scan_csv → sink_parquet.

Handles both small files (in-memory) and large files (streaming)
with automatic tiering based on file size.

Tiering strategy:
    < 50 MB  → pl.read_csv()   (in-memory, instant)
    ≥ 50 MB  → pl.scan_csv()   → sink_parquet() (streaming, constant memory)
"""

from __future__ import annotations

import os
from pathlib import Path

import polars as pl
import structlog

from exceptions import IngestionError
from schemas.upload import ColumnDType, ColumnSchema, ColumnStats, SourceType, TableInfo
from services.ingestion.base import SourceAdapter

logger = structlog.get_logger()

# Threshold for switching from in-memory to streaming ingestion
_STREAMING_THRESHOLD_BYTES = 50 * 1024 * 1024  # 50 MB


def _polars_dtype_to_column_dtype(dtype: pl.DataType) -> ColumnDType:
    """Map a Polars data type to our ColumnDType enum."""
    if dtype.is_integer():
        return ColumnDType.INTEGER
    if dtype.is_float():
        return ColumnDType.FLOAT
    if dtype == pl.Boolean:
        return ColumnDType.BOOLEAN
    if dtype == pl.Date:
        return ColumnDType.DATE
    if dtype == pl.Datetime or dtype.is_temporal():
        return ColumnDType.DATETIME
    if dtype == pl.Utf8 or dtype == pl.String:
        return ColumnDType.STRING
    return ColumnDType.UNKNOWN


def _extract_column_stats(series: pl.Series) -> ColumnStats:
    """Extract statistical summary from a Polars Series."""
    stats = ColumnStats(
        null_count=series.null_count(),
        unique_count=series.n_unique(),
        sample_values=[str(v) for v in series.head(5).to_list() if v is not None],
    )

    if series.dtype.is_numeric():
        try:
            stats.min_value = str(series.min())
            stats.max_value = str(series.max())
            stats.mean_value = float(series.mean())  # type: ignore[arg-type]
        except Exception:  # noqa: BLE001 — stats are best-effort
            pass
    elif series.dtype.is_temporal() or series.dtype == pl.String:
        try:
            stats.min_value = str(series.drop_nulls().min())
            stats.max_value = str(series.drop_nulls().max())
        except Exception:  # noqa: BLE001
            pass

    return stats


class CSVAdapter(SourceAdapter):
    """Adapter for CSV/TSV files → Parquet conversion.

    Uses Polars for both schema detection and data conversion.
    Automatically chooses streaming vs in-memory based on file size.
    """

    def __init__(self, file_path: Path, table_name: str | None = None) -> None:
        self._file_path = file_path
        self._file_size = file_path.stat().st_size
        self._separator = "\t" if file_path.suffix.lower() == ".tsv" else ","
        self._table_name = table_name or file_path.stem
        self._source_type = (
            SourceType.TSV if file_path.suffix.lower() == ".tsv" else SourceType.CSV
        )

        # Schema sample — read first 10K rows for schema detection
        self._sample: pl.DataFrame | None = None

    def _ensure_sample(self) -> pl.DataFrame:
        """Lazily load a sample of the file for schema detection."""
        if self._sample is None:
            try:
                self._sample = pl.read_csv(
                    self._file_path,
                    separator=self._separator,
                    n_rows=10_000,
                    infer_schema_length=10_000,
                    try_parse_dates=True,
                )
            except Exception as exc:
                raise IngestionError(
                    filename=self._file_path.name,
                    reason=f"Failed to read CSV sample: {exc}",
                ) from exc
        return self._sample

    def detect_tables(self) -> list[str]:
        """CSV files contain exactly one table."""
        return [self._table_name]

    def get_schema(self) -> list[ColumnSchema]:
        """Detect column schema from the first 10K rows."""
        sample = self._ensure_sample()
        return [
            ColumnSchema(
                name=col,
                dtype=_polars_dtype_to_column_dtype(sample[col].dtype),
                stats=_extract_column_stats(sample[col]),
            )
            for col in sample.columns
        ]

    async def ingest(self, workspace_path: Path) -> list[TableInfo]:
        """Convert CSV → Parquet. Uses streaming for files ≥ 50 MB.

        Returns:
            A single-element list with the created table's metadata.
        """
        log = logger.bind(
            file=self._file_path.name,
            size_mb=f"{self._file_size / 1024 / 1024:.1f}",
            table=self._table_name,
        )

        parquet_path = workspace_path / f"{self._table_name}.parquet"
        workspace_path.mkdir(parents=True, exist_ok=True)

        try:
            if self._file_size < _STREAMING_THRESHOLD_BYTES:
                # ── Small file: in-memory ───────────────────────────────
                log.info("Ingesting CSV (in-memory)")
                df = pl.read_csv(
                    self._file_path,
                    separator=self._separator,
                    try_parse_dates=True,
                    infer_schema_length=10_000,
                )
                df.write_parquet(parquet_path, compression="zstd")
                row_count = len(df)
            else:
                # ── Large file: streaming ───────────────────────────────
                log.info("Ingesting CSV (streaming)")
                lazy_df = pl.scan_csv(
                    self._file_path,
                    separator=self._separator,
                    try_parse_dates=True,
                    infer_schema_length=10_000,
                )
                lazy_df.sink_parquet(
                    parquet_path,
                    compression="zstd",
                    row_group_size=100_000,
                )
                # Get row count from the written Parquet file
                row_count = pl.scan_parquet(parquet_path).select(pl.len()).collect().item()

            parquet_size = os.path.getsize(parquet_path)
            log.info(
                "Ingestion complete",
                rows=row_count,
                parquet_mb=f"{parquet_size / 1024 / 1024:.1f}",
            )

            columns = self.get_schema()

            return [
                TableInfo(
                    name=self._table_name,
                    columns=columns,
                    row_count=row_count,
                    source_type=self._source_type,
                    file_size_bytes=self._file_size,
                    parquet_path=str(parquet_path),
                )
            ]

        except IngestionError:
            raise
        except Exception as exc:
            raise IngestionError(
                filename=self._file_path.name,
                reason=str(exc),
            ) from exc
