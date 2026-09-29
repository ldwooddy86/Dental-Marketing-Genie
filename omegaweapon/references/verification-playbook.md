# Verification Playbook

Read this before your first lookup. It is a map of what actually works, tested
live, and — more importantly — an honest account of what free sources cannot do.

## The three rules

**1. Verify the fetch, not just the URL.** A 200 response is not evidence.
`statutes.capitol.texas.gov` silently returns its homepage for a bad path, with a
200 status. That is the most dangerous failure mode available, because it looks
exactly like a successful verification. **Always confirm the content you got back
actually contains the section number you asked for.**

**2. Justia does not flag overruled cases.** Not with a banner, not with a note,
not anywhere. Its *Chevron* page — for a case overruled in June 2024 — contains no
mention of *Loper Bright* at all. Note the asymmetry: the **overruling** case
announces itself clearly (the *Dobbs* page states outright that *Roe* and *Casey*
"must be overruled"), but the **overruled** case stays silent. Verification works
forward, never backward.

**3. "Citation verified" and "still good law" are different claims.** Blurring
them is the most likely way this skill produces a dangerously false "verified."
Carry two distinct verdicts and never merge them:

- ✅ **Citation verified** — the case exists; name, cite, court, and year match.
  Justia is sufficient evidence for this.
- ⚠️ **Validity NOT verified** — the default for **every** case-law claim,
  because no free source reports negative treatment.

Required language in a flag:

> Citation confirmed accurate via Justia. Free sources cannot confirm this case
> has not been overruled or abrogated; Justia displays no treatment flags
> (confirmed: its *Chevron* page carries no indication of the 2024 *Loper Bright*
> overruling). Attorney review with a paid citator required before publication.

---

## Source hierarchy

**Tier 1 — primary and authoritative. Cite directly in a flag.**
supremecourt.gov slip opinions and orders · govinfo.gov (GPO-authenticated U.S.
Code, public laws, Federal Register) · ecfr.gov (current CFR, with its as-of date)
· circuit court sites · official state legislature sites where fetchable ·
agency primary documents (IRS Notice PDFs, SSA actuarial pages, EEOC statute
pages) · state bar rule PDFs from official bar media servers

**Tier 2 — reliable reproductions of primary law. Cite, but attribute to Justia
and state the code year.**
law.justia.com/codes · supreme.justia.com · law.justia.com/cases ·
law.justia.com/constitution (the CRS-annotated Constitution)

**Tier 3 — use to find things, never as the evidence itself.**
WebSearch results · Justia dockets (filings ≠ outcomes) · Cornell LII · FindLaw ·
Oyez

**Never cite:** law firm blogs, Wikipedia, AI-generated summaries, or other
marketing pages — especially other firms' pages, which are frequently the origin
of the error being checked.

**Practical rule:** if a flag tells an attorney a claim is wrong, it must link to
Tier 1 or Tier 2. If only Tier 3 supports it, the flag reads "could not verify,"
not "incorrect."

---

## Justia

### SCOTUS — supreme.justia.com

Two addressing schemes, and picking the wrong one gives a 404:

| Era | Pattern |
|---|---|
| Case with an assigned U.S. Reports page | `/cases/federal/us/{volume}/{page}/` |
| Recent case (page not yet assigned) | `/cases/federal/us/{volume}/{docket}/` |

**Critical gotcha:** `/cases/federal/us/597/215/` **404s** even though 597 U.S.
215 is *Dobbs*' correct official citation — Justia still files it under docket
`19-1392`. **For any case from roughly 2018 onward, look it up by docket number,
not by page.** A 404 is usually your path error, not a fake citation.

By year: `https://supreme.justia.com/cases/federal/us/year/2025.html` — a
chronological list with case name, docket, date, and summary. Good for "did SCOTUS
decide anything on X in 2025?"

Finding a case by name: Justia's own search is not fetch-friendly. Use
`WebSearch(query: "<case name>", allowed_domains: ["supreme.justia.com"])`.

A case page reliably carries: syllabus, full opinions, Justia's plain-English
"Primary Holding," argued and decided dates, and docket number.

### State statutes — law.justia.com/codes

**The highest-value Justia vertical for this work** — limitations periods,
damages caps, comparative fault.

Year-scoped, and the current edition has **no year in the path**:
- Current: `https://law.justia.com/codes/texas/civil-practice-and-remedies-code/...`
- Historical: `https://law.justia.com/codes/texas/2019/...`
- Year index: `https://law.justia.com/codes/texas/`

