# Leviathan · the browser app

The Leviathan console as a Chrome extension (Chrome, Edge, Brave and other Chromium browsers). One frame, sixteen dashboards:
OmegaWeapon and the Hit Board at the core, fourteen industry atlases in three wings (legal, home services, healthcare), the
Convergence map and the Agency Field. The console inside is the split edition from the
[Leviathan repository](https://github.com/ldwooddy86/Leviathan/tree/main/leviathan) (`Leviathan.html`, `Leviathan-data.js`,
`Leviathan-data-2.js`), carried here with six one line patches to its frame script and no change to any atlas.

Nothing runs on a server. The atlases unpack in the browser when they are opened, and the five most recently opened stay live.
The only thing the app stores is the console's preferences (theme, module cards, spine) and the list of recently opened atlases,
in the extension's local storage.

## Install

1. `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`), turn on Developer mode.
2. **Load unpacked**, choose this folder (`leviathan-app/`). The console opens in a tab on the first install.
3. Pin the icon. The popup is the launcher: the three console views, the wings with their atlases, the recent atlases, and a search
   over atlases and modules (Enter opens the first match).

Three more ways in:

- **Keyboard**: `Ctrl+Shift+L` (`Command+Shift+L` on a Mac) opens the console; `chrome://extensions/shortcuts` changes the key.
- **Address bar**: type `lev`, a space, then an atlas or module name ("lev dental", "lev paid acquisition", "lev convergence").
- **Links**: the tab's URL follows the console, so any view can be bookmarked or shared between tabs:
  `chrome-extension://<id>/app.html#dental.paid`. Routes are `command`, `convergence`, `convergence.<ZIP>`, `agencies`, a wing
  (`legal`, `home`, `health`), an atlas (`hvac`, `dental`, `core`, ...) or an atlas and a module (`hvac.paid`, `core.pulse`).

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

The six patches to the console's frame script, each anchored on text that must occur exactly once (`lib/patch.mjs`): the bridge
script tag, `isFramed()` answering false (the wrapper is not a viewer, so downloads stay on), the preference loader and saver
going through the bridge, the `srcdoc` assignment going through `wrapAtlas`, and a version marker in the head.

## Files

```
manifest.json            MV3; storage is the only permission; console/Leviathan.html sandboxed with its own CSP; omnibox keyword lev; the open-console command
app.html / app.js        the wrapper: frames the console, keeps preferences and recents, mirrors the route, answers the popup
popup.html / popup.js    the launcher
open.js                  shared by the popup and the background: registry search, find or open the console tab
background.js            service worker: open on install, the keyboard command, the omnibox
registry.js              generated from the console: wings, dashboards, modules, console version (read by the popup, the omnibox, the wrapper)
console/Leviathan.html   the console, patched (26.5 MB)
console/Leviathan-data.js, Leviathan-data-2.js   the companion payloads the console loads on demand (25.7 MB and 9.5 MB), as in the Leviathan repository
console/ext/host-bridge.js   the console side of the bridge and the two shims it plants
icons/                   the console's mark at 16, 32, 48 and 128 pixels (tools/icons.mjs renders them)
lib/patch.mjs            the anchored patches, the registry extraction, the zip writer (build only, not shipped)
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
`chrome://extensions`. Without `--from` or `--fetch`, `node build.mjs` validates the folder and runs the unit tests; `--check`
validates only, `--no-test` skips the tests.

## Tests

Node 22, no npm packages.

- `node tests/run.mjs` runs the unit tests: the anchored patches and the registry extraction on a synthetic console, the bridge
  and both shims driven through fake `postMessage` traffic in a vm, the manifest and the extension pages, and the built console
  (markers, companion payloads, `registry.js` in step).
- `node tests/e2e/run.mjs` loads the unpacked extension into headless Chromium with Playwright and checks the whole chain: the
  console starts sandboxed, the Thermal Debt Atlas (inline payload), the Dental Divide Atlas (companion script, nested module
  documents) and OmegaWeapon register over the bridge, the Dark button reaches the atlases and a nested module document, the
  preference lands in storage and survives a reload, the tab URL follows the console and drives it, and the popup lists and
  finds the dashboards. Screenshots land in `tests/e2e/console.png` and `tests/e2e/popup.png`.
