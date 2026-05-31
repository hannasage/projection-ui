import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    dts({
      include:     ['src'],
      exclude:     ['src/**/*.stories.*'],
      outDir:      'dist',
      entryRoot:   'src',
      tsconfigPath:'./tsconfig.app.json',
    }),
  ],
  build: {
    lib: {
      entry:   resolve(__dirname, 'src/index.ts'),
      name:    'ProjectionUI',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'react', 'react/jsx-runtime', 'react-dom',
        'recharts', 'zustand',
        '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities',
      ],
      output: {
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