**Gotcha:** you must include every hierarchy level. `.../title-2/chapter-16/` 404s;
`.../title-2/subtitle-b/chapter-16/subchapter-a/section-16-003/` works.

Verified working limitations-period URLs:

| State | URL | Result |
|---|---|---|
| TX | `law.justia.com/codes/texas/civil-practice-and-remedies-code/title-2/subtitle-b/chapter-16/subchapter-a/section-16-003/` | 2 years (2025 code) |
| CA | `law.justia.com/codes/california/code-ccp/part-2/title-2/chapter-3/section-335-1/` | 2 years (2025 code) |
| PA | `law.justia.com/codes/pennsylvania/title-42/chapter-55/section-5524/` | 2 years (2025 code) |
| GA | `law.justia.com/codes/georgia/title-9/chapter-3/article-2/section-9-3-33/` | 2 years (**2024** code) |

**Always report the code year Justia displays.** It is not uniformly current —
Georgia resolved to 2024 while Texas, California, and Pennsylvania resolved to
2025 — and a stale edition is exactly how a wrong limitations period survives
review.

### Other Justia verticals

- Circuits: `law.justia.com/cases/federal/appellate-courts/ca5/` (`ca1`–`ca11`,
  `cadc`, `cafc`). Individual opinion: `/{docket}/{docket}-{YYYY-MM-DD}.html` —
  the docket appears **twice**.
- State supreme courts: `law.justia.com/cases/{state}/supreme-court/{year}/`
- Constitution: `law.justia.com/constitution/us/amendment-01/`
- State hub: `law.justia.com/texas/` — good entry point when you don't know a
  state's code structure.
- Dockets: `dockets.justia.com/browse/state-texas/court-txndce`. The `/search?`
  endpoint returns 500 — use `/browse/` paths. **Dockets show filings only, not
  outcomes; never cite a docket as evidence of a verdict or settlement.**

---

## .gov sources

### Works cleanly ✅
`supremecourt.gov` · `govinfo.gov` · `ecfr.gov` · `federalregister.gov` (including
its JSON API) · `irs.gov` (including PDFs) · `ssa.gov` · `eeoc.gov` · circuit
subdomains like `ca9.uscourts.gov` · `nysenate.gov` · `flsenate.gov` · `ilga.gov`
· `codes.ohio.gov` · `www-media.floridabar.org`

### Blocked — do not retry ❌
`congress.gov` · `www.uscourts.gov` · `courtlistener.com` ·
`scholar.google.com` · `leginfo.legislature.ca.gov` · `legis.state.pa.us` ·
`texasbar.com` · `americanbar.org`

### Patterns worth memorizing

- **SCOTUS slip opinions by term:** `supremecourt.gov/opinions/slipopinion/25`
  (`25` = October Term 2025). Returns case, docket, date, PDF link.
- **Opinion PDFs:** `supremecourt.gov/opinions/{YY}pdf/{docket}_{hash}.pdf`
- **U.S. Code (govinfo):**
  `govinfo.gov/content/pkg/USCODE-{year}-title{N}/html/USCODE-{year}-title{N}-chap{C}-subchap{S}-sec{X}.htm`
- **Public laws:** `govinfo.gov/content/pkg/PLAW-118publ42/html/PLAW-118publ42.htm`
  — note **`publ`**, not "public."
- **Federal Register JSON** — the cleanest way to check whether a rule is final,
  proposed, or withdrawn:
  `federalregister.gov/api/v1/documents.json?conditions[term]=...&per_page=3&order=newest`
- **eCFR:** `ecfr.gov/current/title-{N}/subtitle-{L}/chapter-{ROMAN}/part-{N}` —
  **it stamps an as-of date.** Quote that date in any flag.

> **Worked example of why eCFR matters:** it currently shows the FLSA
> white-collar threshold at **$684/week** and HCE at **$107,432** — i.e., the 2024
> DOL increase is not in force. Any page citing $1,128/week or $151,164 is stating
> current law incorrectly, and eCFR proves it in one fetch.

### State legislature sites

Roughly half are robots-blocked or JavaScript-heavy. **Try the official site
first for authority; fall back to Justia for text, and say which one you used.**

