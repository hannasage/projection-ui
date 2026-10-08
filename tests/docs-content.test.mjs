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
  const peers = { react:'>=19.0.0','react-dom':'>=19.0.0' };
  const documents = componentDocuments({ Button:['None','Native button attributes'] }, entries, peers);
  assert.equal(documents.length, 1);
  assert.equal(documents[0].slug, 'components/button');
  assert.match(documents[0].mdx, /Native button attributes/);
  assert.match(documents[0].mdx, /components-button--primary/);
  assert.match(documents[0].mdx, /react >=19.0.0/);
  assert.throws(() => componentDocuments({ Button:['None','None'] }, entries, {}), /packed react requirement/);
  assert.throws(() => componentDocuments({ Missing:['None','None'] }, entries), /Missing/);
});
