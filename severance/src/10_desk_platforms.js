/* SEVERANCE Campaign Desk platform layer (DESKX): the creative library for the thirteen family law lines, the platform benchmarks and
   playbooks, the pacing math and one bulk file or build sheet writer per ad platform. Pure functions over a plain model object, no DOM,
   so the writers run the same in the page and in tests/desk.test.mjs. Module 10 (src/29_m10_desk.js) builds the model and the UI.
     DESKX.google(M) DESKX.microsoft(M) DESKX.lsa(M) DESKX.dg(M) DESKX.meta(M) DESKX.linkedin(M) DESKX.yelp(M) DESKX.nextdoor(M) DESKX.tiktok(M)
       → {name, header, rows (arrays), text (CSV)}; every campaign, ad set and ad is written paused
     DESKX.creative(M) → every ad the files carry, screened with LINT.checkAd: [{platform, line, lang, label, fields, review}]
     DESKX.flightMonths(o) and DESKX.monthPlan(o) → the pacing (the flight starts on the chosen date, the month plan in its month)
   Uses LINT (03_lint.js) when present for the limits, the house style and the screen; falls back to its own limits otherwise. */
'use strict';
const DESKX = (() => {
  const PLATS = ['google', 'lsa', 'dg', 'meta', 'microsoft', 'linkedin', 'yelp', 'nextdoor', 'tiktok'];
  const PLAB = { google: 'Google Search', lsa: 'Local Services Ads', dg: 'YouTube and Demand Gen', meta: 'Meta', microsoft: 'Microsoft Advertising', linkedin: 'LinkedIn', yelp: 'Yelp Ads', nextdoor: 'Nextdoor', tiktok: 'TikTok' };
  /* platform limits used when LINT.LIMITS lacks a field (LINT wins when it has one) */
  const LIM0 = { google: { headline: 30, description: 90, path: 15, sitelink: 25, sitelink_desc: 35, callout: 25, snippet: 25 }, microsoft: { headline: 30, description: 90, path: 15, sitelink: 25, callout: 25 }, meta: { primary: 125, headline: 40, description: 30 }, youtube: { headline: 30, long_headline: 90, description: 90 }, demandgen: { headline: 40, description: 90, business: 25 }, tiktok: { text: 100, display_name: 40 }, linkedin: { intro: 150, headline: 70, description: 100 }, lsa: { bio: 1000 }, yelp: { headline: 50, body: 500 }, nextdoor: { headline: 90, body: 400 } };
  const LPLAT = { google: 'google', microsoft: 'microsoft', meta: 'meta', dg: 'demandgen', linkedin: 'linkedin', lsa: 'lsa', yelp: 'yelp', nextdoor: 'nextdoor', tiktok: 'tiktok' };
  const hasLint = () => typeof LINT !== 'undefined' && LINT && typeof LINT.checkAd === 'function';
  function limit(platform, field) { const p = LPLAT[platform] || platform; const L = (typeof LINT !== 'undefined' && LINT && LINT.LIMITS && LINT.LIMITS[p]) || {}; return L[field] || (LIM0[p] || {})[field] || null; }
  function house(s) {
    if (s == null) return s;
    if (typeof LINT !== 'undefined' && LINT && typeof LINT.house === 'function') return LINT.house(s);
    return String(s).replace(/\s*[—–―]\s*/g, ', ').replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 to $2').replace(/(\w)-(\w)/g, '$1 $2').replace(/[‐-―−]/g, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
  }
  const money = v => '$' + Math.round(+v || 0).toLocaleString('en-US');
  const pad2 = n => String(n).padStart(2, '0');
  const isoOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const dateOfISO = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  /* the flight's last day, inclusive: a 13 week flight from Oct 1 ends Dec 30 */
  const endDate = (start, weeks) => { const s = dateOfISO(start); return s ? isoOf(addDays(s, Math.max(1, Math.round(weeks || 1)) * 7 - 1)) : ''; };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---- benchmarks (editable in module 10; grade C where Severance carries a source, D where it is an assumption) */
  const ASM0 = {
    google: { basis: 'CPC', cost: 9.87, ctr: 5.0, cvr: 6.0, ret: 22, min: 20, g: 'C', src: 'CPC: median legal services CPC on Google search, Apr 2025 to Mar 2026 (WordStream). Conversion: between the 5.55% legal median (same source) and the 8.52% family law cut (LocaliQ 2023). CTR and lead to retained are assumptions (grade D).' },
    lsa: { basis: 'CPL', cost: 140, ctr: 0, cvr: 100, ret: 28, min: 20, g: 'D', src: 'Assumption near the $131.63 median legal cost per lead (WordStream); Local Services prices family law leads by market and week, and a call lead retains better than a click.' },
    dg: { basis: 'CPM', cost: 12, ctr: 0.6, cvr: 1.5, ret: 12, min: 15, g: 'D', src: 'Assumption; geographic and content targeting only (no audience segments on family difficulties).' },
    meta: { basis: 'CPM', cost: 14, ctr: 1.0, cvr: 4.0, ret: 10, min: 10, g: 'D', src: 'Assumption; lead form objective. Form leads retain less often than calls.' },
    microsoft: { basis: 'CPC', cost: 6.6, ctr: 4.5, cvr: 5.5, ret: 22, min: 10, g: 'D', src: 'Assumption; roughly two thirds of the Google CPC, the same lead to retained rate.' },
    linkedin: { basis: 'CPC', cost: 8, ctr: 0.5, cvr: 6.0, ret: 0, min: 10, g: 'D', src: 'Assumption; applications or partner contacts, not client matters.' },
    yelp: { basis: 'CPC', cost: 8, ctr: 3.0, cvr: 6.0, ret: 15, min: 10, g: 'D', src: 'Assumption; message and consultation requests.' },
    nextdoor: { basis: 'CPM', cost: 10, ctr: 0.5, cvr: 2.0, ret: 10, min: 10, g: 'D', src: 'Assumption.' },
    tiktok: { basis: 'CPM', cost: 9, ctr: 0.8, cvr: 1.5, ret: 8, min: 20, g: 'D', src: 'Assumption; TikTok sets its own minimum daily budgets, verify in Ads Manager.' }
  };
  /* platform split by line (judgment defaults, grade D). The plan's default is the budget weighted blend of the chosen lines. */
  const MIX_BASE = { google: 46, lsa: 20, dg: 4, meta: 12, microsoft: 8, linkedin: 0, yelp: 4, nextdoor: 3, tiktok: 3 };
  const MIX0 = {
    div_k: MIX_BASE, div_nk: MIX_BASE, sapcr: MIX_BASE, mod: MIX_BASE, enf: MIX_BASE, ivd: MIX_BASE,
    po: { google: 52, lsa: 26, dg: 0, meta: 6, microsoft: 10, linkedin: 0, yelp: 6, nextdoor: 0, tiktok: 0 },
    cps: { google: 56, lsa: 20, dg: 0, meta: 8, microsoft: 10, linkedin: 0, yelp: 6, nextdoor: 0, tiktok: 0 },
    adopt: { google: 44, lsa: 16, dg: 6, meta: 20, microsoft: 6, linkedin: 0, yelp: 4, nextdoor: 4, tiktok: 0 },
    prenup: { google: 40, lsa: 10, dg: 8, meta: 24, microsoft: 8, linkedin: 0, yelp: 4, nextdoor: 0, tiktok: 6 },
    high: { google: 56, lsa: 10, dg: 6, meta: 12, microsoft: 16, linkedin: 0, yelp: 0, nextdoor: 0, tiktok: 0 },
    mil: { google: 50, lsa: 16, dg: 4, meta: 20, microsoft: 6, linkedin: 0, yelp: 4, nextdoor: 0, tiktok: 0 },
    gray: { google: 44, lsa: 16, dg: 6, meta: 20, microsoft: 10, linkedin: 0, yelp: 0, nextdoor: 4, tiktok: 0 }
  };
  function lineMix(lines) { const out = {}; PLATS.forEach(p => out[p] = 0); let W = 0; (lines || []).forEach(l => { const w = l.share != null ? l.share : 1; W += w; const m = MIX0[l.key] || MIX_BASE; PLATS.forEach(p => out[p] += w * (m[p] || 0)); }); PLATS.forEach(p => out[p] = W ? Math.round(out[p] / W) : MIX_BASE[p]); return out; }

  /* ---- playbook: how each platform takes the build, how it targets, and the rules that bind a family law buy */
  const PBOOK = {
    google: { geo: 'ZIP and county location targets with Google criterion IDs and bid modifiers; the rest resolve by name.', bulk: 'Google Ads Editor CSV: Account, Import, From file. Campaigns, locations, negatives, sitelinks, callouts, snippets, call assets, ad groups, keywords with match types and responsive search ads (up to 15 headlines and 4 descriptions, the Rule 7.02(a) line pinned to description 1). Every campaign and ad is paused.', policy: ['Search ads on family law keywords are allowed; keyword and location targeting is geographic, not personal.', 'Personalized advertising policy: relationship, marital and family difficulties are a sensitive category ("personal hardships"). No remarketing, customer match or audience segments built on divorce or custody; the desk exports none.', 'Editorial: no exclamation marks in headlines, no gimmicky capitals, no phone numbers in ad text (the call asset carries it).', 'Rule 7.02(a): the responsible lawyer and the primary practice location go in description 1, pinned so every impression carries them.'] },
    lsa: { geo: 'Service area by ZIP or by county in the Local Services console.', bulk: 'No bulk upload. Build sheet: the business profile, the family law case types, the weekly budget, the service area, the hours, the languages, the lawyers and the Google Screened checklist.', policy: ['Local Services Ads run for family law firms after Google Screened verification (the bar license of each lawyer listed and a background check); confirm the current checklist in the console.', 'Leads are charged per call or message; dispute leads outside family law in the console window.', 'Ranking follows responsiveness, reviews and proximity; answering the phone matters more than the budget.', 'Rule 7.04: the profile and the bio are advertisements; file what is not exempt with the Advertising Review Committee.'] },
    dg: { geo: 'The same Google location criteria; content topics and placements.', bulk: 'Build sheet for a Demand Gen campaign per line (YouTube, Discover and Gmail): headlines, descriptions, business name, the video brief.', policy: ['No custom segments, remarketing or life event audiences built on divorce or family difficulties (personal hardships policy); target by location, content topics and placements.', 'Real lawyers of the firm on camera; no dramatized client stories and no outcome claims (Rule 7.01).'] },
    meta: { geo: 'ZIP keys (US:75201) for ad sets, or a radius around each office. Legal ads run without a special ad category; recruiting ads fall in the Employment special ad category (no ZIP, age or gender targeting, 15 mile radius minimum).', bulk: 'Ads Manager, Import and Export: CSV with campaign, ad set and ad columns, every status PAUSED.', policy: ['Personal attributes policy: write to the situation in the third person ("Divorce with children in Harris County"), never "Are you getting divorced?".', 'Detailed targeting on relationship status is gone; build on geography and broad interests, never on lists of people believed to be divorcing.', 'Lead forms: consent language for calls and texts, unchecked.'] },
    microsoft: { geo: 'ZIP and county by name; Microsoft resolves its own location IDs.', bulk: 'Microsoft Advertising Editor: Import, Import from Google Ads, From file, with this Google Ads Editor format file (campaign names carry MICROSOFT).', policy: ['Same editorial practice as Google; the Microsoft Audience Network off at launch.', 'No audience targeting on family difficulties.'] },
    linkedin: { geo: 'Metro and city by name.', bulk: 'Build sheet for Campaign Manager: attorney and paralegal recruiting, and referral partner campaigns. No client advertising on LinkedIn in this desk.', policy: ['Employment ads must not signal age or gender; post a pay range where you have one.', 'Rule 7.03: no payment to non lawyers for referrals beyond nominal gifts; a referral partner ad offers information and a working relationship, never a fee.'] },
    yelp: { geo: 'Service area by city and ZIP.', bulk: 'Build sheet for Yelp Ads (Divorce and Family Law category, message requests on).', policy: ['Never ask for or incentivize reviews on Yelp; Yelp posts consumer alerts on businesses that do.', 'Rule 7.01: review counts and ratings quoted in ads must match the live profile.'] },
    nextdoor: { geo: 'ZIP lists.', bulk: 'Build sheet for Nextdoor Ads Manager.', policy: ['The business page must match the advertiser; neighborhood reach is thin in rural ZIPs.', 'Limits are the ones the compliance engine carries; verify in Ads Manager (grade D).'] },
    tiktok: { geo: 'City or DMA, and postal codes where the account offers them.', bulk: 'Build sheet for TikTok Ads Manager (the Accounts module connects the account and reads the results back).', policy: ['Check TikTok\'s current policy for legal services in your account before launch (not verified in this build).', 'Third person copy, no personal attributes, adults only.'] }
  };

  /* ---- creative library. Tokens: {firm} {city} (primary office) {mcity} (market city) {county} {fee} {cfee} {base} {atty}.
     Market cities appear as "Serving", never as an office location (Rule 7.01). No hyphens or dashes, no superlatives, no outcomes. */
  const LIB = {
    div_k: { bn: 'divorces with children', page: '/divorce-with-children', path: 'divorce', sl: 'Divorce With Children', sld: ['Custody and support', 'Talk with our lawyers'], lsa: ['Divorce', 'Child custody', 'Child support'],
      kwq: ['how is custody decided in texas', 'how much is child support in texas', 'how long does a divorce take in texas', 'what is a standard possession order', 'who gets the house in a texas divorce'],
      kwEs: ['abogado de divorcio', 'abogado de divorcio con hijos', 'abogado de custodia', 'divorcio con hijos texas'],
      en: { h: ['Divorce With Children', 'Custody and Support Explained', 'Conservatorship in Texas', 'Possession Schedules Explained', 'Child Support Guidelines', 'Temporary Orders Explained', 'Parenting Plans in Texas', 'Primary Residence Questions'],
        d: ['Conservatorship, possession and child support under the Texas Family Code, explained.', 'Temporary orders, parenting plans and the standard possession order, step by step.', 'Texas presumes joint managing conservatorship; we explain what that means for you.'],
        meta: { p: 'Divorce with children in {county} County: custody and support, explained.', h: 'Divorce with children, explained', d: 'Talk with a family lawyer' } },
      es: { h: ['Divorcio con Hijos', 'Custodia y Manutención', 'Planes de Crianza'], d: ['Custodia, tiempo con los hijos y manutención según el Código de Familia de Texas.', 'Órdenes temporales y planes de crianza, paso a paso y en español.'],
        meta: { p: 'Divorcio con hijos en el condado de {county}: custodia y manutención.', h: 'Divorcio con hijos en Texas', d: 'Consulta en español' } } },
    div_nk: { bn: 'divorces without children', page: '/divorce', path: 'divorce', sl: 'Divorce Without Children', sld: ['Agreed and contested cases', 'Property division explained'], lsa: ['Divorce'],
      kwq: ['how to file for an uncontested divorce in texas', 'how much does a divorce cost in texas', 'how is property divided in a texas divorce', 'how long does an agreed divorce take'],
      kwEs: ['abogado de divorcio', 'divorcio de mutuo acuerdo', 'divorcio sin hijos texas'],
      en: { h: ['Uncontested Divorce Help', 'Agreed Divorce in Texas', 'Divorce Without Children', 'Property Division Explained', 'Community Property Questions', 'Agreed Divorce From {fee}'],
        d: ['Texas divides community property in a just and right manner; we explain what that means.', 'When both spouses agree, we prepare the decree and the filings and guide each step.', 'Texas has a 60 day wait after filing; agreed cases often take two to four months.'],
        meta: { p: 'Divorce without children in {county} County: agreed and contested cases.', h: 'Divorce without children, explained', d: 'Talk with a family lawyer' } },
      es: { h: ['Divorcio de Mutuo Acuerdo', 'Divorcio sin Hijos', 'División de Bienes'], d: ['Texas divide los bienes comunitarios de manera justa y correcta; le explicamos cómo.', 'Cuando ambos están de acuerdo, preparamos el decreto y le guiamos en cada paso.'],
        meta: { p: 'Divorcio sin hijos en el condado de {county}: casos de mutuo acuerdo.', h: 'Divorcio sin hijos en Texas', d: 'Consulta en español' } } },
    sapcr: { bn: 'custody cases for unmarried parents', page: '/child-custody', path: 'custody', sl: 'Child Custody', sld: ['Unmarried parents', 'Paternity and custody'], lsa: ['Child custody', 'Paternity'],
      kwq: ['how do unmarried parents get custody in texas', 'how to establish paternity in texas', 'what is a sapcr in texas', 'how to get custody of my child in texas'],
      kwEs: ['abogado de custodia', 'custodia de menores texas', 'abogado de paternidad'],
      en: { h: ['Child Custody in Texas', 'Custody for Unmarried Parents', 'Establish Paternity in Texas', 'SAPCR Cases Explained', 'Fathers Have Equal Standing', 'Custody Orders Explained', 'Primary Residence Questions'],
        d: ['For unmarried parents, rights come from paternity: an acknowledgment or a court order.', 'Texas courts may not prefer a parent because of sex. We explain conservatorship.', 'A SAPCR sets conservatorship, possession and child support for unmarried parents.'],
        meta: { p: 'Custody for unmarried parents in {county} County: paternity and possession.', h: 'Custody for unmarried parents', d: 'Talk with a family lawyer' } },
      es: { h: ['Custodia de Menores', 'Padres No Casados', 'Establecer Paternidad'], d: ['Para padres no casados, los derechos vienen de la paternidad reconocida o declarada.', 'Le explicamos la custodia, el tiempo con los hijos y la manutención en Texas.'],
        meta: { p: 'Custodia para padres no casados en el condado de {county}.', h: 'Custodia para padres no casados', d: 'Consulta en español' } } },
    mod: { bn: 'modifications of support and custody orders', page: '/modification', path: 'modification', sl: 'Order Modifications', sld: ['Support and custody changes', 'Material change explained'], lsa: ['Child custody', 'Child support'],
      kwq: ['how to modify child support in texas', 'can child support be lowered after a job loss', 'how to change a custody order in texas', 'how often can child support be modified in texas'],
      kwEs: ['modificar manutención de menores', 'cambiar orden de custodia', 'abogado de modificación'],
      en: { h: ['Modify Child Support', 'Change a Custody Order', 'Support After a Job Loss', 'Order Modifications in Texas', 'Material Change Explained', 'Relocation and Custody'],
        d: ['A support order can change after a material and substantial change, such as a job loss.', 'Three years and a difference of 20 percent or 100 dollars from guidelines can also qualify.', 'We review your order, the change in circumstances and what a court can modify.'],
        meta: { p: 'Support and custody orders in {county} County can change when life does.', h: 'Modify a support or custody order', d: 'Talk with a family lawyer' } },
      es: { h: ['Modificar Manutención', 'Cambiar Orden de Custodia', 'Cambio Material'], d: ['La manutención puede cambiar tras un cambio material y sustancial, como perder el empleo.', 'Revisamos su orden y lo que un juez puede modificar.'],
        meta: { p: 'Las órdenes de manutención y custodia en el condado de {county} pueden cambiar.', h: 'Modificar manutención o custodia', d: 'Consulta en español' } } },
    enf: { bn: 'enforcement of support and possession orders', page: '/enforcement', path: 'enforcement', sl: 'Order Enforcement', sld: ['Unpaid child support', 'Possession orders'], lsa: ['Child support', 'Child custody'],
      kwq: ['how to enforce child support in texas', 'what happens when child support is not paid', 'how to enforce a custody order in texas', 'how is back child support collected in texas'],
      kwEs: ['cobrar manutención atrasada', 'hacer cumplir orden de custodia', 'abogado de manutención'],
      en: { h: ['Enforce Child Support', 'Unpaid Child Support Help', 'Enforce a Possession Order', 'Contempt Motions Explained', 'Child Support Arrears Help'],
        d: ['Unpaid child support accrues interest in Texas. We explain how a court can enforce it.', 'When a possession order is ignored, a court can enforce it. We explain the process.', 'Child support and possession are separate obligations; one does not cancel the other.'],
        meta: { p: 'Unpaid support and ignored possession orders in {county} County can be enforced.', h: 'Enforce a support or custody order', d: 'Talk with a family lawyer' } },
      es: { h: ['Cobrar Manutención', 'Hacer Cumplir la Orden', 'Manutención Atrasada'], d: ['La manutención no pagada acumula intereses en Texas. Le explicamos cómo se hace cumplir.', 'La manutención y el tiempo con los hijos son obligaciones separadas.'],
        meta: { p: 'Las órdenes no cumplidas en el condado de {county} se pueden hacer cumplir.', h: 'Hacer cumplir una orden', d: 'Consulta en español' } } },
    po: { bn: 'protective orders', page: '/protective-orders', path: 'protectiveorder', sl: 'Protective Orders', sld: ['Applicants and respondents', 'Family violence cases'], lsa: ['Domestic violence'],
      kwq: ['how to get a protective order in texas', 'how long does a protective order last in texas', 'how to respond to a protective order', 'what is family violence in texas'],
      kwEs: ['orden de protección texas', 'abogado orden de protección', 'abogado violencia familiar'],
      en: { h: ['Protective Order Help', 'Family Violence Lawyers', 'Respond to a Protective Order', 'Protective Orders in Texas', 'Talk With a Lawyer Today'],
        d: ['If you are in immediate danger, call 911. For a protective order, talk with our lawyers.', 'We represent applicants and respondents in family violence protective order hearings.', 'A protective order tied to a divorce or custody case can last beyond the final decree.'],
        meta: { p: 'Protective orders in {county} County, for applicants and respondents. In danger, call 911.', h: 'Protective order help', d: 'Talk with a family lawyer' } },
      es: { h: ['Orden de Protección', 'Violencia Familiar', 'Hable con un Abogado'], d: ['Si está en peligro inmediato, llame al 911. Para una orden de protección, llámenos.', 'Representamos a solicitantes y demandados en audiencias de órdenes de protección.'],
        meta: { p: 'Órdenes de protección en el condado de {county}. Si está en peligro, llame al 911.', h: 'Ayuda con órdenes de protección', d: 'Consulta en español' } } },
    ivd: { bn: 'child support and paternity cases', page: '/child-support', path: 'childsupport', sl: 'Child Support', sld: ['Attorney General cases', 'Paternity and support'], lsa: ['Child support', 'Paternity'],
      kwq: ['how is child support calculated in texas', 'attorney general child support hearing', 'how to establish paternity in texas', 'what is the child support cap in texas'],
      kwEs: ['abogado de manutención de menores', 'manutención de menores texas', 'prueba de paternidad texas'],
      en: { h: ['Child Support Hearing Help', 'Paternity and Child Support', 'Child Support Guidelines', 'Attorney General Cases', 'Establish Paternity in Texas'],
        d: ['A lawyer of your own at an Attorney General child support hearing. We explain options.', 'Guideline child support applies to net resources up to $11,700 a month since Sept. 2025.', 'Paternity can be established by an acknowledgment or by a court order.'],
        meta: { p: 'Child support and paternity cases in {county} County, including OAG hearings.', h: 'Child support and paternity help', d: 'Talk with a family lawyer' } },
      es: { h: ['Manutención de Menores', 'Paternidad y Manutención', 'Audiencia de Manutención'], d: ['Un abogado propio en su audiencia de manutención con el Procurador General.', 'La paternidad se establece con un reconocimiento o con una orden judicial.'],
        meta: { p: 'Casos de manutención y paternidad en el condado de {county}.', h: 'Manutención y paternidad', d: 'Consulta en español' } } },
    adopt: { bn: 'adoptions', page: '/adoption', path: 'adoption', sl: 'Adoption', sld: ['Stepparent and kinship', 'Adult adoption'], lsa: ['Adoption'],
      kwq: ['how does stepparent adoption work in texas', 'how much does a stepparent adoption cost in texas', 'can a grandparent adopt a grandchild in texas', 'how to adopt an adult in texas'],
      kwEs: ['abogado de adopción', 'adopción por padrastro texas', 'adopción de familiares'],
      en: { h: ['Stepparent Adoption', 'Kinship and Relative Adoption', 'Adoption Lawyers in Texas', 'Adopt a Grandchild', 'Adult Adoption in Texas'],
        d: ['Stepparent, kinship and adult adoptions, from termination through the final decree.', 'A child 12 or older generally must consent to an adoption in Texas. We explain each step.', 'We prepare the petition and guide your family through the hearing.'],
        meta: { p: 'Stepparent, kinship and adult adoptions in {county} County, step by step.', h: 'Adoption for Texas families', d: 'Talk with a family lawyer' } },
      es: { h: ['Adopción en Texas', 'Adopción por Padrastro', 'Adopción de Familiares'], d: ['Adopciones por padrastro o madrastra, familiares y adultos, paso a paso.', 'Un niño de 12 años o más generalmente debe dar su consentimiento.'],
        meta: { p: 'Adopciones por padrastro, familiares y adultos en el condado de {county}.', h: 'Adopción para familias en Texas', d: 'Consulta en español' } } },
    cps: { bn: 'CPS and termination defense', page: '/cps-defense', path: 'cpsdefense', sl: 'CPS Defense', sld: ['Investigations and removals', 'Adversary hearings'], lsa: ['Child custody'],
      kwq: ['what happens after a cps investigation in texas', 'how to get a child back from cps in texas', 'what is a cps adversary hearing', 'do i need a lawyer for a cps investigation'],
      kwEs: ['abogado de cps', 'investigación de cps texas', 'abogado defensa cps'],
      en: { h: ['CPS Investigation Defense', 'DFPS Removal Help', 'CPS Defense Lawyers', 'Termination Defense in Texas', 'Adversary Hearing Help'],
        d: ['After a removal, the adversary hearing comes within 14 days. Talk with a lawyer early.', 'We represent parents in DFPS investigations, removals and termination suits.', 'CPS cases move on a one year clock. Representation from the first contact matters.'],
        meta: { p: 'Parents facing a CPS investigation in {county} County: talk with a lawyer early.', h: 'CPS defense for parents', d: 'Talk with a family lawyer' } },
      es: { h: ['Defensa ante CPS', 'Investigación de CPS', 'Remoción de Menores'], d: ['Tras una remoción, la audiencia contradictoria se celebra dentro de 14 días.', 'Representamos a padres en investigaciones y casos de terminación.'],
        meta: { p: 'Padres ante una investigación de CPS en el condado de {county}: hable pronto.', h: 'Defensa ante CPS para padres', d: 'Consulta en español' } } },
    prenup: { bn: 'premarital and partition agreements', page: '/premarital-agreements', path: 'prenup', sl: 'Premarital Agreements', sld: ['Prenups and postnups', 'Partition agreements'], lsa: ['Prenuptial agreements'],
      kwq: ['how much does a prenup cost in texas', 'are prenups enforceable in texas', 'what can a prenup include in texas', 'what is a partition agreement in texas'],
      kwEs: ['acuerdo prenupcial texas', 'abogado acuerdo prenupcial'],
      en: { h: ['Texas Premarital Agreements', 'Prenup Lawyers in Texas', 'Postnuptial Agreements', 'Partition Agreements', 'Plan Property Before Marriage', 'Premarital Agreement {fee}'],
        d: ['Texas premarital agreements are enforced unless a statutory defense applies.', 'We draft and review prenups, postnups and partition agreements for Texas couples.', 'Separate property, a business or future income can be addressed before the wedding.'],
        meta: { p: 'Premarital and partition agreements for couples in {county} County.', h: 'Texas premarital agreements', d: 'Talk with a family lawyer' } },
      es: { h: ['Acuerdo Prenupcial', 'Acuerdos de Partición', 'Acuerdo Posnupcial'], d: ['Redactamos y revisamos acuerdos prenupciales y posnupciales en Texas.', 'Los bienes separados o un negocio se pueden definir antes de la boda.'],
        meta: { p: 'Acuerdos prenupciales para parejas en el condado de {county}.', h: 'Acuerdos prenupciales en Texas', d: 'Consulta en español' } } },
    high: { bn: 'divorces with complex property', page: '/high-asset-divorce', path: 'highasset', sl: 'Complex Property', sld: ['Business and stock plans', 'Separate property tracing'], lsa: ['Divorce'],
      kwq: ['how is a business divided in a texas divorce', 'are stock options community property in texas', 'how to prove separate property in texas', 'what is a reimbursement claim in a texas divorce'],
      kwEs: ['abogado de divorcio con bienes', 'divorcio con negocio texas'],
      en: { h: ['High Asset Divorce', 'Business Owner Divorce', 'Separate Property Tracing', 'Stock Plans and Divorce', 'Complex Property Division', 'Reimbursement Claims'],
        d: ['Business interests, stock plans and real estate, characterized and valued under Texas law.', 'Separate property must be proved by clear and convincing evidence; tracing is the work.', 'Reimbursement claims, valuation and a just and right division of the community estate.'],
        meta: { p: 'Divorce with a business, stock plans or real estate in {county} County.', h: 'Divorce with complex property', d: 'Talk with a family lawyer' } },
      es: { h: ['Divorcio con Bienes', 'Divorcio de Empresarios', 'Bienes Separados'], d: ['Negocios, acciones e inmuebles, clasificados y valuados según la ley de Texas.', 'Los bienes separados se prueban con evidencia clara y convincente.'],
        meta: { p: 'Divorcios con negocios, acciones o inmuebles en el condado de {county}.', h: 'Divorcio con bienes complejos', d: 'Consulta en español' } } },
    mil: { bn: 'military divorces', page: '/military-divorce', path: 'military', sl: 'Military Divorce', sld: ['Deployment and custody', 'Retirement division'], lsa: ['Divorce'],
      kwq: ['how does military divorce work in texas', 'how is military retirement divided in a texas divorce', 'can you file for divorce while deployed', 'where to file for a military divorce in texas'],
      kwEs: ['divorcio militar texas', 'abogado divorcio militar'],
      en: { h: ['Military Divorce in Texas', 'Military Divorce, {base}', 'Deployment and Custody Plans', 'Military Retirement Division', 'SCRA Rights in Divorce', 'Service Member Divorce'],
        d: ['Residency, deployment and the Servicemembers Civil Relief Act in a Texas divorce.', 'Military retirement is divided under the USFSPA and Texas law. We explain how.', 'Custody plans that account for deployment, relocation and changes of station.'],
        meta: { p: 'Military divorce in {county} County: deployment, custody and retirement.', h: 'Military divorce in Texas', d: 'Talk with a family lawyer' } },
      es: { h: ['Divorcio Militar', 'Retiro Militar y Divorcio', 'Despliegue y Custodia'], d: ['Residencia, despliegue y la ley SCRA en un divorcio en Texas.', 'El retiro militar se divide según la ley USFSPA y la ley de Texas.'],
        meta: { p: 'Divorcio militar en el condado de {county}: despliegue, custodia y retiro.', h: 'Divorcio militar en Texas', d: 'Consulta en español' } } },
    gray: { bn: 'divorces after 50', page: '/divorce-after-50', path: 'divorceafter50', sl: 'Divorce After 50', sld: ['Retirement and pensions', 'Spousal maintenance'], lsa: ['Divorce'],
      kwq: ['how is retirement divided in a texas divorce', 'what is a qdro in texas', 'how does spousal maintenance work in texas', 'divorce after 50 in texas'],
      kwEs: ['divorcio y retiro texas', 'abogado de divorcio pensiones'],
      en: { h: ['Divorce After 50', 'Retirement Accounts in Divorce', 'QDROs and Pensions Explained', 'Spousal Maintenance in Texas', 'Gray Divorce Explained'],
        d: ['Pensions, retirement accounts and QDROs, divided as part of a just and right division.', 'Spousal maintenance in Texas is limited by statute; we explain eligibility and caps.', 'Health coverage, the family home and retirement income, planned before the decree.'],
        meta: { p: 'Gray divorce in {county} County: retirement accounts, pensions and maintenance.', h: 'Retirement and divorce, explained', d: 'Talk with a family lawyer' } },
      es: { h: ['Divorcio y Jubilación', 'Retiro y Pensiones', 'Manutención Conyugal'], d: ['Pensiones, cuentas de retiro y QDRO, divididas de manera justa y correcta.', 'La manutención conyugal en Texas tiene límites por ley.'],
        meta: { p: 'Divorcio en el condado de {county}: retiro, pensiones y manutención conyugal.', h: 'Retiro y divorcio en Texas', d: 'Consulta en español' } } }
  };
  /* copy every campaign shares, filled from the firm profile; a line only states a fact the profile holds */
  const SHARED = {
    en: { h: c => ['{firm}', 'Serving {county} County', 'Office in {city}, Texas', 'Serving {mcity}', 'Talk With a Family Lawyer'].concat(c.virtual ? ['Consultations by Video'] : []).concat(c.free ? ['Free Consultation'] : c.cfee ? ['Consultation Fee {cfee}'] : []).concat(c.plans ? ['Payment Plans Available'] : []).concat(c.es ? ['Se Habla Español'] : []),
      d: c => [c.virtual ? 'Consultations in person or by video. Call or request a time online.' : 'Call or request a consultation time online.', 'Serving {county} County families from our {city} office.'],
      callouts: c => (c.virtual ? ['Video Consultations'] : []).concat(c.free ? ['Free Consultations'] : []).concat(c.plans ? ['Payment Plans'] : []).concat(c.es ? ['Se Habla Español'] : []).concat(['Office in {city}', 'Family Law Practice']),
      snippet: 'Service catalog', cities: 'Neighborhoods', cta: 'Talk with a family lawyer' },
    es: { h: c => ['{firm}', 'Oficina en {city}, Texas', 'Condado de {county}', 'Atendemos {mcity}', 'Hable con un Abogado', 'Consulta en Español'].concat(c.virtual ? ['Consultas por Video'] : []).concat(c.free ? ['Consulta Gratis'] : c.cfee ? ['Consulta de {cfee}'] : []).concat(c.plans ? ['Planes de Pago'] : []),
      d: c => [c.virtual ? 'Consultas en persona o por video. Llame o pida una cita en línea.' : 'Llame o pida una cita en línea.', 'Atendemos familias del condado de {county} desde {city}.'],
      callouts: c => ['Consulta en Español'].concat(c.virtual ? ['Consultas por Video'] : []).concat(c.free ? ['Consulta Gratis'] : []).concat(c.plans ? ['Planes de Pago'] : []).concat(['Oficina en {city}', 'Abogados de Familia']),
      snippet: 'Service catalog', cities: 'Neighborhoods', cta: 'Hable con un abogado' }
  };
  const RECRUIT = { titles: ['Family Law Attorney', 'Associate Attorney', 'Family Law Paralegal', 'Paralegal', 'Legal Assistant'],
    intro: '{firm} is hiring family law attorneys and paralegals at our {city} office.', head: 'Family law attorney and paralegal roles in {city}' };
  const REFERRAL = { titles: ['Certified Public Accountant', 'Financial Advisor', 'Licensed Professional Counselor', 'Marriage and Family Therapist', 'Estate Planning Attorney', 'Mediator'],
    intro: '{firm} works with advisors and counselors whose clients face a family law matter in {county} County.', head: 'A family law firm to know in {county} County' };
  /* negatives: customer campaigns (the build 1 list), Spanish, and recruiting */
  const NEG = ['free', 'pro bono', 'legal aid', 'forms', 'form', 'pdf', 'template', 'do it yourself', 'diy', 'without a lawyer', 'pro se', 'how to become', 'salary', 'jobs', 'career', 'paralegal', 'school', 'degree', 'definition', 'meaning', 'statistics', 'rate', 'records', 'lookup', 'search records', 'public records', 'movie', 'song', 'lyrics', 'reddit', 'quotes', 'memes', 'wedding', 'anniversary', 'counseling', 'therapist', 'church', 'texas law help', 'texaslawhelp'];
  const NEG_ES = ['gratis', 'formularios', 'formulario', 'pdf', 'plantilla', 'sin abogado', 'trabajo', 'empleo', 'salario', 'curso', 'significado', 'canción', 'película'];
  const NEG_RECRUIT = ['divorce', 'custody', 'child support', 'how to file', 'cost', 'price', 'near me', 'free', 'forms'];
  /* the divorce campaigns' phrase seeds ('divorce lawyer') also match military, high asset and gray divorce queries; when those lines run
     their own campaigns, the divorce campaigns carry these as negatives so each query lands in one campaign */
  const OVER_NEG = { high: ['high net worth', 'high asset', 'business owner', 'executive', 'stock options'], mil: ['military', 'deployment', 'deployed', 'fort hood', 'fort bliss', 'jbsa', 'usfspa', 'scra'], gray: ['after 50', 'gray divorce', 'grey divorce', 'qdro', 'pension', 'retirement'] };
  const OVER_NEG_ES = { high: ['negocio', 'empresa', 'acciones'], mil: ['militar', 'despliegue'], gray: ['jubilación', 'pensión', 'retiro'] };
  const freeConsult = M => !!(M && M.firm && M.firm.consult && M.firm.consult.free);
  /* campaign negatives for one line and language: 'free' and 'gratis' stay out when the firm offers free consultations (they would block
     'free consultation' searches the firm wants) */
  function negsFor(M, line, lang) {
    const free = freeConsult(M); let n = NEG.filter(k => !(free && k === 'free')); if (lang === 'es') n = n.concat(NEG_ES.filter(k => !(free && k === 'gratis')));
    const keys = ((M && M.lines) || []).map(l => l.key); if (line === 'div_k' || line === 'div_nk') Object.keys(OVER_NEG).forEach(o => { if (keys.includes(o)) n = n.concat(lang === 'es' ? OVER_NEG_ES[o] : OVER_NEG[o]); });
    return [...new Set(n)];
  }
  const BASES = { '48027': 'Fort Hood', '48099': 'Fort Hood', '48141': 'Fort Bliss', '48029': 'JBSA' };   // Fort Cavazos was renamed Fort Hood in 2025
  /* a keyword that names a base runs only where the plan targets the base's county */
  const BASE_KW = [[/\bfort (?:hood|cavazos)\b/i, ['48027', '48099']], [/\bfort bliss\b/i, ['48141']], [/\bjbsa\b|\bjoint base san antonio\b|\blackland\b|\bfort sam houston\b|\brandolph\b/i, ['48029']]];
  /* Local Services: the family law case types to switch on per line (names vary in the console; verify) and the Google Screened checklist */
  const LSA_CHECK = ['License check: every lawyer listed, by State Bar of Texas number and status', 'Background check on the firm and the lawyers, run through Google\'s screening partner', 'Business registration and the primary office address, matching the Business Profile', 'Reviews: the profile\'s own reviews, never incentivized', 'Answer the phone during the hours set; responsiveness drives ranking', 'Rule 7.04: file the profile and bio with the Advertising Review Committee unless exempt'];
  const SCHED = { all: { label: 'All hours', days: null }, extended: { label: 'Every day, 6 am to 11 pm', days: [['Monday', '06:00', '23:00'], ['Tuesday', '06:00', '23:00'], ['Wednesday', '06:00', '23:00'], ['Thursday', '06:00', '23:00'], ['Friday', '06:00', '23:00'], ['Saturday', '06:00', '23:00'], ['Sunday', '06:00', '23:00']] }, business: { label: 'Weekdays, 8 am to 6 pm', days: [['Monday', '08:00', '18:00'], ['Tuesday', '08:00', '18:00'], ['Wednesday', '08:00', '18:00'], ['Thursday', '08:00', '18:00'], ['Friday', '08:00', '18:00']] } };
  const schedString = k => { const s = SCHED[k] || SCHED.extended; return s.days ? s.days.map(d => `(${d[0]}[${d[1]}-${d[2]}])`).join(';') : ''; };

  /* ---- filling and the Rule 7.02(a) line */
  const PH = { firm: '[Firm name]', atty: '[Responsible attorney]', city: '[Office city]', phone: '[Phone]' };
  function fill(t, ctx, max) {
    if (t == null) return null; let miss = false;
    let s = String(t).replace(/\{(\w+)\}/g, (m, k) => { const v = ctx[k]; if (v != null && v !== '') return v; if (PH[k]) return PH[k]; miss = true; return m; });
    if (miss) return null; s = house(s);
    if (max && s.length > max) return null;
    return s;
  }
  function footerForms(ctx, lang) {
    const a = ctx.atty || PH.atty, c = ctx.city || PH.city;
    return lang === 'es' ? [`Abogado responsable: ${a}. Oficina principal: ${c}, Texas.`, `Abogado responsable ${a}, ${c}, Texas.`, `Abogado ${a}, ${c} TX.`, `${a}, ${c} TX`] : [`Responsible attorney: ${a}. Primary office: ${c}, Texas.`, `Responsible attorney ${a}, ${c}, Texas.`, `Attorney ${a}, ${c} TX.`, `${a}, ${c} TX`];
  }
  /* the longest Rule 7.02(a) form that fits in room characters; '' when none fits (the landing page then carries it) */
  function footer(ctx, room, lang) { const f = footerForms(ctx, lang).map(house).find(x => x.length <= room); return f || ''; }
  const join = (a, b) => (a && b ? a + ' ' + b : a || b || '');
  const LP_NOTE = 'Rule 7.02(a): the responsible lawyer and the primary office are on the landing page; the ad has no room for them.';
  function ctxFor(M, z, lang) {
    const F = M.firm || {};
    const mcity = (z && z.city) || (M.markets && M.markets[0] && M.markets[0].city) || '';
    const county = (z && z.county_name) || (M.geo && M.geo.county) || '';
    const cf = F.consult || {};
    return { firm: F.name || '', biz: F.name || '', atty: F.atty || '', city: F.city || '', mcity, county, phone: F.phone || '', url: F.url || '', base: BASES[(z && z.county) || (M.geo && M.geo.fips0)] || '', cfee: cf.fee > 0 ? money(cf.fee) : '', free: !!cf.free, virtual: !!cf.virtual, plans: /plan/i.test(F.payment || ''), es: (M.langs || []).includes('es'), lang: lang || 'en', fees: F.fees || {}, pay: (M.plan && M.plan.pay) || '' };
  }
  const feeFor = (ctx, line) => { const v = ctx.fees && +ctx.fees[line]; return v > 0 ? money(v) : ''; };
  function dedupe(list, n) { const seen = new Set(), out = []; list.forEach(x => { if (!x) return; const k = x.toLowerCase(); if (seen.has(k) || out.length >= n) return; seen.add(k); out.push(x); }); return out; }

  /* ---- responsive search ad: up to 15 headlines and 4 descriptions; description 1 is the Rule 7.02(a) line, pinned */
  function rsa(M, line, z, lang, platform) {
    const p = platform || 'google'; const ctx = Object.assign(ctxFor(M, z, lang), { fee: feeFor(ctxFor(M, z, lang), line) }); const L = LIB[line]; const C = (L && L[lang]) || (L && L.en); const S = SHARED[lang] || SHARED.en;
    const hmax = limit(p, 'headline'), dmax = limit(p, 'description'), pmax = limit(p, 'path');
    const h = dedupe(C.h.map(t => fill(t, ctx, hmax)).concat(S.h(ctx).map(t => fill(t, ctx, hmax))), 15);
    const foot = footer(ctx, dmax, lang);
    const d = dedupe([foot].concat((C.d || []).map(t => fill(t, ctx, dmax))).concat(S.d(ctx).map(t => fill(t, ctx, dmax))), 4);
    const city = ((z && z.city) || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, pmax);
    return { h, d, path1: (L.path || '').slice(0, pmax), path2: city, pinned: !!foot, lp: !foot };
  }
  /* social and display copy for one platform, line and language: the fields the platform takes, already cut to its limits */
  function social(M, platform, line, lang, z) {
    const ctx = Object.assign(ctxFor(M, z, lang), {}); ctx.fee = feeFor(ctx, line); const L = LIB[line]; const C = (L[lang] || L.en); const S = SHARED[lang] || SHARED.en; const mt = C.meta || L.en.meta;
    const body = (maxField, base) => { const b = fill(base, ctx, maxField) || ''; const f = footer(ctx, maxField - b.length - 1, lang); return { text: join(b, f), lp: !f }; };
    let fields = {}, lp = false;
    if (platform === 'meta') { const pr = body(limit('meta', 'primary'), mt.p); fields = { primary: pr.text, headline: fill(mt.h, ctx, limit('meta', 'headline')) || '', description: fill(mt.d, ctx, limit('meta', 'description')) || '' }; lp = pr.lp; }
    else if (platform === 'dg') { const hm = limit('dg', 'headline'), dm = limit('dg', 'description'); const hs = dedupe(C.h.map(t => fill(t, ctx, hm)).concat([fill(mt.h, ctx, hm)]).concat(S.h(ctx).slice(1, 3).map(t => fill(t, ctx, hm))), 5); const f = footer(ctx, dm, lang); const ds = dedupe([f].concat(C.d.map(t => fill(t, ctx, dm))), 5); hs.forEach((x, i) => fields['headline' + (i + 1)] = x); ds.forEach((x, i) => fields['description' + (i + 1)] = x); fields.business = ctx.firm || PH.firm; lp = !f; }
    else if (platform === 'yelp') { const pr = body(limit('yelp', 'body'), join(mt.p, fill(C.d[1] || C.d[0], ctx) || '')); fields = { headline: fill(mt.h, ctx, limit('yelp', 'headline')) || '', body: pr.text }; lp = pr.lp; }
    else if (platform === 'nextdoor') { const pr = body(limit('nextdoor', 'body'), join(mt.p, fill(C.d[2] || C.d[1] || C.d[0], ctx) || '')); fields = { headline: fill(mt.h, ctx, limit('nextdoor', 'headline')) || '', body: pr.text }; lp = pr.lp; }
    else if (platform === 'tiktok') { const pr = body(limit('tiktok', 'text'), mt.h + '.'); fields = { text: pr.text, display_name: (ctx.firm || PH.firm).slice(0, limit('tiktok', 'display_name')) }; lp = pr.lp; }
    return { fields, lp, ctx };
  }
  function recruitAd(M, kind) { const ctx = ctxFor(M, M.markets && M.markets[0], 'en'); const R = kind === 'referral' ? REFERRAL : RECRUIT; const im = limit('linkedin', 'intro'); let intro = fill(R.intro, ctx, im) || ''; if (kind !== 'referral' && ctx.pay) { const w = intro + ' Pay: ' + house(ctx.pay) + '.'; if (w.length <= im) intro = w; } const f = footer(ctx, im - intro.length - 1, 'en'); return { fields: { intro: join(intro, f), headline: fill(R.head, ctx, limit('linkedin', 'headline')) || '' }, lp: !f, titles: R.titles }; }
  function lsaBio(M) {
    const ctx = ctxFor(M, null, 'en'); const and = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
    const list = and((M.lines || []).map(l => (LIB[l.key] && LIB[l.key].bn) || l.key)) || 'family law matters';
    const cty = and((M.serve || []).slice(0, 6));
    const t = `${ctx.firm || PH.firm} is a Texas family law practice with a primary office in ${ctx.city || PH.city}${cty ? ', serving ' + cty + ' counties' : ''}. We handle ${list}. ${ctx.virtual ? 'Consultations are available in person or by video. ' : ''}${ctx.es ? 'We serve clients in English and Spanish. ' : ''}${footer(ctx, 200, 'en')}`;
    return house(t).slice(0, limit('lsa', 'bio'));
  }
  /* ---- the screen: LINT.checkAd over the fields; a block finding makes the ad "needs review" with the findings as notes */
  function screen(platform, fields, lang, extra) {
    let findings = [];
    if (hasLint()) { try { findings = LINT.checkAd({ platform: LPLAT[platform] || platform, fields }, { lang: lang || 'en' }) || []; } catch (e) { findings = [{ id: 'lint', sev: 'warn', title: 'The compliance engine failed on this ad', rule: '', why: String(e && e.message || e) }]; } }
    else Object.keys(fields).forEach(k => { const max = limit(platform, k.replace(/\d+$/, '')); const v = String(fields[k] || ''); if (max && v.length > max) findings.push({ id: 'len_' + k, sev: 'block', title: `${k} is ${v.length} characters`, rule: `${platform} limit ${max}`, why: '' }); });
    (extra || []).forEach(x => findings.push(x));
    const counts = { block: 0, fix: 0, warn: 0, info: 0 }; findings.forEach(f => counts[f.sev] = (counts[f.sev] || 0) + 1);
    const block = counts.block > 0;
    const notes = findings.filter(f => f.sev !== 'info' || f.note).map(f => `${f.sev === 'block' ? 'BLOCK' : f.sev === 'fix' ? 'FIX' : f.sev === 'info' ? 'NOTE' : 'REVIEW'}: ${f.title}${f.rule ? ' (' + f.rule + ')' : ''}`).join('; ');
    return { findings, counts, block, status: block ? 'needs review' : 'ready', notes };
  }
  const urlNote = M => (M.firm && M.firm.url ? [] : [{ id: 'url', sev: 'block', title: 'No landing page URL', rule: 'Firm profile', why: 'Set the website in the firm profile (or the desk override); the ads have nowhere to send people.' }]);
  const lpNote = lp => (lp ? [{ id: 'r702a_lp', sev: 'info', note: true, title: LP_NOTE, rule: 'Rule 7.02(a)', why: '' }] : []);

  /* ---- CSV (RFC 4180: quote fields with a comma, a quote or a line break; double the quotes) */
  const csvQ = v => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function csv(header, rows) { return header.map(csvQ).join(',') + '\n' + rows.map(r => (Array.isArray(r) ? r : header.map(h => r[h])).map(csvQ).join(',')).join('\n') + (rows.length ? '\n' : ''); }
  const out = (name, header, objs) => { const rows = objs.map(o => header.map(h => o[h] == null ? '' : o[h])); return { name, header, rows, text: csv(header, rows) }; };

  /* ---- names and URLs */
  const ymd = iso => String(iso || '').replace(/-/g, '');
  const LANGN = { en: 'English', es: 'Spanish' };
  /* export names: severance_desk_<geography slug>_<flight start yyyy-mm-dd>_<what>.<ext> */
  const geoSlug = M => String((M.geo && (M.geo.slug || M.geo.title)) || 'texas').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'texas';
  const fname = (M, what, ext) => `severance_desk_${geoSlug(M)}_${M.start}_${what}.${ext}`;
  function campName(M, line, plat, lang) { return [M.geo && M.geo.code || 'TX', String(line).toUpperCase(), String(plat).toUpperCase(), String(lang || 'en').toUpperCase(), ymd(M.start)].join('_'); }
  function landing(M, line, src, camp, medium) { const base = (M.firm && M.firm.url || '').replace(/\/+$/, ''); if (!base) return ''; const pg = (LIB[line] && LIB[line].page) || ''; return `${base}${pg}?utm_source=${encodeURIComponent(src)}&utm_medium=${medium || 'cpc'}&utm_campaign=${encodeURIComponent(camp)}&utm_content=${encodeURIComponent(line)}`; }
  const spendOf = (M, p) => (M.plat && M.plat[p] && M.plat[p].spend) || 0;
  const langSplit = (M, lang) => (M.langs || ['en']).length > 1 ? (lang === 'es' ? M.esShare : 1 - M.esShare) : 1;
  const daily = (monthly) => (Math.max(0, monthly) / 30.4).toFixed(2);
  const bidStr = b => (b >= 0 ? '+' : '') + Math.round(b) + '%';

  /* ---- keywords: Core (seeds, exact and phrase), Questions (phrase), Local (two seeds crossed with each local modifier, exact).
     kwMods(M, lang) is the one list of modifiers the Local group uses and module 10 shows: up to six, the market cities first and the
     largest counties after them ("condado de" in Spanish). seedPlan sorts the line's seeds: question forms go to Questions, do it yourself
     seeds (papers, forms, calculators) are left out because the negatives block that intent, a seed that names a military base runs only
     where the plan targets the base's county, and the Local crosses use seeds with "Texas" and base names taken out, lawyer seeds first. */
  const DIY_RE = /\b(?:papers?|forms?|calculator|templates?|diy|do it yourself|pdf|free|gratis|formularios?)\b/i;
  const Q_RE = /^(?:how|what|when|where|who|why|can|do|does|is|are|should|will|c[oó]mo|qu[eé]|cu[aá]nto)\b/i;
  const LAWYER_RE = /\b(?:lawyers?|attorneys?|law firm|abogad[oa]s?)\b/i;
  const norm = k => String(k).toLowerCase().replace(/\s+/g, ' ').trim();
  function planFips(M) { const f = new Set(); ((M && M.counties) || []).forEach(k => k && k.fips && f.add(k.fips)); ((M && M.markets) || []).forEach(m => m && m.county && f.add(m.county)); if (M && M.geo && M.geo.fips0) f.add(M.geo.fips0); return f; }
  const namesBase = k => BASE_KW.some(([re]) => re.test(k));
  const baseOK = (k, fips) => BASE_KW.every(([re, fs]) => !re.test(k) || fs.some(x => fips.has(x)));
  function kwMods(M, lang) { return ((M && M.geoMods) || []).slice(0, 6).map(m => lang === 'es' ? String(m).replace(/^(.+) County$/, 'condado de $1') : m); }
  function seedPlan(M, line, lang) {
    const L = LIB[line] || {}; const raw = lang === 'es' ? (L.kwEs || []) : ((M.lineInfo && M.lineInfo[line] && M.lineInfo[line].kw) || []); const fips = planFips(M);
    const out = { core: [], questions: [], cross: [], left: [] };
    raw.forEach(k0 => { const k = norm(k0); if (!k) return;
      if (!baseOK(k, fips)) { out.left.push({ kw: k, why: 'names a base outside the plan' }); return; }
      if (DIY_RE.test(k)) { out.left.push({ kw: k, why: 'do it yourself intent' }); return; }
      if (Q_RE.test(k)) { out.questions.push(k); return; }
      out.core.push(k); });
    out.cross = [...new Set(out.core.filter(k => !namesBase(k)).map(k => k.replace(/\s*\b(?:in\s+)?texas\b\s*/gi, ' ').replace(/\s+/g, ' ').trim()).filter(k => k.split(' ').length >= 2 && !/\bnear me\b/.test(k)))].sort((a, b) => (LAWYER_RE.test(b) ? 1 : 0) - (LAWYER_RE.test(a) ? 1 : 0)).slice(0, 2);
    return out;
  }
  function keywords(M, line, lang) {
    const L = LIB[line]; const sp = seedPlan(M, line, lang); const mods = kwMods(M, lang); const out = [];
    const add = (group, kw, match) => { const k = norm(kw); if (k && !out.some(x => x.group === group && x.kw === k && x.match === match)) out.push({ group, kw: k, match }); };
    sp.core.forEach(k => { add('Core', k, 'Exact'); add('Core', k, 'Phrase'); });
    (lang !== 'es' ? (L.kwq || []) : []).concat(sp.questions).forEach(k => add('Questions', k, 'Phrase'));
    mods.forEach(gm => sp.cross.forEach(k => { add('Local', k + ' ' + gm, 'Exact'); add('Local', gm + ' ' + k, 'Exact'); }));
    return out;
  }

  /* ---- Google Ads Editor (and Microsoft Advertising Editor through Import from Google Ads) */
  const GH = ['Campaign', 'Campaign Type', 'Networks', 'Budget', 'Budget type', 'Languages', 'Bid Strategy Type', 'Start Date', 'End Date', 'Campaign Status', 'Location', 'ID', 'Bid Modifier', 'Criterion Type', 'Status', 'Ad Group', 'Ad Group Type', 'Max CPC', 'Ad Group Status', 'Keyword', 'Ad type'].concat([...Array(15)].map((_, i) => 'Headline ' + (i + 1))).concat([...Array(4)].map((_, i) => 'Description ' + (i + 1))).concat(['Path 1', 'Path 2', 'Final URL', 'Callout text', 'Sitelink text', 'Description line 1', 'Description line 2', 'Sitelink final URL', 'Header', 'Snippet values', 'Phone number', 'Country code']).concat(['Ad Schedule', 'Labels', 'Description 1 position', 'Review status', 'Review notes']);
  function searchRows(M, p) {
    const rows = []; const spend = spendOf(M, p); const sched = schedString(M.plan && M.plan.sched);
    (M.langs || ['en']).forEach(lang => (M.lines || []).forEach(li => {
      const line = li.key; const c = campName(M, line, p, lang); const monthly = spend * (li.share || 0) * langSplit(M, lang); const S = SHARED[lang] || SHARED.en; const ctx = ctxFor(M, M.markets && M.markets[0], lang);
      rows.push({ 'Campaign': c, 'Campaign Type': 'Search', 'Networks': 'Google search', 'Budget': daily(monthly), 'Budget type': 'Daily', 'Languages': LANGN[lang], 'Bid Strategy Type': 'Maximize conversions', 'Start Date': M.start, 'End Date': M.end, 'Campaign Status': 'Paused', 'Ad Schedule': sched });
      if (M.scope === 'counties') (M.counties || []).forEach(k => rows.push({ 'Campaign': c, 'Location': `${k.name} County, Texas, United States`, 'ID': p === 'google' ? (k.gt || '') : '', 'Bid Modifier': bidStr(k.bid || 0), 'Criterion Type': 'Location', 'Status': 'Enabled' }));
      else (M.markets || []).forEach(m => rows.push({ 'Campaign': c, 'Location': `${m.zip}, Texas, United States`, 'ID': p === 'google' ? (m.gt || '') : '', 'Bid Modifier': bidStr(m.bid || 0), 'Criterion Type': 'Location', 'Status': 'Enabled' }));
      negsFor(M, line, lang).forEach(k => rows.push({ 'Campaign': c, 'Keyword': k, 'Criterion Type': 'Negative Phrase', 'Status': 'Enabled' }));
      S.callouts(ctx).map(t => fill(t, ctx, limit(p, 'callout'))).filter(Boolean).forEach(t => rows.push({ 'Campaign': c, 'Callout text': t, 'Status': 'Enabled' }));
      const sls = [line].concat((M.lines || []).map(x => x.key).filter(k => k !== line)).slice(0, 4);
      sls.forEach(k => { const L = LIB[k]; const sm = limit(p, 'sitelink'), dm = limit(p, 'sitelink_desc') || 35; const txt = (lang === 'es' && fill(L.es.h[0], ctx, sm)) || fill(L.sl, ctx, sm); const d1 = lang === 'es' ? 'Consulta en español' : L.sld[0], d2 = lang === 'es' ? 'Hable con un abogado' : L.sld[1]; if (txt) rows.push({ 'Campaign': c, 'Sitelink text': txt, 'Description line 1': fill(d1, ctx, dm) || '', 'Description line 2': fill(d2, ctx, dm) || '', 'Sitelink final URL': landing(M, k, p, c), 'Status': 'Enabled' }); });
      const snip = (M.lines || []).map(x => fill(lang === 'es' ? LIB[x.key].es.h[0] : LIB[x.key].sl, ctx, limit(p, 'snippet') || 25)).filter(Boolean); if (snip.length >= 3) rows.push({ 'Campaign': c, 'Header': S.snippet, 'Snippet values': snip.slice(0, 10).join(';'), 'Status': 'Enabled' });
      const cities = [...new Set((M.markets || []).map(m => m.city).filter(x => x && x.length <= 25))]; if (cities.length >= 3) rows.push({ 'Campaign': c, 'Header': S.cities, 'Snippet values': cities.slice(0, 10).join(';'), 'Status': 'Enabled' });
      if (M.firm && M.firm.phone) rows.push({ 'Campaign': c, 'Phone number': M.firm.phone, 'Country code': 'US', 'Status': 'Enabled' });
      const cpcv = +(p === 'google' ? li.cpc : li.cpcMs); const maxcpc = cpcv > 0 ? cpcv.toFixed(2) : ''; const kws = keywords(M, line, lang); const z0 = (M.markets || [])[0];
      ['Core', 'Questions', 'Local'].forEach(gn => {
        const ks = kws.filter(k => k.group === gn); if (!ks.length) return; const ag = `${li.short || line} ${gn}`;
        rows.push({ 'Campaign': c, 'Ad Group': ag, 'Ad Group Type': 'Standard', 'Max CPC': maxcpc, 'Ad Group Status': 'Enabled' });
        ks.forEach(k => rows.push({ 'Campaign': c, 'Ad Group': ag, 'Keyword': k.kw, 'Criterion Type': k.match, 'Status': 'Enabled' }));
        const r = rsa(M, line, gn === 'Local' ? z0 : null, lang, p); const fields = {}; r.h.forEach((h, i) => fields['headline' + (i + 1)] = h); r.d.forEach((d, i) => fields['description' + (i + 1)] = d); fields.path1 = r.path1; fields.path2 = gn === 'Local' ? r.path2 : '';
        const sc = screen(p, fields, lang, urlNote(M).concat(lpNote(r.lp)));
        const o = { 'Campaign': c, 'Ad Group': ag, 'Ad type': 'Responsive search ad', 'Path 1': fields.path1, 'Path 2': fields.path2, 'Final URL': landing(M, line, p, c), 'Status': 'Paused', 'Labels': sc.block ? 'needs review' : '', 'Description 1 position': r.pinned ? '1' : '', 'Review status': sc.status, 'Review notes': sc.notes };
        r.h.forEach((h, i) => o['Headline ' + (i + 1)] = h); r.d.forEach((d, i) => o['Description ' + (i + 1)] = d); rows.push(o);
      });
    }));
    return rows;
  }
  const google = M => out(fname(M, 'google-ads-editor', 'csv'), GH, searchRows(M, 'google'));
  const microsoft = M => out(fname(M, 'microsoft-ads-import', 'csv'), GH, searchRows(M, 'microsoft'));

  /* ---- Local Services Ads build sheet */
  const LSA_H = ['Field', 'Value', 'Notes'];
  function lsa(M) {
    const F = M.firm || {}; const ctx = ctxFor(M, null, 'en'); const weekly = spendOf(M, 'lsa') / 4.345; const bio = lsaBio(M); const sc = screen('lsa', { bio }, 'en');
    const types = [...new Set((M.lines || []).flatMap(l => LIB[l.key].lsa))];
    const area = M.scope === 'counties' ? (M.counties || []).map(k => k.name + ' County').join('; ') : (M.markets || []).map(m => m.zip).join(' ');
    const rows = [
      { Field: 'Business name', Value: F.name || PH.firm, Notes: F.name ? '' : 'Fill the firm profile' },
      { Field: 'Category', Value: 'Family law', Notes: 'Local Services legal category' },
      { Field: 'Case types to turn on', Value: types.join('; '), Notes: 'From the lines in this plan; names vary in the console, verify (grade D)' },
      { Field: 'Weekly budget', Value: Math.round(weekly), Notes: `From ${money(spendOf(M, 'lsa'))} a month on Local Services` },
      { Field: 'Service area type', Value: M.scope === 'counties' ? 'Counties' : 'ZIP codes', Notes: '' },
      { Field: 'Service area', Value: area, Notes: M.scope === 'counties' ? '' : `${(M.markets || []).length} ZIPs from the plan` },
      { Field: 'Primary office', Value: [F.street, F.city, F.zip].filter(Boolean).join(', ') || PH.city, Notes: 'Must match the Business Profile' },
      { Field: 'Phone', Value: F.phone || PH.phone, Notes: 'The number Google forwards leads to' },
      { Field: 'Hours', Value: F.hours || 'Set to the hours the phone is actually answered', Notes: 'Leads outside these hours go to voicemail and hurt ranking' },
      { Field: 'Languages', Value: (M.langs || ['en']).map(l => LANGN[l]).join(', '), Notes: '' },
      { Field: 'Lawyers to list', Value: (F.lawyers || []).filter(a => a.name).map(a => `${a.name}${a.bar_no ? ' (State Bar ' + a.bar_no + ')' : ''}`).join('; ') || PH.atty, Notes: 'Each listed lawyer goes through the license check' },
      { Field: 'Bio', Value: bio, Notes: `${bio.length} of ${limit('lsa', 'bio')} characters` }
    ].concat(LSA_CHECK.map((x, i) => ({ Field: 'Google Screened checklist ' + (i + 1), Value: x, Notes: 'Confirm in the console' })))
      .concat([{ Field: 'Status', Value: 'Paused', Notes: 'Turn on after review' }, { Field: 'Review status', Value: sc.status, Notes: sc.notes }]);
    return out(fname(M, 'lsa-build-sheet', 'csv'), LSA_H, rows);
  }

  /* ---- YouTube and Demand Gen build sheet */
  const DG_H = ['Campaign', 'Campaign Type', 'Budget', 'Budget type', 'Start Date', 'End Date', 'Campaign Status', 'Locations', 'Location IDs', 'Targeting', 'Ad Group', 'Ad Name', 'Business name'].concat([1, 2, 3, 4, 5].map(i => 'Headline ' + i)).concat([1, 2, 3, 4, 5].map(i => 'Description ' + i)).concat(['Final URL', 'Call to action', 'Video brief', 'Status', 'Review status', 'Review notes']);
  function locs(M, ids) { if (M.scope === 'counties') return (M.counties || []).map(k => ids ? (k.gt || '') : k.name + ' County, Texas').join('; '); return (M.markets || []).map(m => ids ? (m.gt || '') : m.zip).join(ids ? '; ' : ' '); }
  function dg(M) {
    const rows = []; const spend = spendOf(M, 'dg');
    (M.langs || ['en']).forEach(lang => (M.lines || []).forEach(li => {
      const c = campName(M, li.key, 'dg', lang); const s = social(M, 'dg', li.key, lang, (M.markets || [])[0]); const sc = screen('dg', s.fields, lang, urlNote(M).concat(lpNote(s.lp)));
      const o = { 'Campaign': c, 'Campaign Type': 'Demand Gen', 'Budget': daily(spend * (li.share || 0) * langSplit(M, lang)), 'Budget type': 'Daily', 'Start Date': M.start, 'End Date': M.end, 'Campaign Status': 'Paused', 'Locations': locs(M, false), 'Location IDs': locs(M, true), 'Targeting': 'Locations, content topics (Law and Government) and placements; no audience segments on family difficulties', 'Ad Group': `${li.short || li.key} ${lang.toUpperCase()}`, 'Ad Name': `${li.short || li.key} ${lang.toUpperCase()} video`, 'Business name': s.fields.business, 'Final URL': landing(M, li.key, 'youtube', c), 'Call to action': lang === 'es' ? 'Más información' : 'Learn more', 'Video brief': house(`Fifteen seconds. A lawyer of the firm on camera at the ${s.ctx.city || PH.city} office, one line: "${s.fields.headline1 || ''}". End card: ${s.ctx.firm || PH.firm}, the responsible attorney and the primary office city. No dramatized client stories.`), 'Status': 'Paused', 'Review status': sc.status, 'Review notes': sc.notes };
      [1, 2, 3, 4, 5].forEach(i => { o['Headline ' + i] = s.fields['headline' + i] || ''; o['Description ' + i] = s.fields['description' + i] || ''; });
      rows.push(o);
    }));
    return out(fname(M, 'youtube-demand-gen', 'csv'), DG_H, rows);
  }

  /* ---- Meta Ads Manager import */
  const META_H = ['Campaign Name', 'Campaign Status', 'Campaign Objective', 'Special Ad Categories', 'Ad Set Name', 'Ad Set Run Status', 'Ad Set Daily Budget', 'Ad Set Time Start', 'Ad Set Time Stop', 'Zip', 'Radius', 'Age Min', 'Ad Name', 'Ad Status', 'Title', 'Body', 'Description', 'Link', 'Call to Action', 'Review status', 'Review notes'];
  function metaRadius(M) { const r = Math.max(1, Math.round(+(M.plan && M.plan.radius) || 15)); const offs = ((M.firm && M.firm.offices) || []).filter(o => o.city || o.zip); return (offs.length ? offs : [{ city: PH.city }]).map(o => `${[o.street, o.city, 'TX', o.zip].filter(Boolean).join(', ')} (+${r} mi)`).join('; '); }
  function meta(M) {
    const rows = []; const spend = spendOf(M, 'meta'); const radius = M.plan && M.plan.metaGeo === 'radius';
    const zips = M.scope === 'counties' ? (M.countyZips || []) : (M.markets || []).map(m => m.zip);
    (M.langs || ['en']).forEach(lang => { const c = campName(M, 'LEADS', 'meta', lang); (M.lines || []).forEach(li => {
      const s = social(M, 'meta', li.key, lang, (M.markets || [])[0]); const sc = screen('meta', s.fields, lang, urlNote(M).concat(lpNote(s.lp))); const as = campName(M, li.key, 'meta', lang);
      rows.push({ 'Campaign Name': c, 'Campaign Status': 'PAUSED', 'Campaign Objective': 'Outcome Leads', 'Special Ad Categories': '', 'Ad Set Name': as, 'Ad Set Run Status': 'PAUSED', 'Ad Set Daily Budget': daily(spend * (li.share || 0) * langSplit(M, lang)), 'Ad Set Time Start': M.start, 'Ad Set Time Stop': M.end, 'Zip': radius || !zips.length ? '' : zips.map(z => 'US:' + z).join(', '), 'Radius': radius || !zips.length ? metaRadius(M) : '', 'Age Min': 18, 'Ad Name': `${li.short || li.key} ${lang.toUpperCase()}`, 'Ad Status': 'PAUSED', 'Title': s.fields.headline, 'Body': s.fields.primary, 'Description': s.fields.description, 'Link': landing(M, li.key, 'meta', c, 'paid_social'), 'Call to Action': 'CONTACT_US', 'Review status': sc.status, 'Review notes': sc.notes });
    }); });
    return out(fname(M, 'meta-ads-import', 'csv'), META_H, rows);
  }

  /* ---- LinkedIn: recruiting and referral partner campaigns */
  const LI_H = ['Campaign Group', 'Campaign', 'Objective', 'Locations', 'Job titles', 'Daily budget', 'Start date', 'End date', 'Intro text', 'Headline', 'Status', 'Review status', 'Review notes'];
  function linkedin(M) {
    const use = (M.plan && M.plan.li) || 'both'; const kinds = use === 'both' ? ['recruit', 'referral'] : [use]; const spend = spendOf(M, 'linkedin'); const locName = (M.geo && M.geo.title) || 'Texas';
    const rows = kinds.map(k => { const a = recruitAd(M, k); const sc = screen('linkedin', a.fields, 'en', lpNote(a.lp)); return { 'Campaign Group': k === 'referral' ? 'Referral partners' : 'Recruiting', 'Campaign': campName(M, k === 'referral' ? 'REFERRAL' : 'RECRUIT', 'linkedin', 'en'), 'Objective': k === 'referral' ? 'Website visits' : 'Job applicants', 'Locations': locName + ' Area', 'Job titles': a.titles.join('; '), 'Daily budget': daily(spend / kinds.length), 'Start date': M.start, 'End date': M.end, 'Intro text': a.fields.intro, 'Headline': a.fields.headline, 'Status': 'Paused', 'Review status': sc.status, 'Review notes': sc.notes }; });
    return out(fname(M, 'linkedin', 'csv'), LI_H, rows);
  }

  /* ---- Yelp, Nextdoor, TikTok build sheets */
  const YELP_H = ['Business name', 'Category', 'Service area', 'Monthly budget', 'Ad name', 'Headline', 'Body', 'Call to action', 'Landing URL', 'Status', 'Review status', 'Review notes'];
  function yelp(M) {
    const spend = spendOf(M, 'yelp'); const area = M.scope === 'counties' ? (M.counties || []).map(k => k.name + ' County').join('; ') : [...new Set((M.markets || []).map(m => m.city))].join('; ') + ' (' + (M.markets || []).map(m => m.zip).join(' ') + ')';
    const rows = (M.lines || []).map(li => { const s = social(M, 'yelp', li.key, 'en', (M.markets || [])[0]); const sc = screen('yelp', s.fields, 'en', urlNote(M).concat(lpNote(s.lp))); return { 'Business name': (M.firm && M.firm.name) || PH.firm, 'Category': 'Divorce and Family Law', 'Service area': area, 'Monthly budget': Math.round(spend * (li.share || 0)), 'Ad name': li.short || li.key, 'Headline': s.fields.headline, 'Body': s.fields.body, 'Call to action': 'Request a consultation', 'Landing URL': landing(M, li.key, 'yelp', campName(M, li.key, 'yelp', 'en')), 'Status': 'Paused', 'Review status': sc.status, 'Review notes': sc.notes }; });
    return out(fname(M, 'yelp', 'csv'), YELP_H, rows);
  }
  const ND_H = ['Campaign Name', 'Objective', 'Ad Group Name', 'ZIP codes', 'Daily budget', 'Start date', 'End date', 'Ad Name', 'Headline', 'Body', 'Call to action', 'Link', 'Status', 'Review status', 'Review notes'];
  function nextdoor(M) {
    const spend = spendOf(M, 'nextdoor'); const zips = M.scope === 'counties' ? (M.countyZips || []) : (M.markets || []).map(m => m.zip);
    const rows = (M.lines || []).map(li => { const c = campName(M, li.key, 'nextdoor', 'en'); const s = social(M, 'nextdoor', li.key, 'en', (M.markets || [])[0]); const sc = screen('nextdoor', s.fields, 'en', urlNote(M).concat(lpNote(s.lp))); return { 'Campaign Name': c, 'Objective': 'Website clicks', 'Ad Group Name': li.short || li.key, 'ZIP codes': zips.join(' '), 'Daily budget': daily(spend * (li.share || 0)), 'Start date': M.start, 'End date': M.end, 'Ad Name': (li.short || li.key) + ' ad', 'Headline': s.fields.headline, 'Body': s.fields.body, 'Call to action': 'Learn more', 'Link': landing(M, li.key, 'nextdoor', c, 'paid_social'), 'Status': 'Paused', 'Review status': sc.status, 'Review notes': sc.notes }; });
    return out(fname(M, 'nextdoor', 'csv'), ND_H, rows);
  }
  const TT_H = ['Campaign name', 'Objective', 'Budget mode', 'Ad group name', 'Location', 'ZIP codes', 'Age', 'Daily budget', 'Schedule start', 'Schedule end', 'Ad name', 'Display name', 'Ad text', 'Call to action', 'Destination URL', 'Status', 'Review status', 'Review notes'];
  function tiktok(M) {
    const spend = spendOf(M, 'tiktok'); const zips = M.scope === 'counties' ? (M.countyZips || []) : (M.markets || []).map(m => m.zip); const cities = M.scope === 'counties' ? (M.counties || []).map(k => k.name + ' County, TX') : [...new Set((M.markets || []).map(m => m.city + ', TX'))];
    const rows = []; (M.langs || ['en']).forEach(lang => (M.lines || []).forEach(li => { const c = campName(M, li.key, 'tiktok', lang); const s = social(M, 'tiktok', li.key, lang, (M.markets || [])[0]); const sc = screen('tiktok', s.fields, lang, urlNote(M).concat(lpNote(s.lp))); rows.push({ 'Campaign name': c, 'Objective': 'Lead generation', 'Budget mode': 'Daily', 'Ad group name': `${li.short || li.key} ${lang.toUpperCase()}`, 'Location': cities.slice(0, 20).join('; '), 'ZIP codes': zips.join(' '), 'Age': '18+', 'Daily budget': daily(spend * (li.share || 0) * langSplit(M, lang)), 'Schedule start': M.start, 'Schedule end': M.end, 'Ad name': `${li.short || li.key} ${lang.toUpperCase()} ad`, 'Display name': s.fields.display_name, 'Ad text': s.fields.text, 'Call to action': lang === 'es' ? 'Contáctanos' : 'Contact us', 'Destination URL': landing(M, li.key, 'tiktok', c, 'paid_social'), 'Status': 'Paused', 'Review status': sc.status, 'Review notes': sc.notes }); }));
    return out(fname(M, 'tiktok', 'csv'), TT_H, rows);
  }

  /* ---- every ad in the files, screened (the Screen all creative panel, the creative library export, module 11's feed) */
  function creative(M) {
    const all = []; const z0 = (M.markets || [])[0];
    (M.langs || ['en']).forEach(lang => (M.lines || []).forEach(li => {
      const line = li.key; const nm = li.name || line;
      ['google', 'microsoft'].forEach(p => { if (!spendOf(M, p) && p === 'microsoft') return; const r = rsa(M, line, z0, lang, p); const f = {}; r.h.forEach((h, i) => f['headline' + (i + 1)] = h); r.d.forEach((d, i) => f['description' + (i + 1)] = d); f.path1 = r.path1; f.path2 = r.path2; all.push({ platform: p, line, lang, label: `${PLAB[p]} · ${nm} · RSA`, fields: f, review: screen(p, f, lang, urlNote(M).concat(lpNote(r.lp))) }); });
      ['dg', 'meta', 'tiktok'].concat(lang === 'en' ? ['yelp', 'nextdoor'] : []).forEach(p => { const s = social(M, p, line, lang, z0); all.push({ platform: p, line, lang, label: `${PLAB[p]} · ${nm}`, fields: s.fields, review: screen(p, s.fields, lang, urlNote(M).concat(lpNote(s.lp))) }); });
    }));
    const bio = lsaBio(M); all.push({ platform: 'lsa', line: '', lang: 'en', label: `${PLAB.lsa} · bio`, fields: { bio }, review: screen('lsa', { bio }, 'en') });
    const use = (M.plan && M.plan.li) || 'both'; (use === 'both' ? ['recruit', 'referral'] : [use]).forEach(k => { const a = recruitAd(M, k); all.push({ platform: 'linkedin', line: '', lang: 'en', label: `${PLAB.linkedin} · ${k === 'referral' ? 'referral partners' : 'recruiting'}`, fields: a.fields, review: screen('linkedin', a.fields, 'en', lpNote(a.lp)) }); });
    return all;
  }
  const CR_H = ['platform', 'line', 'language', 'ad', 'field', 'text', 'chars', 'limit', 'review status', 'review notes'];
  function creativeCSV(M) { const rows = []; creative(M).forEach(a => Object.keys(a.fields).forEach(k => rows.push({ platform: PLAB[a.platform], line: a.line, language: a.lang, ad: a.label, field: k, text: a.fields[k], chars: String(a.fields[k] || '').length, limit: limit(a.platform, k.replace(/\d+$/, '')) || '', 'review status': a.review.status, 'review notes': a.review.notes }))); return out(fname(M, 'creative-library', 'csv'), CR_H, rows); }

  /* ---- pacing. The flight runs from the start date for weeks*7 days; each day carries the line's season (shifted a month ahead for
     the consultation, none for protective orders) times the live timing multiplier when LIVE is present. */
  function flightMonths(o) {
    const s = dateOfISO(o.start); if (!s) return [];
    const days = Math.max(1, Math.round(o.weeks || 1)) * 7; const lines = o.lines || []; const total = (o.budget || 0) * (o.weeks || 0) / 4.345;
    const months = []; const key = d => d.getFullYear() * 12 + d.getMonth(); const mi = {};
    const W = lines.map(() => 0); const perDay = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(s, i); const k = key(d); if (mi[k] == null) { mi[k] = months.length; months.push({ y: d.getFullYear(), m: d.getMonth(), days: 0, idxW: 0, multW: 0, wsum: 0, spend: 0, reasons: {} }); }
      const M = months[mi[k]]; M.days++; const row = [];
      lines.forEach((l, j) => {
        const seas = l.seas && l.seas.length === 12 ? l.seas : null; const idx = seas ? seas[(d.getMonth() + (l.shift == null ? 1 : l.shift)) % 12] : 100;
        let mult = 1, why = []; if (o.timing) { try { const t = o.timing(l.key, d, isoOf(d)); if (t && isFinite(+t.mult) && +t.mult > 0) { mult = +t.mult; why = t.reasons || []; } } catch (e) { mult = 1; } }
        const w = idx * mult; W[j] += w; row.push(w); const sh = l.share || 0; M.idxW += idx * sh; M.multW += mult * sh; M.wsum += sh;
        (Array.isArray(why) ? why : [why]).filter(Boolean).forEach(r => { const t = typeof r === 'string' ? r : (r.text || r.label || r.title || JSON.stringify(r)); M.reasons[t] = (M.reasons[t] || 0) + 1; });
      });
      perDay.push({ mi: mi[k], row });
    }
    perDay.forEach(pd => pd.row.forEach((w, j) => { const tot = total * (lines[j].share || 0); if (W[j] > 0) months[pd.mi].spend += tot * w / W[j]; }));
    return months.map(x => ({ y: x.y, m: x.m, label: MON[x.m] + ' ' + x.y, days: x.days, idx: x.wsum ? x.idxW / x.wsum : 100, mult: x.wsum ? x.multW / x.wsum : 1, spend: x.spend, reasons: Object.keys(x.reasons).map(t => ({ text: t, days: x.reasons[t] })).sort((a, b) => b.days - a.days) }));
  }
  /* twelve months from the flight start month, each line's budget spread by its season (the build 1 month plan, re-anchored) */
  function monthPlan(o) {
    const s = dateOfISO(o.start) || new Date(); const out = [];
    for (let i = 0; i < 12; i++) { const d = new Date(s.getFullYear(), s.getMonth() + i, 1, 12); const mo = d.getMonth(); let b = 0; (o.lines || []).forEach(l => { const seas = l.seas && l.seas.length === 12 ? l.seas : null; const tot = seas ? seas.reduce((a, v) => a + v, 0) : 1200; const idx = seas ? seas[(mo + (l.shift == null ? 1 : l.shift)) % 12] : 100; b += (l.budget || 0) * 12 * idx / tot; }); out.push({ y: d.getFullYear(), m: mo, label: MON[mo] + ' ' + d.getFullYear(), spend: b }); }
    return out;
  }
  const FL_H = ['month', 'days', 'season_index', 'live_multiplier', 'media_usd', 'live_reasons'];
  const flightCSV = (M, months) => out(fname(M, 'flight-pacing', 'csv'), FL_H, months.map(x => ({ month: x.label, days: x.days, season_index: x.idx.toFixed(1), live_multiplier: x.mult.toFixed(3), media_usd: Math.round(x.spend), live_reasons: x.reasons.map(r => `${r.text} (${r.days} d)`).join('; ') })));
  /* the build 1 exports, kept: keywords, negatives, ZIP targets, plan */
  /* the build 1 exports, in the Google Ads Editor layout: every row names its campaign (the Google search campaigns of the Editor file:
     one per line and language) and carries a status, so Editor attaches them; import the Editor file first, these add to its campaigns */
  const KW_H = ['Campaign', 'Ad Group', 'Keyword', 'Criterion Type', 'Status'];
  const kwCSV = M => out(fname(M, 'keywords', 'csv'), KW_H, (M.langs || ['en']).flatMap(lang => (M.lines || []).flatMap(li => { const c = campName(M, li.key, 'google', lang); return keywords(M, li.key, lang).map(k => ({ 'Campaign': c, 'Ad Group': `${li.short || li.key} ${k.group}`, 'Keyword': k.kw, 'Criterion Type': k.match, 'Status': 'Enabled' })).concat(negsFor(M, li.key, lang).map(k => ({ 'Campaign': c, 'Ad Group': '', 'Keyword': k, 'Criterion Type': 'Negative Phrase', 'Status': 'Enabled' }))); })));
  const negText = M => { const free = freeConsult(M); return NEG.filter(k => !(free && k === 'free')).concat((M.langs || []).includes('es') ? NEG_ES.filter(k => !(free && k === 'gratis')) : []).join('\n') + '\n'; };
  const ZIP_H = ['Campaign', 'Location', 'ID', 'Bid Modifier', 'Criterion Type', 'Status', 'Location type', 'City', 'County', 'Monthly allocation'];
  function zipCSV(M) {
    const locs = M.scope === 'counties' ? (M.counties || []).map(k => ({ Location: k.name + ' County, Texas, United States', ID: k.gt || '', bid: k.bid || 0, type: 'County', city: '', county: k.name, spend: '' })) : (M.markets || []).map(m => ({ Location: m.zip + ', Texas, United States', ID: m.gt || '', bid: m.bid || 0, type: 'Postal code', city: m.city, county: m.county_name, spend: m.spend != null ? Math.round(m.spend) : '' }));
    const rows = []; (M.langs || ['en']).forEach(lang => (M.lines || []).forEach(li => { const c = campName(M, li.key, 'google', lang); locs.forEach(x => rows.push({ 'Campaign': c, 'Location': x.Location, 'ID': x.ID, 'Bid Modifier': bidStr(x.bid), 'Criterion Type': 'Location', 'Status': 'Enabled', 'Location type': x.type, 'City': x.city, 'County': x.county, 'Monthly allocation': x.spend })); }));
    return out(fname(M, 'zip-targets', 'csv'), ZIP_H, rows);
  }
  const PLAN_H = ['geography', 'line', 'expected_matters', 'value_per_matter', 'share_pct', 'budget_month', 'leads_month', 'retained_month', 'matter_value_month', 'cpc', 'conversion_pct', 'retained_pct', 'rates_source', 'matters_counted', 'overlay_of', 'share_set_by', 'counts_source'];
  /* one row per line with its twelve month plan (from the flight start month) in the trailing columns, and a total row */
  function planCSV(M) {
    const lines = M.lines || []; const per = lines.map(r => monthPlan({ start: M.start, lines: [{ budget: r.budget, seas: r.seas, shift: r.shift }] }));
    const mcols = (per[0] || monthPlan({ start: M.start, lines: [] })).map(x => x.label + ' usd'); const head = PLAN_H.concat(mcols);
    const fx = (v, d) => isFinite(+v) ? (+v).toFixed(d) : '';
    const counted = r => (r.nNet != null ? r.nNet : r.n) || 0;
    const rows = lines.map((r, i) => { const o = { geography: M.geo && M.geo.title, line: r.name, expected_matters: Math.round(r.n || 0), value_per_matter: r.fee, share_pct: fx((r.share || 0) * 100, 1), budget_month: Math.round(r.budget || 0), leads_month: fx(r.leads || 0, 1), retained_month: fx(r.ret || 0, 2), matter_value_month: Math.round(r.rev || 0), cpc: r.cpc > 0 ? fx(r.cpc, 2) : '', conversion_pct: fx(r.cvr, 2), retained_pct: fx(r.retain, 1), rates_source: r.src || 'assumption', matters_counted: Math.round(counted(r)), overlay_of: r.overlay ? 'divorce with and without children' : '', share_set_by: r.pinned ? 'user' : 'model', counts_source: r.est ? 'includes estimates for counties that report no filings' : 'court filings and module 06 estimates' }; per[i].forEach((x, j) => o[mcols[j]] = Math.round(x.spend)); return o; });
    /* the total counts each matter once: the overlay lines (high asset, military, gray divorce) sit inside the divorce counts */
    if (lines.length) { const nTot = M.nTotal != null ? M.nTotal : lines.reduce((a, r) => a + counted(r), 0); const t = { geography: M.geo && M.geo.title, line: 'Total', expected_matters: Math.round(nTot), share_pct: fx(lines.reduce((a, r) => a + (r.share || 0), 0) * 100, 1), budget_month: Math.round(lines.reduce((a, r) => a + (r.budget || 0), 0)), leads_month: fx(lines.reduce((a, r) => a + (r.leads || 0), 0), 1), retained_month: fx(lines.reduce((a, r) => a + (r.ret || 0), 0), 2), matter_value_month: Math.round(lines.reduce((a, r) => a + (r.rev || 0), 0)), rates_source: '', matters_counted: Math.round(nTot), overlay_of: lines.some(r => r.overlay) ? 'each matter counted once' : '' }; mcols.forEach((c, j) => t[c] = Math.round(per.reduce((a, p) => a + p[j].spend, 0))); rows.push(t); }
    return out(fname(M, 'plan', 'csv'), head, rows);
  }

  return { PLATS, PLAB, ASM0, MIX0, MIX_BASE, PBOOK, LIB, SHARED, RECRUIT, REFERRAL, NEG, NEG_ES, NEG_RECRUIT, LSA_CHECK, SCHED, BASES,
    HEAD: { google: GH, microsoft: GH, lsa: LSA_H, dg: DG_H, meta: META_H, linkedin: LI_H, yelp: YELP_H, nextdoor: ND_H, tiktok: TT_H, creative: CR_H, flight: FL_H, keywords: KW_H, zips: ZIP_H, plan: PLAN_H },
    fname,
    limit, house, fill, footer, ctxFor, lineMix, rsa, social, recruitAd, lsaBio, screen, csv, csvQ, keywords, kwMods, seedPlan, negsFor, OVER_NEG, campName, landing, endDate, isoOf, dateOfISO, schedString,
    google, microsoft, lsa, dg, meta, linkedin, yelp, nextdoor, tiktok, creative, creativeCSV, flightMonths, monthPlan, flightCSV, kwCSV, negText, zipCSV, planCSV };
})();
