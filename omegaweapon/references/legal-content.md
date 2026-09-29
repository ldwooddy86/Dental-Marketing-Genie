
# COUNSEL — the copy movement of UltimaWeapon (LegalMarketingContent)

Read this file when the target is a law firm, when the user pastes or uploads attorney marketing copy, or
when any run needs the mechanical clean and readability measure on money-page copy. In UltimaWeapon the
pipeline runs in full for legal targets and in its first two passes (mechanical clean + measure) for
everyone else, feeding the Reckoning's content lens. Bundled: `scripts/legalscan.py`,
`scripts/legaldocx.py`, `scripts/legal_rules.json`; references `bar-advertising.md`,
`legal-currency.md`, `verification-playbook.md`, `editorial-standards.md` sit beside this file.

Law firm marketing copy fails in two directions at once, and most editing tools
only see one of them.

The first is craft: it reads like a machine wrote it, because increasingly one
did. Em dashes everywhere, seven-bullet lists where a paragraph belongs, "fight
tirelessly for the compensation you deserve," a reading level that assumes the
person searching at 2 a.m. after a car wreck has a graduate degree.

The second is worse and quieter: **the law moved and the page didn't.** Florida
cut its negligence statute of limitations from four years to two in 2023 and a
staggering amount of Florida personal injury copy still says four. Estate pages
still warn about a 2026 sunset that never happened. Employment pages still say
the FTC banned noncompetes — a rule that was struck down before it ever took
effect. A prospective client who relies on a stale limitations period can lose
their claim entirely.

This skill fixes the first category and flags the second. **The line between
correcting and flagging is the most important rule here, and it is not
negotiable: you correct writing, you flag law.** You are not licensed. A
plausible-sounding legal correction that is subtly wrong is more dangerous than
the error it replaced, because it arrives with the authority of a fix.

## The five passes

Run them in this order. Each one depends on the last.

### Pass 0 — Establish jurisdiction

Legal accuracy is jurisdiction-dependent. A two-year limitations period is right
in Texas and wrong in Louisiana. `scripts/legalscan.py scan` infers the state from city,
court, and state references and reports its confidence.

- **High confidence** → proceed, and say which state you assumed.
- **Low or no confidence** → ask before verifying anything state-specific. You
  can still do the whole editorial pass while waiting; only legal verification
  is blocked.
- **Multiple states detected** → likely a national or multi-market page. Flag it
  for the multi-office disclosure problem (see `references/bar-advertising.md`)
  and verify against every state the page claims.

Also note the practice area. It determines which checklist in
`references/legal-currency.md` applies.

### Pass 1 — Mechanical (script)

```bash
python3 scripts/legalscan.py clean INPUT.md -o OUTPUT.md
```

