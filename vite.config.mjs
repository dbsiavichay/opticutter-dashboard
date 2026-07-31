import autoprefixer from 'autoprefixer'
import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  return {
    base: '/',
    build: {
      outDir: 'build',
    },
    css: {
      postcss: {
        plugins: [
          autoprefixer({}), // add options if needed
        ],
      },
    },
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: 'src/',
          replacement: `${path.resolve(__dirname, 'src')}/`,
        },
      ],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.scss'],
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        // Mirrors production, where Caddy serves the SPA and proxies /api/* to
        // the backend on the same origin. Keeping VITE_API_BASE_URL empty in dev
        // means the app issues the same relative requests it will issue in prod.
        '/api': { target: 'http://localhost:8000', changeOrigin: true },
      },
    },
  }
})
