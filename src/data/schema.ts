import { z } from 'zod';
import raw from './menu.json';

const texto = z.object({ es: z.string().min(1), en: z.string().min(1) });

export const Platillo = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  nombre: texto,
  descripcion: texto.optional(),
  /** MXN con IVA incluido */
  precio: z.number().int().positive(),
  gramos: z.number().int().positive().optional(),
  /** Nombre del archivo en /public/menu sin extensión */
  foto: z.string().optional(),
  /** 0 = nada, 3 = muy picante (inferido de la descripción, validar con cocina) */
  picante: z.number().int().min(0).max(3).default(0),
  crudo: z.boolean().default(false),
  preparacion: z.enum(['natural', 'empanizado', 'horneado', 'capeado']).optional(),
  etiquetas: z.array(z.enum(['favorito', 'nuevo'])).default([]),
  agotado: z.boolean().default(false),
  /** Estado puesto solo para la demostración */
  demo: z.boolean().default(false),
  incluye: z.array(z.string()).optional(),
});

export const Categoria = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  grupo: z.enum(['comida', 'bebidas']),
  nombre: texto,
  nota: texto.optional(),
  platillos: z.array(Platillo).min(1),
});

export const Horario = z.object({
  /** 0 = domingo … 6 = sábado */
  dia: z.number().int().min(0).max(6),
  abre: z.string().regex(/^\d{2}:\d{2}$/),
  cierra: z.string().regex(/^\d{2}:\d{2}$/),
});

export const Menu = z.object({
  actualizado: z.string(),
  tipoCambioReferencia: z.number().positive(),
  negocio: z.object({
    nombre: z.string(),
    subtitulo: z.string(),
    lema: texto,
    ciudad: z.string(),
    direccion: z.string(),
    telefono: z.string(),
    telefonoTexto: z.string(),
    telefonoFijo: z.string(),
    telefonoFijoTexto: z.string(),
    instagram: z.url(),
    facebook: z.url(),
    mapa: z.url(),
    pago: texto,
    horario: z.array(Horario),
  }),
  categorias: z.array(Categoria).min(1),
});

export type Platillo = z.infer<typeof Platillo>;
export type Categoria = z.infer<typeof Categoria>;
export type Menu = z.infer<typeof Menu>;

/** Falla el build si el JSON no cumple el esquema. */
export const menu: Menu = Menu.parse(raw);
