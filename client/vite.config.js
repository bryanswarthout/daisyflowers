import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: false, // Disable websockets which can cause issues
        timeout: 0, // No timeout
        proxyTimeout: 0, // No proxy timeout
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err.message);
            console.log('Request URL:', req.url);
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Proxy connection failed', details: err.message }));
            }
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('🔄 Proxying:', req.method, req.url);
            // Set no timeout on the proxy request
            proxyReq.setTimeout(0);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('✅ Proxy response:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})
