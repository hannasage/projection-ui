import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

globalThis.__controlMaterialReact = React;
async function component(name) {
  const source = readFileSync(new URL(`../src/components/${name}.tsx`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext}}).outputText;
  return (await import(`data:text/javascript;base64,${Buffer.from(code.replace("import React from 'react';", 'const React = globalThis.__controlMaterialReact;')).toString('base64')}`))[name];
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
