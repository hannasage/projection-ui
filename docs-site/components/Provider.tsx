'use client';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import SearchDialog from './SearchDialog';

export function Provider({ children }: { children: ReactNode }) {
  return <RootProvider theme={{ enabled: false }} search={{ SearchDialog }}>{children}</RootProvider>;
}
