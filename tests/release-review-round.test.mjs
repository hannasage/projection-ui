import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createZip } from '../scripts/build-design-package.mjs';
import { deepRedact, redact } from '../tools/lib/text.mjs';
import { privateContentProblems } from '../tools/lib/pr-body.mjs';
import { resolveWorkTree } from '../tools/lib/paths.mjs';
import { cleanup, filtersFor, git, makeReleaseRepo, makeRepo, makeRepoWithRemote, repoRoot, runNode, scrubbed, tempDir, withEnv, workflowText } from './helpers/tools-support.mjs';

afterEach(cleanup);

const parse = (text) => JSON.parse(text);

function commitFile(repo, path, text) {
  mkdirSync(join(repo.work, path, '..'), { recursive: true });
  writeFileSync(join(repo.work, path), text);
  git(repo.work, 'add', '-A');
  git(repo.work, 'commit', '-q', '--allow-empty', '-m', `change ${path}`);
  git(repo.work, 'push', '-q', 'origin', repo.config.releaseBranch);
}

async function preflightWith(options, edit = (text) => text) {
  const repo = await makeReleaseRepo();
  commitFile(repo, '.github/workflows/publish.yml', edit(workflowText(filtersFor(repo.config.version), options)));
  return repo.run(['preflight']);
}

describe('the workflow reader fails closed (1)', () => {
  it('fails on an if: false at an odd indent after a step with extra spaces after the dash', async () => {
    const result = await preflightWith({ oddIf: 'lint' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /line\(s\) with if, continue-on-error, needs, environment, env, or uses that this reader did not understand/);
  });

  it('fails on a switch key in a place the reader does not know, in the verify job and in the publish job', async () => {
    const verify = await preflightWith({}, (text) => text.replace('      - run: npm run lint', '      - run: npm run lint\n          with:\n            if: false'));
    assert.equal(verify.status, 1);
    assert.match(verify.stdout, /did not understand/);
    const publish = await preflightWith({}, (text) => text.replace('    steps:\n      - run: node scripts/verify-release.mjs --publish', '    steps:\n      - run: node scripts/verify-release.mjs --publish\n        with:\n          environment: other'));
    assert.equal(publish.status, 1);
  });

  it('fails when the publish job lost its environment, has an if, sets env in a step, or uses another action', async () => {
    const cases = [
      [{ publishEnvironment: null }, /must use the environment npm-publish \(it says nothing\)/],
      [{ publishEnvironment: 'other' }, /must use the environment npm-publish \(it says other\)/],
      [{ publishIf: 'false' }, /publish job has an if condition/],
      [{ publishStepEnv: true }, /sets env/],
      [{ publishExtraUses: 'someone/evil-action@v1' }, /uses "someone\/evil-action@v1", which is not in publishUses/],
    ];
    for (const [options, pattern] of cases) {
      const result = await preflightWith(options);
      assert.equal(result.status, 1, JSON.stringify(options));
      assert.match(result.stdout, pattern);
    }
  });

  it('accepts the committed actions in the publish job', async () => {
    const repo = await makeReleaseRepo();
    const uses = repo.config.workflow.publishUses[0];
    commitFile(repo, '.github/workflows/publish.yml', workflowText(filtersFor(repo.config.version), { publishExtraUses: uses }));
    assert.equal(repo.run(['preflight']).status, 0);
  });
});

describe('the gate lists agree both ways (2)', () => {
  it('fails when the verify job runs a command that is in neither gates nor ciOnlyGates', async () => {
    const result = await preflightWith({}, (text) => text.replace('      - run: npm ci', '      - run: npm ci\n      - run: npm run surprise'));
    assert.equal(result.status, 1);
    assert.match(result.stdout, /runs "npm run surprise", which is neither in gates nor in ciOnlyGates/);
  });

  it('fails when a ciOnlyGates entry is missing from the workflow', async () => {
    const result = await preflightWith({ skipCiOnly: true });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /does not run: npx playwright install --with-deps chromium/);
  });

  it('lists the three browser tests and the Playwright install in the config with a reason each', async () => {
    const repo = await makeReleaseRepo();
    const names = repo.config.ciOnlyGates.map((entry) => entry.name);
    assert.deepEqual(names, ['playwright-install', 'test:storybook', 'test:storybook-tools', 'test:docs-themes']);
    for (const entry of repo.config.ciOnlyGates) assert.ok(entry.reason.length > 10);
  });

  it('prints the warning from gates, dry-run, and status, in text and in the JSON warnings', async () => {
    const repo = await makeReleaseRepo();
    for (const step of ['gates', 'dry-run', 'status']) {
      const text = repo.run([step]);
      assert.match(text.stdout, /WARNING: CI also runs: .*test:storybook.*Run them before you push a tag, because a tag cannot be moved/, step);
      const json = parse(repo.run([step, '--json']).stdout);
      assert.ok(json.warnings.some((warning) => /CI also runs: .*test:docs-themes/.test(warning)), step);
    }
  });

  it('documents the CI-only checks in the README and in the audit', () => {
    assert.match(readFileSync(join(repoRoot, 'README.md'), 'utf8'), /test:docs-themes/);
    assert.match(readFileSync(join(repoRoot, 'docs/workflow-audit.md'), 'utf8'), /ciOnlyGates/);
  });
});

