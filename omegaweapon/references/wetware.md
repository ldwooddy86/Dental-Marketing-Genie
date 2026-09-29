# WETWARE — the human-presence layer (the OPT-IN persona lane; read before any `--legacy-persona` run)

**UltimaWeapon defaults to honest mode.** Out of the box every fetcher identifies itself truthfully (`UW_USER_AGENT` /
`--ua`, a plain Python transport, robots.txt obeyed, per-host rate limit with `Crawl-delay` and `Retry-After` honored,
a conditional on-disk cache) and the Presence line reads **DECLARED** — see the Articles in SKILL.md. Everything below
describes the *legacy human-presence persona*, reachable per run only with `--legacy-persona` (alias `--persona`) when the
user explicitly asks for it, shipped unchanged from MagnumOpus and never extended: no proxies, no IP rotation, no CAPTCHA or
WAF-challenge bypass exist in either mode, and the Google Crawl (`google_crawler.py`) never runs behind the persona. The
cloaking diff's Googlebot/AdsBot arms exist only under `--legacy-persona --cloak`, against the target's own pages, as a
stated judgment call. A wall met in either mode is NOT_TESTED, never worked around.

In a persona run, every request UltimaWeapon makes to a target, rival, agency, directory or store page goes out wearing wetware. The
old posture ("a standard browser UA, one request per second") announced itself three ways at once — a UA with no
header family around it, a Python TLS hello from a datacenter block, and a metronome cadence with no cookies, no
referer and no assets. Wetware closes every channel this process controls and measures the ones it does not, so
the report can say exactly what the target saw.

## What a target sees, channel by channel

