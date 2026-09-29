# HANDSET — the apps doctrine of UltimaWeapon (ASO, store compliance, attribution, app growth)

The Satchel's app layer (A1–A14) is the *compliance* screen; `scripts/satchel_app.py` is the *listing forensics* tool;
this file is the doctrine for the whole surface: how the two stores rank and convert listings in 2026, what each store's
policies actually enforce, how an app is attributed and measured after Apple's and Google's privacy changes, how app
campaigns work on Apple, Google, Meta and TikTok, how deep links and the web-to-app path are audited, the company-archetype
variations (a bank's app and a plumber's booking app are audited differently), the fixes as specs, and the volatility
register — store rules change quarterly and this file is dated.

Articles that bind: store metrics come from App Store Connect / Play Console exports or public listing data with the
source named; downloads, revenue and keyword "difficulty" from third-party tools are vendor estimates; runtime behavior is
NOT OBSERVABLE from here; every policy clause is fetched live; no fake reviews, no incentivized ratings, no keyword
stuffing.

## 1 · What is observable from here

| Signal | From here | How |
|---|---|---|
| Apple listing: name, subtitle (from the page), description, seller, genre, age rating, price, IAP presence, ratings and count, version and release dates, screenshots count, supported devices, minimum OS, languages, size, privacy-policy URL, App Privacy label headings | **Observed** | iTunes Lookup API + the listing page (`satchel_app.py lookup --ios`) |
| Apple reviews (most recent, up to 500, by country) with velocity / burst / templated-text signals | **Observed** | the customer-review RSS |
| Apple keyword rank proxy for a term | **Observed** (a search sample, labeled) | iTunes Search API `entity=software` (`satchel_app.py search`) — the API's order is not the App Store's exact ranking; label as proxy |
| Google Play listing: title, developer, contains ads / IAP, content rating, developer email/site/address, privacy link, data-deletion badge, install bucket, rating, screenshots/video presence, description | **Observed** (page HTML; some fields JS-rendered — record what was present) | `satchel_app.py lookup --android` |
| Play Data safety page | **Observed** | `/store/apps/datasafety?id=` |
| Play keyword rank proxy | **Partly** (the search page is JS-heavy) | screenshot protocol from a device in the market |
| Deep-link files (`.well-known/apple-app-site-association`, `assetlinks.json`), smart-app-banner meta, store badges, `app-ads.txt` | **Observed** | `satchel_web.py scan` |
| App Store Connect / Play Console analytics (impressions, product page views, conversion rate, installs, retention, crashes, ANRs, keyword rankings, in-app events) | **Export only** | requested in Phase 0 (App Analytics → Metrics/Acquisition/Retention; Play Console → Statistics, Store performance, Android vitals) |
| MMP data (AppsFlyer/Adjust/Branch/Singular/Kochava), SKAN/AAK postbacks, Apple Ads / Google App campaign reports | **Export only** | requested with date ranges |
| Runtime behavior: SDK calls, ATT prompt timing, IAP flows, permission prompts | **NOT OBSERVABLE** | named on the NOT OBSERVABLE tab; a device-farm / SDK-intel vendor is the path |
| Store policy text | **Observed** | fetch live (register in §12) |

## 2 · How the stores rank and convert (ASO doctrine)

