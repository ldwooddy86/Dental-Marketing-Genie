#!/usr/bin/env python3
"""OMEGAWEAPON platform: deepen one Agency Radar record with a bounded, honest fetch of its own site.

The Anubis dossier (scripts/radar_dossier.py) and the needs layer (scripts/radar_needs.py) read a `deep` block on each
agency record: dated case studies, dated news, open jobs, the ATS, recent blog dates. The Radar compile fills it for the
agencies it went deep on; this script fills it for any other agency from the agency's own sitemap and a small number of
its own pages, so the next spine and narrative have engagement evidence to weigh instead of names only.

Usage
  python3 scripts/radar_deepen.py missing [--limit 20]                 # agencies without a deep block, most prominent first
  python3 scripts/radar_deepen.py plan <id|domain> [--cache DIR]       # the URL plan from a cached sitemap (no network)
  python3 scripts/radar_deepen.py fetch <id|domain> [--cache DIR] [--max-cases 12] [--max-news 8] [--max-pages 30]
  python3 scripts/radar_deepen.py ingest <id|domain> [--cache DIR] [--write] [--add-clients]
  python3 scripts/radar_deepen.py run <id|domain> [--write] [--add-clients]   # fetch then ingest

Bounds and manners. One honest wetware session (scripts/wetware.py) with the declared UA, robots.txt obeyed, a minimum
interval between requests to the host, and hard caps: robots.txt, at most 40 sitemap files, and at most --max-pages
pages (case studies, news, careers, about). Nothing is fetched twice: pages already in the cache are reused. No
connector, no third party API, no search engine: the agency's own domain only.

What ingest writes (record.deep, merged with what the compile already had, deduplicated by URL)
  case_studies  [{title, url, lastmod, date, excerpt, client}]   client is the title's first segment when it reads as a name
  news          [{url, date, title, excerpt}]
  jobs          [{title, team, location}]  from the careers page when an ATS board is linked or job links are on the page
  ats           {system, slug} | None
  blog_recent_dates  [[path, lastmod]] the ten most recent editorial URLs
  case_study_count, jobs_count, deepened (date), deepen_plan (the URL counts)
--add-clients also appends case study clients to record.clients (evidence "case study") when the name is not already there.

After ingest --write, rerun the layers that read the record:
  python3 scripts/radar_needs.py rebuild --write && python3 scripts/radar_dossier.py spine --write
and, for a narrative, the Anubis pass in references/anubis.md.

Offline tests: `python3 scripts/radar_deepen.py ingest <id> --cache <dir>` works on any cache directory, so a fixture
directory with sitemap.json and pages/*.html exercises the parser without the network."""
from __future__ import annotations

import argparse
import datetime as dt
import html as html_mod
import json
import re
import sys
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from radar_needs import norm  # noqa: E402

RADAR_PATH = HERE.parent / "assets" / "radar" / "radar.json"

# section names in English, German, French, Italian, Spanish, Dutch, Polish, Swedish and Danish, as the tracked agencies use them
CASE_RE = re.compile(r"/(work|case-?stud(y|ies)|case_stud(y|ies)|case-?histor(y|ies)|portfolio|success-?stor(y|ies)|customer-?stor(y|ies)|client-?stor(y|ies)|clients?|projects?|results|our-work|showcase|cases?|"
                     r"referenzen|referenz|projekte|kunden|kundencases?|erfolgsgeschichten|arbeiten|"
                     r"realisations?|references?|cas-clients?|etudes?-de-cas|projets?|succes|temoignages|"
                     r"progetti|referenze|casi-studio|casi|clienti|lavori|"
                     r"casos|casos-de-exito|clientes|trabajos|proyectos|"
                     r"klanten|projecten|cases-en-klanten|"
                     r"realizacje|klienci|projekty|"
                     r"kunder|uppdrag|kundcase|projekt)(/|$)", re.I)
NEWS_RE = re.compile(r"/(news|press|newsroom|press-?releases?|announcements?|media-?cent(er|re)|about/news|company-news|"
                     r"aktuelles|presse|pressemitteilungen|neuigkeiten|"
                     r"actualites?|presse|communiques?|"
                     r"notizie|novita|comunicati|"
                     r"noticias|prensa|"
                     r"nieuws|pers|"
                     r"aktualnosci|prasa|"
                     r"nyheter|nyheder)(/|$)", re.I)
