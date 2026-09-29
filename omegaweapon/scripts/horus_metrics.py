#!/usr/bin/env python3
"""HORUS metrics engine (the Eye's arithmetic).

Reads a coded edition ledger (items + rooms) and the nome taxonomy, and computes:
  - share of voice per topic for each eye (Sun = broadcast, Moon = practitioner floor)
  - Stereopsis: the weighted log-odds ratio with an informative Dirichlet prior
    (Monroe, Colaresi and Quinn 2008) between the two eyes, with z-scores
  - Pain index: share of floor items that are questions or complaints
  - intent and stance profiles, lane and platform coverage
  - Room census: what Discord servers and Telegram channels are organised around
  - a heuristic lifecycle-stage suggestion for the analyst to confirm or overrule
  - measured momentum against a previous edition of the same nome: change in share per topic and
    eye, with a two-proportion z-score

Usage:
  python horus_metrics.py --ledger assets/editions/X.json --nomes assets/nomes.json [--previous assets/editions/W.json] [--out metrics.json]
Pure standard library. Deterministic.
"""
from __future__ import annotations

import argparse
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

FLOOR_PAIN = {"Q", "C"}


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def counted(item) -> bool:
    """Set-flagged items stay in the ledger but never count toward share of voice."""
    return "set" not in (item.get("flags") or [])


def shares(counter: Counter, total: int) -> dict:
    return {k: (v / total if total else 0.0) for k, v in counter.items()}


def log_odds_dirichlet(y_a: Counter, y_b: Counter, topics: list[str], alpha0: float) -> dict:
    """Weighted log-odds ratio of topic w in corpus A vs corpus B with an informative
    Dirichlet prior built from the pooled corpus (Monroe, Colaresi and Quinn 2008).
    delta > 0 means over-represented in A. z = delta / sqrt(var)."""
    n_a, n_b = sum(y_a.values()), sum(y_b.values())
    pooled = Counter(y_a) + Counter(y_b)
    n_pool = sum(pooled.values()) or 1
    out = {}
    for w in topics:
        # prior mass proportional to pooled frequency, with a floor so unseen topics stay defined
        a_w = alpha0 * max(pooled.get(w, 0), 0.5) / (n_pool + 0.5 * len(topics))
        ya, yb = y_a.get(w, 0), y_b.get(w, 0)
        la = math.log((ya + a_w) / (n_a + alpha0 - ya - a_w))
        lb = math.log((yb + a_w) / (n_b + alpha0 - yb - a_w))
        delta = la - lb
        var = 1.0 / (ya + a_w) + 1.0 / (yb + a_w)
        out[w] = {"delta": delta, "z": delta / math.sqrt(var)}
    return out


def stereo_class(z: float, moon_n: int, sun_n: int) -> str:
    if moon_n == 0 and sun_n >= 3:
        return "broadcast-only"
    if sun_n == 0 and moon_n >= 2:
        return "floor-only"
    if z >= 1.96:
        return "floor-led"
    if z <= -1.96:
        return "broadcast-led"
    if z >= 1.0:
        return "leaning floor"
    if z <= -1.0:
        return "leaning broadcast"
    return "balanced"


def suggest_stage(sun_share, moon_share, pain, intents_sun: Counter, intents_moon: Counter) -> str:
    """Heuristic only. The analyst assigns the stage of record in the analysis file."""
    n_sun, n_moon = sum(intents_sun.values()), sum(intents_moon.values())
    news_sun = intents_sun.get("N", 0) / n_sun if n_sun else 0
    howto = (intents_sun.get("H", 0) + intents_moon.get("H", 0)) / ((n_sun + n_moon) or 1)
    if n_moon == 0 and news_sun >= 0.5:
        return "Khepri (announced, not yet on the floor)"
    if sun_share >= 0.05 and pain is not None and pain >= 0.5:
        return "Ra (loud and contested)"
    if howto >= 0.4:
        return "Atum (operational, being standardised)"
    if moon_share > sun_share * 2 and sun_share < 0.02:
        return "Duat (floor-only residue)"
    return "Ra (loud)" if sun_share >= 0.06 else "Atum (operational)"


