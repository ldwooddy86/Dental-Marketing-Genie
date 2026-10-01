/* Site Forge compiler (src/04_forge_compile.js) and the bridge plugin string (src/05_forge_bridge_raw.js), for a Texas family law firm.
   The compiler runs in its own vm context (no app globals); a second context adds LINE_META and CI the way the app has them.
   Checks: Elementor JSON shape and unique ids, one h1 and every section in the HTML, JSON-LD types, properties and required fields,
   the intake form, media placeholders, house style, bundle(), portable(), Rule 7.02(a) and 7.02(b) handling, Spanish defaults, and that
   the bridge still serves every route, field and setting the shared WordPress adapter and headless kit use (php -l when PHP exists). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { load, root } from './lib/load.mjs';
import { assert, eq } from './lib/mock.mjs';

const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
function sandbox(pre) {
  const ctx = vm.createContext({ console, URL });
  if (pre) vm.runInContext(pre, ctx);
  vm.runInContext(read('src/04_forge_compile.js') + '\n;globalThis.FORGE_COMPILE = FORGE_COMPILE;', ctx, { filename: 'src/04_forge_compile.js' });
  return ctx.FORGE_COMPILE;
}
const FC = sandbox();
for (const k of ['compile', 'bundle', 'portable', 'pageFor', 'previewPage', 'validateSchema', 'defaultForm', 'tblsLine', 'esc', 'slug', 'tel', 'hexmix', 'Forge']) assert(FC[k], 'FORGE_COMPILE.' + k);
assert(typeof FC.PREVIEW_CSS === 'string' && FC.PREVIEW_CSS.includes('%p'), 'PREVIEW_CSS kept');

/* ---------- the blueprint: a practice area page for a Houston family law firm ---------- */
const SITE = 'https://www.riverafamilylaw.example';
const firm = { name: 'Rivera Family Law', legal_name: 'Rivera Family Law, PLLC', url: SITE, phone: '7135550100',
  attorneys: [{ name: 'Ana Rivera', bar_no: '24012345', tbls: 'Family Law', since: '2004', bio: 'Ana Rivera handles divorce and custody cases in Harris and Fort Bend counties.', languages: ['en', 'es'] },
    { name: 'Mark Chen', bar_no: '24067890', tbls: '', since: '2012', bio: 'Mark Chen handles modification and enforcement cases.' }],
  responsible: 0, offices: [{ label: 'Houston office', street: '1200 Smith Street, Suite 1600', city: 'Houston', zip: '77002', county: 'Harris', phone: '7135550100', hours: 'Monday to Friday, 8 am to 6 pm', primary: true },
    { label: 'Sugar Land office', street: '2 Town Square Place', city: 'Sugar Land', zip: '77479', county: 'Fort Bend', phone: '2815550100', hours: 'Monday to Thursday, 9 am to 5 pm', primary: false }],
  county_names: ['Harris', 'Fort Bend', 'Montgomery'], city_names: ['Houston', 'Sugar Land'], lines: ['div_k', 'sapcr', 'ivd'], practice_areas: ['Divorce with children', 'Custody and SAPCR', 'Child support and paternity (IV-D)'],
  languages: ['en', 'es'], fees: { sapcr: 3500, div_k: '' }, payment: 'Credit cards and payment plans', social: { facebook: 'https://www.facebook.com/riverafamilylaw', x: '' } };
const bp = { forge: '1', site: { url: SITE, name: 'Rivera Family Law', brand: { name: 'Rivera Family Law', primary: '#1b4332', accent: '#307a4f', dark: '#0a291a', globals: true, logo_url: SITE + '/logo.png' }, firm },
  page: { archetype: 'practice', slug: 'houston-custody-lawyer', title: 'Houston Child Custody Lawyer | Rivera Family Law', h1: 'Child Custody Lawyer in Houston, Texas', line: 'sapcr',
    meta_description: 'Custody cases in Harris County: how Texas courts decide conservatorship and possession, how long a SAPCR takes and what the first consultation covers.', language: 'en-US',
    breadcrumbs: [{ name: 'Home', url: '/' }], dates: { published: '2026-09-30', modified: '2026-09-30' }, cta: { primary: { label: 'Request a consultation', url: '#contact', phone: '(713) 555 0100' } },
    conversion: { sticky_mobile_bar: true, trust: ['Responsible attorney Ana Rivera', 'Offices in Houston and Sugar Land'], form: { provider: 'html' } },
    internal_links: [{ anchor: 'Divorce with children', url: '/divorce/' }], author: { name: 'Ana Rivera' }, entity: { '@type': 'HVACBusiness', name: 'Rivera Family Law' } },
  media: { hero: { source: 'library:harris county family law center', alt: 'Harris County Family Law Center in Houston', kind: 'image' }, ana: { source: 'assets/ana.webp', alt: 'Ana Rivera', kind: 'image' } },
  sections: [
    { type: 'hero', media: 'hero', eyebrow: 'Family law in Houston', lede: 'Custody, divorce and support cases in Harris, Fort Bend and Montgomery counties.', cta: ['primary'] },
    { type: 'answer', heading: 'How do Texas courts decide custody?', body: 'A Texas court decides conservatorship and possession by the best interest of the child. The law presumes that naming both parents joint managing conservators is in the child’s best interest, and that presumption can be rebutted.' },
    { type: 'rich_text', heading: 'What the court looks at', html: '<p>The judge looks at each parent’s role, the child’s needs and any history of family violence.</p>' },
    { type: 'process', heading: 'How a custody case moves', steps: [{ title: 'Petition', text: 'A parent files a suit affecting the parent child relationship.', when: 'Day 1' }, { title: 'Temporary orders', text: 'The court can set temporary orders while the case is pending.', when: 'Weeks 2 to 6' }] },
    { type: 'attorneys', heading: 'Your attorneys', items: [{ name: 'Ana Rivera', media: 'ana', url: '/attorneys/ana-rivera/' }, { name: 'Mark Chen', credentials: 'Family law specialist' }] },
    { type: 'court_facts', county: 'Harris', items: [{ label: 'County seat', value: 'Houston' }], courts: [{ name: 'Harris County Family Law Center', address: '1115 Congress Street, Houston, TX 77002' }], note: 'Check the court website for current hours.' },
    { type: 'faq', items: [{ q: 'Can my child choose which parent to live with?', a: 'No. At 12 or older the judge must interview the child in chambers on request, but the preference does not control.' }, { q: 'Does joint custody mean equal time?', a: 'No. Joint managing conservatorship does not mean equal time; possession is set separately.' }] },
    { type: 'form', heading: 'Request a consultation', text: 'Two minutes. The firm calls you back.' },
    { type: 'lang_toggle', url: '/es/abogado-de-custodia-houston/' },
    { type: 'disclaimer' },
    { type: 'links' }] };
