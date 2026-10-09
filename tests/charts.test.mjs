import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { repository, packFixture } from './helpers/packed.mjs';
let packed, server, browser, page, url;
before(async () => {
  packed = packFixture('charts');
  writeFileSync(join(packed.fixture, 'index.html'), '<!doctype html><html lang="en"><title>Charts contract</title><div id="root"></div><script type="module" src="/main.tsx"></script></html>');
  writeFileSync(join(packed.fixture, 'main.tsx'), readFileSync(join(repository, 'tests/fixtures/charts/main.tsx')));
  server = await createServer({configFile:false,root:packed.fixture,server:{port:0,host:'127.0.0.1',fs:{allow:[packed.fixture,repository]}}});
  await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({headless:true}); page = await browser.newPage({viewport:{width:1440,height:1100}});
  await page.addInitScript(() => {
    window.chartPointerListeners = new Set();
    const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
    document.addEventListener = function(type, listener, options) {if(type === 'pointermove') window.chartPointerListeners.add(listener); return add(type, listener, options)};
    document.removeEventListener = function(type, listener, options) {if(type === 'pointermove') window.chartPointerListeners.delete(listener); return remove(type, listener, options)};
  });
});
after(async () => {await browser?.close();await server?.close();if(packed)rmSync(packed.temporary,{recursive:true,force:true});});
beforeEach(async () => {await page.emulateMedia({reducedMotion:'reduce',forcedColors:'none'});await page.goto(url);await page.getByRole('heading',{name:'Chart interaction fixture'}).waitFor();});
const mark = kind => page.getByTestId(kind).locator(kind === 'donut' ? '.recharts-sector' : kind === 'bar' ? '.recharts-bar-rectangle .recharts-rectangle' : `.recharts-${kind}-curve`).first();
async function point(locator, fraction=.5) {return locator.evaluate((node,fraction)=>{const p=node.getPointAtLength(node.getTotalLength()*fraction),m=node.getScreenCTM();return{x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f};},fraction);}
async function strength(locator) {return Number(await locator.evaluate(node=>node.style.getPropertyValue('--ui-chart-glow-strength') || '0'));}

test('shared palette is reusable; empty colors fall back and nonempty colors remain exact',async()=>{
 const palette=JSON.parse(await page.getByTestId('palette').textContent());assert.equal(palette[0],'var(--ui-primary)');assert.equal(palette.length,6);
 for(const kind of ['line','area']){assert.equal(await mark(kind).getAttribute('stroke'),palette[0]);assert.equal(await page.getByTestId(kind).locator(`.recharts-${kind}-curve`).nth(1).getAttribute('stroke'),'#ff0077');}
 for(const kind of ['bar','donut'])assert.equal(await mark(kind).getAttribute('fill'),palette[0]);
 assert.equal(await page.getByTestId('line').locator('.recharts-legend-item-text > span').first().evaluate(node=>getComputedStyle(node).color),await page.locator('main').evaluate(node=>getComputedStyle(node).color));
});
test('flat appearance removes active chart glow and keeps the chart usable', async () => {
 await page.emulateMedia({reducedMotion:'no-preference'}); await page.waitForTimeout(1700);
 const path=mark('bar'), p=await point(path); await page.mouse.move(p.x,p.y);
 await expect.poll(()=>strength(path)).toBeGreaterThan(.9);
 await page.locator('[data-ui-theme]').evaluate(node=>node.dataset.uiAppearance='flat');
 await expect.poll(()=>strength(path)).toBe(0);
 await page.mouse.move(p.x+1,p.y); assert.equal(await strength(path),0);
 assert.equal(await path.evaluate(node=>node.style.filter),'');
 assert.ok(await page.getByTestId('bar').locator('svg').count());
});
test('mouse proximity strengthens only mark glow in all four charts and clears on leaving',async()=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(1700);
 for(const kind of ['line','bar','area','donut']){const path=mark(kind),p=await point(path,0);await page.mouse.move(p.x,p.y);await expect.poll(()=>strength(path),{message:kind}).toBeGreaterThan(.9);assert.match(await path.evaluate(node=>getComputedStyle(node).filter),/drop-shadow/);if(kind==='donut'||kind==='bar')assert.equal(await path.evaluate(node=>node.style.filter.includes(getComputedStyle(node).fill)),true);await page.mouse.move(p.x+(kind==='donut'?40:-40),p.y);await expect.poll(()=>strength(path),{message:kind+' distance'}).toBeLessThan(.75);await expect.poll(()=>strength(path)).toBeGreaterThan(.1);assert.equal(await page.getByTestId(kind).locator('svg[role="application"]').first().evaluate(n=>n.style.filter),'');assert.ok(await page.getByTestId(kind).locator('text, .recharts-tooltip-cursor').evaluateAll(ns=>ns.every(n=>!n.style.filter)));await page.mouse.move(0,0);await expect.poll(()=>strength(path)).toBe(0);}
});
test('distance follows the donut aperture rather than its rectangular bounds',async()=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(1700);
 const path=mark('donut'),p=await point(path,.1);await page.mouse.move(p.x,p.y);await expect.poll(()=>strength(path)).toBeGreaterThan(.9);
 const center=await page.getByTestId('donut').getByText('5 items').boundingBox();await page.mouse.move(center.x+center.width/2,center.y+center.height/2);await expect.poll(()=>strength(path)).toBeLessThan(.65);
});
test('reduced motion, forced colors, pen and touch disable decorative glow without blocking tooltips',async()=>{
 const path=mark('bar'),p=await point(path);await page.mouse.move(p.x,p.y);assert.equal(await strength(path),0);
 await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'active'});await page.mouse.move(p.x+1,p.y);assert.equal(await strength(path),0);
 await page.emulateMedia({forcedColors:'none'});await page.waitForTimeout(1700);const current=await point(path);await page.mouse.move(current.x,current.y);await expect.poll(()=>strength(path)).toBeGreaterThan(.9);
 for(const pointerType of ['touch','pen']){await path.dispatchEvent('pointermove',{pointerType,clientX:current.x,clientY:current.y,bubbles:true});await expect.poll(()=>strength(path)).toBe(0);}
 await page.emulateMedia({reducedMotion:'reduce'});await page.mouse.move(current.x+2,current.y);await expect(page.locator('.recharts-tooltip-wrapper').filter({hasText:'Alpha'}).first()).toBeVisible();
});
test('keyboard input clears glow and chart unmount rolls back styles and pending work',async()=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(1700);const path=mark('line'),p=await point(path);await page.mouse.move(p.x,p.y);await expect.poll(()=>strength(path)).toBeGreaterThan(.9);await page.keyboard.press('Tab');await expect.poll(()=>strength(path)).toBe(0);
 await page.mouse.move(p.x+1,p.y);await expect.poll(()=>strength(path)).toBeGreaterThan(.9);await path.evaluate(n=>window.detachedMark=n);assert.equal(await page.evaluate(()=>window.chartPointerListeners.size),5);await page.getByRole('button',{name:'Toggle charts'}).evaluate((button,p)=>{document.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:p.x,clientY:p.y}));button.click();},p);await expect.poll(()=>page.evaluate(()=>window.chartPointerListeners.size)).toBe(0);await page.mouse.move(p.x,p.y);assert.equal(await page.evaluate(()=>window.detachedMark.style.filter),'');assert.equal(await page.evaluate(()=>window.detachedMark.style.getPropertyValue('--ui-chart-glow-strength')),'');
});
test('area instances own unique gradient IDs and every reference resolves inside its chart',async()=>{
 const ids=await page.locator('linearGradient').evaluateAll(ns=>ns.map(n=>n.id));assert.equal(new Set(ids).size,ids.length);
 assert.equal(await page.locator('.recharts-area-area').evaluateAll(ns=>ns.every(n=>n.closest('svg').querySelector(`[id="${n.getAttribute('fill').slice(5,-1)}"]`))),true);
});


