import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deepRedact, failingLine, printable, redact, show } from '../tools/lib/text.mjs';
import { allowlistEnv, ghEnv, gitEnv, toolEnv } from '../tools/lib/env.mjs';
import { readZip, zipEntryData } from '../tools/lib/zip.mjs';
import { gateProblem, jobRunSteps, matchingFilters, parseJobs, pushTagFilters, tagMatches } from '../tools/lib/workflow.mjs';
import { countWords, validateBody, privateContentProblems, FOOTER } from '../tools/lib/pr-body.mjs';
import { bodyDirRoot, resolveFile, resolvePackageTree, resolveWorkTree, tempRoot } from '../tools/lib/paths.mjs';
import { cleanup, makeRepo, tempDir, withEnv, workflowText } from './helpers/tools-support.mjs';

afterEach(cleanup);

describe('redact and failingLine', () => {
  it('removes npm and GitHub tokens, one-time codes, auth settings, bearer tokens, and URL passwords', () => {
    const text = `npm_${'a'.repeat(30)} ghp_${'b'.repeat(30)} github_pat_${'c'.repeat(30)} --otp 123456 --otp=654321 _authToken=abc Bearer abcdefghijklmnop1234 https://user:pass@example.com/x`;
    const clean = redact(text);
    for (const secret of ['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc', '123456', '654321', 'abc ', 'abcdefghijklmnop1234', 'user:pass']) assert.ok(!clean.includes(secret), secret);
    assert.match(clean, /\[redacted\]/);
  });

  it('redacts before it shortens, so a long line cannot cut a token in half', () => {
    const line = `error ${'x'.repeat(280)} npm_${'q'.repeat(40)}`;
    const picked = failingLine(line, '');
    assert.doesNotMatch(picked, /npm_q/);
    assert.ok(picked.length <= 303);
    const cut = failingLine(`error ${'x'.repeat(285)}npm_${'q'.repeat(40)}`, '');
    assert.doesNotMatch(cut, /npm_/);
  });

  it('prefers a real error line over a line that reports zero errors', () => {
    assert.equal(failingLine('Found 0 errors.\nℹ fail 0\n✖ the test that broke (3ms)\nℹ fail 1', ''), '✖ the test that broke (3ms)');
    assert.equal(failingLine('', 'src/a.ts:3:4: error TS2322: bad'), 'src/a.ts:3:4: error TS2322: bad');
    assert.equal(failingLine('plain first line\nsecond', ''), 'plain first line');
    assert.equal(failingLine('', ''), 'no output');
  });

  it('shows a command the way a person types it', () => {
    assert.equal(show(['git', 'tag', '-m', "it's here"]), "git tag -m 'it'\\''s here'");
  });
});

describe('withEnv', () => {
  const NAME = 'RELEASE_TEST_WITHENV';

  it('deletes a variable that was not set, and restores one that was', () => {
    delete process.env[NAME];
    withEnv(NAME, 'inside', () => assert.equal(process.env[NAME], 'inside'));
    assert.equal(Object.hasOwn(process.env, NAME), false, 'an unset variable is deleted again, never stored as the text "undefined"');
    process.env[NAME] = 'before';
    withEnv(NAME, 'inside', () => {});
    assert.equal(process.env[NAME], 'before');
    delete process.env[NAME];
  });

  it('removes the variable inside the function when the value is undefined, and restores it after a throw', () => {
    process.env[NAME] = 'before';
    withEnv(NAME, undefined, () => assert.equal(Object.hasOwn(process.env, NAME), false));
    assert.throws(() => withEnv(NAME, 'inside', () => { throw new Error('boom'); }), /boom/);
    assert.equal(process.env[NAME], 'before');
    delete process.env[NAME];
  });

  it('restores after an async function', async () => {
    delete process.env[NAME];
    await withEnv(NAME, 'inside', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(process.env[NAME], 'inside');
    });
    assert.equal(Object.hasOwn(process.env, NAME), false);
  });
});

