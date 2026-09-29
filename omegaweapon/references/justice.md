
# JUSTICE — the tribunal movement of UltimaWeapon

Read this file when the target (or the user's question) is an **agency**: "who built this site and what
else did they build", "audit everything wearing this badge", "what does this platform get wrong across
its whole client book". Justice also runs in reverse from any client domain: read the footer badge,
name the agency of record, and — if the user wants — try the agency. The digital-marketing overlay
(`references/digital-marketing-overlay.md`) adds the agency-specific charges and Pattern Verdict axes;
read it alongside this file. Bundled tools: `scripts/justice_fetch.py`, `scripts/justice_dns.py`,
`scripts/justice_psi.py`, `scripts/justice_schema.py`, `scripts/satchel_web.py` (tag stack, GTM
expansion, RDAP registrant), `scripts/build_workbook.py`, `scripts/brand_sweep.py`.

Every agency brands the sites it builds. That badge in the footer is a confession: it tells you exactly whose
platform, whose templates and whose shortcuts are holding up a client's revenue. Justice reads the confession.
It finds every site wearing the badge, confirms the roll call with evidence, tries each site on the same
charges, and hands down a verdict on the AGENCY: the weaknesses that repeat across its whole book of clients.

Justice inherits Bane's audit doctrine (integrity, evidence labels, brand neutrality, 90-day sentencing) and
strips out everything that needed Ahrefs. It runs on what is free and public: Google PageSpeed Insights,
Google's rich-result eligibility rules, the search index itself, DNS, RDAP, certificate transparency, and
the target's own pages.

## The Law (the SKILL.md Articles, plus Justice's own)

1. **Never Ahrefs. Never a connector.** No MCP tool of any kind stands in for a fetch or a metric. Do not
   offer Ahrefs, Semrush, Moz or any connector as an option, even when one is available in the session.
2. **Never invent a number.** Every score, millisecond and count traces to a PSI/Lighthouse JSON on disk, a
   fetched file, a search result the run actually saw, or user-supplied data. No PSI key → no speed scores;
   write the verify docket instead. Text-only fetches cannot see JSON-LD → never write "no schema" from one.
3. **Evidence labels on everything:** `observed` (fetched/measured), `inferred` (pattern; say what pattern),
   `unverified` (needs access the run lacks → a Verify Docket row, never an assertion). Data limits go in the
   FIRST content section of the report, not an appendix.
4. **Never bypass a wall.** Every fetch already wears wetware — a person in a desktop browser, never a tool
   (`references/wetware.md`) — so a WAF/Cloudflare challenge, a 403 or a blocked fetch met that way is the wall a
   real visitor from that vantage meets: stop, record `WAF` tier with the measured presence tier, and audit from
   the outside. No challenge solving, no proxies or IP rotation, no mirrors, caches or third-party renderers, no
   borrowed cookies, no Googlebot spoofing beyond the opt-in cloaking diff. The wall itself is a finding (it can
   also block third-party crawlers and, sometimes, Lighthouse); the fix path is the operator's own machine
   (Phase 2, local pull — presence H2).
5. **Brand-neutral output (Bane rule).** No operator/agency-of-record name on the cover, headers, footers,
   workbook, CSV or file metadata. Cover reads "Prepared for [recipient]". Scrub PDF docinfo + XMP (pikepdf),
   then sweep every file's visible text, raw bytes and metadata for brand tokens; ship at zero hits.
   The TARGET agency is named freely — it is the subject of the trial.
6. **Honest grades.** Name what works on every site and in every pillar. An all-red docket reads as a pitch.
7. **Polite by design.** Wetware's tempo between pages (`human`: log-normal reading time, median ~6 s; `brisk` for
   sitemap-heavy inventories), never a fixed interval and never parallel; ≤6 URLs per site in the deep pass; PSI
   ≤1 call/2 s with backoff on 429/500. Caps below are defaults; state them as judgment calls and let the user move them.
8. **Incremental re-runs.** Everything lands in `omega_cache/<agency>/`. A re-run reuses cached PSI JSON,
   fetched HTML, DNS and search notes and only fills gaps or refreshes what the user names. Never restart from
   zero when a cache exists.
