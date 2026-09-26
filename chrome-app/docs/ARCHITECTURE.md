# Thermal Debt Atlas browser app · architecture and contracts

The extension is Manifest V3 (Chrome, Edge, Brave; Firefox 128+ through the gecko block). `app.html` loads classic scripts in a
fixed order (see the `<script>` list); every file shares one global scope, so top-level `const` names must be unique across files.
No inline scripts anywhere (extension CSP `script-src 'self'`). No bundler, no build step required to load unpacked.

```
chrome-app/
  manifest.json          MV3; host_permissions for every fixed API host; optional_host_permissions for the user's own sites
  background.js          NWS weather watch, notifications, badge (unchanged from build 3)
  popup.*, options.*     toolbar popup and options (unchanged)
  app.html / app.css     the atlas shell; publish.css styles module 16
  src/00..12_*.js        shared layers (core helpers, brand, map, charts, copy, satchel rules, FORGE compiler, bridge PHP, models, NWS, accounts)
  src/cms/00_cms_core.js the CMS contract (this document's section 2)
  src/cms/1x_*.js        one adapter file per platform
  src/cms/19_headless_kit.js  the Next.js front end kit for headless WordPress, as a {path: content} map
  src/13..27_m*.js       modules 01 to 15 (each calls registerModule)
  src/30_m16_publish.js  module 16 · Publish (multi CMS)
  src/99_shell.js        boot: rail, hash routing
  tests/                 Node 22 tests: `node tests/run.mjs` (mock HTTP servers, no network)
  docs/                  this file, per platform setup guides
```

## 1. Shared helpers available to modules (from src/00_core.js)

`$`, `$$`, `esc`, `N`, `D`, `P`, `M$`, `K`, `slug`, `el`, `debounce`, `store` (localStorage JSON), `toast`, `saveFile(name, data)`,
`zipBlob([{name, data}])`, `toCSV`, `copyText`, `kpiHTML`, `mastHTML({eyebrow,title,dek,meta,bar,barsub,actions})`, `callout(kind,title,html)`,
`card(title, sub, body, cls)`, `srcRows`, `judgList`, `dataTable`, `wireSeg`, `BUS` (on/emit), `registerModule({key,num,title,desc,mount(root)})`,
`showModule(key, payload)`, `goModule`. `BRAND` holds the business identity (name, url, phone, colors, social). `FORGE_COMPILE.compile(bp, media)`
compiles a blueprint; `FORGE_BRIDGE_PHP` is the WordPress plugin source. Module 09 exposes `MODI.forge.publishPages()` (portable pages),
`MODI.forge.publishAssets()` and `MODI.forge.publishSite()` once mounted; module 16 mounts it silently when needed
(`if (!MODI.forge.mounted) { MODI.forge.mounted = true; MODI.forge.mount($('#mod-forge')); }`).

CSS classes for module UI (app.css): `.wrap .card .card-h .card-b .mt .split .split21 .plan .f .fl .hint .chips .chk .btn .btn.sec .btn.ghost .btn.sm
.pill .mini .status .tscroll .xscroll table .kpis .callout(.judg/.note/.err) .conn .conns .cact .cdet .drop .seg .ctl .dsec .steps .foot .msg`.

## 2. CMS contract (src/cms/00_cms_core.js)

`CMS.register(adapter)`; adapters are plain objects, no DOM, no app helpers (they also run in Node tests). Everything an adapter needs is on `CMS`:

