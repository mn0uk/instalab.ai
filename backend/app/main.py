from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.experiments import router as experiments_router
from .db import init_db
from .settings import get_settings


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="AI Scientist API",
        version="0.1.0",
        description="Multi-agent backend for hypothesis-to-experiment plan generation.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _startup() -> None:
        init_db()

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        settings = get_settings()
        return {
            "status": "ok",
            "tavily_configured": bool(settings.tavily_api_key),
            "llm_configured": bool(settings.openai_api_key),
        }

    app.include_router(experiments_router)
    return app


app = create_app()
