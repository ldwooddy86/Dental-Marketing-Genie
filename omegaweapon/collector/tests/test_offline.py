"""Offline tests for the HORUS collector: parsers, pseudonyms, store, config rails, export and the hand-off
to scripts/horus_prefilter.py. No network. Run from the collector folder:
    python -m unittest discover -s tests -v
"""
from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
COLLECTOR = HERE.parent
SKILL = COLLECTOR.parent
sys.path.insert(0, str(COLLECTOR))
sys.path.insert(0, str(SKILL / "scripts"))
os.environ.setdefault("HORUS_AUTHOR_SALT", "test-salt-not-secret")

from horus_collector import config as hconfig  # noqa: E402
from horus_collector.connectors import REGISTRY  # noqa: E402
from horus_collector.connectors.csv_import import map_row  # noqa: E402
from horus_collector.connectors.fediverse import parse_bsky, parse_mastodon  # noqa: E402
from horus_collector.connectors.hackernews import parse_hits  # noqa: E402
from horus_collector.connectors.reddit import is_deleted, parse_listing  # noqa: E402
from horus_collector.connectors.rss import parse_feed  # noqa: E402
from horus_collector.connectors.telegram import parse_updates  # noqa: E402
from horus_collector.connectors.youtube import parse_comments, parse_videos  # noqa: E402
from horus_collector.export import export  # noqa: E402
from horus_collector.store import Item, Store  # noqa: E402
from horus_collector.util import parse_date, pseudonym  # noqa: E402
import horus_prefilter  # noqa: E402

RSS = """<?xml version="1.0"?><rss version="2.0" xmlns:slash="http://purl.org/rss/1.0/modules/slash/">
<channel><title>Trade</title>
<item><title>Google tests bigger Local Services Ads</title><link>https://example.com/a?utm_source=x</link>
<pubDate>Thu, 25 Sep 2026 14:00:00 +0000</pubDate><description>&lt;p&gt;Larger LSA units&lt;/p&gt;</description>
<comments>https://example.com/a#comments</comments><slash:comments>12</slash:comments></item>
<item><title>Second</title><link>https://example.com/b</link><pubDate>Fri, 26 Sep 2026 09:00:00 GMT</pubDate></item>
</channel></rss>"""
ATOM = """<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
<entry><title>Atom entry</title><link rel="alternate" href="https://example.org/x"/><updated>2026-09-20T10:00:00Z</updated><summary>Sum</summary></entry>
</feed>"""
REDDIT = {"data": {"children": [
    {"kind": "t3", "data": {"name": "t3_abc", "id": "abc", "subreddit": "SEO", "title": "Do PBN backlinks still work?", "selftext": "asking",
                            "created_utc": 1790000000, "permalink": "/r/SEO/comments/abc/x/", "author": "someone", "num_comments": 9, "score": 3}},
    {"kind": "t3", "data": {"name": "t3_del", "id": "del", "title": "[deleted]", "selftext": "[deleted]", "author": "[deleted]", "created_utc": 1790000001}},
]}}


class FakeHttp:
    """Stands in for util.Http: returns canned payloads by URL prefix and records calls."""

    def __init__(self, routes):
        self.routes, self.calls = routes, []

    def _match(self, url):
        self.calls.append(url)
        for prefix, payload in self.routes.items():
            if url.startswith(prefix):
                return payload
        raise RuntimeError(f"no fake route for {url}")

    def get_json(self, url, params=None, headers=None):
        return self._match(url)

    def get_text(self, url, params=None, headers=None):
        return self._match(url)

    def post_json(self, url, data=None, json_body=None, headers=None):
        return self._match(url)


def general(tmp):
    return {"data_dir": tmp, "_salt": os.environ["HORUS_AUTHOR_SALT"]}


