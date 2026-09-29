#!/usr/bin/env python3
"""UltimaWeapon / Justice fetcher — wears wetware (scripts/wetware.py): one consistent desktop-Chrome visitor per target
cache, full browser header set, session cookies, referer chain, first-party asset footprints, human pacing. Never a
crawler UA, never a challenge solved.
Usage: python3 scripts/justice_fetch.py URL [URL...] --out omega_cache/<agency>/html [--robots] [--selftest]
       [--cache omega_cache/<agency>] [--tempo human|brisk] [--no-assets] [--locale en-US]
Writes <slug>.html, <slug>.meta.json (status, headers, chain, ttfb, tier RAW|WAF|NOT_TESTED|ERROR, presence) and appends
manifest.jsonl. --robots also pulls robots.txt and every sitemap it declares (index-aware), summarizing URL counts and lastmod.
The cache dir (default: the parent of --out) holds wetware/persona.json, cookies.json, fetch_log.jsonl and presence.json."""
import sys, os, re, json, time, argparse, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wetware

def slug(url):
    p = urllib.parse.urlparse(url if "://" in url else "https://" + url)
    return re.sub(r"[^A-Za-z0-9._-]+", "_", (p.netloc + p.path + ("?" + p.query if p.query else "")).strip("/"))[:150] or "root"
def quick_facts(html):
    f = {}
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I); f["title"] = re.sub(r"\s+", " ", m.group(1)).strip() if m else None
    f["h1"] = [re.sub(r"<[^>]+>|\s+", " ", x).strip() for x in re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.S | re.I)]
    m = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)', html, re.I); f["canonical"] = m.group(1) if m else None
    m = re.search(r'<meta[^>]+name=["\']description["\'][^>]*content=["\']([^"\']*)', html, re.I); f["meta_description"] = m.group(1) if m else None
    m = re.search(r'<meta[^>]+name=["\']generator["\'][^>]*content=["\']([^"\']*)', html, re.I); f["generator"] = m.group(1) if m else None
    f["viewport"] = bool(re.search(r'<meta[^>]+name=["\']viewport', html, re.I))
    f["robots_meta"] = re.findall(r'<meta[^>]+name=["\']robots["\'][^>]*content=["\']([^"\']*)', html, re.I)
    f["hreflang"] = len(re.findall(r'hreflang=', html, re.I))
    f["jsonld_blocks"] = len(re.findall(r'<script[^>]+application/ld\+json', html, re.I))
    f["microdata_items"] = len(re.findall(r'itemscope', html, re.I))
    imgs = re.findall(r"<img\b[^>]*>", html, re.I); f["images"] = len(imgs); f["images_missing_alt"] = sum(1 for i in imgs if not re.search(r'\balt=', i, re.I))
    f["scripts_external"] = len(re.findall(r'<script[^>]+src=', html, re.I)); f["stylesheets"] = len(re.findall(r'rel=["\']stylesheet', html, re.I))
    f["footer_credits"] = [re.sub(r"<[^>]+>|\s+", " ", x).strip()[:200] for x in re.findall(r'(?is)<footer.*?</footer>', html)[-1:]]
    f["external_links"] = sorted({urllib.parse.urlparse(u).netloc for u in re.findall(r'href=["\'](https?://[^"\']+)', html, re.I)})[:80]
    return f
