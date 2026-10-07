/* console/ext/resume-engine.js in a vm: findings into gaps and lines, the ranked tracks, the agency vocabulary, the build,
   the ATS readiness with its gates, the mirror count, readability, the posting match, the brief and the search. The view
   (resume-forge.js) is only parsed here; the end to end run drives it in Chromium. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { extractFindings } from '../lib/findings.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
let fails = 0;
const ok = (c, label, extra) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${extra !== undefined ? '  (' + String(extra).slice(0, 240) + ')' : ''}`); if (!c) fails++; };

/* ---- the engine loads without a DOM ---- */
const ctx = vm.createContext({ console });
vm.runInContext(read('console/ext/resume-engine.js'), ctx);
const E = ctx.__LV_RESUME_ENGINE;
ok(!!E && typeof E.read === 'function' && typeof E.build === 'function' && typeof E.lint === 'function' && typeof E.mirror === 'function', 'the engine registers as __LV_RESUME_ENGINE without a document');
ok(E.TRACKS.length === 17 && E.TRACKS.every(t => t.code && t.label && ['junior', 'mid', 'senior', 'manager', 'director'].every(l => t.titles[l]) && t.verbs.length >= 8 && t.keywords.length >= 10 && t.summary.includes('%ROLE%') && t.starters.length >= 3 && t.asks.length >= 1), 'seventeen hiring tracks, each with a title per level, verbs, keywords, starters and questions');
ok(E.INDUSTRIES.length === 12 && E.INDUSTRIES.every(i => i.id && i.verbs.length === 10 && i.keywords.length === 10 && i.summary && i.titles.mid), 'Clapback’s twelve industry profiles ride along as general tracks');
ok(Object.keys(E.GAP).length === 7 && Object.keys(E.MOVE).length === 8 && Object.keys(E.HB_THEME).length === 4, 'rules for the seven gap codes, the eight Horus moves and the four Hit Board themes');
ok(Object.values(E.DIM_TRACK).every(t => E.TRACK[t]) && Object.values(E.NEED_TRACK).flat().every(t => E.TRACK[t]) && Object.values(E.KJ_TRACK).flat().every(t => E.TRACK[t]) && Object.values(E.GAP).flatMap(g => g.tracks).every(t => E.TRACK[t]) && Object.values(E.MOVE).flatMap(m => m.tracks).every(t => E.TRACK[t]), 'every mapping points at a real track');
{ let p = true; try { new vm.Script(read('console/ext/resume-forge.js')); } catch (e) { p = false; console.log('   ' + e.message); } ok(p, 'the view script parses'); }

/* ---- matching: whole words, phrases, boilerplate ---- */
ok(!E.hasTerm('Seoul office', 'seo') && E.hasTerm('SEO manager', 'seo') && !E.hasTerm('more leads', 'ads') && !E.hasTerm('across teams', 'cro') && E.hasTerm('ran paid-social ads', 'paid social') && E.hasTerm('Local Services Ads (LSA)', 'Local Services Ads'), 'hasTerm matches whole words and phrases, not substrings');
ok(E.countTerm('SEO, seo and more SEO', 'seo') === 3 && E.countTerm('', 'seo') === 0, 'countTerm counts whole-word occurrences');
{
  const k = E.keywordsFrom('Hiring a Paid Social Manager with 5 years experience running Meta Ads and paid social campaigns; GA4 reporting; Local Services Ads a plus. Strong marketing skills.', 10);
  ok(k.includes('paid social') && k.includes('local services ads') && k.includes('meta ads') && k.includes('ga4') && !k.includes('experience') && !k.includes('marketing') && !k.includes('skills') && !k.includes('years'), 'keywordsFrom finds the lexicon phrases and drops posting boilerplate', k.join(','));
}
ok(E.jargon('Horus reads it Favored; the Hit Board; KJ6; a P2 absent move; Monsoon Landfall.').length >= 5 && E.jargon('Managed Google Ads for 24 law firms').length === 0, 'Leviathan’s own vocabulary is caught, plain résumé text is not');
const r1 = E.readability('Grew organic sessions 40% in nine months\nCut cost per lead by a third');
ok(r1 && r1.sentences === 2 && r1.words === 14, 'a line break ends a sentence, so bullets without periods are graded one by one', JSON.stringify(r1));
const r2 = E.readability('Responsible for helping the team. I was a results-driven team player.');
ok(r2.weak.length >= 3, 'weak phrases are flagged', r2.weak.length + ' tips');

