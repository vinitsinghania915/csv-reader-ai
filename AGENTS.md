# AGENTS.md

This file defines the working agents, their scope, and the coordination rules for building `csv-reader-ai`.

## Purpose

The project is a conversational data platform where users upload CSV, TSV, and Excel files, convert them into Parquet, and query them through a chat interface.

This document keeps implementation responsibilities clear as the codebase grows.

## Active Agents

### 1. Product Agent

Owns product scope, phase boundaries, and feature prioritization.

Responsibilities:
- Keep work aligned with `PLAN.md`
- Keep decisions aligned with `DECISIONS.md`
- Prevent Phase 2 or Phase 3 work from leaking into MVP delivery
- Clarify user-facing behavior before implementation begins

### 2. Backend Agent

Owns the FastAPI backend and all server-side business logic.

Responsibilities:
- API design and route contracts
- Ingestion flow for CSV, TSV, and Excel
- Workspace and table lifecycle
- Query execution with DuckDB
- LLM orchestration for text-to-SQL
- Background processing, validation, and error handling

Current backend focus:
- Stabilize upload and ingestion flows
- Add workspace metadata persistence
- Add test coverage for ingestion and query paths

### 3. Frontend Agent

Owns the Next.js application and user experience.

Responsibilities:
- Upload workflows
- Workspace and table browsing UI
- Data preview UI
- Chat interface
- Visualization rendering
- Relationship builder UI in later phases

Current frontend focus:
- Deferred until backend MVP contracts are stable

### 4. Data Engine Agent

Owns schema detection, file normalization, and analytical query performance.

Responsibilities:
- Polars ingestion patterns
- Parquet output conventions
- DuckDB query safety and performance
- Table naming and schema inspection
- Large-file handling strategy

### 5. QA Agent

Owns validation quality, regression coverage, and release confidence.

Responsibilities:
- Unit and integration test planning
- Edge-case validation for uploads and parsing
- Query correctness checks
- API contract verification
- Coverage tracking

Current QA focus:
- Introduce the first real test suite for backend services and APIs

## Coordination Rules

- Follow the decisions recorded in `DECISIONS.md` unless they are explicitly updated.
- Treat `PLAN.md` as the source of truth for roadmap sequencing.
- Keep routes thin and business logic inside services.
- Prefer small, testable changes over broad refactors.
- Do not introduce Phase 2 features into MVP work unless explicitly approved.
- Do not revert user changes unless explicitly requested.

## MVP Build Order

1. Backend foundations
2. Upload and ingestion hardening
3. Workspace metadata and preview flows
4. Query execution safety
5. Chat-to-SQL service
6. Frontend integration

## Notes

- Google Sheets is Phase 2.
- Relationships are Phase 2.
- Large-file uploads should eventually use chunked/background processing.
- The project should stay friendly to non-technical users, even when the underlying system is sophisticated.
