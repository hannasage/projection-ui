import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { configProblem } from '../scripts/release.mjs';
import { deepRedact, redact } from '../tools/lib/text.mjs';
import { workflowHash } from '../tools/lib/workflow.mjs';
import { cleanup, filtersFor, git, makeReleaseRepo, makeRepoWithRemote, repoRoot, runNode, scrubbed, workflowText } from './helpers/tools-support.mjs';

afterEach(cleanup);

const WORKFLOW = '.github/workflows/publish.yml';
const PIN_MESSAGE = /publish\.yml changed since the script was last checked: review the change by hand, then update workflow\.sha256 in release\.config\.json \(a person does this\)/;
const parse = (text) => JSON.parse(text);

/** Commits a workflow text WITHOUT moving the pin, as an unreviewed change would. */
function commitUnpinned(repo, text) {
  writeFileSync(join(repo.work, WORKFLOW), text);
  git(repo.work, 'add', '-A');
  git(repo.work, 'commit', '-q', '--allow-empty', '-m', 'change the workflow');
  git(repo.work, 'push', '-q', 'origin', repo.config.releaseBranch);
}

describe('the content pin on the publish workflow', () => {
  it('matches the committed workflow of this repository', () => {
    const config = parse(readFileSync(join(repoRoot, 'release.config.json'), 'utf8'));
    assert.match(config.workflow.sha256, /^[0-9a-f]{64}$/);
    assert.equal(workflowHash(readFileSync(join(repoRoot, WORKFLOW), 'utf8')), config.workflow.sha256);
  });

  it('hashes CRLF text and trailing whitespace like the plain text, and a one-character change differently', () => {
    const text = workflowText(filtersFor('1.0.0'));
    const crlf = text.replace(/\n/g, '\r\n');
    const spaced = text.replace(/\n/g, '  \t\n');
    assert.equal(workflowHash(crlf), workflowHash(text));
    assert.equal(workflowHash(spaced), workflowHash(text));
    assert.notEqual(workflowHash(`${text}#`), workflowHash(text));
    assert.notEqual(workflowHash(text.replace('npm-publish', 'npm-publisH')), workflowHash(text));
  });

  it('passes preflight with a CRLF copy of the pinned workflow', async () => {
    const repo = await makeReleaseRepo();
    commitUnpinned(repo, workflowText(filtersFor(repo.config.version)).replace(/\n/g, '\r\n'));
    const result = repo.run(['preflight']);
    assert.equal(result.status, 0, result.stdout);
  });

  it('fails preflight, gates, dry-run, and the tag step on a one-byte change that no parser looks at', async () => {
    const repo = await makeReleaseRepo();
    commitUnpinned(repo, `${workflowText(filtersFor(repo.config.version))}\n# x\n`);
    for (const step of ['preflight', 'gates', 'dry-run']) {
      const result = repo.run([step]);
      assert.equal(result.status, 1, `${step}: ${result.stdout}`);
      assert.match(result.stdout, PIN_MESSAGE, step);
    }
    // The tag step is human-only: with a terminal it exits 1 on a blocker, and without one it exits 2 and still names the blocker.
    const tty = repo.runTTY(['tag']);
    assert.equal(tty.status, 1, tty.stdout);
    assert.match(tty.stdout, PIN_MESSAGE);
    const plain = repo.run(['tag']);
    assert.equal(plain.status, 2);
    assert.match(plain.stdout, new RegExp(`NOT READY: .*${PIN_MESSAGE.source}`));
  });

  it('fails on the YAML forms a line reader misses, because the hash differs', async () => {
    const mutations = {
      'quoted key': (text) => text.replace('      - run: npm run lint', '      - run: npm run lint\n        "if": false'),
      'flow-map step': (text) => text.replace('    steps:\n      - run: node scripts/verify-release.mjs --publish', '    steps:\n      - {uses: some/action@v1}\n      - run: node scripts/verify-release.mjs --publish'),
      'merge key': (text) => text.replace('      - run: npm ci', '      - &base\n        run: npm ci\n      - <<: *base\n        if: false'),
      'complex key': (text) => text.replace('      - run: npm run lint', '      - run: npm run lint\n        ? if\n        : false'),
      'extra publish run step': (text) => `${text}      - run: echo extra\n`,
      'second document': (text) => `${text}---\nname: other\n`,
      'publish continue-on-error': (text) => text.replace('    environment: npm-publish', '    continue-on-error: true\n    environment: npm-publish'),
    };
    for (const [name, change] of Object.entries(mutations)) {
      const repo = await makeReleaseRepo();
      const original = workflowText(filtersFor(repo.config.version));
      const changed = change(original);
      assert.notEqual(changed, original, `${name}: the mutation changed nothing`);
      commitUnpinned(repo, changed);
      const result = repo.run(['preflight']);
      assert.equal(result.status, 1, name);
      assert.match(result.stdout, PIN_MESSAGE, name);
    }
  });

  it('fails every step when the config has no hash, or a hash that is not 64 hex digits', async () => {
    for (const edit of [(workflow) => { delete workflow.sha256; }, (workflow) => { workflow.sha256 = 'abc'; }]) {
      const repo = await makeReleaseRepo({ configEdit: (config) => edit(config.workflow) });
      const result = repo.run(['preflight']);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /workflow\.sha256/);
    }
  });

  it('says in the reader, the audit, and the README that the pin is the safety control', () => {
    assert.match(readFileSync(join(repoRoot, 'tools/lib/workflow.mjs'), 'utf8'), /is NOT a safety control/);
    assert.match(readFileSync(join(repoRoot, 'docs/workflow-audit.md'), 'utf8'), /workflow\.sha256/);
    assert.match(readFileSync(join(repoRoot, 'README.md'), 'utf8'), /workflow\.sha256/);
  });
});

