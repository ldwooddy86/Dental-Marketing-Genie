#!/usr/bin/env python3
"""OMEGAWEAPON platform: Anubis, the weighing of each tracked agency (the deep dossier engine).

A dossier has two halves. The spine is computed here from the registry: identity, what the agency sells and the
evidence behind each line, its moves in date order, its clients with the needs read, its own house, the Horus and
Monsoon reads, the openings (rules over the record: contradictions, gaps, exposed judgments, price exposure, shopping
clients), the watch list, and the evidence index (every URL the record holds). The narrative is written by an analyst
from the spine and nothing else (references/anubis.md is the doctrine), stored one file per agency in
assets/radar/dossiers/<id>.json, validated here (no dashes, every figure and every name traceable to the record, no
filler), and merged into the registry for the app and the book.

Usage
  python3 scripts/radar_dossier.py spine [--write] [--briefs <dir>]     compute every spine; export writer briefs
  python3 scripts/radar_dossier.py validate [--dossiers <dir>] [--fix]  check every narrative against its record
  python3 scripts/radar_dossier.py merge [--dossiers <dir>] [--write]   attach validated narratives to the registry
  python3 scripts/radar_dossier.py book [--out anubis-book.html]         one printable page with every dossier
  python3 scripts/radar_dossier.py one <agency id>                       print one spine
Pure standard library.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import radar_horus  # noqa: E402

RADAR_PATH = ROOT / "assets" / "radar" / "radar.json"
DOSSIER_DIR = ROOT / "assets" / "radar" / "dossiers"
SECTIONS = ["bluf", "doing", "clients", "house", "market", "openings"]
MIN_WORDS = {"bluf": 45, "doing": 120, "clients": 100, "house": 60, "market": 70, "openings": 70}
FILLER = ["delve", "in today's", "in today’s", "landscape", "leverag", "it's worth noting", "it is worth noting", "in conclusion", "game-changer", "game changer", "cutting-edge", "cutting edge",
          "unlock", "seamless", "robust", "holistic", "synerg", "elevate", "empower", "navigate the", "ever-evolving", "ever evolving", "testament to", "tapestry", "in the realm", "a deep dive", "look no further"]
CAP_LABEL_FALLBACK = {"linkedin": "LinkedIn advertising", "content": "Publishing cadence"}


def load_registry(path: Path = RADAR_PATH) -> dict:
    return radar_horus.load_radar(path)


def emp_str(a: dict) -> str | None:
    e = a.get("employees")
    v = e.get("value") if isinstance(e, dict) else e
    return str(v) if v else None


def people_str(v) -> str:
    """'501-1,000' -> '501-1,000 people'; '90+ marketing experts' stays as written."""
    s = str(v or "")
    return s + " people" if (re.fullmatch(r"[\d.,+\s-]+", s) or re.search(r"\d\+?$", s)) else s


MODEL_NAMES = {"claude-fable-5-1": "Fable 5.1", "claude-opus-5-5": "Opus 5.5", "claude-sonnet-5-5": "Sonnet 5.5", "claude-mythos-5-1": "Mythos 5.1"}


def model_name(m: str | None) -> str:
    return MODEL_NAMES.get(m or "", m or "")


def url_label(u):
    """A readable label for a bare source URL: the page path, or 'home page' for the root."""
    if not u:
        return "source"
    t = re.sub(r"^https?://(www\.)?", "", str(u)).rstrip("/")
    host, _, path = t.partition("/")
    path = re.sub(r"\.(html?|php|aspx?)$", "", path)
    if not path:
        return "home page"
    return "page: /" + path[:44]


def spine(a: dict, radar: dict) -> dict:
    dims = radar["meta"]["strat_dims"]
    label = dict(dims)
    label.update(CAP_LABEL_FALLBACK)
    ed = radar["horus"]["edition"]
    kjt = {k["id"]: k for k in ed["key_judgments"]}
    ind = {i["id"]: i for i in ed["indicators"]}
    scen = {s["id"]: s["name"] for s in ed["scenarios"]["items"]}
    hz = a.get("horus") or {}
    mo = a.get("offshore") or {}
    nd = a.get("needs") or {}
    strat = a.get("strategy") or {}
    sev = a.get("strategy_evidence") or {}
    focus = []
    for k, l in dims:
        sc = strat.get(k)
        if sc is None:
            continue
        e = sev.get(k) or {}
        focus.append({"cap": k, "label": l, "score": sc, "note": e.get("note"), "url": e.get("url"), "lead": k in (a.get("lead") or []), "core": k in (a.get("core") or [])})
    focus.sort(key=lambda x: (-(x["score"] or 0), x["label"]))
    moves = sorted([m for m in (a.get("moves") or []) if isinstance(m, dict)], key=lambda m: str(m.get("date") or ""), reverse=True)
    deep = a.get("deep") or {}
    news = sorted([n for n in (deep.get("news") or []) if isinstance(n, dict)], key=lambda n: str(n.get("date") or ""), reverse=True)[:12]
    cases = [c for c in (deep.get("case_studies") or []) if isinstance(c, dict)][:25]
    jobs = [j for j in (deep.get("jobs") or []) if isinstance(j, dict)][:20]
    g, li = a.get("google") or {}, a.get("linkedin") or {}
    house = {
        "llms_txt": a.get("llms_txt"), "ai_bots_blocked": a.get("ai_bots_blocked") or [], "sitemap_urls": a.get("sitemap_urls"), "content_90d": a.get("content_90d"), "content_365d": a.get("content_365d"), "ai_urls": a.get("ai_urls"),
        "google": {"status": g.get("status"), "count": g.get("count"), "count_30d": g.get("count_30d"), "formats": g.get("format_counts"), "samples": (g.get("samples") or [])[:5], "advertisers": (g.get("advertisers") or [])[:6], "last_shown": g.get("last_shown")},
        "linkedin": {"status": li.get("status"), "count": li.get("count"), "company_ads": li.get("company_ads"), "thought_leader_ads": li.get("thought_leader_ads"), "samples": (li.get("samples") or [])[:5], "note": li.get("count_note")},
        "meta": (a.get("meta") or {}).get("status") if isinstance(a.get("meta"), dict) else None, "tiktok": (a.get("tiktok") or {}).get("status") if isinstance(a.get("tiktok"), dict) else None,
        "pixels_social": a.get("pixels_social") or [], "test_tools": a.get("test_tools") or [], "abm_stack": a.get("abm_stack") or [], "tags": a.get("tags") or [], "cms": a.get("cms") or [],
        "gaps": [x.get("label") for x in (a.get("gaps") or []) if x.get("label")], "tests": [{"cap": label.get(t["cap"], t["cap"]), "result": t["do"], "note": t["note"]} for t in ((hz.get("house") or {}).get("tests") or [])],
        "social_links": a.get("social_links") or {},
    }
    horus = None
    if hz.get("ok"):
        horus = {"hti": hz.get("hti"), "pct": hz.get("hti_pct"), "band": hz.get("band"), "verdict": hz.get("verdict"), "arc": (hz.get("arc_clock") or "") + " " + (hz.get("arc_word") or ""),
                 "best_fit": scen.get(hz.get("scen_best"), hz.get("scen_best")), "resilience": hz.get("resilience"),
                 "tailwinds": [{"id": k, "title": kjt[k]["title"], "net": hz["kj"][k]["net"], "drivers": [[label.get(d[0], d[0]), d[1]] for d in hz["kj"][k]["d"][:3]]} for k in (hz.get("kj_tail") or []) if k in kjt],
                 "headwinds": [{"id": k, "title": kjt[k]["title"], "net": hz["kj"][k]["net"], "drivers": [[label.get(d[0], d[0]), d[1]] for d in hz["kj"][k]["d"][:3]]} for k in (hz.get("kj_head") or []) if k in kjt],
                 "moves": {p: {"status": m["s"], "why": m["why"]} for p, m in (hz.get("moves") or {}).items()},
                 "move_names": {p: ed["implications"][i]["move"] for i, p in enumerate([x["id"] for x in ed["implications"]])},
                 "rails": {r: v["score"] for r, v in (hz.get("rails") or {}).items()}, "graveyard": bool(hz.get("graveyard")), "integrity": (hz.get("house") or {}).get("integrity")}
    monsoon = None
    if mo.get("ok"):
        monsoon = {"index": mo.get("index"), "pct": mo.get("index_pct"), "band": mo.get("band"), "migration": mo.get("migration"), "displacement": mo.get("displacement"), "asia": mo.get("asia"), "shore": mo.get("shore"),
                   "verdict": mo.get("verdict"), "evidence_class": mo.get("evidence_class"), "terms": [{"term": t["term"], "pts": t["pts"], "class": t["class"]} for t in (mo.get("terms") or {}).get("migration", []) + (mo.get("terms") or {}).get("displacement", [])],
                   "hub_offices": [h["place"] for h in mo.get("hub_offices") or []], "onshore_claims": [c["t"] for c in (mo.get("onshore_claims") or [])][:3], "overlap": mo.get("overlap")}
    openings = openings_rules(a, radar, label, kjt, house, hz, mo, nd, focus)
    watch = []
    for w in (hz.get("watch") or []):
        i = ind.get(w["id"])
        if i:
            watch.append({"id": i["id"], "indicator": i.get("indicator"), "watch": i.get("watch"), "next": i.get("next"), "kj": w.get("kj")})
    watch.append({"id": "R", "indicator": "The Radar compile date", "watch": "A new compile refreshes offices, ads, sitemap cadence and clients; the dossier is only as fresh as " + str(radar["meta"].get("generated")), "next": "next Radar compile", "kj": None})
    evidence = []
    seen = set()
    def add_ev(lbl, url):
        if not url or url in seen:
            return
        seen.add(url)
        evidence.append({"label": lbl, "url": url})
    for u in a.get("sources") or []:
        add_ev(url_label(u), u)
    for f in focus:
        add_ev("capability evidence: " + f["label"], f["url"])
    for m in moves:
        add_ev("move " + str(m.get("date") or ""), m.get("url"))
    for c in (nd.get("clients") or [])[:60]:
        add_ev("client: " + c["name"] + " (" + c["evidence"] + ")", c["url"])
    for p in a.get("prominence_signals") or []:
        if isinstance(p, dict):
            add_ev("prominence: " + (p.get("note") or "")[:60], p.get("url"))
    return {
        "id": a["id"], "identity": {"name": a["name"], "domain": a.get("domain"), "hq": ", ".join(x for x in [a.get("hq_city"), a.get("hq_country")] if x) or None, "region": a.get("region"), "segment": a.get("segment"), "archetype": a.get("archetype"),
                                    "ownership": a.get("ownership"), "owner": a.get("owner"), "founded": a.get("founded"), "employees": emp_str(a), "status": a.get("status"), "status_note": a.get("status_note"), "successor": a.get("successor"),
                                    "icp": a.get("icp"), "prominence": a.get("prominence"), "prominence_signals": [p for p in (a.get("prominence_signals") or []) if isinstance(p, dict)][:5], "confidence": a.get("confidence"), "offices": a.get("offices") or [], "cms": a.get("cms") or [], "partners": a.get("partners") or []},
        "positioning": {"positioning": a.get("positioning"), "headline_claim": a.get("headline_claim"), "ai_posture": a.get("ai_posture"), "pricing_signals": a.get("pricing_signals"), "services": a.get("services") or [], "proprietary": a.get("proprietary") or []},
        "focus": focus, "family_scores": a.get("family_scores") or {}, "breadth": a.get("breadth"), "lead": [label.get(k, k) for k in (a.get("lead") or [])], "core": [label.get(k, k) for k in (a.get("core") or [])],
        "moves": moves, "news": news, "case_studies": cases, "jobs": jobs, "verticals": a.get("verticals") or [],
        "needs": {"n": nd.get("n"), "observed": nd.get("observed"), "named_only": nd.get("named_only"), "mix": nd.get("mix") or [], "top": nd.get("top") or [], "shared": (nd.get("shared") or [])[:15], "shared_n": nd.get("shared_n"), "evidence_types": nd.get("evidence_types"),
                  "clients": [{"name": c["name"], "evidence": c["evidence"], "needs": c["needs"], "signal": c.get("title") or c.get("signal") or "", "url": c["url"]} for c in (nd.get("clients") or [])[:60]], "taxonomy": radar.get("needs", {}).get("taxonomy", {})},
        "house": house, "horus": horus, "monsoon": monsoon, "openings": openings, "watch": watch, "evidence": evidence, "compiled": radar["meta"].get("generated"), "edition": ed.get("edition"),
        "deepened": {"date": deep.get("deepened"), "note": deep.get("fetch_note"), "ats": deep.get("ats"), "jobs_count": deep.get("jobs_count"), "case_study_count": deep.get("case_study_count"),
                     "blog_recent_dates": (deep.get("blog_recent_dates") or [])[:6]} if deep else None,
    }


def openings_rules(a, radar, label, kjt, house, hz, mo, nd, focus) -> list[dict]:
    out = []
    strat = a.get("strategy") or {}
    for t in house["tests"]:
        if t["result"] == "contradicted":
            out.append({"kind": "contradiction", "text": "Sells " + t["cap"] + " and its own house contradicts it: " + t["note"] + ".", "class": "observed"})
    for gap in house["gaps"]:
        if not any(gap in o["text"] for o in out):
            out.append({"kind": "gap", "text": gap + ".", "class": "observed"})
    mv = (hz.get("moves") or {})
    if (strat.get("ai_search") or 0) >= 2 and mv.get("P1", {}).get("s") in ("partial", "absent"):
        out.append({"kind": "move", "text": "Sells AI search with no audited AI visibility product in its record (citation share, scorecard, tracking): a rival with the audited product leads with the number.", "class": "inferred"})
    if (strat.get("paid_search") or 0) >= 2 and mv.get("P8", {}).get("s") == "absent":
        out.append({"kind": "move", "text": "Runs paid search with no sign of testing ads inside AI assistants: the first agency in its segment to show results there sets the price.", "class": "inferred"})
    if mv.get("P4", {}).get("s") == "partial":
        out.append({"kind": "move", "text": "Runs paid media without first-party data, creative volume or measurement depth showing in the record: the inputs the platforms' automation consumes are the pitch against it.", "class": "inferred"})
    if mv.get("P2", {}).get("s") == "absent" and any(k in (a.get("core") or []) for k in ("seo", "web_dev", "retail_media")):
        out.append({"kind": "move", "text": "No feed, schema or entity work in the record on a core search, web or commerce line: the machine-readable layer answer engines consume is unclaimed.", "class": "inferred"})
    if mv.get("P5", {}).get("s") == "unknown":
        out.append({"kind": "move", "text": "No public pricing model: a transparent, outcome-priced offer against it is a sales conversation it cannot have in public.", "class": "inferred"})
    if house["ai_bots_blocked"] and (strat.get("ai_search") or 0) >= 1:
        out.append({"kind": "contradiction", "text": "Blocks AI crawlers (" + ", ".join(house["ai_bots_blocked"]) + ") while selling AI visibility.", "class": "observed"})
    for k in (hz.get("kj_head") or [])[:1]:
        if k in kjt:
            drv = ", ".join(label.get(d[0], d[0]) for d in hz["kj"][k]["d"][:2] if d[1] < 0)
            out.append({"kind": "judgment", "text": "Most exposed to " + k + " (" + kjt[k]["title"] + ")" + (", driven by " + drv if drv else "") + ": the sold mix leans on the hours that judgment removes.", "class": "inferred"})
    if mo.get("ok"):
        if (mo.get("displacement") or 0) >= 65:
            out.append({"kind": "price", "text": "Displacement " + str(int(round(mo["displacement"]))) + " on the Monsoon read: the book buys on price and an offshore-delivered rival can undercut it line by line.", "class": mo.get("evidence_class", "inferred")})
        if (mo.get("migration") or 0) >= 65 and mo.get("hub_offices"):
            out.append({"kind": "price", "text": "Delivery footprint already listed in " + ", ".join(sorted({h['place'] for h in mo['hub_offices']})) + ": an onshore-delivery pitch has something concrete to point at.", "class": "observed"})
        if mo.get("onshore_claims") and (mo.get("base") or 0) >= 55:
            out.append({"kind": "claim", "text": "Claims in-house or onshore delivery while selling a mix that is mostly movable hours: a claim to test in the sales room.", "class": "observed"})
    shared = nd.get("shared") or []
    shoppers = [s for s in shared if len(s["agencies"]) >= 2]
    if shoppers:
        out.append({"kind": "clients", "text": "Clients that shop: " + ", ".join(s["name"] for s in shoppers[:6]) + (" and " + str(len(shoppers) - 6) + " more" if len(shoppers) > 6 else "") + " appear on other tracked agencies' books too.", "class": "observed"})
    if nd.get("n") and nd.get("named_only", 0) / max(1, nd["n"]) >= 0.7:
        out.append({"kind": "clients", "text": "The client book is mostly names without described work (" + str(nd["named_only"]) + " of " + str(nd["n"]) + "): the evidence of what it does for them is thin, which is a question to ask its clients.", "class": "observed"})
    if house.get("content_90d") == 0 and (house.get("sitemap_urls") or 0) > 0 and not any("Blog exists" in o["text"] for o in out):
        out.append({"kind": "content", "text": "Nothing updated in its sitemap in the last 90 days: the publishing machine is idle.", "class": "observed"})
    if a.get("status") in ("merged", "acquired-rebranded", "uncertain"):
        out.append({"kind": "transition", "text": "Brand status is " + a["status"] + (": " + a["status_note"] if a.get("status_note") else "") + ". Clients in a transition answer the phone.", "class": "observed"})
    if house["google"]["status"] in ("none", "not_found") and (strat.get("paid_search") or 0) >= 2 and not any("Transparency Center" in o["text"] for o in out):
        out.append({"kind": "contradiction", "text": "Sells paid search and runs no Google ads of its own in the Transparency Center.", "class": "observed"})
    return out


# ------------------------------------------------------------------------------------------------------------ writer briefs
def brief(sp: dict) -> dict:
    """The spine, trimmed to what a writer needs; nothing outside it may appear in the narrative."""
    b = json.loads(json.dumps(sp))
    b["needs"]["clients"] = b["needs"]["clients"][:40]
    b["evidence"] = b["evidence"][:40]
    b["case_studies"] = b["case_studies"][:15]
    b["news"] = b["news"][:8]
    b["jobs"] = b["jobs"][:10]
    return b


# ------------------------------------------------------------------------------------------------------------ validation
def record_blob(a: dict, sp: dict) -> str:
    return json.dumps(a, ensure_ascii=False) + " " + json.dumps(sp, ensure_ascii=False)


def figures(text: str) -> list[str]:
    return re.findall(r"(?<![A-Za-z])(?:\$|£|€)?\d[\d,]*(?:\.\d+)?%?", text or "")


def validate_one(a: dict, sp: dict, d: dict) -> list[str]:
    errs = []
    for s in SECTIONS:
        t = d.get(s)
        if not isinstance(t, str) or len(t.split()) < MIN_WORDS[s]:
            errs.append(f"{s}: missing or under {MIN_WORDS[s]} words")
    if not isinstance(d.get("watch"), list) or len(d["watch"]) < 3:
        errs.append("watch: fewer than three items")
    blob = record_blob(a, sp)
    blob_nums = set(re.findall(r"\d[\d,]*(?:\.\d+)?", blob))
    blob_nums_plain = {x.replace(",", "") for x in blob_nums}
    low = blob.lower()
    alltext = " ".join(d.get(s) or "" for s in SECTIONS) + " " + " ".join(d.get("watch") or [])
    if "\u2014" in alltext or "\u2013" in alltext:
        errs.append("em or en dash in the narrative")
    for f in FILLER:
        if f in alltext.lower() and f not in low:
            errs.append("filler phrase: " + f)
    for fig in set(figures(alltext)):
        core = fig.strip("$£€%").replace(",", "")
        if core in ("", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "15", "20", "24", "30", "50", "60", "90", "100", "365"):
            continue
        if core in blob_nums_plain or fig.strip("$£€%") in blob_nums or core in low:
            continue
        errs.append("figure not in the record: " + fig)
    # client names mentioned must be in the record (only check capitalised multi-word or distinctive names from the narrative that look like brands)
    names = {c["name"] for c in sp["needs"]["clients"]}
    ctext = re.sub(r"[.!?]\s+", " | ", (d.get("clients") or "").replace("\u2019", "'"))
    for m in re.findall(r"\b([A-Z][A-Za-z0-9&']+(?: [A-Z][A-Za-z0-9&']+){0,3})\b", ctext):
        base = m[:-2] if m.endswith("'s") else m
        if m in names or base in names or m.lower() in low or base.lower() in low:
            continue
        m = base
        if m.split()[0] in ("The", "Its", "It", "This", "These", "Those", "A", "An", "In", "On", "For", "With", "What", "Where", "Who", "Which", "When", "Their", "They", "Most", "Some", "None", "No", "Every", "Two", "Three", "Four", "Five", "One", "Half", "Both", "Clients", "Client", "Evidence", "Case", "Press", "Named", "Named", "Observed", "Inferred", "Organic", "Paid", "Brand", "Web", "Data", "CRM", "Commerce", "Social", "AI", "Leads", "B2B", "PR", "North", "South", "East", "West", "United", "European", "Europe", "US", "UK", "Google", "Meta", "Amazon", "LinkedIn", "TikTok", "Microsoft", "Radar", "Horus", "Monsoon", "Anubis", "Landfall", "Onshore", "Breeze", "Doldrums", "Tailwind", "Favored", "Neutral", "Exposed", "Headwind", "Shopify", "Adobe", "Salesforce", "HubSpot", "Klaviyo", "Braze", "ChatGPT", "Gemini", "Perplexity", "Claude", "Reddit", "YouTube", "Instagram", "Pinterest", "Snap", "Apple", "Walmart", "Bing", "Yelp",
                              "Because", "Under", "Further", "Other", "Another", "Several", "Many", "Each", "All", "Also", "Then", "Still", "Yet", "Only", "Neither", "Either", "Across", "Beyond", "Behind", "Against", "Six", "Eleven", "Twelve", "Twenty", "Thirty", "Forty", "Fifty", "Hundred", "Thousand", "Six", "Seven", "Eight", "Nine", "Ten", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "English", "German", "French", "Spanish", "Italian", "Dutch", "Polish", "SMB", "CTV", "SEO", "PPC", "GEO", "ABM", "CRO", "UX", "SaaS", "DTC", "ICP", "KJ", "Local", "Services", "Ads", "Transparency", "Center", "Ad", "Library", "Business", "Profile", "Solar", "Arc", "Nilometer", "Sun", "Moon", "Key", "Judgment", "Judgments", "Asia", "Southeast", "Eastern", "Latin", "America", "Africa", "Maghreb", "Philippines", "India", "Pakistan", "Vietnam", "Poland", "Ukraine", "Mexico", "Brazil", "Argentina", "Colombia"):
            continue
        errs.append("name not in the record: " + m)
    for u in re.findall(r"https?://\S+", alltext):
        if u.rstrip(".,)") not in blob:
            errs.append("url not in the record: " + u[:60])
    errs += count_findings(sp, d)
    return errs


NUM_WORDS = {w: i for i, w in enumerate(["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
                                         "twenty one", "twenty two", "twenty three", "twenty four", "twenty five", "twenty six", "twenty seven", "twenty eight", "twenty nine", "thirty"])}
NUM_RX = r"(\d+|" + "|".join(sorted(NUM_WORDS, key=len, reverse=True)) + r")"


def _num(x: str) -> int | None:
    x = x.strip().lower()
    if x.isdigit():
        return int(x)
    return NUM_WORDS.get(x)


def count_findings(sp: dict, d: dict) -> list[str]:
    """The client counts a narrative states against the spine's needs read (the figure check skips small integers)."""
    nd = sp.get("needs") or {}
    n, obs, named = nd.get("n"), nd.get("observed"), nd.get("named_only")
    if n is None:
        return []
    text = " ".join(d.get(s) or "" for s in ("bluf", "clients", "openings")).lower()
    NUM = r"\b" + NUM_RX + r"\b"
    out = []
    def chk(label, val, want):
        if want is not None and val is not None and val != want:
            out.append(f"counts: says {val} {label}, spine says {want}")
    for m in re.finditer(r"(?<!not )" + NUM + r"\s+(?:named\s+)?clients?\s+(?:are|is)\s+named\b(?!\s+only)", text):
        chk("clients named", _num(m.group(1)), n)
    for m in re.finditer(NUM + r"\s+(?:of\s+(?:them\s+|these\s+|which\s+)?)?(?:clients?\s+)?(?:carry|carries|have|has)\s+(?:readable\s+|described\s+)?engagement\s+evidence\b", text):
        chk("with engagement evidence", _num(m.group(1)), obs)
    for m in re.finditer(NUM + r"\s+observed\s+and\s+" + NUM + r"\s+(?:names?|named)\s+only\b", text):
        chk("observed", _num(m.group(1)), obs)
        chk("names only", _num(m.group(2)), named)
    for m in re.finditer(NUM + r"\s+of\s+(?:its\s+|the\s+)?" + NUM + r"\s+(?:named\s+)?(?:clients?\s+)?(?:on\s+record\s+)?(?:are|is|remain|remains|come|sit)?\s*(?:names?\s+only|named\s+only)\b", text):
        chk("names only", _num(m.group(1)), named)
        chk("clients in the of-total", _num(m.group(2)), n)
    for m in re.finditer(r"(?<!of )(?<!its )(?<!the )(?<!these )" + NUM + r"\s+(?:named\s+)?clients?\s+(?:are|is|remain|remains)\s+(?:names?\s+only|named\s+only)\b", text):
        chk("names only", _num(m.group(1)), named)
    for m in re.finditer(NUM + r"\s+of\s+(?:its\s+|the\s+)?" + NUM + r"\s+(?:named\s+)?clients?\s+(?:carry|carries|have|has)\s+no\s+described\s+work", text):
        chk("with no described work", _num(m.group(1)), named)
        chk("clients in the of-total", _num(m.group(2)), n)
    for m in re.finditer(r"the\s+other\s+" + NUM + r"\s+(?:are|is)\s+names?\s+only", text):
        chk("names only", _num(m.group(1)), named)
    for m in re.finditer(r"\ball\s+" + NUM + r"\s+clients\s+on\s+record\s+are\s+names?\s+only", text):
        chk("names only", _num(m.group(1)), named)
        chk("clients in the all-total", _num(m.group(1)), n)
    return out


