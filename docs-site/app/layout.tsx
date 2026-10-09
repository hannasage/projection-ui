import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import { Provider } from '@/components/Provider';
import { socialPreview } from '@/lib/social-preview';
import './global.css';

const heading = localFont({ src: [{ path: '../public/fonts/syne-latin-variable.woff2', weight: '700 800', style: 'normal' }], display: 'swap', variable: '--reader-heading' });
const reading = localFont({ src: [{ path: '../public/fonts/ibm-plex-sans-latin-variable.woff2', weight: '400 600', style: 'normal' }], display: 'swap', variable: '--reader-body' });
const mono = localFont({ src: [
  { path: '../public/fonts/ibm-plex-mono-latin-400.woff2', weight: '400', style: 'normal' },
  { path: '../public/fonts/ibm-plex-mono-latin-500.woff2', weight: '500', style: 'normal' },
], display: 'swap', variable: '--reader-code' });

export const metadata: Metadata = {
  title: { default: 'Projection UI', template: '%s · Projection UI' },
  description: 'React components, themes, and shared design values.',
  openGraph: {
    siteName: 'Projection UI',
    type: 'website',
    title: socialPreview.title,
    description: socialPreview.description,
    images: [{ url: socialPreview.image, width: socialPreview.width, height: socialPreview.height, type: 'image/png', alt: socialPreview.alt }],
  },
  twitter: {
    card: 'summary_large_image',
    title: socialPreview.title,
    description: socialPreview.description,
    images: [{ url: socialPreview.image, alt: socialPreview.alt }],
  },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning className={`${heading.variable} ${reading.variable} ${mono.variable}`}><body className="flex flex-col min-h-screen"><a className="skip-link" href="#nd-page">Skip to content</a><Provider>{children}</Provider></body></html>;
}
