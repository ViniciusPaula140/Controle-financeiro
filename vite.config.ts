import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    TanStackRouterVite(),
    tailwindcss(),
  ],
  server: {
    port: 8080,
  },
  // O Render precisa disso para entender que é um app Node.js (SSR)
  // Caso o build continue falhando, adicione o preset 'node-server' abaixo:
  build: {
    outDir: 'dist',
  },
});