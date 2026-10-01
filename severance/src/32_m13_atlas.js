'use strict';
/* Module 13: Metro Atlas. The six largest Texas metros at block group resolution: Dallas Fort Worth, Houston, San Antonio, Austin, El Paso and the Rio Grande Valley */
const AT_METROS = [
  { key: 'dfw', title: 'Dallas Fort Worth', lead: 'Dallas, Fort Worth and every suburb between them' },
  { key: 'hou', title: 'Houston', lead: 'Harris County and the nine counties around it, from Conroe to Galveston' },
  { key: 'sat', title: 'San Antonio', lead: 'Bexar County and the seven counties around it, from Boerne and New Braunfels to Pleasanton' },
  { key: 'aus', title: 'Austin', lead: 'Travis County and the four counties around it, from Georgetown to San Marcos' },
  { key: 'elp', title: 'El Paso', lead: 'El Paso and Hudspeth counties, from the Franklin Mountains east to Sierra Blanca' },
  { key: 'rgv', title: 'Rio Grande Valley', lead: 'McAllen, Brownsville and the towns between them across Hidalgo and Cameron counties' }
];
const AT_BY_CODE = { '19100': 'dfw', '26420': 'hou', '41700': 'sat', '12420': 'aus', '21340': 'elp', '32580': 'rgv', '15180': 'rgv' };
const AT_CACHE = {};
// the single file carries each metro as a JSON script tag; the extension loads data/atlas-<key>.js on first use
function atlasData(k) { if (!AT_CACHE[k]) { const W = window.__SEV_ATLAS__ || {}; if (W[k]) AT_CACHE[k] = W[k]; else { const t = document.getElementById('atlas-' + k); if (t) AT_CACHE[k] = JSON.parse(t.textContent); } } return AT_CACHE[k] || null; }
function loadAtlas(k) { return new Promise((res, rej) => { if (atlasData(k)) { res(); return; } const s = document.createElement('script'); s.src = 'data/atlas-' + k + '.js'; s.onload = () => atlasData(k) ? res() : rej(new Error('The ' + k + ' atlas file loaded without data.')); s.onerror = () => rej(new Error('The ' + k + ' atlas file did not load.')); document.head.appendChild(s); }); }
const ATL = [
  { k: 'fit', g: 'Opportunity', t: 'Market Fit', ramp: 'forest', f: v => N(v, 0) },
  { k: 'pipe', g: 'Opportunity', t: 'Divorce Pipeline Index', ramp: 'forest', f: v => N(v, 0) },
  { k: 'value', g: 'Opportunity', t: 'Case Value Index', ramp: 'teal', f: v => N(v, 0) },
  { k: 'xd', g: 'Demand', t: 'Expected divorce filings a year', ramp: 'forest', f: v => N(v, 1) },
  { k: 'xden', g: 'Demand', t: 'Expected divorce filings per square mile', ramp: 'forest', f: v => N(v, 1) },
  { k: 'x1', g: 'Demand', t: 'Expected divorce filings within one mile', ramp: 'forest', f: v => N(v, 0) },
  { k: 'xk', g: 'Demand', t: 'Expected divorces with children a year', ramp: 'forest', f: v => N(v, 1) },
  { k: 'xs', g: 'Demand', t: 'Expected custody suits without a divorce a year', ramp: 'forest', f: v => N(v, 1) },
  { k: 'xm', g: 'Demand', t: 'Expected modifications and enforcements a year', ramp: 'forest', f: v => N(v, 1) },
  { k: 'rate', g: 'Demand', t: 'Expected divorce filings per 1,000 married', ramp: 'forest', f: v => N(v, 1) },
  { k: 'haz', g: 'Demand', t: 'Local divorce hazard per 1,000 married (model)', ramp: 'forest', f: v => N(v, 1) },
  { k: 'sep', g: 'Demand', t: 'Separated per 1,000 married', ramp: 'forest', f: v => N(v, 0) },
  { k: 'div', g: 'Demand', t: 'Divorced per 1,000 residents 15 and over', ramp: 'forest', f: v => N(v, 0) },
  { k: 'married', g: 'Demand', t: 'Married adults', ramp: 'forest', f: v => N(v, 0) },
  { k: 'mden', g: 'Demand', t: 'Married adults per square mile', ramp: 'forest', f: v => N(v, 0) },
  { k: 'kids', g: 'Demand', t: 'Married couples raising children (share)', ramp: 'forest', f: v => P(v, 0) },
  { k: 'inc', g: 'Means', t: 'Median household income', ramp: 'teal', f: v => $$$(v) },
  { k: 'i150', g: 'Means', t: 'Households earning $150,000 or more', ramp: 'teal', f: v => P(v, 0) },
  { k: 'val', g: 'Means', t: 'Median home value', ramp: 'teal', f: v => $$$(v) },
  { k: 'own', g: 'Means', t: 'Owner occupied homes', ramp: 'teal', f: v => P(v, 0) },
  { k: 'strain', g: 'Strain', t: 'Household strain (composite)', ramp: 'leaf', f: v => N(v, 0) },
  { k: 'mort', g: 'Strain', t: 'Owners paying 35% or more on the mortgage', ramp: 'leaf', f: v => P(v, 0) },
  { k: 'rent', g: 'Strain', t: 'Renters paying 35% or more on rent', ramp: 'leaf', f: v => P(v, 0) },
  { k: 'snap', g: 'Strain', t: 'Households on SNAP', ramp: 'leaf', f: v => P(v, 1) },
  { k: 'unemp', g: 'Strain', t: 'Unemployment rate (five year survey)', ramp: 'leaf', f: v => P(v, 1) },
  { k: 'o3', g: 'Competition and courts', t: 'Law offices within three miles', ramp: 'sage', f: v => N(v, 0) },
  { k: 'eff', g: 'Competition and courts', t: 'Expected divorce filings per nearby law office', ramp: 'sage', f: v => N(v, 1) },
  { k: 'venue', g: 'Competition and courts', t: 'Filing county and courthouse', cat: true },
  { k: 'yb', g: 'Context', t: 'Median year homes were built', ramp: 'slate', f: v => String(v) },
  { k: 'age', g: 'Context', t: 'Median age', ramp: 'slate', f: v => N(v, 1) },
  { k: 'ba', g: 'Context', t: "Adults 25 and over with a bachelor's degree", ramp: 'slate', f: v => P(v, 0) },
  { k: 'c45', g: 'Context', t: 'Workers commuting 45 minutes or more', ramp: 'slate', f: v => P(v, 0) }
];
const ATLI = {}; ATL.forEach(l => ATLI[l.k] = l);
const AT_OV = [['places', 'City limits'], ['isd', 'School districts'], ['zip', 'ZIP codes'], ['roads', 'Highways'], ['water', 'Water'], ['courts', 'Courthouses'], ['warn', 'Layoff notices'], ['labels', 'Labels']];
// county colors go by population rank inside each metro: the categorical set first, then three slate steps
const AT_PAL = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)', 'var(--rp-slate-3)', 'var(--rp-slate-5)', 'var(--rp-slate-7)'];
const MI_U = 160.9344; // map units (10 m) per mile
const AT_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const atNum = n => n < AT_WORD.length ? AT_WORD[n] : String(n);
// label widths for the overlay's collision pass, measured in the label's own font (an estimate when canvas text is unavailable)
const AT_MW = {}; let AT_CTX = null;
function atTextW(t, px, weight, track) { const key = weight + '|' + px + '|' + (track || 0) + '|' + t; if (AT_MW[key] != null) return AT_MW[key]; let w = null; try { AT_CTX = AT_CTX || document.createElement('canvas').getContext('2d'); if (AT_CTX) { AT_CTX.font = `${weight} ${px}px 'DM Sans', Roboto, system-ui, sans-serif`; w = AT_CTX.measureText(t).width; } } catch (e) { w = null; } if (!isN(w) || w <= 0) w = t.length * px * 0.62; w += (track || 0) * px * t.length; return (AT_MW[key] = w); }
let AT_TOK = 0, AT_RO = null, AT_RS = null;

registerModule({
  key: 'atlas', num: '13', title: 'Metro Atlas', metro: true,
  desc: 'Dallas Fort Worth, Houston, San Antonio, Austin, El Paso and the Rio Grande Valley at block group resolution',
  mount(root) { mountAtlas(root, store.get('sev.atlas.metro', 'dfw')); },
  // goModule('atlas', {mk} or {metro: MSA code}) opens that metro
  receive(p) { const mk = p && (p.mk || AT_BY_CODE[p.metro] || (AT_METROS.some(m => m.key === p.arg) ? p.arg : null)); if (mk && AT_METROS.some(m => m.key === mk) && this.mk !== mk) mountAtlas($('#mod-atlas'), mk); }
});
// open the atlas on one metro from anywhere in the suite
function openAtlas(mk) {
  store.set('sev.atlas.metro', mk);
  const m = MODI.atlas; const again = m.mounted && m.mk !== mk;
  showModule('atlas');
  if (again) mountAtlas($('#mod-atlas'), mk);
}

