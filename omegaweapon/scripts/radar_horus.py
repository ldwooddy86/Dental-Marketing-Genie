#!/usr/bin/env python3
"""OMEGAWEAPON platform: the Horus layer on the Agency Radar, recomputed from the registry and the edition.

The Agency Radar (assets/radar/radar.json) tracks the digital marketing companies of record. Each tracked agency
carries a Horus read: the digital marketing edition's key judgments, stages, momentum and scenarios mapped onto the
agency's evidence-graded capability scores through the published tables in radar.json["horus"]["model"]. This module
is that arithmetic, so the platform can add an agency, refresh a row, or rebuild the whole layer when a new edition
lands, without a second engine. The tables are analytic judgments; everything here is arithmetic on them.

Definitions (also printed on the app's Method view):
  share_k          capability score / sum of the agency's scores (the sold mix)
  KJ raw           sum over capabilities of share_k x exposure e(KJ, k), plus KJ6 structural terms, clamped to +/-2
  KJ net           p(KJ) x raw, p the midpoint of the ICD 203 range of the claim that bears on agencies
  Tailwind index   sum of nets / scale x 100 (scale: the most favored single-capability profile), banded
  Solar Arc        topic mix (share_k through the crosswalk) weighted by each topic's stage hour; the clock is the mean
  Nilometer tilt   topic mix weighted by the edition's momentum direction (+2 up strongly, +1 up, 0 flat, -1 down)
  Stereopsis       topic mix weighted by the edition's Stereopsis z per topic
  Scenario fit     share_k x the fit table (0 to 2) / 2 x 100; resilience = fits weighted by scenario probabilities
  Money rails      (score_k / 3 x rail weight) / sum of rail weights x 100, plus 10 per rail signal evidenced
  Say and do       each sold line with a house test on the agency's own record (llms.txt, own ads, pixels, tools, cadence)
  Moves P1 to P8   detected from the agency's own text with the model's patterns; absence is "not seen", never a verdict

Usage
  python3 scripts/radar_horus.py check                       # recompute every read and report agreement with the stored layer
  python3 scripts/radar_horus.py rebuild [--write]           # recompute the layer for every agency (and the field summary)
  python3 scripts/radar_horus.py one <agency id>             # print one recomputed read
Pure standard library.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))

RADAR_PATH = ROOT / "assets" / "radar" / "radar.json"
SCEN_P = {"S1": 0.40, "S2": 0.30, "S3": 0.15, "S4": 0.15}
BANDS = [(35, "Tailwind"), (10, "Favored"), (-10, "Neutral"), (-35, "Exposed")]
RAIL_LABEL = {"R1": "answers_agents", "R2": "machine_data", "R3": "human_provenance", "L": "losing_side"}
TEXT_FIELDS = ["positioning", "headline_claim", "ai_posture", "pricing_signals"]
LIST_FIELDS = ["services", "proprietary"]


def load_radar(path: Path = RADAR_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def r3(x: float) -> float:
    return round(x, 3)


def r1(x: float) -> float:
    return round(x, 1)


def hour_str(h: float) -> str:
    hh = int(math.floor(h))
    mm = int(round((h - hh) * 60))
    if mm == 60:
        hh, mm = hh + 1, 0
    return f"{hh:02d}:{mm:02d}"


def arc_word(h: float) -> str:
    if h < 9:
        return "dawn (Khepri)"
    if h < 13:
        return "noon (Ra)" if h >= 11.5 else "morning (Khepri to Ra)"
    if h < 16.5:
        return "afternoon (Ra to Atum)"
    if h < 21:
        return "dusk (Atum)"
    return "night (Duat)"


def band_of(hti: float) -> str:
    for lo, name in BANDS:
        if hti >= lo:
            return name
    return "Headwind"


def texts_of(a: dict) -> list[tuple[str, str, str | None]]:
    """(field, text, url) triples of the agency's own record, the surface the patterns run over."""
    out = []
    home = "https://" + a.get("domain", "") + "/"
    for f in TEXT_FIELDS:
        v = a.get(f)
        if isinstance(v, str) and v.strip() and v.strip().lower() != "none":
            out.append((f, v, home))
    for f in LIST_FIELDS:
        for v in a.get(f) or []:
            if isinstance(v, str) and v.strip():
                out.append((f, v, home))
    for k, ev in (a.get("strategy_evidence") or {}).items():
        if isinstance(ev, dict) and ev.get("note"):
            out.append(("strategy_evidence", ev["note"], ev.get("url") or home))
    g = a.get("google") or {}
    for smp in (g.get("samples") or [])[:12]:
        if isinstance(smp, str):
            out.append(("google_ad", smp, "https://adstransparency.google.com/?domain=" + a.get("domain", "")))
    li = a.get("linkedin") or {}
    for smp in (li.get("samples") or [])[:12]:
        if isinstance(smp, str):
            out.append(("linkedin_ad", smp, "https://www.linkedin.com/ad-library/search?accountOwner=" + a.get("name", "")))
    for mv in a.get("moves") or []:
        if isinstance(mv, dict) and mv.get("note"):
            out.append(("move", mv["note"], mv.get("url") or home))
    deep = a.get("deep") or {}
    for n in (deep.get("news") or [])[:20]:
        if isinstance(n, dict) and n.get("title"):
            out.append(("news", n["title"], n.get("url") or home))
    for c in (deep.get("case_studies") or [])[:30]:
        if isinstance(c, dict) and c.get("title"):
            out.append(("case_study", c["title"], c.get("url") or home))
    for b in (deep.get("blog") or [])[:30]:
        if isinstance(b, dict) and (b.get("title") or b.get("slug")):
            out.append(("blog", b.get("title") or b.get("slug"), b.get("url") or home))
    return out


