/* LINT, the compliance engine (src/03_lint.js): rule ids on the sample ad, a clean ad with a filled firm, safe fixes, HTML input,
   Spanish, platform limits and the context rules that must not fire ("best interest of the child", a TBLS claim the firm holds).
   The engine is loaded alone in a vm context with a stub FIRM, the way the Campaign Desk and the Site Forge call it. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { assert, eq } from './lib/mock.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = fs.readFileSync(path.join(ROOT, 'src/03_lint.js'), 'utf8');

/* a filled firm: one lawyer, board certified in family law, Plano primary office, a $4,500 flat fee, $150 consultations */
const profile = { name: 'Doe Family Law', legal_name: 'Doe Family Law, PLLC', tagline: 'Clear answers for Texas families', attorneys: [{ name: 'Jane Doe', bar_no: '24000000', tbls: 'Family Law', since: '2005', bio: 'Jane Doe is Board Certified, Family Law, Texas Board of Legal Specialization.' }], responsible: 0, offices: [{ label: 'Main office', street: '1 Main St', city: 'Plano', zip: '75074', county: '48085', phone: '(972) 555 0100', primary: true }], languages: ['en'], consult: { free: false, fee: 150, virtual: true }, fees: { div_nk: 4500 }, reviews: { rating: '4.8', count: '120', source: 'Google' }, arc: { filed: false, note: '' } };
function stubFirm(p) {
  return { get: () => p, responsible: () => p.attorneys[p.responsible] || {}, primary: () => p.offices.find(o => o.primary) || p.offices[0] || {},
    certs: () => p.attorneys.filter(a => a.name && a.tbls).map(a => `${a.name}, Board Certified, ${a.tbls}, Texas Board of Legal Specialization`),
    ready: () => !!(p.name && (p.attorneys[p.responsible] || {}).name && (p.offices[0] || {}).city),
    adFooter: o => { const r = p.attorneys[p.responsible] || {}, c = (p.offices[0] || {}).city; return (o && o.short) ? `${r.name || '[Responsible attorney]'}, ${c || '[Office city]'} TX` : `Responsible attorney: ${r.name || '[Responsible attorney]'}. Primary office: ${c || '[Office city]'}, Texas.`; } };
}
function load(p) { const ctx = vm.createContext({ FIRM: stubFirm(p), console }); vm.runInContext(code, ctx, { filename: 'src/03_lint.js' }); return { LINT: vm.runInContext('LINT', ctx), SAMPLE_AD: vm.runInContext('SAMPLE_AD', ctx), COMP_RULES: vm.runInContext('COMP_RULES', ctx) }; }
const { LINT, SAMPLE_AD, COMP_RULES } = load(profile);
const ids = r => r.findings.map(f => f.id);
const has = (r, id, msg) => assert(ids(r).includes(id), (msg || id) + ' expected in ' + JSON.stringify(ids(r)));
const hasNot = (r, id, msg) => assert(!ids(r).includes(id), (msg || id) + ' not expected; got ' + JSON.stringify(r.findings.filter(f => f.id === id).map(f => f.hit)));

/* 1. the API surface the other modules code against */
['screen', 'fix', 'house', 'checkAd', 'screenAd', 'stripHTML', 'detectLang', 'splitBatch', 'parseAdsCSV', 'diff', 'firmItems', 'rule'].forEach(k => assert(typeof LINT[k] === 'function', 'LINT.' + k));
assert(Array.isArray(LINT.RULES) && LINT.RULES.length >= 60, 'RULES: ' + LINT.RULES.length);
assert(new Set(LINT.RULES.map(r => r.id)).size === LINT.RULES.length, 'rule ids are unique');
LINT.RULES.forEach(r => { assert(['block', 'fix', 'warn', 'info'].includes(r.sev), r.id + ' severity'); assert(r.rule && r.why && r.t, r.id + ' cite, why and title'); });
['google', 'microsoft', 'meta', 'youtube', 'demandgen', 'tiktok', 'linkedin', 'lsa', 'gbp', 'yelp', 'nextdoor'].forEach(p => assert(LINT.LIMITS[p] && Object.keys(LINT.LIMITS[p]).length, 'LIMITS.' + p));
eq(LINT.LIMITS.google.headline, 30, 'google headline'); eq(LINT.LIMITS.google.description, 90, 'google description'); eq(LINT.LIMITS.meta.primary, 125, 'meta primary');
assert(Array.isArray(COMP_RULES) && COMP_RULES.length >= 21 && COMP_RULES.every(r => typeof r.re.test === 'function' && ['crit', 'review', 'info'].includes(r.sev)), 'COMP_RULES keeps the build 1 shape');
eq(LINT.ALIAS.r13, 'stale_cap', 'build 1 id alias'); assert(LINT.rule('r01').id === 'guarantee', 'rule() resolves aliases');
assert(LINT.CHANGES.length >= 10 && LINT.CHANGES.every(c => c.date && c.title && c.what && c.copy && Array.isArray(c.rules)), 'changes register');
LINT.CHANGES.forEach(c => c.rules.forEach(id => assert(LINT.rule(id), 'register names a real rule: ' + id)));

/* 2. the sample ad trips the expected rule ids */
const s = LINT.screen(SAMPLE_AD, { kind: 'ad' });
['number_one', 'competence', 'guarantee', 'superlative', 'property_5050', 'results', 'gender_myth', 'child_chooses', 'legal_separation', 'contingent', 'contingent_costs', 'stale_cap', 'sixty_days', 'r706', 'arc_filing'].forEach(id => has(s, id));
assert(!s.pass && s.counts.block >= 10, 'sample ad does not pass');
const cap = s.findings.find(f => f.id === 'stale_cap'); eq(cap.hit, '$9,200', 'cap hit'); eq(SAMPLE_AD.slice(cap.at, cap.at + 6), '$9,200', 'hit position'); eq(cap.fix, { from: '$9,200', to: '$11,700' }, 'cap fix');
assert(cap.ctx && cap.ctx.before.includes('capped at') && cap.url.startsWith('https://'), 'context and source link');
eq(s.findings.find(f => f.id === 'guarantee').fix, null, 'guarantee is flagged, not rewritten');
eq(s.findings[0].sev, 'block', 'findings sorted by severity');

