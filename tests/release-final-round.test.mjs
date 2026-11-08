import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRelease } from '../scripts/release.mjs';
import { cleanup, makeReleaseRepo, repoRoot, tempDir } from './helpers/tools-support.mjs';

afterEach(cleanup);

const parse = (text) => JSON.parse(text);
const phase = (body, name) => body.phases.find((entry) => entry.name === name);

/** Runs the release script in this process, so a test can pass the options that a command line cannot. */
async function inProcess(repo, argv, context = {}, extraEnv = {}) {
  const lines = [];
  const { exit, result } = await runRelease(argv, { root: repo.work, env: repo.env(extraEnv), isTTY: false, out: (line) => lines.push(line), ...context });
  return { exit, result, text: lines.join('\n') };
}

describe('status before the first publish and when a read fails (1, 2, 3)', () => {
  it('treats a package that is not on the registry (E404) as the normal state: publish, verify, and retire are todo, and the exit is 0', async () => {
    const repo = await makeReleaseRepo();
    rmSync(join(repo.fake.fixtures, 'dist-tags.json'));
    const result = repo.run(['status', '--json']);
    assert.equal(result.status, 0, result.stdout);
    const body = parse(result.stdout);
    for (const name of ['publish', 'verify', 'retire']) assert.equal(phase(body, name).state, 'todo', name);
    assert.match(phase(body, 'publish').note, /registry says not found/);
    assert.deepEqual(body.unknown, []);
  });

  it('marks the phases unknown and exits 1 when the registry read fails for another reason', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['status', '--json'], { FAKE_VIEW_FAIL: '1' });
    assert.equal(result.status, 1);
    const body = parse(result.stdout);
    for (const name of ['publish', 'verify', 'retire']) assert.equal(phase(body, name).state, 'unknown', name);
    assert.ok(body.unknown.includes('publish'));
    assert.match(body.message, /status could not read: /);
  });

  it('marks retire unknown, and exits 1, when the deprecation read fails', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    const result = repo.run(['status', '--json'], { FAKE_DEPRECATED_FAIL: '1' });
    assert.equal(result.status, 1);
    assert.equal(phase(parse(result.stdout), 'retire').state, 'unknown');
  });

  it('marks preflight, gates, dry-run, and verify unknown, and exits 1, when HEAD cannot be read', async () => {
    const repo = await makeReleaseRepo();
    writeFileSync(join(repo.work, '.git', 'HEAD'), 'ref: refs/heads/unborn\n');
    const result = repo.run(['status', '--json']);
    assert.equal(result.status, 1);
    const body = parse(result.stdout);
    for (const name of ['preflight', 'gates', 'dry-run', 'verify']) assert.equal(phase(body, name).state, 'unknown', name);
    assert.match(phase(body, 'preflight').note, /git rev-parse HEAD/);
  });
});

describe('redaction of usage output (5)', () => {
  it('scrubs a token-shaped subcommand and an --otp flag from text and from JSON', async () => {
    const repo = await makeReleaseRepo();
    const token = `npm_${'a1B2c3D4e5'.repeat(3)}`;
    for (const args of [[token], [token, '--json'], ['status', '--otp=123456'], ['status', '--otp=123456', '--json']]) {
      const result = repo.run(args);
      assert.equal(result.status, 2);
      assert.doesNotMatch(result.stdout + result.stderr, /a1B2c3D4e5|123456/, args.join(' '));
    }
    assert.doesNotThrow(() => parse(repo.run([token, '--json']).stdout));
  });
});

