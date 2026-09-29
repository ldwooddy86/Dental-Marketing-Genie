#!/usr/bin/env python3
"""OMEGAWEAPON platform: the app that hosts every run, the Radar registry behind the agency lens, and the loop between them.

One app (a Chrome extension and a standalone HTML page built from the same sources in assets/app) carries three wings:
the Agency Radar (the tracked digital marketing companies with their Horus reads), the Horus edition, and the Targets
wing (every OmegaWeapon dashboard, hosted whole inside the app, linked to the agency of record's Radar dossier). The
skill produces the app; the app queues the next targets for the skill. Every number on either side is computed.

Commands
  resolve    --manifest <run.json> [--write]            attach the Radar dossier of the agency of record to a run manifest
  pack       (--manifest <run.json> ... | --cache <dir> --latest) [--out omega-pack.json] [--tokens ...] [--write-manifests]
             build the payload of every run (validated, momentum measured) plus its target summary, for the app to host
  build-app  [--pack omega-pack.json ...] [--out dist] [--version 2.0.0] [--no-zip]
             assemble dist/omegaweapon-chrome (the extension), dist/omegaweapon-chrome.zip and dist/omegaweapon.html
  queue      --file omega-queue.json [--run] [--ua ...] [--budget 60] [--tokens ...]
             turn the queue exported from the app into omega_run.py commands (printed, or executed one after another)
  radar-csv  [--pack omega-pack.json] [--out agency_radar_horus.csv]      export the Radar with its Horus and Omega columns
  radar-upsert --file agency.json [--recompute-all]                       add or update one tracked agency, recompute its read
  radar-agg  [--check]                                                    recompute the Radar aggregates (check: compare)
Pure standard library. Never fetches; never runs a connector.
"""
from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import io
import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import omega_build  # noqa: E402
import radar_horus  # noqa: E402
import radar_offshore  # noqa: E402

APP_SRC = ROOT / "assets" / "app"
RADAR_PATH = ROOT / "assets" / "radar" / "radar.json"
TEMPLATE = ROOT / "assets" / "omega_template.html"
ENGINE = ROOT / "assets" / "omega_dashboard.js"
PACK_VERSION = 2
APP_VERSION = "2.0.0"
PY = sys.executable


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def inert(obj) -> str:
    return omega_build.inert_json(obj)


def load(p) -> dict:
    return json.loads(Path(p).read_text(encoding="utf-8"))


def norm_host(h: str) -> str:
    h = (h or "").strip().lower()
    h = re.sub(r"^https?://", "", h).split("/")[0]
    return h[4:] if h.startswith("www.") else h


def norm_name(n: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (n or "").lower()).strip()


# ------------------------------------------------------------------------------------------------------------ registry
def radar() -> dict:
    return load(RADAR_PATH)


def radar_match(rad: dict, domain: str | None, name: str | None = None) -> dict | None:
    """The tracked agency for a domain (exact host or a subdomain of it), else an exact normalised name match."""
    host = norm_host(domain or "")
    best = None
    if host:
        for a in rad["agencies"]:
            d = norm_host(a.get("domain") or "")
            if d and (host == d or host.endswith("." + d)):
                if best is None or len(d) > len(best.get("domain") or ""):
                    best = a
    if best is None and name:
        n = norm_name(re.sub(r"\(.*?\)", "", name))
        for a in rad["agencies"]:
            if norm_name(a.get("name")) == n:
                best = a
                break
    return best


def radar_block(a: dict, rad: dict) -> dict:
    """The compact, observed block a run manifest carries about its agency of record."""
    hz = a.get("horus") or {}
    ed = rad["horus"]["edition"]
    scen = {s["id"]: s["name"] for s in ed["scenarios"]["items"]}
    label = dict(rad["meta"]["strat_dims"])
    house = [{"cap": label.get(t["cap"], t["cap"]) if t["cap"] not in ("linkedin", "content") else {"linkedin": "LinkedIn advertising", "content": "Publishing cadence"}[t["cap"]],
              "result": t["do"], "note": t["note"]} for t in (hz.get("house") or {}).get("tests", [])]
    b = {
        "id": a["id"], "name": a["name"], "domain": a.get("domain"), "region": a.get("region"),
        "hq": ", ".join(x for x in [a.get("hq_city"), a.get("hq_country")] if x) or None,
        "archetype": a.get("archetype"), "segment": a.get("segment"), "ownership": a.get("ownership") if a.get("ownership") not in (None, "unknown") else None,
        "owner": a.get("owner"), "status": a.get("status"), "leads": [label.get(k, k) for k in (a.get("lead") or [])],
        "gaps": [g.get("label") for g in (a.get("gaps") or []) if g.get("label")], "house": house,
        "compiled": rad["meta"].get("generated"), "edition": ed.get("edition"), "ok": bool(hz.get("ok")),
    }
    mo = a.get("offshore") or {}
    if mo.get("ok"):
        b["offshore"] = {"index": mo.get("index"), "band": mo.get("band"), "asia": mo.get("asia"), "migration": mo.get("migration"), "displacement": mo.get("displacement"),
                         "evidence_class": mo.get("evidence_class"), "verdict": mo.get("verdict")}
    if hz.get("ok"):
        b.update({"band": hz.get("band"), "hti": hz.get("hti"), "arc_clock": hz.get("arc_clock"), "arc_word": hz.get("arc_word"),
                  "best_fit": (hz.get("scen_best") or "") + " " + scen.get(hz.get("scen_best"), ""),
                  "saydo": (str(hz["house"]["corroborated"]) + "/" + str(hz["house"]["tested"])) if (hz.get("house") or {}).get("tested") else None,
                  "verdict": hz.get("verdict")})
    else:
        b["verdict"] = hz.get("reason") or "Tracked in the Radar with no Horus read."
    return b


