import { z } from 'zod';
import raw from './menu.json';
import rawMesas from './mesas.json';

const texto = z.object({ es: z.string().min(1), en: z.string().min(1) });
const slug = z.string().regex(/^[a-z0-9-]+$/);

/** Elección única y obligatoria que no cambia el precio (p. ej. sabor o proteína). */
export const Opciones = z.object({
  titulo: texto,
  valores: z.array(z.object({ id: slug, nombre: texto })).min(2),
});

export const Platillo = z.object({
  id: slug,
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
  /** Lo que trae (charolas). */
  incluye: z.array(texto).optional(),
  opciones: Opciones.optional(),
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
  /** Fecha del tipo de cambio (AAAA-MM-DD), para el aviso de referencia en USD. */
  tipoCambioFecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    /** Número para wa.me: código de país + número, solo dígitos. */
    whatsapp: z.string().regex(/^\d{11,13}$/),
    instagram: z.url(),
    facebook: z.url(),
    mapa: z.url(),
    pago: texto,
    horario: z.array(Horario),
  }),
  categorias: z.array(Categoria).min(1),
}).superRefine((m, ctx) => {
  // Mi lista guarda los platillos por id: deben ser únicos.
  const vistos = new Set<string>();
  for (const c of m.categorias) for (const p of c.platillos) {
    if (vistos.has(p.id)) ctx.addIssue({ code: 'custom', message: `Id de platillo repetido: ${p.id}` });
    vistos.add(p.id);
  }
});

export type Platillo = z.infer<typeof Platillo>;
export type Categoria = z.infer<typeof Categoria>;
export type Menu = z.infer<typeof Menu>;
export type Opciones = z.infer<typeof Opciones>;

/** Falla el build si el JSON no cumple el esquema. */
export const menu: Menu = Menu.parse(raw);

/* ── Plano de mesas (ilustrativo) y ubicación del local: src/data/mesas.json ── */
export const MesaPlano = z.object({
  /** Número de mesa (el mismo del QR ?src=qr-mesa-N). */
  n: z.number().int().min(1).max(99),
  /** Centro de la mesa en unidades del plano. */
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  forma: z.enum(['redonda', 'cuadrada', 'larga']),
  personas: z.union([z.literal(2), z.literal(4), z.literal(6)]),
  zona: texto,
});

export const Plano = z.object({
  ancho: z.number().positive(),
  alto: z.number().positive(),
  mesas: z.array(MesaPlano).min(1),
  /** Mesas ocupadas solo para la demostración. */
  ocupadasDemo: z.array(z.number().int().min(1).max(99)),
  restaurante: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), aproximada: z.boolean() }),
}).superRefine((p, ctx) => {
  const nums = new Set<number>();
  for (const m of p.mesas) {
    if (nums.has(m.n)) ctx.addIssue({ code: 'custom', message: `Mesa repetida: ${m.n}` });
    nums.add(m.n);
    if (m.x >= p.ancho || m.y >= p.alto) ctx.addIssue({ code: 'custom', message: `Mesa ${m.n} fuera del plano` });
  }
  for (const n of p.ocupadasDemo) if (!nums.has(n)) ctx.addIssue({ code: 'custom', message: `Mesa ocupada que no está en el plano: ${n}` });
});

export type Plano = z.infer<typeof Plano>;

/** Falla el build si el plano no cumple el esquema. */
export const plano: Plano = Plano.parse(rawMesas);