describe('environment helpers', () => {
  const dirty = { PATH: '/bin', HOME: '/real', LANG: 'C', TERM: 'x', CI: '1', NPM_TOKEN: 'a', NODE_AUTH_TOKEN: 'b', GH_TOKEN: 'c', NPM_CONFIG_OTP: '1', npm_config_otp: '2', MY_SECRET: 'd', SSH_AUTH_SOCK: '/sock', FAKE_A: '1' };

  it('keeps only PATH, LANG, TERM, CI, and the home the caller gives', () => {
    assert.deepEqual(allowlistEnv(dirty, '/tmp/h'), { PATH: '/bin', LANG: 'C', TERM: 'x', CI: '1', HOME: '/tmp/h' });
  });

  it('gives tools a throwaway HOME and no user npm config, and never a token or one-time code', () => {
    const env = toolEnv(dirty, '/tmp/h');
    assert.equal(env.HOME, '/tmp/h');
    assert.equal(env.npm_config_userconfig, '/tmp/h/npmrc-user');
    assert.equal(env.npm_config_globalconfig, '/tmp/h/npmrc-global');
    assert.notEqual(env.npm_config_userconfig, env.npm_config_globalconfig);
    for (const name of Object.keys(env)) assert.ok(!/TOKEN|OTP|SECRET|SSH|FAKE/i.test(name), name);
  });

  it('gives git the real HOME and the agent socket and no token, and gives gh its config but no token', () => {
    const git = gitEnv(dirty);
    assert.equal(git.HOME, '/real');
    assert.equal(git.SSH_AUTH_SOCK, '/sock');
    assert.equal(git.GIT_TERMINAL_PROMPT, '0');
    assert.equal(git.NPM_TOKEN, undefined);
    assert.equal(git.GIT_SSH_COMMAND, 'ssh -o BatchMode=yes');
    assert.equal(ghEnv(dirty).GIT_SSH_COMMAND, 'ssh -o BatchMode=yes');
    const gh = ghEnv(dirty);
    assert.equal(gh.HOME, '/real');
    assert.equal(gh.GH_TOKEN, undefined);
    assert.equal(gh.MY_SECRET, undefined);
  });
});

describe('printable text and JSON redaction', () => {
  it('removes color codes, cursor moves, window titles, and control characters', () => {
    assert.equal(printable('a\u001b[31mred\u001b[0m b'), 'ared b');
    assert.equal(printable('x\u001b]0;title\u0007y'), 'xy');
    assert.equal(printable('a\u0000b\rc'), 'a b c');
    assert.equal(show(['npm', 'deprecate', 'x\u001b[2Jy']), 'npm deprecate xy');
  });

  it('redacts each string before JSON, so a field that ends in a token stays valid', () => {
    const body = deepRedact({ message: `failed with npm_${'a'.repeat(30)}`, nested: [{ line: 'Authorization: token abc' }], count: 2 });
    const text = JSON.stringify(body);
    assert.deepEqual(JSON.parse(text), body);
    assert.ok(!text.includes('aaaaaaaa') && !text.includes('abc'));
    assert.equal(body.count, 2);
  });

  it('redacts URL credentials, sk-ant- keys, AKIA keys, and JSON auth fields', () => {
    for (const [text, secret] of [
      ['fetch //user:hunter2@registry.example.com/x', 'hunter2'],
      ['https://deploy:s3cretpw@example.com/path', 's3cretpw'],
      [`key ${'sk-'}${'ant-api03-'}${'Ab1'.repeat(12)}`, 'Ab1Ab1Ab1'],
      [`id ${'AKI'}${'AIOSFODNN7EXAMPLE'} here`, `${'AKI'}${'AIOSFODNN7EXAMPLE'}`],
      ['{"_authToken":"abcdef123456"}', 'abcdef123456'],
      ['{"_password": "hunter2"}', 'hunter2'],
      ['{"_auth":"dXNlcjpwdw=="}', 'dXNlcjpwdw'],
    ]) assert.ok(!redact(text).includes(secret), text);
    assert.deepEqual(JSON.parse(redact('{"_authToken":"abcdef123456"}')), { _authToken: '[redacted]' });
  });

  it('knows the extra shapes: _auth=, _password=, Authorization, NPM_CONFIG_OTP=', () => {
    for (const [text, secret] of [['_auth=dXNlcg==', 'dXNlcg'], ['_password=hunter2', 'hunter2'], ['Authorization: token xyz999', 'xyz999'], ['Authorization: Bearer xyz999', 'xyz999'], ['NPM_CONFIG_OTP=424242', '424242'], ['npm_config_otp=424242', '424242']]) {
      assert.ok(!redact(text).includes(secret), text);
    }
  });
});

