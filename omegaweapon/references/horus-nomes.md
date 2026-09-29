# The nomes

Ancient Egypt was divided into provinces called nomes. Horus divides the media business the same way:
each **nome** is an industry pack in `assets/nomes.json` with a scope, a topic taxonomy with prefilter
keywords, seeds for both eyes, Nilometer sources and standing questions. The names are the Egyptian
provinces the packs are named for; they are labels, not claims.

| id | Industry | Nome | Topics | Scope |
|---|---|---|---|---|
| `digital-marketing` | Digital Marketing | Wetjes-Hor (Throne of Horus, Edfu) | 30 | Search, paid media, social, creators, measurement, commerce, agencies and the labor market of performance and brand marketing. |
| `advertising-adtech` | Advertising and Ad Tech | Waset (Thebes) | 16 | Holding companies, media buying, programmatic, CTV, retail media, identity, measurement and ad-tech regulation. |
| `film-tv-streaming` | Film, TV and Streaming | Ineb-hedj (White Walls, Memphis) | 14 | Studios, streamers, theatrical, FAST/AVOD, production labor, AI in production and distribution. |
| `music` | Music | Seshesh (the sistrum nome) | 13 | Recorded music, streaming, publishing, live, AI music and artist marketing. |
| `publishing-books` | Books and Publishing | Wenet (Hermopolis, city of Thoth) | 13 | Trade and self-publishing, audiobooks, discovery, AI licensing and author economics. |
| `news-journalism` | News and Journalism | Heqa-andj (Heliopolis, city of the sun) | 13 | Newsrooms, distribution, AI referral collapse, licensing, subscriptions and trust. |
| `games-interactive` | Games and Interactive | Aa-ta (Dendera, house of Hathor) | 13 | Studios, platforms, live service, UGC platforms, mobile UA and game marketing. |
| `podcasting-audio` | Podcasting and Audio | Nekhen (city of the falcon) | 11 | Podcasts, video podcasts, audio advertising, measurement and discovery. |
| `creator-economy` | Creator Economy | Ta-Seti (Land of the Bow, the trading frontier) | 14 | Creators, platforms' creator programs, brand deals, creator commerce and the clipping economy. |
| `pr-communications` | PR and Communications | Input (the jackal nome, keepers of the scales) | 12 | Earned media, reputation, AI answers about brands, executive visibility and comms measurement. |

`digital-marketing` is the flagship: 30 topics grouped into nine clusters, short labels for the
dashboard, and a complete first edition in `assets/editions/`. The other nine are ready to run and
lighter: no clusters yet (the dashboard then shows the ten loudest topics instead of clusters) and
seeds that need verifying on the first run.

## Choosing the nome

Match the request to the scope column. When a request spans two nomes (for example "podcast
advertising"), run the nome whose standing questions fit best and borrow topics from the other through
`topic2`. When nothing fits, add a nome.

## Adding or extending a nome

1. Copy an existing entry in `assets/nomes.json` and give it a new `id`, `name`, `nome` label and
   `scope`.
2. Write a taxonomy of 11 to 30 topics. Each topic has `id` (one letter plus two digits, unique within
   the nome), `label`, optional `short` (dashboard label, about 20 characters), `def` (one sentence that
   says what is in and what is out) and `kw` (lowercase prefilter keywords; include common misspellings
   and platform jargon). End with an `Other` topic.
3. Optional `clusters`: groups of topic ids that sum to the whole taxonomy. They make the Brief's
   two-eyes chart readable.
4. Seeds: `sun` (trade press domains, newsletters, platform voices, podcasts) and `moon` (subreddits,
   forums, Discord and Telegram discovery routes, Slack and paid rooms, practitioner social). Seeds are
   leads to verify on the run.
5. `nilometer`: the recurring hard sources (annual reports, forecasts, surveys, earnings).
6. `standing_questions`: three to six questions every edition must answer.
7. Validate by scaffolding an edition (`horus_scaffold.py --nome <id>`) and building it with `--force`;
   the empty dashboard should render without errors.

## Taxonomy rules that keep coding reliable

- Topics are about subjects, not sentiment ("AI music and training rights", not "AI music fears").
- Split a topic when one side of it would dominate the floor and hide the other (links and local
  listings are separate in digital marketing for this reason).
- Merge topics the coders keep confusing; a reliability run that splits two topics repeatedly is
  telling you they are one topic.
- Keep the ids stable across editions. Momentum compares topic ids, so renaming a label is fine and
  renumbering is not.
