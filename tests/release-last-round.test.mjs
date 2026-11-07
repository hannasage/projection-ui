import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSupervised } from '../tools/lib/run.mjs';
import { redact } from '../tools/lib/text.mjs';
import { validateBody, FOOTER } from '../tools/lib/pr-body.mjs';
import { main as prOpen } from '../tools/pr-open.mjs';
import { cleanup, git, makeFakeBin, makeRepo, makeRepoWithRemote, repoRoot, runNode, scrubbed, tempDir } from './helpers/tools-support.mjs';

afterEach(cleanup);

const parse = (text) => JSON.parse(text);
const manifest = JSON.parse(readFileSync(join(repoRoot, 'tools/manifest.json'), 'utf8'));

describe('tree-clean and nested repositories (1)', () => {
  const run = (tree) => runNode(join(repoRoot, 'tools/tree-clean.mjs'), [tree, '--json'], { env: scrubbed() });

  it('refuses a tree with a gitlink entry, and runs no filter of the nested repository', () => {
    const { work } = makeRepoWithRemote();
    const nested = join(work, 'nested');
    mkdirSync(nested);
    git(nested, 'init', '-q');
    git(nested, 'config', 'user.email', 'a@example.com');
    git(nested, 'config', 'user.name', 'A');
    writeFileSync(join(nested, '.gitattributes'), '* filter=evil\n');
    writeFileSync(join(nested, 'file.txt'), 'x\n');
    git(nested, 'config', 'filter.evil.clean', `touch ${join(work, 'MARKER')}`);
    git(nested, 'config', 'filter.evil.smudge', 'cat');
    git(nested, 'add', '.');
    git(nested, 'commit', '-q', '-m', 'nested');
    git(work, 'add', 'nested');
    git(work, 'commit', '-q', '-m', 'add the nested repository');
    git(work, 'push', '-q');
    assert.match(git(work, 'ls-files', '-s'), /^160000 /m);
    // The setup itself ran the filter once. Remove its mark, then dirty the nested file, so a status that looked inside would run it again.
    rmSync(join(work, 'MARKER'), { force: true });
    writeFileSync(join(nested, 'file.txt'), 'changed\n');
    const result = run(work);
    assert.equal(result.status, 1);
    const body = parse(result.stdout);
    assert.equal(body.refused, true);
    assert.match(body.checks[0].detail, /submodules or a nested repository/);
    assert.equal(existsSync(join(work, 'MARKER')), false, 'the filter of the nested repository ran');
    assert.equal(existsSync(join(nested, 'MARKER')), false);
  });

  it('refuses a modules folder in the git folder, in the common folder of a linked worktree, and inside a linked worktree folder', () => {
    const plain = makeRepoWithRemote().work;
    mkdirSync(join(plain, '.git', 'modules'));
    assert.equal(run(plain).status, 1);

    const main = makeRepoWithRemote().work;
    const linked = join(tempDir('projection-linked-'), 'tree');
    git(main, 'worktree', 'add', '-q', '-b', 'side', linked);
    mkdirSync(join(main, '.git', 'modules'));
    const fromLinked = run(linked);
    assert.equal(fromLinked.status, 1, 'the common folder has modules');

    const second = makeRepoWithRemote().work;
    const linked2 = join(tempDir('projection-linked-'), 'tree');
    git(second, 'worktree', 'add', '-q', '-b', 'side2', linked2);
    const name = readFileSync(join(linked2, '.git'), 'utf8').trim().split('/').at(-1);
    mkdirSync(join(second, '.git', 'worktrees', name, 'modules'));
    assert.equal(run(second).status, 1, 'a linked worktree folder has modules');
  });

  it('refuses the keys that hide submodule changes', () => {
    for (const [key, value] of [['diff.ignoreSubmodules', 'all'], ['submodule.x.ignore', 'all']]) {
      const { work } = makeRepoWithRemote();
      git(work, 'config', key, value);
      const result = run(work);
      assert.equal(result.status, 1, key);
      assert.match(parse(result.stdout).checks[0].detail, new RegExp(key.replace(/\./g, '\\.'), 'i'));
    }
  });

  it('describes the narrowed list in its usage text', () => {
    const help = runNode(join(repoRoot, 'tools/tree-clean.mjs'), ['--help'], { env: scrubbed() }).stdout;
    assert.match(help, /a filter, a diff or merge driver, an external diff, an attributes file, a signing program, a credential helper/);
    assert.doesNotMatch(help, /pager|hook path|alias/);
    assert.match(help, /submodules or a nested repository/);
  });
});

