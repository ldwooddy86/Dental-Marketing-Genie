# Codebook

Every counted item gets five codes: **topic**, optional **topic2**, **intent**, **stance** and
**flags**. Rooms get topic, topic2 and flags. Code from the item itself (title, and the opening text
when you have it), never from what you know about the author or the outlet.

## Unit

One item is one thread, post, article, video or message. A forum thread is coded from its opening post;
replies are engagement, not new items. A newsletter issue is not an item; each curated link in it is.

## Topic (primary)

The topic is what a reader would say the item is **about**: the subject that would still be true if
the headline were rewritten. Use the nome's taxonomy (`assets/nomes.json`).

Tie-breakers, in order:

1. **Tactic over platform.** "How to rank a Business Profile for many keywords" is local search, not
   Google. "Meta Advantage+ budgets" is Meta ads.
2. **Mechanism over money.** A pricing change to an ad product goes to the ad product's topic; a
   report about budgets or spend across channels goes to strategy and budgets.
3. **The change, not the company.** A product launch by an AI company goes to the topic it changes
   (ads in AI assistants, agentic commerce); the model race itself goes to the AI platform topic.
4. **Measurement is its own topic** only when the item is about how results are measured, attributed
   or reported. "How to segment SEO data for multi-location brands" is measurement if the point is the
   reporting method, local search if the point is ranking locations. When genuinely split, take the
   one the headline's verb acts on and put the other in topic2.
5. **Other** is for items outside the nome (a hardware launch, a headset) that the frame happened to
   include. Do not force them into a topic; the Other share is itself a measure of frame noise.

## Topic2

Optional. Use it when a second topic is substantial, not merely mentioned. Never repeat the primary.
Topic2 counts at half weight in the reach view and never in share of voice.

## Intent

| Code | Meaning | Decision rule |
|---|---|---|
| **Q** | Question, help-seeking | The author asks for an answer or a method, including "how do I..." titles on the floor |
| **C** | Complaint, vent, pain report | Something went wrong for the author: traffic lost, account banned, results collapsed |
| **R** | Result, data, study, case | The item's value is evidence: a test result, a dataset, a case study, a ranking-factor study |
| **H** | How-to, guide | The item teaches a method; the author is the one answering |
| **N** | News, announcement | Something new happened or shipped; the item reports it |
| **D** | Debate, opinion, prediction | The item argues, warns, predicts or interprets |
| **P** | Promotion, sales, vendor pitch | The item sells; usually also Set-flagged |
| **J** | Jobs, hiring, career moves | Hiring, layoffs as personal news, career advice |
| **O** | Other | Introductions, meta, humour |

Rules that fixed the disagreements in the first reliability run:

- **Floor titles phrased as methods are Q unless the author is answering.** "How to delete negative
  Google reviews" posted to a Telegram channel that trades tactics is H when the post teaches it and Q
  when it asks. Read the first lines before coding.
- **A result that went badly is C when the author is venting, R when the author is reporting data.**
  "13k visits on day 3, then under 1k a day" is R if it presents numbers for others to learn from,
  C if it asks why it happened.
- **Briefings and "warns" pieces are D when the item interprets, N when it reports.** A newsletter
  briefing that argues a thesis is D; a wire story that quotes a warning is N.
- **Tests announced by platforms are N; tests run by practitioners are R; guides to running a test
  are H.**

## Stance

From the point of view of practitioners in the nome: **+1** opportunity or optimism, **0** neutral or
mixed, **-1** threat or pessimism. Code the item, not the topic: a neutral report of a spam update is 0;
"the update wiped out my sites" is -1.

## Flags

- **set**: spam, sponsored or paid content, self-promotion, engagement or follower selling, pirated
  or group-buy tool access, off-topic scams. Kept in the ledger, excluded from share of voice.
- **grey**: grey-hat or terms-of-service-risky tactics (PBNs, parasite hosting, review manipulation,
  fake engagement, cloaking, forced indexing, Business Profile number tricks, bot plays or streams).
  Counted, tallied separately.

An item can carry both. A sponsored post by a vendor is set, not grey, unless it sells a grey tactic.

## Rooms

Code a room by what it is **built around**, from its directory description and tags: the nome topic it
exists for (topic), a secondary purpose (topic2), and flags (set for follower sellers, promotion-only
servers and traffic exchanges; grey for rooms that trade grey tactics). The census is about the room,
not any one message.

## Reliability check (required before publishing)

1. Draw a blind, seeded random sample of counted items with codes stripped:
   `python scripts/horus_kappa.py --ledger <ledger> --draw 60 --seed 7 --sample-out blind.json`
2. Give `blind.json` and this codebook to one second coder: a person, or a single subagent with no web
   access and no sight of the first codes. One coder, one pass; never a swarm.
3. Score: `python scripts/horus_kappa.py --ledger <ledger> --second second_coder.json --out <stem>.kappa.json`
4. Topic kappa below 0.61 means the codebook is not doing its job. Sharpen the rules where the coders
   split, recode, and rerun on a fresh sample. Report kappa for topic, cluster and intent in the
   limitations and on the dashboard.