/* ---- titles and levels ---- */
ok(E.levelFromYears('1 year') === 'junior' && E.levelFromYears('3 years') === 'mid' && E.levelFromYears('7 years') === 'senior' && E.levelFromYears('12 years') === 'manager' && E.levelFromYears('') === 'mid', 'the level is inferred from the years');
ok(E.titleFor('N2', 'senior') === 'Senior Paid Search Manager' && E.titleFor('N10', 'director') === 'Head of Local' && E.titleFor('marketing', 'mid') === 'Marketing Specialist', 'titleFor composes the posted title for a level');
ok(E.isAlias('Senior Paid Search Manager', 'N2') && E.isAlias('paid search manager', 'N2') && !E.isAlias('PPC wizard', 'N2'), 'isAlias recognizes the track’s titles');

/* ---- without findings: a general résumé still builds ---- */
{
  const c = E.blankCandidate(); const t = E.blankTailor();
  c.name = 'Pat Lee'; c.contact = 'Austin, TX · pat@example.com · (555) 010-0100 · linkedin.com/in/patlee'; c.years = '5 years'; t.industry = 'marketing';
  c.skills = 'SEO, content strategy, GA4'; c.exp = [{ title: 'SEO Manager', org: 'Co', dates: 'Jan 2022 – Present', bullets: 'Grew organic sessions 40% in 9 months' }]; c.education = 'B.A. 2016';
  const text = E.build(c, t, null);
  const L = text.split('\n');
  ok(L[0] === 'PAT LEE' && /^Senior Marketing Specialist \| SEO · content strategy · GA4$/.test(L[1]) && L[2] === c.contact, 'build: name, a headline with the title and top skills, then the contact line', L.slice(0, 3).join(' / '));
  ok(text.includes('\nSUMMARY\n') && text.includes('\nSKILLS\nSEO, content strategy, GA4\n') && text.includes('\nEXPERIENCE\nSEO Manager, Co (Jan 2022 – Present)\n- Grew organic sessions 40% in 9 months') && text.includes('\nEDUCATION & CERTIFICATIONS\n'), 'standard headers, ASCII separators, no hard wrapping');
  ok(text.indexOf('SUMMARY') < text.indexOf('SKILLS') && text.indexOf('SKILLS') < text.indexOf('EXPERIENCE') && text.indexOf('EXPERIENCE') < text.indexOf('EDUCATION'), 'section order is Summary, Skills, Experience, Education');
  ok(/Senior Marketing Specialist with 5 years/.test(text) && /SEO and content strategy/.test(text) && !/channel-agnostic/.test(text), 'the auto summary uses the title, years and top two skills', E.autoSummary(c, t, null));
  const md = E.markdown(c, t, null);
  ok(md.startsWith('# Pat Lee') && md.includes('**Senior Marketing Specialist |') && md.includes('## Summary') && md.includes('- Grew organic'), 'markdown export mirrors the text build');
  ok(E.html(c, t, null).includes('<h1>Pat Lee</h1>') && E.html(c, t, null).includes('<li>Grew organic sessions 40% in 9 months</li>'), 'the print HTML carries the same résumé with escaped text');
  ok(E.fileStem(c, t, null) === 'Pat-Lee-Senior-Marketing-Specialist', 'the file stem is First-Last-Title', E.fileStem(c, t, null));
  const lint = E.lint(text, c, t, {});
  ok(lint.ready && lint.checks.length === 8 && lint.checks.find(x => x.id === 'headers').ok && lint.checks.find(x => x.id === 'contact').ok && lint.checks.find(x => x.id === 'dates').ok && lint.checks.find(x => x.id === 'title').ok, 'the lint runs eight structural checks with no gate open', lint.score + ' ' + lint.checks.map(x => x.id + ':' + Math.round(x.v * 100)).join(' '));
  ok(!lint.checks.find(x => x.id === 'length').ok && lint.level === 'senior', 'a one-role draft is flagged short for its level', lint.words + ' words');
  ok(lint.claims.includes('content strategy') && lint.claims.includes('GA4') && !lint.claims.includes('SEO'), 'a skill with no evidence behind it is listed; one in a role title or bullet is not, and the summary does not count', lint.claims.join(','));
}

