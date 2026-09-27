# Integrity Air · DFW Thermal Debt Atlas, browser app, build 4

The atlas as a Chrome and Firefox extension: heating and cooling campaign intelligence for the twelve counties of Dallas Fort Worth, the
website written from it, and the accounts that run the campaigns. Build 4 adds module 16, Publish, which sends the pages the Site Forge writes
(or your own) to ten CMS routes, and module 15 gains the TikTok Ads, Local Services Ads and YouTube connectors next to Google Ads, Meta,
Microsoft Advertising and LinkedIn.

Nothing runs on a server. Data, models, credentials and every page live in the extension's local storage on this machine.

## Install in Chrome (or Edge, Brave)

1. Unzip `thermal-atlas-extension.zip` somewhere permanent (the browser loads the folder from disk on every start).
2. Open `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`), turn on Developer mode.
3. Load unpacked, choose the unzipped folder.
4. Pin the icon. The popup shows the weather picture; Open the atlas opens the app in a tab.

The redirect URL for the ad provider consoles is `https://<extension id>.chromiumapp.org/`; Options and module 15 show it. The id changes
when the folder moves, so check it again after reinstalling. Updating: replace the folder's files and click Reload on the extensions page;
storage survives.

## Install in Firefox

Temporary (until Firefox restarts): `about:debugging#/runtime/this-firefox`, Load Temporary Add-on, pick `manifest.json` in the folder.

Permanent: Firefox needs a signed add-on. Sign it once with Mozilla's `web-ext` (free, unlisted channel):

```
npm install -g web-ext
web-ext sign --channel unlisted --api-key <AMO JWT issuer> --api-secret <AMO JWT secret>
```

Keys come from `addons.mozilla.org/developers/addon/api/key/`. Open the `.xpi` in Firefox to install it. Developer Edition and Nightly can set
`xpinstall.signatures.required` to false in `about:config` instead.

Firefox treats host permissions as optional: after installing, open module 15 or Options and click Grant site access so the weather check and
the connectors can reach their hosts. The redirect URL is `https://<hash>.extensions.allizom.org/`, shown in Options.

## The modules

| # | Module | What it holds |
|---|---|---|
| 01 | Thermal Debt Index | Where aging heating and cooling systems are coming due, ZIP by ZIP |
| 02 | Replacement Wave | Replacements and reinstalls, heating and cooling, forecast to 2035 |
| 03 | Rules and Refrigerants | R22 to A2L, SEER2, the furnace rule, lapsed credits, rebates, TDLR licensing and permits |
| 04 | Demand Drivers | What moves HVAC work: heat, freezes, age, income and the permit gap |
| 05 | Paid Acquisition | Where an ad dollar reaches the most replacement and repair jobs, resolved to the ZIP |
| 06 | Ground Truth | Counties and cities as observed: permits, hail, licenses, contractors, housing |
| 07 | Supply Line | Contractors, technicians and the 242 location competitive field |
| 08 | Campaign Desk | Budgets, ZIP targets, keywords, creative and bulk files for eight ad platforms |
| 09 | Site Forge | Service, city, county and guide pages written from the model, linted and compiled (Elementor, HTML, headless) |
| 10 | Emergency Satchel | Ads, pages and license claims screened against TDLR, FTC, Texas and platform rules |
| 11 | Dallas Fort Worth | The 12 counties on their own: stock, climate, hail, housing waves, supply, precision and data access |
| 12 | Service Lines | Fourteen HVAC service lines resolved to the ZIP: pools, jobs, tickets, seasons, levers, pressure and bid modifiers |
| 13 | Competitor Watch | What the 242 mapped competitors are doing: ads on Meta and Google, offers, financing, memberships, reviews |
| 14 | Weather Desk | National Weather Service forecast, alerts, outlooks and observations, turned into hour by hour ad timing |
| 15 | Accounts | Connect the paid and social accounts, pull what they did, let the actuals correct the models |
| 16 | Publish | Send the pages to WordPress (Elementor or headless), Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla or Ghost |

The background service worker reads the National Weather Service every 30 minutes (Options sets the interval and the forecast point): new
heat, cold, air quality, severe storm or flood products become desktop notifications with the campaign rule they trigger, and the toolbar badge
carries today's peak heat index from 90°F.

## Module 16 · Publish

Three sources feed the page table: the Site Forge (module 09 is mounted silently and its plan loaded), a composer (title, slug, meta
description, language, post type, noindex, HTML body with a starter skeleton, JSON-LD) and an import (FORGE bundle or blueprint JSON, or an
HTML document). Every page can be previewed in a sandboxed frame or downloaded. Pick a target card, Save and Test it, tick the pages, then
Deploy: drafts by default, Publish live takes two clicks. Local photos upload through the target, or through the media host you choose for a
platform that cannot store files. The results table and the per target ledger keep the id, link and edit link of every page sent; Verify links
compares the internal links of the pages with the live URL list where the platform has one.

The ten routes, and what to prepare (full detail per platform, including the troubleshooting hints, in [docs/PLATFORMS.md](docs/PLATFORMS.md)):

