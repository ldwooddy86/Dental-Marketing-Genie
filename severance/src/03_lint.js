/* SEVERANCE compliance engine (LINT). One rule set with stable ids for every surface that sends copy out of the atlas: the Campaign
   Desk, the Site Forge, Publish and the Compliance Screen (module 11). It covers the Texas Disciplinary Rules of Professional Conduct,
   Part VII (7.01 to 7.06, effective July 1, 2021) and Rule 1.04(e), the family law facts that ads get wrong or that went stale, the
   Google and Meta policies on personal hardship and personal attributes, Spanish copy, unfilled placeholders, platform character limits
   and the house style (no hyphens or dashes in outbound copy). The contract is docs/ARCHITECTURE.md section 3; fields and functions
   may be added, never renamed or removed.
     LINT.screen(text, {kind, platform, lang, html, footer, solicitation, posture, homepage, field, house})
       → {findings:[{id, sev, title, rule, why, hit, at, fix:{from,to}|null, fam, n, hits, ctx, line, src_at, v, url, settle}],
          counts:{block, fix, warn, info}, pass, text, lang, html}
     LINT.fix(text, opts) → {text, applied:[{id, from, to}]}     deterministic corrections only; never invents facts
     LINT.house(text) → text                                      house style for outbound copy
     LINT.LIMITS[platform][field]; LINT.checkAd({platform, fields}, opts) → findings; LINT.screenAd(ad, opts) → a screen result
     LINT.RULES, LINT.rule(id), LINT.ALIAS (build 1 ids r01 to r21), LINT.SOURCES, LINT.CHANGES (the dated changes register),
     LINT.PLATFORMS, LINT.FILING, LINT.stripHTML, LINT.detectLang, LINT.splitBatch, LINT.parseAdsCSV, LINT.diff, LINT.firmItems
   Severity: block (pass is false until it is fixed), fix (a safe correction exists), warn (a person decides), info (a reminder).
   A finding can be a block and still carry a safe fix (a stale number): LINT.fix removes it. Rules that need the firm (the responsible
   lawyer, certifications, advertised fees, ratings, Spanish staff) read FIRM at call time and run only on our own copy: a call with a
   kind or posture 'self'. posture 'comp' (a competitor) and calls with neither (posture 'neutral') skip them and the house style. */