/* ---- with findings ---- */
if (!exists('console/Leviathan.html')) { console.log('console/Leviathan.html is not built; skipping the findings checks.'); if (fails) process.exit(1); process.exit(0); }
const F = extractFindings(read('console/Leviathan.html'), { built: '2026-01-01' });
E.load(F);
ok(E.agencies().length === F.n && E.agency('scorpion') && !E.agency('nobody') && E.byName('Tinuiti') && E.byName('Tinuiti').id === 'tinuiti', 'findings load; agencies resolve by id and by name');
ok(E.meta().n === F.n && E.meta().generated === F.generated, 'meta reports the compile');

/* On The Map Marketing: a say/do gap, absent moves, Exposed, Landfall, a Hit Board wave, verticals in three wings */
const otm = E.read(E.agency('on-the-map-marketing'));
const kinds = otm.items.map(it => it.kind);
ok(otm.items.length >= 8 && otm.items.every(it => it.finding && it.need && it.move && Array.isArray(it.tracks) && typeof it.sev === 'number' && typeof it.w === 'number' && ['gap', 'sell'].includes(it.group) && ['observed', 'inferred', 'computed'].includes(it.cls)), 'read: every item carries finding, need, move, tracks, severity, weight, group and evidence class', otm.items.length + ' items');
ok(otm.items[0].sev === 3 && kinds.includes('gap') && kinds.includes('hitboard') && kinds.includes('move') && kinds.includes('horus') && kinds.includes('monsoon') && kinds.includes('need') && kinds.includes('sells') && kinds.includes('vertical'), 'read: gaps and the Hit Board lead, then moves, Horus, Monsoon, the lines and the verticals', kinds.join(','));
const gap = otm.items.find(it => it.kind === 'gap' && it.code === 'search_no_ads');
ok(gap && gap.sev === 3 && gap.cls === 'observed' && gap.tracks[0] === 'N2' && gap.starter && gap.ask && gap.src === '#core.a.on-the-map-marketing', 'the paid search gap points at the paid search track with a starter, a question and the dossier route', gap && gap.tracks.join(','));
const p1 = otm.items.find(it => it.kind === 'move' && it.code === 'P1'), p3 = otm.items.find(it => it.kind === 'move' && it.code === 'P3'), p2 = otm.items.find(it => it.kind === 'move' && it.code === 'P2');
ok(p1 && p1.sev === 2 && p3 && p3.sev === 1 && p2 && p2.w < p1.w, 'an absent move is an exposure, a partial move a signal, and a move most of the field lacks weighs less', `P1 w${p1 && p1.w.toFixed(2)} P2 w${p2 && p2.w.toFixed(2)}`);
ok(!otm.items.some(it => it.kind === 'move' && ['na', 'unknown'].includes(E.agency('on-the-map-marketing').horus.moves[it.code])), 'moves marked not applicable or unknown produce no finding');
const hz = otm.items.find(it => it.kind === 'horus');
ok(hz && /Exposed/.test(hz.finding) && /KJ6 \(/.test(hz.finding) && /6th percentile/.test(hz.finding) && hz.tracks.includes('N13') && hz.cls === 'computed', 'the Horus exposure names the band, the ordinal percentile and the judgments', hz && hz.finding);
ok(otm.items.every(it => it.tracks.length === new Set(it.tracks).size), 'track codes on an item are unique');
ok(!otm.thin && otm.tracks.length === 17 && otm.tracks[0].score >= otm.tracks[1].score && ['N10', 'N2'].includes(otm.tracks[0].code) && otm.tracks[0].demand > 0 && otm.tracks[0].angle > 0 && otm.tracks[0].why.length, 'tracks rank with the local or paid search line first, scored on demand and angle', otm.tracks.slice(0, 3).map(t => t.code + ' d' + t.demand + ' a' + t.angle).join(' / '));
ok(otm.vocab.length >= 20 && otm.vocab.some(v => v.src === 'service') && otm.vocab.some(v => v.src === 'tool' && v.t === 'GA4') && otm.vocab.some(v => v.src === 'vertical') && otm.vocab.some(v => v.src === 'need') && otm.vocab.every(v => v.note), 'vocabulary mixes services, tools, verticals and needs, each with its origin', otm.vocab.slice(0, 6).map(v => v.t).join(' | '));
ok(new Set(otm.vocab.map(v => v.t.toLowerCase())).size === otm.vocab.length, 'vocabulary has no duplicates');
ok(E.mirrorTerms(otm.vocab).every(v => v.src !== 'tool' && v.src !== 'product') && E.mirrorTerms(otm.vocab).length < otm.vocab.length, 'tools seen on the site and products are not mirror terms');
ok(otm.verticals.length >= 5 && otm.verticals.some(v => v.key === 'dent' && v.mod === 'dental' && v.wing === 'health') && !otm.verticals.some(v => v.key === 'legal'), 'verticals map onto atlases and drop a wing-wide key when an atlas in that wing is listed', otm.verticals.map(v => v.key).join(','));
const st = E.starters(otm, 'N2');
ok(st.length >= 3 && st.some(s => s.from !== 'track') && st.every(s => /\[[^\]]+\]/.test(s.t)), 'starters mix the findings’ and the track’s templates, each with placeholders', st.length);
ok(otm.brief.bluf && otm.brief.openings && typeof otm.brief.horus === 'string', 'the brief carries the dossier narrative');

