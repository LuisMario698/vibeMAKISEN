// Utilidades de texto compartidas por el servidor y el navegador.

const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para interpolarlo dentro de HTML (contenido o atributos entre comillas). */
export const escapar = (s: string | number) => String(s).replace(/[&<>"']/g, (c) => ENT[c]!);

/** Minúsculas y sin acentos, para buscar ("Camarón" → "camaron"). */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** JSON seguro para incrustar en <script type="application/json"> o JSON-LD. */
const LS = new RegExp(String.fromCharCode(0x2028), 'g');
const PS = new RegExp(String.fromCharCode(0x2029), 'g');
export const jsonSeguro = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(LS, '\\u2028').replace(PS, '\\u2029');
