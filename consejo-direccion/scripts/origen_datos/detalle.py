"""Resume un cruce fila a fila: para cada fila del informe, de qué hoja y fila de origen salen sus cifras.
Uso: py -3 -P detalle.py <cruce.json> [pos1,pos2,...]"""
import json
import sys
from collections import Counter

res = json.load(open(sys.argv[1], encoding="utf-8"))
filtro = set(int(x) for x in sys.argv[2].split(",")) if len(sys.argv) > 2 else None
for t in res:
    if filtro and t["pos"] not in filtro:
        continue
    print(f"\n##### [{t['pos']}] {t['titulo'][:70]}  ({t['casadas']}/{t['numericas']})  · {t['encabezado'][:50]}")
    for f in t["filas"]:
        num = [c for c in f["celdas"] if not c["trivial"]]
        if not f["celdas"]:
            continue
        orig = Counter()
        for c in f["celdas"]:
            # una celda puede casar en varios sitios: cuenta cada (hoja, fila, col) una vez
            for o in {(o["hoja"], (o["fila"] or "")[:34], (o["col"] or "")[:26], "×100" if o["x100"] else "") for o in c["origen"]}:
                orig[o] += 1
        casadas = sum(1 for c in f["celdas"] if c["origen"])
        top = "; ".join(f"{h}·{fl}·{cl}{x}({n})" for (h, fl, cl, x), n in orig.most_common(3))
        print(f"  {f['etiqueta'][:30]:<30} {casadas:>2}/{len(f['celdas']):<2} {top}")
