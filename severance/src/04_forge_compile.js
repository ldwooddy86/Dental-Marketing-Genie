/* ==== forge_compile ==== */
/* SEVERANCE Site Forge compiler (FORGE_COMPILE): the Thermal Atlas compiler, same API, adapted for a Texas family law firm.
     compile(bp, media) → {template, elementor_data, page_settings, html, preview, schema, seo, lint, warnings, issues, portable, page, blueprint}
                          lint and warnings are the same list of strings ('BLOCK: ...' stops a deploy, 'MEDIA: ...' is a note)
     bundle(bp, media, r) → what the bridge imports on forge/v1/import (content_html never carries a media placeholder; the blueprint is the portable one)
     portable(bp, media)  → the blueprint with the law firm section types lowered to the types the headless kit renders, the automatic
                            disclaimer appended and the intake form fields written out
     pageFor(bp, r, media, extra) → CMS.pageFromForge on the portable blueprint (use it for Publish so headless front ends show every section)
     previewPage(bp, media) → a standalone preview document · validateSchema(schema) → [messages] · defaultForm(bp) → {fields, consent, button}
     tblsLine(area) → 'Board Certified, <area>, Texas Board of Legal Specialization' (the only specialty wording Rule 7.02(b) allows)
   Blueprint: {forge, site:{url, name, cms, brand:{name, primary, accent, dark, font_heading, font_body, logo_url, globals}, firm}, page, media, sections}
     site.firm  the firm profile in the FIRM.get() shape (FIRM.get() itself when the blueprint has none and the app has FIRM); optional
                resolved names county_names, city_names, practice_areas (else CI and LINE_META are read when the app has them). It feeds the LegalService node, the attorney cards, the disclaimer and the form.
     page       archetype (home, about, service, practice, location, landing, article, guide, attorney, contact), slug, title, h1,
                meta_description, language (en-US or es-US), template, breadcrumbs, summary, entity (merged into the LegalService node),
                dates {published, modified, reviewed}, cta, conversion {sticky_mobile_bar, trust, form}, internal_links, schema_extra, author,
                service, line (a LINE_META key), attorney (the lawyer an attorney page is about), alternates [{lang, url}], noindex, canonical,
                disclaimer (false drops the automatic disclaimer block), safety {sensitive: 'po' | 'cps', quick_exit, exit_url, safe_contact}
                (Safety mode for protective order, family violence and CPS pages: a quick exit at the top, the intake form asks whether it
                is safe to call, text or leave a voicemail, no dataLayer push, and no video, map or other third party frame)
     conversion.form  {provider html | elementor_pro | wpforms | gravity | cf7 | fluent | shortcode, fields [{id, label, type, required,
                options, hint, placeholder, maxlength, autocomplete}], counties, matters, consent, button, success, shortcode, email_to, action}
     sections   hero, answer, key_facts, rich_text, steps, process, features, media, video, gallery, testimonials, stats, faq, cta_band, form,
                map, table, authors, links, html, and for the firm: attorneys {heading, text, items, show_bar}, disclaimer {attorney, firm,
                city, location, extra}, court_facts {heading, county, items [{label, value, source}], courts [{name, address, phone, url}],
                note, source}, lang_toggle {url, lang, label}, quick_exit {url, label, hint} (a "Leave this site" button fixed at the top;
                the Escape key does the same; both replace the page with a neutral site so Back does not return to it), hotline {heading,
                text (paragraphs by line), phone, phone_label, url}. Every step of steps and process may carry when.
   Media: a slot the compile cannot resolve becomes a "resolved at deploy" placeholder in the html and preview (Publish strips it), an
   empty image in the Elementor data (marked with _forge_media so the bridge fills it from media_resolved on import), and is left out of
   the JSON-LD and the og image. A page never ships a placeholder. */
