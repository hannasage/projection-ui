import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRelease } from '../scripts/release.mjs';
import { cleanup, filtersFor, git, makeReleaseRepo, snapshot, tempDir, workflowText } from './helpers/tools-support.mjs';

afterEach(cleanup);

const parse = (text) => JSON.parse(text);
const FORBIDDEN = /^(login|adduser|whoami|deprecate|dist-tag|unpublish|token)\b|^publish(?!.*--dry-run)/;

function expectNoRegistryWrites(repo) {
  for (const line of repo.fake.lines('npm')) assert.doesNotMatch(line, FORBIDDEN, line);
}

/** Commits a change on the release branch and pushes it, so the checkout stays clean and in step with origin. */
function commitFile(repo, path, text) {
  mkdirSync(join(repo.work, path, '..'), { recursive: true });
  writeFileSync(join(repo.work, path), text);
  git(repo.work, 'add', '-A');
  git(repo.work, 'commit', '-q', '--allow-empty', '-m', `change ${path}`);
  git(repo.work, 'push', '-q', 'origin', repo.config.releaseBranch);
}

async function preflighted(options) {
  const repo = await makeReleaseRepo(options);
  const result = repo.run(['preflight']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return repo;
}

describe('usage', () => {
  it('exits 2 for an unknown subcommand and says how to use the script', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['launch']);
    assert.equal(result.status, 2);
    assert.match(result.stdout, /Usage/);
  });

  it('exits 2 with one JSON object under --json', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['--json', 'launch']);
    assert.equal(result.status, 2);
    const body = parse(result.stdout);
    assert.equal(body.ok, false);
    assert.equal(body.status, 'usage');
    assert.equal(body.exit, 2);
  });

  it('exits 2 for a flag that does not exist, including the old tag --dry-run flag, and for no subcommand', async () => {
    const repo = await makeReleaseRepo();
    assert.equal(repo.run(['gates', '--bogus']).status, 2);
    assert.equal(repo.run(['tag', '--dry-run']).status, 2);
    assert.equal(repo.run([]).status, 2);
    assert.equal(repo.run(['constructor']).status, 2);
  });

  it('exits 0 for --help', async () => {
    assert.equal((await makeReleaseRepo()).run(['--help']).status, 0);
  });
});

describe('config schema', () => {
  const bad = async (edit) => {
    const repo = await makeReleaseRepo();
    const config = { ...repo.config };
    edit(config);
    writeFileSync(join(repo.work, 'release.config.json'), JSON.stringify(config));
    return repo.run(['claims']);
  };

  it('refuses an unknown key, so a typo cannot hide', async () => {
    const result = await bad((config) => { config.extra = 1; });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /exactly these keys/);
  });

  it('refuses a package name, branch, remote, or tag name with odd characters', async () => {
    for (const edit of [
      (config) => { config.package = '@a/b; rm -rf x'; },
      (config) => { config.releaseBranch = '--upload-pack=x'; },
      (config) => { config.remote = '-oProxyCommand=x'; },
      (config) => { config.gitTag.name = 'v{version} $(x)'; },
    ]) assert.equal((await bad(edit)).status, 1);
  });

  it('pins retire.checks to npm view and retire.commands to deprecate and dist-tag', async () => {
    assert.equal((await bad((config) => { config.retire.checks = [['npm', 'publish', 'x']]; })).status, 1);
    assert.equal((await bad((config) => { config.retire.commands = [['npm', 'publish', 'x', 'y']]; })).status, 1);
    assert.equal((await bad((config) => { config.retire.commands = [['rm', '-rf', 'x']]; })).status, 1);
  });

  it('keeps claim paths inside the repository', async () => {
    assert.equal((await bad((config) => { config.claims.paths = ['../outside']; })).status, 1);
    assert.equal((await bad((config) => { config.claims.paths = ['/etc']; })).status, 1);
  });

  it('exits 1 when release.config.json is not JSON', async () => {
    const repo = await makeReleaseRepo();
    writeFileSync(join(repo.work, 'release.config.json'), '{ not json');
    assert.equal(repo.run(['claims']).status, 1);
  });
});

