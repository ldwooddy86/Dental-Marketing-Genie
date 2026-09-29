"""YouTube through the Data API v3 with an API key (read-only, public data).

Broadcast lane: recent uploads from listed channels (playlistItems, 1 quota unit per page) and topic
searches (search.list costs 100 units per call; the default daily quota is 10,000). Floor lane:
top-level comments on listed videos (commentThreads, 1 unit), with commenters pseudonymized."""
from __future__ import annotations

import logging

from ..store import Item
from ..util import clean_text, first_line, parse_date, sha1
from .base import Connector, Stats, register_connector

log = logging.getLogger("horus.youtube")
API = "https://www.googleapis.com/youtube/v3"


def parse_videos(payload: dict) -> list[dict]:
    """search.list or playlistItems.list -> [{video_id, channel, title, text, ts}]."""
    out = []
    for it in payload.get("items", []):
        sn = it.get("snippet") or {}
        vid = (it.get("id") or {}).get("videoId") if isinstance(it.get("id"), dict) else None
        vid = vid or (sn.get("resourceId") or {}).get("videoId")
        if not vid:
            continue
        out.append({"video_id": vid, "channel": sn.get("channelTitle", ""), "title": clean_text(sn.get("title"), 300),
                    "text": clean_text(sn.get("description"), 2000), "ts": parse_date(sn.get("publishedAt"))})
    return out


def parse_comments(payload: dict) -> list[dict]:
    out = []
    for it in payload.get("items", []):
        top = ((it.get("snippet") or {}).get("topLevelComment") or {}).get("snippet") or {}
        text = clean_text(top.get("textOriginal") or top.get("textDisplay"), 4000)
        if not text:
            continue
        out.append({"comment_id": it.get("id"), "video_id": top.get("videoId"), "text": text, "ts": parse_date(top.get("publishedAt")),
                    "likes": int(top.get("likeCount") or 0), "replies": int((it.get("snippet") or {}).get("totalReplyCount") or 0),
                    "author": (top.get("authorChannelId") or {}).get("value") or top.get("authorDisplayName")})
    return out


@register_connector
class YouTube(Connector):
    kind = "youtube"
    platform = "YouTube"
    default_eye = "sun"
    default_lane = "youtube"

    def missing(self):
        m = [] if self.secret("api_key") else ["api_key_env variable"]
        if not (self.cfg.get("channel_ids") or self.cfg.get("queries") or self.cfg.get("comment_video_ids")):
            m.append("channel_ids, queries or comment_video_ids")
        return m

    def _get(self, path, **params):
        params["key"] = self.secret("api_key")
        return self.http.get_json(f"{API}/{path}", params=params)

    def _emit_videos(self, vids, sid, community) -> int:
        n = 0
        for v in vids:
            if not v["ts"]:
                continue
            n += self.emit(Item(id=sha1(self.kind, "v", v["video_id"]), source_id=sid, kind=self.kind, eye="sun", lane=self.lane,
                                platform=self.platform, community=v["channel"] or community, ts=v["ts"], title=v["title"], text=v["text"],
                                url=f"https://www.youtube.com/watch?v={v['video_id']}", author=None))
        return n

    def collect(self) -> Stats:
        st = Stats()
        miss = self.missing()
        if miss:
            st.errors.append("youtube not configured: " + ", ".join(miss))
            return st
        per = int(self.cfg.get("max_results", 25))
        for ch in self.cfg.get("channel_ids", []):
            sid = self.register("ch:" + ch, ch, ch, eye="sun")
            try:
                info = self._get("channels", part="contentDetails,snippet", id=ch)
                items = info.get("items") or []
                if not items:
                    raise RuntimeError("channel not found")
                uploads = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]
                title = items[0]["snippet"]["title"]
                self.store.upsert_source(sid, self.kind, title, "sun", self.lane, self.platform, title)
                st.items += self._emit_videos(parse_videos(self._get("playlistItems", part="snippet", playlistId=uploads, maxResults=per)), sid, title)
                self.store.source_ok(sid)
            except Exception as ex:
                self.store.source_error(sid, ex)
                st.errors.append(f"channel {ch}: {ex}")
        for q in self.cfg.get("queries", []):
            sid = self.register("q:" + sha1(q), f"search: {q}", f"YouTube search: {q}", eye="sun")
            try:
                res = self._get("search", part="snippet", q=q, type="video", order="date", maxResults=min(per, 50))
                st.items += self._emit_videos(parse_videos(res), sid, f"YouTube search: {q}")
                self.store.source_ok(sid)
            except Exception as ex:
                self.store.source_error(sid, ex)
                st.errors.append(f"search '{q}': {ex}")
        for vid in self.cfg.get("comment_video_ids", []):
            sid = self.register("c:" + vid, f"comments on {vid}", f"comments on {vid}", eye="moon", lane="youtube-comments")
            try:
                res = self._get("commentThreads", part="snippet", videoId=vid, order="time", maxResults=100, textFormat="plainText")
                n = 0
                for c in parse_comments(res):
                    if not c["ts"]:
                        continue
                    n += self.emit(Item(id=sha1(self.kind, "c", c["comment_id"]), source_id=sid, kind=self.kind, eye="moon",
                                        lane="youtube-comments", platform=self.platform, community=f"comments on {vid}", ts=c["ts"],
                                        title=first_line(c["text"]), text=c["text"],
                                        url=f"https://www.youtube.com/watch?v={vid}&lc={c['comment_id']}",
                                        author=self.author(c["author"], "moon"), engagement={"likes": c["likes"], "replies": c["replies"]}))
                self.store.source_ok(sid)
                st.items += n
            except Exception as ex:
                self.store.source_error(sid, ex)
                st.errors.append(f"comments {vid}: {ex}")
        return st
