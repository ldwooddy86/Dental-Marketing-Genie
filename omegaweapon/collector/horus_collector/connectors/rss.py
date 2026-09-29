"""RSS and Atom: trade press, newsletters, platform blogs, forum listing feeds and podcasts. Stdlib XML
parsing (defusedxml is used when installed). Reads only public feeds."""
from __future__ import annotations

import logging

try:  # hardened parser when available
    import defusedxml.ElementTree as ET  # type: ignore
except ImportError:  # pragma: no cover - depends on environment
    import xml.etree.ElementTree as ET

from ..store import Item
from ..util import clean_text, parse_date, sha1
from .base import Connector, Stats, register_connector

log = logging.getLogger("horus.rss")


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _child(el, name):
    for c in el:
        if _local(c.tag) == name:
            return c
    return None


def _text(el, *names):
    for n in names:
        c = _child(el, n)
        if c is not None and (c.text or "").strip():
            return c.text.strip()
    return ""


def _count(el, name):
    """The numeric child among same-named children (RSS <comments> is a URL; <slash:comments> is the count)."""
    for c in el:
        if _local(c.tag) == name and (c.text or "").strip().isdigit():
            return int(c.text.strip())
    return None


def parse_feed(xml_text: str) -> list[dict]:
    """RSS 2.0 or Atom -> [{title, link, ts, summary, comments, duration}]."""
    root = ET.fromstring(xml_text.encode("utf-8") if isinstance(xml_text, str) else xml_text)
    out = []
    kind = _local(root.tag)
    if kind == "rss" or kind == "RDF":
        chan = _child(root, "channel")
        entries = [e for e in (chan if chan is not None else root) if _local(e.tag) == "item"]
        if kind == "RDF":
            entries = [e for e in root if _local(e.tag) == "item"]
        for e in entries:
            out.append({
                "title": clean_text(_text(e, "title"), 300),
                "link": _text(e, "link", "guid"),
                "ts": parse_date(_text(e, "pubDate", "date", "published", "updated")),
                "summary": clean_text(_text(e, "description", "encoded", "summary"), 2000),
                "comments": _count(e, "comments"),
                "duration": _text(e, "duration") or None,
            })
    elif kind == "feed":
        for e in root:
            if _local(e.tag) != "entry":
                continue
            link = ""
            for c in e:
                if _local(c.tag) == "link" and (c.get("rel") in (None, "alternate")) and c.get("href"):
                    link = c.get("href")
                    break
            out.append({
                "title": clean_text(_text(e, "title"), 300),
                "link": link,
                "ts": parse_date(_text(e, "published", "updated")),
                "summary": clean_text(_text(e, "summary", "content"), 2000),
                "comments": None, "duration": None,
            })
    return [x for x in out if x["title"] or x["summary"]]


@register_connector
class RSS(Connector):
    kind = "rss"
    default_eye = "sun"
    default_lane = "trade-press"

    def missing(self):
        return [] if self.cfg.get("feeds") else ["feeds"]

    def collect(self) -> Stats:
        st = Stats()
        for f in self.cfg.get("feeds", []):
            url = f.get("url", "")
            eye, lane = f.get("eye", self.eye), f.get("lane", self.lane)
            platform = f.get("platform") or url.split("/")[2]
            community = f.get("community", platform)
            sid = self.register(sha1(url), platform, community, eye, lane, platform)
            try:
                entries = parse_feed(self.http.get_text(url))
                n = 0
                for e in entries[: int(self.cfg.get("max_items_per_feed", 100))]:
                    if not e["ts"]:
                        continue
                    eng = {"comments": e["comments"]} if e["comments"] is not None else {}
                    it = Item(id=sha1(self.kind, e["link"] or e["title"]), source_id=sid, kind=self.kind, eye=eye, lane=lane,
                              platform=platform, community=community, ts=e["ts"], title=e["title"] or e["summary"][:140],
                              text=e["summary"], url=e["link"], author=None, engagement=eng,
                              raw={"duration": e["duration"]} if e["duration"] else {})
                    n += self.emit(it)
                self.store.source_ok(sid)
                st.items += n
            except Exception as ex:  # one bad feed never stops the run
                self.store.source_error(sid, ex)
                st.errors.append(f"{platform}: {ex}")
        return st


@register_connector
class Podcast(RSS):
    kind = "podcast"
    default_eye = "sun"
    default_lane = "podcast"
