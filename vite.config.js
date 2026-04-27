import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'favicon-16x16.png', 'favicon-32x32.png'],
      manifest: {
        name: 'Janta Trembolona',
        short_name: 'Janta',
        description: 'Gerenciador de Jantas do Grupo',
        theme_color: '#2842B5',
        background_color: '#0e0e20',
        display: 'standalone',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/favicon-32x32.png',
            sizes: '32x32',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      }
    })
  ],
})
