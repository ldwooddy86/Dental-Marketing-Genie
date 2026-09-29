#!/usr/bin/env python3
"""OMEGAWEAPON ingest: read what the fetchers wrote under omega_cache/<domain>/ and fill the run manifest.

Every fetcher already in the arsenal writes its own files (the Google Crawl, the raw web scan, the render probes, PSI,
the Schema Tribunal, RDAP and DNS, the app forensics, the link classifier, the demand map). This script reads them, maps
their fields onto the manifest modules, generates the mechanical findings (crawl catalogue rows, schema charges, tag
and consent observations, brand-fact inconsistencies) with observed evidence and a link on every row, records the
sources with dates, and leaves every judgment (analysis, exposure dispositions, playbook) to the analyst. It is
idempotent: mechanical findings carry a `generated_by` key and are replaced on re-ingest; hand-written findings and
exposure rows are never touched.

Usage
  python3 scripts/omega_ingest.py --manifest omega_cache/<domain>/runs/<run>.json [--cache omega_cache/<domain>] [--money URL ...]
Pure standard library.
"""
from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

TODAY = None


def load_json(p):
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except Exception:
        return None


def read_csv(p):
    try:
        with open(p, newline="", encoding="utf-8") as fh:
            return list(csv.DictReader(fh))
    except Exception:
        return []


def add_source(m: dict, label: str, kind: str, rung: int, url=None, date=None) -> str:
    """Return the id of a source, creating it when the label is new."""
    for s in m["sources"]:
        if s.get("label") == label:
            return s["id"]
    sid = "SRC%02d" % (len(m["sources"]) + 1)
    m["sources"].append({"id": sid, "label": label, "kind": kind, "date": date or m["run"].get("run_date"), "rung": rung, "url": url})
    return sid


def next_fid(m: dict) -> str:
    n = 1 + max([int(f["id"][1:]) for f in m["findings"] if re.match(r"^F\d+$", f.get("id", ""))] or [0])
    return "F%03d" % n


def push_finding(m: dict, gen: str, **f) -> None:
    f.setdefault("evidence_class", "observed")
    f.setdefault("owner", "Agency")
    f.setdefault("effort", "")
    f["generated_by"] = gen
    f["id"] = next_fid(m)
    m["findings"].append(f)


def clear_generated(m: dict, gen: str) -> None:
    m["findings"] = [f for f in m["findings"] if f.get("generated_by") != gen]


def is_money(m: dict, url: str) -> bool:
    mp = {u.rstrip("/") for u in m["target"].get("money_pages", [])}
    return (url or "").rstrip("/") in mp


