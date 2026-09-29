
# EMERGENCYSATCHEL — the compliance movement of UltimaWeapon

*The bag you grab when the alarm goes off. Same rules of evidence as its predecessors (TheBriefcase,
TheDigitalBriefcase — not bundled; everything they contributed that this movement needs is inline
below). Websites and apps in scope.*

Read this file when UltimaWeapon screens a business's ads, ad and social accounts, website or mobile apps
for the platform, federal, state, industry and international violations that get ads disapproved,
accounts suspended and businesses reported — organised by **who enforces it**, **what is observable
from here**, and **where a report goes**. The clause mass lives in `references/codex.md` (industry
overlays, state-law tables, international overlay) and, for the American and European digital
marketing industries, in `references/digital-marketing-overlay.md`. The tooling is bundled:
`scripts/satchel_web.py` (raw-HTML forensics, cloaking diff, GTM expansion, disclosure regex packs,
app discovery, RDAP), `scripts/satchel_render.py` (Playwright render probe: pre-consent request log,
banner, screenshots), `scripts/satchel_app.py` (App Store + Play listing forensics, review RSS,
cross-store checks) and `scripts/build_workbook.py`. If a script cannot run in the session, run the
stage from the inline material and say so in the deliverable rather than inventing what it would have
produced.

The swagger stays in this file. The deliverable stays plain, calm and evidence-led. A satchel is
credible because every item in it is labelled, dated and sourced — not because it is heavy.

---

## Read this before you run it once

**Using this skill to mass-report competitors will get your own accounts actioned.** Coordinated or
bad-faith use of reporting tools is itself a violation on Google, Meta, TikTok, LinkedIn, X, Apple and
Google Play, and every one of them scores reporter reputation. A stream of reports that resolve as
"no violation" degrades every future report you file and can expose the reporting accounts. That is
not a disclaimer; it is the design constraint. EmergencySatchel is built to produce a **small number of
findings strong enough to survive review**, and to hold everything else in-house as intelligence. If a
run yields sixty CANDIDATEs and three CONFIRMEDs, you file three, and fifty-seven become the client's
competitive picture. That is the correct outcome.

The asymmetry applies with full force: an ad-policy or statutory accusation attaches
to a named advertiser, a named account, a named developer. An overstated finding is a false accusation
with a return address. Every rule below that seems fussy is protecting against the same failure —
turning "I noticed something" into "they broke the law" without the step in between.

---

## The five laws

The first four are inherited. The fifth is the one this movement lives by.

1. **Report only what you observed.** An unfetchable library is "unfetchable", never a guess at what it
   held. A WAF challenge is NOT_TESTED, never clean.
2. **Absence of evidence is not evidence.** No pixel, no disclosure, no license number, no privacy link —
   each has innocent explanations to rule out (below-threshold business, out-of-state, exempt medium,
   server-side stack) before it becomes a finding.
3. **Collect wide, filter hard.** Caution belongs at the reporting boundary, not the collection boundary.
4. **Infrastructure is not intent, and a tag is not a campaign.** A Meta Pixel proves a pixel loads. It
   does not prove spend, targeting, or knowledge. Every inference across that gap is *named as an
   inference* and ships CANDIDATE.
