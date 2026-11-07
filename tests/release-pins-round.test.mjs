import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pinHash } from '../tools/lib/workflow.mjs';
import { cleanup, filtersFor, git, makeReleaseRepo, repoRoot, workflowText } from './helpers/tools-support.mjs';

afterEach(cleanup);

const WORKFLOW = '.github/workflows/publish.yml';
const MJS = ['scripts/verify-release.mjs', 'scripts/publish-design-release.mjs'];
const parse = (text) => JSON.parse(text);

/** Commits a file WITHOUT moving its pin, as an unreviewed change would. */
function commitUnpinned(repo, path, bytes) {
  writeFileSync(join(repo.work, path), bytes);
  git(repo.work, 'add', '-A');
  git(repo.work, 'commit', '-q', '--allow-empty', '-m', `change ${path}`);
  git(repo.work, 'push', '-q', 'origin', repo.config.releaseBranch);
}

const message = (path) => new RegExp(`${path.replace(/[./]/g, '\\$&')} changed since the script was last checked: review the change by hand, then update the pin for ${path.replace(/[./]/g, '\\$&')} in workflow\\.pins of release\\.config\\.json \\(a person does this\\)`);

describe('the pin reads bytes and refuses what a text reader hides (1)', () => {
  const marks = { 'U+00A0': ' ', 'U+3000': '　', 'U+FEFF': '﻿', 'U+2028': ' ' };

  it('refuses a non-ASCII character appended to a line, and names the byte offset', async () => {
    for (const [name, mark] of Object.entries(marks)) {
      const repo = await makeReleaseRepo();
      const text = workflowText(filtersFor(repo.config.version));
      const spot = text.indexOf('environment: npm-publish') + 'environment: npm-publish'.length;
      commitUnpinned(repo, WORKFLOW, text.slice(0, spot) + mark + text.slice(spot));
      const result = repo.run(['preflight']);
      assert.equal(result.status, 1, name);
      assert.match(result.stdout, new RegExp(`publish\\.yml holds a non-ASCII byte at offset ${Buffer.byteLength(text.slice(0, spot))}`), name);
    }
  });

  it('refuses a lone CR, and still accepts CRLF and trailing spaces and tabs', async () => {
    const repo = await makeReleaseRepo();
    const text = workflowText(filtersFor(repo.config.version));
    commitUnpinned(repo, WORKFLOW, text.replace('\n', '\r'));
    const lone = repo.run(['preflight']);
    assert.equal(lone.status, 1);
    assert.match(lone.stdout, /publish\.yml holds a lone CR at offset \d+/);
    commitUnpinned(repo, WORKFLOW, text.replace(/\n/g, ' \t\r\n'));
    const crlf = repo.run(['preflight']);
    assert.equal(crlf.status, 0, crlf.stdout);
  });

  it('gives a problem, not a hash, for those bytes', () => {
    const text = 'a: b\n';
    assert.match(pinHash(WORKFLOW, Buffer.from(`${text}x \n`)).problem, /non-ASCII byte at offset 6/);
    assert.match(pinHash(WORKFLOW, Buffer.from('a\rb\n')).problem, /lone CR at offset 1/);
    assert.match(pinHash(WORKFLOW, Buffer.from('a\u0000b\n')).problem, /control byte at offset 1/);
    assert.equal(typeof pinHash(WORKFLOW, Buffer.from(text)).hash, 'string');
  });

  it('hashes a script by its raw bytes, so even a trailing space changes the pin', () => {
    const base = Buffer.from('export const a = 1;\n');
    assert.notEqual(pinHash(MJS[0], Buffer.from('export const a = 1; \n')).hash, pinHash(MJS[0], base).hash);
    assert.notEqual(pinHash(MJS[0], Buffer.from('export const a = 1;\r\n')).hash, pinHash(MJS[0], base).hash);
    assert.equal(typeof pinHash(MJS[0], Buffer.from('export const a = "é";\n')).hash, 'string');
  });
});

describe('the pin list covers the scripts that publish (3)', () => {
  it('fails preflight, gates, dry-run, and the tag step when any pinned script changes by one byte', async () => {
    for (const path of MJS) {
      const repo = await makeReleaseRepo();
      commitUnpinned(repo, path, `${readFileSync(join(repo.work, path), 'utf8')}\n// x\n`);
      for (const step of ['preflight', 'gates', 'dry-run']) {
        const result = repo.run([step]);
        assert.equal(result.status, 1, `${path} ${step}: ${result.stdout}`);
        assert.match(result.stdout, message(path), `${path} ${step}`);
      }
      assert.equal(repo.runTTY(['tag']).status, 1, path);
      assert.match(repo.run(['tag']).stdout, new RegExp(`NOT READY: ${message(path).source}`), path);
    }
  });

  it('keeps the three pinned paths in release.config.json and refuses a config that drops one', async () => {
    const repo = await makeReleaseRepo();
    assert.deepEqual(repo.config.workflow.pins.map((pin) => pin.path), [WORKFLOW, ...MJS]);
  });
});

describe('status reports a pin mismatch (4)', () => {
  it('shows a blocked workflow-pin phase with the file, and exits 1', async () => {
    const repo = await makeReleaseRepo();
    commitUnpinned(repo, MJS[1], `${readFileSync(join(repo.work, MJS[1]), 'utf8')}\n// x\n`);
    const result = repo.run(['status', '--json']);
    assert.equal(result.status, 1);
    const body = parse(result.stdout);
    const pin = body.phases.find((phase) => phase.name === 'workflow-pin');
    assert.equal(pin.state, 'blocked');
    assert.match(pin.note, message(MJS[1]));
    assert.ok(body.left.includes('workflow-pin'));
    assert.ok(body.blocked.includes('workflow-pin'));
    assert.match(repo.run(['status']).stdout, /blocked\s+workflow-pin/);
  });

  it('shows the phase as done when every pin matches', async () => {
    const repo = await makeReleaseRepo();
    const body = parse(repo.run(['status', '--json']).stdout);
    assert.equal(body.phases.find((phase) => phase.name === 'workflow-pin').state, 'done');
    assert.deepEqual(body.blocked, []);
  });

  it('says in the header comment of the script that the pins are checked', () => {
    const head = readFileSync(join(repoRoot, 'scripts/release.mjs'), 'utf8').split('\n').slice(0, 20).join('\n');
    assert.match(head, /workflow\.pins/);
  });
});

describe('the review of the pins is asked of the owner (2)', () => {
  it('lists the four paths with the repository owner, and says when GitHub enforces it', () => {
    const text = readFileSync(join(repoRoot, '.github/CODEOWNERS'), 'utf8');
    for (const path of ['/release.config.json', '/.github/workflows/', '/scripts/', '/tools/']) {
      assert.match(text, new RegExp(`^${path.replace(/[./]/g, '\\$&')}\\s+@hannasage\\s*$`, 'm'), path);
    }
    assert.match(text, /^#.*branch protection.*code owners/im);
  });

  it('explains in plain words, in the README and the audit, that review is enforced only by a branch protection setting', () => {
    for (const file of ['README.md', 'docs/workflow-audit.md']) {
      const text = readFileSync(join(repoRoot, file), 'utf8');
      assert.match(text, /CODEOWNERS/, file);
      assert.match(text, /branch protection/i, file);
    }
  });
});
