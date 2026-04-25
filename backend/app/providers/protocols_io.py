from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from ..settings import get_settings


logger = logging.getLogger(__name__)


PROTOCOLS_IO_BASE = "https://www.protocols.io"
SEARCH_PATH = "/api/v3/protocols"
DETAIL_PATH = "/api/v4/protocols/{id}"
DEFAULT_TIMEOUT = 12.0


@dataclass
class ProtocolHit:
    id: str
    title: str
    url: str
    doi: str | None = None
    description: str | None = None
    authors: list[str] = field(default_factory=list)


@dataclass
class ProtocolStepDetail:
    step_number: int
    title: str | None
    description: str
    duration_seconds: int | None = None
    materials: list[str] = field(default_factory=list)


@dataclass
class ProtocolDetail:
    id: str
    title: str
    url: str
    doi: str | None = None
    description: str | None = None
    materials: list[str] = field(default_factory=list)
    steps: list[ProtocolStepDetail] = field(default_factory=list)


class ProtocolsIoProvider:
    """Thin wrapper around the public protocols.io REST API.

    Free developer access requires an OAuth token; see https://www.protocols.io/developers.
    The provider degrades gracefully (returns empty results) when no token is present
    so the rest of the pipeline keeps working.
    """

    def __init__(self, token: str | None = None, timeout: float = DEFAULT_TIMEOUT) -> None:
        self.token = token if token is not None else get_settings().protocols_io_token
        self.timeout = timeout

    @property
    def enabled(self) -> bool:
        return bool(self.token)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
        }

    def search(self, query: str, *, max_results: int = 6) -> list[ProtocolHit]:
        if not self.enabled:
            logger.warning(
                "protocols.io disabled (missing PROTOCOLS_IO_TOKEN); returning [] for query=%r",
                query,
            )
            return []
        params = {
            "filter": "public",
            "key": query,
            "order_field": "activity",
            "order_dir": "desc",
            "page_size": max_results,
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(
                    f"{PROTOCOLS_IO_BASE}{SEARCH_PATH}",
                    params=params,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError:
            logger.exception("protocols.io search failed for query=%r", query)
            return []

        items = data.get("items", []) if isinstance(data, dict) else []
        hits: list[ProtocolHit] = []
        for item in items[:max_results]:
            hits.append(_parse_hit(item))
        return hits

    def get_protocol(self, protocol_id: str) -> ProtocolDetail | None:
        if not self.enabled:
            logger.warning(
                "protocols.io disabled (missing PROTOCOLS_IO_TOKEN); returning None for id=%r",
                protocol_id,
            )
            return None
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(
                    f"{PROTOCOLS_IO_BASE}{DETAIL_PATH.format(id=protocol_id)}",
                    params={"content_format": "markdown", "last_version": 1},
                    headers=self._headers(),
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError:
            logger.exception("protocols.io get_protocol failed for id=%r", protocol_id)
            return None

        payload = data.get("payload", data) if isinstance(data, dict) else None
        if not isinstance(payload, dict):
            return None
        return _parse_detail(payload)


def _parse_hit(item: dict[str, Any]) -> ProtocolHit:
    pid = str(item.get("id") or item.get("uri") or "")
    uri = item.get("uri") or pid
    url = item.get("url") or (f"{PROTOCOLS_IO_BASE}/view/{uri}" if uri else "")
    creators = item.get("creator") or item.get("creators") or []
    authors: list[str] = []
    if isinstance(creators, list):
        for c in creators:
            if isinstance(c, dict):
                name = c.get("name") or c.get("username")
                if name:
                    authors.append(str(name))
    return ProtocolHit(
        id=pid,
        title=str(item.get("title") or "(untitled)"),
        url=url,
        doi=item.get("doi") or None,
        description=_strip_html(item.get("description")),
        authors=authors,
    )


def _parse_detail(payload: dict[str, Any]) -> ProtocolDetail:
    pid = str(payload.get("id") or payload.get("uri") or "")
    uri = payload.get("uri") or pid
    url = payload.get("url") or (f"{PROTOCOLS_IO_BASE}/view/{uri}" if uri else "")

    materials: list[str] = []
    for m in payload.get("materials", []) or []:
        if isinstance(m, dict):
            name = m.get("name") or m.get("title")
            if name:
                materials.append(str(name))
        elif isinstance(m, str):
            materials.append(m)

    steps: list[ProtocolStepDetail] = []
    raw_steps = payload.get("steps") or []
    for idx, s in enumerate(raw_steps, start=1):
        if not isinstance(s, dict):
            continue
        step_text = s.get("step")
        if isinstance(step_text, str) and step_text.strip():
            description = _strip_markdown(step_text)
        else:
            components = s.get("components") or []
            description_parts: list[str] = []
            if isinstance(components, list):
                for comp in components:
                    if isinstance(comp, dict):
                        text = comp.get("source") or comp.get("description") or comp.get("text")
                        if text:
                            description_parts.append(_strip_html(text) or "")
            description = "\n".join(p for p in description_parts if p) or _strip_html(s.get("description")) or ""
        step_materials: list[str] = []
        for m in s.get("materials", []) or []:
            if isinstance(m, dict):
                name = m.get("name") or m.get("title")
                if name:
                    step_materials.append(str(name))
        steps.append(
            ProtocolStepDetail(
                step_number=_safe_int(s.get("number")) or idx,
                title=str(s.get("title")) if s.get("title") else None,
                description=description,
                duration_seconds=_safe_int(s.get("duration")),
                materials=step_materials,
            )
        )

    return ProtocolDetail(
        id=pid,
        title=str(payload.get("title") or "(untitled)"),
        url=url,
        doi=payload.get("doi") or None,
        description=_strip_html(payload.get("description")),
        materials=materials,
        steps=steps,
    )


def _strip_html(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    import re

    text = re.sub(r"<[^>]+>", " ", value)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def _strip_markdown(value: str) -> str:
    """Lightweight markdown -> plain text. Keeps line breaks, drops common syntax."""
    import re

    text = value.replace("\r\n", "\n")
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)  # images
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)  # links -> label
    text = re.sub(r"`{1,3}([^`]+)`{1,3}", r"\1", text)  # inline / fenced code
    text = re.sub(r"^[#>\-\*\+]+\s*", "", text, flags=re.MULTILINE)  # headings/bullets/quotes
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)  # bold
    text = re.sub(r"\*([^*]+)\*", r"\1", text)  # italics
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _safe_int(value: Any) -> int | None:
    try:
        if value in (None, ""):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None