def resolve(m: dict, rad: dict | None = None) -> dict | None:
    """Attach the Radar block to modules.agency.of_record (and target.radar_id when the target itself is tracked)."""
    rad = rad or radar()
    ag = m.setdefault("modules", {}).setdefault("agency", {})
    of = ag.get("of_record") or {}
    hit = radar_match(rad, of.get("domain"), of.get("name")) if (of.get("domain") or of.get("name")) else None
    if hit:
        of["radar"] = radar_block(hit, rad)
        ag["of_record"] = of
        ag.setdefault("notes", [])
        note = "Agency of record matched to the Agency Radar (" + hit["name"] + "); its Radar dossier and Horus read are attached as observed context."
        if note not in ag["notes"]:
            ag["notes"].append(note)
    elif "radar" in of:
        del of["radar"]
    self_hit = radar_match(rad, m.get("target", {}).get("domain"))
    if self_hit:
        m["target"]["radar_id"] = self_hit["id"]
    elif "radar_id" in m.get("target", {}):
        del m["target"]["radar_id"]
    return hit


# ------------------------------------------------------------------------------------------------------------ pack
def summarize(payload: dict, rad: dict) -> dict:
    """The row the app's Targets wing lists; every value comes from the built payload."""
    T, R, M, AN = payload["target"], payload["run"], payload["metrics"], payload.get("analysis") or {}
    of = ((payload.get("modules") or {}).get("agency") or {}).get("of_record") or {}
    sc = {k: (v or {}).get("grade") for k, v in (M.get("scorecard") or {}).items()}
    hc = M.get("honest_count") or {}
    fd = M.get("findings") or {}
    cov = M.get("coverage") or {}
    mom = M.get("momentum")
    return {
        "key": T["domain"], "domain": T["domain"], "homepage": T.get("homepage"), "business": T.get("business_name") or T["domain"],
        "recipient": T.get("recipient"), "archetype": T.get("archetype"), "archetype_label": payload["meta"].get("archetype_label"),
        "vertical": T.get("vertical"), "geography": (T.get("geography") or {}).get("label"), "posture": T.get("posture"),
        "question": T.get("question"), "run_id": R.get("id"), "run_date": R.get("run_date"), "tier": R.get("tier"),
        "previous_run": payload["meta"].get("previous_run"), "presence": (R.get("presence") or {}).get("mode"),
        "overall": (M.get("overall") or {}).get("grade"), "pillars_graded": (M.get("overall") or {}).get("pillars_graded"),
        "pillars_total": (M.get("overall") or {}).get("pillars_total"), "scorecard": sc,
        "failing": [k for k, g in sc.items() if g in ("D", "F")],
        "honest": {"n": hc.get("n", 0), "confirmed": hc.get("confirmed", 0), "candidate": hc.get("candidate", 0), "cleared": hc.get("cleared", 0), "routable": hc.get("routable", 0), "sentence": hc.get("sentence")},
        "findings": {"n": fd.get("n", 0), "by_severity": fd.get("by_severity") or {}},
        "coverage": {"run": cov.get("run"), "partial": cov.get("partial"), "not": cov.get("not"), "blocked": len(cov.get("blocked") or []),
                     "modules": [{"module": r["module"], "status": r["status"]} for r in cov.get("modules") or []]},
        "agency": {"name": of.get("name"), "domain": of.get("domain"), "confidence": of.get("confidence"), "radar_id": (of.get("radar") or {}).get("id"),
                   "radar_band": (of.get("radar") or {}).get("band"), "radar_hti": (of.get("radar") or {}).get("hti"),
                   "inherited_share": ((M.get("scorecard") or {}).get("Agency Fit") or {}).get("inherited_share")},
        "radar_id": T.get("radar_id"), "headline": AN.get("headline"), "one_exposure": AN.get("one_exposure"),
        "momentum": mom if isinstance(mom, dict) else None, "judgment_calls": len(R.get("judgment_calls") or []),
        "demo": any("DEMO FIXTURE" in str(x) for x in (R.get("judgment_calls") or [])),
        "tasks": len(payload.get("tasks") or []), "verify": len(payload.get("verify_queue") or []),
        "built_at": payload["meta"].get("built_at"), "doctrine_date": payload["meta"].get("doctrine_date"),
    }


def latest_runs(cache: Path) -> list[Path]:
    out = []
    for d in sorted(cache.iterdir()):
        runs = d / "runs"
        if not runs.is_dir():
            continue
        best = None
        for p in runs.glob("*.json"):
            try:
                m = load(p)
            except (ValueError, OSError):
                continue
            key = (str(m.get("run", {}).get("run_date", "")), str(m.get("run", {}).get("id", "")))
            if best is None or key > best[0]:
                best = (key, p)
        if best:
            out.append(best[1])
    return out