describe('the clean check is not fooled by git config (3)', () => {
  it('sees an untracked file even when the config says not to show untracked files', async () => {
    const repo = await makeReleaseRepo();
    git(repo.work, 'config', 'status.showUntrackedFiles', 'no');
    writeFileSync(join(repo.work, 'stray.txt'), 'x\n');
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /working tree is not clean: \?\? stray\.txt/);
    assert.equal(repo.run(['gates']).status, 1, 'the gates refuse the dirty tree');
  });

  it('counts a changed file marked assume-unchanged or skip-worktree as a change', async () => {
    for (const flag of ['--assume-unchanged', '--skip-worktree']) {
      const repo = await makeReleaseRepo();
      git(repo.work, 'update-index', flag, 'README.md');
      writeFileSync(join(repo.work, 'README.md'), 'changed\n');
      const result = repo.run(['preflight']);
      assert.equal(result.status, 1, flag);
      assert.match(result.stdout, /README\.md is marked assume-unchanged or skip-worktree/);
    }
  });
});

describe('the manifest follows the factory shape (4)', () => {
  const manifest = parse(readFileSync(join(repoRoot, 'tools/manifest.json'), 'utf8'));

  it('has the safety_classes and exit_codes blocks', () => {
    assert.deepEqual(Object.keys(manifest.safety_classes).sort(), ['human-only', 'local-write', 'read-only', 'remote-write']);
    assert.deepEqual(Object.keys(manifest.exit_codes).sort(), ['0', '1', '2']);
  });

  it('marks every argument agent_settable, and no path argument is agent-settable', () => {
    for (const tool of manifest.tools) {
      for (const argument of tool.arguments) {
        assert.equal(typeof argument.agent_settable, 'boolean', `${tool.name} ${argument.name}`);
        if (argument.type === 'path' || argument.type === 'string') assert.equal(argument.agent_settable, false, `${tool.name} ${argument.name}`);
      }
    }
    const verify = manifest.tools.find((tool) => tool.name === 'release verify');
    assert.equal(verify.arguments.find((argument) => argument.name === '--allow-unsandboxed').agent_settable, false);
  });
});

describe('the design kit check reads tokens.json and plugin/code.js (5, 8)', () => {
  const rebuild = (repo, change) => {
    const dir = join(repo.work, repo.config.designKit.dir);
    const entries = repo.config.designKit.entries.map((name) => ({ name, data: change(name, repo.kitData(name)) }));
    const zip = createZip(entries);
    const metadata = parse(readFileSync(join(dir, repo.config.designKit.metadata), 'utf8'));
    writeFileSync(join(dir, repo.kitName), zip);
    writeFileSync(join(dir, repo.config.designKit.metadata), JSON.stringify({ ...metadata, bytes: zip.length, sha256: createHash('sha256').update(zip).digest('hex') }));
  };

  it('accepts a kit whose pieces agree', async () => {
    const repo = await makeReleaseRepo();
    rebuild(repo, (name, data) => data);
    assert.equal(repo.run(['dry-run']).status, 0);
  });

  it('fails a tokens.json that differs from the manifest tokens', async () => {
    const repo = await makeReleaseRepo();
    rebuild(repo, (name, data) => (name === 'tokens.json' ? '{"themes":{"dark":{"bg":"#fff"}}}' : data));
    const result = repo.run(['dry-run']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /tokens\.json inside .* differs from the tokens in design-manifest\.json/);
  });

  it('fails a plugin/code.js that embeds another scene, other tokens, or another version', async () => {
    for (const change of [
      (data) => data.replace('const scene = ', 'const scene = {"x":1}; const other = '),
      (data) => data.replace('"#000"', '"#123"'),
      (data) => data.replace(/importProjectionDesign\(figma, scene, tokens, "[^"]+"\)/, 'importProjectionDesign(figma, scene, tokens, "0.0.1")'),
    ]) {
      const repo = await makeReleaseRepo();
      rebuild(repo, (name, data) => (name === 'plugin/code.js' ? change(data) : data));
      const result = repo.run(['dry-run']);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /plugin\/code\.js inside .* does not embed/);
    }
  });

  it('fails cleanly, with no TypeError, when the metadata, the manifest, or a built docs file is the JSON null', async () => {
    const meta = await makeReleaseRepo();
    writeFileSync(join(meta.work, meta.config.designKit.dir, meta.config.designKit.metadata), 'null');
    const a = meta.run(['dry-run']);
    assert.equal(a.status, 1);
    assert.match(a.stdout, /is not a JSON object/);
    assert.doesNotMatch(a.stdout + a.stderr, /TypeError/);

    const manifest = await makeReleaseRepo();
    rebuild(manifest, (name, data) => (name === 'design-manifest.json' ? 'null' : data));
    const b = manifest.run(['dry-run']);
    assert.equal(b.status, 1);
    assert.doesNotMatch(b.stdout + b.stderr, /TypeError/);

    const docs = await makeReleaseRepo();
    writeFileSync(join(docs.work, docs.config.docsEdition.builtRelease), 'null');
    const c = docs.run(['dry-run']);
    assert.equal(c.status, 1);
    assert.doesNotMatch(c.stdout + c.stderr, /TypeError/);
  });
});

