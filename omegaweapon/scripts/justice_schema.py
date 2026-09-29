#!/usr/bin/env python3
"""UltimaWeapon / Justice — extract + validate JSON-LD against Google rich-result eligibility rules; emit findings CSV and deep links.
Usage: python3 scripts/justice_schema.py omega_cache/<agency>/html/*.html --out omega_cache/<agency>/schema"""
import re, json, os, sys, csv, glob, argparse, urllib.parse, datetime
REQ = {"Organization": (["name", "url"], ["logo", "sameAs", "contactPoint", "address", "telephone"]),
       "LocalBusiness": (["name", "address", "telephone"], ["url", "image", "geo", "openingHoursSpecification", "priceRange", "sameAs", "areaServed"]),
       "Article": (["headline", "image", "datePublished", "author"], ["dateModified", "publisher", "mainEntityOfPage", "description"]),
       "FAQPage": (["mainEntity"], []), "BreadcrumbList": (["itemListElement"], []),
       "VideoObject": (["name", "description", "thumbnailUrl", "uploadDate"], ["contentUrl", "embedUrl", "duration"]),
       "Person": (["name"], ["jobTitle", "worksFor", "sameAs", "url", "image"]), "WebSite": (["name", "url"], ["potentialAction"]),
       "WebPage": (["name"], ["url", "isPartOf", "breadcrumb"]), "Review": (["itemReviewed", "author", "reviewRating"], ["reviewBody", "datePublished"]),
       "AggregateRating": (["ratingValue", "reviewCount|ratingCount"], ["bestRating"]), "Service": (["name", "provider"], ["areaServed", "description"])}
ALIAS = {"LegalService": "LocalBusiness", "Attorney": "LocalBusiness", "Dentist": "LocalBusiness", "MedicalBusiness": "LocalBusiness", "Plumber": "LocalBusiness",
         "HVACBusiness": "LocalBusiness", "HomeAndConstructionBusiness": "LocalBusiness", "ProfessionalService": "LocalBusiness", "Store": "LocalBusiness",
         "BlogPosting": "Article", "NewsArticle": "Article", "Corporation": "Organization"}
SELF = {"LocalBusiness", "Organization"}
def entities(node, out, parent=None):
    if isinstance(node, list): [entities(n, out, parent) for n in node]; return
    if not isinstance(node, dict): return
    if "@graph" in node: entities(node["@graph"], out, parent)
    t = node.get("@type")
    if t: out.append((t if isinstance(t, str) else "/".join(t), node, parent))
    for k, v in node.items():
        if k not in ("@type", "@context", "@graph") and isinstance(v, (dict, list)): entities(v, out, t)
QUIET = {"PostalAddress", "ListItem", "GeoCoordinates", "ImageObject", "ContactPoint", "OpeningHoursSpecification", "Rating", "Question", "Answer",
         "SearchAction", "EntryPoint", "Offer", "PropertyValue", "Place", "City", "State", "Country", "AdministrativeArea", "Thing", "Brand", "Audience"}
