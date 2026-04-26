"""Phase 2 smoke tests for the migrated Materials, Timeline, Validation, and
Synthesis agents.

These tests are designed to run without any network access, OpenAI key, or
Tavily key. They cover:

  1. Schema-valid output from the LLM-disabled fallback paths for all four
     migrated agents.
  2. The Materials agent's tool list exposes the expected tool names in the
     expected order (search-first-then-fetch).
  3. BaseStructuredLLMAgent: with a stub model that returns a Pydantic
     instance, the agent's `run` round-trips it through the response schema.
  4. BaseStructuredLLMAgent: when the stub model raises, the agent falls back
     to `fallback_run` instead of bubbling the exception.

Run with `pytest backend/tests/test_phase2_agents.py` or directly via
`python backend/tests/test_phase2_agents.py`.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Make sure no real credentials are picked up from a local .env when running
# these tests. They MUST exercise the LLM-disabled / token-disabled paths.
for var in (
    "OPENAI_API_KEY",
    "TAVILY_API_KEY",
    "PROTOCOLS_IO_TOKEN",
    "SEMANTIC_SCHOLAR_API_KEY",
):
    os.environ.pop(var, None)
os.environ["OPENAI_API_KEY"] = ""
os.environ["TAVILY_API_KEY"] = ""
os.environ["PROTOCOLS_IO_TOKEN"] = ""
os.environ["SEMANTIC_SCHOLAR_API_KEY"] = ""

from app.settings import get_settings  # noqa: E402

get_settings.cache_clear()  # type: ignore[attr-defined]

from app.agents.base import AgentContext  # noqa: E402
from app.agents.materials import MaterialsAgent  # noqa: E402
from app.agents.structured_base import BaseStructuredLLMAgent  # noqa: E402
from app.agents.synthesis import SynthesisAgent  # noqa: E402
from app.agents.timeline import TimelineAgent  # noqa: E402
from app.agents.validation import ValidationAgent  # noqa: E402
from app.providers.llm import LLMProvider  # noqa: E402
from app.providers.tavily import TavilyProvider  # noqa: E402
from app.schemas import (  # noqa: E402
    MaterialsResult,
    SynthesisResult,
    TimelineResult,
    ValidationResult,
)


def _build_materials_agent() -> MaterialsAgent:
    return MaterialsAgent(LLMProvider(api_key=""), TavilyProvider(api_key=""))


def _build_timeline_agent() -> TimelineAgent:
    return TimelineAgent(LLMProvider(api_key=""), TavilyProvider(api_key=""))


def _build_validation_agent() -> ValidationAgent:
    return ValidationAgent(LLMProvider(api_key=""), TavilyProvider(api_key=""))


def _build_synthesis_agent() -> SynthesisAgent:
    return SynthesisAgent(LLMProvider(api_key=""), TavilyProvider(api_key=""))


_PROTOCOL_BUNDLE = {
    "steps": [
        {
            "step_number": 1,
            "action": "Seed HEK293 cells in 6-well plates.",
            "inputs": ["HEK293 cells", "DMEM", "FBS"],
            "conditions": "37 C, 5% CO2",
            "expected_output": "70% confluence in 24 h",
            "safety_notes": None,
            "citations": [],
        },
        {
            "step_number": 2,
            "action": "Treat with rapamycin.",
            "inputs": ["rapamycin", "DMSO"],
            "conditions": "100 nM, 6 h",
            "expected_output": "Reduced LC3-II/LC3-I",
            "safety_notes": None,
            "citations": [],
        },
    ],
    "critical_parameters": ["rapamycin concentration", "treatment duration"],
    "control_design": "Vehicle (DMSO) matched control.",
    "risk_notes": "Handle rapamycin/DMSO with care.",
    "citations": [],
}

_MATERIALS_BUNDLE = {
    "line_items": [],
    "budget_total": 0.0,
    "currency": "USD",
    "lead_time_risks": [],
    "substitution_notes": [],
}


def test_materials_fallback_emits_schema_valid_output() -> None:
    agent = _build_materials_agent()
    ctx = AgentContext(
        hypothesis="100 nM rapamycin reduces LC3-II/LC3-I in HEK293 by 40% in 6 h.",
        prior_outputs={"protocol": _PROTOCOL_BUNDLE},
    )
    out = agent.run(ctx)
    MaterialsResult.model_validate(out)
    assert out["currency"] == "USD"
    assert isinstance(out["lead_time_risks"], list)


def test_timeline_fallback_emits_schema_valid_output() -> None:
    agent = _build_timeline_agent()
    ctx = AgentContext(
        hypothesis="100 nM rapamycin reduces LC3-II/LC3-I in HEK293 by 40% in 6 h.",
        prior_outputs={"protocol": _PROTOCOL_BUNDLE, "materials": _MATERIALS_BUNDLE},
    )
    out = agent.run(ctx)
    TimelineResult.model_validate(out)
    assert isinstance(out["phases"], list) and len(out["phases"]) >= 1
    assert isinstance(out["critical_path_days"], int)


def test_validation_fallback_emits_schema_valid_output() -> None:
    agent = _build_validation_agent()
    ctx = AgentContext(
        hypothesis="100 nM rapamycin reduces LC3-II/LC3-I in HEK293 by 40% in 6 h.",
        domain="cell biology",
        prior_outputs={"protocol": _PROTOCOL_BUNDLE},
    )
    out = agent.run(ctx)
    ValidationResult.model_validate(out)
    assert out["primary_endpoint"]
    assert isinstance(out["qa_checks"], list) and len(out["qa_checks"]) >= 1


def test_synthesis_fallback_emits_schema_valid_output() -> None:
    agent = _build_synthesis_agent()
    ctx = AgentContext(
        hypothesis="100 nM rapamycin reduces LC3-II/LC3-I in HEK293 by 40% in 6 h.",
        prior_outputs={
            "novelty": {
                "label": "SIMILAR_EXISTS",
                "confidence": 0.5,
                "rationale": "stub",
                "references": [],
                "matched_entities": {
                    "intervention": "",
                    "control": "",
                    "endpoint": "",
                    "model_or_system": "",
                },
            },
            "protocol": _PROTOCOL_BUNDLE,
            "materials": _MATERIALS_BUNDLE,
            "timeline": {
                "phases": [],
                "critical_path_days": 0,
                "parallelization_notes": "stub",
            },
            "validation": {
                "primary_endpoint": "stub",
                "secondary_endpoints": [],
                "acceptance_criteria": [],
                "qa_checks": [],
                "standards_referenced": [],
            },
        },
    )
    out = agent.run(ctx)
    SynthesisResult.model_validate(out)
    assert isinstance(out["overall_confidence"], (int, float))
    assert isinstance(out["summary"], str)


def test_materials_tools_search_first_then_fetch() -> None:
    agent = _build_materials_agent()
    ctx = AgentContext(hypothesis="placeholder")
    names = [t.name for t in agent.tools(ctx)]
    expected = {"search_supplier_catalog", "fetch_url_readable"}
    assert expected.issubset(set(names)), f"missing tools: {expected - set(names)}"
    assert names[0] == "search_supplier_catalog", (
        "search_supplier_catalog must come first so the ReAct loop searches "
        f"before fetching; got order {names}"
    )


class _StubStructuredAgent(BaseStructuredLLMAgent):
    name = "stub"
    response_schema = TimelineResult

    def __init__(self, *, model: Any) -> None:
        # Bypass Agent.__init__ for the stub: we don't need llm/tavily here.
        self._stub_model = model

    def _model(self) -> Any:
        return self._stub_model

    def system_prompt(self, ctx: AgentContext) -> str:
        return "system"

    def user_payload(self, ctx: AgentContext) -> str:
        return "user"

    def fallback_run(self, ctx: AgentContext) -> dict[str, Any]:
        return TimelineResult.model_validate(
            {
                "phases": [
                    {
                        "name": "Fallback",
                        "duration_days": 1,
                        "depends_on": [],
                        "parallelizable": False,
                        "notes": "fallback",
                    }
                ],
                "critical_path_days": 1,
                "parallelization_notes": "fallback",
            }
        ).model_dump()


class _StubChainStructuredOutput:
    """Mimic the object returned by ChatModel.with_structured_output(schema)."""

    def __init__(self, payload: Any) -> None:
        self._payload = payload

    def invoke(self, _messages: Any) -> Any:
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class _StubChatModel:
    def __init__(self, payload: Any) -> None:
        self._payload = payload

    def with_structured_output(self, _schema: Any) -> _StubChainStructuredOutput:
        return _StubChainStructuredOutput(self._payload)


def test_structured_base_returns_validated_pydantic_output() -> None:
    payload = TimelineResult.model_validate(
        {
            "phases": [
                {
                    "name": "Phase A",
                    "duration_days": 5,
                    "depends_on": [],
                    "parallelizable": False,
                    "notes": "stub",
                }
            ],
            "critical_path_days": 5,
            "parallelization_notes": "stub",
        }
    )
    agent = _StubStructuredAgent(model=_StubChatModel(payload))
    out = agent.run(AgentContext(hypothesis="x" * 20))
    TimelineResult.model_validate(out)
    assert out["critical_path_days"] == 5
    assert out["phases"][0]["name"] == "Phase A"


def test_structured_base_falls_back_when_model_raises() -> None:
    agent = _StubStructuredAgent(
        model=_StubChatModel(RuntimeError("simulated provider failure"))
    )
    out = agent.run(AgentContext(hypothesis="x" * 20))
    TimelineResult.model_validate(out)
    assert out["phases"][0]["name"] == "Fallback"


def _run_all() -> int:
    tests = [
        test_materials_fallback_emits_schema_valid_output,
        test_timeline_fallback_emits_schema_valid_output,
        test_validation_fallback_emits_schema_valid_output,
        test_synthesis_fallback_emits_schema_valid_output,
        test_materials_tools_search_first_then_fetch,
        test_structured_base_returns_validated_pydantic_output,
        test_structured_base_falls_back_when_model_raises,
    ]
    failures = 0
    for fn in tests:
        try:
            fn()
            print(f"PASS  {fn.__name__}")
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"FAIL  {fn.__name__}: {type(exc).__name__}: {exc}")
    print(f"\n{len(tests) - failures}/{len(tests)} passed")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(_run_all())
