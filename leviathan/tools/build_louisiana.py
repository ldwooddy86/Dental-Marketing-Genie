#!/usr/bin/env python3
"""Add the Louisiana editions of Probable Cause and Contraflow to the Leviathan console.

Inputs
  --prev-full       the previous single file console (Leviathan-full.html): frame, fonts, registry and every payload inline
  --probable-cause  the Probable Cause Defense Atlas, Louisiana edition (the artifact file, with or without a document skeleton)
  --contraflow      the Contraflow Injury Atlas, Louisiana edition
  --out             output folder for the offline edition (Leviathan.html + companion scripts, each under 50 MB)
  --single          the single file edition to write (everything inline, over 50 MB)
  --online          optional folder for the hosted edition (index.html + m/<id>.txt, fetched on demand)

Both atlases are rail style shells, like the Louisiana Thermal Debt Atlas, so they take the host link and bridge the
console already injects for that style, then they are gzipped and base64 packed like every other module. They sit
beside the Texas editions in the legal wing (the way the Louisiana and Dallas Fort Worth HVAC atlases sit together in
the home wing), their 441 scored parishes' ZIPs feed Convergence as Louisiana columns, the Louisiana correlation
matrix is extended, and the frame script is patched in place. Every patch asserts that its anchor occurs exactly once,
so a changed upstream build fails loudly instead of silently.
"""
import argparse, collections, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import die, replace_once, gunzip_b64, gzip_b64, pct_within, spearman, injection_blocks, dfw_footer, payload_line, write_companion

COMPANIONS = [
    {'file': 'Leviathan-data.js', 'ids': ['family', 'dental', 'ocular']},
    {'file': 'Leviathan-data-2.js', 'ids': ['employment']},
]


# ----------------------------------------------------------------------------------------------- previous console
def read_prev_full(path):
    """The single file edition carries every payload inline, so it is the one source for a rebuild."""
    with open(path, encoding='utf-8') as f:
        lines = f.read().split('\n')
    i_data = next(i for i, l in enumerate(lines) if l.startswith('<script type="application/json" id="lv-data">'))
    head = '\n'.join(lines[:i_data]) + '\n'
    data_line = lines[i_data]
    lv = json.loads(data_line[data_line.index('>') + 1:data_line.rindex('</script>')])
    payloads = collections.OrderedDict()
    i = i_data + 1
    while lines[i].startswith('<script type="text/plain" id="lvp-'):
        l = lines[i]
        mid = re.match(r'<script type="text/plain" id="lvp-([^"]+)">', l).group(1)
        payloads[mid] = l[l.index('>') + 1:l.rindex('</script>')]
        i += 1
    frame = '\n'.join(lines[i:])
    if not frame.startswith('<script>'):
        die('the frame script did not follow the payload blocks as expected')
    return head, lv, payloads, frame


# ----------------------------------------------------------------------------------------------- the two atlases
def ensure_document(src, label):
    """An artifact download of a shell can start at <title> (the viewer adds the skeleton). Give it one."""
    if re.match(r'\s*<!doctype html>', src, re.I):
        return src
    if not src.startswith('<title>'):
        die(f'{label}: the file is neither a full document nor a shell fragment that starts at <title>')
    k = src.find('\n<header class="shell-top">')
    if k < 0:
        die(f'{label}: the shell header was not found')
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            + src[:k] + '\n</head>\n<body>' + src[k:].rstrip('\n') + '\n</body>\n</html>\n')


def wrap_rail(src, mid, tk, rail_head, rail_bridge, label):
    head = replace_once(rail_head, 'var ID = "hvac", TK = "lta.theme", RAW = false, H = null;',
                        f'var ID = "{mid}", TK = "{tk}", RAW = false, H = null;', label + ' host link id')
    bridge = replace_once(rail_bridge, 'TK = "lta.theme"', f'TK = "{tk}"', label + ' bridge theme key')
    anchor = '<meta charset="utf-8">\n'
    k = src.find(anchor)
    if k < 0 or k > 400:
        die(f'{label} head injection: the charset meta was not found at the top of the file')
    src = src[:k + len(anchor)] + head + '\n' + src[k + len(anchor):]   # the forge templates repeat the meta; only the shell gets the link
    k = src.rindex('\n</body>')
    return src[:k] + '\n' + bridge + src[k:]


