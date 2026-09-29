# GROUND WAR — the local-search doctrine of UltimaWeapon

`reckoning.md` Phase 3 is the local *audit*; this file is the local *doctrine* it draws on: how the local surfaces actually
rank and convert in 2026, what each of them lets you observe from here, the audit protocol with a scoring rubric, the
company-archetype variations (a single-location plumber and a 400-branch bank are both "local"), the fixes as specs the
client can hand to whoever runs the profile, and the volatility register — the things that move often enough that a run
re-reads them live instead of trusting this file.

Everything here obeys the Articles: no invented numbers, no proprietary scores, GBP facts you cannot see are verify tasks
or screenshot requests, listing accusations end as CONFIRMED / CANDIDATE / CLEARED, the target is named and the operator
never is.

## 1 · The surfaces and what decides them

**Local pack / local finder / Maps.** Google's stated factors are **relevance** (does the profile and its web presence match
the query), **distance** (from the searcher's point or the place named in the query) and **prominence** (how well known the
business is: links, mentions, review count and quality, directory presence, tenure). Everything an operator can move sits
inside those three. Practical weighting from the industry's recurring practitioner survey (Whitespark's Local Search Ranking
Factors; treat the exact percentages as a vendor estimate and re-read the current edition): the profile itself is the
largest lever for pack rankings, followed by on-page signals (for organic local), reviews, links, behavioral signals
(clicks, calls, direction requests), citations and personalization. Two separate contests: the **pack** (profile-driven,
proximity-bound) and the **local organic** results (page-driven, the "[service] [city]" pages); a client can win one and
lose the other, and the report scores them separately.

**Proximity is the ceiling.** A profile ranks in the pack from *where it is*. A service-area business with a hidden address
still ranks from the pin. No copy fixes distance; what fixes distance is more real locations, or the organic contest (city
pages) for cities outside the pin's radius. Say this plainly when an owner wants "to rank in [city 30 miles away]".

**Local Services Ads** (Google Guaranteed for home services, Google Screened for professional services) sit above the pack
in most covered verticals: their own ranking (responsiveness, review count and rating, hours, proximity, budget, "verified"
state) and their own compliance (background check, license, insurance). They are the paid ground war — see
`references/paid-media.md` §7; here they matter as a **SERP-share** fact: when the LSA block, the pack and the ads together
push organic below the fold, organic is a secondary channel on that term and the report says so.

**Justifications and snippets.** The pack shows *why* a result matched ("their website mentions…", "provides: emergency
repair", review snippets, "in stock"). Justifications come from on-profile services/attributes, on-site text, and review
text — which is why review content that names the service and the city is a ranking and a conversion asset.

**AI surfaces on local queries.** AI Overviews and AI Mode answer "best [service] in [city]" by assembling from the same
sources: profiles, reviews, listicles, local press, directories (the citable footprint of `references/ai-seo.md`). Google's
knowledge panel for a business has been reported converting to an AI-generated panel with a chat-style expansion (reported
Sept 2026 — verify live what the panel shows for the client), and Google's agentic calling (Google phoning a business to
book on the user's behalf, reported US rollout May 2026 — verify) makes **answering the phone and keeping hours accurate** a
ranking-adjacent behavior. Record what the client's panel and AI Mode actually show for the money queries (screenshots).

**Apple Maps / Apple Business Connect, Bing Places, Yelp, Nextdoor, Facebook, the vertical directories** (Avvo, Healthgrades,
Zocdoc, Houzz, Angi, HomeAdvisor, Thumbtack, Cars.com, TripAdvisor, OpenTable …): each is a distribution surface with its
own ranking and its own review rules. Apple Maps matters because Siri, CarPlay, and iPhone default-map users see it;
Apple Business Connect is self-serve and free — a missing or unclaimed Apple listing is a routine finding. Bing feeds
Copilot and ChatGPT's local answers.

**EU/UK difference.** Under the DMA, Google's local units in the EEA differ from the US (the classic map-with-directions
unit was withdrawn in some layouts and third-party aggregator carousels added — the exact layout varies by country and has
changed more than once). Never describe an EEA local SERP from memory or from a US vantage: it is a screenshot request.

## 2 · What is observable from here, and what is not

