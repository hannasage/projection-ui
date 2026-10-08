import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL('../out/' + path, import.meta.url), 'utf8');
test('the static reader retains eight guides and all component contracts', () => {
  const contracts = JSON.parse(readFileSync(new URL('../../docs/component-contracts.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(contracts).length, 27);
  assert.match(read('index.html'), /Projection UI/);
  for (const slug of ['','installation','theming','tokens','accessibility','migration','releases','community']) assert.match(read(`docs/${slug ? slug+'/' : ''}index.html`), /Projection UI/);
  for (const name of Object.keys(contracts)) {
    const slug = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    assert.match(read(`docs/components/${slug}/index.html`), new RegExp(name));
    assert.match(read(`markdown/components/${slug}.md`), /Required props/);
  }
});
test('plain content and the explorer identify the same packed candidate', () => {
  const candidate = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const release = JSON.parse(read('release.json'));
  assert.equal(release.version, candidate.version);
  assert.match(release.integrity, /^sha512-/);
  assert.match(read('llms.txt'), new RegExp(candidate.version.replaceAll('.', '\\.')));
  assert.match(read('llms-full.txt'), /```tsx\nimport/);
  assert.doesNotMatch(read('llms-full.txt'), /<Canvas|<Meta|<Example/);
  const explorer = JSON.parse(read('examples/index.json'));
  assert.equal(Object.keys(explorer.entries).length, 113);
});
