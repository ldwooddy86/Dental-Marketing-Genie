# Publishing platforms · setup guide (module 22)

Code: `src/cms/00_cms_core.js` (the contract and the deploy driver) and one adapter per platform under `src/cms/`, shared with the Thermal
Atlas (only the storage key and the WordPress Application Password name differ); the module is `src/41_m22_publish.js`. Tests:
`node tests/run.mjs <id>` for an adapter against a recording mock server, `node tests/e2e/publish.smoke.mjs` for the module in a browser.
Every credential stays in this browser under the storage key `sv.cms.v1` (extension storage in the Severance extension, localStorage when
the single file is opened from disk). The app talks to the platform's own API and to nothing else.

**What a deploy does, on every platform.** Module 22 takes the selected pages (from the Site Forge, module 21, the composer or an import) and
screens each one with the compliance engine (`LINT.screen(html, {kind: 'page', html: true})`): the title, the meta description and the body
text against the Texas Disciplinary Rules of Professional Conduct 7.01 to 7.06 patterns, the family law myths, stale numbers, unfilled
placeholders, the house style, and the Rule 7.02(a) check that the page names the responsible lawyer and the primary practice location. A
page with a blocking finding is held back unless **Send anyway** is ticked on its row; the results table and the ledger show the screen
status of every page, and an override is recorded. For the pages that go, the module uploads the local images through the target or the
chosen media host, rewrites their URLs in the markup, the JSON-LD and the Open Graph image, then looks each page up by its slug and updates it
when it exists or creates it otherwise. Pages land as drafts unless Publish live is ticked (it takes a second click). The ledger keeps the id,
link, edit link, status and screen result per page and target. Sent pages are skipped on the next run unless you untick Skip pages already sent.

**Media host.** Wix, Webflow, Shopify, HubSpot, Ghost, Joomla, Drupal and WordPress store files. Duda does not: it only imports from a public
URL, so pick a media host in module 22 when a Duda deploy carries local photos (an office photo, a lawyer portrait).

**Site access.** WordPress, Drupal, Joomla and Ghost run on the firm's own domain, so the Severance extension asks once for permission to reach
it (Chrome shows a prompt; Firefox asks through Options). The hosted platforms (Wix, Duda, Webflow, Shopify, HubSpot) are fixed API hosts in
the manifest.

**Opened from disk, or inside the hosted viewer.** A page opened from disk has no site permissions, so the browser lets a CMS call through only
when the CMS answers with CORS headers for that origin. The FORGE bridge has an allowed origins list for WordPress; the hosted platforms and
most Drupal, Joomla and Ghost installs do not, so Test and Deploy usually fail there with "Could not reach". The hosted viewer blocks every
call to another site. In both, module 22 still writes, screens and previews the pages, and the **Pages pack** (toolbar) downloads a zip with,
per page, `index.html` (a standalone document), `body.html` (the section markup with its css and JSON-LD inline, for a field or block that
takes HTML) and `page.json` (the portable page and its screen result), plus `compliance.csv` and a README; pages the screen blocks go under
`held/`. Install the Severance extension to publish directly.

**Texas rules that touch publishing.** Every page names the responsible lawyer and the primary practice location (Rule 7.02(a)); the composer's
starter template and its Append the firm disclaimer button write that block from the firm profile. Specialization may be stated only in the
Texas Board of Legal Specialization form (Rule 7.02(b)). Website pages other than the homepage are exempt from filing (Rule 7.05); the homepage
is filed with the Advertising Review Committee within ten days of first dissemination (Rule 7.04), and the deploy log says so when a page named
home goes live. The screen is a floor, not a review: the responsible lawyer reads every page before it goes live.

