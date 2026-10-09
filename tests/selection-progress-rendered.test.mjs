import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const fixture = `
      const React=await import('react');
      const {createRoot}=await import('react-dom/client');
      const {ThemeProvider}=await import('/src/components/ThemeProvider.tsx');
      const {ButtonGroup}=await import('/src/components/ButtonGroup.tsx');
      const {Progress}=await import('/src/components/Widgets.tsx');
      const {PROJECTION_THEME,PROJECTION_LIGHT_THEME,PROJECTION_FLAT_THEME}=await import('/src/foundations.ts');
      function Example({theme,id}) { const [value,setValue]=React.useState('a');return React.createElement(ThemeProvider,{theme,style:{background:theme.surface,padding:24},id},React.createElement('section',{id},...['chip','segmented'].map(variant=>React.createElement(ButtonGroup,{key:variant,variant,value,onChange:setValue,'aria-label':id+variant,options:[{value:'a',label:'First'},{value:'b',label:'Next'}]})),React.createElement(Progress,{label:id+' progress',value:55}),React.createElement(Progress,{label:id+' loading'}))); }
      createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,...[[PROJECTION_LIGHT_THEME,'light'],[PROJECTION_THEME,'dark'],[PROJECTION_FLAT_THEME,'flat']].map(([theme,id])=>React.createElement(Example,{key:id,theme,id}))));
`;

test('selected light controls meet contrast, dark preserves accent, arrows work, native progress uses theme fill', async () => {
  const server=await createServer({configFile:false,plugins:[{name:'fixture',resolveId(id){if(id==='virtual:selection-fixture')return '\0virtual:selection-fixture'},load(id){if(id==='\0virtual:selection-fixture')return fixture}}],root:resolve('.'),server:{host:'127.0.0.1',port:0}});
  let browser;
  try {
    await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
    await page.setContent('<link rel="stylesheet" href="/src/tokens/scoped.css"><main id="root"></main>');
    await page.addScriptTag({type:'module',url:'/@id/__x00__virtual:selection-fixture'});
    await page.getByRole('radiogroup',{name:'lightchip'}).waitFor();
    await page.addScriptTag({content:readFileSync(require.resolve('axe-core/axe.min.js'),'utf8')});
    for (const width of [390,768,1440]) {
      await page.setViewportSize({width,height:900});
      const violations=await page.evaluate(async()=> (await window.axe.run(document.getElementById('root'),{runOnly:['color-contrast']})).violations);
      assert.deepEqual(violations.map(v=>v.id),[]);
    }
    assert.equal(await page.getByRole('radiogroup',{name:'lightchip'}).getByRole('radio',{checked:true}).evaluate(n=>getComputedStyle(n).color),'rgb(23, 32, 42)');
    assert.equal(await page.getByRole('radiogroup',{name:'darkchip'}).getByRole('radio',{checked:true}).evaluate(n=>getComputedStyle(n).color),'rgb(201, 245, 58)');
    const selected=page.getByRole('radiogroup',{name:'lightchip'}).getByRole('radio',{name:'First'});await selected.focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('radiogroup',{name:'lightchip'}).getByRole('radio',{name:'Next'}).getAttribute('aria-checked'),'true');
    await page.locator('#light').evaluate(n=>n.style.setProperty('--ui-accent-text','#243040'));
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('[aria-label=lightchip] [aria-checked=true]')).color === 'rgb(36, 48, 64)');
    for (const id of ['light','dark','flat']) {
      const progress=page.getByRole('progressbar',{name:id+' progress'});
      assert.equal(await progress.evaluate(n=>getComputedStyle(n).appearance),'none');
      assert.equal(await progress.getAttribute('value'),'55');
      const loading=page.getByRole('progressbar',{name:id+' loading'});
      assert.equal(await loading.getAttribute('value'),null);
      assert.equal(await loading.evaluate(n=>n.matches(':indeterminate')),true);
      assert.equal(await loading.evaluate(n=>getComputedStyle(n).appearance),'auto');
    }
    await page.emulateMedia({forcedColors:'active'});
    assert.equal(await page.getByRole('progressbar',{name:'light progress'}).evaluate(n=>getComputedStyle(n).appearance),'auto');
  } finally { await browser?.close();await server.close(); }
});
