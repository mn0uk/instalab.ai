from __future__ import annotations

from typing import Any

from ..schemas import ValidationResult
from .base import AgentContext, hits_to_block, regeneration_instructions_block, safe_json
from .structured_base import BaseStructuredLLMAgent


SYSTEM_PROMPT = """You are the Validation Approach Agent in a multi-agent AI scientist system.

Define how the experiment's success or failure will be measured.

Rules:
- Tie `acceptance_criteria` to thresholds named in the hypothesis when present
  (e.g. "at least 40% reduction in LC3-II/LC3-I ratio at 6 h").
- For qPCR-based assays, reference MIQE guidelines explicitly in `qa_checks`
  and include the MIQE URL (or another retrieved standard) in
  `standards_referenced`.
- Always include positive and negative controls in `qa_checks`.
- `standards_referenced` MUST be URLs that appear in the standards search
  results provided in the user message; do not invent URLs.
- `primary_endpoint` is one short sentence; `secondary_endpoints` are short
  bullets. Both should be quantitative whenever possible.
"""


class ValidationAgent(BaseStructuredLLMAgent):
    name = "validation"
    response_schema = ValidationResult

    def user_payload(self, ctx: AgentContext) -> str:
        protocol = ctx.prior_outputs.get("protocol", {})
        standards_hits = self.tavily.search_standards(
            f"validation guidelines {ctx.domain or ''} {ctx.hypothesis}",
            max_results=4,
        )
        return (
            f"Hypothesis:\n{ctx.hypothesis}\n\n"
            f"Domain: {ctx.domain or 'unspecified'}\n\n"
            f"Protocol JSON:\n{safe_json(protocol)}\n\n"
            f"Standards search results:\n{hits_to_block(standards_hits)}\n\n"
            "Define the validation approach now and return the structured result."
            + regeneration_instructions_block(ctx)
        )

    def system_prompt(self, ctx: AgentContext) -> str:
        return SYSTEM_PROMPT

    def fallback_run(self, ctx: AgentContext) -> dict[str, Any]:
        standards_hits = self.tavily.search_standards(
            f"validation guidelines {ctx.domain or ''} {ctx.hypothesis}",
            max_results=4,
        )
        data = {
            "primary_endpoint": "Define a quantitative endpoint linked to the hypothesis threshold.",
            "secondary_endpoints": [],
            "acceptance_criteria": ["LLM disabled; placeholder acceptance criterion."],
            "qa_checks": ["Include positive and negative controls."],
            "standards_referenced": [h.url for h in standards_hits[:3]],
        }
        return ValidationResult.model_validate(data).model_dump()
