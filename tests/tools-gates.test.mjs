import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { readGates } from '../tools/gates.mjs';
import { cleanup, makeFakeBin, makeRepo, repoRoot, runNode, tempDir } from './helpers/tools-support.mjs';

afterEach(cleanup);
const script = join(repoRoot, 'tools/gates.mjs');
const GATES = readGates();

function setup() {
  const fake = makeFakeBin();
  const repo = makeRepo();
  const run = (args, env = {}) => runNode(script, args, { cwd: repo, env: fake.env(env) });
  return { fake, repo, run };
}

describe('gates tool', () => {
  it('stops a gate that runs past its limit, fails it with exit 124, and keeps going without a crash', async () => {
    const { fake, repo } = setup();
    const { main } = await import('../tools/gates.mjs');
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(String(line));
    let code;
    try {
      code = main(['--cwd', repo, '--json'], fake.env({ FAKE_HANG_RUN: 'lint' }), { gateLimitMs: 1500 });
    } finally {
      console.log = original;
    }
    assert.equal(code, 1);
    const body = JSON.parse(lines.join(''));
    const lint = body.gates.find((gate) => gate.name === 'lint');
    assert.equal(lint.exit, 124);
    assert.match(lint.firstFailingLine, /timed out after 1\.5 seconds/);
    assert.ok(body.gates.length > 3, 'later gates still ran');
  });

  it('runs the same gate set as the release script: the list in release.config.json, each a package script and a CI step', async () => {
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    const config = JSON.parse(readFileSync(join(repoRoot, 'release.config.json'), 'utf8'));
    const ci = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    assert.deepEqual(GATES, config.gates);
    for (const gate of ['typecheck', 'lint', 'test', 'build', 'build:docs', 'test:docs', 'tokens:check', 'test:artifact']) assert.ok(GATES.includes(gate), gate);
    for (const gate of GATES) {
      assert.ok(pkg.scripts[gate], `${gate} is a package script`);
      assert.ok(ci.includes(`run: npm run ${gate}`) || ci.includes(`run: npm ${gate}`), `${gate} runs in ci.yml`);
    }
  });

  it('runs every gate in order, prints each command first, and prints one result line per gate', () => {
    const { fake, run } = setup();
    const result = run([]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(fake.lines('npm'), GATES.map((name) => `run ${name}`));
    const lines = result.stdout.trim().split('\n');
    assert.equal(lines.filter((line) => line.startsWith('PASS')).length, GATES.length);
    assert.equal(lines[0], `$ npm run ${GATES[0]}`);
    assert.equal(lines[1], `PASS npm run ${GATES[0]} (exit 0)`);
    assert.match(lines.at(-1), new RegExp(`all ${GATES.length} gates passed`));
  });

  it('with --ci runs npm ci first', () => {
    const { fake, run } = setup();
    assert.equal(run(['--ci']).status, 0);
    assert.equal(fake.lines('npm')[0], 'ci');
    assert.equal(fake.lines('npm').length, GATES.length + 1);
  });

  it('reports the real exit code and never prints a pass line over a nonzero code', () => {
    const { run } = setup();
    const result = run([], { FAKE_FAIL_RUN: 'lint', FAKE_FAIL_CODE: '3', FAKE_FAIL_MESSAGE: 'src/a.ts: error no-unused-vars\nsecond line' });
    assert.equal(result.status, 1);
    const lines = result.stdout.trim().split('\n');
    assert.equal(lines.some((line) => /^PASS .*lint/.test(line)), false);
    assert.match(lines.find((line) => line.startsWith('FAIL')), /^FAIL npm run lint \(exit 3\)/);
    assert.ok(result.stdout.includes('src/a.ts: error no-unused-vars'));
    assert.ok(!result.stdout.includes('second line'));
  });

  it('keeps running later gates after a failure, and shows each one', () => {
    const { fake, run } = setup();
    const result = run([], { FAKE_FAIL_RUN: 'lint' });
    assert.equal(fake.lines('npm').length, GATES.length);
    assert.equal(result.stdout.split('\n').filter((line) => /^(PASS|FAIL)/.test(line)).length, GATES.length);
  });

  it('with --bail stops at the first failure', () => {
    const { fake, run } = setup();
    assert.equal(run(['--bail'], { FAKE_FAIL_RUN: 'lint' }).status, 1);
    assert.deepEqual(fake.lines('npm'), GATES.slice(0, GATES.indexOf('lint') + 1).map((name) => `run ${name}`));
  });

  it('prints one JSON object with the exit code of each gate', () => {
    const { run } = setup();
    const body = JSON.parse(run(['--json'], { FAKE_FAIL_RUN: 'test', FAKE_FAIL_CODE: '7' }).stdout);
    assert.equal(body.ok, false);
    assert.equal(body.exit, 1);
    assert.equal(body.gates.find((gate) => gate.name === 'test').exit, 7);
    assert.equal(body.gates.find((gate) => gate.name === 'typecheck').ok, true);
  });

  it('gives the gate commands an allowlist environment and a throwaway HOME', () => {
    const { fake, run } = setup();
    assert.equal(run([], { NPM_TOKEN: 'x', GH_TOKEN: 'y', NODE_AUTH_TOKEN: 'z', NPM_CONFIG_OTP: '1', MY_SECRET: 's' }).status, 0);
    const allowed = /^(PATH|HOME|LANG|TERM|CI|npm_config_[a-z_]+|NO_UPDATE_NOTIFIER|PLAYWRIGHT_BROWSERS_PATH|TMPDIR|PWD|OLDPWD|SHLVL|_|__CF_USER_TEXT_ENCODING)$/;
    for (const call of fake.calls()) {
      assert.equal(call.tokenSeen, false);
      for (const name of call.envNames) assert.match(name, allowed, name);
    }
  });

  it('scrubs a token from the failing line', () => {
    const { run } = setup();
    const secret = `npm_${'z9Y8x7W6v5'.repeat(3)}`;
    const result = run([], { FAKE_FAIL_RUN: 'build', FAKE_FAIL_MESSAGE: `error with ${secret}` });
    assert.ok(!result.stdout.includes(secret));
  });

  it('exits 2 for an unknown flag, a stray word, and --help prints usage with exit 0', () => {
    const { run } = setup();
    assert.equal(run(['--bogus']).status, 2);
    assert.equal(run(['extra']).status, 2);
    assert.equal(run(['--help']).status, 0);
    assert.equal(JSON.parse(run(['--bogus', '--json']).stdout).exit, 2);
  });

  it('refuses a folder that does not exist, is not a repository, is a subfolder, or is another package', () => {
    const { run, repo } = setup();
    mkdirSync(join(repo, 'sub'));
    for (const folder of [join(repo, 'missing'), tempDir(), join(repo, 'sub'), makeRepo({ name: 'other' })]) assert.equal(run(['--cwd', folder]).status, 2, folder);
    assert.equal(run(['--cwd', '']).status, 2);
  });

  it('follows a link to the real folder', () => {
    const { run, repo } = setup();
    const link = join(tempDir(), 'link');
    symlinkSync(repo, link);
    assert.equal(run(['--cwd', link]).status, 0);
  });

  it('exits 1, not 2, when git is missing', () => {
    const { fake, repo } = setup();
    const result = runNode(script, ['--cwd', repo], { cwd: repo, env: { ...fake.env(), PATH: fake.bin } });
    assert.equal(result.status, 1);
  });
});
