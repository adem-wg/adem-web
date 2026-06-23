import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: 'adem-chrome',
        replacement: fileURLToPath(new URL('../adem-chrome/lib/index.ts', import.meta.url)),
      },
      {
        find: /^@lapo\/asn1js$/,
        replacement: fileURLToPath(new URL('./src/vendor/asn1js.ts', import.meta.url)),
      },
    ],
  },
  optimizeDeps: {
    include: ['ipaddr.js', 'jose', 'rfc4648'],
    exclude: ['adem-chrome'],
  },
});