def pack(manifests: list[Path], tokens: list[str], write_manifests: bool, force: bool) -> dict:
    rad = radar()
    targets = []
    for mp in manifests:
        m = load(mp)
        hit = resolve(m, rad)
        if write_manifests:
            mp.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")
        # payload() reads the file; write the resolved manifest to a sibling temp when not persisting
        src = mp
        if not write_manifests:
            src = mp.with_suffix(".resolved.tmp.json")
            src.write_text(json.dumps(m, ensure_ascii=False), encoding="utf-8")
        try:
            prev = omega_build.find_previous(mp, m)
            data, errors, warnings, _ = omega_build.payload(src, prev, tokens, False)
        finally:
            if src != mp and src.exists():
                src.unlink()
        for w in warnings:
            print("WARN ", mp.name, w)
        if errors and not force:
            for e in errors:
                print("ERROR", mp.name, e)
            print(f"skipped {mp} ({len(errors)} validation errors; --force packs a draft that is never shipped)")
            continue
        s = summarize(data, rad)
        s["radar_match"] = hit["name"] if hit else None
        targets.append({"summary": s, "payload": data})
        print(f"packed {s['domain']}: run {s['run_id']}, overall {s['overall']}, agency of record {s['agency']['name'] or 'none'}"
              + (f" (Radar: {hit['name']})" if hit else ""))
    return {"omega_pack": PACK_VERSION, "generated": now_iso(), "doctrine_date": max((t["summary"].get("doctrine_date") or "" for t in targets), default=None),
            "radar_compiled": rad["meta"].get("generated"), "edition": rad["horus"]["edition"].get("edition"), "n": len(targets), "targets": targets}


def merge_packs(paths: list[Path]) -> dict:
    """Several packs into one; the newest run per domain wins."""
    best: dict[str, dict] = {}
    meta = None
    for p in paths:
        pk = load(p)
        meta = meta or pk
        for t in pk.get("targets") or []:
            s = t["summary"]
            key = (str(s.get("run_date") or ""), str(s.get("run_id") or ""))
            cur = best.get(s["key"])
            if cur is None or key > (str(cur["summary"].get("run_date") or ""), str(cur["summary"].get("run_id") or "")):
                best[s["key"]] = t
    targets = sorted(best.values(), key=lambda t: (t["summary"].get("run_date") or "", t["summary"]["key"]), reverse=True)
    return {"omega_pack": PACK_VERSION, "generated": now_iso(), "doctrine_date": (meta or {}).get("doctrine_date"),
            "radar_compiled": (meta or {}).get("radar_compiled"), "edition": (meta or {}).get("edition"), "n": len(targets), "targets": targets}


# ------------------------------------------------------------------------------------------------------------ index
def radar_index(rad: dict) -> list[dict]:
    scen = {s["id"]: s["name"] for s in rad["horus"]["edition"]["scenarios"]["items"]}
    out = []
    for a in rad["agencies"]:
        hz = a.get("horus") or {}
        row = {"id": a["id"], "name": a["name"], "domain": a.get("domain"), "region": a.get("region"), "archetype": a.get("archetype"),
               "status": a.get("status"), "prominence": a.get("prominence"), "ok": bool(hz.get("ok"))}
        mo = a.get("offshore") or {}
        if mo.get("ok"):
            row.update({"mon": mo.get("index"), "mband": mo.get("band"), "asia": mo.get("asia")})
        if hz.get("ok"):
            h = hz.get("house") or {}
            row.update({"hti": hz.get("hti"), "band": hz.get("band"), "arc": hz.get("arc_clock"), "best": hz.get("scen_best"),
                        "bestName": scen.get(hz.get("scen_best"), ""), "saydo": (str(h.get("corroborated")) + "/" + str(h.get("tested"))) if h.get("tested") else "–",
                        "verdict": hz.get("verdict")})
        else:
            row["reason"] = hz.get("reason") or "No Horus read."
        out.append(row)
    return out


def omega_index(pk: dict | None) -> list[dict]:
    if not pk:
        return []
    out = []
    for t in pk.get("targets") or []:
        s = t["summary"]
        out.append({"key": s["key"], "domain": s["domain"], "business": s["business"], "archetype": s.get("archetype"), "archetype_label": s.get("archetype_label"),
                    "overall": s.get("overall"), "run_id": s.get("run_id"), "run_date": s.get("run_date"), "tier": s.get("tier"),
                    "confirmed": (s.get("honest") or {}).get("confirmed", 0), "findings": (s.get("findings") or {}).get("n", 0),
                    "agency": (s.get("agency") or {}).get("name"), "radar_id": (s.get("agency") or {}).get("radar_id"), "self_radar_id": s.get("radar_id"),
                    "failing": s.get("failing") or [], "demo": bool(s.get("demo"))})
    return out


# ------------------------------------------------------------------------------------------------------------ build
def template_parts() -> tuple[str, str]:
    """(css, body markup) of the dashboard template, for the app's frame page."""
    t = TEMPLATE.read_text(encoding="utf-8")
    css = t.split("<style>", 1)[1].split("</style>", 1)[0]
    body = t.split("<!--omega:head-end-->", 1)[1].split('<script type="application/json" id="omega-data">', 1)[0]
    return css.strip("\n"), body.strip("\n")


def frame_css(css: str) -> str:
    """The frame uses the app's bundled fonts (no network): map the template's web fonts onto them."""
    return (css.replace('--f-display:"Fraunces", "Iowan Old Style", "Palatino Linotype", Georgia, serif;', '--f-display:"Zilla Slab", "Iowan Old Style", "Palatino Linotype", Georgia, serif;')
               .replace('--f-body:"Public Sans", system-ui,', '--f-body:"IBM Plex Sans", system-ui,'))


def data_uri_css(css: str, base: Path) -> str:
    def rep(m):
        rel = m.group(1)
        p = base / rel
        if not p.exists():
            return m.group(0)
        return "url(data:font/woff2;base64," + base64.b64encode(p.read_bytes()).decode("ascii") + ")"
    return re.sub(r"url\((fonts/[^)]+)\)", rep, css)


