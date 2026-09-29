#!/usr/bin/env python3
"""UltimaWeapon / EmergencySatchel — raw-HTML web forensics (no connector, no challenge solving; every request wears wetware).

Subcommands
  scan   URL...            polite raw fetch of each URL: tag stack + IDs, GTM container expansion, cloaking diff
                           (browser vs Googlebot vs AdsBot-Google), disclosure regex packs, JSON-LD inventory,
                           app discovery (AASA / assetlinks / store links), social handles, phones, footer credits,
                           robots.txt posture, ads.txt / app-ads.txt. Writes <slug>.web.json per URL plus
                           web_summary.csv, tags_matrix.csv, disclosures.csv in --out.
  rdap   DOMAIN...         registrant / admin org, registration + expiry dates, registrar, nameservers (rdap.org).
  dns    DOMAIN...         SPF, DMARC and MX via DNS-over-HTTPS (cloudflare-dns.com, then dns.google).

Rules of the probe: every request goes through scripts/wetware.py — one desktop-Chrome persona per target cache, the
full browser header set, session cookies, a referer chain, first-party asset footprints and human pacing. The
cloaking diff (Googlebot / AdsBot arms) is OPT-IN (--cloak): it deliberately sends two non-human requests per page
against the target's own pages only, and the run's judgment-call block says so. No retries on 403/429, no proxies,
no cached copies. A challenge page or a proxy refusal is recorded as NOT_TESTED — never worked around.

Usage
  python3 satchel_web.py scan --out omega_cache/<domain>/web https://example.com/ https://example.com/contact/
  python3 satchel_web.py scan --cloak --no-gtm --tempo brisk --out out/ URL...      (--cache DIR to name the wetware cache; default: parent of --out)
  python3 satchel_web.py rdap example.com rival.com --out out/
  python3 satchel_web.py dns example.com --out out/
"""
import argparse, csv, difflib, html as htmlmod, json, os, re, sys, time, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wetware

WW = None   # the wetware session; opened in main() (or by open_session()) so every fetch in this file wears it
def open_session(cache=None, locale="en-US", tempo="human", assets=True, honest=None, declared_ua=None, obey_robots=None, min_interval=None):
    global WW
    if WW is None: WW = wetware.Session(cache or "omega_cache/run", locale=locale, tempo=tempo, assets=assets, quiet=False,
                                        honest=honest, declared_ua=declared_ua, obey_robots=obey_robots, min_interval=min_interval)
    return WW
UA_GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
UA_ADSBOT = "AdsBot-Google (+http://www.google.com/adsbot.html)"
CHALLENGE = re.compile(r"Just a moment\.\.\.|cf-chl|challenge-platform|_Incapsula_Resource|Pardon Our Interruption|"
                       r"verify you are a human|Attention Required!|Access Denied|Robot Challenge Screen|sgcaptcha", re.I)

# ---------------------------------------------------------------- fetch
def get(url, ua=None, timeout=30, accept=None, kind="document", referer=None, footprints=None):
    """(meta, text) via wetware. ua= is the explicit crawler identity used ONLY by the cloaking diff's bot arms."""
    ww = open_session()
    return ww.get(url, kind=kind, accept=accept, referer=referer, ua=ua, timeout=timeout, footprints=footprints)

def slug(url):
    p = urllib.parse.urlparse(url if "://" in url else "https://" + url)
    return re.sub(r"[^A-Za-z0-9._-]+", "_", (p.netloc + p.path + ("?" + p.query if p.query else "")).strip("/"))[:150] or "root"

def visible_text(html):
    t = re.sub(r"(?is)<(script|style|noscript|template)\b.*?</\1>", " ", html)
    t = re.sub(r"(?s)<!--.*?-->", " ", t); t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", htmlmod.unescape(t))

