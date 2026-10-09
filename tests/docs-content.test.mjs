import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transformGuide, componentDocuments } from '../scripts/docs-content.mjs';

const entries = [{ type:'story',id:'components-button--primary',name:'Primary',title:'Components/Button',importPath:'./stories/Button.stories.tsx' }];
test('one authored guide supplies reader content, plain Markdown, and its real explorer links', () => {
  const source = "import { Meta, Canvas } from '@storybook/blocks'\nimport * as ButtonStories from '../../stories/Button.stories'\n\n<Meta title=\"Guides/Introduction\" />\n\n# Projection UI\n\nRead this guide.\n\n```tsx\nimport { Button } from '@hannasage/projection-ui/core'\nexport const example = <Button>Explore</Button>\n```\n\n<Canvas of={ButtonStories.Primary} />\n";
  const result = transformGuide(source, 'docs/pages/Introduction.mdx', entries);
  assert.equal(result.slug, 'index');
  assert.equal(result.title, 'Projection UI');
  assert.match(result.mdx, /<Example id="components-button--primary"/);
  assert.doesNotMatch(result.mdx, /@storybook\/blocks|ButtonStories|<Meta/);
  assert.match(result.markdown, /```tsx\nimport \{ Button \} from '@hannasage\/projection-ui\/core'/);
  assert.match(result.markdown, /\/examples\/\?path=\/story\/components-button--primary/);
  assert.doesNotMatch(result.markdown, /<Example|<Canvas|<Meta/);
});
test('an unresolved example stops generation instead of creating a broken link', () => {
  assert.throws(() => transformGuide("import * as ButtonStories from '../../stories/Button.stories'\n# Button\n<Canvas of={ButtonStories.Missing} />", 'docs/pages/Button.mdx', entries), /Missing/);
});
test('component references retain all contracts and every published example route', () => {
  const manifest = { peerDependencies: { react:'>=19.0.0','react-dom':'>=19.0.0' }, dependencies: { recharts:'^3.0.0', 'react-is':'^19.0.0' } };
  const documents = componentDocuments({ Button:['None','Native button attributes'] }, entries, manifest);
  assert.equal(documents.length, 1);
  assert.equal(documents[0].slug, 'components/button');
  assert.match(documents[0].mdx, /Native button attributes/);
  assert.match(documents[0].mdx, /components-button--primary/);
  assert.match(documents[0].mdx, /react >=19.0.0/);
  assert.match(documents[0].mdx, /Shared application peers:/);
  const chart = componentDocuments({ BarChart:['data','color'] }, [{ ...entries[0],title:'Charts/BarChart' }], manifest)[0];
  assert.match(chart.mdx, /Package runtime dependencies: `recharts \^3.0.0`, `react-is \^19.0.0`/);
  assert.match(chart.markdown, /npm installs these dependencies automatically/);
  assert.doesNotMatch(chart.mdx, /Runtime peers|Install `recharts|all declared peer requirements/);
  assert.throws(() => componentDocuments({ BarChart:['data','color'] }, [{ ...entries[0],title:'Charts/BarChart' }], { peerDependencies:manifest.peerDependencies }), /packed recharts runtime dependency/);
  assert.throws(() => componentDocuments({ Button:['None','None'] }, entries, {}), /packed react requirement/);
  assert.throws(() => componentDocuments({ Missing:['None','None'] }, entries), /Missing/);
});