describe('preflight', () => {
  it('passes on a clean release branch, prints each command first, and runs again as already done', async () => {
    const repo = await makeReleaseRepo();
    const first = repo.run(['preflight']);
    assert.equal(first.status, 0, first.stdout);
    assert.match(first.stdout, /\$ git fetch -- origin/);
    assert.match(first.stdout, /\$ git -c status\.showUntrackedFiles=all status --short --untracked-files=all --ignore-submodules=none/);
    const second = repo.run(['preflight']);
    assert.equal(second.status, 0);
    assert.match(second.stdout, /already done/);
    assert.match(repo.run(['preflight', '--force']).stdout, /already done|preflight passed/);
    expectNoRegistryWrites(repo);
  });

  it('prints one JSON object with the exit code of each step', async () => {
    const repo = await makeReleaseRepo();
    const body = parse(repo.run(['preflight', '--json']).stdout);
    assert.equal(body.ok, true);
    assert.equal(body.status, 'pass');
    assert.ok(body.steps.length > 3);
    assert.ok(body.steps.every((step) => step.exit === 0));
    assert.match(body.commit, /^[0-9a-f]{40}$/);
  });

  it('fails when the branch is not the release branch', async () => {
    const repo = await makeReleaseRepo();
    git(repo.work, 'checkout', '-q', '-b', 'other');
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /FAILED preflight: on branch other/);
  });

  it('fails when the branch is behind or ahead of origin', async () => {
    const behind = await makeReleaseRepo();
    commitFile(behind, 'x.txt', 'x\n');
    git(behind.work, 'reset', '-q', '--hard', 'HEAD~1');
    assert.match(behind.run(['preflight']).stdout, /behind/);
    const ahead = await makeReleaseRepo();
    writeFileSync(join(ahead.work, 'y.txt'), 'y\n');
    git(ahead.work, 'add', '-A');
    git(ahead.work, 'commit', '-q', '-m', 'local only');
    assert.match(ahead.run(['preflight']).stdout, /commits that origin\/.* lacks/);
  });

  it('fails when the working tree is not clean', async () => {
    const repo = await makeReleaseRepo();
    writeFileSync(join(repo.work, 'stray.txt'), 'x\n');
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /working tree is not clean: \?\? stray.txt/);
  });

  it('fails when package.json and release.config.json name different versions', async () => {
    const repo = await makeReleaseRepo();
    const pkg = JSON.parse(readFileSync(join(repo.work, 'package.json'), 'utf8'));
    pkg.version = '9.9.9';
    commitFile(repo, 'package.json', JSON.stringify(pkg));
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /package.json version is 9.9.9/);
  });

  it('fails when the changelog has no heading for the version, through the real verify-release rules', async () => {
    const repo = await makeReleaseRepo();
    commitFile(repo, 'CHANGELOG.md', '# Changelog\n\n## 0.0.1 something else\n');
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /scripts\/verify-release.mjs rejects/);
  });

  it('fails when the channel rules and the npm tag in the config disagree', async () => {
    const repo = await makeReleaseRepo();
    const config = { ...repo.config, npmTag: 'wrong' };
    commitFile(repo, 'release.config.json', JSON.stringify(config));
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /belongs on the .* tag, release.config.json says wrong/);
  });

  it('fails when the publish workflow would not start for the tag', async () => {
    const repo = await makeReleaseRepo();
    commitFile(repo, '.github/workflows/publish.yml', workflowText(['v0.0.1', 'v0.0.1-old.*']));
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /would not start for the tag v/);
  });

  it('fails when the verify job of the workflow lacks a gate the script runs', async () => {
    const repo = await makeReleaseRepo();
    commitFile(repo, '.github/workflows/publish.yml', workflowText(filtersFor(repo.config.version), { skip: ['lint'] }));
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /does not run: npm run lint/);
  });

  it('fails when the docs edition does not show the version', async () => {
    const repo = await makeReleaseRepo();
    commitFile(repo, 'docs-site/lib/versions.mjs', readFileSync(join(repo.work, 'docs-site/lib/versions.mjs'), 'utf8').replace(/label: '[^']+'/, "label: '7.7.7'"));
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /docs edition/);
  });

  it('reports a corrupt state file and exits 1', async () => {
    const repo = await preflighted();
    writeFileSync(join(repo.work, '.git', 'release-state.json'), '{ broken');
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /release-state.json .* is corrupt/);
  });

  it('exits 1 when the state file cannot be written', async () => {
    const repo = await makeReleaseRepo();
    // A folder where the note should be makes the write fail.
    mkdirSync(join(repo.work, '.git', 'release-state.json'));
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /FAILED preflight/);
  });

  it('works inside a linked worktree, where .git is a file', async () => {
    const repo = await makeReleaseRepo();
    git(repo.work, 'checkout', '-q', '-b', 'spare');
    const linked = join(repo.work, '..', 'linked');
    git(repo.work, 'worktree', 'add', '-q', linked, repo.config.releaseBranch);
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(process.execPath, [join(linked, 'scripts/release.mjs'), 'preflight'], { cwd: linked, env: repo.env(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(existsSync(join(repo.work, '.git', 'worktrees')), 'the worktree has its own git folder');
  });
});

describe('gates', () => {
  it('runs npm ci, then every configured gate in order', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['gates']);
    assert.equal(result.status, 0, result.stdout);
    assert.deepEqual(repo.fake.lines('npm'), ['ci', ...repo.config.gates.map((name) => `run ${name}`)]);
    expectNoRegistryWrites(repo);
  });

  it('stops at the first failing gate with its real exit code and one line', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['gates'], { FAKE_FAIL_RUN: 'lint', FAKE_FAIL_CODE: '3', FAKE_FAIL_MESSAGE: 'src/a.ts: error no-unused-vars\nsecond line' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /FAILED gates: npm run lint exited 3: src\/a.ts: error no-unused-vars/);
    assert.doesNotMatch(result.stdout, /second line/);
    assert.ok(!repo.fake.lines('npm').includes('run test'));
  });

  it('runs again as already done, and --force runs the gates again', async () => {
    const repo = await makeReleaseRepo();
    assert.equal(repo.run(['gates']).status, 0);
    const count = repo.fake.lines('npm').length;
    assert.match(repo.run(['gates']).stdout, /already done/);
    assert.equal(repo.fake.lines('npm').length, count);
    assert.doesNotMatch(repo.run(['gates', '--force']).stdout, /already done/);
    assert.ok(repo.fake.lines('npm').length > count);
  });

  it('refuses to run on a dirty tree', async () => {
    const repo = await makeReleaseRepo();
    writeFileSync(join(repo.work, 'stray.txt'), 'x\n');
    const result = repo.run(['gates']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /refused: the working tree is not clean/);
    assert.deepEqual(repo.fake.lines('npm'), []);
  });

  it('records nothing when the gates leave a file behind, so the next run is not already done', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['gates'], { FAKE_DIRTY_RUN: 'build' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /changed the working tree, so nothing is recorded/);
    const state = existsSync(join(repo.work, '.git', 'release-state.json')) ? parse(readFileSync(join(repo.work, '.git', 'release-state.json'), 'utf8')) : {};
    assert.equal(state.gates, undefined);
  });

  it('binds the record to the lock file hash', async () => {
    const repo = await makeReleaseRepo();
    assert.equal(repo.run(['gates']).status, 0);
    const file = join(repo.work, '.git', 'release-state.json');
    const state = parse(readFileSync(file, 'utf8'));
    assert.match(state.gates.lock, /^[0-9a-f]{64}$/);
    state.gates.lock = 'f'.repeat(64);
    writeFileSync(file, JSON.stringify(state));
    assert.doesNotMatch(repo.run(['gates']).stdout, /already done/);
  });

  it('keeps registry and GitHub tokens away from the gate commands', async () => {
    const repo = await makeReleaseRepo();
    assert.equal(repo.run(['gates'], { NPM_TOKEN: 'secret', NODE_AUTH_TOKEN: 'secret', GH_TOKEN: 'secret' }).status, 0);
    for (const call of repo.fake.calls()) assert.equal(call.tokenSeen, false);
  });

  it('never prints a token shape, in text or in JSON', async () => {
    const repo = await makeReleaseRepo();
    const secret = `npm_${'a1B2c3D4e5'.repeat(3)}`;
    const text = repo.run(['gates'], { FAKE_FAIL_RUN: 'test', FAKE_FAIL_MESSAGE: `error: login failed with ${secret}` });
    assert.doesNotMatch(text.stdout + text.stderr, new RegExp(secret));
    const repo2 = await makeReleaseRepo();
    const body = repo2.run(['gates', '--json'], { FAKE_FAIL_RUN: 'test', FAKE_FAIL_MESSAGE: `error: login failed with ${secret}` });
    assert.doesNotMatch(body.stdout, new RegExp(secret));
    assert.equal(parse(body.stdout).exit, 1);
  });
});

