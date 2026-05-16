# CSV Reader AI — Decision Log

> All architectural and product decisions made during planning, documented for reference.

---

## Product Decisions

| # | Decision | Choice | Rationale | Date |
|---|----------|--------|-----------|------|
| P1 | **Product type** | Conversational data platform | Chat-first UX for non-technical users to query structured data | 2026-04-18 |
| P2 | **Supported file types** | CSV, TSV, Excel (.xlsx/.xls) | Covers 95%+ of structured data exports | 2026-04-18 |
| P3 | **Google Sheets** | Phase 2 (Week 4) | Requires OAuth2 setup; ship CSV + Excel first | 2026-04-18 |
| P4 | **Multi-source relationships** | Yes — cross-file JOINs | Key differentiator vs competitors like ChatCSV | 2026-04-18 |
| P5 | **File size limit** | 2 GB hard cap | Polars streaming handles this with constant memory | 2026-04-18 |
| P6 | **Monetization** | None — free, open project | No paid tiers, no rate limiting by plan | 2026-04-18 |
| P7 | **Target users** | Non-technical (marketers, ops, founders) | People who can't write SQL but need data insights | 2026-04-18 |

---

## Architecture Decisions

| # | Decision | Choice | Alternatives Considered | Why This Choice |
|---|----------|--------|------------------------|-----------------|
| A1 | **Frontend framework** | Next.js (App Router) | Vite + React, Remix | SSR, file-based routing, great DX, Vercel deployment |
| A2 | **Backend framework** | Python FastAPI | Express.js, Django, Flask | Required for Polars streaming (Node.js bindings lack `sink_parquet`); async-first; auto-generated OpenAPI docs |
| A3 | **Split architecture** | Next.js frontend + FastAPI backend | Monolith Node.js | Polars' streaming `sink_parquet()` is Python-only |
| A4 | **CSV ingestion** | Polars (`scan_csv` → `sink_parquet`) | Pandas, DuckDB direct read | Streaming with constant memory (~50-100MB for 1GB file); Rust-powered speed |
| A5 | **Storage format** | Apache Parquet (Zstd compression) | Raw CSV, SQLite | 5-10× smaller, columnar for fast analytics, pushdown optimizations |
| A6 | **Query engine** | DuckDB (on Parquet) | SQLite, Pandas, DuckDB on CSV | 3-10× faster than CSV queries, projection/predicate pushdown, zero infrastructure |
| A7 | **Excel engine** | Polars + Calamine (Rust) | openpyxl, xlsx2csv | 10× faster than openpyxl; each sheet = separate Parquet table |
| A8 | **LLM strategy** | Text-to-SQL (MVP) | Text-to-Code, Hybrid | Safer (no code execution), auditable, covers 80%+ of queries |
| A9 | **LLM provider** | Configurable (user brings own key) | Single provider lock-in | Support OpenAI, Claude, Gemini; settings page with key input |
| A10 | **State management** | Zustand | Redux, Jotai, Context API | Minimal boilerplate, TypeScript-first, no providers needed |
| A11 | **Styling** | Tailwind CSS v4 + Framer Motion | Vanilla CSS, styled-components | Enterprise-grade utility-first CSS; Framer Motion for orchestrated animations |
| A12 | **Charts** | Recharts | D3.js, Chart.js, Observable Plot | React-native, great defaults, easy animation integration |
| A13 | **Database (metadata)** | SQLite (MVP) → PostgreSQL (prod) | MongoDB, Firestore | Zero-config for MVP, easy migration path |
| A14 | **Auth** | OAuth (Google, GitHub) | Email/password, Magic links | No password management; sets up foundation for Google Sheets OAuth |
| A15 | **Task queue** | Celery + Redis | Dramatiq, Huey, RQ | Industry standard for Python background tasks; needed for files > 500MB |
| A16 | **Schema diagram** | React Flow | D3.js, Cytoscape.js | React-native, drag-and-drop, node-based UI out of the box |

---

## Backend Coding Standards

