// Datos estructurados schema.org (Restaurant → Menu → MenuSection → MenuItem),
// generados desde el mismo menu.json que pinta la página.
import type { Menu } from '../data/schema';

const DIA_SCHEMA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function jsonLd(menu: Menu, sitio: string, idioma: 'es' | 'en') {
  const n = menu.negocio;
  const url = new URL(idioma === 'en' ? '/en/' : '/', sitio).href;
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: `${n.nombre} ${n.subtitulo}`,
    description: n.lema[idioma],
    url,
    telephone: n.telefono,
    servesCuisine: ['Sushi', idioma === 'en' ? 'Seafood' : 'Mariscos', idioma === 'en' ? 'Sinaloa-style' : 'Estilo Sinaloa'],
    priceRange: '$$',
    currenciesAccepted: 'MXN',
    paymentAccepted: idioma === 'en' ? 'Cash, Credit Card' : 'Efectivo, Tarjeta',
    image: new URL('/og/makizen.jpg', sitio).href,
    address: {
      '@type': 'PostalAddress',
      streetAddress: n.direccion,
      addressLocality: 'Puerto Peñasco',
      addressRegion: 'Sonora',
      addressCountry: 'MX',
    },
    sameAs: [n.instagram, n.facebook],
    hasMap: n.mapa,
    openingHoursSpecification: n.horario.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DIA_SCHEMA[h.dia], opens: h.abre, closes: h.cierra })),
    hasMenu: {
      '@type': 'Menu',
      inLanguage: idioma === 'en' ? 'en' : 'es-MX',
      hasMenuSection: menu.categorias.map((c) => ({
        '@type': 'MenuSection',
        name: c.nombre[idioma],
        hasMenuItem: c.platillos.map((p) => ({
          '@type': 'MenuItem',
          name: p.nombre[idioma],
          ...(p.descripcion ? { description: p.descripcion[idioma] } : {}),
          offers: { '@type': 'Offer', price: String(p.precio), priceCurrency: 'MXN', availability: p.agotado ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock' },
        })),
      })),
    },
  };
}
