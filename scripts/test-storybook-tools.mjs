import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const root = resolve('storybook-static');
const server = createServer((request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
    if (!file.startsWith(root + sep) || !statSync(file).isFile()) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[extname(file)] ?? 'application/octet-stream');
    response.end(readFileSync(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [theme, accent, appearance] of [['dark', '#C9F53A', 'neon'], ['light', '#00C8FF', 'neon'], ['dark-flat', '#C9F53A', 'flat'], ['light-flat', '#00C8FF', 'flat']]) {
    await page.goto(`${origin}/iframe.html?id=components-button--primary&viewMode=story&globals=${encodeURIComponent(`theme:${theme}`)}`);
    await page.waitForFunction(expected => document.documentElement.dataset.previewTheme === expected, theme);
    const provider = page.locator('[data-ui-theme]').first();
    assert.equal(await provider.evaluate(node => getComputedStyle(node).getPropertyValue('--ui-primary').trim()), accent);
    assert.equal(await provider.getAttribute('data-ui-appearance'), appearance);
  }
  const axe = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
  for (const id of ['components-button--primary', 'foundations-themes--gradients', 'foundations-themes--typography', 'foundations-tokens--palette', 'gallery-components--paired']) {
    await page.goto(`${origin}/iframe.html?id=${id}&viewMode=story&globals=theme%3Alight`);
    await page.locator('#storybook-root > *').first().waitFor();
    await page.waitForFunction(() => document.documentElement.dataset.previewTheme === 'light');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity));
    await page.addScriptTag({ path: axe });
    const result = await page.evaluate(() => window.axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
    assert.deepEqual(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], `${id} has no tested light-mode WCAG violations`);
  }
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      for (const id of ['components-button--docs', 'components-card--docs', 'forms-select--docs', 'charts-areachart--docs', 'charts-donutchart--docs']) {
        await page.goto(`${origin}/iframe.html?id=${id}&viewMode=docs&globals=${encodeURIComponent(`theme:${theme}`)}`);
        const reference = page.getByRole('region', { name: 'Prop reference', exact: true });
        await reference.waitFor();
        if (id === 'components-button--docs') await reference.getByRole('table').waitFor();
        await page.getByRole('heading', { name: 'Component contract', exact: true }).waitFor();
        await reference.getByText('Open a story in Canvas and use the Controls panel to edit its props.', { exact: true }).waitFor();
        assert.equal(await reference.locator('input, select, textarea, [aria-readonly], .rejt-tree').count(), 0, `${id} keeps Docs props readable without editable control widgets`);
        await page.waitForFunction(expected => document.documentElement.dataset.previewTheme === expected, theme);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity));
        await page.addScriptTag({ path: axe });
        const result = await page.evaluate(() => window.axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
        assert.deepEqual(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], `${id} has no tested ${theme} Docs WCAG violations at ${width}px`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, `${id} does not overflow at ${width}px`);
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/?path=/story/components-button--primary&globals=theme%3Alight`);
  const canvas = page.frameLocator('#storybook-preview-iframe');
  await canvas.getByRole('button', { name: 'Primary', exact: true }).waitFor();
  await page.getByRole('tab', { name: /Controls/ }).click();
  const label = page.getByRole('row').filter({ has: page.getByText('children', { exact: true }) });
  await label.getByRole('textbox').fill('Changed through Controls');
  await canvas.getByRole('button', { name: 'Changed through Controls', exact: true }).waitFor();
  await canvas.getByRole('button', { name: 'Changed through Controls', exact: true }).click();
  await page.getByRole('tab', { name: /Actions/ }).click();
  await page.getByText('onClick', { exact: true }).first().waitFor();
  await page.getByRole('tab', { name: /Accessibility/ }).click();
  await page.getByRole('button', { name: 'Run test', exact: true }).click();
  await page.getByText(/Violations/).first().waitFor();
  await page.getByRole('button', { name: /Rerun tests|Tests completed/ }).click();
  await page.getByText(/Violations/).first().waitFor();
  await page.getByRole('button', { name: 'Change the size of the preview', exact: true }).click();
  await page.getByText('Phone · 390px', { exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#storybook-preview-iframe')?.clientWidth === 390);
  await page.getByRole('button', { name: /Toggle Measure|Enable measure/ }).first().click();
  await page.getByRole('button', { name: /Toggle Outline|Apply outlines to the preview/ }).first().click();
  await page.goto(`${origin}/?path=/story/components-button--keyboard-activation`);
  await canvas.getByRole('button', { name: 'Try keyboard activation' }).waitFor();
  await page.getByRole('tab', { name: /Interactions/ }).click();
  await page.getByText('toHaveBeenCalledOnce', { exact: false }).first().waitFor();
  assert.deepEqual(errors, [], 'Explorer controls and tools cause no runtime errors');
  console.log('Explorer themes, prop controls, event actions, accessibility tests, viewport sizing, layout tools, and keyboard interaction steps work.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
