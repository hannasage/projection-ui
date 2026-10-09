import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { resolve, dirname, join } from 'node:path';
const require=createRequire(import.meta.url);
const {PNG}=require(join(dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js'));
const fixture=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '/src/components/ThemeProvider.tsx';
import {Surface} from '/src/components/Materials.tsx';import {Card} from '/src/components/Card.tsx';
import {PROJECTION_THEME,COASTAL_DAY_THEME,PROJECTION_FLAT_THEME,PROJECTION_LIGHT_FLAT_THEME} from '/src/foundations.ts';
const cases=[[PROJECTION_THEME,'dark'],[COASTAL_DAY_THEME,'light'],[PROJECTION_FLAT_THEME,'flat-dark'],[PROJECTION_LIGHT_FLAT_THEME,'flat-light']];
createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,...cases.map(([theme,id])=>React.createElement(ThemeProvider,{key:id,theme,style:{background:theme.bg,padding:32}},React.createElement('section',{'data-case':id,style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:32}},...[Card,Surface].map((Component,i)=>React.createElement(Component,{key:i,className:'sample',material:'glass',underglow:true,style:{height:120,boxSizing:'border-box'}},React.createElement('strong',null,i?'Surface':'Card'),React.createElement('button',{type:'button',style:{position:'absolute',left:20,bottom:12},onClick:e=>e.currentTarget.dataset.clicked='true'},'Open'))))))));
`;
function pixel(png,x,y){const offset=(Math.floor(y)*png.width+Math.floor(x))*4;return [...png.data.subarray(offset,offset+3)]}
function difference(a,b){return Math.max(...a.map((v,i)=>Math.abs(v-b[i])))}
test('underglow stays outside glass panels in both themes, flat mode and forced colors',async()=>{
 const server=await createServer({configFile:false,plugins:[{name:'occlusion-fixture',resolveId(id){if(id==='virtual:occlusion')return '\0virtual:occlusion'},load(id){if(id==='\0virtual:occlusion')return fixture}}],root:resolve('.'),server:{host:'127.0.0.1',port:0}});
 let browser;
 try {
  await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:900,height:850},deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
  await page.setContent('<link rel="stylesheet" href="/src/tokens/scoped.css"><style>body{margin:0}</style><main id="root"></main>');
  await page.addScriptTag({type:'module',url:'/@id/__x00__virtual:occlusion'});await page.locator('.sample').last().waitFor();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.sample')).backdropFilter==='blur(16px)');
  for(const width of [900,390]) {
   await page.setViewportSize({width,height:850});
   const boxes=await page.locator('.sample').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,flat:n.closest('[data-ui-appearance]').dataset.uiAppearance==='flat'}}));
   const on=PNG.sync.read(await page.screenshot());
   await page.locator('.sample').evaluateAll(nodes=>nodes.forEach(n=>delete n.dataset.underglow));
   const off=PNG.sync.read(await page.screenshot());
   for(const box of boxes) {
    const x=box.x+box.width/2,bottom=box.y+box.height;
    for(const offset of [3,8,16]) assert.ok(difference(pixel(on,x,bottom-offset),pixel(off,x,bottom-offset))<=1,'glass interior must occlude the underglow');
    const exterior=difference(pixel(on,x,bottom+8),pixel(off,x,bottom+8));
    assert.ok(box.flat?exterior<=1:exterior>=3,'modern glow remains below the panel; flat remains solid');
   }
   await page.locator('.sample').evaluateAll(nodes=>nodes.forEach(n=>n.dataset.underglow='true'));
   if(process.env.PROJECTION_MATERIAL_EVIDENCE_DIR){mkdirSync(process.env.PROJECTION_MATERIAL_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.PROJECTION_MATERIAL_EVIDENCE_DIR,`underglow-${width}.png`)});}
  }
  for (const button of await page.locator('.sample button').all()) {
   await button.focus();
   assert.equal(await button.evaluate(n=>getComputedStyle(n).outlineStyle),'solid');
   await button.click();
   assert.equal(await button.getAttribute('data-clicked'),'true');
  }
  assert.ok(await page.locator('.sample').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).overflow==='visible' && getComputedStyle(n).clipPath==='none')));
  await page.emulateMedia({forcedColors:'active'});
  assert.ok(await page.locator('.sample').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n,'::after').display==='none')));
 }finally{await browser?.close();await server.close();}
});
