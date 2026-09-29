# The platform: one app for every run, the Radar behind every agency lens

OmegaWeapon 2.0 is a skill and an app. The skill reads a domain and builds its dashboard; the app (`OmegaWeapon`, a
Chrome extension and a standalone HTML page built from the same sources) hosts every dashboard beside the Agency Radar
and the Horus edition, and hands the next targets back to the skill. Nothing in the app fetches: every byte ships
inside it, its content security policy forbids network connections, and every number on it was computed by the
engine that built the page it hosts.

## The three wings

| Wing | Holds | Source of truth |
|---|---|---|
| Agency Radar | The tracked digital marketing companies (222 US and European agencies at edition 2026.09a): dossier, capability scores with evidence, clients, paid and social capture, gaps on their own house, the Horus read per agency (tailwind index, Solar Arc, scenario fit, money rails, moves P1 to P8, say and do), the Monsoon read per agency (offshore delivery exposure), the Anubis dossier per agency (the computed spine for all, the written weighing where one exists) | `assets/radar/radar.json`, the registry; the Horus layer recomputed by `scripts/radar_horus.py`, the Monsoon layer by `scripts/radar_offshore.py` from `assets/radar/offshore_model.json`, the needs layer by `scripts/radar_needs.py`, the dossiers by `scripts/radar_dossier.py` from `assets/radar/dossiers/` |
| Horus | The digital marketing edition: headline, BLUF, key judgments with falsifiers, discourse findings, Stereopsis per topic, the Nilometer, scenarios, indicators, the graveyard | `assets/editions/digital-marketing-2026-09.*` (the same files every run's Market tab attaches) |
| Targets | Every OmegaWeapon run: one dashboard per domain, hosted whole in an isolated frame running `assets/omega_dashboard.js`; the target's facts, the agency of record with its Radar dossier, momentum across runs, the queue | The run manifests in `omega_cache/<domain>/runs/`, packed by `omega_platform.py pack` |

The wings join by identity, never by arithmetic: a target's agency of record is matched to a Radar agency by domain
(exact host or a subdomain), then by exact normalised name; a target whose own domain is a tracked agency is that
agency's self-side run. The Radar never grades a target and a target never moves a Radar score.

## The loop

```
queue                the app: popup "Queue this site for the Omega", right-click "Queue this site", or the Targets wing form
   -> omega-queue.json                    exported from the Targets wing (Download JSON)
run                  python3 scripts/omega_platform.py queue --file omega-queue.json --ua "$OW_USER_AGENT" --tokens "..." --run
                     (or the printed omega_run.py commands, one per domain, each with its archetype and question)
analyse              the analyst's pass and the analysis of record, as always, into the manifest; --build-only rebuilds
pack                 python3 scripts/omega_platform.py pack --cache omega_cache --latest --out omega-pack.json
                     (validates every manifest, measures momentum, resolves the agency of record against the Radar)
publish              python3 scripts/omega_platform.py build-app --pack omega-pack.json --out dist
                     dist/omegaweapon-chrome (reload the unpacked folder), dist/omegaweapon-chrome.zip, dist/omegaweapon.html
   or import         the Targets wing accepts omega-<domain>.html or omega-pack.json straight from disk (persists in that browser profile)
```

`omega_run.py` runs the `radar` phase after `ingest` on every run (local, no fetch): the agency of record read from the
footer credit, RDAP or the shared tag stack is matched against the registry and, when it matches, the dossier block
(`modules.agency.of_record.radar`) rides along into the manifest and onto the page's Agency lens tab as observed
context, with a link that the app resolves to the Radar dossier. A standalone page carries the same card without the
link. When the target itself is a tracked agency, `target.radar_id` is set and the run lands on that agency's Omega tab
as its own house.

## What the app shows for a target

The Targets view lists every hosted run (business, domain, archetype, overall grade, pillars at D or F, CONFIRMED
count, findings, agency of record with its Radar band, run date and tier), with import and export (a pack, a CSV), the
queue, and coverage tiles. A target page carries the head (the twelve pillar grades, the honest count, momentum
against the previous run, the headline, the agency of record with links to its Radar dossier and its audited book),
the dashboard's own tab rail, and the frame. The frame is the built page: same engine, same payload, same numbers; the
host passes the payload in with `postMessage` and the page answers with the tab it landed on and any Radar link
clicked. Focus hides the app around the frame. Earlier runs of the same domain are held beside the latest.

On a Radar dossier the Omega tab shows the agency's own run (or the button that queues it, archetype `agency`), the
client sites the Omega attributed to it (overall, Agency Fit, inherited share, CONFIRMED, run), and the inherited
pattern across that book: the findings tagged inherited in `modules.agency.inherited_vs_owned`, counted by title across
targets. A pattern at two or more sites is a template fix and the reverse Justice run is the offer.

## The pack

`omega-pack.json`: `{omega_pack: 2, generated, doctrine_date, radar_compiled, edition, n, targets[]}`; each target is
`{summary, payload}` where `payload` is exactly what `omega_build.py` injects into a page (validated; momentum measured
against the latest earlier run in the same cache folder) and `summary` is the listing row (`key`, `domain`, `business`,
`archetype`, `run_id`, `run_date`, `tier`, `overall`, `scorecard`, `failing[]`, `honest{}`, `findings{}`,
`coverage{}`, `agency{name, domain, confidence, radar_id, radar_band, radar_hti, inherited_share}`, `radar_id`,
`headline`, `momentum`, `demo`). A demo fixture packs with `demo: true` and shows a badge; it is never shipped in a
build for anyone else. Several packs merge in `build-app`; the newest run per domain wins and older runs are held.

## The registry and its Horus layer

`assets/radar/radar.json` is the Radar as data: `meta` (compiled date, counts, the fifteen capability dimensions),
`agg` (the aggregates the Pulse and the list views draw), `agencies[]` (the records), `horus` (`edition`, `model`, the
`field` summary). `scripts/radar_horus.py` recomputes the per-agency read from a record and the edition through the
model tables (crosswalk, key-judgment exposure, scenario fit, rails, patterns); `check` reports agreement with the
shipped layer (the arithmetic: tailwind, band, arc, tilt, Stereopsis, resilience and best fit reproduce for 201 to 209
of 209 read agencies; the text detections behind moves and say-and-do reproduce for about 190). `omega_platform.py
radar-upsert --file agency.json` adds or updates a record (id, name, domain, region, segment, archetype, strategy 0 to 3
per dimension with `strategy_evidence`, the paid and social captures, `llms_txt`, `ai_bots_blocked`, `content_90d`,
`sitemap_urls`, `gaps[]`, `sources[]`), recomputes its read and the aggregates, and marks the registry compiled today;
`radar-agg` recomputes the aggregates alone; `radar-csv` exports the Radar with its Horus columns and seven Omega
columns (own run and overall, audited targets and their count, mean inherited share, CONFIRMED across targets, last
run). A new edition lands in `assets/editions/` and `radar.json["horus"]["edition"]`; then `radar_horus.py rebuild
--write` and `build-app`.

Adding an agency to the Radar is a research job, not a fetch job: the record's capability scores carry an evidence note
and URL each, and the Radar's own limits (first-page ad floors, Meta and TikTok libraries unreachable, keyword-coded
voice) apply to every row. The honest way to add one is a Justice-style read of its public record; the fast way is the
skill's own run on its domain (archetype `agency`), which the app then shows as its own house.