| Platform | id | Auth | A page becomes | JSON-LD | SEO fields | Uploads | Live URL list | Site publish |
|---|---|---|---|---|---|---|---|---|
| WordPress · Elementor | `wp_elementor` | Application Password | page or post, Elementor data through the bridge | head (bridge) or inline | bridge | yes | yes | no |
| WordPress · Headless | `wp_headless` | Application Password | page or post read by the Next.js kit | head | bridge | yes | yes | no |
| Drupal 10 / 11 | `drupal` | Basic or bearer | node of the chosen content type | inline | Metatag field | yes | yes | no |
| Wix | `wix` | API key | CMS collection item or Blog draft post | text field or dropped | collection fields | yes | no | no |
| Duda | `duda` | API user + password | copy of a template page with injected HTML, or a blog post | inline | page SEO | via media host | yes | yes |
| Webflow | `webflow` | Site API token | CMS collection item | text field or dropped | collection fields | yes | no | yes |
| Shopify | `shopify` | custom app token | Online Store page or blog article | inline | metafields | images | yes | no |
| HubSpot | `hubspot` | private app token | blog post or site page | head | page settings | yes | yes | no |
| Joomla 4.1+ / 5 | `joomla` | user API token | article | inline | metadesc, robots | yes | yes | no |
| Ghost 5 / 6 | `ghost` | Admin API key | page or post | code injection head | page settings | yes | yes | no |

The JSON-LD the composer writes for the firm is a `LegalService` (name, legal name, url, telephone, the primary office as a `PostalAddress`,
the counties served as `areaServed`, the service lines as `knowsAbout`, the profiles as `sameAs`, the responsible lawyer as an `employee`)
and a `WebPage` about it; the Site Forge adds `FAQPage` and `BreadcrumbList` on its own pages.

---

## WordPress · Elementor (`wp_elementor`)

**Prerequisites.** WordPress 5.6 or newer over HTTPS (Application Passwords refuse plain http). Settings, Permalinks set to Post name (Plain
permalinks hide `/wp-json/`). For Elementor data: Elementor installed and an Administrator account (the `unfiltered_html` capability). The
FORGE bridge plugin: module 22 downloads `forge-bridge.zip` (toolbar or the WordPress cards); Plugins, Add New, Upload, Activate. Without the
bridge the HTML route still works.

**Credentials.** Users, Profile, Application Passwords: name it Severance, Add, copy the password once. Fields: WordPress URL (the install, for
example `https://www.smithfamilylaw.example`, not a headless front end), Username, Application Password (with or without spaces), Post type
(page or post, optional).

**What a page becomes.** With the bridge (`/wp-json/forge/v1/import`): a page or post with the Elementor data, the page template, the SEO title,
description, canonical and robots in the SEO plugin fields, the JSON-LD printed in the head, the featured image, plus the blueprint stored on
the post. Without the bridge (`/wp-json/wp/v2/pages` or `posts`): slug, title, status, excerpt and the section HTML with the forge css and the
JSON-LD inline; the SEO fields are not set and the result says so. Images go to the media library through `wp/v2/media`; a file with the same
name is reused. Module 22 can also send an Elementor template to the library (bridge only).

**Limits.** Inline JSON-LD needs `unfiltered_html`, otherwise `wp_kses` strips the script tag. With Elementor data the page is styled by the
Elementor containers and widgets; the HTML fallback (no Elementor, or a user without `unfiltered_html`) carries the forge css as a `<style>`
block at the top of the content, and `wp_kses` strips that block for users without `unfiltered_html` (the bridge prints only the JSON-LD and the
meta tags in the head; it does not register the forge classes). The disclaimer block is ordinary markup and survives both routes. Live URL
list stops at 5000 pages and 5000 posts.

**Troubleshooting.** 401: the username or Application Password is wrong, the site is not HTTPS, or a security plugin blocks Basic auth on the
REST API. 403 `forge_caps`: Elementor data needs an administrator. Other 403: the user cannot edit pages (Editor or Administrator role).
404 on a `forge/v1` route: the bridge is not active or permalinks are Plain. 404 `rest_no_route`: permalinks or a plugin disabling REST.
413: the file is above the host's upload limit. 429: the host or a security plugin rate limits. "No WordPress REST API at": the URL is a front
end or not WordPress. "Could not reach" from a page opened from disk: add the page's origin to the bridge's allowed origins, or use the extension.

## WordPress · Headless (Next.js) (`wp_headless`)

