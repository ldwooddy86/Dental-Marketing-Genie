# Ad account connectors · setup guide (module 15)

Code: `src/12_accounts_core.js` (the `ACCT` closure), UI: `src/27_m15_accounts.js`, tests: `node tests/run.mjs ads`.
Every credential, token and row of actuals stays in the browser's extension storage. Nothing is sent anywhere but the provider's own API.

**Redirect URL.** Module 15 shows it at the top of the page (`chrome.identity.getRedirectURL()`, of the form
`https://<extension id>.chromiumapp.org/`). Paste that exact string into every provider console listed below. The extension id changes when
the unpacked folder moves, so re-check it after reinstalling.

**Versions.** Google Ads and Meta are probed when you press Test: the first version in the list that answers anything but 404 is stored in
`cfg._ver` and shown on the card ("API v24") and in the source register. TikTok v1.3, Local Services v1, YouTube Analytics v2 and Data v3,
Microsoft v13 and LinkedIn 202509 are fixed.

| Provider | Default | Probe list | Probe call |
|---|---|---|---|
| Google Ads API | v24 | v25, v24, v23 | `GET https://googleads.googleapis.com/{ver}/customers:listAccessibleCustomers` |
| Meta Graph and Marketing API | v26.0 | v27.0, v26.0, v25.0 | `GET https://graph.facebook.com/{ver}/me` |
| TikTok Business API | v1.3 | none | |
| Local Services API | v1 | none | |
| YouTube Analytics / Data | v2 / v3 | none | |

`cfg.apiBase` overrides the host of any provider (regions, sandboxes, the mock servers in the tests).

---

## Google Ads (`google`)

**Console.** console.cloud.google.com: a project with the Google Ads API, Local Services API, YouTube Analytics API, YouTube Data API v3 and
Business Profile Performance API enabled. OAuth consent screen in Internal or Testing mode with the account emails as test users. Credentials:
OAuth client ID of type **Web application**, redirect URI = the module's redirect URL. ads.google.com manager account: API Center, developer token.

**Paste.** Client ID, client secret, developer token, customer ID (digits), optional manager (login) customer ID, optional Business Profile location ID.

**Scopes** (one sign in serves Google Ads, Local Services Ads and YouTube): `https://www.googleapis.com/auth/adwords`,
`https://www.googleapis.com/auth/yt-analytics.readonly`, `https://www.googleapis.com/auth/youtube.readonly`,
`https://www.googleapis.com/auth/business.manage`. Flow: authorization code with PKCE and the client secret, `access_type=offline`,
`prompt=consent`; the refresh token keeps the connection alive.

**Pull.** `POST /{ver}/customers/{cid}/googleAds:search` (GAQL; body `{query}` plus `pageToken`, never `pageSize`, which the API refuses
with `PAGE_SIZE_NOT_SUPPORTED` since v17) three times: campaigns by day, campaigns by day and hour (`segments.hour`,
stored as separate hourly rows), `geographic_view` by postal code. Campaign rows are tagged by `campaign.advertising_channel_type`: `LOCAL_SERVICES`
becomes source `lsa`, `VIDEO` and `DEMAND_GEN` become source `youtube`, everything else `google`. Once the LSA or YouTube card has pulled its own
rows, the Google copies of those campaigns are dropped from the totals so nothing counts twice. Business Profile daily metrics when a location ID is set
(`GET https://businessprofileperformance.googleapis.com/v1/locations/{id}:fetchMultiDailyMetricsTimeSeries?dailyMetrics=...&dailyRange.startDate.year=...`;
`locations/` may be typed in front of the ID). Every provider that goes through the shared JSON helper retries once after an HTTP 429
(`settings.backoffMs`, 2 s by default).

**Limits.** A developer token with Basic access covers this use; a test token only works on test accounts. Google reports that developer tokens
became optional in September 2026; the header is still sent and is harmless. Each major version is retired about a year after release; the probe
moves the module forward without a code change as long as the list holds the current version.

## Local Services Ads (`lsa`, uses the Google sign in)

**Console.** Nothing beyond the Google project above: enable the **Local Services API** there. The API answers only through a **manager account**
that holds the LSA account, so link the LSA account to a manager in ads.google.com if it is not already.

**Paste.** Manager customer ID (digits) and, when the manager holds several LSA accounts, the LSA account's own customer ID (optional; every linked
account otherwise).

**Scope.** `adwords`, granted by the Google sign in. No Connect button; the card says "Uses the Google Ads sign in".

**Pull.**
- `GET https://localservices.googleapis.com/v1/detailedLeadReports:search?query=manager_customer_id:<mcc>&startDate.year=&startDate.month=&startDate.day=&endDate.year=&endDate.month=&endDate.day=&pageSize=1000[&pageToken=]`
  → one `lead` row per lead: date and hour in the account's time zone (`timezone.id`), campaign `LSA <leadCategory>`, ad set = message job type,
  `calls` 1 for `PHONE_CALL`, `msgs` 1 for `MESSAGE`, `conv` 1 and `spend` = `leadPrice` when `chargeStatus` is `CHARGED`, ZIP from the message
  lead's postal code, note with charge status, dispute status and connected call length.