'use strict';
const FORGE_COMPILE = (() => {
  const HEXC = '0123456789abcdef';
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  function hexmix(c, white) { white = white == null ? 0.9 : white; c = String(c || '#13243a').replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16); const f = v => Math.round(v + (255 - v) * white); return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join(''); }
  const slug = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const tel = s => 'tel:' + String(s).replace(/[^\d+]/g, '');
  function numFrom(v) { const m = String(v).match(/[\d,.]+/); return m ? parseFloat(m[0].replace(/,/g, '')) : null; }
  const arr = v => Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);
  const uniq = a => a.filter((x, i) => x && a.indexOf(x) === i);
  const isHttp = u => /^https?:\/\//i.test(String(u || ''));
  const e164 = p => { const d = String(p || '').replace(/\D/g, ''); if (d.length === 10) return '+1' + d; if (d.length === 11 && d[0] === '1') return '+' + d; return String(p || '').trim(); };
  const listAnd = (a, and) => { a = a.filter(Boolean); return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + and + a[a.length - 1]; };
  const titleCase = s => String(s).replace(/\S+/g, (w, i) => (i > 0 && /^(and|of|the|or|in)$/i.test(w)) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1));

  /* ---------- placeholders and visible text ---------- */
  const PH_RE = /resolved(%20| )at(%20| )deploy/i;
  const isPh = u => /^data:image\/svg\+xml/.test(String(u || '')) && PH_RE.test(String(u));
  const stripPh = html => String(html || '').replace(/<img\b[^>]*src="data:image\/svg\+xml[^"]*resolved(?:%20| )at(?:%20| )deploy[^"]*"[^>]*>/gi, '').replace(/url\((?:'|")?data:image\/svg\+xml[^)]*resolved(?:%20| )at(?:%20| )deploy[^)]*\)/gi, 'none');
  const stripDataImg = html => stripPh(html).replace(/<img\b[^>]*src="data:[^"]*"[^>]*>/gi, '');
  const phSvg = key => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#e7e9ec"/><text x="800" y="500" font-family="Arial,sans-serif" font-size="44" fill="#5b6570" text-anchor="middle">' + String(key).replace(/[<&]/g, '') + ' image, resolved at deploy</text></svg>');
  const decode = s => String(s).replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');
  const visibleText = html => decode(String(html || '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const DASH = /[\u2010-\u2015\u2212]|(?<=\w)-(?=\w)|\s-\s/;
  const SPECIAL = /\b(specialists?|speciali[sz](?:e|es|ed|ing|ation)|experts?|expertise|certified|especialistas?|especializad[oa]s?|expert[oa]s?|certificad[oa]s?)\b/i;
  const TBLS_RE = /Board Certified,\s*([^,]{2,80}?),\s*Texas Board of Legal Specialization/i;
  const TBLS_ALL = /Board Certified,\s*[^,]{2,80}?,\s*Texas Board of Legal Specialization/gi;

  /* ---------- Rule 7.02(b): the only specialty wording ---------- */
  function tblsArea(v) {
    if (!v) return ''; let s = String(v).trim(); const m = s.match(TBLS_RE); if (m) s = m[1];
    s = s.replace(/\bTexas Board of Legal Specialization\b/gi, '').replace(/\bboard\s+certified\b/gi, '').replace(/\b(certified|certification|specialist|specialization|specialized|specializing)\b/gi, ' ').replace(/\s+/g, ' ').replace(/^[\s,;:.]+|[\s,;:.]+$/g, '').replace(/^in\s+/i, '').trim();
    return s ? titleCase(s) : '';
  }
  const tblsLine = v => { const a = tblsArea(v); return a ? `Board Certified, ${a}, Texas Board of Legal Specialization` : ''; };

  /* ---------- copy defaults (house style: no hyphens or dashes) ---------- */
  const STR = {
    en: { answer: 'The short answer', how: 'How it works', process: 'How the process works', faq: 'Frequently asked questions', clients: 'What clients say', related: 'Related', reviewed: 'Reviewed by', profile: 'Profile', transcript: 'Video transcript', video: 'Video',
      call: p => 'Call ' + p, callNow: 'Call now', start: 'Contact the firm', send: 'Request a consultation', attorneys: 'Our attorneys', attorney: 'Attorney', bar: n => 'State Bar of Texas No. ' + n, since: y => 'Licensed in Texas since ' + y,
      fullProfile: 'Read the full profile', more: 'Learn more', court: c => c ? `${c} County courts and filing facts` : 'Court and county facts', courtLbl: 'Court', source: 'Source', choose: 'Choose one',
      ok: 'Thank you. The firm will contact you soon.', err: 'Something went wrong. Please call the office.', formName: 'Consultation request', consentLbl: 'Consent', otherCounty: 'Another Texas county', otherMatter: 'Something else', newInquiry: 'New inquiry: ',
      photoAlt: n => 'Photo of ' + n, langs: { en: 'English', es: 'Spanish' }, speaks: l => 'Speaks ' + l, and: ' and ', countyName: c => `${c} County`, website: 'Website',
      fields: { name: 'Full name', phone: 'Phone', email: 'Email', county: 'County', matter: 'Type of matter', message: 'Short description', hint: 'Do not include confidential details.', phoneSafe: 'Leave it blank if no number is safe.',
        safe: 'Is it safe to call, text or leave a voicemail?', safeHint: 'The firm contacts you only in the way you choose.', safeOpts: ['Yes, calls, texts and voicemail are all safe', 'Calls only, please leave no voicemail', 'Texts only', 'Email only', 'None of these, I will contact the firm'] },
      consentSafe: 'The firm contacts you only in the way you choose above.', exit: 'Leave this site', exitHint: 'Or press Escape', exitRegion: 'Quick exit',
      hotline: { heading: 'If you are not safe', text: 'If you are in danger now, call 911.\nThe National Domestic Violence Hotline is free and confidential, day and night: call 1 800 799 7233 or text START to 88788.\nUse a phone or computer the other person cannot check. The Leave this site button, or the Escape key, closes this page.' },
      consent: firm => `By submitting this form, you agree that ${firm || 'the firm'} may contact you about your inquiry by phone, text message or email. Message and data rates may apply. Message frequency varies. Reply STOP to opt out of texts. Consent is not a condition of hiring the firm. Submitting this form does not create an attorney client relationship; the firm represents you only after you and the firm sign an engagement agreement.`,
      disclaimer: (atty, firm, loc) => [`This page is attorney advertising. Responsible attorney: ${atty}, ${firm}. Primary practice location: ${loc}.`, 'The information on this page is general information about Texas law, not legal advice for your situation. Reading this page, calling the firm or sending the form does not create an attorney client relationship. The firm represents you only after you and the firm sign an engagement agreement, so please do not send confidential information before then.'] },
    es: { answer: 'La respuesta corta', how: 'Cómo funciona', process: 'Cómo funciona el proceso', faq: 'Preguntas frecuentes', clients: 'Lo que dicen nuestros clientes', related: 'Más información', reviewed: 'Revisado por', profile: 'Perfil', transcript: 'Transcripción del video', video: 'Video',
      call: p => 'Llame al ' + p, callNow: 'Llamar', start: 'Contacte a la firma', send: 'Solicitar una consulta', attorneys: 'Nuestros abogados', attorney: '', bar: n => 'State Bar of Texas, número ' + n, since: y => 'Con licencia en Texas desde ' + y,
      fullProfile: 'Ver el perfil completo', more: 'Más información', court: c => c ? `Tribunales y datos del condado de ${c}` : 'Datos del condado y de los tribunales', courtLbl: 'Tribunal', source: 'Fuente', choose: 'Elija una opción',
      ok: 'Gracias. La firma se comunicará con usted pronto.', err: 'Algo salió mal. Por favor llame a la oficina.', formName: 'Solicitud de consulta', consentLbl: 'Consentimiento', otherCounty: 'Otro condado de Texas', otherMatter: 'Otro asunto', newInquiry: 'Nueva consulta: ',
      photoAlt: n => 'Foto de ' + n, langs: { en: 'inglés', es: 'español' }, speaks: l => 'Habla ' + l, and: ' y ', countyName: c => `Condado de ${c}`, website: 'Sitio web',
      fields: { name: 'Nombre completo', phone: 'Teléfono', email: 'Correo electrónico', county: 'Condado', matter: 'Tipo de asunto', message: 'Breve descripción', hint: 'No incluya detalles confidenciales.', phoneSafe: 'Déjelo en blanco si ningún número es seguro.',
        safe: '¿Es seguro llamarle, enviarle mensajes de texto o dejarle un mensaje de voz?', safeHint: 'La firma se comunica con usted solo de la forma que usted elija.', safeOpts: ['Sí, llamadas, mensajes de texto y mensajes de voz', 'Solo llamadas, sin mensajes de voz', 'Solo mensajes de texto', 'Solo correo electrónico', 'Ninguno, yo me comunico con la firma'] },
      consentSafe: 'La firma se comunica con usted solo de la forma que usted elija arriba.', exit: 'Salir de este sitio', exitHint: 'O presione la tecla Esc', exitRegion: 'Salida rápida',
      hotline: { heading: 'Si no está a salvo', text: 'Si está en peligro ahora, llame al 911.\nLa National Domestic Violence Hotline (Línea Nacional contra la Violencia Doméstica) es gratuita y confidencial, de día y de noche, también en español: llame al 1 800 799 7233 o envíe START al 88788.\nUse un teléfono o una computadora que la otra persona no pueda revisar. El botón Salir de este sitio, o la tecla Esc, cierra esta página.' },
      consent: firm => `Al enviar este formulario, acepta que ${firm || 'la firma'} se comunique con usted sobre su consulta por teléfono, mensaje de texto o correo electrónico. Pueden aplicarse tarifas de mensajes y datos. La frecuencia de los mensajes varía. Responda STOP para dejar de recibir mensajes de texto. El consentimiento no es una condición para contratar a la firma. Enviar este formulario no crea una relación de abogado y cliente; la firma le representa solo después de que usted y la firma firmen un contrato de representación.`,
      disclaimer: (atty, firm, loc) => [`Esta página es publicidad de abogados. Abogado responsable: ${atty}, ${firm}. Oficina principal: ${loc}.`, 'La información de esta página es información general sobre la ley de Texas, no asesoría legal para su caso. Leer esta página, llamar a la firma o enviar el formulario no crea una relación de abogado y cliente. La firma le representa solo después de que usted y la firma firmen un contrato de representación; por favor no envíe información confidencial antes de eso.'] },
  };
  const TOGGLE = { es: 'Lea esta página en español', en: 'Read this page in English' };
  const optList = o => arr(o).map(x => x && typeof x === 'object' ? { value: String(x.value != null ? x.value : x.label), label: String(x.label != null ? x.label : x.value) } : { value: String(x), label: String(x) }).filter(x => x.label);
  const safeField = lang => { const L = (STR[lang] || STR.en).fields; return { id: 'safe_contact', label: L.safe, type: 'select', required: true, options: L.safeOpts.slice(), hint: L.safeHint }; };
  function defaultFields(lang, counties, matters, safe) {
    const T = STR[lang] || STR.en, L = T.fields;
    return [
      { id: 'name', label: L.name, type: 'text', required: true, autocomplete: 'name' },
      safe ? { id: 'phone', label: L.phone, type: 'tel', required: false, autocomplete: 'tel', hint: L.phoneSafe } : { id: 'phone', label: L.phone, type: 'tel', required: true, autocomplete: 'tel' },
      { id: 'email', label: L.email, type: 'email', required: false, autocomplete: 'email' }].concat(safe ? [safeField(lang)] : []).concat([
      counties.length ? { id: 'county', label: L.county, type: 'select', required: false, options: counties.concat([T.otherCounty]) } : { id: 'county', label: L.county, type: 'text', required: false },
      matters.length ? { id: 'matter', label: L.matter, type: 'select', required: false, options: matters.concat([T.otherMatter]) } : { id: 'matter', label: L.matter, type: 'text', required: false },
      { id: 'message', label: L.message, type: 'textarea', required: false, maxlength: 600, hint: L.hint }]);
  }
  const FORM_CSS = '<style>.forge-form select{width:100%;padding:12px;border:1px solid #cfcdc5;border-radius:8px;font:inherit;background:#fff}.forge-form .forge-hint{display:block;font-size:13px;opacity:.8;margin:4px 0 0}.forge-form .forge-consent input{width:auto;margin:0 8px 0 0}.forge-form .forge-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}</style>';
  const FORM_JS = '<scr' + 'ipt>(function(){var fs=document.querySelectorAll("[data-forge-form]");Array.prototype.forEach.call(fs,function(f){if(f.getAttribute("data-forge-bound"))return;f.setAttribute("data-forge-bound","1");f.addEventListener("submit",function(e){e.preventDefault();var m=f.querySelector(".forge-form-msg"),b=f.querySelector("button[type=submit]")||f.querySelector("button"),ok=f.getAttribute("data-ok"),er=f.getAttribute("data-err");b.disabled=true;var d={};new FormData(f).forEach(function(v,k){d[k]=v});fetch(f.action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}).then(function(r){return r.json().catch(function(){return {}}).then(function(j){return {ok:r.ok&&j.ok!==false,j:j||{}}})}).then(function(x){if(x.ok){m.textContent=ok||x.j.message||"Thank you.";f.reset();if(window.dataLayer)window.dataLayer.push({event:"forge_lead",page:d.page})}else{m.textContent=x.j.message||er||"Please call the office."}b.disabled=false}).catch(function(){m.textContent=er||"Please call the office.";b.disabled=false})})})})();</' + 'script>';
  /* Safety mode: the same form script without the dataLayer push, and the quick exit (a link that works without script; with script the
     click and the Escape key hide the page and replace it with the neutral site, so the Back button does not return to it) */
  const FORM_JS_SAFE = FORM_JS.replace('if(window.dataLayer)window.dataLayer.push({event:"forge_lead",page:d.page})', '');
  const EXIT_URL = 'https://weather.com/';
  const EXIT_CSS = '<style>.forge-exit{position:fixed;top:12px;right:12px;z-index:100000;display:flex;flex-direction:column;align-items:flex-end;gap:3px;margin:0}.forge-exit-btn{display:inline-block;background:#a3221b;color:#fff!important;font:700 15px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:12px 16px;border-radius:8px;text-decoration:none!important;box-shadow:0 2px 10px rgba(0,0,0,.28)}.forge-exit-btn:hover{background:#7f1a15}.forge-exit-btn:focus{outline:3px solid #111;outline-offset:2px}.forge-exit-hint{font:12px/1.3 system-ui,sans-serif;background:#fff;color:#333;padding:2px 6px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.2)}@media(max-width:767px){.forge-exit{top:8px;right:8px}.forge-exit-hint{display:none}}</style>';
  const EXIT_JS = '<scr' + 'ipt>(function(){if(window.__forgeExit)return;window.__forgeExit=1;function go(e){var a=document.querySelector("[data-forge-exit]");var u=(a&&a.getAttribute("data-exit-url"))||"' + EXIT_URL + '";if(e&&e.preventDefault)e.preventDefault();try{document.documentElement.style.visibility="hidden";document.title="";}catch(x){}try{window.location.replace(u)}catch(x){window.location.href=u}}document.addEventListener("click",function(e){var t=e.target&&e.target.closest?e.target.closest("[data-forge-exit]"):null;if(t)go(e)});document.addEventListener("keydown",function(e){if(e.key==="Escape"||e.key==="Esc")go(e)})})();</' + 'script>';
  const safeUrl = u => /^https:\/\/[^\s"'<>]+$/i.test(String(u || '').trim()) ? String(u).trim() : EXIT_URL;
  const TRACKING = /dataLayer|\bfbq\s*\(|\bgtag\s*\(|googletagmanager|connect\.facebook\.net|google-analytics|analytics\.tiktok|clarity\.ms|<iframe\b|<script\b[^>]*\bsrc\s*=/gi;
  const PREVIEW_CSS = ':root{--p:%p;--a:%a;--t:%t;--d:%d}*{box-sizing:border-box}body{margin:0;font:16px/1.6 %font;color:#1b1b1a;background:#fff}h1,h2,h3{font-family:%hfont;line-height:1.15;margin:.2em 0 .5em}h1{font-size:clamp(30px,4.2vw,48px)}h2{font-size:clamp(24px,3vw,34px)}h3{font-size:20px}.forge-section{padding:72px 20px}.forge-tint{background:var(--t)}.forge-brand{background:var(--p);color:#fff}.forge-brand h2{color:#fff}.forge-dark{background:var(--d);color:#fff}.forge-inner{max-width:1140px;margin:0 auto}.forge-narrow{max-width:820px}.forge-split{display:grid;grid-template-columns:1.2fr 1fr;gap:40px;align-items:center}.forge-split img,.forge-video iframe,video{width:100%;height:auto;border-radius:14px;aspect-ratio:16/10;object-fit:cover}.forge-video{position:relative;aspect-ratio:16/9}.forge-video iframe{position:absolute;inset:0;height:100%}.forge-eyebrow{color:var(--a);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:13px}.forge-lede{font-size:19px;color:#3f3f3c}.forge-btn{display:inline-block;padding:14px 22px;border-radius:8px;font-weight:700;text-decoration:none;margin:6px 8px 6px 0}.forge-btn-primary{background:var(--p);color:#fff}.forge-btn-secondary{background:var(--a);color:#fff}.forge-brand .forge-btn-primary{background:var(--a);color:#fff}.forge-trust{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px 18px;font-size:14px}.forge-trust li:before{content:"✓ ";color:var(--p);font-weight:700}.forge-answer{font-size:20px;border-left:4px solid var(--p);padding-left:16px}.forge-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}.forge-facts div{background:#fff;border-radius:12px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,.08)}.forge-facts dt{font-size:34px;font-weight:800;color:var(--p)}.forge-brand .forge-facts div{background:rgba(255,255,255,.08)}.forge-brand .forge-facts dt{color:#fff}.forge-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}.forge-card{background:#fff;border-radius:12px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin:0}.forge-att h3{margin-top:10px}.forge-att p{margin:4px 0}.forge-att .forge-role{color:#55534d}.forge-att .forge-cert{font-weight:700;color:var(--p)}.forge-att .forge-bar,.forge-att .forge-since{font-size:14px;color:#55534d}.forge-steps li{margin-bottom:14px}.forge-when{color:var(--a);margin:0 0 4px}.forge-faq{border-bottom:1px solid #e3e1da;padding:10px 0}.forge-faq summary{cursor:pointer;list-style:none}.forge-faq summary h3{display:inline;font-size:18px}.forge-form{display:grid;gap:6px;max-width:560px;position:relative}.forge-form label{font-weight:600;margin-top:8px}.forge-form input,.forge-form textarea,.forge-form select{width:100%;padding:12px;border:1px solid #c3c0b7;border-radius:8px;font:inherit;background:#fff}.forge-consent{font-weight:400!important;font-size:13px;display:grid;grid-template-columns:auto 1fr;align-items:start;gap:8px;margin-top:12px}.forge-consent input{width:auto}.forge-form button{justify-self:start;border:0;cursor:pointer;margin-top:8px}.forge-table{width:100%;border-collapse:collapse}.forge-table th,.forge-table td{padding:10px;border-bottom:1px solid #e3e1da;text-align:left;vertical-align:top}.forge-court th{width:36%}.forge-tablewrap{overflow-x:auto}.forge-links{columns:2}.forge-lang{margin:0;text-align:right;font-weight:600}.forge-sec-lang_toggle{padding:14px 20px}.forge-disclaimer{font-size:13px;color:#4a4945;border-top:1px solid #e3e1da;padding-top:14px}.forge-sec-disclaimer{padding:32px 20px}.forge-sticky{display:none}@media(max-width:767px){.forge-split{grid-template-columns:1fr}.forge-section{padding:44px 16px}.forge-sticky{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:99;gap:8px;padding:10px 12px;background:#fff;box-shadow:0 -4px 16px rgba(0,0,0,.14)}.forge-sticky a{flex:1;text-align:center;padding:12px;border-radius:8px;font-weight:700;text-decoration:none}.forge-sticky-call{background:var(--a);color:#fff}.forge-sticky-cta{background:var(--p);color:#fff}body{padding-bottom:70px}}.forge-hotline{border:2px solid var(--a);border-radius:10px;padding:18px 22px;background:#fff}.forge-hotline h2{margin-top:0}.forge-sec-hotline{padding-top:28px;padding-bottom:28px}';
  const gap = n => ({ column: String(n), row: String(n), unit: 'px', size: n });
  const box = (n, linked) => ({ unit: 'px', top: String(n), right: String(n), bottom: String(n), left: String(n), isLinked: linked !== false });
  const pad = (v, h) => ({ unit: 'px', top: String(v), right: String(h), bottom: String(v), left: String(h), isLinked: false });

  /* ---------- section registry ---------- */
  const TYPES = new Set(['hero', 'answer', 'key_facts', 'rich_text', 'steps', 'process', 'features', 'media', 'video', 'gallery', 'testimonials', 'stats', 'faq', 'cta_band', 'form', 'map', 'table', 'authors', 'links', 'html', 'attorneys', 'disclaimer', 'court_facts', 'lang_toggle', 'quick_exit', 'hotline']);
  const STYLE = { answer: 'tint', key_facts: 'tint', testimonials: 'tint', form: 'tint', attorneys: 'tint', stats: 'brand', cta_band: 'brand' };
  const NARROW = new Set(['answer', 'steps', 'process', 'video', 'faq', 'form', 'authors', 'links', 'disclaimer', 'hotline']);
  const styleOf = s => s.type === 'cta_band' ? 'brand' : (s.style || STYLE[s.type] || 'light');
  const narrowOf = s => NARROW.has(s.type) || s.width === 'narrow' || (s.type === 'rich_text' && !s.width);

  /* ---------- the firm, from site.firm (FIRM.get() shape) ---------- */
  const DROP_PAREN = s => String(s || '').replace(/\s*\([^)]*[-\u2010-\u2015][^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  function firmModel(f) {
    f = f && typeof f === 'object' ? f : {};
    const raw = Array.isArray(f.attorneys) ? f.attorneys : [];
    const atts = raw.filter(a => a && String(a.name || '').trim()).map(a => Object.assign({}, a, { name: String(a.name).trim() }));
    const ri = +f.responsible || 0;
    const responsible = raw[ri] && String(raw[ri].name || '').trim() ? Object.assign({}, raw[ri], { name: String(raw[ri].name).trim() }) : (atts.length === 1 ? atts[0] : null);
    const offices = (Array.isArray(f.offices) ? f.offices : []).filter(o => o && (String(o.city || '').trim() || String(o.street || '').trim()));
    const primary = offices.find(o => o.primary) || offices[0] || null;
    const ci = typeof CI !== 'undefined' && CI ? CI : null;
    const countyName = v => { if (!v) return ''; const s = String(v).trim(); if (/^\d{5}$/.test(s)) return ci && ci[s] ? ci[s].name : ''; return s.replace(/\s+county$/i, ''); };
    let counties = Array.isArray(f.county_names) ? f.county_names.map(countyName) : arr(f.counties).map(countyName);
    if (!counties.filter(Boolean).length) counties = offices.map(o => countyName(o.county));
    const lm = typeof LINE_META !== 'undefined' && LINE_META ? LINE_META : {};
    const areas = Array.isArray(f.practice_areas) ? f.practice_areas : arr(f.lines).map(k => (f.line_names || {})[k] || (lm[k] ? lm[k].name : ''));
    const fees = {}; for (const [k, v] of Object.entries(f.fees || {})) { const n = numFrom(v); if (n != null && n > 0) fees[k] = n; }
    const lines = arr(f.lines); const par = Array.isArray(f.practice_areas) && f.practice_areas.length === lines.length ? f.practice_areas : null;
    const lineName = k => DROP_PAREN((f.line_names || {})[k] || (par && lines.indexOf(k) >= 0 ? par[lines.indexOf(k)] : '') || (lm[k] ? lm[k].name : '') || '');
    return { present: Object.keys(f).length > 0, name: String(f.name || '').trim(), legal_name: String(f.legal_name || '').trim(), phone: f.phone || (primary && primary.phone) || '', founded: f.founded || '', payment: f.payment || '',
      attorneys: atts, responsible, offices, primary, counties: uniq(counties.filter(Boolean)), cities: uniq((Array.isArray(f.city_names) ? f.city_names : offices.map(o => String(o.city || '').trim()))),
      areas: uniq(areas.map(DROP_PAREN)), languages: arr(f.languages), fees, lineName, social: Object.values(f.social || {}).filter(isHttp) };
  }

  /* ---------- opening hours: "Monday to Friday, 8 am to 6 pm" ---------- */
  const DAYN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayIx = s => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(String(s).toLowerCase().slice(0, 3));
  const to24 = (h, m, ap) => { let n = (+h) % 12; if (/^p/i.test(ap)) n += 12; return String(n).padStart(2, '0') + ':' + String(m || '00').padStart(2, '0'); };
  function parseHours(s) {
    const out = []; const re = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?(?:\s*(?:to|through|thru|until|-|\u2013|\u2014)\s*(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?)?\s*[,:]?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\s*(?:to|until|-|\u2013|\u2014)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/gi;
    let m; while ((m = re.exec(String(s || '')))) { const a = dayIx(m[1]), b = m[2] ? dayIx(m[2]) : a; if (a < 0 || b < 0) continue; const days = []; for (let i = a; days.length < 7; i = (i + 1) % 7) { days.push(DAYN[i]); if (i === b) break; } out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: days, opens: to24(m[3], m[4], m[5]), closes: to24(m[6], m[7], m[8]) }); }
    return out;
  }

  /* ---------- schema.org vocabulary used here (property names checked against schema.org, with inheritance) ---------- */
  const SP = {};
  const def = (t, parents, props) => { const s = new Set(props.split(/\s+/).filter(Boolean)); for (const p of arr(parents)) for (const x of SP[p]) s.add(x); SP[t] = s; };
  def('Thing', [], 'additionalType alternateName description disambiguatingDescription identifier image mainEntityOfPage name potentialAction sameAs subjectOf url');
  def('Organization', 'Thing', 'address aggregateRating alumni areaServed award brand contactPoint department dissolutionDate duns email employee event faxNumber founder foundingDate foundingLocation funder globalLocationNumber hasCredential hasOfferCatalog hasPOS interactionStatistic isicV4 keywords knowsAbout knowsLanguage legalName leiCode location logo makesOffer member memberOf naics numberOfEmployees owns parentOrganization publishingPrinciples review seeks slogan sponsor subOrganization taxID telephone vatID');
  def('Place', 'Thing', 'additionalProperty address aggregateRating amenityFeature branchCode containedInPlace containsPlace event faxNumber geo globalLocationNumber hasMap isAccessibleForFree isicV4 keywords latitude logo longitude maximumAttendeeCapacity openingHoursSpecification photo publicAccess review slogan smokingAllowed specialOpeningHoursSpecification telephone tourBookingPage');
  def('LocalBusiness', ['Organization', 'Place'], 'currenciesAccepted openingHours paymentAccepted priceRange');
  def('LegalService', 'LocalBusiness', ''); def('Attorney', 'LegalService', ''); def('ProfessionalService', 'LocalBusiness', ''); def('GovernmentOrganization', 'Organization', '');
  def('AdministrativeArea', 'Place', ''); def('City', 'AdministrativeArea', ''); def('State', 'AdministrativeArea', ''); def('Country', 'AdministrativeArea', '');
  def('Person', 'Thing', 'additionalName address affiliation alumniOf award birthDate birthPlace brand contactPoint email familyName faxNumber gender givenName hasCredential hasOccupation honorificPrefix honorificSuffix jobTitle knows knowsAbout knowsLanguage memberOf nationality telephone workLocation worksFor');
  def('Intangible', 'Thing', ''); def('StructuredValue', 'Intangible', '');
  def('ContactPoint', 'StructuredValue', 'areaServed availableLanguage contactOption contactType email faxNumber hoursAvailable productSupported serviceArea telephone');
  def('PostalAddress', 'ContactPoint', 'addressCountry addressLocality addressRegion postOfficeBoxNumber postalCode streetAddress');
  def('GeoCoordinates', 'StructuredValue', 'address addressCountry elevation latitude longitude postalCode');
  def('OpeningHoursSpecification', 'StructuredValue', 'closes dayOfWeek opens validFrom validThrough');
  def('PropertyValue', 'StructuredValue', 'maxValue measurementTechnique minValue propertyID unitCode unitText value valueReference');
  def('CreativeWork', 'Thing', 'about abstract accessMode audience author citation comment contentLocation copyrightHolder copyrightYear creator dateCreated dateModified datePublished editor genre hasPart headline inLanguage isAccessibleForFree isPartOf keywords license mainEntity mentions position publisher sourceOrganization text thumbnailUrl video');
  def('WebPage', 'CreativeWork', 'breadcrumb lastReviewed mainContentOfPage primaryImageOfPage relatedLink reviewedBy significantLink speakable specialty');
  def('ProfilePage', 'WebPage', ''); def('FAQPage', 'WebPage', ''); def('AboutPage', 'WebPage', ''); def('ContactPage', 'WebPage', ''); def('CollectionPage', 'WebPage', '');
  def('WebSite', 'CreativeWork', 'issn');
  def('Article', 'CreativeWork', 'articleBody articleSection backstory pageEnd pageStart pagination speakable wordCount');
  def('EducationalOccupationalCredential', 'CreativeWork', 'competencyRequired credentialCategory educationalLevel recognizedBy validFor validIn');
  def('Comment', 'CreativeWork', 'downvoteCount parentItem sharedContent upvoteCount');
  def('Question', 'Comment', 'acceptedAnswer answerCount eduQuestionType suggestedAnswer'); def('Answer', 'Comment', 'answerExplanation');
  def('ItemList', 'Intangible', 'itemListElement itemListOrder numberOfItems'); def('BreadcrumbList', 'ItemList', '');
  def('ListItem', 'Intangible', 'item nextItem position previousItem');
  def('Service', 'Intangible', 'aggregateRating areaServed audience availableChannel award brand broker category hasOfferCatalog hoursAvailable isRelatedTo isSimilarTo logo offers provider providerMobility review serviceOutput serviceType slogan termsOfService');
  def('Offer', 'Intangible', 'acceptedPaymentMethod areaServed availability category eligibleRegion itemOffered price priceCurrency priceSpecification priceValidUntil seller validFrom validThrough');
  def('HowTo', 'CreativeWork', 'estimatedCost performTime prepTime step supply tool totalTime yield');
  def('HowToStep', ['CreativeWork', 'ItemList', 'ListItem'], '');
  def('MediaObject', 'CreativeWork', 'bitrate contentSize contentUrl duration embedUrl encodingFormat endTime height playerType regionsAllowed startTime uploadDate width');
  def('VideoObject', 'MediaObject', 'actor caption director embeddedTextCaption musicBy thumbnail transcript videoFrameSize videoQuality');
  def('ImageObject', 'MediaObject', 'caption embeddedTextCaption exifData representativeOfPage');
  def('SpeakableSpecification', 'Intangible', 'cssSelector xpath');
  const REQUIRED = { LegalService: ['name', 'url', 'telephone', 'address'], Attorney: ['name', 'url', 'telephone', 'address'], Person: ['name'], WebPage: ['url', 'name'], ProfilePage: ['url', 'name', 'mainEntity'], WebSite: ['url', 'name'],
    BreadcrumbList: ['itemListElement'], ListItem: ['position', 'name'], FAQPage: ['mainEntity'], Question: ['name', 'acceptedAnswer'], Answer: ['text'], Article: ['headline', 'author', 'publisher'], Service: ['serviceType', 'provider'],
    PostalAddress: ['addressLocality', 'addressRegion'], EducationalOccupationalCredential: ['name'], VideoObject: ['name', 'uploadDate'], Offer: ['price', 'priceCurrency'] };
  const TRADE_TYPES = /HVAC|Plumb|Electrician|Roofing|HomeAndConstruction|GeneralContractor|Locksmith|HousePainter/i;
  function validateSchema(schema) {
    const out = [];
    const walk = (v, path) => {
      if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
      if (!v || typeof v !== 'object') return;
      const types = arr(v['@type']);
      if (types.length) {
        const allowed = new Set(); let known = true;
        for (const t of types) { if (!SP[t]) { known = false; out.push(`${path}: unknown type ${t}`); } else SP[t].forEach(x => allowed.add(x)); if (TRADE_TYPES.test(t)) out.push(`${path}: ${t} is not a law firm type`); }
        if (known) for (const k of Object.keys(v)) if (k[0] !== '@' && !allowed.has(k)) out.push(`${path}: ${types.join('/')} has no property ${k}`);
        for (const t of types) for (const r of (REQUIRED[t] || [])) { const x = v[r]; if (x == null || x === '' || (Array.isArray(x) && !x.length)) out.push(`${path}: ${t} is missing ${r}`); }
      }
      for (const [k, x] of Object.entries(v)) if (k !== '@context' && x && typeof x === 'object') walk(x, path ? `${path}.${k}` : k);
    };
    walk(schema && schema['@graph'] ? schema['@graph'] : schema, schema && schema['@graph'] ? '@graph' : '');
    return out;
  }
  /* drop empty values so no node carries an empty property */
  function prune(v) {
    if (Array.isArray(v)) { const a = v.map(prune).filter(x => x !== undefined); return a.length ? a : undefined; }
    if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) { const y = prune(x); if (y !== undefined) o[k] = y; } return Object.keys(o).some(k => k !== '@type') ? o : undefined; }
    if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return undefined;
    return v;
  }

  class Forge {
    constructor(bp, media) {
      this.bp = bp || {}; this.media = media || {}; this.page = this.bp.page || {}; this.site = this.bp.site || {}; this.brand = this.site.brand || {};
      const firm = this.site.firm || (typeof FIRM !== 'undefined' && FIRM && typeof FIRM.get === 'function' ? FIRM.get() : null); const fc = (firm && firm.colors) || {};
      this.primary = this.brand.primary || fc.primary || '#1b4332'; this.accent = this.brand.accent || fc.accent || '#307a4f'; this.dark = this.brand.dark || fc.dark || '#0a291a';
      this.tint = hexmix(this.primary, 0.9); this.cta = this.page.cta || {}; this.warnings = []; this.infos = []; this.use_globals = this.brand.globals !== false;
      this.lang = /^es/i.test(this.page.language || '') ? 'es' : 'en'; this.T = STR[this.lang];
      this.base = String(this.site.url || '').replace(/\/+$/, ''); this.url = this.page.canonical || `${this.base}/${String(this.page.slug || '').replace(/^\/+|\/+$/g, '')}/`;
      this.firm = firmModel(firm); this.used = new Set(); this.autoDisclaimer = false;
      const sf = this.page.safety; this.safety = sf && typeof sf === 'object' && sf.on !== false ? Object.assign({ quick_exit: true, safe_contact: true }, sf) : null;
      this.S = this.normSections();
    }
    warn(msg) { if (!this.warnings.includes(msg)) this.warnings.push(msg); }
    eid() { let s; do { s = ''; for (let i = 0; i < 7; i++) s += HEXC[Math.floor(Math.random() * 16)]; } while (this.used.has(s)); this.used.add(s); return s; }
    abs(u) { u = String(u || ''); return u.startsWith('/') && !u.startsWith('//') ? this.base + u : u; }
    normSections() {
      const S = []; const seen = new Set();
      for (const s0 of arr(this.bp.sections)) { if (!s0 || typeof s0 !== 'object') continue; if (!TYPES.has(s0.type)) { this.warn(`unknown section type ${s0.type} skipped`); continue; } S.push(Object.assign({}, s0)); }
      if (!S.some(s => s.type === 'disclaimer' || s.id === 'notice' || s.id === 'disclaimer') && this.page.disclaimer !== false) { S.push({ type: 'disclaimer', id: 'disclaimer' }); this.autoDisclaimer = true; this.infos.push('No disclaimer section in the blueprint: the compiler added one at the end (attorney advertising, responsible attorney, primary practice location, no attorney client relationship).'); }
      if (this.safety) {
        /* no third party frame on a sensitive page: video embeds and maps load another company's script */
        for (let k = S.length - 1; k >= 0; k--) if (S[k].type === 'video' || S[k].type === 'map' || (S[k].type === 'media' && /youtube|youtu\.be|vimeo/i.test(String(((this.bp.media || {})[S[k].media] || {}).source || '')))) { this.infos.push(`Safety mode: the ${S[k].type} section was left off this page (no third party frames or scripts on a sensitive page).`); S.splice(k, 1); }
        if (this.safety.quick_exit !== false && !S.some(s => s.type === 'quick_exit')) { S.unshift({ type: 'quick_exit', id: 'quick-exit' }); this.infos.push('Safety mode: the compiler added the quick exit at the top of the page.'); }
      }
      for (const s of S) { let id = s.id || (s.type === 'form' ? 'contact' : slug(s.heading || s.type)) || s.type; const b = id; let n = 2; while (seen.has(id)) id = `${b}-${n++}`; seen.add(id); s._sid = id; }
      return S;
    }
    m(key) {
      if (!key) return null;
      const specs = this.bp.media || {}; const spec = specs[key] || {};
      let v = this.media[key]; if (v && !(v.url && !isPh(v.url))) v = null;
      if (!v && spec.url && !isPh(spec.url)) v = spec;
      if (!v) { this.warn(`MEDIA: slot "${key}" unresolved (source: ${spec.source || '?'}). Resolved at deploy from your assets or the site library; a page never ships with a placeholder.`);
        return { id: 0, url: phSvg(key), alt: spec.alt || '', kind: spec.kind || 'image', slot: key, ph: true }; }
      v = Object.assign({}, v, { slot: key }); if (v.kind == null) v.kind = spec.kind || 'image'; if (v.alt == null || v.alt === '') v.alt = spec.alt || ''; return v;
    }
    mediaUrl(key) { const md = key ? this.m(key) : null; return md && !md.ph && md.url ? this.abs(md.url) : ''; }
    w(t, s) { return { id: this.eid(), elType: 'widget', widgetType: t, settings: s, elements: [] }; }
    c(els, settings, inner) { const s = { content_width: 'full', flex_direction: 'column', flex_gap: gap(16) }; if (settings) Object.assign(s, settings); return { id: this.eid(), elType: 'container', settings: s, elements: els.filter(Boolean), isInner: inner !== false }; }
    section(els, sec, extra) {
      const style = styleOf(sec); const narrow = narrowOf(sec);
      const s = { content_width: 'boxed', boxed_width: { unit: 'px', size: narrow ? 820 : 1140 }, flex_direction: 'column', flex_gap: gap(20),
        padding: pad(72, 20), padding_mobile: pad(44, 16), _element_id: sec._sid, css_classes: 'forge-section forge-sec-' + sec.type, html_tag: 'section' };
      if (style === 'tint') Object.assign(s, { background_background: 'classic', background_color: this.tint });
      else if (style === 'dark') Object.assign(s, { background_background: 'classic', background_color: this.dark });
      else if (style === 'brand') Object.assign(s, { background_background: 'classic', background_color: this.primary });
      if (extra) Object.assign(s, extra);
      return { id: this.eid(), elType: 'container', settings: s, elements: els.filter(Boolean), isInner: false };
    }
    heading(text, tag, align, color, size) {
      const s = { title: text, header_size: tag || 'h2', align: align || 'left' };
      if (color) s.title_color = color; else if (this.use_globals) s.__globals__ = { title_color: 'globals/colors?id=primary' }; else s.title_color = this.primary;
      if (size) s.size = size; return this.w('heading', s);
    }
    text(html, color) { const s = { editor: html }; if (color) s.text_color = color; return this.w('text-editor', s); }
    button(label, url, kind, align) {
      kind = kind || 'primary';
      const s = { text: label, link: { url, is_external: '', nofollow: '', custom_attributes: '' }, size: 'lg', align: align || 'left', button_type: kind === 'primary' ? 'default' : 'info', border_radius: box(8), css_classes: 'forge-cta forge-cta-' + kind };
      if (this.use_globals) s.__globals__ = { background_color: kind === 'primary' ? 'globals/colors?id=primary' : 'globals/colors?id=accent', typography_typography: 'globals/typography?id=accent' };
      else Object.assign(s, { background_color: kind === 'primary' ? this.primary : this.accent, button_text_color: '#ffffff' });
      if (String(url).startsWith('tel:')) s.selected_icon = { value: 'fas fa-phone', library: 'fa-solid' };
      return this.w('button', s);
    }
    /* an unresolved slot is an empty image (Elementor renders nothing) marked for the bridge, never the placeholder */
    image(md, size) {
      const ph = !!md.ph; const s = { image: { url: ph ? '' : md.url, id: ph ? 0 : (md.id || 0), alt: md.alt || '', source: !ph && md.id ? 'library' : 'url' }, image_size: size || 'large', caption_source: 'none', link_to: 'none', align: 'center' };
      if (md.slot) s._forge_media = { image: md.slot };
      return this.w('image', s);
    }
    video(md, poster) {
      const url = md.ph ? '' : md.url; const s = { lazy_load: 'yes', play_on_mobile: 'yes', controls: 'yes' }; const fm = {};
      if (/youtube\.com|youtu\.be/.test(url)) Object.assign(s, { video_type: 'youtube', youtube_url: url, yt_privacy: 'yes', rel: '' });
      else if (/vimeo\.com/.test(url)) Object.assign(s, { video_type: 'vimeo', vimeo_url: url });
      else { s.video_type = 'hosted'; if (md.id && !md.ph) { s.hosted_url = { url, id: md.id }; if (md.slot) fm.hosted_url = md.slot; } else { Object.assign(s, { insert_url: 'yes', external_url: { url } }); if (md.slot) fm.external_url = md.slot; } }
      if (poster) { Object.assign(s, { show_image_overlay: 'yes', image_overlay: { url: poster.ph ? '' : poster.url, id: poster.ph ? 0 : (poster.id || 0) }, show_play_icon: 'yes' }); if (poster.slot) fm.image_overlay = poster.slot; }
      if (Object.keys(fm).length) s._forge_media = fm;
      return this.w('video', s);
    }
    ctaButtons(keys, align) {
      const els = []; align = align || 'left';
      for (const k of (keys || [])) { const cta = typeof k === 'string' ? this.cta[k] : k; if (!cta) continue;
        if (cta.url) els.push(this.button(cta.label, cta.url, k === 'primary' ? 'primary' : 'secondary', align));
        if (cta.phone) els.push(this.button(cta.phone_label || this.T.call(cta.phone), tel(cta.phone), 'secondary', align)); }
      return els.length ? this.c(els, { flex_direction: 'row', flex_wrap: 'wrap', flex_gap: gap(12), flex_justify_content: align === 'left' ? 'flex-start' : 'center' }) : null;
    }
    iconList(items, icon) { return this.w('icon-list', { icon_list: items.map(t => ({ text: t, selected_icon: { value: icon || 'fas fa-check', library: 'fa-solid' }, _id: this.eid() })), view: 'traditional', space_between: { unit: 'px', size: 8 } }); }

    /* ---------- the firm on the page ---------- */
    safeCred(s, who) { s = String(s || '').trim(); if (!s) return ''; if (SPECIAL.test(s.replace(TBLS_ALL, ''))) { this.warn(`Rule 7.02(b): the credential line for ${who || 'a lawyer'} ("${s}") claims special competence outside the TBLS form and was left off the page; enter the TBLS area instead`); return ''; } return s; }
    attyItems(sec) {
      const src = sec && Array.isArray(sec.items) && sec.items.length ? sec.items : this.firm.attorneys;
      const byName = n => this.firm.attorneys.find(a => a.name.toLowerCase() === String(n || '').trim().toLowerCase()) || {};
      return src.filter(a => a && String(a.name || '').trim()).map(a => { const f = byName(a.name); return Object.assign({}, f, a, { name: String(a.name).trim() }); });
    }
    attyLines(a, sec) {
      const T = this.T, out = []; const role = a.title || T.attorney; if (role) out.push({ cls: 'forge-role', text: role });
      const cert = tblsLine(a.tbls); if (cert) out.push({ cls: 'forge-cert', text: cert });
      if (a.bar_no && (!sec || sec.show_bar !== false)) out.push({ cls: 'forge-bar', text: T.bar(String(a.bar_no).trim()) });
      if (a.since && /^\d{4}$/.test(String(a.since).trim())) out.push({ cls: 'forge-since', text: T.since(String(a.since).trim()) });
      const langs = arr(a.languages).map(l => T.langs[String(l).slice(0, 2).toLowerCase()] || String(l)).filter(Boolean); if (langs.length) out.push({ cls: 'forge-langs', text: T.speaks(listAnd(langs, T.and)) });
      const cred = this.safeCred(a.credentials, a.name); if (cred) out.push({ cls: 'forge-cred', text: cred });
      return out;
    }
    authorInfo() {
      const a0 = this.page.author || {}; const f = this.firm.attorneys.find(x => x.name.toLowerCase() === String(a0.name || '').trim().toLowerCase()) || {};
      const a = Object.assign({}, f, a0); return { name: a.name || '', cred: this.safeCred(a.credentials, a.name), cert: tblsLine(a.tbls), bio: a.bio || '', url: a.url || '', media: a0.media };
    }
    disclaimerParts(sec) {
      const F = this.firm, p = F.primary || {}; sec = sec || {};
      const atty = sec.attorney || (F.responsible && F.responsible.name) || '[Responsible attorney]';
      const firm = sec.firm || F.name || this.brand.name || this.site.name || '[Firm name]';
      const city = sec.city || String(p.city || '').trim() || '[Office city]';
      const loc = sec.location || (String(p.street || '').trim() && String(p.city || '').trim() ? `${String(p.street).trim()}, ${city}, Texas` : `${city}, Texas`);
      return this.T.disclaimer(atty, firm, loc).concat(arr(sec.extra).map(String));
    }
    disclaimerHTML(sec) { return `<div class="forge-disclaimer" role="note">${this.disclaimerParts(sec).map(p => `<p><small>${esc(p)}</small></p>`).join('')}</div>`; }
    formSpec() {
      if (this._form) return this._form;
      const f = (this.page.conversion || {}).form || {}; const T = this.T; const F = this.firm;
      const counties = Array.isArray(f.counties) ? f.counties : F.counties.map(c => T.countyName(c));
      const matters = Array.isArray(f.matters) ? f.matters : F.areas;
      const safe = !!(this.safety && this.safety.safe_contact !== false);
      const fields = (Array.isArray(f.fields) && f.fields.length ? f.fields : defaultFields(this.lang, counties, matters, safe)).map(x => Object.assign({}, x));
      if (safe && !fields.some(x => x.id === 'safe_contact')) { const at = fields.findIndex(x => x.id === 'email'); fields.splice(at >= 0 ? at + 1 : Math.min(2, fields.length), 0, safeField(this.lang)); }
      if (safe && f.shortcode) this.warn('Safety mode: the plugin form (shortcode) needs its own required question "' + T.fields.safe + '"; the compiler cannot add it to a plugin form');
      for (const x of fields) if (x.type === 'select' && !optList(x.options).length) { x.options = x.id === 'county' ? counties : x.id === 'matter' ? matters : []; if (!optList(x.options).length) x.type = 'text'; }
      const consent = (f.consent || T.consent(F.name || this.brand.name || '')) + (safe && !String(f.consent || '').includes(T.consentSafe) ? ' ' + T.consentSafe : '');
      return (this._form = Object.assign({}, f, { provider: f.provider || 'html', fields, consent, button: f.button || T.send }));
    }

    /* ---------- Elementor sections ---------- */
    s_hero(sec) {
      const pg = this.page, left = [];
      if (sec.eyebrow) left.push(this.heading(sec.eyebrow, 'h6', 'left', this.accent));
      left.push(this.heading(sec.h1 || pg.h1, 'h1'));
      if (sec.lede) left.push(this.text('<p class="forge-lede">' + esc(sec.lede) + '</p>'));
      const b = this.ctaButtons(sec.cta || ['primary']); if (b) left.push(b);
      if (sec.trust !== false && pg.conversion && pg.conversion.trust && pg.conversion.trust.length) left.push(this.iconList(pg.conversion.trust));
      const media = sec.media ? this.m(sec.media) : null; const layout = sec.layout || (media ? 'split' : 'center');
      if (layout === 'split' && media) {
        const right = [media.kind === 'video' ? this.video(media, sec.poster ? this.m(sec.poster) : null) : this.image(media, 'full')];
        const row = this.c([this.c(left, { width: { unit: '%', size: 55 }, width_mobile: { unit: '%', size: 100 }, flex_justify_content: 'center' }), this.c(right, { width: { unit: '%', size: 45 }, width_mobile: { unit: '%', size: 100 } })], { flex_direction: 'row', flex_direction_mobile: 'column', flex_align_items: 'center', flex_gap: { column: '40', row: '24', unit: 'px', size: 40 } });
        return this.section([row], sec, { min_height: { unit: 'vh', size: 60 }, flex_justify_content: 'center' });
      }
      if (layout === 'cover' && media && media.kind !== 'video') {
        for (const el of left) if (el.elType === 'widget' && (el.widgetType === 'heading' || el.widgetType === 'text-editor')) { delete el.settings.__globals__; el.settings[el.widgetType === 'heading' ? 'title_color' : 'text_color'] = '#ffffff'; }
        const extra = { background_background: 'classic', background_image: { url: media.ph ? '' : media.url, id: media.ph ? 0 : (media.id || 0) }, background_size: 'cover', background_position: 'center center', background_overlay_background: 'classic', background_overlay_color: this.dark, background_overlay_opacity: { unit: 'px', size: 0.62 }, min_height: { unit: 'vh', size: 70 }, flex_justify_content: 'center' };
        if (media.slot) extra._forge_media = { background_image: media.slot };
        return this.section([this.c(left, { width: { unit: '%', size: 66 }, width_mobile: { unit: '%', size: 100 } })], sec, extra);
      }
      for (const el of left) if (el.elType === 'widget' && 'align' in el.settings) el.settings.align = 'center';
      return this.section([this.c(left, { width: { unit: '%', size: 80 }, width_mobile: { unit: '%', size: 100 }, flex_align_items: 'center' })], sec, { flex_align_items: 'center' });
    }
    s_answer(sec) { return this.section([this.heading(sec.heading || this.T.answer, 'h2'), this.text('<p class="forge-answer"><strong>' + esc(sec.body) + '</strong></p>')], sec); }
    s_key_facts(sec) {
      const items = arr(sec.items); const n = Math.max(1, Math.min(4, items.length));
      const cards = items.map(it => this.c([this.heading(it.value, 'h3', 'left', this.primary, 'xl'), this.text('<p>' + esc(it.label) + (it.source ? '<br><small>' + esc(it.source) + '</small>' : '') + '</p>')], { width: { unit: '%', size: Math.max(22, Math.floor(100 / n)) - 2 }, width_mobile: { unit: '%', size: 100 }, background_background: 'classic', background_color: '#ffffff', border_radius: box(12), padding: box(22) }));
      return this.section((sec.heading ? [this.heading(sec.heading, 'h2')] : []).concat([this.c(cards, { flex_direction: 'row', flex_wrap: 'wrap', flex_gap: gap(16) })]), sec);
    }
    s_rich_text(sec) { return this.section((sec.heading ? [this.heading(sec.heading, sec.tag || 'h2')] : []).concat([this.text(sec.html || '')]), sec); }
    s_steps(sec) {
      const items = arr(sec.steps).map((st, i) => this.c([this.heading(`${i + 1}. ${st.title}`, 'h3')].concat(st.when ? [this.text(`<p class="forge-when"><strong>${esc(st.when)}</strong></p>`)] : []).concat([this.text('<p>' + esc(st.text) + '</p>')]), { width: { unit: '%', size: 100 } }));
      return this.section([this.heading(sec.heading || (sec.type === 'process' ? this.T.process : this.T.how), 'h2')].concat(items), sec);
    }
    s_process(sec) { return this.s_steps(sec); }
    s_features(sec) {
      const items = arr(sec.items); const cols = Math.min(3, Math.max(1, items.length)); const cards = [];
      for (const it of items) { const els = [this.heading(it.title, 'h3', 'left', null, 'medium'), this.text('<p>' + esc(it.text) + (it.url ? ' <a href="' + esc(it.url) + '">' + esc(it.link || this.T.more) + '</a>' : '') + '</p>')];
        if (it.icon) els.unshift(this.w('icon', { selected_icon: { value: it.icon, library: 'fa-solid' }, view: 'default', align: 'left', size: { unit: 'px', size: 34 }, primary_color: this.primary }));
        cards.push(this.c(els, { width: { unit: '%', size: Math.floor(100 / cols) - 2 }, width_mobile: { unit: '%', size: 100 } })); }
      return this.section([this.heading(sec.heading, 'h2')].concat(sec.text ? [this.text('<p>' + esc(sec.text) + '</p>')] : []).concat([this.c(cards, { flex_direction: 'row', flex_wrap: 'wrap', flex_gap: gap(28) })]), sec);
    }
    s_media(sec) { const md = this.m(sec.media); if (!md) return null; const w = md.kind === 'video' ? this.video(md, sec.poster ? this.m(sec.poster) : null) : this.image(md, 'full'); return this.section((sec.heading ? [this.heading(sec.heading, 'h2')] : []).concat([w]).concat(sec.caption ? [this.text('<p><small>' + esc(sec.caption) + '</small></p>')] : []), sec); }
    s_video(sec) { const md = this.m(sec.media); if (!md) return null; const els = (sec.heading ? [this.heading(sec.heading, 'h2')] : []).concat([this.video(md, sec.poster ? this.m(sec.poster) : null)]); if (sec.transcript) els.push(this.w('accordion', { tabs: [{ tab_title: this.T.transcript, tab_content: '<p>' + esc(sec.transcript) + '</p>', _id: this.eid() }], faq_schema: '' })); return this.section(els, sec); }
    s_gallery(sec) { const cols = sec.columns || 3; const imgs = arr(sec.media).filter(Boolean).map(k => this.c([this.image(this.m(k), 'medium_large')], { width: { unit: '%', size: Math.floor(100 / cols) - 2 }, width_mobile: { unit: '%', size: 50 } })); return this.section((sec.heading ? [this.heading(sec.heading, 'h2')] : []).concat([this.c(imgs, { flex_direction: 'row', flex_wrap: 'wrap', flex_gap: gap(12) })]), sec); }
    s_testimonials(sec) {
      const cards = []; const items = arr(sec.items); const n = Math.max(1, Math.min(3, items.length));
      for (const it of items) { const els = []; if (it.rating) els.push(this.w('star-rating', { rating: it.rating, star_style: 'star_fontawesome', align: 'left', stars_color: this.accent }));
        const ts = { testimonial_content: it.quote, testimonial_name: it.name || '', testimonial_job: it.role || '', testimonial_alignment: 'left', testimonial_image_position: 'aside' };
        if (it.media) { const md = this.m(it.media); ts.testimonial_image = { url: md.ph ? '' : md.url, id: md.ph ? 0 : (md.id || 0) }; ts._forge_media = { testimonial_image: md.slot }; } els.push(this.w('testimonial', ts));
        cards.push(this.c(els, { width: { unit: '%', size: Math.floor(100 / n) - 2 }, width_mobile: { unit: '%', size: 100 }, background_background: 'classic', background_color: '#ffffff', padding: box(22), border_radius: box(12) })); }
      return this.section([this.heading(sec.heading || this.T.clients, 'h2'), this.c(cards, { flex_direction: 'row', flex_wrap: 'wrap', flex_gap: gap(20) })], sec);
    }
    s_stats(sec) {
      const cards = []; const items = arr(sec.items); const n = Math.max(1, Math.min(4, items.length));
      for (const it of items) { const num = numFrom(it.value); const wd = { width: { unit: '%', size: Math.floor(100 / n) - 2 }, width_mobile: { unit: '%', size: 50 } };
        if (num != null) { const m = String(it.value).trim().match(/^([^\d]*)([\d,.]+)(.*)$/); cards.push(this.c([this.w('counter', { starting_number: 0, ending_number: num, prefix: m ? m[1] : '', suffix: m ? m[3] : '', title: it.label, thousand_separator: 'yes', title_tag: 'div' })], wd)); }
        else cards.push(this.c([this.heading(it.value, 'h3', 'center'), this.text('<p style="text-align:center">' + esc(it.label) + '</p>')], wd)); }
      return this.section((sec.heading ? [this.heading(sec.heading, 'h2', 'center')] : []).concat([this.c(cards, { flex_direction: 'row', flex_wrap: 'wrap', flex_gap: gap(16) })]), sec);
    }
    s_faq(sec) { const acc = this.w('accordion', { tabs: arr(sec.items).map(it => ({ tab_title: it.q, tab_content: '<p>' + esc(it.a) + '</p>', _id: this.eid() })), faq_schema: '', title_html_tag: 'h3', selected_icon: { value: 'fas fa-plus', library: 'fa-solid' }, selected_active_icon: { value: 'fas fa-minus', library: 'fa-solid' } }); return this.section([this.heading(sec.heading || this.T.faq, 'h2'), acc], sec); }
    s_cta_band(sec) {
      const els = [this.heading(sec.heading, 'h2', 'center', '#ffffff')]; if (sec.text) els.push(this.text('<p style="text-align:center">' + esc(sec.text) + '</p>', '#ffffff'));
      const b = this.ctaButtons(sec.cta || ['primary'], 'center'); if (b) { els.push(b); for (const el of b.elements) { if (this.use_globals) el.settings.__globals__ = { background_color: 'globals/colors?id=accent', typography_typography: 'globals/typography?id=accent' }; else Object.assign(el.settings, { background_color: this.accent, button_text_color: '#ffffff' }); } }
      return this.section(els, sec, { flex_align_items: 'center' });
    }
    s_form(sec) {
      const f = this.formSpec(); const T = this.T; const els = [];
      if (sec.heading) els.push(this.heading(sec.heading, 'h2')); if (sec.text) els.push(this.text('<p>' + esc(sec.text) + '</p>'));
      if (f.provider === 'elementor_pro') {
        const ff = f.fields.map(x => { const o = { custom_id: x.id, field_label: x.label, field_type: x.type || 'text', required: x.required ? 'true' : '', placeholder: x.placeholder || x.hint || '', width: '100', _id: this.eid() }; if (x.type === 'select') { o.field_options = optList(x.options).map(v => v.label === v.value ? v.label : `${v.label}|${v.value}`).join('\n'); o.placeholder = ''; } if (x.type === 'textarea') o.rows = 4; return o; });
        ff.push({ custom_id: 'consent', field_label: T.consentLbl, field_type: 'acceptance', acceptance_text: f.consent, required: 'true', width: '100', _id: this.eid() });
        els.push(this.w('form', { form_name: f.name || T.formName, form_fields: ff, button_text: f.button, button_size: 'md', submit_actions: ['email'], email_to: f.email_to || '', email_subject: T.newInquiry + (this.page.h1 || ''), success_message: f.success || T.ok, form_id: (slug(this.page.slug) || 'page') + '-form' }));
      } else if (['wpforms', 'gravity', 'cf7', 'fluent', 'shortcode'].includes(f.provider) && f.shortcode) els.push(this.w('shortcode', { shortcode: f.shortcode }));
      else els.push(this.w('html', { html: this.htmlForm() }));
      return this.section(els, sec);
    }
    s_map(sec) { const els = (sec.heading ? [this.heading(sec.heading, 'h2')] : []).concat([this.w('google_maps', { address: sec.address, zoom: { unit: 'px', size: 14 }, height: { unit: 'px', size: 360 } })]); if (sec.text) els.push(this.text('<p>' + esc(sec.text) + '</p>')); return this.section(els, sec); }
    s_table(sec) { return this.section((sec.heading ? [this.heading(sec.heading, 'h2')] : []).concat([this.w('html', { html: this.tableHTML(sec) })]), sec); }
    s_authors(sec) {
      const a = this.authorInfo(); const T = this.T; const els = [this.heading(sec.heading || T.reviewed, 'h2')]; const row = [];
      if (a.media) row.push(this.c([this.image(this.m(a.media), 'thumbnail')], { width: { unit: '%', size: 18 }, width_mobile: { unit: '%', size: 40 } }));
      row.push(this.c([this.text(`<p><strong>${esc(a.name)}</strong>${a.cred ? ', ' + esc(a.cred) : ''}${a.cert ? '<br>' + esc(a.cert) : ''}<br>${esc(a.bio || sec.text || '')}` + (a.url ? `<br><a href="${esc(a.url)}">${esc(T.profile)}</a>` : '') + '</p>')], { width: { unit: '%', size: 80 }, width_mobile: { unit: '%', size: 100 } }));
      els.push(this.c(row, { flex_direction: 'row', flex_align_items: 'center', flex_gap: { column: '20', row: '12', unit: 'px', size: 20 } }));
      return this.section(els, sec);
    }
    s_links(sec) { const items = arr(sec.items || this.page.internal_links); const lst = this.w('icon-list', { icon_list: items.map(it => ({ text: it.anchor, link: { url: it.url, is_external: '' }, selected_icon: { value: 'fas fa-arrow-right', library: 'fa-solid' }, _id: this.eid() })), view: 'traditional' }); return this.section([this.heading(sec.heading || this.T.related, 'h2'), lst], sec); }
    s_html(sec) { return this.section([this.w('html', { html: sec.html || '' })], sec); }
    s_attorneys(sec) {
      const T = this.T; const items = this.attyItems(sec); if (!items.length) { this.warn('attorneys section has no attorney with a name (fill the lawyers in the firm profile); skipped'); return null; }
      const n = Math.min(3, items.length); const cards = [];
      for (const a of items) {
        const els = [];
        if (a.media) { const md = this.m(a.media); const im = this.image(Object.assign({}, md, { alt: md.alt || T.photoAlt(a.name) }), 'medium_large'); Object.assign(im.settings, { align: 'left', width: { unit: 'px', size: 240 } }); els.push(im); }
        const hd = this.heading(a.name, 'h3', 'left', null, 'medium'); if (a.url) hd.settings.link = { url: a.url, is_external: '', nofollow: '' }; els.push(hd);
        els.push(this.text(this.attyLines(a, sec).map(l => `<p class="${l.cls}">${esc(l.text)}</p>`).join('') + (a.bio ? `<p>${esc(a.bio)}</p>` : '') + (a.url ? `<p><a href="${esc(a.url)}">${esc(T.fullProfile)}</a></p>` : '')));
        cards.push(this.c(els, { width: { unit: '%', size: Math.floor(100 / n) - 2 }, width_mobile: { unit: '%', size: 100 }, background_background: 'classic', background_color: '#ffffff', padding: box(22), border_radius: box(12), css_classes: 'forge-card forge-att' }));
      }
      const head = [this.heading(sec.heading || T.attorneys, 'h2')].concat(sec.text ? [this.text('<p>' + esc(sec.text) + '</p>')] : []);
      return this.section(head.concat([this.c(cards, { flex_direction: 'row', flex_wrap: 'wrap', flex_gap: gap(20) })]), sec);
    }
    s_disclaimer(sec) { const els = (sec.heading ? [this.heading(sec.heading, 'h2', 'left', null, 'small')] : []).concat([this.text(this.disclaimerHTML(sec))]); return this.section(els, sec, { padding: pad(32, 20), padding_mobile: pad(28, 16) }); }
    s_court_facts(sec) { const els = [this.heading(sec.heading || this.T.court(sec.county), 'h2')]; if (sec.text) els.push(this.text('<p>' + esc(sec.text) + '</p>')); els.push(this.w('html', { html: this.courtTable(sec) })); const foot = this.courtFoot(sec); if (foot) els.push(this.text(foot)); return this.section(els, sec); }
    s_lang_toggle(sec) { const h = this.langHTML(sec); return h ? this.section([this.text(h)], sec, { padding: pad(14, 20), padding_mobile: pad(12, 16) }) : null; }
    s_quick_exit(sec) { return { id: this.eid(), elType: 'container', settings: { content_width: 'full', padding: box(0), css_classes: 'forge-exit-wrap', _element_id: sec._sid }, elements: [this.w('html', { html: this.exitHTML(sec) })], isInner: false }; }
    s_hotline(sec) { const b = this.hotlineBody(sec); return this.section([this.heading(b.heading, 'h2'), this.text(b.html)], sec, { border_border: 'solid', border_width: box(2), border_color: this.accent }); }
    exitHTML(sec) {
      const T = this.T; const url = safeUrl(sec.url || (this.safety && this.safety.exit_url) || EXIT_URL); const hint = sec.hint != null ? sec.hint : T.exitHint;
      return EXIT_CSS + `<div class="forge-exit" role="region" aria-label="${esc(T.exitRegion)}"><a class="forge-exit-btn" href="${esc(url)}" rel="noreferrer noopener" data-forge-exit data-exit-url="${esc(url)}">${esc(sec.label || T.exit)}</a>${hint ? `<span class="forge-exit-hint">${esc(hint)}</span>` : ''}</div>` + EXIT_JS;
    }
    hotlineBody(sec) {
      const T = this.T; const tx = String(sec.text || T.hotline.text); const lab = sec.phone_label || '1 800 799 7233'; const tl = 'tel:+1' + String(sec.phone || '18007997233').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
      const para = p => esc(p).replace(esc(lab), `<a href="${esc(tl)}">${esc(lab)}</a>`).replace(/\b911\b/, '<a href="tel:911">911</a>');
      let host = ''; try { host = sec.url ? new URL(sec.url).hostname.replace(/^www\./, '') : ''; } catch (e) { host = ''; }
      return { heading: sec.heading || T.hotline.heading, html: tx.split(/\n+/).filter(x => x.trim()).map(p => `<p>${para(p)}</p>`).join('') + (host ? `<p><a href="${esc(sec.url)}" rel="noreferrer noopener">${esc(host)}</a></p>` : '') };
    }
    hotlineHTML(sec) { const b = this.hotlineBody(sec); return `<div class="forge-hotline" role="note"><h2>${esc(b.heading)}</h2>${b.html}</div>`; }
    stickyBar() {
      const p = this.cta.primary || {}; const tl = p.phone ? tel(p.phone) : null; const T = this.T;
      const a = (tl ? `<a class="forge-sticky-call" href="${esc(tl)}">${esc(T.callNow)}</a>` : '') + `<a class="forge-sticky-cta" href="${esc(p.url || '#contact')}">${esc(p.label || T.start)}</a>`;
      const css = `<style>.forge-sticky{display:none}@media(max-width:767px){.forge-sticky{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:9999;gap:8px;padding:10px 12px;background:#fff;box-shadow:0 -4px 16px rgba(0,0,0,.14)}.forge-sticky a{flex:1;text-align:center;padding:12px;border-radius:8px;font-weight:700;text-decoration:none}.forge-sticky-call{background:${this.accent};color:#fff}.forge-sticky-cta{background:${this.primary};color:#fff}body{padding-bottom:70px}}</style>`;
      return { id: this.eid(), elType: 'container', settings: { content_width: 'full', padding: box(0), css_classes: 'forge-sticky-wrap' }, elements: [this.w('html', { html: css + '<div class="forge-sticky">' + a + '</div>' })], isInner: false };
    }

    /* ---------- drivers ---------- */
    elementor() {
      const out = [];
      for (const sec of this.S) { const el = this['s_' + sec.type].call(this, sec); if (el) out.push(el); }
      if ((this.page.conversion || {}).sticky_mobile_bar !== false && this.cta.primary) out.push(this.stickyBar());
      return out;
    }
    pageSettings() { const ps = { hide_title: 'yes', template: this.page.template || 'default' }; if (this.page.custom_css) ps.custom_css = this.page.custom_css; return ps; }
    templateFile(content) { return { content, page_settings: this.pageSettings(), version: '0.4', title: this.page.title || this.page.h1, type: 'page' }; }

    /* ---------- semantic html ---------- */
    html() {
      const out = [];
      for (const sec of this.S) { if (sec.type === 'quick_exit') { out.push(this.exitHTML(sec)); continue; } const body = this.secBody(sec); if (body == null) continue;
        out.push(`<section id="${esc(sec._sid)}" class="forge-section forge-sec-${sec.type} forge-${styleOf(sec)}"><div class="forge-inner${narrowOf(sec) ? ' forge-narrow' : ''}">${body}</div></section>`); }
      return out.join('\n');
    }
    secBody(sec) {
      const pg = this.page, T = this.T; const h = (tag, s, cls) => `<${tag}${cls ? ' class="' + cls + '"' : ''}>${esc(s)}</${tag}>`;
      switch (sec.type) {
        case 'hero': { const md = sec.media ? this.m(sec.media) : null;
          let body = (sec.eyebrow ? h('p', sec.eyebrow, 'forge-eyebrow') : '') + h('h1', sec.h1 || pg.h1) + (sec.lede ? h('p', sec.lede, 'forge-lede') : '') + this.htmlCtas(sec.cta || ['primary']);
          if (sec.trust !== false && pg.conversion && pg.conversion.trust && pg.conversion.trust.length) body += '<ul class="forge-trust">' + pg.conversion.trust.map(x => h('li', x)).join('') + '</ul>';
          return md ? `<div class="forge-split"><div>${body}</div><div>${this.htmlMedia(md, true)}</div></div>` : body; }
        case 'answer': return h('h2', sec.heading || T.answer) + `<p class="forge-answer"><strong>${esc(sec.body)}</strong></p>`;
        case 'key_facts': return (sec.heading ? h('h2', sec.heading) : '') + '<dl class="forge-facts">' + arr(sec.items).map(i => `<div><dt>${esc(i.value)}</dt><dd>${esc(i.label)}` + (i.source ? ` <small>(${esc(i.source)})</small>` : '') + '</dd></div>').join('') + '</dl>';
        case 'rich_text': return (sec.heading ? h(sec.tag || 'h2', sec.heading) : '') + (sec.html || '');
        case 'steps': case 'process': return h('h2', sec.heading || (sec.type === 'process' ? T.process : T.how)) + '<ol class="forge-steps">' + arr(sec.steps).map(s => `<li><h3>${esc(s.title)}</h3>${s.when ? `<p class="forge-when"><strong>${esc(s.when)}</strong></p>` : ''}<p>${esc(s.text)}</p></li>`).join('') + '</ol>';
        case 'features': return h('h2', sec.heading) + (sec.text ? h('p', sec.text) : '') + '<div class="forge-grid">' + arr(sec.items).map(i => `<div class="forge-card"><h3>${i.url ? `<a href="${esc(i.url)}">${esc(i.title)}</a>` : esc(i.title)}</h3><p>${esc(i.text)}</p></div>`).join('') + '</div>';
        case 'media': { const md = this.m(sec.media); return md ? (sec.heading ? h('h2', sec.heading) : '') + this.htmlMedia(md) + (sec.caption ? `<p><small>${esc(sec.caption)}</small></p>` : '') : null; }
        case 'video': { const md = this.m(sec.media); return md ? (sec.heading ? h('h2', sec.heading) : '') + this.htmlMedia(md) + (sec.transcript ? `<details><summary>${esc(T.transcript)}</summary><p>${esc(sec.transcript)}</p></details>` : '') : null; }
        case 'gallery': return (sec.heading ? h('h2', sec.heading) : '') + '<div class="forge-grid">' + arr(sec.media).filter(Boolean).map(k => this.htmlMedia(this.m(k))).join('') + '</div>';
        case 'testimonials': return h('h2', sec.heading || T.clients) + '<div class="forge-grid">' + arr(sec.items).map(i => `<blockquote class="forge-card"><p>${esc(i.quote)}</p><footer>${esc(i.name || '')}${i.role ? ', ' + esc(i.role) : ''}${i.rating ? ' · ' + esc(i.rating) + '/5' : ''}</footer></blockquote>`).join('') + '</div>';
        case 'stats': return (sec.heading ? h('h2', sec.heading) : '') + '<dl class="forge-facts forge-stats">' + arr(sec.items).map(i => `<div><dt>${esc(i.value)}</dt><dd>${esc(i.label)}</dd></div>`).join('') + '</dl>';
        case 'faq': return h('h2', sec.heading || T.faq) + arr(sec.items).map(i => `<details class="forge-faq"><summary><h3>${esc(i.q)}</h3></summary><p>${esc(i.a)}</p></details>`).join('');
        case 'cta_band': return h('h2', sec.heading) + (sec.text ? h('p', sec.text) : '') + this.htmlCtas(sec.cta || ['primary']);
        case 'form': return (sec.heading ? h('h2', sec.heading) : '') + (sec.text ? h('p', sec.text) : '') + this.htmlForm();
        case 'map': return (sec.heading ? h('h2', sec.heading) : '') + `<p class="forge-address">${esc(sec.address)}</p>` + (sec.text ? h('p', sec.text) : '');
        case 'table': return (sec.heading ? h('h2', sec.heading) : '') + this.tableHTML(sec);
        case 'authors': { const a = this.authorInfo(); return h('h2', sec.heading || T.reviewed) + `<p class="forge-author"><strong>${esc(a.name)}</strong>${a.cred ? ', ' + esc(a.cred) : ''}${a.cert ? '<br>' + esc(a.cert) : ''}<br>${esc(a.bio || sec.text || '')}` + (a.url ? ` <a href="${esc(a.url)}">${esc(T.profile)}</a>` : '') + '</p>'; }
        case 'links': { const items = arr(sec.items || pg.internal_links); return h('h2', sec.heading || T.related) + '<ul class="forge-links">' + items.map(i => `<li><a href="${esc(i.url)}">${esc(i.anchor)}</a></li>`).join('') + '</ul>'; }
        case 'html': return sec.html || '';
        case 'attorneys': return this.attyHTML(sec);
        case 'disclaimer': return (sec.heading ? h('h2', sec.heading) : '') + this.disclaimerHTML(sec);
        case 'court_facts': return h('h2', sec.heading || T.court(sec.county)) + (sec.text ? h('p', sec.text) : '') + this.courtTable(sec) + this.courtFoot(sec);
        case 'lang_toggle': return this.langHTML(sec) || null;
        case 'quick_exit': return this.exitHTML(sec);
        case 'hotline': return this.hotlineHTML(sec);
      }
      return null;
    }
    tableHTML(sec) { return '<div class="forge-tablewrap"><table class="forge-table"><thead><tr>' + arr(sec.columns).map(c => `<th scope="col">${esc(c)}</th>`).join('') + '</tr></thead><tbody>' + arr(sec.rows).map(r => '<tr>' + arr(r).map(v => `<td>${esc(v)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>'; }
    attyHTML(sec) {
      const T = this.T; const items = this.attyItems(sec); if (!items.length) return null;
      const cards = items.map(a => {
        let img = ''; if (a.media) { const md = this.m(a.media); img = `<img src="${esc(md.url)}" alt="${esc(md.alt || T.photoAlt(a.name))}"${md.width && md.height ? ` width="${+md.width}" height="${+md.height}"` : ''} loading="lazy" decoding="async" style="display:block;width:100%;max-width:240px;height:auto;aspect-ratio:4/5;object-fit:cover;border-radius:12px">`; }
        return `<article class="forge-card forge-att">${img}<h3>${a.url ? `<a href="${esc(a.url)}">${esc(a.name)}</a>` : esc(a.name)}</h3>` + this.attyLines(a, sec).map(l => `<p class="${l.cls}">${esc(l.text)}</p>`).join('') + (a.bio ? `<p>${esc(a.bio)}</p>` : '') + (a.url ? `<p><a href="${esc(a.url)}">${esc(T.fullProfile)}</a></p>` : '') + '</article>';
      }).join('');
      return `<h2>${esc(sec.heading || T.attorneys)}</h2>` + (sec.text ? `<p>${esc(sec.text)}</p>` : '') + `<div class="forge-grid forge-attorneys">${cards}</div>`;
    }
    courtTable(sec) {
      const T = this.T; const rows = arr(sec.items).map(i => `<tr><th scope="row">${esc(i.label)}</th><td>${esc(i.value)}${i.source ? ` <small>(${esc(i.source)})</small>` : ''}</td></tr>`)
        .concat(arr(sec.courts).map(c => `<tr><th scope="row">${esc(c.label || T.courtLbl)}</th><td>${c.url ? `<a href="${esc(c.url)}">${esc(c.name)}</a>` : esc(c.name)}${c.address ? `<br>${esc(c.address)}` : ''}${c.phone ? `<br>${esc(c.phone)}` : ''}</td></tr>`));
      return `<div class="forge-tablewrap"><table class="forge-table forge-court"><tbody>${rows.join('')}</tbody></table></div>`;
    }
    courtFoot(sec) { return (sec.note ? `<p><small>${esc(sec.note)}</small></p>` : '') + (sec.source ? `<p><small>${esc(this.T.source)}: ${esc(sec.source)}</small></p>` : ''); }
    langTarget(sec) { const lang = String(sec.lang || (this.lang === 'es' ? 'en' : 'es')).slice(0, 2).toLowerCase(); return { lang, url: sec.url || '', label: sec.label || TOGGLE[lang] || TOGGLE.es }; }
    langHTML(sec) { const t = this.langTarget(sec); if (!t.url) { this.warn('lang_toggle section has no url; skipped'); return ''; } return `<p class="forge-lang"><a href="${esc(t.url)}" hreflang="${esc(t.lang)}" lang="${esc(t.lang)}">${esc(t.label)}</a></p>`; }
    htmlCtas(keys) { let a = ''; for (const k of (keys || [])) { const cta = typeof k === 'string' ? this.cta[k] : k; if (!cta) continue; if (cta.url) a += `<a class="forge-btn forge-btn-${typeof k === 'string' ? k : 'primary'}" href="${esc(cta.url)}">${esc(cta.label)}</a> `; if (cta.phone) a += `<a class="forge-btn forge-btn-secondary" href="${esc(tel(cta.phone))}">${esc(cta.phone_label || this.T.call(cta.phone))}</a> `; } return a ? `<p class="forge-ctas">${a}</p>` : ''; }
    htmlMedia(md, priority) {
      if (md.kind === 'video' && !md.ph) { const u = md.url; if (/youtube\.com|youtu\.be/.test(u)) { const m = u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/); return `<div class="forge-video"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${m ? m[1] : ''}" title="${esc(md.alt || this.T.video)}" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`; }
        return `<video controls preload="metadata" playsinline${md.poster ? ' poster="' + esc(md.poster) + '"' : ''}><source src="${esc(u)}" type="${esc(md.mime || 'video/mp4')}">${esc(md.alt || '')}</video>`; }
      const wh = md.width && md.height ? ` width="${+md.width}" height="${+md.height}"` : '';
      return `<img src="${esc(md.url)}" alt="${esc(md.alt || '')}"${wh}${priority ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
    }
    htmlForm() {
      const f = this.formSpec(); if (f.shortcode) return f.shortcode;
      const T = this.T; const pid = 'forge-' + (slug(this.page.slug) || 'page');
      const rows = f.fields.map(x => {
        const id = `${pid}-${slug(x.id) || 'field'}`; const req = x.required ? ' required' : ''; const hid = x.hint ? `${id}-hint` : '';
        const attrs = req + (hid ? ` aria-describedby="${hid}"` : '') + (x.autocomplete ? ` autocomplete="${esc(x.autocomplete)}"` : '') + (x.maxlength ? ` maxlength="${+x.maxlength}"` : '') + (x.placeholder ? ` placeholder="${esc(x.placeholder)}"` : '');
        const ctl = x.type === 'textarea' ? `<textarea id="${id}" name="${esc(x.id)}" rows="4"${attrs}></textarea>`
          : x.type === 'select' ? `<select id="${id}" name="${esc(x.id)}"${req}${hid ? ` aria-describedby="${hid}"` : ''}><option value="">${esc(T.choose)}</option>${optList(x.options).map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>`
          : `<input type="${esc(x.type || 'text')}" id="${id}" name="${esc(x.id)}"${attrs}>`;
        return `<label for="${id}">${esc(x.label)}</label>${ctl}` + (hid ? `<small class="forge-hint" id="${hid}">${esc(x.hint)}</small>` : '');
      }).join('');
      return FORM_CSS + `<form class="forge-form" method="post" action="${esc(f.action || '/wp-json/forge/v1/lead')}" data-forge-form data-ok="${esc(f.success || T.ok)}" data-err="${esc(T.err)}"><input type="hidden" name="page" value="${esc(this.page.slug)}"><div class="forge-hp" aria-hidden="true"><label>${esc(T.website)}<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>${rows}<label class="forge-consent"><input type="checkbox" name="consent" value="yes" required> <span>${esc(f.consent)}</span></label><button type="submit" class="forge-btn forge-btn-primary">${esc(f.button)}</button><p class="forge-form-msg" aria-live="polite"></p></form>` + (this.safety ? FORM_JS_SAFE : FORM_JS);
    }

    /* ---------- schema: LegalService, Person (attorneys), WebPage or ProfilePage, WebSite, BreadcrumbList, FAQPage, Article, Service ---------- */
    orgId() { return this.base + '/#organization'; }
    address(o) { if (!o) return undefined; return { '@type': 'PostalAddress', streetAddress: String(o.street || '').trim() || undefined, addressLocality: String(o.city || '').trim() || undefined, addressRegion: 'TX', postalCode: String(o.zip || '').trim() || undefined, addressCountry: 'US' }; }
    orgNode() {
      const F = this.firm, pg = this.page; const ent = pg.entity && typeof pg.entity === 'object' ? pg.entity : {};
      const t = arr(ent['@type']).find(x => x === 'LegalService' || x === 'Attorney');
      if (!t && ent['@type'] && !arr(ent['@type']).some(x => x === 'Organization' || x === 'LocalBusiness')) this.warn(`schema: entity type ${arr(ent['@type']).join('/')} replaced by LegalService`);
      const org = Object.assign({}, ent, { '@type': 'LegalService', '@id': this.orgId() });
      org.name = ent.name || F.name || this.brand.name || this.site.name || '';
      if (!org.legalName && F.legal_name && F.legal_name !== org.name) org.legalName = F.legal_name;
      if (!org.url) org.url = this.base + '/';
      if (!org.logo && isHttp(this.brand.logo_url)) org.logo = this.brand.logo_url;
      if (!org.image && org.logo) org.image = org.logo;
      if (!org.telephone) org.telephone = e164(F.phone) || undefined;
      if (!org.address && F.primary) org.address = this.address(F.primary);
      if (!org.location && F.offices.length > 1) org.location = F.offices.map(o => ({ '@type': 'Place', name: o.label || [F.name, o.city].filter(Boolean).join(', '), address: this.address(o), telephone: e164(o.phone) || undefined }));
      if (!org.openingHoursSpecification && !org.openingHours && F.primary) { const oh = parseHours(F.primary.hours); if (oh.length) org.openingHoursSpecification = oh; }
      const area = arr(ent.areaServed).concat(F.counties.map(c => ({ '@type': 'AdministrativeArea', name: `${c} County, Texas` })), F.cities.map(c => ({ '@type': 'City', name: `${c}, Texas` })));
      const seen = new Set(); org.areaServed = area.filter(a => { const k = typeof a === 'string' ? a : a.name; if (!k || seen.has(k)) return false; seen.add(k); return true; });
      if (!org.areaServed.length) org.areaServed = { '@type': 'State', name: 'Texas' };
      const know = uniq(arr(ent.knowsAbout).concat(F.areas)); if (know.length) org.knowsAbout = know;
      if (!org.knowsLanguage && F.languages.length) org.knowsLanguage = F.languages;
      if (!org.priceRange) { const fees = Object.values(F.fees); if (fees.length) { const lo = Math.min(...fees), hi = Math.max(...fees); const $ = n => '$' + Math.round(n).toLocaleString('en-US'); org.priceRange = lo === hi ? $(lo) : `${$(lo)} to ${$(hi)}`; } }
      if (!org.paymentAccepted && F.payment) org.paymentAccepted = F.payment;
      if (!org.foundingDate && /^\d{4}$/.test(String(F.founded).trim())) org.foundingDate = String(F.founded).trim();
      const same = uniq(arr(ent.sameAs).concat(F.social)); if (same.length) org.sameAs = same;
      return org;
    }
    people() {
      if (this._people) return this._people;
      const map = new Map(); const keys = ['name', 'title', 'bar_no', 'tbls', 'since', 'bio', 'url', 'media', 'languages', 'areas', 'credentials'];
      const add = (a, atty) => { if (!a || !String(a.name || '').trim()) return; const k = String(a.name).trim().toLowerCase(); const cur = map.get(k) || { atty: false };
        for (const key of keys) if ((cur[key] == null || cur[key] === '') && a[key] != null && a[key] !== '') cur[key] = key === 'name' ? String(a[key]).trim() : a[key]; cur.atty = cur.atty || !!atty; map.set(k, cur); };
      this.firm.attorneys.forEach(a => add(a, true));
      this.S.filter(s => s.type === 'attorneys').forEach(s => arr(s.items).forEach(a => add(a, true)));
      if (this.page.attorney) add(this.page.attorney, true);
      if (this.page.author) add(this.page.author, !!(this.page.author.bar_no || this.page.author.tbls));
      return (this._people = map);
    }
    personId(name) { const p = this.people().get(String(name || '').trim().toLowerCase()); return p ? this.base + (p.atty ? '/#attorney-' : '/#person-') + slug(p.name) : null; }
    personNode(p) {
      const n = { '@type': 'Person', '@id': this.personId(p.name), name: p.name };
      n.jobTitle = p.title || (p.atty ? 'Attorney' : this.safeCred(p.credentials, p.name)) || undefined;
      if (p.atty) n.worksFor = { '@id': this.orgId() };
      if (p.url) n.url = this.abs(p.url);
      const img = p.media ? this.mediaUrl(p.media) : ''; if (img) n.image = img;
      if (p.bio) n.description = p.bio;
      const area = tblsArea(p.tbls); const know = uniq(arr(p.areas).concat(area ? [area] : [])); if (know.length) n.knowsAbout = know;
      if (arr(p.languages).length) n.knowsLanguage = arr(p.languages);
      if (area) n.hasCredential = { '@type': 'EducationalOccupationalCredential', credentialCategory: 'certification', name: tblsLine(p.tbls), recognizedBy: { '@type': 'Organization', name: 'Texas Board of Legal Specialization', url: 'https://www.tbls.org/' } };
      if (p.bar_no) { n.identifier = { '@type': 'PropertyValue', propertyID: 'State Bar of Texas bar number', value: String(p.bar_no).trim() }; n.memberOf = { '@type': 'Organization', name: 'State Bar of Texas', url: 'https://www.texasbar.com/' }; }
      return n;
    }
    schema() {
      const pg = this.page, base = this.base, url = this.url, d = pg.dates || {};
      const org = this.orgNode(); const graph = [org];
      const people = [...this.people().values()]; const persons = people.map(p => this.personNode(p));
      const emp = people.map((p, i) => p.atty ? { '@id': persons[i]['@id'] } : null).filter(Boolean); if (emp.length && !org.employee) org.employee = emp;
      persons.forEach(p => graph.push(p));
      const atty = pg.attorney || (pg.archetype === 'attorney' ? this.attyItems(this.S.find(s => s.type === 'attorneys') || { items: [] })[0] : null);
      const web = { '@type': pg.archetype === 'attorney' && atty ? 'ProfilePage' : 'WebPage', '@id': url + '#webpage', url, name: pg.title || pg.h1, description: pg.meta_description || '', inLanguage: pg.language || 'en-US', isPartOf: { '@id': base + '/#website' }, about: { '@id': org['@id'] } };
      if (d.published) web.datePublished = d.published; if (d.modified) web.dateModified = d.modified; if (d.reviewed) web.lastReviewed = d.reviewed;
      const hero = this.S.find(s => s.type === 'hero' && s.media); const heroUrl = hero ? this.mediaUrl(hero.media) : ''; if (heroUrl) web.primaryImageOfPage = { '@type': 'ImageObject', url: heroUrl };
      if (this.S.some(s => s.type === 'answer')) web.speakable = { '@type': 'SpeakableSpecification', cssSelector: ['.forge-answer', 'h1'] };
      if (pg.author && pg.author.name) web.reviewedBy = { '@id': this.personId(pg.author.name) };
      if (web['@type'] === 'ProfilePage') web.mainEntity = { '@id': this.personId(atty.name) };
      const crumbs = arr(pg.breadcrumbs).filter(b => b && b.name && b.url);
      if (crumbs.length) web.breadcrumb = { '@id': url + '#breadcrumb' };
      graph.push(web);
      graph.push({ '@type': 'WebSite', '@id': base + '/#website', url: base + '/', name: org.name || this.brand.name || this.site.name || '', inLanguage: pg.language || 'en-US', publisher: { '@id': org['@id'] } });
      if (crumbs.length) graph.push({ '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: crumbs.concat([{ name: pg.h1, url }]).map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.name, item: this.abs(b.url) })) });
      const faq = this.S.find(s => s.type === 'faq' && arr(s.items).length); if (faq) graph.push({ '@type': 'FAQPage', '@id': url + '#faq', url, mainEntity: arr(faq.items).map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) });
      const steps = this.S.find(s => (s.type === 'steps' || s.type === 'process') && s.howto); if (steps) graph.push({ '@type': 'HowTo', name: steps.heading || pg.h1, step: arr(steps.steps).map(st => ({ '@type': 'HowToStep', name: st.title, text: st.text })) });
      if (['service', 'practice', 'location'].includes(pg.archetype) && (pg.service || pg.line)) {
        const sv = Object.assign({}, pg.service || {}); sv['@type'] = 'Service'; if (!sv.name) sv.name = pg.h1; if (!sv.serviceType) sv.serviceType = this.firm.lineName(pg.line) || pg.h1; sv.provider = { '@id': org['@id'] }; if (!sv.url) sv.url = url; if (!sv.areaServed) sv.areaServed = org.areaServed; if (!sv.description && pg.meta_description) sv.description = pg.meta_description;
        const fee = pg.line ? this.firm.fees[pg.line] : null; if (fee && !sv.offers) sv.offers = { '@type': 'Offer', price: String(fee), priceCurrency: 'USD', description: this.lang === 'es' ? 'Tarifa fija anunciada' : 'Advertised flat fee' };
        graph.push(sv);
      }
      if (pg.archetype === 'article' || pg.archetype === 'guide') { const art = { '@type': 'Article', '@id': url + '#article', headline: String(pg.h1 || pg.title || '').slice(0, 110), description: pg.meta_description || '', inLanguage: pg.language || 'en-US', mainEntityOfPage: { '@id': url + '#webpage' }, publisher: { '@id': org['@id'] }, author: pg.author && pg.author.name ? { '@id': this.personId(pg.author.name) } : { '@id': org['@id'] } };
        if (heroUrl) art.image = heroUrl; if (d.published) art.datePublished = d.published; if (d.modified) art.dateModified = d.modified; graph.push(art); }
      const vid = this.S.find(s => s.type === 'video'); if (vid) { const md = this.m(vid.media); if (md && !md.ph) { const vo = { '@type': 'VideoObject', name: vid.heading || pg.h1, description: vid.description || pg.meta_description || '', uploadDate: d.published || '' }; vo[/youtube|vimeo/.test(md.url) ? 'embedUrl' : 'contentUrl'] = md.url; const pu = vid.poster ? this.mediaUrl(vid.poster) : ''; if (pu) vo.thumbnailUrl = pu; if (vid.transcript) vo.transcript = vid.transcript; graph.push(vo); } }
      arr(pg.schema_extra).forEach(x => graph.push(x));
      return { '@context': 'https://schema.org', '@graph': graph.map(prune).filter(Boolean) };
    }
    alternates() {
      const out = []; const add = (lang, u) => { if (!u) return; const url = this.abs(u); if (!out.some(x => x.url === url)) out.push({ hreflang: lang, url }); };
      arr(this.page.alternates).forEach(a => a && add(a.lang || a.hreflang, a.url));
      this.S.filter(s => s.type === 'lang_toggle').forEach(s => { const t = this.langTarget(s); add(t.lang === 'es' ? 'es-US' : 'en-US', t.url); });
      if (out.length) add(this.page.language || (this.lang === 'es' ? 'es-US' : 'en-US'), this.url);
      return out;
    }
    seo() {
      const pg = this.page; const hero = this.S.find(s => s.type === 'hero' && s.media); let og = hero ? this.m(hero.media).url : ''; if (isPh(og)) og = '';
      const o = { title: pg.title || pg.h1, description: pg.meta_description || '', canonical: pg.canonical || '', noindex: !!pg.noindex, og_image: og };
      const alt = this.alternates(); if (alt.length) o.alternates = alt; return o;
    }
    lint(html, schema) {
      const pg = this.page, w = [], S = this.S;
      if ((pg.title || '').length > 60) w.push(`title ${pg.title.length} characters (aim for 60 or fewer)`);
      const md = (pg.meta_description || '').length; if (md < 70 || md > 160) w.push(`meta description ${md} characters (aim for 120 to 158)`);
      if (!S.some(s => s.type === 'answer')) w.push('no answer capsule (a direct answer AI search can quote): add an "answer" section right after the hero');
      if (!S.some(s => s.type === 'faq')) w.push('no FAQ section: add 4 to 8 real questions');
      if (S.filter(s => s.type === 'hero').length !== 1) w.push('exactly one hero required');
      const hero = S.find(s => s.type === 'hero'); if (hero && ((hero.h1 || pg.h1) || '').length > 70) w.push('H1 over 70 characters');
      const h1n = (String(html).match(/<h1[\s>]/gi) || []).length; if (h1n > 1) w.push(`${h1n} H1 headings on the page; keep one, the hero`);
      for (const k in (this.bp.media || {})) if (!(this.bp.media[k] || {}).alt) w.push(`media "${k}" has no alt text`);
      if (!(pg.cta || {}).primary) w.push('no primary CTA');
      if (!pg.internal_links || !pg.internal_links.length) w.push('no internal links declared (verify each against the live sitemap before adding)');
      const blob = JSON.stringify(this.bp).toLowerCase();
      for (const bad of ['[[verify', 'lorem ipsum', 'todo:', 'xxx', 'placeholder text']) if (blob.includes(bad)) w.push(`BLOCK: "${bad}" found in the blueprint, resolve it before deploy`);
      const text = visibleText(html);
      const ph = text.match(/\[(Firm name|Responsible attorney|Office city|City|County|Phone|Fee|Base)\]/); if (ph) w.push(`BLOCK: ${ph[0]} is still a placeholder on the page; fill the firm profile (Rule 7.01(a))`);
      const F = this.firm; const rn = F.responsible && F.responsible.name, city = F.primary && String(F.primary.city || '').trim();
      const notes = S.filter(s => s.type === 'disclaimer' || s.id === 'notice' || s.id === 'disclaimer');
      if (!notes.length) w.push('BLOCK: no disclaimer on the page; Rule 7.02(a) needs the responsible attorney and the primary practice location on every page');
      else if (rn && city) { const nt = notes.map(s => visibleText(this.secBody(s) || '')).join(' '); if (!(nt.includes(rn) && nt.includes(city))) w.push('BLOCK: the disclaimer does not name the responsible attorney and the primary practice location (Rule 7.02(a)); use the disclaimer section'); }
      const sc = text.replace(TBLS_ALL, '').match(SPECIAL); if (sc) w.push(`Rule 7.02(b): "${sc[0]}" claims special competence; only "Board Certified, [area], Texas Board of Legal Specialization" may be said`);
      const dm = text.match(DASH); if (dm) w.push(`house style: a hyphen or dash ("${dm[0]}") in the visible text; write ranges as "2 to 4" and drop the dash`);
      if (S.some(s => s.type === 'form') && !this.formSpec().shortcode && !/attorney client|abogado y cliente/i.test(this.formSpec().consent)) w.push('form consent does not say that submitting does not create an attorney client relationship');
      const org = (schema['@graph'] || [])[0] || {}; if (!org.address || !org.telephone) w.push('schema: the LegalService node has no ' + [!org.address ? 'address' : '', !org.telephone ? 'telephone' : ''].filter(Boolean).join(' or ') + '; fill the firm profile (offices and phone)');
      validateSchema(schema).filter(m => !/LegalService is missing (address|telephone)/.test(m)).slice(0, 12).forEach(m => w.push('schema: ' + m));
      if (this.safety) {
        const tr = [...new Set((String(html).replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '').match(TRACKING) || []).map(x => x.replace(/\s*\($/, '').toLowerCase()))];
        if (tr.length) w.push(`BLOCK: Safety mode: tracking or a third party script or frame on a ${this.safety.sensitive === 'cps' ? 'CPS' : 'protective order or family violence'} page (${tr.join(', ')}); remove it`);
        if (this.safety.quick_exit !== false && !/data-forge-exit/.test(html)) w.push('Safety mode: no quick exit on the page');
        if (this.S.some(s => s.type === 'form') && !/name="safe_contact"/.test(html) && !this.formSpec().shortcode && this.formSpec().provider !== 'elementor_pro') w.push('Safety mode: the intake form does not ask whether it is safe to call, text or leave a voicemail');
      }
      return w.concat(this.warnings);
    }
    /* ---------- the portable blueprint: what the headless kit and the bridge's forge field carry ---------- */
    portable() {
      const out = [];
      for (const s of this.S) {
        const o = Object.assign({}, s); delete o._sid; o.id = s._sid;
        if (s.type === 'attorneys' || s.type === 'court_facts' || s.type === 'lang_toggle' || s.type === 'quick_exit' || s.type === 'hotline') { const body = this.secBody(s); if (!body) continue; out.push({ type: 'html', id: s._sid, style: styleOf(s), html: stripDataImg(body) }); continue; }
        if (s.type === 'disclaimer') { out.push({ type: 'rich_text', id: s._sid, heading: s.heading || '', html: this.disclaimerHTML(s), width: 'narrow' }); continue; }
        if (s.type === 'steps' || s.type === 'process') { o.type = 'steps'; if (!o.heading) o.heading = s.type === 'process' ? this.T.process : this.T.how; o.steps = arr(s.steps).map(st => Object.assign({}, st, { text: st.when ? `${st.when}: ${st.text}` : st.text })); }
        out.push(o);
      }
      const page = Object.assign({}, this.page);
      if (this.S.some(s => s.type === 'form')) { const f = this.formSpec(); page.conversion = Object.assign({}, page.conversion || {}, { form: Object.assign({}, (page.conversion || {}).form || {}, { consent: f.consent, button: f.button, fields: f.fields.map(x => ({ id: x.id, label: x.hint ? `${x.label}. ${x.hint}` : x.label, type: x.type === 'select' ? 'text' : (x.type || 'text'), required: !!x.required })) }) }); }
      const bp = Object.assign({}, this.bp, { page, sections: out, forge_portable: 1 }); delete bp._facts; delete bp._missing; return bp;
    }
  }
  function previewDoc(f, body, schema, seo) {
    const b = f.brand, p = f.cta.primary || null; const tl = p && p.phone ? tel(p.phone) : null; const T = f.T;
    const sticky = ((f.page.conversion || {}).sticky_mobile_bar !== false && p) ? ('<div class="forge-sticky">' + (tl ? `<a class="forge-sticky-call" href="${esc(tl)}">${esc(T.callNow)}</a>` : '') + `<a class="forge-sticky-cta" href="${esc(p.url || '#contact')}">${esc(p.label || T.start)}</a>` + '</div>') : '';
    const css = PREVIEW_CSS.replace(/%p/g, f.primary).replace(/%a/g, f.accent).replace(/%t/g, f.tint).replace(/%d/g, f.dark).replace(/%font/g, b.font_body || 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif').replace(/%hfont/g, b.font_heading || 'inherit');
    const alts = (seo.alternates || []).map(a => `<link rel="alternate" hreflang="${esc(a.hreflang)}" href="${esc(a.url)}">`).join('');
    return `<!DOCTYPE html><html lang="${esc((f.page.language || 'en-US').slice(0, 2))}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(seo.title)}</title><meta name="description" content="${esc(seo.description)}">${alts}<style>${css}</style><scr` + `ipt type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</` + `script></head><body><main>${body}</main>${sticky}</body></html>`;
  }
  function compile(bp, media) {
    const f = new Forge(bp, media || {}); const content = f.elementor(); const html = f.html(); const schema = f.schema(); const seo = f.seo(); const lint = f.lint(html, schema);
    const issues = lint.map(msg => ({ sev: /^BLOCK/.test(msg) ? 'block' : /^MEDIA/.test(msg) ? 'note' : 'warn', msg })).concat(f.infos.map(msg => ({ sev: 'info', msg })));
    return { template: f.templateFile(content), elementor_data: content, page_settings: f.pageSettings(), html, preview: previewDoc(f, html, schema, seo), schema, seo, lint, warnings: lint, issues, portable: f.portable(), page: bp.page, blueprint: bp };
  }
  function portable(bp, media) { return new Forge(bp, media || {}).portable(); }
  function bundle(bp, media, r) {
    r = r || compile(bp, media); media = media || {};
    const mr = {}; for (const k in media) { const v = media[k]; if (!v || isPh(v.url)) continue; mr[k] = {}; for (const kk of ['id', 'url', 'alt', 'kind', 'width', 'height', 'mime']) if (v[kk] !== undefined) mr[k][kk] = v[kk]; }
    const bp2 = Object.assign({}, r.portable || portable(bp, media), { media_resolved: mr }); const hero = arr(bp.sections).find(x => x && x.type === 'hero' && x.media);
    const seo = Object.assign({}, r.seo); if (isPh(seo.og_image)) seo.og_image = '';
    return { slug: bp.page.slug, title: bp.page.title, post_title: bp.page.h1, status: 'draft', post_type: bp.page.post_type || 'page', template: r.page_settings.template, elementor_data: r.elementor_data, page_settings: r.page_settings, content_html: stripPh(r.html), seo, schema: r.schema, blueprint: bp2, summary: bp.page.summary || '', excerpt: bp.page.summary || '', featured_media: hero && media[hero.media] ? (media[hero.media].id || 0) : 0 };
  }
  function pageFor(bp, r, media, extra) { r = r || compile(bp, media); if (typeof CMS === 'undefined' || !CMS.pageFromForge) throw new Error('the CMS layer is not loaded'); return CMS.pageFromForge(r.portable || portable(bp, media), r, media, extra); }
  function previewPage(a, b, c, d) { if (a instanceof Forge) return previewDoc(a, b, c, d); return compile(a, b).preview; }
  function defaultForm(bp) { const f = new Forge(bp || {}, {}).formSpec(); return { fields: f.fields, consent: f.consent, button: f.button }; }
  return { compile, bundle, portable, pageFor, previewPage, validateSchema, defaultForm, tblsLine, tblsArea, parseHours, visibleText, isPlaceholder: isPh, stripPlaceholders: stripPh, esc, slug, tel, hexmix, PREVIEW_CSS, FORM_JS, FORM_JS_SAFE, EXIT_URL, STR, Forge };
})();
