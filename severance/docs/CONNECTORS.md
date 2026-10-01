# Ad account connectors · setup guide (module 23, Accounts)

Code: `src/07_accounts_core.js` (the `ACCT` closure), UI: `src/42_m23_accounts.js`, styles: `css/42_accounts.css`, tests:
`node tests/run.mjs ads` (every connector against mock servers) and `node tests/run.mjs importers` (every CSV format).
A port of the Thermal Atlas connectors (`../chrome-app/docs/CONNECTORS.md`) for one Texas family law firm.

Every credential, token and row of actuals stays in this browser: `chrome.storage.local` in the extension, `localStorage` elsewhere, both
under the key `sv.accounts.v1`. Nothing is sent anywhere but the provider's own API. Severance ships no developer credentials; the firm
creates its own apps and clients in each console below.

## Where it runs

| Environment (`ACCT.ENV`) | Sign in (Connect) | Pasted token, Test, Sync | Imports |
|---|---|---|---|
| `chrome`, `firefox` (the extension) | yes, `identity.launchWebAuthFlow` | yes, every provider (host permissions, no CORS) | yes |
| `file` (opened from disk or the web) | no: a page has no registered redirect address | where the provider answers browser calls (Meta does, most Google APIs do; Microsoft, LinkedIn and TikTok do not); a blocked call is explained on the card | yes |
| `viewer` (the hosted viewer) | no | no: the viewer blocks the calls, the buttons are off | yes |

**Redirect URL.** Module 23 shows it at the top of the page in the extension (`chrome.identity.getRedirectURL()`, of the form
`https://<extension id>.chromiumapp.org/`). Paste that exact string into every provider console below. The extension id changes when the
unpacked folder moves, so check it again after reinstalling. Firefox asks for site access on first use; the module shows a Grant button.

**Hosts.** `HOST_ORIGINS` in `src/07_accounts_core.js` lists the fixed API origins the connectors call; `node build.mjs --check` checks each
against `manifest.json` `host_permissions` (all present): `accounts.google.com`, `oauth2.googleapis.com`, `googleads.googleapis.com`,
`localservices.googleapis.com`, `youtubeanalytics.googleapis.com`, `www.googleapis.com`, `businessprofileperformance.googleapis.com`,
`graph.facebook.com`, `www.facebook.com`, `business-api.tiktok.com`, `ads.tiktok.com`, `api.linkedin.com`, `www.linkedin.com`,
`login.microsoftonline.com`, `*.api.bingads.microsoft.com`.

**Versions.** Google Ads and Meta are probed when you press Test: the first version in the list that answers anything but 404 is stored in
`cfg._ver` and shown on the card ("API v24") and in the source register. The others are fixed.

| Provider | Default | Probe list | Probe call |
|---|---|---|---|
| Google Ads API | v24 | v25, v24, v23 | `GET https://googleads.googleapis.com/{ver}/customers:listAccessibleCustomers` |
| Meta Graph and Marketing API | v26.0 | v27.0, v26.0, v25.0 | `GET https://graph.facebook.com/{ver}/me` |
| TikTok Business API | v1.3 | none | |
| Local Services API | v1 | none | |
| YouTube Analytics / Data | v2 / v3 | none | |
| Microsoft Advertising | v13 | none | |
| LinkedIn Marketing | 202509 | none | |

`cfg.apiBase` overrides the host of any provider (regions, sandboxes, the mock servers in the tests). Every call that goes through the
shared JSON helper retries once after an HTTP 429 (`settings.backoffMs`, 2 s by default).

---

## Google Ads (`google`)

**Console.** console.cloud.google.com: a project with the Google Ads API, Local Services API, YouTube Analytics API, YouTube Data API v3 and
Business Profile Performance API enabled. OAuth consent screen in Internal or Testing mode with the firm's account emails as test users.
Credentials: OAuth client ID of type **Web application**, redirect URI = the module's redirect URL. ads.google.com manager account: API Center,
developer token (Basic access covers this use; a test token only works on test accounts).

**Paste.** Client ID, client secret, developer token, customer ID (digits), optional manager (login) customer ID, optional Business Profile
location ID.

