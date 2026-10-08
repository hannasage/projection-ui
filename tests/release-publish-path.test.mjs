import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { repository } from './helpers/packed.mjs';

test('the release script publishes a local archive through the real npm parser', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'projection-publish-path-'));
  const version = '0.2.0-next.73';
  try {
    mkdirSync(join(temporary, 'release'));
    mkdirSync(join(temporary, 'bin'));
    writeFileSync(join(temporary, 'package.json'), JSON.stringify({ name: '@hannasage/projection-ui', version }));
    writeFileSync(join(temporary, 'CHANGELOG.md'), `## ${version}\n`);
    const pack = spawnSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', 'release'], { cwd: temporary, encoding: 'utf8', timeout: 30_000 });
    assert.ifError(pack.error);
    assert.equal(pack.status, 0, pack.stderr);
    const wrapper = join(temporary, 'bin', 'npm');
    writeFileSync(wrapper, `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
if (args[0] !== 'publish') process.exit(90);
const result = spawnSync('npm', [...args, '--dry-run'], {
  env: { ...process.env, PATH: process.env.RELEASE_TEST_ORIGINAL_PATH, GIT_SSH_COMMAND: 'false' },
  stdio: 'inherit', timeout: 30_000,
});
if (result.error) throw result.error;
process.exit(result.status ?? 91);
`);
    chmodSync(wrapper, 0o755);
    const result = spawnSync(process.execPath, [join(repository, 'scripts/verify-release.mjs'), '--publish'], {
      cwd: temporary, encoding: 'utf8', timeout: 40_000,
      env: { ...process.env, GITHUB_REF: `refs/tags/v${version}`, PATH: `${join(temporary, 'bin')}${delimiter}${process.env.PATH}`, RELEASE_TEST_ORIGINAL_PATH: process.env.PATH },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, new RegExp(`\\+ @hannasage/projection-ui@${version.replaceAll('.', '\\.')}\\b`));
    assert.match(result.stderr, /Publishing to .*\(dry-run\)/);
    assert.doesNotMatch(result.stderr, /git --no-replace-objects ls-remote/);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