# flat sites keep their case studies at the root or inside a news or resources section: the slug says what the page is
CASE_SLUG_RE = re.compile(r"(^|-|_)(case-?stud(y|ies)|casestud(y|ies)|case_stud(y|ies)|success-?stor(y|ies)|client-?stor(y|ies)|customer-?stor(y|ies)|case-histor(y|ies)|fallstudie|erfolgsgeschichte)($|-|_)", re.I)
BLOG_RE = re.compile(r"/(blog|insights?|articles?|resources?|magazin|magazine|learn|guides?|knowledge|thinking|perspectives?|ideas|wissen|ratgeber|artikel|articoli|articulos|kennis|artykuly|baza-wiedzy)(/|$)", re.I)
CAREER_RE = re.compile(r"/(careers?|jobs?|join-?us|join|work-with-us|karriere|stellen|stellenangebote|vacancies|open-positions|recrutement|carriere|nous-rejoindre|lavora-con-noi|carriere|empleo|trabaja-con-nosotros|vacatures|werken-bij|kariera|praca|lediga-jobb|karriar|ledige-stillinger)(/|$)", re.I)
ABOUT_RE = re.compile(r"/(about|about-us|company|who-we-are|ueber-uns|uber-uns|agentur|a-propos|qui-sommes-nous|chi-siamo|agenzia|nosotros|quienes-somos|over-ons|o-nas|om-oss|om-os)(/|$)", re.I)
ATS_HOSTS = {"greenhouse.io": "greenhouse", "lever.co": "lever", "workable.com": "workable", "ashbyhq.com": "ashby", "bamboohr.com": "bamboohr", "smartrecruiters.com": "smartrecruiters", "myworkdayjobs.com": "workday",
             "personio.de": "personio", "personio.com": "personio", "recruitee.com": "recruitee", "teamtailor.com": "teamtailor", "jobvite.com": "jobvite", "icims.com": "icims", "breezy.hr": "breezy", "applytojob.com": "jazzhr",
             "jobs.lever.co": "lever", "boards.greenhouse.io": "greenhouse", "hire.withgoogle.com": "google-hire", "rippling.com": "rippling", "join.com": "join", "softgarden.io": "softgarden", "welcometothejungle.com": "wttj"}
JOB_WORDS = re.compile(r"\b(manager|director|specialist|analyst|strategist|executive|lead|head of|engineer|developer|designer|consultant|coordinator|associate|intern|senior|junior|vp|account|copywriter|buyer|planner|producer)\b", re.I)
SKIP_TITLE = re.compile(r"^(home|homepage|blog|news|newsroom|careers?|jobs?|about( us)?|contact( us)?|work|case studies|our work|portfolio|clients?|insights?|resources?|services?|404|page not found)$", re.I)


# ----------------------------------------------------------------------------------------------- small helpers
def load_registry(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def find_agency(radar: dict, key: str) -> dict:
    a = next((x for x in radar["agencies"] if x["id"] == key or x.get("domain") == key), None)
    if not a:
        raise SystemExit(f"no such agency: {key}")
    return a


def host_of(a: dict) -> str:
    d = (a.get("domain") or "").strip().lower()
    return re.sub(r"^https?://", "", d).split("/")[0]


def default_cache(a: dict) -> Path:
    return Path("omega_cache") / "radar" / a["id"]


def path_of(url: str) -> str:
    p = urllib.parse.urlparse(url)
    return p.path or "/"


def slug_of(url: str) -> str:
    p = urllib.parse.urlparse(url if "://" in url else "https://" + url)
    return re.sub(r"[^A-Za-z0-9._-]+", "_", (p.netloc + p.path + ("?" + p.query if p.query else "")).strip("/"))[:150] or "root"


def clean(s: str | None) -> str:
    return html_mod.unescape(html_mod.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or "")))).strip()


def is_leaf(url: str, rx: re.Pattern) -> bool:
    """A page under the section that is not the section index and not a pagination or tag page."""
    p = path_of(url).rstrip("/")
    m = rx.search(p + "/")
    if not m:
        return False
    rest = p[m.end() - 1:].strip("/")
    for _ in range(3):  # nested section names (/portfolio/case-studies/) are still the index
        m2 = rx.match("/" + rest + "/") if rest else None
        if not m2:
            break
        rest = ("/" + rest + "/")[m2.end() - 1:].strip("/")
    if not rest or re.search(r"(^|/)(page|tag|tags|category|categories|topic|author|type)(/|$)|/\d+$", rest):
        return False
    return len(rest) >= 3


EDITORIAL_SLUG_RE = re.compile(r"(^|-)(how|why|what|when|which|ways|tips|guide|guides|vs|best|top|\d+-(ways|tips|reasons|things|steps|examples|strategies|mistakes))(-|$)", re.I)


def slug_case(url: str) -> bool:
    """A flat case study URL: the last path segment says case study, success story or client story, and does not read as an article."""
    p = path_of(url)
    seg = p.rstrip("/").split("/")[-1]
    if not CASE_SLUG_RE.search(seg) or EDITORIAL_SLUG_RE.search(seg) or re.search(r"/(page|tag|tags|category|categories|author)/", p):
        return False
    return not re.fullmatch(r"(seo-|ppc-|our-)?(case-?stud(y|ies)|success-?stor(y|ies)|client-?stor(y|ies)|customer-?stor(y|ies))", seg, re.I)


# ----------------------------------------------------------------------------------------------- the plan
def sitemap_rows(cache: Path) -> list[dict]:
    f = cache / "sitemap.json"
    if not f.exists():
        return []
    return json.loads(f.read_text(encoding="utf-8")).get("urls") or []