# ------------------------------------------------------------------------------------------------ crawl
def ingest_crawl(m: dict, cache: Path) -> None:
    cj = load_json(cache / "google_crawl" / "crawl.json")
    mod = m["modules"]["crawl"]
    if not cj:
        return
    sid = add_source(m, "Google Crawl of the sitemap and link graph (google_crawler.py crawl)", "fetch", 2, url=cj.get("summary", {}).get("homepage"), date=(cj.get("summary", {}).get("generated_at") or "")[:10] or None)
    summ = cj.get("summary", {})
    pages = []
    for r in cj.get("pages", []):
        canon = r.get("canonical")
        pages.append({"url": r.get("url"), "status": r.get("status"), "indexable": r.get("indexable"),
                      "canonical": ("self" if r.get("self_canonical") else (canon or None)), "noindex": r.get("noindex"), "in_sitemap": r.get("in_sitemap"),
                      "depth": r.get("depth"), "title": r.get("title"), "words_raw": r.get("words"), "words_rendered": None, "js_share": None, "lcp_lab_ms": None,
                      "hops": r.get("hops"), "tier": r.get("tier"), "inlinks": r.get("inlinks"), "money": is_money(m, r.get("url") or "")})
    mod["pages"] = pages
    mod["sitemaps"] = [{"url": u, "urls": v.get("count"), "children": None, "issues": [v.get("kind")] if v.get("kind") not in (None, "urlset", "sitemapindex", "ok") else []} for u, v in (summ.get("sitemaps") or {}).items() if not (v.get("source") == "guess" and v.get("kind") == "missing")]
    st = summ.get("index_status", {})
    mod["summary"] = {"pages_fetched": summ.get("fetched_pages"), "sitemap_urls": summ.get("sitemap_urls_total"), "indexable": st.get("indexable", 0), "noindex": st.get("noindex", 0),
                      "blocked": st.get("robots_blocked_googlebot", 0) + st.get("robots_disallowed_for_us", 0), "errors": st.get("error", 0), "redirect_chains": st.get("redirected", 0),
                      "orphans": sum(1 for f in cj.get("findings", []) if f.get("code") in ("ORPHAN", "ORPHAN_CANDIDATE")), "js_dependent": None, "depth_max": max([int(k) for k in (summ.get("depth_histogram") or {}).keys() if str(k).isdigit()] or [0]),
                      "ai_bots_blocked": summ.get("ai_bots_blocked"), "link_graph": summ.get("follow_links")}
    mod["status"] = "run"
    mod["sources"] = sorted(set(mod.get("sources", []) + [sid]))
    te = m["modules"]["technical"]
    if summ.get("robots_status") is not None and not te.get("bot_posture"):
        rows = [{"bot": "robots.txt", "directive": "status %s" % summ.get("robots_status"), "source": "Google Crawl"}]
        aib = summ.get("ai_bots_blocked") or []
        rows.append({"bot": "AI training and retrieval bots (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended and peers)", "directive": ("blocked: " + ", ".join(aib)) if aib else "no rule (allowed)", "source": "robots.txt via the Google Crawl"})
        te["bot_posture"] = rows
    if summ.get("presence"):
        pr = m["run"].setdefault("presence", {})
        pr.setdefault("declared_ua", (summ["presence"] or {}).get("identity") or pr.get("declared_ua", ""))
    # mechanical findings from the catalogue
    clear_generated(m, "crawl")
    for f in cj.get("findings", []):
        if f.get("severity") == "Info":
            continue
        push_finding(m, "crawl", module="crawl", pillar="Technical", severity=f.get("severity", "Low"), title=f"{f.get('code')}: {f.get('meaning')}", evidence=f.get("evidence", ""),
                     url=f.get("url"), fix=f.get("fix", ""), source=sid, money_page=is_money(m, f.get("url") or ""))
    # render rows
    rj = load_json(cache / "google_render.json")
    if rj and rj.get("rows"):
        sid2 = add_source(m, "Render check, mobile, honest launch (google_crawler.py render)", "measured", 3, date=(rj.get("generated_at") or "")[:10] or None)
        rows = []
        for r in rj["rows"]:
            rows.append({"url": r.get("url"), "words_raw": r.get("raw_words"), "words_rendered": r.get("rendered_words"), "js_share": r.get("js_dependent_share"), "lcp_lab_ms": r.get("lcp_ms_lab") or r.get("lcp_ms") or r.get("lcp_lab_ms"), "verdict": r.get("verdict") or r.get("note")})
            for p in pages:
                if (p["url"] or "").rstrip("/") == (r.get("url") or "").rstrip("/"):
                    p.update({"words_rendered": r.get("rendered_words"), "js_share": r.get("js_dependent_share"), "lcp_lab_ms": r.get("lcp_ms_lab") or r.get("lcp_ms") or r.get("lcp_lab_ms")})
        mod["render"] = rows
        mod["sources"] = sorted(set(mod["sources"] + [sid2]))
        mod["summary"]["js_dependent"] = sum(1 for r in rows if (r.get("js_share") or 0) >= 0.3)
        clear_generated(m, "render")
        for r in rows:
            if (r.get("js_share") or 0) >= 0.3 and r.get("url"):
                push_finding(m, "render", module="technical", pillar="Technical", severity="High" if is_money(m, r["url"]) else "Medium",
                             title="Primary content is JavaScript-dependent (raw %s words, rendered %s)" % (r.get("words_raw"), r.get("words_rendered")), evidence=r.get("verdict") or "",
                             url=r["url"], fix="Server-render or prerender the primary content; confirm with GSC URL Inspection's rendered HTML", source=sid2, money_page=is_money(m, r["url"]))
    gv = load_json(cache / "google_crawl" / "googlebot_verify.json")
    if gv:
        mod["googlebot_verify"] = {"verdicts": gv.get("verdicts") or gv.get("summary"), "checked": gv.get("checked")}


