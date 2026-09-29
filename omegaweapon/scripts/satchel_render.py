#!/usr/bin/env python3
"""UltimaWeapon / EmergencySatchel — real-browser render probe (Playwright + Chromium), presented as a person's browser.

One browser session per run wearing the target's wetware persona (scripts/wetware.py): the real Chromium in its new
headless mode with the automation flag off, the persona's UA and client-hint metadata, locale, timezone, viewport,
screen, DPR, hardware and WebGL story, retail-Chrome codec answers; the persona's cookie jar is NOT replayed into the
browser (a render is a fresh visit) and no human verification is ever clicked. Records: every request the page makes
BEFORE any interaction (the pre-consent firing log), then after a person-like settle (a beat, mouse travel, a few
scroll steps); consent-banner presence (known CMP roots + text heuristics) and whether a reject control is as visible
as accept; tracker classification by vendor; pre-checked checkboxes; scarcity / countdown strings and a reload test
for timer resets; chat / AI-agent widgets; a full-page screenshot. If a HUMAN verification appears (Turnstile
checkbox, hCaptcha, reCAPTCHA challenge, "verify you are human") the URL is NOT_TESTED and nothing is clicked. Runs
only against the target's own web properties — never against ad libraries or platform surfaces. Residual tell: the
CDP session itself is detectable by DataDome-class scripts; the probe is three pages per target, not a crawl.

Usage
  python3 satchel_render.py --out omega_cache/<domain>/render [--cache omega_cache/<domain>] [--locale de-DE] [--wait 6] [--no-scroll] [--axe axe.min.js] URL...
Outputs <slug>.render.json, <slug>.png and render_summary.csv. Needs: pip install playwright (Chromium at
PLAYWRIGHT_BROWSERS_PATH or the default install; run `playwright install chromium` on your own machine).
"""
import argparse, csv, json, os, random, re, sys, time, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wetware

TRACKERS = {
    "google_analytics": r"google-analytics\.com|analytics\.google\.com|googletagmanager\.com/gtag|/g/collect|/collect\?v=2",
    "google_tag_manager": r"googletagmanager\.com/gtm\.js",
    "google_ads_doubleclick": r"googleadservices\.com|googlesyndication\.com|doubleclick\.net|google\.com/pagead|googleads\.g\.doubleclick",
    "meta_pixel": r"connect\.facebook\.net|facebook\.com/tr",
    "tiktok_pixel": r"analytics\.tiktok\.com",
    "linkedin_insight": r"snap\.licdn\.com|px\.ads\.linkedin\.com",
    "pinterest_tag": r"ct\.pinterest\.com|s\.pinimg\.com/ct",
    "snap_pixel": r"sc-static\.net/scevent|tr\.snapchat\.com",
    "microsoft_uet": r"bat\.bing\.com",
    "reddit_pixel": r"alb\.reddit\.com|redditstatic\.com/ads",
    "x_pixel": r"static\.ads-twitter\.com|analytics\.twitter\.com",
    "session_replay": r"hotjar\.com|clarity\.ms|fullstory\.com|mouseflow\.com|luckyorange\.com|smartlook\.com|logrocket\.com|inspectlet\.com|contentsquare\.net|posthog\.com|heap(?:analytics)?\.com",
    "hubspot": r"hs-scripts\.com|hs-analytics\.net|hsforms\.net|hubspot\.com",
    "call_tracking": r"callrail\.com|calltrackingmetrics\.com|whatconverts\.com|invoca\.net|ringba\.com|marchex\.com",
    "chat_or_ai_widget": r"tawk\.to|intercom\.io|driftt\.com|tidio\.co|livechatinc\.com|crisp\.chat|podium\.com|birdeye\.com|smith\.ai|voiceflow\.com|botpress\.cloud|chatbot\.com|kommunicate\.io|zdassets\.com|elfsight\.com",
    "cmp": r"cookiebot\.com|cookielaw\.org|usercentrics\.eu|cookieyes\.com|complianz|termly\.io|osano\.com|iubenda\.com|didomi\.io|consensu\.org|trustarc\.com|axeptio|tarteaucitron|cookie-script\.com|cookiefirst\.com|consentmanager\.net",
    "other_adtech": r"criteo\.(?:com|net)|taboola\.com|outbrain\.com|adroll\.com|adnxs\.com|rubiconproject\.com|pubmatic\.com|openx\.net|amazon-adsystem\.com|casalemedia\.com|bidswitch\.net|quantserve\.com|scorecardresearch\.com|demdex\.net|krxd\.net|bluekai\.com|liadm\.com|id5-sync\.com|rlcdn\.com",
}
CMP_SELECTORS = ["#CybotCookiebotDialog", "#onetrust-banner-sdk", "#onetrust-consent-sdk", ".cky-consent-container", "#usercentrics-root",
                 ".cmplz-cookiebanner", "#termly-code-snippet-support", ".osano-cm-window", "#iubenda-cs-banner", "#didomi-host", ".qc-cmp2-container",
                 "#truste-consent-track", ".cc-window", "#axeptio_overlay", "#tarteaucitronRoot", "#cookie-law-info-bar", ".moove-gdpr-info-bar-container",
                 "#cookiescript_injected", ".cookiefirst-root", "#cmpbox", "[id*='cookie-banner']", "[class*='cookie-banner']", "[id*='consent-banner']", "[class*='consent-banner']", "[aria-label*='cookie' i]", "[aria-label*='consent' i]"]