def plan(a: dict, rows: list[dict], max_cases: int, max_news: int, max_pages: int) -> dict:
    host = host_of(a)
    own = [r for r in rows if host and host in (urllib.parse.urlparse(r["url"]).netloc or "")]
    by_mod = sorted(own, key=lambda r: str(r.get("lastmod") or ""), reverse=True)
    cases = [r for r in by_mod if is_leaf(r["url"], CASE_RE)][:max_cases]
    if not cases:
        cases = [r for r in by_mod if slug_case(r["url"])][:max_cases]
    news = [r for r in by_mod if is_leaf(r["url"], NEWS_RE)][:max_news]
    blog = [[path_of(r["url"]).strip("/"), (r.get("lastmod") or "")[:10]] for r in by_mod if is_leaf(r["url"], BLOG_RE)][:10]
    careers = [r for r in own if CAREER_RE.search(path_of(r["url"]) + "/") and len(path_of(r["url"]).strip("/").split("/")) <= 2][:1]
    about = [r for r in own if ABOUT_RE.search(path_of(r["url"]) + "/") and len(path_of(r["url"]).strip("/").split("/")) <= 2][:1]
    root = "https://" + host + "/" if host else None
    pages = []
    for r in careers + about + cases + news:
        if r["url"] not in pages:
            pages.append(r["url"])
    if not careers and root:
        pages.append(root + "careers/")
    pages = pages[:max_pages]
    return {"host": host, "sitemap_urls": len(own), "cases": [r["url"] for r in cases], "news": [r["url"] for r in news], "careers": [r["url"] for r in careers], "about": [r["url"] for r in about],
            "blog_recent_dates": blog, "pages": pages, "counts": {"case_study_urls": sum(1 for r in own if is_leaf(r["url"], CASE_RE)) or sum(1 for r in own if slug_case(r["url"])), "news_urls": sum(1 for r in own if is_leaf(r["url"], NEWS_RE)), "blog_urls": sum(1 for r in own if is_leaf(r["url"], BLOG_RE))}}


# ----------------------------------------------------------------------------------------------- the fetch
def fetch(a: dict, cache: Path, max_cases: int, max_news: int, max_pages: int, tempo: str = "human") -> dict:
    import wetware  # the honest session lives in the skill
    from justice_fetch import sitemap_urls
    host = host_of(a)
    if not host:
        raise SystemExit("agency has no domain on record")
    cache.mkdir(parents=True, exist_ok=True)
    (cache / "pages").mkdir(exist_ok=True)
    ww = wetware.Session(str(cache), locale="en-US", tempo=tempo, assets=False, quiet=False, honest=True, obey_robots=True)
    log = {"host": host, "started": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "fetched": [], "skipped": [], "sitemaps": []}
    try:
        rows = sitemap_rows(cache)
        if not rows:
            # the canonical host first: a record says merkle.com, the site answers at www.merkle.com
            m0, _ = ww.get(f"https://{host}/")
            fin = urllib.parse.urlparse(m0.get("final_url") or "").netloc
            if fin and host in fin:
                host = fin
            rm, rtxt = ww.get(f"https://{host}/robots.txt", kind="robots")
            maps = re.findall(r"(?im)^\s*sitemap:\s*(\S+)", rtxt) if rm.get("tier") == "RAW" else []
            maps = maps or [f"https://{host}/sitemap.xml", f"https://{host}/sitemap_index.xml"]
            seen: set[str] = set()
            queue = list(dict.fromkeys(maps))
            while queue and len(seen) < 40:
                m = queue.pop(0)
                seen.add(m)
                mm, mt = ww.get(m, kind="sitemap")
                log["sitemaps"].append({"url": m, "status": mm.get("status"), "tier": mm.get("tier")})
                if mm.get("tier") != "RAW":
                    continue
                locs, mods = sitemap_urls(mt)
                locs = [re.sub(r"^\s*<!\[CDATA\[\s*|\s*\]\]>\s*$", "", l).strip() for l in locs]
                mods = [re.sub(r"^\s*<!\[CDATA\[\s*|\s*\]\]>\s*$", "", m).strip() for m in mods]
                if "<sitemapindex" in mt[:3000]:
                    queue += [l for l in locs if l not in seen]
                    continue
                for i, l in enumerate(locs):
                    rows.append({"url": l.strip(), "lastmod": (mods[i][:10] if i < len(mods) else None)})
            (cache / "sitemap.json").write_text(json.dumps({"host": host, "fetched": log["started"], "urls": rows}, ensure_ascii=False), encoding="utf-8")
        pl = plan(a, rows, max_cases, max_news, max_pages)
        (cache / "plan.json").write_text(json.dumps(pl, indent=1, ensure_ascii=False), encoding="utf-8")
        for u in pl["pages"]:
            s = slug_of(u)
            if (cache / "pages" / (s + ".html")).exists():
                log["skipped"].append(u)
                continue
            meta, html = ww.get(u)
            (cache / "pages" / (s + ".html")).write_text(html or "", encoding="utf-8")
            (cache / "pages" / (s + ".meta.json")).write_text(json.dumps({k: meta.get(k) for k in ("url", "final_url", "status", "tier", "ttfb", "bytes")} | {"slug": s}, indent=1), encoding="utf-8")
            log["fetched"].append({"url": u, "status": meta.get("status"), "tier": meta.get("tier")})
            print("%-10s %3s %s" % (meta.get("tier"), meta.get("status"), u))
    finally:
        ww.close()
    log["finished"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    (cache / "fetch_log.json").write_text(json.dumps(log, indent=1), encoding="utf-8")
    return log


# ----------------------------------------------------------------------------------------------- the parse
def page_date(html: str) -> str | None:
    for rx in (r'<meta[^>]+property=["\']article:published_time["\'][^>]*content=["\']([^"\']+)', r'"datePublished"\s*:\s*"([^"]+)"', r'<time[^>]+datetime=["\']([^"\']+)', r'<meta[^>]+name=["\']date["\'][^>]*content=["\']([^"\']+)',
               r'<meta[^>]+property=["\']og:updated_time["\'][^>]*content=["\']([^"\']+)'):
        m = re.search(rx, html, re.I)
        if m:
            d = m.group(1)[:10]
            if re.match(r"\d{4}-\d{2}-\d{2}", d):
                return d
    m = re.search(r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})\b", html)
    if m:
        try:
            return dt.datetime.strptime(f"{m.group(1)} {m.group(2)} {m.group(3)}", "%B %d %Y").date().isoformat()
        except ValueError:
            return None
    return None