# ------------------------------------------------------------------------------------------------ web scan (technical, exposure, agency, content, ai)
def ingest_web(m: dict, cache: Path) -> None:
    files = sorted(glob.glob(str(cache / "web" / "*.web.json")))
    if not files:
        return
    recs = [load_json(f) for f in files]
    recs = [r for r in recs if r]
    if not recs:
        return
    sid = add_source(m, "Raw scan of %d page(s): tag stack, GTM expansion, disclosures, JSON-LD, footer credits (satchel_web.py scan)" % len(recs), "fetch", 2)
    te, ex, ag, ct, ai = m["modules"]["technical"], m["modules"]["exposure"], m["modules"]["agency"], m["modules"]["content"], m["modules"]["ai"]
    clear_generated(m, "web")
    tags, inventory, credits, phones_all, socials, disclosures_all = [], [], Counter(), Counter(), set(), defaultdict(set)
    credit_domain = {}
    hosts = {}
    seen_tags = set()
    for r in recs:
        meta = r.get("meta") or {}
        url = meta.get("final_url") or meta.get("url") or r.get("url") or r.get("final_url") or ""
        r["_url"] = url
        tg = r.get("tags") or {}
        for key, label, purpose in (("gtm_ids", "GTM container", "container"), ("ga4_ids", "GA4", "analytics"), ("google_ads_ids", "Google Ads conversion", "ads"), ("meta_pixel_ids", "Meta Pixel", "ads"), ("ua_ids", "Universal Analytics (dead)", "analytics")):
            for v in tg.get(key, []) or []:
                if (label, v) in seen_tags:
                    continue
                seen_tags.add((label, v))
                tags.append({"tag": label, "id": v, "purpose": purpose, "load": "page HTML", "pre_consent": None, "owner": ""})
        for v in tg.get("vendors_present", []) or []:
            if ("vendor", v) not in seen_tags:
                seen_tags.add(("vendor", v))
                tags.append({"tag": v, "id": "", "purpose": "vendor script", "load": "page HTML", "pre_consent": None, "owner": ""})
        for gid, g in (r.get("gtm_containers") or {}).items():
            for t in (g.get("tags") or []):
                key = ("gtm:" + gid, str(t))
                if key in seen_tags:
                    continue
                seen_tags.add(key)
                tags.append({"tag": str(t), "id": gid, "purpose": "inside GTM", "load": "via GTM " + gid, "pre_consent": None, "owner": ""})
        inventory.append({"surface": url, "tags": ", ".join(sorted(set((tg.get("gtm_ids") or []) + (tg.get("ga4_ids") or []) + (tg.get("google_ads_ids") or []) + (tg.get("meta_pixel_ids") or [])))), "cmp": ", ".join(tg.get("cmp") or []) if tg.get("cmp") else "none observed in raw HTML",
                          "handles": ", ".join(sorted(set(r.get("socials") or []))) if isinstance(r.get("socials"), list) else str(r.get("socials") or ""), "apps": ""})
        for lk in (r.get("footer") or {}).get("external_footer_links", []) or []:
            anchor, href = (lk.get("anchor") or "").strip(), (lk.get("href") or "")
            if re.search(r"(website|web design|designed|developed|powered|built|seo|marketing|digital)\s*(by|:)", anchor, re.I) or re.search(r"agency|digital|design|marketing|media", urlparse(href).netloc, re.I):
                key = re.sub(r"\s+", " ", anchor).lower()[:80] or urlparse(href).netloc
                credits[key] += 1
                credit_domain[key] = urlparse(href).netloc
        for c in (r.get("footer") or {}).get("credits", []) or []:
            mm_ = re.search(r"((?:website|web design|designed|developed|powered|built|seo|marketing)\s*(?:by|:)\s*[A-Z][\w&.' -]{2,40})", c, re.I)
            if mm_:
                key = re.sub(r"\s+", " ", mm_.group(1)).lower()[:80]
                credits[key] += 1
        for k, v in (r.get("disclosures") or {}).items():
            if v:
                disclosures_all[k].add(url)
        if isinstance(r.get("socials"), list):
            socials.update(r["socials"])
        hdrs = {k.lower(): v for k, v in (meta.get("headers") or {}).items()}
        if hdrs and not te.get("headers"):
            te["headers"] = {"hsts": "strict-transport-security" in hdrs, "csp": "content-security-policy" in hdrs or "content-security-policy-report-only" in hdrs, "x_content_type_options": "x-content-type-options" in hdrs, "x_frame_options": "x-frame-options" in hdrs or "frame-ancestors" in hdrs.get("content-security-policy", ""), "referrer_policy": "referrer-policy" in hdrs, "server": hdrs.get("server", ""), "cache_control": hdrs.get("cache-control", ""), "source": "response headers of " + url}
        host = urlparse(url).netloc
        if (r.get("host_level") or r.get("host")) and host not in hosts:
            hosts[host] = r.get("host_level") or r.get("host")
        jl = r.get("jsonld") or {}
        for fl in jl.get("flags", []) or []:
            push_finding(m, "web", module="technical", pillar="Technical", severity="Medium", title="Structured data flag: " + str(fl), evidence="JSON-LD on the page: " + ", ".join(jl.get("types", [])[:6]), url=url, fix="Remove self-serving ratings from Organization or LocalBusiness types; keep only eligible, truthful markup", source=sid, money_page=is_money(m, url))
    te["tags"] = tags or te.get("tags", [])
    te["status"] = "run" if te.get("status") in ("not_run", None) else te["status"]
    te["sources"] = sorted(set(te.get("sources", []) + [sid]))
    ex["inventory"] = inventory
    if ex.get("status") in ("not_run", None):
        ex["status"] = "partial"
        ex["why"] = "inventory and mechanical observations only; batteries A to F and the controls gate are the analyst's pass"
    ex["sources"] = sorted(set(ex.get("sources", []) + [sid]))
    # robots / ads.txt / apps discovered per host
    bots = []
    for host, h in hosts.items():
        rp = h.get("robots") or {}
        for b, d in (rp.get("agents") or {}).items() if isinstance(rp.get("agents"), dict) else []:
            bots.append({"bot": b, "directive": str(d), "source": "robots.txt"})
        if rp.get("ai_bots_blocked") is not None:
            bots.append({"bot": "AI training and retrieval bots", "directive": "blocked: " + ", ".join(rp.get("ai_bots_blocked") or []) if rp.get("ai_bots_blocked") else "no rule (allowed)", "source": "robots.txt"})
        apps = h.get("apps") or {}
        if apps.get("ios_ids") or apps.get("android_packages") or str(apps.get("aasa", "")).startswith("present") or str(apps.get("assetlinks", "")).startswith("present"):
            m["modules"]["apps"]["deep_links"] = {k: v for k, v in apps.items() if v}
            if m["modules"]["apps"].get("status") in ("not_run", "not_assessed"):
                m["modules"]["apps"]["status"] = "partial"
                m["modules"]["apps"]["why"] = "apps discovered from the site; run satchel_app.py lookup for the listings"
    if bots:
        te["bot_posture"] = bots
    # agency of record
    if credits:
        top, n = credits.most_common(1)[0]
        dom = credit_domain.get(top, "")
        name = re.sub(r"^(website|web design|designed|developed|powered|built|seo|marketing)\s*(by|:)\s*", "", top, flags=re.I).strip().title() or top
        ag["of_record"] = ag.get("of_record") or {}
        if not ag["of_record"].get("name"):
            ag["of_record"].update({"name": name + " (footer credit)", "domain": dom, "evidence": ["footer credit '%s' on %d of %d scanned pages" % (top, n, len(recs))] + (["credit links to %s" % dom] if dom else []), "confidence": "Plausible" if n >= 2 else "Weak", "reverse_justice_offered": True})
        if ag.get("status") in ("not_run", None):
            ag["status"] = "partial"
            ag["why"] = "agency of record read from the footer; the inherited vs owned split and the claims screen are the analyst's pass"
        ag["sources"] = sorted(set(ag.get("sources", []) + [sid]))
    # shared measurement layer placeholders (cross-site comparison happens in a Justice run; here we list the IDs)
    ids = [t for t in tags if t["tag"] in ("GTM container", "GA4", "Google Ads conversion", "Meta Pixel")]
    ag["shared_layer"] = ag.get("shared_layer") or [{"id_type": t["tag"], "id": t["id"], "seen_on": [m["target"]["domain"]]} for t in ids]
    # brand facts seeds from phones and disclosures
    if disclosures_all.get("license_numbers"):
        ai["brand_facts"] = ai.get("brand_facts") or []
    # RDAP and DNS (satchel_web.py writes rdap.csv and dns.csv)
    for name in ("rdap.csv", "dns.csv"):
        for f in glob.glob(str(cache / "web" / name)) + glob.glob(str(cache / "dns" / name)) + glob.glob(str(cache / "rdap" / name)):
            rows = read_csv(f)
            if not rows:
                continue
            sid3 = add_source(m, "RDAP and DNS over HTTPS (satchel_web.py rdap / dns)", "public-endpoint", 4)
            ag["outreach"] = ag.get("outreach") or {}
            for row in rows:
                dom = (row.get("domain") or "").lower()
                if dom and dom != m["target"]["domain"]:
                    continue
                for k, v in row.items():
                    if k and v and k != "domain":
                        ag["outreach"][k] = v
            ag["sources"] = sorted(set(ag.get("sources", []) + [sid3]))
            if ag.get("status") in ("not_run", None):
                ag["status"] = "partial"
                ag["why"] = "ownership and outreach infrastructure read; agency of record needs the footer credit and shared stack"
    # web summary csv gives per-page privacy / ccpa / phones
    ws = read_csv(cache / "web" / "web_summary.csv")
    if ws:
        clear_generated(m, "webcsv")
        for row in ws:
            url = row.get("url") or row.get("final_url") or ""
            if row.get("privacy_link") in ("False", "0", ""):
                push_finding(m, "webcsv", module="exposure", pillar="Compliance & Exposure", severity="Medium", title="No privacy policy link found in the raw HTML", evidence="web_summary.csv privacy_link=%s" % row.get("privacy_link"), url=url, fix="Link a dated privacy policy from every page (CalOPPA, store policies, GDPR Art. 13 where EU-facing)", source=sid, money_page=is_money(m, url))
            try:
                if int(row.get("distinct_phones") or 0) > 1:
                    push_finding(m, "webcsv", module="local", pillar="Local", severity="Medium", title="%s distinct phone numbers on one page" % row.get("distinct_phones"), evidence="phone extraction on the raw HTML", url=url, fix="One canonical NAP per location; tracking numbers only via dynamic insertion with the canonical number in the HTML", source=sid, money_page=is_money(m, url))
            except ValueError:
                pass
    # content top pages from page text metrics
    tp = []
    for r in recs:
        url = r.get("_url") or ""
        fa = r.get("facts") or {}
        issues = []
        if not fa.get("meta_description"):
            issues.append("no meta description")
        if fa.get("viewport") is False:
            issues.append("no viewport meta")
        if (fa.get("words") or 0) < 150:
            issues.append("thin in raw HTML (%s words)" % fa.get("words"))
        tp.append({"url": url, "role": "money" if is_money(m, url) else "", "title_len": len(fa.get("title") or ""), "meta_len": len(fa.get("meta_description") or ""), "h1": "", "words": fa.get("words"), "grade": None, "passive_pct": None, "issues": issues})
        already = any(f.get("url") == url and "MISSING_DESCRIPTION" in (f.get("title") or "") for f in m["findings"])
        if not fa.get("meta_description") and url and not already:
            push_finding(m, "web", module="content", pillar="Content & Top Pages", severity="Medium" if is_money(m, url) else "Low", title="No meta description", evidence="raw HTML carries no meta description", url=url, fix="Write a 140 to 160 character description with the service, the place and the offer", source=sid, money_page=is_money(m, url))
    if tp and not ct.get("top_pages"):
        ct["top_pages"] = tp
        if ct.get("status") in ("not_run", None):
            ct["status"] = "partial"
            ct["why"] = "page facts from the raw scan; the content lens (structure, answer-first, readability, internal links) is the analyst's pass"
        ct["sources"] = sorted(set(ct.get("sources", []) + [sid]))


