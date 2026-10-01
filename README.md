# Dental Marketing Genie

Marketing intelligence atlases and the browser app that turns them into websites and connected ad accounts.

| Path | What it is |
|---|---|
| `chrome-app/` | The **Thermal Debt Atlas browser app** (Chrome, Edge, Brave; Firefox 128+). Sixteen modules: the DFW heating and cooling demand model, service lines, competitors, the National Weather Service desk, the Site Forge that writes the website, the **Publish** module that sends it to WordPress (headless and Elementor), Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla and Ghost, and the **Accounts** module with Google Ads, Local Services Ads, YouTube, Meta, TikTok, Microsoft and LinkedIn connectors. See `chrome-app/README.md`. |
| `severance/` | **Severance build 2**, Texas family law market intelligence for one firm, as a browser extension and a single file built from the same sources: the dissolution index, court filings, service lines and paid acquisition by county and ZIP, plus everything the Thermal Atlas build 4 does (Campaign Desk bulk files for nine platforms, the Site Forge, Publish to ten CMS routes, Accounts, Competitor Watch, a Live Desk for layoffs, claims and the court calendar) and a compliance engine for the Texas lawyer advertising rules. See `severance/README.md`. |
| `dist/Severance_2.html` | The single file edition of Severance build 2 (opens in any browser). |
| `dist/severance-extension.zip` | Severance build 2 as a browser extension, ready to load unpacked. |
| `reference/DFW_Thermal_Debt_Atlas_3.html` | The single file edition of the atlas (build 3) the app was built from. Opens in any browser. |
| `reference/Severance_1.html` | Severance build 1, the single file Severance build 2 was split from (`severance/tools/extract.mjs` rebuilds `severance/data/` from it). |
| `dental-divide-atlas.html` | The Dental Divide Atlas, the dental market companion (single file). |
| `toothandnail.skill` | The Tooth and Nail skill card: the Dental Divide method packed for Claude. |
| `dist/` | Builds: the Thermal Atlas zip and build 4 preview, and the Severance build 2 single file and zip. |

## Load the browser app

1. `chrome://extensions` → Developer mode → **Load unpacked** → choose `chrome-app/`.
2. Pin the icon; **Open the atlas** in the popup opens the full app. Module 16 publishes the site, module 15 connects the accounts.

Tests: `cd chrome-app && node tests/run.mjs` (unit, mock servers, no network) and `node tests/e2e/run.mjs` (Playwright, loads the extension into Chromium).

Severance: `cd severance && node build.mjs` (validate, unit tests, single file and zip), `node tests/e2e/run.mjs` (Playwright, the single file and the extension).