**Scopes** (one sign in serves Google Ads, Local Services Ads and YouTube): `https://www.googleapis.com/auth/adwords`,
`https://www.googleapis.com/auth/yt-analytics.readonly`, `https://www.googleapis.com/auth/youtube.readonly`,
`https://www.googleapis.com/auth/business.manage`. Flow: authorization code with PKCE and the client secret, `access_type=offline`,
`prompt=consent`; the refresh token keeps the connection alive.

**Pull.** `POST /{ver}/customers/{cid}/googleAds:search` (GAQL; body `{query}` plus `pageToken`, never `pageSize`, which the API refuses with
`PAGE_SIZE_NOT_SUPPORTED` since v17) three times: campaigns by day, campaigns by day and hour (`segments.hour`, stored as separate hourly
rows), and `geographic_view` by postal code (the criteria ID is matched to the Severance ZCTA `gt` field, which gives the ZIP and its
county). Campaign rows are tagged by `campaign.advertising_channel_type`: `LOCAL_SERVICES` becomes source `lsa`, `VIDEO` and `DEMAND_GEN`
become source `youtube`, everything else `google`; once the LSA or YouTube card has pulled its own rows, the Google copies are dropped from
the totals. Business Profile daily metrics when a location ID is set (`GET https://businessprofileperformance.googleapis.com/v1/locations/{id}:fetchMultiDailyMetricsTimeSeries`).

**Family law note.** Google's personalized advertising policy treats relationship, marital and family difficulties as a sensitive interest
category: no audience segments, remarketing or customer match lists built on divorce status. Keyword targeting and ZIP lists are
geographic and comply (module 11).

## Local Services Ads (`lsa`, uses the Google sign in)

**Law firm prerequisite.** Local Services Ads for lawyers run under **Google Screened**: Google verifies each lawyer's bar license and runs
its background check before the listing serves. The API reads an account that is already live; it cannot start screening.

**Console.** Nothing beyond the Google project above: enable the **Local Services API** there. The API answers only through a **manager
account** that holds the LSA account, so link the LSA account to a manager in ads.google.com if it is not already.

**Paste.** Manager customer ID (digits) and, when the manager holds several LSA accounts, the LSA account's own customer ID.

**Scope.** `adwords`, granted by the Google sign in. The card's sign in button points to the Google card.

**Pull.**
- `GET https://localservices.googleapis.com/v1/detailedLeadReports:search?query=manager_customer_id:<mcc>&startDate.year=&startDate.month=&startDate.day=&endDate.year=&endDate.month=&endDate.day=&pageSize=1000[&pageToken=]`
  → one `lead` row per lead: date and hour in the account's time zone (`timezone.id`), campaign `LSA <leadCategory>`, ad group = the message
  job type, `calls` 1 for `PHONE_CALL`, `msgs` 1 for `MESSAGE`, `conv` 1 and `spend` = `leadPrice` when `chargeStatus` is `CHARGED`, ZIP (and
  county) from the message lead's postal code, the service line from the job type (a generic family law category goes to divorce with
  children), and a note with charge status, dispute status and connected call length. No consumer name or phone number is stored.
- `GET /v1/accountReports:search?query=manager_customer_id:<mcc>&...` → `LSA account <businessName>` spend rows (kind `ads`): the account's
  `currentPeriodTotalCost` for the range (the older `adSpend` name is read as a fallback), itemized by the day and line of each charged
  lead, with the remainder dated at the end of the range on the account's most common lead line. Weekly budget, rating, reviews, phone
  responsiveness, charged leads and calls go to the pull notes and the Test output.
- Fallback: when the detailed lead call fails, the Google Ads `local_services_lead` report is queried on the LSA customer under the manager
  (`login-customer-id`), and the note says so.

## YouTube (`youtube`, uses the Google sign in)

**Console.** YouTube Analytics API and YouTube Data API v3 enabled on the Google project. Sign in on the Google card with the account that
owns or manages the firm's channel. **Paste.** Channel ID (optional; `channel==MINE` otherwise).

**Pull.** `GET https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&...&metrics=views,estimatedMinutesWatched,subscribersGained,likes,comments,shares&dimensions=day&sort=day`
(one `social` row per day and metric); `...&dimensions=video&sort=-views&maxResults=25` named through
`GET https://www.googleapis.com/youtube/v3/videos?part=snippet&id=...`; `GET /youtube/v3/channels?part=snippet,statistics&mine=true`; and
paid video and Demand Gen campaigns from the Google Ads GAQL query restricted to `campaign.advertising_channel_type IN ('VIDEO', 'DEMAND_GEN')`
by day and by hour (skipped with a note when the Google card has no customer ID).

