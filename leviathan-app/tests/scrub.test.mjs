/* lib/scrub.mjs: the withheld names never ship. The build drops the data rows that carry one, the scan finds every other
   occurrence (plain text, inflated payloads, zip entries) and names the place without naming the name. The names are only
   ever decoded in memory here. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WITHHELD, decoded, findWithheld, scrubRows, scrubPayloads, findInText, inflate, deflate, blobs, payloadId, zipEntries, scanTree } from '../lib/scrub.mjs';
import { writeZip } from '../lib/patch.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const ok = (c, label, extra) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${extra !== undefined ? '  (' + String(extra).slice(0, 220) + ')' : ''}`); if (!c) fails++; };
const clean = s => !findWithheld(String(s), 1).length;   /* nothing printed by these tests may carry a name */

/* ---- the list and the matching ---- */
const one = decoded(0), word = decoded(3);
ok(WITHHELD.length === 4 && WITHHELD.every(w => /^[A-Za-z0-9+/=]+$/.test(w.b64)) && one.includes(' ') && word.length === 3, 'four encoded entries, one marked word');
ok(findWithheld('x ' + one.toUpperCase() + ' y').length === 1 && findWithheld(one.replace(/ /g, '')).length === 1 && findWithheld(one.replace(/ /g, '\n  ')).length === 1, 'an entry matches in any case, with the words joined or split across whitespace');
ok(findWithheld(word).length === 1 && !findWithheld(word.toLowerCase()).length && !findWithheld('st' + word.toLowerCase()).length && !findWithheld(word + 'IX').length && findWithheld('(' + word + ')').length === 1, 'the word entry matches as a whole word, case-sensitive');
ok(!findWithheld('A clean sentence about air conditioning and the top shelf.').length, 'ordinary words do not match');
ok(blobs('see H4sIAAAAAAAAA0lRz8nMy1bISM3JyQcA + more text here').length === 0 && blobs('x ' + deflate('tiny') + ' y').length === 1 && blobs('x ' + deflate('tiny') + ' y')[0].text === 'tiny', 'a base64 run is a blob only when it inflates');

/* ---- dropping rows ---- */
const row = `[2,"K ${one.toUpperCase()} LLC","AC","20261018",6]`;
let r = scrubRows(`{"rows":[[1,"A","x"],${row},[3,"B","z"]],"n":3}`);
ok(r.removed === 1 && !r.left.length && r.text === '{"rows":[[1,"A","x"],[3,"B","z"]],"n":3}', 'a middle row is dropped with its leading comma', r.text);
r = scrubRows(`[${row},[3,"B"]]`);
ok(r.removed === 1 && r.text === '[[3,"B"]]', 'a first row is dropped with the comma after it', r.text);
r = scrubRows(`[[1,"A"],${row}]`);
ok(r.removed === 1 && r.text === '[[1,"A"]]', 'a last row is dropped with the comma before it', r.text);
r = scrubRows(`[[1,"A"],${row},[4,"${word}","x"],[5,"C"]]`);
ok(r.removed === 2 && r.text === '[[1,"A"],[5,"C"]]', 'two rows, two entries, both dropped', r.text);
r = scrubRows(`{"title":"${one}","rows":[[1,"A"]]}`);
ok(r.removed === 0 && r.left.length === 1 && r.left[0].n === 1, 'a name outside a row is left and reported');
r = scrubRows(`[[1,"A [x]"],[2,"${one}",[3]]]`);
ok(r.removed === 0 && r.left.length === 1, 'a nested row is not guessed at');

