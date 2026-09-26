### forge/forge_headless.py

```python
#!/usr/bin/env python3
"""FORGE headless generator — writes a Next.js 15 (App Router, TypeScript) front end that renders FORGE blueprints
from WordPress (REST + the FORGE bridge), with ISR, on-demand revalidation, JSON-LD, sitemap, robots, llms.txt and a lead form.
Usage: python3 forge_headless.py blueprint.json out_dir [--wp https://cms.example.com] [--site https://www.example.com]
The blueprint supplies the brand tokens (site.brand) and the site URL; WP_URL is read from --wp or the blueprint's site.cms.
"""
import json, os, sys, re
from forge_compile import PREVIEW_CSS, hexmix

def write(root, rel, txt):
    p = os.path.join(root, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w', encoding='utf-8').write(txt)

FILES = {}
FILES['package.json'] = '''{
  "name": "forge-headless",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start", "lint": "next lint" },
  "dependencies": { "next": "^15.5.0", "react": "^19.1.0", "react-dom": "^19.1.0" },
  "devDependencies": { "@types/node": "^22.0.0", "@types/react": "^19.1.0", "@types/react-dom": "^19.1.0", "typescript": "^5.6.0" }
}
'''
FILES['tsconfig.json'] = '''{
  "compilerOptions": { "target": "ES2022", "lib": ["dom", "dom.iterable", "esnext"], "allowJs": true, "skipLibCheck": true, "strict": true, "noEmit": true, "esModuleInterop": true, "module": "esnext", "moduleResolution": "bundler", "resolveJsonModule": true, "isolatedModules": true, "jsx": "preserve", "incremental": true, "plugins": [{ "name": "next" }], "paths": { "@/*": ["./*"] } },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
'''
FILES['next.config.ts'] = '''import type { NextConfig } from "next";
const wp = new URL(process.env.WP_URL || "https://__WP_HOST__");
const config: NextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: wp.protocol.replace(":", "") as "http" | "https", hostname: wp.hostname }], formats: ["image/avif", "image/webp"] },
  async headers() { return [{ source: "/(.*)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }]; },
};
export default config;
'''
FILES['.env.example'] = '''WP_URL=https://__WP_HOST__
NEXT_PUBLIC_SITE_URL=__SITE_URL__
REVALIDATE_SECRET=change-me
WP_HOME_SLUG=home
'''
FILES['lib/wp.ts'] = '''export const WP = (process.env.WP_URL || "https://__WP_HOST__").replace(/\\/$/, "");
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "__SITE_URL__").replace(/\\/$/, "");
export const HOME_SLUG = process.env.WP_HOME_SLUG || "home";

export type Media = { id: number; url: string; alt?: string; kind?: "image" | "video"; width?: number; height?: number; mime?: string };
export type Section = Record<string, any> & { type: string; id?: string; style?: string; width?: string };
export type Blueprint = { forge: string; site: any; page: any; media?: Record<string, any>; media_resolved?: Record<string, Media>; sections: Section[] };
export type WpPage = { id: number; slug: string; link: string; modified_gmt: string; title: { rendered: string }; content: { rendered: string }; excerpt?: { rendered: string }; forge?: { blueprint: Blueprint | null; schema: any; seo: any; summary: string } };

export async function wpFetch<T>(path: string, revalidate = 600, tags: string[] = []): Promise<T> {
  const r = await fetch(`${WP}/wp-json/${path.replace(/^\\//, "")}`, { next: { revalidate, tags }, headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`WP ${r.status} ${path}`);
  return r.json() as Promise<T>;
}
const FIELDS = "id,slug,link,modified_gmt,title,content,excerpt,forge";
export async function getPage(slug: string, type: "pages" | "posts" = "pages"): Promise<WpPage | null> {
  const rows = await wpFetch<WpPage[]>(`wp/v2/${type}?slug=${encodeURIComponent(slug)}&_fields=${FIELDS}`, 600, [`${type}:${slug}`]);
  return rows[0] || null;
}
export async function resolve(path: string[]): Promise<WpPage | null> {
  const slug = path.length ? path[path.length - 1] : HOME_SLUG;
  return (await getPage(slug, "pages")) || (await getPage(slug, "posts"));
}
export async function getNav(location = "primary"): Promise<{ title: string; url: string; parent: number; id: number }[]> {
  try { const j = await wpFetch<{ items: any[] }>(`forge/v1/nav?location=${location}`, 3600, ["nav"]); return j.items || []; } catch { return []; }
}
export async function listAll(type: "pages" | "posts"): Promise<{ slug: string; modified_gmt: string; link: string }[]> {
  const out: any[] = [];
  for (let p = 1; p < 20; p++) {
    let rows: any[] = [];
    try { rows = await wpFetch<any[]>(`wp/v2/${type}?per_page=100&page=${p}&_fields=slug,modified_gmt,link&status=publish`, 3600, [type]); } catch { break; }
    out.push(...rows); if (rows.length < 100) break;
  }
  return out;
}
export const toLocal = (link: string) => { try { const u = new URL(link); return u.pathname.replace(/\\/+$/, "") || "/"; } catch { return link; } };
'''
FILES['app/layout.tsx'] = '''import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { SITE } from "@/lib/wp";
export const metadata: Metadata = { metadataBase: new URL(SITE), title: { default: "__SITE_NAME__", template: "%s" } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <footer className="forge-footer"><div className="forge-inner"><p>© {new Date().getFullYear()} __SITE_NAME__. __FOOTER_LINE__</p></div></footer>
      </body>
    </html>
  );
}
'''
FILES['app/globals.css'] = '__CSS__\n.forge-nav{display:flex;gap:18px;align-items:center;padding:14px 20px;max-width:1140px;margin:0 auto;flex-wrap:wrap}.forge-nav a{color:#1b1b1a;text-decoration:none;font-weight:600}.forge-nav .brand{font-weight:800;margin-right:auto;color:var(--p)}.forge-footer{padding:32px 20px;background:var(--d);color:#ddd;font-size:14px}.forge-video button{position:absolute;inset:0;width:100%;height:100%;border:0;background:rgba(0,0,0,.35);color:#fff;font-size:20px;font-weight:700;cursor:pointer;border-radius:14px}\n'
FILES['app/[[...slug]]/page.tsx'] = '''import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolve, SITE, toLocal } from "@/lib/wp";
import Blocks from "@/components/Blocks";
import StickyCta from "@/components/StickyCta";
export const revalidate = 600;
type Props = { params: Promise<{ slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug = [] } = await params; const page = await resolve(slug);
  if (!page) return { title: "Not found" };
  const seo = page.forge?.seo || {}; const url = `${SITE}${toLocal(page.link)}`;
  return {
    title: seo.title || page.title.rendered, description: seo.description || undefined,
    alternates: { canonical: seo.canonical || url },
    robots: seo.noindex ? { index: false, follow: true } : undefined,
    openGraph: { title: seo.title || page.title.rendered, description: seo.description || undefined, url, images: seo.og_image ? [{ url: seo.og_image }] : undefined, type: "website" },
  };
}
export default async function Page({ params }: Props) {
  const { slug = [] } = await params; const page = await resolve(slug);
  if (!page) notFound();
  const bp = page.forge?.blueprint; const schema = page.forge?.schema;
  return (
    <main>
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\\\u003c") }} />}
      {bp ? <Blocks bp={bp} /> : <article className="forge-section"><div className="forge-inner forge-narrow"><h1 dangerouslySetInnerHTML={{ __html: page.title.rendered }} /><div dangerouslySetInnerHTML={{ __html: page.content.rendered }} /></div></article>}
      {bp?.page?.conversion?.sticky_mobile_bar !== false && bp?.page?.cta?.primary && <StickyCta cta={bp.page.cta.primary} />}
    </main>
  );
}
'''
FILES['components/Nav.tsx'] = '''import Link from "next/link";
import { getNav, toLocal } from "@/lib/wp";
export default async function Nav() {
  const items = (await getNav()).filter((i) => !i.parent);
  return (
    <nav className="forge-nav" aria-label="Primary">
      <Link href="/" className="brand">__SITE_NAME__</Link>
      {items.map((i) => <Link key={i.id} href={toLocal(i.url)}>{i.title}</Link>)}
      <a className="forge-btn forge-btn-primary" href="__CTA_URL__">__CTA_LABEL__</a>
    </nav>
  );
}
'''
FILES['components/StickyCta.tsx'] = '''export default function StickyCta({ cta }: { cta: { label?: string; url?: string; phone?: string } }) {
  const tel = cta.phone ? "tel:" + cta.phone.replace(/[^\\d+]/g, "") : null;
  return (
    <div className="forge-sticky">
      {tel && <a className="forge-sticky-call" href={tel}>Call now</a>}
      <a className="forge-sticky-cta" href={cta.url || "#contact"}>{cta.label || "Get started"}</a>
    </div>
  );
}
'''
FILES['components/Video.tsx'] = '''"use client";
import { useState } from "react";
export default function Video({ url, title, poster }: { url: string; title: string; poster?: string }) {
  const [on, setOn] = useState(false);
  const yt = url.match(/(?:v=|youtu\\.be\\/|embed\\/)([\\w-]{6,})/);
  if (yt) {
    const id = yt[1]; const img = poster || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    return (
      <div className="forge-video">
        {on ? <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`} title={title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            : <><img src={img} alt={title} loading="lazy" decoding="async" /><button type="button" onClick={() => setOn(true)} aria-label={`Play: ${title}`}>▶ Play</button></>}
      </div>
    );
  }
  return <video controls preload="metadata" playsInline poster={poster}><source src={url} />{title}</video>;
}
'''
FILES['components/LeadForm.tsx'] = '''"use client";
import { useState } from "react";
type Field = { id: string; label: string; type: string; required?: boolean };
export default function LeadForm({ page, fields, consent, button }: { page: string; fields?: Field[]; consent?: string; button?: string }) {
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const fs: Field[] = fields && fields.length ? fields : [{ id: "name", label: "Full name", type: "text", required: true }, { id: "phone", label: "Phone", type: "tel", required: true }, { id: "email", label: "Email", type: "email", required: true }, { id: "message", label: "Tell us what happened", type: "textarea" }];
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); const d: Record<string, string> = {};
    new FormData(e.currentTarget).forEach((v, k) => { d[k] = String(v); });
    try { const r = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }); const j = await r.json(); setMsg(j.message || "Thanks — we will be in touch."); if (j.ok) { e.currentTarget?.reset?.(); (window as any).dataLayer?.push({ event: "forge_lead", page }); } }
    catch { setMsg("Something went wrong — please call us."); }
    setBusy(false);
  }
  return (
    <form className="forge-form" onSubmit={submit}>
      <input type="hidden" name="page" value={page} /><input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
      {fs.map((f) => <label key={f.id}>{f.label}{f.type === "textarea" ? <textarea name={f.id} required={!!f.required} /> : <input type={f.type} name={f.id} required={!!f.required} />}</label>)}
      <label className="forge-consent"><input type="checkbox" name="consent" value="yes" required /> {consent || "By submitting, you agree to be contacted by phone, text or email about your request. Message and data rates may apply. Submitting does not create a client relationship."}</label>
      <button type="submit" className="forge-btn forge-btn-primary" disabled={busy}>{button || "Send my request"}</button>
      <p className="forge-form-msg" aria-live="polite">{msg}</p>
    </form>
  );
}
'''
FILES['components/Blocks.tsx'] = '''import Image from "next/image";
import type { Blueprint, Media, Section } from "@/lib/wp";
import Video from "@/components/Video";
import LeadForm from "@/components/LeadForm";

const tel = (s: string) => "tel:" + s.replace(/[^\\d+]/g, "");
function Ctas({ bp, keys, center }: { bp: Blueprint; keys?: string[]; center?: boolean }) {
  const cta = bp.page.cta || {}; const out: React.ReactNode[] = [];
  (keys || ["primary"]).forEach((k) => { const c = cta[k]; if (!c) return;
    if (c.url) out.push(<a key={k} className={`forge-btn forge-btn-${k}`} href={c.url}>{c.label}</a>);
    if (c.phone) out.push(<a key={k + "p"} className="forge-btn forge-btn-secondary" href={tel(c.phone)}>{c.phone_label || `Call ${c.phone}`}</a>); });
  return out.length ? <p className="forge-ctas" style={center ? { textAlign: "center" } : undefined}>{out}</p> : null;
}
function Pic({ m, priority, sizes }: { m: Media; priority?: boolean; sizes?: string }) {
  if (m.kind === "video") return <Video url={m.url} title={m.alt || "Video"} />;
  if (m.width && m.height && /^https?:/.test(m.url)) return <Image src={m.url} alt={m.alt || ""} width={m.width} height={m.height} priority={!!priority} sizes={sizes || "(max-width: 767px) 100vw, 50vw"} style={{ width: "100%", height: "auto" }} />;
  return <img src={m.url} alt={m.alt || ""} loading={priority ? "eager" : "lazy"} decoding="async" style={{ width: "100%", height: "auto" }} />;
}
export default function Blocks({ bp }: { bp: Blueprint }) {
  const M = (k?: string): Media | null => (k && bp.media_resolved && bp.media_resolved[k]) || null;
  const pg = bp.page;
  return (<>{bp.sections.map((s: Section, i) => {
    const id = s.id || (s.heading || s.type).toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const cls = `forge-section forge-sec-${s.type} forge-${s.style || (["answer", "key_facts", "testimonials", "form"].includes(s.type) ? "tint" : ["stats", "cta_band"].includes(s.type) ? "brand" : "light")}`;
    const inner = `forge-inner${s.width === "narrow" || ["answer", "rich_text", "steps", "video", "faq", "form", "authors", "links"].includes(s.type) ? " forge-narrow" : ""}`;
    let body: React.ReactNode = null;
    switch (s.type) {
      case "hero": { const m = M(s.media); const left = (<>{s.eyebrow && <p className="forge-eyebrow">{s.eyebrow}</p>}<h1>{s.h1 || pg.h1}</h1>{s.lede && <p className="forge-lede">{s.lede}</p>}<Ctas bp={bp} keys={s.cta} />{s.trust !== false && pg.conversion?.trust && <ul className="forge-trust">{pg.conversion.trust.map((t: string) => <li key={t}>{t}</li>)}</ul>}</>);
        body = m ? <div className="forge-split"><div>{left}</div><div><Pic m={m} priority /></div></div> : left; break; }
      case "answer": body = <><h2>{s.heading || "The short answer"}</h2><p className="forge-answer"><strong>{s.body}</strong></p></>; break;
      case "key_facts": body = <>{s.heading && <h2>{s.heading}</h2>}<dl className="forge-facts">{s.items.map((it: any, j: number) => <div key={j}><dt>{it.value}</dt><dd>{it.label}{it.source && <small> ({it.source})</small>}</dd></div>)}</dl></>; break;
      case "rich_text": body = <>{s.heading && <h2>{s.heading}</h2>}<div dangerouslySetInnerHTML={{ __html: s.html }} /></>; break;
      case "steps": body = <><h2>{s.heading || "How it works"}</h2><ol className="forge-steps">{s.steps.map((st: any, j: number) => <li key={j}><h3>{st.title}</h3><p>{st.text}</p></li>)}</ol></>; break;
      case "features": body = <><h2>{s.heading}</h2>{s.text && <p>{s.text}</p>}<div className="forge-grid">{s.items.map((it: any, j: number) => <div className="forge-card" key={j}><h3>{it.title}</h3><p>{it.text}</p></div>)}</div></>; break;
      case "media": { const m = M(s.media); body = <>{s.heading && <h2>{s.heading}</h2>}{m && <Pic m={m} sizes="(max-width: 1140px) 100vw, 1140px" />}{s.caption && <p><small>{s.caption}</small></p>}</>; break; }
      case "video": { const m = M(s.media); const p = M(s.poster); body = <>{s.heading && <h2>{s.heading}</h2>}{m && <Video url={m.url} title={m.alt || s.heading || "Video"} poster={p?.url} />}{s.transcript && <details><summary>Video transcript</summary><p>{s.transcript}</p></details>}</>; break; }
      case "gallery": body = <>{s.heading && <h2>{s.heading}</h2>}<div className="forge-grid">{(s.media as string[]).map((k) => { const m = M(k); return m ? <Pic key={k} m={m} sizes="(max-width: 767px) 50vw, 33vw" /> : null; })}</div></>; break;
      case "testimonials": body = <><h2>{s.heading || "What clients say"}</h2><div className="forge-grid">{s.items.map((t: any, j: number) => <blockquote className="forge-card" key={j}><p>{t.quote}</p><footer>{t.name}{t.role && ` — ${t.role}`}{t.rating && ` · ${t.rating}/5`}</footer></blockquote>)}</div></>; break;
      case "stats": body = <>{s.heading && <h2>{s.heading}</h2>}<dl className="forge-facts forge-stats">{s.items.map((it: any, j: number) => <div key={j}><dt>{it.value}</dt><dd>{it.label}</dd></div>)}</dl></>; break;
      case "faq": body = <><h2>{s.heading || "Frequently asked questions"}</h2>{s.items.map((q: any, j: number) => <details className="forge-faq" key={j}><summary><h3>{q.q}</h3></summary><p>{q.a}</p></details>)}</>; break;
      case "cta_band": body = <><h2>{s.heading}</h2>{s.text && <p>{s.text}</p>}<Ctas bp={bp} keys={s.cta} center /></>; break;
      case "form": { const f = pg.conversion?.form || {}; body = <>{s.heading && <h2>{s.heading}</h2>}{s.text && <p>{s.text}</p>}{f.shortcode ? <p>Form: {f.shortcode} (render the WordPress form via its plugin REST API or embed)</p> : <LeadForm page={pg.slug} fields={f.fields} consent={f.consent} button={f.button} />}</>; break; }
      case "map": body = <>{s.heading && <h2>{s.heading}</h2>}<p className="forge-address">{s.address}</p><iframe title="Map" loading="lazy" style={{ width: "100%", height: 360, border: 0, borderRadius: 14 }} src={`https://www.google.com/maps?q=${encodeURIComponent(s.address)}&output=embed`} />{s.text && <p>{s.text}</p>}</>; break;
      case "table": body = <>{s.heading && <h2>{s.heading}</h2>}<div className="forge-tablewrap"><table className="forge-table"><thead><tr>{s.columns.map((c: string) => <th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{s.rows.map((r: string[], j: number) => <tr key={j}>{r.map((v, k) => <td key={k}>{v}</td>)}</tr>)}</tbody></table></div></>; break;
      case "authors": { const a = pg.author || {}; const m = M(a.media); body = <><h2>{s.heading || "Reviewed by"}</h2><div className="forge-split" style={{ gridTemplateColumns: m ? "120px 1fr" : "1fr" }}>{m && <Pic m={m} sizes="120px" />}<p className="forge-author"><strong>{a.name}</strong>{a.credentials && `, ${a.credentials}`}<br />{a.bio || s.text}{a.url && <> <a href={a.url}>Profile</a></>}</p></div></>; break; }
      case "links": { const items = s.items || pg.internal_links || []; body = <><h2>{s.heading || "Related"}</h2><ul className="forge-links">{items.map((l: any) => <li key={l.url}><a href={l.url}>{l.anchor}</a></li>)}</ul></>; break; }
      case "html": body = <div dangerouslySetInnerHTML={{ __html: s.html }} />; break;
      default: body = null;
    }
    return <section id={id} className={cls} key={i}><div className={inner}>{body}</div></section>;
  })}</>);
}
'''
FILES['app/api/lead/route.ts'] = '''import { NextResponse } from "next/server";
import { WP } from "@/lib/wp";
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${WP}/wp-json/forge/v1/lead`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, message: "Upstream error" }));
  return NextResponse.json(j, { status: r.ok ? 200 : r.status });
}
'''
FILES['app/api/revalidate/route.ts'] = '''import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!process.env.REVALIDATE_SECRET || b.secret !== process.env.REVALIDATE_SECRET) return NextResponse.json({ ok: false }, { status: 401 });
  const path = typeof b.path === "string" && b.path.startsWith("/") ? b.path.replace(/\\/+$/, "") || "/" : "/";
  revalidatePath(path); revalidateTag("pages"); revalidateTag("posts"); revalidateTag("nav");
  return NextResponse.json({ ok: true, path, at: Date.now() });
}
'''
FILES['app/sitemap.ts'] = '''import type { MetadataRoute } from "next";
import { listAll, SITE, toLocal } from "@/lib/wp";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, posts] = await Promise.all([listAll("pages"), listAll("posts")]);
  return [...pages, ...posts].map((p) => ({ url: `${SITE}${toLocal(p.link)}`, lastModified: new Date(p.modified_gmt + "Z"), changeFrequency: "weekly" as const }));
}
'''
FILES['app/robots.ts'] = '''import type { MetadataRoute } from "next";
import { SITE } from "@/lib/wp";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }], sitemap: `${SITE}/sitemap.xml`, host: SITE };
}
'''
FILES['app/llms.txt/route.ts'] = '''import { WP, SITE, listAll, toLocal } from "@/lib/wp";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const r = await fetch(`${WP}/llms.txt`, { next: { revalidate: 3600 } }); if (r.ok) { const t = (await r.text()).replaceAll(WP, SITE); return new Response(t, { headers: { "Content-Type": "text/plain; charset=utf-8" } }); } } catch {}
  const pages = await listAll("pages");
  const body = `# __SITE_NAME__\\n\\n## Pages\\n\\n` + pages.map((p) => `- ${SITE}${toLocal(p.link)}`).join("\\n") + "\\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
