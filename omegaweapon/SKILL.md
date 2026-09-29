---
name: "omegaweapon"
description: "OmegaWeapon.Skill (v2.0): the last letter, now a platform. UltimaWeapon (Reckoning, Justice, EmergencySatchel + Codex, Counsel, the Google Crawl, six doctrines) fused with Horus (two-eyes discourse read, Nilometer, ICD 203 forecasting) and with the Agency Radar (222 US and European digital marketing agencies with a Horus read each), around one primitive: point it at ANY domain and it auto-builds a self-contained dashboard for that domain, reading the business (site, local, links, rivals, paid, social, AI search, apps, compliance), the digital marketing company behind it (agency of record matched to the Radar, inherited vs owned defects, claims, shared tag stack, what it sells vs what the floor says works) and the market (Brand Stereopsis, graded hard signals, 90-day forecast). Every dashboard is hosted in the OmegaWeapon app (Chrome extension + standalone HTML) beside the Radar and the Horus edition; the app queues the next targets. Honest fetch, no connectors (never Ahrefs or any MCP tool), brand-neutral, every number computed. Anubis, the dossier engine, weighs every tracked agency from its own record (what it is doing and focusing on, its clients and what they came for, its own house, the market read, where it can be beaten, what to watch) into a Dossier tab, a markdown export and a printable book. Use for 'omegaweapon', 'run the omega', 'dashboard for <domain>', full/master audits, agency teardowns, the Agency Radar, 'dossier on <agency>', 'what are they doing and who are their clients', compliance screens, SEO/paid/social/app audits, brand or review sentiment reads, monthly re-runs, 'rebuild the app', 'add <agency> to the Radar'."
---

# OMEGAWEAPON: one domain in, three lenses out, one dashboard per target, one app for all of them

Point it at a domain. It reads the business the way the Weapon always has (the crawl, the render, the demand map, the
citable footprint, the local pack, the links, the rivals, the ad libraries, the store listings, the compliance web
layer), reads the digital marketing company behind the business (who built it, what they shipped, what they claim, what
they sell against what the practitioner floor says works), and reads the market around it (what the brand says about
itself against what customers say, weighed against hard signals, forecast in ICD 203 language). Then it builds one
self-contained dashboard for that domain, `omega-<domain>.html`, from one run manifest, with every number computed and
every claim carrying its source, its date and its evidence class. Feed it exports and screenshots and the same page
sharpens; run it again next month and the page measures the change.

**Lineage.** Bane wrote the constitution (integrity, evidence classes, brand neutrality, the 90-day playbook).
Reckoning rebuilt it to run on no connector. Justice turned it on the agencies that build everyone's sites.
EmergencySatchel and its Codex put every ad, account, website and app in front of the policies and laws that get things
pulled, suspended and reported. Counsel made the copy pass safe for law firms. MagnumOpus ran them as one piece;
MagnumOpusBeta made the fetch honest and added the Google Crawl; UltimaWeapon fused both and added the Arsenal's six
doctrines. Horus, built for whole industries, contributed the two-eyes method (broadcast against floor), the Nilometer of
graded hard signals, the analysis of record with falsifiers, the edition files that let the next run measure momentum,
and the pattern of a dashboard engine that recomputes every number from a validated contract. OmegaWeapon takes all of
it and changes the shape of the output: the deliverable is a dashboard per domain, the record is a manifest per run, and
the read is always three lenses at once. Version 2.0 makes it a platform: the Agency Radar (the 222 tracked agencies,
each with a Horus read) is now the registry behind the agency lens, and every dashboard is hosted whole in the
OmegaWeapon app, a Chrome extension and a standalone page built from the same sources, which in turn queues the next
targets for the skill (`references/omega-platform.md`).