def shell_mods(src, label, n_expected):
    out = []
    for key, num, title, desc in re.findall(
            r"registerModule\(\{\s*key:\s*'([a-z]+)',\s*num:\s*'(\d\d)',\s*title:\s*'((?:[^'\\]|\\.)*)',\s*desc:\s*'((?:[^'\\]|\\.)*)'", src):
        out.append({'key': key, 'num': num, 'title': title.replace("\\'", "'"), 'desc': desc.replace("\\'", "'"), 'grp': None})
    if len(out) != n_expected:
        die(f'{label}: expected {n_expected} registered modules, found {len(out)}')
    return out


def atlas_data(src, label):
    m = re.search(r'^window\.__ATLAS_DATA__ = (\{.*\});?$', src, re.M)
    if not m:
        die(f'{label}: atlas data not found')
    return json.loads(m.group(1))


def atlas_k(v):
    """The shells' own K(): two decimals at millions, whole thousands from ten thousand, one decimal below."""
    a = abs(v)
    if a >= 1e6:
        return f'{v / 1e6:.2f}M'
    if a >= 1e4:
        return f'{round(v / 1e3)}k'
    if a >= 1e3:
        return f'{v / 1e3:.1f}k'
    return str(round(v))


def n_(v):
    return f'{round(v):,}'


def legal_column(D, C, ZI, label):
    """One Convergence column from a legal atlas: the headline index, its Louisiana percentile, tier, quadrant, cases and fees."""
    zi = {c: i for i, c in enumerate(D['zcols'])}
    for c in ('zip', 'city', 'idx', 'tier', 'quad', 'cases', 'fees'):
        if c not in zi:
            die(f'{label}: ZIP column {c} not found')
    rows = [r for r in D['zrows'] if r[zi['idx']] is not None]
    missing = [r[zi['zip']] for r in rows if r[zi['zip']] not in ZI]
    if missing:
        die(f'{label}: {len(missing)} scored ZIPs are not in the Convergence ZIP list: {missing[:5]}')
    elsewhere = [r[zi['zip']] for r in rows if C['st'][ZI[r[zi['zip']]]] != 'LA']
    if elsewhere:
        die(f'{label}: {len(elsewhere)} scored ZIPs are not Louisiana ZIPs in the console: {elsewhere[:5]}')
    p = pct_within([(r[zi['zip']], r[zi['idx']]) for r in rows])
    NZ = len(C['zips'])
    col = {'p': [None] * NZ, 'idx': [None] * NZ, 'tier': [None] * NZ, 'quad': [None] * NZ, 'vol': [None] * NZ, 'val': [None] * NZ}
    items = []
    for r in rows:
        z = r[zi['zip']]; i = ZI[z]
        col['p'][i] = p[z]; col['idx'][i] = r[zi['idx']]; col['tier'][i] = r[zi['tier']]; col['quad'][i] = r[zi['quad']]
        col['vol'][i] = None if r[zi['cases']] is None else round(r[zi['cases']], 1)
        col['val'][i] = r[zi['fees']]
        items.append({'zip': z, 'city': r[zi['city']], 'cty': C['cty'][i], 'idx': r[zi['idx']], 'p': p[z], 'tier': r[zi['tier']]})
    items.sort(key=lambda d: (-d['idx'], -d['p']))
    stats = {
        'n': len(rows),
        'totVol': round(sum(r[zi['cases']] or 0 for r in rows)),
        'totVal': round(sum(r[zi['fees']] or 0 for r in rows)),
        'tiers': dict(collections.Counter(r[zi['tier']] for r in rows)),
        'top': items[:6],
    }
    return col, stats


def line_count(D, label, n_expected):
    n = len([c for c in D['zcols'] if c.startswith('p_')])
    if n != n_expected:
        die(f'{label}: expected {n_expected} practice line columns, found {n}')
    return n


