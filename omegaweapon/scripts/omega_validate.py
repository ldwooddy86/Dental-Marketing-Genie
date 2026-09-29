#!/usr/bin/env python3
"""OMEGAWEAPON validator: the manifest contract. The builder refuses to build on errors.

Errors are the Articles enforced in code: every finding links to the page it is about and names its evidence class;
every exposure row carries a disposition, and a CONFIRMED row carries a fetched or vintage-flagged cite, a quoted
evidence sentence, a URL, a route and no open control; every key judgment uses ICD 203 terms with the matching range,
a confidence word, a horizon, evidence and a falsifier; no vendor authority score, guarantee, em dash or operator token
appears in any client-facing string. Warnings are things to fix or to state in the limitations.

Usage
  python3 scripts/omega_validate.py --manifest omega_cache/<domain>/runs/<run>.json [--tokens "Acme Agency,acme.com"] [--strict]
Exit 1 on errors (or on warnings with --strict). Pure standard library.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

MODULES = ["crawl", "technical", "content", "local", "links", "competitors", "paid", "social", "ai", "apps", "exposure", "agency", "market", "copy"]
STATUSES = {"run", "partial", "not_run", "not_assessed", "blocked"}
SEVERITIES = {"High", "Medium", "Low", "Info", "Win"}
EVIDENCE = {"observed", "inferred", "unverified"}
DISPOSITIONS = {"CONFIRMED", "CANDIDATE", "CLEARED"}
CONFIDENCES = {"Confirmed", "Plausible", "Weak"}
XSEV = {"High", "Medium", "Low"}
ROUTES = {"PLATFORM", "STORE", "FTC", "CFPB", "STATE AG", "LICENSING BOARD", "STATE BAR", "FEDERAL SECTOR", "STATE SECTOR", "NAD", "CARD NETWORK", "INFRA", "PRIVATE", "NONE"}
TASK_COLS = ["Name", "Description", "Section/Column", "Priority", "Tags"]
URL_RE = re.compile(r"^https?://\S+$")
ICD = {"almost no chance": (1, 5), "very unlikely": (5, 20), "unlikely": (20, 45), "roughly even chance": (45, 55), "likely": (55, 80), "very likely": (80, 95), "almost certain": (95, 99)}
ICD_BY_LEN = sorted(ICD, key=len, reverse=True)
CONF_TERMS = {"low", "low to moderate", "moderate", "moderate to high", "high"}
CLIENT_FACING = ["findings", "exposure", "analysis", "playbook", "glossary", "verify_queue", "tasks"]


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def walk_strings(obj, path="$"):
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, f"{path}[{i}]")


def icd_terms(likelihood: str):
    parts = [x.strip() for x in str(likelihood or "").split(";") if x.strip()]
    out = []
    for p in parts:
        low = p.lower()
        out.append(next((t for t in ICD_BY_LEN if low.startswith(t)), None))
    return out


def range_matches(term: str, rng: str) -> bool:
    nums = re.findall(r"\d+", rng or "")
    if len(nums) < 2 or term not in ICD:
        return False
    lo, hi = int(nums[0]), int(nums[1])
    return (lo, hi) == ICD[term]


def validate(m: dict, tokens: list[str] | None = None, grading: dict | None = None) -> tuple[list[str], list[str]]:
    E, W = [], []
    err, warn = E.append, W.append
    for k in ("omega", "target", "run", "sources", "modules", "findings", "exposure", "verify_queue", "tasks", "analysis", "playbook", "glossary"):
        if k not in m:
            err(f"missing top-level key {k}")
    if E:
        return E, W
    t, r = m["target"], m["run"]
    if not re.match(r"^[a-z0-9.-]+\.[a-z]{2,}$", str(t.get("domain", ""))):
        err(f"target.domain invalid: {t.get('domain')!r}")
    if not r.get("id"):
        err("run.id missing")
    if r.get("presence", {}).get("mode") not in ("honest", "legacy-persona"):
        err("run.presence.mode must be 'honest' or 'legacy-persona'")
    if not r.get("presence", {}).get("line"):
        warn("run.presence.line is empty: paste the DECLARED presence line from the fetcher selftest")
    if not r.get("judgment_calls"):
        warn("run.judgment_calls is empty: every run states its judgment calls at the top")
    if any("DEMO FIXTURE" in str(x) for x in r.get("judgment_calls", [])):
        warn("DEMO FIXTURE manifest: never ship this dashboard")
    if t.get("posture") not in ("competitor", "self-audit"):
        err("target.posture must be competitor or self-audit")

    # sources
    sids = [s.get("id") for s in m["sources"]]
    dup = [k for k, v in Counter(sids).items() if v > 1]
    if dup:
        err(f"duplicate source ids: {dup}")
    for s in m["sources"]:
        for k in ("id", "label", "kind", "date"):
            if not s.get(k):
                err(f"source {s.get('id')} missing {k}")
    sidset = set(sids)

    # modules
    for mid in MODULES:
        mod = m["modules"].get(mid)
        if mod is None:
            err(f"modules.{mid} missing")
            continue
        if mod.get("status") not in STATUSES:
            err(f"modules.{mid}.status {mod.get('status')!r} not in {sorted(STATUSES)}")
        if mid in r.get("modules_planned", []) and mod.get("status") in ("not_run",):
            warn(f"modules.{mid} was planned but did not run; set status not_assessed or blocked and say why")
        if mod.get("status") in ("not_assessed", "blocked", "partial") and not mod.get("why"):
            warn(f"modules.{mid} is {mod.get('status')} with no why")
        for sid in mod.get("sources", []):
            if sid not in sidset:
                err(f"modules.{mid} cites unknown source {sid}")

    # findings
    fids = [f.get("id") for f in m["findings"]]
    dup = [k for k, v in Counter(fids).items() if v > 1]
    if dup:
        err(f"duplicate finding ids: {dup}")
    for f in m["findings"]:
        fid = f.get("id", "?")
        if f.get("module") not in MODULES:
            err(f"finding {fid}: module {f.get('module')!r} unknown")
        if f.get("severity") not in SEVERITIES:
            err(f"finding {fid}: severity {f.get('severity')!r} not in {sorted(SEVERITIES)}")
        if f.get("evidence_class") not in EVIDENCE:
            err(f"finding {fid}: evidence_class {f.get('evidence_class')!r} not in {sorted(EVIDENCE)}")
        if not f.get("title"):
            err(f"finding {fid}: title missing")
        if not (isinstance(f.get("url"), str) and URL_RE.match(f["url"])):
            err(f"finding {fid}: url must be an http(s) link to the affected page, listing, ad or app")
        if not f.get("evidence"):
            err(f"finding {fid}: evidence sentence missing")
        if f.get("severity") != "Win" and not f.get("fix"):
            err(f"finding {fid}: fix missing")
        if f.get("source") and f["source"] not in sidset:
            err(f"finding {fid}: source {f['source']} not in sources")
        if not f.get("source"):
            warn(f"finding {fid}: no source id; every metric traces to a named source with a date")
        if f.get("severity") == "High" and f.get("evidence_class") == "unverified":
            warn(f"finding {fid}: High severity on unverified evidence; it will not move the grade. Verify it or lower it")
        if f.get("owner") and f["owner"] not in ("Agency", "Client", "Both"):
            warn(f"finding {fid}: owner {f['owner']!r} (expected Agency, Client or Both)")

    # exposure
    xids = [x.get("id") for x in m["exposure"]]
    dup = [k for k, v in Counter(xids).items() if v > 1]
    if dup:
        err(f"duplicate exposure ids: {dup}")
    for x in m["exposure"]:
        xid = x.get("id", "?")
        d = x.get("disposition")
        if d not in DISPOSITIONS:
            err(f"exposure {xid}: disposition {d!r} not in {sorted(DISPOSITIONS)}")
        if x.get("confidence") not in CONFIDENCES:
            err(f"exposure {xid}: confidence {x.get('confidence')!r} not in {sorted(CONFIDENCES)}")
        if x.get("severity") not in XSEV:
            err(f"exposure {xid}: severity {x.get('severity')!r} not in {sorted(XSEV)}")
        for k in ("rule", "evidence", "battery", "test"):
            if not x.get(k):
                err(f"exposure {xid}: {k} missing")
        if not (isinstance(x.get("url"), str) and URL_RE.match(x["url"])):
            err(f"exposure {xid}: url must be an http(s) link")
        if x.get("route") not in ROUTES:
            err(f"exposure {xid}: route {x.get('route')!r} not in the routing table")
        if d == "CONFIRMED":
            if x.get("confidence") == "Weak":
                err(f"exposure {xid}: CONFIRMED never rests on Weak evidence")
            if not x.get("cite"):
                err(f"exposure {xid}: CONFIRMED needs a cite")
            if not (x.get("cite_fetched") or x.get("cite_vintage")):
                err(f"exposure {xid}: CONFIRMED needs cite_fetched (date) or a cite_vintage flag")
            if not x.get("cite_fetched"):
                warn(f"exposure {xid}: CONFIRMED on a vintage-flagged cite; fetch the live clause before filing")
            if x.get("control"):
                err(f"exposure {xid}: CONFIRMED cannot carry an open control ({x['control']}); it is CLEARED or CANDIDATE")
            if x.get("route") in ("PLATFORM", "STORE") and not x.get("channel"):
                err(f"exposure {xid}: PLATFORM and STORE routes need the exact report channel")
            if not x.get("base_rate"):
                warn(f"exposure {xid}: CONFIRMED with no enforcement base-rate prior recorded")
        if d == "CANDIDATE" and not x.get("open_question"):
            err(f"exposure {xid}: CANDIDATE needs the open question and what would settle it")
        if d == "CLEARED" and not x.get("control"):
            err(f"exposure {xid}: CLEARED needs the control that cleared it")

    # analysis
    an = m["analysis"]
    if not an.get("headline"):
        warn("analysis.headline empty (fine for a Tier 0 draft; required before delivery)")
    kjids = [k.get("id") for k in an.get("key_judgments", [])]
    dup = [k for k, v in Counter(kjids).items() if v > 1]
    if dup:
        err(f"duplicate key judgment ids: {dup}")
    for kj in an.get("key_judgments", []):
        kid = kj.get("id", "?")
        for k in ("title", "judgment", "likelihood", "range", "confidence", "horizon"):
            if not kj.get(k):
                err(f"{kid}: {k} missing")
        terms = icd_terms(kj.get("likelihood", ""))
        if not terms or any(t is None for t in terms):
            err(f"{kid}: likelihood must use ICD 203 terms ({', '.join(ICD)}); got {kj.get('likelihood')!r}")
        else:
            ranges = [x.strip() for x in str(kj.get("range", "")).split("/")]
            if len(ranges) != len(terms):
                err(f"{kid}: range must carry one range per likelihood term, joined by /")
            else:
                for tm, rg in zip(terms, ranges):
                    if not range_matches(tm, rg):
                        err(f"{kid}: range {rg!r} does not match ICD 203 range for {tm!r} ({ICD[tm][0]} to {ICD[tm][1]}%)")
        if str(kj.get("confidence", "")).lower() not in CONF_TERMS:
            err(f"{kid}: confidence must be one of {sorted(CONF_TERMS)}")
        if not kj.get("evidence"):
            err(f"{kid}: evidence refs missing (finding ids, N.. signals, metrics:..)")
        if not kj.get("falsifiers"):
            err(f"{kid}: at least one falsifier is required")
        ev = [str(e) for e in kj.get("evidence", [])]
        if not any(e.startswith("N") or e.startswith("metrics:") for e in ev):
            warn(f"{kid}: no hard signal (N..) or metric ref in evidence; discourse alone is weaker")
    sc = an.get("scenarios") or {}
    if sc.get("quadrants"):
        tot = sum(q.get("probability", 0) for q in sc["quadrants"])
        if tot != 100:
            warn(f"scenario probabilities sum to {tot}, not 100")
    for k in ("win_watch_next", "one_rival", "one_paid_opportunity", "one_exposure"):
        if not an.get(k):
            warn(f"analysis.{k} empty")
    pg = an.get("pillar_grades") or {}
    for p, o in pg.items():
        if p == "Compliance & Exposure":
            err("analysis.pillar_grades may not override Compliance & Exposure (dispositions decide it)")
        if not isinstance(o, dict) or not o.get("why"):
            err(f"analysis.pillar_grades[{p}] needs a why")

    # brand items
    br = m["modules"].get("market", {}).get("brand", {})
    try:
        bt = load(ROOT / "assets" / "brand_topics.json")
        topic_ids = {tp["id"] for tp in bt["topics"]}
    except Exception:
        topic_ids = set()
    for it in br.get("items", []):
        if it.get("eye") not in ("sun", "moon"):
            err(f"brand item {it.get('id')}: eye must be sun or moon")
        if topic_ids and it.get("topic") not in topic_ids:
            err(f"brand item {it.get('id')}: topic {it.get('topic')!r} not in brand_topics.json")
        if it.get("intent") not in set("QCRHNDPJO"):
            err(f"brand item {it.get('id')}: intent {it.get('intent')!r} not a Horus intent code")
        if it.get("stance") not in (-1, 0, 1):
            err(f"brand item {it.get('id')}: stance must be -1, 0 or 1")
        if it.get("author") or it.get("reviewer"):
            err(f"brand item {it.get('id')}: private names are never recorded (author/reviewer field present)")

    # tasks, verify queue
    for i, tk in enumerate(m["tasks"]):
        if list(tk.keys()) != TASK_COLS:
            err(f"tasks[{i}]: keys must be exactly {TASK_COLS} in order")
        if tk.get("Priority") not in ("High", "Medium", "Low"):
            err(f"tasks[{i}]: Priority must be High, Medium or Low")
    for v in m["verify_queue"]:
        if not (isinstance(v.get("url"), str) and URL_RE.match(v["url"])):
            err(f"verify item {v.get('id')}: url required (the exact place to check)")

    # client-facing strings: forbidden terms, dashes, operator tokens
    G = grading or load(ROOT / "assets" / "grading.json")
    forb = G.get("forbidden_terms", {})
    auth = [re.compile(p, re.I) for p in forb.get("authority_scores", [])]
    guar = [re.compile(re.escape(p), re.I) for p in forb.get("guarantees", [])]
    toks = [tk.strip() for tk in (tokens or []) if tk.strip()]
    for sect in CLIENT_FACING:
        for path, s in walk_strings(m.get(sect), f"${sect}"):
            if "\u2014" in s or "\u2013" in s:
                err(f"{path}: em or en dash in client-facing text (house style: none)")
            for rx in auth:
                if rx.search(s):
                    err(f"{path}: vendor authority score language ({rx.pattern}); authority is referring domains, link quality, footprint and tenure")
            for rx in guar:
                if rx.search(s):
                    err(f"{path}: guarantee language ({rx.pattern}); outcomes are never guaranteed")
            for tk in toks:
                if tk.lower() in s.lower():
                    err(f"{path}: operator token {tk!r} in client-facing text; deliverables are neutral")
            if re.search(r"\b(is guilty of|broke the law|committed fraud)\b", s, re.I):
                err(f"{path}: accusatory verb; use verbs about the artifact (displays, resolves to, fires)")
    return E, W


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--tokens", default="", help="comma-separated operator names, aliases and domains that must not appear")
    ap.add_argument("--strict", action="store_true")
    a = ap.parse_args()
    m = load(a.manifest)
    E, W = validate(m, a.tokens.split(",") if a.tokens else [])
    for w in W:
        print("WARN ", w)
    for e in E:
        print("ERROR", e)
    print(f"{len(E)} errors, {len(W)} warnings")
    sys.exit(1 if E or (a.strict and W) else 0)


if __name__ == "__main__":
    main()
