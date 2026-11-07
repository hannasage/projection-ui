import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gateProblem, jobRunSteps, matchingFilters, pushTagFilters, tagMatches } from '../tools/lib/workflow.mjs';
import { cleanup, git, makeFakeBin, repoRoot, scrubbed, tempDir } from './helpers/tools-support.mjs';

const read = (path) => readFileSync(join(repoRoot, path), 'utf8');
const config = JSON.parse(read('release.config.json'));
const pkg = JSON.parse(read('package.json'));
const workflow = read(config.workflow.file);
const release = await import(pathToFileURL(join(repoRoot, 'scripts/release.mjs')).href);

describe('release.config.json', () => {
  it('passes the strict schema', () => {
    assert.equal(release.configProblem(config), null);
  });

  it('names this package and the beta tag of the 1.0.0-beta.0 release', () => {
    assert.equal(config.package, pkg.name);
    assert.equal(config.version, '1.0.0-beta.0');
    assert.equal(config.npmTag, 'beta');
    assert.equal(release.gitTagName(config), 'v1.0.0-beta.0');
  });

  it('prints a tag that the beta filters match, and that the stable and old filters do not', () => {
    const tag = release.gitTagName(config);
    assert.equal(tagMatches('v1.0.0-beta.*', tag), true);
    assert.equal(tagMatches('v1.0.0', tag), false);
    assert.equal(tagMatches('v0.2.0-next.*', tag), false);
  });

  it('lists only gates that are package scripts and steps of the verify job in publish.yml', () => {
    const steps = jobRunSteps(workflow, config.workflow.verifyJob);
    for (const gate of config.gates) {
      assert.ok(pkg.scripts[gate], `${gate} is a package script`);
      assert.ok(steps.includes(`npm run ${gate}`) || (gate === 'test' && steps.includes('npm test')), `${gate} is a verify step`);
    }
    assert.ok(steps.includes('npm ci'));
    assert.ok(steps.includes(`node ${config.workflow.verifier}`));
  });

  it('keeps the design kit name, folder, and metadata file in line with the build and the workflow', () => {
    assert.equal(config.designKit.name, 'projection-ui-design-{version}.zip');
    assert.ok(read('scripts/build-design-package.mjs').includes('projection-ui-design-${manifest.version}.zip'));
    assert.ok(read('scripts/publish-design-release.mjs').includes('projection-ui-design-${version}.zip'));
    assert.ok(workflow.includes(`${config.designKit.dir}/projection-ui-design-*.zip`));
    assert.ok(workflow.includes(`${config.designKit.dir}/${config.designKit.metadata}`));
  });
});