def build_app(packs: list[Path], out_dir: Path, version: str, make_zip: bool, app_name: str) -> None:
    rad = radar()
    pk = merge_packs(packs) if packs else None
    ext = out_dir / "omegaweapon-chrome"
    if ext.exists():
        shutil.rmtree(ext)
    shutil.copytree(APP_SRC, ext)
    css, body = template_parts()
    fcss = frame_css(css)
    engine = ENGINE.read_text(encoding="utf-8")
    for name, text in (("engine", engine), ("frame css", fcss), ("frame markup", body)):
        if "</script" in text.lower():
            raise SystemExit(f"the {name} contains a closing script tag and cannot be embedded")
    (ext / "css" / "omega.css").write_text(fcss + "\n", encoding="utf-8")
    (ext / "js" / "omega-dashboard.js").write_text(engine, encoding="utf-8")
    (ext / "omega-frame.html").write_text(
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<title>Target dashboard</title>\n<link rel="stylesheet" href="css/fonts.css">\n<link rel="stylesheet" href="css/omega.css">\n</head>\n<body>\n'
        + body + '\n<script src="js/omega-dashboard.js"></script>\n</body>\n</html>\n', encoding="utf-8")
    meta_line = {"edition": rad["horus"]["edition"].get("edition"), "generated": rad["meta"].get("generated"), "app": app_name, "version": version,
                 "targets": (pk or {}).get("n", 0), "pack_generated": (pk or {}).get("generated")}
    data_js = "window.RADAR=" + inert(rad) + ";\n"
    index_js = ("self.RADAR_INDEX=" + inert(radar_index(rad)) + ";\nself.RADAR_INDEX_META=" + inert(meta_line) + ";\nself.OMEGA_INDEX=" + inert(omega_index(pk)) + ";\n")
    targets_js = "window.OMEGA_TARGETS=" + inert({"meta": meta_line, "targets": (pk or {}).get("targets") or []}) + ";\n"
    (ext / "js" / "data.js").write_text(data_js, encoding="utf-8")
    (ext / "js" / "index.js").write_text(index_js, encoding="utf-8")
    (ext / "js" / "targets.js").write_text(targets_js, encoding="utf-8")
    man = load(ext / "manifest.json")
    man["version"] = version
    man["name"] = app_name
    (ext / "manifest.json").write_text(json.dumps(man, indent=2) + "\n", encoding="utf-8")
    # the standalone page: same sources, one file
    fonts_css = data_uri_css((APP_SRC / "css" / "fonts.css").read_text(encoding="utf-8"), APP_SRC / "css")
    app_css = (APP_SRC / "css" / "app.css").read_text(encoding="utf-8")
    app_js = (APP_SRC / "js" / "app.js").read_text(encoding="utf-8")
    for name, text in (("app.js", app_js), ("app.css", app_css)):
        if "</script" in text.lower():
            raise SystemExit(f"{name} contains a closing script tag and cannot be inlined")
    icon = base64.b64encode((APP_SRC / "icons" / "icon32.png").read_bytes()).decode("ascii")
    page = ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
            "<meta name=\"robots\" content=\"noindex\">\n<title>" + app_name + "</title>\n<link rel=\"icon\" href=\"data:image/png;base64," + icon + "\">\n"
            "<style id=\"fonts-css\">\n" + fonts_css + "\n</style>\n<style>\n" + app_css + "\n</style>\n</head>\n<body>\n"
            "<div id=\"boot-msg\" class=\"wrap boot\">Loading " + app_name + "…</div>\n<div id=\"app-root\"></div>\n"
            "<script type=\"text/plain\" id=\"omega-frame-css\">\n" + fcss + "\n</script>\n"
            "<script type=\"text/plain\" id=\"omega-frame-html\">\n" + body + "\n</script>\n"
            "<script type=\"text/plain\" id=\"omega-engine\">\n" + engine + "\n</script>\n"
            "<script>\n" + data_js + index_js.replace("self.", "window.") + targets_js + "</script>\n"
            "<script>\n" + app_js + "\n</script>\n</body>\n</html>\n")
    out_dir.mkdir(parents=True, exist_ok=True)
    html_path = out_dir / "omegaweapon.html"
    html_path.write_text(page, encoding="utf-8")
    if make_zip:
        zp = out_dir / "omegaweapon-chrome.zip"
        with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
            for p in sorted(ext.rglob("*")):
                if p.is_file():
                    z.write(p, "omegaweapon-chrome/" + str(p.relative_to(ext)))
        print(f"wrote {zp} ({zp.stat().st_size / 1e6:.1f} MB)")
    print(f"wrote {ext} (extension, version {version}) and {html_path} ({html_path.stat().st_size / 1e6:.1f} MB): "
          f"{len(rad['agencies'])} agencies, {(pk or {}).get('n', 0)} targets")


# ------------------------------------------------------------------------------------------------------------ queue
def queue_commands(q: dict, ua: str | None, budget: int, tokens: str | None, out_dir: str) -> list[list[str]]:
    cmds = []
    for it in q.get("items") or q.get("queue") or []:
        dom = norm_host(it.get("domain") or "")
        if not dom:
            continue
        arch = it.get("archetype") or "local-service"
        cmd = [PY, str(HERE / "omega_run.py"), dom, "--archetype", arch]
        if it.get("business"):
            cmd += ["--business", it["business"]]
        if it.get("recipient"):
            cmd += ["--recipient", it["recipient"]]
        if it.get("geo"):
            cmd += ["--geo", it["geo"]]
        if it.get("jurisdiction"):
            cmd += ["--jurisdiction", it["jurisdiction"]]
        if it.get("question") or it.get("note"):
            cmd += ["--question", it.get("question") or it.get("note")]
        for u in it.get("money") or []:
            cmd += ["--money", u]
        if it.get("seeds"):
            cmd += ["--seeds", it["seeds"] if isinstance(it["seeds"], str) else ",".join(it["seeds"])]
        cmd += ["--follow-links", "--budget", str(budget)]
        if ua:
            cmd += ["--ua", ua]
        if tokens:
            cmd += ["--tokens", tokens]
        cmd += ["--out", str(Path(out_dir) / f"omega-{dom}.html")]
        cmds.append(cmd)
    return cmds