- `GET /v1/accountReports:search?query=manager_customer_id:<mcc>&...` → `LSA account <businessName>` spend rows (source `lsa`, kind `ads`):
  the account's `currentPeriodTotalCost` for the range (the guide's older `adSpend` name is read as a fallback), itemized by charged lead day
  where lead prices are known, with the remainder dated at the end of the range. Weekly budget, rating, review count, phone responsiveness,
  charged leads, phone calls (connected) and impressions go to the pull notes and the Test output. Field names come from the v1 discovery
  document (`localservices-api.json`, revision 20241202): `pageSize` defaults to 1000 and tops out at 10000; `leadId` is deprecated in
  favour of `googleAdsLeadId`.
- Fallback: when the detailed lead call fails, the Google Ads `local_services_lead` report is queried on the LSA customer under the manager
  (`login-customer-id`), and the note says so.

**Limits.** The manager account is mandatory; a plain LSA customer ID returns nothing. The API reports the account's home city, not the lead's,
so ZIPs come only from message leads. `currentPeriodTotalCost` is a period total; that is why the account rows are itemized from charged leads.

## YouTube (`youtube`, uses the Google sign in)

**Console.** YouTube Analytics API and YouTube Data API v3 enabled on the Google project. Sign in on the Google card with the account that owns
or manages the channel.

**Paste.** Channel ID (optional; `channel==MINE` otherwise).

**Scopes.** `yt-analytics.readonly` and `youtube.readonly`, granted by the Google sign in.

**Pull.**
- `GET https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate&endDate&metrics=views,estimatedMinutesWatched,subscribersGained,likes,comments,shares&dimensions=day&sort=day`
  → one `social` row per day and metric.
- `...&metrics=views,estimatedMinutesWatched,likes&dimensions=video&sort=-views&maxResults=25` → top videos, named through
  `GET https://www.googleapis.com/youtube/v3/videos?part=snippet&id=a,b,c` (campaign = title, ad set = video id).
- `GET https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true` → subscriber, view and video counts.
- Paid: the Google Ads GAQL query restricted to `campaign.advertising_channel_type IN ('VIDEO', 'DEMAND_GEN')` by day and by hour, as source
  `youtube`, kind `ads` and `hour`. Skipped, with a note, when the Google card has no customer ID; the organic pull still runs.

**Limits.** Video reports require `sort` and `maxResults` of 200 or less. Analytics data lags about two days.

## Meta (`meta`)

**Console.** developers.facebook.com: a Business type app with Marketing API and Facebook Login for Business; the redirect URL under Valid OAuth
Redirect URIs. Development mode connects the app's own admins, developers and testers; other businesses need Advanced Access for `ads_read` and the
insights permissions.

**Paste.** App ID, app secret (optional), Facebook Login for Business configuration ID (required when the app uses the Login for Business product: Facebook Login for Business, Configurations, create one with the permissions below and copy its ID), ad account ID (`act_` and digits), Page ID, Instagram business account ID (optional).

**Scopes.** `ads_read, read_insights, pages_read_engagement, pages_show_list, instagram_basic, instagram_manage_insights, business_management`.
Flow: `https://www.facebook.com/{ver}/dialog/oauth` with `response_type=token`; with a configuration ID the dialog also carries `config_id` and `override_default_response_type=true` so it answers with a token; if it answers with a code anyway, the code is redeemed at `GET /{ver}/oauth/access_token?client_id&redirect_uri&client_secret&code` (needs the app secret). With the app secret the one hour token is exchanged for a 60 day
token: `GET /{ver}/oauth/access_token?grant_type=fb_exchange_token&client_id&client_secret&fb_exchange_token`. A system user token from Business
Manager can be pasted instead.

**Pull.** `/{ver}/act_<id>/insights` at ad set level by day (`time_increment=1`), at campaign level with the
`hourly_stats_aggregated_by_advertiser_time_zone` and `region` breakdowns; Page and Instagram insights when their IDs are set. `paging.next` is
followed up to 50 pages; a failure after the first page keeps what was read and notes it. Rate limit errors (codes 4, 17, 32, 613, or HTTP 429)
are retried once after `cfg.backoffMs` (30 s by default).

**Limits.** Region and DMA only, no ZIP. Hourly rows are aggregated over the range and dated at its end. Meta retired the Page reach metric in
mid 2026; if `page_impressions_unique` stops answering, the Page insights call notes it and the ads pull is unaffected.

## TikTok Ads (`tiktok`)

**Console.** business-api.tiktok.com/portal: create a developer app for the Marketing API with the Ads Management (read) and Reporting scopes.
App settings: **Advertiser redirect URL** = the module's redirect URL.

**Paste.** App ID, app secret, advertiser ID (optional; the first ad account the user authorizes is stored automatically, Test lists them all).

