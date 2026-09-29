#!/usr/bin/env python3
"""THE GOOGLE CRAWL — UltimaWeapon's search-engine's-eye pass. Honest-only: the crawl STRATEGY of a search engine,
never its IDENTITY. Every request goes out under the tool's own declared User-Agent through wetware's honest session
(robots.txt obeyed, per-host rate limit, Retry-After honored, conditional on-disk cache). It never sends a Googlebot
or any trusted-bot User-Agent, never solves a challenge, never uses a proxy. A wall is a finding, not an obstacle.

Three jobs:

  crawl              discover pages the way a crawler does (robots.txt -> sitemap index -> child sitemaps -> URLs, plus
                     the internal link graph with --follow-links) and judge each URL the way an index would: status,
                     final URL, redirect chain, robots meta / X-Robots-Tag, canonical, title, description, H1s, word
                     count, hreflang, viewport, JSON-LD types, internal in-links, crawl depth. Emits finding codes with
                     severities (see FINDINGS), a per-URL CSV, crawl.json and a severity-ranked crawl_report.md.
  render             load each URL in real Chromium (honest launch: declared UA, no stealth, automation flags visible)
                     in a MOBILE viewport, diff rendered text against the raw HTML the crawler saw, and report the
                     JS-dependent share, rendered-only headings/links, navigation timing, console errors, screenshot.
  verify-googlebot   the defensive twin. Read a server access log (common / combined / JSON lines) or a list of IPs,
                     find every hit that CLAIMS to be Googlebot / AdsBot / Storebot / Google-InspectionTool /
                     GoogleOther / bingbot, and prove or disprove each source IP with forward-confirmed reverse DNS and
                     the crawler IP ranges Google and Microsoft publish. Verdicts: VERIFIED, FAKE, UNVERIFIED.

Ground truth this tool cannot see: whether Google ACTUALLY indexed a URL. That is GSC URL Inspection, run by the owner
on their verified property; the crawl_report ends with the verify-task protocol for it.

Usage
  python3 scripts/google_crawler.py [--ua UA] [--cache DIR] [--min-interval 2] [--ignore-robots] crawl HOMEPAGE \
      --out omega_cache/<t>/google_crawl [--follow-links] [--max-pages 150] [--max-sitemaps 25] \
      [--include /blog/] [--exclude '\\?replytocom='] [--sample-families]
  python3 scripts/google_crawler.py [--ua UA] render URL [URL...] --out omega_cache/<t>/google_render.json \
      [--screenshots DIR] [--wait 6] [--viewport 412x915]
  python3 scripts/google_crawler.py verify-googlebot --log access.log [--log access.log.1] [--ips 66.249.66.1 ...] \
      --out omega_cache/<t>/googlebot_verify [--offline] [--max-ips 500]
  python3 scripts/google_crawler.py report --out omega_cache/<t>/google_crawl          # the one-paragraph summary

Identity: --ua, else $UW_USER_AGENT, else $MO_USER_AGENT, else wetware's default (which carries a REPLACE placeholder —
set a real contact URL before a run). The honest presence line is written to <out>/presence.txt.
"""
import argparse, csv, difflib, gzip, hashlib, html as htmlmod, ipaddress, io, json, os, re, socket, sys, time, urllib.parse
from collections import Counter, OrderedDict, defaultdict, deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import wetware
except Exception as e:  # pragma: no cover
    print("google_crawler needs scripts/wetware.py beside it: %s" % e, file=sys.stderr); sys.exit(2)

TOOL = "UltimaWeapon google_crawler/1.0"

# --------------------------------------------------------------------------------------------- finding catalogue
# code: (severity, one-line meaning, the fix in plain words)
FINDINGS = OrderedDict([
    ("ROBOTS_BLOCKS_ALL",        ("High",   "robots.txt disallows the whole site to all crawlers", "remove the blanket Disallow: / (keep it only on staging)")),
    ("HOMEPAGE_NOINDEX",         ("High",   "the homepage carries noindex", "remove noindex from the homepage (meta robots or X-Robots-Tag)")),
    ("HOMEPAGE_ERROR",           ("High",   "the homepage does not return 200", "restore a 200 homepage; fix the redirect or server error")),
    ("NOINDEX_IN_SITEMAP",       ("High",   "a sitemap lists a URL that says noindex", "either index it (remove noindex) or drop it from the sitemap; sitemaps list indexable finals only")),
    ("ROBOTS_BLOCKED_IN_SITEMAP",("High",   "a sitemap lists a URL that robots.txt blocks for crawlers", "unblock it in robots.txt or drop it from the sitemap")),
    ("SITEMAP_URL_ERROR",        ("High",   "a sitemap lists a URL that returns 4xx/5xx", "fix or remove the URL; a 404/410 in the sitemap wastes crawl budget and signals neglect")),
    ("CANONICAL_TO_ERROR",       ("High",   "canonical points at a URL that errors or redirects", "point canonical at a live 200 final URL")),
    ("CANONICAL_TO_NOINDEX",     ("High",   "canonical points at a noindex URL", "canonical target must itself be indexable")),
    ("SITEMAP_MISSING",          ("Medium", "no XML sitemap was discoverable (robots.txt Sitemap: lines, /sitemap.xml, /sitemap_index.xml)", "publish an XML sitemap of indexable finals and declare it in robots.txt and GSC")),
    ("SITEMAP_REDIRECT",         ("Medium", "a sitemap lists a URL that redirects", "list the final URL instead")),
    ("REDIRECT_CHAIN",           ("Medium", "two or more redirect hops before the final URL", "redirect straight to the final URL in one hop")),
    ("CANONICALIZED_AWAY",       ("Medium", "a sitemap URL declares a different canonical", "list only self-canonical URLs in the sitemap; fix the canonical if the page should rank")),
    ("CANONICAL_MISMATCH_SCHEME_HOST", ("Medium", "canonical uses a different scheme or host (http/https, www/non-www)", "make the canonical match the served final URL exactly")),
    ("MISSING_CANONICAL",        ("Medium", "indexable page without a canonical tag", "add a self-referencing canonical")),
    ("DUPLICATE_TITLE",          ("Medium", "the same <title> on several URLs", "write a unique, specific title per page")),
    ("DUPLICATE_DESCRIPTION",    ("Low",    "the same meta description on several URLs", "write a unique description per page (or omit it and let Google choose)")),
    ("ORPHAN",                   ("Medium", "in the sitemap but no internal link found to it in the crawl", "link it from a relevant hub or parent page")),
    ("ORPHAN_CANDIDATE",         ("Low",    "in the sitemap, no internal link seen — the link graph was NOT crawled fully, so this is a candidate", "re-run with --follow-links and a larger --max-pages to confirm")),
    ("NOT_IN_SITEMAP",           ("Low",    "an indexable page reached by links is missing from every sitemap", "add it to the sitemap if it should rank")),
    ("SITEMAP_HTTP_ENTRIES",     ("Low",    "the sitemap lists http:// URLs", "list https:// finals")),
    ("SITEMAP_PARAMETER_URLS",   ("Low",    "the sitemap lists parameterised URLs", "list clean canonical URLs; handle parameters via canonical, not the sitemap")),
    ("SITEMAP_LASTMOD_SUSPECT",  ("Low",    "lastmod values are identical across the sitemap or in the future", "emit real modification dates or omit lastmod; Google ignores lastmod it cannot trust")),
    ("DEEP_PAGE",                ("Low",    "four or more clicks from the homepage", "flatten the path: link from a hub, category or the homepage")),
    ("THIN_PAGE",                ("Low",    "fewer than 150 words of visible text in the raw HTML", "add substantive content or check whether the content is JS-rendered (see render)")),
    ("MISSING_TITLE",            ("Medium", "no <title>", "add a title")),
    ("LONG_TITLE",               ("Low",    "title longer than 70 characters", "shorten to roughly 60 characters")),
    ("MISSING_DESCRIPTION",      ("Low",    "no meta description", "add one (optional, but the default snippet is rarely better)")),
    ("NO_H1",                    ("Low",    "no H1", "add one H1 that states the page's topic")),
    ("MULTIPLE_H1",              ("Low",    "more than one H1", "keep one H1 (usually harmless, but often a template defect)")),
    ("NO_VIEWPORT",              ("Medium", "no viewport meta tag", "add <meta name=viewport content='width=device-width, initial-scale=1'>")),
    ("LARGE_HTML",               ("Low",    "HTML larger than 1 MB", "trim inline CSS/JS, duplicated nav DOM, base64 images")),
    ("HREFLANG_SELF_MISSING",    ("Low",    "hreflang cluster without a self-reference", "every page in a cluster lists itself")),
    ("MIXED_TRAILING_SLASH",     ("Low",    "the site serves both /path and /path/ as 200", "pick one and 301 the other; keep canonicals consistent")),
    ("NOINDEX_FOLLOWED_LINKS",   ("Info",   "noindex page (informational) — crawlable but excluded", "confirm intentional")),
    ("ROBOTS_DISALLOWED_FOR_US", ("Info",   "robots.txt withheld this URL from OUR declared agent; not fetched", "nothing to fix unless the rule also hits Googlebot")),
    ("AI_BOTS_BLOCKED",          ("Info",   "robots.txt blocks one or more AI crawlers", "a policy choice; see references/ai-seo.md for the tradeoff")),
    ("WALL",                     ("Info",   "WAF / challenge / 403 met by the declared agent", "NOT_TESTED from this vantage; a real customer on this network class may meet it too")),
])
SEV_ORDER = {"High": 0, "Medium": 1, "Low": 2, "Info": 3}

AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai", "PerplexityBot",
           "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider", "Amazonbot", "meta-externalagent", "cohere-ai",
           "DuckAssistBot", "YouBot", "MistralAI-User"]

# --------------------------------------------------------------------------------------------- small HTML helpers
_TAG_STRIP = re.compile(r"(?is)<(script|style|noscript|template|svg)[^>]*>.*?</\1>")
_TAGS = re.compile(r"(?s)<[^>]+>")
_WS = re.compile(r"\s+")

def visible_text(html):
    if not html: return ""
    t = _TAG_STRIP.sub(" ", html)
    t = re.sub(r"(?is)<!--.*?-->", " ", t)
    t = _TAGS.sub(" ", t)
    t = htmlmod.unescape(t)
    return _WS.sub(" ", t).strip()

def word_count(text): return len([w for w in text.split(" ") if w])

def attr(tag, name):
    m = re.search(r'(?is)\b%s\s*=\s*("([^"]*)"|\'([^\']*)\'|([^\s>]+))' % re.escape(name), tag)
    if not m: return None
    return htmlmod.unescape(m.group(2) if m.group(2) is not None else (m.group(3) if m.group(3) is not None else m.group(4))).strip()

def head_of(html):
    m = re.search(r"(?is)<head[^>]*>(.*?)</head>", html or "")
    return m.group(1) if m else (html or "")[:200000]

