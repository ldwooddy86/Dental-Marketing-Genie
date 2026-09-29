
# RECKONING — the audit movement of UltimaWeapon

*Every number accounted for, every rival on the record, ninety days to settle it.*

Read this file when UltimaWeapon runs a Reckoning (full audit), a Ground War (local lane), an Autopsy
(speed / bots), Follow the Money (paid media) or The Tally (recap). The Articles that govern every
movement live in `SKILL.md` and are not repeated here; what follows is the Reckoning's own procedure.
Bundled tools: `scripts/classify_links.py` (Phase 4) and `scripts/timing_sweep.sh` (Phase 8).

A reckoning is the day the books get opened. This skill opens them on any domain and its market:
one shared data spine, five lanes. It diagnoses the site (technical, content, local, links, AI
visibility), puts every competitor on the record across organic AND paid (Google, Meta, TikTok,
LSA), screens the local market for listing-integrity problems, and hands the owner a do-it-yourself
90-day plan to settle the score. It never invents a number, never quotes a proprietary authority
score, and never touches a connector: no Ahrefs, no Semrush, no Gmail, no Drive, no MCP tool of any
kind. Everything traces to a first-party export the user uploads, a fetched page, a public API that
actually answers from this environment, a user-captured screenshot, or a manual protocol with the
exact URL. Deliverables are brand-neutral, always (metadata-scrubbed, no branded mode exists) so
they can be handed to a client, a prospect, or a friend as their own.

The swagger lives in this file. The client's report stays plain, calm and evidence-led — a
reckoning is credible precisely because it never has to shout.

## Articles (pointer)

The Articles — integrity, evidence classes, CONFIRMED / CANDIDATE / CLEARED, no proprietary authority
scores, no connectors, neutral colors, plain voice, fetch discipline — are in `SKILL.md`. Apply them to
every line below. Three Reckoning-specific reminders: column headers name the source and date, never a
bare "Volume" or "Traffic"; DR / DA / AS never appear in a grade or a sentence (authority is referring
domains, link quality, brand footprint and tenure); every finding and task row carries a clickable link
to the affected page.

## The terrain — what answers from here (tested) and the access ladder

**UltimaWeapon addendum:** the bundled wetware fetcher (`scripts/justice_fetch.py`) and render probe
(`scripts/satchel_render.py`) are the default for every target page and sit above the sanctioned fetcher in the
fetch ladder (SKILL.md); both present as a person in a desktop browser (`references/wetware.md`), so JSON-LD,
headers, tag stacks and redirect chains ARE observable wherever the target answers a visitor from this vantage;
where it does not (WAF, challenge, proxy refusal) the rules below apply unchanged and the wall carries the
measured presence tier. The sanctioned fetcher stays for statutes, policies and directories, and is a labeled
last resort for a target page.

