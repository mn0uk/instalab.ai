from __future__ import annotations

from typing import Any

from ..schemas import SynthesisResult
from .base import AgentContext, regeneration_instructions_block, safe_json
from .structured_base import BaseStructuredLLMAgent


SYSTEM_PROMPT = """You are the Synthesis Agent in a multi-agent AI scientist system.

Review the outputs of the novelty, protocol, materials, timeline, and validation
agents and produce:

- `overall_confidence`: a number in [0, 1] reflecting completeness, internal
  consistency, and citation strength across the bundle.
- `cross_section_conflicts`: concrete conflicts between sections, each phrased as
  one sentence (e.g. "Timeline mentions 'antibody validation' phase but materials
  list does not include any antibody"). Empty list if no conflicts found.
- `conflicts`: the SAME conflicts surfaced as a structured list, each item with
  `title` (≤8 words, the headline) and `detail` (1 sentence explaining why it
  matters). The UI renders this as a 3-cell grid, so prefer 0, 1, 2, or 3 items.
  Keep `cross_section_conflicts` and `conflicts` consistent with each other.
- `summary`: a short paragraph (3-6 sentences) suitable for a working scientist:
  what is being proposed, why it matters, the main risks, and the headline cost
  and duration if available from the materials and timeline sections.

Be honest. If a section is empty or clearly placeholder, lower the confidence
and call it out in the summary.
"""


class SynthesisAgent(BaseStructuredLLMAgent):
    name = "synthesis"
    response_schema = SynthesisResult

    def system_prompt(self, ctx: AgentContext) -> str:
        return SYSTEM_PROMPT

    def user_payload(self, ctx: AgentContext) -> str:
        bundle = {
            "novelty": ctx.prior_outputs.get("novelty"),
            "protocol": ctx.prior_outputs.get("protocol"),
            "materials": ctx.prior_outputs.get("materials"),
            "timeline": ctx.prior_outputs.get("timeline"),
            "validation": ctx.prior_outputs.get("validation"),
        }
        return (
            f"Hypothesis:\n{ctx.hypothesis}\n\n"
            f"Domain: {ctx.domain or 'unspecified'}\n\n"
            f"Section outputs:\n{safe_json(bundle)}\n\n"
            "Synthesize the bundle now and return the structured result."
            + regeneration_instructions_block(ctx)
        )

    def fallback_run(self, ctx: AgentContext) -> dict[str, Any]:
        data = {
            "overall_confidence": 0.3,
            "cross_section_conflicts": [],
            "conflicts": [],
            "summary": "LLM disabled; minimal synthesis emitted.",
        }
        return SynthesisResult.model_validate(data).model_dump()