# ---------------------------------------------------------------- tag fingerprints (regex on raw HTML or gtm.js)
TAGS = {
    "gtm_ids": r"\b(GTM-[A-Z0-9]{4,10})\b",
    "ga4_ids": r"\b(G-[A-Z0-9]{6,12})\b",
    "ua_ids": r"\b(UA-\d{4,10}-\d{1,3})\b",
    "google_ads_ids": r"\b(AW-\d{6,12})\b",
    "meta_pixel_ids": r"fbq\(\s*['\"]init['\"]\s*,\s*['\"](\d{10,20})['\"]|facebook\.com/tr\?[^\"']*id=(\d{10,20})|[\"']pixelId[\"']\s*[:,]\s*[\"'](\d{10,20})",
    "tiktok_pixel_ids": r"ttq\.load\(\s*['\"]([A-Z0-9]{15,30})['\"]|analytics\.tiktok\.com/i18n/pixel/events\.js\?sdkid=([A-Z0-9]+)",
    "linkedin_partner_ids": r"_linkedin_partner_id\s*=\s*[\"'](\d+)[\"']",
    "pinterest_tag_ids": r"pintrk\(\s*['\"]load['\"]\s*,\s*['\"](\d+)['\"]",
    "snap_pixel_ids": r"snaptr\(\s*['\"]init['\"]\s*,\s*['\"]([\w-]+)['\"]",
    "microsoft_uet_ids": r"[\"']?ti[\"']?\s*:\s*[\"'](\d{6,12})[\"']",
    "hotjar_ids": r"hjid\s*[:=]\s*(\d+)|static\.hotjar\.com/c/hotjar-(\d+)\.js",
    "clarity_ids": r"clarity\.ms/tag/([a-z0-9]+)",
    "hubspot_portal_ids": r"js\.hs-scripts\.com/(\d+)\.js|js\.hsforms\.net/forms/[^\"']*portalId=(\d+)",
    "callrail_ids": r"cdn\.callrail\.com/companies/(\d+)/",
    "tawk_ids": r"embed\.tawk\.to/([a-f0-9]{20,})",
    "intercom_app_ids": r"app_id\s*:\s*[\"']([a-z0-9]{6,})[\"']|widget\.intercom\.io/widget/([a-z0-9]+)",
    "drift_ids": r"drift\.load\(\s*['\"]([a-z0-9]+)['\"]",
    "tidio_keys": r"code\.tidio\.co/([a-z0-9]+)\.js",
    "cookiebot_ids": r"data-cbid=[\"']([0-9a-f-]{36})",
    "onetrust_ids": r"data-domain-script=[\"']([0-9a-f-]{36}[^\"']*)",
    "recaptcha_site_keys": r"recaptcha/api\.js\?render=([\w-]{30,})|data-sitekey=[\"']([\w-]{30,})",
}
VENDOR_HOSTS = {
    "google_analytics": r"google-analytics\.com|googletagmanager\.com/gtag|analytics\.google\.com",
    "google_tag_manager": r"googletagmanager\.com/gtm\.js",
    "google_ads": r"googleadservices\.com|googlesyndication\.com|doubleclick\.net",
    "meta": r"connect\.facebook\.net|facebook\.com/tr",
    "tiktok": r"analytics\.tiktok\.com",
    "linkedin": r"snap\.licdn\.com|px\.ads\.linkedin\.com",
    "pinterest": r"s\.pinimg\.com/ct|ct\.pinterest\.com",
    "snap": r"sc-static\.net/scevent|tr\.snapchat\.com",
    "microsoft_ads": r"bat\.bing\.com",
    "session_replay": r"hotjar\.com|clarity\.ms|fullstory\.com|mouseflow\.com|luckyorange\.com|smartlook\.com|logrocket\.com|inspectlet\.com|contentsquare\.net|posthog\.com",
    "cmp": r"consent\.cookiebot\.com|cdn\.cookielaw\.org|usercentrics\.eu|cookieyes\.com|complianz|termly\.io|osano\.com|iubenda\.com|didomi\.io|quantcast\.mgr\.consensu\.org|trustarc\.com|klaro|axeptio|tarteaucitron|cookie-script\.com|cookiefirst\.com|consentmanager\.net",
    "consent_mode": r"gtag\(\s*['\"]consent['\"]|[\"']consent[\"']\s*,\s*[\"']default[\"']",
    "chat_widgets": r"embed\.tawk\.to|widget\.intercom\.io|js\.driftt\.com|code\.tidio\.co|cdn\.livechatinc\.com|client\.crisp\.chat|js\.hs-scripts\.com|podium\.com|birdeye\.com|smith\.ai|voiceflow\.com|botpress\.cloud|chatbot\.com|kommunicate\.io|zendesk\.com/embeddable|apps\.elfsight\.com",
    "call_tracking": r"cdn\.callrail\.com|calltrackingmetrics\.com|whatconverts\.com|callsource\.com|invoca\.net|ringba\.com|marchex\.com",
    "review_widgets": r"widget\.trustpilot\.com|cdn\.trustindex\.io|apps\.elfsight\.com|birdeye\.com|podium\.com|yotpo\.com|judge\.me|reviews\.io|feefo\.com|reviewbuzz|nicejob\.com|gatherup\.com|reputation\.com|widgets\.reviews\.co\.uk",
    "affiliate_networks": r"shareasale\.com|impact\.com|cj\.com|awin1\.com|rakutenmarketing|partnerize|clickbank",
    "recaptcha_or_turnstile": r"recaptcha|challenges\.cloudflare\.com/turnstile|hcaptcha\.com",
}

def find_tags(blob):
    out = {}
    for k, rx in TAGS.items():
        ids = set()
        for m in re.finditer(rx, blob, re.I):
            for g in m.groups():
                if g: ids.add(g)
        if ids: out[k] = sorted(ids)
    vendors = {k: bool(re.search(rx, blob, re.I)) for k, rx in VENDOR_HOSTS.items()}
    out["vendors_present"] = sorted(k for k, v in vendors.items() if v)
    return out