def momentum(prev: dict, cur: dict, topics: list[str]) -> dict:
    """Edition-over-edition change in share of voice for each topic in each eye (counted items only).
    z is the two-proportion z-score; |z| >= 1.96 is a change unlikely to be sampling noise."""
    out = {"previous_edition": prev.get("edition"), "previous_run_date": prev.get("run_date"), "topics": {}}
    for eye in ("sun", "moon"):
        a = [i for i in prev.get("items", []) if i["eye"] == eye and counted(i)]
        b = [i for i in cur.get("items", []) if i["eye"] == eye and counted(i)]
        na, nb = len(a), len(b)
        ca, cb = Counter(i["topic"] for i in a), Counter(i["topic"] for i in b)
        for t in topics:
            pa = ca[t] / na if na else 0.0
            pb = cb[t] / nb if nb else 0.0
            pool = (ca[t] + cb[t]) / (na + nb) if (na + nb) else 0.0
            se = math.sqrt(pool * (1 - pool) * (1 / na + 1 / nb)) if na and nb and 0 < pool < 1 else None
            out["topics"].setdefault(t, {})[eye] = {"prev": round(pa, 4), "cur": round(pb, 4), "delta": round(pb - pa, 4),
                                                   "z": round((pb - pa) / se, 2) if se else None}
    return out


