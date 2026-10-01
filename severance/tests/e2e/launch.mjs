/* Load the unpacked Severance extension into headless Chromium with Playwright (the recipe proven for the Thermal Atlas in this
   container: the full 'chromium' channel with the new headless mode can load extensions; the headless shell cannot).
     import { launchExtension, openFile } from './launch.mjs';
     const { context, id, page, errors, close } = await launchExtension();  await page.goto(`chrome-extension://${id}/app.html#publish`);
     const { page, errors, close } = await openFile('/abs/path/Severance_2.html'); */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
export const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const watch = (page, errors) => { page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); }); };
export async function launchExtension(opts) {
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: ['--disable-extensions-except=' + EXT, '--load-extension=' + EXT, '--no-sandbox'], viewport: { width: 1400, height: 1000 }, ...(opts || {}) });
  let sw = context.serviceWorkers()[0]; if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
  const id = new URL(sw.url()).host;
  const page = await context.newPage(); const errors = []; watch(page, errors);
  return { context, id, sw, page, errors, close: () => context.close() };
}
export async function openFile(file, opts) {
  const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, ...(opts || {}) }); const errors = []; watch(page, errors);
  await page.goto('file://' + file, { waitUntil: 'load', timeout: 120000 });
  return { browser, page, errors, close: () => browser.close() };
}
