import type { StorybookConfig } from '@storybook/react-vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { escapeHtmlAttribute, socialPreview } from '../docs-site/lib/social-preview.ts'

const config: StorybookConfig = {
  stories: ['../docs/pages/**/*.mdx', '../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y', '@storybook/addon-interactions'],
  framework: { name: '@storybook/react-vite', options: { builder: { viteConfigPath: '.storybook/vite.config.ts' } } },
  staticDirs: [{ from: '../docs-site/public/social', to: '/social' }],
  managerHead: head => head + [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'Projection UI'],
    ['property', 'og:title', socialPreview.title],
    ['property', 'og:description', socialPreview.description],
    ['property', 'og:image', socialPreview.image],
    ['property', 'og:image:width', String(socialPreview.width)],
    ['property', 'og:image:height', String(socialPreview.height)],
    ['property', 'og:image:type', 'image/png'],
    ['property', 'og:image:alt', socialPreview.alt],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', socialPreview.title],
    ['name', 'twitter:description', socialPreview.description],
    ['name', 'twitter:image', socialPreview.image],
    ['name', 'twitter:image:alt', socialPreview.alt],
  ].map(([attribute, name, content]) => `\n<meta ${attribute}="${name}" content="${escapeHtmlAttribute(content)}">`).join(''),
  async viteFinal(config) {
    const packageDirectory = process.env.PROJECTION_UI_PACKAGE_DIR
    if (!packageDirectory) {
      throw new Error('Build the packed preview with npm run build:storybook before starting Storybook.')
    }
    const manifest = JSON.parse(readFileSync(resolve(packageDirectory, 'package.json'), 'utf8'))
    const aliases = Object.entries(manifest.exports).map(([path, target]) => {
      const entry = typeof target === 'string' ? target : ((target as { import?: string; default?: string }).import ?? (target as { default: string }).default)
      return {
        find: path === '.' ? '@hannasage/projection-ui' : `@hannasage/projection-ui/${path.slice(2)}`,
        replacement: resolve(packageDirectory, entry),
      }
    }).sort((a, b) => b.find.length - a.find.length)
    config.resolve = { ...config.resolve, alias: aliases, dedupe: ['react', 'react-dom'] }
    config.server = { ...config.server, fs: { ...config.server?.fs, allow: [process.cwd(), packageDirectory] } }
    return config
  },
}
export default config