const media = { hero: { id: 11, url: SITE + '/wp-content/uploads/hero.webp', alt: 'Harris County Family Law Center in Houston', width: 1600, height: 1000, kind: 'image' }, ana: { id: 12, url: SITE + '/wp-content/uploads/ana.webp', alt: 'Ana Rivera', width: 800, height: 1000, kind: 'image' } };
const bpBefore = JSON.stringify(bp);
const r = FC.compile(bp, media);
eq(JSON.stringify(bp), bpBefore, 'compile does not mutate the blueprint');
for (const k of ['template', 'elementor_data', 'page_settings', 'html', 'preview', 'schema', 'seo', 'lint', 'warnings', 'issues', 'portable', 'page', 'blueprint']) assert(k in r, 'compile result has ' + k);
assert(r.warnings === r.lint && Array.isArray(r.lint), 'warnings is the lint list');

/* ---------- Elementor JSON ---------- */
const ids = []; const widgets = [];
const walk = (el, depth) => {
  assert(el && typeof el.id === 'string' && /^[0-9a-f]{7}$/.test(el.id), 'element id: ' + JSON.stringify(el && el.id));
  ids.push(el.id); assert(Array.isArray(el.elements) && el.settings && typeof el.settings === 'object', 'element shape');
  if (el.elType === 'widget') { assert(typeof el.widgetType === 'string' && el.elements.length === 0, 'widget shape'); widgets.push(el); }
  else { assert(el.elType === 'container', 'only containers and widgets: ' + el.elType); assert(el.isInner === (depth > 0), 'isInner by depth'); }
  for (const c of el.elements) walk(c, depth + 1);
};
assert(Array.isArray(r.elementor_data) && r.elementor_data.length >= bp.sections.length, 'one top level container per section plus the sticky bar');
r.elementor_data.forEach(el => { assert(el.elType === 'container', 'top level is a container'); walk(el, 0); });
eq(new Set(ids).size, ids.length, 'every Elementor id is unique');
const tabIds = widgets.flatMap(w => (w.settings.tabs || []).map(t => t._id).concat((w.settings.icon_list || []).map(t => t._id))); eq(new Set(tabIds.concat(ids)).size, tabIds.length + ids.length, 'repeater _ids are unique too');
const sectIds = r.elementor_data.filter(e => e.settings.html_tag === 'section').map(e => e.settings._element_id);
eq(sectIds, ['hero', 'how-do-texas-courts-decide-custody', 'what-the-court-looks-at', 'how-a-custody-case-moves', 'your-attorneys', 'court-facts', 'faq', 'contact', 'lang-toggle', 'disclaimer', 'links'], 'section anchors in order, the form is #contact');
assert(r.elementor_data[r.elementor_data.length - 1].settings.css_classes === 'forge-sticky-wrap', 'sticky bar last');
const wt = new Set(widgets.map(w => w.widgetType)); for (const t of ['heading', 'text-editor', 'button', 'image', 'accordion', 'html', 'icon-list']) assert(wt.has(t), 'widget ' + t);
eq(widgets.filter(w => w.widgetType === 'heading' && w.settings.header_size === 'h1').length, 1, 'one h1 heading widget');
const heroImg = widgets.find(w => w.widgetType === 'image' && w.settings._forge_media && w.settings._forge_media.image === 'hero');
assert(heroImg && heroImg.settings.image.url === media.hero.url && heroImg.settings.image.id === 11 && heroImg.settings.image.source === 'library', 'hero image resolved and marked for the bridge');
const attSec = r.elementor_data.find(e => e.settings._element_id === 'your-attorneys');
assert(attSec && JSON.stringify(attSec).includes('Board Certified, Family Law, Texas Board of Legal Specialization') && JSON.stringify(attSec).includes('State Bar of Texas No. 24012345'), 'attorney cards in Elementor');
assert(!JSON.stringify(attSec).includes('specialist'), 'the specialist credential is left off');
eq(r.page_settings, { hide_title: 'yes', template: 'default' }, 'page settings');
assert(r.template.content === r.elementor_data && r.template.version === '0.4' && r.template.type === 'page', 'template file');