def page_title(html: str) -> str | None:
    m = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]*content=["\']([^"\']+)', html, re.I)
    t = clean(m.group(1)) if m else None
    if not t:
        m = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
        t = clean(m.group(1)) if m else None
    if not t:
        m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S | re.I)
        t = clean(m.group(1)) if m else None
    return t or None


def page_excerpt(html: str) -> str | None:
    for rx in (r'<meta[^>]+name=["\']description["\'][^>]*content=["\']([^"\']*)', r'<meta[^>]+property=["\']og:description["\'][^>]*content=["\']([^"\']*)'):
        m = re.search(rx, html, re.I)
        if m and clean(m.group(1)):
            return clean(m.group(1))[:300]
    m = re.search(r"<p[^>]*>(.*?)</p>", html, re.S | re.I)
    return clean(m.group(1))[:300] if m else None


WORK_ADJ = r"(?:holiday|q4|summer|winter|spring|launch|global|us|uk|eu|b2b|b2c|d2c|dtc|ecommerce|e-commerce|retail|new|integrated|full-funnel|full funnel|multi-channel|omnichannel|international|european|local|national|award-winning|data-driven|hyper-local)"
WORK_NOUN = (r"(?:influencer|creator|social media|social|paid advertising|paid media|paid search|paid|seo|ppc|sea|sem|content marketing|content|digital pr|pr|brand|branding|marketing|media|web design|website design|web|website|webshop|onlineshop|app|growth|performance|search|email|crm|cro|ux|design|"
             r"video|storytelling|tiktok|instagram|youtube|amazon|programmatic|display|affiliate|analytics|data|ai|geo|lead generation|linkbuilding|link building|link|links|digital|omnichannel-marketing|social-media-marketing)")
WORK_TAIL = (r"(?:campaign|strategy|case study|case studies|success story|customer story|client story|client spotlight|spotlight|partnership|project|launch|rebrand|redesign|relaunch|rebuild|migration|program|programme|activation|takeover|series|results|story|work|"
             r"success|services|fallbeispiel|fallstudie|erfolgsgeschichte|referenz|kundenstimme|kundeudtalelse|kundecase|case|casestudy|showcase|portfolio|awareness|penalty|recovery|audit|insights|marketing)")
