/* FCOPY, the Site Forge copy writer: writes a practice area page, a county page and a Spanish landing page from data passed in, and
   every page's visible text passes LINT.screen with a filled firm, carries no hyphen or dash, and prints no number that is not in the
   data passed to the writer (the values V, the firm profile, the statute table FCOPY.LAW and the source lines FCOPY.SRC).
   Loads src/03_lint.js, src/04_forge_compile.js and src/06_forge_copy.js in a vm context with a stub FIRM; no DOM is needed. Each page is
   screened twice: the blueprint's visible fields (what the forge's ledger shows per field) and the compiled page as Publish screens it
   (title, meta and the HTML the compiler writes, with the form, the attorney cards, the court facts and the disclaimer). `node tests/run.mjs forge_copy` */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { assert, eq } from './lib/mock.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ---- a filled stub firm, the shape FIRM.get() returns ---- */
const firm = {
  name: 'Ramirez Family Law', legal_name: 'Ramirez Family Law, PLLC', url: 'https://www.ramirezfamilylaw.example', phone: '(972) 555 0142', intake_email: 'intake@ramirezfamilylaw.example', founded: '2011',
  attorneys: [{ name: 'Elena Ramirez', bar_no: '24051234', tbls: 'Family Law', since: '2006', bio: '' }, { name: 'Marcus Lee', bar_no: '24098765', tbls: '', since: '2015', bio: '' }], responsible: 0,
  offices: [{ label: 'Main office', street: '5800 Granite Pkwy, Suite 600', city: 'Plano', zip: '75024', county: '48085', phone: '', hours: 'Monday to Friday, 8 am to 6 pm', primary: true }],
  counties: ['48085', '48113'], lines: ['div_k', 'div_nk', 'sapcr', 'mod', 'enf', 'po', 'ivd'], languages: ['en', 'es'], consult: { free: false, fee: 150, virtual: true }, fees: {}, payment: 'Credit cards and payment plans',
  colors: { primary: '#1b4332', accent: '#307a4f', dark: '#0a291a' }, social: {}, reviews: {}, arc: { filed: false, note: '' }
};
const FIRM = { get: () => firm, responsible: () => firm.attorneys[firm.responsible], primary: () => firm.offices[0], counties: () => firm.counties, lines: () => firm.lines, phone: () => firm.phone, certs: () => firm.attorneys.filter(a => a.tbls).map(a => `${a.name}, Board Certified, ${a.tbls}, Texas Board of Legal Specialization`), ready: () => true, missing: () => [], adFooter: () => 'Responsible attorney: Elena Ramirez. Primary office: Plano, Texas.' };

