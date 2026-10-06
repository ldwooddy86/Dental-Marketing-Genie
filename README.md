# Dental Marketing Genie

Marketing intelligence atlases and the browser app that turns them into websites and connected ad accounts.

| Path | What it is |
|---|---|
| `leviathan/` | **Leviathan**, the unified console: OmegaWeapon and the Hit Board at the core, fourteen industry atlases in three wings (the Louisiana editions of Probable Cause and Contraflow, the DFW Thermal Debt Atlas and the Dental Divide Atlas among them, plus the Termination Exposure Atlas), the Convergence map and the Agency Field. One file with everything, `leviathan/Leviathan-full.html` (62 MB), or the split edition in three files under 50 MB each, opened from `leviathan/Leviathan.html`. See `leviathan/README.md`. |
| `chrome-app/` | The **Thermal Debt Atlas browser app** (Chrome, Edge, Brave; Firefox 128+). Sixteen modules: the DFW heating and cooling demand model, service lines, competitors, the National Weather Service desk, the Site Forge that writes the website, the **Publish** module that sends it to WordPress (headless and Elementor), Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla and Ghost, and the **Accounts** module with Google Ads, Local Services Ads, YouTube, Meta, TikTok, Microsoft and LinkedIn connectors. See `chrome-app/README.md`. |
| `reference/DFW_Thermal_Debt_Atlas_3.html` | The single file edition of the atlas (build 3) the app was built from. Opens in any browser. |
| `dental-divide-atlas.html` | The Dental Divide Atlas, the dental market companion (single file). |
| `toothandnail.skill` | The Tooth and Nail skill card: the Dental Divide method packed for Claude. |
| `dist/` | Zipped builds of the browser app, ready to load unpacked or to sign. |

## Load the browser app

1. `chrome://extensions` → Developer mode → **Load unpacked** → choose `chrome-app/`.
2. Pin the icon; **Open the atlas** in the popup opens the full app. Module 16 publishes the site, module 15 connects the accounts.

Tests: `cd chrome-app && node tests/run.mjs` (unit, mock servers, no network) and `node tests/e2e/run.mjs` (Playwright, loads the extension into Chromium).
