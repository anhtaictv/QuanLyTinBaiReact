import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // injectManifest (không phải generateSW) để GIỮ NGUYÊN src/sw.js đang tự viết tay xử lý
    // push/notificationclick — generateSW sẽ sinh sw.js mới đè lên, mất luôn phần push.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: { swSrc: 'src/sw.js' },
      manifest: false, // public/manifest.json viết tay đã đủ dùng, không cần plugin sinh thêm
      injectRegister: null, // MainLayout.jsx đã tự gọi navigator.serviceWorker.register('/sw.js')
    }),
  ],
  build: {
    outDir: 'build',
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    globals: true,
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
