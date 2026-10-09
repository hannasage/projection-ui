import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const gh = args => spawnSync('gh', args, { encoding: null, maxBuffer: 64 * 1024 * 1024, timeout: 60_000 });

export function publishDesignRelease({ cwd = process.cwd(), directory = resolve(cwd, 'design-release'), environment = process.env, runGh = gh } = {}) {
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@hannasage/projection-ui', 'Use the Projection UI package.');
  assert.match(pkg.version, /^0\.2\.0(?:-next\.\d+)?$/, 'Use the reviewed release line.');
  const version = pkg.version;
  const tag = `v${version}`;
  const prerelease = version.includes('-next.');
  assert.equal(environment.GITHUB_REF, `refs/tags/${tag}`, 'The tag must match the package version.');
  assert.equal(environment.GITHUB_REPOSITORY, 'hannasage/projection-ui', 'Use the official release repository.');
  assert.match(environment.GITHUB_SHA ?? '', /^[a-f\d]{40}$/i, 'The workflow must identify its commit.');
  const repo = environment.GITHUB_REPOSITORY;
  const endpoint = `repos/${repo}`;
  const metadataPath = join(directory, 'design-package.json');
  assert.ok(lstatSync(metadataPath).isFile() && !lstatSync(metadataPath).isSymbolicLink(), 'Use a regular metadata file.');
  const metadataBytes = readFileSync(metadataPath);
  const metadata = JSON.parse(metadataBytes);
  assert.equal(metadata.version, version, 'The design package must match the React package version.');
  assert.equal(metadata.filename, `projection-ui-design-${version}.zip`, 'The ZIP name must match its version.');
  assert.ok(Number.isSafeInteger(metadata.bytes) && metadata.bytes > 0 && metadata.bytes <= 32 * 1024 * 1024, 'Use a bounded design archive.');
  assert.match(metadata.sha256 ?? '', /^[a-f\d]{64}$/, 'The metadata must contain a SHA-256 digest.');
  assert.deepEqual(readdirSync(directory).sort(), [metadata.filename, 'design-package.json'].sort(), 'Use exactly the verified design ZIP and metadata.');
  const archivePath = join(directory, metadata.filename);
  assert.ok(lstatSync(archivePath).isFile() && !lstatSync(archivePath).isSymbolicLink(), 'Use a regular ZIP file.');
  const archive = readFileSync(archivePath);
  assert.equal(archive.length, metadata.bytes, 'The ZIP byte count must match its metadata.');
  assert.equal(sha256(archive), metadata.sha256, 'The ZIP digest must match its metadata.');
  const assets = [{ name: metadata.filename, path: archivePath, bytes: archive }, { name: 'design-package.json', path: metadataPath, bytes: metadataBytes }];

  const command = args => {
    const result = runGh(args);
    if (result.error || result.status !== 0) throw new Error(`GitHub ${args[0]} ${args[1]} failed. No existing asset was replaced.`);
    return Buffer.from(result.stdout ?? '');
  };
  const api = (path, allowMissing = false) => {
    const result = runGh(['api', '--hostname', 'github.com', '--include', path]);
    const output = Buffer.from(result.stdout ?? '').toString('utf8');
    const status = Number(output.match(/^HTTP\/[\d.]+\s+(\d+)/)?.[1]);
    if (allowMissing && status === 404 && result.status !== 0) return null;
    if (result.error || result.status !== 0 || status !== 200) throw new Error('GitHub did not return a valid release response.');
    const boundary = output.match(/\r?\n\r?\n/);
    assert.ok(boundary, 'GitHub must return response headers.');
    return JSON.parse(output.slice(boundary.index + boundary[0].length));
  };
  const verifyTag = () => {
    let object = api(`${endpoint}/git/ref/tags/${tag}`).object;
    const visited = new Set();
    while (object?.type === 'tag') {
      assert.match(object.sha ?? '', /^[a-f\d]{40}$/i, 'Use a valid annotated tag.');
      assert.ok(!visited.has(object.sha) && visited.size < 8, 'The tag chain must be finite.');
      visited.add(object.sha);
      object = api(`${endpoint}/git/tags/${object.sha}`).object;
    }
    assert.equal(object?.type, 'commit', 'The release tag must identify a commit.');
    assert.equal(object.sha, environment.GITHUB_SHA, 'The remote tag must match the verified workflow commit.');
  };
  const releasePath = `${endpoint}/releases/tags/${tag}`;
  const verifyAssets = release => {
    assert.equal(release.tag_name, tag, 'The release must match the verified tag.');
    assert.equal(release.prerelease, prerelease, 'The release channel must match the package version.');
    assert.ok(Array.isArray(release.assets), 'GitHub must return the release assets.');
    const missing = [];
    for (const expected of assets) {
      const matches = release.assets.filter(asset => asset.name === expected.name);
      assert.ok(matches.length <= 1, 'An asset name must be unique.');
      if (!matches.length) { missing.push(expected); continue; }
      const actual = matches[0];
      assert.equal(actual.state, 'uploaded', 'An existing asset must be complete.');
      assert.equal(actual.size, expected.bytes.length, 'An existing asset has a different byte count.');
      if (actual.digest != null) assert.equal(actual.digest, `sha256:${sha256(expected.bytes)}`, 'An existing asset has a different digest.');
      assert.ok(Number.isSafeInteger(actual.id) && actual.id > 0, 'Use a valid release asset ID.');
      const downloaded = command(['api', '--hostname', 'github.com', '--header', 'Accept: application/octet-stream', `${endpoint}/releases/assets/${actual.id}`]);
      assert.deepEqual(downloaded, expected.bytes, 'An existing asset has different bytes.');
    }
    return missing;
  };

  verifyTag();
  let release = api(releasePath, true);
  if (!release) {
    const temporary = mkdtempSync(join(tmpdir(), 'projection-design-notes-'));
    try {
      const notes = join(temporary, 'release.md');
      writeFileSync(notes, `Projection UI ${version} includes the matching editable Figma design kit.\n\nThe ZIP SHA-256 digest is \`${metadata.sha256}\`.\nThe metadata records the archive size and design inventory.\n`);
      verifyTag();
      command(['release', 'create', tag, ...assets.map(asset => asset.path), '--repo', repo, '--verify-tag', '--target', environment.GITHUB_SHA, '--title', `Projection UI ${version}`, '--notes-file', notes, prerelease ? '--latest=false' : '--latest=true', ...prerelease ? ['--prerelease'] : []]);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  } else {
    const missing = verifyAssets(release);
    if (missing.length) {
      assert.equal(release.immutable, false, 'An immutable release cannot receive missing assets.');
      verifyTag();
      command(['release', 'upload', tag, ...missing.map(asset => asset.path), '--repo', repo]);
      release = api(releasePath);
      assert.equal(verifyAssets(release).length, 0, 'The release must retain both verified design assets.');
    }
    if (!release.draft) {
      verifyTag();
      return { version, tag, filename: metadata.filename, sha256: metadata.sha256 };
    }
    verifyTag();
    command(['release', 'edit', tag, '--repo', repo, '--draft=false']);
  }
  release = api(releasePath);
  assert.equal(verifyAssets(release).length, 0, 'The published release must contain both verified design assets.');
  assert.equal(release.draft, false, 'The release must be published.');
  verifyTag();
  return { version, tag, filename: metadata.filename, sha256: metadata.sha256 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 2, 'Run node scripts/publish-design-release.mjs without arguments.');
  console.log(JSON.stringify(publishDesignRelease()));
}
