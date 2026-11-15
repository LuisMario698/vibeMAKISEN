// Mesa desde el QR: https://…/?src=qr-mesa-7 → 7. Solo mesas 1–99.

export function leerMesa(search: string): number | null {
  const v = new URLSearchParams(search).get('src') ?? '';
  const m = /^qr-mesa-(\d{1,2})$/.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 99 ? n : null;
}

/** La misma URL sin el parámetro src (para no heredar la mesa al compartir el enlace). */
export function sinMesa(href: string): string {
  const u = new URL(href);
  u.searchParams.delete('src');
  return u.pathname + (u.search ? u.search : '') + u.hash;
}
