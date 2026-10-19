import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname ?? process.cwd(), '.'),
      },
    },
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify('AIzaSyCPg3vNSexfASWeRwQfWkQBF7Uq_kAp-uY'),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify('gympulse-personal.firebaseapp.com'),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify('gympulse-personal'),
      'import.meta.env.VITE_FIREBASE_DATABASE_URL': JSON.stringify('https://gympulse-personal-default-rtdb.firebaseio.com'),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify('gympulse-personal.firebasestorage.app'),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify('1068724964920'),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify('1:1068724964920:web:d4fec7bbd3dbeceb07a0cd'),
      'import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID': JSON.stringify('ai-studio-driftparkgestode-2200359e-b3be-4b5e-9c71-5f960e94bb6b'),
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
