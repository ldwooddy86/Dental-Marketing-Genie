#!/usr/bin/env python3
"""Reckoning — link classifier and disavow builder (no vendor API required).

Reads one or more link exports (Google Search Console "Top linking sites" / "Latest links",
Bing Webmaster backlinks, or any CSV with a domain / source-URL column), classifies every
referring domain into DISAVOW / REVIEW / KEEP with reproducible signals, and writes:

  buckets.json           every domain with its bucket and reason (feeds the workbook tabs)
  disavow_<target>.txt   house style: `domain:` lines only, sorted, unique, ASCII, no comments

Usage
  python classify_links.py --input gsc_top_linking_sites.csv --input bing_backlinks.csv \
      --target example.com [--strictness conservative|moderate] [--overrides overrides.json] [--outdir .]

overrides.json (every human judgment goes here so re-runs are identical):
  {"force_disavow": ["spam.example"], "force_review": ["maybe.example"], "force_keep": ["chamber.example"]}

Strictness
  conservative (default, and the right choice when the export carries no anchors or traffic):
      disavow only on two signals, or on a toxic anchor/title; one weak signal -> REVIEW.
  moderate: any single signal -> DISAVOW.
"""
import argparse, csv, json, re, sys
from pathlib import Path
from urllib.parse import urlparse

SEO_NET = re.compile(r'(seo|backlink|linkbuild|\bpbn\b|dofollow|niche.?edit|guest.?post|outrank|aged.?domains?|'
                     r'link.?(rank|stash|wagon|nexa|stockly|depot|baron)|rank.?(pilot|depot|outlet|wares|wagon|forge|boost))', re.I)
TOXIC = re.compile(r'(buy.{0,6}(aged domains|backlinks|links)|guest.?posts?|backlinks?|niche.?edits?|\bpbn\b|dofollow|'
                   r'link.?building|seo.?(service|expert|agency|package)|t\.me/|telegram|casino|viagra|cialis|porn\b|xxx|'
                   r'escort|betting|poker|payday.?loan|replica.?(watch|bag)|essay.?writ)', re.I)
SPAM_TLD = ('.store', '.shop', '.click', '.top', '.icu', '.gq', '.cf', '.tk', '.ml', '.ga', '.sale', '.space',
            '.rest', '.bond', '.cyou')
KEEP = {'bbb.org', 'yelp.com', 'yellowpages.com', 'yp.com', 'superpages.com', 'angi.com', 'houzz.com',
        'thumbtack.com', 'homeadvisor.com', 'mapquest.com', 'foursquare.com', 'manta.com', 'hotfrog.com',
        'chamberofcommerce.com', 'facebook.com', 'linkedin.com', 'instagram.com', 'nextdoor.com', 'alignable.com',
        'trustpilot.com', 'birdeye.com', 'expertise.com', 'porch.com', 'prlog.org', 'prnewswire.com',
        'businesswire.com'}

# Header aliases seen in GSC, Bing Webmaster and common third-party exports (matched case-insensitively).
COLS = {
    'domain': ['domain', 'site', 'top linking sites', 'linking site', 'source domain', 'referring domain',
               'root domain', 'source root domain', 'referring domains'],
    'url_from': ['source url', 'url from', 'url_from', 'linking page', 'referring page url', 'referring page',
                 'source page', 'backlink url', 'page url'],
    'anchor': ['anchor text', 'anchor', 'link text'],
    'title': ['title', 'page title', 'source title', 'referring page title'],
    'first_seen': ['first seen', 'first_seen', 'last crawled', 'date', 'discovered'],
}


def host_of(value):
    v = (value or '').strip()
    if not v:
        return ''
    if '://' not in v:
        v = 'http://' + v
    return urlparse(v).netloc.split(':')[0].lower().removeprefix('www.')


def pick(row, key):
    lowered = {k.strip().lower(): v for k, v in row.items() if k}
    for alias in COLS[key]:
        if alias in lowered and (lowered[alias] or '').strip():
            return lowered[alias].strip()
    return ''


