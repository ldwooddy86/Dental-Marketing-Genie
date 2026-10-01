# Severance build 2 · architecture and contracts

Severance is Texas family law market intelligence for one law firm: where marriages are ending, what the courts are filing, which
service lines the demand splits into, and (build 2) the campaigns, website, connected accounts, competitor watch and live timing built on
it. Build 2 gives Severance every capability of the Thermal Debt Atlas build 4 (`../chrome-app`, the HVAC atlas), translated to a family
law practice.

It ships two ways from one source tree:

- **Browser extension** (Chrome, Edge, Brave; Firefox 128+): load `severance/` unpacked, or the zip `node build.mjs` writes to
  `../dist/severance-extension.zip`. Host permissions let the CMS adapters, ad connectors and live sources reach their APIs without CORS.
- **Single file**: `../dist/Severance_2.html`, the whole app and its data in one page that opens from disk in any browser (what
  Severance 1 was). Network features work where the remote API allows browser calls and say so where it does not.

`app.html` loads classic scripts in a fixed order; every file shares one global scope, so top level `const`, `let`, `class` and
`function` names must be unique across files (`node build.mjs --check` catches collisions). No inline scripts or inline handlers (the
extension CSP is `script-src 'self'`). No bundler; `node tools/order.mjs` rewrites the script and stylesheet lists from the files on disk.

```
severance/
  manifest.json            MV3; host_permissions for the fixed API hosts; optional_host_permissions for the firm's own site
  background.js            the live watch: WARN notices and weekly claims, notifications, badge
  popup.html/js            toolbar popup: the latest triggers, open the atlas
  options.html/js          watch interval, counties, notification kinds, the OAuth redirect URL, site access
  app.html, app.css        the shell; css/*.css hold one stylesheet per build 2 module, loaded after app.css in name order
  data/suite.js            counties, ZIPs, metros, state series, models (window.__SEV_SUITE__)
  data/atlas-<metro>.js    six Metro Atlas files, loaded on first use (window.__SEV_ATLAS__[key])
  src/00_core.js           data indices, formatters, map, charts, tables, export modal, module registry
  src/01_kit.js            build 2 helpers (below)
  src/02_firm.js           FIRM: the firm profile
  src/03_lint.js           LINT: the compliance engine (the rule set, auto corrections, platform limits)
  src/04_forge_compile.js  FORGE_COMPILE: blueprint → Elementor JSON, semantic HTML, JSON-LD (port of the Thermal Atlas compiler)
  src/05_forge_bridge_raw.js FORGE_BRIDGE_PHP: the WordPress bridge plugin source
  src/06_forge_copy.js     FCOPY: the family law page writer
  src/07_accounts_core.js  ACCT: providers, OAuth, pulls, CSV importers, analytics, model feedback
  src/08_watch_core.js     WATCH: the competitor roster, observations, scores, ad library links
  src/10_desk_platforms.js DESKX: the Campaign Desk's creative library and the bulk file and build sheet writers for nine platforms
  src/11_workspace.js      WORKSPACE: one backup and restore of everything saved in the browser
  src/09_live_core.js      LIVE: triggers from the embedded data, the live sources, the legal calendar, ad timing
  src/cms/*.js             the CMS layer, identical to ../chrome-app/src/cms except the storage key (sv.cms.v1) and one WordPress hint
  src/20..39_m*.js         modules 01 to 20 (01 to 11 statewide, 12 to 19 metro areas, 20 method)
  src/40..44_m*.js         modules 21 to 25: Site Forge, Publish, Accounts, Competitor Watch, Live Desk
  src/99_boot.js           rail (Statewide, Metro areas, Launch), hash routing, theme, firm button
  tests/                   node tests/run.mjs (unit, mock servers); tests/e2e/run.mjs (Playwright: the single file and the extension)
  tools/                   extract.mjs (single file → data), order.mjs (script and stylesheet lists), icons.mjs
  build.mjs                validates, tests, writes the zip and the single file
```

## Modules

