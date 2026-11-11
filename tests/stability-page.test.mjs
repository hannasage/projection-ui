import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../docs/pages/Stability.mdx');
const manifest = JSON.parse(read('../package.json'));
const snapshot = JSON.parse(read('./fixtures/export-snapshot.json'));

test('the stability page names every frozen entry, including the planned motion entry', () => {
  for (const entry of [...Object.keys(manifest.exports), ...snapshot.planned]) {
    assert.ok(page.includes('`' + entry + '`'), `Stability.mdx names ${entry}`);
  }
  assert.match(page, /`\.\/motion` entry does not exist yet/);
});

test('the stability page carries the freeze list, not-frozen list, prerelease rule, and change policy', () => {
  for (const heading of ['Frozen items', 'Not frozen', 'Prerelease rule', 'Change policy']) {
    assert.match(page, new RegExp(`^## ${heading}$`, 'm'));
  }
  for (const field of ['bg', 'surface', 'border', 'text', 'muted', 'primary', 'primaryFg', 'danger', 'font', 'radius']) {
    assert.ok(page.includes('`' + field + '`'), `required theme field ${field}`);
  }
  assert.match(page, /`1\.0\.0-beta\.N` release can change anything/);
});

test('the docs navigation lists the Stability page', () => {
  assert.match(read('../.storybook/preview.ts'), /'Migration', 'Stability', 'Releases'/);
  assert.match(read('../scripts/build-docs.mjs'), /'migration','stability','releases'/);
});
