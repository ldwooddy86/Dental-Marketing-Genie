#!/usr/bin/env python3
"""
legalscan.py — the deterministic engine behind LegalMarketingContent.Skill.

Three jobs, none of which require judgment:

  clean    Strip AI-generation artifacts that are safe to fix mechanically
           (em dashes, invisible Unicode, smart-quote drift, chat leakage).
  analyze  Score readability, passive voice, adverbs, and bullet density.
  scan     Extract every checkable legal claim and every bar-advertising
           trigger, with line numbers, so nothing gets verified by vibes.

Everything requiring judgment — rewriting, verifying, flagging — is left to
the model. The script's contract is: it never changes meaning, and it never
claims a legal fact is right or wrong. It only says "here is something a human
or a model has to check, and here is why."

Rule data lives in legal_rules.json next to this file so the skill can be kept
current without touching code.

Usage:
  python3 legalscan.py all      INPUT.md -o OUTPUT.md --json report.json
  python3 legalscan.py clean    INPUT.md -o OUTPUT.md [--emdash comma|hyphen|keep]
  python3 legalscan.py analyze  INPUT.md [--grade-target 10]
  python3 legalscan.py scan     INPUT.md [--state TX] [--json findings.json]
"""

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
RULES_PATH = os.path.join(HERE, "legal_rules.json")


def load_rules(path=RULES_PATH):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


# ----------------------------------------------------------------------------
# Shielding: never touch code, URLs, emails, shortcodes, or schema markup.
# ----------------------------------------------------------------------------

SHIELD_PATTERNS = [
    (re.compile(r"```.*?```", re.S), "codefence"),
    (re.compile(r"<script.*?</script>", re.S | re.I), "script"),
    (re.compile(r"<style.*?</style>", re.S | re.I), "style"),
    (re.compile(r"`[^`\n]+`"), "inlinecode"),
    (re.compile(r"https?://\S+"), "url"),
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b"), "email"),
    (re.compile(r"\[[^\]]+\][^\s]*"), "shortcode"),
    (re.compile(r"<[^>]{1,400}>"), "tag"),
]


class Shield:
    """Swap protected spans for placeholders, then restore them verbatim."""

    def __init__(self):
        self.store = {}
        self.n = 0

    def hide(self, text):
        for pat, kind in SHIELD_PATTERNS:
            def repl(m):
                self.n += 1
                key = f"\x00SH{self.n}\x00"
                self.store[key] = m.group(0)
                return key
            text = pat.sub(repl, text)
        return text

    def show(self, text):
        for key, val in self.store.items():
            text = text.replace(key, val)
        return text


# ----------------------------------------------------------------------------
# Pass 1 — mechanical clean
# ----------------------------------------------------------------------------

INVISIBLES = {
    "​": "", "‌": "", "‍": "", "﻿": "", "⁠": "",
    " ": " ", " ": " ", " ": " ", " ": " ",
}

SMART_MAP = {
    "‘": "'", "’": "'", "‚": "'", "‛": "'",
    "“": '"', "”": '"', "„": '"', "‟": '"',
    "′": "'", "″": '"',
}

CHAT_LEAKAGE = [
    r"^\s*(?:Certainly|Sure|Absolutely|Of course|Great question)[!,.].*$",
    r"^\s*I hope this helps.*$",
    r"^\s*Let me know if you.*$",
    r"^\s*(?:As an AI|I'm an AI|As a language model).*$",
    r"^\s*Here(?:'s| is) (?:the|a|your) (?:revised|updated|rewritten|cleaned).*$",
    r"^\s*Feel free to (?:let me know|reach out|ask).*$",
    r"^\s*\[?(?:Note|Disclaimer) to (?:the )?(?:user|editor|writer)\]?:.*$",
]

FILLER_LEADS = [
    (r"\bIt(?:'s| is) important to note that\s+", ""),
    (r"\bIt(?:'s| is) worth noting that\s+", ""),
    (r"\bIt should be noted that\s+", ""),
    (r"\bIt(?:'s| is) worth mentioning that\s+", ""),
    (r"\bNeedless to say,\s*", ""),
    (r"\bAs (?:we|you) (?:can see|know),\s*", ""),
    (r"\bIn order to\b", "To"),
    (r"\bDue to the fact that\b", "Because"),
    (r"\bAt this point in time\b", "Now"),
    (r"\bIn the event that\b", "If"),
    (r"\bPrior to\b", "Before"),
    (r"\bSubsequent to\b", "After"),
    (r"\bA (?:large )?number of\b", "Many"),
    (r"\bIn spite of the fact that\b", "Although"),
]


