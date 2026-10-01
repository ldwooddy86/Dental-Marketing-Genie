/* SEVERANCE Site Forge copy writer (FCOPY): the Texas family law page library and the blueprint writer.
   The Thermal Atlas keeps its HVAC copy in 08_forge_copy.js and builds blueprints in module 09; Severance keeps both here so the
   writer can be tested on its own. Module 21 (src/40_m21_forge.js) plans the page set, computes the values (V) from the firm profile
   and the court, Census and ZIP data, and calls FCOPY.describe(p, V) and FCOPY.blueprint(p, ctx).
   Rules the library keeps:
     no number is typed into a template: every figure comes from V (the data) or from LAW (statutes and rules, each with its cite)
     no hyphen or dash in visible copy (LINT.house runs over every text field before it compiles)
     no review, rating, result, award or comparative claim is written; the firm supplies real reviews or none appear
     Texas terms first (conservatorship, possession and access, SAPCR), lay terms beside them; Spanish follows TexasLawHelp.org usage
       (divorcio, custodia, manutención de menores, orden de protección, posesión y acceso)
   API: FCOPY.LAW, LINES, LINE_KEYS, STEPS, GUIDES, ES, HOME_FAQ, CITY_FAQ, COUNTY_FAQ, ATTY_FAQ, KL, SRC(V), fill, fillDeep, house,
        factItem(k, V), describe(p, V, o), blueprint(p, ctx), visibleText(bp), wordCount(bp) */