# ----------------------------------------------------------------------------------------------- registry
def extend_registry(lv, pc_src, cf_src, pc_stats, cf_stats):
    C = lv['conv']
    ZI = {z: i for i, z in enumerate(C['zips'])}
    mods = lv['modules']
    if any(m['id'] in ('criminal_la', 'injury_la') for m in mods):
        die('the previous console already carries the Louisiana legal atlases; build from the earlier edition')

    # ---- Probable Cause, Louisiana edition: 441 residential ZIPs scored on the Defense Demand Index
    PD = atlas_data(pc_src, 'probable cause')
    pm = PD['meta']
    if pm.get('npar') != 64:
        die('probable cause: expected the Louisiana edition (64 parishes)')
    pc_col, pc_s = legal_column(PD, C, ZI, 'probable cause')
    pc_lines = line_count(PD, 'probable cause', 14)
    pc_facts = ['64 parishes', atlas_k(pm['pop']) + ' residents',
                atlas_k(pm['courts']['2025']['dc'] + pm['courts']['2025']['cc']) + ' criminal filings, 2025',
                n_(pm['nag']) + ' agencies', f'{pc_lines} case lines', n_(pm['ncomp']) + ' firms watched']
    pc_mod = {
        'id': 'criminal_la', 'src': 'probable-cause-louisiana', 'wing': 'legal', 'vertical': 'Criminal defense',
        'navTitle': 'Criminal defense · Louisiana', 'short': 'Probable Cause Louisiana',
        'title': 'Probable Cause Defense Atlas', 'name': 'Probable Cause',
        'sub': 'Criminal defense intelligence for all 64 Louisiana parishes: arrest records, fourteen case lines, ZIP heatmaps for ads and SEO',
        'facts': pc_facts, 'mods': shell_mods(pc_src, 'probable cause', 16), 'raw': pc_stats[0], 'gz': pc_stats[1],
        'foot': dfw_footer(pc_src), 'vert': 'crimla', 'top': {'TX': [], 'LA': pc_s['top']}, 'tiers': pc_s['tiers'],
        'compiled': pm['compiled'],
        'dataNote': 'Louisiana edition compiled ' + pm['compiled'] + '; the Texas edition sits beside it, so Convergence carries criminal defense in both states, each ranked within its own state',
    }
    pc_vert = {'key': 'crimla', 'mod': 'criminal_la', 'wing': 'legal', 'label': 'Criminal defense', 'idxLabel': 'Defense Demand Index (percentile)',
               'vol': 'Retained cases a year (model)', 'val': 'Fee pool a year ($)', 'states': ['LA'],
               'n': pc_s['n'], 'totVol': pc_s['totVol'], 'totVal': pc_s['totVal']}

    # ---- Contraflow, Louisiana edition: the same 441 ZIPs on the Case Flow Index
    CD = atlas_data(cf_src, 'contraflow')
    cm = CD['meta']
    if cm.get('npar') != 64:
        die('contraflow: expected the Louisiana edition (64 parishes)')
    cf_col, cf_s = legal_column(CD, C, ZI, 'contraflow')
    cf_lines = line_count(CD, 'contraflow', 9)
    cf_facts = ['64 parishes', atlas_k(cm['pop']) + ' residents', atlas_k(cm['state']['inj'][4]) + ' injured in crashes, 2024',
                atlas_k(cm['fars_n']) + ' fatal crashes mapped', f'{cf_lines} practice lines', n_(cm['ncomp']) + ' firms watched']
    cf_mod = {
        'id': 'injury_la', 'src': 'contraflow-louisiana', 'wing': 'legal', 'vertical': 'Personal injury',
        'navTitle': 'Personal injury · Louisiana', 'short': 'Contraflow Louisiana',
        'title': 'Contraflow Injury Atlas', 'name': 'Contraflow',
        'sub': 'Personal injury intelligence for all 64 Louisiana parishes: crash corridors, nine practice lines, ZIP heatmaps for ads and SEO',
        'facts': cf_facts, 'mods': shell_mods(cf_src, 'contraflow', 16), 'raw': cf_stats[0], 'gz': cf_stats[1],
        'foot': dfw_footer(cf_src), 'vert': 'pila', 'top': {'TX': [], 'LA': cf_s['top']}, 'tiers': cf_s['tiers'],
        'compiled': cm['compiled'],
        'dataNote': 'Louisiana edition compiled ' + cm['compiled'] + '; the Texas edition sits beside it, so Convergence carries personal injury in both states, each ranked within its own state',
    }
    cf_vert = {'key': 'pila', 'mod': 'injury_la', 'wing': 'legal', 'label': 'Personal injury', 'idxLabel': 'Case Flow Index (percentile)',
               'vol': 'Represented cases a year (model)', 'val': 'Fee pool a year ($)', 'states': ['LA'],
               'n': cf_s['n'], 'totVol': cf_s['totVol'], 'totVal': cf_s['totVal']}

    # ---- splice into the registry: each Louisiana edition right after its Texas edition
    mods.insert(next(i for i, m in enumerate(mods) if m['id'] == 'criminal') + 1, pc_mod)
    mods.insert(next(i for i, m in enumerate(mods) if m['id'] == 'injury') + 1, cf_mod)
    next(m for m in mods if m['id'] == 'criminal')['navTitle'] = 'Criminal defense · Texas'
    next(m for m in mods if m['id'] == 'injury')['navTitle'] = 'Personal injury · Texas'
    verts = lv['verts']
    verts.insert(next(i for i, v in enumerate(verts) if v['key'] == 'crim') + 1, pc_vert)
    verts.insert(next(i for i, v in enumerate(verts) if v['key'] == 'pi') + 1, cf_vert)
    C['v']['crimla'] = pc_col
    C['v']['pila'] = cf_col

    # ---- correlations: Spearman of Louisiana percentiles over the ZIPs both atlases score (the console's own rule)
    NZ = len(C['zips'])
    M = lv['corr']['LA']
    keys = list(M['keys'])
    new = ['crimla', 'pila']
    order = [v['key'] for v in verts if v['key'] in keys + new]
    for a in new:
        for b in order:
            if a == b:
                M['m'][a + '|' + a] = {'r': 1.0, 'n': None}
                continue
            if (b + '|' + a) in M['m'] or (a + '|' + b) in M['m']:
                continue
            xs, ys = [], []
            pa, pb = C['v'][a]['p'], C['v'][b]['p']
            for i in range(NZ):
                if C['st'][i] != 'LA' or pa[i] is None or pb[i] is None:
                    continue
                xs.append(pa[i]); ys.append(pb[i])
            r = spearman(xs, ys) if len(xs) >= 10 else None
            M['m'][a + '|' + b] = {'r': round(r, 3) if r is not None else None, 'n': len(xs)}
    M['keys'] = order
    return lv


