#!/usr/bin/env python3
"""Build the Leviathan console: one frame, every atlas live inside it.

Inputs
  --prev-html   the previous Leviathan console page (its frame, fonts, registry and inline payloads are carried over)
  --prev-data   the companion data script that shipped beside it (family, dental, ocular)
  --dfw         the DFW Thermal Debt Atlas, single file edition (dist/DFW_Thermal_Debt_Atlas_4_preview.html)
  --termination the Termination Exposure Atlas, single file edition (v8.2)
  --out         output folder for the offline edition (Leviathan.html + companion scripts, each under 50 MB)
  --online      optional folder for the hosted edition (index.html + m/<id>.txt, fetched on demand)

The two new atlases are wrapped with the same host link and bridge the console already uses for its shell style
(dental) and rail style (Louisiana HVAC) atlases, then gzipped and base64 packed like every other module.
The registry (modules, wings, verticals, Convergence columns, correlations) is extended and the frame script is
patched in place. Every patch asserts that its anchor occurs exactly once, so a changed upstream build fails loudly.
"""
import argparse, base64, bisect, collections, gzip, html, json, os, re, sys

TN = ['A+', 'A', 'B', 'C', 'D', 'E']


def die(msg):
    sys.exit('build: ' + msg)


def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        die(f'{label}: expected one occurrence of the anchor, found {n}')
    return text.replace(old, new)


def gunzip_b64(b64):
    return gzip.decompress(base64.b64decode(re.sub(r'\s', '', b64))).decode('utf-8')


def gzip_b64(text):
    raw = text.encode('utf-8')
    gz = gzip.compress(raw, 9)
    return base64.b64encode(gz).decode('ascii'), len(raw), len(gz)


def pct_within(pairs):
    """Percentile of each value among all values, ties take the middle rank, one decimal (the console's rule)."""
    xs = sorted(v for _, v in pairs)
    n = len(xs)
    out = {}
    for k, v in pairs:
        lo = bisect.bisect_left(xs, v)
        hi = bisect.bisect_right(xs, v)
        out[k] = round(100 * (lo + (hi - lo) / 2) / n, 1)
    return out


def rank(xs):
    idx = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    i = 0
    while i < len(idx):
        j = i
        while j + 1 < len(idx) and xs[idx[j + 1]] == xs[idx[i]]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            r[idx[k]] = avg
        i = j + 1
    return r


def spearman(a, b):
    ra, rb = rank(a), rank(b)
    n = len(a)
    ma, mb = sum(ra) / n, sum(rb) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = (sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb)) ** 0.5
    return num / den if den else None


# ----------------------------------------------------------------------------------------------- previous console
def read_prev(prev_html, prev_data):
    with open(prev_html, encoding='utf-8') as f:
        lines = f.read().split('\n')
    i_data = next(i for i, l in enumerate(lines) if l.startswith('<script type="application/json" id="lv-data">'))
    head = '\n'.join(lines[:i_data]) + '\n'
    data_line = lines[i_data]
    lv = json.loads(data_line[data_line.index('>') + 1:data_line.rindex('</script>')])
    inline = collections.OrderedDict()
    i = i_data + 1
    while lines[i].startswith('<script type="text/plain" id="lvp-'):
        l = lines[i]
        mid = re.match(r'<script type="text/plain" id="lvp-([^"]+)">', l).group(1)
        inline[mid] = l[l.index('>') + 1:l.rindex('</script>')]
        i += 1
    frame = '\n'.join(lines[i:])
    if not frame.startswith('<script>'):
        die('the frame script did not follow the payload blocks as expected')
    ext = collections.OrderedDict()
    with open(prev_data, encoding='utf-8') as f:
        for l in f:
            m = re.match(r'window\.__LVP\["([^"]+)"\]="([^"]+)"', l)
            if m:
                ext[m.group(1)] = m.group(2)
    return head, lv, inline, ext, frame