| Signal | From here | How |
|---|---|---|
| On-site NAP, tel: links, LocalBusiness schema, city/service pages, hours text, embedded map, review widgets | **Observed** | `justice_fetch.py`, `satchel_web.py scan`, `justice_schema.py` |
| Citations on fetchable directories (BBB, YP, chambers, many verticals) | **Observed** (fetch each; note the ones that wall) | search-then-fetch; record NAP as displayed, review count if shown |
| Apple Business Connect / Bing Places presence | **Partly** — Apple Maps and Bing Maps are JS/blocked; search snippets and the client's own links tell some | screenshot protocol |
| GBP: categories, services, attributes, description, posts, Q&A, photos, products, hours, messaging, booking | **Not observable** (Maps blocked from here) | screenshot of the profile edit screens or the public panel; GBP Performance export |
| Local pack membership, LSA block, rank by location | **Not observable** | SERP screenshots from the target city (mobile, not signed in), a geo-grid rank export (Local Falcon / BrightLocal / Whitespark — vendor exports), or a rank-tracker export |
| Review count, rating, velocity, text, responses | **Not observable** on Google; partly on fetchable directories | GBP review export / screenshot; Reviews Management tool screenshot for removals |
| Competitor profiles | Same limits | the rival's public panel screenshot; constructed Maps search links (labeled constructed) |
| Registry facts (entity name, formation date, DBA, license) | **Observed** where the portal answers (grade: API / form-POST / JS-only / blocked) | Secretary of State, county DBA, licensing board |

Never write "the GBP lacks categories" from here. Write "verify: GBP categories (screenshot of Edit profile → Business
category)" and put the exact URL of the screenshot request in the batch.

## 3 · The audit protocol (run in this order; each step names its evidence)

**3.1 Entity and eligibility.** Confirm the business is eligible for a profile at all (in-person contact with customers at
the address or in the service area; no lead-gen resellers, no rented mailboxes, no "locations" that are a co-working badge).
Compare the on-site legal name, the registry name and the profile name; a profile name that adds keywords or a city that is
not in the registered or consistently-used real-world name is a **guidelines** finding (Google's "Represent your business"
rules) — CANDIDATE until the registry is checked, CONFIRMED when the registry contradicts it. Practitioner rules (doctors,
lawyers, agents) can have their own profiles; departments can; a second profile for the same entity at the same address is
a duplicate, and duplicates split reviews.

**3.2 NAP canonicalization.** One canonical rendering of name, address (USPS format), phone (E.164 for schema, one display
format on the site) and hours. Inventory every phone number on the site (header, footer, contact, schema, GBP link). A
call-tracking number is fine when the GBP primary phone and the schema `telephone` carry the canonical line and the
tracking number is the GBP *additional* phone or is only in ads — the classic defect is a tracking number as the GBP
primary. Address drift (Ste vs Suite, Rd vs Road) is cosmetic; a different street or suite is a citation break.

**3.3 Profile completeness (verify tasks unless screenshots arrive).** Primary category (the single most important
setting — it should be the category the top pack competitors use for the money term), secondary categories (every service
line that has a real category; not aspirational ones), services with descriptions, attributes (accessibility, identity,
amenities, payment), description (750 characters, first sentence carries the service + city), opening date, hours + special
hours + "more hours", appointment/booking link, menu/products, messaging on with a response SLA, Q&A seeded with the ten
questions customers actually ask (owners may post and answer their own), photos (interior, exterior, team, work, logo,
cover; a cadence, geo-irrelevant metadata is irrelevant — the *content* is what matters), posts (offers, updates, events —
cadence, not volume), social profile links, and the website link with UTM tagging so GA4 separates profile traffic
(`?utm_source=google&utm_medium=organic&utm_campaign=gbp` or the house standard). Score each item Present / Absent / Unknown
and keep "Unknown" as Unknown.

**3.4 Reviews.** Count, rating, velocity (reviews per month over the last 12), recency, distribution, text richness (service
and city named), owner-response rate and quality, and rival benchmarks from their public panels. Solicitation is fine on
Google when it is *unconditional* (no gating by sentiment, no incentives — Google's policy and the FTC's fake-review rule,
16 CFR 465, both), and the link to hand out is the profile's review link. Yelp forbids solicitation outright; Healthgrades
and legal directories have their own rules — name the rule you read. Review velocity spikes, templated text, same-day
bursts, reviewer profiles with one review each across unrelated businesses in the same week: CANDIDATE manipulation signals
(on the client's own profile: a wellbeing warning; on a rival's: the listing-integrity screen). Removals: Google's Reviews
Management tool for policy-violating reviews; reply to legitimate negatives in ≤48 h with a fix, not a fight.