/* Scorpion: Favored, in-house claim, Hit Board wave 1 with themes, no observed client needs; the field-wide P2 trio does not lead */
const sc = E.read(E.agency('scorpion'));
ok(sc.items.some(it => it.kind === 'strength' && /Favored/.test(it.finding)) && sc.items.some(it => it.kind === 'hitboard' && it.tracks.includes('N13') && it.tracks.includes('N4') && /site ownership/.test(it.finding)), 'Scorpion: a Favored strength, and the site-ownership theme points at retention and web tracks', sc.items.filter(it => it.kind === 'hitboard').map(it => it.finding.slice(0, 120)).join(' '));
ok(sc.items.some(it => it.kind === 'monsoon' && /in-house/.test(it.finding)) && sc.items.some(it => it.kind === 'need' && it.code === 'inferred') && sc.items.some(it => it.kind === 'proof') && sc.items.some(it => it.kind === 'strength' && it.code === 'P3'), 'Scorpion: the in-house claim, the inferred need, the thin proof and a move it is making are read');
ok(!sc.items.some(it => /wedge|kill|FORGE|OmegaWeapon/i.test(it.finding)) && !JSON.stringify(E.agency('scorpion')).match(/"kill"|"wedge"/), 'no rival-voiced text reaches the findings or the file');
ok(['N10', 'N9', 'N1', 'N2'].includes(sc.tracks[0].code) && sc.tracks.slice(0, 3).every(t => !['N7', 'N6', 'N8'].includes(t.code)), 'Scorpion ranks on its local, search and AI lines, not on the field-wide absent moves', sc.tracks.slice(0, 3).map(t => t.code).join(','));

