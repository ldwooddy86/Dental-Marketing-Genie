#!/usr/bin/env python3
"""WETWARE — UltimaWeapon's human-presence layer. Every request the Weapon makes to a target goes out wearing it.

A bot announces itself three ways: what it says (User-Agent and the header set around it), how it connects (the
TLS hello, the HTTP version, the IP block it comes from) and how it behaves (one page per second, no cookies, no
referer, no assets, no pauses). Wetware fixes everything this process controls and measures the rest honestly:

  identity   one Chromium-family persona per target cache (Chrome on Windows / Chrome on macOS / Edge on Windows),
             version derived from today's date the way real auto-update lag distributes it, the exact `sec-ch-ua`
             brand list Chrome computes for that major, the full navigation / asset / fetch header sets in Chrome's
             order, matching client hints, a viewport, screen, DPR, timezone, hardware and WebGL story that all agree.
  transport  curl_cffi with Chrome TLS + HTTP/2 impersonation when it is installed (pip install curl_cffi); the real
             Chromium (Playwright) for renders; urllib as the labeled last resort.
  behavior   a persistent visitor: cookie jar and persona survive across runs; the first hit on a host arrives from
             Google or a typed URL, every later page carries the previous page as Referer with same-origin fetch
             metadata; after each page the favicon and a couple of first-party assets are pulled the way a browser
             would; pauses between pages are log-normal "reading time", never a fixed interval; nothing runs in parallel.
  honesty    `selfcheck()` fetches a fingerprint echo and records what the origin actually saw — the IP and its
             registrant, the TLS hello, the HTTP version — and assigns the presence tier the run can truthfully claim:
             H2 residential (operator's machine: everything human), H1 cloud (headers, cookies, pacing and the JS
             surface human; TLS hello and IP belong to the workspace egress), H0 degraded (urllib, headers only).

What it never does: solve or click a human verification, rotate IPs or proxies, replay a real person's cookies,
log in, spoof Googlebot (the cloaking diff is the one opt-in exception and is labeled non-human), or hide a wall.
A wall met while presenting as a human is recorded as NOT_TESTED and is itself a finding.

Library use
    import wetware
    ww = wetware.Session(cache_dir="omega_cache/<target>")   # persona + cookies live in <cache>/wetware/
    meta, body = ww.get(url)                                         # document navigation, paced, footprints after
    meta, body = ww.get(url, kind="api", accept="application/json")  # public endpoint, cors-style
    ww.close()                                                       # persists cookies + persona, writes presence.json
    browser, ctx = wetware.render_launch(pw, ww.persona, locale="en-US"); page = wetware.render_page(ctx, ww.persona)

CLI
    python3 scripts/wetware.py --selftest [--cache DIR]   header echo + fingerprint echo + presence line
    python3 scripts/wetware.py --report DIR               presence line for the Data Sources tab, fetch counts
    python3 scripts/wetware.py --persona DIR [--new]      show (or roll) the persona bound to a target cache
"""
import argparse, datetime, gzip, json, math, os, random, re, sys, time, urllib.parse, urllib.request, urllib.error, zlib
from collections import OrderedDict

__version__ = "1.0"

# --------------------------------------------------------------------------------------------- version model
# Chrome ships a new major roughly every 31.5 days (13 per year minus two skipped cycles). Anchor: 131 on 2024-11-12.
# Real traffic sits mostly on the current major with a long tail on the previous one or two (auto-update lag), so a
# persona picks current / previous / previous-2 with those odds. WETWARE_CHROME_MAJOR pins it when you know better.
_ANCHOR_DATE, _ANCHOR_MAJOR, _DAYS_PER_MAJOR = datetime.date(2024, 11, 12), 131, 31.5

def chrome_major_today(today=None):
    env = os.environ.get("WETWARE_CHROME_MAJOR")
    if env and env.isdigit(): return int(env)
    today = today or datetime.date.today()
    est = _ANCHOR_MAJOR + int((today - _ANCHOR_DATE).days // _DAYS_PER_MAJOR)
    try:  # never claim a version older than the TLS profile we impersonate with
        from curl_cffi.requests.impersonate import DEFAULT_CHROME
        est = max(est, int(re.sub(r"\D", "", DEFAULT_CHROME) or 0))
    except Exception: pass
    return max(est, 140)

def chrome_full_version(major, rng):
    build = 6778 + (major - 131) * 63 + rng.randint(-15, 15)   # 131.0.6778 -> ~63 build numbers per major
    return "%d.0.%d.%d" % (major, build, rng.randint(40, 200))

def greased_brands(major, brand):
    """Chrome's own GREASE brand algorithm (components/embedder_support/user_agent_utils.cc): the 'Not?A_Brand'
    string, its version and the ORDER of the three brands are all functions of the major version."""
    chars = [" ", "(", ":", "-", ".", "/", ")", ";", "=", "?", "_"]
    grease = "Not" + chars[major % 11] + "A" + chars[(major + 1) % 11] + "Brand"
    gver = ["8", "99", "24"][major % 3]
    orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]][major % 6]
    slots = [None, None, None]
    slots[orders[0]] = (grease, gver); slots[orders[1]] = ("Chromium", str(major)); slots[orders[2]] = (brand, str(major))
    return slots

def sec_ch_ua(brands): return ", ".join('"%s";v="%s"' % tuple(b) for b in brands)

# --------------------------------------------------------------------------------------------- personas
_FAMILIES = [("chrome-win", 55), ("chrome-mac", 20), ("edge-win", 13), ("chrome-win10", 12)]
_VIEWPORTS = [((1920, 1080), 45), ((1536, 864), 18), ((1366, 768), 14), ((1440, 900), 10), ((1680, 1050), 5), ((2560, 1440), 8)]
_VIEWPORTS_MAC = [((1440, 900), 40), ((1512, 982), 25), ((1728, 1117), 15), ((1470, 956), 12), ((1680, 1050), 8)]
_TZ_BY_LOCALE = {"en-US": [("America/Chicago", 30), ("America/New_York", 40), ("America/Los_Angeles", 20), ("America/Denver", 10)],
                 "en-GB": [("Europe/London", 100)], "de-DE": [("Europe/Berlin", 100)], "fr-FR": [("Europe/Paris", 100)],
                 "es-ES": [("Europe/Madrid", 100)], "it-IT": [("Europe/Rome", 100)], "nl-NL": [("Europe/Amsterdam", 100)],
                 "en-AU": [("Australia/Sydney", 100)], "en-CA": [("America/Toronto", 100)]}
_GPUS_WIN = [("Google Inc. (Intel)", "ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00003EA0) Direct3D11 vs_5_0 ps_5_0, D3D11)", 8, 8),
             ("Google Inc. (Intel)", "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)", 8, 8),
             ("Google Inc. (NVIDIA)", "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)", 12, 8),
             ("Google Inc. (AMD)", "ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)", 16, 8)]
_GPUS_MAC = [("Google Inc. (Apple)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)", 8, 8),
             ("Google Inc. (Apple)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)", 12, 8),
             ("Google Inc. (Apple)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)", 8, 8)]

def _weighted(rng, table):
    r, acc = rng.random() * sum(w for _, w in table), 0
    for v, w in table:
        acc += w
        if r <= acc: return v
    return table[-1][0]

def locale_list(locale):
    lang = locale.split("-")[0]
    if locale == "en-US": return "en-US,en"
    if lang == "en": return "%s,en" % locale
    return "%s,%s,en-US,en" % (locale, lang)

