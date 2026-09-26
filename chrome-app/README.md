# Integrity Air · DFW Thermal Debt Atlas — browser app

The atlas as a Chrome and Firefox extension. Same fifteen modules as the single file, plus what only an app can do:

- **Background weather watch.** Every 30 minutes (Options) the app reads the National Weather Service: active alerts touching the twelve counties and the hourly forecast for the headquarters grid (NWS Fort Worth 94,105 over Mesquite). New heat, cold, air quality, severe storm or flood products become desktop notifications with the campaign rule they trigger. The toolbar badge carries today's peak heat index once it reaches 90°F.
- **Popup.** Current conditions, today's peak heat index and the 95°+ window, hours at 95°+ in the next 72, active alerts, a 48 hour heat index strip, and buttons into the Weather Desk and Accounts.
- **Account connectors with sign in.** Module 15 can run the real OAuth flows (Google, Meta, Microsoft Advertising, LinkedIn) because an extension has a registered redirect address and host permissions. Pulls run from the page with the business's own developer credentials; everything stays in the extension's local storage.
- **Live refresh everywhere.** The Weather Desk and Competitor Watch fetch directly; nothing is blocked the way it is inside the Claude viewer.

## Install in Chrome (or Edge, Brave)

1. Unzip this folder somewhere permanent (Chrome loads it from disk every start).
2. Open `chrome://extensions`, turn on **Developer mode** (top right).
3. **Load unpacked** → choose the unzipped folder.
4. Pin the icon. Click it for the popup; **Open the atlas** opens the full app in a tab.

Chrome keeps the extension across restarts. The redirect URL for the provider consoles is `https://<extension id>.chromiumapp.org/` and is shown in Options and in module 15.

## Install in Firefox

Temporary (until Firefox restarts):

1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…** → pick `manifest.json` inside the unzipped folder.

Permanent: Firefox requires signed add-ons. Sign it once with Mozilla's `web-ext` tool (free, unlisted channel, takes minutes):

```
npm install -g web-ext
web-ext sign --channel unlisted --api-key <AMO JWT issuer> --api-secret <AMO JWT secret>
```

(API keys from `addons.mozilla.org/developers/addon/api/key/`.) Install the resulting `.xpi` by opening it in Firefox. Firefox Developer Edition and Nightly can instead set `xpinstall.signatures.required` to false in `about:config`.

**Firefox host permissions are optional by design.** After installing, open the atlas → module 15 → **Grant site access** (or Options → Grant site access) so the background weather check and the connectors can reach `api.weather.gov`, Meta, Google, Microsoft and LinkedIn. The redirect URL for the consoles is `https://<hash>.extensions.allizom.org/`, shown in Options.

## Connect the accounts (module 15)

Each provider needs an app or client created by the business. The cards in module 15 carry the steps; the short version:

| Provider | Where | What to create | Add the redirect URL at |
|---|---|---|---|
| Google (Ads, LSA, YouTube, Business Profile) | console.cloud.google.com | Project; enable Google Ads API, YouTube Analytics API, Business Profile Performance API; OAuth consent screen (Testing, add the account emails as test users); OAuth client ID, **Web application** | Credentials → the client → Authorized redirect URIs |
| Google Ads developer token | ads.google.com → manager account → Tools → API Center | Basic access | — |
| Meta (Marketing API, Page and Instagram insights) | developers.facebook.com | App of type **Business**; add Marketing API and Facebook Login for Business | Facebook Login → Settings → Valid OAuth Redirect URIs |
| Microsoft Advertising | portal.azure.com → App registrations | Application, platform **Single page application** | Authentication → Redirect URIs |
| Microsoft developer token | ads.microsoft.com → Tools → Developer settings | Developer token | — |
| LinkedIn | linkedin.com/developers | App tied to the company Page; request Advertising API and Community Management API | Auth → Authorized redirect URLs |

Development or testing mode is enough to connect the business's own accounts. Accounts outside the app's own business need the provider's review (Meta Advanced Access; Google Basic access for the developer token; LinkedIn partner review). A system user token from Meta Business Manager or a token from Google's OAuth Playground can be pasted into a card instead of running the sign in.

Credentials, tokens and every row of actuals live in the extension's local storage on this machine only. **Clear tokens** and **Clear all actuals** in module 15 remove them.

## Files

```
manifest.json     MV3, Chrome (service_worker) and Firefox (scripts, gecko id)
background.js     30 minute NWS check, notifications, badge
popup.html/js     toolbar popup
options.html/js   forecast point, interval, notification kinds, badge, redirect URL, site access
app.html          the atlas shell (no inline script, per extension CSP)
app.js            all fifteen modules
app.css           styles
atlas-data.js     the ZIP, county, permit, climate and competitor data
nws-snapshot.js   the NWS snapshot from the build (first paint before the live fetch)
icons/            toolbar and store icons
```

## Notes

- Nothing phones home. The only network calls are to the provider APIs the user connects and to NWS and SPC.
- The Site Forge page previews render inside a sandboxed frame; generated pages are meant to be deployed on integrityairconditioning.com, not viewed inside the extension.
- Update: replace the folder's files with a newer build and click **Reload** on `chrome://extensions` (Chrome) or reload the temporary add-on (Firefox). Storage survives the reload.
