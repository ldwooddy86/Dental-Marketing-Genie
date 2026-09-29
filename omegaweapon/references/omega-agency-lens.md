# The agency lens: what digital marketing companies are doing

Every OmegaWeapon run reads the agency behind the target. When the target *is* an agency (or a martech vendor, a
review or directory platform, a lead-gen network), the lens becomes the whole run: Justice on its client book, the
digital-marketing overlay on its own site, War Chest and Megaphone on its own ads, and the digital marketing nome's
edition on what it sells. This file is the protocol; the depth lives in `justice.md`, `digital-marketing-overlay.md`,
`satchel.md`, and the Horus references.

## 1 · The agency of record (every run, ten minutes)

Three observable tests, in this order, each recorded as evidence with its confidence:

1. **Footer credit.** The raw scan lists `footer.external_footer_links` and `footer.credits`. "Website by", "Designed
   by", "Powered by", "SEO by", "Digital marketing by" with a link is the strongest signal; the ingest records the anchor,
   the linked domain and on how many scanned pages it appears. Plausible at two pages, Confirmed when the linked agency's
   own site lists the client (a portfolio page or a case study, fetched).
2. **RDAP registrant and nameservers.** The registrant or admin org is the agency, or the nameservers are the agency's
   (`satchel_web.py rdap`). Ownership of the domain by the agency is a finding in itself (lock-in; see §3).
3. **The shared tag stack.** The GTM container, GA4 property, call-tracking account, chat key or review-widget key also
   appears on other client sites of the same agency (a quoted-ID search, or the Justice roll call). One ID on three
   unrelated sites is an agency-owned container.

No credit, a privacy-proxied registrant and no shared IDs is "no agency of record identified", and the Agency Fit pillar
reads ?. Never guess an agency from a design style.

4. **The Radar match (automatic, the `radar` phase).** The agency of record is matched against the Agency Radar
   registry (`assets/radar/radar.json`) by domain, then by exact name. A match attaches the dossier block
   (`of_record.radar`: archetype, segment, ownership, what it leads with, its Horus read, its say-and-do tests, its
   gaps) as observed context, dated to the Radar's compile date; the Agency lens tab shows it and the app links it to
   the full dossier, where the target joins the agency's audited book (its Omega tab). The block is context for §3 and
   §5, never a grade: the Radar's read of an agency's own house does not move the client's Agency Fit, which is the
   inherited share of this run's findings and nothing else. An agency not in the Radar is not a lesser agency; it is an
   untracked one, and the delivery says so with the offer to add it (`omega-platform.md`).

## 2 · Inherited against owned (the split that decides who fixes what)

Every High and Medium finding is tagged inherited or owned in `modules.agency.inherited_vs_owned[]`:

| Inherited (the agency's template, stack or process) | Owned (the client's own decisions) |
|---|---|
| JS-rendered primary content on a template, missing canonicals, duplicate titles across a page type, the same unused JS bundle, hero video pattern, font sprawl, self-serving `aggregateRating` in the template's JSON-LD, the wrong `@type` for the trade, the agency's own Organization or sameAs left in the client's schema, the agency container firing pixels pre-consent, footer badge links with optimised anchors, doorway city-page templates, the same "#1 / award-winning / guaranteed" copy the agency ships to every client, the review widget injecting reviews client-side, Impressum or consent template defects on EU-facing sites | review response rate, GBP fields, the offer and pricing decisions, staffing that answers the phone, the copy the client wrote, the ad account the client runs, the app the client's own team ships, licensing and registrations, the decision to run a special-category ad |

The Agency Fit grade is the inherited share of High and Medium findings (`assets/grading.json`): a site where most of
what is wrong was shipped by the agency is an agency problem, and the playbook says so by owner. The roadmap's owner
column follows the split; a fix at the template level clears the book, and the delivery says that in one line with the
reverse Justice offer.

## 3 · The claims screen on the agency itself (overlay §2 to §6)

When the run reaches the agency's own site (a full run always fetches its homepage once the credit is read; a Justice
run reads it fully), the observable claims are tested and recorded in `modules.agency.claims[]` with a disposition:

- Partner and certification badges (Google Partner or Premier, Meta Business Partner, Microsoft, Shopify, HubSpot,
  Klaviyo, Semrush) against the program directories where one exists; a badge with no directory entry is CANDIDATE with
  the directory query recorded, never "fake".
- Awards ("Top 10 agency", Clutch, UpCity, DesignRush, Expertise.com, Forbes Council) traced to a conferring body and a
  fee model; pay-to-play is disclosed or it is a §2 row.
