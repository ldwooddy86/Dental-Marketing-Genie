# Anubis: the weighing of each company (the deep dossier doctrine)

Every tracked agency gets a written dossier that a strategist can act on: what the company is doing and focusing
on, who its clients are and what they came for, what its own house shows, how the market reads it, where it can be
beaten, and what to watch. The dossier is written from the spine and nothing else. The spine is the agency's own
public record as the Radar compiled it, plus the computed reads (needs, Horus, Monsoon, openings). If a fact is not in
the spine it is not in the dossier. Anubis weighs; it does not invent.

## The seven parts, in order

| Key | Length | What it holds |
|---|---|---|
| `bluf` | 60 to 110 words | Who they are in one line, what they are doing now, where the record says they are going, the one thing a rival should know. Written last, placed first. |
| `doing` | 180 to 320 words | What it sells and how it positions (decode the positioning line and the headline claim in plain words); the sold mix with the evidence behind the lines it leads with (name the proprietary products and the partners the record lists); its AI posture in plain terms; recent moves in date order; pricing signals; what is conspicuously absent from a company of its kind. |
| `clients` | 150 to 300 words | Who it serves (client type, verticals, home markets); the named clients with what the evidence says they came for (need codes with the observed signal: a case study title, a press release, a URL slug); the clients that also appear on other tracked agencies' books; how much of the book is names only; what the client base needs next, as a judgment tied to the edition's key judgments, hedged in ICD 203 words. |
| `house` | 70 to 160 words | Say and do: the tests on its own house (llms.txt, own ads, pixels, tools, publishing cadence, channels), the gaps the Radar flagged, the tag stack and CMS, content velocity, AI crawler posture. Contradictions are stated flatly with the evidence. |
| `market` | 80 to 180 words | The Horus read: tailwind index and band, the judgments it is best placed for and most exposed to with the capabilities driving them, scenario fit, the moves P1 to P8 it is making, partial on, or not making; the Monsoon read: index and band, migration against displacement, where the work would go, observed footprint or inferred. |
| `openings` | 90 to 200 words | Where it can be beaten: the computed openings turned into judgments (which clients or verticals are contestable, which contradiction or gap to lead with, which offer undercuts it), each in ICD 203 language with a confidence word, and one falsifier for the strongest judgment. |
| `watch` | 3 to 6 items | Indicators with what a change would mean for the read: the edition indicators the spine lists, a dated move to follow up, the next Radar compile. Each item one sentence. |

