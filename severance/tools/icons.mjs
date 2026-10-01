/* Render the toolbar and store icons from one SVG with headless Chromium (Playwright from the container). node tools/icons.mjs */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* the mark: a dark green square, a pale green ring split down the middle (two households from one) */
export const SVG = s => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 128 128"><rect width="128" height="128" fill="#1b4332"/><path d="M58 30a34 34 0 0 0 0 68" fill="none" stroke="#95d5b2" stroke-width="13"/><path d="M70 30a34 34 0 0 1 0 68" fill="none" stroke="#ffffff" stroke-width="13"/><rect x="0" y="118" width="128" height="10" fill="#307a4f"/></svg>`;
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox'] });
for (const s of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: s, height: s }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0">${SVG(s)}</body></html>`);
  await page.screenshot({ path: path.join(ROOT, 'icons', `icon${s}.png`), omitBackground: true, clip: { x: 0, y: 0, width: s, height: s } });
  await page.close();
}
await browser.close();
console.log('icons written');