def find_pattern(pat: str, texts, limit: int = 3) -> list[dict]:
    rx = re.compile(pat, re.I)
    hits = []
    for f, t, u in texts:
        m = rx.search(t)
        if m:
            s = max(0, m.start() - 60)
            snippet = ("…" if s else "") + t[s:m.end() + 60] + ("…" if m.end() + 60 < len(t) else "")
            hits.append({"f": f, "t": snippet, "u": u, "m": m.group(0)})
            if len(hits) >= limit:
                break
    return hits


def compute(a: dict, radar: dict) -> dict:
    """The Horus read for one agency. Returns the layer dict (the shape the app reads)."""
    hz = radar["horus"]
    ed, model = hz["edition"], hz["model"]
    dims = [d[0] for d in radar["meta"]["strat_dims"]]
    kj_ids = [k["id"] for k in ed["key_judgments"]]
    strat = a.get("strategy") or {}
    scores = {k: float(strat.get(k) or 0) for k in dims}
    total = sum(scores.values())
    voice = voice_lines(a, ed, model)
    base = {"ok": False, "status_note": None, "voice": voice, "ledger_items": [], "nilometer": []}
    if a.get("status") not in (None, "active"):
        base["status_note"] = "Brand status " + str(a.get("status")) + " in the radar record; treat the read as provisional."
    if total <= 0:
        base["reason"] = "No capability scores in the radar record, so no position can be computed."
        base["verdict"] = None
        return base
    share = {k: scores[k] / total for k in dims}
    texts = texts_of(a)
    pats = model["patterns"]
    ev = {name: find_pattern(pat, texts) for name, pat in pats.items()}
    # pricing terms are read from the pricing signals the radar recorded on the agency's own pages; the talent pipeline
    # from its own pages (not from ads, news or blog titles)
    own = [t for t in texts if t[0] in ("positioning", "ai_posture", "services", "proprietary", "strategy_evidence", "pricing_signals")]
    pricing = [t for t in texts if t[0] == "pricing_signals"]
    for name in ("outcome_pricing", "perf_fee", "hourly"):
        ev[name] = find_pattern(pats[name], pricing)
    for name in ("talent", "academy"):
        ev[name] = find_pattern(pats[name], own)

    # topic mix through the crosswalk
    mix: dict[str, float] = {}
    for k in dims:
        for t, w in model["crosswalk"].get(k, {}).items():
            mix[t] = mix.get(t, 0.0) + share[k] * w
    stages = {k: (v.get("stage") if isinstance(v, dict) else v) for k, v in ed["stages"].items()}
    stage_mix = {s: 0.0 for s in ("Khepri", "Ra", "Atum", "Duat")}
    arc = 0.0
    for t, w in mix.items():
        st = stages.get(t)
        if st in stage_mix:
            stage_mix[st] += w
            arc += w * model["stage_hour"][st]
    mom = {k: (v.get("direction") if isinstance(v, dict) else v) for k, v in (ed.get("momentum_direction") or {}).items() if not k.startswith("_")}
    tilt = sum(w * model["mom_value"].get(mom.get(t), 0) for t, w in mix.items())
    zmap = {t["id"]: t.get("stereo_z") or 0 for t in ed["topics"]}
    stereo = sum(w * zmap.get(t, 0) for t, w in mix.items())

    # key judgments
    struct = []
    if a.get("ownership") == "holdco":
        struct.append(["holdco", -1])
    if ev["outcome_pricing"] or ev["perf_fee"]:
        struct.append(["outcome", 0.5])
    if ev["hourly"]:
        struct.append(["hourly", -0.5])
    if ev["talent"] or ev["academy"]:
        struct.append(["talent", 0.5])
    lsa = bool(ev["lsa"])
    kj = {}
    net_sum = 0.0
    for kid in kj_ids:
        exp = model["kj_e"].get(kid, {})
        d = []
        for k in dims:
            c = exp.get(k)
            if not c or share[k] <= 0:
                continue
            e = c["e"]
            if kid == "KJ7" and k == "local" and lsa:
                e = 1
            d.append([k, e, r3(share[k] * e)])
        d.sort(key=lambda x: -abs(x[2]))
        raw = sum(share[x[0]] * x[1] for x in d)
        d = d[:4]
        s = struct if kid == "KJ6" else []
        raw += sum(x[1] for x in s)
        raw = max(-2.0, min(2.0, raw))
        net = r3(model["kj_p"][kid]["p"] * raw)
        kj[kid] = {"raw": r3(raw), "net": net, "d": d, "s": s}
        net_sum = r3(net_sum + net)
    hti = r1(net_sum / model["scale"] * 100)

    # scenarios and rails
    fits = {}
    for sid, tab in model["scen_f"].items():
        fits[sid] = r1(sum(share[k] * v for k, v in tab.items()) / 2 * 100)
    resilience = r1(sum(fits[s] * SCEN_P[s] for s in fits))
    best = max(fits, key=lambda s: (fits[s], -int(s[1])))
    worst = min(fits, key=lambda s: (fits[s], int(s[1])))
    rails = {}
    li = a.get("linkedin") or {}
    for rid, spec in model["rails"].items():
        wsum = sum(spec["w"].values())
        b = sum(scores[k] / 3 * w for k, w in spec["w"].items()) / wsum * 100
        evs = []
        for name in spec["ev"]:
            if name == "thought_leader":
                if (a.get("li_thought_leader") or li.get("thought_leader_ads") or 0) > 0:
                    evs.append(name)
            elif ev.get(name):
                evs.append(name)
        rails[rid] = {"score": r1(b + 10 * len(evs)), "base": r1(b), "ev": evs}

    moves = detect_moves(a, scores, ev)
    house = house_tests(a, scores)
    grave = [h for h in ev["agentic"] if h["f"] in ("positioning", "ai_posture", "services", "google_ad", "linkedin_ad", "proprietary")]

    nets = {k: kj[k]["net"] for k in kj_ids}
    ranked = sorted(kj_ids, key=lambda k: (-abs(nets[k]), kj_ids.index(k)))
    kj_top = [k for k in ranked if nets[k] != 0][:3]
    kj_tail = [k for k in sorted(kj_ids, key=lambda k: (-nets[k], kj_ids.index(k))) if nets[k] > 0][:2]
    kj_head = [k for k in sorted(kj_ids, key=lambda k: (nets[k], kj_ids.index(k))) if nets[k] < 0][:2]
    watch = [{"id": i["id"], "kj": i["kj"]} for i in ed["indicators"] if i.get("kj") in kj_top]
    watch.sort(key=lambda w: (kj_top.index(w["kj"]), int(w["id"][1:])))
    kjt = {k["id"]: k["title"] for k in ed["key_judgments"]}
    scen_name = {s["id"]: s["name"] for s in ed["scenarios"]["items"]}
    band = band_of(hti)
    parts = [f"{band} ({'+' if hti > 0 else ''}{int(round(hti))})."]
    if kj_tail:
        parts.append(f"Best placed for {kj_tail[0]}: {kjt.get(kj_tail[0], '')}.")
    if kj_head:
        parts.append(f"Most exposed to {kj_head[0]}: {kjt.get(kj_head[0], '')}.")
    arc = round(arc, 2)
    parts.append(f"The sold mix sits at {hour_str(arc)} on the Solar Arc, {arc_word(arc)}.")
    parts.append(f"Best fit: {scen_name.get(best, best)} ({int(round(fits[best]))}/100).")
    if house["tested"]:
        parts.append(f"Say/do: {house['corroborated']} of {house['tested']} tested lines practised on its own house.")
    out = dict(base)
    out.update({
        "ok": True, "topic_mix": {t: r3(w) for t, w in sorted(mix.items(), key=lambda x: -x[1]) if w > 0.0005},
        "stage_mix": {s: r3(w) for s, w in stage_mix.items()}, "arc_hour": arc, "tilt": r3(tilt), "stereo": r3(stereo),
        "kj": kj, "kj_net_sum": r3(net_sum), "scen_fit": fits, "scen_best": best, "scen_worst": worst, "resilience": resilience,
        "rails": rails, "moves": moves, "moves_score": {"making": sum(1 for m in moves.values() if m["s"] == "making"),
                                                         "partial": sum(1 for m in moves.values() if m["s"] == "partial"),
                                                         "applicable": sum(1 for m in moves.values() if m["s"] != "na")},
        "house": house, "graveyard": grave, "hti": hti, "hti_pct": None, "band": band, "kj_top": kj_top, "kj_tail": kj_tail,
        "kj_head": kj_head, "arc_word": arc_word(arc), "arc_clock": hour_str(arc), "watch": watch, "verdict": " ".join(parts),
    })
    return out


