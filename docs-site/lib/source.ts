import { defineDocs } from 'fumadocs-mdx/macro';
import { loader } from 'fumadocs-core/source';

const docs = defineDocs({ dir: 'content/docs' });
const legacyDocs = defineDocs({ dir: 'content/versions/0.1.5' });
export const source = loader({ baseUrl: '/docs', source: docs.toFumadocsSource() });
export const legacySource = loader({ baseUrl: '/docs/0.1.5', source: legacyDocs.toFumadocsSource() });
export const versionPages = {
  current: source.getPages().map(page => page.slugs.join('/')),
  '0.1.5': legacySource.getPages().map(page => page.slugs.join('/')),
};
