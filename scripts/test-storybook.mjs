import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve('storybook-static');
const index = JSON.parse(readFileSync(resolve(root, 'index.json'), 'utf8'));
const entries = Object.values(index.entries);
assert.ok(entries.some(entry => entry.type === 'docs'), 'Built Storybook must contain guides');
assert.ok(entries.filter(entry => entry.type === 'story').length >= 26, 'Every public component needs a rendered story');
const server = createServer((request,response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return }
    if (!statSync(path).isFile()) { response.writeHead(404).end(); return }
    response.setHeader('Content-Type', {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({headless:true});
const axe = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const failures = [];
try {
  await Promise.all([390,768,1440].map(async width => {
  const page = await browser.newPage({viewport:{width,height:900}});
  console.log(`Checking ${entries.length} packed stories/docs at ${width}px.`);
  for (const entry of entries) {
    const errors = [];
    const capture = error => errors.push(error.message);
    page.on('pageerror', capture);
    await page.goto(`http://127.0.0.1:${server.address().port}/iframe.html?id=${encodeURIComponent(entry.id)}&viewMode=${entry.type === 'docs' ? 'docs' : 'story'}`);
    try {
      await page.waitForFunction(() => ['#storybook-root','#storybook-docs'].some(selector => {
        const node = document.querySelector(selector);
        return node && node.childElementCount > 0 && getComputedStyle(node).display !== 'none';
      }));
    } catch (error) { throw new Error(`${entry.id} at ${width}px did not render: ${error.message}`); }
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({path:axe});
    const result = await page.evaluate(async () => window.axe.run(document.body, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (errors.length || result.violations.length || overflow) failures.push({id:entry.id,width,errors,overflow,violations:result.violations.map(item => ({id:item.id,impact:item.impact,nodes:item.nodes.map(node => node.target)}))});
    page.off('pageerror', capture);
  }
  await page.close();
  }));
  assert.deepEqual(failures, [], `Storybook runtime/accessibility failures:\n${JSON.stringify(failures,null,2)}`);
  console.log(`Rendered ${entries.length} packed-package stories and docs with no page errors or tested WCAG rule violations.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