# ------------------------------------------------------------------------------------------------------------ CSV
CSV_COLS = ["id", "name", "domain", "region", "hq_country", "segment", "archetype", "ownership", "owner", "founded", "employees", "breadth", "prominence", "is_deep",
            "google_status", "google_30d", "google_total", "li_status", "li_company_ads", "li_thought_leader_ads", "content_90d", "sitemap_urls", "ai_urls", "llms_txt",
            "n_clients", "verticals", "lead_with"]
HORUS_COLS = ["horus_tailwind_index", "horus_tailwind_pct", "horus_band", "horus_arc_clock", "horus_khepri", "horus_ra", "horus_atum", "horus_duat", "horus_nilometer_tilt",
              "horus_portfolio_stereo_z", "horus_best_scenario", "horus_resilience", "horus_fit_S1", "horus_fit_S2", "horus_fit_S3", "horus_fit_S4", "horus_rail_answers_agents",
              "horus_rail_machine_data", "horus_rail_human_provenance", "horus_losing_side", "horus_moves_making", "horus_moves_partial", "horus_moves_applicable",
              "horus_P1", "horus_P2", "horus_P3", "horus_P4", "horus_P5", "horus_P6", "horus_P7", "horus_P8", "horus_saydo_tested", "horus_saydo_corroborated",
              "horus_saydo_contradicted", "horus_top_tailwind_kj", "horus_top_headwind_kj", "horus_graveyard_flag", "horus_voice_lines", "horus_ledger_items", "horus_nilometer", "horus_verdict"]
MONSOON_COLS = ["monsoon_index", "monsoon_pct", "monsoon_band", "monsoon_base", "monsoon_migration", "monsoon_displacement", "monsoon_asia_share", "monsoon_south_asia", "monsoon_southeast_asia",
                "monsoon_eastern_europe", "monsoon_latin_america", "monsoon_africa", "monsoon_automation_overlap", "monsoon_evidence", "monsoon_hub_offices", "monsoon_hub_jobs", "monsoon_terms", "monsoon_onshore_claim", "monsoon_verdict"]
OMEGA_COLS = ["omega_own_run", "omega_own_overall", "omega_targets_n", "omega_targets", "omega_inherited_share_mean", "omega_confirmed_across_targets", "omega_last_run"]
ANUBIS_COLS = ["needs_observed", "needs_named_only", "needs_top", "needs_shoppers_n", "dossier_openings_n", "dossier_written", "dossier_model", "dossier_revised", "dossier_bluf"]


