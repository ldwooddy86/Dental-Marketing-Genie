# Collector lanes: setup and rules

The collector reads, stores locally and exports. It never posts, joins, reacts, votes, follows or
marks anything as seen in a way others can observe. Every secret is an environment variable named in
`config.toml`; the loader refuses a config that contains a secret.

## Install (Windows, macOS, Linux)

```
cd collector
python -m pip install -r requirements.txt          # Python 3.11 or newer
python -m horus_collector init --nome digital-marketing
```

Set secrets for the current session:

```
# Windows PowerShell
$env:HORUS_AUTHOR_SALT = "a-long-random-string-you-keep"
$env:HORUS_REDDIT_ID = "..." ; $env:HORUS_REDDIT_SECRET = "..."
# macOS or Linux
export HORUS_AUTHOR_SALT="a-long-random-string-you-keep"
```

For permanent variables on Windows use `setx NAME "value"` (new terminals only) or the System
Properties dialog. Then `python -m horus_collector check` shows each lane as READY, MISSING or off.

## Lanes

| Lane (`[section]`) | Eye | What you need | Rules that matter |
|---|---|---|---|
| `rss` | Sun (or Moon for forum feeds) | Feed URLs; find them with `discover` | Public feeds only |
| `podcast` | Sun | Show RSS URLs | Episode titles and descriptions only |
| `youtube` | Sun; Moon for comments | API key with YouTube Data API v3 enabled | Default quota is 10,000 units a day; search costs 100 units, uploads and comments 1 |
| `reddit` | Moon | A script app at reddit.com/prefs/apps (client id and secret) and a User-Agent naming your Reddit account | Official Data API only; run `recheck reddit` at least weekly so posts deleted at the source are purged; respect the rate limits the API returns |
| `telegram` | Moon | api_id and api_hash from my.telegram.org; one interactive `login telegram` | Reads channels and chats your account can already read; never joins; channel posts attributed to the channel, group members pseudonymized |
| `telegram_bot` | Moon | Bot token from @BotFather; add the bot as an admin of channels you run or that invite it | Sees posts only from the moment it was added |
| `discord` | Moon | A bot application with the Message Content intent turned on, invited by each server's admins with View Channel and Read Message History | Self-bots (automating a user account) violate Discord's terms and are not supported |
| `bluesky` | Moon | Handles to follow; for keyword search an app password | Public AppView for author feeds |
| `mastodon` | Moon | Instances and hashtags | Public tag timelines |
| `hackernews` | Moon | Queries | Public Algolia API |
| `csv_import` | Either | Export files and a column map | Only exports you are entitled to: your own platform archives, licensed listening tools, a room's own export with its consent |

X, LinkedIn, Instagram, Facebook, Threads and TikTok have no general lawful bulk route for most
operators. Horus reads them through curation, platform newsrooms, your own exports and tools you
license. Researcher programmes (TikTok Research API, Meta Content Library) may apply to eligible
institutions; follow their terms if you use them.

## Running on a schedule

Run `collect` daily and `recheck reddit` weekly. On Windows, Task Scheduler with the action
`python -m horus_collector --config C:\path\config.toml collect` and the start folder set to the
`collector` folder. On macOS or Linux, cron:

```
15 6 * * *  cd /path/horus/collector && /usr/bin/python3 -m horus_collector collect >> collect.log 2>&1
30 6 * * 1  cd /path/horus/collector && /usr/bin/python3 -m horus_collector recheck reddit >> collect.log 2>&1
```

## From store to edition

```
python -m horus_collector export --since 2026-10-01 --until 2026-10-31 --out raw.jsonl
cd .. && python scripts/horus_prefilter.py --nome digital-marketing --raw collector/raw.jsonl --out candidates.json --window 2026-10-01:2026-10-31
```

Code the candidates by hand into a new edition ledger (CODEBOOK.md). Record in `collection_mode` that
the edition came from the collector, with the lanes and dates.

## Data handling

- The store (`horus-data/horus.sqlite`) and the Telegram session file stay on the machine. Treat the
  session file like a password.
- Floor authors are stored as salted pseudonyms; changing the salt breaks author caps across runs, so
  keep it stable and private.
- Delete the data folder when a project ends. Content deleted at its source is purged by `recheck`.
- Tests run offline: `python -m unittest discover -s tests -v`.
