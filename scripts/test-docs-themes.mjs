import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve('docs-site/out');
const server = createServer((request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    let file = resolve(root, '.' + decodeURIComponent(pathname));
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    if (statSync(file).isDirectory()) file = resolve(file, 'index.html');
    response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[extname(file)] ?? 'application/octet-stream');
    response.end(readFileSync(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => { if (window.top === window) localStorage.setItem('projection-docs-theme', 'light'); });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/docs/components/button/`);
    const example = page.locator('.component-example').first();
    const iframe = example.locator('iframe');
    await iframe.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.component-example iframe')?.src.includes('globals=theme%3Alight'));
    const assertPreview = async (mode, accent) => {
      await page.waitForFunction(expected => document.querySelector('.component-example iframe')?.src.includes(`globals=theme%3A${expected}`), mode);
      const frame = await (await iframe.elementHandle()).contentFrame();
      await frame.locator('[data-ui-theme]').first().waitFor();
      await frame.waitForFunction(expected => getComputedStyle(document.querySelector('[data-ui-theme]')).getPropertyValue('--ui-primary').trim() === expected, accent);
      assert.ok((await iframe.getAttribute('src')).includes(`globals=theme%3A${mode}`));
      assert.ok((await example.getByRole('link').getAttribute('href')).includes(`globals=theme%3A${mode}`));
      assert.equal(await frame.evaluate(() => document.documentElement.dataset.previewTheme), mode);
    };
    await assertPreview('light', '#00C8FF');
    const toggle = async () => {
      const button = page.getByRole('button', { name: 'Toggle Theme', exact: true }).filter({ visible: true }).first();
      if (!await button.count()) await page.getByRole('button', { name: 'Open Sidebar', exact: true }).click();
      await page.getByRole('button', { name: 'Toggle Theme', exact: true }).filter({ visible: true }).first().click();
      const drawer = page.locator('#nd-sidebar-mobile');
      if (await drawer.isVisible()) {
        await drawer.getByRole('button', { name: 'Close Sidebar', exact: true }).click();
        await drawer.waitFor({ state: 'hidden' });
      }
    };
    await toggle();
    await assertPreview('dark', '#C9F53A');
    await toggle();
    await assertPreview('light', '#00C8FF');
    assert.deepEqual(errors, [], 'Theme changes do not cause hydration or runtime errors');
    await context.close();
  }
  console.log('Reader examples and explorer links follow light and dark modes at mobile and desktop widths.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