'use strict';
const FCOPY = (() => {
  /* ---------- house style (LINT.house when it is loaded, the same rules otherwise) ---------- */
  const house = s => { if (s == null) return s; if (typeof LINT !== 'undefined' && LINT && typeof LINT.house === 'function') return LINT.house(s); return String(s).replace(/\s*[—–―]\s*/g, ', ').replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 to $2').replace(/(\w)-(\w)/g, '$1 $2').replace(/[‐-―−]/g, ' ').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim(); };
  const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  const words = s => (strip(s).match(/\S+/g) || []).length;
  const firstSentence = s => { const m = String(s).match(/^[\s\S]*?[.!?](?=\s|$)/); return (m ? m[0] : String(s)).trim(); };
  const slugify = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const listAnd = (a, and) => { a = (a || []).filter(Boolean); and = and || 'and'; return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' ' + and + ' ' + a[a.length - 1]; };

  /* ---------- the law: every statutory number a page may print, with its cite (grade A unless marked) ---------- */
  const FC = 'Texas Family Code';
  const LAW = {
    wait: { v: '60 days', es: '60 días', l: 'the earliest a Texas court can grant a divorce after the petition is filed, except in some family violence cases', les: 'como mínimo entre la petición y el decreto de divorcio, salvo algunos casos de violencia familiar', c: FC + ' § 6.702' },
    res: { v: '6 months', es: '6 meses', l: 'of Texas residence for one spouse before a divorce is filed, with 90 days in the county of filing', c: FC + ' § 6.301' },
    res90: { v: '90 days', es: '90 días', l: 'of residence in the county where the divorce is filed', c: FC + ' § 6.301' },
    just: { v: 'Just and right', es: 'Justa y equitativa', l: 'is the standard Texas courts use to divide the community estate; it does not require an even split', c: FC + ' § 7.001' },
    comm: { v: 'Community', l: 'property is presumed for everything either spouse holds when the marriage ends; separate property must be proved by clear and convincing evidence', c: FC + ' § 3.003' },
    sep: { v: 'Separate', l: 'property, meaning what a spouse owned before marriage or received by gift or inheritance, is not divided', c: FC + ' § 3.001' },
    reimb: { v: 'Reimbursement', l: 'claims let one marital estate recover what it paid toward another, under an equitable standard', c: FC + ' ch. 3, subch. E' },
    cap: { v: '$11,700', w: 'since September 1, 2025', l: 'a month: the cap on net resources used for guideline child support since September 1, 2025', les: 'al mes: el tope de ingresos netos para la manutención de menores según las guías desde el 1 de septiembre de 2025', c: FC + ' § 154.125 and the Attorney General adjustment' },
    cap1: { v: '$2,340', l: 'a month: guideline support for one child when net resources are at the cap', c: FC + ' § 154.125' },
    pct: { v: '20%', l: 'of monthly net resources for one child; 25% for two, 30% for three, 35% for four, 40% for five and at least 40% for six or more', c: FC + ' § 154.125' },
    pcts: { v: 'Guidelines', rows: [['One child', '20%'], ['Two children', '25%'], ['Three children', '30%'], ['Four children', '35%'], ['Five children', '40%'], ['Six or more children', 'At least 40%']], l: 'percentage of the paying parent\'s monthly net resources by the number of children before the court', c: FC + ' § 154.125' },
    jmc: { v: 'Joint', l: 'managing conservatorship is presumed to be in the child\'s best interest; it shares rights and duties and does not set an even division of time', c: FC + ' § 153.131' },
    best: { v: 'Best interest', l: 'of the child is the primary consideration in every conservatorship and possession decision', c: FC + ' § 153.002' },
    espo: { v: '50 miles', es: '50 millas', l: 'parents who live within this distance get the expanded standard possession order by default, unless the parent elects otherwise or the court finds it is not in the child\'s best interest', c: FC + ' § 153.3171' },
    child12: { v: '12', l: 'or older: on request in a case tried without a jury, the judge must interview the child in chambers; the child\'s wishes are considered but do not decide the case', c: FC + ' § 153.009' },
    maint: { v: '$5,000', l: 'a month, or 20% of the paying spouse\'s average monthly gross income if that is less, is the most spousal maintenance a court can order', c: FC + ' § 8.055' },
    maintpct: { v: '20%', l: 'of average monthly gross income, the alternative maintenance cap when it is lower', c: FC + ' § 8.055' },
    maint10: { v: '10 years', l: 'of marriage is the usual threshold for court ordered spousal maintenance, with proof the spouse cannot meet minimum reasonable needs; family violence and disability are separate routes', c: FC + ' § 8.051' },
    maintdur: { v: '5, 7 or 10 years', l: 'the usual longest maintenance for marriages of 10 to 20, 20 to 30, and 30 or more years; some disabilities allow longer', c: FC + ' § 8.054' },
    mod3: { v: '3 years', es: '3 años', l: 'after the last support order, support can be modified when guideline support differs by 20% or $100 a month; otherwise a material and substantial change is needed', c: FC + ' § 156.401' },
    mod3pct: { v: '20%', l: 'difference from guideline support that allows a review after three years', c: FC + ' § 156.401' },
    mod3amt: { v: '$100', l: 'a month difference from guideline support that allows a review after three years', c: FC + ' § 156.401' },
    modcust: { v: 'Material change', l: 'a material and substantial change since the last order, plus the child\'s best interest, is the usual test to modify conservatorship or possession', c: FC + ' § 156.101' },
    interest: { v: '6%', l: 'simple interest a year accrues on unpaid child support', c: FC + ' § 157.265' },
    indep: { v: 'Independent', l: 'duties: unpaid support does not justify denying possession, and denied possession does not justify withholding support', c: FC + ' § 105.006(e)' },
    podef: { v: 'Family violence', l: 'must be found by the court before it grants a protective order', c: FC + ' ch. 85' },
    po2: { v: '2 years', es: '2 años', l: 'the usual longest term the court sets for a final protective order; some orders run longer', c: FC + ' § 85.025' },
    posapcr: { v: '2 years after the decree', es: '2 años después del decreto', l: 'how long an order tied to a pending divorce or custody case can run, since September 2025', c: FC + ' § 85.025 and SB 1120 (2025)' },
    exparte: { v: '20 days', es: '20 días', l: 'how long a temporary ex parte protective order lasts unless the court extends it', c: FC + ' § 83.002' },
    poviolate: { v: 'A crime', l: 'violating a protective order is a criminal offense', c: 'Texas Penal Code § 25.07' },
    e911: { v: '911', l: 'the emergency number to call first when anyone is in danger', c: 'Emergency services' },
    adv14: { v: '14 days', es: '14 días', l: 'after a removal, the deadline for the full adversary hearing in a CPS case', c: FC + ' § 262.201' },
    cps1: { v: '1 year', es: '1 año', l: 'after the temporary order, the deadline to finish a CPS case unless the court grants an extension', c: FC + ' § 263.401' },
    counsel: { v: 'Appointed', l: 'counsel is available to a parent who cannot afford a lawyer and opposes a termination suit filed by the state', c: FC + ' § 107.013' },
    adopt12: { v: '12', l: 'or older: a child must consent to the adoption unless the court waives it', c: FC + ' § 162.010' },
    adopt6: { v: '6 months', es: '6 meses', l: 'the child usually must live with the adopting parent before the adoption is granted, unless the court waives it', c: FC + ' § 162.009' },
    term: { v: 'Termination', l: 'of the other parent\'s rights, by consent or court order, comes before a stepparent or relative adoption', c: FC + ' ch. 161' },
    prenup: { v: 'In writing', l: 'and signed by both parties: a premarital agreement takes effect on marriage and is enforced unless signed involuntarily, or unconscionable when signed without fair disclosure', c: FC + ' §§ 4.002, 4.006' },
    prenupcs: { v: 'Protected', l: 'a child\'s right to support cannot be reduced by a premarital agreement', c: FC + ' § 4.003' },
    partition: { v: 'Partition', l: 'spouses who are already married can partition or exchange community property by a written agreement', c: FC + ' § 4.102' },
    paternity: { v: 'Paternity', l: 'established by a signed acknowledgment or a court order is what gives an unmarried father parental rights', c: FC + ' ch. 160' },
    oag: { v: 'Attorney General', l: 'the Office of the Attorney General runs most Texas child support cases, and its lawyers represent the state, not either parent', c: FC + ' ch. 231' },
    milres: { v: '6 months', l: 'stationed in Texas lets a service member file a divorce here, with 90 days in the county; Texans serving elsewhere keep Texas residence', c: FC + ' §§ 6.303, 6.304' },
    usfspa: { v: 'Retired pay', l: 'military retired pay earned during the marriage can be divided as property under federal law', c: '10 U.S.C. § 1408' },
    scra: { v: 'Stay', l: 'the Servicemembers Civil Relief Act lets a court pause a case when military duty keeps a service member from taking part', c: '50 U.S.C. § 3932' },
    deploy: { v: 'Deployment', l: 'rules let a deployed parent designate a person to exercise periods of possession while away', c: FC + ' ch. 153, subch. L' },
    qdro: { v: 'QDRO', l: 'a qualified domestic relations order is the court order that divides a workplace retirement plan', c: '29 U.S.C. § 1056(d)(3)' },
    ss: { v: 'Not divided', l: 'Social Security benefits are governed by federal law and are not divided by a Texas court', c: '42 U.S.C. § 407' },
    informal: { v: 'No minimum', l: 'time: an informal marriage rests on an agreement to be married, living together in Texas as spouses and presenting as married', c: FC + ' § 2.401' },
    standing: { v: 'Standing orders', l: 'in many Texas counties apply to both parties as soon as a divorce or custody case is filed', c: 'Local rules of each county', g: 'B' },
    agreed: { v: '2 to 4 months', es: '2 a 4 meses', l: 'the usual length of an agreed divorce, a practice estimate and not a rule', c: 'Practice estimate', g: 'C' },
    contested: { v: '9 to 24 months', l: 'the usual length of a contested divorce, depending on the docket and the issues; a practice estimate', c: 'Practice estimate', g: 'C' },
    gray50: { v: '50', l: 'the age from which Severance counts a divorce as a gray divorce', c: 'Severance service line definition', g: 'B' },
    r702: { v: 'Rule 7.02(a)', l: 'every lawyer advertisement names a responsible lawyer and the lawyer\'s primary practice location', c: 'Texas Disciplinary Rules of Professional Conduct' }
  };
  /* where the numbers come from (printed beside each figure) */
  function SRC(V) {
    V = V || {};
    return {
      oca: `Texas Office of Court Administration, court activity reports through ${V.through || 'the latest month'}`,
      acs: 'U.S. Census Bureau, American Community Survey 2020 to 2024',
      cbp: 'U.S. Census Bureau, County Business Patterns 2023',
      alloc: 'Estimate from Office of Court Administration filings and Census data',
      firm: V.brand || 'the firm',
      bar: 'State Bar of Texas',
      tbls: 'Texas Board of Legal Specialization',
      ocaEs: `Oficina de Administración de Tribunales de Texas, informes hasta ${V.throughEs || V.through || 'el último mes'}`
    };
  }

  /* ---------- template fill: {key} from V, {law.key} or {law.key.c|l|w|es} from LAW ---------- */
  function val(k, V) {
    if (V && Object.prototype.hasOwnProperty.call(V, k)) { const x = V[k]; if (x === '') return ''; if (x != null && typeof x !== 'object') return String(x); }
    const m = k.match(/^law\.(\w+)(?:\.(\w+))?$/); if (!m) return null;
    const e = LAW[m[1]]; if (!e) return null; const f = m[2] || 'v'; return e[f] != null && typeof e[f] !== 'object' ? String(e[f]) : null;
  }
  function fill(t, V, missing) {
    if (t == null || typeof t !== 'string') return t;
    return t.replace(/\{([a-zA-Z_][\w.]*)\}/g, (m, k) => { const v = val(k, V); if (v != null) return v; if (missing && !missing.includes(k)) missing.push(k); return ''; })
      .replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').replace(/\(\s*\)/g, '').replace(/,\s*\./g, '.').trim();
  }
  function fillDeep(x, V, missing) { if (typeof x === 'string') return fill(x, V, missing); if (Array.isArray(x)) return x.map(y => fillDeep(y, V, missing)); if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = fillDeep(x[k], V, missing); return o; } return x; }
  const has = (V, ...ks) => ks.every(k => V && V[k] != null && V[k] !== '');

  /* ---------- consultation steps ---------- */
  const STEPS = {
    consult: [
      { title: 'Book a consultation', text: 'Call {phone} or use the form. Tell us the county, the kind of case and any court dates already set.' },
      { title: 'The consultation', text: 'A lawyer listens, explains how Texas law applies to your situation and answers your questions. {consultLine}' },
      { title: 'A written fee agreement', text: 'If you hire the firm, you get a written agreement that says what the representation covers before any work starts.' },
      { title: 'Next steps and dates', text: 'We prepare the papers, tell you each date the court sets and what it means, and keep you informed as the case moves.' }],
    divorce: [
      { title: 'Book a consultation', text: 'Call {phone} or use the form. Tell us the county where you live, whether there are children and any court dates already set.' },
      { title: 'Plan the case', text: 'We go through the children, the property, the debts and any safety concerns, and decide whether temporary orders are needed while the case is pending.' },
      { title: 'File and serve', text: 'The petition is filed in the right county, the other spouse is served or signs a waiver, and the waiting period starts.' },
      { title: 'Agreement or trial', when: 'No sooner than {law.wait} after filing', text: 'Many cases settle by agreement or in mediation; the rest are decided at a final trial. Either way the court signs a final decree.' }],
    custody: [
      { title: 'Book a consultation', text: 'Call {phone} or use the form. Tell us where the child lives now, any existing orders and any court dates.' },
      { title: 'Know what you are asking for', text: 'Conservatorship covers parental rights and duties, possession and access covers the schedule, and child support is set by the guidelines.' },
      { title: 'File or respond', text: 'We file the petition or the answer, and ask for temporary orders when the child needs a schedule while the case is pending.' },
      { title: 'Mediation or trial', text: 'Many Texas courts order mediation before a final trial. An agreement the court approves becomes the order.' }],
    protect: [
      { title: 'Safety first', text: 'If you are in danger now, call {law.e911}. Then call {phone} or use the form when it is safe to do so.' },
      { title: 'The application', text: 'We prepare the application and the sworn statement the court reads, with the dates and details of what happened.' },
      { title: 'Temporary order', when: 'Up to {law.exparte} unless extended', text: 'The court can sign a temporary ex parte order without notice to the other side when it finds a clear and present danger.' },
      { title: 'The hearing', text: 'Both sides can present evidence, and the court decides whether to grant a final protective order and what it requires.' }],
    respond: [
      { title: 'Read the papers', text: 'Follow every term of any order from the moment you are served, and note the hearing date and time.' },
      { title: 'Book a consultation', text: 'Call {phone} or use the form right away, and bring everything you were served with.' },
      { title: 'Prepare the response', text: 'We gather the messages, records and witnesses that answer the application.' },
      { title: 'The hearing', text: 'Both sides present evidence and the court decides whether an order is granted and what it covers.' }],
    cps: [
      { title: 'Call right away', text: 'Call {phone} or use the form. A removal starts short deadlines, beginning with the full adversary hearing within {law.adv14}.' },
      { title: 'Before the hearing', text: 'We read the removal affidavit and the department\'s reasons, and gather records, witnesses and family placement options.' },
      { title: 'The adversary hearing', when: 'Within {law.adv14} of the removal', text: 'The court decides whether the child returns home or stays in the department\'s care while the case goes on.' },
      { title: 'The service plan', when: 'About {law.cps1} to finish', text: 'We go through each task in the plan, the review hearings and the deadline to finish the case.' }],
    adopt: [
      { title: 'Book a consultation', text: 'Call {phone} or use the form. Tell us who is adopting, the child\'s age and where the other parent is.' },
      { title: 'Consents and termination', text: 'The other parent\'s rights end by signed relinquishment or by court order, and the child gives consent when old enough.' },
      { title: 'Studies and checks', text: 'The court orders the social study and criminal history checks it needs before the final hearing.' },
      { title: 'Final hearing', when: 'After {law.adopt6} in the home, unless waived', text: 'The judge signs the adoption order, and a new birth certificate can be requested.' }],
    agree: [
      { title: 'Book a consultation', text: 'Call {phone} or use the form, ideally months before the wedding date.' },
      { title: 'Disclosure', text: 'Each side lists assets, debts and income, which is what keeps the agreement enforceable later.' },
      { title: 'Drafting and separate advice', text: 'We draft or read the agreement for one party; the other party has their own lawyer.' },
      { title: 'Signing', text: 'Both parties sign in writing with time to spare before the wedding.' }],
    enforce: [
      { title: 'Book a consultation', text: 'Call {phone} or use the form, and bring the order you want enforced.' },
      { title: 'Document each violation', text: 'Payment records, a calendar of missed or denied possession periods and the messages around them.' },
      { title: 'File the motion', text: 'The motion lists each violation by date and the relief asked for: arrears, a money judgment, withholding or contempt.' },
      { title: 'The hearing', text: 'The court decides which violations are proved and orders the remedy.' }]
  };

  /* ---------- practice area copy, one entry per LINE_META key ---------- */
  const LINES = {
    div_k: { nm: 'Divorce with children', short: 'Divorce with children', slug: 'divorce-with-children', lp: 'divorce-children',
      h1n: 'Divorce With Children in Texas', h1: 'Divorce Lawyer for Parents in {city}', eyebrow: 'Divorce with children',
      lede: 'When a divorce involves children, the decree sets conservatorship, the possession schedule and child support along with the property division. {brand} explains how Texas courts decide each one and what your case will need.',
      aq: 'How does a Texas divorce with children work?',
      answer: 'A Texas divorce with children decides four things: who holds which parental rights and duties (conservatorship), the schedule each parent has with the children (possession and access), child support, and the division of the community estate. The court cannot grant the divorce until {law.wait} after the petition is filed. Joint managing conservatorship is presumed, but it does not mean an even division of time, and the child\'s best interest decides every custody question.',
      areaFact: 'In {areaCounties}, {a_divk} divorce petitions involving children were filed in {period}.',
      facts: ['a_divk', 'law.wait', 'law.cap', 'law.espo'],
      what: '<p>What the decree decides when there are children:</p><ul><li><strong>Conservatorship:</strong> joint or sole managing conservatorship, and which parent has the right to designate the primary residence, often within a geographic restriction.</li><li><strong>Possession and access:</strong> the standard or expanded standard possession order, or a schedule the parents agree on. Parents within {law.espo} get the expanded schedule by default.</li><li><strong>Child support:</strong> {law.pct} of the paying parent\'s monthly net resources for one child, more for more children, with net resources counted up to {law.cap} a month.</li><li><strong>Medical and dental support:</strong> who covers the children\'s insurance and how uninsured costs are shared.</li><li><strong>Property and debts:</strong> the community estate is divided in a manner that is just and right.</li><li><strong>Temporary orders:</strong> the rules for the family while the case is pending.</li></ul>',
      who: '<p>Before the consultation, gather recent pay stubs and tax returns for both spouses if you have them, a list of accounts, debts and property, and the children\'s school and medical information. Write down the schedule the children follow now and any safety concerns. Ask before moving the children or changing their school: many Texas counties have standing orders that apply to both parents as soon as a case is filed.</p>',
      steps: 'divorce',
      faq: [
        { q: 'How long does a divorce with children take in Texas?', a: 'The court cannot grant it until {law.wait} after filing. Agreed cases usually take {law.agreed}; contested cases take longer, depending on the county\'s docket and how many issues are disputed.' },
        { q: 'What is joint managing conservatorship?', a: 'It is the Texas presumption: both parents share most rights and duties. One parent usually holds the right to designate the primary residence, and the possession schedule is set separately, so joint conservatorship does not mean the children spend the same number of days with each parent.' },
        { q: 'How is child support calculated?', a: 'Guideline support is {law.pct} of the paying parent\'s monthly net resources for one child, more for additional children, with net resources counted up to {law.cap} a month {law.cap.w}.' },
        { q: 'Does a child get a say in custody?', a: 'On request in a case tried without a jury, the judge must interview a child {law.child12} or older in chambers, and may interview a younger child. The child\'s wishes are one factor; they do not decide the case.' },
        { q: 'Can we agree on everything?', a: 'Yes. Spouses who agree can sign an agreed decree, and the judge approves the terms about the children if they are in the children\'s best interest.' }],
      related: ['sapcr', 'mod', 'div_nk'], band: 'Talk with a lawyer about divorce with children.',
      tok: ['divorce', 'custody', 'children', 'child', 'parent'],
      es: { h: 'Abogado de divorcio con hijos en {city}', e: 'Divorcio con hijos · {city}', d: 'Divorcio, custodia y manutención de menores en Texas. Hable con un abogado sobre su caso en {city}.', d2: 'Cuéntenos lo básico. Le llamamos para fijar la consulta.',
        aq: '¿Cómo funciona un divorcio con hijos en Texas?', answer: 'El decreto de divorcio decide la custodia (la ley de Texas la llama tutela), el horario de posesión y acceso, la manutención de menores y la división de los bienes. El juez no puede conceder el divorcio antes de {law.wait.es} después de presentar la petición. La tutela compartida no significa que los hijos pasen el mismo número de días con cada padre; el interés del niño decide cada asunto.',
        fact: 'k_divk', factL: 'peticiones de divorcio con hijos presentadas en el condado de {county} en {k_whenEs}',
        faq: [{ q: '¿Cuánto tarda un divorcio en Texas?', a: 'El juez no puede conceder el divorcio antes de {law.wait.es} después de presentar la petición. Un divorcio de mutuo acuerdo suele tardar {law.agreed.es}.' }, { q: '¿Cómo se calcula la manutención de menores?', a: 'Es un porcentaje de los ingresos netos mensuales del padre que paga: {law.pct} para un hijo, con ingresos netos contados hasta {law.cap} al mes.' }, { q: '¿Qué es la posesión y acceso?', a: 'Es el horario que cada padre pasa con los hijos. Puede ser el horario estándar, el horario estándar ampliado o uno que los padres acuerden.' }] } },

    div_nk: { nm: 'Divorce without children', short: 'Divorce', slug: 'divorce-lawyer', lp: 'divorce',
      h1n: 'Divorce Without Children in Texas', h1: 'Divorce Lawyer in {city}', eyebrow: 'Divorce without children',
      lede: 'For spouses without children at home, a Texas divorce is about the community estate: the house, accounts, retirement, debts and any claim for spousal maintenance. {brand} explains the process, the timeline and the fee in writing.',
      aq: 'How does a Texas divorce without children work?',
      answer: 'The petition is filed in a county where one spouse has lived for at least {law.res90}, after at least {law.res} in Texas. The court cannot grant the divorce until {law.wait} after filing. Texas divides the community estate in a manner that is just and right, which does not require an even split, and separate property is not divided.',
      areaFact: 'In {areaCounties}, {a_divnk} divorce petitions without children were filed in {period}.',
      facts: ['a_divnk', 'law.wait', 'law.just', 'law.res'],
      what: '<p>What a divorce without children covers:</p><ul><li><strong>Agreed or contested:</strong> spouses who agree sign an agreed decree; the rest negotiate, mediate or go to trial.</li><li><strong>The community estate:</strong> property either spouse holds at the end of the marriage is presumed community and is divided in a manner that is just and right.</li><li><strong>Separate property:</strong> what a spouse owned before marriage or received by gift or inheritance is not divided, but it has to be proved.</li><li><strong>Debts:</strong> who pays which debt, and what happens to joint accounts and cards.</li><li><strong>Retirement:</strong> the community share of plans and pensions, divided by a qualified domestic relations order where needed.</li><li><strong>Spousal maintenance:</strong> limited by statute; spouses can also agree to contractual payments.</li></ul>',
      who: '<p>Bring a list of what you own and owe, with recent statements for bank, retirement and investment accounts, the house and vehicles, and the last two tax returns if you have them. Note anything you owned before the marriage or received as a gift or inheritance, and any records that trace it.</p>',
      steps: 'divorce',
      faq: [
        { q: 'How long does a divorce take in Texas?', a: 'No divorce can be granted until {law.wait} after filing. Agreed cases usually take {law.agreed}; contested cases often take {law.contested}, depending on the docket and the issues.' },
        { q: 'Does Texas split property evenly?', a: 'Not necessarily. Courts divide the community estate in a manner that is just and right, which can be unequal, considering factors such as earning capacity, fault in the breakup and the size of each spouse\'s separate estate. Separate property is not divided.' },
        { q: 'Can I get spousal maintenance?', a: 'Court ordered maintenance is limited. The usual route needs a marriage of {law.maint10} or more and proof that the spouse cannot meet minimum reasonable needs, and the amount is capped at {law.maint} a month or {law.maintpct} of average monthly gross income, whichever is less. Spouses can also agree to contractual payments.' },
        { q: 'Do we both need lawyers?', a: 'A lawyer can represent only one spouse. The other spouse can hire a lawyer or represent themselves, and an agreed decree can still be signed.' },
        { q: 'Where do I file?', a: 'In a county where you or your spouse has lived for at least {law.res90}, after at least {law.res} in Texas.' }],
      related: ['high', 'gray', 'prenup'], band: 'Talk with a lawyer about a Texas divorce.',
      tok: ['divorce', 'uncontested', 'agreed', 'property'],
      es: { h: 'Abogado de divorcio en {city}', e: 'Divorcio · {city}', d: 'Divorcio en Texas, de mutuo acuerdo o con disputa. Hable con un abogado sobre los bienes, las deudas y el proceso.', d2: 'Cuéntenos lo básico. Le llamamos para fijar la consulta.',
        aq: '¿Cómo funciona un divorcio en Texas?', answer: 'Uno de los cónyuges debe haber vivido en Texas {law.res.es} y en el condado {law.res90.es} antes de presentar la petición. El juez no puede conceder el divorcio antes de {law.wait.es} después de presentarla. Texas divide los bienes gananciales de manera justa y equitativa, y la división puede ser desigual; los bienes propios no se dividen.',
        fact: 'k_div', factL: 'peticiones de divorcio presentadas en el condado de {county} en {k_whenEs}',
        faq: [{ q: '¿Cuánto tarda un divorcio en Texas?', a: 'El juez no puede conceder el divorcio antes de {law.wait.es} después de presentar la petición. Un divorcio de mutuo acuerdo suele tardar {law.agreed.es}.' }, { q: '¿Cómo se dividen los bienes?', a: 'El tribunal divide los bienes gananciales de manera justa y equitativa, y la división puede ser desigual. Los bienes propios no se dividen.' }, { q: '¿Necesitamos un abogado cada uno?', a: 'Un abogado solo puede representar a uno de los cónyuges. El otro puede contratar su propio abogado.' }] } },

    sapcr: { nm: 'Child custody and paternity', short: 'Child custody', slug: 'child-custody-lawyer', lp: 'custody',
      h1n: 'Child Custody and Paternity in Texas', h1: 'Child Custody Lawyer in {city}', eyebrow: 'Custody, paternity and SAPCR',
      lede: 'For parents who are not married to each other, or who need custody orders without a divorce, a suit affecting the parent child relationship sets conservatorship, possession and access, and child support.',
      aq: 'What is a SAPCR?',
      answer: 'A suit affecting the parent child relationship, or SAPCR, is the Texas case that creates or changes orders about a child: conservatorship, possession and access, and child support. When parents are not married, a father\'s legal rights rest on a signed acknowledgment of paternity or a court order. The child\'s best interest decides every custody question.',
      areaFact: 'In {areaCounties}, {a_sapcr} custody suits were filed outside a divorce in {period}.',
      facts: ['a_sapcr', 'law.jmc', 'law.paternity', 'law.child12'],
      what: '<p>What a custody case decides:</p><ul><li><strong>Conservatorship:</strong> the rights and duties each parent holds, and which parent has the right to designate the primary residence.</li><li><strong>Geographic restriction:</strong> a limit on where the primary residence can be, often the county and its neighbors.</li><li><strong>Possession and access:</strong> the schedule each parent has, from the standard possession order to a schedule built for the family.</li><li><strong>Paternity:</strong> an acknowledgment of paternity or genetic testing and a court order.</li><li><strong>Child support and medical support:</strong> set by the statewide guidelines.</li></ul>',
      who: '<p>Bring any existing orders, the child\'s birth certificate and any acknowledgment of paternity, school and medical records, and a calendar of where the child has lived and with whom. Keep messages with the other parent in writing and civil; judges read them.</p>',
      steps: 'custody',
      faq: [
        { q: 'Do fathers have the same rights as mothers in Texas?', a: 'Texas law does not prefer either parent because of sex. An unmarried father first needs paternity established, by a signed acknowledgment or a court order, before a court can name him a conservator.' },
        { q: 'What does the right to designate the primary residence mean?', a: 'It is the right to decide where the child primarily lives, usually within a geographic area the order sets. The other parent has possession under the schedule in the order.' },
        { q: 'Does a child get a say in which home is primary?', a: 'On request in a case tried without a jury, the judge must interview a child {law.child12} or older in chambers. The child\'s wishes are considered, and the child\'s best interest decides.' },
        { q: 'Do we need a court order if we get along?', a: 'Without an order, neither parent has enforceable rights to a schedule or support. An agreed order the court signs gives both parents certainty.' }],
      related: ['mod', 'ivd', 'enf'], band: 'Talk with a lawyer about custody.',
      tok: ['custody', 'sapcr', 'paternity', 'father', 'conservatorship', 'parent'],
      es: { h: 'Abogado de custodia en {city}', e: 'Custodia y paternidad · {city}', d: 'Custodia, paternidad y manutención de menores para padres en Texas. Hable con un abogado sobre su caso en {city}.', d2: 'Cuéntenos lo básico. Le llamamos para fijar la consulta.',
        aq: '¿Qué es una demanda de custodia en Texas?', answer: 'Una demanda que afecta la relación entre padres e hijos (SAPCR) fija la custodia, el horario de posesión y acceso y la manutención de menores. Si los padres no están casados, los derechos del padre dependen de un reconocimiento de paternidad firmado o de una orden judicial. El interés del niño decide cada asunto.',
        fact: 'k_sapcr', factL: 'demandas de custodia presentadas fuera de un divorcio en el condado de {county} en {k_whenEs}',
        faq: [{ q: '¿Los padres tienen los mismos derechos que las madres?', a: 'La ley de Texas no prefiere a ningún padre por su sexo. Si los padres no están casados, primero se establece la paternidad.' }, { q: '¿Qué es la posesión y acceso?', a: 'Es el horario que cada padre pasa con el niño según la orden del tribunal.' }, { q: '¿Necesitamos una orden si nos llevamos bien?', a: 'Sin una orden, ningún padre tiene derechos exigibles a un horario o a la manutención de menores.' }] } },

    mod: { nm: 'Order modification', short: 'Modification', slug: 'custody-support-modification', lp: 'modification',
      h1n: 'Modifying a Custody or Child Support Order in Texas', h1: 'Order Modification Lawyer in {city}', eyebrow: 'Modification · custody, possession and support',
      lede: 'Jobs change, children grow and parents move. A Texas order can be changed when the legal test is met; {brand} explains what that test is and what it takes to meet it.',
      aq: 'When can a Texas custody or support order be changed?',
      answer: 'Conservatorship and possession can be modified when circumstances have materially and substantially changed since the last order and the change is in the child\'s best interest. Child support can also be modified when {law.mod3} have passed and guideline support differs from the ordered support by {law.mod3pct} or {law.mod3amt} a month. Until a court signs a new order, the old one still applies.',
      areaFact: 'In {areaCounties}, {a_mod} modification suits were filed in {period}.',
      facts: ['a_mod', 'law.mod3', 'law.modcust', 'law.cap'],
      what: '<p>Common modifications:</p><ul><li><strong>Support after a change in income:</strong> a job loss, a new job or a raise.</li><li><strong>The primary residence:</strong> which parent the child primarily lives with.</li><li><strong>Relocation:</strong> a move outside the geographic restriction.</li><li><strong>The possession schedule:</strong> a schedule that no longer fits the child\'s age or the parents\' work.</li><li><strong>Agreed modifications:</strong> parents who agree can ask the court to sign a new order.</li></ul>',
      who: '<p>Bring the current order, proof of the income change or other change in circumstances, and a short timeline of what has happened since the last order. Keep following the existing order until a court changes it; an informal agreement between parents does not change a court order.</p>',
      steps: 'custody',
      faq: [
        { q: 'Can I lower child support after losing my job?', a: 'You can ask the court. A material and substantial change in income can support a modification, and a change usually reaches back only to when the other parent was served with the suit, so file promptly.' },
        { q: 'Does an agreement with the other parent change the order?', a: 'Not until a court signs it. Until then, the existing order is the one a court enforces.' },
        { q: 'When can child support be reviewed without a big change?', a: 'When {law.mod3} have passed since the last order and guideline support differs from the ordered support by {law.mod3pct} or {law.mod3amt} a month.' },
        { q: 'Can the primary residence change?', a: 'Yes, when circumstances have materially and substantially changed and the change is in the child\'s best interest.' }],
      related: ['sapcr', 'enf', 'ivd'], band: 'Talk with a lawyer about changing your order.',
      tok: ['modification', 'modify', 'change', 'relocation'],
      es: { h: 'Modificación de órdenes de custodia en {city}', e: 'Modificación · {city}', d: 'Cambie una orden de custodia o de manutención de menores en Texas cuando su situación cambia. Hable con un abogado.', d2: 'Cuéntenos lo básico. Le llamamos para fijar la consulta.',
        aq: '¿Cuándo se puede cambiar una orden en Texas?', answer: 'Una orden de custodia o de manutención de menores se puede modificar cuando las circunstancias cambian de manera material y sustancial y el cambio conviene al niño. La manutención también se puede revisar después de {law.mod3.es} si la manutención según las guías difiere de la ordenada en {law.mod3pct} o {law.mod3amt} al mes. Hasta que el tribunal firme una nueva orden, la anterior sigue vigente.',
        fact: 'k_mod', factL: 'demandas de modificación presentadas en el condado de {county} en {k_whenEs}',
        faq: [{ q: '¿Puedo bajar la manutención de menores si perdí el trabajo?', a: 'Puede pedirlo al tribunal. Presente la demanda pronto, porque el cambio suele aplicarse desde la notificación al otro padre.' }, { q: '¿Un acuerdo con el otro padre cambia la orden?', a: 'No hasta que el tribunal lo firme.' }, { q: '¿Se puede cambiar con quién vive el niño?', a: 'Sí, cuando hay un cambio material y sustancial y el cambio conviene al niño.' }] } },

    enf: { nm: 'Order enforcement', short: 'Enforcement', slug: 'child-support-custody-enforcement', lp: 'enforcement',
      h1n: 'Enforcing Child Support and Possession Orders in Texas', h1: 'Order Enforcement Lawyer in {city}', eyebrow: 'Enforcement · support, possession and property',
      lede: 'When a parent does not pay ordered support or does not follow the possession schedule, a Texas court can enforce the order through a money judgment, income withholding and contempt.',
      aq: 'How is a Texas custody or support order enforced?',
      answer: 'A motion for enforcement lists each violation of the order by date. For unpaid child support, the court can confirm the arrears, render a judgment, order income withholding and, after a hearing, hold the parent in contempt. Unpaid support accrues {law.interest} simple interest a year. Paying support and allowing possession are independent duties, so one parent\'s violation does not excuse the other\'s.',
      areaFact: 'In {areaCounties}, {a_enf} enforcement suits were filed in {period}.',
      facts: ['a_enf', 'law.interest', 'law.indep', 'law.cap'],
      what: '<p>What can be enforced:</p><ul><li><strong>Child support arrears:</strong> confirmed by the court, with interest, a judgment and withholding from wages.</li><li><strong>Possession and access:</strong> missed or denied periods of possession under the order.</li><li><strong>Medical support:</strong> unpaid insurance and uninsured medical costs the order assigns.</li><li><strong>The property division:</strong> a decree that has not been carried out.</li></ul>',
      who: '<p>Bring the order, the payment history from the Texas State Disbursement Unit or your own records, and a calendar of each missed or denied possession period with the messages around it.</p>',
      steps: 'enforce',
      faq: [
        { q: 'If support is not paid, can I refuse possession?', a: 'No. Support and possession are independent duties under Texas law; refusing a period of possession over unpaid support can itself violate the order.' },
        { q: 'Is there a deadline to collect back child support?', a: 'Texas allows back support to be confirmed and collected long after the support duty ends, within deadlines set in the Family Code. Bring your dates to the consultation.' },
        { q: 'What happens at a contempt hearing?', a: 'The court decides whether each violation is proved and can order jail time, fines, payment of the arrears and attorney\'s fees.' },
        { q: 'Does unpaid support earn interest?', a: 'Yes. Unpaid child support accrues {law.interest} simple interest a year.' }],
      related: ['mod', 'ivd', 'sapcr'], band: 'Talk with a lawyer about enforcing your order.',
      tok: ['enforcement', 'enforce', 'contempt', 'arrears', 'back-child-support'],
      es: { h: 'Hacer cumplir órdenes de custodia en {city}', e: 'Hacer cumplir la orden · {city}', d: 'Si el otro padre no paga la manutención de menores o no respeta la posesión y acceso, el tribunal puede hacer cumplir la orden.', d2: 'Cuéntenos lo básico. Le llamamos para fijar la consulta.',
        aq: '¿Cómo se hace cumplir una orden en Texas?', answer: 'Si el otro padre no paga la manutención de menores o no respeta el horario de posesión y acceso, el tribunal puede hacer cumplir la orden con una sentencia por lo adeudado, la retención de salario y el desacato. La manutención atrasada acumula {law.interest} de interés simple al año. Pagar la manutención y permitir la posesión son deberes independientes.',
        fact: 'k_enf', factL: 'demandas para hacer cumplir órdenes presentadas en el condado de {county} en {k_whenEs}',
        faq: [{ q: 'Si no paga la manutención, ¿puedo negar la posesión?', a: 'No. Pagar la manutención y permitir la posesión y acceso son deberes independientes.' }, { q: '¿La manutención atrasada genera interés?', a: 'Sí, {law.interest} de interés simple al año.' }, { q: '¿Qué debo traer a la consulta?', a: 'La orden, el historial de pagos y un calendario de cada período de posesión negado.' }] } },

    po: { nm: 'Protective orders', short: 'Protective orders', slug: 'protective-order-lawyer', lp: 'protective-order',
      h1n: 'Protective Orders in Texas', h1: 'Protective Order Lawyer in {city}', eyebrow: 'Protective orders · applicants and respondents',
      lede: 'A protective order is the Texas court order for family violence. {brand} helps people ask for one and people who have been served with an application respond.',
      aq: 'How does a Texas protective order work?',
      answer: 'An application asks the court to find that family violence occurred and to order the respondent to stay away and stop contact. The court can sign a temporary ex parte order without notice, good for up to {law.exparte} unless extended, and then holds a hearing where both sides can present evidence. The court sets the term of a final protective order: up to {law.po2} in most cases, and an order tied to a pending divorce or custody case can run until {law.posapcr}. If anyone is in danger now, call {law.e911}.',
      areaFact: 'In {areaCounties}, {a_po} protective order cases were filed in {period}.',
      facts: ['a_po', 'law.exparte', 'law.posapcr', 'law.poviolate'],
      what: '<p>For applicants:</p><ul><li><strong>The application:</strong> a sworn statement of what happened and when, filed in the county where either party lives.</li><li><strong>The temporary order:</strong> signed without notice when the court finds a clear and present danger, good for up to {law.exparte} unless extended.</li><li><strong>The hearing and the final order:</strong> stay away terms, no contact, and terms about the children and the home.</li></ul><p>For respondents:</p><ul><li><strong>Follow the order from service:</strong> violating a protective order is a criminal offense.</li><li><strong>What is at stake:</strong> an order can limit firearm possession and affect custody decisions.</li><li><strong>Prepare for the hearing:</strong> bring the papers, messages and witnesses that answer the application.</li></ul>',
      who: '<p>Applicants: bring photos, messages, medical records, police report numbers and a list of the dates violence occurred. Respondents: follow every term of the order from the moment you are served, even if you believe the application is untrue, and bring everything you were served with.</p>',
      steps: 'protect',
      faq: [
        { q: 'How is a protective order different from temporary orders in a divorce?', a: 'A protective order is the family violence remedy in the Family Code, and violating one is a crime. Temporary orders in a divorce or custody case govern the family while that case is pending.' },
        { q: 'How long does a protective order last?', a: 'The court sets the term: up to {law.po2} in most cases, longer in some, and an order tied to a pending divorce or custody case can run until {law.posapcr}. A temporary ex parte order is good for up to {law.exparte} unless extended.' },
        { q: 'I was served with an application. What now?', a: 'Follow every term of any temporary order, note the hearing date and talk with a lawyer before the hearing. Do not contact the applicant to discuss it.' },
        { q: 'Can a protective order affect custody?', a: 'Yes. Courts must consider evidence of family violence in conservatorship and possession decisions.' }],
      related: ['sapcr', 'div_k', 'mod'], band: 'Talk with a lawyer about a protective order.',
      tok: ['protective', 'violence', 'abuse', 'order'],
      es: { h: 'Abogado de órdenes de protección en {city}', e: 'Orden de protección · {city}', d: 'Órdenes de protección por violencia familiar en Texas, para quien la pide y para quien responde. Si está en peligro, llame al {law.e911}.', d2: 'Cuéntenos lo básico cuando sea seguro hacerlo. Le llamamos.',
        aq: '¿Cómo funciona una orden de protección en Texas?', answer: 'Una orden de protección prohíbe la violencia familiar y el contacto. El tribunal puede firmar una orden temporal sin aviso a la otra parte, válida hasta {law.exparte.es} salvo prórroga, y luego celebra una audiencia. El tribunal fija la duración de la orden final: hasta {law.po2.es} en la mayoría de los casos, y una orden ligada a un divorcio o una demanda de custodia pendiente puede durar hasta {law.posapcr.es}. Si alguien está en peligro, llame al {law.e911}.',
        fact: 'k_po', factL: 'casos de órdenes de protección presentados en el condado de {county} en {k_whenEs}',
        faq: [{ q: '¿Cuánto dura una orden de protección?', a: 'El tribunal fija la duración: hasta {law.po2.es} en la mayoría de los casos, o hasta {law.posapcr.es} si está ligada a un divorcio o una demanda de custodia pendiente. Una orden temporal es válida hasta {law.exparte.es} salvo prórroga.' }, { q: 'Me notificaron una solicitud. ¿Qué hago?', a: 'Cumpla cada término de la orden temporal, anote la fecha de la audiencia y hable con un abogado antes de la audiencia.' }, { q: '¿Afecta la custodia?', a: 'Sí. El tribunal debe considerar la violencia familiar al decidir la custodia y la posesión y acceso.' }] } },

    ivd: { nm: 'Child support and paternity', short: 'Child support', slug: 'child-support-lawyer', lp: 'child-support',
      h1n: 'Child Support and Paternity in Texas', h1: 'Child Support Lawyer in {city}', eyebrow: 'Child support and paternity',
      lede: 'Child support in Texas follows statewide guidelines, and paternity sets who owes it and who has rights. {brand} represents parents in support and paternity cases, including cases the Attorney General has opened.',
      aq: 'How is child support set in Texas?',
      answer: 'Guideline child support is a share of the paying parent\'s monthly net resources: {law.pct} for one child, with net resources counted up to {law.cap} a month {law.cap.w}. Courts can depart from the guidelines when the evidence supports it. The Office of the Attorney General runs most child support cases, and its lawyers represent the state, so a parent may hire a lawyer for those hearings.',
      areaFact: 'In {areaCounties}, {a_ivd} child support and paternity cases were filed in {period}.',
      facts: ['a_ivd', 'law.cap', 'law.pct', 'law.oag'],
      what: '<p>What a support case covers:</p><ul><li><strong>The guideline amount:</strong> a percentage of net resources by the number of children.</li><li><strong>Medical and dental support:</strong> insurance for the child and how uninsured costs are shared.</li><li><strong>Paternity:</strong> a signed acknowledgment, or genetic testing and a court order.</li><li><strong>Departures from the guidelines:</strong> when the child\'s needs or the parents\' resources call for a different amount.</li><li><strong>Income withholding:</strong> support paid from wages through the State Disbursement Unit.</li></ul>',
      who: '<p>Bring recent pay stubs and tax returns, the cost of the child\'s health insurance and child care, any existing orders, and the Attorney General case number if there is one.</p>',
      steps: 'custody',
      faq: [
        { q: 'Does the Attorney General\'s lawyer represent me?', a: 'No. The Attorney General\'s lawyers represent the state\'s interest in the support order, not either parent.' },
        { q: 'How much is child support for one child?', a: 'Under the guidelines, {law.pct} of the paying parent\'s monthly net resources, with net resources counted up to {law.cap} a month. At the cap that is {law.cap1} a month for one child.' },
        { q: 'What are net resources?', a: 'Income from almost every source, minus taxes, union dues and the cost of the child\'s health insurance, as the Family Code defines them.' },
        { q: 'How is paternity established?', a: 'By an acknowledgment of paternity both parents sign, or by genetic testing and a court order.' }],
      related: ['sapcr', 'mod', 'enf'], band: 'Talk with a lawyer about child support.',
      tok: ['child-support', 'support', 'paternity', 'attorney-general'],
      es: { h: 'Abogado de manutención de menores en {city}', e: 'Manutención de menores y paternidad · {city}', d: 'Manutención de menores y paternidad en Texas, incluidos los casos del Procurador General. Hable con un abogado.', d2: 'Cuéntenos lo básico. Le llamamos para fijar la consulta.',
        aq: '¿Cómo se fija la manutención de menores en Texas?', answer: 'La manutención de menores según las guías es un porcentaje de los ingresos netos mensuales del padre que paga: {law.pct} para un hijo, con ingresos netos contados hasta {law.cap} al mes. La paternidad se establece con un reconocimiento firmado o una orden judicial. Los abogados del Procurador General representan al estado, no a los padres.',
        fact: 'k_ivd', factL: 'casos de manutención de menores y paternidad presentados en el condado de {county} en {k_whenEs}',
        faq: [{ q: '¿Cuánto es la manutención para un hijo?', a: '{law.pct} de los ingresos netos mensuales del padre que paga, contados hasta {law.cap} al mes.' }, { q: '¿El abogado del Procurador General me representa?', a: 'No. Representa al estado, no a ninguno de los padres.' }, { q: '¿Cómo se establece la paternidad?', a: 'Con un reconocimiento de paternidad firmado por ambos padres, o con una prueba genética y una orden judicial.' }] } },

    adopt: { nm: 'Adoption', short: 'Adoption', slug: 'adoption-lawyer', lp: 'adoption',
      h1n: 'Adoption in Texas: Stepparent, Relative and Adult', h1: 'Adoption Lawyer in {city}', eyebrow: 'Stepparent, relative and adult adoption',
      lede: 'A stepparent or relative adoption makes a family\'s daily life legal. {brand} handles the termination, the consents and the final hearing.',
      aq: 'How does a stepparent or relative adoption work in Texas?',
      answer: 'A stepparent or relative adoption usually has two parts: ending the other parent\'s rights, by signed relinquishment or court order, and the adoption itself. A child {law.adopt12} or older must consent unless the court waives it, and the child usually must live with the adopting parent for {law.adopt6} first. The court orders a social study and criminal history checks before the final hearing.',
      areaFact: 'In {areaCounties}, {a_adopt} adoption cases were filed in {period}.',
      facts: ['a_adopt', 'law.adopt12', 'law.adopt6', 'law.term'],
      what: '<p>Kinds of adoption the firm handles:</p><ul><li><strong>Stepparent adoption:</strong> the other parent\'s rights end and the stepparent becomes the legal parent.</li><li><strong>Relative and kinship adoption:</strong> grandparents, aunts, uncles and other relatives raising a child.</li><li><strong>Adult adoption:</strong> an adult adopted with their own consent.</li></ul>',
      who: '<p>Bring the child\'s birth certificate, any custody or support orders, what you know about where the other parent lives, and how long the child has lived with you.</p>',
      steps: 'adopt',
      faq: [
        { q: 'Does the other parent have to agree?', a: 'The other parent\'s rights must end first, either by a signed relinquishment or by a court order on grounds the Family Code allows.' },
        { q: 'Does my stepchild have to agree?', a: 'A child {law.adopt12} or older must consent to the adoption unless the court waives it.' },
        { q: 'Is a home study needed?', a: 'Texas adoptions generally require a social study and criminal history checks, which the court reads before the final hearing.' },
        { q: 'Can an adult be adopted?', a: 'Yes. An adult can be adopted with their own written consent.' }],
      related: ['sapcr', 'cps'], band: 'Talk with a lawyer about an adoption.',
      tok: ['adoption', 'adopt', 'stepparent', 'kinship'],
      es: { h: 'Abogado de adopción en {city}', e: 'Adopción · {city}', d: 'Adopción por padrastro, madrastra o familiar en Texas. Hable con un abogado sobre los pasos.', d2: 'Cuéntenos lo básico. Le llamamos para fijar la consulta.',
        aq: '¿Cómo funciona una adopción por padrastro o familiar?', answer: 'Primero terminan los derechos del otro padre, por renuncia firmada o por orden judicial, y luego se concede la adopción. Un niño de {law.adopt12} años o más debe dar su consentimiento salvo que el juez lo dispense, y el niño suele vivir con quien adopta {law.adopt6.es} antes de la adopción.',
        fact: 'k_adopt', factL: 'casos de adopción presentados en el condado de {county} en {k_whenEs}',
        faq: [{ q: '¿El otro padre tiene que estar de acuerdo?', a: 'Sus derechos deben terminar primero, por renuncia firmada o por orden judicial.' }, { q: '¿El niño tiene que estar de acuerdo?', a: 'Un niño de {law.adopt12} años o más debe dar su consentimiento salvo que el juez lo dispense.' }, { q: '¿Se necesita un estudio del hogar?', a: 'Por lo general sí, junto con la verificación de antecedentes penales.' }] } },

    cps: { nm: 'CPS and termination defense', short: 'CPS defense', slug: 'cps-defense-lawyer', lp: 'cps',
      h1n: 'CPS Investigations and Removals in Texas', h1: 'CPS Defense Lawyer in {city}', eyebrow: 'CPS investigations, removals and termination suits',
      lede: 'When Child Protective Services opens an investigation or removes a child, deadlines start right away. {brand} represents parents and relatives in CPS cases.',
      aq: 'What happens after CPS removes a child in Texas?',
      answer: 'After the Department of Family and Protective Services removes a child, the court must hold a full adversary hearing within {law.adv14}, and the case must be finished within about {law.cps1} of the temporary order unless the court grants an extension. A parent who cannot afford a lawyer and opposes a termination suit filed by the state can ask the court to appoint one.',
      areaFact: 'In {areaCounties}, {a_cps} CPS cases were filed in {period}.',
      facts: ['a_cps', 'law.adv14', 'law.cps1', 'law.counsel'],
      what: '<p>Where a lawyer helps:</p><ul><li><strong>The investigation:</strong> what to say, what to sign and what records to keep.</li><li><strong>The adversary hearing:</strong> the evidence that the child can safely return home or go to a relative.</li><li><strong>The service plan:</strong> tasks, visits and the review hearings.</li><li><strong>Termination suits:</strong> defending parental rights at trial.</li><li><strong>Relatives:</strong> grandparents and other relatives asking for placement or conservatorship.</li></ul>',
      who: '<p>Bring every paper the department has given you, the names of the caseworker and any relatives who could care for the child, and records that show the child\'s care: school, medical and counseling.</p>',
      steps: 'cps',
      faq: [
        { q: 'Should I talk to the caseworker before I have a lawyer?', a: 'You can ask to speak with a lawyer first. What you say can be used in the case, so get advice early.' },
        { q: 'What happens at the adversary hearing?', a: 'The court decides whether the child returns home or stays in the department\'s care while the case goes on. It must be held within {law.adv14} of the removal.' },
        { q: 'Can a CPS case be dismissed?', a: 'Yes. If the case is not finished by the deadline and no extension is granted, the court must dismiss it.' },
        { q: 'Can grandparents ask for the child?', a: 'Relatives can ask to have the child placed with them and, in some cases, to be named conservators.' }],
      related: ['adopt', 'sapcr'], band: 'Talk with a lawyer about a CPS case.',
      tok: ['cps', 'dfps', 'removal', 'termination'],
      es: { h: 'Abogado de defensa ante CPS en {city}', e: 'Defensa ante CPS · {city}', d: 'Si Servicios de Protección Infantil investiga a su familia o retiró a su hijo, los plazos empiezan de inmediato. Hable con un abogado.', d2: 'Cuéntenos lo básico. Le llamamos.',
        aq: '¿Qué pasa después de que CPS retira a un niño?', answer: 'Después de que el Departamento de Servicios para la Familia y de Protección retira a un niño, el tribunal debe celebrar una audiencia contradictoria dentro de {law.adv14.es}, y el caso debe terminar dentro de {law.cps1.es} desde la orden temporal salvo prórroga. Un padre sin recursos que se opone a la terminación puede pedir un abogado de oficio.',
        fact: 'k_cps', factL: 'casos de CPS presentados en el condado de {county} en {k_whenEs}',
        faq: [{ q: '¿Debo hablar con el trabajador social antes de tener abogado?', a: 'Puede pedir hablar primero con un abogado. Lo que diga puede usarse en el caso.' }, { q: '¿Qué pasa en la audiencia contradictoria?', a: 'El tribunal decide si el niño regresa a casa o se queda bajo el cuidado del departamento mientras sigue el caso.' }, { q: '¿Los abuelos pueden pedir al niño?', a: 'Los familiares pueden pedir que el niño se coloque con ellos.' }] } },

    prenup: { nm: 'Premarital agreements', short: 'Prenups', slug: 'prenuptial-agreement-lawyer', lp: 'prenup',
      h1n: 'Prenuptial and Postnuptial Agreements in Texas', h1: 'Prenup Lawyer in {city}', eyebrow: 'Premarital and marital property agreements',
      lede: 'A premarital agreement sets the property rules for a marriage before it starts. {brand} drafts and reads agreements for one party, with time to do it right before the wedding.',
      aq: 'What can a Texas prenup do?',
      answer: 'A Texas premarital agreement must be in writing and signed by both parties, and it takes effect on marriage. It can define separate and community property, set what happens to income and a business, and limit spousal maintenance, but it cannot reduce a child\'s right to support. A court enforces it unless it was signed involuntarily, or was unconscionable when signed without fair disclosure. Spouses who are already married can sign a partition or exchange agreement instead.',
      facts: ['law.prenup', 'law.prenupcs', 'law.partition', 'law.sep'],
      what: '<p>What an agreement usually covers:</p><ul><li><strong>Separate property:</strong> what each person brings and keeps.</li><li><strong>Income and growth:</strong> whether earnings and the growth of separate property stay separate.</li><li><strong>A business:</strong> ownership, value and control.</li><li><strong>Spousal maintenance:</strong> limits the parties agree to.</li><li><strong>After the wedding:</strong> partition and exchange agreements for spouses who are already married.</li></ul>',
      who: '<p>Start months before the wedding. Each party lists assets, debts and income, and each has a separate lawyer. Signing under last minute pressure invites a challenge later.</p>',
      steps: 'agree',
      faq: [
        { q: 'When should we sign?', a: 'Well before the wedding, with time for both parties to read the agreement and get separate advice.' },
        { q: 'Do both of us need lawyers?', a: 'A lawyer can represent only one of you. Separate counsel for each party makes the agreement harder to challenge.' },
        { q: 'Can a prenup decide child support?', a: 'No. A premarital agreement cannot reduce a child\'s right to support.' },
        { q: 'We are already married. Is it too late?', a: 'No. Spouses can sign a partition or exchange agreement that turns community property into separate property.' }],
      related: ['high', 'div_nk'], band: 'Talk with a lawyer about a premarital agreement.',
      tok: ['prenup', 'prenuptial', 'premarital', 'postnuptial', 'agreement'],
      es: { h: 'Acuerdos prematrimoniales en {city}', e: 'Acuerdo prematrimonial · {city}', d: 'Acuerdos prematrimoniales y de división de bienes en Texas. Hable con un abogado con tiempo antes de la boda.', d2: 'Cuéntenos lo básico. Le llamamos para fijar la consulta.',
        aq: '¿Qué puede hacer un acuerdo prematrimonial en Texas?', answer: 'Un acuerdo prematrimonial en Texas debe constar por escrito y estar firmado por ambas partes, y entra en vigor con el matrimonio. Puede definir los bienes propios y gananciales, pero no puede reducir la manutención de menores.',
        fact: '', factL: '',
        faq: [{ q: '¿Cuándo debemos firmarlo?', a: 'Con tiempo antes de la boda, para que ambas partes lo lean y reciban asesoría por separado.' }, { q: '¿Necesitamos un abogado cada uno?', a: 'Un abogado solo puede representar a una de las partes.' }, { q: '¿Ya estamos casados, es tarde?', a: 'No. Los cónyuges pueden firmar un acuerdo de división de bienes gananciales.' }] } },

    high: { nm: 'High asset divorce', short: 'High asset divorce', slug: 'high-asset-divorce-lawyer', lp: 'high-asset',
      h1n: 'High Asset Divorce in Texas', h1: 'High Asset Divorce Lawyer in {city}', eyebrow: 'Business interests, stock plans and complex property',
      lede: 'When the estate includes a business, stock plans, real estate or separate property built over years, the divorce turns on characterizing and valuing it. {brand} handles that work.',
      aq: 'What makes a high asset divorce different?',
      answer: 'In a high asset divorce, the work is in characterizing and valuing property: what is separate and what is community, what a business or stock plan is worth, and whether one estate should reimburse another. Property held when the marriage ends is presumed community, and separate property must be proved by clear and convincing evidence, usually by tracing. The community estate is then divided in a manner that is just and right.',
      facts: ['law.comm', 'law.reimb', 'law.just', 'law.qdro'],
      what: '<p>What the case usually involves:</p><ul><li><strong>Business interests:</strong> value, control and the community share.</li><li><strong>Stock options and restricted stock:</strong> which part is community depends on when it was granted and earned.</li><li><strong>Separate property tracing:</strong> records that follow separate funds through accounts and purchases.</li><li><strong>Reimbursement claims:</strong> one estate paying toward another.</li><li><strong>Retirement and real estate:</strong> divided by order, with tax effects weighed.</li><li><strong>Valuation professionals:</strong> forensic accountants and appraisers where the numbers are disputed.</li></ul>',
      who: '<p>Gather statements for every account for the period of the marriage if you can, business financial statements and tax returns, stock plan grant documents, and records of anything owned before the marriage or received by gift or inheritance.</p>',
      steps: 'divorce',
      faq: [
        { q: 'Is a business I started before marriage separate property?', a: 'The business itself can be separate, but income it produced during the marriage is generally community, and community effort that increased its value can support a reimbursement claim.' },
        { q: 'How is separate property proved?', a: 'By clear and convincing evidence, usually tracing the asset back to property owned before marriage or received by gift or inheritance.' },
        { q: 'Does Texas divide property evenly?', a: 'The community estate is divided in a manner that is just and right, which can be unequal.' },
        { q: 'How are retirement plans divided?', a: 'A workplace plan is divided by a qualified domestic relations order; other accounts by the terms of the decree.' }],
      related: ['div_nk', 'prenup', 'gray'], band: 'Talk with a lawyer about a complex property divorce.',
      tok: ['asset', 'business', 'property', 'net-worth', 'complex'],
      es: { h: 'Divorcio con bienes de alto valor en {city}', e: 'Divorcio con bienes de alto valor · {city}', d: 'Negocios, acciones y bienes propios en un divorcio en Texas. Hable con un abogado.', d2: 'Cuéntenos lo básico. Le llamamos para fijar la consulta.',
        aq: '¿Qué tiene de distinto un divorcio con bienes de alto valor?', answer: 'El trabajo está en clasificar y valorar los bienes: qué es propio y qué es ganancial, cuánto vale un negocio y si un patrimonio debe reembolsar a otro. Los bienes al final del matrimonio se presumen gananciales, y los bienes propios se prueban con evidencia clara y convincente.',
        fact: 'k_div', factL: 'peticiones de divorcio presentadas en el condado de {county} en {k_whenEs}',
        faq: [{ q: '¿Un negocio anterior al matrimonio es propio?', a: 'El negocio puede ser propio, pero sus ingresos durante el matrimonio suelen ser gananciales.' }, { q: '¿Cómo se prueban los bienes propios?', a: 'Con evidencia clara y convincente, por lo general rastreando su origen.' }, { q: '¿Cómo se dividen los bienes?', a: 'De manera justa y equitativa; la división puede ser desigual.' }] } },

    mil: { nm: 'Military divorce', short: 'Military divorce', slug: 'military-divorce-lawyer', lp: 'military-divorce',
      h1n: 'Military Divorce in Texas', h1: 'Military Divorce Lawyer in {city}', eyebrow: 'Service members and military spouses',
      lede: 'A military divorce follows Texas law with federal rules on top: where to file, how retired pay is divided and how deployment shapes custody. {brand} works through each one.',
      aq: 'How is a military divorce different in Texas?',
      answer: 'A Texas resident serving elsewhere keeps Texas residence for filing, and a service member stationed in Texas for {law.milres} can file here. Federal law lets the court divide military retired pay earned during the marriage as property, and the Servicemembers Civil Relief Act lets the court pause a case when military duty keeps a service member from taking part.',
      facts: ['law.milres', 'law.usfspa', 'law.scra', 'law.deploy'],
      what: '<p>What a military divorce involves:</p><ul><li><strong>Residence and filing:</strong> Texas rules that count military service and stationing.</li><li><strong>Retired pay:</strong> the community share and how it is paid.</li><li><strong>Survivor benefits:</strong> whether coverage continues for the former spouse.</li><li><strong>Custody and deployment:</strong> possession while a parent is deployed, including a designated person.</li><li><strong>Child support:</strong> military pay and allowances as net resources.</li></ul>',
      who: '<p>Bring recent leave and earnings statements, orders showing where you are stationed, any deployment orders, and retirement point or service records.</p>',
      steps: 'divorce',
      faq: [
        { q: 'Where can a service member file for divorce?', a: 'In Texas if Texas is the service member\'s home of record and residence, or after being stationed in Texas for {law.milres}.' },
        { q: 'Is military retired pay divided?', a: 'The share earned during the marriage can be divided as property under federal law.' },
        { q: 'Can a divorce be delayed during deployment?', a: 'Yes. The Servicemembers Civil Relief Act lets a court stay the case when military duty prevents the service member from taking part.' },
        { q: 'What happens to possession during deployment?', a: 'Texas law lets a deployed parent designate a person to exercise periods of possession while away.' }],
      related: ['div_k', 'sapcr', 'mod'], band: 'Talk with a lawyer about a military divorce.',
      tok: ['military', 'service', 'deployment', 'veteran'],
      es: { h: 'Divorcio militar en {city}', e: 'Divorcio militar · {city}', d: 'Divorcio para miembros del servicio y sus cónyuges en Texas. Hable con un abogado.', d2: 'Cuéntenos lo básico. Le llamamos para fijar la consulta.',
        aq: '¿En qué se distingue un divorcio militar?', answer: 'Un divorcio militar sigue la ley de Texas con reglas federales. La ley federal permite dividir la pensión de retiro militar ganada durante el matrimonio, y la ley de alivio civil para miembros del servicio permite suspender el caso cuando el servicio impide participar.',
        fact: '', factL: '',
        faq: [{ q: '¿Se divide la pensión de retiro militar?', a: 'La parte ganada durante el matrimonio puede dividirse según la ley federal.' }, { q: '¿Se puede suspender el divorcio durante un despliegue?', a: 'Sí, el tribunal puede suspender el caso cuando el servicio impide participar.' }, { q: '¿Qué pasa con la posesión durante un despliegue?', a: 'El padre desplegado puede designar a una persona para ejercer sus períodos de posesión.' }] } },

    gray: { nm: 'Divorce after {law.gray50}', short: 'Gray divorce', slug: 'gray-divorce-lawyer', lp: 'gray-divorce',
      h1n: 'Divorce After {law.gray50} in Texas', h1: 'Divorce After {law.gray50} in {city}', eyebrow: 'Retirement, the house and maintenance',
      lede: 'A divorce later in life usually turns on retirement, the house and income for the years ahead. {brand} explains how Texas divides each one.',
      aq: 'What matters most in a divorce later in life?',
      answer: 'A late life divorce usually turns on retirement: pensions, workplace plans and IRAs, the house, and whether spousal maintenance applies. Retirement earned during the marriage is generally community property, and a workplace plan is divided by a qualified domestic relations order. Court ordered maintenance is capped at {law.maint} a month or {law.maintpct} of average monthly gross income, whichever is less.',
      facts: ['law.qdro', 'law.maint', 'law.maintdur', 'law.ss'],
      what: '<p>What the case usually involves:</p><ul><li><strong>Retirement:</strong> the community share of pensions, workplace plans and IRAs.</li><li><strong>The house:</strong> sell, buy out or keep, and who pays the mortgage meanwhile.</li><li><strong>Spousal maintenance:</strong> who qualifies, how much and for how long.</li><li><strong>Social Security:</strong> governed by federal rules and not divided by the court.</li><li><strong>Health insurance and estate plans:</strong> beneficiary changes once the divorce is final.</li></ul>',
      who: '<p>Bring retirement plan statements, pension benefit estimates, the mortgage statement, recent tax returns and a list of monthly expenses.</p>',
      steps: 'divorce',
      faq: [
        { q: 'Is Social Security divided in a Texas divorce?', a: 'No. Social Security benefits are governed by federal law and are not divided by a Texas court.' },
        { q: 'How long can spousal maintenance last?', a: 'Usually up to {law.maintdur}, depending on the length of the marriage; some disabilities allow longer.' },
        { q: 'How are pensions divided?', a: 'The share earned during the marriage is community property and is divided by a qualified domestic relations order or the plan\'s own order.' },
        { q: 'Do we have to sell the house?', a: 'Not necessarily. One spouse can buy out the other, or the decree can set a sale and how the proceeds are divided.' }],
      related: ['div_nk', 'high'], band: 'Talk with a lawyer about divorce later in life.',
      tok: ['gray', 'retirement', 'over-50', 'qdro', 'pension'],
      es: { h: 'Divorcio después de los {law.gray50} en {city}', e: 'Divorcio después de los {law.gray50} · {city}', d: 'Jubilación, la casa y la manutención conyugal en un divorcio en Texas. Hable con un abogado.', d2: 'Cuéntenos lo básico. Le llamamos para fijar la consulta.',
        aq: '¿Qué importa más en un divorcio después de los {law.gray50}?', answer: 'Suele centrarse en la jubilación, la casa y la manutención conyugal. La jubilación ganada durante el matrimonio es por lo general ganancial, y un plan de retiro del trabajo se divide con una orden calificada de relaciones domésticas (QDRO).',
        fact: 'k_div', factL: 'peticiones de divorcio presentadas en el condado de {county} en {k_whenEs}',
        faq: [{ q: '¿Se divide el Seguro Social?', a: 'No. Lo rige la ley federal y el tribunal de Texas no lo divide.' }, { q: '¿Cómo se dividen las pensiones?', a: 'La parte ganada durante el matrimonio se divide con una orden calificada.' }, { q: '¿Tenemos que vender la casa?', a: 'No necesariamente. Un cónyuge puede comprar la parte del otro.' }] } }
  };
  const LINE_KEYS = Object.keys(LINES);

  /* ---------- shared FAQ blocks ---------- */
  const HOME_FAQ = [
    { q: 'What areas does {brand} serve?', a: '{areaLine}', need: 'areaLine' },
    { q: 'Who is responsible for this website?', a: '{atty} is the attorney responsible for the content of this site. The firm\'s primary office is in {officeCity}, Texas.' },
    { q: 'What does a consultation cost?', a: '{consultLine} {virtualLine}' },
    { q: 'What kinds of cases does the firm handle?', a: 'The firm handles {lineList}.' },
    { q: 'Does contacting the firm make me a client?', a: 'No. You become a client only after a written fee agreement is signed. Please do not send confidential details through the website form.' },
    { q: 'What payment options are there?', a: '{paymentLine}' }];
  const CITY_FAQ = [
    { q: 'Do you represent clients who live in {city}?', a: 'Yes. {brand} represents {city} residents in family cases, from {officeWhere}.' },
    { q: 'Where is a divorce filed for {city} residents?', a: 'In a county where a spouse has lived for at least {law.res90}, after {law.res} in Texas. For {city} residents in {county} County, that is {county} County.' },
    { q: 'How many divorces are filed in {county} County?', a: '{k_div} divorce petitions were filed in {county} County {k_when}, according to the Texas Office of Court Administration, and {k_divk} of them involved children.', need: 'k_div' },
    { q: 'Do you represent families near {city}?', a: 'Yes. The firm also represents clients in {nearby}.', need: 'nearby' },
    { q: 'Where is your office?', a: '{officeLine}' }];
  const COUNTY_FAQ = [
    { q: 'Which cities in {county} County do you serve?', a: 'Families across the county, including {countyCities}.', need: 'countyCities' },
    { q: 'Where are family cases heard in {county} County?', a: '{k_courtLine}', need: 'k_courtLine' },
    { q: 'How long does a divorce take in {county} County?', a: 'No divorce can be granted until {law.wait} after filing. {k_pendingLine} Agreed cases usually take {law.agreed}; contested cases take longer.' },
    { q: 'How many protective order cases are filed in {county} County?', a: '{k_po} protective order cases were filed in {county} County {k_when}, according to the Texas Office of Court Administration.', need: 'k_po' }];
  const ATTY_FAQ = [
    { q: 'Is {at_name} licensed in Texas?', a: '{at_name} is licensed by the State Bar of Texas{at_barClause}{at_sinceClause}. You can confirm any Texas lawyer\'s license with the State Bar of Texas lawyer search.' },
    { q: 'Which cases does {at_name} handle?', a: '{lineListCap} for clients of {brand}.' },
    { q: 'How do I meet with {at_name}?', a: 'Call {phone} or use the form to book a consultation. {consultLine}' }];

  /* ---------- data guides (scope: state = one page, county = one per plan county where the numbers exist) ---------- */
  const GUIDES = [
    { id: 'filings', scope: 'county', label: 'Divorce filings in the county', need: V => has(V, 'k_div', 'k_divk', 'k_change', 'k_sapcr', 'k_modenf', 'k_po'), table: 'hist',
      h1: 'Divorce Filings in {county} County: What the Court Numbers Show', title: '{county} County Divorce Filings: The Court Numbers',
      meta: '{k_div} divorce petitions were filed in {county} County {k_when}, {k_divk} with children. What the court numbers show and what they mean for a family.',
      answer: '{county} County courts received {k_div} divorce petitions {k_when}, {k_divk} of them involving children, according to the Texas Office of Court Administration. That is {k_change} from the year before.',
      facts: ['k_div', 'k_divk', 'k_sapcr', 'k_po'],
      body: ['<p>The Office of Court Administration counts new family cases by type each month from every district clerk. In {county} County, the latest year brought {k_div} divorce petitions, {k_sapcr} custody suits outside a divorce, {k_modenf} modifications and enforcements and {k_po} protective order cases. {k_pendingLine}</p>',
        '<p>A filing count is not a forecast for any one family, but it shows how busy the courts are and how common each kind of case is. Every divorce waits at least {law.wait} after filing, and many Texas counties have standing orders that apply to both parties as soon as a case is filed.</p>',
        '<p>Before a divorce is filed in {county} County, it helps to gather the financial records, write down the children\'s current schedule and ask a lawyer about the county\'s local rules.</p>'],
      faq: [
        { q: 'Where do the divorce numbers come from?', a: 'From the Texas Office of Court Administration, which collects monthly reports of new cases from each district clerk.' },
        { q: 'How long does a divorce take in {county} County?', a: 'No divorce can be granted until {law.wait} after filing. Agreed cases usually take {law.agreed}; contested cases take longer.' },
        { q: 'Does a rise in filings change my case?', a: 'Not directly. It can mean busier dockets, which affects how soon hearings are set.' }] },
    { id: 'timeline', scope: 'county', label: 'How long a divorce takes', need: V => has(V, 'k_pending', 'k_disposed'),
      h1: 'How Long Does a Divorce Take in {county} County?', title: 'How Long Does a Divorce Take in {county} County?',
      meta: 'No Texas divorce can be granted until {law.wait} after filing. What the {county} County court numbers show about the docket and what shapes your timeline.',
      answer: 'No Texas divorce can be granted until {law.wait} after the petition is filed. Agreed cases usually take {law.agreed}, and contested cases often take {law.contested}. At the end of {through}, {k_pending} divorce cases were pending in {county} County, and the courts disposed of {k_disposed} {k_when}.',
      facts: ['law.wait', 'k_pending', 'k_disposed', 'law.res'],
      body: ['<p>The waiting period of {law.wait} is the floor, not the usual length. {county} County had {k_pending} divorce cases pending at the end of {through} and disposed of {k_disposed} {k_when}, according to the Texas Office of Court Administration.</p>',
        '<p>What stretches a case is disagreement: over the children, the property or both. Temporary orders hearings, discovery, mediation and a final trial each add time. Cases where the spouses agree can often finish soon after the waiting period ends.</p>',
        '<p>To keep your case moving, agree on what you can early, gather financial records before they are requested, and ask at the consultation which steps the county requires before a final hearing.</p>'],
      faq: [
        { q: 'Can a divorce be finished in less than {law.wait}?', a: 'Only in narrow family violence cases. Otherwise the court cannot grant a divorce until {law.wait} after filing.' },
        { q: 'What makes a divorce take longer?', a: 'Disputes over the children or the property, the court\'s docket, and the time needed for discovery and mediation.' },
        { q: 'Do I need to live in {county} County to file there?', a: 'One spouse must have lived in the county for {law.res90}, after {law.res} in Texas.' }] },
    { id: 'support', scope: 'state', label: 'How child support is calculated', table: 'pcts',
      h1: 'How Is Child Support Calculated in Texas?', title: 'How Is Child Support Calculated in Texas?',
      meta: 'Texas guideline child support is a share of net resources, counted up to {law.cap} a month {law.cap.w}. The percentages, the cap and how courts apply them.',
      answer: 'Texas guideline child support is a percentage of the paying parent\'s monthly net resources: {law.pct} for one child, rising with the number of children. Net resources are counted up to {law.cap} a month {law.cap.w}, so guideline support for one child at the cap is {law.cap1} a month. Courts can depart from the guidelines when the evidence supports it.',
      facts: ['law.cap', 'law.cap1', 'law.pct', 'law.interest'],
      body: ['<p>The guidelines start from net resources: income from almost every source, minus taxes, union dues and the cost of the child\'s health insurance. The table shows the percentage for each number of children. Net resources above {law.cap} a month are not counted unless the court finds the child\'s needs call for more.</p>',
        '<p>The guidelines make support predictable, which is why most orders follow them. Courts also order medical and dental support, and unpaid support accrues {law.interest} simple interest a year.</p>',
        '<p>Gather pay stubs, tax returns and the cost of the child\'s insurance before you talk with a lawyer. If your income has changed since the last order, ask whether a modification makes sense.</p>'],
      faq: [
        { q: 'What is the child support cap in Texas?', a: 'Net resources are counted up to {law.cap} a month {law.cap.w}.' },
        { q: 'Can child support be more than the guidelines?', a: 'Yes, when the evidence shows the child\'s needs call for more, and a court can also order less.' },
        { q: 'Does unpaid support earn interest?', a: 'Yes. It accrues {law.interest} simple interest a year.' }] },
    { id: 'property', scope: 'state', label: 'How Texas divides property',
      h1: 'How Does Texas Divide Property in a Divorce?', title: 'How Does Texas Divide Property in a Divorce?',
      meta: 'Texas divides the community estate in a manner that is just and right, which does not require an even split. What is community, what is separate and how courts decide.',
      answer: 'Texas courts divide the community estate in a manner that is just and right, which does not require an even split. Property either spouse holds when the marriage ends is presumed community, and separate property, meaning what a spouse owned before marriage or received by gift or inheritance, is not divided once it is proved by clear and convincing evidence.',
      facts: ['law.just', 'law.comm', 'law.sep', 'law.reimb'],
      body: ['<p>Texas is a community property state. Income earned during the marriage, and most things bought with it, belong to the community estate. Separate property stays with the spouse who owns it, but the spouse claiming it has to prove it with clear and convincing evidence, usually by tracing.</p>',
        '<p>The court can divide the community estate unequally when the facts call for it, considering things such as each spouse\'s earning capacity, health, fault in the breakup and the size of each separate estate. When one estate paid toward another, a reimbursement claim can rebalance the division.</p>',
        '<p>List what you own and owe, with statements, and mark anything you owned before the marriage or received as a gift or inheritance. Records that trace those assets are the evidence that keeps them separate.</p>'],
      faq: [
        { q: 'Is Texas a community property state?', a: 'Yes. Property acquired during the marriage is presumed community property.' },
        { q: 'Does Texas split everything evenly?', a: 'No. The community estate is divided in a manner that is just and right, which can be unequal.' },
        { q: 'What is separate property?', a: 'Property a spouse owned before marriage or received by gift or inheritance during it, plus certain personal injury recoveries.' }] },
    { id: 'custody', scope: 'state', label: 'Custody in Texas',
      h1: 'Custody in Texas: Conservatorship, Possession and Access', title: 'Custody in Texas: Conservatorship and Possession',
      meta: 'Texas calls custody conservatorship and visitation possession and access. How joint managing conservatorship, the possession orders and the child\'s best interest work.',
      answer: 'Texas law calls custody conservatorship and the schedule possession and access. Joint managing conservatorship is presumed to be in the child\'s best interest, but it shares rights and duties and does not set an even division of time. Parents who live within {law.espo} of each other get the expanded standard possession order by default.',
      facts: ['law.jmc', 'law.best', 'law.espo', 'law.child12'],
      body: ['<p>Conservatorship is about rights and duties: education, medical care, and the right to designate the primary residence. Possession and access is the calendar. The two are set separately, which is why joint managing conservators can have very different schedules.</p>',
        '<p>Every decision turns on the child\'s best interest. On request in a case tried without a jury, the judge must interview a child {law.child12} or older in chambers; the child\'s wishes are considered but do not decide the case.</p>',
        '<p>Write down the child\'s current schedule, school and activities, keep communication with the other parent civil and in writing, and ask a lawyer which possession order fits your distance and work.</p>'],
      faq: [
        { q: 'What is the expanded standard possession order?', a: 'The default schedule for parents who live within {law.espo} of each other, with longer weekend and midweek periods than the standard order.' },
        { q: 'Does joint conservatorship mean the same time with each parent?', a: 'No. It shares rights and duties; the schedule is set separately.' },
        { q: 'Does a child get a say?', a: 'A judge must interview a child {law.child12} or older in chambers on request in a case tried without a jury. The child\'s wishes do not decide the case.' }] },
    { id: 'maintenance', scope: 'state', label: 'Spousal maintenance',
      h1: 'Spousal Maintenance in Texas: Who Qualifies and How Much', title: 'Spousal Maintenance in Texas: Who Qualifies',
      meta: 'Court ordered spousal maintenance in Texas is limited by statute: who qualifies, the cap of {law.maint} a month or {law.maintpct} of gross income, and how long it lasts.',
      answer: 'Court ordered spousal maintenance in Texas is limited. The usual route needs a marriage of {law.maint10} or more and proof that the spouse cannot meet minimum reasonable needs; family violence and disability are separate routes. The amount is capped at {law.maint} a month or {law.maintpct} of the paying spouse\'s average monthly gross income, whichever is less.',
      facts: ['law.maint', 'law.maint10', 'law.maintdur', 'law.just'],
      body: ['<p>The Family Code presumes maintenance is not warranted unless the spouse asking for it shows diligence in earning income or developing skills while the case is pending. Courts also weigh each spouse\'s resources, education, age, health and contributions to the marriage.</p>',
        '<p>How long maintenance lasts depends on the length of the marriage: usually up to {law.maintdur}, with longer terms allowed for some disabilities. Spouses can also agree to contractual payments that are not limited the same way.</p>',
        '<p>List monthly expenses and income, and gather records of education, work history and health. Those are the facts a court weighs.</p>'],
      faq: [
        { q: 'Is there alimony in Texas?', a: 'Texas has court ordered spousal maintenance, limited by statute, and contractual payments spouses agree to.' },
        { q: 'How much spousal maintenance can a court order?', a: 'The lesser of {law.maint} a month or {law.maintpct} of the paying spouse\'s average monthly gross income.' },
        { q: 'How long does maintenance last?', a: 'Usually up to {law.maintdur}, depending on the length of the marriage.' }] },
    { id: 'po', scope: 'county', label: 'Protective orders in the county', need: V => has(V, 'k_po', 'k_po_prev') && +String(V.k_po).replace(/\D/g, '') >= 20,
      h1: 'Protective Orders in {county} County: How They Work', title: 'Protective Orders in {county} County',
      meta: '{k_po} protective order cases were filed in {county} County {k_when}. How Texas protective orders work for applicants and respondents.',
      answer: '{k_po} protective order cases were filed in {county} County {k_when}, according to the Texas Office of Court Administration. A temporary ex parte order is good for up to {law.exparte} unless extended. The court sets the term of a final order: up to {law.po2} in most cases, and until {law.posapcr} when the order is tied to a pending divorce or custody case. If anyone is in danger now, call {law.e911}.',
      facts: ['k_po', 'law.exparte', 'law.posapcr', 'law.poviolate'],
      body: ['<p>{county} County courts received {k_po} protective order cases {k_when}, against {k_po_prev} the year before. Each case starts with an application and a sworn statement of what happened.</p>',
        '<p>A protective order is the family violence remedy in the Family Code. The court must find that family violence occurred before granting one, and violating an order is a criminal offense. Orders can also limit firearm possession and shape custody decisions.</p>',
        '<p>Applicants should keep photos, messages, medical records and police report numbers. Respondents should follow every term of a temporary order from the moment they are served and talk with a lawyer before the hearing.</p>'],
      faq: [
        { q: 'How long does a protective order last in Texas?', a: 'The court sets the term: up to {law.po2} in most cases, and until {law.posapcr} when the order is tied to a pending divorce or custody case. A temporary ex parte order is good for up to {law.exparte} unless extended.' },
        { q: 'What happens if a protective order is violated?', a: 'Violating a protective order is a criminal offense.' },
        { q: 'Where is an application filed?', a: 'In the county where the applicant or the respondent lives, or where the family violence occurred.' }] },
    { id: 'modify', scope: 'state', label: 'Changing an order',
      h1: 'Changing a Texas Custody or Child Support Order', title: 'Changing a Texas Custody or Support Order',
      meta: 'A Texas custody or support order changes after a material and substantial change; support also after {law.mod3} if guideline support differs by {law.mod3pct} or {law.mod3amt}.',
      answer: 'Conservatorship and possession can be modified after a material and substantial change in circumstances when the change is in the child\'s best interest. Child support can also be modified when {law.mod3} have passed and guideline support differs from the ordered support by {law.mod3pct} or {law.mod3amt} a month. Until a court signs a new order, the old one applies.',
      facts: ['law.mod3', 'law.modcust', 'law.indep', 'law.cap'],
      body: ['<p>Two tests open a modification. For custody and possession, a material and substantial change since the last order plus the child\'s best interest. For support, either such a change or the passage of {law.mod3} with a support gap of {law.mod3pct} or {law.mod3amt} a month from the guidelines.</p>',
        '<p>Timing matters: a change in support usually reaches back only to when the other parent was served. And because support and possession are independent duties, the existing order has to be followed while the modification is pending.</p>',
        '<p>Bring the current order and proof of what has changed. If the other parent agrees, an agreed order the court signs is the fastest route.</p>'],
      faq: [
        { q: 'Can parents change an order by agreement?', a: 'Only when the court signs the agreement as a new order.' },
        { q: 'Can support be changed after a job loss?', a: 'A material and substantial change in income can support a modification. File promptly.' },
        { q: 'Can I stop paying while I ask for a change?', a: 'No. The current order applies until a court changes it.' }] }
  ];

  /* ---------- Spanish fragments (TexasLawHelp.org terms) ---------- */
  const ES = {
    cta: { label: 'Pida una consulta', phone_label: 'Llame al {phone}' },
    form: { button: 'Enviar', fields: [{ id: 'name', label: 'Nombre completo', type: 'text', required: true }, { id: 'phone', label: 'Teléfono', type: 'tel', required: true }, { id: 'email', label: 'Correo electrónico', type: 'email', required: false }, { id: 'county', label: 'Condado del caso', type: 'text', required: false }, { id: 'message', label: 'Qué pasa (sin detalles confidenciales)', type: 'textarea', required: false }],
      consent: 'Al enviar, acepta que la firma le contacte por teléfono, mensaje de texto o correo electrónico sobre su solicitud. Pueden aplicarse tarifas de mensajes y datos. Responda STOP para dejar de recibir mensajes. Enviar este formulario no crea una relación de abogado y cliente; no incluya detalles confidenciales.' },
    trust: ['Abogado responsable: {atty}', 'Oficina en {officeCity}, Texas', '{consultShortEs}'],
    features: [{ title: 'Abogado responsable', text: '{atty}, con oficina principal en {officeCity}, Texas.' }, { title: 'La consulta', text: '{consultLineEs}' }, { title: 'Atención en español', text: 'Personal de la firma que habla español.' }],
    faq: [{ q: '¿Hablan español?', a: 'Sí. Personal de la firma atiende en español.' }, { q: '¿Dónde está la oficina?', a: '{officeLineEs}' }, { q: '¿Cuánto cuesta la consulta?', a: '{consultLineEs}' }],
    formHead: 'Pida una consulta', band: { heading: '¿Necesita un abogado de familia en {city}? Llámenos.', text: '{consultLineEs}' },
    notice: 'Esta página es publicidad de abogados. Abogado responsable: {atty}, {brand}. Oficina principal: {officeAddr}. La información de esta página es información general sobre la ley de Texas, no asesoría legal para su caso. Contactar a la firma no crea una relación de abogado y cliente.',
    breadcrumbs: 'Inicio', more: 'Más información', facts: { wait: 'como mínimo entre la petición y el decreto de divorcio', consult: 'consulta con un abogado', src: 'Código de Familia de Texas' }
  };
  const CONSENT = 'By submitting, you agree that the firm may contact you by phone, text or email about your request. Message and data rates may apply. Reply STOP to opt out of texts. Sending this form does not create an attorney client relationship; please do not include confidential details.';
  const FORM_FIELDS = [{ id: 'name', label: 'Full name', type: 'text', required: true }, { id: 'phone', label: 'Phone', type: 'tel', required: true }, { id: 'email', label: 'Email', type: 'email', required: false }, { id: 'county', label: 'County where the case is or will be filed', type: 'text', required: false }, { id: 'message', label: 'What is happening (no confidential details)', type: 'textarea', required: false }];
  const NOTICE = 'This page is attorney advertising. Responsible attorney: {atty}, {brand}{attyBarClause}. Primary practice location: {officeAddr}. The information on this page is general information about Texas law, not legal advice for your situation, and contacting the firm does not create an attorney client relationship.';
  const KL = { home: 'Home', about: 'About', attorney: 'Attorney', practice: 'Practice area', county: 'County', city: 'City', landing: 'Landing', guide: 'Guide', faq: 'FAQ' };

  /* ---------- facts: value, label and the public source printed beside it; the grade stays in the forge ---------- */
  function factItem(k, V, lang) {
    V = V || {};
    if (/^law\./.test(k)) { const e = LAW[k.slice(4)]; if (!e) return null; return { key: k, value: lang === 'es' && e.es ? e.es : e.v, label: lang === 'es' && e.les ? e.les : e.l, source: e.c, grade: e.g || 'A' }; }
    const S = SRC(V); const per = V.period || 'the latest year'; const ac = V.areaCounties || 'the firm\'s counties'; const kc = (V.county || '') + ' County'; const kw = V.k_when || '';
    const R = {
      s_div: [V.s_div, `divorce petitions filed in Texas in ${per}`, 'oca', 'A'],
      a_div: [V.a_div, `divorce petitions filed in ${ac} in ${per}`, 'oca', 'A'], a_divk: [V.a_divk, `divorce petitions involving children in ${ac}, ${per}`, 'oca', 'A'],
      a_divnk: [V.a_divnk, `divorce petitions without children in ${ac}, ${per}`, 'oca', 'A'], a_sapcr: [V.a_sapcr, `custody suits filed outside a divorce in ${ac}, ${per}`, 'oca', 'A'],
      a_mod: [V.a_mod, `modification suits filed in ${ac}, ${per}`, 'oca', 'A'], a_enf: [V.a_enf, `enforcement suits filed in ${ac}, ${per}`, 'oca', 'A'],
      a_po: [V.a_po, `protective order cases filed in ${ac}, ${per}`, 'oca', 'A'], a_ivd: [V.a_ivd, `child support and paternity cases filed in ${ac}, ${per}`, 'oca', 'A'],
      a_adopt: [V.a_adopt, `adoption cases filed in ${ac}, ${per}`, 'oca', 'A'], a_cps: [V.a_cps, `CPS cases filed in ${ac}, ${per}`, 'oca', 'A'],
      k_div: [V.k_div, `divorce petitions filed in ${kc} ${kw}`, 'oca', 'A'], k_divk: [V.k_divk, `of them involving children`, 'oca', 'A'],
      k_sapcr: [V.k_sapcr, `custody suits filed outside a divorce in ${kc} ${kw}`, 'oca', 'A'], k_po: [V.k_po, `protective order cases filed in ${kc} ${kw}`, 'oca', 'A'],
      k_mod: [V.k_mod, `modification suits filed in ${kc} ${kw}`, 'oca', 'A'], k_enf: [V.k_enf, `enforcement suits filed in ${kc} ${kw}`, 'oca', 'A'],
      k_ivd: [V.k_ivd, `child support and paternity cases filed in ${kc} ${kw}`, 'oca', 'A'], k_cps: [V.k_cps, `CPS cases filed in ${kc} ${kw}`, 'oca', 'A'], k_adopt: [V.k_adopt, `adoption cases filed in ${kc} ${kw}`, 'oca', 'A'],
      k_pending: [V.k_pending, `divorce cases pending in ${kc} at the end of ${V.through || ''}`, 'oca', 'A'], k_disposed: [V.k_disposed, `divorce cases disposed of in ${kc} ${kw}`, 'oca', 'A'],
      k_married: [V.k_married, `married adults in ${kc}`, 'acs', 'A'], k_offices: [V.k_offices, `law offices of every kind in ${kc}`, 'cbp', 'A'],
      c_div: [V.c_div, `divorce petitions a year estimated for ${V.city || ''} ZIP codes, the county's filings allocated by married adults`, 'alloc', 'C'],
      c_married: [V.c_married, `married adults in the ${V.city || ''} ZIP codes`, 'acs', 'B'],
      c_sapcr: [V.c_sapcr, `custody suits a year estimated for ${V.city || ''} ZIP codes`, 'alloc', 'C'], c_po: [V.c_po, `protective order cases a year estimated for ${V.city || ''} ZIP codes`, 'alloc', 'C']
    };
    const r = R[k]; if (!r || r[0] == null || r[0] === '' || /undefined|null|NaN|n\/a/.test(String(r[0]) + r[1])) return null;
    return { key: k, value: String(r[0]), label: r[1].replace(/\s{2,}/g, ' ').trim(), source: S[r[2]], grade: r[3] };
  }

  /* ---------- titles, slugs and meta per page ---------- */
  function fitMeta(s) { s = house(s); if (s.length <= 158) return s; const cut = s.slice(0, 158); const i = cut.lastIndexOf('. '); return i >= 100 ? cut.slice(0, i + 1) : cut.replace(/\s\S*$/, '') + '…'; }
  function fitTitle(t, brand) { t = house(t); if (t.length > 60) t = t.replace(' | ' + brand, ''); if (t.length > 60) t = t.replace(/\s[|:].*$/, ''); if (t.length > 60) t = t.slice(0, 60).replace(/\s\S*$/, ''); return t; }
  function describe(p, V, o) {
    o = o || {}; const F = t => fill(t, V); const brand = V.brand || ''; const d = {}; const L = p.line ? LINES[p.line] : null;
    switch (p.kind) {
      case 'home': d.label = 'Home'; d.slug = 'home'; d.h1 = F('Family Law Firm in {officeCity}, Texas'); d.title = F('{brand} | Family Law in {officeCity}, TX'); d.meta = F('{brand} handles {lineList} across {areaCounties}. Responsible attorney {atty}, primary office in {officeCity}, Texas.'); break;
      case 'about': d.label = 'About'; d.slug = 'about'; d.h1 = F('About {brand}'); d.title = F('About {brand} | Texas Family Law'); d.meta = F('{brand} is a family law firm based in {officeCity}, Texas. Who we are, our lawyers, how we work and the counties we serve.'); break;
      case 'attorney': d.label = F('Attorney · {at_name}'); d.slug = 'attorney-' + slugify(V.at_name || 'lawyer'); d.h1 = F('{at_name}, Family Law Attorney'); d.title = F('{at_name} | {brand}'); d.meta = F('{at_name} is a family lawyer at {brand} in {officeCity}, Texas. License, background and the cases {at_name} handles.'); break;
      case 'practice': d.label = F(L.nm); d.slug = L.slug; d.h1 = F(L.h1n); d.title = `${F(L.h1n)} | ${brand}`; d.meta = F(firstSentence(L.lede) + ' Responsible attorney {atty}, {officeCity}.'); break;
      case 'county': d.label = F('{county} County'); d.slug = slugify(V.county) + '-county-family-lawyer'; d.h1 = F('Family Lawyer in {county} County, Texas'); d.title = F('{county} County Family Lawyer | {brand}'); d.meta = has(V, 'k_div') ? F('{brand} represents clients in divorce, custody and protective order cases in {county} County, where {k_div} divorce petitions were filed {k_when}.') : F('{brand} represents clients in divorce, custody and protective order cases in {county} County, Texas.'); break;
      case 'city': d.label = F('{city}, TX'); d.slug = slugify(V.city) + '-family-lawyer'; d.h1 = F('Family Lawyer in {city}, Texas'); d.title = F('{city} Divorce and Family Lawyer | {brand}'); d.meta = F('{brand} represents {city} residents in divorce, custody, support and protective order cases in {county} County. Responsible attorney {atty}.'); break;
      case 'landing': { const es = p.lang === 'es'; const place = V.city || ((V.county || '') + ' County');
        d.label = (es ? 'Spanish landing · ' : 'Landing · ') + F(L.short) + ' · ' + place; d.slug = (es ? 'lp-es-' : 'lp-') + L.lp + '-' + slugify(place);
        d.h1 = es ? F(L.es.h) : F(L.h1); d.title = es ? `${F(L.es.h)} | ${brand}` : F(`${L.short} in {city}, TX | {brand}`); d.meta = es ? F(L.es.d) : F(`${L.nm} help for {city} residents from {brand}. {consultShort}. Responsible attorney {atty}.`); break; }
      case 'guide': { const g = GUIDES.find(x => x.id === p.topic); d.label = 'Guide · ' + F(g.h1); d.slug = slugify(F(g.h1).replace(/['’]/g, '')); d.h1 = F(g.h1); d.title = F(g.title); d.meta = F(g.meta); break; }
      case 'faq': d.label = 'FAQ'; d.slug = 'family-law-faq'; d.h1 = 'Texas Family Law Questions and Answers'; d.title = F('Texas Family Law FAQ | {brand}'); d.meta = F('Answers to common questions about Texas divorce, custody, child support, protective orders and how a consultation with {brand} works.'); break;
    }
    d.h1 = house(d.h1); d.meta = fitMeta(d.meta); d.title = fitTitle(d.title, brand); d.label = house(d.label);
    return d;
  }

  /* ---------- the blueprint writer ---------- */
  const TEXT_KEYS = new Set(['eyebrow', 'lede', 'body', 'text', 'heading', 'caption', 'title', 'label', 'q', 'a', 'quote', 'role', 'value', 'source', 'anchor', 'description', 'transcript', 'link', 'name']);
  function cleanInline(s) { const m = String(s).match(/^(\s*)([\s\S]*?)(\s*)$/); return m[1] + house(m[2]) + m[3]; }
  function cleanHTML(h) { return String(h).split(/(<[^>]+>)/).map(p => p.startsWith('<') ? p : (p.trim() ? cleanInline(p) : p)).join(''); }
  function cleanDeep(x, key) {
    if (typeof x === 'string') return key === 'html' ? cleanHTML(x) : TEXT_KEYS.has(key) ? house(x) : x;
    if (Array.isArray(x)) return x.map(v => cleanDeep(v, key === 'rows' || key === 'columns' ? 'text' : key));
    if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = (k === 'url' || k === 'media' || k === 'id' || k === 'type') ? x[k] : cleanDeep(x[k], k); return o; }
    return x;
  }
  /* Spanish matter names for the intake form */
  const ESN = { div_k: 'Divorcio con hijos', div_nk: 'Divorcio', sapcr: 'Custodia y paternidad', mod: 'Modificación de órdenes', enf: 'Hacer cumplir órdenes', po: 'Órdenes de protección', ivd: 'Manutención de menores y paternidad', adopt: 'Adopción', cps: 'Defensa ante CPS', prenup: 'Acuerdos prematrimoniales', high: 'Divorcio con bienes de alto valor', mil: 'Divorcio militar', gray: 'Divorcio después de los {law.gray50}' };
  const TOGGLE = { es: 'Lea esta página en español', en: 'Read this page in English' };
  /* the firm as the compiler reads it (site.firm, the FIRM.get() shape): public fields only, no logo data, notes or review counts */
  function publicFirm(F, lineNames) {
    F = F || {}; const pick = (o, ks) => { const r = {}; ks.forEach(k => { if (o && o[k] != null && o[k] !== '') r[k] = o[k]; }); return r; };
    const out = pick(F, ['name', 'legal_name', 'url', 'phone', 'founded', 'responsible', 'counties', 'county_names', 'city_names', 'lines', 'languages', 'payment', 'colors', 'social']);
    out.attorneys = (F.attorneys || []).map(a => pick(a, ['name', 'bar_no', 'tbls', 'since', 'bio', 'title', 'languages']));
    out.offices = (F.offices || []).map(o => pick(o, ['label', 'street', 'city', 'zip', 'county', 'phone', 'hours', 'primary']));
    const fees = {}; Object.entries(F.fees || {}).forEach(([k, v]) => { if (v != null && v !== '' && +v > 0) fees[k] = +v; }); out.fees = fees;
    if (lineNames) out.line_names = lineNames;
    return out;
  }
  const tblsLine = a => a && a.tbls ? `Board Certified, ${a.tbls}, Texas Board of Legal Specialization` : '';
  /* ctx: { V, site, firm, lines, internal, crumbs, media, entity, extraSchema, features, testimonials, today, author, attorneys, counties, langAlt } */
  function blueprint(p, ctx) {
    ctx = ctx || {}; const V = ctx.V || {}; const S = ctx.site || {}; const F0 = ctx.firm || {}; const missing = []; const es = p.lang === 'es';
    const L = p.line ? LINES[p.line] : null; const brand = V.brand || ''; const desc = { title: p.title, h1: p.h1, meta: p.meta, slug: p.slug };
    if (!desc.title || !desc.h1 || !desc.slug) Object.assign(desc, describe(p, V), Object.fromEntries(Object.entries(desc).filter(([, v]) => v)));
    const F = t => fill(t, V, missing), FD = x => fillDeep(x, V, missing);
    const used = []; const facts = (keys, lang) => keys.map(k => factItem(k, V, lang)).filter(Boolean).map(f => { used.push(f); return { value: f.value, label: f.label, source: f.source }; });
    const media = ctx.media || {}; const tst = ctx.testimonials && ctx.testimonials.length ? ctx.testimonials : null; const today = ctx.today || new Date().toISOString().slice(0, 10);
    const internal = (ctx.internal || []).slice(); const lineKeys = (ctx.lines || []).filter(k => LINES[k]);
    const crumbs = ctx.crumbs && p.kind !== 'home' && p.kind !== 'landing' ? [{ name: es ? ES.breadcrumbs : 'Home', url: '/' }] : [];
    const trustSrc = es ? ES.trust : String(S.trust || 'Responsible attorney {atty} | Office in {officeCity}, Texas | {consultShort}').split('|');
    const trust = trustSrc.map(x => F(String(x).trim())).filter(Boolean).slice(0, 3);
    /* the intake form: the compiler writes the fields (county and matter selects) and the consent; the forge gives the options */
    const cn = (ctx.counties || []).filter(Boolean);
    const form = { provider: S.form_provider || 'html', button: es ? ES.form.button : (S.form_button || 'Request a consultation'), counties: cn.map(n => es ? `Condado de ${n}` : `${n} County`), matters: (lineKeys.length ? lineKeys : LINE_KEYS.slice(0, 6)).map(k => fill(es ? ESN[k] : LINES[k].nm, V)) };
    if (!form.counties.length) delete form.counties;
    if (S.form_shortcode) form.shortcode = S.form_shortcode; if (S.form_action) form.action = S.form_action; if (S.email || F0.intake_email) form.email_to = S.email || F0.intake_email;
    const cta = { primary: { label: es ? ES.cta.label : (S.cta_label || 'Request a consultation'), url: S.cta_url || '#contact' }, secondary: { label: es ? 'Cómo funciona' : 'How it works', url: '#how-it-works' } };
    if (V.phone && !/^\[/.test(V.phone)) { cta.primary.phone = V.phone; cta.primary.phone_label = es ? fill(ES.cta.phone_label, V) : 'Call ' + V.phone; }
    const archetype = { home: 'home', about: 'about', attorney: 'attorney', practice: 'practice', county: 'location', city: 'location', landing: 'landing', guide: 'guide', faq: 'about' }[p.kind];
    const page = { archetype, post_type: p.kind === 'guide' && S.guides_as_posts ? 'post' : 'page', slug: desc.slug, title: desc.title, h1: desc.h1, meta_description: desc.meta, language: es ? 'es-US' : 'en-US',
      template: p.kind === 'landing' ? (!S.template || S.template === 'default' ? 'elementor_canvas' : S.template) : (S.template || 'default'),
      breadcrumbs: crumbs, summary: '', entity: ctx.entity || { '@type': 'LegalService', name: brand }, dates: { published: today, modified: today }, cta, conversion: { sticky_mobile_bar: S.sticky !== false, trust, form }, internal_links: internal, schema_extra: (ctx.extraSchema || []).slice() };
    if (p.line) page.line = p.line;
    const au = ctx.author || (V.atty && !/^\[/.test(V.atty) ? { name: V.atty, credentials: V.attyCred || 'Attorney licensed in Texas', bio: V.attyBio || '' } : null);
    if (au) page.author = Object.assign({}, au, media.author ? { media: 'author' } : {});
    if (p.kind === 'attorney' && ctx.attorney) page.attorney = Object.assign({}, ctx.attorney, media.headshot ? { media: 'headshot' } : {});
    if (ctx.langAlt && ctx.langAlt.url) page.alternates = [{ lang: ctx.langAlt.lang === 'es' ? 'es-US' : 'en-US', url: ctx.langAlt.url }];
    if (p.kind === 'landing' && S.noindex_landing !== false) page.noindex = true;
    if (['practice', 'city', 'county'].includes(p.kind)) page.service = { '@type': 'Service', serviceType: L ? F(L.nm) : 'Family law', areaServed: p.kind === 'city' ? { '@type': 'City', name: V.cityFull || V.city } : p.kind === 'county' ? { '@type': 'AdministrativeArea', name: (V.county || '') + ' County, TX' } : 'Texas' };
    const sec = [];
    const hero = o => { sec.push(Object.assign({ type: 'hero', media: media.hero ? 'hero' : undefined, layout: media.hero ? 'split' : 'center', cta: ['primary'], trust: true }, o)); if (ctx.langAlt && ctx.langAlt.url) sec.push({ type: 'lang_toggle', url: ctx.langAlt.url, lang: ctx.langAlt.lang, label: TOGGLE[ctx.langAlt.lang] || TOGGLE.es }); };
    const links = () => { if (internal.length) sec.push({ type: 'links', heading: es ? ES.more : 'Related', items: internal }); };
    const notice = () => sec.push({ type: 'disclaimer', id: 'disclaimer', attorney: house(V.atty), firm: house(brand), city: house(V.officeCity), location: house(V.officeLoc || `${V.officeCity}, Texas`), extra: !es && V.certs ? [house(V.certs)] : [] });
    const formSec = (h, t) => sec.push({ type: 'form', id: 'contact', heading: h, text: t });
    const testi = h => { if (tst && !es) sec.push({ type: 'testimonials', heading: h || 'What clients say', items: tst.slice(0, 3) }); };
    const authors = () => { if (page.author && !es) sec.push({ type: 'authors', heading: 'Responsible attorney' }); };
    const lawyers = (h, t, only) => { const items = (ctx.attorneys || []).filter(a => a && a.name && (only == null || a.name === only)); if (items.length) sec.push({ type: 'attorneys', heading: h, text: t, items: items.map(a => Object.assign({}, a)) }); };
    const video = h => { if (media.explainer && !es) sec.push({ type: 'video', media: 'explainer', heading: h || F('What a consultation with {brand} looks like'), description: page.meta_description }); };
    const band = (h, t) => sec.push({ type: 'cta_band', heading: h, text: t });
    const steps = (h, list) => { const st = FD(list); sec.push({ type: st.some(x => x.when) ? 'process' : 'steps', id: 'how-it-works', heading: h, steps: st }); };
    const faqs = items => FD(items.filter(it => !it.need || has(V, ...String(it.need).split(' ')))).filter(it => it.q && it.a).map(it => ({ q: it.q, a: it.a }));
    const features = () => (ctx.features && ctx.features.length ? ctx.features : lineKeys.map(k => ({ title: F(LINES[k].nm), text: firstSentence(F(LINES[k].lede)) }))).slice(0, 9);
    const FORM_H = 'Request a consultation', FORM_T = 'Two minutes. We call back to set a time. Please leave out confidential details.';
    const consultBand = V.consultLine || '';
    const courtFacts = () => { if (!has(V, 'k_div')) return; const it = (label, a, b) => has(V, a) ? { label, value: V[a] + (b && has(V, b) ? ` (${V[b]} the year before)` : '') } : null;
      const items = [it('Divorce petitions', 'k_div', 'k_div_prev'), it('Divorce petitions involving children', 'k_divk'), it('Custody suits outside a divorce (SAPCR)', 'k_sapcr', 'k_sapcr_prev'), it('Modifications', 'k_mod', 'k_mod_prev'), it('Enforcements', 'k_enf', 'k_enf_prev'), it('Protective order cases', 'k_po', 'k_po_prev'), it('Child support and paternity cases', 'k_ivd'), it('Adoptions', 'k_adopt'), it('CPS cases', 'k_cps')].filter(Boolean);
      if (has(V, 'k_pending')) items.push({ label: F('Divorce cases pending at the end of {through}'), value: V.k_pending }); if (has(V, 'k_disposed')) items.push({ label: 'Divorce cases disposed of', value: V.k_disposed });
      sec.push({ type: 'court_facts', heading: F('{county} County courts and filings'), county: V.county, text: F('Family cases filed {k_when}, from the clerk reports to the Texas Office of Court Administration.'), items, courts: has(V, 'k_court') ? [{ name: V.k_court, address: V.k_courtAddr || '' }] : [], source: SRC(V).oca }); };
    switch (p.kind) {
      case 'home': {
        page.summary = F('{brand}: Texas family law based in {officeCity}. Responsible attorney {atty}.');
        hero({ eyebrow: F('Family law · {officeCity}, Texas'), lede: F('{brand} handles {lineList} for families across {areaCounties}.') });
        sec.push({ type: 'answer', heading: F('Who {brand} is'), body: S.about ? F(S.about) : F('{brand} is a family law firm based in {officeCity}, Texas. The firm handles {lineList} for clients in {areaCounties}. {atty} is the attorney responsible for the firm\'s advertising, and every matter starts with a consultation and a written fee agreement.') });
        const st = facts(['a_div', 'a_divk', 'a_po', 'law.cap']); if (st.length) sec.push({ type: 'stats', heading: F('Family law in {areaCounties} by the numbers'), items: st.map(f => ({ value: f.value, label: f.label })) });
        sec.push({ type: 'features', id: 'practice', heading: 'Practice areas', text: 'Every case starts with a consultation and a written fee agreement.', items: features() });
        lawyers('Our attorneys'); steps('How a consultation works', STEPS.consult); video(); testi();
        sec.push({ type: 'faq', heading: 'Questions people ask before they call', items: faqs(HOME_FAQ) }); authors();
        band('Talk with a Texas family lawyer.', consultBand); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'about': {
        page.summary = F('About {brand}, a Texas family law firm in {officeCity}.');
        hero({ eyebrow: brand, lede: F('A family law firm based in {officeCity}, Texas. Responsible attorney: {atty}.') });
        sec.push({ type: 'answer', heading: F('Who is {brand}?'), body: S.about ? F(S.about) : F('{brand} is a Texas family law firm based in {officeCity}. The firm handles {lineList} for clients in {areaCounties}. {atty} is the attorney responsible for the firm\'s advertising.') });
        const kf = [{ value: V.atty, label: 'responsible attorney for this website', source: `${LAW.r702.c}, ${LAW.r702.v}` }, { value: V.officeCity, label: 'primary office', source: brand }];
        if (V.founded) kf.push({ value: V.founded, label: 'year the firm was founded', source: brand }); if (V.consultShort) kf.push({ value: V.consultShort, label: 'consultations', source: brand });
        sec.push({ type: 'key_facts', heading: 'At a glance', items: kf });
        lawyers('Our lawyers');
        sec.push({ type: 'rich_text', heading: 'How we work', html: '<p>Every matter starts with a consultation and, if you hire the firm, a written fee agreement that says what the representation covers. We explain the Texas law that applies, the options and the likely steps, and we tell you each court date as it is set and what it means.</p>' });
        sec.push({ type: 'rich_text', heading: 'Advertising and consumer information', html: F('<p>This website is attorney advertising. {atty} is responsible for its content, and the firm\'s primary office is in {officeCity}, Texas. You can confirm any Texas lawyer\'s license with the <a href="https://www.texasbar.com/">State Bar of Texas</a>. The information here is general and is not legal advice for your situation.</p>') });
        sec.push({ type: 'faq', heading: 'Questions clients ask', items: faqs(HOME_FAQ).slice(0, 4) }); authors();
        band('Talk with a Texas family lawyer.', consultBand); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'attorney': {
        page.summary = F('{at_name}, family lawyer at {brand}.');
        hero({ eyebrow: F('Attorney · {brand}'), lede: F('{at_name} is a family lawyer at {brand} in {officeCity}, Texas.'), media: media.headshot ? 'headshot' : undefined, layout: media.headshot ? 'split' : 'center' });
        sec.push({ type: 'answer', heading: F('About {at_name}'), body: V.at_bio ? F(V.at_bio) : F('{at_name} practices family law with {brand} in {officeCity}, Texas, handling {lineList}.{at_sinceSentence}') });
        lawyers('License', '', V.at_name);
        sec.push({ type: 'features', heading: F('Cases {at_name} handles'), items: features() });
        sec.push({ type: 'faq', heading: F('Questions about {at_name}'), items: faqs(ATTY_FAQ) });
        band(F('Book a consultation with {at_name}.'), consultBand); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'practice': {
        page.summary = F(`${L.nm} from {brand}: `) + firstSentence(strip(F(L.answer)));
        hero({ eyebrow: F(L.eyebrow), lede: F(L.lede) });
        sec.push({ type: 'answer', heading: F(L.aq), body: F(L.answer) + (L.areaFact && has(V, L.facts[0]) ? ' ' + F(L.areaFact) : '') });
        const kf = facts(L.facts); if (V.fee) kf.push({ value: V.fee, label: 'the flat fee the firm advertises for this kind of matter; the written fee agreement says what it covers', source: brand });
        sec.push({ type: 'key_facts', heading: 'The numbers and the law behind it', items: kf });
        sec.push({ type: 'rich_text', heading: 'What the case involves', html: F(L.what) });
        sec.push({ type: 'rich_text', heading: 'Before the consultation', html: F(L.who) });
        steps('How it works', STEPS[L.steps] || STEPS.consult); video(); testi();
        sec.push({ type: 'faq', heading: F(`${L.short} questions people ask`), items: faqs(L.faq) }); authors();
        band(F(L.band), consultBand); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'county': {
        page.summary = has(V, 'k_div') ? F('{brand} in {county} County: {k_div} divorce petitions were filed there {k_when}.') : F('{brand} in {county} County.');
        hero({ eyebrow: F('{brand} · {county} County'), lede: F('{brand} represents clients in family cases across {county} County. Responsible attorney {atty}, primary office in {officeCity}.') });
        if (has(V, 'k_div')) {
          sec.push({ type: 'answer', heading: F('How many divorces are filed in {county} County?'), body: F('{k_div} divorce petitions were filed in {county} County {k_when}, {k_divk} of them involving children, according to the Texas Office of Court Administration. The county also recorded {k_sapcr} custody suits outside a divorce, {k_modenf} modifications and enforcements, and {k_po} protective order cases.') + (has(V, 'k_change') ? ' ' + F('Divorce filings were {k_change} from the year before.') : '') });
          sec.push({ type: 'key_facts', heading: F('{county} County by the numbers'), items: facts(['k_div', 'k_divk', 'k_sapcr', 'k_po']) });
          courtFacts();
        } else sec.push({ type: 'answer', heading: F('Who handles family law cases in {county} County?'), body: F('{brand} represents clients in {lineList} across {county} County, from our office in {officeCity}.') });
        sec.push({ type: 'rich_text', heading: 'What the county numbers mean', html: '<p>' + [has(V, 'k_courtLine') ? F('{k_courtLine}') : '', has(V, 'k_pendingLine') ? F('{k_pendingLine}') : ''].filter(Boolean).join(' ') + (has(V, 'k_courtLine') || has(V, 'k_pendingLine') ? '</p><p>' : '') + F('No divorce can be granted until {law.wait} after filing, and many Texas counties have standing orders that apply to both parties as soon as a case is filed. Ask about {county} County\'s local rules at the consultation.') + '</p>' });
        if (Array.isArray(V.k_cities) && V.k_cities.length) sec.push({ type: 'table', heading: F('Cities in {county} County'), columns: ['City', 'Estimated divorce petitions a year', 'Married adults', 'ZIP codes'], rows: V.k_cities.map(r => r.map(String)) });
        steps('How a divorce case works', STEPS.divorce); testi();
        sec.push({ type: 'faq', heading: F('Questions {county} County families ask'), items: faqs(COUNTY_FAQ) }); authors();
        band(F('Talk with a family lawyer in {county} County.'), consultBand); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'city': {
        page.summary = F('{brand} for {city} residents: divorce, custody, support and protective orders in {county} County.');
        hero({ eyebrow: F('{brand} · {city}'), lede: F('{brand} represents {city} residents in family cases filed in {county} County. Responsible attorney {atty}.') });
        sec.push({ type: 'answer', heading: F('Who handles family law cases for {city} residents?'), body: F('{brand} represents clients who live in {city} in {lineList}, from {officeWhere}. Cases for {city} residents in {county} County are filed there.') + (has(V, 'c_div') ? ' ' + F('An estimated {c_div} divorce petitions a year come from {city} ZIP codes, based on {county} County court filings and Census data.') : '') });
        sec.push({ type: 'key_facts', heading: F('{city} by the numbers'), items: facts(['c_div', 'c_married', 'k_div', 'law.wait']) });
        sec.push({ type: 'rich_text', heading: F('The {city} picture'), html: '<p>' + [has(V, 'c_zips', 'c_married') ? F('{city} covers the ZIP codes {c_zips}, home to about {c_married} married adults.') : '', has(V, 'k_div') ? F('{county} County recorded {k_div} divorce petitions {k_when}, {k_divk} with children, plus {k_sapcr} custody suits and {k_po} protective order cases.') : '', has(V, 'k_change') ? F('Divorce filings in the county were {k_change} from the year before.') : '', has(V, 'k_courtLine') ? F('{k_courtLine}') : ''].filter(Boolean).join(' ') + '</p>' });
        sec.push({ type: 'features', id: 'practice', heading: F('Practice areas for {city} clients'), items: features() });
        steps('How a consultation works', STEPS.consult); testi(F('What {city} clients say'));
        sec.push({ type: 'faq', heading: F('Questions {city} families ask'), items: faqs(CITY_FAQ) }); authors();
        band(F('Talk with a family lawyer about your {city} case.'), consultBand); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'landing': {
        page.breadcrumbs = []; page.summary = es ? F(`Página de campaña: ${L.short}, {cityFull}.`) : F(`Campaign landing page: ${L.short}, {cityFull}.`);
        if (es) {
          const E = L.es;
          hero({ eyebrow: F(E.e), lede: F(E.d), layout: media.hero ? 'cover' : 'center', trust: true });
          sec.push({ type: 'answer', heading: F(E.aq), body: F(E.answer) });
          const kf = []; if (E.fact && has(V, E.fact)) { kf.push({ value: V[E.fact], label: F(E.factL), source: SRC(V).ocaEs }); used.push({ key: E.fact, value: V[E.fact], label: F(E.factL), source: SRC(V).ocaEs, grade: 'A' }); }
          if (['div_k', 'div_nk', 'high', 'gray'].includes(p.line)) { const f = factItem('law.wait', V, 'es'); if (f) { kf.push({ value: f.value, label: ES.facts.wait, source: ES.facts.src + ' § 6.702' }); used.push(f); } }
          if (V.consultShortEs) kf.push({ value: V.consultShortEs, label: ES.facts.consult, source: brand });
          if (kf.length) sec.push({ type: 'key_facts', heading: '', items: kf });
          sec.push({ type: 'features', heading: 'Por qué llamarnos', items: FD(ES.features) });
          sec.push({ type: 'faq', heading: 'Antes de llamar', items: faqs(E.faq.concat(ES.faq)).slice(0, 5) });
          formSec(ES.formHead, F(E.d2 || E.d)); band(F(ES.band.heading), F(ES.band.text));
        } else {
          hero({ eyebrow: F(L.eyebrow), lede: F(L.lede), layout: media.hero ? 'cover' : 'center', trust: true });
          sec.push({ type: 'answer', heading: F(L.aq), body: F(L.answer) });
          const dk = (L.es && L.es.fact && has(V, L.es.fact)) ? L.es.fact : null; const kf = [];
          if (dk) { const f = factItem(dk, V); if (f) { used.push(f); kf.push({ value: f.value, label: dk === 'k_divk' ? F('divorce petitions involving children in {county} County {k_when}') : f.label, source: f.source }); } }
          const lf = factItem(L.facts.find(k => /^law\./.test(k)) || 'law.wait', V); if (lf) { used.push(lf); kf.push({ value: lf.value, label: lf.label, source: lf.source }); }
          if (V.consultShort) kf.push({ value: V.consultShort, label: F('with a lawyer at {brand}'), source: brand });
          sec.push({ type: 'key_facts', heading: '', items: kf });
          sec.push({ type: 'features', heading: 'Why people call us', items: [{ title: 'A responsible attorney', text: F('{atty}, primary office in {officeCity}, Texas.') }, { title: 'The consultation', text: F('{consultLine}') }, { title: V.virtualLine ? 'By video or in person' : 'Written fee agreement', text: V.virtualLine ? F('{virtualLine}') : 'If you hire the firm, the agreement says what the representation covers.' }].filter(x => x.text) });
          sec.push({ type: 'faq', heading: 'Before you call', items: faqs(L.faq).slice(0, 3) });
          formSec('Request a consultation', 'Two minutes. We call back to set a time.'); band(F(L.band), consultBand);
        }
        notice(); break; }
      case 'guide': {
        const g = GUIDES.find(x => x.id === p.topic);
        page.summary = firstSentence(strip(F(g.answer)));
        hero({ eyebrow: 'Guide · ' + (g.scope === 'county' ? F('{county} County') : 'Texas'), lede: F(g.meta), layout: 'center', media: undefined, trust: false, cta: ['primary'] });
        sec.push({ type: 'answer', heading: 'The short answer', body: F(g.answer) });
        sec.push({ type: 'key_facts', heading: 'The facts behind it', items: facts(g.facts) });
        if (g.table === 'pcts') sec.push({ type: 'table', heading: 'Texas child support guidelines', columns: ['Children before the court', 'Share of monthly net resources'], rows: LAW.pcts.rows.map(r => r.slice()) });
        if (g.table === 'hist' && Array.isArray(V.k_hist) && V.k_hist.length) sec.push({ type: 'table', heading: F('Divorce petitions filed in {county} County by year'), columns: ['Year', 'Divorce petitions', 'With children'], rows: V.k_hist.map(r => r.map(String)) });
        const heads = ['What the numbers say', 'Why it matters', 'What to do'];
        g.body.forEach((b, i) => sec.push({ type: 'rich_text', heading: heads[i], html: F(b) }));
        sec.push({ type: 'faq', heading: 'Questions readers ask', items: faqs(g.faq) }); authors();
        band(F('Talk with {brand} about your case.'), consultBand); notice(); links(); break; }
      case 'faq': {
        page.summary = F('Answers to common Texas family law questions from {brand}.');
        hero({ eyebrow: F('{brand} · questions and answers'), lede: F('Plain answers about Texas divorce, custody, child support and protective orders, and how a consultation with {brand} works.'), layout: 'center', media: undefined });
        sec.push({ type: 'answer', heading: 'The short answer', body: F('Texas family law turns on a few rules: no divorce is granted until {law.wait} after filing, the community estate is divided in a manner that is just and right, joint managing conservatorship is presumed, and child support follows statewide guidelines with net resources counted up to {law.cap} a month.') });
        const items = faqs(HOME_FAQ.slice(1, 5)); lineKeys.forEach(k => faqs(LINES[k].faq).slice(0, 2).forEach(it => { if (!items.some(x => x.q === it.q)) items.push(it); }));
        sec.push({ type: 'faq', heading: 'Questions and answers', items: items.slice(0, 24) }); authors();
        band('Talk with a Texas family lawyer.', consultBand); formSec(FORM_H, FORM_T); notice(); links(); break; }
    }
    const lineNames = {}; LINE_KEYS.forEach(k => { lineNames[k] = fill(LINES[k].nm, V); });
    const site = { url: S.url || 'https://www.example.com', name: brand, cms: S.cms || undefined, brand: { name: brand, primary: S.primary || (F0.colors || {}).primary, accent: S.accent || (F0.colors || {}).accent, dark: S.dark || (F0.colors || {}).dark, font_heading: S.font_heading || undefined, font_body: S.font_body || undefined, logo_url: S.logo_url || undefined, globals: S.globals !== false }, firm: publicFirm(F0, lineNames) };
    const mspec = {}; for (const k in media) if (media[k]) mspec[k] = media[k];
    const bp = { forge: '1', site, page, media: mspec, sections: cleanDeep(sec) };
    bp.page.summary = house(bp.page.summary); bp.page.conversion.trust = trust.map(house);
    bp.page.internal_links = internal.map(l => ({ anchor: house(l.anchor), url: l.url }));
    ['author', 'attorney'].forEach(k => { const a = bp.page[k]; if (!a) return; ['name', 'credentials', 'bio', 'title'].forEach(f => { if (a[f]) a[f] = house(a[f]); }); });
    bp.page.cta = cleanDeep(bp.page.cta, ''); ['label', 'phone_label'].forEach(k => { ['primary', 'secondary'].forEach(c => { if (bp.page.cta[c] && bp.page.cta[c][k]) bp.page.cta[c][k] = house(bp.page.cta[c][k]); }); });
    bp.page.conversion.form = Object.assign({}, form, { button: house(form.button), counties: form.counties ? form.counties.map(house) : undefined, matters: form.matters.map(house) });
    bp._facts = used.filter((f, i, a) => a.findIndex(x => x.key === f.key) === i); bp._missing = missing.filter((x, i, arr) => arr.indexOf(x) === i);
    return bp;
  }

  /* ---------- the visible text of a blueprint, field by field (what LINT screens; the compiled page adds the form and the disclaimer wording) ---------- */
  function visibleText(bp) {
    const out = []; const pg = bp.page || {}; const firm = (bp.site || {}).firm || {}; const es = /^es/.test(pg.language || '');
    const byName = n => (firm.attorneys || []).find(a => a && a.name && a.name.toLowerCase() === String(n || '').toLowerCase()) || {};
    out.push(['seo.title', pg.title || ''], ['seo.h1', pg.h1 || ''], ['seo.meta', pg.meta_description || '']);
    ((pg.conversion || {}).trust || []).forEach((t, i) => out.push(['hero.trust' + i, t]));
    const c = pg.cta || {}; ['primary', 'secondary'].forEach(k => { if (c[k] && c[k].label) out.push(['cta.' + k, c[k].label]); if (c[k] && c[k].phone_label) out.push(['cta.' + k + '.phone', c[k].phone_label]); });
    for (const s of bp.sections || []) {
      const tag = s.type;
      ['eyebrow', 'lede', 'body', 'text', 'html', 'heading', 'caption', 'label', 'note', 'source'].forEach(k => { if (s[k] && typeof s[k] === 'string') out.push([tag + '.' + k, strip(s[k])]); });
      (s.items || []).forEach((it, i) => { ['q', 'a', 'text', 'label', 'title', 'value', 'source', 'quote', 'anchor', 'name', 'role'].forEach(k => { if (it[k]) out.push([tag + '.' + k + i, String(it[k])]); });
        if (s.type === 'attorneys') { const a = Object.assign({}, byName(it.name), it); [tblsLine(a), a.bar_no ? 'State Bar of Texas No. ' + a.bar_no : '', a.since ? 'Licensed in Texas since ' + a.since : '', a.bio].filter(Boolean).forEach((x, j) => out.push([tag + '.card' + i + '.' + j, x])); } });
      (s.steps || []).forEach((st, i) => { out.push([tag + '.s' + i, (st.when ? st.when + ': ' : '') + st.title + '. ' + st.text]); });
      (s.courts || []).forEach((ct, i) => out.push([tag + '.court' + i, [ct.name, ct.address].filter(Boolean).join(', ')]));
      if (s.columns) out.push([tag + '.cols', s.columns.join(' · ')]);
      (s.rows || []).forEach((r, i) => out.push([tag + '.r' + i, r.join(' ')]));
      if (s.type === 'authors' && pg.author) { const a = Object.assign({}, byName(pg.author.name), pg.author); out.push(['authors.person', [a.name, a.credentials, tblsLine(a), a.bio].filter(Boolean).join(', ')]); }
      if (s.type === 'disclaimer') { const V0 = { brand: s.firm, atty: s.attorney, attyBarClause: '', officeAddr: s.location }; out.push(['disclaimer', fill(es ? ES.notice : NOTICE, Object.assign(V0, { officeCity: s.city }))]); (s.extra || []).forEach((x, i) => out.push(['disclaimer.extra' + i, x])); }
      if (s.type === 'form') { const f = (pg.conversion || {}).form || {}; if (!f.shortcode) { (f.counties || []).concat(f.matters || []).forEach((x, i) => out.push(['form.option' + i, x])); if (f.button) out.push(['form.button', f.button]); } }
    }
    return out.filter(x => x[1] && String(x[1]).trim());
  }
  const wordCount = bp => visibleText(bp).filter(([w]) => !w.startsWith('seo.')).reduce((t, [, s]) => t + words(s), 0);

  return { LAW, SRC, LINES, LINE_KEYS, ESN, STEPS, GUIDES, ES, HOME_FAQ, CITY_FAQ, COUNTY_FAQ, ATTY_FAQ, CONSENT, NOTICE, FORM_FIELDS, KL, TOGGLE, publicFirm, tblsLine, fill, fillDeep, has, house, listAnd, slugify, firstSentence, strip, factItem, describe, blueprint, visibleText, wordCount, cleanDeep, fitTitle, fitMeta };
})();
