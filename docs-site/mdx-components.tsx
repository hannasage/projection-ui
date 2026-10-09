import defaultComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { Example } from '@/components/Example';
export function useMDXComponents(components: MDXComponents): MDXComponents { return { ...defaultComponents, Example, ...components }; }
