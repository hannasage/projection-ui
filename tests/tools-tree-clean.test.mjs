import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRebuildable, parseStatus, processesInside } from '../tools/tree-clean.mjs';
import { cleanup, git, makeRepo, makeRepoWithRemote, repoRoot, runNode, scrubbed, tempDir } from './helpers/tools-support.mjs';

afterEach(cleanup);
const script = join(repoRoot, 'tools/tree-clean.mjs');
const run = (args, options = {}) => runNode(script, args, { env: scrubbed(), ...options });
const check = (result, name) => JSON.parse(result.stdout).checks.find((entry) => entry.name === name);

describe('tree-clean', () => {
  it('passes all three checks for a pushed, clean, idle tree and removes nothing', () => {
    const { work } = makeRepoWithRemote();
    const result = run([work]);
    assert.equal(result.status, 0, result.stdout);
    assert.match(result.stdout, /^PASS clean/m);
    assert.match(result.stdout, /^PASS pushed/m);
    assert.match(result.stdout, /^PASS idle/m);
    assert.match(result.stdout, /removed nothing/);
    assert.ok(existsSync(join(work, 'package.json')));
    assert.equal(JSON.parse(run([work, '--json']).stdout).removes, 'nothing');
  });

  it('fails clean for a changed file, an untracked file, and a stash entry', () => {
    const changed = makeRepoWithRemote().work;
    writeFileSync(join(changed, 'package.json'), '{"name":"@hannasage/projection-ui","version":"1"}');
    assert.match(run([changed]).stdout, /FAIL clean - 1 changed or untracked path/);
    const untracked = makeRepoWithRemote().work;
    writeFileSync(join(untracked, 'new.txt'), 'x');
    assert.equal(run([untracked]).status, 1);
    const stashed = makeRepoWithRemote().work;
    writeFileSync(join(stashed, 'package.json'), '{"name":"@hannasage/projection-ui","version":"2"}');
    git(stashed, 'stash', 'push', '-q');
    const result = run([stashed, '--json']);
    assert.equal(check(result, 'clean').ok, false);
    assert.match(check(result, 'clean').detail, /1 stash entry/);
  });

  it('allows rebuildable ignored output and fails on any other ignored file', () => {
    const { work } = makeRepoWithRemote();
    writeFileSync(join(work, '.gitignore'), 'node_modules\ndist\n.env\ndocs-site/out\n.next\n');
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', 'ignore');
    git(work, 'push', '-q');
    for (const dir of ['node_modules/a', 'dist', 'docs-site/out', 'docs-site/.next']) mkdirSync(join(work, dir), { recursive: true });
    for (const file of ['node_modules/a/i.js', 'dist/i.js', 'docs-site/out/i.html']) writeFileSync(join(work, file), 'x');
    const ok = run([work, '--json']);
    assert.equal(check(ok, 'clean').ok, true, ok.stdout);
    writeFileSync(join(work, '.env'), 'SECRET=1');
    const bad = run([work, '--json']);
    assert.equal(check(bad, 'clean').ok, false);
    assert.match(check(bad, 'clean').detail, /ignored path.*first: \.env/);
  });

  it('fails pushed for a commit the remote lacks, and for a commit on another local branch', () => {
    const ahead = makeRepoWithRemote().work;
    writeFileSync(join(ahead, 'a.txt'), 'a');
    git(ahead, 'add', '-A');
    git(ahead, 'commit', '-q', '-m', 'local');
    assert.match(run([ahead]).stdout, /FAIL pushed - 1 commit not on origin\//);
    const other = makeRepoWithRemote().work;
    git(other, 'checkout', '-q', '-b', 'side');
    writeFileSync(join(other, 'b.txt'), 'b');
    git(other, 'add', '-A');
    git(other, 'commit', '-q', '-m', 'side work');
    git(other, 'checkout', '-q', '-');
    const result = run([other, '--json']);
    assert.equal(check(result, 'pushed').ok, false);
    assert.match(check(result, 'pushed').detail, /local branch that no remote branch has.*side/);
  });

  it('fails pushed when the branch has no remote branch, or its upstream is a local branch', () => {
    const none = makeRepo();
    assert.match(run([none]).stdout, /FAIL pushed - the branch main has no remote branch/);
    const { work } = makeRepoWithRemote();
    git(work, 'checkout', '-q', '-b', 'feature');
    git(work, 'branch', '-q', '--set-upstream-to=main');
    const result = run([work, '--json']);
    assert.equal(check(result, 'pushed').ok, false);
    assert.match(check(result, 'pushed').detail, /remote "\."/);
  });

  it('fails pushed on a detached head', () => {
    const { work } = makeRepoWithRemote();
    git(work, 'checkout', '-q', '--detach');
    assert.match(run([work]).stdout, /FAIL pushed - detached head/);
  });

  it('fails idle while a process has its working folder inside the tree', async () => {
    const { work } = makeRepoWithRemote();
    mkdirSync(join(work, 'sub'));
    const child = spawn('sleep', ['30'], { cwd: join(work, 'sub'), stdio: 'ignore' });
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const result = run([work, '--json']);
      assert.equal(check(result, 'idle').ok, false);
      assert.match(check(result, 'idle').detail, /sleep \(pid \d+\)/);
      assert.equal(result.status, 1);
    } finally {
      child.kill();
    }
  });

  it('exits 2 for no path, two paths, a subfolder, another package, or a missing folder', () => {
    const { work } = makeRepoWithRemote();
    mkdirSync(join(work, 'sub'));
    assert.equal(run([]).status, 2);
    assert.equal(run([work, work]).status, 2);
    assert.equal(run([join(work, 'sub')]).status, 2);
    assert.equal(run([makeRepo({ name: 'other' })]).status, 2);
    assert.equal(run([join(work, 'nope')]).status, 2);
    assert.equal(run([tempDir()]).status, 2);
    assert.equal(run([work, '--bogus']).status, 2);
    assert.equal(JSON.parse(run([join(work, 'sub'), '--json']).stdout).exit, 2);
    assert.equal(run(['--help']).status, 0);
  });

  it('exits 1, not 2, when git is missing', () => {
    const { work } = makeRepoWithRemote();
    assert.equal(run([work], { env: { PATH: '/nonexistent', HOME: tempDir() } }).status, 1);
  });
});

