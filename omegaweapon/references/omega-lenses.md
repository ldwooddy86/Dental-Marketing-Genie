# The three lenses: client, agency, market

OmegaWeapon reads any domain three ways, at once, and the dashboard holds all three. The first two come from the
UltimaWeapon lineage; the third is Horus's method turned on a single company. Measurement and judgment never blur:
counts, shares, gaps and grades come from code; likelihoods, stages and moves are judgments in ICD 203 language with the
observation that would prove each one wrong.

## Lens 1: the client (what the business is doing)

Every surface the business shows the public, read in the Reckoning's order and graded on the twelve pillars: the site
and its crawlability (Google Crawl, Ironclad), content and top pages, local (Ground War), authority and links, the
competitive set, paid (War Chest), social (Megaphone), AI visibility (Oracle), apps (Handset), compliance and exposure
(Satchel and Codex), the agency fit and the market position. The doctrine for each is the reference the router names;
this file adds nothing to those protocols. What it adds is the rule that the client lens is never delivered alone: a
technical audit without the agency lens hides who shipped the defects, and without the market lens it cannot say whether
customers noticed.

## Lens 2: the agency (what the digital marketing company behind it is doing)

Nearly every site the Weapon audits was built or is run by an agency, and an agency's product is public claims.
`omega-agency-lens.md` carries the protocol: identify the agency of record from the footer credit, the RDAP registrant
and the shared tag stack; split every High and Medium finding into inherited (the template, the container, the schema
block, the hosting) and owned (the client's own decisions); screen the agency's claims on its own site; list the
measurement layer it shares across clients; read its outreach infrastructure; run Justice on its book when the target
is an agency; and test what it sells against what the practitioner floor says works, using the digital marketing nome's
latest edition. The Agency Fit pillar is graded from the inherited share.

## Lens 3: the market (what customers and the industry are saying)

Horus reads an industry with two eyes: the Sun eye is the broadcast (trade press, platform blogs), the Moon eye is the
practitioner floor (forums, subreddits, Telegram, Discord). OmegaWeapon keeps that industry read (the nome matching the
archetype, `assets/nomes.json`: Horus's ten media packs plus twelve client vertical packs) and adds a read at the scale
of one business, the **Brand Stereopsis**.

### Brand Stereopsis

Two frames, defined before anything is read, so the counts mean something:

- **Sun frame, the brand's own voice:** homepage and money pages (the raw fetcher's text), the blog or news hub's latest
  20 posts, press the brand links to, social bios and pinned posts (screenshots), GBP posts and Q&A (screenshots), ad copy
  from library screenshots or the client's exports, app store descriptions. One claim, post or paragraph is one item.
- **Moon frame, the floor talking about the brand:** Google reviews (screenshots or the client's GBP export; the panel is
  not fetchable), Yelp, Trustpilot, BBB, Angi, Avvo, Healthgrades, G2 or the vertical's review site (screenshots or
  exports), App Store review RSS (fetchable) and Play reviews (screenshots), Reddit, forum and Q&A threads naming the brand
  (search snippets and titles only), CFPB complaint rows for the company (public endpoint), Glassdoor and Indeed employer
  reviews (screenshots), marketplace Q&A and seller feedback. One review or thread is one item. A platform's aggregate
  count is a Nilometer signal, not an item.

Every counted item gets a topic from `assets/brand_topics.json` (B01 service quality, B02 price and billing, B03 speed
and responsiveness, B04 people, B05 credentials and trust, B06 availability, B07 process friction, B08 communication,
B09 promises, B10 reputation talk, B11 offers, B12 product, B13 digital experience, B14 disputes and compliance, B15
workplace, B16 other), an optional topic2, an intent (Q question, C complaint, R result, H how-to, N news, D debate, P
promotion, J jobs, O other), a stance from the customer's point of view (-1, 0, 1) and flags (set for spam and
self-promotion, kept but not counted; grey for tactics that break a platform rule). Code from the item itself. Reviewer
and poster names are never recorded; the validator refuses an author field.

