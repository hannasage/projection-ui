import type { ReactNode } from 'react';
import { source, legacySource, versionPages } from '@/lib/source';
import { VersionedLayout } from '@/components/VersionedLayout';

export default function Layout({ children }: { children: ReactNode }) {
  return <VersionedLayout trees={{ current: source.pageTree, '0.1.5': legacySource.pageTree }} pages={versionPages}>{children}</VersionedLayout>;
}
