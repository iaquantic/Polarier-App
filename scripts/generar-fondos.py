# Genera los fondos de la app (mosaico SVG sin costuras de iconos de lavanderia).
# Uso: python scripts/generar-fondos.py public/backgrounds
import math, random, sys, os

TILE = 640

# Iconos en rejilla 24x24. "F" = color del icono, "B" = color de fondo (recortes de detalle).
ICONS = {
 "camiseta": '<path fill="F" d="M8 3 4.2 4.8 1.8 9.2l3.4 2 1-1V21h11.6V10.2l1 1 3.4-2-2.4-4.4L16 3c-.8 1.6-2.2 2.4-4 2.4S8.8 4.6 8 3z"/>',
 "lavadora": '<rect fill="F" x="4" y="2" width="16" height="20" rx="2.4"/><circle cx="12" cy="13.5" r="4.6" fill="none" stroke="B" stroke-width="1.6"/><path d="M9.6 14.4c1.4-1 3.4 1 4.8 0" fill="none" stroke="B" stroke-width="1.3" stroke-linecap="round"/><circle cx="7.2" cy="5.2" r="1" fill="B"/><circle cx="10" cy="5.2" r="1" fill="B"/><path d="M13.5 5.2h3.4" stroke="B" stroke-width="1.4" stroke-linecap="round"/>',
 "botella": '<rect fill="F" x="9.2" y="1.6" width="5.6" height="3.4" rx=".8"/><path fill="F" d="M8 5.8h8l2 3.2v10.6a2.4 2.4 0 0 1-2.4 2.4H8.4A2.4 2.4 0 0 1 6 19.6V9z"/><rect x="8.8" y="11.4" width="6.4" height="6" rx="1.2" fill="none" stroke="B" stroke-width="1.4"/>',
 "percha": '<path d="M10 6.2a2 2 0 1 1 2.8 1.8c-.6.3-.8.8-.8 1.4v1.4L2.6 17.4c-.6.4-.3 1.4.4 1.4h18c.7 0 1-.9.4-1.4L12 10.8" fill="none" stroke="F" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
 "cesta": '<rect fill="F" x="2.6" y="8.4" width="18.8" height="3.4" rx="1.4"/><path fill="F" d="M4.6 12.4h14.8l-1.6 8.2a1.6 1.6 0 0 1-1.6 1.3H7.8a1.6 1.6 0 0 1-1.6-1.3z"/><path d="M9.2 14v6M12 14v6M14.8 14v6M6 17h12" stroke="B" stroke-width="1.2" stroke-linecap="round"/><path d="M7 8.4 10 3.6M17 8.4 14 3.6" stroke="F" stroke-width="1.8" stroke-linecap="round"/>',
 "calcetin": '<path fill="F" d="M7.6 2h7v9.6l3.6 3.4a3.4 3.4 0 0 1-4.6 5L7.6 14.6z"/><path d="M7.6 5.4h7" stroke="B" stroke-width="1.4"/>',
 "toallas": '<rect fill="F" x="3" y="4" width="18" height="4.6" rx="2.3"/><rect fill="F" x="3" y="9.7" width="18" height="4.6" rx="2.3"/><rect fill="F" x="3" y="15.4" width="18" height="4.6" rx="2.3"/>',
 "gota": '<path fill="F" d="M12 2.2S5.4 9.8 5.4 14.6a6.6 6.6 0 0 0 13.2 0C18.6 9.8 12 2.2 12 2.2z"/><path d="M9 15.2a3 3 0 0 0 2.4 3" fill="none" stroke="B" stroke-width="1.3" stroke-linecap="round"/>',
 "spray": '<path fill="F" d="M8.4 9h6.2l1.6 3v8.4a1.6 1.6 0 0 1-1.6 1.6H8.4a1.6 1.6 0 0 1-1.6-1.6V12z"/><path fill="F" d="M9.4 4.4h5.8l2.6 2.2-2.6.8v1.6H9.4z"/><path d="M18.6 4.2h1.4M18.6 6.6h2M18.6 9h1.4" stroke="F" stroke-width="1.3" stroke-linecap="round"/>',
 "flor": '<circle fill="F" cx="12" cy="7.4" r="4"/><circle fill="F" cx="16.6" cy="12" r="4"/><circle fill="F" cx="12" cy="16.6" r="4"/><circle fill="F" cx="7.4" cy="12" r="4"/><circle fill="B" cx="12" cy="12" r="1.6"/>',
}
SPARK = '<path fill="F" d="M12 1.5c.9 6.4 4.1 9.6 10.5 10.5-6.4.9-9.6 4.1-10.5 10.5C11.1 16.1 7.9 12.9 1.5 12 7.9 11.1 11.1 7.9 12 1.5z"/>'
RING = '<circle cx="12" cy="12" r="8.5" fill="none" stroke="F" stroke-width="2.6"/>'
DOT = '<circle cx="12" cy="12" r="7" fill="F"/>'

