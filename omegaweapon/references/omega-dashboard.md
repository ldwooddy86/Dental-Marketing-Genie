# The dashboard: one page per target domain

`scripts/omega_build.py` turns a run manifest into one self-contained HTML page, `omega-<domain>.html`. The page carries
its data as inert JSON, draws everything with the dashboard engine (`assets/omega_dashboard.js`, inlined at build), and
makes no network call except the optional Google Fonts stylesheet (`--system-fonts` drops it). The same engine runs
inside the OmegaWeapon app's frame, where it receives the payload by message instead of reading it inline, so a hosted
dashboard and a standalone page are the same code drawing the same numbers (`omega-platform.md`). It is brand-neutral: the masthead names the business and, when a recipient is
set, "Prepared for <recipient>"; no operator mark anywhere, and the OmegaWeapon label appears only with `--name-on-page`.

```
python3 scripts/omega_validate.py --manifest omega_cache/<domain>/runs/<run>.json [--tokens "Operator,alias,operator.com"]
python3 scripts/omega_build.py --manifest omega_cache/<domain>/runs/<run>.json --out omega-<domain>.html [--system-fonts]
python3 scripts/omega_build.py --manifest ... --fragment --out omega-<domain>.html      # for artifact hosts that add their own skeleton
python3 scripts/omega_run.py <domain> --archetype <id> ...                              # the whole pipeline, fetch to page
```

The builder recomputes every metric, validates the contract and refuses to build on errors (`--force` for drafts only,
never for delivery). It measures momentum against the latest earlier run of the same target in the same folder.

## Tabs

