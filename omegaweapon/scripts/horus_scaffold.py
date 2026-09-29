#!/usr/bin/env python3
"""HORUS scaffold: open a new edition for any nome.

Writes three skeleton files next to each other, each with every key the validator and the dashboard
expect, so a run starts from the contract instead of from memory:
  <dir>/<nome>-<YYYY-MM>.json            ledger: meta, empty items and rooms
  <dir>/<nome>-<YYYY-MM>.signals.json    Nilometer: empty signals, events, watch calendar
  <dir>/<nome>-<YYYY-MM>.analysis.json   analysis of record: every section, empty, plus channel stubs
Refuses to overwrite an existing edition (pass --suffix b for a second edition in the same month).

Usage:
  python horus_scaffold.py --nome music [--run-date 2026-10-02] [--suffix a] [--dir assets/editions]
Pure standard library.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CHANNEL_STUBS = [
    ("Reddit", "Moon", "reddit (official Data API, read-only script app)", {"platform": ["Reddit"]}),
    ("Telegram", "Moon", "telegram_user (Telethon) and telegram_bot", {"platform": ["Telegram"]}),
    ("Discord", "Moon", "discord_bot (servers that invite the bot)", {"platform": ["Discord"]}),
    ("Forums", "Moon", "rss (forum listing feeds)", {"lane": ["forum"]}),
    ("Trade press", "Sun", "rss", {"lane": ["trade-press"]}),
    ("Newsletters and curated press", "Sun", "rss", {"lane": ["curated-press", "newsletter"]}),
    ("Platform voices", "Sun", "rss or csv_import", {"lane": ["platform-voice"]}),
    ("YouTube", "Sun and Moon", "youtube (Data API v3)", {"platform": ["YouTube"]}),
    ("LinkedIn", "Sun and Moon", "csv_import (native export or listening tool)", {"platform": ["LinkedIn"]}),
    ("X", "Sun and Moon", "csv_import (X API is paid; lane disabled by default)", {"platform": ["X"]}),
    ("Instagram, Facebook, Threads", "Sun", "csv_import", {"platform": ["Instagram", "Facebook", "Threads"]}),
    ("TikTok", "Sun", "csv_import (Research API is academic-only)", {"platform": ["TikTok"]}),
    ("Bluesky, Mastodon, Hacker News", "Moon", "bluesky, mastodon, hackernews", {"platform": ["Bluesky", "Mastodon", "Hacker News"]}),
    ("Podcasts", "Sun", "podcast (RSS)", {"lane": ["podcast"]}),
    ("Slack communities and WhatsApp", "Moon", "none (member exports only)", {"platform": ["Slack", "WhatsApp"]}),
]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--nome", required=True)
    ap.add_argument("--run-date", default=dt.date.today().isoformat())
    ap.add_argument("--suffix", default="a")
    ap.add_argument("--dir", default=str(ROOT / "assets" / "editions"))
    ap.add_argument("--nomes", default=str(ROOT / "assets" / "nomes.json"))
    a = ap.parse_args()
    nomes = json.loads(Path(a.nomes).read_text(encoding="utf-8"))
    nome = next((n for n in nomes["nomes"] if n["id"] == a.nome), None)
    if not nome:
        raise SystemExit(f"unknown nome '{a.nome}'. Known: {', '.join(n['id'] for n in nomes['nomes'])}")
    run = dt.date.fromisoformat(a.run_date)
    stem = f"{a.nome}-{run:%Y-%m}" + ("" if a.suffix == "a" else a.suffix)
    d = Path(a.dir)
    d.mkdir(parents=True, exist_ok=True)
    paths = {k: d / f"{stem}{s}" for k, s in (("ledger", ".json"), ("signals", ".signals.json"), ("analysis", ".analysis.json"))}
    clash = [str(p) for p in paths.values() if p.exists()]
    if clash:
        raise SystemExit("refusing to overwrite: " + ", ".join(clash))

    ledger = {
        "edition": f"{run:%Y.%m}{a.suffix}", "nome": nome["id"], "title": nome["name"], "run_date": run.isoformat(),
        "window": {"sun": "YYYY-MM-DD to YYYY-MM-DD", "moon_floor": "describe the floor frame", "rooms": f"census snapshot {run:%d %b %Y}"},
        "collection_mode": "first-light (web sweep, no collector credentials)",
        "items": [], "rooms": [],
    }
    signals = {"_about": f"Nilometer readings for {nome['name']} edition {ledger['edition']}. Admiralty grades: source A-F, information 1-6. "
                         "Forecasts are graded as the fact of a forecast, not its accuracy.",
               "signals": [], "events": [], "watch_calendar": []}
    analysis = {
        "_about": f"Horus analysis of record for {nome['name']}, edition {ledger['edition']}. Probability language follows ICD 203; "
                  "confidence (low, moderate, high) grades the evidence base separately from likelihood.",
        "headline": "", "bluf": [], "key_judgments": [], "discourse_findings": [], "stages": {},
        "momentum_direction": {"_note": "Directional judgment from the Nilometer until two collector runs allow measured momentum."},
        "ach": {"hypotheses": [], "evidence": [], "conclusion": ""},
        "scenarios": {"axes": {"x": {"label": "", "low": "", "high": ""}, "y": {"label": "", "low": "", "high": ""}}, "items": [],
                      "note": "Probabilities are the analyst's judgment, not model output, and sum to 100."},
        "indicators": [], "graveyard": [], "graveyard_test": "", "unknowns": [], "implications": [],
        "channels": [{"channel": c, "eye": e, "status": "not sampled", "collector": col, "grade": "-", "match": m, "dossier": [], "signals": []}
                     for c, e, col, m in CHANNEL_STUBS],
        "limitations": [],
    }
    for k, obj in (("ledger", ledger), ("signals", signals), ("analysis", analysis)):
        paths[k].write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{k:9} {paths[k]}")
    print(f"Nome {nome['name']} ({nome.get('nome', '')}): {len(nome['taxonomy'])} topics. Standing questions:")
    for q in nome.get("standing_questions", []):
        print("  -", q)


if __name__ == "__main__":
    main()