- **WordPress · Elementor.** Application Password over REST; with the FORGE bridge plugin (downloaded from the card) a page arrives with its Elementor data, SEO fields and JSON-LD in the head, without it as HTML. Prepare: an HTTPS site with Post name permalinks, an Application Password, the bridge, an Administrator for Elementor data.
- **WordPress · Headless (Next.js).** The same bridge import, canonicals pointed at the front end; the card downloads a Next.js 15.5 kit and Configure wires the bridge's revalidate hook. Prepare: the bridge, the kit deployed with `WP_URL`, `NEXT_PUBLIC_SITE_URL` and `REVALIDATE_SECRET`.
- **Drupal 10 / 11.** JSON:API with Basic auth or a bearer token; a node of the chosen content type with a path alias, Metatag values and a media entity for the hero. Prepare: JSON:API in read and write mode, HTTP Basic Authentication or Simple OAuth, the content type, image and Metatag field names.
- **Wix.** Account API key; a CMS collection item behind a dynamic page, or a Blog draft post in Ricos format. Prepare: the key with Wix Data, Blog and Media Manager permissions, the site ID, and in CMS mode a collection with the mapped fields and one dynamic page.
- **Duda.** API user and password; a copy of a template page filled by content injection, or a blog post; site level publish. Prepare: API access, the site name, one template page with an HTML widget carrying `data-inject="forge-content"`, and a media host for local photos.
- **Webflow.** Site API token; a CMS collection item with cleaned rich text, staged then published, with a site publish. Prepare: a token with the five scopes, the site and collection IDs, a collection with a RichText body and the meta fields, a bound template page.
- **Shopify.** Custom app token on the GraphQL Admin API (2026-07); an Online Store page or a blog article with the SEO metafields, images through staged uploads. Prepare: a custom app with `write_content` and `write_files`, the myshopify domain, a Blog id for posts.
- **HubSpot.** Private app token on the CMS v3 APIs; a blog post (recommended) or a site page built on a template's drag and drop area. Prepare: a private app with the `content` and `files` scopes, the Blog id, or a template path for page mode.
- **Joomla 4.1+ / 5.** User API token on the Web Services API; an article in a category with the meta description and robots. Prepare: the token, the three Web Services plugins, Web Services permission for the group, No Filtering text filters, a menu item on the category.
- **Ghost 5 / 6.** Admin API key of a custom integration; a page or post in one HTML card with the JSON-LD in the code injection head. Prepare: the integration key and the admin URL.

## Module 15 · Accounts

Seven provider cards: Google Ads, Local Services Ads and YouTube (one Google sign in), Meta, TikTok Ads, Microsoft Advertising and LinkedIn.
Each needs an app or client created in the business's own developer console with the redirect URL above; the card carries the steps, the
scopes and the paste fields, and accepts a pasted token instead of the sign in. Pulls return daily and hourly rows per campaign, leads and
calls, which feed the pacing, the hour chart and the model corrections. CSV imports cover the platforms' own exports (Google Ads, Meta, TikTok
Ads Manager, YouTube Studio, Microsoft, Local Services Ads leads, CallRail and CTM call logs, and a generic sheet; LinkedIn has no importer). Consoles, scopes, endpoints and versions: [docs/CONNECTORS.md](docs/CONNECTORS.md).

## Storage and privacy

- Everything stays in the extension's local storage (`chrome.storage.local`, `unlimitedStorage`): the atlas settings, module state, the
  CMS credentials and the ledger of sent pages (`tda.cms.v1`), the connector credentials, tokens and every row of actuals.
- The only network calls are to the National Weather Service and the Storm Prediction Center, to the provider APIs the user connects, and to
  the CMS the user configures. Nothing phones home; there is no telemetry.
- Fixed API hosts are in `manifest.json` (`host_permissions`). A CMS on your own domain is asked for once through the optional host
  permissions; the browser shows the prompt when you first Test or Deploy.
- Forget credentials and Clear sent ledger on each Publish card, Clear tokens and Clear all actuals in module 15, remove what they name.
  Removing the extension removes everything.

## Files

```
manifest.json          MV3; host_permissions for the fixed API hosts, optional_host_permissions for the user's own sites; gecko id for Firefox
background.js          NWS watch every 30 minutes, notifications, badge
popup.html/js          toolbar popup: conditions, peak heat index, alerts
options.html/js        forecast point, interval, notification kinds, badge, redirect URL, site access
app.html / app.css     the atlas shell (no inline scripts, per the extension CSP); publish.css styles module 16
atlas-data.js          ZIP, county, permit, climate and competitor data
nws-snapshot.js        NWS snapshot from the build (first paint before the live fetch)
src/00..12_*.js        shared layers: core helpers, brand, map, charts, copy, satchel rules, FORGE compiler, bridge PHP, models, NWS, accounts
src/cms/00_cms_core.js the CMS contract and the deploy driver
src/cms/1x_*.js        one adapter per platform; 19_headless_kit.js is the Next.js kit
src/13..27_m*.js       modules 01 to 15; src/30_m16_publish.js is module 16; src/99_shell.js boots the rail
docs/                  ARCHITECTURE.md (contracts), PLATFORMS.md (CMS setup), CONNECTORS.md (ad accounts)
tests/                 Node tests and the Playwright end to end run (not shipped in the zip)
build.mjs              validates, tests and zips the extension (not shipped)
icons/                 toolbar and store icons
```

## Tests and build

Node 22, no npm packages.

- `node tests/run.mjs` runs every `tests/*.test.mjs` in its own process: the CMS driver and each adapter against a recording mock HTTP server
  (method, path, headers and body of every request), the ad connectors, the headless kit. `node tests/run.mjs webflow` runs one.
- `node tests/e2e/run.mjs` loads the unpacked extension into headless Chromium with Playwright, clicks every rail tab, checks the ten adapter
  cards and the seven provider cards, composes and previews a page, and deploys it to a mock Webflow through `cfg.apiBase`; screenshots land in
  `tests/e2e/`. `node tests/e2e/publish.smoke.mjs` is the longer module 16 smoke test with a fake adapter.
- `node build.mjs` validates the manifest, the script order in `app.html`, the shared global scope (no duplicate top level names), the host
  permissions against the adapters and connectors, runs the unit tests and writes `../dist/thermal-atlas-extension.zip` (`--check` validates
  only, `--no-test` skips the tests).
