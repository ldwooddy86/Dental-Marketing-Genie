#!/usr/bin/env python3
"""UltimaWeapon — brand-token sweep and metadata scrub. The shipping gate for every deliverable.

Searches every file's VISIBLE TEXT (pdftotext for PDFs; XML parts for docx/xlsx/pptx), RAW BYTES and METADATA
(PDF docinfo + XMP via pikepdf; Office core/app properties; image EXIF/info via Pillow) for each token, case-insensitively,
and prints every hit with its location. Exit code 1 when any hit remains — zero hits is the gate, not a nicety.

--scrub rewrites metadata in place: PDFs get an empty docinfo + no XMP and only --title; docx/xlsx/pptx get blank
creator / lastModifiedBy / company and --title; PNG/JPEG get their text chunks / EXIF dropped. --scrub never touches
visible content: if a token is in the body, fix the source and rebuild.

Usage
  python3 brand_sweep.py --tokens "Acme Agency,ACME,acmeagency.com,Jane Operator" [--scrub --title "Full SEO Audit"] FILE...
  python3 brand_sweep.py --tokens-file tokens.txt out/*.pdf out/*.xlsx out/*.csv out/*.txt out/*.png
"""
import argparse, io, os, re, subprocess, sys, zipfile

def pdf_text(path):
    try:
        return subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True, timeout=120).stdout
    except Exception: return ""

def pdf_meta(path):
    try:
        import pikepdf
        with pikepdf.open(path) as pdf:
            di = {str(k): str(v) for k, v in pdf.docinfo.items()}
            xmp = ""
            try:
                with pdf.open_metadata() as m: xmp = str(m)
            except Exception: pass
            return " | ".join(f"{k}={v}" for k, v in di.items()) + " || " + xmp
    except Exception as e: return f"(pikepdf unavailable: {e})"

def office_parts(path):
    out = {}
    try:
        with zipfile.ZipFile(path) as z:
            for n in z.namelist():
                if n.endswith((".xml", ".rels", ".txt")):
                    out[n] = z.read(n).decode("utf-8", "replace")
    except Exception as e: out["(error)"] = str(e)
    return out

def image_meta(path):
    try:
        from PIL import Image
        im = Image.open(path); info = {k: str(v)[:500] for k, v in im.info.items() if k not in ("icc_profile",)}
        exif = im.getexif(); info.update({f"exif:{k}": str(v)[:200] for k, v in exif.items()})
        return " | ".join(f"{k}={v}" for k, v in info.items())
    except Exception as e: return f"(Pillow unavailable: {e})"

def sweep(path, tokens):
    hits = []
    low = [t.lower() for t in tokens if t.strip()]
    def check(blob, where):
        b = blob.lower()
        for t in low:
            n = b.count(t)
            if n: hits.append((where, t, n))
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        check(pdf_text(path), "pdf:visible-text"); check(pdf_meta(path), "pdf:metadata")
    elif ext in (".docx", ".xlsx", ".pptx", ".potx", ".xlsm"):
        for n, x in office_parts(path).items(): check(x, f"office:{n}")
    elif ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        check(image_meta(path), "image:metadata")
    elif ext in (".txt", ".csv", ".md", ".json", ".html", ".xml", ".svg"):
        check(open(path, encoding="utf-8", errors="replace").read(), "text")
    raw = open(path, "rb").read()
    check(raw.decode("latin-1", "replace"), "raw-bytes")
    try: check(raw.decode("utf-16", "replace"), "raw-bytes-utf16")
    except Exception: pass
    return hits

def scrub(path, title):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        import pikepdf
        with pikepdf.open(path, allow_overwriting_input=True) as pdf:
            for k in list(pdf.docinfo.keys()): del pdf.docinfo[k]
            if title: pdf.docinfo["/Title"] = title
            try:
                if "/Metadata" in pdf.Root: del pdf.Root["/Metadata"]
            except Exception: pass
            pdf.save(path)
        return "pdf docinfo cleared" + (f", Title={title!r}" if title else "") + ", XMP removed"
    if ext in (".docx", ".xlsx", ".pptx"):
        tmp = path + ".tmp"
        with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "docProps/core.xml":
                    x = data.decode("utf-8", "replace")
                    x = re.sub(r"<dc:creator>.*?</dc:creator>", "<dc:creator></dc:creator>", x, flags=re.S)
                    x = re.sub(r"<cp:lastModifiedBy>.*?</cp:lastModifiedBy>", "<cp:lastModifiedBy></cp:lastModifiedBy>", x, flags=re.S)
                    for tag in ("dc:description", "dc:subject", "cp:keywords", "cp:category"):
                        x = re.sub(rf"<{tag}>.*?</{tag}>", f"<{tag}></{tag}>", x, flags=re.S)
                    if title is not None: x = re.sub(r"<dc:title>.*?</dc:title>", f"<dc:title>{title}</dc:title>", x, flags=re.S) if "<dc:title>" in x else x
                    data = x.encode("utf-8")
                elif item.filename == "docProps/app.xml":
                    x = data.decode("utf-8", "replace")
                    for tag in ("Company", "Manager", "Application"):
                        x = re.sub(rf"<{tag}>.*?</{tag}>", f"<{tag}></{tag}>", x, flags=re.S)
                    data = x.encode("utf-8")
                zout.writestr(item, data)
        os.replace(tmp, path); return "office core/app properties blanked"
    if ext in (".png", ".jpg", ".jpeg"):
        from PIL import Image
        im = Image.open(path); clean = Image.new(im.mode, im.size); clean.putdata(list(im.getdata())); clean.save(path); return "image metadata dropped"
    return "no scrub action for this type"

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+"); ap.add_argument("--tokens", default=""); ap.add_argument("--tokens-file", default=None)
    ap.add_argument("--scrub", action="store_true"); ap.add_argument("--title", default=None)
    a = ap.parse_args()
    tokens = [t.strip() for t in a.tokens.split(",") if t.strip()]
    if a.tokens_file: tokens += [l.strip() for l in open(a.tokens_file) if l.strip() and not l.startswith("#")]
    if not tokens: sys.exit("no tokens given (--tokens 'Name,alias,domain' or --tokens-file)")
    total = 0
    for f in a.files:
        if not os.path.isfile(f): print(f"skip (not a file): {f}"); continue
        if a.scrub:
            try: print(f"scrub  {f}: {scrub(f, a.title)}")
            except Exception as e: print(f"scrub  {f}: FAILED {e}")
        hits = sweep(f, tokens); total += len(hits)
        if hits:
            for where, t, n in hits: print(f"HIT    {f} [{where}] token={t!r} x{n}")
        else: print(f"clean  {f}")
    print(f"\n{'ZERO HITS — gate passed' if total == 0 else f'{total} hit location(s) — gate FAILED'} across {len(a.files)} file(s), {len(tokens)} token(s)")
    sys.exit(0 if total == 0 else 1)

if __name__ == "__main__": main()
