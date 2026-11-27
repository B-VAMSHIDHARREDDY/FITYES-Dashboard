# FITYES — Real Estate Market Dashboard

Full-stack dashboard for a German brokerage (Maklerbüro): market analytics, listings inventory, and a deal pipeline with a live offer builder.

- **German market data**: Berlin, München, Hamburg, Frankfurt am Main (16 neighborhoods). Prices are in EUR and areas in m². The data also covers service charge (Hausgeld), property tax (Grundsteuer), and the notary-driven deal stages.
- **Bilingual UI (DE / EN)**: the switch is in the top bar, German is the default, and the choice is remembered. Numbers, currency and dates follow the selected locale (`1.250.000 €` vs `€1,250,000`).
- **Listing photos**: 37 real German buildings and plots from Wikimedia Commons (category *Quality images*, CC BY / CC BY-SA). They're stored in `frontend/public/listings/` as 480px card and 800px detail versions. The property drawer shows the author and license, and the full list is in `public/listings/CREDITS.md`.
- **Sound**: one soft, synthesized click for every button, link and tab, plus success and error chimes. There's a mute toggle in the top bar.

| Layer    | Stack |
|----------|-------|
| Backend  | Python 3.11 · FastAPI · SQLAlchemy 2.0 · Alembic · psycopg 3 · Pydantic v2 |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS v4 · TanStack Query · Framer Motion · Recharts |
| Database | PostgreSQL (Aiven). All tables live in an isolated `realestate` schema |

## Quick start

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
copy .env.example .env               # then set DATABASE_URL
.\.venv\Scripts\alembic upgrade head # creates schema "realestate" + tables
.\.venv\Scripts\python -m scripts.seed           # German demo data (--reset to re-seed)
.\.venv\Scripts\python -m scripts.seed --add 100 # append 100 more listings + deals
.\.venv\Scripts\uvicorn app.main:app --reload --port 8010
```

The API docs are at http://localhost:8010/docs.

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api to :8010)
```

### Tests

```powershell
cd backend
.\.venv\Scripts\python -m pytest -q    # runs against a throw-away SQLite DB
```

## Project structure

```
backend/
  app/
    core/        settings, domain errors, UTC time helpers
    db/          engine + session dependency
    models/      SQLAlchemy entities + enums
    schemas/     Pydantic request/response contracts
    services/    business logic & queries (deal rules, finance math, analytics)
    api/v1/      thin FastAPI routers
    main.py      app factory, middleware, error mapping
  alembic/       migrations (scoped to the app schema)
  scripts/seed.py
  tests/
frontend/src/
  api/           typed fetch client, API types, React Query hooks
  components/    layout (TopNav, SubBar), UI primitives, charts
  features/      desk · listings · deals · market · agents
  lib/           formatting, finance (mirrors backend), stage metadata
```

## Internationalisation

- Dictionaries: `frontend/src/i18n/en.ts` (source of truth) and `de.ts` (typed as `Record<MessageKey, string>`, so a missing German key fails the build).
- Server data is never sent as pre-rendered English sentences. Activities carry a structured `payload`, checklist items carry a `code`, and API errors return `code` + `params`. The UI renders each of them in the active language (`i18n/domain.ts`).
- User content (listing titles and descriptions) stays in the language it was entered in.

## Key behaviours

- **Deal pipeline**: Lead → Viewing → Offer → Notary contract → Closing → Closed (or Lost). Each stage has a checklist. `POST /deals/{id}/advance` returns **409** while items are open. Advancing to Under contract marks the listing *pending*, and closing marks it *sold*.
- **Offer builder**: sliders re-rate the offer price, mortgage, and commission client-side (`lib/finance.ts` mirrors `services/finance.py`). Saving creates a new offer version only when terms actually change, and offers lock once a deal reaches closing.
- **Market**: monthly snapshots per neighborhood power the trend charts and the scorecard (YoY, €/m², days on market, months of supply).
- **Safety**: migrations and the seed `--reset` only touch the `realestate` schema, so other tables in the same database are never inspected or modified.

## API overview (`/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness + DB ping |
| GET | `/meta/counts` | nav badges |
| GET | `/dashboard/summary`, `/dashboard/pipeline` | KPIs, stage totals |
| GET | `/market/trends?neighborhood=&months=` | monthly time series |
| GET | `/market/neighborhoods` | scorecard |
| GET/POST | `/properties` | filter, sort, paginate / create |
| GET/PATCH | `/properties/{id}` | detail / reprice, change status |
| GET | `/deals?stage=&q=` | pipeline list |
| GET | `/deals/{id}` | full deal + offer breakdown |
| PUT | `/deals/{id}/offer` | save offer terms (versioned) |
| POST | `/deals/{id}/advance`, `/deals/{id}/lost` | stage transitions |
| PATCH | `/deals/{id}/checklist/{item}` | resolve / reopen item |
| GET | `/agents`, `/activities` | leaderboard, activity feed |