def parse_page(url, html):
    """Extract the index-decision signals from raw HTML."""
    head = head_of(html); out = {}
    m = re.search(r"(?is)<title[^>]*>(.*?)</title>", head)
    out["title"] = _WS.sub(" ", htmlmod.unescape(_TAGS.sub("", m.group(1)))).strip() if m else None
    metas = re.findall(r"(?is)<meta\b[^>]*>", head)
    out["description"] = None; robots_directives = []
    for t in metas:
        n = (attr(t, "name") or attr(t, "property") or "").lower()
        if n == "description" and out["description"] is None: out["description"] = attr(t, "content")
        elif n in ("robots", "googlebot", "googlebot-news"): robots_directives.append((attr(t, "content") or "").lower())
    out["meta_robots"] = ", ".join(robots_directives) if robots_directives else None
    out["viewport"] = any((attr(t, "name") or "").lower() == "viewport" for t in metas)
    links = re.findall(r"(?is)<link\b[^>]*>", head)
    canon = [attr(t, "href") for t in links if (attr(t, "rel") or "").lower().split() and "canonical" in (attr(t, "rel") or "").lower().split()]
    canon = [c for c in canon if c]
    out["canonical"] = urllib.parse.urljoin(url, canon[0]) if canon else None
    out["canonical_count"] = len(canon)
    out["hreflang"] = [((attr(t, "hreflang") or "").lower(), urllib.parse.urljoin(url, attr(t, "href") or "")) for t in links
                        if "alternate" in (attr(t, "rel") or "").lower() and attr(t, "hreflang")]
    out["h1"] = [_WS.sub(" ", htmlmod.unescape(_TAGS.sub("", h))).strip() for h in re.findall(r"(?is)<h1\b[^>]*>(.*?)</h1>", html or "")]
    out["lang"] = attr(re.search(r"(?is)<html\b[^>]*>", html or "").group(0), "lang") if re.search(r"(?is)<html\b[^>]*>", html or "") else None
    out["jsonld_types"] = []
    for blk in re.findall(r'(?is)<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html or ""):
        try:
            j = json.loads(blk.strip())
            items = j if isinstance(j, list) else ([j] + (j.get("@graph", []) if isinstance(j, dict) else []))
            for it in items:
                if isinstance(it, dict) and it.get("@type"):
                    ty = it["@type"]; out["jsonld_types"] += ty if isinstance(ty, list) else [ty]
        except Exception: out["jsonld_types"].append("INVALID_JSON")
    text = visible_text(html); out["words"] = word_count(text); out["text"] = text
    imgs = re.findall(r"(?is)<img\b[^>]*>", html or "")
    out["images"] = len(imgs); out["images_no_alt"] = sum(1 for t in imgs if attr(t, "alt") is None)
    out["og_title"] = any((attr(t, "property") or "").lower() == "og:title" for t in metas)
    return out

def internal_links(url, html, host_ok):
    """Return (internal hrefs (absolute, fragment-stripped), nofollow count)."""
    found = []; nofollow = 0
    for a in re.findall(r"(?is)<a\b[^>]*>", html or ""):
        href = attr(a, "href")
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:", "sms:", "data:")): continue
        rel = (attr(a, "rel") or "").lower()
        if "nofollow" in rel: nofollow += 1
        absu = urllib.parse.urljoin(url, href.strip())
        absu, _ = urllib.parse.urldefrag(absu)
        p = urllib.parse.urlparse(absu)
        if p.scheme not in ("http", "https"): continue
        if host_ok(p.netloc): found.append(absu)
    return found, nofollow

def norm_host(h): return (h or "").lower().split(":")[0]
def same_site(a, b):
    a, b = norm_host(a), norm_host(b)
    return a == b or a.replace("www.", "", 1) == b.replace("www.", "", 1)

def url_family(u):
    p = urllib.parse.urlparse(u); segs = [s for s in p.path.split("/") if s]
    if not segs: return "/"
    fam = segs[0]
    if re.search(r"\d{4}", fam): return "dated"
    return "/" + fam + "/"

# --------------------------------------------------------------------------------------------- sitemaps
def parse_sitemap(text):
    """Returns ("index", [sitemap urls]) or ("urlset", [(loc, lastmod)]) or ("text", [urls]) or ("unknown", [])."""
    if not text: return "unknown", []
    t = text.strip()
    if t.startswith("<") or "<urlset" in t[:2000] or "<sitemapindex" in t[:2000]:
        if re.search(r"(?is)<sitemapindex", t):
            return "index", [htmlmod.unescape(x.strip()) for x in re.findall(r"(?is)<sitemap\b[^>]*>.*?<loc>\s*(.*?)\s*</loc>", t)]
        entries = []
        for blk in re.findall(r"(?is)<url\b[^>]*>(.*?)</url>", t):
            loc = re.search(r"(?is)<loc>\s*(.*?)\s*</loc>", blk); lm = re.search(r"(?is)<lastmod>\s*(.*?)\s*</lastmod>", blk)
            if loc: entries.append((htmlmod.unescape(loc.group(1)), lm.group(1) if lm else None))
        return "urlset", entries
    lines = [l.strip() for l in t.splitlines() if l.strip().startswith(("http://", "https://"))]
    return ("text", lines) if lines else ("unknown", [])

def maybe_gunzip(url, text, raw_bytes=None):
    if raw_bytes and raw_bytes[:2] == b"\x1f\x8b":
        try: return gzip.decompress(raw_bytes).decode("utf-8", "replace")
        except Exception: return text
    return text

# --------------------------------------------------------------------------------------------- the crawl
class Crawl:
    def __init__(self, homepage, out, session, follow_links=False, max_pages=150, max_sitemaps=25, include=None, exclude=None,
                 sample_families=False, quiet=False):
        self.home = homepage if "://" in homepage else "https://" + homepage
        self.host = norm_host(urllib.parse.urlparse(self.home).netloc)
        self.out = out; os.makedirs(out, exist_ok=True)
        self.s = session; self.follow = follow_links; self.max_pages = max_pages; self.max_sitemaps = max_sitemaps
        self.include = [i for i in (include or []) if i]; self.exclude = [re.compile(x) for x in (exclude or []) if x]
        self.sample_families = sample_families; self.quiet = quiet
        self.robots_txt = None; self.robots_status = None; self.sitemap_sources = []; self.sitemaps = OrderedDict()
        self.sitemap_urls = OrderedDict()   # url -> {"sitemap": src, "lastmod": lm}
        self.pages = OrderedDict()          # url -> record
        self.inlinks = defaultdict(set); self.depth = {}; self.findings = []; self.notes = []
        self.robots_rules_star = None; self.robots_rules_googlebot = None; self.ai_blocked = []

    # ---- robots
    def read_robots(self):
        meta, txt = self.s.get(urllib.parse.urljoin(self.home, "/robots.txt"), kind="robots")
        self.robots_status = meta.get("status"); self.robots_txt = txt if meta.get("status") == 200 else None
        if self.robots_txt:
            self.robots_rules_star = wetware.RobotsRules(self.robots_txt, "*")
            self.robots_rules_googlebot = wetware.RobotsRules(self.robots_txt, "googlebot")
            for line in self.robots_txt.splitlines():
                if line.lower().startswith("sitemap:"):
                    sm = line.split(":", 1)[1].strip()
                    if sm: self.sitemap_sources.append(("robots.txt", sm))
            # AI crawler posture (informational)
            for bot in AI_BOTS:
                r = wetware.RobotsRules(self.robots_txt, bot.lower())
                if r.disallows and not r.allowed("/"): self.ai_blocked.append(bot)
            if self.ai_blocked: self.add("AI_BOTS_BLOCKED", self.home, "blocked: " + ", ".join(self.ai_blocked))
            if self.robots_rules_star and not self.robots_rules_star.allowed("/") and (self.robots_rules_googlebot is None or not self.robots_rules_googlebot.allowed("/")):
                self.add("ROBOTS_BLOCKS_ALL", urllib.parse.urljoin(self.home, "/robots.txt"), "Disallow: / applies to * (and Googlebot has no override)")
        for guess in ("/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml", "/wp-sitemap.xml", "/sitemap/sitemap-index.xml"):
            self.sitemap_sources.append(("guess", urllib.parse.urljoin(self.home, guess)))

    def blocked_for_googlebot(self, url):
        """Does robots.txt withhold this path from Googlebot (its own group, else *)? None when no robots.txt."""
        if not self.robots_txt: return None
        p = urllib.parse.urlparse(url); path = (p.path or "/") + (("?" + p.query) if p.query else "")
        rules = self.robots_rules_googlebot if (self.robots_rules_googlebot and (self.robots_rules_googlebot.disallows or self.robots_rules_googlebot.allows)) else self.robots_rules_star
        if rules is None: return False
        return not rules.allowed(path)

    # ---- sitemaps
    def read_sitemaps(self):
        seen = set(); queue = deque(self.sitemap_sources); fetched = 0
        while queue and fetched < self.max_sitemaps:
            src, sm = queue.popleft()
            if sm in seen: continue
            seen.add(sm)
            meta, txt = self.s.get(sm, kind="sitemap", accept="application/xml,text/xml,text/plain;q=0.9,*/*;q=0.5")
            st = meta.get("status"); fetched += 1
            if st != 200 or not txt:
                self.sitemaps[sm] = {"source": src, "status": st, "kind": "missing" if src == "guess" else "error", "count": 0}
                continue
            kind, items = parse_sitemap(txt)
            if kind == "unknown":
                self.sitemaps[sm] = {"source": src, "status": st, "kind": "not-a-sitemap", "count": 0}; continue
            self.sitemaps[sm] = {"source": src, "status": st, "kind": kind, "count": len(items)}
            if kind == "index":
                for child in items: queue.append(("index:" + sm, child))
            else:
                for it in items:
                    loc, lm = (it if isinstance(it, tuple) else (it, None))
                    if loc and loc not in self.sitemap_urls: self.sitemap_urls[loc] = {"sitemap": sm, "lastmod": lm}
        if queue: self.notes.append("sitemap fetch cap (--max-sitemaps %d) reached; %d sitemap(s) not read" % (self.max_sitemaps, len(queue)))
        real = [k for k, v in self.sitemaps.items() if v["kind"] in ("index", "urlset", "text")]
        if not real: self.add("SITEMAP_MISSING", self.home, "checked robots.txt Sitemap: lines and %d common paths" % len([1 for s, _ in self.sitemap_sources if s == "guess"]))
        else:
            http_entries = [u for u in self.sitemap_urls if u.startswith("http://")]
            if http_entries: self.add("SITEMAP_HTTP_ENTRIES", real[0], "%d http:// entries, e.g. %s" % (len(http_entries), http_entries[0]))
            params = [u for u in self.sitemap_urls if "?" in u]
            if params: self.add("SITEMAP_PARAMETER_URLS", real[0], "%d parameterised entries, e.g. %s" % (len(params), params[0]))
            lms = [v["lastmod"] for v in self.sitemap_urls.values() if v.get("lastmod")]
            if lms:
                today = time.strftime("%Y-%m-%d")
                future = [l for l in lms if l[:10] > today]
                if len(set(l[:10] for l in lms)) == 1 and len(lms) > 20: self.add("SITEMAP_LASTMOD_SUSPECT", real[0], "all %d lastmod values are %s" % (len(lms), lms[0][:10]))
                elif future: self.add("SITEMAP_LASTMOD_SUSPECT", real[0], "%d lastmod values in the future, e.g. %s" % (len(future), future[0]))

    # ---- page fetch
    def wanted(self, url):
        p = urllib.parse.urlparse(url)
        if not same_site(p.netloc, self.host): return False
        if self.include and not any(p.path.startswith(i) for i in self.include): return False
        if any(x.search(url) for x in self.exclude): return False
        if re.search(r"\.(jpe?g|png|gif|webp|avif|svg|pdf|zip|mp4|mp3|css|js|ico|woff2?|xml|json)$", p.path, re.I): return False
        return True

    def plan(self):
        """Homepage first, then sitemap URLs (sampled by URL family when the cap would otherwise skew to one section)."""
        order = [self.home]
        cands = [u for u in self.sitemap_urls if self.wanted(u) and u.rstrip("/") != self.home.rstrip("/")]
        budget = max(0, self.max_pages - 1)
        if self.sample_families and len(cands) > budget:
            fams = defaultdict(list)
            for u in cands: fams[url_family(u)].append(u)
            picked = []; i = 0
            while len(picked) < budget and any(fams.values()):
                for f in list(fams):
                    if fams[f] and len(picked) < budget: picked.append(fams[f].pop(0))
                i += 1
            cands = picked
            self.notes.append("sitemap sample: %d URLs chosen round-robin across %d URL families" % (len(cands), len(fams)))
        elif len(cands) > budget:
            self.notes.append("sitemap has %d eligible URLs; only the first %d were fetched (raise --max-pages or use --sample-families)" % (len(cands), budget))
            cands = cands[:budget]
        return order + cands

    def fetch(self, url, depth):
        meta, html = self.s.get(url, kind="document")
        rec = {"url": url, "status": meta.get("status"), "final_url": meta.get("final_url") or url, "tier": meta.get("tier"),
               "chain": meta.get("chain") or [], "hops": len(meta.get("chain") or []), "bytes": meta.get("bytes"), "ttfb": meta.get("ttfb"),
               "content_type": (meta.get("headers") or {}).get("content-type"), "x_robots_tag": (meta.get("headers") or {}).get("x-robots-tag"),
               "in_sitemap": url in self.sitemap_urls, "sitemap": (self.sitemap_urls.get(url) or {}).get("sitemap"),
               "lastmod": (self.sitemap_urls.get(url) or {}).get("lastmod"), "depth": depth, "from_cache": meta.get("from_cache", False),
               "robots_blocked_googlebot": self.blocked_for_googlebot(url)}
        if rec["tier"] == "ROBOTS_DISALLOWED":
            rec.update({"indexable": None, "note": "not fetched: robots.txt withholds this path from our declared agent"})
            self.add("ROBOTS_DISALLOWED_FOR_US", url, "skipped per robots.txt")
            return rec, ""
        if rec["tier"] in ("WAF", "NOT_TESTED"):
            rec.update({"indexable": None, "note": "wall met by the declared agent"}); self.add("WALL", url, "status %s tier %s" % (rec["status"], rec["tier"]))
            return rec, ""
        if rec["status"] == 200 and html and "html" in (rec["content_type"] or "text/html"):
            p = parse_page(rec["final_url"], html); rec.update({k: v for k, v in p.items() if k != "text"})
            directives = " ".join(x for x in [(rec.get("meta_robots") or ""), (rec.get("x_robots_tag") or "").lower()] if x)
            rec["noindex"] = "noindex" in directives or "none" in directives.split(", ")
            rec["nofollow_page"] = "nofollow" in directives
            rec["indexable"] = (not rec["noindex"]) and (rec["robots_blocked_googlebot"] is not True)
            rec["self_canonical"] = (rec.get("canonical") or "").rstrip("/") == rec["final_url"].rstrip("/") if rec.get("canonical") else None
            rec["words"] = p["words"]
            if rec["hops"]:   # a redirecting URL is not itself a candidate for the index; its final URL is judged on its own row
                rec["indexable"] = False; rec["note"] = "redirects to %s; the final URL is the indexable one" % rec["final_url"]
            return rec, html
        rec["indexable"] = False
        return rec, html or ""

    def add(self, code, url, evidence):
        sev, meaning, fix = FINDINGS[code]
        self.findings.append({"code": code, "severity": sev, "url": url, "evidence": evidence, "meaning": meaning, "fix": fix})

    def judge(self, rec):
        """Per-URL index-decision findings."""
        u = rec["url"]; is_home = u.rstrip("/") == self.home.rstrip("/")
        if is_home:
            if rec.get("status") != 200: self.add("HOMEPAGE_ERROR", u, "status %s -> %s" % (rec.get("status"), rec.get("final_url")))
            elif rec.get("noindex"): self.add("HOMEPAGE_NOINDEX", u, rec.get("meta_robots") or rec.get("x_robots_tag") or "noindex")
        if rec["in_sitemap"]:
            if rec.get("status") and rec["status"] >= 400: self.add("SITEMAP_URL_ERROR", u, "status %s" % rec["status"])
            elif rec.get("hops"): self.add("SITEMAP_REDIRECT", u, "%d hop(s) -> %s" % (rec["hops"], rec["final_url"]))
            if rec.get("noindex"): self.add("NOINDEX_IN_SITEMAP", u, rec.get("meta_robots") or rec.get("x_robots_tag") or "noindex")
            if rec.get("robots_blocked_googlebot"): self.add("ROBOTS_BLOCKED_IN_SITEMAP", u, "robots.txt disallows this path for Googlebot/*")
            if rec.get("canonical") and rec.get("self_canonical") is False and not rec.get("hops"):
                self.add("CANONICALIZED_AWAY", u, "canonical -> %s" % rec["canonical"])
        if rec.get("hops", 0) >= 2: self.add("REDIRECT_CHAIN", u, " -> ".join([str(h.get("status")) + " " + (h.get("to") or "") for h in rec["chain"]]))
        if rec.get("status") == 200 and rec.get("indexable"):
            if not rec.get("canonical"): self.add("MISSING_CANONICAL", u, "no <link rel=canonical>")
            elif rec.get("self_canonical") is False:
                cp, fp = urllib.parse.urlparse(rec["canonical"]), urllib.parse.urlparse(rec["final_url"])
                if cp.scheme != fp.scheme or norm_host(cp.netloc) != norm_host(fp.netloc):
                    self.add("CANONICAL_MISMATCH_SCHEME_HOST", u, "canonical %s vs served %s" % (rec["canonical"], rec["final_url"]))
            if not rec.get("title"): self.add("MISSING_TITLE", u, "no <title>")
            elif len(rec["title"]) > 70: self.add("LONG_TITLE", u, "%d chars: %s" % (len(rec["title"]), rec["title"][:90]))
            if not rec.get("description"): self.add("MISSING_DESCRIPTION", u, "no meta description")
            h1 = rec.get("h1") or []
            if not h1: self.add("NO_H1", u, "no <h1>")
            elif len(h1) > 1: self.add("MULTIPLE_H1", u, "%d H1s: %s" % (len(h1), " | ".join(x[:40] for x in h1[:3])))
            if not rec.get("viewport"): self.add("NO_VIEWPORT", u, "no viewport meta")
            if (rec.get("words") or 0) < 150: self.add("THIN_PAGE", u, "%d visible words in raw HTML" % (rec.get("words") or 0))
            if (rec.get("bytes") or 0) > 1_000_000: self.add("LARGE_HTML", u, "%d bytes" % rec["bytes"])
            if rec.get("depth") is not None and rec["depth"] >= 4: self.add("DEEP_PAGE", u, "depth %d" % rec["depth"])
            if rec.get("hreflang"):
                selfref = any(same_site(urllib.parse.urlparse(h).netloc, self.host) and h.rstrip("/") == rec["final_url"].rstrip("/") for _, h in rec["hreflang"])
                if not selfref: self.add("HREFLANG_SELF_MISSING", u, "%d hreflang entries, none self" % len(rec["hreflang"]))
            if not rec["in_sitemap"] and self.sitemap_urls and not is_home: self.add("NOT_IN_SITEMAP", u, "reached via links; absent from %d sitemap URLs" % len(self.sitemap_urls))
        elif rec.get("status") == 200 and rec.get("noindex"): self.add("NOINDEX_FOLLOWED_LINKS", u, rec.get("meta_robots") or rec.get("x_robots_tag") or "noindex")

    def run(self):
        t0 = time.time()
        self.read_robots(); self.read_sitemaps()
        queue = deque((u, 0 if u.rstrip("/") == self.home.rstrip("/") else None) for u in self.plan())
        canon_targets = {}
        while queue and len(self.pages) < self.max_pages:
            url, depth = queue.popleft()
            if url in self.pages: continue
            rec, html = self.fetch(url, depth)
            self.pages[url] = rec
            if html and rec.get("status") == 200:
                links, nofollow = internal_links(rec["final_url"], html, lambda h: same_site(h, self.host))
                rec["internal_links_out"] = len(links); rec["nofollow_links"] = nofollow
                for l in links:
                    if l != url: self.inlinks[l].add(url)
                    if self.follow and self.wanted(l) and l not in self.pages and len(self.pages) + len(queue) < self.max_pages * 3:
                        queue.append((l, (depth + 1) if depth is not None else None))
                if rec.get("canonical") and rec.get("self_canonical") is False: canon_targets[url] = rec["canonical"]
            if not self.quiet: print("  crawl %s %s%s" % (rec.get("status"), url, " (%d words)" % rec["words"] if rec.get("words") is not None else ""), file=sys.stderr)
        # depth via BFS over the observed link graph from the homepage
        self.depth = {self.home: 0}; dq = deque([self.home]); adj = defaultdict(set)
        for tgt, srcs in self.inlinks.items():
            for s in srcs: adj[s].add(tgt)
        while dq:
            n = dq.popleft()
            for m in adj.get(n, ()):
                if m not in self.depth: self.depth[m] = self.depth[n] + 1; dq.append(m)
        for u, rec in self.pages.items():
            rec["depth"] = self.depth.get(u, self.depth.get(rec.get("final_url"), rec.get("depth")))
            rec["inlinks"] = len(self.inlinks.get(u, ())) + (len(self.inlinks.get(rec.get("final_url"), ())) if rec.get("final_url") != u else 0)
        # canonical targets that error / noindex (only for targets we fetched)
        for src, tgt in canon_targets.items():
            t = self.pages.get(tgt) or self.pages.get(tgt.rstrip("/")) or self.pages.get(tgt + "/")
            if t:
                if t.get("status") != 200 or t.get("hops"): self.add("CANONICAL_TO_ERROR", src, "canonical %s -> status %s hops %s" % (tgt, t.get("status"), t.get("hops")))
                elif t.get("noindex"): self.add("CANONICAL_TO_NOINDEX", src, "canonical %s is noindex" % tgt)
        for rec in self.pages.values(): self.judge(rec)
        # duplicates across fetched indexable pages
        by_title = defaultdict(list); by_desc = defaultdict(list)
        for u, r in self.pages.items():
            if r.get("status") == 200 and r.get("indexable"):
                if r.get("title"): by_title[r["title"].strip().lower()].append(u)
                if r.get("description"): by_desc[r["description"].strip().lower()].append(u)
        for t, us in by_title.items():
            if len(us) > 1: self.add("DUPLICATE_TITLE", us[0], "%d pages share %r: %s" % (len(us), t[:70], ", ".join(us[1:4])))
        for d, us in by_desc.items():
            if len(us) > 1: self.add("DUPLICATE_DESCRIPTION", us[0], "%d pages share the description: %s" % (len(us), ", ".join(us[1:4])))
        # orphans: sitemap URLs with no observed in-link (only meaningful with a link crawl)
        crawled_ok = [u for u, r in self.pages.items() if r.get("status") == 200]
        coverage = len(crawled_ok) / max(1, len(self.sitemap_urls)) if self.sitemap_urls else 0
        for u in self.sitemap_urls:
            if u.rstrip("/") == self.home.rstrip("/"): continue
            r = self.pages.get(u)
            if r and r.get("status") == 200 and not self.inlinks.get(u) and not self.inlinks.get(r.get("final_url")):
                self.add("ORPHAN" if (self.follow and coverage >= 0.8) else "ORPHAN_CANDIDATE", u, "no internal in-link among %d fetched pages (coverage %.0f%% of sitemap)" % (len(crawled_ok), coverage * 100))
        # trailing-slash consistency (only where both variants were fetched)
        for u, r in self.pages.items():
            alt = u[:-1] if u.endswith("/") else u + "/"
            a = self.pages.get(alt)
            if a and r.get("status") == 200 and a.get("status") == 200 and not r.get("hops") and not a.get("hops") and u < alt:
                self.add("MIXED_TRAILING_SLASH", u, "both %s and %s return 200" % (u, alt))
        self.findings.sort(key=lambda f: (SEV_ORDER.get(f["severity"], 9), f["code"], f["url"]))
        self.elapsed = round(time.time() - t0, 1)
        self.write()

    # ---- outputs
    def summary(self):
        st = Counter()
        for r in self.pages.values():
            if r.get("tier") == "ROBOTS_DISALLOWED": st["robots_disallowed_for_us"] += 1
            elif r.get("tier") in ("WAF", "NOT_TESTED"): st["wall"] += 1
            elif r.get("status") is None or (r.get("status") or 0) >= 400 or r.get("status") == 0: st["error"] += 1
            elif r.get("hops"): st["redirected"] += 1
            elif r.get("noindex"): st["noindex"] += 1
            elif r.get("robots_blocked_googlebot"): st["robots_blocked_googlebot"] += 1
            else: st["indexable"] += 1
        sev = Counter(f["severity"] for f in self.findings)
        return {"homepage": self.home, "host": self.host, "fetched_pages": len(self.pages), "sitemap_urls_total": len(self.sitemap_urls),
                "sitemaps": self.sitemaps, "robots_status": self.robots_status, "ai_bots_blocked": self.ai_blocked, "follow_links": self.follow,
                "index_status": dict(st), "findings_by_severity": dict(sev), "depth_histogram": dict(Counter(r.get("depth") for r in self.pages.values() if r.get("depth") is not None)),
                "elapsed_s": getattr(self, "elapsed", None), "notes": self.notes, "presence": self.s.presence(), "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

    def write(self):
        out = self.out
        json.dump({"summary": self.summary(), "pages": list(self.pages.values()), "findings": self.findings, "catalogue": {k: {"severity": v[0], "meaning": v[1], "fix": v[2]} for k, v in FINDINGS.items()}},
                  open(os.path.join(out, "crawl.json"), "w"), indent=1, default=str)
        cols = ["url", "status", "final_url", "hops", "tier", "in_sitemap", "depth", "inlinks", "indexable", "noindex", "robots_blocked_googlebot", "canonical", "self_canonical",
                "title", "description", "h1_count", "words", "bytes", "ttfb", "viewport", "lang", "jsonld_types", "images", "images_no_alt", "lastmod", "finding_codes"]
        codes = defaultdict(list)
        for f in self.findings: codes[f["url"]].append(f["code"])
        with open(os.path.join(out, "crawl.csv"), "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh); w.writerow(cols)
            for u, r in self.pages.items():
                row = dict(r); row["h1_count"] = len(r.get("h1") or []); row["jsonld_types"] = "|".join(r.get("jsonld_types") or []); row["finding_codes"] = "|".join(codes.get(u, []))
                w.writerow([row.get(c, "") if row.get(c) is not None else "" for c in cols])
        with open(os.path.join(out, "findings.csv"), "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh); w.writerow(["severity", "code", "url", "evidence", "meaning", "fix"])
            for f in self.findings: w.writerow([f["severity"], f["code"], f["url"], f["evidence"], f["meaning"], f["fix"]])
        with open(os.path.join(out, "sitemap_inventory.csv"), "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh); w.writerow(["url", "sitemap", "lastmod", "family", "fetched", "status"])
            for u, v in self.sitemap_urls.items():
                r = self.pages.get(u); w.writerow([u, v.get("sitemap"), v.get("lastmod"), url_family(u), bool(r), (r or {}).get("status", "")])
        open(os.path.join(out, "presence.txt"), "w").write(wetware.presence_sentence(self.s.presence()) if hasattr(wetware, "presence_sentence") else json.dumps(self.s.presence()))
        open(os.path.join(out, "crawl_report.md"), "w").write(self.report_md())

    def report_md(self):
        s = self.summary(); L = []
        L.append("# Crawl & Index audit — %s\n" % self.host)
        L.append("Generated %s by %s (honest mode: declared UA, robots.txt obeyed, rate-limited). %d page(s) fetched; %d URL(s) in %d sitemap file(s); link-graph discovery %s.\n"
                 % (s["generated_at"], TOOL, s["fetched_pages"], s["sitemap_urls_total"], len([1 for v in self.sitemaps.values() if v["kind"] in ("index", "urlset", "text")]), "ON" if self.follow else "OFF (sitemap-only; orphan findings are candidates)"))
        L.append("## Index status of fetched URLs\n")
        for k in ("indexable", "noindex", "robots_blocked_googlebot", "redirected", "error", "wall", "robots_disallowed_for_us"):
            if s["index_status"].get(k): L.append("- %s: %d" % (k, s["index_status"][k]))
        if s["depth_histogram"]: L.append("- crawl depth histogram (from the homepage over observed links): %s" % ", ".join("%s:%d" % kv for kv in sorted(s["depth_histogram"].items(), key=lambda x: (x[0] is None, x[0]))))
        if self.ai_blocked: L.append("- AI crawlers blocked in robots.txt: %s" % ", ".join(self.ai_blocked))
        L.append("\n## Sitemaps\n")
        for sm, v in self.sitemaps.items():
            if v["kind"] in ("index", "urlset", "text") or v["source"] == "robots.txt": L.append("- %s — %s, status %s, %d entries (%s)" % (sm, v["kind"], v["status"], v["count"], v["source"]))
        for n in self.notes: L.append("- note: %s" % n)
        L.append("\n## Findings (severity-ranked)\n")
        if not self.findings: L.append("No findings in the fetched set. Confirm index state with GSC URL Inspection (below).")
        grouped = defaultdict(list)
        for f in self.findings: grouped[(SEV_ORDER.get(f["severity"], 9), f["severity"], f["code"])].append(f)
        for (_, sev, code), fs in sorted(grouped.items()):
            meaning, fix = FINDINGS[code][1], FINDINGS[code][2]
            L.append("### %s — %s (%d)\n" % (sev, code, len(fs)))
            L.append("%s. Fix: %s.\n" % (meaning[0].upper() + meaning[1:], fix))
            for f in fs[:25]: L.append("- %s — %s" % (f["url"], f["evidence"]))
            if len(fs) > 25: L.append("- … %d more in findings.csv" % (len(fs) - 25))
            L.append("")
        L.append("## Ground truth this crawl cannot see — GSC URL Inspection (verify task for the owner)\n")
        L.append("1. Open Google Search Console for the verified property. 2. Paste each URL flagged High or Medium above into the URL Inspection bar. "
                 "3. Record: 'URL is on Google' / 'not on Google', the Coverage reason, 'User-declared canonical' vs 'Google-selected canonical', last crawl date, and 'Crawl allowed? / Indexing allowed?'. "
                 "4. Use TEST LIVE URL and VIEW CRAWLED PAGE to compare Google's rendered HTML with the raw HTML this crawl saw (JS-dependent content shows up here). "
                 "5. Export Pages (Indexing) report: 'Crawled - currently not indexed', 'Discovered - currently not indexed', 'Duplicate without user-selected canonical', 'Alternate page with proper canonical tag', 'Not found (404)', 'Soft 404', 'Excluded by noindex', 'Blocked by robots.txt'. "
                 "These rows close the Crawl & Index findings as CONFIRMED / CLEARED.\n")
        L.append("Presence: %s\n" % (wetware.presence_sentence(self.s.presence()) if hasattr(wetware, "presence_sentence") else json.dumps(self.s.presence())))
        return "\n".join(L)

# --------------------------------------------------------------------------------------------- render (honest, mobile)
def render(urls, out, session, wait=6.0, viewport="412x915", screenshots=None, quiet=False):
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:
        rows = [{"url": u, "status": "NOT_TESTED", "note": "Playwright not importable: %s (pip install playwright && playwright install chromium)" % e} for u in urls]
        json.dump({"tool": TOOL, "mode": "honest", "rows": rows}, open(out, "w"), indent=1); print(json.dumps(rows, indent=1)); return rows
    vw, vh = [int(x) for x in viewport.lower().split("x")]
    rows = []
    if screenshots: os.makedirs(screenshots, exist_ok=True)
    with sync_playwright() as pw:
        browser, ctx = wetware.render_launch_honest(pw, session.declared_ua, locale=session.locale)
        ctx.close()
        ctx = browser.new_context(user_agent=session.declared_ua, locale=session.locale, viewport={"width": vw, "height": vh}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
        for u in urls:
            u = u if "://" in u else "https://" + u
            raw_meta, raw_html = session.get(u, kind="document")
            row = {"url": u, "raw_status": raw_meta.get("status"), "raw_tier": raw_meta.get("tier"), "raw_words": word_count(visible_text(raw_html)) if raw_html else 0}
            if raw_meta.get("tier") == "ROBOTS_DISALLOWED":
                row.update({"status": "ROBOTS_DISALLOWED", "note": "robots.txt withholds this URL from our declared agent; not rendered"}); rows.append(row); continue
            page = ctx.new_page(); console_errors = []; requests = Counter(); t0 = time.time()
            page.on("console", lambda m: console_errors.append(m.text[:200]) if m.type == "error" else None)
            page.on("request", lambda r: requests.update([urllib.parse.urlparse(r.url).netloc]))
            try:
                resp = page.goto(u, wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(int(wait * 1000))
                try: page.mouse.wheel(0, 1200); page.wait_for_timeout(800); page.mouse.wheel(0, 2400); page.wait_for_timeout(800)
                except Exception: pass
                rendered_html = page.content()
                nav = page.evaluate("""() => { const n = performance.getEntriesByType('navigation')[0]; if (!n) return null;
                    return {ttfb: n.responseStart - n.requestStart, domContentLoaded: n.domContentLoadedEventEnd, load: n.loadEventEnd, transferSize: n.transferSize, type: n.type}; }""")
                lcp = page.evaluate("""() => new Promise(res => { let v = null; try { new PerformanceObserver(l => { const e = l.getEntries(); if (e.length) v = e[e.length-1].startTime; }).observe({type:'largest-contentful-paint', buffered:true}); } catch(e) {} setTimeout(() => res(v), 300); })""")
                r_text = visible_text(rendered_html); r_words = word_count(r_text)
                raw_h = set(h.lower() for h in re.findall(r"(?is)<h[1-3]\b[^>]*>(.*?)</h[1-3]>", _TAG_STRIP.sub(" ", raw_html or ""))); raw_h = set(_WS.sub(" ", _TAGS.sub("", htmlmod.unescape(h))).strip() for h in raw_h)
                ren_h = set(h.lower() for h in re.findall(r"(?is)<h[1-3]\b[^>]*>(.*?)</h[1-3]>", _TAG_STRIP.sub(" ", rendered_html or ""))); ren_h = set(_WS.sub(" ", _TAGS.sub("", htmlmod.unescape(h))).strip() for h in ren_h)
                raw_links = len(re.findall(r"(?is)<a\b[^>]*href=", raw_html or "")); ren_links = len(re.findall(r"(?is)<a\b[^>]*href=", rendered_html or ""))
                raw_ld = parse_page(u, raw_html or "")["jsonld_types"]; ren_ld = parse_page(u, rendered_html)["jsonld_types"]
                ratio = (r_words - row["raw_words"]) / max(1, r_words) if r_words else 0.0
                row.update({"status": resp.status if resp else None, "final_url": page.url, "rendered_words": r_words, "js_dependent_share": round(max(0.0, ratio), 3),
                            "rendered_only_headings": sorted(ren_h - raw_h)[:15], "raw_links": raw_links, "rendered_links": ren_links,
                            "jsonld_raw": raw_ld, "jsonld_rendered_only": sorted(set(ren_ld) - set(raw_ld)), "title_rendered": page.title(),
                            "nav_timing_ms": nav, "lcp_ms_lab": lcp, "console_errors": console_errors[:10], "third_party_hosts": len([h for h in requests if not same_site(h, urllib.parse.urlparse(u).netloc)]),
                            "requests": sum(requests.values()), "viewport": viewport, "wall_s": round(time.time() - t0, 1),
                            "verdict": ("JS-DEPENDENT: %d%% of visible words exist only after rendering" % round(ratio * 100)) if ratio >= 0.3 else ("PARTLY JS-DEPENDENT (%d%%)" % round(ratio * 100) if ratio >= 0.1 else "server-visible: raw HTML carries the content")})
                if screenshots:
                    fn = os.path.join(screenshots, hashlib.sha1(u.encode()).hexdigest()[:12] + ".png"); page.screenshot(path=fn, full_page=True); row["screenshot"] = fn
            except Exception as e:
                row.update({"status": "ERROR", "note": str(e)[:200]})
            finally:
                page.close()
            rows.append(row)
            if not quiet: print("  render %s %s — %s" % (row.get("status"), u, row.get("verdict", row.get("note", ""))), file=sys.stderr)
        browser.close()
    json.dump({"tool": TOOL, "mode": "honest (declared UA, mobile viewport, no stealth)", "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "rows": rows}, open(out, "w"), indent=1, default=str)
    md = os.path.splitext(out)[0] + ".md"
    with open(md, "w") as fh:
        fh.write("# Render check (mobile, honest) — %d URL(s)\n\n| URL | status | raw words | rendered words | JS share | LCP lab ms | verdict |\n|---|---|---|---|---|---|---|\n" % len(rows))
        for r in rows: fh.write("| %s | %s | %s | %s | %s | %s | %s |\n" % (r["url"], r.get("status"), r.get("raw_words"), r.get("rendered_words", ""), r.get("js_dependent_share", ""), r.get("lcp_ms_lab", ""), r.get("verdict", r.get("note", ""))))
        fh.write("\nLab numbers come from one headless Chromium load from this workspace's vantage and are labeled as such; field Core Web Vitals come from CrUX / PSI / GSC, never from here.\n")
    return rows

# --------------------------------------------------------------------------------------------- verify-googlebot
GOOGLE_RANGE_FEEDS = {
    "googlebot": "https://developers.google.com/static/search/apis/ipranges/googlebot.json",
    "special-crawlers": "https://developers.google.com/static/search/apis/ipranges/special-crawlers.json",
    "user-triggered-fetchers": "https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers.json",
    "user-triggered-fetchers-google": "https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers-google.json",
}
BING_RANGE_FEED = "https://www.bing.com/toolbox/bingbot.json"
CLAIM_RX = re.compile(r"(Googlebot|AdsBot-Google|Mediapartners-Google|Storebot-Google|Google-InspectionTool|GoogleOther|Google-Extended|APIs-Google|FeedFetcher-Google|bingbot|adidxbot|BingPreview)", re.I)
PTR_OK = {"google": (".googlebot.com", ".google.com", ".googleusercontent.com"), "bing": (".search.msn.com",)}
LOG_RX = re.compile(r'^(?P<ip>\S+)\s+\S+\s+\S+\s+\[(?P<time>[^\]]+)\]\s+"(?P<req>[^"]*)"\s+(?P<status>\d{3})\s+(?P<size>\S+)(?:\s+"(?P<ref>[^"]*)"\s+"(?P<ua>[^"]*)")?')

def load_ranges(session, offline=False):
    ranges = {"google": [], "bing": [], "sources": {}, "errors": {}}
    if offline: ranges["errors"]["offline"] = "range feeds not fetched (--offline)"; return ranges
    for name, url in GOOGLE_RANGE_FEEDS.items():
        try:
            m, txt = session.get(url, kind="api", accept="application/json", pace=True)
            if m.get("status") == 200:
                j = json.loads(txt); n = 0
                for p in j.get("prefixes", []):
                    cidr = p.get("ipv4Prefix") or p.get("ipv6Prefix")
                    if cidr: ranges["google"].append(ipaddress.ip_network(cidr, strict=False)); n += 1
                ranges["sources"][name] = {"url": url, "prefixes": n, "creationTime": j.get("creationTime")}
            else: ranges["errors"][name] = "HTTP %s" % m.get("status")
        except Exception as e: ranges["errors"][name] = str(e)[:120]
    try:
        m, txt = session.get(BING_RANGE_FEED, kind="api", accept="application/json", pace=True)
        if m.get("status") == 200:
            j = json.loads(txt); n = 0
            for p in j.get("prefixes", []):
                cidr = p.get("ipv4Prefix") or p.get("ipv6Prefix")
                if cidr: ranges["bing"].append(ipaddress.ip_network(cidr, strict=False)); n += 1
            ranges["sources"]["bingbot"] = {"url": BING_RANGE_FEED, "prefixes": n}
        else: ranges["errors"]["bingbot"] = "HTTP %s" % m.get("status")
    except Exception as e: ranges["errors"]["bingbot"] = str(e)[:120]
    return ranges

def _with_timeout(fn, seconds):
    """Run a resolver call on a daemon thread so a hung DNS never stalls the run (resolver calls ignore socket timeouts)."""
    import threading
    box = {}
    def run():
        try: box["v"] = fn()
        except Exception as e: box["e"] = e
    t = threading.Thread(target=run, daemon=True); t.start(); t.join(seconds)
    if t.is_alive(): raise TimeoutError("timed out after %.0fs" % seconds)
    if "e" in box: raise box["e"]
    return box.get("v")

def rdns_check(ip, family, timeout=6.0):
    """Forward-confirmed reverse DNS. Returns (ptr, ptr_ok, forward_ok, error)."""
    try: ptr = _with_timeout(lambda: socket.gethostbyaddr(ip)[0], timeout)
    except Exception as e: return None, False, False, "PTR lookup failed: %s" % (str(e)[:80])
    ptr_ok = ptr.lower().endswith(PTR_OK[family])
    try:
        fwd = _with_timeout(lambda: set(a[4][0] for a in socket.getaddrinfo(ptr, None)), timeout)
        return ptr, ptr_ok, ip in fwd, None
    except Exception as e: return ptr, ptr_ok, False, "forward lookup failed: %s" % (str(e)[:80])

def verify_googlebot(logs, ips, out, session, offline=False, max_ips=500, quiet=False):
    os.makedirs(out, exist_ok=True)
    claims = defaultdict(lambda: {"hits": 0, "uas": Counter(), "first": None, "last": None, "paths": Counter(), "statuses": Counter()})
    parsed = skipped = 0
    for path in logs or []:
        opener = gzip.open if path.endswith(".gz") else open
        with opener(path, "rt", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if not line: continue
                ip = ua = req = None; ts = st = None
                if line.startswith("{"):
                    try:
                        j = json.loads(line); ip = j.get("remote_addr") or j.get("client_ip") or j.get("ip") or j.get("remoteIp"); ua = j.get("http_user_agent") or j.get("user_agent") or j.get("ua") or j.get("userAgent")
                        req = j.get("request") or j.get("uri") or j.get("path"); ts = j.get("time_local") or j.get("time") or j.get("timestamp"); st = j.get("status")
                    except Exception: skipped += 1; continue
                else:
                    m = LOG_RX.match(line)
                    if not m: skipped += 1; continue
                    ip, ua, req, ts, st = m.group("ip"), m.group("ua"), m.group("req"), m.group("time"), m.group("status")
                parsed += 1
                if not ua or not CLAIM_RX.search(ua): continue
                c = claims[ip]; c["hits"] += 1; c["uas"][ua[:120]] += 1; c["first"] = c["first"] or ts; c["last"] = ts; c["statuses"][str(st)] += 1
                if req: c["paths"][(req.split(" ")[1] if " " in req else req)[:80]] += 1
    for ip in ips or []: claims[ip]["hits"] += 0; claims[ip]["uas"]["(supplied IP, no UA)"] += 1
    ranges = load_ranges(session, offline=offline)
    rows = []
    for ip, c in list(claims.items())[:max_ips]:
        fam = "bing" if any(re.search(r"bingbot|adidxbot|BingPreview", u, re.I) for u in c["uas"]) and not any(re.search(r"Google", u, re.I) for u in c["uas"]) else "google"
        try: ipobj = ipaddress.ip_address(ip)
        except Exception: rows.append({"ip": ip, "verdict": "UNVERIFIED", "method": "not an IP address", "hits": c["hits"]}); continue
        in_range = any(ipobj in n for n in ranges[fam]) if ranges[fam] else None
        ptr, ptr_ok, fwd_ok, err = (None, False, False, "DNS not attempted (--offline)") if offline else rdns_check(ip, fam)
        rdns_verified = bool(ptr_ok and fwd_ok)
        if rdns_verified or in_range: verdict = "VERIFIED"
        elif ptr is not None and not ptr_ok: verdict = "FAKE" if in_range is False else "FAKE (PTR outside the crawler domains; range feed unavailable)"   # a real crawler's PTR is always in googlebot.com / google.com / search.msn.com
        elif ptr is not None and ptr_ok and not fwd_ok and not err: verdict = "FAKE" if in_range is False else "FAKE (PTR does not resolve back to the IP; range feed unavailable)"
        elif in_range is False and (ptr is None or err): verdict = "LIKELY FAKE (not in published ranges; rDNS could not be completed)"
        else: verdict = "UNVERIFIED"
        rows.append({"ip": ip, "family": fam, "verdict": verdict, "hits": c["hits"], "user_agents": "; ".join("%s (%d)" % kv for kv in c["uas"].most_common(3)),
                     "ptr": ptr, "ptr_suffix_ok": ptr_ok, "forward_confirmed": fwd_ok, "in_published_ranges": in_range, "dns_error": err,
                     "first_seen": c["first"], "last_seen": c["last"], "top_paths": "; ".join("%s (%d)" % kv for kv in c["paths"].most_common(3)), "statuses": dict(c["statuses"]),
                     "method": "forward-confirmed rDNS%s" % (" + published IP ranges" if ranges[fam] else " (range feed unavailable)")})
    rows.sort(key=lambda r: ({"FAKE": 0, "LIKELY": 1, "UNVERIFIED": 2, "VERIFIED": 3}.get(r["verdict"].split(" ")[0], 2), -r.get("hits", 0)))
    with open(os.path.join(out, "googlebot_verify.csv"), "w", newline="", encoding="utf-8") as fh:
        cols = ["ip", "family", "verdict", "hits", "user_agents", "ptr", "ptr_suffix_ok", "forward_confirmed", "in_published_ranges", "dns_error", "first_seen", "last_seen", "top_paths", "statuses", "method"]
        w = csv.writer(fh); w.writerow(cols)
        for r in rows: w.writerow([json.dumps(r.get(c)) if isinstance(r.get(c), dict) else r.get(c, "") for c in cols])
    summ = Counter(r["verdict"].split(" ")[0] for r in rows)
    res = {"tool": TOOL, "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "log_lines_parsed": parsed, "log_lines_skipped": skipped,
           "claiming_ips": len(claims), "checked_ips": len(rows), "verdicts": dict(summ), "range_feeds": ranges["sources"], "range_feed_errors": ranges["errors"], "rows": rows}
    json.dump(res, open(os.path.join(out, "googlebot_verify.json"), "w"), indent=1, default=str)
    with open(os.path.join(out, "googlebot_verify.md"), "w") as fh:
        fh.write("# Googlebot verification — %d IP(s) claiming a search-engine identity\n\n" % len(rows))
        fh.write("Parsed %d log line(s) (%d unparseable). Verdicts: %s. Method: forward-confirmed reverse DNS (PTR must end in a Google/Microsoft crawler domain AND resolve back to the IP) plus the published crawler IP-range feeds (%s).\n\n"
                 % (parsed, skipped, ", ".join("%s %d" % kv for kv in summ.items()) or "none", ", ".join(ranges["sources"]) or "unavailable: " + "; ".join("%s: %s" % kv for kv in ranges["errors"].items())))
        fh.write("| IP | verdict | hits | PTR | forward | in ranges | UA |\n|---|---|---|---|---|---|---|\n")
        for r in rows[:200]: fh.write("| %s | %s | %s | %s | %s | %s | %s |\n" % (r["ip"], r["verdict"], r.get("hits"), r.get("ptr") or "", r.get("forward_confirmed"), r.get("in_published_ranges"), (r.get("user_agents") or "")[:80]))
        fh.write("\nA FAKE verdict means the request CLAIMED a crawler identity and the network disproved it. A real crawler never fails both checks. An UNVERIFIED verdict is not a clean bill: it means the check could not run from here (DNS or range feed unavailable); re-run from a host with DNS, or with the feeds reachable. Block FAKE IPs at the edge and consider a reverse-DNS gate for Googlebot-claiming requests; report scraper networks to the host.\n")
    if not quiet: print(json.dumps({"verdicts": dict(summ), "checked": len(rows), "feeds": list(ranges["sources"]), "feed_errors": ranges["errors"]}, indent=1))
    return res

# --------------------------------------------------------------------------------------------- CLI
def _session(a, out_dir):
    cache = a.cache or (os.path.dirname(os.path.abspath(out_dir.rstrip("/"))) if out_dir else "omega_cache/run")
    ua = a.ua or os.environ.get("UW_USER_AGENT") or os.environ.get("MO_USER_AGENT")
    s = wetware.Session(cache, locale=a.locale, assets=False, quiet=a.quiet, honest=True, declared_ua=ua, obey_robots=not a.ignore_robots, min_interval=a.min_interval)
    if "REPLACE" in (s.declared_ua or "") and not a.quiet:
        print("note: the declared User-Agent still carries the REPLACE placeholder; set --ua or UW_USER_AGENT to the tool's own UA with a real contact URL", file=sys.stderr)
    return s

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ua", default=None, help="declared User-Agent (else $UW_USER_AGENT / $MO_USER_AGENT / wetware default)")
    ap.add_argument("--cache", default=None, help="wetware cache dir (default: parent of --out)")
    ap.add_argument("--locale", default="en-US"); ap.add_argument("--min-interval", type=float, default=None, help="seconds between requests per host (default 2; Crawl-delay honored)")
    ap.add_argument("--ignore-robots", action="store_true", help="fetch paths robots.txt disallows (a stated judgment call, logged loudly)")
    ap.add_argument("--quiet", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("crawl"); c.add_argument("homepage"); c.add_argument("--out", required=True); c.add_argument("--follow-links", action="store_true")
    c.add_argument("--max-pages", type=int, default=150); c.add_argument("--max-sitemaps", type=int, default=25); c.add_argument("--include", action="append", default=[], help="path prefix to keep (repeatable)")
    c.add_argument("--exclude", action="append", default=[], help="regex to drop (repeatable)"); c.add_argument("--sample-families", action="store_true", help="round-robin the sitemap by URL family when it exceeds --max-pages")
    r = sub.add_parser("render"); r.add_argument("urls", nargs="+"); r.add_argument("--out", required=True); r.add_argument("--wait", type=float, default=6.0)
    r.add_argument("--viewport", default="412x915"); r.add_argument("--screenshots", default=None)
    v = sub.add_parser("verify-googlebot"); v.add_argument("--log", action="append", default=[]); v.add_argument("--ips", nargs="*", default=[]); v.add_argument("--out", required=True)
    v.add_argument("--offline", action="store_true", help="skip DNS and range-feed fetches (verdicts become UNVERIFIED)"); v.add_argument("--max-ips", type=int, default=500)
    p = sub.add_parser("report"); p.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.cmd == "report":
        j = json.load(open(os.path.join(a.out, "crawl.json"))); s = j["summary"]
        print("Google Crawl of %s: %d pages fetched, %d sitemap URLs; index status %s; findings %s; AI bots blocked: %s. %s"
              % (s["host"], s["fetched_pages"], s["sitemap_urls_total"], s["index_status"], s["findings_by_severity"], ", ".join(s["ai_bots_blocked"]) or "none", open(os.path.join(a.out, "presence.txt")).read().strip()[:400]))
        return
    if a.cmd == "crawl":
        s = _session(a, a.out)
        try: Crawl(a.homepage, a.out, s, follow_links=a.follow_links, max_pages=a.max_pages, max_sitemaps=a.max_sitemaps, include=a.include, exclude=a.exclude, sample_families=a.sample_families, quiet=a.quiet).run()
        finally: s.close()
        print(open(os.path.join(a.out, "crawl_report.md")).read()[:20000])
    elif a.cmd == "render":
        s = _session(a, os.path.dirname(os.path.abspath(a.out)))
        try: render(a.urls, a.out, s, wait=a.wait, viewport=a.viewport, screenshots=a.screenshots, quiet=a.quiet)
        finally: s.close()
    elif a.cmd == "verify-googlebot":
        if not a.log and not a.ips: ap.error("verify-googlebot needs --log FILE and/or --ips IP ...")
        s = _session(a, a.out); s.timeout = 12; s.max_retries = 0   # the range feeds either answer quickly or are recorded unavailable
        try: verify_googlebot(a.log, a.ips, a.out, s, offline=a.offline, max_ips=a.max_ips, quiet=a.quiet)
        finally: s.close()

if __name__ == "__main__":
    main()