# ------------------------------------------------------------------------------------------------ render probe (satchel_render): pre-consent log, banner, dark patterns
def ingest_render(m: dict, cache: Path) -> None:
    files = sorted(glob.glob(str(cache / "render" / "*.json")))
    recs = [load_json(f) for f in files]
    recs = [r for r in recs if isinstance(r, dict) and (r.get("url") or r.get("final_url"))]
    if not recs:
        return
    sid = add_source(m, "Render probe: pre-consent request log, consent banner, dark-pattern probes (satchel_render.py)", "measured", 3)
    ex, te = m["modules"]["exposure"], m["modules"]["technical"]
    rows = []
    clear_generated(m, "renderprobe")
    for r in recs:
        url = r.get("url") or r.get("final_url")
        pre = r.get("pre_consent_trackers") or []
        banner = r.get("consent_banner") or {}
        cmp = (banner.get("cmp_root") if isinstance(banner, dict) else None) or "none observed"
        note = r.get("tier") or ""
        if r.get("chat_iframes"):
            note += "; chat or AI widget: " + ", ".join(r["chat_iframes"][:3])
        rows.append({"url": url, "pre_consent": ", ".join(map(str, pre)) if pre else "none observed", "cmp": cmp, "consent_mode": r.get("consent_mode") or "not observed", "note": note})
        if r.get("prechecked_checkboxes"):
            push_finding(m, "renderprobe", module="exposure", pillar="Compliance & Exposure", severity="Medium", title="Pre-checked checkbox(es) on the page: " + ", ".join(r["prechecked_checkboxes"][:5]), evidence="render probe found checked inputs on load", url=url, fix="Uncheck by default; consent obtained through a pre-checked box is not consent (11 CCR §7004; FTC §5)", source=sid, money_page=is_money(m, url))
        if pre:
            push_finding(m, "renderprobe", module="exposure", pillar="Compliance & Exposure", severity="Medium", title="%d tracker request(s) fire before any consent interaction" % len(pre), evidence="pre-interaction request log: " + ", ".join(map(str, pre))[:300], url=url, fix="Gate marketing tags behind consent where EU or California users matter; keep the log as the evidence either way", source=sid, money_page=is_money(m, url))
        for dp in r.get("dark_patterns") or []:
            push_finding(m, "renderprobe", module="exposure", pillar="Compliance & Exposure", severity="Medium", title="Dark-pattern probe: " + str(dp)[:120], evidence="render probe observation", url=url, fix="Remove the pattern (timer resets, pre-checked consent and false scarcity are CONFIRMED-capable under FTC §5 and state law)", source=sid, money_page=is_money(m, url))
        if str(r.get("tier", "")).startswith("NOT_TESTED") or r.get("human_verification"):
            m["run"].setdefault("blocked", []).append({"surface": url, "why": "human verification or wall met by the render probe; NOT_TESTED"})
    ex["consent_trackers"] = rows
    ex["sources"] = sorted(set(ex.get("sources", []) + [sid]))
    for t in te.get("tags", []):
        seen = any((t.get("id") and t["id"] in (row.get("pre_consent") or "")) or (t.get("tag") and t["tag"].lower() in (row.get("pre_consent") or "").lower()) for row in rows)
        t["pre_consent"] = True if seen else t.get("pre_consent")


