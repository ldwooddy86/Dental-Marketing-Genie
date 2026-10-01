# Severance · Texas family law market intelligence, build 2

Severance tells one Texas family law firm where marriages are ending and where the next filings are forming, county by county and ZIP by
ZIP, from public court, Census, labor market and child welfare data. Build 2 adds everything the DFW Thermal Debt Atlas build 4 (the HVAC
atlas in `../chrome-app`) can do, translated to a law practice: the campaigns written and exported for nine ad platforms, the website
written from the model and published to ten CMS routes, the connected ad and intake accounts whose actuals correct the model, a competitor
watch, a live desk for layoffs, claims and the court calendar, and one compliance engine (the Texas Disciplinary Rules of Professional
Conduct 7.01 to 7.06) that screens every ad and page before it leaves.

Nothing runs on a server. Data, models, the firm profile, credentials and every page live in this browser.

## Two ways to run it

- **Single file:** `../dist/Severance_2.html` opens from disk in any browser. Everything works offline; network features (publishing,
  account pulls, the live refresh) work where the remote service allows calls from a web page and explain themselves where it does not.
  In the claude.ai viewer, downloads go through the viewer and network calls are off.
- **Browser extension** (Chrome, Edge, Brave; Firefox 128+): `chrome://extensions` → Developer mode → Load unpacked → `severance/`
  (or unzip `../dist/severance-extension.zip`). Host permissions let the CMS adapters, ad connectors and live sources reach their APIs,
  and a background watch notifies on new WARN layoff notices and claims jumps in the firm's counties (badge: new notices in 14 days).
  The OAuth redirect URL for the ad platforms' consoles is `https://<extension id>.chromiumapp.org/`, shown in Options and module 23.

Start with the **Firm** button (top bar): the firm's name, lawyers (bar numbers, the responsible lawyer for Rule 7.02(a), any Texas
Board of Legal Specialization certification), offices (the primary practice location), counties, service lines, fees, brand and
profiles. Every ad and page reads it; until it is filled, generated copy carries bracketed placeholders that the compliance engine blocks.
**Backup** saves everything this browser holds for Severance in one file (credentials only if you ask) and restores it elsewhere.

## The modules

| # | Module | What it holds |
|---|---|---|
| 01 | Dissolution Index | Every county scored on seven measured components; map, detail and ranking |
| 02 | Filings Ledger | District court filings by case type, month and county, January 2019 to August 2026 |
| 03 | Marriage Market | The installed base: marriage cohorts, duration and the PUMS hazard curve |
| 04 | Risk Signals | Thirty variables that precede a filing, mapped and ranked |
| 05 | Economic Shock | Claims, unemployment, WARN notices and payrolls, and their lagged effect on filings |
| 06 | Service Lines | Thirteen family law lines resolved to the county, with pools, seasons and the Texas facts |
| 07 | Paid Acquisition | Where an ad dollar reaches the most filings per competing firm, by ZIP |
| 08 | Supply Line | Law offices and legal jobs against the filings they compete for |
| 09 | Timing Desk | Seasons, lags and the twelve month media calendar |
| 10 | Campaign Desk | Budgets, ZIPs, keywords and creative; bulk files for Google Ads Editor, Microsoft, Local Services, YouTube and Demand Gen, Meta, LinkedIn, Yelp, Nextdoor and TikTok, screened and paused |
| 11 | Compliance Screen | 77 rules: Rules 7.01 to 7.06 against the firm profile, platform policies, myths, stale numbers, Spanish; batch screening, safe fixes, the Advertising Review Committee filing log and the Texas changes register |
| 12, 14 to 19 | Metro tabs | Dallas Fort Worth, Houston, San Antonio, Austin, El Paso, the Rio Grande Valley and the other metros at ZIP resolution |
| 13 | Metro Atlas | The six largest metros at block group resolution |
| 20 | Method and Sources | Every source with its date, every formula, the judgment calls and the limits (top bar) |
| 21 | Site Forge | Practice area, county, city, attorney, guide and Spanish landing pages written from the model, screened, compiled to Elementor, HTML and JSON-LD (LegalService) |
| 22 | Publish | The pages sent to WordPress (Elementor or headless), Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla or Ghost, held back on a block finding |
| 23 | Accounts | Google Ads, Local Services Ads, YouTube, Meta, TikTok, Microsoft and LinkedIn, plus CallRail, CallTrackingMetrics, Clio Grow and Lawmatics imports; cost per lead and per retained matter by line, and corrections for the desk |
| 24 | Competitor Watch | A roster the firm builds, the ad library and bar links, observations, scores and screened competitor claims |
| 25 | Live Desk | WARN notices (data.texas.gov) and weekly claims (FRED), the Texas possession calendar, and day by day timing per line |

Setup per CMS: [docs/PLATFORMS.md](docs/PLATFORMS.md). Ad accounts: [docs/CONNECTORS.md](docs/CONNECTORS.md). Contracts and file layout:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Storage and privacy

- The firm profile and module state in `localStorage` (keys `sv.*`); CMS credentials and the sent ledger in `sv.cms.v1`, ad account
  tokens and actuals in `sv.accounts.v1` (`chrome.storage.local` in the extension). Intake imports keep no names, emails or phones.
- Network calls go only to the CMS the user configures, the ad platforms the user connects, data.texas.gov and FRED (Live Desk), and the
  Meta Ad Library API when the user runs it from Competitor Watch. No telemetry.
- The extension asks once for access to the firm's own site (optional host permission) when Publish first tests or deploys to it.

## Build and test

Node 22, no npm packages.

```
node build.mjs            validate, run the unit tests, write ../dist/severance-extension.zip and ../dist/Severance_2.html
node build.mjs --check    validate only (manifest, script order, one global scope, host permissions, syntax, CMS adapter drift)
node build.mjs --single   write the single file only
node tests/run.mjs        unit tests (CMS adapters and ad connectors against mock servers, the engines, importers, the live watch)
node tests/e2e/run.mjs    Playwright: every module of the single file and of the unpacked extension, light and dark, desktop and phone
node tests/e2e/publish.smoke.mjs   module 22 end to end with a recording adapter
node tools/order.mjs      rewrite the script and stylesheet lists in app.html after adding a file
node tools/extract.mjs <Severance.html>   rebuild data/ from a Severance single file (compact, columnar, exact round trip)
```

The CMS adapters in `src/cms/` are the Thermal Atlas adapters; the build warns if they drift from `../chrome-app/src/cms/` (only the
storage key and one WordPress hint differ, on purpose).

## Limits

Severance is analysis for marketing and planning, not legal advice. The compliance engine is a screen: it flags and cites, it does not
replace the responsible lawyer's review or the State Bar Advertising Review Committee filing Rule 7.04 requires. Platform formats and
policy citations that could not be confirmed against current documentation are marked in the files and the rule book. Model figures carry
an A to D grade; the Live Desk's step sizes and the desk's benchmarks are graded assumptions until the firm's own account data replaces them.