describe('small fixes of the last round', () => {
  it('reports claims as unknown, with exit 1, when the claim check cannot run', async () => {
    const repo = await makeReleaseRepo();
    rmSync(join(repo.work, 'README.md'));
    const result = repo.run(['status', '--json']);
    assert.equal(result.status, 1);
    const body = parse(result.stdout);
    const claims = body.phases.find((phase) => phase.name === 'claims');
    assert.equal(claims.state, 'unknown');
    assert.match(claims.note, /README\.md/);
    assert.ok(body.unknown.includes('claims'));
    assert.equal(repo.run(['claims']).status, 1);
  });

  it('rejects a ciOnlyGates name that is also a gate, and a command that is not an npm script or the browser install', () => {
    const real = parse(readFileSync(join(repoRoot, 'release.config.json'), 'utf8'));
    assert.equal(configProblem(real), null);
    const withEntry = (entry) => ({ ...real, ciOnlyGates: [...real.ciOnlyGates, entry] });
    assert.match(configProblem(withEntry({ name: 'lint', reason: 'CI runs it' })), /also in gates/);
    for (const command of ['npm publish', 'npm run lint && npm publish', 'npx playwright install; rm x', 'node x.mjs', 'npm run']) {
      assert.match(configProblem(withEntry({ name: 'extra', command, reason: 'CI runs it' })) ?? '', /ciOnlyGates must be a list/, command);
    }
    assert.equal(configProblem(withEntry({ name: 'extra', command: 'npm run test:extra', reason: 'CI runs it' })), null);
  });

  it('cuts the claim line it prints to 200 characters', async () => {
    const repo = await makeReleaseRepo();
    mkdirSync(join(repo.work, 'docs'), { recursive: true });
    writeFileSync(join(repo.work, 'docs/start.md'), `This is an unpublished candidate ${'x'.repeat(2000)}\n`);
    const result = repo.run(['claims']);
    assert.equal(result.status, 1);
    const line = result.stdout.split('\n').find((text) => text.includes('docs/start.md'));
    assert.ok(line.length < 400, `printed ${line.length} characters`);
    assert.match(line, /\.\.\./);
  });

  it('names the per-gate exit 124 in the manifest exit codes', () => {
    const manifest = parse(readFileSync(join(repoRoot, 'tools/manifest.json'), 'utf8'));
    assert.match(manifest.exit_codes['1'], /124/);
  });

  it('refuses a remote vcs key in tree-clean', () => {
    const { work } = makeRepoWithRemote();
    git(work, 'config', 'remote.origin.vcs', 'x');
    const result = runNode(join(repoRoot, 'tools/tree-clean.mjs'), [work, '--json'], { env: scrubbed() });
    assert.equal(result.status, 1);
    assert.match(parse(result.stdout).checks[0].detail, /remote\.origin\.vcs/i);
  });

  it('redacts single-quoted keys with a number and a list under a secret key', () => {
    for (const text of [`{'password': 12345}`, `{"password":[1,2]}`, `{'token': [1, 2, 3]}`, `{"secret":["abc","def"]}`]) {
      const out = redact(text);
      assert.doesNotMatch(out, /12345|\b[123]\b|abc|def/, text);
      assert.match(out, /\[redacted\]/);
    }
    assert.deepEqual(parse(redact('{"password":[1,2],"count":3}')), { password: '[redacted]', count: 3 });
    assert.deepEqual(deepRedact({ password: [1, 2], token: ['a'], list: [1, 2] }), { password: '[redacted]', token: '[redacted]', list: [1, 2] });
  });
});
