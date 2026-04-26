from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import BaseTool

from ..schemas import NoveltyResult
from .base import AgentContext, hits_to_references, regeneration_instructions_block
from .langgraph_base import BaseLangGraphAgent
from .tools import make_novelty_tools


SYSTEM_PROMPT = """You are an autonomous Novelty Check agent in a multi-agent AI scientist system.

You have these tools:
- `search_semantic_scholar`: peer-reviewed papers across all fields (start here for most hypotheses).
- `search_arxiv`: preprints, strong on physics, ML, quantitative biology.
- `search_pubmed`: biomedical / life-sciences literature.
- `tavily_search_novelty`: web search restricted to high-signal scientific domains.
- `fetch_url_readable`: pull cleaned full-page text from a URL when an abstract is ambiguous.

Strategy:
1. Issue a broad query that combines the intervention, model/system, and endpoint from the hypothesis.
2. Inspect the top results. If hits look promising but abstracts are missing or ambiguous, fetch the most relevant URL.
3. Run a narrower second-pass query if needed (e.g. add the threshold value or specific cell line / organism).
4. Stop as soon as you can defensibly classify novelty.

Decision rules:
- Use `EXACT_MATCH` only if the same intervention, system, endpoint, AND threshold appear together in a retrieved result.
- Use `SIMILAR_EXISTS` when overlapping intervention or endpoint exists but the exact configuration differs.
- Use `NOT_FOUND` when no meaningfully related work appears in the results.

Output requirements (the host system enforces this schema):
- `label`: NOT_FOUND | SIMILAR_EXISTS | EXACT_MATCH
- `confidence`: number in [0, 1], calibrated to evidence strength.
- `rationale`: 1-3 sentences explaining the decision, naming the key matched / missing entities.
- `matched_entities`: object with `intervention`, `control`, `endpoint`, `model_or_system` (use empty strings when not determined).
- `references`: at most 3 of the most relevant URLs you ACTUALLY retrieved via tools. Never invent URLs.
"""


class NoveltyAgent(BaseLangGraphAgent):
    name = "novelty"
    response_schema = NoveltyResult

    def tools(self, ctx: AgentContext) -> list[BaseTool]:
        return make_novelty_tools(self.tavily)

    def system_prompt(self, ctx: AgentContext) -> str:
        return SYSTEM_PROMPT

    def user_payload(self, ctx: AgentContext) -> str:
        parts: list[str] = [
            f"Hypothesis:\n{ctx.hypothesis}",
            f"Domain: {ctx.domain or 'unspecified'}",
        ]
        regen = regeneration_instructions_block(ctx)
        if regen.strip():
            parts.append(regen.strip())
        if ctx.feedback_examples:
            compact = [
                {
                    "section": ex.get("section"),
                    "rating": ex.get("rating"),
                    "correction": ex.get("correction"),
                }
                for ex in ctx.feedback_examples[:5]
            ]
            parts.append(
                "Recent reviewer feedback (use to calibrate strictness):\n"
                + json.dumps(compact, default=str)
            )
        parts.append(
            "Run the novelty check now. Use the tools, then return the final structured result."
        )
        return "\n\n".join(parts)

    def fallback_run(self, ctx: AgentContext) -> dict[str, Any]:
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
        data = {
            "label": "SIMILAR_EXISTS" if merged else "NOT_FOUND",
            "confidence": 0.4 if merged else 0.2,
            "rationale": "LLM disabled; heuristic fallback based on retrieval.",
            "matched_entities": {
                "intervention": "",
                "control": "",
                "endpoint": "",
                "model_or_system": "",
            },
            "references": hits_to_references(merged, limit=3),
        }
        return NoveltyResult.model_validate(data).model_dump()