| Tab | Shows | Built from |
|---|---|---|
| Brief | Headline, BLUF, Win / Watch / Next, the coverage strip (tier, presence, every module's status, blocked lanes, exports supplied and wanted), the twelve-pillar scorecard with confidence, the three that matter (the rival, the paid opportunity, the exposure), the honest count, key judgments with ICD 203 bars, momentum since the previous run, the judgment calls | analysis, run, metrics |
| Site and crawl | Index status of fetched pages, crawl summary tiles, click depth, the per-URL crawl table (money pages first), sitemaps, the mobile render check (raw vs rendered words), Googlebot verification, the Technical section: Core Web Vitals, tag inventory with pre-consent flags, bot posture, headers, redirect map; findings for both modules | modules.crawl, modules.technical, findings |
| Content | Top pages with the five-lens facts, the demand map (Autocomplete presence, no volumes), the copy gate (passes, readability, flags for an attorney or the owner), drop-in titles and descriptions | modules.content, modules.copy, playbook.on_page |
| Local | Pillar scorecard with evidence class per line, reviews client against rivals, the GBP audit, citation matrix, location pages, the listing-integrity screen with dispositions and controls | modules.local, metrics.reviews |
| Authority | Referring-domain stats, the DISAVOW / REVIEW / KEEP split, link rows, the link gap; no vendor authority score anywhere | modules.links |
| Competitors | Five-lens matrix with threat rank and "steal this", keyword gap, how the Competitive Position grade was made | modules.competitors, metrics.competitors |
| Paid | Competitive paid intel with evidence class per row, swipe file, the own-account audit (or the plain statement that it needs exports), search terms and the paste-ready negatives block, conversion actions, landing pages, auction insights, budget scenarios labeled as estimates, LSA | modules.paid |
| Social | Organic baseline table, social paid intel, the own-account audit, measurement spine, creative ledger, audience map, creator compliance | modules.social |
| AI visibility | Readiness, citable footprint (client against rivals), the prompt tracker (screenshots are the evidence), brand facts consistency, assistant referrals as a floor, the llms.txt draft | modules.ai, metrics.ai |
| Apps | App inventory, ASO audit, keyword proxy, store reviews with burst signals, deep links, app measurement, campaigns, vitals | modules.apps |
| Exposure | The honest count tiles, the disposition primer, the filterable exposure table (rule and cite with fetch date or vintage flag, verbatim evidence with link, disposition, confidence, severity, base rate, control or open question, route and channel), controls applied, clause coverage, platform inventory, consent and trackers page by page, accounts a report would name, NOT OBSERVABLE (mandatory) | exposure, modules.exposure, metrics.honest_count |
| Agency lens | The agency of record with its evidence and confidence and, when it is a tracked agency, its Radar dossier (Horus read, say and do, gaps, a link the app resolves to the dossier), inherited against owned with the Agency Fit grade, the shared measurement layer, the claims screen, outreach infrastructure, the Pattern Verdict when Justice ran, what agencies are selling against what the floor says works, self-audit tickets | modules.agency, metrics.scorecard |
| Market | Brand Stereopsis (diverging bars per topic with counts and z), what customers raise and the brand ignores, what the brand claims with no echo, complaint share and stance, clusters, frames, the brand ledger with filters, the industry read (top topics per eye, industry Stereopsis), the Nilometer with Admiralty grades, events and the watch calendar | modules.market, metrics.brand |
| Forecast | Key judgments in full with evidence and falsifiers, the scenario square, indicators, the 64th part, the graveyard test, moves tied to judgments, limitations | analysis |
| Playbook | Phases, the twelve moves, fixes as specs (drop-ins, JSON-LD blocks, redirects, content offensive, the per-channel spec lists), the task list in Asana order, the verify queue | playbook, tasks, verify_queue |
| Ledger | Every finding with filters (module, severity, evidence class, owner, search) and a link on every row; every source with its ladder rung and date; the glossary | findings, sources, glossary |
| Method | How to read the page (evidence classes, dispositions, no vendor scores, measurement and judgment kept apart, no guarantees), this run's scope and presence, module status, judgment calls, the grading constants and formulas, the Brand Stereopsis formula, the rebuild commands | run, target, metrics.grading |

A tab whose modules did not run is dimmed and labeled "not run" in the rail; it still opens and says what did not run
and why, because the absence is part of the result. Tabs deep-link with a bare anchor (`#exposure`).

## Design rules the template keeps

- Tokens first; light and dark themes follow the viewer; the layout holds at phone width with no sideways scroll (wide
  tables scroll inside their own frame).
- Grades are letters on colored tiles: A and B green, C amber, D and F red, NA and ? grey. Evidence chips: observed
  green, inferred amber, unverified grey. Dispositions: CONFIRMED red, CANDIDATE amber, CLEARED green. Gold is the brand's
  own voice (Sun eye), lapis is the floor (Moon eye), the accent color marks what can be clicked.
- Every data string enters the page as a text node; the JSON is escaped so it cannot close its script tag; links are
  allowed only for http and https and open in a new tab.
- Every finding row, exposure row and verify item carries the link to the page, listing, ad or app it is about.
- No em dashes and no emojis in any generated text (the validator refuses them in the manifest).
- Reviewer and poster names never appear; the brand ledger shows platforms, sources and titles only.

## Publishing

In a session with an artifact tool, build with `--fragment` and publish the file as a private page titled
"<Business>: digital position, exposure and market read". Republishing the same file path updates the same page. On a
local machine, open the full build in any browser; nothing else is needed. The page is the client's: it never carries
the operator's name, palette or logo, and `scripts/brand_sweep.py --tokens "<operator tokens>" omega-<domain>.html` is
the gate before it leaves (zero hits).

## Exports beside the page

The dashboard is the primary deliverable. When the person wants files, the manifest feeds them without a second pass:
`tasks[]` is the Asana CSV; `modules.links.rows` is the DISAVOW / REVIEW / KEEP workbook and `domain:` lines file;
`exposure[]` is the Satchel workbook's FINDINGS tab; `findings[]` and the module tables are the Reckoning workbook's tabs
(`scripts/build_workbook.py` takes a JSON spec built from them); the Book (docx to PDF) follows the UltimaWeapon Finale
and quotes the same numbers. Every export is swept for operator tokens and metadata before it ships.
