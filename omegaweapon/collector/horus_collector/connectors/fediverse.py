"""Open networks: Bluesky (AT Protocol public AppView) and Mastodon (public tag timelines).

Bluesky: author feeds of listed handles need no login. Keyword search uses app.bsky.feed.searchPosts,
which may require an app password (Settings > App passwords); set identifier_env and app_password_env
to enable it. Mastodon: public hashtag timelines on the instances you list. Both are read-only and
authors are pseudonymized."""
from __future__ import annotations

import logging

from ..store import Item
from ..util import clean_text, first_line, parse_date, sha1
from .base import Connector, Stats, register_connector

log = logging.getLogger("horus.fediverse")
BSKY_PUBLIC = "https://public.api.bsky.app/xrpc"
BSKY_PDS = "https://bsky.social/xrpc"


def parse_bsky(payload: dict) -> list[dict]:
    """getAuthorFeed (feed[].post) or searchPosts (posts[]) -> [{uri, handle, text, ts, replies, reposts, likes}]."""
    posts = [f.get("post") or {} for f in payload.get("feed", [])] + list(payload.get("posts", []))
    out = []
    for p in posts:
        rec = p.get("record") or {}
        text = clean_text(rec.get("text"), 4000)
        if not text:
            continue
        handle = (p.get("author") or {}).get("handle", "")
        rkey = str(p.get("uri", "")).rsplit("/", 1)[-1]
        out.append({"uri": p.get("uri"), "handle": handle, "did": (p.get("author") or {}).get("did"), "text": text,
                    "ts": parse_date(rec.get("createdAt") or p.get("indexedAt")),
                    "url": f"https://bsky.app/profile/{handle}/post/{rkey}" if handle and rkey else "",
                    "replies": int(p.get("replyCount") or 0), "reposts": int(p.get("repostCount") or 0), "likes": int(p.get("likeCount") or 0)})
    return out


def parse_mastodon(statuses: list) -> list[dict]:
    out = []
    for s in statuses or []:
        if s.get("reblog"):
            continue
        text = clean_text(s.get("content"), 4000)
        if not text:
            continue
        out.append({"id": s.get("id"), "url": s.get("url") or s.get("uri", ""), "acct": (s.get("account") or {}).get("acct"),
                    "text": text, "ts": parse_date(s.get("created_at")), "replies": int(s.get("replies_count") or 0),
                    "reblogs": int(s.get("reblogs_count") or 0), "favourites": int(s.get("favourites_count") or 0)})
    return out


@register_connector
class Bluesky(Connector):
    kind = "bluesky"
    platform = "Bluesky"
    default_eye = "moon"
    default_lane = "bluesky"

    def missing(self):
        return [] if (self.cfg.get("handles") or self.cfg.get("queries")) else ["handles or queries"]

    def _session(self):
        ident, pw = self.secret("identifier"), self.secret("app_password")
        if not (ident and pw):
            return None
        r = self.http.post_json(f"{BSKY_PDS}/com.atproto.server.createSession", json_body={"identifier": ident, "password": pw})
        return r.get("accessJwt")

    def _store(self, posts, sid, community) -> int:
        n = 0
        for p in posts:
            if not p["ts"]:
                continue
            n += self.emit(Item(id=sha1(self.kind, p["uri"]), source_id=sid, kind=self.kind, eye=self.eye, lane=self.lane,
                                platform=self.platform, community=community, ts=p["ts"], title=first_line(p["text"]), text=p["text"],
                                url=p["url"], author=self.author(p["did"] or p["handle"]),
                                engagement={"replies": p["replies"], "reposts": p["reposts"], "likes": p["likes"]}))
        return n

    def collect(self) -> Stats:
        st = Stats()
        lim = int(self.cfg.get("limit", 50))
        for h in self.cfg.get("handles", []):
            sid = self.register("h:" + h.lower(), h, "Bluesky accounts")
            try:
                st.items += self._store(parse_bsky(self.http.get_json(f"{BSKY_PUBLIC}/app.bsky.feed.getAuthorFeed",
                                                                      params={"actor": h, "limit": lim, "filter": "posts_no_replies"})), sid, "Bluesky accounts")
                self.store.source_ok(sid)
            except Exception as ex:
                self.store.source_error(sid, ex)
                st.errors.append(f"bluesky {h}: {ex}")
        if self.cfg.get("queries"):
            jwt = self._session()
            if not jwt:
                st.errors.append("bluesky search needs identifier_env and app_password_env (an app password, never your main password)")
            else:
                for q in self.cfg.get("queries", []):
                    sid = self.register("q:" + sha1(q), f"search: {q}", f"Bluesky search: {q}")
                    try:
                        res = self.http.get_json(f"{BSKY_PDS}/app.bsky.feed.searchPosts", params={"q": q, "limit": min(lim, 100), "sort": "latest"},
                                                 headers={"Authorization": f"Bearer {jwt}"})
                        st.items += self._store(parse_bsky(res), sid, f"Bluesky search: {q}")
                        self.store.source_ok(sid)
                    except Exception as ex:
                        self.store.source_error(sid, ex)
                        st.errors.append(f"bluesky search '{q}': {ex}")
        return st


@register_connector
class Mastodon(Connector):
    kind = "mastodon"
    platform = "Mastodon"
    default_eye = "moon"
    default_lane = "mastodon"

    def missing(self):
        return [] if self.cfg.get("tags") else ["tags"]

    def collect(self) -> Stats:
        st = Stats()
        for inst in self.cfg.get("instances", ["mastodon.social"]):
            for tag in self.cfg.get("tags", []):
                tag = str(tag).lstrip("#")
                sid = self.register(f"{inst}:{tag}".lower(), f"#{tag} on {inst}", f"#{tag} ({inst})")
                try:
                    params = {"limit": 40}
                    cur = self.store.cursor(sid)
                    if cur:
                        params["since_id"] = cur
                    statuses = parse_mastodon(self.http.get_json(f"https://{inst}/api/v1/timelines/tag/{tag}", params=params))
                    n, newest = 0, cur
                    for s in statuses:
                        if not s["ts"]:
                            continue
                        newest = s["id"] if (newest is None or int(s["id"]) > int(newest)) else newest
                        n += self.emit(Item(id=sha1(self.kind, s["url"]), source_id=sid, kind=self.kind, eye=self.eye, lane=self.lane,
                                            platform=self.platform, community=f"#{tag} ({inst})", ts=s["ts"], title=first_line(s["text"]),
                                            text=s["text"], url=s["url"], author=self.author(s["acct"]),
                                            engagement={"replies": s["replies"], "reblogs": s["reblogs"], "favourites": s["favourites"]}))
                    if newest:
                        self.store.set_cursor(sid, newest)
                    self.store.source_ok(sid)
                    st.items += n
                except Exception as ex:
                    self.store.source_error(sid, ex)
                    st.errors.append(f"mastodon #{tag}@{inst}: {ex}")
        return st
