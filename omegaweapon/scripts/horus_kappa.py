#!/usr/bin/env python3
"""HORUS inter-coder reliability: Cohen's kappa between the first-pass codes in a ledger and an
independent second coder's codes for a random subsample.

Usage:
  1. Draw the blind sample (codes stripped, seeded so it can be reproduced):
     python horus_kappa.py --ledger assets/editions/X.json --draw 60 --seed 7 --sample-out blind.json
  2. Hand blind.json and references/CODEBOOK.md to ONE second coder (a person, or a single subagent
     with no web access) who returns second_coder.json: {"ITEM_ID": {"topic": "T01", "intent": "N"}, ...}
  3. Score it:
     python horus_kappa.py --ledger assets/editions/X.json --second second_coder.json --out X.kappa.json
Reports kappa for primary topic, for topic cluster, and for intent, plus percent agreement and the
disagreement list, so the codebook can be sharpened where coders split."""
from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from pathlib import Path


def kappa(a: list[str], b: list[str]) -> dict:
    n = len(a)
    if n == 0:
        return {"n": 0, "agreement": None, "kappa": None}
    po = sum(1 for x, y in zip(a, b) if x == y) / n
    ca, cb = Counter(a), Counter(b)
    pe = sum((ca[k] / n) * (cb[k] / n) for k in set(ca) | set(cb))
    k = (po - pe) / (1 - pe) if pe < 1 else 1.0
    return {"n": n, "agreement": round(po, 3), "kappa": round(k, 3)}


def landis_koch(k):
    if k is None:
        return "n/a"
    return ("poor" if k < 0 else "slight" if k < 0.21 else "fair" if k < 0.41 else
            "moderate" if k < 0.61 else "substantial" if k < 0.81 else "almost perfect")


def draw(ledger: dict, n: int, seed: int) -> list[dict]:
    """Random counted items with every code stripped: the second coder sees what the first coder saw."""
    pool = [i for i in ledger["items"] if "set" not in (i.get("flags") or [])]
    rng = random.Random(seed)
    pick = rng.sample(pool, min(n, len(pool)))
    return [{"id": i["id"], "platform": i["platform"], "community": i.get("community", ""), "title": i["title"]} for i in pick]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ledger", required=True)
    ap.add_argument("--second")
    ap.add_argument("--draw", type=int, help="draw a blind sample of N items instead of scoring")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--sample-out", default="blind_sample.json")
    ap.add_argument("--nomes", default=str(Path(__file__).resolve().parent.parent / "assets" / "nomes.json"))
    ap.add_argument("--out")
    a = ap.parse_args()
    ledger = json.loads(Path(a.ledger).read_text(encoding="utf-8"))
    if a.draw:
        sample = draw(ledger, a.draw, a.seed)
        Path(a.sample_out).write_text(json.dumps(sample, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{len(sample)} blind items -> {a.sample_out} (seed {a.seed})")
        return
    if not a.second:
        ap.error("--second is required when scoring (or use --draw N to draw the blind sample)")
    second = json.loads(Path(a.second).read_text(encoding="utf-8"))
    nomes = json.loads(Path(a.nomes).read_text(encoding="utf-8"))
    nome = next(n for n in nomes["nomes"] if n["id"] == ledger["nome"])
    cluster_of = {t: c for c, ids in nome.get("clusters", {}).items() for t in ids}
    first = {i["id"]: i for i in ledger["items"]}
    ids = [k for k in second if k in first]
    t1 = [first[k]["topic"] for k in ids]
    t2 = [second[k]["topic"] for k in ids]
    i1 = [first[k]["intent"] for k in ids]
    i2 = [second[k]["intent"] for k in ids]
    res = {
        "topic": kappa(t1, t2),
        "cluster": kappa([cluster_of.get(x, "Other") for x in t1], [cluster_of.get(x, "Other") for x in t2]),
        "intent": kappa(i1, i2),
        "disagreements": [{"id": k, "title": first[k]["title"], "first": [first[k]["topic"], first[k]["intent"]],
                           "second": [second[k]["topic"], second[k]["intent"]]}
                          for k in ids if first[k]["topic"] != second[k]["topic"] or first[k]["intent"] != second[k]["intent"]],
    }
    for key in ("topic", "cluster", "intent"):
        res[key]["reading"] = landis_koch(res[key]["kappa"])
    txt = json.dumps(res, ensure_ascii=False, indent=1)
    if a.out:
        Path(a.out).write_text(txt, encoding="utf-8")
    print(json.dumps({k: res[k] for k in ("topic", "cluster", "intent")}, indent=1))
    print(f"{len(res['disagreements'])} items with any disagreement")


if __name__ == "__main__":
    main()