def injection_blocks(dental_src, hvac_src):
    """Lift the host link, download router, embed styles and bridges the console already injects."""
    a = dental_src.index('<script>/* Leviathan host link')
    b = dental_src.index('<title>', a)
    shell_head = dental_src[a:b]
    a = dental_src.index('<script>/* Leviathan bridge: registers this atlas shell with the console */')
    b = dental_src.index('</script>', a) + len('</script>')
    shell_bridge = dental_src[a:b]
    a = hvac_src.index('<script>/* Leviathan host link')
    b = hvac_src.index('</style>', hvac_src.index('html.lv-rail-off #rail', a)) + len('</style>')
    rail_head = hvac_src[a:b]
    a = hvac_src.index('<script>/* Leviathan bridge: registers this atlas with the console */')
    b = hvac_src.index('</script>', a) + len('</script>')
    rail_bridge = hvac_src[a:b]
    return shell_head, shell_bridge, rail_head, rail_bridge


# ----------------------------------------------------------------------------------------------- the two new atlases
def wrap_termination(src, shell_head, shell_bridge):
    keys = ['exposure', 'enforce', 'risk', 'paid', 'ground', 'hiring', 'desk', 'forge']
    head = replace_once(shell_head, 'var ID = "dental", TK = null, RAW = false, H = null;',
                        'var ID = "employment", TK = null, RAW = false, H = null;', 'termination host link id')
    anchor = '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    k = src.find(anchor)
    if k < 0 or k > 400:
        die('termination head injection: the shell viewport meta was not found at the top of the file')
    src = src[:k + len(anchor)] + head + src[k + len(anchor):]   # the inner module documents repeat the same meta; only the shell gets the link
    lines = src.split('\n')
    # the shell script is the last <script> block; patch it line by line
    i_shell = max(i for i, l in enumerate(lines) if l == '<script>')
    tail = lines[i_shell:]
    def patch_line(old, new, label):
        hits = [i for i, l in enumerate(tail) if l == old]
        if len(hits) != 1:
            die(f'termination {label}: expected one line, found {len(hits)}')
        tail[hits[0]] = new
    patch_line('"use strict";', '"use strict";\nconst KEYS=' + json.dumps(keys, separators=(',', ':')).replace('"', "'") + ';', 'KEYS')
    patch_line("  fr.srcdoc=decode('pay-'+key);",
               "  fr.srcdoc=(window.__lvInner?window.__lvInner(decode('pay-'+key)):decode('pay-'+key));", 'srcdoc')
    patch_line("if(matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.dataset.theme='dark';",
               "if(!(window.__LV&&window.__LV.host&&window.__LV.host.theme())&&matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.dataset.theme='dark';", 'theme init')
    patch_line("show('exposure');",
               "show((function(){try{var L=window.__LV,r=L&&L.host&&L.host.initialRoute(L.id);if(r&&KEYS.includes(r))return r;}catch(e){}return 'exposure';})());", 'initial module')
    # bridge before the shell's own closing body tag (the last one in the file; inner documents carry their own)
    j = max(i for i, l in enumerate(tail) if l == '</body>')
    tail[j:j] = [shell_bridge]
    lines[i_shell:] = tail
    return '\n'.join(lines), keys


