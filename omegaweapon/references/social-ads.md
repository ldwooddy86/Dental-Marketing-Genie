# MEGAPHONE — the social-media advertising and organic-social doctrine of UltimaWeapon

Paid social is where creative, targeting rules and platform policy collide hardest, and where an account can vanish
overnight. This file covers the platforms (Meta, TikTok, LinkedIn, X, Pinterest, Snapchat, Reddit, Nextdoor, YouTube as a
social placement, WhatsApp/Messenger), the competitive read from the ad libraries, the audit of a client's own social
accounts, the creative doctrine, creator/influencer compliance, the organic-social audit that precedes paid for most
small businesses, measurement, company-archetype playbooks, fixes as specs, and the volatility register. It reads with
`references/paid-media.md` (measurement frame, pre-flight logic) and the Satchel (Battery A/E, the marketing overlay).

Articles that bind: numbers only from the client's exports/screenshots and dated library captures; every policy clause
cited is fetched live; creator claims are the brand's liability and the Satchel screens them; nothing here writes a fake
review, a fake account, or an undisclosed endorsement.

## 1 · What is observable from here

| Signal | From here | How |
|---|---|---|
| Rival ads on Meta (Facebook, Instagram, Messenger, Audience Network, Threads) | **Screenshot protocol** (the Ad Library is blocked from the fetcher) | `facebook.com/ads/library` — country, active status, keyword or Page; per ad: Library ID, start date, platforms, variations, format, primary text, headline, CTA, LP; EU targets add reach/age/gender/location and payer/beneficiary (DSA) |
| Rival ads on TikTok | **Screenshot**; coverage EEA/UK/CH only | `library.tiktok.com/ads` (Commercial Content Library); US creative via Creative Center Top Ads (login) |
| Rival ads on LinkedIn | **Screenshot** | `linkedin.com/ad-library` (by company; running dates; EU targeting data) |
| Rival ads on X, Snapchat, Pinterest, Reddit (EU) | **Screenshot** | each platform's DSA ad repository / transparency page (verify current URLs; some show EU-served ads only) |
| The client's own ad accounts (Ads Manager exports, Account Quality, Events Manager, Commerce Manager, Business verification) | **Export / screenshot** | requested in Phase 0 with exact report names and 90-day + YoY ranges |
| Pixels, CAPI hints, consent posture, disclosure blocks on the client's site | **Observed** | `satchel_web.py scan` (fbevents, ttq, snaptr, pintrk, rdt, li tags) + the render probe's pre-consent log |
| Public profiles (follower counts, cadence, last post) | **Partly** — most profile pages are JS/blocked; search snippets and screenshots | screenshot protocol; never "inactive" for a page that would not load |
| Platform policy text | **Observed** | fetch the live policy page (register in §12) |

Empty library results are "no active ads observed on <date> in <region>", never "they don't advertise"; TikTok's library
covers Europe only; Meta's shows all ads only when the advertiser's Page is found.

## 2 · Platform doctrine (2026; every specific carries a verify flag by its nature)

