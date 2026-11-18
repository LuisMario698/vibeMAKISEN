// Modo presentación: antes de que el menú lea su estado, las claves del pedido pasan a
// memoria (src/lib/demo-almacen.ts). Así la demostración usa los módulos reales de la app
// (lista.ts guarda y lee como siempre) sin tocar el carrito ni el seguimiento verdaderos.
// Nada que restaurar: al salir se recarga la página sin ?demo y todo se lee de nuevo.
import { crearMemoria, esClaveAislada, type Memoria } from '../lib/demo-almacen';

export function aislarAlmacen() {
  const proto = Storage.prototype;
  const { getItem, setItem, removeItem } = proto;
  const memorias = new Map<Storage, Memoria>();
  const de = (s: Storage) => {
    let m = memorias.get(s);
    if (!m) { m = crearMemoria(); memorias.set(s, m); }
    return m;
  };
  proto.getItem = function (this: Storage, k: string) { return esClaveAislada(k) ? de(this).getItem(k) : getItem.call(this, k); };
  proto.setItem = function (this: Storage, k: string, v: string) { if (esClaveAislada(k)) de(this).setItem(k, v); else setItem.call(this, k, v); };
  proto.removeItem = function (this: Storage, k: string) { if (esClaveAislada(k)) de(this).removeItem(k); else removeItem.call(this, k); };
}