def radar_csv(rad: dict, pk: dict | None) -> str:
    dims = [d[0] for d in rad["meta"]["strat_dims"]]
    scen = {s["id"]: s["name"] for s in rad["horus"]["edition"]["scenarios"]["items"]}
    by_agency: dict[str, list[dict]] = {}
    own: dict[str, dict] = {}
    for t in (pk or {}).get("targets") or []:
        s = t["summary"]
        rid = (s.get("agency") or {}).get("radar_id")
        if rid:
            by_agency.setdefault(rid, []).append(s)
        if s.get("radar_id"):
            own[s["radar_id"]] = s
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CSV_COLS + dims + HORUS_COLS + MONSOON_COLS + OMEGA_COLS + ANUBIS_COLS)
    for a in rad["agencies"]:
        g, li, hz = a.get("google") or {}, a.get("linkedin") or {}, a.get("horus") or {}
        emp = a.get("employees")
        row = [a["id"], a["name"], a.get("domain"), a.get("region"), a.get("hq_country"), a.get("segment"), a.get("archetype"), a.get("ownership"), a.get("owner") or "",
               a.get("founded") or "", (emp.get("value") if isinstance(emp, dict) else emp) or "", a.get("breadth"), round(a.get("prominence") or 0, 3), 1 if a.get("is_deep") else 0,
               g.get("status") or "", g.get("count_30d") if g.get("count_30d") is not None else "", g.get("count") if g.get("count") is not None else "",
               li.get("status") or "", li.get("company_ads") if li.get("company_ads") is not None else "", li.get("thought_leader_ads") if li.get("thought_leader_ads") is not None else "",
               a.get("content_90d") if a.get("content_90d") is not None else "", a.get("sitemap_urls") if a.get("sitemap_urls") is not None else "", a.get("ai_urls") if a.get("ai_urls") is not None else "",
               1 if a.get("llms_txt") else 0, len(a.get("clients") or []), "; ".join(a.get("verticals") or []), "; ".join(a.get("lead") or [])]
        row += [(a.get("strategy") or {}).get(k, "") for k in dims]
        if hz.get("ok"):
            sm, h, mv = hz.get("stage_mix") or {}, hz.get("house") or {}, hz.get("moves") or {}
            def f1(x):
                return "" if x is None else f"{float(x):.1f}"
            def f3(x):
                return "" if x is None else (f"{float(x):.3f}".rstrip("0").rstrip(".") if float(x) != int(float(x)) else f"{float(x):.1f}")
            row += [f1(hz.get("hti")), hz.get("hti_pct"), hz.get("band"), hz.get("arc_clock"), f3(sm.get("Khepri")), f3(sm.get("Ra")), f3(sm.get("Atum")), f3(sm.get("Duat")), f3(hz.get("tilt")), f3(hz.get("stereo")),
                    (hz.get("scen_best") or "") + " " + scen.get(hz.get("scen_best"), ""), f1(hz.get("resilience"))]
            row += [f"{hz['scen_fit'][s]:.1f}" for s in ("S1", "S2", "S3", "S4")]
            row += [f"{hz['rails'][r]['score']:.1f}" for r in ("R1", "R2", "R3", "L")]
            ms = hz.get("moves_score") or {}
            row += [ms.get("making"), ms.get("partial"), ms.get("applicable")]
            row += [(mv.get(f"P{i}") or {}).get("s", "") for i in range(1, 9)]
            row += [h.get("tested"), h.get("corroborated"), h.get("contradicted"), "; ".join(hz.get("kj_tail") or []), "; ".join(hz.get("kj_head") or []),
                    1 if hz.get("graveyard") else "", (hz.get("voice") or {}).get("n"), "; ".join(str(x.get("id") if isinstance(x, dict) else x) for x in (hz.get("ledger_items") or [])),
                    "; ".join(str(x.get("id") if isinstance(x, dict) else x) for x in (hz.get("nilometer") or [])), hz.get("verdict")]
        else:
            row += [""] * (len(HORUS_COLS) - 1) + [hz.get("reason") or ""]
        mo = a.get("offshore") or {}
        if mo.get("ok"):
            sh = mo.get("shore") or {}
            row += [f"{mo['index']:.1f}", mo.get("index_pct"), mo.get("band"), f"{mo['base']:.1f}", f"{mo['migration']:.1f}", f"{mo['displacement']:.1f}", f"{mo['asia']:.2f}",
                    f"{sh.get('south_asia', 0):.2f}", f"{sh.get('southeast_asia', 0):.2f}", f"{sh.get('eastern_europe', 0):.2f}", f"{sh.get('latin_america', 0):.2f}", f"{sh.get('africa', 0):.2f}",
                    f"{mo.get('overlap', 0):.2f}", mo.get("evidence_class"), "; ".join(h["place"] for h in mo.get("hub_offices") or []), "; ".join(j["location"] for j in mo.get("hub_jobs") or []),
                    "; ".join(f"{t['term']} {t['pts']:+d}" for t in (mo.get("terms") or {}).get("migration", []) + (mo.get("terms") or {}).get("displacement", [])),
                    1 if mo.get("onshore_claims") else "", mo.get("verdict")]
        else:
            row += [""] * (len(MONSOON_COLS) - 1) + [mo.get("reason") or ""]
        o = own.get(a["id"])
        ts = by_agency.get(a["id"]) or []
        shares = [x["agency"]["inherited_share"] for x in ts if x.get("agency", {}).get("inherited_share") is not None]
        row += [o["run_id"] if o else "", o["overall"] if o else "", len(ts), "; ".join(x["domain"] for x in ts),
                round(sum(shares) / len(shares), 2) if shares else "", sum((x.get("honest") or {}).get("confirmed", 0) for x in ts) if ts else "",
                max([x.get("run_date") or "" for x in ts] + ([o.get("run_date") or ""] if o else []), default="")]
        nd, do = a.get("needs") or {}, a.get("dossier") or {}
        tx, sp = do.get("text") or {}, do.get("spine") or {}
        row += [nd.get("observed", ""), nd.get("named_only", ""), "; ".join(m["label"] for m in (nd.get("mix") or [])[:3]), nd.get("shared_n", ""),
                len(sp.get("openings") or []) if sp else "", tx.get("written") or "", tx.get("model") or "",
                (f"{(tx.get('revised') or {}).get('date')} {(tx.get('revised') or {}).get('model')} ({', '.join((tx.get('revised') or {}).get('sections') or [])})" if tx.get("revised") else ""), tx.get("bluf") or ""]
        w.writerow(row)
    return buf.getvalue()


# ------------------------------------------------------------------------------------------------------------ aggregates
COUNTRY_ALIAS = {"United Kingdom": "UK", "United States": "US", "USA": "US", "Deutschland": "Germany"}


