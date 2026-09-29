"""HORUS collector command line.

  python -m horus_collector init [--nome digital-marketing]   write config.toml (never overwrites)
  python -m horus_collector discover [--nome X | --site URL]   find RSS/Atom feeds on trade-press sites
  python -m horus_collector check                             enabled lanes and anything missing (no network)
  python -m horus_collector login telegram                    one-time interactive Telethon login
  python -m horus_collector collect [--only rss,reddit]       run the enabled lanes once
  python -m horus_collector recheck reddit [--days 30]        purge Reddit posts deleted at the source
  python -m horus_collector export --since D --until D --out raw.jsonl
  python -m horus_collector status                            items per source, last success, last error
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
import urllib.parse
from html.parser import HTMLParser
from pathlib import Path

from . import __version__
from .config import load
from .connectors import REGISTRY
from .export import export
from .store import Store
from .util import Http

HERE = Path(__file__).resolve().parent
EXAMPLE = HERE.parent / "config.example.toml"
NOMES = HERE.parent.parent / "assets" / "nomes.json"


def _setup(path):
    cfg = load(path)
    g = cfg["general"]
    store = Store(str(Path(g["data_dir"]) / "horus.sqlite"))
    ua = f"HorusCollector/{__version__} (read-only research{'; ' + g['contact'] if g.get('contact') else ''})"
    return cfg, store, Http(ua, min_interval=float(g.get("min_interval_seconds", 1.0)))


def _lanes(cfg, store, http, only=None):
    out = []
    for kind, cls in REGISTRY.items():
        sec = cfg.get(kind)
        if isinstance(sec, dict) and (not only or kind in only):
            out.append(cls(sec, cfg["general"], store, http))
    return out


def _nome(nome_id):
    nomes = json.loads(NOMES.read_text(encoding="utf-8")) if NOMES.exists() else {"nomes": []}
    n = next((x for x in nomes["nomes"] if x["id"] == nome_id), None)
    if not n:
        raise SystemExit(f"unknown nome '{nome_id}'")
    return n


def cmd_init(a):
    dest = Path(a.config)
    if dest.exists():
        raise SystemExit(f"{dest} exists; not overwriting")
    text = EXAMPLE.read_text(encoding="utf-8")
    if a.nome:
        n = _nome(a.nome)
        subs = [s.removeprefix("r/") for s in n.get("moon", {}).get("subreddits", [])]
        text = text.replace('nome = "digital-marketing"', f'nome = "{n["id"]}"')
        text = text.replace('subreddits = ["SEO", "bigseo", "TechSEO", "PPC", "googleads", "FacebookAds", "marketing", "digital_marketing", "socialmedia", "agency"]',
                            "subreddits = " + json.dumps(subs))
        press = n.get("sun", {}).get("trade_press", [])
        text += "\n# Trade press for this nome. Find their feeds with: python -m horus_collector discover --nome " + n["id"] + "\n"
        text += "".join(f"#   {d}\n" for d in press)
    dest.write_text(text, encoding="utf-8")
    print(f"wrote {dest}. Set secrets as environment variables (see README), then run: python -m horus_collector check")


class _FeedLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.feeds = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "link" and "alternate" in (d.get("rel") or "").lower() and (d.get("type") or "").lower() in ("application/rss+xml", "application/atom+xml") and d.get("href"):
            self.feeds.append((d.get("title") or "", d["href"]))


def cmd_discover(a):
    sites = [a.site] if a.site else ["https://" + d.strip("/") for d in _nome(a.nome).get("sun", {}).get("trade_press", [])]
    http = Http(f"HorusCollector/{__version__} (feed discovery)", min_interval=1.0)
    for site in sites:
        try:
            p = _FeedLinks()
            p.feed(http.get_text(site))
            if not p.feeds:
                print(f"# {site}: no feed link found; try {site.rstrip('/')}/feed")
            for title, href in p.feeds[:3]:
                url = urllib.parse.urljoin(site + "/", href)
                host = urllib.parse.urlsplit(site).netloc.removeprefix("www.")
                print(f'  {{ url = "{url}", platform = "{host}", lane = "trade-press", eye = "sun" }},  # {title}')
        except Exception as ex:
            print(f"# {site}: {ex}")


def cmd_check(a):
    cfg, store, http = _setup(a.config)
    print(f"data: {cfg['general']['data_dir']}  nome: {cfg['general'].get('nome', '?')}")
    for c in _lanes(cfg, store, http):
        if not c.enabled():
            print(f"  off      {c.kind}")
            continue
        miss = c.missing()
        print(f"  {'READY' if not miss else 'MISSING':8} {c.kind}" + ("" if not miss else ": " + "; ".join(miss)))


def cmd_login(a):
    cfg, store, http = _setup(a.config)
    if a.what != "telegram":
        raise SystemExit("only 'telegram' needs an interactive login")
    c = REGISTRY["telegram"](cfg.get("telegram", {}), cfg["general"], store, http)
    asyncio.run(c.login())


def cmd_collect(a):
    cfg, store, http = _setup(a.config)
    only = set(a.only.split(",")) if a.only else None
    total, failed = 0, False
    for c in _lanes(cfg, store, http, only):
        if not c.enabled():
            continue
        try:
            st = asyncio.run(c.collect()) if c.is_async else c.collect()
        except Exception as ex:  # a lane failure never loses the others
            print(f"{c.kind:12} failed: {ex}")
            failed = True
            continue
        store.commit()
        total += st.items
        print(f"{c.kind:12} +{st.items} new" + (f"  ({len(st.errors)} problems)" if st.errors else ""))
        for e in st.errors[:8]:
            print(f"{'':12}   {e}")
    store.close()
    print(f"done: {total} new items")
    if failed:
        sys.exit(1)


def cmd_recheck(a):
    cfg, store, http = _setup(a.config)
    if a.what != "reddit":
        raise SystemExit("recheck supports: reddit")
    c = REGISTRY["reddit"](cfg.get("reddit", {}), cfg["general"], store, http)
    checked, purged = c.recheck(a.days)
    store.close()
    print(f"rechecked {checked} Reddit posts from the last {a.days} days; purged {purged} deleted at the source")


def cmd_export(a):
    cfg, store, http = _setup(a.config)
    n = export(store, a.since, a.until, Path(a.out))
    store.close()
    print(f"{n} items -> {a.out}. Next: python scripts/horus_prefilter.py --nome {cfg['general'].get('nome', '<nome>')} --raw {a.out} --out candidates.json")


def cmd_status(a):
    cfg, store, http = _setup(a.config)
    for sid, label, eye, lane, n, last_ts, ok, err in store.status():
        print(f"{eye or '?':4} {lane or '':22} {label[:40]:40} {n:6}" + (f"  error: {err[:60]}" if err else ""))
    store.close()


def main(argv=None):
    ap = argparse.ArgumentParser(prog="horus_collector", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="config.toml")
    ap.add_argument("-v", "--verbose", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("init"); p.add_argument("--nome"); p.set_defaults(fn=cmd_init)
    p = sub.add_parser("discover"); g = p.add_mutually_exclusive_group(required=True); g.add_argument("--nome"); g.add_argument("--site"); p.set_defaults(fn=cmd_discover)
    p = sub.add_parser("check"); p.set_defaults(fn=cmd_check)
    p = sub.add_parser("login"); p.add_argument("what"); p.set_defaults(fn=cmd_login)
    p = sub.add_parser("collect"); p.add_argument("--only"); p.set_defaults(fn=cmd_collect)
    p = sub.add_parser("recheck"); p.add_argument("what"); p.add_argument("--days", type=int, default=30); p.set_defaults(fn=cmd_recheck)
    p = sub.add_parser("export"); p.add_argument("--since", required=True); p.add_argument("--until", required=True); p.add_argument("--out", required=True); p.set_defaults(fn=cmd_export)
    p = sub.add_parser("status"); p.set_defaults(fn=cmd_status)
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO if a.verbose else logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    a.fn(a)
