// Ilustraciones de línea (trazo dorado) para los productos que todavía no tienen foto.
// Se usan como <img src="data:..."> para que puedan "volar" igual que una foto.

const trazo = (cuerpo: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#D2B26A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;

const dibujos = {
  rollo: '<circle cx="32" cy="33" r="21"/><circle cx="32" cy="33" r="13.5"/><circle cx="32" cy="33" r="5.5"/><path d="M27 31.5l2 1.5M35.5 30l-1.8 2.2M33 37.5l-1-2.2"/><path d="M14 47c5 6 31 6 36 0" opacity=".5"/>',
  tazon: '<path d="M44 7 31 27M51 10 36 28"/><path d="M9 31h46a23 19 0 0 1-46 0z"/><path d="M23 50h18"/><path d="M17 31c3-5 8-6 11-3 3-4 9-4 12 0 3-3 8-2 10 3" opacity=".6"/>',
  tostada: '<circle cx="32" cy="35" r="21"/><path d="M19 32c4-6 9-7 13-3 4-5 10-5 14 1" /><circle cx="24" cy="38" r="2.6"/><circle cx="33" cy="41" r="2.6"/><circle cx="41" cy="36" r="2.6"/><path d="M28 24c2-4 6-5 8-4-1 3-4 5-8 4z"/>',
  arroz: '<path d="M9 33h46a23 18 0 0 1-46 0z"/><path d="M23 51h18"/><path d="M14 33c1-8 9-14 18-14s17 6 18 14"/><path d="M24 25h.01M31 22h.01M38 25h.01M28 29h.01M35 29h.01M42 30h.01M21 30h.01" stroke-width="2.6"/>',
  wok: '<path d="M7 31h40a20 15 0 0 1-40 0z"/><path d="M47 33h11"/><path d="M19 22c-2-3 2-5 0-8M27 21c-2-3 2-5 0-8M35 22c-2-3 2-5 0-8"/>',
  charola: '<ellipse cx="32" cy="40" rx="27" ry="12"/><circle cx="20" cy="36" r="5"/><circle cx="32" cy="33" r="5"/><circle cx="44" cy="36" r="5"/><circle cx="26" cy="43" r="5"/><circle cx="38" cy="43" r="5"/>',
  infantil: '<path d="M7 32c8-11 22-13 34-4l11-8v24l-11-8C29 45 15 43 7 32z"/><circle cx="19" cy="30" r="1.6"/><path d="M27 26c1 4 1 8 0 12"/>',
  postre: '<path d="M14 36h36l-5 16H19z"/><circle cx="32" cy="27" r="11"/><path d="M24 22c4 3 12 3 16 0" opacity=".6"/><path d="M38 14l4-6"/>',
  coctel: '<path d="M13 12h38L32 34z"/><path d="M32 34v19M22 53h20"/><circle cx="46" cy="12" r="6"/><path d="M42 14l8-4"/>',
  cerveza: '<path d="M28 5h8v9l4 8v33a3 3 0 0 1-3 3H27a3 3 0 0 1-3-3V22l4-8z"/><path d="M24 31h16v14H24z"/><path d="M28 5h8"/>',
  vaso: '<path d="M17 14h30l-4 42H21z"/><path d="M17 14h30" stroke-dasharray="1.5 2.5" stroke-width="3"/><path d="M19 30h26"/><path d="M42 9l-6 14" />',
  sake: '<path d="M22 6h8v8c5 4 7 9 7 15v24a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3V29c0-6 2-11 7-15z"/><path d="M41 40h12l-2 14H43z"/>',
  limonada: '<path d="M18 16h28l-3 40H21z"/><path d="M38 6l-4 20"/><circle cx="25" cy="34" r="6"/><path d="M25 28v12M19 34h12"/>',
  shot: '<path d="M14 22h16l-2 30H16z"/><path d="M34 22h16l-2 30H36z"/><path d="M15 32h14M35 32h14"/>',
  granizado: '<path d="M18 32h28l-4 24H22z"/><path d="M16 32c0-10 7-17 16-17s16 7 16 17"/><path d="M26 21l2 4M34 19l1 4M40 25l-2 3" opacity=".6"/>',
} as const;

type Dibujo = keyof typeof dibujos;
const porCategoria: Record<string, Dibujo> = {
  entradas: 'tazon',
  'tostadas-aguachiles': 'tostada',
  arroces: 'arroz',
  'rollos-naturales': 'rollo',
  'rollos-clasicos': 'rollo',
  'rollos-horneados': 'rollo',
  'rollos-empanizados': 'rollo',
  'rollos-especiales': 'rollo',
  guisos: 'wok',
  charolas: 'charola',
  kids: 'infantil',
  postres: 'postre',
  mixologia: 'coctel',
  cervezas: 'cerveza',
  'vasos-preparados': 'vaso',
  'bebidas-asiaticas': 'sake',
  'sin-alcohol': 'limonada',
  shots: 'shot',
  granizado: 'granizado',
};

/** URL data: del dibujo de la categoría (para <img>). */
export const iconoDe = (catId: string) => `data:image/svg+xml;utf8,${encodeURIComponent(trazo(dibujos[porCategoria[catId] ?? 'tazon']))}`;
