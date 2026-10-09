import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
test('alpha revisions and stable patches share one edition without accepting another release line', async () => {
  const { editionForPackage } = await import('../docs-site/lib/versions.mjs');
  for (const version of ['0.2.0-next.2', '0.2.0-next.20', '0.2.0', '0.2.7']) {
    assert.equal(editionForPackage(version).label, '0.2.0');
  }
  for (const version of ['0.1.5', '0.3.0-next.1', '1.2.0', 'invalid']) {
    assert.throws(() => editionForPackage(version), /No current docs edition/);
  }
});
test('version switching retains equivalent pages and falls back to the destination home', async () => {
  const { versionDestination, docsVersions } = await import('../docs-site/lib/versions.mjs');
  const pages = { current: ['', 'installation', 'components/button'], '0.1.5': ['', 'installation', 'theming', 'components'] };
  assert.equal(versionDestination('/docs/installation/', '0.1.5', pages), '/docs/0.1.5/installation/');
  assert.equal(versionDestination('/docs/components/button/', '0.1.5', pages), '/docs/0.1.5/');
  assert.equal(versionDestination('/docs/0.1.5/installation/', 'current', pages), '/docs/installation/');
  assert.equal(versionDestination('/docs/0.1.5/', 'current', pages), '/docs/');
  assert.equal(versionDestination('/docs/0.1.5/theming/', 'unknown', pages), '/docs/');
  assert.equal(docsVersions.length, 2);
  assert.deepEqual(docsVersions[0], { id: 'current', label: '0.2.0', status: 'Alpha', baseUrl: '/docs' });
});
test('the version selector shows an edition and a separate status badge', async () => {
  const { createRequire } = await import('node:module');
  const { runInNewContext } = await import('node:vm');
  const { default: ts } = await import('typescript');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const versions = await import('../docs-site/lib/versions.mjs');
  const require = createRequire(import.meta.url);
  let pathname = '/docs/installation/';
  const source = readFileSync(new URL('docs-site/components/VersionSwitcher.tsx', root), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(output, { exports, require: name => name === 'next/navigation' ? { usePathname: () => pathname, useRouter: () => ({ push() {} }) } : name === '@/lib/versions.mjs' ? versions : require(name) });
  const render = () => renderToStaticMarkup(createElement(exports.VersionSwitcher, { pages: { current: ['', 'installation'], '0.1.5': ['', 'installation'] } }));
  const current = render();
  assert.match(current, /<option value="current" selected="">0\.2\.0<\/option>/);
  assert.match(current, /<span[^>]*aria-label="Documentation status"[^>]*>Alpha<\/span>/);
  assert.doesNotMatch(current, /next\.\d/);
  pathname = '/docs/0.1.5/installation/';
  const legacy = render();
  assert.match(legacy, /<option value="0\.1\.5" selected="">0\.1\.5<\/option>/);
  assert.match(legacy, /<span[^>]*aria-label="Documentation status"[^>]*>Stable<\/span>/);
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
