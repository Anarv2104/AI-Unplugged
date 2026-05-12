import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Dev/demo only: ngrok free domains rotate, so allow tunneled hosts while Vite proxies API calls locally.
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000'
    }
  }
});