**Apple App Store.** Indexed fields: **name** (30 chars), **subtitle** (30), the **keyword field** (100 chars, comma-separated,
no spaces, no plurals needed, no brand you do not own), in-app purchase display names, developer name, category; not
indexed: the description (conversion only), promotional text (170, editable without a build), what's new. Ranking inputs:
keyword relevance across those fields, download velocity and totals, ratings and review count/quality, retention and
engagement signals, crash-free stability, freshness (updates), and the conversion rate of the product page for that query
(a page that converts well for "plumber near me" earns that term). Conversion assets: icon, screenshots (first 2–3 carry
the message; captions), app preview videos (autoplay, first seconds), ratings, the subtitle, in-app events (indexed,
searchable, featured), **custom product pages** (up to 35 pages with their own screenshots/text, each with a URL for ads
and web campaigns; Apple Ads can target them), **product page optimization** (A/B tests of icon/screenshots/previews on the
default page), localization (each storefront is its own index — a US app with one language forfeits every other
storefront's keywords), the age rating (Apple's 2025 overhaul to 4+ / 9+ / 13+ / 16+ / 18+ with an expanded questionnaire;
developers were required to update ratings by early 2026 — verify the deadline and whether the app's rating was re-declared),
"Apple Ads" (renamed from Apple Search Ads in 2025 — verify) placements above the results, and Featuring (editorial;
pitched via App Store Connect's "Promote your app"). Apple Search Ads' keyword data (impressions by term) is the best
first-party keyword source Apple offers — request the export.

**Google Play.** Indexed: **title** (30), **short description** (80), **full description** (4,000 — indexed; natural keyword
use counts, stuffing is a policy violation), developer name, category, tags; ranking inputs: relevance, install velocity and
totals, uninstall rate, ratings/reviews (recent weighted), engagement/retention, **Android vitals** (crash rate, ANR rate;
apps over the "bad behavior" thresholds lose visibility and get a warning on the listing), update cadence, and store
listing conversion. Conversion assets: icon, feature graphic (used for video cover and some placements), screenshots
(phone/tablet/Chromebook/Wear/TV), promo video (YouTube URL), the short description above the fold, ratings, **store listing
experiments** (A/B), **custom store listings** (up to 50; by country, language, keyword/UTM audience, pre-install), event
cards (LiveOps), pre-registration, the Data safety section (a trust and conversion element), the "Data deletion" badge and
link, developer verification badges, and the install bucket ("1M+"). Google's search also surfaces Play listings in web
results and in AI answers.

**Both:** ratings are a ranking *and* a conversion input; the in-app review prompt (Apple `SKStoreReviewController` — at
most three prompts per 365 days per user; Google In-App Review API with quotas) at a moment of success; rating resets on
Apple by version (optional, a decision); reply to reviews (both stores; replies can lift a rating); never incentivize,
never gate, never buy (Apple 5.6.3 / 5.6.4; Play "Ratings, reviews and installs" policy; 16 CFR 465). Localization is the
largest under-used lever for any app with non-English users. Keyword research without tools: store autocomplete on a
device (screenshot), rival listings' names/subtitles/short descriptions, the Apple Ads keyword impressions export, GSC queries
for the web pages, GBP queries for local apps, support tickets; volume claims come only from an export the client supplies
(Apple Ads, or a vendor tool labeled as such).

## 3 · Store policy — what actually gets an app rejected, removed or the account terminated

**Apple App Review Guidelines** (cite the live section number): 1 Safety (1.1 objectionable content, 1.2 UGC needs
filtering/reporting/blocking, 1.4 physical harm, 1.6 data security); 2 Performance (2.1 completeness — no placeholders,
demo accounts for review; 2.3 accurate metadata — screenshots reflect the app, no hidden features, no "#1"/"best" claims
that are not substantiated, no brand names you do not own; 2.5 software requirements — no private APIs, no downloaded
executable code); 3 Business (3.1.1 in-app purchase for digital goods; **3.1.1(a)** external purchase links in the US
after the Epic v. Apple injunction of April 2025 — Apple's rules on link placement and any commission were revised;
verify the current US terms; 3.1.2 subscriptions — clear terms, price, renewal; 3.1.3 exemptions (reader apps, physical
goods, services consumed outside the app); 3.1.5 cryptocurrency/financial (licensing); 3.2.2(ix) loan apps — max APR
disclosure, APR ≤36 %, no ≤60-day full repayment); 4 Design (4.2 minimum functionality — no "web wrapper" apps; 4.3 spam
and duplicates; 4.8 Sign in with Apple parity when third-party login exists); 5 Legal (5.1.1 data collection and storage
— privacy policy link in the listing and in-app, consent for data collection, account deletion in-app since 2022; 5.1.2 data
use and sharing — **App Tracking Transparency** for cross-app tracking; 5.1.3 health; 5.1.4 kids; 5.2 intellectual
property; 5.3 gaming/gambling; 5.4 VPN; 5.5 developer identity; 5.6 developer code of conduct — 5.6.3 discovery fraud,
5.6.4 app quality/abandonment). Plus: **Privacy Nutrition Labels** must match practice; **privacy manifests** and
required-reason API declarations for the app and its SDKs (enforced since May 2024) with SDK signatures; the **Declared
Age Range** API (iOS 26) and the state age-assurance laws (§8); EU **alternative distribution** and the Core Technology
Commission/fee regime (changed January 2026 — verify); Apple's developer verification (D-U-N-S for organizations); the
Small Business Program (15 %); App Store Server Notifications for subscription compliance.

**Google Play Developer Program Policies** (cite the live section): **User Data** (privacy policy in the listing and
in-app; prominent disclosure and consent for sensitive data; **Data safety** must match practice; account deletion in-app
and via a web link with the badge; **Photo and Video permissions** policy limiting `READ_MEDIA_IMAGES/VIDEO` to core use);
**Permissions** (SMS/Call Log restricted to default handlers; Accessibility API only for accessibility unless declared;
`QUERY_ALL_PACKAGES`; exact-alarm; foreground service types); **Families** (target audience and content; Teacher Approved;
no ad SDKs not certified for families); **Restricted content** (financial services — personal loans: APR ≤36 % where
applicable, ≥60-day term, licensing documents per country, no contacts/photos access; gambling and real-money gaming by
country with licensing; health — Health apps policy with documentation for regulated claims; blockchain-based content;
alcohol/tobacco; adult; violent extremism); **Deceptive behavior and impersonation** (misleading claims, fake reviews,
copycat names/icons, deceptive device settings changes); **Malware, MUwS, mobile unwanted software**; **Ads** (disruptive
ads, interstitial rules, Families ads certification, `app-ads.txt` recommended); **Monetization** (Play billing for digital
goods; alternative billing programs in the EEA, India, Japan, South Korea and — after the Epic v. Google remedies — changes
in the US to external links and billing; verify the current US terms and fee schedule; subscriptions transparency);
**Spam and minimum functionality**; **Store listing and promotion** (no keyword stuffing, no unattributed "#1", no
misleading screenshots); **Target API level** (new apps and updates must target a recent Android API level — the
requirement moves each August; verify the current level); **Developer account requirements** (D-U-N-S for organizations
since 2023; the 20-tester / 14-day closed-testing requirement for new personal accounts; developer address and email shown
publicly; **Android developer verification** for apps distributed outside Play, announced 2025 and rolling out through
2026–27 — verify); Play Integrity API; Play App Signing; **Android vitals** thresholds; policy status and appeals in the Play
Console (three-strike patterns; account terminations propagate to associated accounts — "circumvention").

**Other stores** (one line each): Amazon Appstore (Fire devices; policy analogues), Samsung Galaxy Store, Huawei
AppGallery (no GMS), Microsoft Store (Windows), the EU alternative iOS marketplaces (AltStore PAL, Epic Games Store, Setapp
Mobile — each with its own review), web distribution in the EU; regional stores (China: none of Google's — Xiaomi/Huawei/
Tencent stores with ICP licensing).

## 4 · Attribution, measurement and privacy (what the numbers mean now)

**iOS**: ATT (opt-in for IDFA; typical opt-in rates are a vendor estimate), **SKAdNetwork 4.0** (crowd anonymity tiers,
coarse/fine conversion values, three postbacks over ~35 days, hierarchical source IDs) and **AdAttributionKit** (iOS 17.4+,
also for alternative marketplaces, re-engagement) — install-level attribution is gone; campaign-level modeled
attribution through the MMP is what remains; Apple Ads reports its own attribution via the AdServices framework. **Android**:
Google Play Install Referrer (deterministic for Play installs), GAID with the user's opt-out, Privacy Sandbox on Android
(Google announced in 2025 it would wind down the Android Privacy Sandbox effort — verify the current state of the
Attribution Reporting API), MMP SDKs. **MMPs** (AppsFlyer, Adjust, Branch, Singular, Kochava): SDK integration, event
mapping, SKAN conversion-value schema, deep-link handling, fraud protection (click injection, click spamming, SDK spoofing,
install hijacking — request the fraud report), cost aggregation, cohort reports. **Analytics**: Firebase/GA4 (events,
retention, crashes via Crashlytics), App Store Connect (impressions, product page views, conversion rate, downloads,
redownloads, proceeds, retention by day, crashes), Play Console (store performance, acquisition by channel, retention,
Android vitals). **Privacy in tracking**: no PHI/financial data in SDK events, consent for EEA/UK, the Data safety /
Privacy label parity with what the SDKs actually send (A2 in the Satchel), children's apps without ad SDKs not certified.

**KPIs** (sources named): impressions → product page views → installs (conversion rate by source and by country), CPI /
CPA / cost per trial, D1/D7/D30 retention, DAU/MAU, sessions, crash-free users (%), ANR rate, rating and review velocity,
keyword ranks (Apple Ads impressions, or a vendor export), LTV/ROAS by cohort (MMP + revenue data), subscription metrics
(trial→paid, churn, renewals via Server Notifications / RTDN), organic vs paid share, web-to-app conversion (§6).

## 5 · App campaigns (paid acquisition; measurement rules above apply)

**Apple Ads** (Search results, Search tab, Today tab, product pages; Basic = CPI automated, Advanced = keyword CPT with
match types, Search Match, negative keywords, custom product pages as destinations, audience refinement (new users /
returning / users of my other apps), age/gender/location, and the keyword impressions report); brand defense on the
app's own name is usually mandatory (rivals bid on it); the Apple Ads attribution API for SKAN-free measurement of its own
installs. **Google App campaigns** (formerly UAC; assets: headlines, descriptions, images, videos, HTML5; objectives:
installs, in-app actions, pre-registration; tCPA/tROAS; placements across Search, Play, YouTube, Display, Discover;
the audit checks asset coverage, Play listing quality (it is the LP), event optimization on real events, and placement
exclusions for kids' content). **Meta app promotion** (Advantage+ app campaigns; SKAN campaign limits per app; AEM
event configuration; deferred deep links; Android vs iOS split budgets). **TikTok app promotion** (Smart+ app campaigns;
SKAN support; creative from Spark Ads). **Ad networks** (AppLovin/AXON, Unity, ironSource, Moloco, Digital Turbine,
Liftoff) for scale — fraud controls and placement quality are the audit points. **Creator/influencer installs** (tracked
links, custom product pages, disclosure rules from `social-ads.md`). **Owned channels**: web-to-app (§6), email/SMS with
deferred deep links, QR codes with UTM/deep links, in-store signage for local apps.

## 6 · Deep links, web-to-app and the site's app surface

`/.well-known/apple-app-site-association` (JSON, no extension, served as `application/json`, HTTPS, `applinks` with app
IDs and path components; `webcredentials` for password autofill) and `/.well-known/assetlinks.json` (package name +
SHA-256 cert fingerprints; `delegate_permission/common.handle_all_urls`) — fetched and validated (`satchel_web.py`);
universal links / App Links open the app for the same URLs the site ranks for; **deferred deep links** through the MMP for
new installs from ads; **smart app banner** (`<meta name="apple-itunes-app" content="app-id=…, app-argument=…">`) and the
Android equivalent (a Play badge or an install prompt — not an interstitial that blocks content, which is a mobile
usability/spam issue); **App Clips** (iOS) and (retired) Instant Apps; the store badges linking to the correct storefront
with campaign parameters (`?pt=&ct=&mt=8` for Apple's campaign tracking; `&referrer=utm_source%3D…` for Play); the
web-to-app funnel measured by store-link clicks (GA4) vs product page views (App Store Connect) vs installs.

## 7 · Company-archetype playbooks

- **Local service / booking apps (clinics, salons, gyms, contractors):** the app is a retention tool — ASO on the brand
  name plus 2–3 service terms, localization for the market's languages, review prompts after a booking, push consent at the
  right moment, HIPAA (health) or PCI (payments) in the stack, the site's smart banner and GBP app link; paid installs
  rarely justify their CPI — say so.
- **Multi-location / franchise / retail apps:** store locator inside the app, local inventory, loyalty (the retention
  engine), geofenced push with consent, Data safety parity, custom store listings by region.
- **E-commerce apps:** retention and repeat-purchase economics vs web; Advantage+ app campaigns with catalog; deferred
  deep links from every ad; SKAN conversion values mapped to revenue tiers; App Clips/QR for in-store; reviews velocity.
- **SaaS / B2B apps:** ASO on category terms; the app is a companion — measure activation, not installs; enterprise
  distribution (Apple Business Manager, managed Google Play) rather than store campaigns; Sign in with Apple parity.
- **Fintech / lending / banking:** the highest-scrutiny archetype — Apple 3.1.5 / 3.2.2(ix), Play Personal Loans documents
  per country, licensing (state lending, NMLS; SECP/RBI in South Asia), APR disclosure in the listing, no contacts/photos
  permissions, KYC vendor SDKs in the privacy labels, security disclosures, the Satchel's financial overlay, and the
  Meta/Google credit special-category rules for its ads (`social-ads.md`, `paid-media.md`).
- **Healthcare / wellness / femtech / mental health:** Play Health apps policy documentation, HIPAA if a covered
  entity/BA, the FTC Health Breach Notification Rule, Washington MHMDA and analogues, sensitive-data consent, no ad SDKs
  transmitting health events, clinical claims vs W9, age gates.
- **Kids / family / education:** Families policy, COPPA (the amended rule with 2026 compliance dates — verify), no
  behavioral ads, certified ad SDKs only, Apple Kids category rules, the state age-assurance laws (§8), Teacher Approved.
- **Gambling / sweepstakes / fantasy / social casino:** licensing per jurisdiction, geo-fencing, responsible-gaming
  content, the sweepstakes-casino state bans (verify the current list), Apple 5.3 / Play Gambling.
- **Dating, social, UGC:** 1.2 UGC controls, age assurance, DSA duties in the EU, Online Safety Act (UK), TAKE IT DOWN Act
  removal duties (US, 2026), AI-generated content rules.
- **Media / publishers / streaming:** reader-app exemptions, subscription rules, external links in the US, offline content,
  DRM, ad SDK disclosures.
- **Apps by agencies for clients:** developer account ownership (the client's, not the agency's — a hostage situation
  when it is not), the listing's developer identity vs the client's legal entity (A11), keys and signing ownership.

## 8 · Legal overlay specific to apps (the Satchel routes; verify every date live)

US state app-store age-assurance laws (Texas SB 2420 — the App Store Accountability Act — with its 2026 litigation and
effective status as the Satchel's A8 records; Utah's and Louisiana's 2026 analogues; California AB 1043 for 2027):
age-bracket signals from the stores, parental consent for minors' downloads/purchases, developer duties to consume the
signal; COPPA; the FTC's Health Breach Notification Rule; state privacy laws (opt-out signals in-app; universal opt-out
support); the EU DSA (both stores are VLOPs; in-app UGC duties), DMA (alternative marketplaces, anti-steering), GDPR
(consent for SDK tracking; the CJEU/EDPB position on consent-or-pay), the UK Online Safety Act (UGC apps; age assurance for
adult content), Australia's under-16 social-media minimum age (platform duty), India's DPDP Act rules, Brazil's LGPD;
accessibility (EAA for apps in scope since June 2025; ADA exposure in the US); the TAKE IT DOWN Act's removal duty; the
Apple/Google external-purchase rulings (US, EU, Japan's Mobile Software Competition Act effective December 2025 — verify)
that change what a listing and an in-app screen may say about pricing and links.

## 9 · The audit protocol

1. **Discovery** — apps from the site (AASA, assetlinks, banners, badges), from iTunes search on the brand, from Play
   search; confirm the developer identity matches the legal entity (A11).
2. **Listing forensics** — `satchel_app.py lookup` for every app and market: metadata quality (name/subtitle/short
   description keyword use vs the money terms; description structure; screenshots count and message; video presence;
   localization count; category fit; age rating; price/IAP), ratings and review signals (velocity, bursts, templated text,
   version-locked stars — CANDIDATE unless an incentive is visible), update cadence (last version date; an app untouched
   for 18 months is a 5.6.4 / abandonment exposure and a trust problem), size and minimum OS, privacy-policy link and label
   headings, Play Data safety statements and the deletion badge.
3. **Keyword and competitor read** — the iTunes Search API sample for 10–20 terms (rank proxy, labeled), rival listings'
   indexed fields, gaps (terms rivals own in their names/subtitles that the client's metadata lacks), Apple Ads keyword
   export if supplied.
4. **Compliance screen** — the Satchel's A1–A14 with the live clause for each, the controls gate, dispositions, routes.
5. **Deep-link and web surface** — §6 checks; the store badges' targets and parameters; the site's app content (an
   "app" page that ranks for "[brand] app").
6. **Measurement spine** — from exports: MMP present, SKAN schema, AEM configuration, event mapping, fraud report,
   attribution windows, GA4/Firebase, App Store Connect and Play Console access; verdict trustworthy / broken since <date>.
7. **Campaign audit** — Apple Ads (keyword match types, brand defense, CPP use, negatives, CPT by term), Google App
   campaigns (assets, event optimization, placements), Meta/TikTok app campaigns (SKAN limits, creative, deferred deep
   links), network buys (fraud, placement quality); performance by source with the attribution model named; incrementality
   questions (organic cannibalization by brand keyword ads).
8. **Performance and vitals** — conversion rate by source and country, retention curves, crash-free %, ANR rate vs Play
   thresholds, rating trend, subscription funnel; the one number the owner watches (usually D30 retention or trial→paid).
9. **Grade** — A–F per pillar (Listing & ASO · Reviews & Trust · Compliance · Measurement · Acquisition · Vitals &
   Retention) with the evidence class; a listing with a cross-store privacy contradiction caps at C until resolved.

## 10 · Fixes as specs

**Listing spec (Apple):** name = brand + one primary term (≤30); subtitle = the value proposition with the second term
(≤30); keyword field = 100 chars of comma-separated, deduplicated terms not already in name/subtitle (no spaces, no brand
names you do not own, singular forms); promotional text = current offer/event; description = benefit-first paragraphs, a
feature list, social proof with permission, support/privacy links; screenshots = 6–10 with caption headlines that read as
a sequence, first three carry the pitch; preview video ≤30 s, first 3 s the hook; in-app events for launches/seasons;
custom product pages per campaign/persona (URLs into ads); localization for every storefront with real users; the age
rating questionnaire re-declared.

**Listing spec (Play):** title = brand + primary term (≤30); short description = the pitch with 1–2 terms (≤80); full
description = natural coverage of the term set in the first 2–3 paragraphs, feature blocks, trust and support, no
stuffing; feature graphic on brand with the promise; screenshots as above per form factor; promo video; Data safety
completed to match the SDK inventory; deletion link live; custom store listings by country/language and by campaign
(UTM-keyed); store listing experiments on icon and first screenshot; LiveOps events.

**Review SOP:** in-app prompt after a success event with the store quotas respected; reply to every review under 4★
within 48 h with a fix path; never incentivize or gate; monitor velocity monthly; report policy-violating reviews through
the store tools only.

**Compliance remediation:** the A1–A14 tickets with clause, fix, owner, and store; privacy label / Data safety
reconciliation against the SDK inventory (a table SDK × data collected × purpose × linked/tracking); account-deletion
flow; loan/subscription disclosures in listing and in-app; age rating and age-signal handling; target API level; app-ads.txt.

**Measurement fix list:** MMP SDK + SKAN 4 conversion schema (values mapped to revenue/qualification tiers), AEM
configuration (Meta), deferred deep links tested, Install Referrer on Android, Firebase events aligned with store
events, Crashlytics, App Store Connect/Play Console access for the operator, a monthly cohort report.

**Acquisition plan:** brand defense on Apple Ads (exact match, low CPT cap), 10–30 category terms in phrase/exact with
custom product pages, Google App campaigns on real in-app events with placement exclusions, Meta/TikTok app campaigns on
the platform where the audience is with creator creative, web-to-app on the site's top pages, QR/in-store for local, a
90-day budget scenario table with assumptions labeled.

## 11 · Deliverable shape

Workbook tabs: **App Inventory** (app × store × market × ID × developer × version date × rating × count × link), **ASO
Audit** (field × current × target × rationale × link), **Keyword Proxy** (term × Apple rank proxy × rivals × source),
**Review Intelligence**, **App Compliance** (A1–A14 rows), **Deep Links & Web** (AASA/assetlinks/banner/badges), **App
Measurement** (MMP/SKAN/AEM/events verdicts), **App Campaigns** (source × spend × installs × CPA × attribution model),
**Vitals & Retention** (from exports). Report: *Apps & ASO* section (new) and the app rows inside Compliance & Exposure.
CSV section *Apps & ASO*. Playbook: the two listing specs, the review SOP, the compliance tickets, the measurement fix
list, the acquisition plan.

## 12 · Fallbacks and refusals

| Situation | Adjustment |
|---|---|
| No App Store Connect / Play Console exports | listing-level audit only; installs, retention, vitals and campaigns NOT ASSESSED; Task #1 = exports named |
| Play search page unreadable from here | keyword rank proxy for Play is a screenshot task; Apple's proxy ships labeled |
| Asked for download or revenue estimates | vendor estimates only if the client supplies a tool export; never invented |
| Asked to buy reviews, incentivize ratings, or stuff keywords | no (store policies; 16 CFR 465) |
| Asked to hide data collection in the privacy label / Data safety | no — misrepresentation exposure (FTC §5; store policy); reconcile the labels instead |
| Runtime behavior questions (what SDKs send, ATT timing) | NOT OBSERVABLE; a device-farm / SDK-intel vendor or the developer's own network capture |
| EU/US external-purchase link questions | fetch the current store terms for the market; the rules changed repeatedly in 2025–2026 |

## 13 · Volatility register (re-read live; dated 2026-09)

Apple App Review Guidelines (`developer.apple.com/app-store/review/guidelines`), App Store Connect help (custom product
pages, product page optimization, age ratings, privacy labels, in-app events), Apple's US/EU/Japan external-purchase
terms, the Declared Age Range API docs, Apple Ads help; Google Play Developer Program Policies (`support.google.com/
googleplay/android-developer/answer/9857753`), the target API level page, developer verification (Play and Android),
Data safety requirements, alternative billing programs by country, Android vitals thresholds, Play Console policy status;
the state age-assurance laws' effective dates and litigation (TX, UT, LA, CA); COPPA amendments; SKAdNetwork /
AdAttributionKit versions; the Android Privacy Sandbox status; MMP fraud-detection docs; the sweepstakes-casino state
list; the TAKE IT DOWN Act timelines; the EU alternative marketplace list.
