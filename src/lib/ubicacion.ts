// Ubicación de entrega (pedido a domicilio). Lógica pura, probada con vitest.

export type Coordenada = { lat: number; lng: number };

/** Coordenada real (números finitos dentro de rango). */
export const coordValida = (c: unknown): c is Coordenada => {
  const o = c as Partial<Coordenada> | null;
  return !!o && typeof o === 'object'
    && typeof o.lat === 'number' && Number.isFinite(o.lat) && Math.abs(o.lat) <= 90
    && typeof o.lng === 'number' && Number.isFinite(o.lng) && Math.abs(o.lng) <= 180;
};

/** Redondea a 6 decimales (≈ 11 cm): suficiente para el repartidor, sin ruido. */
export const redondear = (c: Coordenada): Coordenada => ({ lat: Number(c.lat.toFixed(6)), lng: Number(c.lng.toFixed(6)) });

/** Lo guardado convertido a coordenada válida (o null). */
export const sanearCoord = (c: unknown): Coordenada | null => (coordValida(c) ? redondear(c) : null);

/** Enlace de Google Maps que abre el punto exacto (lo que lee el repartidor en WhatsApp). */
export const enlaceUbicacion = (c: Coordenada) => `https://maps.google.com/?q=${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;

/** Distancia en km entre dos puntos (haversine). */
export function distanciaKm(a: Coordenada, b: Coordenada): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** El punto queda fuera de la zona razonable de entrega (para avisar, no para bloquear). */
export const lejos = (c: Coordenada, centro: Coordenada, km = 25) => distanciaKm(c, centro) > km;
