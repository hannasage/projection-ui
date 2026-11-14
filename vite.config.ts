import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

export default defineConfig({
  plugins: [
    {
      name: 'projection-tokens',
      buildStart() { execFileSync(process.execPath, ['scripts/generate-tokens.mjs']) },
      generateBundle() {
        for (const name of ['scoped', 'reset']) this.emitFile({ type: 'asset', fileName: `tokens/${name}.css`, source: readFileSync(`src/tokens/${name}.css`, 'utf8') })
      },
    },
    {
      // ./motion is ESM only: Armature ships import conditions only, and a second CommonJS copy could split engine state.
      // The other entries keep both formats, so the CommonJS pass drops the motion entry and its map.
      name: 'projection-motion-esm-only',
      generateBundle(options, bundle) {
        if (options.format !== 'cjs') return
        for (const fileName of Object.keys(bundle)) if (/^motion\.cjs(\.map)?$/.test(fileName)) delete bundle[fileName]
      },
    },
    react(),
    dts({
      include:     ['src'],
      exclude:     ['src/**/*.stories.*'],
      outDir:      'dist',
      entryRoot:   'src',
      tsconfigPath:'./tsconfig.app.json',
      copyDtsFiles: true,
      afterBuild(files) {
        for (const [path, content] of files) {
          if (!path.endsWith('.d.ts')) continue
          const normalized = content.replace(/(from\s+['"]|import\(['"])(\.{1,2}\/[^'"\n]+)(['"])/g, (match, prefix, specifier, suffix) => /\.[a-z]+$/i.test(specifier) ? match : `${prefix}${specifier}.js${suffix}`)
          writeFileSync(path, normalized)
        }
      },
    }),
  ],
  build: {
    lib: {
      entry: Object.fromEntries(['index', 'core', 'charts', 'sortable', 'toast', 'foundations', 'motion'].map(name => [name, resolve(__dirname, `src/${name}.ts`)])),
      name:    'ProjectionUI',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'react', 'react/jsx-runtime', 'react-dom',
        'recharts', 'zustand',
        '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities',
        /^@hannasage\/armature(\/.*)?$/,
      ],
      output: {
        banner: chunk => chunk.isEntry && chunk.name !== 'foundations' ? "'use client';" : '',
        globals: {
          react:            'React',
          'react/jsx-runtime': 'ReactJSXRuntime',
          'react-dom':      'ReactDOM',
          recharts:         'Recharts',
          zustand:          'zustand',
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'tokens/theme.css'
          return assetInfo.name ?? 'asset'
        },
      },
    },
    minify: false,
    sourcemap: true,
  },
})
