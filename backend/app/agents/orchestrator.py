from __future__ import annotations

import logging
from dataclasses import dataclass

from ..providers.llm import LLMProvider
from ..providers.tavily import TavilyProvider
from .base import Agent, AgentContext
from .materials import MaterialsAgent
from .novelty import NoveltyAgent
from .protocol import ProtocolAgent
from .synthesis import SynthesisAgent
from .timeline import TimelineAgent
from .validation import ValidationAgent


logger = logging.getLogger(__name__)


@dataclass
class OrchestratorResult:
    novelty: dict
    protocol: dict
    materials: dict
    timeline: dict
    validation: dict
    synthesis: dict
    agent_errors: dict[str, str]


class Orchestrator:
    def __init__(self, llm: LLMProvider | None = None, tavily: TavilyProvider | None = None) -> None:
        self.llm = llm or LLMProvider()
        self.tavily = tavily or TavilyProvider()
        self.novelty_agent = NoveltyAgent(self.llm, self.tavily)
        self.protocol_agent = ProtocolAgent(self.llm, self.tavily)
        self.materials_agent = MaterialsAgent(self.llm, self.tavily)
        self.timeline_agent = TimelineAgent(self.llm, self.tavily)
        self.validation_agent = ValidationAgent(self.llm, self.tavily)
        self.synthesis_agent = SynthesisAgent(self.llm, self.tavily)

    def run(
        self,
        ctx: AgentContext,
        on_agent_complete=None,
    ) -> OrchestratorResult:
        outputs: dict[str, dict] = {}
        errors: dict[str, str] = {}

        # Phase 1: novelty + protocol can run in parallel logically; we do them serially for simplicity.
        for agent in (self.novelty_agent, self.protocol_agent):
            outputs[agent.name] = self._safe_run(agent, ctx, outputs, errors, on_agent_complete)

        # Phase 2: materials depends on protocol
        ctx.prior_outputs = outputs
        outputs[self.materials_agent.name] = self._safe_run(
            self.materials_agent, ctx, outputs, errors, on_agent_complete
        )

        # Phase 3: timeline depends on protocol + materials
        ctx.prior_outputs = outputs
        outputs[self.timeline_agent.name] = self._safe_run(
            self.timeline_agent, ctx, outputs, errors, on_agent_complete
        )

        # Phase 4: validation depends on protocol
        outputs[self.validation_agent.name] = self._safe_run(
            self.validation_agent, ctx, outputs, errors, on_agent_complete
        )

        # Phase 5: synthesis over all
        ctx.prior_outputs = outputs
        outputs[self.synthesis_agent.name] = self._safe_run(
            self.synthesis_agent, ctx, outputs, errors, on_agent_complete
        )

        return OrchestratorResult(
            novelty=outputs.get(self.novelty_agent.name, {}),
            protocol=outputs.get(self.protocol_agent.name, {}),
            materials=outputs.get(self.materials_agent.name, {}),
            timeline=outputs.get(self.timeline_agent.name, {}),
            validation=outputs.get(self.validation_agent.name, {}),
            synthesis=outputs.get(self.synthesis_agent.name, {}),
            agent_errors=errors,
        )

    def _safe_run(
        self,
        agent: Agent,
        ctx: AgentContext,
        outputs: dict,
        errors: dict,
        on_agent_complete,
    ) -> dict:
        if on_agent_complete:
            on_agent_complete(agent.name, "RUNNING", None, None)
        try:
            result = agent.run(ctx)
            if on_agent_complete:
                on_agent_complete(agent.name, "SUCCEEDED", result, None)
            return result
        except Exception as exc:
            logger.exception("Agent %s failed", agent.name)
            errors[agent.name] = str(exc)
            if on_agent_complete:
                on_agent_complete(agent.name, "FAILED", None, str(exc))
            return {}
