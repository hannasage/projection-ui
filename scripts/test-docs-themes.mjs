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
  for (const width of [390, 1440]) {
    for (const mode of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript(theme => localStorage.setItem('projection-docs-theme', theme), mode);
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
      } finally { releaseChunks(); }
      await page.waitForFunction(theme => document.querySelector('.landing-shell')?.getAttribute('data-ui-mode') === theme, mode);
      await page.evaluate(() => document.fonts.ready);
      const expected = mode === 'light' ? '#00C8FF' : '#C9F53A';
      const card = page.locator('.landing-project-card');
      assert.equal(await card.evaluate(node => getComputedStyle(node).getPropertyValue('--ui-primary').trim()), expected);
      const glow = await card.evaluate(node => getComputedStyle(node, '::after').backgroundImage);
      assert.ok(glow.includes(mode === 'light' ? 'rgb(0, 200, 255)' : 'rgb(201, 245, 58)'), 'Underglow follows the selected core palette');
      if (mode === 'light') assert.ok(!glow.includes('rgb(201, 245, 58)'), 'Retained light mode never uses the dark lime underglow');
      assert.equal(await page.locator('#landing-title.ui-gradient-text').count(), 1, 'The hero uses the library gradient heading');
      const flow = page.locator('.landing-flow');
      assert.equal(await flow.getAttribute('aria-hidden'), 'true');
      assert.equal(await flow.evaluate(node => getComputedStyle(node).pointerEvents), 'none');
      assert.equal(await flow.locator('button, a, [tabindex]').count(), 0, 'Decorative flow has no focus targets');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Landing does not overflow');
      await page.getByRole('radio', { name: 'Flat', exact: true }).click();
      assert.equal(await flow.evaluate(node => getComputedStyle(node).display), 'none', 'Flat removes decorative flowing light');
      assert.equal(await card.evaluate(node => getComputedStyle(node, '::after').display), 'none', 'Flat removes the material underglow');
      await page.getByRole('radio', { name: 'Modern', exact: true }).click();
      const opposite = mode === 'light' ? 'dark' : 'light';
      await page.getByRole('button', { name: `Switch to ${opposite} theme`, exact: true }).click();
      await page.waitForFunction(theme => document.querySelector('.landing-shell')?.getAttribute('data-ui-mode') === theme, opposite);
      assert.equal(await card.evaluate(node => getComputedStyle(node).getPropertyValue('--ui-primary').trim()), opposite === 'light' ? '#00C8FF' : '#C9F53A', 'Live toggling changes the material palette');
      await page.getByRole('button', { name: `Switch to ${mode} theme`, exact: true }).click();
      await page.waitForFunction(theme => document.querySelector('.landing-shell')?.getAttribute('data-ui-mode') === theme, mode);

      await page.getByRole('textbox', { name: 'Project name' }).fill('A working preview');
      await page.getByRole('button', { name: 'Save project', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Saved in this preview.' }).waitFor();
      const hero = page.locator('.landing-hero');
      const box = await hero.boundingBox();
      await page.mouse.move(box.x + box.width * .8, box.y + 30);
      if (width > 680) await page.waitForFunction(() => document.querySelector('.landing-flow-pointer')?.style.transform.includes('translate'));
      await page.setViewportSize({ width, height: 500 });
      await page.locator('.landing-last').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('.landing-hero').getBoundingClientRect().bottom <= 0);
      assert.ok(await hero.evaluate(node => node.getBoundingClientRect().bottom <= 0), 'Hero is fully outside the viewport before testing its pause');
      await page.waitForFunction(() => document.querySelector('.landing-flow')?.getAttribute('data-in-view') === 'false');
      assert.equal(await flow.locator('.landing-flow-drift').evaluate(node => getComputedStyle(node).animationPlayState), 'paused', 'Offscreen hero pauses its finite motion');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await hero.scrollIntoViewIfNeeded();
      assert.equal(await flow.locator('.landing-flow-drift').evaluate(node => getComputedStyle(node).animationName), 'none', 'Reduced motion keeps static light');
      await page.emulateMedia({ forcedColors: 'active' });
      assert.equal(await flow.evaluate(node => getComputedStyle(node).display), 'none', 'Forced colors remove decorative light');
      assert.deepEqual(errors, [], 'Landing effects and working controls cause no runtime errors');
      console.log(`Landing ${mode} at ${width}px: retained boot, hydration, live theme switch, Flat, controls, pointer, offscreen pause, reduced motion, and forced colors passed.`);
      await context.close();
    }
  }
  console.log('Reader examples and explorer links follow light and dark modes at mobile and desktop widths.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
