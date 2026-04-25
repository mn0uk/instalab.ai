"""Phase 1 smoke tests for the LangGraph-based Novelty and Protocol agents.

These tests are designed to run without any network access, OpenAI key, Tavily
key, or protocols.io token. They cover:

  1. Schema-valid output from the LLM-disabled fallback paths.
  2. Correct tool list / ordering exposed to the LangGraph ReAct loop.
  3. Streaming bridge: BaseLangGraphAgent._emit_message_events forwards
     AIMessage tool-calls and ToolMessage results through the event callback.
  4. Orchestrator wires on_agent_event into AgentContext.event_callback.

Run with `pytest backend/tests/test_phase1_agents.py` or directly via
`python backend/tests/test_phase1_agents.py`.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

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
from app.agents.novelty import NoveltyAgent  # noqa: E402
from app.agents.orchestrator import Orchestrator  # noqa: E402
from app.agents.protocol import ProtocolAgent  # noqa: E402
from app.providers.llm import LLMProvider  # noqa: E402
from app.providers.protocols_io import ProtocolsIoProvider  # noqa: E402
from app.providers.tavily import TavilyProvider  # noqa: E402
from app.schemas import NoveltyResult, ProtocolResult  # noqa: E402


def _build_novelty_agent() -> NoveltyAgent:
    return NoveltyAgent(LLMProvider(api_key=""), TavilyProvider(api_key=""))


def _build_protocol_agent() -> ProtocolAgent:
    return ProtocolAgent(
        LLMProvider(api_key=""),
        TavilyProvider(api_key=""),
        ProtocolsIoProvider(token=""),
    )


def test_novelty_fallback_emits_schema_valid_output() -> None:
    agent = _build_novelty_agent()
    ctx = AgentContext(hypothesis="CRISPR knockdown of MYC reduces HeLa proliferation by 30%.")
    out = agent.run(ctx)
    NoveltyResult.model_validate(out)
    assert out["label"] in {"NOT_FOUND", "SIMILAR_EXISTS", "EXACT_MATCH"}
    assert "rationale" in out and isinstance(out["rationale"], str)


def test_protocol_fallback_emits_schema_valid_output() -> None:
    agent = _build_protocol_agent()
    ctx = AgentContext(hypothesis="qPCR validation of MYC knockdown in HeLa cells.")
    out = agent.run(ctx)
    ProtocolResult.model_validate(out)
    assert isinstance(out["steps"], list) and len(out["steps"]) >= 1
    assert "control_design" in out


def test_novelty_tools_expose_all_expected_sources() -> None:
    agent = _build_novelty_agent()
    ctx = AgentContext(hypothesis="placeholder")
    names = [t.name for t in agent.tools(ctx)]
    expected = {
        "search_semantic_scholar",
        "search_arxiv",
        "search_pubmed",
        "tavily_search_novelty",
        "fetch_url_readable",
    }
    assert expected.issubset(set(names)), f"missing tools: {expected - set(names)}"


def test_protocol_tools_put_protocols_io_first() -> None:
    agent = _build_protocol_agent()
    ctx = AgentContext(hypothesis="placeholder")
    names = [t.name for t in agent.tools(ctx)]
    expected = {
        "protocols_io_search",
        "protocols_io_get_protocol",
        "tavily_search_bio_protocol",
        "tavily_search_protocols",
        "fetch_url_readable",
    }
    assert expected.issubset(set(names))
    assert names[0] == "protocols_io_search", (
        "protocols_io_search must be the first tool so the ReAct loop tries it first; "
        f"got order {names}"
    )
    assert "ALWAYS try this first" in agent.system_prompt(ctx)


def test_emit_message_events_forwards_tool_calls_and_results() -> None:
    from langchain_core.messages import AIMessage, ToolMessage

    agent = _build_novelty_agent()
    events: list[tuple[str, str, dict]] = []

    def cb(name: str, kind: str, payload: dict) -> None:
        events.append((name, kind, payload))

    messages = [
        AIMessage(
            content="",
            tool_calls=[
                {
                    "id": "call_1",
                    "name": "search_semantic_scholar",
                    "args": {"query": "MYC HeLa", "limit": 6},
                }
            ],
        ),
        ToolMessage(
            content="[{\"title\": \"some paper\"}]",
            tool_call_id="call_1",
            name="search_semantic_scholar",
        ),
        AIMessage(content="Final answer."),
    ]
    agent._emit_message_events(cb, messages)
    kinds = [e[1] for e in events]
    assert kinds == ["tool_start", "tool_end"], f"unexpected kinds: {kinds}"
    assert events[0][2]["tool"] == "search_semantic_scholar"
    assert events[0][2]["args"]["query"] == "MYC HeLa"
    assert events[1][2]["tool"] == "search_semantic_scholar"
    assert events[1][2]["tool_call_id"] == "call_1"


def test_orchestrator_passes_event_callback_to_context() -> None:
    captured_ctx: dict[str, AgentContext] = {}

    class StubAgent:
        name = "stub"

        def run(self, ctx: AgentContext) -> dict:
            captured_ctx["ctx"] = ctx
            return {"ok": True}

    orch = Orchestrator()
    orch.novelty_agent = StubAgent()  # type: ignore[assignment]
    orch.protocol_agent = StubAgent()  # type: ignore[assignment]
    orch.materials_agent = StubAgent()  # type: ignore[assignment]
    orch.timeline_agent = StubAgent()  # type: ignore[assignment]
    orch.validation_agent = StubAgent()  # type: ignore[assignment]
    orch.synthesis_agent = StubAgent()  # type: ignore[assignment]

    ctx = AgentContext(hypothesis="x" * 20)

    def on_event(name: str, kind: str, payload: dict) -> None:
        pass

    orch.run(ctx, on_agent_event=on_event)
    assert captured_ctx["ctx"].event_callback is on_event


def test_protocols_io_provider_disabled_returns_empty_results() -> None:
    p = ProtocolsIoProvider(token="")
    assert not p.enabled
    assert p.search("anything") == []
    assert p.get_protocol("any-id") is None


def test_web_fetch_handles_invalid_url_gracefully() -> None:
    from app.providers.web_fetch import fetch_readable

    page = fetch_readable("http://invalid.invalid.invalid.example.invalid/")
    assert page.text == ""
    assert page.url.startswith("http://")


def _run_all() -> int:
    tests = [
        test_novelty_fallback_emits_schema_valid_output,
        test_protocol_fallback_emits_schema_valid_output,
        test_novelty_tools_expose_all_expected_sources,
        test_protocol_tools_put_protocols_io_first,
        test_emit_message_events_forwards_tool_calls_and_results,
        test_orchestrator_passes_event_callback_to_context,
        test_protocols_io_provider_disabled_returns_empty_results,
        test_web_fetch_handles_invalid_url_gracefully,
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