describe('verify under the Node permission model (7, 9)', () => {
  it('shows the permission flags in the printed command and keeps reads inside the project', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    const body = parse(repo.run(['verify', '--json']).stdout);
    const imports = body.steps.filter((step) => step.command.includes('--input-type=module'));
    assert.ok(imports.length >= 2);
    for (const step of imports) assert.match(step.command, /^node --(?:experimental-)?permission '--allow-fs-read=<project>' --input-type=module/);
  });

  it('stops a package that reads a file outside the project', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    const secret = join(tempDir('projection-outside-'), 'secret.txt');
    writeFileSync(secret, 'private');
    const result = repo.run(['verify'], { FAKE_READ_OUTSIDE: secret });
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /the import of .* failed/);
  });

  it('fails closed, with exit 1, when the permission model is missing', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    const { exit, text } = await inProcess(repo, ['verify'], { permissionAvailable: false });
    assert.equal(exit, 1);
    assert.match(text, /permission model is not available in this Node/);
    assert.match(text, /--allow-unsandboxed/);
    assert.equal(repo.fake.lines('npm').filter((line) => line.startsWith('install')).length, 0, 'nothing was installed');
  });

  it('with --allow-unsandboxed runs without the model and says so, in text and in JSON warnings', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    const secret = join(tempDir('projection-outside-'), 'secret.txt');
    writeFileSync(secret, 'private');
    const text = await inProcess(repo, ['verify', '--allow-unsandboxed'], { permissionAvailable: false }, { FAKE_READ_OUTSIDE: secret });
    assert.equal(text.exit, 0, text.text);
    assert.match(text.text, /WARNING: the Node permission model is not available/);
    const json = await inProcess(repo, ['verify', '--allow-unsandboxed', '--force', '--json'], { permissionAvailable: false });
    assert.equal(json.exit, 0);
    assert.match(parse(json.text).warnings[0], /permission model is not available/);
    for (const step of parse(json.text).steps.filter((entry) => entry.command.includes('--input-type=module'))) assert.doesNotMatch(step.command, /permission/);
  });

  it('refuses --allow-unsandboxed on any other subcommand', async () => {
    const repo = await makeReleaseRepo();
    assert.equal(repo.run(['status', '--allow-unsandboxed']).status, 2);
    assert.equal(repo.run(['gates', '--allow-unsandboxed']).status, 2);
  });

  it('fails clearly when the real path of the temporary folder has a comma or an asterisk', async () => {
    for (const bad of ['a,b', 'a*b']) {
      const repo = await makeReleaseRepo();
      repo.setRegistry(repo.publishedTags());
      const tmp = join(tempDir('projection-tmp-'), bad);
      mkdirSync(tmp);
      const result = repo.run(['verify'], { TMPDIR: tmp });
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stdout, /comma or an asterisk/);
    }
  });
});

describe('a timeout stops the whole process group (12)', () => {
  it('exits 124 and leaves no grandchild running', async () => {
    const repo = await makeReleaseRepo();
    const pidFile = join(tempDir('projection-pid-'), 'pid');
    const { runSupervised } = await import('../tools/lib/run.mjs');
    const program = "const { spawn } = require('node:child_process'); const child = spawn('sleep', ['60'], { stdio: 'inherit' }); require('node:fs').writeFileSync(process.argv[1], String(child.pid)); setTimeout(() => {}, 60000);";
    const started = Date.now();
    const result = runSupervised('node', ['-e', program, pidFile], { env: repo.env(), timeoutMs: 1200 });
    assert.equal(result.status, 124);
    assert.equal(result.timedOut, true);
    assert.ok(Date.now() - started < 8000);
    const pid = Number(readFileSync(pidFile, 'utf8'));
    assert.throws(() => process.kill(pid, 0), /ESRCH/);
  });

  it('exits 124 in the release script step and in the gates tool, and reports a command that cannot start as exit 127', async () => {
    const { runSupervised } = await import('../tools/lib/run.mjs');
    const missing = runSupervised('definitely-not-a-command', [], { env: { PATH: '/usr/bin' } });
    assert.equal(missing.status, 127);
    assert.equal(missing.startFailed, true);
    const repo = await makeReleaseRepo();
    const { exit, text } = await inProcess(repo, ['gates', '--json'], { limits: { gates: 1500 } }, { FAKE_HANG_RUN: 'lint' });
    assert.equal(exit, 1);
    const body = parse(text);
    assert.equal(body.steps.at(-1).exit, 124);
    assert.match(body.failingLine, /timed out after 1\.5 seconds/);
  });
});

describe('cleanup never crashes (4)', () => {
  it('leaves nothing of the throwaway HOME behind after a run', async () => {
    const repo = await makeReleaseRepo();
    const tmp = tempDir('projection-leftover-');
    assert.equal(repo.run(['claims'], { TMPDIR: tmp }).status, 0);
    assert.deepEqual(readdirSync(tmp), []);
  });

  it('turns a failed removal into a warning on standard error and not a crash', async () => {
    const source = readFileSync(join(repoRoot, 'scripts/release.mjs'), 'utf8');
    assert.match(source, /try \{\s*removeHome\(home\);\s*\} catch/);
    assert.match(readFileSync(join(repoRoot, 'tools/gates.mjs'), 'utf8'), /try \{\s*removeHome\(home\);\s*\} catch/);
  });
});
