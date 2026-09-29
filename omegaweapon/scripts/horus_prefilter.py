#!/usr/bin/env python3
"""HORUS prefilter (the Winnowing).

Turns raw collected items into coding candidates for one nome:
  - keeps items inside the edition window
  - drops duplicates (same canonical URL, or the same normalised title from the same platform)
  - caps any one floor author (pseudonym) at --max-per-author items so one loud voice cannot fill the floor
  - suggests up to two topics from the nome's keyword lists (title hits weigh double)
  - suggests Set flags (spam, sponsored, group-buy, engagement selling) and grey flags from patterns
  - assigns provisional ledger ids (S### broadcast, M### floor) in date order
The suggestions are a head start for the coder. They are never the code of record: every item is
read and coded by hand against references/CODEBOOK.md before it enters a ledger.

Usage:
  python horus_prefilter.py --nome digital-marketing --raw raw.jsonl --out candidates.json
                            [--window 2026-09-01:2026-09-30] [--max-per-author 5] [--nomes assets/nomes.json]
Raw items (collector export, JSONL or a JSON list): id, eye, lane, platform, community, date (or ts),
title, text, url, engagement. Pure standard library.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SET_PATTERNS = [
    (r"\bgroup[- ]?buy\b", "group-buy tool access"),
    (r"\b(shared|cheap|discounted?)\s+(accounts?|seats?|subscriptions?)\b", "resold accounts or seats"),
    (r"\bbuy\s+(followers|likes|views|subscribers|reviews|streams|upvotes)\b", "engagement selling"),
    (r"\b(sub4sub|follow4follow|f4f|l4l|engagement pod)\b", "engagement exchange"),
    (r"\b(promo|coupon|referral)\s+code\b", "promotion"),
    (r"\b(dm|pm|inbox)\s+(me|us)\b", "solicitation"),
    (r"\b(sponsored|paid partnership|advertorial|partner content)\b", "sponsored"),
    (r"\b(casino|betting tips|airdrop|pump signal|crypto signals?)\b", "off-topic spam"),
    (r"\b(limited|special)\s+offer\b", "sales offer"),
]
GREY_PATTERNS = [
    (r"\bpbns?\b|\bprivate blog networks?\b", "PBN"),
    (r"\bparasite\s+seo\b", "parasite SEO"),
    (r"\b(expired|dropped|aged)\s+domains?\b", "expired-domain play"),
    (r"\b(fake|incentivi[sz]ed)\s+reviews?\b", "fake reviews"),
    (r"\b(remove|delete)\s+(negative\s+)?(google\s+)?reviews?\b", "review removal"),
    (r"\bcloak(ing|ed)?\b", "cloaking"),
    (r"\b(spun|spinner|article spinning)\b", "spun content"),
    (r"\b(indexer|force index(ing)?)\b", "forced indexing"),
    (r"\b(bot|fake)\s+(streams?|plays|views|traffic)\b|\bstream(ing)?\s+farms?\b|\bview\s*bots?\b", "artificial plays or traffic"),
    (r"\bmass\s+(dm|reporting|follow)\b", "mass automation"),
]
TRACKING_PARAMS = re.compile(r"^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|igshid|si)$", re.I)


def canon_url(u: str) -> str:
    try:
        p = urllib.parse.urlsplit(u.strip())
    except ValueError:
        return u.strip()
    q = [(k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True) if not TRACKING_PARAMS.match(k)]
    host = p.netloc.lower().removeprefix("www.")
    path = p.path.rstrip("/") or "/"
    return urllib.parse.urlunsplit((p.scheme.lower(), host, path, urllib.parse.urlencode(q), ""))


def norm_title(t: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", (t or "").lower())).strip()


def item_date(it: dict) -> str:
    if it.get("date"):
        return str(it["date"])[:10]
    if it.get("ts"):
        return dt.datetime.fromtimestamp(int(it["ts"]), dt.timezone.utc).strftime("%Y-%m-%d")
    return ""


def in_window(d: str, start: str | None, end: str | None) -> bool:
    if not d:
        return False
    if len(d) == 7:  # month only: keep if the month overlaps the window
        return (not end or d <= end[:7]) and (not start or d >= start[:7])
    return (not start or d >= start) and (not end or d <= end)


def topic_matchers(nome: dict) -> list[tuple[str, re.Pattern]]:
    out = []
    for t in nome["taxonomy"]:
        kws = [k for k in t.get("kw", []) if k.strip()]
        if not kws:
            continue
        alt = "|".join(re.escape(k.lower()) for k in sorted(kws, key=len, reverse=True))
        out.append((t["id"], re.compile(r"(?<![a-z0-9])(?:" + alt + r")(?![a-z0-9])", re.I)))
    return out


def suggest(it: dict, matchers, other_id: str | None) -> dict:
    title, text = it.get("title") or "", it.get("text") or ""
    scores = {}
    for tid, rx in matchers:
        s = 2 * len(set(m.lower() for m in rx.findall(title))) + len(set(m.lower() for m in rx.findall(text)))
        if s:
            scores[tid] = s
    ranked = sorted(scores, key=lambda k: (-scores[k], k))[:2]
    blob = f"{title}\n{text}"
    set_why = [why for rx, why in SET_PATTERNS if re.search(rx, blob, re.I)]
    grey_why = [why for rx, why in GREY_PATTERNS if re.search(rx, blob, re.I)]
    flags = (["set"] if set_why else []) + (["grey"] if grey_why else [])
    return {"topics": ranked or ([other_id] if other_id else []), "scores": scores, "flags": flags, "why": set_why + grey_why}


def load_raw(path: Path) -> list[dict]:
    txt = path.read_text(encoding="utf-8").strip()
    if not txt:
        return []
    if txt.startswith("["):
        return json.loads(txt)
    return [json.loads(line) for line in txt.splitlines() if line.strip()]


def prefilter(raw: list[dict], nome: dict, start: str | None, end: str | None, max_per_author: int = 5) -> dict:
    matchers = topic_matchers(nome)
    other = next((t["id"] for t in nome["taxonomy"] if t["label"].lower() == "other"), None)
    seen_url, seen_title = set(), set()
    kept, dup, out_win, capped, per_author = [], 0, 0, 0, {}
    for it in sorted(raw, key=lambda x: (item_date(x), str(x.get("id", "")))):
        d = item_date(it)
        if not in_window(d, start, end):
            out_win += 1
            continue
        cu = canon_url(it.get("url") or "")
        nt = (it.get("platform", ""), norm_title(it.get("title") or (it.get("text") or "")[:120]))
        if (cu and cu in seen_url) or (nt[1] and nt in seen_title):
            dup += 1
            continue
        seen_url.add(cu)
        seen_title.add(nt)
        if it.get("eye") == "moon" and it.get("author") and max_per_author > 0:
            key = (it.get("platform", ""), it["author"])
            per_author[key] = per_author.get(key, 0) + 1
            if per_author[key] > max_per_author:
                capped += 1
                continue
        kept.append(dict(it, date=d, raw_id=it.get("id")))
    n = {"sun": 0, "moon": 0}
    for it in kept:
        eye = it.get("eye") if it.get("eye") in ("sun", "moon") else "moon"
        n[eye] += 1
        it["eye"] = eye
        it["id"] = ("S" if eye == "sun" else "M") + f"{n[eye]:03d}"
        it["suggest"] = suggest(it, matchers, other)
    return {"nome": nome["id"], "window": {"start": start, "end": end}, "candidates": kept,
            "dropped": {"duplicates": dup, "out_of_window": out_win, "author_cap": capped},
            "note": "Suggestions only. Code every item by hand (topic, topic2, intent, stance, flags) before it enters the ledger."}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--nome", required=True)
    ap.add_argument("--raw", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--window", help="YYYY-MM-DD:YYYY-MM-DD, inclusive")
    ap.add_argument("--max-per-author", type=int, default=5, help="floor items kept per pseudonymous author (0 = no cap)")
    ap.add_argument("--nomes", default=str(ROOT / "assets" / "nomes.json"))
    a = ap.parse_args()
    nomes = json.loads(Path(a.nomes).read_text(encoding="utf-8"))
    nome = next((n for n in nomes["nomes"] if n["id"] == a.nome), None)
    if not nome:
        raise SystemExit(f"unknown nome '{a.nome}'; see assets/nomes.json")
    start, end = (a.window.split(":", 1) + [None])[:2] if a.window else (None, None)
    res = prefilter(load_raw(Path(a.raw)), nome, start, end, a.max_per_author)
    Path(a.out).write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    c = res["candidates"]
    print(f"{len(c)} candidates ({sum(1 for x in c if x['eye'] == 'sun')} broadcast, {sum(1 for x in c if x['eye'] == 'moon')} floor); "
          f"dropped {res['dropped']['duplicates']} duplicates, {res['dropped']['out_of_window']} outside the window, {res['dropped']['author_cap']} over the author cap; "
          f"{sum(1 for x in c if 'set' in x['suggest']['flags'])} suggested Set, {sum(1 for x in c if 'grey' in x['suggest']['flags'])} suggested grey")


if __name__ == "__main__":
    main()