'''
FILES['app/not-found.tsx'] = '''export default function NotFound() { return <main className="forge-section"><div className="forge-inner forge-narrow"><h1>Page not found</h1><p><a href="/">Back to the home page</a></p></div></main>; }
'''
FILES['README.md'] = '''# FORGE headless front end

Next.js 15 App Router. Pages are fetched from WordPress (`WP_URL`) through the REST API and the FORGE bridge, rendered from the FORGE blueprint (`forge.blueprint`) with ISR (10 min) and on-demand revalidation.

1. `cp .env.example .env.local` and fill `WP_URL`, `NEXT_PUBLIC_SITE_URL`, `REVALIDATE_SECRET` (and `WP_HOME_SLUG`, the slug of the page that is the home page).
2. `npm install && npm run dev` — open http://localhost:3000/<page-slug>/.
3. In WordPress, register the front end with the bridge: `python3 forge_wp.py settings --revalidate-url https://<front-end>/api/revalidate --secret <REVALIDATE_SECRET> --cors https://<front-end>` — every publish then revalidates the path.
4. Deploy (Vercel, Netlify, Node): set the same three env vars. Point the domain at the front end; keep WordPress on a `cms.` subdomain and set `NEXT_PUBLIC_SITE_URL` to the public domain so canonicals and the sitemap point at the front end.
5. Leads post to `/api/lead`, which proxies to the bridge (`forge/v1/lead`): stored as private `forge_lead` posts and emailed to `lead_email`.

