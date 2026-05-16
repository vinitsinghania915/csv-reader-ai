"""Excel source adapter — Polars + Calamine engine for multi-sheet ingestion.

Each sheet in the workbook becomes a separate Parquet file (= separate table).
Uses the Calamine engine (Rust-based) which is ~10× faster than openpyxl.
"""

from __future__ import annotations

import os
from pathlib import Path

import polars as pl
import structlog

from exceptions import IngestionError
from schemas.upload import ColumnDType, ColumnSchema, ColumnStats, SourceType, TableInfo
from services.ingestion.base import SourceAdapter
from services.ingestion.csv_adapter import _extract_column_stats, _polars_dtype_to_column_dtype

logger = structlog.get_logger()


class ExcelAdapter(SourceAdapter):
    """Adapter for Excel (.xlsx / .xls) files → Parquet conversion.

    Each sheet is converted to a separate Parquet file, making each
    sheet independently queryable. Users can then define relationships
    across sheets.
    """

    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._file_size = file_path.stat().st_size
        self._sheet_names: list[str] | None = None

    def _discover_sheets(self) -> list[str]:
        """Discover all sheet names in the workbook."""
        if self._sheet_names is None:
            try:
                # Use calamine engine for fast sheet discovery
                # Read with sheet_id=0 just to get the sheet names
                xl = pl.read_excel(
                    self._file_path,
                    sheet_id=0,
                    engine="calamine",
                    read_options={"n_rows": 0},
                )
                # Get all sheet names using openpyxl as fallback
                import openpyxl

                wb = openpyxl.load_workbook(self._file_path, read_only=True)
                self._sheet_names = wb.sheetnames
                wb.close()
            except Exception as exc:
                raise IngestionError(
                    filename=self._file_path.name,
                    reason=f"Failed to read Excel sheets: {exc}",
                ) from exc
        return self._sheet_names

    def detect_tables(self) -> list[str]:
        """Return list of sheet names — each sheet = one table."""
        return self._discover_sheets()

    def get_schema(self) -> list[ColumnSchema]:
        """Return schema for the first sheet (for preview).

        For per-sheet schemas, use get_sheet_schema().
        """
        sheets = self._discover_sheets()
        if not sheets:
            return []
        return self.get_sheet_schema(sheets[0])

    def get_sheet_schema(self, sheet_name: str) -> list[ColumnSchema]:
        """Detect column schema for a specific sheet."""
        try:
            df = pl.read_excel(
                self._file_path,
                sheet_name=sheet_name,
                engine="calamine",
                read_options={"n_rows": 10_000},
            )
            return [
                ColumnSchema(
                    name=col,
                    dtype=_polars_dtype_to_column_dtype(df[col].dtype),
                    stats=_extract_column_stats(df[col]),
                )
                for col in df.columns
            ]
        except Exception as exc:
            raise IngestionError(
                filename=self._file_path.name,
                reason=f"Failed to read schema for sheet '{sheet_name}': {exc}",
            ) from exc

    async def ingest(
        self,
        workspace_path: Path,
        selected_sheets: list[str] | None = None,
    ) -> list[TableInfo]:
        """Convert each selected sheet to a Parquet file.

        Args:
            workspace_path: Directory to write Parquet files into.
            selected_sheets: Sheets to import. None = all sheets.

        Returns:
            List of TableInfo for each created table.
        """
        log = logger.bind(file=self._file_path.name)

        all_sheets = self._discover_sheets()
        sheets_to_import = selected_sheets or all_sheets

        # Validate selected sheets exist
        invalid = set(sheets_to_import) - set(all_sheets)
        if invalid:
            raise IngestionError(
                filename=self._file_path.name,
                reason=f"Sheets not found: {invalid}. Available: {all_sheets}",
            )

        workspace_path.mkdir(parents=True, exist_ok=True)
        tables: list[TableInfo] = []

        for sheet_name in sheets_to_import:
            sheet_log = log.bind(sheet=sheet_name)
            sheet_log.info("Ingesting Excel sheet")

            try:
                # Read full sheet using Calamine engine
                df = pl.read_excel(
                    self._file_path,
                    sheet_name=sheet_name,
                    engine="calamine",
                )

                # Skip empty sheets
                if df.is_empty():
                    sheet_log.warning("Skipping empty sheet")
                    continue

                # Sanitize sheet name for filesystem use
                safe_name = sheet_name.replace(" ", "_").replace("/", "_")
                parquet_path = workspace_path / f"{safe_name}.parquet"

                df.write_parquet(parquet_path, compression="zstd")
                parquet_size = os.path.getsize(parquet_path)

                # Build column schema
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
                        source_type=SourceType.EXCEL,
                        file_size_bytes=self._file_size,
                        parquet_path=str(parquet_path),
                    )
                )

                sheet_log.info(
                    "Sheet ingested",
                    rows=len(df),
                    columns=len(df.columns),
                    parquet_mb=f"{parquet_size / 1024 / 1024:.1f}",
                )

            except IngestionError:
                raise
            except Exception as exc:
                raise IngestionError(
                    filename=self._file_path.name,
                    reason=f"Failed to ingest sheet '{sheet_name}': {exc}",
                ) from exc

        log.info("Excel ingestion complete", tables_created=len(tables))
        return tables