**Prerequisites.** Everything above, plus the bridge (mandatory: the front end reads the blueprint through it) and the Next.js kit from module 22
(Next.js 15.5, App Router). The kit is written with the firm's name and colors from the firm profile, a Schedule a consultation call to action,
and the responsible attorney and primary office line from `FIRM.adFooter()` in the footer of every page; module 22 refuses to write it until the
profile carries the firm name, the responsible lawyer and the primary office city. Deploy the kit with `WP_URL`, `NEXT_PUBLIC_SITE_URL` and
`REVALIDATE_SECRET` set and point the public domain at it. WPGraphQL is optional; the kit reads REST.

**Credentials.** The WordPress fields above, plus Front end URL (the public origin the kit serves), Revalidate secret (optional, the kit's
`REVALIDATE_SECRET`) and Revalidate URL (optional, defaults to the front end plus `/api/revalidate`).

**What a page becomes.** The same bridge import, with the canonical rewritten to `<front end>/<slug>/` (the kit resolves a page by the last path
segment) in the SEO fields and inside the schema. The result's link is the front end URL; the WordPress permalink is kept as `wpLink`. Test
reports the bridge version, WordPress, PHP, WPGraphQL, whether the front end answers and whether the bridge is configured. Configure sends the
revalidate URL, the secret (only when filled) and the front end origin to the bridge's CORS list without wiping what is there; every publish
then refreshes the page on the front end.

**Limits.** No HTML fallback: without the bridge Test reports it and deploys refuse (`forge_no_bridge`). Drafts keep `?page_id=` links on
WordPress; the ledger link is the front end URL.

**Troubleshooting.** As for Elementor. "unreachable" on the front end probe: the kit is not deployed yet or the browser refused the origin
permission; the deploy still works. Configure needs an Administrator (`manage_options`).

## Drupal 10 / 11 (`drupal`)

**Prerequisites.** Extend: JSON:API and HTTP Basic Authentication (or Simple OAuth for a bearer token). Configuration, Web services, JSON:API:
"Accept all JSON:API create, read, update, and delete operations". Permissions for the account: create and edit the content type, create URL
aliases, create media, view user information. Optional: Metatag with a Meta tags field on the content type; Pathauto.

**Credentials.** Site URL (the adapter adds `/jsonapi`), Auth (basic or bearer), Username and Password or Bearer token. Content type machine
name (default `page`; a firm site often has a `practice_area` type), Text format (default `full_html`; it must allow style and script tags),
Language code (optional; `es` for the Spanish pages when the site is multilingual), Metatag field (for example `field_metatags`), Image field
(for example `field_image`), Media bundle (`image` by default; `none` uploads straight into the image field), Media file field
(`field_media_image`), Pathauto installed (yes sends `pathauto: 0` so the pattern leaves the alias alone), Slug field (optional plain text
field for exact lookups).

**What a page becomes.** A `node--<bundle>` with the title, the body (section HTML with the css and the JSON-LD inline, in the chosen text
format), the path alias `/<slug>`, the Metatag values (title, description, canonical, robots, og:image) when a field is set, and the hero as a
media entity (file upload, then a media item with the alt text) referenced from the image field. Existing pages are found by title and alias,
or by the slug field when set.

**Limits.** JSON:API cannot filter on the path alias, hence the title lookup; set a slug field on busy sites. `body.summary` is not sent
(text_long bodies reject it). Media bundle `none` leaves the file temporary until the node references it. Ids from another media host are not
written to the image field.

**Troubleshooting.** 401: wrong password, HTTP Basic Authentication off, or an expired token. 403: Drupal treated the request as anonymous or a
permission is missing (create and edit content, create url aliases, create media). 404: JSON:API off or a wrong bundle or field machine name.
405: JSON:API is read only (the setting above). 415: a proxy or module rewrites the `application/vnd.api+json` headers. 400: the message names
the bad filter or field. 422: field validation (text format name, field names, a taken alias); the detail carries the field pointer.

## Wix (`wix`)

