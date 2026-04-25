from __future__ import annotations

from typing import Any

from ..schemas import ProtocolResult
from .base import Agent, AgentContext, hits_to_block, hits_to_references


SYSTEM = """You are the Protocol Agent in a multi-agent AI scientist system.
Generate an executable, step-by-step experimental protocol grounded in the provided search results.

Output STRICT JSON:
{
  "steps": [
    {
      "step_number": int,
      "action": string,
      "inputs": [string],
      "conditions": string,
      "expected_output": string,
      "safety_notes": string,
      "citations": [string]
    }
  ],
  "critical_parameters": [string],
  "control_design": string,
  "risk_notes": string,
  "citations": [
    {"title": string, "url": string, "source": string, "snippet": string, "relevance": number}
  ]
}

Rules:
- Cite specific URLs from the provided search results in `citations` and step `citations`.
- Include concrete parameters (concentrations, volumes, temperatures, durations) when known.
- Prefer protocols.io, Bio-protocol, Nature Protocols, JOVE, OpenWetWare as primary sources.
"""


class ProtocolAgent(Agent):
    name = "protocol"

    def run(self, ctx: AgentContext) -> dict[str, Any]:
        hits = self.tavily.search_protocols(ctx.hypothesis, max_results=8)
        user = (
            f"Hypothesis:\n{ctx.hypothesis}\n\n"
            f"Domain: {ctx.domain or 'unspecified'}\n\n"
            f"Protocol search results:\n{hits_to_block(hits)}\n\n"
            "Return the protocol JSON now."
        )
        if self.llm.enabled:
            data = self.llm.generate_json(system=SYSTEM, user=user)
        else:
            data = {
                "steps": [
                    {
                        "step_number": 1,
                        "action": "Define experimental conditions and prepare baseline materials.",
                        "inputs": [],
                        "conditions": "LLM disabled; placeholder protocol.",
                        "expected_output": "Protocol skeleton.",
                        "safety_notes": None,
                        "citations": [h.url for h in hits[:2]],
                    }
                ],
                "critical_parameters": [],
                "control_design": "Define matched control with same baseline conditions.",
                "risk_notes": "Generated without LLM; treat as placeholder.",
                "citations": hits_to_references(hits, limit=3),
            }
        if not data.get("citations"):
            data["citations"] = hits_to_references(hits, limit=3)
        return ProtocolResult.model_validate(data).model_dump()
