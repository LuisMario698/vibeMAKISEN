#!/usr/bin/env python3
"""Extrae la paleta dominante de imágenes de la marca (logo, posts, fachada).

Uso:
    pip3 install pillow
    python3 scripts/extraer_paleta.py public/brand/logo.png public/brand/posts/*.jpg
    python3 scripts/extraer_paleta.py --colores 8 public/brand/logo.png

Imprime una tabla en Markdown por imagen y una paleta combinada, con el
porcentaje de área de cada color y su contraste contra blanco y negro
(WCAG). Pega el resultado en docs/marca-actual.md y elige los roles
(fondo, primario, acento, texto) a partir de ahí.
"""
import argparse
import sys
from collections import Counter

try:
    from PIL import Image
except ImportError:
    sys.exit("Falta Pillow. Instálalo con: pip3 install pillow")


def luminancia(rgb):
    def canal(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (canal(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    la, lb = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def hex_de(rgb):
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def datos(img):
    leer = getattr(img, "get_flattened_data", None) or img.getdata
    return list(leer())


def paleta(ruta, n):
    img = Image.open(ruta).convert("RGBA")
    img.thumbnail((400, 400))
    # Ignora píxeles transparentes (logos en PNG).
    pixeles = [p[:3] for p in datos(img) if p[3] > 200]
    if not pixeles:
        return Counter()
    plano = Image.new("RGB", (len(pixeles), 1))
    plano.putdata(pixeles)
    q = plano.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    conteo = Counter(datos(q))
    return Counter({tuple(pal[i * 3:i * 3 + 3]): c for i, c in conteo.items()})


def tabla(titulo, conteo, n):
    total = sum(conteo.values()) or 1
    print(f"\n### {titulo}\n")
    print("| Color | HEX | Área | Contraste vs blanco | Contraste vs negro |")
    print("|---|---|---|---|---|")
    for rgb, c in conteo.most_common(n):
        cb = contraste(rgb, (255, 255, 255))
        cn = contraste(rgb, (0, 0, 0))
        print(f"| ■ | `{hex_de(rgb)}` | {c / total:.0%} | {cb:.1f}:1{' AA' if cb >= 4.5 else ''} | {cn:.1f}:1{' AA' if cn >= 4.5 else ''} |")


def main():
    ap = argparse.ArgumentParser(description="Extrae la paleta dominante de imágenes de la marca.")
    ap.add_argument("imagenes", nargs="+")
    ap.add_argument("--colores", type=int, default=6)
    args = ap.parse_args()
    grupos = []  # [suma_r, suma_g, suma_b, peso]
    for ruta in args.imagenes:
        conteo = paleta(ruta, args.colores)
        tabla(ruta, conteo, args.colores)
        total = sum(conteo.values()) or 1
        for rgb, c in conteo.items():
            w = c / total
            # Agrupa colores casi iguales (distancia < 28) para la paleta combinada.
            for g in grupos:
                centro = tuple(v / g[3] for v in g[:3])
                if sum((a - b) ** 2 for a, b in zip(rgb, centro)) ** 0.5 < 28:
                    g[0] += rgb[0] * w; g[1] += rgb[1] * w; g[2] += rgb[2] * w; g[3] += w
                    break
            else:
                grupos.append([rgb[0] * w, rgb[1] * w, rgb[2] * w, w])
    if len(args.imagenes) > 1:
        combinado = Counter({tuple(round(v / g[3]) for v in g[:3]): g[3] * 1000 for g in grupos})
        tabla("Paleta combinada (peso promedio por imagen)", combinado, args.colores + 2)


if __name__ == "__main__":
    main()
