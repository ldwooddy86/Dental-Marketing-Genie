OmegaWeapon  (Chrome extension, Manifest V3, version 2.0.0)
========================================================================

What it is
  One offline app with four wings:
    Agency Radar   222 US and European digital marketing agencies, each read through the Horus digital-marketing
                   edition (tailwind index, Solar Arc, scenario fit, money rails, moves, say and do), and each with an
                   Anubis dossier: what it is doing and focusing on (the sold mix with its evidence, the moves), its
                   clients and what the evidence says they came for (the need read per client, the clients that also
                   buy elsewhere), its own house, the market read, where it can be beaten (with a falsifier each), what
                   to watch. The computed spine is on every agency; the written weighing is on the most prominent and
                   says so where it is not yet written. Download MD exports one dossier as markdown.
    Horus          the edition itself: key judgments, discourse findings, Stereopsis, the Nilometer, scenarios, indicators.
    Offshore       the Monsoon read on every agency: how much of its sold work can be delivered from an offshore hub over
                   three years, which mechanism (its own migration or displacement by an offshore-delivered rival), where
                   the work would go (South and Southeast Asia first), what its own record shows, and the hub economies'
                   hard numbers. Every table is published on the view; every inferred line says so.
    Targets        every OmegaWeapon run: one dashboard per domain, hosted whole, with the agency that built the site
                   matched to its Radar dossier, momentum across runs, and the queue that feeds the next run.
  Every byte of data ships inside the extension; its content security policy forbids network connections from its pages.

Install (about a minute)
  1. Unzip omegaweapon-chrome.zip. Keep the folder somewhere permanent.
  2. In Chrome open chrome://extensions and switch on Developer mode (top right).
  3. Click "Load unpacked" and choose the omegaweapon-chrome folder (the one with manifest.json).
  4. Pin it: puzzle-piece icon in the toolbar, then the pin next to OmegaWeapon.
  The app opens in a new tab after install.
  Upgrading from Agency Radar: replace the contents of the old agency-radar-horus folder with this folder's contents and
  click the reload arrow on the extension card. The extension id stays the same, so the watchlist and notes carry over.

Ways in
  Toolbar icon or Alt+Shift+R   popup: the current site's read (a tracked agency's Horus read, an audited target's
                                grades, or a queue button for any other site), search, side panel, watch
  Alt+Shift+D                   the full app in a tab;  Alt+Shift+T  the Targets wing
  Address bar                   type omega, a space, then a target, an agency name or a domain
  Right-click                   "Look up this site / link / selection in OmegaWeapon", "Queue this site for the Omega"
  Side panel                    compact dossier beside any page; from the popup's "Side panel" button

Bringing runs in
  The skill builds the app with the latest runs baked in (python3 scripts/omega_platform.py pack, then build-app).
  Or open the Targets wing and import an omega-<domain>.html page or an omega-pack.json; imported targets persist in
  this Chrome profile. A run manifest is not a built page: pack it first.

The queue
  Queue a site from the popup, the right-click menu, or the Targets wing. Export the queue (omega-queue.json) and hand it
  to the skill: python3 scripts/omega_platform.py queue --file omega-queue.json --run

Optional auto-detect
  Off by default. Switching it on in the popup asks Chrome for the "tabs" permission, which lets the extension see tab
  addresses. With it on, the toolbar badge shows a tracked agency's tailwind score or a target's overall grade as you
  browse, and the side panel follows the active tab. Switch it off in the popup to hand the permission back.

Permissions used
  storage, unlimitedStorage   watchlist, notes, compare set, theme, the queue; imported targets (IndexedDB), this profile only
  activeTab                   read the current tab's address only when you open the popup or use a right-click lookup
  sidePanel                   the side panel view
  contextMenus                the right-click lookups and queueing
  tabs                        optional, only if you switch on auto-detect

Updating
  When the Radar, a new Horus edition or new targets are rebuilt, replace the folder contents and click the reload arrow
  on the extension card in chrome://extensions. Your watchlist, notes, queue and imported targets persist.

Files
  app.html / sidepanel.html / popup.html   pages;  js/data.js  the Radar;  js/targets.js  the hosted runs
  js/app.js  the app;  js/omega-dashboard.js + css/omega.css + omega-frame.html  the dashboard engine the frame runs
  background.js  service worker;  css/fonts  IBM Plex and Zilla Slab (SIL OFL)

Data: the Radar is compiled from public sources (agency sites, sitemaps, Google Ads Transparency Center, LinkedIn Ad
Library, public case studies and social channels); ad counts are floors from first-page captures; client lists reflect
agency-published case studies and logo walls. A target's numbers are computed from its run manifest by the OmegaWeapon
engine; nothing on a target page is a guarantee of any outcome.
