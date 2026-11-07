import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './helpers/tools-support.mjs';

const text = readFileSync(join(repoRoot, 'docs/workflow-audit.md'), 'utf8');
const rows = text.split('\n').filter((line) => line.startsWith('|') && !line.startsWith('|---')).map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
const header = rows[0];
const body = rows.slice(1);
const decision = (start) => body.find((row) => row[0].startsWith(start))?.[7] ?? '';

describe('docs/workflow-audit.md', () => {
  it('has the eight columns in order', () => {
    assert.deepEqual(header, ['Name', 'Steps', 'How often', 'Estimated tokens saved per run', 'Safety class', 'Inputs', 'Outputs', 'Decision']);
  });

  it('has a full row for every candidate, and each decision starts with script or keep as agent task', () => {
    assert.ok(body.length >= 10);
    for (const row of body) {
      assert.equal(row.length, 8, row[0]);
      for (const cell of row) assert.notEqual(cell, '', row[0]);
      assert.match(row[7], /^(script|keep as agent task)\b/, row[0]);
    }
  });

  it('gives every decision the keyword and exactly one sentence', () => {
    for (const row of body) {
      const match = /^(script|keep as agent task)\. (.+)$/.exec(row[7]);
      assert.ok(match, `${row[0]}: start with the keyword and a period`);
      // Remove code spans and numbers with dots, so that file names and versions do not count as sentence ends.
      const sentence = match[2].replace(/`[^`]*`/g, 'code').replace(/\d+\.\d+(?:\.\d+)?/g, 'number');
      assert.match(sentence, /^[^.!?]+\.$/, `${row[0]}: one sentence`);
    }
  });

  it('names the required candidates with the required decisions', () => {
    for (const name of ['Full gate run', 'PR open', 'Tree cleanliness', 'Release preflight', 'Release gates and dry run', 'Design kit zip', 'Docs edition', 'Version move']) assert.match(decision(name), /^script/, name);
    for (const name of ['Docs-site three-viewport', 'Release-publish-path', 'Release tag and publish', 'Retire the old alpha']) assert.match(decision(name), /^keep as agent task/, name);
    assert.match(decision('Release-publish-path'), /closed local port with no retries/);
  });

  it('labels the token figures as estimates', () => {
    assert.match(text, /estimates/i);
  });

  it('follows the plain-English rules: no contractions, no em-dashes, no semicolons', () => {
    assert.doesNotMatch(text, /[A-Za-z]['’](?:t|s|re|ve|ll|d|m)(?![A-Za-z])/);
    assert.ok(!text.includes('—'));
    assert.ok(!text.includes(';'));
  });

  it('holds no home path and no session link', () => {
    assert.doesNotMatch(text, /\/Users\/|\/home\/|claude\.ai\/(?:code|chat|share)/);
  });

  it('says that the version rules run in a child process, and describes the exposure field', () => {
    assert.match(text, /runs in a child process and does not import/);
    assert.doesNotMatch(text, /which the script imports/);
    assert.match(text, /`mcp_exposure`/);
    assert.match(readFileSync(join(repoRoot, 'README.md'), 'utf8'), /`mcp_exposure`/);
  });

  it('lists every script of tools/ and the release script as built', () => {
    for (const name of ['scripts/release.mjs', 'tools/gates.mjs', 'tools/pr-open.mjs', 'tools/tree-clean.mjs', 'tools/manifest.json']) assert.ok(text.includes(name), name);
  });
});