| # | key | file | title |
|---|---|---|---|
| 01 | index | 20_m01_index.js | Dissolution Index |
| 02 | ledger | 21_m02_ledger.js | Filings Ledger |
| 03 | market | 22_m03_market.js | Marriage Market |
| 04 | signals | 23_m04_signals.js | Risk Signals |
| 05 | econ | 24_m05_econ.js | Economic Shock |
| 06 | lines | 25_m06_lines.js | Service Lines (LINE_META lives here) |
| 07 | paid | 26_m07_paid.js | Paid Acquisition |
| 08 | supply | 27_m08_supply.js | Supply Line |
| 09 | timing | 28_m09_timing.js | Timing Desk |
| 10 | desk | 29_m10_desk.js | Campaign Desk (build 2: bulk files for every platform) |
| 11 | compliance | 30_m11_compliance.js | Compliance Screen (build 2: on LINT, batch, fixes, filing log) |
| 12, 14 to 18 | dfw, hou, sat, aus, elp, rgv | 31_m12_metros.js | Metro tabs; 19 others |
| 13 | atlas | 32_m13_atlas.js | Metro Atlas |
| 20 | method | 39_m20_method.js | Method and Sources (top bar button, not in the rail) |
| 21 | forge | 40_m21_forge.js | Site Forge |
| 22 | publish | 41_m22_publish.js | Publish |
| 23 | accounts | 42_m23_accounts.js | Accounts |
| 24 | watch | 43_m24_watch.js | Competitor Watch |
| 25 | live | 44_m25_live.js | Live Desk |

## 1. Helpers every module can use

From `00_core.js`: `$`, `$$`, `esc`, `isN`, `N(v,d)` (number, `n/a` for null), `P(v,d)` (a FRACTION as a percent: `P(0.25)` is `25.0%`),
`P1(v,d)` (a value already in percent), `K(v)` (12.3k), `$$$(v,d)` (money), `sgn`, `updown`, `clamp`, `sum`, `mean`, `MO`, `MOL`,
`fmtDate('2026-09-12')`, `fmtDateL`, `fmtQ`, `MNAME` (metro title without hyphens), `store.get/set(k, v)` (localStorage JSON, keys are
prefixed `sv.`; use `sev.<module>.<name>`), data indices `D`, `CTY`/`CI` (counties by FIPS), `ZC`/`ZI` (ZIPs), `MSA`, `GEO`, `ST`, `META`,
`METRO_TABS`, `cname(fips)`, ramps (`rampColor`, `rampCSS`, `divergeColor`, `quantScale`, `pctScale`), `showTip/hideTip`, `drawMap`,
`markSel`, `lineChart`, `barChart`, `spark`, `seasBlock`, `table(el, {cols, rows, sort, onRow, selected, limit})`, `csv(rows, cols)`,
`exportText(name, text, mime)` (download plus a copy box), `openModal(html)`, `closeModal()`, `mastHTML({eyebrow, title, dek, facts, ribbon})`,
`tile(label, value, sub, grade)`, `ctl(label, inner)`, `sel(id, opts, val)`, `registerModule({key, num, title, desc, mount(root), receive?, onShow?})`,
`showModule(key, payload)`.