## Meta (`meta`)

**Console.** developers.facebook.com: a Business type app with Marketing API and Facebook Login for Business; the redirect URL under Valid
OAuth Redirect URIs. Development mode connects the app's own admins, developers and testers; other businesses need Advanced Access for
`ads_read` and the insights permissions.

**Paste.** App ID, app secret (optional), Facebook Login for Business configuration ID (required when the app uses Login for Business:
Configurations, create one with the permissions below, copy its ID), ad account ID (`act_` and digits), Page ID, Instagram business account ID
(optional).

**Scopes.** `ads_read, read_insights, pages_read_engagement, pages_show_list, instagram_basic, instagram_manage_insights, business_management`.
Flow: `https://www.facebook.com/{ver}/dialog/oauth` with `response_type=token`; with a configuration ID the dialog also carries `config_id` and
`override_default_response_type=true`; if it answers with a code anyway, the code is redeemed at
`GET /{ver}/oauth/access_token?client_id&redirect_uri&client_secret&code` (needs the app secret). With the app secret the one hour token is
exchanged for a 60 day token (`grant_type=fb_exchange_token`). A system user token from Business Manager can be pasted instead.

**Pull.** `/{ver}/act_<id>/insights` at ad set level by day (`time_increment=1`), at campaign level with the
`hourly_stats_aggregated_by_advertiser_time_zone` and `region` breakdowns; Page and Instagram insights when their IDs are set. `paging.next` is
followed up to 50 pages; rate limit errors (codes 4, 17, 32, 613, or HTTP 429) are retried once after `cfg.backoffMs` (30 s by default).

**Family law note.** Meta has no special ad category for legal services (its special ad categories are financial products and services, employment, housing, and social issues, elections or politics),
but the personal attributes policy applies to every family law ad: copy that asserts or implies the reader is divorcing ("Are you getting
divorced?") is disapproved; write to the situation in the third person. Region only, no ZIP.

## TikTok Ads (`tiktok`)

**Console.** business-api.tiktok.com/portal: a developer app for the Marketing API with the Ads Management (read) and Reporting scopes.
App settings: **Advertiser redirect URL** = the module's redirect URL. **Paste.** App ID, app secret, advertiser ID (optional; the first ad
account the user authorizes is stored, Test lists them all).

**Flow.** `https://business-api.tiktok.com/portal/auth?app_id=&state=&redirect_uri=`; the callback carries `auth_code` and `state`;
`POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/` with JSON `{app_id, secret, auth_code}` returns `data.access_token` and
`data.advertiser_ids`. Every later call sends the `Access-Token` header. Advertiser tokens are long lived (no expiry, no refresh; they stop
when revoked); `expires_in` and `refresh_token` are honoured through `/oauth2/refresh_token/` should TikTok ever return them.

**Test.** `GET /open_api/v1.3/oauth2/advertiser/get/?app_id=&secret=`. **Pull.** `GET /open_api/v1.3/report/integrated/get/` with
`advertiser_id, report_type=BASIC, data_level=AUCTION_CAMPAIGN, dimensions=["campaign_id","stat_time_day"], metrics=[...], start_date, end_date,
page_size=1000, page`, paged through `data.page_info.total_page`, then again with `stat_time_hour`. Every body has `code` (0 is success); anything
else is raised as `TikTok <code>: <message>`. Reports accept at most 30 days per request, so the range is split into 30 day windows.

## Microsoft Advertising (`microsoft`) and LinkedIn (`linkedin`)

