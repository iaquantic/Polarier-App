"""
Tablas de lencería del informe a partir de la lencería del CD (tabla `cd_lenceria`).

Las respuestas al formulario sobre la TABLA CA (2026-10-28) dicen que la
lencería sale del CD de cada polo, y las hojas auxiliares de la TABLA CA no
guardan histórico. El extractor vps/Polarier/Leslie/CD/cd_lenceria.py la guarda
por mes en Supabase al subir cada CD, y n8n se la pasa a preparar_consejo.py
(--lenceria). Diseño en vault/Informe-Consejo-Lenceria-CD.md.

Reglas:
  - un polo sin filas en el período no lavó (P31): sus cantidades van a 0 («-»);
  - un bloque «vacio» o «no_encontrado» en el CD sale «—», con aviso;
  - trimestre: cantidades y desmanche se suman; las montas se promedian;
  - las filas de kg y % sobre la producción quedan en blanco hasta tener el peso
    de cada prenda (P3, P7), y la pérdida económica de los faltantes también (P11);
  - la columna del año anterior sale del CD del mismo período del año anterior;
    si no está cargado, en blanco con aviso.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from formato_excel import formatear
from tablas_informe import Bloque, Periodo, Relleno, celdas, clave_polo, filas, norm, rellenar, texto_celda

POLOS = [("HA", "habana", "Habana"), ("VA", "varadero", "Varadero"), ("CA", "caibarien", "Caibarién"),
         ("CC", "cayo_coco", "Cayo Coco"), ("CX", "cayo_cruz", "Cayo Cruz"), ("HO", "holguin", "Holguín")]
NOMBRE = {k: n for k, _, n in POLOS}
PRENDAS = ["sabana_personal", "sabana_king", "funda", "toalla_alfombra", "toalla_bano",
           "toalla_cara", "toalla_facial", "toalla_bidet", "toalla_piscina"]
SIN_DATO = "—"
CERRADO = "cerrado"
FMT_ENTERO = '#,##0;-#,##0;"-"'
FMT_INDICE = "0.00"
FMT_PCT = "0%"
AVISO_PESOS = "kg y % sobre la producción en blanco: falta el peso de cada prenda (P3, P7)"


def prenda_de(rotulo: str) -> Optional[str]:
    """Rótulo de fila → prenda («Sábanas Personales», «Toalla Baño»…). Igual que el extractor."""
    t = norm(rotulo)
    reglas = [(r"^sabanas? personal", "sabana_personal"), (r"^sabanas? king", "sabana_king"),
              (r"^fundas?\b", "funda"), (r"^(toallas? )?alfombra", "toalla_alfombra"),
              (r"^toallas? (de )?(bano|cuerpo)", "toalla_bano"),
              (r"^toallas? (de )?(cara|mano)", "toalla_cara"),
              (r"^toallas? facial", "toalla_facial"), (r"^toallas? bidet", "toalla_bidet"),
              (r"^toallas? (de )?piscina", "toalla_piscina")]
    for patron, clave in reglas:
        if re.search(patron, t):
            return clave
    return None


class Lenceria:
    """Las filas de `cd_lenceria` que n8n pasa a preparar, indexadas."""

    def __init__(self, filas_json: List[dict]):
        self.n = len(filas_json)
        self.idx = {(int(f["anio"]), int(f["mes"]), f["polo"], f["bloque"]): f for f in filas_json}

    def datos(self, anio: int, meses: List[int], bloque: str, medida: str, modo: str, avisar: bool = True):
        """
        Por polo: {prenda: valor} sumando o promediando los meses; None si el CD lo trae
        sin rellenar; CERRADO si no hay ninguna fila (no lavó, o no hay CD de ese año).
        Devuelve también los avisos.
        """
        out, avisos = {}, []
        for k, polo, nombre in POLOS:
            presentes = [(m, self.idx.get((anio, m, polo, bloque))) for m in meses]
            presentes = [(m, f) for m, f in presentes if f]
            if not presentes:
                out[k] = CERRADO
                continue
            ok = [f for _, f in presentes if f["estado"] == "ok"]
            malos = [m for m, f in presentes if f["estado"] != "ok"]
            if malos and avisar:
                avisos.append(f"{nombre}: el CD trae «{bloque.replace('_', ' ')}» sin rellenar"
                              + (f" (mes {', '.join(map(str, malos))})" if len(meses) > 1 else ""))
            if not ok:
                out[k] = None
                continue
            valores = {}
            for p in PRENDAS:
                vals = [(f.get("valores") or {}).get(p, {}).get(medida) for f in ok]
                vals = [v for v in vals if isinstance(v, (int, float))]
                valores[p] = None if not vals else (sum(vals) if modo == "suma" else sum(vals) / len(vals))
            out[k] = valores
        return out, avisos


def _celda(v, fmt: str) -> str:
    if v is CERRADO:
        return formatear(0, FMT_ENTERO) if fmt == FMT_ENTERO else ""
    if v is None:
        return SIN_DATO
    return formatear(v, fmt)


def _suma(vals):
    nums = [v for v in vals if isinstance(v, (int, float))]
    return sum(nums) if nums else None


def _media(vals):
    nums = [v for v in vals if isinstance(v, (int, float))]
    return sum(nums) / len(nums) if nums else None


def _polo_valor(d, k, p):
    v = d.get(k)
    if v is CERRADO:
        return CERRADO
    if v is None:
        return None
    return v.get(p)


def _sin_lenceria(fu) -> "Lenceria":
    lenc = getattr(fu, "lenceria", None)
    if lenc is None:
        raise ValueError("falta la lencería del CD (--lenceria)")
    return lenc


def _cabecera(per: Periodo) -> List[str]:
    return ["Lencería"] + [NOMBRE[k] for k, _, _ in POLOS] + ["TOTAL", "PROMEDIO", f"ANTERIOR {per.anio - 1}"]


def _polos_columna(proto, fila: int) -> List[str]:
    return [k for k in (clave_polo(texto_celda(tc)) for tc in celdas(filas(proto)[fila])) if k in NOMBRE]


def tabla_por_prendas(fu, per: Periodo, proto, anio_proto: int, bloque: str, medida: str, *,
                      modo: str = "suma", fmt: str = FMT_ENTERO, fila_cab: int = 1,
                      filas_cabecera: int = 2) -> Relleno:
    """Prendas en filas y polos en columnas, con TOTAL (o PROMEDIO) y el año anterior."""
    lenc = _sin_lenceria(fu)
    actual, avisos = lenc.datos(per.anio, per.meses, bloque, medida, modo)
    anterior, _ = lenc.datos(per.anio - 1, per.meses, bloque, medida, modo, avisar=False)
    en_proto = _polos_columna(proto, fila_cab) if fila_cab is not None else [k for k, _, _ in POLOS]
    agregar = _suma if modo == "suma" else _media
    hay_anterior = any(v not in (CERRADO, None) for v in anterior.values())
    if not hay_anterior:
        avisos.append(f"sin CD de {per.nombre.lower()} de {per.anio - 1}: la columna del año anterior va en blanco")

    def valores_fila(p_list: List[str]):
        """Celdas de una fila: una prenda, o todas las del prototipo para la fila TOTAL."""
        por_polo = {}
        for k, _, _ in POLOS:
            d = actual.get(k)
            if d is CERRADO or d is None:
                por_polo[k] = d
                continue
            nums = [d.get(p) for p in p_list if isinstance(d.get(p), (int, float))]
            # en un bloque rellenado, una prenda en blanco es un cero; «—» es solo para el bloque vacío
            por_polo[k] = agregar(nums) if nums else (0 if modo == "suma" else None)
        fila = [_celda(por_polo[k], fmt) for k, _, _ in POLOS]
        # TOTAL: todos los polos (los cerrados suman 0); PROMEDIO: los polos del prototipo con dato
        base = en_proto if modo != "suma" else [k for k, _, _ in POLOS]
        nums = [por_polo[k] for k in base if isinstance(por_polo[k], (int, float))]
        total = agregar(nums) if nums else (0 if modo == "suma" else None)
        ant = None
        if hay_anterior:
            vals = []
            for k, _, _ in POLOS:
                d = anterior.get(k)
                if isinstance(d, dict):
                    vals += [d.get(p) for p in p_list if isinstance(d.get(p), (int, float))]
            ant = agregar(vals) if vals else (0 if modo == "suma" else None)
        return fila + [_celda(total, fmt), _celda(total, fmt), "" if ant is None else _celda(ant, fmt)]

    filas_b = []
    kg_vacio = False
    for tr in filas(proto)[filas_cabecera:]:
        tcs = celdas(tr)
        rot = texto_celda(tcs[0]) if tcs else ""
        t = norm(rot)
        p = prenda_de(rot)
        if p:
            filas_b.append([rot] + valores_fila([p]))
        elif "(kg)" in t or "%" in t or "/prod" in t.replace(" ", ""):
            filas_b.append([rot] + [""] * (len(POLOS) + 3))
            kg_vacio = True
        elif t.startswith("total"):
            prendas_proto = [prenda_de(texto_celda(celdas(x)[0])) for x in filas(proto)[filas_cabecera:]]
            filas_b.append([rot] + valores_fila([x for x in prendas_proto if x]))
        else:
            filas_b.append([rot] + [""] * (len(POLOS) + 3))
    if kg_vacio:
        avisos.append(AVISO_PESOS)
    b = Bloque(f"CD › lencería › {bloque}", _cabecera(per), filas_b, avisos=avisos)
    return rellenar(proto, b, per, anio_proto, filas_cabecera=filas_cabecera)


def por_prendas(bloque: str, medida: str, **kw):
    def construir(fu, per: Periodo, protos, anio_proto) -> List[Relleno]:
        return [tabla_por_prendas(fu, per, protos[0], anio_proto, bloque, medida, **kw)]
    return construir


def inyecciones(fu, per: Periodo, protos, anio_proto) -> List[Relleno]:
    """Partida en dos tablas de Word: título y encabezado, y el cuerpo sin encabezado."""
    primera = tabla_por_prendas(fu, per, protos[0], anio_proto, "inyecciones", "cantidad")
    res = [primera]
    if len(protos) > 1:
        # el cuerpo no tiene encabezado: sus columnas son las de la primera tabla
        import copy
        cab = copy.deepcopy(filas(protos[0])[1])
        cuerpo = copy.deepcopy(protos[1])
        filas(cuerpo)[0].addprevious(cab)
        segunda = tabla_por_prendas(fu, per, cuerpo, anio_proto, "inyecciones", "cantidad",
                                    fila_cab=0, filas_cabecera=1)
        filas(segunda.xml)[0].getparent().remove(filas(segunda.xml)[0])
        segunda.avisos = []  # los avisos ya van en la primera
        res.append(segunda)
    return res


def faltantes(fu, per: Periodo, protos, anio_proto) -> List[Relleno]:
    r = tabla_por_prendas(fu, per, protos[0], anio_proto, "faltantes", "faltantes")
    r.avisos = [a for a in r.avisos if "perdida economica" not in a]
    r.avisos.append("pérdida económica en blanco: la calcula Economía con el sistema contable (P11)")
    return [r]


def desmanche(fu, per: Periodo, protos, anio_proto) -> List[Relleno]:
    """Dos niveles de encabezado: polo (celdas combinadas) y, debajo, Trat. / %Rec."""
    lenc = _sin_lenceria(fu)
    W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    proto = protos[0]
    trs = filas(proto)
    grupos = []
    for tc in celdas(trs[1]):
        span = tc.find(f".//{W}gridSpan")
        n = int(span.get(f"{W}val")) if span is not None else 1
        t = texto_celda(tc)
        k = "anterior" if re.search(rf"\b{anio_proto - 1}\b", norm(t)) else (clave_polo(t) or norm(t))
        grupos.extend([k] * n)
    subs = []
    for tc in celdas(trs[2]):
        t = norm(texto_celda(tc))
        subs.append("trat" if t.startswith("trat") else ("pct" if "%" in t else ("cant" if t else "")))
    columnas = list(zip(grupos, subs))

    trat, av1 = lenc.datos(per.anio, per.meses, "desmanche", "tratadas", "suma")
    rec, _ = lenc.datos(per.anio, per.meses, "desmanche", "recuperadas", "suma", avisar=False)
    trat_a, _ = lenc.datos(per.anio - 1, per.meses, "desmanche", "tratadas", "suma", avisar=False)
    rec_a, _ = lenc.datos(per.anio - 1, per.meses, "desmanche", "recuperadas", "suma", avisar=False)
    avisos = list(av1)
    hay_anterior = any(v not in (CERRADO, None) for v in trat_a.values())
    if not hay_anterior:
        avisos.append(f"sin CD de {per.nombre.lower()} de {per.anio - 1}: la columna del año anterior va en blanco")

    def suma_polos(d, polos, prendas):
        vals = [_polo_valor(d, k, p) for k in polos for p in prendas]
        return _suma([v for v in vals if isinstance(v, (int, float))])

    prendas_proto = [prenda_de(texto_celda(celdas(tr)[0])) for tr in trs[3:]]
    filas_b = []
    for tr in trs[3:]:
        rot = texto_celda(celdas(tr)[0])
        p = prenda_de(rot)
        prendas = [p] if p else [x for x in prendas_proto if x]
        fila = [rot]
        for g, s in columnas[1:]:
            if g in NOMBRE:
                estado = trat.get(g)
                if estado is CERRADO:
                    fila.append(formatear(0, FMT_ENTERO) if s == "trat" else "")
                    continue
                if estado is None:
                    fila.append(SIN_DATO)
                    continue
                t_, r_ = suma_polos(trat, [g], prendas), suma_polos(rec, [g], prendas)
            elif g in ("TOTAL", "total"):
                t_, r_ = suma_polos(trat, list(NOMBRE), prendas), suma_polos(rec, list(NOMBRE), prendas)
            elif g == "anterior" and hay_anterior:
                t_, r_ = suma_polos(trat_a, list(NOMBRE), prendas), suma_polos(rec_a, list(NOMBRE), prendas)
            else:
                fila.append("")
                continue
            if s == "trat":
                fila.append(formatear(t_ or 0, FMT_ENTERO))
            elif s == "cant":
                fila.append(formatear(r_ or 0, FMT_ENTERO))
            else:
                fila.append(formatear(r_ / t_, FMT_PCT) if t_ else "-")
        filas_b.append(fila)
    b = Bloque("CD › lencería › desmanche", ["Lencería"] + [f"{g}/{s}" for g, s in columnas[1:]], filas_b,
               avisos=avisos)
    return [rellenar(proto, b, per, anio_proto, filas_cabecera=3, columnas_modo="posicion")]


CONSTRUCTORES_CD = {
    "TABLA_MONTAS_HABITACION": por_prendas("montas_habitacion", "indice", modo="media", fmt=FMT_INDICE),
    "TABLA_MONTAS_CLIENTE": por_prendas("montas_cliente", "indice", modo="media", fmt=FMT_INDICE),
    "TABLA_RECHAZO": por_prendas("rechazo", "cantidad"),
    "TABLA_MAL_USO": por_prendas("mal_uso", "cantidad"),
    "TABLA_RETIRO": por_prendas("retiro", "cantidad"),
    "TABLA_INYECCIONES": inyecciones,
    "TABLA_DESMANCHE": desmanche,
    "TABLA_FALTANTES": faltantes,
}
