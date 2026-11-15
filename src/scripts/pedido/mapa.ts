// Mapa de entrega (solo "A domicilio"). Leaflet se carga con import dinámico la
// primera vez que se necesita, así no pesa en la carga del menú.
// Teselas oscuras de CARTO con atribución © OpenStreetMap © CARTO.
// En pantallas táctiles el mapa no se arrastra con un dedo (el panel sigue haciendo
// scroll): el pin dorado sí se arrastra y un toque en el mapa lo mueve ahí.
import type { Coordenada } from '../../lib/ubicacion';

export type Mapa = {
  mover(c: Coordenada, acercar?: boolean): void;
  ajustar(): void;
  quitar(): void;
};

const PIN = '<span class="pd-pin"><svg viewBox="0 0 32 42" width="32" height="42" aria-hidden="true"><path d="M16 1C8 1 2 7 2 15c0 10 14 25 14 25s14-15 14-25C30 7 24 1 16 1z" fill="#d2b26a" stroke="#050505" stroke-width="2"/><circle cx="16" cy="15" r="5.5" fill="#050505"/></svg></span><span class="pd-pin-sombra"></span>';
const LOCAL = '<span class="pd-local"><img src="/brand/isotipo.svg" alt="" width="22" height="22"></span>';

export async function crearMapa(el: HTMLElement, o: {
  centro: Coordenada; inicial: Coordenada | null; etiquetas: { pin: string; local: string };
  alMover: (c: Coordenada) => void; alFallarTeselas: () => void;
}): Promise<Mapa> {
  const [mod] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
  const L = (mod as unknown as { default?: typeof import('leaflet') }).default ?? (mod as unknown as typeof import('leaflet'));
  el.replaceChildren();
  const tactil = matchMedia('(pointer: coarse)').matches;
  const mapa = L.map(el, {
    center: [o.centro.lat, o.centro.lng],
    zoom: 15,
    dragging: !tactil,
    scrollWheelZoom: false,
    touchZoom: true,
    zoomControl: true,
    attributionControl: true,
  });
  mapa.attributionControl.setPrefix(false);
  let avisado = false;
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
  }).on('tileerror', () => { if (!avisado) { avisado = true; o.alFallarTeselas(); } }).addTo(mapa);

  L.marker([o.centro.lat, o.centro.lng], {
    icon: L.divIcon({ html: LOCAL, className: 'pd-icono-local', iconSize: [34, 34], iconAnchor: [17, 17] }),
    keyboard: false, interactive: false, title: o.etiquetas.local,
  }).addTo(mapa);

  // El pin aparece cuando el cliente toca el mapa o usa su ubicación (no se confunde con el local).
  const inicio = o.inicial ?? o.centro;
  const pin = L.marker([inicio.lat, inicio.lng], {
    draggable: true, autoPan: true, keyboard: true, title: o.etiquetas.pin, alt: o.etiquetas.pin,
    icon: L.divIcon({ html: PIN, className: 'pd-icono-pin', iconSize: [32, 42], iconAnchor: [16, 41] }),
  });
  const poner = () => { if (!mapa.hasLayer(pin)) pin.addTo(mapa); };
  if (o.inicial) { poner(); mapa.setView([o.inicial.lat, o.inicial.lng], 17); }

  const soltar = () => {
    const e = pin.getElement()?.querySelector<HTMLElement>('.pd-pin');
    if (!e) return;
    e.classList.remove('cae'); void e.offsetWidth; e.classList.add('cae');
  };
  const avisar = () => { const p = pin.getLatLng(); o.alMover({ lat: p.lat, lng: p.lng }); };
  pin.on('dragstart', () => pin.getElement()?.classList.add('arrastrando'));
  pin.on('dragend', () => { pin.getElement()?.classList.remove('arrastrando'); soltar(); avisar(); });
  mapa.on('click', (e: { latlng: { lat: number; lng: number } }) => { pin.setLatLng(e.latlng); poner(); soltar(); avisar(); });

  return {
    mover(c, acercar = false) {
      pin.setLatLng([c.lat, c.lng]);
      poner();
      if (acercar) mapa.setView([c.lat, c.lng], 17, { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
      else mapa.panTo([c.lat, c.lng]);
      soltar();
    },
    ajustar() { mapa.invalidateSize(); },
    quitar() { pin.remove(); mapa.panTo([o.centro.lat, o.centro.lng]); },
  };
}
