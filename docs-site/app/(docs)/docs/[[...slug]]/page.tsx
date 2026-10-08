import type { Metadata } from 'next';
import { source } from '@/lib/source';
import { Document } from '@/components/Document';

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  return <Document slug={slug} />;
}
export function generateStaticParams() { return source.generateParams(); }
export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const page = source.getPage((await params).slug);
  return { title: page?.data.title, description: page?.data.description };
}
