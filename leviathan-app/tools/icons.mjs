/* Rasterize the console's mark into the toolbar and store icons: node tools/icons.mjs
   Playwright's Chromium renders the SVG (the same mark the console shows in its spine) at 16, 32, 48 and 128 pixels. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mark = size => {
  const small = size <= 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 34 34">` +
    `<rect x=".5" y=".5" width="33" height="33" rx="${small ? 7 : 8}" fill="#13242A" stroke="#E6AE48" stroke-opacity=".55"/>` +
    `<path d="M10.2 24.2h4.3v-2.3a6.6 6.6 0 1 1 5 0v2.3h4.3" fill="none" stroke="#E6AE48" stroke-width="${small ? 3 : 2.3}" stroke-linecap="round" stroke-linejoin="round"/>` +
    (small ? '' : '<path d="M7.6 28.4c2.2-1.5 4.4-1.5 6.6 0s4.4 1.5 6.6 0 4.4-1.5 6.6 0" fill="none" stroke="#6F9AA3" stroke-width="1.6" stroke-linecap="round"/>') +
    '</svg>';
};
let browser;
try { browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox'] }); }
catch (e) { browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] }); }
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${mark(size)}</body></html>`);
  await page.screenshot({ path: path.join(ROOT, 'icons', `icon${size}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`icons/icon${size}.png`);
}
await browser.close();
