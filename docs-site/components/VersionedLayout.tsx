'use client';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type * as PageTree from 'fumadocs-core/page-tree';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { layoutOptions } from '@/lib/layout';
import { versionFromPath } from '@/lib/versions.mjs';
import { VersionSwitcher } from './VersionSwitcher';

export function VersionedLayout({ trees, pages, children }: { trees: Record<string, PageTree.Root>; pages: Record<string, string[]>; children: ReactNode }) {
  const version = versionFromPath(usePathname());
  const links = version === 'current' ? layoutOptions.links : [
    { text: 'Original examples', url: '/docs/0.1.5/examples/' },
    { text: 'GitHub', url: 'https://github.com/hannasage/projection-ui/tree/8362d8b36b8d4928525aac16ebf5cc382e862f2c', external: true },
    { text: 'Markdown', url: '/archives/0.1.5/llms.txt' },
  ];
  return <DocsLayout tree={trees[version]} {...layoutOptions} links={links} sidebar={{ banner: <VersionSwitcher pages={pages} /> }}>{children}</DocsLayout>;
}
