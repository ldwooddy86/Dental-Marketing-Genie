# THE GOOGLE CRAWL — the crawlability & index movement of UltimaWeapon

The search-engine's-eye pass. It discovers pages the way a crawler does, judges each URL the way an index would, renders
the money pages the way a mobile crawler renders them, and — on the defensive side — proves or disproves every "Googlebot"
in a server log. It is **honest-only**: the crawl STRATEGY of a search engine, never its IDENTITY. `scripts/google_crawler.py`
imports wetware's honest session (declared User-Agent, robots.txt obeyed, per-host rate limit, `Retry-After` honored,
conditional cache) and never sends a Googlebot or trusted-bot User-Agent, never solves a challenge, never uses a proxy.
`--persona` / `--legacy-persona` is not wired into this module in any mode.

What it cannot see: whether Google *actually* indexed a URL. That ground truth is **GSC URL Inspection** and the **Pages
(Indexing) report**, run by the owner on the verified property; every crawl report ends with the verify-task protocol for it.

## Files and commands

```bash
# identity first (once per session) — the shipped default carries a REPLACE placeholder
export UW_USER_AGENT="UltimaWeapon/1.0 (+https://<your-contact-page>)"

# 1. crawl: sitemap discovery + (optional) link graph, index-decision findings, per-URL CSV, severity-ranked report
python3 scripts/google_crawler.py crawl https://example.com/ --out omega_cache/example.com/google_crawl \
    --follow-links --max-pages 150 [--max-sitemaps 25] [--include /services/] [--exclude '\?replytocom='] [--sample-families]

# 2. render: real Chromium, MOBILE viewport, declared UA, no stealth — rendered-vs-raw diff, lab timing, screenshot
python3 scripts/google_crawler.py render https://example.com/ https://example.com/service/ \
    --out omega_cache/example.com/google_render.json --screenshots omega_cache/example.com/google_shots [--wait 6]

# 3. verify-googlebot: is every "Googlebot" in the access log real? (forward-confirmed rDNS + published IP ranges)
python3 scripts/google_crawler.py verify-googlebot --log access.log [--log access.log.1.gz] [--ips 1.2.3.4 ...] \
    --out omega_cache/example.com/googlebot_verify [--offline] [--max-ips 500]

# 4. report: one paragraph for Scope & Data Integrity
python3 scripts/google_crawler.py report --out omega_cache/example.com/google_crawl
```

Global flags sit BEFORE the subcommand: `--ua`, `--cache` (default: parent of `--out`), `--min-interval` (default 2 s; `Crawl-delay`
honored), `--ignore-robots` (a stated judgment call, logged loudly), `--locale`, `--quiet`. Outputs of `crawl`: `crawl.json`
(summary + pages + findings + catalogue), `crawl.csv` (one row per URL), `findings.csv`, `sitemap_inventory.csv`, `presence.txt`,
`crawl_report.md`. Outputs of `render`: `<out>.json` + `<out>.md` + screenshots. Outputs of `verify-googlebot`:
`googlebot_verify.{csv,json,md}`. Every fetch is logged in `<cache>/wetware/fetch_log.jsonl` under the declared UA.

## How `crawl` thinks

1. **robots.txt** — read once; `Sitemap:` lines are the first sitemap source; the `*` and `Googlebot` groups decide
   `robots_blocked_googlebot` per URL (Googlebot group wins when it has rules, else `*`, longest match, allow wins ties —
   RFC 9309 as Google documents it); a blanket `Disallow: /` is `ROBOTS_BLOCKS_ALL`. The AI-crawler posture (GPTBot,
   OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot, Bytespider, Amazonbot,
   meta-externalagent …) is recorded as `AI_BOTS_BLOCKED` (informational; see `references/ai-seo.md` for the tradeoff).
2. **Sitemaps** — robots `Sitemap:` lines, then `/sitemap.xml`, `/sitemap_index.xml`, `/sitemap-index.xml`, `/wp-sitemap.xml`,
   `/sitemap/sitemap-index.xml`; index → children (gzip and plain-text sitemaps accepted); every `<loc>` with its `lastmod`
   lands in `sitemap_inventory.csv` with a URL family (`/services/`, `/blog/`, `dated`, …). Cap `--max-sitemaps`.
3. **Plan** — homepage first, then sitemap URLs. When the sitemap exceeds `--max-pages`, `--sample-families` round-robins
   across families so a 20,000-post blog does not crowd out 40 money pages; without it, the first N are taken and the
   report says so. `--include` / `--exclude` scope a section.
4. **Fetch** — under the declared UA; a robots-disallowed path is `ROBOTS_DISALLOWED_FOR_US` (not fetched); a WAF / 403 /
   challenge is `WALL` (NOT_TESTED, the block is the finding). Per URL: status, final URL, redirect chain and hop count,
   `X-Robots-Tag`, meta robots, canonical (+ self-canonical), title, description, H1s, `lang`, viewport, hreflang,
   JSON-LD `@type`s, visible-word count from the RAW HTML, images without `alt`, bytes, TTFB, in-sitemap, lastmod.