def torus_dist(a, b):
    dx = abs(a[0]-b[0]); dy = abs(a[1]-b[1])
    dx = min(dx, TILE-dx); dy = min(dy, TILE-dy)
    return math.hypot(dx, dy)

def place(rng):
    items = []
    names = list(ICONS)
    # iconos grandes: muestreo con distancia mínima en un toro
    tries = 0
    k = 0
    while tries < 6000:
        tries += 1
        p = (rng.uniform(0, TILE), rng.uniform(0, TILE))
        if all(torus_dist(p, q[0]) > 74 for q in items):
            items.append((p, names[k % len(names)], rng.uniform(38, 50), rng.uniform(-28, 28), "big"))
            k += 1
    rng.shuffle(items)
    smalls = []
    tries = 0
    while tries < 8000:
        tries += 1
        p = (rng.uniform(0, TILE), rng.uniform(0, TILE))
        if all(torus_dist(p, q[0]) > 50 for q in items) and all(torus_dist(p, q[0]) > 44 for q in smalls):
            r = rng.random()
            kind = "spark" if r < 0.55 else ("dot" if r < 0.85 else "ring")
            size = {"spark": rng.uniform(10, 20), "dot": rng.uniform(4, 6), "ring": rng.uniform(13, 17)}[kind]
            smalls.append((p, kind, size, rng.uniform(-15, 15), "small"))
    return items + smalls

def render(items, base, fg, opacity):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{TILE}" height="{TILE}" viewBox="0 0 {TILE} {TILE}">',
           f'<rect width="{TILE}" height="{TILE}" fill="{base}"/>', f'<g opacity="{opacity}">']
    for (x, y), name, size, rot, _ in items:
        body = ICONS.get(name) or {"spark": SPARK, "ring": RING, "dot": DOT}[name]
        body = body.replace('"F"', f'"{fg}"').replace('"B"', f'"{base}"')
        s = size / 24
        for dx in (-TILE, 0, TILE):
            for dy in (-TILE, 0, TILE):
                cx, cy = x + dx, y + dy
                if -size < cx < TILE + size and -size < cy < TILE + size:
                    out.append(f'<g transform="translate({cx:.1f} {cy:.1f}) rotate({rot:.1f}) scale({s:.3f}) translate(-12 -12)">{body}</g>')
    out.append('</g></svg>')
    return "\n".join(out)

if __name__ == "__main__":
    outdir = sys.argv[1]
    items = place(random.Random(7))
    themes = {
        # Amarillo de la imagen original (≈ #FDD22A) con menos saturación.
        "fondo-claro.svg": ("#F0D274", "#FBEDBE", 0.8),
        # Azul de la imagen original (≈ #1F45D6) llevado hacia el marino Polarier.
        "fondo-oscuro.svg": ("#23347C", "#4256A6", 0.6),
    }
    for fname, (base, fg, op) in themes.items():
        with open(os.path.join(outdir, fname), "w", encoding="utf-8") as f:
            f.write(render(items, base, fg, op))
    print("iconos:", sum(1 for i in items if i[4] == "big"), "detalles:", sum(1 for i in items if i[4] == "small"))