| # | Decision | Choice | Notes |
|---|----------|--------|-------|
| C1 | **Architecture pattern** | Layered (Routes → Services → Repos → Models) | No business logic in route handlers |
| C2 | **Type hints** | Mandatory everywhere | `mypy --strict` enforced |
| C3 | **Data validation** | Pydantic v2 for all request/response | Strict schemas, auto-generated OpenAPI |
| C4 | **Error handling** | Custom exception hierarchy | `AppError` base class with status codes and error codes |
| C5 | **Dependency injection** | FastAPI `Depends` | Centralized wiring in `dependencies.py` |
| C6 | **Data access** | Repository pattern | Separation of DB queries from business logic |
| C7 | **Configuration** | Pydantic Settings (env-based) | Type-safe, validated, `.env` file support |
| C8 | **Logging** | Structured JSON (structlog) | Contextual logging with workspace/user binding |
| C9 | **Linting** | Ruff (unified linter + formatter) | Replaces black, isort, flake8, pyflakes |
| C10 | **Type checking** | mypy (strict mode) | `disallow_untyped_defs = true` |
| C11 | **Testing** | pytest + AsyncMock | 80%+ coverage target; unit + integration + e2e |
| C12 | **Git commits** | Conventional Commits | `feat(scope): description` format |
| C13 | **Python version** | 3.12+ | For latest type hint syntax (`list[T]` instead of `List[T]`) |
| C14 | **Principles** | DRY, SOLID, KISS, YAGNI, Fail Fast | Documented with examples in plan |

---

## UI/UX Decisions

| # | Decision | Choice | Notes |
|---|----------|--------|-------|
| U1 | **Theme** | Dark mode by default | Data tools feel premium in dark; zinc-based depth system |
| U2 | **Design language** | Glassmorphism + depth layers | `backdrop-blur-xl`, translucent borders, layered backgrounds |
| U3 | **Typography** | Inter (body) + JetBrains Mono (code) | Google Fonts, clean + monospace pairing |
| U4 | **Color palette** | Zinc backgrounds + indigo accent | Primary: `#6366f1 → #818cf8` gradient |
| U5 | **Animations** | Framer Motion throughout | Page transitions, staggered lists, chart entrances, typing indicator |
| U6 | **Design inspiration** | Linear, Vercel Dashboard, Raycast, Supabase | Enterprise SaaS aesthetic |
| U7 | **Data table** | Virtual scrolling + frozen header | For performance on large datasets |
| U8 | **Chat UX** | Inline charts + SQL blocks in messages | Charts and tables render directly in chat flow |
| U9 | **Sidebar** | Collapsible (240px → 64px icons) | Smooth width animation |
| U10 | **Source indicators** | Color-coded badges per source | CSV = green, Excel = emerald, Google = blue |

---

## Deployment Decisions

| # | Decision | Choice | Notes |
|---|----------|--------|-------|
| D1 | **Frontend hosting** | Vercel (free tier) | Auto-deploy from Git, edge network |
| D2 | **Backend hosting** | Render or Railway (free tier) | Cold starts (~30s), 512MB RAM limit |
| D3 | **File storage** | Local filesystem (MVP) → S3 (prod) | Simple to start |
| D4 | **Free tier constraints** | May need ~500MB file limit on free hosting | Recommend self-hosting for 2GB files |

---

## Timeline Decisions

| Phase | Scope | Duration |
|-------|-------|----------|
| **Week 1** | Foundation — Next.js + FastAPI setup, CSV/Excel upload, Polars ingestion, DuckDB | 1 week |
| **Week 2** | Chat & AI — LLM text-to-SQL, query execution, basic charts, chat history | 1 week |
| **Week 3** | Multi-Source & Relationships — Cross-source joins, schema diagram, UI polish | 1 week |
| **Week 4** | Google Sheets & Polish — OAuth2 flow, tab discovery, import, final polish | 1 week |

---

## Decision Change Log

| Date | Decision | Changed From | Changed To | Reason |
|------|----------|-------------|------------|--------|
| 2026-04-18 | A11 | Vanilla CSS | Tailwind CSS v4 + Framer Motion | User requested enterprise-level animated UI |
| 2026-04-18 | P3 | TBD | Phase 2 (Week 4) | User chose to defer Google Sheets to Phase 2 |
| 2026-04-18 | P6 | TBD | No monetization | User confirmed free, open project |

---

*Last updated: 2026-04-18*