def load_rows(paths):
    rows, seen = [], set()
    for p in paths:
        with open(p, newline='', encoding='utf-8-sig') as fh:
            for raw in csv.DictReader(fh):
                dom = host_of(pick(raw, 'domain')) or host_of(pick(raw, 'url_from'))
                if not dom:
                    continue
                key = (dom, pick(raw, 'url_from'))
                if key in seen:
                    continue
                seen.add(key)
                rows.append({'domain': dom, 'anchor': pick(raw, 'anchor'), 'title': pick(raw, 'title'),
                             'url_from': pick(raw, 'url_from'), 'first_seen': pick(raw, 'first_seen')[:10],
                             'source_file': Path(p).name})
    return rows


def classify(rows, strictness='conservative', ov=None):
    ov = ov or {}
    fd, fr, fk = (set(ov.get(k, [])) for k in ('force_disavow', 'force_review', 'force_keep'))
    by_domain = {}
    for r in rows:  # collapse to one row per domain, keeping the first anchor/title/url seen
        by_domain.setdefault(r['domain'], dict(r, links=0))['links'] += 1
    out = {'disavow': [], 'review': [], 'keep': []}
    for d, r in sorted(by_domain.items()):
        txt = f"{r.get('anchor', '')} || {r.get('title', '')}"
        sig = [s for s, ok in [('SEO-network name', SEO_NET.search(d)), ('toxic anchor/title', TOXIC.search(txt)),
                               ('spam TLD', d.endswith(SPAM_TLD))] if ok]
        if d in fd:
            b, why = 'disavow', 'override: confirmed spam'
        elif d in fk or d in KEEP or d.endswith(('.gov', '.edu')):
            b, why = 'keep', 'whitelist / citation / authority source'
        elif d in fr:
            b, why = 'review', 'override: human decision'
        elif strictness == 'conservative':
            b = 'disavow' if (len(sig) >= 2 or 'toxic anchor/title' in sig) else ('review' if sig else 'keep')
            why = '; '.join(sig) or 'no spam signals'
        else:
            b = 'disavow' if sig else 'keep'
            why = '; '.join(sig) or 'no spam signals'
        out[b].append({**r, 'reason': why})
    return out


def write_disavow(buckets, path):
    doms = sorted({x['domain'] for x in buckets['disavow']})
    body = ''.join(f'domain:{d}\n' for d in doms)
    bad = [d for d in doms if not re.fullmatch(r'[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+', d)]
    problems = []
    if bad:
        problems.append(f'invalid rule syntax: {bad[:5]}')
    if not body.isascii():
        problems.append('non-ascii characters')
    if len(doms) > 100_000:
        problems.append('>100k lines (GSC limit)')
    if len(body.encode()) > 2_000_000:
        problems.append('>2MB (GSC limit)')
    Path(path).write_text(body, encoding='ascii', errors='strict' if body.isascii() else 'replace')
    print(f'disavow rules: {len(doms)} | validation: ' + ('OK' if not problems else 'FAIL: ' + '; '.join(problems)))
    return not problems


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--input', action='append', required=True, help='CSV export (repeatable)')
    ap.add_argument('--target', required=True, help='audited domain, used in output filenames')
    ap.add_argument('--strictness', default='conservative', choices=['conservative', 'moderate'])
    ap.add_argument('--overrides', default=None)
    ap.add_argument('--outdir', default='.')
    a = ap.parse_args()
    rows = load_rows(a.input)
    if not rows:
        sys.exit('no rows with a recognizable domain / source-URL column were found')
    ov = json.load(open(a.overrides)) if a.overrides else {}
    buckets = classify(rows, a.strictness, ov)
    Path(a.outdir).mkdir(parents=True, exist_ok=True)
    json.dump(buckets, open(Path(a.outdir) / 'buckets.json', 'w'), indent=1)
    ok = write_disavow(buckets, Path(a.outdir) / f'disavow_{a.target}.txt')
    print(f"domains: {sum(len(v) for v in buckets.values())} | disavow={len(buckets['disavow'])} "
          f"review={len(buckets['review'])} keep={len(buckets['keep'])} | strictness={a.strictness}")
    if not any(r.get('anchor') for r in rows):
        print('NOTE: no anchor text in these exports (GSC has none per domain) — toxic-anchor signals could not fire; '
              'add a Bing Webmaster or third-party export for anchors, and sample flagged domains by search-then-fetch.')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
