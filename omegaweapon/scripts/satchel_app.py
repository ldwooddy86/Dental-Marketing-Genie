#!/usr/bin/env python3
"""UltimaWeapon / EmergencySatchel — app-store listing forensics (public endpoints only, no key, no login).

Subcommands
  lookup   --ios ID... --android PKG... [--country us] [--out DIR]
           Apple: iTunes Lookup API (seller, genre, age rating, price, ratings, version dates), the listing page
           (privacy-policy URL, App Privacy label headings, seller/developer website), the customer-review RSS
           (most recent, up to 500) with velocity / burst / templated-text signals.
           Google Play: the listing page (title, developer, contains-ads / IAP, content rating, developer email/site,
           privacy-policy link, data-deletion badge) and the Data safety page (shared / collected / deletion statements).
  search   --term "brand name" [--country us] [--out DIR]     iTunes Search API (entity=software) to find app IDs.

Everything that cannot be read from these pages (runtime SDK calls, ATT prompt timing, in-app subscription flows,
review histories behind JS) is written as NOT_OBSERVABLE in the summary — never inferred.

Usage
  python3 satchel_app.py lookup --ios 284882215 --android com.example.app --out omega_cache/<domain>/apps
  python3 satchel_app.py search --term "example bank" --country us
"""
import argparse, collections, csv, datetime, html as htmlmod, json, os, re, statistics, time, urllib.parse
sys_dir = os.path.dirname(os.path.abspath(__file__))
import sys; sys.path.insert(0, sys_dir)
import wetware

WW = None   # wetware session (store listing pages are read as a person browsing the store; JSON endpoints as page fetches)
def open_session(cache=None, tempo="human", honest=True, declared_ua=None, min_interval=None):
    """Honest by default (UltimaWeapon): the declared UA, robots obeyed, rate-limited. --legacy-persona restores the old layer."""
    global WW
    if WW is None: WW = wetware.Session(cache or "omega_cache/run", tempo=tempo, assets=False, quiet=False,
                                        honest=honest, declared_ua=declared_ua, min_interval=min_interval)
    return WW

def get(url, accept="text/html,application/json;q=0.9,*/*;q=0.8", timeout=40):
    """(status, text) via wetware: JSON endpoints go as api fetches, listing pages as document navigations."""
    ww = open_session(); api = "json" in accept.split(";")[0] and "text/html" not in accept
    m, txt = ww.get(url, kind=("api" if api else "document"), accept=(accept if api else None), timeout=timeout, footprints=False)
    if m.get("status") == 0: return 0, m.get("error", "")
    return m.get("status"), txt

def text_of(html):
    t = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", html); t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", htmlmod.unescape(t))