9. **Flag every judgment call** (caps, which pages count as money pages, what counts as "confirmed") in one
   short block at the top of the delivery message.

## Phase 0 — Arraignment (scope, 5 minutes, no fetch budget)

Establish, asking only when a wrong guess is expensive:
- **The badge.** If a logo file is attached, look at it: brand name, wordmark, tagline, colors, and the file
  name. Resolve it to the agency's registrable domain with one search. If only a name was given, confirm the
  agency site with one fetch of its homepage.
- **Badge phrasing.** The exact footer strings the agency uses. Learn them from one seed client site
  (fetch its homepage and read the last lines: "Powered by X", "Marketing by X", "Site by X", "Web Design by
  X", "Internet Marketing Experts", a bare logo linking to the agency domain) and from the agency's own
  portfolio pages. Record every variant; they become search phrases.
- **Verticals and geography** the agency serves (its nav tells you: law firms, home services, healthcare,
  franchise). These drive the query matrix.
- **Caps (judgment calls, flag them):** discovery cap 150 domains; deep-audit set 12 domains (the seed, the
  agency's showcased clients, then the most-visible confirmed sites); docket-only pass for the rest
  (homepage speed if a PSI key exists, DNS, robots, one site: query). Recipient name for the cover.
- **Speed credentials.** Look for `PSI_API_KEY` in the environment or the user's message. Keyless PSI is
  gone (anonymous quota is 0/day as of Sep 2026). If absent, say so once, name the 3-click fix (Google Cloud
  Console → enable "PageSpeed Insights API" → create API key; free, 25k calls/day), and proceed with the
  fallback ladder. Do not stall the run waiting for it.
- **Check the toolkit.** The tools are bundled in `scripts/`; `pip install -q curl_cffi brotli zstandard`, then run
  `python3 scripts/justice_fetch.py --selftest --cache omega_cache/<agency>` once: it binds the persona to this
  cache and prints the measured presence tier (H2 / H1 / H0) with the egress registrant — that paragraph goes in
  the Verdict's Scope & Data Integrity. If the proxy refuses the target class, that is a fetch-ladder rung closed,
  not a wall to route around: record it and lean on search, PSI and the local pull.

## Phase 1 — The Roll Call (footprint discovery)

Four independent sources; a domain's confidence is the number of sources that name it.

1. **The agency's own mouth.** Its case studies / successes / portfolio / testimonials / "our work" pages
   (paginate), press releases naming clients (PRNewswire, BusinessWire, GlobeNewswire), YouTube testimonial
   titles, award submissions, speaker bios. One fetch per index page; harvest client names and any outbound
   client URLs. Each named client without a URL costs one search (`"<client name>" <city> website`).
2. **Badge-text searches.** A query matrix of badge phrase × vertical × region, run with the sanctioned
   search tool, always excluding the agency's own domain:
   `"Powered by <Agency>" attorney`, `"Powered by <Agency>" plumbing`, `"<Agency>" "Internet Marketing
   Experts"`, `"Site by <Agency>" -site:<agency.tld>`, `"Marketing by <Agency>" dentist <state>`. Google
   ignores image alt text, so phrase queries hit only visible badge text — expect recall to be partial and
   say so. Log every query (Sources tab); a query that returns nothing relevant is still logged.
3. **Reverse image search (the literal logo trail).** Host the logo (the agency's own logo URL, or the seed
   site's footer image URL) and emit ready links for the operator's browser:
   `https://lens.google.com/uploadbyurl?url=<logo-url>` and `https://tineye.com/search?url=<logo-url>`.
   Pasted-back domains are ingested as source #3. Never scrape these tools.
4. **Hosting fingerprint.** Resolve the agency site and the seed client (`justice_dns.py`). Agencies that host
   their builds put every client behind the same edge: identical Cloudflare IP pairs, shared nameservers,
   shared asset hosts, the same `Server`/`x-powered-by` headers, the same generator tag. Record the platform
   signature and resolve EVERY candidate against it. Certificate transparency (`https://crt.sh/?q=<domain>&
   output=json`) also lists a candidate's subdomains (staging, dev, legacy hosts) for Phase 5.

**Disposition per domain:** `CONFIRMED` (badge seen on the site, or the agency lists it, AND fingerprint
matches) · `FINGERPRINT` (IP/NS match only — likely, unproven) · `CANDIDATE` (search hit only) · `CLEARED`
(fetched, no badge, no fingerprint — drop with the reason kept). Only CONFIRMED and FINGERPRINT sites enter
the trial; CANDIDATE rows stay on the Roll Call tab for the operator.

Recall is bounded — a large agency has thousands of clients and free discovery surfaces a slice. Report the
slice honestly ("N confirmed of an estimated book of thousands") and never present it as the full client list.

## Phase 2 — Reconnaissance tiering (what can this run actually see?)

For each site in the trial, run `justice_fetch.py` on the homepage first and tier the site:
- **RAW** — HTML came back (status 200, no challenge markers). Full technical pass is possible: source, headers,
  redirect chain, JSON-LD, generator, viewport, canonical, hreflang, asset weights, robots.txt, sitemaps.
- **TEXT** — the wetware fetch hit a wall but the sanctioned fetch tool returns rendered text + links + canonical.
  Titles, H1s, copy, internal/external links, footer credits, robots.txt and sitemap URL lists are readable.
  JSON-LD, meta tags, headers and asset sizes are NOT — they go to the Verify Docket or the local pull. A TEXT read
  is a non-human fetch of a target page: it is the labeled last resort and is listed as such in Data Integrity.
- **WAF** — nothing renders from the cloud. Audit from the outside only: DNS, crt.sh, search interrogation,
  PSI/Lighthouse via Google (usually passes edge challenges; if `runtimeError` shows a 403, that is the
  headline finding), and manual deep links.

**The local pull (the operator's own machine sees what the cloud cannot).** For TEXT/WAF sites, hand the user
`justice_fetch.py` + `justice_psi.py` with a one-line command and the URL list; from their machine wetware is
presence H2 — residential IP and Chrome's own TLS hello — and the edge sees a desktop visitor. If a device-bridge
shell on that machine is present in the session, run the pull there yourself. They zip `omega_cache/` back;
the re-run ingests it and completes the Schema Tribunal and header forensics. Until then, those modules read
`unverified`, with the exact URLs and what to check.

## Phase 3 — The Speed Trial (PageSpeed Insights)

Per deep-audit site: homepage, up to three money pages (practice/service pages the nav promotes), one
article, one templated location page — mobile AND desktop. Docket-only sites: homepage mobile.

**Ladder:** (a) PSI API v5 with key → lab (Lighthouse) + field (CrUX p75 for the URL and for the origin);
(b) no key → local Lighthouse (`justice_psi.py --lighthouse`, Chromium at `/opt/pw-browsers`) on RAW sites,
lab only, labeled `lab-only, cloud vantage`; (c) neither → a Verify Docket row per URL with
`https://pagespeed.web.dev/analysis?url=<enc>` and the exact metrics to read off.

**Read from the JSON, never from memory:** performance / accessibility / best-practices / SEO scores; field
LCP, INP, CLS p75 and the overall category (GOOD/NEEDS_IMPROVEMENT/POOR) for URL and origin — an origin with
field data but a URL without is itself a finding (thin traffic to that page); lab LCP, TBT, CLS, Speed
Index, FCP, TTFB (`server-response-time`); the opportunity list ranked by savings (render-blocking
resources, unused JS/CSS, legacy JS, image formats/sizing/offscreen, text compression, cache TTL, redirects,
font-display, preconnect, LCP image priority); diagnostics (DOM size, total byte weight, third-party
blocking time, main-thread work, LCP element, layout-shift elements). Record `runtimeError`/`runWarnings`
verbatim — a Lighthouse that could not load the page is a finding about the edge, not a missing value.

**Interpretation rules:** field beats lab; judge Core Web Vitals on field p75 when present. Distinguish
platform defects (the same third-party tag stack, the same hero pattern, the same unused-JS bundle on every
site) from site defects (one oversized hero video). TTFB > 800 ms on a static/CDN-fronted platform points at
origin or cache bypass; > 1.8 s is a fire. Never extrapolate one page's score to the site.

## Phase 4 — The Schema Tribunal (Rich Results without the API)

Google's Rich Results Test has no API. Justice reproduces its eligibility rules on any HTML it can see and
gives the operator one-click confirmation links for the rest.

- **On RAW HTML or a local-pull dump:** `justice_schema.py` extracts every JSON-LD block (including `@graph`),
  counts microdata/RDFa, reports parse errors with position, then validates each entity against the rules
  table: Organization/LocalBusiness/LegalService/Attorney/Dentist/HomeAndConstructionBusiness (name, url,
  telephone, address with streetAddress/addressLocality/addressRegion/postalCode, image/logo, geo,
  openingHoursSpecification, sameAs, priceRange), Article/BlogPosting/NewsArticle (headline ≤110 chars,
  image, datePublished, dateModified, author with url), FAQPage (mainEntity Question/acceptedAnswer pairs;
  since Aug 2023 FAQ rich results are limited to authoritative government/health sites — report as
  "AI-answer asset, not a SERP feature"), BreadcrumbList (positions contiguous, last item may omit `item`),
  VideoObject (name, description, thumbnailUrl, uploadDate, contentUrl or embedUrl), Review/AggregateRating
  (self-serving reviews on a LocalBusiness/Organization are ineligible — flag as "lying schema" when present),
  WebSite/WebPage (potentialAction SearchAction validity), Person (jobTitle, worksFor, sameAs).
- **Lying-schema hunt** (the lying-schema charge sheet): aggregateRating with no visible reviews;
  schema NAP ≠ footer NAP; telephone not E.164-parseable; dates in the future or dateModified < datePublished;
  duplicate Organization blocks with different names/@id; sameAs pointing at dead or wrong profiles; schema
  on a page that is `noindex`; `LegalService` on a plumber; image URLs that 404; `@context` not schema.org;
  trailing commas and smart quotes that kill the whole block.
- **Always emit, per audited URL:** `https://search.google.com/test/rich-results?url=<enc>` and
  `https://validator.schema.org/#url=<enc>` on the Verify Docket. On TEXT/WAF sites these links ARE the
  module until the local pull arrives; write "schema status unverified — run RRT link" and nothing stronger.
- **Deliver fixes, not just charges:** a ready-to-paste JSON-LD block (LegalService/LocalBusiness + WebSite +
  BreadcrumbList; Article template) filled with the site's real, visible facts for each deep-audit site.

## Phase 5 — The Index Interrogation (general searches as evidence)

Search operators are the only crawl a blind run gets. Per deep-audit site, run and LOG (query → what came
back → what it means), capping at ~8 queries a site:
- `site:<domain>` — what Google chooses to show first (homepage? a tag page? a PDF?) and how many distinct
  URL patterns appear across the first pages; note the sample size, never quote an index count the tool
  does not give.
- Hygiene: `site:<domain> inurl:tag`, `inurl:?`, `inurl:search`, `inurl:page/`, `filetype:pdf`,
  `intitle:"index of"`, `intitle:"page not found"`, `intitle:"untitled"`, `intitle:"home"` — parameter
  bloat, indexed soft-404s, indexed internal search, orphan PDFs, template titles.
- Duplicates/legacy: `site:<domain> inurl:.htm`, `inurl:.aspx`, uppercase path variants
  (`inurl:Practice-Areas`), `site:<domain> -inurl:https` (HTTP leakage), `site:*.<domain> -www` plus crt.sh
  SANs (staging/dev/legacy hosts indexed).
- Doorway pattern: `site:<domain> intitle:"<city>" <service>` volume vs the sitemap's location-page count;
  identical H1 templates across cities read from the fetched text.
- Entity & local: `"<Business name>"` (knowledge panel, sitelinks, GBP presence), `"<Business name>" reviews`,
  `"<phone>"` (NAP consistency across directories), `"<Business name>" -site:<domain>` (duplicate/old sites,
  microsites, vendor subdomains).
- Visibility proxy: the #1 money term (`<service> <city>`) — is the site in the first page of results the
  tool returns? Which rivals are? Label `observed (tool SERP, one vantage)`. Also `best <service> <city>`
  lists — the AI-citation feedstock.
- Platform chatter (label `hearsay`): `"<Agency>" website slow OR outage OR "duplicate content"` in forums,
  Reddit, review sites — context for the Pattern Verdict, never evidence against a specific site.

## Phase 6 — Technical SEO & entity pass (Bane doctrine, Ahrefs-free)

Worked per site at whatever tier the site allows; every item carries its evidence label.
- **Crawl control:** robots.txt (disallows, sitemap lines, crawl-delay, AI bots: GPTBot, ClaudeBot,
  PerplexityBot, Google-Extended, CCBot, Applebot-Extended), `llms.txt` presence, sitemap index → children:
  URL count, `lastmod` freshness spread, http:// entries, trailing-slash/case duplicates, URLs that redirect
  or 404 (spot-check 5).
- **Canonical & duplication:** canonical present/self-referencing (TEXT tier shows canonical in metadata);
  www/non-www and http→https chains (RAW tier: `justice_fetch.py` records the chain — one hop is right, two
  or more is waste); trailing-slash consistency; `.htm/.aspx` legacy twins; case-variant twins; pagination.
- **On-page:** one `<title>` per page and its pattern (a shared sitewide title is a Bane repeat offender),
  title/meta length, H1 count and template, thin/boilerplate location pages, internal link count from the
  fetched text, anchor quality, image alt coverage (RAW only), viewport (RAW only), noindex leaks.
- **Headers & hygiene (RAW/local pull):** compression (br/gzip), cache-control, HSTS, CSP, X-Frame-Options,
  server/CDN identity, cookies set on anonymous GETs (cache bypass tell), TTFB over 5 samples.
- **Local/entity:** locations vs GBP map links (count, cid links present), NAP footer vs schema vs GBP,
  LocalBusiness per location page, embedded map, review widget authenticity, service-area page templating.
- **Trust & compliance (vertical-aware):** attorney bio/bar admission pages, state-bar disclaimers ("Attorney
  Advertising", specialization/certification statements), results disclaimers, privacy policy, accessibility
  statement (Lighthouse a11y score as the proxy), license numbers for trades where the state requires them.
- **AI readiness:** the robots AI-bot posture, llms.txt, question-shaped H2s, answer-first paragraphs,
  brand-fact consistency (name, address, founding year, headcount claims) across pages.

## Phase 7 — Verdicts

**Per site — six pillars, A–F, with the one-line reason:** Technical Health · Speed & Core Web Vitals ·
Structured Data · Index Hygiene & Content · Local/Entity · AI Readiness. A pillar with no evidence gets `n/a
(unverified)`, never a guessed grade. Add Win / Watch / Next: the one thing that already works, the one
thing that will hurt first, the first move.

**Portfolio — the Pattern Verdict (the reason Justice exists):** for every finding, compute prevalence
across the trial set. ≥40% of sites = **platform-level (systemic)** — a defect of the agency's templates,
hosting, tag stack or process; <40% = **site-level**. Present the systemic list first, ranked by (prevalence
× severity), each with two example URLs and the fix an implementer would apply. Then the strengths the
platform reliably delivers (honesty rule). Then the opening: what a rival could truthfully say to any of
these clients, framed as opportunity, never as a smear, and never as a guaranteed outcome.

**Severity scale:** S1 blocks crawling/indexing/rendering or misrepresents the business (lying schema,
noindex leak, edge blocking Googlebot); S2 measurable ranking/UX damage (POOR field CWV, duplicate twins,
doorway templates); S3 hygiene; S4 polish.

## Phase 8 — Deliverables (build order: CSVs → workbook → report → sweep)

1. **`Justice_<Agency>_Docket.xlsx`** (`scripts/build_workbook.py`: neutral palette, frozen headers, autofilter,
   every URL a live hyperlink — the operator navigates from the sheet): `Summary` (portfolio scorecard, caps, data limits) ·
   `Roll Call` (domain, disposition, sources that named it, fingerprint match, vertical, tier) ·
   `Speed Trial` (one row per URL × strategy: scores, field p75s, lab metrics, top 3 opportunities, runtime
   errors) · `Schema Tribunal` (entity, type, verdict, missing required/recommended, lying-schema flags, RRT
   link) · `Index Interrogation` (query, sample, reading) · `Findings` (site, URL link, pillar, severity,
   evidence label, finding, fix, effort) · `Pattern Verdict` (finding, prevalence %, systemic?, examples,
   fix) · `Verify Docket` (URL, tool link, what to read off) · `Sources` (every fetch and query with time).
2. **`Justice_<Agency>_Verdict.pdf` (+ .docx)** via the docx skill (read it first; US-Letter, DXA widths,
   PageBreak inside a Paragraph, no literal \n). Part I — The Trial: neutral cover · TOC · Data Limits &
   Method (first) · Roll Call summary · Pattern Verdict · Speed Trial · Schema Tribunal · Index
   Interrogation · Technical & Entity pass. Part II — Per-site briefs for the deep set (scorecard, top
   findings with links, Win/Watch/Next). Part III — Sentencing: a 90-day plan any of these sites could run
   (platform fixes first), drop-in title/meta for the audited money pages, the ready-to-paste JSON-LD, the
   robots/llms.txt block, a KPI baseline table with hedged 30/60/90-day ranges labeled estimates. Charts
   (matplotlib): pillar heatmap across sites, field-CWV distribution, prevalence bars for systemic findings —
   plot numeric x and re-apply tick labels after styling (the two Bane chart bugs).
3. **`tasks_<site>.csv`** per deep-audit site (Asana-ready per the Finale spec in `SKILL.md`: headers exactly
   `Name,Description,Section/Column,Priority,Tags`; the affected URL goes in Description) and `disavow` — never:
   Justice has no backlink data and builds no disavow (Bane fallback rule).
4. **`omega_cache/<agency>/`** kept intact for the incremental re-run, plus the exact local-pull
   command for the operator (below).

## Phase 9 — Verify, sweep, ship

Open the PDF: cover, TOC, one table page, one chart page, one code page. Re-check TOC numbers after any
pagination change. Cross-check ten headline numbers against the raw PSI JSON and the CSVs. Confirm every
hyperlink in the workbook resolves to the URL the finding is about. Run the brand sweep (Law 5) over every
file at zero hits. Deliver with: the judgment-call block, the three systemic findings that matter, the one
site in the worst shape and the one in the best, data caveats (tiers, missing key), and the first move.

## The local pull (operator's machine, for TEXT/WAF sites)

```bash
# Copy scripts/ to your machine (Python 3.9+). From the folder holding it:
pip install curl_cffi brotli zstandard                      # the Chrome TLS/HTTP2 impersonation engine (playwright too, for renders)
python3 scripts/justice_fetch.py --selftest --cache omega_cache/<agency>    # should print presence H2 from a home or office line
python3 scripts/justice_fetch.py --robots --out omega_cache/<agency>/html $(cat urls.txt)
PSI_API_KEY=<your key> python3 scripts/justice_psi.py urls.txt --out omega_cache/<agency>/psi
python3 scripts/satchel_web.py scan --out omega_cache/<agency>/web $(cat urls.txt)
# zip omega_cache/ and attach it; the re-run ingests it and completes the Schema Tribunal, header forensics and Speed Trial.
```

## Fallbacks and refusals
- Fetch blocked / WAF: tier the site, audit from the outside, hand over the local pull. Never route around.
- No PSI key: Lighthouse on RAW sites (lab only, labeled), Verify Docket for the rest. Never a remembered score.
- Search tool returns nothing for a footprint phrase: log the null, try the next phrase variant, and say recall
  is bounded. Never pad the Roll Call with guesses.
- A user asks for Ahrefs, Semrush or a connector "just this once": decline inside Justice and point them to
  the skill built for that; Justice's whole claim is that it needs none of them.
- Asked to solve a challenge, use proxies or rotating IPs, replay a person's cookies, spoof Googlebot beyond the
  opt-in cloaking diff, or scrape Google/Bing/TinEye/Lens result pages: no. Wetware presents as a person; it does
  not impersonate one past a wall. Offer the local pull and the manual links instead.