from __future__ import annotations

from typing import Any

from ..schemas import TimelineResult
from .base import AgentContext, regeneration_instructions_block, safe_json
from .structured_base import BaseStructuredLLMAgent


SYSTEM_PROMPT = """You are the Timeline Agent in a multi-agent AI scientist system.

Build a realistic phased project timeline using the protocol and materials context.

Rules:
- Account for procurement lead time when the materials list mentions lead-time risks.
- Identify dependencies between phases (procurement -> setup -> execution -> analysis).
- `critical_path_days` MUST equal the longest dependency chain in days through the
  `phases` you produce. Set `parallelizable=true` only for phases that can truly
  run in parallel with another phase (i.e. they do not appear in each other's
  `depends_on` chain).
- Phase names should be short, action-oriented strings (e.g. "Procurement",
  "Cell line expansion", "Treatment & sampling", "Imaging & analysis").
"""


class TimelineAgent(BaseStructuredLLMAgent):
    name = "timeline"
    response_schema = TimelineResult

    def system_prompt(self, ctx: AgentContext) -> str:
        return SYSTEM_PROMPT

    def user_payload(self, ctx: AgentContext) -> str:
        protocol = ctx.prior_outputs.get("protocol", {})
        materials = ctx.prior_outputs.get("materials", {})
        return (
            f"Hypothesis:\n{ctx.hypothesis}\n\n"
            f"Domain: {ctx.domain or 'unspecified'}\n\n"
            f"Protocol JSON:\n{safe_json(protocol)}\n\n"
            f"Materials JSON:\n{safe_json(materials)}\n\n"
            "Build the timeline now and return the structured result."
            + regeneration_instructions_block(ctx)
        )

    def fallback_run(self, ctx: AgentContext) -> dict[str, Any]:
        data = {
            "phases": [
                {
                    "name": "Procurement",
                    "duration_days": 14,
                    "depends_on": [],
                    "parallelizable": False,
                    "notes": "Placeholder.",
                },
                {
                    "name": "Setup and execution",
                    "duration_days": 21,
                    "depends_on": ["Procurement"],
                    "parallelizable": False,
                    "notes": "Placeholder.",
                },
                {
                    "name": "Analysis and reporting",
                    "duration_days": 7,
                    "depends_on": ["Setup and execution"],
                    "parallelizable": False,
                    "notes": "Placeholder.",
                },
            ],
            "critical_path_days": 42,
            "parallelization_notes": "LLM disabled; placeholder schedule.",
        }
        return TimelineResult.model_validate(data).model_dump()
