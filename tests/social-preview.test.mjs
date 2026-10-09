import assert from 'node:assert/strict';
import { test } from 'node:test';

test('social previews use the approved landing title and one absolute image', async () => {
  const { socialPreview } = await import('../docs-site/lib/social-preview.ts');
  assert.equal(socialPreview.title, 'Projection UI · Yes. Another UI library.');
  assert.equal(socialPreview.description, 'React components, glass morphism, and themes.');
  assert.equal(socialPreview.image, 'https://projectionui.dev/social/projection-ui.png');
  assert.equal(socialPreview.width, 1200);
  assert.equal(socialPreview.height, 630);
  assert.match(socialPreview.alt, /Yes\. Another UI library\./);
  assert.match(socialPreview.alt, /project card/i);
});

test('Storybook serves only the social directory and emits the shared preview tags', async () => {
  const { default: config } = await import('../.storybook/main.ts');
  const { socialPreview } = await import('../docs-site/lib/social-preview.ts');
  assert.deepEqual(config.staticDirs, [{ from: '../docs-site/public/social', to: '/social' }]);
  const head = config.managerHead('<meta name="existing" content="retained">');
  assert.ok(head.startsWith('<meta name="existing" content="retained">'));
  const tags = [...head.matchAll(/<meta (property|name)="([^"]+)" content="([^"]*)"\s*\/?\s*>/g)];
  const value = key => tags.filter(tag => tag[2] === key).map(tag => tag[3]);
  for (const [key, expected] of Object.entries({
    'og:type': 'website',
    'og:site_name': 'Projection UI',
    'og:title': socialPreview.title,
    'og:description': socialPreview.description,
    'og:image': socialPreview.image,
    'og:image:width': String(socialPreview.width),
    'og:image:height': String(socialPreview.height),
    'og:image:type': 'image/png',
    'og:image:alt': socialPreview.alt,
    'twitter:card': 'summary_large_image',
    'twitter:title': socialPreview.title,
    'twitter:description': socialPreview.description,
    'twitter:image': socialPreview.image,
    'twitter:image:alt': socialPreview.alt,
  })) assert.deepEqual(value(key), [expected], `Storybook emits one ${key} tag`);
});

test('social tags escape HTML attribute characters before adding content to the head', async () => {
  const { escapeHtmlAttribute } = await import('../docs-site/lib/social-preview.ts');
  assert.equal(escapeHtmlAttribute('A & B "quoted" <image> \'single\''), 'A &amp; B &quot;quoted&quot; &lt;image&gt; &#39;single&#39;');
  assert.equal(escapeHtmlAttribute('Projection UI'), 'Projection UI');
});

test('Storybook escapes shared content when it writes HTML tags', async () => {
  const { default: config } = await import('../.storybook/main.ts');
  const { socialPreview } = await import('../docs-site/lib/social-preview.ts');
  const title = socialPreview.title;
  try {
    socialPreview.title = 'A & B "quoted"><script>alert(1)</script>';
    const head = config.managerHead('');
    assert.doesNotMatch(head, /<script>/);
    for (const key of ['og:title', 'twitter:title']) {
      assert.ok(head.includes(`="${key}" content="A &amp; B &quot;quoted&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"`));
    }
  } finally {
    socialPreview.title = title;
  }
});