describe('dry-run', () => {
  it('runs npm publish --dry-run with the tag, access, and ignore-scripts, and checks the facts', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['dry-run']);
    assert.equal(result.status, 0, result.stdout);
    assert.ok(repo.fake.lines('npm').includes(`publish --dry-run --tag ${repo.config.npmTag} --access public --ignore-scripts`));
    assert.match(result.stdout, /design kit and docs edition agree/);
    expectNoRegistryWrites(repo);
  });

  it('fails when the file count, the size, or the tag is wrong', async () => {
    assert.match((await (await makeReleaseRepo()).run(['dry-run'], { FAKE_FILES: '8' })).stdout, /total files: 8, expected 7/);
    assert.match((await (await makeReleaseRepo()).run(['dry-run'], { FAKE_SIZE: '900 kB' })).stdout, /above the limit/);
    const repo = await makeReleaseRepo();
    const config = { ...repo.config, expectedFileCount: 0 };
    commitFile(repo, 'release.config.json', JSON.stringify(config));
    assert.match(repo.run(['dry-run']).stdout, /total files: 7, expected 0/);
  });

  it('fails when the design kit zip is missing, misnamed, stale, altered, or not a zip', async () => {
    const dir = (repo) => join(repo.work, repo.config.designKit.dir);
    const missing = await makeReleaseRepo();
    rmSync(join(dir(missing), missing.kitName));
    assert.match(missing.run(['dry-run']).stdout, /design kit: .*is missing/);
    const extra = await makeReleaseRepo();
    writeFileSync(join(dir(extra), 'projection-ui-design-0.0.1.zip'), 'PK');
    assert.match(extra.run(['dry-run']).stdout, /design kit: .*needs exactly/);
    const altered = await makeReleaseRepo();
    writeFileSync(join(dir(altered), altered.kitName), 'PK\u0003\u0004changed');
    assert.match(altered.run(['dry-run']).stdout, /design kit: .*(bytes|SHA-256)/);
    const notZip = await makeReleaseRepo();
    const zipPath = join(dir(notZip), notZip.kitName);
    const body = Buffer.from('not a zip at all');
    writeFileSync(zipPath, body);
    const meta = parse(readFileSync(join(dir(notZip), 'design-package.json'), 'utf8'));
    const { createHash } = await import('node:crypto');
    writeFileSync(join(dir(notZip), 'design-package.json'), JSON.stringify({ ...meta, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') }));
    assert.match(notZip.run(['dry-run']).stdout, /is not a zip file/);
    const wrongVersion = await makeReleaseRepo();
    writeFileSync(join(dir(wrongVersion), 'design-package.json'), JSON.stringify({ ...meta, version: '0.0.1' }));
    assert.match(wrongVersion.run(['dry-run']).stdout, /says version 0.0.1/);
  });

  it('fails when the built docs show another version', async () => {
    const repo = await makeReleaseRepo();
    writeFileSync(join(repo.work, repo.config.docsEdition.builtRelease), JSON.stringify({ version: '0.0.1' }));
    assert.match(repo.run(['dry-run']).stdout, /docs edition: .*says 0.0.1/);
    const missing = await makeReleaseRepo();
    rmSync(join(missing.work, missing.config.docsEdition.builtVersions));
    assert.match(missing.run(['dry-run']).stdout, /docs edition: .*is missing/);
  });

  it('refuses a dirty tree and runs again as already done', async () => {
    const repo = await makeReleaseRepo();
    writeFileSync(join(repo.work, 'stray.txt'), 'x\n');
    assert.equal(repo.run(['dry-run']).status, 1);
    rmSync(join(repo.work, 'stray.txt'));
    assert.equal(repo.run(['dry-run']).status, 0);
    assert.match(repo.run(['dry-run']).stdout, /already done/);
  });
});

describe('publish (human only)', () => {
  it('without a terminal prints the steps, runs nothing, and exits 2', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['publish']);
    assert.equal(result.status, 2);
    assert.match(result.stdout, /human-only/);
    assert.match(result.stdout, /npm run release -- tag/);
    assert.match(result.stdout, /npm-publish environment/);
    assert.deepEqual(repo.fake.lines('npm').filter((line) => !line.startsWith('view')), []);
    expectNoRegistryWrites(repo);
  });

  it('with a terminal only prints, exits 0, and still runs no publish, login, or tag', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.runTTY(['publish']);
    assert.equal(result.status, 0, result.stdout);
    expectNoRegistryWrites(repo);
    assert.equal(git(repo.work, 'tag', '--list'), '');
  });

  it('says already done when the registry shows the version on the tag', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    const result = repo.run(['publish']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /already done/);
  });
});

describe('verify', () => {
  it('fails when the registry cannot be read or the tag is not the version', async () => {
    const repo = await makeReleaseRepo();
    rmRegistry(repo);
    assert.match(repo.run(['verify']).stdout, /could not read the registry/);
    repo.setRegistry({ latest: '0.1.5' });
    assert.match(repo.run(['verify']).stdout, /dist-tag .* is missing, expected/);
    repo.setRegistry({ [repo.config.npmTag]: '0.0.1' });
    assert.equal(repo.run(['verify']).status, 1);
  });

  it('installs with --ignore-scripts into a clean project and loads every entry', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    const result = repo.run(['verify', '--json'], { NPM_TOKEN: 'secret' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const body = parse(result.stdout);
    assert.deepEqual(Object.keys(body.exports).sort(), ['.', './core']);
    const install = repo.fake.calls().find((call) => call.args[0] === 'install');
    assert.ok(install.args.includes('--ignore-scripts'));
    assert.ok(install.args.includes(`${repo.config.package}@${repo.config.npmTag}`));
    assert.notEqual(install.cwd, repo.work);
    assert.equal(install.tokenSeen, false);
    assert.notEqual(install.home, repo.env().HOME);
    expectNoRegistryWrites(repo);
  });

  it('prints a short label instead of the child program, passes the package name as an argument, and keeps it out of the program text', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    const body = parse(repo.run(['verify', '--json']).stdout);
    const programs = body.steps.filter((step) => step.command.includes('--input-type=module'));
    assert.ok(programs.length >= 2);
    for (const step of programs) {
      assert.match(step.command, /^node (?:--(?:experimental-)?permission '--allow-fs-read=<project>' )?--input-type=module -e '<[a-z ]+>' /);
      assert.doesNotMatch(step.command, /import\(|process\.argv|console\.log/);
    }
    assert.ok(programs.some((step) => step.command.endsWith(` ${repo.config.package}`)));
    const source = readFileSync(join(repo.work, 'scripts/release.mjs'), 'utf8');
    const line = source.split('\n').find((text) => text.includes('const program = '));
    assert.match(line, /process\.argv\[1\]/);
    assert.doesNotMatch(line, /\$\{|projection/);
  });

  it('fails on a wrong installed version, a dropped entry, a missing file, and an empty module', async () => {
    const cases = [
      [{ FAKE_INSTALLED_VERSION: '0.0.1' }, /installed version is 0.0.1/],
      [{ FAKE_DROP_ENTRY: './core' }, /lacks the entry \.\/core/],
      [{ FAKE_OMIT_FILE: './dist/core.js' }, /installed file \.\/dist\/core\.js for \.\/core is missing/],
      [{ FAKE_OMIT_FILE: './dist/core.d.ts' }, /installed file \.\/dist\/core\.d\.ts for \.\/core is missing/],
      [{ FAKE_OMIT_FILE: './dist/core.cjs' }, /installed file \.\/dist\/core\.cjs for \.\/core is missing/],
      [{ FAKE_ADD_ENTRY: './extra' }, /has the entry \.\/extra, which the source does not declare/],
      [{ FAKE_EMPTY_EXPORT: './dist/core.js' }, /exports no names/],
      [{ FAKE_OMIT_FILE: './dist/tokens/theme.css' }, /installed file \.\/dist\/tokens\/theme\.css for \.\/tokens is missing/],
      [{ FAKE_OMIT_FILE: './dist/tokens/scoped.css' }, /installed file \.\/dist\/tokens\/scoped\.css for \.\/styles is missing/],
    ];
    for (const [env, pattern] of cases) {
      const repo = await makeReleaseRepo();
      repo.setRegistry(repo.publishedTags());
      const result = repo.run(['verify'], env);
      assert.equal(result.status, 1, JSON.stringify(env));
      assert.match(result.stdout, pattern);
    }
  });

  it('reads the registry again before saying already done', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    assert.equal(repo.run(['verify']).status, 0);
    assert.match(repo.run(['verify']).stdout, /already done/);
    repo.setRegistry({ latest: '0.1.5' });
    const third = repo.run(['verify']);
    assert.equal(third.status, 1);
    assert.doesNotMatch(third.stdout, /already done/);
  });

  it('checks the design kit and the built docs too', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    rmSync(join(repo.work, repo.config.designKit.dir, repo.kitName));
    assert.match(repo.run(['verify']).stdout, /design kit: /);
  });

  it('leaves no temporary project behind', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    repo.run(['verify']);
    const install = repo.fake.calls().find((call) => call.args[0] === 'install');
    assert.equal(existsSync(install.cwd), false);
  });
});