function mountAtlas(root, mk) {
  if (!AT_METROS.some(m => m.key === mk)) mk = 'dfw';
  MODI.atlas.mk = mk; store.set('sev.atlas.metro', mk);
  try { if (/^#atlas\b/.test(location.hash || '') && location.hash !== '#atlas/' + mk) history.replaceState(null, '', '#atlas/' + mk); } catch (e) { }   // a link to this metro's atlas
  const tok = ++AT_TOK; const live = () => tok === AT_TOK;
  if (AT_RO) { try { AT_RO.disconnect(); } catch (e) { } AT_RO = null; }
  if (AT_RS) { window.removeEventListener('resize', AT_RS); AT_RS = null; }
  hideTip();
  const MT = AT_METROS.find(m => m.key === mk);
  if (!atlasData(mk)) { root.innerHTML = `<div class="callout note" style="margin-top:24px"><div class="h">Loading</div><p>Loading the ${esc(MT.title)} block groups.</p></div>`; loadAtlas(mk).then(() => { if (live()) mountAtlas(root, mk); }).catch(e => { if (live()) root.innerHTML = `<div class="callout"><div class="h">Atlas data missing</div><p>${esc(e.message)}</p></div>`; }); return; }
  const A = atlasData(mk); const B = A.bg; const V = B.v; const nB = B.id.length;
  const MN = A.meta.name; const MIN = mk === 'rgv' ? 'the Rio Grande Valley' : `the ${MN} metro`;
  const CN = A.meta.cty_names; const CC = A.meta.cty; const nC = CC.length;
  const cName = f => CN[CC.indexOf(f)];
  const courtBy = {}; A.courts.forEach(c => courtBy[c.f] = c);
  const PL = A.places; const plIdx = {}; PL.forEach((p, i) => plIdx[p.n] = i);
  const CAG = {}; A.agg.counties.forEach(c => CAG[c.f] = c);
  const byPop = A.agg.counties.slice().sort((a, b) => b.pop - a.pop);
  const byX = A.agg.counties.slice().sort((a, b) => b.xd - a.xd);
  const VEN = {}; byPop.forEach((c, j) => VEN[c.f] = AT_PAL[Math.min(j, AT_PAL.length - 1)]);
  const cityAgg = n => A.agg.cities.find(c => c.n === n);
  // block group indexes by ZIP and by city
  const ZIPS = {}, PLBG = {};
  for (let i = 0; i < nB; i++) { if (B.zip[i]) (ZIPS[B.zip[i]] = ZIPS[B.zip[i]] || []).push(i); if (B.pl[i] >= 0) (PLBG[B.pl[i]] = PLBG[B.pl[i]] || []).push(i); }
  const st = {
    layer: store.get('sev.atlas.layer', 'fit'),
    ov: Object.assign({ places: true, isd: false, zip: false, roads: true, water: true, courts: true, warn: false, labels: true }, store.get('sev.atlas.ov', {})),
    w: Object.assign({ vol: 45, val: 35, comp: 20 }, store.get('sev.atlas.fitw', {})),
    sel: -1, area: 'all', topN: 25, byc: null
  };
  if (!ATLI[st.layer]) st.layer = 'fit';
  // ---------- derived arrays
  const fit = new Array(nB).fill(null);
  function computeFit() {
    const w = st.w;
    for (let i = 0; i < nB; i++) {
      if (!B.ok[i]) { fit[i] = null; continue; }
      const parts = [[V.cvol[i], w.vol], [V.value[i], w.val], [V.ccomp[i], w.comp]];
      let s = 0, d = 0; parts.forEach(([v, ww]) => { if (isN(v) && ww > 0) { s += v * ww; d += ww; } });
      fit[i] = d ? s / d : null;
    }
  }
  computeFit();
  const val = (k, i) => k === 'fit' ? fit[i] : (V[k] ? V[k][i] : null);
  // ---------- figures for the masthead
  const metroX = sum(V.xd);
  const topCity = A.agg.cities.slice().sort((a, b) => b.xd - a.xd)[0];
  const topCty = byX[0];
  const zipX = {}; Object.keys(ZIPS).forEach(z => { zipX[z] = sum(ZIPS[z].map(i => V.xd[i] || 0)); });
  const topZip = Object.keys(zipX).sort((a, b) => zipX[b] - zipX[a])[0] || '';
  const topIsd = A.agg.isd.slice().sort((a, b) => b.xd - a.xd).find(z => !z.n.startsWith(topCity.n)) || A.agg.isd[0];
  const gapCty = CC.filter(f => { const c = CI['48' + f]; const t = (c && c.filings && c.filings.ttm) || {}; return c && !((t.div || 0) + (t.sapcr || 0) + (t.mod || 0) + (t.enf || 0)); });
  const gapNote = gapCty.length ? ` The clerk reports for ${gapCty.map(f => esc(cName(f)) + ' County').join(' and ')} show no family cases in the last twelve months, so ${gapCty.length > 1 ? 'their' : 'its'} block groups show no expected filings.` : '';
  const nCourt = A.courts.length;
  const courtNote = nCourt >= nC ? `Addresses are the family court buildings for ${nC === 1 ? 'the county' : nC === 2 ? 'both counties' : 'every county'}.`
    : nCourt === 1 ? `The address is the family court building for ${esc(cName(A.courts[0].f))} County; ${nC - nCourt === 1 ? 'the other county hears' : 'the others hear'} family cases at the county seat.`
    : `Addresses are the family court buildings for the ${atNum(nCourt)} core counties; ${nC - nCourt === 1 ? 'the other county hears' : 'the others hear'} family cases at the county seat.`;
  const areaOpts = [['all', mk === 'rgv' ? 'The whole valley' : 'The whole metro']]
    .concat(byPop.map(c => ['c:' + c.f, c.n]))
    .concat(A.agg.cities.filter(c => c.pop >= 50000 && plIdx[c.n] !== undefined).sort((a, b) => b.pop - a.pop).map(c => ['p:' + c.n, c.n]));
  const bycKeys = byPop.map(c => c.f).filter(f => (A.agg.bycounty[f] || []).length);
  st.byc = bycKeys[0];
  root.innerHTML = mastHTML({
    eyebrow: `Module 13 · Metro Atlas · ${MN} · ${N(nB)} block groups in ${nC} ${nC === 1 ? 'county' : 'counties'}`,
    title: 'Metro Atlas',
    dek: `${esc(MT.lead)}, drawn at the census block group, the smallest area the Census publishes survey data for (about 1,500 residents each). Each county's divorce filings from the last twelve months are spread across its block groups by married adults and a local divorce hazard, so the map shows where the next filings are forming street by street. City limits, school districts, ZIP codes, highways, water and courthouses are drawn in, and every layer ranks each block group against the rest of the map.`,
    facts: [[N(metroX), `divorce filings in ${esc(MIN)}, last 12 months`], [N(topCity.xd), `expected in ${esc(topCity.n)} a year`], [N(topCty.xd), `in ${esc(topCty.n)}`], [N(A.meta.n_valid), 'block groups with enough residents to score']]
  }) + `
  <div class="tabs attabs" id="atMetros" role="tablist" aria-label="Metro">${AT_METROS.map(m => `<button type="button" role="tab" data-mk="${m.key}" class="${m.key === mk ? 'on' : ''}" aria-selected="${m.key === mk}">${esc(m.title)}</button>`).join('')}</div>
  <div class="toolbar"><span class="ttl">Metro Atlas · ${esc(MN)}</span><span class="sub">Block groups · city limits · school districts · highways · courthouses</span><span class="sp"></span><button class="btn" id="atCsvBg">↓ Block group CSV</button><button class="btn" id="atGoMetro">${esc(MN)} ↗</button><button class="btn" id="atGoDesk">Campaign Desk ↗</button></div>
  <div class="callout note"><div class="h">Read this first: how a county count becomes a street level map</div><p>Filings are reported by county, not by address. Each county's trailing twelve month divorce count from the district clerk is divided among its block groups in proportion to married adults times a <b>local divorce hazard</b>: the statewide model fit on ${N(D.pums.n)} married Texans, reweighted to each block group's mix of ages, schooling and veterans against its own survey area. Separated counts come straight from the Census survey and are pulled toward the tract when the sample is thin. The result is the best available estimate of where filings originate, not a count of petitions by street. Where a city crosses a county line, the side a family lives on decides the courthouse.</p></div>
  <div class="panel" style="margin-top:14px">
    <div class="atlas-ctl">
      ${ctl('Map layer', `<select id="atLayer">${[...new Set(ATL.map(l => l.g))].map(g => `<optgroup label="${esc(g)}">${ATL.filter(l => l.g === g).map(l => `<option value="${l.k}" ${l.k === st.layer ? 'selected' : ''}>${esc(l.t)}</option>`).join('')}</optgroup>`).join('')}</select>`)}
      ${ctl('Find a city, ZIP or school district', `<input type="text" id="atFind" list="atList" placeholder="${esc(`${topCity.n}, ${topZip} or ${topIsd.n}`)}" autocomplete="off" aria-describedby="atFindMsg"><datalist id="atList"></datalist><span class="small" id="atFindMsg" role="status" aria-live="polite"></span>`)}
      <div class="presets" id="atPresets">${A.presets.map(p => `<button type="button" class="btn" data-k="${p.k}">${esc(p.t)}</button>`).join('')}</div>
    </div>
    <div class="chips" id="atOv">${AT_OV.map(o => `<label class="chip ${st.ov[o[0]] ? 'on' : ''}"><input type="checkbox" data-k="${o[0]}" ${st.ov[o[0]] ? 'checked' : ''}>${esc(o[1])}</label>`).join('')}</div>
    <div class="atlas-grid">
      <div>
        <div class="amap" id="atMap" tabindex="0" role="application" aria-roledescription="map" aria-describedby="atHint" aria-label="${esc(MN)} block group map. Drag to move; hold Ctrl or Cmd and scroll, or pinch, to zoom. With the map focused the arrow keys move it and plus and minus zoom.">
          <svg id="atWorld" class="world" preserveAspectRatio="none"></svg>
          <svg id="atOvl" class="ovl"><g id="atOvG"></g></svg>
          <div class="zoomctl"><button type="button" id="atZin" aria-label="Zoom in"><svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg></button><button type="button" id="atZout" aria-label="Zoom out"><svg viewBox="0 0 16 16"><path d="M3 8h10"/></svg></button><button type="button" id="atZhome" aria-label="Back to the metro view"><svg viewBox="0 0 16 16"><path d="M2.5 8.5L8 3l5.5 5.5M4.5 7v6h7V7"/></svg></button></div>
          <div class="scalebar" id="atScale"></div>
          <div class="maphint" id="atHint">Click the map, or hold Ctrl or Cmd, to zoom with the scroll wheel</div>
        </div>
        <div class="amap-legend" id="atLegend"></div>
        <div class="fitw" id="atFitW"></div>
      </div>
      <div class="atside" id="atSide"></div>
    </div>
  </div>
  <div class="grid2" style="margin-top:14px">
    <div class="panel"><h3>${esc(MN)} in focus</h3><div class="sub">The counties with the most filings, then every ZIP code ranked by expected filings a year. ZIP figures add up the block groups whose largest part lies in each ZIP.</div><div id="atFocus"></div></div>
    <div class="panel"><h3>Where to look first</h3><div class="sub">Block groups ranked by Market Fit inside the area you choose. Click a row to see it on the map. The pin file drops a one mile radius on each for Google Ads or Meta.</div>
      <div class="atlas-ctl" style="margin:8px 0">${ctl('Area', sel('atArea', areaOpts, st.area))}${ctl('Rows', sel('atTopN', [[25, '25'], [50, '50'], [100, '100'], [250, '250']], st.topN))}<span class="sp"></span><button class="btn" id="atCsvPin">↓ Pin targets CSV</button><button class="btn" id="atCsvZip">↓ ZIP targets CSV</button></div>
      <div id="atTop"></div></div>
  </div>
  ${bycKeys.length ? `<div class="panel" style="margin-top:14px"><h3 id="atByCtyH"></h3><div class="sub" id="atByCtySub"></div>${bycKeys.length > 1 ? `<div class="atlas-ctl" style="margin:8px 0">${ctl('County', sel('atByCtySel', bycKeys.map(f => [f, cName(f) + ' County']), st.byc))}</div>` : ''}<div id="atByCty"></div></div>` : ''}
  <div class="panel" style="margin-top:14px"><h3>${esc(MN)} cities</h3><div class="sub">Every city and town of 2,500 or more in the ${atNum(nC)} ${nC === 1 ? 'county' : 'counties'}. Sort any column; click a city to see it on the map.</div><div id="atCities"></div></div>
  <div class="panel" style="margin-top:14px"><h3>School districts</h3><div class="sub">Custody orders in Texas often restrict a child's residence to a county or a school district, so these lines matter in relocation and modification cases.</div><div id="atIsd"></div></div>
  <div class="panel" style="margin-top:14px"><h3>Counties and courthouses</h3><div class="sub">A divorce is filed in the county where a spouse has lived for 90 days (and in Texas for six months). ${courtNote}${gapNote}</div><div id="atCounties"></div></div>`;

  // ---------- map scaffolding
  const mapEl = $('#atMap'), world = $('#atWorld'), ovl = $('#atOvl'), ovG = $('#atOvG');
  const W = A.meta.W, H = A.meta.H;
  world.innerHTML = `<rect class="sea" x="0" y="0" width="${W}" height="${H}"></rect>
    <g class="water" id="atWater">${A.water.map(d => `<path d="${d}"></path>`).join('')}</g>
    <g class="bgs" id="atBgs">${B.d.map((d, i) => `<path class="bg" data-i="${i}" d="${d}"></path>`).join('')}</g>
    <g class="roads" id="atRoads">${A.roads.map(r => `<path class="${r.c}" d="${r.d}"></path>`).join('')}</g>
    <g class="zips" id="atZips">${A.zcta.map(z => `<path class="c" d="${z.d}"></path>`).join('')}${A.zcta.map(z => `<path d="${z.d}"></path>`).join('')}</g>
    <g class="isds" id="atIsds">${A.isd.map(z => `<path class="c" d="${z.d}"></path>`).join('')}${A.isd.map(z => `<path d="${z.d}"></path>`).join('')}</g>
    <g class="places" id="atPlaces">${PL.map(p => `<path d="${p.d}"></path>`).join('')}</g>
    <g class="ctys">${A.counties.map(c => `<path d="${c.d}"></path>`).join('')}</g>
    <g class="hl" id="atHl"></g><g class="selg" id="atSel"></g>`;
  const paths = $$('path.bg', world);
  let view = { x: 0, y: 0, w: W, h: H }, ov0 = null, raf = 0, tFull = 0;
  const MINW = 1.2 * MI_U, MAXW = W * 1.25;
  function size() { const r = mapEl.getBoundingClientRect(); return { cw: Math.max(1, r.width), ch: Math.max(1, r.height), r }; }
  function fitBB(bb, pad = 0.06) {
    const { cw, ch } = size(); let w = bb[2] - bb[0], h = bb[3] - bb[1]; w *= 1 + pad * 2; h *= 1 + pad * 2;
    const asp = ch / cw; if (h / w > asp) w = h / asp; else h = w * asp;
    w = clamp(w, MINW, MAXW); h = w * asp;
    view = { x: (bb[0] + bb[2]) / 2 - w / 2, y: (bb[1] + bb[3]) / 2 - h / 2, w, h }; schedule(true);
  }
  function zoomAt(cx, cy, f) {
    const { r } = size(); const k = r.width / view.w; const wx = view.x + (cx - r.left) / k, wy = view.y + (cy - r.top) / k;
    const nw = clamp(view.w * f, MINW, MAXW); const nf = nw / view.w;
    view = { x: wx - (wx - view.x) * nf, y: wy - (wy - view.y) * nf, w: nw, h: nw * r.height / r.width }; schedule();
  }
  function applyView() {
    const { cw, ch } = size(); view.h = view.w * ch / cw;
    world.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    ovl.setAttribute('viewBox', `0 0 ${cw} ${ch}`);
    const k = cw / view.w;
    if (ov0) { const s = k / ov0.k; ovG.setAttribute('transform', `translate(${(ov0.x - view.x) * k} ${(ov0.y - view.y) * k}) scale(${s})`); }
    const km = view.w / 100;
    mapEl.classList.toggle('zart', km < 26); mapEl.classList.toggle('zfar', km > 90);
    scaleBar(k);
  }
  function schedule(now) {
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (live()) applyView(); });
    clearTimeout(tFull); tFull = setTimeout(() => { if (!live()) return; applyView(); renderOverlay(); store.set('sev.atlas.view.' + mk, view); }, now ? 0 : 150);
  }
  function scaleBar(k) {
    const pxMi = k * MI_U; const nice = [0.25, 0.5, 1, 2, 5, 10, 20, 50]; let m = nice[0];
    for (const n of nice) if (n * pxMi <= 150) m = n;
    $('#atScale', root).innerHTML = `<span style="width:${Math.round(m * pxMi)}px"></span>${m < 1 ? N(m, 2) : N(m, 0)} ${m === 1 ? 'mile' : 'miles'}`;
  }
  // ---------- overlay: labels, markers, collision
  const shieldTxt = t => t === 'Dallas North Tollway' ? 'DNT' : t === 'Chisholm Trail Pkwy' ? 'CTP' : t;
  function renderOverlay() {
    const { cw, ch } = size(); const k = cw / view.w; const km = view.w / 100;
    ov0 = { x: view.x, y: view.y, k }; ovG.removeAttribute('transform');
    const S = (x, y) => [(x - view.x) * k, (y - view.y) * k];
    const on = (x, y, m = 40) => x > -m && y > -m && x < cw + m && y < ch + m;
    const out = []; const boxes = [];
    const fits = (x, y, w, h) => { if (x < 2 || y < 2 || x + w > cw - 2 || y + h > ch - 2) return false; for (const b of boxes) if (x < b[0] + b[2] && x + w > b[0] && y < b[1] + b[3] && y + h > b[1]) return false; boxes.push([x, y, w, h]); return true; };
    if (st.ov.courts) A.courts.forEach(c => { const [x, y] = S(c.p[0], c.p[1]); if (!on(x, y)) return; out.push(`<g class="court" data-tip="court:${c.f}" transform="translate(${x} ${y})"><rect x="-7" y="-7" width="14" height="14"></rect><path d="M-4 3h8M-3 -1v4M0 -1v4M3 -1v4M-4.5 -1.5h9L0 -5z"></path></g>`); boxes.push([x - 8, y - 8, 16, 16]); if (km < 170) { const t = cName(c.f) + ' County courts'; const w = atTextW(t, 11, 600) + 8; if (fits(x + 10, y - 8, w, 16)) out.push(`<text class="courtl" x="${x + 12}" y="${y + 4}">${esc(t)}</text>`); } });
    if (st.ov.warn && A.warn.length) { const mx = Math.max(1, ...A.warn.map(w => w.w)); A.warn.forEach((w, i) => { const [x, y] = S(w.p[0], w.p[1]); if (!on(x, y)) return; const r = 4 + 18 * Math.sqrt(w.w / mx); out.push(`<circle class="warnb" data-tip="warn:${i}" cx="${x}" cy="${y}" r="${r}"></circle>`); }); }
    if (st.ov.labels) {
      const cand = [];
      PL.forEach(p => {
        const pop = p.p || 0; const fz = pop >= 1e6 ? 15.5 : pop >= 2e5 ? 13.5 : pop >= 5e4 ? 12.5 : pop >= 1e4 ? 11.5 : 10.5;
        const show = pop >= 1e6 || (pop >= 2e5 && km < 420) || (pop >= 5e4 && km < 170) || (pop >= 1e4 && km < 85) || (pop >= 1500 && km < 38) || km < 16;
        if (show) cand.push({ t: p.n, x: p.l[0], y: p.l[1], pr: 7 - Math.log10(pop + 10), fz, cls: 'cl' });
      });
      if (km > 60) A.counties.forEach(c => cand.push({ t: c.n.toUpperCase() + (cw >= 520 ? ' COUNTY' : ''), x: c.l[0], y: c.l[1], pr: 0.5, fz: cw >= 520 ? 11 : 10, cls: 'ctyl', ls: 1.8 }));
      if (st.ov.water && km < 130) A.water_labels.forEach(w => cand.push({ t: w.n, x: w.l[0], y: w.l[1], pr: 4.8 - Math.log10(w.a + 1) * 0.2, fz: 10.5, cls: 'lakel' }));
      if (st.ov.isd && km < 95) A.isd.forEach(z => cand.push({ t: z.n, x: z.l[0], y: z.l[1], pr: 5.2, fz: 10.5, cls: 'isdl' }));
      if (st.ov.zip && km < 48) A.zcta.forEach(z => cand.push({ t: z.z, x: z.l[0], y: z.l[1], pr: 5.6, fz: 10, cls: 'zipl' }));
      if (st.ov.roads && km < 220) A.shields.forEach(s => cand.push({ t: shieldTxt(s.t), x: s.x, y: s.y, pr: ({ 1: 3.2, 2: 3.6, 3: 4.0, 4: 4.4 })[s.p] + (km > 120 && s.p > 2 ? 3 : 0), fz: 9.5, cls: 'shield', sh: true, full: s.t }));
      cand.sort((a, b) => a.pr - b.pr);
      const seen = {};
      for (const c of cand) {
        const [x, y] = S(c.x, c.y); if (!on(x, y, 0)) continue;
        const w = atTextW(c.t, c.fz, c.cls === 'lakel' ? 500 : 700, c.ls ? 0.18 : 0) + (c.sh ? 10 : 6), h = c.fz + (c.sh ? 7 : 4);
        if (c.sh) { const key = c.t; if (seen[key] && seen[key].some(([a, b]) => Math.hypot(a - x, b - y) < 170)) continue; }
        let ox = 0, oy = 0, placed = false;
        const tries = c.sh || c.pr > 2.6 ? [[0, 0]] : [[0, 0], [0, -h - 3], [0, h + 3], [w / 2 + 14, 0], [-w / 2 - 14, 0]];
        for (const [dx, dy] of tries) { if (fits(x + dx - w / 2, y + dy - h / 2, w, h)) { ox = dx; oy = dy; placed = true; break; } }
        if (!placed) continue;
        if (c.sh) { (seen[c.t] = seen[c.t] || []).push([x, y]); out.push(`<g class="shield ${/^IH/.test(c.t) ? 'ih' : /^US/.test(c.t) ? 'us' : 'sh'}" transform="translate(${x} ${y})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="2"></rect><text y="3.4" text-anchor="middle">${esc(c.t)}</text></g>`); }
        else out.push(`<text class="${c.cls}" x="${x + ox}" y="${y + oy + c.fz * 0.35}" text-anchor="middle" style="font-size:${c.fz}px${c.ls ? ';letter-spacing:.18em' : ''}">${esc(c.t)}</text>`);
      }
    }
    ovG.innerHTML = out.join('');
  }
  // ---------- colors and legend
  let breaks = null;
  function colorize() {
    const L = ATLI[st.layer];
    if (L.cat) {
      paths.forEach((p, i) => { p.style.fill = VEN[CC[B.c[i]]]; p.classList.toggle('nd', false); });
      $('#atLegend').innerHTML = `<div class="catleg">${byPop.map(c => `<span><i style="background:${VEN[c.f]}"></i>${esc(cName(c.f))}${courtBy[c.f] ? ' · ' + esc(courtBy[c.f].n) : A.meta.seat[c.f] ? ' · courts in ' + esc(A.meta.seat[c.f]) : ''}</span>`).join('')}</div>`;
      return;
    }
    const vals = []; for (let i = 0; i < nB; i++) { const v = val(L.k, i); if (B.ok[i] && isN(v)) vals.push(v); }
    vals.sort((a, b) => a - b);
    if (!vals.length) { paths.forEach(p => { p.style.fill = ''; p.classList.add('nd'); }); $('#atLegend').innerHTML = `<div class="legend"><span>${esc(L.t)}</span><span class="small">no block group has a value</span></div>`; return; }
    const q = p => vals[clamp(Math.floor(p * (vals.length - 1)), 0, vals.length - 1)];
    // up to eight classes with about equal numbers of block groups; tied values (many zeros) share a class instead of leaving empty ones
    breaks = [...new Set([1, 2, 3, 4, 5, 6, 7].map(j => q(j / 8)))].filter(b => b < q(1));
    const nc = breaks.length + 1; const R0 = RAMPS[L.ramp]; const R = nc === 1 ? [R0[4]] : Array.from({ length: nc }, (x, j) => R0[Math.round(j * 7 / (nc - 1))]);
    const cls = v => { let c = 0; while (c < nc - 1 && v > breaks[c]) c++; return L.rev ? nc - 1 - c : c; };
    paths.forEach((p, i) => { const v = val(L.k, i); const okv = B.ok[i] && isN(v); p.style.fill = okv ? R[cls(v)] : ''; p.classList.toggle('nd', !okv); });
    const lo = q(0), hi = q(1); const edge = j => j === 0 ? lo : breaks[j - 1], top = j => j === nc - 1 ? hi : breaks[j];
    const sw = (L.rev ? R.slice().reverse() : R);
    $('#atLegend').innerHTML = `<div class="legend"><span>${esc(L.t)}</span><span class="steps">${sw.map((c, j) => { const jj = L.rev ? nc - 1 - j : j; return `<i style="background:${c}" title="${esc(L.f(edge(jj)))} to ${esc(L.f(top(jj)))}"></i>`; }).join('')}</span><span class="num">${esc(L.f(L.rev ? hi : lo))}</span><span class="small">to</span><span class="num">${esc(L.f(L.rev ? lo : hi))}</span><span class="nd"></span><span class="small">few residents or group quarters</span></div><div class="small">${nc === 8 ? 'Eight classes' : nc === 1 ? 'One class' : atNum(nc).replace(/^./, ch => ch.toUpperCase()) + ' classes (tied values share a class)'} with about equal numbers of block groups. ${st.layer === 'fit' ? 'Market Fit blends the three weights below; move them and the map reranks.' : ''} On a touch screen, tap the map once to pan it with a finger; pinch to zoom.</div>`;
  }
  function fitWeights() {
    const lab = { vol: 'Volume: expected filings within a mile', val: 'Case value: income, $150,000 households, home values', comp: 'Less competition: filings per nearby law office' };
    $('#atFitW').innerHTML = st.layer !== 'fit' ? '' : `<div class="fitgrid">${Object.keys(lab).map(k => `<label><span>${esc(lab[k])}</span><input type="range" min="0" max="100" step="5" value="${st.w[k]}" data-k="${k}"><b>${st.w[k]}</b></label>`).join('')}<p class="small" id="atFitMsg" role="status" aria-live="polite" style="grid-column:1/-1;margin:0"></p></div>`;
    // Market Fit needs at least one weight above zero: the last one standing stops at 5
    $$('#atFitW input').forEach(inp => inp.oninput = () => { let v = +inp.value; const others = Object.keys(st.w).filter(k => k !== inp.dataset.k).reduce((a, k) => a + (+st.w[k] || 0), 0); const note = $('#atFitMsg'); if (!others && v <= 0) { v = 5; inp.value = 5; if (note) note.textContent = 'At least one weight stays above zero, or Market Fit has nothing to blend.'; } else if (note) note.textContent = ''; st.w[inp.dataset.k] = v; inp.nextElementSibling.textContent = v; store.set('sev.atlas.fitw', st.w); computeFit(); colorize(); topTable(); if (st.sel >= 0) sideBG(st.sel); });
  }
  // ---------- tooltips and selection
  const placeOf = i => B.pl[i] >= 0 ? PL[B.pl[i]].n : 'Unincorporated area';
  const postal = z => (ZI[z] && ZI[z].city) || '';
  const placeLabel = i => B.pl[i] >= 0 ? PL[B.pl[i]].n : postal(B.zip[i]) ? postal(B.zip[i]) + ' area' : 'Unincorporated area';
  const isdOf = i => B.isd[i] >= 0 ? A.isd[B.isd[i]].n : NA;
  const bgName = i => { const g = B.id[i]; const t = g.slice(5, 11); const tr = (+t.slice(0, 4)) + (t.slice(4) !== '00' ? '.' + t.slice(4) : ''); return `Tract ${tr}, block group ${g.slice(11)}`; };
  function tipBG(i) {
    const L = ATLI[st.layer]; const v = L.cat ? CN[B.c[i]] + ' County' : val(L.k, i);
    return `<b>${esc(placeLabel(i))}</b> · ${esc(CN[B.c[i]])} County<div class="small">${esc(bgName(i))} · ZIP ${esc(B.zip[i] || NA)}</div>
      <div class="row"><span>${esc(L.t)}</span><span>${L.cat ? esc(v) : (B.ok[i] && isN(v) ? esc(L.f(v)) : 'few residents')}</span></div>
      <div class="row"><span>Expected divorces a year</span><span>${N(V.xd[i], 1)}</span></div>
      <div class="row"><span>Married adults</span><span>${N(V.married[i])}</span></div>
      <div class="row"><span>Median household income</span><span>${$$$(V.inc[i])}</span></div>
      <div class="row"><span>School district</span><span>${esc(isdOf(i))}</span></div>`;
  }
  function tipOther(key) {
    if (key.startsWith('court:')) { const c = courtBy[key.slice(6)]; return `<b>${esc(c.n)}</b><div class="small">${esc(c.a)}</div><div class="small">${esc(cName(c.f))} County district courts, family cases</div>`; }
    if (key.startsWith('warn:')) { const w = A.warn[+key.slice(5)]; return `<b>${esc(w.city)}</b> · layoff notices<div class="small">${N(w.n)} WARN notices, ${N(w.w)} workers, ${esc(fmtDate(A.meta.warn_window[0]))} to ${esc(fmtDate(A.meta.warn_window[1]))}</div>${w.top.slice(0, 5).map(t => `<div class="row"><span>${esc(CO(t[1]))}</span><span>${N(t[2])}</span></div>`).join('')}`; }
    return '';
  }
  function select(i, zoom) {
    st.sel = i; $('#atSel').innerHTML = i >= 0 ? `<path d="${B.d[i]}"></path>` : '';
    if (i >= 0) { sideBG(i); if (zoom) { const cx = B.cx[i], cy = B.cy[i]; const w = Math.max(MINW * 2.5, view.w < 3 * MI_U * 2 ? view.w : 3 * MI_U * 2); fitBB([cx - w / 2, cy - w / 3, cx + w / 2, cy + w / 3], 0); } }
  }
  function highlight(d) { $('#atHl').innerHTML = d ? `<path class="c" d="${d}"></path><path d="${d}"></path>` : ''; }
  const toMap = () => mapEl.scrollIntoView({ behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  // ---------- side panel
  function kv(rows) { return `<dl class="kv">${rows.map(r => `<dt>${esc(r[0])}</dt><dd>${r[1]}</dd>`).join('')}</dl>`; }
  function venueLine(f) { const c = courtBy[f]; return c ? `${esc(c.n)}, ${esc(c.a.split(', ').pop())}` : `${esc(cName(f))} County district courts${A.meta.seat[f] ? ', ' + esc(A.meta.seat[f]) : ''}`; }
  function sideArea(o, title, sub, extra) {
    if (!o) { $('#atSide').innerHTML = '<div class="small">No residents in this area.</div>'; return; }
    $('#atSide').innerHTML = `<div class="sidehead"><div class="eyebrow">${esc(sub || 'Area')}</div><h3>${esc(title)}</h3></div>
      <div class="sidebig"><div><b>${N(o.xd, 0)}</b><span>expected divorce filings a year</span></div><div><b>${N(o.xk, 0)}</b><span>with children</span></div></div>
      ${kv([['Residents (ACS block groups)', N(o.pop)], ['Married adults (ACS block groups)', N(o.married)], ['Expected filings per 1,000 married', N(o.rate, 1)], ['Separated per 1,000 married', N(o.sep, 0)], ['Custody suits without a divorce', N(o.xs, 0) + ' a year'], ['Modifications and enforcements', N(o.xm, 0) + ' a year'], ['Median household income', $$$(o.inc)], ['Households at $150,000 or more', P(o.i150, 0)], ['Married couples raising children', P(o.kids, 0)], ['Owner occupied', P(o.own, 0)], ['Typical home value', $$$(o.val)], ['Pipeline and value (percentiles)', N(o.pipe, 0) + ' · ' + N(o.value, 0)]])}
      ${extra || ''}`;
  }
  function sideMetro() {
    const parts = byX.map(c => `<div class="part" data-f="${c.f}" role="button" tabindex="0" data-kbd><span class="vh">Zoom the map to </span><b>${esc(c.n)}</b><span>${N(c.xd, 0)} divorce filings in 12 months · ${N(c.married)} married · ${$$$(c.inc)} median income</span><span class="small">Files in ${venueLine(c.f)}</span></div>`).join('');
    sideArea(A.agg.metro, MN, mk === 'rgv' ? 'McAllen and Brownsville metros' : 'Metro', `<p class="small" style="margin-top:6px">Residents and married adults here add up ACS 2020 to 2024 block groups. The ${esc(MN)} tab counts Census Vintage 2025 residents and ACS county married adults, so its totals differ.</p><div class="parts">${parts}</div>`);
    $$('#atSide .part[data-f]').forEach(d => d.onclick = () => goCounty(d.dataset.f));
  }
  function sideBG(i) {
    const f = CC[B.c[i]]; const ok = B.ok[i];
    const comp = [['Volume', V.cvol[i], st.w.vol], ['Case value', V.value[i], st.w.val], ['Less competition', V.ccomp[i], st.w.comp]];
    $('#atSide').innerHTML = `<div class="sidehead"><div class="eyebrow">Block group · ${esc(CN[B.c[i]])} County</div><h3>${esc(placeLabel(i))}</h3><div class="small">${esc(bgName(i))}${B.pl[i] < 0 ? ' · not inside a single city' : ''} · ZIP ${esc(B.zip[i] || NA)} · ${esc(isdOf(i))}</div></div>
      ${ok ? `<div class="sidebig"><div><b>${N(fit[i], 0)}</b><span>Market Fit (0 to 100)</span></div><div><b>${N(V.xd[i], 1)}</b><span>expected divorces a year</span></div></div>
      <div class="bars">${comp.map(c => `<div><span>${c[0]}${c[2] ? '' : ' (off)'}</span><i><s style="width:${clamp(c[1] || 0, 0, 100)}%"></s></i><b>${N(c[1], 0)}</b></div>`).join('')}</div>` : `<div class="callout judg" style="margin:8px 0"><p>Too few household residents to score (${N(V.pop[i])} residents, ${P(V.gq[i], 0)} in group quarters such as dorms, jails or care homes).</p></div>`}
      ${kv([['Residents', N(V.pop[i])], ['Married adults', N(V.married[i])], ['Expected divorces with children', N(V.xk[i], 1) + ' a year'], ['Custody suits without a divorce', N(V.xs[i], 1) + ' a year'], ['Modifications and enforcements', N(V.xm[i], 1) + ' a year'], ['Expected within one mile', N(V.x1[i], 0) + ' a year'], ['Expected within three miles', N(V.x3[i], 0) + ' a year'],
        ['Local hazard per 1,000 married', N(V.haz[i], 1)], ['Separated per 1,000 married', N(V.sep[i], 0) + (isN(V.sepraw[i]) ? ` (survey ${N(V.sepraw[i], 0)})` : '')], ['Divorced per 1,000 residents 15+', N(V.div[i], 0)],
        ['Married couples raising children', P(V.kids[i], 0)], ['Median household income', $$$(V.inc[i])], ['Households at $150,000 or more', P(V.i150[i], 0)], ['Median home value', $$$(V.val[i])], ['Owner occupied', P(V.own[i], 0)],
        ['Mortgage 35% or more of income', P(V.mort[i], 0)], ['Unemployment (five year)', P(V.unemp[i], 1)], ['Law offices within three miles', N(V.o3[i])], ['Pipeline and value (percentiles)', N(V.pipe[i], 0) + ' · ' + N(V.value[i], 0)], ['Homes built, median year', V.yb[i] ? String(V.yb[i]) : NA]])}
      <div class="part" style="margin-top:8px"><b>Venue</b><span>${venueLine(f)}${isN(V.mic[i]) ? ` · ${N(V.mic[i], 1)} miles` : ''}</span></div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn" id="atBack">Back to ${esc(MN)}</button><button type="button" class="btn" id="atCopyPin">Copy pin (${N(V.lat[i], 4)}, ${N(V.lon[i], 4)})</button></div>`;
    $('#atBack').onclick = () => { select(-1); highlight(''); sideMetro(); };
    $('#atCopyPin').onclick = () => { const t = `${V.lat[i]}, ${V.lon[i]}`; const b = $('#atCopyPin'); const done = ok => { b.textContent = ok ? 'Copied ' + t : 'Select and copy: ' + t; }; const fall = () => { let ok = false; try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ok = !!(document.execCommand && document.execCommand('copy')); ta.remove(); } catch (e) { ok = false; } done(ok); }; try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => done(true)).catch(fall); else fall(); } catch (e) { fall(); } };
  }
  // ---------- areas: counties, cities, ZIP codes
  function bgAgg(ix) {
    if (!ix || !ix.length) return null;
    const s = k => sum(ix.map(i => V[k][i] || 0)); const mar = s('married');
    const wavg = k => { let a = 0, b = 0; ix.forEach(i => { if (isN(V[k][i])) { a += V[k][i] * (V.married[i] || 0); b += V.married[i] || 0; } }); return b ? a / b : null; };
    return { pop: s('pop'), married: mar, xd: s('xd'), xk: s('xk'), xs: s('xs'), xm: s('xm'), rate: mar ? s('xd') / mar * 1000 : null, sep: wavg('sep'), inc: wavg('inc'), i150: wavg('i150'), kids: wavg('kids'), own: wavg('own'), val: wavg('val'), pipe: wavg('pipe'), value: wavg('value') };
  }
  const zipAgg = z => bgAgg(ZIPS[z]);
  if (!A.agg._derived) { A.agg._derived = true; const have = new Set(A.agg.cities.map(c => c.n)); PL.forEach((p, i) => { if ((p.p || 0) < 2500 || have.has(p.n) || !(PLBG[i] || []).length) return; const o = bgAgg(PLBG[i]); const ct = [...new Set(PLBG[i].map(j => CN[B.c[j]]))]; const row = Object.assign({ n: p.n, bgs: PLBG[i].length, cty: ct, derived: true }, o); A.agg.cities.push(row); ct.forEach(cn => { const f = CC[CN.indexOf(cn)]; if (A.agg.bycounty[f]) A.agg.bycounty[f].push(Object.assign({}, row, { part: ct.length > 1 })); }); }); }
  const zipCity = z => { const t = {}; (ZIPS[z] || []).forEach(i => { const n = placeOf(i); t[n] = (t[n] || 0) + (V.pop[i] || 0); }); return Object.keys(t).sort((a, b) => t[b] - t[a])[0] || ''; };
  const ctyExtra = f => `<div class="part"><b>Venue</b><span>${venueLine(f)}</span></div>` + (gapCty.includes(f) ? `<div class="small" style="margin-top:8px">The clerk reports for ${esc(cName(f))} County show no family cases in the last twelve months, so these figures read zero.</div>` : '');
  function goCounty(f, scroll) {
    const c = A.counties.find(q => q.f === f); if (!c) return;
    fitBB(c.bb); highlight(c.d); select(-1);
    sideArea(CAG[f], c.n + ' County', 'County', ctyExtra(f));
    if (scroll) toMap();
  }
  function goCity(id, scroll = true) {
    const i = plIdx[id]; if (i === undefined) return;
    fitBB(PL[i].bb); highlight(PL[i].d); select(-1);
    const o = cityAgg(id); sideArea(o || bgAgg(PLBG[i]), id, o && !o.derived ? 'City' : 'City (block groups mostly inside its limits)');
    if (scroll) toMap();
  }
  function goZip(id, scroll = true) {
    const z = A.zcta.find(q => q.z === id);
    if (z) { fitBB(z.bb); highlight(z.d); }
    else if (ZIPS[id]) { const xs = ZIPS[id].map(i => B.cx[i]), ys = ZIPS[id].map(i => B.cy[i]); fitBB([Math.min(...xs) - 200, Math.min(...ys) - 200, Math.max(...xs) + 200, Math.max(...ys) + 200]); highlight(''); }
    else return;
    select(-1); sideArea(zipAgg(id), 'ZIP ' + id, 'ZIP code' + (postal(id) ? ' · ' + postal(id) : ''), '<div class="small" style="margin-top:8px">Adds up the block groups whose largest part lies in this ZIP; income and home value are averages of block group medians.</div>');
    if (scroll) toMap();
  }
  // ---------- events
  let ptrs = new Map(), drag = null, pinch = null, moved = false;
  mapEl.addEventListener('pointerdown', e => {
    if (e.target.closest('.zoomctl')) return;
    mapEl.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false; hideTip();
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, v: Object.assign({}, view) };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), v: Object.assign({}, view), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; drag = null; }
  });
  mapEl.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) {
      const t = e.target; const p = t.closest && t.closest('path.bg'); const o = t.closest && t.closest('[data-tip]');
      if (o) showTip(tipOther(o.dataset.tip), e.clientX, e.clientY); else if (p) showTip(tipBG(+p.dataset.i), e.clientX, e.clientY); else hideTip();
      return;
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { cw } = size();
    if (drag && ptrs.size === 1) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; mapEl.classList.add('drag'); } const k = cw / drag.v.w; view = Object.assign({}, drag.v, { x: drag.v.x - dx / k, y: drag.v.y - dy / k }); schedule(); }
    else if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); moved = true; const f = pinch.d / Math.max(d, 1); view = Object.assign({}, pinch.v); zoomAt(pinch.mx, pinch.my, f); }
  });
  const endPtr = e => {
    if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); mapEl.classList.remove('drag');
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0) { if (!moved && e.type === 'pointerup') { const el = document.elementFromPoint(e.clientX, e.clientY); const p = el && el.closest && el.closest('path.bg'); if (p) { highlight(''); select(+p.dataset.i); } } drag = null; }
  };
  mapEl.addEventListener('pointerup', endPtr); mapEl.addEventListener('pointercancel', endPtr);
  mapEl.addEventListener('pointerleave', e => { if (!ptrs.size) hideTip(); if (e.pointerType === 'mouse') mapEl.classList.remove('active'); });   // the wheel zooms only until the mouse leaves
  let hintT = 0;
  mapEl.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey || mapEl.classList.contains('active'))) { const h = $('#atHint'); h.classList.add('on'); clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove('on'), 1200); return; }
    e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(clamp(e.deltaY, -120, 120) * 0.0022));
  }, { passive: false });
  mapEl.addEventListener('dblclick', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, 0.5); });
  mapEl.addEventListener('focus', () => mapEl.classList.add('active')); mapEl.addEventListener('blur', () => mapEl.classList.remove('active')); mapEl.addEventListener('pointerdown', () => mapEl.classList.add('active'));
  mapEl.addEventListener('keydown', e => { const { cw } = size(); const k = cw / view.w; const step = 80 / k; if (e.key === '+' || e.key === '=') zoomAt(size().r.left + cw / 2, size().r.top + size().ch / 2, 0.7); else if (e.key === '-' || e.key === '_') zoomAt(size().r.left + cw / 2, size().r.top + size().ch / 2, 1.4); else if (e.key.startsWith('Arrow')) { e.preventDefault(); view.x += e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0; view.y += e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0; schedule(); } });
  const center = f => { const { r, cw, ch } = size(); zoomAt(r.left + cw / 2, r.top + ch / 2, f); };
  $('#atZin').onclick = () => center(0.6); $('#atZout').onclick = () => center(1.6);
  $('#atZhome').onclick = () => { fitBB(A.presets[0].bb); highlight(''); select(-1); sideMetro(); };
  $$('#atPresets button').forEach(b => b.onclick = () => {
    const p = A.presets.find(x => x.k === b.dataset.k); if (!p) return;
    fitBB(p.bb);
    if (p.k === 'metro' || p.k === 'all') { highlight(''); select(-1); sideMetro(); }
    else if (p.k.startsWith('c_')) { const f = p.k.slice(2); const c = A.counties.find(q => q.f === f); highlight(c ? c.d : ''); select(-1); sideArea(CAG[f], p.t, 'County', ctyExtra(f)); }
    else if (plIdx[p.t] !== undefined) { const i = plIdx[p.t]; highlight(PL[i].d); select(-1); const o = cityAgg(p.t); sideArea(o || bgAgg(PLBG[i]), p.t, 'City'); }
    else { const bb = p.bb; const ix = []; for (let i = 0; i < nB; i++) if (B.cx[i] >= bb[0] && B.cx[i] <= bb[2] && B.cy[i] >= bb[1] && B.cy[i] <= bb[3]) ix.push(i); highlight(''); select(-1); sideArea(bgAgg(ix), p.t, 'Area (block groups centered in this view)'); }
  });
  $$('#atMetros button').forEach(b => b.onclick = () => { if (b.dataset.mk === mk) return; const kf = document.activeElement === b; mountAtlas(root, b.dataset.mk); const nb = kf && $(`#atMetros button[data-mk="${b.dataset.mk}"]`); if (nb) nb.focus(); });
  // the metro tabs are one tab stop; the arrow keys, Home and End move between them and Enter or Space opens one
  { const tabs = $$('#atMetros button'); tabs.forEach(b => { b.tabIndex = b.dataset.mk === mk ? 0 : -1; }); $('#atMetros').onkeydown = e => { const i = tabs.indexOf(e.target); if (i < 0) return; const j = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1; if (j < 0) return; e.preventDefault(); tabs.forEach(x => { x.tabIndex = -1; }); tabs[j].tabIndex = 0; tabs[j].focus(); }; }
  $('#atLayer').onchange = e => { st.layer = e.target.value; store.set('sev.atlas.layer', st.layer); colorize(); fitWeights(); };
  $$('#atOv input').forEach(inp => inp.onchange = () => { st.ov[inp.dataset.k] = inp.checked; inp.parentElement.classList.toggle('on', inp.checked); store.set('sev.atlas.ov', st.ov); overlays(); renderOverlay(); });
  function overlays() { const t = (id, on) => { const g = $(id); if (g) g.style.display = on ? '' : 'none'; }; t('#atPlaces', st.ov.places); t('#atIsds', st.ov.isd); t('#atZips', st.ov.zip); t('#atRoads', st.ov.roads); t('#atWater', st.ov.water); }
  // search
  const finds = [];
  PL.filter(p => p.p >= 500).sort((a, b) => b.p - a.p).forEach(p => finds.push({ t: p.n, kind: 'City' }));
  A.isd.forEach(z => finds.push({ t: z.n, kind: 'School district', bb: z.bb, d: z.d }));
  A.zcta.forEach(z => finds.push({ t: z.z, kind: 'ZIP' }));
  A.counties.forEach(c => finds.push({ t: c.n + ' County', kind: 'County', f: c.f }));
  $('#atList').innerHTML = finds.map(f => `<option value="${esc(f.t)}">${esc(f.kind)}</option>`).join('');
  let findLast = '', findT = 0;
  const doFind = () => {
    const raw = $('#atFind').value.trim(); const q = raw.toLowerCase(); const msg = $('#atFindMsg'); if (!q) { msg.textContent = ''; $('#atFind').removeAttribute('aria-invalid'); return; }
    if (q === findLast && performance.now() - findT < 500) return; findLast = q; findT = performance.now();   // Enter fires keydown and change: run once
    const f = finds.find(x => x.t.toLowerCase() === q) || finds.find(x => x.t.toLowerCase().startsWith(q)) || finds.find(x => x.t.toLowerCase().includes(q));
    $('#atFind').setAttribute('aria-invalid', String(!f));
    if (!f) { msg.textContent = `No city, ZIP, school district or county in ${MN} matches "${raw}".`; return; }
    msg.textContent = `Showing ${f.t} (${f.kind.toLowerCase().replace('zip', 'ZIP')}).`;
    if (f.kind === 'City') goCity(f.t, false);
    else if (f.kind === 'ZIP') goZip(f.t, false);
    else if (f.kind === 'County') goCounty(f.f, false);
    else { fitBB(f.bb); highlight(f.d); select(-1); sideArea(A.agg.isd.find(c => c.n === f.t), f.t, 'School district'); }
  };
  $('#atFind').addEventListener('change', doFind); $('#atFind').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doFind(); } });
  $('#atFind').addEventListener('input', () => { const q = $('#atFind').value.trim().toLowerCase(); if (q && finds.some(x => x.t.toLowerCase() === q)) doFind(); });   // a datalist pick navigates at once
  // ---------- tables below the map
  function focusBlock() {
    const card = c => `<div class="tile" data-f="${c.f}" role="button" tabindex="0" data-kbd><span class="vh">Zoom the map to this county: </span><div class="l"><span>${esc(c.n)}</span></div><div class="v">${N(c.xd, 0)}</div><div class="s">divorce filings in the last 12 months · ${N(c.xk, 0)} with children<br>${N(c.married)} married adults · ${$$$(c.inc)} median income<br>Files in ${venueLine(c.f)}</div></div>`;
    $('#atFocus').innerHTML = `<div class="tiles" style="grid-template-columns:repeat(2,minmax(0,1fr));margin:8px 0 12px">${byX.slice(0, 4).map(card).join('')}</div><h4 class="minihd">By ZIP code</h4><div id="atFocZip"></div>`;
    $$('#atFocus .tile[data-f]').forEach(d => d.onclick = () => goCounty(d.dataset.f, true));
    const cols = [{ k: 'n', l: 'ZIP' }, { k: 'city', l: 'City', cls: 'l' }, { k: 'xd', l: 'Divorces a yr', fmt: v => N(v, 0) }, { k: 'xk', l: 'With kids', fmt: v => N(v, 0) }, { k: 'married', l: 'Married', fmt: v => N(v) }, { k: 'inc', l: 'Median income', fmt: v => $$$(v) }, { k: 'i150', l: '$150k+', fmt: v => P(v, 0) }];
    const rows = Object.keys(ZIPS).map(z => Object.assign({ _id: z, n: z, city: postal(z) || zipCity(z) }, zipAgg(z)));
    table($('#atFocZip'), { caption: 'ZIP codes by expected filings', cols, rows, sort: { k: 'xd', dir: -1 }, limit: 25, onRow: id => goZip(id) });
  }
  let topRows = [], topTbl = null;
  const bgShort = i => { const g = B.id[i]; const t = g.slice(5, 11); return `${+t.slice(0, 4)}${t.slice(4) !== '00' ? '.' + t.slice(4) : ''} · ${g.slice(11)}`; };
  const inArea = i => st.area === 'all' ? true : st.area.startsWith('c:') ? CC[B.c[i]] === st.area.slice(2) : B.pl[i] === plIdx[st.area.slice(2)];
  function topTable() {
    topRows = [];
    for (let i = 0; i < nB; i++) if (B.ok[i] && isN(fit[i]) && inArea(i)) topRows.push(i);
    topRows.sort((a, b) => fit[b] - fit[a]); topRows = topRows.slice(0, st.topN);
    const rows = topRows.map((i, r) => ({ _id: String(i), rank: r + 1, n: placeLabel(i), bg: bgShort(i), zip: B.zip[i], isd: isdOf(i).replace(/ C?ISD$/, ''), xd: V.xd[i], x1: V.x1[i], inc: V.inc[i], fit: fit[i] }));
    topTbl = table($('#atTop'), { caption: 'Block groups ranked by Market Fit', cols: [{ k: 'rank', l: '#', cls: 'rank' }, { k: 'n', l: 'Area', cls: 'l', fmt: (v, r) => `${esc(v)}<span class="bgid">tract ${esc(r.bg)}</span>` }, { k: 'zip', l: 'ZIP', cls: 'l' }, { k: 'isd', l: 'District', cls: 'l' }, { k: 'xd', l: 'Divorces a yr', fmt: v => N(v, 1) }, { k: 'x1', l: 'Within 1 mi', fmt: v => N(v, 0) }, { k: 'inc', l: 'Income', fmt: v => $$$(v) }, { k: 'fit', l: 'Fit', fmt: v => N(v, 0) }], rows, sort: { k: 'rank', dir: 1 }, onRow: id => { select(+id, true); toMap(); } });
  }
  $('#atArea').onchange = e => { st.area = e.target.value; topTable(); };
  $('#atTopN').onchange = e => { st.topN = +e.target.value; topTable(); };
  const areaName = () => st.area === 'all' ? MN : MN + ' ' + (st.area.startsWith('c:') ? cName(st.area.slice(2)) + ' county' : st.area.slice(2));
  // pins follow the table's current sort; rank stays the Market Fit rank
  const pinOrder = () => topTbl ? topTbl.sorted().map(r => +r._id) : topRows;
  $('#atCsvPin').onclick = () => exportText(expName('atlas_pins', areaName()), csv(pinOrder().map(i => ({ rank: topRows.indexOf(i) + 1, name: `${placeLabel(i)} ${B.zip[i] || ''} ${B.id[i].slice(5)}`.trim(), lat: V.lat[i], lon: V.lon[i], radius: 1, unit: 'mi', place: placeOf(i), zip: B.zip[i], county: CN[B.c[i]], xd: V.xd[i], x1: V.x1[i], inc: V.inc[i], fit: isN(fit[i]) ? Math.round(fit[i]) : '' })), [{ k: 'rank', l: 'Rank' }, { k: 'name', l: 'Target name' }, { k: 'lat', l: 'Latitude', d: 5 }, { k: 'lon', l: 'Longitude', d: 5 }, { k: 'radius', l: 'Radius' }, { k: 'unit', l: 'Unit' }, { k: 'place', l: 'City' }, { k: 'zip', l: 'ZIP' }, { k: 'county', l: 'County' }, { k: 'xd', l: 'Expected divorce filings a year', d: 1 }, { k: 'x1', l: 'Expected divorce filings within one mile a year', d: 0 }, { k: 'inc', l: 'Median household income ($)', d: 0 }, { k: 'fit', l: 'Market Fit (0 to 100)', d: 0 }]));
  $('#atCsvZip').onclick = () => {
    // filings add every block group in the ZIP (the same sums as the ZIP table); Market Fit averages the scored ones, married weighted
    const z = {}; for (let i = 0; i < nB; i++) { if (!B.zip[i] || !inArea(i)) continue; const o = z[B.zip[i]] = z[B.zip[i]] || { zip: B.zip[i], xd: 0, xk: 0, married: 0, fw: 0, fm: 0, bgs: 0, sc: 0, cty: {} }; o.xd += V.xd[i] || 0; o.xk += V.xk[i] || 0; o.married += V.married[i] || 0; o.bgs++; const cn = CN[B.c[i]]; o.cty[cn] = (o.cty[cn] || 0) + (V.pop[i] || 0); if (B.ok[i] && isN(fit[i])) { o.fw += fit[i] * (V.married[i] || 0); o.fm += V.married[i] || 0; o.sc++; } }
    const rows = Object.values(z).map(o => ({ zip: o.zip, city: postal(o.zip) || zipCity(o.zip), county: Object.keys(o.cty).sort((a, b) => o.cty[b] - o.cty[a])[0] || '', xd: o.xd, xk: o.xk, married: o.married, fit: o.fm ? o.fw / o.fm : null, bgs: o.bgs, sc: o.sc })).sort((a, b) => (b.fit || 0) - (a.fit || 0));
    exportText(expName('atlas_zips', areaName()), csv(rows, [{ k: 'zip', l: 'ZIP' }, { k: 'city', l: 'City' }, { k: 'county', l: 'County (most residents)' }, { k: 'fit', l: 'Market Fit (married weighted, scored block groups)', d: 0 }, { k: 'xd', l: 'Expected divorce filings a year', d: 1 }, { k: 'xk', l: 'With children', d: 1 }, { k: 'married', l: 'Married adults', d: 0 }, { k: 'bgs', l: 'Block groups' }, { k: 'sc', l: 'Block groups scored' }]));
  };
  $('#atCsvBg').onclick = () => {
    const rows = []; for (let i = 0; i < nB; i++) rows.push(i);
    // each layer at the precision the map shows it: shares as percents, money in whole dollars
    const AX = { kids: [0, 1], i150: [0, 1], own: [0, 1], mort: [0, 1], rent: [0, 1], snap: [1, 1], unemp: [1, 1], ba: [0, 1], c45: [0, 1], xd: [1], xden: [1], xk: [1], xs: [1], xm: [1], rate: [1], haz: [1], age: [1] };
    const vv = (k, i) => V[k] && isN(V[k][i]) ? V[k][i] : '';
    const cols = [{ k: i => B.id[i], l: 'Block group GEOID' }, { k: i => CN[B.c[i]], l: 'County' }, { k: i => placeOf(i), l: 'City' }, { k: i => B.zip[i], l: 'ZIP' }, { k: i => isdOf(i), l: 'School district' }, { k: i => V.lat[i], l: 'Latitude', d: 5 }, { k: i => V.lon[i], l: 'Longitude', d: 5 }, { k: i => B.ok[i] ? 'yes' : 'no', l: 'Scored' }, { k: i => vv('pop', i), l: 'Residents', d: 0 }, { k: i => vv('gq', i), l: 'Group quarters share (%)', d: 0, pct: true }, { k: i => { const f = CC[B.c[i]]; const c = courtBy[f]; return c ? c.n + ', ' + c.a.split(', ').pop() : cName(f) + ' County district courts' + (A.meta.seat[f] ? ', ' + A.meta.seat[f] : ''); }, l: 'Filing venue' }, { k: i => vv('mic', i), l: 'Miles to the courthouse', d: 1 }, { k: i => vv('x3', i), l: 'Expected divorce filings within three miles a year', d: 0 }, { k: i => vv('sepraw', i), l: 'Separated per 1,000 married (raw survey)', d: 0 }]
      .concat(ATL.filter(l => !l.cat).map(l => { const x = AX[l.k] || [0]; return { k: i => { const v = val(l.k, i); return isN(v) ? v : ''; }, l: l.t + (x[1] ? ' (%)' : ['inc', 'val'].includes(l.k) ? ' ($)' : ''), d: x[0], pct: !!x[1] }; }));
    exportText(expName('atlas_block_groups', MN), csv(rows, cols));
  };
  $('#atGoMetro').onclick = () => showModule(mk); $('#atGoDesk').onclick = () => goModule('desk', { geo: 'msa:' + A.meta.codes[0] });
  const cityCols = [{ k: 'n', l: 'City' }, { k: 'xd', l: 'Divorces a yr', fmt: v => N(v, 0) }, { k: 'xk', l: 'With kids', fmt: v => N(v, 0) }, { k: 'xs', l: 'Custody suits', fmt: v => N(v, 0) }, { k: 'xm', l: 'Mod + enf', fmt: v => N(v, 0) }, { k: 'rate', l: 'Per 1k married', fmt: v => N(v, 1) }, { k: 'sep', l: 'Separated per 1k', fmt: v => N(v, 0) }, { k: 'inc', l: 'Median income', fmt: v => $$$(v) }, { k: 'i150', l: '$150k+', fmt: v => P(v, 0) }, { k: 'kids', l: 'Raising kids', fmt: v => P(v, 0) }];
  const cityRow = o => Object.assign({ _id: o.n }, o);
  function byCounty() {
    if (!st.byc) return;
    const f = st.byc; const nm = cName(f);
    $('#atByCtyH').textContent = `${nm} County, city by city`;
    $('#atByCtySub').innerHTML = `Only the ${esc(nm)} County part of each city. Cities are built from the block groups they cover, weighted by area, so edges are approximate. Courthouse for all of these: ${venueLine(f)}.`;
    table($('#atByCty'), { cols: cityCols.map(c => c.k === 'n' ? Object.assign({}, c, { fmt: (v, r) => esc(v) + (r.part ? ` <span class="small">(${esc(nm)} part)</span>` : '') }) : c), rows: A.agg.bycounty[f].map(cityRow), sort: { k: 'xd', dir: -1 }, onRow: goCity });
  }
  if ($('#atByCtySel')) $('#atByCtySel').onchange = e => { st.byc = e.target.value; byCounty(); };
  table($('#atCities'), { cols: cityCols.map(c => c.k === 'n' ? Object.assign({}, c, { fmt: (v, r) => esc(v) + (r.derived ? ' <span class="small">(from its block groups)</span>' : '') }) : c).concat([{ k: 'cty', l: 'Counties', cls: 'l', fmt: v => esc((v || []).join(', ')) }]), rows: A.agg.cities.map(cityRow), sort: { k: 'xd', dir: -1 }, onRow: goCity, limit: 60 });
  table($('#atIsd'), { cols: [{ k: 'n', l: 'District' }, { k: 'xd', l: 'Divorces a yr', fmt: v => N(v, 0) }, { k: 'xk', l: 'With kids', fmt: v => N(v, 0) }, { k: 'kids', l: 'Raising kids', fmt: v => P(v, 0) }, { k: 'inc', l: 'Median income', fmt: v => $$$(v) }], rows: A.agg.isd.map(cityRow), sort: { k: 'xk', dir: -1 }, limit: 40, onRow: id => { const z = A.isd.find(q => q.n === id); if (z) { fitBB(z.bb); highlight(z.d); select(-1); sideArea(A.agg.isd.find(c => c.n === id), id, 'School district'); toMap(); } } });
  table($('#atCounties'), { cols: [{ k: 'n', l: 'County' }, { k: 'xd', l: 'Divorces, 12 mo', fmt: v => N(v, 0) }, { k: 'xk', l: 'With kids', fmt: v => N(v, 0) }, { k: 'married', l: 'Married', fmt: v => N(v) }, { k: 'rate', l: 'Per 1k married', fmt: v => N(v, 1) }, { k: 'inc', l: 'Median income', fmt: v => $$$(v) }, { k: 'court', l: 'Family courts', cls: 'l', fmt: (v, r) => venueLine(r.f) }], rows: A.agg.counties.map(o => Object.assign({ _id: o.f, court: courtBy[o.f] ? courtBy[o.f].n : cName(o.f) + ' County district courts' }, o)), sort: { k: 'xd', dir: -1 }, onRow: id => goCounty(id, true) });
  // ---------- first paint
  overlays(); colorize(); fitWeights(); focusBlock(); topTable(); byCounty(); sideMetro();
  const saved = store.get('sev.atlas.view.' + mk, null);
  requestAnimationFrame(() => { if (!live()) return; if (saved && isN(saved.w) && saved.w > MINW && saved.w <= MAXW) { view = saved; schedule(true); } else fitBB(A.presets[0].bb, 0.02); });
  try { AT_RO = new ResizeObserver(() => { if (live() && !root.hidden) schedule(true); }); AT_RO.observe(mapEl); } catch (e) { AT_RS = () => { if (live()) schedule(true); }; window.addEventListener('resize', AT_RS); }
}
