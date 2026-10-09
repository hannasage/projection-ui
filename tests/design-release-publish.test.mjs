import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishDesignRelease } from '../scripts/publish-design-release.mjs';

const sha = 'a'.repeat(40);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(version = '0.2.0-next.2') {
  const cwd = mkdtempSync(join(tmpdir(), 'projection-design-release-'));
  const directory = join(cwd, 'design-release');
  mkdirSync(directory);
  const filename = `projection-ui-design-${version}.zip`;
  const archive = Buffer.from('test design ZIP bytes');
  const metadata = { version, filename, bytes: archive.length, sha256: digest(archive) };
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: '@hannasage/projection-ui', version }));
  writeFileSync(join(directory, filename), archive);
  writeFileSync(join(directory, 'design-package.json'), JSON.stringify(metadata));
  const environment = { GITHUB_REPOSITORY: 'hannasage/projection-ui', GITHUB_REF: `refs/tags/v${version}`, GITHUB_SHA: sha };
  return { cwd, directory, version, filename, metadata, environment, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function github(f, { existing = false, immutable = false, draft = false, missingMetadata = false, corruptAsset = false, corruptDownload = false, tagSha = sha, annotated = false, lookupStatus = 200 } = {}) {
  const calls = [];
  let release = existing ? { id: 1, tag_name: `v${f.version}`, prerelease: f.version.includes('-'), draft, immutable, assets: [] } : null;
  const asset = (name, id) => {
    const bytes = readFileSync(join(f.directory, name));
    return { id, name, size: bytes.length, state: 'uploaded', digest: `sha256:${corruptAsset ? '0'.repeat(64) : digest(bytes)}` };
  };
  if (release) release.assets = [asset(f.filename, 10), ...missingMetadata ? [] : [asset('design-package.json', 11)]];
  const json = (body, status = 200) => ({ status: status === 200 ? 0 : 1, stdout: Buffer.from(`HTTP/2.0 ${status} Test\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(body)}`) });
  const runGh = args => {
    calls.push(args);
    if (args[0] === 'api') {
      const path = args.at(-1);
      if (path.includes('/git/ref/tags/')) return json({ object: { type: annotated ? 'tag' : 'commit', sha: annotated ? 'b'.repeat(40) : tagSha } });
      if (path.includes('/git/tags/')) return json({ object: { type: 'commit', sha: tagSha } });
      if (path.includes('/releases/assets/')) {
        const found = release.assets.find(item => String(item.id) === path.split('/').at(-1));
        return { status: 0, stdout: corruptDownload ? Buffer.from('different bytes') : readFileSync(join(f.directory, found.name)) };
      }
      if (path.includes('/releases/tags/')) return lookupStatus !== 200 ? json({}, lookupStatus) : release ? json(release) : json({}, 404);
      throw new Error(`Unexpected API ${path}`);
    }
    if (args[0] === 'release' && args[1] === 'create') {
      release = { id: 1, tag_name: `v${f.version}`, prerelease: f.version.includes('-'), draft: false, immutable, assets: [asset(f.filename, 10), asset('design-package.json', 11)] };
    } else if (args[0] === 'release' && args[1] === 'upload') release.assets.push(asset('design-package.json', 11));
    else if (args[0] === 'release' && args[1] === 'edit') release.draft = false;
    else throw new Error(`Unexpected command ${args.join(' ')}`);
    return { status: 0, stdout: Buffer.from('') };
  };
  return { runGh, calls, mutations: () => calls.filter(args => args[0] === 'release') };
}

test('a verified alpha tag creates a prerelease with both matching design assets', () => {
  const f = fixture();
  try {
    const gh = github(f, { annotated: true });
    const result = publishDesignRelease({ ...f, runGh: gh.runGh });
    assert.equal(result.version, f.version);
    const command = gh.mutations()[0];
    assert.deepEqual(command.slice(0, 3), ['release', 'create', `v${f.version}`]);
    assert.ok(command.includes('--verify-tag'));
    assert.ok(command.includes('--prerelease'));
    assert.ok(command.includes('--latest=false'));
    assert.ok(command.includes(join(f.directory, f.filename)));
    assert.ok(command.includes(join(f.directory, 'design-package.json')));
    assert.ok(gh.calls.some(args => args.at(-1).includes('/git/tags/')));
    assert.ok(gh.calls.every(args => !args.includes('--clobber')));
  } finally { f.cleanup(); }
});

test('a stable tag creates a stable release', () => {
  const f = fixture('0.2.0');
  try {
    const gh = github(f);
    publishDesignRelease({ ...f, runGh: gh.runGh });
    assert.ok(!gh.mutations()[0].includes('--prerelease'));
    assert.ok(gh.mutations()[0].includes('--latest=true'));
  } finally { f.cleanup(); }
});

test('identical immutable release assets are retained after checking their actual bytes', () => {
  const f = fixture();
  try {
    const gh = github(f, { existing: true, immutable: true });
    publishDesignRelease({ ...f, runGh: gh.runGh });
    assert.equal(gh.mutations().length, 0);
    assert.equal(gh.calls.filter(args => args.at(-1).includes('/releases/assets/')).length, 2);
  } finally { f.cleanup(); }
});

test('a retry uploads only a missing asset and preserves an existing matching ZIP', () => {
  const f = fixture();
  try {
    const gh = github(f, { existing: true, missingMetadata: true });
    publishDesignRelease({ ...f, runGh: gh.runGh });
    assert.deepEqual(gh.mutations()[0], ['release', 'upload', `v${f.version}`, join(f.directory, 'design-package.json'), '--repo', 'hannasage/projection-ui']);
    assert.equal(gh.mutations().length, 1);
  } finally { f.cleanup(); }
});

test('a matching complete draft is published only after its assets pass the checks', () => {
  const f = fixture();
  try {
    const gh = github(f, { existing: true, draft: true });
    publishDesignRelease({ ...f, runGh: gh.runGh });
    assert.equal(gh.mutations()[0][1], 'edit');
    assert.ok(gh.calls.findIndex(args => args.at(-1).includes('/releases/assets/')) < gh.calls.findIndex(args => args[1] === 'edit'));
  } finally { f.cleanup(); }
});

test('invalid tag, package, metadata, hash, and byte count stop before any GitHub call', () => {
  for (const change of ['tag', 'version', 'filename', 'hash', 'bytes']) {
    const f = fixture();
    try {
      if (change === 'tag') f.environment.GITHUB_REF = 'refs/tags/v0.2.0-next.1';
      else {
        f.metadata[{ version: 'version', filename: 'filename', hash: 'sha256', bytes: 'bytes' }[change]] = { version: '0.2.0-next.1', filename: '../outside.zip', hash: '0'.repeat(64), bytes: 1 }[change];
        writeFileSync(join(f.directory, 'design-package.json'), JSON.stringify(f.metadata));
      }
      const gh = github(f);
      assert.throws(() => publishDesignRelease({ ...f, runGh: gh.runGh }));
      assert.equal(gh.calls.length, 0, change);
    } finally { f.cleanup(); }
  }
});

test('a moved tag, conflicting asset, incomplete immutable release, or failed lookup causes no writes', () => {
  for (const setup of [{ tagSha: 'c'.repeat(40) }, { existing: true, corruptAsset: true }, { existing: true, corruptDownload: true }, { existing: true, immutable: true, missingMetadata: true }, { lookupStatus: 403 }, { lookupStatus: 503 }]) {
    const f = fixture();
    try {
      const gh = github(f, setup);
      assert.throws(() => publishDesignRelease({ ...f, runGh: gh.runGh }));
      assert.equal(gh.mutations().length, 0);
    } finally { f.cleanup(); }
  }
});