# ---------------------------------------------------------------- disclosure packs (visible text + hrefs)
DISCLOSURES = {
    "privacy_policy_link": r"href=[\"']([^\"']*(privacy|datenschutz|confidentialit|privacidad)[^\"']*)",
    "terms_link": r"href=[\"']([^\"']*(terms|agb|conditions|condiciones|termini)[^\"']*)",
    "refund_return_link": r"href=[\"']([^\"']*(refund|return|cancellation|widerruf|rembours)[^\"']*)",
    "cookie_policy_link": r"href=[\"']([^\"']*cookie[^\"']*)",
    "accessibility_statement_link": r"href=[\"']([^\"']*(accessibilit|barrierefrei)[^\"']*)",
    "legal_notice_link": r"href=[\"']([^\"']*(impressum|imprint|mentions-legales|mentions_legales|aviso-legal|note-legali|colofon|legal-notice|legal-info)[^\"']*)",
    "ccpa_link_text": r"(Do Not Sell(?: or Share)? My Personal Information|Your Privacy Choices|Your California Privacy Rights)",
    "consumer_health_data_link_text": r"(Consumer Health Data(?: Privacy)? (?:Policy|Notice))",
    "attorney_advertising_label": r"(Attorney Advertising|Advertising Material|Legal Advertising)",
    "prior_results_disclaimer": r"(Prior results do not guarantee(?: or predict)? a similar outcome)",
    "debt_relief_agency_statement": r"(We are a debt relief agency)",
    "choice_of_lawyer_disclaimer": r"(choice of a lawyer is an important decision)",
    "nj_supreme_court_disclaimer": r"(No aspect of this advertisement has been approved by the Supreme Court of New Jersey)",
    "quality_of_services_disclaimer": r"(No representation is made that the quality of the legal services)",
    "supplement_disclaimer": r"(These statements have not been evaluated by the Food and Drug Administration)",
    "amazon_associates_statement": r"(As an Amazon Associate I earn from qualifying purchases)",
    "tpmo_medicare_disclaimer": r"(We do not offer every plan available in your area)",
    "nicotine_warning": r"(WARNING: This product contains nicotine)",
    "license_numbers": r"\b(TACL[AB]\s?\d{4,7}|M-\d{4,6}\b|TECL\s?\d{4,7}|CSLB\s?#?\s?\d{5,8}|ROC\s?#?\s?\d{5,7}|NMLS\s?(?:ID|#)?\s?:?\s?\d{4,8}|US\s?DOT\s?#?\s?:?\s?\d{5,8}|MC\s?#?\s?\d{5,8}|TPCL\s?\d{3,7}|SPCS\s?#?\s?\d{3,7}|HIC\s?#?\s?\d{4,8}|Lic(?:ense|\.)?\s?(?:No\.?|#|Number)?\s?:?\s?#?\s?[A-Z]{0,5}-?\s?\d{4,9})",
    "guarantee_language": r"([^.]{0,60}\bguarantee[sd]?\b[^.]{0,60})",
    "superlatives": r"(\B#\s?1\b|\bthe best\b|\btop[- ]rated\b|\baward[- ]winning\b|\bvoted best\b|\bbest in\b|\bleading\b)",
    "specialist_expert_claims": r"(\bspecialist[s]?\b|\bspecializ(?:e|ing)\b|\bexpert[s]?\b|\bboard[- ]certified\b|\bcertified specialist\b)",
    "partner_badge_claims": r"(Google (?:Premier )?Partner|Google[- ]Certified|Google Guaranteed|Google Screened|Meta Business Partner|Facebook Marketing Partner|Microsoft Advertising Partner|Shopify (?:Plus )?Partner|HubSpot (?:Solutions |Gold |Platinum |Diamond |Elite )?Partner|Klaviyo (?:Master |Gold |Silver |Platinum )?Partner|Semrush (?:Agency )?Partner|Amazon Ads (?:Verified |Advanced )?Partner)",
    "award_claims": r"(Top \d{1,3} (?:[A-Z][\w-]+ ){0,3}(?:Agenc\w*|Compan\w*|Firms?|SEO|Web|Marketing|Providers?|Design\w*|Lawyers?|Attorneys?|Contractors?)|Best of [A-Z]\w+|Rising Star|Super Lawyers|Best Lawyers|Inc\.? 5000|Clutch|GoodFirms|DesignRush|UpCity|Sortlist|Expertise\.com|Forbes (?:Council|Business Council|Agency Council)|Entrepreneur Leadership Network)",
    "as_seen_on": r"(As Seen On|Featured In|As Featured On)",
    "fda_claims": r"(FDA[- ](?:approved|registered|cleared|certified))",
    "tcpa_consent_language": r"(By (?:submitting|clicking|providing)[^.]{0,200}(?:consent|agree)[^.]{0,200}(?:text|SMS|call|autodial|automated|prerecorded)[^.]{0,120})",
    "not_condition_of_purchase": r"(not a condition of (?:any )?purchase)",
    "message_data_rates": r"((?:Msg|Message) (?:&|and) data rates may apply)",
    "affiliate_link_params": r"href=[\"']([^\"']*(?:[?&]tag=[\w-]+|[?&]aff(?:iliate)?(?:_id)?=|[?&]ref=[\w-]+|shareasale\.com/r\.cfm|go\.linkby|awin1\.com|\.sjv\.io|prf\.hn)[^\"']*)",
    "review_gating_markers": r"(How was your experience\?|Rate your experience|Would you recommend us|Leave us a review[^.]{0,80}(?:discount|off|gift|entry|enter to win))",
    "sentiment_conditioned_incentive": r"((?:5|five)[- ]star review[^.]{0,80}(?:\$|discount|off|free|gift|entry|win))",
    "ai_agent_markers": r"(AI (?:receptionist|assistant|agent|chatbot)|virtual (?:receptionist|assistant)|chat with (?:our|an?) (?:AI|bot|assistant))",
    "eu_company_identifiers": r"\b(HRB\s?\d{3,7}|HRA\s?\d{3,7}|RCS\s?[A-Za-zÀ-ÿ' -]{2,30}\s?(?:B\s?)?\d{3}\s?\d{3}\s?\d{3}|SIRE[NT]\s?:?\s?\d{9,14}|Company (?:No|Number)\.?\s?:?\s?\d{6,8}|Registered in England(?: and Wales)?|CIF\s?:?\s?[A-Z]\d{7}[A-Z0-9]|NIF\s?:?\s?[A-Z0-9]\d{7}[A-Z0-9]|P\.?\s?IVA\s?:?\s?\d{11}|KvK\s?:?\s?\d{8}|CVR\s?:?\s?\d{8})",
    "vat_ids": r"\b((?:DE|GB|FR|ES|IT|NL|BE|AT|IE|SE|DK|FI|PL|PT|CZ)\s?\d{8,12}[A-Z]?)\b|\bUSt\.?-?\s?Id(?:Nr)?\.?\s?:?\s?(DE\s?\d{9})",
    "copyright_years": r"(?:©|&copy;|Copyright)\s?(?:\(c\)\s?)?(\d{4})",
}