/* ---------- semantic HTML ---------- */
const html = r.html;
eq((html.match(/<h1[\s>]/g) || []).length, 1, 'one h1');
for (const id of sectIds) assert(html.includes(`<section id="${id}" class="forge-section`), 'html section #' + id);
assert(/<section id="your-attorneys" class="forge-section forge-sec-attorneys forge-tint">/.test(html), 'attorneys section tinted');
assert(html.includes('<p class="forge-cert">Board Certified, Family Law, Texas Board of Legal Specialization</p>') && html.includes('<p class="forge-bar">State Bar of Texas No. 24012345</p>') && html.includes('Licensed in Texas since 2004') && html.includes('Speaks English and Spanish'), 'attorney card lines');
const markCard = html.split('<article class="forge-card forge-att">').find(c => c.includes('>Mark Chen<')); assert(markCard && !markCard.includes('forge-cert') && markCard.includes('State Bar of Texas No. 24067890'), 'no TBLS line for a lawyer without a certification');
assert(!/specialist/i.test(html), 'no "specialist" on the page');
assert(html.includes('<p class="forge-when"><strong>Weeks 2 to 6</strong></p>'), 'process steps carry when');
assert(html.includes('<table class="forge-table forge-court">') && html.includes('<th scope="row">County seat</th>') && html.includes('Harris County Family Law Center'), 'court and county facts');
assert(html.includes('<a href="/es/abogado-de-custodia-houston/" hreflang="es" lang="es">Lea esta página en español</a>'), 'bilingual toggle link');
const disc = html.split('<section id="disclaimer"')[1].split('</section>')[0];
assert(disc.includes('This page is attorney advertising.') && disc.includes('Responsible attorney: Ana Rivera, Rivera Family Law.') && disc.includes('Primary practice location: 1200 Smith Street, Suite 1600, Houston, Texas.') && disc.includes('does not create an attorney client relationship'), 'disclaimer: Rule 7.02(a) lawyer and location, advertising, no attorney client relationship');
eq((html.match(/This page is attorney advertising/g) || []).length, 1, 'one disclaimer (no automatic duplicate)');
assert(html.includes('<img src="' + media.hero.url + '" alt="Harris County Family Law Center in Houston" width="1600" height="1000" fetchpriority="high" decoding="async">'), 'hero image with dimensions and priority');