function rmRegistry(repo) {
  rmSync(join(repo.fake.fixtures, 'dist-tags.json'), { force: true });
}

describe('tag (human only, decision 1A)', () => {
  async function ready() {
    const repo = await makeReleaseRepo();
    for (const step of ['preflight', 'gates', 'dry-run']) assert.equal(repo.run([step]).status, 0, step);
    return repo;
  }
  const noTags = (repo) => {
    assert.equal(git(repo.work, 'tag', '--list'), '', 'no local tag');
    assert.equal(git(repo.origin, 'tag', '--list'), '', 'no tag on the remote');
  };

  it('without a terminal prints the exact tag commands, runs nothing, and exits 2', async () => {
    const repo = await ready();
    const result = repo.run(['tag']);
    assert.equal(result.status, 2);
    const commit = git(repo.work, 'rev-parse', 'HEAD');
    const name = `v${repo.config.version}`;
    assert.ok(result.stdout.includes(`git tag -a ${name} ${commit} -m ${repo.config.version}`), result.stdout);
    assert.ok(result.stdout.includes(`git push origin ${name}`));
    assert.match(result.stdout, /starts \.github\/workflows\/publish\.yml/);
    noTags(repo);
  });

  it('with a terminal and everything recorded, still only prints and exits 0', async () => {
    const repo = await ready();
    const result = repo.runTTY(['tag']);
    assert.equal(result.status, 0, result.stdout);
    assert.ok(result.stdout.includes(`git push origin v${repo.config.version}`));
    noTags(repo);
    expectNoRegistryWrites(repo);
  });

  it('with a terminal and a missing record exits 1, names what is missing, and creates no tag', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.runTTY(['tag']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /NOT READY: preflight has not been recorded/);
    noTags(repo);
  });

  it('does not trust a forged note: a dirty tree or a moved branch still blocks it', async () => {
    const repo = await ready();
    writeFileSync(join(repo.work, 'stray.txt'), 'x\n');
    const result = repo.runTTY(['tag']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /working tree is not clean/);
    noTags(repo);
  });

  it('blocks when the publish workflow would not start for the tag', async () => {
    const repo = await ready();
    commitFile(repo, '.github/workflows/publish.yml', workflowText(['v0.0.1']));
    const result = repo.runTTY(['tag']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /would not start for the tag/);
  });

  it('prints one JSON object with the commands and no blockers when ready', async () => {
    const repo = await ready();
    const body = parse(repo.run(['tag', '--json']).stdout);
    assert.equal(body.exit, 2);
    assert.equal(body.status, 'refused');
    assert.equal(body.commands.length, 2);
    assert.deepEqual(body.blockers, []);
  });

  it('says already done when the tag is on the machine and on the remote', async () => {
    const repo = await ready();
    git(repo.work, 'tag', '-a', `v${repo.config.version}`, '-m', 'x');
    git(repo.work, 'push', '-q', 'origin', `v${repo.config.version}`);
    const result = repo.run(['tag']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /already done/);
  });
});

describe('retire (human only)', () => {
  const noCommands = (config) => {
    config.retire.commands = [];
    config.retire.checks = [];
  };
  const deprecate = (repo, text = 'Renamed to the beta tag. Use 1.0.0-beta.0.') => writeFileSync(join(repo.fake.fixtures, 'deprecated.txt'), text);

  it('uses the commands in the config: deprecate the old alpha and remove the next tag, and nothing for latest', async () => {
    const repo = await makeReleaseRepo();
    assert.deepEqual(repo.config.retire.commands, [
      ['npm', 'deprecate', '@hannasage/projection-ui@0.2.0-next.2', 'Renamed to the beta tag. Use 1.0.0-beta.0.'],
      ['npm', 'dist-tag', 'rm', '@hannasage/projection-ui', 'next'],
    ]);
    assert.match(repo.config.retire.note, /decision for the package owner and it is not made yet/);
    assert.match(repo.config.retire.note, /only after verify passes/);
    assert.ok(!repo.config.retire.commands.some((command) => command.includes('latest')));
  });

  it('says already done when the config has nothing to retire', async () => {
    const repo = await makeReleaseRepo({ configEdit: noCommands });
    const result = repo.run(['retire']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /already done: /);
  });

  it('without a terminal prints the note and the commands, exits 2, and runs no write', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['retire']);
    assert.equal(result.status, 2);
    assert.match(result.stdout, /npm deprecate @hannasage\/projection-ui@0.2.0-next.2 'Renamed to the beta tag. Use 1.0.0-beta.0.'/);
    assert.match(result.stdout, /npm dist-tag rm @hannasage\/projection-ui next/);
    assert.match(result.stdout, /Note: This is a decision for the package owner/);
    expectNoRegistryWrites(repo);
  });

  it('with a terminal refuses with exit 1 until verify has passed, then only prints', async () => {
    const repo = await makeReleaseRepo();
    const before = repo.runTTY(['retire']);
    assert.equal(before.status, 1);
    assert.match(before.stdout, /verify has not passed/);
    repo.setRegistry(repo.publishedTags());
    assert.equal(repo.run(['verify']).status, 0);
    const after = repo.runTTY(['retire']);
    assert.equal(after.status, 0, after.stdout);
    expectNoRegistryWrites(repo);
  });

  it('says already done when the registry shows the old version deprecated and the old tag gone', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    deprecate(repo);
    const result = repo.run(['retire']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /already done/);
  });

  it('is not done while the old tag is still there, or while the version is not deprecated', async () => {
    const stillTagged = await makeReleaseRepo();
    stillTagged.setRegistry({ ...stillTagged.publishedTags(), next: '0.2.0-next.2' });
    deprecate(stillTagged);
    assert.equal(stillTagged.run(['retire']).status, 2);
    const notDeprecated = await makeReleaseRepo();
    notDeprecated.setRegistry(notDeprecated.publishedTags());
    assert.equal(notDeprecated.run(['retire']).status, 2);
  });
});