def disclosures(html, text):
    out = {}
    for k, rx in DISCLOSURES.items():
        src = html if ("link" in k or "params" in k) else text
        hits = []
        for m in re.finditer(rx, src, re.I):
            g = next((x for x in m.groups() if x), m.group(0)); g = re.sub(r"\s+", " ", g).strip()
            if g and g not in hits: hits.append(g[:200])
            if len(hits) >= 12: break
        if hits: out[k] = hits
    return out

# ---------------------------------------------------------------- JSON-LD, apps, socials, phones, footer
def jsonld(html):
    blocks = re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.S | re.I)
    types, flags, entities = [], [], []
    def walk(n):
        if isinstance(n, list): [walk(x) for x in n]; return
        if not isinstance(n, dict): return
        t = n.get("@type")
        if t:
            t = t if isinstance(t, str) else "/".join(map(str, t)); types.append(t)
            if any(k in n for k in ("aggregateRating", "review")) and re.search(r"Organization|Business|Service|Attorney|Dentist|Plumber|Store|Corporation", t):
                flags.append(f"self-serving aggregateRating/review on {t}")
            if re.search(r"Organization|Business|Service|Attorney|Dentist|Plumber|Store|Corporation", t):
                entities.append({"type": t, "name": n.get("name"), "telephone": n.get("telephone"), "sameAs": n.get("sameAs"),
                                 "address": n.get("address") if isinstance(n.get("address"), (str, dict)) else None})
        for v in n.values():
            if isinstance(v, (dict, list)): walk(v)
    errors = 0
    for b in blocks:
        try: walk(json.loads(b.strip().lstrip("﻿")))
        except Exception: errors += 1
    return {"blocks": len(blocks), "parse_errors": errors, "types": sorted(set(types)), "flags": flags, "entities": entities[:6]}

def app_discovery(html, host):
    out = {"ios_ids": sorted(set(re.findall(r"apps\.apple\.com/[a-z]{2}/app/[^\"'\s]*?id(\d{6,12})", html) +
                                 re.findall(r"apple-itunes-app[^>]*app-id=(\d{6,12})", html))),
           "android_packages": sorted(set(re.findall(r"play\.google\.com/store/apps/details\?id=([\w.]+)", html)))}
    for path, key in (("/.well-known/apple-app-site-association", "aasa"), ("/.well-known/assetlinks.json", "assetlinks")):
        m, body = get(f"https://{host}{path}", accept="application/json,*/*", referer=False, footprints=False)
        if m.get("tier") == "RAW" and body.strip().startswith(("{", "[")):
            try:
                j = json.loads(body); out[key] = "present"
                if key == "aasa": out["aasa_app_ids"] = sorted(set(re.findall(r'"appIDs?"\s*:\s*\[?\s*"([A-Z0-9]{10}\.[\w.-]+)', body)))[:10]
                else: out["assetlinks_packages"] = sorted({x.get("target", {}).get("package_name") for x in j if isinstance(x, dict) and x.get("target", {}).get("package_name")})
            except Exception: out[key] = "present-unparsable"
        else: out[key] = f"absent ({m.get('status')})"
    return out

