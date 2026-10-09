import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { chromium, webkit } from '@playwright/test';

const require = createRequire(import.meta.url);
const { PNG } = require(join(dirname(require.resolve('playwright-core/package.json')), 'lib/utilsBundle.js'));
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
const browser = await (process.env.PROJECTION_BROWSER === 'webkit' ? webkit : chromium).launch();
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
  for (const width of [390, 1440]) {
    for (const mode of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript(theme => { if (window.top === window) localStorage.setItem('projection-docs-theme', theme); }, mode);
      await context.addInitScript(() => {
        window.__canvasContexts = [];
        for (const prototype of [HTMLCanvasElement.prototype, globalThis.OffscreenCanvas?.prototype].filter(Boolean)) {
          const original = prototype.getContext;
          prototype.getContext = function(type, ...args) { window.__canvasContexts.push(type); return original.call(this, type, ...args); };
        }
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let releaseChunks;
      const chunksReady = new Promise(resolve => { releaseChunks = resolve; });
      await page.route('**/_next/static/**/*.js', async route => { await chunksReady; await route.continue(); });
      try {
        await page.goto(origin, { waitUntil: 'commit' });
        await page.locator('.landing-project-card').waitFor();
        await page.waitForFunction(theme => document.documentElement.classList.contains(theme), mode);
        const bootGlow = await page.locator('.landing-project-card').evaluate(node => getComputedStyle(node, '::after').backgroundImage);
        assert.ok(bootGlow.includes(mode === 'light' ? 'rgb(0, 200, 255)' : 'rgb(201, 245, 58)'), 'Server-rendered glow follows the retained theme before hydration');
        if (mode === 'light') assert.ok(!bootGlow.includes('rgb(201, 245, 58)'), 'Light boot has no lime while application chunks are paused');
        const bootButton = await page.getByRole('button', { name: 'Save project', exact: true }).evaluate(node => getComputedStyle(node).backgroundImage);
        assert.ok(bootButton.includes(mode === 'light' ? 'rgb(54, 159, 255)' : 'rgb(161, 245, 91)'), 'Server-rendered primary button uses the retained partner endpoint');
        if (mode === 'light') assert.ok(!bootButton.includes('rgb(161, 245, 91)'), 'Light boot has no lime endpoint in primary buttons');
        assert.equal(await page.getByRole('link', { name: 'Read the docs', exact: true }).evaluate(node => getComputedStyle(node).backgroundImage), bootButton, 'Before hydration, the docs link shares the primary button gradient');
      } finally { releaseChunks(); }
      await page.waitForFunction(theme => document.querySelector('.landing-shell')?.getAttribute('data-ui-mode') === theme, mode);
      await page.evaluate(() => document.fonts.ready);
      const expected = mode === 'light' ? '#00C8FF' : '#C9F53A';
      const card = page.locator('.landing-project-card');
      assert.equal(await card.evaluate(node => getComputedStyle(node).getPropertyValue('--ui-primary').trim().toLowerCase()), expected.toLowerCase());
      const glow = await card.evaluate(node => getComputedStyle(node, '::after').backgroundImage);
      assert.ok(glow.includes(mode === 'light' ? 'rgb(0, 200, 255)' : 'rgb(201, 245, 58)'), 'Underglow follows the selected core palette');
      if (mode === 'light') assert.ok(!glow.includes('rgb(201, 245, 58)'), 'Retained light mode never uses the dark lime underglow');
      assert.equal(await page.locator('#landing-title.ui-gradient-text').count(), 1, 'The hero uses the library gradient heading');
      const docsLink = page.getByRole('link', { name: 'Read the docs', exact: true });
      assert.equal(await docsLink.getAttribute('href'), '/docs/');
      assert.equal(await docsLink.evaluate(node => node.classList.contains('ui-link-button')), true, 'The CTA uses the library navigation component');
      assert.equal(await docsLink.evaluate(node => getComputedStyle(node).backgroundImage), await page.getByRole('button', { name: 'Save project', exact: true }).evaluate(node => getComputedStyle(node).backgroundImage), 'The docs link shares the primary button gradient');
      const glowBand = page.locator('.nav-light');
      assert.equal(await glowBand.getAttribute('aria-hidden'), 'true');
      assert.equal(await glowBand.evaluate(node => getComputedStyle(node).pointerEvents), 'none');
      assert.equal(await glowBand.locator('button, a, iframe, [tabindex]').count(), 0, 'The sparkle band has no focus or input targets');
      const navGlow = await glowBand.evaluate(node => getComputedStyle(node, '::before').backgroundImage);
      assert.ok(navGlow.includes(mode === 'light' ? 'rgb(0, 200, 255)' : 'rgb(201, 245, 58)'), 'The nav light uses the active theme');
      if (mode === 'light') assert.ok(!navGlow.includes('rgb(201, 245, 58)'), 'Light nav has no green');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Landing does not overflow');
      await page.getByRole('radio', { name: 'Flat', exact: true }).click();
      assert.equal(await glowBand.evaluate(node => getComputedStyle(node).display), 'none', 'Flat removes nav light');
      assert.equal(await docsLink.evaluate(node => getComputedStyle(node).backgroundImage), 'none', 'Flat keeps the docs link solid');
      assert.equal(await card.evaluate(node => getComputedStyle(node, '::after').display), 'none', 'Flat removes the material underglow');
      await page.getByRole('radio', { name: 'Modern', exact: true }).click();
      const opposite = mode === 'light' ? 'dark' : 'light';
      await page.getByRole('button', { name: `Switch to ${opposite} theme`, exact: true }).click();
      await page.waitForFunction(theme => document.querySelector('.landing-shell')?.getAttribute('data-ui-mode') === theme, opposite);
      assert.equal(await card.evaluate(node => getComputedStyle(node).getPropertyValue('--ui-primary').trim().toLowerCase()), opposite === 'light' ? '#00c8ff' : '#c9f53a', 'Live toggling changes the material palette');
      await page.getByRole('button', { name: `Switch to ${mode} theme`, exact: true }).click();
      await page.waitForFunction(theme => document.querySelector('.landing-shell')?.getAttribute('data-ui-mode') === theme, mode);

      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.getByRole('button', { name: 'Copy AI prompt', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Prompt copied.' }).waitFor();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      assert.match(copied, /Oh great AI, take this elite component library/);
      assert.match(copied, /https:\/\/projectionui\.dev\/docs\//);
      await page.getByRole('textbox', { name: 'Project name' }).fill('A working preview');
      await page.getByRole('button', { name: 'Save project', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Saved in this preview.' }).waitFor();
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForFunction(() => document.querySelector('.nav-sparkles')?.dataset.sparklesState === 'active');
      const canvas = glowBand.locator('canvas');
      assert.equal(await canvas.count(), 1, 'One bounded 2D canvas renders the particles');
      const box = await glowBand.boundingBox();
      assert.ok(box.height <= 136 && box.width <= width, 'Particles stay in the nav light');
      assert.equal(await page.evaluate(() => window.__canvasContexts.includes('2d') && !window.__canvasContexts.some(type => type.startsWith('webgl'))), true, 'The effect requests only 2D drawing contexts');
      const clip = { x: Math.max(0, box.x), y: box.y, width: Math.floor(box.width), height: Math.floor(box.height) };
      const before = PNG.sync.read(await page.screenshot({ clip }));
      await page.waitForTimeout(500);
      const after = PNG.sync.read(await page.screenshot({ clip }));
      let changed = 0;
      for (let i = 0; i < before.data.length; i += 4) {
        if (Math.max(...[0, 1, 2].map(channel => Math.abs(after.data[i + channel] - before.data[i + channel]))) >= 3) changed++;
      }
      assert.ok(changed > 8, `Falling sparkles visibly animate (${changed} pixels)`);
      await page.screenshot({ path: `/tmp/projection-sparkles-${mode}-${width}.png` });
      await page.getByRole('button', { name: 'Pause sparkles', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.nav-light canvas'));
      assert.notEqual(await glowBand.evaluate(node => getComputedStyle(node, '::before').backgroundImage), 'none', 'Pause retains static underglow');
      await page.getByRole('button', { name: 'Resume sparkles', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.nav-sparkles')?.dataset.sparklesState === 'active');
      await page.getByRole('button', { name: `Switch to ${opposite} theme`, exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.nav-sparkles')?.dataset.sparklesState === 'active');
      assert.equal(await glowBand.locator('canvas').count(), 1, 'Theme changes leave one canvas');
      await page.getByRole('button', { name: `Switch to ${mode} theme`, exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.nav-sparkles')?.dataset.sparklesState === 'active');
      if (width === 1440 && mode === 'dark') {
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForFunction(() => !document.querySelector('.nav-light canvas'));
        await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForFunction(() => document.querySelector('.nav-sparkles')?.dataset.sparklesState === 'active');
        await page.locator('.landing-last').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => !document.querySelector('.nav-light canvas'));
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForFunction(() => document.querySelector('.nav-sparkles')?.dataset.sparklesState === 'active');
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => !document.querySelector('.nav-light canvas'));
      assert.equal(await page.getByRole('button', { name: 'Pause sparkles', exact: true }).count(), 0);
      await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
      assert.equal(await glowBand.evaluate(node => getComputedStyle(node).display), 'none');
      await page.emulateMedia({ forcedColors: 'none' });
      await page.waitForFunction(() => document.querySelector('.nav-sparkles')?.dataset.sparklesState === 'active');
      await page.getByRole('radio', { name: 'Flat', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.nav-light canvas'));
      assert.deepEqual(errors, [], 'The local sparkle effect leaves all controls usable without runtime errors');
      console.log(`Landing ${mode} at ${width}px: retained theme, gradient CTA, controls, 2D sparkles, pause, Flat, and motion safeguards passed.`);
      await context.close();
    }
  }
  console.log('Reader examples follow light and dark at mobile and desktop widths.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
