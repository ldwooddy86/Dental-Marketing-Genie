#!/usr/bin/env python3
"""UltimaWeapon / Justice — PageSpeed Insights runner. Needs PSI_API_KEY (free: console.cloud.google.com -> enable 'PageSpeed Insights API' -> API key).
Usage: PSI_API_KEY=... python3 scripts/justice_psi.py urls.txt --out omega_cache/<agency>/psi [--strategy mobile,desktop] [--lighthouse]
Caches raw JSON per URL+strategy (re-runs skip cached rows). Writes psi_summary.csv. --lighthouse runs local Lighthouse
(lab only) when no key is set: needs `npm i -g lighthouse` and CHROME_PATH (default /opt/pw-browsers/chromium-*/chrome-linux/chrome).
Presence: the API call carries the wetware persona (nothing self-identifies as an audit tool); local Lighthouse runs with the
persona's UA and the automation flag off. PSI's own Lighthouse run is Google's fetch of the target, not this workspace's."""
import os, sys, json, csv, time, glob, hashlib, argparse, subprocess, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wetware
WW = None
def open_session(cache):
    global WW
    if WW is None: WW = wetware.Session(cache, assets=False, quiet=True)
    return WW
API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
OPP = ["render-blocking-resources", "unused-javascript", "unused-css-rules", "legacy-javascript", "modern-image-formats", "uses-optimized-images",
       "uses-responsive-images", "offscreen-images", "uses-text-compression", "uses-long-cache-ttl", "redirects", "font-display",
       "uses-rel-preconnect", "prioritize-lcp-image", "unminified-css", "unminified-javascript", "duplicated-javascript", "efficient-animated-content"]
def cache_path(out, url, strat): return os.path.join(out, hashlib.sha1(f"{url}|{strat}".encode()).hexdigest()[:16] + f".{strat}.json")
def psi(url, strat, key):
    q = urllib.parse.urlencode({"url": url, "strategy": strat, "key": key}) + "&category=performance&category=accessibility&category=best-practices&category=seo"
    for attempt in range(4):
        m, body = WW.get(API + "?" + q, kind="api", accept="application/json", timeout=120, pace=False, footprints=False)
        if m.get("status") == 200:
            try: return json.loads(body)
            except Exception as e: return {"error": {"code": 0, "message": "unparsable PSI response: %s" % e}}
        if m.get("status") in (429, 500, 502, 503, 504) and attempt < 3: time.sleep(5 * (attempt + 1)); continue
        if m.get("status") == 0 and attempt < 3: time.sleep(5); continue
        return {"error": {"code": m.get("status"), "message": (m.get("error") or body[:400])}}
def lighthouse(url, strat):
    chrome = os.environ.get("CHROME_PATH") or (glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome") or [""])[0]
    per = WW.persona
    cmd = ["lighthouse", url, "--output=json", "--output-path=stdout", "--quiet",
           "--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-blink-features=AutomationControlled --window-size=%d,%d --lang=%s" % (per.screen[0], per.screen[1], per.locale),
           "--emulatedUserAgent=%s" % per.ua, "--only-categories=performance,accessibility,best-practices,seo"] + (["--preset=desktop"] if strat == "desktop" else [])
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=240, env={**os.environ, "CHROME_PATH": chrome})
        return {"lighthouseResult": json.loads(r.stdout), "source": "local-lighthouse"} if r.stdout.strip().startswith("{") else {"error": {"code": r.returncode, "message": r.stderr[-400:]}}
    except Exception as e: return {"error": {"code": 0, "message": str(e)}}
def num(a, k): 
    v = a.get(k, {}); return v.get("numericValue")