**3.5 On-site local architecture.** For every location: a location page with the canonical NAP, embedded map, hours, the
services offered *at that location*, staff, localized photos, reviews from that location, driving directions from named
neighborhoods/landmarks, parking, and `LocalBusiness` (subtype) schema; a `/locations/` hub (and a store locator for 10+
locations, server-rendered, crawlable, each location a real URL — not a JS widget with no links). For every service ×
market that has demand evidence: a service page (or a service-in-city page where the city is a real market) — the doorway
rule from `reckoning.md` Phase 2 applies: rewrite the nearest/highest-demand ~10 with genuinely local content before
building the 40th templated one. Internal links: nav → services, footer → locations, service pages ↔ location pages, blog
posts → money pages with descriptive anchors. Every proposed internal link is verified against the live XML sitemap.

**3.6 Local schema.** `LocalBusiness` or the most specific subtype (`Plumber`, `Dentist`, `LegalService`, `AutoRepair`,
`Restaurant`, `MedicalClinic`, `RealEstateAgent`, `InsuranceAgency`, `HVACBusiness`, `RoofingContractor`, `Pharmacy`, `Store`
…) with `@id`, `name` (real name), `url`, `telephone` (E.164), `address` (PostalAddress), `geo`, `openingHoursSpecification`,
`areaServed` (for SABs), `hasMap`, `image`, `sameAs` (the profile, the socials, the directories), `priceRange` (optional),
plus `Service` items and `BreadcrumbList`. **No self-serving `aggregateRating`** on `LocalBusiness`/`Organization` (ineligible
for rich results since 2019; reportable as structured-data spam) — a rating is legitimate only on a page whose visible content
is reviews of *another* entity (a product, a third party). `FAQPage` markup is fine to keep, but FAQ rich results are limited
to well-known authoritative sites (since Aug 2023). Validate in the Rich Results Test (verify task) — `justice_schema.py`
flags the lying-schema patterns (phone/address in schema that differ from the page).

**3.7 Citations.** Build the citation matrix by hand: the core aggregators and general directories for the market (US:
Data Axle, Foursquare, Yext's network as a network, Apple Business Connect, Bing Places, Yelp, Facebook, Nextdoor, BBB,
YellowPages, Superpages, MapQuest, Hotfrog, Manta, chamber of commerce; UK: Yell, Thomson Local, Scoot, 192.com, FreeIndex;
DE/FR/ES analogues) plus the vertical set. Columns: present / NAP as displayed / matches canonical / review count shown /
claimed (if visible) / link to the listing. **Consistency beats count**: five accurate citations beat fifty drifting ones.
The **link gap** (directories and local sites that list ≥2 rivals and not the client) is the acquisition list.

**3.8 Local links and mentions.** Sponsorships (youth sports, charities, events), chambers, associations, suppliers and
partners, local press (a story, not a press release), schools and universities, local podcasts and newsletters, "best of"
listicles (the AI-citable set), scholarship pages (aging tactic; often spam-adjacent — flag if templated). Record what the
rivals have that the client does not; fetch the pages to confirm.

