# Backend - LabRun API

FastAPI service that orchestrates a multi-agent pipeline:
- Novelty Check (agentic RAG over Tavily)
- Protocol
- Materials and Supply Chain
- Timeline
- Validation
- Synthesis

## Setup

1. Create a virtualenv and install dependencies:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Configure env (use repo-level `.env`, see `.env.example`):

   ```env
   OPENAI_API_KEY=sk-...
   TAVILY_API_KEY=tvly-...
   DATABASE_URL=sqlite:///./ai_scientist.db
   LLM_MODEL=gpt-4o-mini
   CORS_ORIGINS=http://localhost:5173
   ```

3. Run the API:

   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

4. Visit:
   - Health: `http://localhost:8000/health`
   - OpenAPI: `http://localhost:8000/docs`

## Endpoints

- `POST /experiments` - submit a hypothesis, runs the multi-agent pipeline.
- `GET /experiments` - recent experiments.
- `GET /experiments/{id}` - aggregate detail (status + agent runs + latest plan).
- `POST /experiments/{id}/regenerate` - re-run pipeline.
- `POST /experiments/{id}/reviews` - submit reviewer feedback for a plan section.
- `GET /experiments/{id}/reviews` - list reviewer feedback.

## Notes

- Background tasks run inline via FastAPI BackgroundTasks for MVP simplicity.
- Upgrade path: swap `pipeline.run_experiment_pipeline` invocation in `api/experiments.py` to a Celery task with the same signature.
- All retrieved evidence is constrained to the domain allowlist defined in `app/providers/tavily.py`.