# ----------------------------------------------------------------------------------------------- frame and head patches
def patch_frame(frame):
    P = [
        ("  legal: { id: 'legal', label: 'Legal', mods: ['criminal', 'injury', 'family', 'employment'],\n    dek: 'Four practice areas, four atlases: criminal defense and personal injury across all 254 Texas counties, family law across every county and parish in Texas and Louisiana, and employment law scored for every buyable ZIP code in the country.' },",
         "  legal: { id: 'legal', label: 'Legal', mods: ['criminal', 'criminal_la', 'injury', 'injury_la', 'family', 'employment'],\n    dek: 'Four practice areas, six atlases: criminal defense and personal injury twice each, across all 254 Texas counties and across all 64 Louisiana parishes; family law across every county and parish in Texas and Louisiana; and employment law scored for every buyable ZIP code in the country.' },",
         'legal wing'),
        ("const NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];",
         "const NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];",
         'number words'),
        ("the Defense Demand, Case Flow, Matter Flow, Thermal Debt (Louisiana and Dallas Fort Worth),",
         "the Defense Demand and Case Flow (Texas and Louisiana, each ranked within its own state), Matter Flow, Thermal Debt (Louisiana and Dallas Fort Worth),",
         'convergence method'),
        ("window.__LV_CONSOLE = { live, open: openModule, go, prefs, version: '1.1.0' };",
         "window.__LV_CONSOLE = { live, open: openModule, go, prefs, version: '1.2.0' };",
         'console version'),
    ]
    for old, new, label in P:
        frame = replace_once(frame, old, new, 'frame ' + label)
    return frame


def patch_head(head):
    head = replace_once(head, 'twelve industry atlases in three wings (legal, home services and healthcare)',
                        'fourteen industry atlases in three wings (legal, home services and healthcare)', 'head description')
    head = replace_once(head, '/* Leviathan: one console, OmegaWeapon at the core, twelve industry atlases around it.',
                        '/* Leviathan: one console, OmegaWeapon at the core, fourteen industry atlases around it.', 'head comment')
    return head


