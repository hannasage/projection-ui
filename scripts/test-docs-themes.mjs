import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
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
    response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg' }[extname(file)] ?? 'application/octet-stream');
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
      await context.addInitScript(theme => { if (window.top === window && !localStorage.getItem('projection-docs-theme')) localStorage.setItem('projection-docs-theme', theme); }, mode);
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
      const toggleLandingTheme = async next => {
        const picker = page.locator('.landing-theme-picker');
        if (!await picker.evaluate(node => node.open)) await picker.locator('summary').click();
        const control = picker.locator('.landing-mode-control');
        for (let attempt = 0; attempt < 3 && await control.getAttribute('data-color-mode') !== next; attempt++) { const previous = await control.getAttribute('data-color-mode'); await control.click(); await page.waitForFunction(previous => document.querySelector('.landing-mode-control')?.dataset.colorMode !== previous, previous); }
        assert.equal(await control.getAttribute('data-color-mode'), next);
        await picker.locator('summary').click();
      };
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
        assert.equal(await page.getByRole('button', { name: 'Copy AI Prompt', exact: true }).evaluate(node => getComputedStyle(node).backgroundImage), bootButton, 'Before hydration, the copy action shares the primary button gradient');
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
      assert.equal((await docsLink.boundingBox()).height, 40, 'The docs button retains the original main button height');
      assert.equal((await page.getByRole('button', { name: 'Copy AI Prompt', exact: true }).boundingBox()).height, 40, 'The main button retains its original height');
      assert.equal(await docsLink.evaluate(node => node.classList.contains('ui-link-button')), true, 'The CTA uses the library navigation component');
      const copyButton = page.getByRole('button', { name: 'Copy AI Prompt', exact: true });
      assert.equal(await copyButton.evaluate(node => getComputedStyle(node).backgroundImage), await page.getByRole('button', { name: 'Save project', exact: true }).evaluate(node => getComputedStyle(node).backgroundImage), 'The copy action shares the primary button gradient');
      for (const button of [copyButton, docsLink, page.getByRole('button', { name: 'Save project', exact: true }), page.getByRole('link', { name: 'Open Storybook', exact: true })]) {
        const layers = await button.evaluate(node => { const face = getComputedStyle(node, '::before'); const glow = getComputedStyle(node, '::after'); return {faceZ:face.zIndex,glowZ:glow.zIndex,spread:glow.top,blur:glow.filter,faceBackground:face.backgroundImage,faceColor:face.backgroundColor,backdrop:face.backdropFilter || face.webkitBackdropFilter}; });
        assert.ok(Number(layers.faceZ) > Number(layers.glowZ), 'The button face covers the glow');
        assert.equal(layers.spread, '-7px', 'The glow spread is halved');
        assert.equal(layers.blur, 'blur(6px)', 'The glow blur is halved');
        if (await button.evaluate(node => node.classList.contains('landing-outline'))) { const channels = layers.faceColor.match(/[\d.]+/g).map(Number); assert.equal(channels[3], .9, 'Outlined buttons have a 90% opaque glass face'); assert.ok(channels.slice(0,3).every(channel => mode === 'light' ? channel > .9 : channel < .1), 'Glass surfaces follow the active light or dark theme'); assert.equal(layers.backdrop, 'blur(12px)'); }
        else assert.ok(layers.faceBackground.includes('linear-gradient'), 'Filled faces cover the glow with the theme gradient');
      }
      assert.equal(await docsLink.evaluate(node => getComputedStyle(node).borderTopColor), mode === 'light' ? 'rgb(0, 200, 255)' : 'rgb(201, 245, 58)', 'The outlined action follows the theme');
      assert.match(await page.locator('.landing-ai-prompt code').innerText(), /Oh great AI/);
      assert.match(await page.locator('.landing-ai-prompt code').evaluate(node => getComputedStyle(node).fontFamily), /monospace/i);
      assert.equal(await page.getByRole('link', { name: 'Star on GitHub', exact: true }).getAttribute('href'), 'https://github.com/hannasage/projection-ui');
      assert.equal(await page.getByRole('link', { name: 'Open Storybook', exact: true }).getAttribute('href'), '/examples/?path=/story/gallery-components--paired');
      const footer = page.locator('.landing-footer');
      assert.equal(await footer.evaluate(node => getComputedStyle(node).color), 'rgb(7, 9, 12)');
      assert.ok((await footer.evaluate(node => getComputedStyle(node).backgroundImage)).includes(mode === 'light' ? 'rgb(0, 200, 255)' : 'rgb(201, 245, 58)'), 'The footer uses the active gradient');
      const demo = page.locator('[data-scroll-scene="demo"]');
      const initialTransform = await demo.evaluate(node => getComputedStyle(node).transform);
      await page.evaluate(() => scrollTo(0, 240));
      await page.waitForFunction(initial => getComputedStyle(document.querySelector('[data-scroll-scene="demo"]')).transform !== initial, initialTransform);
      await page.evaluate(() => scrollTo(0, 0));
      await copyButton.scrollIntoViewIfNeeded();
      const copyBox = await copyButton.boundingBox();
      await page.mouse.move(copyBox.x + copyBox.width / 2, copyBox.y + copyBox.height / 2);
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.landing-primary'), '::after').opacity) > .45);
      const nearGlow = await copyButton.evaluate(node => Number(getComputedStyle(node, '::after').opacity));
      assert.ok(nearGlow <= .5, 'Proximity light has half its former peak intensity');
      assert.match(await copyButton.evaluate(node => getComputedStyle(node).boxShadow), /2.5px 8px 0px/, 'The filled button ambient glow also has half its former blur');
      await page.mouse.move(width - 1, 1);
      await page.waitForFunction(near => Number(getComputedStyle(document.querySelector('.landing-primary'), '::after').opacity) < near * .25, nearGlow);
      for (const target of [docsLink, page.getByRole('button', { name: 'Save project', exact: true })]) {
        await target.scrollIntoViewIfNeeded();
        const bounds = await target.boundingBox();
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.waitForFunction(() => [...document.querySelectorAll('[data-proximity-glow]')].some(node => Number(node.style.getPropertyValue('--button-glow')) === 1));
        assert.equal(await target.evaluate(node => node.style.getPropertyValue('--button-glow')), '1', 'The docs and save actions also track proximity');
      }
      await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })));
      await page.waitForFunction(() => [...document.querySelectorAll('[data-proximity-glow]')].every(node => node.style.getPropertyValue('--button-glow') === '0'));
      await page.getByRole('textbox', { name: 'Project name' }).fill('');
      const disabledSave = page.getByRole('button', { name: 'Save project', exact: true });
      const disabledBounds = await disabledSave.boundingBox();
      await page.mouse.move(disabledBounds.x + 10, disabledBounds.y + 10);
      assert.equal(await disabledSave.isDisabled(), true);
      assert.equal(await disabledSave.evaluate(node => getComputedStyle(node, '::after').display), 'none', 'Disabled actions do not invite clicks with glow');
      await page.getByRole('textbox', { name: 'Project name' }).fill('A working preview');
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-scroll-scene="demo"]')).transform === 'none');
      assert.equal(await demo.evaluate(node => getComputedStyle(node).transform), 'none', 'Keyboard navigation uses the static composition');
      await page.evaluate(() => scrollTo(0, 0));
      const glowBand = page.locator('.nav-light');
      assert.equal(await glowBand.getAttribute('aria-hidden'), 'true');
      assert.equal(await glowBand.evaluate(node => getComputedStyle(node).pointerEvents), 'none');
      assert.equal(await glowBand.locator('button, a, iframe, [tabindex]').count(), 0, 'The sparkle band has no focus or input targets');
      const navGlow = await glowBand.evaluate(node => getComputedStyle(node, '::before').backgroundImage);
      assert.ok(navGlow.includes(mode === 'light' ? 'rgb(0, 200, 255)' : 'rgb(201, 245, 58)'), 'The nav light uses the active theme');
      if (mode === 'light') assert.ok(!navGlow.includes('rgb(201, 245, 58)'), 'Light nav has no green');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Landing does not overflow');
      await page.getByRole('radio', { name: 'Flat', exact: true }).click();
      for (const button of [copyButton, page.getByRole('button', { name: 'Save project', exact: true })]) assert.equal(await button.evaluate(node => getComputedStyle(node).boxShadow), 'none', 'Flat filled buttons have no ambient light');
      assert.equal(await glowBand.evaluate(node => getComputedStyle(node).display), 'none', 'Flat removes nav light');
      assert.equal(await docsLink.evaluate(node => getComputedStyle(node).backgroundImage), 'none', 'Flat keeps the docs link solid');
      assert.equal(await card.evaluate(node => getComputedStyle(node, '::after').display), 'none', 'Flat removes the material underglow');
      await page.getByRole('radio', { name: 'Modern', exact: true }).click();
      const opposite = mode === 'light' ? 'dark' : 'light';
      await toggleLandingTheme(opposite);
      await page.waitForFunction(theme => document.querySelector('.landing-shell')?.getAttribute('data-ui-mode') === theme, opposite);
      assert.equal(await card.evaluate(node => getComputedStyle(node).getPropertyValue('--ui-primary').trim().toLowerCase()), opposite === 'light' ? '#00c8ff' : '#c9f53a', 'Live toggling changes the material palette');
      await toggleLandingTheme(mode);
      await page.waitForFunction(theme => document.querySelector('.landing-shell')?.getAttribute('data-ui-mode') === theme, mode);

      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.getByRole('button', { name: 'Copy AI Prompt', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Prompt copied.' }).waitFor();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      assert.match(copied, /Oh great AI, take this elite component library/);
      assert.match(copied, /https:\/\/projectionui\.dev\/docs\//);
      await page.getByRole('textbox', { name: 'Project name' }).fill('A working preview');
      await page.getByRole('button', { name: 'Save project', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Saved in this preview.' }).waitFor();
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForFunction(() => document.querySelector('.nav-sparkles')?.dataset.sparklesState === 'active');
      const particleData = page.locator('.nav-sparkles');
      assert.equal(await particleData.getAttribute('data-particle-count'), '70', 'The engine creates 30 percent more particles, rounded to a whole particle');
      const particlePaint = await particleData.getAttribute('data-particle-color');
      const paintNumbers = particlePaint.match(/[\d.]+/g).map(Number);
      assert.ok(paintNumbers[1] > 60, 'Rendered particles have saturated theme color');
      assert.ok(mode === 'light' ? paintNumbers[2] < 40 : paintNumbers[2] > 65, 'Particle paint is dark on light and bright on dark');
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
      if (mode === 'light') {
        let darkBluePixels = 0;
        for (let i = 0; i < after.data.length; i += 4) {
          if (after.data[i] < 185 && after.data[i + 2] > after.data[i] + 15 && after.data[i + 1] < 215) darkBluePixels++;
        }
        assert.ok(darkBluePixels > 8, 'Light particles leave visible dark blue marks on the pale glow');
      }
      await page.screenshot({ path: `/tmp/projection-landing-${mode}-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Pause sparkles', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.nav-light canvas'));
      assert.notEqual(await glowBand.evaluate(node => getComputedStyle(node, '::before').backgroundImage), 'none', 'Pause retains static underglow');
      await page.getByRole('button', { name: 'Resume sparkles', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.nav-sparkles')?.dataset.sparklesState === 'active');
      await toggleLandingTheme(opposite);
      await page.waitForFunction(() => document.querySelector('.nav-sparkles')?.dataset.sparklesState === 'active');
      assert.equal(await glowBand.locator('canvas').count(), 1, 'Theme changes leave one canvas');
      await toggleLandingTheme(mode);
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
      assert.equal(await demo.evaluate(node => getComputedStyle(node).transform), 'none');
      assert.equal(await copyButton.evaluate(node => getComputedStyle(node, '::after').display), 'none', 'Reduced motion removes pointer light');
      await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
      assert.equal(await glowBand.evaluate(node => getComputedStyle(node).display), 'none');
      await page.emulateMedia({ forcedColors: 'none' });
      await page.waitForFunction(() => document.querySelector('.nav-sparkles')?.dataset.sparklesState === 'active');
      await page.locator('.landing-theme-picker summary').click();
      await page.getByText('Flexing on you with our themes lol', { exact: true }).waitFor();
      const themeTrigger = page.locator('.landing-theme-picker summary');
      assert.equal(await themeTrigger.getAttribute('aria-label'), 'Choose theme');
      assert.equal((await themeTrigger.innerText()).trim(), '', 'The theme control uses its icon and color without visible text');
      assert.ok((await themeTrigger.evaluate(node => getComputedStyle(node).backgroundImage)).includes('linear-gradient'));
      const swatches = page.locator('.landing-theme-swatch');
      assert.deepEqual(await swatches.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))), ['Projection / Coastal Day', 'Ember Tide / Dust & Flame', 'Noir Bloom / Confetti Studio']);
      const boxes = await swatches.evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return {x:box.x,y:box.y,w:box.width,h:box.height,gradient:getComputedStyle(node).backgroundImage}; }));
      for (const box of boxes) { assert.ok(Math.abs(box.w - box.h) < 1, 'Theme swatches are square'); assert.ok(box.w >= 44, 'Theme swatches remain touch targets'); assert.ok(box.gradient.includes('linear-gradient'), 'Each swatch shows its primary gradient'); }
      assert.equal(boxes[0].y, boxes[2].y, 'Three palettes share a single row');
      assert.match(boxes[0].gradient, /135deg/);
      assert.match(boxes[0].gradient, /rgb\(201, 245, 58\)/);
      assert.match(boxes[0].gradient, /rgb\(0, 200, 255\) 50%/, 'The core swatch splits diagonally into dark and light gradients');
      assert.equal(await page.locator('.landing-theme-swatch[aria-pressed="true"]').count(), 1, 'Only the selected theme is marked');
      const menu = await page.locator('.landing-theme-menu').boundingBox();
      assert.equal(await page.evaluate(({x, y}) => Boolean(document.elementFromPoint(x, y)?.closest('.landing-theme-menu')), {x: menu.x + menu.width - 15, y: menu.y + 40}), true, 'The theme menu stays above the sparkle controls');
      for (const [family, name, accent] of mode === 'light'
        ? [['ember', 'Dust & Flame', '#ff842b'], ['bloom', 'Confetti Studio', '#b56aff']]
        : [['ember', 'Ember Tide', '#ff8c2b'], ['bloom', 'Noir Bloom', '#ff39ab']]) {
        await page.getByRole('button', { name: family === 'ember' ? 'Ember Tide / Dust & Flame' : 'Noir Bloom / Confetti Studio', exact: true }).click();
        await page.waitForFunction(expected => getComputedStyle(document.querySelector('.landing-shell')).getPropertyValue('--ui-primary').trim().toLowerCase() === expected, accent);
        await page.getByText(name, { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: family === 'ember' ? 'Ember Tide / Dust & Flame' : 'Noir Bloom / Confetti Studio', exact: true }).getAttribute('aria-pressed'), 'true');
        await page.waitForFunction(() => document.querySelector('.nav-sparkles')?.dataset.sparklesState === 'active');
        assert.equal(await glowBand.locator('canvas').count(), 1, 'New pairs retain one canvas');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Theme picker fits the viewport');
        if (width === 1440) await page.screenshot({ path: `/tmp/projection-landing-${family}-${mode}.png`, fullPage: true });
      }
      await page.getByRole('button', { name: 'Projection / Coastal Day', exact: true }).click();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.landing-theme-picker').evaluate(node => node.open), false, 'Escape closes the theme picker');
      await toggleLandingTheme('system');
      await page.emulateMedia({ colorScheme: 'light' });
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.landing-shell')).getPropertyValue('--ui-primary').trim() === '#00C8FF');
      assert.equal(await page.evaluate(() => localStorage.getItem('projection-docs-theme')), 'system');
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.landing-shell')).getPropertyValue('--ui-primary').trim() === '#C9F53A');
      await page.reload();
      await page.locator('.landing-theme-picker summary').click();
      await page.waitForFunction(() => document.querySelector('.landing-mode-control')?.dataset.colorMode === 'system');
      await page.locator('.landing-theme-picker summary').click();
      await toggleLandingTheme(mode);

      await page.getByRole('radio', { name: 'Flat', exact: true }).click();
      for (const button of [copyButton, page.getByRole('button', { name: 'Save project', exact: true })]) assert.equal(await button.evaluate(node => getComputedStyle(node).boxShadow), 'none', 'Flat filled buttons have no ambient light');
      await page.waitForFunction(() => !document.querySelector('.nav-light canvas'));
      assert.deepEqual(errors, [], 'The local sparkle effect leaves all controls usable without runtime errors');
      console.log(`Landing ${mode} at ${width}px: retained theme, copy CTA, outlined links, controls, 2D sparkles, proximity light, scroll motion, Flat, and motion safeguards passed.`);
      await context.close();
    }
  }
  const soundFiles = ['modern-blip', 'modern-treasure', 'flat-chip', 'flat-pop'].map(name => `/sounds/${name}.mp3`);
  if (soundFiles.every(file => existsSync(join(root, file)))) {
    const nativeContext = await browser.newContext();
    const nativePage = await nativeContext.newPage();
    await nativePage.goto(origin);
    const decoded = await nativePage.evaluate(async files => {
      const context = new AudioContext();
      try {
        return await Promise.all(files.map(async file => {
          const response = await fetch(file);
          if (!response.ok) throw new Error(`Missing cue: ${file}`);
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          const output = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
          const source = output.createBufferSource();
          const gain = output.createGain();
          source.buffer = buffer;
          gain.gain.value = .4;
          source.connect(gain); gain.connect(output.destination); source.start();
          const rendered = await output.startRendering();
          let peak = 0;
          for (let channel = 0; channel < rendered.numberOfChannels; channel++) for (const value of rendered.getChannelData(channel)) peak = Math.max(peak, Math.abs(value));
          return { file, duration: buffer.duration, peak };
        }));
      } finally { await context.close(); }
    }, soundFiles);
    for (const cue of decoded) { assert.ok(cue.duration > .1 && cue.duration < 1.1, `${cue.file} stays finite`); assert.ok(cue.peak > .005 && cue.peak < .5, `${cue.file} remains audible without clipping`); }
    console.log('Licensed MP3 cues decode and render without clipping:', JSON.stringify(decoded));
    await nativeContext.close();
  }
  const audioContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await audioContext.addInitScript(() => {
    window.__appearanceAudio = { sources: [], pending: [], contexts: [] };
    const log = window.__appearanceAudio;
    const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
    window.AudioContext = class {
      state = 'suspended'; currentTime = 0; destination = {};
      constructor() { log.contexts.push(this); }
      createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
      decodeAudioData(bytes) { return Promise.resolve({ duration: .8, byteLength: bytes.byteLength }); }
      createBufferSource() { const node = { buffer: null, stops: [], connect() {}, disconnect() {}, start() { this.started = true; }, stop(time) { this.stops.push(time); } }; log.sources.push(node); return node; }
      resume() { return new Promise((resolve, reject) => log.pending.push({ resolve: () => { this.state = 'running'; resolve(); }, reject })); }
      close() { this.closed = true; return Promise.resolve(); }
    };
  });
  await audioContext.route('**/sounds/*.mp3', route => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from('synthetic audio fixture') }));
  const audioPage = await audioContext.newPage();
  const audioErrors = [];
  audioPage.on('pageerror', error => audioErrors.push(error.message));
  await audioPage.goto(origin);
  await audioPage.locator('.landing-sound-control[data-audio-status="blocked"]').waitFor();
  assert.equal(await audioPage.evaluate(() => window.__appearanceAudio.sources.length), 0, 'Blocked load does not queue a delayed cue');
  await audioPage.getByRole('radio', { name: 'Flat', exact: true }).click();
  await audioPage.getByRole('radio', { name: 'Modern', exact: true }).click();
  await audioPage.getByRole('radio', { name: 'Flat', exact: true }).click();
  await audioPage.evaluate(() => window.__appearanceAudio.pending[2].resolve());
  await audioPage.getByRole('button', { name: 'Mute style sounds', exact: true }).waitFor();
  await audioPage.evaluate(() => { window.__appearanceAudio.pending[1].resolve(); window.__appearanceAudio.pending[0].reject(new Error('Blocked')); });
  assert.equal(await audioPage.evaluate(() => window.__appearanceAudio.sources.length), 1, 'Only Flat sounds after rapid pending resumes');
  await audioPage.getByRole('button', { name: 'Mute style sounds', exact: true }).click();
  assert.equal(await audioPage.evaluate(() => window.__appearanceAudio.sources.every(source => source.stops.length === 1)), true, 'Mute stops all active voices');
  await audioPage.getByRole('radio', { name: 'Modern', exact: true }).click();
  assert.equal(await audioPage.evaluate(() => window.__appearanceAudio.sources.length), 1, 'Muted style changes stay silent');
  await audioPage.getByRole('button', { name: 'Enable style sounds', exact: true }).click();
  await audioPage.waitForFunction(() => window.__appearanceAudio.sources.length === 2);
  assert.equal(await audioPage.evaluate(() => window.__appearanceAudio.sources.length), 2, 'Enable plays the current Modern cue');
  await audioPage.getByRole('radio', { name: 'Flat', exact: true }).click();
  assert.equal(await audioPage.evaluate(() => window.__appearanceAudio.sources.slice(1, 2).every(source => source.stops.length === 1)), true, 'Flat cuts the Modern cue off');
  await audioPage.waitForFunction(() => window.__appearanceAudio.sources.length === 3);
  await audioPage.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await audioPage.evaluate(() => window.__appearanceAudio.sources.slice(-1).every(source => source.stops.length === 1)), true, 'Hidden pages stop their cue');
  await audioPage.getByRole('link', { name: 'Read the docs', exact: true }).click();
  await audioPage.locator('#nd-page').waitFor();
  assert.equal(new URL(audioPage.url()).pathname, '/docs/', 'Navigation remains usable after sound cancellation');
  assert.deepEqual(audioErrors, [], 'Audio failures and cancellation do not break the page');
  await audioContext.close();
  console.log('Appearance audio: autoplay block, rapid-switch races, mute, enable, hidden-page stop, and navigation passed.');
  console.log('Reader examples follow light and dark at mobile and desktop widths.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
