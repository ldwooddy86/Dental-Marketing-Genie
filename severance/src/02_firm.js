/* SEVERANCE firm profile: the law firm the atlas works for (the Thermal Atlas "Brand" panel, rebuilt for a Texas family law practice).
   One object, saved in this browser, read by the Campaign Desk, the Compliance Screen, the Site Forge, Publish, Accounts, Competitor
   Watch and the Signal Desk. Rule 7.02(a) needs a responsible lawyer and a primary practice location on every advertisement, so both
   live here and every generated ad and page carries them.
     FIRM.get()            the profile (defaults filled)
     FIRM.set(patch)       merge, save, BUS.emit('firm', profile)
     FIRM.ready()          true when the minimum for publishing is filled (name, responsible lawyer, primary office city, phone)
     FIRM.missing()        the labels of what is still empty
     FIRM.responsible()    {name, bar_no, tbls} of the responsible lawyer
     FIRM.primary()        the primary practice location {label, street, city, zip, county, phone}
     FIRM.counties()       the FIPS codes the firm serves (offices' counties when none are picked)
     FIRM.lines()          the service line keys the firm sells (LINE_META keys)
     FIRM.adFooter()       'Responsible attorney: <name>. Office: <city>, Texas.' for ads and pages
     FIRM.panel()          the editor (modal) */