/* ---- the vm context: what 03_lint.js and 06_forge_copy.js may touch ---- */
const store = { get: (k, d) => d, set() { } };
const ctx = vm.createContext({ console, FIRM, store, URL, BUS: { on() { }, emit() { } }, Intl, Math, JSON, Date, RegExp, Object, Array, String, Number, Set, Map, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent });
for (const f of ['src/03_lint.js', 'src/04_forge_compile.js', 'src/06_forge_copy.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const LINT = vm.runInContext('LINT', ctx), FCOPY = vm.runInContext('FCOPY', ctx), FC = vm.runInContext('FORGE_COMPILE', ctx);
assert(LINT && typeof LINT.screen === 'function', 'LINT loaded'); assert(FCOPY && typeof FCOPY.blueprint === 'function', 'FCOPY loaded'); assert(FC && typeof FC.compile === 'function', 'FORGE_COMPILE loaded');

/* ---- the values a page is written from (module 21 computes them from FIRM and the data; here they are the data passed in) ---- */
const base = {
  state: 'Texas', brand: firm.name, atty: 'Elena Ramirez', officeCity: 'Plano', phone: firm.phone, founded: '2011', attyBarClause: ', State Bar of Texas No. 24051234', attyCred: 'Attorney, State Bar of Texas No. 24051234', attyBio: '',
  officeAddr: '5800 Granite Pkwy, Suite 600, Plano, Texas 75024', officeLoc: '5800 Granite Pkwy, Suite 600, Plano, Texas', officeLine: 'Our primary office is at 5800 Granite Pkwy, Suite 600, Plano, Texas 75024.', officeLineEs: 'Nuestra oficina principal está en 5800 Granite Pkwy, Suite 600, Plano, Texas 75024.', hours: 'Monday to Friday, 8 am to 6 pm',
  consultShort: 'Consultation $150', consultLine: 'The consultation fee is $150.', consultShortEs: 'Consulta $150', consultLineEs: 'La consulta cuesta $150.', virtualLine: 'Consultations are available by video or in person.', paymentLine: 'Payment options: Credit cards and payment plans.',
  lineList: 'divorce with and without children, child custody and paternity, order modifications, order enforcement, protective orders and child support', lineListCap: 'Divorce with and without children, child custody and paternity, order modifications, order enforcement, protective orders and child support',
  areaCounties: 'Collin and Dallas counties', areaLine: 'Clients across Collin and Dallas counties, including Plano, Dallas and Frisco, from our office in Plano.', through: 'August 2026', throughEs: 'agosto de 2026', period: 'the 12 months through August 2026', s_div: '76,904',
  a_div: '11,712', a_divk: '4,488', a_divnk: '7,224', a_sapcr: '2,066', a_mod: '2,312', a_enf: '640', a_po: '1,724', a_ivd: '10,350', a_adopt: '1,005', a_cps: '688',
  certs: 'Elena Ramirez, Board Certified, Family Law, Texas Board of Legal Specialization.'
};
const county = {
  county: 'Dallas', k_div: '8,489', k_divk: '3,142', k_divnk: '5,347', k_sapcr: '1,579', k_po: '1,378', k_mod: '1,652', k_enf: '451', k_modenf: '2,103', k_ivd: '8,015', k_cps: '592', k_adopt: '753', k_priv: '15,664',
  k_div_prev: '8,662', k_sapcr_prev: '1,843', k_mod_prev: '1,782', k_enf_prev: '410', k_po_prev: '1,367', k_change: 'down 2%', k_when: 'in the 12 months through August 2026', k_whenEs: 'los 12 meses hasta agosto de 2026', k_whenShort: '12 months to Aug 2026',
  k_pending: '7,522', k_disposed: '8,251', k_pendingLine: 'At the end of August 2026, 7,522 divorce cases were pending in Dallas County, and the courts disposed of 8,251 in the 12 months through August 2026.',
  k_married: '855,751', k_offices: '2,200', k_court: 'George L. Allen Sr. Courts Building', k_courtAddr: '600 Commerce St, Dallas', k_courtLine: 'In Dallas County, family cases are heard at the George L. Allen Sr. Courts Building, 600 Commerce St, Dallas.',
  k_hist: [['2019', '11,152', '4,194'], ['2020', '10,075', '3,826'], ['2021', '10,252', '3,825'], ['2022', '8,817', '3,332'], ['2023', '8,865', '3,306'], ['2024', '8,839', '3,286'], ['2025', '8,700', '3,258']],
  countyCities: 'Dallas, Garland and Irving', k_cities: [['Dallas', '3,867', '432,393', '42']]
};
const city = { city: 'Dallas', cityFull: 'Dallas, TX', c_div: '3,867', c_married: '432,393', c_sapcr: '867', c_po: '611', c_pop: '1,339,268', c_zips: '75201, 75202, 75203, 75204, 75205, 75206, 75207 and 35 others', c_zipCount: '42', nearby: 'Garland, Irving and Mesquite', officeWhere: 'our office in Plano' };
const V = page => Object.assign({}, base, page === 'county' || page === 'city' || page === 'landing' ? county : {}, page === 'city' || page === 'landing' ? city : {});
const ctxFor = (Vx, extra) => Object.assign({ V: Vx, site: { url: firm.url, trust: 'Responsible attorney {atty} | Office in {officeCity}, Texas | {consultShort}' }, firm, lines: firm.lines, internal: [], crumbs: false, media: {}, today: '2026-10-01',
  attorneys: firm.attorneys.map(a => ({ name: a.name })), counties: ['Collin', 'Dallas'], entity: { '@type': 'LegalService', name: firm.name } }, extra || {});

/* ---- checks shared by every page ---- */
const DASH = /[‐-―−]|(?<=\w)-(?=\w)|\s-\s/;
const numsIn = s => (String(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).map(x => x.replace(/,/g, '').replace(/\.0+$/, '')).filter(x => x !== '');
function allowedNumbers(Vx) { const set = new Set(); [JSON.stringify(Vx), JSON.stringify(firm), JSON.stringify(FCOPY.LAW), JSON.stringify(FCOPY.SRC(Vx))].forEach(s => numsIn(s).forEach(n => set.add(n))); return set; }
function check(label, p, Vx, opts) {
  opts = opts || {}; const meta = FCOPY.describe(p, Vx); const pg = Object.assign({}, p, meta, { id: p.kind });
  const bp = FCOPY.blueprint(pg, ctxFor(Vx, opts.ctx));
  assert(bp && bp.page && Array.isArray(bp.sections) && bp.sections.length >= 5, `${label}: a blueprint with sections`);
  assert(bp.sections.filter(s => s.type === 'hero').length === 1, `${label}: exactly one hero`);
  assert(bp.sections.some(s => s.type === 'answer') && bp.sections.some(s => s.type === 'faq'), `${label}: answer capsule and FAQ`);
  const vis = FCOPY.visibleText(bp); const text = vis.map(x => x[1]).join('\n');
  eq(bp._missing, [], `${label}: no template value was missing`);
  const lang = p.lang === 'es' ? 'es' : 'en';
  const res = LINT.screen(text, { kind: 'page', lang });
  const blocks = res.findings.filter(f => f.sev === 'block');
  assert(res.pass, `${label}: LINT.screen passes, block findings: ${JSON.stringify(blocks.map(f => [f.id, f.title, f.hit]))}`);
  const fixes = res.findings.filter(f => f.sev === 'fix'); assert(!fixes.length, `${label}: no house style fixes needed: ${JSON.stringify(fixes.map(f => f.hit))}`);
  const warns = res.findings.filter(f => f.sev === 'warn'); assert(!warns.length, `${label}: no review findings: ${JSON.stringify(warns.map(f => [f.id, f.title, f.hit]))}`);
  vis.forEach(([w, t]) => { const m = String(t).match(DASH); assert(!m, `${label}: hyphen or dash in ${w}: …${String(t).slice(Math.max(0, (m || {}).index - 30), ((m || {}).index || 0) + 30)}…`); });
  const ok = allowedNumbers(Vx); const bad = []; vis.forEach(([w, t]) => numsIn(t).forEach(n => { if (!ok.has(n)) bad.push(`${n} in ${w}`); }));
  assert(!bad.length, `${label}: numbers not in the data passed in: ${bad.slice(0, 8).join('; ')}`);
  assert(text.includes('Elena Ramirez') && text.includes('Plano'), `${label}: responsible lawyer and primary office on the page (Rule 7.02(a))`);
  (bp._facts || []).forEach(f => assert(f.source && f.value, `${label}: fact ${f.key} has a value and a source`));
  /* the compiled page, screened the way Publish screens it */
  const r = FC.compile(JSON.parse(JSON.stringify(Object.assign({}, bp, { _facts: undefined, _missing: undefined }))), {});
  const blk = r.lint.filter(l => /^BLOCK/.test(l)); assert(!blk.length, `${label}: compiler blocks: ${blk.join(' | ')}`);
  const cres = LINT.screen(bp.page.title + '\n' + bp.page.meta_description + '\n' + r.html, { kind: 'page', html: true, lang });
  assert(cres.pass, `${label}: the compiled page passes LINT.screen, blocks: ${JSON.stringify(cres.findings.filter(f => f.sev === 'block').map(f => [f.id, f.hit]))}`);
  const cw = cres.findings.filter(f => f.sev === 'warn' || f.sev === 'fix'); assert(!cw.length, `${label}: compiled page review findings: ${JSON.stringify(cw.map(f => [f.id, f.hit]))}`);
  const ctext = FC.visibleText(r.html); const cm = ctext.match(DASH); assert(!cm, `${label}: hyphen or dash in the compiled page: …${ctext.slice(Math.max(0, (cm || {}).index - 40), ((cm || {}).index || 0) + 40)}…`);
  const cbad = numsIn(ctext).filter(n => !ok.has(n)); assert(!cbad.length, `${label}: numbers in the compiled page not in the data passed in: ${[...new Set(cbad)].slice(0, 8).join(', ')}`);
  assert(ctext.includes('Elena Ramirez') && ctext.includes('Plano'), `${label}: the compiled page names the responsible lawyer and the primary office`);
  return { bp, text, res, r, ctext };
}

/* 1. a practice area page (divorce with children) */
const pr = check('practice div_k', { kind: 'practice', line: 'div_k' }, V('practice'));
assert(pr.text.includes('$11,700') && pr.text.includes('60 days'), 'practice page states the support cap and the waiting period from the statute table');
assert(pr.text.includes('4,488'), 'practice page prints the area filings figure from the data');
assert(pr.bp._facts.some(f => /Office of Court Administration/.test(f.source)) && pr.bp._facts.some(f => /Texas Family Code § 154\.125/.test(f.source)), 'figures carry their public sources');
assert(pr.bp.page.archetype === 'practice' && pr.bp.page.service && pr.bp.page.author && pr.bp.page.author.name === 'Elena Ramirez', 'practice blueprint: archetype, service and responsible author');
assert(!/50\s*\/\s*50|legal(ly)? separat|equal time|guarantee|specialist|expert/i.test(pr.text), 'practice page avoids the myths and the special competence words');

/* 2. a county page (Dallas County) */
const co = check('county Dallas', { kind: 'county', fips: '48113' }, V('county'));
assert(co.text.includes('8,489') && co.text.includes('George L. Allen Sr. Courts Building') && co.text.includes('7,522'), 'county page prints filings, the courthouse and the pending docket from the data');
const cf = co.bp.sections.find(s => s.type === 'court_facts'); assert(cf && cf.items.length >= 8 && cf.items[0].value === '8,489 (8,662 the year before)' && cf.courts[0].name === 'George L. Allen Sr. Courts Building' && cf.courts[0].address === '600 Commerce St, Dallas', 'county court facts from the data');
assert(co.ctext.includes('600 Commerce St') && /attorney advertising/i.test(co.ctext), 'the compiled county page shows the courthouse address and the disclaimer');
assert(co.bp.page.archetype === 'location' && /Dallas County/.test(JSON.stringify(co.bp.page.service)), 'county blueprint is a location page serving the county');

/* 3. a Spanish landing page (protective orders, Dallas) */
const es = check('landing es po', { kind: 'landing', line: 'po', city: '19100|Dallas', fips: '48113', lang: 'es' }, V('landing'));
assert(es.bp.page.language === 'es-US' && es.bp.page.noindex === true, 'Spanish landing: es-US and noindex by default');
assert(/orden de protección/i.test(es.text) && es.text.includes('1,378'), 'Spanish landing uses the TexasLawHelp term and the county figure');
for (const term of ['divorcio', 'custodia', 'manutención de menores', 'orden de protección', 'posesión y acceso']) assert(JSON.stringify(FCOPY.LINES).includes(term) || JSON.stringify(FCOPY.ES).includes(term), 'Spanish term present in the library: ' + term);
const es2 = check('landing es div_k', { kind: 'landing', line: 'div_k', city: '19100|Dallas', fips: '48113', lang: 'es' }, V('landing'));
assert(/manutención de menores/.test(es2.text) && /posesión y acceso/.test(es2.text) && /divorcio/.test(es2.text), 'Spanish divorce landing uses divorcio, manutención de menores and posesión y acceso');

/* 4. the rest of the library writes clean pages too: every line, every page kind, every guide */
for (const k of FCOPY.LINE_KEYS) { check('practice ' + k, { kind: 'practice', line: k }, V('practice')); check('landing en ' + k, { kind: 'landing', line: k, city: '19100|Dallas', fips: '48113' }, V('landing')); check('landing es ' + k, { kind: 'landing', line: k, city: '19100|Dallas', fips: '48113', lang: 'es' }, V('landing')); }
check('home', { kind: 'home' }, V('home')); check('about', { kind: 'about' }, V('about')); check('faq hub', { kind: 'faq' }, V('faq')); check('city Dallas', { kind: 'city', city: '19100|Dallas', fips: '48113' }, V('city'));
check('attorney', { kind: 'attorney', atty: 0 }, Object.assign(V('attorney'), { at_name: 'Elena Ramirez', at_bar: '24051234', at_since: '2006', at_bio: '', at_cert: 'Elena Ramirez, Board Certified, Family Law, Texas Board of Legal Specialization', at_barClause: ', bar number 24051234', at_sinceClause: ', licensed since 2006', at_sinceSentence: ' Licensed in Texas since 2006.' }));
for (const g of FCOPY.GUIDES) { const Vx = V(g.scope === 'county' ? 'county' : 'guide'); if (g.need) assert(g.need(Vx), 'guide data present: ' + g.id); check('guide ' + g.id, { kind: 'guide', topic: g.id, fips: g.scope === 'county' ? '48113' : undefined }, Vx); }

/* 5. the templates hold no figures of their own: every digit comes through a {placeholder} */
const strings = []; const walk = (x, where) => { if (typeof x === 'string') strings.push([where, x]); else if (Array.isArray(x)) x.forEach((y, i) => walk(y, where + '.' + i)); else if (x && typeof x === 'object') Object.keys(x).forEach(k => { if (!['tok', 'slug', 'lp', 'need', 'facts', 'fact', 'related', 'steps', 'table', 'scope', 'id'].includes(k)) walk(x[k], where + '.' + k); }); };
walk({ LINES: FCOPY.LINES, GUIDES: FCOPY.GUIDES, STEPS: FCOPY.STEPS, ES: FCOPY.ES, HOME_FAQ: FCOPY.HOME_FAQ, CITY_FAQ: FCOPY.CITY_FAQ, COUNTY_FAQ: FCOPY.COUNTY_FAQ, ATTY_FAQ: FCOPY.ATTY_FAQ, NOTICE: FCOPY.NOTICE, CONSENT: FCOPY.CONSENT }, 'FCOPY');
const lit = strings.filter(([, s]) => /\d/.test(s.replace(/\{[^}]*\}/g, '')));
assert(!lit.length, 'templates with a typed number: ' + lit.slice(0, 5).map(([w, s]) => w + ': ' + s.slice(0, 80)).join(' | '));
const tdash = strings.filter(([w, s]) => DASH.test(s.replace(/\{[^}]*\}/g, '').replace(/<[^>]+>/g, ' ')));
assert(!tdash.length, 'templates with a hyphen or dash: ' + tdash.slice(0, 5).map(([w, s]) => w + ': ' + s.slice(0, 80)).join(' | '));

/* 6. an empty firm leaves bracketed placeholders, and LINT blocks the page */
const emptyV = Object.assign({}, V('practice'), { brand: '[Firm name]', atty: '[Responsible attorney]', officeCity: '[Office city]', phone: '[Phone]' });
const ebp = FCOPY.blueprint(Object.assign({ kind: 'practice', line: 'div_nk', id: 'x' }, FCOPY.describe({ kind: 'practice', line: 'div_nk' }, emptyV)), ctxFor(emptyV));
const eres = LINT.screen(FCOPY.visibleText(ebp).map(x => x[1]).join('\n'), { kind: 'page' });
assert(!eres.pass && eres.findings.some(f => f.id === 'ph'), 'an unfilled firm blocks the page through the placeholder rule');

/* 7. a missing data value is reported, not printed */
const gap = Object.assign({}, V('county')); delete gap.k_sapcr;
const gbp = FCOPY.blueprint(Object.assign({ kind: 'county', fips: '48113', id: 'g' }, FCOPY.describe({ kind: 'county', fips: '48113' }, gap)), ctxFor(gap));
assert(gbp._missing.includes('k_sapcr') && !/undefined|null|NaN/.test(FCOPY.visibleText(gbp).map(x => x[1]).join(' ')), 'missing values are listed in _missing and never printed as undefined');

/* 8. Safety mode (on unless the forge passes safety false): protective order, family violence and CPS pages */
{
  const po = check('practice po (safety)', { kind: 'practice', line: 'po' }, V('practice'));
  eq(po.bp.page.safety && po.bp.page.safety.sensitive, 'po', 'a protective order page is in Safety mode by default');
  eq(po.bp.sections[0].type, 'quick_exit', 'the quick exit comes first'); eq(po.bp.sections[0].label, 'Leave this site', 'labelled Leave this site');
  const hi = po.bp.sections.findIndex(x => x.type === 'hotline'); eq(po.bp.sections[hi - 1].type, 'hero', 'the hotline box sits right after the hero');
  const hot = po.bp.sections[hi]; assert(hot.text.includes('1 800 799 7233') && hot.text.includes('START to 88788') && hot.text.includes('911') && /National Domestic Violence Hotline/.test(hot.text), 'the hotline in house style, numbers from FCOPY.LAW: ' + hot.text);
  assert(FCOPY.LAW.ndvh && FCOPY.LAW.ndvh.v === '1 800 799 7233' && FCOPY.LAW.ndvh.sms === 'START to 88788', 'the hotline numbers live in the statute and source table');
  assert(!/24\/7|loveisrespect|22522/i.test(JSON.stringify(po.bp)), 'no other hotline');
  assert(po.r.html.includes('data-forge-exit') && !/dataLayer/.test(po.r.html) && po.r.html.includes('name="safe_contact"') && !/<iframe/i.test(po.r.html), 'compiled: the exit, the safe contact question, no dataLayer push, no frame');
  const lpo = LINT.screen(po.bp.page.title + '\n' + po.bp.page.meta_description + '\n' + po.r.html, { kind: 'page', html: true, sensitive: 'po' }); ['WEB1', 'WEB5', 'WEB6', 'WEBRESP'].forEach(id => assert(!lpo.findings.some(f => f.id === id), 'the protective order page passes ' + id));
  const cps = check('practice cps (safety)', { kind: 'practice', line: 'cps' }, V('practice'));
  eq(cps.bp.page.safety.sensitive, 'cps', 'a CPS page is in Safety mode'); assert(cps.bp.sections.find(x => x.type === 'hotline').heading === 'If you or your children are not safe', 'the CPS hotline heading');
  const g = check('guide po (safety)', { kind: 'guide', topic: 'po', fips: '48113' }, V('county')); eq(g.bp.page.safety.sensitive, 'po', 'the protective order guide is in Safety mode');
  const esl = check('landing es po (safety)', { kind: 'landing', line: 'po', city: '19100|Dallas', fips: '48113', lang: 'es' }, V('landing'));
  assert(esl.bp.sections[0].label === 'Salir de este sitio' && /Línea Nacional contra la Violencia Doméstica/.test(esl.bp.sections.find(x => x.type === 'hotline').text) && esl.r.html.includes('¿Es seguro llamarle'), 'the Spanish page: exit, hotline and question in Spanish');
  const plain = check('practice div_k (no safety)', { kind: 'practice', line: 'div_k' }, V('practice')); assert(!plain.bp.page.safety && !plain.bp.sections.some(x => x.type === 'quick_exit' || x.type === 'hotline'), 'other pages are not in Safety mode');
  eq(FCOPY.sensitiveOf({ kind: 'county', fips: '48113' }), '', 'a county page is not sensitive'); eq(FCOPY.sensitiveOf({ kind: 'landing', line: 'po' }), 'po', 'a protective order landing page is');
  /* Safety mode off in the forge settings: the page is ordinary and the web tests say so */
  const pg = Object.assign({ kind: 'practice', line: 'po', id: 'po' }, FCOPY.describe({ kind: 'practice', line: 'po' }, V('practice')));
  const offBp = FCOPY.blueprint(pg, ctxFor(V('practice'), { safety: false }));
  assert(!offBp.page.safety && !offBp.sections.some(x => x.type === 'quick_exit' || x.type === 'hotline'), 'safety false: no exit and no hotline');
  const offR = FC.compile(JSON.parse(JSON.stringify(Object.assign({}, offBp, { _facts: undefined, _missing: undefined }))), {});
  const offL = LINT.screen(offBp.page.title + '\n' + offBp.page.meta_description + '\n' + offR.html, { kind: 'page', html: true });
  assert(offL.findings.some(f => f.id === 'WEB6') && offL.findings.some(f => f.id === 'WEB1'), 'Safety mode off: WEB6 (no quick exit) and WEB1 (the dataLayer push) warn');
  const exitTo = FCOPY.blueprint(pg, ctxFor(V('practice'), { safety: { on: true, exit_url: 'https://www.weather.gov/' } })); eq(exitTo.sections[0].url, 'https://www.weather.gov/', 'the exit goes where the forge settings say');
}

/* 9. module 21's engine (SFORGE) on the real data: rank keys, distances from the primary office, the legal review gate, FILE1, Safety mode
   in the forge settings and the specialization exclusion. Runs the data and the scripts in a vm context with a stubbed DOM. */
{
  const node = () => ({ style: { setProperty() { } }, dataset: {}, classList: { add() { }, remove() { }, toggle() { }, contains: () => false }, setAttribute() { }, removeAttribute() { }, appendChild() { }, addEventListener() { }, querySelector: () => null, querySelectorAll: () => [] });
  const ls = new Map();
  const c2 = { console, URL, URLSearchParams, TextEncoder, TextDecoder, setTimeout, clearTimeout, Intl, Blob,
    document: { createElement: node, body: node(), documentElement: node(), head: node(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() { }, removeEventListener() { }, activeElement: null },
    addEventListener() { }, removeEventListener() { }, matchMedia: () => ({ matches: false, addEventListener() { } }), performance: globalThis.performance, ResizeObserver: class { observe() { } unobserve() { } disconnect() { } }, requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame: clearTimeout,
    localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) }, navigator: { userAgent: 'node' }, location: { hash: '', protocol: 'file:' }, history: { replaceState() { } } };
  c2.window = c2; vm.createContext(c2);
  for (const f of ['data/suite.js', 'src/00_core.js', 'src/01_kit.js', 'src/02_firm.js', 'src/03_lint.js', 'src/04_forge_compile.js', 'src/06_forge_copy.js', 'src/25_m06_lines.js', 'src/40_m21_forge.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c2, { filename: f });
  const run = code => vm.runInContext(code, c2);
  run(`FIRM.set(${JSON.stringify(Object.assign({}, firm, { lines: ['div_k', 'po', 'cps'] }))})`);
  const off = run('SFORGE.office()'); eq(off.how, 'the center of ZIP 75024', 'the office is placed by its ZIP'); assert(Math.abs(off.ll[0] + 96.79) < 0.05 && Math.abs(off.ll[1] - 33.08) < 0.05, 'ZIP 75024 back to longitude and latitude: ' + off.ll);
  const dfw = run(`(() => { const z = k => ZI[k]; return SFORGE.hav(SFORGE.zipLL(z('75201').cent, '19100'), SFORGE.zipLL(z('76102').cent, '19100')); })()`); assert(dfw > 29 && dfw < 32, 'downtown Dallas to downtown Fort Worth is about 30 miles: ' + dfw);
  const hou = run(`SFORGE.hav(SFORGE.zipLL(ZI['77002'].cent, '26420'), SFORGE.zipLL(ZI['77479'].cent, '26420'))`); assert(hou > 18 && hou < 23, 'downtown Houston to Sugar Land, about 20 miles: ' + hou);
  const cfgR = run(`(() => { const c = SFORGE.defaultCfg(); c.focus.scope = 'radius'; c.focus.miles = 25; c.focus.cscope = 'radius'; c.focus.n = 50; c.focus.minPop = 0; return c; })()`);
  const msR = run(`(() => { const c = ${JSON.stringify(cfgR)}; const m = SFORGE.markets(c); return { counties: m.counties.map(x => x.fips), cmi: m.counties.map(x => SFORGE.milesCounty(x)), cities: m.cities.map(x => x.name), zmi: m.cities.map(x => SFORGE.milesCity(x)) }; })()`);
  assert(msR.counties.includes('48085') && msR.cmi.every(d => d <= 25), 'counties within 25 miles of the office: ' + msR.counties.join(' '));
  assert(msR.cities.includes('Plano') && msR.zmi.every(d => d <= 25) && msR.cities.length >= 5, 'cities within 25 miles, any county: ' + msR.cities.slice(0, 8).join(', '));
  for (const k of ['xdiv', 'xdivk', 'married', 'kids', 'di', 'opp', 'gap', 'esi']) { assert(run(`!!SFORGE.CMET.${k} && !!SFORGE.ZMET.${k}`), 'rank key ' + k);
    const v = run(`(() => { const c = SFORGE.defaultCfg(); c.focus.scope = 'metro'; c.focus.metro = '19100'; c.focus.nc = 11; c.focus.cmetric = '${k}'; c.focus.zmetric = '${k}'; c.focus.n = 12; const m = SFORGE.markets(c); const f = SFORGE.cmet('${k}')[1], g = SFORGE.zmet('${k}')[1]; return [m.counties.map(f), m.cities.slice(0, 12).map(g)]; })()`);
    assert(v[0].every((x, i) => i === 0 || (x || 0) <= (v[0][i - 1] || 0)) && v[0].some(x => x > 0), 'counties ranked by ' + k); assert(v[1].every((x, i) => i === 0 || (x || 0) <= (v[1][i - 1] || 0)), 'cities ranked by ' + k); }
  eq(run(`SFORGE.cmet('div')[0]`), run(`SFORGE.CMET.xdiv[0]`), 'a saved build 2 rank key (div) reads as xdiv'); eq(run(`SFORGE.zmet('per_office')[0]`), run(`SFORGE.ZMET.gap[0]`), 'per_office reads as gap');
  /* the plan with Safety mode (the default) and the review gate */
  const built = run(`(() => { const c = SFORGE.defaultCfg(); c.focus.n = 2; const P = SFORGE.plan(c); const live = SFORGE.parseLive('', ''); const out = {};
    for (const want of [['practice', 'po'], ['practice', 'div_k'], ['landing', 'po'], ['home', '']]) { const p = P.pages.find(x => x.kind === want[0] && (!want[1] || x.line === want[1]) && x.lang === 'en'); const bp = SFORGE.blueprint(p, c, P.pages, live, P.markets, []);
      const stripped = JSON.parse(JSON.stringify(Object.assign({}, bp, { _facts: undefined, _missing: undefined, _v: undefined }))); const r = FORGE_COMPILE.compile(stripped, {}); const hash = SFORGE.pageHash(bp);
      const ck = o => SFORGE.checks(bp, r, Object.assign({ kind: p.kind, hash, sensitive: FCOPY.sensitiveOf(p) || false }, o)).issues.map(i => i.id + ':' + i.sev + ':' + i.where);
      out[want.filter(Boolean).join(' ')] = { safety: bp.page.safety || null, none: ck({}), ok: ck({ review: { by: 'Elena Ramirez', date: todayISO(), hash } }), changed: ck({ review: { by: 'Elena Ramirez', date: todayISO(), hash: 'x' + hash } }), future: ck({ review: { by: 'Elena Ramirez', date: '2099-01-01', hash } }), exit: /data-forge-exit/.test(r.html), dl: /dataLayer/.test(r.html) }; }
    const c3 = SFORGE.defaultCfg(); c3.site.safety = false; const P3 = SFORGE.plan(c3); const p3 = P3.pages.find(x => x.kind === 'practice' && x.line === 'po'); out.off = !!SFORGE.blueprint(p3, c3, P3.pages, live, P3.markets, []).page.safety; return out; })()`);
  const poP = built['practice po'];
  eq(poP.safety && poP.safety.sensitive, 'po', 'the forge plans the protective order page in Safety mode by default'); assert(poP.exit && !poP.dl, 'the compiled forge page has the exit and no dataLayer push');
  assert(poP.none.includes('REVIEW1:block:legal review'), 'REVIEW1 blocks a practice page with no review'); assert(!poP.ok.some(x => /^REVIEW1/.test(x)), 'a recorded review of this text clears REVIEW1');
  assert(poP.changed.includes('REVIEW1:block:legal review') && poP.future.includes('REVIEW1:block:legal review'), 'a review of other text or a future date does not count');
  assert(!poP.ok.some(x => /:block:/.test(x)), 'the reviewed protective order page has no block: ' + JSON.stringify(poP.ok.filter(x => /:block:/.test(x))));
  assert(!poP.ok.some(x => /^(?:WEB1|WEB5|WEB6|WEBRESP):/.test(x)), 'the forge protective order page passes the web tests');
  assert(!poP.ok.some(x => /^(?:competence|certified):.*:(?:disclaimer|attorneys\.card)/.test(x)), 'the exact TBLS wording in the disclaimer and the attorney cards is not read as a specialization claim');
  assert(built['landing po'].none.includes('REVIEW1:block:legal review') && built['landing po'].none.some(x => x === 'FILE1:note:filing'), 'landing pages: REVIEW1 and the FILE1 note');
  assert(built['home'].none.some(x => x === 'FILE1:note:filing') && !built['home'].none.some(x => /^REVIEW1/.test(x)) && !built['home'].none.some(x => /^arc_filing/.test(x)), 'the home page: FILE1 replaces the general filing note, no review gate');
  assert(!built['practice div_k'].safety && !built['practice div_k'].none.some(x => /^FILE1/.test(x)), 'other practice pages: no Safety mode, no FILE1');
  eq(built.off, false, 'Safety mode off in the forge settings');
}

console.log(`forge_copy ok: ${FCOPY.LINE_KEYS.length} lines, ${FCOPY.GUIDES.length} guides, practice ${pr.text.length} chars, county ${co.text.length} chars, Spanish landing ${es.text.length} chars`);
