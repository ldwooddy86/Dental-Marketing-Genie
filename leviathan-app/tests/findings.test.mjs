/* lib/findings.mjs: the Résumé Forge findings extracted from the built console, and the generated script read back. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { extractFindings, findingsScript, readFindingsScript, readRadar, readHitBoard, hbThemes, neutralBluf, HB_THEMES } from '../lib/findings.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
let fails = 0;
const ok = (c, label, extra) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${extra !== undefined ? '  (' + String(extra).slice(0, 220) + ')' : ''}`); if (!c) fails++; };

/* ---- the readers on small synthetic inputs ---- */
{
  const radar = { meta: { strat_dims: [['seo', 'SEO']] }, agencies: [] };
  const core = 'x\nwindow.RADAR=' + JSON.stringify(radar) + ';\nwindow.RADAR_INDEX=[];';
  ok(readRadar(core).meta.strat_dims[0][0] === 'seo', 'readRadar finds window.RADAR between its markers');
  let threw = false; try { readRadar('nothing here'); } catch (e) { threw = true; } ok(threw, 'readRadar throws when the Radar is missing');
  const hb = 'const TARGETS=[\n {name:"A",domain:"a.com",wave:1,soft:9,fit:8,arch:"x [y]",wedge:"w"},\n {name:"B",domain:"b.com",wave:2}\n];\n\nconst ARSENAL=[];';
  const t = readHitBoard(hb);
  ok(t.length === 2 && t[0].name === 'A' && t[0].arch === 'x [y]' && t[1].wave === 2, 'readHitBoard evaluates the TARGETS literal in a vm', JSON.stringify(t[0]));
  threw = false; try { readHitBoard('const TARGETS=[ {name:"A"} '); } catch (e) { threw = true; } ok(threw, 'readHitBoard throws when the array does not end');
  ok(hbThemes('localiq.com').join() === 'retention,lead-quality' && hbThemes('WebFX.com').join() === 'vertical-depth,site-ownership' && hbThemes('nobody.example').length === 0 && Object.keys(HB_THEMES).length === 10, 'hbThemes is a curated table by domain, empty for a target it does not know');
  ok(neutralBluf('Acme is a Boston agency selling SEO. The one thing a rival should know: it has no pricing. It was founded in 2001.') === 'Acme is a Boston agency selling SEO. It was founded in 2001.' && neutralBluf('') === null, 'neutralBluf drops the sentences written for a rival');
}

