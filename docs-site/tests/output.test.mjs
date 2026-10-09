import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL('../out/' + path, import.meta.url), 'utf8');
test('the static reader retains eight guides and all component contracts', () => {
  const contracts = JSON.parse(readFileSync(new URL('../../docs/component-contracts.json', import.meta.url), 'utf8'));
  assert.ok(Object.keys(contracts).length > 0);
  const entries = Object.values(JSON.parse(read('examples/index.json')).entries);
  for (const name of Object.keys(contracts)) assert.ok(entries.some(entry => entry.type === 'story' && entry.title.split('/').pop() === name), `${name} needs a packed story`);
  assert.match(read('index.html'), /Projection UI/);
  for (const slug of ['','installation','theming','tokens','accessibility','migration','releases','community']) assert.match(read(`docs/${slug ? slug+'/' : ''}index.html`), /Projection UI/);
  for (const name of Object.keys(contracts)) {
    const slug = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    assert.match(read(`docs/components/${slug}/index.html`), new RegExp(name));
    assert.match(read(`markdown/components/${slug}.md`), /Required props/);
  }
});
test('plain content and the explorer identify the same packed candidate', () => {
  const candidate = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const release = JSON.parse(read('release.json'));
  assert.equal(release.version, candidate.version);
  assert.match(release.integrity, /^sha512-/);
  assert.match(read('llms.txt'), new RegExp(candidate.version.replaceAll('.', '\\.')));
  assert.match(read('llms-full.txt'), /```tsx\nimport/);
  assert.doesNotMatch(read('llms-full.txt'), /<Canvas|<Meta|<Example/);
  const explorer = JSON.parse(read('examples/index.json'));
  assert.ok(Object.values(explorer.entries).some(entry => entry.title === 'Gallery/Components' && entry.type === 'story'));
  assert.ok(Object.values(explorer.entries).some(entry => entry.title === 'Foundations/Themes' && entry.type === 'story'));
  assert.equal(explorer.entries['charts-chartpalette--default'].type, 'story');
  assert.equal(read('changelog.md'), readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8'));
  assert.match(read('docs/releases/index.html'), /href="\/changelog.md"/);
});

test('served documentation includes all font copyright notices and licenses', () => {
  assert.match(read('index.html'), /font-licenses\/NOTICE\.txt/);
  for (const name of ['Syne','IBM-Plex-Sans','IBM-Plex-Mono']) {
    const license = read(`font-licenses/${name}-OFL.txt`);
    assert.match(license, /Copyright/);
    assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
    assert.match(license, /PERMISSION & CONDITIONS/);
  }
});

test('landing and reader keep separate usable entry points', () => {
  const landing = read('index.html');
  assert.match(landing,/Yes\. Another UI library\./);
  assert.match(landing,/href="\/docs\/"/);
  assert.match(landing,/gallery-components--paired/);
  assert.match(landing,/Alpha/);
  assert.doesNotMatch(landing,/id="nd-sidebar"/);
  assert.match(read('docs/index.html'),/Read this page as Markdown/);
});

test('static documentation serves the checked-in font binaries', () => {
  for (const name of ['syne-latin-variable.woff2','ibm-plex-sans-latin-variable.woff2','ibm-plex-mono-latin-400.woff2','ibm-plex-mono-latin-500.woff2']) {
    const served = readFileSync(new URL('../out/fonts/'+name,import.meta.url));
    const source = readFileSync(new URL('../public/fonts/'+name,import.meta.url));
    assert.deepEqual(served,source,`${name} keeps its verified licensed bytes`);
  }
});

test('one host serves the landing and reader and redirects legacy subdomain links', () => {
  const config = JSON.parse(read('vercel.json'));
  assert.deepEqual(config,JSON.parse(readFileSync(new URL('../public/vercel.json',import.meta.url),'utf8')));
  const legacyHost = rule => rule.has?.some(condition => condition.type === 'host' && condition.value === 'docs.projectionui.dev');
  const homeRedirect = config.redirects.find(rule => rule.source === '/' && legacyHost(rule));
  assert.equal(homeRedirect?.destination, 'https://projectionui.dev/docs/');
  assert.equal(homeRedirect?.permanent, true);
  const redirect = config.redirects.find(rule => rule.source === '/:path*' && legacyHost(rule));
  assert.ok(redirect,'Existing subdomain links retain their paths');
  assert.equal(redirect.source,'/:path*');
  assert.equal(redirect.destination,'https://projectionui.dev/:path*');
  assert.equal(redirect.permanent,true);
  assert.match(read('docs/index.html'),/Read this page as Markdown/);
  assert.match(read('index.html'),/Yes\. Another UI library\./);
});

test('the stable archive retains its own routes, source bytes, and search index', async () => {
  const { createHash } = await import('node:crypto');
  const archive = JSON.parse(read('archives/0.1.5/archive.json'));
  assert.equal(archive.gitHead, '8362d8b36b8d4928525aac16ebf5cc382e862f2c');
  for (const record of archive.files) {
    const bytes = readFileSync(new URL(`../out/archives/0.1.5/sources/${record.path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, record.path);
  }
  for (const slug of ['', 'installation', 'theming', 'components', 'toasts', 'examples']) {
    const html = read(`docs/0.1.5/${slug ? slug + '/' : ''}index.html`);
    assert.match(html, /You are reading version 0.1.5/);
    assert.match(html, /Documentation version/);
    assert.doesNotMatch(html, /component-example/);
  }
  assert.match(read('archives/0.1.5/markdown/installation.md'), /npm install @hannasage\/projection-ui@0.1.5/);
  assert.match(read('api/search-0.1.5'), /Original examples|Component reference/);
  const versions = JSON.parse(read('docs-versions.json'));
  assert.equal(versions.current, '0.2.0');
  assert.equal(versions.packageVersion, JSON.parse(read('release.json')).version);
  assert.deepEqual(versions.versions[0], { id: 'current', label: '0.2.0', status: 'Alpha', baseUrl: '/docs' });
  assert.equal(versions.versions.length, 2, 'Prerelease and patch updates share the current edition');
  assert.equal(versions.versions[1].baseUrl, '/docs/0.1.5');
});

