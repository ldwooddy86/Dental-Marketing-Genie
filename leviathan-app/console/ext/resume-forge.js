/* Leviathan browser app · Résumé Forge, the view. A console view (route "resume", "resume.<agencyId>") drawn with the
   console's own helpers, handed in as ctx by the patched frame script (lib/patch.mjs). The engine (resume-engine.js)
   reads, ranks, builds and grades; this file is the screen, in three stages: Read (the agency, its gaps and lines, the
   tracks it would hire for), Draft (the candidate's facts and the tailoring for this agency, with a live preview) and
   Check (ATS readiness, the agency's words, exports).
   The draft lives in the extension's storage through the bridge store (host-bridge.js → app.js), or in localStorage when
   the console runs outside the extension; nothing leaves the browser. The candidate's facts are shared across agencies;
   the tailoring (track, title, summary, added terms, pasted posting) is kept per agency. */
(function () {
  'use strict';
  const G = typeof globalThis !== 'undefined' ? globalThis : window;
  const ENGINE = () => G.__LV_RESUME_ENGINE;
  const KEY = 'resume';
  const CSS = `
.rf-stages{position:sticky;top:0;z-index:5;display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:8px 0;margin:-8px 0 14px;background:var(--ground)}
.rf-stages a{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:999px;border:1px solid var(--rule);background:var(--surface);font-size:12.5px;color:var(--ink-2);text-decoration:none}
.rf-stages a b{font:600 10.5px/1 var(--f-mono);color:var(--ink-3)}
.rf-stages a:hover{border-color:var(--ink-3);color:var(--ink)}
.rf-stages .sp{flex:1}
.rf-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
@media (max-width:1100px){.rf-grid{grid-template-columns:minmax(0,1fr)}}
.rf-f{display:grid;gap:5px;margin-bottom:12px}
.rf-f label{font:600 12px/1.3 var(--f-body);color:var(--ink-2)}
.rf-f label .mute{font-weight:400}
.rf-in{width:100%;border:1px solid var(--rule);border-radius:8px;background:var(--surface);color:var(--ink);padding:8px 10px;font:inherit;font-size:13.5px;line-height:1.45}
.rf-in:focus{outline:2px solid var(--sun-bar);outline-offset:1px}
textarea.rf-in{resize:vertical;min-height:62px}
select.rf-in{width:auto;min-width:200px}
.rf-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media (max-width:560px){.rf-two{grid-template-columns:1fr}}
.rf-exp{border:1px solid var(--rule-2);border-radius:9px;padding:12px 12px 4px;margin-bottom:10px;background:var(--surface-2)}
.rf-out{white-space:pre-wrap;overflow-wrap:anywhere;font:12.5px/1.5 var(--f-mono);background:var(--surface-2);border:1px solid var(--rule);border-radius:10px;padding:16px;max-height:720px;overflow:auto;margin:0;color:var(--ink)}
.rf-chips{display:flex;flex-wrap:wrap;gap:6px}
.rf-chip{display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:3px 9px;border-radius:999px;border:1px solid var(--rule);background:var(--surface);font:inherit;font-size:12px;color:var(--ink-2);cursor:pointer;text-align:left}
.rf-chip:hover{border-color:var(--ink-3);color:var(--ink)}
.rf-chip[aria-pressed="true"],.rf-chip[aria-checked="true"]{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.rf-chip.on{background:var(--sun-tint);border-color:var(--sun-bar);color:var(--ink)}
.rf-chip.static{cursor:default;border-style:dashed}
.rf-chip .s{font:500 10px/1 var(--f-mono);color:var(--ink-3);text-transform:uppercase;letter-spacing:.04em}
.rf-chip[aria-pressed="true"] .s{color:var(--surface);opacity:.75}
.rf-list{display:grid;gap:6px}
.rf-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 12px;align-items:center;padding:9px 12px;border:1px solid var(--rule-2);border-radius:9px;background:var(--surface);text-align:left;font:inherit;cursor:pointer;width:100%;color:inherit}
.rf-row:hover,.rf-row:focus-visible{border-color:var(--sun-bar)}
.rf-row .t{font-weight:600;font-size:13.5px}
.rf-row .s{font-size:12px;color:var(--ink-3);grid-column:1}
.rf-row .r{grid-row:1/3;display:flex;gap:6px;align-items:center}
.rf-items{border:1px solid var(--rule);border-radius:10px;background:var(--surface);overflow:hidden}
.rf-item{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;padding:12px 14px;border-top:1px solid var(--rule-2)}
.rf-item:first-child{border-top:0}
.rf-badge{display:inline-grid;place-items:center;min-width:70px;height:22px;padding:0 8px;border-radius:999px;font:600 10px/1 var(--f-mono);letter-spacing:.05em;text-transform:uppercase;align-self:start;margin-top:1px;white-space:nowrap}
.rf-badge.s3{background:var(--neg-tint);color:var(--neg)} .rf-badge.s2{background:var(--sun-tint);color:var(--sun)} .rf-badge.s1{background:var(--sunken);color:var(--ink-2)} .rf-badge.s0{background:var(--health-tint);color:var(--pos)}
.rf-badge.g{background:var(--surface-2);border:1px solid var(--rule);color:var(--ink-2);min-width:0}
.rf-item .f{font-weight:600;font-size:13.5px;line-height:1.4}
.rf-item .n{grid-column:2;font-size:12.5px;color:var(--ink-2);line-height:1.45}
.rf-item .n b{color:var(--ink-3);font:600 10px/1 var(--f-mono);letter-spacing:.06em;text-transform:uppercase;margin-right:6px}
.rf-item .m{grid-column:2;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:11.5px;color:var(--ink-3);margin-top:3px}
.rf-item .m a{color:var(--ink-2)}
.rf-score{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:center}
.rf-score .big{width:74px;height:74px;border-radius:14px;display:grid;place-items:center;font:700 30px/1 var(--f-display);background:var(--sun-tint);color:var(--sun);border:1px solid var(--sun-bar)}
.rf-score .big.good{background:var(--health-tint);color:var(--pos);border-color:var(--pos)}
.rf-score .big.bad{background:var(--neg-tint);color:var(--neg);border-color:var(--neg)}
.rf-checks{display:grid;gap:6px;margin-top:12px;font-size:12.5px}
.rf-check{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:4px 8px;align-items:baseline}
.rf-check .st{font:600 10px/1 var(--f-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--neg)}
.rf-check.ok .st{color:var(--pos)} .rf-check.part .st{color:var(--sun)}
.rf-check .tip{grid-column:2/4;color:var(--ink-3);font-size:11.5px;line-height:1.4}
.rf-check .d{font:500 11px/1 var(--f-mono);color:var(--ink-3);white-space:nowrap}
.rf-gate{border:1px solid var(--neg);background:var(--neg-tint);border-radius:9px;padding:10px 12px;margin-bottom:10px;font-size:13px}
.rf-gate b{display:block;margin-bottom:2px}
.rf-tracks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media (max-width:1100px){.rf-tracks{grid-template-columns:minmax(0,1fr)}}
.rf-track{display:flex;flex-direction:column;gap:8px;padding:14px 16px;cursor:pointer}
.rf-track h3{font:700 19px/1.1 var(--f-display)}
.rf-track .rk{font:600 10.5px/1 var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.rf-track .bars{display:grid;gap:4px;font:500 10.5px/1.3 var(--f-mono);color:var(--ink-3)}
.rf-track .bar{height:6px;border-radius:3px;background:var(--sunken);overflow:hidden}
.rf-track .bar i{display:block;height:100%;background:var(--sun-bar)} .rf-track .bar i.a{background:var(--neg)}
.rf-track ul{margin:0;padding-left:18px;font-size:12px;color:var(--ink-2);display:grid;gap:3px}
.rf-track[aria-checked="true"]{border-color:var(--sun-bar);box-shadow:0 0 0 2px var(--sun-tint)}
.rf-badges{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px}
.rf-fold{border:1px solid var(--rule);border-radius:10px;background:var(--surface);padding:0 16px;margin-top:10px}
.rf-fold summary{cursor:pointer;padding:11px 0;font-weight:600;font-size:13.5px}
.rf-fold[open] summary{border-bottom:1px solid var(--rule-2);margin-bottom:10px}
.rf-fold .body{padding-bottom:14px;font-size:13px;color:var(--ink-2);max-width:96ch;white-space:pre-wrap;line-height:1.5}
.rf-ag{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:0;overflow:hidden;margin-bottom:14px}
@media (max-width:900px){.rf-ag{grid-template-columns:minmax(0,1fr)}.rf-ag .a{border-right:0;border-bottom:1px solid var(--rule)}}
.rf-ag .a{padding:18px 20px;border-right:1px solid var(--rule)} .rf-ag .b{padding:16px 18px;background:var(--surface-2)}
.rf-ag h3{font:700 24px/1.05 var(--f-display);outline:none}
.rf-kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:5px 12px;font-size:12.5px;margin:10px 0 0}
.rf-kv dt{color:var(--ink-3);font:500 11px/1.6 var(--f-mono);text-transform:uppercase;letter-spacing:.06em} .rf-kv dd{margin:0}
.rf-reads{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.rf-num .v{font:600 20px/1.1 var(--f-body)} .rf-num .l{font-size:11px;color:var(--ink-3);margin-top:2px}
.rf-banner{border:1px solid var(--sun-bar);background:var(--sun-tint);border-radius:9px;padding:9px 12px;font-size:12.5px;margin-top:10px}
.rf-note{font-size:12.5px;color:var(--ink-3);max-width:96ch;line-height:1.5}
.rf-tidy{margin:6px 0 0;padding-left:20px;display:grid;gap:7px;font-size:13px;line-height:1.5;color:var(--ink-2)}
.rf-tidy b{color:var(--ink)}
.rf-rail{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.rf-empty{padding:18px;border:1px dashed var(--rule);border-radius:10px;color:var(--ink-3);font-size:13px}
.rf-h3{font:600 15px/1.2 var(--f-body);margin-bottom:8px}
.rf-vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.rf-vgroup{margin-top:10px}
.rf-vgroup .eyebrow{margin-bottom:6px}
#rf-print{display:none}
@media print{
  body>*:not(#rf-print){display:none!important}
  body{overflow:visible!important;background:#fff!important}
  #rf-print{display:block!important;position:static;padding:0;margin:0;color:#000;font:11pt/1.4 Arial,Helvetica,sans-serif;max-width:7.5in}
  #rf-print h1{font:bold 20pt/1.1 Arial,Helvetica,sans-serif;margin:0 0 4pt}
  #rf-print h2{font:bold 11.5pt/1.2 Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.04em;margin:12pt 0 4pt;border-bottom:1px solid #000;padding-bottom:2pt}
  #rf-print p{margin:0 0 4pt} #rf-print .hl{font-weight:bold} #rf-print .ct{color:#333}
  #rf-print .role{margin-top:7pt} #rf-print .role span{color:#444;font-weight:normal}
  #rf-print ul{margin:2pt 0 4pt;padding-left:16pt} #rf-print li{margin:0 0 2pt}
}
`;
  (function injectCss() { try { if (document.getElementById('lv-resume-css')) return; const s = document.createElement('style'); s.id = 'lv-resume-css'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); } catch (e) { /* no document */ } })();

  /* ---------- storage: the bridge's snapshot store, else localStorage inside the bridge's fallback ---------- */
  const store = () => (G.__LV_EXT && G.__LV_EXT.store) || null;
  let memDraft = null;
  function storeReady() { const st = store(); return st ? st.ready() : Promise.resolve(); }
  function storeGet() { const st = store(); if (st) return st.get(KEY); return memDraft; }
  function storeSet(v) { memDraft = v; const st = store(); if (st) st.set(KEY, v); }

  /* ---------- state across renders ---------- */
  const S = { draft: null, loaded: false, agency: null, read: null, built: '', lint: null, mirror: null, q: '', wing: null, hb: false, saveT: 0, buildT: 0, ctx: null, paint: null, autoRole: null };
  const E = () => ENGINE();
  const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v));
  /* a draft of the right shape from whatever was stored or imported; anything malformed falls back to blank fields */
  function normDraft(v) {
    const En = E(); const d = En.blankDraft();
    if (!v || typeof v !== 'object') return d;
    const c = v.candidate && typeof v.candidate === 'object' ? v.candidate : {};
    for (const k of ['name', 'contact', 'years', 'skills', 'results', 'education']) d.candidate[k] = str(c[k]);
    d.candidate.level = ['junior', 'mid', 'senior', 'manager', 'director'].includes(c.level) ? c.level : null;
    d.candidate.verticals = Array.isArray(c.verticals) ? c.verticals.filter(k => typeof k === 'string' && En.VERT[k]) : [];
    d.candidate.exp = (Array.isArray(c.exp) ? c.exp : []).filter(x => x && typeof x === 'object').map(x => ({ title: str(x.title), org: str(x.org), dates: str(x.dates), bullets: str(x.bullets) }));
    if (!d.candidate.exp.length) d.candidate.exp = [{ title: '', org: '', dates: '', bullets: '' }];
    const tailor = t => { const o = En.blankTailor(); if (!t || typeof t !== 'object') return o; o.track = typeof t.track === 'string' && En.TRACK[t.track] ? t.track : null; o.industry = typeof t.industry === 'string' && En.INDUSTRY[t.industry] ? t.industry : null; o.role = str(t.role); o.summary = str(t.summary); o.posting = str(t.posting); o.terms = (Array.isArray(t.terms) ? t.terms : []).filter(x => typeof x === 'string' && x.trim()).slice(0, 60); return o; };
    if (v.tailor && typeof v.tailor === 'object') for (const id of Object.keys(v.tailor)) if (En.agency(id)) d.tailor[id] = tailor(v.tailor[id]);
    d.general = tailor(v.general);
    d.last = { agency: v.last && typeof v.last.agency === 'string' && En.agency(v.last.agency) ? v.last.agency : null };
    return d;
  }
  function isBlank(d) {
    if (!d || !d.candidate) return true;
    const c = d.candidate;
    if ([c.name, c.contact, c.years, c.skills, c.results, c.education].some(x => str(x).trim())) return false;
    if ((c.exp || []).some(x => str(x.title).trim() || str(x.org).trim() || str(x.bullets).trim())) return false;
    if (Object.values(d.tailor || {}).some(t => t.role || t.summary || (t.terms || []).length || t.posting)) return false;
    return true;
  }
  function draft() { if (!S.draft) S.draft = E().blankDraft(); return S.draft; }
  function cand() { const d = draft(); if (!d.candidate) d.candidate = E().blankCandidate(); if (!Array.isArray(d.candidate.exp) || !d.candidate.exp.length) d.candidate.exp = [{ title: '', org: '', dates: '', bullets: '' }]; if (!Array.isArray(d.candidate.verticals)) d.candidate.verticals = []; return d.candidate; }
  function tail() { const d = draft(); if (!S.agency) { if (!d.general) d.general = E().blankTailor(); return d.general; } if (!d.tailor) d.tailor = {}; if (!d.tailor[S.agency.id]) d.tailor[S.agency.id] = E().blankTailor(); const t = d.tailor[S.agency.id]; if (!Array.isArray(t.terms)) t.terms = []; return t; }
  function save() { clearTimeout(S.saveT); S.saveT = setTimeout(flush, 250); }
  function flush() { clearTimeout(S.saveT); if (!S.loaded) return; try { storeSet(draft()); } catch (e) { /* storage off */ } }
  try {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
  } catch (e) { /* no document */ }
  function setAgency(a) {
    S.agency = a || null;
    S.read = a ? E().read(a) : null;
    const d = draft(); if (a) d.last = { agency: a.id };
    const t = tail();
    if (a && !t.track && !t.industry) { const top = S.read.tracks.find(x => x.score > 0) || S.read.tracks[0]; t.track = S.read.thin ? null : top.code; t.industry = S.read.thin ? 'marketing' : null; }
    if (!a && !t.track && !t.industry) t.industry = 'marketing';
    save();
  }
  function setTrack(code, industry) { const t = tail(); if (industry) { t.industry = code; t.track = null; } else { t.track = code; t.industry = null; } if (!t.role || t.role === S.autoRole) { t.role = ''; } save(); }
  function vocab() { const d = tail(); return E().vocab(S.agency, d.track || d.industry); }
  function mirrorTerms() { const t = tail(); const posting = (t.posting || '').trim(); if (posting) return { terms: E().keywordsFrom(posting, 24), source: 'posting' }; return { terms: E().mirrorTerms(vocab()).map(v => v.t), source: S.agency ? 'agency' : 'track' }; }

  /* ---------- the view ---------- */
  function view(agencyId, ctx) {
    const En = E();
    S.ctx = ctx;
    const { h, fill, icon, toast } = ctx;
    const root = h('div', { class: 'wrap rf' });
    root.addEventListener('change', () => flush());
    root.addEventListener('focusout', () => flush());
    if (!En) { root.append(h('p', { class: 'err', text: 'The Résumé Forge engine did not load (ext/resume-engine.js).' })); return root; }
    const F = En.findings();
    const meta = En.meta() || {};
    if (!F) { root.append(h('p', { class: 'err', text: 'The findings file did not load (ext/resume-findings.js). Rebuild the app with node build.mjs --findings.' })); return root; }
    if (agencyId) { const a = En.agency(agencyId); if (a) { if (!S.agency || S.agency.id !== a.id) setAgency(a); } else { toast('No agency "' + agencyId + '" in the Radar'); if (S.agency) setAgency(null); } }
    else if (S.agency) setAgency(null);

    const pickBox = h('div'), agBox = h('div'), trackBox = h('div'), findBox = h('div'), formBox = h('div'), prevBox = h('div'), checkBox = h('div'), matchBox = h('div');
    const paintAll = () => { paintPick(); paintAgency(); paintTracks(); paintFindings(); paintForm(); rebuild(true); };
    S.paint = paintAll;

    root.append(
      h('header', { class: 'mast' },
        h('div', { class: 'eyebrow', text: 'Across industries · Clapback’s résumé engine on the Core’s findings' }),
        h('h1', { text: 'Résumé Forge' }),
        h('p', { class: 'dek', text: 'Pick one of the ' + (meta.n || F.n) + ' agencies the Core tracks. The Forge reads Leviathan’s findings on it into the gaps it shows and the lines it sells, ranks the titles it would hire for, and builds an ATS-friendly résumé in the agency’s own vocabulary: your facts, its words. Everything stays on this device.' }),
        h('div', { class: 'meta' }, h('span', { text: 'Radar compiled ' + (meta.generated || '?') }), h('span', { text: 'Horus edition ' + (meta.edition || '?') }), h('span', { text: (meta.n || F.n) + ' agencies · ' + (meta.n_deep || F.n_deep) + ' deep dossiers' }), h('span', { text: 'Nothing is sent anywhere' }))),
      h('nav', { class: 'rf-stages', 'aria-label': 'Stages' },
        h('a', { href: '#rf-read', onclick: e => jump(e, 'rf-read') }, h('b', { text: '1' }), 'Read'),
        h('a', { href: '#rf-draft', onclick: e => jump(e, 'rf-draft') }, h('b', { text: '2' }), 'Draft'),
        h('a', { href: '#rf-check', onclick: e => jump(e, 'rf-check') }, h('b', { text: '3' }), 'Check and export'),
        h('span', { class: 'sp' }),
        h('span', { class: 'tiny mute', id: 'rf-tailored' })),
      h('section', { class: 'sec', id: 'rf-read', style: { marginTop: '0' } },
        h('div', { class: 'sec-h' }, h('h2', { text: 'Read the agency' }), h('p', { text: 'Search all ' + (meta.n || F.n) + ' by name, domain, segment or vertical. The Hit Board ten are the agencies Leviathan has read most closely.' })),
        pickBox, agBox, trackBox, findBox),
      h('section', { class: 'sec', id: 'rf-draft' },
        h('div', { class: 'sec-h' }, h('h2', { text: 'Draft the résumé' }), h('p', { text: 'Your facts only. The agency decides the title, the headline, the summary and the order of the skills; the facts under each employer come from you. Starters carry [placeholders]: fill the number or delete the line. The draft saves itself on this device.' })),
        h('div', { class: 'rf-grid' }, formBox, prevBox)),
      h('section', { class: 'sec', id: 'rf-check' },
        h('div', { class: 'sec-h' }, h('h2', { text: 'Check and export' }), h('p', { text: 'ATS readiness is structural: parsers and the six-second skim. The agency’s words are a separate count, so the score never rewards stuffing.' })),
        checkBox, matchBox),
      h('section', { class: 'sec' }, standards(ctx)));
    function jump(e, id) { e.preventDefault(); const el = root.querySelector('#' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

    /* ---- pick ---- */
    function pick(id) {
      const a = En.agency(id); if (!a) return;
      setAgency(a);
      if (typeof ctx.setRoute === 'function') ctx.setRoute('resume.' + a.id); else ctx.go('resume.' + a.id);
      paintAll();
      const hd = root.querySelector('.rf-ag h3'); if (hd) { hd.setAttribute('tabindex', '-1'); try { hd.focus({ preventScroll: true }); } catch (e) { /* ignore */ } hd.scrollIntoView({ block: 'start' }); }
    }
    function unpick() { setAgency(null); if (typeof ctx.setRoute === 'function') ctx.setRoute('resume'); else ctx.go('resume'); paintAll(); }
    function bandPill(r, label) {
      if (!r || !r.ok) return null;
      const val = label === 'Horus' ? (r.hti > 0 ? '+' : '') + Math.round(r.hti) : Math.round(r.index);
      return h('span', { class: 'pill', title: label === 'Horus' ? 'Market tailwind index' : 'Offshoring exposure index', text: label + ' ' + r.band + ' ' + val });
    }
    function paintPick() {
      const a = S.agency;
      const results = h('div', { class: 'rf-list' });
      const paintResults = () => {
        const list = En.search(S.q, { wing: S.wing, hb: S.hb, limit: S.q ? 14 : 10 });
        fill(results, list.length ? list.map(x => h('button', { class: 'rf-row', type: 'button', onclick: () => pick(x.id) },
          h('span', { class: 't' }, x.name, x.hb ? h('span', { class: 'hbtag', text: 'Hit Board · W' + x.hb.wave }) : null),
          h('span', { class: 's', text: [x.domain, x.hq, x.segment].filter(Boolean).join(' · ') }),
          h('span', { class: 'r' }, bandPill(x.horus, 'Horus'), bandPill(x.monsoon, 'Monsoon')))) : h('div', { class: 'rf-empty', text: 'Nothing matches. Try an agency name, a domain, a segment like “legal” or a vertical like “dental”.' }));
      };
      const q = h('input', { class: 'rf-in', type: 'search', id: 'rf-q', placeholder: 'Agency, domain, segment or vertical', value: S.q, 'aria-label': 'Find an agency', oninput: e => { S.q = e.target.value; paintResults(); } });
      const ctl = h('div', { class: 'ctl' },
        h('div', { class: 'grp', style: { flex: '1', minWidth: '220px' } }, q),
        h('div', { class: 'grp' }, h('span', { class: 'lab', text: 'Wing' }), h('div', { class: 'seg' }, [[null, 'All'], ['legal', 'Legal'], ['home', 'Home services'], ['health', 'Healthcare']].map(([w, l]) => h('button', { type: 'button', 'aria-pressed': String(S.wing === w), onclick: () => { S.wing = w; paintPick(); } }, l)))),
        h('label', { class: 'grp small dim' }, h('input', { type: 'checkbox', checked: S.hb ? true : null, onchange: e => { S.hb = e.target.checked; paintResults(); } }), 'Hit Board only'));
      const parts = [];
      if (a) parts.push(h('details', { class: 'rf-fold', style: { marginTop: 0, marginBottom: '14px' } }, h('summary', { text: 'Change agency' }), h('div', { class: 'body', style: { whiteSpace: 'normal' } }, ctl, results)));
      else {
        const d = draft(); const remembered = d.last && d.last.agency ? En.agency(d.last.agency) : null;
        parts.push(ctl);
        if (remembered) parts.push(h('div', { class: 'row', style: { marginBottom: '10px' } }, h('button', { class: 'btn pri', type: 'button', onclick: () => pick(remembered.id) }, 'Continue with ' + remembered.name, icon('arrow')), h('span', { class: 'small mute', text: 'the agency this draft was last aimed at' })));
        parts.push(h('div', { class: 'eyebrow', style: { margin: '14px 0 8px' }, text: S.q ? 'Matches' : (S.hb ? 'The Hit Board' : 'Most prominent' + (S.wing ? ' in the wing' : '')) }), results, h('p', { class: 'rf-note', style: { marginTop: '12px' }, text: 'No agency in mind? The Draft stage works on its own with Clapback’s general tracks.' }));
      }
      fill(pickBox, parts);
      paintResults();
    }

    /* ---- the agency ---- */
    function paintAgency() {
      const a = S.agency, r = S.read;
      if (!a) { fill(agBox); return; }
      const verts = En.verticals(a);
      const num = (v, l) => h('div', { class: 'rf-num' }, h('div', { class: 'v', text: v }), h('div', { class: 'l', text: l }));
      const depth = !a.horus.ok ? 'no Horus read' : a.deep ? 'deep dossier' : 'surface read';
      const successor = a.successor ? En.byName(String(a.successor).replace(/\s*\(.*$/, '')) : null;
      fill(agBox, h('div', { class: 'card rf-ag' },
        h('div', { class: 'a' },
          h('div', { class: 'row', style: { gap: '6px', marginBottom: '6px' } }, h('span', { class: 'rf-badge g', text: depth }), a.hb ? h('a', { class: 'hbtag', style: { marginLeft: 0 }, href: '#hitboard.ten', title: 'One of the ten agencies Leviathan rates as beatable', text: 'Hit Board · wave ' + a.hb.wave }) : null, r.thin ? h('span', { class: 'rf-badge s2', text: 'thin record' }) : null),
          h('h3', { text: a.name }),
          h('p', { class: 'small mute', style: { marginTop: '4px' }, text: [a.domain, a.hq, a.segment, a.icp ? a.icp + ' clients' : null, a.ownership && a.ownership !== 'unknown' ? a.ownership : null].filter(Boolean).join(' · ') }),
          a.positioning ? h('p', { class: 'small dim', style: { marginTop: '10px', maxWidth: '70ch' }, text: a.positioning }) : null,
          a.status !== 'active' ? h('div', { class: 'rf-banner' }, h('b', { text: 'Status: ' + a.status + '. ' }), a.status_note || '', successor ? [' ', h('button', { class: 'btn', type: 'button', style: { height: '26px', marginLeft: '6px' }, onclick: () => pick(successor.id) }, 'Tailor for ' + successor.name + ' instead')] : (a.successor ? ' Successor: ' + a.successor : '')) : null,
          a.region !== 'US' ? h('p', { class: 'tiny mute', style: { marginTop: '8px' }, text: 'Outside the US: CV conventions differ (length, photo, personal details). Check the posting and the country norm.' }) : null,
          h('dl', { class: 'rf-kv' },
            a.services && a.services.length ? [h('dt', { text: 'Sells' }), h('dd', { text: a.services.slice(0, 8).join(', ') + (a.services.length > 8 ? ', …' : '') })] : null,
            verts.length ? [h('dt', { text: 'Verticals' }), h('dd', null, h('div', { class: 'vm' }, verts.map(v => h('span', { class: 'pill ' + v.wing, title: v.names.join(', ') }, h('span', { class: 'sw ' + v.wing }), v.label))))] : null,
            a.proprietary && a.proprietary.length ? [h('dt', { text: 'Products' }), h('dd', { text: a.proprietary.slice(0, 4).join(', ') })] : null),
          h('div', { class: 'row', style: { marginTop: '14px' } },
            h('a', { class: 'btn', href: '#core.a.' + a.id }, 'Dossier in the Core', icon('arrow')),
            a.hb ? h('a', { class: 'btn', href: '#hitboard.ten' }, 'Hit Board') : null,
            h('a', { class: 'btn', href: '#agencies' }, 'Agency Field'),
            h('button', { class: 'btn', type: 'button', onclick: unpick }, 'Change agency')),
          h('p', { class: 'rf-note', style: { marginTop: '12px' }, text: 'Leviathan read ' + a.domain + '’s public record for the Radar compiled ' + (meta.generated || '?') + ' (Horus edition ' + (meta.edition || '?') + '). These are model-based reads of what the agency sells and shows, not a job posting: it may not be hiring for this. Check the site before you apply.' })),
        h('div', { class: 'b' },
          h('div', { class: 'eyebrow', style: { marginBottom: '10px' }, text: 'The Core’s read' }),
          h('div', { class: 'rf-reads' },
            num(a.horus && a.horus.ok ? a.horus.band + ' ' + (a.horus.hti > 0 ? '+' : '') + Math.round(a.horus.hti) : 'No read', 'Market tailwind (Horus)' + (a.horus && a.horus.pct != null ? ' · ' + En.ord(a.horus.pct) + ' pct' : '')),
            num(a.monsoon && a.monsoon.ok ? a.monsoon.band + ' ' + Math.round(a.monsoon.index) : 'No read', 'Offshore exposure (Monsoon)' + (a.monsoon && a.monsoon.pct != null ? ' · ' + En.ord(a.monsoon.pct) + ' pct' : '')),
            num(a.prom != null ? Math.round(a.prom * 100) + '/100' : 'n/a', 'Prominence'),
            num(a.clients ? a.clients.n + ' · ' + a.clients.observed : 'n/a', 'Clients on record · with an observed need'),
            num(a.paid && a.paid.g === 'active' ? (a.paid.g30 != null ? a.paid.g30 : 'active') : 'none seen', 'Google ads, last 30 days'),
            num(a.content ? (a.content.d90 || 0) + ' / ' + (a.content.d365 || 0) : 'n/a', 'Pages updated 90d / 365d')),
          r.thin ? h('p', { class: 'small', style: { marginTop: '12px' } }, h('b', { text: 'Thin record: ' }), r.thinWhy + '. The tracks below are a weak signal; tailor from the posting and the agency’s site more than from these findings.') : null)));
    }

    /* ---- tracks ---- */
    function paintTracks() {
      const r = S.read; const t = tail();
      const ranked = r ? r.tracks : En.TRACKS.map(x => ({ code: x.code, label: x.label, titles: x.titles, score: 0, demand: 0, angle: 0, why: [] }));
      const max = Math.max(1, ...ranked.map(x => x.score));
      const top = r ? ranked.filter(x => x.score > 0).slice(0, 3) : ranked.slice(0, 3);
      const level = En.levelOf(cand());
      const choose = code => { setTrack(code, false); paintTracks(); paintForm(); rebuild(); };
      const cards = h('div', { class: 'rf-tracks', role: 'radiogroup', 'aria-label': 'Role track' }, top.map((x, i) => h('div', { class: 'card rf-track', role: 'radio', tabindex: '0', 'aria-checked': String(t.track === x.code), onclick: () => choose(x.code), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(x.code); } } },
        h('div', { class: 'rk', text: (r ? 'Recommended ' + (i + 1) : 'Track') + (x.score ? ' · ' + x.score : '') }),
        h('h3', { text: x.label }),
        h('div', { class: 'small dim', text: 'Posted as ' + En.titleFor(x.code, level) + ' at your level' }),
        r ? h('div', { class: 'bars' }, h('span', { text: 'demand ' + x.demand + ' · what it sells and buys' }), h('div', { class: 'bar' }, h('i', { style: { width: Math.round(100 * x.demand / max) + '%' } })), h('span', { text: 'angle ' + x.angle + ' · the gaps a hire would close' }), h('div', { class: 'bar' }, h('i', { class: 'a', style: { width: Math.round(100 * x.angle / max) + '%' } }))) : null,
        x.why.length ? h('ul', null, x.why.slice(0, 3).map(w => h('li', { text: w }))) : h('p', { class: 'tiny mute', text: r ? 'Ranked on what it sells.' : 'Pick an agency to see why.' }))));
      const sel = h('select', { class: 'rf-in', id: 'rf-track-sel', 'aria-label': 'All agency tracks', onchange: e => choose(e.target.value) },
        h('option', { value: '', selected: !t.track ? true : null }, 'Pick a track'),
        ranked.map(x => h('option', { value: x.code, selected: t.track === x.code ? true : null }, x.label + (x.score ? ' · ' + x.score : ''))));
      const general = h('div', { class: 'rf-chips' }, En.INDUSTRIES.map(ind => h('button', { class: 'rf-chip', type: 'button', 'aria-pressed': String(t.industry === ind.id), onclick: () => { setTrack(ind.id, true); paintTracks(); paintForm(); rebuild(); } }, ind.label)));
      fill(trackBox,
        h('div', { class: 'sec-h', style: { marginTop: '18px' } }, h('h2', { style: { fontSize: '18px' }, text: 'Role track' }), h('p', { text: r ? (r.thin ? 'A thin record ranks weakly; the general tracks below may serve better.' : 'Scored on two axes: demand, from what it sells and what its clients buy; angle, from the gaps a hire would close, each weighted by how rare it is in the field.') : 'Pick an agency for a ranked list, or choose a general track.' })),
        top.length ? cards : h('div', { class: 'rf-empty', text: 'No track scores above zero on this record. Choose one below, or a general track.' }),
        h('details', { class: 'rf-fold' }, h('summary', { text: 'Other tracks' }), h('div', { class: 'body', style: { whiteSpace: 'normal' } }, sel)),
        h('details', { class: 'rf-fold', open: !r || r.thin ? true : null }, h('summary', { text: 'Outside agencies · Clapback’s industry profiles' }), h('div', { class: 'body', style: { whiteSpace: 'normal' } }, general)));
    }

    /* ---- findings ---- */
    function paintFindings() {
      const r = S.read; const a = S.agency;
      if (!a || !r) { fill(findBox); return; }
      const t = tail();
      const item = it => h('div', { class: 'rf-item' },
        h('div', { style: { display: 'grid', gap: '4px' } }, h('span', { class: 'rf-badge s' + it.sev, text: En.SEV_LABEL[it.sev] }), h('span', { class: 'rf-badge g', text: it.cls })),
        h('div', { class: 'f', text: it.finding }),
        h('div', { class: 'n' }, h('b', { text: 'Need' }), it.need),
        h('div', { class: 'n' }, h('b', { text: 'Résumé' }), it.move),
        h('div', { class: 'm' },
          it.tracks.map(code => { const tr = En.TRACK[code]; return tr ? h('button', { class: 'rf-chip' + (t.track === code ? ' on' : ''), type: 'button', title: 'Use the ' + tr.label + ' track', onclick: () => { setTrack(code, false); paintTracks(); paintFindings(); paintForm(); rebuild(); } }, tr.label) : null; }),
          it.src ? h('a', { href: it.src, text: it.srcLabel || 'Dossier' }) : null));
      const gaps = r.items.filter(it => it.group === 'gap'), sells = r.items.filter(it => it.group === 'sell');
      const atlases = r.verticals.filter(v => v.mod && ctx.MOD && ctx.MOD[v.mod]).map(v => { const m = ctx.MOD[v.mod]; return h('li', null, h('b', { text: v.label }), ': ' + (v.names.join(', ') || 'listed') + ' · ', h('a', { href: '#' + v.mod, text: m.short || m.title || v.mod }), m.facts && m.facts.length ? h('span', { class: 'mute', text: ' · ' + m.facts.slice(0, 3).join(' · ') }) : null); });
      fill(findBox,
        h('div', { class: 'sec-h', style: { marginTop: '18px' } }, h('h2', { style: { fontSize: '18px' }, text: 'Gaps it shows' }), h('p', { text: gaps.length + ' findings: contradictions between what it sells and what it does on its own house, market and delivery exposures, holes against the field. Each says where it came from and whether the Radar observed it or inferred it.' })),
        gaps.length ? h('div', { class: 'rf-items' }, gaps.map(item)) : h('div', { class: 'rf-empty', text: 'No gap or exposure in the record.' }),
        h('div', { class: 'sec-h', style: { marginTop: '18px' } }, h('h2', { style: { fontSize: '18px' }, text: 'What it sells and who it serves' }), h('p', { text: 'Strengths to mirror: the lines it leads with, what its clients buy, where it is already moving.' })),
        sells.length ? h('div', { class: 'rf-items' }, sells.map(item)) : null,
        r.brief && En.neutral(r.brief.bluf) ? h('details', { class: 'rf-fold' }, h('summary', { text: 'The Radar’s one-paragraph read' }), h('div', { class: 'body', text: En.neutral(r.brief.bluf) })) : null,
        r.brief && r.brief.openings ? h('details', { class: 'rf-fold' }, h('summary', { text: 'Leviathan’s competitive read · written for a rival; read it as what the agency lacks' }), h('div', { class: 'body', text: r.brief.openings })) : null,
        atlases.length ? h('details', { class: 'rf-fold', open: true }, h('summary', { text: 'Its verticals, and the Leviathan atlases that know them' }), h('div', { class: 'body', style: { whiteSpace: 'normal' } }, h('ul', { class: 'rf-tidy', style: { margin: 0 } }, atlases), h('p', { class: 'tiny mute', style: { marginTop: '8px' }, text: 'Interview material: the atlases hold the market facts the agency sells against. Open one and bring a number.' }))) : null);
    }

    /* ---- the form ---- */
    function field(label, el, note) { return h('div', { class: 'rf-f' }, h('label', { for: el.id || null }, label, note ? h('span', { class: 'mute', text: ' ' + note }) : null), el); }
    function inputFor(obj, key, id, placeholder, opts) {
      opts = opts || {};
      const el = h(opts.rows ? 'textarea' : 'input', { class: 'rf-in', id, placeholder, rows: opts.rows || null, type: opts.rows ? null : 'text', autocomplete: 'off', oninput: e => { obj[key] = e.target.value; if (opts.after) opts.after(e.target.value); save(); rebuild(); } });
      if (opts.rows) el.value = obj[key] || ''; else el.setAttribute('value', obj[key] || '');
      return el;
    }
    function paintForm() {
      const c = cand(), t = tail(); const code = En.trackOf(t); const p = En.profile(code); const level = En.levelOf(c);
      const r = S.read;
      const voc = vocab();
      /* experience */
      const expBox = h('div');
      const paintExp = () => fill(expBox, c.exp.map((x, i) => {
        const inp = (k, label, ph, rows) => { const id = 'rf-exp-' + i + '-' + k; const el = h(rows ? 'textarea' : 'input', { class: 'rf-in', id, placeholder: ph, rows: rows || null, 'aria-label': label + ', role ' + (i + 1), oninput: e => { x[k] = e.target.value; save(); rebuild(); } }); if (rows) el.value = x[k] || ''; else el.setAttribute('value', x[k] || ''); return el; };
        const f = (label, el, note) => h('div', { class: 'rf-f' }, h('label', { for: el.id }, label, note ? h('span', { class: 'mute', text: ' ' + note }) : null), el);
        return h('div', { class: 'rf-exp' },
          h('div', { class: 'rf-two' }, f('Title', inp('title', 'Title', En.titleFor(code, level))), f('Employer', inp('org', 'Employer', 'Agency or company, City ST'))),
          h('div', { class: 'rf-two' }, f('Dates', inp('dates', 'Dates', 'Jan 2022 – Present')), h('div', { class: 'rf-f', style: { alignContent: 'end' } }, c.exp.length > 1 ? h('button', { class: 'btn', type: 'button', onclick: () => { c.exp.splice(i, 1); save(); paintExp(); rebuild(); } }, 'Remove role ' + (i + 1)) : null)),
          f('Achievements', inp('bullets', 'Achievements', (p.starters || [])[0] || 'Grew organic sessions 40% in 9 months', 4), '(one per line: verb, what, number)'));
      }));
      paintExp();
      /* skills and the agency's words */
      const skills = inputFor(c, 'skills', 'rf-skills', 'Your own skills, comma separated. The chips below add the agency’s words to the front of the block for this agency only.', { rows: 2 });
      const termsBox = h('div', { class: 'rf-chips' });
      const paintTerms = () => fill(termsBox, t.terms.length ? t.terms.map(term => h('button', { class: 'rf-chip', type: 'button', 'aria-pressed': 'true', title: 'Remove from this agency’s skills', onclick: () => { t.terms = t.terms.filter(x => x !== term); save(); paintTerms(); paintChips(); rebuild(); } }, term, h('span', { class: 's', text: '×' }))) : h('span', { class: 'tiny mute', text: 'None yet. Click a chip below.' }));
      const chipsBox = h('div');
      const group = (label, src, note, clickable) => { const items = voc.filter(v => v.src === src); if (!items.length) return null; return h('div', { class: 'rf-vgroup' }, h('div', { class: 'eyebrow', text: label }), note ? h('p', { class: 'tiny mute', style: { margin: '0 0 6px' }, text: note }) : null, h('div', { class: 'rf-chips' }, items.map(v => clickable ? h('button', { class: 'rf-chip', type: 'button', 'aria-pressed': String(t.terms.some(x => x.toLowerCase() === v.t.toLowerCase())), title: v.note || '', onclick: () => { const has = t.terms.some(x => x.toLowerCase() === v.t.toLowerCase()); t.terms = has ? t.terms.filter(x => x.toLowerCase() !== v.t.toLowerCase()) : t.terms.concat([v.t]); save(); paintTerms(); paintChips(); rebuild(); } }, v.t) : h('span', { class: 'rf-chip static', title: v.note || '', text: v.t })))); };
      const paintChips = () => fill(chipsBox,
        S.agency ? group('Sells, in its own words', 'service', 'Service lines on its site. Add the ones that are honestly yours.', true) : null,
        S.agency ? group('Lines it sells at depth', 'line', null, true) : null,
        S.agency ? group('What its clients buy', 'need', null, true) : null,
        S.agency ? group('Verticals it publishes', 'vertical', null, true) : null,
        group('The track’s keywords', 'track', null, true),
        S.agency && voc.some(v => v.src === 'tool') ? h('details', { class: 'rf-fold' }, h('summary', { text: 'Tools seen on its own site' }), h('div', { class: 'body', style: { whiteSpace: 'normal' } }, h('p', { class: 'tiny mute', style: { margin: '0 0 6px' }, text: 'What runs on the agency’s own pages, not what it uses for clients. Add one only if you run it.' }), group('', 'tool', null, true))) : null,
        S.agency && voc.some(v => v.src === 'product') ? group('Its products · know them, do not claim them', 'product', 'Mention familiarity in the interview; they are not skills of yours.', false) : null);
      paintTerms(); paintChips();
      /* starters */
      const starters = En.starters(S.read, t.track);
      const starterList = h('div', { class: 'rf-list' }, starters.map(s => h('button', { class: 'rf-row', type: 'button', title: s.from === 'track' ? 'From the ' + p.label + ' track' : 'From the finding: ' + s.from, onclick: () => { const x = c.exp[c.exp.length - 1]; x.bullets = (x.bullets ? x.bullets.replace(/\s+$/, '') + '\n' : '') + s.t; save(); paintExp(); rebuild(); toast('Added to the last role; fill the [placeholders]'); } }, h('span', { class: 't', style: { fontWeight: '500', fontSize: '12.5px' }, text: s.t }), h('span', { class: 's', text: s.from === 'track' ? p.label + ' track' : 'from a finding' }))));
      /* level, title, verticals */
      const levelSel = h('select', { class: 'rf-in', id: 'rf-level', onchange: e => { c.level = e.target.value; if (!t.role || t.role === S.autoRole) t.role = ''; save(); paintForm(); rebuild(); } }, En.LEVELS.map(([k, l, d]) => h('option', { value: k, selected: level === k ? true : null, title: d }, l + ' · ' + d)));
      const roleIn = inputFor(t, 'role', 'rf-role', En.titleFor(code, level), { after: v => { S.autoRole = null; } });
      const titleChips = h('div', { class: 'rf-chips' }, En.LEVELS.map(([k]) => { const title = En.titleFor(code, k); return h('button', { class: 'rf-chip', type: 'button', 'aria-pressed': String((t.role || En.titleFor(code, level)) === title), onclick: () => { t.role = title; S.autoRole = title; roleIn.value = title; save(); paintForm(); rebuild(); } }, title, h('span', { class: 's', text: k })); }));
      const agencyVerts = r ? r.verticals.map(v => v.key) : [];
      const vertOrder = agencyVerts.concat(En.VERT_ORDER.filter(k => !agencyVerts.includes(k)));
      const vertChips = h('div', { class: 'rf-chips' }, vertOrder.map(k => { const v = En.VERT[k]; const on = c.verticals.includes(k); return h('button', { class: 'rf-chip' + (agencyVerts.includes(k) ? ' on' : ''), type: 'button', 'aria-pressed': String(on), title: agencyVerts.includes(k) ? 'The agency sells into this' : '', onclick: () => { c.verticals = on ? c.verticals.filter(x => x !== k) : c.verticals.concat([k]); save(); paintForm(); rebuild(); } }, v.label); }));
      const summary = inputFor(t, 'summary', 'rf-summary', 'Leave blank to auto-draft from the track, your top two skills and the agency’s needs.', { rows: 3 });
      fill(formBox, h('div', { class: 'card card-b' },
        h('div', { class: 'eyebrow', style: { marginBottom: '10px' }, text: 'Track · ' + p.label + (S.agency ? ' · tailored for ' + S.agency.name : ' · general') }),
        field('Name', inputFor(c, 'name', 'rf-name', 'Jordan Rivera')),
        field('Contact line', inputFor(c, 'contact', 'rf-contact', 'City, ST · you@email.com · (555) 555-5555 · linkedin.com/in/…'), 'as plain text, not a header'),
        h('div', { class: 'rf-two' }, field('Years of experience', inputFor(c, 'years', 'rf-years', '6 years')), field('Level', levelSel, '(sets the title and the length band)')),
        field('Title', roleIn, t.industry ? '(a title employers post for this track)' : '(a title agencies post for this track)'),
        h('div', { style: { margin: '-6px 0 12px' } }, titleChips),
        h('div', { class: 'rf-f' }, h('label', { text: 'Verticals you have worked in' }, h('span', { class: 'mute', text: S.agency ? ' (the agency’s first; only what you tick goes into the headline and summary)' : '' })), vertChips),
        field('Professional summary', summary, '(blank = auto-draft)'),
        h('div', { class: 'row', style: { margin: '-6px 0 12px' } }, h('button', { class: 'btn', type: 'button', onclick: () => { t.summary = En.autoSummary(c, t, S.read); summary.value = t.summary; save(); rebuild(); } }, 'Auto-draft the summary'), h('span', { class: 'tiny mute', text: 'A start, not a claim: edit it.' })),
        h('div', { class: 'eyebrow', style: { margin: '6px 0 8px' }, text: 'Experience · most recent first' }),
        expBox,
        h('button', { class: 'btn', type: 'button', onclick: () => { c.exp.push({ title: '', org: '', dates: '', bullets: '' }); save(); paintExp(); } }, '+ Add a role'),
        h('div', { style: { marginTop: '14px' } }, field('Bullet starters', starterList, '(click to add to the last role, then fill the [placeholders])')),
        field('Selected results', inputFor(c, 'results', 'rf-results', 'Optional. One per line: the two or three numbers you want read first.', { rows: 2 }), '(optional)'),
        field('Education & certifications', inputFor(c, 'education', 'rf-edu', 'B.A. Marketing, State University, 2019 · Google Ads Search Certification', { rows: 2 })),
        field('Your skills', skills),
        h('div', { class: 'rf-f' }, h('label', { text: (S.agency ? S.agency.name + '’s words' : 'Track words') + ' added for this résumé' }), termsBox),
        chipsBox,
        h('p', { class: 'tiny mute', style: { marginTop: '10px' }, text: 'Add only the terms that are true of you. The agency’s words set the order of the skills block; the facts stay yours.' }),
        h('div', { class: 'rf-rail', style: { marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--rule-2)' } },
          h('button', { class: 'btn', type: 'button', onclick: () => { flush(); ctx.saveFile('resume-draft.json', JSON.stringify(draft(), null, 1)); } }, 'Export draft'),
          (() => { const file = h('input', { class: 'rf-vh', type: 'file', id: 'rf-import', accept: 'application/json,.json', 'aria-label': 'Import a draft file', onchange: e => importDraft(e.target.files && e.target.files[0]) }); return [h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, 'Import draft'), file]; })(),
          S.agency ? h('button', { class: 'btn', type: 'button', onclick: () => { if (!confirm('Reset the tailoring for ' + S.agency.name + ' (track, title, summary, added terms, posting)? Your facts stay.')) return; delete draft().tailor[S.agency.id]; setAgency(S.agency); save(); paintAll(); } }, 'Reset this agency’s tailoring') : null,
          h('button', { class: 'btn', type: 'button', onclick: () => { if (!confirm('Clear the whole draft on this device: your facts and every agency’s tailoring?')) return; S.draft = En.blankDraft(); S.built = ''; S.lint = null; if (S.agency) setAgency(S.agency); flush(); paintAll(); } }, 'Clear my draft'))));
      const n = Object.keys(draft().tailor || {}).length; const tl = root.querySelector('#rf-tailored'); if (tl) tl.textContent = n ? 'Tailored for ' + n + ' agenc' + (n === 1 ? 'y' : 'ies') + ' on this device' : '';
    }
    function importDraft(file) {
      if (!file) return;
      const rd = new FileReader();
      rd.onload = () => {
        let j = null; try { j = JSON.parse(String(rd.result)); } catch (e) { j = null; }
        if (!j || typeof j !== 'object' || !j.candidate || !Array.isArray(j.candidate.exp)) { toast('That file is not a Forge draft'); return; }
        const before = S.draft;
        try { S.draft = normDraft(j); if (S.agency) setAgency(S.agency); paintAll(); flush(); toast('Draft imported'); }
        catch (e) { S.draft = before; try { paintAll(); } catch (x) { /* the previous draft drew before */ } toast('That draft could not be drawn; nothing was changed'); }
      };
      rd.readAsText(file);
    }

    /* ---- build, grade, preview ---- */
    function rebuild(now) {
      clearTimeout(S.buildT);
      const run = () => {
        const c = cand(), t = tail();
        S.built = En.build(c, t, S.read);
        S.lint = En.lint(S.built, c, t, { read: S.read });
        const mt = mirrorTerms();
        S.mirror = En.mirror(S.built, c, mt.terms, { source: mt.source, role: En.roleOf(c, t) });
        paintPreview(); paintCheck();
      };
      if (now) run(); else S.buildT = setTimeout(run, 250);
    }
    function paintPreview() {
      fill(prevBox, h('div', { class: 'card card-b' }, h('h3', { class: 'rf-h3', text: 'Preview · plain text, as a parser sees it' }), h('pre', { class: 'rf-out', id: 'rf-out', text: S.built || '' }),
        h('div', { class: 'rf-rail', style: { marginTop: '12px' } },
          h('button', { class: 'btn pri', type: 'button', id: 'rf-build', onclick: () => { rebuild(true); toast('Rebuilt'); } }, 'Rebuild', icon('arrow')),
          h('button', { class: 'btn', type: 'button', onclick: copyOut }, icon('copy'), 'Copy'),
          h('span', { class: 'tiny mute', text: 'Rebuilds as you type. Exports are in the Check stage.' }))));
    }
    function badge(label, val, good) { return h('span', { class: 'pill', style: { background: good ? 'var(--health-tint)' : 'var(--sun-tint)' } }, label + ': ', h('b', { text: String(val) })); }
    function paintCheck() {
      const L = S.lint, M = S.mirror, c = cand(), t = tail();
      if (!L) { fill(checkBox); return; }
      const cls = !L.ready ? 'bad' : L.score >= 80 ? 'good' : L.score >= 55 ? '' : 'bad';
      const parts = [];
      parts.push(h('div', { class: 'grid g2' },
        h('div', { class: 'card card-b' },
          h('div', { class: 'rf-score' }, h('div', { class: 'big ' + cls, id: 'rf-score', text: String(L.score), 'aria-label': (L.ready ? 'ATS readiness ' : 'Not ready to send, capped at ') + L.score }),
            h('div', null, h('h3', { class: 'rf-h3', style: { marginBottom: '2px' }, text: L.ready ? 'ATS readiness, 0 to 100' : 'Not ready to send' }), h('p', { class: 'small mute', text: L.ready ? 'Eight structural checks, weighted the way parsers and the six-second skim weigh them.' : 'A hard gate is open; the score is capped at 40 until it closes.' }))),
          L.gates.map(g => h('div', { class: 'rf-gate' }, h('b', { text: g.label }), g.tip)),
          h('div', { class: 'rf-checks' }, L.checks.map(ck => h('div', { class: 'rf-check ' + (ck.ok ? 'ok' : ck.part ? 'part' : 'no') }, h('span', { class: 'st', text: ck.ok ? 'pass' : ck.part ? 'partly' : 'no' }), h('span', { text: ck.label }), h('span', { class: 'd', text: ck.detail || '' }), ck.ok ? null : h('span', { class: 'tip', text: ck.tip })))),
          L.claims && L.claims.length ? h('div', { style: { marginTop: '12px' } }, h('div', { class: 'eyebrow', text: 'Skills without evidence' }), h('p', { class: 'tiny mute', style: { margin: '4px 0 6px' }, text: 'In the skills block with no bullet, result or education line behind them. Add the bullet, or drop the skill.' }), h('div', { class: 'rf-chips' }, L.claims.map(s => h('span', { class: 'rf-chip static', text: s })))) : null),
        h('div', { class: 'card card-b' },
          h('h3', { class: 'rf-h3', text: M && M.source === 'posting' ? 'Mirrors the posting: ' + M.present.length + ' of ' + M.total + ' terms' : (S.agency ? 'Mirrors ' + S.agency.name + '’s language: ' : 'Mirrors the track’s language: ') + (M ? M.present.length + ' of ' + M.total + ' terms' : '') }),
          h('p', { class: 'small mute', text: (M && M.source === 'posting' ? 'The pasted posting overrides the agency’s site: an ATS scores overlap with the posting. ' : 'Counted from what it sells and the track, not from tools on its site or its products. ') + 'Whole words, once each, worth more inside a quantified bullet, capped at ' + (M ? M.cap : 10) + ' points. Add only what is honestly yours.' }),
          M ? h('div', { class: 'rf-badges' }, badge('Points', M.pts + ' of ' + M.cap, M.pts >= M.cap * 0.6), badge('In quantified bullets', M.present.filter(p => p.pts === 2).length, M.present.some(p => p.pts === 2)), M.overused.length ? badge('Over three times', M.overused.join(', '), false) : null) : null,
          M && M.present.length ? h('div', { class: 'rf-chips', style: { marginTop: '6px' } }, M.present.map(p => h('span', { class: 'rf-chip', 'aria-pressed': 'true', title: p.where, text: p.t + (p.n > 1 ? ' ×' + p.n : '') }))) : null,
          M && M.missing.length ? h('p', { class: 'tiny mute', style: { marginTop: '10px' }, text: 'Not in the résumé: ' + M.missing.slice(0, 14).join(' · ') + (M.missing.length > 14 ? ' · …' : '') }) : null,
          L.readability ? h('div', { style: { marginTop: '14px' } }, h('div', { class: 'eyebrow', text: 'Readability · bullets and summary' }), h('div', { class: 'rf-badges' }, badge('Grade', L.readability.grade, L.readability.grade <= 11.5), badge('Ease', L.readability.ease + '/100', L.readability.ease >= 40), badge('Avg sentence', L.readability.avgSentence + ' words', L.readability.avgSentence <= 20), badge('Passive', L.readability.passive, L.readability.passive <= 3)), L.readability.weak.length ? h('ul', { class: 'rf-tidy' }, L.readability.weak.map(w => h('li', { text: w }))) : null) : null)));
      const stem = En.fileStem(c, t, S.read);
      parts.push(h('div', { class: 'card card-b', style: { marginTop: '14px' } },
        h('h3', { class: 'rf-h3', text: 'Export' }),
        h('div', { class: 'rf-rail' },
          h('button', { class: 'btn pri', type: 'button', onclick: copyOut }, icon('copy'), 'Copy text'),
          h('button', { class: 'btn', type: 'button', id: 'rf-dl-txt', onclick: () => { flush(); ctx.saveFile(stem + '.txt', S.built); } }, icon('down'), '.txt'),
          h('button', { class: 'btn', type: 'button', onclick: () => { flush(); ctx.saveFile(stem + '.md', En.markdown(c, t, S.read)); } }, icon('down'), '.md'),
          h('button', { class: 'btn', type: 'button', id: 'rf-print-btn', onclick: printOut }, 'Print / PDF'),
          S.agency ? h('button', { class: 'btn', type: 'button', id: 'rf-brief', title: 'What Leviathan knows about this agency, as interview preparation: the read, the gaps, questions to ask, things to verify', onclick: () => { flush(); ctx.saveFile(stem + '-brief.md', En.brief(S.read, c, t, { lint: L })); } }, icon('down'), 'Interview brief') : null),
        h('p', { class: 'tiny mute', style: { marginTop: '8px' }, text: 'The .txt is the paste-into-form format; the .md keeps headings for a document; Print / PDF prints a one-column page. Files are named ' + stem + '.' })));
      fill(checkBox, parts);
    }
    function copyOut() {
      const text = S.built; if (!text) return;
      const fallback = () => { try { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand && document.execCommand('copy'); ta.remove(); toast(ok ? 'Copied' : 'Copy failed: select the preview and copy by hand'); } catch (e) { toast('Copy failed: select the preview and copy by hand'); } };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Copied'), fallback); else fallback();
    }
    function printOut() {
      flush();
      let box = document.getElementById('rf-print');
      if (!box) { box = document.createElement('div'); box.id = 'rf-print'; box.setAttribute('aria-hidden', 'true'); document.body.appendChild(box); }
      box.innerHTML = En.html(cand(), tail(), S.read);
      try { window.print(); } catch (e) { toast('The browser blocked printing; use the .md export'); }
    }

    /* ---- match a posting ---- */
    (function paintMatch() {
      const t = tail();
      const jd = h('textarea', { class: 'rf-in', id: 'rf-jd', rows: 5, placeholder: 'Paste the job posting text here…', 'aria-label': 'Job posting', oninput: e => { t.posting = e.target.value; save(); rebuild(); } });
      jd.value = t.posting || '';
      const outM = h('div');
      const run = () => {
        const text = jd.value.trim(); if (!text) { fill(outM, h('p', { class: 'small mute', text: 'Paste a posting first.' })); return; }
        const m = En.match(text, S.built, vocab());
        fill(outM,
          m.read ? h('p', { class: 'small mute', text: 'The posting reads at about grade ' + m.read.grade + ' (' + m.read.avgSentence + ' words a sentence). Match its tone and formality.' }) : null,
          h('p', { style: { marginTop: '8px' } }, h('b', { text: 'Already in your résumé (' + m.have.length + ')' })), h('div', { class: 'rf-chips' }, m.have.length ? m.have.map(k => h('span', { class: 'rf-chip', 'aria-pressed': 'true', text: k })) : h('span', { class: 'small mute', text: 'none yet' })),
          h('p', { style: { marginTop: '10px' } }, h('b', { text: 'In the posting but not your résumé (' + m.miss.length + ')' })), h('div', { class: 'rf-chips' }, m.miss.length ? m.miss.map(k => h('button', { class: 'rf-chip', type: 'button', title: 'Add to this résumé’s skills', onclick: () => { const tt = tail(); if (!tt.terms.some(x => x.toLowerCase() === k.toLowerCase())) { tt.terms = tt.terms.concat([k]); save(); paintForm(); rebuild(); toast('Added "' + k + '" to the skills for this résumé'); } } }, '+ ' + k)) : h('span', { class: 'small mute', text: 'great overlap' })),
          S.agency && m.agencyTermsInPosting.length ? [h('p', { style: { marginTop: '10px' } }, h('b', { text: S.agency.name + '’s own terms the posting uses (' + m.agencyTermsInPosting.length + ')' })), h('div', { class: 'rf-chips' }, m.agencyTermsInPosting.map(k => h('span', { class: 'rf-chip on', text: k })))] : null,
          h('p', { class: 'tiny mute', style: { marginTop: '10px' }, text: 'Add the missing terms that honestly describe you; do not keyword-stuff. These are the posting’s own words, which is what an ATS scores against. While a posting is pasted, the “mirrors” count above reads from it.' }));
      };
      fill(matchBox, h('div', { class: 'card card-b', style: { marginTop: '14px' } }, h('h3', { class: 'rf-h3', text: 'Match a posting' }), h('p', { class: 'small mute', style: { marginBottom: '8px' }, text: 'Paste a job description you are applying to. The Forge pulls its skill phrases and words, shows which are already in your résumé, and marks the agency’s own terms the posting uses. It analyses the text you paste; it identifies no one.' }), jd, h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn', type: 'button', onclick: run }, 'Compare to my résumé')), outM));
      if (t.posting) run();
    })();

    /* first paint, then the stored draft when the store is ready */
    paintAll();
    if (!S.loaded) {
      const hydrate = v => {
        if (!v || typeof v !== 'object') return;
        const before = S.draft;
        try { S.draft = normDraft(v); if (S.agency) setAgency(S.agency); if (S.paint) S.paint(); }
        catch (e) { S.draft = before || En.blankDraft(); try { if (S.paint) S.paint(); } catch (x) { /* the blank draft drew before */ } toast('The stored draft could not be drawn; starting from a blank one'); }
      };
      storeReady().then(() => { S.loaded = true; hydrate(storeGet()); }).catch(() => { S.loaded = true; });
      const st = store();
      if (st && st.onSnapshot) st.onSnapshot(data => { const v = data && data[KEY]; if (v && isBlank(draft())) hydrate(v); else flush(); });
    }
    return root;
  }

  function standards(ctx) {
    const { h } = ctx;
    return h('div', null,
      h('div', { class: 'sec-h' }, h('h2', { text: 'What ATS and recruiters generally scan for' }), h('p', { text: 'The checks the score is built from, in plain English. From Clapback’s résumé module, in aggregate: no system is named, none is profiled.' })),
      h('div', { class: 'card card-b' }, h('ul', { class: 'rf-tidy', style: { margin: 0 } },
        h('li', null, h('b', { text: 'A title they post for. ' }), 'Recruiters search by title string. The headline under your name names the role the way the agency would post it; your own wording goes in the summary.'),
        h('li', null, h('b', { text: 'Keyword match to the posting. ' }), 'Applicant tracking systems rank you on overlap with the job’s own words. Echo the real skill terms, honestly, in a clear skills block: the Forge hands you the agency’s, and the posting’s when you paste one.'),
        h('li', null, h('b', { text: 'Simple, parseable formatting. ' }), 'Standard section headers (Summary, Skills, Experience, Education), one column, no tables, text boxes or images, common fonts. Fancy layouts get scrambled on parse.'),
        h('li', null, h('b', { text: 'File type and naming. ' }), 'Submit the format the posting asks for; a text-based PDF or .docx parses well. The Forge names files First-Last-Title-Agency; the .txt is the paste-into-form source.'),
        h('li', null, h('b', { text: 'Reverse-chronological, dated. ' }), 'Most recent first, with month and year ranges. Unexplained gaps and undated roles hurt parsing and reads.'),
        h('li', null, h('b', { text: 'Contact basics up top. ' }), 'Name, city and state, email, phone, one profile link, as text, not in a header or footer (some parsers skip those).'),
        h('li', null, h('b', { text: 'Impact over duties. ' }), 'Every bullet: action verb, what you did, a measurable result. Numbers survive both the parser and the six-second human skim.')),
        h('p', { class: 'rf-note', style: { marginTop: '12px' }, text: 'Everything on this screen stays in your browser: the draft lives in the extension’s local storage on this device. The findings are Leviathan’s reads of each agency’s public record, dated; the résumé is your facts in that agency’s vocabulary. Nothing here invents a claim for you.' })));
  }

  G.__LV_RESUME = { version: '1.1.0', view, state: S, KEY };
})();
