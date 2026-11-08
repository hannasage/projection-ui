import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOOTER } from '../tools/lib/pr-body.mjs';
import { cleanup, makeFakeBin, makeRepo, repoRoot, runNode, tempDir } from './helpers/tools-support.mjs';

afterEach(cleanup);
const script = join(repoRoot, 'tools/pr-open.mjs');
const HOME_EXAMPLE = ['', 'Users', 'someone', 'x'].join('/');
const GOOD = `> [!NOTE]\nThis adds the release script.\n\nIt was checked with the gates.\n\n${FOOTER}\n`;

function setup(body = GOOD) {
  const fake = makeFakeBin();
  const repo = makeRepo();
  const file = join(repo, 'body.md');
  writeFileSync(file, body);
  const run = (args, env = {}) => runNode(script, args, { cwd: repo, env: fake.env(env) });
  const base = ['--title', 'feat: add the release script', '--body-file', file, '--base', 'release/1.0.0'];
  return { fake, repo, file, run, base };
}

describe('pr-open text output (5)', () => {
  it('refuses a title that looks like a token, and prints no token', () => {
    const { run, file } = setup();
    const token = `npm_${'a1B2c3D4e5'.repeat(3)}`;
    const result = run(['--title', `fix ${token}`, '--body-file', file, '--base', 'main']);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /a1B2c3D4e5/);
    assert.match(result.stdout, /shaped like a token/);
  });

  it('scrubs an --otp flag from the usage message', () => {
    const { run, file } = setup();
    const result = run(['--title', 'x', '--body-file', file, '--base', 'main', '--otp=123456']);
    assert.equal(result.status, 2);
    assert.doesNotMatch(result.stdout + result.stderr, /123456/);
  });

  it('prints the identity before it creates, stops gh after its limit, and says --help in plain words', () => {
    const { run, base } = setup();
    const help = run(['--help']).stdout;
    assert.match(help, /real HOME and its own config folder on purpose/);
    assert.match(help, /prints the gh identity before it creates anything/);
    assert.equal(run(base).status, 0);
  });
});

