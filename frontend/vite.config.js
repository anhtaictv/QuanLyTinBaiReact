import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://127.0.0.1:5001',
      '/socket.io': {
        target: 'http://127.0.0.1:5001',
        ws: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': 'http://127.0.0.1:5001',
      '/socket.io': {
        target: 'http://127.0.0.1:5001',
        ws: true,
      },
    },
  },
});