WORK_WORDS = r"(?:" + WORK_ADJ + r"\s+)?(?:" + WORK_NOUN + r"\s+)?" + WORK_TAIL + r"s?"
WORK_ANY = r"(?:" + WORK_ADJ + r"|" + WORK_NOUN + r"|" + WORK_TAIL + r")"
GENERIC_CLIENT_RE = re.compile(r"^(?:a |an |the )?(?:wellness|fitness|travel|healthcare|health|beauty|financial(?: guidance)?|professional services|luxury|global|leading|national|regional|major|large|top|multi-?location|multimedia|cruiseline|cruise line|enterprise|ecommerce|e-commerce|fashion|automotive|saas|b2b|b2c|dental|legal|law|insurance|education|nonprofit|non-profit|hospitality|retail|manufacturing|technology|tech|software|food|beverage|pharma|medical|urgent care|pe-backed)\b.*\b(?:brand|company|retailer|provider|firm|group|business|client|manufacturer|organization|organisation|practice|network|platform|startup|chain|store|clinic|university|college|bank|insurer|publisher|agency|team)s?$", re.I)
HEADLINE_RE = re.compile(r"(^\w+ing\b|^position\s+\d|^(stop|get|make|turn|win|voted|beyond|meet|inside|behind|when|where|who|why|how)\b|\b(leads? to|delivers?|drives?|drove|grows?|grew|boosts?|increases?|achiev|exceed|expectations|visibility|profitability|approach|a win|clearly|optimi[sz]ed|data-driven|hyper-local|strategy|journey|transformation|how we|why we|what we|with a|through|fuel|revenue|shorten|cycle|retailer|holiday|western market|grants?|confidence|keywords?|rankings?|traffic|conversions?|roas|leads|sales|accelerate|secures?|legacy|awarded|example|connection|error|login|archives?|voted|backed)\b)", re.I)
# the words a sector index, a service page or a headline is made of; a name made mostly of them is not a client
GENERIC_TOKENS = {"wellness", "fitness", "travel", "beauty", "luxury", "healthcare", "health", "retail", "fashion", "finance", "financial", "education", "higher", "automotive", "hospitality", "insurance", "legal", "dental", "medical",
                  "technology", "software", "food", "beverage", "pharma", "energy", "sport", "sports", "gaming", "success", "growth", "result", "results", "insight", "insights", "analytics", "data", "digital", "social", "content",
                  "brand", "creative", "performance", "search", "global", "local", "national", "international", "enterprise", "commerce", "ecommerce", "product", "products", "management", "lifecycle", "advertising", "media",
                  "paid", "design", "web", "website", "marketing", "strategy", "effective", "transformative", "recruitment", "charity", "school", "framework", "home", "portfolio", "consumer", "entertainment", "video",
                  "attorney", "lawyer", "criminal", "defense", "injury", "clinic", "practice", "company", "business", "services", "service", "solutions", "industry", "sector", "sectors", "secteurs", "clients", "kunden", "unsere",
                  "erfolge", "santé", "sante", "turistico", "archives", "archive", "des", "and", "the", "for", "of", "&", "x", "b2b", "b2c", "ppc", "seo", "sea", "geo", "ai", "ux", "pr", "crm", "cro", "demand", "brand-to-demand"}
LEAD_GENERIC_RE = re.compile(r"^(case stud(y|ies)|seo case study|ppc case study|success stor(y|ies)|client stor(y|ies)|customer stor(y|ies)|our work|work|projects?|portfolio|results|referenzen|referenz|fallbeispiele?|fallstudien?|progetti|referenze|realisations?|references?|cases?|caso de (é|e)xito|casos? de (é|e)xito|unsere kunden|kundencase|client spotlight)\s*", re.I)
FOR_CLIENT_RE = re.compile(r"^(?P<work>.+?)\s+(?:for|für|pour|per|para|voor|dla)\s+(?P<client>[A-Z0-9][\w.&'’+-]*(?:\s+[A-Z0-9][\w.&'’+-]*){0,3})\s*$")


def _tokens(x: str) -> list[str]:
    return [w for w in re.split(r"[\s,/]+", x.lower()) if w]


