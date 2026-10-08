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
  for (const width of [390,768,1440]) {
  const page = await browser.newPage({viewport:{width,height:900}});
  console.log(`Checking ${entries.length} packed stories/docs at ${width}px.`);
  for (const entry of entries) {
    const errors = [];
    const capture = error => errors.push(error.message);
    page.on('pageerror', capture);
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/iframe.html?id=${encodeURIComponent(entry.id)}&viewMode=${entry.type === 'docs' ? 'docs' : 'story'}`, {waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => ['#storybook-root','#storybook-docs'].some(selector => {
        const node = document.querySelector(selector);
        return node && node.childElementCount > 0 && getComputedStyle(node).display !== 'none';
      }));
    } catch (error) { throw new Error(`${entry.id} at ${width}px did not render: ${error.message}; page errors: ${JSON.stringify(errors)}`); }
    await page.evaluate(() => document.fonts.ready);
    const codeViewports = page.locator('[data-radix-scroll-area-viewport]');
    assert.ok(await codeViewports.evaluateAll(nodes => nodes.every(node => node.tabIndex === 0 && node.getAttribute('aria-label'))), `${entry.id} code examples must have named keyboard scroll targets`);
    await page.addScriptTag({path:axe});
    const result = await page.evaluate(async () => window.axe.run(document.body, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (errors.length || result.violations.length || overflow) failures.push({id:entry.id,width,errors,overflow,violations:result.violations.map(item => ({id:item.id,impact:item.impact,nodes:item.nodes.map(node => node.target)}))});
    if (entry.type === 'story' && entry.title === 'Components/ProjectionGlow') {
      const glow = page.locator('.ui-projection-glow');
      assert.equal(await glow.getAttribute('aria-hidden'),'true','Glow stays decorative');
      assert.equal(await glow.locator('button, a, input, select, textarea, [tabindex]').count(),0,'Glow introduces no focus controls');
      assert.equal(await glow.evaluate(node=>getComputedStyle(node).pointerEvents),'none','Glow does not receive pointer input');
      if (entry.id.endsWith('--default')) {
        assert.equal(await glow.evaluate(node=>getComputedStyle(node).getPropertyValue('--ui-glow-color').trim()),'#C9F53A','Default glow inherits the preserved theme accent');
        assert.equal(await glow.locator('.ui-projection-glow-halo').evaluate(node=>getComputedStyle(node).animationName),'none','Default glow stays still');
        await glow.locator('..').screenshot({path:`/tmp/projection-glow-${width}-default.png`});
        await glow.evaluate(node=>{
          const parent=node.parentElement;
          parent.dataset.uiTheme='true';
          parent.style.setProperty('--ui-primary','#8CB4FF');
        });
        assert.equal(await glow.evaluate(node=>getComputedStyle(node).getPropertyValue('--ui-glow-color').trim()),'#8CB4FF','Glow follows a nested theme accent');
        await glow.evaluate(node=>{
          const parent=node.parentElement;
          parent.removeAttribute('data-ui-theme');
          parent.style.removeProperty('--ui-primary');
          const button=document.createElement('button');
          button.textContent='Underlying content control';
          button.dataset.glowProof='true';
          button.style.cssText=`position:absolute;left:${Math.max(16,node.clientWidth/2-90)}px;top:${Math.max(16,node.clientHeight/2-22)}px;width:180px;height:44px`;
          button.addEventListener('click',()=>{button.dataset.clicks=String(Number(button.dataset.clicks??0)+1)});
          parent.insertBefore(button,node);
        });
        const underlying=page.getByRole('button',{name:'Underlying content control',exact:true});
        assert.ok(await underlying.evaluate(node=>{const box=node.getBoundingClientRect();return document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)===node}),'Decoration leaves underlying content in the hit-test path');
        await underlying.click();
        assert.equal(await underlying.getAttribute('data-clicks'),'1','Underlying content receives one real pointer click');
        await underlying.evaluate(node=>node.remove());
      }
      if (entry.id.endsWith('--reveal')) {
        await page.emulateMedia({reducedMotion:'reduce'});
        assert.ok(await glow.locator('span').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).animationName==='none')),'Reduced motion removes the opt-in reveal');
        await page.screenshot({path:`/tmp/projection-glow-${width}-reduced.png`});
        await page.emulateMedia({reducedMotion:'no-preference'});
      }
      await page.emulateMedia({forcedColors:'active'});
      assert.equal(await glow.evaluate(node=>getComputedStyle(node).visibility),'hidden','Forced colors hide decorative light');
      await page.emulateMedia({forcedColors:'none'});
    }
    if (entry.type === 'docs' && entry.id.startsWith('charts-')) {
      const tables = page.locator('.docs-story table');
      assert.ok(await tables.count(), `${entry.id} must retain its text equivalents`);
      assert.ok(await tables.evaluateAll(nodes => nodes.every(node => node.tabIndex === 0)), `${entry.id} text equivalents must be keyboard reachable`);
      // Exercise the generated Canvas when its contents need vertical scrolling.
      await page.addStyleTag({content: '.docs-story > div:first-child { max-height: 180px; overflow: auto; }'});
      const table = tables.first();
      await table.focus();
      assert.ok(await table.evaluate(node => document.activeElement === node), `${entry.id} text equivalent receives focus`);
      const before = await table.evaluate(node => {
        const scroller = node.closest('.docs-story').firstElementChild;
        scroller.scrollTop = 100;
        return scroller.scrollTop;
      });
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(previous => document.querySelector('.docs-story > div:first-child').scrollTop > previous, before);
    }
    const wideCode = await codeViewports.evaluateAll(nodes => nodes.findIndex(node => node.scrollWidth > node.clientWidth + 1));
    if (wideCode !== -1) {
      const viewport = codeViewports.nth(wideCode);
      await viewport.focus();
      assert.ok(await viewport.evaluate(node => document.activeElement === node), `${entry.id} code viewport receives focus`);
      await viewport.evaluate(node => { node.scrollLeft = 0; });
      await page.keyboard.press('ArrowRight');
      await viewport.evaluate(node => new Promise((resolve, reject) => {
        const deadline = performance.now() + 2000;
        const inspect = () => node.scrollLeft > 0 ? resolve() : performance.now() > deadline ? reject(new Error('Code viewport did not scroll with ArrowRight')) : requestAnimationFrame(inspect);
        inspect();
      }));
    }
    assert.deepEqual(errors, [], `${entry.id} at ${width}px must have no keyboard interaction errors`);
    page.off('pageerror', capture);
  }
  await page.close();
  }
  assert.deepEqual(failures, [], `Storybook runtime/accessibility failures:\n${JSON.stringify(failures,null,2)}`);
  console.log(`Rendered ${entries.length} packed-package stories and docs with no page errors or tested WCAG rule violations.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
