'use strict';
/* Module 11: Compliance Screen. The Thermal Atlas "Emergency Satchel" (module 10) and "Rules and Refrigerants" (module 03), rebuilt on
   the compliance engine (LINT, src/03_lint.js) for a Texas family law firm: single and batch screening (paste, a line of three dashes
   between items, CSV of ads, .txt, .md and .html files, the Campaign Desk's creative, the Site Forge's pages, the firm profile itself),
   findings by severity with the hit marked in context, dispositions and the controls gate, safe fixes with what changed, the report
   exports, the Advertising Review Committee filing log (Rule 7.04) and the register of dated Texas changes that copy must reflect.
   the license battery (the firm roster, the lookup by bar number or name, the null result taxonomy) and the law clock (a chart of the
   monthly divorce filings with the child support cap steps and the dated changes, the calendar, the figures with their status, the
   statutory standards, one CSV), all from LINT.FIGURES, LINT.CALENDAR and LINT.STANDARDS.
   SAMPLE_AD and COMP_RULES live in src/03_lint.js. Storage: sev.comp.text, sev.comp.opts, sev.comp.ctrl, sev.comp.ovr, sev.comp.arc (Publish
   adds rows too and emits BUS 'arc'; the log reloads the store before every change), sev.comp.roster.
   receive(p): {text, label, kind, platform, lang, source} | {items:[...]} | {text, posture:'comp', source:'watch', name} (Competitor
   Watch: "Screen their copy"). The text goes into the screen box, the screen runs and the page scrolls to the findings; in competitor
   posture they read as positioning notes, not findings against a lawyer. */