**Works via the sanctioned fetcher:** client and competitor pages (extracted text + metadata, not
raw HTML — JSON-LD, script tags and real Core Web Vitals are invisible to it), robots.txt, XML sitemaps,
directories (BBB, Yellow Pages, chambers, Expertise-type listicles), state licensing and
Secretary-of-State portals (many), Wikipedia city pages (population proxy),
`https://archive.org/wayback/available?url=<url>` (earliest-capture ordering; the full CDX and
archived page bytes are NOT reachable), and **Google Autocomplete JSON**:
`https://suggestqueries.google.com/complete/search?client=firefox&q=<query>` (returns the live
suggestion array — the free keyword-discovery engine of this skill). PageSpeed Insights
(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<url>&strategy=mobile&key=<key>`)
answers reliably only WITH a free API key (keyless calls 429 almost immediately — try once, never
retry); with a key it returns Lighthouse lab data and CrUX field p75 LCP/INP/CLS/TTFB.

**Fetch-gating:** a cold fetch of a URL not first surfaced through search can be refused. For
every domain-level test (redirects especially) use the sequence: WebSearch the bare domain (or
`"domain.com" <trade> <city>`) → fetch the URL that came back → on `REDIRECT DETECTED`, quote the
tool's redirect line verbatim as the evidence, then fetch the target. A domain that never surfaces
in search is NOT TESTED, not clean.

**Blocked — manual protocol or screenshot only:** google.com/search, Google Maps, Google Trends,
the Google Ads Transparency Center (loads as a JS shell), the Meta Ad Library, the TikTok
Commercial Content Library, TikTok profiles and the Creative Center detail views, Facebook /
Instagram profiles, Yelp pages (search-result titles still expose name/address), most review
widgets. WebSearch results are a discovery SAMPLE — competitor set, brand mentions, verbatim-phrase
provenance, shared-identifier lookups — never rank data; positions are never quoted from it.

**Screenshot ingestion is a first-class source.** The user can paste screenshots of the Meta Ad
Library, Ads Transparency Center, TikTok library / Creative Center / profiles, Google SERPs and the
local pack, Maps listings, GBP Insights, Trends, or review panels. Read them, extract every field
into the workbook, and label each value "screenshot (user-captured <date>)". Ask for the specific
screenshots the run needs, in one batched request, with the exact URLs to open.

**The access ladder (state the run's tier in Scope & Data Integrity):**
- **Tier 0 — fetch only:** site inspection, sitemap inventory, autocomplete demand map, competitor
  page architecture, AI readiness, listing-integrity web tests, ad-library manual protocols. No
  rankings, no traffic, no disavow.
- **Tier 1 — + Search Console and GA4 exports:** real queries, impressions, clicks, positions,
  landing pages, conversions, AI referrals; money-vs-informational split; position bands.
- **Tier 2 — + crawl export (Screaming Frog / Sitebulb), PSI key, user-run timing sweep:**
  measured response times, headers, duplicate titles, status codes, Core Web Vitals.
- **Tier 3 — + link exports (GSC Links, Bing Webmaster, or a third-party file), ad-library
  screenshots, rank-tracker export, Google Ads Auction Insights:** disavow unlocked, paid-intel
  matrix populated, rank tables real.
Optional third-party SEO/ad-intel exports (Semrush, Moz, Majestic, SpyFu, SE Ranking, Ahrefs, ad
spy tools) are ingested only as FILES the user uploads, labeled as vendor estimates, and never
required by any step. The skill never pulls them itself: no connector, no API call, no MCP tool,
ever (see the No-connectors article).

## Five lanes, one spine (pick by request; SKILL.md routes into them)

1. **Full Reckoning** (default) — Phases 0–10, all modules, Part I the Diagnosis + Part II the Playbook.
2. **Ground War** (local lane) — Phases 0–3 + 5–6 trimmed to the local market, plus the listing-integrity screen.
3. **Autopsy** (technical forensic lane) — "why is it slow / is it bots": Phase 8 with a chat verdict.
4. **Follow the Money** (paid-media lane) — Phase 6 alone: what the rivals are running on Google, Meta, TikTok, LSA.
5. **The Tally** (recap lane) — monthly 5-5-5 or quarter-to-date report from exports + the last Reckoning.

## Phase 0 — Set the terms (ask, or state assumptions plainly if unattended)

Establish: domain + client name (fetch the homepage to confirm the business); business type
(local/service-area → local module on, center of gravity "[service] [city]" + the local pack;
national / e-commerce / SaaS → local module off, competitor set widened); market geography (expand a
ZIP to its city and neighbors, a county to its incorporated cities AND named unincorporated
communities); competitor set (auto-discovered in Phase 3/5 plus any the user names); disavow
strictness (conservative default when no traffic/anchor data exists, moderate when it does,
aggressive only on request); fetch budget (~40–60 default); which exports and screenshots the user
can supply (send ONE batched request listing exact export paths: GSC Performance → Queries + Pages,
16 months (the UI export caps at 1,000 rows; a Looker Studio or Search Console API export lifts
it); GSC Links → Top linking sites + Latest links; GSC Core Web Vitals; GA4 landing pages + session
source/medium; Google Ads Auction Insights + Search terms if they run ads; existing disavow file;
GBP Performance; crawl export; PSI key). Two things are never asked because they do not exist in
this skill: a connector or Ahrefs option, and a branding mode. Create the task list. Note the season
(Phase 3 seasonality frame).

## Phase 1 — Open the ledger (pull once; every module draws on it)

1. **Site inventory:** fetch robots.txt and every sitemap (index → children). Record URL count by
   type (service / city / blog / other), lastmod freshness, orphan candidates (sitemap URLs with no
   nav path), and the URL-pattern families. This inventory replaces a crawler's page list at Tier 0.
2. **Tenure:** Wayback availability for the homepage (earliest capture) — the honest age proxy.
3. **Demand map (Autocomplete grid):** for each seed "[service] [city]" and "[profession noun]
   [city]", pull suggestions for the bare seed plus a few high-value suffixes ("near me", "cost",
   "best", "emergency", "reviews"); reserve a–z expansion for the 2–3 primary money seeds and only
   within the fetch cap the user approved (every suggestion call is a fetch). De-duplicate; the
   presence and ordering of suggestions is the demand signal (no volumes are implied). Keep the raw
   JSON.
4. **Search Console (Tier 1+):** classify every query as money (service+geo, "near me", pricing,
   "best", "emergency") vs informational; compute the money-vs-informational share of clicks AND
   impressions (a 90%+ informational site is "ranking for the wrong things" — headline finding);
   position bands (1–3 / 4–10 / 11+) by month; page-level winners; **impressions-vs-clicks
   divergence** over 16 months (impressions up + clicks down + positions flat = zero-click / AI
   Overview absorption, not a ranking loss — the context metric that prevents a wrong diagnosis);
   striking-distance list (positions 4–15, impressions ≥ a threshold you state).
5. **GA4 (Tier 1+):** organic sessions and conversions by landing page; AI referrals
   (chatgpt.com, perplexity.ai, gemini.google.com, claude.ai, copilot.microsoft.com) — a floor, not
   a ceiling; paid landing pages if they run ads.
6. **Links (Tier 3):** parse GSC Links (linking sites, target pages, latest links with dates), Bing
   Webmaster backlinks (has anchors), any third-party file; existing disavow file (download from
   GSC; merge, never replace). This single parse feeds Phase 4 and the link-gap work.

## Phase 2 — Walk the property (live site inspection, five lenses)

Fetch the homepage, 2–3 money pages, the blog hub, one templated page (a city page if local),
plus the pages the exports flag (top landing pages, striking-distance pages). Work the checklist;
(T) marks template-site patterns that recur on Elementor/Divi/local-service builds and repay a
check every time. Each finding = what / evidence (quoted) / why it matters / fix / link.

**Content:** title + meta present, benefit-led, right length, compared against the live
competitors' titles for the money term; homepage title targeting the region instead of the primary
money city (dilutes the highest-value signal); conflicting trust claims across pages (years in
business, "since", "combined experience") (T); duplicated paragraphs and identical testimonial
blocks on every page (T); cannibalization (a service-nested city page vs a /service-area/ page for
the same city); doorway risk (50+ templated city pages → tier: rewrite the ~10 nearest /
highest-impression cities with genuinely local content, hold the middle, consolidate zero-traffic
outliers only after data confirms which is which); FAQ blocks present but unmarked; blog cadence,
stale categories, posts→money-page links with descriptive anchors; thin/spun/AI-boilerplate city
copy (quote one bad example verbatim — nothing convinces an owner faster).

**Technical:** mega-nav rendered 3–4 times in the DOM with 50+ location links (T); `-2` suffix and
trailing-slash duplicates, truncated slugs, coexisting slug patterns (T); self-referencing
canonicals, robots meta, sitemap hygiene (canonical URLs only); Elementor query-string pagination
discoverability (T); schema (invisible to extraction → "verify LocalBusiness/{vertical}, Service,
FAQPage, BreadcrumbList via the Rich Results Test" tasks, never "missing"); og:image mismatches and
undersized cards (T); tel: chaos — hyphenated vs bare hrefs, 3+ numbers per page; distinguish
deliberate call tracking (fine — verify GBP/schema carry the canonical number) from NAP drift (T);
clone-and-forget pages shipping the source page's title/meta and placeholder headings while
index,follow — check the hero CTA target (T); legacy-domain 301s landing on http:// (two-hop chain
for every old backlink) (T); competing hub pages (nav vs footer pointing at different hubs) and
orphan parents (T); month-level date archives and a live "Uncategorized" category (T); honeypot
labels leaking as visible text (T); old brand name in titles/schema after a rebrand (T); exposed
nonces/tokens in public meta. Optional provenance flags, CANDIDATE ceiling, never the words
"stolen" or "infringement": stock-agency watermarks in production images, hotlinked assets from
another company's domain, template placeholders shipped live ("Fluff content about…"), nulled-theme
fingerprints in asset paths.

**UX:** lead-form friction — count required fields; address and "are you a new customer?" are
dispatch questions, not capture questions; target 4 fields or a 2-step phone-first form (T);
consent-language drift across forms (TCPA) (T); breadcrumbs; CTA inventory (usually a strength —
credit it); trust assets (license numbers, certifications, named technicians, localized reviews);
a "Loading reviews…" placeholder = client-side review injection invisible to crawlers.

**Speed:** never claim a score you did not measure. PSI with key on the top ~10 pages (lab +
field), else the Phase 8 timing sweep, else a verify task with the PSI URL. Stack inference from
generator meta; self-hosted MP4 heroes (T); image dimensions/CLS, lazy-load, formats (credit WebP);
GTM/pixel inventory; duplicated nav DOM is a speed fix too.

**Mobile:** viewport, breakpoints, tap-to-call; off-canvas nav burying services and phone under a
full location list (T) → prescribe call button, booking, ~5 categories, one Service Areas link;
carousels (CLS + mis-taps); sticky-header viewport cost.

**What is already working** — a required subsection in every module; a reckoning credits as hard as it cuts.

## Phase 3 — Ground war (local module, for local/service-area businesses)

Thesis: rank for money keywords, win the local pack, convert. Informational traffic is supporting
cast.

**A. On-site local signals:** NAP consistency (every phone number anywhere on the site; header
tracking line vs footer main line is a classic defect — explain the GBP-matching risk); service-area
inventory (cities WITH pages vs cities claimed with none — the gap list is the city-page roadmap);
URL-pattern drift = partial migration (check live legacy duplicates); homepage title vs primary
money city; GBP / Yelp / Facebook links; review rendering; city-page quality.

**B. The money-keyword SERP (also competitor discovery):** the true competitive set is the local
pack + organic top 10 for "[primary service] [primary city] [state]", not a vendor's "organic
competitors" list. Sources in order: a user screenshot of the actual SERP + pack (best), a
rank-tracker export, then a WebSearch sample labeled as such. Record pack membership (is the client
in it?), LSA block members (Google Guaranteed badges), and who is beatable: a visibly smaller,
younger, thinner site outranking the client = a relevance / on-page problem, not authority — say so;
it changes the whole roadmap. The client can be IN the pack yet invisible organically (or the
reverse) — two separate battles, reported separately.

**C. Local keyword matrix:** build the grid yourself — {core service, profession noun, each
sub-service sold, "commercial [service]"} × {every city with a page, every city claimed without one,
each county; "near me" noted as GBP-dependent}. Demand evidence in descending strength: GSC
impressions → Keyword Planner export (if supplied) → Autocomplete presence/ordering → city
population (Wikipedia/Census fetch) as a proxy — the column header names which. CPC appears only
from a supplied Planner/Ads export ("$14 CPC" turns a ranking into ad-equivalent dollars). Three
tiers: **Quick wins** (page exists, ranks 4–20 in GSC or has autocomplete demand — on-page fixes),
**Build targets** (claimed-but-pageless cities with demand evidence — new pages, tiered), **Defend**
(brand terms + anything already top 3). Map every row to an existing URL or CREATE. City-page rule:
rewrite the ~10 nearest/highest-demand cities with genuinely local content (neighborhoods, local
pressure/case law/climate, techs assigned, local reviews) before building new ones.

**D. Citations and GBP:** fetch BBB, Yellow Pages, chamber, and vertical directories for the client
and each rival; record presence, NAP variants, review counts where visible. GBP items you cannot
see (categories, services, posts, Q&A, review velocity, pin) → verify tasks or a GBP screenshot
request, never assertions.

**E. Listing-integrity screen (the market, in yield order; dispositions apply):**
1. **Redirect test** — search-then-fetch every rival domain; a site resolving to a different active
   domain is an HTTP-layer fact (GBP §4). Dead/parked domains are a separate, weaker claim.
2. **Shared identifiers** — search each rival phone number; the finding is *distinct business
   names on one number* (lead-gen call center, §4), never one brand across many locations
   (franchise intake is legal). Bare address co-location is Weak; escalate only with a shared phone.
3. **Lead-gen self-disclosure** — footer phrases "lead generation service", "connecting with local
   service contractors", "we are not a", "actors or models" (ineligible under §1; the last phrase
   also opens a §6 stock-photo route).
4. **Name vs registry** — Secretary-of-State entity + county DBA search before any keyword-stuffing
   or city-name flag; a 1986 filing clears "Pest Control Center, Inc." and the CLEARED row ships.
   Never use ALL CAPS as a signal (rendering artifact). "Not found in registry" ≠ unregistered.
5. **Address type** — PMB / PO Box / suite-number mail-center patterns / known virtual-office
   towers → CANDIDATE (home-based operation is legal; the violation is display on a profile).
6. **Category relevance / doorway networks** — non-trade businesses in the category, city-swapped
   sibling domains on one host/template.
Reviews and photos are NOT ASSESSED without review data (say so; scraper APIs such as Outscraper /
SerpApi / DataForSEO close the gap at stated cost). Licensing claims require the authoritative
registry for that state AND trade (pest control sits under Agriculture in most states, California
excepted; Texas plumbers are TSBPE; Texas licenses no general contractors). Run adversarial
verification on every High-severity CONFIRMED row (default to NOT CONFIRMED unless personally
observed; COULD NOT CHECK downgrades to CANDIDATE). State coverage as a fraction ("six of nine GBP
policy sections testable from web data"), never "comprehensive". Output: roster (constructed Maps
search links, labeled constructed), findings, controls applied; route CONFIRMED items to the
Business Redressal Complaint Form as a client decision, framed as "displays / resolves to".

**Seasonality frame** (for traffic dips, review bursts, ad timing): FLAT verticals (locksmith,
garage door, appliance repair, house cleaning, veterinary, most legal; amplitude <1.35×) have no
season to hide in — never deseasonalize, any sustained 2× deviation is anomalous; MILD (1.35–1.7×:
electrician, movers, auto repair, PI law) light correction; MODERATE (1.7–2.5×: general pest,
termite, roofing, gutters, landscaping) deseasonalize; STRONG (≥2.5×: AC repair, furnace, pool,
lawn care, mosquito, snow, tax prep) deseasonalize before flagging anything. Pest control is four
sub-verticals (termite Apr–Jun, mosquito May–Aug, rodent Aug–Nov, bed bug Jul–Oct); HVAC is bimodal
with Apr–May and Sep–Oct as the double trough; plumbing is flat except event terms ("frozen
pipes"); roofing / water damage / tree service are event-gated (NOAA/FEMA triggers, not seasons).

## Phase 4 — Cut the dead weight (backlink health and disavow, Tier 3 only)

No link export → no disavow file, ever; say so and make "export GSC Links + Bing Webmaster
backlinks" Task #1. With exports, classify every referring domain into DISAVOW / REVIEW / KEEP with
reproducible signals, then do the human pass and encode every judgment in an overrides file so
re-runs are identical. Note what each source lacks: GSC exports carry no per-domain anchors (only
the aggregate "Top linking text" — use Bing Webmaster or a third-party file for anchor signals);
none carry traffic — so "zero-traffic" heuristics do not apply and the default strictness is
conservative. Confirm the nature of flagged domains by search-then-fetch
sampling (10–20 domains), and triangulate market-wide spam waves with `WebSearch` restricted to the
spam domain (`allowed_domains`) for the client's trade: a network spraying every local business is
hygiene (disavow calmly); a client-only blast with client-named anchors is an attack (disavow
urgently, monitor). A thin legitimate link base makes even market-wide spam a large SHARE of the
profile — say that rather than implying a personal attack.

Run the bundled classifier — never re-implement it:

```bash
python3 scripts/classify_links.py --input gsc_top_linking_sites.csv --input bing_backlinks.csv \
    --target example.com --strictness conservative --overrides overrides.json --outdir omega_cache/<domain>/links
```
It reads GSC "Top linking sites" / "Latest links", Bing Webmaster backlinks, or any CSV with a domain
or source-URL column; writes `buckets.json` (every domain, bucket, reason — feeds the workbook tabs) and
`disavow_<target>.txt` (house style: `domain:` lines only, sorted, unique, ASCII, no comments); prints
`validation: OK` or the failing domains. Every human judgment goes in `overrides.json`
(`force_disavow` / `force_review` / `force_keep`) so re-runs are identical.

Human pass the script cannot do: PROTECT genuine niche citations (real local businesses, community
blogs, forums, .gov/.edu, chambers, sponsorships, scraper/stat sites Google already ignores) even
when flagged; DISAVOW obvious networks the regex missed (directory clusters, article/guest-post
farms, PBN-named domains, comment-spam blasts using the same post-title anchor across unrelated
foreign domains); move real-business false positives to REVIEW. Disavow rules: `domain:` lines
only — no comments, no annotations (reasons live in the workbook); ≤100,000 lines and 2 MB; UTF-8/
ASCII; uploading REPLACES the prior file, so merge the existing one first. Google ignores most spam
automatically; reach for a disavow only with a manual action, or a large paid/PBN/negative-SEO
footprint the owner cannot get removed. A wrongly disavowed healthy link is a self-inflicted wound
— that is why REVIEW exists. Validation must print OK; every DISAVOW-tab domain is in the txt and no
REVIEW/KEEP domain is.

## Phase 5 — Know the enemy (competitor intelligence, five lenses per direct rival)

Teardown 4–6 direct rivals from Phase 3B (or the head-term WebSearch sample for national sites);
nationals and aggregators get one contextual line ("SERP furniture, not a beatable rival"), never a
teardown. Per rival capture identity (brand, tenure via Wayback, GBP presence via search snippets).

1. **SEO strategy** — fetch their sitemap: count city pages, service pages, blog posts, lastmod
   cadence; their title patterns (city+service in every title?) vs the client's; SERP-feature and
   pack ownership from the SERP screenshot; the **keyword gap** = their page targets (from slugs and
   titles) with autocomplete-confirmed demand that the client has no page for, mapped to an existing
   client URL or CREATE. Authority vs relevance: if a thinner, younger site outranks the client, the
   problem is on-page relevance — say so.
2. **Paid** — Phase 6 (the module below) fills this lens.
3. **Social** — profile links from their footer; record only what is observable (platform,
   follower count if visible, last-post date, cadence, themes, video use, TikTok presence); blocked
   profiles are "not accessible from this environment", never "inactive"; review counts and ratings
   where snippets or directories expose them, else a manual benchmark task.
4. **Links and citations** — from any link export for the client plus brand-mention searches for the
   rivals: source pattern (editorial / citations / sponsorships / spam), link magnets (pages other
   sites mention), the **link gap** = directories, chambers, suppliers, local press that carry ≥2
   rivals and not the client (fetch the directories to confirm) — an acquisition to-do list, each row
   with an action.
5. **Technical** — their homepage + one money page: stack, title/meta targeting, nav architecture,
   review rendering, form friction, obvious speed tells; PSI with key on 1–2 rival homepages for a
   CWV comparison if available, else a verify task.

Every teardown ends with **Steal this** (1–3 replicable moves that reappear in the roadmap with an
effort estimate) and the exec summary carries a one-line threat ranking: the single rival most
likely to take share and why. Lead with value-per-visit where it favors the client — a small site
winning high-intent money terms out-earns a big informational site per visit.

## Phase 6 — Follow the money (paid-media intelligence: Google · Meta · TikTok · LSA · own account)

None of the ad libraries answer to the fetcher, so this module runs on (a) screenshots the user
captures from the exact URLs below, (b) the client's own ad-account exports, and (c) manual
protocol rows with exact URLs for whatever remains. Every value is dated; ad libraries are
snapshots and counts change daily.

**Google Ads Transparency Center** — `https://adstransparency.google.com/?region=<CC>` then search
the rival's bare domain (matches ads by landing host; the resulting URL `?region=<CC>&domain=<domain>`
is shareable) or the advertiser name. Retains roughly 13 months of standard ads; the date filter
defaults to the last 30 days — widen it. Covers Search, Shopping, Display, YouTube (incl. Shorts),
Gmail, Maps and Play ads; shows verified advertiser name + country; shows NO spend, targeting,
keywords or performance for commercial advertisers (political ads carry payer and spend ranges).
Capture per rival: verified name + status; ads by format (text / image / video / product listing);
first- and last-shown dates; regions; text-ad headlines and descriptions (their keyword intent,
offers, and whether they name the CLIENT's brand — brand bidding); video ads (YouTube presence);
display creatives; the landing-host preview on each card.

**Meta Ad Library** — `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=<CC>&q=<brand>&search_type=keyword_unordered&media_type=all`
(or open the Page's ads via "See all" on its Page transparency panel). Capture per rival: active ad
count; for each ad or ad family: Library ID, "Started running on" date, platforms (Facebook,
Instagram, Messenger, Audience Network, Threads), "N ads use this creative and text" (variation
count), format (image / video / carousel / collection), primary text hook, headline, CTA button,
landing URL and whether it is a dedicated LP, offer, creator/UGC style, Spark-style creator handle;
Page transparency (page created, name changes, admin countries). EU targets additionally expose
reach, age/gender/location breakdowns and beneficiary/payer under DSA. The Ad Library API
(`ads_archive`) is optional advanced access: political/issue ads everywhere and all ads for EU
audiences, requires a verified developer identity.

**TikTok** — three surfaces: (1) **Commercial Content Library** `https://library.tiktok.com/ads`
— search by advertiser or keyword; it covers paid ads served in the EEA, UK and Switzerland ONLY,
so a US-only rival will not appear: an empty result there is NOT COVERED, never "no ads". Where
covered, capture advertiser (handle + verified business name), first/last shown, bracketed reach,
country breakdown, targeting summary (age, gender, location, interest categories) and the creative.
(2) **Creative Center** `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en` —
the US-relevant surface: Top Ads by region / industry / objective / format (curated, engagement and
CTR bands; requires a free TikTok for Business login), Keyword Insights (ad-keyword popularity and
CTR ranges) and Trends (hashtags, sounds, creators by region and industry) — the vertical-level
read on what creative wins even when a rival runs nothing. (3) **Organic profiles**
`tiktok.com/@handle` — followers, likes, video count, cadence, local-content themes (before/after,
techs in the field), whether the client has any presence at all; for most local trades the organic
playbook precedes paid. Also note the **LinkedIn Ad Library** (`linkedin.com/ad-library`,
searchable by company, useful for B2B/fintech) and the **Microsoft Ad Library**
(`adlibrary.ads.microsoft.com`, EU-focused), one line each when relevant.

**Local Services Ads and Yelp** — from the SERP screenshot: LSA block members, Google Guaranteed /
Screened badges, review counts shown; Yelp "Sponsored" tags on rival listings. No library exists;
screenshot-only, dated.

**The client's own accounts (when they run ads):** Google Ads **Auction Insights** (impression
share, overlap rate, position-above rate, top-of-page rate, outranking share — the only direct
measure of rival paid pressure), search-terms report (which rival brands searchers type), Meta Ads
Manager breakdowns, landing-page conversion rates from GA4. Request these in the Phase 0 batch.

**Interpretation rules:** longevity is the winner signal — an ad running 90+ days (Meta start
date, ATC first-shown) has paid its way; many variants of one concept = active testing, one
evergreen = a proven winner; dedicated landing pages with stripped nav and message match = a mature
program, homepage-as-LP = beatable on Quality Score and conversion; classify hooks (price anchor,
guarantee, urgency, financing, social proof, before/after, fear/pain, local identity, seasonal) and
offers; platform mix and format mix; rival text ads carrying the client's brand name = brand
bidding (defend the term — a client decision with cost); zero paid activity across all direct
rivals on high-intent money terms = a stated **first-mover opportunity**, not filler; heavy paid +
weak organic on a rival = they are renting what the client can own; ad copy claims that would breach
vertical advertising rules (bar rules, TCPA consent on LPs, financing disclosures) are CANDIDATE
observations, never verdicts. Paid aggressiveness tier per rival: **Dormant** (nothing active
anywhere) / **Light** (one platform, <5 active) / **Active** (two platforms or 5–20 active) /
**Heavy** (three+ platforms, 20+ active, or LSA + Search + social together).

**Outputs:** the **Paid Intel matrix** (per rival: ATC active Y/N + formats + first seen; Meta
active count + earliest start + platforms + top hooks + LP type; TikTok ads Y/N + organic followers
and cadence; LSA Y/N; tier; dated source); a **Swipe file** of the 8–12 strongest rival ads
(platform, rival, running since, hook, offer, CTA, LP, why it likely works, how the client adapts
the mechanism — never copy the creative or copy text itself); **Client moves** (3–5: first-mover or
defend, LP fixes, offer parity, retargeting, a TikTok organic-first plan for local trades, a
measurement baseline); and the **verify queue** with one exact URL per rival per library.

## Phase 7 — Be the answer (AI visibility: readiness, citable footprint, prompt tracking)

Readiness from fetches: robots.txt posture for GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot,
Google-Extended, Bingbot, Applebot-Extended, CCBot, Bytespider (AI Overviews and AI Mode use
Googlebot — no separate switch); llms.txt presence; schema types (verify tasks); answer-first,
question-shaped content; brand-fact consistency (name, address, hours, prices, founding year across
site, GBP, directories). **Citable footprint:** WebSearch "best [service] [city]", "[service]
[city] reviews", "top [profession] near [city]"; fetch the listicles, directories, local news and
forum threads that come back; record whether the client and each rival appear; the client's share
of citable sources IS the AI-visibility proxy (AI answers are assembled from exactly these pages).
**Prompt tracking:** write 10–25 buying-intent prompts ("who is the best emergency plumber in
Hutto TX", "is [client] legit", "[service] cost in [city]") and ship a Prompt Tracker tab (platform
× prompt × brand mentioned / site cited / rivals named / sources cited / date) for ChatGPT search,
Google AI Mode + AI Overviews, Gemini, Perplexity, Claude and Copilot — run it if the user gives
you screenshots, otherwise it is the client's monthly protocol. GA4 AI referrals reported as a
floor. If one platform reads zero across the whole field, say it is niche-wide, not client-specific.
Zero citable-source coverage while a rival appears in every listicle = a Watch item.

## Phase 8 — Autopsy (technical forensic lane: why it is slow; is it bots)

Diagnose *why*, not just *that*. Never fabricate speed numbers; name the measurement source for
every claim (user-run timing sweep, PSI lab, CrUX field, crawl export, host logs).

**Inputs ladder:** (1) **User-run timing sweep** — hand the user `scripts/timing_sweep.sh` (macOS Terminal, Linux, Git
Bash or WSL on Windows; curl only) and ask for `timing_<label>.csv` and `headers_<label>.txt` back, run twice
~10 minutes apart and once at a different time of day (the second run reads the cache-warm state):
```bash
# urls.txt = 60–150 URLs sampled from the sitemap: homepage, top pages, deep blog posts, date archives, pagination, one redirect
./timing_sweep.sh urls.txt https://example.com cold          # then again ~10 min later as "warm", and once as "evening"
./timing_sweep.sh urls.txt https://example.com quick fast    # shorter pauses when the owner is in a hurry
```
The sweep presents as a current desktop Chrome — full header set, client hints, a cookie jar, the previous URL as
Referer, jittered pauses — because a bare tool UA on a one-second cadence is exactly what a WAF challenges, and a
challenge page's timing is not the site's timing. Never hand out a bare-UA curl loop.
(2) crawl export with response time, status, size, redirect chains and, if enabled, headers;
(3) PSI with key (server-response-time audit, TBT/LCP/INP/CLS lab + CrUX p75 field); (4) GA4 daily
users/sessions for the affected window; (5) host access logs or host bot dashboards (the only
definitive bot attribution); (6) pasted view-source for 2–3 templates.

**Read the distribution (the diagnostic heart):** bimodal (ms for some pages, 1s+ for the rest) =
cache hit vs miss — the site "feels intermittent" because visitors bounce between edge and origin;
a long tail of 15–30 s TTFBs on random URLs all returning 200 = origin queue / PHP-worker
saturation, not page weight — a plain 301 taking 15 s is the clincher (redirects served by CMS
plugins boot PHP); uniform slowness everywhere including cached pages = host/network layer. Which
URLs stall matters: empty date archives, deep pagination and decade-old posts are machine-walk URLs
humans never visit. **Headers:** cache markers (`x-cache`, `cf-cache-status`, `x-proxy-cache`,
`sg-f-cache`, `x-cacheable`, `age`), `Cache-Control` on HTML, and — critically — `Set-Cookie` /
`PHPSESSID` on ordinary pages (a plugin starting a session per view forces `BYPASS` for everyone;
this single check has flipped verdicts).

**Bot fingerprint (state all four):** strained origin with no analytics spike (the load runs no
JS); stalled URLs are machine-walk URLs; human visitors *dropping* as strain peaks; the site never
fully goes down. Separate **config problem** (cache-bypass headers + uniform slowness: ordinary
traffic is enough to hurt) from **load problem** (rotating slow subsets + analytics-invisible load).
Defensible framing: "the cache configuration made the site fragile; crawler load exposed it" — not
"you are being attacked" when a session cookie disabled caching. The fingerprint distinguishes
aggressive automated crawling (the AI-crawler pile-up pattern) from volumetric DDoS, but *which*
bots requires host logs (top user-agents, URLs, IPs for the window) — every verdict ends with that
confirmation step. A robots.txt blocking nothing is itself a finding.

**Tag stack and bloat (from pasted source or crawl data):** count GTM containers (duplicates are
common — the canonical install is a minified snippet high in `<head>` with its noscript right after
`<body>`; a hand-pasted, un-minified snippet with a noscript mid-body is a legacy leftover; publish
history needs 30 seconds in GTM's Versions tab, and warn against deleting a container unread);
hardcoded gtag / AW- IDs, pixels, call tracking; inline `<style>`/`<script>` sizes, Google Fonts
requesting every weight, duplicate jQuery, IE-era polyfills, free+pro plugin pairs, cache-buster
query strings on assets; DOM node count vs Lighthouse's excessive-DOM line (~1,400 nodes); note
explicitly when nothing approaches Googlebot's 2 MB HTML crawl limit (Google's February 2026 doc
update; other Google crawlers default to 15 MB) — calibrated findings build trust.

**Delivery:** chat first — bottom line in two sentences → what is healthy → numbered findings with
hard numbers → what it is NOT → prioritized fixes each naming the exact lever (setting, portal page,
plugin toggle, robots line) → the confirmation steps needing host/GTM access. A 2–3 page PDF on
request (front-loaded bottom line, before/after table, verdict, actions, housekeeping).

## Phase 9 — Forge the deliverables (order: charts → workbook → CSV → disavow → report)

**Charts** (matplotlib, neutral palette; standard set drawn only from data actually held):
competitor referring-domains hbar with the client row highlighted (replaces any authority-score
chart); GSC clicks-vs-impressions 16-month line (the demand-vs-traffic divergence picture);
position-bands stacked by month; refdomains-over-time line with anomaly windows shaded (from link
export dates); citable-source coverage hbar (client vs rivals; zero rows in red); paid-activity
timeline (ads started per month per rival, from screenshots); local-pack membership grid. Two bugs
to pre-empt: plot NUMERIC x so duplicate month labels (two "Aug") do not collapse into one
category, and re-apply categorical tick labels AFTER any shared styling helper; stack delta
annotations at a different y-offset from value labels.

**Workbook** (.xlsx via `scripts/build_workbook.py` from one JSON spec; follow the xlsx skill's recalc /
zero-formula-error standard if formulas are added): Summary ·
Data Sources & Coverage (tier, every source with date) · Findings (module, severity, evidence,
fix, clickable URL) · Keyword Matrix (tier, keyword, demand source + value, current GSC position,
mapped page or CREATE) · Top Pages · Competitor Matrix (client row highlighted: tenure, sitemap
pages by type, city pages, refdomains if known, review count found, platforms active, paid tier,
citable-source coverage) · Keyword Gap · Link Gap · Paid Intel · Swipe File · Prompt Tracker ·
Listing Integrity: Roster / Findings / Controls Applied · DISAVOW / REVIEW / KEEP · Verify Queue
(exact URL + what to check, one row per blocked or unverifiable item).

**Task CSV** (Asana-importable; headers exactly `Name,Description,Section/Column,Priority,Tags`;
UTF-8 no BOM; straight quotes; no blank rows; Priority only High/Medium/Low): Name imperative and
specific (≤70 chars); Description self-contained — what, exact URLs, why, "Est: 3h", `BLOCKED BY
Task N`; Sections: Critical Fixes, Technical SEO, Content, Local SEO, Links & Citations, Paid
Media, Competitive Moves, Speed & CWV, UX & Mobile, AI Visibility, Data & Verification. Row order =
roadmap order; the roadmap table and the CSV match row for row. Prioritization: (1) data
restoration / access (Task #1 whenever a source was missing; content tasks BLOCKED BY it), (2)
structural fixes others depend on, (3) measurement baselines, (4) high-leverage CRO (form friction —
especially where paid traffic lands), (5) schema, crawlability, rewrites, (6) polish, with sub-30-
minute quick wins labeled for batching.

**The Book (master report)** — read the docx skill first (US Letter, DXA table widths, ShadingType.CLEAR,
LevelFormat.BULLET, PageBreak inside a Paragraph, PositionalTab dot leaders, never a literal `\n`);
render to PDF; 16–24 pages for a full Reckoning. The cover carries a plain client-facing title
("Full SEO & Competitive Audit") unless the user wants the Ultima Weapon name on it.
- **PART I — THE DIAGNOSIS:** Cover (neutral, always) · TOC (static numbers: build →
  measure with `pdftotext` per page → rebuild, measured WITH the TOC in place; re-verify after any
  pagination change) · Executive Summary (≤1 page: 2–4 plain sentences; seven-pillar A–F scorecard
  — Technical · Content & Top Pages · Local · Authority & Links · Competitive Position · Paid Media
  Position · AI Visibility — one-line justification each; Win / Watch / Next; the one rival to watch;
  the one paid opportunity) · Scope & Data Integrity (tier, sources with dates, observed / inferred /
  unverified, what was blocked) · Where You Stand · Technical SEO & Site Health · Top Pages · Local
  SEO + Listing Integrity · Backlink Health & Disavow · Competitor Intelligence (matrix, teardowns,
  keyword gap, link gap) · Paid-Media Intelligence (matrix, swipe file, client moves) · AI
  Visibility · Technical Performance.
- **PART II — THE 90-DAY PLAYBOOK:** phased plan + a 12-move table (P1 doable in 30 days; impact,
  effort, owner Agency/Client, timeframe); on-page fixes — a drop-in title (~60 chars) AND meta
  description for EVERY page in the inventory; ready-to-paste JSON-LD (LocalBusiness/{vertical},
  Service, FAQPage, Organization) filled with the client's real facts; exact 301 rules and
  self-referencing canonicals for the duplicates found; the content offensive — a 12-week, 20–24
  piece plan (working title, target term + demand evidence, target money page, word count) with each
  piece structured to rank and be cited (answer in the first two sentences, question-shaped H2s,
  FAQ schema, descriptive internal link to the money page — link targets verified against the live
  sitemap); local — GBP optimization checklist, citation build list from the link gap, review
  velocity plan, redressal filings for any CONFIRMED rival violation as a client decision; authority
  — disavow submission steps (merge semantics), outreach target groups, two ready-to-send email
  templates; paid — a campaign brief built from the swipe file (hooks, offers, LP fixes, brand
  defense decision, first-mover terms, TikTok organic-first plan where relevant); AI — a full
  llms.txt draft, the robots.txt AI-bot allow block, the brand-fact checklist, the prompt set;
  measurement — analytics events, a KPI baseline table, hedged 30/60/90/180-day milestones.
- **Appendices:** keyword matrix, keyword gap, link gap, swipe file, listing-integrity roster and
  controls, printable master task checklist, full disavow list.
- **Glossary** on its own page: EVERY metric in any table gets 1–3 sentences with the why-it-matters
  built in (referring domains beat raw backlink counts; impressions vs clicks; local pack; NAP;
  citation; canonicalization; Core Web Vitals; llms.txt; schema; disavow; impression share; ad
  library; CANDIDATE vs CONFIRMED), adapted to the client's vertical.

**The Tally (recap lane formats)** (monthly; deep dive or last Reckoning first — never guessed):
- **5-5-5:** headline result, then 5 Wins (each scanned across THREE surfaces: Google — GSC clicks /
  impressions / positions, pack movement; AI — citable-source or prompt-tracker movement, or the
  honest zero plus the plan; Social/GBP — posts, reviews, reputation; add a Paid line when the client
  runs ads), 5 Things We Did (outcome-led, plain language), 5 Things We Will Do (each tied to a term,
  a surface, and a date). Internal-only detail (ticket owners, tech debt) stays out of the client
  version.
- **Quarter-to-date report:** four pillars (Technical, Content, Authority, AI) plus Local and Paid
  when relevant; every KPI table shows the quarter's months as columns with MoM and Qtr-Δ; a month's
  value is the snapshot dated the 1st of the following month; early in a quarter show only completed
  months and label the latest "(month to date)"; call out single-month anomalies so they are not
  read as trends; investigate any sharp move before reporting it (migration, rebrand, tracking
  change, index reprocessing) and mark distorted values with an asterisk plus a verification task;
  8–10 pages, chart set from Phase 9, same glossary rule. Annual variant: four quarterly columns
  with QoQ and YoY deltas, same table structure.

## Phase 10 — Settle the account (verify, then ship)

Render docx → PDF → `pdftoppm` and view: cover, TOC, one table-heavy page, one chart page, one
code-block page, the roadmap; fix blank-page (a section exactly filling a page + explicit PageBreak)
and orphan issues; re-check TOC numbers. Cross-check every headline number against the raw exports
and screenshots. Confirm classifier validation printed OK and the disavow.txt equals the DISAVOW
bucket exactly. CSV format check. Run `scripts/brand_sweep.py` over every file; zero operator tokens is the
gate. Confirm the run made no connector or MCP call (if one slipped in, the numbers it produced are
struck from the deliverables and replaced with verify tasks). Deliver all files with a short
summary: top 3 findings, the single biggest competitor threat, the single biggest paid-media
opportunity, data caveats, and the first-sprint move — no long postamble. Then the account is
settled and the Finale (SKILL.md) takes over.

## When the ground shifts (fallbacks and toggles)

| Situation | Adjustment |
|---|---|
| Tier 0 (no exports, no screenshots) | Run everything fetchable; every ranking/traffic statement is inferred and labeled; Task #1 = grant GSC/GA4 access; no disavow; paid module ships as protocol rows |
| National / e-commerce / SaaS | Skip Phase 3; competitor set from head-term samples and the user's list; "local pack" language out; paid module weighted to Google Shopping/YouTube and Meta |
| One module requested | Run that lane, still do Phase 1 (the shared spine), ship the report trimmed to it |
| Tiny site (<10 pages, few links) | Collapse Top Pages to all pages; say a disavow is unnecessary rather than manufacturing one |
| Existing disavow file in GSC | Ask for it; merge, never replace |
| Ad library empty for a rival | "No active ads observed on <date> in <region>" — never "they don't advertise"; check region coverage first (TikTok especially) |
| Fetch refused for a URL | Verify task with the exact URL and what to check, or a screenshot request |
| Blocked profiles / review widgets | "Not accessible from this environment" + manual benchmark task |
| User offers Ahrefs or any connector | Decline in one sentence: the Reckoning never calls a connector. Accept an uploaded export file instead, labeled vendor estimate |
| User asks for a branded version | Not in this skill: deliverables stay neutral; point to a branded-report skill if one exists |
| Enormous scope ("every vertical in Texas") | Quote the real cost, propose one metro and two verticals first so the output shape can be checked |