**Prerequisites.** A Wix site the firm owns. CMS mode: a collection (default id `Pages`; for example a Practice Areas collection) with the fields
title, slug, body (Rich Text), metaTitle, metaDescription, summary and optionally schema, image, status; one dynamic page bound to it with its SEO
settings taken from the item fields. Blog mode: nothing beyond the Blog app.

**Credentials.** Settings (account level), API Keys, Generate API key with Wix Data, Blog and Media Manager permissions. Fields: API key, Site ID
(the dashboard URL `manage.wix.com/dashboard/<site id>/`), Account ID (optional, shown next to the key), Content model (cms or blog), the
collection id and field names, Site URL, Dynamic page path (`/pages/{slug}`, or `/practice-areas/{slug}` when the dynamic page lives there),
Blog post path (`/post/{slug}`).

**What a page becomes.** CMS mode: one data item per page (`wix-data/v2/items`), body = editorial HTML only (headings, paragraphs, lists, links,
images; css, section wrappers, forms and scripts are stripped because a Wix Rich Text field keeps nothing else), the JSON-LD as a string in the
schema field when mapped, the hero in the image field. Data items are live as soon as they are saved, so the result reports `publish` unless a
status field is configured: that is why the screen runs before the deploy, not after. Blog mode: a draft post in Ricos format (headings,
paragraphs, lists, quotes, images, bold, italic, links; FAQ details unwrapped), meta title and description in the SEO tags, the cover image when
the hero is a Wix media file; Publish live publishes the draft. Images upload through the Media Manager (`site-media/v1`).

**Limits.** No page from HTML on Wix; the dynamic page or the blog template does the rendering. Blog mode drops the JSON-LD and the css. The
disclaimer block arrives as paragraphs in the rich text; keep it, or put the responsible lawyer line on the dynamic page template itself. No live
URL list (Verify links is unavailable). Titles are cut at 200 characters, excerpts at 500.

**Troubleshooting.** 401: wrong key or site ID, or a key from another account. 403: the key lacks Wix Data, Blog or Media Manager. 404 or
`WDE0025`: wrong collection ID or post id. 400: field ids or a body field that is not Rich Text. 429: wait a minute.

## Duda (`duda`)

**Prerequisites.** A Duda account with API access (Settings, API or Business Tools, API Access), common with legal marketing agencies, and the
site name from the editor URL `my.duda.co/home/site/<site name>`. Inject mode: one page in the editor with an HTML widget containing
`<div data-inject="forge-content"></div>`, its path set to `forge-template` (or its uuid pasted in the field). Blog mode: the Blog added to the
site once. Note: Duda's own docs mark content injection as deprecated in favour of the snippets API, connected data and the content library;
it still works.

**Credentials.** API user, API password, Region (us, eu, sandbox), Site name, Content model (inject or blog), Content key (`forge-content`),
Template page uuid (optional), Blog author (optional, for example the responsible lawyer), Republish the site after publishing a page (checkbox).

**What a page becomes.** Inject mode: the template page is duplicated, its title, path and SEO (title, description, no_index) set, then the
section HTML with the css and the JSON-LD inline is injected into the element with the content key; the site is republished when the box is
ticked and Publish live is on, otherwise the result stays `draft` with a republish note. Blog mode: a post imported with title, description,
author, date, meta title, main image and the HTML content; Publish live publishes the post. Live URLs come from the pages list.

**Limits.** No uploads: a local photo needs a media host (WordPress, Shopify, Webflow, Ghost, HubSpot) and Duda then imports the public URL
(`resources/upload`). Blog post lookup reads one page of posts. Links prefer the custom domain when the site has one.

**Troubleshooting.** 401: wrong user or password, or the wrong region (US, EU and sandbox credentials differ). 403: the site belongs to another
account or the plan lacks the feature. 404: check the site name, the page or post id. 400: page path characters or fields. 429: wait a minute.
"Duda uploads from a public URL": pick a media host in module 22. "no pages": build the template page first.

## Webflow (`webflow`)

**Prerequisites.** A site with a CMS collection (for example Practice Areas) holding a RichText body plus plain text fields for the summary,
meta title and meta description, optionally a schema text field and an image field, and a collection template page that binds the body and the
SEO settings (a code embed can print the schema field in a script tag). The site published once from the designer before items can be
published.