/* Promodo: five gaps; Ampush: no Horus read is a thin record; read(null) */
const pr = E.read(E.agency('promodo'));
ok(pr.items.filter(it => it.kind === 'gap').length === 5 && ['N1', 'N2'].includes(pr.tracks[0].code), 'Promodo: five say/do gaps, with its SEO or paid search line first', pr.tracks[0].code + ':' + pr.tracks[0].score);
const am = E.read(E.agency('ampush'));
ok(am.thin && /no Horus read/.test(am.thinWhy) && am.items.some(it => it.kind === 'status'), 'an agency without a Horus read is a thin record and its status is read', am.thinWhy);
const thinN = F.agencies.filter(a => E.read(a).thin).length;
ok(thinN > 10 && thinN < 80, 'the thin-record floor marks a minority of the field', thinN + ' of ' + F.n);
const tops = {}; F.agencies.forEach(a => { const t = E.read(a).tracks[0].code; tops[t] = (tops[t] || 0) + 1; });
ok(Object.keys(tops).length >= 8 && Math.max(...Object.values(tops)) < F.n * 0.4, 'the top track varies across the field instead of collapsing onto one trio', JSON.stringify(tops));
const none = E.read(null);
ok(none.items.length === 0 && none.tracks.length === 17 && none.vocab.length === 0 && none.thin, 'read(null) is empty, thin, and still lists the tracks');