test('the current edition has an Alpha badge and registry-first install guidance', () => {
  const html = read('docs/index.html');
  assert.match(html, /<option value="current" selected="">0\.2\.0<\/option>/);
  assert.match(html, /aria-label="Documentation status"[^>]*>Alpha<\/span>/);
  const guide = read('markdown/installation.md');
  assert.match(guide, /npm install @hannasage\/projection-ui@0\.1\n/);
  assert.match(guide, /npm install --save-exact @hannasage\/projection-ui@next\n/);
  assert.match(guide, /npm install --save-exact @hannasage\/projection-ui@0\.2\.0-next\.2\n/);
  assert.match(guide, /`0\.2\.0-next\.2` is an unpublished candidate/);
  assert.match(guide, /npm currently has only 0\.1\.x releases and no `next` tag/);
  assert.match(guide, /After an alpha is published under `next`/);
  assert.match(guide, /`--save-exact` keeps later alpha and stable updates manual/);
});

test('the design download matches its version and published fingerprint', async () => {
  const { createHash } = await import('node:crypto');
  const design = JSON.parse(read('downloads/design-package.json'));
  const candidate = JSON.parse(read('release.json'));
  assert.equal(design.version, candidate.version);
  assert.equal(design.filename, `projection-ui-design-${candidate.version}.zip`);
  const archive = readFileSync(new URL(`../out/downloads/${design.filename}`, import.meta.url));
  assert.equal(archive.length, design.bytes);
  assert.equal(createHash('sha256').update(archive).digest('hex'), design.sha256);
  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  assert.ok(design.inventory.sets > 0, 'The kit contains editable component sets');
  assert.ok(design.inventory.text > 0, 'The kit contains editable text');
  assert.match(read('docs/releases/index.html'), new RegExp(design.filename.replaceAll('.', '\\.')));
});

test('landing prompt and graphics notices ship with the static preview', () => {
  const landing = read('index.html');
  assert.match(landing, /Just give our site to your AI/);
  assert.match(landing, /Oh great AI, take this elite component library/);
  assert.match(landing, /Copy AI prompt/);
  assert.doesNotMatch(landing, /You still have to build the app\. Sorry\./);
  const notice = read('third-party/NOTICE.txt');
  assert.match(notice, /Kevin Levron/);
  assert.match(notice, /CC BY-NC-SA 4\.0/);
  assert.match(notice, /runtime remains unmodified/i);
  assert.match(notice, /not included in the Projection UI npm package/);
  const effect = read('effects/tubes-cursor.html');
  assert.match(effect, /import\('https:\/\/cdn\.jsdelivr\.net\/npm\/threejs-components@0\.0\.19\/build\/cursors\/tubes1\.min\.js'\)/);
  assert.match(effect, /event\.source !== parent/);
  assert.match(effect, /event\.data\.nonce !== nonce/);
  assert.ok(effect.length < 20000, 'The local graphics adapter does not redistribute the upstream runtime');
  assert.match(landing, /third-party\/NOTICE\.txt/);
});
