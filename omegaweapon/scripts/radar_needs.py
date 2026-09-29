#!/usr/bin/env python3
"""OMEGAWEAPON platform: the needs layer (what each tracked agency's clients came for).

For every client the Radar recorded, reads the engagement evidence (a matched case study title, the words in the case
study URL, the evidence type) against the needs taxonomy in assets/radar/needs.json and assigns need codes. Rolls up
per agency: the need mix (what its book buys from it, weighted by evidence quality), verticals, clients shared with
other tracked agencies (a client on several books is a client that shops), and the evidence quality of the book. A
client whose evidence names nothing gets N0: the dossier then says the need is inferred from the sold mix, not read.

Usage
  python3 scripts/radar_needs.py rebuild [--write]     classify every client and write agency.needs into the registry
  python3 scripts/radar_needs.py one <agency id>       print one agency's needs read
Pure standard library.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import radar_horus  # noqa: E402

RADAR_PATH = ROOT / "assets" / "radar" / "radar.json"
NEEDS_PATH = ROOT / "assets" / "radar" / "needs.json"


def load_needs() -> dict:
    return json.loads(NEEDS_PATH.read_text(encoding="utf-8"))


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


def slug_words(url: str, stop: set[str], client: str) -> str:
    try:
        p = urlsplit(url)
    except ValueError:
        return ""
    parts = re.split(r"[/_\-.+%]+", p.path.lower())
    cw = set(re.split(r"[^a-z0-9]+", client.lower()))
    return " ".join(w for w in parts if w and w not in stop and w not in cw and not w.isdigit())


def match_codes(text: str, needs: dict) -> list[tuple[str, int]]:
    t = " " + norm(text) + " "
    out = []
    for code, spec in needs["codes"].items():
        if not spec["kw"]:
            continue
        hits = 0
        for kw in spec["kw"]:
            k = kw.lower()
            if k.strip() != k:  # spaced patterns like "ai " keep their boundary
                if k in t:
                    hits += 1
            elif re.search(r"(?<![a-z0-9])" + re.escape(k) + r"(?![a-z0-9])", t):
                hits += 1
        if hits:
            out.append((code, hits))
    out.sort(key=lambda x: (-x[1], x[0]))
    return out


def classify_client(c: dict, deep_titles: list[dict], needs: dict) -> dict:
    name = c.get("name") or ""
    ev = c.get("evidence") or ""
    url = c.get("url") or ""
    title = None
    excerpt = ""
    # the full name, then the part before a parenthetical, then the parenthetical itself (an acronym or trade name)
    variants = [norm(name)]
    pm = re.match(r"^(.*?)\s*\(([^)]{2,})\)\s*$", name)
    if pm:
        variants += [norm(pm.group(1)), norm(pm.group(2))]
    variants = [v for v in variants if len(v) >= 3]
    for cs in deep_titles:
        t = norm(cs.get("title") or "")
        if any(v in t for v in variants) or (url and cs.get("url") == url):
            title = cs.get("title")
            excerpt = cs.get("excerpt") or ""
            break
    stop = set(needs["slug_stopwords"])
    source = "title" if title else ("slug" if url else "type")
    text = title or slug_words(url, stop, name)
    # a deepened case study also carries its excerpt: the need words often sit there, not in the title
    codes = match_codes((text + ". " + excerpt) if excerpt else text, needs) if text else []
    if not codes and title and url:
        codes = match_codes(slug_words(url, stop, name), needs)
    codes = [c0 for c0, _ in codes][:3]
    if not codes:
        codes = ["N0"]
        source = "none"
    weight = needs["evidence_weight"].get(ev, 0.5)
    return {"name": name, "evidence": ev, "url": url, "title": title, "signal": text if source != "none" else "", "source": source, "needs": codes, "weight": weight}


def agency_needs(a: dict, needs: dict, shared_index: dict[str, list[str]]) -> dict:
    deep_titles = ((a.get("deep") or {}).get("case_studies") or [])
    rows = [classify_client(c, deep_titles, needs) for c in (a.get("clients") or [])]
    mix: dict[str, float] = {}
    observed = 0
    for r in rows:
        if r["needs"] == ["N0"]:
            continue
        observed += 1
        for i, code in enumerate(r["needs"]):
            mix[code] = mix.get(code, 0.0) + r["weight"] / (i + 1)
    tot = sum(mix.values()) or 1.0
    mix_rows = sorted([{"code": k, "label": needs["codes"][k]["label"], "share": round(v / tot, 3), "n": sum(1 for r in rows if k in r["needs"])} for k, v in mix.items()], key=lambda x: -x["share"])
    shared = []
    for r in rows:
        key = norm(re.sub(r"[^a-z0-9 ]+", " ", r["name"]))
        others = [x for x in shared_index.get(key, []) if x != a["id"]]
        if others:
            shared.append({"name": r["name"], "agencies": others})
    shared.sort(key=lambda x: -len(x["agencies"]))
    ev_types: dict[str, int] = {}
    for r in rows:
        ev_types[r["evidence"]] = ev_types.get(r["evidence"], 0) + 1
    return {
        "n": len(rows), "observed": observed, "named_only": len(rows) - observed, "evidence_types": ev_types, "mix": mix_rows,
        "top": [m["code"] for m in mix_rows[:3]], "clients": rows, "shared": shared[:40], "shared_n": len(shared),
        "inferred_from_mix": [k for k in (a.get("lead") or [])],
    }


def build_shared_index(A: list[dict]) -> dict[str, list[str]]:
    idx: dict[str, list[str]] = {}
    for a in A:
        for c in a.get("clients") or []:
            key = norm(re.sub(r"[^a-z0-9 ]+", " ", c.get("name") or ""))
            if not key:
                continue
            idx.setdefault(key, [])
            if a["id"] not in idx[key]:
                idx[key].append(a["id"])
    return idx


def rebuild(radar: dict, needs: dict | None = None) -> None:
    needs = needs or load_needs()
    A = radar["agencies"]
    shared_index = build_shared_index(A)
    for a in A:
        a["needs"] = agency_needs(a, needs, shared_index)
    # field summary
    tot: dict[str, float] = {}
    n_obs = 0
    n_all = 0
    for a in A:
        n_all += a["needs"]["n"]
        n_obs += a["needs"]["observed"]
        for m in a["needs"]["mix"]:
            tot[m["code"]] = tot.get(m["code"], 0.0) + m["share"]
    s = sum(tot.values()) or 1.0
    radar["needs"] = {"taxonomy": {k: {"label": v["label"], "short": v["short"], "why": v["why"]} for k, v in needs["codes"].items()},
                      "field": {"clients": n_all, "observed": n_obs, "named_only": n_all - n_obs,
                                "mix": sorted([{"code": k, "label": needs["codes"][k]["label"], "share": round(v / s, 3)} for k, v in tot.items()], key=lambda x: -x["share"]),
                                "shoppers": sorted([{"name": next((c.get("name") for a in A for c in (a.get("clients") or []) if norm(re.sub(r"[^a-z0-9 ]+", " ", c.get("name") or "")) == k), k), "n": len(v), "agencies": v} for k, v in shared_index.items() if len(v) >= 3], key=lambda x: -x["n"])[:40]}}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["rebuild", "one"])
    ap.add_argument("arg", nargs="?")
    ap.add_argument("--radar", default=str(RADAR_PATH))
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    radar = radar_horus.load_radar(Path(a.radar))
    needs = load_needs()
    if a.cmd == "one":
        ag = next((x for x in radar["agencies"] if x["id"] == a.arg or x.get("domain") == a.arg), None)
        if not ag:
            raise SystemExit("no such agency")
        print(json.dumps(agency_needs(ag, needs, build_shared_index(radar["agencies"])), indent=1, ensure_ascii=False)[:6000])
        return
    rebuild(radar, needs)
    f = radar["needs"]["field"]
    print(f"needs read for {len(radar['agencies'])} agencies: {f['clients']} client rows, {f['observed']} with engagement evidence, {f['named_only']} named only; field mix {[(m['code'], m['share']) for m in f['mix'][:6]]}")
    if a.write:
        Path(a.radar).write_text(json.dumps(radar, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print("written")


if __name__ == "__main__":
    main()
