/* ==== m02_replace ==== */
"use strict";
/* ============================ Module 2: Replacement Wave (replacements and reinstalls) ============================ */
const WB = META.weib_all;
function weibS(t, lam, k) { return Math.exp(-Math.pow(Math.max(0, t) / lam, k)); }
function weibMRL(a, lam, k) { let s = 0; const dt = 0.05; for (let t = a; t < a + 80; t += dt) s += weibS(t + dt / 2, lam, k) * dt; return s / Math.max(1e-9, weibS(a, lam, k)); }
function weibH1(a, lam, k) { return 1 - weibS(a + 1, lam, k) / Math.max(1e-12, weibS(a, lam, k)); }
const SCN = { fit: { l: 'RECS fit', k: WB.AC_TX.k, rep: 'rep', first5: 'first5', fc: 'fc', d: `Shape fitted to RECS 2020 Texas (k = ${D(WB.AC_TX.k, 2)}). Respondent-reported ages flatten the curve, so this is the gentlest wave.` }, k3: { l: 'Engineering k = 3', k: 3, rep: 'rep_k3', first5: 'first5_k3', fc: 'fc_k3', d: 'Same mean life, steeper wear-out (Weibull shape 3), typical of compressor and motor failure data. Fewer early failures, a sharper first wave.' }, k4: { l: 'Steep k = 4', k: 4, rep: 'rep_k4', first5: 'first5_k4', fc: 'fc_k4', d: 'Same mean life, wear-out concentrated around years 12 to 20. The upper bound on how bunched the builder waves can be.' } };
registerModule({
  key: 'replace', num: '02', title: 'Replacement Wave', desc: 'Replacements and reinstalls, heating and cooling, forecast to 2035',
  mount(root) {
    const st = { layer: 'rep_per1k', sel: null, county: '', scn: 'fit', base: 13800, full: 83, mfFac: 0.55, rsfFac: 0.9 };
    const T = DATA.tickets;
    root.innerHTML = mastHTML({ eyebrow: 'Module 02 · Replacement Wave · replacements and reinstalls, heating and cooling', title: 'The Replacement Wave', dek: `Dallas Fort Worth permitted ${N(BOOM1)} single-family homes between 2000 and 2006 and another ${N(BOOM2)} between 2020 and 2024. Every one arrived with a builder's system on a clock. This tab turns the installed base into jobs: how many systems will be replaced in each ZIP this year and in each of the next ten, which of them are first replacements that no contractor owns yet, which become full reinstalls, and how they split between gas furnaces, heat pumps and electric air handlers.`,
      meta: [`<b>${N(META.rep)}</b> system replacements expected in 2026`, `<b>${N(META.first5)}</b> first replacements due 2026 to 2030`, `<b>${P(T.cls.system / T.n_all * 100, 0)}</b> of permitted jobs are full systems (Irving)`, `<b>Median ticket</b> ${M$(T.median)} (permit valuations)`],
      bar: 'Replacement Wave', barsub: 'Renewal model · three wear-out scenarios · 2026 to 2035',
      actions: [{ id: 'r2Csv', label: '↓ ZIP CSV' }, { id: 'r2Fc', label: '↓ Forecast CSV' }, { id: 'r2Desk', label: 'Campaign Desk ↗' }, { id: 'r2Forge', label: 'Site Forge ↗' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: replacement, reinstall, and what the model can see', `A <b>replacement</b> here is a system-level changeout in an existing home: the outdoor unit and matching indoor coil, the furnace or air handler, or all of it. A <b>reinstall</b> is the larger job: new equipment plus line set, pad, drain, thermostat and usually duct work or a new return, done because the original install was builder grade, the ducts are spent, hail took the coil, or the refrigerant change makes a partial swap impossible. The model counts replacements from equipment age alone (a renewal process on the ACS build-year mix, lifetimes fitted to RECS 2020 Texas). It cannot see which household calls whom. Reinstalls are a share of those replacements, and the evidence for that share is observed: <b>${P(T.cls.system / T.n_all * 100, 0)}</b> of ${N(T.n_all)} residential mechanical permits in Irving (February 2022 to February 2025) describe a full system, not a component. In this metro the replacement market is a system market.`)}
      <div class="kpis" id="r2Kpis"></div>
      <div class="controls">
        <div class="ctl"><label class="fl">Wear-out scenario</label><div class="seg" id="r2Scn"><button data-v="fit" aria-pressed="true">RECS fit</button><button data-v="k3" aria-pressed="false">Engineering k = 3</button><button data-v="k4" aria-pressed="false">Steep k = 4</button></div></div>
        <div class="ctl" style="flex:1 1 280px"><label class="fl" for="r2Layer">Map layer</label><select id="r2Layer"></select></div>
        <div class="ctl"><label class="fl" for="r2Cty">County</label><select id="r2Cty"><option value="">All 12 counties</option>${CO.map(c => `<option value="${c.fips}">${c.name}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="r2Base">Base full-system ticket ($)</label><input type="number" id="r2Base" value="13800" min="4000" max="40000" step="100" style="width:110px"></div>
        <div class="ctl"><label class="fl" for="r2Full">Full-system share (%)</label><input type="number" id="r2Full" value="83" min="10" max="100" step="1" style="width:80px"></div>
      </div>
      <p class="mini" id="r2ScnNote" style="margin-top:8px"></p>
      <div class="grid2">
        <div class="card mapcard"><div id="r2Map"></div><div class="legend" id="r2Leg"></div></div>
        <div class="stack"><div class="card"><div class="card-h"><h3 id="r2Name">Metro</h3><p id="r2Sub">Click a ZIP for its replacement ledger</p></div><div class="card-b" id="r2Detail"></div></div></div>
      </div>
      <div class="split">
        ${card('The ten-year wave, existing stock', 'Expected system replacements per year, 2026 to 2035, for homes standing today (no new construction added). Three wear-out scenarios with the same mean life.', '<div id="r2FcLeg"></div><div id="r2FcChart"></div><p class="chartnote" id="r2FcNote"></p>')}
        ${card('Where the waves come from', 'Single-family permits by year across the 12 counties (Census BPS), with the share of each year\'s homes still on their original system today.', '<div id="r2CohLeg"></div><div id="r2Coh"></div><p class="chartnote" id="r2CohNote"></p>')}
      </div>
      <div class="split">
        ${card('Heating and cooling: what gets replaced', 'Expected 2026 system replacements by heating configuration and by who decides, with furnace-only and air handler jobs on top.', '<div id="r2Mix"></div>')}
        ${card('What a job is worth', `Declared valuations on ${N(T.n)} full-system residential permits, Irving, 2022 to 2025. Median ${M$(T.median)}, middle half ${M$(T.p25)} to ${M$(T.p75)}.`, '<div id="r2Tick"></div><div id="r2TickTbl" style="margin-top:10px"></div>')}
      </div>
      <div class="split">
        ${card('Reinstall signals', 'Where a changeout tends to become a full reinstall. Four observable drivers, ranked ZIPs, and the refrigerant rule that turned partial swaps into matched systems.', '<div id="r2Rein"></div>')}
        ${card('Repair or replace: the conversation at the door', 'Weibull lifetimes answer the homeowner\'s question with numbers. Change any input; everything recalculates.', '<div id="r2Calc"></div>')}
      </div>
      <div class="split">
        ${card('When replacements happen', 'Seasonal index of permitted changeouts (100 = average month). Fort Worth 2012 to 2026 and Dallas 2018 to 2020.', '<div id="r2SeasLeg"></div><div id="r2Seas"></div><p class="chartnote" id="r2SeasNote"></p>')}
        ${card('Observed against modeled, Fort Worth', 'Standalone mechanical permits a year (2016 to 2025) against modeled replacements in the Fort Worth part of each ZIP. ZIPs at least 85% inside the city.', '<div id="r2Obs"></div><p class="chartnote" id="r2ObsNote"></p>')}
      </div>
      <div class="card mt"><div class="card-h" style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap"><h3 style="flex:1;min-width:200px">Ranked ZIPs: <span id="r2TblN"></span></h3><label class="fl" for="r2Sort">Sort</label><select id="r2Sort"><option value="rep">Replacements 2026</option><option value="usd">Replacement dollars</option><option value="rep_per1k">Per 1,000 households</option><option value="first5">First replacements 2026 to 2030</option><option value="r22">R22 era systems</option><option value="furn20">Furnaces 20+ years</option><option value="rein">Reinstall signal</option></select></div><div class="tscroll" id="r2Tbl"></div></div>
      <div class="split">
        ${card('How the replacement model is built', 'The arithmetic, in order. Every step names its source and grade.', '<ol class="meth" id="r2Meth"></ol>')}
        ${card('Does the fitted lifetime match Texas?', 'RECS 2020 Texas central air conditioners: reported age bands by year built, against what the fitted renewal process predicts. Percent of each row.', '<div id="r2Fit"></div>')}
      </div>
      <div class="split">
        ${card('Judgment calls', 'Nine places where the model had to choose. Each is reversible from the controls above or stated so you can disagree with one number.', '<div id="r2Judg"></div>')}
        ${card('Caveats', '', '<div id="r2Cav"></div>')}
      </div>
      ${card('Source register', '', '<div id="r2Src"></div>', 'mt')}
      <div class="foot">DFW Thermal Debt Atlas, module 02. Replacement counts are expectations from a calibrated model of the installed base, not forecasts of any contractor's sales. Dollar figures multiply those counts by stated tickets you can change.</div></div>`;
    const S0 = () => SCN[st.scn];
    const tk = z => (z.ticket || 13800) * st.base / 13800;
    const usd = z => ((z.rep_ownsf || 0) * tk(z) + (z.rep_rentsf || 0) * tk(z) * st.rsfFac + (z.rep_mf || 0) * tk(z) * st.mfFac) * ((z[S0().rep] || 0) / Math.max(1e-9, z.rep || 0));
    const reinScore = z => { const p = (x, arr) => pctRank(arr, x); return (p(z.yb_duct, ZR.map(q => q.yb_duct)) * .3 + p(z.origwin_sh, ZR.map(q => q.origwin_sh)) * .35 + p(z.hail175_8km, ZR.map(q => q.hail175_8km)) * .2 + p(z.r22_sh, ZR.map(q => q.r22_sh)) * .15); };
    const REIN = {}; ZR.forEach(z => REIN[z.zip] = reinScore(z));
    const RL = {
      rep_per1k: { l: 'Replacements per 1,000 households, 2026', ramp: 'ember', f: v => D(v, 1), v: z => z[S0().rep] / z.occ * 1000, g: 'B' },
      rep: { l: 'System replacements expected, 2026 (count)', ramp: 'ember', f: v => N(v), v: z => z[S0().rep], g: 'B' },
      usd: { l: 'Replacement spend per year at stated tickets ($)', ramp: 'ember', f: v => MM(v), v: z => usd(z), g: 'C' },
      usdhh: { l: 'Replacement spend per household per year ($)', ramp: 'ember', f: v => M$(v), v: z => usd(z) / z.occ, g: 'C' },
      first5_per1k: { l: 'First replacements due 2026 to 2030 per 1,000 households', ramp: 'ember', f: v => D(v, 1), v: z => z[S0().first5] / z.occ * 1000, g: 'B' },
      origwin_sh: { l: 'Original builder systems aged 10 to 25 (%)', ramp: 'ember', f: v => P(v), v: z => z.origwin_sh, g: 'B' },
      ge15_sh: { l: 'Systems 15 years or older (%)', ramp: 'ember', f: v => P(v), v: z => z.ge15_sh, g: 'B' },
      r22_sh: { l: 'R22 era systems still running (%)', ramp: 'ember', f: v => P(v), v: z => z.r22_sh, g: 'B' },
      furn20_sh: { l: 'Gas furnaces 20 years or older (%)', ramp: 'ember', f: v => P(v), v: z => z.furn20_sh, g: 'B' },
      furn_rep: { l: 'Furnace replacements expected, 2026 (count)', ramp: 'ember', f: v => N(v), v: z => z.furn_rep, g: 'B' },
      hp_sh: { l: 'Heat pump share of systems (%)', ramp: 'blue', f: v => P(v), v: z => z.hp_sh, g: 'B' },
      rein: { l: 'Reinstall signal (percentile blend)', ramp: 'ember', f: v => D(v, 0), v: z => REIN[z.zip], g: 'C' },
      yb_duct: { l: 'Homes built 1980 to 1999, duct generation (%)', ramp: 'ember', f: v => P(v), v: z => z.yb_duct, g: 'A' },
      hail175_8km: { l: 'Hail 1.75 inch or larger within 8 km, per decade', ramp: 'ember', f: v => D(v, 1), v: z => z.hail175_8km, g: 'C' },
      rent_sf_sh: { l: 'Single-family homes that are rented (%)', ramp: 'teal', f: v => P(v), v: z => z.rent_sf_sh, g: 'A' },
    };
    $('#r2Layer', root).innerHTML = Object.entries(RL).map(([k, o]) => `<option value="${k}" ${k === st.layer ? 'selected' : ''}>${esc(o.l)}</option>`).join('');
    const map = new ZipMap($('#r2Map', root), { onSelect: z => { st.sel = st.sel === z ? null : z; render(); }, onHover: (zip, e) => { const z = ZI[zip]; if (!z || z.occ < 200) return; const o = RL[st.layer]; showTip(`<div class="tt">${z.zip} · ${esc(z.city)}</div><div class="ts">${esc(z.cty)} County · ${N(z.occ)} households</div>${tipRow(esc(o.l), o.f(o.v(z)))}${tipRow('Replacements 2026', N(z[S0().rep]))}${tipRow('First replacements 2026 to 2030', N(z[S0().first5]))}${tipRow('Replacement spend a year', MM(usd(z)))}<div class="tf">Click for the ledger</div>`, e); } });
    function kpis() {
      const s = S0(); const rep = sum(ZR.map(z => z[s.rep])); const first5 = sum(ZR.map(z => z[s.first5])); const $y = sum(ZR.map(usd)); const fc = META[s.fc]; const pk = fc.indexOf(Math.max(...fc));
      $('#r2Kpis', root).innerHTML = kpiHTML([
        { l: 'Replacements due, 2026', g: 'B', v: K(rep), d: `system level changeouts, ${S0().l.replace(/^Engineering /, 'engineering ').replace(/^Steep /, 'steep ')} scenario` },
        { l: 'Replacement spend', g: 'C', v: MM($y), d: `a year at a ${M$(st.base)} base ticket (size and value adjusted)` },
        { l: 'Full reinstalls', g: 'B', v: K(rep * st.full / 100), d: `at ${D(st.full, 0)}% full-system share (Irving permits: ${P(T.cls.system / T.n_all * 100, 0)})` },
        { l: 'First replacements', g: 'B', v: K(first5), d: 'original systems due 2026 to 2030: unowned customers' },
        { l: 'R22 era still running', g: 'B', v: K(META.r22), d: 'each one a replacement on its next leak' },
        { l: 'Furnace replacements', g: 'B', v: K(META.furn_rep), d: `a year, of ${N(META.furn)} gas furnaces; ${N(META.furn20)} are past 20` },
        { l: 'Peak of the decade', g: 'B', v: String(2026 + pk), d: `${N(fc[pk])} replacements that year from today's stock` },
        { l: 'Fort Worth permits 2026', g: 'A', v: S((META.fw_ytd['2026'] / META.fw_ytd['2025'] - 1) * 100, 0) + '%', d: `${N(META.fw_ytd['2026'])} through Sep 24 vs ${N(META.fw_ytd['2025'])} a year earlier` },
      ]);
      $('#r2ScnNote', root).textContent = S0().d;
    }
    function render() {
      kpis(); const o = RL[st.layer]; const vals = ZR.map(o.v); const sc = qScale(vals, o.ramp, 1);
      map.fill(zip => { const z = ZI[zip]; if (!z || z.occ < 200 || !isN(z.idx)) return null; return sc.f(o.v(z)); });
      map.dim(st.county ? new Set(Z.filter(z => z.fips === st.county).map(z => z.zip)) : null); map.select(st.sel);
      const v = vals.filter(isN);
      $('#r2Leg', root).innerHTML = legendHTML({ title: o.l, R: sc.R, lo: o.f(Math.min(...v)), hi: o.f(Math.max(...v)), note: `<b>Darker = more replacement work.</b> Quantile classes across 263 residential ZIPs. ${G(o.g)} ${st.layer.startsWith('rep') || st.layer.startsWith('first5') || st.layer === 'usd' || st.layer === 'usdhh' ? 'Scenario: ' + S0().l + '.' : ''}` });
      detail(); table(); charts();
    }
    function detail() {
      const z = st.sel ? ZI[st.sel] : null; const s = S0();
      if (!z || z.occ < 200) {
        const rows = ZR.filter(r => !st.county || r.fips === st.county); const rep = sum(rows.map(r => r[s.rep]));
        $('#r2Name', root).textContent = st.county ? CNAME(st.county) + ' County' : 'Dallas Fort Worth, 12 counties'; $('#r2Sub', root).textContent = 'Replacement ledger · click a ZIP';
        const g = sum(rows.map(r => r.rep_gas)), h = sum(rows.map(r => r.rep_hp)), e = sum(rows.map(r => r.rep_ef)), ow = sum(rows.map(r => r.rep_ownsf)), rs = sum(rows.map(r => r.rep_rentsf)), mf = sum(rows.map(r => r.rep_mf));
        $('#r2Detail', root).innerHTML = `<div class="big">${N(rep)}</div><div class="mini" style="margin-bottom:10px">system replacements expected in 2026 (${s.l})</div>
          <div class="dsec">By heating configuration</div>${hb('Gas furnace plus AC', g, rep, 'var(--heat)')}${hb('Heat pump', h, rep, 'var(--cool)')}${hb('Electric air handler plus AC', e, rep, 'var(--s4)')}
          <div class="dsec">By who decides</div>${hb('Owner, single-family', ow, rep, 'var(--accent)')}${hb('Landlord, single-family rental', rs, rep, 'var(--s7)')}${hb('Property manager, apartments', mf, rep, 'var(--ink-3)')}
          <div class="rowl" style="margin-top:8px"><span>Replacement spend a year</span><b>${MM(sum(rows.map(usd)))}</b></div><div class="rowl"><span>First replacements 2026 to 2030</span><b>${N(sum(rows.map(r => r[s.first5])))}</b></div><div class="rowl"><span>Gas furnaces past 20 · furnace jobs a year</span><b>${N(sum(rows.map(r => r.furn20)))} · ${N(sum(rows.map(r => r.furn_rep)))}</b></div>`;
        return;
      }
      $('#r2Name', root).textContent = `${z.zip} · ${z.city}`; $('#r2Sub', root).textContent = `${z.cty} County · ${N(z.occ)} households · built ${D(z.medyr, 0)} median`;
      const rep = z[s.rep]; const fc = z[s.fc] || []; const b = z.bands || []; const bt = sum(b) || 1;
      const sig = []; if (z.origwin_sh >= 15) sig.push('builder wave'); if (z.yb_duct >= 40) sig.push('duct generation'); if (z.hail175_8km >= 10) sig.push('large hail'); if (z.r22_sh >= 17) sig.push('R22 heavy'); if (z.furn20_sh >= 14.5) sig.push('old furnaces'); if (z.rent_sf_sh >= 35) sig.push('landlord owned'); if (z.own_recent_sh >= 25) sig.push('new owners');
      const mini = el('div'); lineChart(mini, { W: 420, H: 150, L: 44, B: 26, T: 10, series: [{ name: 'Replacements', color: cssv('--heat'), pts: fc.map((v, i) => [2026 + i, v]), area: true }], x: { ticks: [2026, 2028, 2030, 2032, 2035], fmt: v => v }, y: { fmt: v => N(v) }, aria: 'ten year forecast' });
      $('#r2Detail', root).innerHTML = `<div class="big">${N(rep)}</div><div class="mini">system replacements expected in 2026 · ${D(rep / z.occ * 1000, 1)} per 1,000 households</div>
        <div class="dsec">Ten-year forecast, this ZIP</div>${mini.innerHTML}
        <div class="dsec">By heating configuration</div>${hb('Gas furnace plus AC', z.rep_gas, z.rep, 'var(--heat)')}${hb('Heat pump', z.rep_hp, z.rep, 'var(--cool)')}${hb('Electric air handler plus AC', z.rep_ef, z.rep, 'var(--s4)')}
        <div class="dsec">By who decides</div>${hb('Owner, single-family', z.rep_ownsf, z.rep, 'var(--accent)')}${hb('Landlord, single-family rental', z.rep_rentsf, z.rep, 'var(--s7)')}${hb('Property manager, apartments', z.rep_mf, z.rep, 'var(--ink-3)')}
        <div class="dsec">The installed base</div>
        <div style="display:flex;height:12px;border-radius:3px;overflow:hidden;margin-top:4px">${b.map((x, i) => `<i title="${['0 to 4', '5 to 9', '10 to 14', '15 to 19', '20+'][i]} years: ${P(x / bt * 100, 0)}" style="display:block;flex:${x};background:${ramp('ember')[1 + i * 1.5 | 0]}"></i>`).join('')}</div><div class="rlabs"><span>0 to 4 yrs ${P(b[0] / bt * 100, 0)}</span><span>20+ yrs ${P(b[4] / bt * 100, 0)}</span></div>
        <div class="rowl"><span>First replacements 2026 to 2030</span><b>${N(z[s.first5])}</b></div>
        <div class="rowl"><span>Original builder systems aged 10 to 25</span><b>${P(z.origwin_sh, 1)}</b></div>
        <div class="rowl"><span>R22 era systems · gas furnaces 20+</span><b>${N(z.r22)} · ${N(z.furn20)}</b></div>
        <div class="rowl"><span>Ticket here (size and value adjusted)</span><b>${M$(tk(z))}</b></div>
        <div class="rowl"><span>Replacement spend a year</span><b>${MM(usd(z))}</b></div>
        <div class="rowl"><span>Full reinstalls at ${D(st.full, 0)}%</span><b>${N(rep * st.full / 100)}</b></div>
        <div style="margin-top:8px">${sig.length ? sig.map(x => `<span class="tag on">${x}</span>`).join('') : '<span class="mini">No reinstall signal above threshold</span>'}</div>
        ${isN(z.perm_cap) && z.perm_share >= .5 ? callout('note tight', 'Observed permits', `${esc(z.perm_city)} permits about ${N(z.perm_obs)} HVAC jobs a year here against ${N(z.perm_model)} modeled replacements in its city part (${P(z.perm_cap * 100, 0)} captured).`) : ''}`;
    }
    const hb = (l, v, t, c) => `<div class="rowl" style="border:0;padding:3px 0 0"><span>${l}</span><b>${N(v)} · ${P(v / Math.max(1, t) * 100, 0)}</b></div><div class="hbar"><i style="width:${clamp(v / Math.max(1, t) * 100, 0, 100)}%;background:${c}"></i></div>`;
    function table() {
      const rows = ZR.filter(z => !st.county || z.fips === st.county).map(z => ({ ...z, repS: z[S0().rep], first5S: z[S0().first5], usd: usd(z), rein: REIN[z.zip] }));
      const key = $('#r2Sort', root).value; const k = { rep: 'repS', first5: 'first5S', usd: 'usd', rep_per1k: 'rep_per1k', r22: 'r22', furn20: 'furn20', rein: 'rein' }[key];
      $('#r2TblN', root).textContent = `${rows.length} ZIPs`;
      const host = $('#r2Tbl', root); host._st = { k, dir: -1 };
      dataTable(host, [{ k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${v}</b>` }, { k: 'city', h: 'City', l: 1 }, { k: 'cty', h: 'County', l: 1 }, { k: 'repS', h: 'Repl. 2026', f: v => N(v) }, { k: 'rep_per1k', h: 'Per 1k', f: v => D(v, 1) }, { k: 'usd', h: 'Spend/yr', f: v => MM(v) }, { k: 'first5S', h: 'First 2026 to 30', f: v => N(v) }, { k: 'r22', h: 'R22 era', f: v => N(v) }, { k: 'furn20', h: 'Furn 20+', f: v => N(v) }, { k: 'hp_sh', h: 'HP %', f: v => D(v, 0) }, { k: 'rein', h: 'Reinstall', f: v => D(v, 0) }], rows, { id: r => r.zip, onClick: z => { st.sel = z; map.fitTo([z]); render(); }, rowClass: r => r.zip === st.sel ? 'sel' : '', limit: 400 });
    }
    function charts() {
      const cf = st.county; const rows = ZR.filter(z => !cf || z.fips === cf);
      const ser = ['fit', 'k3', 'k4'].map((k, i) => ({ name: SCN[k].l, color: [cssv('--heat'), cssv('--s1'), cssv('--s7')][i], pts: [...Array(10)].map((_, t) => [2026 + t, sum(rows.map(z => (z[SCN[k].fc] || [])[t] || 0))]), width: k === st.scn ? 3 : 1.6, dash: k === st.scn ? '' : '5 4' }));
      $('#r2FcLeg', root).innerHTML = legendRow(ser.map(s => ({ name: s.name, color: s.color, dash: !!s.dash })));
      lineChart($('#r2FcChart', root), { series: ser, x: { ticks: [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035], fmt: v => v }, y: { fmt: v => K(v), label: 'Replacements per year' }, H: 280, aria: 'ten year replacement forecast' });
      const f0 = ser[0].pts, f1 = ser[1].pts;
      $('#r2FcNote', root).innerHTML = `${cf ? CNAME(cf) + ' County' : 'The metro'} replaces about ${N(f0[0][1])} systems in 2026 and ${N(f0[9][1])} by 2035 under the RECS fit, ${P((f0[9][1] / f0[0][1] - 1) * 100, 1)} more from the same houses as the 2020 to 2024 boom homes age in. Steeper wear-out moves work later and bunches it: under k = 3 the 2035 figure is ${N(f1[9][1])}. New construction would add to every line.`;
      // cohorts
      const yrs = DATA.bps.years; const u1 = yrs.map((_, i) => sum((cf ? [cf] : FIPS).map(f => DATA.bps.u1[f][i])));
      const lam = WB.AC_TX.lam, kk = SCN[st.scn].k; const lam2 = st.scn === 'fit' ? lam : WB.AC_TX.mean / gammaF(1 + 1 / kk);
      const orig = yrs.map(y => weibS(2026.5 - (y + 1.5), lam2, kk) * 100);
      $('#r2CohLeg', root).innerHTML = legendRow([{ name: 'Single-family permits', color: cssv('--s1'), sq: true }, { name: 'Share of that year\'s homes still on the original system (right label, %)', color: cssv('--heat') }]);
      barChart($('#r2Coh', root), { cats: yrs.map(String), series: [{ name: 'Single-family permits', color: cssv('--s1'), values: u1 }], H: 260, fmt: v => K(v), maxLabels: 12, tipExtra: i => tipRow('Still original today', P(orig[i], 0)) + tipRow('Home age in 2026', D(2026 - yrs[i] - 1, 0) + ' yrs') });
      const peak = yrs[u1.indexOf(Math.max(...u1.slice(0, 20)))];
      $('#r2CohNote', root).innerHTML = `Two booms, one bust. Permits peaked at ${N(Math.max(...u1.slice(0, 20)))} in ${peak} and fell to ${N(Math.min(...u1.slice(17, 23)))} by 2011; they have run above 40,000 a year since 2020. Homes permitted in ${peak} are about ${2026 - peak - 1} years old: in the ${SCN[st.scn].l} scenario ${P(weibS(2026.5 - (peak + 1.5), lam2, kk) * 100, 0)} of them still run the builder's system. For 2015 homes the figure is ${P(weibS(2026.5 - 2016.5, lam2, kk) * 100, 0)}. Hover a bar for any year.`;
      // mix
      const g = sum(rows.map(r => r.rep_gas)), h = sum(rows.map(r => r.rep_hp)), e = sum(rows.map(r => r.rep_ef)), fr = sum(rows.map(r => r.furn_rep)), er = sum(rows.map(r => r.ef_rep));
      const host = $('#r2Mix', root); host.innerHTML = '<div id="r2MixC"></div>';
      hbarChart($('#r2MixC', root), [
        { l: 'Gas furnace plus AC systems', v: g, color: cssv('--heat') }, { l: 'Heat pump systems', v: h, color: cssv('--cool') }, { l: 'Electric air handler plus AC', v: e, color: cssv('--s4') },
        { l: 'Gas furnaces reaching end of life', v: fr, color: cssv('--heat'), t: N(fr) + ' (heating only)' }, { l: 'Electric air handlers reaching end of life', v: er, color: cssv('--s4'), t: N(er) + ' (heating only)' }], { L: 250, R: 130 });
      host.insertAdjacentHTML('beforeend', `<p class="chartnote">Cooling drives the calendar and heating rides along: in ${D(DATA.recs_tx.same_age, 0)}% of Texas homes with central air and a furnace, the two report the same age band (RECS 2020), so most furnace retirements happen inside a system job. The furnace line counts furnaces whose own fitted life (mean ${D(WB.GasFurn_TX.mean, 1)} years) runs out this year; many are replaced with the AC, some alone after a failed heat exchanger or inducer in January. Heat pumps are both sides at once and fail faster (mean ${D(WB.HP_TX.mean, 1)} years): they run all year.</p>`);
      // tickets
      barChart($('#r2Tick', root), { cats: T.hist.map((_, i) => i < 19 ? `$${i * 2}k` : '$38k+'), series: [{ name: 'Permits', color: cssv('--accent'), values: T.hist }], H: 200, fmt: v => N(v), maxLabels: 10 });
      $('#r2TickTbl', root).innerHTML = `<table><thead><tr><th class="l">Single system, tonnage in permit text</th><th>Permits</th><th>Median</th></tr></thead><tbody>${Object.entries(T.by_ton).map(([t, [n, m]]) => `<tr><td class="l">${t} tons</td><td>${N(n)}</td><td>${M$(m)}</td></tr>`).join('')}</tbody></table><p class="chartnote">Median by permit year: ${Object.entries(T.by_year).map(([y, [n, m]]) => `${y} ${M$(m)} (n ${n})`).join(' · ')}. About ${D(T.multi_share, 0)}% of permits that name tonnage cover two systems; ${D(T.gas_mention, 0)}% mention gas. The default base ticket of ${M$(13800)} is the early 2025 median carried to 2026 before the Trane and Carrier increases of April and July 2026 (up to 5% each); set your own.</p>`;
      // seasonal
      const sf = META.season_fw, sd = META.season_dal; const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      $('#r2SeasLeg', root).innerHTML = legendRow([{ name: 'Fort Worth 2012 to 2026', color: cssv('--heat') }, { name: 'Dallas 2018 to 2020', color: cssv('--s1') }]);
      lineChart($('#r2Seas', root), { series: [{ name: 'Fort Worth', color: cssv('--heat'), pts: sf.map((v, i) => [i + 1, v]), dots: true }, { name: 'Dallas', color: cssv('--s1'), pts: sd.map((v, i) => [i + 1, v]), dots: true }], x: { ticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], fmt: v => mo[v - 1] }, y: { fmt: v => D(v, 0), min: 40 }, H: 240, tipTitle: v => mo[v - 1], aria: 'seasonal index' });
      $('#r2SeasNote', root).innerHTML = `Changeouts peak in June and July at about ${D(Math.max(...sf), 0)}% of an average month and bottom out in December near ${D(Math.min(...sf), 0)}%. The heating season has no second peak in either file: furnace failures are repaired more often than replaced. Budget pacing in the Campaign Desk uses this curve.`;
      // observed vs modeled FW
      const cz = DATA.index.valpts.filter(p => p.city === 'Fort Worth').map(p => ZI[p.zip]).filter(Boolean);
      const r = scatter($('#r2Obs', root), { pts: cz.map(z => ({ x: z.perm_model, y: z.perm_obs, lab: z.zip, tip: `<div class="tt">${z.zip} · ${esc(z.city)}</div>${tipRow('Modeled replacements a year', N(z.perm_model))}${tipRow('Observed permits a year', N(z.perm_obs))}${tipRow('Captured', P(z.perm_cap * 100, 0))}${tipRow('Median income', M$(z.inc))}` })), x: { label: 'Modeled replacements a year (Fort Worth part of ZIP)', fmt: v => N(v) }, y: { label: 'Observed permits a year', fmt: v => N(v) }, H: 300, labels: 30 });
      const C = META.cal;
      $('#r2ObsNote', root).innerHTML = `Counts line up (r = ${D(r.r, 2)} across ${r.n} ZIPs): the model knows where the systems are. Levels do not: the city records about ${P(C['Fort Worth'].cap * 100, 0)} of modeled replacements, Dallas ${P(C.Dallas.cap * 100, 0)}, Irving ${P(C.Irving.cap * 100, 0)}. Three independent files agreeing within two points says the gap is structural. Either about four in five changeouts go unpermitted, or Texas systems last far longer than Texans report; module 04 shows the gap is widest in lower-income ZIPs, which points to the first.`;
      rein();
    }
    function rein() {
      const top = ZR.filter(z => !st.county || z.fips === st.county).sort((a, b) => REIN[b.zip] - REIN[a.zip]).slice(0, 8);
      $('#r2Rein', root).innerHTML = `<div class="qbox">
        <div class="qb"><div class="qt">Builder grade at first failure</div><div class="qv">${K(META.orig_win)}</div><div class="qd">original systems in homes aged 10 to 25. Oversized, undercharged, on builder duct runs; the replacement is the moment to fix all of it.</div></div>
        <div class="qb"><div class="qt">Duct generation</div><div class="qv">${P((META.yb[3] + META.yb[4]) / sum(META.yb) * 100, 0)}</div><div class="qd">of homes were built 1980 to 1999; their attic duct systems are 27 to 46 years old.</div></div>
        <div class="qb"><div class="qt">Hail</div><div class="qv">${N(DATA.hail.rows.filter(r => r[0] >= 2023).reduce((s, r) => s + r[3], 0))}</div><div class="qd">reports of 1.75 inch or larger hail in the 12 counties since January 2023 (NOAA). Insurance pays for matched systems.</div></div>
        <div class="qb"><div class="qt">Refrigerant change</div><div class="qv">A2L</div><div class="qd">New split systems ship on R454B or R32 since 2025; an A2L condenser needs an A2L-rated coil, so partial swaps become matched systems.</div></div></div>
        <div class="dsec" style="margin-top:14px">Strongest reinstall signal${st.county ? ' in ' + CNAME(st.county) : ''}</div>
        <table><thead><tr><th class="l">ZIP</th><th class="l">City</th><th>Signal</th><th>Built 80 to 99</th><th>Builder wave</th><th>Hail 1.75"</th></tr></thead><tbody>${top.map(z => `<tr class="click" data-z="${z.zip}"><td class="l"><b>${z.zip}</b></td><td class="l">${esc(z.city)}</td><td>${D(REIN[z.zip], 0)}</td><td>${P(z.yb_duct, 0)}</td><td>${P(z.origwin_sh, 0)}</td><td>${D(z.hail175_8km, 0)}</td></tr>`).join('')}</tbody></table>
        ${callout('judg tight', 'Judgment call: the reinstall signal is a blend, not a measurement', 'Percentile blend of duct generation (30%), builder wave (35%), large hail (20%) and R22 share (15%). No dataset records which changeouts became full reinstalls by ZIP; the weights encode where each trigger is known to bite and are stated so you can reweight.')}
        ${callout('note tight', 'The refrigerant rule, as it stands', 'Manufacture and import of new R410A split systems ended January 1, 2025. EPA\'s final rule of May 26, 2026 (effective July 27, 2026) removed the January 1, 2026 installation deadline, so R410A equipment built before 2025 can still be installed until stock runs out. R410A refrigerant keeps stepping down under the AIM Act to 15% of baseline by 2036, which keeps service gas expensive. Details and sources in module 03.')}`;
      $$('#r2Rein tr[data-z]', root).forEach(tr => tr.onclick = () => { st.sel = tr.dataset.z; map.fitTo([st.sel]); render(); });
    }
    function gammaF(x) { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gammaF(1 - x)); x -= 1; let a = c[0]; const t = x + g + 0.5; for (let i = 1; i < g + 2; i++) a += c[i] / (x + i); return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a; }
    // repair or replace calculator
    function calc() {
      const h = $('#r2Calc', root);
      if (!h.dataset.built) {
        h.dataset.built = '1';
        h.innerHTML = `<div class="plan">
          <div class="f"><label class="fl" for="cAge">System age (years)</label><input type="number" id="cAge" value="14" min="0" max="40"></div>
          <div class="f"><label class="fl" for="cType">Equipment</label><select id="cType"><option value="AC_TX">Central AC (condenser)</option><option value="HP_TX">Heat pump</option><option value="GasFurn_TX">Gas furnace</option></select></div>
          <div class="f"><label class="fl" for="cRef">Refrigerant</label><select id="cRef"><option value="r22">R22</option><option value="r410" selected>R410A</option><option value="a2l">A2L (R454B or R32)</option></select></div>
          <div class="f"><label class="fl" for="cQuote">Repair quote ($)</label><input type="number" id="cQuote" value="1450" min="0" step="50"></div>
          <div class="f"><label class="fl" for="cNew">Replacement quote ($)</label><input type="number" id="cNew" value="${st.base}" min="1000" step="100"></div>
          <div class="f"><label class="fl" for="cTons">Tons · old SEER · new SEER2</label><div style="display:flex;gap:6px"><input type="number" id="cTons" value="3.5" step="0.5" min="1" max="5" style="width:64px"><input type="number" id="cSeer" value="12" step="0.5" style="width:64px"><input type="number" id="cSeer2" value="15.2" step="0.1" style="width:70px"></div></div>
          <div class="f"><label class="fl" for="cHrs">Cooling hours a year · $ per kWh</label><div style="display:flex;gap:6px"><input type="number" id="cHrs" value="2400" step="100" style="width:80px"><input type="number" id="cKwh" value="0.15" step="0.01" style="width:70px"></div></div>
        </div><div id="cOut" style="margin-top:12px"></div>`;
        $$('input,select', h).forEach(i => i.addEventListener('input', calc));
      }
      const a = +$('#cAge', h).value || 0, type = $('#cType', h).value, ref = $('#cRef', h).value, q = +$('#cQuote', h).value || 0, nw = +$('#cNew', h).value || 1, tons = +$('#cTons', h).value || 3, s1 = +$('#cSeer', h).value || 12, s2 = +$('#cSeer2', h).value || 15, hrs = +$('#cHrs', h).value || 2400, kwh = +$('#cKwh', h).value || .15;
      const w = WB[type]; const mrl = weibMRL(a, w.lam, w.k), p1 = weibH1(a, w.lam, w.k);
      const rule = a * q; const seer2to = s1 * 0.95;   // SEER to SEER2 approximate conversion
      const kwhOld = tons * 12000 * hrs / (seer2to * 1000), kwhNew = tons * 12000 * hrs / (s2 * 1000); const save = type === 'GasFurn_TX' ? 0 : (kwhOld - kwhNew) * kwh;
      const refNote = { r22: 'R22 is no longer produced; reclaimed gas runs well over $100 a pound. Any leak repair on an R22 system is money into a system with no future.', r410: 'R410A is still serviced, but supply steps down under the AIM Act and new equipment is A2L, so a failed R410A compressor or coil usually means a matched A2L system.', a2l: 'A2L systems are the current generation; repairs are normal warranty and parts work.' }[ref];
      const verdict = (ref === 'r22' && q > 400) || rule > 5000 || p1 > 0.2 ? 'Replace' : rule > 3500 ? 'Close call' : 'Repair';
      $('#cOut', h).innerHTML = `<div class="qbox"><div class="qb"><div class="qt">The $5,000 rule</div><div class="qv">${M$(rule)}</div><div class="qd">age × repair quote; over $5,000 says replace</div></div><div class="qb"><div class="qt">Failure in the next 12 months</div><div class="qv">${P(p1 * 100, 0)}</div><div class="qd">conditional on surviving to ${a} years (${w === WB.AC_TX ? 'AC' : type === 'HP_TX' ? 'heat pump' : 'furnace'} fit, mean ${D(w.mean, 1)} yrs)</div></div><div class="qb"><div class="qt">Expected remaining life</div><div class="qv">${D(mrl, 1)} yrs</div><div class="qd">mean residual life of a unit already ${a}</div></div><div class="qb"><div class="qt">Energy saving a year</div><div class="qv">${M$(save)}</div><div class="qd">${D(tons, 1)} tons, SEER ${D(s1, 1)} to SEER2 ${D(s2, 1)}, ${N(hrs)} hours</div></div></div>
        <div class="callout ${verdict === 'Replace' ? '' : 'judg'} tight"><span class="ct">Reading: ${verdict}</span>Repair buys an expected ${D(mrl, 1)} more years at ${M$(q)}, about ${M$(q / Math.max(0.5, mrl))} a year of expected life; replacement at ${M$(nw)} buys about ${D(w.mean, 1)} years (${M$(nw / w.mean)} a year) and ${M$(save)} a year back in power. ${refNote} Cooling hours and power price are stated assumptions (grade D); change them.</div>`;
    }
    // method & fit tables
    $('#r2Meth', root).innerHTML = [
      `<b>Installed base ${G('A/B')}</b>. Occupied units by tenure, structure type and build period come from ACS table B25127 for every ZIP, split into decades with B25036 and into single years inside 1990 to 2024 using the ZIP's main county's Census building permits, lagged one year to completion (single-family permits for owners, all units for renters). Central air shares by structure come from RECS 2020 Texas (${P(90.8, 1)} of single-family detached homes in climate zone 3A). Homes with four bedrooms count 1.35 systems and five or more 1.85, capped at 1.8 per ZIP (grade D; Irving permits show 8% of described jobs are two systems, rising to 26% in 2,500 to 3,000 square foot homes).`,
      `<b>Heating configuration ${G('A/B')}</b>. Each tenure's gas and electric heating shares come from ACS B25117. Electric central systems are split into heat pumps and electric air handlers with strip heat using the RECS 2020 Texas share (47% heat pumps in single-family, 53% in apartments).`,
      `<b>Lifetimes ${G('B')}</b>. A renewal process: every system is installed when the house is built and replaced when it fails or is retired, and the replacement starts a new life. Lifetimes are Weibull, fitted by maximum likelihood to the reported equipment age bands of RECS 2020 Texas households by year built, with the renewal process predicting each cohort's current-age distribution. Central AC: scale ${D(WB.AC_TX.lam, 2)}, shape ${D(WB.AC_TX.k, 2)}, mean ${D(WB.AC_TX.mean, 1)} years (replicate-weight standard error ±${D(META.weib.AC_TX.se_mean, 2)}). Heat pumps mean ${D(WB.HP_TX.mean, 1)}; gas furnaces ${D(WB.GasFurn_TX.mean, 1)}; electric air handlers ${D(WB.ElecFurn_TX.mean, 1)}.`,
      `<b>Replacements ${G('B')}</b>. Expected replacements in a year are the increment of the renewal function over that year for each build-year cohort, times its systems, summed. Because the renewal density converges to one over the mean life, every neighborhood older than about fifteen years replaces near ${P(100 / WB.AC_TX.mean, 1)} of its systems a year; the variation that matters is in composition: how many are originals, R22 era, or past twenty.`,
      `<b>Scenarios ${G('C')}</b>. Respondents estimate equipment age, which smears the age bands and flattens the fitted hazard. The two alternative shapes keep the fitted mean and steepen wear-out to k = 3 and k = 4. Totals barely move; timing does.`,
      `<b>Dollars ${G('C')}</b>. Tickets start from the Irving permit median and scale with the square root of median rooms and the 0.15 power of median home value; single-family rentals at 90% and apartment systems at 55% of the owner ticket. All four numbers are editable here or in code.`,
      `<b>Calibration ${G('B')}</b>. Modeled replacements in the city part of each ZIP (2020 block housing shares) against observed mechanical permits in Fort Worth, Dallas and Irving: counts correlate at r = ${D(META.cal['Fort Worth'].r85, 2)} in Fort Worth; the captured share is ${P(META.cal['Fort Worth'].cap * 100, 0)} to ${P(META.cal.Dallas.cap * 100, 0)} across the three cities.`
    ].map(x => `<li>${x}</li>`).join('');
    const F = DATA.recs.AC_TX; const ymL = { 1: 'Before 1950', 2: '1950s', 3: '1960s', 4: '1970s', 5: '1980s', 6: '1990s', 7: '2000s', 8: '2010 to 2015', 9: '2016 to 2020' };
    $('#r2Fit', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Built</th><th>n</th><th>&lt;2 yrs</th><th>2 to 4</th><th>5 to 9</th><th>10 to 14</th><th>15 to 19</th><th>20+</th></tr></thead><tbody>${F.cohorts.map((c, i) => `<tr><td class="l">${ymL[c]}</td><td>${F.ncoh[i]}</td>${F.obs[i].map((o, j) => `<td>${D(o, 0)}<span class="mini"> / ${D(F.fit[i][j], 0)}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="chartnote">Observed / fitted, percent of each row. The fit reproduces the shape: homes built 2010 to 2015 were five to ten years old at the survey and 72% report a five to nine year old system (fit ${D(F.fit[7][2], 0)}%). Misses are largest in small pre-1960 cohorts, where central air was often retrofitted after construction, which the steady state absorbs.</p>`;
    $('#r2Judg', root).innerHTML = judgList([
      ['A system is replaced as a system', `Cooling drives the replacement calendar; in ${D(DATA.recs_tx.same_age, 0)}% of Texas homes the AC and furnace report the same age band. The model counts system events from the AC or heat pump lifetime and reports furnace retirements separately rather than adding them.`],
      ['Two-system homes', 'Homes with four or more bedrooms count extra systems (grade D). This lifts affluent suburbs; set it to one per home by reading the owner single-family counts directly.'],
      ['Apartments are in the count', 'Apartment units have their own split systems in Texas garden apartments. They are counted, then weighted down in the dollar and paid models because a property manager, not a household, buys them.'],
      ['Stock is held at today', 'The forecast ages today\'s homes forward. New construction (40,000 to 52,000 single-family permits a year since 2020) would add installs, not replacements, inside ten years.'],
      ['One-year build lag', 'Permits are assumed to complete the following year. Multifamily takes longer; the error shifts some renter cohorts by a year.'],
      ['Tickets', 'Permit valuations are declared by contractors and can understate. The base is editable because it is the least certain number on the page.'],
      ['Full-system share', `Irving's ${P(T.cls.system / T.n_all * 100, 0)} comes from permitted jobs; unpermitted jobs are likelier to be component swaps. The default of 83% therefore sits at the top of the plausible range for the whole market.`],
      ['Reinstall signal', 'A stated blend of four observable drivers; no dataset records reinstalls by ZIP.'],
      ['The repair calculator', 'Uses the fitted Texas lifetimes, a 0.95 SEER to SEER2 conversion, and your hours and power price. It is an explainer for a homeowner, not an engineering calculation.']]);
    $('#r2Cav', root).innerHTML = proseTable([
      ['Expectations, not orders', 'A modeled replacement is the expected number of systems retired, for any reason, given their ages. Weather, prices and marketing move the realized number around it.'],
      ['Warranty replacements', 'Early failures replaced under manufacturer or builder warranty are counted as replacements; they are real jobs but not always open to a new contractor.'],
      ['Weather years', `The fitted lives average across 2000 to 2020 weather. 2026 (${DATA.climate.ytd.d100} days at 100°F through ${DATA.climate.ytd.through.slice(5).replace('-', '/')}) runs hotter than the survey years; module 04 measures how much heat moves permits.`],
      ['Permits undercount', 'Observed permits capture about one in five modeled replacements and more in affluent ZIPs. They validate where, not how many.'],
    ]);
    $('#r2Src', root).innerHTML = srcRows([
      ['Equipment age by year built', 'EIA RECS 2020 public microdata v7 (ACEQUIPAGE, EQUIPAGE, YEARMADERANGE, NWEIGHT and 60 replicate weights)', 'B', '2020', 'https://www.eia.gov/consumption/residential/data/2020/'],
      ['Housing stock', 'ACS 2020 to 2024 five-year: B25127, B25036, B25117, B25041, B25077, B25018', 'A', 'Dec 2025', 'https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/'],
      ['Build timing', 'Census Building Permits Survey county annual files', 'A', '1990 to 2025', 'https://www2.census.gov/econ/bps/County/'],
      ['Tickets and job mix', 'City of Irving, Residential Permits Issued Feb 15 2022 through present (Mechanical Standalone), ArcGIS feature service', 'B', 'Feb 2022 to Feb 2025', 'https://services3.arcgis.com/OfsJXUlu8pSkbl7B/arcgis/rest/services/Residential_Permits_Issued_Feb_15_2022_Present/FeatureServer'],
      ['Observed changeouts', 'City of Fort Worth, CFW Open Data Development Permits (Mechanical, Standalone)', 'B', 'Jan 2012 to Sep 2026', 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer'],
      ['Observed changeouts', 'City of Dallas Building Permits (Mechanical, Single Family Alteration), historical file', 'B', 'Jan 2018 to Aug 2020', 'https://www.dallasopendata.com/resource/e7gq-4sah'],
      ['R410A installation rule', 'NAHB summary of EPA final rule of May 26, 2026 amending the Technology Transitions installation deadline', 'B', 'May 2026', 'https://www.nahb.org/blog/2026/05/epa-hvac-refrigerants-r-410a-final-rule'],
      ['Equipment price increases', 'ACHR News, Price Increases Remain Part of the Residential HVAC Outlook (Sep 18, 2026)', 'C', 'Sep 2026', 'https://www.achrnews.com/articles/166689-price-increases-remain-part-of-the-residential-hvac-outlook'],
    ]);
    // wiring
    wireSeg($('#r2Scn', root), v => { st.scn = v; render(); });
    $('#r2Layer', root).onchange = e => { st.layer = e.target.value; render(); };
    $('#r2Cty', root).onchange = e => { st.county = e.target.value; if (st.county) map.fitTo(Z.filter(z => z.fips === st.county).map(z => z.zip)); else map.reset(); render(); };
    $('#r2Base', root).addEventListener('input', debounce(e => { st.base = clamp(+e.target.value || 13800, 1000, 60000); render(); calc(); }, 250));
    $('#r2Full', root).addEventListener('input', debounce(e => { st.full = clamp(+e.target.value || 83, 0, 100); render(); }, 250));
    $('#r2Sort', root).onchange = () => table();
    $('#r2Csv', root).onclick = () => { const s = S0(); const keys = ['zip', 'city', 'cty', 'occ', 'sys', 'sys_ownsf', 'sys_rentsf', 'sys_mf', 'rep', 'rep_k3', 'rep_k4', 'rep_ownsf', 'rep_rentsf', 'rep_mf', 'rep_gas', 'rep_hp', 'rep_ef', 'first5', 'first5_k3', 'first5_k4', 'orig_win', 'r22', 'furn', 'furn20', 'furn_rep', 'ef_rep', 'ticket'];
      saveFile('dfw-replacement-wave-by-zip.csv', toCSV(keys.concat(['spend_per_year_usd', 'reinstall_signal']), ZR.map(z => keys.map(k => z[k]).concat([Math.round(usd(z)), Math.round(REIN[z.zip])])), `DFW Thermal Debt Atlas, module 02, compiled 2026-09-25. Scenario for spend: ${s.l}. Base ticket ${st.base}.\nCounts are expected system replacements (renewal model, RECS 2020 Texas lifetimes). rep_k3/rep_k4 hold the mean life and steepen wear-out.`)); };
    $('#r2Fc', root).onclick = () => { const head = ['county', 'scenario'].concat([...Array(10)].map((_, i) => String(2026 + i))); const rows = []; CO.forEach(c => ['fit', 'k3', 'k4'].forEach(k => rows.push([c.name, SCN[k].l].concat([...Array(10)].map((_, t) => Math.round(sum(ZR.filter(z => z.fips === c.fips).map(z => (z[SCN[k].fc] || [])[t] || 0)))))))); saveFile('dfw-replacement-forecast-2026-2035.csv', toCSV(head, rows, 'Expected system replacements per year from homes standing today; no new construction added.')); };
    const topZ = () => ZR.filter(z => !st.county || z.fips === st.county).sort((a, b) => usd(b) - usd(a)).slice(0, 25).map(z => z.zip);
    $('#r2Desk', root).onclick = () => goModule('desk', { zips: st.sel ? [st.sel] : topZ(), line: 'replace' });
    $('#r2Forge', root).onclick = () => goModule('forge', { zips: st.sel ? [st.sel] : topZ() });
    BUS.on('theme', () => { render(); calc(); });
    this.receive = p => { if (p && p.zip && ZI[p.zip]) { st.sel = p.zip; map.fitTo([p.zip]); render(); } };
    render(); calc();
  }
});