SOCIAL = r"https?://(?:www\.)?(facebook\.com/[^\"'/?#\s]+|instagram\.com/[^\"'/?#\s]+|linkedin\.com/(?:company|in)/[^\"'/?#\s]+|tiktok\.com/@[^\"'/?#\s]+|youtube\.com/(?:@|channel/|c/|user/)[^\"'/?#\s]+|(?:x|twitter)\.com/[^\"'/?#\s]+|pinterest\.com/[^\"'/?#\s]+|yelp\.com/biz/[^\"'/?#\s]+|g\.page/[^\"'/?#\s]+|maps\.app\.goo\.gl/[^\"'/?#\s]+|threads\.net/@[^\"'/?#\s]+)"
def socials(html):
    skip = re.compile(r"facebook\.com/(sharer|share|plugins|dialog|tr$)|(x|twitter)\.com/(intent|share)|pinterest\.com/pin/create|linkedin\.com/(share|cws)", re.I)
    return sorted({h for h in re.findall(SOCIAL, html, re.I) if not skip.search(h)})[:30]

def phones(html, text):
    tel = sorted({re.sub(r"[^\d+]", "", t) for t in re.findall(r"href=[\"']tel:([^\"']+)", html, re.I)})
    seen = sorted({re.sub(r"\D", "", p)[-10:] for p in re.findall(r"(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)", text)})
    return {"tel_hrefs": tel[:20], "distinct_numbers_in_text": seen[:20], "distinct_count": len(seen)}

def footer(html, host):
    foots = re.findall(r"(?is)<footer\b.*?</footer>", html)
    f = foots[-1] if foots else html[-6000:]
    txt = re.sub(r"\s+", " ", visible_text(f)).strip()
    credits = [re.sub(r"\s+", " ", m).strip()[:160] for m in re.findall(r"((?:Powered|Designed|Developed|Built|Created|Marketing|Web ?Design|SEO|Website|Site) by[^.|<]{2,80})", txt, re.I)]
    out_links = []
    for href, anchor in re.findall(r'<a[^>]+href=["\'](https?://[^"\']+)["\'][^>]*>(.*?)</a>', f, re.S | re.I):
        h = urllib.parse.urlparse(href).netloc.lower()
        if h and host.lower().replace("www.", "") not in h and not re.search(SOCIAL, href, re.I):
            anchor = re.sub(r"<[^>]+>|\s+", " ", anchor).strip()[:80]
            img_alt = re.search(r'alt=["\']([^"\']+)', anchor)
            out_links.append({"href": href[:200], "anchor": anchor or "(image/no text)"})
    return {"footer_text_tail": txt[-400:], "credits": credits[:6], "external_footer_links": out_links[:25]}

def robots_posture(host):
    m, txt = get(f"https://{host}/robots.txt", kind="robots")
    if m.get("tier") != "RAW": return {"status": m.get("status"), "tier": m.get("tier")}
    groups = re.findall(r"(?im)^\s*user-agent:\s*(\S+)", txt)
    adsbot = bool(re.search(r"(?is)user-agent:\s*adsbot-google.*?disallow:\s*/\s*$", txt, re.M))
    ai = {b: ("named" if re.search(rf"(?i)user-agent:\s*{re.escape(b)}", txt) else "not named")
          for b in ("GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot", "Applebot-Extended", "Bytespider", "OAI-SearchBot")}
    return {"status": 200, "user_agents": sorted(set(groups))[:20], "adsbot_google_named_disallow_root": adsbot,
            "sitemaps": re.findall(r"(?im)^\s*sitemap:\s*(\S+)", txt)[:10], "ai_bots": ai, "length": len(txt)}

def ads_txt(host):
    out = {}
    for path in ("/ads.txt", "/app-ads.txt"):
        m, txt = get(f"https://{host}{path}", referer=False, footprints=False)
        if m.get("tier") == "RAW" and re.search(r"(?m)^[\w.-]+,\s*[\w-]+,\s*(DIRECT|RESELLER)", txt, re.I):
            lines = [l for l in txt.splitlines() if re.match(r"^[\w.-]+,", l.strip())]
            out[path] = {"lines": len(lines), "resellers": sum(1 for l in lines if "RESELLER" in l.upper()), "direct": sum(1 for l in lines if "DIRECT" in l.upper())}
        else: out[path] = f"absent ({m.get('status')})"
    return out

def gtm_expand(ids, page_url=None):
    out = {}
    for gid in ids:   # fetched the way the page itself loads it: a cross-site script request carrying the page as Referer
        m, js = get(f"https://www.googletagmanager.com/gtm.js?id={gid}", kind="script", referer=page_url)
        if m.get("tier") != "RAW" or len(js) < 2000:
            out[gid] = {"status": m.get("status"), "note": "container not fetchable or empty (unpublished / restricted)"}; continue
        t = find_tags(js)
        templates = sorted(set(re.findall(r'"vtp_(?:pixelId|conversionId|trackingId|measurementId|tagId|partnerId|hjid|siteId|portalId|accountId)"\s*:\s*"([^"]{4,40})"', js)))
        vendors = sorted(set(re.findall(r'https?://(?:www\.)?([a-z0-9.-]+\.(?:com|net|io|co|ai|ms|eu))/', js)))
        out[gid] = {"bytes": len(js), "tags": t, "template_ids": templates[:40], "vendor_hosts": vendors[:60],
                    "tag_count_estimate": len(re.findall(r'"function":"__', js))}
    return out

