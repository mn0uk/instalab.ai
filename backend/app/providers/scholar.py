from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from ..settings import get_settings


logger = logging.getLogger(__name__)


SEMANTIC_SCHOLAR_BASE = "https://api.semanticscholar.org/graph/v1"
PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
DEFAULT_TIMEOUT = 12.0


@dataclass
class PaperHit:
    title: str
    abstract: str | None
    year: int | None
    authors: list[str] = field(default_factory=list)
    url: str = ""
    doi: str | None = None
    source: str = ""

    def model_dump(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "abstract": self.abstract,
            "year": self.year,
            "authors": self.authors,
            "url": self.url,
            "doi": self.doi,
            "source": self.source,
        }


def search_semantic_scholar(query: str, limit: int = 6) -> list[PaperHit]:
    settings = get_settings()
    headers: dict[str, str] = {"Accept": "application/json"}
    if settings.semantic_scholar_api_key:
        headers["x-api-key"] = settings.semantic_scholar_api_key
    params = {
        "query": query,
        "limit": min(max(limit, 1), 25),
        "fields": "title,abstract,year,authors,url,externalIds",
    }
    try:
        with httpx.Client(timeout=DEFAULT_TIMEOUT) as client:
            resp = client.get(
                f"{SEMANTIC_SCHOLAR_BASE}/paper/search",
                params=params,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError:
        logger.exception("Semantic Scholar search failed for query=%r", query)
        return []

    hits: list[PaperHit] = []
    for item in data.get("data", []) or []:
        if not isinstance(item, dict):
            continue
        external = item.get("externalIds") or {}
        doi = external.get("DOI") if isinstance(external, dict) else None
        authors_raw = item.get("authors") or []
        authors = [a.get("name", "") for a in authors_raw if isinstance(a, dict) and a.get("name")]
        url = item.get("url") or (f"https://doi.org/{doi}" if doi else "")
        hits.append(
            PaperHit(
                title=str(item.get("title") or "(untitled)"),
                abstract=item.get("abstract"),
                year=_safe_int(item.get("year")),
                authors=authors,
                url=url,
                doi=doi,
                source="semanticscholar.org",
            )
        )
    return hits


def search_arxiv(query: str, limit: int = 6) -> list[PaperHit]:
    try:
        import arxiv  # type: ignore[import-not-found]
    except ImportError:
        logger.warning("arxiv package not installed; cannot search arxiv")
        return []

    try:
        client = arxiv.Client(page_size=min(max(limit, 1), 25), num_retries=2)
        search = arxiv.Search(
            query=query,
            max_results=min(max(limit, 1), 25),
            sort_by=arxiv.SortCriterion.Relevance,
        )
        results = list(client.results(search))
    except Exception:
        logger.exception("arXiv search failed for query=%r", query)
        return []

    hits: list[PaperHit] = []
    for r in results:
        try:
            authors = [str(a.name) for a in (r.authors or [])]
            year = r.published.year if r.published else None
            doi = getattr(r, "doi", None)
            hits.append(
                PaperHit(
                    title=str(r.title or "(untitled)"),
                    abstract=str(r.summary or "") or None,
                    year=year,
                    authors=authors,
                    url=str(r.entry_id or ""),
                    doi=doi,
                    source="arxiv.org",
                )
            )
        except Exception:
            logger.exception("Failed to parse arxiv result")
            continue
    return hits


def search_pubmed(query: str, limit: int = 6) -> list[PaperHit]:
    capped = min(max(limit, 1), 25)
    try:
        with httpx.Client(timeout=DEFAULT_TIMEOUT) as client:
            esearch = client.get(
                f"{PUBMED_BASE}/esearch.fcgi",
                params={
                    "db": "pubmed",
                    "term": query,
                    "retmode": "json",
                    "retmax": capped,
                },
            )
            esearch.raise_for_status()
            ids = (
                esearch.json()
                .get("esearchresult", {})
                .get("idlist", [])
            )
            if not ids:
                return []
            esummary = client.get(
                f"{PUBMED_BASE}/esummary.fcgi",
                params={
                    "db": "pubmed",
                    "id": ",".join(ids),
                    "retmode": "json",
                },
            )
            esummary.raise_for_status()
            summaries = esummary.json().get("result", {})
    except httpx.HTTPError:
        logger.exception("PubMed search failed for query=%r", query)
        return []

    hits: list[PaperHit] = []
    for pmid in ids:
        item = summaries.get(pmid)
        if not isinstance(item, dict):
            continue
        authors_raw = item.get("authors") or []
        authors = [a.get("name", "") for a in authors_raw if isinstance(a, dict) and a.get("name")]
        year = _year_from_pubdate(item.get("pubdate"))
        doi = None
        for ext in item.get("articleids", []) or []:
            if isinstance(ext, dict) and ext.get("idtype") == "doi":
                doi = ext.get("value")
                break
        hits.append(
            PaperHit(
                title=str(item.get("title") or "(untitled)"),
                abstract=None,
                year=year,
                authors=authors,
                url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                doi=doi,
                source="pubmed.ncbi.nlm.nih.gov",
            )
        )
    return hits


def _safe_int(value: Any) -> int | None:
    try:
        if value in (None, ""):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _year_from_pubdate(value: Any) -> int | None:
    if not isinstance(value, str) or not value:
        return None
    head = value.split(" ", 1)[0]
    return _safe_int(head)
