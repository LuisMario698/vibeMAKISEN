// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// URL pública del sitio (canonical, hreflang, Open Graph, sitemap).
// En Cloudflare se define como variable de build SITE_URL.
const site = process.env.SITE_URL || 'https://vibemakisen.luismario698g.workers.dev';

export default defineConfig({
  site,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  vite: { plugins: [tailwindcss()] },
});
