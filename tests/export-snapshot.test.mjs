import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { packFixture, packageName, repository } from './helpers/packed.mjs';
import { compareExports, declarationExports } from './helpers/exports.mjs';

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

test('the snapshot covers exactly the entries in package.json today, and lists ./motion as planned', () => {
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
    compareExports(namedExports(specifier, 'esm'), names, `${entry} ESM`);
  });
  test(`${entry} CommonJS named exports match the snapshot`, () => {
    compareExports(namedExports(specifier, 'cjs'), names, `${entry} CommonJS`);
  });
}

for (const [entry, expected] of Object.entries(snapshot.types)) {
  test(`${entry} declaration exports, UITheme fields, and UIRadius values match the snapshot`, () => {
    const target = manifest.exports[entry].types;
    const actual = declarationExports(join(installed, target));
    compareExports(actual.names, expected.names, `${entry} declarations`);
    assert.deepEqual(actual.themeFields, expected.themeFields, `${entry} required UITheme fields`);
    assert.deepEqual(actual.radius, expected.radius, `${entry} UIRadius values`);
  });
}

test('./styles and ./reset ship a declaration file with no exports', () => {
  for (const entry of ['./styles', './reset']) {
    assert.equal(manifest.exports[entry].types, './dist/styles.d.ts');
    assert.deepEqual(snapshot.types[entry].names, []);
    assert.ok(readFileSync(join(installed, manifest.exports[entry].types), 'utf8').length, `${entry} types are packed`);
  }
});

test('the root and core entries keep the required UITheme fields and UIRadius values', () => {
  for (const entry of ['.', './core']) {
    assert.deepEqual(snapshot.types[entry].themeFields.map(field => field.split(':')[0]),
      ['bg', 'border', 'danger', 'font', 'muted', 'primary', 'primaryFg', 'radius', 'surface', 'text']);
    assert.deepEqual(snapshot.types[entry].radius, ['rounded', 'sharp', 'soft']);
  }
});

test('the compare helper fails on a removed, an added, and a misspelled export', () => {
  const real = snapshot.modules['.'];
  assert.throws(() => compareExports(real.filter(name => name !== 'Button'), real, 'removed'), /differ/);
  assert.throws(() => compareExports([...real, 'Extra'], real, 'added'), /differ/);
  assert.throws(() => compareExports(real.map(name => (name === 'Card' ? 'Cards' : name)), real, 'renamed'), /differ/);
  compareExports([...real], real, 'same');
});

test('a removed type export fails the declaration check', () => {
  const entry = '.';
  const trimmed = snapshot.types[entry].names.filter(name => name !== 'ButtonProps');
  const actual = declarationExports(join(installed, manifest.exports[entry].types));
  assert.throws(() => compareExports(actual.names, trimmed, 'types'), /differ/);
});