**Credentials.** Site settings, Apps & integrations, API access: generate a site token with `cms:read`, `cms:write`, `sites:read`, `sites:write`
and `assets:write`. Fields: Site API token, Site ID (Site settings, General), Collection ID (collection settings), the field slugs (`name`,
`slug`, `post-body`, `summary`, `meta-title`, `meta-description`, `schema`, `image`), Publish items when publishing, Publish the site after
each published page, Subdomain only, Site URL.

**What a page becomes.** A collection item (`/v2/collections/{id}/items`) with the name and slug, the body as cleaned rich text (sections, divs
and spans unwrapped, dt and dd as paragraphs, scripts, styles, iframes, forms and svg dropped, only href, target and rel on links and src, alt,
width and height on images), the mapped meta fields, the JSON-LD string and the hero image. Items are staged drafts; Publish live sets
`isDraft: false`, publishes the items when ticked and republishes the site (custom domains included unless Subdomain only) when ticked. Assets
upload in two steps (`sites/{id}/assets` with an MD5, then the S3 form).

**Limits.** No live URL list. The css is dropped (the template page styles the rich text). Unmapped fields are skipped with a note. Rate limit
60 calls a minute: the adapter waits once on 429 and retries.

**Troubleshooting.** 401: the token was replaced. 403 or `missing_scopes`: regenerate the token with the five scopes. 404: site or collection
ID. 409: another item uses the slug, or the site was never published. 400 `validation_error`: field slugs and types (RichText takes HTML,
Image takes a public URL). 429: wait a minute.

## Shopify (`shopify`)

Rare for a law firm, but the route is there when the firm's site (or a firm owned resource store) runs on Shopify.

**Prerequisites.** Settings, Apps and sales channels, Develop apps, Create an app; Configuration, Admin API integration: `write_content`
(pages, blogs, articles) and `write_files` (uploads). Install the app and copy the Admin API access token (`shpat_...`, shown once). Posts
need a Blog id (Content, Blog posts, Manage blogs; the number at the end of the URL).

**Credentials.** Store domain (`store.myshopify.com`, not the custom domain), Admin API access token, API version (default 2026-07), Blog id
(optional), Post author name (optional), Template suffix (optional, `page.<suffix>.json`), Public site URL (optional, the custom domain for
links).

**What a page becomes.** GraphQL Admin API (`/admin/api/2026-07/graphql.json`): a page (`pageCreate`, `pageUpdate`) with the handle, the body
(section HTML with the css and the JSON-LD inline), the SEO title and description as the `global.title_tag` and `global.description_tag`
metafields, noindex as `seo.hidden`, the template suffix; a post becomes an article in the given blog with the author, summary and image.
Images go through staged uploads and `fileCreate`, polled until ready. Live URLs list published pages and articles.

**Limits.** Canonical tags come from the theme and cannot be sent. Images only (host videos on YouTube or in Content, Files). A draft deploy of a
live page unpublishes it (noted in the result). Throttling is retried once from the cost headers.

**Troubleshooting.** `ACCESS_DENIED` or "access scope": tick `write_content` and `write_files`, reinstall the app, paste the new token. 401:
store domain or token. `THROTTLED` twice: wait and deploy again. "does not know a field": try a newer API version. "check the Blog id in Test".

## HubSpot (`hubspot`)

**Prerequisites.** Content Hub (blog or website pages). Settings, Integrations, Private apps: create an app with the `content` scope (blog posts
and site pages) and `files` (uploads). Blog mode needs a blog (Test lists the ids). Page mode needs a page template path from the active theme
and the name of its drag and drop area (`dnd_area` on the HubSpot themes).

**Credentials.** Private app access token (`pat-...`), Create as (blog or page), Blog id, Blog author id (optional, the first author otherwise),
Page template path (page mode, for example `@hubspot/growth/templates/blank.html`), Drag and drop area (`dnd_area`), Domain (optional).

