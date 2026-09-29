# ORACLE — the AI-search doctrine of UltimaWeapon (GEO / AEO / AI visibility)

`reckoning.md` Phase 7 ("Be the answer") is the audit; this file is the doctrine: how the answer engines choose what to
say and whom to cite, what an operator can move, how to measure it without inventing numbers, how it changes by company
type, the fixes as specs, and what to re-verify live — this surface changes monthly and every specific below is dated.

Two Articles bind harder here than anywhere: **no invented numbers** (there is no "AI ranking" API; every visibility
statement is a screenshot, a referral row in GA4, a GSC AI metric, or a citable-footprint count you assembled) and **no
guarantees** (nobody can promise a citation).

## 1 · The engines and how they choose (mechanisms, not marketing)

**Google AI Overviews and AI Mode.** One system now (reports say the two merged into a continuous experience in May 2026
and that Overviews auto-expand into full AI Mode answers for some queries since late August 2026 — verify what the SERP
does for the client's queries). Mechanism: **query fan-out** — the model decomposes the query into sub-queries, retrieves
from the Google index (Googlebot; there is no separate switch), the Knowledge Graph, the Shopping Graph and Maps, then
composes an answer with citations. Consequences: (1) pages that rank in the top results for the *sub-queries* are the
citation pool, so classic SEO is the entry ticket; (2) content that answers one sub-question cleanly gets quoted more than
a page that answers everything vaguely; (3) entities the Knowledge Graph knows are named more confidently; (4) Shopping
Graph data (Merchant Center feeds, `Product` schema) is what appears in shopping answers; (5) local answers pull from
profiles and reviews. Controls: `nosnippet` / `max-snippet` / `data-nosnippet` remove text from Overviews (and from
snippets — the same control); `noindex` removes the page; robots blocking Googlebot removes everything; the GSC
opt-out toggle for AI features and AI-specific reporting (reported June–August 2026 rollout — verify the exact controls
and what the metrics count). Sponsored text links inside AI Mode were reported in test in September 2026 — verify; the
paid module treats them as a placement to watch.

**ChatGPT (search and shopping).** Retrieval via OpenAI's own crawler (`OAI-SearchBot` for the search index,
`ChatGPT-User` for user-initiated fetches; `GPTBot` is training only) plus a Bing-backed index — **Bing presence is a
prerequisite** (submit in Bing Webmaster Tools; IndexNow helps freshness). Answers cite pages; shopping answers use merchant
product feeds (OpenAI published a product-feed spec in 2025) and, where enabled, agentic checkout through the Agentic
Commerce Protocol (announced with Stripe, Sept 2025; verify current merchant program status). Blocking `GPTBot` does not
remove a site from ChatGPT search; blocking `OAI-SearchBot` does.

**Perplexity.** Own index (`PerplexityBot`; `Perplexity-User` for user fetches), real-time retrieval, heavy weighting of
recently updated pages and of a small set of "authoritative" domains per topic; Sponsored follow-up questions and a
merchant program exist (verify). Cites more sources per answer than Google; listicles and comparison pages are
over-represented in its citations.

**Claude, Gemini, Copilot, Meta AI, Grok, DeepSeek.** Claude's web search cites fetched pages (`Claude-SearchBot` /
`Claude-User`; `ClaudeBot` trains); Gemini uses Google's index and the same grounding as AI Mode; Copilot uses Bing;
Meta AI uses Bing and Google results (verify); Grok uses X posts plus web. For a client, the practical set to track is:
Google (AI Overviews/AI Mode), ChatGPT, Perplexity, Gemini, Copilot, Claude — six columns in the Prompt Tracker.

**What all of them reward** (the consensus from citation studies through 2026; treat percentages as vendor estimates):
being on page one for the fan-out sub-queries; a clear, extractable answer near the top of the page; **third-party
corroboration** (the brand appears in listicles, review platforms, Reddit/forum threads, news, YouTube, Wikipedia/Wikidata
— assistants triangulate, they do not trust a site about itself); entity clarity (consistent name, one Knowledge
Panel, `Organization` schema with `sameAs`, an About page with facts); freshness with visible dates; author and reviewer
credentials for YMYL; crawlability for the retrieval bots; and **brand mention volume** across the open web (unlinked
mentions matter here far more than in classic link-based ranking).