def detect_moves(a: dict, scores: dict, ev: dict) -> dict:
    s = scores
    core = set(a.get("core") or [])
    def mk(st, why, evs=None):
        return {"s": st, "why": why, "ev": evs or []}
    m = {}
    # P1 audited AI visibility
    if s["ai_search"] <= 0:
        m["P1"] = mk("absent", "No AI search capability in the record.")
    elif ev["ai_vis_product"]:
        m["P1"] = mk("making", "Sells AI search at depth and shows a measurable AI-visibility product or audit.", ev["ai_vis_product"])
    else:
        m["P1"] = mk("partial", "Sells AI search, but no audited AI-visibility product (tracking, scorecard, citation share) shows in the record.")
    # P2 feeds, schema, entities on a core commerce, web or SEO line
    fe = ev["feeds"] + ev["entity"]
    named = [h for h in fe if h["f"] in ("services", "proprietary", "strategy_evidence")]
    if named and (core & {"seo", "web_dev", "retail_media", "cro", "data_measurement"}):
        m["P2"] = mk("making", "Feeds, schema or entity work is evidenced alongside a core commerce, web or SEO line.", fe)
    elif fe or s["retail_media"] >= 2:
        m["P2"] = mk("partial", "Some feed or entity work shows, but not as a named service line on a core capability.", fe)
    else:
        m["P2"] = mk("absent", "No feed, schema or entity work in the record.")
    # P3 LSA
    if s["local"] <= 0:
        m["P3"] = mk("na", "Not a local-market agency.")
    elif ev["lsa"]:
        m["P3"] = mk("making", "Local Services Ads or Sponsored Places work is evidenced.", ev["lsa"])
    elif s["local"] >= 2:
        m["P3"] = mk("partial", "Sells local at depth, but no LSA or Sponsored Places work shows.")
    else:
        m["P3"] = mk("absent", "Light local work and no LSA evidence.")
    # P4 inputs to the automation
    paid_core = bool(core & {"paid_search", "paid_social"}) or max(s["paid_search"], s["paid_social"]) >= 2
    inputs = ev["first_party"] + ev["creative_volume"] + ev["incrementality"]
    if not paid_core:
        m["P4"] = mk("na", "Paid media is not a core line.")
    elif inputs or s["data_measurement"] >= 2:
        m["P4"] = mk("making", "Runs paid media and supplies inputs: first-party data, creative volume or measurement depth.", inputs)
    else:
        m["P4"] = mk("partial", "Runs paid media with no first-party data, creative-volume or measurement depth in the record.")
    # P5 pricing
    if ev["outcome_pricing"] or ev["perf_fee"]:
        m["P5"] = mk("making", "Output, outcome or productised pricing on its own pages.", ev["outcome_pricing"] + ev["perf_fee"])
    elif ev["hourly"]:
        m["P5"] = mk("absent", "Publishes hourly rates.", ev["hourly"])
    else:
        m["P5"] = mk("unknown", "No public pricing model in the record.")
    # P6 agent operators and the talent pipeline
    tal = ev["talent"] + ev["academy"]
    if s["ai_automation"] >= 2 and tal:
        m["P6"] = mk("making", "Sells AI automation at depth and shows a visible talent pipeline or AI upskilling programme.", tal)
    elif s["ai_automation"] >= 2 or tal:
        m["P6"] = mk("partial", "AI-operator depth, an academy or a talent pipeline shows, not the full move.", tal)
    else:
        m["P6"] = mk("absent", "No AI-operator depth or talent pipeline in the record.")
    # P7 owned audiences
    c90 = a.get("content_90d") or 0
    if s["email_crm"] >= 2 and c90 >= 5:
        m["P7"] = mk("making", "Sells owned audiences (email, CRM) and publishes steadily on its own site.", ev["newsletter"])
    elif s["email_crm"] >= 1 or ev["newsletter"]:
        m["P7"] = mk("partial", "Some owned-audience work shows.", ev["newsletter"])
    else:
        m["P7"] = mk("absent", "No owned-audience line in the record.")
    # P8 ads inside assistants
    if s["paid_search"] <= 0:
        m["P8"] = mk("na", "No paid search line.")
    elif ev["chatgpt_ads"] and (ev["incrementality"] or s["data_measurement"] >= 2):
        m["P8"] = mk("making", "Talks ads inside assistants and has holdout or incrementality measurement to test them.", ev["chatgpt_ads"] + ev["incrementality"])
    elif ev["chatgpt_ads"]:
        m["P8"] = mk("partial", "Talks ads inside assistants; no incrementality or holdout capability shows.", ev["chatgpt_ads"])
    else:
        m["P8"] = mk("absent", "Sells paid search; no sign of testing ads inside AI assistants.")
    return m


