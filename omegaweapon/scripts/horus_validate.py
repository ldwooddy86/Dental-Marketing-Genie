#!/usr/bin/env python3
"""HORUS edition validator (the Scales of Ma'at).

Checks one edition against the contract before anything is built or published:
  ledger items and rooms, Nilometer signals, events and watch calendar, the analysis of record,
  and the coder-reliability file. Errors stop a build. Warnings are printed for the analyst to judge.

Usage:
  python horus_validate.py --edition assets/editions/X.json [--nomes assets/nomes.json] [--strict]
Siblings are found by name next to the ledger: X.signals.json, X.analysis.json, X.kappa.json.
--strict turns warnings into errors (use it before publishing).
Pure standard library.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ICD_TERMS = ["almost no chance", "very unlikely", "unlikely", "roughly even chance", "likely", "very likely", "almost certain"]
ICD_BY_LEN = sorted(ICD_TERMS, key=len, reverse=True)
STAGES = {"Khepri", "Ra", "Atum", "Duat"}
CONFIDENCE = {"low", "low to moderate", "moderate", "moderate to high", "high"}
MOMENTUM = {"up strongly", "up", "flat", "down", "down strongly"}
GRADE_RE = re.compile(r"^[A-F][1-6]$")
DATE_RE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")
URL_RE = re.compile(r"^https?://\S+$", re.I)
# "(Jane Doe)" or "(J. Doe, Sam Roe)" in a floor community field suggests a named individual
NAME_PAREN_RE = re.compile(r"\((?:[A-Z][a-z]*\.?\s)+[A-Z][A-Za-z'\-]+(?:,\s*(?:[A-Z][a-z]*\.?\s)+[A-Z][A-Za-z'\-]+)*\)")
HANDLE_RE = re.compile(r"(?:^|\s)(?:u/|@)[A-Za-z0-9_\-]{3,}")
EM_DASH = "—"

ITEM_KEYS = ["id", "eye", "lane", "platform", "community", "date", "topic", "intent", "stance", "flags", "title", "url"]
ROOM_KEYS = ["id", "platform", "name", "lang", "topic", "flags", "url"]
SIGNAL_KEYS = ["id", "domain", "metric", "value", "date", "source", "url", "grade"]


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def siblings(ledger_path: Path) -> dict:
    stem = ledger_path.name[:-5] if ledger_path.name.endswith(".json") else ledger_path.name
    out = {}
    for key, suffix in (("signals", ".signals.json"), ("analysis", ".analysis.json"), ("kappa", ".kappa.json")):
        p = ledger_path.with_name(stem + suffix)
        out[key] = p if p.exists() else None
    return out


def icd_parts(likelihood: str) -> list[str | None]:
    parts = [x.strip() for x in str(likelihood or "").split(";") if x.strip()]
    found = []
    for p in parts:
        low = p.lower()
        found.append(next((t for t in ICD_BY_LEN if low.startswith(t)), None))
    return found


def walk_strings(obj, path="$"):
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, f"{path}[{i}]")


def validate(ledger: dict, nomes: dict, signals: dict | None = None, analysis: dict | None = None,
             kappa: dict | None = None) -> tuple[list[str], list[str]]:
    E: list[str] = []
    W: list[str] = []

    for k in ("edition", "nome", "run_date", "items"):
        if k not in ledger:
            E.append(f"ledger: missing top-level key '{k}'")
    nome = next((n for n in nomes.get("nomes", []) if n["id"] == ledger.get("nome")), None)
    if not nome:
        E.append(f"ledger: nome '{ledger.get('nome')}' is not defined in nomes.json")
        return E, W
    topics = {t["id"] for t in nome["taxonomy"]}
    intents = set(nomes.get("intent_codes", {}))
    flags_ok = set(nomes.get("flags", {}))

    # items
    items = ledger.get("items", [])
    seen = set()
    for it in items:
        iid = it.get("id", "?")
        miss = [k for k in ITEM_KEYS if k not in it]
        if miss:
            E.append(f"item {iid}: missing {miss}")
            continue
        if iid in seen:
            E.append(f"item {iid}: duplicate id")
        seen.add(iid)
        if it["eye"] not in ("sun", "moon"):
            E.append(f"item {iid}: eye must be sun or moon")
        if (iid.startswith("S") and it["eye"] != "sun") or (iid.startswith("M") and it["eye"] != "moon"):
            W.append(f"item {iid}: id prefix does not match eye '{it['eye']}'")
        if it["topic"] not in topics:
            E.append(f"item {iid}: unknown topic {it['topic']}")
        if it.get("topic2") and it["topic2"] not in topics:
            E.append(f"item {iid}: unknown topic2 {it['topic2']}")
        if it.get("topic2") == it["topic"]:
            W.append(f"item {iid}: topic2 repeats the primary topic")
        if it["intent"] not in intents:
            E.append(f"item {iid}: unknown intent {it['intent']}")
        if it["stance"] not in (-1, 0, 1):
            E.append(f"item {iid}: stance must be -1, 0 or 1")
        bad = [f for f in it["flags"] if f not in flags_ok]
        if bad:
            E.append(f"item {iid}: unknown flags {bad}")
        if not URL_RE.match(str(it["url"])):
            E.append(f"item {iid}: url must be http(s)")
        if not DATE_RE.match(str(it["date"])):
            E.append(f"item {iid}: date must be YYYY-MM or YYYY-MM-DD")
        if not str(it["title"]).strip():
            E.append(f"item {iid}: empty title")
        if it["eye"] == "moon":
            if NAME_PAREN_RE.search(str(it.get("community", ""))):
                W.append(f"item {iid}: floor community may name an individual ('{it['community']}'); pseudonymize floor authors")
            if it.get("lane") not in ("telegram",) and HANDLE_RE.search(str(it.get("community", ""))):
                W.append(f"item {iid}: floor community carries a handle ('{it['community']}'); pseudonymize floor authors")
    n_sun = sum(1 for i in items if i.get("eye") == "sun")
    n_moon = sum(1 for i in items if i.get("eye") == "moon")
    if n_sun < 30 or n_moon < 30:
        W.append(f"thin sample: {n_sun} broadcast and {n_moon} floor items (aim for at least 100 and 50); say so in the limitations")

    # rooms
    rooms = ledger.get("rooms", [])
    rseen = set()
    for r in rooms:
        rid = r.get("id", "?")
        miss = [k for k in ROOM_KEYS if k not in r]
        if miss:
            E.append(f"room {rid}: missing {miss}")
            continue
        if rid in rseen:
            E.append(f"room {rid}: duplicate id")
        rseen.add(rid)
        if r["topic"] not in topics:
            E.append(f"room {rid}: unknown topic {r['topic']}")
        if r.get("topic2") and r["topic2"] not in topics:
            E.append(f"room {rid}: unknown topic2 {r['topic2']}")
        bad = [f for f in r["flags"] if f not in flags_ok]
        if bad:
            E.append(f"room {rid}: unknown flags {bad}")
        if not URL_RE.match(str(r["url"])):
            E.append(f"room {rid}: url must be http(s)")
        if r.get("size") is not None and not isinstance(r["size"], int):
            E.append(f"room {rid}: size must be an integer or null")
    room_platforms = {r.get("platform") for r in rooms}

    # signals
    sig_ids = set()
    if signals is None:
        W.append("no Nilometer file (X.signals.json): the dashboard will have no hard signals and the analysis cannot cite N-refs")
        signals = {}
    for s in signals.get("signals", []):
        sid = s.get("id", "?")
        miss = [k for k in SIGNAL_KEYS if not s.get(k)]
        if miss:
            E.append(f"signal {sid}: missing or empty {miss}")
        if sid in sig_ids:
            E.append(f"signal {sid}: duplicate id")
        sig_ids.add(sid)
        if s.get("grade") and not GRADE_RE.match(s["grade"]):
            E.append(f"signal {sid}: grade '{s['grade']}' is not an Admiralty code (A-F then 1-6)")
        if s.get("url") and not URL_RE.match(s["url"]):
            E.append(f"signal {sid}: url must be http(s)")
        if s.get("date") and not DATE_RE.match(s["date"]):
            E.append(f"signal {sid}: date must be YYYY-MM or YYYY-MM-DD")
        for t in s.get("topics", []):
            if t not in topics:
                E.append(f"signal {sid}: unknown topic {t}")

    kj_ids = {k.get("id") for k in (analysis or {}).get("key_judgments", [])}
    ind_ids = {i.get("id") for i in (analysis or {}).get("indicators", [])}

    def ref_ok(ref: str) -> bool:
        if re.fullmatch(r"N\d+", ref):
            return ref in sig_ids
        if re.fullmatch(r"[SM]\d{3,}", ref):
            return ref in seen
        if re.fullmatch(r"R\d{3,}", ref):
            return ref in rseen
        if re.fullmatch(r"KJ\d+", ref):
            return ref in kj_ids
        if re.fullmatch(r"I\d+", ref):
            return ref in ind_ids
        m = re.fullmatch(r"metrics:([A-Z]\d\d)", ref)
        if m:
            return m.group(1) in topics
        if re.fullmatch(r"metrics:(clusters|intents|stance)", ref):
            return True
        m = re.fullmatch(r"census:(\w+)", ref)
        if m:
            return m.group(1) in room_platforms
        return False

    for e in signals.get("events", []):
        if not DATE_RE.match(str(e.get("date", ""))):
            E.append(f"event '{e.get('label', '?')}': bad date")
        if e.get("topic") and e["topic"] not in topics:
            E.append(f"event '{e.get('label', '?')}': unknown topic {e['topic']}")
        if e.get("ref") and not ref_ok(e["ref"]):
            E.append(f"event '{e.get('label', '?')}': unresolved ref {e['ref']}")
    for w in signals.get("watch_calendar", []):
        if not DATE_RE.match(str(w.get("date", ""))):
            E.append(f"watch '{w.get('label', '?')}': bad date")
        if w.get("date", "") <= ledger.get("run_date", ""):
            W.append(f"watch '{w.get('label', '?')}': date is not after the run date")
        if w.get("indicator") and analysis and w["indicator"] not in ind_ids:
            E.append(f"watch '{w.get('label', '?')}': unknown indicator {w['indicator']}")

    # analysis of record
    if analysis is None:
        W.append("no analysis file (X.analysis.json): the dashboard will show measurements without judgments")
    else:
        a = analysis
        if not a.get("headline"):
            E.append("analysis: missing headline")
        if not a.get("bluf"):
            E.append("analysis: missing bluf")
        kseen = set()
        for k in a.get("key_judgments", []):
            kid = k.get("id", "?")
            if kid in kseen:
                E.append(f"{kid}: duplicate id")
            kseen.add(kid)
            for key in ("title", "judgment", "likelihood", "range", "confidence", "horizon", "evidence"):
                if not k.get(key):
                    E.append(f"{kid}: missing {key}")
            terms = icd_parts(k.get("likelihood", ""))
            if not terms or any(t is None for t in terms):
                E.append(f"{kid}: likelihood '{k.get('likelihood')}' must use ICD 203 terms ({', '.join(ICD_TERMS)})")
            rngs = [x.strip() for x in str(k.get("range", "")).split("/")]
            if len(rngs) != len(terms) or not all(re.fullmatch(r"\d{1,2}-\d{1,3}%", x) for x in rngs):
                E.append(f"{kid}: range '{k.get('range')}' must give one 'lo-hi%' band per likelihood part")
            if str(k.get("confidence", "")).lower() not in CONFIDENCE:
                E.append(f"{kid}: confidence must be one of {sorted(CONFIDENCE)}")
            if not k.get("falsifiers"):
                E.append(f"{kid}: every key judgment needs at least one falsifier")
            for t in k.get("topics", []):
                if t not in topics:
                    E.append(f"{kid}: unknown topic {t}")
            for r in k.get("evidence", []):
                if not ref_ok(r):
                    E.append(f"{kid}: unresolved evidence ref {r}")
            if len([r for r in k.get("evidence", []) if r.startswith("N")]) == 0:
                W.append(f"{kid}: no Nilometer signal in the evidence; a judgment resting on discourse alone is weaker")
        for f in a.get("discourse_findings", []):
            for r in f.get("refs", []):
                if not ref_ok(r):
                    E.append(f"{f.get('id', '?')}: unresolved ref {r}")
        for t, st in (a.get("stages") or {}).items():
            if t not in topics:
                E.append(f"stages: unknown topic {t}")
            if st.get("stage") not in STAGES:
                E.append(f"stages {t}: stage must be one of {sorted(STAGES)}")
        for t, d in (a.get("momentum_direction") or {}).items():
            if t.startswith("_"):
                continue
            if t not in topics:
                E.append(f"momentum: unknown topic {t}")
            if d not in MOMENTUM:
                E.append(f"momentum {t}: '{d}' must be one of {sorted(MOMENTUM)}")
        ach = a.get("ach") or {}
        hyp = {h["id"] for h in ach.get("hypotheses", [])}
        for ev in ach.get("evidence", []):
            for hid, r in (ev.get("r") or {}).items():
                if hid not in hyp:
                    E.append(f"ACH {ev.get('id')}: unknown hypothesis {hid}")
                if r not in ("C", "I", "N"):
                    E.append(f"ACH {ev.get('id')}: rating must be C, I or N")
            for r in ev.get("refs", []):
                if not ref_ok(r):
                    E.append(f"ACH {ev.get('id')}: unresolved ref {r}")
        sc = (a.get("scenarios") or {}).get("items", [])
        if sc:
            total = sum(s.get("probability", 0) for s in sc)
            if total != 100:
                E.append(f"scenarios: probabilities sum to {total}, not 100")
        for i in a.get("indicators", []):
            if i.get("kj") and i["kj"] not in kj_ids:
                E.append(f"indicator {i.get('id')}: unknown judgment {i['kj']}")
        for p in a.get("implications", []):
            for k in p.get("kj", []):
                if k not in kj_ids:
                    E.append(f"implication {p.get('id')}: unknown judgment {k}")
        for c in a.get("channels", []):
            for key in (c.get("match") or {}):
                if key not in ("platform", "lane", "community", "eye"):
                    E.append(f"channel {c.get('channel')}: match key '{key}' is not an item field")
            for r in c.get("signals", []):
                if not ref_ok(r):
                    E.append(f"channel {c.get('channel')}: unresolved signal {r}")
        for c in a.get("scorecard", []):
            if str(c.get("status", "")).lower() not in ("confirmed", "holding", "weakened", "falsified", "too early"):
                E.append(f"scorecard {c.get('kj', '?')}: status must be confirmed, holding, weakened, falsified or too early")
        dashes = [p for p, s in walk_strings(a) if EM_DASH in s]
        if dashes:
            W.append(f"analysis: {len(dashes)} strings contain em dashes (house style avoids them), e.g. {dashes[0]}")

    if kappa is None:
        W.append("no reliability file (X.kappa.json): run a blind second coder on a random sample and horus_kappa.py")
    else:
        k = (kappa.get("topic") or {}).get("kappa")
        if k is not None and k < 0.61:
            W.append(f"topic kappa {k} is below 0.61 (substantial); sharpen the codebook and recode before publishing")
    return E, W


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--edition", required=True, help="the coded ledger, e.g. assets/editions/digital-marketing-2026-09.json")
    ap.add_argument("--nomes", default=str(Path(__file__).resolve().parent.parent / "assets" / "nomes.json"))
    ap.add_argument("--strict", action="store_true", help="treat warnings as errors")
    a = ap.parse_args()
    lp = Path(a.edition)
    sib = siblings(lp)
    errors, warnings = validate(load(lp), load(Path(a.nomes)),
                                load(sib["signals"]) if sib["signals"] else None,
                                load(sib["analysis"]) if sib["analysis"] else None,
                                load(sib["kappa"]) if sib["kappa"] else None)
    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    print(f"{len(errors)} errors, {len(warnings)} warnings")
    sys.exit(1 if errors or (a.strict and warnings) else 0)


if __name__ == "__main__":
    main()
