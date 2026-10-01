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
const h2 = LINT.screen('<p>Divorce help</p><script src="https://connect.facebook.net/en_US/fbevents.js"></script><form><input type="checkbox" name="sms" checked></form><script type="application/ld+json">{"aggregateRating":{"ratingValue":"5"}}</script>', { kind: 'page', footer: false });
assert(h2.html, 'HTML detected without the flag'); has(h2, 'web_pixel'); has(h2, 'web_precheck'); has(h2, 'web_rating');
const hfix = LINT.fix(html, { html: true, kind: 'page', footer: false }); assert(hfix.text.includes('$11,700') && hfix.text.includes('var a = "we guarantee"') && hfix.text.includes('<b>guarantee</b>'), 'HTML fix touches text only');
eq(LINT.stripHTML('<p>A &amp; B&nbsp;&mdash; C</p>').text, 'A & B — C', 'entities decoded');

/* 6. Spanish */
const esAd = 'Los mejores abogados de divorcio de Texas. Somos especialistas en custodia y le garantizamos el mejor resultado. No cobramos si no ganamos. ¿Se está divorciando? Llame hoy.';
eq(LINT.detectLang(esAd), 'es', 'detects Spanish'); eq(LINT.detectLang(SAMPLE_AD), 'en', 'detects English');
const es = LINT.screen(esAd, { kind: 'ad', lang: 'es', platform: 'meta', footer: false });
['superlative_es', 'competence_es', 'guarantee_es', 'contingent_es', 'meta_attr', 'es_staff'].forEach(id => has(es, id));
eq(es.findings.find(f => f.id === 'meta_attr').sev, 'block', 'personal attribute blocks on Meta');
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
console.log('lint ok: ' + LINT.RULES.length + ' rules');
