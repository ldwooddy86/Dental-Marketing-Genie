# IRONCLAD — the technical-SEO doctrine of UltimaWeapon

`reckoning.md` Phase 2 (the technical lens) and Phase 8 (the Autopsy) are the inspection; `google-crawler.md` is the
crawl and index engine; this file is the doctrine they draw on. It says how Google (and Bing, and the AI retrieval bots)
actually crawl, render, index and measure a site in 2026, what each defect costs, how to grade it, how to fix it as a spec,
how it differs by platform and company type, and what to re-verify live. Every number in a deliverable still traces to a
measurement (PSI/CrUX with a key, the timing sweep, the crawl, a user export); this file supplies the *why* and the *fix*.

## 1 · The pipeline a page goes through, and where it breaks

**Discovery** (links, sitemaps, redirects, IndexNow for Bing/Yandex/Naver/Seznam — Google does not participate; verify)
→ **crawl** (robots.txt, host load, crawl budget for large sites, status codes, response time) → **render** (evergreen
Chromium; JS-dependent content is queued behind a second pass — a delay and a risk, not a wall) → **index decision**
(canonical selection, noindex, duplicate clustering, thin/soft-404, quality thresholds; "Crawled – currently not indexed"
and "Discovered – currently not indexed" are the two GSC reasons that mean *Google chose not to*) → **serving** (query
matching, page experience as a tie-breaker, mobile-first indexing — completed for all sites in 2024, so the smartphone
crawler is the crawler) → **AI retrieval** (the same index feeds AI Overviews / AI Mode; other assistants use their own
bots — `references/ai-seo.md`).

Costs, in plain words for the owner: a crawl defect delays; a render defect hides; an index defect erases; a speed defect
loses the click and the customer; a security defect loses the site.

## 2 · Crawl control