describe('redaction of passwords, ports, and new prefixes (2)', () => {
  it('keeps a port readable, but redacts a numeric password', () => {
    assert.equal(redact('http://127.0.0.1:48123/@scope%2fpkg'), 'http://127.0.0.1:48123/@scope%2fpkg');
    assert.equal(redact('https://[::1]:3000/@x/y'), 'https://[::1]:3000/@x/y');
    assert.equal(redact('https://admin:123456@host/x'), 'https://admin:[redacted]@host/x');
    assert.equal(redact('postgres://u:8080@db:5432/app'), 'postgres://u:[redacted]@db:5432/app');
    assert.equal(redact('password=123456'), 'password=[redacted]');
    assert.equal(redact('//reg/:_authToken=12345678'), '//reg/:_authToken=[redacted]');
  });

  it('does not take the word pass for a secret name', () => {
    assert.equal(redact('pass: all gates green'), 'pass: all gates green');
    assert.equal(redact('the tests pass: yes'), 'the tests pass: yes');
  });

  it('redacts otp:, NPM_CONFIG_OTP=, npm_config__auth=, pwd=, and the new token prefixes', () => {
    for (const [text, secret] of [
      ['otp: 123456', '123456'],
      ['NPM_CONFIG_OTP=998877', '998877'],
      ['npm_config__auth=YWJjZGVm', 'YWJjZGVm'],
      ['pwd=hunter2', 'hunter2'],
      [`${'pyp'}${'i-'}${'A1b2'.repeat(8)}`, 'A1b2A1b2'],
      [`${'S'}${'G.'}${'a1B2c3D4'.repeat(3)}.${'e5F6g7H8'.repeat(3)}`, 'a1B2c3D4'],
      [`${'shp'}${'at_'}${'a1b2c3d4'.repeat(4)}`, 'a1b2c3d4'],
      [`${'dop'}${'_v1_'}${'a1b2c3d4'.repeat(8)}`, 'a1b2c3d4'],
    ]) assert.ok(!redact(text).includes(secret), text);
  });
});

describe('pr-open body, may-exist rule, and identity downgrade (3)', () => {
  const GOOD = `> [!NOTE]\nThis adds the release script.\n\n${FOOTER}\n`;
  const setup = (body = GOOD) => {
    const fake = makeFakeBin();
    const repo = makeRepo();
    const file = join(repo, 'body.md');
    writeFileSync(file, body);
    return { fake, repo, file, run: (args, env = {}) => runNode(join(repoRoot, 'tools/pr-open.mjs'), args, { cwd: repo, env: fake.env(env) }) };
  };

  it('refuses a token in the body before anything is sent', () => {
    const body = `> [!NOTE]\nThe key is npm_${'a1B2c3D4e5'.repeat(3)} here.\n\n${FOOTER}\n`;
    assert.ok(validateBody(body).some((problem) => /shaped like a token/.test(problem)));
    const { run, file, fake } = setup(body);
    const result = run(['--title', 'x', '--body-file', file, '--base', 'main']);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /a1B2c3D4e5/);
    assert.equal(fake.lines('gh').length, 0, 'gh was not called');
  });

  it('says a PR may exist after a timeout', () => {
    const { fake, repo, file } = setup();
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(String(line));
    const before = process.cwd();
    process.chdir(repo);
    let code;
    try {
      code = prOpen(['--title', 'x', '--body-file', file, '--base', 'main'], fake.env({ FAKE_GH_HANG: '1' }), { createLimitMs: 1500 });
    } finally {
      process.chdir(before);
      console.log = original;
    }
    assert.equal(code, 1);
    assert.match(lines.join('\n'), /gh did not finish in 1\.5 seconds\. a PR may exist: check before retrying/);
  });

  it('does not say a PR may exist when gh is not installed', () => {
    const { repo, file } = setup();
    const result = runNode(join(repoRoot, 'tools/pr-open.mjs'), ['--title', 'x', '--body-file', file, '--base', 'main'], { cwd: repo, env: { ...scrubbed(), PATH: '/usr/bin:/bin' } });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /a PR may exist/);
  });
});

describe('the process group is stopped for an absolute node path too (4)', () => {
  it('kills the grandchild when the command is the node executable by absolute path', () => {
    const pidFile = join(tempDir('projection-pid-'), 'pid');
    const program = "const { spawn } = require('node:child_process'); const child = spawn('sleep', ['60'], { stdio: 'inherit' }); require('node:fs').writeFileSync(process.argv[1], String(child.pid)); setTimeout(() => {}, 60000);";
    const result = runSupervised(process.execPath, ['-e', program, pidFile], { env: scrubbed(), timeoutMs: 1200 });
    assert.equal(result.status, 124);
    const pid = Number(readFileSync(pidFile, 'utf8'));
    assert.throws(() => process.kill(pid, 0), /ESRCH/);
  });
});

describe('manifest status shape and one gate list (5)', () => {
  it('lists the unknown status value and the unknown array in the output of release status', () => {
    const entry = manifest.tools.find((tool) => tool.name === 'release status');
    assert.match(entry.output, /status \("pass" \| "unknown"/);
    assert.match(entry.output, /unknown: \[/);
    assert.match(entry.output, /"unknown"/);
  });

  it('reads the gate list from release.config.json in both the release script and the gates tool', () => {
    const config = parse(readFileSync(join(repoRoot, 'release.config.json'), 'utf8'));
    const releaseSource = readFileSync(join(repoRoot, 'scripts/release.mjs'), 'utf8');
    const gatesSource = readFileSync(join(repoRoot, 'tools/gates.mjs'), 'utf8');
    assert.match(releaseSource, /config\.gates\.map/);
    assert.match(gatesSource, /release\.config\.json/);
    assert.doesNotMatch(gatesSource, /\["typecheck"/);
    assert.ok(config.gates.length >= 6);
  });
});
