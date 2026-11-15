import type { APIRoute } from 'astro';
import { menu } from '../data/schema';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('http://localhost:4321/');
  const url = (p: string) => new URL(p, base).href;
  const alt = `<xhtml:link rel="alternate" hreflang="es-MX" href="${url('/')}"/><xhtml:link rel="alternate" hreflang="en" href="${url('/en/')}"/>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url><loc>${url('/')}</loc><lastmod>${menu.actualizado}</lastmod>${alt}</url>
  <url><loc>${url('/en/')}</loc><lastmod>${menu.actualizado}</lastmod>${alt}</url>
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