describe('zip reader', () => {
  it('lists the entries of a real zip and reads one back', async () => {
    const { createZip } = await import('../scripts/build-design-package.mjs');
    const bytes = createZip([{ name: 'a/b.txt', data: 'hello' }, { name: 'c.json', data: '{"x":1}' }]);
    const zip = readZip(bytes);
    assert.equal(zip.ok, true);
    assert.deepEqual(zip.entries.map((entry) => entry.name).sort(), ['a/b.txt', 'c.json']);
    assert.equal(zipEntryData(bytes, zip.entries.find((entry) => entry.name === 'c.json')).toString(), '{"x":1}');
  });

  it('refuses short files, garbage, and a damaged directory', () => {
    assert.equal(readZip(Buffer.from('PK')).ok, false);
    assert.equal(readZip(Buffer.concat([Buffer.from('PK\u0003\u0004', 'latin1'), Buffer.alloc(100, 7)])).ok, false);
  });
});

describe('workflow reader', () => {
  it('reads an inline tag list, with quotes and a comment', () => {
    assert.deepEqual(pushTagFilters(workflowText(['v1.0.0', 'v1.0.0-beta.*'])), { ok: true, tags: ['v1.0.0', 'v1.0.0-beta.*'] });
  });

  it('reads a block tag list', () => {
    const text = 'on:\n  push:\n    tags:\n      - "v1.0.0"\n      - v1.0.0-beta.* # beta\njobs:\n  a:\n    steps: []\n';
    assert.deepEqual(pushTagFilters(text), { ok: true, tags: ['v1.0.0', 'v1.0.0-beta.*'] });
  });

  it('refuses shapes it does not understand instead of guessing', () => {
    assert.equal(pushTagFilters('name: x\n').ok, false);
    assert.equal(pushTagFilters('on:\n  push:\n    branches: [main]\n').ok, false);
    assert.equal(pushTagFilters('on:\n  push:\n    tags-ignore: [v1]\n').ok, false);
    assert.equal(pushTagFilters('on:\n  push:\n    tags: v1\n').ok, false);
    assert.equal(pushTagFilters('on:\n  push:\n    tags: []\n').ok, false);
    assert.equal(pushTagFilters('on:\n  pull_request:\n    tags: [v1]\n').ok, false);
  });

  it('matches tags the way GitHub filters do', () => {
    assert.equal(tagMatches('v1.0.0', 'v1.0.0'), true);
    assert.equal(tagMatches('v1.0.0', 'v1.0.0-beta.0'), false);
    assert.equal(tagMatches('v1.0.0-beta.*', 'v1.0.0-beta.0'), true);
    assert.equal(tagMatches('v1.0.0-beta.*', 'v1.0.0-beta.12'), true);
    assert.equal(tagMatches('v1.0.0-beta.*', 'v1.0.0-next.0'), false);
    assert.equal(tagMatches('v1.0.0-beta.*', 'v1x0.0-beta.0'), false);
    assert.equal(tagMatches('v*', 'v1/2'), false);
    assert.equal(tagMatches('v**', 'v1/2'), true);
    assert.deepEqual(matchingFilters(['v1.0.0', 'v1.0.0-beta.*'], 'v1.0.0-beta.0'), ['v1.0.0-beta.*']);
  });

  it('throws for a pattern with a special character it does not model', () => {
    for (const pattern of ['v1?', 'v1+', 'v[12]', '!v1']) assert.throws(() => tagMatches(pattern, 'v1'), /not support/);
  });

  it('lists the run steps of one job and returns null for a missing job', () => {
    const steps = jobRunSteps(workflowText(['v1']), 'verify');
    assert.ok(steps.includes('npm ci'));
    assert.ok(steps.includes('npm run lint'));
    assert.ok(!steps.includes('node scripts/verify-release.mjs --publish'));
    assert.equal(jobRunSteps(workflowText(['v1']), 'nope'), null);
  });
});

describe('the body folder variable', () => {
  it('accepts a real folder that is not the disk root or a home folder, and returns null when the variable is unset', () => {
    const folder = tempDir();
    assert.deepEqual(bodyDirRoot({}), { ok: true, root: null });
    assert.deepEqual(bodyDirRoot({ SAGE_BODY_DIR: folder }), { ok: true, root: folder });
  });

  it('refuses the disk root, a home folder, a missing folder, a file, and an empty value with a null byte', () => {
    const folder = tempDir();
    const file = join(folder, 'f.txt');
    writeFileSync(file, 'x');
    assert.equal(bodyDirRoot({ SAGE_BODY_DIR: '/' }).ok, false);
    assert.equal(bodyDirRoot({ SAGE_BODY_DIR: folder, HOME: folder }).ok, false);
    assert.equal(bodyDirRoot({ SAGE_BODY_DIR: join(folder, 'nope') }).ok, false);
    assert.equal(bodyDirRoot({ SAGE_BODY_DIR: file }).ok, false);
    assert.equal(bodyDirRoot({ SAGE_BODY_DIR: `${folder}\0` }).ok, false);
  });
});