# ---------------------------------------------------------------- Apple
def apple(app_id, country):
    out = {"store": "apple", "id": app_id, "country": country, "not_observable": ["runtime SDK/network behaviour", "ATT prompt timing", "in-app purchase flow", "account deletion inside the app"]}
    st, body = get(f"https://itunes.apple.com/lookup?id={app_id}&country={country}", accept="application/json,*/*")
    try:
        r = json.loads(body).get("results", [])
        if r:
            a = r[0]
            out.update({"name": a.get("trackName"), "seller": a.get("sellerName"), "developer": a.get("artistName"), "seller_url": a.get("sellerUrl"),
                        "bundle_id": a.get("bundleId"), "genre": a.get("primaryGenreName"), "genres": a.get("genres"), "age_rating": a.get("contentAdvisoryRating"),
                        "price": a.get("formattedPrice"), "avg_rating": a.get("averageUserRating"), "rating_count": a.get("userRatingCount"),
                        "version": a.get("version"), "released": a.get("releaseDate"), "current_version_released": a.get("currentVersionReleaseDate"),
                        "min_os": a.get("minimumOsVersion"), "listing_url": a.get("trackViewUrl"), "description_excerpt": (a.get("description") or "")[:600],
                        "release_notes_excerpt": (a.get("releaseNotes") or "")[:300], "advisories": a.get("advisories")})
        else: out["lookup"] = f"no result ({st})"
    except Exception as e: out["lookup_error"] = f"{st}: {str(e)[:80]}"
    st, page = get(f"https://apps.apple.com/{country}/app/id{app_id}")
    out["listing_status"] = st
    if st == 200:
        txt = text_of(page)
        out["privacy_policy_url"] = next(iter(re.findall(r'aria-label="Developer[^"]{0,3}s Privacy Policy"[^>]*href="(https?://[^"]+)"', page) or re.findall(r'"privacyPolicyUrl"\s*:\s*"([^"]+)"', page) or re.findall(r'href="(https?://[^"]+)"[^>]*>\s*<span[^>]*>\s*Privacy Policy', page, re.I)), None)
        out["developer_website_link"] = next(iter(re.findall(r'aria-label="Developer Website"[^>]*href="(https?://[^"]+)"', page) or re.findall(r'href="(https?://[^"]+)"[^>]*>\s*<span[^>]*>\s*Developer Website', page, re.I)), None)
        labels = [l for l in ("Data Used to Track You", "Data Linked to You", "Data Not Linked to You", "Data Not Collected") if l in txt]
        out["app_privacy_labels"] = labels or ["not found in server-rendered page (verify on the listing)"]
        m = re.search(r"App Privacy(.{0,1200})", txt); out["app_privacy_excerpt"] = m.group(1)[:600] if m else None
        out["support_link"] = next(iter(re.findall(r'href="(https?://[^"]+)"[^>]*>\s*App Support', page, re.I)), None)
        out["in_app_purchases_listed"] = "In-App Purchases" in txt
        out["mentions_subscription"] = bool(re.search(r"subscription|auto-renew|free trial", txt, re.I))
        out["loan_terms_keywords_in_listing"] = bool(re.search(r"\bAPR\b|annual percentage rate|repayment", txt, re.I))
        out["listing_claims"] = sorted(set(m.group(0) for m in re.finditer(r"(?i)\b(#\s?1|number one|best|official|guaranteed|award[- ]winning|top[- ]rated)\b", txt)))[:10]
    st, rss = get(f"https://itunes.apple.com/{country}/rss/customerreviews/id={app_id}/sortBy=mostRecent/json", accept="application/json,*/*")
    reviews = []
    try:
        entries = json.loads(rss).get("feed", {}).get("entry", [])
        if isinstance(entries, dict): entries = [entries]
        for e in entries:
            reviews.append({"store": "apple", "id": app_id, "title": e.get("title", {}).get("label", "")[:120], "rating": int(e.get("im:rating", {}).get("label", 0) or 0),
                            "version": e.get("im:version", {}).get("label"), "date": (e.get("updated", {}).get("label") or "")[:10],
                            "author": e.get("author", {}).get("name", {}).get("label", "")[:40], "text": e.get("content", {}).get("label", "")[:300]})
    except Exception: out["reviews_rss"] = f"unparsable ({st})"
    out.update(review_signals(reviews))
    return out, reviews