| Channel | What gives a bot away | What wetware sends | Cloud (H1) | Operator's machine (H2) |
|---|---|---|---|---|
| User-Agent | `python-requests`, `curl`, a stale Chrome, `HeadlessChrome`, any tool name | one Chromium-family persona per target cache: Chrome on Windows 11 / Windows 10 / macOS, or Edge on Windows; the major derived from today's date the way auto-update lag distributes real traffic (current 70 %, previous 24 %, previous-2 6 %) | human | human |
| Header family | UA alone; missing `sec-ch-ua`, `Sec-Fetch-*`, `Upgrade-Insecure-Requests`; wrong `Accept`; `Connection: close`; Python's header order | Chrome's full navigation, stylesheet, script, image and fetch header sets in Chrome's order, `sec-ch-ua` computed with Chrome's own GREASE-brand algorithm for that major (the "Not?A_Brand" string, its version and the brand ORDER are all functions of the major), `Accept-Encoding: gzip, deflate, br, zstd`, keep-alive | human (the egress proxy re-serialises them, order and casing become its own) | human, in Chrome's order |
| Session | no cookies, every request a stranger | a cookie jar and persona that persist in `omega_cache/<target>/wetware/` across runs — a re-run is the same returning visitor, whose browser "auto-updated" if a release cycle passed | human | human |
| Navigation story | no Referer; deep pages hit cold; `Sec-Fetch-Site: none` on everything | the first hit on a host arrives from Google (`Referer: https://www.google.com/`, `cross-site`, 65 %) or a typed URL (35 %); every later page carries the previous page as Referer with `same-origin`; robots.txt and sitemaps are typed URLs | human | human |
| Assets | a document fetch with no favicon, CSS or JS behind it (the log-analysis tell) | after each RAW page: the favicon once per host, then up to two first-party stylesheets/scripts from `<head>` with `Sec-Fetch-Dest: style/script` and the page as Referer | human | human |
| Pacing | one request per second, forever | log-normal reading time between pages (median ~6 s, 2–28 s, a 5 % chance of a 25–60 s distraction); `brisk` (median ~2.5 s) for sitemap-heavy inventories; assets follow the page within half a second; public endpoints get 1–2.5 s | human | human |
| TLS hello + HTTP version | OpenSSL cipher lists, no GREASE, no ALPS, HTTP/1.1 | `curl_cffi` impersonating current Chrome (BoringSSL hello, GREASE, ALPN/ALPS, Chrome's HTTP/2 SETTINGS and pseudo-header order) | **not ours**: the workspace egress re-terminates TLS and speaks its own hello and HTTP/1.1 to the origin | Chrome's, verified by the self-test |
| IP reputation | datacenter / cloud / AI-company blocks | nothing to send; only the vantage decides | **not ours**: the egress block is registered to Anthropic, PBC (the self-test prints the registrant) | residential |
| JS surface (renders) | `navigator.webdriver`, `HeadlessChrome` brand in `userAgentData`, 0 plugins, SwiftShader WebGL, 2 cores, `Notification.permission: denied`, `outerHeight == innerHeight`, `canPlayType('h264') == ''` | the real Chromium in its new headless mode (the full binary, not the headless shell), automation flag off, CDP client-hint metadata matching the UA, a screen/viewport/DPR/timezone/hardware/WebGL story that agrees with the persona, retail-Chrome codec answers, mouse travel and stepped scrolling after load | human (all green on the classic headless-detection page) | human |
| Residual render tell | the CDP session itself (DataDome-class scripts detect `Runtime.enable` side effects) | nothing — the probe is three pages per target, not a crawl; a wall on a render is NOT_TESTED like any other | residual | residual |

**Presence tiers (measured, never assumed).** The self-test fetches a fingerprint echo through the session and
records what the origin saw: the IP and its RDAP registrant, the JA4, the HTTP version, whether GREASE and ALPN
survived. **H2 residential** — the impersonated Chrome hello reached the origin (operator's machine, or a device
bridge shell on it): indistinguishable from a desktop visitor at every layer this skill can see. **H1 cloud** —
the hello was re-terminated upstream: identity, session, navigation story, assets, pacing and the JS surface are
human; the transport and the network are the workspace's, so JA4-scoring bot management (Cloudflare Bot
Management, Akamai, DataDome, PerimeterX) and ASN-reputation rules can still classify the session as automated.
**H0 degraded** — `curl_cffi` missing, urllib fallback: headers, session and behavior human; Python's TLS hello.
The tier and the self-test JSON go in Scope & Data Integrity verbatim (`wetware.py --report <cache>` prints the
paragraph). A wall met at H1 is reported as "blocked while presenting as a human browser from a cloud vantage" and
becomes a local-pull line, never a retry with a different disguise.

## Commands

```bash
pip install -q curl_cffi brotli zstandard          # persona runs only; honest mode needs the standard library (brotli/zstandard optional); without curl_cffi a persona run degrades to H0 and says so
python3 scripts/justice_fetch.py --selftest --cache omega_cache/<t>      # honest: the DECLARED line; with --legacy-persona: persona + header echo + fingerprint echo + tier
python3 scripts/wetware.py --persona omega_cache/<t> [--new]            # show (or roll) the visitor bound to this target
python3 scripts/wetware.py --report omega_cache/<t>                     # the Data Integrity paragraph + fetch counts
# every fetcher takes --cache <dir> (default: the parent of --out), --tempo human|brisk, --no-assets, --locale xx-XX
python3 scripts/justice_fetch.py --robots --out omega_cache/<t>/html <urls>
python3 scripts/satchel_web.py scan [--cloak] --out omega_cache/<t>/web <urls>
python3 scripts/satchel_render.py --out omega_cache/<t>/render [--locale de-DE] <urls>
```

Everything in `scripts/` imports `wetware.py` from its own folder, so the local pull is unchanged: copy `scripts/`,
`pip install curl_cffi`, run the same commands, zip `omega_cache/` back. On the operator's machine the
self-test should print **H2**; if it prints H1 there, a corporate proxy or VPN is re-terminating TLS and the
report says so.

## Rules that do not move