def cloaking_diff(url, browser_meta=None, browser_html=None):
    """Browser arm = the wetware fetch already made for the page (no second human request); the Googlebot and AdsBot
    arms are explicit crawler identities — the run's ONLY non-human requests, opt-in, target's own pages only."""
    rows = {}
    if browser_meta is None: browser_meta, browser_html = get(url)
    arms = [("browser", None, browser_meta, browser_html)]
    for name, ua in (("googlebot", UA_GOOGLEBOT), ("adsbot", UA_ADSBOT)):
        m, html = get(url, ua=ua, footprints=False); arms.append((name, ua, m, html))
    for name, ua, m, html in arms:
        txt = visible_text(html)[:20000]
        t = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
        rows[name] = {"status": m.get("status"), "tier": m.get("tier"), "final_url": m.get("final_url"), "bytes": m.get("bytes"), "identity": (ua or m.get("presence", {}).get("identity")),
                      "title": htmlmod.unescape(re.sub(r"\s+", " ", t.group(1)).strip())[:150] if t else None, "_txt": txt}
    b = rows["browser"]; verdict = []
    for k in ("googlebot", "adsbot"):
        r = rows[k]
        if b["tier"] != "RAW" or r["tier"] != "RAW":
            r["similarity"] = None; r["reading"] = f"NOT_TESTED ({b['tier']} vs {r['tier']})"; continue
        sim = round(difflib.SequenceMatcher(None, b["_txt"], r["_txt"]).ratio(), 3); r["similarity"] = sim
        host_b = urllib.parse.urlparse(b["final_url"] or "").netloc; host_r = urllib.parse.urlparse(r["final_url"] or "").netloc
        if b["status"] != r["status"] or host_b != host_r: r["reading"] = "DIFFERENT status/host — CANDIDATE cloaking (deterministic if confirmed on re-fetch)"
        elif sim < 0.85 and (b["title"] != r["title"]): r["reading"] = "materially different body and title — CANDIDATE cloaking"
        elif sim < 0.85: r["reading"] = "body differs (dynamic/personalised content?) — CANDIDATE, re-fetch twice"
        else: r["reading"] = "consistent"
        if "CANDIDATE" in r["reading"]: verdict.append(k)
    for r in rows.values(): r.pop("_txt", None)
    rows["verdict"] = "CANDIDATE cloaking vs " + ", ".join(verdict) if verdict else ("consistent across UAs" if b["tier"] == "RAW" else "NOT_TESTED")
    return rows

