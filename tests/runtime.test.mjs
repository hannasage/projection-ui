import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { repository, packFixture } from './helpers/packed.mjs';

let packed, server, browser, page, url;
before(async () => {
  packed = packFixture('runtime', ['react', 'react-dom', 'recharts', 'zustand', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities']);
  writeFileSync(join(packed.fixture, 'index.html'), '<!doctype html><html lang="en"><title>Package contract</title><div id="root"></div><script type="module" src="/main.tsx"></script></html>');
  writeFileSync(join(packed.fixture, 'main.tsx'), readFileSync(join(repository, 'tests/fixtures/runtime/main.tsx')));
  writeFileSync(join(packed.fixture, 'scoped.html'), '<!doctype html><html lang="en"><title>Scoped styles</title><div id="root"></div><script type="module" src="/scoped.tsx"></script></html>');
  writeFileSync(join(packed.fixture, 'scoped.tsx'), readFileSync(join(repository, 'tests/fixtures/runtime/scoped.tsx')));
  server = await createServer({ configFile: false, root: packed.fixture, server: { port: 0, host: '127.0.0.1', fs: { allow: [packed.fixture, repository] } } });
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
});
after(async () => { await browser?.close(); await server?.close(); if (packed) rmSync(packed.temporary, {recursive:true,force:true}); });
beforeEach(async () => { await page.goto(url); await page.getByRole('heading', {name:'Package interaction fixture'}).waitFor(); });

test('same-label fields have unique IDs and connected descriptions/errors', async () => {
  const fields = page.getByLabel('Email', {exact:true});
  assert.equal(await fields.count(), 2);
  const ids = await fields.evaluateAll(nodes => nodes.map(node => node.id));
  assert.equal(new Set(ids).size, 2);
  assert.equal(await fields.nth(1).getAttribute('aria-invalid'), 'true');
  assert.equal(await fields.nth(0).evaluate(node => document.getElementById(node.getAttribute('aria-describedby')).textContent), 'First hint');
  assert.equal(await fields.nth(1).evaluate(node => document.getElementById(node.getAttribute('aria-describedby')).textContent), 'Invalid email');
  for (const label of ['Choice', 'Notes']) assert.ok(await page.getByLabel(label, {exact:true}).getAttribute('aria-describedby'));
});
test('switch pointer, label and keyboard each emit one change; disabled emits none', async () => {
  const toggle = page.getByRole('switch', {name:'Notifications',exact:true});
  await toggle.click();
  assert.equal(await page.getByTestId('changes').textContent(), '1');
  await page.getByText('Notifications', {exact:true}).click();
  assert.equal(await page.getByTestId('changes').textContent(), '2');
  await toggle.focus(); await page.keyboard.press('Space');
  assert.equal(await page.getByTestId('changes').textContent(), '3');
  assert.equal(await page.getByRole('switch', {name:'Disabled notifications'}).isDisabled(), true);
});
test('radio arrow navigation skips disabled choices with one roving tab stop', async () => {
  const first = page.getByRole('radio', {name:'First'});
  await first.focus(); await page.keyboard.press('ArrowRight');
  const last = page.getByRole('radio', {name:'Last'});
  assert.equal(await last.getAttribute('aria-checked'), 'true');
  assert.equal(await last.evaluate(node => node === document.activeElement), true);
  assert.equal(await first.getAttribute('tabindex'), '-1');
  assert.equal(await page.getByRole('radiogroup').count(), 1);
});
test('portal modal contains focus, restores opener, and keeps nested dismiss isolated', async () => {
  const opener = page.getByRole('button', {name:'Open modal',exact:true});
  await opener.click();
  const outer = page.getByRole('dialog', {name:'Outer modal',exact:true});
  assert.equal(await outer.evaluate(node => node.contains(document.activeElement)), true);
  await page.getByRole('button', {name:'Close',exact:true}).focus(); await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button', {name:'Open nested',exact:true}).evaluate(node => node === document.activeElement), true);
  await page.getByRole('button', {name:'Open nested',exact:true}).click();
  assert.equal(await page.getByRole('dialog', {name:'Nested modal',exact:true}).evaluate(node => node.contains(document.activeElement)), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 1);
  assert.equal(await page.getByRole('button', {name:'Open nested',exact:true}).evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await opener.evaluate(node => node === document.activeElement), true);
});
test('table sorting changes stable row order and keyboard activates one row', async () => {
  await page.getByRole('button', {name:/Name/}).click();
  const table = page.getByRole('table', {name:'People'});
  assert.deepEqual(await table.locator('tbody tr').evaluateAll(nodes => nodes.map(node => node.textContent)), ['Alpha','Alpha','Beta']);
  assert.equal(await table.getByRole('columnheader').getAttribute('aria-sort'), 'ascending');
  await table.locator('tbody tr').first().focus(); await page.keyboard.press('Enter');
  assert.equal(await page.getByTestId('row').textContent(), 'a');
  await page.getByRole('button', {name:/Name/}).click();
  assert.deepEqual(await table.locator('tbody tr').evaluateAll(nodes => nodes.map(node => node.textContent)), ['Beta','Alpha','Alpha']);
});
test('numeric sorting is stable and empty values stay last in both directions', async () => {
  const table = page.getByRole('table', {name:'Values'});
  await table.getByRole('button', {name:'Value'}).click();
  assert.deepEqual(await table.locator('tbody tr').allTextContents(), ['2','2','10','null']);
  await table.getByRole('button', {name:'Value'}).click();
  assert.deepEqual(await table.locator('tbody tr').allTextContents(), ['10','2','2','null']);
});
test('sortable handle supports keyboard pickup/move/drop and announcements', async () => {
  await page.getByRole('button', {name:'alpha',exact:true}).focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', {name:'alpha',exact:true}).and(page.locator('[aria-pressed="true"]')).waitFor();
  await page.waitForFunction(() => document.querySelector('[aria-live="assertive"]')?.textContent.includes('Item alpha moved to position 1'));
  // dnd-kit attaches its keyboard listener in a zero-delay task after pickup.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => document.querySelector('[aria-live="assertive"]')?.textContent.includes('position 2'));
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('[data-testid="order"]')?.textContent === 'beta,alpha,gamma');
  assert.equal(await page.getByTestId('order').textContent(), 'beta,alpha,gamma');
  assert.ok(await page.locator('[aria-live="assertive"]').textContent());
});
test('closed modal leaves focus alone and the open dialog traps newly added controls', async () => {
  const opener = page.getByRole('button', {name:'Open modal',exact:true});
  await opener.focus();
  assert.equal(await opener.evaluate(node => node === document.activeElement), true);
  await opener.click();
  await page.getByRole('button', {name:'Open nested',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name:'Close',exact:true}).focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button', {name:'Open nested',exact:true}).evaluate(node => node === document.activeElement), true);
});
test('tested accessibility rules pass for the packed controls and dialog', async () => {
  await page.addScriptTag({path:createRequire(import.meta.url).resolve('axe-core/axe.min.js')});
  const scan = () => page.evaluate(async () => window.axe.run(document.body, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
  assert.deepEqual((await scan()).violations.map(item => item.id), []);
  await page.getByRole('button', {name:'Open modal',exact:true}).click();
  assert.deepEqual((await scan()).violations.map(item => item.id), []);
});
test('scoped CSS leaves the page untouched, respects CSS overrides, and nests theme focus', async () => {
  await page.goto(`${url}/scoped.html`);
  await page.getByRole('button', {name:'Outer',exact:true}).waitFor();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-primary')), '');
  await page.keyboard.press('Tab');
  const outer = page.getByRole('button', {name:'Outer',exact:true}); await outer.focus();
  await expect(outer).toHaveCSS('outline-color', 'rgb(0, 255, 0)');
  assert.equal(await page.getByText('Outer text', {exact:true}).evaluate(node => getComputedStyle(node).fontFamily), 'serif');
  const inner = page.getByRole('button', {name:'Inner',exact:true}); await inner.focus();
  await expect(inner).toHaveCSS('outline-color', 'rgb(255, 82, 82)');
  assert.equal(await page.getByRole('button', {name:'Outside',exact:true}).evaluate(node => getComputedStyle(node).getPropertyValue('--ui-bg')), '');
});
test('toast expiry keeps its existing four-second default', async () => {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByRole('button', {name:'Notify'}).click();
  await page.clock.fastForward(3999);
  assert.equal(await page.getByText('Saved', {exact:true}).count(), 1);
  await page.clock.fastForward(1);
  assert.equal(await page.getByText('Saved', {exact:true}).count(), 0);
});
test('reduced motion removes skeleton and toast animation while dismissal works', async () => {
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.ui-skeleton').evaluate(node => getComputedStyle(node).animationName), 'none');
  await page.getByRole('button', {name:'Notify'}).click();
  const toast = page.getByText('Saved', {exact:true}); await toast.waitFor();
  assert.equal(await toast.evaluate(node => getComputedStyle(node.parentElement).animationName), 'none');
  await page.getByRole('button', {name:'Dismiss'}).click();
  assert.equal(await toast.count(), 0);
  await page.emulateMedia({reducedMotion:'no-preference'});
});
