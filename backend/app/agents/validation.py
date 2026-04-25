from __future__ import annotations

from typing import Any

from ..schemas import ValidationResult
from .base import Agent, AgentContext, hits_to_block, safe_json


SYSTEM = """You are the Validation Approach Agent.
Define how the experiment's success or failure will be measured.

Output STRICT JSON:
{
  "primary_endpoint": string,
  "secondary_endpoints": [string],
  "acceptance_criteria": [string],
  "qa_checks": [string],
  "standards_referenced": [string]
}

Rules:
- Tie acceptance_criteria to thresholds named in the hypothesis when present.
- For qPCR-based assays, reference MIQE guidelines explicitly.
- Use the standards search results to populate `standards_referenced` with URLs.
"""


class ValidationAgent(Agent):
    name = "validation"

    def run(self, ctx: AgentContext) -> dict[str, Any]:
        protocol = ctx.prior_outputs.get("protocol", {})
        standards_hits = self.tavily.search_standards(
            f"validation guidelines {ctx.domain or ''} {ctx.hypothesis}",
            max_results=4,
        )
        user = (
            f"Hypothesis:\n{ctx.hypothesis}\n\n"
            f"Protocol JSON:\n{safe_json(protocol)}\n\n"
            f"Standards search results:\n{hits_to_block(standards_hits)}\n\n"
            "Return the validation JSON now."
        )
        if self.llm.enabled:
            data = self.llm.generate_json(system=SYSTEM, user=user)
        else:
            data = {
                "primary_endpoint": "Define a quantitative endpoint linked to the hypothesis threshold.",
                "secondary_endpoints": [],
                "acceptance_criteria": ["LLM disabled; placeholder acceptance criterion."],
                "qa_checks": ["Include positive and negative controls."],
                "standards_referenced": [h.url for h in standards_hits[:3]],
            }
        return ValidationResult.model_validate(data).model_dump()
