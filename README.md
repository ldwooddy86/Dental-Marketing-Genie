# Dental Marketing Genie

Marketing intelligence atlases and the browser app that puts them on one screen.

| Path | What it is |
|---|---|
| `leviathan-app/` | The **Leviathan browser app** (Chrome, Edge, Brave): the unified console from the [Leviathan repository](https://github.com/ldwooddy86/Leviathan/tree/main/leviathan) as an extension. OmegaWeapon and the Hit Board at the core, fourteen industry atlases in three wings, the Convergence map, the Agency Field and the **Résumé Forge**: Clapback's ATS résumé engine pointed at the Core's findings, so a résumé can be aimed at an agency's current gaps and the lines it sells (route `resume.<agency>`, a Résumé link on every Agency Field row). A launcher popup, the `lev` address bar keyword and bookmarkable routes. The console runs as a sandboxed page with a `postMessage` bridge in place of the direct parent calls. See `leviathan-app/README.md`; `leviathan-app/FEATURES.md` lists every feature of the build, dashboard by dashboard. |
| `dental-divide-atlas.html` | The Dental Divide Atlas, the dental market companion (single file). |
| `toothandnail.skill` | The Tooth and Nail skill card: the Dental Divide method packed for Claude. |

## Load the browser app

1. `chrome://extensions` → Developer mode → **Load unpacked** → choose `leviathan-app/`.
2. Pin the icon. Leviathan opens from its popup, from `Ctrl+Shift+L` (`Command+Shift+L` on a Mac) or by typing `lev` and an atlas name in the address bar.

Tests: `cd leviathan-app && node tests/run.mjs` (unit, including the Résumé Forge engine, the findings extraction and the withheld-name scan) and `node tests/e2e/run.mjs` (Playwright, loads the extension into Chromium).

Rebuilding Leviathan from a new console build: `cd leviathan-app && node build.mjs --from <Leviathan repository>` (or `--fetch` to download it from GitHub); see `leviathan-app/README.md`.
