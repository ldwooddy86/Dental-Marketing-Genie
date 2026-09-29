# Horus doctrine

Horus answers two questions about a media industry: **what are people talking about**, and **where is
the industry most likely to go**. It answers the first by measurement and the second by judgment, and it
never lets the two blur.

## The two eyes

Horus has two eyes, and each sees a different industry.

| Eye | Myth | What it reads | What it is good for |
|---|---|---|---|
| **Sun eye** (broadcast) | Ra's right eye | Trade press, platform blogs and liaisons, curated newsletters, agency roundups, analyst notes | What the platforms ship and the press amplifies; the official agenda |
| **Moon eye** (the floor) | The wounded left eye that Thoth restored | Forums, subreddits, Telegram channels and groups, Discord servers, practitioner posts, comment sections | What practitioners actually do, ask, fear and sell; pain and workarounds |

One eye alone is flat. The broadcast over-reports announcements; the floor over-reports pain and grey
tactics. Depth comes from the disagreement between them.

## Stereopsis

Stereopsis is the measured gap between the eyes, topic by topic: a weighted log-odds ratio with an
informative Dirichlet prior (Monroe, Colaresi and Quinn 2008), reported as a z-score. Positive means
the floor talks about a topic more than the broadcast does; negative means the broadcast leads.
Beyond plus or minus 1.96 the gap is unlikely to be sampling noise. See METRICS.md.

Reading the gap:

- **Broadcast-led or broadcast-only**: the platforms and press are talking about something the floor
  has not operationalised. Early (Khepri) or hype. Check the Nilometer for money behind it.
- **Floor-led or floor-only**: practitioners are living with something the press ignores. Often the
  real work, often grey, sometimes a dying tactic that still pays a few people (Duat).
- **Balanced**: settled operational weather.

## The rooms

Rooms are where the floor gathers: Discord servers, Telegram channels and groups, Slack communities,
subreddits. The **room census** codes each room by the topic it is built around and records its size.
It measures which rooms exist and how big they are, not what is said inside them. The census often
tells a different story from the ledger: in the September 2026 digital-marketing edition, most
marketing-tagged Discord servers were hustle-economy rooms, not practice rooms.

## The Set filter and grey flags

Seth is chaos. Items that are spam, sponsored posts, self-promotion, engagement selling, pirated or
group-buy tool resale are **Set-flagged**: kept in the ledger for the record, excluded from share of
voice. Items describing grey-hat or terms-of-service-risky tactics carry a **grey** flag: they count,
because they are real floor behaviour, and they are tallied separately.

## The Nilometer

Egypt read the Nile's flood on a graded stair, not by the mood on the riverbank. The Nilometer is the
set of hard signals the discourse is weighed against: earnings and filings, ad-spend forecasts, CMO and
labour surveys, randomised field experiments, panel data, rulings and regulations. Every reading
carries an Admiralty grade (source reliability A to F, information credibility 1 to 6). Talk that
the Nilometer does not support is hype until proven otherwise; hard signals the talk ignores are the
blind spots. See NILOMETER.md.

## The Solar Arc

Every topic has a life cycle, named for Ra's daily passage:

| Stage | Time | Signature |
|---|---|---|
| **Khepri** | Dawn | Announced by platforms or the press; little or no floor activity |
| **Ra** | Noon | Loud and contested; money, hype and pain visible at once |
| **Atum** | Dusk | Operational; standardised, how-to driven, lower heat |
| **Duat** | Night | Residue; floor-only, fading, or the value already leaving |

The stage of record is the analyst's call. The metrics engine offers a heuristic hint only.

## Discourse attrition

Quiet is not the same as solved. When chatter about a topic falls, first ask whether the money or the
traffic left. In September 2026 the search floor's own reporter noted that volatility chatter was
slowing because Google was sending sites less traffic. Attrition reads as calm and means decline.

## The graveyard

Every industry has prophecies that failed: half of all searches by voice by 2020; the cookieless
future. Before endorsing a new prophecy, compare its shape with the graveyard. Platform-announced,
default-on, platform-benefiting and silent on the floor is the shape that has failed before.
Randomised evidence plus a billion-user surface is not.

## The 64th part

In the traditional reading, the six parts of the Eye of Horus are fractions from one half to one
sixty-fourth and together sum to 63/64. The missing sixty-fourth is what cannot be measured. Every
edition names its unknowns: the rooms it could not read, the numbers no one discloses, the shocks
that would break the judgments.

## Thoth's ledger

Thoth kept the record. Every item, room and signal carries a source link; every number on the
dashboard is computed from the ledger, never typed by hand; every key judgment lists its evidence and
the observations that would change it.

## Two rules that make it honest

1. **Measurement and judgment stay separate.** Shares, z-scores and pain come from code. Stages,
   likelihoods, scenarios and moves are judgments, labelled as such, with falsifiers.
2. **Coverage is part of the result.** What Horus could not see is shown on the first screen, not
   buried in a footnote. A blind fraction honestly stated beats a confident fiction.