Deterministic, meaning-preserving fixes only: em and en dashes, invisible
Unicode, smart-quote drift, `--` as an em dash, ellipsis characters, ampersands
between lowercase words, duplicate function words, spacing, chat leakage
("Certainly!", "I hope this helps"), and sentence-lead filler ("It's important
to note that"). URLs, emails, code, HTML, and shortcodes are shielded and never
touched.

Anything requiring judgment is flagged, not auto-fixed. That is deliberate: a
script that guesses at meaning produces errors nobody catches.

### Pass 2 — Measure

```bash
python3 scripts/legalscan.py analyze OUTPUT.md --grade-target 10
```

Reports reading grade, passive voice percentage, adverb density, hard and very
hard sentences, bullet density, AI-tell phrases, and simpler-word suggestions.
The scorer is markdown-aware — headings, list items, and table rows are scored
as separate reading units, because running a readability formula across a raw
bullet block produces a meaningless number and sends you chasing a problem that
isn't there.

**Targets:** grade ≤ 10 (6–8 is better for consumer-facing pages), passive ≤ 10%
of sentences, adverbs ≤ 1 per 100 words, zero very-hard sentences, ≤ 30% of
words inside bullets, no bullet run longer than 7.

### Pass 3 — Legal and compliance scan (script)

```bash
python3 scripts/legalscan.py scan INPUT.md --json findings.json
```

This is the pass that makes this skill different from a proofreader. It runs
against the **original** text and produces two things:

1. **Findings** — matches against the maintained kill-list in
   `scripts/legal_rules.json`: overruled cases, vacated rules, sunset provisions,
   superseded dollar figures, state-law changes with effective dates, time-decaying
   language, and bar-advertising triggers. Each carries a severity, an
   explanation of what actually happened, a fix, and a primary source URL.
2. **A verification worklist** — every dollar figure, case citation, statute
   cite, limitations claim, damages cap, percentage, fee, and agency reference,
   with line numbers. These are not errors. They are the assertions that *could*
   be errors, and the script's job is to make sure none of them get skipped.

A clean scan is not a clean bill of health. The kill-list catches known
problems; the worklist is where the unknown ones live.

**Re-scanning your own corrected copy.** Corrected pages legitimately name dead
authorities in order to refute them — "*Chevron* was overruled by *Loper
Bright*" should not fire as a *Chevron* problem. The scanner detects that
refutation context and suppresses those matches, reporting a count so the
suppression is visible rather than silent. Use `--flag-refutations` to see them
if you want to confirm the framing is right.

### Pass 4 — Editorial rewrite (you)

Now edit the cleaned file. Read `references/editorial-standards.md` before your
first rewrite in a conversation — it has the passive-to-active patterns, the
bullet-to-prose conversions, the AI-vocabulary substitutions, and the grammar
sweep checklist.

Work in this order, because fixing structure first makes the sentence-level work
smaller:

1. Convert over-bulleted sections back to prose. Keep lists only where the
   content is genuinely enumerable (documents to bring, deadlines, damage
   categories). Kill bold-lead-in bullets — `**Proven Results:** We've...` — they
   are the single loudest AI tell in this genre.
2. Split every very-hard sentence.
3. Rewrite passive constructions into active. Legal copy is passive by habit
   ("compensation may be recovered") and it reads as evasive to a person who
   wants to know whether *you* can get *them* money.
4. Replace AI-tell phrases and apply simpler-word suggestions.
5. Fix confirmed typos. Verify each one before changing it — spellcheckers
   false-positive on case names, firm names, and Latin terms. Never "fix" a
   proper noun or a term of art.
6. Sweep for grammar the script can't see: subject-verb agreement, comma
   splices, its/it's, misplaced modifiers, tense drift, hyphenated compound
   modifiers.

Then re-run `analyze`. Two editorial iterations maximum. If targets still miss,
report the residual honestly — over-editing sands the voice flat, and a page
that scores perfectly but sounds like nobody wrote it is not an improvement.

### Pass 5 — Verify the law (you)

Take the Pass 3 findings and worklist and verify them against primary sources.
Read `references/verification-playbook.md` for working URL patterns, which
sources are fetchable, and the traps. Read `references/legal-currency.md` for
what changed through 2026 and the practice-area checklists. Read
`references/bar-advertising.md` for the ethics layer.

Three rules govern this pass, and they exist because the failure modes here are
specific and severe:

**Verify the fetch, not just the URL.** A 200 response is not evidence.
`statutes.capitol.texas.gov` silently returns its homepage for a bad path — the
most dangerous failure mode there is, because it looks like success. Confirm the
content you got back actually contains the section you asked for.

**Never claim a case is good law.** Justia carries no treatment flags. Its
*Chevron* page — for a case overruled in 2024 — says nothing about the
overruling. No free source reports negative treatment. You can verify that a
citation is *accurate*; you cannot verify that a case is *still good*. Say so:

> Citation confirmed accurate via Justia. Free sources cannot confirm this case
> has not been overruled or abrogated. Attorney review with a paid citator
> (Shepard's/KeyCite) required before publication.

Conflating those two claims is the most likely way this skill produces a
dangerously false "verified."

**If only a secondary source supports a flag, the flag says "could not verify,"
not "incorrect."** Law firm blogs and other marketing pages are frequently the
origin of the error you are checking. Never cite one as evidence.

## What gets corrected vs. flagged

| Category | Action | Why |
|---|---|---|
| Grammar, spelling, punctuation | **Correct** | No judgment call; correctness is verifiable |
| Em dashes, AI artifacts, chat leakage | **Correct** | Mechanical, meaning-preserving |
| Bullet bloat, fragment bullets | **Correct** | Structure, not substance |
| Passive voice | **Correct** | Same meaning, better sentence |
| Reading level above 10th grade | **Correct** | Simplify wording, never simplify the law |
| Superlatives, guarantees, "specialist" | **Flag with suggested rewrite** | Bar-rule exposure; the firm chooses the wording |
| Missing required disclaimers | **Flag with the state's exact text** | Insertion is the attorney's call |
| Statutes of limitations, caps, fees, figures | **FLAG ONLY** | Wrong here costs a client their claim |
| Case citations, holdings, "recent ruling" | **FLAG ONLY** | Validity is not verifiable from free sources |
| Legal conclusions and advice | **FLAG ONLY** | Not yours to write |

When simplifying to hit the grade target, simplify the *sentence*, never the
*law*. "You have two years from the date of the accident, unless the injury was
not discoverable, in which case a different rule may apply" can become two
sentences. It cannot become "You have two years."

### The hard case: what to do when a legal claim is affirmatively false

"Flag, don't correct" has an obvious tension, and you will hit it. If a page
says the FTC banned noncompetes and you leave that sentence verbatim, the
document you hand back — labeled "corrected" — still says something false, and a
marketer may paste it straight into the CMS without reading the change log.
Faced with that, the tempting move is to write the correct law in yourself. Do
not. Authoring replacement law is practicing without a license, and a confident
correction that is subtly wrong is worse than the error it replaced.

Resolve it with a three-way rule instead:

**Preserve verbatim + flag** — the default. Use when the claim is *stale or
incomplete* but not affirmatively misleading: a superseded dollar figure, a
limitations period missing its effective-date qualifier, a cap quoted at last
year's value. The reader is not actively misled by the sentence sitting there
while an attorney reviews it.

**Excise + placeholder + flag** — use when the claim is *affirmatively false and
would mislead a reader who acts on it*: a dead rule described as in force, an
overruled case described as good law, a deadline that would cause someone to
miss their claim. Remove the passage, leave a visible marker, and put the full
explanation in the change log:

> `[REMOVED — see Flag #3. This section stated the FTC noncompete rule is in
> force. The rule was set aside in August 2024 and never took effect; the FTC
> acceded to vacatur in September 2025. Noncompete enforceability is now entirely
> a matter of state law. ATTORNEY TO SUPPLY replacement language.]`

**Never author replacement law.** Not even when you have verified the correct
rule and the fix seems obvious. Verification tells you the existing sentence is
wrong; it does not qualify you to write the sentence that replaces it, which
requires knowing the client's jurisdiction, practice posture, and risk tolerance.
Cite what you verified in the flag and let the attorney write the line.

Say which of the three you chose, for each flag, in the change log. An editor who
can see the rule being applied can overrule it; one who can't has to re-check
everything.

## Writing a flag

Flags go in the change log where an attorney reads them, not scattered through
copy a marketer may paste straight into a CMS. Each one needs five things:

```
[FLAG — HIGH | Legal currency] Line 17: "you have four years from the date of
your accident"
WHAT CHANGED: Florida HB 837 cut the general negligence limitations period from
four years to two, effective March 24, 2023, prospective only.
SOURCE: Fla. Stat. § 95.11(5)(a) — https://www.flsenate.gov/Laws/Statutes/2024/95.11
(verified 2026-08-14; text confirms "WITHIN TWO YEARS — An action founded on
negligence")
RISK: A reader relying on this could miss the deadline and lose the claim.
SUGGESTED (attorney review required): "Two years for injuries occurring on or
after March 24, 2023. Claims that accrued before that date may still fall under
the prior four-year period."
```

Severity: **BLOCKER** — publishing this exposes the firm or misleads a
prospective client. **HIGH** — materially wrong. **MEDIUM** — probably stale,
verify. **LOW** — advisory.

Note the SOL fix is stated in two parts. Limitations changes are almost never
retroactive, so a single number is wrong for somebody no matter which number you
pick. Same principle for escalating damages caps: state the schedule, not this
year's figure alone.

## Input handling

- **Pasted text** → save to a temp `.md` first, then run the pipeline.
- **.md / .txt / .html** → `scripts/legalscan.py` directly.
- **.docx** → `python3 scripts/legaldocx.py clean` edits run text in place so bold, headings,
  tables, and hyperlinks survive. Use `--text-out` to get an extraction, then
  run `legalscan.py analyze` and `scan` on that. Apply Pass 4 edits back into
  the .docx following the **docx skill**.
- **A URL** → fetch it (the sanctioned fetcher, or the raw fetcher's text extraction), save the extracted copy, then run the pipeline.
- **Multiple pages** → run each separately, then combine into one deliverable.

## Deliverables

1. **Corrected document** — clean `.docx` unless the user asks otherwise, per
   the **docx skill**. All Pass 1–4 corrections applied. No flag text inside it.
2. **Change log** — the second half of the deliverable, not an afterthought.
   Structure it as:
   - *Corrections applied* — counts by category, plus the notable rewrites
   - *Legal flags* — full flag blocks, BLOCKER first
   - *Bar advertising flags* — same format, with the governing state named
   - *Verified as current* — what you checked that turned out fine, with sources
     and the as-of date. This is what makes the report trustworthy; a report
     that only lists problems gives no signal about coverage.
   - *Could not verify* — what you tried, why it failed, what a human needs to do
   - *Readability* — before → after against targets
3. Deliver both with `SendUserFile`. Produce the change log as `.md` for a quick
   internal pass, `.docx` when it goes to the client or the firm.

## Boundaries

- Never change a legal claim, a dollar figure, a deadline, a case name, or a
  citation. Flag it.
- Never write a disclaimer as though it were verbatim rule text unless
  `legal_rules.json` marks it `verified verbatim`. Most states prescribe a
  disclaimer's *content*, not its wording — and Florida deleted its mandated
  strings in August 2023, so checklists that still insert them are wrong.
- Never touch quoted material, testimonial wording, attorney bios' factual
  claims, code, schema/JSON-LD, or tracking parameters.
- Preserve SEO assets: target keywords, H1s, internal links and anchor text. If
  a flagged phrase *is* the keyword, leave it and say so in the report.
- Don't add "Attorney Advertising" to a page in a state that doesn't require it.
  Over-disclaiming is its own error.
- Two editorial iterations maximum.

## Keeping the skill current

`scripts/legal_rules.json` is the scanner's brain and is meant to be edited. It
holds the kill-list, stale-figure table, jurisdiction traps, bar triggers, and
verbatim disclaimer strings, each with a source. Adding a new stale claim needs
no code change.

Refresh it in **January** (IRS, SSA, HHS, USCIS annual figures), in **July**
(the SCOTUS term ends; IRS issued a mid-year mileage change in 2026), and
whenever a state amends its advertising rules. Current data version and as-of
date are in the file's `_meta` block, and the scanner prints the version in every
JSON report so a stale run is visible rather than silent.

## References

- `references/legal-currency.md` — what changed through 2026: overruled cases,
  vacated rules, the 2026 figure tables, state-law changes, and practice-area
  checklists. Read during Pass 5.
- `references/bar-advertising.md` — ABA Model Rules 7.1–7.6 and the state
  regimes, the phrase trigger table, and the verbatim disclaimer strings that
  are actually compelled. Read whenever a bar trigger fires.
- `references/verification-playbook.md` — working Justia and .gov URL patterns,
  what fetches and what is blocked, the source hierarchy, and how to be honest
  about the limits of free verification. Read before your first lookup.
- `references/editorial-standards.md` — passive-to-active patterns,
  bullet-to-prose conversion, AI-vocabulary substitutions, the grammar sweep,
  and how to simplify legal copy without simplifying the law. Read before Pass 4.

## Inside UltimaWeapon

- The Counsel deliverables (corrected `.docx` + change log) ship beside the Ultima Weapon report; the change log's
  legal and bar flags are ALSO summarised as CANDIDATE rows on the workbook's FINDINGS tab with route
  STATE BAR, so the compliance picture and the copy picture agree.
- Codex §1 (legal services) supplies the display-rule layer (bar disclaimers, §528 statement, NY/NJ/MO/
  AL/KY/TX/FL/CA rules); this file supplies the copy layer. Do not duplicate a finding across both — the
  copy flag names the page line, the Satchel row names the rule and route.
- For non-legal targets, run `scripts/legalscan.py clean` and `analyze` on the homepage and money pages
  (from the raw fetcher's text extraction) and report readability, passive share and AI-tell density as
  content-lens findings; skip the legal scan and never apply bar rules to a non-lawyer.