test('packed manifest roles produce automatic feature installation guidance', async () => {
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  const components = ['BarChart','SortableList','ToastContainer'];
  const documents = componentDocuments(Object.fromEntries(components.map(name => [name,['data','options']])), components.map(name => ({ ...entries[0],title:`Components/${name}` })), manifest);
  for (const document of documents) {
    assert.match(document.markdown,/Shared application peers: `react /);
    assert.match(document.markdown,/Package runtime dependencies:/);
    assert.match(document.markdown,/npm installs these dependencies automatically/);
  }
  const guide = transformGuide(readFileSync(new URL('../docs/pages/Installation.mdx',import.meta.url),'utf8'),'docs/pages/Installation.mdx',entries);
  assert.match(guide.markdown,/npm install \/path\/to\/packed-candidate\.tgz\n/);
  assert.doesNotMatch(guide.markdown,/Install `(?:recharts|zustand|@dnd-kit)|npm install [^\n]*(?:react@|recharts@|zustand@)/);
  assert.match(guide.markdown,/unpublished/);
});

test('every documented component has an authored packed-package story', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const contracts = JSON.parse(readFileSync(new URL('../docs/component-contracts.json', import.meta.url), 'utf8'));
  const files = readdirSync(new URL('../stories/', import.meta.url), { recursive: true }).filter(name => name.endsWith('.stories.tsx'));
  const stories = files.map(file => readFileSync(new URL('../stories/' + file, import.meta.url), 'utf8')).join('\n');
  for (const name of Object.keys(contracts)) assert.ok(stories.includes(`/${name}'`) || stories.includes(`/${name}"`), `${name} needs an authored story`);
  assert.doesNotMatch(stories, /from ['"](?:\.\.\/)+src\//, 'Examples must resolve through the packed package');
});

test('paired gallery exposes complete category coverage and both core appearances', async () => {
  const { readFileSync } = await import('node:fs');
  const gallery = readFileSync(new URL('../stories/Gallery.stories.tsx', import.meta.url), 'utf8');
  const categoryLine = gallery.match(/galleryCategories = \[([^\n]+)\] as const/)[1];
  const categories = [...categoryLine.matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.equal(categories.length,49);
  assert.equal(new Set(categories).size,categories.length);
  for (const category of categories) assert.ok(gallery.includes(`'${category}'`) || gallery.includes(`${category}:`), `${category} needs a rendered example`);
  assert.match(gallery,/categorySamples\[category\]/);
  for (const theme of ['COASTAL_DAY_THEME','PROJECTION_THEME','FERNWOOD_FLAT_THEME','PROJECTION_FLAT_THEME']) assert.match(gallery,new RegExp(theme));
  assert.match(gallery,/Composition using library components/);
  assert.match(gallery,/includeStories: \['Paired'\]/,'Gallery metadata must not become a blank story');
});

test('landing has its own layout and keeps an explicit reader home', async () => {
  const { readFileSync } = await import('node:fs');
  const landing = readFileSync(new URL('../docs-site/components/Landing.tsx',import.meta.url),'utf8');
  const reader = readFileSync(new URL('../docs-site/app/(docs)/docs/layout.tsx',import.meta.url),'utf8');
  assert.match(landing,/Yes\. Another UI library\./);
  assert.match(landing,/href="\/docs\/"/);
  assert.match(landing,/gallery-components--paired/);
  assert.match(landing,/useState\('neon'\)/);
  assert.match(landing,/COASTAL_DAY_THEME/);
  assert.match(reader,/DocsLayout/);
  assert.doesNotMatch(readFileSync(new URL('../docs-site/app/(docs)/layout.tsx',import.meta.url),'utf8'),/DocsLayout/);
});

test('reader fonts use checked-in files without a Google build dependency', async () => {
  const { readFileSync } = await import('node:fs');
  const layout = readFileSync(new URL('../docs-site/app/layout.tsx',import.meta.url),'utf8');
  assert.match(layout,/from 'next\/font\/local'/);
  assert.doesNotMatch(layout,/next\/font\/google/);
  const fonts = [...layout.matchAll(/path: '([^']+\.woff2)'/g)];
  assert.equal(fonts.length,4,'The reader needs two variable font files and both mono weights');
  for (const [,path] of fonts) assert.equal(readFileSync(new URL('../docs-site/app/'+path,import.meta.url)).subarray(0,4).toString(),'wOF2');
  for (const role of ['heading','body','code']) assert.match(layout,new RegExp(`--reader-${role}`));
});

test('local font metadata covers the reader families and weights', async () => {
  const { readFileSync } = await import('node:fs');
  const { default: loader } = await import('../node_modules/next/dist/compiled/@next/font/dist/fontkit/index.js');
  const font = name => loader.default(readFileSync(new URL('../docs-site/public/fonts/'+name,import.meta.url)));
  for (const [name,family,weights] of [
    ['syne-latin-variable.woff2','Syne',[700,800]],
    ['ibm-plex-sans-latin-variable.woff2','IBM Plex Sans',[400,500,600]],
  ]) {
    const face = font(name);
    assert.equal(face.familyName,family);
    for (const weight of weights) assert.ok(face.variationAxes.wght.min<=weight && face.variationAxes.wght.max>=weight, `${family} covers ${weight}`);
    assert.ok(face.hasGlyphForCodePoint(65));
  }
  for (const weight of [400,500]) {
    const face = font(`ibm-plex-mono-latin-${weight}.woff2`);
    assert.match(face.familyName,/^IBM Plex Mono/);
    assert.equal(face['OS/2'].usWeightClass,weight);
  }
});
