/* ==== brand ==== */
"use strict";
/* ============================ BRAND: the business this atlas is built for ============================ */
/* Identity read from integrityairconditioning.com (September 26, 2026): schema.org HVACBusiness block, Elementor kit colors, header
   fonts, navigation, dealer badges and the social profiles it links. Everything is editable from the Brand panel in the shell and
   persists in this browser; the defaults below are the fallback. Modules read BRAND for names, numbers, colors and links. */
const BRAND_DEFAULT = {
  name: 'Integrity Air Conditioning & Heating', short: 'Integrity Air', legal: 'Integrity Air Conditioning', tagline: 'Trust Us With Your Home Comfort',
  phone: '(972) 734-1428', url: 'https://www.integrityairconditioning.com', domain: 'integrityairconditioning.com', email: '',
  lic: 'TACLA124869E', street: '4180 IH 30, Ste A', city: 'Mesquite', state: 'TX', zip: '75150', lat: 32.8063, lon: -96.6609,
  hours: 'Monday to Saturday 7 am to 8 pm, Sunday by appointment', hoursSchema: 'Mo-Sa 07:00-20:00', founded: 1999, since: 'family owned since 1999',
  colors: { primary: '#173a69', secondary: '#4f8bc9', accent: '#edd21c', dark: '#112337' }, fonts: { display: 'Bebas Neue', body: 'Open Sans' },
  logoUrl: 'https://www.integrityairconditioning.com/wp-content/uploads/2025/08/integrityairconditioning-Logo.webp', logoData: '',
  dealer: ['Mitsubishi Electric Elite Diamond Contractor', 'Carrier'], plan: 'VIP Service Club', financing: 'Synchrony and Watercress', promo: '$50 off residential HVAC service',
  reviews: { rating: 4.9, count: 915, asOf: '2026-09-26', source: 'Google' }, guarantee: '100% satisfaction and performance guarantee', experience: '100 years of combined experience',
  acquired: ['Kirk Air Conditioning & Heating', 'Pape Air Conditioning & Heating', 'Carrollton Air Conditioning Inc.', 'A/C Heat by Russell'],
  social: { facebook: 'https://www.facebook.com/profile.php?id=61561369611852', facebookPageId: '61561369611852', instagram: 'https://www.instagram.com/integrityairconditioningllc/', youtube: 'https://www.youtube.com/@Integrityairconditioningllc', linkedin: 'https://www.linkedin.com/company/integrity-air-conditioning/', tiktok: 'https://www.tiktok.com/@integrityairconditioning', x: 'https://x.com/integrityactx', yelp: 'https://www.yelp.com/biz/integrity-air-conditioning-mesquite', maps: 'https://www.google.com/maps?cid=11741353371221982894' },
  pixels: { meta: ['1031454306003388', '1829475017967171', '859477720463294'] },
  services: ['AC repair', 'AC replacement', 'AC maintenance', 'AC inspection', 'ductless mini splits', 'heat pumps', 'geothermal', 'emergency HVAC', 'furnace repair', 'furnace replacement', 'heater repair', 'oil to gas conversion', 'indoor air quality', 'air filtration', 'duct cleaning', 'duct repair and replacement', 'dehumidifiers', 'humidifiers', 'HVAC zoning', 'thermostats', 'insulation', 'whole house fans', 'commercial HVAC'],
  serviceCities: ['Mesquite', 'Dallas', 'Fort Worth', 'Plano', 'Arlington', 'Frisco', 'McKinney', 'Carrollton', 'Irving', 'Garland', 'Addison', 'Allen', 'Anna', 'Balch Springs', 'Bedford', 'Burleson', 'Cedar Hill', 'Celina', 'Colleyville', 'Coppell', 'Crowley', 'Denton', 'Duncanville', 'Ennis', 'Euless', 'Farmers Branch', 'Fate', 'Flower Mound'],
};
let BRAND = (() => { const s = store.get('tda.brand.v1', null); const b = JSON.parse(JSON.stringify(BRAND_DEFAULT)); if (s && typeof s === 'object') { Object.keys(s).forEach(k => { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && b[k] && typeof b[k] === 'object') Object.assign(b[k], s[k]); else b[k] = s[k]; }); } return b; })();
const BRANDX = (() => {
  const hex2rgb = h => { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const rgb2hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const lum = h => { const [r, g, b] = hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const okHex = h => /^#[0-9a-f]{6}$/i.test(String(h || ''));
  function css() {
    const c = BRAND.colors; const P = okHex(c.primary) ? c.primary : '#173a69', S2 = okHex(c.secondary) ? c.secondary : '#4f8bc9', A = okHex(c.accent) ? c.accent : '#edd21c', Dk = okHex(c.dark) ? c.dark : '#112337';
    const accentInkL = lum(P) > 0.4 ? '#10191f' : '#ffffff', accentInkD = lum(S2) > 0.4 ? '#06201f' : '#ffffff';
    const goldL = lum(A) > 0.6 ? mix(A, '#000000', 0.22) : A;
    const disp = BRAND.fonts && BRAND.fonts.display ? `'${BRAND.fonts.display}',` : '', body = BRAND.fonts && BRAND.fonts.body ? `'${BRAND.fonts.body}',` : '';
    return `:root{--accent:${P};--accent-ink:${accentInkL};--accent-soft:${mix(P, '#ffffff', 0.86)};--navy:${Dk};--navy-2:${P};--navy-ink:${mix(P, '#ffffff', 0.88)};--navy-mute:${mix(P, '#ffffff', 0.6)};--bench:${goldL};--bench-soft:${mix(A, '#ffffff', 0.8)};--brand-gold:${A};--brand-sky:${S2};--sans:${body}'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;--brand-display:${disp}'IBM Plex Sans Condensed','Arial Narrow',system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--accent:${S2};--accent-ink:${accentInkD};--accent-soft:${mix(S2, '#0c1115', 0.75)};--navy:${mix(Dk, '#000000', 0.35)};--navy-2:${Dk};--bench:${A};--bench-soft:${mix(A, '#0c1115', 0.75)}}}
:root[data-theme="dark"]{--accent:${S2};--accent-ink:${accentInkD};--accent-soft:${mix(S2, '#0c1115', 0.75)};--navy:${mix(Dk, '#000000', 0.35)};--navy-2:${Dk};--bench:${A};--bench-soft:${mix(A, '#0c1115', 0.75)}}
.brandmark .nm,.mast h1,.big,.kpi .kv{font-family:var(--brand-display)}
.mast h1{letter-spacing:.02em;font-weight:400;font-size:40px}
.brandmark .nm{font-weight:400;font-size:24px;letter-spacing:.03em}
.kpi .kv{font-weight:400;font-size:30px;letter-spacing:.02em}
.rail button[aria-selected="true"]{background:var(--brand-gold);border-color:var(--brand-gold)}
.rail button[aria-selected="true"] .t{color:#112337}.rail button[aria-selected="true"] .n,.rail button[aria-selected="true"] .d{color:#3a4a5c}
:root[data-theme="dark"] .rail button[aria-selected="true"]{background:var(--brand-gold);border-color:var(--brand-gold)}
:root[data-theme="dark"] .rail button[aria-selected="true"] .t,:root[data-theme="dark"] .rail button[aria-selected="true"] .n,:root[data-theme="dark"] .rail button[aria-selected="true"] .d{color:#112337}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .rail button[aria-selected="true"]{background:var(--brand-gold);border-color:var(--brand-gold)}:root:not([data-theme="light"]) .rail button[aria-selected="true"] .t,:root:not([data-theme="light"]) .rail button[aria-selected="true"] .n,:root:not([data-theme="light"]) .rail button[aria-selected="true"] .d{color:#112337}}
.mast .rule{background:linear-gradient(90deg,var(--accent) 0 60%,var(--brand-gold) 60% 100%)}`;
  }
  function fallbackLogo(size) {
    const c = BRAND.colors; const P = okHex(c.primary) ? c.primary : '#173a69', A = okHex(c.accent) ? c.accent : '#edd21c', S2 = okHex(c.secondary) ? c.secondary : '#4f8bc9';
    return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="9" fill="${P}"/><path d="M8 21 20 10l12 11" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 19.5V30h16V19.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M15 25.5h10M15 22.5h10" stroke="${S2}" stroke-width="1.8" stroke-linecap="round"/><path d="M28.5 6.5v6M25.5 9.5h6M26.4 7.4l4.2 4.2M30.6 7.4l-4.2 4.2" stroke="${A}" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }
  function apply() {
    let st = document.getElementById('brand-style'); if (!st) { st = document.createElement('style'); st.id = 'brand-style'; document.head.appendChild(st); } st.textContent = css();
    const fam = [BRAND.fonts && BRAND.fonts.display, BRAND.fonts && BRAND.fonts.body].filter(Boolean); if (fam.length) { const id = 'brand-fonts'; let ln = document.getElementById(id); const href = 'https://fonts.googleapis.com/css2?' + fam.map(f => 'family=' + encodeURIComponent(f).replace(/%20/g, '+') + (f === 'Open Sans' ? ':ital,wght@0,400;0,600;0,700;1,400' : '')).join('&') + '&display=swap'; if (!ln) { ln = document.createElement('link'); ln.id = id; ln.rel = 'stylesheet'; document.head.appendChild(ln); } if (ln.href !== href) ln.href = href; }
    const bm = document.querySelector('.brandmark'); if (bm) {
      bm.innerHTML = `<div class="logo" id="brandLogo"></div><div><div class="nm">${esc(BRAND.name)}</div><div class="sb">${esc(BRAND.tagline)} · DFW Thermal Debt Atlas · ${esc(BRAND.city)}, ${esc(BRAND.state)} · TDLR ${esc(BRAND.lic)}</div></div>`;
      const host = bm.querySelector('#brandLogo'); const src = BRAND.logoData || BRAND.logoUrl; const fb = () => { host.innerHTML = fallbackLogo(38); host.classList.add('fb'); };
      if (src) { const img = new Image(); img.alt = BRAND.name + ' logo'; img.onload = () => { host.innerHTML = ''; host.appendChild(img); host.classList.remove('fb'); }; img.onerror = fb; img.src = src; fb(); } else fb();
    }
    try { document.title = `${BRAND.short} · DFW Thermal Debt Atlas`; } catch (e) { }
    BUS.emit('brand');
  }
  function save(patch) { BRAND = Object.assign(BRAND, patch || {}); const s = JSON.parse(JSON.stringify(BRAND)); store.set('tda.brand.v1', s); apply(); }
  function reset() { BRAND = JSON.parse(JSON.stringify(BRAND_DEFAULT)); store.set('tda.brand.v1', {}); apply(); }
  const addr = () => `${BRAND.street}, ${BRAND.city}, ${BRAND.state} ${BRAND.zip}`;
  /* ---------- settings panel ---------- */
  function panel() {
    let ov = document.getElementById('brandPanel'); if (ov) { ov.remove(); }
    ov = el('div', { id: 'brandPanel', class: 'overlay', role: 'dialog', 'aria-label': 'Brand settings' });
    const f = (k, lab, val, type, hint) => `<div class="f"><label class="fl" for="bp_${k}">${lab}</label><input type="${type || 'text'}" id="bp_${k}" data-k="${k}" value="${esc(val == null ? '' : val)}">${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    ov.innerHTML = `<div class="panel"><div class="card-h" style="display:flex;gap:10px;align-items:center"><div style="flex:1"><h3>Brand: who this atlas is built for</h3><p>Names, numbers and colors flow into the shell, the Campaign Desk, the Site Forge, the Satchel and the connectors. Saved in this browser; the build defaults come from ${esc(BRAND_DEFAULT.domain)} on ${esc(BRAND_DEFAULT.reviews.asOf)}.</p></div><button class="ibtn" id="bpClose">Close</button></div><div class="card-b"><div class="plan">
      ${f('name', 'Business name', BRAND.name)}${f('short', 'Short name', BRAND.short)}${f('tagline', 'Tagline', BRAND.tagline)}${f('phone', 'Phone', BRAND.phone, 'tel')}${f('url', 'Website', BRAND.url, 'url')}${f('lic', 'TDLR license', BRAND.lic)}
      ${f('street', 'Street', BRAND.street)}${f('city', 'City', BRAND.city)}${f('zip', 'ZIP', BRAND.zip)}${f('lat', 'Latitude (weather grid)', BRAND.lat, 'number')}${f('lon', 'Longitude', BRAND.lon, 'number')}${f('hours', 'Hours', BRAND.hours)}
      ${f('plan', 'Maintenance plan name', BRAND.plan)}${f('financing', 'Financing partners', BRAND.financing)}${f('promo', 'Current promotion', BRAND.promo)}
      <div class="f"><label class="fl" for="bp_c_primary">Primary color</label><div style="display:flex;gap:6px;align-items:center"><input type="color" id="bp_c_primary" value="${esc(BRAND.colors.primary)}"><code>${esc(BRAND.colors.primary)}</code></div></div>
      <div class="f"><label class="fl" for="bp_c_secondary">Secondary color</label><div style="display:flex;gap:6px;align-items:center"><input type="color" id="bp_c_secondary" value="${esc(BRAND.colors.secondary)}"><code>${esc(BRAND.colors.secondary)}</code></div></div>
      <div class="f"><label class="fl" for="bp_c_accent">Accent (gold)</label><div style="display:flex;gap:6px;align-items:center"><input type="color" id="bp_c_accent" value="${esc(BRAND.colors.accent)}"><code>${esc(BRAND.colors.accent)}</code></div></div>
      <div class="f"><label class="fl" for="bp_c_dark">Dark</label><div style="display:flex;gap:6px;align-items:center"><input type="color" id="bp_c_dark" value="${esc(BRAND.colors.dark)}"><code>${esc(BRAND.colors.dark)}</code></div></div>
      ${f('logoUrl', 'Logo URL', BRAND.logoUrl, 'url', 'Loads where the page may reach the site (file, browser app). The Claude viewer shows the drawn mark unless a file is uploaded.')}
      <div class="f"><label class="fl" for="bp_logo">Logo file (kept in this browser)</label><input type="file" id="bp_logo" accept="image/*"><span class="hint">${BRAND.logoData ? 'A logo file is stored. ' : ''}PNG, SVG or WebP under 400 KB.</span></div>
      </div><div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn" id="bpSave">Save and apply</button><button class="btn sec" id="bpClearLogo">Remove logo file</button><button class="btn ghost" id="bpReset">Reset to ${esc(BRAND_DEFAULT.short)} defaults</button></div></div></div>`;
    document.body.appendChild(ov);
    let logoData = BRAND.logoData || '';
    $('#bp_logo', ov).onchange = e => { const fl = e.target.files && e.target.files[0]; if (!fl) return; if (fl.size > 400 * 1024) { toast('Logo file is over 400 KB; pick a smaller one'); return; } const rd = new FileReader(); rd.onload = () => { logoData = String(rd.result || ''); toast('Logo loaded; save to apply'); }; rd.readAsDataURL(fl); };
    $('#bpSave', ov).onclick = () => { const patch = {}; $$('input[data-k]', ov).forEach(i => { const k = i.dataset.k; patch[k] = i.type === 'number' ? (+i.value || BRAND[k]) : i.value.trim(); }); patch.domain = String(patch.url || BRAND.url).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''); patch.colors = { primary: $('#bp_c_primary', ov).value, secondary: $('#bp_c_secondary', ov).value, accent: $('#bp_c_accent', ov).value, dark: $('#bp_c_dark', ov).value }; patch.logoData = logoData; save(patch); toast('Brand saved'); ov.remove(); };
    $('#bpClearLogo', ov).onclick = () => { logoData = ''; save({ logoData: '' }); toast('Logo file removed'); };
    $('#bpReset', ov).onclick = () => { reset(); toast('Brand reset to defaults'); ov.remove(); };
    $('#bpClose', ov).onclick = () => ov.remove(); ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }
  return { apply, save, reset, panel, addr, fallbackLogo, css, get B() { return BRAND; } };
})();