**What they punish or ignore:** JS-only content (most retrieval bots do not render), gated or paywalled answers, pages
that bury the answer under 800 words of preamble, inconsistent facts across the web (three founding years, two addresses
→ the model hedges or picks a rival), thin AI-generated content (Google's scaled-content-abuse policy also applies),
robots blocks on the retrieval bots, and slow or erroring pages at fetch time.

## 2 · What is observable from here

| Signal | From here | How |
|---|---|---|
| robots.txt posture per AI bot; llms.txt; snippet controls; schema; answer-first structure; brand-fact consistency across site/GBP/directories | **Observed** | `google_crawler.py crawl` (AI_BOTS_BLOCKED), `satchel_web.py scan`, `justice_schema.py`, fetches |
| Citable footprint (listicles, directories, forums, news that come back for the buying-intent searches) | **Observed** (search sample + fetch) | WebSearch "best [x] in [y]", "[x] reviews", "top [x]", "[x] vs [rival]"; fetch each; record client/rival presence |
| Bing index presence | **Partly** | `site:` via a screenshot from Bing; Bing Webmaster Tools export |
| The actual AI answers and citations | **Not observable** (chat UIs blocked from here) | the Prompt Tracker protocol: the client/operator runs the prompt set monthly and attaches screenshots or exports |
| AI referral traffic | **Export** | GA4 session source/medium with a regex over the assistant domains |
| GSC AI metrics | **Export/screenshot** | the AI features report if present (verify) |
| Knowledge Panel state | **Screenshot** | google.com/search?q=<brand> from the market |

## 3 · The audit protocol

**3.1 Readiness (fetched facts).** Bot posture table (bot × allow/block × source line) with the retrieval-vs-training split
made explicit; `llms.txt` present/valid; snippet controls that would suppress citation on money pages (`nosnippet`,
`max-snippet:0`) — sometimes an inherited plugin setting; JS-dependency of money pages (`google_crawler.py render`);
schema entity graph (`Organization`/`LocalBusiness` with `sameAs`, `Person` authors, `Product`, `FAQPage`); an About page with
the **brand facts** (legal name, founding year, HQ, leadership, what it sells, prices/ranges where public, service area,
credentials, awards with conferring bodies); consistent facts across the site, GBP, LinkedIn, Crunchbase/Wikidata (if
present), directories; visible publish/updated dates; author pages with credentials; answer-first formatting (the
question as an H2, the answer in the first two sentences, then evidence; tables for comparisons; lists for steps).

**3.2 Citable footprint.** For each of 8–15 buying-intent queries, fetch the pages that come back and record: URL, type
(listicle / directory / forum / news / review platform / video / vendor), whether the client appears, which rivals appear,
publication date, and whether the page is itself likely to be cited (it ranks; it is a list; it is fresh). The client's
share of appearances across those pages is the **AI-visibility proxy** the report grades. Zero coverage while a rival is in
every listicle is a Watch item and the first content/PR ticket.

**3.3 Prompt Tracker.** 10–25 prompts across four intents — *discovery* ("best [service] in [city]", "top [category]
software for [use case]"), *comparison* ("[client] vs [rival]", "alternatives to [rival]"), *validation* ("is [client]
legit", "[client] reviews", "[client] pricing"), *task* ("how do I [job the client does]") — × six engines × monthly.
Columns: platform, prompt, date, brand mentioned (Y/N), client site cited (Y/N + URL), rivals named, sources cited (URLs),
sentiment/accuracy notes, screenshot file. The first run is the client's or operator's task unless screenshots were
supplied; the tally reports **share of voice** (prompts where the client is named ÷ prompts) and **citation share** per
engine, as counts, never as percentages of an unknown universe.

**3.4 Hallucination and accuracy audit.** Prompt each engine "tell me about [client]" and "what does [client] cost / where
is it / who runs it"; log every false statement with the source the engine cited; each becomes a fix: correct the source
(GBP, directory, an old press mention), publish the fact on the About page and in schema, and — for notable entities — a
Wikidata item with references (Wikipedia only where notability is real; never astroturf).

**3.5 Referral measurement.** GA4 regex for `source` (assistant domains: `chatgpt.com|chat.openai.com|perplexity.ai|
gemini.google.com|copilot.microsoft.com|claude.ai|you.com|meta.ai|duckduckgo` — AI Overviews/AI Mode clicks arrive as
`google / organic` and are not separable in GA4; GSC's AI reporting is the only Google-side count), landing pages,
sessions, key events; reported as a **floor** ("at least N sessions were assistant referrals; Google AI clicks are inside
organic"). Server logs add the retrieval-bot fetch counts per URL (`google_crawler.py verify-googlebot` verifies the
search-engine ones; AI bots verify by their published ranges where they publish them — OpenAI and Perplexity publish IP
lists; verify).

**3.6 Content and entity gaps.** Which sub-questions in the fan-out have no client page (or a weak one); which comparison
pages the rivals own; which review platforms (G2/Capterra for SaaS, Healthgrades for clinics, Avvo for law, Trustpilot
for e-commerce, Yelp/GBP for local) carry rivals and not the client; which subreddits and forums discuss the category;
whether YouTube has a channel with the money topics (YouTube is heavily cited by Google's answers).

## 4 · Company-archetype playbooks

- **Local services:** the pack + reviews + listicles are the corpus; agentic booking/calling (reported 2026) makes hours,
  phone answering and booking links AI-facing; prompts are city-bound; GBP Q&A and services fields feed local answers;
  a "cost of [service] in [city]" page with a real range wins "how much" prompts.
- **E-commerce:** Merchant Center feed quality (titles, GTINs, images, price/availability accuracy, shipping/returns) is
  the shopping-answer input for Google; a public product feed for ChatGPT shopping (per OpenAI's spec) and the Perplexity
  merchant program are decisions to put to the client; `Product` schema with reviews; category pages with buying-guide
  content; comparison and "best [category] for [need]" content; presence on the review platforms the engines cite;
  agentic checkout (ACP / Google's agent payments protocols, announced 2025–2026 — verify) as a roadmap item, not a promise.
- **SaaS / B2B:** G2, Capterra, TrustRadius, Reddit, Hacker News, Product Hunt, Stack Overflow and GitHub are the
  corroboration layer; "alternatives to [leader]" and "[category] pricing" pages; documentation crawlable and indexable;
  transparent pricing page (assistants quote it); founder/expert authorship; original data (surveys, benchmarks) is the
  most-cited asset class; LinkedIn company facts consistent.
- **Healthcare:** YMYL — reviewed-by credentials, citations to primary sources (PubMed, guidelines), no cure claims
  (Satchel W9), practitioner entities, Healthgrades/Zocdoc, condition + treatment + location pages answer-first; HIPAA
  applies to chat widgets that collect PHI.
- **Legal:** practice + jurisdiction + question pages ("statute of limitations for X in [state]") with the statute cited and
  dated; attorney author entities with bar numbers; Avvo/Justia; bar rules on any "best lawyer" claims the AI might quote
  back (`bar-advertising.md`).
- **Finance:** disclosures inside the answer block (APR ranges, "rates vary"); regulator registry consistency (NMLS, FINRA,
  state licenses); no guarantees; product comparison tables; the Satchel's financial overlay.
- **Publishers / media:** the licensing/opt-out decision (GSC toggle, `nosnippet`, bot blocks vs the traffic those engines
  send — quantify with the referral floor before advising); byline entities; original reporting is cited, aggregation is
  not; the reported "AI Contribution" publisher program (Sept 2026 — verify) as a watch item.
- **Nonprofits / education / government-adjacent:** program facts, eligibility, dates, and locations answer-first; Wikidata
  for real institutions; `.gov`/`.edu` citations are heavily trusted — earn them.
- **App-first:** store listings (title, subtitle, description, reviews) are assistant sources; the marketing site should
  carry the same facts; "best [category] apps" listicles are the corpus (`references/apps.md`).
- **Agencies and B2B services (the overlay's focus):** the corroboration layer is Clutch/G2/UpCity/DesignRush and client
  case studies; claims the AI repeats ("#1 agency") are claims the Satchel screens.

## 5 · Fixes as specs

**Answer-first page pattern:** H1 = the topic; a 40–60-word direct answer in the first paragraph; H2s phrased as the
questions people ask (from GBP query data, GSC queries, People-Also-Ask screenshots, forum threads); a comparison table
where a choice exists; a "last updated" date that is real; author box with credentials; sources cited with links; FAQ
block (5–8) with `FAQPage` JSON-LD; internal links to the money page with descriptive anchors; no 300-word intro.

**Brand-facts page (About) + `Organization` graph:** legal name, brand name, founded, HQ, locations, leadership (as
`Person` with `sameAs` to LinkedIn), what it sells, who it serves, pricing model, service area, licenses/certifications
with numbers and issuing bodies, awards with conferring body and year, press mentions (linked), contact; JSON-LD
`Organization` with `sameAs` (GBP, LinkedIn, Crunchbase, Wikidata if any, socials), `logo`, `foundingDate`, `address`,
`contactPoint`; the same facts mirrored on GBP, LinkedIn, and the directories.

**robots.txt AI-bot block (a decision, not a default):**
```
# Retrieval / assistant search bots — ALLOW if you want to be cited
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: DuckAssistBot
Allow: /

# Training-only bots — BLOCK if the client does not want to feed training (does not affect search or AI Overviews)
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: CCBot
User-agent: Bytespider
User-agent: meta-externalagent
User-agent: Google-Extended
User-agent: Applebot-Extended
Disallow: /
```
State the tradeoff in one paragraph for the owner: blocking training bots costs nothing visible today; blocking retrieval
bots removes the brand from those assistants' answers; Google's AI features cannot be split from Google Search except via
snippet controls and the GSC toggle. For publishers add the Content-Signal line if the CDN honors it (verify).

**llms.txt (llmstxt.org format):** `# [Brand]` → blockquote one-line summary → a short paragraph of facts → `## Services` /
`## Locations` / `## Pricing` / `## Docs` / `## About` sections, each a bulleted list of `[title](absolute URL): one-line
description` → `## Optional` for secondary pages; keep it under ~200 lines; optionally `/llms-full.txt` with the key pages'
markdown. Label it in the playbook as cheap and unproven.

**Corroboration plan (quarterly):** 3 listicle inclusions (pitch with a real differentiator), 2 review-platform profiles
completed + review velocity, 1 original-data piece (survey/benchmark/price index) for press, 2 forum/community
contributions by a named human (no astroturf), 1 YouTube explainer per money topic, 1 local/trade-press story, Wikidata
item where notability exists, consistent LinkedIn/Crunchbase facts.

**Prompt Tracker SOP:** the prompt set (from §3.3) in a sheet; monthly, same week, logged-out or a clean profile, the
market's location; screenshot each answer; fill the columns; note changes; ship in the tally.

## 6 · Measurement and KPIs (all hedged)

Share of voice and citation share per engine (Prompt Tracker counts); citable-footprint coverage (client appearances ÷
citable pages); assistant referral sessions and key events (GA4 floor); GSC AI-feature impressions/cited pages (if the
report exists — verify); Bing index coverage (BWT); retrieval-bot fetch counts (logs); brand-mention volume (search
sample; a vendor mention tool's export if supplied, labeled). Milestones: "named in 4 of 12 discovery prompts within 90 days
is plausible if the listicle and review work lands" — never a guarantee.

## 7 · Deliverable shape

Workbook tabs: **AI Readiness** (item × observed × fix), **Bot Posture**, **Citable Footprint** (query × page × type ×
client/rivals × date), **Prompt Tracker** (the protocol sheet, pre-filled with the prompt set), **Brand Facts** (fact ×
site × GBP × LinkedIn × directories × consistent Y/N), **AI Referrals** (from GA4). Report: *AI Visibility* section with
the honest line ("no AI-visibility API exists; this is assembled from N fetched pages, M screenshots, GA4 referrals").
CSV section *AI Visibility*. Playbook: the answer-first spec, the About/Organization spec, the robots block with the
tradeoff paragraph, the llms.txt draft (full text), the corroboration plan, the Prompt Tracker SOP.

## 8 · Fallbacks and refusals

| Situation | Adjustment |
|---|---|
| No screenshots of AI answers | the Prompt Tracker ships as a protocol with the prompt set; share of voice is NOT ASSESSED this run, and the report says so in Scope |
| A vendor "AI visibility" export is supplied | ingest as a vendor estimate with its method named; never merge it into observed counts |
| Asked to "get us into ChatGPT's answers" as a guarantee | the mechanisms above, the corroboration plan, and no promise |
| Asked to mass-generate AI content for citations | no — scaled content abuse; propose the original-data and answer-first plan instead |
| Asked to astroturf Reddit/forums or seed fake reviews | no (FTC 16 CFR 465; platform rules); the named-human contribution plan instead |
| Publisher asks whether to block Google's AI | quantify the referral floor and the organic dependence first; present the toggle/snippet/bot options as the client's decision with the tradeoffs |

## 9 · Volatility register (re-read live; this file is dated 2026-09)

Google's AI Overviews/AI Mode documentation and the Search Central pages on AI features, snippet controls, and any GSC AI
reporting/opt-out; Google's crawler list (Google-Extended semantics); OpenAI's crawler page (`platform.openai.com/docs/
bots`) and product-feed / ACP merchant docs; Perplexity's bot and merchant pages; Anthropic's crawler page; Microsoft's
Bing Webmaster and IndexNow docs; the llmstxt.org spec; Cloudflare's AI-crawler and Content-Signal docs; OpenAI/
Perplexity published IP ranges; Google's spam policies (scaled content abuse; site reputation abuse); the latest citation
studies (Ahrefs, Semrush, SE Ranking, BrightEdge, Seer — all vendor estimates); the state of sponsored placements inside
AI answers (Google, Perplexity, Microsoft) for the paid module.