# ---------------------------------------------------------------- Google Play
def play(pkg, country):
    out = {"store": "google_play", "id": pkg, "country": country, "not_observable": ["runtime SDK/network behaviour", "permissions actually requested at runtime", "in-app subscription flow", "full review history (JS-paginated)"]}
    st, page = get(f"https://play.google.com/store/apps/details?id={urllib.parse.quote(pkg)}&hl=en&gl={country}")
    out["listing_status"] = st
    if st == 200:
        txt = text_of(page)
        t = re.search(r"<title[^>]*>(.*?)</title>", page, re.S | re.I); out["name"] = htmlmod.unescape(t.group(1)).replace(" - Apps on Google Play", "").strip() if t else None
        out["developer"] = next(iter(re.findall(r'href="/store/apps/dev(?:eloper)?\?id=([^"]+)"', page)), None)
        if out["developer"]: out["developer"] = urllib.parse.unquote(out["developer"]).replace("+", " ")
        out["contains_ads"] = "Contains ads" in txt; out["in_app_purchases"] = "In-app purchases" in txt
        m = re.search(r"(?:Rated for|Content rating)\s*([^.]{0,40}?)(?:\s{2,}|$| info)", txt); out["content_rating"] = (m.group(1).strip() if m else None) or next(iter(re.findall(r"\b(Everyone(?: 10\+)?|Teen|Mature 17\+|Adults only 18\+|PEGI \d+|Rated for \d+\+)\b", txt)), None)
        out["developer_email"] = next(iter(re.findall(r'mailto:([^"?]+)', page)), None)
        out["developer_website"] = next(iter(re.findall(r'href="(https?://[^"]+)"[^>]*aria-label="[^"]*Website', page)), None)
        out["privacy_policy_link"] = next(iter(re.findall(r'href="(https?://[^"]+)"[^>]*aria-label="[^"]*Privacy policy', page, re.I) or re.findall(r'href="(https?://[^"]+)"[^>]*>\s*Privacy policy', page, re.I)), None)
        out["data_deletion_badge_on_listing"] = bool(re.search(r"You can request that data be deleted|request that data be deleted", txt, re.I))
        out["listing_claims"] = sorted(set(m.group(0) for m in re.finditer(r"(?i)\b(#\s?1|number one|best|official|guaranteed|award[- ]winning|top[- ]rated)\b", txt)))[:10]
        out["loan_terms_keywords_in_listing"] = bool(re.search(r"\bAPR\b|annual percentage rate|repayment|max(?:imum)? annual", txt, re.I))
        m = re.search(r"(\d[\d.,]*[KM]?)\s*(?:reviews|ratings)", txt); out["ratings_count_text"] = m.group(0) if m else None
        m = re.search(r"(\d[\d,.]*\+?)\s*Downloads", txt); out["downloads_text"] = m.group(1) if m else None
        m = re.search(r"Updated on\s*([A-Z][a-z]{2} \d{1,2}, \d{4})", txt); out["updated_on"] = m.group(1) if m else None
        out["developer_address_on_listing"] = bool(re.search(r"\b\d{1,5} [A-Z][\w .,-]{5,60}\b(?:Street|St|Avenue|Ave|Road|Rd|Blvd|Suite|Ste|Drive|Dr)\b", txt))
    st, ds = get(f"https://play.google.com/store/apps/datasafety?id={urllib.parse.quote(pkg)}&hl=en&gl={country}")
    out["data_safety_status"] = st
    if st == 200:
        dtxt = text_of(ds)
        out["data_safety"] = {
            "no_data_shared": bool(re.search(r"No data shared with third parties", dtxt)),
            "no_data_collected": bool(re.search(r"No data collected", dtxt)),
            "data_shared_section": bool(re.search(r"Data shared", dtxt)) and not bool(re.search(r"No data shared with third parties", dtxt)),
            "data_collected_section": bool(re.search(r"Data collected", dtxt)) and not bool(re.search(r"No data collected", dtxt)),
            "advertising_or_marketing_purpose": bool(re.search(r"Advertising or marketing", dtxt)),
            "analytics_purpose": bool(re.search(r"Analytics", dtxt)),
            "deletion_request_statement": bool(re.search(r"request that data be deleted", dtxt, re.I)),
            "encrypted_in_transit": bool(re.search(r"Data is encrypted in transit", dtxt)),
            "independent_security_review": bool(re.search(r"Independent security review", dtxt)),
            "categories_mentioned": sorted(set(re.findall(r"\b(Location|Personal info|Financial info|Health and fitness|Messages|Photos and videos|Audio files|Files and docs|Calendar|Contacts|App activity|Web browsing|App info and performance|Device or other IDs)\b", dtxt)))}
    return out, []

def review_signals(reviews):
    if not reviews: return {"reviews_seen": 0}
    days = collections.Counter(r["date"] for r in reviews if r["date"]); ratings = collections.Counter(r["rating"] for r in reviews)
    titles = collections.Counter(r["title"].strip().lower() for r in reviews if r["title"].strip())
    burst_days = [d for d, n in days.items() if n >= max(5, 0.15 * len(reviews))]
    five_share = ratings.get(5, 0) / len(reviews)
    dup_titles = [t for t, n in titles.items() if n >= 3]
    ver = collections.Counter(r["version"] for r in reviews if r["version"])
    span_days = 0
    if days:
        try: span_days = (datetime.date.fromisoformat(max(days)) - datetime.date.fromisoformat(min(days))).days
        except Exception: span_days = 0
    saturated = len(reviews) >= 50 and span_days <= 3
    if saturated: reading = f"sample saturated: the {len(reviews)} most-recent reviews span {span_days + 1} day(s) — high review volume; burst analysis needs the full history (NOT OBSERVABLE from the RSS)"
    elif burst_days or dup_titles: reading = "burst/templated pattern in the recent sample — CANDIDATE, needs the store's full history"
    else: reading = "no burst or templated pattern in the recent sample"
    return {"reviews_seen": len(reviews), "rating_distribution": dict(sorted(ratings.items())), "five_star_share": round(five_share, 2),
            "same_day_bursts": [] if saturated else burst_days[:10], "duplicate_titles": dup_titles[:10], "versions_in_sample": dict(ver.most_common(5)),
            "review_span": f"{min(days) if days else ''}..{max(days) if days else ''}", "signal_reading": reading}