# ------------------------------------------------------------------------------------------------ PSI
def ingest_psi(m: dict, cache: Path) -> None:
    rows = read_csv(cache / "psi" / "psi_summary.csv")
    if not rows:
        return
    sid = add_source(m, "PageSpeed Insights: Lighthouse lab and CrUX field p75 (justice_psi.py)", "measured", 5)
    te = m["modules"]["technical"]
    cwv = []
    for r in rows:
        if (r.get("strategy") or "mobile") != "mobile":
            continue
        def num(k):
            v = r.get(k)
            try:
                return float(v) if v not in (None, "") else None
            except ValueError:
                return None
        cwv.append({"url": r.get("url"), "lcp_p75": num("field_url_lcp_ms") or num("field_origin_lcp_ms"), "inp_p75": num("field_url_inp_ms") or num("field_origin_inp_ms"), "cls_p75": num("field_url_cls") or num("field_origin_cls"),
                    "ttfb_ms": num("field_url_ttfb_ms") or num("lab_ttfb_ms"), "lab_lcp_ms": num("lab_lcp_ms") or num("lcp_ms"), "performance": num("performance"), "source": "PSI %s (%s)" % (r.get("strategy"), r.get("source") or "api"), "date": (r.get("fetched_at") or "")[:10], "verdict": "field" if num("field_url_lcp_ms") else "lab only (no field data for this URL)"})
    if cwv:
        te["cwv"] = cwv
        te["status"] = "run"
        te["sources"] = sorted(set(te.get("sources", []) + [sid]))
        clear_generated(m, "psi")
        for c in cwv:
            bad = []
            if c["lcp_p75"] and c["lcp_p75"] > 2500:
                bad.append("LCP p75 %d ms" % c["lcp_p75"])
            if c["inp_p75"] and c["inp_p75"] > 200:
                bad.append("INP p75 %d ms" % c["inp_p75"])
            if c["cls_p75"] and c["cls_p75"] > 0.1:
                bad.append("CLS p75 %.2f" % c["cls_p75"])
            if bad:
                push_finding(m, "psi", module="technical", pillar="Technical", severity="High" if is_money(m, c["url"]) else "Medium", title="Core Web Vitals fail at p75: " + ", ".join(bad), evidence="CrUX field data via PSI, %s" % c["date"], url=c["url"], fix="Apply the LCP, INP and CLS fix list for this page from the Ironclad doctrine", source=sid, money_page=is_money(m, c["url"]))