Plain English, no theater, no dashes. Every dossier is written for a strategist about to compete with the agency,
not for the agency. Numbers carry their source in the sentence ("its Transparency Center record shows 147 ads, 69 in
the last 30 days"; "the sitemap lists 534 URLs updated in 90 days"); never a bare number. Dates are the record's
dates. The tense is present for what the record shows now and past for dated moves.

## The evidence rules

1. **Nothing outside the spine.** No knowledge of the agency from anywhere else, however sure you are. If the spine
   is silent, the dossier says the record is silent ("the record lists no pricing model", "no case study describes
   the work"). Silence is a finding.
2. **Every figure traces.** A number in the narrative must appear in the spine (counts, dates, shares, scores,
   indices). No arithmetic on the record beyond what the spine already computed; no rounding that changes a figure
   except an index quoted to the nearest whole number.
3. **Every name traces.** Clients, products, partners, owners and hub cities come from the spine. Founders and
   executives appear only as the record names them and only in their public role. No other person is named.
4. **Observed against inferred.** A capability score with an evidence note is observed; a need code with a signal is
   observed; a need with no signal is inferred from the sold mix and the sentence says so; the Horus and Monsoon reads
   are computed from published tables and are quoted as reads, not facts. Absence of evidence is not evidence: "no
   hub office listed" is not "no offshore delivery".
5. **Judgments wear ICD 203 words** (almost no chance; very unlikely; unlikely; roughly even chance; likely; very
   likely; almost certain) with a confidence word (low, moderate, high) where the evidence is thin, and the strongest
   opening carries the observation that would prove it wrong.
6. **Verbs about the artifact.** The record "lists", "shows", "names", "credits", "describes"; the agency "sells",
   "leads with", "publishes", "runs". Never "is guilty of", never "claims to be the best" as a fact; a claim is quoted
   as a claim.
7. **The client's need is what the evidence says the client came for.** A case study titled "Website Relaunch" is a
   web build need; a press release naming a media agency of record is a paid media need; a logo with no described
   work is a name only, and the need is inferred from what the agency leads with, said as such.

## Style rules the validator enforces

- No em dashes, no en dashes, anywhere. Write with commas, colons and full stops. Avoid hyphens where a plain
  alternative exists (ecommerce, first party data, multi location, B2B stays B2B).
- No filler: never "delve", "landscape", "leverage", "robust", "seamless", "holistic", "elevate", "empower",
  "unlock", "navigate", "cutting edge", "game changer", "it is worth noting", "in conclusion", "testament to".
- No bullet lists inside the prose sections; paragraphs separated by a blank line. The watch list is the only list.
- No headings inside sections; the app supplies them.
- Third person, the agency by name or "it"; the reader is "a rival" or "a strategist", never "you".
- Sentences carry their evidence class when it matters: "(observed)" is implied by a quoted source; write "inferred"
  or "the record is silent" when it is.

## Output

One JSON object per agency, saved as `assets/radar/dossiers/<id>.json`:

```
{"id": "<agency id>", "written": "YYYY-MM-DD", "model": "<model id of the writer>", "bluf": "...", "doing": "...",
 "clients": "...", "house": "...", "market": "...", "openings": "...", "watch": ["...", "...", "..."],
 "revised": {"date": "YYYY-MM-DD", "model": "<model id>", "sections": ["clients", "bluf", "openings"], "why": "..."}}
```

`model` names the writer and `revised` (only when a later pass rewrote part of it) names the reviser and the
sections it touched. Both travel into the registry with the text and show on the Dossier tab, in the markdown
export, in the book and in the CSV (`dossier_model`, `dossier_revised`), so a reader always knows who wrote what.

`python3 scripts/radar_dossier.py validate` checks every file (shape, lengths, dashes, figures against the record,
names against the record, URLs against the record, filler) and `merge --write` attaches the clean ones to the
registry; `python3 scripts/omega_platform.py build-app` puts them in the app and `radar_dossier.py book` prints the
book. A dossier that fails validation is not shipped until it passes.

## The writing pass (how the narratives get written without burning the budget)

The spine is cheap and complete for every agency; the narrative is the expensive half, and it is budgeted work.

1. `python3 scripts/radar_needs.py rebuild --write`, then `python3 scripts/radar_dossier.py spine --write --briefs
   briefs/`: one brief per agency (`briefs/<id>.md`), the spine rendered for a writer, with the figures, names and
   URLs the validator will accept.
2. Order the work by prominence: the ten most prominent agencies first, then the next tier, and stop where the
   budget says. `radar_deepen.py missing` shows which of them are names only; deepen those from the agency's own
   site before writing (`radar_deepen.py run <id> --write --add-clients`, then step 1 again for that agency), because
   a narrative written over a names only book can only say "inferred from the sold mix".
3. One agency per writer call, Fable 5.1 by default (another model only on the person's say, recorded in the file's
   `model` field), local file I/O only (the brief in, the JSON out): no web, no connector, no
   tool that asks for permission. A writer that reads the record and the brief needs nothing else. Do not fan out
   more writers than the session's rate limit carries; a terminated writer leaves nothing behind, so a small steady
   batch beats a large one that dies.
4. `validate --fix` (removes dashes, reports everything else), fix by hand what the validator names, `merge --write`,
   `omega_platform.py build-app`, and `radar_dossier.py book`.
5. Keep every clean narrative from an earlier pass. `assets/radar/dossiers/` is the source of truth and `merge` never
   drops a file; a later pass adds to it. An agency without a narrative shows its spine with a line saying the
   weighing is not yet written, in the app and in the book, and that is an honest state, not a defect.

## Refreshing

A dossier is rewritten when its spine changes: a Radar recompile, a `radar_deepen.py` pass on the agency (the
bounded honest fetch of its own sitemap and pages that adds dated case studies, news, jobs and the ATS to the record,
and with `--add-clients` the case study clients), a new Horus edition, or an OmegaWeapon run on the agency's own domain
(which lands on its Omega tab and is the deepest read of all). The `written` date on the dossier and the `compiled`
date on the spine tell the reader how fresh each half is.

When the evidence is re-read under a written narrative (a deepen pass, a taxonomy change), the client counts can move.
The validator checks every count the narrative states (clients named, observed, names only) against the spine and
reports a mismatch as a `counts:` finding. `merge` still attaches such a narrative, marked `stale: counts` with the
figures of record, and the Dossier tab, the markdown export and the book print a "counts superseded" note beside the
clients section: the tables are the figures of record until the narrative is refreshed. The refresh rewrites the
clients section from the new brief and corrects the counts in the bluf and the openings; everything else stays. Any
other finding (a figure, a name or a URL not in the record, a dash, filler) keeps a narrative out of the registry.