describe('workflow jobs', () => {
  it('reads job and step switches, including a needs list in block form', () => {
    const text = 'jobs:\n  a:\n    if: false\n    steps:\n      - run: x\n        if: ${{ false }}\n        continue-on-error: true\n  b:\n    needs:\n      - a\n      - c\n    steps:\n      - uses: u\n';
    const jobs = parseJobs(text);
    assert.equal(jobs.a.if, 'false');
    assert.equal(jobs.a.steps[0].if, '${{ false }}');
    assert.equal(jobs.a.steps[0].continueOnError, 'true');
    assert.deepEqual(jobs.b.needs, ['a', 'c']);
    assert.equal(jobs.a.needs, null);
  });

  it('judges a workflow with gateProblem', () => {
    const base = workflowText(['v1']);
    const options = { verifyJob: 'verify', publishJob: 'publish', gates: [['npm ci'], ...['tokens:check', 'typecheck', 'lint', 'test', 'build', 'build:docs', 'test:docs', 'test:artifact'].map((name) => [`npm run ${name}`]), ['node scripts/verify-release.mjs']], ciOnly: [['npx playwright install --with-deps chromium'], ['npm run test:storybook'], ['npm run test:storybook-tools'], ['npm run test:docs-themes']], publishEnvironment: 'npm-publish', publishUses: [], publishCommand: 'node scripts/verify-release.mjs --publish' };
    assert.equal(gateProblem(base, options), null);
    assert.match(gateProblem(workflowText(['v1'], { stepIf: { lint: 'false' } }), options), /lint/);
    assert.match(gateProblem(workflowText(['v1'], { publishNeeds: null }), options), /does not need/);
    assert.match(gateProblem('name: x\n', options), /no jobs/);
  });
});

describe('pull request text rules', () => {
  const good = `> [!NOTE]\nWhat changed.\n\n${FOOTER}\n`;

  it('accepts a body with an alert first, a short text, and the footer last', () => {
    assert.deepEqual(validateBody(good), []);
    assert.deepEqual(validateBody(good.trimEnd()), []);
  });

  it('rejects a missing alert, a missing footer, text after the footer, and CRLF', () => {
    assert.ok(validateBody(`Hello\n\n${FOOTER}\n`).some((p) => /alert/.test(p)));
    assert.ok(validateBody('> [!NOTE]\nHello\n').some((p) => /must end with/.test(p)));
    assert.ok(validateBody(`${good}\n`).some((p) => /must end with/.test(p)));
    assert.ok(validateBody(good.replaceAll('\n', '\r\n')).some((p) => /carriage/.test(p)));
  });

  it('counts the limit of 300 words, and counts an invisible character as a gap between words', () => {
    const words = (n) => Array.from({ length: n }, () => 'word').join(' ');
    assert.deepEqual(validateBody(`> [!NOTE]\n${words(280)}\n${FOOTER}\n`), []);
    assert.ok(validateBody(`> [!NOTE]\n${words(310)}\n${FOOTER}\n`).some((p) => /words/.test(p)));
    const hidden = Array.from({ length: 320 }, () => 'word').join('\u200B');
    assert.ok(validateBody(`> [!NOTE]\n${hidden}\n${FOOTER}\n`).some((p) => /words/.test(p)));
    assert.equal(countWords('a\u200Bb c'), 3);
  });

  it('rejects contractions with a straight, a curly, or a modifier apostrophe, even with a hidden character inside', () => {
    for (const apostrophe of ["'", '\u2019', '\u2018', '\u02BC', '`']) {
      assert.ok(validateBody(`> [!NOTE]\nIt${apostrophe}s here.\n${FOOTER}\n`).some((p) => /contraction/.test(p)), apostrophe);
    }
    assert.ok(validateBody(`> [!NOTE]\ndon\u200B't do it\n${FOOTER}\n`).some((p) => /contraction/.test(p)));
    assert.deepEqual(validateBody(`> [!NOTE]\nThe 'quoted' word.\n${FOOTER}\n`), []);
  });

  it('rejects home paths, session links, and invisible characters in any public text', () => {
    assert.ok(privateContentProblems(`see ${['', 'Users', 'someone', 'x'].join('/')}`).length === 1);
    assert.ok(privateContentProblems(`see ${['', 'home', 'someone', 'x'].join('/')}`).length === 1);
    assert.ok(privateContentProblems('see C:\\Users\\someone\\x').length === 1);
    assert.ok(privateContentProblems('https://claude.ai/code/abc').length === 1);
    assert.ok(privateContentProblems('a\u200Bb').length === 1);
    for (const hidden of ['\u115F', '\u1160', '\uFFA0', '\u180B', '\u180C', '\u180D', '\u{E0FFF}', '\u{E0100}', '\u202E', '\u{E0041}', '\u034F', '\u180E', '\u3164', '\uFE0F', '\u{E0100}', '\u2062']) assert.ok(privateContentProblems(`a${hidden}b`).length === 1, hidden.codePointAt(0).toString(16));
    // A hidden character or a full-width slash must not hide a home path or a session link.
    const hiddenHome = `${'/Us\u200Bers'}/name`;
    assert.ok(privateContentProblems(hiddenHome).some((p) => /home path/.test(p)), 'zero-width inside Users');
    assert.ok(privateContentProblems('\uFF0FUsers\uFF0Fname').some((p) => /home path/.test(p)), 'full-width slashes');
    assert.ok(privateContentProblems('/Us\u115Fers/name').some((p) => /home path/.test(p)), 'Hangul filler inside Users');
    assert.ok(privateContentProblems('claude.ai/c\u180Bode/abc').some((p) => /session link/.test(p)), 'Mongolian selector inside code');
    assert.ok(privateContentProblems('a token npm_' + 'x'.repeat(30)).some((p) => /token/.test(p)));
    assert.ok(privateContentProblems('claude.ai/c\u200Bode/abc').some((p) => /session link/.test(p)), 'zero-width inside code');
    assert.ok(privateContentProblems('claude.ai\uFF0Fcode').some((p) => /session link/.test(p)), 'full-width slash in a link');
    assert.ok(validateBody(`> [!NOTE]\nA\u202Eb text.\n${FOOTER}\n`).some((p) => /invisible/.test(p)));
    assert.equal(countWords('a\u{E0041}b c'), 3);
    assert.deepEqual(privateContentProblems('plain'), []);
  });

  it('rejects an empty body and a body that is not text', () => {
    assert.ok(validateBody('').length > 0);
    assert.ok(validateBody(null).length > 0);
  });
});

