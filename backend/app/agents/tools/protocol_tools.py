from __future__ import annotations

from dataclasses import asdict
from typing import Any

from langchain_core.tools import BaseTool, tool

from ...providers.protocols_io import ProtocolsIoProvider
from ...providers.tavily import TavilyProvider
from .search_tools import make_web_fetch_tool


BIO_PROTOCOL_DOMAIN = ("bio-protocol.org",)


def make_protocol_tools(
    *,
    tavily: TavilyProvider,
    protocols_io: ProtocolsIoProvider,
) -> list[BaseTool]:
    """Build the tool set the Protocol agent uses to draft executable protocols."""

    @tool
    def protocols_io_search(query: str, max_results: int = 6) -> list[dict[str, Any]]:
        """Search protocols.io for canonical, structured experimental protocols.

        ALWAYS try this tool first when drafting a protocol. Returns lightweight
        hits with `id`, `title`, `url`, `doi`, and a short description. After
        picking the most relevant hit(s), call `protocols_io_get_protocol` with
        the `id` to fetch the full step-by-step procedure and materials list.
        Returns an empty list when the protocols.io API token is not configured;
        in that case, fall back to `tavily_search_bio_protocol` and
        `tavily_search_protocols`.
        """

        return [asdict(h) for h in protocols_io.search(query, max_results=max_results)]

    @tool
    def protocols_io_get_protocol(protocol_id: str) -> dict[str, Any] | None:
        """Fetch the full structured protocol (steps, materials, durations, DOI)
        for a single protocols.io entry by `id` returned from
        `protocols_io_search`. This is the highest-fidelity source for concrete
        step ordering, reagent volumes, and incubation times. Returns null if
        the API token is missing or the id cannot be resolved.
        """

        detail = protocols_io.get_protocol(protocol_id)
        if detail is None:
            return None
        return {
            "id": detail.id,
            "title": detail.title,
            "url": detail.url,
            "doi": detail.doi,
            "description": detail.description,
            "materials": detail.materials,
            "steps": [asdict(s) for s in detail.steps],
        }

    @tool
    def tavily_search_bio_protocol(query: str, max_results: int = 6) -> list[dict[str, Any]]:
        """Web search restricted to bio-protocol.org, the peer-reviewed open-access
        protocol journal. Use this for biochemistry, cell biology, immunology,
        plant science, and similar life-sciences techniques where Bio-protocol
        often has a curated, peer-reviewed step-by-step writeup. Returns title,
        url, source, and a snippet. Chain with `fetch_url_readable` to extract
        the actual reagent concentrations and step text from the article.
        """

        hits = tavily.search(
            query, include_domains=BIO_PROTOCOL_DOMAIN, max_results=max_results
        )
        return [
            {
                "title": h.title,
                "url": h.url,
                "source": h.source,
                "snippet": h.snippet,
                "score": h.score,
            }
            for h in hits
        ]

    @tool
    def tavily_search_protocols(query: str, max_results: int = 6) -> list[dict[str, Any]]:
        """Broader protocol web search across protocols.io, bio-protocol.org,
        nature.com (Nature Protocols), jove.com (JOVE), and openwetware.org.

        Use this when the bio-protocol- or protocols.io-only searches did not
        return enough specific hits, or when the technique is published mainly
        in Nature Protocols or JOVE.
        """

        hits = tavily.search_protocols(query, max_results=max_results)
        return [
            {
                "title": h.title,
                "url": h.url,
                "source": h.source,
                "snippet": h.snippet,
                "score": h.score,
            }
            for h in hits
        ]

    return [
        protocols_io_search,
        protocols_io_get_protocol,
        tavily_search_bio_protocol,
        tavily_search_protocols,
        make_web_fetch_tool(),
    ]