/* ---- a full build against On The Map Marketing, then the readiness and the mirror ---- */
const a = E.agency('on-the-map-marketing');
const c = E.blankCandidate(), t = E.blankTailor();
c.name = 'Jordan Rivera'; c.contact = 'Miami, FL · jordan@example.com · (555) 555-5555 · linkedin.com/in/jordan'; c.years = '7 years'; c.verticals = ['pi', 'hvac', 'dent'];
t.track = 'N2';
t.terms = ['Law firm SEO', 'HVAC digital marketing', 'Local SEO', 'PPC', 'Local and lead generation'];
c.skills = 'Google Ads, Local Services Ads, call tracking (CallRail), GA4, Google Tag Manager, Multi-location SEO, Lead Generation, Microsoft Ads';
c.exp = [
  { title: 'Paid Search Manager', org: 'Acme Agency, Miami FL', dates: 'Jan 2021 – Present', bullets: 'Managed $180k a month across Google Ads and Microsoft Ads for 24 law firm accounts, cutting cost per signed case 31% while scaling volume 48%\nManaged Local Services Ads for 60 locations: disputed 22% of bad leads, won $41k in credits, booked 310 jobs a month\nInstrumented GA4 and Google Tag Manager with call tracking (CallRail) for 24 accounts, recovering 18% of conversions lost to consent limits\nTrained 4 juniors on AI-assisted ad copy with review standards, raising output 60% with 30% fewer revisions' },
  { title: 'PPC Specialist', org: 'Beta Co, Tampa FL', dates: 'Mar 2018 – Dec 2020', bullets: 'Lifted ROAS from 2.1 to 4.4 by restructuring campaigns and first-party audiences\nRan 36 A/B tests a year in VWO with a 28% win rate, lifting landing page conversion from 3.1% to 4.6%\nCut cost per lead from $92 to $57 across 11 HVAC digital marketing and plumbing markets with multi-location SEO and PPC' },
  { title: 'Marketing Coordinator', org: 'Gamma Dental Group, Orlando FL', dates: 'Jun 2016 – Feb 2018', bullets: 'Grew map-pack visibility with local SEO for 9 dental locations, lifting calls 44% and booked appointments 31%\nPublished 8 pieces a month on an editorial calendar and grew organic sessions 70% in 12 months\nBuilt law firm SEO and lead generation pages for 3 referral partners that produced 120 leads a quarter' },
];
c.results = 'Cost per signed case down 31% on $180k a month\n310 booked jobs a month from Local Services Ads';
c.education = 'B.A. Marketing, Florida State University, 2016 · Google Ads Search Certification · GA4 Certification';
const summary = E.autoSummary(c, t, otm);
ok(/Senior Paid Search Manager with 7 years/.test(summary) && /Ready to .* for an agency selling into personal injury, hvac, dental\./.test(summary) && !/Local & SMB/.test(summary), 'the auto summary carries the level title, the pitch and only the ticked verticals, the agency’s first', summary);
t.summary = summary;
const text = E.build(c, t, otm);
ok(text.split('\n')[1] === 'Senior Paid Search Manager | Law firm SEO · HVAC digital marketing · Local SEO | Personal injury, HVAC, Dental', 'the headline carries the title, the agency’s terms first and the ticked verticals', text.split('\n')[1]);
ok(/\nSKILLS\nLaw firm SEO, HVAC digital marketing, Local SEO, PPC, Local and lead generation, Google Ads,/.test(text), 'the agency’s terms lead the skills block, then the candidate’s own', text.split('\nSKILLS\n')[1].split('\n')[0]);
ok(text.includes('\nSELECTED RESULTS\n') && text.indexOf('EXPERIENCE') < text.indexOf('SELECTED RESULTS') && text.indexOf('SELECTED RESULTS') < text.indexOf('EDUCATION'), 'selected results sit between experience and education');
const L = E.lint(text, c, t, { read: otm });
ok(L.ready && L.score >= 90, 'a complete, honest résumé is ready and scores at least 90', L.score + ' ' + L.checks.map(x => x.id + ':' + Math.round(x.v * 100)).join(' '));
ok(L.checks.find(x => x.id === 'title').ok && L.checks.find(x => x.id === 'numbers').ok && L.checks.find(x => x.id === 'dates').ok && L.checks.find(x => x.id === 'verbs').ok && L.checks.find(x => x.id === 'length').ok, 'title, numbers, dates, verbs and length pass');
const M = E.mirror(text, c, E.mirrorTerms(otm.vocab).map(v => v.t), { source: 'agency', role: E.roleOf(c, t) });
ok(M.pts === M.cap && M.present.length >= 8 && M.present.some(p => p.pts === 2 && /Local Services Ads|HVAC digital marketing|law firm seo/i.test(p.t)) && M.overused.length === 0, 'the mirror counts distinct whole-word terms, doubles those inside quantified bullets, and caps the points', M.pts + '/' + M.cap + ' ' + M.present.slice(0, 5).map(p => p.t + ':' + p.pts).join(','));
{
  const stuffed = JSON.parse(JSON.stringify(c)); stuffed.skills = c.skills + ', ' + Array(8).fill('Local SEO').join(', ');
  const ts = JSON.parse(JSON.stringify(t)); const txt = E.build(stuffed, ts, otm);
  const Ms = E.mirror(txt + ' Local SEO Local SEO Local SEO', stuffed, E.mirrorTerms(otm.vocab).map(v => v.t), { role: E.roleOf(stuffed, ts) });
  ok(Ms.pts <= Ms.cap && Ms.overused.some(o => /^Local SEO/.test(o)) && !Ms.overused.some(o => /^SEO /.test(o)), 'a stuffed skills block cannot exceed the cap and is called out, while a word inside longer phrases is not', Ms.overused.join(','));
}
{
  const Mp = E.mirror(text, c, E.keywordsFrom('We need a Paid Search Manager for law firms: Google Ads, Local Services Ads, call tracking and GA4 reporting.', 24), { source: 'posting' });
  ok(Mp.source === 'posting' && Mp.present.some(p => p.t === 'local services ads') && Mp.present.some(p => p.t === 'google ads'), 'with a posting pasted the mirror reads the posting’s phrases', Mp.present.map(p => p.t).join(','));
}