5. **Cite the rule you read, not the rule you remember.** Before a finding cites a statute, regulation,
   rule of professional conduct or platform clause, fetch the live text and quote it. Where the text is
   unreachable from here (LinkedIn's policy pages are robots-blocked; some state rules sit behind PDFs),
   cite it with a **vintage flag** ("rule text not re-verified this run; last verified 2026-09-15") and
   never a made-up section number. The Codex marks every cite ✔ (primary text fetched 2026-09-15) or ◐ (secondary
   source or memory); a ◐ cite must be fetched before it appears in a CONFIRMED finding. Section numbers change, rules get vacated (four did between 2025
   and 2026 — CARS, Click-to-Cancel, TCPA one-to-one consent, Colorado's original AI Act), and a wrong
   cite is worse than no cite because it is checkable and it will be checked.

---

## The terrain — what you can and cannot see (re-tested 2026-09-15)

**Every major ad library is still dark from here.** Verified by direct test:

| Surface | Result |
|---|---|
| Meta Ad Library (`facebook.com/ads/library`) | 403 |
| Meta Transparency Center ad standards | 400 + JS shell |
| Google Ads Transparency Center | 429 → `google.com/sorry` |
| LinkedIn Ad Library; all `linkedin.com` (incl. `/legal/ads-policy`) | 403 / robots-disallowed for WebFetch |
| TikTok Commercial Content Library (`library.tiktok.com`) | JS shell, no ad content |
| Microsoft Ad Library; X Ads Repository | JS shells |
| Reddit (incl. `business.reddithelp.com`) | JS shell / blocked |
| DSA Research API | 404/401 without an EU Login token |

Do not route around any of these with curl, scrapers, headless browsers, archives, mirrors, cached
copies or third-party ad-spy scrapers — wetware included: the persona reads target properties, never a platform
surface. The restriction is deliberate and applies to every method.
Say plainly, first, that you cannot see a single ad creative or targeting parameter — and then explain
why it matters less than it sounds like it should: an ad is *creative + targeting + advertiser identity
+ destination*, and the enforceable clause mass sits on identity and destination, which you can read
in full. **You cannot see the ad; you can see almost everything the ad is judged against.**

**What is reachable, and it is far more than last time:**

- **Raw HTML via the wetware fetcher** on target sites (`scripts/satchel_web.py scan`; WebFetch strips
  `<script>`, destroying the evidence this skill runs on, and identifies as a tool). The fetcher is a person's
  Chrome to every layer this process controls — header family, client hints, cookies, referer chain, asset
  footprints, reading-time pacing — so hosts that challenge on headers and cadence alone answer normally. Edges
  that score the TLS hello or the network (Cloudflare Bot Management, Akamai, DataDome) can still challenge from
  the cloud vantage (presence H1): SiteGround's `/.well-known/sgcaptcha/` returns **HTTP 202 "Robot Challenge
  Screen"**, Cloudflare returns 403 "Just a moment". Those are **NOT_TESTED** at H1 and go to the local pull (H2).
- **The render probe (real Chromium, `scripts/satchel_render.py`).** A real browser loads the page once, lets the
  page's own JavaScript run, waits, and reads. In testing, the SiteGround and Cloudflare JS challenges
  settle on their own within 4–7 seconds and the real page loads — with its full request log, which is
  the evidence for pre-consent tracker firing. **Rules of the probe:** one load in the persona's browser (the
  wetware context: new-headless Chromium, automation flag off, client hints and JS surface matching the
  persona), a settle that looks like reading (a beat, mouse travel, stepped scrolling), no proxy or IP rotation,
  no borrowed cookies, no retry loops, and if a *human* verification appears (Turnstile checkbox, hCaptcha,
  reCAPTCHA, "verify you are human") stop and record NOT_TESTED. The probe runs only against the target's own web properties and app-store
  listing pages — never against a platform surface in the table above.
- **App stores, wide open.** `apps.apple.com` listing HTML (~235K chars of server-rendered JSON: App
  Privacy labels, privacy-policy URL, seller, age rating, IAP, version history), the **iTunes Lookup and
  Search APIs** (`itunes.apple.com/lookup?id=` / `search?term=&entity=software`, no key), the **App Store
  review RSS** (`itunes.apple.com/us/rss/customerreviews/id=…/sortBy=mostRecent/json`), Apple's review
  guidelines page; `play.google.com/store/apps/details?id=` (~400K chars) and the dedicated **Data safety
  page** (`play.google.com/store/apps/datasafety?id=`), Play's policy centre and Play Console help.
  `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` on any domain reveal the
  apps a website vouches for. Exodus Privacy serves decoy text to non-browser fetchers — **not usable**.
- **Registries with real APIs, no key:** CFPB consumer complaint API; CPSC recalls API; openFDA (drug
  labels, device 510(k)/PMA, enforcement/recalls); NPI registry; FINRA BrokerCheck search API; ProPublica
  Nonprofit Explorer API; FMCSA SAFER company snapshot and the HHG mover search; EPA PPLS pesticide
  registrations; OIG LEIE download; CSLB, TDLR and most state license lookups (form-POST or JS — grade
  each registry as you go: API / form-POST / JS-only / blocked, and apply the null-result taxonomy below); Charity Navigator; RDAP; DNS-over-HTTPS; crt.sh;
  urlscan.io search; MDN HTTP Observatory (POST `observatory-api.mdn.mozilla.net/api/v2/scan?host=`);
  Wayback CDX (works again). **Not reachable:** NMLS Consumer Access (403), IRS TEOS (403), SEC IAPD API
  (403; the site is a JS shell), USPTO TSDR (needs key), TTB COLA (certificate chain error), BBB, Yelp,
  Trustpilot, Glassdoor, Indeed (WAF/403), PageSpeed API without a key (429).
- **Policy and law corpora, verbatim:** `support.google.com/adspolicy|merchants|localservices|
  googleplay|youtube|business`, `developer.apple.com/app-store/review/guidelines`, `ads.tiktok.com/help`
  (policy index and articles), `policy.pinterest.com`, `business.x.com/en/help/ads-policies`,
  `snap.com/ad-policies`, `help.ads.microsoft.com`, `affiliate-program.amazon.com/help/operating/
  agreement`; `ecfr.gov`, `uscode.house.gov`, `federalregister.gov`, `ftc.gov/business-guidance`, state
  statute sites (Texas, California, Florida, Washington, New York all render), `law.cornell.edu`.
- **`ads.txt` / `app-ads.txt`**, GTM containers (`googletagmanager.com/gtm.js?id=`), Snap's political ads
  page (renders; CSV links are JS-injected), the DSA Transparency Database UI and bulk downloads.

---

## The pipeline

### Stage 0 — Posture, then everything else

**Competitor/market** (default) or **client self-audit**. Same evidence rules, different deliverable:
self-audit findings ship as remediation tickets with an owner and a fix; competitor findings ship with
a remedy route and an evidentiary bar. Never blend postures in one workbook — a self-audit tab next to a
competitor tab is how a client's own exposure ends up in a document that leaves the building.

### Stage 1 — Resolve target, vertical, jurisdiction, surfaces

Pin five things before a single fetch: **targets** (one domain, a competitive set, a market roster — expand
geography yourself: a ZIP to its city and neighbors, a county to its incorporated cities AND named
unincorporated communities); **vertical** (this selects the Codex overlays, and the
overlays are where the strongest findings live); **jurisdictions** (where the business is, where it
sells, where its users are — a rule that binds in California or the EU may not bind a Texas-only
advertiser; the jurisdiction control clears a lot, so decide it up front); **surfaces in scope** (ads /
accounts / website / apps — the user may only want one); **the enforcement question the user actually has**
("what could get them reported", "are we safe to spend", "why was our account suspended", "is this app
listing compliant"). Write these five at the top of the READ ME tab.

### Stage 2 — Inventory before judgment

You cannot audit policy without knowing which platforms, pages and apps are in play.

1. **Web:** `python3 scripts/satchel_web.py scan` — homepage plus money pages (contact, quote/booking, financing,
   checkout, pricing, primary services, careers, thank-you/confirmation, privacy, terms, refund). Raw
   HTML, redirect chain, robots, tag fingerprints, **every GTM container expanded** (the fulcrum: a
   law-firm site that shows one GTM ID in HTML typically expands to Meta Pixel, Google Ads conversion,
   GA4, session replay and a dead UA property inside the container), social handles, `ads.txt`,
   `app-ads.txt`, AASA/assetlinks, smart-app-banner meta, store badge links.
2. **Apps:** `python3 scripts/satchel_app.py` — from the app IDs the site vouches for (and iTunes search on the brand
   name), pull both listings, the Data safety page, iTunes lookup, review RSS, and the privacy-policy URL
   each store shows.
3. **Accounts:** harvest handles and page IDs from footer/header links, schema `sameAs`, and the app
   listings' developer links. You cannot fetch the profiles; you can name the accounts a report would
   target.
4. **Render:** `python3 scripts/satchel_render.py` on the homepage and 2–4 money pages, in this order — pre-consent
   request log (passive load, then one visitor-like scroll: delayed-JS stacks such as WP Rocket fire
   nothing until the first interaction, and that interaction is not consent), consent-banner presence
   and behaviour, dark-pattern probes (countdown reload test, pre-checked boxes, scarcity strings),
   axe-core accessibility, evidence screenshots.

The container is a *configuration*, not a firing log; the render log is the firing log. Where the two
disagree, the render log wins for "what loads for a real user" and the container wins for "what the
business has wired up". Server-side tagging (first-party `/g/collect` endpoint, no client pixels) is a
reportable *observation* ("stack is server-side; client-side enumeration not possible"), never a clean
bill.

### Stage 3 — Set expectations

Say up front: no creatives, no targeting, no spend, no impressions, no account history, no in-app
runtime behaviour. Name the paid paths without implementing them — Meta Ad Library API (token + ID
verification), TikTok Commercial Content API (approved developer, EU data only), a commercial ad-intel
vendor, a mobile SDK-intel vendor for app runtime, a device farm for in-app flows.

### Stage 4 — Fetch the rule corpus for what the inventory turned up

Do not audit against remembered policy (law 5). Fetch the live clause text for the platforms actually
present and the overlays actually selected, and quote it in the finding. Google's four-part structure
(Prohibited content · Prohibited practices · Restricted content · Editorial & technical) remains the
best-organised spine, and Google's **Misrepresentation** family (unacceptable business practices,
coordinated deceptive practices, misleading representation, dishonest pricing, clickbait, misleading ad
design, manipulated media, unreliable claims, unclear relevance, unavailable offers) plus **Destination
requirements** are almost entirely landing-page facts. Apple's guidelines and Play's policy centre are
the equivalents for apps. The Codex holds the law tables.

### Stage 5 — Run the batteries (ordered by signal per unit effort)

**Battery A — paid and tag layer**
1. GTM container expansion. 2. **Cloaking diff** (opt-in, `--cloak`) — the wetware fetch of each money page is
the browser arm; `Googlebot` and `AdsBot-Google` arms are the run's only non-human requests and go in the
judgment-call block; a materially different body, redirect or status by UA is Google's
*Circumventing systems* (egregious; immediate suspension, no warning; 37% of 2026 suspensions in one
1,000-case agency sample †) and Play/App Store "hidden functionality". Deterministic if the diff is in the HTML;
CANDIDATE if only in JS-rendered content. 3. **AdsBot exclusion** in robots.txt — only if the rule names
`AdsBot-Google`; the wildcard is ignored by AdsBot (control C10b). 4. **Destination integrity** — dead
pages (a client site returning 502 at test time is a finding *and* a retest ×3 over 48 h), cross-domain
redirects, display-URL mismatch, bridge/doorway pages, geo-unavailable destinations. 5. **Special ad
category obligations** (Meta HEC: housing, employment, credit — BNPL is explicitly Credit; social issues
/ elections / politics) established from the site; CANDIDATE with the obligation named, a fix in
self-audit. 6. **Tracker/consent exposure** — pixel or CAPI event firing on intake, quote, checkout or
thank-you pages *before* any consent interaction, in health, legal, financial or children's contexts.
Meta's own **health-and-wellness data-source restrictions** (since January 2025; Level 1 strips
parameters, Level 2 blocks Purchase/Lead/AddToCart, Level 3 blocks all) mean a health advertiser
whose pixel fires Lead on a symptom-intake page is exposed on three fronts: Meta policy, the VPPA/CIPA/
MHMDA litigation wave, and HIPAA where a covered entity is involved (authenticated-page guidance
survives; the "unauthenticated page + IP address" theory was vacated 20 June 2024 and OCR withdrew its
appeal 29 August 2024). A CMP present *and correctly gating* is CLEARED and ships as such.
7. **Trademark and brand bidding** — competitor marks in title/meta/alt/schema; platform badges and
logos used without status (Google Guaranteed/Screened, BBB Accredited, Angi, "Editors' Choice"); government
seals and names (18 U.S.C. §§701/709; Medicare 42 U.S.C. §1320b-10; SSA Act §1140; HUD, VA, IRS).
8. **Lead-gen / MFA structure** — footer self-disclosure ("we are not a…", "connecting you with", "actors
or models"), shared identifiers, `ads.txt` reseller sprawl. 9. **Payer transparency** — Google now shows
who paid for an ad (two phases, May–June 2025 †secondary source); a business whose ads run under an
unrelated payer name is a CANDIDATE for agency/affiliate arbitrage.

**Battery B — website layer** (the *Web layer* section below).
**Battery C — app layer** (the *App layer* section below).
**Battery D — claims versus registries** — every badge and superlative is a testable claim: "Licensed &
Insured", "BBB A+", "Google Guaranteed", "Award-winning", "#1 in [city]", "EPA Certified", "Factory
Authorized", "Board Certified", "FDA Approved", "Member FDIC", "NMLS #", "USDOT #". Registry lookup: the Codex
names the registry per overlay (the §4 table for the trades). The six-way null-result taxonomy (below)
applies — a blank lookup is never a finding by itself.
**Battery E — reviews, testimonials, endorsements** — 16 CFR 465 and 255 (federal layer below): review
gating widgets, sentiment-conditioned incentives, insider testimonials, self-serving `AggregateRating`
markup, "verified" claims, employee posts without disclosure, affiliate links without the Amazon
Associates statement.
**Battery F — identity and impersonation** — RDAP registration date versus "since 1987", entity name
versus Secretary of State, seller name on the app listing versus the website's legal entity, look-alike
domains in crt.sh, the FTC Impersonation Rule (16 CFR 461, effective 1 April 2024) for government or
business impersonation.

### Stage 6 — The controls gate (mandatory, every candidate)

Every candidate binds to exactly one disposition — **CONFIRMED** (directly observed, quoted, survived
the controls, verified), **CANDIDATE** (real observation, innocent explanation open; ships with the open
question and "what would settle it"), or **CLEARED** (a control knocked it down; ships on the controls
tab naming the control). The inherited controls (consolidated list below) still apply.
EmergencySatchel adds:

- **Threshold.** CCPA/CPRA binds only businesses over $26.6M revenue (2025 adjustment) or 100,000
  consumers/households or 50%+ revenue from selling/sharing; most state privacy laws have 100k-consumer
  floors; COPPA needs child-directed content or actual knowledge; CalOPPA and MHMDA have no revenue floor;
  the California bot law needs 10M monthly US visitors; HIPAA needs a covered entity or BA. CLEARS most
  privacy findings against small businesses — run it before you write one.
- **Medium.** Texas Gov't Code ch. 81 subch. H binds *television* legal ads only; some bar rules exempt
  websites from filing; TTB and FDA rules define "advertisement" to include internet and social — check
  each rule's medium clause before citing it against a web page.
- **Exempt content.** Missouri's "choice of a lawyer" disclaimer is not required on a page limited to
  Rule 4-7.2(g) information; NY's "Attorney Advertising" label has media carve-outs; Amazon Associates'
  statement is required only where Special Links appear.
- **Obligation-bearer.** Reg Z attaches to creditors; Reg M to lessors; 11 U.S.C. §528 to debt relief
  agencies; TPMO disclaimer to third-party marketing organisations; 49 CFR 375.207 to interstate movers.
  A merchant advertising a third party's financing sits in a different seat. Flag the trigger and the gap;
  do not assign the duty.
- **Vintage.** The rule must have been in force at the time of the observed conduct: Click-to-Cancel
  (vacated 8 July 2025; ANPRM March 2026 — cite ROSCA and state ARLs instead), CARS (vacated January
  2025 — cite §5 and the March 2026 warning letters), TCPA one-to-one consent (vacated 24 January 2025;
  repealed September 2025 — PEWC still applies), Colorado SB 24-205 (enjoined 27 April 2026; replaced by
  SB 26-189, effective 1 January 2027).
- **Store-side.** A missing Play "delete account" link or a missing privacy-policy URL can be a listing
  rendering gap; confirm on both the listing and the Data safety page before CONFIRMED.
- **Challenge ≠ block.** A JS challenge that settles is a normal load; a human CAPTCHA is NOT_TESTED.
  Neither is evidence of cloaking.
- **Inherited:** Pixel ≠ campaign · Container ≠ firing · Consent Mode/CMP present · Agency tags ·
  Franchise/multi-location · Jurisdiction mismatch · Earned badges · Unpaid endorsement · Policy vintage.

### Stage 7 — Weight severity by enforcement base rate

Severity comes from how often a clause is actually enforced, not how bad it sounds. Priors you can
fetch: the **DSA Transparency Database** (EU-scoped, self-reported, ~43% automated — tells you what
platforms *enforce*); the **CFPB complaint API** by company (what consumers report about a financial
advertiser); **openFDA enforcement** and FDA warning letters (thousands of DTC letters since September
2025 — more in six months than the prior decade); FTC warning-letter sweeps (Consumer Review Rule
letters December 2025 with $53,088-per-violation exposure; 97 auto-dealer letters March 2026); Google's
own published suspension categories. Record the prior in the finding.

### Stage 8 — Verify adversarially

Every CONFIRMED finding that would be filed gets a refutation pass: a fresh fetch, the exact clause text,
and an explicit attempt to find the innocent reading. If an agent is available, brief one verifier per
finding with instructions to **refute** and to default to NOT CONFIRMED when it cannot personally
observe the evidence; if not, do the pass yourself from a cold fetch. Attack the inference chain, not
the observation.

### Stage 9 — Route every finding

A finding with no forum is not actionable. Every finding carries a **ROUTE** (table below) and, for
PLATFORM and STORE routes, the exact report channel.

### Stage 10 — Build and report

Workbook schema and reporting rules at the end of this card.

---

## The enforcement map — what kills an ad, what kills an account, where the report goes

Platform terms are private contract; you have no standing, the platform may or may not act, and the
reporter-reputation cost is real. Law outranks policy: when conduct violates both, lead with the
statutory cite and route to the regulator, then note the platform channel. Verified against live policy
pages 2026-09-15 unless marked †(from memory / secondary source — re-fetch before citing).

| Platform | What gets an ad or listing pulled | What gets the account killed | Report channel |
|---|---|---|---|
| **Google Ads** | Any policy disapproval; Destination requirements; Misrepresentation family; Healthcare/Financial/Legal certification gaps; Limited ad serving (aggressively enforced 2026: 30–90% delivery cuts for unverified/new advertisers †) | **Egregious, no warning:** Circumventing systems (cloaking, multi-account evasion, verification fraud), Unacceptable business practices (concealed/misstated business info, phishing, public-figure impersonation), Counterfeit, Suspicious payments, Malicious software, Coordinated deceptive practices; failed Advertiser identity / Business operations / Advanced verification. **Strike system** (warning → 3-day hold → 7-day hold → suspension, 90-day windows) for 15 policies incl. Enabling dishonest behaviour, Unapproved substances, weapons, tobacco, Clickbait, Misleading ad design, Bail bonds, Credit repair, Personal loans, Binary options | "Report an ad" troubleshooter (support.google.com/google-ads/troubleshooter/4578507); trademark complaint form; legal removal (support.google.com/legal); Ads Transparency Center "report" |
| **Google Merchant Center** | Misrepresentation (the #1 suspension cause): price/availability mismatch feed vs page, missing/contradictory **return & refund policy**, missing **contact info** (physical address and a working phone, email or form — check the live policy for the current minimum), insecure checkout, unclear billing, "Unsupported Shopping content" | Repeat Misrepresentation; egregious as above | Shopping ad "report"; Merchant Center policy violation form |
| **Google LSA** | License/insurance/background verification lapse; misrepresentation; unresponsiveness; category ineligibility | Failed verification; fake reviews; lead resale † | LSA provider "report" / Google Guaranteed support |
| **Google Business Profile** | Listing-integrity taxonomy §1–9 below (eligibility, name, address, website/phone, categories, media, reviews, service areas, duplicates) | Hard suspension; entity-level | Business Redressal Complaint Form; "Suggest an edit" |
| **YouTube** | Ad-friendly guidelines demonetisation; paid-promotion disclosure; altered/synthetic content label; Made-for-Kids designation (COPPA; $53,088/violation) | 3 Community Guidelines strikes in 90 days = termination; repeat monetisation abuse | Flag; legal/trademark forms |
| **Meta (FB/IG/Threads)** | Advertising Standards rejection; **Special Ad Categories** (housing, employment, credit incl. BNPL; social issues/elections/politics with disclaimer + verification); health & wellness data-source restrictions; before/after and implied-transformation bans; supplement disclaimer required in copy†; AI-generated creative disclosure†; financial-services advertiser verification in a growing list of markets (UK FCA, AU, TW, IN, SG… — check live) | "Advertising access restricted" / ad account disabled: unusual activity, repeat violations, circumventing ad review, unacceptable business practices; policy strikes; Business Manager and Page restrictions; 30-day probation after reinstatement† | In-feed "Report ad"; Ad Library report; IP report form; Special Ad Category misdeclaration via "Report ad" |
| **TikTok** | Industry Entry restrictions (prohibited: political, tobacco/vape, weapons, adult, drugs; restricted with certification/pre-approval: financial services incl. crypto/loans/BNPL, healthcare/pharma/telehealth, weight management, alcohol, gambling/lottery where legal, dating); Commercial Content (branded-content toggle) | Ad account permanent ban for repeat/egregious; Community Guidelines strikes; US operations under the 2026 joint-venture structure — re-check policy vintage† | In-app "Report"; TikTok for Business ad report form; IP form |
| **LinkedIn** | Prohibited: political ads, dating, tobacco, weapons, affiliate ads, MLM, occult, hate; Restricted: alcohol (age/geo), gambling (approval), financial products (disclosures; crypto limits), health/pharma, employment ads (no discrimination) — policy revised 18 Nov 2025 (page robots-blocked for WebFetch; cite with vintage flag) | Page/account restriction for repeat violations | "Report this ad" in feed |
| **X** | Ads policies (relaxed 2023–24: political ads with verification, cannabis/CBD limited, gambling and crypto with restrictions, Rx healthcare with certification)† | Account suspension | "Report ad" |
| **Pinterest** | Prohibited: **weight-loss ads** (pills, before/after, body shaming — GLP-1 Rx exception US/CA), tobacco, drugs/CBD, weapons, political, adult, clickbait, payday loans, pyramid schemes; Restricted: alcohol, financial, healthcare/pharma (prior approval), gambling/lottery (approval), contests (guidelines version effective 12 Nov 2026 is already posted) | Repeat violations | "Report Pin" |
| **Snap** | Prohibited tobacco/vape, drugs, weapons, adult, misleading; restricted alcohol, gambling, political (public library), financial/crypto, pharma/health† | Account restriction | In-app report |
| **Reddit** | Prohibited tobacco/vape, drugs, weapons, adult; gambling/crypto/financial with restrictions; political with rules† (help centre is a JS shell — vintage flag) | Advertiser ban | "Report ad" |
| **Microsoft Advertising** | Disallowed: weapons, tobacco, drugs; Restricted: alcohol, gambling (licensed), financial (loan APR/crypto), healthcare (pharmacy needs LegitScript), political, dating, real estate; Microsoft Ad Library exists for EU/DSA | "Suspicious activity" suspension | Report a concern form |
| **Amazon Ads / Seller / Associates** | Creative acceptance policies (supplement claims, pharma, alcohol, adult, weapons); Restricted Products | **Seller Code of Conduct** — review manipulation = deactivation; **Associates Operating Agreement** — missing statement "As an Amazon Associate I earn from qualifying purchases", links in email/PDF/offline, stale prices, cloaked links = termination | Seller Central "Report abuse"; Brand Registry; Associates support |
| **Apple App Store** | Guideline rejections: 2.3 accurate metadata (2.3.1 hidden features, 2.3.3 screenshots, 2.3.7 name/keywords), 3.1.2 subscriptions (clear terms, ≥7 days), **3.2.2(ix)** personal loans (all terms incl. max APR; **no APR >36% incl. fees; no repayment in full ≤60 days**), 1.4.3 tobacco/vape/controlled-substance sales, 5.1.1 privacy policy in metadata AND in-app, **5.1.1(v)** account deletion in-app if accounts exist, 5.1.2 ATT for tracking, 5.3 gambling licensing/geo-fencing, 4.3 spam | **5.6 Developer Code of Conduct**: discovery fraud, ratings manipulation, repeated rejections, fraudulent identity → developer account termination | Listing "Report a Problem" (Apple ID login); App Store Content Dispute (IP); reportaproblem.apple.com |
| **Google Play** | Developer Program Policy: Financial services (**Personal loans**: disclose min/max repayment, max APR, total cost; **APR >36% or ≤60-day full repayment prohibited**; Personal Loan Declaration; country licensing incl. **SECP for Pakistan**, RBI for India; no contacts/photos access; EWA reframed July 2026), Health apps, Families, User Data (prominent disclosure + consent; **Data safety must match actual practice**; privacy-policy link in listing AND in-app; **account deletion in-app + web link shown in listing**, enforced since 31 May 2024), Permissions (SMS/Call Log; call-log phone-verification use case removed July 2026), Deceptive behaviour, Impersonation, Manipulated media, Store listing (no misleading claims, keyword stuffing, unverifiable claims), Ratings/reviews/installs manipulation, Ads (disruptive), Subscriptions, unrated apps not permitted, target-API by 31 Aug 2026, Android developer verification & Play Console registration for all distributed apps (2026 rollout) | Repeat/serious violations; **associated-accounts** termination (bans propagate); failed developer verification | Listing "Flag as inappropriate"; Play policy report form; Google legal removal (IP) |
| **Card networks / processors** | Visa & Mastercard negative-option and free-trial rules: express consent, terms at enrolment, confirmation with cancel link, **reminder ≥7 days before a trial converts**, statement descriptor, easy online cancellation; Visa Integrity Risk Program tiers for high-risk MCCs; Stripe/PayPal/Square restricted-business lists | Fines to the acquirer, **MATCH** listing, merchant termination | Acquirer; network brand-protection forms |
| **Marketplaces & directories** | TikTok Shop, Facebook Marketplace, Etsy, eBay, Walmart, Zillow (fair housing), Indeed/ZipRecruiter (no fees, no MLM, pay-transparency), Angi/Thumbtack (license verification), Avvo/FindLaw (bar rules), Psychology Today/Zocdoc (license verification), Yelp (**Consumer Alert** posted publicly for compensated reviews) | Seller/listing termination | Each platform's report form |
| **Infrastructure** | Google Safe Browsing "deceptive site" flag (all Google Ads then disapproved under Malicious software / Compromised site); registrar/host abuse (WHOIS/RDAP accuracy, ICANN); BBB complaint and accreditation | Domain suspension; hosting termination | safebrowsing.google.com/safebrowsing/report_phish; registrar abuse@; BBB |

---

## The federal layer — universal rules (status as of 2026-09-15)

Law binds regardless of platform and routes to a forum that must at least log it. The universal set;
industry-specific federal rules (TTB, FDA, FIFRA, FMCSA, CMS, HUD, DOJ-IER, FINRA…) are in the Codex.

| Rule | Cite | Observable test | Ceiling | Route |
|---|---|---|---|---|
| Deception / unfairness | FTC Act §5, 15 U.S.C. §45 | Every unsubstantiated or false claim maps here; substantiation is the advertiser's burden | CANDIDATE (needs substantiation facts) unless the claim is checkable against a registry/record | FTC · STATE AG (UDAP mirrors: Tex. DTPA §17.46(b); Cal. UCL/FAL §§17200/17500; NY GBL §§349/350; Fla. FDUTPA §501.204) |
| Endorsements & testimonials | 16 CFR 255 (2023 revision) | Material connections disclosed *in* the content (not bio, not "more"); employees disclose employment in each post; "results not typical" is no safe harbour — disclose generally expected results (§255.2(b)); inadequate tags: #ambassador, #comped, "affiliate link" alone | CONFIRMED-capable for missing disclosure once a material connection is shown; else CANDIDATE | FTC · PLATFORM |
| Fake reviews & testimonials | 16 CFR 465 (eff. 21 Oct 2024) | §465.2 fake/insider reviews; §465.4 incentives conditioned on sentiment ("5-star review for 10% off"); §465.5 undisclosed insider; §465.6 company-controlled "independent" review site; §465.7 suppression + misrepresenting that displayed reviews are all/most submitted (**review-gating widgets**); §465.8 fake social influence. Civil penalties $53,088/violation for knowing violations; warning-letter sweep Dec 2025 | CONFIRMED-capable (gating funnel, sentiment-conditioned offer, insider testimonial page) | FTC · PLATFORM · Yelp/Google review report |
| Negative option / subscriptions | ROSCA 15 U.S.C. §§8401–8405 (in force); 16 CFR 425 Click-to-Cancel **vacated 8 July 2025**, ANPRM March 2026, comments closed 13 April 2026 | Clear disclosure before billing info, express informed consent, simple cancellation (Amazon $2.5B, Sept 2025) — on the page: pre-checked boxes, buried renewal terms, no online cancel, trial→paid without terms | CONFIRMED-capable for missing pre-billing disclosure; cancellation friction CANDIDATE unless flow observed | FTC · STATE AG (state ARLs — Codex) · CARD NETWORK |
| Unfair or deceptive fees | 16 CFR 464 (eff. 12 May 2025) — live-event tickets & short-term lodging | Total price incl. all mandatory fees shown first and most prominently; only taxes, shipping, optional add-ons excludable; no "convenience fee" vagueness (FTC v. StubHub, April 2026) | CONFIRMED-capable (drip pricing on a covered page) | FTC · STATE AG |
| Impersonation | 16 CFR 461 (eff. 1 Apr 2024) | Government or business impersonation in ads/landing pages: fake agency seals, "official" portals, brand look-alikes | CONFIRMED-capable when the impersonation is on the page | FTC · PLATFORM · registrar |
| Children's privacy | COPPA 16 CFR 312 as amended (eff. 23 June 2025; **compliance 22 April 2026**) | Child-directed sites/apps: separate verifiable consent for third-party disclosure/targeted ads, **published written retention policy**, security program, direct-notice contents; enforcement 2025: Cognosphere $20M, Disney $10M, Apitor | Retention-policy absence CONFIRMED-capable on a child-directed service; else CANDIDATE | FTC · STORE (Families policies) |
| Health apps breach notice | HBNR 16 CFR 318 (amended 2024) | Not observable from outside; note exposure for health apps/sites sharing with ad platforms (GoodRx, BetterHelp, Premom precedents) | CANDIDATE only | FTC |
| Telemarketing / lead-gen | TSR 16 CFR 310 (2024 amendments incl. inbound tech-support); TCPA 47 U.S.C. §227 + 47 CFR 64.1200 (PEWC; **one-to-one rule vacated 24 Jan 2025, repealed Sept 2025**; revocation rules April 2025; AI voice = artificial voice, Feb 2024) | Lead forms: consent language present, unchecked box, "not a condition of purchase", seller(s) named, E-SIGN-compliant; debt-relief advance-fee ban §310.4(a)(5) | Form-language absence CONFIRMED-capable as an exposure, violation CANDIDATE (depends on call practice) | FTC · FCC · STATE AG (mini-TCPAs: FL FTSA, OK, WA) · PRIVATE |
| Email | CAN-SPAM 15 U.S.C. §7701; 16 CFR 316 | Physical postal address, working opt-out honoured in 10 business days, no deceptive subject lines — testable only by receiving mail; note as exposure | CANDIDATE | FTC |
| Credit advertising | TILA/Reg Z 12 CFR 1026.24 (closed-end), 1026.16 (open-end), 1026.24(f)–(i) & Reg N 12 CFR 1014 (mortgage) | Triggering terms (down payment, payment amount, number/period of payments, finance charge) → APR "using that term", terms, down payment; "$99/month" without APR is facially observable; mortgage ads: no "fixed" for ARMs, no government-endorsement implication | CONFIRMED-capable for trigger + missing disclosure; obligation-bearer control applies | CFPB · STATE AG |
| Lease advertising | CLA/Reg M 12 CFR 1013.7 | Lease triggering terms (payment amount, number of payments, amount at signing) → total at signing, number/amount/period of payments, whether purchase option exists; **lease-to-own / rent-to-own is state law (Codex)** | CONFIRMED-capable for trigger + missing disclosure | CFPB · STATE AG |
| Deposit / FDIC claims | FDIA §18(a)(4); 12 CFR 328 subpart B (misrepresentation; in force since April 2024 — text not re-fetched this run) + subpart A digital signage (§§328.4–328.5 compliance **1 Jan 2027**, per FDIC FIL Nov 2025) | Non-bank/fintech claiming "FDIC insured" without naming the insured bank and the pass-through structure; crypto "insured" claims; Truth in Savings/Reg DD 12 CFR 1030.8 (APY term) for deposit ads | CONFIRMED-capable | FDIC · CFPB |
| Free credit reports | Reg V 12 CFR 1022.138 | Any website offering a "free credit report" must carry the boxed notice "THIS NOTICE IS REQUIRED BY LAW… You have the right to a free credit report from AnnualCreditReport.com or (877) 322-8228, the ONLY authorized source under Federal law." across the top of each such page, with links | CONFIRMED-capable (deterministic) | CFPB · FTC |
| Credit repair | CROA 15 U.S.C. §1679 | No advance fees; no promises to remove accurate information; required written disclosures; TSR debt-relief rule | CONFIRMED-capable for advance-fee or "remove accurate items" copy | FTC · STATE AG |
| Business opportunities / MLM | 16 CFR 437; §5 (Koscot); FTC 2024 earnings-claims sweep | Earnings claims without the disclosure document; "be your own boss / $10k month" claims; recruitment-focused pay plans | CANDIDATE unless the disclosure gap is on the page | FTC · STATE AG |
| Made in USA / origin | 16 CFR 323 (2021); 16 CFR 303.34 + 303.1(u) textiles (online "made in USA / imported" statement); 19 U.S.C. §1304 marking | Unqualified "Made in USA" on products with significant imported content; apparel listings without an origin statement | Textile origin CONFIRMED-capable (deterministic); Made in USA CANDIDATE (needs sourcing facts) | FTC · CBP |
| Warranty pre-sale | Magnuson-Moss; 16 CFR 702.3(c) | Online sellers advertising a warranty must make the full terms available before sale (text or link to the warrantor's page) | CONFIRMED-capable | FTC |
| Pricing claims | 16 CFR 233 (former price, comparable value, "up to"), 238 (bait), 239 (guarantees), 251 ("free") | Strikethrough "was" prices, "up to 70% off", "free" with hidden conditions, money-back guarantees without material conditions | CANDIDATE unless the condition-gap is on the page (then CONFIRMED-capable) | FTC · STATE AG (Cal. B&P §17501 three-month rule; NY, MA 940 CMR 6) |
| Shipping claims | 16 CFR 435 (Mail/Internet/Telephone Order Rule) | "Ships in 24h" style claims need a reasonable basis; delay-notice practice | CANDIDATE | FTC |
| Green claims | 16 CFR 260 Green Guides | "eco-friendly", "biodegradable", "compostable", "recyclable", "carbon neutral", "non-toxic" without qualification | CANDIDATE | FTC · STATE AG (Cal. B&P §17580.5) |
| Marketplace seller transparency | INFORM Consumers Act (eff. 27 June 2023) | High-volume third-party seller identity disclosure on marketplaces | CANDIDATE | FTC · STATE AG |
| Ticket bots | BOTS Act 15 U.S.C. §45c | Resale sites circumventing purchase limits | CANDIDATE | FTC · STATE AG |
| Fair lending in ads | ECOA/Reg B 12 CFR 1002.4(b) (discouragement); FHA 42 U.S.C. §3604(c), 24 CFR 100.75 | Copy or targeting that discourages protected classes ("perfect for young professionals", "no kids"); housing ads with preference language | CONFIRMED-capable for explicit language | CFPB · HUD FHEO · DOJ |
| Age / citizenship in job ads | ADEA 29 U.S.C. §623(e); INA §274B, 8 U.S.C. §1324b | "recent grads only", "digital native"; "U.S. citizens only" / "OPT/H-1B only" without a legal requirement (Compunnel, $313,420, 6 April 2026) | CONFIRMED-capable for explicit language | EEOC · DOJ IER |
| Trademark / false advertising | Lanham Act 15 U.S.C. §§1114, 1125(a) | Competitor marks in copy/meta; false comparative claims — competitor standing exists | CANDIDATE → PRIVATE / NAD | NAD (BBB National Programs) · PLATFORM IP forms · PRIVATE |
| Accessibility | ADA Title III (DOJ position: websites are places of public accommodation; ~4,000+ suits/yr); Cal. Unruh $4,000/violation; Title II rule (govs) deadlines extended April 2026 | axe-core WCAG 2.1/2.2 AA violations on money pages; missing accessibility statement | CANDIDATE (WCAG is not a Title III standard by regulation) — exposure, not violation | PRIVATE · DOJ |
| Political ads | FEC 11 CFR 110.11 disclaimers (internet rule 2022); state "paid for by" laws; 20+ state deepfake laws | Missing disclaimer; undisclosed synthetic media in a candidate ad | CONFIRMED-capable for missing disclaimer | FEC · STATE ELECTIONS · PLATFORM |

---

## The web layer — the website behind the ads

Run against the homepage and every money page. Each test names its rule; the Codex adds the vertical
rules (bar disclaimers, license numbers, TPMO, §528, cannabis license number, and so on).

| # | Test | Rule(s) | Ceiling |
|---|---|---|---|
| W1 | **Privacy policy present, linked from every page, resolves 200, dated** | CalOPPA Cal. B&P §§22575–22579 (any commercial site collecting PII from Californians: categories collected, third parties, review/change process, change notice, effective date, Do-Not-Track response); Apple 5.1.1 and Play User Data (link in listing AND in-app); GDPR Art. 13 for EU-facing | CONFIRMED-capable (deterministic) |
| W2 | **CCPA surface** — "Do Not Sell or Share My Personal Information" or "Your Privacy Choices" link; notice at collection near forms; GPC honoured/acknowledged | Cal. Civ. Code §1798.100 et seq.; 11 CCR §§7012, 7013, 7025; CPPA regs (ADMT/risk assessment/cyber-audit tiers from 1 Jan 2026); 20 state laws in effect 2026 (IN, KY, RI added 1 Jan 2026; CT and UT amendments plus Arkansas 1 July 2026); universal opt-out signals mandatory in at least CA, CO, CT, DE, MD, MN, MT, NE, NH, NJ, OR, TX | CONFIRMED-capable once the **threshold control** is passed; else CLEARED |
| W3 | **Consumer health data policy link on the homepage** | Washington MHMDA RCW 19.373.020(1)(b) (in force since March 2024; private right of action); Nevada SB 370 analogue; Connecticut consumer-health-data consent | CONFIRMED-capable for a health-adjacent site with WA users |
| W4 | **Pre-consent tracker firing** (render log) on intake/checkout/thank-you pages; **Consent Mode v2** presence for EEA-facing sites; CMP gating | ePrivacy Art. 5(3)/GDPR for EU; Google's EU user consent policy (Consent Mode v2 since March 2024); VPPA 18 U.S.C. §2710 (video pages + Meta Pixel); CIPA Cal. Penal Code §§631/632.7/638.51 (session replay, chat, pixels); BIPA; HIPAA where a covered entity; Meta health data restrictions | US: exposure, CANDIDATE; EU-facing: CONFIRMED-capable |
| W5 | **Auto-renewal / subscription flow** — terms clear and conspicuous before purchase, affirmative consent, acknowledgment, online cancel, renewal reminder, trial-conversion notice | ROSCA; Cal. B&P §§17600–17606 (AB 2863, eff. 1 July 2025: click-to-cancel parity, annual reminders); NY GBL §527-a; VT 9 V.S.A. §2454a; OR ORS 646A.295; IL 815 ILCS 601; CO, MD, MN, TN, NC, FL, VA, DC and ~12 more (Codex); Visa/MC trial rules | CONFIRMED-capable for missing pre-purchase disclosure on the checkout page |
| W6 | **Refund/return policy posted** | Cal. Civ. Code §1723; NY GBL §218-a; Fla. §501.142; Google Merchant Center requirement | CONFIRMED-capable |
| W7 | **Dark patterns** — countdown timers that reset on reload (render test), static "only 3 left", fake "12 people viewing", pre-checked consent, confirmshaming, drip pricing, obstruction, trick questions | FTC §5 + 2022 staff report taxonomy; 16 CFR 464 for covered fees; 11 CCR §7004 (consent obtained through dark patterns is not consent); EU DSA Art. 25; UK DMCC | Timer-reset and pre-checked-consent CONFIRMED-capable; scarcity claims CANDIDATE |
| W8 | **Pricing & offer claims** — former price, "up to", "free", guarantees, "lowest price", "wholesale" | 16 CFR 233/239/251; Cal. B&P §17501; EU Omnibus 30-day lowest-price rule (Directive 98/6/EC Art. 6a) for EU-facing sales | See federal table |
| W9 | **Health/efficacy claims** — "FDA approved/registered/cleared", "clinically proven", "cures", "safe", "no side effects", GLP-1 "same as Ozempic" | FTC Health Products Compliance Guidance (2022); FDA (FD&C Act §§502/505; 21 CFR 101.93(c) DSHEA disclaimer for structure/function claims; "FDA registered" ≠ approved; March 2026 warning letters to 30 telehealth firms); Codex health overlay | "FDA approved" for an unapproved product CONFIRMED-capable via openFDA; efficacy claims CANDIDATE |
| W10 | **Review & testimonial provenance** — gating widget, sentiment-conditioned incentive, insider testimonial, "verified" claim, review count mismatch, **self-serving `AggregateRating`** in LocalBusiness/Organization schema (ineligible for rich results since 2019; reportable as structured-data spam) | 16 CFR 465/255; Google structured-data policies | CONFIRMED-capable |
| W11 | **Affiliate & sponsorship disclosure** — affiliate links (Amazon `tag=`, ShareASale, Impact) without a clear disclosure; missing Amazon Associates statement; "sponsored"/"advertorial" labels | 16 CFR 255; Amazon Associates Operating Agreement; EU UCPD Annex I (advertorials) | CONFIRMED-capable |
| W12 | **Form consent language** (TCPA/CAN-SPAM/CCPA notice at collection); SMS consent (CTIA/10DLC) | See federal table; 11 CCR §7012 | Exposure CONFIRMED-capable; violation CANDIDATE |
| W13 | **Chatbot / AI disclosure** — site chatbot or AI receptionist that presents as human; AI-generated imagery presented as real | EU AI Act Art. 50 (**applicable 2 Aug 2026**; legacy systems by 2 Dec 2026; up to €15M/3%): chatbots disclose at first interaction, deepfakes labelled, machine-readable marking; Cal. B&P §§17940–17943 (bots that incentivise a purchase; **10M monthly US visitors threshold**); Cal. SB 243 companion chatbots (1 Jan 2026); Utah AI Policy Act (disclose on request; proactively in regulated occupations); Cal. SB 942/AB 853 AI Transparency Act (**operative 2 Aug 2026**, covered providers >1M monthly users, $5,000/day); Colorado SB 26-189 (1 Jan 2027, consequential-decision notices only) | EU-facing chatbot without disclosure CONFIRMED-capable; US small-site chatbot CLEARED by threshold unless UT/CA-companion applies |
| W14 | **Age assurance & minors** — adult content without age verification; child-directed content with third-party ad tags | Free Speech Coalition v. Paxton (June 2025) upheld Tex. HB 1181; 20+ state AV laws; COPPA; Nebraska AADC (1 Jan 2026); UK Online Safety Act (AV since July 2025); Australia under-16 social media minimum age (10 Dec 2025, platforms' duty) | CONFIRMED-capable for adult sites without AV in AV states |
| W15 | **Accessibility** — axe-core on money pages; accessibility statement; EAA for EU e-commerce/banking/transport since 28 June 2025 | ADA III/Unruh (exposure); EAA (obligation) | CANDIDATE (US) / CONFIRMED-capable (EU-facing, EAA) |
| W16 | **Security & integrity** — cert validity, mixed content, Observatory grade, urlscan verdicts, redirect chains, WAF status | Google Malicious software / Compromised site; Play Malware | CANDIDATE |
| W17 | **Sweepstakes / contests** — official rules, "no purchase necessary", eligibility, odds, registration/bonding for prizes >$5,000 (FL §849.094, NY GBL §369-e; RI >$500) | State lottery/sweepstakes law; 39 U.S.C. §3001 | CONFIRMED-capable for missing NPN/rules |
| W18 | **Prop 65** — products sold into CA needing a warning: on the product page, via a "WARNING" hyperlink, or before checkout | 27 CCR §25602(b); short-form transition to 1 Jan 2028 | CANDIDATE (chemical content unknown) unless the product class is a known warning class |
| W19 | **Careers pages / job ads** — pay range in postings (CO, CA, WA, NY, HI, DC, MD, MN, IL, NJ, VT, MA + NYC, Jersey City, Ohio cities; DE from Sept 2027), citizenship-only or visa-preference language, age cues | State pay-transparency statutes; IER; ADEA | CONFIRMED-capable (pay range absent in a covered posting) |
| W20 | **Identity** — legal entity name and address on the site vs Secretary of State/RDAP; "since 19xx" vs registration; "locations" that are virtual offices | GBP guidelines; FTC §5; bar/contractor rules | CONFIRMED-capable where a record contradicts the claim |

---

## The app layer — the apps behind the website

Discovery: AASA (`applinks`, `appID`), assetlinks.json (`package_name`, cert fingerprints),
`<meta name="apple-itunes-app">`, store badge links, iTunes search on the brand, Play search page. Then:

| # | Test | Rule(s) | Ceiling |
|---|---|---|---|
| A1 | **Privacy policy URL on both listings resolves and is the same policy as the website's** | Apple 5.1.1(i); Play User Data; CalOPPA; COPPA | CONFIRMED-capable |
| A2 | **App Privacy labels (Apple) vs Data safety (Play) vs the privacy policy** — "Data Not Collected" beside a policy describing ad-tech sharing; "Advertising or marketing" sharing on Play but "no tracking" on Apple; cross-store contradiction | Apple 5.1.2; Play "Data safety must match actual practice"; FTC §5 (privacy misrepresentation cases) | Cross-store contradiction CONFIRMED-capable as a contradiction; which side is false CANDIDATE |
| A3 | **Account deletion** — Play listing shows the data-deletion badge and web link; Apple listing/app offers deletion | Play account-deletion requirement (31 May 2024); Apple 5.1.1(v) | CONFIRMED-capable on Play (badge/link observable); CANDIDATE on Apple (in-app) |
| A4 | **Loan / cash-advance / EWA / BNPL apps** — terms in the listing or linked page state max APR, repayment period, total cost; APR ≤36% incl. fees; no ≤60-day full repayment; licensing for the market (SECP/RBI/…); no contacts/photos permissions rhetoric | Apple 3.2.2(ix); Play Personal Loans; TILA/Reg Z if a creditor; state lending law; Codex financial overlay | CONFIRMED-capable when the listing states the offending term; CANDIDATE when silent |
| A5 | **Subscriptions** — free-trial terms, price, renewal, cancellation stated before purchase in listing/IAP descriptions; "free" with mandatory IAP | Apple 3.1.2; Play Subscriptions; ROSCA; state ARLs; Visa/MC | CONFIRMED-capable |
| A6 | **Health, mental-health, period, fertility, addiction apps** — Play Health apps policy; HBNR exposure; MHMDA; HIPAA if BA; medication/telehealth claims (DEA telemedicine flexibilities extended through 31 Dec 2026) | See rules named | CANDIDATE |
| A7 | **Gambling / sweepstakes / fantasy apps** — licensing and geo-fencing; sweepstakes-casino bans (CT, MT, NV 2025; NY/NJ/CA pending or enacted — verify live); responsible-gaming helplines required in ads by NJ, MA (205 CMR 256.06), PA, NY, OH | Apple 5.3; Play Gambling; state gaming law | CONFIRMED-capable for a banned-state listing with no geo restriction stated; else CANDIDATE |
| A8 | **Kids / mixed audience** — Families/Kids category, age rating (Apple's 2025 overhaul: 4+/9+/13+/16+/18+), ad SDKs, COPPA retention policy, Texas SB 2420 (in effect since 4 June 2026 after the Fifth Circuit stay; age brackets, parental consent, $10,000/violation for developers), Utah and Louisiana analogues 2026, California AB 1043 (2027) | As named | CONFIRMED-capable for rating/content mismatch; legal exposure CANDIDATE |
| A9 | **Ratings & reviews manipulation** — review RSS: velocity spikes, templated text, same-day bursts, version-locked 5-stars; incentivised-review prompts on the site | Apple 5.6.3/5.6.4; Play Ratings/reviews/installs; 16 CFR 465 | CANDIDATE unless the incentive is on the page (then CONFIRMED-capable) |
| A10 | **Metadata honesty** — keyword-stuffed names, screenshots showing features absent from the description, "#1"/"best"/"official" claims, fake award badges, impersonating another brand's name/icon | Apple 2.3.1/2.3.3/2.3.7, 5.2; Play Store listing & Impersonation | CONFIRMED-capable for impersonation/badge misuse; CANDIDATE for feature claims |
| A11 | **Developer identity** — seller/developer name and contact vs the website's legal entity; Play developer address/email present (required for org accounts); D-U-N-S verification; app-ads.txt on the developer domain for ad-monetised apps | Apple 1.5; Play Developer verification; IAB app-ads.txt | CONFIRMED-capable for a mismatch |
| A12 | **Synthetic media & AI apps** — deepfake/undress apps, AI content without in-app reporting, AI companions without disclosure | Play Generative AI policy; Apple 1.2/5.6; TAKE IT DOWN Act (platform removal duty by 19 May 2026); Cal. SB 243; EU AI Act Art. 50 | CONFIRMED-capable for prohibited app class |
| A13 | **Permissions rhetoric** — listing/description promising features that require SMS/Call Log/Accessibility/background location beyond core use | Play Permissions; Apple 5.1.1 | CANDIDATE |
| A14 | **Cross-check with the ads** — a site running Meta credit ads for an app whose listing states a 0%–299% APR range; app deep links from ad landing pages to unlisted apps | Meta HEC; Apple/Play loan rules | CANDIDATE |

Runtime behaviour (SDK network calls, ATT prompt timing, in-app purchase flows) is **NOT OBSERVABLE**
from here; say so on the NOT OBSERVABLE tab and name the device-farm / SDK-intel path.

---

## Routing

| Route | Forum | What it takes | Realistic outcome |
|---|---|---|---|
| **PLATFORM** | In-product ad/account report (table above) | Clause, URL, screenshot, date | Ad or account action; slow; opaque; reporter reputation at stake |
| **STORE** | App Store "Report a Problem" / Content Dispute; Play "Flag" / policy report / legal removal | Guideline number, listing URL, evidence | App update block, removal, developer action |
| **FTC** | reportfraud.ftc.gov; rule-specific | Documented pattern | No individual remedy; feeds sweeps; civil penalties for knowing 465/COPPA/ROSCA violations |
| **CFPB** | consumerfinance.gov/complaint | Ad copy + missing disclosure | Complaint database entry (public); supervisory attention |
| **STATE AG / UDAP** | Consumer protection division | Consumer harm, in-state respondent | Varies; strongest with a pattern (auto-renewal, fees, impersonation) |
| **LICENSING BOARD** | State trade authority | License number or its absence, plus the claim | Often the fastest real consequence for trades |
| **STATE BAR** | Advertising/ethics committee | Rule + copy | Real teeth; some bars pre-screen ads (FL 20-day filing, TX, LA, NV) |
| **FEDERAL SECTOR** | FDA (drugs/devices/supplements/vape/DTC), TTB (alcohol), FIFRA SLA (pesticides), FMCSA (movers), CMS (Medicare marketing; TPMO), HUD FHEO (housing), DOJ IER (citizenship in job ads), EEOC, SEC/FINRA, FDIC, FEC, CPSC, ED (Title IV) | Cite + copy + registry check | Warning letters, untitled letters, penalties |
| **STATE SECTOR** | Gaming commission, cannabis regulator, insurance department, charity registrar, DMV/dealer board, health department, real-estate commission, elections | Cite + copy | Fines, license action |
| **NAD** | BBB National Programs (competitor challenge) | Substantiation dispute, filing fee | Decision + FTC/FDA referral on non-compliance |
| **CARD NETWORK** | Acquirer / brand protection | Trial/subscription non-compliance, prohibited MCC | Fines, MATCH, termination |
| **INFRA** | Safe Browsing, registrar, host | Deception/malware evidence | Site flag; domain suspension |
| **PRIVATE** | Counsel's call, not yours | — | Flag and stop. Do not advise |
| **NONE** | Intelligence only | — | Most findings. Say so plainly |

---

## Building the workbook

`python3 scripts/build_workbook.py` takes a JSON of tab → rows and emits the workbook (neutral palette,
frozen headers, autofilter, live hyperlinks). Tabs:

| Tab | Contents |
|---|---|
| READ ME | Posture, targets, vertical, jurisdictions, surfaces, the enforcement question, what could not be observed, how to read disposition/route |
| PLATFORM INVENTORY | Per domain/app: every tag (page vs container vs render log), IDs, handles, apps, CMP |
| CLAUSE COVERAGE | Every clause family and law assessed: testable / partial / needs-ad-or-app-access |
| FINDINGS | Clause or cite, verbatim rule text, verbatim evidence + URL + timestamp, disposition, severity, base-rate prior, **route + channel** |
| CONTROLS APPLIED | Every CLEARED candidate bound to its control |
| FEDERAL & STATE LAYER | Findings citing statutes/regs, with the rule-text fetch date |
| WEB LAYER | W1–W20 per page |
| APP LAYER | A1–A14 per app per store |
| CONSENT & TRACKERS | Pixel-by-page matrix; pre-consent firing; CMP; Consent Mode |
| ACCOUNTS & CHANNELS | Every account/listing a report would name, with the exact report channel |
| NOT OBSERVABLE | Creatives, targeting, spend, in-app runtime, review histories behind WAFs — and what it costs to get them |

The NOT OBSERVABLE tab is mandatory. Self-audit runs add OWNER and FIX columns and drop routes.

## Reporting

Lead with the strongest CONFIRMED findings and their routes. State coverage as a fraction of clause
families and rule tables assessed, never "comprehensive". Name what you could not see in the first
paragraph. Surface the CLEARED set. If verification overturned something, say so. Give the honest
count: *"Fifty-two observations. Four CONFIRMED, three routable. Thirty-one CANDIDATE, held. Seventeen
CLEARED."* That sentence is the deliverable's credibility.

Deliverable defaults: unbranded, metadata-scrubbed PDF brief + the workbook; disavow-style plain lists
where the user asks for them; no operator mark unless the user asks.

## Inherited controls (consolidated — every candidate passes through the ones that apply)

Pixel ≠ campaign (a tag proves a tag loads) · Container ≠ firing (GTM configuration vs the render log) ·
Consent Mode / CMP present and gating → CLEARED · Agency / vendor tags (a container or property owned by
a third party is attributed to that party, not assumed to be the business's own campaign) · Franchise /
multi-location (one brand across many locations sharing a phone is legal intake) · Jurisdiction mismatch
(the rule must bind where the business is, sells or targets) · Earned badges (registry confirms → CLEARED)
· Unpaid endorsement (no material connection → 16 CFR 255 does not attach) · Policy vintage (in force at
the time of the conduct) · Threshold · Medium · Exempt content · Obligation-bearer · Store-side rendering ·
Challenge ≠ block · Search-sample (a WebSearch null is a sample of one vantage, not the index) · Registry
currency (records lag; date every lookup) · Name-variant (DBA vs legal entity before any "not found") ·
Rendering artifact (ALL CAPS, truncation, mobile wrapping are not signals) · Timing (ad libraries are
snapshots; a dead page is retested ×3 over 48 h before it is CONFIRMED).

## Null-result taxonomy (six readings of a blank lookup — pick one and write it down)

1. Wrong registry or jurisdiction for that trade (pest control sits under Agriculture in most states;
   Texas licenses no general contractors; California is its own map).
2. Name variant — DBA, legal entity, prior name, holding company.
3. Below threshold or exempt from licensing / the rule.
4. Search or registry blocked, JS-only or form-POST from here → NOT TESTED, never "not licensed".
5. Record lag — recently issued, renewed or transferred.
6. Genuinely absent — still CANDIDATE until the authoritative registry for that state AND trade returns a
   negative you can quote, with the lookup URL and date.

## Listing-integrity taxonomy (Google Business Profile, nine areas — this skill's numbering, not Google's)

§1 Eligibility (in-person contact with customers at a staffed place or in their service area; ineligible:
lead-gen and call-centre fronts, virtual-only operations, unstaffed or rental-property listings, "actors
or models" disclosures) · §2 Name (the real-world name only; no keywords, geo modifiers, taglines, phone
numbers or URLs) · §3 Address (a physical, staffed location; no PO Box, PMB, mail-centre suite or virtual
office; service-area businesses hide the address and declare areas) · §4 Website and phone (a site the
business controls that does not redirect to another business; a phone under the business's direct
control — distinct business names on one number is the call-centre tell) · §5 Categories (primary matches
the actual trade) · §6 Photos and media (no stock imagery presented as the business's own) · §7 Reviews
(no incentives, gating, employee or fabricated reviews) · §8 Service areas (a defensible radius and count)
· §9 Duplicates and multiple profiles (one profile per business per location; department and practitioner
rules). Reckoning Phase 3E runs the screen; every row ships with the section number and the disposition.

## Companion references

- **`references/codex.md`** — industry overlays (legal, healthcare & wellness, financial services, home
  services & trades, real estate & housing, auto, e-commerce & retail, employment & biz-opp, education,
  alcohol/tobacco/cannabis, gambling & sweepstakes, adult & dating, weapons, travel & events, food &
  organic, nonprofits & political, government-adjacent, pets, tech/SaaS/AI, beauty & fitness, care &
  funeral), the state-law tables and the international overlay. Read at Stage 1 (overlay selection) and
  Stage 4 (rule fetch).
- **`references/digital-marketing-overlay.md`** — the American and European digital marketing industries:
  agency claims, partner badges, awards, testimonials and case studies, review platforms, cold outreach,
  tracking deployed on client sites, lead-gen and directories, EU/UK information duties and consent rules,
  and the national enforcement routes. Read whenever the target is an agency, a martech vendor, a lead-gen
  network, or a business whose marketing was built by one — which is nearly always.
- **`references/legal-content.md`** — the copy layer for law-firm targets (Counsel movement).
- **`references/reckoning.md`** Phase 3E — the listing-integrity screen procedure.
