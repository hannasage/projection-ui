import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
globalThis.__materialTestReact = React;
const source = readFileSync(new URL('../src/components/Materials.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext } }).outputText;
const { Surface, GradientBackground, GradientText } = await import(`data:text/javascript;base64,${Buffer.from(code.replace("import React from 'react';", `const React = globalThis.__materialTestReact;`)).toString('base64')}`);
test('surface keeps accessible content and forwards native attributes', () => {
  const html = renderToStaticMarkup(React.createElement(Surface, {material:'glass',edgeLight:true,underglow:true,'aria-label':'Panel'}, 'Content'));
  assert.match(html,/data-material="glass"/); assert.match(html,/aria-label="Panel"/); assert.match(html,/>Content</);
});
test('background variants are decorative wrappers; gradient text uses a heading', () => {
  assert.match(renderToStaticMarkup(React.createElement(GradientBackground,{variant:'horizon'},'Text')),/data-variant="horizon"/);
  assert.match(renderToStaticMarkup(React.createElement(GradientText,{as:'h1'},'Title')),/^<h1/);
});
