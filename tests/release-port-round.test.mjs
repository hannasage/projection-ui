import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, it } from 'node:test';
import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeHome, removeHome, toolEnv } from '../tools/lib/env.mjs';
import { redact, deepRedact } from '../tools/lib/text.mjs';
import { privateContentProblems, validateBody, validateTitle, FOOTER } from '../tools/lib/pr-body.mjs';
import { withEnv, cleanup, git, makeFakeBin, makeRepo, makeRepoWithRemote, makeReleaseRepo, repoRoot, runNode, scrubbed, tempDir } from './helpers/tools-support.mjs';

afterEach(cleanup);

const parse = (text) => JSON.parse(text);
const phase = (body, name) => body.phases.find((entry) => entry.name === name);
const realNpm = spawnSync('npm', ['--version'], { encoding: 'utf8' }).status === 0;

describe('separate empty npm config files (1)', () => {
  it('gives the user config and the global config two different empty files', () => {
    const home = makeHome();
    try {
      const env = toolEnv({ PATH: process.env.PATH }, home);
      assert.notEqual(env.npm_config_userconfig, env.npm_config_globalconfig);
      for (const file of [env.npm_config_userconfig, env.npm_config_globalconfig]) assert.equal(existsSync(file), true);
      assert.deepEqual(readdirSync(home).sort(), ['npmrc-global', 'npmrc-user', 'package.json']);
    } finally {
      removeHome(home);
    }
  });

  it('runs the real npm under that environment with no network and no double-loading error', { skip: !realNpm && 'npm is not installed' }, () => {
    const home = makeHome();
    try {
      const env = toolEnv({ PATH: process.env.PATH }, home);
      for (const [args, pattern] of [[['--version'], /^\d+\.\d+\.\d+/], [['config', 'get', 'userconfig'], /npmrc-user$/], [['config', 'get', 'globalconfig'], /npmrc-global$/]]) {
        const result = spawnSync('npm', args, { env, cwd: home, encoding: 'utf8' });
        assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
        assert.match(result.stdout.trim(), pattern);
        assert.doesNotMatch(result.stderr, /double-loading|refusing to load/i);
      }
    } finally {
      removeHome(home);
    }
  });

  it('ends a real `release status` against an unreachable registry as unknown, with exit 1 and valid JSON', async () => {
    const repo = await makeReleaseRepo();
    const result = spawnSync(process.execPath, [repo.script, 'status', '--json'], { cwd: repo.work, env: scrubbed({ RELEASE_REGISTRY: 'http://127.0.0.1:9/' }, ''), encoding: 'utf8', timeout: 120000 });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const body = parse(result.stdout);
    assert.equal(phase(body, 'publish').state, 'unknown');
    assert.match(body.warnings.join(' '), /not the public registry/);
  });

  it('removes the throwaway HOME when a step after creating it fails', () => {
    const before = readdirSync(tempRoot()).filter((name) => name.startsWith('release-home-')).length;
    assert.throws(() => makeHome({ onCreated: () => { throw new Error('boom'); } }), /boom/);
    assert.equal(readdirSync(tempRoot()).filter((name) => name.startsWith('release-home-')).length, before);
  });
});

function tempRoot() {
  return tempDir('projection-root-probe-').replace(/\/[^/]+$/, '');
}