describe('pr-open body folder', () => {
  it('accepts a body file in the folder named by SAGE_BODY_DIR, and refuses a bad value', () => {
    const { run, repo } = setup();
    // The temporary folder is allowed already, so the scratch folder lives in an ignored folder of this checkout, outside the other tree and outside the temporary folder.
    const scratch = mkdtempSync(join(repoRoot, 'node_modules', 'body-'));
    try {
      const outside = join(scratch, 'body.md');
      writeFileSync(outside, GOOD);
      const args = ['--title', 'x', '--body-file', outside, '--base', 'main'];
      assert.equal(run(args).status, 2, 'refused without the variable');
      assert.equal(run(args, { SAGE_BODY_DIR: scratch }).status, 0);
      assert.equal(run(args, { SAGE_BODY_DIR: '/' }).status, 2);
      assert.equal(run(args, { SAGE_BODY_DIR: join(scratch, 'missing') }).status, 2);
      assert.equal(run(args, { SAGE_BODY_DIR: repo }).status, 2, 'a variable that names another folder does not widen the rule');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('still refuses a body file outside the repository, the temporary folder, and SAGE_BODY_DIR', () => {
    const { run } = setup();
    const scratch = tempDir('projection-scratch-');
    assert.equal(run(['--title', 'x', '--body-file', '/etc/hosts', '--base', 'main'], { SAGE_BODY_DIR: scratch }).status, 2);
  });
});

describe('pr-open', () => {
  it('asks gh who is logged in, prints that name before it creates anything, and uses the same environment', () => {
    const { fake, run, base } = setup();
    const result = run(base);
    assert.equal(result.status, 0);
    const lines = result.stdout.split('\n');
    assert.ok(lines.indexOf('$ gh api user --jq .login') < lines.findIndex((line) => line.startsWith('$ gh pr create')));
    assert.ok(lines.includes('Using the gh identity: test-user'));
    assert.equal(fake.calls().filter((entry) => entry.tool === 'gh').length, 2);
    assert.deepEqual(fake.lines('gh').map((line) => line.split(' ').slice(0, 2).join(' ')), ['api user', 'pr create']);
    assert.equal(JSON.parse(run([...base, '--json']).stdout).identity, 'test-user');
  });

  it('stops, and creates nothing, when gh cannot say who is logged in', () => {
    const { fake, run, base } = setup();
    const result = run(base, { FAKE_GH_NO_USER: '1' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /could not read the gh identity/);
    assert.ok(!fake.lines('gh').some((line) => line.startsWith('pr create')));
  });

  it('says a pull request may exist when gh prints a PR address and fails, and when it prints no URL', () => {
    const { run, base } = setup();
    assert.match(run(base, { FAKE_GH_FAIL_URL: '1' }).stdout, /a PR may exist: check before retrying/);
    assert.match(run(base, { FAKE_GH_NO_URL: '1' }).stdout, /a PR may exist: check before retrying/);
  });

  it('exits 2 and does not crash when the body file cannot be read', () => {
    const { run, base, file } = setup();
    chmodSync(file, 0o000);
    try {
      if (process.getuid?.() !== 0) assert.equal(run(base).status, 2);
    } finally {
      chmodSync(file, 0o644);
    }
  });

  it('opens a draft, passes the checked body on standard input, and prints the URL', () => {
    const { fake, run, base } = setup();
    const result = run(base);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout.trim().split('\n').at(-1), /^https:\/\/github\.com\/example\/repo\/pull\/1$/);
    const call = fake.calls().find((entry) => entry.tool === 'gh' && entry.args[0] === 'pr');
    assert.deepEqual(call.args, ['pr', 'create', '--draft', '--base', 'release/1.0.0', '--title', 'feat: add the release script', '--body-file', '-']);
    assert.equal(call.stdin, GOOD);
  });

  it('has no way to open a ready pull request', () => {
    const { fake, run, base } = setup();
    assert.equal(run([...base, '--ready']).status, 2);
    assert.equal(run([...base, '--no-draft']).status, 2);
    assert.equal(fake.lines('gh').length, 0);
    run(base);
    assert.ok(fake.lines('gh').find((line) => line.startsWith('pr create')).includes('--draft'));
  });

  it('with --dry-run checks the text, prints the command, and does not call gh', () => {
    const { fake, run, base } = setup();
    const result = run([...base, '--dry-run']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\$ gh pr create --draft/);
    assert.equal(fake.lines('gh').length, 0);
    assert.equal(JSON.parse(run([...base, '--dry-run', '--json']).stdout).status, 'dry-run');
  });

  it('refuses a bad body before it calls gh, and lists the problems', () => {
    const { fake, run, repo } = setup('Hello, it is here.\n');
    const file = join(repo, 'bad.md');
    writeFileSync(file, 'Hello\n');
    const result = run(['--title', 'x', '--body-file', file, '--base', 'main']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /INVALID the first line must be a GitHub alert/);
    assert.equal(fake.lines('gh').length, 0);
    const json = JSON.parse(run(['--json', '--title', 'x', '--body-file', file, '--base', 'main']).stdout);
    assert.equal(json.status, 'invalid-body');
    assert.ok(json.problems.length >= 2);
  });

  it('refuses a title with a home path, a session link, or an invisible character', () => {
    const { fake, run, file } = setup();
    for (const title of [`see ${HOME_EXAMPLE}`, 'https://claude.ai/code/abc', 'a\u200Bb']) {
      assert.equal(run(['--title', title, '--body-file', file, '--base', 'main']).status, 1, title);
    }
    assert.equal(fake.lines('gh').length, 0);
  });

  it('fails when gh exits 0 but prints no pull request URL', () => {
    const { run, base } = setup();
    const result = run(base, { FAKE_GH_NO_URL: '1' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /did not print a pull request URL/);
    assert.equal(JSON.parse(run([...base, '--json'], { FAKE_GH_NO_URL: '1' }).stdout).status, 'no-url');
  });

  it('fails with the first failing line when gh fails', () => {
    const { run, base } = setup();
    const result = run(base, { FAKE_GH_FAIL: '1' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /FAILED gh pr create: gh: could not create the pull request/);
  });

  it('does not hand GitHub tokens to gh through the environment', () => {
    const { fake, run, base } = setup();
    run(base, { GH_TOKEN: 'x', GITHUB_TOKEN: 'y' });
    for (const call of fake.calls().filter((entry) => entry.tool === 'gh')) assert.equal(call.tokenSeen, false);
  });

  it('exits 2 for missing or bad arguments', () => {
    const { run, base, file } = setup();
    assert.equal(run([]).status, 2);
    assert.equal(run(['--title', 'x', '--body-file', file]).status, 2);
    assert.equal(run(['--title', '', '--body-file', file, '--base', 'main']).status, 2);
    assert.equal(run(['--title', 'two\nlines', '--body-file', file, '--base', 'main']).status, 2);
    for (const bad of ['-x', 'a..b', 'a b', 'a;b', '$(x)', 'x.lock', 'x/']) assert.equal(run(['--title', 'x', '--body-file', file, '--base', bad]).status, 2, bad);
    assert.equal(run([...base, '--bogus']).status, 2);
    assert.equal(run(['--help']).status, 0);
  });

  it('accepts a body file in the repository or the temporary folder, and refuses one outside both', () => {
    const { run, base, repo } = setup();
    const tmp = join(tempDir(), 'body.md');
    writeFileSync(tmp, GOOD);
    assert.equal(run(['--title', 'x', '--body-file', tmp, '--base', 'main']).status, 0);
    assert.equal(run(['--title', 'x', '--body-file', '/etc/hosts', '--base', 'main']).status, 2);
    assert.equal(run(['--title', 'x', '--body-file', repo, '--base', 'main']).status, 2);
    const link = join(repo, 'link.md');
    symlinkSync('/etc/hosts', link);
    assert.equal(run(['--title', 'x', '--body-file', link, '--base', 'main']).status, 2);
    assert.equal(run(base).status, 0);
  });

  it('refuses a folder that is another package or not a repository', () => {
    const { run, base } = setup();
    assert.equal(run([...base, '--dir', makeRepo({ name: 'other' })]).status, 2);
    assert.equal(run([...base, '--dir', tempDir()]).status, 2);
  });

  it('refuses a body file over 64 KB', () => {
    const { run, repo } = setup();
    const big = join(repo, 'big.md');
    writeFileSync(big, 'x'.repeat(70 * 1024));
    assert.equal(run(['--title', 'x', '--body-file', big, '--base', 'main']).status, 2);
  });
});
