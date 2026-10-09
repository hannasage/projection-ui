'use client';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import SearchDialog from './SearchDialog';

export function Provider({ children }: { children: ReactNode }) {
  return <RootProvider theme={{ enabled: true, enableSystem: false, defaultTheme: 'dark', storageKey: 'projection-docs-theme' }} search={{ SearchDialog }}>{children}</RootProvider>;
}