# ------------------------------------------------------------------------------------------------ schema tribunal
def ingest_schema(m: dict, cache: Path) -> None:
    rows = read_csv(cache / "schema" / "schema_findings.csv") or read_csv(cache / "schema" / "findings.csv")
    if not rows:
        return
    sid = add_source(m, "Schema Tribunal: JSON-LD validated against rich-result eligibility rules (justice_schema.py)", "fetch", 2)
    te = m["modules"]["technical"]
    te["sources"] = sorted(set(te.get("sources", []) + [sid]))
    clear_generated(m, "schema")
    for r in rows:
        sev = {"High": "High", "Medium": "Medium", "Low": "Low"}.get((r.get("severity") or "").title(), "Low")
        url = r.get("url") or ""
        if not url.startswith("http"):
            continue
        push_finding(m, "schema", module="technical", pillar="Technical", severity=sev, title="Schema: %s (%s)" % (r.get("charge"), r.get("entity_type")), evidence=r.get("detail") or "", url=url, fix="Correct the markup per the charge; retest with the Rich Results Test", source=sid, money_page=is_money(m, url))


# ------------------------------------------------------------------------------------------------ apps
def ingest_apps(m: dict, cache: Path) -> None:
    aj = load_json(cache / "apps" / "apps.json")
    if not aj:
        return
    sid = add_source(m, "App Store and Google Play listing forensics, iTunes Lookup, review RSS (satchel_app.py)", "public-endpoint", 4)
    ap = m["modules"]["apps"]
    inv, rev = [], []
    for o in aj:
        store = o.get("store") or ("apple" if o.get("seller") else "play")
        inv.append({"app": o.get("name"), "store": store, "market": o.get("country") or "us", "id": str(o.get("id") or o.get("package") or ""), "developer": o.get("seller") or o.get("developer"), "version_date": o.get("current_version_release_date") or o.get("updated"), "rating": o.get("average_rating") or o.get("rating"), "count": o.get("rating_count") or o.get("ratings"), "url": o.get("url") or o.get("listing_url")})
        if o.get("reviews_seen") is not None:
            rev.append({"app": o.get("name"), "store": store, "rating": o.get("average_rating") or o.get("rating"), "count": o.get("rating_count") or o.get("ratings"), "velocity_30d": o.get("review_velocity_30d"), "signals": ", ".join(o.get("review_signals") or []) if isinstance(o.get("review_signals"), list) else str(o.get("review_signals") or "")})
    ap["inventory"], ap["reviews"] = inv, rev
    ap["status"] = "run"
    ap["why"] = ""
    ap["sources"] = sorted(set(ap.get("sources", []) + [sid]))
    m["modules"]["exposure"]["inventory"] = m["modules"]["exposure"].get("inventory", [])
    for o in inv:
        m["modules"]["exposure"]["inventory"].append({"surface": o.get("url") or o["app"], "tags": "", "cmp": "", "handles": o.get("developer") or "", "apps": "%s (%s)" % (o["app"], o["store"])})


