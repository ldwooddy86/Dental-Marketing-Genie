# WAR CHEST — the paid-search, shopping, video and display doctrine of UltimaWeapon

`reckoning.md` Phase 6 ("Follow the money") is the *competitive* paid read from ad libraries; the Satchel's Battery A is
the *compliance* read; this file is the doctrine for both and for the third job neither covers: **auditing the client's own
paid accounts** (structure, targeting, bidding, tracking, waste, policy exposure) and **pre-flighting spend that has not
started**. Social platforms live in `references/social-ads.md`; app campaigns in `references/apps.md`.

Articles that bind here: numbers come only from the client's exports and screenshots (no ads API, no connector, no
spend "estimates" from vendors unless labeled as such); nothing here promises a CPA; any account action that can get an
account suspended outranks anything that can lift a click-through rate; policy is read live before it appears in a
finding.

## 1 · What is observable from here

| Signal | From here | How |
|---|---|---|
| The client's campaigns, spend, terms, conversions, auction insights, change history, policy status | **Export / screenshot only** | Google Ads UI downloads (campaign/ad group/keyword/search terms/asset/placement/audience/location/device/time reports, Auction Insights, Change history, Policy manager, Conversions with status), GA4 landing pages + key events, Merchant Center diagnostics, LSA dashboard, Microsoft Ads equivalents; requested in the Phase 0 batch with exact report names and date ranges (last 90 days + same period last year) |
| Rival ads (creative, first/last seen, formats, regions) | **Screenshot protocol** | Ads Transparency Center, Meta Ad Library, TikTok CCL (EEA/UK/CH), LinkedIn Ad Library, Microsoft Ad Library — `reckoning.md` Phase 6 |
| The client's and rivals' landing pages, tags, disclosures, consent posture, ads.txt | **Observed** | `satchel_web.py scan` + render probe; AdsBot robots posture; `justice_psi.py` for LP speed |
| Policy text, certification requirements, restricted-vertical rules | **Observed** (fetch the live page) | the volatility register's URLs |
| Merchant Center feed and product pages parity | **Partly** (pages observed; feed from export) | product page fetch vs a feed export |

Never write "wasted spend of $X" without the search-terms and cost columns in front of you; never quote a rival's spend
(the libraries do not show it for commercial advertisers).

## 2 · Google Ads — the campaign types and what each is for (2026)