/* the intake form */
const form = html.split('<form')[1].split('</form>')[0];
assert(/ action="\/wp-json\/forge\/v1\/lead" data-forge-form/.test(form), 'form posts to the bridge lead route');
const names = [...form.matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"/g)].map(m => m[1]);
eq(names, ['page', 'website', 'name', 'phone', 'email', 'county', 'matter', 'message', 'consent'], 'form fields in order (page, honeypot, name, phone, email, county, matter, description, consent)');
for (const id of ['name', 'phone', 'email', 'county', 'matter', 'message']) assert(new RegExp(`<label for="forge-houston-custody-lawyer-${id}">[^<]+</label><(input|select|textarea)[^>]*id="forge-houston-custody-lawyer-${id}"`).test(form), 'labelled field ' + id);
assert(/<input type="text" id="forge-houston-custody-lawyer-name" name="name" required autocomplete="name">/.test(form) && /name="phone" required/.test(form) && !/name="email" required/.test(form), 'name and phone required, email optional');
const countyOpts = [...form.split('name="county"')[1].split('</select>')[0].matchAll(/<option value="([^"]*)">/g)].map(m => m[1]);
eq(countyOpts, ['', 'Harris County', 'Fort Bend County', 'Montgomery County', 'Another Texas county'], 'county select from the firm counties');
const matterOpts = [...form.split('name="matter"')[1].split('</select>')[0].matchAll(/<option value="([^"]*)">/g)].map(m => m[1]);
eq(matterOpts, ['', 'Divorce with children', 'Custody and SAPCR', 'Child support and paternity', 'Something else'], 'matter select from the firm lines (no hyphenated parenthetical)');
assert(/<textarea id="forge-houston-custody-lawyer-message" name="message" rows="4" aria-describedby="forge-houston-custody-lawyer-message-hint" maxlength="600"><\/textarea><small class="forge-hint" id="forge-houston-custody-lawyer-message-hint">Do not include confidential details\.<\/small>/.test(form), 'short description with the confidential details hint');
const consent = (form.match(/<label class="forge-consent"><input type="checkbox" name="consent" value="yes" required> <span>([^<]+)<\/span>/) || [])[1] || '';
assert(/Rivera Family Law may contact you/.test(consent) && /Message and data rates may apply/.test(consent) && /Reply STOP/.test(consent) && /does not create an attorney client relationship/.test(consent), 'law firm consent: contact, rates, STOP, no attorney client relationship');
assert(r.html.includes('data-ok="Thank you. The firm will contact you soon."'), 'success message on the form');
/* the form script still runs: it parses and binds once per form */
const js = (r.html.match(/<script>([\s\S]*?)<\/script>/) || [])[1]; assert(js && js.includes('forge_lead') && js.includes('JSON.stringify(d)') && js.includes('f.reset()'), 'form script kept');
new vm.Script(js);
{ const bound = []; const fake = { getAttribute: k => (k === 'data-forge-bound' ? fake._b : null), setAttribute: (k, v) => { fake._b = v; }, addEventListener: (ev, fn) => bound.push(ev) };
  vm.runInNewContext(js, { document: { querySelectorAll: () => [fake] }, Array }); vm.runInNewContext(js, { document: { querySelectorAll: () => [fake] }, Array }); eq(bound, ['submit'], 'submit bound once even when the script runs twice'); }

/* Elementor Pro form provider: the same fields as native form fields */
{ const ep = JSON.parse(JSON.stringify(bp)); ep.page.conversion.form.provider = 'elementor_pro'; ep.page.conversion.form.email_to = 'intake@riverafamilylaw.example';
  const fw = []; const wf = el => { if (el.widgetType === 'form') fw.push(el); (el.elements || []).forEach(wf); }; FC.compile(ep, media).elementor_data.forEach(wf);
  assert(fw.length === 1, 'one Elementor Pro form'); const ff = fw[0].settings.form_fields;
  eq(ff.map(x => [x.custom_id, x.field_type, x.required]), [['name', 'text', 'true'], ['phone', 'tel', 'true'], ['email', 'email', ''], ['county', 'select', ''], ['matter', 'select', ''], ['message', 'textarea', ''], ['consent', 'acceptance', 'true']], 'Elementor Pro fields');
  assert(ff[3].field_options === 'Harris County\nFort Bend County\nMontgomery County\nAnother Texas county' && ff[5].placeholder === 'Do not include confidential details.' && ff[6].acceptance_text === consent && fw[0].settings.email_to === 'intake@riverafamilylaw.example' && fw[0].settings.email_subject === 'New inquiry: ' + bp.page.h1, 'select options, hint, consent and email action'); }
const sc = JSON.parse(JSON.stringify(bp)); sc.page.conversion.form = { provider: 'wpforms', shortcode: '[wpforms id="12"]' };
assert(FC.compile(sc, media).html.includes('[wpforms id="12"]') && !FC.compile(sc, media).html.includes('data-forge-form'), 'a form plugin shortcode replaces the html form');

/* house style: no hyphen or dash in visible text */
const text = FC.visibleText(html);
assert(!/[‐-―−]|(?<=\w)-(?=\w)|\s-\s/.test(text), 'no hyphen or dash in visible text: ' + (text.match(/.{0,30}([‐-―−]|(?<=\w)-(?=\w)|\s-\s).{0,30}/) || [''])[0]);
assert(!/\[(Firm name|Responsible attorney|Office city)\]/.test(text), 'no bracket placeholders with a filled firm');
assert(!JSON.stringify(r.elementor_data).match(/[—–]/), 'no em or en dash in the Elementor data');

/* ---------- media: never a placeholder when media is given; placeholders only in previews without it ---------- */
const all = JSON.stringify([r.elementor_data, r.html, r.schema, r.seo, r.portable]);
assert(!/resolved(%20| )at(%20| )deploy/i.test(all), 'no "resolved at deploy" placeholder when media is given');
assert(!r.lint.some(l => /^MEDIA/.test(l)), 'no MEDIA notes when media is given');
const r0 = FC.compile(bp, {});
assert(/resolved(%20| )at(%20| )deploy/.test(r0.html) && r0.lint.filter(l => /^MEDIA: slot "(hero|ana)" unresolved/.test(l)).length === 2 && !r0.lint.some(l => /[—–]/.test(l)), 'without media: the html preview shows placeholders and lint says MEDIA (no em dash)');
const ej0 = JSON.stringify(r0.elementor_data); assert(!/resolved(%20| )at(%20| )deploy|data:image/.test(ej0), 'Elementor data never carries the placeholder');
const hero0 = []; const w0 = el => { if (el.widgetType === 'image' && el.settings._forge_media && el.settings._forge_media.image === 'hero') hero0.push(el); (el.elements || []).forEach(w0); }; r0.elementor_data.forEach(w0);
assert(hero0.length === 1 && hero0[0].settings.image.url === '' && hero0[0].settings.image.id === 0, 'unresolved slot is an empty image marked for the bridge');
assert(!/resolved(%20| )at(%20| )deploy/.test(JSON.stringify(r0.schema)) && r0.seo.og_image === '' && !JSON.stringify(r0.schema).includes('primaryImageOfPage'), 'no placeholder in the JSON-LD or the og image');
const b0 = FC.bundle(bp, {}, r0); assert(!/resolved(%20| )at(%20| )deploy/.test(b0.content_html + JSON.stringify(b0.blueprint)), 'bundle content and blueprint carry no placeholder');
assert(r0.preview.includes('resolved%20at%20deploy'), 'the preview keeps the visual placeholder');

/* ---------- JSON-LD ---------- */
const G = r.schema['@graph']; eq(r.schema['@context'], 'https://schema.org', '@context');
const types = G.map(n => n['@type']); eq(types, ['LegalService', 'Person', 'Person', 'WebPage', 'WebSite', 'BreadcrumbList', 'FAQPage', 'Service'], 'graph types');
assert(!/HVAC|Plumb|Contractor/.test(JSON.stringify(r.schema)), 'no HVAC types');
assert(r.lint.some(l => /entity type HVACBusiness replaced by LegalService/.test(l)), 'an HVAC entity type is replaced, with a note');
eq(FC.validateSchema(r.schema), [], 'every property is a schema.org property of its type and required fields are present');
const org = G[0];
assert(org['@id'] === SITE + '/#organization' && org.name === 'Rivera Family Law' && org.legalName === 'Rivera Family Law, PLLC' && org.url === SITE + '/' && org.logo === SITE + '/logo.png' && org.telephone === '+17135550100', 'LegalService identity');
eq(org.address, { '@type': 'PostalAddress', streetAddress: '1200 Smith Street, Suite 1600', addressLocality: 'Houston', addressRegion: 'TX', postalCode: '77002', addressCountry: 'US' }, 'primary office address');
eq(org.location.map(l => [l['@type'], l.address.addressLocality, l.telephone]), [['Place', 'Houston', '+17135550100'], ['Place', 'Sugar Land', '+12815550100']], 'every office as a location');
eq(org.openingHoursSpecification, [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '18:00' }], 'hours parsed');
eq(org.areaServed.map(a => a['@type'] + ':' + a.name), ['AdministrativeArea:Harris County, Texas', 'AdministrativeArea:Fort Bend County, Texas', 'AdministrativeArea:Montgomery County, Texas', 'City:Houston, Texas', 'City:Sugar Land, Texas'], 'areaServed counties and cities');
eq(org.knowsAbout, ['Divorce with children', 'Custody and SAPCR', 'Child support and paternity'], 'knowsAbout the practice areas');
eq(org.priceRange, '$3,500', 'priceRange from the advertised fees only');
eq(org.employee, [{ '@id': SITE + '/#attorney-ana-rivera' }, { '@id': SITE + '/#attorney-mark-chen' }], 'attorneys as employees');
eq(org.sameAs, ['https://www.facebook.com/riverafamilylaw'], 'sameAs from the filled profiles');
const ana = G[1];
assert(ana.name === 'Ana Rivera' && ana.jobTitle === 'Attorney' && ana.worksFor['@id'] === org['@id'] && ana.url === SITE + '/attorneys/ana-rivera/' && ana.image === media.ana.url, 'Person for the lawyer');
eq(ana.hasCredential, { '@type': 'EducationalOccupationalCredential', credentialCategory: 'certification', name: 'Board Certified, Family Law, Texas Board of Legal Specialization', recognizedBy: { '@type': 'Organization', name: 'Texas Board of Legal Specialization', url: 'https://www.tbls.org/' } }, 'TBLS credential');
eq(ana.identifier, { '@type': 'PropertyValue', propertyID: 'State Bar of Texas bar number', value: '24012345' }, 'bar number');
assert(!G[2].hasCredential && G[2].memberOf.name === 'State Bar of Texas', 'no credential without a certification');
const web = G[3];
assert(web['@id'] === SITE + '/houston-custody-lawyer/#webpage' && web.reviewedBy['@id'] === ana['@id'] && web.primaryImageOfPage.url === media.hero.url && web.breadcrumb['@id'] === SITE + '/houston-custody-lawyer/#breadcrumb' && web.speakable, 'WebPage');
eq(G[5].itemListElement.map(i => [i.position, i.name, i.item]), [[1, 'Home', SITE + '/'], [2, 'Child Custody Lawyer in Houston, Texas', SITE + '/houston-custody-lawyer/']], 'BreadcrumbList');
eq(G[6].mainEntity.length, 2, 'FAQPage questions'); assert(G[6].mainEntity[0].acceptedAnswer.text.startsWith('No. At 12'), 'FAQ answer');
assert(G[7].serviceType === 'Custody and SAPCR' && G[7].provider['@id'] === org['@id'] && G[7].offers.price === '3500' && G[7].offers.priceCurrency === 'USD', 'Service with the line fee');
assert(r.preview.includes('<script type="application/ld+json">') && r.preview.includes('"LegalService"'), 'preview carries the JSON-LD');