'use strict';
const SAMPLE_AD = `Texas's #1 Divorce Specialists. We guarantee the best outcome for you and your kids. Texas splits everything 50/50, but our expert attorneys have recovered millions for clients. Mothers get custody in Texas, and your child can choose at 12. Ask about legal separation and our no fee unless we win promise. Child support is capped at $9,200. Call today, divorced in 60 days.`;
const LINT = (() => {
  const VERSION = '2026-10-01';
  const SEVS = ['block', 'fix', 'warn', 'info'];
  const SEV_LABEL = { block: 'Blocks', fix: 'Fix', warn: 'Review', info: 'Info' };
  const rank = s => { const i = SEVS.indexOf(s); return i < 0 ? 9 : i; };
  const FIRM_ = () => (typeof FIRM !== 'undefined' && FIRM && typeof FIRM.get === 'function') ? FIRM : null;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---- where each rule comes from (links shown in module 11 and in the rule book export) */
  const fc = ch => ({ label: 'Tex. Fam. Code ch. ' + ch, url: `https://statutes.capitol.texas.gov/Docs/FA/htm/FA.${ch}.htm` });
  const SOURCES = {
    tdrpc: { label: 'Texas Disciplinary Rules of Professional Conduct, Part VII (Supreme Court of Texas Misc. Docket No. 21-9061, effective July 1, 2021)', url: 'https://www.txcourts.gov/media/1452266/219061.pdf' },
    ethics: { label: 'Texas Disciplinary Rules of Professional Conduct, full text (Texas Center for Legal Ethics)', url: 'https://www.legalethicstexas.com/' },
    sbot: { label: 'State Bar of Texas: Advertising Review, Find a Lawyer, grievances', url: 'https://www.texasbar.com/' },
    tbls: { label: 'Texas Board of Legal Specialization (certification search)', url: 'https://www.tbls.org/' },
    fc2: fc(2), fc4: fc(4), fc6: fc(6), fc7: fc(7), fc8: fc(8), fc85: fc(85), fc105: fc(105), fc153: fc(153), fc154: fc(154), fc156: fc(156), fc157: fc(157), fc160: fc(160), fc161: fc(161), fc261: fc(261),
    const1: { label: 'Texas Constitution, article I', url: 'https://statutes.capitol.texas.gov/Docs/CN/htm/CN.1.htm' },
    tlo: { label: 'Texas Legislature Online (bill status and history)', url: 'https://capitol.texas.gov/' },
    g_pers: { label: 'Google Ads, Personalized advertising policy (sensitive interest categories, personal hardships)', url: 'https://support.google.com/adspolicy/answer/143465' },
    g_edit: { label: 'Google Ads, Editorial policy', url: 'https://support.google.com/adspolicy/answer/6021546' },
    meta: { label: 'Meta Advertising Standards (personal attributes)', url: 'https://transparency.meta.com/policies/ad-standards/' },
    ftc465: { label: 'FTC rule on consumer reviews and testimonials, 16 CFR Part 465 (eCFR)', url: 'https://www.ecfr.gov/current/title-16/part-465' },
    tcpa: { label: 'Telephone Consumer Protection Act, 47 U.S.C. § 227', url: 'https://www.law.cornell.edu/uscode/text/47/227' },
    bc302: { label: 'Texas Business and Commerce Code ch. 302', url: 'https://statutes.capitol.texas.gov/Docs/BC/htm/BC.302.htm' },
    house: { label: 'Severance house style (docs/ARCHITECTURE.md, rule 8.2)', url: '' },
    limits: { label: 'Each platform\'s published ad specifications', url: '' }
  };

  /* ---- matching helpers. Spanish patterns use Unicode letter boundaries because \b does not see accented letters. */
  const esRe = src => new RegExp('(?<![\\p{L}\\d])(?:' + src + ')(?![\\p{L}\\d])', 'giu');
  const NEG_EN = /\b(?:no|not|never|cannot|can't|cant|won't|nobody|no one|neither|nor|isn't|doesn't|don't|didn't|aren't|wasn't|without|no longer|stop(?:ped)?|myth|misconception|untrue|false that)\b|n't\b/i;
  const NEG_ES = /(?<![\p{L}])(?:no|nunca|jamás|ningún|ninguna|ninguno|nadie|sin|tampoco|ya no|mito)(?![\p{L}])/iu;
  const SUF_MYTH = /^[^.!?\n;]{0,40}?\b(?:is a myth|are a myth|is not true|isn't true|are not true|is false|is wrong|is incorrect|does not exist|doesn't exist|do not exist|is not recognized|isn't recognized|is not the law|isn't the law|was repealed|has been repealed|no longer (?:applies|exists|accepted|accepts))\b|^[^.!?\n;]{0,40}?(?<![\p{L}])(?:es un mito|no es cierto|no existe|es falso|fue derogad[oa])(?![\p{L}])/iu;
  function clauseStart(t, at, max) { let s = at; const lim = Math.max(0, at - (max || 60)); while (s > lim && !/[.!?\n;:]/.test(t[s - 1])) s--; return s; }
  function isNeg(t, at, len, mode, lang) {
    const pre = t.slice(Math.max(clauseStart(t, at, 60), at - 45), at);
    if ((lang !== 'es' && NEG_EN.test(pre)) || (lang !== 'en' && NEG_ES.test(pre))) return true;
    if (mode === 'myth' && SUF_MYTH.test(t.slice(at + len, at + len + 90))) return true;
    return false;
  }
  function spansOf(re, t) { if (!re) return []; const out = []; const g = re.global ? re : new RegExp(re.source, re.flags + 'g'); g.lastIndex = 0; let m; while ((m = g.exec(t))) { if (!m[0]) { g.lastIndex++; continue; } out.push([m.index, m.index + m[0].length]); } return out; }
  const inSpans = (at, sp) => sp.some(s => at >= s[0] && at < s[1]);
  const sentenceStart = (t, at) => { let i = at - 1; while (i >= 0 && /[ \t"'“‘(]/.test(t[i])) i--; return i < 0 || /[.!?\n¿¡:]/.test(t[i]); };
  function caseLike(hit, rep, t, at) {
    if (!rep) return rep;
    const words = String(hit).trim().split(/\s+/);
    if (words.length > 1 && words.every(w => /^[\p{Lu}\d#$]/u.test(w))) return rep.replace(/(^|\s)(\p{Ll})/gu, (m, s, c) => s + c.toUpperCase());
    if (/^\p{Lu}/u.test(hit) && sentenceStart(t, at)) return rep[0].toUpperCase() + rep.slice(1);
    return rep;
  }
  /* URLs, emails, domains and a few official names keep their hyphens */
  const PROTECT = /\b(?:https?:\/\/|www\.)[^\s<>"']+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|law|legal|lawyer|attorney|us|gov|edu|info|co|io|biz)\b(?:\/[^\s<>"']*)?|\bTitle IV-D\b|\bIV-D\b|\bT-Mobile\b|\bChick-fil-A\b|\bJELD-WEN\b|\bCOVID-19\b/gi;

  /* ---- the firm, when the rule needs it (skipped in competitor posture) */
  /* posture: 'self' (our own outbound copy: a kind is set or posture 'self' is passed), 'comp' (a competitor's copy) or 'neutral'
     (text with neither, such as Competitor Watch observations): the firm comparisons run only on our own copy */
  const postureOf = o => o.posture === 'comp' ? 'comp' : (o.posture === 'self' || o.kind) ? 'self' : 'neutral';
  function firmCtx(o) {
    if (postureOf(o) !== 'self') return null; const F = FIRM_(); if (!F) return null;
    try { const g = F.get() || {}; const r = (F.responsible && F.responsible()) || {}; const p = (F.primary && F.primary()) || {}; const atts = (g.attorneys || []).filter(a => a && a.name);
      return { F, g, r, p, atts, certs: F.certs ? F.certs() : [], ready: F.ready ? !!F.ready() : !!(g.name && r.name && p.city), langs: g.languages || ['en'] }; } catch (e) { return null; }
  }

  /* ---- TBLS: the only special competence wording allowed (Rule 7.02(b)) */
  const TBLS_RE = /\bBoard[ -]Certified\b,?\s*(?:in\s+)?([A-Z][A-Za-z&' ]{2,60}?)\s*(?:[,\u2014\u2013-]|\bby\b)?\s*(?:by\s+)?(?:the\s+)?Texas Board of Legal Specialization\b/g;
  function tblsClaims(t) { const out = []; TBLS_RE.lastIndex = 0; let m; while ((m = TBLS_RE.exec(t))) out.push({ at: m.index, end: m.index + m[0].length, hit: m[0], area: m[1].trim().replace(/[,\s]+$/, '') }); return out; }
  const areaMatch = (a, b) => { const n = s => String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); const x = n(a), y = n(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

  /* ---- personal attribute and personal hardship assertions (second person) */
  const PA_EN = /\b(?:are you|you'?re|you are|r u)\s+(?:getting|going through|facing|considering|thinking (?:about|of)|in the middle of|dealing with|ready for|headed for)\s+(?:a\s+|an\s+|your\s+)?(?:divorced?|separated|separation|custody (?:battle|fight|case|dispute)|breakup|split|protective order|cps (?:case|investigation))\b|\b(?:are you|you'?re|you are)\s+(?:divorcing|separating|separated|being divorced|recently divorced|a victim of (?:domestic|family) violence|being abused)\b|\byour (?:divorce|custody (?:battle|case|fight|dispute)|ex(?:[ -](?:husband|wife|spouse|partner))?|failing marriage|marriage (?:is )?(?:ending|over|falling apart|in trouble)|separation|protective order|cps case|abuser|abusive (?:husband|wife|spouse|partner))\b/gi;
  const PA_ES = esRe('¿?(?:se está|te estás|está usted|está|estás) (?:divorciando|separando)\\??|(?:está|estás) (?:pasando por|enfrentando) (?:un |una |su |tu )?(?:divorcio|separación|batalla por la custodia)|(?:su|tu) (?:divorcio|separación|ex(?: esposo| esposa| pareja)?|caso de custodia|batalla por la custodia|abusador)');
  function paHits(t, ctx) { const out = []; [PA_EN].concat(ctx.langSet === 'en' ? [] : [PA_ES]).forEach(re => { re.lastIndex = 0; let m; while ((m = re.exec(t))) { if (!m[0]) { re.lastIndex++; continue; } if (!inSpans(m.index, ctx.protect)) out.push({ at: m.index, hit: m[0] }); } }); return out.sort((a, b) => a.at - b.at); }

  /* ---- the rules. Fields: id, alias (build 1 id), fam, sev, t (title), rule (citation), why, re | test(t, ctx), lang (en | es | any),
     skip (contexts that clear a hit), neg (true | 'myth': a negation in the clause clears it), when (the copy must be about this),
     kinds, plats, needKind, self (needs the firm, self audit only), html (raw HTML tests), fix (replacement for the hit, or a function),
     v (✔ cited in Severance from the primary text, ◐ platform policy or secondary source: verify before a finding goes out),
     src (SOURCES key), settle (what would settle a candidate), obs (false: not observable from copy, a checklist item) */
  const TX = 'Texas Rules', FACT = 'Family law facts', STALE = 'Stale facts', PLAT = 'Ad platforms', HOUSE = 'House style', WEB = 'Web', CONS = 'Consumer law', FIL = 'Filing';
  const LAWYER_N = '(?:(?:divorce|custody|child custody|family law|family)\\s+)?(?:attorneys?|lawyers?|counsel|representation|advice|guidance|help|team|legal team|advocates?)';
  const SPEC_AREA = '(?:child custody|family law|divorce|custody|family|adoption|cps|protective order|military divorce|high asset divorce)';
  const DEFS = [
    { id: 'guarantee', alias: 'r01', fam: TX, sev: 'block', t: 'Outcome guarantee', rule: 'Rule 7.01(a)', src: 'tdrpc', v: '✔', lang: 'en', neg: true,
      re: /\b(?:guarantee[sd]?|guaranteed|guaranteeing|we promise|promise you|will win|win your case|winning is certain|100% success(?: rate)?|assured (?:outcome|result|results|win|victory)|we (?:always|never) (?:win|lose))\b/gi,
      why: 'A guarantee creates an unjustified expectation about results and is a false or misleading communication. State what the firm does, not what the court will do. The sentence is flagged, never rewritten: no disclaimer cures a guarantee.', settle: 'Rewrite the sentence around what the firm does; nothing settles a promised outcome.' },
    { id: 'competence', alias: 'r02', fam: TX, sev: 'block', t: 'Special competence claim', rule: 'Rule 7.02(b)', src: 'tdrpc', v: '✔', lang: 'en',
      re: new RegExp(`\\b${SPEC_AREA}\\s+specialists?\\b|\\bspecialists?\\b|\\bspeciali[sz](?:e|es|ed|ing)(?:\\s+in)?\\b|\\bexperts?(?:\\s+(?:in|on))?(?:\\s+${LAWYER_N})?\\b|\\bexpertise\\b`, 'gi'),
      skip: /\bexpert (?:witness(?:es)?|testimony|reports?|opinions?)\b|\b(?:financial|tax|mental health|medical|forensic|valuation|appraisal|business valuation|custody evaluation|child development|parenting) experts?\b|\bBoard[ -]Certified\b[^.\n]{0,90}Texas Board of Legal Specialization/gi,
      fix: (h) => { let m;
        if ((m = h.match(new RegExp(`^(${SPEC_AREA})\\s+specialists?$`, 'i')))) { const a = m[1].toLowerCase(); return 'practice focused on ' + (a === 'family' ? 'family law' : a === 'cps' ? 'CPS defense' : a); }
        if (/^speciali[sz]es in$/i.test(h)) return 'focuses on'; if (/^speciali[sz]e in$/i.test(h)) return 'focus on'; if (/^speciali[sz]ing in$/i.test(h)) return 'focusing on'; if (/^speciali[sz]ed in$/i.test(h)) return 'focused on';
        if ((m = h.match(new RegExp(`^experts?\\s+(${LAWYER_N})$`, 'i')))) return m[1];
        if (/^experts (?:in|on)$/i.test(h)) return 'lawyers focused on'; if (/^expertise$/i.test(h)) return 'experience';
        return null; },
      why: 'Only "Board Certified, [area], Texas Board of Legal Specialization" (or a TBLS accredited organization\'s certification) may be claimed. "Specialist", "specializing", "expert" and "certified" outside that form are prohibited; "practice focused on family law" is fine. The safe fix rewrites the common forms; a bare "specialist" needs a person.', settle: 'Which lawyer, which certification, which organization? Without a TBLS certificate, rewrite as "practice focused on".' },
    { id: 'certified', fam: TX, sev: 'warn', t: '"Certified" without the TBLS form', rule: 'Rule 7.02(b)', src: 'tbls', v: '✔', lang: 'en', test: certifiedTest,
      why: 'A certification claim must use the exact form "Board Certified, [area], Texas Board of Legal Specialization" and must be true for the lawyer named. "Certified" alone, or "Board Certified" without the board, is incomplete. The safe fix completes the form only when the firm profile holds that certification.', settle: 'Which organization certified whom? The TBLS search result for the lawyer named.' },
    { id: 'tbls_unsupported', fam: TX, sev: 'block', t: 'Board certification the firm profile does not hold', rule: 'Rule 7.02(b) and 7.01(a)', src: 'tbls', v: '✔', lang: 'any', self: true, test: tblsUnsupportedTest,
      why: 'The copy claims a Texas Board of Legal Specialization certification that no lawyer in the firm profile holds (the Firm button, TBLS board certification area). Either the profile is incomplete or the claim is false.', settle: 'Add the certification to the lawyer in the firm profile after checking the TBLS search, or remove the claim.' },
    { id: 'cert_attrib', fam: TX, sev: 'warn', t: 'Certification not tied to the lawyer who holds it', rule: 'Rule 7.02(b)', src: 'tbls', v: '◐', lang: 'any', self: true, test: certAttribTest,
      why: 'A Board Certified claim belongs to a lawyer, not to the firm. Name the certified lawyer next to the claim so a reader does not assume every lawyer in the firm holds it.', settle: 'Put the certified lawyer\'s name beside the claim.' },
    { id: 'superlative', alias: 'r03', fam: TX, sev: 'warn', t: 'Unverifiable superlative', rule: 'Rule 7.01(a)', src: 'tdrpc', v: '✔', lang: 'en',
      re: /\bthe best\b(?!\s+interests?\b)|\bbest (?:(?:divorce|family law|family|custody|child custody)\s+)?(?:lawyers?|attorneys?|law firm|firm)\b|\btop[ -]rated\b|\btop (?:divorce|family law|custody) (?:lawyers?|attorneys?|firm)\b|\bpremier\b|\bleading (?:(?:divorce|family law|family|custody)\s+)?(?:law firm|firm|lawyers?|attorneys?|advocates?|practice)\b|\bmost (?:experienced|trusted|successful|respected)\b|\bunmatched\b|\bunbeatable\b|\bsecond to none\b|\bfinest\b/gi,
      fix: (h, t, at) => { if (/^the best$/i.test(h)) return /^\s+(?:(?:divorce|family law|family|custody|child custody)\s+)?(?:lawyers?|attorneys?|law firm|firm)\b/i.test(t.slice(at + h.length)) ? h.slice(0, 3) : null; if (/^best\s/i.test(h)) return h.replace(/^best\s+/i, ''); if (/^premier$/i.test(h)) return /^\s+\p{L}/u.test(t.slice(at + h.length)) ? '' : null; if (/^leading\s/i.test(h)) return h.replace(/^leading\s+/i, ''); return null; },
      why: 'Comparative and superlative claims must be objectively verifiable. "Best", "premier" and "top rated" are not; a named award with its year and source can be. "The best interest of the child" is the statutory standard and is never flagged.', settle: 'Ask for the basis: the ranking, its source and its year.' },
    { id: 'number_one', fam: TX, sev: 'block', t: '"#1" or "number one"', rule: 'Rule 7.01(a)', src: 'tdrpc', v: '✔', lang: 'any',
      re: /#\s?1\b|\bnumber one\b|\bno\.\s?1\b|(?<![\p{L}])número uno(?![\p{L}])|\bn[º°]\s?1\b/giu,
      skip: /#\s?1\b[^.\n]{0,50}\b(?:by|according to|per|in)\b[^.\n]{0,50}\b(?:19|20)\d\d\b/gi,
      fix: (h, t, at) => /^\s+[\p{L}$]/u.test(t.slice(at + h.length)) ? '' : null,
      why: 'A ranking claim is misleading unless it names who ranked the firm, on what basis and when. The safe fix removes "#1" where it sits in front of a noun; "we are number one" needs a person.', settle: 'Who ranked the firm, and when? Without a dated source, remove it.' },
    { id: 'contingent', alias: 'r04', fam: TX, sev: 'block', t: 'Contingent fee in a family matter', rule: 'Rule 1.04(e) and 7.02(c)', src: 'ethics', v: '✔', lang: 'en',
      re: /\b(?:no fees? unless|no recovery,? no fee|no win,? no fee|contingen(?:t|cy)(?: fees?| basis)?|percentage of (?:the )?(?:settlement|property|estate|recovery|award|support)|pay (?:nothing|no fee|us nothing) unless|(?:don'?t|do not) pay (?:a fee |us |anything )?unless (?:we|you) win|fee unless (?:we|you) win)\b/gi,
      skip: /\b(?:not|never|cannot|can't|don't|do not|won't|no)\b[^.;:\n]{0,40}\bcontingen\w*|\bcontingen\w*(?: fees?)? (?:are|is) (?:not allowed|prohibited|not permitted|banned)\b/gi,
      why: 'A contingent fee is prohibited in a domestic relations matter when payment depends on securing a divorce or on the amount of support, maintenance or property. Remove the offer; if a contingent fee is ever advertised for another matter, the ad must state whether the client pays court costs and expenses.', settle: 'Remove the offer from family law copy.' },
    { id: 'contingent_costs', fam: TX, sev: 'block', t: 'Contingent fee without the costs statement', rule: 'Rule 7.02(c)', src: 'tdrpc', v: '✔', lang: 'any', test: contingentCostsTest,
      why: 'An advertisement that discloses a willingness to work on a contingent fee must say whether the client will owe court costs and litigation expenses.', settle: 'State whether the client pays court costs and expenses, or remove the contingent offer.' },
    { id: 'results', alias: 'r05', fam: TX, sev: 'warn', t: 'Past results', rule: 'Rule 7.01(d) to (f)', src: 'tdrpc', v: '✔', lang: 'en',
      re: /\b(?:recovered|won|obtained|secured|awarded)\s+\$?[\d,.]+\s*(?:million|thousand|k|m)?\b|\$[\d,.]+\s*(?:million|m)\s+(?:recovered|won|for our clients)|\b(?:recovered|won|obtained|secured) (?:millions|thousands)\b/gi,
      why: 'Results must not be misleading. If a verdict was reduced, reversed or settled for less, the amount the client received must appear with equal prominence. In family law, dollar results usually say nothing about the next case; consider removing.', settle: 'Was the amount actually received by the client, and is the context stated with equal prominence?' },
    { id: 'testimonials', alias: 'r06', fam: TX, sev: 'info', t: 'Testimonials and endorsements', rule: 'Rule 7.01(a) and comment', src: 'tdrpc', v: '✔', lang: 'en',
      re: /\b(?:testimonials?|clients? (?:say|said)|rated us|endorse(?:d|s|ment|ments)?|what our clients|client stories)\b/gi,
      why: 'Testimonials must be truthful and not misleading; a paid or incentivized endorsement must say so. Do not script client statements about outcomes.', settle: 'Is the testimonial real, unpaid or disclosed as paid, and free of outcome claims?' },
    { id: 'reviews_claim', fam: CONS, sev: 'warn', t: 'Rating or review count claim', rule: 'Rule 7.01(a); 16 CFR Part 465 (effective Oct 21, 2024)', src: 'ftc465', v: '◐', lang: 'any', test: reviewsTest,
      why: 'A star rating or review count must match the live profile it comes from, with its source and date. The screen compares it with the rating and count saved in the firm profile.', settle: 'Does the count and rating match the live profile today, with the source and date beside it?' },
    { id: 'property_5050', alias: 'r07', fam: FACT, sev: 'block', t: 'Property myth: 50/50', rule: 'Tex. Fam. Code § 7.001', src: 'fc7', v: '✔', lang: 'en', neg: 'myth',
      re: /\b50\s*\/\s*50\b|\bfifty[ -]fifty\b|\bsplit (?:everything |the (?:property|assets|estate) )?(?:down the middle|equally|in half)\b|\bequal (?:split|division) of (?:the )?(?:property|assets|estate)\b|\bdivided (?:equally|50\s*\/\s*50)\b/gi,
      skip: /\b50\s*\/\s*50\s+(?:custody|possession|parenting|time|schedule|visitation|split of time|conservatorship)\b|\bfifty[ -]fifty\s+(?:custody|possession|parenting|time)\b/gi,
      why: 'Texas divides community property in a manner that is "just and right"; equality is not required and separate property is never divided.' },
    { id: 'legal_separation', alias: 'r08', fam: FACT, sev: 'block', t: 'Legal separation', rule: 'Texas has no legal separation', src: 'fc6', v: '✔', lang: 'en', neg: 'myth',
      re: /\blegal(?:ly)? separat(?:ion|ed)\b/gi,
      why: 'Texas does not recognize legal separation. Offer the real alternatives: temporary orders, protective orders, a SAPCR, or a partition agreement. A sentence that says Texas has no legal separation is not flagged.' },
    { id: 'gender_myth', alias: 'r09', fam: FACT, sev: 'block', t: 'Gender preference myth', rule: 'Tex. Fam. Code § 153.003 and Rule 7.01', src: 'fc153', v: '✔', lang: 'en', neg: 'myth',
      re: /\b(?:mothers?|moms?) (?:always |automatically |usually )?(?:get|gets|win|wins|receive|receives|are awarded) (?:custody|the kids|the children)\b|\b(?:fathers?|dads?) (?:can't|cannot|never|rarely) (?:win|get) custody\b|\bcourts? (?:favor|prefer)s? (?:mothers?|moms?|fathers?|dads?)\b/gi,
      why: 'Courts may not prefer a parent by sex. The claim is wrong and, as advertising, misleading.' },
    { id: 'child_chooses', alias: 'r10', fam: FACT, sev: 'block', t: 'Child chooses at 12 myth', rule: 'Tex. Fam. Code § 153.009', src: 'fc153', v: '✔', lang: 'en', neg: 'myth',
      re: /\b(?:child(?:ren)?|kids?) (?:can |get to |gets to |will |may )?(?:choose|decide|pick)\b|\bat (?:age )?(?:12|twelve),? (?:a |the |your )?(?:child|kids?|children) (?:can|gets? to|may) (?:choose|decide|pick)\b/gi,
      why: 'At 12 the judge must interview the child in chambers on request; the preference never controls.' },
    { id: 'common_law', alias: 'r11', fam: FACT, sev: 'block', t: 'Common law duration myth', rule: 'Tex. Fam. Code § 2.401', src: 'fc2', v: '✔', lang: 'en', neg: 'myth',
      re: /\b(?:common[ -]law marri(?:age|ed)|informal marriage) (?:after|requires?|takes?|needs?) (?:\d+|six|two|seven|three) (?:years?|months?)\b|\bliving together (?:for )?(?:\d+|six|two|seven) years? (?:makes|means|equals)\b/gi,
      why: 'No duration element exists: agreement, cohabitation and holding out, both parties 18 or older.' },
    { id: 'alimony_myth', alias: 'r12', fam: FACT, sev: 'block', t: 'Alimony myth', rule: 'Tex. Fam. Code ch. 8', src: 'fc8', v: '✔', lang: 'en', neg: 'myth',
      re: /\b(?:no alimony in texas|texas (?:has|does) no(?:t have)? alimony|alimony is (?:standard|automatic|guaranteed))\b/gi,
      why: 'Spousal maintenance exists, is presumed unwarranted, gated (10 year marriage, family violence, disability) and capped at the lesser of $5,000 a month or 20% of average gross income.' },
    { id: 'stale_cap', alias: 'r13', fam: STALE, sev: 'block', t: 'Stale child support cap', rule: 'Tex. Fam. Code § 154.125; OAG adjustment eff. Sept. 1, 2025', src: 'fc154', v: '✔', lang: 'any',
      re: /\$\s?(?:9,?200|8,?550)\b|\$\s?7,?500\s*(?:net|cap|a month in net|monthly net)/gi, when: /support|net resources|\bcap(?:ped)?\b|guideline|manutenci[oó]n|pensi[oó]n/i,
      skip: /\b(?:from|was|were|used to be|no longer|previously|formerly|old|replaced|up from|rose from|raised from|increased from|instead of)\b[^.;\n]{0,24}\$\s?(?:9,?200|8,?550|7,?500)/gi,
      fix: h => h.replace(/\$\s?(?:9,?200|8,?550|7,?500)/, '$11,700'),
      why: 'The guideline cap is $11,700 in monthly net resources since September 1, 2025 ($2,340 for one child at the cap). $9,200 is stale. The safe fix replaces the number; a sentence that says the cap rose from $9,200 is left alone.' },
    { id: 'stale_per_child', fam: STALE, sev: 'block', t: 'Stale one child amount at the cap', rule: 'Tex. Fam. Code § 154.125', src: 'fc154', v: '✔', lang: 'any',
      re: /\$\s?1,?840\b/g, when: /support|manutenci[oó]n|pensi[oó]n/i, skip: /\b(?:from|was|used to be|no longer|previously|old|up from|rose from)\b[^.;\n]{0,24}\$\s?1,?840/gi, fix: () => '$2,340',
      why: '20% of the old $9,200 cap was $1,840. At the current $11,700 cap the guideline for one child is $2,340 a month.' },
    { id: 'sixty_days', alias: 'r14', fam: FACT, sev: 'warn', t: 'Sixty days as a promise', rule: 'Tex. Fam. Code § 6.702', src: 'fc6', v: '✔', lang: 'en',
      re: /\b(?:divorced? (?:in|within|takes) (?:60|sixty) days|60[ -]day divorce|two month divorce|divorce in two months)\b/gi,
      why: 'Sixty days is the statutory minimum from filing, not a delivery time. Agreed cases usually take two to four months; contested nine to twenty four.', settle: 'Is sixty days stated as the minimum wait, not a promise?' },
    { id: 'restraining_order', alias: 'r15', fam: FACT, sev: 'warn', t: 'Restraining order vs protective order', rule: 'Tex. Fam. Code ch. 85', src: 'fc85', v: '✔', lang: 'en',
      re: /\brestraining orders?\b/gi, skip: /\b(?:a |the )?(?:temporary restraining orders?|TROs?) (?:is|are) not (?:a |the same as a )?protective orders?\b/gi,
      why: 'A temporary restraining order is a civil procedure device; a protective order is the family violence remedy. Say which one you mean; do not conflate them.', settle: 'Does the copy mean a TRO or a protective order?' },
    { id: 'equal_time', alias: 'r16', fam: FACT, sev: 'block', t: 'Equal time presumption myth', rule: 'SB 849 (2025) failed; § 153.135', src: 'fc153', v: '✔', lang: 'en', neg: 'myth',
      re: /\b(?:equal time|50\s*\/\s*50 (?:custody|possession|parenting)|shared parenting is (?:the law|presumed)|presumption of equal (?:possession|time|parenting)|equal parenting (?:law|presumption))\b/gi,
      why: 'Joint managing conservatorship does not mean equal time and Texas has no equal time presumption. The expanded standard possession order is the default within 50 miles.' },
    { id: 'lay_terms', alias: 'r17', fam: FACT, sev: 'info', t: 'Lay terms without the Texas term', rule: 'Terminology', src: 'fc153', v: '✔', lang: 'en',
      re: /\b(?:full custody|sole custody|visitation)\b/gi, when: t => !/conservatorship|possession and access/i.test(t),
      why: 'Use the lay term for search but define the Texas term on the page: sole managing conservatorship, possession and access, the exclusive right to designate the primary residence. "Full custody" has no legal meaning. Copy that already uses the Texas term is not flagged.' },
    { id: 'stale_arrears', alias: 'r18', fam: STALE, sev: 'block', t: 'Stale arrears interest', rule: '§ 157.265; HB 4213 (2025) died', src: 'fc157', v: '✔', lang: 'any',
      re: /\b(?:3%|three percent)\s+(?:simple\s+)?(?:interest|on arrears|annual interest)\b|\b(?:arrears|arrearages?|back (?:child )?support)\b[^.\n]{0,40}?(?:3%|\bthree percent\b)|(?:3 ?%|tres por ciento) de inter[eé]s/gi,
      when: /arrear|back (?:child )?support|child support|support|atrasad|manutenci[oó]n/i,
      fix: h => h.replace(/3 ?%/, '6%').replace(/three percent/i, 'six percent').replace(/tres por ciento/i, 'seis por ciento'),
      why: 'Child support arrears accrue 6% simple interest. The 2025 bill to change the rate did not pass.' },
    { id: 'ground_o', alias: 'r19', fam: STALE, sev: 'block', t: 'Repealed termination ground', rule: 'HB 116 (2025)', src: 'fc161', v: '✔', lang: 'en', neg: 'myth',
      re: /\bground \(O\)|\bground O\b|161\.001\(b\)\(1\)\(O\)/gi, skip: /\b(?:repealed|former|formerly|old|abolished)\b[^.\n]{0,25}ground \(?O\)?/gi,
      why: 'Ground (O), service plan noncompliance, was repealed effective September 1, 2025, including for pending suits; grounds were relettered (A) to (U).' },
    { id: 'anonymous_reports', alias: 'r20', fam: STALE, sev: 'warn', t: 'Anonymous CPS reports', rule: 'HB 63 (2023), § 261.304', src: 'fc261', v: '✔', lang: 'en', neg: 'myth',
      re: /\banonymous (?:reports?|tips?|calls?)\b/gi,
      why: 'DFPS has not accepted anonymous reports since September 1, 2023; only a tip made to law enforcement and referred to DFPS gets a preliminary investigation.', settle: 'Does the copy say or imply that DFPS investigates anonymous reports?' },
    { id: 'aggression', alias: 'r21', fam: TX, sev: 'info', t: 'Aggression language', rule: 'Rule 7.01 comment; § 153.002 best interest', src: 'tdrpc', v: '✔', lang: 'en',
      re: /\b(?:fight(?:s|ing)? tirelessly|aggressive(?:ly)? (?:fight|represent)|pit ?bull|shark|we will destroy|crush|bulldog)\b/gi,
      why: 'Not a violation by itself, but judges and mediators see the ads too, and "aggressive" copy underperforms "clear" copy for family law leads in most tests. Say what you do.' },
    { id: 'po_future', fam: STALE, sev: 'block', t: 'Protective order: proof that violence will recur', rule: 'Tex. Fam. Code ch. 85 (2023)', src: 'fc85', v: '✔', lang: 'en', neg: 'myth',
      re: /\b(?:(?:is|are) likely to (?:occur|happen|recur) again|likely to (?:occur|recur) in the future|will (?:occur|happen) again|(?:must|have to|need to) (?:prove|show) (?:that )?(?:the )?(?:family )?violence (?:is likely to|will) (?:occur|happen|recur))\b/gi,
      when: /protective order|family violence|domestic violence/i,
      why: 'Since 2023 the applicant proves that family violence occurred, not that it will recur (module 06, protective orders). Copy that recites the old two part test is stale.' },
    { id: 'po_duration', fam: STALE, sev: 'warn', t: 'Protective order duration stated flat', rule: 'Tex. Fam. Code § 85.025; SB 1120 (2025)', src: 'fc85', v: '✔', lang: 'en',
      re: /\bprotective orders?\b[^.\n]{0,30}\b(?:lasts?|expires?|runs?|is good|are good|is valid|are valid)\b[^.\n]{0,20}\b(?:two|2) years\b/gi,
      why: 'Since September 2025 an order tied to a pending divorce or SAPCR runs until two years after the final decree (module 06, protective orders). A flat "two years" is incomplete.', settle: 'Does the copy cover orders tied to a pending divorce or SAPCR?' },
    { id: 'prop15', fam: FACT, sev: 'warn', t: 'Parental rights amendment (Proposition 15)', rule: 'Proposition 15 (adopted November 2025)', src: 'const1', v: '✔', lang: 'any',
      re: /\bprop(?:osition)?\.?\s?15\b|\bparental rights amendment\b|\bart(?:icle)?\.? I,? § ?37\b/gi,
      why: 'Proposition 15, the parental rights amendment, was adopted in November 2025; as of June 2026 the Supreme Court of Texas had not defined its effect. Describe it; do not state what it changes in a custody case.', settle: 'Does the copy claim a specific change in custody outcomes?' },
    { id: 'espo_2025', fam: STALE, sev: 'block', t: 'Expanded possession described as new', rule: 'Tex. Fam. Code § 153.3171 (2021)', src: 'fc153', v: '✔', lang: 'en',
      re: /\b(?:new|2025)\b[^.\n]{0,40}\b(?:expanded (?:standard )?possession(?: order)?|ESPO)\b|\b(?:expanded (?:standard )?possession(?: order)?|ESPO)\b[^.\n]{0,40}\b(?:new (?:in |for )?2025|is new|(?:passed|enacted|took effect) in 2025)\b/gi,
      why: 'The expanded standard possession order has been the default within 50 miles since 2021 (module 06, divorce with children). It is not a 2025 change.' },
    { id: 'withhold_access', fam: FACT, sev: 'block', t: 'Support and possession treated as linked', rule: 'Tex. Fam. Code § 105.006(e)', src: 'fc105', v: '✔', lang: 'en', neg: true,
      re: /\b(?:withhold|deny|keep)(?:ing)? (?:visitation|possession|access|the (?:kids|children))\b[^.\n]{0,40}\b(?:if|until|when|because)\b[^.\n]{0,30}\b(?:support|pay)|\b(?:stop|withhold)(?:ping)? (?:child )?support\b[^.\n]{0,40}\b(?:if|until|when|because)\b[^.\n]{0,40}\b(?:visitation|possession|see the (?:kids|children))/gi,
      why: 'Support and possession are independent obligations (the § 105.006(e) warning in every order); self help invites contempt (module 06, enforcement).' },
    { id: 'birth_certificate', fam: FACT, sev: 'block', t: 'Birth certificate treated as paternity', rule: 'Tex. Fam. Code ch. 160', src: 'fc160', v: '✔', lang: 'en', neg: true,
      re: /\b(?:signing|signed|sign|on) (?:the )?birth certificate\b[^.\n]{0,60}\b(?:establish(?:es)?|give[sn]?|gets? you|grants?|secures?|proves?) (?:paternity|(?:your |father'?s'? |parental )?rights|custody)/gi,
      why: 'Rights attach through an acknowledgment of paternity or an adjudication, not the birth certificate (module 06, custody and SAPCR).' },
    { id: 'prenup_myth', fam: FACT, sev: 'block', t: 'Prenups do not hold up myth', rule: 'Tex. Fam. Code § 4.006', src: 'fc4', v: '✔', lang: 'en',
      re: /\bprenup(?:tial agreement)?s? (?:don'?t|do not|rarely|never|won'?t) (?:hold up|stand up|get enforced|work)\b|\bprenup(?:tial agreement)?s? (?:are|is) (?:easy to (?:break|overturn)|rarely enforced|not enforceable|unenforceable)\b/gi,
      why: 'Texas premarital agreements are among the most enforceable anywhere; § 4.006 lists the only defenses (module 06, premarital agreements).' },
    { id: 'arrears_expire', fam: FACT, sev: 'block', t: 'Arrears described as expiring', rule: 'Tex. Fam. Code ch. 157', src: 'fc157', v: '✔', lang: 'en', neg: true,
      re: /\b(?:child support )?arrear(?:s|ages?) (?:expire|go away|are forgiven|disappear|are wiped out)\b|\bback (?:child )?support (?:expires|goes away|is forgiven|disappears)\b/gi,
      why: 'Arrears carry 6% simple interest and never expire (module 06, enforcement).' },

    /* Spanish (lang 'es'): the same claims in the words Spanish ads use */
    { id: 'guarantee_es', fam: TX, sev: 'block', t: 'Outcome guarantee (Spanish)', rule: 'Rule 7.01(a)', src: 'tdrpc', v: '✔', lang: 'es', neg: true,
      re: esRe('garantiza(?:mos|do|da|dos|das|r)?|le garantizamos|te garantizamos|garantía de (?:resultados?|éxito)|ganaremos|vamos a ganar|éxito asegurado|100% de éxito|resultado asegurado'),
      why: '"Garantizamos", "ganaremos" and "éxito asegurado" promise an outcome. Flagged, never rewritten.', settle: 'Rewrite around what the firm does.' },
    { id: 'competence_es', fam: TX, sev: 'block', t: 'Special competence claim (Spanish)', rule: 'Rule 7.02(b)', src: 'tdrpc', v: '✔', lang: 'es',
      re: esRe('especialistas? en (?:divorcio|custodia|derecho familiar|derecho de familia|familia)|especialistas?|nos especializamos(?: en)?|se especializan?(?: en)?|especializad[oa]s?(?: en)?|abogad[oa]s? expert[oa]s?|expert[oa]s?(?: en)?'),
      skip: esRe('testigos? expert[oa]s?|perit[oa]s?'),
      fix: (h) => { let m;
        if ((m = h.match(/^especialistas? en (.+)$/i))) return 'práctica enfocada en ' + m[1];
        if (/^nos especializamos en$/i.test(h)) return 'nos enfocamos en'; if (/^se especializa en$/i.test(h)) return 'se enfoca en'; if (/^se especializan en$/i.test(h)) return 'se enfocan en';
        if ((m = h.match(/^especializad([oa]s?) en$/i))) return 'enfocad' + m[1] + ' en';
        if ((m = h.match(/^(abogad[oa]s?) expert[oa]s?$/i))) return m[1];
        return null; },
      why: '"Especialista", "especializado" and "experto" are the Spanish forms of the prohibited specialty claim. Only the TBLS form may be used. The safe fix rewrites the common forms ("nos enfocamos en", "práctica enfocada en").', settle: 'Without a TBLS certificate, rewrite as "práctica enfocada en".' },
    { id: 'superlative_es', fam: TX, sev: 'warn', t: 'Unverifiable superlative (Spanish)', rule: 'Rule 7.01(a)', src: 'tdrpc', v: '✔', lang: 'es',
      re: esRe('(?:el|la|los|las) mejor(?:es)?(?!\\s+inter[eé]s)|(?:más|mas) experimentad[oa]s?|líderes en|insuperables?|de mayor confianza'),
      fix: (h, t, at) => /^(?:el|la|los|las) mejor(?:es)?$/i.test(h) && /^\s+abogad/i.test(t.slice(at + h.length)) ? '' : null,
      why: '"El mejor", "los mejores" and "número uno" are superlatives that need a named, dated source. "El mejor interés del menor" is the legal standard and is not flagged.', settle: 'Ask for the basis: the ranking, its source and its year.' },
    { id: 'contingent_es', fam: TX, sev: 'block', t: 'Contingent fee in a family matter (Spanish)', rule: 'Rule 1.04(e) and 7.02(c)', src: 'ethics', v: '✔', lang: 'es',
      re: esRe('no cobramos(?: nada)? (?:si no|a menos que) ganemos|no cobramos si no ganamos|sin costo a menos que ganemos|honorarios (?:de|por) contingencia|cuota contingente|solo paga si ganamos|no paga(?:s)? (?:nada )?(?:si no|a menos que) ganemos'),
      why: 'A fee contingent on the divorce or on the amount of support or property is prohibited in a family matter.', settle: 'Remove the offer.' },
    { id: 'property_es', fam: FACT, sev: 'block', t: 'Property myth (Spanish)', rule: 'Tex. Fam. Code § 7.001', src: 'fc7', v: '✔', lang: 'es', neg: 'myth',
      re: esRe('mitad y mitad|partes iguales|se divide todo a la mitad|todo se divide a la mitad'),
      why: 'Texas divides community property in a manner that is "just and right"; equality is not required.' },
    { id: 'legal_separation_es', fam: FACT, sev: 'block', t: 'Legal separation (Spanish)', rule: 'Texas has no legal separation', src: 'fc6', v: '✔', lang: 'es', neg: 'myth',
      re: esRe('separaci[oó]n legal'), why: 'Texas does not recognize legal separation ("separación legal"). Offer temporary orders, protective orders, a SAPCR or a partition agreement.' },
    { id: 'gender_myth_es', fam: FACT, sev: 'block', t: 'Gender preference myth (Spanish)', rule: 'Tex. Fam. Code § 153.003', src: 'fc153', v: '✔', lang: 'es', neg: 'myth',
      re: esRe('(?:las madres|la madre|las mamás|la mamá) (?:siempre |automáticamente |casi siempre )?(?:obtienen|obtiene|ganan|gana|reciben|recibe|se quedan con) (?:la custodia|los niños|los hijos)|(?:los padres|el padre|los papás|el papá) (?:no pueden|nunca|casi nunca|no) (?:ganar|ganan|obtener|obtienen) (?:la )?custodia'),
      why: 'Courts may not prefer a parent by sex.' },
    { id: 'child_chooses_es', fam: FACT, sev: 'block', t: 'Child chooses at 12 myth (Spanish)', rule: 'Tex. Fam. Code § 153.009', src: 'fc153', v: '✔', lang: 'es', neg: 'myth',
      re: esRe('a los (?:12|doce) años,? (?:el niño|la niña|el menor|los niños|los hijos|su hijo|su hija|tu hijo|tu hija) (?:puede|pueden) (?:elegir|decidir|escoger)|(?:el niño|la niña|el menor|los niños|los hijos|su hijo|su hija) (?:puede|pueden) (?:elegir|decidir|escoger)'),
      why: 'At 12 the judge must interview the child on request; the preference never controls.' },
    { id: 'common_law_es', fam: FACT, sev: 'block', t: 'Common law duration myth (Spanish)', rule: 'Tex. Fam. Code § 2.401', src: 'fc2', v: '✔', lang: 'es', neg: 'myth',
      re: esRe('(?:matrimonio de hecho|unión libre|matrimonio informal|unión de hecho) (?:después de|requiere|requiere de|toma|tras) (?:\\d+|dos|tres|seis|siete) (?:años|meses)'),
      why: 'No duration element exists for an informal marriage.' },
    { id: 'sixty_days_es', fam: FACT, sev: 'warn', t: 'Sixty days as a promise (Spanish)', rule: 'Tex. Fam. Code § 6.702', src: 'fc6', v: '✔', lang: 'es',
      re: esRe('divorcio en (?:60|sesenta) días|divorciad[oa]s? en (?:60|sesenta) días'), why: 'Sixty days is the statutory minimum from filing, not a delivery time.', settle: 'Is sixty days stated as the minimum wait?' },
    { id: 'equal_time_es', fam: FACT, sev: 'block', t: 'Equal time presumption myth (Spanish)', rule: '§ 153.135', src: 'fc153', v: '✔', lang: 'es', neg: 'myth',
      re: esRe('tiempo igual|custodia 50 ?\\/ ?50|custodia compartida (?:es|significa) (?:la ley|tiempo igual)'), why: 'Joint managing conservatorship does not mean equal time; Texas has no equal time presumption.' },
    { id: 'anonymous_reports_es', fam: STALE, sev: 'warn', t: 'Anonymous CPS reports (Spanish)', rule: 'HB 63 (2023), § 261.304', src: 'fc261', v: '✔', lang: 'es', neg: 'myth',
      re: esRe('(?:denuncias?|reportes?) anónim[oa]s?'), why: 'DFPS has not accepted anonymous reports since September 1, 2023.', settle: 'Does the copy imply DFPS investigates anonymous reports?' },
    { id: 'results_es', fam: TX, sev: 'warn', t: 'Past results (Spanish)', rule: 'Rule 7.01(d) to (f)', src: 'tdrpc', v: '✔', lang: 'es',
      re: esRe('(?:recuperamos|ganamos|obtuvimos|conseguimos) (?:más de )?\\$?[\\d,.]+ ?(?:millones|mil)?|(?:recuperamos|ganamos|obtuvimos|conseguimos) millones'), why: 'Results must not be misleading; the amount the client received must appear with equal prominence.', settle: 'Was the amount actually received by the client?' },
    { id: 'urgency_es', fam: CONS, sev: 'warn', t: 'False urgency (Spanish)', rule: 'Rule 7.01(a)', src: 'tdrpc', v: '◐', lang: 'es',
      re: esRe('solo quedan \\d+|act[uú]e ahora|act[uú]a ahora|hoy solamente|solo hoy|última oportunidad|oferta por tiempo limitado'), why: 'A deadline or scarcity claim that is not real is misleading.', settle: 'Is there a real end date or a real limit?' },
    { id: 'es_staff', fam: TX, sev: 'warn', t: 'Spanish copy without Spanish speaking staff in the profile', rule: 'Rule 7.01(a)', src: 'tdrpc', v: '◐', lang: 'any', self: true, test: esStaffTest,
      why: 'Spanish copy tells the reader they can be served in Spanish. The firm profile does not list Spanish speaking staff (the Firm button, languages). Confirm before the ad runs.', settle: 'Who answers the intake line in Spanish, and when?' },

    /* firm identity: trade names and partnerships */
    { id: 'trade_gov', fam: TX, sev: 'warn', t: 'Name implies a government office or legal aid', rule: 'Rule 7.01(b)', src: 'tdrpc', v: '◐', lang: 'any', test: tradeGovTest,
      why: 'A trade name may not imply a connection with a government agency, a court, or a public or charitable legal services organization. Names like "Texas Divorce Center" or "Child Support Office" read as official. When the name is the firm\'s own name in the profile, this blocks.', settle: 'Is this the firm\'s name, or a description of a government office?' },
    { id: 'trade_partner', fam: TX, sev: 'warn', t: 'Name implies partners or associates', rule: 'Rule 7.01(b)', src: 'tdrpc', v: '◐', lang: 'any', self: true, test: tradePartnerTest,
      why: 'A firm may not hold itself out as having partners or associates it does not have. The firm profile lists one lawyer.', settle: 'Add the other lawyers to the firm profile, or drop "& Associates" or "& Partners".' },

    /* advertisements: responsible lawyer, fees, solicitation, filing */
    { id: 'r702a', fam: TX, sev: 'warn', t: 'Responsible lawyer and primary practice location', rule: 'Rule 7.02(a)', src: 'tdrpc', v: '✔', lang: 'any', needKind: true, test: r702aTest,
      why: 'Every advertisement must publish the name of a lawyer responsible for its content and the lawyer\'s primary practice location. Ad platforms often carry them in an extension or on the landing page; pages must carry both.', settle: 'Does the ad extension or the landing page carry the responsible lawyer and the primary practice location?' },
    { id: 'fee_honor', fam: TX, sev: 'warn', t: 'Advertised fee', rule: 'Rule 7.02(d)', src: 'tdrpc', v: '✔', lang: 'any', test: feeTest,
      why: 'A lawyer who advertises a specific fee must honor it while the advertisement runs, unless the ad states a shorter period. The screen compares the amount with the fees in the firm profile.', settle: 'Is the fee on the firm\'s fee schedule, and will it be honored while the ad runs?' },
    { id: 'free_consult', fam: TX, sev: 'warn', t: 'Free consultation offer', rule: 'Rule 7.01(a) and 7.02(d)', src: 'tdrpc', v: '✔', lang: 'any', test: freeConsultTest,
      why: 'The firm profile says consultations are not free. An advertised free consultation the firm does not give is a false statement about its services.', settle: 'Are consultations free? Update the firm profile or the copy.' },
    { id: 'sol_label', fam: TX, sev: 'block', t: 'Solicitation not marked ADVERTISEMENT', rule: 'Rule 7.03(c)', src: 'tdrpc', v: '✔', lang: 'any', test: solLabelTest,
      why: 'A solicitation communication must be plainly marked or clearly designated an "ADVERTISEMENT" unless it is directed to lawyers, family, prior clients or experienced users. The safe fix adds the label at the top.', settle: 'Is the recipient a lawyer, family, a prior client or an experienced user? Otherwise label it.' },
    { id: 'sol_pleading', fam: TX, sev: 'block', t: 'Solicitation resembles a legal pleading', rule: 'Rule 7.03', src: 'tdrpc', v: '✔', lang: 'any', test: solPleadingTest,
      why: 'A solicitation communication must not resemble a legal pleading or a court notice.', settle: 'Remove court style captions and notice language.' },
    { id: 'sol_channel', fam: TX, sev: 'info', t: 'Solicitation channel check', rule: 'Rule 7.03(a)', src: 'tdrpc', v: '✔', lang: 'any', obs: false, test: solChannelTest,
      why: 'Written and mailed solicitations are permitted with the label; in person, telephone and real time electronic solicitation of non clients for pecuniary gain is not. No payment to non lawyers for referrals beyond nominal gifts.' },
    { id: 'arc_filing', fam: FIL, sev: 'info', t: 'Advertising Review Committee filing', rule: 'Rule 7.04 and 7.05', src: 'sbot', v: '✔', lang: 'any', needKind: true, self: true, obs: false, test: arcTest,
      why: 'Unless the piece is exempt, file it with the Advertising Review Committee, State Bar of Texas, within ten days of first dissemination, or seek pre approval thirty days ahead. Log it in module 11.', settle: 'A filing log entry, or the Rule 7.05 exemption that applies.' },
    { id: 'r706', fam: TX, sev: 'info', t: 'Prohibited employment', rule: 'Rule 7.06', src: 'tdrpc', v: '✔', lang: 'any', obs: false, post: true, noComp: true,
      why: 'A lawyer may not accept or continue employment in a matter procured by conduct that violates Rules 7.01 to 7.03, personally or through the firm. Leads from this copy carry the problem with them until it is fixed.' },

    /* ad platform policies */
    { id: 'meta_attr', fam: PLAT, sev: 'warn', t: 'Personal attribute assertion (Meta)', rule: 'Meta Advertising Standards, personal attributes', src: 'meta', v: '◐', lang: 'any', test: metaAttrTest,
      why: 'Meta rejects ads that assert or imply the viewer\'s personal attributes or situation ("Are you getting divorced?", "Your divorce"). Write to the situation in the third person ("Divorce with children in Harris County"). Blocks on Meta; a review elsewhere.', settle: 'Does the copy assert something about the viewer\'s own situation?' },
    { id: 'google_hardship', fam: PLAT, sev: 'warn', t: 'Personal hardship (Google)', rule: 'Google Ads personalized advertising policy', src: 'g_pers', v: '◐', lang: 'any', test: googleHardshipTest,
      why: 'Google lists personal hardships, including relationship, marital and family difficulties, as a sensitive interest category: no audience segments, remarketing lists or customer match lists built on divorce status, and no copy that implies knowledge of the reader\'s situation when served by list. Keyword and geographic targeting comply.', settle: 'Is the ad served to a remarketing list, a customer list or an audience segment?' },
    { id: 'ggl_editorial', fam: PLAT, sev: 'warn', t: 'Editorial: exclamation or capitals in a headline', rule: 'Google Ads editorial policy', src: 'g_edit', v: '◐', lang: 'any', test: editorialTest,
      why: 'Google and Microsoft disapprove headlines with an exclamation mark or words in all capitals that are not acronyms.', settle: 'Remove the exclamation mark or recase the word.' },
    { id: 'ggl_phone', fam: PLAT, sev: 'info', t: 'Phone number inside ad text', rule: 'Google Ads editorial policy (use call assets)', src: 'g_edit', v: '◐', lang: 'any', plats: ['google', 'microsoft', 'demandgen', 'youtube'],
      re: /\(?\b\d{3}\)?[\s.\u2010-\u2015-]\d{3}[\s.\u2010-\u2015-]\d{4}\b/g, why: 'Move the number to a call asset; numbers in ad text are disapproved.', settle: 'Move the number to a call asset.' },
    { id: 'urgency', fam: CONS, sev: 'warn', t: 'False urgency', rule: 'Rule 7.01(a)', src: 'tdrpc', v: '◐', lang: 'en',
      re: /\b(?:only \d+ (?:spots?|slots?|openings?|consultations?|appointments?) (?:left|remaining)|act now|today only|last chance|offer ends|expires (?:tonight|today|soon)|limited time(?: offer)?)\b/gi,
      why: 'A deadline or scarcity claim that is not real is a misleading communication.', settle: 'Is there a real end date or a real limit?' },
    { id: 'availability', fam: CONS, sev: 'info', t: 'Availability claim', rule: 'Rule 7.01(a)', src: 'tdrpc', v: '◐', lang: 'en',
      re: /\b(?:24\/7|24 hours a day|around the clock|available (?:day or night|anytime|24 hours)|same[ -]day (?:appointments?|consultations?|filing|service))\b/gi,
      why: 'Only if the line is staffed at those hours. Same day claims need a stated cutoff.', settle: 'Is the stated availability actually staffed?' },
    { id: 'sms_consent', fam: CONS, sev: 'warn', t: 'Text message without opt out language', rule: 'TCPA, 47 U.S.C. § 227; Bus. & Com. Code ch. 302 as amended by SB 140 (Sep 1, 2025)', src: 'tcpa', v: '◐', lang: 'any', kinds: ['sms'], test: smsTest,
      why: 'Marketing texts need documented consent and opt out instructions ("Reply STOP to opt out").', settle: 'Is there an unchecked consent box, STOP language and a chapter 302 registration or exemption?' },

    /* web tests on raw HTML */
    { id: 'web_pixel', fam: WEB, sev: 'warn', t: 'Tracking pixel without a privacy notice link', rule: 'Platform terms; Texas Data Privacy and Security Act (Bus. & Com. Code ch. 541)', src: 'bc302', v: '◐', lang: 'any', html: true, test: webPixelTest,
      why: 'A page that loads the Meta pixel, Google tag manager or TikTok pixel should link a privacy notice that names the data collected and how to opt out. Family law visitors are a sensitive audience.', settle: 'Is there a privacy notice linked from every page with the tag?' },
    { id: 'web_precheck', fam: WEB, sev: 'warn', t: 'Pre checked consent box', rule: 'TCPA; Texas SB 140', src: 'tcpa', v: '◐', lang: 'any', html: true, test: webPrecheckTest,
      why: 'Consent to calls and texts must be given, not assumed: leave the box unchecked and optional.', settle: 'Leave consent unchecked and optional.' },
    { id: 'web_rating', fam: WEB, sev: 'warn', t: 'Self served aggregateRating in schema', rule: 'Google review snippet guidelines; 16 CFR Part 465 if fabricated', src: 'ftc465', v: '◐', lang: 'any', html: true, test: webRatingTest,
      why: 'Remove self served ratings from LegalService schema; show real reviews with a dated source instead.', settle: 'Remove the self served rating from the schema.' },

    /* placeholders and house style */
    { id: 'ph', fam: HOUSE, sev: 'block', t: 'Unfilled placeholder', rule: 'Rule 7.01(a)', src: 'house', v: '✔', lang: 'any', noComp: true, test: placeholderTest,
      why: 'The copy still carries a bracketed placeholder or a template token. Fill the firm profile (the Firm button) or edit the copy.', settle: 'Fill the placeholder.' },
    { id: 'meta_note', fam: HOUSE, sev: 'block', t: 'Note or filler left in copy', rule: 'House style', src: 'house', v: '✔', lang: 'any', noComp: true,
      re: /\b(?:lorem ipsum|as an ai(?: language model)?|note to (?:self|editor|writer)|insert (?:here|name|city|phone|firm)|placeholder text|TBD)\b/gi,
      why: 'No explanatory notes, filler or template text inside a deliverable.', settle: 'Remove the note.' },
    { id: 'house', fam: HOUSE, sev: 'fix', t: 'Hyphen or dash in outbound copy', rule: 'House style', src: 'house', v: '✔', lang: 'any', needKind: true, self: true, test: houseTest,
      why: 'Copy that leaves the atlas carries no hyphen or dash: ranges read "2 to 4", phone numbers "(214) 555 0100", and dashes become commas. URLs, emails and "IV-D" keep theirs. The safe fix applies the house style.' }
  ];

  /* ---- code rules */
  function certifiedTest(t, ctx) {
    const claims = tblsClaims(t); const spans = claims.map(c => [c.at, c.end]).concat(ctx.protect); const out = [];
    const re = /\bboard[ -]certified\b|\bcertified\b|\bcertification\b/gi; let m;
    const skip = /\bcertified (?:mail|copy|copies|check|cheque|letter|translations?|translators?|interpreters?|public accountants?|financial planners?|divorce financial analysts?|records?|court reporters?|birth certificates?)\b|\bcertification (?:of|for) (?:service|the record|a copy)\b/gi; const sk = spansOf(skip, t);
    while ((m = re.exec(t))) { if (inSpans(m.index, spans) || inSpans(m.index, sk)) continue; const h = { at: m.index, hit: m[0] };
      /* "Board Certified in Family Law" completes to the TBLS form only when a lawyer in the firm profile holds exactly that area */
      if (/^board/i.test(m[0]) && ctx.firm) { const rest = t.slice(m.index + m[0].length); const sep = rest.match(/^,?\s*(?:in\s+)?/i)[0]; const after = rest.slice(sep.length).toLowerCase(); const a = ctx.firm.atts.find(x => x.tbls && after.startsWith(x.tbls.toLowerCase()) && !/^[\p{L}]/u.test(after.slice(x.tbls.length))); if (a) { h.hit = m[0] + sep + rest.slice(sep.length, sep.length + a.tbls.length); h.fixTo = `Board Certified, ${a.tbls}, Texas Board of Legal Specialization`; } }
      out.push(h); }
    return out;
  }
  function tblsUnsupportedTest(t, ctx) { if (!ctx.firm) return []; return tblsClaims(t).filter(c => !ctx.firm.atts.some(a => a.tbls && areaMatch(a.tbls, c.area))).map(c => ({ at: c.at, hit: c.hit, why: `The copy claims "Board Certified, ${c.area}". ${ctx.firm.atts.some(a => a.tbls) ? 'The firm profile lists ' + ctx.firm.certs.join('; ') + '.' : 'No lawyer in the firm profile has a TBLS certification.'} Either the profile is incomplete or the claim is false.` })); }
  function certAttribTest(t, ctx) { if (!ctx.firm) return []; const low = t.toLowerCase(); return tblsClaims(t).map(c => { const holders = ctx.firm.atts.filter(a => a.tbls && areaMatch(a.tbls, c.area)); if (!holders.length || holders.some(a => low.includes(a.name.toLowerCase()))) return null; return { at: c.at, hit: c.hit, why: `Name ${holders.map(a => a.name).join(' or ')} beside the claim; the certification is the lawyer's, not the firm's.` }; }).filter(Boolean); }
  function contingentCostsTest(t, ctx) { const r = RULE.contingent; if (!applies(r, ctx)) return []; const hits = matchAll(r, t, ctx); if (!hits.length || /\b(?:court )?(?:costs?|expenses?)\b|\bcostos?\b|\bgastos\b/i.test(t)) return []; return [hits[0]]; }
  function reviewsTest(t, ctx) {
    const re = /\b([1-5](?:\.\d)?)\s*(?:out of 5\s*)?(?:stars?|estrellas)\b|\b(?:five|5)[ -]star(?: rated)?\b|\b(\d[\d,]*)\+?\s*(?:(?:five|5)[ -]star\s+)?(?:google\s+)?(?:reviews|reseñas|opiniones)\b/gi; const out = []; let m;
    const fr = ctx.firm ? ctx.firm.g.reviews || {} : null; const fRating = fr && fr.rating !== '' && fr.rating != null ? +fr.rating : null; const fCount = fr && fr.count !== '' && fr.count != null ? +fr.count : null;
    while ((m = re.exec(t))) { if (inSpans(m.index, ctx.protect)) continue; const h = { at: m.index, hit: m[0] };
      if (!ctx.firm) { h.sev = ctx.posture === 'comp' ? 'warn' : 'info'; h.why = 'A rating or review count needs its source and date; in competitor posture, check it against the live profile.'; }
      else { const rv = m[1] ? +m[1] : /five|5/i.test(m[0]) && !m[2] ? 5 : null; const cv = m[2] ? +String(m[2]).replace(/,/g, '') : null;
        if (rv != null && fRating == null || cv != null && fCount == null) { h.sev = 'warn'; h.why = 'The firm profile has no rating or review count to support this claim (the Firm button, profiles and reviews).'; }
        else if (rv != null && rv > fRating + 0.05) { h.sev = 'warn'; h.why = `The copy claims ${rv} stars; the firm profile says ${fRating} (${fr.source || 'source not set'}).`; }
        else if (cv != null && cv > fCount) { h.sev = 'warn'; h.why = `The copy claims ${cv} reviews; the firm profile says ${fCount}.`; }
        else { h.sev = 'info'; h.why = `Matches the firm profile (${fRating != null ? fRating + ' stars' : ''}${fCount != null ? ', ' + fCount + ' reviews' : ''}${fr.source ? ', ' + fr.source : ''}). Put the source and the date beside it.`; } }
      out.push(h); }
    return out;
  }
  function esStaffTest(t, ctx) { if (!ctx.firm || ctx.lang !== 'es') return []; if ((ctx.firm.langs || []).includes('es')) return []; return [{ at: -1, hit: '' }]; }
  const GOV_WORDS = '(?:Divorce|Custody|Child Support|Family Law|Family Court|Paternity|Protective Order|CPS|Adoption|Family Violence)';
  const GOV_RE = new RegExp(`\\b(?:(?:Texas|State|County|City|Harris|Dallas|Bexar|Travis|Tarrant|Collin|Denton|Fort Bend|El Paso|Hidalgo|Cameron|Williamson|Montgomery)\\s+)?${GOV_WORDS}\\s+(?:Center|Office|Agency|Department|Bureau|Commission|Division|Authority|Clinic|Help ?(?:Center|Desk|Line)|Hotline|Registry|Services Office)\\b|\\b(?:Legal Aid|Legal Services Corporation|Official (?:State|County|Texas) [A-Z][a-z]+)\\b`, 'g');
  function tradeGovTest(t, ctx) { const out = []; GOV_RE.lastIndex = 0; let m; const name = ctx.firm && ctx.firm.g.name ? ctx.firm.g.name.toLowerCase() : ''; while ((m = GOV_RE.exec(t))) { if (inSpans(m.index, ctx.protect)) continue; const own = name && (name.includes(m[0].toLowerCase()) || m[0].toLowerCase().includes(name)); out.push({ at: m.index, hit: m[0], sev: own ? 'block' : 'warn', why: own ? `"${m[0]}" is in the firm's own name and reads as a government office or legal aid. A trade name may not imply that connection.` : undefined }); } return out; }
  function tradePartnerTest(t, ctx) { if (!ctx.firm || !ctx.firm.g.name || ctx.firm.atts.length > 1) return []; const re = /(?:&|\band)\s+(?:associates|partners)\b|\bLLP\b/gi; const out = []; let m; while ((m = re.exec(t))) out.push({ at: m.index, hit: m[0] }); return out; }
  function r702aTest(t, ctx) {
    const o = ctx.o; if (!ctx.kind || ctx.kind === 'social-reply' || o.footer === false) return [];
    const sev = ctx.kind === 'page' ? 'block' : 'warn';
    if (ctx.posture === 'comp') return /responsible (?:attorney|lawyer)|abogad[oa] responsable/i.test(t) ? [] : [{ at: -1, hit: '', sev: 'warn', why: 'No "responsible attorney" statement found. The page or ad may carry the responsible lawyer and primary practice location elsewhere (an extension, the landing page); check before it counts.' }];
    const F = ctx.firm; const low = t.toLowerCase(); const miss = [];
    if (!F || !F.r.name) miss.push('the responsible lawyer (the firm profile has none yet)'); else if (!low.includes(F.r.name.toLowerCase())) miss.push(`the name ${F.r.name}`);
    if (!F || !F.p.city) miss.push('the primary office city (the firm profile has none yet)'); else if (!low.includes(F.p.city.toLowerCase())) miss.push(`the primary office city, ${F.p.city}`);
    if (!miss.length) return [];
    const h = { at: -1, hit: '', sev, why: `Every advertisement must publish the name of a lawyer responsible for its content and the lawyer's primary practice location. Missing: ${miss.join(' and ')}. ${sev === 'block' ? 'Pages must carry both.' : 'Ad platforms can carry them in an extension or on the landing page.'}` };
    if (F && F.ready && F.F.adFooter) h.fixTo = F.F.adFooter();
    return [h];
  }
  const LAW_NUMS = new Set([11700, 9200, 8550, 7500, 2340, 1840, 5000]);
  function feeTest(t, ctx) {
    const re = /\$\s?(\d{1,3}(?:,\d{3})+|\d{2,6})(?:\.\d\d)?(?!\d)/g; const out = []; let m;
    const fees = ctx.firm ? Object.values(ctx.firm.g.fees || {}).filter(v => v != null && v !== '').map(Number) : []; const cf = ctx.firm && ctx.firm.g.consult ? +ctx.firm.g.consult.fee : null;
    while ((m = re.exec(t))) { const v = +m[1].replace(/,/g, ''); if (LAW_NUMS.has(v)) continue; const win = t.slice(Math.max(0, m.index - 45), m.index + m[0].length + 45).toLowerCase();
      if (!/\b(?:flat|fee|fees|consult\w*|retainer|starting at|from|only|just|price|cost|tarifa|honorarios|consulta|desde|precio)\b/.test(win)) continue;
      if (/support|net resources|cap\b|maintenance|manutenci|pensi|guideline|20\s?%|20 percent|veinte por ciento|modif|threshold/.test(win)) continue;   // statutory numbers such as the § 156.401 '20% or $100' modification test are not fees
      const h = { at: m.index, hit: m[0] };
      if (!ctx.firm) { h.sev = 'info'; h.why = 'An advertised fee binds the advertiser while the ad runs (Rule 7.02(d)).'; }
      else if (fees.includes(v) || (/consult/.test(win) && cf === v)) { h.sev = 'info'; h.why = `${m[0]} matches the firm profile. Honor it for every client who answers the ad while it runs.`; }
      else if (fees.length || cf) { h.sev = 'warn'; h.why = `${m[0]} is not a fee in the firm profile (${fees.map(f => '$' + f.toLocaleString('en-US')).concat(cf ? ['consultation $' + cf] : []).join(', ') || 'none'}). An advertised fee must be honored while the ad runs.`; }
      else { h.sev = 'warn'; h.why = `${m[0]} is advertised but the firm profile has no fees. Record it (the Firm button, consultations and fees) so every ad and page states the same number.`; }
      out.push(h); }
    return out;
  }
  function freeConsultTest(t, ctx) { if (!ctx.firm) return []; if (ctx.firm.g.consult && ctx.firm.g.consult.free) return []; const re = /\bfree (?:initial )?(?:consultations?|consults?|case (?:review|evaluation)s?)\b|(?<![\p{L}])consultas? (?:gratis|gratuitas?)(?![\p{L}])/giu; const out = []; let m; while ((m = re.exec(t))) out.push({ at: m.index, hit: m[0], sev: ctx.firm.ready ? 'block' : 'warn' }); return out; }
  function solLabelTest(t, ctx) { if (!ctx.o.solicitation || /\bADVERTISEMENT\b/.test(t)) return []; return [{ at: -1, hit: '', fixTo: 'ADVERTISEMENT' }]; }
  function solPleadingTest(t, ctx) { if (!ctx.o.solicitation) return []; const re = /\b(?:IN THE (?:DISTRICT|COUNTY) COURT|CAUSE NO\.?|ORIGINAL PETITION|CITATION|NOTICE TO (?:RESPONDENT|DEFENDANT)|YOU HAVE BEEN SUED|IN THE MATTER OF THE MARRIAGE OF|IN THE INTEREST OF)\b/g; const m = re.exec(t); return m ? [{ at: m.index, hit: m[0] }] : []; }
  function solChannelTest(t, ctx) { return ctx.o.solicitation ? [{ at: -1, hit: '' }] : []; }
  function arcTest(t, ctx) {
    const k = ctx.kind; const filed = ctx.firm && ctx.firm.g.arc && ctx.firm.g.arc.filed;
    let why;
    if (k === 'page') why = ctx.o.homepage ? 'The homepage is filed with the Advertising Review Committee within ten days of going live; other website pages are exempt (Rule 7.05).' : 'Website content other than the homepage is exempt from filing (Rule 7.05). It must still comply with 7.01 to 7.03.';
    else if (k === 'social') why = /\b(?:call|consult|hire|contact us|book|schedule|free consultation|llame|consulta|cont[aá]ctenos)\b/i.test(t) ? 'This post offers services, so it is an advertisement: file it within ten days of first posting. Informational or educational posts that do not offer services are exempt (Rule 7.05).' : 'Informational or educational social media that does not offer services is exempt from filing (Rule 7.05). This post does not appear to offer services; keep it that way or file it.';
    else if (k === 'email' || k === 'sms') why = 'A message to prospective clients is filed within ten days unless exempt; a newsletter to existing clients is exempt (Rule 7.05). A message to people known to need a lawyer is a solicitation (Rule 7.03).';
    else why = 'File a copy, the application and the fee with the Advertising Review Committee within ten days of first dissemination, unless it is exempt (Rule 7.05: basic information only, law lists, announcement cards, sponsorship acknowledgments). Pre approval is available thirty days ahead.';
    return [{ at: -1, hit: '', why: why + (filed ? ' The firm profile says filings are kept current; log this one in module 11.' : ' The filing log is in module 11.') }];
  }
  const META_P = new Set(['meta', '']), GOOGLE_P = new Set(['google', 'microsoft', 'youtube', 'demandgen', '']);
  function metaAttrTest(t, ctx) { if (!META_P.has(ctx.plat)) return []; return paHits(t, ctx).map(h => Object.assign(h, { sev: ctx.plat === 'meta' ? 'block' : 'warn' })); }
  function googleHardshipTest(t, ctx) { if (!GOOGLE_P.has(ctx.plat)) return []; return paHits(t, ctx); }
  const CAPS_OK = new Set(['SAPCR', 'USFSPA', 'QDRO', 'QDROS', 'DFPS', 'TBLS', 'ESPO', 'ADVERTISEMENT', 'TEXAS']);
  function editorialTest(t, ctx) { if (!/headline/i.test(ctx.o.field || '') || !['google', 'microsoft', 'youtube', 'demandgen'].includes(ctx.plat)) return []; const out = []; const i = t.indexOf('!'); if (i >= 0) out.push({ at: i, hit: '!' }); const re = /\b[A-Z]{5,}\b/g; let m; while ((m = re.exec(t))) if (!CAPS_OK.has(m[0])) { out.push({ at: m.index, hit: m[0] }); break; } return out; }
  function smsTest(t) { return /\bSTOP\b/.test(t) ? [] : [{ at: -1, hit: '' }]; }
  function webPixelTest(t, ctx) { const h = ctx.raw; const m = h.match(/fbevents\.js|googletagmanager|gtag\(|analytics\.tiktok|clarity\.ms|snap\.licdn/i); return m && !/privacy/i.test(h) ? [{ at: -1, hit: m[0] }] : []; }
  function webPrecheckTest(t, ctx) { const m = ctx.raw.match(/<input[^>]*type=["']?checkbox[^>]*\bchecked\b[^>]*>/i); return m ? [{ at: -1, hit: m[0].slice(0, 80) }] : []; }
  function webRatingTest(t, ctx) { const m = ctx.raw.match(/"aggregateRating"/i); return m ? [{ at: -1, hit: m[0] }] : []; }
  function placeholderTest(t, ctx) {
    const re = /\[(?!sic\])[^\]\n]{1,48}\](?!\()|\{\{?\s*[A-Za-z_][\w ]{0,30}\s*\}?\}|\$X{2,}|\bX{3,}\b/g; const out = []; let m;
    while ((m = re.exec(t))) { if (inSpans(m.index, ctx.protect)) continue; if (/^\[\s*[xX ]?\s*\]$/.test(m[0])) continue; out.push({ at: m.index, hit: m[0] }); }
    return out;
  }
  const DASHES = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]|-/g;
  function houseTest(t, ctx) {
    const o = ctx.o; if (o.house === false) return []; const out = []; DASHES.lastIndex = 0; let m;
    while ((m = DASHES.exec(t))) { if (inSpans(m.index, ctx.protect)) continue; let s = m.index, e = m.index + 1; while (s > 0 && !/\s/.test(t[s - 1])) s--; while (e < t.length && !/\s/.test(t[e])) e++; const tok = t.slice(s, e); out.push({ at: m.index, hit: tok, fixTo: null, from: tok }); DASHES.lastIndex = Math.max(DASHES.lastIndex, e); }
    if (out.length) { const f = out[0]; f.fixTo = house(f.hit); }
    return out;
  }

  /* ---- compile */
  const RULES = DEFS.map(d => { const r = Object.assign({ lang: 'en', v: '◐' }, d); if (r.re) { r._g = r.re.global ? r.re : new RegExp(r.re.source, r.re.flags + 'g'); } if (r.skip) r._skip = r.skip.global ? r.skip : new RegExp(r.skip.source, r.skip.flags + 'g'); r.url = (SOURCES[r.src] || {}).url || ''; r.cite = r.rule; r.name = r.t; return r; });
  const RULE = {}; RULES.forEach(r => { RULE[r.id] = r; });
  const ALIAS = {}; RULES.forEach(r => { if (r.alias) ALIAS[r.alias] = r.id; });
  const PLATFORMS = { google: 'Google Ads (search)', microsoft: 'Microsoft Ads', meta: 'Meta (Facebook and Instagram)', youtube: 'YouTube', demandgen: 'Google Demand Gen', tiktok: 'TikTok', linkedin: 'LinkedIn', lsa: 'Local Services Ads', gbp: 'Google Business Profile', yelp: 'Yelp', nextdoor: 'Nextdoor' };
  function normPlat(p) { const s = String(p || '').toLowerCase().trim(); if (!s) return ''; if (PLATFORMS[s]) return s; if (/facebook|instagram|^fb$|^ig$|meta/.test(s)) return 'meta'; if (/bing|microsoft/.test(s)) return 'microsoft'; if (/demand ?gen|discovery/.test(s)) return 'demandgen'; if (/youtube/.test(s)) return 'youtube'; if (/local services|^lsa/.test(s)) return 'lsa'; if (/business profile|^gbp|google my business|^gmb/.test(s)) return 'gbp'; if (/google|adwords|search/.test(s)) return 'google'; if (/tiktok/.test(s)) return 'tiktok'; if (/linkedin/.test(s)) return 'linkedin'; if (/yelp/.test(s)) return 'yelp'; if (/nextdoor/.test(s)) return 'nextdoor'; return s; }
  function applies(r, ctx) {
    if (r.lang === 'es' && ctx.langSet === 'en') return false;
    if (r.html && !ctx.html) return false;
    if (r.needKind && !ctx.kind) return false;
    if (r.kinds && !r.kinds.includes(ctx.kind)) return false;
    if (r.plats && !r.plats.includes(ctx.plat)) return false;
    if (r.self && ctx.posture !== 'self') return false;
    if (r.noComp && ctx.posture === 'comp') return false;
    if (r.id === 'house' && (ctx.o.house === false)) return false;
    return true;
  }
  function matchAll(r, t, ctx) {
    if (r.when && !(typeof r.when === 'function' ? r.when(ctx.whole || t, ctx) : r.when.test(ctx.whole || t))) return [];
    const re = r._g; re.lastIndex = 0; const sk = r._skip ? spansOf(r._skip, t) : []; const out = []; let m;
    while ((m = re.exec(t))) { if (!m[0]) { re.lastIndex++; continue; } const at = m.index; if (inSpans(at, sk) || inSpans(at, ctx.protect)) continue; if (r.neg && isNeg(t, at, m[0].length, r.neg, r.lang === 'any' ? null : r.lang)) continue; out.push({ at, hit: m[0] }); if (out.length >= 200) break; }
    return out;
  }
  function mkCtx(t, o, extra) { const langSet = o.lang === 'en' || o.lang === 'es' ? o.lang : null; return Object.assign({ o, t, raw: t, html: false, langSet, lang: langSet || detectLang(t), kind: o.kind || '', plat: normPlat(o.platform), posture: postureOf(o), firm: firmCtx(o), protect: spansOf(PROTECT, t) }, extra || {}); }

  /* ---- HTML: strip tags, skip script, style, noscript, template and comments, decode entities, keep a map back to the source */
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d', copy: '\u00a9', reg: '\u00ae', trade: '\u2122', sect: '\u00a7', laquo: '\u00ab', raquo: '\u00bb', iexcl: '\u00a1', iquest: '\u00bf', ntilde: '\u00f1', Ntilde: '\u00d1', aacute: '\u00e1', eacute: '\u00e9', iacute: '\u00ed', oacute: '\u00f3', uacute: '\u00fa', uuml: '\u00fc', Aacute: '\u00c1', Eacute: '\u00c9', Iacute: '\u00cd', Oacute: '\u00d3', Uacute: '\u00da', minus: '\u2212', shy: '' };
  const BLOCK_TAGS = /^(?:p|div|br|li|ul|ol|h[1-6]|tr|td|th|table|thead|tbody|section|article|header|footer|main|nav|aside|figure|figcaption|summary|details|dd|dt|dl|blockquote|title|option|form|label|button|hr|pre|address)$/;
  const looksHTML = s => /<\s*(?:!doctype|html|head|body|div|p|span|section|article|h[1-6]|ul|ol|li|a|br|strong|em|b|i|img|meta|title|table|main|header|footer|nav|script|style)\b[^>]*>/i.test(s);
  function stripHTML(html) {
    const s = String(html || ''); const out = []; const map = []; const n = s.length; let i = 0;
    const push = (ch, at) => { if (ch === '\n') { while (out.length && out[out.length - 1] === ' ') { out.pop(); map.pop(); } if (!out.length || out[out.length - 1] === '\n') return; out.push('\n'); map.push(at); return; } if (/\s/.test(ch)) { if (!out.length || out[out.length - 1] === ' ' || out[out.length - 1] === '\n') return; out.push(' '); map.push(at); return; } out.push(ch); map.push(at); };
    const attr = (tag, name) => { const m = tag.match(new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? { v: m[2] != null ? m[2] : m[3] != null ? m[3] : m[4], at: tag.indexOf(m[1]) + 1 } : null; };
    const pushText = (txt, at) => { for (let k = 0; k < txt.length; k++) { if (txt[k] === '&') { const m = /^&(#x[0-9a-f]+|#\d+|[a-z]+);/i.exec(txt.slice(k, k + 12)); if (m) { const e = m[1]; const ch = e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] != null ? ENT[e] : m[0]); for (const c of ch) push(c, at + k); k += m[0].length - 1; continue; } } push(txt[k], at + k); } };
    while (i < n) {
      const c = s[i];
      if (c === '<') {
        if (s.startsWith('<!--', i)) { const j = s.indexOf('-->', i + 4); i = j < 0 ? n : j + 3; continue; }
        if (s[i + 1] === '!' || s[i + 1] === '?') { const j = s.indexOf('>', i); i = j < 0 ? n : j + 1; continue; }
        const m = /^<\s*(\/?)\s*([a-zA-Z][\w:-]*)/.exec(s.slice(i, i + 64));
        if (m) {
          const tag = m[2].toLowerCase(); const end = s.indexOf('>', i); const tagText = s.slice(i, end < 0 ? n : end + 1);
          if (!m[1] && /^(?:script|style|noscript|template|svg|iframe)$/.test(tag)) { const close = s.toLowerCase().indexOf('</' + tag, end); const ce = close < 0 ? -1 : s.indexOf('>', close); i = ce < 0 ? n : ce + 1; push(' ', i - 1); continue; }
          if (!m[1] && tag === 'meta') { const nm = attr(tagText, 'name') || attr(tagText, 'property'); const ct = attr(tagText, 'content'); if (nm && ct && /^(?:description|og:title|og:description|twitter:title|twitter:description)$/i.test(nm.v)) { push('\n', i); pushText(ct.v, i + ct.at); push('\n', i); } }
          if (!m[1] && tag === 'img') { const alt = attr(tagText, 'alt'); if (alt && alt.v.trim()) { push(' ', i); pushText(alt.v, i + alt.at); push(' ', i); } }
          i = end < 0 ? n : end + 1; push(BLOCK_TAGS.test(tag) ? '\n' : ' ', i - 1); continue;
        }
      }
      let j = s.indexOf('<', i + 1); if (j < 0) j = n; pushText(s.slice(i, j), i); i = j;
    }
    while (out.length && /\s/.test(out[out.length - 1])) { out.pop(); map.pop(); }
    let k = 0; while (k < out.length && /\s/.test(out[k])) k++;
    return { text: out.slice(k).join(''), map: map.slice(k) };
  }
  /* run f on the text between tags (not inside script, style or comments) */
  function mapTextSegments(html, f, ftag) { return String(html).split(/(<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->|<[^>]*>)/i).map((seg, i) => i % 2 ? (ftag ? ftag(seg) : seg) : !seg.trim() ? seg : f(seg)).join(''); }
  /* the visible attributes the screen reads (meta description and social titles, image alt text) get the same fixes */
  function fixTagAttrs(tag, f) {
    if (/^<meta\b/i.test(tag)) return /\b(?:name|property)\s*=\s*["']?(?:description|og:title|og:description|twitter:title|twitter:description)\b/i.test(tag) ? tag.replace(/(\bcontent\s*=\s*)(["'])([\s\S]*?)\2/i, (m, a, q, v) => a + q + f(v) + q) : tag;
    if (/^<img\b/i.test(tag)) return tag.replace(/(\balt\s*=\s*)(["'])([\s\S]*?)\2/i, (m, a, q, v) => v.trim() ? a + q + f(v) + q : m);
    return tag;
  }

  /* ---- language: Spanish or English, from common words */
  function detectLang(t) {
    const s = ' ' + String(t || '').toLowerCase().replace(/[^a-záéíóúñü¿¡\s]+/g, ' ').replace(/\s+/g, ' ') + ' ';
    const cnt = ws => ws.reduce((n, w) => n + (s.split(' ' + w + ' ').length - 1), 0);
    const es = cnt(['el', 'la', 'los', 'las', 'del', 'que', 'y', 'su', 'sus', 'para', 'con', 'por', 'una', 'es', 'se', 'al', 'divorcio', 'abogado', 'abogada', 'abogados', 'custodia', 'hijos', 'usted', 'llame', 'hoy']) + (/[ñ¿¡]/.test(s) ? 3 : 0);
    const en = cnt(['the', 'and', 'of', 'to', 'your', 'for', 'with', 'is', 'an', 'you', 'our', 'we', 'divorce', 'lawyer', 'attorney', 'custody', 'children', 'call', 'today']);
    return es >= 3 && es > en * 1.3 ? 'es' : 'en';
  }

  /* ---- house style for outbound copy */
  function house(s, log) {
    if (s == null) return s; s = String(s); const L = Array.isArray(log) ? log : null;
    const keep = []; s = s.replace(PROTECT, m => { keep.push(m); return '\u0001' + (keep.length - 1) + '\u0001'; });
    const rep = (re, f) => { s = s.replace(re, (...a) => { const m = a[0]; const r = f(...a); if (L && r !== m) L.push({ id: 'house', from: m, to: r }); return r; }); };
    const D = '\\-\\u2010-\\u2015\\u2212';
    rep(new RegExp(`(?<![\\w])(?:\\+?1[\\s.${D}])?\\(?(\\d{3})\\)?[\\s.${D}]{1,2}(\\d{3})[${D}](\\d{4})(?!\\d)`, 'g'), (m, a, b, c) => `(${a}) ${b} ${c}`);
    rep(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => (+mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31) ? `${MONTHS[+mo - 1]} ${+d}, ${y}` : m);
    rep(new RegExp(`^([ \\t]*)[${D}]+[ \\t]+`, 'gm'), (m, sp) => sp);
    rep(new RegExp(`(?<![\\d.,/§])(\\$?)(\\d[\\d,]*(?:\\.\\d+)?)(%?)\\s*[${D}]\\s*(\\$?)(\\d[\\d,]*(?:\\.\\d+)?)(%?)(?![\\d${D}])`, 'g'), (m, c1, a, p1, c2, b, p2) => { const da = a.replace(/\D/g, '').length, db = b.replace(/\D/g, '').length; return db > da + 1 ? `${c1}${a}${p1} ${c2}${b}${p2}` : `${c1}${a}${p1} to ${c2}${b}${p2}`; });
    rep(/\b(e)-(mail)\b|\b(co)-(parent\w*)\b|\b(step)-(parent\w*|child\w*|son|daughter|father|mother)\b|\b(pre|post)-(nup\w*)\b/gi, m => m.replace('-', ''));
    rep(/[ \t]*(?:[\u2012\u2013\u2014\u2015]|--+)[ \t]*/g, () => ', ');
    rep(/[ \t]+[-\u2010\u2011\u2212][ \t]+/g, () => ', ');
    rep(new RegExp(`(?<=[\\p{L}\\d])[${D}]+(?=[\\p{L}\\d])`, 'gu'), () => ' ');
    rep(new RegExp(`[${D}]`, 'g'), () => ' ');
    s = s.split('\n').map(l => l.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/,\s*,/g, ',').replace(/,\s*([.!?;:])/g, '$1').replace(/^\s*,\s*/, '').replace(/,\s*$/, '').replace(/[ \t]+$/, '')).join('\n');
    return s.replace(/\u0001(\d+)\u0001/g, (m, k) => keep[+k]);
  }

  /* ---- screen */
  function mkFinding(r, hits, ctx, S) {
    hits = hits.slice().sort((a, b) => rank(a.sev || r.sev) - rank(b.sev || r.sev) || (a.at < 0) - (b.at < 0) || a.at - b.at);
    const h = hits[0]; const t = ctx.t; const sev = h.sev || r.sev; const at = h.at;
    let fix = null; if (h.fixTo != null) fix = { from: h.hit, to: h.fixTo }; else if (r.fix && at >= 0) { const to = typeof r.fix === 'function' ? r.fix(h.hit, t, at, ctx) : r.fix; if (to != null && to !== h.hit) fix = { from: h.hit, to: caseLike(h.hit, to, t, at) }; }
    const f = { id: r.id, sev, title: h.title || r.t, rule: r.rule, why: h.why || r.why, hit: h.hit || '', at: at >= 0 ? at : -1, fix, fam: r.fam, n: hits.length, hits: hits.filter(x => x.at >= 0).slice(0, 100).map(x => ({ at: x.at, len: (x.hit || '').length, sev: x.sev || r.sev })), v: r.v, url: r.url, src: r.src, settle: r.settle || '', lang: r.lang, obs: r.obs !== false };
    if (r.alias) f.alias = r.alias;
    if (at >= 0) { const b = t.slice(Math.max(0, at - 70), at); const a = t.slice(at + f.hit.length, at + f.hit.length + 70); f.ctx = { before: (at > 70 ? '…' : '') + b.replace(/^\S*\s/, at > 70 ? '' : '$&'), after: a.replace(/\s\S*$/, at + f.hit.length + 70 < t.length ? '' : '$&') + (at + f.hit.length + 70 < t.length ? '…' : '') }; f.line = t.slice(0, at).split('\n').length; if (S && S.map) { f.src_at = S.map[at]; f.line = String(S.raw).slice(0, f.src_at).split('\n').length; } }
    return f;
  }
  function screen(text, o) {
    o = Object.assign({}, o || {});
    const raw = String(text == null ? '' : text); const isHtml = o.html === true || (o.html == null && looksHTML(raw));
    const S = isHtml ? Object.assign(stripHTML(raw), { raw }) : { text: raw, map: null, raw };
    const ctx = mkCtx(S.text, o, { raw, html: isHtml });
    const findings = [];
    for (const r of RULES) {
      if (r.post || !applies(r, ctx)) continue;
      let hits; try { hits = r.test ? r.test(ctx.t, ctx) : matchAll(r, ctx.t, ctx); } catch (e) { hits = []; }
      if (hits && hits.length) findings.push(mkFinding(r, hits, ctx, S));
    }
    if (ctx.posture !== 'comp' && findings.some(f => f.sev === 'block' && f.fam === TX && f.id !== 'r702a')) findings.push(mkFinding(RULE.r706, [{ at: -1, hit: '' }], ctx, S));
    findings.sort((a, b) => rank(a.sev) - rank(b.sev) || (a.at < 0) - (b.at < 0) || a.at - b.at);
    const counts = { block: 0, fix: 0, warn: 0, info: 0 }; findings.forEach(f => { counts[f.sev] = (counts[f.sev] || 0) + 1; });
    return { findings, counts, pass: !counts.block, text: ctx.t, lang: ctx.lang, html: isHtml, version: VERSION };
  }

  /* ---- fix: deterministic corrections at the flagged hits only, then the house style */
  function fixPlain(t, o, applied, whole) {
    const ctx = mkCtx(t, o, { whole }); const edits = [];
    for (const r of RULES) {
      if (r.post || !applies(r, ctx) || r.id === 'house' || r.id === 'r702a' || r.id === 'sol_label') continue;
      if (!r.fix && r.id !== 'certified') continue;
      let hits; try { hits = r.test ? r.test(t, ctx) : matchAll(r, t, ctx); } catch (e) { hits = []; }
      (hits || []).forEach(h => { if (h.at < 0) return; let to = h.fixTo != null ? h.fixTo : r.fix ? (typeof r.fix === 'function' ? r.fix(h.hit, t, h.at, ctx) : r.fix) : null; if (to == null || to === h.hit) return; let end = h.at + h.hit.length, cap = false; if (to === '') { while (end < t.length && /[ \t]/.test(t[end])) end++; cap = sentenceStart(t, h.at); } else to = caseLike(h.hit, to, t, h.at); edits.push({ id: r.id, start: h.at, end, from: h.hit, to, cap }); });
    }
    edits.sort((a, b) => a.start - b.start); const keep = []; let lastEnd = -1; edits.forEach(e => { if (e.start >= lastEnd) { keep.push(e); lastEnd = e.end; } });
    for (let k = keep.length - 1; k >= 0; k--) { const e = keep[k]; let rest = t.slice(e.end); if (e.cap) rest = rest.replace(/^\p{Ll}/u, c => c.toUpperCase()); t = t.slice(0, e.start) + e.to + rest; }
    keep.forEach(e => applied.push({ id: e.id, from: e.from, to: e.to }));
    if (keep.length) t = t.split('\n').map(l => l.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1')).join('\n');
    if (o.house !== false && postureOf(o) !== 'comp') { const log = []; const h = house(t, log); if (h !== t) { log.forEach(x => applied.push(x)); t = h; } }
    return t;
  }
  function fix(text, o) {
    o = Object.assign({}, o || {}); const raw = String(text == null ? '' : text); const isHtml = o.html === true || (o.html == null && looksHTML(raw));
    const applied = []; let out;
    if (isHtml) { const whole = stripHTML(raw).text; const fp = seg => fixPlain(seg.replace(/&(?:mdash|#8212|#x2014);/gi, '\u2014').replace(/&(?:ndash|#8211|#x2013);/gi, '\u2013'), o, applied, whole); out = mapTextSegments(raw, fp, tag => fixTagAttrs(tag, fp)); }
    else out = fixPlain(raw, o, applied, raw);
    if (o.solicitation && !/\bADVERTISEMENT\b/.test(out)) { out = isHtml ? (/<body\b[^>]*>/i.test(out) ? out.replace(/(<body\b[^>]*>)/i, '$1\n<p><strong>ADVERTISEMENT</strong></p>') : '<p><strong>ADVERTISEMENT</strong></p>\n' + out) : 'ADVERTISEMENT\n\n' + out; applied.push({ id: 'sol_label', from: '', to: 'ADVERTISEMENT' }); }
    if (['page', 'email', 'social'].includes(o.kind) && o.footer !== false && o.posture !== 'comp') {
      const F = firmCtx(o); const plain = isHtml ? stripHTML(out).text.toLowerCase() : out.toLowerCase();
      if (F && F.ready && F.F.adFooter && F.r.name && F.p.city && !(plain.includes(F.r.name.toLowerCase()) && plain.includes(F.p.city.toLowerCase()))) { const foot = F.F.adFooter(); out = isHtml ? (/<\/body>/i.test(out) ? out.replace(/<\/body>/i, `<p>${foot}</p>\n</body>`) : out + `\n<p>${foot}</p>`) : out.replace(/\s*$/, '') + '\n\n' + foot; applied.push({ id: 'r702a', from: '', to: foot }); }
    }
    return { text: out, applied };
  }

  /* ---- ads: platform limits, counts, editorial checks per field, then the screen on the whole ad */
  const LIMITS = {
    google: { headline: 30, description: 90, path: 15, sitelink: 25, sitelink_desc: 35, callout: 25, snippet: 25, long_headline: 90, business: 25 },
    microsoft: { headline: 30, description: 90, path: 15, sitelink: 25, sitelink_desc: 35, callout: 25 },
    meta: { primary: 125, headline: 40, description: 30 },
    youtube: { headline: 30, long_headline: 90, description: 90 },
    demandgen: { headline: 40, description: 90, business: 25 },
    tiktok: { text: 100, display_name: 40 },
    linkedin: { intro: 150, headline: 70, description: 100 },
    lsa: { bio: 1000 },
    gbp: { post: 1500, description: 750 },
    yelp: { headline: 50, body: 500 },
    nextdoor: { headline: 90, body: 400 }
  };
  const HARD = { google: true, microsoft: true, youtube: true, demandgen: true, tiktok: true, gbp: true };
  const COUNTS = { google: { headline: [3, 15], description: [2, 4], path: [0, 2] }, microsoft: { headline: [3, 15], description: [2, 4], path: [0, 2] } };
  const FIELD_ALIAS = { primary_text: 'primary', body_text: 'primary', message: 'primary', title: 'headline', link_description: 'description', news_feed_link_description: 'description', long: 'long_headline', business_name: 'business', ad_text: 'text', introductory_text: 'intro', intro_text: 'intro', sitelink_text: 'sitelink', sitelink_description: 'sitelink_desc', callout_text: 'callout', structured_snippet: 'snippet', business_bio: 'bio' };
  function fieldBase(k, plat) { let b = String(k).toLowerCase().trim().replace(/[\s-]+/g, '_').replace(/_?\d+$/, ''); b = FIELD_ALIAS[b] || b; if (b === 'body' && plat === 'meta') b = 'primary'; if (b === 'text' && plat === 'meta') b = 'primary'; if (b === 'text' && plat === 'linkedin') b = 'intro'; if (b === 'text' && plat === 'gbp') b = 'post'; if (b === 'text' && (plat === 'yelp' || plat === 'nextdoor')) b = 'body'; return b; }
  function screenAd(ad, o) {
    ad = ad || {}; o = Object.assign({}, o || {}); const plat = normPlat(ad.platform || o.platform); const lim = LIMITS[plat] || {}; const fields = ad.fields || {}; const keys = Object.keys(fields).filter(k => fields[k] != null && String(fields[k]).trim() !== '');
    const extra = []; const base = {};
    keys.forEach(k => { const v = String(fields[k]); const b = fieldBase(k, plat); base[b] = (base[b] || 0) + 1; const max = lim[String(k).toLowerCase()] || lim[b];
      if (max && v.length > max) extra.push({ id: 'len_' + k, sev: HARD[plat] ? 'block' : 'warn', title: `${k} is ${v.length} characters`, rule: `${PLATFORMS[plat] || plat} limit ${max}`, why: HARD[plat] ? `The platform rejects ${k} over ${max} characters.` : `${PLATFORMS[plat] || plat} truncates ${k} after about ${max} characters; the end will not show.`, hit: v, at: -1, fix: null, fam: PLAT, n: 1, hits: [], v: '◐', url: '', src: 'limits', settle: 'Shorten it.', field: k, lang: 'any', obs: true });
      const ed = editorialTest(v, { o: { field: b }, plat }); if (ed.length) { const r = RULE.ggl_editorial; extra.push({ id: 'ggl_editorial', sev: r.sev, title: r.t, rule: r.rule, why: r.why, hit: ed[0].hit, at: -1, fix: null, fam: r.fam, n: ed.length, hits: [], v: r.v, url: r.url, src: r.src, settle: r.settle, field: k, lang: 'any', obs: true }); } });
    const cnt = COUNTS[plat]; if (cnt && keys.length) Object.keys(cnt).forEach(b => { const n = base[b] || 0; const [mn, mx] = cnt[b]; if (n < mn) extra.push({ id: 'count_' + b, sev: 'warn', title: `${n} ${b}${n === 1 ? '' : 's'}; ${PLATFORMS[plat]} needs at least ${mn}`, rule: `${PLATFORMS[plat]} responsive search ad`, why: `A responsive search ad takes ${mn} to ${mx} ${b}s.`, hit: '', at: -1, fix: null, fam: PLAT, n: 1, hits: [], v: '◐', url: '', src: 'limits', settle: `Add ${b}s.`, lang: 'any', obs: true }); if (n > mx) extra.push({ id: 'count_' + b, sev: 'block', title: `${n} ${b}s; ${PLATFORMS[plat]} takes at most ${mx}`, rule: `${PLATFORMS[plat]} responsive search ad`, why: `A responsive search ad takes ${mn} to ${mx} ${b}s.`, hit: '', at: -1, fix: null, fam: PLAT, n: 1, hits: [], v: '◐', url: '', src: 'limits', settle: `Drop ${b}s.`, lang: 'any', obs: true }); });
    /* fields are joined with ' | ' so no rule matches across two fields (\s+ would bridge a newline: 'Smith Family Law' + 'Office in Plano') */
    const SEP = ' | '; const offs = []; let pos = 0; const joined = keys.map(k => { const v = String(fields[k]); offs.push([pos, pos + v.length, k]); pos += v.length + SEP.length; return v; }).join(SEP);
    const r = screen(joined, Object.assign({ kind: 'ad' }, o, { platform: plat, html: false }));
    r.findings.forEach(f => { if (f.at >= 0) { const x = offs.find(q => f.at >= q[0] && f.at <= q[1]); if (x) f.field = x[2]; } });
    const findings = extra.concat(r.findings).sort((a, b) => rank(a.sev) - rank(b.sev));
    const counts = { block: 0, fix: 0, warn: 0, info: 0 }; findings.forEach(f => { counts[f.sev] = (counts[f.sev] || 0) + 1; });
    return { findings, counts, pass: !counts.block, text: joined, lang: r.lang, html: false, fields: keys, platform: plat, version: VERSION };
  }
  function checkAd(ad, o) { return screenAd(ad, o).findings; }
  function fixAd(ad, o) { const fields = {}; const applied = []; Object.keys((ad && ad.fields) || {}).forEach(k => { const r = fix(String(ad.fields[k] == null ? '' : ad.fields[k]), Object.assign({ kind: 'ad', platform: ad.platform }, o || {}, { html: false })); fields[k] = r.text; r.applied.forEach(a => applied.push(Object.assign({ field: k }, a))); }); return { platform: ad && ad.platform, fields, applied }; }

  /* ---- batches and imports */
  function splitBatch(text) {
    return String(text || '').replace(/\r\n?/g, '\n').split(/^[ \t]*-{3,}[ \t]*$/m).map(s => s.replace(/^\n+|\n+$/g, '')).filter(s => s.trim()).map((s, i) => {
      const it = { label: 'Item ' + (i + 1), text: s }; const m = s.match(/^#{1,3}[ \t]+(.+)\n/);
      if (m) { it.label = m[1].trim(); it.text = s.slice(m[0].length).replace(/^\n+/, ''); const p = normPlat((m[1].match(/\b(google|microsoft|bing|meta|facebook|instagram|youtube|demand ?gen|tiktok|linkedin|lsa|local services|gbp|business profile|yelp|nextdoor)\b/i) || [])[1]); if (p) it.platform = p; const k = (m[1].match(/\b(page|landing|homepage|email|sms|text message|social|post|video|script|gbp|ad)\b/i) || [])[1]; if (k) it.kind = /page|landing|homepage/i.test(k) ? 'page' : /sms|text message/i.test(k) ? 'sms' : /social|post/i.test(k) ? 'social' : /video|script/i.test(k) ? 'video' : k.toLowerCase(); if (/homepage/i.test(m[1])) it.homepage = true; if (/\b(es|spanish|español)\b/i.test(m[1])) it.lang = 'es'; }
      if (looksHTML(it.text)) { it.html = true; it.kind = it.kind || 'page'; }
      return it; });
  }
  function parseCSVText(text) {
    text = String(text || '').replace(/^\ufeff/, ''); const first = text.split('\n', 1)[0]; const d = first.split('\t').length > first.split(',').length ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; } if (c === '"') q = true; else if (c === d) { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c; }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim() !== '') && !/^#/.test(String(r[0] || '')));
  }
  const HDR = [
    [/^(?:platform|network|channel|publisher|source)$/, 'platform'], [/^(?:lang|language|idioma|locale)$/, 'lang'], [/^(?:kind|copy type|asset type)$/, 'kind'],
    [/^(?:label|ad name|ad id|name|id|ad)$/, 'label'], [/^campaign(?: name)?$/, 'campaign'], [/^(?:ad ?group|ad set)(?: name)?$/, 'adgroup'],
    [/^headline ?(\d+)$/, 'headline$1'], [/^description(?: line)? ?(\d+)$/, 'description$1'], [/^path ?(\d)$/, 'path$1'], [/^long headline ?(\d*)$/, 'long_headline$1'], [/^business name$/, 'business'],
    [/^(?:primary text|body|message|ad text|text|copy|caption|content)$/, 'text'], [/^(?:title|headline)$/, 'headline'], [/^(?:link description|description|news feed link description)$/, 'description'],
    [/^(?:introductory text|intro text|intro)$/, 'intro'], [/^display name$/, 'display_name'], [/^sitelink(?: text)? ?(\d*)$/, 'sitelink$1'], [/^sitelink description(?: line)? ?(\d*)$/, 'sitelink_desc$1'], [/^callout(?: text)? ?(\d*)$/, 'callout$1'], [/^(?:bio|business bio)$/, 'bio'], [/^(?:post|update)$/, 'post']
  ];
  function parseAdsCSV(text) {
    const rows = parseCSVText(text); if (rows.length < 2) return { items: [], warnings: ['The file needs a header row and at least one ad row.'], mapped: {} };
    const head = rows[0].map(h => String(h).trim()); const map = head.map(h => { const l = h.toLowerCase().replace(/\s+/g, ' ').trim(); for (const [re, to] of HDR) { const m = l.match(re); if (m) return to.replace('$1', m[1] || ''); } return null; });
    const mapped = {}; head.forEach((h, i) => { if (map[i]) mapped[h] = map[i]; });
    const fieldCols = map.map((m, i) => m && !['platform', 'lang', 'kind', 'label', 'campaign', 'adgroup'].includes(m) ? i : -1).filter(i => i >= 0);
    const warnings = []; if (!fieldCols.length) warnings.push('No copy columns recognized. Name them like Headline 1, Description 1, Primary text, Title, Ad text or Text.');
    const ignored = head.filter((h, i) => !map[i]); if (ignored.length) warnings.push('Not screened (not copy): ' + ignored.slice(0, 12).join(', ') + (ignored.length > 12 ? ' and ' + (ignored.length - 12) + ' more' : '') + '.');
    const col = k => map.indexOf(k); const has = re => map.some(m => m && re.test(m));
    const guess = has(/^headline\d+$|^description\d+$/) ? 'google' : has(/^intro$/) ? 'linkedin' : has(/^display_name$/) ? 'tiktok' : (has(/^text$/) && has(/^headline$/)) ? 'meta' : '';
    const items = rows.slice(1).map((r, n) => { const cell = i => i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : ''; const plat = normPlat(cell(col('platform'))) || guess; const fields = {}; fieldCols.forEach(i => { const v = cell(i); if (v) fields[map[i]] = v; }); const label = cell(col('label')) || [cell(col('campaign')), cell(col('adgroup'))].filter(Boolean).join(' · ') || 'Row ' + (n + 2); const lang = cell(col('lang')).toLowerCase(); const kind = cell(col('kind')).toLowerCase(); return { label, platform: plat, fields, lang: /^es|span/.test(lang) ? 'es' : /^en/.test(lang) ? 'en' : '', kind: /page|sms|email|social|video|gbp/.test(kind) ? kind.match(/page|sms|email|social|video|gbp/)[0] : 'ad', row: n + 2 }; }).filter(it => Object.keys(it.fields).length);
    if (!guess && !map.includes('platform')) warnings.push('No platform column and the columns do not identify one; character limits are not checked. Add a Platform column (google, meta, tiktok, linkedin and so on).');
    return { items, warnings, mapped, platform: guess };
  }

  /* ---- word diff for the "what changed" view: lines first, then words inside changed lines */
  function lcsOps(A, B) {
    let s = 0; while (s < A.length && s < B.length && A[s] === B[s]) s++;
    let e = 0; while (e < A.length - s && e < B.length - s && A[A.length - 1 - e] === B[B.length - 1 - e]) e++;
    const a = A.slice(s, A.length - e), b = B.slice(s, B.length - e); const ops = A.slice(0, s).map(x => ['=', x]);
    if (a.length * b.length > 4e6) { a.forEach(x => ops.push(['-', x])); b.forEach(x => ops.push(['+', x])); }
    else { const n = a.length, m = b.length; const T = new Uint32Array((n + 1) * (m + 1)); for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) T[i * (m + 1) + j] = a[i] === b[j] ? T[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(T[(i + 1) * (m + 1) + j], T[i * (m + 1) + j + 1]);
      let i = 0, j = 0; while (i < n && j < m) { if (a[i] === b[j]) { ops.push(['=', a[i]]); i++; j++; } else if (T[(i + 1) * (m + 1) + j] >= T[i * (m + 1) + j + 1]) { ops.push(['-', a[i]]); i++; } else { ops.push(['+', b[j]]); j++; } } while (i < n) ops.push(['-', a[i++]]); while (j < m) ops.push(['+', b[j++]]); }
    A.slice(A.length - e).forEach(x => ops.push(['=', x])); return ops;
  }
  function diff(a, b) {
    const out = []; const push = (t, s) => { if (!s) return; const l = out[out.length - 1]; if (l && l.t === t) l.s += s; else out.push({ t, s }); };
    const lo = lcsOps(String(a == null ? '' : a).split('\n'), String(b == null ? '' : b).split('\n'));
    for (let i = 0; i < lo.length; i++) {
      if (lo[i][0] === '=') { push('=', lo[i][1] + '\n'); continue; }
      const dels = [], ins = []; while (i < lo.length && lo[i][0] !== '=') { (lo[i][0] === '-' ? dels : ins).push(lo[i][1]); i++; } i--;
      const k = Math.min(dels.length, ins.length);
      for (let j = 0; j < k; j++) { lcsOps(dels[j].split(/(\s+)/), ins[j].split(/(\s+)/)).forEach(([t, s]) => push(t, s)); push('=', '\n'); }
      dels.slice(k).forEach(x => push('-', x + '\n')); ins.slice(k).forEach(x => push('+', x + '\n'));
    }
    const l = out[out.length - 1]; if (l) { l.s = l.s.replace(/\n$/, ''); if (!l.s) out.pop(); }
    return out;
  }

  /* ---- the firm profile as items to screen (tagline, bios, the ad footer) */
  function firmItems() {
    const F = FIRM_(); if (!F) return []; const g = F.get() || {}; const out = [];
    if (g.name) out.push({ label: 'Firm name', text: g.name, kind: 'ad', footer: false, house: false });
    if (g.legal_name && g.legal_name !== g.name) out.push({ label: 'Legal name', text: g.legal_name, kind: 'ad', footer: false, house: false });
    if (g.tagline) out.push({ label: 'Tagline', text: g.tagline, kind: 'ad', footer: false });
    (g.attorneys || []).forEach(a => { if (a && a.bio) out.push({ label: 'Bio, ' + (a.name || 'unnamed lawyer'), text: a.bio, kind: 'page', footer: false }); });
    if (F.adFooter) out.push({ label: 'Ad footer (Rule 7.02(a))', text: F.adFooter(), kind: 'ad' });
    return out;
  }

  /* ---- Rule 7.04 and 7.05 in one place (the filing log in module 11 uses it) */
  const FILING = { days: 10, preapproval: 30, exempt: ['Website content other than the homepage', 'Law lists, directories and announcement or business cards', 'Newsletters and messages to existing and former clients', 'Informational or educational social media that does not offer services', 'Sponsorship acknowledgments', 'Basic information: name, address, phone, practice areas, bar admissions, education, languages, TBLS certifications, fees for an initial consultation'] };

  /* ---- the dated register of Texas family law and advertising changes that copy must reflect (module 11). Built only from facts
     already in Severance: the rule whys above (build 1 COMP_RULES), LINE_META .angle and .law (module 06) and module 20's sources. */
  const CHANGES = [
    { date: '2021-07-01', title: 'Texas advertising rules rewritten as Rules 7.01 to 7.06', what: 'Part VII of the Texas Disciplinary Rules of Professional Conduct took effect (Misc. Docket No. 21-9061): a responsible lawyer and primary practice location on every advertisement, special competence only in the TBLS form, a filing with the Advertising Review Committee within ten days unless exempt.', copy: 'Every ad and page names the responsible lawyer and the primary office city; "specialist" and "expert" become "practice focused on"; log each filing.', rules: ['r702a', 'competence', 'arc_filing'], cite: 'Rules 7.01 to 7.06', src: 'Module 20 sources; module 11 rules' },
    { date: '2021', title: 'Expanded standard possession order is the default within 50 miles', what: 'The expanded standard possession order became the default when parents live within 50 miles of each other.', copy: 'Describe the expanded order as the default since 2021; never as a 2025 change; do not present the older standard order as the default.', rules: ['espo_2025', 'equal_time'], cite: 'Tex. Fam. Code § 153.3171', src: 'LINE_META.div_k.angle and .law', sample: 'The new 2025 expanded standard possession order gives you more time.' },
    { date: '2023', title: 'Protective orders: violence occurred, not that it will recur', what: 'The applicant proves that family violence occurred; the requirement to prove it is likely to occur again was removed.', copy: 'Drop "likely to happen again" from protective order pages and ads.', rules: ['po_future'], cite: 'Tex. Fam. Code ch. 85', src: 'LINE_META.po.angle', sample: 'To get a protective order you must prove family violence is likely to occur again.' },
    { date: '2023', title: 'Reimbursement claims on one unjust enrichment standard', what: 'Reimbursement between marital estates runs on a unified unjust enrichment standard (HB 1547).', copy: 'High asset pages: describe reimbursement on the current standard; tracing and the clear and convincing burden for separate property are the technical hooks.', rules: [], cite: 'Tex. Fam. Code ch. 3 subch. E (HB 1547, 2023)', src: 'LINE_META.high.angle and .law' },
    { date: '2023-09-01', title: 'DFPS stops accepting anonymous reports', what: 'DFPS no longer accepts anonymous reports; only a tip made to law enforcement and referred to DFPS gets a preliminary investigation.', copy: 'CPS defense pages: do not say DFPS investigates anonymous reports.', rules: ['anonymous_reports', 'anonymous_reports_es'], cite: 'HB 63 (2023), § 261.304', src: 'COMP_RULES r20; LINE_META.cps.angle', sample: 'CPS opens a case on anonymous reports from neighbors.' },
    { date: '2025', title: 'Equal time presumption bill fails', what: 'SB 849 (2025), an equal parenting time presumption, did not pass. Joint managing conservatorship still does not mean equal time.', copy: 'Never say Texas presumes 50/50 or equal time.', rules: ['equal_time', 'equal_time_es'], cite: 'SB 849 (2025); § 153.135', src: 'COMP_RULES r16', sample: 'Texas now has a presumption of equal time for both parents.' },
    { date: '2025', title: 'Arrears interest change dies; the rate stays 6%', what: 'HB 4213 (2025), which would have changed the interest on child support arrears, died. Arrears carry 6% simple interest and never expire.', copy: 'Enforcement pages: 6% simple interest; never 3%.', rules: ['stale_arrears', 'arrears_expire'], cite: '§ 157.265; HB 4213 (2025)', src: 'COMP_RULES r18; LINE_META.enf.angle', sample: 'Back child support now accrues 3% interest.' },
    { date: '2025', title: 'Three possession contempt findings are a material change', what: 'A possession contempt finding after repeated findings is a material change for custody modification (§ 156.107, new in 2025).', copy: 'Modification pages may use it as an angle; state it as the statute does, without promising a modification.', rules: [], cite: '§ 156.107', src: 'LINE_META.mod.angle and .law' },
    { date: '2025-09-01', title: 'Child support cap rises to $11,700', what: 'The guideline cap on monthly net resources rose from $9,200 to $11,700 ($2,340 for one child at the cap).', copy: 'Replace $9,200 with $11,700 and $1,840 with $2,340 in every support page, ad and calculator.', rules: ['stale_cap', 'stale_per_child'], cite: 'Tex. Fam. Code § 154.125; OAG adjustment', src: 'COMP_RULES r13; LINE_META.div_k.angle', sample: 'Texas child support is capped at $9,200 in monthly net resources.' },
    { date: '2025-09-01', title: 'Termination ground (O) repealed', what: 'Ground (O), service plan noncompliance, was repealed including for pending suits; the grounds were relettered (A) to (U).', copy: 'CPS defense pages: remove ground (O) and the old letters.', rules: ['ground_o'], cite: 'HB 116 (2025)', src: 'COMP_RULES r19; LINE_META.cps.angle', sample: 'DFPS can terminate under ground (O) for missing service plan steps.' },
    { date: '2025-09', title: 'Protective orders tied to a pending divorce or SAPCR', what: 'An order tied to a pending divorce or SAPCR runs until two years after the final decree.', copy: 'Protective order pages: do not state a flat two year duration.', rules: ['po_duration'], cite: 'Tex. Fam. Code § 85.025; SB 1120 (2025)', src: 'LINE_META.po.angle and .law', sample: 'A protective order lasts two years.' },
    { date: '2025-11', title: 'Proposition 15 parental rights amendment adopted', what: 'Voters adopted the parental rights amendment in November 2025. As of June 2026 the Supreme Court of Texas had not defined its effect.', copy: 'Describe it; do not state what it changes in a custody case.', rules: ['prop15'], cite: 'Proposition 15 (2025)', src: 'Module 11 build 1, content facts', sample: 'Prop 15 means Texas courts must now favor parents in every custody fight.' }
  ];

  return { VERSION, SEVS, SEV_LABEL, RULES, RULE, rule: id => RULE[id] || RULE[ALIAS[id]] || null, ALIAS, SOURCES, LIMITS, HARD, COUNTS, PLATFORMS, FILING, CHANGES, normPlat, fieldBase,
    screen, fix, house, checkAd, screenAd, fixAd, stripHTML, looksHTML, detectLang, splitBatch, parseAdsCSV, parseCSV: parseCSVText, diff, firmItems };
})();
/* build 1 shape of the regex rules (sev crit | review | info), kept for anything that still reads COMP_RULES */
const COMP_RULES = LINT.RULES.filter(r => r.re && r.lang !== 'es').map(r => ({ id: r.id, alias: r.alias || '', re: new RegExp(r.re.source, r.re.flags.replace('g', '')), sev: r.sev === 'block' ? 'crit' : r.sev === 'info' ? 'info' : 'review', t: r.t, rule: r.rule, why: r.why, ok: r.id === 'competence' ? /Board Certified[^.]{0,60}Texas Board of Legal Specialization/i : undefined }));
