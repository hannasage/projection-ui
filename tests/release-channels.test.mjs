import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseChannel } from '../scripts/release-channel.mjs';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

test('release channels keep legacy patches separate from the next alpha and stable current line', () => {
  for (const [version, channel] of [['0.1.5', 'legacy'], ['0.1.6', 'legacy'], ['0.1.99', 'legacy'], ['0.2.0-next.0', 'next'], ['0.2.0-next.2', 'next'], ['0.2.0-next.73', 'next'], ['0.2.0', 'latest'], ['0.2.1', 'latest'], ['0.2.99', 'latest']]) assert.equal(releaseChannel(version), channel, version);
});

test('the publisher keeps the reviewed archive, provenance, and channel while legacy releases fail before npm', () => {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'projection-channel-publish-')));
  try {
    mkdirSync(join(temporary, 'release'));
    mkdirSync(join(temporary, 'bin'));
    const captured = join(temporary, 'arguments.json');
    const executable = join(temporary, 'bin', 'npm');
    writeFileSync(executable, `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(process.env.CAPTURE_NPM_ARGS, JSON.stringify(process.argv.slice(2)));\n`);
    chmodSync(executable, 0o755);
    for (const [version, channel] of [['0.2.0-next.2', 'next'], ['0.2.0', 'latest'], ['0.1.6', 'legacy']]) {
      const archive = `hannasage-projection-ui-${version}.tgz`;
      writeFileSync(join(temporary, 'package.json'), JSON.stringify({ name: '@hannasage/projection-ui', version }));
      writeFileSync(join(temporary, 'CHANGELOG.md'), `## ${version}\n`);
      writeFileSync(join(temporary, 'release', archive), 'verified artifact placeholder');
      const result = spawnSync(process.execPath, [resolve('scripts/verify-release.mjs'), '--publish'], { cwd: temporary, encoding: 'utf8', env: { ...process.env, GITHUB_REF: `refs/tags/v${version}`, PATH: `${join(temporary, 'bin')}${delimiter}${process.env.PATH}`, CAPTURE_NPM_ARGS: captured } });
      assert.ifError(result.error);
      if (channel === 'legacy') {
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /reviewed maintenance checkout/);
        assert.deepEqual(JSON.parse(readFileSync(captured, 'utf8')), ['publish', join(temporary, 'release', 'hannasage-projection-ui-0.2.0.tgz'), '--access', 'public', '--provenance', '--tag', 'latest', '--ignore-scripts'], 'legacy verification must not call npm');
      } else {
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(JSON.parse(readFileSync(captured, 'utf8')), ['publish', join(temporary, 'release', archive), '--access', 'public', '--provenance', '--tag', channel, '--ignore-scripts']);
      }
      rmSync(join(temporary, 'release', archive));
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test('the approved modern workflow keeps legacy tags outside modern docs and design-kit gates', () => {
  const workflow = readFileSync(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8');
  assert.match(workflow, /tags: \['v0\.2\.0', 'v0\.2\.0-next\.\*'\]/);
  assert.doesNotMatch(workflow, /tags:.*v0\.1/);
  assert.match(workflow, /environment: npm-publish/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /needs: \[verify, publish\]/);
  assert.match(workflow, /name: npm-release\s+path: release/);
  assert.match(workflow, /node scripts\/verify-release\.mjs --publish/);
});

test('unknown release lines and malformed versions cannot select an npm channel', () => {
  for (const version of ['0.1.6-next.0', '0.2.1-next.0', '0.2.0-beta.1', '0.2.0-next.01', '0.2.01', '0.2.0+build', 'v0.2.0', '0.3.0', '1.0.0', '', null]) assert.throws(() => releaseChannel(version), /Unsupported release version/, String(version));
});