def accept_language(locale):
    lang = locale.split("-")[0]
    if locale == "en-US": return "en-US,en;q=0.9"
    if lang == "en": return "%s,en;q=0.9" % locale
    return "%s,%s;q=0.9,en-US;q=0.8,en;q=0.7" % (locale, lang)

class Persona:
    """One consistent visitor. Serializable; bound to a target cache so re-runs are the same returning visitor."""
    def __init__(self, d): self.__dict__.update(d)

    @classmethod
    def new(cls, locale="en-US", rng=None, family=None):
        rng = rng or random.Random()
        family = family or os.environ.get("WETWARE_FAMILY") or _weighted(rng, _FAMILIES)
        cur = chrome_major_today(); major = _weighted(rng, [(cur, 70), (cur - 1, 24), (cur - 2, 6)])
        mac = family == "chrome-mac"
        base = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" if mac else "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        ua = "%s AppleWebKit/537.36 (KHTML, like Gecko) Chrome/%d.0.0.0 Safari/537.36" % (base, major)
        brand = "Google Chrome"
        if family == "edge-win": ua += " Edg/%d.0.0.0" % major; brand = "Microsoft Edge"
        vw, vh = _weighted(rng, _VIEWPORTS_MAC if mac else _VIEWPORTS); gpu = _weighted(rng, [(g, 1) for g in (_GPUS_MAC if mac else _GPUS_WIN)])
        dpr = 2.0 if mac else _weighted(rng, [(1.0, 70), (1.25, 22), (1.5, 8)])
        chrome_h = 87   # tab strip + toolbar, roughly; the OS bar (Windows taskbar 48 / macOS menu bar 25) comes off separately
        d = dict(version=__version__, family=family, brand=brand, major=major, full_version=chrome_full_version(major, rng), ua=ua,
                 brands=greased_brands(major, brand), platform=("macOS" if mac else "Windows"), nav_platform=("MacIntel" if mac else "Win32"),
                 platform_version=("15.3.0" if mac else ("10.0.0" if family == "chrome-win10" else "15.0.0")),
                 locale=locale, accept_language=accept_language(locale), timezone=_weighted(rng, _TZ_BY_LOCALE.get(locale, [("UTC", 1)])),
                 screen=[vw, vh], viewport=[vw, vh - chrome_h - (48 if not mac else 25)], dpr=dpr, hardware_concurrency=gpu[2], device_memory=gpu[3],
                 webgl_vendor=gpu[0], webgl_renderer=gpu[1], entry_google_share=0.65, created=datetime.date.today().isoformat(),
                 seed=rng.randint(1, 10 ** 9))
        return cls(d)

    def refresh(self):
        """A returning visitor whose browser auto-updated: bump the major when the persona is older than a cycle."""
        cur = chrome_major_today()
        if self.major < cur - 2 or (self.major < cur and (datetime.date.today() - datetime.date.fromisoformat(self.created)).days > 21):
            self.major = cur if random.random() < 0.8 else cur - 1
            self.ua = re.sub(r"Chrome/\d+", "Chrome/%d" % self.major, self.ua); self.ua = re.sub(r"Edg/\d+", "Edg/%d" % self.major, self.ua)
            self.brands = greased_brands(self.major, self.brand); self.full_version = chrome_full_version(self.major, random.Random())
            self.created = datetime.date.today().isoformat()
        return self

    @property
    def label(self): return "%s %d on %s" % (self.brand, self.major, "macOS" if self.platform == "macOS" else ("Windows 10" if self.platform_version == "10.0.0" else "Windows 11"))

    def ch_headers(self):
        return [("sec-ch-ua", sec_ch_ua(self.brands)), ("sec-ch-ua-mobile", "?0"), ("sec-ch-ua-platform", '"%s"' % self.platform)]

    def metadata(self):
        """CDP Emulation.setUserAgentOverride.userAgentMetadata — what navigator.userAgentData reports in a render."""
        return {"brands": [{"brand": b, "version": v} for b, v in self.brands],
                "fullVersionList": [{"brand": b, "version": (self.full_version if v != "8" and v != "99" and v != "24" else v + ".0.0.0")} for b, v in self.brands],
                "platform": self.platform, "platformVersion": self.platform_version, "architecture": "x86" if self.platform == "Windows" else "arm",
                "model": "", "mobile": False, "bitness": "64", "wow64": False}

    def headers(self, kind, referer=None, site="none", accept=None):
        """Chrome's header set for a request kind, in Chrome's order. kind: document | style | script | image | api."""
        h = OrderedDict()
        for k, v in self.ch_headers(): h[k] = v
        if kind in ("document", "robots", "sitemap"): h["Upgrade-Insecure-Requests"] = "1"
        h["User-Agent"] = self.ua
        if kind in ("document", "robots", "sitemap"):
            h["Accept"] = accept or "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
            h["Sec-Fetch-Site"] = site; h["Sec-Fetch-Mode"] = "navigate"; h["Sec-Fetch-User"] = "?1"; h["Sec-Fetch-Dest"] = "document"
        elif kind == "style":
            h["Accept"] = "text/css,*/*;q=0.1"; h["Sec-Fetch-Site"] = site; h["Sec-Fetch-Mode"] = "no-cors"; h["Sec-Fetch-Dest"] = "style"
        elif kind == "script":
            h["Accept"] = "*/*"; h["Sec-Fetch-Site"] = site; h["Sec-Fetch-Mode"] = "no-cors"; h["Sec-Fetch-Dest"] = "script"
        elif kind == "image":
            h["Accept"] = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"; h["Sec-Fetch-Site"] = site; h["Sec-Fetch-Mode"] = "no-cors"; h["Sec-Fetch-Dest"] = "image"
        else:  # api: a fetch() from a page, cors mode
            h["Accept"] = accept or "application/json, text/plain, */*"; h["Sec-Fetch-Site"] = "cross-site"; h["Sec-Fetch-Mode"] = "cors"; h["Sec-Fetch-Dest"] = "empty"
        if referer: h["Referer"] = referer
        h["Accept-Encoding"] = "gzip, deflate, br, zstd"; h["Accept-Language"] = self.accept_language
        # Chrome also sends `Priority: u=0, i`; libcurl-impersonate strips that header (it signals priority in h2 frames), so it is not claimed here.
        return h

# --------------------------------------------------------------------------------------------- tempo
class Tempo:
    """Reading time between pages. human: log-normal, median ~6 s, an occasional distraction. brisk: median ~2.5 s."""
    def __init__(self, mode="human", rng=None):
        self.mode = mode if mode in ("human", "brisk") else "human"; self.rng = rng or random.Random()
    def dwell(self):
        r = self.rng
        if self.mode == "brisk": return min(9.0, max(1.0, r.lognormvariate(math.log(2.5), 0.45)))
        if r.random() < 0.05: return r.uniform(25, 60)
        return min(28.0, max(2.0, r.lognormvariate(math.log(6.0), 0.55)))
    def asset_gap(self): return self.rng.uniform(0.08, 0.5)
    def endpoint_gap(self): return self.rng.uniform(0.8, 2.5)

# --------------------------------------------------------------------------------------------- helpers
CHALLENGE = re.compile(r"Just a moment\.\.\.|cf-chl|challenge-platform|_Incapsula_Resource|Pardon Our Interruption|"
                       r"verify you are a human|Attention Required!|Access Denied|Robot Challenge Screen|sgcaptcha", re.I)

def etld1(host):
    parts = host.lower().split(":")[0].split(".")
    if len(parts) >= 3 and parts[-2] in ("co", "com", "org", "net", "gov", "ac", "edu") and len(parts[-1]) == 2: return ".".join(parts[-3:])
    return ".".join(parts[-2:])