'use strict';
const FIRM_DEFAULT = {
  name: '', legal_name: '', tagline: '', url: '', phone: '', intake_email: '', founded: '',
  attorneys: [{ name: '', bar_no: '', tbls: '', since: '', bio: '' }], responsible: 0,
  offices: [{ label: 'Main office', street: '', city: '', zip: '', county: '', phone: '', hours: '', primary: true }],
  counties: [], lines: ['div_k', 'div_nk', 'sapcr', 'mod', 'enf', 'po'], languages: ['en'],
  consult: { free: false, fee: null, virtual: false }, fees: {}, payment: '',   // facts a page or ad would print stay empty until the firm enters them
  colors: { primary: '#1b4332', accent: '#307a4f', dark: '#0a291a' }, logo: '',
  social: { facebook: '', instagram: '', youtube: '', linkedin: '', tiktok: '', x: '', gbp: '' },
  reviews: { rating: '', count: '', source: 'Google' },
  arc: { filed: false, note: '' }
};
const FIRM = (() => {
  const KEY = 'sev.firm';
  const clone = o => JSON.parse(JSON.stringify(o));
  const merge = (a, b) => { const o = clone(a); for (const k in (b || {})) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) o[k] = Object.assign({}, o[k], b[k]); else if (b[k] !== undefined) o[k] = b[k]; } return o; };
  let P = merge(FIRM_DEFAULT, store.get(KEY, {}));
  const get = () => P;
  function set(patch) { P = merge(P, patch); if (!Array.isArray(P.attorneys) || !P.attorneys.length) P.attorneys = clone(FIRM_DEFAULT.attorneys); if (!Array.isArray(P.offices) || !P.offices.length) P.offices = clone(FIRM_DEFAULT.offices); P.responsible = clamp(+P.responsible || 0, 0, P.attorneys.length - 1); store.set(KEY, P); BUS.emit('firm', P); return P; }
  const responsible = () => P.attorneys[P.responsible] || P.attorneys[0] || {};
  const primary = () => P.offices.find(o => o.primary) || P.offices[0] || {};
  const officeCounty = o => { if (o.county) return o.county; const z = ZI[String(o.zip || '').trim()]; return z ? z.county : ''; };
  const counties = () => { const s = (P.counties || []).filter(f => CI[f]); if (s.length) return s; return [...new Set(P.offices.map(officeCounty).filter(f => CI[f]))]; };
  const lines = () => (P.lines || []).filter(k => typeof LINE_META === 'undefined' || LINE_META[k]);
  const name = () => P.name || '';
  function missing() { const m = []; if (!P.name) m.push('firm name'); if (!responsible().name) m.push('responsible lawyer'); if (!primary().city) m.push('primary office city'); if (!P.phone && !primary().phone) m.push('phone'); if (!P.url) m.push('website'); return m; }
  const ready = () => missing().filter(x => x !== 'website').length === 0;
  function adFooter(o) { o = o || {}; const r = responsible(), p = primary(); const atty = r.name || '[Responsible attorney]'; const city = p.city || '[Office city]'; return o.short ? `${atty}, ${city} TX` : `Responsible attorney: ${atty}. Primary office: ${city}, Texas.`; }
  const phone = () => phoneFmt(P.phone || primary().phone || '');
  const certs = () => P.attorneys.filter(a => a.name && a.tbls).map(a => `${a.name}, Board Certified, ${a.tbls}, Texas Board of Legal Specialization`);
  function exportJSON() { return JSON.stringify({ severance_firm: 1, saved: todayISO(), firm: P }, null, 2); }
  function importJSON(text) { const j = JSON.parse(text); const f = j.firm || j; if (!f || typeof f !== 'object') throw new Error('No firm profile in that file'); return set(f); }

  /* ---- the editor */
  function panel() {
    const f = P; const LM = typeof LINE_META !== 'undefined' ? LINE_META : {};
    const ctyOpts = CTY.slice().sort((a, b) => a.name.localeCompare(b.name));
    const attyRow = (a, i) => `<div class="frow" data-atty="${i}"><div class="formgrid">${fieldHTML({ k: 'name', id: `fa_n${i}`, l: 'Lawyer name', ph: 'First Last' }, a.name)}${fieldHTML({ k: 'bar_no', id: `fa_b${i}`, l: 'State Bar of Texas number' }, a.bar_no)}${fieldHTML({ k: 'tbls', id: `fa_t${i}`, l: 'TBLS board certification area', ph: 'Family Law', hint: 'Only a Texas Board of Legal Specialization certification may be advertised as a specialty (Rule 7.02(b)). Leave empty if none.' }, a.tbls)}${fieldHTML({ k: 'since', id: `fa_s${i}`, l: 'Licensed since (year)', t: 'number' }, a.since)}${fieldHTML({ k: 'bio', id: `fa_bio${i}`, l: 'Short bio (pages)', t: 'textarea', rows: 2, wide: true }, a.bio)}</div><div class="btnrow"><label class="chk"><input type="radio" name="fResp" value="${i}"${+f.responsible === i ? ' checked' : ''}> Responsible lawyer for ads (Rule 7.02(a))</label>${f.attorneys.length > 1 ? `<button type="button" class="btn sm danger" data-rm-atty="${i}">Remove</button>` : ''}</div></div>`;
    const offRow = (o, i) => `<div class="frow" data-off="${i}"><div class="formgrid">${fieldHTML({ k: 'label', id: `fo_l${i}`, l: 'Office name' }, o.label)}${fieldHTML({ k: 'street', id: `fo_s${i}`, l: 'Street address' }, o.street)}${fieldHTML({ k: 'city', id: `fo_c${i}`, l: 'City' }, o.city)}${fieldHTML({ k: 'zip', id: `fo_z${i}`, l: 'ZIP' }, o.zip)}${fieldHTML({ k: 'county', id: `fo_k${i}`, l: 'County', t: 'select', opts: [['', 'From the ZIP']].concat(ctyOpts.map(c => [c.fips, c.name])) }, o.county)}${fieldHTML({ k: 'phone', id: `fo_p${i}`, l: 'Office phone', t: 'tel' }, o.phone)}${fieldHTML({ k: 'hours', id: `fo_h${i}`, l: 'Hours', wide: true }, o.hours)}</div><div class="btnrow"><label class="chk"><input type="radio" name="fPrim" value="${i}"${o.primary ? ' checked' : ''}> Primary practice location (Rule 7.02(a))</label>${f.offices.length > 1 ? `<button type="button" class="btn sm danger" data-rm-off="${i}">Remove</button>` : ''}</div></div>`;
    openModal(`<h3 style="font-family:var(--display);font-size:22px">Firm profile</h3><p class="small">Everything a page or an ad says about the firm comes from here. Saved in this browser only. ${f.name ? '' : 'Nothing is filled yet; generated copy shows bracketed placeholders, which the Compliance Screen blocks until they are replaced.'}</p>
      <div id="firmForm">
      <h4 class="fh">Identity</h4><div class="formgrid">${fieldHTML({ k: 'name', l: 'Firm name (as advertised)', ph: 'Smith Family Law' }, f.name)}${fieldHTML({ k: 'legal_name', l: 'Legal name', ph: 'Smith Family Law, PLLC' }, f.legal_name)}${fieldHTML({ k: 'url', l: 'Website', t: 'url', ph: 'https://www.example.com' }, f.url)}${fieldHTML({ k: 'phone', l: 'Main phone', t: 'tel' }, f.phone)}${fieldHTML({ k: 'intake_email', l: 'Intake email (form notices)', t: 'email' }, f.intake_email)}${fieldHTML({ k: 'founded', l: 'Founded (year)', t: 'number' }, f.founded)}${fieldHTML({ k: 'tagline', l: 'Tagline', wide: true, hint: 'Avoid superlatives and outcome promises; the Compliance Screen checks it.' }, f.tagline)}</div>
      <h4 class="fh">Lawyers</h4><div id="fAttys">${f.attorneys.map(attyRow).join('')}</div><button type="button" class="btn sm" id="fAddAtty">+ Add a lawyer</button>
      <h4 class="fh">Offices</h4><div id="fOffs">${f.offices.map(offRow).join('')}</div><button type="button" class="btn sm" id="fAddOff">+ Add an office</button>
      <h4 class="fh">Service area and lines</h4><div class="formgrid">${fieldHTML({ k: 'counties', id: 'fCounties', l: 'Counties served (Ctrl or Cmd click for several; empty means the offices\' counties)', t: 'select', wide: true, opts: [] }, '')}</div>
      <div class="btnrow" id="fLines">${Object.keys(LM).map(k => `<label class="chk"><input type="checkbox" data-line="${k}"${(f.lines || []).includes(k) ? ' checked' : ''}> ${esc(LM[k].name)}</label>`).join('')}</div>
      <div class="btnrow"><label class="chk"><input type="checkbox" id="fLangEs"${(f.languages || []).includes('es') ? ' checked' : ''}> Spanish speaking staff (Spanish pages and ads)</label></div>
      <h4 class="fh">Consultations and fees</h4><div class="formgrid">${fieldHTML({ k: 'consult_fee', id: 'fConsultFee', l: 'Consultation fee $', t: 'number' }, f.consult.fee)}${fieldHTML({ k: 'consult_free', id: 'fConsultFree', l: 'Free consultations', t: 'checkbox' }, f.consult.free)}${fieldHTML({ k: 'consult_virtual', id: 'fConsultVirt', l: 'Video consultations', t: 'checkbox' }, f.consult.virtual)}${fieldHTML({ k: 'payment', l: 'Payment options', wide: true }, f.payment)}</div>
      <div class="formgrid" id="fFees">${Object.keys(LM).filter(k => (f.lines || []).includes(k)).map(k => fieldHTML({ k: 'fee_' + k, id: 'ff_' + k, l: `Advertised flat fee, ${LM[k].short} $`, t: 'number', hint: 'Optional. An advertised fee must be honored while the ad runs (Rule 7.02(d)).' }, (f.fees || {})[k])).join('')}</div>
      <h4 class="fh">Brand</h4><div class="formgrid">${fieldHTML({ k: 'c_primary', id: 'fcP', l: 'Primary color', t: 'color' }, f.colors.primary)}${fieldHTML({ k: 'c_accent', id: 'fcA', l: 'Accent color', t: 'color' }, f.colors.accent)}${fieldHTML({ k: 'c_dark', id: 'fcD', l: 'Dark color', t: 'color' }, f.colors.dark)}<div class="ctl"><label>Logo</label><div class="btnrow" style="margin:0">${f.logo ? `<img src="${esc(f.logo)}" alt="" style="height:34px;max-width:140px;object-fit:contain;background:#fff;border:1px solid var(--line)">` : '<span class="small">None</span>'}<button type="button" class="btn sm" id="fLogo">Choose</button>${f.logo ? '<button type="button" class="btn sm" id="fLogoRm">Remove</button>' : ''}</div></div></div>
      <h4 class="fh">Profiles and reviews</h4><div class="formgrid">${['facebook', 'instagram', 'youtube', 'linkedin', 'tiktok', 'x', 'gbp'].map(k => fieldHTML({ k: 's_' + k, id: 'fs_' + k, l: k === 'gbp' ? 'Google Business Profile URL' : k === 'x' ? 'X profile URL' : k[0].toUpperCase() + k.slice(1) + ' URL', t: 'url' }, f.social[k])).join('')}${fieldHTML({ k: 'r_rating', id: 'frR', l: 'Review rating (as shown publicly)', t: 'number', step: '0.1' }, f.reviews.rating)}${fieldHTML({ k: 'r_count', id: 'frC', l: 'Review count', t: 'number' }, f.reviews.count)}${fieldHTML({ k: 'r_source', id: 'frS', l: 'Review source' }, f.reviews.source)}</div>
      <h4 class="fh">Advertising Review Committee</h4><div class="formgrid">${fieldHTML({ k: 'arc_filed', id: 'fArc', l: 'Ads and the website are filed with the State Bar Advertising Review Committee as Rule 7.04 requires', t: 'checkbox' }, f.arc.filed)}${fieldHTML({ k: 'arc_note', id: 'fArcN', l: 'Filing notes (dates, approval numbers)', wide: true }, f.arc.note)}</div>
      </div>
      <div class="btnrow" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px"><button type="button" class="btn primary" id="fSave">Save the profile</button><button type="button" class="btn" id="fExport">↓ Export JSON</button><button type="button" class="btn" id="fImport">↑ Import JSON</button><button type="button" class="btn" id="fClose">Close</button><span class="small" id="fMsg"></span></div>`);
    const csel = $('#fCounties'); csel.multiple = true; csel.size = 6; csel.innerHTML = ctyOpts.map(c => `<option value="${c.fips}"${(f.counties || []).includes(c.fips) ? ' selected' : ''}>${esc(c.name)} County</option>`).join('');
    const collect = () => {
      const g = id => $('#' + id); const val = (sel) => { const i = $(sel); return i ? (i.type === 'checkbox' ? i.checked : i.value) : ''; };
      const top = {}; ['name', 'legal_name', 'url', 'phone', 'intake_email', 'founded', 'tagline', 'payment'].forEach(k => { top[k] = val('#f_' + k); });
      top.attorneys = $$('#fAttys .frow').map(r => { const i = r.dataset.atty; return { name: val('#fa_n' + i).trim(), bar_no: val('#fa_b' + i).trim(), tbls: val('#fa_t' + i).trim(), since: val('#fa_s' + i), bio: val('#fa_bio' + i) }; });
      const rsel = $('input[name=fResp]:checked'); top.responsible = rsel ? $$('#fAttys .frow').findIndex(r => r.dataset.atty === rsel.value) : 0; if (top.responsible < 0) top.responsible = 0;
      const psel = $('input[name=fPrim]:checked');
      top.offices = $$('#fOffs .frow').map(r => { const i = r.dataset.off; return { label: val('#fo_l' + i), street: val('#fo_s' + i), city: val('#fo_c' + i).trim(), zip: val('#fo_z' + i).trim(), county: val('#fo_k' + i) || ((ZI[val('#fo_z' + i).trim()] || {}).county || ''), phone: val('#fo_p' + i), hours: val('#fo_h' + i), primary: psel ? psel.value === i : false }; });
      if (!top.offices.some(o => o.primary) && top.offices.length) top.offices[0].primary = true;
      top.counties = Array.from(csel.selectedOptions).map(o => o.value);
      top.lines = $$('#fLines input').filter(i => i.checked).map(i => i.dataset.line);
      top.languages = ['en'].concat(g('fLangEs').checked ? ['es'] : []);
      top.consult = { fee: val('#fConsultFee') === '' ? null : (+val('#fConsultFee') || 0), free: !!val('#fConsultFree'), virtual: !!val('#fConsultVirt') };
      top.fees = Object.assign({}, f.fees); $$('#fFees [data-k]').forEach(i => { const k = i.dataset.k.slice(4); top.fees[k] = i.value === '' ? null : +i.value; });
      top.colors = { primary: val('#fcP'), accent: val('#fcA'), dark: val('#fcD') };
      top.social = {}; ['facebook', 'instagram', 'youtube', 'linkedin', 'tiktok', 'x', 'gbp'].forEach(k => top.social[k] = val('#fs_' + k).trim());
      top.reviews = { rating: val('#frR'), count: val('#frC'), source: val('#frS') };
      top.arc = { filed: !!val('#fArc'), note: val('#fArcN') };
      return top;
    };
    const reopen = patch => { P = merge(P, Object.assign(collect(), patch || {})); panel(); };
    $('#fAddAtty').onclick = () => { const c = collect(); c.attorneys.push({ name: '', bar_no: '', tbls: '', since: '', bio: '' }); P = merge(P, c); panel(); };
    $('#fAddOff').onclick = () => { const c = collect(); c.offices.push({ label: 'Office ' + (c.offices.length + 1), street: '', city: '', zip: '', county: '', phone: '', hours: '', primary: false }); P = merge(P, c); panel(); };
    $$('[data-rm-atty]').forEach(b => b.onclick = () => { const c = collect(); c.attorneys.splice(+b.dataset.rmAtty, 1); c.responsible = 0; P = merge(P, c); panel(); });
    $$('[data-rm-off]').forEach(b => b.onclick = () => { const c = collect(); c.offices.splice(+b.dataset.rmOff, 1); if (!c.offices.some(o => o.primary) && c.offices[0]) c.offices[0].primary = true; P = merge(P, c); panel(); });
    $$('#fLines input').forEach(i => i.onchange = () => reopen());
    $('#fLogo').onclick = async () => { const [file] = await pickFiles('image/*'); if (!file) return; if (file.size > 400000) { $('#fMsg').textContent = 'Pick a logo under 400 KB (SVG or PNG).'; return; } reopen({ logo: await readDataUrl(file) }); };
    if ($('#fLogoRm')) $('#fLogoRm').onclick = () => reopen({ logo: '' });
    $('#fSave').onclick = () => { set(collect()); closeModal(); toast('Firm profile saved'); applyShell(); };
    $('#fExport').onclick = () => { set(collect()); saveFile('severance_firm_profile.json', exportJSON()); };
    $('#fImport').onclick = async () => { const [file] = await pickFiles('.json,application/json'); if (!file) return; try { importJSON(await readText(file)); panel(); toast('Firm profile imported'); applyShell(); } catch (e) { $('#fMsg').textContent = e.message; } };
    $('#fClose').onclick = closeModal;
  }
  /* the shell shows the firm next to the product name once it is set */
  function applyShell() { const sb = $('.lockup .prod .sb'); if (!sb) return; if (!sb.dataset.base) sb.dataset.base = sb.textContent; sb.textContent = P.name ? `${P.name} · ${sb.dataset.base}` : sb.dataset.base; const b = $('#firmTop span'); if (b) b.textContent = P.name ? 'Firm' : 'Set up the firm'; }
  return { get, set, ready, missing, responsible, primary, counties, lines, name, adFooter, phone, certs, panel, applyShell, exportJSON, importJSON, officeCounty };
})();
