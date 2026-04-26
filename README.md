# LabRun MVP

Multi-agent system that turns a natural-language scientific hypothesis into a runnable experiment plan.

Pipeline:

1. Novelty Check (agentic RAG over Tavily-restricted literature domains)
2. Protocol (grounded in protocols.io, Bio-protocol, Nature Protocols, JOVE, OpenWetWare)
3. Materials and Supply Chain (Thermo Fisher, Sigma-Aldrich, Promega, Qiagen, IDT, ATCC, Addgene)
4. Timeline (dependency-aware schedule informed by procurement risk)
5. Validation (endpoints, acceptance criteria, MIQE-aware QA)
6. Synthesis (cross-section consistency check + overall confidence)

## Repo layout

- `frontend/` - React + Vite + TypeScript + Tailwind UI
- `backend/` - FastAPI + Python multi-agent service (SQLite by default)
- `.env.example` - env template (committed)
- `.env` - local secrets (do not commit)

## Prerequisites

- Python 3.11+
- Node.js 18+
- Tavily API key (`TAVILY_API_KEY`)
- OpenAI API key (`OPENAI_API_KEY`)

## Quick start

1. Create env file and fill keys:

   ```bash
   cp .env.example .env
   ```

   Required:

   ```env
   OPENAI_API_KEY=sk-...
   TAVILY_API_KEY=tvly-...
   ```

2. Backend:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```

   - Health: http://localhost:8000/health
   - OpenAPI: http://localhost:8000/docs

3. Frontend (in a second terminal):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   - App: http://localhost:5173

## How it works

- `POST /experiments` creates a hypothesis and triggers the multi-agent pipeline via FastAPI BackgroundTasks.
- Each specialist agent uses the Tavily provider with a domain allowlist tailored to its job (literature, protocols, suppliers, reagents, standards) and produces a strict-JSON section.
- The orchestrator runs novelty + protocol first, then materials, then timeline, then validation, then synthesis. Per-agent status is persisted in `agent_runs`.
- The frontend polls `GET /experiments/{id}` while the pipeline runs and renders each section, plus an expert review panel.

## Production-readiness notes

- SQLite is fine for the MVP. Set `DATABASE_URL` to a Postgres URL to switch.
- Background pipeline runs inline. To scale, replace the `BackgroundTasks.add_task` call in `backend/app/api/experiments.py` with a Celery task wrapper around `pipeline.run_experiment_pipeline`.
- Domain allowlists are centralized in `backend/app/providers/tavily.py`.