def fetch_site(referer, url):
    if not referer: return "none"
    a, b = urllib.parse.urlparse(referer).netloc.lower(), urllib.parse.urlparse(url).netloc.lower()
    if a == b: return "same-origin"
    if etld1(a) == etld1(b): return "same-site"
    return "cross-site"

def decompress(body, encoding):
    enc = (encoding or "").lower().strip()
    try:
        if enc == "gzip": return gzip.decompress(body)
        if enc == "deflate":
            try: return zlib.decompress(body)
            except zlib.error: return zlib.decompress(body, -15)
        if enc == "br":
            import brotli; return brotli.decompress(body)
        if enc == "zstd":
            import zstandard; return zstandard.ZstdDecompressor().decompressobj().decompress(body)
    except Exception: pass
    return body

def tier_of(status, html, hdrs):
    if CHALLENGE.search(html[:20000]) or hdrs.get("cf-mitigated") == "challenge": return "WAF"
    if status in (401, 403, 429, 503): return "NOT_TESTED"
    return "RAW" if status == 200 else "ERROR"

# --------------------------------------------------------------------------------------------- robots (honest mode)
# UltimaWeapon's honest mode adds two dispositions the persona layer never needed:
#   DECLARED           the request went out under the tool's own truthful User-Agent (no impersonation)
#   ROBOTS_DISALLOWED  the target's robots.txt tells our declared agent not to fetch this path, so we did not
class RobotsRules:
    """Minimal RFC 9309 matcher. Picks the most specific group for our UA token (else the * group); within it,
    the longest matching Allow/Disallow wins, ties go to Allow. Supports * wildcards and the $ end-anchor."""
    def __init__(self, text, ua_token):
        self.disallows = []; self.allows = []; self.crawl_delay = None
        self._parse(text or "", (ua_token or "*").lower())
    def _parse(self, text, ua_token):
        groups = []; cur_agents = None; cur = None
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if not line or ":" not in line: continue
            field, _, val = line.partition(":"); field = field.strip().lower(); val = val.strip()
            if field == "user-agent":
                if cur is not None and cur.get("started"):   # a new UA group after rules started closes the previous
                    groups.append((cur_agents, cur)); cur_agents = None; cur = None
                if cur_agents is None: cur_agents = set(); cur = {"rules": [], "crawl_delay": None, "started": False}
                cur_agents.add(val.lower())
            elif field in ("allow", "disallow") and cur is not None:
                cur["started"] = True; cur["rules"].append((field == "allow", val))
            elif field == "crawl-delay" and cur is not None:
                cur["started"] = True
                try: cur["crawl_delay"] = float(val)
                except ValueError: pass
        if cur_agents is not None and cur is not None: groups.append((cur_agents, cur))
        chosen = next((r for ag, r in groups if any(a != "*" and (a in ua_token or ua_token in a) for a in ag)), None)
        if chosen is None: chosen = next((r for ag, r in groups if "*" in ag), None)
        if chosen:
            self.crawl_delay = chosen["crawl_delay"]
            for allow, path in chosen["rules"]:
                (self.allows if allow else self.disallows).append(path)
    @staticmethod
    def _match(pattern, path):
        if pattern == "": return False
        rx = "".join(".*" if c == "*" else ("$" if c == "$" else re.escape(c)) for c in pattern)
        try: return re.match(rx, path) is not None
        except re.error: return path.startswith(pattern.rstrip("*$"))
    def allowed(self, path):
        path = path or "/"
        best_dis = max((len(p) for p in self.disallows if self._match(p, path)), default=-1)
        if best_dis < 0: return True
        best_all = max((len(p) for p in self.allows if self._match(p, path)), default=-1)
        return best_all >= best_dis

