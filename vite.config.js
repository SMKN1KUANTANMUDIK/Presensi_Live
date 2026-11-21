import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'rename-entry-to-index',
      generateBundle(_, bundle) {
        if (bundle['app.html']) {
          bundle['app.html'].fileName = 'index.html';
        }
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'app.html'),
      output: {
        manualChunks: {
          ui: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
        },
        assetFileNames: 'assets/style-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/index-[hash].js',
      },
    },
  },
});