Microsoft uses the authorization code flow with PKCE against `login.microsoftonline.com` (Single page application registration). Known limit:
Microsoft Entra may refuse to redeem the code from an extension origin (`AADSTS9002326`); the card then accepts a pasted token (from the
Microsoft Advertising OAuth sample or the Bing Ads SDK run once on your machine). Then
`POST https://reporting.api.bingads.microsoft.com/Reporting/v13/GenerateReport/Submit` with
`{ReportRequest: {Type: 'CampaignPerformanceReportRequest', Format: 'Csv', Aggregation: 'Hourly', Columns, Scope: {AccountIds}, Time}}`,
`.../GenerateReport/Poll` until `Success`, then the `ReportDownloadUrl` (a zipped CSV unpacked in the page: one `hour` row per line and a
folded `ads` row per day and campaign). Headers: `Authorization`, `DeveloperToken`, `CustomerId`, `CustomerAccountId`. Test:
`POST https://clientcenter.api.bingads.microsoft.com/CustomerManagement/v13/User/Query` `{UserId: null}`.

LinkedIn uses the authorization code flow with the client secret, then
`GET /rest/adAnalytics?q=analytics&pivot=CAMPAIGN&timeGranularity=DAILY&dateRange=(start:(...),end:(...))&accounts=List(urn:li:sponsoredAccount:<id>)&fields=...`
(`LinkedIn-Version: 202509`, `X-Restli-Protocol-Version: 2.0.0`) and the organization follower statistics. Campaigns come back as URNs with no
names, so LinkedIn rows go to the high asset line (`high`) unless a line token is found. Test: `GET /rest/adAccounts?q=search`.

---

## Imports (no credentials)

Drop or paste a CSV (comma or tab, quoted fields, `#` comment lines and report preambles are handled). The format is read from the header
unless one is picked. Each row carries a hash of its source line, so importing the same file twice adds nothing.

| Format (`importer.id`) | Detected by | Rows |
|---|---|---|
| Google Ads report (`google-ui`) | `Campaign` + `Cost` + `Day`/`Week`/`Month` | `ads`; with `Hour of day` → `hour` rows plus folded daily rows; with `Postal code` or `User location` → `geo` |
| Meta Ads Manager (`meta-ui`) | `Campaign name` + `Amount spent` | `ads`; time of day → `hour`; `Region` → `geo` |
| TikTok Ads Manager (`tiktok-ui`) | `Campaign name` + `Cost` | `ads` |
| Microsoft Advertising (`microsoft-ui`) | `CampaignName`, or `Campaign name` + `Spend` | `ads` |
| Local Services Ads leads (`lsa`) | a `lead` column + `Job type` or `Lead type` | `lead` (call or message, charged, price, ZIP) |
| YouTube Studio (`youtube-studio`) | `Video title`, or `Date` + `Views` | `social` |
| CallRail (`callrail`) | `Start time` + `Source` or `Tracking number` | `lead` (a call; hour from the start time; channel from the source; qualified from `Lead status`; city or ZIP → county) |
| CallTrackingMetrics (`ctm`) | `Called at`, or `Tracking label`, or `Receiving number` + a source | `lead` (as CallRail; the tracking label also feeds the line) |
| Clio Grow (`clio-grow`) | `Practice area` + `Referral source`/`Lead source`/`Source`, no stage column | `intake` |
| Lawmatics (`lawmatics`) | `Practice area`/`Matter type`/`Case type` + `Stage`/`Sub status` | `intake` |
| Generic sheet (`generic`) | `date` + `spend`, `cost`, `leads`, `retained` or `conversions` | `ads` (or `hour`), with optional `practice area`, `zip`, `county`, `retained`, `value` |

**Intake rows** keep: created date (and hour when written), source and campaign, practice area, status and stage, value, ZIP, county or city.
Names, emails and phone numbers are never read into a row. The stage is one of `open`, `consult`, `retained`, `lost`:
`not hired`, `declined`, `lost`, `referred out`, `hired another attorney` → lost; `hired`, `retained`, `signed`, `engaged`, `converted`,
`retainer paid` (or a filled hired date) → retained; `consult`, `scheduled`, `appointment` → consult; anything else → open.

**Channels** for calls and intake come from the source text: Google Ads (`google`), Local Services (`lsa`), Business Profile (`gbp`),
organic search (`organic`), Meta (`meta`), TikTok, Microsoft, LinkedIn, YouTube, directories (Avvo, Justia, FindLaw, Super Lawyers), referral,
direct or website, Yelp, Nextdoor, other. A source written only as "Google" counts as Google Ads; label organic leads "Google organic".

## Service lines

