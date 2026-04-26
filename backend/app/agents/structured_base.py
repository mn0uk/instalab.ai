from __future__ import annotations

import logging
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from .base import Agent, AgentContext
from .langgraph_base import build_chat_model


logger = logging.getLogger(__name__)


class BaseStructuredLLMAgent(Agent):
    """Base for one-shot LLM agents that emit a Pydantic-validated dict.

    Mirrors `BaseLangGraphAgent`'s contract minus the tool-calling loop, for
    sections that do no autonomous retrieval (Timeline, Synthesis) or only
    need an eager pre-fetched blob in the prompt (Validation).

    Subclasses must define:
      - `name`
      - `response_schema` (Pydantic model used as `with_structured_output`)
      - `system_prompt(self, ctx) -> str`
      - `user_payload(self, ctx) -> str`
      - `fallback_run(self, ctx) -> dict` (used when the LLM is disabled or fails)
    """

    response_schema: type[BaseModel]

    def system_prompt(self, ctx: AgentContext) -> str:  # pragma: no cover
        raise NotImplementedError

    def user_payload(self, ctx: AgentContext) -> str:  # pragma: no cover
        raise NotImplementedError

    def fallback_run(self, ctx: AgentContext) -> dict[str, Any]:  # pragma: no cover
        raise NotImplementedError

    def _model(self) -> BaseChatModel | None:
        return build_chat_model()

    def run(self, ctx: AgentContext) -> dict[str, Any]:
        model = self._model()
        if model is None:
            return self.fallback_run(ctx)

        try:
            structured = model.with_structured_output(self.response_schema)
            out = structured.invoke(
                [
                    SystemMessage(content=self.system_prompt(ctx)),
                    HumanMessage(content=self.user_payload(ctx)),
                ]
            )
        except Exception:
            logger.exception("Structured agent %s failed; falling back", self.name)
            return self.fallback_run(ctx)

        if out is None:
            logger.warning(
                "Structured agent %s returned no structured output; using fallback",
                self.name,
            )
            return self.fallback_run(ctx)
        if isinstance(out, BaseModel):
            return self.response_schema.model_validate(out.model_dump()).model_dump()
        if isinstance(out, dict):
            return self.response_schema.model_validate(out).model_dump()
        return self.response_schema.model_validate(dict(out)).model_dump()
