/* ==== map ==== */
"use strict";
/* ============================ ZIP map (SVG, offline) ============================ */
const GEO = DATA.geo;
function proj(lon, lat) { return [(lon - GEO.minx) * GEO.kx * GEO.sx, (GEO.maxy - lat) * GEO.sx]; }
const COUNTY_LABEL = (() => {
  const out = {}; FIPS.forEach(f => { const zs = Z.filter(z => z.fips === f && isN(z.lat)); if (!zs.length) return; const w = zs.map(z => Math.max(1, z.sqmi || 1)); const sw = sum(w); const lat = sum(zs.map((z, i) => z.lat * w[i])) / sw, lon = sum(zs.map((z, i) => z.lon * w[i])) / sw; out[f] = proj(lon, lat); });
  const nudge = { '48113': [0, -40], '48439': [-60, 60], '48085': [0, -40], '48121': [-40, -60] };
  Object.keys(nudge).forEach(f => { if (out[f]) { out[f] = [out[f][0] + nudge[f][0], out[f][1] + nudge[f][1]]; } });
  return out;
})();
const MAP_CITIES = (() => {
  const seats = ['Weatherford', 'Cleburne', 'Waxahachie', 'Granbury', 'Decatur', 'Greenville', 'Kaufman', 'Terrell', 'Rockwall', 'Denton', 'McKinney', 'Ennis', 'Forney', 'Midlothian', 'Burleson', 'Mansfield', 'Keller', 'Southlake', 'Allen', 'Wylie', 'Prosper', 'Celina', 'Anna', 'Aledo', 'Azle', 'Royse City'];
  const list = CITIES.filter(c => isN(c.lat) && (c.pop >= 60000 || seats.includes(c.name))).sort((a, b) => b.pop - a.pop);
  const placed = []; const out = [];
  list.forEach(c => { const [x, y] = proj(c.lon, c.lat); const major = c.name === 'Dallas' || c.name === 'Fort Worth'; if (placed.some(p => Math.abs(p[0] - x) < (major ? 60 : 120) && Math.abs(p[1] - y) < 34)) return; placed.push([x, y]); out.push({ name: c.name, x, y, major }); });
  return out;
})();
class ZipMap {
  constructor(host, opts) {
    this.o = Object.assign({ labels: true, onSelect: null, onHover: null, aria: 'Map of Dallas Fort Worth ZIP codes' }, opts || {});
    this.host = host; this.k = 1; this.tx = 0; this.ty = 0; this.sel = null; this.pinsData = [];
    const W = GEO.W, H = GEO.H; this.W = W; this.H = H;
    host.innerHTML = `<div class="mapbox"><svg class="mapsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(this.o.aria)}"></svg><div class="maptools"><button type="button" data-z="in" title="Zoom in" aria-label="Zoom in">+</button><button type="button" data-z="out" title="Zoom out" aria-label="Zoom out">−</button><button type="button" data-z="reset" title="Reset view" aria-label="Reset view">⟲</button></div></div>`;
    const svg = this.svg = $('svg', host);
    const vp = this.vp = svgEl('g'); svg.appendChild(vp);
    this.gW = svgEl('g'); this.gZ = svgEl('g'); this.gC = svgEl('g'); this.gR = svgEl('g'); this.gP = svgEl('g'); this.gL = svgEl('g');
    [this.gZ, this.gW, this.gC, this.gR, this.gP, this.gL].forEach(g => vp.appendChild(g));
    GEO.water.forEach(w => this.gW.appendChild(svgEl('path', { d: w.d, class: 'wt' })));
    this.paths = {};
    Object.entries(GEO.zcta).forEach(([zip, d]) => { const p = svgEl('path', { d, class: 'z' }); p.dataset.zip = zip; this.gZ.appendChild(p); this.paths[zip] = p; });
    Object.values(GEO.county).forEach(d => this.gC.appendChild(svgEl('path', { d, class: 'cty' })));
    this.gC.appendChild(svgEl('path', { d: GEO.outline, class: 'outl' }));
    GEO.roads.forEach(r => this.gR.appendChild(svgEl('path', { d: r.d, class: 'rd' + (/^I- |Tpke|Tollway/.test(r.n) ? ' i' : '') })));
    this.labels = [];
    if (this.o.labels) {
      Object.entries(COUNTY_LABEL).forEach(([f, [x, y]]) => { const g = svgEl('g'); const t = svgEl('text', { class: 'lab ct', 'text-anchor': 'middle' }, CNAME(f)); g.appendChild(t); this.gL.appendChild(g); this.labels.push({ g, x, y }); });
      MAP_CITIES.forEach(c => { const g = svgEl('g'); const t = svgEl('text', { class: 'lab' + (c.major ? ' mj' : ''), 'text-anchor': 'middle', dy: '-6' }, c.name); const dot = svgEl('circle', { r: c.major ? 3.2 : 2.2, fill: cssv('--ink-2') }); g.appendChild(dot); g.appendChild(t); this.gL.appendChild(g); this.labels.push({ g, x: c.x, y: c.y, dot }); });
    }
    this.wire(); this.apply();
    if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this.apply()); this.ro.observe(svg); }
  }
  unit() { const w = this.svg.clientWidth || 900; return this.W / w; }
  apply() {
    this.vp.setAttribute('transform', `translate(${this.tx} ${this.ty}) scale(${this.k})`);
    const s = this.unit() / this.k;
    this.labels.forEach(l => l.g.setAttribute('transform', `translate(${l.x} ${l.y}) scale(${s})`));
    this.pinsData.forEach(p => p.g.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${s})`));
    this.gL.style.display = this.o.labels ? '' : 'none';
  }
  zoomAt(mx, my, f) { const nk = clamp(this.k * f, 1, 14), rf = nk / this.k; this.tx = mx - (mx - this.tx) * rf; this.ty = my - (my - this.ty) * rf; this.k = nk; if (this.k <= 1.001) { this.k = 1; this.tx = 0; this.ty = 0; } this.apply(); }
  reset() { this.k = 1; this.tx = 0; this.ty = 0; this.apply(); }
  fitTo(zips) {
    const xs = [], ys = []; zips.forEach(z => { const r = ZI[z]; if (r && isN(r.lat)) { const [x, y] = proj(r.lon, r.lat); xs.push(x); ys.push(y); } });
    if (!xs.length) return this.reset();
    const pad = 120; const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    const k = clamp(Math.min(this.W / (x1 - x0), this.H / (y1 - y0)), 1, 8); this.k = k; this.tx = this.W / 2 - k * (x0 + x1) / 2; this.ty = this.H / 2 - k * (y0 + y1) / 2; this.apply();
  }
  wire() {
    const svg = this.svg; let down = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0, hit = null, pid = null, pinHit = null;
    const toVB = e => { const r = svg.getBoundingClientRect(); const u = this.W / r.width; return [(e.clientX - r.left) * u, (e.clientY - r.top) * u]; };
    svg.addEventListener('pointerdown', e => { down = true; moved = false; sx = ox = e.clientX; sy = oy = e.clientY; pid = e.pointerId; const t = e.target; hit = t.dataset && t.dataset.zip ? t.dataset.zip : null; pinHit = t.closest && t.closest('[data-pin]') ? t.closest('[data-pin]').dataset.pin : null; });
    svg.addEventListener('pointermove', e => {
      if (down) { if (!moved && Math.abs(e.clientX - ox) + Math.abs(e.clientY - oy) > 4) { moved = true; svg.classList.add('drag'); try { svg.setPointerCapture(pid); } catch (_) { } hideTip(); }
        if (moved) { const u = this.unit(); this.tx += (e.clientX - sx) * u; this.ty += (e.clientY - sy) * u; sx = e.clientX; sy = e.clientY; this.apply(); return; } }
      const t = e.target; const pin = t.closest && t.closest('[data-pin]');
      if (pin && this.o.onPinHover) { this.o.onPinHover(pin.dataset.pin, e); return; }
      if (t.dataset && t.dataset.zip && this.o.onHover) this.o.onHover(t.dataset.zip, e); else hideTip();
    });
    const end = () => { if (down && !moved) { if (pinHit && this.o.onPin) this.o.onPin(pinHit); else if (hit && this.o.onSelect) this.o.onSelect(hit); } down = false; moved = false; hit = null; pinHit = null; svg.classList.remove('drag'); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', () => { down = false; moved = false; svg.classList.remove('drag'); });
    svg.addEventListener('pointerleave', () => hideTip());
    svg.addEventListener('wheel', e => { e.preventDefault(); const [mx, my] = toVB(e); this.zoomAt(mx, my, e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
    $$('.maptools button', this.host).forEach(b => b.onclick = () => { const z = b.dataset.z; if (z === 'in') this.zoomAt(this.W / 2, this.H / 2, 1.4); else if (z === 'out') this.zoomAt(this.W / 2, this.H / 2, 1 / 1.4); else this.reset(); });
  }
  fill(fn) { Object.entries(this.paths).forEach(([zip, p]) => { const c = fn(zip); p.style.fill = c || cssv('--nodata'); }); }
  dim(set) { Object.entries(this.paths).forEach(([zip, p]) => p.classList.toggle('dim', !!set && !set.has(zip))); }
  select(zip) { if (this.sel && this.paths[this.sel]) this.paths[this.sel].classList.remove('sel'); this.sel = zip; if (zip && this.paths[zip]) { this.paths[zip].classList.add('sel'); this.gZ.appendChild(this.paths[zip]); } }
  pins(list) {
    this.gP.innerHTML = ''; this.pinsData = [];
    (list || []).forEach(p => { const [x, y] = proj(p.lon, p.lat); const g = svgEl('g', { 'data-pin': p.id }); let shape;
      if (p.shape === 'diamond') { const r = p.r; shape = svgEl('path', { d: `M0 ${-r * 1.35}L${r * 1.35} 0L0 ${r * 1.35}L${-r * 1.35} 0Z`, class: 'pin' + (p.sel ? ' sel' : ''), fill: p.fill, 'fill-opacity': p.op || .92 }); }
      else shape = svgEl('circle', { r: p.r, class: 'pin' + (p.sel ? ' sel' : ''), fill: p.fill, 'fill-opacity': p.op || .85 });
      g.appendChild(shape); this.gP.appendChild(g); this.pinsData.push({ g, x, y }); });
    this.apply();
  }
  setLabels(on) { this.o.labels = on; this.apply(); }
}
function legendHTML(o) {
  const R = o.R || []; return `<div><div class="lt">${o.title}</div><div class="ramp">${R.map(c => `<i style="background:${c}"></i>`).join('')}</div><div class="rlabs"><span>${o.lo}</span><span>${o.hi}</span></div></div><div class="dn">${o.note || ''}</div>`;
}