Each row gets a `LINE_META` key. Intake rows read the practice area first; other rows read the ad group, then the campaign:
1. a line key token in an underscore style name (`SEV_DIV_K_HARRIS`, `TX_MOD_SEARCH`, `SEV_PO_META`; the short keys mod, po, high, mil, gray
   and adopt only count in underscore names, so "High intent" is not high asset);
2. a line's `name` or `short` from `LINE_META` (the Campaign Desk's campaign names carry them);
3. English and Spanish keywords, most specific first: prenup (`prenup`, `premarital`, `postnup`, `partition agreement`), adoption, CPS
   (`CPS`, `DFPS`, `removal hearing`, `termination of parental rights`), protective order (`protective order`, `family violence`,
   `orden de protección`), military (`military`, `deployment`, `USFSPA`, `SCRA`, `Fort Cavazos`, `Fort Bliss`, `JBSA`), gray (`gray divorce`,
   `after 50`, `QDRO`, `pension`), high asset (`high net worth`, `business owner`, `separate property`), enforcement (`enforce`, `contempt`,
   `back child support`), modification (`modify`, `relocation`, `lost my job`), divorce without children (`uncontested`, `agreed`,
   `flat fee`, `no kids`), divorce with children (divorce together with kids, children or custody), child support and paternity
   (`child support`, `paternity`, `pensión alimenticia`), custody (`custody`, `SAPCR`, `conservatorship`, `fathers rights`, `grandparent`);
4. a generic divorce or family law name (`Divorce lawyer`, `Family Law`, `Divorcio`) → `div_k`, the line whose Campaign Desk headline is the
   generic city divorce lawyer ad. Nothing matched → `unmapped`.

## Row shape

`{src, kind ('ads'|'hour'|'geo'|'lead'|'intake'|'social'), date, hour, campaign, adset, geo {zip, county (FIPS), cname, city, region, gid},
imp, clicks, spend, leads, calls, msgs, conv, retained, value, stage, consult, chan, trk, line, note}`.
Daily rows carry `hour: null`; hourly rows are kind `hour`; `byLine`, `bySource` and pacing read daily rows only; `byHour` reads anything with
an hour except intake; `byZip` and `byCounty` read every row with a ZIP or county. A phone lead counts as a call, a message lead as a lead.
Intake rows add inquiries, consults, retained matters and value but never add to the lead count; cost per lead divides the spend by the
largest of platform conversions, tracked calls and intake records.

## Feedback to the Campaign Desk and the Live Desk

- `ACCT.rates(line, days = 90)` → `{line, days, since, until, cpc, cvr, retain, n, clicks, leads, intake, retained, spend, cpl, cpr, value}`
  for one `LINE_META` key, or every line when `line` is empty or `'all'`. `cpc` (dollars) and `cvr` (percent, 6.0 means 6%) come from
  Google and Microsoft search rows and need 50 clicks (and 3 leads for `cvr`); `retain` (percent) is retained over decided intake inquiries
  and needs 10 (open inquiries younger than 14 days wait), else a generic sheet's retained column. Below a threshold the field is `null`.
  `n` is the leads observed (the larger of platform conversions and intake records).
- `ACCT.applyToModels()` (alias `applyToDesk`) stores the rates that clear their thresholds as `{cpc, cvr, retain, lines: {line: {cpc, cvr,
  retain, n, since}}}`; `ACCT.applied()` returns it or `null`; `ACCT.revertModels()` drops it. Clearing the actuals drops it too.
- `BUS.emit('actuals', {what})` after every change (`what` is `load`, `cfg`, `tokens`, `actuals`, `settings` or `all`).
- The desk plan the module paces against: the last `BUS.emit('plan', {budget, cpc, cvr, retain, lines})` payload (`lines` as
  `{line: {budget}}` or `[{line, budget_month}]`), else the desk's saved settings (`store.get('sev.desk')`), else a budget typed in the module.
- `ACCT.settings().useObserved` and `ACCT.observedGrid()` (7 days by 6 blocks of bid adjustments in percent, from 90 days of hourly rows)
  are offered to the Live Desk timing.

## Clearing

**Clear tokens** drops every token and keeps the settings and the actuals. **Clear all actuals** drops every pulled and imported row, the
import log and the applied desk corrections. Both take two clicks.
