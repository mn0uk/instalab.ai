from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.tools import BaseTool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from pydantic import BaseModel

from ..settings import get_settings
from .base import Agent, AgentContext, AgentEventCallback


logger = logging.getLogger(__name__)


@lru_cache(maxsize=4)
def _cached_chat_model(model: str, temperature: float, api_key: str) -> ChatOpenAI:
    return ChatOpenAI(model=model, temperature=temperature, api_key=api_key)


def build_chat_model() -> ChatOpenAI | None:
    """Return a cached ChatOpenAI instance or None if no API key is configured."""

    settings = get_settings()
    if not settings.openai_api_key:
        return None
    return _cached_chat_model(
        settings.llm_model,
        settings.llm_temperature,
        settings.openai_api_key,
    )


class BaseLangGraphAgent(Agent):
    """Base for ReAct-style LangGraph agents that emit a Pydantic-validated dict.

    Subclasses must define:
      - `name`
      - `response_schema` (Pydantic model used as `response_format`)
      - `tools(self) -> list[BaseTool]`
      - `system_prompt(self, ctx) -> str`
      - `user_payload(self, ctx) -> str`
      - `fallback_run(self, ctx) -> dict` (used when the LLM is disabled)
    """

    response_schema: type[BaseModel]

    def tools(self, ctx: AgentContext) -> list[BaseTool]:  # pragma: no cover
        raise NotImplementedError

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
            tools = self.tools(ctx)
            app = create_react_agent(
                model=model,
                tools=tools,
                prompt=self.system_prompt(ctx),
                response_format=self.response_schema,
            )
            inputs = {"messages": [HumanMessage(content=self.user_payload(ctx))]}
            result = app.invoke(inputs)
        except Exception:
            logger.exception("LangGraph agent %s failed; falling back", self.name)
            return self.fallback_run(ctx)

        callback: AgentEventCallback | None = getattr(ctx, "event_callback", None)
        if callback:
            self._emit_message_events(callback, result.get("messages", []))

        structured = result.get("structured_response")
        if structured is None:
            logger.warning(
                "Agent %s returned no structured_response; using fallback", self.name
            )
            return self.fallback_run(ctx)
        if isinstance(structured, BaseModel):
            return self.response_schema.model_validate(structured.model_dump()).model_dump()
        if isinstance(structured, dict):
            return self.response_schema.model_validate(structured).model_dump()
        return self.response_schema.model_validate(dict(structured)).model_dump()

    def _emit_message_events(
        self,
        callback: AgentEventCallback,
        messages: list[Any],
    ) -> None:
        pending: dict[str, str] = {}
        for msg in messages:
            if isinstance(msg, AIMessage):
                tool_calls = getattr(msg, "tool_calls", None) or []
                for tc in tool_calls:
                    name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
                    args = tc.get("args") if isinstance(tc, dict) else getattr(tc, "args", None)
                    call_id = (
                        tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
                    ) or name or ""
                    pending[call_id] = name or ""
                    try:
                        callback(
                            self.name,
                            "tool_start",
                            {"tool": name, "args": args, "tool_call_id": call_id},
                        )
                    except Exception:
                        logger.exception("event_callback failed (tool_start)")
            elif isinstance(msg, ToolMessage):
                call_id = getattr(msg, "tool_call_id", "") or ""
                tool_name = pending.pop(call_id, None) or getattr(msg, "name", None)
                content = getattr(msg, "content", "")
                if not isinstance(content, str):
                    content = str(content)
                try:
                    callback(
                        self.name,
                        "tool_end",
                        {
                            "tool": tool_name,
                            "tool_call_id": call_id,
                            "content": content[:500],
                        },
                    )
                except Exception:
                    logger.exception("event_callback failed (tool_end)")