- Testimonials and case studies against 16 CFR 255 and 465 (material connections, typical results, insider testimonials).
- Guarantees ("page one in 90 days", "guaranteed leads") against 16 CFR 239 and the state UDAP mirror.
- "As seen on" against the syndication trail (a paid press release is not coverage).
- "You own your website" against the RDAP registrant and the container ownership from §1.
- Outreach infrastructure: look-alike sending domains (RDAP under 90 days, no DMARC, no site) tied to the agency by
  nameserver or registrant; received cold emails (.eml) against CAN-SPAM, TCPA, PECR and UWG §7 with the SPF, DMARC and
  RDAP evidence.
- Chatbots and AI receptionists against EU AI Act Art. 50, Cal. B&P §§17940 to 17943 and Utah's act, with the threshold
  control applied before any row is written.

Self-audit posture (the operator's own agency, or a client that is an agency asking about itself) runs overlay §8 first:
tickets with owners and fixes, no routes, never blended with a competitor workbook.

## 4 · The shared measurement layer

`modules.agency.shared_layer[]` lists every container, property, pixel, call-tracking and widget ID seen on the target
and on which other domains it was seen. One ID across unrelated clients means data co-mingling (every client's
conversions in one property), lock-in (the client cannot leave with its data), and one point of compromise (a
compromised container reaches every client). Rule hooks are GDPR Art. 28 and CCPA §7051 for EU and California data and
the platforms' terms; the ceiling is CANDIDATE until the agency's own terms and the data-processing agreement are read.
The fix is always the same: a client-owned container and property with the agency as a user, tags exported first.

## 5 · The Pattern Verdict (when the target is an agency)

Justice Phases 0 to 9 run: the Roll Call from the agency's own mouth, badge-text searches, reverse-image links and the
hosting fingerprint; reconnaissance tiering (RAW, TEXT, WAF); the Speed Trial; the Schema Tribunal; the Index
Interrogation; the technical and entity pass; per-site verdicts; and the Pattern Verdict, where prevalence at or above
40 percent of the trial set is platform-level. The twelve agency axes from overlay §7 (shared measurement layer, domain
and DNS ownership, footer badge link scheme, duplicate copy, doorway templates, schema templates, consent posture, speed
profile, accessibility posture, review-widget provenance, claims uniformity, outreach infrastructure) fill
`modules.agency.pattern_verdict.axes[]` with prevalence, severity, two example URLs and the template-level fix. Recall is
bounded and said so: "N confirmed of an estimated book of thousands". The opening is framed as opportunity, never as a
smear, never as a guaranteed outcome.

## 6 · What agencies are selling against what the floor says works

The digital marketing nome (`assets/nomes.json`, flagship, with a complete first edition in `assets/editions/`) is the
industry read for this lens on any target. The agency's visible offer (its services pages, its case studies, what it
shipped on the client's site, its ads when exports or screenshots exist) is set against the edition's measurement: which
topics are broadcast-led (the platforms and press pushing something the floor has not operationalised), which are
floor-led (practitioners living with something the press ignores), which carry pain, which are grey.
`modules.agency.industry_alignment[]` records one row per practice: the practice, the floor's stance with the edition's
topic id, whether the agency is selling or shipping it, and the read (a sellable gap, a hype purchase, a hold). This is
where "what digital marketing companies are doing" becomes a measured statement rather than an impression: the edition
says what the industry is talking about and where the money is moving; the run says what this agency does about it.

When the edition is more than a quarter old the row says so, and a fresh Horus edition of the digital marketing nome is
offered as its own job.

## 7 · Deliverable shape

Dashboard: the Agency lens tab (of record, inherited against owned, shared layer, claims screen, outreach, Pattern
Verdict, industry alignment, self-audit tickets). Workbook, when files are wanted: the Justice tabs (Roll Call, Speed
Trial, Schema Tribunal, Index Interrogation, Pattern Verdict, Verify Docket, Sources) and an Agency Lens tab. Report:
Part III, The Tribunal, when Justice ran; otherwise one section inside Part I with the of-record line, the inherited
share and the reverse Justice offer. Every claim row and every pattern axis links to the page it is about.

## 8 · Fallbacks and refusals

| Situation | Adjustment |
|---|---|
| Footer credit is an image with no link | Read the alt text and the image filename; Weak confidence; verify against the agency's portfolio |
| The agency's site is a JS shell or walled | NOT_TESTED for the claims screen; the credit and the shared layer still stand |
| The client asks for the agency to be named in a public complaint | Not this skill's call: the claims screen ships with routes and the reporter-reputation cost; filing is the client's decision with counsel |
| The operator's own agency is the agency of record | Self-audit posture, overlay §8, tickets with owners, no routes; said plainly at the top |
| Asked to scrape LinkedIn, an ad library or a review platform to build the agency's book | No; the Roll Call uses the agency's own mouth, badge searches, reverse-image links for the operator's browser and the hosting fingerprint |