describe('tree-clean refuses more keys (6)', () => {
  const treeClean = join(repoRoot, 'tools/tree-clean.mjs');
  it('refuses remote uploadpack and receivepack, gpg.program, and core.alternateRefsCommand', () => {
    for (const [key, value] of [['remote.origin.uploadpack', 'x'], ['remote.origin.receivepack', 'x'], ['gpg.program', 'x'], ['core.alternateRefsCommand', 'x']]) {
      const { work } = makeRepoWithRemote();
      git(work, 'config', key, value);
      const result = runNode(treeClean, [work, '--json'], { env: scrubbed() });
      assert.equal(result.status, 1, key);
      assert.match(parse(result.stdout).checks[0].detail, new RegExp(`config key ${key.replace(/\./g, '\\.')}`, 'i'));
    }
  });
});

describe('the git calls of the path helper use the allowlisted environment (6)', () => {
  it('passes git no variable that is not on the allowlist', () => {
    const shimDir = tempDir('projection-envshim-');
    const log = join(shimDir, 'env.log');
    const real = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
    // The shim records the names of its environment, then runs the real git.
    writeFileSync(join(shimDir, 'git'), `#!/bin/sh\nenv | cut -d= -f1 >> "${log}"\nexec ${real} "$@"\n`);
    chmodSync(join(shimDir, 'git'), 0o755);
    const repo = makeRepo();
    withEnv('RELEASE_TEST_SECRET_VALUE', 'leak', () => withEnv('PATH', `${shimDir}:${process.env.PATH ?? ''}`, () => {
      resolveWorkTree(repo);
    }));
    const names = readFileSync(log, 'utf8').split('\n').filter((name) => name !== '');
    assert.ok(names.length > 0, 'the shim ran');
    assert.ok(!names.includes('RELEASE_TEST_SECRET_VALUE'), 'a variable outside the allowlist reached git');
  });
});

describe('redaction and decoding (7)', () => {
  it('redacts a number as the value of a secret key in JSON, and keeps the JSON valid', () => {
    const text = redact('{"password": 12345, "token":7, "count": 3}');
    assert.doesNotMatch(text, /12345/);
    assert.deepEqual(parse(text), { password: '[redacted]', token: '[redacted]', count: 3 });
    assert.deepEqual(deepRedact({ password: 12345, secret: 9, count: 3 }), { password: '[redacted]', secret: '[redacted]', count: 3 });
  });

  it('catches a path hidden by double encoding', () => {
    const home = (text) => privateContentProblems(text).some((problem) => /home path/.test(problem));
    const slash = ['', 'Users', 'name'];
    assert.equal(home(`&amp;#47;Users&amp;#47;name`), true);
    assert.equal(home(`%252FUsers%252Fname`), true);
    assert.equal(home(`&amp;sol;Users&amp;sol;name`), true);
    assert.equal(home(slash.join('/')), true);
  });
});

describe('small fixes (8)', () => {
  it('refuses a retire message that starts with a dash', async () => {
    const repo = await makeReleaseRepo();
    const config = JSON.parse(JSON.stringify(repo.config));
    config.retire.commands[0][3] = '-rf now';
    writeFileSync(join(repo.work, 'release.config.json'), JSON.stringify(config));
    const result = repo.run(['claims']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /may not start with -/);
  });

  it('shows a reason when the claims phase is todo', async () => {
    const repo = await makeReleaseRepo();
    commitFile(repo, 'docs/start.md', 'This is an unpublished candidate.\n');
    const body = parse(repo.run(['status', '--json']).stdout);
    const claims = body.phases.find((phase) => phase.name === 'claims');
    assert.equal(claims.state, 'todo');
    assert.match(claims.note, /docs\/start\.md:1:/);
  });
});