/* 3. clean copy with a filled firm passes */
const clean = 'Divorce with children in Collin County. Conservatorship, possession and child support explained in plain terms. Flat fee divorce from $4,500. Responsible attorney: Jane Doe. Primary office: Plano, Texas.';
const c1 = LINT.screen(clean, { kind: 'ad', platform: 'google' });
assert(c1.pass && !c1.counts.block && !c1.counts.warn && !c1.counts.fix, 'clean ad passes: ' + JSON.stringify(c1.findings.map(f => [f.id, f.sev, f.hit])));
const c2 = LINT.screen(clean, { kind: 'page' }); assert(c2.pass, 'clean page passes');
const noFooter = LINT.screen('Divorce with children in Collin County.', { kind: 'page' });
assert(!noFooter.pass && noFooter.findings.find(f => f.id === 'r702a').sev === 'block', '7.02(a) blocks a page without the responsible lawyer');
eq(LINT.screen('Divorce with children in Collin County.', { kind: 'ad' }).findings.find(f => f.id === 'r702a').sev, 'warn', '7.02(a) is a review on an ad');
hasNot(LINT.screen('Divorce with children in Collin County.', { kind: 'ad', footer: false }), 'r702a', 'footer:false skips 7.02(a)');
hasNot(LINT.screen('Divorce with children in Collin County.', {}), 'r702a', 'no kind, no 7.02(a)');

/* an empty firm: placeholders block and 7.02(a) names what is missing */
const empty = load(Object.assign(JSON.parse(JSON.stringify(profile)), { name: '', attorneys: [{ name: '', tbls: '' }], offices: [{ city: '', primary: true }], fees: {}, reviews: {} })).LINT;
const e1 = empty.screen('Call [Firm name] today. Responsible attorney: [Responsible attorney].', { kind: 'ad' });
has(e1, 'ph'); assert(!e1.pass, 'placeholder blocks'); assert(/firm profile has none/.test(e1.findings.find(f => f.id === 'r702a').why), '7.02(a) says the profile is empty');
hasNot(LINT.screen('See [sic] and [the decree](https://example.com).', { kind: 'ad', footer: false }), 'ph', '[sic] and markdown links are not placeholders');

/* 4. fix(): stale numbers, phrasing, house style; guarantees untouched; nothing invented */
const fx = LINT.fix(SAMPLE_AD, { kind: 'ad' });
assert(fx.text.includes('$11,700') && !fx.text.includes('$9,200'), 'cap fixed');
assert(!fx.text.includes('#1') && !/expert attorneys/.test(fx.text) && /our attorneys/.test(fx.text), '#1 removed, expert dropped');
assert(/practice focused on divorce/i.test(fx.text) && !/Specialists/.test(fx.text), 'specialist rewritten');
assert(fx.text.includes('We guarantee the best outcome'), 'guarantee sentence left for a person');
assert(fx.applied.some(a => a.id === 'stale_cap' && a.from === '$9,200' && a.to === '$11,700'), 'applied lists the cap');
assert(fx.applied.some(a => a.id === 'number_one'), 'applied lists #1');
const after = LINT.screen(fx.text, { kind: 'ad' }); hasNot(after, 'stale_cap'); hasNot(after, 'number_one'); has(after, 'guarantee');
const ar = LINT.fix('Back child support accrues 3% interest per year.', { kind: 'ad' }); assert(ar.text.includes('6% interest'), 'arrears 3% to 6%: ' + ar.text);
const st = LINT.fix('We specialize in custody. Our firm is specializing in adoption. She has expertise in property.', { kind: 'page' });
assert(/We focus on custody/.test(st.text) && /focusing on adoption/.test(st.text) && /experience in property/.test(st.text), 'specialize forms: ' + st.text);
eq(LINT.fix('The cap rose from $9,200 to $11,700 in monthly net resources for child support.', { kind: 'page', footer: false }).text, 'The cap rose from $9,200 to $11,700 in monthly net resources for child support.', 'a correct sentence about the old cap is left alone');
hasNot(LINT.screen('The cap rose from $9,200 to $11,700 in monthly net resources for child support.', {}), 'stale_cap', 'history sentence not flagged');
eq(LINT.house('Agreed cases take 2-4 months — contested ones 9–24. Call 214-555-0100 or e-mail us at info@smith-law.com; see https://smith-law.com/co-parenting-plan.'), 'Agreed cases take 2 to 4 months, contested ones 9 to 24. Call (214) 555 0100 or email us at info@smith-law.com; see https://smith-law.com/co-parenting-plan.', 'house style');
eq(LINT.house('Title IV-D cases and a non-metro county.'), 'Title IV-D cases and a non metro county.', 'IV-D keeps its hyphen');
eq(LINT.house('Filed 2026-09-12.'), 'Filed September 12, 2026.', 'ISO dates');
const hs = LINT.screen('Co-parenting help in Plano.', { kind: 'ad', footer: false }); has(hs, 'house'); eq(hs.findings.find(f => f.id === 'house').sev, 'fix', 'house is a fix');
hasNot(LINT.screen('Visit https://smith-law.com/co-parenting today.', { kind: 'ad', footer: false }), 'house', 'URLs keep hyphens');
const fxHouse = LINT.fix('Co-parenting plans — written for Collin County.', { kind: 'ad' }); eq(fxHouse.text, 'Coparenting plans, written for Collin County.', 'fix applies house'); assert(fxHouse.applied.every(a => a.id === 'house'), 'house changes listed');
const sol = LINT.fix('Dear neighbor, we can help with your divorce.', { kind: 'email', solicitation: true, footer: false });
assert(sol.text.startsWith('ADVERTISEMENT') && sol.applied.some(a => a.id === 'sol_label'), 'solicitation label added');
has(LINT.screen('Dear neighbor, we can help.', { kind: 'email', solicitation: true, footer: false }), 'sol_label');
const pg = LINT.fix('Divorce help for Collin County families.', { kind: 'page' }); assert(pg.text.endsWith('Responsible attorney: Jane Doe. Primary office: Plano, Texas.') && pg.applied.some(a => a.id === 'r702a'), 'page footer appended from the firm profile');
assert(!LINT.fix('Divorce help.', { kind: 'ad' }).applied.some(a => a.id === 'r702a'), 'ads are not given a footer (limits)');
const d = LINT.diff('Child support is capped at $9,200.', 'Child support is capped at $11,700.');
assert(d.some(o => o.t === '-' && o.s.includes('$9,200')) && d.some(o => o.t === '+' && o.s.includes('$11,700')) && d.some(o => o.t === '=' && o.s.includes('capped')), 'word diff');