/* ---------- SEO ---------- */
eq(r.seo.title, bp.page.title, 'seo title'); eq(r.seo.og_image, media.hero.url, 'og image');
eq(r.seo.alternates, [{ hreflang: 'es-US', url: SITE + '/es/abogado-de-custodia-houston/' }, { hreflang: 'en-US', url: SITE + '/houston-custody-lawyer/' }], 'hreflang alternates from the toggle');
assert(r.preview.includes('<link rel="alternate" hreflang="es-US"'), 'preview alternates');

/* ---------- lint: compliance ---------- */
assert(!r.lint.some(l => /^BLOCK/.test(l)), 'no BLOCK for a complete firm: ' + r.lint.filter(l => /^BLOCK/.test(l)).join(' | '));
assert(r.lint.some(l => /Rule 7\.02\(b\).*Mark Chen/.test(l)), 'the dropped specialist credential is reported');
assert(r.issues.every(i => ['block', 'warn', 'note', 'info'].includes(i.sev) && i.msg), 'issues shape');

/* ---------- bundle ---------- */
const b = FC.bundle(bp, media, r);
eq(Object.keys(b), ['slug', 'title', 'post_title', 'status', 'post_type', 'template', 'elementor_data', 'page_settings', 'content_html', 'seo', 'schema', 'blueprint', 'summary', 'excerpt', 'featured_media'], 'bundle keys');
assert(b.slug === 'houston-custody-lawyer' && b.post_title === bp.page.h1 && b.status === 'draft' && b.post_type === 'page' && b.featured_media === 11 && b.elementor_data === r.elementor_data && b.schema === r.schema, 'bundle fields');
eq(b.blueprint.media_resolved, { hero: { id: 11, url: media.hero.url, alt: media.hero.alt, kind: 'image', width: 1600, height: 1000 }, ana: { id: 12, url: media.ana.url, alt: 'Ana Rivera', kind: 'image', width: 800, height: 1000 } }, 'media_resolved');
const kitTypes = new Set(['hero', 'answer', 'key_facts', 'rich_text', 'steps', 'features', 'media', 'video', 'gallery', 'testimonials', 'stats', 'faq', 'cta_band', 'form', 'map', 'table', 'authors', 'links', 'html']);
assert(b.blueprint.sections.every(s => kitTypes.has(s.type)), 'the bundle blueprint uses only the types the headless kit renders: ' + b.blueprint.sections.map(s => s.type).join(','));
const att = b.blueprint.sections.find(s => s.id === 'your-attorneys'); assert(att.type === 'html' && att.html.includes('Board Certified, Family Law') && att.html.includes(media.ana.url), 'attorney cards lowered to html');
const dis = b.blueprint.sections.find(s => s.id === 'disclaimer'); assert(dis.type === 'rich_text' && dis.html.includes('This page is attorney advertising'), 'disclaimer lowered to rich_text');
const pr = b.blueprint.sections.find(s => s.id === 'how-a-custody-case-moves'); assert(pr.type === 'steps' && pr.steps[1].text === 'Weeks 2 to 6: The court can set temporary orders while the case is pending.', 'process lowered to steps');
eq(b.blueprint.page.conversion.form.fields.map(f => [f.id, f.type]), [['name', 'text'], ['phone', 'tel'], ['email', 'email'], ['county', 'text'], ['matter', 'text'], ['message', 'textarea']], 'portable form fields for the kit');
assert(b.blueprint.page.conversion.form.consent === consent && b.blueprint.page.conversion.form.fields[5].label === 'Short description. Do not include confidential details.', 'portable consent and hint');
eq(b.content_html, r.html, 'content html unchanged when nothing is a placeholder');
const b2 = FC.bundle(bp, media); eq(Object.keys(b2), Object.keys(b), 'bundle compiles when r is omitted');
/* the portable blueprint compiles again to the same visible page */
const rp = FC.compile(b.blueprint, media); const tp = FC.visibleText(rp.html);
assert(['Board Certified, Family Law, Texas Board of Legal Specialization', 'This page is attorney advertising', 'Weeks 2 to 6: The court', 'Lea esta página en español', 'County seat Houston'].every(x => tp.includes(x)) && (rp.html.match(/<h1[\s>]/g) || []).length === 1 && !rp.lint.some(l => /^BLOCK/.test(l)), 'the portable blueprint compiles again to the same page');
eq((tp.match(/This page is attorney advertising/g) || []).length, 1, 'no second disclaimer after a round trip');

