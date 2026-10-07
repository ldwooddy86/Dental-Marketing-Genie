# Leviathan · the browser app

The Leviathan console as a Chrome extension (Chrome, Edge, Brave and other Chromium browsers). One frame, sixteen dashboards:
OmegaWeapon and the Hit Board at the core, fourteen industry atlases in three wings (legal, home services, healthcare), the
Convergence map, the Agency Field, and the **Résumé Forge**, a console view of the app's own. The console inside is the split
edition from the [Leviathan repository](https://github.com/ldwooddy86/Leviathan/tree/main/leviathan) (`Leviathan.html`,
`Leviathan-data.js`, `Leviathan-data-2.js`), carried here with anchored one line patches to its frame script and no change to
any atlas. The split edition and `Leviathan-full.html` carry the same OmegaWeapon and Hit Board payloads inline, so the Forge's
findings are the same whichever edition the console came from.

Nothing runs on a server. The atlases unpack in the browser when they are opened, and the five most recently opened stay live.
The app stores the console's preferences (theme, module cards, spine), the list of recently opened atlases, and the Résumé
Forge's draft (the candidate's facts and the tailoring per agency), all in the extension's local storage on this device.

## Install

1. `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`), turn on Developer mode.
2. **Load unpacked**, choose this folder (`leviathan-app/`). The console opens in a tab on the first install.
3. Pin the icon. The popup is the launcher: the four console views, the wings with their atlases, the recent atlases, and a search
   over atlases and modules (Enter opens the first match).

Three more ways in:

- **Keyboard**: `Ctrl+Shift+L` (`Command+Shift+L` on a Mac) opens the console; `chrome://extensions/shortcuts` changes the key.
- **Address bar**: type `lev`, a space, then an atlas or module name ("lev dental", "lev paid acquisition", "lev convergence").
- **Links**: the tab's URL follows the console, so any view can be bookmarked or shared between tabs:
  `chrome-extension://<id>/app.html#dental.paid`. Routes are `command`, `convergence`, `convergence.<ZIP>`, `agencies`, `resume`,
  `resume.<agencyId>` (`resume.scorpion`), a wing (`legal`, `home`, `health`), an atlas (`hvac`, `dental`, `core`, ...) or an
  atlas and a module (`hvac.paid`, `core.pulse`).

Opening a route from the popup or the address bar reuses the console tab that is already open, so its live atlases stay live;
the popup's "Open in a new tab" switch changes that.

Firefox is not covered: it has no sandboxed extension pages (the `sandbox` manifest key), which this app depends on.

## How it works

Manifest V3 forbids inline scripts on extension pages. The console and every atlas are built from inline scripts, and the
atlases unpack further inline documents at run time, so rewriting them into external files is not an option. Instead:

- `console/Leviathan.html` is declared a **sandboxed page**. Chrome serves it with a content security policy that allows inline
  scripts and gives it, and every frame inside it, an opaque origin. That is also why the console cannot use `localStorage` or any
  extension API: it has no origin to key them on.
- `app.html` is an ordinary extension page that frames the console edge to edge. It hands the console its preferences in the
  query string, writes them to `chrome.storage.local` when they change, mirrors the console's route into the tab's URL, and
  answers the popup and the omnibox when they look for an open console tab.
- The atlases talk to the console through `window.parent.__LEVIATHAN`, a direct call that the sandbox turns into a security
  error. `console/ext/host-bridge.js`, loaded ahead of the console's frame script, puts a small shim at the top of every atlas
  document before it is framed. The shim stands in for `window.parent` (a replaceable property), answers the questions an atlas
  asks at start (theme, rail, initial route) from a seed the console writes into it, and carries everything else over
  `postMessage`: `register`, `moduleChanged`, `moduleTheme`, `navigate` up, `setTheme`, `rail`, `go` down. On the console side
  the bridge registers a proxy api whose `current()` and `route()` answer from the last snapshot the atlas sent, so the console's
  own code runs unchanged.
- The shell atlases (Dental Divide, Ocular Health, Termination Exposure) nest their module documents in frames of their own
  and used to reach into them with `contentDocument` for the theme and to hide the module's masthead. Those frames are cross
  origin here too, so the atlas shim hooks the `srcdoc` setter, plants a second shim in each module document, and relays the
  theme to it; the module document applies it and the same chrome tweaks itself.

The patches to the console's frame script, each anchored on text that must occur exactly once (`lib/patch.mjs`). Six carry the
app: the bridge script tag, `isFramed()` answering false (the wrapper is not a viewer, so downloads stay on), the preference
loader and saver going through the bridge, the `srcdoc` assignment going through `wrapAtlas`, and a version marker in the head.
Seven carry the Résumé Forge: the three Forge script tags beside the bridge, a spine entry after Agency Field, the `resume` route
in the parser and the dispatcher, its crumbs (naming the agency on the route), a palette entry, a Résumé link on every Agency Field
row, and the `viewResume` hook, which hands the console's own helpers (`h`, `fill`, `toast`, `saveFile`, `go`, a route setter,
the data) to `window.__LV_RESUME.view` so the Forge draws like any other console view.

## The Résumé Forge