**robots.txt** (RFC 9309; Google's parser is open source): one file per host and scheme; ≤500 KiB read; groups by
`User-agent`, most specific group wins, longest rule wins, allow wins ties; `*` and `$` wildcards; **Disallow does not
prevent indexing** — a blocked URL can still be indexed from links (title only) — use `noindex` for that, and never
`Disallow` a page you want de-indexed (Google cannot see the noindex); never block CSS/JS/images the render needs;
`Crawl-delay` is ignored by Google (Bing honors it); `Sitemap:` lines are absolute URLs; a 5xx on robots.txt stalls
crawling of the whole host, a 4xx means "no restrictions". AI-bot groups belong here (§9). Check for accidental
staging rules shipped live (`Disallow: /` with a Googlebot exception is a WordPress "discourage search engines" relic;
`noindex` in robots.txt has been unsupported since 2019).

**Crawl budget** matters above roughly ten thousand URLs or when a site changes daily; below that, it is almost never the
problem — say so instead of selling "crawl budget optimization" to a 300-page site. Waste comes from: parameters and faceted
navigation (sort, filter, session, tracking, `?replytocom=`), infinite calendars/pagination, soft-404s, redirect chains,
duplicate hosts (http/https, www/non-www, trailing-slash twins, uppercase paths), `?s=` search results, attachment pages,
tag/author archives, `/feed/` endpoints, printer versions, hreflang mismatches, and the site's own 404 hunting. The GSC
**Crawl stats** report (by response, by file type, by purpose — discovery vs refresh, by Googlebot type; host status) and a
server log are the measurement; the fix is a combination of robots rules for pure-waste patterns, canonicals for
near-duplicates, `noindex` for thin-but-linkable pages, 410 for gone-forever, and one-hop 301s.

**Sitemaps**: XML, ≤50,000 URLs and ≤50 MB uncompressed per file, index files for more; list only **200, indexable,
self-canonical finals** on the same host; `lastmod` only if it is real and consistent (Google says it uses `lastmod` when
it can trust it and ignores it otherwise; a single timestamp across the whole file is a tell); image, video and news
sitemaps for the media that matters; hreflang can live in sitemaps for large multilingual sites; declare in robots.txt and
submit in GSC and Bing Webmaster Tools; watch the GSC Sitemaps report for "couldn't fetch" and discovered-vs-indexed gaps.

**Status codes**: 200 for live; **301** for permanent moves (302/307 also pass signals now, but 301 says "update your
index"); no chains, no loops; **404** for gone, **410** for gone-and-say-so-faster; no **soft 404s** (a 200 that says "not
found", an empty category, a redirect of every dead URL to the homepage — Google treats homepage-dumping as soft 404);
**429/503** with `Retry-After` for maintenance (never 200 with a "down" page; never 404 during outages — it de-indexes);
**401/403** for gated content; check that error pages return the right code (`fetch` the 404 page and read the status).

**Redirect hygiene**: one hop; preserve path where possible on migrations (map every old URL); http → https, non-www ↔ www,
trailing-slash and case normalization all in one rule set at the edge; legacy-domain redirects landing on http:// are the
classic two-hop chain; HSTS (with preload only when the whole estate is https); no redirect on the sitemap or robots URL.

## 3 · Rendering and JavaScript

Googlebot renders with an evergreen Chromium but **treats rendering as a second, deferred step**; the raw HTML is what the
first pass indexes. Rules: the primary content, title, meta robots, canonical, hreflang and internal links must be in the
**server HTML** (SSR, SSG, ISR, or at least prerendering for bots — dynamic rendering is deprecated as a long-term
strategy, and a bot-only prerender is cloaking if it differs materially from the user's page); `noindex` or canonical
injected by JS is unreliable; content behind clicks/tabs is indexed only if it is in the DOM; fragment URLs (`#!`) are not
crawled; lazy-loading uses native `loading="lazy"` or IntersectionObserver with `<noscript>` fallbacks for images that
matter; infinite scroll needs paginated URLs; client-side routers need real URLs with `history.pushState` and server
responses for deep links (a SPA returning the shell with a 200 for every path is a soft-404 factory); Web Components and
shadow DOM are indexed when rendered; `<link rel="alternate" type="application/json">` does nothing for SEO; and
`google_crawler.py render` measures the **JS-dependent share** per money page — the finding is the raw-vs-rendered word
count, the fix is server-render the content, the confirmation is GSC URL Inspection → View crawled page.

Platform notes: **Next.js** (App Router server components render server-side by default; check `dynamic` routes,
`generateMetadata`, `robots`/`sitemap` route handlers, ISR revalidation, and that middleware redirects are not chains);
**Nuxt/SvelteKit/Astro** (SSR/SSG defaults are fine; islands hydrate; check that data fetched client-side is not the
primary content); **React SPA (CRA/Vite)** without SSR = the risk case; **Shopify** (Liquid renders server-side; theme app
extensions inject JS — reviews/menus injected by apps are the JS-dependent content); **WordPress + Elementor/Divi** (server
HTML, but DOM size, duplicated nav, inline CSS bloat, and "Loading reviews…" widgets); **Webflow/Squarespace/Wix** (SSR;
limited control of headers/robots; Wix and Squarespace generate their own sitemaps and canonicals — check they match);
**headless CMS** (the front end decides everything above).

## 4 · Indexing controls

**Canonical**: one `<link rel="canonical">` per page, absolute, self-referencing on the final URL, matching scheme and host;
canonical + noindex on the same page is a contradiction; canonical to a redirecting or 404 target is a High; cross-domain
canonicals are honored; canonical is a *hint* — GSC URL Inspection shows the Google-selected canonical, and "Duplicate,
Google chose different canonical than user" is the report of a canonical Google overruled (usually because internal links
or the sitemap point at the other URL). **Meta robots / X-Robots-Tag**: `noindex` (page-level), `nofollow` (rare, usually a
mistake at page level), `noarchive` (largely moot), `nosnippet`, `max-snippet:[n]`, `max-image-preview`, `max-video-preview`,
`data-nosnippet` (span-level) — the snippet controls also govern what AI Overviews may quote (§9); `unavailable_after`. A
`noindex` on pages linked from the nav, on paginated pages, on the blog hub, or on category pages is a common
agency-inflicted defect — always list every noindex URL and ask whether each is intentional.

**Duplication**: parameter twins (canonical + sitemap of clean URLs; GSC's parameter tool is gone), pagination (each page
self-canonical; do **not** canonical page 2+ to page 1; `rel=next/prev` is unused by Google since 2019 but harmless),
faceted navigation (index only facets with demand and unique content; noindex or canonical the rest; robots-block pure
sort/filter parameters), product variants (one canonical product URL with variant parameters canonicalized, unless variants
have their own demand — color/size searches), print/AMP/mobile twins (AMP is no longer a ranking requirement anywhere),
syndicated content (canonical or noindex on the copy), boilerplate-heavy templates (the "80 % shared DOM" city page).

**Internationalization**: hreflang (page-level `<link>`, HTTP header, or sitemap; reciprocal; `x-default`; ISO 639-1 +
optional ISO 3166-1 alpha-2 — `en-GB` not `en-UK`); ccTLD vs subfolder vs subdomain (subfolders consolidate authority;
ccTLDs geotarget by themselves; subdomains are separate hosts for crawl and link purposes); no automatic geo-redirects for
crawlers (Googlebot crawls mostly from the US — a forced US redirect hides the other markets); GSC international targeting
is gone (use hreflang + ccTLD + local signals); currency/language selectors as links, not cookies only.

**Site migrations** (domain, platform, https, URL structure): freeze content; crawl before; map every URL (old → new, one
hop, path-preserving where possible); keep sitemaps for old URLs briefly; update canonicals, hreflang, internal links,
schema, GBP/citations, ads final URLs, email links; Change of Address in GSC for domain moves; verify the new property
first; monitor Crawl stats, Pages, and rankings for 8–12 weeks; expect a dip and say so; never migrate in the vertical's
peak season.

## 5 · Speed, Core Web Vitals and page experience

**Field thresholds at the 75th percentile** (CrUX; GSC's Core Web Vitals report; PSI's field panel): **LCP ≤ 2.5 s**
(largest contentful paint), **INP ≤ 200 ms** (interaction to next paint, replaced FID in March 2024), **CLS ≤ 0.1**
(cumulative layout shift). Supporting: **TTFB ≤ 0.8 s** ("good"), FCP ≤ 1.8 s. Field data is what ranks (a page-experience
signal, a tie-breaker, not a headline factor — say that honestly); **lab data diagnoses** (Lighthouse in PSI, the local
run, `google_crawler.py render`'s timing) and never substitutes for field. A URL with no CrUX data falls back to the
origin's data in PSI — label which.

**LCP fixes** in order of usual payoff: server response (caching, PHP workers, DB, a real CDN with edge caching for HTML
where the site allows it), render-blocking CSS/JS (critical CSS inline, defer the rest, no CSS-in-JS blocking), the hero
asset (`fetchpriority="high"`, `<link rel=preload>` for the LCP image, no lazy-load on the LCP image, right format and
size, no self-hosted MP4 heroes above the fold — `reckoning.md` (T) patterns), fonts (`font-display: swap` or `optional`,
self-host, subset, preload the one text font), third-party tags (see §6).

**INP fixes**: long tasks from hydration and heavy frameworks, third-party scripts on the main thread, event handlers doing
layout work, unoptimized animations, giant DOMs (>1,500 nodes flagged; >3,000 hurts), chat widgets and consent managers
(load after interaction or at idle), `scheduler.yield()` / `requestIdleCallback` for long work; measure with the INP
debugger in PSI's field diagnostics or a RUM tool export.

**CLS fixes**: width/height (or `aspect-ratio`) on every image, video, iframe and ad slot; reserved space for injected
banners and consent bars; no late-loading fonts that reflow (`size-adjust`); carousels that resize; sticky headers that
push content; injected review widgets.

**Transport and assets**: HTTP/2 or HTTP/3, TLS 1.3, Brotli (or zstd) for text, `Cache-Control` with long `max-age` +
immutable for hashed assets and `stale-while-revalidate` for HTML where safe, ETag/Last-Modified, a CDN in front (image
CDN with AVIF/WebP negotiation and resizing), responsive images (`srcset`/`sizes`), modern formats (AVIF > WebP > JPEG;
never BMP/TIFF; animated GIF → MP4/WebM), SVG for icons, no unminified CSS/JS, tree-shaken bundles, code splitting,
`preconnect` to the two or three origins that matter and no more, no `document.write`, service worker only if it helps.
The Autopsy's timing sweep (`scripts/timing_sweep.sh`) measures TTFB distributions, cache headers and consistency across
60–150 URLs; PSI with a key measures lab + field for the top pages; both are labeled by source in every table.

**Bot load** as a speed cause: verified crawlers (Googlebot, Bingbot) rarely hurt; AI training bots, scrapers and fake
Googlebots can — `google_crawler.py verify-googlebot` on the access log, then robots + edge rules (§9) — and a host with
too few PHP workers turns any bot burst into a customer-facing outage; that verdict ("config vs load vs attack") is the
Autopsy's.

## 6 · Third-party tags, consent and the measurement layer (technical view)

Inventory every tag (GTM containers — one is normal, two is a defect, three is a story; GA4; ads pixels; CAPI bridges;
chat; heatmaps/session replay; A/B tools; consent manager; fonts; embeds). For each: purpose, owner, load strategy
(sync/async/defer/idle), main-thread cost (Lighthouse "third-party usage"), and whether it fires **before consent** where
consent is required (the render probe's pre-interaction request log is the evidence; EEA sites need Consent Mode v2 for
Google's ad and analytics products). Duplicate GA4 properties, duplicate GTM, hard-coded pixels plus GTM copies, and
pixels on pages they must not be on (patient portals, financing applications, account areas) are technical *and*
compliance findings — hand the compliance half to the Satchel (W4) and keep the speed half here.

## 7 · Security, integrity and headers

TLS validity and chain, no mixed content, HSTS, redirect from http; security headers as a health check (CSP, X-Content-
Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options/`frame-ancestors`) — reported as posture, not as SEO;
exposed `.git`, `.env`, backup archives, `wp-config` copies, `xmlrpc.php` open (WordPress; disable), `?author=` enumeration,
open `/wp-json/wp/v2/users`; outdated CMS/plugin versions visible in source (CANDIDATE — versions can be masked);
malware/spam injection signs (hidden links, pharma keywords in titles, cloaked redirects — the cloaking diff is
persona-mode only and a judgment call; from honest mode, Safe Browsing status and a GSC Security Issues screenshot are
the routes); DNS hygiene (SPF/DMARC/MX for the outreach layer, CAA, dangling subdomains); and `ads.txt` / `app-ads.txt` for
publishers and app owners.

## 8 · Structured data (technical rules; the Schema Tribunal has the eligibility rules)

JSON-LD in the `<head>` or body, server-rendered; one `@graph` with stable `@id`s beats five contradicting blocks;
`Organization` (or `LocalBusiness` subtype) sitewide with `sameAs`, `logo`, `contactPoint`; `WebSite` (the sitelinks
searchbox rich result was retired in 2024 — keep `WebSite` for entity clarity, drop the `potentialAction` unless a site
search exists); `BreadcrumbList`; `Article`/`BlogPosting` with `author` as a `Person` with a URL; `Product` with
`Offer`/`AggregateOffer`, `gtin`/`sku`, `shippingDetails`, `hasMerchantReturnPolicy` (merchant listing rich results),
`Review`/`AggregateRating` only from real on-page reviews of a *different* entity; `FAQPage` (rich results limited; still
parsed), `HowTo` (rich result removed), `VideoObject` (with `contentUrl`/`embedUrl`, `thumbnailUrl`, `uploadDate`,
`duration`; key moments), `Event`, `JobPosting` (removed when filled; `validThrough`), `Recipe`, `Course`, `Dataset`,
`SoftwareApplication`, `Service`. Validate with the Rich Results Test and the Schema Markup Validator (verify tasks);
`justice_schema.py` extracts and flags the lying-schema patterns (phone/address/rating contradictions, self-serving
ratings, invalid JSON, types with required properties missing). Schema that contradicts the page is a spam-policy
exposure, not just a bug.

## 9 · Crawlers other than Google, and the AI-bot layer (the technical half; the strategy is in `ai-seo.md`)

Bing (Bingbot; Bing Webmaster Tools; IndexNow), Applebot (Siri/Spotlight; Applebot-Extended controls AI training use),
DuckDuckBot, Yandex, Baidu (only for those markets), and the AI bots: **retrieval / search bots** (OAI-SearchBot,
ChatGPT-User, PerplexityBot, Perplexity-User, Claude-SearchBot, Claude-User, DuckAssistBot, Amazonbot for Alexa) versus
**training bots** (GPTBot, ClaudeBot, CCBot, Bytespider, meta-externalagent, Google-Extended for Gemini training —
Google-Extended does *not* affect Search or AI Overviews, which use Googlebot; Applebot-Extended). Robots groups per bot are
the control; Cloudflare's managed bot rules and "pay-per-crawl"/AI crawl controls (introduced 2025; verify current
defaults — new Cloudflare zones may block AI crawlers by default) and the **Content-Signal** convention in robots.txt
(`Content-Signal: search=yes, ai-input=…, ai-train=…`, proposed 2025; verify adoption) are the newer levers; `llms.txt` is
cheap and unproven (Google says it does not use it; other assistants may). The technical audit records the posture per bot
in a table (allowed / blocked / not mentioned) and hands the *should we* to `ai-seo.md`.

## 10 · Platform-specific checklists

**WordPress**: `Discourage search engines` off in production; XML sitemap from one plugin only (core `wp-sitemap.xml`
disabled if Yoast/RankMath serves one); `noindex` on tag/author/date/attachment/format archives (and delete attachment
pages via redirect-to-file); `?replytocom=` blocked; comments pagination off; trailing-slash consistency; `xmlrpc.php`
disabled; REST user enumeration blocked; page-builder DOM size and inline CSS; caching plugin + object cache + a CDN;
image optimization (WebP/AVIF) with dimensions; heartbeat/cron sanity; `wp-cron` to a real cron; plugin count and abandoned
plugins; theme version in source; `?s=` results noindexed; one GTM; the Elementor "query-string pagination" (T) pattern.

**Shopify**: `/collections/x/products/y` duplicates canonicalize to `/products/y` (check the theme keeps the canonical);
`/collections/all` and vendor/type auto-collections (`/collections/vendors?q=` noindex); tag filter URLs (`/collections/x/tag`)
— noindex unless demand; product variants (`?variant=`) canonicalized; robots.txt is editable (`robots.txt.liquid`); apps
injecting reviews/menus (JS-dependent); `Shopify Markets` for international (subfolders per market, hreflang generated —
verify); image sizes via `image_url` filters; sitemap auto-generated (locale sitemaps); blog on `/blogs/news` (thin by
default); the storefront's INP with too many apps.

**Magento/Adobe Commerce, BigCommerce, WooCommerce, Salesforce Commerce**: layered navigation controls, category paths in
product URLs (one canonical), search-result pages noindexed, currency/store-view URLs with hreflang, Varnish/full-page
cache, image CDN.

**Webflow / Squarespace / Wix / HubSpot CMS**: per-page canonicals and robots; auto-sitemaps (check for noindex pages listed);
301 tables; CDN included; hreflang support varies (Webflow Localization; Wix multilingual) — verify the generated tags;
Wix's SSR is solid, its URL structure is fixed.

**Custom / headless (Next.js, Nuxt, Remix, Astro, Rails, Django, Laravel)**: SSR for primary content, metadata per route,
robots and sitemap generation, 404/410 codes from the framework (not 200 shells), redirects at the edge, image component
formats, ISR/caching headers, hydration cost, `Link` prefetch not flooding the crawl.

## 11 · Company-archetype weighting

- **Local service sites (≤300 pages):** crawl budget is irrelevant; the killers are noindex accidents, template
  duplicates, tracking-number NAP, mobile nav, and speed from bloated builders — spend the technical effort on §2 hygiene,
  §5 LCP/INP, and location-page architecture.
- **Multi-location / franchise:** locator crawlability, one URL per location, estate-wide template defects (Pattern
  Verdict), hreflang for bilingual markets, consistent canonicals across microsites.
- **E-commerce:** §4 duplication (facets, variants, pagination), merchant-listing schema, product availability handling
  (out-of-stock: keep 200 with `availability` and related products; discontinued: 410 or redirect to the closest parent),
  category page content, image weight, checkout speed, `robots` for cart/account, feed–page parity (Merchant Center
  disapprovals often trace to page/feed mismatches), international storefronts.
- **B2B / SaaS:** documentation and pricing crawlable, no gated core content, JS-app marketing sites (SSR), blog cadence
  and canonical hygiene, `SoftwareApplication`/`Product` schema, changelog/status pages, subdomain sprawl (docs., help.,
  blog. — consolidate or link deliberately), demo/booking pages fast.
- **Publishers / media:** news sitemaps, `Article` with authors, paywall structured data (`isAccessibleForFree`,
  `hasPart`), AMP retired, ad-slot CLS, INP from ad tech, crawl budget real, syndication canonicals, the AI snippet
  controls and the GSC AI-feature opt-out toggle (reported 2026 — verify) as an editorial decision.
- **Healthcare / legal / finance (YMYL):** author and reviewer entities in schema and on page, citations to primary
  sources, HTTPS everywhere, no pixels on sensitive flows (§6), fast intake pages, accessibility (ADA/EAA) as exposure.
- **Marketplaces / directories / lead-gen:** the crawl-budget archetype; thin listing pages (index only with content and
  demand), expired listings (410 or redirect to category), facet strategy, sitemap freshness, doorway exposure.
- **App-first / consumer apps:** the marketing site is small; deep-link files (`.well-known/apple-app-site-association`,
  `assetlinks.json`) valid; smart app banners; store pages as the "landing" (`references/apps.md`).
- **Nonprofits / education / government-adjacent:** legacy CMS, PDF sprawl (index only what should rank; PDFs have no
  canonical control beyond headers), accessibility, event schema, donation flow speed.

## 12 · Grading and prioritization

Severity axes: **index eligibility** (High = a money page is or could be out), **crawl waste** (Medium unless the site is
large), **experience** (field CWV failing on money pages = High; lab-only = Medium), **integrity/security** (High when
exploitable or visible to customers), **hygiene** (Low). Roadmap order: fix what erases (noindex/canonical/robots on money
pages) → what hides (JS-dependent content, walls) → what slows (LCP on money pages, hosting) → what wastes (duplicates,
facets) → what polishes. Quick wins (<30 min) batched: titles, canonicals, `alt`, viewport, sitemap cleanup, redirect
rules. Every ticket carries the exact URL, the observed value, the target value, and the verification step (GSC report or
re-crawl).

## 13 · Deliverable shape

Workbook tabs: **Crawl & Index** (from the Google Crawl), **Technical Ledger** (finding × severity × axis × observed ×
target × fix × verify × link), **Speed & CWV** (per page: LCP/INP/CLS field p75 + lab, TTFB sweep, source and date), **Tag
Inventory** (tag × purpose × load × pre-consent × owner), **Redirect Map** (migrations), **Bot Posture** (bot × directive ×
source line). Report: *Technical SEO & Site Health* and *Technical Performance* sections. CSV sections *Technical SEO*,
*Crawlability & Indexing*, *Speed & CWV*, *UX & Mobile*. Playbook: drop-in robots.txt, sitemap rules, redirect rules,
canonical rules, the LCP/INP/CLS fix list per money page, the tag-load plan, the AI-bot block.

## 14 · Volatility register (re-read live)

Google Search Central: crawling & indexing docs (robots.txt, sitemaps, canonicalization, JavaScript SEO basics, mobile-first
indexing), the Core Web Vitals thresholds page (`web.dev/articles/vitals`), the structured-data gallery (which rich results
still exist), the spam policies (scaled content abuse, site reputation abuse, doorways, cloaking, expired-domain abuse), the
crawler list and IP-range feeds; Bing Webmaster guidelines and IndexNow participants; Cloudflare's AI-crawler controls and
Content-Signal; the GSC AI reporting / opt-out controls (reported 2026); the CrUX methodology (which pages get field data);
platform release notes (WordPress core, Shopify, Next.js) for anything the checklist above assumes.