5. **Link graph** — with `--follow-links` every same-site `<a href>` is followed (bounded by `--max-pages`), in-links are
   counted, and **crawl depth** is a BFS from the homepage over the links actually observed.
6. **Judge** — the finding catalogue below; duplicates are computed across indexable 200s only (a redirecting URL is not
   itself indexable — its final URL is judged on its own row); orphans are `ORPHAN` only when link discovery ran and
   covered ≥80 % of the sitemap, otherwise `ORPHAN_CANDIDATE`.

## The finding catalogue (code · severity · what it means · the fix)

| Code | Sev | Meaning | Fix |
|---|---|---|---|
| ROBOTS_BLOCKS_ALL | High | `Disallow: /` for everyone | remove it (staging only) |
| HOMEPAGE_NOINDEX / HOMEPAGE_ERROR | High | homepage noindex or not 200 | restore an indexable 200 homepage |
| NOINDEX_IN_SITEMAP | High | sitemap lists a noindex URL | index it or drop it — sitemaps list indexable finals only |
| ROBOTS_BLOCKED_IN_SITEMAP | High | sitemap lists a robots-blocked URL | unblock or drop |
| SITEMAP_URL_ERROR | High | sitemap lists a 4xx/5xx | fix or remove |
| CANONICAL_TO_ERROR / CANONICAL_TO_NOINDEX | High | canonical target errors, redirects or is noindex | canonical → live, indexable, self-canonical final |
| SITEMAP_MISSING | Medium | no sitemap discoverable | publish one; declare in robots.txt and GSC |
| SITEMAP_REDIRECT | Medium | sitemap URL redirects | list the final URL |
| REDIRECT_CHAIN | Medium | ≥2 hops | one hop to the final |
| CANONICALIZED_AWAY | Medium | sitemap URL canonicals elsewhere | only self-canonicals in the sitemap |
| CANONICAL_MISMATCH_SCHEME_HOST | Medium | http vs https, www vs non-www | canonical = served final, exactly |
| MISSING_CANONICAL | Medium | indexable page, no canonical | add self-referencing canonical |
| DUPLICATE_TITLE | Medium | same title on several URLs | unique, specific titles |
| ORPHAN / ORPHAN_CANDIDATE | Medium / Low | no internal in-link found | link from a hub or parent; confirm with a fuller link crawl |
| NO_VIEWPORT | Medium | no viewport meta | add it (mobile-first indexing) |
| MISSING_TITLE | Medium | no title | add one |
| NOT_IN_SITEMAP | Low | indexable page reached by links, absent from sitemaps | add it if it should rank |
| DUPLICATE_DESCRIPTION, MISSING_DESCRIPTION, LONG_TITLE | Low | snippet hygiene | rewrite |
| SITEMAP_HTTP_ENTRIES, SITEMAP_PARAMETER_URLS, SITEMAP_LASTMOD_SUSPECT | Low | sitemap hygiene | https finals, clean URLs, real lastmod or none |
| DEEP_PAGE | Low | ≥4 clicks from home | flatten via hubs |
| THIN_PAGE | Low | <150 visible words in raw HTML | add content, or it is JS-rendered (run `render`) |
| NO_H1, MULTIPLE_H1, LARGE_HTML, HREFLANG_SELF_MISSING, MIXED_TRAILING_SLASH | Low | template defects | as named |
| NOINDEX_FOLLOWED_LINKS, ROBOTS_DISALLOWED_FOR_US, AI_BOTS_BLOCKED, WALL | Info | context, not defects | confirm intentional / NOT_TESTED |

Severity here is *index-eligibility* severity — how likely the defect is to keep a page out of the index or to waste the
crawl. It is not business impact; the roadmap re-weights by money-page status (a High on a privacy policy is a ticket, a
Medium on the top service page is a P1). Every finding row carries the URL as a clickable link in the workbook.

## How `render` thinks

Honest launch (`wetware.render_launch_honest`): the real Chromium with the declared UA, automation flags visible, no stealth
patches, `412×915` mobile viewport (Pixel-class, DPR 2.625, touch), `domcontentloaded` + `--wait` seconds + two scrolls (lazy
content). Then: rendered visible words vs raw-HTML visible words → **JS-dependent share** (`≥30 %` = JS-DEPENDENT,
`10–30 %` = PARTLY, else server-visible); rendered-only H1–H3 headings; raw vs rendered link counts; JSON-LD types present
only after rendering (a crawler that does not run JS never sees them); navigation timing (TTFB, DCL, load, transfer size)
and a lab LCP from the PerformanceObserver; console errors; request count and third-party host count; a full-page
screenshot. Lab numbers are from one headless load from this workspace's vantage and are labeled as such — field Core Web
Vitals come from CrUX / PSI / GSC, never from here.

