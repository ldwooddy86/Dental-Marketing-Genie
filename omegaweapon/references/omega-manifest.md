# The run manifest: OmegaWeapon's single contract

One JSON file per run, `omega_cache/<domain>/runs/<run_id>.json`, is the only thing the dashboard is built from. The
fetchers fill it through `scripts/omega_ingest.py`; the analyst writes judgments into it by hand; `omega_metrics.py`
computes every number from it; `omega_validate.py` enforces its shape; `omega_build.py` renders it. If a fact is not in
the manifest it is not on the dashboard, and if it is in the manifest it carries a source, a date and an evidence class.

`scripts/omega_scaffold.py <domain> --archetype <id>` writes the skeleton with every key present. `--demo` fills it with
an offline fixture for testing the pipeline; a demo manifest carries a DEMO FIXTURE judgment call and is never shipped.

## Top level

| Key | Holds |
|---|---|
| `omega` | `version`, `doctrine_date` (the date of this skill's own doctrine, quoted on the Method tab), `created_at` |
| `target` | `domain`, `homepage`, `business_name`, `recipient` (the cover's "Prepared for"), `archetype` (`assets/archetypes.json`), `archetype_secondary`, `vertical`, `codex_overlays` (Codex section numbers), `nome` (the market pack), `geography` `{label, markets[]}`, `jurisdictions[]` (`US-TX`, `EU`, `UK`...), `posture` (`competitor` or `self-audit`, never blended), `surfaces[]`, `question` (the business or enforcement question actually asked), `competitor_set[]` `{name, domain}`, `money_pages[]`, `radar_id` (set by the `radar` phase when the target itself is a tracked agency) |
| `run` | `id`, `run_date`, `tier` (0 to 4), `modules_planned[]`, `presence` `{mode: honest or legacy-persona, line, declared_ua, vantage}`, `fetch_budget`, `fetches_used`, `cache_dir`, `judgment_calls[]` (the block that opens every delivery), `exports_supplied[]`, `exports_requested[]`, `blocked[]` `{surface, why}`, `previous_run` |
| `sources[]` | `{id: SRC01.., label (names the source and its date range), kind: fetch, measured, export, screenshot, public-endpoint, vendor-estimate, search; date; rung (fetch-ladder rung 1 to 7); url}` |
| `modules` | one object per module (below); every module has `status`, `why`, `sources[]`, `summary{}`, `notes[]` plus its own keys |
| `findings[]` | the audit findings (below) |
| `exposure[]` | the compliance observations with dispositions (below) |
| `verify_queue[]` | `{id, item, url (the exact place to check), what, why, owner}` |
| `tasks[]` | Asana rows with keys exactly `Name, Description, Section/Column, Priority, Tags` in that order; Priority High, Medium or Low; row order is roadmap order |
| `analysis` | the analysis of record (below) |
| `playbook` | the 90-day playbook (below) |
| `glossary[]` | `{term, def}`: every metric that appears in a table gets one to three sentences with the why built in |

## Module status

`run` (the module's evidence is in), `partial` (some of it, with `why`), `not_run` (never attempted), `not_assessed`
(deliberately off for this archetype or tier, with `why`), `blocked` (attempted and walled, with `why`). The dashboard
shows every module's status on the first screen; a planned module that stays `not_run` is a validator warning because
the coverage strip must tell the truth.

## Modules and their keys

| Module | Keys (beyond the envelope) | Filled by |
|---|---|---|
| `crawl` | `pages[]` `{url, status, indexable, canonical (self or a URL), noindex, in_sitemap, depth, title, words_raw, words_rendered, js_share, lcp_lab_ms, hops, inlinks, money}`, `sitemaps[]`, `render[]`, `googlebot_verify` | ingest from `google_crawl/crawl.json`, `google_render.json`, `googlebot_verify.json` |
| `technical` | `cwv[]` `{url, lcp_p75, inp_p75, cls_p75, ttfb_ms, lab_lcp_ms, source, date, verdict}`, `tags[]` `{tag, id, purpose, load, pre_consent, owner}`, `bot_posture[]` `{bot, directive, source}`, `headers{}`, `redirects[]`, `timing_sweep` | ingest from the web scan, the render probe, PSI, the crawl; the Autopsy by hand |
| `content` | `top_pages[]` `{url, role, title_len, meta_len, h1, words, grade, passive_pct, issues[]}`, `demand_map[]` `{seed, suggestions[], client_present, rivals_present[]}`, `readability{}`, `content_plan[]` | ingest (page facts, demand map); the content lens by hand |
| `local` | `pillars[]` `{pillar, grade, evidence_class, note}`, `gbp[]` `{item, status: Present, Absent or Unknown, source, fix}`, `citations[]`, `reviews[]` `{entity, platform, count, rating, velocity_30d, response_rate, source, date}`, `listing_integrity[]` `{business, signal, disposition, control, open_question}`, `location_pages[]` | by hand from the Ground War protocol; reviews from screenshots or the GBP export |
| `links` | `stats{}`, `buckets{disavow, review, keep}`, `rows[]` `{domain, bucket, reason, signals}`, `gap[]`, `disavow_file` | ingest from `links/buckets.json` (Tier 3) |
| `competitors` | `rivals[]` `{name, domain, threat_rank, one_line, lenses{content, technical, ux, speed, mobile}, steal_this[]}`, `keyword_gap[]`, `threat_ranking[]` | by hand from the Know the Enemy phase |
| `paid` | `intel[]`, `swipe[]`, `account_audit{status, pillars[]}`, `search_terms[]`, `negatives_block`, `conversion_actions[]`, `landing_pages[]`, `auction_insights[]`, `budget_scenarios[]`, `lsa{}` | ad-library protocols and screenshots; account exports (Tier 4) |
| `social` | `intel[]`, `organic[]` `{platform, handle, url, completeness, cadence, last_post, video_share, response_time, evidence_class}`, `account_audit{}`, `creative_ledger[]`, `audience_map[]`, `measurement_spine[]`, `creator_compliance[]` | handles from the scan; the rest from screenshots and exports |
| `ai` | `readiness[]` `{item, observed, fix}`, `citable_footprint[]` `{query, page, type, client, rivals[], date, url}`, `prompt_tracker[]` `{prompt, engine, mentioned, cited_url, date, source}`, `brand_facts[]` `{fact, site, gbp, linkedin, directories, consistent}`, `referrals[]`, `llms_txt` | the Oracle protocol; prompts are screenshots |
| `apps` | `inventory[]`, `aso[]`, `keyword_proxy[]`, `reviews[]`, `deep_links{}`, `measurement[]`, `campaigns[]`, `vitals[]` | ingest from `apps/apps.json`; Handset by hand |
| `exposure` | `inventory[]`, `clause_coverage[]` `{family, status: testable..., partial..., needs ...}`, `consent_trackers[]`, `accounts[]`, `not_observable[]` `{item, why, cost_to_close}` (mandatory), `controls_applied[]` `{candidate, control, result}` | ingest (inventory, consent log); batteries and controls by hand |
| `agency` | `of_record{name, domain, evidence[], confidence, reverse_justice_offered, radar{} (the Radar dossier block the `radar` phase attaches when the agency is tracked: id, name, band, hti, arc_clock, best_fit, saydo, verdict, archetype, segment, ownership, leads[], house[], gaps[], compiled, edition)}`, `inherited_vs_owned[]` `{finding_id, side, why}`, `claims[]` `{claim, url, test, status}`, `shared_layer[]` `{id_type, id, seen_on[]}`, `outreach{}`, `pattern_verdict{trial_set_n, axes[]}`, `industry_alignment[]` `{practice, floor_stance, agency_selling, note}`, `self_audit[]` | ingest (footer credit, RDAP, tag IDs); the rest per `omega-agency-lens.md` |
| `market` | `nome_id`, `edition_stem`, `industry{headline, top_sun[], top_moon[], stereopsis[], signals_used[], edition_note}`, `brand{frames{sun[], moon[]}, items[]}`, `nilometer[]`, `events[]`, `watch[]` | ingest attaches the latest industry edition; the brand read is coded by hand per `omega-lenses.md` |
| `copy` | `passes_run[]`, `readability{}`, `flags[]` `{line, type, text, action}`, `verify_worklist[]`, `deliverables[]` | Counsel |

Brand items (`modules.market.brand.items[]`): `{id: S001.. for the brand's voice, M001.. for the floor; eye: sun or
moon; topic (B01..B16 from assets/brand_topics.json); topic2; intent (Q C R H N D P J O); stance (-1, 0, 1); flags (set,
grey); title; source; url}`. Reviewer and poster names are never recorded; the validator refuses an `author` field.

## Findings

Every audit finding: `{id: F001.., module, pillar (optional; defaults from the module), severity: High, Medium, Low, Info
or Win; evidence_class: observed, inferred or unverified; title; evidence (the sentence that proves it); url (an http(s)
link to the affected page, listing, ad or app, required); fix (required unless Win); source (a sources[] id); owner:
Agency, Client or Both; effort; money_page (bool); generated_by (set by the ingest for mechanical rows, absent on
hand-written rows)}`. Severity is business severity here; the Google Crawl's catalogue severity is index-eligibility
severity and the ingest keeps it, so re-weight a High on a privacy page down and a Medium on a money page up by hand.

## Exposure rows

Every compliance observation: `{id: X001.., battery (A to F), test (W4, A3, D...), rule, cite, cite_fetched (date the
live text was read, or null), cite_vintage (the vintage flag when it was not), evidence (verbatim), url, disposition
(CONFIRMED, CANDIDATE, CLEARED), confidence (Confirmed, Plausible, Weak), severity (High, Medium, Low), base_rate (the
enforcement prior), control (the control that cleared it, or null), open_question (what would settle a CANDIDATE), route
(the routing table's codes), channel (the exact report channel for PLATFORM and STORE routes)}`.

The validator enforces the Articles: CONFIRMED needs a cite that was fetched or vintage-flagged, quoted evidence, a URL,
a route, no open control and never Weak confidence; CANDIDATE needs its open question; CLEARED needs its control.

## Analysis of record

`headline` (one sentence), `bluf[]` (two to five paragraphs), `win_watch_next{win, watch, next}`, `one_rival`,
`one_paid_opportunity`, `one_exposure`, `key_judgments[]` (`{id: KJ1.., title, judgment, likelihood (ICD 203 terms,
two claims joined by a semicolon), range (the matching range, two joined by a slash), confidence (low, low to moderate,
moderate, moderate to high, high), horizon, evidence[] (finding ids, N.. signals, metrics:.. refs), falsifiers[], math}`),
`scenarios{axes[2], quadrants[4]{name, probability, narrative, signposts[]}}` summing to 100, `indicators[]` `{id, watch,
reading, moves, next_reading}`, `unknowns[]` (the 64th part), `graveyard_test[]` `{prophecy, shape, test}`, `moves[]`
`{id, move, justified_by[]}`, `limitations[]`, `scorecard_notes{}`, and `pillar_grades{}` (optional analyst overrides
`{pillar: {grade, why}}`; the computed grade stays beside the override on the page; Compliance & Exposure cannot be
overridden because dispositions decide it).

## Playbook

`phases[]` `{phase, moves[]}`, `moves12[]` `{n, move, impact, effort, owner, when}`, `on_page[]` `{url, title, description}`
(a drop-in for every page in the inventory), `schema_blocks[]` `{type, url, jsonld}`, `redirects[]`, `content_offensive[]`
`{week, title, target, money_page, words}`, and the spec lists `local[]`, `authority[]`, `paid[]`, `social[]`, `apps[]`,
`ai[]`, `compliance[]`, `measurement[]` (strings or `{title, spec}`).

## House rules the validator enforces in every client-facing string

No em or en dash anywhere in findings, exposure rows, analysis, playbook, glossary, verify queue or tasks (write with
colons, commas and full stops). No vendor authority score language ("domain rating", "domain authority", "DR 40"). No
guarantee language. No operator tokens (`--tokens "Name,alias,domain"`). No accusatory verbs ("is guilty of", "broke the
law"): verbs about the artifact. Every finding and verify item links to the exact place it is about.

## Re-runs

A second run of the same target is a new file in the same `runs/` folder. The builder picks the latest earlier run
automatically (or `--previous`), and the Brief shows measured change: grade letters moved, findings resolved and new
(matched by title), exposure counts, brand-share deltas with a two-proportion z, review counts. Keep frames comparable
(same money set, same review platforms, similar windows) and say so when a frame changed; never restart from zero when a
cache exists.