describe('claims', () => {
  it('passes when no file holds a stale claim', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['claims', '--json']);
    assert.equal(result.status, 0);
    assert.equal(parse(result.stdout).status, 'pass');
  });

  it('matches in any letter case', async () => {
    const repo = await makeReleaseRepo();
    commitFile(repo, 'docs/start.md', 'This is an UNPUBLISHED Candidate.\n');
    assert.equal(repo.run(['claims']).status, 1);
  });

  it('fails when a configured folder holds no file to read', async () => {
    const repo = await makeReleaseRepo();
    rmSync(join(repo.work, 'docs-site/components'), { recursive: true });
    mkdirSync(join(repo.work, 'docs-site/components'));
    const result = repo.run(['claims']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /holds no file to read/);
  });

  it('fails with the first matching line', async () => {
    const repo = await makeReleaseRepo();
    commitFile(repo, 'docs/start.md', 'Intro\n`1.0.0` is an unpublished candidate.\n');
    const result = repo.run(['claims']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /docs\/start.md:2:/);
  });

  it('does not search the configured skip files or folders', async () => {
    const repo = await makeReleaseRepo();
    commitFile(repo, 'docs/archive/old.md', 'an unpublished candidate\n');
    commitFile(repo, 'docs/workflow-audit.md', 'an unpublished candidate\n');
    assert.equal(repo.run(['claims']).status, 0);
  });

  it('fails when a configured path is missing', async () => {
    const repo = await makeReleaseRepo();
    rmSync(join(repo.work, 'docs-site/app'), { recursive: true });
    const result = repo.run(['claims']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /docs-site\/app is missing/);
  });

  it('fails when a configured path is a link that leaves the repository', async () => {
    const repo = await makeReleaseRepo();
    rmSync(join(repo.work, 'docs-site/components'), { recursive: true });
    symlinkSync(join(repo.work, '..'), join(repo.work, 'docs-site/components'));
    const result = repo.run(['claims']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /symbolic link/);
  });
});

describe('status', () => {
  it('lists every phase and what is left', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['status']);
    assert.equal(result.status, 0);
    for (const name of ['preflight', 'gates', 'dry-run', 'tag', 'publish', 'verify', 'retire', 'claims']) assert.match(result.stdout, new RegExp(name));
    assert.match(result.stdout, /Left to do: /);
  });

  it('marks publish as unknown or todo, never done, when the registry has no such version', async () => {
    const repo = await makeReleaseRepo();
    const body = parse(repo.run(['status', '--json']).stdout);
    const publish = body.phases.find((phase) => phase.name === 'publish');
    assert.notEqual(publish.state, 'done');
  });

  it('shows every phase done after the full order, with the tag pushed by a person', async () => {
    const repo = await makeReleaseRepo();
    for (const step of ['preflight', 'gates', 'dry-run']) assert.equal(repo.run([step]).status, 0);
    const name = `v${repo.config.version}`;
    git(repo.work, 'tag', '-a', name, '-m', repo.config.version);
    git(repo.work, 'push', '-q', 'origin', name);
    repo.setRegistry(repo.publishedTags());
    writeFileSync(join(repo.fake.fixtures, 'deprecated.txt'), 'Renamed to the beta tag. Use 1.0.0-beta.0.');
    assert.equal(repo.run(['verify']).status, 0);
    const body = parse(repo.run(['status', '--json']).stdout);
    assert.deepEqual(body.left, []);
  });
});

describe('output', () => {
  it('holds no home path or absolute node path, in text or in JSON, for every subcommand', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    for (const step of ['preflight', 'gates', 'dry-run', 'verify', 'tag', 'publish', 'retire', 'claims', 'status']) {
      for (const flag of [[], ['--json']]) {
        const result = repo.run([step, ...flag]);
        assert.doesNotMatch(result.stdout + result.stderr, /\/(Users|home)\//, `${step} ${flag}`);
        assert.doesNotMatch(result.stdout + result.stderr, /\/node\b/, `${step} ${flag}`);
      }
    }
    const steps = parse(repo.run(['preflight', '--json', '--force']).stdout).steps;
    assert.ok(steps.some((step) => step.command === `node ${repo.config.workflow.verifier}`));
  });
});

describe('status tag phase', () => {
  async function recorded() {
    const repo = await makeReleaseRepo();
    assert.equal(repo.run(['preflight']).status, 0);
    return repo;
  }
  const tagPhase = (repo) => parse(repo.run(['status', '--json']).stdout).phases.find((phase) => phase.name === 'tag');

  it('is todo with a reason when the tags exist but point at another commit', async () => {
    const repo = await recorded();
    const head = git(repo.work, 'rev-parse', 'HEAD');
    const other = git(repo.work, 'commit-tree', `${head}^{tree}`, '-p', head, '-m', 'other');
    const name = `v${repo.config.version}`;
    git(repo.work, 'tag', name, other);
    git(repo.work, 'push', '-q', 'origin', `refs/tags/${name}`);
    const phase = tagPhase(repo);
    assert.equal(phase.state, 'todo');
    assert.match(phase.note, /points at/);
  });

  it('is done when the local and the remote tag both point at the preflight commit, even for an annotated tag', async () => {
    const repo = await recorded();
    const name = `v${repo.config.version}`;
    git(repo.work, 'tag', '-a', name, '-m', 'x');
    git(repo.work, 'push', '-q', 'origin', `refs/tags/${name}`);
    assert.equal(tagPhase(repo).state, 'done');
  });

  it('is todo when only one side has the tag, or when preflight recorded nothing', async () => {
    const repo = await recorded();
    const name = `v${repo.config.version}`;
    git(repo.work, 'tag', name);
    assert.match(tagPhase(repo).note, /remote tag is missing/);
    const bare = await makeReleaseRepo();
    git(bare.work, 'tag', '-a', `v${bare.config.version}`, '-m', 'x');
    git(bare.work, 'push', '-q', 'origin', `refs/tags/v${bare.config.version}`);
    assert.equal(tagPhase(bare).state, 'todo');
  });

  it('makes the tag step blockers name a tag that exists at another commit', async () => {
    const repo = await recorded();
    const head = git(repo.work, 'rev-parse', 'HEAD');
    const other = git(repo.work, 'commit-tree', `${head}^{tree}`, '-p', head, '-m', 'other');
    git(repo.work, 'tag', `v${repo.config.version}`, other);
    const result = repo.run(['tag']);
    assert.equal(result.status, 2);
    assert.match(result.stdout, /already exists .* does not match HEAD/);
  });
});