- **Search** — keywords (broad / phrase / exact; broad is viable only with Smart Bidding and disciplined negatives), RSAs
  (up to 15 headlines / 4 descriptions; pin sparingly; Ad Strength is a diagnostic, not a KPI), assets (sitelinks,
  callouts, structured snippets, call, location via the linked GBP, image, price, promotion, lead form, business
  name/logo), **AI Max for Search** (a campaign setting: search-term matching beyond the keyword list, text customization,
  final-URL expansion — with URL, brand, location and text controls; Google's announcement says DSA campaigns, automatically
  created assets and campaign-level broad match are being auto-upgraded into AI Max from **September 2026**, new DSA creation
  ends then, and the DSA sunset/auto-upgrade deadline is **February 2027** — verify the current state and what the upgrade
  turned on in the client's account). Negatives: campaign and shared lists; since 2025 Google announced negatives also block
  misspelled variants (verify), close variants still bite on exact match.
- **Performance Max** — asset groups (text, images, video, feeds), audience *signals* (not targets), search themes,
  brand exclusions, campaign-level negatives (2025), URL/asset-group controls, final-URL expansion toggle, placement and
  channel reporting (Google reported channel-level spend/conversion reporting across Search, Shopping, YouTube, Display and
  Gmail in 2026 — verify what the account shows). The audit questions: is PMax cannibalizing brand search (check the brand
  exclusion and the search-terms insights), is it converting on real key events or on "page views", which channel is
  actually delivering, and is Shopping-only feed PMax the right shape for a retailer vs Standard Shopping for control.
- **Standard Shopping** — the control alternative for retailers: product groups, bids by product, negatives, priority
  settings; Merchant Center (feed quality, disapprovals, price/availability accuracy, shipping and returns settings,
  product ratings, free listings); local inventory ads for stores.
- **Demand Gen** — YouTube (in-stream, Shorts, in-feed), Discover, Gmail; lookalike segments (where available), product
  feeds, channel controls (2025); Video Action campaigns were folded into Demand Gen (2025). Mid-funnel and remarketing;
  judged on assisted conversions and incrementality, not last click.
- **Video** — YouTube: skippable in-stream, non-skippable, bumper, in-feed, Shorts, masthead (reserved); reach/frequency
  vs action objectives; brand suitability settings; placement exclusions (a full placement report is a standing request —
  kids' channels, made-for-advertising apps).
- **Display** — Google Display Network; responsive display ads; placements (audit for app-heavy, MFA and parked-domain
  placements); remarketing lists (the EU consent and the privacy-law opt-out signals apply); rarely a first channel for lead gen.
- **App** — `references/apps.md`.
- **Local Services Ads** — §7.
- **Hotel / Travel** — feed-driven; only when the vertical is hospitality.
- **Retired / changed** (verify): Enhanced CPC (removed 2025), Smart campaigns (migrating), Discovery → Demand Gen, Video
  Action → Demand Gen, DSA → AI Max (2026–27), the search-terms report's low-volume filter (still hides some terms).

**Bidding.** Smart Bidding (tCPA, tROAS, Maximize conversions, Maximize conversion value, Target impression share) needs
conversion volume to learn (rule of thumb from Google's own guidance: dozens of conversions a month per campaign; below
that, Maximize conversions without a target, or portfolio strategies pooling campaigns); manual CPC survives for tiny or
brand campaigns; Smart Bidding Exploration (2025) loosens targets to find new query space (verify, and check whether it is
on). Audit: the strategy per campaign vs its 30-day conversion count; targets vs achieved; budget-limited flags; bid
adjustments still active under Smart Bidding (device/location adjustments are ignored or limited — check); seasonality
adjustments and data exclusions used around outages.

**Conversion tracking (the account's spine).** Google tag (gtag or GTM), **Enhanced conversions** (web and for leads),
**offline conversion import** (GCLID/WBRAID/GBRAID with CRM outcomes — the only way lead-gen accounts optimize on
qualified leads and revenue), GA4 key events imported (avoid double counting: one primary per action), call conversions
(call assets, website call tracking with the forwarding number, call length threshold), store visits (eligibility), **Consent
Mode v2** for EEA/UK users (required for Google's ads personalization/measurement products since March 2024; check the
`ad_storage`/`ad_user_data`/`ad_personalization` signals in the render log), conversion windows and attribution (data-driven
default; last-click alternative), "primary vs secondary" flags, counting (one per click for leads, every for purchases),
values (revenue or proxy values by lead type), and the GA4 ↔ Ads discrepancy read (the April 2026 GA4 attribution/key-event
change reported by the industry — verify the account's imports still flow). A tracking defect invalidates every
optimization decision made since it began — date it.

**Quality and auction.** Quality Score (expected CTR, ad relevance, landing-page experience) per keyword; Ad Rank thresholds;
Auction Insights (impression share, overlap rate, position-above rate, top-of-page and absolute-top rates, outranking share)
as the only direct rival-pressure measure; impression share lost to budget vs rank; search-terms mining (add / negate /
new ad group); brand vs non-brand separation (brand in its own campaign with exact match, a lower target, and excluded from
PMax); geo settings ("Presence" vs "Presence or interest" — interest is the default and the classic waste for local
businesses; location exclusions; radius targeting); ad schedule and dayparting from the hour-of-day report; device
performance; audience layering (observation vs targeting; in-market, affinity, customer match, remarketing); landing-page
mapping (message match, speed, mobile, form friction, phone prominence — `justice_psi.py` on the LPs).

## 3 · Google Ads policy, verification and suspensions (the account-killers)

Policy families: **Prohibited content** (counterfeit, dangerous products/services, enabling dishonest behavior,
inappropriate content), **Prohibited practices** (abusing the ad network — malware, cloaking, arbitrage, bridge pages;
data collection and use — sensitive data in ads/remarketing; **misrepresentation** — unacceptable business practices,
coordinated deceptive practices, misleading representation, unreliable claims, unavailable offers, "clickbait", manipulated
media), **Restricted content and features** (alcohol, copyright, gambling, healthcare and medicines, political, financial
services/products, trademarks, legal requirements, other restricted businesses like bail bonds and call directories;
restricted features: personalized advertising with limits for housing/employment/credit and sensitive categories),
**Editorial and technical** (destination requirements — working, matching, no interstitials/pop-unders, crawlable by
AdsBot; ad text style; unsupported languages). Read the live page for each clause you cite (`support.google.com/adspolicy`).

**Verification.** Advertiser identity verification and, for some, business operations verification; a verified
advertiser name shows on ads and in the Transparency Center; **certifications** for restricted verticals — healthcare
(pharmacies, telehealth, addiction treatment via LegitScript), financial services (country programs; the UK's FCA
verification; US debt services and personal-loan rules with the APR cap and disclosure requirements; crypto certification),
gambling, alcohol (country), political (verification + disclosures + Transparency Center spend data), employment/housing/
credit (the personalized-ads limits). An unverified or uncertified advertiser in a restricted vertical is a pre-flight
**blocker**, not a note.

**Suspension causes** (in rough base-rate order from what Google publishes and what practitioners see): circumventing
systems (new accounts after a suspension, cloaking, redirect tricks), unacceptable business practices and coordinated
deceptive practices (identity, "official site" claims, fake customer service, brand impersonation), payment issues,
business operations verification failures, unreliable claims in restricted verticals, malware on the destination. Appeals:
one substantive appeal per policy; fix first, then appeal with evidence; a suspended account's history (Change history,
Policy manager screenshots) is Task #1 in a "why were we suspended" run. Egregious-violation suspensions are usually
permanent; say so honestly.

**Trademarks.** Bidding on a rival's brand is allowed in most markets (the Satchel checks the jurisdiction — some EU/UK
trademark rulings constrain it); using the rival's mark *in ad text* is restricted unless reseller/informational
exemptions apply; the client's own brand defense (bidding on its own name) is a decision with a cost — model the brand
CPC against the estimated lost clicks from Auction Insights, never as a reflex.

## 4 · Microsoft Advertising, Amazon, retail media, programmatic, CTV (one page each; expand on request)

**Microsoft Ads**: import from Google (then fix what does not translate — audiences, PMax → PMax, bid strategies),
LinkedIn profile targeting (company, industry, job function — a B2B advantage), Microsoft Audience Network, Performance
Max, Copilot placements (verify current formats), the Microsoft Ad Library (EU); desktop-heavy, older, higher-income skews
in the US; often the cheapest incremental leads for B2B and legal. **Amazon Ads**: Sponsored Products / Brands / Display,
Amazon DSP, retail readiness first (listing quality, reviews, Buy Box); only for sellers. **Retail media** (Walmart Connect,
Instacart, Target Roundel, Kroger): the same shape for CPG. **Programmatic / DSPs** (DV360, The Trade Desk, StackAdapt):
brand safety and MFA exclusions, frequency, viewability, log-level data for incrementality; **CTV** (YouTube on TV, Hulu,
Roku, Amazon): reach objectives, household-level measurement, not a lead-gen channel for a local plumber. **Sponsored
placements inside AI answers** (Google's AI Mode text-link tests reported Sept 2026; Perplexity sponsored questions; Bing
Copilot ads): note as watch items with no numbers.

## 5 · The account audit protocol (from exports; every finding names the report and date range)

1. **Structure map** — campaigns by type and objective, budgets, bid strategies, conversion goals per campaign; a table
   the owner can read; flag: brand mixed with non-brand, PMax with no brand exclusion, Search Partners and Display
   Network on for Search campaigns (waste by default), "Presence or interest" geo, campaigns split so thin no strategy can
   learn, dozens of ad groups with one keyword each (SKAG relic), broad match without negatives or Smart Bidding.
2. **Conversion integrity** — every conversion action: source, status (recording / no recent conversions / inactive),
   primary/secondary, counting, window, value; duplicates (GA4 + tag for the same form); micro-conversions marked primary
   (page views, "scroll 90 %" as primary is the classic inflation); offline import present or absent; enhanced
   conversions on; Consent Mode status for EEA traffic; call conversions; phone forwarding. Verdict: **trustworthy /
   inflated / broken since <date>** — everything downstream is read through that verdict.
3. **Search-terms waste** — last 90 days: irrelevant terms (jobs, DIY, other cities, competitors' brands where not
   intended, informational), share of cost on terms with zero conversions, brand terms leaking into non-brand, a
   negatives list to add (as a ready-to-paste block), and the ad-group moves for winning terms.
4. **Match type and keyword health** — QS distribution (keywords ≤4 with spend), match-type mix, low-search-volume
   keywords, duplicates across campaigns competing with themselves, "below first-page bid" clusters.
5. **Ads and assets** — RSA coverage (every ad group ≥1 RSA with Good/Excellent strength; pinned ads limiting
   combinations), asset coverage (sitelinks ≥4, callouts, structured snippets, call/location where relevant, images),
   policy-disapproved or limited ads, ad copy vs the vertical's advertising rules (bar rules, financial disclosures,
   healthcare claims — CANDIDATE observations handed to the Satchel), message match to LPs.
6. **Bidding and budget** — strategy fit vs conversion volume, target vs actual CPA/ROAS by campaign, budget-limited
   campaigns with good CPA (raise) vs unlimited with bad (cap), pacing and month-end overspend, bid adjustments under
   Smart Bidding, seasonality/exclusion use.
7. **Targeting hygiene** — geo (settings, exclusions, radius, location report by city/ZIP with cost and conversions),
   schedule (hour/day report; call-only during answered hours), devices, audiences (observation vs targeting; customer
   match lists' size and refresh), language, Search Partners/Display toggles, placement reports for Display/Video/PMax
   (MFA, apps, kids' content) with an exclusion list.
8. **Landing pages** — map each campaign/ad group to its LP; speed (PSI/field), mobile, form friction, phone, message
   match, compliance (privacy link, consent language, disclosures, no interstitial), tracking present on the thank-you
   page, LP type (dedicated vs homepage); a table with a link per LP.
9. **Competition** — Auction Insights trend (who is rising), impression share lost to rank vs budget, rival brand terms
   in the search-terms report, the Phase 6 ad-library read for creative and offers, brand-bidding evidence and the
   defense decision.
10. **Performance read** — CPL/CPA/ROAS/MER by campaign, month over month and year over year; conversion lag; the
    incrementality question (brand campaigns and remarketing are the usual over-credited pair — propose a geo split or a
    holdout when spend justifies it); GA4 vs Ads reconciliation; the "one number the owner should watch" (usually cost
    per qualified lead or MER, not ROAS on platform-reported conversions).
11. **Policy and exposure** — Policy manager screenshot: disapprovals, limited ads, account issues, verification status,
    certifications on file; the Satchel's Battery A on the LPs (cloaking, destination integrity, special categories,
    trackers/consent, trademark/badge misuse, lead-gen structure, payer transparency).
12. **Waste estimate and reallocation** — a hedged range ("between $X and $Y of the 90-day spend went to terms, placements
    and geos with no recorded conversion; some of it is assist value we cannot see"), and where it goes instead.

Score A–F per pillar (Structure · Tracking · Targeting · Creative & LP · Bidding & Budget · Policy & Exposure) with the
evidence class; an account with a broken tracking spine caps at D regardless of CPA on paper.

## 6 · Pre-flight (before the first dollar) and launch plan

**Blockers** (any one stops the launch): unverified advertiser in a vertical that requires it; missing certification
(healthcare/financial/gambling/alcohol/political); LP without a privacy policy, consent language on forms (TCPA), required
disclosures (APR, license numbers, bar disclaimers, "results vary"); pixels firing pre-consent for EEA/UK; a destination that
redirects, cloaks, or shows interstitials; trademark use in ad text without a basis; special-category targeting that the
policy prohibits; no conversion tracking. **Setup**: account structure (brand / non-brand by service / competitor (optional)
/ remarketing / PMax later), conversion actions with values, enhanced conversions, offline import plan, Consent Mode
where needed, negatives seed (jobs, free, DIY, other cities, adult, competitors as decided), geo = Presence, schedule =
answered hours (call ads), budgets by campaign with a 30-day learning note, RSAs (≥3 per ad group at launch) and assets,
LPs per service with message match, call tracking with GBP/schema canonical intact, Auction Insights baseline at day 30,
a measurement dashboard (GA4 + Ads + CRM). **Budget scenarios**: three rows (conservative / base / aggressive) with
explicit assumptions (CPC from the client's own history or a supplied Keyword Planner export — never a remembered CPC —,
conversion rate from the LP's history, lead-to-sale from the CRM) and a range per output; no scenario is a forecast.

## 7 · Local Services Ads (the local paid war)

Eligibility by vertical and country (home services → Google Guaranteed; professional services — lawyers, real estate,
financial planners, some healthcare — → Google Screened); verification: business registration, license (state and
trade-specific), insurance, background checks (owner and, for some trades, technicians), and reviews (Google has moved LSA
reviews toward the linked Google Business Profile — verify the current review-source rules); ranking: responsiveness
(answer the call), review count and rating, business hours, proximity, budget, verification badges; pay-per-lead with
lead disputes (credit for spam, wrong service, wrong area — dispute inside the window); message vs call leads; booking;
the LSA "Direct Business Search" behavior (a brand search shows the advertiser's own LSA — verify); the compliance side:
license accuracy (a lapsed license is a suspension), service-area honesty, review authenticity, and the bar rules for
lawyers (LSA is advertising; the bar's rules on "Google Screened" phrasing vary — `bar-advertising.md`). Audit from the LSA
dashboard export: leads by type and status, cost per lead, disputes won, response time, review count/rating, budget
pacing, hours coverage; compare with the SERP screenshots (who else is in the block).

## 8 · Company-archetype playbooks

- **Local service business:** Search (exact/phrase by service, brand separate) + LSA + call assets/call-only during hours
  + GBP-linked location assets; PMax only with a real lead-quality signal (offline import) — otherwise it spends on
  forms of no value; geo = Presence + exclusions; dayparting; Microsoft Ads as the cheap second search engine; YouTube only
  for brand in bigger markets.
- **Multi-location / franchise:** campaign or account per market with shared negatives and LP templates per location,
  store-visit conversions where eligible, LSA per location, local inventory ads for retailers, budget allocation by market
  demand (Auction Insights per market), brand-defense per market.
- **E-commerce:** Merchant Center health first (disapprovals, price accuracy, shipping/returns, GTINs, image quality),
  Standard Shopping for control or PMax with feed-only asset groups and brand exclusions, product-level ROAS targets by
  margin tier, Demand Gen with catalog for mid-funnel, YouTube for launches, remarketing with frequency caps, promotions
  and Merchant promotions, seasonality plans, Amazon/retail media if sold there; the AI-shopping feeds decision
  (`ai-seo.md`).
- **B2B / SaaS:** Search on problem and category terms (intent > volume), competitor campaigns (a decision), LinkedIn for
  targeting (social file), Microsoft Ads with LinkedIn profiles, offline conversion import from the CRM (MQL/SQL/closed-won
  values) as the optimization spine, Demand Gen/YouTube for retargeting, long conversion windows, lead-quality reporting not
  CPL.
- **Marketplaces / lead-gen / aggregators:** the compliance archetype — lead-gen structure disclosures, payer transparency,
  special categories (housing/employment/credit), destination requirements for "compare" sites, arbitrage rules; the
  Satchel's Battery A is not optional here.
- **Healthcare:** certification (LegitScript for pharmacies/addiction/telehealth as applicable), no personalized ads on
  sensitive conditions, no PHI in tags (no conversion pixels on patient portals; HIPAA and the FTC's Health Breach
  Notification Rule), claims vs W9, call tracking with HIPAA-aware vendors.
- **Legal:** LSA Google Screened, Search on practice + geo, bar rules in every headline (no "best", no guarantees, "no fee
  unless we win" per state), landing-page disclaimers, TCPA consent on forms, competitor bidding as a bar-rule check.
- **Finance:** financial-services certification/verification where required, APR and fee disclosures inside the ad and on
  the LP, personal-loan rules (Google's APR cap and disclosure policy), credit special-category limits, no "guaranteed
  approval", the Satchel's financial overlay.
- **Real estate / mortgage:** housing category limits on personalized targeting, fair-housing language, license numbers.
- **Automotive:** vehicle listing ads (feeds), dealer disclosures (price, fees), local inventory.
- **Education:** Title IV / for-profit rules on claims (job placement, accreditation), targeting minors constraints.
- **Nonprofits:** Google Ad Grants ($10,000/month at up to $2 CPC unless Smart Bidding; policy: Maximize conversions or
  tCPA, ≥5 % CTR, geo targeting, no single-word keywords, conversion tracking required — verify the current program rules),
  donation conversions, YouTube Nonprofit Program.
- **Publishers:** AdSense/AdX yield is out of scope; paid subscription acquisition follows the SaaS shape.
- **Agencies (the overlay's focus):** the account audit of an agency's own ads is a self-audit (tickets, owners, no
  routes); an agency's *client* accounts audited for a prospect are competitor/market posture.

## 9 · Measurement, incrementality and the KPI frame

Platform metrics (impressions, IS, CTR, CPC, CVR, CPA, ROAS, conversion lag) vs business metrics (cost per qualified lead,
CAC, payback, MER = revenue ÷ total ad spend, contribution margin); attribution in Ads (data-driven) vs GA4 (data-driven
across channels) vs CRM (first touch / last touch / linear) — name which is used in every table; incrementality: geo
experiments (Google's own experiments tool or a manual geo split), conversion-lift studies (YouTube/Demand Gen), holdouts
for brand and remarketing, MMM (Google Meridian, Meta Robyn — open-source, needs ~2 years of weekly data) for larger
budgets; invalid traffic (the invalid clicks column; IP exclusions; a click-fraud vendor's export labeled as vendor data).
Milestones are ranges with assumptions; "learning period" caveats after any structural change.

## 10 · Deliverable shape

Workbook tabs: **Paid Account Audit** (pillar × grade × finding × evidence report/date × fix × owner × link), **Search
Terms & Negatives** (term × cost × conversions × action × the paste-ready negatives block), **Conversion Actions**
(action × source × status × primary × counting × window × verdict), **Campaign Map**, **Landing Pages** (campaign × LP ×
speed × compliance × message match × link), **Auction Insights** (rival × IS × overlap × outranking × trend), **Budget
Scenarios** (assumptions labeled), **Paid Intel** and **Swipe File** (from Phase 6), **LSA** (leads × cost × disputes ×
response). Report: *Paid-Media Intelligence* (competitive) and *Paid Account Audit* (own). CSV section *Paid Media*.
Playbook: the restructure plan, the negatives block, the conversion-tracking fix list, the LP fix list, the pre-flight
checklist with blockers cleared, the budget scenarios, the brand-defense decision, the measurement plan.

## 11 · Fallbacks and refusals

| Situation | Adjustment |
|---|---|
| No account access/exports | the own-account audit is NOT ASSESSED; ship the competitive read, the LP audit and the pre-flight; Task #1 = exports (name them) or read-only access to the operator (not to this skill) |
| Asked to estimate a rival's spend | not shown by any library for commercial advertisers; report activity tiers and longevity instead |
| Asked to bid on a rival's name in ad text or to impersonate | ad text with a rival's mark is a policy/trademark exposure; bidding is a jurisdiction question — both go to the Satchel; no "official site" claims |
| Asked to launch in a restricted vertical without certification | blocker; the certification path is Task #1 |
| Vendor CPC/volume "estimates" offered | accepted as labeled vendor estimates; never in a forecast without the label |
| Asked for a guaranteed CPA or "we'll 3× ROAS" | ranges with assumptions; no guarantees |
| Ad-account audit requested via the Ads API or an MCP connector | not in this skill; exports only |

## 12 · Volatility register (re-read live; dated 2026-09)

Google Ads policies (`support.google.com/adspolicy`) — the specific clause for each finding; advertiser verification and
certification pages per vertical/country; the AI Max / DSA transition timeline (`blog.google` announcement and the Ads help
"New features & announcements" page); PMax controls and reporting; Demand Gen formats; Consent Mode requirements; Smart
Bidding thresholds guidance; the negatives-and-misspellings behavior; Merchant Center policies and the feed spec; LSA
eligibility, verification and review-source rules per vertical/state; Microsoft Ads policies and Copilot placements; the
Google Ad Grants policy; the Transparency Center's retention and fields; sponsored placements inside AI answers; the
industry's reported April 2026 GA4 ↔ Ads change.