class Parsers(unittest.TestCase):
    def test_rss_and_atom(self):
        e = parse_feed(RSS)
        self.assertEqual(len(e), 2)
        self.assertEqual(e[0]["comments"], 12)          # slash:comments, not the comments URL
        self.assertEqual(e[0]["summary"], "Larger LSA units")
        self.assertEqual(e[0]["ts"], parse_date("2026-09-25T14:00:00Z"))
        a = parse_feed(ATOM)
        self.assertEqual(a[0]["link"], "https://example.org/x")

    def test_reddit(self):
        posts = parse_listing(REDDIT)
        self.assertEqual([p["fullname"] for p in posts], ["t3_abc"])
        self.assertTrue(is_deleted(REDDIT["data"]["children"][1]["data"]))
        self.assertEqual(posts[0]["comments"], 9)

    def test_fediverse_hn_youtube_telegram(self):
        b = parse_bsky({"feed": [{"post": {"uri": "at://did:plc:x/app.bsky.feed.post/3k", "author": {"handle": "a.bsky.social", "did": "did:plc:x"},
                                           "record": {"text": "AI Overviews ate my clicks", "createdAt": "2026-09-21T08:00:00Z"}, "replyCount": 2}}]})
        self.assertEqual(b[0]["url"], "https://bsky.app/profile/a.bsky.social/post/3k")
        m = parse_mastodon([{"id": "11", "url": "https://m.s/@a/11", "account": {"acct": "a"}, "content": "<p>GEO is SEO</p>", "created_at": "2026-09-21T08:00:00Z"},
                            {"id": "12", "reblog": {"id": "1"}, "content": "boost"}])
        self.assertEqual(len(m), 1)
        self.assertEqual(m[0]["text"], "GEO is SEO")
        h = parse_hits({"hits": [{"objectID": "1", "title": "Show HN: rank tracker", "_tags": ["story"], "created_at_i": 1790000000, "points": 5, "num_comments": 2, "author": "x"},
                                 {"objectID": "2", "comment_text": "<p>links still matter</p>", "story_title": "SEO thread", "_tags": ["comment"], "created_at_i": 1790000100, "author": "y"}]})
        self.assertTrue(h[0]["story"])
        self.assertEqual(h[1]["title"], "links still matter")
        v = parse_videos({"items": [{"id": {"videoId": "v1"}, "snippet": {"title": "AI Mode ads", "channelTitle": "Chan", "publishedAt": "2026-09-20T00:00:00Z"}}]})
        self.assertEqual(v[0]["video_id"], "v1")
        c = parse_comments({"items": [{"id": "c1", "snippet": {"totalReplyCount": 1, "topLevelComment": {"snippet": {"videoId": "v1", "textOriginal": "Is PMax worth it?", "publishedAt": "2026-09-20T01:00:00Z", "likeCount": 4}}}}]})
        self.assertEqual(c[0]["likes"], 4)
        posts, nxt = parse_updates({"ok": True, "result": [{"update_id": 5, "channel_post": {"message_id": 7, "date": 1790000000, "text": "New GBP trick", "chat": {"id": -100, "title": "Chan", "username": "chan", "type": "channel"}}}]})
        self.assertEqual(nxt, 6)
        self.assertTrue(posts[0]["is_channel"])

    def test_csv_mapping(self):
        r = map_row({"Post": "Smart bidding is guessing again", "Date": "2026-09-20", "URL": "https://x/1", "Comments": "1,204"},
                    {"text": "Post", "date": "Date", "url": "URL", "replies": "Comments"})
        self.assertEqual(r["replies"], 1204)
        self.assertEqual(r["title"], "Smart bidding is guessing again")


