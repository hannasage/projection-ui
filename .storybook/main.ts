import type { StorybookConfig } from '@storybook/react-vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const config: StorybookConfig = {
  stories: ['../docs/pages/**/*.mdx', '../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: { name: '@storybook/react-vite', options: {} },
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