describe('path arguments', () => {
  it('resolves a work tree and its top, and refuses empty, missing, file, null byte, and non-git values', () => {
    const repo = makeRepo();
    mkdirSync(join(repo, 'sub'));
    const tree = resolveWorkTree(join(repo, 'sub'));
    assert.equal(tree.ok, true);
    assert.equal(tree.top, repo);
    for (const bad of ['', '   ', join(repo, 'missing'), join(repo, 'package.json'), `${repo}\0x`, tempDir()]) assert.equal(resolveWorkTree(bad).ok, false, String(bad));
    assert.equal(resolveWorkTree(undefined).ok, false);
  });

  it('follows a link to the real path', () => {
    const repo = makeRepo();
    const link = join(tempDir(), 'link');
    symlinkSync(repo, link);
    assert.equal(resolveWorkTree(link).path, repo);
  });

  it('accepts only the top of a tree of the named package', () => {
    const repo = makeRepo();
    assert.equal(resolvePackageTree(repo).ok, true);
    mkdirSync(join(repo, 'sub'));
    assert.match(resolvePackageTree(join(repo, 'sub')).error, /not the top/);
    const other = makeRepo({ name: 'other-package' });
    assert.match(resolvePackageTree(other).error, /not @hannasage\/projection-ui/);
  });

  it('reports a missing git as an environment failure, not a wrong use', () => {
    const repo = makeRepo();
    withEnv('PATH', '/nonexistent', () => {
      const result = resolveWorkTree(repo);
      assert.equal(result.ok, false);
      assert.equal(result.kind, 'env');
    });
  });

  it('resolves a file only under the allowed roots and under the size limit', () => {
    const repo = makeRepo();
    const inside = join(repo, 'note.md');
    writeFileSync(inside, 'x');
    const outside = join(tempDir(), 'note.md');
    writeFileSync(outside, 'x');
    assert.equal(resolveFile(inside, 100, [repo]).ok, true);
    assert.match(resolveFile(outside, 100, [repo]).error, /outside/);
    assert.equal(resolveFile(outside, 100, [tempRoot()]).ok, true);
    writeFileSync(inside, 'x'.repeat(200));
    assert.match(resolveFile(inside, 100, [repo]).error, /larger/);
    assert.equal(resolveFile(repo, 100, [repo]).ok, false);
    const link = join(repo, 'link.md');
    symlinkSync(outside, link);
    assert.match(resolveFile(link, 100, [repo]).error, /outside/);
  });
});
