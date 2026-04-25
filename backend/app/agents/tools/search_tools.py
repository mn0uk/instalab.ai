from __future__ import annotations

from typing import Any

from langchain_core.tools import BaseTool, tool

from ...providers import scholar
from ...providers.tavily import TavilyProvider
from ...providers.web_fetch import fetch_readable


def _hits_to_dicts(hits: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for h in hits:
        if hasattr(h, "model_dump"):
            out.append(h.model_dump())
        elif hasattr(h, "__dict__"):
            out.append({k: v for k, v in h.__dict__.items() if not k.startswith("_")})
    return out


def make_web_fetch_tool() -> BaseTool:
    @tool
    def fetch_url_readable(url: str, max_chars: int = 8000) -> dict[str, Any]:
        """Fetch a single web page and return readability-cleaned text.

        Use this when a search result snippet is ambiguous and you need the actual
        page content (abstract, methods, parameters) to make a decision. Pass a
        full https URL exactly as it appeared in a previous tool result. Output
        text is truncated to `max_chars` characters; set this lower (e.g. 3000)
        if you only need the gist.
        """

        page = fetch_readable(url, max_chars=max_chars)
        return page.model_dump()

    return fetch_url_readable


def make_novelty_tools(tavily: TavilyProvider) -> list[BaseTool]:
    """Build the tool set the Novelty agent uses to evaluate prior art."""

    @tool
    def search_semantic_scholar(query: str, limit: int = 6) -> list[dict[str, Any]]:
        """Search Semantic Scholar for peer-reviewed papers across all fields.

        Best first call for novelty checks: returns titles, abstracts, year,
        authors, DOI, and a canonical URL. Use targeted natural-language queries
        that name the intervention, system, and endpoint together (for example
        "CRISPR knockdown of MYC in HeLa proliferation assay"). Limit defaults
        to 6; raise to at most 15 only when initial results look thin.
        """

        return _hits_to_dicts(scholar.search_semantic_scholar(query, limit=limit))

    @tool
    def search_arxiv(query: str, limit: int = 6) -> list[dict[str, Any]]:
        """Search arXiv preprints, with strongest coverage of physics, ML and
        quantitative biology. Prefer this when the hypothesis is computational,
        biophysical, or methods-driven, or when Semantic Scholar returns mostly
        older work. Returns title, abstract, year, authors, DOI, and entry URL.
        """

        return _hits_to_dicts(scholar.search_arxiv(query, limit=limit))

    @tool
    def search_pubmed(query: str, limit: int = 6) -> list[dict[str, Any]]:
        """Search PubMed for biomedical and life-sciences literature.

        Use this for clinical, molecular biology, immunology, or pharmacology
        hypotheses. Returns titles, authors, year, DOI, and a PubMed URL but
        no abstracts; chain with `fetch_url_readable` on the most promising
        result if you need the abstract or methods text.
        """

        return _hits_to_dicts(scholar.search_pubmed(query, limit=limit))

    @tool
    def tavily_search_novelty(query: str, max_results: int = 6) -> list[dict[str, Any]]:
        """Web search restricted to high-signal scientific domains
        (arXiv, Semantic Scholar, NCBI, bioRxiv, Nature, ScienceDirect).

        Use this as a complement to Semantic Scholar / arXiv / PubMed when you
        want broader web hits including news of recent results, conference
        pages, or NCBI bookshelves. Returns title, url, source domain, and a
        snippet for each hit.
        """

        hits = tavily.search_novelty(query, max_results=max_results)
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
        search_semantic_scholar,
        search_arxiv,
        search_pubmed,
        tavily_search_novelty,
        make_web_fetch_tool(),
    ]
