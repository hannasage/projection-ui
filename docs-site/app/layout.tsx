import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Provider } from '@/components/Provider';
import './global.css';

export const metadata: Metadata = { title: { default: 'Projection UI', template: '%s · Projection UI' }, description: 'React components, themes, and shared design values.' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className="dark"><body className="flex flex-col min-h-screen"><a className="skip-link" href="#nd-page">Skip to content</a><Provider>{children}</Provider></body></html>;
}