## The Monsoon read (the Offshore wing)

A fourth read on every tracked agency: how much of its sold work can be delivered from an offshore hub over three
years, and where it would go. `scripts/radar_offshore.py` computes it from `assets/radar/offshore_model.json` and the
record; the app shows it on the Offshore view and on each dossier's Offshore tab; the CSV carries it as the
`monsoon_*` columns; a run manifest's Radar block carries the agency of record's index and band.

The arithmetic: base = sum over capabilities of (share of the sold mix x offshorability 0 to 3 / 3 x labor intensity x
100); migration = base plus the terms that let the agency move its own delivery (holding-company, consultancy, listed
or private-equity ownership; a thousand people or more; an office or a job posting in a hub economy; global-delivery
language in its own words; minus fifteen when the agency is itself the nearshore); displacement = base plus the terms
that let an offshore-delivered rival take the client (small-business or local clients, a price-led segment, published
hourly rates, white-label language; minus for enterprise clients and outcome pricing); the index is the mean of the
two, banded Landfall (70 and up), Onshore wind (55), Breeze (40), Doldrums. The shore split follows the home market's
language (South and Southeast Asia first for English markets, Eastern Europe for the German-speaking and English-
fluent ones, the francophone hubs for France, Latin America for Spain and as the United States' nearshore) and tilts
toward any observed footprint. Every term carries observed or inferred; the automation overlap (paid search and paid
social, where the platforms absorb the hours first) is reported beside the index, never netted. The hub economies'
figures (Philippine IT-BPM 2025 actuals and the 2028 roadmap, India FY2026, Pakistan's freelancer exports, the H-1B fee
and the India hiring shift) sit in the model as graded signals with their sources. Absence of evidence is not evidence;
the read is labor economics on a sold mix, never a statement about any person.

## Anubis (the Dossier tab, the book)

The fifth read is the whole weighing of one agency: what it is doing and focusing on, its clients and what they came
for, its own house, the market read, where it can be beaten, what to watch. `references/anubis.md` is the doctrine;
`scripts/radar_dossier.py` is the engine. Two layers feed it.

The needs layer (`scripts/radar_needs.py`, taxonomy `assets/radar/needs.json`, codes N0 to N12) reads every client
engagement on the record: a case study title (when the agency's deep record has one that names the client, including a
parenthetical trade name), else the URL slug, else the evidence type. A client with no readable engagement is N0,
"named only", and counts for nothing in the need mix; the mix is evidence weighted (case study 1.0, press release 0.9,
award entry 0.8, slug 0.7, testimonial 0.6, logo 0). Clients that appear on more than one tracked agency's book are
"shoppers" and the dossier links them across. The verticals come from the record.

The spine (`radar_dossier.py spine --write`, `--briefs DIR` to also write a writer brief per agency) is computed for
every agency: identity, positioning, the sold mix with an evidence note and URL per capability, moves, dated news and
case studies, jobs, verticals, the needs read, the house tests (say and do, gaps, ads, tag stack, sitemap cadence),
the Horus and Monsoon reads, openings computed by rules with an evidence class each, the watch list from the edition's
indicators, and an evidence index. The narrative is written from the spine and nothing else: bluf, doing, clients,
house, market, openings, watch (a list), stored as `assets/radar/dossiers/<id>.json`. `validate [--fix]` refuses any
figure, name or URL not in the spine, any dash, filler phrases, and sections under their minimum length; `merge
--write` folds the clean narratives into the registry under `dossier.text` and stamps `radar.dossiers`; `book --out
FILE` prints the book (part one the ten most prominent, part two the other written, part three spines only;
`--written-only`, `--ids a,b`, `--top N`).

The app shows the Dossier tab on every agency (the bluf callout also opens the Overview): the spine's tables, the
narrative where written, the need mix, the shoppers, the clients table with the need read per client and "also with"
links, the say and do table, the openings with their evidence class, the watch list, the evidence chips; Download MD
and Copy MD export one dossier as markdown. A spine only dossier says so at the top and stays complete on its figures.

Deepening a record (`scripts/radar_deepen.py`) is how a names only book gets its engagement evidence before the next
narrative: `missing` lists the agencies without a deep record, most prominent first; `fetch <id>` runs one honest
wetware session on the agency's own domain (robots.txt obeyed, at most 40 sitemap files, at most --max-pages pages:
the newest case studies, the newest news, the careers and about pages; nothing fetched twice); `ingest <id> --write`
parses the cache into the record's `deep` block (case studies with dates, excerpts and the client name when the title
carries one; dated news; jobs and the ATS; recent blog dates) and `--add-clients` appends the case study clients as
"case study" evidence; `run` does both. Then `radar_needs.py rebuild --write`, `radar_dossier.py spine --write`, and
the Anubis pass for the narrative. Never a third party source, never a connector: the record deepens from the agency's
own words only, and every added line carries its URL. The client name is read from the case study title with
precision over recall: labels ("Case Study", "Caso de exito", "Client Spotlight", "kundecase") and work words
("Influencer Campaign", "SEO", "Website Rebuild") are stripped, "strategy for Client" takes the client, and sector
index pages, archive pages, error pages, award lines and headlines in any language are refused; a name already on the
record under a corporate suffix ("Haier" beside "Haier Europe") is not added twice. A missed name leaves a case study
unnamed; a wrong name would pollute the needs read, so the rules lean to missing. The ATS is read from the careers
page's own links (the board id from the subdomain, the path or the embed query).