Reading it: a money page that is JS-DEPENDENT is an **index-risk finding** ("the raw HTML carries 120 words; the rendered
page 1,400") with the fix "server-render or prerender the primary content", confirmed by GSC URL Inspection → *View crawled
page* (Google's rendered HTML) and `Test live URL`. JSON-LD injected by JS (GTM-injected schema is the classic case) goes on
the Schema Tribunal as "present only after rendering — verify with the Rich Results Test".

## How `verify-googlebot` thinks

Google's own recipe, automated: for each IP that CLAIMED a crawler identity (`Googlebot`, `AdsBot-Google`,
`Mediapartners-Google`, `Storebot-Google`, `Google-InspectionTool`, `GoogleOther`, `Google-Extended`, `APIs-Google`,
`FeedFetcher-Google`, `bingbot`, `adidxbot`, `BingPreview`) — (1) reverse DNS: the PTR must end in `googlebot.com`,
`google.com` or `googleusercontent.com` (Bing: `search.msn.com`); (2) forward-confirm: the PTR hostname must resolve back to
the same IP; (3) membership in the published range feeds (`googlebot.json`, `special-crawlers.json`,
`user-triggered-fetchers.json`, `user-triggered-fetchers-google.json`, `bingbot.json`), fetched live under the declared UA.
Verdicts: **VERIFIED** (rDNS forward-confirmed, or in the published ranges), **FAKE** (a PTR outside the crawler domains,
or a crawler-domain PTR that does not resolve back, or not in the ranges when rDNS also fails), **UNVERIFIED** (the check
could not run — DNS or feeds unavailable; never reported as clean). Log formats: common / combined (`nginx`, Apache) and
JSON lines (`remote_addr` / `client_ip` / `ip`, `http_user_agent` / `user_agent`, `request` / `uri`, `time*`, `status`); `.gz`
accepted. A FAKE roster is a **security & crawl-budget finding**: the fix is an edge rule (block the IPs; gate
Googlebot-claiming requests on rDNS at the CDN/WAF), the request path list shows what they were after (`wp-login.php`,
`xmlrpc.php`, price pages, forms), and a Tor-exit or hosting-provider PTR is named in the evidence exactly as resolved.

## Where the findings go

- **Report → Technical SEO & Site Health**: the index-status breakdown (indexable / noindex / robots-blocked / redirected /
  error / wall), the sitemap picture, the High and Medium findings with the money pages named, the JS-dependency verdicts,
  and the FAKE roster if a log was supplied. The **Crawl & Index** workbook tab carries every URL row; the render rows join
  it; the verify roster gets its own block.
- **Charts**: index-status breakdown bar; crawl-depth histogram (from the summary's `depth_histogram`).
- **Playbook → Crawlability & Indexing** tickets: sitemap hygiene (list only 200, self-canonical, indexable finals — one
  inventory per host), resolve noindex/robots/canonical conflicts, one-hop redirects, internal-link the orphans, shorten deep
  paths, server-render JS-dependent primary content, edge rule for fake crawlers; plus the GSC URL Inspection verify rows in
  the Verify Queue tab.
- **Presence line**: `presence.txt` (the DECLARED sentence) is quoted in Scope & Data Integrity; `fetch_log.jsonl` must show
  only the declared UA — the Finale's checklist confirms it.

## Judgment calls to state at the top of the delivery

Which section was crawled and why (`--include`), the page cap and whether the sitemap was sampled by family, whether link
discovery was on (orphans are candidates without it), which money pages were rendered, whether `--ignore-robots` was set
(only if the user asked), and that a wall (if met) was recorded rather than worked around.

## Fallbacks and refusals

| Situation | Adjustment |
|---|---|
| WAF / 403 / challenge at the host | NOT_TESTED, the wall is the finding; offer the local pull (the operator's own machine) or a Screaming Frog / Sitebulb export to ingest into the Crawl & Index tab |
| robots.txt disallows the section (honest mode) | skipped, logged, surfaced as "not crawled per robots"; `--ignore-robots` only as the user's stated call |
| Sitemap absent | `SITEMAP_MISSING`; crawl proceeds from the homepage with `--follow-links`; the playbook's first crawl ticket is "publish a sitemap" |
| Huge catalog (>50k URLs) | `--sample-families` with a raised `--max-pages`; say the sample size; never claim a full crawl |
| Playwright / Chromium missing | `render` writes NOT_TESTED rows; `pip install playwright && playwright install chromium`; fall back to the raw-HTML word count from `crawl` |
| No access log for `verify-googlebot` | name the export (combined log format, or the CDN's request log) as Task #1; until then NOT_TESTED, never "no fakes found" |
| Range feeds unreachable | rDNS-only verdicts, labeled; UNVERIFIED stays UNVERIFIED |
| Asked to send the Googlebot UA, bypass the wall, or use a proxy | no — honest-only in every mode; the GSC verify protocol and the local pull are the routes |
