from __future__ import annotations

from typing import Any

from langchain_core.tools import BaseTool, tool

from ...providers.tavily import TavilyProvider
from .search_tools import make_web_fetch_tool


SUPPLIER_DOMAINS = (
    "thermofisher.com",
    "sigmaaldrich.com",
    "milliporesigma.com",
    "promega.com",
    "qiagen.com",
    "idtdna.com",
    "neb.com",
    "atcc.org",
    "addgene.org",
    "bio-rad.com",
    "abcam.com",
    "rndsystems.com",
    "cellsignal.com",
)


def _normalize_supplier(supplier: str) -> str | None:
    """Map a free-form supplier hint to one of the supported supplier domains.

    Returns the canonical domain string when recognised, else ``None`` so the
    caller can fall back to searching across all supplier domains.
    """

    s = (supplier or "").strip().lower()
    if not s:
        return None
    if s in SUPPLIER_DOMAINS:
        return s
    aliases = {
        "thermo": "thermofisher.com",
        "thermo fisher": "thermofisher.com",
        "thermofisher": "thermofisher.com",
        "invitrogen": "thermofisher.com",
        "gibco": "thermofisher.com",
        "applied biosystems": "thermofisher.com",
        "sigma": "sigmaaldrich.com",
        "sigma-aldrich": "sigmaaldrich.com",
        "millipore": "milliporesigma.com",
        "millipore sigma": "milliporesigma.com",
        "merck": "milliporesigma.com",
        "promega": "promega.com",
        "qiagen": "qiagen.com",
        "idt": "idtdna.com",
        "idt dna": "idtdna.com",
        "neb": "neb.com",
        "new england biolabs": "neb.com",
        "atcc": "atcc.org",
        "addgene": "addgene.org",
        "bio-rad": "bio-rad.com",
        "biorad": "bio-rad.com",
        "abcam": "abcam.com",
        "r&d": "rndsystems.com",
        "r&d systems": "rndsystems.com",
        "cell signaling": "cellsignal.com",
        "cell signaling technology": "cellsignal.com",
        "cst": "cellsignal.com",
    }
    return aliases.get(s)


def make_materials_tools(tavily: TavilyProvider) -> list[BaseTool]:
    """Build the tool set the Materials agent uses to source reagents and price them.

    The agent is expected to:
      1. Extract the reagent list from the protocol's `steps[*].inputs`.
      2. For each reagent, call `search_supplier_catalog` (preferring a specific
         supplier when obvious, e.g. enzymes -> Promega/NEB, primers -> IDT,
         cell lines -> ATCC, plasmids -> Addgene, antibodies -> Cell Signaling/
         Abcam, common chemicals -> Sigma).
      3. Call `fetch_url_readable` on the most relevant hit to confirm catalog
         number, pack size, and list price from the actual product page.
    """

    @tool
    def search_supplier_catalog(
        query: str,
        supplier: str | None = None,
        max_results: int = 6,
    ) -> list[dict[str, Any]]:
        """Search supplier catalogs for a reagent, kit, antibody, primer, cell
        line, or plasmid.

        Args:
          query: Free-text reagent description (include the modification or
            clone if relevant, e.g. "anti-LC3B rabbit mAb", "rapamycin powder",
            "DMEM high glucose 500 ml", "MYC siRNA").
          supplier: Optional preferred supplier. Accepts canonical domains
            (e.g. "sigmaaldrich.com", "idtdna.com", "addgene.org") or short
            names ("Sigma", "IDT", "Addgene", "Thermo", "NEB",
            "Cell Signaling", "Abcam", "ATCC", "Promega", "Qiagen", "Bio-Rad",
            "Millipore", "R&D Systems"). Pass None to search across all
            supported supplier domains. Use a specific supplier when the
            reagent class strongly favors one (primers -> IDT, plasmids ->
            Addgene, cell lines -> ATCC).
          max_results: Number of hits to return (default 6, max 10 useful).

        Returns a list of `{title, url, source, snippet, score}` hits. Always
        chain with `fetch_url_readable` on the most relevant hit to confirm
        the catalog number, pack size, and list price before adding a line
        item. Do NOT invent catalog numbers or URLs.
        """

        if supplier:
            normalized = _normalize_supplier(supplier)
            domains = (normalized,) if normalized else SUPPLIER_DOMAINS
        else:
            domains = SUPPLIER_DOMAINS
        hits = tavily.search(
            query,
            include_domains=domains,
            max_results=max(1, min(max_results, 10)),
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

    return [
        search_supplier_catalog,
        make_web_fetch_tool(),
    ]
