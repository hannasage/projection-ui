import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { chmodSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { configProblem } from '../scripts/release.mjs';
import { deepRedact, redact } from '../tools/lib/text.mjs';
import { cleanup, git, makeReleaseRepo, repoRoot } from './helpers/tools-support.mjs';

afterEach(cleanup);

const parse = (text) => JSON.parse(text);
const PIN_WORD = /changed since the script was last checked: review the change by hand/;

describe('secret lists are redacted without breaking the JSON (1)', () => {
  it('handles a bracket inside a text of the list, and a list inside a list', () => {
    for (const input of ['{"secret":["a]b","c"],"x":1}', '{"password":[[1,2],[3]]}', `{'token': ['p]q', ["r"]], 'x': 1}`]) {
      const out = redact(input);
      assert.doesNotMatch(out, /a\]b|"c"|\[3\]|\b3\b|p\]q|"r"/, input);
      assert.match(out, /\[redacted\]/);
      const json = out.replace(/'/g, '"');
      assert.doesNotThrow(() => JSON.parse(json), `${input} -> ${out}`);
    }
    assert.deepEqual(parse(redact('{"secret":["a]b","c"],"x":1}')), { secret: '[redacted]', x: 1 });
    assert.deepEqual(parse(redact('{"password":[[1,2],[3]],"y":[1]}')), { password: '[redacted]', y: [1] });
  });

  it('redacts to the end of the text when a list never closes, so nothing leaks', () => {
    const out = redact('{"password":[1,2,"abc');
    assert.doesNotMatch(out, /abc|1,2/);
  });

  it('redacts the whole value of a secret key in data, whatever its type', () => {
    const out = deepRedact({ secret: ['a]b', 'c'], password: { nested: [1, 2] }, token: 12, apiKey: { a: 1 }, ok: true, flag: null, count: 3, _auth: false });
    assert.deepEqual(out, { secret: '[redacted]', password: '[redacted]', token: '[redacted]', apiKey: '[redacted]', ok: true, flag: null, count: 3, _auth: false });
    assert.deepEqual(parse(JSON.stringify(deepRedact({ password: [[1, 2], [3]], x: 1 }))), { password: '[redacted]', x: 1 });
  });
});

describe('the tag step checks the pins first (3, 4)', () => {
  async function tagged() {
    const repo = await makeReleaseRepo();
    for (const step of ['preflight', 'gates', 'dry-run']) assert.equal(repo.run([step]).status, 0, step);
    const name = `v${repo.config.version}`;
    git(repo.work, 'tag', '-a', name, '-m', repo.config.version);
    git(repo.work, 'push', '-q', 'origin', name);
    return repo;
  }

  it('says already done only while every pin matches', async () => {
    const repo = await tagged();
    const plain = repo.run(['tag']);
    assert.equal(plain.status, 0, plain.stdout);
    assert.match(plain.stdout, /already done/);
    const file = join(repo.work, 'scripts/publish-design-release.mjs');
    writeFileSync(file, `${readFileSync(file, 'utf8')}\n// x\n`);
    const result = repo.run(['tag']);
    assert.equal(result.status, 2, result.stdout);
    assert.doesNotMatch(result.stdout, /already done/);
    assert.match(result.stdout, PIN_WORD);
    assert.doesNotMatch(result.stdout, /does not match HEAD on both sides/);
    assert.equal(repo.runTTY(['tag']).status, 1);
  });

  it('exits 2 without a terminal, and 1 with one, and names the real cause, when publish.yml is missing or unreadable', async () => {
    const repo = await makeReleaseRepo();
    for (const step of ['preflight', 'gates', 'dry-run']) assert.equal(repo.run([step]).status, 0, step);
    const file = join(repo.work, '.github/workflows/publish.yml');
    const text = readFileSync(file);
    rmSync(file);
    const missing = repo.run(['tag']);
    assert.equal(missing.status, 2, missing.stdout);
    assert.match(missing.stdout, /NOT READY: .*publish\.yml/);
    assert.equal(repo.runTTY(['tag']).status, 1);
    writeFileSync(file, text);
    chmodSync(file, 0o000);
    try {
      const locked = repo.run(['tag']);
      assert.equal(locked.status, 2, locked.stdout);
      assert.match(locked.stdout, /NOT READY: .*publish\.yml cannot be read/);
    } finally {
      chmodSync(file, 0o644);
    }
  });
});

describe('ciOnlyGates names are unique and real (5)', () => {
  const real = parse(readFileSync(join(repoRoot, 'release.config.json'), 'utf8'));

  it('rejects a duplicate name', () => {
    const config = { ...real, ciOnlyGates: [...real.ciOnlyGates, real.ciOnlyGates[1]] };
    assert.match(configProblem(config), /ciOnlyGates names must be unique/);
  });

  it('fails preflight when a ciOnlyGates entry is not a script in package.json', async () => {
    const repo = await makeReleaseRepo();
    const file = join(repo.work, 'package.json');
    const pkg = parse(readFileSync(file, 'utf8'));
    delete pkg.scripts['test:storybook'];
    writeFileSync(file, JSON.stringify(pkg, null, 2));
    git(repo.work, 'add', '-A');
    git(repo.work, 'commit', '-q', '-m', 'drop a script');
    git(repo.work, 'push', '-q', 'origin', repo.config.releaseBranch);
    const result = repo.run(['preflight']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /ciOnlyGates entry test:storybook is not a script in package\.json/);
  });

  it('accepts the entries of this repository, and an entry whose command is the Playwright install', () => {
    const scripts = parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).scripts;
    for (const entry of real.ciOnlyGates) {
      if (/playwright install/.test(entry.command ?? '')) continue;
      assert.ok(entry.name in scripts, entry.name);
    }
  });
});
