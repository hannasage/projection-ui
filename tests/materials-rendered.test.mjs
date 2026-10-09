import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('rendered materials keep glass content opaque, use paired gradients and restore forced colors', async () => {
  const server = await createServer({ configFile: false, root: resolve('.'), server: {host:'127.0.0.1',port:0} });
  let browser;
  try {
    await server.listen(); browser = await chromium.launch({headless:true});
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
    await page.setContent('<link rel="stylesheet" href="/src/tokens/scoped.css"><div data-ui-theme><div class="ui-gradient-background" data-variant="atmosphere"><div class="ui-surface" data-material="glass" data-underglow="true"><h2 class="ui-gradient-text">Readable title</h2><p>Content</p></div></div></div>');
    await page.locator('.ui-surface').waitFor();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.ui-surface')).backdropFilter === 'blur(16px)');
    const glass = await page.locator('.ui-surface').evaluate(node => ({opacity:getComputedStyle(node).opacity,background:getComputedStyle(node).backgroundColor,glow:getComputedStyle(node,'::after').opacity}));
    assert.equal(glass.opacity, '1'); assert.match(glass.background,/0\.72/); assert.equal(glass.glow,'0.65');
    assert.notEqual(await page.locator('.ui-gradient-background').evaluate(node=>getComputedStyle(node).backgroundImage),'none');
    assert.ok(parseFloat(await page.locator('h2').evaluate(node=>getComputedStyle(node).fontSize))>=24);
    await page.locator('[data-ui-theme]').evaluate(node=>{
      const button=document.createElement('button');button.className='ui-button';button.dataset.variant='primary';button.dataset.appearance='gradient';node.append(button);
      const widget=document.createElement('div');widget.className='ui-material-glass ui-edge-light ui-underglow';node.append(widget);
    });
    assert.match(await page.locator('.ui-button').evaluate(node=>getComputedStyle(node).backgroundImage),/linear-gradient/);
    assert.equal(await page.locator('.ui-material-glass').evaluate(node=>getComputedStyle(node).backdropFilter),'blur(16px)');
    await page.locator('[data-ui-theme]').evaluate(node=>node.dataset.uiAppearance='flat');
    assert.equal(await page.locator('.ui-button').evaluate(node=>getComputedStyle(node).backgroundImage),'none');
    assert.equal(await page.locator('.ui-button').evaluate(node=>getComputedStyle(node).boxShadow),'none');
    assert.equal(await page.locator('.ui-material-glass').evaluate(node=>getComputedStyle(node).backdropFilter),'none');
    assert.equal(await page.locator('.ui-underglow').evaluate(node=>getComputedStyle(node,'::after').display),'none');
    assert.equal(await page.locator('.ui-surface').evaluate(node=>getComputedStyle(node).backdropFilter),'none');
    assert.equal(await page.locator('.ui-surface').evaluate(node=>getComputedStyle(node,'::after').display),'none');
    assert.equal(await page.locator('h2').evaluate(node=>getComputedStyle(node).backgroundImage),'none');
    assert.equal(await page.locator('.ui-gradient-background').evaluate(node=>getComputedStyle(node).backgroundImage),'none');
    await page.locator('[data-ui-theme]').evaluate(node=>delete node.dataset.uiAppearance);
    await page.locator('[data-ui-theme]').evaluate(node=>{ const spinner=document.createElement('span'); spinner.className='ui-spinner'; node.append(spinner); });
    assert.equal(await page.locator('.ui-spinner').evaluate(node=>getComputedStyle(node).animationName),'ui-spinner-rotate');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.ui-spinner').evaluate(node=>getComputedStyle(node).animationName),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('[data-ui-theme]').evaluate(node=>{
      const outer=document.createElement('div'); outer.dataset.uiTheme=''; outer.dataset.uiAppearance='flat';
      outer.innerHTML='<div data-ui-theme data-ui-appearance="neon"><div id="nested-neon" class="ui-surface" data-material="glass"></div></div>';
      node.append(outer);
      const neon=document.createElement('div'); neon.dataset.uiTheme=''; neon.dataset.uiAppearance='neon';
      neon.innerHTML='<div data-ui-theme data-ui-appearance="flat"><div id="nested-flat" class="ui-surface" data-material="glass"></div></div>';
      node.append(neon);
      const custom=document.createElement('div');custom.id='custom-glass';custom.className='ui-surface';custom.dataset.material='glass';custom.style.background='red';node.append(custom);
    });
    assert.equal(await page.locator('#nested-neon').evaluate(node=>getComputedStyle(node).backdropFilter),'blur(16px)');
    assert.equal(await page.locator('#nested-flat').evaluate(node=>getComputedStyle(node).backdropFilter),'none');
    assert.equal(await page.locator('#custom-glass').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(255, 0, 0)');
    await page.emulateMedia({forcedColors:'active'});
    assert.equal(await page.locator('h2').evaluate(node=>getComputedStyle(node).backgroundImage),'none');
    assert.equal(await page.locator('.ui-surface').first().evaluate(node=>getComputedStyle(node,'::after').display),'none');
  } finally { await browser?.close(); await server.close(); }
});