Clapback's résumé engine on the Core's findings. Pick one of the 222 agencies the Agency Radar tracks and the Forge reads
Leviathan's findings on it into the gaps it shows (contradictions between what it sells and what it does on its own site, Horus
moves not made, the market and offshore exposures, a stalled sitemap, the Hit Board theme) and the lines it sells (its lead
capabilities, what its clients buy, where it is already moving), ranks seventeen hiring tracks on demand and angle, each finding
weighted by how rare it is in the field, and builds an ATS-friendly résumé: a title the agency would post for at the candidate's
level, a headline, a summary, the agency's own words first in the skills block, bullet starters with `[placeholders]`. Three
stages: Read, Draft (live preview, the draft saved on this device), Check and export (an ATS readiness score with hard gates for
unfilled placeholders, a missing contact, undated roles and Leviathan's own vocabulary; a separate count of the agency's words,
or the pasted posting's; copy, `.txt`, `.md`, print to PDF, and an interview brief).

The candidate's facts come from the candidate alone; the agency decides the title, the order of the skills and which bullets to
lead with. Nothing a rival wrote reaches the résumé path: the Hit Board's wedge and kill texts never ship, only a neutral hiring
theme; the dossier's competitive read sits behind a labelled disclosure. The findings are the Radar's reads of each agency's
public record on the compile date shown; the Forge says so on screen and in the brief.

`lib/findings.mjs` builds `console/ext/resume-findings.js` from the console itself: it unpacks the OmegaWeapon payload
(`window.RADAR`, 222 agencies) and the Hit Board payload, joins the Agency Field's vertical reach from the `lv-data` block, and
compacts one record per agency plus the field context (the needs taxonomy, the eight Horus implications, the key judgments, the
gap codes, the field investment shares and the base rates every finding is weighted by). The file is one JSON string the engine
parses on first use, so the console's start does not pay for it. `console/ext/resume-engine.js` is pure (no DOM; the Node tests
drive it), `console/ext/resume-forge.js` is the screen.

## Files

```
manifest.json            MV3; storage is the only permission; console/Leviathan.html sandboxed with its own CSP; omnibox keyword lev; the open-console command
app.html / app.js        the wrapper: frames the console, keeps preferences and recents, mirrors the route, answers the popup
popup.html / popup.js    the launcher
open.js                  shared by the popup and the background: registry search, find or open the console tab
background.js            service worker: open on install, the keyboard command, the omnibox
registry.js              generated from the console: wings, dashboards, modules, console views, console version (read by the popup, the omnibox, the wrapper)
console/Leviathan.html   the console, patched (26.5 MB)
console/Leviathan-data.js, Leviathan-data-2.js   the companion payloads the console loads on demand (25.7 MB and 9.5 MB), as in the Leviathan repository
console/ext/host-bridge.js   the console side of the bridge, the two shims it plants, and the store (one snapshot of the wrapper's storage)
console/ext/resume-findings.js   generated from the console: the Résumé Forge's findings on the 222 agencies and the field context (1.3 MB)
console/ext/resume-engine.js     the Résumé Forge engine: tracks, the reading of a record, the build, the readiness checks (no DOM)
console/ext/resume-forge.js      the Résumé Forge screen
icons/                   the console's mark at 16, 32, 48 and 128 pixels (tools/icons.mjs renders them)
lib/patch.mjs            the anchored patches, the registry extraction, the zip writer (build only, not shipped)
lib/findings.mjs         the findings extraction from the console's payloads (build only, not shipped)
build.mjs                rebuild from the Leviathan repository, validate, test, zip (not shipped)
tests/                   unit tests and the Playwright end to end run (not shipped)
```

## Rebuilding from a new console

When the Leviathan repository publishes a new console build, rebuild `console/` and `registry.js` from it:

```
node build.mjs --from ../../Leviathan          # the Leviathan repository checkout (its root or its leviathan/ folder)
node build.mjs --fetch                         # or download the three files from GitHub (main; --branch <name> for another)
node build.mjs --zip                           # also write ../dist/leviathan-extension.zip
```

The build fails loudly if an anchor in the frame script has moved; the fix is in `lib/patch.mjs`. Then click Reload on
`chrome://extensions`. A rebuild also regenerates `console/ext/resume-findings.js`; `node build.mjs --findings` regenerates it
alone from the console already in the folder. Without `--from`, `--fetch` or `--findings`, `node build.mjs` validates the folder
(including the findings being in step with the console's Radar compile) and runs the unit tests; `--check` validates only,
`--no-test` skips the tests.

## Tests

Node 22, no npm packages.

- `node tests/run.mjs` runs the unit tests: the anchored patches and the registry extraction on a synthetic console, the bridge,
  both shims and the store driven through fake `postMessage` traffic in a vm, the manifest and the extension pages, the built
  console (markers, companion payloads, `registry.js` in step), the findings extraction (every agency complete, the Hit Board
  joined, the base rates, the generated script read back), and the Résumé Forge engine (matching, titles and levels, the
  reading of On The Map Marketing, Scorpion, Promodo and a thin record, the build, the readiness gates, the mirror count, the
  posting match, the brief, the search).
- `node tests/e2e/run.mjs` loads the unpacked extension into headless Chromium with Playwright and checks the whole chain: the
  console starts sandboxed, the Thermal Debt Atlas (inline payload), the Dental Divide Atlas (companion script, nested module
  documents) and OmegaWeapon register over the bridge, the Dark button reaches the atlases and a nested module document, the
  preference lands in storage and survives a reload, the tab URL follows the console and drives it, the Résumé Forge opens on
  `#resume.on-the-map-marketing`, draws the findings and the tracks, builds a résumé as the form is typed, adds an agency term
  from a chip, copies, downloads and prints it, keeps the draft in extension storage and brings it back after a reload, and the
  popup lists and finds the dashboards and offers the four views. Screenshots land in `tests/e2e/console.png`,
  `tests/e2e/forge.png` and `tests/e2e/popup.png`.