**Meta (Facebook / Instagram / Messenger / WhatsApp / Threads / Audience Network).** Objectives: Awareness, Traffic,
Engagement, Leads, App promotion, Sales. Structure: campaign → ad set → ad; Advantage+ campaign budget; the
**Advantage+** family (Advantage+ sales/app/leads campaigns unified under "Advantage+" with Meta's automation on
audiences, placements, creative and budget; Advantage+ audience uses your inputs as suggestions); the **Andromeda**
retrieval model (2025) rewards creative diversity — many distinct concepts beat many variants of one. Creative: image,
video, carousel, collection, Reels, Stories, catalog (dynamic product ads), flexible format, Partnership ads (creator
handle), lead forms (Instant Forms with conditional logic, higher-intent option, CRM integration), click-to-message ads
(WhatsApp/Messenger/Instagram), call ads. Measurement: **Pixel + Conversions API** (server-side; the Event Match Quality
score is the health metric), Aggregated Event Measurement for iOS (ATT), attribution settings (7-day click / 1-day view
default; incremental attribution option — verify), Advantage+ creative. Policy: Advertising Standards (prohibited:
tobacco/vape, weapons, adult, discriminatory practices, misleading claims, personal attributes ("you" + attribute), sensational
content, before/after in health, cryptocurrency without permission (tiered by regulation — reports in 2026 describe a
licensed/unlicensed tier system with age floors; verify), gambling (permission), alcohol (country rules), dating (permission),
online pharmacies (LegitScript), weight loss (age 18+, no specific results), financial products (verification in some
markets; the FCA regime in the UK), **Special Ad Categories** — Credit, Employment, Housing, and Social issues/elections/
politics — with restricted targeting (no age/gender/ZIP, broad location radius, no lookalikes/detailed targeting), applied
by declaration and by Meta's detection (reports in 2026 describe multimodal detection extending to landing pages and an
expanded credit definition covering BNPL and crypto lending — verify), **teens** (under-18 targeting limited to age and
location), **AI-generated/synthetic content disclosure** (required for political/social issue ads since 2024; reports of a
broader disclosure requirement in 2026 — verify), **branded content / Partnership ads** rules (paid creator content must
use the branded-content tools; verify the 2026 scope), health data restrictions (domains categorized as health/wellness
lose some standard events since Jan 2025 — CAPI with restricted parameters; verify), account restrictions (Account Quality
→ appeal; "advertising restrictions" vs "business account restrictions"; circumvention = permanent), EU/DSA (beneficiary
and payer required for EU ads; no targeting of minors by profiling; no sensitive-data targeting; the Ad Library's EU
fields), Business verification (required for some categories, for higher spend tiers, for the Ad Library API, for WhatsApp).
**TTPA**: political/issue advertising in the EU stopped on Meta from October 2025 (the EU regulation's application; verify).

**TikTok.** Ads Manager: objectives (reach, traffic, video views, community interaction, lead generation, app promotion,
website conversions, product sales); **Smart+** automated campaigns (2024–25); **Spark Ads** (boost organic posts, own or
creators' with authorization codes); TikTok Shop ads (Video Shopping Ads, Product Shopping, LIVE Shopping); creative tools
(Symphony AI, Creative Center's Top Ads / Keyword Insights / Trends); measurement: Pixel + Events API, attribution windows,
Split Testing; policy: industry entry requirements by market (financial services, healthcare, gambling — whitelist only —,
alcohol by country, no political ads), creator disclosure via the "promotional content" toggle, brand safety (IAS/DV
verification), TikTok for Business verification. **US status**: after the 2025 law and divestiture process, TikTok's US
operations moved to a US joint venture (reported closed in January 2026; advertisers were pitched on the new structure in
March 2026 — verify the current ownership, data and algorithm arrangements before writing a sentence about "TikTok in the
US"). The **Commercial Content Library** covers the EEA/UK/CH only; US creative intelligence comes from the Creative Center
and from screenshots of the client's/rivals' organic accounts. For most local trades the organic playbook (before/after,
"tech in the field", pricing transparency, myth-busting) precedes paid, and Spark Ads on the winners is the first paid step.

**LinkedIn.** Campaign Manager: objectives (brand awareness, website visits, engagement, video views, lead generation,
website conversions, job applicants); formats (single image, video, carousel, document ads, event ads, Thought Leader Ads —
boosting an employee's or creator's post —, Conversation/Message ads — restricted in the EU —, Connected TV, Lead Gen
Forms); targeting (company, industry, size, job title/function/seniority, skills, groups, Matched Audiences: contact/company
lists, website retargeting via the Insight Tag, Predictive Audiences); measurement: Insight Tag + Conversions API, Revenue
Attribution Report (CRM-connected), Website Demographics; **Accelerate** (AI campaign automation; verify current form);
the **LinkedIn Ad Library** (all ads since mid-2023; EU targeting fields); policy: no discriminatory targeting for jobs/
housing/credit categories in covered jurisdictions, restricted crypto/financial, no political ads (banned globally), adult,
weapons; Business Manager and verification for the Page; the CPCs are the highest in social — the B2B audit checks lead
quality, not CPL.

**X (Twitter).** X Ads (promoted posts, video, carousel, takeovers, Amplify), targeting (keywords, follower lookalikes,
interests, conversations), pixel + CAPI, the EU ads repository (DSA), brand safety controls (adjacency), policy (political
ads allowed with restrictions since 2023 in some markets; restricted categories; verify), Grok/AI placements (verify). For
most SMBs X is a customer-service and PR surface, not an acquisition channel — say so.

**Pinterest.** Objectives (awareness, consideration, conversions, catalog sales), **Performance+** automation (2024), formats
(standard, video, carousel, collections, shopping/catalog, Idea/organic pins as promotable), Pinterest Tag + API for
Conversions, the ad library/DSA repository for EU; policy (no weight-loss ads since 2021, no political ads, restricted
financial/health/alcohol, no dangerous products); strongest for home, food, fashion, beauty, weddings, DIY — high-intent
planning behavior; catalog quality is the input for retailers.

**Snapchat.** Snap Ads (single image/video), Story Ads, Collection Ads, AR Lenses/Filters, Spotlight; Snap Pixel + CAPI;
Public Profiles; ad library (EU); policy: teen audience skew (age gates, 18+ categories), restricted verticals; local
"Promote" placements for SMBs; Snap Star creators.

**Reddit.** Reddit Ads (promoted posts, conversation placements, Dynamic Product Ads, lead-gen forms, Free-Form ads),
targeting (communities, interests, keywords, contextual), Reddit Pixel + CAPI, the ads transparency/DSA repository for EU
(verify), policy (community targeting rules, political ads US-only with verification, restricted categories); the
organic corollary: Reddit threads are among the most-cited sources in AI answers (`ai-seo.md`) — a named human presence
beats ads for many B2B/SaaS categories.

**Nextdoor.** Local ads (neighborhood targeting), Business Pages, Local Deals; the neighbor-recommendation mechanism is the
organic asset; policy on solicitation; US-centric with some UK/EU/AU markets.

**YouTube as social** (paid is in `paid-media.md`): Shorts organic, channel hygiene (handle, sections, playlists by
service), community posts, the "includes paid promotion" disclosure for creator content.

**WhatsApp / Messenger / Instagram DM**: click-to-message ads, WhatsApp Business Platform templates (opt-in required;
template approval; quality rating), TCPA-equivalent consent in the US (SMS/WhatsApp marketing consent), CTIA guidelines.

## 3 · The competitive social read (extends `reckoning.md` Phase 6)

Per rival and platform, from dated screenshots: active count, longest-running ad (start date), variation count per concept,
formats, hooks (price anchor, guarantee, urgency, financing, social proof, before/after, fear/pain, local identity,
seasonal, humor, founder story), offers, CTA, LP type (dedicated / homepage / lead form / Shop), creator/UGC style (handles
visible → Partnership ads → whom they pay), platforms mix, EU targeting data where present, Page transparency (created,
name changes, admin countries — an offshore admin set on a "local" business is a CANDIDATE identity signal), policy
exposures visible in creative (before/after in health, "guaranteed", personal attributes, undisclosed creators, missing
APR/fee disclosures) — CANDIDATE observations routed to the Satchel. Aggressiveness tier (Dormant / Light / Active / Heavy)
as in the Reckoning; the Swipe File captures the mechanism, never the copy or the creative itself.

## 4 · The own-account audit protocol (from exports; every finding names the report and date)

1. **Business and account setup** — Business Manager/portfolio ownership (the client owns the assets, not the agency —
   a common hostage situation), verification status, two-factor, ad account limits, Page/handle ownership, payment method
   ownership, Account Quality (restrictions, pending reviews, policy issues), Commerce Manager (Shop status, disapprovals),
   domain verification, Aggregated Event configuration, DSA beneficiary/payer set for EU.
2. **Measurement spine** — Pixel present on all pages and on the thank-you page; standard events mapped to real actions;
   **CAPI** live with a healthy Event Match Quality (the score and the parameters sent); deduplication (event IDs); test
   events; attribution settings; UTM taxonomy (`utm_source=facebook&utm_medium=paid_social&utm_campaign=…`) consistent with
   GA4; consent gating for EEA/UK (pre-consent firing in the render log is a compliance finding); the health-category
   restrictions if the domain is categorized; offline conversions/CRM upload for lead gen; the verdict: trustworthy /
   inflated / broken since <date>.
3. **Structure** — campaigns by objective; too many tiny ad sets (learning limited); audiences: broad vs interest stacks vs
   lookalikes vs retargeting; exclusions (customers, converters); frequency (>3–4/week on cold audiences = fatigue); budget
   allocation (Advantage+ campaign budget or manual); placements (Advantage+ placements vs manual exclusions for Audience
   Network/Reels where creative is not native); geo (radius, exclusions); special ad category declared where the content
   needs it (missing declaration = suspension risk; unnecessary declaration = wasted reach).
4. **Creative** — concept count in the last 90 days, refresh cadence, format mix (9:16 video share), hook rate (3-second
   views ÷ impressions), hold rate (ThruPlay ÷ 3-second views), CTR (link), CPM trend (fatigue tell), creative diversity (do
   the top spenders look alike), UGC/creator share, captions and sound-off design, message-market fit, the offer, LP match,
   compliance (before/after, personal attributes, superlatives, claims without substantiation, missing disclosures, AI
   disclosure where required, creator disclosures) — the last group to the Satchel.
5. **Landing pages / forms** — Instant Form fields and intent settings (higher intent vs volume), CRM integration, response
   SLA (speed-to-lead), LP speed and mobile, consent language on forms (TCPA for follow-up calls/texts), privacy link,
   message match, Shop checkout path.
6. **Performance** — CPM, CPC, CTR, CVR, CPL/CPA/ROAS by campaign and by creative; platform-reported vs GA4 vs CRM;
   view-through share; incrementality questions (retargeting over-credit; a conversion-lift study or a geo holdout when
   spend justifies); the one number the owner watches (cost per qualified lead or MER).
7. **Policy and exposure** — disapproved ads and reasons, restrictions history, Special Ad Category handling, creator
   disclosures, EU DSA fields, teen targeting settings, health-data category, and the Satchel's Battery A/E on the LPs and
   the Page (reviews/testimonials in creative = 16 CFR 255/465; "as seen on"; awards).
8. **Organic social baseline** (§6) — because paid amplifies what organic proves.

Score A–F per pillar (Setup · Measurement · Structure & Targeting · Creative · Conversion path · Policy & Exposure), evidence
class per line; a broken measurement spine caps the account at D.

## 5 · Creator, influencer and UGC compliance (US + EU)

FTC Endorsement Guides (16 CFR 255, revised 2023): disclosures must be clear and conspicuous, in the content itself (not
only in the bio), before the "more" fold, in the same medium (audio in video), unambiguous ("#ad", "paid partnership",
"sponsored"; not "#sp", "#collab"); the brand is liable for creator claims (substantiation; results claims; health claims);
employee/insider endorsements disclosed; the fake-review rule (16 CFR 465, 2024) bans buying/selling reviews, insider
reviews without disclosure, review suppression, and fake social-media indicators (bought followers/likes); the platform
tools (Instagram/Facebook paid partnership label, TikTok promotional-content toggle, YouTube "includes paid promotion")
are necessary, not sufficient. EU/UK: UCPD Annex I (undisclosed advertorials) and the national codes (ASA/CAP "ad" rules,
Germany's UWG §5a and the *Werbung* labeling case law, France's 2023 influencer law, Italy's AGCOM rules, Spain's
influencer decree), the DSA's ad-labeling duty for platforms, the EU influencer legal hub (verify); gifting counts as
consideration in most regimes. Contracts: usage rights (organic vs paid, duration, whitelisting/allowlisting), exclusivity,
approval rights, disclosure clause, claims clause, morality clause, deliverables, reporting. Audit: creator content live
without disclosure = CONFIRMED (the post is the evidence); whitelisted ads without the creator's handle = CANDIDATE
(Partnership ads may be the fix); claims by creators = the Satchel's claim battery.

## 6 · Organic social audit (the baseline paid stands on)

Profile completeness and consistency (handles, names, bios, links, NAP for local, categories, verification badges, hours
on Facebook), posting cadence and mix (education / proof / offer / culture), engagement rate (per follower and per reach —
platform exports), video share (Reels/Shorts/TikTok), cross-posting hygiene, community management (response time to
comments/DMs; Facebook Recommendations replies), social proof on the site (real embeds, not screenshots), UGC volume,
employee advocacy (LinkedIn for B2B), review responses, follower quality (sudden jumps, bot-like followers = a CANDIDATE
signal on rivals and a wellbeing warning on the client), the link-in-bio destination (UTM, compliant LP), platform-specific
assets (Facebook Shop, Instagram Shopping tags, LinkedIn Page products, Pinterest catalog, TikTok Shop), and social
listening (brand mentions via search sample; sentiment as a manual read). Output: a 90-day organic plan (cadence, pillars,
formats, the first 12 posts as titles with the proof asset each needs).

## 7 · Company-archetype playbooks

- **Local services:** Meta Leads (Instant Forms, higher-intent) + click-to-call/message, radius targeting = service area,
  before/after and "tech on site" creative, Nextdoor, TikTok/Reels organic-first then Spark Ads; speed-to-lead SLA (minutes);
  TCPA consent on forms; Facebook Recommendations as reviews.
- **Multi-location / franchise:** Page structure (parent + locations), local awareness ads per location with dynamic
  creative, brand vs local budgets, lead routing to locations, franchisee compliance guardrails (approved creative
  libraries), EU DSA fields per market.
- **E-commerce:** Advantage+ sales with catalog, creative diversity (Andromeda), UGC/creator whitelisting, TikTok Shop and
  Video Shopping Ads, Pinterest catalog, Snapchat for younger demos, CAPI with margin-aware values, promotions calendar,
  retention (email/SMS) as the profit lever the ads feed.
- **B2B / SaaS:** LinkedIn (Lead Gen Forms for content offers; website conversions for demos; Thought Leader Ads;
  Matched Audiences from the CRM; Revenue Attribution), Meta retargeting and lookalikes of closed-won, Reddit for developer/
  technical categories, YouTube retargeting, offline conversion upload, lead-quality reporting; no political/financial
  restricted categories usually.
- **Healthcare / wellness:** health-data category restrictions (Meta), no personal-attribute framing, no before/after,
  HIPAA (no pixels on patient portals; BAAs for CRMs), practitioner-led creative, testimonials only with consent and
  disclosures.
- **Legal:** bar rules in every ad (state named), lead forms with TCPA consent, no "best/specialist" claims, no dramatized
  results, disclaimers in creative where the state compels them (Florida, Texas, Louisiana, Nevada pre-screen/filing rules).
- **Finance / fintech / lending:** Meta Credit special ad category (targeting limits), advertiser verification where the
  market requires it, APR/fee disclosures on-creative, no "guaranteed approval", crypto tier rules (verify), the Satchel's
  financial overlay; LinkedIn's financial restrictions.
- **Real estate / housing:** Housing special ad category on Meta; fair-housing language; LinkedIn's equivalent limits.
- **Employment / staffing:** Employment special ad category; no age/gender cues; pay-transparency states in job ads (Satchel
  W19).
- **Education:** Title IV claims rules; no targeting minors for for-profit programs; TikTok/Snap age gates.
- **Nonprofits / political / issue:** Social issues/elections/politics category with verification and disclaimers (US);
  EU political ads effectively off Meta/Google since Oct 2025 (verify); fundraising tools.
- **Apps:** app promotion objectives with SKAN/AEM constraints (`apps.md`).
- **Publishers / creators / agencies:** branded content rules; an agency's own social claims (awards, "#1") are the
  overlay's rows; an agency's client-book creative audited for a prospect is competitor posture.

## 8 · Fixes as specs

**Measurement fix list:** Pixel via GTM on all pages + thank-you; standard events mapped; CAPI via the platform's partner
integration or a server container; event IDs for dedup; EMQ ≥ target (aim for the platform's "good" band; verify current
thresholds); consent gating for EEA/UK; UTMs standardized; GA4 key events aligned; CRM offline upload weekly; a 30-day
reconciliation table (platform vs GA4 vs CRM).

**Account structure template (SMB lead gen):** one Leads campaign with Advantage+ campaign budget, 2–3 ad sets (broad
service-area; retargeting 30/90-day site visitors and engagers; optional interest stack for a control), exclusions of
converters, 4–6 concepts live at any time, weekly refresh of the worst 25 %, Instant Form (≤5 questions, higher intent),
CRM integration, speed-to-lead SLA, a monthly creative review.

**Creative brief spec:** objective, audience insight, the one promise, proof asset (review, before/after where allowed,
credential), hook variants (3), format (9:16 video ≤30 s with captions; static with one line), CTA, LP, compliance checks
(claims, disclosures, special category, AI disclosure, creator disclosure), the KPI it is judged on.

**Creator program SOP:** brief with the disclosure clause and claims list; contract with usage/whitelisting rights;
disclosure in-content checked before boosting; Partnership ads for paid amplification; a claims log; quarterly compliance
sweep of live creator content.

**Organic 90-day plan:** pillars, cadence by platform, 12 post titles with proof assets, community-management SLA (comments
≤24 h, DMs ≤2 h business hours), review-response templates (no confidential facts), link-in-bio LP with UTM.

**EU/UK addendum:** DSA payer/beneficiary fields, no minors profiling, consent before pixels, influencer labels in the
national language, the ASA/CAP or national code cite per market, TTPA political-ads restrictions.

## 9 · Measurement and KPIs

CPM, CPC, CTR (link), hook/hold rates, CVR, CPL/CPA/ROAS by platform-reported vs GA4 vs CRM (named), frequency, reach,
EMQ, creative refresh rate, share of spend on concepts under 30 days old, speed-to-lead, lead-to-qualified rate, MER;
incrementality: conversion-lift studies, geo holdouts, MMM for larger budgets; benchmarks quoted only as vendor estimates
with source and year. Milestones hedged.

## 10 · Deliverable shape

Workbook tabs: **Social Ads Audit** (pillar × grade × finding × report/date × fix × owner × link), **Creative Ledger**
(ad × concept × format × start × spend × hook/hold/CTR × CPA × compliance flags), **Audience Map**, **Measurement Spine**
(pixel/CAPI/events/EMQ/consent verdicts), **Social Paid Intel** (rival × platform × active × longest-running × hooks × LP ×
tier × date), **Creator Compliance** (creator × post × disclosure × claims × status), **Organic Social** (platform × profile
completeness × cadence × engagement × video share × response time). Report: *Social Media Intelligence* (competitive) and
*Social Ads Audit* (own) inside Paid-Media Intelligence, plus *Organic Social* inside Competitive Position. CSV section
*Social Media*. Playbook: the measurement fix list, the account structure, the creative brief, the creator SOP, the organic
plan, the EU addendum.

## 11 · Fallbacks and refusals

| Situation | Adjustment |
|---|---|
| No account exports | the own-account audit is NOT ASSESSED; ship the competitive read from libraries, the site's pixel/consent read, and the pre-flight; Task #1 = exports named |
| TikTok library empty for a US rival | NOT COVERED (EEA/UK/CH only) — Creative Center trends and organic screenshots instead |
| Asked to buy followers, run engagement pods, or post reviews | no (16 CFR 465; platform rules); the organic plan instead |
| Asked to run an ad without the special-category declaration "to get better targeting" | no — suspension exposure; declare and adapt creative |
| Asked to skip creator disclosures ("it's just a gift") | no — gifting is consideration under the FTC guides and most EU regimes |
| Asked to target under-18s or use sensitive attributes | no; the platform and the DSA prohibit it |
| Ad-library scraping tools or connectors offered | not in this skill; dated screenshots and the Ad Library API (Meta, verified identity) are the routes |

## 12 · Volatility register (re-read live; dated 2026-09)

Meta Advertising Standards (`transparency.meta.com/policies/ad-standards`), the Special Ad Categories help pages, the
branded-content/Partnership-ads policy, the AI-disclosure requirement, the health-category data restrictions, Business
verification requirements, the Ad Library fields and API terms; TikTok Advertising Policies and industry entry
requirements per market, the US joint-venture status and data-handling terms, Commercial Content Library coverage, Smart+
and Spark Ads terms; LinkedIn Advertising Policies and the Ad Library; X Ads policies and the EU repository; Pinterest
Advertising Guidelines (weight loss, political); Snapchat Advertising Policies; Reddit Advertising Policy and the EU
repository; Nextdoor advertising policies; the FTC Endorsement Guides and 16 CFR 465; EU DSA ad-transparency rules and the
TTPA's application; the UK CAP Code; national influencer rules (DE, FR, IT, ES); platform attribution/EMQ thresholds.
