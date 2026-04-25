from __future__ import annotations

from typing import Any

from ..schemas import SynthesisResult
from .base import Agent, AgentContext, safe_json


SYSTEM = """You are the Synthesis Agent.
Review the outputs of the novelty, protocol, materials, timeline, and validation agents and report:
- An overall_confidence score (0-1) reflecting completeness and citation strength.
- A list of cross_section_conflicts (e.g., timeline mentions reagents missing from materials list).
- A short summary suitable for a scientist.

Output STRICT JSON:
{
  "overall_confidence": number,
  "cross_section_conflicts": [string],
  "summary": string
}
"""


class SynthesisAgent(Agent):
    name = "synthesis"

    def run(self, ctx: AgentContext) -> dict[str, Any]:
        bundle = {
            "novelty": ctx.prior_outputs.get("novelty"),
            "protocol": ctx.prior_outputs.get("protocol"),
            "materials": ctx.prior_outputs.get("materials"),
            "timeline": ctx.prior_outputs.get("timeline"),
            "validation": ctx.prior_outputs.get("validation"),
        }
        user = (
            f"Hypothesis:\n{ctx.hypothesis}\n\n"
            f"Section outputs:\n{safe_json(bundle)}\n\n"
            "Return the synthesis JSON now."
        )
        if self.llm.enabled:
            data = self.llm.generate_json(system=SYSTEM, user=user)
        else:
            data = {
                "overall_confidence": 0.3,
                "cross_section_conflicts": [],
                "summary": "LLM disabled; minimal synthesis emitted.",
            }
        return SynthesisResult.model_validate(data).model_dump()