def compute(ledger: dict, nomes: dict, previous: dict | None = None) -> dict:
    nome = next(n for n in nomes["nomes"] if n["id"] == ledger["nome"])
    tax = nome["taxonomy"]
    topics = [t["id"] for t in tax]
    labels = {t["id"]: t["label"] for t in tax}
    items = ledger["items"]

    sun_items = [i for i in items if i["eye"] == "sun"]
    moon_items = [i for i in items if i["eye"] == "moon"]
    sun_c = [i for i in sun_items if counted(i)]
    moon_c = [i for i in moon_items if counted(i)]

    y_sun = Counter(i["topic"] for i in sun_c)
    y_moon = Counter(i["topic"] for i in moon_c)
    n_sun, n_moon = len(sun_c), len(moon_c)
    sov_sun, sov_moon = shares(y_sun, n_sun), shares(y_moon, n_moon)

    # engagement-weighted floor share: forum replies + 1, Telegram views / 1000
    w_moon = Counter()
    for i in moon_c:
        e = i.get("engagement") or {}
        w = 1.0 + e.get("replies", 0) if "replies" in e else (e.get("views", 0) / 1000.0 if "views" in e else 1.0)
        w_moon[i["topic"]] += max(w, 0.5)
    w_total = sum(w_moon.values())

    # secondary-topic mentions (topic2 counted at half weight) for the reach view
    mentions = defaultdict(lambda: {"sun": 0.0, "moon": 0.0})
    for i in sun_c + moon_c:
        mentions[i["topic"]][i["eye"]] += 1.0
        if i.get("topic2"):
            mentions[i["topic2"]][i["eye"]] += 0.5

    lo = log_odds_dirichlet(y_moon, y_sun, topics, alpha0=float(len(topics)))

    per_topic = []
    for t in topics:
        mi = [i for i in moon_c if i["topic"] == t]
        si = [i for i in sun_c if i["topic"] == t]
        pain = (sum(1 for i in mi if i["intent"] in FLOOR_PAIN) / len(mi)) if mi else None
        st_sun = (sum(i["stance"] for i in si) / len(si)) if si else None
        st_moon = (sum(i["stance"] for i in mi) / len(mi)) if mi else None
        grey = sum(1 for i in mi if "grey" in (i.get("flags") or []))
        cls = stereo_class(lo[t]["z"], len(mi), len(si))
        per_topic.append({
            "id": t, "label": labels[t],
            "sun_n": len(si), "moon_n": len(mi),
            "sun_share": round(sov_sun.get(t, 0.0), 4), "moon_share": round(sov_moon.get(t, 0.0), 4),
            "moon_share_weighted": round(w_moon.get(t, 0.0) / w_total, 4) if w_total else 0.0,
            "heat": round((sov_sun.get(t, 0.0) + sov_moon.get(t, 0.0)) / 2, 4),
            "stereo_delta": round(lo[t]["delta"], 3), "stereo_z": round(lo[t]["z"], 2), "stereo_class": cls,
            "pain": round(pain, 3) if pain is not None else None,
            "stance_sun": round(st_sun, 2) if st_sun is not None else None,
            "stance_moon": round(st_moon, 2) if st_moon is not None else None,
            "grey_n": grey,
            "mentions_sun": mentions[t]["sun"], "mentions_moon": mentions[t]["moon"],
            "stage_hint": suggest_stage(sov_sun.get(t, 0.0), sov_moon.get(t, 0.0), pain,
                                        Counter(i["intent"] for i in si), Counter(i["intent"] for i in mi)),
        })

    lanes = defaultdict(lambda: {"n": 0, "eye": "", "platforms": set()})
    for i in items:
        L = lanes[i["lane"]]
        L["n"] += 1
        L["eye"] = i["eye"]
        L["platforms"].add(i["platform"])
    lanes_out = [{"lane": k, "eye": v["eye"], "n": v["n"], "platforms": sorted(v["platforms"])} for k, v in lanes.items()]

    # room census
    rooms = ledger.get("rooms", [])
    census = {}
    for plat in sorted({r["platform"] for r in rooms}):
        rs = [r for r in rooms if r["platform"] == plat]
        cnt = Counter(r["topic"] for r in rs if "set" not in r["flags"])
        size = Counter()
        for r in rs:
            if r.get("size") and "set" not in r["flags"]:
                size[r["topic"]] += r["size"]
        census[plat] = {
            "n": len(rs), "set_flagged": sum(1 for r in rs if "set" in r["flags"]),
            "by_topic_count": dict(cnt.most_common()),
            "by_topic_size": dict(size.most_common()),
            "size_total": sum(size.values()),
            "langs": dict(Counter(r["lang"] for r in rs).most_common()),
        }

    intents = {eye: dict(Counter(i["intent"] for i in lst).most_common()) for eye, lst in (("sun", sun_c), ("moon", moon_c))}
    stance = {eye: round(sum(i["stance"] for i in lst) / len(lst), 3) if lst else None for eye, lst in (("sun", sun_c), ("moon", moon_c))}
    by_date = Counter(i["date"] for i in sun_c if not i.get("date_approx"))
    clusters = {}
    for cname, ids in nome.get("clusters", {}).items():
        clusters[cname] = {"sun": round(sum(sov_sun.get(t, 0) for t in ids), 4), "moon": round(sum(sov_moon.get(t, 0) for t in ids), 4)}

    lane_topic = defaultdict(Counter)
    for i in sun_c + moon_c:
        lane_topic[i["lane"]][i["topic"]] += 1

    mom = momentum(previous, ledger, topics) if previous and previous.get("nome") == ledger.get("nome") else None

    return {
        "momentum": mom,
        "n": {"sun_total": len(sun_items), "moon_total": len(moon_items), "sun_counted": n_sun, "moon_counted": n_moon,
              "set_flagged": sum(1 for i in items if not counted(i)),
              "grey_flagged": sum(1 for i in items if "grey" in (i.get("flags") or [])),
              "rooms": len(rooms)},
        "topics": per_topic,
        "clusters": clusters,
        "lanes": lanes_out,
        "lane_topic": {k: dict(v) for k, v in lane_topic.items()},
        "intents": intents,
        "stance": stance,
        "census": census,
        "sun_by_date": dict(sorted(by_date.items())),
        "method": {
            "sov": "primary topic only; set-flagged items excluded",
            "stereopsis": "weighted log-odds ratio, informative Dirichlet prior from the pooled corpus, alpha0 = number of topics; positive = floor-led",
            "pain": "share of floor items coded Q (help-seeking) or C (complaint)",
            "weighted_floor": "forum threads weighted by replies + 1, Telegram posts by views / 1000",
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ledger", required=True)
    ap.add_argument("--nomes", required=True)
    ap.add_argument("--previous", help="an earlier edition ledger of the same nome, for measured momentum")
    ap.add_argument("--out")
    a = ap.parse_args()
    m = compute(load(a.ledger), load(a.nomes), load(a.previous) if a.previous else None)
    txt = json.dumps(m, ensure_ascii=False, indent=1)
    if a.out:
        Path(a.out).write_text(txt, encoding="utf-8")
        print(f"metrics -> {a.out}")
    else:
        print(txt)


if __name__ == "__main__":
    main()
