import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Mono, IBM_Plex_Sans, Syne } from 'next/font/google';
import { Provider } from '@/components/Provider';
import './global.css';

const heading = Syne({ subsets: ['latin'], weight: ['700', '800'], display: 'swap', variable: '--reader-heading' });
const reading = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--reader-body' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', variable: '--reader-code' });

export const metadata: Metadata = { title: { default: 'Projection UI', template: '%s · Projection UI' }, description: 'React components, themes, and shared design values.' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={`dark ${heading.variable} ${reading.variable} ${mono.variable}`}><body className="flex flex-col min-h-screen"><a className="skip-link" href="#nd-page">Skip to content</a><Provider>{children}</Provider></body></html>;
}
