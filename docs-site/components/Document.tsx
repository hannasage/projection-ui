import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page';
import defaultComponents from 'fumadocs-ui/mdx';
import { source } from '@/lib/source';
import { Example } from './Example';

export function Document({ slug }: { slug?: string[] }) {
  const page = source.getPage(slug);
  if (!page) notFound();
  const MDX = page.data.body;
  return <DocsPage toc={page.data.toc} tabIndex={-1}>
    <DocsTitle>{page.data.title}</DocsTitle>
    <DocsDescription>{page.data.description}</DocsDescription>
    <p className="document-source"><a href={`/markdown/${page.slugs.length ? page.slugs.join('/') : 'index'}.md`}>Read this page as Markdown</a></p>
    <DocsBody><MDX components={{ ...defaultComponents, Example }} /></DocsBody>
  </DocsPage>;
}
