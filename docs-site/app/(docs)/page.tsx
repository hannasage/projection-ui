import type { Metadata } from 'next';
import { Landing } from '@/components/Landing';
export const metadata: Metadata = { title: { absolute: 'Projection UI · Yes. Another UI library.' }, description: 'React components, glass morphism, and themes. Give your AI the prompt or try the live Storybook.', alternates: { canonical: 'https://projectionui.dev/' } };
export default function Home() { return <Landing />; }