/* 5. HTML input: tags stripped, script and style skipped, positions reported in the source */
const html = '<!doctype html><html><head><title>Divorce Help</title><style>.x{content:"guarantee"}</style><script>var a = "we guarantee";</script><meta name="description" content="Number one divorce firm"></head><body><h1>We <b>guarantee</b> results</h1><p>Child support is capped at $9,200.</p><img src="a.webp" alt="Expert attorneys"></body></html>';
const h1 = LINT.screen(html, { html: true, kind: 'page', footer: false });
const g = h1.findings.find(f => f.id === 'guarantee'); assert(g && g.hit === 'guarantee', 'guarantee found in HTML');
assert(html.slice(g.src_at, g.src_at + 9) === 'guarantee' && html.lastIndexOf('<b>guarantee') + 3 === g.src_at, 'source position points at the visible text, not the script: ' + g.src_at);
assert(!/var a/.test(h1.text) && !/content:/.test(h1.text), 'script and style skipped');
assert(h1.text.includes('Divorce Help') && h1.text.includes('Number one divorce firm') && h1.text.includes('Expert attorneys'), 'title, meta description and alt text screened');
has(h1, 'stale_cap'); has(h1, 'number_one'); has(h1, 'competence');
const h2 = LINT.screen('<p>Divorce help</p><script src="https://connect.facebook.net/en_US/fbevents.js"></script><form><input type="checkbox" name="sms" checked></form><script type="application/ld+json">{"@type":"LegalService","aggregateRating":{"ratingValue":"5"}}</script>', { kind: 'page', footer: false });
assert(h2.html, 'HTML detected without the flag'); has(h2, 'web_pixel'); has(h2, 'WEB2'); has(h2, 'WEB3');
assert(LINT.rule('web_precheck').id === 'WEB2' && LINT.rule('web_rating').id === 'WEB3', 'the build 2 ids before WEB2 and WEB3 still resolve');
const hfix = LINT.fix(html, { html: true, kind: 'page', footer: false }); assert(hfix.text.includes('$11,700') && hfix.text.includes('var a = "we guarantee"') && hfix.text.includes('<b>guarantee</b>'), 'HTML fix touches text only');
const hmeta = LINT.fix('<head><meta name="description" content="Top rated divorce specialists in Plano"></head><body><img src="a.webp" alt="Our expert attorneys"><p>Hi</p></body>', { html: true, kind: 'page', footer: false });
assert(/content="Top rated practice focused on divorce in Plano"/.test(hmeta.text) && /alt="Our attorneys"/.test(hmeta.text), 'meta description and alt text fixed: ' + hmeta.text);
eq(LINT.stripHTML('<p>A &amp; B&nbsp;&mdash; C</p>').text, 'A & B — C', 'entities decoded');

/* 6. Spanish */
const esAd = 'Los mejores abogados de divorcio de Texas. Somos especialistas en custodia y le garantizamos el mejor resultado. No cobramos si no ganamos. ¿Se está divorciando? Llame hoy.';
eq(LINT.detectLang(esAd), 'es', 'detects Spanish'); eq(LINT.detectLang(SAMPLE_AD), 'en', 'detects English');
const es = LINT.screen(esAd, { kind: 'ad', lang: 'es', platform: 'meta', footer: false });
['superlative_es', 'competence_es', 'guarantee_es', 'contingent_es', 'meta_attr', 'es_staff'].forEach(id => has(es, id));
eq(es.findings.find(f => f.id === 'meta_attr').sev, 'block', 'personal attribute blocks on Meta');
['Resultado garantizado.', 'Somos el bufete número uno.', 'Hable con un especialista.', 'El mejor abogado de familia.'].forEach((tx, i) => has(LINT.screen(tx, { lang: 'es' }), ['guarantee_es', 'number_one', 'competence_es', 'superlative_es'][i], 'Spanish: ' + tx));
has(LINT.screen('Texas #1 divorce firm.', {}), 'number_one', '#1 after a word'); has(LINT.screen('#1 in Plano.', {}), 'number_one', '#1 at the start'); has(LINT.screen('We have recovered millions.', {}), 'results', 'recovered millions');
hasNot(LINT.screen('Actuamos según el mejor interés del menor.', { lang: 'es' }), 'superlative_es', 'el mejor interés del menor is the standard');
hasNot(LINT.screen('Texas no reconoce la separación legal.', { lang: 'es' }), 'legal_separation_es', 'Spanish negation');
const esFix = LINT.fix('Nos especializamos en custodia. Somos especialistas en divorcio.', { lang: 'es', kind: 'ad' });
assert(/Nos enfocamos en custodia/.test(esFix.text) && /práctica enfocada en divorcio/.test(esFix.text), 'Spanish safe fix: ' + esFix.text);
hasNot(LINT.screen(esAd, { kind: 'ad', lang: 'en', footer: false }), 'guarantee_es', 'lang en skips Spanish rules');
const bil = load(Object.assign(JSON.parse(JSON.stringify(profile)), { languages: ['en', 'es'] })).LINT;
hasNot(bil.screen(esAd, { kind: 'ad', lang: 'es', footer: false }), 'es_staff', 'Spanish staff in the profile');