/* ---------- with the CMS layer: pageFor and Publish's placeholder rules ---------- */
const CMS = await load([]); globalThis.CMS = CMS;
const ctxC = vm.createContext({ console, URL, CMS }); vm.runInContext(read('src/04_forge_compile.js') + '\n;globalThis.FC = FORGE_COMPILE;', ctxC);
const pg = ctxC.FC.pageFor(bp, r0, {}, { label: 'Custody' });
assert(pg.slug === 'houston-custody-lawyer' && pg.blueprint.forge_portable === 1 && pg.label === 'Custody' && pg.lint.length === r0.lint.length, 'pageFor builds the portable page');
assert(!/resolved(%20| )at(%20| )deploy/.test(CMS.stripPlaceholders(pg.html)), 'CMS strips the compiler placeholders');
assert(CMS.isPlaceholder(FC.Forge ? new FC.Forge(bp, {}).m('hero').url : ''), 'the placeholder matches CMS.isPlaceholder');

/* ---------- a firm that is not filled yet: placeholders and BLOCK ---------- */
const empty = JSON.parse(JSON.stringify(bp)); empty.site.firm = { attorneys: [{ name: '' }], offices: [{ city: '' }] }; empty.page.author = undefined;
empty.sections = empty.sections.filter(s => s.type !== 'disclaimer' && s.type !== 'attorneys');
const re = FC.compile(empty, media);
assert(re.html.includes('Responsible attorney: [Responsible attorney], Rivera Family Law. Primary practice location: [Office city], Texas.'), 'automatic disclaimer with placeholders');
assert(re.lint.some(l => /^BLOCK: \[Responsible attorney\] is still a placeholder/.test(l)), 'BLOCK on the unfilled responsible attorney');
assert(re.issues.some(i => i.sev === 'info' && /added one at the end/.test(i.msg)), 'automatic disclaimer noted');
const nod = JSON.parse(JSON.stringify(bp)); nod.page.disclaimer = false; nod.sections = nod.sections.filter(s => s.type !== 'disclaimer');
assert(FC.compile(nod, media).lint.some(l => /^BLOCK: no disclaimer/.test(l)), 'BLOCK when the disclaimer is switched off');
const own = JSON.parse(JSON.stringify(bp)); own.sections = own.sections.filter(s => s.type !== 'disclaimer').concat([{ type: 'rich_text', id: 'notice', html: '<p><small>Advertisement.</small></p>' }]);
const ro = FC.compile(own, media); assert(!ro.html.includes('This page is attorney advertising') && ro.lint.some(l => /^BLOCK: the disclaimer does not name the responsible attorney/.test(l)), 'a custom notice must still name the responsible attorney and the location');

/* ---------- Spanish page ---------- */
const es = JSON.parse(JSON.stringify(bp)); es.page.language = 'es-US'; es.page.slug = 'es/abogado-de-custodia-houston'; es.page.h1 = 'Abogada de custodia en Houston, Texas';
es.sections = es.sections.filter(s => s.type !== 'lang_toggle').concat([{ type: 'lang_toggle', url: '/houston-custody-lawyer/' }]); es.sections.find(s => s.type === 'faq').heading = '';
const rs = FC.compile(es, media);
assert(rs.html.includes('Esta página es publicidad de abogados. Abogado responsable: Ana Rivera, Rivera Family Law.') && rs.html.includes('no crea una relación de abogado y cliente'), 'Spanish disclaimer');
assert(rs.html.includes('>Nombre completo</label>') && rs.html.includes('No incluya detalles confidenciales.') && rs.html.includes('Responda STOP') && rs.html.includes('Condado de Harris'), 'Spanish form defaults');
assert(rs.html.includes('hreflang="en" lang="en">Read this page in English</a>') && rs.html.includes('<h2>Preguntas frecuentes</h2>') && rs.html.includes('Board Certified, Family Law, Texas Board of Legal Specialization'), 'Spanish toggle and headings; the TBLS line keeps its exact form');
assert(!/[‐-―−]|(?<=\w)-(?=\w)|\s-\s/.test(FC.visibleText(rs.html)), 'Spanish page in house style');

