"""Extrae las tablas de un DOCX del informe a JSON: título, encabezado de sección y filas.
Uso: py -3 -I extraer_informe.py <docx> <salida.json>"""
import json
import sys
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

HEADINGS = ("H1_", "H2_", "H3_", "Heading", "Título")


def filas(tbl: Table):
    out = []
    for row in tbl.rows:
        # Celdas combinadas aparecen repetidas en row.cells: se quitan las contiguas iguales
        celdas, prev = [], object()
        for c in row.cells:
            if c._tc is prev:
                continue
            prev = c._tc
            celdas.append(c.text.strip())
        out.append(celdas)
    return out


def main(path, salida):
    doc = Document(path)
    tablas, encabezado, seccion = [], "", ""
    for child in doc.element.body:
        tag = child.tag.split("}")[-1]
        if tag == "p":
            p = Paragraph(child, doc)
            t = p.text.strip()
            if t and (p.style.name or "").startswith(HEADINGS):
                if p.style.name.startswith("H1_"):
                    seccion = t
                encabezado = t
        elif tag == "tbl":
            f = filas(Table(child, doc))
            tablas.append({
                "pos": len(tablas),
                "seccion": seccion,
                "encabezado": encabezado,
                "titulo": " | ".join(dict.fromkeys(x for x in (f[0] if f else []) if x)),
                "filas": f,
            })
    with open(salida, "w", encoding="utf-8") as fh:
        json.dump(tablas, fh, ensure_ascii=False, indent=1)
    print(f"{len(tablas)} tablas → {salida}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