class Rails(unittest.TestCase):
    def test_pseudonym(self):
        p = pseudonym("SomeUser", "s1")
        self.assertEqual(p, pseudonym("someuser", "s1"))
        self.assertNotEqual(p, pseudonym("SomeUser", "s2"))
        self.assertNotIn("someuser", p.lower())
        self.assertIsNone(pseudonym("[deleted]", "s1"))

    def test_config_refuses_inline_secret(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "c.toml"
            p.write_text('[discord]\nenabled = true\ntoken = "abc"\n', encoding="utf-8")
            with self.assertRaises(SystemExit):
                hconfig.load(str(p))

    def test_example_config_loads(self):
        cfg = hconfig.load(str(COLLECTOR / "config.example.toml"))
        for kind in REGISTRY:
            self.assertIn(kind, cfg, f"example config lacks [{kind}]")
        self.assertTrue(cfg["general"]["_salt"])

    def test_store_dedupe_and_purge(self):
        with tempfile.TemporaryDirectory() as tmp:
            st = Store(str(Path(tmp) / "h.sqlite"))
            it = Item(id="x1", source_id="s", kind="reddit", eye="moon", lane="reddit", platform="Reddit", community="r/SEO",
                      ts=1790000000, title="t", text="body", url="u", author="p_1", engagement={"comments": 1})
            self.assertTrue(st.add_item(it))
            self.assertFalse(st.add_item(it))
            st.mark_deleted("x1")
            self.assertEqual(st.items(), [])
            row = st.items(include_deleted=True)[0]
            self.assertEqual((row["text"], row["author"], row["url"]), ("", None, ""))


class Lanes(unittest.TestCase):
    def test_rss_and_reddit_collect_offline(self):
        with tempfile.TemporaryDirectory() as tmp:
            st = Store(str(Path(tmp) / "h.sqlite"))
            http = FakeHttp({"https://feed.example/rss": RSS,
                             "https://www.reddit.com/api/v1/access_token": {"access_token": "tok"},
                             "https://oauth.reddit.com/r/SEO/new": REDDIT,
                             "https://oauth.reddit.com/api/info": {"data": {"children": []}}})
            os.environ["HORUS_TEST_ID"], os.environ["HORUS_TEST_SECRET"] = "id", "secret"
            rss = REGISTRY["rss"]({"enabled": True, "feeds": [{"url": "https://feed.example/rss", "platform": "Example"}]}, general(tmp), st, http)
            self.assertEqual(rss.collect().items, 2)
            red = REGISTRY["reddit"]({"enabled": True, "client_id_env": "HORUS_TEST_ID", "client_secret_env": "HORUS_TEST_SECRET",
                                      "user_agent": "script:horus-test:1.0 (by /u/tester)", "subreddits": ["SEO"]}, general(tmp), st, http)
            self.assertEqual(red.missing(), [])
            self.assertEqual(red.collect().items, 1)
            floor = [r for r in st.items() if r["eye"] == "moon"][0]
            self.assertTrue(floor["author"].startswith("p_"))
            sun = [r for r in st.items() if r["eye"] == "sun"][0]
            self.assertIsNone(sun["author"])
            checked, purged = red.recheck(days=100000)
            self.assertEqual((checked, purged), (1, 1))  # gone at the source -> purged here

    def test_export_to_prefilter(self):
        with tempfile.TemporaryDirectory() as tmp:
            st = Store(str(Path(tmp) / "h.sqlite"))
            rows = [("a", "sun", "trade-press", "Google tests bigger Local Services Ads", 1790323200),
                    ("b", "moon", "forum", "Are PBN backlinks still worth buying?", 1790409600),
                    ("c", "moon", "forum", "Group buy Semrush and Ahrefs seats, DM me", 1790409700),
                    ("d", "moon", "forum", "Are PBN backlinks still worth buying?", 1790409800)]
            for rid, eye, lane, title, ts in rows:
                st.add_item(Item(id=rid, source_id="s", kind="rss", eye=eye, lane=lane, platform="P", community="c", ts=ts, title=title,
                                 url=f"https://x/{rid}" if rid != "d" else "https://x/b?utm_source=feed"))
            out = Path(tmp) / "raw.jsonl"
            self.assertEqual(export(st, "2026-09-01", "2026-09-30", out), 4)
            nomes = json.loads((SKILL / "assets" / "nomes.json").read_text(encoding="utf-8"))
            nome = next(n for n in nomes["nomes"] if n["id"] == "digital-marketing")
            res = horus_prefilter.prefilter(horus_prefilter.load_raw(out), nome, "2026-09-01", "2026-09-30")
            c = {x["title"]: x for x in res["candidates"]}
            self.assertEqual(res["dropped"]["duplicates"], 1)
            self.assertEqual(c["Google tests bigger Local Services Ads"]["id"], "S001")
            self.assertIn("T07", c["Are PBN backlinks still worth buying?"]["suggest"]["topics"])
            self.assertIn("grey", c["Are PBN backlinks still worth buying?"]["suggest"]["flags"])
            self.assertIn("set", c["Group buy Semrush and Ahrefs seats, DM me"]["suggest"]["flags"])

    def test_cli_check_needs_no_network(self):
        from horus_collector import cli
        with tempfile.TemporaryDirectory() as tmp:
            cfgp = Path(tmp) / "config.toml"
            cfgp.write_text((COLLECTOR / "config.example.toml").read_text(encoding="utf-8").replace('data_dir = "./horus-data"', f'data_dir = "{tmp}/data"'), encoding="utf-8")
            buf = io.StringIO()
            with redirect_stdout(buf):
                cli.main(["--config", str(cfgp), "check"])
            self.assertIn("rss", buf.getvalue())


if __name__ == "__main__":
    unittest.main()