test('native scroll and resize clear stationary-pointer glow', async () => {
 await page.setViewportSize({width:1440,height:500});await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(1700);
 const path=mark('line'),p=await point(path);await page.mouse.move(p.x,p.y);await expect.poll(()=>strength(path)).toBeGreaterThan(.9);
 await page.evaluate(()=>window.scrollBy(0,100));await expect.poll(()=>strength(path)).toBe(0);
 const current=await point(path);await page.mouse.move(current.x,current.y);await expect.poll(()=>strength(path)).toBeGreaterThan(.9);
 await page.setViewportSize({width:1400,height:1100});await expect.poll(()=>strength(path)).toBe(0);
});
test('unsupported or failing native SVG geometry leaves the chart usable', async () => {
 await page.setViewportSize({width:1440,height:1100});await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(1700);
 const errors=[];const capture=error=>errors.push(error.message);page.on('pageerror',capture);
 const path=mark('bar'),p=await point(path);
 for(const method of ['getTotalLength','getPointAtLength','isPointInFill']){
  await page.mouse.move(0,0);await path.evaluate((node,method)=>{node.originalGeometry=node[method];node[method]=()=>{throw new Error('Injected native geometry failure')};},method);
  await page.mouse.move(p.x,p.y);await page.waitForTimeout(50);assert.equal(await strength(path),0);assert.equal(await path.evaluate(node=>node.style.filter),'');
  await path.evaluate((node,method)=>{node[method]=node.originalGeometry;},method);
 }
 assert.deepEqual(errors,[]);await expect(page.locator('.recharts-tooltip-wrapper').filter({hasText:'Alpha'}).first()).toBeVisible();page.off('pageerror',capture);
});

test('the palette accent and its halo follow live theme variables without changing custom series',async()=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(1700);
 await page.locator('[data-ui-theme]').evaluate(node=>node.style.setProperty('--ui-primary','#77ffaa'));
 const path=mark('line'),p=await point(path);await page.mouse.move(p.x,p.y);await expect.poll(()=>strength(path)).toBeGreaterThan(.9);
 assert.equal(await path.evaluate(node=>getComputedStyle(node).stroke),'rgb(119, 255, 170)');assert.equal(await path.evaluate(node=>node.style.filter.includes(getComputedStyle(node).stroke)),true);
 assert.equal(await page.getByTestId('line').locator('.recharts-line-curve').nth(1).getAttribute('stroke'),'#ff0077');
});