/* 7. checkAd: platform limits, counts, editorial, fields */
const ad = { platform: 'google', fields: { headline1: 'Divorce Lawyer In Plano', headline2: 'Collin County Family Law Firm Today', headline3: 'Call Now!', description1: 'Conservatorship and support explained. Responsible attorney: Jane Doe. Primary office: Plano, Texas.', description2: 'Flat fee agreed divorce from $4,500.' } };
const ca = LINT.checkAd(ad); assert(Array.isArray(ca), 'checkAd returns findings');
const len = ca.find(f => f.id === 'len_headline2'); assert(len && len.sev === 'block' && len.field === 'headline2', 'google headline over 30 blocks');
assert(ca.some(f => f.id === 'len_description1' && f.sev === 'block'), 'description over 90 blocks');
assert(ca.some(f => f.id === 'ggl_editorial' && f.field === 'headline3'), 'exclamation in a headline');
assert(!ca.some(f => f.id === 'len_headline1'), 'headline 1 fits');
const sa = LINT.screenAd({ platform: 'google', fields: { headline1: 'Plano Divorce Lawyer', description1: 'Guaranteed results.' } });
assert(sa.findings.some(f => f.id === 'count_headline') && sa.findings.find(f => f.id === 'guarantee').field === 'description1', 'counts and the field of a hit');
const meta = LINT.checkAd({ platform: 'facebook', fields: { primary: 'x'.repeat(130), headline: 'Your divorce, handled' } }, { footer: false });
assert(meta.some(f => f.id === 'len_primary' && f.sev === 'warn'), 'meta primary text over 125 is a truncation warning');
assert(meta.some(f => f.id === 'meta_attr' && f.sev === 'block'), '"Your divorce" blocks on Meta (facebook alias)');
const tt = LINT.checkAd({ platform: 'tiktok', fields: { text: 'y'.repeat(101) } }, { footer: false }); assert(tt.some(f => f.id === 'len_text' && f.sev === 'block'), 'tiktok 100');
const fa = LINT.fixAd({ platform: 'google', fields: { headline1: '#1 Divorce Lawyer', description1: 'Cap is $9,200 for child support.' } });
eq(fa.fields.headline1, 'Divorce Lawyer', 'fixAd headline'); assert(fa.fields.description1.includes('$11,700') && fa.applied.every(a => a.field), 'fixAd fields');

/* 8. no false positives: best interest of the child, a TBLS claim the firm holds, negations, myths stated as myths */
const bi = LINT.screen('Every decision is made in the best interest of the child, and the best interests of the children guide the court. Responsible attorney: Jane Doe. Primary office: Plano, Texas.', { kind: 'page' });
hasNot(bi, 'superlative'); assert(bi.pass, 'best interest passes');
const tb = LINT.screen('Jane Doe is Board Certified, Family Law, Texas Board of Legal Specialization. Responsible attorney: Jane Doe. Primary office: Plano, Texas.', { kind: 'page' });
['competence', 'certified', 'tbls_unsupported', 'cert_attrib'].forEach(id => hasNot(tb, id, 'TBLS claim the firm holds: ' + id)); assert(tb.pass, 'TBLS claim passes');
const tb2 = LINT.screen('Board Certified, Criminal Law, Texas Board of Legal Specialization.', { posture: 'self' }); has(tb2, 'tbls_unsupported', 'area the firm does not hold');
const tb3 = LINT.screen('Our firm is Board Certified, Family Law, Texas Board of Legal Specialization.', { posture: 'self' }); has(tb3, 'cert_attrib', 'claim without the lawyer');
const tb4 = LINT.fix('Jane Doe is Board Certified in Family Law.', { kind: 'page', footer: false }); eq(tb4.text, 'Jane Doe is Board Certified, Family Law, Texas Board of Legal Specialization.', 'incomplete TBLS form completed from the profile');
const nocert = load(Object.assign(JSON.parse(JSON.stringify(profile)), { attorneys: [{ name: 'Jane Doe', tbls: '' }] })).LINT;
has(nocert.screen('Jane Doe is Board Certified, Family Law, Texas Board of Legal Specialization.', { posture: 'self' }), 'tbls_unsupported', 'firm without the certification');
hasNot(LINT.screen('Board Certified, Criminal Law, Texas Board of Legal Specialization.', { posture: 'comp' }), 'tbls_unsupported', 'competitor posture does not compare with our firm');
['No lawyer can guarantee an outcome.', 'We do not take family cases on a contingency basis.', 'Texas has no legal separation.', 'Legal separation does not exist in Texas.', 'It is a myth that mothers always get custody.', 'DFPS no longer accepts anonymous reports.', 'We work with financial experts and expert witnesses.', 'Send it by certified mail.'].forEach(tx => { const r = LINT.screen(tx, {}); assert(!r.findings.some(f => f.sev === 'block' || f.sev === 'warn'), 'no flag on: ' + tx + ' got ' + JSON.stringify(ids(r))); });
hasNot(LINT.screen('Joint custody and 50/50 custody schedules explained.', {}), 'property_5050', '50/50 custody is not the property myth');
has(LINT.screen('Texas presumes 50/50 custody.', {}), 'equal_time', '50/50 custody claim is the equal time myth');
hasNot(LINT.screen('Full custody, called sole managing conservatorship in Texas.', {}), 'lay_terms', 'lay term with the Texas term');

/* 9. firm aware checks: fees, free consultations, ratings, trade names */
const fee = LINT.screen('Agreed divorce, flat fee $3,000.', { kind: 'ad', footer: false }); eq(fee.findings.find(f => f.id === 'fee_honor').sev, 'warn', 'fee not in the profile');
eq(LINT.screen('Agreed divorce, flat fee $4,500.', { kind: 'ad', footer: false }).findings.find(f => f.id === 'fee_honor').sev, 'info', 'fee in the profile');
eq(LINT.screen('Free consultation today.', { kind: 'ad', footer: false }).findings.find(f => f.id === 'free_consult').sev, 'block', 'free consultation the firm does not give');
eq(LINT.screen('Rated 5 stars by 300 reviews.', { posture: 'self' }).findings.find(f => f.id === 'reviews_claim').sev, 'warn', 'rating above the profile');
eq(LINT.screen('Rated 4.8 stars on Google.', { posture: 'self' }).findings.find(f => f.id === 'reviews_claim').sev, 'info', 'rating that matches');
eq(LINT.screen('Call the Texas Divorce Center.', {}).findings.find(f => f.id === 'trade_gov').sev, 'warn', 'trade name implies government');
const tg = load(Object.assign(JSON.parse(JSON.stringify(profile)), { name: 'Child Support Office of Texas' })).LINT;
eq(tg.screen('Child Support Office of Texas', { posture: 'self' }).findings.find(f => f.id === 'trade_gov').sev, 'block', 'the firm\'s own name implies government');
has(LINT.screen('Doe & Associates', { posture: 'self' }), 'trade_partner', 'one lawyer firm with & Associates');