def clean_text(text, emdash="comma", quotes="straight", strip_chat=True):
    """Deterministic fixes only. Anything needing judgment is left alone."""
    shield = Shield()
    text = shield.hide(text)
    counts = Counter()

    for bad, good in INVISIBLES.items():
        if bad in text:
            counts["invisible_unicode"] += text.count(bad)
            text = text.replace(bad, good)

    if quotes == "straight":
        for bad, good in SMART_MAP.items():
            if bad in text:
                counts["smart_quotes"] += text.count(bad)
                text = text.replace(bad, good)

    # Em and en dashes — the single loudest AI tell in marketing copy.
    if emdash != "keep":
        repl = ", " if emdash == "comma" else " - "
        # spaced em dash
        n = len(re.findall(r"\s*[—–]\s*", text))
        if n:
            counts["em_en_dashes"] += n
            text = re.sub(r"\s*—\s*", repl, text)
            # en dash between digits is a range; keep those as hyphens
            text = re.sub(r"(?<=\d)\s*–\s*(?=\d)", "-", text)
            text = re.sub(r"\s*–\s*", repl, text)
        # doubled hyphens used as em dashes
        n2 = len(re.findall(r"\s*--\s*", text))
        if n2:
            counts["double_hyphen"] += n2
            text = re.sub(r"\s*--\s*", repl, text)

    n = len(re.findall(r"…", text))
    if n:
        counts["ellipsis_char"] += n
        text = text.replace("…", "...")

    # Ampersand between lowercase words is chat formatting, not house style.
    def amp_repl(m):
        counts["ampersand"] += 1
        return f"{m.group(1)} and {m.group(2)}"
    text = re.sub(r"\b([a-z]+) & ([a-z]+)\b", amp_repl, text)

    if strip_chat:
        for pat in CHAT_LEAKAGE:
            new, n = re.subn(pat, "", text, flags=re.M | re.I)
            if n:
                counts["chat_leakage"] += n
                text = new

    for pat, repl in FILLER_LEADS:
        new, n = re.subn(pat, repl, text, flags=re.I)
        if n:
            counts["filler"] += n
            text = new

    # Duplicate function words ("the the", "to to")
    new, n = re.subn(r"\b(the|a|an|to|of|and|is|in|for|that|with) \1\b", r"\1",
                     text, flags=re.I)
    if n:
        counts["duplicate_words"] += n
        text = new

    # Spacing hygiene
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    text = re.sub(r"(?<=[.!?]) {2,}(?=[A-Z])", " ", text)
    text = re.sub(r" {2,}", " ", text)

    # Capitalize after filler removal left a lowercase sentence start.
    def recap(m):
        return m.group(1) + m.group(2).upper()
    text = re.sub(r"([.!?]\s+|^)([a-z])", recap, text, flags=re.M)

    return shield.show(text), dict(counts)


# ----------------------------------------------------------------------------
# Pass 2 — readability, passive voice, bullets
# ----------------------------------------------------------------------------

VOWELS = "aeiouy"

IRREGULAR_PARTICIPLES = {
    "been", "begun", "brought", "built", "bought", "caught", "chosen", "come",
    "done", "drawn", "driven", "eaten", "fallen", "felt", "filed", "found",
    "given", "gone", "grown", "heard", "held", "hidden", "kept", "known",
    "laid", "led", "left", "lost", "made", "meant", "met", "paid", "put",
    "read", "run", "said", "seen", "sent", "set", "shown", "sold", "sought",
    "spent", "sworn", "taken", "taught", "thought", "told", "understood",
    "won", "written", "struck", "dealt", "upheld", "overturned", "overruled",
    "vacated", "affirmed", "reversed", "remanded", "denied", "granted",
    "awarded", "cited", "sued", "hurt", "injured", "harmed", "owed",
}

BE_FORMS = r"(?:is|are|was|were|be|been|being|am|get|gets|got|gotten|becomes?|became)"

ADVERB_EXCEPTIONS = {
    "only", "family", "early", "likely", "reply", "supply", "apply", "rely",
    "imply", "comply", "multiply", "ally", "belly", "jelly", "rally", "really",
    "holy", "ugly", "silly", "daily", "weekly", "monthly", "yearly", "friendly",
    "costly", "timely", "orderly", "elderly", "lonely", "lovely", "deadly",
}

SIMPLER = {
    "utilize": "use", "utilizes": "uses", "utilized": "used",
    "commence": "start", "commenced": "started", "commencing": "starting",
    "terminate": "end", "terminated": "ended",
    "endeavor": "try", "endeavors": "tries",
    "facilitate": "help", "facilitates": "helps",
    "demonstrate": "show", "demonstrates": "shows", "demonstrated": "showed",
    "subsequently": "later", "previously": "before", "additionally": "also",
    "approximately": "about", "sufficient": "enough", "numerous": "many",
    "obtain": "get", "obtains": "gets", "obtained": "got",
    "provide": "give", "provides": "gives", "requires": "needs",
    "purchase": "buy", "purchased": "bought", "assist": "help", "assists": "helps",
    "attempt": "try", "inquire": "ask", "regarding": "about", "concerning": "about",
    "pursuant to": "under", "in accordance with": "under", "notwithstanding": "despite",
    "aforementioned": "this", "heretofore": "until now", "thereafter": "after that",
    "compensation": "payment", "remuneration": "pay", "indicate": "show",
    "initiate": "start", "finalize": "finish", "ascertain": "find out",
    "elucidate": "explain", "ameliorate": "improve", "expedite": "speed up",
    "necessitate": "require", "aggregate": "total", "cognizant": "aware",
    "leverage": "use", "employ": "use", "component": "part", "portion": "part",
}


