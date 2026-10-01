/* SEVERANCE compliance engine (LINT). Starter version: the build 1 rule set moved here from module 11 so the Campaign Desk, the Site
   Forge and Publish can screen copy. The lint agent extends it (more rules, auto corrections, platform limits, Spanish) without changing
   the API documented in docs/ARCHITECTURE.md section 3. */
'use strict';
const SAMPLE_AD = `Texas's #1 Divorce Specialists. We guarantee the best outcome for you and your kids. Texas splits everything 50/50, but our expert attorneys have recovered millions for clients. Mothers get custody in Texas, and your child can choose at 12. Ask about legal separation and our no fee unless we win promise. Child support is capped at $9,200. Call today, divorced in 60 days.`;
const COMP_RULES = [
  { re: /\b(guarantee[sd]?|guaranteed|we promise|assur(e|ed)|will win|win your case|winning is certain|100% success)\b/i, sev: 'crit', t: 'Outcome guarantee', rule: 'Tex. Disciplinary R. Prof. Conduct 7.01(a)', why: 'A guarantee creates an unjustified expectation about results and is a false or misleading communication. State what the firm does, not what the court will do.' },
  { re: /\b(specialist[s]?|specializ(e|es|ed|ing)|expert[s]?|expertise|certified|board[- ]certified)\b/i, sev: 'review', t: 'Special competence claim', rule: 'Rule 7.02(b)', why: 'Only "Board Certified, [area], Texas Board of Legal Specialization" (or an organization accredited by TBLS) may be claimed. "Specialist", "expert" and "certified" without that exact form are prohibited; "practice focused on family law" is fine.', ok: /Board Certified[^.]{0,60}Texas Board of Legal Specialization/i },
  { re: /\b(#1|number one|no\. ?1|the best|best (divorce|family|custody) (lawyer|attorney|firm)s?|top rated|top divorce|premier|leading|most experienced|most trusted|unmatched)\b/i, sev: 'review', t: 'Unverifiable superlative', rule: 'Rule 7.01(a)', why: 'Comparative and superlative claims must be objectively verifiable. "#1", "best" and "premier" are not; a named award with its year and source can be.' },
  { re: /\b(no fee unless|no recovery no fee|contingen(t|cy)|percentage of (the )?(settlement|property|estate)|pay nothing unless)\b/i, sev: 'crit', t: 'Contingent fee in a family matter', rule: 'Rule 1.04(e) and 7.02(c)', why: 'A contingent fee is prohibited in a domestic relations matter when payment depends on securing a divorce or on the amount of support, maintenance or property. Remove the offer; if a contingent fee is ever advertised, the ad must state whether the client pays expenses.' },
  { re: /\b(recovered|won|obtained|secured|awarded)\s+\$?[\d,.]+\s*(million|thousand|k|m)?\b|\$[\d,.]+\s*(million|m)\s+(recovered|won|for our clients)/i, sev: 'review', t: 'Past results', rule: 'Rule 7.01(d) to (f)', why: 'Results must not be misleading. If a verdict was reduced, reversed or settled for less, the amount the client received must appear with equal prominence. In family law, dollar results usually say nothing about the next case; consider removing.' },
  { re: /\b(testimonial|clients? say|five star|5[- ]star|reviews?|rated us|endorse[sd]?)\b/i, sev: 'info', t: 'Testimonials and reviews', rule: 'Rule 7.01(a) and comment', why: 'Testimonials must be truthful and not misleading; a paid or incentivized endorsement must say so. Do not script client statements about outcomes.' },
  { re: /\b(50\s*\/\s*50|fifty[- ]fifty|split (everything )?(down the middle|equally|in half)|equal (split|division) of (property|assets))\b/i, sev: 'crit', t: 'Property myth: 50/50', rule: 'Tex. Fam. Code § 7.001', why: 'Texas divides community property in a manner that is "just and right"; equality is not required and separate property is never divided.' },
  { re: /\blegal(ly)? separat(ion|ed)\b/i, sev: 'crit', t: 'Legal separation', rule: 'Texas has no legal separation', why: 'Texas does not recognize legal separation. Offer the real alternatives: temporary orders, protective orders, a SAPCR, or a partition agreement.' },
  { re: /\b(mothers?|moms?) (always |automatically |usually )?(get|gets|win|receive|are awarded)s? (custody|the kids|the children)|\b(fathers?|dads?) (can't|cannot|never|rarely) (win|get) custody\b/i, sev: 'crit', t: 'Gender preference myth', rule: 'Tex. Fam. Code § 153.003 and Rule 7.01', why: 'Courts may not prefer a parent by sex. The claim is wrong and, as advertising, misleading.' },
  { re: /\b(child(ren)?|kids?) (can |get to |will )?(choose|decide|pick)\b|\bat (age )?12,? (the )?(child|kids?) (can|gets? to)\b/i, sev: 'crit', t: 'Child chooses at 12 myth', rule: 'Tex. Fam. Code § 153.009', why: 'At 12 the judge must interview the child in chambers on request; the preference never controls.' },
  { re: /\b(common[- ]law marri(age|ed)|informal marriage) (after|requires?|takes?|needs?) (\d+|six|two|seven|three) (years?|months?)|\bliving together (for )?(\d+|six|two|seven) years? (makes|means|equals)\b/i, sev: 'crit', t: 'Common law duration myth', rule: 'Tex. Fam. Code § 2.401', why: 'No duration element exists: agreement, cohabitation and holding out, both parties 18 or older.' },
  { re: /\b(no alimony in texas|texas (has|does) no(t have)? alimony|alimony is (standard|automatic|guaranteed))\b/i, sev: 'crit', t: 'Alimony myth', rule: 'Tex. Fam. Code ch. 8', why: 'Spousal maintenance exists, is presumed unwarranted, gated (10 year marriage, family violence, disability) and capped at the lesser of $5,000 a month or 20% of average gross income.' },
  { re: /\$\s?9,?200\b|\$\s?8,?550\b|\$\s?7,?500 (net|cap)/i, sev: 'crit', t: 'Stale child support cap', rule: 'Tex. Fam. Code § 154.125; OAG adjustment eff. Sept. 1, 2025', why: 'The guideline cap is $11,700 in monthly net resources since September 1, 2025 ($2,340 for one child at the cap). $9,200 is stale.' },
  { re: /\b(divorced? (in|takes) (60|sixty) days|60[- ]day divorce|two month divorce)\b/i, sev: 'review', t: 'Sixty days as a promise', rule: 'Tex. Fam. Code § 6.702', why: 'Sixty days is the statutory minimum from filing, not a delivery time. Agreed cases usually take two to four months; contested nine to twenty four.' },
  { re: /\brestraining order[s]?\b/i, sev: 'review', t: 'Restraining order vs protective order', rule: 'Tex. Fam. Code ch. 85', why: 'A temporary restraining order is a civil procedure device; a protective order is the family violence remedy. Say which one you mean; do not conflate them.' },
  { re: /\b(equal time|50\/50 custody|shared parenting is (the law|presumed)|presumption of equal (possession|time))\b/i, sev: 'crit', t: 'Equal time presumption myth', rule: 'SB 849 (2025) failed; § 153.135', why: 'Joint managing conservatorship does not mean equal time and Texas has no equal time presumption. The expanded standard possession order is the default within 50 miles.' },
  { re: /\b(full custody|sole custody|visitation)\b/i, sev: 'info', t: 'Lay terms without the Texas term', rule: 'Terminology', why: 'Use the lay term for search but define the Texas term on the page: sole managing conservatorship, possession and access, the exclusive right to designate the primary residence. "Full custody" has no legal meaning.' },
  { re: /\b(3%|three percent) (interest|on arrears)\b/i, sev: 'crit', t: 'Stale arrears interest', rule: '§ 157.265; HB 4213 (2025) died', why: 'Child support arrears accrue 6% simple interest. The 2025 bill to change the rate did not pass.' },
  { re: /\bground \(?o\)?\b/i, sev: 'crit', t: 'Repealed termination ground', rule: 'HB 116 (2025)', why: 'Ground (O), service plan noncompliance, was repealed effective September 1, 2025, including for pending suits; grounds were re-lettered (A) to (U).' },
  { re: /\banonymous (report|tip|call)s?\b/i, sev: 'review', t: 'Anonymous CPS reports', rule: 'HB 63 (2023), § 261.304', why: 'DFPS has not accepted anonymous reports since September 1, 2023; only a tip made to law enforcement and referred to DFPS gets a preliminary investigation.' },
  { re: /\b(fight(s|ing)? tirelessly|aggressive(ly)? (fight|represent)|pit ?bull|shark|we will destroy|crush|bulldog)\b/i, sev: 'info', t: 'Aggression language', rule: 'Rule 7.01 comment; § 153.002 best interest', why: 'Not a violation by itself, but judges and mediators see the ads too, and "aggressive" copy underperforms "clear" copy for family law leads in most tests. Say what you do.' }
];
const LINT = (() => {
  const SEV = { crit: 'block', review: 'warn', info: 'info' };
  const RULES = COMP_RULES.map((r, i) => Object.assign({ id: 'r' + String(i + 1).padStart(2, '0') }, r, { sev: SEV[r.sev] || r.sev }));
  const DASH = /[‐-―−]|(?<=\w)-(?=\w)|\s-\s/;
  /* house style for outbound copy: no hyphens or dashes; numeric ranges read "2 to 4" */
  function house(s) {
    if (s == null) return s;
    return String(s).replace(/\s*[—–―]\s*/g, ', ').replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 to $2').replace(/(\w)-(\w)/g, '$1 $2').replace(/[‐-―−]/g, ' ').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
  }
  const LIMITS = {
    google: { headline: 30, description: 90, path: 15, sitelink: 25, sitelink_desc: 35, callout: 25, snippet: 25 },
    microsoft: { headline: 30, description: 90, path: 15, sitelink: 25, callout: 25 },
    meta: { primary: 125, headline: 40, description: 30 },
    youtube: { headline: 30, long_headline: 90, description: 90 },
    demandgen: { headline: 40, description: 90, business: 25 },
    tiktok: { text: 100, display_name: 40 },
    linkedin: { intro: 150, headline: 70, description: 100 },
    lsa: { bio: 1000 },
    gbp: { post: 1500 },
    yelp: { headline: 50, body: 500 },
    nextdoor: { headline: 90, body: 400 }
  };
  function screen(text, o) {
    o = o || {}; const t = o.html ? String(text || '').replace(/<[^>]+>/g, ' ') : String(text || ''); const findings = [];
    RULES.forEach(r => { const m = t.match(r.re); if (m && !(r.ok && r.ok.test(t))) findings.push({ id: r.id, sev: r.sev, title: r.t, rule: r.rule, why: r.why, hit: m[0], at: m.index, fix: null }); });
    const ph = t.match(/\[(Firm name|Responsible attorney|Office city|City|County|Phone|Fee|Base)\]/);
    if (ph) findings.push({ id: 'ph', sev: 'block', title: 'Unfilled placeholder', rule: 'Rule 7.01(a)', why: 'The copy still carries a bracketed placeholder. Fill the firm profile (the Firm button) or edit the copy.', hit: ph[0], at: ph.index, fix: null });
    if (o.kind && o.kind !== 'social-reply' && o.footer !== false) { const r = FIRM.responsible(), p = FIRM.primary(); if (!(r.name && t.includes(r.name)) || !(p.city && t.includes(p.city))) findings.push({ id: 'r702a', sev: o.kind === 'page' ? 'block' : 'warn', title: 'Responsible lawyer and primary practice location', rule: 'Rule 7.02(a)', why: 'Every advertisement must publish the name of a lawyer responsible for its content and the lawyer\'s primary practice location. Ad platforms often carry them in an extension or on the landing page; pages must carry both.', hit: '', at: -1, fix: null }); }
    if (o.kind && DASH.test(t)) { const m = t.match(DASH); findings.push({ id: 'house', sev: 'fix', title: 'Hyphen or dash in outbound copy', rule: 'House style', why: 'Copy that leaves the atlas carries no hyphen or dash.', hit: m[0], at: m.index, fix: { from: 'dashes', to: 'house style' } }); }
    const counts = { block: 0, fix: 0, warn: 0, info: 0 }; findings.forEach(f => counts[f.sev] = (counts[f.sev] || 0) + 1);
    return { findings, counts, pass: !counts.block };
  }
  function fix(text, o) { const applied = []; let t = String(text || ''); const h = house(t); if (h !== t) { applied.push({ id: 'house', from: 'dashes', to: 'house style' }); t = h; } t = t.replace(/\$\s?9,?200\b/g, m => { applied.push({ id: 'cap', from: m, to: '$11,700' }); return '$11,700'; }); return { text: t, applied }; }
  function checkAd(ad, o) { const lim = LIMITS[ad.platform] || {}; const out = []; Object.keys(ad.fields || {}).forEach(k => { const base = k.replace(/\d+$/, ''); const max = lim[k] || lim[base]; const v = String(ad.fields[k] || ''); if (max && v.length > max) out.push({ id: 'len_' + k, sev: 'block', title: `${k} is ${v.length} characters`, rule: `${ad.platform} limit ${max}`, why: `The platform rejects ${k} over ${max} characters.`, hit: v, at: 0, fix: null }); }); const r = screen(Object.values(ad.fields || {}).join(' \n'), Object.assign({ kind: 'ad', platform: ad.platform }, o || {})); return out.concat(r.findings); }
  return { RULES, LIMITS, screen, fix, house, checkAd };
})();