/* the same draft made weak: placeholders, a reversed order, duties instead of results, a missing contact, Leviathan words */
{
  const bad = JSON.parse(JSON.stringify(c)); const tb = JSON.parse(JSON.stringify(t));
  bad.exp = [{ title: 'PPC Specialist', org: 'Beta Co', dates: 'Mar 2018 – Dec 2020', bullets: 'Responsible for campaigns\nWorked on reporting' }, { title: 'Paid Media Manager', org: 'Acme', dates: 'Jan 2021 – Present', bullets: 'Managed $[X] a month for [N] accounts' }, { title: 'Intern', org: 'Zed', dates: '', bullets: 'Helped with ads' }];
  bad.results = ''; bad.contact = 'Jordan'; tb.summary = 'A Horus Favored operator ready for the Hit Board.';
  const Lb = E.lint(E.build(bad, tb, otm), bad, tb, {});
  ok(!Lb.ready && Lb.score <= 40 && Lb.gates.map(g => g.id).sort().join() === 'jargon,placeholders,reach,undated', 'placeholders, no contact, an undated role and Leviathan words each open a hard gate and cap the score at 40', Lb.score + ' ' + Lb.gates.map(g => g.id).join(','));
  ok(!Lb.checks.find(x => x.id === 'dates').ok && !Lb.checks.find(x => x.id === 'numbers').ok && Lb.checks.find(x => x.id === 'verbs').v < 0.7, 'the order, the numbers and the filler phrases are marked down', Lb.checks.map(x => x.id + ':' + Math.round(x.v * 100)).join(' '));
  ok(Lb.checks.filter(x => !x.ok).every(x => x.tip && x.tip.length > 10) && Lb.gates.every(g => g.tip), 'every failed check and every gate carries a tip');
  const Lt = E.lint(E.build(Object.assign(JSON.parse(JSON.stringify(c)), {}), Object.assign(JSON.parse(JSON.stringify(t)), { role: 'Growth wizard' }), otm), c, Object.assign(JSON.parse(JSON.stringify(t)), { role: 'Growth wizard' }), {});
  ok(Lt.ready && !Lt.checks.find(x => x.id === 'title').ok && Lt.score < L.score, 'a title no agency posts loses the headline points', Lt.score);
}

/* ---- match a posting ---- */
const m = E.match('We are hiring a Paid Search Manager to run Google Ads and Local Services Ads for law firms and HVAC companies. GA4 and CallRail reporting. Local SEO a plus. Seoul office.', text, otm.vocab);
ok(m.have.includes('google ads') && m.have.includes('local services ads') && m.have.includes('ga4') && m.keywords.length >= 8 && m.read && m.agencyTermsInPosting.some(x => /Local SEO|Local Services Ads/.test(x)) && !m.keywords.includes('experience'), 'match finds the posting’s phrases in the résumé and the agency’s terms in the posting', m.have.join(','));

/* ---- the brief ---- */
const brief = E.brief(otm, c, t, { lint: L });
ok(brief.startsWith('# Interview brief: On The Map Marketing') && /## Gaps it shows/.test(brief) && /## What it sells/.test(brief) && /## Role tracks/.test(brief) && /## Questions to ask/.test(brief) && /## Things to verify/.test(brief) && /#core\.a\.on-the-map-marketing/.test(brief) && /Hit Board/.test(brief), 'the brief carries the read, the gaps, the lines, the tracks, questions, things to verify and the dossier route', brief.length + ' chars');
ok(!/strongest opening/i.test(brief) && !/\bkill\b/i.test(brief) && !/\bwedge\b/i.test(brief) && !/\bFORGE\b/.test(brief) && !/OmegaWeapon/.test(brief), 'the brief carries nothing a rival wrote');
ok(E.brief(E.read(E.agency('ampush')), c, t, {}).includes('Thin record') && E.brief(E.read(E.agency('ampush')), c, t, {}).includes('Status is acquired-rebranded'), 'a thin or merged record is said so in the brief');

/* ---- search ---- */
ok(E.search('scorp')[0].id === 'scorpion' && E.search('', { hb: true }).every(x => x.hb) && E.search('dental', { wing: 'health' }).length >= 3 && E.search('zzzz-nothing').length === 0, 'search ranks by name, filters by wing and Hit Board, and finds nothing for nonsense');

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