describe('tree-clean tags and the lsof note (F7)', () => {
  it('fails pushed for a local lightweight tag and a local annotated tag that no remote has', () => {
    for (const annotate of [false, true]) {
      const { work } = makeRepoWithRemote();
      if (annotate) git(work, 'tag', '-a', 'v9.9.9', '-m', 'x');
      else git(work, 'tag', 'v9.9.9');
      const result = run([work, '--json']);
      assert.equal(check(result, 'pushed').ok, false);
      assert.match(check(result, 'pushed').detail, /local tag v9\.9\.9 is on no remote/);
    }
  });

  it('passes pushed once the tag is on the remote with the same object', () => {
    const { work } = makeRepoWithRemote();
    git(work, 'tag', '-a', 'v9.9.9', '-m', 'x');
    git(work, 'push', '-q', 'origin', 'v9.9.9');
    assert.equal(check(run([work, '--json']), 'pushed').ok, true);
  });

  it('fails pushed when the remote tags cannot be read', () => {
    const { work } = makeRepoWithRemote();
    git(work, 'tag', 'v9.9.9');
    git(work, 'remote', 'set-url', 'origin', join(work, '..', 'gone.git'));
    const result = run([work, '--json']);
    assert.equal(check(result, 'pushed').ok, false);
    assert.match(check(result, 'pushed').detail, /could not read the tags of origin/);
  });

  it('prints one line that says a non-root user cannot see the processes of other users', () => {
    const { work } = makeRepoWithRemote();
    const result = run([work]);
    if (process.getuid?.() !== 0) {
      assert.match(result.stdout, /^NOTE As a non-root user, this tool cannot see the processes of other users/m);
      assert.equal(result.stdout.split('\n').filter((line) => line.startsWith('NOTE')).length, 1);
      assert.match(JSON.parse(run([work, '--json']).stdout).note, /non-root user/);
    }
  });
});

describe('tree-clean index', () => {
  it('does not rewrite the git index', () => {
    const { work } = makeRepoWithRemote();
    // Touch a tracked file so that a plain git status would refresh the cached stat data and rewrite the index.
    const file = join(work, 'package.json');
    const content = readFileSync(file);
    writeFileSync(file, content);
    const index = join(work, '.git', 'index');
    const before = readFileSync(index);
    assert.equal(run([work]).status, 0);
    assert.deepEqual(readFileSync(index), before);
  });
});

describe('tree-clean helpers', () => {
  it('knows which ignored paths a build recreates', () => {
    for (const path of ['node_modules/', 'docs-site/node_modules/', 'dist/', 'docs-site/.next/', 'storybook-static/', 'docs-site/out/', 'docs-site/public/downloads/', 'release-artifacts/']) assert.equal(isRebuildable(path), true, path);
    for (const path of ['.env', '.env.local', 'notes.local', 'docs-site/public/sounds/a.mp3', 'distinct/', 'src/dist-copy', 'secrets/key.pem']) assert.equal(isRebuildable(path), false, path);
  });

  it('splits a null separated status list and skips the second name of a rename', () => {
    assert.deepEqual(parseStatus(' M a b.txt\0?? c.txt\0R  new.txt\0old.txt\0!! dist/\0'), [
      { code: ' M', path: 'a b.txt' }, { code: '??', path: 'c.txt' }, { code: 'R ', path: 'new.txt' }, { code: '!!', path: 'dist/' },
    ]);
  });

  it('lists the processes below a tree and skips its own', () => {
    const listing = 'p10\ncnode\nn/tree\np11\ncsleep\nn/tree/sub\np12\ncother\nn/tree2\np13\ncsh\nn/elsewhere\n';
    assert.deepEqual(processesInside('/tree', listing, new Set([10])).map((entry) => entry.pid), [11]);
    assert.deepEqual(processesInside('/tree', listing, new Set()).map((entry) => entry.pid), [10, 11]);
  });
});