**Flow.** Authorize at `https://business-api.tiktok.com/portal/auth?app_id=&state=&redirect_uri=`; the callback carries `auth_code` and `state`;
`POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/` with JSON `{app_id, secret, auth_code}` returns `data.access_token`
and `data.advertiser_ids`. Every later call sends the `Access-Token` header. Advertiser tokens are long lived (no expiry, no refresh; they stop when
revoked in the portal); should TikTok ever return `expires_in` and `refresh_token`, the module honours them through `/oauth2/refresh_token/`.

**Test.** `GET /open_api/v1.3/oauth2/advertiser/get/?app_id=&secret=` → `data.list[{advertiser_id, advertiser_name}]`.

**Pull.** `GET /open_api/v1.3/report/integrated/get/` with `advertiser_id, report_type=BASIC, data_level=AUCTION_CAMPAIGN,
dimensions=["campaign_id","stat_time_day"], metrics=["campaign_name","spend","impressions","clicks","conversion","cost_per_conversion","cpc","ctr"],
start_date, end_date, page_size=1000, page`, paged through `data.page_info.total_page`; a second run with `stat_time_hour` gives the hourly rows.
Rows: source `tiktok`, date from `stat_time_day`, hour from `stat_time_hour`, leads and conversions = `conversion`. Every body has `code`
(0 is success) and `message`; anything else is raised as `TikTok <code>: <message>`.

**Limits.** Reports accept at most 30 days per request, so the module splits the range into 30 day windows (a 60 day sync is two requests per
report; TikTok's range is counted inclusively, so "60 days" is exactly 60). Only auction campaigns; reservation campaigns need another data level.
No geography below the ad account.

## Microsoft Advertising (`microsoft`) and LinkedIn (`linkedin`)

Microsoft uses the authorization code flow with PKCE against `login.microsoftonline.com`. Known limit: Microsoft Entra only redeems a code cross-origin for Single-page application registrations whose registered origin matches the request, and a browser extension's requests carry a `chrome-extension://` origin, so the redemption can fail with `AADSTS9002326`; the card then says so and accepts a pasted token (obtain one with the Microsoft Advertising OAuth sample or the Bing Ads SDK on your machine). Then
`POST https://reporting.api.bingads.microsoft.com/Reporting/v13/GenerateReport/Submit` with
`{ReportRequest: {Type: 'CampaignPerformanceReportRequest', Format: 'Csv', Aggregation: 'Hourly', Columns, Scope: {AccountIds}, Time}}`,
`.../GenerateReport/Poll` with `{ReportRequestId}` until `ReportRequestStatus.Status` is `Success`, then the `ReportDownloadUrl` (a zipped CSV,
unpacked in the page, one `hour` row per line and a folded `ads` row per day and campaign). Headers: `Authorization`, `DeveloperToken`,
`CustomerId`, `CustomerAccountId`. Test: `POST https://clientcenter.api.bingads.microsoft.com/CustomerManagement/v13/User/Query` `{UserId: null}`.
LinkedIn uses the authorization code flow with the client secret, then `GET /rest/adAnalytics?q=analytics&pivot=CAMPAIGN&timeGranularity=DAILY&dateRange=(start:(year,month,day),end:(...))&accounts=List(urn:li:sponsoredAccount:<id>)&fields=...`
(`LinkedIn-Version: 202509`, `X-Restli-Protocol-Version: 2.0.0`) and `GET /rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:<id>`.
Test: `GET /rest/adAccounts?q=search`. Both honour `cfg.apiBase` (Microsoft also `cfg.ccBase` for the customer management host) and both
are covered by `tests/ads.test.mjs` against mock servers, including the zipped CSV and the 429 retry.

---

## Imports (no credentials)

| Format | Detected by | Notes |
|---|---|---|
| Google Ads report | `Campaign` + `Cost` + a `Day`/`Week`/`Month` column | hour of day report gives hourly rows |
| Meta Ads Manager | `Campaign name` + `Amount spent` | time of day breakdown optional |
| TikTok Ads Manager | `Campaign name` + `Cost` (custom report by day: `Date`, `Impressions`, `Clicks (destination)`, `Conversions`) | |
| Microsoft Advertising | `CampaignName` or `Campaign name` + `Spend` | |
| LSA leads export | a `lead` column + `Job type` or `Lead type` | |
| YouTube Studio | `Video title` (Table data.csv) or `Date` + `Views` (Chart data.csv) | rows without a date take today's date |
| Call tracking | `Start time` + `Source` | |
| Generic | `date` + `spend` or `cost` | template from the module |

## Row shape

`{src, kind ('ads'|'hour'|'geo'|'lead'|'social'), date, hour, campaign, adset, geo {zip|region|gid}, imp, clicks, spend, leads, calls, msgs, conv, line, note}`.
Daily rows carry `hour: null`; hourly rows are kind `hour`; `byLine` and pacing read daily rows only, `byHour` reads anything with an hour,
`byZip` reads geo rows and LSA leads with a postal code. Lead rows count once: a phone lead is a call, a message lead is a lead.
