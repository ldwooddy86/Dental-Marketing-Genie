# HORUS collector

Read-only collection for Horus editions: trade-press and forum feeds, podcasts, YouTube, Reddit,
Telegram (your account or a bot), Discord (a bot), Bluesky, Mastodon, Hacker News and exports you are
entitled to. Everything is stored locally in SQLite; floor authors are pseudonymized; nothing is ever
posted, joined or reacted to.

```
python -m pip install -r requirements.txt           # Python 3.11+
python -m horus_collector init --nome digital-marketing
python -m horus_collector discover --nome digital-marketing
python -m horus_collector check
python -m horus_collector login telegram             # only if the telegram lane is on
python -m horus_collector collect
python -m horus_collector recheck reddit             # weekly, if the reddit lane is on
python -m horus_collector export --since 2026-10-01 --until 2026-10-31 --out raw.jsonl
python -m unittest discover -s tests -v              # offline tests
```

Secrets go in environment variables named by the `*_env` keys in `config.toml`, never in the file.
Lane-by-lane setup, platform rules, scheduling and data handling: `../references/CONNECTORS.md`.
