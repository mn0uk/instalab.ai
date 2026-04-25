from __future__ import annotations

from typing import Any

from ..schemas import TimelineResult
from .base import Agent, AgentContext, safe_json


SYSTEM = """You are the Timeline Agent.
Build a realistic phased project timeline using the protocol and materials context.

Output STRICT JSON:
{
  "phases": [
    {
      "name": string,
      "duration_days": int,
      "depends_on": [string],
      "parallelizable": bool,
      "notes": string
    }
  ],
  "critical_path_days": int,
  "parallelization_notes": string
}

Rules:
- Account for procurement lead time when materials list mentions lead-time risks.
- Identify dependencies between phases (procurement -> setup -> execution -> analysis).
- critical_path_days must equal the longest dependency chain in days.
"""


class TimelineAgent(Agent):
    name = "timeline"

    def run(self, ctx: AgentContext) -> dict[str, Any]:
        protocol = ctx.prior_outputs.get("protocol", {})
        materials = ctx.prior_outputs.get("materials", {})
        user = (
            f"Hypothesis:\n{ctx.hypothesis}\n\n"
            f"Protocol JSON:\n{safe_json(protocol)}\n\n"
            f"Materials JSON:\n{safe_json(materials)}\n\n"
            "Return the timeline JSON now."
        )
        if self.llm.enabled:
            data = self.llm.generate_json(system=SYSTEM, user=user)
        else:
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
