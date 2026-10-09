import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
test('version switching retains equivalent pages and falls back to the destination home', async () => {
  const { versionDestination, docsVersions } = await import('../docs-site/lib/versions.mjs');
  const pages = { current: ['', 'installation', 'components/button'], '0.1.5': ['', 'installation', 'theming', 'components'] };
  assert.equal(versionDestination('/docs/installation/', '0.1.5', pages), '/docs/0.1.5/installation/');
  assert.equal(versionDestination('/docs/components/button/', '0.1.5', pages), '/docs/0.1.5/');
  assert.equal(versionDestination('/docs/0.1.5/installation/', 'current', pages), '/docs/installation/');
  assert.equal(versionDestination('/docs/0.1.5/', 'current', pages), '/docs/');
  assert.equal(versionDestination('/docs/0.1.5/theming/', 'unknown', pages), '/docs/');
  assert.equal(docsVersions.length, 2);
});
test('the legacy collection preserves every archived byte and its published source identity', async () => {
  const { legacyDocuments } = await import('../scripts/docs-versions.mjs');
  const manifest = JSON.parse(readFileSync(new URL('docs/archive/0.1.5/archive.json', root), 'utf8'));
  assert.equal(manifest.gitHead, '8362d8b36b8d4928525aac16ebf5cc382e862f2c');
  assert.equal(manifest.version, '0.1.5');
  for (const file of manifest.files) {
    const bytes = readFileSync(new URL(`docs/archive/0.1.5/sources/${file.path}`, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
  }
  const records = legacyDocuments(new URL('docs/archive/0.1.5/', root));
  assert.deepEqual(records.map(record => record.slug), ['index', 'installation', 'theming', 'components', 'toasts', 'examples']);
  assert.match(records.find(record => record.slug === 'installation').mdx, /npm install react react-dom recharts zustand/);
  assert.match(records.find(record => record.slug === 'components').mdx, /DataTable/);
  assert.match(records.find(record => record.slug === 'examples').mdx, /8362d8b36b8d4928525aac16ebf5cc382e862f2c\/stories\/Button.stories.tsx/);
  for (const record of records) assert.doesNotMatch(record.mdx, /<Example|\/projection-ui\/core|`Surface`|GradientText/);
});
