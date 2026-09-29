#!/usr/bin/env python3
"""OMEGAWEAPON metrics engine. Every number on the dashboard is computed here from the run manifest.

Nothing on the page is typed by hand: the scorecard grades, the honest count, the coverage strip, the Brand
Stereopsis, the crawl and index breakdown, the review comparison, momentum against the previous run. The grading
constants live in assets/grading.json and are printed on the Method tab so a reader can see how a grade was made.

Usage
  python3 scripts/omega_metrics.py --manifest omega_cache/<domain>/runs/<run>.json [--previous <older run>.json] [--out metrics.json]
Pure standard library (imports horus_metrics for the weighted log-odds).
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import horus_metrics  # noqa: E402

GRADES = ["A", "B", "C", "D", "F"]


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def grading():
    return load(ROOT / "assets" / "grading.json")


def archetypes():
    return load(ROOT / "assets" / "archetypes.json")


def brand_topics():
    return load(ROOT / "assets" / "brand_topics.json")


def band(value: float, bands: dict) -> str:
    for g in GRADES:
        if g in bands and value <= bands[g]:
            return g
    return "F"


def grade_index(g: str) -> int | None:
    return GRADES.index(g) if g in GRADES else None


# ------------------------------------------------------------------------------------------------ scorecard
def pillar_scores(m: dict, G: dict, A: dict) -> dict:
    """Weighted defect density per pillar from the findings, with confidence from the observed share of evidence.
    Unverified evidence never lowers a grade (multiplier 0), it lowers confidence. Wins offset. Modules that did not
    run make their pillar NA. A pillar whose evidence is entirely unverified is '?' (not assessable)."""
    pillars = A["pillars"]
    m2p = A["module_to_pillar"]
    arch = next((x for x in A["archetypes"] if x["id"] == m["target"].get("archetype")), {})
    weighting = arch.get("weighting", {})
    mods = m.get("modules", {})
    status_by_pillar = defaultdict(set)
    for mid, mod in mods.items():
        status_by_pillar[m2p.get(mid, "Other")].add(mod.get("status", "not_run"))
    # pages assessed per pillar: crawl pages for Technical, top pages for Content, listings for Local, apps, campaigns...
    denom = {
        "Technical": max(1, len(mods.get("crawl", {}).get("pages", [])) or mods.get("crawl", {}).get("summary", {}).get("pages_fetched", 0) or 1),
        "Content & Top Pages": max(1, len(mods.get("content", {}).get("top_pages", [])) or 1),
        "Local": max(1, len(mods.get("local", {}).get("location_pages", [])) + 1),
        "Authority & Links": max(1, len(mods.get("links", {}).get("rows", [])) // 50 + 1),
        "Competitive Position": max(1, len(mods.get("competitors", {}).get("rivals", [])) or 1),
        "Paid Media Position": max(1, len(mods.get("paid", {}).get("landing_pages", [])) + len(mods.get("paid", {}).get("account_audit", {}).get("pillars", [])) or 1),
        "Social Position": max(1, len(mods.get("social", {}).get("organic", [])) or 1),
        "AI Visibility": max(1, len(mods.get("ai", {}).get("readiness", [])) or 1),
        "Apps & ASO": max(1, len(mods.get("apps", {}).get("inventory", [])) or 1),
        "Agency Fit": 1,
    }
    out = {}
    sev_w, ev_m, mp = G["severity_weight"], G["evidence_multiplier"], G["money_page_multiplier"]
    for p in pillars:
        rows = [f for f in m.get("findings", []) if (f.get("pillar") or m2p.get(f.get("module"), "")) == p]
        statuses = status_by_pillar.get(p, set())
        if p == "Compliance & Exposure":
            out[p] = exposure_grade(m, G, rows, weighting.get(p, 1.0))
            continue
        if p == "Market Position":
            out[p] = None  # filled after the brand read
            continue
        if p == "Agency Fit":
            out[p] = agency_fit_grade(m, G, rows, weighting.get(p, 1.0))
            continue
        if not statuses or statuses <= {"not_run", "not_assessed", "blocked"}:
            out[p] = {"grade": "NA", "confidence": None, "score": None, "n": len(rows), "why": "; ".join(sorted({mods[k].get("why", "") for k in mods if m2p.get(k) == p and mods[k].get("why")})) or "module did not run", "weight": weighting.get(p, 1.0)}
            continue
        if p == "Competitive Position":
            out[p] = competitive_grade(m, rows, weighting.get(p, 1.0))
            continue
        if not rows:
            if "run" in statuses and "partial" not in statuses:
                out[p] = {"grade": "A", "confidence": "low", "score": 0.0, "n": 0, "wins": 0, "observed_share": 0.0, "denominator": denom.get(p, 1), "weight": weighting.get(p, 1.0), "why": "module ran and recorded no findings and no wins; confirm before relying on it"}
            else:
                out[p] = {"grade": "?", "confidence": None, "score": None, "n": 0, "why": "; ".join(sorted({mods[k].get("why", "") for k in mods if m2p.get(k) == p and mods[k].get("why")})) or "partial read; nothing graded", "weight": weighting.get(p, 1.0)}
            continue
        score = 0.0
        w_obs = w_all = 0.0
        wins = 0
        for f in rows:
            sw = sev_w.get(f.get("severity", "Low"), 0.5)
            em = ev_m.get(f.get("evidence_class", "unverified"), 0.0)
            mult = mp if f.get("money_page") else 1.0
            if f.get("severity") == "Win":
                wins += 1
            contrib = sw * em * mult
            score += contrib
            w = abs(sw) * mult
            w_all += w
            if f.get("evidence_class") == "observed":
                w_obs += w
        score = max(score, 0.0)
        density = score / denom.get(p, 1)
        observed_share = (w_obs / w_all) if w_all else 0.0
        if rows and w_obs == 0 and all(f.get("evidence_class") == "unverified" for f in rows):
            g = "?"
        else:
            g = band(density, G["density_bands"])
        conf = "high" if observed_share >= G["confidence_bands"]["high"] else "moderate" if observed_share >= G["confidence_bands"]["moderate"] else "low"
        if "partial" in statuses and conf == "high":
            conf = "moderate"
        out[p] = {"grade": g, "confidence": conf, "score": round(density, 2), "n": len(rows), "wins": wins, "observed_share": round(observed_share, 2), "denominator": denom.get(p, 1), "weight": weighting.get(p, 1.0), "why": ""}
    return out


def competitive_grade(m: dict, rows: list, weight: float) -> dict:
    """Competitive Position: the client's computed Technical and Content grades against the top-ranked rival's five
    lens grades (analyst-graded from the same lenses). Positive gap means the rival is better."""
    A = archetypes()
    riv = sorted(m.get("modules", {}).get("competitors", {}).get("rivals", []), key=lambda r: r.get("threat_rank") or 99)
    if not riv:
        return {"grade": "?", "confidence": None, "n": len(rows), "why": "no rivals recorded", "weight": weight}
    top = riv[0]
    lens_vals = [grade_index(v) for v in (top.get("lenses") or {}).values() if grade_index(v) is not None]
    if not lens_vals:
        return {"grade": "?", "confidence": None, "n": len(rows), "why": "rival lenses not graded", "weight": weight}
    rival_val = sum(lens_vals) / len(lens_vals)  # 0 = A .. 4 = F
    G = grading()
    tmp = {k: v for k, v in pillar_scores_basic(m, G, A).items() if k in ("Technical", "Content & Top Pages")}
    client_vals = [grade_index(v["grade"]) for v in tmp.values() if v and grade_index(v.get("grade")) is not None]
    if not client_vals:
        return {"grade": "?", "confidence": None, "n": len(rows), "why": "client lenses not graded", "weight": weight}
    client_val = sum(client_vals) / len(client_vals)
    gap = client_val - rival_val  # positive = client worse
    g = "A" if gap <= -0.5 else "B" if gap <= 0.5 else "C" if gap <= 1.5 else "D" if gap <= 2.5 else "F"
    return {"grade": g, "confidence": "moderate", "n": len(rows), "gap": round(gap, 2), "rival": top.get("name"), "rival_lens_mean": round(rival_val, 2), "client_lens_mean": round(client_val, 2), "weight": weight, "why": ""}


def pillar_scores_basic(m: dict, G: dict, A: dict) -> dict:
    """The density grades only (Technical, Content), used by competitive_grade without recursion."""
    m2p = A["module_to_pillar"]
    sev_w, ev_m, mp = G["severity_weight"], G["evidence_multiplier"], G["money_page_multiplier"]
    mods = m.get("modules", {})
    denom = {"Technical": max(1, len(mods.get("crawl", {}).get("pages", [])) or 1), "Content & Top Pages": max(1, len(mods.get("content", {}).get("top_pages", [])) or 1)}
    out = {}
    for p in ("Technical", "Content & Top Pages"):
        rows = [f for f in m.get("findings", []) if (f.get("pillar") or m2p.get(f.get("module"), "")) == p]
        statuses = {mods[k].get("status") for k in mods if m2p.get(k) == p}
        if not rows or statuses <= {"not_run", "not_assessed", "blocked"}:
            out[p] = None
            continue
        score = sum(sev_w.get(f.get("severity", "Low"), 0.5) * ev_m.get(f.get("evidence_class", "unverified"), 0.0) * (mp if f.get("money_page") else 1.0) for f in rows)
        out[p] = {"grade": band(max(score, 0.0) / denom[p], G["density_bands"])}
    return out


def apply_overrides(m: dict, sc: dict) -> dict:
    """An analyst may set a pillar grade in analysis.pillar_grades with a why; the computed grade is kept beside it
    and the dashboard marks the override. Overrides never touch Compliance & Exposure (dispositions decide it)."""
    ov = (m.get("analysis") or {}).get("pillar_grades") or {}
    for p, o in ov.items():
        if p not in sc or p == "Compliance & Exposure" or not isinstance(o, dict) or o.get("grade") not in GRADES:
            continue
        sc[p] = {**(sc[p] or {}), "computed_grade": (sc[p] or {}).get("grade"), "grade": o["grade"], "override": True, "why": o.get("why", "analyst grade")}
    return sc


def exposure_grade(m: dict, G: dict, rows: list, weight: float) -> dict:
    ex = m.get("exposure", [])
    st = m.get("modules", {}).get("exposure", {}).get("status", "not_run")
    if st in ("not_run", "blocked"):
        return {"grade": "NA", "confidence": None, "n": 0, "why": "module did not run", "weight": weight}
    eg = G["exposure_grade"]
    if not ex and st == "partial":
        return {"grade": "?", "confidence": None, "n": 0, "why": m.get("modules", {}).get("exposure", {}).get("why") or "batteries not yet dispositioned", "weight": weight}
    conf_rows = [x for x in ex if x.get("disposition") == "CONFIRMED"]
    cand = [x for x in ex if x.get("disposition") == "CANDIDATE"]
    clr = [x for x in ex if x.get("disposition") == "CLEARED"]
    if any(x.get("severity") == "High" for x in conf_rows):
        g = eg["confirmed_high"]
    elif any(x.get("severity") == "Medium" for x in conf_rows):
        g = eg["confirmed_medium"]
    elif conf_rows:
        g = eg["confirmed_low"]
    elif any(x.get("severity") == "High" for x in cand):
        g = eg["candidate_high"]
    elif cand:
        g = eg["candidate_only"]
    elif clr:
        g = eg["cleared_only"]
    else:
        g = eg["none"]
    cov = m.get("modules", {}).get("exposure", {}).get("clause_coverage", [])
    testable = sum(1 for c in cov if str(c.get("status", "")).startswith("testable"))
    frac = (testable / len(cov)) if cov else 0.0
    conf = "high" if frac >= 0.7 and st == "run" else "moderate" if frac >= 0.4 else "low"
    return {"grade": g, "confidence": conf, "n": len(ex), "confirmed": len(conf_rows), "candidate": len(cand), "cleared": len(clr), "coverage": round(frac, 2), "weight": weight, "why": ""}


def agency_fit_grade(m: dict, G: dict, rows: list, weight: float) -> dict:
    ag = m.get("modules", {}).get("agency", {})
    if ag.get("status") in ("not_run", "blocked"):
        return {"grade": "NA", "confidence": None, "n": 0, "why": "module did not run", "weight": weight}
    ivo = ag.get("inherited_vs_owned", [])
    if not ivo:
        return {"grade": "?", "confidence": None, "n": len(rows), "why": ag.get("why") or "inherited vs owned split not yet made", "weight": weight}
    hm = [f for f in m.get("findings", []) if f.get("severity") in ("High", "Medium")]
    inherited_ids = {r.get("finding_id") for r in ivo if r.get("side") == "inherited"}
    share = (sum(1 for f in hm if f["id"] in inherited_ids) / len(hm)) if hm else 0.0
    g = band(share, G["agency_fit_grade"]["inherited_share_bands"])
    claims_open = sum(1 for c in ag.get("claims", []) if c.get("status") in ("CANDIDATE", "CONFIRMED"))
    if claims_open >= 3 and grade_index(g) is not None and grade_index(g) < 3:
        g = GRADES[grade_index(g) + 1]
    conf = ag.get("of_record", {}).get("confidence", "Weak")
    conf_word = {"Confirmed": "high", "Plausible": "moderate", "Weak": "low"}.get(conf, "low")
    return {"grade": g if ag.get("of_record") else "?", "confidence": conf_word, "n": len(rows), "inherited_share": round(share, 2), "inherited": len(inherited_ids), "claims_open": claims_open, "weight": weight, "why": "" if ag.get("of_record") else "no agency of record identified"}


# ------------------------------------------------------------------------------------------------ brand stereopsis
def brand_read(m: dict, G: dict, BT: dict) -> dict:
    br = m.get("modules", {}).get("market", {}).get("brand", {})
    items = [i for i in br.get("items", []) if horus_metrics.counted(i)]
    topics = [t["id"] for t in BT["topics"]]
    labels = {t["id"]: t["short"] for t in BT["topics"]}
    sun = [i for i in items if i.get("eye") == "sun"]
    moon = [i for i in items if i.get("eye") == "moon"]
    ys, ym = Counter(i.get("topic") for i in sun), Counter(i.get("topic") for i in moon)
    n_s, n_m = len(sun), len(moon)
    lo = horus_metrics.log_odds_dirichlet(ym, ys, topics, alpha0=float(len(topics))) if (n_s or n_m) else {}
    rows = []
    for t in topics:
        if not (ys.get(t) or ym.get(t)):
            continue
        z = lo[t]["z"] if t in lo else 0.0
        floor_t = [i for i in moon if i.get("topic") == t]
        pain = (sum(1 for i in floor_t if i.get("intent") in ("Q", "C")) / len(floor_t)) if floor_t else None
        rows.append({"topic": t, "label": labels.get(t, t), "sun_n": ys.get(t, 0), "moon_n": ym.get(t, 0),
                     "sun_share": round(ys.get(t, 0) / n_s, 3) if n_s else 0.0, "moon_share": round(ym.get(t, 0) / n_m, 3) if n_m else 0.0,
                     "z": round(z, 2), "class": horus_metrics.stereo_class(z, ym.get(t, 0), ys.get(t, 0)),
                     "pain": (round(pain, 2) if pain is not None else None), "pain_n": len(floor_t),
                     "stance_moon": (round(sum(i.get("stance", 0) for i in floor_t) / len(floor_t), 2) if floor_t else None)})
    rows.sort(key=lambda r: -abs(r["z"]))
    complaint_share = (sum(1 for i in moon if i.get("intent") == "C") / n_m) if n_m else None
    stance_moon = (sum(i.get("stance", 0) for i in moon) / n_m) if n_m else None
    stance_sun = (sum(i.get("stance", 0) for i in sun) / n_s) if n_s else None
    mins = BT["minimums"]
    thin = n_s < mins["sun_items"] or n_m < mins["moon_items"]
    mg = G["market_grade"]
    st = m.get("modules", {}).get("market", {}).get("status", "not_run")
    if st in ("not_run", "blocked") or n_m == 0:
        grade = {"grade": "NA", "confidence": None, "why": "no floor items coded" if st not in ("not_run", "blocked") else "module did not run"}
    else:
        g = band(complaint_share, mg["complaint_share_bands"])
        if g == "A" and (stance_moon or 0) < mg["stance_floor_for_A"]:
            g = "B"
        conf = "low" if n_m < mg["min_floor_items"] else ("moderate" if thin else "high")
        grade = {"grade": g, "confidence": conf, "complaint_share": round(complaint_share, 2), "stance_moon": round(stance_moon, 2), "n_moon": n_m, "why": ""}
    clusters = {}
    for cname, tids in BT.get("clusters", {}).items():
        clusters[cname] = {"sun": round(sum(ys.get(t, 0) for t in tids) / n_s, 3) if n_s else 0.0, "moon": round(sum(ym.get(t, 0) for t in tids) / n_m, 3) if n_m else 0.0}
    intents_moon = Counter(i.get("intent") for i in moon)
    return {"n_sun": n_s, "n_moon": n_m, "thin": thin, "minimums": mins, "rows": rows, "clusters": clusters,
            "complaint_share": (round(complaint_share, 2) if complaint_share is not None else None),
            "stance": {"sun": (round(stance_sun, 2) if stance_sun is not None else None), "moon": (round(stance_moon, 2) if stance_moon is not None else None)},
            "intents_moon": dict(intents_moon), "grade": grade,
            "floor_led": [r for r in rows if r["class"] in ("floor-led", "floor-only")][:5],
            "broadcast_led": [r for r in rows if r["class"] in ("broadcast-led", "broadcast-only")][:5],
            "frames": br.get("frames", {})}


# ------------------------------------------------------------------------------------------------ honest count
def honest_count(m: dict, G: dict) -> dict:
    ex = m.get("exposure", [])
    disp = Counter(x.get("disposition") for x in ex)
    routable = [x for x in ex if x.get("disposition") == "CONFIRMED" and x.get("confidence") == "Confirmed" and x.get("route") not in (None, "", "NONE", "PRIVATE")]
    bat = defaultdict(Counter)
    for x in ex:
        bat[x.get("battery", "?")][x.get("disposition", "?")] += 1
    cov = m.get("modules", {}).get("exposure", {}).get("clause_coverage", [])
    testable = sum(1 for c in cov if str(c.get("status", "")).startswith("testable"))
    n = len(ex)
    sentence = (f"{n} observation{'s' if n != 1 else ''}. {disp.get('CONFIRMED', 0)} CONFIRMED, {len(routable)} routable. "
                f"{disp.get('CANDIDATE', 0)} CANDIDATE, held. {disp.get('CLEARED', 0)} CLEARED.") if n else "No compliance observations recorded."
    return {"n": n, "confirmed": disp.get("CONFIRMED", 0), "candidate": disp.get("CANDIDATE", 0), "cleared": disp.get("CLEARED", 0),
            "routable": len(routable), "routable_ids": [x["id"] for x in routable], "by_battery": {k: dict(v) for k, v in bat.items()},
            "coverage": {"testable": testable, "families": len(cov), "fraction": round(testable / len(cov), 2) if cov else None}, "sentence": sentence,
            "routes": dict(Counter(x.get("route") for x in ex if x.get("disposition") == "CONFIRMED"))}


# ------------------------------------------------------------------------------------------------ crawl, findings, reviews, competitors
def crawl_summary(m: dict) -> dict:
    cr = m.get("modules", {}).get("crawl", {})
    pages = cr.get("pages", [])
    status = Counter()
    depth = Counter()
    js = 0
    for p in pages:
        s = p.get("status")
        if s is None:
            k = "unfetched"
        elif 300 <= int(s) < 400:
            k = "redirect"
        elif int(s) >= 400:
            k = "error"
        elif p.get("indexable") is False:
            k = "noindex or blocked"
        else:
            k = "indexable"
        status[k] += 1
        if p.get("depth") is not None:
            depth[str(p["depth"])] += 1
        if (p.get("js_share") or 0) >= 0.5:
            js += 1
    return {"status": dict(status), "depth": dict(sorted(depth.items(), key=lambda kv: int(kv[0]))), "js_dependent": js, "n": len(pages), "summary": cr.get("summary", {}), "money": [p for p in pages if p.get("money")]}


def findings_summary(m: dict) -> dict:
    fs = m.get("findings", [])
    by = lambda k: dict(Counter(f.get(k) for f in fs))
    return {"n": len(fs), "by_module": by("module"), "by_severity": by("severity"), "by_evidence": by("evidence_class"), "by_owner": by("owner"), "by_pillar": by("pillar"),
            "wins": [f["id"] for f in fs if f.get("severity") == "Win"], "high": [f["id"] for f in fs if f.get("severity") == "High"],
            "money_page_high": [f["id"] for f in fs if f.get("severity") == "High" and f.get("money_page")]}


def reviews_summary(m: dict) -> dict:
    rows = m.get("modules", {}).get("local", {}).get("reviews", [])
    client = m["target"].get("business_name")
    out = []
    for r in rows:
        out.append({**r, "is_client": r.get("entity") == client})
    return {"rows": out, "client_present": any(r["is_client"] for r in out)}


def competitor_matrix(m: dict) -> dict:
    riv = m.get("modules", {}).get("competitors", {}).get("rivals", [])
    lenses = ["content", "technical", "ux", "speed", "mobile"]
    return {"lenses": lenses, "rows": [{"name": r.get("name"), "domain": r.get("domain"), "threat_rank": r.get("threat_rank"), "one_line": r.get("one_line"), **{l: (r.get("lenses") or {}).get(l) for l in lenses}, "steal_this": r.get("steal_this", [])} for r in sorted(riv, key=lambda r: r.get("threat_rank") or 99)]}


def coverage(m: dict) -> dict:
    mods = m.get("modules", {})
    planned = set(m.get("run", {}).get("modules_planned", []))
    rows = []
    for mid, mod in mods.items():
        rows.append({"module": mid, "status": mod.get("status", "not_run"), "planned": mid in planned, "why": mod.get("why", ""), "sources": mod.get("sources", [])})
    kinds = Counter(s.get("kind") for s in m.get("sources", []))
    rungs = Counter(s.get("rung") for s in m.get("sources", []))
    return {"modules": rows, "run": sum(1 for r in rows if r["status"] == "run"), "partial": sum(1 for r in rows if r["status"] == "partial"),
            "not": sum(1 for r in rows if r["status"] in ("not_run", "not_assessed", "blocked")), "sources_by_kind": dict(kinds), "sources_by_rung": {str(k): v for k, v in rungs.items()},
            "blocked": m.get("run", {}).get("blocked", []), "tier": m.get("run", {}).get("tier"), "presence": m.get("run", {}).get("presence", {}),
            "exports_supplied": m.get("run", {}).get("exports_supplied", []), "exports_requested": m.get("run", {}).get("exports_requested", [])}


def ai_summary(m: dict) -> dict:
    ai = m.get("modules", {}).get("ai", {})
    cf = ai.get("citable_footprint", [])
    client_hits = sum(1 for c in cf if c.get("client"))
    rival_hits = Counter()
    for c in cf:
        for r in c.get("rivals", []) or []:
            rival_hits[r] += 1
    pt = ai.get("prompt_tracker", [])
    return {"citable_checked": len(cf), "citable_client": client_hits, "citable_rivals": dict(rival_hits.most_common(6)),
            "prompts": len(pt), "prompts_mentioned": sum(1 for p in pt if p.get("mentioned")), "prompts_pending": sum(1 for p in pt if p.get("mentioned") is None),
            "readiness_n": len(ai.get("readiness", [])), "brand_facts_inconsistent": sum(1 for b in ai.get("brand_facts", []) if b.get("consistent") is False)}


# ------------------------------------------------------------------------------------------------ momentum
def momentum(prev: dict | None, cur: dict, cur_metrics: dict, G: dict) -> dict | None:
    if not prev:
        return None
    pm = compute(prev, None, G=G, _no_momentum=True)
    grade_delta = {}
    for p, row in cur_metrics["scorecard"].items():
        a, b = (pm["scorecard"].get(p) or {}).get("grade"), (row or {}).get("grade")
        ia, ib = grade_index(a) if a else None, grade_index(b) if b else None
        grade_delta[p] = {"from": a, "to": b, "delta": (ia - ib) if (ia is not None and ib is not None) else None}  # positive = improved
    prev_ids = {f["id"]: f for f in prev.get("findings", [])}
    cur_ids = {f["id"]: f for f in cur.get("findings", [])}
    prev_titles = {f.get("title") for f in prev.get("findings", [])}
    cur_titles = {f.get("title") for f in cur.get("findings", [])}
    resolved = [f for t, f in prev_ids.items() if f.get("title") not in cur_titles and f.get("severity") != "Win"]
    new = [f for t, f in cur_ids.items() if f.get("title") not in prev_titles and f.get("severity") != "Win"]
    ph, ch = pm["honest_count"], cur_metrics["honest_count"]
    exposure_delta = {k: ch.get(k, 0) - ph.get(k, 0) for k in ("confirmed", "candidate", "cleared", "routable")}
    # brand share deltas with two-proportion z
    bprev = {r["topic"]: r for r in pm["brand"]["rows"]}
    bcur = {r["topic"]: r for r in cur_metrics["brand"]["rows"]}
    n_prev, n_cur = pm["brand"]["n_moon"], cur_metrics["brand"]["n_moon"]
    brand_delta = []
    if n_prev >= G["momentum"]["min_items_for_z"] and n_cur >= G["momentum"]["min_items_for_z"]:
        for t in set(bprev) | set(bcur):
            p1 = bprev.get(t, {}).get("moon_share", 0.0)
            p2 = bcur.get(t, {}).get("moon_share", 0.0)
            pooled = (p1 * n_prev + p2 * n_cur) / (n_prev + n_cur)
            var = pooled * (1 - pooled) * (1 / n_prev + 1 / n_cur)
            z = ((p2 - p1) / math.sqrt(var)) if var > 0 else 0.0
            brand_delta.append({"topic": t, "label": (bcur.get(t) or bprev.get(t) or {}).get("label", t), "from": p1, "to": p2, "delta_pp": round((p2 - p1) * 100, 1), "z": round(z, 2)})
        brand_delta.sort(key=lambda r: -abs(r["z"]))
    rv_prev = {r["entity"]: r for r in prev.get("modules", {}).get("local", {}).get("reviews", [])}
    rv_delta = []
    for r in cur.get("modules", {}).get("local", {}).get("reviews", []):
        q = rv_prev.get(r.get("entity"))
        if q:
            rv_delta.append({"entity": r["entity"], "count_from": q.get("count"), "count_to": r.get("count"), "rating_from": q.get("rating"), "rating_to": r.get("rating")})
    return {"previous_run": prev.get("run", {}).get("id"), "previous_date": prev.get("run", {}).get("run_date"), "grade_delta": grade_delta,
            "findings_resolved": [{"id": f["id"], "title": f.get("title")} for f in resolved], "findings_new": [{"id": f["id"], "title": f.get("title")} for f in new],
            "exposure_delta": exposure_delta, "brand_delta": brand_delta[:10], "review_delta": rv_delta,
            "frame_note": "Compare only when the frames match (same money set, same review platforms, similar windows)."}


# ------------------------------------------------------------------------------------------------ compute
def compute(m: dict, previous: dict | None = None, G: dict | None = None, _no_momentum: bool = False) -> dict:
    G = G or grading()
    A = archetypes()
    BT = brand_topics()
    sc = pillar_scores(m, G, A)
    brand = brand_read(m, G, BT)
    sc["Market Position"] = {**brand["grade"], "n": brand["n_moon"], "weight": next((x for x in A["archetypes"] if x["id"] == m["target"].get("archetype")), {}).get("weighting", {}).get("Market Position", 1.0)}
    if brand["grade"].get("grade") in GRADES:
        sc["Market Position"]["why"] = f"complaint share {int(round(brand['complaint_share'] * 100))}% of {brand['n_moon']} floor items; mean floor stance {brand['stance']['moon']}" + ("; thin read" if brand["thin"] else "")
    sc = apply_overrides(m, sc)
    assessed = [p for p, r in sc.items() if r and r.get("grade") in GRADES]
    # overall: weighted mean of graded pillars (A=4 .. F=0), reported with the count of pillars it rests on
    if assessed:
        num = sum((4 - grade_index(sc[p]["grade"])) * sc[p].get("weight", 1.0) for p in assessed)
        den = sum(sc[p].get("weight", 1.0) for p in assessed)
        overall_val = num / den
        overall = GRADES[max(0, min(4, round(4 - overall_val)))]
    else:
        overall_val, overall = None, "NA"
    out = {
        "scorecard": sc,
        "overall": {"grade": overall, "value": (round(overall_val, 2) if overall_val is not None else None), "pillars_graded": len(assessed), "pillars_total": len(A["pillars"])},
        "honest_count": honest_count(m, G),
        "brand": brand,
        "crawl": crawl_summary(m),
        "findings": findings_summary(m),
        "reviews": reviews_summary(m),
        "competitors": competitor_matrix(m),
        "coverage": coverage(m),
        "ai": ai_summary(m),
        "grading": {k: v for k, v in G.items() if not k.startswith("_")},
    }
    if not _no_momentum:
        out["momentum"] = momentum(previous, m, out, G)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--previous")
    ap.add_argument("--out")
    a = ap.parse_args()
    m = load(a.manifest)
    prev = load(a.previous) if a.previous else None
    res = compute(m, prev)
    s = json.dumps(res, ensure_ascii=False, indent=1)
    if a.out:
        Path(a.out).write_text(s, encoding="utf-8")
        print(f"wrote {a.out}")
    else:
        print(s)


if __name__ == "__main__":
    main()