def strip_dashes(t: str) -> str:
    return t.replace("\u2014", ",").replace("\u2013", " to ").replace(" ,", ",")


# ------------------------------------------------------------------------------------------------------------ book
def book_html(radar: dict, ids: list | None = None, written_only: bool = False, top: int = 10) -> str:
    """The printable book. Part one is the ten most prominent agencies, part two the other written dossiers,
    part three the spines that have no narrative yet. --ids narrows to a list, --written-only drops part three."""
    esc = lambda s: html.escape(str(s if s is not None else ""), quote=False)
    pool = [a for a in radar["agencies"] if not ids or a["id"] in ids or a.get("domain") in ids]
    has_text = lambda a: bool((a.get("dossier") or {}).get("text"))
    if written_only:
        pool = [a for a in pool if has_text(a)]
    ten = sorted(pool, key=lambda x: -(x.get("prominence") or 0))[:top]
    ten_ids = {a["id"] for a in ten}
    rest_written = sorted([a for a in pool if a["id"] not in ten_ids and has_text(a)], key=lambda x: x["name"].lower())
    spines = sorted([a for a in pool if a["id"] not in ten_ids and not has_text(a)], key=lambda x: x["name"].lower())
    A = ten + rest_written + spines
    n_written = sum(1 for a in pool if has_text(a))
    css = """body{font:15px/1.55 Georgia,'Iowan Old Style',serif;color:#141A1F;background:#fff;margin:0}.wrap{max-width:880px;margin:0 auto;padding:40px 28px}h1{font-size:34px;margin:0 0 4px}h2{font-size:24px;margin:0 0 4px;page-break-before:always}h2.part{font-size:30px;margin:60px 0 20px;color:#6B767C}h3{font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:#6B767C;margin:22px 0 6px}p{margin:0 0 10px}.meta{color:#47525A;font-size:13px;margin-bottom:10px}.k{display:inline-block;padding:2px 8px;border:1px solid #D2D8D5;border-radius:999px;font:12px ui-monospace,monospace;margin-right:6px}table{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0 12px}th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #E3E7E5;vertical-align:top}th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6B767C}ul{margin:0 0 10px 20px;padding:0}a{color:#141A1F}.toc{columns:2;font-size:13px}.toc a{text-decoration:none}.foot{color:#6B767C;font-size:12px;margin-top:30px;border-top:1px solid #D2D8D5;padding-top:10px}.ev{font-size:12px;color:#47525A}@media print{.wrap{padding:0}h2{page-break-before:always}}"""
    parts = [f"<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'><meta name='robots' content='noindex'><title>Anubis: the weighing of {len(A)} agencies</title><style>{css}</style></head><body><div class='wrap'>",
             f"<h1>Anubis</h1><p class='meta'>The weighing of {len(A)} digital marketing agencies: {n_written} with a written weighing, {len(A) - n_written} with the computed spine only. Agency Radar compiled {esc(radar['meta'].get('generated'))} · Horus edition {esc(radar['horus']['edition'].get('edition'))} · every figure and name below traces to the agency's own public record; inferred lines say so. Doctrine: references/anubis.md.</p>",
             "<h3>How to read a weighing</h3><p class='meta'>Each entry opens with the bluf (what it is, what the record shows, the one thing a rival should know), then what the agency is doing and focusing on with the sold mix and its evidence, its clients and what the evidence says they came for, its own house (does it practise what it sells), the market read (Horus and Monsoon), where it can be beaten with a falsifier for each opening, and what to watch. Openings computed from the record are listed with their evidence class after the written openings.</p>"]
    def toc(title, rows, note=None):
        if not rows:
            return ""
        return f"<h3>{esc(title)}</h3>" + (f"<p class='meta'>{esc(note)}</p>" if note else "") + "<div class='toc'>" + "".join(f"<div><a href='#{esc(a['id'])}'>{esc(a['name'])}</a> <span class='ev'>{esc(a.get('hq_country') or a.get('region') or '')}{'' if has_text(a) else ' · spine only'}</span></div>" for a in rows) + "</div>"
    parts.append(toc("Part one: the ten", ten, "The ten most prominent agencies in the Radar, by the prominence score, in that order."))
    parts.append(toc("Part two: the written", rest_written, "Every other agency with a written weighing, alphabetical."))
    parts.append(toc("Part three: spines only", spines, "Computed spines awaiting the Anubis pass; the figures are complete, the narrative is not."))
    tax = (radar.get("needs") or {}).get("taxonomy") or {}
    for i, a in enumerate(A):
        if i == 0 and ten:
            parts.append("<h2 class='part'>Part one: the ten</h2>")
        elif i == len(ten) and rest_written:
            parts.append("<h2 class='part'>Part two: the written</h2>")
        elif i == len(ten) + len(rest_written) and spines:
            parts.append("<h2 class='part'>Part three: spines only</h2>")
        d = (a.get("dossier") or {}).get("text") or {}
        sp = (a.get("dossier") or {}).get("spine") or {}
        ident = sp.get("identity") or {}
        hz, mo, nd = sp.get("horus") or {}, sp.get("monsoon") or {}, sp.get("needs") or {}
        rank = f"<span class='ev'>No. {i + 1} by prominence · </span>" if i < len(ten) else ""
        parts.append(f"<h2 id='{esc(a['id'])}'>{esc(a['name'])}</h2><p class='meta'>{rank}{esc(ident.get('domain'))} · {esc(ident.get('hq') or ident.get('region'))} · {esc(ident.get('segment'))} · {esc(ident.get('archetype'))} · {esc((ident.get('ownership') if ident.get('ownership') not in (None, 'unknown') else 'ownership not disclosed'))}{(' · ' + esc(ident.get('owner'))) if ident.get('owner') else ''}{(' · founded ' + esc(ident.get('founded'))) if ident.get('founded') else ''}{(' · ' + esc(people_str(ident.get('employees')))) if ident.get('employees') else ''} · clients: {esc(ident.get('icp') or 'n/a')}</p>")
        chips = []
        if hz:
            chips.append(f"Horus {esc(hz.get('band'))} {int(round(hz.get('hti') or 0)):+d}")
        if mo:
            chips.append(f"Monsoon {esc(mo.get('band'))} {int(round(mo.get('index') or 0))}")
        chips.append(f"{nd.get('n') or 0} clients on record")
        parts.append("<p>" + "".join(f"<span class='k'>{c}</span>" for c in chips) + "</p>")
        if not d:
            parts.append("<p class='meta'>Spine only: the narrative has not been written for this agency yet. The tables and computed lines below are complete; the Anubis pass (references/anubis.md) adds the weighing.</p>")
            if (sp.get("positioning") or {}).get("positioning"):
                parts.append(f"<h3>Positioning</h3><p>{esc(sp['positioning']['positioning'])}</p>")
            fo = sp.get("focus") or []
            if fo:
                parts.append("<h3>The sold mix with its evidence</h3><table><thead><tr><th>Capability</th><th>Score</th><th>Evidence</th></tr></thead><tbody>" + "".join(f"<tr><td>{esc(f['label'])}{' (leads)' if f.get('lead') else ''}</td><td>{esc(f.get('score'))}</td><td class='ev'>{esc(f.get('note') or 'no evidence note')}</td></tr>" for f in fo if (f.get('score') or 0) > 0) + "</tbody></table>")
        if d:
            prov = "written " + esc(d.get("written")) + (" by " + esc(model_name(d.get("model"))) if d.get("model") else "")
            if isinstance(d.get("revised"), dict):
                prov += "; " + ", ".join(esc(x) for x in d["revised"].get("sections") or []) + " revised " + esc(d["revised"].get("date")) + " by " + esc(model_name(d["revised"].get("model")))
            parts.append(f"<h3>The weighing</h3><p class='ev'>Narrative {prov}.</p><p><b>{esc(d.get('bluf'))}</b></p>")
            parts.append(f"<h3>What it is doing and focusing on</h3>{''.join('<p>' + esc(x) + '</p>' for x in (d.get('doing') or '').split(chr(10)) if x.strip())}")
            st = d.get("stale") or {}
            if st.get("kind") == "counts":
                now = st.get("now") or {}
                parts.append(f"<p class='meta'><b>Counts superseded.</b> The client evidence was re-read after this weighing was written: the record now holds {esc(now.get('n'))} clients, {esc(now.get('observed'))} with an observed need and {esc(now.get('named_only'))} names only. The table below is the figure of record; these paragraphs are queued for a refresh.</p>")
            parts.append(f"<h3>Its clients and their needs</h3>{''.join('<p>' + esc(x) + '</p>' for x in (d.get('clients') or '').split(chr(10)) if x.strip())}")
        rows = (nd.get("clients") or [])[:40]
        if rows:
            parts.append("<table><thead><tr><th>Client</th><th>Evidence</th><th>Need read</th><th>Signal</th></tr></thead><tbody>" + "".join(f"<tr><td><a href='{esc(c['url'])}'>{esc(c['name'])}</a></td><td>{esc(c['evidence'])}</td><td>{esc(', '.join(tax.get(n, {}).get('short', n) for n in c['needs']))}</td><td class='ev'>{esc((c.get('signal') or '')[:90])}</td></tr>" for c in rows) + "</tbody></table>")
        if d:
            parts.append(f"<h3>Its own house</h3>{''.join('<p>' + esc(x) + '</p>' for x in (d.get('house') or '').split(chr(10)) if x.strip())}")
            parts.append(f"<h3>The market read</h3>{''.join('<p>' + esc(x) + '</p>' for x in (d.get('market') or '').split(chr(10)) if x.strip())}")
            parts.append(f"<h3>Where it can be beaten</h3>{''.join('<p>' + esc(x) + '</p>' for x in (d.get('openings') or '').split(chr(10)) if x.strip())}")
        ops = sp.get("openings") or []
        if ops:
            parts.append("<ul>" + "".join(f"<li>{esc(o['text'])} <span class='ev'>({esc(o['class'])})</span></li>" for o in ops) + "</ul>")
        if d and d.get("watch"):
            parts.append("<h3>Watch</h3><ul>" + "".join(f"<li>{esc(w)}</li>" for w in d["watch"]) + "</ul>")
        mv = sp.get("moves") or []
        if mv:
            parts.append("<h3>Moves on the record</h3><ul>" + "".join(f"<li>{esc(m.get('date'))}: {esc(m.get('note'))}" + (f" <a class='ev' href='{esc(m['url'])}'>source</a>" if m.get('url') else "") + "</li>" for m in mv[:10]) + "</ul>")
        ev = sp.get("evidence") or []
        if ev:
            parts.append("<h3>Evidence</h3><p class='ev'>" + " · ".join(f"<a href='{esc(e['url'])}'>{esc(e['label'][:50])}</a>" for e in ev[:25]) + "</p>")
    parts.append(f"<p class='foot'>Built {dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d')} by the OmegaWeapon platform from the Agency Radar registry. Public sources only. Nothing here is a guarantee of any outcome.</p></div></body></html>")
    return "".join(parts)


