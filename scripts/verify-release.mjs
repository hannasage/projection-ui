import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const {name, version} = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(name, '@hannasage/projection-ui');
assert.match(version, /^0\.2\.0(?:-next\.\d+)?$/, 'Only the reviewed 0.2.0 release line can publish');
assert.equal(process.env.GITHUB_REF, `refs/tags/v${version}`, 'Tag must match the package version');
const prerelease = version.includes('-next.');
const escapedVersion = version.replaceAll('.', '\\.');
assert.match(readFileSync('CHANGELOG.md', 'utf8'), new RegExp(`^##[ \\t]+${escapedVersion}(?=[ \\t]|$)`, 'm'), 'Changelog must have a heading for this exact version');
if (process.argv.includes('--publish')) {
  const files = readdirSync('release').filter(file => file.endsWith('.tgz'));
  assert.deepEqual(files, [`hannasage-projection-ui-${version}.tgz`], 'Exactly one verified release artifact is required');
  const result = spawnSync('npm', ['publish', resolve('release', files[0]), '--access', 'public', '--provenance', '--tag', prerelease ? 'next' : 'latest', '--ignore-scripts'], {stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm publish failed with status ${result.status}`);
}
