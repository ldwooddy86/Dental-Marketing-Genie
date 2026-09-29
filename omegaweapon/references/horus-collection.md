# Collection playbook

Two modes feed the same ledger. **First light** is a web sweep that needs no credentials and can run
in any session. **Collector mode** uses the bundled read-only collector on the operator's machine,
with the operator's own API keys and accounts. Every edition says which mode produced it.

## First light (web sweep)

### 0. Scaffold

```
python scripts/horus_scaffold.py --nome <nome> --run-date YYYY-MM-DD
```

Read the nome's taxonomy, seeds and standing questions in `assets/nomes.json`. Seeds are leads to
verify, never guarantees that a channel is live.

### 1. Define the sampling frames before reading anything

A frame is a defined population you will read in full, so the counts mean something:

- **Sun frame**: the listing or archive pages of 3 to 6 trade publications for a fixed window
  (7 to 25 days), plus any daily recap or curated-links page the industry reads, plus agency roundups
  and platform blogs. Aim for 100 or more broadcast items.
- **Moon frame**: the newest threads on 1 to 3 practitioner forums or subreddits, the latest posts of
  1 to 3 practitioner Telegram channels, and practitioner posts that a newsletter curates. Aim for 50
  or more floor items; say plainly when you fall short.
- **Room frame**: directory listings for Discord (disboard tags, discord.me tags) and Telegram (TGStat
  categories, tgram.io lists) for the nome's tags, snapshot on the run date.

Write the frames into `window` in the ledger before coding.

### 2. The counting rule

Only items read from a defined listing or channel page count toward share of voice. Results of topical
web searches are evidence for the analysis (and belong in the Nilometer or the analysis refs), never
in the counted ledger. Mixing them would let the analyst's curiosity set the agenda the metrics claim
to measure.

### 3. Reading pages

- Search first, then fetch: many fetch tools only open URLs that appeared in an earlier search result.
- Fetch serially and sparingly. Never fan out dozens of parallel fetches or subagents; the operator
  does not want a flood of permission prompts, and a sweep rarely needs more than 20 to 40 pages.
- If a site blocks the fetcher (Reddit often does), do not go around it with mirrors, caches,
  archive copies or alternate front-ends. Mark the lane blocked, use search snippets only as
  evidence, and move the lane to collector mode.
- If a directory blocks bots (disboard sometimes does), use the listing text visible in search results
  for the census and say so.

### 4. Record every item

One ledger item per thread, post, article or message, with: `eye`, `lane`, `platform`, `community`,
`date` (mark `date_approx` when only the month is known), `title` (the thread or headline text, in
English; translate and say so in the title if needed), `url` (the item's own permalink when there is
one, else the listing page), and engagement you can see (`replies`, `views`, `comments`).

Floor authors are never recorded. Communities that are people (a named practitioner's posts) are
recorded by role, not name. Public figures speaking for a platform (a search liaison, a company
account) may be named in the broadcast eye.

### 5. Census the rooms

One room entry per server or channel: `name`, `size` (members or subscribers when shown, else null),
`size_kind`, `lang`, `topic` (what it is built around), `topic2`, `flags` (`set` for engagement or
follower sellers, promotion servers; `grey` for grey tactics), `note` (the directory's own tags or
description, short), `url` (the directory page it came from). Rooms named after people are recorded
by their public channel name only.

### 6. Pull the Nilometer

For each standing question of the nome, find the hard numbers: the latest earnings, forecasts,
surveys, experiments, rulings. Record them in `X.signals.json` with Admiralty grades (NILOMETER.md),
plus dated `events` behind the judgments and a `watch_calendar` of readings ahead.

### 7. Code, measure, judge, build

Prefilter if the items came from the collector, then code by hand (CODEBOOK.md), run the reliability
check, compute metrics, write the analysis of record (ANALYSIS.md), validate, build, verify.

## Collector mode

The collector lives in `collector/`. It runs on the operator's machine, reads through official APIs and
the operator's own accounts, stores everything in local SQLite, pseudonymizes floor authors, and never
posts, joins, reacts, votes or follows. Setup per lane is in CONNECTORS.md.

```
cd collector
python -m horus_collector init --nome <nome>
python -m horus_collector discover --nome <nome>        # find trade-press feeds
python -m horus_collector check
python -m horus_collector collect
python -m horus_collector recheck reddit                  # weekly: purge posts deleted at the source
python -m horus_collector export --since YYYY-MM-DD --until YYYY-MM-DD --out raw.jsonl
cd ..
python scripts/horus_prefilter.py --nome <nome> --raw collector/raw.jsonl --out candidates.json --window YYYY-MM-DD:YYYY-MM-DD
```

The prefilter drops duplicates and items outside the window, caps any one floor author at five items,
and suggests topics and flags. Suggestions are a head start; every item is still read and coded by
hand before it enters the ledger. With the collector running on a schedule, sample the stored items
(random, stratified by lane) rather than coding thousands; state the sampling in the limitations.

## Platform notes (as of 2026; verify at run time)

| Platform | First light | Collector route |
|---|---|---|
| Reddit | Usually blocked for fetchers; search snippets only | Official Data API, script app, truthful User-Agent, weekly deletion recheck |
| Telegram | Public channels have web previews at t.me/s/<name>; TGStat for the census | Your own account through Telethon; or a bot added as admin |
| Discord | Directory listings only | A bot that server admins invite; Message Content intent on; no self-bots |
| Forums | Listing pages and RSS | RSS lane with the forum's feed |
| X | Curated posts and search snippets | Paid API, off by default; or your own archive through csv_import |
| LinkedIn | Curated posts | Your own data export or a listening tool export through csv_import |
| Instagram, Facebook, Threads, TikTok | Platform newsrooms and agency roundups | No lawful bulk route for most users; exports from tools you license; researcher programmes where eligible |
| YouTube | Channel pages and search snippets | Data API v3 with an API key; mind the 10,000-unit daily quota |
| Bluesky, Mastodon, Hacker News | Public pages | Public APIs, no scraping needed |
| Slack, WhatsApp | Blind | Only exports a room makes of itself, with its consent |

## What never happens

- No scraping behind a login, no fake accounts, no self-bots, no joining rooms to read them.
- No circumventing a block with mirrors, caches or archives.
- No Ahrefs calls and no connector (MCP) calls from this skill. If a gap could be filled by a paid data
  source the operator owns, say so in one line and let the operator decide.
- No names of private individuals anywhere in an edition.
