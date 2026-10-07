/* The withheld list: names that must never ship, anywhere in the repository: in plain text, inside a gzip payload or in a
   zip entry. The entries are kept encoded so the names never appear in the repository text (decode one with
   Buffer.from(x, 'base64')). An entry matches case-insensitively with any whitespace or none between its words; one marked
   word matches as a whole word, case-sensitive. The build drops the flat data rows ([...]) of a payload that carry one, and
   the validation scans the repository, every payload inflated and every zip entry read, and refuses it while one remains. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const WITHHELD = [
  { b64: 'aW50ZWdyaXR5IGFpcg==' },
  { b64: 'dG9wIHNoZWxmIGxvZ2lj' },
  { b64: 'YW1lcmljYW4gZmlyc3QgZmluYW5jZQ==' },
  { b64: 'QUZG', word: true },
];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const decoded = i => Buffer.from(WITHHELD[i].b64, 'base64').toString('utf8');
export const needles = () => WITHHELD.map((w, i) => ({ n: i + 1, re: w.word ? new RegExp('\\b' + esc(decoded(i)) + '\\b', 'g') : new RegExp(decoded(i).split(/\s+/).map(esc).join('\\s*'), 'gi') }));

/* every match in a text: [{n, at}] by offset, at most cap per entry */
export function findWithheld(text, cap = 3) {
  const out = [];
  for (const { n, re } of needles()) { let m, k = 0; while (k++ < cap && (m = re.exec(text))) out.push({ n, at: m.index }); }
  return out.sort((a, b) => a.at - b.at);
}

/* the gzip+base64 blobs of a text: [{at, end, text}], base64 runs that start with the gzip magic and inflate; a run that
   does not inflate is ordinary text */
const isB64 = c => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 43 || c === 47 || c === 61;
export const inflate = b64 => zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
export function blobs(text, min = 24) {
  const out = []; let i = 0;
  while ((i = text.indexOf('H4sI', i)) !== -1) {
    let j = i; while (j < text.length && isB64(text.charCodeAt(j))) j++;
    if (j - i >= min) { try { out.push({ at: i, end: j, text: inflate(text.slice(i, j)) }); } catch { /* not a payload */ } }
    i = j;
  }
  return out;
}
export const deflate = text => zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 }).toString('base64');
/* the id a blob is stored under: <script type="text/plain" id="lvp-x"> or window.__LVP["x"]= */
export function payloadId(text, at) {
  const head = text.slice(Math.max(0, at - 120), at);
  const m = /id="lvp-([^"]+)">\s*$/.exec(head) || /__LVP\["([^"]+)"\]="$/.exec(head);
  return m ? m[1] : 'blob@' + at;
}

/* drops the flat rows ([...] with no nested brackets) of a text that carry a withheld name: {text, removed, left} */
export function scrubRows(text) {
  let removed = 0, left = [];
  for (;;) {
    left = findWithheld(text, 1);
    if (!left.length) break;
    const at = left[0].at, a = text.lastIndexOf('[', at), b = text.indexOf(']', at);
    let row = null;
    if (a !== -1 && b !== -1 && !/[[\]]/.test(text.slice(a + 1, b))) {
      try { const v = JSON.parse(text.slice(a, b + 1)); if (Array.isArray(v) && v.some(x => typeof x === 'string' && findWithheld(x, 1).length)) row = [a, b + 1]; } catch { /* not a row */ }
    }
    if (!row) break;
    let [s, e] = row;
    if (text[s - 1] === ',') s--; else if (text[e] === ',') e++;
    text = text.slice(0, s) + text.slice(e); removed++;
  }
  return { text, removed, left };
}

/* rewrites every payload of a console or companion text whose inflated content carries a withheld name:
   {text, changes: [{id, removed}]}. Throws when a name sits outside a row the build can drop. */
export function scrubPayloads(text) {
  const changes = []; let out = '', last = 0;
  for (const r of blobs(text)) {
    if (!findWithheld(r.text, 1).length) continue;
    const id = payloadId(text, r.at), s = scrubRows(r.text);
    if (s.left.length) throw new Error(`the ${id} payload carries withheld name #${s.left[0].n} at offset ${s.left[0].at} of its inflated text, outside a data row the build can drop`);
    changes.push({ id, removed: s.removed });
    out += text.slice(last, r.at) + deflate(s.text); last = r.end;
  }
  return { text: out + text.slice(last), changes };
}

/* the withheld names in one text: [{n, at, id?}], the text outside the blobs first, then each blob inflated (id: its payload) */
export function findInText(text) {
  const runs = blobs(text), hits = []; let last = 0;
  const seg = (a, b) => { for (const h of findWithheld(text.slice(a, b), 1)) hits.push({ n: h.n, at: a + h.at }); };
  for (const r of runs) { seg(last, r.at); last = r.end; }
  seg(last, text.length);
  for (const r of runs) for (const h of findWithheld(r.text, 1)) hits.push({ n: h.n, at: h.at, id: payloadId(text, r.at) });
  return hits;
}

/* the entries of a zip (stored or deflated): [{name, text}], text null when the entry cannot be read */
export function zipEntries(buf) {
  const out = [];
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) return out;
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n && p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lh = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const d = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28), data = buf.subarray(d, d + csize);
    let text = null;
    try { text = method === 8 ? zlib.inflateRawSync(data).toString('latin1') : method === 0 ? data.toString('latin1') : null; } catch { /* unreadable */ }
    out.push({ name, text });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

const ZIPS = /\.(zip|skill|crx|jar|xlsx|docx|pptx)$/i;
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot|mp4|webm|mp3)$/i;
/* scans a folder tree: {files, payloads, problems: [string]}; every text file, every zip entry, every payload inflated.
   The problems name the file, the entry number and the payload, never the withheld name. */
export function scanTree(root, { skip = ['.git', 'node_modules'] } = {}) {
  const problems = []; let files = 0, payloads = 0;
  const one = (label, text) => {
    files++; payloads += blobs(text).length;
    for (const h of findInText(text)) problems.push(h.id ? `${label}: withheld name #${h.n} inside the ${h.id} payload at offset ${h.at}` : `${label}: withheld name #${h.n} in the text at offset ${h.at}`);
  };
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (skip.includes(e.name)) continue;
      const p = path.join(d, e.name), rel = path.relative(root, p);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.isFile() || BINARY.test(e.name)) continue;
      if (findWithheld(rel, 1).length) problems.push(`a path under ${path.dirname(rel) || '.'} carries withheld name #${findWithheld(rel, 1)[0].n}`);
      const buf = fs.readFileSync(p);
      if (!ZIPS.test(e.name)) { one(rel, buf.toString('latin1')); continue; }
      zipEntries(buf).forEach((z, i) => {
        if (findWithheld(z.name, 1).length) problems.push(`${rel}: zip entry #${i + 1}'s name carries withheld name #${findWithheld(z.name, 1)[0].n}`);
        if (z.text === null) problems.push(`${rel}: zip entry #${i + 1} cannot be read by the scan`);
        else if (!BINARY.test(z.name)) one(`${rel}!entry #${i + 1}`, z.text);
      });
    }
  };
  walk(root);
  return { files, payloads, problems };
}
