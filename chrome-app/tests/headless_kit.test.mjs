import { load } from './lib/load.mjs';
import { assert, eq } from './lib/mock.mjs';
const CMS = await load(['src/cms/19_headless_kit.js']);
const K = globalThis.HEADLESS_KIT; assert(K && typeof K.files === 'function' && typeof K.zipEntries === 'function' && typeof K.readme === 'function' && K.version, 'HEADLESS_KIT global');
const PH = ['__WP_HOST__', '__SITE_URL__', '__SITE_NAME__', '__CSS__', '__CTA_URL__', '__CTA_LABEL__', '__FOOTER_LINE__'];
/* every source file from forge_headless.py is present */
const EXPECT = ['package.json', 'tsconfig.json', 'next.config.ts', '.env.example', 'lib/wp.ts', 'app/layout.tsx', 'app/globals.css', 'app/[[...slug]]/page.tsx', 'components/Nav.tsx', 'components/StickyCta.tsx', 'components/Video.tsx', 'components/LeadForm.tsx', 'components/Blocks.tsx', 'app/api/lead/route.ts', 'app/api/revalidate/route.ts', 'app/sitemap.ts', 'app/robots.ts', 'app/llms.txt/route.ts', 'app/not-found.tsx', 'README.md'];
eq(K.paths, EXPECT, 'file list in source order');
/* build with the test site */
const f = K.files({ wpUrl: 'https://cms.example.com', siteUrl: 'https://www.example.com' });
eq(Object.keys(f).length, 20, '20 files');
const pkg = JSON.parse(f['package.json']); assert(pkg.name === 'forge-headless' && /^\^15\./.test(pkg.dependencies.next) && pkg.dependencies.react && pkg.scripts.build === 'next build', 'package.json parses: ' + f['package.json'].slice(0, 80));
for (const [p, txt] of Object.entries(f)) for (const ph of PH) assert(!txt.includes(ph), `${ph} left in ${p}`);
assert(f['app/[[...slug]]/page.tsx'] && f['app/[[...slug]]/page.tsx'].includes('export const revalidate = 600') && f['app/[[...slug]]/page.tsx'].includes('generateMetadata'), 'dynamic route file');
assert(f['app/api/revalidate/route.ts'].includes('process.env.REVALIDATE_SECRET') && f['app/api/revalidate/route.ts'].includes('revalidatePath(path)') && f['app/api/revalidate/route.ts'].includes('status: 401'), 'revalidate route reads REVALIDATE_SECRET');
/* placeholders replaced the way the Python main() does: host only for WP, full site url, defaults for name, cta, footer */
assert(f['.env.example'].includes('WP_URL=https://cms.example.com\n') && f['.env.example'].includes('NEXT_PUBLIC_SITE_URL=https://www.example.com\n'), '.env.example');
assert(f['next.config.ts'].includes('"https://cms.example.com"') && f['lib/wp.ts'].includes('"https://cms.example.com"') && f['lib/wp.ts'].includes('"https://www.example.com"'), 'WP host and site url');
assert(f['app/layout.tsx'].includes('default: "Site"') && f['app/layout.tsx'].includes('Site. All rights reserved.'), 'default site name and footer');
assert(f['components/Nav.tsx'].includes('href="/contact/">Contact</a>'), 'default cta');
assert(f['app/globals.css'].includes('--forge-p:#13243a') && f['app/globals.css'].includes('--p:var(--forge-p)') && f['app/globals.css'].includes('.forge-nav{'), 'default css = CMS.brandCss + base, then the nav css');
/* the TypeScript sources survived the template literal port: regex escapes, template literals, the < escape */
assert(f['lib/wp.ts'].includes('.replace(/\\/$/, "")') && f['lib/wp.ts'].includes('`${WP}/wp-json/${path.replace(/^\\//, "")}`'), 'lib/wp.ts escapes: ' + f['lib/wp.ts'].split('\n')[0]);
assert(f['app/[[...slug]]/page.tsx'].includes('.replace(/</g, "\\\\u003c")'), 'JSON-LD escape kept');
assert(f['components/StickyCta.tsx'].includes('/[^\\d+]/g') && f['components/Video.tsx'].includes('/(?:v=|youtu\\.be\\/|embed\\/)([\\w-]{6,})/'), 'regex escapes kept');
assert(f['app/llms.txt/route.ts'].includes('`# Site\\n\\n## Pages\\n\\n`'), 'llms.txt template');
assert(f['components/Blocks.tsx'].includes('case "hero":') && f['components/Blocks.tsx'].includes('<LeadForm page={pg.slug}'), 'Blocks.tsx');
/* options: brand, site object, custom css, cta, host from a url with a path and trailing slash */
const g = K.files({ wpUrl: 'https://cms.test.co/wp/', site: { url: 'https://test.co/', name: 'Fallback', footer_line: 'Licensed in Texas.' }, brand: { name: 'Test Co', primary: '#112233', accent: '#445566' }, cta: { url: '/book/', label: 'Book now' } });
assert(g['next.config.ts'].includes('"https://cms.test.co"') && g['lib/wp.ts'].includes('"https://test.co"'), 'host from a url with a path, site url without the slash');
assert(g['app/layout.tsx'].includes('default: "Test Co"') && g['app/layout.tsx'].includes('Test Co. Licensed in Texas.'), 'brand name and footer line');
assert(g['components/Nav.tsx'].includes('href="/book/">Book now</a>') && g['components/Nav.tsx'].includes('className="brand">Test Co</Link>'), 'cta and brand in the nav');
assert(g['app/globals.css'].includes('--forge-p:#112233') && g['app/globals.css'].includes('--forge-a:#445566'), 'brand colours in the css');
const h = K.files({ wpUrl: 'https://cms.example.com', siteUrl: 'https://www.example.com', css: 'body{color:red}' }); assert(h['app/globals.css'].startsWith('body{color:red}\n.forge-nav{'), 'custom css');
const d = K.files(); assert(d['next.config.ts'].includes('"https://cms.example.com"') && d['lib/wp.ts'].includes('"https://www.example.com"'), 'defaults with no options');
/* zipEntries: one entry per file under headless/, readme() matches */
const z = K.zipEntries({ wpUrl: 'https://cms.example.com', siteUrl: 'https://www.example.com' });
eq(z.length, 20, 'one zip entry per file'); eq(z.map(e => e.name), EXPECT.map(p => 'headless/' + p), 'zip names'); assert(z.every(e => typeof e.data === 'string' && e.data.length > 0), 'zip data');
eq(z.find(e => e.name === 'headless/package.json').data, f['package.json'], 'zip data equals files()');
const r = K.readme({ wpUrl: 'https://cms.example.com', siteUrl: 'https://www.example.com' }); assert(r.startsWith('# FORGE headless front end') && r === f['README.md'] && r.includes('/api/revalidate'), 'readme');
/* the raw sources still carry the placeholders */
assert(K.raw('.env.example').includes('__WP_HOST__') && K.raw('app/globals.css').startsWith('__CSS__'), 'raw placeholders');
console.log('headless_kit ok');