From `01_kit.js`: `RT` (the extension runtime or null), `ENV` (`chrome` | `firefox` | `viewer` | `file`), `ENV_LABEL`, `inViewer()`, `slug`,
`debounce`, `el`, `todayISO`, `uid`, `phoneFmt`, `pctRank`, `BUS.on/emit` (events: `firm`, `theme`, `actuals`, `plan`, `forge`, `watch`,
`live`), `toast(msg)`, `saveFile(name, data)` (Blob or string; the viewer's downloads capability when hosted), `toCSV(header, rows, note)`,
`toTSV`, `parseCSV(text)`, `zipBlob([{name, data}])`, `copyText`, `readText(file)`, `readDataUrl(file)`, `pickFiles(accept, multiple)`,
`panel(title, sub, body, {id, cls})`, `callout(kind, title, html)` (kinds: '' gap, `note`, `judg`), `toolbarHTML(title, sub, [{id, label, primary}])`,
`fieldHTML({k, l, t, hint, opts, def, wide, id})` and `readFieldsIn(root)`, `segHTML`/`wireSeg`, `pill(text, kind)`, `sevPill(sev)`,
`goModule(key, payload)`. CSS classes: `.panel .sub .tiles .tile .grid2 .grid3 .split .controls .ctl .formgrid .btnrow .btn(.primary .accent .sm .danger)
.toolbar .callout(.note .judg) .tblwrap table.t .seg .pill .chk .logbox .dropzone .cards .ccard .steps iframe.preview .small .prose`.

## 2. FIRM (02_firm.js)

`FIRM.get()` → `{name, legal_name, tagline, url, phone, intake_email, founded, attorneys:[{name, bar_no, tbls, since, bio}], responsible,
offices:[{label, street, city, zip, county, phone, hours, primary}], counties:[fips], lines:[LINE_META keys], languages:['en','es'],
consult:{free, fee, virtual}, fees:{line: dollars}, payment, colors:{primary, accent, dark}, logo (data URL), social:{facebook, instagram,
youtube, linkedin, tiktok, x, gbp}, reviews:{rating, count, source}, arc:{filed, note}}`. Also `FIRM.set(patch)` (emits `firm`),
`FIRM.ready()`, `FIRM.missing()`, `FIRM.responsible()`, `FIRM.primary()`, `FIRM.counties()`, `FIRM.lines()`, `FIRM.adFooter({short})`,
`FIRM.phone()`, `FIRM.certs()` (the only specialty wording allowed), `FIRM.panel()`. Nothing is prefilled: when a field is empty, generated
copy carries a bracketed placeholder such as `[Firm name]`, and LINT blocks any copy that still contains one.

## 3. LINT (03_lint.js), the compliance engine

The rule set (`LINT.RULES`, the build 1 `COMP_RULES` extended) covers the Texas Disciplinary Rules of Professional Conduct 7.01 to 7.06
(misleading claims, special competence, contingent fees in family matters, past results, testimonials, the responsible lawyer and primary
practice location, solicitation labels, the Advertising Review Committee filing), the family law myths, stale numbers, the Google and Meta
personal attribute policies, unfilled placeholders and the house style (no hyphens or dashes in outbound copy).

```
LINT.screen(text, {kind:'ad'|'page'|'social'|'email'|'sms'|'gbp'|'video', platform, lang:'en'|'es', html:false, footer:true, solicitation:false})
  → {findings:[{id, sev:'block'|'fix'|'warn'|'info', title, rule, why, hit, at, fix:{from, to}|null}], counts:{block, fix, warn, info}, pass}
LINT.fix(text, opts) → {text, applied:[{id, from, to}]}      deterministic corrections only; never invents facts
LINT.house(text) → text                                       house style for outbound copy
LINT.LIMITS[platform][field] → max characters; LINT.checkAd({platform, fields:{headline1:..}}, opts) → findings with length checks
```
`pass` is false when any finding is `block`. Posture: firm checks (Rule 7.02(a) footer, placeholders, house style, filing reminders) run only on the firm's own copy (a call that sets `kind`, or `posture: 'self'`); `posture: 'comp'` screens a competitor's copy as positioning notes and skips them. HTML is detected when `html` is not passed; pass `html: false` to force plain text. Also exported: `screenAd`, `fixAd`, `rule(id)`, `SOURCES`, `CHANGES` (the dated Texas changes register), `PLATFORMS`, `FILING`, `stripHTML`, `detectLang`, `splitBatch`, `parseAdsCSV`, `diff`, `firmItems`. 74 rules; citations marked Verify in the rule book need a check against the live text before a finding leaves the firm. The Campaign Desk, the Site Forge, Publish (before deploy) and the Compliance Screen all
call it; an ad or page that does not pass is not exported as ready (it is exported with a `needs review` status and the findings).

## 4. Site Forge (04 to 06, module 21) and Publish (module 22)

Same contract as the Thermal Atlas: the forge writes blueprints (`{site, page, sections[], media, seo, schema}`), `FORGE_COMPILE.compile(bp, media)`
returns `{elementor_data, page_settings, html, schema, seo, warnings, issues:[{sev, msg}], portable}` (`portable` is the blueprint lowered to the section types the headless kit renders; build CMS pages with `FORGE_COMPILE.pageFor(bp, r, media, extra)`, which uses it). Law firm section types: `attorneys` (TBLS line only in the exact Rule 7.02(b) form), `disclaimer` (added automatically when absent), `court_facts`, `lang_toggle`, `process`; `FORGE_COMPILE.defaultForm(bp)` is the intake form (county and matter type selects, no confidential details, no attorney client relationship); `validateSchema(schema)` checks property names. Once module 21 is mounted it exposes
`MODI.forge.publishPages()` (PortablePage list, `CMS.pageFromForge`), `MODI.forge.publishAssets()` and `MODI.forge.publishSite()`.
Module 22 mounts module 21 silently when it needs pages: `if (!MODI.forge.mounted) { MODI.forge.mounted = true; MODI.forge.mount($('#mod-forge')); }`.
Schema for a firm is `LegalService` plus `Attorney` (with `areaServed`, `knowsAbout`, `address`, `telephone`), `FAQPage`, `BreadcrumbList`.
Every page carries the responsible lawyer and the primary practice location (Rule 7.02(a)) and passes LINT before it can be deployed.

## 5. Accounts (07, module 23)

Same contract as the Thermal Atlas `ACCT`: providers `google` (Google Ads), `lsa` (Local Services Ads, legal), `youtube`, `meta`, `tiktok`,
`microsoft`, `linkedin`; OAuth through `identity.launchWebAuthFlow` in the extension, pasted tokens elsewhere; `ACCT.pull(p, days)` →
normalized rows `{src, kind, date, hour, campaign, adset, geo:{zip, county, region}, imp, clicks, spend, leads, calls, msgs, conv, retained, line, note}`;
CSV importers (each platform's export, CallRail and CallTrackingMetrics call logs, Clio Grow and Lawmatics intake exports, a generic sheet);
`ACCT.rowsAll()`; emits `actuals`. Storage `sv.accounts.v1` (chrome.storage.local in the extension, localStorage elsewhere). `line` is a
`LINE_META` key inferred from campaign and ad group names. The actuals correct the Campaign Desk's CPC, conversion and retained rates.

## 6. Competitor Watch (08, module 24)

No named competitor roster ships (Severance has law office counts, not firms); the firm builds its own roster. `WATCH.list()`,
`WATCH.add({name, domain, counties, lines, tier, notes, meta_page_id, google_advertiser_id})`, `WATCH.observe(key, {kind:'ad'|'offer'|'review'|'page'|'rank', ...})`,
`WATCH.score(c)`, `WATCH.LINKS` (Meta Ad Library, Google Ads Transparency Center, State Bar of Texas lawyer search, Texas Board of Legal
Specialization search, Google Maps and search, the firm's own site), imports and exports. Storage `sev.watch`.

## 7. Live Desk (09, module 25, background.js)

`LIVE.snapshot()` (from the embedded data: WARN notices, weekly claims, county unemployment, seasonality), `LIVE.refresh()` (live sources
where reachable: the Texas Workforce Commission WARN notices on data.texas.gov, dataset `8w53-c4f6` through the Socrata API; Texas weekly
initial claims from FRED, series `TXICLAIMS`), `LIVE.calendar(from, days)` (the legal and family calendar: the April 1 summer possession notice,
school start, holiday possession, tax refunds, military moving season, the January filing rise), `LIVE.triggers()` and
`LIVE.timing(line, date, fips)` → `{mult, adj, campaign, county, countyAdj, parts, reasons}` (a day by day bid and budget multiplier per service line; the step sizes are graded C judgment until account data replaces them). Also `LIVE.loadFile(text, name)` (a downloaded WARN or FRED file), exports `editorCSV`, `dailyCSV`, `windowsCSV`, `calendarCSV`, `ics`, `noticesCSV`, and `setUseObserved` (split the ad schedule by the hour pattern observed in Accounts). The background worker runs the same watch on a
timer in the extension, notifies on new WARN notices in the firm's counties and claims jumps, and keeps the badge.

## 8. Rules for every module

1. Severance idiom: `mastHTML` masthead ("Module NN · Title · what it covers"), a toolbar, a "Read this first" callout that says what the
   module does and does not do, tiles, panels. Square corners, the green palette, CSS variables only (light and dark themes both work).
2. Copy that leaves the atlas (ads, pages, posts, emails) passes LINT and carries no hyphen or dash. UI prose follows the same house
   style (ranges as "2 to 4", no em dashes). Dates through `fmtDate`; nulls print `n/a`.
3. `mount(root)` builds everything inside `root`, uses ids prefixed with the module's own two letter prefix (fg forge, pb publish,
   ac accounts, cw watch, lv live, dk desk, cp compliance), and binds no global listener it does not remove.
4. No network call except the CMS adapters and ad connectors the user configures and the Live Desk sources; nothing phones home.
   Credentials stay in this browser. In `file` and `viewer` environments, say clearly what cannot run there and why.
5. Works at 390 px wide with no horizontal page scroll; tables sit in `.tblwrap`; every input has a label; every action is a `<button>`.
6. Each module's styles go in its own `css/<nn>_<name>.css` (never edit another module's stylesheet); run `node tools/order.mjs`
   after adding a file. `node build.mjs --check` must stay clean.