describe('registry reads are scoped and anchored (3)', () => {
  it('runs npm view in the throwaway folder and not in the repository, and names the public registry', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    writeFileSync(join(repo.work, '.npmrc'), 'registry=http://127.0.0.1:9/\n');
    assert.equal(repo.run(['status']).status, 0);
    const views = repo.fake.calls().filter((call) => call.tool === 'npm' && call.args[0] === 'view');
    assert.ok(views.length > 0);
    for (const call of views) {
      assert.notEqual(call.cwd, repo.work);
      const at = call.args.indexOf('--registry');
      assert.equal(call.args[at + 1], 'https://registry.npmjs.org/');
    }
  });

  it('counts only the npm error code line as not found', async () => {
    const repo = await makeReleaseRepo();
    const result = repo.run(['status', '--json'], { FAKE_VIEW_E404_TEXT: '1' });
    assert.equal(result.status, 1);
    assert.equal(phase(parse(result.stdout), 'publish').state, 'unknown');
  });

  it('accepts a 404 as unpublished only for a public package with no verify record, the right name, and the public registry', async () => {
    const plain = await makeReleaseRepo();
    rmDistTags(plain);
    const ok = plain.run(['status', '--json']);
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(parse(ok.stdout).warnings.join(' '), /not found: normal before the first publish/);

    const restricted = await makeReleaseRepo({ configEdit: (config) => { config.access = 'restricted'; } });
    rmDistTags(restricted);
    const r = restricted.run(['status', '--json']);
    assert.equal(r.status, 1);
    assert.match(phase(parse(r.stdout), 'publish').note, /restricted/);

    const recorded = await makeReleaseRepo();
    rmDistTags(recorded);
    writeFileSync(join(recorded.work, '.git', 'release-state.json'), JSON.stringify({ version: recorded.config.version, verify: { commit: 'a'.repeat(40), lock: 'x' } }));
    const v = recorded.run(['status', '--json']);
    assert.equal(v.status, 1);
    assert.match(phase(parse(v.stdout), 'publish').note, /verify record/);

    const renamed = await makeReleaseRepo();
    rmDistTags(renamed);
    writeFileSync(join(renamed.work, 'package.json'), JSON.stringify({ name: '@other/pkg', version: '1.0.0' }));
    const n = renamed.run(['status', '--json']);
    assert.equal(n.status, 1);
    assert.match(phase(parse(n.stdout), 'publish').note, /name in package\.json/);
  });

  it('treats any registry override as untrusted: unknown, exit 1, a visible warning, and no npm view', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    const text = repo.run(['status'], { RELEASE_REGISTRY: 'https://mirror.example.com/' });
    assert.equal(text.status, 1);
    assert.match(text.stdout, /WARNING: the registry is https:\/\/mirror\.example\.com\/, not the public registry/);
    assert.equal(repo.fake.calls().filter((call) => call.args[0] === 'view').length, 0);
    const json = parse(repo.run(['status', '--json'], { RELEASE_REGISTRY: 'https://mirror.example.com/' }).stdout);
    assert.equal(phase(json, 'publish').state, 'unknown');
    assert.ok(json.warnings.length >= 1);
    const verify = repo.run(['verify'], { RELEASE_REGISTRY: 'https://mirror.example.com/' });
    assert.equal(verify.status, 1);
  });

  it('installs from the named registry and compares the installed integrity with the viewed one', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    assert.equal(repo.run(['verify']).status, 0);
    const install = repo.fake.calls().find((call) => call.args[0] === 'install');
    assert.equal(install.args[install.args.indexOf('--registry') + 1], 'https://registry.npmjs.org/');
    const other = await makeReleaseRepo();
    other.setRegistry(other.publishedTags());
    const result = other.run(['verify'], { FAKE_INSTALLED_INTEGRITY: 'sha512-SOMETHINGELSE' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /installed integrity sha512-SOMETHINGELSE differs from the registry integrity/);
  });
});

function rmDistTags(repo) {
  // With no file, the fake npm answers with the E404 error code line.
  rmSync(join(repo.fake.fixtures, 'dist-tags.json'), { force: true });
}

