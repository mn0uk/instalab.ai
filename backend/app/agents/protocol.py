from __future__ import annotations

from typing import Any

from langchain_core.tools import BaseTool

from ..providers.protocols_io import ProtocolsIoProvider
from ..providers.llm import LLMProvider
from ..providers.tavily import TavilyProvider
from ..schemas import ProtocolResult
from .base import AgentContext, hits_to_references, regeneration_instructions_block
from .langgraph_base import BaseLangGraphAgent
from .tools import make_protocol_tools


SYSTEM_PROMPT = """You are an autonomous Protocol Agent in a multi-agent AI scientist system.

Your job: produce an executable, step-by-step experimental protocol grounded in real, retrieved sources.

You have these tools:
- `protocols_io_search`: ALWAYS try this first. Returns canonical structured protocols.
- `protocols_io_get_protocol`: fetch full steps + materials by id from `protocols_io_search`.
- `tavily_search_bio_protocol`: peer-reviewed Bio-protocol.org articles.
- `tavily_search_protocols`: broader scientific-protocol web search (Nature Protocols, JOVE, OpenWetWare, etc.).
- `fetch_url_readable`: pull cleaned full text from any URL when you need exact concentrations / volumes / temperatures / durations.

Strategy:
1. Call `protocols_io_search` with a focused query that names the technique and the target system.
2. For the most relevant hit, call `protocols_io_get_protocol` to get structured steps and materials.
3. Cross-check on Bio-protocol via `tavily_search_bio_protocol` for peer-reviewed step-by-step writeups.
4. If neither source produces concrete numeric parameters (concentrations, volumes, temperatures, durations), use `tavily_search_protocols` and then `fetch_url_readable` on the most promising page to extract them.
5. Stop when you have enough concrete detail to write a protocol whose steps a competent researcher could execute without ambiguity.

Output requirements (the host system enforces this schema):
- `steps`: list of `{step_number, action, inputs, conditions, expected_output, safety_notes, citations}`. Include concrete parameter values when known.
- `critical_parameters`: list of the parameters that most affect the outcome (e.g. "primer annealing temperature", "MOI").
- `control_design`: short string describing the matched control(s).
- `risk_notes`: short string describing safety / failure risks.
- `citations`: list of references with `{title, url, source, snippet, relevance}`. Only include URLs you ACTUALLY retrieved through tools; the host code will reject invented URLs. Each step's `citations` array must list URLs you fetched for that step.
"""


class ProtocolAgent(BaseLangGraphAgent):
    name = "protocol"
    response_schema = ProtocolResult

    def __init__(
        self,
        llm: LLMProvider,
        tavily: TavilyProvider,
        protocols_io: ProtocolsIoProvider | None = None,
    ) -> None:
        super().__init__(llm=llm, tavily=tavily)
        self.protocols_io = protocols_io or ProtocolsIoProvider()

    def tools(self, ctx: AgentContext) -> list[BaseTool]:
        return make_protocol_tools(tavily=self.tavily, protocols_io=self.protocols_io)

    def system_prompt(self, ctx: AgentContext) -> str:
        return SYSTEM_PROMPT

    def user_payload(self, ctx: AgentContext) -> str:
        return (
            f"Hypothesis:\n{ctx.hypothesis}\n\n"
            f"Domain: {ctx.domain or 'unspecified'}\n\n"
            "Build the protocol now. Use the tools, then return the final structured result."
            + regeneration_instructions_block(ctx)
        )

    def fallback_run(self, ctx: AgentContext) -> dict[str, Any]:
        hits = self.tavily.search_protocols(ctx.hypothesis, max_results=4)
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
        return ProtocolResult.model_validate(data).model_dump()
