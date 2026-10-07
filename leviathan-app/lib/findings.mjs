/* Build time: the findings the Résumé Forge reads, taken from the console itself. Node 22, no npm packages.
   extractFindings(consoleHtml): unpacks the OmegaWeapon Core payload (lvp-core: gzip, base64) and the Hit Board payload
   (lvp-hitboard), reads the Agency Radar (window.RADAR: 222 agencies, their say/do gaps, Horus moves and bands, Monsoon
   offshore reads, client needs, dossier narratives), the ten Hit Board dossiers, and the console's own lv-data block
   (vertical reach into the wings), and compacts them into one object per agency plus the field context.
   findingsScript(F): the script the console loads ahead of its frame script, console/ext/resume-findings.js.
   Nothing here is invented: every field is copied or counted from the record; the Forge decides what it means. */
import zlib from 'node:zlib';
import vm from 'node:vm';

export const FINDINGS_VERSION = '1';
const TEXT_CAP = 2400;

function payload(html, id) {
  const m = new RegExp('<script type="text/plain" id="lvp-' + id + '">([\\s\\S]*?)</script>').exec(html);
  if (!m) throw new Error('the ' + id + ' payload is not inline in the console');
  return zlib.gunzipSync(Buffer.from(m[1].replace(/\s+/g, ''), 'base64')).toString('utf8');
}
export function readLvData(html) {
  const m = /<script type="application\/json" id="lv-data">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('the lv-data block is missing from the console');
  return JSON.parse(m[1]);
}
export function readRadar(coreHtml) {
  const a = coreHtml.indexOf('window.RADAR=');
  if (a < 0) throw new Error('window.RADAR is missing from the OmegaWeapon payload');
  const b = coreHtml.indexOf('\nwindow.RADAR_INDEX=', a);
  if (b < 0) throw new Error('window.RADAR_INDEX is missing from the OmegaWeapon payload');
  const txt = coreHtml.slice(a + 'window.RADAR='.length, b).trim().replace(/;$/, '');
  return JSON.parse(txt);
}
export function readHitBoard(hbHtml) {
  const a = hbHtml.indexOf('const TARGETS=[');
  if (a < 0) throw new Error('the Hit Board TARGETS array is missing');
  const b = hbHtml.indexOf('\n];', a);
  if (b < 0) throw new Error('the Hit Board TARGETS array does not end');
  const literal = hbHtml.slice(a + 'const TARGETS='.length, b + 2);
  const out = vm.runInNewContext('(' + literal + ')', {}, { timeout: 2000 });
  if (!Array.isArray(out) || !out.length) throw new Error('the Hit Board TARGETS array is empty');
  return out;
}

/* the Hit Board's rival-voiced wedge text is reduced here to neutral hiring themes; the text itself never ships */
export const HB_THEMES = [
  ['retention', /churn|cancel|billing|complaint|collections|underserved|burned/i],
  ['site-ownership', /website|cms|own(?:s|ership)|hostage|proprietary|migrat/i],
  ['production-quality', /outsourc|overseas|offshore|white.?label|\bAI\b|layoff/i],
  ['lead-quality', /junk|fabricated|bot leads?|lead quality|leads? counted/i],
];
export function hbThemes(wedge) { const out = HB_THEMES.filter(([, re]) => re.test(String(wedge || ''))).map(([k]) => k); return out.length ? out : ['retention']; }
const str = v => (typeof v === 'string' ? v : v == null ? null : String(v));
const cap = (s, n) => { s = str(s); if (!s) return null; s = s.trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const num = v => (typeof v === 'number' && isFinite(v) ? Math.round(v * 10) / 10 : null);
const int = v => (typeof v === 'number' && isFinite(v) ? Math.round(v) : null);
const list = (v, n) => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()).slice(0, n || 99) : []);
const uniq = a => Array.from(new Set(a));