hasNot(LINT.screen('Board Certified, Criminal Law, Texas Board of Legal Specialization. Free consultation. Flat fee $3,000.', {}), 'tbls_unsupported', 'no kind and no posture: not compared with our firm (Competitor Watch calls)');
assert(!LINT.screen('Free consultation. Rated 5 stars by 300 reviews.', {}).findings.some(f => f.id === 'free_consult' || (f.id === 'reviews_claim' && f.sev !== 'info')), 'neutral posture: no firm comparison');
hasNot(LINT.screen('Co-parenting help.', { posture: 'comp', kind: 'ad' }), 'house', 'house style is off for a competitor');
const compR = LINT.screen('Call [Firm name]. We guarantee results. TBD.', { posture: 'comp', kind: 'ad' }); ['ph', 'meta_note', 'r706', 'arc_filing', 'house'].forEach(id => hasNot(compR, id, 'competitor posture drops ' + id)); has(compR, 'guarantee', 'competitor posture keeps the rules');

/* 10. platforms, solicitation, sms, register samples */
has(LINT.screen('Are you getting divorced? We can help.', { platform: 'google' }), 'google_hardship');
hasNot(LINT.screen('Are you getting divorced? We can help.', { platform: 'google' }), 'meta_attr', 'Meta rule off on Google');
has(LINT.screen('IN THE DISTRICT COURT OF COLLIN COUNTY. Call us.', { solicitation: true, kind: 'email' }), 'sol_pleading');
has(LINT.screen('Divorce help in Plano.', { kind: 'sms', footer: false }), 'sms_consent'); hasNot(LINT.screen('Divorce help in Plano. Reply STOP to opt out.', { kind: 'sms', footer: false }), 'sms_consent');
LINT.CHANGES.filter(c => c.sample && c.rules.length).forEach(c => { const r = LINT.screen(c.sample, {}); assert(c.rules.some(id => ids(r).includes(id)), `register sample for "${c.title}" trips ${c.rules.join(' or ')}: got ${JSON.stringify(ids(r))}`); });
const items = LINT.splitBatch('## Google ad\nDivorce help\n---\n## Spanish page\n<p>Abogados</p>\n---\n\nThird item');
eq(items.length, 3, 'batch split'); eq(items[0].platform, 'google', 'platform from the label'); assert(items[1].html && items[1].kind === 'page' && items[1].lang === 'es', 'html page item in Spanish'); eq(items[2].label, 'Item 3', 'default label');
const csvIn = 'Campaign,Ad group,Headline 1,Headline 2,Headline 3,Description 1,Description 2,Final URL\nDivorce,Plano,Plano Divorce Lawyer,Best Divorce Lawyers In Plano Texas,Call Today,"Guaranteed results, every time.",Flat fee divorce.,https://x.com\n';
const pc = LINT.parseAdsCSV(csvIn); eq(pc.items.length, 1, 'csv rows'); eq(pc.items[0].platform, 'google', 'platform guessed from columns'); eq(pc.items[0].label, 'Divorce · Plano', 'label from campaign and ad group'); assert(!('Final URL' in pc.items[0].fields) && pc.items[0].fields.headline2, 'copy columns only');
const pr = LINT.screenAd(pc.items[0], { footer: false }); assert(pr.findings.some(f => f.id === 'len_headline2') && pr.findings.some(f => f.id === 'guarantee'), 'csv ad screened');
const metaCsv = LINT.parseAdsCSV('Platform,Ad name,Primary text,Title\nfacebook,Spring,Your divorce handled,Plano family law\n'); eq(metaCsv.items[0].platform, 'meta', 'platform column'); assert(metaCsv.items[0].fields.text, 'text column');
const fi = LINT.firmItems(); assert(fi.some(i => i.label === 'Tagline') && fi.some(i => /^Bio, Jane Doe/.test(i.label)) && fi.some(i => /Ad footer/.test(i.label)), 'firm items');
fi.forEach(i => { const r = LINT.screen(i.text, i); assert(r.pass, 'firm item passes: ' + i.label + ' ' + JSON.stringify(ids(r))); });
/* 11. the code audit of the build 1 screen, item by item: every case must still behave */
has(LINT.screen('Number 1 rated divorce firm.', {}), 'number_one', '"Number 1" is a ranking'); hasNot(LINT.screen('Step number 1: gather your tax returns.', {}), 'number_one', 'a numbered step is not a ranking');
['We have won over $3 million in settlements.', 'Millions recovered for our clients.', 'Our attorneys secured $250,000 for a client.'].forEach(t => has(LINT.screen(t, {}), 'results', 'past results: ' + t));
hasNot(LINT.screen("We won't charge more than $5,000 for an agreed case.", {}), 'results', "won't is not a result");
{ const r = LINT.screen('Board Certified, Family Law, Texas Board of Legal Specialization. Our expert team specializes in custody.', {}); assert(ids(r).filter(x => x === 'competence').length === 1 && r.findings.find(f => f.id === 'competence').n === 2, 'one TBLS line does not silence the expert and specializes claims elsewhere: ' + JSON.stringify(r.findings.map(f => [f.id, f.hit, f.n]))); }
has(LINT.screen('Board Certified expert in Family Law, Texas Board of Legal Specialization.', {}), 'competence', '"expert" inside a TBLS line is still a claim');
assert(!COMP_RULES.some(r => r.ok), 'COMP_RULES carries no whole text exemption');
['Going through a divorce? Call us.', 'Facing a custody battle? We can help.', 'Divorcing? Talk with a lawyer.'].forEach(t => { const r = LINT.screen(t, { platform: 'meta', footer: false }); has(r, 'meta_attr', 'personal attribute question: ' + t); eq(r.findings.find(f => f.id === 'meta_attr').sev, 'block', 'blocks on Meta: ' + t); });
hasNot(LINT.screen('Divorce with children in Collin County, explained.', { platform: 'meta', footer: false }), 'meta_attr', 'third person copy passes');
has(LINT.screen('¿Pasando por un divorcio? Llame hoy.', { platform: 'meta', lang: 'es', footer: false }), 'meta_attr', 'Spanish question form');
hasNot(LINT.screen('We focus on the best interest of the child.', {}), 'superlative', 'best interest of the child');
eq(LINT.screen('We want 50/50 custody for dads.', {}).findings.filter(f => f.id === 'equal_time' || f.id === 'property_5050').map(f => f.id + ':' + f.sev), ['equal_time:warn'], '50/50 custody as a goal: one review, not the property myth');
eq(LINT.screen('Texas presumes equal time for both parents.', {}).findings.find(f => f.id === 'equal_time').sev, 'block', 'equal time stated as the law blocks');
['equal time is not presumed', 'Texas has no equal time presumption.', 'Texas does not presume equal time.'].forEach(t => hasNot(LINT.screen(t, {}), 'equal_time', 'correct statement: ' + t));
hasNot(LINT.screen('Certified mail service of process.', {}), 'certified', 'certified mail'); hasNot(LINT.screen('Modification Reviews This Week', {}), 'testimonials', 'reviews as a verb');
has(LINT.screen('Free consultation, pay only if we win.', {}), 'contingent', 'pay only if we win');
has(LINT.screen('Uncontested divorce done in sixty days.', {}), 'sixty_days', 'done in sixty days'); hasNot(LINT.screen('A divorce cannot be final within sixty days of filing.', {}), 'sixty_days', 'the minimum stated as a minimum');
{ const r = LINT.screen('Abogado de divorcio especialista, el mejor, resultados garantizados.', {}); ['competence_es', 'superlative_es', 'guarantee_es'].forEach(id => has(r, id, 'Spanish ' + id)); }
has(LINT.screen('Common law marriages do not need a divorce.', {}), 'informal_divorce'); hasNot(LINT.screen('It is a myth that common law marriages do not need a divorce.', {}), 'informal_divorce', 'stated as a myth');
has(LINT.screen('Child support ends at 18.', {}), 'support_18'); hasNot(LINT.screen('Child support ends at 18 or high school graduation, whichever is later.', {}), 'support_18', 'complete statement');
has(LINT.screen('Grandparents have automatic visitation rights in Texas.', {}), 'grandparent_rights'); hasNot(LINT.screen('Grandparents have access rights only in limited cases.', {}), 'grandparent_rights', 'limited stated');

