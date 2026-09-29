#!/usr/bin/env python3
"""OMEGAWEAPON platform: the Monsoon layer on the Agency Radar (offshore delivery exposure per tracked agency).

For each tracked agency, how exposed its sold work is to offshore delivery over a three-year horizon, read from its own
public record: the sold mix through the published offshorability table, the structure (ownership, size, listed offices,
job postings, its own words about delivery and pricing), and where the work would go (the shore split by home market,
South and Southeast Asia first). Two mechanisms are scored beside the index: migration (the agency moves its own
delivery offshore) and displacement (an offshore-delivered competitor takes the client). Every table is in
assets/radar/offshore_model.json; everything here is arithmetic on it, with an evidence class per line.

Usage
  python3 scripts/radar_offshore.py rebuild [--write]     recompute the layer for every agency and the field summary
  python3 scripts/radar_offshore.py one <agency id>       print one read
  python3 scripts/radar_offshore.py field                 print the field summary
Pure standard library.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import radar_horus  # noqa: E402  (texts_of, find_pattern, load_radar)

RADAR_PATH = ROOT / "assets" / "radar" / "radar.json"
MODEL_PATH = ROOT / "assets" / "radar" / "offshore_model.json"

HUB_CITIES = {
    "south_asia": ["bengaluru", "bangalore", "mumbai", "pune", "hyderabad", "chennai", "delhi", "gurgaon", "gurugram", "noida", "kolkata", "ahmedabad", "jaipur", "kochi", "lahore", "karachi", "islamabad", "dhaka", "colombo", "kathmandu"],
    "southeast_asia": ["manila", "cebu", "makati", "taguig", "ho chi minh", "hanoi", "da nang", "jakarta", "bandung", "kuala lumpur", "penang", "bangkok", "phnom penh"],
    "eastern_europe": ["warsaw", "krak", "wroc", "gdansk", "gdańsk", "poznan", "poznań", "lodz", "łódź", "kyiv", "kiev", "lviv", "kharkiv", "bucharest", "cluj", "belgrade", "novi sad", "sofia", "plovdiv", "prague", "brno", "budapest", "minsk", "chisinau", "skopje", "tirana", "sarajevo", "tbilisi", "yerevan", "istanbul", "ankara"],
    "latin_america": ["buenos aires", "cordoba", "córdoba", "bogot", "medell", "mexico city", "ciudad de m", "guadalajara", "monterrey", "sao paulo", "são paulo", "rio de janeiro", "san jos", "lima", "santiago", "montevideo", "guatemala city", "santo domingo", "managua", "san salvador", "tegucigalpa"],
    "africa": ["johannesburg", "cape town", "durban", "nairobi", "lagos", "cairo", "casablanca", "rabat", "tunis", "antananarivo", "port louis", "dakar", "accra", "kigali"],
}


def load_model() -> dict:
    return json.loads(MODEL_PATH.read_text(encoding="utf-8"))


def r1(x):
    return round(x, 1)


def hub_region(place: str, model: dict) -> str | None:
    p = (place or "").strip().lower()
    if not p:
        return None
    for rid, spec in model["shores"]["regions"].items():
        for hub in spec["hubs"]:
            if re.search(r"(?<![a-z])" + re.escape(hub.lower()) + r"(?![a-z])", p):
                return rid
    for rid, cities in HUB_CITIES.items():
        for c in cities:
            if c in p:
                return rid
    return None


def language_of(a: dict, model: dict) -> str:
    c2l = model["shores"]["country_to_language"]
    hq = a.get("hq_country")
    if hq in c2l:
        return c2l[hq]
    if a.get("region") == "US":
        return "en_us"
    return model["shores"]["default_language"]


def employees_n(a: dict) -> int | None:
    n = a.get("employees_n")
    if isinstance(n, (int, float)):
        return int(n)
    e = a.get("employees")
    v = e.get("value") if isinstance(e, dict) else e
    if not v:
        return None
    m = re.search(r"(\d[\d,]*)", str(v))
    return int(m.group(1).replace(",", "")) if m else None


def band_of(idx: float, model: dict) -> tuple[str, str]:
    for lo, name, gloss in model["bands"]:
        if idx >= lo:
            return name, gloss
    last = model["bands"][-1]
    return last[1], last[2]


def compute(a: dict, radar: dict, model: dict | None = None) -> dict:
    model = model or load_model()
    dims = [d[0] for d in radar["meta"]["strat_dims"]]
    label = dict(radar["meta"]["strat_dims"])
    off = model["offshorability"]
    strat = a.get("strategy") or {}
    scores = {k: float(strat.get(k) or 0) for k in dims}
    total = sum(scores.values())
    if total <= 0:
        return {"ok": False, "reason": "No capability scores in the radar record, so no exposure can be computed.", "verdict": None}
    share = {k: scores[k] / total for k in dims}
    contrib = []
    base = 0.0
    labor = 0.0
    for k in dims:
        if share[k] <= 0:
            continue
        c = share[k] * off[k]["off"] / 3 * off[k]["labor"] * 100
        base += c
        labor += share[k] * off[k]["labor"]
        contrib.append({"cap": k, "label": label.get(k, k), "share": round(share[k], 3), "off": off[k]["off"], "labor": off[k]["labor"], "pts": r1(c)})
    contrib.sort(key=lambda x: -x["pts"])
    overlap_pts = sum(x["pts"] for x in contrib if x["cap"] in model["automation_overlap"]["capabilities"])
    overlap = overlap_pts / base if base else 0.0

    # evidence from the record
    texts = radar_horus.texts_of(a)
    own = [t for t in texts if t[0] in ("positioning", "headline_claim", "ai_posture", "services", "proprietary", "strategy_evidence", "pricing_signals", "move", "news")]
    pricing = [t for t in texts if t[0] == "pricing_signals"]
    pats = model["patterns"]
    ev = {
        "delivery_language": radar_horus.find_pattern(pats["delivery_language"], own),
        "white_label": radar_horus.find_pattern(pats["white_label"], own),
        "onshore_claim": radar_horus.find_pattern(pats["onshore_claim"], own),
        "hourly": radar_horus.find_pattern(pats["hourly"], pricing),
        "outcome": radar_horus.find_pattern(pats["outcome"], pricing),
    }
    hub_offices = []
    for o in a.get("offices") or []:
        rid = hub_region(str(o), model)
        if rid:
            hub_offices.append({"place": str(o), "region": rid})
    hub_jobs = []
    for j in ((a.get("deep") or {}).get("jobs") or []):
        if not isinstance(j, dict):
            continue
        loc = str(j.get("location") or j.get("loc") or "")
        rid = hub_region(loc, model)
        if rid:
            hub_jobs.append({"title": j.get("title"), "location": loc, "region": rid})

    # structural terms
    S = model["structure"]
    mig, disp = [], []
    own_ship = a.get("ownership")
    if own_ship in ("holdco", "consultancy-owned", "public", "pe-backed"):
        key = own_ship.replace("-", "_")
        mig.append({"term": key, "pts": S["migration"][key]["pts"], "class": "inferred", "why": S["migration"][key]["why"]})
    n_emp = employees_n(a)
    if n_emp is not None and n_emp >= S["migration"]["large"]["threshold"]:
        mig.append({"term": "large", "pts": S["migration"]["large"]["pts"], "class": "observed", "why": f"{n_emp:,} people on the record. " + S["migration"]["large"]["why"]})
    if hub_offices:
        mig.append({"term": "hub_office", "pts": S["migration"]["hub_office"]["pts"], "class": "observed", "why": "Listed: " + ", ".join(sorted({h['place'] for h in hub_offices})) + ". " + S["migration"]["hub_office"]["why"]})
    if hub_jobs:
        mig.append({"term": "hub_jobs", "pts": S["migration"]["hub_jobs"]["pts"], "class": "observed", "why": "Posted: " + "; ".join(f"{j['title']} ({j['location']})" for j in hub_jobs[:4]) + ". " + S["migration"]["hub_jobs"]["why"]})
    if ev["delivery_language"]:
        mig.append({"term": "delivery_language", "pts": S["migration"]["delivery_language"]["pts"], "class": "observed", "why": S["migration"]["delivery_language"]["why"], "ev": ev["delivery_language"]})
    lang = language_of(a, model)
    if lang == "destination":
        mig.append({"term": "destination", "pts": S["migration"]["destination"]["pts"], "class": "inferred", "why": S["migration"]["destination"]["why"]})
    icp = a.get("icp")
    icp_key = {"smb": "icp_smb", "local": "icp_local", "mid-market": "icp_mid", "mixed": "icp_mixed", "enterprise": "icp_enterprise"}.get(icp)
    if icp_key:
        disp.append({"term": icp_key, "pts": S["displacement"][icp_key]["pts"], "class": "inferred", "why": S["displacement"][icp_key]["why"]})
    if a.get("segment") in S["displacement"]["segment_scaled"]["segments"]:
        disp.append({"term": "segment_scaled", "pts": S["displacement"]["segment_scaled"]["pts"], "class": "inferred", "why": S["displacement"]["segment_scaled"]["why"]})
    if ev["hourly"]:
        disp.append({"term": "hourly", "pts": S["displacement"]["hourly"]["pts"], "class": "observed", "why": S["displacement"]["hourly"]["why"], "ev": ev["hourly"]})
    if ev["outcome"]:
        disp.append({"term": "outcome", "pts": S["displacement"]["outcome"]["pts"], "class": "observed", "why": S["displacement"]["outcome"]["why"], "ev": ev["outcome"]})
    if ev["white_label"]:
        disp.append({"term": "white_label", "pts": S["displacement"]["white_label"]["pts"], "class": "observed", "why": S["displacement"]["white_label"]["why"], "ev": ev["white_label"]})

    migration = max(0.0, min(100.0, base + sum(t["pts"] for t in mig)))
    displacement = max(0.0, min(100.0, base + sum(t["pts"] for t in disp)))
    index = r1((migration + displacement) / 2)
    band, gloss = band_of(index, model)

    # the shore split, tilted toward observed hubs
    w = dict(model["shores"]["by_language"][lang])
    shore = {rid: float(w.get(rid, 0.0)) for rid in model["shores"]["regions"]}
    observed_regions = sorted({h["region"] for h in hub_offices} | {j["region"] for j in hub_jobs})
    for rid in observed_regions:
        shore[rid] = shore.get(rid, 0.0) + 0.15
    tot = sum(shore.values()) or 1.0
    shore = {rid: round(v / tot, 3) for rid, v in shore.items()}
    asia = shore.get("south_asia", 0.0) + shore.get("southeast_asia", 0.0)

    observed = any(t["class"] == "observed" for t in mig + disp)
    ev_class = "observed" if observed else "inferred"
    claims = [{"f": h["f"], "t": h["t"], "u": h["u"], "m": h["m"]} for h in ev["onshore_claim"]]
    reg_label = {rid: spec["label"] for rid, spec in model["shores"]["regions"].items()}
    top = contrib[:2]
    verdict = (f"{band} ({int(round(index))}). {int(round(base))} of it is the sold mix: "
               + " and ".join(f"{x['label']} ({x['pts']:.0f})" for x in top) + " carry the most movable hours. "
               + (f"Delivery footprint observed in {', '.join(reg_label[r] for r in observed_regions)}. " if observed_regions else "")
               + f"Migration {int(round(migration))}, displacement {int(round(displacement))}. "
               + f"Shore: {int(round(asia * 100))}% South and Southeast Asia"
               + (f", {int(round(shore.get('eastern_europe', 0) * 100))}% Eastern Europe" if shore.get("eastern_europe", 0) >= 0.15 else "")
               + (f", {int(round(shore.get('latin_america', 0) * 100))}% Latin America" if shore.get("latin_america", 0) >= 0.15 else "")
               + (f", {int(round(shore.get('africa', 0) * 100))}% Africa and the Maghreb" if shore.get("africa", 0) >= 0.15 else "")
               + ". " + (f"Automation overlaps {int(round(overlap * 100))}% of the movable hours. " if overlap >= 0.2 else "")
               + ("Claims onshore delivery in its own words." if claims else ""))
    falsifiers = [
        "A job posting, a listed office or a vendor credit in a hub economy would move the migration read from inferred to observed; none found means none was on the public record the Radar read.",
        "Published outcome or productised pricing would lower the displacement read; published hourly rates would raise it.",
        "A client roster that shifts toward enterprise governance work would lower displacement; a shift toward small-business volume would raise it.",
    ]
    return {
        "ok": True, "index": index, "band": band, "gloss": gloss, "base": r1(base), "labor": round(labor, 2), "migration": r1(migration), "displacement": r1(displacement),
        "contrib": contrib, "overlap": round(overlap, 3), "shore": shore, "asia": round(asia, 3), "language": lang, "language_label": model["shores"]["by_language"][lang]["label"],
        "terms": {"migration": mig, "displacement": disp}, "hub_offices": hub_offices, "hub_jobs": hub_jobs, "observed_regions": observed_regions,
        "onshore_claims": claims, "evidence_class": ev_class, "verdict": verdict.strip(), "falsifiers": falsifiers, "index_pct": None,
    }


def percentiles(layers: dict) -> None:
    vals = sorted(v["index"] for v in layers.values() if v.get("ok"))
    n = len(vals)
    for v in layers.values():
        if v.get("ok"):
            below = sum(1 for x in vals if x < v["index"])
            equal = sum(1 for x in vals if x == v["index"])
            v["index_pct"] = int(round(100 * (below + 0.5 * equal) / max(1, n)))


def field_summary(radar: dict, model: dict) -> dict:
    A = radar["agencies"]
    ok = [a for a in A if (a.get("offshore") or {}).get("ok")]
    def mean(xs):
        xs = [x for x in xs if x is not None]
        return round(sum(xs) / len(xs), 1) if xs else None
    idx = sorted(a["offshore"]["index"] for a in ok)
    med = idx[len(idx) // 2] if len(idx) % 2 else (idx[len(idx) // 2 - 1] + idx[len(idx) // 2]) / 2 if idx else None
    bands = {}
    for a in ok:
        bands[a["offshore"]["band"]] = bands.get(a["offshore"]["band"], 0) + 1
    def group(key):
        g = {}
        for a in ok:
            g.setdefault(str(a.get(key) or "unknown"), []).append(a)
        rows = [{"name": name, "n": len(items), "index": mean([x["offshore"]["index"] for x in items]), "migration": mean([x["offshore"]["migration"] for x in items]),
                 "displacement": mean([x["offshore"]["displacement"] for x in items]), "asia": round(sum(x["offshore"]["asia"] for x in items) / len(items), 3),
                 "observed": sum(1 for x in items if x["offshore"]["evidence_class"] == "observed")} for name, items in g.items()]
        rows.sort(key=lambda r: -r["n"])
        return rows
    # field shore split, index-weighted
    tot = sum(a["offshore"]["index"] for a in ok) or 1.0
    shore = {}
    for rid in model["shores"]["regions"]:
        shore[rid] = round(sum(a["offshore"]["index"] * a["offshore"]["shore"].get(rid, 0.0) for a in ok) / tot, 3)
    caps = {}
    for a in ok:
        for c in a["offshore"]["contrib"]:
            caps[c["cap"]] = caps.get(c["cap"], 0.0) + c["pts"]
    cap_rows = [{"cap": k, "label": dict(radar["meta"]["strat_dims"]).get(k, k), "mean_pts": round(v / len(ok), 1), "off": model["offshorability"][k]["off"]} for k, v in caps.items()]
    cap_rows.sort(key=lambda r: -r["mean_pts"])
    footprint = [a["id"] for a in ok if a["offshore"]["hub_offices"] or a["offshore"]["hub_jobs"]]
    return {
        "n_read": len(ok), "n_no_read": len(A) - len(ok), "index_mean": mean([a["offshore"]["index"] for a in ok]), "index_median": med,
        "migration_mean": mean([a["offshore"]["migration"] for a in ok]), "displacement_mean": mean([a["offshore"]["displacement"] for a in ok]),
        "asia_mean": round(sum(a["offshore"]["asia"] for a in ok) / max(1, len(ok)), 3), "overlap_mean": round(sum(a["offshore"]["overlap"] for a in ok) / max(1, len(ok)), 3),
        "bands": bands, "shore": shore, "capabilities": cap_rows,
        "observed": {"hub_office": sum(1 for a in ok if a["offshore"]["hub_offices"]), "hub_jobs": sum(1 for a in ok if a["offshore"]["hub_jobs"]),
                     "delivery_language": sum(1 for a in ok if any(t["term"] == "delivery_language" for t in a["offshore"]["terms"]["migration"])),
                     "white_label": sum(1 for a in ok if any(t["term"] == "white_label" for t in a["offshore"]["terms"]["displacement"])),
                     "hourly": sum(1 for a in ok if any(t["term"] == "hourly" for t in a["offshore"]["terms"]["displacement"])),
                     "onshore_claim": sum(1 for a in ok if a["offshore"]["onshore_claims"]), "any": sum(1 for a in ok if a["offshore"]["evidence_class"] == "observed")},
        "footprint_ids": footprint, "by_region": group("region"), "by_segment": group("segment"), "by_archetype": group("archetype"), "by_icp": group("icp"), "by_ownership": group("ownership"),
        "hub_offices_by_region": {rid: sum(1 for a in ok if any(h["region"] == rid for h in a["offshore"]["hub_offices"])) for rid in model["shores"]["regions"]},
    }


def rebuild(radar: dict, model: dict) -> None:
    layers = {a["id"]: compute(a, radar, model) for a in radar["agencies"]}
    percentiles(layers)
    for a in radar["agencies"]:
        a["offshore"] = layers[a["id"]]
    radar["offshore"] = {"model": {k: v for k, v in model.items() if not k.startswith("_")}, "field": field_summary(radar, model)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["rebuild", "one", "field"])
    ap.add_argument("arg", nargs="?")
    ap.add_argument("--radar", default=str(RADAR_PATH))
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    radar = radar_horus.load_radar(Path(a.radar))
    model = load_model()
    if a.cmd == "one":
        ag = next((x for x in radar["agencies"] if x["id"] == a.arg or x.get("domain") == a.arg), None)
        if not ag:
            raise SystemExit("no such agency in the registry")
        print(json.dumps(compute(ag, radar, model), indent=1, ensure_ascii=False))
        return
    rebuild(radar, model)
    if a.cmd == "field":
        print(json.dumps(radar["offshore"]["field"], indent=1, ensure_ascii=False))
        return
    if a.write:
        Path(a.radar).write_text(json.dumps(radar, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"Monsoon layer rebuilt for {len(radar['agencies'])} agencies and written to {a.radar}")
    else:
        f = radar["offshore"]["field"]
        print(f"Monsoon layer rebuilt for {f['n_read']} agencies (dry run): index mean {f['index_mean']}, bands {f['bands']}, observed evidence on {f['observed']['any']}")


if __name__ == "__main__":
    main()
