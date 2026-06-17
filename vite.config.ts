import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: [
      {
        find: 'adem-chrome',
        replacement: fileURLToPath(new URL('./node_modules/adem-chrome/lib/index.ts', import.meta.url)),
      },
      {
        find: /^@lapo\/asn1js$/,
        replacement: fileURLToPath(new URL('./src/vendor/asn1js.ts', import.meta.url)),
      },
      {
        find: /^jdataview$/,
        replacement: fileURLToPath(new URL('./src/vendor/jdataview.ts', import.meta.url)),
      },
    ],
  },
  optimizeDeps: {
    include: ['buffer', 'ipaddr.js', 'jose', 'rfc4648'],
    exclude: ['adem-chrome'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
