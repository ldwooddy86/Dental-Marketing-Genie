"""Hacker News through the public Algolia search API (read-only, no key). Stories and comments that
match your queries; authors pseudonymized."""
from __future__ import annotations

import logging
import time

from ..store import Item
from ..util import clean_text, first_line, sha1
from .base import Connector, Stats, register_connector

log = logging.getLogger("horus.hn")
API = "https://hn.algolia.com/api/v1/search_by_date"


def parse_hits(payload: dict) -> list[dict]:
    out = []
    for h in payload.get("hits", []):
        is_story = "story" in (h.get("_tags") or []) and bool(h.get("title"))
        text = clean_text(h.get("story_text") or h.get("comment_text") or "", 4000)
        title = clean_text(h.get("title") or h.get("story_title") or "", 300)
        if not (title or text):
            continue
        out.append({"id": h.get("objectID"), "story": is_story, "title": title if is_story else first_line(text) or title,
                    "context": None if is_story else title, "text": text, "ts": int(h.get("created_at_i") or 0),
                    "points": h.get("points"), "comments": h.get("num_comments"), "author": h.get("author"),
                    "url": f"https://news.ycombinator.com/item?id={h.get('objectID')}"})
    return out


@register_connector
class HackerNews(Connector):
    kind = "hackernews"
    platform = "Hacker News"
    default_eye = "moon"
    default_lane = "hackernews"

    def missing(self):
        return [] if self.cfg.get("queries") else ["queries"]

    def collect(self) -> Stats:
        st = Stats()
        days = int(self.cfg.get("lookback_days", 14))
        for q in self.cfg.get("queries", []):
            sid = self.register(sha1(q), f"HN: {q}", f"Hacker News: {q}")
            try:
                since = int(self.store.cursor(sid) or (time.time() - days * 86400))
                res = self.http.get_json(API, params={"query": q, "tags": "(story,comment)", "hitsPerPage": int(self.cfg.get("limit", 100)),
                                                      "numericFilters": f"created_at_i>{since}"})
                n, newest = 0, since
                for h in parse_hits(res):
                    newest = max(newest, h["ts"])
                    eng = {k: v for k, v in (("points", h["points"]), ("comments", h["comments"])) if v is not None}
                    n += self.emit(Item(id=sha1(self.kind, h["id"]), source_id=sid, kind=self.kind, eye=self.eye, lane=self.lane,
                                        platform=self.platform, community=f"Hacker News: {q}", ts=h["ts"], title=h["title"], text=h["text"],
                                        url=h["url"], author=self.author(h["author"]), engagement=eng,
                                        raw={"story": h["story"], "context": h["context"]}))
                self.store.set_cursor(sid, newest)
                self.store.source_ok(sid)
                st.items += n
            except Exception as ex:
                self.store.source_error(sid, ex)
                st.errors.append(f"hn '{q}': {ex}")
        return st