**What a page becomes.** Blog mode (`/cms/v3/blogs/posts`): a post with the name, slug under the blog root, author, body with the css inline,
summary, HTML title, meta description, canonical, the JSON-LD and a robots noindex tag in the head HTML, and the featured image. Page mode
(`/cms/v3/pages/site-pages`): a site page on the template with one rich text module in the drag and drop area. New records are created as
drafts and scheduled for now when publishing; an existing live record deployed as a draft gets the new content in its draft only. Files upload
to `/forge` in the file manager. Live URLs list published posts and pages.

**Limits.** Page mode needs the template path (400 otherwise). Slug lookups use `slug__icontains` with an exact client side match. Editor links
need the portal id (read once from account info).

**Troubleshooting.** 401: paste the private app token (Auth tab). 403 or `MISSING_SCOPES`: add `content` and `files` to the app. 404: Blog id or
page id, or no Content Hub. 429: 100 requests per 10 seconds. 400 mentioning the template: not a page template of the active theme. 400
mentioning the slug: taken or invalid on that domain.

## Joomla 4.1+ / 5 (`joomla`)

**Prerequisites.** Users, Manage, the user, tab Joomla API Token: Enabled, Save, copy the token. System, Plugins: "API Authentication, Web
Services Joomla Token", "Web Services, Content" and "Web Services, Media" enabled (the plugin names carry a dash in Joomla). Global
Configuration, Permissions: the group needs Web Services, Create and Edit in Content, Create in Media. Text Filters: No Filtering for the group,
or the css and JSON-LD are stripped. A menu item on the category (for example Practice Areas) so articles get SEF URLs.

**Credentials.** Site URL (the adapter adds `/api/index.php/v1`), API token, Category id (Uncategorised is 2), Language (`*` or a tag such as
`es-ES`), Access level (1 Public), Media folder under `images/` (`forge`).

**What a page becomes.** An article (`/v1/content/articles`) with the title, alias, the article text (section HTML with the css and the JSON-LD
inline), category, language, state, access, the meta description (cut to 160 characters) and robots noindex in the metadata. Existing
articles are found by alias inside the category. Images upload as base64 into `images/<folder>` and are reused by name. Live URLs are listed
from the articles.

**Limits.** The link is the non SEF `index.php?option=com_content&view=article&id=` form unless a menu item routes the category. Meta keywords
are left empty.

**Troubleshooting.** 401: token disabled on the user, the token plugin off, or a blocked user. 403: the group lacks Web Services, Create or
Edit in Articles, Create in Media, or access to the category. 404: `/api` blocked by the server or the Web Services plugins off. 400 or 422: a
duplicate alias or a field named in the message. 500: an editor plugin breaking API saves.

## Ghost 5 / 6 (`ghost`)

**Prerequisites.** Settings, Advanced, Integrations: Add custom integration, copy the Admin API key (`id:secret`). The Content API key does not
work here.

**Credentials.** Admin URL (the site domain for self hosted sites, `yourname.ghost.io` for Ghost(Pro) sites with a custom domain), Admin API
key, Create as (page, post or auto from the page), Accept version (optional, read from the site).

**What a page becomes.** A page or post (`/ghost/api/admin/pages/` or `posts/` with `source=html`): the section HTML and css wrapped in one
HTML card, meta title, meta description, canonical, custom excerpt, feature image and alt, the JSON-LD and a robots noindex tag in the code
injection head. Drafts unless Publish live; updates carry the record's `updated_at`. Images upload through `images/upload/`. Live URLs list
pages and posts.

**Limits.** Titles are cut at 255 characters, excerpts at 300, image alt at 125 (Ghost's validation limits). The JWT is valid for five minutes,
so the computer clock matters. Most themes print the feature image above the content; clear it in the page settings when the hero already
carries the photo.

**Troubleshooting.** 401: wrong or deleted key, or the clock is off. 403: the integration is not allowed. 404: the admin URL (without
`/ghost`), or the record was deleted. 406: the `Accept-Version` header; set the field to the site's major version. 422: a field too long or a
taken slug. 415: an image type Ghost does not accept (WEBP, JPEG, GIF, PNG, SVG).