def check(url, typ, node, parent, visible_text):
    base = next((ALIAS.get(x, x) for x in typ.split("/") if ALIAS.get(x, x) in REQ), None); f = []
    if base is None: return [] if typ in QUIET else [(url, typ, "S4", "info", f"Type '{typ}' has no rich-result rules here; verify manually")]
    req, rec = REQ[base]
    for r in req:
        if not any(node.get(o) for o in r.split("|")): f.append((url, typ, "S1" if base in ("Article", "LocalBusiness", "BreadcrumbList", "VideoObject") else "S2", "missing-required", r))
    for r in rec:
        if not node.get(r): f.append((url, typ, "S3", "missing-recommended", r))
    if base in SELF and any(k in node for k in ("aggregateRating", "review")):
        f.append((url, typ, "S1", "lying-schema", "self-serving aggregateRating/review on the business entity is ineligible (Google, Sept 2019) and misrepresents if no visible reviews"))
    tel = node.get("telephone");
    if tel and not re.fullmatch(r"\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}", str(tel)): f.append((url, typ, "S3", "telephone-format", str(tel)))
    if tel and visible_text and re.sub(r"\D", "", str(tel))[-10:] not in re.sub(r"\D", "", visible_text): f.append((url, typ, "S2", "nap-mismatch", f"schema telephone {tel} not found in visible page text"))
    if base == "Article":
        h = node.get("headline");
        if h and len(str(h)) > 110: f.append((url, typ, "S3", "headline-long", f"{len(str(h))} chars (>110)"))
        for k in ("datePublished", "dateModified"):
            d = node.get(k)
            if d and re.match(r"\d{4}-\d{2}-\d{2}", str(d)) and str(d)[:10] > datetime.date.today().isoformat(): f.append((url, typ, "S2", "future-date", f"{k}={d}"))
        if node.get("dateModified") and node.get("datePublished") and str(node["dateModified"])[:10] < str(node["datePublished"])[:10]: f.append((url, typ, "S3", "date-order", "dateModified earlier than datePublished"))
    if base == "BreadcrumbList":
        items = node.get("itemListElement") or []; pos = [i.get("position") for i in items if isinstance(i, dict)]
        if pos != list(range(1, len(items) + 1)): f.append((url, typ, "S2", "breadcrumb-positions", f"positions {pos} not contiguous from 1"))
    if base == "FAQPage":
        me = node.get("mainEntity") or []; me = me if isinstance(me, list) else [me]
        bad = [q for q in me if not (isinstance(q, dict) and q.get("name") and isinstance(q.get("acceptedAnswer"), dict) and q["acceptedAnswer"].get("text"))]
        if bad: f.append((url, typ, "S2", "faq-pairs", f"{len(bad)} of {len(me)} questions lack name/acceptedAnswer.text"))
        f.append((url, typ, "S4", "info", "FAQ rich results limited to authoritative gov/health sites since Aug 2023; value is AI-answer feedstock"))
    ctx = node.get("@context");
    if ctx and "schema.org" not in json.dumps(ctx): f.append((url, typ, "S1", "bad-context", str(ctx)[:80]))
    return f
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("files", nargs="+"); ap.add_argument("--out", required=True); a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    findings, summary = [], []
    for fp in a.files:
        html = open(fp, encoding="utf-8", errors="replace").read(); meta = {}
        mp = fp[:-5] + ".meta.json" if fp.endswith(".html") else None
        if mp and os.path.exists(mp): meta = json.load(open(mp))
        url = meta.get("final_url") or meta.get("url") or os.path.basename(fp)
        if meta.get("tier") and meta["tier"] != "RAW": summary.append({"url": url, "status": f"{meta['tier']} — unverified; run RRT link", "blocks": 0, "entities": "", "rrt": rrt(url), "smv": smv(url)}); continue
        text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S | re.I); text = re.sub(r"<[^>]+>", " ", text)
        blocks = re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.S | re.I); ents = []
        for i, b in enumerate(blocks):
            try: data = json.loads(b.strip().lstrip(""))
            except json.JSONDecodeError as e:
                findings.append((url, f"block#{i+1}", "S1", "json-parse-error", f"{e.msg} at line {e.lineno} col {e.colno} — whole block ignored by Google")); continue
            entities(data, ents)
        types = [t for t, n, p in ents]
        orgs = [n for t, n, p in ents if ALIAS.get(t, t) in ("Organization", "LocalBusiness")]
        if len({json.dumps(o.get("name")) for o in orgs}) > 1: findings.append((url, "Organization", "S2", "entity-conflict", f"multiple business names in schema: {sorted({str(o.get('name')) for o in orgs})}"))
        for t, n, p in ents: findings += check(url, t, n, p, text)
        summary.append({"url": url, "status": "RAW", "blocks": len(blocks), "entities": ", ".join(sorted(set(types)))[:300], "microdata": len(re.findall(r"itemscope", html, re.I)), "rrt": rrt(url), "smv": smv(url)})
    with open(os.path.join(a.out, "schema_findings.csv"), "w", newline="") as f:
        w = csv.writer(f); w.writerow(["url", "entity_type", "severity", "charge", "detail"]); w.writerows(findings)
    with open(os.path.join(a.out, "schema_summary.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["url", "status", "blocks", "entities", "microdata", "rrt", "smv"]); w.writeheader(); [w.writerow({**{"microdata": ""}, **s}) for s in summary]
    print(f"{len(summary)} pages, {len(findings)} findings -> {a.out}")
def rrt(u): return "https://search.google.com/test/rich-results?url=" + urllib.parse.quote(u, safe="")
def smv(u): return "https://validator.schema.org/#url=" + urllib.parse.quote(u, safe="")
if __name__ == "__main__": main()
