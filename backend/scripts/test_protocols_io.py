"""Smoke test for the protocols.io provider.

Searches for a protocol matching a query, fetches the first hit's full detail
(including steps), and prints a compact summary so we can confirm the
PROTOCOLS_IO_TOKEN works end-to-end.

Run from the repo root:

    backend/.venv/bin/python backend/scripts/test_protocols_io.py "RNA extraction"
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.providers.protocols_io import ProtocolsIoProvider  # noqa: E402
from app.settings import get_settings  # noqa: E402


def main() -> int:
    query = " ".join(sys.argv[1:]) or "RNA extraction"
    settings = get_settings()
    masked = (settings.protocols_io_token[:6] + "…") if settings.protocols_io_token else "(empty)"
    print(f"PROTOCOLS_IO_TOKEN: {masked}")
    print(f"Query: {query!r}\n")

    provider = ProtocolsIoProvider()
    if not provider.enabled:
        print("Provider disabled — token missing.")
        return 1

    hits = provider.search(query, max_results=3)
    if not hits:
        print("No hits returned.")
        return 1

    print(f"Got {len(hits)} hit(s):")
    for h in hits:
        print(f"  - id={h.id!r:>10}  {h.title}")
        print(f"      url={h.url}")
    print()

    target = hits[0]
    print(f"Fetching full protocol id={target.id!r} ({target.title})…")
    detail = provider.get_protocol(target.id)
    if detail is None:
        print("get_protocol returned None.")
        return 1

    print(f"\nTitle:   {detail.title}")
    print(f"URL:     {detail.url}")
    print(f"DOI:     {detail.doi}")
    if detail.description:
        snippet = detail.description[:200] + ("…" if len(detail.description) > 200 else "")
        print(f"Desc:    {snippet}")
    print(f"Materials ({len(detail.materials)}):")
    for m in detail.materials[:8]:
        print(f"  - {m}")
    if len(detail.materials) > 8:
        print(f"  … (+{len(detail.materials) - 8} more)")

    print(f"\nSteps ({len(detail.steps)}):")
    for s in detail.steps[:6]:
        body = s.description.replace("\n", " ").strip()
        if len(body) > 220:
            body = body[:220] + "…"
        title = s.title or ""
        print(f"  {s.step_number:>2}. {title}")
        print(f"      {body}")
    if len(detail.steps) > 6:
        print(f"  … (+{len(detail.steps) - 6} more steps)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
