import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repository } from './helpers/packed.mjs';

test('release verification accepts matching candidate/stable tags and rejects mismatches', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'projection-ui-release-'));
  try {
    for (const {version,tag,notes,valid} of [
      {version:'0.2.0-next.0',tag:'v0.2.0-next.0',notes:'## 0.2.0-next.0 candidate',valid:true},
      {version:'0.2.0-next.2',tag:'v0.2.0-next.2',notes:'## 0.2.0-next.2 unpublished alpha',valid:true},
      {version:'0.2.0',tag:'v0.2.0',notes:'## 0.2.0',valid:true},
      {version:'0.2.0-next.0',tag:'v0.2.0',notes:'## 0.2.0-next.0',valid:false},
      {version:'0.2.0',tag:'v0.2.0',notes:'## 0.2.0-next.0 candidate',valid:false},
      {version:'0.2.0-next.0',tag:'v0.2.0-next.0',notes:'Missing release notes',valid:false},
      {version:'1.0.0',tag:'v1.0.0',notes:'1.0.0',valid:false},
      {version:'0.1.6',tag:'v0.1.6',notes:'## 0.1.6',valid:false},
    ]) {
      writeFileSync(join(temporary, 'package.json'), JSON.stringify({name:'@hannasage/projection-ui',version}));
      writeFileSync(join(temporary, 'CHANGELOG.md'), notes);
      const result = spawnSync(process.execPath, [join(repository, 'scripts/verify-release.mjs')], {cwd:temporary,env:{...process.env,GITHUB_REF:`refs/tags/${tag}`},encoding:'utf8'});
      assert.ifError(result.error);
      assert.equal(result.status === 0, valid, `${version}/${tag}: ${result.stderr}`);
    }
  } finally { rmSync(temporary, {recursive:true,force:true}); }
});
