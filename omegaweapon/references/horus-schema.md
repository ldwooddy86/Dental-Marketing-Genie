# Edition schema

An edition is four JSON files that share a stem, for example `digital-marketing-2026-09`:

| File | Holds |
|---|---|
| `<stem>.json` | The ledger: meta, items, rooms |
| `<stem>.signals.json` | The Nilometer: signals, events, watch calendar |
| `<stem>.analysis.json` | The analysis of record (ANALYSIS.md) |
| `<stem>.kappa.json` | Reliability: topic, cluster and intent kappa plus disagreements |

`scripts/horus_scaffold.py` writes the first three with every key present. `scripts/horus_validate.py`
enforces what follows.

## Ledger

```json
{
  "edition": "2026.09a", "nome": "digital-marketing", "title": "Digital Marketing", "run_date": "2026-09-27",
  "window": {"sun": "2026-09-03 to 2026-09-25", "moon_floor": "...", "rooms": "census snapshot 27 Sep 2026"},
  "collection_mode": "first-light (web sweep, no collector credentials)",
  "items": [ ... ], "rooms": [ ... ]
}
```

Item:

| Field | Type | Notes |
|---|---|---|
| `id` | string | `S001` ... for broadcast, `M001` ... for the floor |
| `eye` | `sun` or `moon` | |
| `lane` | string | `trade-press`, `curated-press`, `agency-roundups`, `platform-voice`, `forum`, `telegram`, `reddit`, `discord`, `practitioner-curation`, `practitioner-social`, `youtube`, `podcast`, ... |
| `platform` | string | Publication or platform: "Search Engine Land", "BlackHatWorld", "Telegram" |
| `community` | string | Section, subreddit, channel handle, or the listing it was read from. Never a private person's name |
| `date` | `YYYY-MM-DD` or `YYYY-MM` | |
| `date_approx` | bool | True when only the month is known |
| `topic`, `topic2` | taxonomy id, id or null | CODEBOOK.md |
| `intent` | Q C R H N D P J O | |
| `stance` | -1, 0, 1 | |
| `flags` | list | `set`, `grey` |
| `engagement` | object | `replies`, `views`, `comments` when visible |
| `title` | string | English; say "(translated)" when translated |
| `url` | http(s) | Permalink when there is one |

Room: `id` (`R001` ...), `platform`, `name`, `size` (integer or null), `size_kind` (`members`,
`subscribers`), `lang`, `topic`, `topic2`, `flags`, `note`, `url`.

## Signals file

`signals[]`: `id` (N01 ...), `domain`, `metric`, `value`, `date`, `period`, `source`, `url`, `grade`
(A1 to F6), `note`, `topics`. `events[]`: `date`, optional `date_approx`, `label`, `topic`, `ref`.
`watch_calendar[]`: `date`, optional `date_approx`, `label`, `topic`, `indicator`.

## Analysis file

See ANALYSIS.md for every section. References inside it resolve to: `N..` signals, `S...`/`M...`
items, `R...` rooms, `KJ..` judgments, `I..` indicators, `metrics:<topic id>`, `metrics:clusters`,
`metrics:intents`, `metrics:stance`, `census:<Platform>`.

## Kappa file

Written by `horus_kappa.py`: `topic`, `cluster`, `intent` (each `n`, `agreement`, `kappa`, `reading`)
and `disagreements[]` (`id`, `title`, `first`, `second`).

## Naming and folders

Editions live in `assets/editions/`. Stems are `<nome>-<YYYY-MM>` with a letter suffix for a second
edition in the same month (`digital-marketing-2026-10b`). The builder measures momentum against the
latest earlier edition of the same nome in the same folder.