| State | URL pattern | Status |
|---|---|---|
| **NY** | `nysenate.gov/legislation/laws/CVP/214` (`CVP` = CPLR) | ✅ clean |
| **FL** | `flsenate.gov/Laws/Statutes/2024/95.11` | ✅ clean |
| **IL** | `ilga.gov/legislation/ilcs/fulltext.asp?DocName=073500050K13-202` | ✅ works |
| **OH** | `codes.ohio.gov/ohio-revised-code/section-2305.10` | ✅ includes effective dates |
| **TX** | `statutes.capitol.texas.gov/Docs/CP/htm/CP.16.htm` | ⚠️ **silently serves the homepage** — use Justia |
| **CA / PA / GA** | — | ❌ blocked or JS-heavy — use Justia |

> **Worked example:** Fla. Stat. § 95.11(5)(a) now reads "WITHIN TWO YEARS — An
> action founded on negligence." Florida cut its negligence limitations period
> from four years to two in March 2023 (HB 837). A very large amount of Florida PI
> copy still says four years, and one fetch settles it.

### State bar advertising rules

`texasbar.com` and `americanbar.org` are both unreachable. **The workaround that
works: bar-published PDFs on media subdomains.** The Florida Bar's advertising
handbook fetches cleanly from `www-media.floridabar.org` and yields quotable rule
text. General approach: `WebSearch("{state} bar" advertising rules filetype:pdf)`
and fetch the PDF directly rather than the bar's HTML site.

---

## Checking whether a case is still good law

There is no free Shepard's or KeyCite equivalent. This is a real gap, not a
tooling oversight.

| Source | Citator function | Reachable |
|---|---|---|
| Justia | **None.** No citing references, no treatment flags | ✅ but useless for this |
| CourtListener | Best free option — "Cited By," Authorities, and a citation-lookup API built to catch hallucinated cites | ❌ blocked |
| Google Scholar | "How Cited" tab, closest free analogue | ❌ blocked |
| The courts' own sites | Full text of the *newer* case, which states what it overrules | ✅ but you must already know which case to read |

Even where CourtListener is reachable, be precise about what it does: it gives
**citing references, not treatment signals.** It will tell you 400 cases cite
*Chevron*; it will not tell you which one killed it.

**The practical workaround:**

1. Confirm the case exists and the citation is accurate — Justia, by volume/page
   or by docket for recent cases.
2. Run a targeted negative-treatment search, the only forward-looking check
   available:
   `WebSearch("<case name>" overruled OR abrogated OR "no longer good law" OR superseded)`
   This catches famous reversals and is **unreliable for anything obscure**.
3. **Check the subject-matter frame.** If the claim rests on a doctrine that moved
   recently — agency deference, arbitration, Second Amendment, standing and
   universal injunctions, reverse discrimination, mass-tort preemption — escalate
   automatically regardless of what the search returned.
4. **Check statutory supersession separately.** A case can be perfectly good law
   and still describe a statute that was amended. Cases and statutes need
   independent checks — Florida's limitations change is the canonical example.
5. **State the limit explicitly** in the flag.

---

## Fetch behavior — traps

- **A 200 with wrong content is the worst outcome.** Texas's statutes site does
  exactly this. Confirm the section number appears in what came back.
- **Fetch summarization can garble URL patterns.** Trust the URL you successfully
  fetched, not a description of the pattern.
- **PDFs fetch and parse well** — IRS notices, SCOTUS opinions, bar handbooks.
  Often the best route around a robots-blocked HTML site.
- **Justia 404s are usually your path error.** Retry with the docket-number form
  (SCOTUS) or add the missing hierarchy levels (codes) before concluding anything.
- **Blocked-source substitutions:** congress.gov → **govinfo.gov** · CA/PA/GA/TX
  official sites → **law.justia.com/codes** (report the code year) · bar HTML
  sites → **bar PDFs via WebSearch `filetype:pdf`** · domain search → `WebSearch`
  with `allowed_domains`.

---

## What to record for every verified claim

A verification you cannot reproduce is not a verification. For each one, log:

1. The claim as written, with its line number
2. The source URL you actually fetched
3. The specific text that confirmed or contradicted it
4. The source's own as-of date — eCFR stamps one, Justia displays a code year,
   agency pages carry a tax or benefit year
5. The date you checked
6. Your verdict: **current** / **stale** / **could not verify**

That last option is a real answer and belongs in the report. "Could not verify"
with a note on what you tried is more useful to an attorney than a confident
guess, and far more useful than silence.
