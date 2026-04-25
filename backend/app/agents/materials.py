from __future__ import annotations

from typing import Any

from ..schemas import MaterialsResult
from .base import Agent, AgentContext, hits_to_block, safe_json  # noqa: F401


SYSTEM = """You are the Materials and Supply Chain Agent.
Convert the provided protocol into a costed materials list using the supplier search results.

Output STRICT JSON:
{
  "line_items": [
    {
      "name": string,
      "supplier": string,
      "catalog_number": string,
      "pack_size": string,
      "unit_price": number,
      "currency": "USD" | "EUR" | "GBP",
      "quantity": number,
      "notes": string,
      "source_url": string
    }
  ],
  "budget_total": number,
  "currency": "USD" | "EUR" | "GBP",
  "lead_time_risks": [string],
  "substitution_notes": [string]
}

Rules:
- Prefer suppliers from Thermo Fisher, Sigma-Aldrich, Promega, Qiagen, IDT, ATCC, Addgene.
- Only use catalog/source URLs that appear in the provided search results.
- If exact catalog data is unavailable, leave catalog_number null and explain in notes.
- Compute budget_total as the sum of (unit_price * quantity) for line items where both are present.
"""


class MaterialsAgent(Agent):
    name = "materials"

    def run(self, ctx: AgentContext) -> dict[str, Any]:
        protocol = ctx.prior_outputs.get("protocol", {})
        reagent_query = _reagent_query_from_protocol(protocol, ctx.hypothesis)

        supplier_hits = self.tavily.search_suppliers(reagent_query, max_results=8)
        reagent_hits = self.tavily.search_reagents(reagent_query, max_results=4)
        merged = supplier_hits + reagent_hits

        user = (
            f"Hypothesis:\n{ctx.hypothesis}\n\n"
            f"Protocol JSON:\n{safe_json(protocol)}\n\n"
            f"Supplier and reagent search results:\n{hits_to_block(merged)}\n\n"
            "Return the materials JSON now."
        )

        if self.llm.enabled:
            data = self.llm.generate_json(system=SYSTEM, user=user)
        else:
            data = {
                "line_items": [],
                "budget_total": 0.0,
                "currency": "USD",
                "lead_time_risks": ["LLM disabled; supplier mapping requires LLM."],
                "substitution_notes": [],
            }

        result = MaterialsResult.model_validate(data)
        if not result.budget_total and result.line_items:
            result.budget_total = sum(
                (li.unit_price or 0) * (li.quantity or 0) for li in result.line_items
            )
        return result.model_dump()


def _reagent_query_from_protocol(protocol: dict, fallback: str) -> str:
    inputs: list[str] = []
    for step in protocol.get("steps", []) or []:
        inputs.extend(step.get("inputs", []) or [])
    if inputs:
        unique = []
        seen: set[str] = set()
        for item in inputs:
            key = (item or "").strip().lower()
            if key and key not in seen:
                seen.add(key)
                unique.append(item.strip())
        return " ".join(unique[:8])
    return fallback