# --------------------------------------------------------------------------------------------- session
class Session:
    DEFAULT_DECLARED_UA = "OmegaWeapon/1.0 (+https://REPLACE-WITH-YOUR-CONTACT-URL)"

    def __init__(self, cache_dir=None, locale="en-US", tempo="human", assets=True, engine="auto", persist=True, quiet=True, timeout=30,
                 honest=None, declared_ua=None, obey_robots=None, min_interval=None, http_cache=True, cache_ttl=86400, max_retries=3):
        self.cache_dir = cache_dir; self.dir = os.path.join(cache_dir, "wetware") if cache_dir else None
        if self.dir: os.makedirs(self.dir, exist_ok=True)
        # ---- honest mode (UltimaWeapon default): identify truthfully, obey robots, back off, cache. Set by
        # arg, else the MO_HONEST env var. When on, the persona/impersonation path below is never taken.
        env = os.environ.get
        self.honest = ((env("OW_HONEST") or env("UW_HONEST") or env("MO_HONEST") or "").strip().lower() in ("1", "true", "yes", "on")) if honest is None else bool(honest)
        self.declared_ua = declared_ua or env("OW_USER_AGENT") or env("UW_USER_AGENT") or env("MO_USER_AGENT") or self.DEFAULT_DECLARED_UA
        self.obey_robots = ((env("OW_OBEY_ROBOTS") or env("UW_OBEY_ROBOTS") or env("MO_OBEY_ROBOTS") or "1").strip().lower() not in ("0", "false", "no", "off")) if obey_robots is None else bool(obey_robots)
        self.min_interval = float(env("OW_MIN_INTERVAL") or env("UW_MIN_INTERVAL") or env("MO_MIN_INTERVAL") or (min_interval if min_interval is not None else 2.0))
        self.http_cache = bool(http_cache); self.cache_ttl = cache_ttl; self.max_retries = max(0, int(max_retries))
        self.rng = random.Random(); self.tempo = Tempo(tempo, self.rng); self.assets = assets and not self.honest; self.persist = persist and bool(self.dir)
        self.quiet = quiet; self.timeout = timeout; self.locale = locale
        self.persona = self._load_persona(locale); self.rng.seed(self.persona.seed ^ int(time.time()))
        self.engine = "urllib" if self.honest else self._pick_engine(engine); self._client = None
        self.last_url = {}; self.last_t = {}; self.entered = {}; self.favicon_done = set()
        self.counts = {"document": 0, "asset": 0, "api": 0, "bot": 0, "robots_skipped": 0, "cache_hits": 0}
        self._robots = {}; self._httpcache = os.path.join(self.dir, "httpcache") if self.dir else None
        if self.honest and self._httpcache and self.http_cache:
            try: os.makedirs(self._httpcache, exist_ok=True)
            except Exception: pass
        self._log = open(os.path.join(self.dir, "fetch_log.jsonl"), "a") if self.dir else None
        self._load_cookies()

    # ---- persona / cookies persistence
    def _load_persona(self, locale):
        p = os.path.join(self.dir, "persona.json") if self.dir else None
        if p and os.path.exists(p):
            try:
                d = json.load(open(p))
                if d.get("locale") == locale: return Persona(d).refresh()
            except Exception: pass
        per = Persona.new(locale, self.rng)
        if p: json.dump(per.__dict__, open(p, "w"), indent=1)
        return per

    def _pick_engine(self, engine):
        if engine in ("curl_cffi", "urllib"): return engine
        try:
            import curl_cffi  # noqa
            return "curl_cffi"
        except Exception: return "urllib"

    def _cookie_path(self): return os.path.join(self.dir, "cookies.json") if self.dir else None

    def _load_cookies(self):
        self._cookies_urllib = []
        p = self._cookie_path()
        if not p or not os.path.exists(p): return
        try: rows = json.load(open(p))
        except Exception: return
        now = time.time(); rows = [c for c in rows if not c.get("expires") or c["expires"] > now]
        if self.engine == "curl_cffi":
            c = self.client()
            for r in rows:
                try: c.cookies.set(r["name"], r["value"], domain=r.get("domain") or "", path=r.get("path") or "/")
                except Exception: pass
        self._cookies_urllib = rows

    def _save_cookies(self):
        p = self._cookie_path()
        if not p: return
        rows = []
        if self.engine == "curl_cffi" and self._client is not None:
            for c in self._client.cookies.jar:
                rows.append({"name": c.name, "value": c.value, "domain": c.domain, "path": c.path, "expires": c.expires, "secure": c.secure})
        else: rows = self._cookies_urllib
        json.dump(rows, open(p, "w"), indent=0)

    def client(self):
        if self._client is None and self.engine == "curl_cffi":
            from curl_cffi import requests as cr, CurlHttpVersion
            # V2TLS: HTTP/2 over TLS, plain HTTP/1.1 on cleartext (Chrome never sends an h2c Upgrade)
            self._client = cr.Session(impersonate="chrome", default_headers=False, allow_redirects=True, max_redirects=10, timeout=self.timeout, http_version=CurlHttpVersion.V2TLS)
        return self._client

    # ---- pacing
    def _pace(self, host, kind):
        want = self.tempo.dwell() if kind == "document" else (self.tempo.asset_gap() if kind in ("style", "script", "image") else self.tempo.endpoint_gap())  # api / robots / sitemap: a short gap
        if host not in self.last_t: return 0.0   # a fresh tab needs no reading time first
        gap = want - (time.time() - self.last_t[host])
        if gap > 0: time.sleep(gap)
        return round(max(gap, 0.0), 2)

    def _entry(self, host):
        if host not in self.entered:
            self.entered[host] = "google" if self.rng.random() < self.persona.entry_google_share else "direct"
        return self.entered[host]

    # ---- the fetch
    def get(self, url, kind="document", accept=None, referer=None, ua=None, timeout=None, pace=True, footprints=None):
        """Returns (meta, text). meta carries status, final_url, chain, headers, ttfb, tier, presence.
        kind: document (a page: dwell, referer chain, footprints) | robots | sitemap (typed URLs, short gap) |
        style | script | image (assets) | api (a cors fetch to a public endpoint). ua= forces an explicit
        non-human identity (the cloaking diff's bot arms) and is logged as such."""
        if self.honest:
            if ua:   # explicit bot-UA arms (the cloaking diff) impersonate a trusted crawler — off in honest mode
                return ({"url": url, "status": None, "tier": "DISABLED", "note": "bot-UA arms (cloaking diff) are disabled in honest mode",
                         "final_url": url, "bytes": 0, "chain": [], "headers": {}, "ttfb": None, "kind": kind,
                         "presence": {"engine": "none", "identity": "n/a (honest mode)", "human": False, "referer": None}}, "")
            return self._get_honest(url, kind=kind, accept=accept, timeout=timeout, pace=pace)
        url = url if "://" in url else "https://" + url
        host = urllib.parse.urlparse(url).netloc
        dwell = self._pace(host, kind) if pace else 0.0
        if ua:  # explicit crawler identity: minimal header set, no hints, no session continuity
            headers = OrderedDict([("User-Agent", ua), ("Accept", accept or "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
                                   ("Accept-Language", "en-US,en;q=0.9"), ("Accept-Encoding", "gzip, deflate")]); who = "bot"
        else:
            if referer is None and kind == "document":   # None = automatic chain; False = a typed URL (no referer)
                referer = self.last_url.get(host) or ("https://www.google.com/" if self._entry(host) == "google" else None)
            elif referer is None and kind in ("style", "script", "image"):
                referer = self.last_url.get(host)
            elif referer is False or kind in ("robots", "sitemap"): referer = None   # robots.txt and sitemaps are typed URLs
            headers = self.persona.headers(kind, referer=referer, site=fetch_site(referer, url), accept=accept); who = "human"
        t0 = time.time()
        meta, body = self._engine_get(url, headers, timeout or self.timeout, who)
        meta["fetched_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()); meta["kind"] = kind; meta["dwell_before"] = dwell
        meta["presence"] = {"engine": meta.pop("_engine", self.engine), "identity": (ua if ua else self.persona.label), "human": who == "human", "referer": referer}
        text = body.decode("utf-8", "replace") if isinstance(body, (bytes, bytearray)) else (body or "")
        meta["tier"] = tier_of(meta.get("status", 0), text, meta.get("headers", {})) if meta.get("status") else "ERROR"
        self.last_t[host] = time.time()
        if who == "human" and kind == "document" and meta.get("status"):
            self.last_url[host] = meta.get("final_url") or url
        self.counts["bot" if who == "bot" else ("document" if kind == "document" else ("api" if kind in ("api", "robots", "sitemap") else "asset"))] += 1
        if self._log:
            self._log.write(json.dumps({"t": meta["fetched_at"], "url": url, "kind": kind, "status": meta.get("status"), "tier": meta["tier"], "engine": meta["presence"]["engine"],
                                        "identity": meta["presence"]["identity"], "referer": referer, "dwell": dwell, "ttfb": meta.get("ttfb"), "bytes": meta.get("bytes")}) + "\n"); self._log.flush()
        if not self.quiet: print("  wetware %-8s %s %s (%s, dwell %.1fs)" % (kind, meta.get("status"), url, meta["presence"]["identity"], dwell), file=sys.stderr)
        do_fp = self.assets if footprints is None else footprints
        if who == "human" and kind == "document" and do_fp and meta["tier"] == "RAW" and text: self.footprints(meta.get("final_url") or url, text)
        return meta, text

    def _engine_get(self, url, headers, timeout, who):
        if self.engine == "curl_cffi":
            try: return self._get_cffi(url, headers, timeout)
            except Exception as e:
                return {"url": url, "status": 0, "error": str(e)[:200], "chain": [], "headers": {}, "ttfb": None, "bytes": 0, "final_url": url, "_engine": "curl_cffi"}, b""
        return self._get_urllib(url, headers, timeout)

    def _get_cffi(self, url, headers, timeout):
        c = self.client(); t0 = time.time()
        r = c.get(url, headers=dict(headers), stream=True, timeout=timeout)
        ttfb = time.time() - t0
        try: body = b"".join(r.iter_content())
        finally:
            try: r.close()
            except Exception: pass
        hdrs = {k.lower(): v for k, v in r.headers.items()}
        chain = [{"status": h.status_code, "to": (h.headers.get("location") or "")} for h in (r.history or [])]
        if not body.startswith((b"<", b"{", b"[")) and hdrs.get("content-encoding"): body = decompress(body, hdrs.get("content-encoding"))
        return {"url": url, "final_url": str(r.url), "status": r.status_code, "ttfb": round(ttfb, 3), "bytes": len(body), "chain": chain,
                "headers": hdrs, "http_version": getattr(r, "http_version", None), "_engine": "curl_cffi"}, body

    def _get_urllib(self, url, headers, timeout):
        class Chain(urllib.request.HTTPRedirectHandler):
            def __init__(s): s.hops = []
            def redirect_request(s, req, fp, code, msg, hdrs, newurl):
                s.hops.append({"status": code, "to": newurl}); return super().redirect_request(req, fp, code, msg, hdrs, newurl)
        ch = Chain(); op = urllib.request.build_opener(ch)
        h = OrderedDict(headers); h["Accept-Encoding"] = "gzip, deflate" + (", br" if _has("brotli") else "") + (", zstd" if _has("zstandard") else "")
        host = urllib.parse.urlparse(url).netloc
        ck = "; ".join("%s=%s" % (c["name"], c["value"]) for c in self._cookies_urllib if host.endswith((c.get("domain") or "").lstrip(".")))
        if ck: h["Cookie"] = ck
        req = urllib.request.Request(url, headers=h); t0 = time.time(); status, hdrs, body, final = 0, {}, b"", url
        try:
            with op.open(req, timeout=timeout) as r:
                status, hdrs, final = r.status, dict(r.headers), r.geturl(); ttfb = time.time() - t0; body = r.read()
        except urllib.error.HTTPError as e:
            status, hdrs, final = e.code, dict(e.headers), e.geturl() or url; ttfb = time.time() - t0
            try: body = e.read()
            except Exception: body = b""
        except Exception as e:
            return {"url": url, "status": 0, "error": str(e)[:200], "tier": "ERROR", "chain": ch.hops, "headers": {}, "ttfb": round(time.time() - t0, 3), "bytes": 0, "final_url": url, "_engine": "urllib"}, b""
        for sc in [v for k, v in hdrs.items() if k.lower() == "set-cookie"]:
            m = re.match(r"\s*([^=;]+)=([^;]*)", sc)
            if m: self._cookies_urllib = [c for c in self._cookies_urllib if c["name"] != m.group(1)] + [{"name": m.group(1), "value": m.group(2), "domain": host, "path": "/", "expires": None}]
        body = decompress(body, next((v for k, v in hdrs.items() if k.lower() == "content-encoding"), ""))
        return {"url": url, "final_url": final, "status": status, "ttfb": round(ttfb, 3), "bytes": len(body), "chain": ch.hops,
                "headers": {k.lower(): v for k, v in hdrs.items()}, "http_version": "1.1", "_engine": "urllib"}, body

    # ---- footprints: what a browser pulls after the document
    def footprints(self, page_url, html, max_assets=2):
        host = urllib.parse.urlparse(page_url).netloc; base = "https://%s" % host
        picks = []
        if host not in self.favicon_done:
            self.favicon_done.add(host)
            m = re.search(r'<link[^>]+rel=["\'](?:shortcut )?icon["\'][^>]*href=["\']([^"\']+)', html, re.I)
            picks.append(("image", urllib.parse.urljoin(page_url, m.group(1)) if m else base + "/favicon.ico"))
        head = html[:60000]
        css = [urllib.parse.urljoin(page_url, u) for u in re.findall(r'<link[^>]+rel=["\']stylesheet["\'][^>]*href=["\']([^"\']+)', head, re.I)]
        js = [urllib.parse.urljoin(page_url, u) for u in re.findall(r'<script[^>]+src=["\']([^"\']+)', head, re.I)]
        firstparty = [("style", u) for u in css if urllib.parse.urlparse(u).netloc == host] + [("script", u) for u in js if urllib.parse.urlparse(u).netloc == host]
        picks += firstparty[:max_assets]
        for kind, u in picks:
            try: self.get(u, kind=kind, referer=page_url, pace=True, footprints=False)
            except Exception: pass

    # ---- honest mode: robots, rate limit, backoff, conditional cache (UltimaWeapon default)
    def _ua_token(self):
        m = re.match(r"\s*([^/\s]+)", self.declared_ua or ""); return (m.group(1).lower() if m else "ultimaweapon")

    def _robots_rules(self, host, scheme="https"):
        if host in self._robots: return self._robots[host]
        rules = None
        try:
            meta, txt = self._honest_raw("%s://%s/robots.txt" % (scheme or "https", host), "robots", None, self.timeout, use_cache=False)
            if meta.get("status") == 200 and txt: rules = RobotsRules(txt, self._ua_token())
            elif meta.get("status") in (401, 403): rules = RobotsRules("User-agent: *\nDisallow: /", self._ua_token())
        except Exception: rules = None
        self._robots[host] = rules
        return rules

    def _robots_ok(self, url):
        if not self.obey_robots: return True, None
        p = urllib.parse.urlparse(url); rules = self._robots_rules(p.netloc, p.scheme)
        if rules is None: return True, None
        path = (p.path or "/") + (("?" + p.query) if p.query else "")
        return rules.allowed(path), rules.crawl_delay

    def _honest_pace(self, host, crawl_delay):
        want = max(self.min_interval, crawl_delay or 0.0)
        if host in self.last_t:
            gap = want - (time.time() - self.last_t[host])
            if gap > 0: time.sleep(gap)

    def _honest_headers(self, kind, accept):
        h = OrderedDict()
        h["User-Agent"] = self.declared_ua
        h["Accept"] = accept or ("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" if kind in ("document", "robots", "sitemap") else "*/*")
        h["Accept-Language"] = "en-US,en;q=0.9"
        h["Accept-Encoding"] = "gzip, deflate" + (", br" if _has("brotli") else "") + (", zstd" if _has("zstandard") else "")
        return h

    def _cache_file(self, url):
        import hashlib
        return os.path.join(self._httpcache, hashlib.sha256(url.encode("utf-8")).hexdigest() + ".json") if self._httpcache else None

    def _cache_read(self, url):
        p = self._cache_file(url)
        if not (self.http_cache and p and os.path.exists(p)): return None
        try: return json.load(open(p))
        except Exception: return None

    def _cache_write(self, url, meta, text, etag, last_modified):
        p = self._cache_file(url)
        if not (self.http_cache and p): return
        try:
            json.dump({"url": url, "stored_at": time.time(), "status": meta.get("status"), "headers": meta.get("headers", {}),
                       "etag": etag, "last_modified": last_modified, "final_url": meta.get("final_url"), "body": text}, open(p, "w"))
        except Exception: pass

    def _urllib_once(self, url, headers, timeout):
        """One plain urllib GET under the declared identity: Python's own TLS, no cookie jar, no impersonation."""
        class Chain(urllib.request.HTTPRedirectHandler):
            def __init__(s): s.hops = []
            def redirect_request(s, req, fp, code, msg, hdrs, newurl):
                s.hops.append({"status": code, "to": newurl}); return super().redirect_request(req, fp, code, msg, hdrs, newurl)
        ch = Chain(); op = urllib.request.build_opener(ch)
        req = urllib.request.Request(url, headers=dict(headers)); t0 = time.time(); status, hdrs, body, final = 0, {}, b"", url
        try:
            with op.open(req, timeout=timeout) as r:
                status, hdrs, final = r.status, dict(r.headers), r.geturl(); ttfb = time.time() - t0; body = r.read()
        except urllib.error.HTTPError as e:
            status, hdrs, final = e.code, dict(e.headers), (e.geturl() or url); ttfb = time.time() - t0
            try: body = e.read()
            except Exception: body = b""
        except Exception as e:
            return {"url": url, "status": 0, "error": str(e)[:200], "chain": ch.hops, "headers": {}, "ttfb": round(time.time() - t0, 3), "bytes": 0, "final_url": url}, b""
        body = decompress(body, next((v for k, v in hdrs.items() if k.lower() == "content-encoding"), ""))
        return {"url": url, "final_url": final, "status": status, "ttfb": round(ttfb, 3), "bytes": len(body), "chain": ch.hops,
                "headers": {k.lower(): v for k, v in hdrs.items()}, "http_version": "1.1"}, body

    def _honest_raw(self, url, kind, accept, timeout, use_cache=True):
        """Transport for honest mode: fresh-cache short-circuit, conditional revalidation, 429/5xx backoff honoring
        Retry-After. No robots gate here (that is _get_honest's job) so robots.txt itself can be fetched."""
        url = url if "://" in url else "https://" + url
        cached = self._cache_read(url) if use_cache else None
        if cached and kind != "robots" and (time.time() - cached.get("stored_at", 0)) < self.cache_ttl:
            self.counts["cache_hits"] += 1; body = cached.get("body") or ""
            return ({"url": url, "final_url": cached.get("final_url") or url, "status": cached.get("status"),
                     "tier": tier_of(cached.get("status") or 0, body, cached.get("headers") or {}), "bytes": len(body.encode("utf-8", "replace")),
                     "chain": [], "headers": cached.get("headers") or {}, "ttfb": 0.0, "kind": kind, "from_cache": True,
                     "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                     "presence": {"engine": "urllib", "identity": self.declared_ua, "human": False, "referer": None}}, body)
        headers = self._honest_headers(kind, accept)
        if cached and cached.get("etag"): headers["If-None-Match"] = cached["etag"]
        if cached and cached.get("last_modified"): headers["If-Modified-Since"] = cached["last_modified"]
        attempt = 0
        while True:
            meta, body = self._urllib_once(url, headers, timeout)
            status = meta.get("status")
            if status == 304 and cached:
                self.counts["cache_hits"] += 1; b = cached.get("body") or ""
                meta.update({"tier": tier_of(cached.get("status") or 200, b, cached.get("headers") or {}), "from_cache": True,
                             "bytes": len(b.encode("utf-8", "replace")), "final_url": cached.get("final_url") or url, "kind": kind,
                             "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                             "presence": {"engine": "urllib", "identity": self.declared_ua, "human": False, "referer": None}})
                return meta, b
            if status in (429, 500, 502, 503, 504) and attempt < self.max_retries:
                ra = meta.get("headers", {}).get("retry-after"); delay = None
                if ra:
                    try: delay = float(ra)
                    except (ValueError, TypeError): delay = None
                if delay is None: delay = (2 ** attempt) * 1.5 + self.rng.uniform(0, 1.0)
                delay = min(delay, 120.0)
                if not self.quiet: print("  honest   backoff %.1fs after HTTP %s on %s" % (delay, status, url), file=sys.stderr)
                time.sleep(delay); attempt += 1; continue
            text = body.decode("utf-8", "replace") if isinstance(body, (bytes, bytearray)) else (body or "")
            meta["kind"] = kind; meta["from_cache"] = False; meta["fetched_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            meta["tier"] = tier_of(status or 0, text, meta.get("headers", {})) if status else "ERROR"
            meta["presence"] = {"engine": "urllib", "identity": self.declared_ua, "human": False, "referer": None}
            if status == 200 and use_cache and kind != "robots":
                hh = meta.get("headers", {}); self._cache_write(url, meta, text, hh.get("etag"), hh.get("last-modified"))
            return meta, text

    def _get_honest(self, url, kind="document", accept=None, timeout=None, pace=True):
        url = url if "://" in url else "https://" + url
        host = urllib.parse.urlparse(url).netloc; crawl_delay = None
        if kind not in ("robots", "sitemap"):   # robots.txt and sitemaps are always fetchable to learn the rules
            ok, crawl_delay = self._robots_ok(url)
            if not ok:
                self.counts["robots_skipped"] += 1
                meta = {"url": url, "final_url": url, "status": None, "tier": "ROBOTS_DISALLOWED", "bytes": 0, "chain": [], "headers": {}, "ttfb": None,
                        "kind": kind, "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "presence": {"engine": "urllib", "identity": self.declared_ua, "human": False, "referer": None}}
                if self._log: self._log.write(json.dumps({"t": meta["fetched_at"], "url": url, "kind": kind, "status": None, "tier": "ROBOTS_DISALLOWED", "identity": self.declared_ua}) + "\n"); self._log.flush()
                if not self.quiet: print("  honest   %-8s ROBOTS_DISALLOWED %s" % (kind, url), file=sys.stderr)
                return meta, ""
        if pace: self._honest_pace(host, crawl_delay)
        meta, text = self._honest_raw(url, kind, accept, timeout or self.timeout, use_cache=self.http_cache)
        self.last_t[host] = time.time()
        self.counts["document" if kind == "document" else ("api" if kind in ("api", "robots", "sitemap") else "asset")] += 1
        if self._log:
            self._log.write(json.dumps({"t": meta["fetched_at"], "url": url, "kind": kind, "status": meta.get("status"), "tier": meta.get("tier"),
                                        "engine": "urllib", "identity": self.declared_ua, "from_cache": meta.get("from_cache"), "ttfb": meta.get("ttfb"), "bytes": meta.get("bytes")}) + "\n"); self._log.flush()
        if not self.quiet: print("  honest   %-8s %s %s (%s%s)" % (kind, meta.get("status"), url, self._ua_token(), ", cached" if meta.get("from_cache") else ""), file=sys.stderr)
        return meta, text

    # ---- reporting
    def presence(self):
        if self.honest:
            return {"mode": "honest", "tier": "DECLARED", "engine": self.engine, "declared_ua": self.declared_ua, "obey_robots": self.obey_robots,
                    "min_interval": self.min_interval, "http_cache": bool(self.http_cache), "locale": self.locale, "tempo": "rate-limited", "counts": dict(self.counts)}
        return {"tier": None, "engine": self.engine, "persona": self.persona.label, "ua": self.persona.ua, "locale": self.locale,
                "timezone": self.persona.timezone, "tempo": self.tempo.mode, "assets": self.assets, "counts": dict(self.counts)}

    def close(self):
        self._save_cookies()
        if self.dir:
            json.dump(self.persona.__dict__, open(os.path.join(self.dir, "persona.json"), "w"), indent=1)
            p = os.path.join(self.dir, "presence.json"); prev = {}
            if os.path.exists(p):
                try: prev = json.load(open(p))
                except Exception: prev = {}
            cur = self.presence(); cur["tier"] = prev.get("tier"); cur["selfcheck"] = prev.get("selfcheck"); cur["runs"] = prev.get("runs", 0) + 1
            for k, v in prev.get("counts", {}).items(): cur["counts"][k] = cur["counts"].get(k, 0) + v
            json.dump(cur, open(p, "w"), indent=1)
        if self._log: self._log.close()
        if self._client is not None:
            try: self._client.close()
            except Exception: pass

def _has(mod):
    try: __import__(mod); return True
    except Exception: return False

# --------------------------------------------------------------------------------------------- self-check
def selfcheck(session):
    """Fetch a fingerprint echo and record what an origin actually sees from this vantage. Tier is MEASURED:
    H2 = the impersonated Chrome hello reached the origin (GREASE + ALPN present, http version matches)
    H1 = the hello was re-terminated upstream (workspace egress) — headers, cookies, pacing and JS surface are ours
    H0 = urllib engine — headers only."""
    if getattr(session, "honest", False):   # honest mode impersonates nothing, so there is no fingerprint to measure
        return {"mode": "honest", "tier": "DECLARED", "engine": session.engine, "declared_ua": session.declared_ua,
                "obey_robots": session.obey_robots, "note": "honest mode: no TLS/fingerprint self-test (the tool is not disguised)"}
    out = {"checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "engine": session.engine, "ip": None, "ip_registrant": None,
           "ja4": None, "http_version_at_origin": None, "grease": None, "alpn": None, "ua_echo": None, "tls": "unmeasured", "tier": None, "echo": None}
    try:
        m, txt = session.get("https://tls.peet.ws/api/all", kind="api", accept="application/json", pace=False)
        if m.get("status") == 200:
            j = json.loads(txt); t = j.get("tls", {}); out["echo"] = "tls.peet.ws"
            out["ip"] = (j.get("ip") or "").rsplit(":", 1)[0] or None; out["ja4"] = t.get("ja4"); out["http_version_at_origin"] = j.get("http_version"); out["ua_echo"] = j.get("user_agent")
            out["grease"] = any("GREASE" in c for c in t.get("ciphers", [])) or any("GREASE" in e.get("name", "") for e in t.get("extensions", []))
            out["alpn"] = any("application_layer_protocol" in e.get("name", "") for e in t.get("extensions", []))
    except Exception as e: out["echo_error"] = str(e)[:120]
    if out["echo"] is None:
        try:
            m, txt = session.get("https://tls.browserleaks.com/json", kind="api", accept="application/json", pace=False)
            if m.get("status") == 200:
                j = json.loads(txt); out["echo"] = "tls.browserleaks.com"; out["ip"] = j.get("ip"); out["ja4"] = j.get("ja4"); out["ua_echo"] = j.get("user_agent")
        except Exception as e: out["echo_error"] = str(e)[:120]
    if out["ip"]:
        try:
            m, txt = session.get("https://rdap.org/ip/%s" % out["ip"], kind="api", accept="application/rdap+json, application/json", pace=False)
            if m.get("status") == 200:
                j = json.loads(txt); names = []
                for e in j.get("entities", []):
                    vc = e.get("vcardArray", [None, []])[1]
                    names += [x[3] for x in vc if x and x[0] == "fn"]
                out["ip_registrant"] = (names[0] if names else j.get("name"))
        except Exception: pass
    if session.engine == "urllib": out["tls"], out["tier"] = "python/OpenSSL hello", "H0"
    elif out["grease"] is None: out["tls"], out["tier"] = "unmeasured (echo unreachable)", "H1?"
    elif out["grease"] and out["alpn"]: out["tls"], out["tier"] = "impersonated Chrome hello reached the origin", "H2"
    else: out["tls"], out["tier"] = "re-terminated upstream (egress proxy speaks its own TLS to the origin)", "H1"
    if session.dir:
        p = os.path.join(session.dir, "presence.json"); cur = {}
        if os.path.exists(p):
            try: cur = json.load(open(p))
            except Exception: cur = {}
        cur.update({k: v for k, v in session.presence().items() if k != "counts"}); cur["tier"] = out["tier"]; cur["selfcheck"] = out; json.dump(cur, open(p, "w"), indent=1)
    return out

def presence_sentence(pres):
    """The line for the report's Data Sources & Coverage section."""
    if pres.get("mode") == "honest":
        c = pres.get("counts", {}) or {}
        return ("Presence DECLARED (honest mode): every request identified the tool truthfully as %r over a plain Python HTTP client "
                "— no browser impersonation, no TLS-fingerprint spoofing, no fabricated referer. robots.txt was %s; requests were rate-limited "
                "to >=%.1fs per host with Retry-After honored and 429/5xx backed off, and a conditional on-disk cache avoided re-fetches "
                "(%d path(s) skipped as robots-disallowed, %d served from cache). A wall (WAF / 403 / CAPTCHA) is recorded NOT_TESTED and never worked around."
                % (pres.get("declared_ua", "the declared agent"), ("obeyed" if pres.get("obey_robots", True) else "IGNORED (--ignore-robots was set)"),
                   pres.get("min_interval", 2.0), c.get("robots_skipped", 0), c.get("cache_hits", 0)))
    sc = pres.get("selfcheck") or {}; tier = pres.get("tier") or sc.get("tier") or "H1?"
    who = pres.get("persona", "a current desktop Chrome")
    base = ("Presence %s: every target request presented as %s with the full browser header set, client hints, session cookies, a referer chain, "
            "first-party asset footprints and human pacing (%s tempo)." % (tier, who, pres.get("tempo", "human")))
    if tier == "H2": tail = " The Chrome TLS hello reached the origin from %s%s: the session is indistinguishable from a desktop visitor at the transport layer." % (sc.get("ip") or "the operator's network", (" (registrant: %s)" % sc["ip_registrant"]) if sc.get("ip_registrant") else "")
    elif tier == "H0": tail = " The transport was Python's own TLS stack (urllib fallback): identity and behavior were human, the hello was not."
    elif tier.endswith("?"): tail = " The egress vantage was not measured this run (no self-test on this cache); treat it as H1: the TLS hello and IP belong to wherever the scripts ran, and only the local pull earns H2."
    else: tail = (" The TLS hello and the IP belong to the workspace egress%s, so JA4-scoring bot management and network-reputation checks could still classify the session as automated; a wall met from here was met by a human-presenting browser and is reported as such. Full residential presence (H2) is the local pull."
                  % ((" (%s, registrant: %s)" % (sc.get("ip"), sc.get("ip_registrant"))) if sc.get("ip") and sc.get("ip_registrant") else ((" (%s)" % sc["ip"]) if sc.get("ip") else "")))
    return base + tail

# --------------------------------------------------------------------------------------------- render (Playwright)
STEALTH_JS = r"""
(() => {
  const P = __PERSONA__;
  const natives = new WeakMap();
  const def = (o, k, v) => { try { Object.defineProperty(o, k, { get: () => v, configurable: true, enumerable: true }); } catch (e) {} };
  const wrap = (obj, name, fn) => { try { const orig = obj[name]; const f = fn(orig); natives.set(f, name); obj[name] = f; } catch (e) {} };
  const _ts = Function.prototype.toString;
  wrap(Function.prototype, 'toString', (orig) => function () { if (natives.has(this)) return 'function ' + natives.get(this) + '() { [native code] }'; return orig.call(this); });
  def(Navigator.prototype, 'hardwareConcurrency', P.hw);
  def(Navigator.prototype, 'deviceMemory', P.mem);
  def(Navigator.prototype, 'platform', P.platform);
  const gl = (proto) => { if (!proto) return; wrap(proto, 'getParameter', (orig) => function (p) { if (p === 37445) return P.vendor; if (p === 37446) return P.renderer; return orig.call(this, p); }); };
  gl(window.WebGLRenderingContext && WebGLRenderingContext.prototype); gl(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  if (window.Notification) def(Notification, 'permission', 'default');
  if (navigator.permissions && navigator.permissions.query) {
    wrap(navigator.permissions, 'query', (orig) => function (d) { if (d && d.name === 'notifications') return Promise.resolve({ state: 'prompt', onchange: null }); return orig.call(this, d); });
  }
  if (window.chrome && !window.chrome.app) {
    try {
      window.chrome.app = { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } };
      const t0 = Date.now(); window.chrome.csi = function () { return { startE: t0, onloadT: t0 + 300, pageT: Date.now() - t0, tran: 15 }; };
      window.chrome.loadTimes = function () { return { requestTime: t0 / 1000, startLoadTime: t0 / 1000, commitLoadTime: t0 / 1000 + 0.2, finishDocumentLoadTime: t0 / 1000 + 0.6, finishLoadTime: t0 / 1000 + 1.1, firstPaintTime: t0 / 1000 + 0.7, firstPaintAfterLoadTime: 0, navigationType: 'Other', wasFetchedViaSpdy: true, wasNpnNegotiated: true, npnNegotiatedProtocol: 'h2', wasAlternateProtocolAvailable: false, connectionInfo: 'h2' }; };
      natives.set(window.chrome.csi, 'csi'); natives.set(window.chrome.loadTimes, 'loadTimes');
    } catch (e) {}
  }
  // the open-source Chromium build lacks the proprietary codecs a retail Chrome reports
  const codecOK = (t) => /avc1|mp4a|video\/mp4|audio\/mp4|audio\/mpeg|audio\/aac|x-m4a/i.test(t || '');
  if (window.HTMLMediaElement) wrap(HTMLMediaElement.prototype, 'canPlayType', (orig) => function (t) { const r = orig.call(this, t); return (!r && codecOK(t)) ? 'probably' : r; });
  if (window.MediaSource && MediaSource.isTypeSupported) wrap(MediaSource, 'isTypeSupported', (orig) => function (t) { return orig.call(this, t) || codecOK(t); });
  def(window, 'outerWidth', P.screenW); def(window, 'outerHeight', P.viewportH + P.chromeH);
  def(Screen.prototype, 'availWidth', P.screenW); def(Screen.prototype, 'availHeight', P.screenH - P.taskbar);
  def(Screen.prototype, 'availTop', P.availTop); def(Screen.prototype, 'availLeft', 0);
})();
"""

def render_launch(pw, persona, locale=None, headless=True, extra_args=None):
    """Launch the real Chromium the way a person's would present: new headless mode (the full binary, not the
    headless shell), automation banner and navigator.webdriver flag off, persona UA, locale, timezone, viewport,
    screen and DPR. Returns (browser, context); call render_page(ctx, persona) for each page."""
    locale = locale or persona.locale
    vw, vh = persona.viewport; sw, sh = persona.screen
    args = ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--disable-infobars", "--window-size=%d,%d" % (sw, sh),
            "--lang=%s" % locale, "--disable-dev-shm-usage"] + (extra_args or [])
    try: browser = pw.chromium.launch(channel="chromium", headless=headless, args=args, ignore_default_args=["--enable-automation"])
    except Exception: browser = pw.chromium.launch(headless=headless, args=args, ignore_default_args=["--enable-automation"])
    ctx = browser.new_context(user_agent=persona.ua, locale=locale, timezone_id=persona.timezone, viewport={"width": vw, "height": vh},
                              screen={"width": sw, "height": sh}, device_scale_factor=persona.dpr, color_scheme="light", has_touch=False, is_mobile=False)
    ctx._wetware_locale = locale
    ctx.add_init_script(STEALTH_JS.replace("__PERSONA__", json.dumps({"hw": persona.hardware_concurrency, "mem": persona.device_memory, "platform": persona.nav_platform,
                                                                       "vendor": persona.webgl_vendor, "renderer": persona.webgl_renderer, "screenW": sw, "screenH": sh,
                                                                       "viewportH": vh, "chromeH": sh - vh - (48 if persona.platform == "Windows" else 25), "taskbar": 48 if persona.platform == "Windows" else 25,
                                                                       "availTop": 0 if persona.platform == "Windows" else 25})))
    return browser, ctx

def render_launch_honest(pw, declared_ua, locale="en-US", headless=True, extra_args=None):
    """Honest render (UltimaWeapon): the real Chromium with an identifiable UA and NO stealth — the automation
    flags stay on, navigator.webdriver stays true, no client-hint / WebGL spoof, no injected patches. It renders and
    screenshots the page as a declared automated client, not as a disguised person."""
    args = ["--no-sandbox", "--disable-dev-shm-usage", "--lang=%s" % locale] + (extra_args or [])
    browser = pw.chromium.launch(headless=headless, args=args)
    ctx = browser.new_context(user_agent=declared_ua, locale=locale)
    ctx._wetware_locale = locale
    return browser, ctx

def render_page(ctx, persona):
    """New page with the client-hint metadata that makes sec-ch-ua and navigator.userAgentData agree with the UA."""
    page = ctx.new_page()
    try:
        cdp = ctx.new_cdp_session(page)
        # acceptLanguage takes the locale LIST; Chromium derives the q-values and navigator.languages from it exactly as a real profile would
        cdp.send("Emulation.setUserAgentOverride", {"userAgent": persona.ua, "acceptLanguage": locale_list(getattr(ctx, "_wetware_locale", persona.locale)),
                                                    "platform": persona.nav_platform, "userAgentMetadata": persona.metadata()})
    except Exception: pass
    return page

def human_settle(page, rng=None, scroll=True):
    """What a person does after a page appears: a beat, a little mouse travel, a few scroll steps with pauses."""
    rng = rng or random.Random()
    try:
        vw = page.viewport_size or {"width": 1366, "height": 768}
        page.wait_for_timeout(int(rng.uniform(700, 1800)))
        x, y = rng.uniform(200, vw["width"] - 200), rng.uniform(120, vw["height"] - 120)
        for _ in range(rng.randint(2, 4)):
            x, y = min(max(x + rng.uniform(-350, 350), 10), vw["width"] - 10), min(max(y + rng.uniform(-220, 220), 10), vw["height"] - 10)
            page.mouse.move(x, y, steps=rng.randint(12, 28)); page.wait_for_timeout(int(rng.uniform(120, 600)))
        if scroll:
            for _ in range(rng.randint(2, 4)):
                page.mouse.wheel(0, rng.uniform(280, 720)); page.wait_for_timeout(int(rng.uniform(450, 1400)))
            if rng.random() < 0.4: page.mouse.wheel(0, -rng.uniform(150, 400)); page.wait_for_timeout(int(rng.uniform(300, 900)))
    except Exception: pass

# --------------------------------------------------------------------------------------------- CLI
def _main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--selftest", action="store_true"); ap.add_argument("--report", metavar="CACHE_DIR"); ap.add_argument("--persona", metavar="CACHE_DIR")
    ap.add_argument("--new", action="store_true", help="with --persona: roll a new visitor for that cache"); ap.add_argument("--cache", default=None)
    ap.add_argument("--locale", default="en-US"); ap.add_argument("--engine", default="auto")
    ap.add_argument("--honest", action="store_true", help="honest mode: declared UA, obey robots, rate-limit + cache, no impersonation")
    ap.add_argument("--ua", default=None, help="declared User-Agent for honest mode (else MO_USER_AGENT or the default)")
    a = ap.parse_args()
    if a.persona:
        p = os.path.join(a.persona, "wetware", "persona.json")
        if a.new and os.path.exists(p): os.remove(p)
        s = Session(a.persona, locale=a.locale); print(json.dumps(s.persona.__dict__, indent=1)); s.close(); return
    if a.report:
        p = os.path.join(a.report, "wetware", "presence.json")
        if not os.path.exists(p): sys.exit("no presence.json under %s/wetware — run a fetch (or --selftest --cache DIR) first" % a.report)
        pres = json.load(open(p)); print(presence_sentence(pres)); print(json.dumps({"counts": pres.get("counts"), "selfcheck": pres.get("selfcheck")}, indent=1)); return
    if a.selftest:
        s = Session(a.cache, locale=a.locale, engine=a.engine, quiet=False, assets=False, honest=a.honest, declared_ua=a.ua)
        if s.honest:
            print("honest mode | declared UA:", s.declared_ua, "| obey_robots:", s.obey_robots, "| min_interval:", s.min_interval, "| engine:", s.engine)
        else:
            print("persona:", s.persona.label, "| engine:", s.engine, "| tz:", s.persona.timezone, "| viewport:", s.persona.viewport, "| sec-ch-ua:", sec_ch_ua(s.persona.brands))
        m, txt = s.get("https://httpbin.org/headers", kind="document", pace=False, footprints=False)
        try: print("header echo:", json.dumps(json.loads(txt).get("headers"), indent=1))
        except Exception: print("header echo: status", m.get("status"))
        sc = selfcheck(s); print("selfcheck:", json.dumps(sc, indent=1))
        pres = s.presence(); pres["tier"] = sc.get("tier"); pres["selfcheck"] = sc; print(); print(presence_sentence(pres)); s.close(); return
    ap.print_help()

if __name__ == "__main__": _main()