/* ---------- attorney page and guide archetypes ---------- */
const ap = JSON.parse(JSON.stringify(bp)); ap.page.archetype = 'attorney'; ap.page.attorney = { name: 'Ana Rivera' }; ap.page.slug = 'attorneys/ana-rivera';
const ga = FC.compile(ap, media).schema['@graph']; const prof = ga.find(n => n['@type'] === 'ProfilePage');
assert(prof && prof.mainEntity['@id'] === SITE + '/#attorney-ana-rivera' && !ga.some(n => n['@type'] === 'WebPage'), 'attorney page is a ProfilePage about the Person');
const gd = JSON.parse(JSON.stringify(bp)); gd.page.archetype = 'guide'; const gg = FC.compile(gd, media).schema;
const art = gg['@graph'].find(n => n['@type'] === 'Article'); assert(art && art.headline === bp.page.h1 && art.author['@id'] === SITE + '/#attorney-ana-rivera' && art.publisher['@id'] === SITE + '/#organization' && art.datePublished === '2026-09-30' && art.image === media.hero.url, 'guide is an Article');
eq(FC.validateSchema(gg), [], 'guide schema valid');
eq(FC.validateSchema({ '@graph': [{ '@type': 'LegalService', name: 'X', url: 'u', telephone: 't', address: { '@type': 'PostalAddress', addressLocality: 'Houston', addressRegion: 'TX' }, colour: 'red' }, { '@type': 'HVACBusiness', name: 'Y' }] }), ['@graph[0]: LegalService has no property colour', '@graph[1]: unknown type HVACBusiness', '@graph[1]: HVACBusiness is not a law firm type'], 'validateSchema catches unknown properties and trade types');

/* ---------- app globals: LINE_META and CI resolve keys and FIPS ---------- */
const FC2 = sandbox('var LINE_META = { div_k: { name: "Divorce with children" }, ivd: { name: "Child support and paternity (IV-D)" } }; var CI = { "48201": { name: "Harris" }, "48157": { name: "Fort Bend" } };');
const g2 = JSON.parse(JSON.stringify(bp)); g2.site.firm = Object.assign({}, firm, { county_names: undefined, city_names: undefined, practice_areas: undefined, counties: ['48201', '48157'], lines: ['div_k', 'ivd'] });
const f2 = FC2.defaultForm(g2); eq(f2.fields.find(f => f.id === 'county').options, ['Harris County', 'Fort Bend County', 'Another Texas county'], 'counties from CI'); eq(f2.fields.find(f => f.id === 'matter').options, ['Divorce with children', 'Child support and paternity', 'Something else'], 'matters from LINE_META');
/* in the app, a blueprint without site.firm reads the firm profile (FIRM.get()) */
const FC3 = sandbox('var FIRM = { get: () => (' + JSON.stringify(Object.assign({}, firm, { colors: { primary: '#112233' } })) + ') };');
const nf = JSON.parse(JSON.stringify(bp)); delete nf.site.firm; delete nf.site.brand.primary; const r3 = FC3.compile(nf, media);
assert(r3.schema['@graph'][0].address.addressLocality === 'Houston' && r3.html.includes('Responsible attorney: Ana Rivera') && r3.elementor_data[0].settings.background_color === undefined && FC3.previewPage(nf, media).includes('--p:#112233'), 'FIRM.get() fills the firm and its colors when the blueprint has none');
assert(!FC.compile(nf, media).html.includes('Responsible attorney: Ana Rivera'), 'outside the app nothing is invented');
eq(FC.defaultForm({ page: {}, site: {} }).fields.map(f => f.type), ['text', 'tel', 'email', 'text', 'text', 'textarea'], 'no firm: county and matter fall back to text inputs');

/* ---------- small helpers ---------- */
eq(FC.tblsLine('family law'), 'Board Certified, Family Law, Texas Board of Legal Specialization', 'tblsLine from an area');
eq(FC.tblsLine('Board Certified, Family Law, Texas Board of Legal Specialization'), 'Board Certified, Family Law, Texas Board of Legal Specialization', 'tblsLine idempotent');
eq(FC.tblsLine('Family law specialist'), 'Board Certified, Family Law, Texas Board of Legal Specialization', 'tblsLine strips specialist');
eq(FC.tblsLine(''), '', 'no area, no line');
eq(FC.slug('Abogado de Custodia en Español'), 'abogado-de-custodia-en-espanol', 'slug folds accents');
assert(FC.previewPage(bp, media).startsWith('<!DOCTYPE html><html lang="en">'), 'previewPage(bp, media)');
const unk = JSON.parse(JSON.stringify(bp)); unk.sections.push({ type: 'carousel' }); assert(FC.compile(unk, media).lint.includes('unknown section type carousel skipped'), 'unknown type skipped with a warning');
const old = { forge: '1', site: { url: 'https://example.com', brand: { name: 'Old' } }, page: { slug: 'x', h1: 'X', title: 'X', cta: { primary: { label: 'Go', url: '#contact' } }, conversion: { form: { fields: [{ id: 'name', label: 'Name', type: 'text', required: true }], consent: 'By submitting you agree to be contacted.' } } }, media: {}, sections: [{ type: 'hero' }, { type: 'steps', steps: [{ title: 'A', text: 'B' }] }, { type: 'form' }] };
const ro2 = FC.compile(old, {}); assert(ro2.html.includes('name="name" required') && ro2.lint.some(l => /consent does not say/.test(l)) && ro2.html.includes('<h2>How it works</h2>'), 'a Thermal Atlas style blueprint still compiles');

