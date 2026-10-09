import type { Metadata } from 'next';
import { Landing } from '@/components/Landing';
export const metadata: Metadata = { title: { absolute: 'Projection UI · Yes. Another UI library.' }, description: 'React components, glass surfaces, and themes. An unpublished alpha you can try in the live gallery.', alternates: { canonical: 'https://projectionui.dev/' } };
export default function Home() { return <Landing />; }
