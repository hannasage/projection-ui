import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const list = JSON.parse(read('./fixtures/breaking-changes.json'));
const page = read('../docs/pages/Migration.mdx');
const headings = [...page.matchAll(/^#{2,3} (.+?)\s*$/gm)].map(match => match[1]);

test('the breaking-change list names the 0.1.5 baseline and has unique entries', () => {
  assert.equal(list.baseline, '0.1.5');
  assert.ok(list.changes.length >= 12);
  assert.equal(new Set(list.changes.map(change => change.id)).size, list.changes.length);
  assert.equal(new Set(list.changes.map(change => change.heading)).size, list.changes.length);
});

for (const change of list.changes) {
  test(`Migration.mdx has a step for ${change.id}`, () => {
    assert.ok(headings.includes(change.heading), `missing heading: ${change.heading}`);
    const start = page.indexOf(`## ${change.heading}`);
    const rest = page.slice(start + change.heading.length + 3);
    const body = rest.slice(0, rest.search(/\n## |$/)).trim();
    assert.ok(body.length > 40, `${change.heading} needs a body`);
  });
}

test('the migration page does not call the beta line an alpha', () => {
  assert.doesNotMatch(page, /\balpha\b/i);
});
