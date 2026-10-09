import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const temporary = mkdtempSync(join(tmpdir(),'projection-ui-final-'));
try {
  const expected = JSON.parse(readFileSync('docs-site/out/release.json','utf8'));
  const [packed] = JSON.parse(execFileSync('npm',['pack','--json','--ignore-scripts','--pack-destination',temporary],{encoding:'utf8'}));
  assert.equal(packed.name,expected.name);
  assert.equal(packed.version,expected.version);
  assert.equal(packed.integrity,expected.integrity,'The final release must be byte-identical to the checked documentation package');
  for (const path of ['dist/src/components/Materials.d.ts','dist/src/components/Widgets.d.ts','dist/core.js','dist/index.cjs','dist/tokens/scoped.css']) {
    assert.ok(packed.files.some(file=>file.path===path), `The reviewed artifact includes ${path}`);
  }
  assert.ok(packed.files.every(file=>file.path.startsWith('dist/')||['README.md','LICENSE','package.json'].includes(file.path)),'No docs application or unrelated files enter npm');
  const archive = resolve(temporary,packed.filename);
  const result = spawnSync(process.execPath,['--test','--test-concurrency=1','tests/frameworks.test.mjs','tests/package-contract.test.mjs','tests/runtime.test.mjs','tests/charts.test.mjs'],{stdio:'inherit',env:{...process.env,PROJECTION_UI_TARBALL:archive},timeout:300_000});
  if (result.error) throw result.error;
  assert.equal(result.status,0,'Final consumers test the exact archive without rebuilding the library');
  const [after] = JSON.parse(execFileSync('npm',['pack','--dry-run','--json','--ignore-scripts'],{encoding:'utf8'}));
  assert.equal(after.integrity,packed.integrity,'Consumer builds must leave the release artifact unchanged');
  mkdirSync('release-artifacts',{recursive:true});
  copyFileSync(archive,join('release-artifacts',packed.filename));
  console.log(`Checked final ${packed.filename}: ${packed.integrity}, ${packed.files.length} files.`);
} finally { rmSync(temporary,{recursive:true,force:true}); }