describe('schema pins (S1, S6)', () => {
  const bad = async (edit) => {
    const repo = await makeReleaseRepo();
    const config = JSON.parse(JSON.stringify(repo.config));
    edit(config);
    writeFileSync(join(repo.work, 'release.config.json'), JSON.stringify(config));
    return repo.run(['claims']);
  };

  it('pins the verifier, the workflow file, and the docs module to their literal paths', async () => {
    for (const edit of [
      (config) => { config.workflow.verifier = 'scripts/other.mjs'; },
      (config) => { config.workflow.file = '.github/workflows/other.yml'; },
      (config) => { config.docsEdition.module = 'scripts/evil.mjs'; },
    ]) assert.equal((await bad(edit)).status, 1);
  });

  it('pins the tag name and message to the version', async () => {
    assert.equal((await bad((config) => { config.gitTag.name = 'release-{version}'; })).status, 1);
    assert.equal((await bad((config) => { config.gitTag.message = 'x{version}'; })).status, 1);
  });

  it('allows only npm deprecate and npm dist-tag rm of this package, and never latest or the release tag', async () => {
    const pkg = '@hannasage/projection-ui';
    for (const commands of [
      [['npm', 'deprecate', '@other/pkg@0.2.0-next.2', 'x']],
      [['npm', 'deprecate', `${pkg}@${'1.0.0-beta.0'}`, 'x']],
      [['npm', 'deprecate', `${pkg}@0.2.0-next.2`, 'x', 'extra']],
      [['npm', 'deprecate', `${pkg}@0.2.0-next.2`, 'bad $(message)']],
      [['npm', 'dist-tag', 'rm', pkg, 'latest']],
      [['npm', 'dist-tag', 'add', pkg, 'x']],
      [['npm', 'dist-tag', 'rm', '@other/pkg', 'next']],
      [['npm', 'publish', pkg]],
    ]) assert.equal((await bad((config) => { config.retire.commands = commands; })).status, 1, JSON.stringify(commands));
  });

  it('refuses control characters and escape sequences anywhere in the config', async () => {
    const result = await bad((config) => { config.retire.note = 'Fine text \u001b[2J then more'; });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /control character or an escape sequence/);
    assert.doesNotMatch(result.stdout, /\u001b/);
  });
});

describe('the repository code runs in child processes (S1)', () => {
  it('runs the channel rules, the docs module, and the verifier with an allowlist environment', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['preflight', '--json'], { NPM_TOKEN: 'secret', NODE_AUTH_TOKEN: 'secret', MY_SECRET_VALUE: 'x' });
    assert.equal(result.status, 0, result.stdout);
    const commands = parse(result.stdout).steps.map((step) => step.command);
    assert.ok(commands.some((command) => command.includes('--input-type=module') && command.includes('scripts/release-channel.mjs channel')));
    assert.ok(commands.some((command) => command.includes('docs-site/lib/versions.mjs edition')));
    assert.ok(commands.includes(`node ${repo.config.workflow.verifier}`));
  });

  it('fails when the verifier is empty', async () => {
    const repo = await makeReleaseRepo();
    commitFile(repo, 'scripts/verify-release.mjs', '');
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /is empty or is not a file, so it checks nothing/);
  });

  it('fails when the verifier is missing or is a link', async () => {
    const missing = await makeReleaseRepo();
    rmSync(join(missing.work, 'scripts/verify-release.mjs'));
    git(missing.work, 'add', '-A');
    git(missing.work, 'commit', '-q', '-m', 'drop');
    git(missing.work, 'push', '-q', 'origin', missing.config.releaseBranch);
    assert.equal(missing.run(['preflight']).status, 1);
    const linked = await makeReleaseRepo();
    rmSync(join(linked.work, 'scripts/verify-release.mjs'));
    symlinkSync(join(linked.work, 'package.json'), join(linked.work, 'scripts/verify-release.mjs'));
    git(linked.work, 'add', '-A');
    git(linked.work, 'commit', '-q', '-m', 'link');
    git(linked.work, 'push', '-q', 'origin', linked.config.releaseBranch);
    const result = linked.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /symbolic link/);
  });

  it('does not run repository code in its own process: a module that prints a marker only prints it in a child', async () => {
    const repo = await makeReleaseRepo();
    const original = readFileSync(join(repo.work, 'scripts/release-channel.mjs'), 'utf8');
    commitFile(repo, 'scripts/release-channel.mjs', `console.log('CHILD-MARKER');\n${original}`);
    const result = repo.run(['preflight']);
    assert.equal(result.status, 0, result.stdout);
    assert.doesNotMatch(result.stdout, /CHILD-MARKER/);
  });
});

describe('environment allowlist (S3)', () => {
  it('gives npm only the allowlisted names, whatever the caller has set', async () => {
    const repo = await makeReleaseRepo();
    const secrets = { NPM_TOKEN: 'a', NODE_AUTH_TOKEN: 'b', GH_TOKEN: 'c', GITHUB_TOKEN: 'd', NPM_CONFIG_OTP: '123456', npm_config_otp: '123456', MY_PRIVATE_SETTING: 'e', AWS_SECRET_ACCESS_KEY: 'f' };
    assert.equal(repo.run(['gates'], secrets).status, 0);
    const allowed = /^(PATH|HOME|LANG|TERM|CI|npm_config_[a-z_]+|NO_UPDATE_NOTIFIER|PLAYWRIGHT_BROWSERS_PATH|TMPDIR|PWD|OLDPWD|SHLVL|_|__CF_USER_TEXT_ENCODING)$/;
    for (const call of repo.fake.calls().filter((entry) => entry.tool === 'npm')) {
      for (const name of call.envNames) assert.match(name, allowed, `${name} reached npm`);
      assert.ok(!call.envNames.some((name) => /TOKEN|OTP|SECRET|PRIVATE/i.test(name)));
    }
  });

  it('runs npm with a throwaway HOME and no user npm config', async () => {
    const repo = await makeReleaseRepo();
    assert.equal(repo.run(['gates']).status, 0);
    const realHome = repo.env().HOME;
    for (const call of repo.fake.calls().filter((entry) => entry.tool === 'npm')) assert.notEqual(call.home, realHome);
  });
});

describe('JSON stays valid and clean (S4)', () => {
  for (const [label, tail] of [
    ['an npm token', `npm_${'a1B2c3D4e5'.repeat(3)}`],
    ['_auth=', '_auth=dXNlcjpwYXNz'],
    ['_password=', '_password=hunter2'],
    ['an Authorization header', 'Authorization: token abc123def456'],
    ['NPM_CONFIG_OTP=', 'NPM_CONFIG_OTP=123456'],
    ['--otp', '--otp 654321'],
  ]) {
    it(`parses and holds no secret when ${label} is the last text in a field`, async () => {
      const repo = await makeReleaseRepo();
      const result = repo.run(['gates', '--json'], { FAKE_FAIL_RUN: 'lint', FAKE_FAIL_MESSAGE: `error: login failed ${tail}` });
      const body = parse(result.stdout);
      assert.equal(body.exit, 1);
      assert.match(body.failingLine, /\[redacted\]/);
      assert.doesNotMatch(result.stdout, /dXNlcjpwYXNz|hunter2|abc123def456|123456|654321|a1B2c3D4e5/);
    });
  }
});

