# Metrics

Every number on a Horus dashboard is computed by `scripts/horus_metrics.py` from the coded ledger.
Nothing is typed by hand. This file says what each number means and where it misleads.

## Share of voice (SoV)

For each eye separately: the share of **counted** items (Set-flagged items excluded) whose primary
topic is t. Clusters sum their topics' shares. Topic2 never enters SoV.

Pitfall: SoV measures the frame you read. A search-heavy broadcast frame makes search look loud. State
the frame; compare eyes within an edition, and editions within a frame.

## Stereopsis

The weighted log-odds ratio with an informative Dirichlet prior (Monroe, Colaresi and Quinn 2008),
floor (F) against broadcast (B), for each topic w:

```
delta_w = log[(yF_w + a_w) / (nF + a0 - yF_w - a_w)] - log[(yB_w + a_w) / (nB + a0 - yB_w - a_w)]
var_w  ~ 1 / (yF_w + a_w) + 1 / (yB_w + a_w)
z_w    = delta_w / sqrt(var_w)
a0     = number of topics
a_w    = a0 * max(pooled count of w, 0.5) / (pooled n + 0.5 * number of topics)
```

The prior shrinks small counts toward the pooled rate, so a topic with 2 floor items and 0 broadcast
items does not produce an absurd gap. Classes:

| Class | Rule |
|---|---|
| floor-led / broadcast-led | z at or beyond +1.96 / -1.96 |
| leaning floor / leaning broadcast | 1.0 to 1.96 in either direction |
| balanced | below 1.0 in absolute value |
| broadcast-only / floor-only | zero items in one eye and at least 3 (broadcast) or 2 (floor) in the other; checked first |

Pitfall: with a small floor sample, few topics clear 1.96 even when the gap is real. Report the z and
the counts; let the class guide attention, not conclusions.

## Pain

The share of a topic's floor items coded Q (help-seeking) or C (complaint). Pain above 0.5 on a topic
with at least 5 floor items is a demand signal: practitioners need something no one is supplying
cleanly. Pain on 1 or 2 items means nothing; the dashboard shows n beside every share.

## Reply-weighted floor share

Floor share with each forum thread weighted by replies + 1 and each Telegram post by views / 1000.
It shows where floor attention concentrates, which can differ sharply from where posts are made (one
technical-SEO thread with 41 replies moved that topic from 4% to 21% in the first edition). Treat it as
a second opinion on the floor, never as SoV.

## Stance

Mean of +1, 0 and -1 codes per eye and per topic. Useful for direction of mood inside a topic; noisy
below 5 items.

## Grey and Set tallies

Counts of grey-flagged floor items per topic, and Set-flagged items overall. A rising grey share on a
topic often precedes a platform crackdown; a rising Set share means the frame is getting noisier.

## Room census

For each platform: rooms by topic (counts), and combined size by topic when sizes are shown. Set-flagged
rooms are excluded from both. The census is a snapshot of what rooms exist, not of activity.

## Momentum (measured)

With two or more editions of the same nome, pass the earlier ledger with `--previous` (the builder
finds the latest earlier edition in the same folder automatically). For each topic and eye:

```
delta = share_now - share_before           (percentage points)
z     = delta / sqrt(p (1 - p) (1/n_before + 1/n_now)),  p = pooled share
```

The dashboard then shows measured change in place of the directional arrows. Compare editions only
when the frames match (same lanes, similar windows); if a frame changed, say so beside the momentum.

Until a second edition exists, momentum is a directional judgment from the Nilometer, labelled as
such in the analysis (`momentum_direction`).

## Stage hint

The metrics engine emits a heuristic `stage_hint` from shares, intents and pain. It is a prompt for
the analyst, not a result. The stage of record is in the analysis file.

## Reliability

Cohen's kappa for topic, cluster and intent from the blind second coder (CODEBOOK.md). Landis and Koch
readings: below 0.21 slight, 0.21 to 0.40 fair, 0.41 to 0.60 moderate, 0.61 to 0.80 substantial,
above 0.80 almost perfect.