/* ---------- the bridge plugin keeps every route, field and setting the shared adapters use ---------- */
const PHP = (() => { const c = vm.createContext({}); vm.runInContext(read('src/05_forge_bridge_raw.js') + '\n;globalThis.P = FORGE_BRIDGE_PHP;', c); return c.P; })();
assert(PHP.startsWith('<?php') && PHP.includes('Plugin Name: Severance FORGE Bridge') && !/HVAC|TDLR|contractor/i.test(PHP), 'plugin header and law firm wording');
assert(PHP.includes("const NS = 'forge/v1';") && PHP.includes("const OPT = 'forge_bridge_settings';"), 'namespace and option name');
const wpSrc = read('src/cms/10_wordpress.js'), kitSrc = read('src/cms/19_headless_kit.js');
const ver = (wpSrc.match(/const BRIDGE_VER = '([^']+)'/) || [])[1]; assert(ver && PHP.includes(`const VER = '${ver}';`) && PHP.includes(` * Version: ${ver}`), 'bridge version matches the adapter (' + ver + ')');
const routes = new Set();
for (const m of wpSrc.matchAll(/FORGE_NS \+ '\/([a-z/]+)/g)) routes.add(m[1]);
for (const m of wpSrc.matchAll(/\$\{FORGE_NS\}\/([a-z/]+)/g)) routes.add(m[1]);
for (const m of kitSrc.matchAll(/forge\/v1\/([a-z/]+)/g)) routes.add(m[1]);
for (const x of ['status', 'import', 'template', 'settings', 'media/find', 'urls', 'indexnow', 'lead', 'nav']) assert(routes.has(x), 'route extraction found ' + x);
for (const x of routes) assert(PHP.includes(`register_rest_route( self::NS, '/${x}'`), 'bridge registers /' + x);
assert(/register_rest_route\( self::NS, '\/settings', \[ \[ 'methods' => 'GET'[^\n]*'methods' => 'POST'/.test(PHP), 'settings GET and POST');
assert(PHP.includes("register_rest_route( self::NS, '/lead', [ 'methods' => 'POST'") && PHP.includes("register_rest_route( self::NS, '/nav', [ 'methods' => 'GET'"), 'public lead and nav routes');
assert(/register_rest_field\( \$pt, 'forge'/.test(PHP) && ['blueprint', 'schema', 'seo', 'summary'].every(k => PHP.includes(`'${k}' `)), 'the forge REST field the kit reads (' + (kitSrc.match(/forge\?: \{[^}]+\}/) || [''])[0] + ')');
const statusKeys = [...wpSrc.slice(wpSrc.indexOf('Object.assign(meta, { bridgeVersion')).split('\n')[0].matchAll(/\bs\.([a-z_]+)/g)].map(m => m[1]);
assert(statusKeys.length > 10, 'status keys extracted'); for (const k of new Set(statusKeys)) assert(new RegExp(`'${k}'\\s*=>`).test(PHP), 'status returns ' + k);
const bfSrc = wpSrc.slice(wpSrc.indexOf('function bundleFor'), wpSrc.indexOf('async function importBundle'));
let bfRet = bfSrc.slice(bfSrc.indexOf('return {')); while (/\([^()]*\)/.test(bfRet)) bfRet = bfRet.replace(/\([^()]*\)/g, '');
const bundleKeys = [...bfRet.matchAll(/[{,]\s*(\w+)\s*(?::|(?=[,}]))/g)].map(m => m[1]);
assert(bundleKeys.includes('status'), 'shorthand keys extracted');
assert(bundleKeys.includes('content_html') && bundleKeys.includes('elementor_data'), 'bundle keys extracted');
for (const k of bundleKeys.filter(k => k !== 'title')) assert(PHP.includes(`$b['${k}']`) || PHP.includes(`'${k}' => '_forge_`), 'the import route reads ' + k);
for (const k of Object.keys(b).filter(k => k !== 'title')) assert(PHP.includes(`$b['${k}']`) || PHP.includes(`'${k}' => '_forge_`), 'the import route reads bundle() key ' + k);
assert(PHP.includes("$b['blueprint']['media_resolved']") && PHP.includes("$s['_forge_media']"), 'import fills marked media slots from media_resolved');
for (const k of ['revalidate_url', 'revalidate_secret', 'cors_origins', 'indexnow_key', 'lead_email', 'llms_intro']) assert(PHP.includes(`'${k}' => `) && PHP.includes(`'${k}'`), 'setting ' + k);
for (const k of ['forge_caps', 'forge_bad', 'forge_consent', 'forge_rate', 'forge_noel', 'forge_key']) assert(PHP.includes(`'${k}'`), 'error code ' + k);
assert(PHP.includes("'/llms.txt' !== $req") && PHP.includes("forge_llms_txt") && PHP.includes('Attorney advertising.'), 'llms.txt with the advertising note');
assert(PHP.includes("'post_type' => 'forge_lead', 'post_status' => 'private'") && !/\$ip\s*[.;]\s*"|IP: \$ip/.test(PHP) && PHP.includes('wp_add_privacy_policy_content') && PHP.includes('wp_privacy_personal_data_erasers') && PHP.includes('lead_retention_days'), 'private inquiries without IP, privacy note, export and erase, retention');
assert(!/[—–]/.test(PHP), 'no em or en dash in the plugin');
const phpBin = spawnSync('php', ['-v'], { encoding: 'utf8' });
if (phpBin.status === 0) { const tmp = path.join(fs.mkdtempSync(path.join((await import('node:os')).tmpdir(), 'forge-')), 'forge-bridge.php'); fs.writeFileSync(tmp, PHP); const lint = spawnSync('php', ['-l', tmp], { encoding: 'utf8' }); assert(lint.status === 0, 'php -l: ' + lint.stdout + lint.stderr); console.log('php -l ok'); }
else console.log('php not installed; php -l skipped');

console.log('forge_compile ok');
