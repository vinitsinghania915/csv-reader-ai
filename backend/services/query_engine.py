"""DuckDB query engine — executes SQL on Parquet files.

This is the core analytical engine. It creates DuckDB views over
Parquet files so the LLM-generated SQL runs directly against columnar
storage with automatic pushdown optimizations.

Key features:
    - Registers Parquet files as virtual tables (CREATE VIEW)
    - Leverages projection pushdown (only read needed columns)
    - Leverages predicate pushdown (skip irrelevant row groups)
    - Parallelizes across row groups for multi-threaded execution
    - Returns results as list[dict] for easy JSON serialization
"""

from __future__ import annotations

import time
from pathlib import Path

import duckdb
import structlog

from exceptions import QueryExecutionError

logger = structlog.get_logger()


class QueryEngine:
    """DuckDB-powered query engine operating on Parquet files.

    Each workspace gets its own DuckDB in-memory connection with
    views pointing to the workspace's Parquet files.

    Thread-safety: DuckDB connections are NOT thread-safe.
    Create one QueryEngine per request or use a connection pool.
    """

    def __init__(self, parquet_base_path: str) -> None:
        self._base_path = Path(parquet_base_path)
        # Connection cache: workspace_id → DuckDB connection
        self._connections: dict[str, duckdb.DuckDBPyConnection] = {}

    def _get_connection(self, workspace_id: str) -> duckdb.DuckDBPyConnection:
        """Get or create a DuckDB connection for a workspace."""
        if workspace_id not in self._connections:
            con = duckdb.connect()  # In-memory, per-workspace
            self._register_workspace_tables(con, workspace_id)
            self._connections[workspace_id] = con
        return self._connections[workspace_id]

    def _register_workspace_tables(
        self,
        con: duckdb.DuckDBPyConnection,
        workspace_id: str,
    ) -> None:
        """Register all Parquet files in a workspace as DuckDB views."""
        workspace_dir = self._base_path / workspace_id
        if not workspace_dir.exists():
            return

        for parquet_file in workspace_dir.glob("*.parquet"):
            table_name = parquet_file.stem
            con.execute(f"""
                CREATE OR REPLACE VIEW "{table_name}" AS
                SELECT * FROM read_parquet('{parquet_file}')
            """)
            logger.info(
                "Registered table",
                workspace=workspace_id,
                table=table_name,
                path=str(parquet_file),
            )

    def refresh_tables(self, workspace_id: str) -> None:
        """Re-register all tables for a workspace (after new upload)."""
        if workspace_id in self._connections:
            self._connections[workspace_id].close()
            del self._connections[workspace_id]
        # Will be re-created on next query
        self._get_connection(workspace_id)

    def get_table_names(self, workspace_id: str) -> list[str]:
        """List all registered table names for a workspace."""
        con = self._get_connection(workspace_id)
        result = con.execute("SHOW TABLES").fetchall()
        return [row[0] for row in result]

    def get_table_preview(
        self,
        workspace_id: str,
        table_name: str,
        rows: int = 100,
    ) -> dict[str, object]:
        """Get a preview of a table (first N rows + metadata).

        Returns:
            dict with keys: columns, data, total_rows
        """
        con = self._get_connection(workspace_id)

        try:
            # Get total row count
            count_result = con.execute(
                f'SELECT COUNT(*) FROM "{table_name}"'
            ).fetchone()
            total_rows = count_result[0] if count_result else 0

            # Get preview rows
            result = con.execute(
                f'SELECT * FROM "{table_name}" LIMIT {rows}'
            )
            columns = [desc[0] for desc in result.description]
            data = [dict(zip(columns, row)) for row in result.fetchall()]

            return {
                "columns": columns,
                "data": data,
                "total_rows": total_rows,
            }

        except duckdb.Error as exc:
            raise QueryExecutionError(
                reason=str(exc),
                sql=f'SELECT * FROM "{table_name}" LIMIT {rows}',
            ) from exc

    async def execute_safe(
        self,
        workspace_id: str,
        sql: str,
    ) -> dict[str, object]:
        """Execute a SQL query safely with error handling and timing.

        Args:
            workspace_id: The workspace to query against.
            sql: The SQL query to execute.

        Returns:
            dict with keys: columns, data, row_count, execution_time_ms

        Raises:
            QueryExecutionError: If the query fails.
        """
        con = self._get_connection(workspace_id)
        log = logger.bind(workspace=workspace_id)

        # Basic SQL safety checks — prevent DDL/DML
        sql_upper = sql.strip().upper()
        forbidden_keywords = ["DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE", "TRUNCATE"]
        for keyword in forbidden_keywords:
            if sql_upper.startswith(keyword):
                raise QueryExecutionError(
                    reason=f"Forbidden SQL operation: {keyword}",
                    sql=sql,
                )

        start = time.perf_counter()

        try:
            result = con.execute(sql)
            columns = [desc[0] for desc in result.description]
            rows = result.fetchall()
            data = [dict(zip(columns, row)) for row in rows]

            elapsed_ms = int((time.perf_counter() - start) * 1000)

            log.info(
                "Query executed",
                sql=sql[:200],
                rows=len(data),
                time_ms=elapsed_ms,
            )

            return {
                "columns": columns,
                "data": data,
                "row_count": len(data),
                "execution_time_ms": elapsed_ms,
            }

        except duckdb.Error as exc:
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            log.error("Query failed", sql=sql[:200], error=str(exc), time_ms=elapsed_ms)
            raise QueryExecutionError(reason=str(exc), sql=sql) from exc

    def close(self) -> None:
        """Close all DuckDB connections."""
        for con in self._connections.values():
            con.close()
        self._connections.clear()