def radar_agg(rad: dict) -> dict:
    A = rad["agencies"]
    dims = rad["meta"]["strat_dims"]
    old = rad.get("agg") or {}
    n = len(A)
    def cnt(fn):
        m: dict = {}
        for a in A:
            k = fn(a)
            if k is None:
                continue
            m[k] = m.get(k, 0) + 1
        return [{"name": k, "n": v} for k, v in sorted(m.items(), key=lambda x: (-x[1], str(x[0])))]
    strategy = []
    for key, label in dims:
        vals = [(a, (a.get("strategy") or {}).get(key)) for a in A]
        have = [(a, v) for a, v in vals if v is not None]
        inv = [a for a, v in have if v >= 2]
        heavy = [a for a, v in have if v >= 3]
        leaders = [a["name"] for a in sorted(heavy, key=lambda a: -(a.get("prominence") or 0))[:8]]
        strategy.append({"key": key, "label": label, "mean": round(sum(v for _, v in have) / len(have), 2) if have else 0,
                         "invest_n": len(inv), "invest_pct": int(round(100 * len(inv) / n)), "heavy_n": len(heavy), "heavy_pct": int(round(100 * len(heavy) / n)), "leaders": leaders})
    strategy.sort(key=lambda r: -r["mean"])
    by_region = {}
    for reg in sorted({a.get("region") for a in A if a.get("region")}):
        rows = [a for a in A if a.get("region") == reg and a.get("strategy")]
        by_region[reg] = {key: round(sum((a.get("strategy") or {}).get(key, 0) or 0 for a in rows) / len(rows), 2) for key, _ in dims}
    gaps: dict = {}
    for a in A:
        for g in a.get("gaps") or []:
            gaps[g["label"]] = gaps.get(g["label"], 0) + 1
    clients: dict = {}
    total = 0
    for a in A:
        for c in a.get("clients") or []:
            total += 1
            k = norm_name(c.get("name"))
            if not k:
                continue
            e = clients.setdefault(k, {"name": c.get("name"), "agencies": []})
            if a["id"] not in e["agencies"]:
                e["agencies"].append(a["id"])
    shared = sorted([{"name": v["name"], "agencies": sorted(v["agencies"]), "n": len(v["agencies"])} for v in clients.values() if len(v["agencies"]) >= 2], key=lambda x: (-x["n"], x["name"]))[:60]
    verticals: dict = {}
    for a in A:
        for v in a.get("verticals") or []:
            verticals[v] = verticals.get(v, 0) + 1
    g_formats: dict = {}
    li_formats: dict = {}
    for a in A:
        for k, v in ((a.get("google") or {}).get("format_counts") or {}).items():
            g_formats[k] = g_formats.get(k, 0) + v
        for k, v in ((a.get("linkedin") or {}).get("format_counts") or {}).items():
            li_formats[k] = li_formats.get(k, 0) + v
    def top(rows, key, n_top=20):
        return sorted(rows, key=lambda r: -(r[key] or 0))[:n_top]
    paid = {
        "google_active": sum(1 for a in A if (a.get("google") or {}).get("status") == "active"),
        "li_active": sum(1 for a in A if (a.get("linkedin") or {}).get("status") == "active"),
        "meta_active": sum(1 for a in A if (a.get("meta") or {}).get("status") == "active"),
        "tiktok_active": sum(1 for a in A if (a.get("tiktok") or {}).get("status") == "active"),
        "li_thought_leader": sum(1 for a in A if (a.get("li_thought_leader") or 0) > 0),
        "google_formats": [{"name": k, "n": v} for k, v in sorted(g_formats.items(), key=lambda x: -x[1])],
        "google_top_30d": top([{"name": a["name"], "id": a["id"], "count_30d": (a.get("google") or {}).get("count_30d") or 0, "total": (a.get("google") or {}).get("count") or 0} for a in A if (a.get("google") or {}).get("count_30d")], "count_30d"),
        "li_top": top([{"name": a["name"], "id": a["id"], "company_ads": (a.get("linkedin") or {}).get("company_ads") or 0, "thought_leader": (a.get("linkedin") or {}).get("thought_leader_ads") or 0} for a in A if (a.get("linkedin") or {}).get("company_ads")], "company_ads"),
        "li_tl_top": top([{"name": a["name"], "id": a["id"], "tl": a.get("li_thought_leader") or 0} for a in A if (a.get("li_thought_leader") or 0) > 0], "tl"),
        "li_tl_total": sum(1 for a in A if (a.get("li_thought_leader") or 0) > 0),
        "li_formats": [{"name": k, "n": v} for k, v in sorted(li_formats.items(), key=lambda x: -x[1])],
    }
    ai = {"has_llms_txt": sum(1 for a in A if a.get("llms_txt") is True), "blocks_ai_bots": sum(1 for a in A if a.get("ai_bots_blocked")),
          "ai_search_heavy": sum(1 for a in A if ((a.get("strategy") or {}).get("ai_search") or 0) >= 3), "ai_search_invest": sum(1 for a in A if ((a.get("strategy") or {}).get("ai_search") or 0) >= 2),
          "ai_automation_invest": sum(1 for a in A if ((a.get("strategy") or {}).get("ai_automation") or 0) >= 2),
          "top_ai_urls": top([{"name": a["name"], "id": a["id"], "ai_urls": a.get("ai_urls") or 0} for a in A if a.get("ai_urls")], "ai_urls")}
    return {
        "n": n, "strategy": strategy, "strategy_by_region": by_region, "archetypes": cnt(lambda a: a.get("archetype") or "Unclassified"), "segments": cnt(lambda a: a.get("segment")),
        "regions": cnt(lambda a: a.get("region")), "countries": cnt(lambda a: COUNTRY_ALIAS.get(a.get("hq_country"), a.get("hq_country"))), "ownership": cnt(lambda a: a.get("ownership") or "unknown"), "status": cnt(lambda a: a.get("status")),
        "paid": paid,
        "content_velocity": sorted([{"name": a["name"], "id": a["id"], "c90": a.get("content_90d") or 0, "c365": a.get("content_365d") or 0, "sitemap": a.get("sitemap_urls") or 0} for a in A if a.get("content_90d")], key=lambda r: -r["c90"])[:25],
        "ai": ai,
        "clients": {"total_mentions": total, "unique": len(clients), "with_clients": sum(1 for a in A if a.get("clients")), "shared": shared,
                    "top_by_book": sorted([{"name": a["name"], "id": a["id"], "n": len(a.get("clients") or [])} for a in A if a.get("clients")], key=lambda r: -r["n"])[:25]},
        "verticals": [{"name": k, "n": v} for k, v in sorted(verticals.items(), key=lambda x: (-x[1], x[0]))],
        "proprietary_count": sum(1 for a in A if a.get("proprietary")),
        "prominence_top": [{"name": a["name"], "id": a["id"], "score": round(a.get("prominence") or 0, 3), "region": a.get("region"), "archetype": a.get("archetype")} for a in sorted(A, key=lambda a: -(a.get("prominence") or 0))[:25]],
        "gaps": [{"label": k, "n": v} for k, v in sorted(gaps.items(), key=lambda x: (-x[1], x[0]))],
    }