`omega_metrics.py` computes, for each topic, the weighted log-odds gap between the floor and the brand (Monroe, Colaresi
and Quinn 2008; the formula is on the Method tab), the z-score and the class: floor-led or broadcast-led beyond ±1.96,
leaning between 1.0 and 1.96, balanced below 1.0, floor-only or broadcast-only when one eye is empty and the other has
at least 2 (floor) or 3 (brand) items. It also computes pain per topic (the share of floor items that are questions or
complaints), stance per eye, the complaint share and the cluster shares. Minimums are 20 brand items and 15 floor items;
below them the tab still renders, the counts show beside every share, and the coverage strip says the read is thin.

Reading the gap:

| Class | Meaning | The move |
|---|---|---|
| floor-led or floor-only | customers raise it far more than the brand does: pain the site never addresses, or a strength it fails to claim | a page, a FAQ, an SOP; the fastest reputation lever there is |
| broadcast-led or broadcast-only | the brand leads on something customers never echo: an unproven talking point, or a message not landing | substantiate before repeating it in ads; the Satchel's claims screen often lands here |
| balanced | settled ground | keep it |

The Market Position pillar is graded from the Moon eye's complaint share and stance (`assets/grading.json`). It is the
only pillar graded from what the world says rather than from what the site does.

### The company Nilometer

Egypt read the flood on a graded stair, not by the mood on the riverbank. A business has hard signals of its own and
they go in `modules.market.nilometer[]` with Admiralty grades (A to F reliability, 1 to 6 credibility, `horus-nilometer.md`):
review counts and ratings across platforms (B2 from screenshots; A2 from the client's own export), review velocity
(inferred from dated reviews, say so), Autocomplete presence (B2, presence and ordering only), GSC impressions and clicks
(A1 when exported), GA4 sessions and key events (A1), ad-library captures (B2 for the fact of an ad on a date), store
ratings and counts (A2 from the RSS or console), CFPB complaint rows (A1 for the fact of a complaint), job postings
(B2), filings and licenses (A1), the industry edition's signals that bear on this business (their own grades). One strong
primary number beats five blog restatements; prefer the export to the screenshot and the screenshot to the search
snippet.

### The industry read

The archetype names the nome (`assets/archetypes.json`); the ingest attaches the latest edition of that nome from
`assets/editions/` (the digital marketing nome ships a complete first edition; the vertical packs start empty and grow as
editions are run with the Horus engine: `horus_scaffold.py`, code the ledger, `horus_kappa.py`, `horus_metrics.py`,
`horus_validate.py`, `horus_build.py`). The Market tab shows the loudest topics per eye, the industry Stereopsis, the
signals used, and the edition note. Running a fresh industry edition is its own job (the Horus run in
`horus-collection.md`); a domain run does not require it, and says when it used an older edition.

## Forecasting a business

The Forecast tab holds the analysis of record (`horus-analysis.md` applies): key judgments about where this business's
digital position goes over 30, 60 and 90 days, each with ICD 203 likelihood and range, a confidence word grading the
evidence separately, a horizon, evidence refs (finding ids, N.. signals, metrics:.. refs; at least one hard signal or
metric) and a falsifier; a scenario square built on the two uncertainties that matter most and are least predictable
(usually a rival's move and the client's fix timing); indicators with the reading that would move a judgment and when
the next reading lands; the 64th part (what cannot be measured: whether Google indexed a URL, rival budgets, in-app
runtime); and moves tied to the judgments that justify them.

The graveyard applies to marketing prophecies: half of all searches by voice by 2020, the cookieless future, AI Overviews
will end local clicks. Platform-announced, default-on, platform-benefiting and silent on the floor is the shape that has
failed before; randomised evidence plus a billion-user surface is not. Before a key judgment endorses a platform's
prophecy about the client's traffic, the graveyard test says which shape it has.

From the second run on, score the last run's judgments first (confirmed, holding, weakened, falsified, too early) and
record it; a forecast nobody scores is a horoscope.

## What the three lenses change in the delivery

The Brief's three that matter (the one rival, the one paid opportunity, the one exposure) come from the client lens. The
headline usually comes from the market lens (what customers noticed) meeting the client lens (what caused it). The
agency lens decides who owns each fix and whether a reverse Justice run is worth offering. A delivery that cannot say
which of the three lenses produced each of its top findings has not finished.