/* ---- the built console ---- */
if (!exists('console/Leviathan.html')) { console.log('console/Leviathan.html is not built; skipping the extraction checks.'); if (fails) process.exit(1); process.exit(0); }
const html = read('console/Leviathan.html');
const t0 = Date.now();
const F = extractFindings(html, { built: '2026-01-01' });
ok(F.n === F.agencies.length && F.n >= 200, 'extracts every Radar agency', `${F.n} agencies in ${Date.now() - t0} ms`);
ok(F.n_deep > 0 && F.n_deep < F.n, 'counts the deep dossiers', F.n_deep);
ok(F.dims.length === 15 && F.dims.every(d => Array.isArray(d) && d.length === 2), 'carries the fifteen strategy dimensions');
ok(Object.keys(F.taxonomy).length >= 12 && F.taxonomy.N1 && F.taxonomy.N1.label, 'carries the needs taxonomy', Object.keys(F.taxonomy).length + ' codes');
ok(F.implications.length === 8 && F.implications.every(p => /^P\d$/.test(p.id) && p.move), 'carries the eight Horus implications', F.implications.map(p => p.id).join(','));
ok(F.kj.length >= 10 && F.kj.every(k => k.title), 'carries the key judgments', F.kj.length);
ok(Object.keys(F.gapCodes).length >= 6 && F.gapCodes.ai_no_llms, 'collects the say/do gap codes', Object.keys(F.gapCodes).join(','));
ok(F.field.strategy.length === 15 && F.field.strategy.every(s => typeof s.invest_pct === 'number'), 'carries the field investment shares');
ok(typeof F.field.hti_median === 'number' && typeof F.field.mon_median === 'number', 'computes the field medians', `hti ${F.field.hti_median}, mon ${F.field.mon_median}`);
const lv = JSON.parse(/<script type="application\/json" id="lv-data">([\s\S]*?)<\/script>/.exec(html)[1]);
const idx = (lv.agencyIndex || []).map(a => a.id).sort();
ok(idx.join() === F.agencies.map(a => a.id).sort().join(), 'the agencies match the console agencyIndex exactly');
const withWv = F.agencies.filter(a => Object.keys(a.wv || {}).length).length;
ok(withWv === (lv.agencies || []).length, 'vertical reach comes from the Agency Field for exactly its agencies', `${withWv} of ${(lv.agencies || []).length}`);
const hb = F.agencies.filter(a => a.hb);
ok(hb.length >= 8 && hb.every(a => a.hb.wave && Array.isArray(a.hb.themes) && a.hb.themes.length), 'the Hit Board agencies on the Radar carry wave and curated themes', hb.map(a => a.name + ':' + a.hb.themes.join('+')).join(', '));
ok(!/"kill"|"wedge"|"arch"/.test(JSON.stringify(F)) && !F.agencies.some(a => /\brivals?\b/i.test(a.text.bluf || '')), 'the rival-voiced Hit Board texts and the dossier sentences written for a rival never ship');
ok(hb.find(a => a.id === 'webfx').hb.themes.join() === 'vertical-depth,site-ownership' && !hb.find(a => a.id === 'webfx').hb.themes.includes('retention'), 'WebFX, "not a churn play", carries no retention theme');
ok(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'].every(p => F.field.moves[p] && typeof F.field.moves[p].absent === 'number' && typeof F.field.moves[p].applicable === 'number') && F.field.moves.P2.absent > 0.6 && F.field.moves.P3.na > 0.5 && F.field.moves.P3.absent > 0.4 && typeof F.field.gapRates.ai_no_llms === 'number' && F.field.stalled > 0, 'the field base rates of the moves (over the agencies they apply to) and the gaps are computed', JSON.stringify(F.field.moves.P3) + ' ' + JSON.stringify(F.field.gapRates));
for (const a of F.agencies) {
  const bad = [];
  if (!a.id || !a.name || !a.domain) bad.push('identity');
  if (!a.strat || Object.keys(a.strat).length !== 15) bad.push('strat');
  if (!Array.isArray(a.gaps) || !a.gaps.every(g => g.label)) bad.push('gaps');
  if (!a.horus || typeof a.horus.ok !== 'boolean') bad.push('horus');
  if (!a.monsoon || typeof a.monsoon.ok !== 'boolean') bad.push('monsoon');
  if (!a.needs || !Array.isArray(a.needs.top) || !Array.isArray(a.needs.mix)) bad.push('needs');
  if (!a.content || !a.paid || !a.clients || !a.text) bad.push('blocks');
  if (a.horus.ok && (typeof a.horus.hti !== 'number' || !a.horus.band || !a.horus.moves)) bad.push('horus fields');
  if (a.monsoon.ok && (typeof a.monsoon.index !== 'number' || !a.monsoon.band)) bad.push('monsoon fields');
  if (bad.length) { ok(false, 'agency ' + a.id + ' is complete', bad.join(',')); break; }
}
ok(true, 'every agency carries identity, strategy, gaps, Horus, Monsoon, needs, content, paid, clients and text');
const sc = F.agencies.find(a => a.id === 'scorpion');
ok(!!sc && sc.hb && sc.hb.wave === 1 && sc.hb.themes.includes('site-ownership') && sc.horus.ok && sc.horus.band && Array.isArray(sc.horus.mev) && sc.horus.house && typeof sc.horus.house.tested === 'number' && sc.monsoon.ok && sc.monsoon.cls === 'observed' && sc.needs.inferred.includes('local') && sc.verticals.includes('HVAC'), 'spot check: Scorpion', sc && JSON.stringify({ band: sc.horus.band, mon: sc.monsoon.band, wave: sc.hb && sc.hb.wave, themes: sc.hb && sc.hb.themes, mev: sc.horus.mev }));
const otm = F.agencies.find(a => a.id === 'on-the-map-marketing');
ok(!!otm && otm.gaps.some(g => g.code === 'search_no_ads') && otm.horus.moves.P1 === 'absent' && otm.needs.top[0] === 'N10' && otm.wv.dent && otm.paid.g === 'none', 'spot check: On The Map Marketing', otm && JSON.stringify({ gaps: otm.gaps.map(g => g.code), P1: otm.horus.moves.P1, top: otm.needs.top, g: otm.paid.g }));
ok(F.agencies.every(a => !a.text.bluf || a.text.bluf.length <= 2400) && F.agencies.every(a => !a.horus.verdict || a.horus.verdict.length <= 300), 'narratives and verdicts are capped');

/* ---- the generated script and its read back ---- */
const js = findingsScript(F);
ok(js.length < 1.3 * 1024 * 1024, 'the findings script stays under 1.3 MB', (js.length / 1024).toFixed(0) + ' KB');
const ctx = vm.createContext({}); vm.runInContext(js, ctx);
ok(ctx.LV_FINDINGS_META && ctx.LV_FINDINGS_META.n === F.n && typeof ctx.LV_FINDINGS_RAW === 'string', 'the script sets LV_FINDINGS_META and LV_FINDINGS_RAW');
const back = JSON.parse(ctx.LV_FINDINGS_RAW);
ok(back.n === F.n && back.agencies.length === F.n && back.agencies[0].id === F.agencies[0].id, 'LV_FINDINGS_RAW parses back to the findings');
ok(readFindingsScript(js).n === F.n, 'readFindingsScript reads the generated script');
if (exists('console/ext/resume-findings.js')) {
  const shipped = readFindingsScript(read('console/ext/resume-findings.js'));
  ok(shipped.agencies.map(a => a.id).sort().join() === idx.join(), 'the shipped console/ext/resume-findings.js is in step with the console', shipped.n + ' agencies, built ' + shipped.built);
} else ok(false, 'console/ext/resume-findings.js is present');

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