/* 12. web tests on raw page HTML: WEB1 to WEB6 and WEBRESP */
const shell = (title, body, head) => `<!doctype html><html><head><title>${title}</title>${head || ''}</head><body><h1>${title}</h1>${body}</body></html>`;
const FORM = '<form><label>Name <input name="name"></label><label>Phone <input type="tel" name="phone"></label><textarea name="message"></textarea><label><input type="checkbox" name="consent" value="yes"> I agree</label></form>';
const NOTICE = '<p>Sending this form does not create an attorney client relationship.</p><p>Responsible attorney: Jane Doe. Primary office: Plano, Texas.</p>';
const EXIT = '<div class="forge-exit"><a class="forge-exit-btn" href="https://weather.com/" data-forge-exit>Leave this site</a></div>';
const GTM = '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC"></script>';
eq(LINT.pageClass(shell('Protective Order Lawyer in Plano', FORM)).sensitive, 'po', 'protective order page from the h1');
eq(LINT.pageClass(shell('CPS Defense Lawyer in Plano', '')).sensitive, 'cps', 'CPS page from the h1');
eq(LINT.pageClass(shell('Abogado de órdenes de protección en Plano', '')).sensitive, 'po', 'Spanish protective order page');
eq(LINT.pageClass('Family Lawyer in Dallas County\nWe handle divorce, custody and protective order cases.\n' + shell('Family Lawyer in Dallas County', '<p>Protective order cases: 1,378.</p>')).sensitive, '', 'a county page that mentions protective orders is not a protective order page');
eq(LINT.pageClass(shell('Divorce Lawyer', ''), { sensitive: 'po' }).sensitive, 'po', 'the caller can say the page is sensitive');
const poBad = LINT.screen(shell('Protective Order Lawyer in Plano', FORM, GTM + '<script>window.dataLayer=window.dataLayer||[];dataLayer.push({event:"x"})</script>'), { kind: 'page' });
['WEB1', 'WEB5', 'WEB6', 'WEBRESP'].forEach(id => has(poBad, id, 'protective order page without the safeguards: ' + id));
assert(/googletagmanager/.test(poBad.findings.find(f => f.id === 'WEB1').hit) && /datalayer/i.test(poBad.findings.find(f => f.id === 'WEB1').hit), 'WEB1 names the tag manager and the dataLayer push on a sensitive page');
eq(poBad.findings.find(f => f.id === 'WEBRESP').sev, 'block', 'WEBRESP blocks'); hasNot(poBad, 'r702a', 'one finding per problem: WEBRESP replaces r702a when the source has neither');
assert(!poBad.pass, 'the bad protective order page does not pass');
const poGood = LINT.screen(shell('Protective Order Lawyer in Plano', EXIT + FORM + NOTICE), { kind: 'page' });
['WEB1', 'WEB2', 'WEB3', 'WEB5', 'WEB6', 'WEBRESP', 'r702a'].forEach(id => hasNot(poGood, id, 'protective order page with every safeguard: ' + id)); assert(poGood.pass, 'the safe protective order page passes: ' + JSON.stringify(ids(poGood)));
hasNot(LINT.screen(shell('Divorce Lawyer in Plano', FORM + NOTICE, '<script>dataLayer.push({event:"lead"})</script>'), { kind: 'page' }), 'WEB1', 'a dataLayer push alone is not a tag on an ordinary intake page');
has(LINT.screen(shell('Divorce Lawyer in Plano', FORM + NOTICE, GTM), { kind: 'page' }), 'WEB1', 'a tag manager on an intake page');
has(LINT.screen(shell('CPS Defense Lawyer', NOTICE + '<iframe src="https://www.youtube.com/embed/x"></iframe>'), { kind: 'page' }), 'WEB1', 'a third party frame on a CPS page');
hasNot(LINT.screen(shell('Divorce Lawyer in Plano', NOTICE + '<p>Read more.</p>', GTM), { kind: 'page' }), 'WEB1', 'no intake form and not sensitive: WEB1 stays quiet (web_pixel covers the privacy link)');
hasNot(LINT.screen(shell('CPS Defense Lawyer in Plano', NOTICE), { kind: 'page' }), 'WEB6', 'WEB6 is for protective order pages');
has(LINT.screen(shell('Divorce Lawyer', '<form><input type="checkbox" checked name="sms"></form>' + NOTICE), { kind: 'page' }), 'WEB2', 'pre checked box');
has(LINT.screen(shell('Divorce Lawyer', NOTICE, '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Attorney","name":"Jane Doe","review":[{"@type":"Review"}]}]}</script>'), { kind: 'page' }), 'WEB3', 'review on the Attorney node');
hasNot(LINT.screen(shell('Divorce Lawyer', NOTICE, '<script type="application/ld+json">{"@type":"Product","aggregateRating":{"ratingValue":"5"}}</script>'), { kind: 'page' }), 'WEB3', 'a rating on another type is not the firm rating itself');
has(LINT.screen(shell('Divorce Lawyer', FORM + '<p>Responsible attorney: Jane Doe, Plano.</p>'), { kind: 'page' }), 'WEB5', 'a form without the notice');
hasNot(LINT.screen(shell('Divorce Lawyer', FORM + NOTICE), { kind: 'page' }), 'WEB5', 'the notice beside the form');
hasNot(LINT.screen(shell('Divorce Lawyer', '<p>Hi</p>' + '<script type="application/ld+json">{"name":"Jane Doe","address":{"addressLocality":"Plano"}}</script>'), { kind: 'page' }), 'WEBRESP', 'the source counts, schema and footer included');
hasNot(LINT.screen(shell('Divorce Lawyer', '<p>Hi</p>'), { kind: 'page', footer: false }), 'WEBRESP', 'footer:false skips WEBRESP');
eq(LINT.screen(shell('Divorce Lawyer', '<p>Hi</p>'), { posture: 'comp' }).findings.find(f => f.id === 'WEBRESP').sev, 'warn', 'competitor posture: a review, not a block');
hasNot(LINT.screen(shell('Divorce Lawyer', '<p>Hi</p>'), {}), 'WEBRESP', 'neutral posture skips WEBRESP');
const wrFix = LINT.fix(shell('Protective Order Lawyer in Plano', EXIT + FORM.replace('</form>', '</form><p>Sending this form does not create an attorney client relationship.</p>')), { kind: 'page' });
assert(LINT.screen(wrFix.text, { kind: 'page' }).findings.every(f => f.id !== 'WEBRESP' && f.id !== 'r702a'), 'the safe fix adds the responsible lawyer footer and clears WEBRESP');