def house_tests(a: dict, scores: dict) -> dict:
    s = scores
    tests = []
    g = a.get("google") or {}
    li = a.get("linkedin") or {}
    soc = a.get("social_links") or {}
    if s["ai_search"] >= 2:
        blocked = a.get("ai_bots_blocked") or []
        if blocked:
            tests.append({"cap": "ai_search", "do": "contradicted", "note": "Sells AI visibility, blocks AI crawlers: " + ", ".join(blocked)})
        elif a.get("llms_txt") is True:
            n = a.get("ai_urls") or 0
            tests.append({"cap": "ai_search", "do": "corroborated", "note": "Publishes llms.txt" + (f"; {n} AI-topic URLs in its sitemap" if n else "")})
        elif a.get("llms_txt") is False:
            n = a.get("ai_urls") or 0
            tests.append({"cap": "ai_search", "do": "contradicted", "note": "Sells AI visibility, publishes no llms.txt" + (f" ({n} AI-topic URLs in its sitemap)" if n else "")})
        else:
            tests.append({"cap": "ai_search", "do": "unknown", "note": "llms.txt check did not complete"})
    if s["paid_search"] >= 2:
        st = g.get("status")
        if st == "active":
            tests.append({"cap": "paid_search", "do": "corroborated", "note": f"Runs its own Google ads ({g.get('count') or 0} in the Transparency Center, {g.get('count_30d') or 0} in the last 30 days)"})
        elif st in ("none", "not_found"):
            tests.append({"cap": "paid_search", "do": "contradicted", "note": "Sells paid search, no Google ads of its own in the Transparency Center"})
        else:
            tests.append({"cap": "paid_search", "do": "unknown", "note": "Transparency Center lookup blocked"})
    if s["paid_social"] >= 2:
        px = a.get("pixels_social") or []
        gap = any(gp.get("code") == "social_no_pixel" for gp in (a.get("gaps") or []))
        if px:
            tests.append({"cap": "paid_social", "do": "corroborated", "note": "Social ad pixels on its own site: " + ", ".join(px)})
        elif gap:
            tests.append({"cap": "paid_social", "do": "contradicted", "note": "Sells paid social, runs no social ad pixel on its own site"})
        else:
            tests.append({"cap": "paid_social", "do": "unknown", "note": "No pixel detected; not flagged by the radar's gap scan"})
    if s["paid_social"] >= 2 or s["b2b_abm"] >= 2:
        st = li.get("status")
        if st == "active":
            tests.append({"cap": "linkedin", "do": "corroborated", "note": f"Runs its own LinkedIn ads ({li.get('count')})"})
        elif st in ("none", "not_found"):
            tests.append({"cap": "linkedin", "do": "contradicted", "note": "Sells paid social or B2B demand gen, no LinkedIn ads of its own"})
        else:
            tests.append({"cap": "linkedin", "do": "unknown", "note": "LinkedIn Ad Library lookup " + str(st)})
    if s["cro"] >= 2 and not (a.get("test_tools") or []):
        tests.append({"cap": "cro", "do": "contradicted", "note": "Sells CRO, no testing tool detected on its own homepage"})
    if s["seo"] >= 2 or s["content_pr"] >= 2:
        c90, c365, sm = a.get("content_90d"), a.get("content_365d"), a.get("sitemap_urls")
        stale = any(gp.get("code") == "blog_stale" for gp in (a.get("gaps") or []))
        if stale:
            tests.append({"cap": "content", "do": "contradicted", "note": "Blog exists but nothing updated in its sitemap for 12 months"})
        elif sm and (c90 or c365 or a.get("is_deep")):
            tests.append({"cap": "content", "do": "corroborated", "note": f"{c90 or 0} sitemap URLs updated in 90 days, {c365 or 0} in 365"})
        else:
            tests.append({"cap": "content", "do": "unknown", "note": "Publishing cadence not measured"})
    if s["creator_influencer"] >= 2:
        chans = [c for c in ("instagram", "tiktok", "youtube") if soc.get(c)]
        if chans:
            tests.append({"cap": "creator_influencer", "do": "corroborated", "note": "Own short-form channels linked from its site: " + ", ".join(chans)})
        else:
            tests.append({"cap": "creator_influencer", "do": "contradicted", "note": "No Instagram, TikTok or YouTube channel linked from its site"})
    cor = sum(1 for t in tests if t["do"] == "corroborated")
    con = sum(1 for t in tests if t["do"] == "contradicted")
    tested = cor + con
    return {"tests": tests, "corroborated": cor, "contradicted": con, "tested": tested, "integrity": int(round(100 * cor / tested)) if tested else None}


