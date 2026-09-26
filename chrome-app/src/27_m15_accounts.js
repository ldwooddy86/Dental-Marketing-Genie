/* ==== m15_accounts ==== */
"use strict";
/* ============================ Module 15: Accounts ============================ */
registerModule({
  key: 'accounts', num: '15', title: 'Accounts', desc: 'Connect the paid and social accounts, pull what they actually did, and let the actuals correct the models',
  mount(root) {
    const st = { range: (ACCT.settings() || {}).range || 30, hourLine: 'all', confirm: {} };
    const ENVN = { chrome: 'the Chrome browser app', firefox: 'the Firefox browser app', viewer: 'the Claude viewer', file: 'a downloaded file' };
    const PB = { google: 'p-google', lsa: 'p-lsa', meta: 'p-meta', microsoft: 'p-microsoft', linkedin: 'p-site', youtube: 'p-youtube', facebook: 'p-meta', instagram: 'p-meta', gbp: 'p-google', linkedinpage: 'p-site', calls: 'p-site', other: 'p-site', nextdoor: 'p-nextdoor', yelp: 'p-yelp' };
    const badge = s => `<span class="pbadge ${PB[s] || 'p-site'}">${esc(s)}</span>`;
    const money = v => isN(v) ? '$' + N(Math.round(v)) : '—';
    const money2 = v => isN(v) ? '$' + D(v, 2) : '—';
    root.innerHTML = mastHTML({ eyebrow: 'Module 15 · Accounts · Google Ads, Local Services Ads, Meta, Microsoft Advertising, LinkedIn, YouTube, Business Profile, imports', title: 'Accounts', dek: 'Every other module estimates. This one measures. Connect the business\'s own ad and social accounts, or drop in the reports they export, and the atlas reads what the campaigns actually did: spend, clicks, leads and calls by service line, by hour of the day, by ZIP, and against the month\'s plan. Then, with one click, the observed cost per click, conversion rate and lead costs replace the assumptions in the service line model and the weather desk\'s hour by hour plan runs on the account\'s real hours.',
      meta: [`<b>Runs in</b> ${ENVN[ACCT.ENV] || ACCT.ENV}`, '<b>Storage</b> this browser only; nothing leaves it', '<b>Providers</b> Google, Meta, Microsoft, LinkedIn', '<b>Imports</b> Google Ads, Meta, Microsoft, LSA, call tracking, generic CSV'],
      bar: 'Accounts', barsub: 'Connectors, actuals, model feedback', actions: [{ id: 'a15Sync', label: '↻ Sync connected', title: 'Pull the selected range from every connected account' }, { id: 'a15CSV', label: '↓ Actuals CSV' }, { id: 'a15JSON', label: '↓ Actuals JSON' }, { id: 'a15Tmpl', label: '↓ Import template' }, { id: 'a15Weather', label: 'Weather Desk ↗' }, { id: 'a15Desk', label: 'Campaign Desk ↗' }] }) +
      `<div class="wrap">
      <div id="a15Env"></div>
      <div class="kpis" id="a15Kpis"></div>
      <div class="card mt"><div class="card-h" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1"><h3>Connectors</h3><p>Each card holds the developer credentials the business creates in its own consoles, the account identifiers, and the connection. Credentials and tokens stay in this browser's storage. Connect runs the provider's own sign in window; Paste token takes a token generated elsewhere (a Meta system user token, a Google OAuth Playground token) and works even when this page is opened as a file.</p></div><div class="ctl"><label class="fl">Range</label><div class="seg" id="a15Range"><button data-v="30" aria-pressed="${st.range === 30}">30 days</button><button data-v="90" aria-pressed="${st.range === 90}">90 days</button></div></div></div>
        <div class="card-b"><div class="conns" id="a15Conn"></div></div></div>
      <div class="split">
        <div class="card"><div class="card-h"><h3>Bring in a report</h3><p>Drop or paste the export an ad platform produces. Google Ads (campaign or hour of day report), Meta Ads Manager (with or without the time of day breakdown), Microsoft Advertising, Local Services Ads leads, CallRail or CTM call logs, and a generic date, campaign, spend, leads sheet for Nextdoor, Yelp, TikTok or mailers. Campaign names that carry the desk token (DFW_REPAIR_, DFW_REPLACE_ and so on) map to lines automatically; the rest are matched by keyword.</p></div>
          <div class="card-b"><div class="drop" id="a15Drop" tabindex="0" role="button">Drop a CSV here or click to choose</div><input type="file" id="a15File" accept=".csv,.txt,text/csv" hidden>
          <div class="plan" style="margin-top:10px"><div class="f"><label class="fl" for="a15Imp">Format</label><select id="a15Imp"><option value="">Detect from the columns</option>${ACCT.IMPORTERS.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select></div><div class="f"><label class="fl" for="a15Src">Source label (optional)</label><input type="text" id="a15Src" placeholder="nextdoor, yelp, tiktok, mailer"></div></div>
          <textarea id="a15Paste" class="code" style="min-height:110px;margin-top:10px" placeholder="Or paste the CSV text here"></textarea>
          <div class="cact" style="margin-top:8px"><button class="btn" id="a15ImpBtn">Import</button><button class="btn sec" id="a15ImpTmpl">Template CSV</button><button class="btn ghost" id="a15ClearA">Clear all actuals</button><button class="btn ghost" id="a15ClearT">Clear tokens</button></div>
          <div class="status" id="a15ImpLog" style="margin-top:10px">No imports yet.</div></div></div>
        <div class="card"><div class="card-h"><h3>Month to date against the plan</h3><p>Paid spend this calendar month from every source held, the daily rate, where the month lands at that rate, and how that compares with the Campaign Desk budget.</p></div><div class="card-b" id="a15Pace"></div></div>
      </div>
      <div class="card mt"><div class="card-h" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1"><h3>Actuals against the model, by service line</h3><p>What each line cost and returned in the selected range, next to what the service line model assumes. Apply writes the observed cost per click, conversion rate and Meta and LSA lead costs into the model (module 12, the Campaign Desk and the allocation all move); Revert restores the assumptions that were there.</p></div><div class="cact"><button class="btn" id="a15Apply">Apply actuals to the models</button><button class="btn sec" id="a15Revert">Revert</button></div></div>
        <div class="card-b"><div class="tscroll" id="a15Lines"></div><p class="mini" id="a15AppliedN" style="margin-top:8px"></p></div></div>
      <div class="split">
        <div class="card"><div class="card-h" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1"><h3>Hour of the day</h3><p>Share of leads and spend by hour from the hourly rows held (Google hour segments, Meta time of day, LSA lead timestamps), against the emergency daypart template the plan uses until it has better.</p></div><label class="chk"><input type="checkbox" id="a15UseObs"> Run the weather desk plan on the observed hours</label></div>
          <div class="card-b"><div id="a15HourChart"></div><p class="chartnote" id="a15HourN"></p></div></div>
        <div class="card"><div class="card-h"><h3>Where the money landed</h3><p>Spend and cost per lead by ZIP from the Google geographic view and any import with a postal code column, with the atlas's own read of each ZIP beside it. Meta reports region and DMA only.</p></div><div class="card-b"><div class="tscroll short" id="a15Zip"></div></div></div>
      </div>
      <div class="split">
        <div class="card"><div class="card-h"><h3>Social and profile</h3><p>Facebook Page reach and engagement, Instagram reach and followers, YouTube views and subscribers, Business Profile calls and direction requests, LinkedIn Page followers. Last thirty days against the thirty before.</p></div><div class="card-b"><div class="tscroll short" id="a15Social"></div></div></div>
        <div class="card"><div class="card-h"><h3>Lead log</h3><p>Local Services Ads leads and tracked calls, newest first, with the line each one was matched to and whether Google charged for it.</p></div><div class="card-b"><div class="tscroll short" id="a15Leads"></div></div></div>
      </div>
      ${card('How the module is built', '', '<ol class="meth" id="a15Meth"></ol>', 'mt')}
      <div class="split">${card('Judgment calls', '', '<div id="a15Judg"></div>')}${card('Source register', '', '<div id="a15Src2"></div>')}</div>
      <div class="foot">DFW Thermal Debt Atlas, module 15. Actuals beat assumptions; the module exists so the rest of the atlas can be corrected by the account it is planning for.</div></div>`;
    /* ---------- environment ---------- */
    async function env() {
      const host = $('#a15Env', root); const E = ACCT.ENV; const r = ACCT.redirectUrl();
      if (E === 'viewer') { host.innerHTML = callout('judg', 'Inside the Claude viewer: imports only', 'The viewer blocks every call the page would make to Google, Meta, Microsoft or LinkedIn, so the connector buttons are disabled here. Report imports work in full. Download the atlas file to use pasted tokens, or install the browser app (the ZIP that ships with this build) for sign in connections, background weather alerts and scheduled pulls.'); return; }
      if (E === 'file') { host.innerHTML = callout('note', 'Opened as a file: pasted tokens and imports', 'Sign in connections need the browser app, because a file has no registered redirect address. Pasted tokens work here for Meta (Graph API allows page calls) and for Google APIs that permit them; Microsoft and LinkedIn refuse calls from a file and need the app. Everything typed below stays in this browser\'s storage for this file.'); return; }
      let granted = await ACCT.hostsGranted();
      host.innerHTML = callout('note', `Running as ${ENVN[E]}`, `Sign in connections and API calls run from this page with the credentials below. <b>Redirect URL for every provider console:</b> <code class="mono">${esc(r || 'not available')}</code> <button class="btn sm sec" id="a15CopyR">Copy</button>${granted === false ? ` <div style="margin-top:8px">Firefox asks for permission to reach the provider and weather sites: <button class="btn sm" id="a15Hosts">Grant site access</button></div>` : ''}`);
      const cb = $('#a15CopyR', root); if (cb) cb.onclick = () => copyText(r, cb);
      const hb = $('#a15Hosts', root); if (hb) hb.onclick = async () => { const ok = await ACCT.requestHosts(); toast(ok ? 'Site access granted' : 'Site access not granted'); env(); };
    }
    /* ---------- KPIs ---------- */
    function kpis() {
      const bl = ACCT.byLine(st.range); const spend = sum(bl.map(o => o.spend)), leads = sum(bl.map(o => o.leads + o.calls)); const n = ACCT.rowsAll().length; const conn = ACCT.PORDER.filter(p => ACCT.status(p).state === 'connected').length;
      const fetched = Object.values(ACCT.S.actuals).map(a => a.fetched).filter(Boolean).sort().pop();
      const mapped = bl.filter(o => SLM.LI[o.line]); const modelCpl = (() => { const w = sum(mapped.map(o => o.spend)); if (!w) return null; return sum(mapped.map(o => { const b = SLM.blended(SLM.LI[o.line]); return (b.cpl || 0) * o.spend; })) / w; })();
      $('#a15Kpis', root).innerHTML = kpiHTML([
        { l: 'Accounts connected', v: `${conn} of ${ACCT.PORDER.length}`, d: ACCT.PORDER.map(p => `${ACCT.PROVIDERS[p].name}: ${ACCT.status(p).state}`).join(' · ') },
        { l: 'Rows of actuals held', v: N(n), d: fetched ? `last pull ${new Date(fetched).toLocaleString()}` : 'nothing pulled or imported yet' },
        { l: `Paid spend, ${st.range} days`, v: money(spend), d: bl.length ? `${bl.filter(o => SLM.LI[o.line]).length} lines mapped · ${bl.find(o => o.line === 'unmapped') ? money(bl.find(o => o.line === 'unmapped').spend) + ' unmapped' : 'all campaigns mapped'}` : 'connect an account or import a report' },
        { l: `Leads and calls, ${st.range} days`, v: N(Math.round(leads)), d: leads ? `blended cost per lead ${money(spend / leads)}` : '' },
        { l: 'Observed against model', v: leads && modelCpl ? S((spend / leads / modelCpl - 1) * 100, 0) + '%' : '—', d: modelCpl ? `model blended cost per lead ${money(modelCpl)} at the same mix` : 'cost per lead against the service line model' },
        { l: 'Model state', v: ACCT.settings().applied ? 'Actuals applied' : 'Assumptions', d: ACCT.settings().applied ? 'applied ' + new Date(ACCT.settings().applied.at).toLocaleString() : 'module 12 defaults in force' },
      ]);
    }
    /* ---------- connectors ---------- */
    function connCard(p) {
      const P = ACCT.PROVIDERS[p], C = ACCT.cfg(p); const secret = k => /secret|token/i.test(k);
      return `<div class="conn" data-p="${p}"><div class="ch">${badge(p)} <b>${esc(P.name)}</b> <span class="pill" id="a15St-${p}"></span></div><p class="mini">${esc(P.long)}</p>
        <div class="plan">${P.fields.map(([k, l]) => `<div class="f"><label class="fl" for="a15F-${p}-${k}">${esc(l)}</label><input type="${secret(k) ? 'password' : 'text'}" id="a15F-${p}-${k}" data-k="${k}" value="${esc(C[k] || '')}" autocomplete="off" spellcheck="false"></div>`).join('')}</div>
        <div class="cact"><button class="btn sm sec" data-a="save">Save</button><button class="btn sm" data-a="connect" ${ACCT.ENV === 'viewer' || ACCT.ENV === 'file' ? 'disabled title="Needs the browser app"' : ''}>Connect</button><button class="btn sm sec" data-a="test" ${ACCT.ENV === 'viewer' ? 'disabled' : ''}>Test</button><button class="btn sm sec" data-a="pull" ${ACCT.ENV === 'viewer' ? 'disabled' : ''}>Sync ${st.range} days</button><button class="btn sm ghost" data-a="disconnect">Disconnect</button></div>
        <details class="cdet"><summary>Paste a token instead</summary><div class="plan" style="margin-top:8px"><div class="f wide"><label class="fl" for="a15T-${p}">Access token</label><input type="password" id="a15T-${p}" autocomplete="off"></div><div class="f"><label class="fl" for="a15TH-${p}">Valid for (hours)</label><input type="number" id="a15TH-${p}" value="${p === 'meta' ? 1440 : 1}" min="1"></div><div class="f" style="justify-content:flex-end"><button class="btn sm" data-a="paste">Use this token</button></div></div></details>
        <details class="cdet"><summary>What it covers and how to set it up</summary><p class="mini" style="margin:8px 0">${esc(P.covers)}</p><ol class="steps" style="margin-top:6px">${P.setup.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="mini">Scopes requested: <code class="mono">${esc(P.scopes.join(' '))}</code></p></details>
        <div class="status" id="a15Log-${p}" hidden></div></div>`;
    }
    function conns() {
      $('#a15Conn', root).innerHTML = ACCT.PORDER.map(connCard).join('');
      $$('#a15Conn .conn', root).forEach(cardEl => { const p = cardEl.dataset.p; $$('button[data-a]', cardEl).forEach(b => b.onclick = () => act(p, b.dataset.a, cardEl)); });
      connStatus();
    }
    function connStatus() { ACCT.PORDER.forEach(p => { const s = ACCT.status(p); const pill = $(`#a15St-${p}`, root); if (pill) { pill.textContent = s.label; pill.className = 'pill st-' + s.state; } const a = ACCT.S.actuals[p]; const ael = $(`.conn[data-p="${p}"] .cact`, root); if (ael) ael.title = a ? `Last sync ${new Date(a.fetched).toLocaleString()} · ${a.rows.length} rows` : ''; }); }
    const log = (p, msg, isErr) => { const h = $(`#a15Log-${p}`, root); if (!h) return; h.hidden = false; h.style.color = isErr ? 'var(--critical)' : ''; h.textContent = `${new Date().toLocaleTimeString()} ${msg}`; };
    async function act(p, a, cardEl) {
      const P = ACCT.PROVIDERS[p];
      const readFields = () => { const patch = {}; $$('input[data-k]', cardEl).forEach(i => patch[i.dataset.k] = i.value.trim()); return patch; };
      try {
        if (a === 'save') { await ACCT.setCfg(p, readFields()); log(p, 'Saved in this browser.'); toast(`${P.name} settings saved`); }
        if (a === 'connect') { await ACCT.setCfg(p, readFields()); log(p, 'Opening the sign in window…'); await ACCT.connect(p); log(p, 'Connected. Test, then Sync.'); toast(`${P.name} connected`); }
        if (a === 'paste') { const t = $(`#a15T-${p}`, cardEl).value.trim(); if (!t) throw new Error('Paste a token first'); await ACCT.setCfg(p, readFields()); await ACCT.pasteToken(p, t, +$(`#a15TH-${p}`, cardEl).value || 1); $(`#a15T-${p}`, cardEl).value = ''; log(p, 'Token stored. Test, then Sync.'); }
        if (a === 'test') { log(p, 'Testing…'); const r = await ACCT.test(p); log(p, r); }
        if (a === 'pull') { log(p, `Pulling ${st.range} days…`); const r = await ACCT.pull(p, st.range); log(p, `${r.rows.length} rows for ${r.range.since} to ${r.range.until}.${(r.notes || []).length ? ' Notes: ' + r.notes.join(' | ') : ''}`); toast(`${P.name}: ${r.rows.length} rows`); }
        if (a === 'disconnect') { await ACCT.disconnect(p); log(p, 'Token removed; settings kept.'); }
      } catch (e) { log(p, e.message || String(e), true); toast(`${P.name}: ${e.message || e}`); }
      connStatus();
    }
    /* ---------- imports ---------- */
    function impLog() { const im = (ACCT.S.imports || []).slice(-8).reverse(); $('#a15ImpLog', root).textContent = im.length ? im.map(x => `${new Date(x.at).toLocaleString()}  ${x.importer}  ${x.n} rows`).join('\n') : 'No imports yet.'; }
    function doImport(text) { if (!text || !text.trim()) { toast('Nothing to import'); return; } const r = ACCT.importCSV(text, $('#a15Imp', root).value || null, $('#a15Src', root).value.trim() || null); toast(r.note); if (!r.rows.length) { $('#a15ImpLog', root).textContent = r.note + '\n' + $('#a15ImpLog', root).textContent; } }
    const readTextFile = f => new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result || '')); rd.onerror = rej; rd.readAsText(f); });
    $('#a15Drop', root).onclick = () => $('#a15File', root).click(); $('#a15Drop', root).onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#a15File', root).click(); } };
    $('#a15Drop', root).ondragover = e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }; $('#a15Drop', root).ondragleave = e => { e.currentTarget.style.borderColor = ''; };
    $('#a15Drop', root).ondrop = async e => { e.preventDefault(); e.currentTarget.style.borderColor = ''; for (const f of Array.from(e.dataTransfer.files || [])) doImport(await readTextFile(f)); };
    $('#a15File', root).onchange = async e => { for (const f of Array.from(e.target.files || [])) doImport(await readTextFile(f)); e.target.value = ''; };
    $('#a15ImpBtn', root).onclick = () => { doImport($('#a15Paste', root).value); $('#a15Paste', root).value = ''; };
    $('#a15ImpTmpl', root).onclick = () => saveFile('atlas-import-template.csv', ACCT.templateCSV());
    const twoStep = (id, label, fn) => { const b = $('#' + id, root); b.onclick = async () => { if (st.confirm[id]) { st.confirm[id] = false; b.textContent = label; await fn(); } else { st.confirm[id] = true; b.textContent = 'Click again to confirm'; setTimeout(() => { st.confirm[id] = false; b.textContent = label; }, 4000); } }; };
    twoStep('a15ClearA', 'Clear all actuals', async () => { await ACCT.clearAll('actuals'); toast('Actuals cleared'); });
    twoStep('a15ClearT', 'Clear tokens', async () => { await ACCT.clearAll('tokens'); toast('Tokens cleared'); });
    /* ---------- pacing ---------- */
    function pace() {
      const desk = store.get('tda.desk.v1', {}) || {}; const plan = +desk.budget || SLM.A.budget; const p = ACCT.pacing(plan);
      if (!p.days) { $('#a15Pace', root).innerHTML = `<p class="mini">No paid rows for this month yet. The Campaign Desk plan is ${money(plan)} a month; once an account is synced or a report imported this shows spend to date, the run rate and the landing point.</p>`; return; }
      const pace = p.onPace; const col = pace == null ? 'var(--ink-3)' : pace > 1.15 ? 'var(--critical)' : pace < 0.85 ? 'var(--warning)' : 'var(--good)';
      $('#a15Pace', root).innerHTML = `<div class="qbox"><div class="qb"><div class="qt">Spent this month</div><div class="qv">${money(p.spend)}</div><div class="qd">through day ${p.day} of ${p.dim} · ${p.days} days with rows</div></div><div class="qb"><div class="qt">Daily rate</div><div class="qv">${money(p.rate)}</div><div class="qd">plan ${money(plan / p.dim)} a day</div></div><div class="qb"><div class="qt">Lands at</div><div class="qv">${money(p.projected)}</div><div class="qd">plan ${money(plan)} · ${S((p.projected / plan - 1) * 100, 0)}%</div></div><div class="qb"><div class="qt">Pace</div><div class="qv" style="color:${col}">${pace != null ? D(pace * 100, 0) + '%' : '—'}</div><div class="qd">${pace == null ? '' : pace > 1.15 ? 'ahead of plan: trim the evening bids or the weakest line' : pace < 0.85 ? 'behind plan: budgets are capping or the auction is thin' : 'on plan'}</div></div></div>
        <div class="dsec">By platform</div><table><thead><tr><th class="l">Source</th><th>Spend</th><th>Share</th></tr></thead><tbody>${Object.entries(p.bySrc).sort((a, b) => b[1] - a[1]).map(([s, v]) => `<tr><td class="l">${badge(s)}</td><td>${money(v)}</td><td>${P(100 * v / (p.spend || 1), 0)}</td></tr>`).join('')}</tbody></table>`;
    }
    /* ---------- lines ---------- */
    function lines() {
      const bl = ACCT.byLine(st.range); const host = $('#a15Lines', root);
      if (!bl.length) { host.innerHTML = '<p class="mini">No paid rows in the range. Sync an account or import a report; the table fills by service line.</p>'; $('#a15AppliedN', root).textContent = ''; return; }
      const rows = bl.map(o => { const L = SLM.LI[o.line]; const Ln = L ? SLM.A.lines[o.line] : null; const b = L ? SLM.blended(L) : null; return { o, L, name: L ? L.short : (o.line === 'unmapped' ? 'Unmapped campaigns' : o.line), mCpl: b ? b.cpl : null, mCpc: Ln ? SLM.A.cpc * Ln.cpcMult : null, mCvr: Ln ? Ln.cvr : null }; });
      const dev = (a, m) => (isN(a) && isN(m) && m) ? `<span class="mini" style="color:${a > m * 1.15 ? 'var(--critical)' : a < m * 0.85 ? 'var(--good)' : 'var(--ink-3)'}">${S((a / m - 1) * 100, 0)}%</span>` : '';
      host.innerHTML = `<table><thead><tr><th class="l">Line</th><th>Spend</th><th>Clicks</th><th>Leads + calls</th><th>CPL actual</th><th>CPL model</th><th>CPC actual</th><th>CPC model</th><th>CVR actual</th><th>CVR model</th><th class="l">Platforms</th></tr></thead><tbody>${rows.map(r => `<tr><td class="l"><b>${esc(r.name)}</b></td><td>${money(r.o.spend)}</td><td>${N(r.o.clicks)}</td><td>${N(Math.round(r.o.leads + r.o.calls))}</td><td>${money(r.o.cpl)} ${dev(r.o.cpl, r.mCpl)}</td><td>${money(r.mCpl)}</td><td>${money2(r.o.cpc)} ${dev(r.o.cpc, r.mCpc)}</td><td>${money2(r.mCpc)}</td><td>${isN(r.o.cvr) ? P(r.o.cvr, 1) : '—'}</td><td>${isN(r.mCvr) ? P(r.mCvr, 1) : '—'}</td><td class="l">${Object.entries(r.o.byPlat).sort((a, b) => b[1].spend - a[1].spend).map(([s, v]) => `${badge(s)} <span class="mini">${money(v.spend)}${(v.leads + v.calls) ? ' · ' + N(Math.round(v.leads + v.calls)) + ' leads' : ''}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table><p class="mini" style="margin-top:6px">Unmapped campaigns carry no desk token and no line keyword in their name; rename them in the platform or import with a source label so the model can use them. Model CPL is the blended figure module 12 computes for the line's platform fit; model CPC is the atlas search CPC times the line's multiplier.</p>`;
      const ap = ACCT.settings().applied; $('#a15AppliedN', root).innerHTML = ap ? `Applied ${new Date(ap.at).toLocaleString()}: ${ap.patch.cpc ? `search CPC ${money2(ap.prev.cpc)} → ${money2(ap.patch.cpc)}; ` : ''}${Object.entries(ap.patch.lines).map(([l, v]) => `${esc(SLM.lineName(l))} ${Object.entries(v).map(([k, x]) => `${k} ${k === 'cvr' ? P(x, 1) : money(x)}`).join(', ')}`).join('; ') || 'no line had enough volume to change'}.` : 'Apply needs at least 50 clicks and 3 leads on a platform for a line before it changes that line; search CPC changes when any Google or Microsoft spend is held.';
    }
    /* ---------- hours ---------- */
    function hours() {
      const H = ACCT.byHour(st.range); const has = H.some(x => x.n); const tpl = SLM.DAYPARTS.emergency[0]; const blockOf = hr => hr < 6 ? 0 : hr < 9 ? 1 : hr < 12 ? 2 : hr < 17 ? 3 : hr < 21 ? 4 : 5; const m = H.map(x => 1 + (tpl[blockOf(x.h)] || 0) / 100); const mt = sum(m); const tplSh = m.map(v => 100 * v / mt);
      const cats = H.map(x => NWSX.hh(x.h)); const ser = [{ name: 'Template share (emergency)', color: cssv('--ink-3'), values: tplSh, fmt: v => D(v, 1) + '%' }];
      if (has) ser.unshift({ name: 'Lead share', color: cssv('--heat'), values: H.map(x => x.leadSh), fmt: v => D(v, 1) + '%' }, { name: 'Spend share', color: cssv('--cool'), values: H.map(x => x.spendSh), fmt: v => D(v, 1) + '%' });
      barChart($('#a15HourChart', root), { H: 260, cats, series: ser, fmt: v => D(v, 0) + '%', maxLabels: 12, aria: 'Lead and spend share by hour', tipExtra: i => has && H[i].cpl != null ? tipRow('Cost per lead', money(H[i].cpl)) : '' });
      const peak = has ? H.slice().sort((a, b) => b.leadSh - a.leadSh).slice(0, 3) : [];
      $('#a15HourN', root).innerHTML = legendRow(ser.map(s => ({ name: s.name, color: s.color }))) + (has ? `${N(sum(H.map(x => x.n)))} hourly rows in the range. Lead share peaks at ${peak.map(x => NWSX.hh(x.h)).join(', ')}. ${ACCT.settings().useObserved ? 'The weather desk plan is running on these hours.' : 'Tick the box above and the weather desk plan replaces its template with these hours.'}` : 'No hourly rows yet. Google Ads sync brings hour segments, Meta sync brings the time of day breakdown, and LSA leads carry timestamps; a Google Ads hour of day report import works too.');
      const cb = $('#a15UseObs', root); cb.checked = !!ACCT.settings().useObserved; cb.disabled = !has;
    }
    /* ---------- zips ---------- */
    function zips() {
      const rows = ACCT.byZip(90); const host = $('#a15Zip', root);
      if (!rows.length) { host.innerHTML = '<p class="mini">No ZIP rows yet. The Google sync pulls the geographic view (spend by matched postal code); imports with a postal code column land here as well.</p>'; return; }
      host.innerHTML = `<table><thead><tr><th class="l">ZIP</th><th class="l">City</th><th>Spend</th><th>Clicks</th><th>Leads</th><th>CPL</th><th class="l">Atlas read</th></tr></thead><tbody>${rows.slice(0, 60).map(r => `<tr><td class="l"><b>${esc(r.zip)}</b></td><td class="l">${esc(r.z ? r.z.city : '')}</td><td>${money(r.spend)}</td><td>${N(r.clicks)}</td><td>${N(Math.round(r.leads))}</td><td>${money(r.cpl)}</td><td class="l mini">${r.z ? `${esc(SLM.lineName(r.z.sl_top))} first · ${esc(r.z.cty)}` : 'outside the twelve counties'}</td></tr>`).join('')}</tbody></table>${rows.length > 60 ? `<p class="mini">${rows.length - 60} more ZIPs in the CSV export.</p>` : ''}`;
    }
    /* ---------- social ---------- */
    function social() {
      const so = ACCT.social(60); const host = $('#a15Social', root); const keys = Object.keys(so);
      if (!keys.length) { host.innerHTML = '<p class="mini">No social or profile rows yet. The Google sync brings YouTube and Business Profile when their IDs are set; the Meta sync brings Page and Instagram insights.</p>'; return; }
      const cut = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })();
      const LBL = { page_impressions_unique: 'Page reach', page_post_engagements: 'Post engagements', page_fans: 'Page likes', reach: 'Reach', follower_count: 'New followers', 'YouTube channel': 'Views', CALL_CLICKS: 'Calls from the profile', WEBSITE_CLICKS: 'Website clicks', BUSINESS_DIRECTION_REQUESTS: 'Direction requests', BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'Maps impressions (mobile)', BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'Search impressions (mobile)', followers: 'Followers' };
      const rows = []; keys.forEach(src => { const by = {}; so[src].forEach(r => { const k = r.campaign; const o = by[k] = by[k] || { src, k, a: 0, b: 0 }; const v = r.imp || r.conv || r.msgs || r.calls || r.clicks || 0; if (r.date >= cut) o.a += v; else o.b += v; }); Object.values(by).forEach(o => rows.push(o)); });
      host.innerHTML = `<table><thead><tr><th class="l">Source</th><th class="l">Metric</th><th>Last 30 days</th><th>Prior 30</th><th>Change</th></tr></thead><tbody>${rows.map(o => `<tr><td class="l">${badge(o.src)}</td><td class="l">${esc(LBL[o.k] || o.k)}</td><td>${N(Math.round(o.a))}</td><td>${N(Math.round(o.b))}</td><td>${o.b ? S((o.a / o.b - 1) * 100, 0) + '%' : '—'}</td></tr>`).join('')}</tbody></table>`;
    }
    /* ---------- leads ---------- */
    function leads() {
      const rows = ACCT.rowsAll('lead').sort((a, b) => (b.date + String(b.hour || 0).padStart(2, '0')).localeCompare(a.date + String(a.hour || 0).padStart(2, '0'))).slice(0, 60); const host = $('#a15Leads', root);
      if (!rows.length) { host.innerHTML = '<p class="mini">No lead rows yet. The Google sync pulls Local Services leads; call tracking and LSA exports import from the panel above.</p>'; return; }
      host.innerHTML = `<table><thead><tr><th class="l">When</th><th class="l">Source</th><th class="l">Job type or campaign</th><th class="l">Line</th><th class="l">Type</th><th class="l">Status</th></tr></thead><tbody>${rows.map(r => `<tr><td class="l">${esc(r.date)}${r.hour != null ? ' ' + NWSX.hh(r.hour) : ''}</td><td class="l">${badge(r.src)}</td><td class="l">${esc(r.campaign)}</td><td class="l">${esc(SLM.lineName(r.line || 'repair'))}</td><td class="l">${r.calls ? 'Call' : r.msgs ? 'Message' : 'Lead'}</td><td class="l mini">${r.conv ? 'Charged' : ''} ${esc(r.note || '')}</td></tr>`).join('')}</tbody></table>`;
    }
    /* ---------- method, judgment, sources ---------- */
    $('#a15Meth', root).innerHTML = [
      '<b>Where it runs.</b> The page detects its host: the Chrome or Firefox browser app (extension runtime present), a downloaded file, or the Claude viewer. Sign in connections use the browser identity API and need the app; pasted tokens work wherever the provider allows page calls; imports work everywhere.',
      '<b>Connections.</b> Google, Microsoft and LinkedIn use the authorization code flow (PKCE where the provider supports it) against the business\'s own OAuth client; Meta uses the token flow of Facebook Login for Business. Refresh tokens are used when granted. Tokens and credentials live in extension storage or this browser\'s local storage and never leave it.',
      '<b>Pulls.</b> Google Ads API v21 (campaign by day and hour, geographic view by postal code, Local Services leads), YouTube Analytics v2, Business Profile Performance; Meta Marketing API v21 (ad set by day, campaign by hour of the advertiser time zone, region), Page and Instagram insights; Microsoft Advertising Reporting v13 (hourly campaign performance, zipped CSV unpacked in the page); LinkedIn adAnalytics by campaign and Page follower statistics.',
      '<b>Normalization.</b> Every source becomes rows of date, hour, campaign, ad set, geography, impressions, clicks, spend, leads, calls, messages and conversions, tagged with a service line from the campaign name (desk token first, keywords second).',
      '<b>Feedback.</b> Apply computes search CPC from Google and Microsoft rows, and per line the Google conversion rate (50 clicks and 3 leads minimum), Meta cost per lead and LSA cost per lead (3 leads minimum), and writes them into the service line model. The weather desk can run on the observed hour of day distribution (90 days of hourly rows, six blocks, rounded to 5%).',
      '<b>Imports.</b> A CSV parser that handles quoted fields, a header finder that skips report preambles, and column maps for the Google Ads, Meta, Microsoft, LSA, call tracking and generic formats; ZIPs are read from any postal code column.',
    ].map(x => `<li>${x}</li>`).join('');
    $('#a15Judg', root).innerHTML = judgList([['Credentials belong to the business', 'The module carries no developer credentials of its own. Each provider needs an app or client created in the business\'s console and, for accounts outside that app\'s own business, the provider\'s review. The setup steps on each card are the shortest path; Meta in development mode and Google in testing mode connect the business\'s own accounts without review.'], ['Secrets in browser storage', 'Google and LinkedIn issue a client secret for web clients; it is stored here so the token exchange can run from the page. Anyone with this browser profile can read it. Clear tokens and the settings when the machine changes hands.'], ['Meta has no ZIP', 'Meta reports region and DMA at best. ZIP level cost per lead comes from Google alone; the Meta line figures are metro wide.'], ['Feedback is deliberately conservative', 'Thresholds keep a lucky week from rewriting the model. Below them the assumptions stand and the table shows the gap.'], ['Provider APIs move', 'Version numbers are pinned (Google Ads v21, Graph v21.0, LinkedIn 202509, Microsoft v13). When a provider retires one, the Test button reports it and the pull notes carry the message.']]);
    $('#a15Src2', root).innerHTML = srcRows([['Google Ads API', 'Reporting with GAQL, geographic view, Local Services leads', 'A', 'v21', 'https://developers.google.com/google-ads/api/docs/start'], ['Meta Marketing API', 'Insights, breakdowns, Page and Instagram insights', 'A', 'v21.0', 'https://developers.facebook.com/docs/marketing-api/insights'], ['Microsoft Advertising API', 'Reporting REST, campaign performance', 'A', 'v13', 'https://learn.microsoft.com/en-us/advertising/reporting-service/reporting-service-reference'], ['LinkedIn Marketing API', 'adAnalytics, organization follower statistics', 'A', '202509', 'https://learn.microsoft.com/en-us/linkedin/marketing/'], ['YouTube Analytics API', 'Channel reports', 'A', 'v2', 'https://developers.google.com/youtube/analytics'], ['Business Profile Performance API', 'Daily metrics time series', 'A', 'v1', 'https://developers.google.com/my-business/reference/performance/rest'], ['Browser extension identity', 'launchWebAuthFlow and getRedirectURL (Chrome, Firefox)', 'A', 'MV3', 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/identity']]);
    /* ---------- wiring ---------- */
    function renderData() { kpis(); connStatus(); impLog(); pace(); lines(); hours(); zips(); social(); leads(); }
    function renderAll() { env(); conns(); renderData(); }
    wireSeg($('#a15Range', root), v => { st.range = +v; ACCT.setSettings({ range: st.range }); $$('#a15Conn button[data-a="pull"]', root).forEach(b => b.textContent = `Sync ${st.range} days`); renderData(); });
    $('#a15UseObs', root).onchange = e => { ACCT.setSettings({ useObserved: e.target.checked }); toast(e.target.checked ? 'Weather desk plan now runs on observed hours' : 'Weather desk plan back on the template'); };
    $('#a15Apply', root).onclick = () => { const patch = ACCT.applyToModels(); const n = Object.keys(patch.lines).length + (patch.cpc ? 1 : 0); toast(n ? `Applied: ${n} model inputs changed` : 'Not enough volume to change any input'); renderData(); };
    $('#a15Revert', root).onclick = () => { if (!ACCT.settings().applied) { toast('Nothing applied'); return; } ACCT.revertModels(); toast('Model assumptions restored'); renderData(); };
    $('#a15Sync', root).onclick = async () => { const ps = ACCT.PORDER.filter(p => ACCT.status(p).state === 'connected'); if (!ps.length) { toast('No connected accounts'); return; } for (const p of ps) await act(p, 'pull', $(`.conn[data-p="${p}"]`, root)); };
    $('#a15CSV', root).onclick = () => { const rows = ACCT.rowsAll(); if (!rows.length) { toast('No actuals held'); return; } saveFile(`actuals_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(['source', 'kind', 'date', 'hour', 'campaign', 'adset', 'zip', 'region', 'impressions', 'clicks', 'spend', 'leads', 'calls', 'messages', 'conversions', 'line', 'note'], rows.map(r => [r.src, r.kind, r.date, r.hour == null ? '' : r.hour, r.campaign, r.adset, r.geo && r.geo.zip || '', r.geo && r.geo.region || '', r.imp, r.clicks, +r.spend.toFixed(2), r.leads, r.calls, r.msgs, r.conv, r.line, r.note || '']), 'Normalized actuals from every connected account and import held in this browser.')); };
    $('#a15JSON', root).onclick = () => saveFile('actuals.json', JSON.stringify({ exported: new Date().toISOString(), actuals: ACCT.S.actuals, imports: ACCT.S.imports, settings: ACCT.settings() }));
    $('#a15Tmpl', root).onclick = () => saveFile('atlas-import-template.csv', ACCT.templateCSV());
    $('#a15Weather', root).onclick = () => goModule('weather', {}); $('#a15Desk', root).onclick = () => goModule('desk', {});
    BUS.on('acct', () => { if (root.isConnected) renderData(); }); BUS.on('theme', () => { if (root.isConnected) hours(); });
    renderAll(); ACCT.ready().then(() => { if (root.isConnected) renderAll(); });
    this.receive = p => { if (p && p.provider) { const c = $(`.conn[data-p="${p.provider}"]`, root); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
  }
});