**3.9 Behavioral signals and conversion.** Calls, direction requests, website clicks, messages and bookings from the GBP
Performance export (16–18 months); call answer rate and after-hours handling (ask); the click-to-call on mobile; the form
on the location page (≤4 fields); tap-to-text; booking links (Reserve with Google / the vertical's booking integration).
A profile that ranks and does not convert is a hours/answer-rate/photos problem, not a ranking problem — say which.

**3.10 Listing-integrity screen of the market** — `reckoning.md` Phase 3E (redirect test, shared identifiers, lead-gen
self-disclosure, name vs registry, address type, category relevance), with the Satchel's controls gate and dispositions.
Route CONFIRMED items to the Business Redressal Complaint Form as a *client decision* with the reporter-reputation cost.

**3.11 Multi-location and franchise specifics.** One profile per staffed location, unique local phone and landing URL per
location, hours per location, a locations hub with a real URL per location, no shared "headquarters" address for branches,
bulk verification (10+ locations) and a business group / API-managed inventory (verify via screenshot), consistent
categories across the estate with local secondary categories where services differ, review acquisition per location (not
funneled to HQ), franchisee governance (who owns the profiles — a common disaster when a franchisee leaves), UTM per
location, and a spreadsheet of every profile with its Place ID / CID. The "Pattern Verdict" logic of Justice applies:
a defect on ≥40 % of the estate is a template/program finding, not 40 tickets.

**3.12 Service-area businesses.** Hide the address if customers are not served there; set the service area to real
markets (Google caps the area roughly at a two-hour drive; a 200-mile list of cities is a flag); the pin still governs
proximity; the organic contest carries the outlying cities. A plumber "in" six cities from one van is one profile plus six
city pages, not six profiles.

## 4 · The scoring rubric (report as A–F with the evidence class per line)

| Pillar | A | C | F | Evidence |
|---|---|---|---|---|
| Profile | complete, right primary category, weekly activity, UTM, booking | mostly complete, category questionable, sporadic posts | unclaimed, wrong category, duplicate, suspended | screenshots / verify |
| Reviews | ≥ rival median count, ≥4.6, steady velocity, 90 % responses | below rival median or stalled 6 months | <10 or manipulation signals | export / screenshot |
| On-site local | location pages + schema + NAP canonical + service×market pages with demand evidence | pages exist, thin or templated | no location page, NAP drift, tracking number as canonical | observed |
| Citations | core + vertical present and consistent | present, drifting | absent or wrong address on aggregators | observed |
| Links & mentions | local editorial, chamber, sponsorships, listicles | directories only | none, or spam patterns | export + observed |
| Behavioral | calls/directions trend up, answered, booked | flat | falling, unanswered | export |
| SERP position | in pack for money terms in the home city, organic top 10 | pack in some cities | absent from pack in home city | screenshots / rank export |

Never award an A on unverified items; an Unknown caps the pillar at B and says why.

## 5 · Company-archetype variations

- **Single-location service business (trades, clinics, firms):** the full protocol; the pack in the home city is the war;
  LSA eligibility decided in the paid module; TikTok/Reels organic-first for trades (`references/social-ads.md`).
- **Multi-location / franchise (retail, dental groups, auto dealers, banks, gyms, restaurants):** §3.11; add the store
  locator crawl (every location a URL in the sitemap), Merchant Center **local inventory** for retailers (in-store
  availability in the pack's "in stock" filter), and the estate-level Pattern Verdict; the report groups findings by
  program vs location.
- **Home-based and mobile SABs:** §3.12; a virtual-office "address" is the violation, not the home base.
- **Healthcare:** practitioner + practice profiles, Healthgrades/Zocdoc/Vitals/WebMD citations, appointment links, HIPAA
  in review responses (never confirm a person is a patient), NPI as the registry, telehealth "locations" are not locations.
- **Legal:** attorney + firm profiles, Avvo/Justia/FindLaw/Martindale, bar-rule review of the profile description
  (`references/bar-advertising.md`: no "specialist" without certification, no guarantees), state-bar registry as the
  identity check, LSA Google Screened.
- **Real estate and mortgage:** agent + brokerage, Zillow/Realtor.com/Redfin profiles, license numbers in the description
  where state rules compel them, fair-housing language.
- **Restaurants and hospitality:** menu links, reservations, Order with Google / delivery integrations, photo cadence
  matters most, TripAdvisor/Yelp/OpenTable review rules, hours accuracy (holiday hours), Apple Maps.
- **E-commerce with stores / showrooms:** local inventory ads and free local listings, curbside/pickup attributes, the
  store pages carry `Store` schema with `hasOfferCatalog` where sensible.
- **B2B with offices (SaaS, agencies, manufacturers):** profiles exist for entity confirmation and Knowledge Panel
  hygiene, not for pack rankings; a keyword-stuffed profile name on a B2B "office" is a common agency-inflicted defect.
- **Nonprofits, schools, government-adjacent:** eligibility nuances (events venues, campuses), donation/booking links.

## 6 · Fixes as specs (drop into the playbook; adapt facts, never the rules)

**GBP optimization checklist (owner or agency, 3 h):** claim/verify → correct name to the real-world name → set primary
category = the rival-consensus category for the money term → add secondary categories → services with 1–2 sentence
descriptions each → description (service + city in sentence one; no URLs; no promotions) → hours + special hours →
attributes → booking/appointment link → products/menu → 10 photos across the categories, then 2–4/month → Q&A seed (10) →
posts cadence (2/month minimum; offers with end dates) → messaging on + SLA → website link with UTM → review link saved in
the CRM/POS with the unconditional-request script → response SLA 48 h → monthly Performance export saved.

**Location page spec:** H1 "[Business] — [Service line] in [City]" (not a keyword string); NAP block matching the profile
exactly; embedded map; hours; services at this location with links to service pages; team/practitioners; 3–6 localized
reviews with dates; directions from 3 named areas; parking/transit; FAQ (5); `LocalBusiness` subtype JSON-LD; breadcrumb;
one CTA above the fold (call / book); internal links to and from the service pages; ≥400 words of *local* content.

**Review acquisition SOP:** ask every completed job/visit, in person and by text within 24 h, with the direct review link;
never condition on happiness; never incentivize; never ask on Yelp; never post reviews on customers' behalf; respond to all;
log monthly counts; escalate manipulation signals to the operator.

**Citation cleanup:** fix the aggregators first (they feed the rest), then the top 20 directories, then the vertical set;
suppress duplicates through each platform's process; re-check quarterly; keep the matrix as the source of truth.

**Local link plan (quarterly):** 2 sponsorships, 1 chamber/association, 2 local press pitches (a real story), 3 listicle
inclusions (the AI-citable set), 2 supplier/partner pages, 1 event.

**Geo-grid tracking protocol:** a 7×7 or 9×9 grid over the service area at 1–2 mile spacing for the 3–5 money terms,
monthly, same day-of-month, as a vendor export attached to the tally; report pack membership by grid point, not "average
rank".

## 7 · Measurement and KPIs (hedged; sources named)

GBP Performance (calls, direction requests, website clicks, messages, bookings, search queries — the query list is the
best free demand data a local business has); GA4 organic + the `gbp` UTM campaign (sessions, key events); call tracking
(answer rate, after-hours share, spam share); reviews per month, rating, response rate; citation accuracy score (matrix);
pack membership by grid point; local organic rankings (rank export); LSA leads and cost per lead (paid module). Milestones
are ranges ("pack membership in the home city on 3 of 5 money terms within 90 days is plausible IF the category and the
review velocity land; not guaranteed").

## 8 · Deliverable shape

Workbook tabs: **Local Scorecard** (pillar × grade × evidence class), **GBP Audit** (item × Present/Absent/Unknown × source
× fix × owner), **Citation Matrix**, **Review Intelligence** (client vs rivals, velocity, response rate, signals), **Local
Keyword Matrix** and **Listing Integrity** (from the Reckoning). Report: *Local SEO + Listing Integrity* section; CSV
sections *Local SEO* and *Links & Citations*. Every row links to the page or listing.

## 9 · Fallbacks and refusals

| Situation | Adjustment |
|---|---|
| No GBP screenshots / export | every profile item is Unknown; Task #1 = share GBP Performance + profile screenshots; the local grade caps at B and says so |
| Asked to create reviews, respond as customers, or "get the negative ones removed" | reviews are written by customers only; removals only through the platform's policy process with a real violation; say so once |
| Asked to set up profiles for cities with no staffed location | eligibility says no; offer city pages instead |
| Asked to report a rival's listing | CONFIRMED + controls survived → the Redressal form as the client's decision with the reputation cost; CANDIDATE stays in-house |
| EEA local SERP | screenshot from the market; never described from a US vantage |
| Rank-tracking / geo-grid data offered as a connector | not in this skill; an exported file is welcome as a vendor export |

## 10 · Volatility register (re-read live each run; never from memory)

Google Business Profile guidelines (representing your business; naming; eligibility; service areas) ·
`support.google.com/business/answer/3038177` and the prohibited-content policy · Google's "How to improve your local
ranking" page (the relevance/distance/prominence text) · Google's review policy and the Reviews Management tool ·
Local Services Ads eligibility and verification pages for the vertical and state · Apple Business Connect terms · Yelp's
review solicitation policy · the FTC fake-review rule (16 CFR 465) · the current EEA local layout for the market · the AI
panel/agentic-calling behavior on the client's own panel (screenshots) · the latest Local Search Ranking Factors edition ·
each vertical directory's review rules.