/* 13. OFFICE2: wording that implies an office where the firm has none */
const off = LINT.screen('Visit our Frisco office. Located in Allen. Oficina en McKinney. Our office in Plano is open. Office in Plano, Texas. Our Dallas County office is busy. Serving Frisco from our office in Plano.', { kind: 'page', footer: false });
const offF = off.findings.find(f => f.id === 'OFFICE2'); assert(offF && offF.n === 3 && offF.sev === 'warn', 'OFFICE2 on Frisco, Allen and McKinney only: ' + JSON.stringify(offF && offF.hits.map(h => off.text.slice(h.at, h.at + h.len))));
hasNot(LINT.screen('Our office in Frisco.', { posture: 'comp' }), 'OFFICE2', 'competitor posture: their offices are not ours');
hasNot(LINT.screen('The Texas Office of Court Administration counts filings.', { kind: 'page', footer: false }), 'OFFICE2', 'a public office is not the firm\'s');

/* 14. the license battery: BAROK, BARINACT, BARNONE, BARNAME, TBLSNO, the roster, the lookup */
const firm2 = Object.assign(JSON.parse(JSON.stringify(profile)), { attorneys: [{ name: 'Jane Doe', bar_no: '24000000', tbls: 'Family Law' }, { name: 'John Roe', bar_no: '24111111', tbls: '' }] });
const L2 = load(firm2).LINT;
const seeded = L2.roster(); eq(seeded.map(r => r.name + ':' + r.bar_no), ['Jane Doe:24000000', 'John Roe:24111111'], 'the roster is seeded from the firm profile');
const b1 = L2.screen('Jane Doe, State Bar of Texas No. 24000000, is the responsible attorney.', { kind: 'page', footer: false });
has(b1, 'BAROK'); ['BARINACT', 'BARNONE', 'BARNAME'].forEach(id => hasNot(b1, id, 'a matching number: ' + id));
const ros = [{ name: 'Jane Doe', bar_no: '24000000', status: 'Active', eligible: 'Yes', tbls: 'Family Law', as_of: '2026-09-30' }, { name: 'John Roe', bar_no: '24111111', status: 'Inactive', eligible: 'No', tbls: '', as_of: '2026-09-30' }];
const b2 = L2.screen('John Roe, State Bar No. 24111111, handles custody.', { kind: 'page', footer: false, roster: ros });
eq(b2.findings.find(f => f.id === 'BARINACT').sev, 'block', 'an inactive lawyer\'s number blocks'); assert(!b2.pass, 'BARINACT fails the copy'); has(b2, 'r706', 'and adds the prohibited employment reminder');
const b3 = L2.screen('John Roe, State Bar No. 24000000. Mark Smith, State Bar No. 24999999.', { kind: 'page', footer: false, roster: ros });
has(b3, 'BARNAME', 'a name paired with someone else\'s number'); has(b3, 'BARNONE', 'a number the roster does not hold'); eq(b3.findings.find(f => f.id === 'BARNONE').obs, false, 'BARNONE is not observable here');
assert(/State Bar of Texas Find a Lawyer/.test(b3.findings.find(f => f.id === 'BARNONE').why) && /texasbar\.com/.test(b3.findings.find(f => f.id === 'BARNONE').url), 'BARNONE points at the State Bar search');
has(L2.screen('Jane Doe, State Bar No. 24222222, handles custody.', { kind: 'page', footer: false, roster: ros }), 'BARNAME', 'a roster lawyer with a different number');
const b4 = L2.screen('John Roe is Board Certified, Family Law, Texas Board of Legal Specialization.', { kind: 'page', footer: false, roster: ros });
eq(b4.findings.find(f => f.id === 'TBLSNO').sev, 'block', 'TBLSNO: the roster lists no certification for the lawyer named');
hasNot(L2.screen('Jane Doe is Board Certified, Family Law, Texas Board of Legal Specialization.', { kind: 'page', footer: false, roster: ros }), 'TBLSNO', 'the lawyer named holds it');
const b5 = L2.screen('John Roe, State Bar No. 24111111.', { posture: 'comp', roster: ros }); eq(ids(b5).filter(x => /^BAR/.test(x)), ['BARNONE'], 'competitor posture: every number is not observable here');
hasNot(L2.screen('Call 24000000 today. Order number 12345678.', { kind: 'ad', footer: false }), 'BARNONE', 'an 8 digit number with no bar context is not a bar number');
eq(L2.barNumbers('State Bar of Texas, número 24000000').map(b => b.no), ['24000000'], 'Spanish bar context');
const prs = L2.parseRoster('Name,Bar number,Status,Eligible to practice,TBLS area,Office city,As of\nJane Doe,24000000,Active,Yes,Family Law,Plano,2026-09-30\nMax Q,123,Inactive,No,,,\n');
eq(prs.rows.length, 2, "roster CSV rows"); eq(prs.rows[1].bar_no, '00000123', 'bar numbers padded to 8 digits'); assert(L2.notEligible(prs.rows[1]) && !L2.notEligible(prs.rows[0]), 'status and eligibility read');
eq(L2.parseRoster('Jane Doe, 24000000, Active, Yes, Family Law, Plano, 2026-09-30').rows[0].tbls, 'Family Law', 'no header: columns in order'); assert(L2.parseRoster('Jane Doe, 24000000').warnings.length, 'says when no header was found');
eq(L2.lookupBar('24111111', ros).map(r => r.name), ['John Roe'], 'lookup by number'); eq(L2.lookupBar('doe', ros).map(r => r.name), ['Jane Doe'], 'lookup by name'); eq(L2.lookupBar('24999999', ros), [], 'lookup miss');
assert(L2.nameMatch('Doe Family Law, PLLC', 'Jane Doe') && L2.nameMatch('The Law Office of Jane Doe', 'Jane Q. Doe') && !L2.nameMatch('Smith Divorce Attorneys', 'Jane Doe'), 'name matching sets aside law, firm, pllc, attorney, family and divorce');

