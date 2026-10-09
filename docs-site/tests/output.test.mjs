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

test('static deployment retains the docs-domain redirect and its real destination', () => {
  const config = JSON.parse(read('vercel.json'));
  assert.deepEqual(config,JSON.parse(readFileSync(new URL('../public/vercel.json',import.meta.url),'utf8')));
  const redirect = config.redirects.find(rule=>rule.source==='/' && rule.has?.some(condition=>condition.type==='host' && condition.value==='docs.projectionui.dev'));
  assert.ok(redirect,'The docs domain needs its own reader entry point');
  assert.equal(redirect.destination,'/docs/');
  assert.equal(redirect.permanent,false);
  assert.match(read(redirect.destination.slice(1)+'index.html'),/Read this page as Markdown/);
  assert.match(read('index.html'),/Yes\. Another UI library\./,'Other hosts retain the landing page');
});