def voice_lines(a: dict, ed: dict, model: dict) -> dict:
    """The agency's own voice coded to the Horus taxonomy with the prefilter's matchers (suggestions, never hand codes)."""
    try:
        import horus_prefilter  # noqa: E402
        nomes = json.loads((ROOT / "assets" / "nomes.json").read_text(encoding="utf-8"))
        nome = next(n for n in nomes["nomes"] if n.get("id") == "digital-marketing")
        matchers = horus_prefilter.topic_matchers(nome)
    except Exception:
        return {"n": 0, "counts": {}, "lines": []}
    exclude = set(model.get("voice_exclude") or [])
    lines = []
    for f, t, u in texts_of(a):
        if f == "strategy_evidence":
            continue
        sug = horus_prefilter.suggest({"title": t, "text": ""}, matchers, None)
        top = [x for x in sug["topics"] if x not in exclude]
        if not top:
            continue
        lines.append({"topic": top[0], "f": f, "t": t[:220], "u": u, "d": None, "grey": "grey" in sug["flags"]})
    counts: dict[str, int] = {}
    for ln in lines:
        counts[ln["topic"]] = counts.get(ln["topic"], 0) + 1
    return {"n": len(lines), "counts": dict(sorted(counts.items(), key=lambda x: -x[1])), "lines": lines}


