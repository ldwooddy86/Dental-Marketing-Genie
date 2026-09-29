"""Reddit through the official Data API (OAuth, application-only, read-only script app).

Reddit requires a descriptive User-Agent naming your Reddit account and an app registered at
https://www.reddit.com/prefs/apps. Content later deleted by its author must be deleted here too:
run `python -m horus_collector recheck reddit` at least weekly; it purges deleted posts from the store.
No scraping of reddit.com pages, no logged-in browsing, no voting or posting."""
from __future__ import annotations

import base64
import logging
import time

from ..store import Item
from ..util import clean_text, sha1
from .base import Connector, Stats, register_connector

log = logging.getLogger("horus.reddit")
TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
API = "https://oauth.reddit.com"


def is_deleted(d: dict) -> bool:
    return (d.get("author") in (None, "[deleted]") or bool(d.get("removed_by_category"))
            or d.get("selftext") in ("[deleted]", "[removed]") or d.get("title") in ("[deleted]", "[removed]"))


def parse_listing(payload: dict) -> list[dict]:
    out = []
    for ch in (payload.get("data") or {}).get("children", []):
        d = ch.get("data") or {}
        if ch.get("kind") != "t3" or is_deleted(d):
            continue
        out.append({
            "fullname": d.get("name") or f"t3_{d.get('id')}", "subreddit": d.get("subreddit", ""),
            "title": clean_text(d.get("title"), 300), "text": clean_text(d.get("selftext"), 4000),
            "ts": int(d.get("created_utc") or 0), "url": "https://www.reddit.com" + d.get("permalink", ""),
            "author": d.get("author"), "comments": int(d.get("num_comments") or 0), "score": int(d.get("score") or 0),
            "flair": d.get("link_flair_text"), "stickied": bool(d.get("stickied")),
        })
    return out


@register_connector
class Reddit(Connector):
    kind = "reddit"
    platform = "Reddit"
    default_eye = "moon"
    default_lane = "reddit"

    def missing(self):
        m = [k for k in ("client_id", "client_secret") if not self.secret(k)]
        ua = self.cfg.get("user_agent", "")
        if "/u/" not in ua or "YOUR_USERNAME" in ua:
            m.append("user_agent naming your Reddit account, e.g. script:horus-collector:1.0 (by /u/name)")
        if not self.cfg.get("subreddits"):
            m.append("subreddits")
        return m

    def _token(self) -> str:
        cred = base64.b64encode(f"{self.secret('client_id')}:{self.secret('client_secret')}".encode()).decode()
        r = self.http.post_json(TOKEN_URL, data={"grant_type": "client_credentials"},
                                headers={"Authorization": f"Basic {cred}", "User-Agent": self.cfg["user_agent"]})
        if "access_token" not in r:
            raise RuntimeError(f"Reddit token refused: {r.get('error', 'unknown error')}")
        return r["access_token"]

    def _get(self, token: str, path: str, params: dict):
        return self.http.get_json(API + path, params=params, headers={"Authorization": f"Bearer {token}", "User-Agent": self.cfg["user_agent"]})

    def collect(self) -> Stats:
        st = Stats()
        miss = self.missing()
        if miss:
            st.errors.append("reddit not configured: " + ", ".join(miss))
            return st
        token = self._token()
        listing = self.cfg.get("listing", "new")
        for sub in self.cfg.get("subreddits", []):
            sub = str(sub).removeprefix("r/")
            sid = self.register(sub.lower(), f"r/{sub}", f"r/{sub}")
            try:
                posts = parse_listing(self._get(token, f"/r/{sub}/{listing}", {"limit": int(self.cfg.get("limit", 100)), "raw_json": 1}))
                n = 0
                for p in posts:
                    if p["stickied"] and not self.cfg.get("include_stickied", False):
                        continue
                    it = Item(id=sha1(self.kind, p["fullname"]), source_id=sid, kind=self.kind, eye=self.eye, lane=self.lane,
                              platform=self.platform, community=f"r/{sub}", ts=p["ts"], title=p["title"], text=p["text"], url=p["url"],
                              author=self.author(p["author"]), engagement={"comments": p["comments"], "score": p["score"]},
                              raw={"fullname": p["fullname"], "flair": p["flair"]})
                    n += self.emit(it)
                self.store.source_ok(sid)
                st.items += n
            except Exception as ex:
                self.store.source_error(sid, ex)
                st.errors.append(f"r/{sub}: {ex}")
        return st

    def recheck(self, days: int = 30) -> tuple[int, int]:
        """Re-query stored posts from the last `days` days; purge any deleted or removed at the source."""
        token = self._token()
        rows = self.store.raw_for(self.kind, time.time() - days * 86400)
        by_full = {raw.get("fullname"): iid for iid, raw in rows if raw.get("fullname")}
        names, purged = list(by_full), 0
        for i in range(0, len(names), 100):
            batch = names[i:i + 100]
            payload = self._get(token, "/api/info", {"id": ",".join(batch), "raw_json": 1})
            alive = set()
            for ch in (payload.get("data") or {}).get("children", []):
                d = ch.get("data") or {}
                if not is_deleted(d):
                    alive.add(d.get("name"))
            for fn in batch:
                if fn not in alive:
                    self.store.mark_deleted(by_full[fn])
                    purged += 1
        self.store.commit()
        return len(names), purged
