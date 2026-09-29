# Nilometer: hard signals

The Nilometer holds the measured numbers an edition's judgments rest on. Discourse says what people
are talking about; the Nilometer says whether money, users and rules are moving the same way.

## What qualifies

| Kind | Examples | Typical grade |
|---|---|---|
| Company filings and earnings | 10-Q and 8-K exhibits, annual reports, earnings calls | A1 for reported financials; A2 for company-stated user metrics |
| Regulator and court records | Judgments, remedies, statutes in force, consultation outcomes | A1 for the fact of the ruling |
| Randomised or preregistered experiments | Field experiments on clicks, prices, behaviour | B2 (independent, single study); B1 once replicated |
| Panels and measurement firms | Share-of-prompt panels, AI Overview presence, audience panels | B2; B3 when coverage is not disclosed |
| Industry forecasts | Holding-company and IAB forecasts, analyst outlooks | B2 for established forecasters; C3 for a single vendor claim. Graded as the fact of the forecast, not its accuracy |
| Surveys | CMO spend surveys, career and salary outlooks | A2 for long-running surveys with published method; B2 or C2 otherwise |
| Trade reporting of undisclosed numbers | Run rates or targets reported from documents or sources | C2 or C3 until confirmed |
| Vendor datasets | Citation trackers, CPM benchmarks from one platform's clients | C3: useful for direction, not level |

## Admiralty grades

Source reliability: **A** completely reliable, **B** usually reliable, **C** fairly reliable, **D** not
usually reliable, **E** unreliable, **F** cannot be judged. Information credibility: **1** confirmed by
other sources, **2** probably true, **3** possibly true, **4** doubtful, **5** improbable, **6** cannot be
judged.

Rules:

- Grade the claim as used. A company's own revenue in a filing is A1; the same company's claim about a
  competitor is C3.
- A number reported second-hand gets the grade of its origin, capped by the relay's reliability.
- When two credible sources disagree, record both readings and say so in the note.
- Forecasts and targets are graded as statements that were made. Their accuracy is tested later in the
  graveyard.

## Fields

`id` (N01, N02 ...), `domain` (a short heading such as "Ad spend"), `metric`, `value` (with units and
change, e.g. "$63.27B, +17% YoY"), `date` (publication date), `period` (what the figure covers),
`source` (who says so, and through what document), `url`, `grade`, `note` (what it means and how far to
trust it), `topics` (taxonomy ids).

## Events and the watch calendar

- `events`: dated things that happened and matter to the judgments (a launch, a ruling, a deal), each
  with `date`, `label`, `topic` and `ref` to the signal that documents it.
- `watch_calendar`: dated readings ahead (earnings dates, deadlines, report releases), each with the
  indicator it will move (`indicator`: I1, I2 ...). Mark approximate dates with `date_approx`.

## Sourcing per standing question

Start from the nome's `nilometer` list in `assets/nomes.json`, then for each standing question ask: who
books the money, who counts the users, who sets the rules, and who has run an experiment. One strong
primary number beats five blog restatements. Prefer the filing to the press release and the press
release to the article about it; link the best one you can reach.

## Arithmetic

Any derived figure in the analysis (run-rate projections, compound growth, shares of totals) is
computed in code during the run and written out in the judgment's `math` block, with the assumptions
that drive it. If a reasonable change in an assumption flips the conclusion, the judgment says so.