def syllables(word):
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    n = len(re.findall(r"[aeiouy]{1,2}", w))
    return max(1, n)


def prepare_prose(text):
    """
    Turn a marked-up document into the units a reader actually reads.

    This matters more than it looks. If you run a Flesch-Kincaid formula over
    raw markdown, a seven-item bullet block reads as one 86-word "sentence" and
    scores grade 38 — a number that is not wrong so much as meaningless, and
    that sends the editor chasing a problem that isn't there. Headings, list
    items, and table rows are separate reading units. Split them first, score
    them second.
    """
    text = re.sub(r"```.*?```", "\n", text, flags=re.S)
    text = re.sub(r"<(?:script|style)[^>]*>.*?</(?:script|style)>", "\n",
                  text, flags=re.S | re.I)
    blocks, buf = [], []

    for raw in text.split("\n"):
        line = raw.rstrip()
        stripped = line.strip()

        if not stripped:
            if buf:
                blocks.append(" ".join(buf))
                buf = []
            continue

        # Table rows are data, not prose.
        if stripped.startswith("|") or re.match(r"^\|?[\s:\-|]+\|?$", stripped):
            if buf:
                blocks.append(" ".join(buf))
                buf = []
            continue

        heading = re.match(r"^#{1,6}\s+(.*)$", stripped)
        bullet = re.match(r"^\s{0,8}(?:[-*+•‣●▪]|\d+[.)])\s+(.*)$", line)

        if heading or bullet:
            if buf:
                blocks.append(" ".join(buf))
                buf = []
            body = (heading or bullet).group(1).strip()
            if body:
                # A list item without terminal punctuation is still one unit.
                blocks.append(body if body[-1] in ".!?" else body + ".")
            continue

        buf.append(stripped)

    if buf:
        blocks.append(" ".join(buf))

    out = []
    for b in blocks:
        b = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", b)          # images
        b = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", b)       # links -> text
        b = re.sub(r"<[^>]+>", " ", b)                        # html tags
        b = re.sub(r"[*_]{1,3}([^*_]+)[*_]{1,3}", r"\1", b)   # emphasis
        b = re.sub(r"`([^`]*)`", r"\1", b)                    # inline code
        b = re.sub(r"\s+", " ", b).strip()
        if b and re.search(r"[A-Za-z]", b):
            out.append(b)
    return out


# Abbreviations that end in a period but do not end a sentence. Legal copy is
# dense with these, and a splitter that doesn't know them reports twice the
# sentence count and a wildly optimistic grade level.
ABBREVIATIONS = [
    "v.", "U.S.C.", "U.S.", "C.F.R.", "Inc.", "Corp.", "Co.", "Ltd.", "L.L.C.",
    "No.", "Nos.", "art.", "sec.", "Sec.", "Rev.", "Proc.", "Cir.", "Ct.",
    "App.", "Supp.", "Ed.", "et al.", "e.g.", "i.e.", "cf.", "Mr.", "Mrs.",
    "Ms.", "Dr.", "Jr.", "Sr.", "St.", "Ave.", "P.L.", "Stat.", "Reg.", "Op.",
    "Fed.", "Civ.", "Crim.", "Pa.", "Tex.", "Cal.", "Fla.", "N.Y.", "N.J.",
    "La.", "Ga.", "Ill.", "Mo.", "Ariz.", "Colo.", "Md.", "Mass.", "Ala.",
    "a.m.", "p.m.", "Esq.", "Assn.", "Dept.", "Div.", "Ch.", "Bankr.",
]


def _split_block(block):
    s = block
    for i, ab in enumerate(ABBREVIATIONS):
        s = s.replace(ab, f"\x01{i}\x01")
    parts = re.split(r"(?<=[.!?])[\"')\]]*\s+", s)
    out = []
    for p in parts:
        for i, ab in enumerate(ABBREVIATIONS):
            p = p.replace(f"\x01{i}\x01", ab)
        p = p.strip()
        if p and re.search(r"[A-Za-z]", p):
            out.append(p)
    return out


def split_sentences(text):
    sents = []
    for block in prepare_prose(text):
        sents.extend(_split_block(block))
    return sents


