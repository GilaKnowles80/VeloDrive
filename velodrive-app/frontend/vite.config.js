import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import copy from 'rollup-plugin-copy';

export default defineConfig({
  plugins: [
    react(),
    copy({
      targets: [
        { src: 'public/manifest.json', dest: 'dist' },
        { src: 'public/sw.js', dest: 'dist' },
      ],
      hook: 'writeBundle',
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  build: {
    outDir: 'dist'
  }
});