- **A human CAPTCHA is a stop.** Turnstile checkbox, hCaptcha, reCAPTCHA, "verify you are human": nothing is
  clicked, typed or solved; the URL is NOT_TESTED and the wall is a finding (real customers on that network class
  meet it too). A JavaScript challenge that settles on its own inside the render's wait is a normal load.
- **No proxies, no IP rotation, no residential networks, no mirrors, no caches, no archives as a bypass.** The
  vantage is the workspace or the operator's own machine, and the report names which.
- **No borrowed sessions.** The cookie jar is the run's own; a real person's cookies, logins or exported browser
  profile are never replayed. No login walls, no paywalls.
- **The cloaking diff is the only non-human request, and it is opt-in.** `--cloak` sends one Googlebot and one
  AdsBot-Google request per page, against the target's own pages only, after the human fetch of that page (which
  it reuses as the browser arm). The judgment-call block says the diff ran; a fake-Googlebot log line is exactly
  what a WAF watches for, so it runs last and only when the question is cloaking.
- **Tempo is not a throttle to switch off.** `brisk` exists for sitemap-heavy inventories; there is no fixed
  interval and no parallel fan-out, from any script or any subagent. The fetch cap (~40–60 pages) still applies;
  asset footprints do not count against it.
- **Nothing self-identifies.** No tool name in any UA, header, query string or Lighthouse run; the PSI API call
  carries the persona; local Lighthouse runs with the persona's UA and the automation flag off (PSI's own Lighthouse
  run is Google's fetch of the target, not this workspace's, and is labeled that way).
- **The sanctioned fetcher is not wetware.** It identifies as what it is. It is reserved for the rule corpus
  (statutes, platform policies, licensing portals), search-surfaced discovery, and the labeled last resort when the
  wetware engine cannot run; a target, rival, agency or store page read through it is logged in Data Integrity as
  a non-human fetch.
- **Brand neutrality is untouched.** The persona is a generic retail browser; no operator name enters any header,
  cookie, screenshot or metadata. `brand_sweep.py` still gates every file.

## Where the device bridge fits

A shell on the operator's own computer (the desktop app's device bridge) is not a connector: it is the operator's
own machine, and running the bundled scripts there is the local pull, automated. When one is present in the
session, the run copies `scripts/` there, runs the fetch phases from it and reads the cache back — presence H2,
residential IP, Chrome's hello — and says so in the judgment-call block, because each bridge call may prompt for
approval. Absent the bridge, the run stays in the workspace at H1 and offers the manual local pull for anything
that walled.

## Persona and version model (why the numbers look the way they do)

Chrome ships a major about every 31.5 days (thirteen releases a year minus two skipped cycles); the persona anchors
131 to 2024-11-12, never claims a major older than the TLS profile it impersonates with, and can be pinned with
`WETWARE_CHROME_MAJOR=<n>` when a run must match a known fleet. Full versions are synthesised on Chrome's build
cadence (~63 builds per major) for the high-entropy hint list. Windows personas report Win32, platformVersion
15.0.0 (Windows 11) or 10.0.0, 8–16 cores, 8 GB, an Intel/NVIDIA/AMD ANGLE D3D11 renderer and a 1920×1080-class
screen with a 48 px taskbar; macOS personas report MacIntel, an Apple-silicon Metal renderer, DPR 2 and a
MacBook-class screen with a 25 px menu bar. Viewport = screen minus 87 px of browser chrome minus the OS bar, so
`outerHeight`, `availHeight`, `innerHeight` and the screenshot all agree. Timezone follows the locale (US personas
spread across the four mainland zones; `de-DE` → Europe/Berlin, `en-GB` → Europe/London, and so on) and
Accept-Language is derived from the locale list exactly as Chrome derives it. `WETWARE_FAMILY=chrome-mac|edge-win|
chrome-win|chrome-win10` fixes the family for a run.