- `CMS.http(url, {method, headers, body, raw, expect, timeout, tolerate})` → `{status, ok, headers, json, text, blob}`; throws `CMS.CmsError`
  with `.status`, `.body`, `.url` on non 2xx (the message already carries the provider's error text). Objects are JSON encoded automatically.
- `CMS.basicAuth(user, pass)`, `CMS.b64`, `CMS.b64url`, `CMS.b64text`, `CMS.hex`, `CMS.fromHex`, `CMS.sha256`, `CMS.hmacSha256`, `CMS.jwtHS256`, `CMS.md5`,
  `CMS.blobBytes`, `CMS.dataUrlToBlob`, `CMS.extOf`, `CMS.slug`, `CMS.esc`, `CMS.stripTags`, `CMS.stripScripts`, `CMS.words`, `CMS.sleep`, `CMS.trimSlash`, `CMS.originOf`.
- Rendering: `CMS.bodyHtml(page, {css, schema, stripScripts, mediaMap})`, `CMS.fullHtml(page, {headExtra, bodyExtra, mediaMap})`,
  `CMS.schemaTag(schema)`, `CMS.styleTag(css)`, `CMS.htmlToBlocks(html)` → `[{type:'heading'|'p'|'li'|'quote'|'image', ...}]`, `CMS.inlineRuns(html)`.
- `CMS.ensureOrigin(url)` requests the optional host permission for a user site (Chrome shows a prompt once). Adapters that talk to the user's own
  domain declare `dynamicHost(cfg) → origin`; the driver calls `ensureOrigin` before `test` and `deploy`. Fixed API hosts are in the manifest.

Adapter shape (all async functions receive `(cfg, ..., ctx)`; `ctx = {http, log(msg), mediaHost, signal}`):

```js
CMS.register({
  id: 'drupal', name: 'Drupal', group: 'Drupal 10 / 11', blurb: 'JSON:API core module, Basic auth or bearer token',
  docs: 'https://…', setup: ['step', 'step'],
  fields: [{ k: 'url', l: 'Site URL', t: 'url', hint: '…' }, { k: 'user', l: 'Username', t: 'text' }, { k: 'pass', l: 'Password', t: 'password', secret: true }, { k: 'bundle', l: 'Content type', t: 'text', def: 'page', optional: true }],
  dynamicHost: cfg => cfg.url,                     // or hosts: ['https://api.example.com/*'] for fixed hosts
  caps: { media: true, urls: true, publishSite: false, elementor: false, schema: 'inline', seo: true, postTypes: ['page', 'post'] },
  base(cfg) { return CMS.trimSlash(cfg.apiBase || cfg.url); },   // every adapter honours cfg.apiBase so tests can point it at a mock server
  async test(cfg, ctx) { … return { ok: true, info: 'Drupal 11.1, JSON:API on, user admin', meta: {...} }; },
  async listUrls(cfg, ctx) { … return ['https://site/a/', …]; },
  async findMedia(cfg, query, kind, ctx) { … return [{ id, url, alt, width, height, mime }]; },   // optional
  async uploadMedia(cfg, asset /* {blob, file, mime, alt, width, height} */, ctx) { … return { id, url, width, height, mime, reused:false }; },
  async upsertPage(cfg, page, opts /* {publish} */, ctx) { … return { id, link, edit, status: 'draft'|'publish', updated: bool }; },
  async publishSite(cfg, ctx) { … return { ok: true, info }; },   // optional: Webflow, Duda, Wix (site level publish)
});
```

`page` is a PortablePage (fields listed at the top of `00_cms_core.js`). By the time `upsertPage` runs, the driver has uploaded local assets
(`page.media[slot].asset` blobs and `data:` URLs) through `uploadMedia` (or the chosen media host's), rewritten their URLs in `page.html`,
`page.schema` and `page.seo.og_image`, dropped the compiler's placeholders, and set `page.status`. `page.featured_media_id` carries the uploaded
id when the adapter returned one. Upsert means: look the slug up first, update when it exists, create otherwise, and report `updated`.

Rules every adapter follows:
1. Real endpoints, real headers, real auth. Pin API versions in one constant at the top of the file and expose them in `test()`'s info.
   Verify anything you are unsure of with web search before writing it; write the URL you verified in a comment.
2. Slug → the platform's own notion of a path (WordPress slug, Drupal path alias, Shopify handle, Webflow item slug, Ghost slug, Joomla alias,
   HubSpot slug, Wix data item field, Duda page path). Drafts by default; `opts.publish` publishes.
3. SEO title, meta description, canonical, noindex go wherever the platform keeps them (a field, a metafield, page settings); JSON-LD goes into
   the head where the platform has a head slot, inline in the body otherwise (`caps.schema` says which). Never silently drop them; note in the result.
4. `cfg.apiBase` overrides the fixed API host (regions, sandboxes, tests). Never hardcode the production host inside functions; use `base(cfg)`.
5. Errors: throw `CMS.err(message, {status, hint})` with a hint that tells the user what to change (a permission, a plugin, a setting).
6. No `document`, no `window` at load time; no app helpers (`esc`, `toast`, …) — only `CMS.*` and standard web APIs (fetch, crypto, Blob, FormData).
7. Every adapter ships `tests/<id>.test.mjs` that runs the adapter end to end against a mock server (`tests/lib/mock.mjs`) and asserts the exact
   method, path, headers and body shape of each request, plus the upsert (exists → update) branch and one error branch. `node tests/run.mjs <id>` passes.

## 3. Ad connectors (src/12_accounts_core.js, UI in src/27_m15_accounts.js)

`ACCT` holds providers (`PROVIDERS`, `PORDER`), OAuth (`connect` runs `identity.launchWebAuthFlow`; PKCE and refresh where the provider supports
them; pasted tokens as a fallback), pulls (`pull(p, days)` → normalized rows `{src, kind, date, hour, campaign, adset, geo, imp, clicks, spend,
leads, calls, msgs, conv, line}`), `test(p)`, CSV importers, analytics over rows, and the model feedback. Provider cards in module 15 are
generated from `PROVIDERS[p].fields/setup/covers/scopes`. A provider may share another's token: `tokenOf: 'google'`.

## 4. Tests

`node tests/run.mjs` runs `tests/*.test.mjs` each in its own process. `tests/lib/load.mjs` loads the classic scripts into Node; `tests/lib/mock.mjs`
starts a recording HTTP server. Playwright (`tests/e2e/`) loads the unpacked extension into Chromium and clicks through every module.
