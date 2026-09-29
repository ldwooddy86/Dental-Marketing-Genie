# The analysis of record

`<edition>.analysis.json` holds every judgment an edition makes. The dashboard renders it; the
validator enforces its shape. Write it after the metrics and the Nilometer are in hand, never before.

## Standards

- **Probability words are ICD 203 terms with ranges**: almost no chance (1 to 5%), very unlikely (5 to
  20%), unlikely (20 to 45%), roughly even chance (45 to 55%), likely (55 to 80%), very likely (80 to
  95%), almost certain (95 to 99%). A judgment with two claims gets two terms joined by a semicolon, a
  qualifier in parentheses after each, and two ranges joined by a slash.
- **Confidence grades the evidence, separately**: low, low to moderate, moderate, moderate to high,
  high. A very likely judgment on thin evidence is very likely with low confidence.
- **Every key judgment has a horizon, evidence refs and at least one falsifier.** Evidence should
  include at least one Nilometer signal; discourse alone is weaker and the validator warns.
- **Arithmetic is shown.** Put derived numbers in a `math` block computed in code during the run.
- **House style**: plain words, short sentences, numbers with their sources. No em dashes, no
  "not X but Y" constructions, no stock phrases. Name platforms and companies; never name private
  individuals.

## Sections

| Key | What it holds |
|---|---|
| `headline` | One sentence: the direction of the industry |
| `bluf` | Three to five paragraphs: what is happening, the money, where it goes next, what the floor has missed |
| `key_judgments` | KJ1 ... : `title`, `judgment`, `likelihood`, `range`, `confidence`, `horizon`, `topics`, `evidence` (N, S, M, R, `metrics:Txx`, `metrics:clusters`, `metrics:intents`, `metrics:stance`, `census:<Platform>`), `falsifiers`, optional `math` |
| `discourse_findings` | D1 ... : what the measurement shows, each with refs. This is the "what are people talking about" answer |
| `stages` | Stage of record per topic: `{"T01": {"stage": "Ra", "why": "..."}}` |
| `momentum_direction` | Until two editions exist: `up strongly`, `up`, `flat`, `down` per topic, from the Nilometer, with a `_note` saying so |
| `ach` | Hypotheses H1 ... ; evidence rows A1 ... rated C, I or N against each; a `conclusion`. The strongest hypothesis has the fewest inconsistencies, not the most consistencies |
| `scenarios` | Two axes (the two uncertainties that matter most and are least predictable), four scenarios named for their quadrant, probabilities that sum to 100, a narrative and signposts each |
| `indicators` | I1 ... : what to watch, what reading would move which judgment, when the next reading lands |
| `graveyard` and `graveyard_test` | Failed prophecies from earlier cycles, their lesson, and which of today's prophecies share their shape |
| `unknowns` | U1 ... : the 64th part, what cannot be measured and would break the judgments |
| `implications` | P1 ... : moves for an operator, each tied to the judgments that justify it |
| `channels` | One dossier per channel: `status` (sampled, census only, reported, blocked, blind, not sampled), `collector`, coverage `grade`, `match` rule to its ledger items, dossier bullets, signal refs |
| `limitations` | Frames, blocked lanes, sample sizes, kappa, what momentum is based on |
| `scorecard` | From the second edition on: each earlier key judgment (`kj`, `title`) with `status` (confirmed, holding, weakened, falsified, too early) and a `note` naming the falsifier or indicator that moved |

## Method for judgments

1. **Read the measurement first.** Which topics are broadcast-led, floor-led, painful, grey, silent?
   Write the discourse findings.
2. **Weigh it against the Nilometer.** For each loud topic: is money moving? For each silent one: did
   the money leave (attrition) or never arrive?
3. **Run ACH.** Write three to five rival hypotheses about the industry's direction, including one that
   says the disruption is overstated. Rate each evidence row C, I or N against each. Count
   inconsistencies.
4. **Write key judgments** that survive ACH, each with the observation that would falsify it.
5. **Build the scenario square** from the two uncertainties ACH could not resolve.
6. **Set the indicators** that will tell you which scenario is arriving, with dates.
7. **Test against the graveyard.** Does any judgment share the shape of a failed prophecy?
8. **Name the unknowns and write the moves.**
9. **From the second edition on, score the last one first.** Before writing new judgments, check each
   earlier key judgment against its falsifiers and indicators and record the result in `scorecard`.
   A forecast nobody scores is a horoscope.

## Channel dossiers and coverage honesty

The Brief's coverage strip is generated from `channels[].status`. Use `sampled ...` only when items
from that channel are in the counted ledger. A channel read only through a directory is `census only`;
one seen only through curation or platform reporting is `reported`; one that refused the fetcher is
`blocked`; one with no lawful route is `blind`.
