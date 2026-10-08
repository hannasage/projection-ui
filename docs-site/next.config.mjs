import { createMDX } from 'fumadocs-mdx/next';
import { fileURLToPath } from 'node:url';

export default createMDX()({
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  experimental: { cpus: 1 },
});
