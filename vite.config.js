import { defineConfig } from 'vite';

export default defineConfig({
  base: '/lyrics/',
  server: { port: 5173, open: true },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  }
});