/* 15. the figures table is the one source of the stale number rules; the calendar and the standards */
['cap', 'cap_2019', 'cap1', 'arrears', 'hb4213', 'sb849', 'sb2878', 'ground_o', 'po_dur', 'legal_sep', 'espo', 'prop15'].forEach(id => assert(LINT.figure(id), 'figure ' + id));
assert(LINT.FIGURES.every(f => ['live', 'stale', 'died', 'vetoed', 'repealed', 'adopted', 'none'].includes(f.status) && ['✔', 'web', 'verify'].includes(f.v) && f.cite && f.label && f.value), 'every figure has a status, a vintage, a citation, a label and a value');
eq(LINT.figure('cap').value, '$11,700', 'cap live'); eq(LINT.figure('cap_2019').status, 'stale', '$9,200 stale'); eq(LINT.figure('sb2878').status, 'vetoed', 'SB 2878 vetoed'); assert(/85\.025\(a-2\)/.test(LINT.figure('po_dur').cite), 'SB 1120 subsections');
LINT.FIGURES.filter(f => f.status === 'stale' && f.num > 100 && !f.strict).forEach(f => has(LINT.screen(`Child support is capped at ${f.value}.`, {}), f.now === 'cap1' ? 'stale_per_child' : 'stale_cap', 'every stale figure trips its rule: ' + f.value));
assert(LINT.RULE.stale_cap.why.includes(LINT.figure('cap').value) && LINT.RULE.stale_arrears.why.includes(LINT.figure('arrears').value), 'the rule reasons quote the figures table');
{ /* change a figure: a copy of the engine with a different live cap and one more stale value reads the table, not a typed number */
  const alt = code.replace("value: '$11,700', num: 11700, status: 'live'", "value: '$12,500', num: 12500, status: 'live'").replace("{ id: 'cap1', topic", "{ id: 'cap_2025', topic: 'Child support', label: 'test', value: '$11,700', num: 11700, status: 'stale', since: '2025-09-01', now: 'cap', cite: 'x', v: 'verify' },\n    { id: 'cap1', topic");
  const ctx = vm.createContext({ FIRM: stubFirm(profile), console }); vm.runInContext(alt, ctx); const LA = vm.runInContext('LINT', ctx);
  eq(LA.fix('Child support is capped at $11,700.', {}).text, 'Child support is capped at $12,500.', 'a new live figure moves the stale rule and its fix');
}
const cal = LINT.CALENDAR; eq(cal[0].date, '2021-07-01', 'the calendar starts with the July 1, 2021 rules'); eq(cal[cal.length - 1].date, '2031-09-01', 'and ends with the next cap adjustment');
assert(cal.every(c => c.title && c.what && c.cite && c.status), 'calendar rows complete'); assert(cal.some(c => c.status === 'vetoed') && cal.some(c => c.status === 'died') && cal.some(c => c.status === 'repealed'), 'calendar statuses');
['§ 6.301', '§ 6.702', '§ 7.001', 'ch. 8', '§ 154.125', '§§ 153.131 and 153.135', '§ 153.3171', '§ 153.009', 'ch. 85', '§ 161.001'].forEach(c => assert(LINT.STANDARDS.some(x => x.cite === c), 'standard ' + c));
LINT.CHANGES.forEach(c => assert(c.status, 'every change carries a status: ' + c.title));
console.log('lint ok: ' + LINT.RULES.length + ' rules');
