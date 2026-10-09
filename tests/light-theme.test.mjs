import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import * as foundations from '../src/foundations.ts';
globalThis.__lightReact = React;
globalThis.__lightFoundations = foundations;
const source = readFileSync(new URL('../src/components/ThemeProvider.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext } }).outputText.replace("import React from 'react';", 'const React = globalThis.__lightReact;').replace("import { RADIUS_SCALE, UI_FOUNDATIONS } from '../foundations';", 'const { RADIUS_SCALE, UI_FOUNDATIONS } = globalThis.__lightFoundations;');
const { ThemeProvider } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
function luminance(rgb) { return rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0); }
function hexRgb(hex) { return hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255); }
function contrast(a,b) { const first=luminance(a),second=luminance(b); return (Math.max(first,second)+.05)/(Math.min(first,second)+.05); }
test('Coastal Day normal button text clears 4.5 across the paired gradient', () => {
 const theme=foundations.COASTAL_DAY_THEME;
 const ink=hexRgb(theme.primaryFg), start=hexRgb(theme.primary), end=hexRgb(theme.partner);
 for(let step=0;step<=100;step++){const portion=step/100;const background=start.map((value,index)=>value*(1-portion)+end[index]*portion);assert.ok(contrast(ink,background)>=4.5,`gradient position ${step}%`);}
});
test('rendered Coastal Day materials and title gradient keep readable blue endpoints', async()=>{
 const server=await createServer({configFile:false,root:resolve('.'),server:{host:'127.0.0.1',port:0}});let browser;
 try { await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
 const html=renderToStaticMarkup(React.createElement(ThemeProvider,{theme:foundations.COASTAL_DAY_THEME},React.createElement('div',{className:'ui-gradient-background','data-variant':'wash'},React.createElement('div',{className:'ui-surface','data-material':'glass'},React.createElement('h2',{className:'ui-gradient-text'},'Coastal title'),React.createElement('p',null,'Body'),React.createElement('button',{className:'ui-button','data-variant':'primary','data-appearance':'gradient',style:{color:'var(--ui-primary-fg)'}},'Action')))));
 await page.setContent(`<link rel="stylesheet" href="/src/tokens/scoped.css">${html}`);await page.waitForFunction(()=>getComputedStyle(document.querySelector('.ui-surface')).backdropFilter==='blur(16px)');
 const colors=await page.locator('h2').evaluate(node=>{const style=getComputedStyle(node);const resolveColor=value=>{const probe=document.createElement('span');probe.style.color=value;node.append(probe);const result=getComputedStyle(probe).color;probe.remove();return result;};return {start:resolveColor('var(--ui-gradient-start)'),end:resolveColor('var(--ui-gradient-end)'),background:resolveColor('var(--ui-bg)'),gradient:style.backgroundImage};});
 const parse=color=>color.startsWith('color(srgb')?color.match(/[\d.]+/g).map(Number).slice(0,3):color.match(/[\d.]+/g).map(Number).slice(0,3).map(value=>value/255);
 assert.notEqual(colors.end,'rgb(20, 90, 56)');assert.match(colors.gradient,/linear-gradient/);
 assert.ok(contrast(parse(colors.start),parse(colors.background))>=3);assert.ok(contrast(parse(colors.end),parse(colors.background))>=3);
 const ink=await page.locator('button').evaluate(node=>getComputedStyle(node).color);assert.equal(ink,'rgb(16, 24, 32)');
 assert.match(await page.locator('.ui-gradient-background').evaluate(node=>getComputedStyle(node).backgroundImage),/linear-gradient/);
 assert.equal(await page.locator('.ui-surface').evaluate(node=>getComputedStyle(node).opacity),'1');
 } finally {await browser?.close();await server.close();}
});