Budget: the narrative is the expensive part. Write the most prominent agencies first, one agency per writer call, keep
every clean narrative from earlier passes, and stop where the budget says; the tab and the book handle the rest.

## Build contract

`assets/app/` is the app's source: `manifest.json`, `app.html`, `sidepanel.html`, `popup.html`, `background.js`,
`js/app.js` (the app), `js/popup.js`, `js/panel-mode.js`, `css/app.css`, `css/popup.css`, `css/fonts.css` with the
bundled IBM Plex and Zilla Slab faces (SIL OFL), `icons/`. `build-app` copies it to `dist/omegaweapon-chrome/` and
writes the generated files: `js/data.js` (`window.RADAR`), `js/index.js` (`RADAR_INDEX`, `RADAR_INDEX_META`,
`OMEGA_INDEX` for the service worker and the popup), `js/targets.js` (`window.OMEGA_TARGETS`, the pack), `js/omega-
dashboard.js` (the engine, unchanged), `css/omega.css` (the dashboard template's stylesheet with its web fonts mapped
onto the bundled faces) and `omega-frame.html` (the template's markup; loads the engine, waits for the payload). The
standalone `dist/omegaweapon.html` inlines the same sources, with the frame's stylesheet, markup and engine held in
inert text blocks that the page turns into a `srcdoc` frame. Every JSON payload is escaped so it cannot close its
script element; every data string enters the DOM as a text node; links are limited to http(s).

Extension permissions: `storage` and `unlimitedStorage` (watchlist, notes, compare set, theme, the queue; imported
targets in IndexedDB), `activeTab` (the popup reads the current tab's address), `sidePanel`, `contextMenus`; `tabs` is
optional and only for the badge and the following side panel. The page CSP allows frames from the extension itself and
nothing from the network. Shortcuts: Alt+Shift+R the popup, Alt+Shift+D the app, Alt+Shift+T the Targets wing; the
address bar keyword is `omega`.

## What the platform never does

It never fetches, never runs a connector, never phones home, never records a reviewer or a poster, and never puts an
operator mark on a hosted dashboard: the app is the operator's cockpit and is not a client deliverable; the page inside
the frame is the client's and stays neutral (`--name-on-page` remains opt-in on the standalone build). A dashboard
exported from the app is the same file the builder wrote.