# ---------------------------------------------------------------- scan driver
def scan(urls, out, do_cloak, do_gtm):
    os.makedirs(out, exist_ok=True); summary, matrix, discl = [], [], []
    hosts_done = {}
    for u in urls:
        u = u if "://" in u else "https://" + u
        meta, html = get(u)
        host = urllib.parse.urlparse(meta.get("final_url") or u).netloc
        rec = {"meta": meta}
        if meta.get("tier") == "RAW":
            text = visible_text(html)
            t = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
            rec["facts"] = {"title": htmlmod.unescape(re.sub(r"\s+", " ", t.group(1)).strip()) if t else None,
                            "meta_description": (re.search(r'<meta[^>]+name=["\']description["\'][^>]*content=["\']([^"\']*)', html, re.I) or [None, None])[1],
                            "canonical": (re.search(r'<link[^>]+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)', html, re.I) or [None, None])[1],
                            "generator": (re.search(r'<meta[^>]+name=["\']generator["\'][^>]*content=["\']([^"\']*)', html, re.I) or [None, None])[1],
                            "viewport": bool(re.search(r'<meta[^>]+name=["\']viewport', html, re.I)),
                            "robots_meta": re.findall(r'<meta[^>]+name=["\']robots["\'][^>]*content=["\']([^"\']*)', html, re.I),
                            "hreflang_count": len(re.findall(r"hreflang=", html, re.I)), "lang": (re.search(r'<html[^>]+lang=["\']([^"\']+)', html, re.I) or [None, None])[1],
                            "words": len(text.split()), "html_bytes": len(html.encode("utf-8", "replace"))}
            rec["tags"] = find_tags(html)
            rec["set_cookie_on_get"] = bool(meta.get("headers", {}).get("set-cookie"))
            rec["cache_headers"] = {k: v for k, v in meta.get("headers", {}).items() if k in ("cache-control", "x-cache", "cf-cache-status", "age", "x-proxy-cache", "sg-f-cache", "x-cacheable", "server", "x-powered-by", "strict-transport-security", "content-security-policy", "x-frame-options")}
            rec["disclosures"] = disclosures(html, text)
            rec["jsonld"] = jsonld(html)
            rec["socials"] = socials(html)
            rec["phones"] = phones(html, text)
            rec["footer"] = footer(html, host)
            rec["text_excerpt"] = text[:1500]
            if do_gtm and rec["tags"].get("gtm_ids"): rec["gtm_containers"] = gtm_expand(rec["tags"]["gtm_ids"], page_url=meta.get("final_url") or u)
            if do_cloak: rec["cloaking"] = cloaking_diff(u, meta, html)
            if host not in hosts_done:
                hosts_done[host] = {"robots": robots_posture(host), "ads_txt": ads_txt(host), "apps": app_discovery(html, host)}
            rec["host_level"] = hosts_done[host]
            with open(os.path.join(out, slug(u) + ".txt"), "w") as fh: fh.write(text)
        s = slug(u); json.dump(rec, open(os.path.join(out, s + ".web.json"), "w"), indent=1, default=str)
        with open(os.path.join(out, s + ".html"), "w") as fh: fh.write(html)
        tags = rec.get("tags", {})
        summary.append({"url": u, "final_url": meta.get("final_url"), "status": meta.get("status"), "tier": meta.get("tier"), "ttfb": meta.get("ttfb"), "presence": meta.get("presence", {}).get("identity"),
                        "title": rec.get("facts", {}).get("title"), "generator": rec.get("facts", {}).get("generator"),
                        "gtm": " ".join(tags.get("gtm_ids", [])), "ga4": " ".join(tags.get("ga4_ids", [])), "google_ads": " ".join(tags.get("google_ads_ids", [])),
                        "meta_pixel": " ".join(tags.get("meta_pixel_ids", [])), "vendors": " ".join(tags.get("vendors_present", [])),
                        "cmp_present": "cmp" in tags.get("vendors_present", []), "consent_mode": "consent_mode" in tags.get("vendors_present", []),
                        "set_cookie_on_get": rec.get("set_cookie_on_get"), "jsonld_types": " ".join(rec.get("jsonld", {}).get("types", [])),
                        "jsonld_flags": " | ".join(rec.get("jsonld", {}).get("flags", [])), "cloaking": rec.get("cloaking", {}).get("verdict"),
                        "privacy_link": bool(rec.get("disclosures", {}).get("privacy_policy_link")), "legal_notice_link": bool(rec.get("disclosures", {}).get("legal_notice_link")),
                        "ccpa_link": bool(rec.get("disclosures", {}).get("ccpa_link_text")), "distinct_phones": rec.get("phones", {}).get("distinct_count"),
                        "footer_credits": " | ".join(rec.get("footer", {}).get("credits", [])), "fetched_at": meta.get("fetched_at")})
        for k, v in tags.items():
            if k != "vendors_present":
                for i in v: matrix.append({"url": u, "tag_family": k, "id": i, "source": "page"})
        for gid, g in rec.get("gtm_containers", {}).items():
            for k, v in g.get("tags", {}).items():
                if k != "vendors_present":
                    for i in v: matrix.append({"url": u, "tag_family": k, "id": i, "source": f"gtm:{gid}"})
        for k, v in rec.get("disclosures", {}).items():
            for i in v: discl.append({"url": u, "pack": k, "hit": i})
        print(f"{meta.get('tier'):10} {meta.get('status')!s:>3} {u}  tags={len([x for x in tags if x!='vendors_present'])} vendors={len(tags.get('vendors_present', []))} cloak={rec.get('cloaking', {}).get('verdict', '-')}")
    for name, rows in (("web_summary.csv", summary), ("tags_matrix.csv", matrix), ("disclosures.csv", discl)):
        if rows:
            with open(os.path.join(out, name), "w", newline="") as fh:
                w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    print(f"wrote {len(summary)} pages -> {out}")