def sitemap_urls(text):
    return re.findall(r"<loc>\s*(.*?)\s*</loc>", text, re.S | re.I), re.findall(r"<lastmod>\s*(.*?)\s*</lastmod>", text, re.S | re.I)
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("urls", nargs="*"); ap.add_argument("--out", default="omega_cache/run/html")
    ap.add_argument("--robots", action="store_true"); ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--cache", default=None, help="target cache dir holding wetware/ (default: parent of --out)")
    ap.add_argument("--tempo", default="human", choices=["human", "brisk"]); ap.add_argument("--no-assets", action="store_true"); ap.add_argument("--locale", default="en-US")
    ap.add_argument("--sleep", type=float, default=None, help="ignored: pacing is wetware's (kept for old command lines)")
    ap.add_argument("--legacy-persona", "--persona", dest="legacy_persona", action="store_true", help="use the old human-presence persona instead of the honest declared UA (UltimaWeapon defaults to honest)")
    ap.add_argument("--ua", default=None, help="declared User-Agent for honest mode (else MO_USER_AGENT or the default)")
    ap.add_argument("--min-interval", type=float, default=None, help="honest mode: minimum seconds between requests to one host (default 2.0)")
    ap.add_argument("--ignore-robots", action="store_true", help="honest mode: do NOT obey robots.txt (logged in the presence line; default is to obey)")
    a = ap.parse_args()
    cache = a.cache or os.path.dirname(os.path.abspath(a.out.rstrip("/")))
    honest = not a.legacy_persona
    ww = wetware.Session(cache, locale=a.locale, tempo=a.tempo, assets=not a.no_assets, quiet=False,
                         honest=honest, declared_ua=a.ua, obey_robots=not a.ignore_robots, min_interval=a.min_interval)
    if a.selftest:
        meta, html = ww.get("https://example.com/", footprints=False); sc = wetware.selfcheck(ww)
        ident = ww.declared_ua if ww.honest else ww.persona.label
        print("selftest", meta.get("status"), meta.get("tier"), (quick_facts(html)["title"] if meta.get("tier") == "RAW" else None), "| presence", sc.get("tier"), "|", ident, "| engine", ww.engine)
        pres = ww.presence(); pres["tier"] = sc.get("tier"); pres["selfcheck"] = sc; print(wetware.presence_sentence(pres)); ww.close(); return
    os.makedirs(a.out, exist_ok=True); man = open(os.path.join(a.out, "manifest.jsonl"), "a"); inventoried = {}
    try:
        for u in a.urls:
            u = u if "://" in u else "https://" + u
            meta, html = ww.get(u); facts = quick_facts(html) if meta["tier"] == "RAW" else {}
            s = slug(u); open(os.path.join(a.out, s + ".html"), "w").write(html); meta["facts"] = facts; meta["slug"] = s
            host = urllib.parse.urlparse(meta.get("final_url") or u).netloc
            if a.robots and host in inventoried:   # one inventory per host per run
                meta["robots"], meta["sitemaps"] = inventoried[host]
            elif a.robots:
                rm, rtxt = ww.get("https://%s/robots.txt" % host, kind="robots")
                meta["robots"] = {"status": rm["status"], "tier": rm["tier"], "text": rtxt[:6000] if rm["tier"] == "RAW" else None}
                maps = re.findall(r"(?im)^\s*sitemap:\s*(\S+)", rtxt) if rm["tier"] == "RAW" else []
                maps = maps or ["https://%s/sitemap.xml" % host, "https://%s/sitemap_index.xml" % host]
                sm = {"declared": maps, "children": [], "url_count": 0, "http_urls": 0, "lastmod_min": None, "lastmod_max": None, "sample": []}
                seen = set(); queue = list(dict.fromkeys(maps))
                while queue and len(seen) < 60:
                    m = queue.pop(0); seen.add(m); mm, mt = ww.get(m, kind="sitemap")
                    if mm["tier"] != "RAW": sm["children"].append({"url": m, "status": mm["status"], "tier": mm["tier"]}); continue
                    locs, mods = sitemap_urls(mt)
                    if "<sitemapindex" in mt[:3000]: queue += [l for l in locs if l not in seen]; sm["children"].append({"url": m, "index_of": len(locs)}); continue
                    sm["children"].append({"url": m, "urls": len(locs)}); sm["url_count"] += len(locs); sm["http_urls"] += sum(1 for l in locs if l.startswith("http://"))
                    sm["sample"] += locs[:5]
                    for d in mods:
                        sm["lastmod_min"] = min(sm["lastmod_min"] or d, d); sm["lastmod_max"] = max(sm["lastmod_max"] or d, d)
                meta["sitemaps"] = sm; inventoried[host] = (meta["robots"], sm)
            json.dump(meta, open(os.path.join(a.out, s + ".meta.json"), "w"), indent=1)
            man.write(json.dumps({k: meta.get(k) for k in ("url", "final_url", "status", "tier", "ttfb", "bytes", "slug")} | {"presence": meta["presence"]["identity"]}) + "\n"); man.flush()
            print("%-10s %3s %6ss %s -> %s%s" % (meta["tier"], meta["status"], meta["ttfb"], u, meta.get("final_url", ""), ("  title=%r" % facts.get("title")) if facts else ""))
    finally:
        ww.close()
if __name__ == "__main__": main()