HUMAN_CHALLENGE = re.compile(r"verify you are human|are you a robot|hcaptcha|g-recaptcha|challenges\.cloudflare\.com/turnstile|cf-turnstile|Please complete the security check", re.I)
CHALLENGE_TITLES = re.compile(r"Just a moment|Robot Challenge|Attention Required|Access Denied|Pardon Our Interruption", re.I)

def classify(url):
    return [k for k, rx in TRACKERS.items() if re.search(rx, url, re.I)]

def slug(url):
    p = urllib.parse.urlparse(url if "://" in url else "https://" + url)
    return re.sub(r"[^A-Za-z0-9._-]+", "_", (p.netloc + p.path + ("?" + p.query if p.query else "")).strip("/"))[:150] or "root"

def probe(pw, url, out, locale, wait, do_scroll, axe_path, persona, rng, honest=False, declared_ua=None):
    from playwright.sync_api import TimeoutError as PWTimeout
    if honest:
        browser, ctx = wetware.render_launch_honest(pw, declared_ua, locale=locale); page = ctx.new_page()
    else:
        browser, ctx = wetware.render_launch(pw, persona, locale=locale); page = wetware.render_page(ctx, persona)
    reqs = []; t0 = time.time(); phase = {"p": "pre-interaction"}
    page.on("request", lambda r: reqs.append({"t": round(time.time() - t0, 3), "phase": phase["p"], "url": r.url[:300], "type": r.resource_type, "trackers": classify(r.url)}))
    ident = declared_ua if honest else persona.label
    rec = {"url": url, "locale": locale, "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "presence": {"identity": ident, "timezone": (None if honest else persona.timezone), "viewport": (None if honest else persona.viewport),
                        "engine": ("chromium (headless; honest: declared UA, no stealth, webdriver flag left true)" if honest else "chromium (new headless, wetware context)")}}
    try:
        resp = page.goto(url, wait_until="load", referer=(None if honest else ("https://www.google.com/" if rng.random() < persona.entry_google_share else None)), timeout=45000)
        rec["status"] = resp.status if resp else None; rec["final_url"] = page.url
    except PWTimeout:
        rec["status"] = None; rec["final_url"] = page.url; rec["note"] = "load timeout — partial log"
    except Exception as e:
        rec["status"] = None; rec["error"] = str(e)[:200]; browser.close(); return rec
    page.wait_for_timeout(int(wait * 1000 * rng.uniform(0.85, 1.25)))
    html = page.content(); title = page.title()
    rec["title"] = title[:200]
    if CHALLENGE_TITLES.search(title) or CHALLENGE_TITLES.search(html[:5000]):
        page.wait_for_timeout(7000); html = page.content(); title = page.title(); rec["title"] = title[:200]
        rec["js_challenge"] = "settled" if not CHALLENGE_TITLES.search(title) else "did not settle"
    if HUMAN_CHALLENGE.search(html[:200000]) and (rec.get("js_challenge") == "did not settle" or CHALLENGE_TITLES.search(title)):
        rec["tier"] = "NOT_TESTED (human verification)"; page.screenshot(path=os.path.join(out, slug(url) + ".png")); browser.close(); return rec
    rec["tier"] = "RENDERED"
    # consent banner
    banner = None
    for sel in CMP_SELECTORS:
        try:
            el = page.query_selector(sel)
            if el and el.is_visible(): banner = sel; break
        except Exception: pass
    btn_texts = []
    try:
        for b in page.query_selector_all("button, a[role=button], [role=button], input[type=submit]")[:200]:
            try:
                if b.is_visible():
                    t = (b.inner_text() or b.get_attribute("value") or "").strip()
                    if t: btn_texts.append(t[:40])
            except Exception: pass
    except Exception: pass
    accept = [t for t in btn_texts if re.search(r"^(accept|agree|allow|ok|got it|i understand|akzeptieren|alle akzeptieren|accepter|aceptar|accetta|akkoord)\b", t, re.I)]
    reject = [t for t in btn_texts if re.search(r"(reject|decline|deny|refuse|only necessary|essential only|ablehnen|refuser|rechazar|rifiuta|weigeren|nur notwendige)", t, re.I)]
    text_hint = bool(re.search(r"\bcookies?\b.{0,200}\b(accept|consent|agree)\b", html, re.I | re.S))
    rec["consent_banner"] = {"cmp_root": banner, "text_hint": text_hint, "accept_controls": accept[:5], "reject_controls": reject[:5],
                             "reading": ("CMP present; reject control visible" if (banner or text_hint) and reject else ("CMP/banner present; NO visible reject control (refusal not as easy as acceptance)" if (banner or text_hint) else "no consent banner detected"))}
    pre = [r for r in reqs if r["phase"] == "pre-interaction" and r["trackers"]]
    rec["pre_consent_trackers"] = sorted({t for r in pre for t in r["trackers"] if t != "cmp"})
    rec["pre_consent_tracker_requests"] = [{"t": r["t"], "url": r["url"], "trackers": r["trackers"]} for r in pre if r["trackers"] != ["cmp"]][:60]
    # dark-pattern probes
    rec["prechecked_checkboxes"] = page.evaluate("() => Array.from(document.querySelectorAll('input[type=checkbox]:checked')).map(e => (e.name||e.id||'').slice(0,60))")[:20]
    txt = re.sub(r"<[^>]+>", " ", html); txt = re.sub(r"\s+", " ", txt)
    timers = re.findall(r"\b\d{1,2}:\d{2}(?::\d{2})?\b", txt)[:5]
    scarcity = re.findall(r"(?i)\b(only \d+ (?:left|remaining|spots?)|\d+ (?:people|others) (?:are )?(?:viewing|looking)|limited time|offer ends|hurry)\b", txt)[:8]
    rec["scarcity_strings"] = scarcity; rec["timer_strings_first_load"] = timers
    rec["ai_agent_markers"] = re.findall(r"(?i)\b(AI (?:receptionist|assistant|agent|chatbot)|virtual (?:receptionist|assistant)|chat with (?:our|an?) (?:AI|bot|assistant))\b", txt)[:5]
    rec["chat_iframes"] = page.evaluate("() => Array.from(document.querySelectorAll('iframe')).map(f => (f.src||'').slice(0,120)).filter(s => /tawk|intercom|drift|tidio|livechat|crisp|hubspot|podium|birdeye|smith|voiceflow|botpress|chatbot|kommunicate|zendesk|elfsight/i.test(s))")[:10]
    page.screenshot(path=os.path.join(out, slug(url) + ".png"), full_page=True)
    if do_scroll:
        phase["p"] = "post-scroll"
        if honest:   # a plain programmatic scroll to trigger lazy-loaded trackers — no simulated human mouse/behavior
            try: page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
            except Exception: pass
            page.wait_for_timeout(int(rng.uniform(1200, 2200)))
        else:
            wetware.human_settle(page, rng, scroll=True); page.wait_for_timeout(int(rng.uniform(1500, 3000)))
        post = [r for r in reqs if r["phase"] == "post-scroll" and r["trackers"]]
        rec["post_scroll_new_trackers"] = sorted({t for r in post for t in r["trackers"]} - set(rec["pre_consent_trackers"]) - {"cmp"})
    if timers:
        phase["p"] = "reload"
        try:
            page.wait_for_timeout(int(rng.uniform(1200, 2600))); page.reload(wait_until="load", timeout=45000); page.wait_for_timeout(int(wait * 1000))
            t2 = re.findall(r"\b\d{1,2}:\d{2}(?::\d{2})?\b", re.sub(r"<[^>]+>", " ", page.content()))[:5]
            rec["timer_strings_after_reload"] = t2
            rec["timer_reset_reading"] = ("timer RESET on reload — CONFIRMED-capable dark pattern (fake urgency)" if t2 and timers and t2[0] >= timers[0] else "timer continued or absent after reload")
        except Exception as e: rec["timer_reset_reading"] = f"reload failed: {str(e)[:80]}"
    if axe_path and os.path.exists(axe_path):
        try:
            page.add_script_tag(path=axe_path); res = page.evaluate("async () => await axe.run(document, {runOnly: ['wcag2a','wcag2aa','wcag21aa']})")
            rec["axe"] = {"violations": len(res.get("violations", [])), "by_impact": {}, "top": [{"id": v["id"], "impact": v.get("impact"), "nodes": len(v.get("nodes", [])), "help": v.get("help")} for v in sorted(res.get("violations", []), key=lambda v: -len(v.get("nodes", [])))[:12]]}
            for v in res.get("violations", []): rec["axe"]["by_impact"][v.get("impact")] = rec["axe"]["by_impact"].get(v.get("impact"), 0) + 1
        except Exception as e: rec["axe"] = {"error": str(e)[:120]}
    rec["request_count"] = len(reqs); rec["third_party_hosts"] = sorted({urllib.parse.urlparse(r["url"]).netloc for r in reqs if urllib.parse.urlparse(r["url"]).netloc and urllib.parse.urlparse(r["url"]).netloc.split(":")[0] != urllib.parse.urlparse(page.url).netloc})[:80]
    rec["requests"] = reqs[:400]
    browser.close(); return rec

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("urls", nargs="+"); ap.add_argument("--out", default="omega_cache/run/render"); ap.add_argument("--locale", default="en-US")
    ap.add_argument("--wait", type=float, default=6.0); ap.add_argument("--no-scroll", action="store_true"); ap.add_argument("--axe", default=None)
    ap.add_argument("--cache", default=None, help="wetware cache dir holding the target's persona (default: parent of --out)")
    ap.add_argument("--legacy-persona", "--persona", dest="legacy_persona", action="store_true", help="render behind the old human-presence persona + stealth instead of the honest declared UA (default is honest)")
    ap.add_argument("--ua", default=None, help="declared User-Agent for honest mode (else MO_USER_AGENT or the default)")
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    try: from playwright.sync_api import sync_playwright
    except ImportError: sys.exit("playwright not installed: pip install playwright (and `playwright install chromium` on your own machine)")
    honest = not a.legacy_persona
    ww = wetware.Session(a.cache or os.path.dirname(os.path.abspath(a.out.rstrip("/"))), locale=a.locale, assets=False, quiet=True, honest=honest, declared_ua=a.ua)
    persona, rng = ww.persona, random.Random(); tempo = wetware.Tempo("human", rng)
    ident = ww.declared_ua if ww.honest else persona.label
    rows = []
    with sync_playwright() as pw:
        for i, u in enumerate(a.urls):
            u = u if "://" in u else "https://" + u
            if i: time.sleep(ww.min_interval if ww.honest else tempo.dwell())   # honest: rate limit; persona: reading time
            rec = probe(pw, u, a.out, a.locale, a.wait, not a.no_scroll, a.axe, persona, rng, honest=ww.honest, declared_ua=ww.declared_ua)
            json.dump(rec, open(os.path.join(a.out, slug(u) + ".render.json"), "w"), indent=1)
            rows.append({"url": u, "status": rec.get("status"), "tier": rec.get("tier"), "presence": ident, "title": rec.get("title"), "consent": rec.get("consent_banner", {}).get("reading"),
                         "pre_consent_trackers": " ".join(rec.get("pre_consent_trackers", [])), "post_scroll_new": " ".join(rec.get("post_scroll_new_trackers", [])),
                         "prechecked": len(rec.get("prechecked_checkboxes", [])), "scarcity": " | ".join(rec.get("scarcity_strings", [])), "timer_reset": rec.get("timer_reset_reading"),
                         "ai_agent": " | ".join(rec.get("ai_agent_markers", [])), "axe_violations": (rec.get("axe") or {}).get("violations"), "requests": rec.get("request_count"), "fetched_at": rec.get("fetched_at")})
            print(f"{rec.get('tier', 'ERROR'):28} {u}  pre-consent={rows[-1]['pre_consent_trackers'] or '-'}  consent={rows[-1]['consent']}")
    with open(os.path.join(a.out, "render_summary.csv"), "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    ww.counts["render"] = len(rows); ww.close()
    print(f"wrote {len(rows)} renders -> {a.out}  (presented as {persona.label})")

if __name__ == "__main__": main()