def percentiles(layers: dict) -> None:
    vals = sorted(v["hti"] for v in layers.values() if v.get("ok"))
    n = len(vals)
    for v in layers.values():
        if v.get("ok"):
            below = sum(1 for x in vals if x < v["hti"])
            equal = sum(1 for x in vals if x == v["hti"])
            v["hti_pct"] = int(round(100 * (below + 0.5 * equal) / max(1, n)))


def field_summary(radar: dict) -> dict:
    A = radar["agencies"]
    ok = [a for a in A if a.get("horus", {}).get("ok")]
    def mean(xs):
        xs = [x for x in xs if x is not None]
        return round(sum(xs) / len(xs), 2) if xs else None
    htis = sorted(a["horus"]["hti"] for a in ok)
    med = htis[len(htis) // 2] if len(htis) % 2 else (htis[len(htis) // 2 - 1] + htis[len(htis) // 2]) / 2 if htis else None
    kj_ids = [k["id"] for k in radar["horus"]["edition"]["key_judgments"]]
    bands: dict[str, int] = {}
    best: dict[str, int] = {}
    for a in ok:
        bands[a["horus"]["band"]] = bands.get(a["horus"]["band"], 0) + 1
        best[a["horus"]["scen_best"]] = best.get(a["horus"]["scen_best"], 0) + 1
    moves = {f"P{i}": {st: 0 for st in ("making", "partial", "absent", "unknown", "na")} for i in range(1, 9)}
    for a in ok:
        for pk, m in a["horus"]["moves"].items():
            moves.setdefault(pk, {})[m["s"]] = moves.setdefault(pk, {}).get(m["s"], 0) + 1
    house = {"tested_agencies": sum(1 for a in ok if a["horus"]["house"]["tested"]), "tests": 0, "corroborated": 0, "contradicted": 0, "by_cap": {}}
    for a in ok:
        for t in a["horus"]["house"]["tests"]:
            house["tests"] += 1
            if t["do"] in ("corroborated", "contradicted"):
                house[t["do"]] += 1
            bc = house["by_cap"].setdefault(t["cap"], {"corroborated": 0, "contradicted": 0, "unknown": 0})
            bc[t["do"]] = bc.get(t["do"], 0) + 1
    def group(key):
        g: dict[str, list] = {}
        for a in ok:
            g.setdefault(str(a.get(key) or "unknown"), []).append(a)
        rows = []
        for name, items in g.items():
            rows.append({"name": name, "n": len(items), "hti": mean([x["horus"]["hti"] for x in items]), "arc": mean([x["horus"]["arc_hour"] for x in items]),
                         "resilience": mean([x["horus"]["resilience"] for x in items]), "integrity": mean([x["horus"]["house"]["integrity"] for x in items]),
                         "stage": {s: mean([x["horus"]["stage_mix"][s] for x in items]) for s in ("Khepri", "Ra", "Atum", "Duat")}})
        rows.sort(key=lambda r: -r["n"])
        return rows
    old = radar["horus"].get("field") or {}
    return {
        "n_read": len(ok), "n_no_read": len(A) - len(ok), "hti_mean": mean([a["horus"]["hti"] for a in ok]), "hti_median": med,
        "arc_mean": mean([a["horus"]["arc_hour"] for a in ok]), "stage_mean": {s: mean([a["horus"]["stage_mix"][s] for a in ok]) for s in ("Khepri", "Ra", "Atum", "Duat")},
        "tilt_mean": mean([a["horus"]["tilt"] for a in ok]), "stereo_mean": mean([a["horus"]["stereo"] for a in ok]), "resilience_mean": mean([a["horus"]["resilience"] for a in ok]),
        "bands": bands, "best_fit": best, "kj_mean": {k: mean([a["horus"]["kj"][k]["net"] for a in ok]) for k in kj_ids},
        "kj_pos": {k: sum(1 for a in ok if a["horus"]["kj"][k]["net"] > 0) for k in kj_ids}, "kj_neg": {k: sum(1 for a in ok if a["horus"]["kj"][k]["net"] < 0) for k in kj_ids},
        "moves": moves, "rails_mean": {r: mean([a["horus"]["rails"][r]["score"] for a in ok]) for r in ("R1", "R2", "R3", "L")}, "house": house,
        "graveyard_n": sum(1 for a in ok if a["horus"]["graveyard"]), "by_region": group("region"), "by_archetype": group("archetype"), "by_segment": group("segment"), "by_ownership": group("ownership"),
        "voice": old.get("voice", {}),
    }


def check(radar: dict) -> dict:
    A = radar["agencies"]
    layers = {a["id"]: compute(a, radar) for a in A}
    percentiles(layers)
    keys = ["hti", "band", "arc_clock", "tilt", "stereo", "resilience", "scen_best", "kj_net_sum"]
    agree = {k: 0 for k in keys}
    agree.update({"moves": 0, "house_tested": 0, "house_integrity": 0, "rails": 0, "hti_pct": 0, "verdict": 0, "ok": 0})
    n = 0
    diffs = []
    for a in A:
        old, new = a.get("horus") or {}, layers[a["id"]]
        if bool(old.get("ok")) == bool(new.get("ok")):
            agree["ok"] += 1
        if not old.get("ok") or not new.get("ok"):
            continue
        n += 1
        for k in keys:
            if old.get(k) == new.get(k):
                agree[k] += 1
            elif k == "hti" and len(diffs) < 8:
                diffs.append((a["id"], k, old.get(k), new.get(k)))
        if all(old["moves"][p]["s"] == new["moves"][p]["s"] for p in old["moves"]):
            agree["moves"] += 1
        if old["house"]["tested"] == new["house"]["tested"]:
            agree["house_tested"] += 1
        if old["house"]["integrity"] == new["house"]["integrity"]:
            agree["house_integrity"] += 1
        if all(old["rails"][r]["score"] == new["rails"][r]["score"] for r in old["rails"]):
            agree["rails"] += 1
        if old.get("hti_pct") == new.get("hti_pct"):
            agree["hti_pct"] += 1
        if old.get("verdict") == new.get("verdict"):
            agree["verdict"] += 1
    return {"read": n, "total": len(A), "agree": agree, "sample_diffs": diffs}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["check", "rebuild", "one"])
    ap.add_argument("arg", nargs="?")
    ap.add_argument("--radar", default=str(RADAR_PATH))
    ap.add_argument("--write", action="store_true", help="rebuild: write the recomputed layer back into the registry")
    a = ap.parse_args()
    radar = load_radar(Path(a.radar))
    if a.cmd == "check":
        rep = check(radar)
        print(json.dumps(rep, indent=1))
    elif a.cmd == "one":
        ag = next((x for x in radar["agencies"] if x["id"] == a.arg or x.get("domain") == a.arg), None)
        if not ag:
            raise SystemExit("no such agency in the registry")
        print(json.dumps(compute(ag, radar), indent=1, ensure_ascii=False))
    else:
        layers = {x["id"]: compute(x, radar) for x in radar["agencies"]}
        percentiles(layers)
        for x in radar["agencies"]:
            x["horus"] = layers[x["id"]]
        radar["horus"]["field"] = field_summary(radar)
        if a.write:
            Path(a.radar).write_text(json.dumps(radar, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print(f"layer rebuilt for {len(layers)} agencies and written to {a.radar}")
        else:
            print(f"layer rebuilt for {len(layers)} agencies (dry run; pass --write to save)")


if __name__ == "__main__":
    main()
