from __future__ import annotations

from typing import Any

from langchain_core.tools import BaseTool

from ..schemas import MaterialsResult
from .base import AgentContext, safe_json
from .langgraph_base import BaseLangGraphAgent
from .tools import make_materials_tools


SYSTEM_PROMPT = """You are an autonomous Materials and Supply Chain Agent in a
multi-agent AI scientist system.

Your job: convert a protocol into a costed, verifiable materials list grounded
in real supplier product pages.

You have these tools:
- `search_supplier_catalog(query, supplier=None, max_results=6)`: search supplier
  catalogs for a single reagent. Pass a specific `supplier` short name when the
  reagent class strongly favors one source (primers -> "IDT", plasmids ->
  "Addgene", cell lines -> "ATCC", restriction enzymes / polymerases -> "NEB"
  or "Promega", antibodies -> "Cell Signaling" or "Abcam", common chemicals ->
  "Sigma", growth media -> "Thermo"). Pass None to search across all suppliers.
- `fetch_url_readable(url)`: fetch a single product page and return cleaned
  text. Use this on the most relevant search hit to confirm the catalog
  number, pack size, and list price before adding a line item.

Strategy:
1. Read the protocol's `steps[*].inputs` and produce a deduplicated reagent
   list. Treat the hypothesis as additional context (cell line, organism,
   intervention) when an input is generic.
2. For each reagent, choose the best-fit supplier (see hints above) and call
   `search_supplier_catalog`.
3. For the top hit, call `fetch_url_readable` to extract:
   - `catalog_number` (e.g. "9542", "AB12345")
   - `pack_size` (e.g. "500 mg", "1 ml", "100 ug")
   - `unit_price` and `currency`
4. If the page does not show a price (login-walled, quote-only), set
   `unit_price=null` and explain in `notes` (e.g. "Quote-only; estimated").
5. Stop when every distinct reagent in the protocol has either a populated
   line item or an explicit `notes` reason.

Output requirements (the host system enforces this schema):
- `line_items`: each item has `name`, `supplier`, `catalog_number`, `pack_size`,
  `unit_price`, `currency`, `quantity`, `notes`, `source_url`.
- `source_url` MUST be a URL you actually fetched via `fetch_url_readable` or
  that appeared in `search_supplier_catalog` results. Never invent URLs.
- `currency` should be one of "USD", "EUR", "GBP".
- `quantity` is the count of the chosen pack size you would buy for the run.
- `budget_total` is the sum of `unit_price * quantity` across line items where
  both are present; the host will recompute it if you leave it at 0.
- `lead_time_risks`: short bullets for items likely to have long lead time
  (custom oligos, custom antibodies, plasmids on MTA, controlled substances).
- `substitution_notes`: short bullets recommending substitutions when the
  preferred supplier is out of stock or expensive.
"""


class MaterialsAgent(BaseLangGraphAgent):
    name = "materials"
    response_schema = MaterialsResult

    def tools(self, ctx: AgentContext) -> list[BaseTool]:
        return make_materials_tools(self.tavily)

    def system_prompt(self, ctx: AgentContext) -> str:
        return SYSTEM_PROMPT

    def user_payload(self, ctx: AgentContext) -> str:
        protocol = ctx.prior_outputs.get("protocol", {})
        return (
            f"Hypothesis:\n{ctx.hypothesis}\n\n"
            f"Domain: {ctx.domain or 'unspecified'}\n\n"
            f"Protocol JSON:\n{safe_json(protocol)}\n\n"
            "Build the materials list now. Use the tools, then return the final "
            "structured result."
        )

    def fallback_run(self, ctx: AgentContext) -> dict[str, Any]:
        data = {
            "line_items": [],
            "budget_total": 0.0,
            "currency": "USD",
            "lead_time_risks": ["LLM disabled; supplier mapping requires LLM."],
            "substitution_notes": [],
        }
        return MaterialsResult.model_validate(data).model_dump()

    def run(self, ctx: AgentContext) -> dict[str, Any]:
        # Recompute budget_total post-validation when the LLM forgets it.
        result = super().run(ctx)
        try:
            validated = MaterialsResult.model_validate(result)
        except Exception:
            return result
        if not validated.budget_total and validated.line_items:
            validated.budget_total = sum(
                (li.unit_price or 0) * (li.quantity or 0)
                for li in validated.line_items
            )
        return validated.model_dump()