def words_of(s):
    return re.findall(r"[A-Za-z][A-Za-z'\-]*", s)


def fk_grade(text):
    sents = split_sentences(text)
    words = words_of(" ".join(sents))
    if not sents or not words:
        return 0.0, 0, 0
    syl = sum(syllables(w) for w in words)
    g = 0.39 * (len(words) / len(sents)) + 11.8 * (syl / len(words)) - 15.59
    return round(g, 1), len(sents), len(words)


def sentence_grade(s):
    words = words_of(s)
    if not words:
        return 0.0
    syl = sum(syllables(w) for w in words)
    return 0.39 * len(words) + 11.8 * (syl / len(words)) - 15.59


def find_passive(text):
    """Heuristic passive detection: be-form + past participle, agent optional."""
    hits = []
    for lineno, line in enumerate(text.split("\n"), 1):
        if line.strip().startswith(("```", "<", "|")):
            continue
        for m in re.finditer(
            rf"\b({BE_FORMS})\b(\s+(?:\w+ly|not|also|already|never|often|only|then|now))?\s+(\w+)",
            line, re.I,
        ):
            cand = m.group(3).lower()
            is_part = cand in IRREGULAR_PARTICIPLES or (
                cand.endswith("ed") and len(cand) > 4 and cand not in ADVERB_EXCEPTIONS
            )
            if not is_part:
                continue
            tail = line[m.end():m.end() + 40]
            by_agent = bool(re.match(r"\s+by\s+\w", tail))
            hits.append({
                "line": lineno,
                "text": m.group(0).strip(),
                "context": line.strip()[:160],
                "has_by_agent": by_agent,
            })
    return hits


def find_adverbs(text):
    hits = []
    for lineno, line in enumerate(text.split("\n"), 1):
        for m in re.finditer(r"\b(\w{4,}ly)\b", line):
            w = m.group(1).lower()
            if w in ADVERB_EXCEPTIONS:
                continue
            hits.append({"line": lineno, "word": m.group(1)})
    return hits


def analyze_bullets(text):
    """
    Bullet density is a real AI tell: models default to lists where a human
    would write connected prose. This measures how much of the document is
    fragmented into list items and flags the specific shapes that read as
    machine-generated.
    """
    lines = text.split("\n")
    total_words = len(words_of(text))
    bullet_lines, bullet_words = [], 0
    runs, cur = [], 0
    bold_lead = 0
    fragments = 0

    for i, line in enumerate(lines, 1):
        m = re.match(r"^\s{0,8}(?:[-*+•‣●▪]|\d+[.)])\s+(.*)$", line)
        if m:
            body = m.group(1).strip()
            bullet_lines.append(i)
            bullet_words += len(words_of(body))
            cur += 1
            if re.match(r"^\*\*[^*]{2,60}\*\*\s*[:—-]", body) or \
               re.match(r"^<strong>[^<]{2,60}</strong>\s*[:—-]", body, re.I):
                bold_lead += 1
            if len(words_of(body)) <= 5 and not body.endswith((".", "!", "?")):
                fragments += 1
        else:
            if cur:
                runs.append(cur)
            cur = 0
    if cur:
        runs.append(cur)

    pct = round(100.0 * bullet_words / total_words, 1) if total_words else 0.0
    longest = max(runs) if runs else 0
    return {
        "bullet_count": len(bullet_lines),
        "list_blocks": len(runs),
        "longest_run": longest,
        "pct_words_in_bullets": pct,
        "bold_lead_in_bullets": bold_lead,
        "fragment_bullets": fragments,
        "bullet_lines": bullet_lines,
        "runs": runs,
    }


def find_ai_tells(text, rules):
    phrases = rules["ai_tells"]["phrases"] + rules["ai_tells"]["legal_specific"]
    hits = []
    low = text.lower()
    for p in phrases:
        start = 0
        while True:
            idx = low.find(p, start)
            if idx == -1:
                break
            lineno = text.count("\n", 0, idx) + 1
            hits.append({"line": lineno, "phrase": p})
            start = idx + len(p)
    return hits


def find_simpler(text):
    hits = []
    low = text.lower()
    for hard, easy in SIMPLER.items():
        for m in re.finditer(rf"\b{re.escape(hard)}\b", low):
            hits.append({
                "line": text.count("\n", 0, m.start()) + 1,
                "word": hard, "suggest": easy,
            })
    return hits