# ------------------------------------------------------------------------------------------------ links
def ingest_links(m: dict, cache: Path) -> None:
    bj = load_json(cache / "links" / "buckets.json")
    if not bj:
        return
    sid = add_source(m, "Link export classified (classify_links.py on the client's GSC or Bing export)", "export", 6)
    lk = m["modules"]["links"]
    rows = []
    for bucket in ("disavow", "review", "keep"):
        for item in bj.get(bucket, []) or []:
            if isinstance(item, dict):
                rows.append({"domain": item.get("domain"), "bucket": bucket.upper(), "reason": item.get("reason", ""), "signals": ", ".join(item.get("signals", [])) if isinstance(item.get("signals"), list) else str(item.get("signals") or "")})
            else:
                rows.append({"domain": str(item), "bucket": bucket.upper(), "reason": "", "signals": ""})
    lk["rows"] = rows
    lk["buckets"] = {b: len(bj.get(b, []) or []) for b in ("disavow", "review", "keep")}
    lk["stats"] = {"referring_domains_in_export": len(rows)}
    dis = glob.glob(str(cache / "links" / "disavow_*.txt"))
    lk["disavow_file"] = os.path.basename(dis[0]) if dis else None
    lk["status"] = "run"
    lk["why"] = ""
    lk["sources"] = sorted(set(lk.get("sources", []) + [sid]))
    if m["run"].get("tier", 0) < 3:
        m["run"]["tier"] = 3


# ------------------------------------------------------------------------------------------------ demand map (autocomplete json written by omega_run)
def ingest_demand(m: dict, cache: Path) -> None:
    dj = load_json(cache / "search" / "autocomplete.json")
    if not dj:
        return
    sid = add_source(m, "Google Autocomplete presence grid (public JSON endpoint; presence and ordering only, no volumes)", "public-endpoint", 4)
    ct = m["modules"]["content"]
    brand = (m["target"].get("business_name") or "").lower()
    rivals = [(c.get("name") or "").lower() for c in m["target"].get("competitor_set", [])]
    rows = []
    for seed, sugg in dj.items():
        sugg = sugg or []
        rows.append({"seed": seed, "suggestions": sugg, "client_present": any(brand and brand.split()[0] in s.lower() for s in sugg) if brand else False,
                     "rivals_present": [c.get("name") for c in m["target"].get("competitor_set", []) if any((c.get("name") or "").lower().split()[0] in s.lower() for s in sugg if (c.get("name") or "").strip())]})
    ct["demand_map"] = rows
    ct["status"] = "run" if ct.get("status") in ("not_run", None) else ct["status"]
    ct["sources"] = sorted(set(ct.get("sources", []) + [sid]))
    m["modules"]["ai"]["sources"] = sorted(set(m["modules"]["ai"].get("sources", []) + [sid]))
    if not any(r["client_present"] for r in rows) and rows:
        clear_generated(m, "demand")
        push_finding(m, "demand", module="content", pillar="Content & Top Pages", severity="Medium", title="Brand absent from every autocomplete seed (%d seeds)" % len(rows), evidence="Autocomplete presence grid; rivals present on %d seeds" % sum(1 for r in rows if r["rivals_present"]), url=m["target"]["homepage"], fix="Brand-facts page, citable footprint and the local or category pages that earn the suggestion", source=sid, money_page=False)


