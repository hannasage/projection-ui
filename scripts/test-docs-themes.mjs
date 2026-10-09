import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const { PNG } = require(join(dirname(require.resolve('playwright-core/package.json')), 'lib/utilsBundle.js'));
const upstreamURL = 'https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js';
const upstreamFixture = process.env.PROJECTION_UPSTREAM_RUNTIME_FIXTURE ?? '/tmp/projection-upstream-tubes-0.0.19.js';
let upstreamBytes;
if (process.env.PROJECTION_CURSOR_LIVE_CDN !== '1') {
  if (existsSync(upstreamFixture)) upstreamBytes = readFileSync(upstreamFixture);
  else {
    const response = await fetch(upstreamURL, { signal: AbortSignal.timeout(20000) });
    assert.equal(response.ok, true, 'The pinned upstream runtime must be available for this browser test');
    upstreamBytes = Buffer.from(await response.arrayBuffer());
  }
  assert.equal(createHash('sha256').update(upstreamBytes).digest('hex'), '676abd6ccd18742a36dcb4ffce66a2052a4f203f240cd8cf97c6ea33a181f81b', 'The routed graphics runtime is the exact pinned upstream file');
}
async function graphicsContext(options) {
  const context = await browser.newContext(options);
  if (upstreamBytes) await context.route(upstreamURL, route => route.fulfill({ body: upstreamBytes, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await context.addInitScript(() => {
    if (window.top === window) return;
    window.__projectionMessages = [];
    addEventListener('message', event => {
      if (event.source === parent && event.data?.nonce === location.hash.slice(1)) window.__projectionMessages.push(event.data);
    });
  });
  return context;
}
function keepCursorAlive(page, box) {
  let stopped = false, failure;
  let step = 0;
  const deadline = Date.now() + 40000;
  const loop = (async () => {
    while (!stopped && Date.now() < deadline) {
      // Real mouse input keeps the public interaction alive during slow software rendering.
      await page.mouse.move(box.x + box.width * .52 + step++ % 2, box.y + 44);
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  })().catch(error => { failure = error; });
  return async () => { stopped = true; await loop; if (failure) throw failure; };
}
async function cursorScene(page, retainKeepAlive = false) {
  const flow = page.locator('.landing-flow');
  const hero = page.locator('.landing-hero');
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('.landing-hero').getBoundingClientRect().top >= 0);
  const box = await hero.boundingBox();
  await page.mouse.move(0, 0);
  await page.mouse.move(box.x + box.width * .23, box.y + 36);
  const stopKeepAlive = keepCursorAlive(page, box);
  try {
    await page.waitForFunction(() => document.querySelector('.landing-flow')?.dataset.flowState === 'active');
    await page.waitForFunction(() => Number(document.querySelector('.landing-flow')?.dataset.frames) > 0);
    const iframe = flow.locator('iframe');
    const frame = await (await iframe.elementHandle()).contentFrame();
    await frame.locator('canvas').waitFor();
    if (!retainKeepAlive) await stopKeepAlive();
    return { flow, hero, box, iframe, frame, stopKeepAlive };
  } catch (error) { await stopKeepAlive(); throw error; }
}
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
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
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
      const context = await graphicsContext({ viewport: { width, height: 1000 } });
      await context.addInitScript(theme => { if (window.top === window) localStorage.setItem('projection-docs-theme', theme); }, mode);
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
      const flow = page.locator('.landing-flow');
      assert.equal(await flow.getAttribute('aria-hidden'), 'true');
      assert.equal(await flow.evaluate(node => getComputedStyle(node).pointerEvents), 'none');
      assert.equal(await flow.locator('button, a, [tabindex]:not([tabindex="-1"])').count(), 0, 'Decorative flow has no focus targets');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Landing does not overflow');
      await page.getByRole('radio', { name: 'Flat', exact: true }).click();
      assert.equal(await flow.evaluate(node => getComputedStyle(node).display), 'none', 'Flat removes decorative flowing light');
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
      const hero = page.locator('.landing-hero');
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForFunction(() => document.querySelector('.landing-hero').getBoundingClientRect().top >= 0);
      const box = await hero.boundingBox();
      await page.keyboard.press('Escape');
      await page.mouse.move(0, 0);
      assert.equal(await flow.locator('iframe').count(), 0, 'No idle or mobile canopy is mounted');
      const clip = { x: box.x, y: box.y, width: Math.floor(box.width), height: Math.floor(Math.min(box.height, 1000 - box.y)) };
      const idle = PNG.sync.read(await page.screenshot({ clip }));
      const scene = await cursorScene(page, true);
      let nonce;
      try {
      assert.equal(await scene.iframe.getAttribute('sandbox'), 'allow-scripts', 'The upstream renderer has no same-origin permission');
      assert.equal(await scene.iframe.getAttribute('tabindex'), '-1');
      assert.ok(await scene.frame.locator('canvas').evaluate(node => node.width > 0 && node.height > 0), 'The initialized upstream renderer has a sized drawing buffer');
      assert.equal(await scene.frame.evaluate(() => {
        try { void parent.document.body; return false; } catch (error) { return error.name === 'SecurityError'; }
      }), true, 'The upstream realm cannot read the parent document');
      assert.equal(await scene.frame.evaluate(() => {
        try { void parent.localStorage; return false; } catch (error) { return error.name === 'SecurityError'; }
      }), true, 'The upstream realm cannot read parent storage');
      nonce = await scene.iframe.getAttribute('data-nonce');
      await page.evaluate(nonce => window.postMessage({ type: 'projection-error', nonce, message: 'Forged parent error' }, '*'), nonce);
      await scene.frame.evaluate(() => parent.postMessage({ type: 'projection-error', nonce: 'wrong-nonce', message: 'Forged frame error' }, '*'));
      await page.waitForTimeout(100);
      assert.equal(await flow.getAttribute('data-flow-state'), 'active', 'Wrong-source and wrong-nonce messages do not alter graphics state');
      const before = Number(await flow.getAttribute('data-frames'));
      await page.mouse.move(box.x + box.width * .15, box.y + Math.min(280, box.height * .3));
      await page.mouse.move(box.x + box.width * .7, box.y + Math.min(160, box.height * .2), { steps: 16 });
      await page.waitForFunction(count => Number(document.querySelector('.landing-flow')?.dataset.frames) > count + 3, before);
      const active = PNG.sync.read(await page.screenshot({ clip }));
      let visiblePixels = 0;
      for (let i = 0; i < idle.data.length; i += 4) {
        if (Math.max(...[0, 1, 2].map(channel => Math.abs(active.data[i + channel] - idle.data[i + channel]))) >= 12) visiblePixels++;
      }
      assert.ok(visiblePixels >= 100, `${mode} ${width}px exact upstream tube movement paints visible light (${visiblePixels} pixels)`);
      await page.screenshot({ path: `/tmp/projection-tubes-${mode}-${width}.png`, fullPage: false });
      await scene.frame.waitForFunction(expected => window.__projectionMessages.some(message => message.type === 'projection-init' && message.colors[0].toLowerCase() === expected), expected.toLowerCase());
      // Theme changes destroy the old stock renderer and select bloom at initialization.
      await scene.stopKeepAlive();
      await page.getByRole('button', { name: `Switch to ${opposite} theme`, exact: true }).evaluate(node => node.click());
      await page.waitForFunction(() => !document.querySelector('.landing-flow iframe'));
      const oppositeScene = await cursorScene(page, true);
      try {
        assert.notEqual(await oppositeScene.iframe.getAttribute('data-nonce'), nonce, 'Theme changes use a fresh authenticated renderer realm');
        await oppositeScene.frame.waitForFunction(expected => window.__projectionMessages.some(message => message.type === 'projection-init' && message.colors[0].toLowerCase() === expected), opposite === 'light' ? '#00c8ff' : '#c9f53a');
      } finally { await oppositeScene.stopKeepAlive(); }
      await page.getByRole('button', { name: `Switch to ${mode} theme`, exact: true }).evaluate(node => node.click());
      await page.waitForFunction(() => !document.querySelector('.landing-flow iframe'));
      const restoredScene = await cursorScene(page, true);
      try {
        await restoredScene.frame.waitForFunction(expected => window.__projectionMessages.some(message => message.type === 'projection-init' && message.colors[0].toLowerCase() === expected), expected.toLowerCase());
      } finally { await restoredScene.stopKeepAlive(); }
      } finally { await scene.stopKeepAlive(); }
      await page.waitForFunction(() => document.querySelector('.landing-flow')?.dataset.flowState === 'still');
      assert.equal(await flow.locator('iframe').count(), 0, 'Idle input destroys the entire upstream renderer realm');
      const settled = await flow.getAttribute('data-frames');
      await page.waitForTimeout(180);
      assert.equal(await flow.getAttribute('data-frames'), settled, 'Removed renderer emits no frames');
      if (width === 1440 && mode === 'dark') {
      const recreated = await cursorScene(page);
      assert.notEqual(await recreated.iframe.getAttribute('data-nonce'), nonce, 'Fresh pointer input creates a new authenticated realm');
      await page.keyboard.press('Escape');
      assert.equal(await flow.locator('iframe').count(), 0, 'Keyboard input destroys the renderer');
      for (const pointerType of ['touch', 'pen']) {
        await hero.dispatchEvent('pointermove', { pointerType, clientX: box.x + 50, clientY: box.y + 24 });
        assert.equal(await flow.locator('iframe').count(), 0, `${pointerType} does not create graphics or capture the page gesture`);
      }
      await cursorScene(page);
      await page.mouse.move(0, 0);
      assert.equal(await flow.locator('iframe').count(), 0, 'Mouse leave removes the renderer');
      await cursorScene(page);
      await page.evaluate(() => scrollBy(0, 10));
      await page.waitForFunction(() => !document.querySelector('.landing-flow iframe'));
      await page.evaluate(() => scrollTo(0, 0));
      await cursorScene(page);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal(await flow.locator('iframe').count(), 0, 'Hidden document removes the renderer');
      await page.evaluate(() => {
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await cursorScene(page);
      await page.getByRole('radio', { name: 'Flat', exact: true }).click();
      assert.equal(await flow.locator('iframe').count(), 0, 'Flat destroys the renderer');
      await page.getByRole('radio', { name: 'Modern', exact: true }).click();
      await cursorScene(page);
      await page.setViewportSize({ width, height: 500 });
      await page.locator('.landing-last').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('.landing-hero').getBoundingClientRect().bottom <= 0);
      await page.waitForFunction(() => document.querySelector('.landing-flow')?.getAttribute('data-in-view') === 'false');
      assert.equal(await flow.locator('iframe').count(), 0, 'Offscreen hero destroys the renderer');
      await hero.scrollIntoViewIfNeeded();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await hero.dispatchEvent('pointermove', { pointerType: 'mouse', clientX: box.x + 50, clientY: box.y + 24 });
      assert.equal(await flow.locator('iframe').count(), 0, 'Reduced motion does not create a renderer');
      await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
      await hero.dispatchEvent('pointermove', { pointerType: 'mouse', clientX: box.x + 50, clientY: box.y + 24 });
      assert.equal(await flow.locator('iframe').count(), 0, 'Forced colors do not create a renderer');
      }
      assert.deepEqual(errors, [], 'Landing effects and working controls cause no runtime errors');
      console.log(`Landing ${mode} at ${width}px: retained boot, hydration, live theme switch, Flat, controls, real cursor frames/pixels, and idle removal passed${width === 1440 && mode === 'dark' ? ' with the full lifecycle checks' : ''}.`);
      await context.close();
    }
  }
  {
    const context = await graphicsContext({ viewport: { width: 390, height: 900 } });
    await context.route(upstreamURL, async route => {
      await new Promise(resolve => setTimeout(resolve, 3200));
      if (upstreamBytes) await route.fulfill({ body: upstreamBytes, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } });
      else await route.continue();
    });
    const page = await context.newPage();
    await page.goto(origin);
    await page.locator('.landing-shell[data-ui-theme]').waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.landing-flow iframe').count(), 0, 'Keyboard navigation does not initialize the cursor');
    const hero = page.locator('.landing-hero');
    const box = await hero.boundingBox();
    await page.mouse.move(box.x + 40, box.y + 50);
    await page.waitForFunction(() => document.querySelector('.landing-flow')?.dataset.flowState === 'loading');
    await page.waitForTimeout(2700);
    assert.equal(await page.locator('.landing-flow iframe').count(), 1, 'Initialization survives the normal idle deadline');
    await page.waitForFunction(() => Number(document.querySelector('.landing-flow')?.dataset.frames) > 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.landing-flow iframe').count(), 0, 'Keyboard navigation removes a completed slow initialization');
    await page.mouse.move(box.x + 90, box.y + 50);
    await page.waitForFunction(() => document.querySelector('.landing-flow')?.dataset.flowState === 'loading');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(3400);
    assert.equal(await page.locator('.landing-flow iframe').count(), 0, 'A late module response cannot recreate a keyboard-dismissed realm');
    await context.close();
  }
  const touch = await graphicsContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
  const touchPage = await touch.newPage();
  await touchPage.goto(origin);
  await touchPage.locator('.landing-shell').waitFor();
  await touchPage.locator('.landing-hero').dispatchEvent('pointermove', { pointerType: 'touch', clientX: 100, clientY: 150 });
  assert.equal(await touchPage.locator('.landing-flow iframe').count(), 0, 'A touch device has no decorative canopy');
  await touch.close();
  for (const failure of ['network', 'unavailable', 'lost']) {
    const context = await graphicsContext({ viewport: { width: 390, height: 900 } });
    if (failure === 'network') await context.route(upstreamURL, route => route.abort('failed'));
    if (failure === 'unavailable') await context.addInitScript(() => {
      if (window.top === window) return;
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type === 'webgl2' || type === 'webgl' ? null : getContext.call(this, type, ...args);
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.locator('.landing-shell[data-ui-theme]').waitFor();
    const flow = page.locator('.landing-flow');
    const hero = page.locator('.landing-hero');
    const box = await hero.boundingBox();
    await page.mouse.move(box.x + 40, box.y + 50);
    if (failure === 'lost') {
      await page.waitForFunction(() => Number(document.querySelector('.landing-flow')?.dataset.frames) > 0);
      const frame = await (await flow.locator('iframe').elementHandle()).contentFrame();
      await frame.locator('canvas').dispatchEvent('webglcontextlost');
    }
    await page.waitForFunction(() => document.querySelector('.landing-flow')?.dataset.flowState === 'unavailable');
    assert.equal(await flow.locator('iframe').count(), 0, 'Graphics failure destroys the isolated runtime');
    await page.getByRole('textbox', { name: 'Project name' }).fill('Still usable');
    await page.getByRole('button', { name: 'Save project', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Saved in this preview.' }).waitFor();
    assert.deepEqual(errors, [], `${failure} leaves controls usable without page errors`);
    await context.close();
  }
  console.log('Reader examples and explorer links follow light and dark modes at mobile and desktop widths.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
