import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
test('documentation tables expose a labelled keyboard scroll container and retain native table semantics', () => {
  const source = readFileSync(new URL('../docs-site/components/AccessibleTable.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(output, { exports, require });
  const table = renderToStaticMarkup(createElement(exports.AccessibleTable, { id: 'reference' }, createElement('tbody', null, createElement('tr', null, createElement('td', null, 'Native table cell')))));
  assert.match(table, /<div[^>]*role="group"[^>]*aria-label="Scrollable reference table"[^>]*tabindex="0"/);
  assert.match(table, /<table id="reference"><tbody><tr><td>Native table cell<\/td><\/tr><\/tbody><\/table>/);
});