describe('publish.yml stays in charge', () => {
  it('keeps every gate un-skippable and makes the publish job need the verify job', () => {
    const gates = [['npm ci'], ...config.gates.map((name) => (name === 'test' ? ['npm run test', 'npm test'] : [`npm run ${name}`])), [`node ${config.workflow.verifier}`]];
    const ciOnly = config.ciOnlyGates.map((entry) => ('command' in entry ? [entry.command] : [`npm run ${entry.name}`]));
    const { verifyJob, publishJob, justified, publishEnvironment, publishUses } = config.workflow;
    assert.equal(gateProblem(workflow, { verifyJob, publishJob, gates, ciOnly, justified, publishEnvironment, publishUses, publishCommand: `node ${config.workflow.verifier} --publish` }), null);
  });

  it('still publishes through the protected environment and the verifier, and the script does not replace it', () => {
    assert.match(workflow, /environment: npm-publish/);
    assert.match(workflow, /id-token: write/);
    assert.match(workflow, /node scripts\/verify-release\.mjs --publish/);
    const source = read('scripts/release.mjs');
    assert.ok(!/\["npm", "publish"(?!, "--dry-run")/.test(source), 'npm publish is only built with --dry-run');
    for (const forbidden of ['["npm", "login"', '["npm", "deprecate"', '["npm", "dist-tag"', '["git", "tag"', '["git", "push"', '--provenance']) assert.ok(!source.includes(forbidden), forbidden);
  });

  it('has a tag filter that matches the tag of the version in package.json, so the workflow can publish what the repository holds', () => {
    const filters = pushTagFilters(workflow);
    assert.equal(filters.ok, true, filters.error);
    const tag = `v${pkg.version}`;
    assert.ok(matchingFilters(filters.tags, tag).length > 0, `${tag} is matched by ${filters.tags.join(', ')}`);
  });
});

describe('release line agreement', () => {
  it('has the same version in package.json and release.config.json', () => {
    assert.equal(pkg.version, config.version);
  });

  it('is accepted by scripts/release-channel.mjs on the configured tag', async () => {
    const { releaseChannel } = await import(pathToFileURL(join(repoRoot, 'scripts/release-channel.mjs')).href);
    assert.equal(releaseChannel(config.version), config.npmTag);
  });

  it('is accepted by scripts/verify-release.mjs for the tag the script prints', () => {
    const result = spawnSync(process.execPath, [join(repoRoot, config.workflow.verifier)], { cwd: repoRoot, env: scrubbed({ GITHUB_REF: `refs/tags/${release.gitTagName(config)}` }), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  });

  it('is matched by the tag filters of publish.yml, which lists v1.0.0 and v1.0.0-beta.*', () => {
    const filters = pushTagFilters(workflow);
    assert.deepEqual(filters.tags, ['v1.0.0', 'v1.0.0-beta.*']);
    assert.deepEqual(matchingFilters(filters.tags, release.gitTagName(config)), ['v1.0.0-beta.*']);
  });

  it('has a docs edition that shows the version', async () => {
    const { editionForPackage } = await import(pathToFileURL(join(repoRoot, config.docsEdition.module)).href);
    assert.equal(editionForPackage(config.version).label, '1.0.0');
  });

  it('passes preflight on a clean checkout of the committed tree, and the tag it prints matches the workflow filter', () => {
    const fake = makeFakeBin();
    const base = tempDir('projection-agree-');
    const origin = join(base, 'origin.git');
    const work = join(base, 'work');
    git(base, 'clone', '-q', '--bare', repoRoot, origin);
    git(base, 'clone', '-q', origin, work);
    git(work, 'checkout', '-q', '-B', config.releaseBranch, git(repoRoot, 'rev-parse', 'HEAD'));
    git(work, 'push', '-q', '-f', 'origin', config.releaseBranch);
    git(work, 'branch', '-q', '--set-upstream-to', `origin/${config.releaseBranch}`);
    const preflight = spawnSync(process.execPath, [join(work, 'scripts/release.mjs'), 'preflight'], { cwd: work, env: fake.env(), encoding: 'utf8' });
    assert.equal(preflight.status, 0, preflight.stdout + preflight.stderr);
    const tag = spawnSync(process.execPath, [join(work, 'scripts/release.mjs'), 'tag'], { cwd: work, env: fake.env(), encoding: 'utf8' });
    const printed = /git tag -a (\S+) /.exec(tag.stdout)?.[1];
    assert.equal(printed, 'v1.0.0-beta.0');
    assert.ok(matchingFilters(pushTagFilters(workflow).tags, printed).includes('v1.0.0-beta.*'));
    assert.equal(git(work, 'tag', '--list', 'v1.*'), '');
    assert.equal(git(origin, 'tag', '--list', 'v1.*'), '');
    cleanup();
  });

  it('accepts the design kit that scripts/build-design-package.mjs builds for this version', async () => {
    const { buildDesignPackage } = await import(pathToFileURL(join(repoRoot, 'scripts/build-design-package.mjs')).href);
    const root = tempDir('projection-kit-');
    const dir = join(root, config.designKit.dir);
    mkdirSync(join(root, 'design-package'), { recursive: true });
    copyFileSync(join(repoRoot, config.designKit.scene), join(root, config.designKit.scene));
    const metadata = buildDesignPackage(dir);
    assert.equal(metadata.filename, 'projection-ui-design-1.0.0-beta.0.zip');
    assert.equal(release.designKitName(config), metadata.filename);
    assert.equal(release.designKitProblem(root, config), null);
    assert.deepEqual(readdirSync(dir).sort(), [metadata.filename, config.designKit.metadata].sort());
    cleanup();
  });
});