**Files.** This file (the doctrine and the router). `references/omega-manifest.md` (the contract every script reads),
`references/omega-dashboard.md` (the page: tabs, rules, publishing), `references/omega-lenses.md` (the three lenses, the
Brand Stereopsis protocol, the company Nilometer, forecasting a business), `references/omega-agency-lens.md` (what
digital marketing companies are doing, as a protocol), `references/omega-platform.md` (the app, the Radar registry, the
pack, the queue, the build contract), `references/anubis.md` (the dossier doctrine: the spine, the seven sections, the
validator, the writer's rules). The UltimaWeapon references, unchanged and read at the moment the
router names them: `reckoning.md`, `justice.md`, `satchel.md` + `codex.md` + `digital-marketing-overlay.md`,
`legal-content.md` + `bar-advertising.md` + `legal-currency.md` + `verification-playbook.md` + `editorial-standards.md`,
`google-crawler.md`, the Arsenal (`local-seo.md`, `technical-seo.md`, `ai-seo.md`, `paid-media.md`, `social-ads.md`,
`apps.md`), `bane.md`, `wetware.md`. The Horus references, prefixed: `horus-doctrine.md`, `horus-collection.md`,
`horus-codebook.md`, `horus-metrics.md`, `horus-nilometer.md`, `horus-analysis.md`, `horus-schema.md`, `horus-nomes.md`,
`horus-dashboard.md`, `horus-connectors.md`. Assets: `assets/archetypes.json` (the archetype table as data),
`assets/brand_topics.json` (the Brand Stereopsis codebook), `assets/grading.json` (every grading constant, printed on the
Method tab), `assets/nomes.json` (Horus's ten media nomes plus twelve client vertical packs), `assets/editions/` (the
digital marketing nome's complete first edition; new editions land here), `assets/omega_template.html` (the domain
dashboard's stylesheet and markup) with `assets/omega_dashboard.js` (the dashboard engine, one file shared by the
standalone page and the app), `assets/dashboard_template.html` (Horus's industry dashboard), `assets/radar/radar.json`
(the Agency Radar registry: 222 records, aggregates, the Horus model tables and the per-agency layer, the Monsoon layer,
the needs layer, the Anubis spine per agency and the written narrative where one exists),
`assets/radar/offshore_model.json` (the Monsoon model: offshorability, shores, structural terms, graded signals),
`assets/radar/needs.json` (the client needs taxonomy N0 to N12 with its evidence weights), `assets/radar/dossiers/<id>.json`
(the written narratives, one file per agency, the source of truth the registry is merged from), `assets/app/`
(the app's sources: manifest, pages, service worker, popup, styles, bundled fonts, icons). Scripts: the OmegaWeapon
engine (`omega_run.py` the orchestrator, `omega_scaffold.py`, `omega_ingest.py`, `omega_metrics.py`,
`omega_validate.py`, `omega_build.py`), the platform (`omega_platform.py`: resolve, pack, build-app, queue, radar-csv,
radar-upsert, radar-agg; `radar_horus.py`: the Horus layer on the Radar, check and rebuild; `radar_offshore.py`: the Monsoon layer, offshore delivery exposure per agency; `radar_needs.py`: what each client came for, from the engagement evidence; `radar_dossier.py`: Anubis, the spine, the writer briefs, the validator, the merge and the book; `radar_deepen.py`: a bounded honest fetch of one agency's own sitemap and pages to fill the engagement evidence the dossier weighs), every UltimaWeapon tool (`wetware.py`, `google_crawler.py`, `justice_fetch.py`, `justice_dns.py`,
`justice_psi.py`, `justice_schema.py`, `satchel_web.py`, `satchel_render.py`, `satchel_app.py`, `classify_links.py`,
`timing_sweep.sh`, `legalscan.py`, `legaldocx.py` + `legal_rules.json`, `build_workbook.py`, `brand_sweep.py`) and the
Horus engine (`horus_scaffold.py`, `horus_prefilter.py`, `horus_kappa.py`, `horus_metrics.py`, `horus_validate.py`,
`horus_build.py`) with its read-only `collector/`. If `scripts/` or `assets/` are missing next to this file, find
`OmegaWeapon.skill` among the user's files or ask for it; never rewrite the engine from memory.

## Articles of the Weapon (read first, apply everywhere)

**Integrity: the numbers answer for themselves.** Never invent a number. Every metric traces to a named source with a
date, and the source's label names it ("GSC impressions, 16 mo", "Autocomplete presence", "render probe lab,
2026-09-28", "Ads Manager export, 90 d", "screenshot (user-captured 2026-09-20)"), never a bare "Volume" or "Traffic".
Three evidence classes on everything: **observed** (fetched, measured, exported, screenshot), **inferred** (pattern-based,
flagged as such), **unverified** (needs access you lack; it becomes a verify task with the exact URL and procedure, never
an assertion). Unverified evidence never moves a grade; it lowers confidence. Data limitations sit on the first screen.
No proprietary authority scores: DR, DA and AS are vendor estimates and never appear in a grade or a sentence; authority
is referring domains, link quality, brand footprint and tenure. Vendor keyword volumes, CPCs, download estimates and
"AI visibility" indices carry the label wherever they appear. Grades are computed from the manifest by
`omega_metrics.py` with the constants in `assets/grading.json`; an analyst may override a pillar with a stated why and
the computed grade stays beside the override. Every module names what is already working. Outcomes are never
guaranteed; projections are hedged ranges labeled estimates with their assumptions listed. Vendor monetary fields may be
in cents; sanity-check magnitudes before they touch the page.

**Measurement and judgment never blur.** Shares, gaps, grades, counts and the honest count come from code. Likelihoods,
stages, scenarios and moves are judgments, in ICD 203 language (almost no chance 1 to 5 percent; very unlikely 5 to 20;
unlikely 20 to 45; roughly even chance 45 to 55; likely 55 to 80; very likely 80 to 95; almost certain 95 to 99), with a
confidence word grading the evidence separately and at least one observation that would prove each judgment wrong. The
validator refuses a key judgment without a range that matches its term, a horizon, evidence refs and a falsifier.

**Evidence discipline: accusations are expensive.** Anything that reads as an accusation against a named business (a
rival's listing, an advertiser's claim, an agency's practice, a creator's undisclosed post) ends as exactly one of
**CONFIRMED** (evidence quoted, maps to a rule clause that was fetched or vintage-flagged, survived the controls,
verified adversarially), **CANDIDATE** (real observation, innocent explanation still open; the row carries the open
question and what would settle it) or **CLEARED** (a control defeated it; it stays on the page bound to the control,
never silently deleted). Confidence (Confirmed, Plausible, Weak) and severity (High, Medium, Low) are separate axes;
CONFIRMED never rests on Weak evidence and never carries an open control. Verbs about the artifact ("displays", "resolves
to", "fires", "lists"), never "is guilty of". Absence of evidence is not evidence: "no ads found", "no license found",
"no reviews" and "not in the library" have innocent readings; report the literal outcome and the search you ran.
Infrastructure is not intent and a tag is not a campaign. Cite the rule you read, not the rule you remember: fetch the
live clause before it appears in a CONFIRMED finding, or carry the vintage flag and never a made-up section number.
Weight severity by enforcement base rate, not by how bad a clause sounds. A run is built to produce a small number of
findings strong enough to survive review; everything else is the client's competitive intelligence, held in-house, and
the honest count says so: "Fifty-two observations. Four CONFIRMED, three routable. Thirty-one CANDIDATE, held.
Seventeen CLEARED."

**Coverage is part of the result.** What a run could not see (blocked lanes, modules that did not run, exports never
supplied, the thin brand read, the NOT OBSERVABLE list) is on the first screen of the dashboard, not in a footnote. A
module that did not run is NA and says why; a partial read that could not be graded is ?. A blind fraction honestly
stated beats a confident fiction.

**No connectors: the Weapon stands on its own feet.** This skill NEVER runs Ahrefs. Not the connector, not one
endpoint, not "just the referring domains", not when it is attached and idle, not when it would be faster. The same ban
covers every other connector and MCP tool (`mcp__*` of any kind: Semrush, Moz, SpyFu, an ads API, a store API, Gmail,
Google Drive, Slack, Asana, Docs, anything) for any purpose. Never ask whether to use one, never list one as a data-tier
option, never frame "with Ahrefs" as an upgrade path. If the user offers, one sentence: OmegaWeapon does not run on
connectors; an export FILE they upload is welcome and ships labeled as the client's export or a vendor estimate. Tools
in scope, the whole list: the sanctioned web fetcher and web search, the bundled scripts, the public endpoints in the
fetch ladder, the local shell and file tools, and files the user uploads. A connector call that slips into a run has its
numbers struck and replaced with verify tasks.

**Colors: neutral, always.** No operator name, agency mark, palette or logo on the dashboard, any export, any chart,
any screenshot caption or any file's metadata. The masthead reads the business name and "Prepared for <recipient>" (the
client's own name is not branding); the OmegaWeapon label appears only with `--name-on-page`. There is no branded mode
and branding is not a Phase 0 question; a request for one is declined in one sentence with a pointer to a branded-report
skill if one exists. `omega_validate.py --tokens` refuses operator tokens in every client-facing string, and
`scripts/brand_sweep.py --tokens` sweeps every file before it ships; zero hits is the gate. The TARGET is named freely;
it is the subject, not the operator.

**Voice: plain English, no theater.** Written for an owner who is a plumber, a lawyer, a founder or a store manager,
not a marketer; every section opens with one sentence tying it to leads, revenue or risk; jargon only if the glossary
defines it; no em dashes, no en dashes and no emojis in any client-facing text (the validator refuses the dashes); green,
amber and red status coloring; no placeholder rows (cut the table instead); every finding, exposure row, verify item and
task carries a direct clickable link to the affected page, listing, ad or app; judgment calls (money-page choice, doorway
consolidation, disavow strictness, brand bidding, blocking AI training bots, whether to file a report at all, the
archetype, the presence mode) are presented as decisions with tradeoffs and listed in one block at the top of the
delivery; every internal link proposed in a content plan is verified against the live XML sitemap first. Correct
writing, flag law: the copy movement fixes grammar, artifacts, passive voice and reading level and FLAGS every legal
claim, figure, deadline, citation and disclaimer for an attorney; it never authors replacement law.

**Honest identity: every fetch declares itself (default).** Every bundled fetcher imports `scripts/wetware.py` in
honest mode: one truthful, configurable User-Agent (`OmegaWeapon/1.0 (+contact URL)`; set `OW_USER_AGENT` or pass
`--ua`; the shipped default carries a REPLACE placeholder that must be set before a run), a plain Python HTTP transport
(no TLS impersonation, no spoofed client hints, no fabricated referer, no stealth in renders), robots.txt obeyed for the
tool's own fetches (a disallowed path is recorded `ROBOTS_DISALLOWED`, not fetched), a per-host rate limit that honors
`Crawl-delay`, `Retry-After` honored with capped backoff, and a conditional on-disk cache so a re-run does not re-hammer
a host. The presence line reads DECLARED and sits on the Brief. Opt-in only: `--legacy-persona` runs the original
human-presence layer exactly as MagnumOpus shipped it (`references/wetware.md`; tiers H2, H1, H0), never extended and
never wired into the Google Crawl; the user must ask for it by name. Whichever mode ran, a WAF, human CAPTCHA, 403 or
proxy refusal is NOT_TESTED and is itself a finding.

**Fetch discipline: no storms, no workarounds.** Batch fetches per phase; cap a run at 40 to 60 page fetches unless the
user raises it (`--budget`; the orchestrator stops fetch phases at the cap and records them blocked); one sitemap fetch
beats ten page fetches; never fan subagents into parallel fetch storms; at most one subagent, the blind second coder for
a brand or industry read, with no web access; if the user says stop, finish with what was already approved. Never
bypass a wall: no proxies, IP rotation or residential networks, no mirrors, caches or archives as bypass, no borrowed
cookies or logins, no CAPTCHA solving, no Googlebot or other trusted-bot spoofing, no scraping behind a login, no fake
accounts, no self-bots, no joining rooms to read them. A wall becomes a verify task, a screenshot request, or a
local-pull line for the operator's own machine.

**Read-only, lawful routes, no private individuals.** The market read uses official APIs, public pages and the
operator's own sessions only; it never posts, joins, reacts, votes or follows. Reviewer and poster names are never
recorded (the brand ledger shows platforms, sources and titles; the collector stores salted pseudonyms). Practitioners
are recorded by role; public figures speaking for a platform may be named in the broadcast eye. The Weapon never builds
a profile of a person.

**The platform is the cockpit, not the deliverable.** The OmegaWeapon app is the operator's: it carries the operator's
name and is never handed to a client. What it hosts stays neutral: the page inside the frame is the file the builder
wrote, byte for byte the client's dashboard. The app never fetches and never phones home (its content security policy
forbids network connections); every number on it was computed by the engine that built the page. The Radar and a
target join by identity, never by arithmetic: the agency of record is matched to a tracked agency by domain, then by
exact name, and the match attaches the Radar dossier as observed context; the Radar never grades a target and a target
never moves a Radar score. Each run ends by packing and publishing to the app, or by telling the person how to import
the page, so the platform is never behind the work.

**Anubis weighs from the record, and writes what it can afford.** A dossier is two things that never blur: the spine,
computed from the agency's registry record by `radar_dossier.py` (identity, the sold mix with an evidence note per
capability, moves, case studies, clients with what the evidence says they came for, the house tests, the Horus and
Monsoon reads, the openings with their evidence class, the watch list, the evidence index), and the narrative, written
by the model from the spine and nothing else: seven sections, every figure and name and URL traceable to the spine or
the validator refuses it, no dashes, no filler, likelihoods in the ICD 203 words, a falsifier for every opening. The
spine is complete for every tracked agency the moment the registry is; the narrative is budgeted work. Write the most
prominent agencies first (the ten, then the next tier), one agency per writer call with local file I/O only, keep every
clean narrative from an earlier pass (`assets/radar/dossiers/` is the source of truth; `merge` never drops one), and
stop where the budget says. A dossier without a narrative says so on its tab and in the book and is still right on
every figure. When the client book is names only, deepen the record from the agency's own site before writing, never
from a third party; the needs read then says what the evidence says, and "inferred from the sold mix" where it does not.

**The counting rule.** Only items read from a defined frame (the money set, the blog hub, the review platforms named in
the frame, listing pages, channel pages, collector lanes) count toward a share. Topical search results are evidence for
the analysis, never counts.

**Incremental re-runs.** Everything lands in `omega_cache/<domain>/` (html, web, render, psi, schema, links, apps, dns,
google_crawl, google_render, search, screenshots, exports, market, `runs/` with one manifest per run,
`omega_run.log`). A re-run reuses the cache and fills only gaps or what the user names; never restart from zero when a
cache exists. The builder measures the new run against the latest earlier one and the Brief shows the change.

## The fetch ladder and the access tiers

Work down the ladder; record the rung each fact came from in `sources[].rung`. The full ladder with its tested rungs is
in `references/reckoning.md`; the short form: **1** web search for discovery only (results are a sample, never rank
data; the sanctioned fetcher reads the rule corpus and nothing that belongs to a target); **2** the raw fetcher under the
declared UA (`justice_fetch.py`, `satchel_web.py scan`, `google_crawler.py crawl`): status, headers, redirect chain, raw
HTML, JSON-LD, tag stack, GTM expansion, disclosure packs, footer credits, phones, app links, robots and ads.txt; **3** the
render probes (`satchel_render.py`: pre-consent request log, banner, dark patterns, screenshots; `google_crawler.py
render`: mobile, rendered against raw, lab timing) from this workspace's US vantage, so an EU consent posture read here
is NOT_TESTED unless the banner shows globally; **4** public endpoints with no key (Google Autocomplete JSON, Wayback
availability, RDAP, DNS over HTTPS, the published crawler IP ranges, iTunes Lookup and review RSS, Play listing and Data
safety pages, AASA and assetlinks, app-ads.txt, the CFPB complaint API, openFDA, CPSC, NPI, FINRA search, ProPublica
Nonprofit Explorer, FMCSA SAFER, EPA PPLS, MDN Observatory, urlscan, state licensing portals graded per portal); **5**
PageSpeed Insights with a key (`justice_psi.py`; keyless calls 429, try once; no key means a local Lighthouse on RAW sites
or a verify row with the pagespeed.web.dev link); **6** the user's exports and screenshots, first-class sources labeled
"export <name>, <date>" or "screenshot (user-captured <date>)": GSC Performance, Pages and URL Inspection, GA4, server
logs, Google and Microsoft Ads exports, Merchant Center, LSA, Meta Ads Manager and Account Quality, TikTok, LinkedIn,
Pinterest, Snap and Reddit exports, GBP Performance and profile screenshots, App Store Connect and Play Console, MMP
exports, an existing disavow, crawl exports, rank-tracker and geo-grid exports, ad-library screenshots, SERP and local
pack screenshots, AI-answer screenshots, review panels, received cold emails; **7** the local pull for TEXT or WAF sites,
JA4-scored bot management or EU-vantage renders on the operator's own machine.

**Blocked from here, manual protocol or screenshot only:** google.com/search, Google Maps, Google Trends, the Google Ads
Transparency Center, the Meta Ad Library, LinkedIn, the TikTok Commercial Content Library and profiles, the Microsoft, X,
Snap, Pinterest and Reddit ad repositories, Facebook, Instagram and TikTok profiles, Yelp, BBB, Trustpilot, Glassdoor,
Indeed, NMLS Consumer Access, IRS TEOS, SEC IAPD, the AI assistants' chat interfaces, Google Play search results, most
review widgets, PSI without a key. Say plainly, first, what could not be seen, then why it matters less than it sounds:
an ad is creative plus targeting plus advertiser identity plus destination, and the enforceable mass sits on identity
and destination, which are read in full.

**Access tiers (stated on the Brief):** Tier 0 fetch-only (site inspection, sitemap inventory, the Google Crawl and
render pass, demand map, competitor architecture, AI readiness and citable footprint, listing-integrity web tests, the
compliance web and app-listing layers, ad-library protocols, deep-link forensics, the brand read from public pages; no
rankings, no traffic, no disavow, no account audits); Tier 1 plus GSC and GA4 exports (real queries and positions,
clicks, key events, AI referrals, URL Inspection closes the index ground truth, a server log unlocks `verify-googlebot`);
Tier 2 plus a crawl export, a PSI key, the timing sweep; Tier 3 plus link exports, ad-library screenshots, rank-tracker
or geo-grid exports, Auction Insights (disavow unlocked, paid-intel matrix real, rank tables real); Tier 4 plus the
client's own account exports (the account audits in War Chest, Megaphone, Ground War and Handset run on real data).

## Company archetypes (`assets/archetypes.json`)

Phase 0 names ONE archetype (optionally a secondary); it decides which modules run by default, how the scorecard is
weighted, which Codex overlay sections bind, which market nome the industry read uses, and which exports are requested
in the one batched message. The archetype is a judgment call stated at the top of the delivery.

| Archetype id | Default modules beyond the always-on spine (crawl, technical, content, competitors, exposure, agency, market) | Nome |
|---|---|---|
| `local-service` | local (full), links, paid (Search, LSA), social, ai; apps if found | local-services |
| `multi-location` | local (estate view, Justice logic on the estate), links, paid, social, ai, apps | local-services |
| `ecommerce-dtc` | links, paid (Merchant Center, Shopping, PMax, Demand Gen), social (Advantage+, TikTok Shop, Pinterest, creators), ai, apps; local only with stores | ecommerce-retail |
| `b2b-saas` | links, paid (Search, Microsoft), social (LinkedIn, Reddit), ai (corroboration layer), apps; local as entity hygiene | b2b-saas |
| `marketplace-leadgen` | links, paid (compliance-heavy), social (special categories), ai; Satchel Battery A weighted | marketplace-leadgen |
| `publisher-media` | links, social, ai (AI dependence and the referral floor), paid | news-journalism (or creator-economy, publishing-books, podcasting-audio) |
| `healthcare` | local, links, paid (certification), social (health restrictions), ai (YMYL); exposure first | healthcare-practices |
| `legal` | local, links, paid (LSA, bar rules), social, ai, copy (Counsel full) | legal-services |
| `financial` | links, paid (certification, disclosures), social (credit category), ai, apps (loan-app rules); exposure first | financial-services |
| `real-estate` | local, links, paid and social (housing category), ai | real-estate-housing |
| `automotive` | local, links, paid (vehicle listing ads), social, ai | automotive-retail |
| `education` | local, links, paid (Title IV claims), social (minors), ai | education |
| `nonprofit-political` | local, links, paid (Ad Grants), social (issue ads), ai | nonprofit-political |
| `app-first` | apps (Handset full), paid (App campaigns, Apple Ads), social, ai, links | games-interactive (or b2b-saas, financial-services) |
| `agency` | Justice (full), the digital-marketing overlay §2 to §7, links, paid and social on its own ads, ai | digital-marketing |
| `regulated-other` | local, links, paid, social, ai; the Codex overlay for the vertical | local-services (or the nearest pack) |

## The router: what runs for which request

| The user says | Movements and modules | Read |
|---|---|---|
| A bare domain, "dashboard for <domain>", "audit everything", "run the omega", "onboarding audit" | Phase 0, then `omega_run.py` (the automated spine), then the archetype's movements: Reckoning (Full) with the Google Crawl and the Arsenal modules, Satchel (web layer W1 to W20, claims against registries, reviews, identity; app layer if apps), Counsel passes 1 and 2 (full for a law firm), the Agency lens, the Market read (Brand Stereopsis plus the industry edition), the analysis of record, the playbook; build, verify, publish | `reckoning.md`, `google-crawler.md`, the archetype's Arsenal files, `satchel.md`, `codex.md`, `digital-marketing-overlay.md` §10, `legal-content.md`, `omega-lenses.md`, `omega-agency-lens.md`, `omega-dashboard.md` |
| "crawl the site", "index coverage", "can Google see this", "orphan pages", "render check", "sitemap audit" | Phase 0 light, `omega_run.py --only selftest,robots,crawl,render,ingest,validate,build`, the Site tab and a chat verdict | `google-crawler.md`, `technical-seo.md` §2 to §4 |
| "is something faking Googlebot", "bots eating crawl budget" | `google_crawler.py verify-googlebot` on the uploaded log; the Site tab's verification block | `google-crawler.md`, `technical-seo.md` §9 |
| "technical SEO audit", "Core Web Vitals", "site speed", "migration", "JavaScript SEO", "why did rankings drop after the redesign" | Reckoning Phase 2 with the Google Crawl and Ironclad (Autopsy for speed forensics); the Site tab | `technical-seo.md`, `google-crawler.md`, `reckoning.md` Phases 2 and 8 |
| "why is the site slow", "is it bots", TTFB, GTM duplicates | Reckoning Autopsy plus `verify-googlebot` if a log exists; chat verdict | `reckoning.md` Phase 8, `technical-seo.md` §5 and §6 |
| "local SEO", "map pack", "GBP audit", "why aren't we ranking in <city>", "citations", "reviews strategy", fake-listing screen | Reckoning Ground War plus the Ground War doctrine; the Local tab; the review comparison feeds the Market tab | `local-seo.md`, `reckoning.md` Phase 3, `satchel.md` listing integrity |
| "AI SEO", "GEO", "why doesn't ChatGPT mention us", "llms.txt", "should we block AI bots" | Reckoning Be the Answer plus Oracle; the AI visibility tab | `ai-seo.md`, `reckoning.md` Phase 7 |
| "what ads are they running", ad-library teardown, brand bidding, "competitor paid intel" | Reckoning Follow the Money plus War Chest §2 and §3 and Megaphone §3; Satchel Battery A on the landing pages; the Paid and Social tabs | `reckoning.md` Phase 6, `paid-media.md`, `social-ads.md` §3, `satchel.md` Battery A |
| "audit our Google Ads account", "PPC audit", "pre-flight", "why was our Ads account suspended", "LSA audit", "Merchant Center disapprovals" | War Chest own-account protocol from exports (or the pre-flight, or LSA); the Paid tab | `paid-media.md`, `satchel.md` Battery A, the Codex overlay |
| "audit our Meta / TikTok / LinkedIn ads", "creative audit", "our ad account got restricted", "creator compliance", "organic social audit" | Megaphone own-account, creator and organic protocols; the Social tab | `social-ads.md`, `satchel.md` Batteries A and E |
| "ASO", "audit our app", "App Store or Play rejection", "SKAN", "deep links" | Handset plus the Satchel app layer; the Apps tab | `apps.md`, `satchel.md` app layer, the Codex overlay |
| "what is the market saying about them", "what do customers say", "review sentiment", "brand perception", "what does the brand say vs what customers say" | The Market read: Brand Stereopsis frames coded by hand, the company Nilometer, the industry edition; the Market tab and the Market Position grade | `omega-lenses.md`, `horus-codebook.md`, `horus-metrics.md`, `horus-nilometer.md` |
| "what is the industry talking about", "run a Horus edition", "trend forecast for <industry>" | The Horus run on the nome (`horus-collection.md`); the industry dashboard published beside the domain dashboards; every domain in that nome inherits the edition on its next build | `horus-doctrine.md`, `horus-collection.md`, `horus-analysis.md`, `horus-dashboard.md` |
| "who built this site and what else did they build", an agency name, logo or domain, "everything wearing this badge", "what does <agency> get wrong across its clients" | Justice Phases 0 to 9 plus the Agency lens on the agency's own site; the Agency lens tab (Pattern Verdict) | `justice.md`, `digital-marketing-overlay.md`, `omega-agency-lens.md` |
| "what is their agency doing", "is our agency selling us what works", "inherited vs owned" | The Agency lens (of record, the split, the claims screen, the shared layer, industry alignment against the digital marketing edition) | `omega-agency-lens.md`, `digital-marketing-overlay.md` |
| "ad policy or compliance audit", "pre-flight before spend", "what could get them reported", "pixel and consent audit", "cloaking check", "fake reviews", "special ad categories", "missing license numbers", "run the satchel" | Satchel Stages 0 to 10; the Exposure tab and the honest count | `satchel.md`, `codex.md`, `digital-marketing-overlay.md` |
| Pasted or uploaded attorney copy; "clean / de-AI / proofread / fact-check this"; "is this SOL still right" | Counsel passes 0 to 5; the corrected docx and change log beside the page | `legal-content.md` and its four references |
| "audit my own agency", "are we exposed", self-audit | Posture self-audit; Satchel with overlay §8 first, Reckoning Full, the Google Crawl, War Chest and Megaphone on the agency's own ads; tickets with owners, no routes | `digital-marketing-overlay.md`, `satchel.md`, `omega-agency-lens.md` §3 |
| Monthly or quarterly re-run, "update the dashboard", 5-5-5 | Re-run into the same cache with a new run id; the Brief's momentum block; Reckoning's Tally from exports; Arsenal KPIs fill the channel rows; pack and rebuild the app so the wing shows the change | `reckoning.md` "The Tally", `omega-manifest.md` "Re-runs", `omega-platform.md` |
| "rebuild the app", "update the extension", "publish to the platform", a pack or a queue file uploaded, "run the queue" | `omega_platform.py queue --file ... --run` for a queue (one omega_run per domain, each with its archetype and question), then `pack --cache omega_cache --latest` and `build-app --pack omega-pack.json`; deliver `dist/omegaweapon-chrome.zip` and `dist/omegaweapon.html`, or tell the person to import the page into the Targets wing | `omega-platform.md` |
| "offshore", "offshoring", "who could be offshored", "how likely is <agency> to move delivery offshore", "the Monsoon read", "which agencies are exposed to Asian delivery hubs" | The Offshore wing of the app (the Monsoon read on every tracked agency: index, migration against displacement, the shore split with South and Southeast Asia first, observed footprints, onshore claims, the hub economies' hard signals); per agency on its Offshore dossier tab; the model tables are `assets/radar/offshore_model.json` and `scripts/radar_offshore.py rebuild --write` recomputes the layer. It reads labor economics on a sold mix and a public record; it never reads people, and every inferred line says it is inferred | `omega-platform.md` "The Monsoon read" |
| "dossier on <agency>", "what is <agency> doing and focusing on", "who are their clients and what do they need", "the weighing", "Anubis", "write the dossiers", "the book" | Anubis. The Dossier tab of the app shows the weighing for every tracked agency (the computed spine for all 222; the written narrative where one exists), with a markdown export per agency; `python3 scripts/radar_dossier.py book --out anubis-book.html` prints the book (`--written-only`, `--ids`, `--top`). To write or refresh a narrative: `spine --write --briefs briefs/` computes the spine and a brief per agency, the writer (Fable 5.1 by default, another model only on the person's say and recorded in the file; one agency per call, local files only, the rules in `references/anubis.md`) returns `assets/radar/dossiers/<id>.json`, `validate --fix` refuses figures, names and URLs that are not in the spine and any dash, `merge --write` folds the clean narratives into the registry, then `build-app`. Names only in the client book? `radar_deepen.py run <id> --write --add-clients` fetches the agency's own case studies, news and careers pages (bounded, honest, its own domain only), then `radar_needs.py rebuild --write` and `radar_dossier.py spine --write` before the next narrative. Write the most prominent agencies first and stop where the budget says; a spine only dossier is still complete on its figures | `anubis.md`, `omega-platform.md` "Anubis" |
| "the Radar", "who is in the Agency Radar", "compare these agencies", "what is <agency> selling", "refresh the Radar", "add <agency> to the Radar", "new Horus edition" | The Radar wing of the app answers the reading questions; `radar-upsert` adds or updates a record from a researched JSON (evidence note and URL per capability score) and recomputes its Horus read; a new edition lands in `assets/editions/` and the registry, then `radar_horus.py rebuild --write` and `build-app`; an agency's own domain run (archetype `agency`) is the deep read and lands on its Omega tab | `omega-platform.md`, `omega-agency-lens.md`, `horus-doctrine.md` |

One module requested: run that module, still run the automated spine (it is cheap and it is what makes every other
number observable), ship the dashboard with the other tabs honestly marked not assessed. When the request is ambiguous
and the person is present, ask one question (usually the archetype or the exports); when unattended, take the widest
reading that fits the fetch cap, say which reading you took at the top, and go.

## The run

### Phase 0: set the terms (ask, or state assumptions plainly if unattended)

Establish: **target(s)** (domain, list, agency name or logo, app ids; fetch the homepage to confirm the business);
**archetype** (the table above); **market geography** (expand a ZIP to its city and neighbors, a county to its
incorporated cities and named unincorporated communities) and **jurisdictions** (US states; EU or UK markets sold into,
because the jurisdiction control decides which compliance rows can bind); **posture** (competitor or self-audit, never
blended in one dashboard); **surfaces in scope**; **the business or enforcement question actually asked** (it goes on
the Method tab and steers the headline); **competitor set** (auto-discovered plus any named); **money pages** (the
orchestrator picks four by a heuristic; name them when you know better); **demand seeds** ("[service] [city]" or the
category terms); **disavow strictness** (conservative by default when no anchor or traffic data exists); **fetch budget**
(40 to 60); **Google Crawl scope** (`--max-pages`, link-graph discovery on or off, which money pages to render); **PSI
key** present or not (say so once, name the 3-click fix, never stall); **recipient name** for the masthead; **the exports
and screenshots the user can supply**, sent as ONE batched request with exact paths, report names and date ranges (the
archetype's list in `assets/archetypes.json`, plus for the brand read the review panels and social bios, for Oracle the
AI-answer screenshots, for the Google Crawl the GSC Pages and URL Inspection export, and a server log if
`verify-googlebot` is wanted). Two things are never asked because they do not exist here: a connector or Ahrefs option,
and a branding mode. Note the season. Set the identity: `export OW_USER_AGENT="OmegaWeapon/2.0 (+https://<your contact
URL>)"`. When the targets arrive as an `omega-queue.json` from the app, the queue already carries each domain's
archetype and question; confirm the rest of Phase 0 per domain in one message and run the queue. Honest mode needs only the standard library (`pip install -q brotli zstandard` is optional; the render passes
need Playwright and Chromium, which are preinstalled here). Create the task list.

### Phase 1: the automated spine (`scripts/omega_run.py`)

One command turns a bare domain into a Tier 0 dashboard:

```
python3 scripts/omega_run.py <domain> --archetype <id> --business "<name>" --recipient "<name>" --geo "<City, ST>"
    --jurisdiction US-XX --question "<what they asked>" --money <url> --money <url> --seeds "<service city>,<service city>"
    --follow-links --max-pages 80 --render 3 --ua "$OW_USER_AGENT" --budget 60 --tokens "<operator names, aliases, domains>"
    --out omega-<domain>.html [--fragment] [--system-fonts] [--skip rdap,dns] [--homepage https://www.<domain>/]
```

Phases, each bounded by the budget and each recorded blocked rather than aborting the run when it fails: `selftest`
(the DECLARED presence line), `robots` (robots.txt, the sitemap inventory, the homepage HTML), `crawl` (the Google
Crawl: sitemap index to children to URLs, the link graph with `--follow-links`, the index-decision findings with the
catalogue's severities), `scan` (the raw scan of the money set plus privacy, terms and contact: tag stack and IDs, GTM
expansion, disclosure packs, JSON-LD and lying-schema flags, socials, phones, footer credits, robots and ads.txt
posture, app discovery), `schema` (the Schema Tribunal on the saved HTML), `render` (mobile Chromium, rendered against
raw, lab LCP, screenshots), `probe` (the render probe: pre-consent request log, consent banner, pre-checked boxes,
scarcity strings and timer resets, chat and AI widgets, screenshots), `rdap` and `dns` (registrant, registrar,
nameservers, SPF, DMARC, MX), `demand` (the Autocomplete grid from the seeds: presence and ordering only), `apps`
(iTunes Lookup, review RSS, Play listing and Data safety when the site vouches for an app), `psi` (Lighthouse lab and
CrUX field p75 when `PSI_API_KEY` is set), then `ingest`, `radar` (the agency of record read from the footer, RDAP and
the shared stack is matched against the Agency Radar; a match attaches the Radar dossier and the Horus read to
`modules.agency.of_record.radar` as observed context, and a target that is itself a tracked agency gets
`target.radar_id`; local, no fetch), `validate` and `build`. The ingest turns every output into
manifest modules and mechanical findings (each with observed evidence, a link and a source id), attaches the latest
industry edition for the archetype's nome, records the presence line and the fetch count, and never touches a
hand-written finding or exposure row. `--build-only` skips the fetch phases; `--only` and `--skip` pick phases; the same
command with a fresh run id is next month's re-run. The Google Crawl is never a persona run; `--legacy-persona` affects
only the scan and probe phases and only when the user asked for the persona by name.

### Phase 2: the movements (the analyst's pass, module by module)

Open the manifest and work the modules the archetype turned on, writing into it by hand (`omega-manifest.md` has every
key). **Reckoning** Phases 2 to 8 exactly as `reckoning.md` writes them: walk the property through the five lenses and
name what is already working (the content lens grades the pages the ingest listed); the ground war (`local-seo.md`: the
eleven steps, the A to F pillars with the evidence class per line, GBP from screenshots, citations, reviews client
against rivals, the listing-integrity screen); cut the dead weight only at Tier 3 (`classify_links.py`, the human pass,
`domain:` lines only); know the enemy (four to six rivals, five lenses, "steal this", the one-line threat ranking);
follow the money (the ad-library protocols and screenshots, the paid-intel matrix with an evidence class per row, the
swipe file); be the answer (`ai-seo.md`: readiness, the citable footprint the ingest seeded, the Prompt Tracker as
screenshots, brand facts); the Autopsy when speed is the question. **The Google Crawl's** findings are already in; the
technical lens re-weights them by money-page status and hands the index ground truth to GSC URL Inspection as a verify
row. **Justice** when the target is an agency (`justice.md`, Phases 0 to 9, plus overlay §7's twelve axes). **Satchel**
Stages 0 to 10 (`satchel.md`, the Codex overlay for the vertical, the digital-marketing overlay when an agency or
platform is involved): inventory before judgment (the ingest's platform inventory and consent log are the start), set
expectations (no creatives, targeting, spend or in-app runtime unless exports exist), fetch the live rule corpus for
what the inventory turned up, run Batteries A to F, the controls gate on every candidate, severity by enforcement base
rate, adversarial verification of every CONFIRMED that would be filed, a route and channel on every finding, the NOT
OBSERVABLE list; each row lands in `exposure[]`. **Counsel** passes 1 and 2 on the money-page copy for every target,
passes 0 to 5 for a law firm or any pasted attorney copy (`legal-content.md`). **The Arsenal** modules the archetype
named, each read only when it runs, each ending in the tabs its "Deliverable shape" section names, now as manifest keys.

### Phase 3: the agency lens and the market read

**The agency lens** (`omega-agency-lens.md`): confirm or downgrade the agency of record the ingest read from the footer
(RDAP, the shared tag stack, the agency's own portfolio); tag every High and Medium finding inherited or owned; screen
the agency's claims on its own site; list the shared measurement layer; read the outreach infrastructure; set each
visible practice against the digital marketing edition's measurement (broadcast-led, floor-led, pain, grey) in
`industry_alignment[]`; queue the reverse Justice offer.

**The market read** (`omega-lenses.md`): define the Sun and Moon frames before reading anything and write them into
`modules.market.brand.frames`; code every item by hand against `assets/brand_topics.json` and the Horus intent, stance
and flag codes (`horus-codebook.md` for the tie-breakers); aim for 20 brand items and 15 floor items and say plainly when
you fall short; for a read that will be delivered as a judgment about the brand, draw a blind sample and have one second
coder (a person, or a single subagent with no web access) recode it and report kappa; pull the company Nilometer
(reviews, Autocomplete presence, exports, ad captures, store ratings, complaint rows, filings) with Admiralty grades; the
metrics engine computes the gap, the pain, the stance and the Market Position grade. The industry edition attaches by
itself; when it is older than a quarter, say so and offer a fresh Horus edition as its own job.

### Phase 4: the analysis of record

Read the measurement first (`omega_metrics.py --manifest ...` prints it): which pillars fail and with what confidence,
what the honest count says, where the brand gap is, what the crawl could not see. Then judge, in `analysis`: the headline
(one sentence, usually the market lens meeting the client lens), the BLUF (two to five paragraphs: what is happening,
who shipped it, what customers noticed, where it goes next), Win / Watch / Next, the one rival, the one paid
opportunity, the one exposure that could stop the lights; key judgments in ICD 203 language with a confidence word, a
horizon, evidence refs (finding ids, N.. signals, metrics:.. refs) and falsifiers, and a `math` block computed in code
for any derived figure; the scenario square on the two uncertainties that matter most; indicators with the reading and
the date of the next reading; the 64th part; the graveyard test for any platform prophecy the judgments lean on; moves
tied to judgments; limitations. From the second run on, score the previous run's judgments first. Then the playbook
(`playbook`): phases, the twelve moves with owners from the inherited-against-owned split, a drop-in title and
description for every page in the inventory, ready-to-paste JSON-LD with the client's real facts, exact 301 and
canonical rules, the crawlability fixes, the CWV fix list per money page and the tag-load plan, the content offensive
(twelve weeks; every internal link verified against the live sitemap), the local specs, authority (disavow steps with
merge semantics, outreach groups, two email templates), paid, social, apps and AI specs, compliance remediation (every
CONFIRMED and CANDIDATE self-side item as a ticket with the clause, the fix and the owner), measurement (events, pixels or
CAPI or MMP, a KPI baseline, hedged 30 / 60 / 90 / 180-day milestones); the tasks in roadmap order (Task #1 is data
restoration whenever a source was missing; anything that can suspend an account or remove an app outranks anything that
can lift a ranking); the verify queue; the glossary adapted to the vertical.

### Phase 5: forge (validate, build, publish)

```
python3 scripts/omega_validate.py --manifest omega_cache/<domain>/runs/<run>.json --tokens "<operator tokens>"
python3 scripts/omega_build.py --manifest omega_cache/<domain>/runs/<run>.json --out omega-<domain>.html [--fragment] [--system-fonts]
```

The validator is the Articles in code (`omega-manifest.md` lists every rule); fix each error, and fix or state in the
limitations each warning. The builder recomputes every number, measures momentum against the latest earlier run, injects
the inert payload into `assets/omega_template.html` and writes the page. In a session with an artifact tool, build with
`--fragment` and publish the file as a private page titled "<Business>: digital position, exposure and market read";
republishing the same path updates the same page. On a local machine, open the full build in a browser. Then publish
to the platform:

```
python3 scripts/omega_platform.py pack --cache omega_cache --latest --out omega-pack.json
python3 scripts/omega_platform.py build-app --pack omega-pack.json --out dist
```

`dist/omegaweapon-chrome/` reloads in place over the installed folder (the watchlist, notes and queue persist),
`dist/omegaweapon-chrome.zip` ships, `dist/omegaweapon.html` is the same app as one file. When a rebuild is not wanted,
the person imports `omega-<domain>.html` or `omega-pack.json` into the Targets wing and the app hosts it from that
browser profile. Exports when
files are wanted (`omega-dashboard.md` "Exports beside the page"): the Asana CSV from `tasks[]`, the disavow and its
workbook, the Satchel workbook, the Reckoning workbook (`build_workbook.py`), the Book following the UltimaWeapon
Finale, the Counsel docx and change log.

### Phase 6: verify, then ship

Open the built page and click every tab once; every table renders or says why it is empty. Cross-check ten headline
numbers against the raw outputs, exports and screenshots (for account audits, every spend and conversion total). Confirm
the run made no connector or MCP call; that `omega_cache/<domain>/wetware/fetch_log.jsonl` and the Google Crawl's log
show only the declared UA (or, in a `--legacy-persona` run, only the persona) with any `ROBOTS_DISALLOWED` skips
surfaced; that the presence line on the Brief quotes the mode. Confirm every CONFIRMED row carries its fetch date or
vintage flag and its channel. When the app was rebuilt, open it once (the Targets view lists the run; the target page
hosts it; the agency of record links to its Radar dossier and the dossier's Omega tab lists the target back) and
confirm the build carries no demo fixture. For high-stakes work, have a fresh pass (not the author) attack each CONFIRMED finding's
inference chain and each key judgment's falsifier before the page leaves. Run `python3 scripts/brand_sweep.py --tokens
"<operator names, aliases, domains>" omega-<domain>.html <every export>`; zero hits is the gate. Deliver with a short
message and no long postamble: the judgment-call block; the honest count; the overall grade and the pillars that
failed; the top three findings with their lens; the single biggest competitor threat; the single biggest paid
opportunity; the single biggest exposure; the brand gap in one sentence; data caveats (tier, archetype, vantage,
missing key, what was blocked, which account audits shipped as protocols, how thin the brand read was); the first-sprint
move; and the offer to put the recipient's name on the masthead so the work is theirs.

## When the ground shifts (fallbacks and refusals)

| Situation | Adjustment |
|---|---|
| Tier 0 (no exports, no screenshots) | Run the whole automated spine; every ranking, traffic and spend statement is inferred or a protocol and labeled; Task #1 is granting GSC and GA4 access and naming the account exports; no disavow; account audits ship as pre-flights and protocols; the brand read is thin and says so |
| National, e-commerce or SaaS target | Local off or entity hygiene only; competitor set from head-term samples and the user's list; `--max-pages` raised with `--sample-families` for large catalogs |
| Tiny site (under 10 pages) | The whole site is the money set; say a disavow is unnecessary rather than manufacturing one; modules trim to what exists |
| A phase fails or is walled | Recorded as blocked in the manifest with the reason and shown on the Brief's coverage strip; the rest of the run continues; never route around, never switch into a disguise to get in; offer the local pull, a screenshot or an export |
| robots.txt disallows the path | ROBOTS_DISALLOWED: skipped, logged, surfaced as "not crawled per robots"; `--ignore-robots` only as the user's stated judgment call |
| Rendered content far exceeds raw HTML | The ingest writes the JS-dependency finding with the word counts; fix is server-rendering; confirm with GSC URL Inspection's rendered HTML |
| The Autocomplete endpoint refuses | The demand map ships empty with the refusal recorded; no volumes were ever implied |
| No app discovered | Apps not assessed with the tests named (AASA, assetlinks, store badges, the iTunes search on the brand) |
| No PSI key | Local Lighthouse on RAW sites (lab only, labeled) or a verify row with the pagespeed.web.dev link; never a remembered score |
| The industry edition for the nome does not exist yet | The Market tab shows the brand read alone and says the industry read is pending; offer a Horus edition as its own job |
| Brand read below the minimums | The tab renders with counts beside every share; the Market Position grade carries low confidence; the coverage strip says the read is thin |
| A cite could not be fetched | Vintage flag ("rule text not re-verified this run; last verified <date>"); it cannot carry a CONFIRMED finding |
| A platform fact in this doctrine may have changed | Each Arsenal file ends with a volatility register naming the page; fetch it before the fact appears in a finding; if unreachable, the fact ships with the doctrine date and a verify row |
| Validation errors at build | Fix the manifest; `--force` builds a draft that is never delivered |
| The previous run's frames differ (money set, review platforms, window) | Momentum still computes; the frame note says the frames changed and which deltas to discount |
| User offers Ahrefs, an ads API, a store API or any connector | Decline in one sentence; accept an uploaded export file labeled as the client's export or a vendor estimate |
| User asks for a branded version | Not in this skill; the page stays neutral; point to a branded-report skill if one exists |
| Asked to solve a CAPTCHA, use proxies or rotating IPs, replay cookies or logins, spoof Googlebot, make the persona harder to detect, "do whatever it takes to not get blocked", scrape Google result pages, the ad libraries, review platforms or LinkedIn, join rooms to read them, or mass-file reports | No; honest mode is the posture: identify truthfully, obey robots, stop at a wall, read only public and lawful routes. None of it ships in the skill and none of it is added on request. Offer the local pull, the manual links, the screenshot protocols and the small-strong-findings posture instead |
| Asked to buy reviews, followers or installs, post reviews as customers, run undisclosed creator content, skip a special-category declaration, hide data collection in a privacy label, or target minors or sensitive attributes | No; the platform rule and the law are named once; the compliant alternative from the Arsenal ships instead |
| Asked to record reviewer or poster names in the brand read, or to profile a person | No; the ledger holds platforms, sources and titles; the validator refuses an author field |
| Asked for a guaranteed ranking, citation, CPA or ROAS | Ranges with assumptions and the mechanisms; no guarantees |
| A legal claim in copy is affirmatively false | Excise, placeholder and flag in the change log; never author replacement law |
| Enormous scope ("every dealer in Texas", "every agency in Europe") | Quote the real cost, propose one metro or one market and two verticals first so the output shape can be checked; one dashboard per domain, never one dashboard for a hundred |
| Blended posture requested (a client's own exposure in a competitor dashboard) | Refuse the blend; two runs, two postures, two pages |
| The agency of record is not in the Radar | The lens runs as before on the run's own evidence; the page says the agency is not tracked; offer a `radar-upsert` record (a researched read of its public record, evidence per score) or the agency's own domain run at archetype `agency` |
| A run manifest is dropped on the app instead of a built page | The app refuses it and names the command: `omega_platform.py pack --manifest <run.json>`; metrics are computed in Python, never in the browser |
| The person asks to put the operator's name or mark on the app | The app is the operator's cockpit and already carries the OmegaWeapon name; the dashboards inside stay neutral, and the operator's name still never enters a client page except through `--name-on-page` on a standalone build the person asked for by name |
| Asked to make the app fetch, sync, phone home or run a crawler from the browser | No; the app hosts and queues, the skill fetches under the declared identity; a browser fetch would be an undeclared crawl from the person's own session |
