"""Base class for all source adapters — enforces the unified ingestion contract.

Every data source (CSV, Excel, Google Sheets) implements this interface.
All sources normalize to Parquet files — the query engine never knows
or cares where the data originally came from.

Principle: Open/Closed (SOLID) — add new sources by creating a new adapter,
not by modifying existing code.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from schemas.upload import ColumnSchema, TableInfo


class SourceAdapter(ABC):
    """Abstract base class — all sources normalize to Parquet.

    Contract:
        1. detect_tables() → discover what tables/sheets/tabs exist
        2. ingest()        → convert source → Parquet files

    Implementations must be stateless after __init__ — they receive all
    context via constructor args and method parameters.
    """

    @abstractmethod
    def detect_tables(self) -> list[str]:
        """Return list of table names found in this source.

        For CSV: returns [filename_without_extension]
        For Excel: returns sheet names
        For Google Sheets: returns tab names
        """

    @abstractmethod
    async def ingest(self, workspace_path: Path) -> list[TableInfo]:
        """Convert source data to Parquet files in the workspace directory.

        Args:
            workspace_path: Directory to write Parquet files into.

        Returns:
            List of TableInfo objects with schema and metadata
            for each created table.

        Raises:
            IngestionError: If conversion fails.
        """

    @abstractmethod
    def get_schema(self) -> list[ColumnSchema]:
        """Return column schema for the source (detected from sample rows).

        Used for schema preview before full ingestion.
        """
