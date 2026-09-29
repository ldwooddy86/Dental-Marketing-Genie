#!/usr/bin/env python3
"""HORUS builder: one coded edition -> one self-contained HTML dashboard.

Reads the ledger and its siblings (X.signals.json, X.analysis.json, X.kappa.json), recomputes every
metric with horus_metrics (numbers on the page are never typed by hand), validates the contract with
horus_validate, and injects one inert JSON payload into assets/dashboard_template.html.

Usage:
  python horus_build.py --edition assets/editions/X.json [--out horus.html]
                        [--previous W.json | --no-previous] [--fragment] [--system-fonts] [--force]
  --previous      the edition to measure momentum against (default: the latest earlier edition of the
                  same nome in the same folder, if one exists)
  --fragment      emit the page without doctype/head/body wrappers (for hosts that add their own skeleton)
  --system-fonts  drop the Google Fonts link so the page makes no network calls at all
  --force         build despite validation errors (drafts only; never publish a forced build)
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

import horus_metrics  # noqa: E402
import horus_validate  # noqa: E402

VERSION = "1.0.0"
MARKER = "<!--horus:head-end-->"


def inert_json(obj) -> str:
    """JSON that cannot close its <script> element or open markup: <, >, & and line separators escaped."""
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return (s.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
             .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


SIBLING_SUFFIXES = (".signals.json", ".analysis.json", ".kappa.json", ".second-coder.json")


def find_previous(ledger_path: Path, ledger: dict) -> Path | None:
    """The latest earlier edition of the same nome next to this one (ledger files only)."""
    best = None
    for p in ledger_path.parent.glob(f"{ledger.get('nome')}-*.json"):
        if p == ledger_path or p.name.endswith(SIBLING_SUFFIXES):
            continue
        try:
            other = horus_validate.load(p)
        except (ValueError, OSError):
            continue
        if other.get("nome") == ledger.get("nome") and str(other.get("run_date", "")) < str(ledger.get("run_date", "")):
            if best is None or str(other.get("run_date")) > best[0]:
                best = (str(other.get("run_date")), p)
    return best[1] if best else None


def payload(ledger_path: Path, nomes: dict, previous: Path | None = None) -> tuple[dict, list[str], list[str]]:
    ledger = horus_validate.load(ledger_path)
    sib = horus_validate.siblings(ledger_path)
    signals = horus_validate.load(sib["signals"]) if sib["signals"] else None
    analysis = horus_validate.load(sib["analysis"]) if sib["analysis"] else None
    kappa = horus_validate.load(sib["kappa"]) if sib["kappa"] else None
    errors, warnings = horus_validate.validate(ledger, nomes, signals, analysis, kappa)

    nome = next(n for n in nomes["nomes"] if n["id"] == ledger["nome"])
    prev = horus_validate.load(previous) if previous else None
    metrics = horus_metrics.compute(ledger, nomes, prev)
    try:
        rel = ledger_path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        rel = ledger_path.name
    data = {
        "meta": {
            "edition": ledger.get("edition"), "nome_id": ledger.get("nome"), "title": ledger.get("title"),
            "run_date": ledger.get("run_date"), "window": ledger.get("window", {}),
            "collection_mode": ledger.get("collection_mode", ""),
            "built_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "horus_version": VERSION, "ledger_file": rel,
        },
        "nome": {
            "id": nome["id"], "name": nome["name"], "nome": nome.get("nome"), "scope": nome.get("scope"),
            "clusters": nome.get("clusters", {}),
            "taxonomy": [{k: t[k] for k in ("id", "label", "short", "def") if k in t} for t in nome["taxonomy"]],
            "standing_questions": nome.get("standing_questions", []),
        },
        "codes": {"intent": nomes.get("intent_codes", {}), "stance": nomes.get("stance_codes", {}), "flags": nomes.get("flags", {})},
        "items": ledger.get("items", []),
        "rooms": ledger.get("rooms", []),
        "metrics": metrics,
        "signals": (signals or {}).get("signals", []),
        "events": (signals or {}).get("events", []),
        "watch": (signals or {}).get("watch_calendar", []),
        "analysis": analysis or {},
        "kappa": ({k: kappa[k] for k in ("topic", "cluster", "intent", "disagreements") if k in kappa} if kappa else None),
    }
    return data, errors, warnings


def render(data: dict, template: str, fragment: bool, system_fonts: bool) -> str:
    if MARKER not in template:
        raise SystemExit("template is missing the head marker " + MARKER)
    if system_fonts:
        template = "\n".join(line for line in template.splitlines() if "data-horus-webfont" not in line)
    title = html.escape(f"Horus {data['nome']['name']}", quote=False)
    template = template.replace("__HORUS_TITLE__", title).replace("__HORUS_DATA__", inert_json(data))
    head, body = template.split(MARKER, 1)
    if fragment:
        out = head.rstrip() + "\n" + body.lstrip()
    else:
        out = ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
               "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
               + head.rstrip() + "\n</head>\n<body>\n" + body.lstrip() + "</body>\n</html>\n")
    if "__HORUS_" in out:
        raise SystemExit("an unfilled template placeholder remains")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--edition", required=True)
    ap.add_argument("--nomes", default=str(ROOT / "assets" / "nomes.json"))
    ap.add_argument("--template", default=str(ROOT / "assets" / "dashboard_template.html"))
    ap.add_argument("--out")
    ap.add_argument("--fragment", action="store_true")
    ap.add_argument("--system-fonts", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--previous")
    ap.add_argument("--no-previous", action="store_true")
    a = ap.parse_args()

    lp = Path(a.edition)
    nomes = horus_validate.load(Path(a.nomes))
    prev = None if a.no_previous else (Path(a.previous) if a.previous else find_previous(lp, horus_validate.load(lp)))
    if prev:
        print(f"momentum measured against {prev.name}")
    data, errors, warnings = payload(lp, nomes, prev)
    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    if errors and not a.force:
        raise SystemExit(f"{len(errors)} validation errors; fix them or pass --force for a draft")
    out = render(data, Path(a.template).read_text(encoding="utf-8"), a.fragment, a.system_fonts)
    size = len(out.encode("utf-8"))
    if size > 16 * 1024 * 1024:
        raise SystemExit(f"page is {size / 1e6:.1f} MB, over the 16 MB limit; trim the ledger or split the edition")
    stem = lp.name[:-5] if lp.name.endswith(".json") else lp.stem
    dest = Path(a.out) if a.out else Path.cwd() / f"horus-{stem}.html"
    dest.write_text(out, encoding="utf-8")
    m = data["metrics"]["n"]
    print(f"built {dest} ({size / 1024:.0f} KB): {m['sun_total']} broadcast, {m['moon_total']} floor, "
          f"{m['rooms']} rooms, {len(data['signals'])} signals, {len((data['analysis'] or {}).get('key_judgments', []))} key judgments")


if __name__ == "__main__":
    main()
