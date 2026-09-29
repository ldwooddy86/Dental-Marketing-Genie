"""Connector base class and registry. Every connector only READS."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from ..config import secret
from ..store import Item, Store
from ..util import Http, pseudonym

log = logging.getLogger("horus.connector")


@dataclass
class Stats:
    items: int = 0
    errors: list = field(default_factory=list)


class Connector:
    kind = "base"
    platform = ""
    default_eye = "moon"
    default_lane = "custom"
    is_async = False

    def __init__(self, section: dict, general: dict, store: Store, http: Http):
        self.cfg = section or {}
        self.general = general
        self.store = store
        self.http = http
        self.eye = self.cfg.get("eye", self.default_eye)
        self.lane = self.cfg.get("lane", self.default_lane)

    def enabled(self) -> bool:
        return bool(self.cfg.get("enabled"))

    def secret(self, key: str) -> str:
        return secret(self.cfg, key)

    def missing(self) -> list[str]:
        """Names of required secrets or settings that are not present (checked without any network call)."""
        return []

    def author(self, raw, eye: str | None = None):
        """Floor authors become pseudonyms. Broadcast items are attributed to their publication, not a byline."""
        return pseudonym(raw, self.general["_salt"]) if (eye or self.eye) == "moon" else None

    def register(self, ident: str, label: str, community: str, eye: str | None = None, lane: str | None = None,
                 platform: str | None = None) -> str:
        sid = f"{self.kind}:{ident}"
        self.store.upsert_source(sid, self.kind, label, eye or self.eye, lane or self.lane, platform or self.platform, community)
        return sid

    def emit(self, it: Item) -> int:
        return 1 if self.store.add_item(it) else 0

    def collect(self) -> Stats:  # pragma: no cover - abstract
        raise NotImplementedError


REGISTRY: dict[str, type] = {}


def register_connector(cls):
    REGISTRY[cls.kind] = cls
    return cls