describe('workflow switches (F4)', () => {
  const broken = async (options) => {
    const repo = await makeReleaseRepo();
    commitFile(repo, '.github/workflows/publish.yml', workflowText(filtersFor(repo.config.version), options));
    return repo.run(['preflight']);
  };

  it('accepts the plain workflow', async () => {
    assert.equal((await broken({})).status, 0);
  });

  it('fails when a required gate step has if: false, an if with an expression, or continue-on-error: true', async () => {
    for (const [options, pattern] of [
      [{ stepIf: { lint: 'false' } }, /step "npm run lint" has an if condition/],
      [{ stepIf: { lint: '${{ false }}' } }, /step "npm run lint" has an if condition/],
      [{ stepIf: { lint: "github.event_name == 'push'" } }, /has an if condition/],
      [{ stepContinue: { lint: 'true' } }, /continue-on-error: true/],
      [{ stepContinue: { lint: '${{ true }}' } }, /continue-on-error/],
    ]) {
      const result = await broken(options);
      assert.equal(result.status, 1, JSON.stringify(options));
      assert.match(result.stdout, pattern);
    }
  });

  it('allows the literal always-true forms of if and the literal false of continue-on-error', async () => {
    assert.equal((await broken({ stepIf: { lint: 'true' } })).status, 0);
    assert.equal((await broken({ stepIf: { lint: '${{ true }}' } })).status, 0);
    assert.equal((await broken({ stepContinue: { lint: 'false' } })).status, 0);
  });

  it('fails when the verify job has an if, or continue-on-error: true', async () => {
    const skipped = await broken({ verifyIf: '${{ false }}' });
    assert.equal(skipped.status, 1);
    assert.match(skipped.stdout, /verify job has an if condition/);
    const lenient = await broken({ verifyContinue: 'true' });
    assert.equal(lenient.status, 1);
    assert.match(lenient.stdout, /verify job has continue-on-error: true/);
  });

  it('fails when the publish job does not need verify: removed, an empty list, or another job', async () => {
    for (const publishNeeds of [null, '[]', 'other', '[other]']) {
      const result = await broken({ publishNeeds });
      assert.equal(result.status, 1, String(publishNeeds));
      assert.match(result.stdout, /publish job does not need the verify job/);
    }
    assert.equal((await broken({ publishNeeds: '[verify]' })).status, 0);
  });
});

describe('the record never stands in for the outputs (F2)', () => {
  it('runs the gates again, and fails, when the design kit vanished after a recorded run', async () => {
    const repo = await makeReleaseRepo();
    assert.equal(repo.run(['gates']).status, 0);
    rmSync(join(repo.work, repo.config.designKit.dir, repo.kitName));
    const before = repo.fake.lines('npm').length;
    const result = repo.run(['gates']);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /already done/);
    assert.ok(repo.fake.lines('npm').length > before, 'the gates ran again');
    assert.match(result.stdout, /outputs are wrong/);
  });

  it('fails dry-run, and not already done, when the built docs went stale after a recorded run', async () => {
    const repo = await makeReleaseRepo();
    assert.equal(repo.run(['dry-run']).status, 0);
    writeFileSync(join(repo.work, repo.config.docsEdition.builtChangelog), 'an older changelog\n');
    const result = repo.run(['dry-run']);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /already done/);
    assert.match(result.stdout, /stale/);
  });

  it('blocks the tag step when the design kit is missing, whatever the record says', async () => {
    const repo = await makeReleaseRepo();
    for (const step of ['preflight', 'gates', 'dry-run']) assert.equal(repo.run([step]).status, 0);
    rmSync(join(repo.work, repo.config.designKit.dir, repo.kitName));
    const result = repo.runTTY(['tag']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /NOT READY: design kit: /);
  });
});

describe('design kit and built docs checks (F5, S8)', () => {
  const dir = (repo) => join(repo.work, repo.config.designKit.dir);

  it('fails a zip of garbage bytes behind a valid signature and valid metadata', async () => {
    const repo = await makeReleaseRepo();
    const garbage = Buffer.concat([Buffer.from('PK\u0003\u0004', 'latin1'), Buffer.from('this is not a zip at all, only bytes')]);
    writeFileSync(join(dir(repo), repo.kitName), garbage);
    const meta = parse(readFileSync(join(dir(repo), 'design-package.json'), 'utf8'));
    writeFileSync(join(dir(repo), 'design-package.json'), JSON.stringify({ ...meta, bytes: garbage.length, sha256: createHash('sha256').update(garbage).digest('hex') }));
    const result = repo.run(['dry-run']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /no end-of-directory record/);
  });

  it('fails a zip whose entries differ from the expected list', async () => {
    const repo = await makeReleaseRepo();
    const { createZip } = await import('../scripts/build-design-package.mjs');
    const zip = createZip([{ name: 'README.md', data: 'x' }]);
    writeFileSync(join(dir(repo), repo.kitName), zip);
    const meta = parse(readFileSync(join(dir(repo), 'design-package.json'), 'utf8'));
    writeFileSync(join(dir(repo), 'design-package.json'), JSON.stringify({ ...meta, bytes: zip.length, sha256: createHash('sha256').update(zip).digest('hex') }));
    assert.match(repo.run(['dry-run']).stdout, /holds README.md, expected /);
  });

  it('fails a kit whose manifest names another version or another scene', async () => {
    const wrongVersion = await makeReleaseRepo();
    commitFile(wrongVersion, wrongVersion.config.designKit.scene, JSON.stringify({ source: 'changed', nodes: [] }));
    assert.match(wrongVersion.run(['dry-run']).stdout, /another scene/);
  });

  it('fails when the design kit folder is a symbolic link', async () => {
    const repo = await makeReleaseRepo();
    const real = join(repo.work, 'docs-site/out/real-downloads');
    renameSync(dir(repo), real);
    symlinkSync(real, dir(repo));
    const result = repo.run(['dry-run']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /symbolic link/);
  });

  it('fails a stale build of the same version: the built changelog differs from CHANGELOG.md', async () => {
    const repo = await makeReleaseRepo();
    writeFileSync(join(repo.work, repo.config.docsEdition.builtChangelog), 'an older text\n');
    const result = repo.run(['dry-run']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /built docs are stale/);
  });
});

describe('registry and remote reads fail loudly (F1, F3)', () => {
  it('blocks the tag step with exit 1 when the remote tags cannot be read', async () => {
    const repo = await makeReleaseRepo();
    for (const step of ['preflight', 'gates', 'dry-run']) assert.equal(repo.run([step]).status, 0);
    git(repo.work, 'remote', 'set-url', 'origin', join(repo.work, '..', 'does-not-exist.git'));
    const result = repo.runTTY(['tag']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /NOT READY: could not read the remote tags/);
    assert.equal(git(repo.origin, 'tag', '--list'), '');
  });

  it('fails verify when the lock file does not pin react', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    writeFileSync(join(repo.work, 'package-lock.json'), '{}\n');
    const result = repo.run(['verify']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /does not pin react/);
  });

  it('installs the react versions the lock file pins', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    assert.equal(repo.run(['verify']).status, 0);
    const install = repo.fake.calls().find((call) => call.args[0] === 'install');
    assert.ok(install.args.includes('react@19.2.5') && install.args.includes('react-dom@19.2.5'));
  });
});