/* ---- payloads ---- */
const dirty = `{"meta":{"n":2},"rows":[[1,"A","x"],${row}]}`, tidy = '{"clean":true,"rows":[[1,"A"]]}';
const html = `<p>a</p>\n<script type="text/plain" id="lvp-t">${deflate(dirty)}</script>\n<script type="text/plain" id="lvp-u">${deflate(tidy)}</script>\n<p>z</p>`;
ok(blobs(html).length === 2 && payloadId(html, blobs(html)[0].at) === 't' && payloadId(html, blobs(html)[1].at) === 'u', 'the blobs and their ids are found in a console');
let s = scrubPayloads(html);
ok(s.changes.length === 1 && s.changes[0].id === 't' && s.changes[0].removed === 1, 'the dirty payload is rewritten, the clean one left', JSON.stringify(s.changes));
const after = blobs(s.text);
ok(after.length === 2 && JSON.parse(inflate(s.text.slice(after[0].at, after[0].end))).rows.length === 1 && s.text.slice(after[1].at, after[1].end) === deflate(tidy) && s.text.startsWith('<p>a</p>') && s.text.endsWith('<p>z</p>'), 'the rewritten payload inflates to the rows without the dropped one; the rest of the text is byte for byte the same');
ok(!findInText(s.text).length && findInText(html).length === 1 && findInText(html)[0].id === 't', 'findInText sees the name inside the payload before and nothing after');
const js = `window.__LVP=window.__LVP||{};\nwindow.__LVP["t"]="${deflate(dirty)}";\n`;
s = scrubPayloads(js);
ok(s.changes.length === 1 && s.changes[0].id === 't' && /^window\.__LVP\["t"\]="H4sI[^"]+";\n$/.test(s.text.split('\n').slice(1).join('\n')) && !findInText(s.text).length, 'a companion script payload is rewritten in place');
let threw = null; try { scrubPayloads(`<script type="text/plain" id="lvp-v">${deflate(`{"title":"${one}"}`)}</script>`); } catch (e) { threw = e.message; }
ok(threw && /the v payload carries withheld name #1/.test(threw) && clean(threw), 'a name outside a row makes the build fail, without naming it', threw);
ok(findInText(`plain ${word} text`).length === 1 && findInText(`plain ${word} text`)[0].at === 6 && !findInText(`plain ${word} text`)[0].id, 'plain text hits carry the offset and no payload id');

/* ---- zip entries and the tree scan ---- */
const zip = writeZip([{ name: 'a/one.txt', data: Buffer.from('hello ' + one) }, { name: 'two.txt', data: Buffer.from('clean') }, { name: 'three.json', data: Buffer.from(JSON.stringify({ rows: [[1, 'x']] })) }], new Date(2026, 0, 1));
const ze = zipEntries(zip);
ok(ze.length === 3 && ze[0].name === 'a/one.txt' && ze[0].text.endsWith(one) && ze[1].text === 'clean', 'zip entries are read back', ze.map(z => z.name).join(','));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-scrub-'));
fs.mkdirSync(path.join(tmp, 'sub'));
fs.writeFileSync(path.join(tmp, 'x.zip'), zip);
fs.writeFileSync(path.join(tmp, 'sub', 'c.txt'), 'a line with ' + one.toUpperCase() + ' in it');
fs.writeFileSync(path.join(tmp, 'sub', 'd.png'), 'binary ' + one);
fs.writeFileSync(path.join(tmp, 'sub', 'e.html'), html);
fs.writeFileSync(path.join(tmp, 'ok.md'), 'nothing here');
fs.mkdirSync(path.join(tmp, 'node_modules')); fs.writeFileSync(path.join(tmp, 'node_modules', 'n.txt'), one);
const t = scanTree(tmp);
ok(t.files === 6 && t.payloads === 2, 'the scan reads the text files, the zip entries and the payloads, skipping images and node_modules', `${t.files} files, ${t.payloads} payloads`);
ok(t.problems.length === 3 && t.problems.some(p => p.startsWith('x.zip!entry #1:')) && t.problems.some(p => p.startsWith(path.join('sub', 'c.txt') + ':')) && t.problems.some(p => p.includes('e.html: withheld name #1 inside the t payload')), 'each occurrence is reported by file, entry and payload', t.problems.join(' | '));
ok(t.problems.every(clean), 'the reports never carry the name');
fs.rmSync(tmp, { recursive: true, force: true });

/* ---- the repository ---- */
const repo = fs.existsSync(path.join(ROOT, '..', '.git')) ? path.resolve(ROOT, '..') : ROOT;
const t0 = Date.now();
const R = scanTree(repo);
ok(R.problems.length === 0, `nothing withheld anywhere under ${path.basename(repo)}/`, `${R.files} files, ${R.payloads} payloads, ${Date.now() - t0} ms${R.problems.length ? ': ' + R.problems.slice(0, 5).join(' | ') : ''}`);

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
