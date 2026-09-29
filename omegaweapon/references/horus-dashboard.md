# The dashboard

`scripts/horus_build.py` turns an edition into one self-contained HTML page. The page carries its data
as inert JSON, draws everything with inline script, and makes no network calls except the Google Fonts
stylesheet (drop it with `--system-fonts`).

```
python scripts/horus_validate.py --edition assets/editions/<stem>.json
python scripts/horus_build.py --edition assets/editions/<stem>.json --out horus-<stem>.html
python scripts/horus_build.py --edition assets/editions/<stem>.json --fragment --out horus-<nome>.html   # for artifact hosts
```

The builder recomputes every metric, validates the contract and refuses to build on errors (unless
`--force`, for drafts only). It measures momentum against the latest earlier edition of the same nome
in the same folder; `--previous` picks one explicitly and `--no-previous` turns it off.

## Tabs

| Tab | Shows | Built from |
|---|---|---|
| Brief | Headline, BLUF, instruments (items, rooms, signals, kappa), coverage strip, two-eyes chart with the strongest floor-led and broadcast-led topics, key judgments with ICD 203 probability bars, confidence, evidence and falsifiers, moves | analysis, metrics |
| Topics | Discourse findings, the Stereopsis chart, the sortable topic grid (shares, reply-weighted floor, z and class, pain, stance, grey, stage, momentum), clusters, intent butterfly, stance | metrics, analysis |
| Channels | Lanes with top topics, lane by cluster heat matrix, channel dossiers with status and what each channel is saying, broadcast sampling by day | ledger, metrics, analysis |
| Rooms | Census by platform (rooms or subscribers by topic, languages), room tables | ledger rooms, metrics |
| Nilometer | Admiralty matrix, domain filters and search, every signal with source link | signals |
| Forecast | Solar Arc stage bands, scenario square, ACH matrix, indicators and warnings, watch calendar, graveyard, the 64th part | analysis, signals |
| Timeline | Events behind the judgments and dated readings ahead, by month | signals |
| Ledger | Every item with filters (eye, lane, topic, intent, flags, search) and source links | ledger |
| Method | Frames and counting rule, every measure defined, reliability with disagreements, limitations, standing questions, rebuild commands | all |

Every evidence reference is a link: `N07` opens the signal, `M045` filters the ledger to that item,
`grid T07` jumps to the topic's row, `Discord census` to the census. Tabs deep-link with a bare anchor
(`#forecast`).

## Design rules the template keeps

- Gold is the broadcast (Sun) eye, lapis the floor (Moon) eye; malachite marks what can be clicked.
  Carnelian is reserved for problems: inconsistent evidence, grey tactics, blocked lanes.
- Every data string enters the page as a text node; JSON is escaped so it cannot close its script tag;
  links are allowed only for http and https.
- Light and dark themes follow the viewer; the layout holds at phone width with no sideways scroll
  (wide tables scroll inside their own frame).
- Floor authors never appear. The ledger shows platforms, communities and titles only.

## Publishing

In a session with an artifact tool, build with `--fragment` and publish the file as a private page; the
edition's `<title>` is "Horus <Industry>". Republishing the same file path updates the same page. On a
local machine, open the full build in any browser; nothing else is needed.
