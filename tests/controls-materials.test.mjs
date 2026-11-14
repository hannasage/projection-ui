import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

globalThis.__controlMaterialReact = React;
// A data: module cannot resolve 'react' or a relative path, so React comes from a global and the motion modules are inlined the same way.
function moduleUrl(file) {
  const source = readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext}}).outputText
    .replace(/import React(?:, \{([^}]*)\})? from 'react';/, (_, named) => `const React = globalThis.__controlMaterialReact;${named ? ` const {${named}} = React;` : ''}`)
    .replace(/import \{([^}]*)\} from 'react';/, (_, named) => `const {${named}} = globalThis.__controlMaterialReact;`)
    .replace("from './motionContext'", () => `from '${moduleUrl('motionContext.ts')}'`)
    .replace("from './motionStyle'", () => `from '${moduleUrl('motionStyle.tsx')}'`);
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
async function component(name) {
  return (await import(moduleUrl(`${name}.tsx`)))[name];
}
const Card = await component('Card');
const Button = await component('Button');
test('cards expose material choices while keeping content and consumer overrides', () => {
  const html = renderToStaticMarkup(React.createElement(Card, {material:'glass',edgeLight:true,underglow:true,as:'section',style:{padding:7}}, 'Visible text'));
  assert.match(html, /^<section/);
  assert.match(html, /data-material="glass"/);
  assert.match(html, /data-edge-light="true"/);
  assert.match(html, /data-underglow="true"/);
  assert.match(html, /padding:7px/);
  assert.match(html, /Visible text/);
});
test('gradient actions retain native disabled state and label', () => {
  const html = renderToStaticMarkup(React.createElement(Button,{variant:'primary',appearance:'gradient',disabled:true,type:'submit'},'Save'));
  assert.match(html,/data-appearance="gradient"/);
  assert.doesNotMatch(html,/\sappearance=/);
  assert.match(html,/disabled=""/);
  assert.match(html,/type="submit"/);
  assert.match(html,/>Save</);
});
