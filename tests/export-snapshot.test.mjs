import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { packFixture, packageName, repository } from './helpers/packed.mjs';

const manifest = JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8'));
const snapshot = JSON.parse(readFileSync(new URL('./fixtures/export-snapshot.json', import.meta.url), 'utf8'));
let fixture;
let installed;
let temporary;

function namedExports(specifier, format) {
  const script = format === 'cjs'
    ? `process.stdout.write(JSON.stringify(Object.keys(require(${JSON.stringify(specifier)})).filter(name => name !== '__esModule').sort()))`
    : `import(${JSON.stringify(specifier)}).then(mod => process.stdout.write(JSON.stringify(Object.keys(mod).sort())))`;
  const args = format === 'cjs' ? ['-e', script] : ['--input-type=module', '-e', script];
  return JSON.parse(execFileSync(process.execPath, args, { cwd: fixture, encoding: 'utf8', timeout: 60_000 }));
}

before(() => {
  ({ temporary, fixture, installed } = packFixture('export-snapshot'));
});
after(() => rmSync(temporary, { recursive: true, force: true }));

test('the snapshot covers exactly the entries in package.json today, and none is planned yet', () => {
  const listed = [...Object.keys(snapshot.modules), ...snapshot.stylesheets].sort();
  assert.deepEqual(listed, Object.keys(manifest.exports).sort());
  for (const entry of snapshot.planned) {
    assert.ok(!(entry in manifest.exports) || entry in snapshot.modules, `${entry} is either absent or snapshotted`);
  }
  for (const [entry, names] of Object.entries(snapshot.modules)) {
    assert.deepEqual(names, [...names].sort(), `${entry} snapshot is sorted`);
    assert.equal(new Set(names).size, names.length, `${entry} snapshot has no duplicates`);
  }
});

test('every snapshotted stylesheet entry is a packed file', () => {
  for (const entry of snapshot.stylesheets) {
    const target = manifest.exports[entry];
    const path = typeof target === 'string' ? target : target.default;
    assert.ok(readFileSync(join(installed, path)).length, `${entry}: ${path} is packed`);
  }
});

for (const [entry, names] of Object.entries(snapshot.modules)) {
  const specifier = entry === '.' ? packageName : `${packageName}/${entry.slice(2)}`;
  test(`${entry} ESM named exports match the snapshot`, () => {
    assert.deepEqual(namedExports(specifier, 'esm'), names);
  });
  test(`${entry} CommonJS named exports match the snapshot`, () => {
    assert.deepEqual(namedExports(specifier, 'cjs'), names);
  });
}

test('the snapshot guard detects a removed export', () => {
  const trimmed = snapshot.modules['.'].filter(name => name !== 'Button');
  assert.notDeepEqual(namedExports(packageName, 'esm'), trimmed);
});