function compact(a, lvAgency, hb, dims) {
  const hz = a.horus || {}, mo = a.offshore || {}, nd = a.needs || {}, g = a.google || {}, li = a.linkedin || {};
  const txt = (a.dossier && a.dossier.text) || {};
  const strat = {}; for (const [k] of dims) strat[k] = int((a.strategy || {})[k]) || 0;
  const moves = {}, mev = []; for (const p in (hz.moves || {})) { moves[p] = str(hz.moves[p] && hz.moves[p].s) || 'unknown'; if (hz.moves[p] && Array.isArray(hz.moves[p].ev) && hz.moves[p].ev.length) mev.push(p); }
  const contrib = Array.isArray(mo.contrib) ? mo.contrib.slice().sort((x, y) => (y.pts || 0) - (x.pts || 0)).slice(0, 4).map(c => ({ cap: c.cap, label: c.label, pts: num(c.pts), off: int(c.off) })) : [];
  return {
    id: a.id, name: a.name, domain: a.domain, region: a.region, hq: str(lvAgency ? lvAgency.hq : [a.hq_city, a.hq_country].filter(Boolean).join(', ')) || null,
    segment: str(a.segment), archetype: str(a.archetype), icp: str(a.icp), ownership: str(a.ownership), owner: cap(a.owner, 160),
    status: str(a.status), status_note: cap(a.status_note, 240), successor: str(a.successor), employees: int(a.employees_n), offices: list(a.offices, 6),
    positioning: cap(a.positioning, 400), headline: cap(a.headline_claim, 300), ai_posture: cap(a.ai_posture, 400),
    services: list(a.services, 16), proprietary: list(a.proprietary, 8), verticals: list(a.verticals, 24),
    wv: lvAgency && lvAgency.verts ? lvAgency.verts : {},
    strat, core: list(a.core), lead: list(a.lead), breadth: int(a.breadth), confidence: str(a.confidence),
    gaps: (Array.isArray(a.gaps) ? a.gaps : []).map(x => (typeof x === 'string' ? { code: null, label: x } : { code: str(x.code), label: str(x.label) })).filter(x => x.label),
    tags: list(a.tags, 20), cms: list(a.cms, 4),
    content: { urls: int(a.sitemap_urls), d90: int(a.content_90d), d365: int(a.content_365d), llms: a.llms_txt === true ? true : a.llms_txt === false ? false : null, ai_urls: int(a.ai_urls), bots: list(a.ai_bots_blocked, 8) },
    paid: { g: str(g.status), gn: int(typeof g.count === 'number' ? g.count : null), g30: int(g.count_30d), li: str(li.status), lin: int(li.company_ads), pixels: list(a.pixels_social, 6), tests: list(a.test_tools, 6) },
    prom: typeof a.prominence === 'number' ? Math.round(a.prominence * 100) / 100 : null,
    clients: { n: int(nd.n) || (Array.isArray(a.clients) ? a.clients.length : 0), observed: int(nd.observed) || 0, named: int(nd.named_only) || 0 },
    needs: { top: list(nd.top, 3), mix: (nd.mix || []).map(m => ({ code: m.code, share: typeof m.share === 'number' ? Math.round(m.share * 1000) / 1000 : null, n: int(m.n) })), inferred: list(nd.inferred_from_mix, 4) },
    horus: hz.ok ? {
      ok: true, band: str(hz.band), hti: num(hz.hti), pct: int(hz.hti_pct), head: list(hz.kj_head, 3), tail: list(hz.kj_tail, 3), top: list(hz.kj_top, 3),
      moves, mev, score: hz.moves_score ? { making: int(hz.moves_score.making) || 0, partial: int(hz.moves_score.partial) || 0, applicable: int(hz.moves_score.applicable) || 0 } : null,
      house: hz.house ? { tested: int(hz.house.tested) || 0, corroborated: int(hz.house.corroborated) || 0, contradicted: int(hz.house.contradicted) || 0 } : null,
      scen: str(hz.scen_best), resilience: num(hz.resilience), verdict: cap(hz.verdict, 300),
    } : { ok: false, reason: cap(hz.reason || hz.verdict, 240) },
    monsoon: mo.ok ? {
      ok: true, band: str(mo.band), index: num(mo.index), pct: int(mo.index_pct), migration: num(mo.migration), displacement: num(mo.displacement), top: contrib,
      onshore: Array.isArray(mo.onshore_claims) ? mo.onshore_claims.length : 0, claims: (mo.onshore_claims || []).slice(0, 2).map(c => cap(c.t, 160)).filter(Boolean),
      hubs: (mo.hub_offices || []).length + (mo.hub_jobs || []).length, cls: str(mo.evidence_class) || 'inferred', verdict: cap(mo.verdict, 300),
    } : { ok: false, reason: cap(mo.reason || mo.verdict, 240) },
    hb: hb ? { wave: int(hb.wave), soft: int(hb.soft), fit: int(hb.fit), pri: num(hb.pri), arch: cap(hb.arch, 160), themes: hbThemes(hb.wedge), verticals: cap(hb.verticals, 300) } : null,
    text: { bluf: cap(txt.bluf, TEXT_CAP), openings: cap(txt.openings, TEXT_CAP), written: str(txt.written) },
    sources: list(a.sources, 3), deep: !!a.is_deep,
  };
}