describe('tree-clean refuses a risky config and reads status safely (2)', () => {
  const treeClean = join(repoRoot, 'tools/tree-clean.mjs');
  const run = (tree, extra = []) => runNode(treeClean, [tree, '--json', ...extra], { env: scrubbed() });

  it('refuses a tree whose config has a risky key, names the key, and creates no marker file', () => {
    const extraConfig = join(tempDir('projection-extra-config-'), 'extra');
    writeFileSync(extraConfig, '');
    for (const [key, value] of [
      ['filter.evil.clean', 'touch MARKER'],
      ['core.fsmonitor', 'touch MARKER'],
      ['core.sshCommand', 'touch MARKER'],
      ['core.attributesFile', '/tmp/x'],
      ['diff.external', 'touch MARKER'],
      ['gpg.ssh.program', 'touch MARKER'],
      ['core.askPass', 'x'],
      ['core.gitProxy', 'x'],
      ['diff.evil.command', 'touch MARKER'],
      ['diff.evil.textconv', 'touch MARKER'],
      ['merge.evil.driver', 'touch MARKER'],
      ['include.path', extraConfig],
      ['includeIf.gitdir:/x.path', extraConfig],
      ['credential.helper', 'touch MARKER'],
      ['uploadpack.packObjectsHook', 'touch MARKER'],
      ['receivepack.x', 'y'],
    ]) {
      const { work } = makeRepoWithRemote();
      writeFileSync(join(work, '.gitattributes'), '* filter=evil\n');
      git(work, 'config', key, value);
      const result = run(work);
      assert.equal(result.status, 1, key);
      const body = parse(result.stdout);
      assert.equal(body.refused, true, key);
      assert.match(body.checks[0].detail, new RegExp(`config key ${key.split(':')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), key);
      assert.equal(existsSync(join(work, 'MARKER')), false, `${key} ran a program`);
    }
  });

  it('still passes a tree with core.hooksPath, an alias, a url rewrite, a pager, and an editor, because status never runs them', () => {
    const { work } = makeRepoWithRemote();
    git(work, 'config', 'core.hooksPath', '.githooks');
    git(work, 'config', 'alias.st', '!touch MARKER');
    git(work, 'config', 'url.http://evil/.insteadOf', 'http://good/');
    git(work, 'config', 'core.pager', 'touch MARKER');
    git(work, 'config', 'core.editor', 'touch MARKER');
    const result = run(work);
    assert.equal(result.status, 0, result.stdout);
    assert.equal(existsSync(join(work, 'MARKER')), false);
  });

  it('refuses a tree with .gitmodules or .git/modules, and names submodules', () => {
    const withFile = makeRepoWithRemote().work;
    writeFileSync(join(withFile, '.gitmodules'), '[submodule "x"]\n\tpath = x\n\turl = ./x\n');
    const a = run(withFile);
    assert.equal(a.status, 1);
    assert.match(parse(a.stdout).checks[0].detail, /submodules/);
    const withDir = makeRepoWithRemote().work;
    mkdirSync(join(withDir, '.git', 'modules'));
    const b = run(withDir);
    assert.equal(b.status, 1);
    assert.match(parse(b.stdout).checks[0].detail, /submodules/);
  });

  it('spells the plural of branch and entry correctly', async () => {
    const { plural: checkPluralForTest } = await import('../tools/tree-clean.mjs');
    assert.equal(checkPluralForTest(2, 'branch'), '2 branches');
    assert.equal(checkPluralForTest(2, 'stash entry'), '2 stash entries');
    assert.equal(checkPluralForTest(1, 'branch'), '1 branch');
    assert.equal(checkPluralForTest(3, 'commit'), '3 commits');
    assert.equal(checkPluralForTest(2, 'process'), '2 processes');
  });

  it('shows untracked files even when the config says not to', () => {
    const { work } = makeRepoWithRemote();
    git(work, 'config', 'status.showUntrackedFiles', 'no');
    writeFileSync(join(work, 'new.txt'), 'x');
    const body = parse(run(work).stdout);
    assert.equal(body.checks.find((check) => check.name === 'clean').ok, false);
    assert.match(body.checks.find((check) => check.name === 'clean').detail, /new\.txt/);
  });

  it('fails a file marked assume-unchanged or skip-worktree', () => {
    for (const flag of ['--assume-unchanged', '--skip-worktree']) {
      const { work } = makeRepoWithRemote();
      git(work, 'update-index', flag, 'package.json');
      writeFileSync(join(work, 'package.json'), JSON.stringify({ name: '@hannasage/projection-ui', version: 'changed' }));
      const detail = parse(run(work).stdout).checks.find((check) => check.name === 'clean').detail;
      assert.match(detail, /assume-unchanged or skip-worktree/, flag);
    }
  });

  it('still passes a plain clean tree', () => {
    const { work } = makeRepoWithRemote();
    assert.equal(run(work).status, 0);
  });
});

describe('redaction additions (4)', () => {
  const hidden = (text, secret) => assert.ok(!redact(text).includes(secret), `${text} -> ${redact(text)}`);

  it('redacts names that end in _KEY, _SECRET, _TOKEN, or _PASSWORD, x-api-key, cookies, private keys, and prefixed keys', () => {
    hidden('MY_SERVICE_KEY=abcd1234efgh', 'abcd1234efgh');
    hidden('DB_PASSWORD: s3cretvalue', 's3cretvalue');
    hidden('STRIPE_SECRET=zzzz9999yyyy', 'zzzz9999yyyy');
    hidden('x-api-key: k-123456789', 'k-123456789');
    hidden('Cookie: session=abc123; theme=dark', 'abc123');
    hidden('Set-Cookie: id=9988776655; Path=/', '9988776655');
    // Token-shaped strings are built from parts at run time, so no file holds one as a single literal.
    hidden([['-----BEG', 'IN RSA PRIV', 'ATE KEY-----'].join(''), 'MIIEabc', ['-----E', 'ND RSA PRIV', 'ATE KEY-----'].join('')].join('\n'), 'MIIEabc');
    hidden([['-----BEG', 'IN PRIV', 'ATE KEY-----'].join(''), 'MIIEdef'].join('\n'), 'MIIEdef');
    hidden(`token ${'s'}${'k-'}${'a1B2'.repeat(8)}`, 'a1B2a1B2');
    hidden(`${'sk'}${'_live_'}abcdefghij1234`, 'abcdefghij1234');
    hidden(`${'rk'}${'_live_'}abcdefghij1234`, 'abcdefghij1234');
    hidden('passwd=hunter2', 'hunter2');
    hidden('private_key=abc123def', 'abc123def');
    hidden('clone https://bob:s3cr/et@host.example.com/r.git now', 's3cr/et');
    hidden('api-key: k-998877', 'k-998877');
    hidden('AccountKey=abcDEF123+/==', 'abcDEF123');
    hidden('npm publish --token abc12345', 'abc12345');
    hidden(`${'whs'}${'ec_'}abcdefghijkl1234`, 'abcdefghijkl1234');
    hidden(`${'ya'}${'29.'}${'a1B2'.repeat(8)}`, 'a1B2a1B2');
    hidden(`${'AGE-SEC'}${'RET-KEY-'}1QYQSZQGPQYQSZQGPQYQSZQGPQ`, '1QYQSZQGPQYQSZQGPQ');
    hidden(`post https://${'hooks.sl'}${'ack.com'}/services/T0001/B0002/abcdefXYZ now`, 'abcdefXYZ');
    hidden('Authorization: Digest username="u", response="abcdef012345"', 'abcdef012345');  });

  it('keeps a URL with a port and a path readable, keeps plain numbers and booleans, and redacts an unterminated JSON-like value', () => {
    assert.equal(redact('http://host.example.com:8080/path/x'), 'http://host.example.com:8080/path/x');
    assert.equal(redact('http://127.0.0.1:48123/@scope%2fpkg'), 'http://127.0.0.1:48123/@scope%2fpkg', 'a port is not a password');
    assert.equal(redact('//user:pa ss@host.com'), '//user:pa ss@host.com', 'no whitespace in the user part');
    const json = JSON.stringify({ line: redact('fetch https://bob:s3cr/et@host.com/r.git') });
    assert.doesNotThrow(() => JSON.parse(json));
    assert.equal(redact('secret=true and token: false'), 'secret=true and token: false');
    assert.ok(!redact('{"api_key":"abc123secret').includes('abc123secret'));
  });

  it('redacts a field by its key name whatever its value looks like', () => {
    const out = deepRedact({ api_key: 'short', Authorization: 'x', cookie: 'y', 'x-api-key': 'z', MY_SERVICE_TOKEN: 'q', count: 5, note: 'fine' });
    assert.deepEqual(out, { api_key: '[redacted]', Authorization: '[redacted]', cookie: '[redacted]', 'x-api-key': '[redacted]', MY_SERVICE_TOKEN: '[redacted]', count: 5, note: 'fine' });
  });
});

describe('pr-open identity (5)', () => {
  const GOOD = `> [!NOTE]\nThis adds the release script.\n\n${FOOTER}\n`;
  const setup = () => {
    const fake = makeFakeBin();
    const repo = makeRepo();
    const file = join(repo, 'body.md');
    writeFileSync(file, GOOD);
    const base = ['--title', 'feat: add the gates tool', '--body-file', file, '--base', 'main'];
    return { fake, base, run: (args, env = {}) => runNode(join(repoRoot, 'tools/pr-open.mjs'), args, { cwd: repo, env: fake.env(env) }) };
  };

  it('with --expect-identity: accepts the same login in any case, and refuses another login', () => {
    const { run, base } = setup();
    assert.equal(run([...base, '--expect-identity', 'TEST-USER']).status, 0);
    const wrong = run([...base, '--expect-identity', 'someone-else']);
    assert.equal(wrong.status, 1);
    assert.match(wrong.stdout, /FAILED gh identity: gh is signed in as test-user, not as someone-else/);
  });

  it('turns a 403 identity failure into a warning only, never with --expect-identity', () => {
    const { run, base } = setup();
    const result = run([...base, '--json'], { FAKE_GH_FORBIDDEN: '1' });
    assert.equal(result.status, 0, result.stdout);
    assert.match(parse(result.stdout).warnings.join(' '), /could not read the gh identity/);
    assert.equal(run([...base, '--expect-identity', 'test-user'], { FAKE_GH_FORBIDDEN: '1' }).status, 1);
    const text = run(base, { FAKE_GH_FORBIDDEN: '1' });
    assert.match(text.stdout, /^WARNING could not read the gh identity/m);
  });

  it('stops for any other identity failure, and the text does not say gh pr create', () => {
    const { run, base, fake } = setup();
    for (const flag of ['FAKE_GH_SERVER_ERROR', 'FAKE_GH_NO_USER']) {
      const result = run(base, { [flag]: '1' });
      assert.equal(result.status, 1, flag);
      assert.match(result.stdout, /FAILED gh identity: /);
      assert.doesNotMatch(result.stdout, /FAILED gh pr create/);
    }
    assert.ok(!fake.lines('gh').some((line) => line.startsWith('pr create')));
  });

  it('accepts a login with an underscore and a bot login', () => {
    const { run, base } = setup();
    assert.equal(run(base, { FAKE_GH_LOGIN: 'my_bot' }).status, 0);
    assert.equal(run(base, { FAKE_GH_LOGIN: 'app[bot]' }).status, 0);
    assert.equal(run(base, { FAKE_GH_LOGIN: 'bad login' }).status, 1);
  });

  it('keeps the warnings in a failure JSON, and says a PR may exist for exit and no-url failures', () => {
    const { run, base } = setup();
    const failed = parse(run([...base, '--json'], { FAKE_GH_FORBIDDEN: '1', FAKE_GH_FAIL_URL: '1' }).stdout);
    assert.equal(failed.ok, false);
    assert.ok(failed.warnings.length === 1);
    assert.match(failed.failingLine, /a PR may exist: check before retrying/);
    const noUrl = parse(run([...base, '--json'], { FAKE_GH_NO_URL: '1' }).stdout);
    assert.match(noUrl.failingLine, /a PR may exist: check before retrying/);
  });

  it('shows the title as it is in the printed command', () => {
    const { run, base } = setup();
    assert.match(run(base).stdout, /\$ gh pr create --draft --base main --title 'feat: add the gates tool' --body-file -/);
  });
});

describe('pr-body paths and links (6)', () => {
  const home = (text) => privateContentProblems(text).some((problem) => /home path/.test(problem));
  const link = (text) => privateContentProblems(text).some((problem) => /session link/.test(problem));

  it('decodes percent codes run by run, so one bad run does not hide a good one', () => {
    assert.equal(home('%2FUsers%2Fname'), true);
    assert.equal(home('%E0%A4%A and then %2FUsers%2Fname'), true);
    assert.equal(home(`%zz plain ${['', 'Users', 'name'].join('/')}`), true);
    assert.equal(link('claude.ai%2Fcode%2Fabc'), true);
  });

  it('decodes HTML entities in a contraction and in a path', () => {
    const body = (text) => validateBody(`> [!NOTE]\n${text}\n\n${FOOTER}\n`);
    assert.ok(body('It&apos;s here.').some((problem) => /contraction/.test(problem)));
    assert.ok(body('It&#39;s here.').some((problem) => /contraction/.test(problem)));
    assert.equal(home('&sol;Users&sol;name'), true);
  });

  it('folds look-alike slashes and matches the lower case and the other home folders', () => {
    assert.equal(home('∕Users∕name'), true);
    assert.equal(home('/users/name'), true);
    assert.equal(home('/root/work'), true);
    assert.equal(home('see /var/root/x'), true);
    assert.equal(home('the /root cause'), true);
    assert.equal(home('rootless /rootless'), false);
  });

  it('matches every session link form', () => {
    for (const form of ['claude.ai/share/abc', 'claude.ai/s/abc', 'claude.ai/project/abc', 'claude.ai/projects/abc', 'claude.ai/code/abc', 'CLAUDE.AI/chat/abc']) assert.equal(link(form), true, form);
    assert.equal(link('claude.ai/new'), false);
  });

  it('applies the same text rules to a title', () => {
    assert.ok(validateTitle("don't panic").some((problem) => /contraction/.test(problem)));
    assert.ok(validateTitle('see /users/name').some((problem) => /home path/.test(problem)));
    assert.deepEqual(validateTitle('feat: add the gates tool'), []);
  });
});

describe('pr-open base names and identity failures (3)', () => {
  const GOOD = `> [!NOTE]\nThis adds the release script.\n\n${FOOTER}\n`;
  const setup = () => {
    const fake = makeFakeBin();
    const repo = makeRepo();
    const file = join(repo, 'body.md');
    writeFileSync(file, GOOD);
    return { file, run: (args, env = {}) => runNode(join(repoRoot, 'tools/pr-open.mjs'), args, { cwd: repo, env: fake.env(env) }) };
  };

  it('accepts only a safe branch name for --base', async () => {
    const { safeBranch } = await import('../tools/pr-open.mjs');
    for (const good of ['main', 'release/1.0.0', 'task/release-scripts', 'a-b_c.d/e']) assert.equal(safeBranch(good), true, good);
    for (const bad of ['', '-x', '--upload-pack=x', 'a..b', 'a//b', 'a/', 'a.', '.hidden', 'a/.hidden', 'x.lock', 'a/x.lock/b', 'a@{1}', 'a b', 'a;b', '$(x)', 'a\\b', 'a~1', 'a^', 'a:b', 'a?b', 'a*b', 'a[b']) assert.equal(safeBranch(bad), false, bad);
    const { run, file } = setup();
    assert.equal(run(['--title', 'x', '--body-file', file, '--base', 'a..b']).status, 2);
  });

  it('leaves the command out of the JSON when the identity step fails', () => {
    const { run, file } = setup();
    const args = ['--title', 'x', '--body-file', file, '--base', 'main', '--json'];
    const identity = parse(run(args, { FAKE_GH_SERVER_ERROR: '1' }).stdout);
    assert.equal(identity.status, 'gh-identity-failed');
    assert.equal('command' in identity, false);
    const create = parse(run(args, { FAKE_GH_FAIL: '1' }).stdout);
    assert.equal(typeof create.command, 'string');
  });

  it('downgrades only a failure that says "Resource not accessible by integration", not a plain HTTP 403', () => {
    const { run, file } = setup();
    const args = ['--title', 'x', '--body-file', file, '--base', 'main'];
    assert.equal(run(args, { FAKE_GH_FORBIDDEN: '1' }).status, 0);
    assert.equal(run(args, { FAKE_GH_HTTP403_ONLY: '1' }).status, 1);
    assert.equal(run(args, { FAKE_GH_SERVER_ERROR: '1' }).status, 1);
    assert.equal(run(args, { FAKE_GH_NO_USER: '1' }).status, 1);
  });

  it('says a PR may exist for no URL and for a failed exit that shows a PR address, not for a clean failure or a refused identity', () => {
    const { run, file } = setup();
    const args = ['--title', 'x', '--body-file', file, '--base', 'main'];
    assert.doesNotMatch(run(args, { FAKE_GH_FAIL: '1' }).stdout, /a PR may exist/);
    assert.match(run(args, { FAKE_GH_FAIL_URL: '1' }).stdout, /a PR may exist/);
    assert.match(run(args, { FAKE_GH_NO_URL: '1' }).stdout, /a PR may exist/);
    assert.doesNotMatch(run(args, { FAKE_GH_SERVER_ERROR: '1' }).stdout, /a PR may exist/);
  });

  it('redacts the printed command in text mode', () => {
    const { run, file } = setup();
    const out = run(['--title', 'fix: pass the flag', '--body-file', file, '--base', 'main', '--dry-run']).stdout;
    assert.match(out, /^\$ gh pr create --draft/m);
  });
});

describe('registry integrity shapes and the scratch folder (4, 6)', () => {
  it('reads a bare string, and reads an object when gitHead is also asked for', async () => {
    const bare = await makeReleaseRepo();
    bare.setRegistry(bare.publishedTags());
    assert.equal(bare.run(['verify']).status, 0);
    // The shape that npm prints for two fields: an object, with the key dist.integrity.
    const object = await makeReleaseRepo();
    object.setRegistry(object.publishedTags());
    const result = object.run(['verify'], { FAKE_VIEW_INTEGRITY_OBJECT: '1' });
    assert.equal(result.status, 0, result.stdout);
  });

  it('runs npm view with --prefix on a scratch folder that holds its own package.json', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    assert.equal(repo.run(['status']).status, 0);
    for (const call of repo.fake.calls().filter((entry) => entry.tool === 'npm' && entry.args[0] === 'view')) {
      const at = call.args.indexOf('--prefix');
      assert.ok(at > 0, call.args.join(' '));
      assert.equal(call.args[at + 1], call.cwd, 'the prefix is the scratch folder where npm runs');
      assert.notEqual(call.cwd, repo.work);
    }
  });

  it('does not read the .npmrc of a project that holds the temporary folder', { skip: !realNpm && 'npm is not installed' }, () => {
    const project = tempDir('projection-project-');
    writeFileSync(join(project, '.npmrc'), 'registry=http://127.0.0.1:9/\n');
    writeFileSync(join(project, 'package.json'), '{"name":"outer","version":"1.0.0"}');
    const inner = join(project, 'tmp');
    mkdirSync(inner);
    withEnv('TMPDIR', inner, () => {
      let home;
      try {
        home = makeHome();
        assert.ok(home.startsWith(inner));
        const env = toolEnv({ PATH: process.env.PATH }, home);
        const result = spawnSync('npm', ['config', 'get', 'registry', '--prefix', home], { env, cwd: home, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout.trim(), 'https://registry.npmjs.org/');
      } finally {
        if (home) removeHome(home);
      }
    });
  });
});

describe('scratch cleanup and git failures (5)', () => {
  it('rethrows the original error when the cleanup itself fails', { skip: process.getuid?.() === 0 && 'root can remove anything' }, () => {
    let locked;
    try {
      assert.throws(
        () => makeHome({ onCreated: (dir) => {
          locked = join(dir, 'locked');
          mkdirSync(locked);
          writeFileSync(join(locked, 'file'), 'x');
          chmodSync(locked, 0o000);
          throw new Error('original failure');
        } }),
        /original failure/,
      );
    } finally {
      if (locked) {
        chmodSync(locked, 0o700);
        rmSync(join(locked, '..'), { recursive: true, force: true });
      }
    }
  });

  it('maps a git failure on the second question to exit 1', async () => {
    const { resolveWorkTree } = await import('../tools/lib/paths.mjs');
    const shimDir = tempDir('projection-gitshim-');
    const real = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
    writeFileSync(join(shimDir, 'git'), `#!/bin/sh\ncase "$*" in *--show-toplevel*) echo "fatal: forced failure" >&2; exit 128;; esac\nexec ${real} "$@"\n`);
    chmodSync(join(shimDir, 'git'), 0o755);
    const repo = makeRepo();
    withEnv('PATH', `${shimDir}:${process.env.PATH ?? ''}`, () => {
      const result = resolveWorkTree(repo);
      assert.equal(result.ok, false);
      assert.equal(result.kind, 'env');
    });
  });
});