def summarize(url, strat, j):
    row = {"url": url, "strategy": strat, "source": j.get("source", "psi")}
    if "error" in j: row["error"] = f"{j['error'].get('code')}: {j['error'].get('message')}"; return row
    lr = j.get("lighthouseResult", {}); cats = lr.get("categories", {}); au = lr.get("audits", {})
    for c in ("performance", "accessibility", "best-practices", "seo"):
        s = cats.get(c, {}).get("score"); row[c] = round(s * 100) if s is not None else None
    row.update({"lab_lcp_ms": num(au, "largest-contentful-paint"), "lab_tbt_ms": num(au, "total-blocking-time"), "lab_cls": num(au, "cumulative-layout-shift"),
                "lab_si_ms": num(au, "speed-index"), "lab_fcp_ms": num(au, "first-contentful-paint"), "lab_ttfb_ms": num(au, "server-response-time"),
                "dom_size": num(au, "dom-size"), "total_bytes": num(au, "total-byte-weight"), "third_party_blocking_ms": num(au, "third-party-summary")})
    for scope, key in (("url", "loadingExperience"), ("origin", "originLoadingExperience")):
        le = j.get(key, {}); m = le.get("metrics", {}); row[f"field_{scope}_category"] = le.get("overall_category")
        row[f"field_{scope}_lcp_ms"] = m.get("LARGEST_CONTENTFUL_PAINT_MS", {}).get("percentile"); row[f"field_{scope}_inp_ms"] = m.get("INTERACTION_TO_NEXT_PAINT", {}).get("percentile")
        cls = m.get("CUMULATIVE_LAYOUT_SHIFT_SCORE", {}).get("percentile"); row[f"field_{scope}_cls"] = (cls / 100) if cls is not None else None
    opps = sorted([(a.get("details", {}).get("overallSavingsMs") or 0, k, a.get("title")) for k, a in au.items() if k in OPP and a.get("score") is not None and a.get("score") < 0.9], reverse=True)
    row["top_opportunities"] = " | ".join(f"{t} (~{int(s)} ms)" for s, k, t in opps[:5])
    lcp_el = au.get("largest-contentful-paint-element", {}).get("details", {}).get("items", [{}]); row["lcp_element"] = (lcp_el[0].get("items", [{}])[0].get("node", {}).get("snippet") if lcp_el and isinstance(lcp_el[0], dict) else None)
    row["runtime_error"] = (lr.get("runtimeError") or {}).get("message"); row["run_warnings"] = " | ".join(lr.get("runWarnings", []))[:300]
    row["fetched_at"] = lr.get("fetchTime"); return row
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("urls"); ap.add_argument("--out", required=True); ap.add_argument("--strategy", default="mobile,desktop"); ap.add_argument("--lighthouse", action="store_true")
    ap.add_argument("--cache", default=None, help="wetware cache dir (default: parent of --out)")
    a = ap.parse_args(); key = os.environ.get("PSI_API_KEY"); os.makedirs(a.out, exist_ok=True)
    open_session(a.cache or os.path.dirname(os.path.abspath(a.out.rstrip("/"))))
    if not key and not a.lighthouse: sys.exit("No PSI_API_KEY and --lighthouse not set: write the Verify Docket instead of numbers.")
    urls = [l.strip() for l in open(a.urls) if l.strip() and not l.startswith("#")]; rows = []
    for u in urls:
        for strat in a.strategy.split(","):
            cp = cache_path(a.out, u, strat)
            if os.path.exists(cp): j = json.load(open(cp))
            else:
                j = psi(u, strat, key) if key else lighthouse(u, strat); json.dump(j, open(cp, "w")); time.sleep(2)
            r = summarize(u, strat, j); rows.append(r); print(f"{strat:7} perf={r.get('performance')} fieldLCP={r.get('field_url_lcp_ms')} err={r.get('error') or r.get('runtime_error') or ''} {u}")
    keys = sorted({k for r in rows for k in r}, key=lambda k: (k not in ("url", "strategy", "source", "performance"), k))
    with open(os.path.join(a.out, "psi_summary.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys); w.writeheader(); w.writerows(rows)
if __name__ == "__main__":
    try: main()
    finally:
        if WW is not None: WW.close()