registerModule({
  key: 'compliance', num: '11', title: 'Compliance Screen', desc: 'Ads, pages, posts and the firm profile screened against Texas Rules 7.01 to 7.06, the family law facts and the ad platform policies, with safe fixes, the filing log and the dated changes register',
  receive(p) { if (this._recv) this._recv(p); else this._pending = p; },
  onShow() { if (this._show) this._show(); },
  mount(root) {
    const self = this;
    const PLAB = LINT.PLATFORMS;
    const KINDS = [['ad', 'Ad'], ['page', 'Web page'], ['social', 'Social post'], ['email', 'Email'], ['sms', 'Text message'], ['gbp', 'Business Profile post'], ['video', 'Video script']];
    const KLAB = Object.fromEntries(KINDS);
    const QS = [['safe', 'Is it safe to run as is?'], ['report', 'Is there a violation worth reporting?'], ['file', 'What belongs in the compliance file?']];
    const DISPS = ['CONFIRMED', 'CANDIDATE', 'CLEARED', 'NOT_OBSERVABLE', 'INTEL'];
    const DCLS = { CONFIRMED: 'c', CANDIDATE: 'k', CLEARED: 'x', NOT_OBSERVABLE: 'n', INTEL: 'i' };
    const DLAB = d => d.replace('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
    const CONTROLS = [
      ['resp', 'The responsible lawyer and primary practice location run in an ad extension, the ad itself or the landing page (Rule 7.02(a))', ['r702a']],
      ['fees', 'Advertised fees and consultation terms match the fee schedule and will be honored while the ad runs (Rule 7.02(d))', ['fee_honor', 'free_consult']],
      ['reviews', 'Ratings and review counts match the live profile, with the source and the date beside them', ['reviews_claim', 'testimonials']],
      ['tbls', 'Each Texas Board of Legal Specialization certificate named is current on the TBLS search', ['certified', 'cert_attrib']],
      ['arc', 'Filed with the Advertising Review Committee or logged as exempt (Rules 7.04 and 7.05)', ['arc_filing']],
      ['targeting', 'Targeting reviewed: keywords and geography only; no remarketing, customer lists or audience segments built on divorce status', ['google_hardship']],
      ['sms', 'Text consent flow reviewed: unchecked box, STOP language, chapter 302 status', ['sms_consent', 'WEB2']],
      ['bar', 'Each bar number in the copy was checked on the State Bar of Texas Find a Lawyer search today: name, number and status match', ['BARNONE', 'BARNAME', 'BAROK']],
      ['tags', 'Tags and pixels are excluded from intake, protective order and CPS pages (a trigger exception in the tag manager)', ['WEB1']],
      ['exit', 'Every protective order and family violence page has a quick exit at the top', ['WEB6']],
      ['office', 'Every office named in the copy is staffed and in the firm profile', ['OFFICE2']],
      ['staff', 'Spanish speaking staff answer the intake line during the advertised hours', ['es_staff']],
      ['avail', 'Stated hours and same day availability are actually staffed', ['availability']],
      ['privacy', 'A privacy notice is linked from every page that loads a tag or pixel', ['web_pixel']]
    ];
    const ROUTES = [
      ['State Bar of Texas, Chief Disciplinary Counsel', 'Grievance (texasbar.com)', 'The ad or page with a date and the URL or ad ID, the lawyer named, the rule and why it applies', 'Classification, then investigation when the grievance alleges misconduct; sanctions run from a private reprimand to disbarment', [/^Texas Rules$/]],
      ['Advertising Review Committee, State Bar of Texas', 'Filing or pre approval (Rule 7.04)', 'A copy of the ad, the application and the fee', 'Reviews filed advertisements; a pre approval filed thirty days ahead is binding if the ad is fairly described', [/^Filing$/]],
      ['Texas Board of Legal Specialization', 'Public certification search (tbls.org)', 'The lawyer\'s name and the claimed area', 'Confirms or refutes a "Board Certified" claim; a false claim then goes to the grievance route', [/^Texas Rules$/]],
      ['Google Ads and Local Services', 'Report a policy violation; Local Services "Report a problem"', 'Ad preview, the query and location, the landing page claim', 'Ad disapproval; repeated misrepresentation can suspend the account', [/^Ad platforms$/]],
      ['Meta', 'Report ad', 'The ad, the page and the claim', 'Ad rejection; advertiser restrictions for repeat violations', [/^Ad platforms$/]],
      ['FTC', 'ReportFraud.ftc.gov', 'Fake or incentivized reviews (16 CFR Part 465)', 'Feeds pattern cases; rarely a response to one report', [/^Consumer law$/, /^Web$/]],
      ['In house', 'The fix list (self audit) or the competitive picture (competitor)', 'The finding, its disposition and the open question', 'Most findings go nowhere outside the firm; they are fixes or intelligence', [/./]]
    ];
    const OPT0 = { posture: 'self', target: '', domain: '', q: 'safe', kind: 'ad', plat: '', lang: 'auto', sol: false, home: false };
    const st = Object.assign({}, OPT0, store.get('sev.comp.opts', {}) || {});
    let ITEMS = [], SEL = null, SCOPE = 'item', FSEV = '', FFAM = '', FDISP = '', LAST = { src: '', label: '' }, SRCV = 'paste';
    let CTRL = store.get('sev.comp.ctrl', {}) || {}; let OVR = store.get('sev.comp.ovr', {}) || {};
    let ARC = store.get('sev.comp.arc', []); if (!Array.isArray(ARC)) ARC = []; let ARC_EDIT = null;
    const SAMPLE_ES = 'Los mejores abogados de divorcio de Texas. Somos especialistas en custodia y le garantizamos el mejor resultado. No cobramos si no ganamos. ¿Se está divorciando? La manutención tiene un tope de $9,200. Llame hoy.';
    const SAMPLE_PAGE = `<!doctype html><html><head><title>Statewide Divorce Help Center | #1 Family Law Firm</title>
<meta name="description" content="Top rated divorce specialists. Free consultation, 5 star rated.">
<script src="https://connect.facebook.net/en_US/fbevents.js"></script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LegalService","name":"Statewide Divorce Help Center","aggregateRating":{"@type":"AggregateRating","ratingValue":"5","reviewCount":"50"}}</script></head>
<body><h1>Your divorce, handled by the best divorce lawyers in Texas</h1>
<p>We guarantee you keep the house. Texas is a 50/50 state, and mothers always get custody.</p>
<p>Board Certified family law attorneys. Child support is capped at $9,200 and arrears carry 3% interest.</p>
<p>To get a protective order you must prove family violence is likely to occur again.</p>
<p>Only 3 consultations left this week. Act now!</p>
<form><label>Name <input name="name"></label><label>Phone <input type="tel" name="phone"></label><label><input type="checkbox" name="sms" checked> Text me updates</label><button>Send</button></form>
</body></html>`;
    const SAMPLE_BATCH = `## Google ad · custody\nCustody lawyer in Collin County\nConservatorship, possession and child support explained.\n---\n## Meta ad\nAre you getting divorced? Our expert attorneys fight for you.\n---\n## Social post\nTexas does not recognize legal separation. Temporary orders, a SAPCR or a partition agreement may fit instead.\n---\n## Email · homepage announcement\nThe expanded standard possession order is new for 2025. Call [Firm name] at 972-555-0100.`;

    const firmName = () => { try { return FIRM.get().name || ''; } catch (e) { return ''; } };
    const cpSev = s => pill(LINT.SEV_LABEL[s] || s, 'p-' + s);   // severity in words (Blocks, Fix, Review, Info), never by color alone
    const segL = (id, label, opts, cur) => `<div class="ctl"><span class="lbl" id="${id}L">${esc(label)}</span>${segHTML(id, opts, cur).replace('role="group"', `role="group" aria-labelledby="${id}L"`)}</div>`;
    /* the user's own copy is kept under sev.comp.text; a sample or a hand over from another module never overwrites it, and "Back to my
       copy" brings it back */
    const SAMPLES = new Set([SAMPLE_AD, SAMPLE_ES, SAMPLE_PAGE, SAMPLE_BATCH].concat(LINT.CHANGES.map(c => c.sample).filter(Boolean)));
    let HANDED = '';   // the text another module last handed over (not the user's draft either)
    const isSample = t => SAMPLES.has(t) || (!!HANDED && t === HANDED);
    const draft = () => { const d = store.get('sev.comp.text', ''); return typeof d === 'string' ? d : ''; };
    const keepDraft = t => { if (t && t.trim() && !isSample(t)) store.set('sev.comp.text', t); };
    root.innerHTML = mastHTML({ eyebrow: 'Module 11 · Compliance Screen · Texas Disciplinary Rules of Professional Conduct, Part VII (eff. July 1, 2021), the family law facts and the platform policies', title: 'Compliance Screen',
      dek: `Paste an ad, a landing page, a social post or a batch of them; upload a CSV of ads or .txt and .html files; or pull every ad the Campaign Desk wrote, every page the Site Forge built and the firm profile itself. Each item is read against the Texas advertising rules (false or misleading statements, trade names, special competence, contingent fees in family matters, past results, the responsible lawyer and primary practice location, solicitation labels, the ten day filing requirement), against the family law facts ads get wrong or that went stale, against the Google and Meta policies that decide whether a campaign runs at all, and against each platform's character limits. It flags, cites the rule and says why. Where a correction is safe and deterministic (a stale number, a banned word with a neutral replacement, the house style) it shows the corrected copy and exactly what changed; it never rewrites a guarantee, a myth or a result.`,
      facts: [[String(LINT.RULES.length), 'rules with stable ids, English and Spanish'], ['10 days', 'to file a non exempt ad with the Advertising Review Committee (Rule 7.04)'], ['$11,700', 'current child support cap; the most common stale number'], ['7.02(a)', 'name of a responsible lawyer and primary practice location']] }) +
      toolbarHTML('Compliance Screen', 'Screen, fix, file', [{ id: 'cpRunTop', label: 'Screen', primary: true }, { id: 'cpFixAll', label: 'Apply safe fixes' }, { id: 'cpCsv', label: '↓ Findings CSV' }, { id: 'cpMd', label: '↓ Report (Markdown)' }, { id: 'cpBook', label: '↓ Rule book CSV' }]) +
      callout('note', 'Read this first', `<p><b>What it does.</b> Screens copy against ${LINT.RULES.length} rules, each with a stable id, a severity (Blocks, Fix, Review, Info), the rule cited with a link to its source, and why it matters. Blocks mean the copy does not pass and must not run; the Campaign Desk, the Site Forge and Publish use the same engine and hold back anything that does not pass. Rules that need the firm (the responsible lawyer and city, Board certifications, advertised fees, ratings, Spanish speaking staff) read the firm profile, so fill it first (the Firm button). <b>What it does not do.</b> It is a screen, not a lawyer: it reads patterns and the context it knows, files nothing, contacts no platform and fetches nothing. Everything stays in this browser.</p>`) +
      callout('judg', 'Judgment call: a screen, not a lawyer', `<p>Pattern matching catches the phrases that get firms grievances and the facts that went stale in September 2025. It reads context where it can: "the best interest of the child" is a statute, not a superlative; "Board Certified, Family Law, Texas Board of Legal Specialization" passes when a lawyer in the firm profile holds it; a sentence saying Texas has no legal separation is not the myth. It will not know every case. Treat a flag as a reason to look, and file what needs filing. In competitor posture the same findings become intelligence: the duty to report another lawyer covers violations that raise a substantial question about honesty, trustworthiness or fitness, not every advertising flag, and a grievance attaches to a named lawyer. File the few that clear that bar; keep the rest in house.</p>`) +
      `<div class="grid2">
        <div class="panel" id="cpSrcP"><h3>Copy to screen</h3><div class="sub">One item, or many separated by a line of three dashes (start an item with "## label" to name it; a label that names a platform, "page", "email" or "Spanish" sets those too). HTML is detected and stripped; scripts and styles are skipped.</div>
          ${segHTML('cpSrc', [['paste', 'Paste'], ['files', 'Upload files'], ['desk', 'Campaign Desk feed'], ['forge', 'Site Forge feed'], ['firm', 'Firm profile']], 'paste').replace('role="group"', 'role="group" aria-label="Source of the copy"')}
          <div id="cpPaste" style="margin-top:10px"><div class="ctl wide"><label for="cpText">Copy, HTML, or a batch</label><textarea class="copy" id="cpText" spellcheck="false">${esc(draft() || SAMPLE_AD)}</textarea></div>
            <div class="formgrid" style="margin-top:8px">${fieldHTML({ k: 'label', id: 'cpLabel', l: 'Label (single item)', ph: 'Google ad, custody, Collin County' }, '')}</div>
            <div class="btnrow"><button type="button" class="btn primary" id="cpRun">Screen this copy</button><button type="button" class="btn" id="cpSample">Sample ad</button><button type="button" class="btn" id="cpSampleEs">Sample Spanish ad</button><button type="button" class="btn" id="cpSamplePage">Sample page (fictional)</button><button type="button" class="btn" id="cpSampleBatch">Sample batch</button><button type="button" class="btn" id="cpClear">Clear</button><button type="button" class="btn accent" id="cpRestore" hidden>Back to my copy</button></div><div class="small" id="cpDraftNote"></div></div>
          <div id="cpFiles" hidden style="margin-top:10px"><div class="dropzone" id="cpDrop">Drop files here: a CSV or TSV of ads (one row per ad, columns such as Platform, Headline 1, Description 1, Primary text, Title), .txt or .md copy (a line of three dashes between items), .html pages, or a JSON list of {label, text, platform}.</div><div class="btnrow"><button type="button" class="btn" id="cpPick">Choose files</button><button type="button" class="btn" id="cpCsvTpl">↓ CSV template</button></div></div>
          <div class="small" id="cpNote" role="status" aria-live="polite" style="margin-top:6px"></div>
        </div>
        <div class="panel" id="cpOptP"><h3>Posture, scope and the question</h3><div class="sub">Pin these before a run. Posture decides the deliverable: a self audit writes fixes and applies the house style; competitor posture writes routes and leaves our firm profile out of it.</div>
          <div style="margin-bottom:10px">${segL('cpPos', 'Posture', [['self', 'Self audit'], ['comp', 'Competitor']], st.posture)}</div>
          <div class="formgrid">
            ${fieldHTML({ k: 'target', id: 'cpTarget', l: 'Whose copy', ph: firmName() || 'Firm or competitor name' }, st.target)}
            ${fieldHTML({ k: 'domain', id: 'cpDomain', l: 'Domain', ph: 'example.com' }, st.domain)}
            ${fieldHTML({ k: 'q', id: 'cpQ', l: 'The question', t: 'select', opts: QS }, st.q)}
            ${fieldHTML({ k: 'kind', id: 'cpKind', l: 'Type of copy (unless an item says)', t: 'select', opts: KINDS }, st.kind)}
            ${fieldHTML({ k: 'plat', id: 'cpPlat', l: 'Platform (unless an item says)', t: 'select', opts: [['', 'Not set (every platform rule)']].concat(Object.keys(PLAB).map(k => [k, PLAB[k]])) }, st.plat)}
          </div>
          <div style="margin-bottom:10px">${segL('cpLang', 'Language', [['auto', 'Detect'], ['en', 'English'], ['es', 'Spanish']], st.lang)}</div>
          <div class="btnrow" style="flex-direction:column;align-items:flex-start"><label class="chk"><input type="checkbox" id="cpSol"${st.sol ? ' checked' : ''}> A solicitation sent to specific people known to need a lawyer (Rule 7.03)</label><label class="chk"><input type="checkbox" id="cpHome"${st.home ? ' checked' : ''}> Pages are the homepage (Rule 7.05 exempts other pages from filing)</label></div>
        </div>
      </div>
      <div class="tiles" id="cpTiles"></div>
      <div class="panel" id="cpItemsP" style="margin-bottom:14px"><h3>Items</h3><div class="sub" id="cpItemsSub">Pass means no open block. Click an item for its findings and its corrected copy.</div><div id="cpItems"></div></div>
      <div class="grid2">
        <div class="panel" id="cpFindP"><h3 id="cpFindH">Findings</h3><div class="callout judg" id="cpCompNote" hidden><div class="h">Competitor posture: positioning notes</div><p>These notes say where a competitor's copy sits against the Texas rules, the family law facts and the platform policies, and so where your own copy can stand apart. They are not findings against a lawyer: the copy may be filed, approved, out of date or carried elsewhere (an extension, a landing page). Our firm profile and house style are left out.</p></div><div class="sub" id="cpFindSub"></div>
          <div class="controls">${segL('cpScope', 'Scope', [['item', 'This item'], ['all', 'All items']], 'item')}${segL('cpSev', 'Severity', [['', 'All'], ['block', 'Blocks'], ['fix', 'Fix'], ['warn', 'Review'], ['info', 'Info']], '')}${fieldHTML({ k: 'fam', id: 'cpFam', l: 'Family', t: 'select', opts: [['', 'All']] }, '')}${fieldHTML({ k: 'disp', id: 'cpDisp', l: 'Disposition', t: 'select', opts: [['', 'All']].concat(DISPS.map(d => [d, DLAB(d)])) }, '')}</div>
          <div id="cpMarkedW"><div class="minihd">The copy with every hit marked</div><div class="small cp-legend">Marks by severity, each named on hover and for screen readers: <mark class="m-block">Blocks</mark> double underline, <mark class="m-fix">Fix</mark> dotted, <mark class="m-warn">Review</mark> dashed, <mark class="m-info">Info</mark> thin.</div><div class="cp-marked" id="cpMarked"></div></div>
          <div id="cpFind"></div></div>
        <div class="panel" id="cpFixP"><h3>Safe fixes</h3><div class="sub">Deterministic corrections only: stale numbers ($9,200 to $11,700, 3% to 6%), banned phrasing with a neutral replacement ("specialist" to "practice focused on", "#1" removed), the TBLS form completed from the firm profile, the ADVERTISEMENT label on a solicitation, the responsible lawyer footer on a page, and the house style. Guarantees, myths and results are flagged for a person, never rewritten.</div>
          <div class="btnrow"><button type="button" class="btn primary" id="cpFixOne">Apply safe fixes to this item</button><button type="button" class="btn" id="cpFixUse" disabled>Use the corrected copy</button><button type="button" class="btn" id="cpFixCopy" disabled>Copy</button><button type="button" class="btn" id="cpFixDl" disabled>↓ Corrected copy</button></div>
          <div id="cpFixOut"><p class="small">Press "Apply safe fixes" to see the corrected copy and what changed.</p></div></div>
      </div>
      <div class="grid2">
        <div class="panel" id="cpCtrlP"><h3>The controls gate</h3><div class="sub">Every finding carries a disposition: Confirmed (a block on a rule cited from its primary text), Candidate (an open question), Cleared, Not observable (a checklist item the copy cannot show), Intel. Tick a control that is in place and the candidates and notes it answers move to Cleared with the control named. Confirmed findings move only by hand, in the finding's detail.</div><div id="cpCtrl" class="cp-ctrl"></div></div>
        <div class="panel" id="cpRouteP"><h3>Routing: where a finding goes</h3><div class="sub">Most findings route nowhere: they are fixes (self audit) or the competitive picture (competitor). Rows with findings in this run are marked.</div><div id="cpRoute"></div></div>
      </div>
      <div class="panel" id="cpArcP" style="margin-bottom:14px"><h3>Advertising Review Committee filing log</h3><div class="sub">Rule 7.04: a non exempt advertisement or solicitation is filed with the Advertising Review Committee, State Bar of Texas, within ${LINT.FILING.days} days of first dissemination (pre approval is available ${LINT.FILING.preapproval} days ahead). Rule 7.05 exempts: ${esc(LINT.FILING.exempt.map(x => x[0].toLowerCase() + x.slice(1)).join('; '))}. Saved in this browser.</div>
        <div class="tiles" id="cpArcTiles"></div>
        <div class="formgrid" id="cpArcForm">
          ${fieldHTML({ k: 'what', id: 'cpArcWhat', l: 'What (the ad, page or mailing)', ph: 'Google ad, custody, Collin County' }, '')}
          ${fieldHTML({ k: 'where', id: 'cpArcWhere', l: 'Where it ran', t: 'select', opts: [['', 'Choose']].concat(['Google Ads', 'Microsoft Ads', 'Meta (Facebook and Instagram)', 'YouTube', 'TikTok', 'LinkedIn', 'Local Services Ads', 'Google Business Profile', 'Website homepage', 'Website page (exempt)', 'Email', 'Text message', 'Direct mail solicitation', 'Television', 'Radio', 'Billboard', 'Print', 'Other'].map(x => [x, x])) }, '')}
          ${fieldHTML({ k: 'pub', id: 'cpArcPub', l: 'Date first published', t: 'date' }, '')}
          ${fieldHTML({ k: 'filed', id: 'cpArcFiled', l: 'Date filed', t: 'date' }, '')}
          ${fieldHTML({ k: 'no', id: 'cpArcNo', l: 'ARC number' }, '')}
          ${fieldHTML({ k: 'status', id: 'cpArcStatus', l: 'Status', t: 'select', opts: ['Not filed', 'Filed', 'Pre approval requested', 'Approved', 'Needs changes', 'Exempt (Rule 7.05)', 'Withdrawn'].map(x => [x, x]) }, 'Not filed')}
          ${fieldHTML({ k: 'note', id: 'cpArcNote', l: 'Note', wide: true }, '')}
        </div>
        <div class="btnrow"><button type="button" class="btn primary" id="cpArcSave">Add to the log</button><button type="button" class="btn" id="cpArcCancel" hidden>Cancel the edit</button><button type="button" class="btn" id="cpArcFromItem">Fill from the selected item</button><button type="button" class="btn" id="cpArcCsv">↓ Filing log CSV</button><button type="button" class="btn" id="cpArcImp">↑ Import CSV</button><span class="small" id="cpArcMsg" role="status"></span></div>
        <div id="cpArcT"></div></div>
      <div class="panel" id="cpClockP" style="margin-bottom:14px"><h3>The law clock: dated changes, live and stale figures, the standards</h3><div class="sub">From the July 1, 2021 advertising rules to the next scheduled child support cap adjustment on September 1, 2031: what changed and when, which figures are live, stale, dead or vetoed, and the statutory standards pages lean on. Built from facts already in Severance (the rule reasons, module 06's angles and authorities) and a few checked by web search for this build, each marked. The stale number rules above read this figures table, so there is one source.</div>
        <div id="cpClockC" class="chart cp-clock" aria-label="Monthly divorce petitions in Texas with the child support cap and the dated changes"></div><div class="small cp-clockleg" id="cpClockLeg"></div><p class="small" id="cpClockN"></p>
        <div class="controls">${segL('cpClockTab', 'Table', [['cal', 'Calendar'], ['fig', 'Figures'], ['std', 'Standards']], 'cal')}<div class="btnrow" style="margin:0;align-self:flex-end"><button type="button" class="btn" id="cpClockCsv">↓ Law clock CSV</button></div></div>
        <div id="cpClockT"></div></div>
      <div class="panel" id="cpRegP" style="margin-bottom:14px"><h3>Texas family law changes that copy must reflect</h3><div class="sub">The dated rule and statute changes behind the stale facts this screen catches, built only from facts already in Severance (the rule reasons above, module 06's angles and authorities, module 20's sources). Each row says what changed, what copy to fix and which rule catches it; "Try it" screens a sentence written the stale way.</div>
        <div class="btnrow"><button type="button" class="btn" id="cpRegCsv">↓ Changes register CSV</button></div><div id="cpReg"></div></div>
      <div class="panel" id="cpBookP" style="margin-bottom:14px"><h3>The rule book</h3><div class="sub">Every rule the screen applies, with its id, severity, citation and whether a safe fix exists. "Cited from the primary text" marks rules whose text Severance cites from the rules or the Family Code; "verify the live text" marks platform policies and secondary sources: fetch the live text before a finding on one goes outside the firm.</div>
        <div class="controls">${fieldHTML({ k: 'bfam', id: 'cpBookFam', l: 'Family', t: 'select', opts: [['', 'All']].concat([...new Set(LINT.RULES.map(r => r.fam))].map(f => [f, f])) }, '')}${fieldHTML({ k: 'bq', id: 'cpBookQ', l: 'Search', ph: 'id, word or rule' }, '')}</div><div id="cpBookT"></div></div>
      <div class="grid2">
        <div class="panel"><h3>The rules in one screen</h3><div class="prose" style="font-size:13.5px">
          <p><b>7.01 Communications.</b> No false or misleading communication about a lawyer's qualifications or services, and nothing likely to create an unjustified expectation about results. Trade names are allowed if not misleading; a name may not imply a connection with a government agency or a legal services organization, and a firm may not imply partners or associates it does not have. A verdict later reduced or reversed must be advertised with the amount the client actually received, with equal or greater prominence.</p>
          <p><b>7.02 Advertisements.</b> (a) Publish the name of a lawyer responsible for the content and the lawyer's primary practice location. (b) No claim of special competence except "Board Certified, [area], Texas Board of Legal Specialization" or a TBLS accredited organization's certification. (c) A contingent fee ad must say whether the client pays court costs and other expenses. (d) An advertised fee must be honored while the ad runs.</p>
          <p><b>7.03 Solicitation.</b> No in person, telephone, social media or electronic solicitation of a non client for pecuniary gain except to lawyers, family, prior clients and experienced users. A solicitation communication must be plainly marked "ADVERTISEMENT" and must not resemble a legal pleading. No payment to non lawyers for referrals beyond nominal gifts.</p>
          <p><b>7.04 Filing.</b> Within ten days of first dissemination, file a copy, the application and the fee with the Advertising Review Committee, State Bar of Texas, unless exempt. Pre approval is available thirty days ahead and is binding if the ad is fairly described. The filing log above keeps the dates.</p>
          <p><b>7.05 Exempt from filing.</b> Website content other than the homepage; law lists; announcement and business cards; newsletters to clients; informational or educational social media that does not offer services; sponsorship acknowledgments; basic information (name, address, practice areas, admissions, education, languages, TBLS certifications, fees for initial consultation).</p>
          <p><b>7.06 Prohibited employment.</b> A lawyer may not accept a matter procured by conduct that violates 7.01 to 7.03, personally or through the firm. The screen adds this reminder whenever a 7.01 to 7.03 finding blocks.</p>
          <p><b>1.04(e).</b> No contingent fee in a domestic relations matter contingent on securing a divorce or on the amount of support, maintenance or property.</p></div></div>
        <div class="panel"><h3>Platform policies that decide whether the campaign runs</h3><div class="prose" style="font-size:13.5px">
          <p><b>Google Ads.</b> Search ads on family law keywords are allowed. The personalized advertising policy lists "personal hardships", including relationship, marital or family difficulties, as a sensitive interest category: no audience segments, remarketing lists or customer match lists built on divorce status, and no ad copy that implies knowledge of the reader's situation ("going through a divorce?" targeted by list). Keyword targeting and the ZIP lists in modules 07 and 10 are geographic, not personal, and comply. Headlines carry no exclamation mark and no words in capitals that are not acronyms; phone numbers go in call assets. Local Services Ads run for family law with Google Screened verification (bar license, background check).</p>
          <p><b>Meta.</b> Detailed targeting on relationship status and most family attributes was retired; build audiences on geography, age and broad interests, and never upload lists of people believed to be divorcing. Ads asserting or implying personal attributes ("Are you getting divorced?", "Your divorce", "¿Se está divorciando?") violate the personal attributes policy and block here when the platform is Meta; write to the situation in the third person ("Divorce with children in Harris County").</p>
          <p><b>Character limits.</b> Google and Microsoft headlines 30, descriptions 90, paths 15; Demand Gen headlines 40; TikTok ad text 100; Business Profile posts 1,500. Meta primary text past 125, headlines past 40 and LinkedIn intro text past 150 are truncated, so they are a review, not a block. A responsive search ad takes 3 to 15 headlines and 2 to 4 descriptions.</p>
          <p><b>Both.</b> Landing pages must show the firm's physical address and the responsible lawyer; a page that promises a result or a price the firm will not honor is disapproved by the platform before the bar ever sees it.</p>
          <p><b>Content facts (module 06 and the changes register above).</b> Cap $11,700 net since September 1, 2025; 60 day floor; ESPO default within 50 miles since 2021; no legal separation; just and right division; no sex preference; child interview at 12 without control; protective order on proof violence occurred (2023), durations tied to the divorce or SAPCR (2025); ground (O) repealed (2025); arrears at 6% simple interest; Prop 15 parental rights amendment adopted November 2025 with its effect not yet settled by the Supreme Court of Texas as of June 2026.</p></div></div>
      </div>
      <div class="panel" id="cpRosterP" style="margin-bottom:14px"><h3>License battery: the firm roster and the State Bar lookup</h3><div class="sub">Every 8 digit Texas bar number in copy screened here, in the Campaign Desk and in the Site Forge is checked against this roster: BAROK (matches an active lawyer), BARINACT (the roster shows the lawyer inactive or not eligible: blocks), BARNONE (not in the roster, not observable here), BARNAME (name and number do not match) and TBLSNO (a Board certification the roster does not list for the lawyer named). The roster starts from the firm profile; paste or upload the firm's own list with each lawyer's status and the date it was checked. Severance fetches nothing: a number the roster does not hold goes to the State Bar of Texas Find a Lawyer search. Saved in this browser.</div>
        <div class="tiles" id="cpRosTiles"></div>
        <div id="cpRosT"></div>
        <div class="btnrow"><button type="button" class="btn" id="cpRosEdit">Edit as text</button><button type="button" class="btn" id="cpRosImp">↑ Import CSV</button><button type="button" class="btn" id="cpRosCsv">↓ Roster CSV</button><button type="button" class="btn" id="cpRosSeed">Start again from the firm profile</button><span class="small" id="cpRosMsg" role="status" aria-live="polite"></span></div>
        <div id="cpRosEd" hidden><div class="ctl wide"><label for="cpRosText">Roster: one lawyer per line, comma separated: name, bar number, status, eligible to practice, TBLS area, office city, as of date (a header row is optional)</label><textarea class="copy cp-roster" id="cpRosText" spellcheck="false"></textarea></div><div class="btnrow"><button type="button" class="btn primary" id="cpRosSave">Save the roster</button><button type="button" class="btn" id="cpRosCancel">Cancel</button></div></div>
        <div class="grid2" style="margin-top:12px">
          <div><div class="minihd">Look up a lawyer</div><div class="cp-lq"><div class="ctl wide"><label for="cpLQ">Bar number or name</label><input type="search" id="cpLQ" placeholder="24000000 or Jane Doe" autocomplete="off"></div><button type="button" class="btn" id="cpLGo">Search the roster</button></div><div id="cpLRes" class="cp-lres" role="status" aria-live="polite"><p class="small">The lookup reads the roster above only. For anyone else, use the State Bar search.</p></div>
            <div class="btnrow" style="margin-top:10px"><a class="btn sm" href="${esc(LINT.SOURCES.findlawyer.url)}" target="_blank" rel="noopener">State Bar of Texas, Find a Lawyer</a><a class="btn sm" href="https://www.tbls.org/" target="_blank" rel="noopener">TBLS certification search</a><a class="btn sm" href="https://adstransparency.google.com/" target="_blank" rel="noopener">Google Ads Transparency Center</a><a class="btn sm" href="https://www.facebook.com/ads/library/" target="_blank" rel="noopener">Meta Ad Library</a></div></div>
          <div><div class="minihd">A blank lookup is never a finding by itself: the null result taxonomy</div>
          <ol class="steps cp-tax">
            <li><b>Not tested.</b> The search was not run, or the site could not be reached. Record it as not tested, never as clean.</li>
            <li><b>Spelled differently.</b> Search maiden and married names, middle names and initials; the bar lists the lawyer's licensed name, not the brand.</li>
            <li><b>Licenses belong to lawyers, not firms.</b> A firm name returns nothing; search each lawyer named. Names are matched here with law, firm, PLLC, PC, LLP, attorney, legal, family and divorce set aside.</li>
            <li><b>Inactive status.</b> A license can be inactive, suspended or held in another state; read the status and the jurisdiction before calling it unlicensed.</li>
            <li><b>Registry lag.</b> New admissions, status changes and new certifications can take time to appear. Check the live search on the day and record the date.</li>
            <li><b>Not eligible to practice.</b> Only after the five above are excluded, and only with a dated screenshot of the live search.</li></ol></div>
        </div></div>
      <div class="panel" style="margin-bottom:14px"><h3>How the screen is built</h3><div class="prose" style="font-size:13.5px"><ul>
          <li><b>Severity and pass.</b> Blocks fail the copy; Fix means a safe correction exists; Review is a question for a person; Info is a reminder. Pass means no open block, the same test the Campaign Desk, the Site Forge and Publish apply.</li>
          <li><b>Context.</b> Negations and myth framing clear a hit ("Texas has no legal separation"); history clears a stale number ("the cap rose from $9,200"); "best interest" and expert witnesses are never flagged; a TBLS claim is checked against the lawyers in the firm profile and the roster.</li>
          <li><b>One source for the numbers.</b> The stale number rules read the figures table in the law clock above: change a figure there and the rule, its safe fix and its reason follow.</li>
          <li><b>Web tests.</b> Pasted or uploaded HTML is read as source too: tags and pixels on intake, protective order and CPS pages (WEB1), checked consent boxes (WEB2), self served ratings in the schema (WEB3), the responsible lawyer and office city anywhere in the source (WEBRESP), the form notice (WEB5) and the quick exit on protective order pages (WEB6).</li>
          <li><b>Posture.</b> A self audit compares the copy with the firm profile and applies the house style. Competitor posture leaves the profile and the house style out: style is not a violation, and our fees are not theirs.</li>
          <li><b>Positions.</b> Every hit carries its position; for HTML, the position in the source and the line, so a developer can find it.</li>
          <li><b>What it does not do.</b> It fetches nothing and files nothing. It cannot see ad extensions, landing pages it was not given, mail envelopes or intake calls; those are checklist rows marked Not observable.</li></ul></div></div>
      <div class="panel" style="margin-bottom:14px"><h3>Sources</h3><div class="sub">Every rule in the book links to one of these.</div><ul class="srcs" id="cpSrcList"></ul></div>`;

    /* ---------- options ---------- */
    const saveOpts = () => store.set('sev.comp.opts', st);
    const rerun = () => { ITEMS.forEach(screenItem); render(); };
    wireSeg($('#cpPos', root), v => { st.posture = v; saveOpts(); rerun(); });
    wireSeg($('#cpLang', root), v => { st.lang = v; saveOpts(); rerun(); });
    $('#cpTarget', root).onchange = e => { st.target = e.target.value.trim(); saveOpts(); render(); };
    $('#cpDomain', root).onchange = e => { st.domain = e.target.value.trim(); saveOpts(); };
    $('#cpQ', root).onchange = e => { st.q = e.target.value; saveOpts(); render(); };
    $('#cpKind', root).onchange = e => { st.kind = e.target.value; saveOpts(); rerun(); };
    $('#cpPlat', root).onchange = e => { st.plat = e.target.value; saveOpts(); rerun(); };
    $('#cpSol', root).onchange = e => { st.sol = e.target.checked; saveOpts(); rerun(); };
    $('#cpHome', root).onchange = e => { st.home = e.target.checked; saveOpts(); rerun(); };

    /* ---------- screening ---------- */
    function optsFor(it) { return { kind: it.kind || st.kind, platform: it.plat || st.plat || '', lang: it.lang || (st.lang === 'auto' ? undefined : st.lang), html: it.html === true ? true : it.html === false ? false : undefined, solicitation: st.sol, homepage: it.home != null ? it.home : st.home, posture: st.posture, footer: it.footer, house: it.house, sensitive: it.sensitive }; }
    function screenItem(it) {
      const o = optsFor(it);
      try { it.res = it.fields ? LINT.screenAd({ platform: o.platform, fields: it.fields }, o) : LINT.screen(it.text, o); }
      catch (e) { console.error(e); it.res = { findings: [{ id: 'engine', sev: 'warn', title: 'The screen failed on this item', rule: 'Compliance engine', why: e.message, hit: '', at: -1, fix: null, fam: 'Engine', n: 1, hits: [], v: '◐', url: '', obs: true }], counts: { block: 0, fix: 0, warn: 1, info: 0 }, pass: true, text: it.text || '' }; }
      it.fixed = null; return it;
    }
    function mkItems(list) { const seen = {}; return list.map((x, i) => { let label = String(x.label || ('Item ' + (i + 1))).trim(); if (seen[label]) { seen[label]++; label += ' (' + seen[label] + ')'; } else seen[label] = 1; return { id: 'cpi' + i, label, text: x.text != null ? String(x.text) : x.fields ? Object.values(x.fields).join('\n') : '', fields: x.fields && Object.keys(x.fields).length ? x.fields : null, kind: x.kind || '', plat: LINT.normPlat(x.platform || x.plat || ''), lang: x.lang === 'es' || x.lang === 'en' ? x.lang : '', html: x.html === true ? true : undefined, home: x.homepage != null ? !!x.homepage : x.home != null ? !!x.home : undefined, footer: x.footer, house: x.house, src: x.src || '', sensitive: x.sensitive === 'po' || x.sensitive === 'cps' || x.sensitive === false ? x.sensitive : undefined }; }); }
    function runItems(list, src, label) {
      if (!list.length) { note(`${src}: nothing to screen.`); return; }
      ITEMS = mkItems(list).map(screenItem); SEL = ITEMS[0].id; LAST = { src, label }; FSEV = ''; FFAM = ''; FDISP = '';
      $$('#cpSev button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === ''))); $('#cpDisp', root).value = '';
      SCOPE = ITEMS.length > 1 ? 'all' : 'item'; $$('#cpScope button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === SCOPE)));
      render(); note(`${src}: ${label}. ${ITEMS.length} item${ITEMS.length === 1 ? '' : 's'} screened, ${ITEMS.filter(it => status(it) === 'pass').length} pass.`);
    }
    const note = msg => { $('#cpNote', root).textContent = msg; };
    function runPaste() {
      const raw = $('#cpText', root).value; keepDraft(raw); draftUI();
      if (!raw.trim()) { note('Nothing pasted.'); ITEMS = []; SEL = null; render(); return; }
      const parts = LINT.splitBatch(raw);
      if (parts.length > 1) { runItems(parts, 'Pasted batch', `${parts.length} items`); return; }
      const isHtml = LINT.looksHTML(raw); const p = parts[0] || { text: raw };
      runItems([Object.assign({}, p, { label: $('#cpLabel', root).value.trim() || (p.label && !/^Item \d+$/.test(p.label) ? p.label : isHtml ? 'Pasted page' : 'Pasted copy'), html: isHtml || undefined, kind: p.kind || (isHtml ? 'page' : '') })], isHtml ? 'Pasted HTML' : 'Pasted copy', $('#cpLabel', root).value.trim() || 'one item');
    }

    /* dispositions: the Satchel's five, the controls gate and moves by hand */
    const okey = (it, f) => it.label + '|' + f.id;
    function disp(it, f) {
      if (OVR[okey(it, f)]) return { s: OVR[okey(it, f)], moved: 'Moved by hand' };
      let s = f.obs === false ? 'NOT_OBSERVABLE' : f.sev === 'info' ? 'INTEL' : (f.sev === 'block' && f.v === '✔') ? 'CONFIRMED' : 'CANDIDATE';
      if (s !== 'CONFIRMED') for (const [cid, label, ids] of CONTROLS) if (CTRL[cid] && ids.includes(f.id)) return { s: 'CLEARED', moved: 'Cleared by the control: ' + label };
      return { s, moved: '' };
    }
    const openBlocks = it => it.res.findings.filter(f => f.sev === 'block' && disp(it, f).s !== 'CLEARED');
    const status = it => openBlocks(it).length ? 'needs review' : 'pass';
    const COMP = () => st.posture === 'comp';
    const statusPill = it => status(it) === 'pass' ? pill(COMP() ? 'No flags' : 'Pass', 'p-ok') : pill(COMP() ? 'Flagged' : 'Needs review', 'p-block');
    const curItem = () => ITEMS.find(x => x.id === SEL) || ITEMS[0] || null;
    function answer() {
      if (!ITEMS.length) return 'n/a';
      const all = []; ITEMS.forEach(it => it.res.findings.forEach(f => all.push(disp(it, f).s)));
      const c = all.filter(s => s === 'CONFIRMED').length, k = all.filter(s => s === 'CANDIDATE').length;
      if (st.q === 'safe') return c ? 'Not yet' : k ? 'With fixes' : 'Yes';
      if (st.q === 'report') return c ? `${c} to weigh` : 'Nothing';
      return `${c + k} items`;
    }
    function routeFor(f) { const r = ROUTES.find(x => x[4].some(re => re.test(f.fam || ''))); return r ? `${r[0]}: ${r[1]}. Needs: ${r[2]}.` : 'In house.'; }

    /* ---------- render ---------- */
    function render() { renderTiles(); renderItems(); renderFindings(); renderFix(); renderRoute(); }
    function renderTiles() {
      const n = ITEMS.length, pass = ITEMS.filter(it => status(it) === 'pass').length; const ob = ITEMS.reduce((t, it) => t + openBlocks(it).length, 0);
      const fixes = ITEMS.reduce((t, it) => t + it.res.findings.filter(f => f.fix).length, 0); const rev = ITEMS.reduce((t, it) => t + it.res.findings.filter(f => (f.sev === 'warn' || f.sev === 'fix') && disp(it, f).s !== 'CLEARED').length, 0);
      $('#cpFindH', root).textContent = COMP() ? 'Positioning notes' : 'Findings'; $('#cpCompNote', root).hidden = !COMP();
      $('#cpTiles', root).innerHTML = tile('Items screened', N(n), LAST.src ? esc(LAST.src) : 'nothing run yet') + tile(COMP() ? 'No flags' : 'Pass', N(pass), 'no open block') + tile(COMP() ? 'Flagged' : 'Needs review', N(n - pass), 'at least one open block') + tile(COMP() ? 'Rule level notes' : 'Open blocks', N(ob), COMP() ? 'where their copy breaks a rule as written' : 'must change before it runs') + tile(COMP() ? 'Open questions' : 'To review', N(rev), 'a person decides') + tile('Safe fixes', N(fixes), 'findings with a deterministic correction') + tile('Answer', esc(answer()), esc((QS.find(q => q[0] === st.q) || QS[0])[1]));
    }
    function renderItems() {
      const host = $('#cpItems', root);
      if (!ITEMS.length) { host.innerHTML = '<p class="small">Run a source to screen it.</p>'; return; }
      host.innerHTML = `<div class="tblwrap"><table class="t cp-items"><thead><tr><th>Item</th><th>Status</th><th>Type</th><th>Platform</th><th>Language</th><th title="Blocks">Blocks</th><th title="Fix">Fix</th><th title="Review">Review</th><th title="Info">Info</th><th>Fixed</th></tr></thead><tbody>${ITEMS.map(it => { const c = it.res.counts; const o = optsFor(it); return `<tr data-id="${it.id}" class="${it.id === SEL ? 'sel' : ''}" tabindex="0"><td class="name">${esc(it.label)}</td><td>${statusPill(it)}</td><td>${esc(it.fields ? 'Ad fields' : it.html || it.res.html ? 'HTML ' + (KLAB[o.kind] || o.kind).toLowerCase() : KLAB[o.kind] || o.kind)}</td><td>${esc(PLAB[o.platform] || o.platform || 'not set')}</td><td>${it.res.lang === 'es' ? 'Spanish' : 'English'}</td><td>${N(c.block)}</td><td>${N(c.fix)}</td><td>${N(c.warn)}</td><td>${N(c.info)}</td><td>${it.fixed ? (it.fixed.after.pass ? pill('Passes', 'p-ok') : pill(it.fixed.after.counts.block + ' left', 'p-warn')) : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
      $$('tbody tr', host).forEach(tr => { const go = () => { SEL = tr.dataset.id; SCOPE = 'item'; $$('#cpScope button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === 'item'))); render(); }; tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
    }
    function visible() {
      const list = []; const items = SCOPE === 'all' ? ITEMS : [curItem()].filter(Boolean);
      items.forEach(it => it.res.findings.forEach(f => { const d = disp(it, f); if ((!FSEV || f.sev === FSEV) && (!FFAM || f.fam === FFAM) && (!FDISP || d.s === FDISP)) list.push({ it, f, d }); }));
      return list;
    }
    function fCard(it, f, d, showItem) {
      const ctxHTML = f.at >= 0 && f.hit && f.ctx ? `<div class="cp-ctx">${esc(f.ctx.before)}<mark class="m-${f.sev}">${esc(f.hit)}</mark>${esc(f.ctx.after)}</div>` : f.hit ? `<div class="cp-ctx"><mark class="m-${f.sev}">${esc(f.hit.slice(0, 240))}${f.hit.length > 240 ? '…' : ''}</mark></div>` : '';
      return `<div class="cp-f s-${f.sev}" data-fk="${esc(it.id + '|' + f.id)}">
        <div class="cp-fh">${cpSev(f.sev)} <span class="cp-disp d-${DCLS[d.s]}">${DLAB(d.s)}</span> <b>${esc(f.title)}</b> <code>${esc(f.id)}</code>${f.field ? ` <span class="small">field ${esc(f.field)}</span>` : ''}${showItem ? ` <span class="small">· ${esc(it.label)}</span>` : ''}</div>
        <div class="cp-rule">${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.rule)}</a>` : esc(f.rule)} · ${esc(f.fam || '')} · ${f.v === '✔' ? 'cited from the primary text' : 'verify the live text'}${f.n > 1 ? ` · ${N(f.n)} hits` : ''}${f.line ? ` · line ${N(f.line)}` : ''}${f.src_at != null ? ` · source position ${N(f.src_at)}` : f.at >= 0 ? ` · position ${N(f.at)}` : ''}</div>
        ${ctxHTML}<p class="cp-why">${esc(f.why)}</p>
        ${f.fix ? `<div class="cp-fixline">Safe fix: ${f.fix.from ? `<del>${esc(f.fix.from)}</del>` : '<i>add</i>'} → ${f.fix.to ? `<ins>${esc(f.fix.to)}</ins>` : '<i>removed</i>'}</div>` : ''}
        <details class="cp-more"><summary>${st.posture === 'comp' ? 'What would settle it, where it could go' : 'What would settle it'}, move by hand</summary>
          ${d.moved ? `<p class="small">${esc(d.moved)}.</p>` : ''}<p class="small"><b>What would settle it.</b> ${esc(f.settle || 'Write the open question and the evidence that would close it.')}</p>
          ${st.posture === 'comp' ? `<p class="small"><b>If it ever goes outside the firm.</b> ${esc(routeFor(f))} Evidence bar: a dated screenshot or saved source of each instance and the URL or ad ID. Most notes stay in house as positioning.</p>` : ''}
          <div class="btnrow">${DISPS.map(s => `<button type="button" class="btn sm${d.s === s ? ' primary' : ''}" data-mv="${s}" aria-pressed="${d.s === s}">${DLAB(s)}</button>`).join('')}<button type="button" class="btn sm" data-mv="">Reset</button></div></details></div>`;
    }
    function renderFindings() {
      const it = curItem(); const fams = [...new Set(ITEMS.flatMap(x => x.res.findings.map(f => f.fam)))].filter(Boolean).sort();
      const fs = $('#cpFam', root); fs.innerHTML = '<option value="">All</option>' + fams.map(f => `<option value="${esc(f)}"${f === FFAM ? ' selected' : ''}>${esc(f)}</option>`).join(''); if (!fams.includes(FFAM)) FFAM = '';
      const host = $('#cpFind', root);
      if (!ITEMS.length) { $('#cpFindSub', root).textContent = 'Run a source, then pick an item.'; host.innerHTML = ''; $('#cpMarkedW', root).hidden = true; return; }
      const list = visible();
      $('#cpFindSub', root).innerHTML = SCOPE === 'all' ? `All ${N(ITEMS.length)} items, ${N(list.length)} findings shown.` : `${esc(it.label)}: ${statusPill(it)} ${N(it.res.findings.length)} findings, ${N(list.length)} shown. Language ${it.res.lang === 'es' ? 'Spanish' : 'English'}${it.res.html ? ', HTML (tags stripped)' : ''}.`;
      $('#cpMarkedW', root).hidden = SCOPE === 'all'; if (SCOPE !== 'all') $('#cpMarked', root).innerHTML = marked(it);
      if (!list.length) { host.innerHTML = `<p class="small">${it && !it.res.findings.length ? 'No findings: nothing in this copy matches a rule.' : 'No findings match the filters.'}</p>`; return; }
      host.innerHTML = LINT.SEVS.map(sv => { const g = list.filter(x => x.f.sev === sv); return g.length ? `<div class="cp-grp"><h4 class="minihd">${esc(LINT.SEV_LABEL[sv])} (${N(g.length)})</h4>${g.map(x => fCard(x.it, x.f, x.d, SCOPE === 'all')).join('')}</div>` : ''; }).join('');
    }
    function marked(it) {
      const t = it.res.text || ''; if (!t) return '<span class="small">Empty.</span>';
      const marks = []; it.res.findings.forEach(f => (f.hits || []).forEach(h => { if (h.at >= 0 && h.len > 0) marks.push({ at: h.at, end: h.at + h.len, sev: h.sev || f.sev, id: f.id, title: f.title }); }));
      marks.sort((a, b) => a.at - b.at || LINT.SEVS.indexOf(a.sev) - LINT.SEVS.indexOf(b.sev)); let pos = 0, out = '';
      marks.forEach(m => { if (m.at < pos) return; out += esc(t.slice(pos, m.at)) + `<mark class="m-${m.sev}" title="${esc(LINT.SEV_LABEL[m.sev] + ': ' + m.title + ' (' + m.id + ')')}">${esc(t.slice(m.at, m.end))}</mark><span class="vh"> (${esc(LINT.SEV_LABEL[m.sev])}: ${esc(m.title)})</span>`; pos = m.end; });
      return out + esc(t.slice(pos));
    }
    $('#cpFind', root).onclick = e => { const b = e.target.closest('[data-mv]'); if (!b) return; const card = b.closest('[data-fk]'); const [iid, fid] = card.dataset.fk.split('|'); const it = ITEMS.find(x => x.id === iid); if (!it) return; const k = it.label + '|' + fid; if (b.dataset.mv) OVR[k] = b.dataset.mv; else delete OVR[k]; store.set('sev.comp.ovr', OVR); render(); const again = $(`[data-fk="${CSS.escape(card.dataset.fk)}"] details`, root); if (again) again.open = true; };
    wireSeg($('#cpScope', root), v => { SCOPE = v; renderFindings(); });
    wireSeg($('#cpSev', root), v => { FSEV = v; renderFindings(); });
    $('#cpFam', root).onchange = e => { FFAM = e.target.value; renderFindings(); };
    $('#cpDisp', root).onchange = e => { FDISP = e.target.value; renderFindings(); };

    /* ---------- safe fixes ---------- */
    function fixItem(it) {
      const o = optsFor(it);
      if (it.fields) { const fa = LINT.fixAd({ platform: o.platform, fields: it.fields }, o); const after = LINT.screenAd({ platform: o.platform, fields: fa.fields }, o); it.fixed = { fields: fa.fields, text: Object.keys(fa.fields).map(k => fa.fields[k]).join('\n'), applied: fa.applied, after }; }
      else { const fx = LINT.fix(it.text, o); const after = LINT.screen(fx.text, o); it.fixed = { text: fx.text, applied: fx.applied, after }; }
      return it;
    }
    const plainOf = (it, which) => { if (it.fields) { const f = which === 'after' ? it.fixed.fields : it.fields; return Object.keys(f).map(k => `${k}: ${f[k]}`).join('\n'); } const s = which === 'after' ? it.fixed.text : it.text; return it.res.html ? LINT.stripHTML(s).text : s; };
    function renderFix() {
      const it = curItem(); const host = $('#cpFixOut', root); const has = !!(it && it.fixed); ['#cpFixUse', '#cpFixCopy', '#cpFixDl'].forEach(id => { $(id, root).disabled = !has && !(id === '#cpFixDl' && ITEMS.some(x => x.fixed)); });
      if (!it) { host.innerHTML = '<p class="small">Run a source first.</p>'; return; }
      const fixedN = ITEMS.filter(x => x.fixed).length; const batch = fixedN > 1 ? `<p class="small">${N(fixedN)} items corrected; ${N(ITEMS.filter(x => x.fixed && x.fixed.after.pass).length)} pass after the safe fixes. "↓ Corrected copy" downloads them all as a CSV.</p>` : '';
      if (!has) { host.innerHTML = batch + `<p class="small">${esc(it.label)}: ${N(it.res.findings.filter(f => f.fix).length)} finding${it.res.findings.filter(f => f.fix).length === 1 ? '' : 's'} with a safe fix. Press "Apply safe fixes to this item", or "Apply safe fixes" in the toolbar for every item.</p>`; return; }
      const fx = it.fixed; const a = fx.after; const left = a.findings.filter(f => f.sev === 'block');
      const d = LINT.diff(plainOf(it, 'before'), plainOf(it, 'after'));
      host.innerHTML = batch + `<p>${a.pass ? pill('Passes after the fixes', 'p-ok') : pill(`${left.length} block${left.length === 1 ? '' : 's'} left for a person`, 'p-block')} <span class="small">${N(fx.applied.length)} change${fx.applied.length === 1 ? '' : 's'} applied.${left.length ? ' Still blocking: ' + esc([...new Set(left.map(f => f.title))].join('; ')) + '.' : ''}</span></p>
        <div class="minihd">What changed</div>${fx.applied.length ? `<div class="tblwrap"><table class="t cp-wrap"><thead><tr><th>Rule</th>${it.fields ? '<th>Field</th>' : ''}<th>From</th><th>To</th></tr></thead><tbody>${fx.applied.map(x => `<tr><td><code>${esc(x.id)}</code></td>${it.fields ? `<td>${esc(x.field || '')}</td>` : ''}<td><del>${esc(x.from || '(nothing)')}</del></td><td><ins>${esc(x.to || '(removed)')}</ins></td></tr>`).join('')}</tbody></table></div>` : '<p class="small">Nothing to correct safely. The remaining findings need a person.</p>'}
        <div class="minihd">The corrected copy, marked</div><div class="cp-diff" aria-label="Differences between the original and the corrected copy">${d.map(o => o.t === '=' ? esc(o.s) : o.t === '-' ? `<del>${esc(o.s)}</del>` : `<ins>${esc(o.s)}</ins>`).join('')}</div>
        <div class="ctl wide" style="margin-top:10px"><label for="cpFixed">Corrected copy${it.res.html ? ' (HTML)' : ''}</label><textarea class="copy" id="cpFixed" readonly spellcheck="false">${esc(fx.text)}</textarea></div>`;
    }
    $('#cpFixOne', root).onclick = () => { const it = curItem(); if (!it) { toast('Run a source first'); return; } fixItem(it); render(); };
    $('#cpFixAll', root).onclick = () => { if (!ITEMS.length) { toast('Run a source first'); return; } ITEMS.forEach(fixItem); render(); note(`Safe fixes applied to ${ITEMS.length} item${ITEMS.length === 1 ? '' : 's'}; ${ITEMS.filter(x => x.fixed.after.pass).length} pass afterwards.`); };
    $('#cpFixCopy', root).onclick = () => { const it = curItem(); if (it && it.fixed) copyText(it.fixed.text); };
    $('#cpFixUse', root).onclick = () => { const it = curItem(); if (!it || !it.fixed) return; it.text = it.fixed.text; if (it.fields) it.fields = it.fixed.fields; screenItem(it); if (ITEMS.length === 1 && SRCV === 'paste') { const was = $('#cpText', root).value; $('#cpText', root).value = it.text; if (!isSample(was)) keepDraft(it.text); draftUI(); } render(); toast('Corrected copy screened again'); };
    $('#cpFixDl', root).onclick = () => { const done = ITEMS.filter(x => x.fixed); if (!done.length) { toast('Apply the safe fixes first'); return; }
      if (done.length === 1) { const it = done[0]; saveFile(`${slug(it.label) || 'copy'}_corrected.${it.res.html ? 'html' : 'txt'}`, it.fixed.text); return; }
      saveFile('compliance_corrected_copy.csv', toCSV(['item', 'platform', 'status_after', 'blocks_left', 'changes', 'original', 'corrected'], done.map(it => [it.label, optsFor(it).platform, it.fixed.after.pass ? 'pass' : 'needs review', it.fixed.after.counts.block, it.fixed.applied.map(a => `${a.id}: ${a.from} > ${a.to}`).join(' | '), it.fields ? JSON.stringify(it.fields) : it.text, it.fields ? JSON.stringify(it.fixed.fields) : it.fixed.text]), `Severance Compliance Screen, rule pack ${LINT.VERSION}, ${todayISO()}`)); };

    /* ---------- controls gate and routes ---------- */
    function renderCtrl() {
      $('#cpCtrl', root).innerHTML = CONTROLS.map(([id, label, ids]) => `<label class="chk"><input type="checkbox" data-c="${id}"${CTRL[id] ? ' checked' : ''}> <span>${esc(label)} <span class="small">answers ${ids.join(', ')}</span></span></label>`).join('');
      $$('#cpCtrl [data-c]', root).forEach(i => i.onchange = () => { CTRL[i.dataset.c] = i.checked; store.set('sev.comp.ctrl', CTRL); render(); });
    }
    function renderRoute() {
      const hotF = new Set(); ITEMS.forEach(it => it.res.findings.forEach(f => { const s = disp(it, f).s; if (s === 'CONFIRMED' || s === 'CANDIDATE') hotF.add(f.fam); }));
      $('#cpRoute', root).innerHTML = `<div class="tblwrap"><table class="t cp-wrap"><thead><tr><th>Route</th><th>Channel</th><th>What it needs</th><th>What it does</th></tr></thead><tbody>${ROUTES.map(r => { const hot = r[0] !== 'In house' && [...hotF].some(f => r[4].some(re => re.test(f))); return `<tr${hot ? ' class="cp-hot"' : ''}><td><b>${esc(r[0])}</b>${hot ? ' ' + pill('in this run', 'p-warn') : ''}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`; }).join('')}</tbody></table></div>`;
    }

    /* ---------- sources ---------- */
    function setSrc(v) { SRCV = v; $$('#cpSrc button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); $('#cpPaste', root).hidden = v !== 'paste'; $('#cpFiles', root).hidden = v !== 'files'; }
    let MOUNT_ERR = '';
    function ensureMounted(key) { MOUNT_ERR = ''; const m = MODI[key]; if (!m) return null; if (!m.mounted) { const sec = $('#mod-' + key); if (!sec) return null; m.mounted = true; try { m.mount(sec); } catch (e) { console.warn(e); MOUNT_ERR = e.message; sec.innerHTML = `<div class="callout"><div class="h">Module error</div><p>${esc(e.message)}</p></div>`; return null; } } return m; }
    function fromDesk() {
      const m = ensureMounted('desk'); if (!m || typeof m.feed !== 'function') { note(MOUNT_ERR ? 'The Campaign Desk failed to load (' + MOUNT_ERR + '). Export its ads as a CSV and upload them here.' : 'The Campaign Desk has no creative feed in this build. Export its ads as a CSV and upload them here.'); return; }
      let feed = []; try { feed = m.feed() || []; } catch (e) { note('The Campaign Desk feed failed: ' + e.message); return; }
      if (!feed.length) { note('The Campaign Desk has no ads yet. Build a plan in module 10, then pull the feed again.'); return; }
      runItems(feed.map(a => ({ label: 'Desk · ' + (a.label || 'ad'), text: a.text, fields: a.fields, platform: a.platform || a.plat, kind: a.kind || 'ad', lang: a.lang })), 'Campaign Desk', `${feed.length} ads across ${new Set(feed.map(a => a.platform || a.plat)).size} platforms`);
    }
    async function fromForge() {
      const m = ensureMounted('forge'); if (!m || (typeof m.feed !== 'function' && typeof m.publishPages !== 'function')) { note(MOUNT_ERR ? 'The Site Forge failed to load (' + MOUNT_ERR + '). Paste a page\'s HTML or upload the .html files instead.' : 'The Site Forge is not available in this build. Paste a page\'s HTML or upload the .html files instead.'); return; }
      let list = [];
      try {
        if (typeof m.feed === 'function') list = (await Promise.resolve(m.feed())) || [];
        else list = ((await Promise.resolve(m.publishPages())) || []).map(p => ({ label: p.title || p.slug, text: p.html || '', html: true, page: true, slug: p.slug, language: p.language }));
      } catch (e) { note('The Site Forge feed failed: ' + e.message); return; }
      if (!list.length) { note('The Site Forge has no pages yet. Plan the site in module 21, then pull the feed again.'); return; }
      runItems(list.map(p => ({ label: 'Forge · ' + (p.label || p.title || p.slug || 'page'), text: p.html || p.text || '', html: !!(p.html || p.page) || undefined, kind: 'page', homepage: p.homepage != null ? !!p.homepage : p.slug != null ? (!p.slug || /^(home|index)$/i.test(p.slug)) : undefined, lang: /^es/i.test(p.language || p.lang || '') ? 'es' : '', sensitive: p.sensitive })), 'Site Forge', `${list.length} pages`);
    }
    function fromFirm() {
      const items = LINT.firmItems(); let miss = []; try { miss = FIRM.missing(); } catch (e) { }
      if (!items.length || items.every(i => /Ad footer/.test(i.label))) { if (items.length) runItems(items, 'Firm profile', 'the ad footer only'); note(`The firm profile is empty${miss.length ? ' (missing: ' + miss.join(', ') + ')' : ''}. Open the Firm button and fill it, then screen it again; the ad footer below shows the placeholders every ad would carry.`); return; }
      runItems(items, 'Firm profile', `${items.length} fields${miss.length ? '; still missing: ' + miss.join(', ') : ''}`);
    }
    async function fromFiles(files) {
      const out = []; const warns = [];
      for (const f of files) {
        let text = ''; try { text = await readText(f); } catch (e) { warns.push(`${f.name}: ${e.message}`); continue; }
        const nm = f.name.replace(/\.[^.]+$/, '');
        if (/\.(csv|tsv)$/i.test(f.name)) { const p = LINT.parseAdsCSV(text); p.warnings.forEach(w => warns.push(`${f.name}: ${w}`)); p.items.forEach(it => out.push(Object.assign(it, { label: `${nm} · ${it.label}` }))); }
        else if (/\.html?$/i.test(f.name)) out.push({ label: f.name, text, html: true, kind: 'page', homepage: /^(index|home)$/i.test(nm) });
        else if (/\.json$/i.test(f.name)) { try { const j = JSON.parse(text); const arr = Array.isArray(j) ? j : Array.isArray(j.items) ? j.items : []; if (!arr.length) warns.push(`${f.name}: no list of items`); arr.forEach((x, i) => { if (x && (x.text || x.fields || x.html)) out.push({ label: `${nm} · ${x.label || x.title || i + 1}`, text: x.text || x.html || '', fields: x.fields, platform: x.platform, kind: x.kind, lang: x.lang, html: x.html ? true : undefined }); }); } catch (e) { warns.push(`${f.name}: not valid JSON (${e.message})`); } }
        else { const parts = LINT.splitBatch(text); parts.forEach((p, i) => out.push(Object.assign(p, { label: parts.length > 1 ? `${nm} · ${p.label}` : (p.label && !/^Item \d+$/.test(p.label) ? p.label : f.name) }))); }
      }
      if (!out.length) { note('Nothing to screen in those files. ' + warns.join(' ')); return; }
      runItems(out, 'Uploaded files', `${files.length} file${files.length === 1 ? '' : 's'}`); if (warns.length) note($('#cpNote', root).textContent + ' ' + warns.join(' '));
    }
    wireSeg($('#cpSrc', root), v => { setSrc(v); if (v === 'desk') fromDesk(); else if (v === 'forge') fromForge(); else if (v === 'firm') fromFirm(); });
    $('#cpRun', root).onclick = () => { setSrc('paste'); runPaste(); };
    $('#cpRunTop', root).onclick = () => { if (SRCV === 'desk') fromDesk(); else if (SRCV === 'forge') fromForge(); else if (SRCV === 'firm') fromFirm(); else if (SRCV === 'files') $('#cpPick', root).click(); else runPaste(); };
    function draftUI() { const d = draft(); const box = $('#cpText', root).value; const show = !!(d && d.trim() && d !== box); $('#cpRestore', root).hidden = !show; $('#cpDraftNote', root).textContent = show ? 'Your own copy is kept in this browser; "Back to my copy" puts it back in the box.' : ''; }
    const loadSample = (txt, label) => { setSrc('paste'); keepDraft($('#cpText', root).value); $('#cpText', root).value = txt; $('#cpLabel', root).value = label || ''; runPaste(); };
    $('#cpRestore', root).onclick = () => { const d = draft(); if (!d) return; setSrc('paste'); $('#cpText', root).value = d; $('#cpLabel', root).value = ''; runPaste(); $('#cpText', root).focus(); };
    $('#cpText', root).oninput = debounce(() => { keepDraft($('#cpText', root).value); draftUI(); }, 500);   // the user's copy is saved as it is typed, not only when it runs
    $('#cpSample', root).onclick = () => loadSample(SAMPLE_AD, 'Sample ad');
    $('#cpSampleEs', root).onclick = () => loadSample(SAMPLE_ES, 'Sample Spanish ad');
    $('#cpSamplePage', root).onclick = () => loadSample(SAMPLE_PAGE, 'Sample page (fictional, written to trip the rules)');
    $('#cpSampleBatch', root).onclick = () => loadSample(SAMPLE_BATCH, '');
    $('#cpClear', root).onclick = () => { keepDraft($('#cpText', root).value); $('#cpText', root).value = ''; $('#cpLabel', root).value = ''; ITEMS = []; SEL = null; LAST = { src: '', label: '' }; render(); draftUI(); note('Cleared. Your copy stays saved until you type or screen new copy.'); };
    $('#cpPick', root).onclick = async () => { const files = await pickFiles('.csv,.tsv,.txt,.md,.html,.htm,.json,text/plain,text/csv,text/html', true); if (files.length) fromFiles(files); };
    $('#cpCsvTpl', root).onclick = () => saveFile('compliance_ads_template.csv', toCSV(['Platform', 'Ad name', 'Language', 'Headline 1', 'Headline 2', 'Headline 3', 'Description 1', 'Description 2', 'Primary text', 'Title'], [['google', 'Custody, Collin County', 'en', 'Custody Lawyer In Plano', 'Collin County Family Law', 'Conservatorship Explained', 'Possession and child support explained in plain terms.', 'Flat fee options for agreed cases.', '', ''], ['meta', 'Divorce with children', 'en', '', '', '', '', '', 'Divorce with children in Collin County: conservatorship, possession and support, explained.', 'Plano family law']]));
    const dz = $('#cpDrop', root);
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []); if (files.length) fromFiles(files); };

    /* ---------- exports ---------- */
    const findingRows = () => { const rows = []; ITEMS.forEach(it => { const o = optsFor(it); it.res.findings.forEach(f => { const d = disp(it, f); rows.push([it.label, PLAB[o.platform] || o.platform, KLAB[o.kind] || o.kind, it.res.lang, status(it), d.s, f.id, f.sev, f.fam, f.title, f.rule, f.v === '✔' ? 'cited' : 'verify', f.field || '', f.hit, f.at, f.src_at != null ? f.src_at : '', f.line || '', f.ctx ? f.ctx.before + '[' + f.hit + ']' + f.ctx.after : '', f.fix ? f.fix.from : '', f.fix ? f.fix.to : '', f.why, st.posture === 'comp' ? routeFor(f) : (f.settle || ''), d.moved, f.url]); }); }); return rows; };
    $('#cpCsv', root).onclick = () => { if (!ITEMS.length) { toast('Run a source first'); return; } saveFile(`compliance_findings_${slug(st.target || firmName() || 'run')}.csv`, toCSV(['item', 'platform', 'type', 'language', 'item_status', 'disposition', 'rule_id', 'severity', 'family', 'title', 'citation', 'vintage', 'field', 'hit', 'position', 'source_position', 'line', 'context', 'fix_from', 'fix_to', 'why', st.posture === 'comp' ? 'route' : 'settle', 'moved', 'source_url'], findingRows(), `Severance Compliance Screen, rule pack ${LINT.VERSION}; posture ${st.posture === 'comp' ? 'competitor' : 'self audit'}; target ${st.target || firmName() || 'not set'}; source ${LAST.src}: ${LAST.label}; ${todayISO()}`)); };
    $('#cpBook', root).onclick = () => saveFile('compliance_rule_book.csv', toCSV(['rule_id', 'build1_id', 'family', 'severity', 'language', 'title', 'citation', 'safe_fix', 'vintage', 'source', 'source_url', 'why'], LINT.RULES.map(r => [r.id, r.alias || '', r.fam, r.sev, r.lang, r.t, r.rule, r.fix || r.id === 'house' || r.id === 'certified' || r.id === 'sol_label' || r.id === 'r702a' || r.id === 'WEBRESP' ? 'yes' : 'no', r.v === '✔' ? 'cited' : 'verify', (LINT.SOURCES[r.src] || {}).label || '', r.url || '', r.why]), `Severance compliance engine rule pack ${LINT.VERSION}. Platform limits are checked per field as len_<field> and count_<field>.`));
    $('#cpMd', root).onclick = () => {
      if (!ITEMS.length) { toast('Run a source first'); return; }
      const lines = [`# Compliance screen: ${st.target || firmName() || 'unnamed'}`, '', `Posture: ${st.posture === 'comp' ? 'competitor' : 'self audit'}. Question: ${(QS.find(q => q[0] === st.q) || QS[0])[1]} Answer: ${answer()}.`, `Source: ${LAST.src}, ${LAST.label}. Rule pack ${LINT.VERSION}. Screened ${todayISO()}.`, `${ITEMS.length} item${ITEMS.length === 1 ? '' : 's'}: ${ITEMS.filter(it => status(it) === 'pass').length} pass, ${ITEMS.filter(it => status(it) !== 'pass').length} need review.`, ''];
      const on = CONTROLS.filter(c => CTRL[c[0]]); if (on.length) lines.push('Controls in place: ' + on.map(c => c[1]).join('; ') + '.', '');
      ITEMS.forEach(it => { lines.push(`## ${it.label}: ${status(it) === 'pass' ? 'pass' : 'needs review'}`, ''); const o = optsFor(it); lines.push(`${KLAB[o.kind] || o.kind}${o.platform ? ', ' + (PLAB[o.platform] || o.platform) : ''}, ${it.res.lang === 'es' ? 'Spanish' : 'English'}.`, '');
        LINT.SEVS.forEach(sv => { const g = it.res.findings.filter(f => f.sev === sv); if (!g.length) return; lines.push(`### ${LINT.SEV_LABEL[sv]} (${g.length})`, ''); g.forEach(f => { const d = disp(it, f); lines.push(`- **${f.title}** (\`${f.id}\`, ${f.rule}; ${DLAB(d.s).toLowerCase()}${d.moved ? ', ' + d.moved.toLowerCase() : ''})${f.hit ? `: "${f.hit.replace(/\s+/g, ' ').slice(0, 160)}"` : ''}${f.field ? ` in ${f.field}` : ''}. ${f.why}${f.fix ? ` Safe fix: "${f.fix.from}" to "${f.fix.to}".` : ''}${st.posture === 'comp' ? ' Route: ' + routeFor(f) : ''}`); }); lines.push(''); });
        if (it.fixed) { lines.push(`### After the safe fixes: ${it.fixed.after.pass ? 'pass' : it.fixed.after.counts.block + ' blocks left'}`, '', ...it.fixed.applied.map(a => `- \`${a.id}\`${a.field ? ' (' + a.field + ')' : ''}: "${a.from}" to "${a.to}"`), '', '```', it.fixed.text, '```', ''); } });
      lines.push('Severance Compliance Screen. A screen, not legal advice: a flag is a reason to look.');
      saveFile(`compliance_report_${slug(st.target || firmName() || 'run')}.md`, lines.join('\n'));
    };

    /* ---------- the Advertising Review Committee filing log ---------- */
    const addDays = (iso, n) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return ''; const d = new Date(+m[1], +m[2] - 1, +m[3] + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const daysTo = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return null; const t = todayISO().split('-').map(Number); return Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - new Date(t[0], t[1] - 1, t[2])) / 864e5); };
    const NEEDS = r => !/^(Filed|Approved|Exempt|Withdrawn|Pre approval)/.test(r.status || '');
    const arcState = r => { const due = addDays(r.pub, LINT.FILING.days); const left = daysTo(due); if (!NEEDS(r)) return { due, cls: 'p-ok', txt: r.status }; if (!r.pub) return { due: '', cls: 'p-warn', txt: 'No publish date' }; if (left < 0) return { due, cls: 'p-block', txt: `${N(-left)} day${left === -1 ? '' : 's'} overdue` }; if (left <= 3) return { due, cls: 'p-warn', txt: left === 0 ? 'Due today' : `Due in ${N(left)} day${left === 1 ? '' : 's'}` }; return { due, cls: '', txt: `Due in ${N(left)} days` }; };
    /* Publish (module 22) also writes rows into sev.comp.arc and emits BUS 'arc': every change here reloads the stored log first and
       changes it by id, so neither side overwrites the other's rows */
    const arcLoad = () => { const a = store.get('sev.comp.arc', []); ARC = Array.isArray(a) ? a : []; };
    const arcSave = () => store.set('sev.comp.arc', ARC);
    const arcRead = () => ({ what: $('#cpArcWhat', root).value.trim(), where: $('#cpArcWhere', root).value, pub: $('#cpArcPub', root).value, filed: $('#cpArcFiled', root).value, no: $('#cpArcNo', root).value.trim(), status: $('#cpArcStatus', root).value, note: $('#cpArcNote', root).value.trim() });
    const arcFill = r => { $('#cpArcWhat', root).value = r.what || ''; $('#cpArcWhere', root).value = r.where || ''; $('#cpArcPub', root).value = r.pub || ''; $('#cpArcFiled', root).value = r.filed || ''; $('#cpArcNo', root).value = r.no || ''; $('#cpArcStatus', root).value = r.status || 'Not filed'; $('#cpArcNote', root).value = r.note || ''; };
    function renderArc() {
      const open = ARC.filter(NEEDS); const over = open.filter(r => { const l = daysTo(addDays(r.pub, LINT.FILING.days)); return r.pub && l != null && l < 0; }); const soon = open.filter(r => { const l = daysTo(addDays(r.pub, LINT.FILING.days)); return r.pub && l != null && l >= 0 && l <= 3; });
      $('#cpArcTiles', root).innerHTML = tile('In the log', N(ARC.length), 'ads, pages and mailings') + tile('Overdue', N(over.length), `not filed ${LINT.FILING.days} days after first publication`) + tile('Due within 3 days', N(soon.length), 'file now') + tile('Filed or approved', N(ARC.filter(r => /^(Filed|Approved|Pre approval)/.test(r.status)).length), 'with an ARC number where one was given') + tile('Exempt', N(ARC.filter(r => /^Exempt/.test(r.status)).length), 'Rule 7.05');
      $('#cpArcSave', root).textContent = ARC_EDIT ? 'Save the changes' : 'Add to the log'; $('#cpArcCancel', root).hidden = !ARC_EDIT;
      const rows = ARC.slice().sort((a, b) => String(b.pub || '').localeCompare(String(a.pub || '')));
      $('#cpArcT', root).innerHTML = rows.length ? `<div class="tblwrap"><table class="t cp-wrap"><thead><tr><th>What</th><th>Where</th><th>First published</th><th>Due</th><th>Filed</th><th>ARC number</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>${rows.map(r => { const s = arcState(r); return `<tr data-arc="${esc(r.id)}"${ARC_EDIT === r.id ? ' class="sel"' : ''}><td>${esc(r.what)}</td><td>${esc(r.where || '')}</td><td>${r.pub ? esc(fmtDate(r.pub)) : 'n/a'}</td><td>${s.due ? esc(fmtDate(s.due)) : 'n/a'}</td><td>${r.filed ? esc(fmtDate(r.filed)) : ''}</td><td>${esc(r.no || '')}</td><td>${pill(s.txt, s.cls)}</td><td>${esc(r.note || '')}</td><td><div class="btnrow" style="margin:0;flex-wrap:nowrap"><button type="button" class="btn sm" data-arc-ed="${esc(r.id)}">Edit</button><button type="button" class="btn sm danger" data-arc-rm="${esc(r.id)}">Delete</button></div></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="small">Nothing logged yet. Add each ad, homepage, mailing or post that offers services when it first runs.</p>';
      $$('[data-arc-ed]', root).forEach(b => b.onclick = () => { const r = ARC.find(x => x.id === b.dataset.arcEd); if (!r) return; ARC_EDIT = r.id; arcFill(r); renderArc(); $('#cpArcWhat', root).focus(); });
      $$('[data-arc-rm]', root).forEach(b => b.onclick = () => { const r = ARC.find(x => x.id === b.dataset.arcRm); if (!r) return; if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Confirm delete'; b.setAttribute('aria-label', `Confirm deleting ${r.what}`); return; } arcLoad(); ARC = ARC.filter(x => x.id !== r.id); if (ARC_EDIT === r.id) { ARC_EDIT = null; arcFill({}); } arcSave(); renderArc(); });
    }
    $('#cpArcSave', root).onclick = () => { const r = arcRead(); if (!r.what) { $('#cpArcMsg', root).textContent = 'Say what was published.'; $('#cpArcWhat', root).focus(); return; } if (r.filed && r.status === 'Not filed') r.status = 'Filed'; arcLoad();
      if (ARC_EDIT) { const i = ARC.findIndex(x => x.id === ARC_EDIT); if (i >= 0) ARC[i] = Object.assign({}, ARC[i], r, { id: ARC_EDIT }); ARC_EDIT = null; $('#cpArcMsg', root).textContent = 'Saved.'; } else { ARC.push(Object.assign({ id: uid('arc') }, r)); $('#cpArcMsg', root).textContent = 'Added.'; }
      arcSave(); arcFill({}); renderArc(); };
    $('#cpArcCancel', root).onclick = () => { ARC_EDIT = null; arcFill({}); $('#cpArcMsg', root).textContent = ''; renderArc(); };
    $('#cpArcFromItem', root).onclick = () => { const it = curItem(); if (!it) { $('#cpArcMsg', root).textContent = 'Screen something first.'; return; } const o = optsFor(it); const map = { google: 'Google Ads', microsoft: 'Microsoft Ads', meta: 'Meta (Facebook and Instagram)', youtube: 'YouTube', tiktok: 'TikTok', linkedin: 'LinkedIn', lsa: 'Local Services Ads', gbp: 'Google Business Profile' }; const where = map[o.platform] || (o.kind === 'page' ? (o.homepage ? 'Website homepage' : 'Website page (exempt)') : o.kind === 'email' ? 'Email' : o.kind === 'sms' ? 'Text message' : o.kind === 'gbp' ? 'Google Business Profile' : ''); arcFill({ what: it.label, where, pub: todayISO(), status: o.kind === 'page' && !o.homepage ? 'Exempt (Rule 7.05)' : 'Not filed', note: status(it) === 'pass' ? 'Screened: pass' : 'Screened: needs review before it runs' }); ARC_EDIT = null; renderArc(); $('#cpArcMsg', root).textContent = 'Filled from the selected item; check it and add it.'; };
    const ARC_COLS = ['what', 'where', 'first_published', 'due', 'filed', 'arc_number', 'status', 'note'];
    $('#cpArcCsv', root).onclick = () => { if (!ARC.length) { toast('The filing log is empty'); return; } saveFile('arc_filing_log.csv', toCSV(ARC_COLS, ARC.map(r => [r.what, r.where, r.pub, addDays(r.pub, LINT.FILING.days), r.filed, r.no, r.status, r.note]), `Advertising Review Committee filing log (Rule 7.04: within ${LINT.FILING.days} days of first dissemination unless exempt under Rule 7.05). Exported ${todayISO()}.`)); };
    $('#cpArcImp', root).onclick = async () => { const [file] = await pickFiles('.csv,text/csv'); if (!file) return; try { const rows = LINT.parseCSV(await readText(file)); if (rows.length < 2) throw new Error('no rows under the header'); const h = rows[0].map(x => String(x).trim().toLowerCase().replace(/\s+/g, '_')); const ix = k => h.indexOf(k); if (ix('what') < 0) throw new Error('the header needs a "what" column (export the log to see the format)'); let n = 0; arcLoad(); rows.slice(1).forEach(r => { const g = k => ix(k) >= 0 ? String(r[ix(k)] || '').trim() : ''; if (!g('what')) return; ARC.push({ id: uid('arc'), what: g('what'), where: g('where'), pub: /^\d{4}-\d{2}-\d{2}$/.test(g('first_published')) ? g('first_published') : '', filed: /^\d{4}-\d{2}-\d{2}$/.test(g('filed')) ? g('filed') : '', no: g('arc_number'), status: g('status') || 'Not filed', note: g('note') }); n++; }); arcSave(); renderArc(); $('#cpArcMsg', root).textContent = `Imported ${n} row${n === 1 ? '' : 's'}.`; } catch (e) { $('#cpArcMsg', root).textContent = 'Could not import: ' + e.message; } };

    /* ---------- the changes register ---------- */
    const regDate = d => /^\d{4}$/.test(d) ? d : fmtDate(d);
    function srcQuote(src) {
      const out = []; String(src || '').replace(/LINE_META\.(\w+)\.angle(?: and \.law)?/g, (m, k) => { if (typeof LINE_META !== 'undefined' && LINE_META[k]) { out.push(`Module 06, ${LINE_META[k].name}: ${LINE_META[k].angle}`); if (/\.law/.test(m)) out.push(`Authority: ${LINE_META[k].law}`); } return m; });
      String(src || '').replace(/COMP_RULES (r\d\d)/g, (m, a) => { const r = LINT.rule(a); if (r) out.push(`Rule ${r.id} (build 1 ${a}): ${r.why}`); return m; });
      return out;
    }
    function renderReg() {
      const dk = d => /^\d{4}$/.test(d) ? d + '-99' : /^\d{4}-\d{2}$/.test(d) ? d + '-99' : d; const rows = LINT.CHANGES.slice().sort((a, b) => dk(String(a.date)).localeCompare(dk(String(b.date))));
      $('#cpReg', root).innerHTML = `<div class="tblwrap"><table class="t cp-wrap cp-reg"><thead><tr><th>Effective</th><th>Change</th><th>What changed</th><th>Copy to fix</th><th>Caught by</th><th>In Severance</th></tr></thead><tbody>${rows.map((c, i) => { const q = srcQuote(c.src); return `<tr><td class="cp-nowrap">${esc(regDate(c.date))}</td><td><b>${esc(c.title)}</b><div class="small">${esc(c.cite)}</div></td><td>${esc(c.what)}</td><td>${esc(c.copy)}</td><td>${c.rules.length ? c.rules.map(id => `<button type="button" class="btn sm" data-rule="${esc(id)}" title="Show ${esc(id)} in the rule book">${esc(id)}</button>`).join(' ') : '<span class="small">No stale phrasing to catch; an angle to use (module 06)</span>'}${c.sample ? `<div style="margin-top:6px"><button type="button" class="btn sm primary" data-try="${i}">Try it</button></div>` : ''}</td><td class="small">${esc(c.src)}${q.length ? `<details><summary>Source text</summary>${q.map(x => `<p>${esc(x)}</p>`).join('')}</details>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
      $$('#cpReg [data-rule]', root).forEach(b => b.onclick = () => { $('#cpBookQ', root).value = b.dataset.rule; $('#cpBookFam', root).value = ''; renderBook(); $('#cpBookP', root).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      $$('#cpReg [data-try]', root).forEach(b => b.onclick = () => { const c = rows[+b.dataset.try]; loadSample(c.sample, 'Stale copy: ' + c.title); $('#cpFindP', root).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    }
    $('#cpRegCsv', root).onclick = () => saveFile('texas_family_law_changes.csv', toCSV(['effective', 'change', 'what_changed', 'copy_to_fix', 'rule_ids', 'citation', 'source_in_severance', 'stale_example'], LINT.CHANGES.map(c => [c.date, c.title, c.what, c.copy, c.rules.join(' '), c.cite, c.src, c.sample || '']), `Severance Compliance Screen: dated Texas changes that ads and pages must reflect, rule pack ${LINT.VERSION}.`));

    /* ---------- the rule book and the sources ---------- */
    function renderBook() {
      const fam = $('#cpBookFam', root).value; const q = $('#cpBookQ', root).value.trim().toLowerCase();
      const rows = LINT.RULES.filter(r => (!fam || r.fam === fam) && (!q || [r.id, r.alias, r.t, r.rule, r.why, r.fam].join(' ').toLowerCase().includes(q)));
      const fixable = r => !!(r.fix || ['house', 'certified', 'sol_label', 'r702a', 'WEBRESP'].includes(r.id));
      $('#cpBookT', root).innerHTML = rows.length ? `<div class="tblwrap" style="max-height:560px"><table class="t cp-wrap"><thead><tr><th>Rule id</th><th>Family</th><th>Severity</th><th>Language</th><th>What it catches</th><th>Citation</th><th>Safe fix</th><th>Vintage</th></tr></thead><tbody>${rows.map(r => `<tr${q && r.id === q ? ' class="sel"' : ''}><td><code>${esc(r.id)}</code>${r.alias ? `<div class="small">build 1 ${esc(r.alias)}</div>` : ''}</td><td>${esc(r.fam)}</td><td>${cpSev(r.sev)}</td><td>${r.lang === 'es' ? 'Spanish' : r.lang === 'any' ? 'Any' : 'English'}</td><td><b>${esc(r.t)}</b><div class="small">${esc(r.why)}</div></td><td>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.rule)}</a>` : esc(r.rule)}</td><td>${fixable(r) ? 'Yes' : 'No'}</td><td>${r.v === '✔' ? 'Cited' : 'Verify'}</td></tr>`).join('')}</tbody></table></div><p class="small">${N(rows.length)} of ${N(LINT.RULES.length)} rules. Platform limits run per field as <code>len_&lt;field&gt;</code> and <code>count_&lt;field&gt;</code> (Google and Microsoft headline and description counts).</p>` : '<p class="small">No rule matches.</p>';
    }
    $('#cpBookFam', root).onchange = renderBook; $('#cpBookQ', root).oninput = debounce(renderBook, 150);
    $('#cpSrcList', root).innerHTML = Object.keys(LINT.SOURCES).map(k => { const s = LINT.SOURCES[k]; return `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</li>`; }).join('');

    /* ---------- the license battery: the roster (sev.comp.roster), the lookup ---------- */
    const rosterRows = () => LINT.roster();
    const rosterStoredOnly = () => { const v = store.get(LINT.ROSTER_KEY, null); return v && Array.isArray(v.rows) && v.rows.length ? v : null; };
    const ROS_COLS = ['name', 'bar_no', 'status', 'eligible', 'tbls', 'office_city', 'as_of'];
    const rosterCSV = rows => toCSV(ROS_COLS, rows.map(r => ROS_COLS.map(k => r[k] || '')), `Severance firm roster for the license battery (module 11), ${todayISO()}. Statuses as the firm last checked them on the State Bar of Texas search.`);
    function rosterSet(rows, src) { store.set(LINT.ROSTER_KEY, { rows, src: src || 'firm roster', updated: new Date().toISOString() }); renderRoster(); if (ITEMS.length) rerun(); }
    function renderRoster() {
      const stored = rosterStoredOnly(); const rows = rosterRows(); const inact = rows.filter(LINT.notEligible); const dated = rows.map(r => r.as_of).filter(Boolean).sort();
      $('#cpRosTiles', root).innerHTML = tile('Lawyers in the roster', N(rows.length), stored ? 'the firm\'s own list' : 'from the firm profile, status not recorded') + tile('Not eligible or inactive', N(inact.length), 'blocks any copy that prints their number') + tile('Board certified', N(rows.filter(r => r.tbls).length), 'TBLS areas the copy may claim') + tile('Oldest check', dated.length ? esc(dated[0]) : 'n/a', dated.length ? 'as of date in the roster' : 'add an as of date to each lawyer');
      $('#cpRosT', root).innerHTML = rows.length ? `<div class="tblwrap"><table class="t cp-wrap"><thead><tr><th>Lawyer</th><th>Bar number</th><th>Status</th><th>Eligible</th><th>TBLS area</th><th>Office city</th><th>As of</th><th>Source</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.name)}</td><td><code>${esc(r.bar_no || '')}</code>${r.bar_no && r.bar_no.length !== 8 ? ' ' + pill('not 8 digits', 'p-warn') : ''}</td><td>${r.status ? (LINT.notEligible(r) ? pill(r.status, 'p-block') : esc(r.status)) : '<span class="small">not recorded</span>'}</td><td>${esc(r.eligible || '')}</td><td>${esc(r.tbls || '')}</td><td>${esc(r.office_city || '')}</td><td>${esc(r.as_of || '')}</td><td class="small">${esc(r.src || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small">No lawyer yet: fill the lawyers in the firm profile (the Firm button) or paste the firm\'s roster.</p>';
    }
    $('#cpRosEdit', root).onclick = () => { $('#cpRosEd', root).hidden = false; $('#cpRosText', root).value = rosterCSV(rosterRows()).replace(/^#.*\n/, ''); $('#cpRosText', root).focus(); };
    $('#cpRosCancel', root).onclick = () => { $('#cpRosEd', root).hidden = true; };
    $('#cpRosSave', root).onclick = () => { const r = LINT.parseRoster($('#cpRosText', root).value); if (!r.rows.length) { $('#cpRosMsg', root).textContent = 'Nothing saved: ' + (r.warnings.join(' ') || 'no lawyer found.'); return; } rosterSet(r.rows, 'firm roster'); $('#cpRosEd', root).hidden = true; $('#cpRosMsg', root).textContent = `Saved ${r.rows.length} lawyer${r.rows.length === 1 ? '' : 's'}.${r.warnings.length ? ' ' + r.warnings.join(' ') : ''}`; };
    $('#cpRosImp', root).onclick = async () => { const [f] = await pickFiles('.csv,.tsv,.txt,text/csv,text/plain'); if (!f) return; try { const r = LINT.parseRoster(await readText(f)); if (!r.rows.length) throw new Error(r.warnings.join(' ') || 'no lawyer found'); rosterSet(r.rows, 'firm roster, ' + f.name); $('#cpRosMsg', root).textContent = `Imported ${r.rows.length} lawyer${r.rows.length === 1 ? '' : 's'} from ${f.name}.${r.warnings.length ? ' ' + r.warnings.join(' ') : ''}`; } catch (e) { $('#cpRosMsg', root).textContent = 'Could not import: ' + e.message; } };
    $('#cpRosCsv', root).onclick = () => saveFile(expName('roster', 'firm', 'csv'), rosterCSV(rosterRows()));
    $('#cpRosSeed', root).onclick = () => { const b = $('#cpRosSeed', root); if (rosterStoredOnly() && !b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Confirm: replace the roster'; return; } delete b.dataset.sure; b.textContent = 'Start again from the firm profile'; store.set(LINT.ROSTER_KEY, null); renderRoster(); if (ITEMS.length) rerun(); $('#cpRosMsg', root).textContent = 'The roster follows the firm profile again.'; };
    function lookup() {
      const q = $('#cpLQ', root).value.trim(); const host = $('#cpLRes', root); if (!q) { host.innerHTML = '<p class="small">Type a bar number or a name.</p>'; return; }
      const hits = LINT.lookupBar(q, rosterRows()); const link = `<a href="${esc(LINT.SOURCES.findlawyer.url)}" target="_blank" rel="noopener">State Bar of Texas Find a Lawyer</a>`;
      host.innerHTML = hits.length ? hits.map(r => `<div class="cp-lrow"><span><b>${esc(r.name)}</b> <code>${esc(r.bar_no || 'no number')}</code><br><span class="small">${esc([r.tbls ? 'Board Certified, ' + r.tbls + ', Texas Board of Legal Specialization' : '', r.office_city].filter(Boolean).join(' · ') || 'no TBLS area recorded')}</span></span><span>${r.status ? (LINT.notEligible(r) ? pill(r.status, 'p-block') : pill(r.status, 'p-ok')) : pill('status not recorded', 'p-warn')}<br><span class="small">${r.as_of ? 'as of ' + esc(r.as_of) : 'no as of date'}</span></span></div>`).join('') + `<p class="small">From the roster only. Confirm on the ${link} the day the copy runs.</p>`
        : `<p><b>Not in the roster.</b> Not observable here: Severance fetches nothing. Search "${esc(q)}" on the ${link}, then apply the taxonomy before drawing any conclusion.</p>`;
    }
    $('#cpLGo', root).onclick = lookup; $('#cpLQ', root).onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } };

    /* ---------- the law clock: the chart, the calendar, the figures, the standards and one CSV ---------- */
    const STATUS_PILL = { live: ['Live', 'p-ok'], 'in force': ['In force', 'p-ok'], stale: ['Stale', 'p-block'], died: ['Died', 'p-warn'], vetoed: ['Vetoed', 'p-warn'], repealed: ['Repealed', 'p-fix'], adopted: ['Adopted, effect open', 'p-info'], none: ['Does not exist', 'p-block'], scheduled: ['Scheduled', 'p-info'] };
    const stPill = sv => { const x = STATUS_PILL[sv] || [sv, '']; return pill(x[0], x[1]); };
    const vint = v => v === '✔' ? 'In Severance' : v === 'web' ? 'Checked by web search' : 'Verify';
    const dX = d => { const m = String(d || '').match(/^(\d{4})(?:-(\d{2}))?/); return m ? +m[1] + (m[2] ? (+m[2] - 1) / 12 : 0.5) : null; };
    let CLOCK_MO = null;
    function clockChart() {
      const host = $('#cpClockC', root); const M = ST.monthly || {}; const t0 = M.t0; const v = M.div || []; if (!isN(t0) || !v.length) { host.innerHTML = '<p class="small">The monthly court series is not in this build.</p>'; return; }
      const xs = v.map((y, i) => ({ x: Math.floor((t0 + i) / 12) + ((t0 + i) % 12) / 12, y })); const avg = xs.map((p, i) => i >= 11 ? { x: p.x, y: mean(v.slice(i - 11, i + 1)) } : { x: p.x, y: null });
      const x0 = xs[0].x, x1 = xs[xs.length - 1].x; const yrs = []; for (let y = Math.ceil(x0); y <= x1; y++) yrs.push(y);
      const marks = LINT.CALENDAR.filter(c => /^\d{4}-\d{2}/.test(c.date) && dX(c.date) >= x0 && dX(c.date) <= x1).reduce((a, c) => { const k = c.date.slice(0, 7); const g = a.find(m => m.k === k); if (g) g.items.push(c); else a.push({ k, x: dX(c.date), items: [c] }); return a; }, []);
      const steps = LINT.FIGURES.filter(f => /^cap(_\d{4})?$/.test(f.id) && f.num).map(f => ({ x0: dX(f.since), x1: f.until ? dX(f.until) + 1 / 12 : x1 + 1, v: f.num, label: f.value })).sort((a, b) => a.x0 - b.x0);
      lineChart(host, { title: 'Divorce petitions filed in Texas each month, with the child support cap and the dated changes', series: [{ name: 'Divorce petitions a month, statewide', color: 'var(--s3)', values: xs }, { name: 'Twelve month average', color: 'var(--title)', values: avg }], W: 900, H: 300, xTicks: yrs, xTickFmt: x => String(x), xfmt: x => { const m = Math.round((x - Math.floor(x)) * 12); return `${MOL[m] || ''} ${Math.floor(x)}`; }, yfmt: y => N(y), ymin: 0 });
      const overlay = () => {
        const svg = host.querySelector('svg'); if (!svg || svg.querySelector('.cp-ov')) return; const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number); const W = vb[2], H = vb[3]; const g0 = svg.querySelector('line.gridl'); if (!g0 || !W) return;
        const L = +g0.getAttribute('x1'), R = +g0.getAttribute('x2'), T = 14, B = H - 26; const X = x => L + (x - x0) / (x1 - x0 || 1) * (R - L);
        const ns = 'http://www.w3.org/2000/svg'; const g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'cp-ov'); let out = '';
        /* the cap on its own scale in the lower part of the plot, where the filings never go ($7,000 at the axis, $12,500 at 45% of the
           height), with its own ticks at the right edge: a step line with its value at each step */
        const yc = c => B - (c - 7000) / 5500 * 0.45 * (B - T);
        const narrow = (R - L) < 520; if (!narrow) [8000, 10000, 12000].forEach(c => { out += `<line class="cp-capg" x1="${(R - 6).toFixed(1)}" x2="${R.toFixed(1)}" y1="${yc(c).toFixed(1)}" y2="${yc(c).toFixed(1)}"></line><text class="cp-capt" x="${(R - 8).toFixed(1)}" y="${(yc(c) + 4).toFixed(1)}" text-anchor="end">$${N(c)}</text>`; });
        steps.forEach(s => { const a = Math.max(x0, s.x0), b = Math.min(x1, s.x1); if (b <= a) return; const lab = 'Cap ' + s.label; const room = X(b) - X(a) - (narrow ? 4 : 64); out += `<path class="cp-cap" d="M${X(a).toFixed(1)},${yc(s.v).toFixed(1)}H${X(b).toFixed(1)}"></path>` + (textW(lab, 11.5) + 8 < room ? `<text class="cp-capl" x="${(X(a) + 4).toFixed(1)}" y="${(yc(s.v) - 5).toFixed(1)}">${esc(lab)}</text>` : ''); });
        steps.forEach((s, i) => { const n = steps[i + 1]; if (!n || n.x0 < x0 || n.x0 > x1) return; out += `<path class="cp-cap" d="M${X(n.x0).toFixed(1)},${yc(s.v).toFixed(1)}V${yc(n.v).toFixed(1)}"></path>`; });
        const last = []; marks.forEach((m, i) => { const xv = X(m.x); let row = 0; while (last[row] != null && xv - last[row] < 19) row++; last[row] = xv; const x = xv.toFixed(1), cy = T + 9 + row * 19; out += `<line class="cp-vl" x1="${x}" x2="${x}" y1="${cy + 8}" y2="${B}"></line><circle class="cp-vc" cx="${x}" cy="${cy}" r="8"></circle><text class="cp-vt" x="${x}" y="${cy + 3.5}" text-anchor="middle">${i + 1}</text>`; });
        g.innerHTML = out; svg.appendChild(g);
      };
      overlay(); if (CLOCK_MO) CLOCK_MO.disconnect(); CLOCK_MO = new MutationObserver(overlay); CLOCK_MO.observe(host, { childList: true });
      $('#cpClockLeg', root).innerHTML = `<span class="cp-lk"><i class="cp-lk-cap"></i>Child support cap on monthly net resources, drawn on its own scale in the lower part of the chart: ${esc(steps.filter(s => s.x1 > x0).map(s => { const mo = x => `${MOL[Math.round((x - Math.floor(x)) * 12) % 12]} ${Math.floor(x + 1e-9)}`; return s.x0 < x0 ? `${s.label} until ${mo(s.x1 - 1 / 12)}` : `${s.label} from ${mo(s.x0)}`; }).join(', '))}</span>` + marks.map((m, i) => `<span class="cp-lk"><b class="cp-lk-n">${i + 1}</b>${esc(m.items[0].date.length === 7 ? `${MOL[+m.items[0].date.slice(5, 7) - 1]} ${m.items[0].date.slice(0, 4)}` : fmtDate(m.items[0].date))}: ${esc(m.items.map(c => c.title).join('; '))}</span>`).join('');
      $('#cpClockN', root).textContent = `Monthly divorce petitions from the Texas Office of Court Administration, ${seriesSpan()} (the last two months are provisional). The cap is the figure in force each month. None of the changes marked here moves the number of divorces filed; they move what copy may say. Changes dated only by year (the 2023 protective order standard, the 2025 bills that died) are in the calendar below, not on the chart.`;
    }
    let CLOCK_TAB = 'cal';
    const calRows = () => LINT.CALENDAR.map(c => ['calendar', c.date, c.title, c.status, c.what, c.cite, (LINT.figure(c.fig) || {}).value || '', vint(c.v), (c.rules || []).join(' ')]);
    const figRows = () => LINT.FIGURES.map(f => ['figure', f.since || '', f.label, f.status, [f.note || '', f.now ? `Replaced by ${(LINT.figure(f.now) || {}).value}.` : ''].filter(Boolean).join(' '), f.cite, f.value, vint(f.v), (LINT.RULES.filter(r => (r.figs || []).includes(f.id)).map(r => r.id)).join(' ')]);
    const stdRows = () => LINT.STANDARDS.map(x => ['standard', '', x.topic, 'live', x.text, 'Tex. Fam. Code ' + x.cite, '', vint(x.v), '']);
    function renderClockTable() {
      $$('#cpClockTab button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === CLOCK_TAB)));
      const host = $('#cpClockT', root); const dl = d => !d ? '' : /^\d{4}$/.test(d) ? d : /^\d{4}-\d{2}$/.test(d) ? fmtDate(d + '-01').replace(/ 1,/, '') : fmtDate(d);
      if (CLOCK_TAB === 'cal') host.innerHTML = `<div class="tblwrap"><table class="t cp-wrap cp-clockt"><thead><tr><th>Date</th><th>Change</th><th>Status</th><th>What it means</th><th>Citation</th><th>Vintage</th></tr></thead><tbody>${LINT.CALENDAR.map(c => `<tr><td class="cp-nowrap">${esc(dl(c.date))}</td><td><b>${esc(c.title)}</b>${(c.rules || []).length ? `<div class="small">Caught by ${c.rules.map(id => `<code>${esc(id)}</code>`).join(' ')}</div>` : ''}</td><td>${stPill(c.status)}</td><td>${esc(c.what)}</td><td class="small">${esc(c.cite)}</td><td class="small">${esc(vint(c.v))}</td></tr>`).join('')}</tbody></table></div>`;
      else if (CLOCK_TAB === 'fig') host.innerHTML = `<div class="tblwrap"><table class="t cp-wrap cp-clockt"><thead><tr><th>Figure</th><th>Value</th><th>Status</th><th>Since</th><th>Note</th><th>Citation</th><th>Rules that read it</th><th>Vintage</th></tr></thead><tbody>${LINT.FIGURES.map(f => { const rr = LINT.RULES.filter(r => (r.figs || []).includes(f.id)).map(r => r.id); return `<tr><td><b>${esc(f.label)}</b><div class="small">${esc(f.topic)}</div></td><td class="cp-nowrap"><b>${esc(f.value)}</b></td><td>${stPill(f.status)}</td><td class="cp-nowrap">${esc(dl(f.since))}${f.until ? `<div class="small">to ${esc(dl(f.until))}</div>` : ''}</td><td>${esc(f.note || '')}${f.now ? `<div class="small">Replaced by ${esc((LINT.figure(f.now) || {}).value || '')}.</div>` : ''}</td><td class="small">${esc(f.cite)}</td><td>${rr.length ? rr.map(id => `<code>${esc(id)}</code>`).join(' ') : '<span class="small">none</span>'}</td><td class="small">${esc(vint(f.v))}</td></tr>`; }).join('')}</tbody></table></div>`;
      else host.innerHTML = `<div class="tblwrap"><table class="t cp-wrap cp-clockt"><thead><tr><th>Citation</th><th>Topic</th><th>The standard</th><th>Vintage</th></tr></thead><tbody>${LINT.STANDARDS.map(x => `<tr><td class="cp-nowrap"><a href="https://statutes.capitol.texas.gov/Docs/FA/htm/FA.${esc((x.cite.match(/(\d+)\.?/) || [])[1] || '1')}.htm" target="_blank" rel="noopener">${esc(x.cite)}</a></td><td><b>${esc(x.topic)}</b></td><td>${esc(x.text)}</td><td class="small">${esc(vint(x.v))}</td></tr>`).join('')}</tbody></table></div><p class="small">Texas Family Code. Links open the chapter on statutes.capitol.texas.gov.</p>`;
    }
    wireSeg($('#cpClockTab', root), v => { CLOCK_TAB = v; renderClockTable(); });
    $('#cpClockCsv', root).onclick = () => saveFile(expName('law_calendar', 'texas', 'csv'), toCSV(['table', 'date', 'item', 'status', 'what', 'citation', 'figure', 'vintage', 'rule_ids'], calRows().concat(figRows(), stdRows()), `Severance law clock: the dated Texas family law and advertising changes, the figures (live, stale, died, vetoed, repealed) and the statutory standards, rule pack ${LINT.VERSION}. Vintage: In Severance, Checked by web search (October 2026), or Verify.`));

    /* ---------- hooks ---------- */
    const SRCNAME = { watch: 'Competitor Watch', publish: 'Publish', desk: 'Campaign Desk', forge: 'Site Forge', live: 'Live Desk', accounts: 'Accounts' };
    const toFindings = () => { const el = $('#cpFindP', root); if (el && el.scrollIntoView) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); };
    self._recv = p => {
      if (!p || typeof p !== 'object') return;
      if (p.posture) { st.posture = p.posture === 'comp' ? 'comp' : 'self'; $$('#cpPos button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.posture))); }
      const tgt = p.target != null ? p.target : p.name; if (tgt != null) { st.target = String(tgt); $('#cpTarget', root).value = st.target; }
      if (p.domain != null) { st.domain = String(p.domain); $('#cpDomain', root).value = st.domain; }
      saveOpts();
      const src = SRCNAME[p.source] || (p.source ? String(p.source) : p.src || 'Handed over');
      if (Array.isArray(p.items) && p.items.length) { setSrc('paste'); runItems(p.items, src, p.label || `${p.items.length} items`); toFindings(); return; }
      if (p.text || p.fields) {
        setSrc('paste'); const label = p.label || (st.posture === 'comp' && st.target ? st.target + ' copy' : src + ' copy');
        if (p.text) { keepDraft($('#cpText', root).value); HANDED = String(p.text); $('#cpText', root).value = HANDED; draftUI(); } $('#cpLabel', root).value = label;
        runItems([Object.assign({}, p, { label, platform: p.platform || p.plat, html: p.html === true || (p.html == null && LINT.looksHTML(String(p.text || ''))) || undefined })], src, st.posture === 'comp' ? `${st.target || 'a competitor'}, positioning notes` : label);
        toFindings(); return;
      }
      if (st.posture === 'comp') { setSrc('paste'); note(`Target set to ${st.target || 'the competitor'}. Paste the page source from ${st.domain || 'its site'} or its ad copy and screen it.`); }
      rerun();
    };
    self._show = () => { arcLoad(); renderArc(); };
    /* one listener each for the page's life (a remount swaps the handler, never adds a listener) */
    self._arcReload = () => { arcLoad(); if (root.isConnected) renderArc(); };
    self._onFirm = () => { if (!root.isConnected) return; if (ITEMS.length) rerun(); if (!rosterStoredOnly()) renderRoster(); };
    if (!self._busBound) { self._busBound = true; BUS.on('arc', () => { if (self._arcReload) self._arcReload(); }); BUS.on('firm', () => { if (self._onFirm) self._onFirm(); }); }
    self.screenItems = (items, src) => { runItems(items || [], src || 'Handed over', `${(items || []).length} items`); return ITEMS.map(it => ({ label: it.label, pass: status(it) === 'pass', counts: it.res.counts })); };

    renderCtrl(); renderArc(); renderReg(); renderBook(); draftUI(); renderRoster(); renderClockTable(); clockChart();
    if (self._pending) { const p = self._pending; self._pending = null; self._recv(p); } else runPaste();
  }
});
