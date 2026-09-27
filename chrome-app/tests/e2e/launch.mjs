/* Proven recipe for loading the unpacked extension into headless Chromium with Playwright in this container.
   Playwright's default headless build (chromium_headless_shell) cannot load extensions; the full 'chromium' channel with the new
   headless mode can. Usage:
     import { launchExtension } from './launch.mjs';
     const { context, id, page, errors, close } = await launchExtension();
     await page.goto(`chrome-extension://${id}/app.html#publish`); ... await close(); */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
export const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export async function launchExtension(opts) {
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: ['--disable-extensions-except=' + EXT, '--load-extension=' + EXT, '--no-sandbox'], viewport: { width: 1400, height: 1000 }, ...(opts || {}) });
  let sw = context.serviceWorkers()[0]; if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
  const id = new URL(sw.url()).host;
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return { context, id, page, errors, close: () => context.close() };
}
