# Dental Marketing Genie

Marketing intelligence atlases and the browser app that turns them into websites and connected ad accounts.

| Path | What it is |
|---|---|
| `leviathan-app/` | The **Leviathan browser app** (Chrome, Edge, Brave): the unified console from the [Leviathan repository](https://github.com/ldwooddy86/Leviathan/tree/main/leviathan) as an extension. OmegaWeapon and the Hit Board at the core, fourteen industry atlases in three wings, the Convergence map and the Agency Field; a launcher popup, the `lev` address bar keyword and bookmarkable routes. The console runs as a sandboxed page with a `postMessage` bridge in place of the direct parent calls. See `leviathan-app/README.md`. |
| `chrome-app/` | The **Thermal Debt Atlas browser app** (Chrome, Edge, Brave; Firefox 128+). Sixteen modules: the DFW heating and cooling demand model, service lines, competitors, the National Weather Service desk, the Site Forge that writes the website, the **Publish** module that sends it to WordPress (headless and Elementor), Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla and Ghost, and the **Accounts** module with Google Ads, Local Services Ads, YouTube, Meta, TikTok, Microsoft and LinkedIn connectors. See `chrome-app/README.md`. |
| `reference/DFW_Thermal_Debt_Atlas_3.html` | The single file edition of the atlas (build 3) the app was built from. Opens in any browser. |
| `dental-divide-atlas.html` | The Dental Divide Atlas, the dental market companion (single file). |
| `toothandnail.skill` | The Tooth and Nail skill card: the Dental Divide method packed for Claude. |
| `dist/` | Zipped builds of the browser app, ready to load unpacked or to sign. |

## Load the browser apps

1. `chrome://extensions` → Developer mode → **Load unpacked** → choose `leviathan-app/` for the Leviathan console, or `chrome-app/` for the Thermal Debt Atlas app. Both can be loaded side by side.
2. Pin the icons. Leviathan opens from its popup, from `Ctrl+Shift+L` (`Command+Shift+L` on a Mac) or by typing `lev` and an atlas name in the address bar. In the Thermal Atlas popup, **Open the atlas** opens the full app; module 16 publishes the site, module 15 connects the accounts.

Tests: `cd leviathan-app && node tests/run.mjs` and `node tests/e2e/run.mjs`; `cd chrome-app && node tests/run.mjs` (unit, mock servers, no network) and `node tests/e2e/run.mjs` (Playwright, loads the extension into Chromium).

Rebuilding Leviathan from a new console build: `cd leviathan-app && node build.mjs --from <Leviathan repository>` (or `--fetch` to download it from GitHub); see `leviathan-app/README.md`.