# ----------------------------------------------------------------------------------------------- output
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--prev-full', required=True)
    ap.add_argument('--probable-cause', required=True)
    ap.add_argument('--contraflow', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--single', required=True)
    ap.add_argument('--online')
    ap.add_argument('--page', default='Leviathan.html')
    a = ap.parse_args()

    head, lv, payloads, frame = read_prev_full(a.prev_full)
    dental_src = gunzip_b64(payloads['dental'])
    hvac_src = gunzip_b64(payloads['hvac'])
    _, _, rail_head, rail_bridge = injection_blocks(dental_src, hvac_src)

    with open(a.probable_cause, encoding='utf-8') as f:
        pc_src = ensure_document(f.read(), 'probable cause')
    with open(a.contraflow, encoding='utf-8') as f:
        cf_src = ensure_document(f.read(), 'contraflow')
    pc_wrapped = wrap_rail(pc_src, 'criminal_la', 'pc.theme', rail_head, rail_bridge, 'probable cause')
    cf_wrapped = wrap_rail(cf_src, 'injury_la', 'cf.theme', rail_head, rail_bridge, 'contraflow')
    pc_b64, pc_raw, pc_gz = gzip_b64(pc_wrapped)
    cf_b64, cf_raw, cf_gz = gzip_b64(cf_wrapped)

    lv = extend_registry(lv, pc_src, cf_src, (pc_raw, pc_gz), (cf_raw, cf_gz))
    frame = patch_frame(frame)
    head = patch_head(head)

    # payload order: each Louisiana edition right after its Texas edition
    order = list(payloads.keys())
    order.insert(order.index('criminal') + 1, 'criminal_la')
    order.insert(order.index('injury') + 1, 'injury_la')
    payloads['criminal_la'] = pc_b64
    payloads['injury_la'] = cf_b64
    ext_ids = [mid for c in COMPANIONS for mid in c['ids']]
    for mid in ext_ids:
        if mid not in payloads:
            die(f'companion module {mid} is missing from the previous console')
    inline_ids = [mid for mid in order if mid not in ext_ids]

    # ---- offline edition: the smaller atlases inline, the four largest in companion scripts
    os.makedirs(a.out, exist_ok=True)
    lv_off = dict(lv); lv_off['ext'] = COMPANIONS
    page = os.path.join(a.out, a.page)
    with open(page, 'w', encoding='utf-8') as f:
        f.write(head)
        f.write('<script type="application/json" id="lv-data">' + json.dumps(lv_off, ensure_ascii=False, separators=(',', ':')) + '</script>\n')
        for mid in inline_ids:
            f.write(payload_line(mid, payloads[mid]) + '\n')
        f.write(frame)
    for c in COMPANIONS:
        write_companion(os.path.join(a.out, c['file']), c['ids'], payloads, a.page)
    sizes = {os.path.basename(p): os.path.getsize(p) for p in [page] + [os.path.join(a.out, c['file']) for c in COMPANIONS]}
    for n, s in sizes.items():
        print(f'  {n:24s} {s / 1048576:7.1f} MB' + ('   OVER 50 MB' if s > 50 * 1048576 else ''))
    if any(s > 50 * 1048576 for s in sizes.values()):
        die('an output file crossed 50 MB')

    # ---- single file edition: everything inline, one page, no companions
    lv_one = dict(lv); lv_one['ext'] = []
    with open(a.single, 'w', encoding='utf-8') as f:
        f.write(head)
        f.write('<script type="application/json" id="lv-data">' + json.dumps(lv_one, ensure_ascii=False, separators=(',', ':')) + '</script>\n')
        for mid in order:
            f.write(payload_line(mid, payloads[mid]) + '\n')
        f.write(frame)
    print(f'  {os.path.basename(a.single):24s} {os.path.getsize(a.single) / 1048576:7.1f} MB   single file, all {len(order)} dashboards inline')

    # ---- hosted edition: a small page, every module fetched from m/<id>.txt on demand
    if a.online:
        mdir = os.path.join(a.online, 'm')
        os.makedirs(mdir, exist_ok=True)
        lv_on = dict(lv); lv_on['ext'] = []
        with open(os.path.join(a.online, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(head)
            f.write('<script type="application/json" id="lv-data">' + json.dumps(lv_on, ensure_ascii=False, separators=(',', ':')) + '</script>\n')
            f.write(frame)
        for mid in order:
            with open(os.path.join(mdir, mid + '.txt'), 'w', encoding='ascii') as f:
                f.write(payloads[mid])
        print(f'  online edition: {a.online}/index.html + {len(order)} module files')
    print('modules: ' + ', '.join(m['id'] for m in lv['modules']))


if __name__ == '__main__':
    main()