describe('time limits and printed commands (F8)', () => {
  it('prints the small git commands before it runs them', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['preflight']);
    assert.match(result.stdout, /\$ git --version/);
    assert.match(result.stdout, /\$ git rev-parse --absolute-git-dir/);
  });

  it('stops a child that runs past its limit and reports the first failing line', async () => {
    const repo = await makeReleaseRepo();
    repo.fake.env({ FAKE_HANG_RUN: 'lint' });
    const lines = [];
    const started = Date.now();
    const { exit } = await runRelease(['gates', '--json'], {
      root: repo.work,
      env: repo.env({ FAKE_HANG_RUN: 'lint' }),
      isTTY: false,
      out: (line) => lines.push(line),
      limits: { gates: 1500 },
    });
    assert.equal(exit, 1);
    assert.ok(Date.now() - started < 7000, 'the hung command was stopped');
    assert.match(parse(lines.join('')).failingLine, /timed out after 1\.5 seconds/);
  });
});

describe('the force flag (C3)', () => {
  it('belongs only to the steps where it does something', async () => {
    const repo = await makeReleaseRepo();
    for (const step of ['status', 'publish', 'tag', 'retire', 'claims']) assert.equal(repo.run([step, '--force']).status, 2, step);
    assert.notEqual(repo.run(['preflight', '--force']).status, 2);
  });
});

describe('help text (S2, S7)', () => {
  it('says that human-only steps run read-only checks and no write, and that child processes can still read by absolute path', async () => {
    const text = (await makeReleaseRepo()).run(['--help']).stdout;
    assert.match(text, /read-only checks first/);
    assert.match(text, /run no write command/);
    assert.match(text, /can still read any file by absolute path/);
  });
});

describe('round of the final-head review (C, D)', () => {
  it('names a stale file in the design kit folder and tells the person to delete it, and deletes nothing', async () => {
    const repo = await makeReleaseRepo();
    const stale = join(repo.work, repo.config.designKit.dir, 'projection-ui-design-0.2.0-next.2.zip');
    writeFileSync(stale, 'PK');
    const result = repo.run(['dry-run']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /holds projection-ui-design-0\.2\.0-next\.2\.zip, which this release does not use \(a stale output of an earlier build\)/);
    assert.match(result.stdout, /Delete that file by hand, then run: npm run release -- gates --force/);
    assert.ok(existsSync(stale), 'the script deleted nothing');
  });

  it('refuses a gate step that sets working-directory or shell, and a default run setting, unless the config justifies it', async () => {
    const withKey = async (key, config) => {
      const repo = await makeReleaseRepo();
      const text = workflowText(filtersFor(repo.config.version)).replace('      - run: npm run lint', `      - run: npm run lint\n        ${key}: x`);
      commitFile(repo, '.github/workflows/publish.yml', text);
      if (config) commitFile(repo, 'release.config.json', JSON.stringify(config(repo.config)));
      return repo.run(['preflight']);
    };
    for (const key of ['working-directory', 'shell']) {
      const result = await withKey(key);
      assert.equal(result.status, 1, key);
      assert.match(result.stdout, new RegExp(`sets ${key}`));
      const justified = await withKey(key, (config) => ({ ...config, workflow: { ...config.workflow, justified: { 'npm run lint': [key] } } }));
      assert.equal(justified.status, 0, justified.stdout);
    }
    const defaults = await makeReleaseRepo();
    commitFile(defaults, '.github/workflows/publish.yml', workflowText(filtersFor(defaults.config.version)).replace('jobs:', 'defaults:\n  run:\n    shell: bash\njobs:'));
    assert.match(defaults.run(['preflight']).stdout, /default run settings/);
  });

  it('prints node by name and starts the running node binary', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['preflight', '--json']);
    for (const step of parse(result.stdout).steps) assert.doesNotMatch(step.command, /^\/|node_modules|\/bin\/node/);
    assert.equal(result.status, 0);
  });

  it('redacts a token in the note of the retire config, in text and in the JSON commands and note', async () => {
    const note = 'Decision for the owner _auth=dXNlcjpwYXNz and more text.';
    const repo = await makeReleaseRepo({ configEdit: (config) => { config.retire.note = note; } });
    const text = repo.run(['retire']);
    assert.doesNotMatch(text.stdout, /dXNlcjpwYXNz/);
    const json = repo.run(['retire', '--json']);
    assert.doesNotMatch(json.stdout, /dXNlcjpwYXNz/);
    assert.match(parse(json.stdout).note, /\[redacted\]/);
  });

  it('runs verify with a cache under the throwaway HOME and empty user and global npm config files', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    assert.equal(repo.run(['verify']).status, 0);
    const install = repo.fake.calls().find((call) => call.args[0] === 'install');
    assert.match(install.userconfig, /npmrc-user$/);
    assert.match(install.globalconfig, /npmrc-global$/);
    assert.notEqual(install.userconfig, install.globalconfig, 'npm 11 refuses one file loaded as both');
    assert.ok(install.cache.startsWith(install.home) || install.cache.startsWith(join(install.home, '..')), 'the cache is beside the throwaway HOME');
    assert.ok(install.cache.includes('release-verify-'));
    assert.notEqual(install.home, repo.env().HOME);
  });

  it('gives git a batch-mode ssh command and no terminal prompt, and keeps an ssh command the person already chose', async () => {
    const { gitEnv } = await import('../tools/lib/env.mjs');
    const repo = tempDir('projection-ssh-');
    git(repo, 'init', '-q');
    const home = tempDir('projection-ssh-home-');
    const plain = gitEnv({ PATH: process.env.PATH, HOME: home }, {}, repo);
    assert.equal(plain.GIT_SSH_COMMAND, 'ssh -o BatchMode=yes');
    assert.equal(plain.GIT_TERMINAL_PROMPT, '0');
    assert.equal(gitEnv({ PATH: process.env.PATH, HOME: home, GIT_SSH_COMMAND: 'ssh -i /key' }, {}, repo).GIT_SSH_COMMAND, 'ssh -i /key');
    // core.sshCommand in the repository config, and in the global config of HOME, both count.
    git(repo, 'config', 'core.sshCommand', 'ssh -i /repo-key');
    assert.equal(gitEnv({ PATH: process.env.PATH, HOME: home }, {}, repo).GIT_SSH_COMMAND, undefined);
    git(repo, 'config', '--unset', 'core.sshCommand');
    writeFileSync(join(home, '.gitconfig'), '[core]\n\tsshCommand = ssh -i /home-key\n');
    assert.equal(gitEnv({ PATH: process.env.PATH, HOME: home }, {}, repo).GIT_SSH_COMMAND, undefined);
  });
});
