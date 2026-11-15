import type { APIRoute } from 'astro';

// Mientras sea demo (PUBLIC_INDEXAR distinto de "true") se pide no rastrear.
export const GET: APIRoute = ({ site }) => {
  const indexar = import.meta.env.PUBLIC_INDEXAR === 'true';
  const mapa = new URL('/sitemap.xml', site ?? 'http://localhost:4321/').href;
  const cuerpo = indexar ? `User-agent: *\nAllow: /\nDisallow: /offline\n\nSitemap: ${mapa}\n` : 'User-agent: *\nDisallow: /\n';
  return new Response(cuerpo, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