def analyze(text, grade_target=10):
    rules = load_rules()
    grade, n_sents, n_words = fk_grade(text)
    sents = split_sentences(text)

    hard, very_hard = [], []
    for s in sents:
        w = len(words_of(s))
        g = sentence_grade(s)
        if w >= 14 and g >= grade_target + 4:
            very_hard.append({"grade": round(g, 1), "words": w, "text": s[:220]})
        elif w >= 14 and g >= grade_target + 1:
            hard.append({"grade": round(g, 1), "words": w, "text": s[:220]})

    passive = find_passive(text)
    adverbs = find_adverbs(text)
    bullets = analyze_bullets(text)
    tells = find_ai_tells(text, rules)
    simpler = find_simpler(text)

    passive_pct = round(100.0 * len(passive) / n_sents, 1) if n_sents else 0.0
    adverb_per_100 = round(100.0 * len(adverbs) / n_words, 1) if n_words else 0.0

    # Budgets. Hemingway's own guidance for a document this length, plus the
    # 10th-grade ceiling this skill is built around.
    budgets = {
        "grade": grade_target,
        "passive_pct": 10.0,
        "adverbs_per_100_words": 1.0,
        "very_hard_sentences": 0,
        "pct_words_in_bullets": 30.0,
        "longest_bullet_run": 7,
    }
    verdict = {
        "grade": grade <= grade_target,
        "passive": passive_pct <= budgets["passive_pct"],
        "adverbs": adverb_per_100 <= budgets["adverbs_per_100_words"],
        "very_hard": len(very_hard) == 0,
        "bullets": bullets["pct_words_in_bullets"] <= budgets["pct_words_in_bullets"]
                   and bullets["longest_run"] <= budgets["longest_bullet_run"],
        "ai_tells": len(tells) == 0,
    }

    return {
        "grade_level": grade,
        "sentences": n_sents,
        "words": n_words,
        "avg_sentence_words": round(n_words / n_sents, 1) if n_sents else 0,
        "passive_count": len(passive),
        "passive_pct": passive_pct,
        "passive_hits": passive[:80],
        "adverb_count": len(adverbs),
        "adverbs_per_100_words": adverb_per_100,
        "adverb_hits": adverbs[:60],
        "hard_sentences": hard[:40],
        "very_hard_sentences": very_hard[:40],
        "bullets": bullets,
        "ai_tells": tells[:80],
        "ai_tell_count": len(tells),
        "simpler_alternatives": simpler[:60],
        "budgets": budgets,
        "passes": verdict,
        "all_pass": all(verdict.values()),
    }


# ----------------------------------------------------------------------------
# Pass 3 — legal claim + bar advertising scan
# ----------------------------------------------------------------------------

def _lineno(text, idx):
    return text.count("\n", 0, idx) + 1