# ------------------------------------------------------------------------------------------------ Horus market edition (industry read)
def ingest_market(m: dict, cache: Path, root: Path) -> None:
    mk = m["modules"]["market"]
    nome = m["target"].get("nome") or mk.get("nome_id")
    if not nome:
        return
    mk["nome_id"] = nome
    eds = sorted(glob.glob(str(root / "assets" / "editions" / (nome + "-*.json"))))
    eds = [e for e in eds if not re.search(r"\.(signals|analysis|kappa|second-coder)\.json$", e)]
    if not eds:
        return
    stem = Path(eds[-1]).name[:-5]
    sys.path.insert(0, str(root / "scripts"))
    try:
        import horus_metrics, horus_validate  # noqa
        ledger = horus_validate.load(Path(eds[-1]))
        nomes = horus_validate.load(root / "assets" / "nomes.json")
        met = horus_metrics.compute(ledger, nomes, None)
        an = load_json(Path(eds[-1]).with_name(stem + ".analysis.json")) or {}
        sig = load_json(Path(eds[-1]).with_name(stem + ".signals.json")) or {}
    except Exception as e:  # the industry read is optional
        mk["notes"] = (mk.get("notes") or []) + ["industry edition %s could not be read: %s" % (stem, e)]
        return
    labels = {t["id"]: (t.get("short") or t["label"]) for n in nomes["nomes"] if n["id"] == nome for t in n["taxonomy"]}
    topics = met.get("topics") or []
    def top(eye):
        key = "sun_share" if eye == "sun" else "moon_share"
        items = sorted(topics, key=lambda t: -(t.get(key) or 0))[:6]
        return [[labels.get(t["id"], t["id"]), round(t.get(key) or 0, 3)] for t in items if (t.get(key) or 0) > 0]
    stereo = []
    for t in topics:
        if t.get("stereo_class") not in (None, "balanced"):
            stereo.append({"topic": t["id"], "label": labels.get(t["id"], t["id"]), "z": round(t.get("stereo_z", 0), 2), "class": t.get("stereo_class"), "nF": t.get("moon_n"), "nB": t.get("sun_n")})
    stereo.sort(key=lambda r: -abs(r["z"]))
    mk["edition_stem"] = stem
    mk["industry"] = {"headline": an.get("headline", ""), "top_sun": top("sun"), "top_moon": top("moon"), "stereopsis": stereo[:10], "signals_used": [s.get("id") for s in (sig.get("signals") or [])[:8]], "edition_note": "industry read from edition %s (%s items); the Brand Stereopsis below is this run's own" % (stem, len(ledger.get("items", [])))}
    if not mk.get("nilometer"):
        mk["nilometer"] = [{k: s.get(k) for k in ("id", "domain", "metric", "value", "date", "period", "source", "url", "grade", "note", "topics")} for s in (sig.get("signals") or [])[:12]]
    mk["events"] = mk.get("events") or (sig.get("events") or [])[:12]
    mk["watch"] = mk.get("watch") or (sig.get("watch_calendar") or [])[:12]
    sid = add_source(m, "Industry edition %s (Horus engine; coded ledger and graded signals)" % stem, "fetch", 1)
    mk["sources"] = sorted(set(mk.get("sources", []) + [sid]))
    if mk.get("status") in ("not_run", None):
        mk["status"] = "partial"
        mk["why"] = "industry read attached; the brand read (Sun and Moon frames for this business) is still to be coded"


# ------------------------------------------------------------------------------------------------ presence and totals
def ingest_presence(m: dict, cache: Path) -> None:
    pt = cache / "google_crawl" / "presence.txt"
    if pt.exists():
        line = pt.read_text(encoding="utf-8").strip().splitlines()[0] if pt.read_text(encoding="utf-8").strip() else ""
        if line:
            m["run"]["presence"]["line"] = line
    log = cache / "wetware" / "fetch_log.jsonl"
    n = 0
    if log.exists():
        with open(log, encoding="utf-8") as fh:
            for _ in fh:
                n += 1
    if n:
        m["run"]["fetches_used"] = max(m["run"].get("fetches_used", 0), n)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--cache", help="omega_cache/<domain> (default: run.cache_dir in the manifest)")
    ap.add_argument("--money", action="append", help="mark a money page (repeatable)")
    a = ap.parse_args()
    root = Path(__file__).resolve().parent.parent
    mp = Path(a.manifest)
    m = json.loads(mp.read_text(encoding="utf-8"))
    cache = Path(a.cache) if a.cache else Path(m["run"].get("cache_dir") or mp.parent.parent)
    if a.money:
        m["target"]["money_pages"] = sorted(set(m["target"].get("money_pages", []) + a.money))
    before = len(m["findings"])
    ingest_crawl(m, cache)
    ingest_web(m, cache)
    ingest_render(m, cache)
    ingest_psi(m, cache)
    ingest_schema(m, cache)
    ingest_apps(m, cache)
    ingest_links(m, cache)
    ingest_demand(m, cache)
    ingest_market(m, cache, root)
    ingest_presence(m, cache)
    # dedupe generated findings by (title, url)
    seen, out = set(), []
    for f in m["findings"]:
        key = (f.get("title"), f.get("url"))
        if f.get("generated_by") and key in seen:
            continue
        seen.add(key)
        out.append(f)
    m["findings"] = out
    mp.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")
    print("ingested into %s: %d findings (%d new), modules: %s" % (mp, len(m["findings"]), len(m["findings"]) - before, ", ".join("%s=%s" % (k, v.get("status")) for k, v in m["modules"].items())))


if __name__ == "__main__":
    main()
