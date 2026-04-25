from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx


logger = logging.getLogger(__name__)


DEFAULT_TIMEOUT = 8.0
DEFAULT_MAX_CHARS = 8000
USER_AGENT = (
    "InstalabAgent/0.1 (+https://instalab.ai) httpx/0.27"
)


@dataclass
class FetchedPage:
    url: str
    final_url: str
    title: str | None
    text: str
    truncated: bool

    def model_dump(self) -> dict:
        return {
            "url": self.url,
            "final_url": self.final_url,
            "title": self.title,
            "text": self.text,
            "truncated": self.truncated,
        }


def fetch_readable(url: str, *, max_chars: int = DEFAULT_MAX_CHARS) -> FetchedPage:
    """Fetch a URL and return readability-cleaned text using trafilatura.

    Falls back to a stripped-HTML excerpt if trafilatura cannot extract content.
    Network and parsing errors return a FetchedPage with empty text rather than
    raising, so the agent can decide what to do next.
    """

    try:
        with httpx.Client(
            timeout=DEFAULT_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            resp = client.get(url)
            resp.raise_for_status()
            html = resp.text
            final_url = str(resp.url)
    except httpx.HTTPError:
        logger.warning("fetch_readable failed for url=%r", url, exc_info=True)
        return FetchedPage(url=url, final_url=url, title=None, text="", truncated=False)

    title: str | None = None
    text: str = ""

    try:
        import trafilatura  # type: ignore[import-not-found]

        extracted = trafilatura.extract(
            html,
            include_comments=False,
            include_tables=True,
            favor_recall=True,
            url=final_url,
        )
        if extracted:
            text = extracted
        meta = trafilatura.extract_metadata(html, default_url=final_url)
        if meta and getattr(meta, "title", None):
            title = meta.title
    except ImportError:
        logger.warning("trafilatura not installed; falling back to stripped HTML")
    except Exception:
        logger.exception("trafilatura extraction failed for url=%r", url)

    if not text:
        text = _strip_html(html)
        if not title:
            title = _extract_title(html)

    truncated = False
    if len(text) > max_chars:
        text = text[:max_chars]
        truncated = True

    return FetchedPage(
        url=url,
        final_url=final_url,
        title=title,
        text=text,
        truncated=truncated,
    )


def _strip_html(html: str) -> str:
    import re

    no_scripts = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", no_scripts)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_title(html: str) -> str | None:
    import re

    match = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.S | re.I)
    if not match:
        return None
    title = re.sub(r"\s+", " ", match.group(1)).strip()
    return title or None