Routes: `/[...slug]` (pages, then posts), `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/api/lead`, `/api/revalidate`.
'''

def generate(bp, out, wp_url=None, site_url=None):
    site = bp.get('site', {}); brand = site.get('brand', {})
    wp_url = (wp_url or site.get('cms') or site.get('url', 'https://cms.example.com')).rstrip('/'); site_url = (site_url or site.get('url', 'https://www.example.com')).rstrip('/')
    wp_host = re.sub(r'^https?://', '', wp_url).split('/')[0]
    css = PREVIEW_CSS % {'p': brand.get('primary', '#1d4e89'), 'a': brand.get('accent', '#c9a227'), 't': hexmix(brand.get('primary', '#1d4e89'), 0.9), 'd': brand.get('dark', '#111110'), 'font': brand.get('font_body', 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'), 'hfont': brand.get('font_heading', 'inherit')}
    cta = bp.get('page', {}).get('cta', {}).get('primary', {})
    rep = {'__WP_HOST__': wp_host, '__SITE_URL__': site_url, '__SITE_NAME__': brand.get('name') or site.get('name', 'Site'), '__CSS__': css, '__CTA_URL__': cta.get('url', '/contact/'), '__CTA_LABEL__': cta.get('label', 'Contact'), '__FOOTER_LINE__': site.get('footer_line', 'All rights reserved.')}
    for rel, txt in FILES.items():
        for k, v in rep.items(): txt = txt.replace(k, v)
        write(out, rel, txt)
    print('wrote headless project to', out, '|', len(FILES), 'files | WP', wp_url, '| site', site_url)

if __name__ == '__main__':
    if len(sys.argv) < 3: print(__doc__); sys.exit(1)
    bp = json.load(open(sys.argv[1], encoding='utf-8')); a = sys.argv
    generate(bp, a[2], a[a.index('--wp') + 1] if '--wp' in a else None, a[a.index('--site') + 1] if '--site' in a else None)
```