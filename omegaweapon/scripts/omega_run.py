#!/usr/bin/env python3
"""OMEGAWEAPON run: one target domain in, one dashboard out.

The orchestrator behind "auto creates dashboards at any domain targeted". It scaffolds the run manifest, runs the
honest fetch phases the arsenal already ships (self-test, robots and sitemap inventory, the Google Crawl, the raw scan
of the money set, the Schema Tribunal, the mobile render, the render probe, RDAP and DNS, the Autocomplete demand map,
app-store forensics when the site vouches for an app, PageSpeed Insights when a key is present), ingests every output
into the manifest, validates the contract and builds the dashboard. Every phase is bounded by the fetch budget, obeys
robots.txt, declares its User-Agent, and a phase that fails is recorded as blocked in the manifest rather than aborting
the run. The analysis of record (key judgments, the brand read, the playbook) is still the analyst's to write into the
manifest afterwards; rebuild with --build-only when it is in.

Usage
  python3 scripts/omega_run.py example.com --archetype local-service [--vertical legal] [--recipient "Client"] [--geo "Frisco, TX"]
        [--jurisdiction US-TX] [--question "..."] [--posture competitor|self-audit]
        [--money URL ...] [--seeds "plumber frisco,water heater repair frisco"] [--max-pages 80] [--follow-links] [--render 3]
        [--ios ID ...] [--android PKG ...] [--ua "OmegaWeapon/1.0 (+https://you.example/contact)"] [--min-interval 2]
        [--budget 60] [--cache omega_cache] [--run-id 2026-09-28a] [--out omega-example.com.html] [--fragment] [--system-fonts]
        [--tokens "Operator,operator.com"] [--skip crawl,render,...] [--build-only] [--legacy-persona]
Phases: selftest, robots, crawl, scan, schema, render, probe, rdap, dns, demand, apps, psi, ingest, radar, validate, build.
After the build: python3 scripts/omega_platform.py pack --cache <cache> --latest, then build-app --pack omega-pack.json, and the
dashboard is hosted in the OmegaWeapon app (the Targets wing) beside the Agency Radar.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PY = sys.executable

PHASES = ["selftest", "robots", "crawl", "scan", "schema", "render", "probe", "rdap", "dns", "demand", "apps", "psi", "ingest", "radar", "validate", "build"]


def sh(cmd: list[str], log, timeout=900) -> tuple[int, str]:
    log.write("$ " + " ".join(cmd) + "\n")
    log.flush()
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=str(ROOT))
        out = (r.stdout or "") + (r.stderr or "")
        log.write(out[-6000:] + "\n")
        log.flush()
        return r.returncode, out
    except subprocess.TimeoutExpired:
        log.write("TIMEOUT\n")
        return 124, "timeout"


def fetches_used(cache: Path) -> int:
    f = cache / "wetware" / "fetch_log.jsonl"
    if not f.exists():
        return 0
    with open(f, encoding="utf-8") as fh:
        return sum(1 for _ in fh)


def slug_domain(s: str) -> str:
    s = re.sub(r"^https?://", "", s.strip().lower()).split("/")[0]
    return re.sub(r"^www\.", "", s)


def pick_money_pages(cache: Path, homepage: str, n: int = 4) -> list[str]:
    """Homepage plus the most-linked shallow pages that look like services, products or contact; a heuristic the
    analyst overrides with --money."""
    cj = cache / "google_crawl" / "crawl.json"
    if not cj.exists():
        return [homepage]
    try:
        pages = json.loads(cj.read_text(encoding="utf-8")).get("pages", [])
    except Exception:
        return [homepage]
    keep = []
    for p in pages:
        if p.get("status") != 200 or not p.get("indexable") or p.get("hops"):
            continue
        u = p.get("final_url") or p.get("url")
        path = urllib.parse.urlparse(u).path.lower()
        score = (p.get("inlinks") or 0) * 2 - (p.get("depth") or 0) * 3
        if re.search(r"service|product|pricing|financ|shop|menu|practice|treatment|repair|install|locations?|collections?|solutions?|plans?", path):
            score += 10
        if re.search(r"contact|quote|book|schedule|apply|demo", path):
            score += 4
        if re.search(r"blog|news|privacy|terms|career|sitemap|tag|category|author|page/\d", path):
            score -= 20
        if u.rstrip("/") == homepage.rstrip("/"):
            continue
        keep.append((score, u))
    keep.sort(reverse=True)
    return [homepage] + [u for _, u in keep[: max(0, n - 1)]]


def find_legal_pages(cache: Path) -> list[str]:
    cj = cache / "google_crawl" / "crawl.json"
    if not cj.exists():
        return []
    try:
        pages = json.loads(cj.read_text(encoding="utf-8")).get("pages", [])
    except Exception:
        return []
    out = []
    for p in pages:
        u = p.get("final_url") or p.get("url") or ""
        if p.get("status") == 200 and re.search(r"privacy|terms|contact", urllib.parse.urlparse(u).path.lower()):
            out.append(u)
    return out[:3]


def demand_map(cache: Path, seeds: list[str], ua: str | None, min_interval: float | None, log) -> None:
    """Google Autocomplete presence grid through the honest wetware session (public JSON endpoint on the fetch ladder)."""
    sys.path.insert(0, str(HERE))
    import wetware
    ww = wetware.Session(str(cache), honest=True, declared_ua=ua, min_interval=min_interval, assets=False, quiet=True)
    out = {}
    suffixes = ["", " near me", " cost", " reviews", " best"]
    try:
        for seed in seeds:
            for sfx in suffixes:
                q = (seed + sfx).strip()
                url = "https://suggestqueries.google.com/complete/search?client=firefox&q=" + urllib.parse.quote(q)
                meta, body = ww.get(url, kind="api", accept="application/json")
                try:
                    j = json.loads(body)
                    out[q] = j[1] if isinstance(j, list) and len(j) > 1 else []
                except Exception:
                    out[q] = []
                    log.write("autocomplete %s -> status %s tier %s\n" % (q, meta.get("status"), meta.get("tier")))
    finally:
        ww.close()
    (cache / "search").mkdir(parents=True, exist_ok=True)
    (cache / "search" / "autocomplete.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


def app_ids_from_scan(cache: Path) -> tuple[list[str], list[str]]:
    ios, android = set(), set()
    for f in (cache / "web").glob("*.web.json"):
        try:
            j = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        apps = (j.get("host") or {}).get("apps") or {}
        ios.update(apps.get("ios_ids") or [])
        android.update(apps.get("android_packages") or [])
        android.update(apps.get("assetlinks_packages") or [])
    return sorted(ios), sorted(android)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("domain")
    ap.add_argument("--archetype")
    ap.add_argument("--homepage", help="homepage URL when it is not https://<domain>/ (www host, staging host, local test server)")
    ap.add_argument("--secondary")
    ap.add_argument("--vertical", default="")
    ap.add_argument("--posture", default="competitor", choices=["competitor", "self-audit"])
    ap.add_argument("--recipient", default="")
    ap.add_argument("--business", default="")
    ap.add_argument("--geo", default="")
    ap.add_argument("--jurisdiction", action="append")
    ap.add_argument("--question", default="")
    ap.add_argument("--money", action="append", default=[])
    ap.add_argument("--seeds", default="", help="comma-separated demand seeds ('[service] [city]')")
    ap.add_argument("--max-pages", type=int, default=80)
    ap.add_argument("--follow-links", action="store_true")
    ap.add_argument("--render", type=int, default=3, help="how many money pages to render (mobile) and probe")
    ap.add_argument("--ios", action="append", default=[])
    ap.add_argument("--android", action="append", default=[])
    ap.add_argument("--ua")
    ap.add_argument("--min-interval", type=float)
    ap.add_argument("--budget", type=int, default=60)
    ap.add_argument("--cache", default="omega_cache")
    ap.add_argument("--run-id")
    ap.add_argument("--out")
    ap.add_argument("--fragment", action="store_true")
    ap.add_argument("--system-fonts", action="store_true")
    ap.add_argument("--name-on-page", action="store_true")
    ap.add_argument("--tokens", default="")
    ap.add_argument("--skip", default="", help="comma-separated phases to skip")
    ap.add_argument("--only", default="", help="comma-separated phases to run (others skipped)")
    ap.add_argument("--build-only", action="store_true", help="skip every fetch phase; ingest, validate and build")
    ap.add_argument("--legacy-persona", action="store_true", help="opt in to the human-presence persona for the scan and probe phases (never the Google Crawl)")
    ap.add_argument("--force", action="store_true", help="build despite validation errors (draft)")
    a = ap.parse_args()

    domain = slug_domain(a.domain)
    homepage = a.homepage or f"https://{domain}/"
    cache = Path(a.cache) / domain
    cache.mkdir(parents=True, exist_ok=True)
    log = open(cache / "omega_run.log", "a", encoding="utf-8")
    log.write("\n==== run %s ====\n" % dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    skip = set(x.strip() for x in a.skip.split(",") if x.strip())
    only = set(x.strip() for x in a.only.split(",") if x.strip())
    if a.build_only:
        skip |= set(PHASES) - {"ingest", "radar", "validate", "build"}
    def on(phase):
        return phase not in skip and (not only or phase in only)
    persona = ["--legacy-persona"] if a.legacy_persona else []
    ua = ["--ua", a.ua] if a.ua else []
    mi = ["--min-interval", str(a.min_interval)] if a.min_interval else []
    blocked = []
    t0 = time.time()

    # manifest
    runs = sorted((cache / "runs").glob("*.json")) if (cache / "runs").exists() else []
    if a.run_id:
        manifest = cache / "runs" / (a.run_id + ".json")
    elif runs and (a.build_only or "scaffold" in skip):
        manifest = runs[-1]
    else:
        today = dt.date.today().isoformat()
        suffix = "a"
        while (cache / "runs" / f"{today}{suffix}.json").exists():
            suffix = chr(ord(suffix) + 1)
        manifest = cache / "runs" / f"{today}{suffix}.json"
    if not manifest.exists():
        if not a.archetype:
            sys.exit("--archetype is required for a new run (see assets/archetypes.json)")
        cmd = [PY, str(HERE / "omega_scaffold.py"), domain, "--archetype", a.archetype, "--posture", a.posture, "--cache", a.cache, "--run-id", manifest.stem, "--fetch-budget", str(a.budget)]
        if a.homepage:
            cmd += ["--homepage", a.homepage]
        for k, v in (("--secondary", a.secondary), ("--vertical", a.vertical), ("--recipient", a.recipient), ("--business", a.business), ("--geo", a.geo), ("--question", a.question)):
            if v:
                cmd += [k, v]
        for j in a.jurisdiction or []:
            cmd += ["--jurisdiction", j]
        rc, out = sh(cmd, log)
        if rc != 0:
            sys.exit(out)
        print(out.strip())
    m = json.loads(manifest.read_text(encoding="utf-8"))
    if a.money:
        m["target"]["money_pages"] = sorted(set(m["target"].get("money_pages", []) + a.money))
    m["run"]["presence"]["mode"] = "legacy-persona" if a.legacy_persona else "honest"
    manifest.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")

    def over_budget():
        return fetches_used(cache) >= a.budget

    def phase(name, fn):
        if not on(name):
            print(f"[skip] {name}")
            return
        if name not in ("ingest", "validate", "build") and over_budget():
            print(f"[budget] {name}: fetch budget {a.budget} reached; phase recorded as blocked")
            blocked.append({"surface": name, "why": "fetch budget reached before this phase"})
            return
        t = time.time()
        try:
            msg = fn()
            print(f"[ok] {name} ({time.time() - t:.0f}s){(': ' + msg) if msg else ''}")
        except Exception as e:
            print(f"[fail] {name}: {e}")
            log.write(f"phase {name} failed: {e}\n")
            blocked.append({"surface": name, "why": str(e)[:200]})

    # 1 selftest -> presence line
    def p_selftest():
        rc, out = sh([PY, str(HERE / "justice_fetch.py"), "--selftest", "--cache", str(cache)] + persona + ua + mi, log)
        line = next((l for l in out.splitlines() if "DECLARED" in l or "Presence" in l or "tier" in l.lower()), out.strip().splitlines()[-1] if out.strip() else "")
        mm = json.loads(manifest.read_text(encoding="utf-8"))
        mm["run"]["presence"]["line"] = line.strip()[:400]
        mm["run"]["presence"]["declared_ua"] = a.ua or os.environ.get("OW_USER_AGENT") or os.environ.get("UW_USER_AGENT") or "OmegaWeapon/1.0 (+https://REPLACE-WITH-YOUR-CONTACT-URL)"
        manifest.write_text(json.dumps(mm, ensure_ascii=False, indent=1), encoding="utf-8")
        if rc != 0:
            raise RuntimeError(out.strip()[-300:])
        return line.strip()[:120]
    phase("selftest", p_selftest)

    # 2 robots + sitemap inventory + homepage html
    def p_robots():
        rc, out = sh([PY, str(HERE / "justice_fetch.py"), "--robots", "--out", str(cache / "html"), "--cache", str(cache), homepage] + persona + ua + mi, log)
        if rc != 0:
            raise RuntimeError(out.strip()[-300:])
        return "homepage and sitemap inventory fetched"
    phase("robots", p_robots)

    # 3 the Google Crawl
    def p_crawl():
        cmd = [PY, str(HERE / "google_crawler.py"), "--cache", str(cache), "--quiet"] + ua + mi + ["crawl", homepage, "--out", str(cache / "google_crawl"), "--max-pages", str(a.max_pages)]
        if a.follow_links:
            cmd.append("--follow-links")
        rc, out = sh(cmd, log, timeout=1800)
        if rc != 0:
            raise RuntimeError(out.strip()[-300:])
        cj = cache / "google_crawl" / "crawl.json"
        if cj.exists():
            s = json.loads(cj.read_text(encoding="utf-8")).get("summary", {})
            return f"{s.get('fetched_pages')} pages, {s.get('sitemap_urls_total')} sitemap URLs, index status {s.get('index_status')}"
        return "crawl finished"
    phase("crawl", p_crawl)

    # money pages
    m = json.loads(manifest.read_text(encoding="utf-8"))
    money = m["target"].get("money_pages") or pick_money_pages(cache, homepage, 4)
    m["target"]["money_pages"] = money
    manifest.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")

    # 4 raw scan of the money set + legal pages
    def p_scan():
        urls = list(dict.fromkeys(money + find_legal_pages(cache)))
        rc, out = sh([PY, str(HERE / "satchel_web.py"), "scan", "--out", str(cache / "web"), "--cache", str(cache)] + persona + ua + mi + urls, log, timeout=1200)
        if rc != 0:
            raise RuntimeError(out.strip()[-300:])
        return f"{len(urls)} pages scanned"
    phase("scan", p_scan)

    # 5 schema tribunal on saved html
    def p_schema():
        htmls = sorted(str(p) for p in (cache / "html").glob("*.html"))
        if not htmls:
            return "no saved html"
        rc, out = sh([PY, str(HERE / "justice_schema.py")] + htmls + ["--out", str(cache / "schema")], log)
        if rc != 0:
            raise RuntimeError(out.strip()[-300:])
        return f"{len(htmls)} pages judged"
    phase("schema", p_schema)

    # 6 mobile render (honest only, never persona)
    def p_render():
        urls = money[: max(1, a.render)]
        rc, out = sh([PY, str(HERE / "google_crawler.py"), "--cache", str(cache), "--quiet"] + ua + mi + ["render"] + urls + ["--out", str(cache / "google_render.json"), "--screenshots", str(cache / "google_shots")], log, timeout=900)
        if rc != 0:
            raise RuntimeError(out.strip()[-300:])
        return f"{len(urls)} pages rendered"
    phase("render", p_render)

    # 7 render probe (pre-consent log, banner, dark patterns)
    def p_probe():
        urls = money[: max(1, a.render)]
        rc, out = sh([PY, str(HERE / "satchel_render.py")] + urls + ["--out", str(cache / "render"), "--cache", str(cache)] + persona + ua, log, timeout=900)
        if rc != 0:
            raise RuntimeError(out.strip()[-300:])
        return f"{len(urls)} pages probed"
    phase("probe", p_probe)

    # 8 and 9 ownership and outreach infrastructure
    def p_rdap():
        rc, out = sh([PY, str(HERE / "satchel_web.py"), "rdap", domain, "--out", str(cache / "web"), "--cache", str(cache)] + persona + ua + mi, log)
        if rc != 0:
            raise RuntimeError(out.strip()[-300:])
        return "rdap read"
    phase("rdap", p_rdap)

    def p_dns():
        rc, out = sh([PY, str(HERE / "satchel_web.py"), "dns", domain, "--out", str(cache / "web"), "--cache", str(cache)] + persona + ua + mi, log)
        if rc != 0:
            raise RuntimeError(out.strip()[-300:])
        return "spf, dmarc and mx read"
    phase("dns", p_dns)

    # 10 demand map
    def p_demand():
        seeds = [s.strip() for s in a.seeds.split(",") if s.strip()]
        if not seeds:
            return "no seeds given (--seeds); skipped"
        demand_map(cache, seeds, a.ua, a.min_interval, log)
        return f"{len(seeds)} seeds x 5 suffixes"
    phase("demand", p_demand)

    # 11 apps
    def p_apps():
        ios, android = app_ids_from_scan(cache)
        ios = sorted(set(ios + a.ios))
        android = sorted(set(android + a.android))
        if not ios and not android:
            return "no app discovered"
        cmd = [PY, str(HERE / "satchel_app.py"), "lookup", "--out", str(cache / "apps"), "--cache", str(cache)] + ua + mi
        if ios:
            cmd += ["--ios"] + ios
        if android:
            cmd += ["--android"] + android
        rc, out = sh(cmd, log, timeout=900)
        if rc != 0:
            raise RuntimeError(out.strip()[-300:])
        return f"{len(ios)} iOS, {len(android)} Android"
    phase("apps", p_apps)

    # 12 PSI
    def p_psi():
        if not os.environ.get("PSI_API_KEY"):
            return "no PSI_API_KEY; verify docket instead of numbers"
        uf = cache / "psi" / "urls.txt"
        uf.parent.mkdir(parents=True, exist_ok=True)
        uf.write_text("\n".join(money) + "\n", encoding="utf-8")
        rc, out = sh([PY, str(HERE / "justice_psi.py"), str(uf), "--out", str(cache / "psi"), "--cache", str(cache), "--strategy", "mobile"], log, timeout=900)
        if rc != 0:
            raise RuntimeError(out.strip()[-300:])
        return f"{len(money)} URLs"
    phase("psi", p_psi)

    # record blocked phases and fetch count
    m = json.loads(manifest.read_text(encoding="utf-8"))
    m["run"]["blocked"] = (m["run"].get("blocked") or []) + blocked
    m["run"]["fetches_used"] = max(m["run"].get("fetches_used", 0), fetches_used(cache))
    m["run"]["fetch_budget"] = a.budget
    jc = m["run"].get("judgment_calls") or []
    auto = f"Automated run: money pages {', '.join(money)}; max pages {a.max_pages}; link-graph discovery {'on' if a.follow_links else 'off'}; {a.render} pages rendered and probed; presence {'legacy persona (opt-in)' if a.legacy_persona else 'honest, declared UA, robots obeyed'}."
    if not any(x.startswith("Automated run:") for x in jc):
        jc.insert(0, auto)
    m["run"]["judgment_calls"] = jc
    manifest.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")

    # 13 ingest
    def p_ingest():
        rc, out = sh([PY, str(HERE / "omega_ingest.py"), "--manifest", str(manifest), "--cache", str(cache)], log)
        if rc != 0:
            raise RuntimeError(out.strip()[-400:])
        return out.strip().splitlines()[-1][:200]
    phase("ingest", p_ingest)

    # 13b radar: the agency of record against the Agency Radar (local, no fetch); the Radar dossier rides along as observed context
    def p_radar():
        rc, out = sh([PY, str(HERE / "omega_platform.py"), "resolve", "--manifest", str(manifest), "--write"], log)
        if rc != 0:
            raise RuntimeError(out.strip()[-400:])
        return out.strip().splitlines()[-1][:200]
    phase("radar", p_radar)

    # 14 validate
    def p_validate():
        rc, out = sh([PY, str(HERE / "omega_validate.py"), "--manifest", str(manifest)] + (["--tokens", a.tokens] if a.tokens else []), log)
        print(out.strip())
        if rc != 0 and not a.force:
            raise RuntimeError("validation errors; fix the manifest or pass --force for a draft")
        return "contract ok" if rc == 0 else "errors (forced)"
    phase("validate", p_validate)

    # 15 build
    def p_build():
        dest = a.out or str(Path.cwd() / f"omega-{domain}.html")
        cmd = [PY, str(HERE / "omega_build.py"), "--manifest", str(manifest), "--out", dest]
        if a.fragment:
            cmd.append("--fragment")
        if a.system_fonts:
            cmd.append("--system-fonts")
        if a.name_on_page:
            cmd.append("--name-on-page")
        if a.tokens:
            cmd += ["--tokens", a.tokens]
        if a.force:
            cmd.append("--force")
        rc, out = sh(cmd, log)
        print(out.strip())
        if rc != 0:
            raise RuntimeError(out.strip()[-400:])
        return dest
    phase("build", p_build)

    print(f"done in {time.time() - t0:.0f}s; manifest {manifest}; fetches used {fetches_used(cache)} of {a.budget}; log {cache / 'omega_run.log'}")
    if blocked:
        print("blocked phases: " + "; ".join(f"{b['surface']} ({b['why'][:80]})" for b in blocked))
    print("Next: write analysis, exposure dispositions, the brand read and the playbook into the manifest, then rerun with --build-only.")
    print(f"Platform: python3 scripts/omega_platform.py pack --cache {a.cache} --latest --out omega-pack.json && python3 scripts/omega_platform.py build-app --pack omega-pack.json")


if __name__ == "__main__":
    main()
