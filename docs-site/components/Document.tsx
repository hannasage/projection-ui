import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage } from 'fumadocs-ui/page';
import defaultComponents from 'fumadocs-ui/mdx';
import { source, legacySource } from '@/lib/source';
import { Example } from './Example';
import { AccessibleTable } from './AccessibleTable';
import { GradientBackground, GradientText } from '@hannasage/projection-ui/core';
import '@hannasage/projection-ui/styles';

export function Document({ slug, version = 'current' }: { slug?: string[]; version?: 'current' | '0.1.5' }) {
  const page = (version === '0.1.5' ? legacySource : source).getPage(slug);
  if (!page) notFound();
  const MDX = page.data.body;
  return <DocsPage toc={page.data.toc} tabIndex={-1} className="document-page" data-ui-theme="">
    <header className="document-heading"><GradientBackground variant="spotlight" className="document-heading-light" aria-hidden="true" /><GradientText as="h1" className="document-title">{page.data.title}</GradientText>
    <DocsDescription>{page.data.description}</DocsDescription></header>
    {version === '0.1.5' ? <p className="rounded-md border border-fd-border bg-fd-muted p-3 text-sm">You are reading version 0.1.5. This archive retains its original API and installation requirements. <a href="/docs/">Open the current alpha documentation.</a></p> : null}
    <p className="document-source"><a href={`${version === '0.1.5' ? '/archives/0.1.5/markdown' : '/markdown'}/${page.slugs.length ? page.slugs.join('/') : 'index'}.md`}>Read this page as Markdown</a></p>
    <DocsBody><MDX components={{ ...defaultComponents, Example, table: AccessibleTable }} /></DocsBody>
    <p className="document-source"><a href="/font-licenses/NOTICE.txt">Font licenses</a></p>
  </DocsPage>;
}
