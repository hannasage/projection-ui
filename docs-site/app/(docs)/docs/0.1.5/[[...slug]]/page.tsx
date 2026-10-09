import type { Metadata } from 'next';
import { legacySource } from '@/lib/source';
import { Document } from '@/components/Document';

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  return <Document slug={(await params).slug} version="0.1.5" />;
}
export function generateStaticParams() { return legacySource.generateParams(); }
export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const page = legacySource.getPage((await params).slug);
  return { title: `${page?.data.title ?? 'Documentation'} · 0.1.5`, description: page?.data.description, alternates: { canonical: `https://projectionui.dev/docs/0.1.5/${page?.slugs.length ? page.slugs.join('/') + '/' : ''}` } };
}
