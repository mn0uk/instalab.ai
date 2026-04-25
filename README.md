# AI Scientist MVP

Minimal FE/BE starter based on the AI Scientist plan.

## Structure

- `frontend/` - React + Vite + TypeScript app
- `backend/` - FastAPI + Python API
- `.env` - all API keys and secrets (local only)
- `.env.example` - env template (committed)

## Quick start

1. Create env file:
   - `cp .env.example .env`
2. Put all keys in `.env` (never hardcode keys in code).
3. Build frontend in `frontend/`.
4. Build backend in `backend/`.

## Notes

- Keep the repo simple: frontend + backend as primary folders.
- Do not commit `.env`.