export function extractFindings(html, opts = {}) {
  const lv = readLvData(html);
  const R = readRadar(payload(html, 'core'));
  let targets = [];
  try { targets = readHitBoard(payload(html, 'hitboard')); } catch (e) { if (!opts.lenient) throw e; }
  const dims = Array.isArray(R.meta && R.meta.strat_dims) ? R.meta.strat_dims : [];
  if (!dims.length) throw new Error('the Radar names no strategy dimensions');
  const lvBy = {}; for (const a of (lv.agencies || [])) lvBy[a.id] = a;
  const hbBy = {};
  for (const t of (lv.core && lv.core.hitboard) || []) {
    const full = targets.find(x => x.domain === t.domain || x.name === t.name) || {};
    if (t.radar) hbBy[t.radar] = Object.assign({}, full, { wave: t.wave, soft: t.soft, fit: t.fit, pri: t.pri, arch: t.arch || full.arch });
  }
  const agencies = (R.agencies || []).map(a => compact(a, lvBy[a.id], hbBy[a.id] || null, dims)).sort((x, y) => x.name.localeCompare(y.name));
  const gapCodes = {};
  for (const a of agencies) for (const g of a.gaps) if (g.code && !gapCodes[g.code]) gapCodes[g.code] = g.label;
  const ed = (R.horus && R.horus.edition) || {};
  const tax = (R.needs && R.needs.taxonomy) || {};
  const htis = agencies.map(a => a.horus.hti).filter(v => v != null).sort((x, y) => x - y);
  const mons = agencies.map(a => a.monsoon.index).filter(v => v != null).sort((x, y) => x - y);
  const med = v => (v.length ? v[Math.floor(v.length / 2)] : null);
  const withHorus = agencies.filter(a => a.horus.ok);
  const moveRates = {};
  for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']) {
    const states = { making: 0, partial: 0, absent: 0, unknown: 0, na: 0 };
    for (const a of withHorus) { const s = a.horus.moves[p]; if (s in states) states[s]++; else states.unknown++; }
    const n = Math.max(1, withHorus.length);
    moveRates[p] = {}; for (const k in states) moveRates[p][k] = Math.round(1000 * states[k] / n) / 1000;
  }
  const gapRates = {};
  for (const code in gapCodes) gapRates[code] = Math.round(1000 * agencies.filter(a => a.gaps.some(g => g.code === code)).length / Math.max(1, agencies.length)) / 1000;
  const offsh = ((R.offshore || {}).model || {}).offshorability || {};
  const offshorability = {}; for (const [k] of dims) if (offsh[k]) offshorability[k] = { off: int(offsh[k].off), labor: num(offsh[k].labor), why: cap(offsh[k].why, 300) };
  return {
    version: FINDINGS_VERSION, built: opts.built || new Date().toISOString().slice(0, 10), compiled: lv.compiled || null,
    generated: (R.meta && R.meta.generated) || null, edition: str(ed.edition) || (lv.core && lv.core.edition) || null, run_date: str(ed.run_date) || null,
    n: agencies.length, n_deep: agencies.filter(a => a.deep).length, note: cap(R.meta && R.meta.note, 600),
    dims, taxonomy: tax,
    implications: (ed.implications || []).map(p => ({ id: p.id, move: p.move, detail: cap(p.detail, 400), kj: list(p.kj) })),
    kj: (ed.key_judgments || []).map(k => ({ id: k.id, title: k.title, likelihood: str(k.likelihood), range: str(k.range) })),
    scenarios: (((ed.scenarios || {}).items) || []).map(s => ({ id: s.id, name: s.name, probability: int(s.probability) })),
    gapCodes, offshorability,
    field: {
      strategy: ((R.agg || {}).strategy || []).map(s => ({ key: s.key, label: s.label, mean: num(s.mean), invest_pct: int(s.invest_pct), heavy_pct: int(s.heavy_pct) })),
      needs: (((R.needs || {}).field || {}).mix || []).map(m => ({ code: m.code, share: num(m.share) })),
      hti_median: med(htis), mon_median: med(mons), gaps: ((R.agg || {}).gaps || []).slice(0, 8).map(g => ({ label: g.label, n: int(g.n) })),
      moves: moveRates, gapRates, withHorus: withHorus.length, stalled: agencies.filter(a => a.content.urls && a.content.d90 === 0).length,
    },
    agencies,
  };
}

/* The findings travel as one JSON string the engine parses on first use, so the console's start does not pay for them. */
export function findingsScript(F) {
  const meta = { version: F.version, built: F.built, compiled: F.compiled, generated: F.generated, edition: F.edition, n: F.n, n_deep: F.n_deep };
  return '/* Generated by build.mjs from the Leviathan console (the OmegaWeapon Agency Radar, the Hit Board and the Agency Field). Do not edit; rebuild instead.\n' +
    '   Read by console/ext/resume-engine.js. Radar compiled ' + (F.generated || '?') + ', Horus edition ' + (F.edition || '?') + ', ' + F.n + ' agencies, ' + F.n_deep + ' deep dossiers. */\n' +
    'globalThis.LV_FINDINGS_META = ' + JSON.stringify(meta) + ';\n' +
    'globalThis.LV_FINDINGS_RAW = ' + JSON.stringify(JSON.stringify(F)) + ';\n';
}
/* read a generated findings script back (build validation and the tests) */
export function readFindingsScript(js) {
  const m = /globalThis\.LV_FINDINGS_RAW = ("(?:[^"\\]|\\.)*");\s*$/.exec(js);
  if (!m) throw new Error('the findings script carries no LV_FINDINGS_RAW string');
  return JSON.parse(JSON.parse(m[1]));
}
