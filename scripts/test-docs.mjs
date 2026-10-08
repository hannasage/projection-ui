import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve('docs-site/out');
const contracts = JSON.parse(readFileSync('docs/component-contracts.json', 'utf8'));
const routes = ['/', '/docs/', ...['installation','theming','tokens','accessibility','migration','releases','community'].map(slug=>`/docs/${slug}/`), ...Object.keys(contracts).map(name=>`/docs/components/${name.replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase()}/`)];
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.txt':'text/plain','.md':'text/plain','.woff2':'font/woff2'};
const server = createServer((request,response)=>{
  try {
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    let path = resolve(root, '.'+pathname);
    if (!path.startsWith(root+sep) && path!==root) { response.writeHead(403).end(); return; }
    if (statSync(path).isDirectory()) path = resolve(path,'index.html');
    if (!statSync(path).isFile()) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type',pathname==='/api/search'?'application/json':mime[extname(path)]??'application/octet-stream');
    response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true});
const axe = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const failures = [];
const localLinks = new Set(['/llms.txt','/llms-full.txt','/release.json','/api/search','/examples/','/examples/index.json']);
try {
  for (const width of [390,768,1440]) {
    const context = await browser.newContext({viewport:{width,height:900},permissions:['clipboard-read','clipboard-write']});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    for (const route of routes) {
      errors.length=0;
      console.log(`Reader ${width}px ${route}`);
      await page.goto(origin+route,{waitUntil:'domcontentloaded'});
      await page.locator('#nd-page').waitFor();
      await page.waitForLoadState('load');
      await page.evaluate(()=>document.fonts.ready);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.waitForFunction(()=>document.getAnimations().every(animation=>animation.playState!=='running'||animation.effect?.getTiming().iterations===Infinity));
      await page.addScriptTag({path:axe});
      const result = await page.evaluate(()=>window.axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
      const measurements = await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,bodySize:getComputedStyle(document.body).fontSize,paragraphs:[...document.querySelectorAll('.prose p')].map(node=>getComputedStyle(node).fontSize),links:[...document.querySelectorAll('a[href]')].map(node=>node.getAttribute('href')).filter(href=>href.startsWith('/')&&!href.startsWith('//'))}));
      measurements.links.forEach(link=>localLinks.add(link.split('#')[0]));
      const viewports = page.locator('figure > [role="region"]');
      const wide = await viewports.evaluateAll(nodes=>nodes.findIndex(node=>node.scrollWidth>node.clientWidth+1));
      if (wide!==-1) {
        const viewport = viewports.nth(wide);
        assert.equal(await viewport.getAttribute('tabindex'),'0','Code scrolling remains keyboard reachable');
        await viewport.focus();
        await viewport.evaluate(node=>{node.scrollLeft=0});
        await page.keyboard.press('ArrowRight');
        await viewport.evaluate(node=>new Promise((resolve,reject)=>{const deadline=performance.now()+2000;const inspect=()=>node.scrollLeft>0?resolve():performance.now()>deadline?reject(new Error('Code did not scroll with ArrowRight')):requestAnimationFrame(inspect);inspect()}));
      }
      if (errors.length || result.violations.length || measurements.overflow || measurements.bodySize!=='16px' || measurements.paragraphs.some(size=>size!=='16px')) failures.push({route,width,errors:[...errors],...measurements,violations:result.violations.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>node.target)}))});
      if (['/','/docs/components/card/'].includes(route)) {
        for (const iframe of await page.locator('.component-example iframe').all()) {
          await iframe.scrollIntoViewIfNeeded();
          const frame = await (await iframe.elementHandle()).contentFrame();
          await frame.locator('#storybook-root > *').waitFor();
          assert.ok(await frame.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1 && document.documentElement.scrollWidth<=innerWidth+1),'Compact examples retain their complete content');
          assert.ok(await iframe.evaluate(node=>node.clientHeight<=200),'Short examples use compact preview frames');
        }
        await page.evaluate(()=>scrollTo(0,0));
      }
      if (['/','/docs/installation/','/docs/components/card/'].includes(route)) {
        await page.screenshot({path:`/tmp/projection-fuma-${process.env.DOCS_PACKET??'first'}-${width}-${route==='/'?'home':route.includes('installation')?'installation':'card'}.png`,fullPage:true});
        if (route==='/') console.log(JSON.stringify({width,buttons:await page.getByRole('button').evaluateAll(nodes=>nodes.map(node=>({text:node.textContent,label:node.getAttribute('aria-label')})))}));
      }
    }
    await page.goto(origin+'/docs/installation/',{waitUntil:'domcontentloaded'});
    const copy = page.getByRole('button',{name:'Copy Text',exact:true}).first();
    await copy.focus();
    const expected = await copy.evaluate(node=>node.closest('figure').querySelector('pre').textContent);
    await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'Copied Text',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected,'Keyboard copy retains the displayed code');
    const search = page.getByRole('button',{name:/^(Open Search|Search)/}).filter({visible:true}).first();
    await search.focus();
    await page.keyboard.press('Enter');
    const input = page.getByRole('combobox',{name:'Search',exact:true});
    await input.waitFor();
    await input.fill('Modal');
    await page.getByRole('option').first().waitFor();
    await input.fill('zzzxqv947zzzz');
    await page.getByText('No results found',{exact:true}).waitFor();
    await input.fill('Modal');
    await page.getByRole('option').first().waitFor();
    await page.screenshot({path:`/tmp/projection-fuma-${process.env.DOCS_PACKET??'first'}-${width}-search.png`});
    await page.addScriptTag({path:axe});
    const searchAudit = await page.evaluate(()=>window.axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
    assert.deepEqual(searchAudit.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)})),[],'Search dialog has no tested WCAG violations');
    await page.keyboard.press('Escape');
    await input.waitFor({state:'hidden'});
    await page.waitForFunction(node=>document.activeElement===node,await search.elementHandle());
    assert.ok(await search.evaluate(node=>document.activeElement===node),'Escape restores search trigger focus');
    await page.keyboard.press('Enter');
    await input.fill('Modal');
    await page.getByRole('option').first().waitFor();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/docs\/components\/modal/);
    await page.getByRole('heading',{name:'Modal',exact:true}).waitFor();
    if (width===390) {
      const toggle = page.locator('#nd-subnav').getByRole('button',{name:'Open Sidebar',exact:true});
      await toggle.focus();
      await page.keyboard.press('Enter');
      const install = page.getByRole('link',{name:'Installation',exact:true});
      await install.waitFor();
      await install.focus();
      await page.keyboard.press('Enter');
      await page.waitForURL(/\/docs\/installation/);
      await page.locator('#nd-sidebar-mobile').waitFor({state:'hidden'});
      assert.equal(await toggle.getAttribute('aria-expanded'),'false','Mobile navigation closes after selecting a route');
      assert.ok(await toggle.isVisible(),'Mobile navigation returns to its closed trigger after a route change');
    }
    await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link',{name:'Skip to content',exact:true});
    assert.ok(await skip.evaluate(node=>document.activeElement===node),'First keyboard stop is the content skip link');
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash,'#nd-page','Skip link reaches the reading content');
    assert.ok(await page.locator('#nd-page').evaluate(node=>document.activeElement===node),'Skip link moves keyboard focus into the reading content');
    await page.emulateMedia({reducedMotion:'reduce'});
    const motion = await page.evaluate(()=>[...document.querySelectorAll('*')].every(node=>{const style=getComputedStyle(node);return style.animationName==='none' && style.transitionDuration.split(',').every(duration=>parseFloat(duration)===0) && style.scrollBehavior==='auto'}));
    assert.ok(motion,'Reduced motion removes animation, transitions, and smooth scrolling');
    let searchRequests=0;
    await context.route('**/api/search*',async route=>{
      searchRequests++;
      if (searchRequests===1) await route.fulfill({status:503,contentType:'application/json',body:'{}'});
      else await route.continue();
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:/^(Open Search|Search)/}).filter({visible:true}).first().click();
    const failedInput = page.getByRole('combobox',{name:'Search',exact:true});
    await failedInput.fill('Modal');
    await page.getByRole('alert').filter({hasText:'Search could not load'}).waitFor();
    await page.addScriptTag({path:axe});
    const errorAudit = await page.evaluate(()=>window.axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
    assert.deepEqual(errorAudit.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)})),[],'Search failure state has no tested WCAG violations');
    const retry = page.getByRole('button',{name:'Retry search',exact:true});
    await retry.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('option').first().waitFor();
    assert.equal(searchRequests,2,'Retry fetches a fresh local index after a failed request');
    assert.ok(await failedInput.evaluate(node=>document.activeElement===node),'Retry restores focus to the search field');
    assert.equal(await page.getByRole('alert').count(),0,'Successful retry clears the failure message');
    await failedInput.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/docs\/components\/modal/);
    assert.deepEqual(errors,[],'Reader interactions have no page errors');
    await context.close();
    console.log(`Checked ${routes.length} static reader routes at ${width}px.`);
  }
  for (const link of localLinks) {
    const response = await fetch(origin+link);
    assert.equal(response.status,200,`Local documentation link resolves: ${link}`);
  }
  assert.deepEqual(failures,[],`Reader accessibility/runtime failures:\n${JSON.stringify(failures,null,2)}`);
  console.log(`Verified ${localLinks.size} local links and ${routes.length} reader pages at three widths.`);
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
