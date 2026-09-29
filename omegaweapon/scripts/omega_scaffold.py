#!/usr/bin/env python3
"""OMEGAWEAPON scaffold: open a run manifest for one target domain.

The manifest is the single JSON contract everything else reads and writes: the fetch phases fill it through
omega_ingest.py, the analyst fills analysis / playbook / judgment calls by hand, omega_metrics.py computes every
number from it, omega_validate.py enforces the contract, and omega_build.py turns it into the dashboard.

Usage
  python3 scripts/omega_scaffold.py example.com --archetype local-service [--vertical legal] [--posture competitor|self-audit]
        [--recipient "Client Name"] [--geo "Frisco, TX"] [--jurisdiction US-TX --jurisdiction EU] [--surfaces site,local,paid,social,apps,copy]
        [--question "why did leads drop"] [--modules crawl,technical,...] [--cache omega_cache] [--run-id 2026-09-28a] [--force]
  python3 scripts/omega_scaffold.py example.com --archetype local-service --demo      # a filled fixture for testing the pipeline

Writes omega_cache/<domain>/runs/<run_id>.json (the manifest) and creates the module output folders the fetchers use.
Every module key is present from the start with status "not_run"; the dashboard shows what did not run instead of hiding it.
Pure standard library.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
VERSION = "1.0.0"
DOCTRINE_DATE = "2026-09-28"

MODULES = ["crawl", "technical", "content", "local", "links", "competitors", "paid", "social", "ai", "apps", "exposure", "agency", "market", "copy"]
SURFACES = ["site", "local", "paid", "social", "apps", "copy"]
STATUSES = ["run", "partial", "not_run", "not_assessed", "blocked"]


def slug_domain(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"^https?://", "", s).split("/")[0]
    s = re.sub(r"^www\.", "", s)
    if not re.match(r"^[a-z0-9.-]+\.[a-z]{2,}$", s):
        raise SystemExit(f"not a domain: {s!r}")
    return s


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def archetype(aid: str, table: dict) -> dict:
    for a in table["archetypes"]:
        if a["id"] == aid:
            return a
    raise SystemExit("unknown archetype %r; one of %s" % (aid, ", ".join(a["id"] for a in table["archetypes"])))


def default_modules(arch: dict, table: dict) -> list[str]:
    on = list(table["always_on"]) + [m for m in arch.get("modules_on", []) if m not in table["always_on"]]
    off = set(arch.get("modules_off", []))
    return [m for m in MODULES if m in on and m not in off]


def module_shell(mid: str) -> dict:
    """Every module carries the same envelope; the module-specific keys are documented in references/omega-manifest.md."""
    shell = {"status": "not_run", "why": "", "sources": [], "summary": {}, "notes": []}
    extra = {
        "crawl": {"pages": [], "render": [], "sitemaps": [], "googlebot_verify": None},
        "technical": {"cwv": [], "tags": [], "bot_posture": [], "headers": {}, "redirects": [], "timing_sweep": None},
        "content": {"top_pages": [], "demand_map": [], "readability": {}, "content_plan": []},
        "local": {"pillars": [], "gbp": [], "citations": [], "reviews": [], "listing_integrity": [], "location_pages": []},
        "links": {"stats": {}, "buckets": {}, "rows": [], "gap": [], "disavow_file": None},
        "competitors": {"rivals": [], "keyword_gap": [], "threat_ranking": []},
        "paid": {"intel": [], "swipe": [], "account_audit": {"status": "not_assessed", "pillars": []}, "search_terms": [], "negatives_block": "", "conversion_actions": [], "landing_pages": [], "auction_insights": [], "budget_scenarios": [], "lsa": {}},
        "social": {"intel": [], "organic": [], "account_audit": {"status": "not_assessed", "pillars": []}, "creative_ledger": [], "audience_map": [], "measurement_spine": [], "creator_compliance": []},
        "ai": {"readiness": [], "citable_footprint": [], "prompt_tracker": [], "brand_facts": [], "referrals": [], "llms_txt": None},
        "apps": {"inventory": [], "aso": [], "keyword_proxy": [], "reviews": [], "deep_links": {}, "measurement": [], "campaigns": [], "vitals": []},
        "exposure": {"inventory": [], "clause_coverage": [], "consent_trackers": [], "accounts": [], "not_observable": [], "controls_applied": []},
        "agency": {"of_record": {}, "inherited_vs_owned": [], "claims": [], "shared_layer": [], "outreach": {}, "pattern_verdict": None, "industry_alignment": [], "self_audit": []},
        "market": {"nome_id": None, "edition_stem": None, "industry": {}, "brand": {"frames": {"sun": [], "moon": []}, "items": []}, "nilometer": [], "events": [], "watch": []},
        "copy": {"passes_run": [], "readability": {}, "flags": [], "verify_worklist": [], "deliverables": []},
    }
    shell.update(extra.get(mid, {}))
    return shell


def skeleton(domain: str, arch: dict, table: dict, a) -> dict:
    today = dt.date.today().isoformat()
    run_id = a.run_id or (today + "a")
    modules_run = a.modules.split(",") if a.modules else default_modules(arch, table)
    for m in modules_run:
        if m not in MODULES:
            raise SystemExit(f"unknown module {m!r}")
    surfaces = a.surfaces.split(",") if a.surfaces else SURFACES
    overlays = arch.get("codex_overlays", [])
    return {
        "omega": {"version": VERSION, "doctrine_date": DOCTRINE_DATE, "created_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
        "target": {
            "domain": domain, "homepage": (a.homepage or f"https://{domain}/"), "business_name": a.business or domain, "recipient": a.recipient or "",
            "archetype": arch["id"], "archetype_secondary": a.secondary or None, "vertical": a.vertical or "", "codex_overlays": overlays,
            "nome": arch.get("nome"), "geography": {"label": a.geo or "", "markets": []}, "jurisdictions": a.jurisdiction or [],
            "posture": a.posture, "surfaces": surfaces, "question": a.question or "", "competitor_set": [], "money_pages": [],
        },
        "run": {
            "id": run_id, "run_date": today, "tier": 0, "modules_planned": modules_run,
            "presence": {"mode": "honest", "line": "", "declared_ua": "", "vantage": "cloud workspace (US egress)"},
            "fetch_budget": a.fetch_budget, "fetches_used": 0, "cache_dir": str(Path(a.cache) / domain),
            "judgment_calls": [], "exports_supplied": [], "exports_requested": list(arch.get("exports_to_request", [])),
            "blocked": [], "previous_run": None,
        },
        "sources": [],
        "modules": {m: module_shell(m) for m in MODULES},
        "findings": [],
        "exposure": [],
        "verify_queue": [],
        "tasks": [],
        "analysis": {
            "headline": "", "bluf": [], "win_watch_next": {"win": "", "watch": "", "next": ""},
            "one_rival": "", "one_paid_opportunity": "", "one_exposure": "",
            "key_judgments": [], "scenarios": {}, "indicators": [], "unknowns": [], "graveyard_test": [], "moves": [], "limitations": [],
            "scorecard_notes": {},
        },
        "playbook": {"phases": [], "moves12": [], "on_page": [], "schema_blocks": [], "redirects": [], "content_offensive": [], "local": [], "authority": [], "paid": [], "social": [], "apps": [], "ai": [], "compliance": [], "measurement": []},
        "glossary": [],
    }


def demo_fill(m: dict) -> dict:
    """A small, self-consistent fixture so the pipeline can be exercised without network access. Every number is
    invented for the fixture and labeled as such in the sources; never ship a demo manifest."""
    d = m["target"]["domain"]
    m["target"].update({"business_name": "Example Plumbing Co", "recipient": "Example Plumbing Co", "vertical": "home-services",
                        "codex_overlays": [4], "geography": {"label": "Frisco, TX", "markets": ["Frisco", "Plano", "McKinney", "Allen"]},
                        "jurisdictions": ["US-TX"], "question": "Why did calls drop after the redesign, and what could get the Ads account suspended?",
                        "competitor_set": [{"name": "Rival One Plumbing", "domain": "rival-one.example"}, {"name": "Rival Two Services", "domain": "rival-two.example"}, {"name": "Rival Three", "domain": "rival-three.example"}],
                        "money_pages": [f"https://{d}/", f"https://{d}/services/water-heater-repair/", f"https://{d}/services/drain-cleaning/", f"https://{d}/contact/"]})
    m["run"].update({"tier": 0, "fetches_used": 41, "presence": {"mode": "honest", "line": "DECLARED: OmegaWeapon/1.0 (+https://example-operator.test/contact); robots.txt obeyed; 2.0 s per host; 41 fetches; 1 ROBOTS_DISALLOWED skip", "declared_ua": "OmegaWeapon/1.0 (+https://example-operator.test/contact)", "vantage": "cloud workspace (US egress)"},
                    "judgment_calls": ["Archetype: local service business (plumber), single location; Ground War on.", "Fetch cap 60; 41 used; link-graph discovery on with max 80 pages.", "Tier 0: no exports supplied; every ranking, traffic and spend statement is a protocol.", "Disavow not built (Tier 0)."],
                    "exports_supplied": [], "blocked": [{"surface": "Meta Ad Library", "why": "403 from this vantage; manual protocol shipped"}, {"surface": "Google Maps local pack", "why": "not fetchable; screenshot protocol shipped"}]})
    m["sources"] = [
        {"id": "SRC01", "label": "Google Crawl of the sitemap and link graph (demo fixture)", "kind": "fetch", "date": m["run"]["run_date"], "rung": 2, "url": f"https://{d}/sitemap.xml"},
        {"id": "SRC02", "label": "Raw scan of 6 money pages (demo fixture)", "kind": "fetch", "date": m["run"]["run_date"], "rung": 2, "url": f"https://{d}/"},
        {"id": "SRC03", "label": "Render probe, mobile (demo fixture)", "kind": "measured", "date": m["run"]["run_date"], "rung": 3, "url": None},
        {"id": "SRC04", "label": "Autocomplete presence grid, 14 seeds (demo fixture)", "kind": "public-endpoint", "date": m["run"]["run_date"], "rung": 4, "url": None},
        {"id": "SRC05", "label": "App Store review RSS (demo fixture)", "kind": "public-endpoint", "date": m["run"]["run_date"], "rung": 4, "url": None},
        {"id": "SRC06", "label": "Google review panel screenshots, user captured (demo fixture)", "kind": "screenshot", "date": m["run"]["run_date"], "rung": 6, "url": None},
    ]
    mods = m["modules"]
    mods["crawl"].update({"status": "run", "sources": ["SRC01"], "summary": {"pages_fetched": 38, "sitemap_urls": 64, "indexable": 31, "noindex": 3, "blocked": 1, "errors": 2, "redirect_chains": 4, "orphans": 5, "js_dependent": 2, "depth_max": 5},
                          "pages": [{"url": f"https://{d}/", "status": 200, "indexable": True, "canonical": "self", "in_sitemap": True, "depth": 0, "title": "Example Plumbing Co | Frisco Plumber", "words_raw": 412, "words_rendered": 1180, "js_share": 0.65, "lcp_lab_ms": 3900, "money": True},
                                    {"url": f"https://{d}/services/water-heater-repair/", "status": 200, "indexable": True, "canonical": "self", "in_sitemap": True, "depth": 2, "title": "Water Heater Repair Frisco", "words_raw": 120, "words_rendered": 940, "js_share": 0.87, "lcp_lab_ms": 4600, "money": True},
                                    {"url": f"https://{d}/services/drain-cleaning/", "status": 200, "indexable": True, "canonical": "self", "in_sitemap": True, "depth": 2, "title": "Drain Cleaning Frisco", "words_raw": 610, "words_rendered": 680, "js_share": 0.10, "lcp_lab_ms": 2700, "money": True},
                                    {"url": f"https://{d}/blog/", "status": 200, "indexable": True, "canonical": "self", "in_sitemap": False, "depth": 1, "title": "Blog", "words_raw": 300, "words_rendered": 300, "js_share": 0.0, "lcp_lab_ms": None, "money": False},
                                    {"url": f"https://{d}/old-services/", "status": 301, "indexable": False, "canonical": None, "in_sitemap": True, "depth": None, "title": "", "words_raw": 0, "words_rendered": None, "js_share": None, "lcp_lab_ms": None, "money": False}],
                          "sitemaps": [{"url": f"https://{d}/sitemap.xml", "urls": 64, "children": 2, "issues": ["1 redirecting URL", "3 noindex URLs"]}]})
    mods["technical"].update({"status": "run", "sources": ["SRC02", "SRC03"], "summary": {"headers_grade": "C", "tags": 9, "pre_consent_tags": 4},
                              "cwv": [{"url": f"https://{d}/", "lcp_p75": None, "inp_p75": None, "cls_p75": None, "ttfb_ms": 820, "lab_lcp_ms": 3900, "source": "render probe lab (SRC03)", "date": m["run"]["run_date"], "verdict": "lab only; field data needs a PSI key or the GSC CWV export"}],
                              "tags": [{"tag": "GTM container", "id": "GTM-XXXX", "purpose": "container", "load": "head", "pre_consent": True, "owner": "agency"}, {"tag": "Meta Pixel", "id": "1234567890", "purpose": "ads", "load": "via GTM", "pre_consent": True, "owner": "agency"}, {"tag": "GA4", "id": "G-XXXX", "purpose": "analytics", "load": "via GTM", "pre_consent": True, "owner": "client"}, {"tag": "CallRail", "id": "", "purpose": "call tracking", "load": "head", "pre_consent": True, "owner": "agency"}],
                              "bot_posture": [{"bot": "Googlebot", "directive": "allowed", "source": "robots.txt line 1"}, {"bot": "GPTBot", "directive": "no rule (allowed)", "source": "robots.txt"}, {"bot": "OAI-SearchBot", "directive": "no rule (allowed)", "source": "robots.txt"}, {"bot": "AdsBot-Google", "directive": "allowed", "source": "robots.txt"}],
                              "headers": {"hsts": False, "csp": False, "x_content_type_options": True, "server": "cloudflare"}})
    mods["content"].update({"status": "run", "sources": ["SRC02", "SRC04"], "summary": {"pages_assessed": 6, "grade_avg": "C"},
                            "top_pages": [{"url": f"https://{d}/services/water-heater-repair/", "role": "money", "title_len": 26, "meta_len": 0, "h1": "Water Heater Repair", "words": 120, "grade": 9.2, "passive_pct": 14, "issues": ["no meta description", "primary content JS-rendered", "no FAQ"]},
                                          {"url": f"https://{d}/services/drain-cleaning/", "role": "money", "title_len": 22, "meta_len": 148, "h1": "Drain Cleaning in Frisco", "words": 610, "grade": 8.1, "passive_pct": 9, "issues": ["no pricing signal", "internal links to 1 page only"]}],
                            "demand_map": [{"seed": "plumber frisco", "suggestions": ["plumber frisco tx", "plumber frisco texas", "plumber frisco reviews", "plumber frisco emergency", "plumber frisco cost"], "client_present": False, "rivals_present": ["Rival One Plumbing"]},
                                           {"seed": "water heater repair frisco", "suggestions": ["water heater repair frisco tx", "water heater replacement frisco", "tankless water heater frisco"], "client_present": False, "rivals_present": []}]})
    mods["local"].update({"status": "partial", "why": "GBP and pack membership need screenshots; on-site local signals observed", "sources": ["SRC02", "SRC06"], "summary": {"grade": "C"},
                          "pillars": [{"pillar": "Entity and eligibility", "grade": "B", "evidence_class": "observed", "note": "One physical location, consistent NAP on site"}, {"pillar": "NAP canonicalization", "grade": "C", "evidence_class": "observed", "note": "Two phone formats across pages; suite number differs on contact page"}, {"pillar": "Profile completeness", "grade": "?", "evidence_class": "unverified", "note": "GBP fields need screenshots"}, {"pillar": "Reviews", "grade": "C", "evidence_class": "observed", "note": "4.6 on 212 reviews (screenshot); rivals at 4.8 on 640 and 4.7 on 380; response rate 31%"}, {"pillar": "On-site local architecture", "grade": "D", "evidence_class": "observed", "note": "No city pages; service pages lack location terms"}, {"pillar": "Local schema", "grade": "D", "evidence_class": "observed", "note": "Organization only; no Plumber or LocalBusiness type; aggregateRating self-serving"}, {"pillar": "Citations", "grade": "?", "evidence_class": "unverified", "note": "Top directories fetchable in Tier 2; protocol shipped"}],
                          "gbp": [{"item": "Primary category", "status": "Unknown", "source": "screenshot needed", "fix": "Plumber"}, {"item": "Services list", "status": "Unknown", "source": "screenshot needed", "fix": "Add water heater, drain, repipe, gas line"}],
                          "reviews": [{"entity": "Example Plumbing Co", "platform": "Google", "count": 212, "rating": 4.6, "velocity_30d": 6, "response_rate": 0.31, "source": "SRC06", "date": m["run"]["run_date"]}, {"entity": "Rival One Plumbing", "platform": "Google", "count": 640, "rating": 4.8, "velocity_30d": 22, "response_rate": 0.9, "source": "SRC06", "date": m["run"]["run_date"]}, {"entity": "Rival Two Services", "platform": "Google", "count": 380, "rating": 4.7, "velocity_30d": 11, "response_rate": 0.6, "source": "SRC06", "date": m["run"]["run_date"]}],
                          "listing_integrity": [{"business": "Frisco Plumbing Pros (unverified listing)", "signal": "keyword-stuffed name; address resolves to a UPS Store", "disposition": "CANDIDATE", "control": None, "open_question": "Is there a real storefront behind the mailbox suite?"}]})
    mods["links"].update({"status": "not_assessed", "why": "Tier 0: no link export; disavow not built"})
    mods["competitors"].update({"status": "run", "sources": ["SRC02", "SRC04", "SRC06"], "summary": {"rivals": 3},
                                "rivals": [{"name": "Rival One Plumbing", "domain": "rival-one.example", "threat_rank": 1, "one_line": "Owns the pack and the autocomplete; 3x the review velocity; city pages for every suburb", "lenses": {"content": "B", "technical": "B", "ux": "B", "speed": "C", "mobile": "B"}, "steal_this": ["Per-suburb service pages with real crew photos", "Same-day badge in the title tag", "Financing page with monthly payment framing (check Reg Z triggers)"]},
                                           {"name": "Rival Two Services", "domain": "rival-two.example", "threat_rank": 2, "one_line": "Heavy LSA presence; weak site; strong review response", "lenses": {"content": "C", "technical": "C", "ux": "C", "speed": "B", "mobile": "B"}, "steal_this": ["Review response SOP within 24 h"]},
                                           {"name": "Rival Three", "domain": "rival-three.example", "threat_rank": 3, "one_line": "Small; blog-driven; ranks for informational queries only", "lenses": {"content": "B", "technical": "D", "ux": "C", "speed": "D", "mobile": "C"}, "steal_this": ["FAQ blocks on service pages"]}],
                                "keyword_gap": [{"term": "tankless water heater frisco", "client": "not present", "rival": "Rival One Plumbing", "evidence": "autocomplete + fetched page"}]})
    mods["paid"].update({"status": "partial", "why": "Ad libraries not fetchable; protocol shipped; own account needs exports", "sources": [], "summary": {},
                         "intel": [{"rival": "Rival One Plumbing", "platform": "Google Search", "active": "observed in SERP screenshot protocol (pending)", "since": None, "formats": ["Search", "LSA"], "hooks": [], "lp": "rival-one.example/water-heater", "source": "protocol", "date": None, "evidence_class": "unverified"}],
                         "account_audit": {"status": "not_assessed", "pillars": []}, "budget_scenarios": [{"scenario": "Conservative", "monthly_budget": 3000, "assumed_cpc": "12 to 20 USD (vendor estimate range)", "assumed_cvr": "8 to 12%", "leads_range": "12 to 31", "label": "estimate; assumptions listed"}]})
    mods["social"].update({"status": "partial", "why": "Profiles not fetchable; handles inventoried; organic read from screenshots pending", "sources": ["SRC02"],
                           "organic": [{"platform": "Facebook", "handle": "exampleplumbingco", "url": "https://www.facebook.com/exampleplumbingco", "completeness": "unknown", "cadence": "unknown", "last_post": None, "video_share": None, "response_time": None, "evidence_class": "unverified"}, {"platform": "Instagram", "handle": "exampleplumbing", "url": "https://www.instagram.com/exampleplumbing", "completeness": "unknown", "cadence": "unknown", "last_post": None, "video_share": None, "response_time": None, "evidence_class": "unverified"}]})
    mods["ai"].update({"status": "run", "sources": ["SRC02", "SRC04"], "summary": {"readiness": "C", "citable_sources_present": 1, "citable_sources_checked": 9},
                       "readiness": [{"item": "Answer-first paragraphs on money pages", "observed": "No; pages open with slogans", "fix": "Lead each service page with a 40 to 60 word direct answer"}, {"item": "Organization graph with sameAs", "observed": "Partial; no sameAs, no founder, no address", "fix": "Publish the brand-facts page and the Organization JSON-LD"}, {"item": "Retrieval bots allowed", "observed": "Yes; no AI bot rules in robots.txt", "fix": "Keep; decide on training bots separately"}],
                       "citable_footprint": [{"query": "best plumber frisco tx", "page": "listicle on a local news site", "type": "listicle", "client": False, "rivals": ["Rival One Plumbing", "Rival Two Services"], "date": m["run"]["run_date"], "url": "https://news.example/best-plumbers-frisco"}, {"query": "water heater repair frisco", "page": "Yelp category page", "type": "directory", "client": True, "rivals": ["Rival One Plumbing"], "date": m["run"]["run_date"], "url": "https://www.yelp.com/search?find_desc=water+heater+repair&find_loc=Frisco%2C+TX"}],
                       "prompt_tracker": [{"prompt": "Who is a reliable plumber in Frisco, Texas?", "engine": "ChatGPT", "mentioned": None, "cited_url": None, "date": None, "source": "protocol: screenshot pending"}],
                       "brand_facts": [{"fact": "Founded", "site": "2009", "gbp": "unknown", "linkedin": "2011", "directories": "2009", "consistent": False}, {"fact": "Phone", "site": "(972) 555-0100 and 972-555-0100", "gbp": "unknown", "linkedin": "", "directories": "(972) 555-0100", "consistent": False}]})
    mods["apps"].update({"status": "not_assessed", "why": "No app discovered (no AASA, assetlinks, store badges or iTunes search hit)"})
    mods["exposure"].update({"status": "run", "sources": ["SRC02", "SRC03"], "summary": {},
                             "inventory": [{"surface": f"https://{d}/", "tags": "GTM-XXXX (expands to Meta Pixel, GA4, Google Ads conversion, CallRail)", "cmp": "none", "handles": "facebook.com/exampleplumbingco, instagram.com/exampleplumbing", "apps": "none"}],
                             "clause_coverage": [{"family": "Google Ads Misrepresentation", "status": "testable (landing pages)"}, {"family": "16 CFR 465 fake reviews", "status": "testable (site widgets)"}, {"family": "TCPA form consent", "status": "testable (form language)"}, {"family": "Texas TDLR / plumbing board display rule", "status": "testable"}, {"family": "Meta Advertising Standards (creative)", "status": "needs ad access"}],
                             "not_observable": [{"item": "Ad creatives and targeting", "why": "libraries blocked from this vantage", "cost_to_close": "screenshot protocol, 20 minutes"}, {"item": "Google Ads account history", "why": "needs Policy manager export", "cost_to_close": "one export"}],
                             "controls_applied": [{"candidate": "CCPA link absent", "control": "Threshold: revenue and consumer counts below CCPA floor", "result": "CLEARED"}]})
    mods["agency"].update({"status": "run", "sources": ["SRC02"], "summary": {"of_record_confidence": "Plausible"},
                           "of_record": {"name": "Acme Digital (footer credit)", "domain": "acme-digital.example", "evidence": ["footer credit 'Website by Acme Digital' on every page", "RDAP registrant: privacy proxy", "GTM container shared with 2 other Acme Digital client sites (search footprint)"], "confidence": "Plausible", "reverse_justice_offered": True},
                           "inherited_vs_owned": [{"finding_id": "F003", "side": "inherited", "why": "Template ships JS-rendered service content"}, {"finding_id": "F006", "side": "inherited", "why": "Agency container fires pixels pre-consent"}, {"finding_id": "F002", "side": "owned", "why": "Client controls review responses"}],
                           "claims": [{"claim": "'#1 Rated Plumber in Frisco' in the homepage hero", "url": f"https://{d}/", "test": "no conferring body; rival rating higher on the same platform", "status": "CANDIDATE"}],
                           "shared_layer": [{"id_type": "GTM", "id": "GTM-XXXX", "seen_on": [d, "other-client-1.example", "other-client-2.example"]}],
                           "industry_alignment": [{"practice": "City pages for every suburb", "floor_stance": "still pays for local, per r/localseo and Local Search Forum threads", "agency_selling": "not built for this client", "note": "the gap is a sellable move"}, {"practice": "AI receptionist on the site", "floor_stance": "mixed; owners report missed nuance", "agency_selling": "not present", "note": "hold"}]})
    mods["market"].update({"status": "partial", "why": "brand read from the site and review screenshots; industry edition not rerun this run", "sources": ["SRC02", "SRC05", "SRC06"], "nome_id": "local-services",
                           "industry": {"headline": "Local pack visibility is being decided more by reviews and LSA than by site changes; owners' floor pain is lead cost.", "top_sun": [["V03", 0.18], ["V13", 0.16], ["V02", 0.14]], "top_moon": [["V05", 0.22], ["V02", 0.18], ["V11", 0.12]], "stereopsis": [{"topic": "V05", "label": "Local paid", "z": 2.4, "class": "floor-led", "nF": 11, "nB": 3}, {"topic": "V13", "label": "Local SEO and AI", "z": -2.1, "class": "broadcast-led", "nF": 2, "nB": 9}], "signals_used": ["N02", "N05"], "edition_note": "industry read summarized from the local-services nome; full edition not built this run"},
                           "brand": {"frames": {"sun": ["homepage and 4 money pages", "blog latest 12 posts"], "moon": ["Google reviews, newest 40 (screenshots)", "one r/Frisco thread (title only)"]},
                                     "items": [{"id": "S001", "eye": "sun", "topic": "B05", "topic2": None, "intent": "P", "stance": 1, "flags": [], "title": "Licensed, insured, family owned since 2009", "source": "homepage", "url": f"https://{d}/"},
                                               {"id": "S002", "eye": "sun", "topic": "B01", "topic2": "B09", "intent": "P", "stance": 1, "flags": [], "title": "Done right the first time, guaranteed", "source": "homepage", "url": f"https://{d}/"},
                                               {"id": "S003", "eye": "sun", "topic": "B03", "topic2": None, "intent": "P", "stance": 1, "flags": [], "title": "Same day service across Frisco", "source": "services", "url": f"https://{d}/services/drain-cleaning/"},
                                               {"id": "S004", "eye": "sun", "topic": "B11", "topic2": None, "intent": "P", "stance": 1, "flags": [], "title": "$49 off any repair this month", "source": "homepage banner", "url": f"https://{d}/"},
                                               {"id": "S005", "eye": "sun", "topic": "B05", "topic2": None, "intent": "P", "stance": 1, "flags": [], "title": "Background-checked technicians", "source": "about", "url": f"https://{d}/about/"},
                                               {"id": "S006", "eye": "sun", "topic": "B01", "topic2": None, "intent": "H", "stance": 0, "flags": [], "title": "How to tell if your water heater is failing", "source": "blog", "url": f"https://{d}/blog/water-heater-failing/"},
                                               {"id": "S007", "eye": "sun", "topic": "B12", "topic2": None, "intent": "H", "stance": 0, "flags": [], "title": "Tankless vs tank: what Frisco homes need", "source": "blog", "url": f"https://{d}/blog/tankless-vs-tank/"},
                                               {"id": "S008", "eye": "sun", "topic": "B09", "topic2": None, "intent": "P", "stance": 1, "flags": [], "title": "Lifetime warranty on repipes", "source": "services", "url": f"https://{d}/services/repipe/"},
                                               {"id": "S009", "eye": "sun", "topic": "B03", "topic2": None, "intent": "P", "stance": 1, "flags": [], "title": "24/7 emergency plumbing", "source": "homepage", "url": f"https://{d}/"},
                                               {"id": "S010", "eye": "sun", "topic": "B05", "topic2": None, "intent": "P", "stance": 1, "flags": [], "title": "Frisco's #1 rated plumber", "source": "homepage hero", "url": f"https://{d}/"},
                                               {"id": "M001", "eye": "moon", "topic": "B02", "topic2": None, "intent": "C", "stance": -1, "flags": [], "title": "Quote doubled once the tech arrived (review, 1 star)", "source": "Google reviews", "url": None},
                                               {"id": "M002", "eye": "moon", "topic": "B02", "topic2": "B08", "intent": "C", "stance": -1, "flags": [], "title": "Charged a trip fee I was not told about (review, 2 stars)", "source": "Google reviews", "url": None},
                                               {"id": "M003", "eye": "moon", "topic": "B04", "topic2": None, "intent": "R", "stance": 1, "flags": [], "title": "Tech was polite and explained everything (review, 5 stars)", "source": "Google reviews", "url": None},
                                               {"id": "M004", "eye": "moon", "topic": "B03", "topic2": None, "intent": "C", "stance": -1, "flags": [], "title": "Booked same day, nobody came until the next afternoon (review, 2 stars)", "source": "Google reviews", "url": None},
                                               {"id": "M005", "eye": "moon", "topic": "B01", "topic2": None, "intent": "R", "stance": 1, "flags": [], "title": "Fixed the slab leak other companies missed (review, 5 stars)", "source": "Google reviews", "url": None},
                                               {"id": "M006", "eye": "moon", "topic": "B02", "topic2": None, "intent": "C", "stance": -1, "flags": [], "title": "Membership plan auto renewed without notice (review, 1 star)", "source": "Google reviews", "url": None},
                                               {"id": "M007", "eye": "moon", "topic": "B08", "topic2": None, "intent": "C", "stance": -1, "flags": [], "title": "Nobody called back about the warranty claim (review, 1 star)", "source": "Google reviews", "url": None},
                                               {"id": "M008", "eye": "moon", "topic": "B04", "topic2": None, "intent": "R", "stance": 1, "flags": [], "title": "Great crew, clean work (review, 5 stars)", "source": "Google reviews", "url": None},
                                               {"id": "M009", "eye": "moon", "topic": "B02", "topic2": None, "intent": "Q", "stance": 0, "flags": [], "title": "Is 1,800 normal for a 50 gallon water heater install in Frisco? (r/Frisco thread title)", "source": "Reddit", "url": "https://www.reddit.com/r/Frisco/"},
                                               {"id": "M010", "eye": "moon", "topic": "B01", "topic2": None, "intent": "R", "stance": 1, "flags": [], "title": "Drain cleared fast, fair price (review, 5 stars)", "source": "Google reviews", "url": None},
                                               {"id": "M011", "eye": "moon", "topic": "B03", "topic2": None, "intent": "C", "stance": -1, "flags": [], "title": "Emergency line went to voicemail on a Sunday (review, 1 star)", "source": "Google reviews", "url": None},
                                               {"id": "M012", "eye": "moon", "topic": "B09", "topic2": None, "intent": "C", "stance": -1, "flags": [], "title": "Lifetime warranty turned out to cover parts only (review, 2 stars)", "source": "Google reviews", "url": None},
                                               {"id": "M013", "eye": "moon", "topic": "B04", "topic2": None, "intent": "R", "stance": 1, "flags": [], "title": "Honest about what did not need replacing (review, 5 stars)", "source": "Google reviews", "url": None},
                                               {"id": "M014", "eye": "moon", "topic": "B02", "topic2": None, "intent": "C", "stance": -1, "flags": [], "title": "Estimate fee not credited as promised (review, 2 stars)", "source": "Google reviews", "url": None},
                                               {"id": "M015", "eye": "moon", "topic": "B01", "topic2": None, "intent": "R", "stance": 1, "flags": [], "title": "Repipe done in two days as quoted (review, 5 stars)", "source": "Google reviews", "url": None},
                                               {"id": "M016", "eye": "moon", "topic": "B10", "topic2": None, "intent": "C", "stance": -1, "flags": [], "title": "Asked me to leave a 5 star review before the job was done (review, 3 stars)", "source": "Google reviews", "url": None}]},
                           "nilometer": [{"id": "N01", "domain": "Reviews", "metric": "Google review count and rating", "value": "212 reviews, 4.6; rivals 640 at 4.8 and 380 at 4.7", "date": m["run"]["run_date"], "period": "snapshot", "source": "Google review panels (screenshots)", "url": None, "grade": "B2", "note": "Counts are visible; velocity inferred from dated reviews", "topics": ["B10"]},
                                         {"id": "N02", "domain": "Demand", "metric": "Autocomplete presence, 14 seeds", "value": "client present on 0 of 14; Rival One on 6", "date": m["run"]["run_date"], "period": "snapshot", "source": "Google Autocomplete JSON", "url": None, "grade": "B2", "note": "Presence and ordering only; no volumes", "topics": ["V13"]},
                                         {"id": "N05", "domain": "Local paid", "metric": "LSA pricing change", "value": "per lead pricing moved to a bidding model in several trades (reported)", "date": "2026-08", "period": "2026", "source": "trade press summary of Google's LSA help center", "url": None, "grade": "C3", "note": "verify live before it appears in a finding", "topics": ["V03"]}]})
    mods["copy"].update({"status": "partial", "why": "Passes 1 to 2 on money-page copy; no attorney copy", "sources": ["SRC02"], "passes_run": ["1 mechanical clean (read only)", "2 measure"], "readability": {"grade_avg": 8.7, "passive_pct_avg": 11}, "flags": [{"line": None, "type": "claim", "text": "Frisco's #1 rated plumber", "action": "substantiate or remove; rival rating higher on the same platform"}]})
    m["findings"] = [
        {"id": "F001", "module": "crawl", "pillar": "Technical", "severity": "High", "evidence_class": "observed", "title": "Sitemap lists 3 noindex URLs and 1 redirecting URL", "evidence": "sitemap.xml entries return noindex meta or 301", "url": f"https://{d}/sitemap.xml", "fix": "List only live, indexable, self-canonical finals", "source": "SRC01", "owner": "Agency", "effort": "1h", "money_page": False},
        {"id": "F002", "module": "local", "pillar": "Local", "severity": "Medium", "evidence_class": "observed", "title": "Review response rate 31% against rivals at 60 to 90%", "evidence": "Google review panel screenshots, newest 40 reviews", "url": "https://www.google.com/maps", "fix": "Adopt the 24 hour response SOP; respond to every 1 to 3 star review first", "source": "SRC06", "owner": "Client", "effort": "2h/week", "money_page": False},
        {"id": "F003", "module": "technical", "pillar": "Technical", "severity": "High", "evidence_class": "observed", "title": "Primary content on the water heater page is JS-rendered (raw 120 words, rendered 940)", "evidence": "render diff: 87% of visible words absent from raw HTML", "url": f"https://{d}/services/water-heater-repair/", "fix": "Server-render the service copy; confirm with GSC URL Inspection rendered HTML", "source": "SRC03", "owner": "Agency", "effort": "4h", "money_page": True},
        {"id": "F004", "module": "content", "pillar": "Content & Top Pages", "severity": "Medium", "evidence_class": "observed", "title": "No meta description on the top service page", "evidence": "raw HTML has no meta description tag", "url": f"https://{d}/services/water-heater-repair/", "fix": "Add a 150 character description with the city and the offer", "source": "SRC02", "owner": "Agency", "effort": "15m", "money_page": True},
        {"id": "F005", "module": "content", "pillar": "Content & Top Pages", "severity": "Medium", "evidence_class": "observed", "title": "Client absent from every autocomplete seed while Rival One appears on 6 of 14", "evidence": "Autocomplete presence grid", "url": f"https://{d}/", "fix": "Build the city pages and the brand-facts page; earn the listicle placements", "source": "SRC04", "owner": "Agency", "effort": "12w program", "money_page": False},
        {"id": "F006", "module": "exposure", "pillar": "Compliance & Exposure", "severity": "Medium", "evidence_class": "observed", "title": "Meta Pixel and CallRail fire before any consent interaction on the contact page", "evidence": "pre-interaction request log shows facebook.com/tr and CallRail requests on load", "url": f"https://{d}/contact/", "fix": "US exposure, not a violation for a Texas-only plumber; gate the pixel if EU visitors matter; keep the log", "source": "SRC03", "owner": "Agency", "effort": "2h", "money_page": True},
        {"id": "F007", "module": "local", "pillar": "Local", "severity": "High", "evidence_class": "observed", "title": "No city or service-area pages; service pages carry no location terms", "evidence": "sitemap inventory and page text", "url": f"https://{d}/services/", "fix": "Location-page spec for Frisco, Plano, McKinney, Allen with real crew and job photos", "source": "SRC01", "owner": "Agency", "effort": "3w", "money_page": False},
        {"id": "F008", "module": "technical", "pillar": "Technical", "severity": "Low", "evidence_class": "observed", "title": "No HSTS and no CSP header", "evidence": "response headers", "url": f"https://{d}/", "fix": "Add HSTS; a report-only CSP first", "source": "SRC02", "owner": "Agency", "effort": "1h", "money_page": True},
        {"id": "F009", "module": "ai", "pillar": "AI Visibility", "severity": "Medium", "evidence_class": "observed", "title": "Client appears in 1 of 9 citable sources for buying-intent queries; Rival One in 6", "evidence": "fetched listicles and directories", "url": "https://news.example/best-plumbers-frisco", "fix": "Corroboration plan: 4 directory profiles, 2 local news placements, the brand-facts page", "source": "SRC04", "owner": "Agency", "effort": "6w", "money_page": False},
        {"id": "F010", "module": "content", "pillar": "Content & Top Pages", "severity": "Win", "evidence_class": "observed", "title": "Drain cleaning page is server-rendered, fast and well linked", "evidence": "raw 610 words, LCP lab 2.7 s, 148 char description", "url": f"https://{d}/services/drain-cleaning/", "fix": "Use it as the template for the other service pages", "source": "SRC02", "owner": "Agency", "effort": "", "money_page": True},
        {"id": "F011", "module": "agency", "pillar": "Agency Fit", "severity": "Medium", "evidence_class": "observed", "title": "GTM container shared with two unrelated client sites of the agency of record", "evidence": "same GTM ID observed on three domains", "url": f"https://{d}/", "fix": "Move to a client-owned container; export the tags first", "source": "SRC02", "owner": "Agency", "effort": "3h", "money_page": False},
        {"id": "F012", "module": "market", "pillar": "Market Position", "severity": "High", "evidence_class": "observed", "title": "Customers talk about price and billing surprises more than anything else; the site never mentions pricing", "evidence": "Brand Stereopsis: B02 floor-led (5 of 16 floor items complaints on price); 0 sun items on price", "url": f"https://{d}/", "fix": "Publish a pricing and fees page (trip fee, estimate credit, membership renewal terms) and link it from every service page", "source": "SRC06", "owner": "Client", "effort": "1w", "money_page": True},
    ]
    m["exposure"] = [
        {"id": "X001", "battery": "A", "test": "A6", "rule": "Pre-consent tracker firing on an intake page", "cite": "US: exposure (CIPA class actions; Meta business tools terms); no Texas statute binds a plumber", "cite_fetched": None, "cite_vintage": "doctrine dated 2026-09-28; not re-fetched", "evidence": "facebook.com/tr fires on load of /contact/ before any interaction", "url": f"https://{d}/contact/", "disposition": "CANDIDATE", "confidence": "Plausible", "severity": "Low", "base_rate": "low for a Texas-only local business; rises with EU or CA traffic", "control": None, "open_question": "Does the site take EU or California traffic?", "route": "NONE", "channel": ""},
        {"id": "X002", "battery": "E", "test": "W10", "rule": "Review solicitation conditioned before completion; sentiment-shaped ask", "cite": "16 CFR 465.4 (incentives conditioned on sentiment) and 465.7 (suppression)", "cite_fetched": None, "cite_vintage": "doctrine dated 2026-09-28; fetch ecfr.gov before CONFIRMED", "evidence": "one review states the tech asked for a 5 star review before the job was done", "url": "https://www.google.com/maps", "disposition": "CANDIDATE", "confidence": "Weak", "severity": "Medium", "base_rate": "FTC review-rule sweeps Dec 2025; enforcement targets patterns, not one review", "control": None, "open_question": "Is there a script or incentive behind the ask? Check the invoice footer and the review request SMS", "route": "NONE", "channel": ""},
        {"id": "X003", "battery": "D", "test": "W20", "rule": "Texas plumbing license number display in advertising", "cite": "Tex. Occ. Code ch. 1301 and TSBPE rules (display of the Responsible Master Plumber license number)", "cite_fetched": None, "cite_vintage": "doctrine dated 2026-09-28; fetch the TSBPE rule before CONFIRMED", "evidence": "license number M-XXXXX appears in the footer on every page", "url": f"https://{d}/", "disposition": "CLEARED", "confidence": "Confirmed", "severity": "Low", "base_rate": "", "control": "Observed compliance: number present", "open_question": "", "route": "NONE", "channel": ""},
        {"id": "X004", "battery": "B", "test": "W7", "rule": "'#1 Rated' superlative without a conferring body", "cite": "FTC Act §5 (substantiation); Tex. DTPA §17.46(b)", "cite_fetched": None, "cite_vintage": "doctrine dated 2026-09-28", "evidence": "homepage hero: 'Frisco's #1 rated plumber'; rival rating higher on Google", "url": f"https://{d}/", "disposition": "CANDIDATE", "confidence": "Plausible", "severity": "Low", "base_rate": "rarely enforced alone; a fix, not a filing", "control": None, "open_question": "Is there a platform where the client is rated first?", "route": "NONE", "channel": ""},
    ]
    m["verify_queue"] = [
        {"id": "V001", "item": "GBP profile fields and pack membership", "url": "https://business.google.com/", "what": "Screenshots of the profile, services, categories and the local finder for 'plumber frisco'", "why": "Local pillars C and G are unverified", "owner": "Client"},
        {"id": "V002", "item": "Index status of the 5 orphan URLs", "url": "https://search.google.com/search-console", "what": "URL Inspection on each; export Pages (Indexing)", "why": "The crawl cannot see what Google indexed", "owner": "Client"},
        {"id": "V003", "item": "Meta and Google ad presence for the three rivals", "url": "https://www.facebook.com/ads/library/", "what": "Library screenshots by advertiser name, 90 days", "why": "Libraries are blocked from this vantage", "owner": "Agency"},
    ]
    m["tasks"] = [
        {"Name": "Grant GSC and GA4 access; export Performance 16 months", "Description": "Task #1. Without it every ranking and traffic statement stays a protocol. Est: 30m", "Section/Column": "Data & Verification", "Priority": "High", "Tags": "tier-1"},
        {"Name": "Server-render the water heater page content", "Description": f"https://{d}/services/water-heater-repair/ shows 120 raw words vs 940 rendered. Confirm with URL Inspection afterwards. Est: 4h", "Section/Column": "Crawlability & Indexing", "Priority": "High", "Tags": "money-page"},
        {"Name": "Publish a pricing and fees page", "Description": "Trip fee, estimate credit, membership renewal terms, warranty scope. Link from every service page. Est: 1w", "Section/Column": "Content", "Priority": "High", "Tags": "market"},
        {"Name": "Clean the sitemap", "Description": "Remove 3 noindex and 1 redirecting entry; list https finals only. Est: 1h", "Section/Column": "Technical SEO", "Priority": "Medium", "Tags": ""},
        {"Name": "Build four location pages", "Description": "Frisco, Plano, McKinney, Allen per the location-page spec; real crew photos. Est: 3w", "Section/Column": "Local SEO", "Priority": "High", "Tags": ""},
    ]
    m["analysis"].update({
        "headline": "The site is losing the local pack to rivals with three times the review velocity, and the money pages Google can see are half empty.",
        "bluf": ["Calls dropped because the redesign moved the service copy into JavaScript that the raw HTML does not carry, while two rivals kept adding reviews and suburb pages. The plumber is invisible in autocomplete for every money seed.",
                 "The compliance picture is calm: four observations, none CONFIRMED, one CLEARED. The pre-consent pixels are an exposure to note, not a filing.",
                 "Customers talk about price surprises more than any other subject and the site never mentions pricing. Publishing fees and terms is the fastest reputation move available."],
        "win_watch_next": {"win": "Drain cleaning page: fast, server-rendered, well linked", "watch": "Rival One's review velocity (22 per month) and suburb pages", "next": "Server-render the water heater page and clean the sitemap this week"},
        "one_rival": "Rival One Plumbing", "one_paid_opportunity": "LSA in Frisco for water heater and drain (rivals present, client absent; protocol until exports)", "one_exposure": "Pre-consent Meta Pixel on the contact page (exposure, not a violation for a Texas-only business)",
        "key_judgments": [{"id": "KJ1", "title": "Local visibility recovers only if the money pages are server-rendered", "judgment": "It is likely that the water heater and other JS-rendered service pages are under-indexed and that server-rendering them restores impressions within 60 days.", "likelihood": "likely", "range": "55 to 80%", "confidence": "moderate", "horizon": "60 days", "evidence": ["F003", "N02", "metrics:crawl"], "falsifiers": ["GSC URL Inspection shows the rendered content already indexed", "Impressions do not move 60 days after the fix"]},
                          {"id": "KJ2", "title": "Price transparency will move review sentiment before it moves rankings", "judgment": "It is likely that a published fees page reduces price complaints as a share of new reviews within one quarter; the ranking effect is very unlikely to be measurable.", "likelihood": "likely; very unlikely (ranking effect)", "range": "55 to 80% / 5 to 20%", "confidence": "low to moderate", "horizon": "90 days", "evidence": ["F012", "N01", "metrics:brand"], "falsifiers": ["Price complaints stay above a third of new reviews after the page has been live 60 days"]}],
        "scenarios": {"axes": ["Rival One keeps or stops its suburb page program", "The client fixes rendering within 30 days or later"], "quadrants": [{"name": "Fixed and rival stalls", "probability": 25, "narrative": "Pack position recovers by Q1", "signposts": ["autocomplete presence appears"]}, {"name": "Fixed and rival pushes", "probability": 40, "narrative": "Recovery on service queries, pack contested", "signposts": ["review velocity gap narrows"]}, {"name": "Late fix and rival stalls", "probability": 15, "narrative": "Slow drift back", "signposts": []}, {"name": "Late fix and rival pushes", "probability": 20, "narrative": "Further loss; LSA becomes the only lever", "signposts": ["LSA cost per lead rises"]}]},
        "indicators": [{"id": "I1", "watch": "GSC impressions for the water heater page", "reading": "up 30% within 60 days of the fix", "moves": "KJ1", "next_reading": "2026-11-30"}, {"id": "I2", "watch": "Share of new Google reviews mentioning price", "reading": "below 20%", "moves": "KJ2", "next_reading": "2026-12-31"}],
        "unknowns": [{"id": "U1", "text": "Whether Google indexed the rendered content (only URL Inspection can say)"}, {"id": "U2", "text": "Rival ad spend and LSA budgets"}],
        "graveyard_test": [{"prophecy": "AI Overviews will end local search clicks", "shape": "platform announced, default on, silent on the floor", "test": "local pack clicks in owners' GSC exports; not yet observed here"}],
        "moves": [{"id": "P1", "move": "Server-render the service pages", "justified_by": ["KJ1"]}, {"id": "P2", "move": "Publish pricing and fees; link everywhere", "justified_by": ["KJ2"]}, {"id": "P3", "move": "Review response SOP and a 24 hour rule", "justified_by": ["KJ2"]}],
        "limitations": ["Tier 0: no exports; rankings, traffic and spend are protocols", "Brand read: 10 sun items and 16 moon items; below the 20 and 15 minimums for the sun eye, so the gap is directional", "Industry read summarized, not re-coded this run", "Ad libraries and Maps not fetchable from this vantage"],
        "scorecard_notes": {"Local": "Two pillars unverified; grade rests on on-site signals and review screenshots"},
    })
    m["playbook"].update({
        "phases": [{"phase": "Days 1 to 30", "moves": ["Fix rendering on service pages", "Clean the sitemap", "Publish pricing and fees", "Start the review SOP", "Grant GSC and GA4 access"]}, {"phase": "Days 31 to 60", "moves": ["Ship four location pages", "Brand-facts page and Organization JSON-LD", "Directory profiles and two listicle pitches"]}, {"phase": "Days 61 to 90", "moves": ["LSA pre-flight and launch decision", "Prompt Tracker baseline", "Measure and re-run"]}],
        "moves12": [{"n": 1, "move": "Server-render service page copy", "impact": "High", "effort": "Medium", "owner": "Agency", "when": "Week 1"}, {"n": 2, "move": "Sitemap hygiene", "impact": "Medium", "effort": "Low", "owner": "Agency", "when": "Week 1"}, {"n": 3, "move": "Pricing and fees page", "impact": "High", "effort": "Medium", "owner": "Client", "when": "Week 2"}, {"n": 4, "move": "Review response SOP", "impact": "Medium", "effort": "Low", "owner": "Client", "when": "Week 1"}, {"n": 5, "move": "Location pages x4", "impact": "High", "effort": "High", "owner": "Agency", "when": "Weeks 3 to 6"}, {"n": 6, "move": "Brand-facts page + Organization graph", "impact": "Medium", "effort": "Low", "owner": "Agency", "when": "Week 4"}],
        "on_page": [{"url": f"https://{d}/services/water-heater-repair/", "title": "Water Heater Repair in Frisco, TX | Same Day | Example Plumbing", "description": "Licensed Frisco plumbers repair and replace tank and tankless water heaters, usually same day. Upfront pricing, lifetime repipe warranty. Call for a quote."}],
        "schema_blocks": [{"type": "Plumber", "url": f"https://{d}/", "jsonld": {"@context": "https://schema.org", "@type": "Plumber", "name": "Example Plumbing Co", "url": f"https://{d}/", "telephone": "+1-972-555-0100", "address": {"@type": "PostalAddress", "addressLocality": "Frisco", "addressRegion": "TX"}, "areaServed": ["Frisco", "Plano", "McKinney", "Allen"]}}],
    })
    m["glossary"] = [{"term": "Referring domains", "def": "The count of distinct websites linking to the site. Ten links from one site count once. The honest authority proxy; vendor scores are not used."}, {"term": "Brand Stereopsis", "def": "The measured gap between what the brand says about itself and what customers say about it, topic by topic. A positive gap means customers raise it more than the brand does."}, {"term": "CONFIRMED / CANDIDATE / CLEARED", "def": "The three dispositions for any compliance observation: proven and routable, real but with an innocent reading still open, or knocked down by a control."}]
    return m


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("domain")
    ap.add_argument("--archetype", required=True)
    ap.add_argument("--secondary")
    ap.add_argument("--vertical", default="")
    ap.add_argument("--posture", default="competitor", choices=["competitor", "self-audit"])
    ap.add_argument("--recipient", default="")
    ap.add_argument("--business", default="")
    ap.add_argument("--geo", default="")
    ap.add_argument("--jurisdiction", action="append")
    ap.add_argument("--surfaces")
    ap.add_argument("--question", default="")
    ap.add_argument("--modules")
    ap.add_argument("--fetch-budget", type=int, default=60)
    ap.add_argument("--cache", default="omega_cache")
    ap.add_argument("--run-id")
    ap.add_argument("--archetypes", default=str(ROOT / "assets" / "archetypes.json"))
    ap.add_argument("--homepage", default=None, help="homepage URL when it is not https://<domain>/ (a www host, a staging host, a local test server)")
    ap.add_argument("--demo", action="store_true", help="fill the manifest with the offline fixture (never ship it)")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    domain = slug_domain(a.domain)
    table = load_json(Path(a.archetypes))
    arch = archetype(a.archetype, table)
    m = skeleton(domain, arch, table, a)
    if a.demo:
        m = demo_fill(m)
        m["run"]["judgment_calls"].insert(0, "DEMO FIXTURE: every number is invented to exercise the pipeline. Never ship.")
    cache = Path(a.cache) / domain
    for sub in ("runs", "html", "web", "render", "psi", "schema", "links", "apps", "dns", "google_crawl", "google_shots", "search", "screenshots", "exports", "market"):
        (cache / sub).mkdir(parents=True, exist_ok=True)
    dest = cache / "runs" / (m["run"]["id"] + ".json")
    if dest.exists() and not a.force:
        raise SystemExit(f"{dest} exists; pass --force to overwrite or --run-id for a new run")
    dest.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"manifest: {dest}")
    print(f"archetype: {arch['label']}; modules planned: {', '.join(m['run']['modules_planned'])}")
    print(f"nome: {arch.get('nome')}; codex overlays: {arch.get('codex_overlays')}")
    print("exports to request (batch into one message):")
    for e in m["run"]["exports_requested"]:
        print("  -", e)


if __name__ == "__main__":
    main()