def search(term, country):
    st, body = get(f"https://itunes.apple.com/search?term={urllib.parse.quote(term)}&entity=software&country={country}&limit=15", accept="application/json,*/*")
    rows = []
    try:
        for a in json.loads(body).get("results", []):
            rows.append({"id": a.get("trackId"), "name": a.get("trackName"), "seller": a.get("sellerName"), "bundle_id": a.get("bundleId"), "url": a.get("trackViewUrl")})
    except Exception: print("search failed", st, body[:200])
    for r in rows: print(r)
    return rows

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    l = sub.add_parser("lookup"); l.add_argument("--ios", nargs="*", default=[]); l.add_argument("--android", nargs="*", default=[]); l.add_argument("--country", default="us"); l.add_argument("--out", default="omega_cache/run/apps")
    s = sub.add_parser("search"); s.add_argument("--term", required=True); s.add_argument("--country", default="us"); s.add_argument("--out", default=None)
    for sp in (l, s):
        sp.add_argument("--cache", default=None, help="wetware cache dir (default: parent of --out)"); sp.add_argument("--tempo", default="human", choices=["human", "brisk"])
        sp.add_argument("--legacy-persona", "--persona", dest="legacy_persona", action="store_true", help="use the old human-presence persona instead of the honest declared UA (UltimaWeapon defaults to honest)")
        sp.add_argument("--ua", default=None, help="declared User-Agent for honest mode (else UW_USER_AGENT / MO_USER_AGENT)")
        sp.add_argument("--min-interval", type=float, default=None, help="honest-mode seconds between requests per host (default 2)")
    a = ap.parse_args()
    open_session(a.cache or (os.path.dirname(os.path.abspath(a.out.rstrip("/"))) if a.out else None), tempo=a.tempo,
                 honest=not a.legacy_persona, declared_ua=a.ua or os.environ.get("UW_USER_AGENT") or os.environ.get("MO_USER_AGENT"), min_interval=a.min_interval)
    if a.cmd == "search":
        rows = search(a.term, a.country)
        if a.out and rows:
            os.makedirs(a.out, exist_ok=True)
            with open(os.path.join(a.out, "app_search.csv"), "w", newline="") as fh:
                w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
        return
    os.makedirs(a.out, exist_ok=True); apps, reviews = [], []
    for i in a.ios:
        o, r = apple(i, a.country); apps.append(o); reviews += r; print(f"apple {i}: {o.get('name')} seller={o.get('seller')} labels={o.get('app_privacy_labels')} reviews={o.get('reviews_seen')}")
    for p in a.android:
        o, r = play(p, a.country); apps.append(o); reviews += r; print(f"play {p}: {o.get('name')} dev={o.get('developer')} ds={o.get('data_safety', {}).get('categories_mentioned')}")
    json.dump(apps, open(os.path.join(a.out, "apps.json"), "w"), indent=1, default=str)
    flat = []
    for o in apps:
        row = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in o.items() if k not in ("description_excerpt", "release_notes_excerpt", "app_privacy_excerpt")}
        flat.append(row)
    keys = sorted({k for r in flat for k in r}, key=lambda k: (k not in ("store", "id", "name", "seller", "developer"), k))
    with open(os.path.join(a.out, "apps_summary.csv"), "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=keys); w.writeheader(); w.writerows(flat)
    if reviews:
        with open(os.path.join(a.out, "app_reviews.csv"), "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(reviews[0].keys())); w.writeheader(); w.writerows(reviews)
    # cross-store contradiction check
    ap_ = [o for o in apps if o["store"] == "apple"]; pl = [o for o in apps if o["store"] == "google_play"]
    if ap_ and pl:
        for x in ap_:
            for y in pl:
                a_none = "Data Not Collected" in (x.get("app_privacy_labels") or []); p_shared = (y.get("data_safety") or {}).get("data_shared_section") or (y.get("data_safety") or {}).get("advertising_or_marketing_purpose")
                if a_none and p_shared: print(f"CROSS-STORE CONTRADICTION: Apple label 'Data Not Collected' ({x['id']}) vs Play declares sharing / advertising ({y['id']}) — CONFIRMED as a contradiction; which side is false is CANDIDATE")
                pp_a, pp_p = x.get("privacy_policy_url"), y.get("privacy_policy_link")
                if pp_a and pp_p and urllib.parse.urlparse(pp_a).netloc != urllib.parse.urlparse(pp_p).netloc: print(f"privacy policy hosts differ: {pp_a} vs {pp_p}")
    print(f"wrote {len(apps)} listings, {len(reviews)} reviews -> {a.out}")

if __name__ == "__main__":
    try: main()
    finally:
        if WW is not None: WW.close()
