#!/usr/bin/env python3
"""OMEGAWEAPON builder: one run manifest -> one self-contained HTML dashboard for one target domain.

Validates the contract (omega_validate), computes every number (omega_metrics), measures momentum against the latest
earlier run of the same target in the same cache folder, and injects one inert JSON payload plus the dashboard engine
(assets/omega_dashboard.js, the same file the OmegaWeapon app hosts in a frame) into assets/omega_template.html. The page makes no network call except the optional Google Fonts stylesheet.

Usage
  python3 scripts/omega_build.py --manifest omega_cache/<domain>/runs/<run>.json [--out omega-<domain>.html]
        [--previous <older run>.json | --no-previous] [--fragment] [--system-fonts] [--name-on-page] [--tokens "Operator,operator.com"] [--force]
  --fragment       emit the page without doctype/head/body wrappers (for artifact hosts that add their own skeleton)
  --system-fonts   drop the Google Fonts link so the page makes no network calls at all
  --name-on-page   put the OmegaWeapon run label in the masthead eyebrow (default: a neutral title; the page is the client's)
  --force          build despite validation errors (drafts only; never deliver a forced build)
Pure standard library.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import omega_metrics  # noqa: E402
import omega_validate  # noqa: E402

VERSION = "2.0.0"
MARKER = "<!--omega:head-end-->"


def inert_json(obj) -> str:
    """JSON that cannot close its <script> element or open markup."""
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return (s.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
             .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def load(p: Path):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def find_previous(manifest_path: Path, m: dict) -> Path | None:
    best = None
    for p in manifest_path.parent.glob("*.json"):
        if p == manifest_path:
            continue
        try:
            other = load(p)
        except (ValueError, OSError):
            continue
        if other.get("target", {}).get("domain") != m.get("target", {}).get("domain"):
            continue
        d_other, d_this = str(other.get("run", {}).get("run_date", "")), str(m.get("run", {}).get("run_date", ""))
        key = (d_other, str(other.get("run", {}).get("id", "")))
        this_key = (d_this, str(m.get("run", {}).get("id", "")))
        if key < this_key and (best is None or key > best[0]):
            best = (key, p)
    return best[1] if best else None


def payload(manifest_path: Path, previous: Path | None, tokens: list[str], name_on_page: bool):
    m = load(manifest_path)
    errors, warnings = omega_validate.validate(m, tokens)
    prev = load(previous) if previous else None
    metrics = omega_metrics.compute(m, prev)
    arch = omega_metrics.archetypes()
    arch_row = next((a for a in arch["archetypes"] if a["id"] == m["target"].get("archetype")), {})
    bt = omega_metrics.brand_topics()
    data = {
        "meta": {"title": m["target"].get("business_name") or m["target"]["domain"], "domain": m["target"]["domain"],
                 "run_id": m["run"].get("id"), "run_date": m["run"].get("run_date"), "tier": m["run"].get("tier"),
                 "doctrine_date": m.get("omega", {}).get("doctrine_date"), "built_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                 "version": VERSION, "archetype_label": arch_row.get("label", m["target"].get("archetype")), "name_on_page": bool(name_on_page),
                 "previous_run": prev.get("run", {}).get("id") if prev else None},
        "target": m["target"], "run": {**m["run"], "previous_run": prev.get("run", {}).get("id") if prev else m["run"].get("previous_run")},
        "sources": m.get("sources", []), "modules": m.get("modules", {}), "findings": m.get("findings", []), "exposure": m.get("exposure", []),
        "verify_queue": m.get("verify_queue", []), "tasks": m.get("tasks", []), "analysis": m.get("analysis", {}), "playbook": m.get("playbook", {}),
        "glossary": m.get("glossary", []), "metrics": metrics,
        "dict": {"pillars": arch["pillars"], "module_to_pillar": arch["module_to_pillar"], "brand_topics": [{"id": t["id"], "short": t["short"], "label": t["label"]} for t in bt["topics"]]},
    }
    return data, errors, warnings, m


def engine_js() -> str:
    """The dashboard engine (assets/omega_dashboard.js): one file shared by the standalone page and the OmegaWeapon app."""
    return (ROOT / "assets" / "omega_dashboard.js").read_text(encoding="utf-8")


def render(data: dict, template: str, fragment: bool, system_fonts: bool) -> str:
    if MARKER not in template:
        raise SystemExit("template is missing the head marker " + MARKER)
    if system_fonts:
        template = "\n".join(line for line in template.splitlines() if "data-omega-webfont" not in line)
    title = html.escape(f"{data['meta']['title']}: digital position, exposure and market read", quote=False)
    js = engine_js()
    if "</script" in js.lower():
        raise SystemExit("the dashboard engine contains a closing script tag and cannot be inlined")
    template = (template.replace("__OMEGA_TITLE__", title).replace("__OMEGA_DATA__", inert_json(data))
                .replace("__OMEGA_SCRIPT__", js))
    head, body = template.split(MARKER, 1)
    if fragment:
        out = head.rstrip() + "\n" + body.lstrip()
    else:
        out = ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
               "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
               "<meta name=\"robots\" content=\"noindex\">\n"
               + head.rstrip() + "\n</head>\n<body>\n" + body.lstrip() + "</body>\n</html>\n")
    if "__OMEGA_" in out:
        raise SystemExit("an unfilled template placeholder remains")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--template", default=str(ROOT / "assets" / "omega_template.html"))
    ap.add_argument("--out")
    ap.add_argument("--previous")
    ap.add_argument("--no-previous", action="store_true")
    ap.add_argument("--fragment", action="store_true")
    ap.add_argument("--system-fonts", action="store_true")
    ap.add_argument("--name-on-page", action="store_true")
    ap.add_argument("--tokens", default="")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    mp = Path(a.manifest)
    m0 = load(mp)
    prev = None if a.no_previous else (Path(a.previous) if a.previous else find_previous(mp, m0))
    if prev:
        print(f"momentum measured against {prev.name}")
    tokens = [t for t in a.tokens.split(",") if t.strip()] if a.tokens else []
    data, errors, warnings, m = payload(mp, prev, tokens, a.name_on_page)
    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    if errors and not a.force:
        raise SystemExit(f"{len(errors)} validation errors; fix them or pass --force for a draft")
    out = render(data, Path(a.template).read_text(encoding="utf-8"), a.fragment, a.system_fonts)
    size = len(out.encode("utf-8"))
    if size > 16 * 1024 * 1024:
        raise SystemExit(f"page is {size / 1e6:.1f} MB, over the 16 MB limit; trim the manifest")
    dest = Path(a.out) if a.out else Path.cwd() / f"omega-{m['target']['domain']}.html"
    dest.write_text(out, encoding="utf-8")
    sc = data["metrics"]["scorecard"]
    graded = ", ".join(f"{k} {v.get('grade')}" for k, v in sc.items() if v and v.get("grade") not in (None, "NA"))
    print(f"built {dest} ({size / 1024:.0f} KB): overall {data['metrics']['overall']['grade']}; {graded}")
    print(data["metrics"]["honest_count"]["sentence"])


if __name__ == "__main__":
    main()