def wrap_dfw(src, rail_head, rail_bridge):
    head = replace_once(rail_head, 'var ID = "hvac", TK = "lta.theme", RAW = false, H = null;',
                        'var ID = "dfw", TK = "tda.theme", RAW = false, H = null;', 'dfw host link id')
    bridge = replace_once(rail_bridge, 'TK = "lta.theme"', 'TK = "tda.theme"', 'dfw bridge theme key')
    src = replace_once(src, '<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + head + '\n', 'dfw head injection')
    k = src.rindex('\n</body>')
    return src[:k] + '\n' + bridge + src[k:]


def termination_mods(src):
    out = []
    for n, (key, title, desc) in enumerate(re.findall(
            r'<button role="tab" id="tab-([a-z]+)"[^>]*>\s*<span class="t">(?:<span class="dot"[^>]*></span>)?(.*?)</span>\s*<span class="d">(.*?)</span>', src, re.S), 1):
        out.append({'key': key, 'num': f'{n:02d}', 'title': html.unescape(title).strip(), 'desc': html.unescape(desc).strip(), 'grp': None})
    if len(out) != 8:
        die(f'termination: expected 8 module tabs, found {len(out)}')
    return out


def dfw_mods(src):
    out = []
    for key, num, title, desc in re.findall(r"key: '([a-z]+)', num: '(\d\d)', title: '([^']*)', desc: '((?:[^'\\]|\\.)*)'", src):
        out.append({'key': key, 'num': num, 'title': title, 'desc': desc.replace("\\'", "'"), 'grp': None})
    if len(out) != 16:
        die(f'dfw: expected 16 module definitions, found {len(out)}')
    return out


def dfw_data(src):
    m = re.search(r'^window\.__ATLAS_DATA__ = (\{.*\});?$', src, re.M)
    if not m:
        die('dfw: atlas data not found')
    return json.loads(m.group(1))


def termination_paid(src):
    m = re.search(r'^const P4=(\{.*\});?$', src, re.M)
    if not m:
        die('termination: paid module table P4 not found')
    return json.loads(m.group(1))


def dfw_footer(src):
    m = re.search(r'<footer class="shell-foot"><div class="in">(.*?)</div></footer>', src, re.S)
    if not m:
        die('dfw: footer not found')
    return [html.unescape(re.sub(r'<[^>]+>', '', s)).strip() for s in re.findall(r'<span>(.*?)</span>', m.group(1), re.S)]


def fmt_k(v):
    a = abs(v)
    if a >= 1e6:
        return f'{v / 1e6:.2f}M'
    if a >= 1e3:
        return f'{round(v / 1e3):,}k'
    return str(round(v))


# ----------------------------------------------------------------------------------------------- registry
def extend_registry(lv, dfw_src, term_src, dfw_payload_stats, term_payload_stats):
    C = lv['conv']
    Z = C['zips']
    ZI = {z: i for i, z in enumerate(Z)}
    NZ = len(Z)

    # ---- DFW Thermal Debt: 263 residential ZIPs scored by the atlas, all inside the console's Texas list
    D = dfw_data(dfw_src)
    zc = D['zcols']
    zi = {c: i for i, c in enumerate(zc)}
    rows = [r for r in D['zrows'] if r[zi['idx']] is not None]
    missing = [r[zi['zip']] for r in rows if r[zi['zip']] not in ZI]
    if missing:
        die(f'dfw: {len(missing)} scored ZIPs are not in the Convergence ZIP list: {missing[:5]}')
    p = pct_within([(r[zi['zip']], r[zi['idx']]) for r in rows])
    col = {'p': [None] * NZ, 'idx': [None] * NZ, 'tier': [None] * NZ, 'quad': None, 'vol': [None] * NZ, 'val': [None] * NZ}
    items = []
    for r in rows:
        z = r[zi['zip']]; i = ZI[z]
        col['p'][i] = p[z]; col['idx'][i] = r[zi['idx']]; col['tier'][i] = r[zi['tier']]
        col['vol'][i] = r[zi['rep']]; col['val'][i] = r[zi['opp_usd']]
        items.append({'zip': z, 'city': r[zi['city']], 'cty': C['cty'][i], 'idx': r[zi['idx']], 'p': p[z], 'tier': r[zi['tier']]})
    items.sort(key=lambda d: (-d['idx'], -d['p']))
    meta = D['meta']; ytd = D['climate']['ytd']
    foot = dfw_footer(dfw_src)
    dfw_mod = {
        'id': 'dfw', 'src': 'dfw-thermal-debt', 'wing': 'home', 'vertical': 'HVAC', 'navTitle': 'HVAC · Dallas Fort Worth',
        'scopeLabel': 'Dallas Fort Worth, Texas', 'short': 'DFW Thermal Debt', 'title': 'DFW Thermal Debt Atlas',
        'name': 'DFW Thermal Debt Atlas',
        'sub': 'Heating and cooling campaign intelligence for the 12 counties of Dallas Fort Worth: demand, service lines, competitors, the website and the accounts',
        'facts': [f'{fmt_k(meta["sys"])} central systems', f'{fmt_k(meta["ge15"])} aged 15 or older', f'{fmt_k(meta["rep"])} replacements a year',
                  '14 service lines', f'{len(D["comp"])} competitor locations mapped', f'{ytd["d100"]} days at 100°F in Dallas Fort Worth, {str(ytd["through"])[:4]}',
                  f'{meta["ncounty"]} counties', f'{meta["nzip"]} ZIP codes'],
        'mods': dfw_mods(dfw_src), 'raw': dfw_payload_stats[0], 'gz': dfw_payload_stats[1],
        'foot': foot, 'vert': 'dfw',
        'top': {'TX': items[:6], 'LA': []},
        'tiers': dict(collections.Counter(r[zi['tier']] for r in rows)),
        'compiled': meta['compiled'],
        'dataNote': 'Build 4 of September 26, 2026 (data compiled ' + meta['compiled'] + '): the browser app edition with the Publish module and the ad account connectors; scores the 12 counties of Dallas Fort Worth, so its Convergence percentiles run within that metro',
    }
    dfw_vert = {'key': 'dfw', 'mod': 'dfw', 'wing': 'home', 'label': 'HVAC (DFW)', 'idxLabel': 'Thermal Debt Index, Dallas Fort Worth (percentile)',
                'vol': 'System replacements a year (model)', 'val': 'Replacement and repair value a year ($)', 'states': ['TX'],
                'n': len(rows), 'totVol': round(sum(r[zi['rep']] for r in rows)), 'totVal': round(sum(r[zi['opp_usd']] for r in rows))}

    # ---- Termination Exposure: national, every buyable ZIP; Texas and Louisiana rows feed Convergence
    P = termination_paid(term_src)
    pc = P['cols']; pi = {c: i for i, c in enumerate(pc)}
    ecol = {'p': [None] * NZ, 'idx': [None] * NZ, 'tier': [None] * NZ, 'quad': None, 'vol': [None] * NZ, 'val': None}
    etop = {}; n_e = 0; tot_e = 0.0
    for st in ['TX', 'LA']:
        rs = [r for r in P['rows'] if r[pi['st']] == st and r[pi['zip']] in ZI]
        pe = pct_within([(r[pi['zip']], r[pi['effb']]) for r in rs])
        its = []
        for r in rs:
            z = r[pi['zip']]; i = ZI[z]; n_e += 1
            ecol['p'][i] = pe[z]; ecol['idx'][i] = r[pi['effb']]; ecol['tier'][i] = TN[r[pi['tier']]]
            ecol['vol'][i] = r[pi['charges']]; tot_e += r[pi['charges']]
            its.append({'zip': z, 'city': P['cities'][r[pi['city']]], 'cty': re.sub(r' Parish$', '', P['ctys'][r[pi['cty']]]),
                        'idx': r[pi['effb']], 'p': pe[z], 'tier': TN[r[pi['tier']]]})
        its.sort(key=lambda d: (-d['idx'], -d['p']))
        etop[st] = its[:6]
    emeta = P['meta']
    built = re.search(r'"built":"(\d{4}-\d\d-\d\d)"', term_src)
    compiled = built.group(1) if built else '2026-09-15'
    foot_m = re.search(r'<div class="foot"><div class="fb">(.*?)</div></div>', term_src, re.S)
    efoot = [html.unescape(re.sub(r'<[^>]+>', '', s)).strip() for s in re.findall(r'<span(?: class="[^"]*")?>(.*?)</span>', foot_m.group(1), re.S)] if foot_m else []
    efoot = [f for f in efoot if f]
    emp_mod = {
        'id': 'employment', 'src': 'termination-exposure', 'wing': 'legal', 'vertical': 'Employment law', 'short': 'Termination Exposure',
        'raw': term_payload_stats[0], 'gz': term_payload_stats[1],
        'title': 'The Termination Exposure Atlas', 'name': 'The Termination Exposure Atlas',
        'sub': 'Companion to Why Americans Lose Their Jobs · Research Report, September 2026 · employment law marketing platform',
        'facts': ['Eight modules', '51 jurisdictions', '3,144 counties', '7,492 cities', f'{emeta["nbuy"]:,} buyable ZIP codes',
                  f'{emeta["privbuy"] / 1e6:.1f}M private workers', f'{emeta["sep"] / 1e6:.1f}M separations a year', 'five ad platforms',
                  'every layer graded A–D', 'module eight builds the site'],
        'mods': termination_mods(term_src), 'foot': efoot, 'compiled': compiled, 'scope': 'national', 'vert': 'emp',
        'top': etop, 'tiers': dict(collections.Counter(TN[r[pi['tier']]] for r in P['rows'])), 'nzip': len(P['rows']),
        'dataNote': 'Built ' + compiled + ' (v8.2); national, every buyable ZIP code scored; the console reads its Texas and Louisiana ZIPs into Convergence',
    }
    emp_vert = {'key': 'emp', 'mod': 'employment', 'wing': 'legal', 'label': 'Employment law', 'idxLabel': 'Efficiency Index (national percentile)',
                'vol': 'Claimants a year (model)', 'val': None, 'states': ['LA', 'TX'], 'n': n_e, 'totVol': round(tot_e), 'totVal': None}

    # ---- splice into the registry
    mods = lv['modules']
    if any(m['id'] in ('dfw', 'employment') for m in mods):
        die('the previous console already carries dfw or employment; build from the earlier edition')
    mods.insert(next(i for i, m in enumerate(mods) if m['id'] == 'family') + 1, emp_mod)
    mods.insert(next(i for i, m in enumerate(mods) if m['id'] == 'hvac') + 1, dfw_mod)
    next(m for m in mods if m['id'] == 'hvac')['navTitle'] = 'HVAC · Louisiana'
    verts = lv['verts']
    verts.insert(next(i for i, v in enumerate(verts) if v['key'] == 'fam') + 1, emp_vert)
    verts.insert(next(i for i, v in enumerate(verts) if v['key'] == 'hvac') + 1, dfw_vert)
    C['v']['dfw'] = col
    C['v']['emp'] = ecol

    # ---- correlations: Spearman of state percentiles over the ZIPs both atlases score (the console's own rule)
    for st in ['TX', 'LA']:
        M = lv['corr'][st]
        keys = list(M['keys'])
        new = ['emp', 'dfw'] if st == 'TX' else ['emp']
        # keep the lens order: new keys sit where their verticals sit in the verts list
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
                    if C['st'][i] != st or pa[i] is None or pb[i] is None:
                        continue
                    xs.append(pa[i]); ys.append(pb[i])
                r = spearman(xs, ys) if len(xs) >= 10 else None
                M['m'][a + '|' + b] = {'r': round(r, 3) if r is not None else None, 'n': len(xs)}
        M['keys'] = order
    return lv


# ----------------------------------------------------------------------------------------------- frame patches
def patch_frame(frame):
    P = [
        ("  legal: { id: 'legal', label: 'Legal', mods: ['criminal', 'injury', 'family'],\n    dek: 'Three practice areas, three atlases: criminal defense and personal injury across all 254 Texas counties, family law across every county and parish in Texas and Louisiana.' },",
         "  legal: { id: 'legal', label: 'Legal', mods: ['criminal', 'injury', 'family', 'employment'],\n    dek: 'Four practice areas, four atlases: criminal defense and personal injury across all 254 Texas counties, family law across every county and parish in Texas and Louisiana, and employment law scored for every buyable ZIP code in the country.' },",
         'legal wing'),
        ("  home: { id: 'home', label: 'Home services', mods: ['hvac', 'roofing', 'plumbing', 'pest'],\n    dek: 'Four trades: HVAC and roofing across all 64 Louisiana parishes, plumbing and pest control across every county and parish in both states.' },",
         "  home: { id: 'home', label: 'Home services', mods: ['hvac', 'dfw', 'roofing', 'plumbing', 'pest'],\n    dek: 'Four trades, five atlases: HVAC twice, across all 64 Louisiana parishes and across the twelve counties of Dallas Fort Worth; roofing across Louisiana; plumbing and pest control across every county and parish in both states.' },",
         'home wing'),
        ("function scopeLabel(id) { const m = MOD[id]; return m && m.scope === 'national' ? 'National' : statesLabel(statesOf(id)); }",
         "function scopeLabel(id) { const m = MOD[id]; return m && m.scopeLabel ? m.scopeLabel : m && m.scope === 'national' ? 'National' : statesLabel(statesOf(id)); }",
         'scope label'),
        ("  const title = id === 'core' ? 'OmegaWeapon' : m.wing === 'core' ? m.short : m.vertical;",
         "  const title = id === 'core' ? 'OmegaWeapon' : m.wing === 'core' ? m.short : (m.navTitle || m.vertical);",
         'spine title'),
        ("""let extLoad = null;
function loadExt() {
  /* the offline copy keeps its largest atlases in a companion script beside the page */
  if (window.__LVP) return Promise.resolve();
  if (!extLoad) extLoad = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = LV.ext.file;
    sc.onload = () => res();
    sc.onerror = () => { extLoad = null; sc.remove(); rej(new Error(LV.ext.file + ' did not load. Keep it in the same folder as this page, then try again.')); };
    document.head.appendChild(sc);
  });
  return extLoad;
}
async function getPayload(id) {
  const el = document.getElementById('lvp-' + id);
  let b64;
  if (el) b64 = el.textContent;
  else if (LV.ext && LV.ext.ids.includes(id)) {
    await loadExt();
    b64 = (window.__LVP || {})[id];
    if (!b64) throw new Error('The ' + MOD[id].short + ' data is missing from ' + LV.ext.file + '.');
  } else {""",
         """const EXT = Array.isArray(LV.ext) ? LV.ext : (LV.ext ? [LV.ext] : []);
const extLoad = {};
function extFor(id) { return EXT.find(x => (x.ids || []).includes(id)) || null; }
function loadExt(x) {
  /* the offline copy keeps its largest atlases in companion scripts beside the page, each under 50 MB */
  if (window.__LVP && (x.ids || []).every(id => window.__LVP[id])) return Promise.resolve();
  if (!extLoad[x.file]) extLoad[x.file] = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = x.file;
    sc.onload = () => res();
    sc.onerror = () => { delete extLoad[x.file]; sc.remove(); rej(new Error(x.file + ' did not load. Keep it in the same folder as this page, then try again.')); };
    document.head.appendChild(sc);
  });
  return extLoad[x.file];
}
async function getPayload(id) {
  const el = document.getElementById('lvp-' + id);
  const x = extFor(id);
  let b64;
  if (el) b64 = el.textContent;
  else if (x) {
    await loadExt(x);
    b64 = (window.__LVP || {})[id];
    if (!b64) throw new Error('The ' + MOD[id].short + ' data is missing from ' + x.file + '.');
  } else {""",
         'companion loader'),
        ("  const rx = /^([\\d,]+)\\s+(firms watched|licensed competitors|roofers watched|licensed shops)$/;",
         "  const rx = /^([\\d,]+)\\s+(firms watched|licensed competitors|roofers watched|licensed shops|competitor locations mapped)$/;",
         'competitor count'),
        ("natZ ? tile('National ZIPs', N(natZ), 'dental and eye care score every buyable US ZIP')",
         "natZ ? tile('National ZIPs', N(natZ), 'dental, eye care and employment law score every buyable US ZIP')",
         'national tile'),
        ("the Defense Demand, Case Flow, Matter Flow, Thermal Debt, Roof Demand, Pipe Debt, Pest Demand and Patient Flow indexes. Convergence ranks each index again inside the ZIP’s own state, so Texas ZIPs are measured against Texas and Louisiana ZIPs against Louisiana. Ties take the middle rank.'",
         "the Defense Demand, Case Flow, Matter Flow, Thermal Debt (Louisiana and Dallas Fort Worth), Roof Demand, Pipe Debt, Pest Demand and Patient Flow indexes, and the Efficiency indexes of the three national atlases (dental, eye care, employment law). Convergence ranks each index again inside the ZIP’s own state, so Texas ZIPs are measured against Texas and Louisiana ZIPs against Louisiana; the Dallas Fort Worth atlas scores only its twelve counties, so its percentiles run within that metro. Ties take the middle rank.'",
         'convergence method'),
        ("  ['crim', 'Criminal defense', 'legal'], ['pi', 'Personal injury', 'legal'], ['fam', 'Family law', 'legal'], ['legal', 'Legal, any practice', 'legal'],",
         "  ['crim', 'Criminal defense', 'legal'], ['pi', 'Personal injury', 'legal'], ['fam', 'Family law', 'legal'], ['emp', 'Employment law', 'legal'], ['legal', 'Legal, any practice', 'legal'],",
         'agency verticals'),
        ("const SPECIFIC = ['crim', 'pi', 'fam', 'hvac', 'roof', 'plumb', 'pest', 'onc', 'dent', 'eye'];",
         "const SPECIFIC = ['crim', 'pi', 'fam', 'emp', 'hvac', 'roof', 'plumb', 'pest', 'onc', 'dent', 'eye'];",
         'specific verticals'),
        ("const WING_KEYS = { legal: ['crim', 'pi', 'fam', 'legal'], home: ['hvac', 'roof', 'plumb', 'pest', 'home'], health: ['onc', 'dent', 'eye', 'health'] };",
         "const WING_KEYS = { legal: ['crim', 'pi', 'fam', 'emp', 'legal'], home: ['hvac', 'roof', 'plumb', 'pest', 'home'], health: ['onc', 'dent', 'eye', 'health'] };",
         'wing keys'),
        ("window.__LV_CONSOLE = { live, open: openModule, go, prefs, version: '1.0.0' };",
         "window.__LV_CONSOLE = { live, open: openModule, go, prefs, version: '1.1.0' };",
         'console version'),
    ]
    for old, new, label in P:
        frame = replace_once(frame, old, new, 'frame ' + label)
    return frame


def patch_head(head):
    head = replace_once(head,
        '<meta name="description" content="Leviathan: OmegaWeapon and the Hit Board at the core, ten industry atlases in three wings (legal, home services and healthcare), plus a cross industry Convergence map and Agency Field.">',
        '<meta name="description" content="Leviathan: OmegaWeapon and the Hit Board at the core, twelve industry atlases in three wings (legal, home services and healthcare), plus a cross industry Convergence map and Agency Field.">',
        'head description')
    head = replace_once(head, '/* Leviathan: one console, OmegaWeapon at the core, eight industry atlases around it.',
                        '/* Leviathan: one console, OmegaWeapon at the core, twelve industry atlases around it.', 'head comment')
    return head


# ----------------------------------------------------------------------------------------------- output
def payload_line(mid, b64):
    return f'<script type="text/plain" id="lvp-{mid}">{b64}</script>'


def write_companion(path, ids, payloads, page_name):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(f'/* Leviathan offline data: keep this file in the same folder as {page_name} */\n')
        f.write('window.__LVP=window.__LVP||{};\n')
        for mid in ids:
            f.write(f'window.__LVP["{mid}"]="{payloads[mid]}";\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--prev-html', required=True)
    ap.add_argument('--prev-data', required=True)
    ap.add_argument('--dfw', required=True)
    ap.add_argument('--termination', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--online')
    ap.add_argument('--page', default='Leviathan.html')
    a = ap.parse_args()

    head, lv, inline, ext, frame = read_prev(a.prev_html, a.prev_data)
    payloads = collections.OrderedDict()
    payloads.update(inline); payloads.update(ext)
    dental_src = gunzip_b64(payloads['dental'])
    hvac_src = gunzip_b64(payloads['hvac'])
    shell_head, shell_bridge, rail_head, rail_bridge = injection_blocks(dental_src, hvac_src)

    with open(a.dfw, encoding='utf-8') as f:
        dfw_src = f.read()
    with open(a.termination, encoding='utf-8') as f:
        term_src = f.read()
    dfw_wrapped = wrap_dfw(dfw_src, rail_head, rail_bridge)
    term_wrapped, _ = wrap_termination(term_src, shell_head, shell_bridge)
    dfw_b64, dfw_raw, dfw_gz = gzip_b64(dfw_wrapped)
    term_b64, term_raw, term_gz = gzip_b64(term_wrapped)
    payloads['dfw'] = dfw_b64
    payloads['employment'] = term_b64

    lv = extend_registry(lv, dfw_src, term_src, (dfw_raw, dfw_gz), (term_raw, term_gz))
    frame = patch_frame(frame)
    head = patch_head(head)

    # ---- offline edition: inline the smaller atlases, companions for the three largest plus the new national one
    inline_ids = list(inline.keys())
    inline_ids.insert(inline_ids.index('hvac') + 1, 'dfw')
    companions = [
        {'file': 'Leviathan-data.js', 'ids': list(ext.keys())},
        {'file': 'Leviathan-data-2.js', 'ids': ['employment']},
    ]
    os.makedirs(a.out, exist_ok=True)
    lv_off = dict(lv); lv_off['ext'] = companions
    data_line = '<script type="application/json" id="lv-data">' + json.dumps(lv_off, ensure_ascii=False, separators=(',', ':')) + '</script>'
    page = os.path.join(a.out, a.page)
    with open(page, 'w', encoding='utf-8') as f:
        f.write(head)
        f.write(data_line + '\n')
        for mid in inline_ids:
            f.write(payload_line(mid, payloads[mid]) + '\n')
        f.write(frame)
    for c in companions:
        write_companion(os.path.join(a.out, c['file']), c['ids'], payloads, a.page)
    sizes = {os.path.basename(p): os.path.getsize(p) for p in [page] + [os.path.join(a.out, c['file']) for c in companions]}
    for n, s in sizes.items():
        print(f'  {n:24s} {s / 1048576:7.1f} MB' + ('   OVER 50 MB' if s > 50 * 1048576 else ''))
    if any(s > 50 * 1048576 for s in sizes.values()):
        die('an output file crossed 50 MB')

    # ---- hosted edition: a small page, every module fetched from m/<id>.txt on demand
    if a.online:
        mdir = os.path.join(a.online, 'm')
        os.makedirs(mdir, exist_ok=True)
        lv_on = dict(lv); lv_on['ext'] = []
        with open(os.path.join(a.online, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(head)
            f.write('<script type="application/json" id="lv-data">' + json.dumps(lv_on, ensure_ascii=False, separators=(',', ':')) + '</script>\n')
            f.write(frame)
        for mid, b64 in payloads.items():
            with open(os.path.join(mdir, mid + '.txt'), 'w', encoding='ascii') as f:
                f.write(b64)
        print(f'  online edition: {a.online}/index.html + {len(payloads)} module files')
    print('modules: ' + ', '.join(m['id'] for m in lv['modules']))


if __name__ == '__main__':
    main()