# ---------------------------------------------------------------- rdap / dns
def rdap(domains, out):
    rows = []
    for d in domains:
        d = d.lower().replace("https://", "").replace("http://", "").split("/")[0].removeprefix("www.")
        m, body = get(f"https://rdap.org/domain/{d}", kind="api", accept="application/rdap+json,application/json,*/*")
        row = {"domain": d, "status": m.get("status")}
        if m.get("tier") == "RAW":
            try:
                j = json.loads(body)
                for ev in j.get("events", []): row[ev.get("eventAction", "").replace(" ", "_")] = ev.get("eventDate")
                row["nameservers"] = " ".join(n.get("ldhName", "") for n in j.get("nameservers", []))
                row["registrar"] = next((e.get("vcardArray", [None, []])[1][1][3] if len(e.get("vcardArray", [None, []])[1]) > 1 else e.get("handle") for e in j.get("entities", []) if "registrar" in e.get("roles", [])), None)
                for e in j.get("entities", []):
                    roles = ",".join(e.get("roles", [])); vc = e.get("vcardArray", [None, []])[1]
                    org = next((x[3] for x in vc if x and x[0] == "org"), None); fn = next((x[3] for x in vc if x and x[0] == "fn"), None)
                    if org or fn: row[f"entity[{roles}]"] = (org or fn)
                    for sub in e.get("entities", []):
                        vc2 = sub.get("vcardArray", [None, []])[1]; org2 = next((x[3] for x in vc2 if x and x[0] == "org"), None)
                        if org2: row[f"entity[{roles}>{','.join(sub.get('roles', []))}]"] = org2
                row["rdap_status"] = " ".join(j.get("status", []))
            except Exception as e: row["error"] = str(e)[:120]
        rows.append(row); print(row)
    if out:
        os.makedirs(out, exist_ok=True); keys = sorted({k for r in rows for k in r}, key=lambda k: (k != "domain", k))
        with open(os.path.join(out, "rdap.csv"), "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=keys); w.writeheader(); w.writerows(rows)

def doh(name, rtype):
    for base, hdr in (("https://cloudflare-dns.com/dns-query", "application/dns-json"), ("https://dns.google/resolve", "application/json")):
        m, body = get(f"{base}?name={urllib.parse.quote(name)}&type={rtype}", kind="api", accept=hdr)
        if m.get("tier") == "RAW":
            try: return [a.get("data", "") for a in json.loads(body).get("Answer", [])]
            except Exception: pass
    return None

def dns(domains, out):
    rows = []
    for d in domains:
        d = d.lower().replace("https://", "").replace("http://", "").split("/")[0].removeprefix("www.")
        txt = doh(d, "TXT") or []; dmarc = doh("_dmarc." + d, "TXT") or []; mx = doh(d, "MX") or []
        spf = [t for t in txt if "v=spf1" in t.lower()]; dm = [t for t in dmarc if "v=dmarc1" in t.lower()]
        pol = re.search(r"p=(none|quarantine|reject)", " ".join(dm), re.I)
        rows.append({"domain": d, "spf": spf[0][:200] if spf else "absent", "dmarc": dm[0][:200] if dm else "absent",
                     "dmarc_policy": pol.group(1).lower() if pol else ("absent" if not dm else "unparsed"), "mx": " ".join(mx)[:200] or "absent",
                     "reading": ("no DMARC — bulk-sender requirements unmet" if not dm else ("DMARC p=none — monitoring only" if pol and pol.group(1).lower() == "none" else "DMARC enforcing"))})
        print(rows[-1])
    if out:
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, "dns.csv"), "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("scan", "rdap", "dns"):
        sp = sub.add_parser(name)
        sp.add_argument("urls" if name == "scan" else "domains", nargs="+"); sp.add_argument("--out", default=("omega_cache/run/web" if name == "scan" else None))
        sp.add_argument("--cache", default=None, help="wetware cache dir (default: parent of --out, else omega_cache/run)")
        sp.add_argument("--tempo", default="human", choices=["human", "brisk"]); sp.add_argument("--no-assets", action="store_true"); sp.add_argument("--locale", default="en-US")
        sp.add_argument("--legacy-persona", "--persona", dest="legacy_persona", action="store_true", help="use the old human-presence persona instead of the honest declared UA (UltimaWeapon defaults to honest)")
        sp.add_argument("--ua", default=None, help="declared User-Agent for honest mode (else MO_USER_AGENT or the default)")
        sp.add_argument("--min-interval", type=float, default=None, help="honest mode: min seconds between requests to one host (default 2.0)")
        sp.add_argument("--ignore-robots", action="store_true", help="honest mode: do NOT obey robots.txt (logged; default is to obey)")
        if name == "scan":
            sp.add_argument("--cloak", action="store_true", help="Googlebot/AdsBot cloaking diff — persona mode only; ignored in honest mode")
            sp.add_argument("--no-cloak", action="store_true", help="(default; kept for old command lines)"); sp.add_argument("--no-gtm", action="store_true")
            sp.add_argument("--sleep", type=float, default=None, help="ignored: pacing is wetware's")
    a = ap.parse_args()
    cache = a.cache or (os.path.dirname(os.path.abspath(a.out.rstrip("/"))) if a.out else "omega_cache/run")
    honest = not a.legacy_persona
    open_session(cache, locale=a.locale, tempo=a.tempo, assets=not a.no_assets,
                 honest=honest, declared_ua=a.ua, obey_robots=not a.ignore_robots, min_interval=a.min_interval)
    do_cloak = getattr(a, "cloak", False)
    if honest and do_cloak:
        print("note: --cloak (Googlebot/AdsBot arms) impersonates trusted crawlers and is disabled in honest mode; use --legacy-persona if you need it.", file=sys.stderr)
        do_cloak = False
    try:
        if a.cmd == "scan": scan(a.urls, a.out, do_cloak, not a.no_gtm)
        elif a.cmd == "rdap": rdap(a.domains, a.out)
        else: dns(a.domains, a.out)
    finally: WW.close()

if __name__ == "__main__": main()