def client_from_title(title: str | None, agency_name: str) -> str | None:
    """The client name when the title reads 'Client | Agency', 'Client: what we did', 'Client's Influencer Strategy for X',
    'Client Influencer Campaign', 'Case Study Client' or 'Video strategy for Client'; None when the title is a how-to headline,
    a sector or service index page, a result line or the agency's own name.
    Precision over recall: a wrong client name pollutes the needs read, a missed one only leaves a case study unnamed."""
    if not title:
        return None
    t = re.sub(r"[​‌‍﻿]", "", title)
    t = re.sub(r"\s*[|\u00b7\u203a]\s*" + re.escape(agency_name) + r"\s*$", "", t, flags=re.I)
    t = re.sub(r"\s+[-\u2013\u2014]\s+" + re.escape(agency_name) + r"\s*$", "", t, flags=re.I)
    if re.search(r"\b(error|login|log in|404|not found|page not found|archives?|archiv)\b", t, re.I):
        return None
    segs = [x.strip() for x in re.split(r"\s*[|:\u00b7\u203a]\s*|\s+[-\u2013\u2014]\s+|,\s+(?=(?:seo|ppc|sea|a|an)?\s*case stud)", t, flags=re.I) if x.strip()]
    while len(segs) > 1 and (LEAD_GENERIC_RE.fullmatch(segs[0] + " ") or re.fullmatch(r"(case stud(y|ies)|success stor(y|ies)|client stor(y|ies)|customer stor(y|ies)|our work|work|projects?|portfolio|results|referenzen|fallbeispiele?|fallstudien?|progetti|referenze|realisations?|references?|cases?|unsere kunden)", segs[0], re.I)):
        segs.pop(0)
    first = segs[0] if segs else ""
    # "Case Study Migros Bank", "Caso de exito Haier", "SEO Case Study Bedly" -> the name after the label
    first = LEAD_GENERIC_RE.sub("", first).strip()
    # "Netflix-Case Study zum Social-Media-Marketing" -> "Netflix"
    first = re.sub(r"-(case stud(y|ies)|fallstudie|casestudy)\b.*$", "", first, flags=re.I).strip()
    # "Wirkungsvolle Bewegtbildstrategie fuer AMAG", "Omnichannel-Kampagne fuer Firstcaution", "SEO for Acme Ltd" -> the client after the preposition
    fm = FOR_CLIENT_RE.match(first)
    if fm and re.search(r"(strateg|kampagne|campaign|marketing|seo|sea|ppc|relaunch|website|webshop|video|bewegtbild|personal|social|content|brand|media|growth|ads?\b|launch|rebrand)", fm.group("work"), re.I) and not re.search(r"\b(the|a|an)$", fm.group("work"), re.I):
        first = fm.group("client").strip()
    # "Asahi Super Dry's Influencer Strategy for the WRWC" -> "Asahi Super Dry" (only when the remainder opens with work words)
    pm = re.match(r"^(.+?)(?:'|’)s\s+(.+)$", first)
    if pm and re.match(r"^" + WORK_WORDS + r"\b", pm.group(2), re.I):
        first = pm.group(1).strip()
    # "Calvin Klein Holiday Influencer Campaign for Q4" -> "Calvin Klein"
    if re.search(r"\b" + WORK_ANY + r"\s+(for|with|at|on|during|across|in)\b", first, re.I):
        first = re.sub(r"\s+(for|with|at|on|during|across|in)\s+.+$", "", first, flags=re.I)
    if GENERIC_CLIENT_RE.match(first):
        return None
    for _ in range(3):
        f2 = re.sub(r"\s+" + WORK_WORDS + r"\s*$", "", first, flags=re.I).strip(" ,;.-")
        # a bare trailing work noun goes only when a name of two words or more is left ("Strike Social" stays)
        f3 = re.sub(r"\s+" + WORK_NOUN + r"\s*$", "", f2, flags=re.I).strip(" ,;.-")
        if f3 != f2 and len(f3.split()) >= 2:
            f2 = f3
        if f2 == first:
            break
        first = f2
    first = first.strip(" ,;&.-")
    if not first or SKIP_TITLE.match(first) or len(first.split()) > 5 or len(first) > 48 or len(first) < 2:
        return None
    if first.startswith("#") or "%" in first or re.search(r"\d+\s*(x|%|k|m)\b", first, re.I) or "&amp;" in first or re.search(r"\b(19|20)\d\d\b", first):
        return None
    if re.search(r"\s(and|or|for|of|in|with|to|the|a|an|&|und|et|e|y)$", first, re.I):
        return None
    if re.match(r"^(how|why|what|when|the|a|an|our|from|your|this|these|top|best|\d+)\s", first, re.I) and len(first.split()) > 1:
        return None
    if agency_name.lower() in first.lower() or GENERIC_CLIENT_RE.match(first) or HEADLINE_RE.search(first):
        return None
    agency_words = {w.lower() for w in re.findall(r"[A-Za-z][A-Za-z0-9]+", agency_name) if len(w) >= 4 and w.lower() not in ("agency", "digital", "media", "marketing", "group", "interactive", "creative", "search", "global", "the")}
    if any(w.lower() in agency_words for w in re.findall(r"[A-Za-z][A-Za-z0-9]+", first)):
        return None
    if re.fullmatch(r"(" + WORK_ANY + r"\s*)+", first, re.I):
        return None
    toks = _tokens(first)
    gen = sum(1 for w in toks if w in GENERIC_TOKENS)
    if toks and gen / len(toks) > 0.5:
        return None
    # a headline in any language: most words of three letters or more are lowercase and none is a brand shape (internal capitals, digits, a domain)
    words = [w for w in re.findall(r"[^\s,]+", first) if len(w) > 2]
    lower = [w for w in words if w.isalpha() and w == w.lower()]
    if len(first.split()) >= 2 and words and len(lower) >= max(1, (len(words) + 1) // 2):
        return None
    if len(first.split()) == 1 and first == first.lower() and not re.search(r"\.[a-z]{2,}$", first):
        return None
    return first


def ats_slug(url: str) -> str | None:
    """The company's board id on an ATS: a subdomain (acme.bamboohr.com), a path segment (boards.greenhouse.io/acme) or the
    embed query (boards.greenhouse.io/embed/job_board?for=acme)."""
    u = urllib.parse.urlparse(url)
    host = (u.netloc or "").lower()
    q = urllib.parse.parse_qs(u.query)
    if q.get("for"):
        return q["for"][0]
    if re.search(r"\.(js|css|json)$", u.path or "", re.I):
        return None  # an embedded widget script names the vendor, not the board
    parts = host.split(".")
    shared = {"www", "jobs", "boards", "job-boards", "apply", "careers", "ats", "app", "api", "embed", "hire", "join", "en", "de", "fr", "static", "cdn", "assets", "widget", "widgets"}
    base = {"greenhouse", "lever", "workable", "ashbyhq", "bamboohr", "smartrecruiters", "myworkdayjobs", "personio", "recruitee", "teamtailor", "jobvite", "icims", "breezy", "applytojob", "rippling", "softgarden", "welcometothejungle"}
    if len(parts) >= 3 and parts[0] not in shared and parts[1] in base:
        return parts[0]
    segs = [x for x in (u.path or "").split("/") if x]
    skip = {"embed", "job_board", "js", "fr", "en", "de", "es", "it", "nl", "careers", "career", "jobs", "job", "job-widget", "pages", "apply", "companies", "o", "j", "v1", "widget", "boards", "board", "postings", "c"}
    for x in segs:
        if x.lower() not in skip and not re.fullmatch(r"\d+(\.\d+)*", x):
            return x
    return None


def parse_jobs(html: str, base: str) -> tuple[list[dict], dict | None]:
    ats = None
    for m in re.finditer(r'(?:href|src)=["\'](https?://[^"\']+)', html, re.I):
        h = urllib.parse.urlparse(m.group(1)).netloc.lower()
        for k, v in ATS_HOSTS.items():
            if h.endswith(k):
                ats = {"system": v, "slug": ats_slug(html_mod.unescape(m.group(1)))}
                break
        if ats:
            break
    jobs = []
    seen = set()
    for m in re.finditer(r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", html, re.S | re.I):
        text = clean(m.group(2))
        if not text or len(text) > 80 or text.lower() in seen or not JOB_WORDS.search(text):
            continue
        href = m.group(1)
        if not re.search(r"job|career|position|opening|vacan|stellen|greenhouse|lever|workable|ashby|bamboohr|smartrecruiters|workday|personio|recruitee|teamtailor|jobvite|icims", href, re.I):
            continue
        seen.add(text.lower())
        loc = None
        ctx = html[m.end():m.end() + 400]
        lm = re.search(r"(Remote|Hybrid|[A-Z][a-zA-Z]+(?:, [A-Z]{2}| [A-Z][a-z]+)?)\s*<", ctx)
        if lm and lm.group(1).lower() not in ("apply", "learn", "read", "view", "more"):
            loc = lm.group(1)
        jobs.append({"title": text, "team": None, "location": loc})
        if len(jobs) >= 40:
            break
    return jobs, ats


def ingest(a: dict, cache: Path, add_clients: bool = False) -> dict:
    rows = sitemap_rows(cache)
    pl = plan(a, rows, 12, 8, 30) if rows else {"cases": [], "news": [], "careers": [], "about": [], "blog_recent_dates": [], "pages": [], "counts": {}, "sitemap_urls": 0}
    plf = cache / "plan.json"
    if plf.exists():
        pl = json.loads(plf.read_text(encoding="utf-8"))
    pages = cache / "pages"
    def read(u: str) -> str | None:
        f = pages / (slug_of(u) + ".html")
        return f.read_text(encoding="utf-8", errors="replace") if f.exists() else None
    mods = {r["url"]: r.get("lastmod") for r in rows}
    deep = dict(a.get("deep") or {})
    cases = [c for c in (deep.get("case_studies") or []) if isinstance(c, dict)]
    known = {c.get("url") for c in cases}
    for u in pl.get("cases") or []:
        if u in known:
            continue
        html = read(u)
        if html is None:
            continue
        t = page_title(html)
        if not t or re.search(r"\b(404|not found)\b", t, re.I):
            continue
        cases.append({"title": t, "url": u, "lastmod": mods.get(u), "date": page_date(html) or mods.get(u), "excerpt": page_excerpt(html), "client": client_from_title(t, a["name"])})
        known.add(u)
    news = [n for n in (deep.get("news") or []) if isinstance(n, dict)]
    known_n = {n.get("url") for n in news}
    for u in pl.get("news") or []:
        if u in known_n:
            continue
        html = read(u)
        if html is None:
            continue
        t = page_title(html)
        if not t or re.search(r"\b(404|not found)\b", t, re.I):
            continue
        news.append({"url": u, "date": page_date(html) or mods.get(u), "title": t, "excerpt": page_excerpt(html)})
        known_n.add(u)
    news.sort(key=lambda n: str(n.get("date") or ""), reverse=True)
    jobs, ats = [], None
    for u in (pl.get("careers") or []) + ([f"https://{host_of(a)}/careers/"] if not pl.get("careers") and host_of(a) else []):
        html = read(u)
        if html:
            jobs, ats = parse_jobs(html, u)
            break
    if not deep.get("jobs") or jobs:
        deep["jobs"] = jobs
    deep["ats"] = ats or deep.get("ats")
    deep["case_studies"] = cases
    deep["case_study_count"] = max(deep.get("case_study_count") or 0, (pl.get("counts") or {}).get("case_study_urls") or 0, len(cases))
    deep["news"] = news
    deep["jobs_count"] = len(deep.get("jobs") or []) or deep.get("jobs_count") or 0
    if pl.get("blog_recent_dates"):
        deep["blog_recent_dates"] = pl["blog_recent_dates"]
    deep["deepened"] = dt.date.today().isoformat()
    lf = cache / "fetch_log.json"
    if lf.exists():
        log = json.loads(lf.read_text(encoding="utf-8"))
        sm = log.get("sitemaps") or []
        bad = [x for x in sm if x.get("tier") != "RAW" or not x.get("status")]
        if not rows:
            deep["fetch_note"] = (f"Own site read on {(log.get('started') or '')[:10]}: no sitemap URLs could be read ("
                                  + (", ".join(f"{x.get('url', '')[:60]} {x.get('tier')} {x.get('status')}" for x in sm[:3]) if sm else "no sitemap declared") + ").")
        elif bad:
            deep["fetch_note"] = f"Own site read on {(log.get('started') or '')[:10]}: {len(rows)} sitemap URLs read; {len(bad)} sitemap files did not answer."
        else:
            deep["fetch_note"] = f"Own site read on {(log.get('started') or '')[:10]}: {len(rows)} sitemap URLs read, {len(log.get('fetched') or []) + len(log.get('skipped') or [])} pages fetched."
    deep["deepen_plan"] = {"sitemap_urls": pl.get("sitemap_urls"), "pages": len(pl.get("pages") or []), "counts": pl.get("counts") or {}}
    a["deep"] = deep
    a["is_deep"] = True
    added = 0
    if add_clients:
        have = {norm(c.get("name") or "") for c in (a.get("clients") or [])}
        CORP = {"europe", "group", "uk", "us", "usa", "inc", "inc.", "ltd", "ltd.", "llc", "gmbh", "ag", "sa", "s.a.", "spa", "s.p.a.", "italia", "espa\u00f1a", "espana", "deutschland", "france", "international", "global",
                "holdings", "company", "co", "co.", "corp", "corporation", "plc", "bv", "nv", "ab", "as", "oy", "limited", "brands", "online", "shop", "store", "official"}
        def same_client(k: str) -> bool:
            if k in have:
                return True
            kw = k.split()
            for h in have:
                hw = h.split()
                longer, shorter = (hw, kw) if len(hw) > len(kw) else (kw, hw)
                if shorter and longer[:len(shorter)] == shorter and all(w.strip("(),") in CORP for w in longer[len(shorter):]):
                    return True
            return False
        for c in cases:
            nm = c.get("client")
            key = norm(nm or "")
            if nm and not same_client(key):
                a.setdefault("clients", []).append({"name": nm, "evidence": "case study", "url": c["url"]})
                have.add(key)
                added += 1
    return {"case_studies": len(cases), "news": len(news), "jobs": len(deep.get("jobs") or []), "ats": ats, "clients_added": added, "blog_dates": len(deep.get("blog_recent_dates") or [])}


# ----------------------------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["missing", "plan", "fetch", "ingest", "run"])
    ap.add_argument("arg", nargs="?")
    ap.add_argument("--radar", default=str(RADAR_PATH))
    ap.add_argument("--cache")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--add-clients", action="store_true")
    ap.add_argument("--max-cases", type=int, default=12)
    ap.add_argument("--max-news", type=int, default=8)
    ap.add_argument("--max-pages", type=int, default=30)
    ap.add_argument("--tempo", default="human", choices=["human", "brisk"])
    ap.add_argument("--limit", type=int, default=20)
    args = ap.parse_args()
    radar = load_registry(Path(args.radar))
    if args.cmd == "missing":
        rows = sorted([a for a in radar["agencies"] if not (a.get("deep") or {}).get("case_studies") and a.get("status") != "graveyard"], key=lambda a: -(a.get("prominence") or 0))[:args.limit]
        for a in rows:
            nd = a.get("needs") or {}
            print(f"{a['id']:<28} prominence {a.get('prominence') or 0:.2f}  clients {len(a.get('clients') or [])}  names only {nd.get('named_only', '?')}  {a.get('domain') or ''}")
        print(f"{len(rows)} shown; a deepen run per agency fetches at most --max-pages pages of its own site.")
        return
    if not args.arg:
        raise SystemExit("agency id or domain required")
    a = find_agency(radar, args.arg)
    cache = Path(args.cache) if args.cache else default_cache(a)
    if args.cmd == "plan":
        rows = sitemap_rows(cache)
        if not rows:
            print(f"no cached sitemap in {cache}; run fetch first (network). Domain: {a.get('domain')}")
            return
        print(json.dumps(plan(a, rows, args.max_cases, args.max_news, args.max_pages), indent=1, ensure_ascii=False))
        return
    if args.cmd in ("fetch", "run"):
        log = fetch(a, cache, args.max_cases, args.max_news, args.max_pages, tempo=args.tempo)
        print(f"fetched {len(log['fetched'])} pages, reused {len(log['skipped'])}, sitemaps {len(log['sitemaps'])} -> {cache}")
        if args.cmd == "fetch":
            return
    res = ingest(a, cache, add_clients=args.add_clients)
    print(json.dumps(res))
    if args.write:
        Path(args.radar).write_text(json.dumps(radar, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print("written; now: python3 scripts/radar_needs.py rebuild --write && python3 scripts/radar_dossier.py spine --write")


if __name__ == "__main__":
    main()