def _context(text, start, end, width=180):
    a = max(0, start - width // 2)
    b = min(len(text), end + width // 2)
    return re.sub(r"\s+", " ", text[a:b]).strip()


def detect_jurisdiction(text):
    """Infer the governing state from the copy so the right bar rules apply."""
    states = {
        "TX": r"\bTexas\b|\bTX\b|Houston|Dallas|Austin|San Antonio|Fort Worth|El Paso",
        "CA": r"\bCalifornia\b|\bCA\b|Los Angeles|San Diego|San Francisco|Sacramento|San Jose",
        "FL": r"\bFlorida\b|\bFL\b|Miami|Tampa|Orlando|Jacksonville|Fort Lauderdale",
        "NY": r"\bNew York\b|\bNYC?\b|Manhattan|Brooklyn|Queens|Buffalo|Long Island",
        "NJ": r"\bNew Jersey\b|\bNJ\b|Newark|Jersey City|Trenton",
        "PA": r"\bPennsylvania\b|\bPA\b|Philadelphia|Pittsburgh|Allentown",
        "IL": r"\bIllinois\b|\bIL\b|Chicago|Springfield, IL",
        "GA": r"\bGeorgia\b|\bGA\b|Atlanta|Savannah|Augusta",
        "LA": r"\bLouisiana\b|\bLA\b|New Orleans|Baton Rouge|Shreveport|Lafayette",
        "MO": r"\bMissouri\b|\bMO\b|St\.? Louis|Kansas City|Springfield, MO",
        "OH": r"\bOhio\b|\bOH\b|Columbus|Cleveland|Cincinnati",
        "AL": r"\bAlabama\b|\bAL\b|Birmingham|Montgomery|Mobile",
        "CO": r"\bColorado\b|\bCO\b|Denver|Colorado Springs|Boulder",
        "MD": r"\bMaryland\b|\bMD\b|Baltimore|Annapolis",
    }
    scores = {}
    for st, pat in states.items():
        n = len(re.findall(pat, text))
        if n:
            scores[st] = n
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    return {
        "detected": ranked[0][0] if ranked else None,
        "confidence": "high" if ranked and ranked[0][1] >= 3 else
                      ("low" if ranked else "none"),
        "signals": dict(ranked[:5]),
    }


# Words that mean the surrounding sentence is *refuting* a dead authority rather
# than relying on it. Corrected copy legitimately names Chevron in order to say
# it was overruled, and a scanner that re-flags its own fix teaches the editor to
# ignore it — which is how a real finding eventually gets waved through.
REFUTATION_CUES = re.compile(
    r"\b(?:overrul(?:ed|ing|es)|abrogat(?:ed|ing)|vacat(?:ed|ur|ing)|struck down|"
    r"set aside|superseded|supplanted|repealed|rescinded|revoked|no longer|"
    r"formerly|previously|until\s+20\d\d|prior to|used to|once required|"
    r"never took effect|did not take effect|is not (?:in force|current|good law)|"
    r"was (?:not|never)|eliminated|invalidated|reversed|replaced by|"
    r"has been (?:removed|withdrawn)|dead|defunct|obsolete|outdated)\b",
    re.I,
)


def _is_refutation(text, start, end, window=320):
    """True when the match sits inside language that already corrects it."""
    a = max(0, start - window)
    b = min(len(text), end + window)
    return bool(REFUTATION_CUES.search(text[a:b]))


def scan(text, rules, state=None, flag_refutations=False):
    findings = []
    suppressed = []

    def add(kind, severity, label, match, start, end, detail,
            refutable=False):
        item = {
            "kind": kind,
            "severity": severity,
            "label": label,
            "line": _lineno(text, start),
            "match": match[:200],
            "context": _context(text, start, end),
            **detail,
        }
        if refutable and _is_refutation(text, start, end):
            item["severity"] = "INFO"
            item["suppressed_reason"] = (
                "The surrounding text already describes this authority as dead "
                "(overruled, vacated, superseded, or similar), so this reads as a "
                "correct statement rather than reliance on bad law. Confirm the "
                "framing, then ignore.")
            if not flag_refutations:
                suppressed.append(item)
                return
        findings.append(item)

    # 1. Dead authority — cases overruled, rules vacated, provisions sunset.
    for rule in rules["dead_authority"]:
        for m in re.finditer(rule["pattern"], text, re.I):
            add("dead_authority", rule["severity"], rule["label"],
                m.group(0), m.start(), m.end(),
                {"why": rule["why"], "fix": rule["fix"], "source": rule["source"],
                 "rule_id": rule["id"]}, refutable=True)

    # 2. Stale figures — a specific old number that has a known current value.
    for rule in rules["stale_figures"]:
        for m in re.finditer(rule["pattern"], text, re.I):
            add("stale_figure", "HIGH", rule["label"],
                m.group(0), m.start(), m.end(),
                {"current": rule["current"], "source": rule["source"],
                 "fix": f"Replace with the current value: {rule['current']}"},
                refutable=True)

    # 3. Jurisdiction traps — state law that changed with an effective date.
    #    A trap from a state the page isn't about is still worth showing (copy
    #    gets recycled across markets, and the same sentence is often wrong in
    #    both places), but it shouldn't outrank a trap for the governing state.
    governing = state or (detect_jurisdiction(text)["detected"]
                          if detect_jurisdiction(text)["confidence"] == "high"
                          else None)
    for rule in rules["jurisdiction_traps"]:
        for m in re.finditer(rule["pattern"], text, re.I):
            mismatch = governing is not None and rule["state"] != governing
            if state and mismatch:
                continue  # user pinned a state explicitly; respect it
            detail = {"why": rule["why"], "fix": rule["fix"],
                      "source": rule["source"], "state": rule["state"]}
            if mismatch:
                detail["cross_state_note"] = (
                    f"This page reads as {governing}, not {rule['state']}. The "
                    f"language still matched, which usually means either the copy "
                    f"was recycled from another market or the same claim is wrong "
                    f"in both states. Confirm which body of law governs before "
                    f"acting on this.")
            add("jurisdiction_trap", "MEDIUM" if mismatch else "HIGH",
                f"[{rule['state']}] {rule['label']}"
                + (" (cross-state)" if mismatch else ""),
                m.group(0), m.start(), m.end(), detail, refutable=True)

    # 4. Temporal language — claims that decay silently.
    tl = rules["temporal_language"]
    for m in re.finditer(tl["pattern"], text, re.I):
        add("temporal", tl["severity"], "Time-decaying language",
            m.group(0), m.start(), m.end(),
            {"why": tl["why"],
             "fix": "Add a dated qualifier ('as of August 2026') or rewrite to a "
                    "timeless formulation."})

    # 5. Bar advertising triggers.
    for rule in rules["bar_triggers"]:
        for m in re.finditer(rule["pattern"], text, re.I):
            add("bar_rule", rule["severity"], rule["label"],
                m.group(0), m.start(), m.end(),
                {"rule": rule["rule"], "fix": rule["fix"], "trigger_id": rule["id"]})

    # 6. Checkable claims — the verification worklist.
    claims = defaultdict(list)
    for ex in rules["claim_extractors"]:
        for m in re.finditer(ex["pattern"], text):
            claims[ex["id"]].append({
                "line": _lineno(text, m.start()),
                "match": m.group(0)[:160],
                "context": _context(text, m.start(), m.end(), 140),
                "label": ex["label"],
                "note": ex.get("note", ""),
            })

    order = {"BLOCKER": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    findings.sort(key=lambda f: (order.get(f["severity"], 9), f["line"]))

    return {
        "jurisdiction": detect_jurisdiction(text),
        "state_filter": state,
        "findings": findings,
        "severity_counts": dict(Counter(f["severity"] for f in findings)),
        "kind_counts": dict(Counter(f["kind"] for f in findings)),
        "suppressed": suppressed,
        "suppressed_count": len(suppressed),
        "claims_to_verify": {k: v for k, v in claims.items()},
        "claim_counts": {k: len(v) for k, v in claims.items()},
        "total_claims": sum(len(v) for v in claims.values()),
    }


# ----------------------------------------------------------------------------
# Reporting
# ----------------------------------------------------------------------------

def print_analysis(a, title="READABILITY & STYLE"):
    b = a["budgets"]
    p = a["passes"]
    tick = lambda ok: "PASS" if ok else "FAIL"
    print(f"\n=== {title} ===")
    print(f"  Words {a['words']}   Sentences {a['sentences']}   "
          f"Avg sentence {a['avg_sentence_words']} words")
    print(f"  Reading grade      {a['grade_level']:>6}  "
          f"(target <= {b['grade']})   {tick(p['grade'])}")
    print(f"  Passive voice      {a['passive_pct']:>5}%  "
          f"({a['passive_count']} of {a['sentences']}; budget {b['passive_pct']}%)"
          f"   {tick(p['passive'])}")
    print(f"  Adverbs /100w      {a['adverbs_per_100_words']:>6}  "
          f"({a['adverb_count']} total; budget {b['adverbs_per_100_words']})"
          f"   {tick(p['adverbs'])}")
    print(f"  Very hard sents    {len(a['very_hard_sentences']):>6}  "
          f"(budget 0)   {tick(p['very_hard'])}")
    print(f"  Hard sentences     {len(a['hard_sentences']):>6}")
    bl = a["bullets"]
    print(f"  Words in bullets   {bl['pct_words_in_bullets']:>5}%  "
          f"({bl['bullet_count']} bullets in {bl['list_blocks']} lists; "
          f"longest run {bl['longest_run']}; budget {b['pct_words_in_bullets']}% "
          f"/ run {b['longest_bullet_run']})   {tick(p['bullets'])}")
    if bl["bold_lead_in_bullets"]:
        print(f"     -> {bl['bold_lead_in_bullets']} bold-lead-in bullets "
              f"(**Term:** text) — a strong AI tell")
    if bl["fragment_bullets"]:
        print(f"     -> {bl['fragment_bullets']} fragment bullets (<=5 words)")
    print(f"  AI-tell phrases    {a['ai_tell_count']:>6}  (budget 0)   "
          f"{tick(p['ai_tells'])}")

    if a["very_hard_sentences"]:
        print("\n  VERY HARD sentences (split these):")
        for s in a["very_hard_sentences"][:10]:
            print(f"    [grade {s['grade']}, {s['words']}w] {s['text']}")
    if a["ai_tells"]:
        top = Counter(h["phrase"] for h in a["ai_tells"]).most_common(12)
        print("\n  AI-tell phrases found:")
        for ph, n in top:
            print(f"    {n:>3}x  {ph}")
    if a["simpler_alternatives"]:
        top = Counter((h["word"], h["suggest"]) for h in
                      a["simpler_alternatives"]).most_common(12)
        print("\n  Simpler alternatives:")
        for (w, s), n in top:
            print(f"    {n:>3}x  {w} -> {s}")
    if a["passive_hits"]:
        print(f"\n  Passive constructions (first 10 of {a['passive_count']}):")
        for h in a["passive_hits"][:10]:
            agent = " [has 'by' agent]" if h["has_by_agent"] else ""
            print(f"    L{h['line']}: {h['text']}{agent}")


def print_scan(s):
    print("\n=== LEGAL & COMPLIANCE SCAN ===")
    j = s["jurisdiction"]
    print(f"  Jurisdiction detected: {j['detected'] or 'NONE'} "
          f"(confidence: {j['confidence']}; signals: {j['signals']})")
    if not j["detected"]:
        print("     -> No state detected. Ask the user which state's law and bar "
              "rules govern before verifying anything state-specific.")
    sc = s["severity_counts"]
    print(f"  Findings: {len(s['findings'])} "
          f"(BLOCKER {sc.get('BLOCKER',0)}, HIGH {sc.get('HIGH',0)}, "
          f"MEDIUM {sc.get('MEDIUM',0)}, LOW {sc.get('LOW',0)})")
    print(f"  Checkable claims extracted: {s['total_claims']} "
          f"{s['claim_counts']}")
    if s.get("suppressed_count"):
        print(f"  Suppressed {s['suppressed_count']} match(es) that sit inside "
              f"language already correcting them (re-run with --flag-refutations "
              f"to see them).")

    for sev in ("BLOCKER", "HIGH", "MEDIUM", "LOW"):
        group = [f for f in s["findings"] if f["severity"] == sev]
        if not group:
            continue
        print(f"\n  --- {sev} ({len(group)}) ---")
        for f in group[:40]:
            print(f"  L{f['line']:>4} [{f['kind']}] {f['label']}")
            print(f"        match: {f['match']}")
            if f.get("why"):
                print(f"        why:   {f['why'][:300]}")
            if f.get("current"):
                print(f"        now:   {f['current']}")
            if f.get("rule"):
                print(f"        rule:  {f['rule'][:300]}")
            if f.get("fix"):
                print(f"        fix:   {f['fix'][:250]}")
            if f.get("source"):
                print(f"        src:   {f['source']}")
        if len(group) > 40:
            print(f"        ... and {len(group)-40} more (see --json)")

    if s["claims_to_verify"]:
        print("\n  --- VERIFICATION WORKLIST ---")
        print("  Each of these is a dated or checkable assertion. Verify against a "
              "Tier 1/2 source and record the as-of date.")
        for kind, items in s["claims_to_verify"].items():
            if not items:
                continue
            print(f"\n  [{kind}] {items[0]['label']} — {len(items)} instance(s)")
            if items[0].get("note"):
                print(f"        {items[0]['note']}")
            for it in items[:12]:
                print(f"    L{it['line']:>4}: {it['match']}")
            if len(items) > 12:
                print(f"    ... and {len(items)-12} more")


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------

def read_input(path):
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        return fh.read()


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    for name in ("clean", "analyze", "scan", "all"):
        p = sub.add_parser(name)
        p.add_argument("input")
        p.add_argument("-o", "--output")
        p.add_argument("--json", dest="json_out")
        p.add_argument("--grade-target", type=int, default=10)
        p.add_argument("--emdash", choices=["comma", "hyphen", "keep"], default="comma")
        p.add_argument("--quotes", choices=["straight", "keep"], default="straight")
        p.add_argument("--state", help="Two-letter state code to scope bar rules")
        p.add_argument("--flag-refutations", action="store_true",
                       help="Also report dead-authority matches that sit inside "
                            "language already correcting them. Off by default so "
                            "re-scanning your own corrected copy stays clean.")
        p.add_argument("--rules", default=RULES_PATH)

    args = ap.parse_args()
    text = read_input(args.input)
    rules = load_rules(args.rules)
    report = {"input": args.input, "rules_version": rules["_meta"]["version"]}

    if args.cmd in ("clean", "all"):
        before = analyze(text, args.grade_target)
        cleaned, counts = clean_text(text, args.emdash, args.quotes)
        report["mechanical_fixes"] = counts
        report["before"] = before
        out = args.output or (os.path.splitext(args.input)[0] + "_cleaned" +
                              os.path.splitext(args.input)[1])
        with open(out, "w", encoding="utf-8") as fh:
            fh.write(cleaned)
        print(f"\n=== MECHANICAL CLEAN ===")
        print(f"  Wrote: {out}")
        if counts:
            for k, v in sorted(counts.items(), key=lambda kv: -kv[1]):
                print(f"    {v:>4}  {k}")
        else:
            print("    (no mechanical artifacts found)")
        report["output"] = out
        text_for_analysis = cleaned
    else:
        text_for_analysis = text

    if args.cmd in ("analyze", "all"):
        a = analyze(text_for_analysis, args.grade_target)
        report["analysis"] = a
        print_analysis(a, "READABILITY & STYLE (after mechanical clean)"
                       if args.cmd == "all" else "READABILITY & STYLE")
        if args.cmd == "all":
            b = report["before"]
            print(f"\n  Before -> after: grade {b['grade_level']} -> "
                  f"{a['grade_level']}, passive {b['passive_pct']}% -> "
                  f"{a['passive_pct']}%, AI tells {b['ai_tell_count']} -> "
                  f"{a['ai_tell_count']}")

    if args.cmd in ("scan", "all"):
        # Always scan the ORIGINAL text. Mechanical cleaning can only obscure a
        # legal claim (it rewrites the em dash a testimonial attribution hangs
        # off, for instance), never create one — and line numbers that point at
        # the source file are the ones an editor can actually act on.
        s = scan(text, rules, args.state, args.flag_refutations)
        report["scan"] = s
        print_scan(s)

    if args.cmd in ("analyze", "scan"):
        pass

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2)
        print(f"\n  JSON report: {args.json_out}")

    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
