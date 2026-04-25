from __future__ import annotations

from typing import Any

from ..schemas import NoveltyResult
from .base import Agent, AgentContext, hits_to_block, hits_to_references


SYSTEM = """You are the Novelty Check Agent in a multi-agent AI scientist system.
You decide whether a proposed scientific experiment has been done before, using retrieved literature.

Output STRICT JSON matching this schema:
{
  "label": "NOT_FOUND" | "SIMILAR_EXISTS" | "EXACT_MATCH",
  "confidence": number between 0 and 1,
  "rationale": short string,
  "matched_entities": {
    "intervention": string,
    "control": string,
    "endpoint": string,
    "model_or_system": string
  },
  "references": [
    {"title": string, "url": string, "source": string, "snippet": string, "relevance": number}
  ]
}

Rules:
- Use only the provided search results for references; do not invent URLs.
- Return at most 3 references in `references`, choosing the most relevant.
- Use "EXACT_MATCH" only if the same intervention, system, endpoint, and threshold appear together.
- Use "SIMILAR_EXISTS" when overlapping intervention or endpoint exists but the exact configuration differs.
- Use "NOT_FOUND" when no meaningfully related work appears in the results.
"""


class NoveltyAgent(Agent):
    name = "novelty"

    def run(self, ctx: AgentContext) -> dict[str, Any]:
        broad = self.tavily.search_novelty(ctx.hypothesis, max_results=6)
        narrow = self.tavily.search_novelty(
            f"experiment protocol {ctx.hypothesis}", max_results=6
        )
        seen: set[str] = set()
        merged = []
        for h in broad + narrow:
            if h.url and h.url not in seen:
                seen.add(h.url)
                merged.append(h)

        user = (
            f"Hypothesis:\n{ctx.hypothesis}\n\n"
            f"Search results:\n{hits_to_block(merged)}\n\n"
            "Return the novelty JSON now."
        )

        if self.llm.enabled:
            data = self.llm.generate_json(system=SYSTEM, user=user)
        else:
            data = {
                "label": "SIMILAR_EXISTS" if merged else "NOT_FOUND",
                "confidence": 0.4 if merged else 0.2,
                "rationale": "LLM disabled; heuristic fallback based on retrieval.",
                "matched_entities": {},
                "references": hits_to_references(merged, limit=3),
            }

        if not data.get("references"):
            data["references"] = hits_to_references(merged, limit=3)
        return NoveltyResult.model_validate(data).model_dump()