def agg_check(rad: dict) -> None:
    new = radar_agg(rad)
    old = rad.get("agg") or {}
    for k in new:
        same = json.dumps(new[k], sort_keys=True) == json.dumps(old.get(k), sort_keys=True)
        print(("same " if same else "DIFF ") + k)


def radar_upsert(path: Path, recompute_all: bool) -> None:
    rad = radar()
    rec = load(path)
    recs = rec if isinstance(rec, list) else [rec]
    for r in recs:
        if not r.get("id") or not r.get("name") or not r.get("domain"):
            raise SystemExit("an agency record needs id, name and domain")
        i = next((i for i, a in enumerate(rad["agencies"]) if a["id"] == r["id"]), None)
        if i is None:
            rad["agencies"].append(r)
            print(f"added {r['id']}")
        else:
            rad["agencies"][i] = {**rad["agencies"][i], **r}
            print(f"updated {r['id']}")
    ids = {r["id"] for r in recs}
    layers = {}
    for a in rad["agencies"]:
        if recompute_all or a["id"] in ids or not a.get("horus"):
            a["horus"] = radar_horus.compute(a, rad)
        layers[a["id"]] = a["horus"]
    radar_horus.percentiles(layers)
    rad["horus"]["field"] = radar_horus.field_summary(rad)
    radar_offshore.rebuild(rad, radar_offshore.load_model())
    rad["agg"] = radar_agg(rad)
    rad["meta"]["n_agencies"] = len(rad["agencies"])
    rad["meta"]["n_deep"] = sum(1 for a in rad["agencies"] if a.get("is_deep"))
    rad["meta"]["generated"] = dt.date.today().isoformat()
    RADAR_PATH.write_text(json.dumps(rad, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"registry now {len(rad['agencies'])} agencies; rebuild the app with build-app")


# ------------------------------------------------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["resolve", "pack", "build-app", "queue", "radar-csv", "radar-upsert", "radar-agg"])
    ap.add_argument("--manifest", action="append", default=[])
    ap.add_argument("--cache")
    ap.add_argument("--latest", action="store_true")
    ap.add_argument("--pack", action="append", default=[])
    ap.add_argument("--out")
    ap.add_argument("--tokens", default="")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--write-manifests", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--version", default=APP_VERSION)
    ap.add_argument("--name", default="OmegaWeapon")
    ap.add_argument("--no-zip", action="store_true")
    ap.add_argument("--file")
    ap.add_argument("--run", action="store_true")
    ap.add_argument("--ua")
    ap.add_argument("--budget", type=int, default=60)
    ap.add_argument("--recompute-all", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    tokens = [t for t in a.tokens.split(",") if t.strip()] if a.tokens else []

    if a.cmd == "resolve":
        if not a.manifest:
            raise SystemExit("--manifest is required")
        for mp in a.manifest:
            m = load(mp)
            hit = resolve(m)
            print(f"{mp}: agency of record {'matched ' + hit['name'] if hit else 'not in the Radar'}; target {'is ' + m['target']['radar_id'] if m['target'].get('radar_id') else 'is not a tracked agency'}")
            if a.write:
                Path(mp).write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")
    elif a.cmd == "pack":
        mps = [Path(p) for p in a.manifest]
        if a.cache:
            mps += latest_runs(Path(a.cache))
        if not mps:
            raise SystemExit("give --manifest paths or --cache <dir> --latest")
        pk = pack(mps, tokens, a.write_manifests, a.force)
        out = Path(a.out or "omega-pack.json")
        out.write_text(json.dumps(pk, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"wrote {out}: {pk['n']} target(s), {out.stat().st_size / 1024:.0f} KB")
    elif a.cmd == "build-app":
        build_app([Path(p) for p in a.pack], Path(a.out or "dist"), a.version, not a.no_zip, a.name)
    elif a.cmd == "queue":
        if not a.file:
            raise SystemExit("--file omega-queue.json is required")
        q = load(a.file)
        cmds = queue_commands(q, a.ua, a.budget, a.tokens or None, a.out or ".")
        if not cmds:
            print("the queue is empty")
        for c in cmds:
            print(" ".join(json.dumps(x) if " " in x else x for x in c))
            if a.run:
                r = subprocess.run(c, cwd=str(ROOT))
                print(f"exit {r.returncode}")
    elif a.cmd == "radar-csv":
        pk = merge_packs([Path(p) for p in a.pack]) if a.pack else None
        text = radar_csv(radar(), pk)
        out = Path(a.out or "agency_radar_horus.csv")
        out.write_text(text, encoding="utf-8", newline="")
        print(f"wrote {out}")
    elif a.cmd == "radar-upsert":
        if not a.file:
            raise SystemExit("--file agency.json is required")
        radar_upsert(Path(a.file), a.recompute_all)
    elif a.cmd == "radar-agg":
        rad = radar()
        if a.check:
            agg_check(rad)
        else:
            rad["agg"] = radar_agg(rad)
            if a.write:
                RADAR_PATH.write_text(json.dumps(rad, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
                print("aggregates recomputed and written")
            else:
                print("aggregates recomputed (dry run; --write to save)")


if __name__ == "__main__":
    main()