# ------------------------------------------------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["spine", "validate", "merge", "book", "one"])
    ap.add_argument("arg", nargs="?")
    ap.add_argument("--radar", default=str(RADAR_PATH))
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--briefs")
    ap.add_argument("--dossiers", default=str(DOSSIER_DIR))
    ap.add_argument("--fix", action="store_true")
    ap.add_argument("--out")
    ap.add_argument("--ids", help="book: comma separated agency ids or domains to include")
    ap.add_argument("--written-only", action="store_true", help="book: drop agencies without a written narrative")
    ap.add_argument("--top", type=int, default=10, help="book: how many agencies go in part one (by prominence)")
    a = ap.parse_args()
    radar = load_registry(Path(a.radar))
    A = radar["agencies"]
    if a.cmd == "one":
        ag = next((x for x in A if x["id"] == a.arg or x.get("domain") == a.arg), None)
        if not ag:
            raise SystemExit("no such agency")
        print(json.dumps(spine(ag, radar), indent=1, ensure_ascii=False)[:12000])
        return
    if a.cmd == "spine":
        n_open = 0
        for ag in A:
            sp = spine(ag, radar)
            ag.setdefault("dossier", {})["spine"] = sp
            n_open += len(sp["openings"])
            if a.briefs:
                bd = Path(a.briefs)
                bd.mkdir(parents=True, exist_ok=True)
                (bd / f"{ag['id']}.json").write_text(json.dumps(brief(sp), ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"spines computed for {len(A)} agencies; {n_open} openings; briefs {'exported to ' + a.briefs if a.briefs else 'not exported'}")
        if a.write:
            Path(a.radar).write_text(json.dumps(radar, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print("written")
        return
    dd = Path(a.dossiers)
    if a.cmd == "validate":
        bad = 0
        missing = 0
        for ag in A:
            p = dd / f"{ag['id']}.json"
            if not p.exists():
                missing += 1
                continue
            try:
                d = json.loads(p.read_text(encoding="utf-8"))
            except ValueError as e:
                print(f"{ag['id']}: invalid JSON ({e})")
                bad += 1
                continue
            sp = (ag.get("dossier") or {}).get("spine") or spine(ag, radar)
            if a.fix:
                for s in SECTIONS:
                    if isinstance(d.get(s), str):
                        d[s] = strip_dashes(d[s])
                d["watch"] = [strip_dashes(w) for w in (d.get("watch") or []) if isinstance(w, str)]
                p.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
            errs = validate_one(ag, sp, d)
            if errs:
                bad += 1
                print(f"{ag['id']}: " + "; ".join(errs[:8]))
        print(f"validated: {len(A) - missing - bad} clean, {bad} with findings, {missing} missing")
        return
    if a.cmd == "merge":
        n = 0
        n_stale = 0
        for ag in A:
            p = dd / f"{ag['id']}.json"
            if not p.exists():
                continue
            d = json.loads(p.read_text(encoding="utf-8"))
            sp = (ag.get("dossier") or {}).get("spine") or spine(ag, radar)
            errs = validate_one(ag, sp, d)
            count_errs = [e for e in errs if e.startswith("counts:")]
            if errs and len(count_errs) < len(errs):
                print(f"skip {ag['id']}: " + "; ".join([e for e in errs if not e.startswith("counts:")][:3]))
                continue
            text = {s: d.get(s) for s in SECTIONS} | {"watch": d.get("watch") or [], "written": d.get("written") or dt.date.today().isoformat()}
            if d.get("model"):
                text["model"] = d["model"]
            if isinstance(d.get("revised"), dict):
                text["revised"] = d["revised"]
            if count_errs:
                # the evidence was re-read after the narrative was written: the tables are the figures of record until the refresh
                nd = sp.get("needs") or {}
                text["stale"] = {"kind": "counts", "since": (sp.get("deepened") or {}).get("date") or dt.date.today().isoformat(), "findings": sorted(set(count_errs)),
                                 "now": {"n": nd.get("n"), "observed": nd.get("observed"), "named_only": nd.get("named_only")}}
                n_stale += 1
            ag.setdefault("dossier", {})["text"] = text
            n += 1
        radar["dossiers"] = {"n": n, "stale": n_stale, "written": dt.date.today().isoformat(), "doctrine": "references/anubis.md"}
        print(f"merged {n} narratives ({n_stale} with client counts superseded by a later evidence read, queued for refresh)")
        if a.write:
            Path(a.radar).write_text(json.dumps(radar, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print("written")
        return
    if a.cmd == "book":
        out = Path(a.out or "anubis-book.html")
        ids = [x.strip() for x in (a.ids or "").split(",") if x.strip()] or None
        out.write_text(book_html(radar, ids=ids, written_only=a.written_only, top=a.top), encoding="utf-8")
        print(f"wrote {out} ({out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
