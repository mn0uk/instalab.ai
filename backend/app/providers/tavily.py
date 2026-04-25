from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable

from tavily import TavilyClient

from ..settings import get_settings


logger = logging.getLogger(__name__)


PROTOCOL_DOMAINS = (
    "protocols.io",
    "bio-protocol.org",
    "nature.com",
    "jove.com",
    "openwetware.org",
)
SUPPLIER_DOMAINS = (
    "thermofisher.com",
    "sigmaaldrich.com",
    "promega.com",
    "qiagen.com",
    "idtdna.com",
)
REAGENT_DOMAINS = ("atcc.org", "addgene.org")
STANDARDS_DOMAINS = ("ncbi.nlm.nih.gov",)
NOVELTY_DOMAINS = (
    "arxiv.org",
    "semanticscholar.org",
    "ncbi.nlm.nih.gov",
    "biorxiv.org",
    "nature.com",
    "sciencedirect.com",
)


@dataclass
class SearchHit:
    title: str
    url: str
    source: str
    snippet: str
    score: float


class TavilyProvider:
    """Thin wrapper around Tavily search with domain-aware ranking."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or get_settings().tavily_api_key
        self._client = TavilyClient(api_key=self.api_key) if self.api_key else None

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def search(
        self,
        query: str,
        *,
        include_domains: Iterable[str] | None = None,
        max_results: int = 6,
        search_depth: str = "basic",
    ) -> list[SearchHit]:
        if not self.enabled:
            logger.warning("Tavily disabled (missing TAVILY_API_KEY); returning [] for query=%r", query)
            return []
        try:
            payload = self._client.search(
                query=query,
                search_depth=search_depth,
                include_domains=list(include_domains) if include_domains else None,
                max_results=max_results,
            )
        except Exception:
            logger.exception("Tavily search failed for query=%r", query)
            return []
        results = payload.get("results", []) if isinstance(payload, dict) else []
        hits: list[SearchHit] = []
        for r in results:
            url = r.get("url", "")
            hits.append(
                SearchHit(
                    title=r.get("title", "") or url,
                    url=url,
                    source=_domain_of(url),
                    snippet=r.get("content", "") or "",
                    score=float(r.get("score", 0.0) or 0.0),
                )
            )
        return hits

    def search_protocols(self, query: str, max_results: int = 6) -> list[SearchHit]:
        return self.search(query, include_domains=PROTOCOL_DOMAINS, max_results=max_results)

    def search_suppliers(self, query: str, max_results: int = 6) -> list[SearchHit]:
        return self.search(query, include_domains=SUPPLIER_DOMAINS, max_results=max_results)

    def search_reagents(self, query: str, max_results: int = 4) -> list[SearchHit]:
        return self.search(query, include_domains=REAGENT_DOMAINS, max_results=max_results)

    def search_standards(self, query: str, max_results: int = 4) -> list[SearchHit]:
        return self.search(query, include_domains=STANDARDS_DOMAINS, max_results=max_results)

    def search_novelty(self, query: str, max_results: int = 8) -> list[SearchHit]:
        return self.search(
            query,
            include_domains=NOVELTY_DOMAINS,
            max_results=max_results,
            search_depth="advanced",
        )


def _domain_of(url: str) -> str:
    try:
        from urllib.parse import urlparse

        return urlparse(url).netloc.lower()
    except Exception:
        return ""
