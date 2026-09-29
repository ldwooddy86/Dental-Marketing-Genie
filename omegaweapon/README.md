# OmegaWeapon.Skill 2.0

One domain in, three lenses out, one dashboard per target, one app for all of them. The doctrine is `SKILL.md`; the
contract is `references/omega-manifest.md`; the page is `references/omega-dashboard.md`; the platform (the app, the
Agency Radar registry, the pack, the queue) is `references/omega-platform.md`.

## Install

Unzip the folder where your skills live (or upload the zip and unzip it into the working folder). Nothing else to
install for a Tier 0 run: the engine is pure standard library; the render passes need Playwright with Chromium
(`pip install playwright && playwright install chromium`); `openpyxl` only for workbook exports.

Set the declared identity once per machine:

```
export OW_USER_AGENT="OmegaWeapon/2.0 (+https://<your contact URL>)"
```

## Quickstart

```
# a bare domain to a Tier 0 dashboard
python3 scripts/omega_run.py example.com --archetype local-service --business "Example Co" --recipient "Example Co" \
    --geo "Frisco, TX" --jurisdiction US-TX --seeds "plumber frisco,water heater repair frisco" --follow-links \
    --tokens "<your operator names, aliases, domains>" --out omega-example.com.html

# the analyst's pass: open omega_cache/example.com/runs/<run>.json, work the modules, write the analysis and playbook

# validate and rebuild (also next month, with a new run id: the Brief measures the change)
python3 scripts/omega_validate.py --manifest omega_cache/example.com/runs/<run>.json --tokens "..."
python3 scripts/omega_build.py --manifest omega_cache/example.com/runs/<run>.json --out omega-example.com.html

# publish to the platform: pack the latest run of every target, rebuild the app (extension + standalone page)
python3 scripts/omega_platform.py pack --cache omega_cache --latest --out omega-pack.json
python3 scripts/omega_platform.py build-app --pack omega-pack.json --out dist

# run the queue the app exported (one omega_run per domain, with its archetype and question)
python3 scripts/omega_platform.py queue --file omega-queue.json --ua "$OW_USER_AGENT" --tokens "..." --run

# the Radar registry: check the Horus layer, rebuild the Monsoon (offshore exposure) layer, add or update an agency, export the CSV
python3 scripts/radar_horus.py check
python3 scripts/radar_offshore.py rebuild --write
python3 scripts/omega_platform.py radar-upsert --file agency.json
python3 scripts/omega_platform.py radar-csv --pack omega-pack.json --out agency_radar_horus.csv

# Anubis, the dossiers: the needs read, the computed spine (and a writer brief per agency), validate, merge, the book
python3 scripts/radar_needs.py rebuild --write
python3 scripts/radar_dossier.py spine --write --briefs briefs/
#   the writer returns assets/radar/dossiers/<id>.json from briefs/<id>.md (rules: references/anubis.md)
python3 scripts/radar_dossier.py validate --fix
python3 scripts/radar_dossier.py merge --write
python3 scripts/radar_dossier.py book --out anubis-book.html          # --written-only, --ids a,b, --top 10

# deepen a names-only record from the agency's own site (bounded, honest), then recompute the layers it feeds
python3 scripts/radar_deepen.py missing
python3 scripts/radar_deepen.py run <agency-id> --write --add-clients
python3 scripts/radar_needs.py rebuild --write && python3 scripts/radar_dossier.py spine --write

# exercise the pipeline offline with the fixture (never ship it)
python3 scripts/omega_scaffold.py example.test --archetype local-service --demo
python3 scripts/omega_build.py --manifest omega_cache/example.test/runs/<today>a.json --system-fonts
```

Archetype ids: `local-service`, `multi-location`, `ecommerce-dtc`, `b2b-saas`, `marketplace-leadgen`, `publisher-media`,
`healthcare`, `legal`, `financial`, `real-estate`, `automotive`, `education`, `nonprofit-political`, `app-first`, `agency`,
`regulated-other` (`assets/archetypes.json`).

## What is inside

- `SKILL.md`: the Articles, the fetch ladder, the archetypes, the router, the run, the fallbacks.
- `references/omega-*.md`: the manifest contract, the dashboard, the three lenses, the agency lens, the platform.
- `references/` (UltimaWeapon, unchanged): reckoning, justice, satchel, codex, digital-marketing-overlay, legal-content
  and its four references, google-crawler, the six Arsenal doctrines, bane, wetware.
- `references/horus-*.md` (Horus, unchanged): doctrine, collection, codebook, metrics, nilometer, analysis, schema,
  nomes, dashboard, connectors.
- `scripts/omega_*.py`: run, scaffold, ingest, metrics, validate, build, platform (resolve, pack, build-app, queue,
  radar-csv, radar-upsert, radar-agg); `scripts/radar_horus.py` recomputes the Horus layer on the Radar,
  `radar_offshore.py` the Monsoon layer, `radar_needs.py` the needs read, `radar_dossier.py` the Anubis spines,
  validator, merge and book, `radar_deepen.py` the bounded fetch that fills a record's engagement evidence. Every
  UltimaWeapon tool and the Horus engine beside them; `collector/` is Horus's read-only collector.
- `references/anubis.md`: the dossier doctrine (the spine, the seven sections, the validator, the writer's rules).
- `assets/`: archetypes, brand topics, grading constants, the 22 nomes, the digital marketing edition, the dashboard
  template and its engine (`omega_dashboard.js`), the Agency Radar registry (`radar/radar.json`) with the Monsoon model
  (`radar/offshore_model.json`), the needs taxonomy (`radar/needs.json`) and the written dossiers (`radar/dossiers/`),
  the app sources (`app/`).

## The app

`dist/omegaweapon-chrome/` loads unpacked at chrome://extensions (Developer mode, Load unpacked); `dist/omegaweapon.html`
is the same app as one file. Four wings: the Agency Radar (222 agencies with their Horus reads and, on each, the
Anubis Dossier tab: what it is doing, its clients and their needs, its house, the market read, where it can be beaten,
what to watch, with a markdown export), Horus (the edition),
Offshore (the Monsoon read: how exposed each agency's sold work is to offshore delivery, South and Southeast Asia
first, with the two mechanisms, the shore split, observed footprints and the hub economies' hard numbers), Targets
(every OmegaWeapon dashboard, hosted whole, with the agency of record linked to its Radar dossier and each agency's
audited book on its Omega tab). The popup reads the site you are on (a tracked agency, an audited target, or a
domain to queue); the queue exports for the skill; a built page or a pack imports straight into the Targets wing.

Rules that never bend: no Ahrefs and no connector of any kind; honest fetch by default; brand-neutral output; every
number computed from the manifest; every finding linked and classed; CONFIRMED only with a fetched or vintage-flagged
cite; no private individuals in any read.
