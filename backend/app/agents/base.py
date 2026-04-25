from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable

from ..providers.llm import LLMProvider
from ..providers.tavily import SearchHit, TavilyProvider


AgentEventCallback = Callable[[str, str, dict[str, Any]], None]


@dataclass
class AgentContext:
    hypothesis: str
    domain: str | None = None
    prior_outputs: dict[str, Any] = field(default_factory=dict)
    feedback_examples: list[dict[str, Any]] = field(default_factory=list)
    event_callback: AgentEventCallback | None = None


class Agent:
    name: str = "agent"

    def __init__(self, llm: LLMProvider, tavily: TavilyProvider) -> None:
        self.llm = llm
        self.tavily = tavily

    def run(self, ctx: AgentContext) -> dict[str, Any]:  # pragma: no cover - interface
        raise NotImplementedError


def hits_to_block(hits: list[SearchHit]) -> str:
    if not hits:
        return "(no search results available)"
    lines: list[str] = []
    for i, h in enumerate(hits, start=1):
        snippet = (h.snippet or "").strip().replace("\n", " ")
        if len(snippet) > 600:
            snippet = snippet[:600] + "..."
        lines.append(
            f"[{i}] {h.title}\n    url: {h.url}\n    source: {h.source}\n    snippet: {snippet}"
        )
    return "\n".join(lines)


def hits_to_references(hits: list[SearchHit], limit: int = 3) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    for h in hits[:limit]:
        refs.append(
            {
                "title": h.title,
                "url": h.url,
                "source": h.source,
                "snippet": (h.snippet or "")[:400],
                "relevance": h.score,
            }
        )
    return refs


def safe_json(payload: Any) -> str:
    return json.dumps(payload, indent=2, default=str)
