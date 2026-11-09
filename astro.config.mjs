// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { AstroPWAIntegration } from '@vite-pwa/astro';

export default defineConfig({
  site: 'https://makizen.example',
  vite: { plugins: [tailwindcss()] },
  integrations: [
    AstroPWAIntegration({
      injectRegister: 'script-defer',
      // Los íconos ya entran por globPatterns; incluirlos de nuevo los duplica en el precache.
      includeManifestIcons: false,
      registerType: 'autoUpdate',
      manifest: {
        name: 'MAKIZEN Sushi & Mariscos · Menú',
        short_name: 'MAKIZEN',
        description: 'Menú digital de MAKIZEN Sushi & Mariscos, estilo Sinaloa, en Puerto Peñasco, Sonora.',
        lang: 'es-MX',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,css,js,woff2,webp,png,jpg,svg}'],
        // index.html se agrega al precache después del build (scripts/precache-html.mjs),
        // porque Astro escribe el HTML después de que se genera el service worker.
        navigateFallback: null,
      },
    }),
  ],
});
