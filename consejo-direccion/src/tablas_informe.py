"""
Tablas del informe del Consejo a partir de la TABLA CA y el GLOBAL.

Sustituye al DOCX de tablas que se montaba a mano copiando bloques de la TABLA
CA a Word. Cada tabla del informe se rellena sobre su «prototipo»: la misma
tabla de un informe anterior (ejemplos en el VPS), que pone el formato (fuentes,
anchos, sombreados) y la forma (qué filas y qué polos lleva). Las cifras salen
del bloque correspondiente de la TABLA CA o del GLOBAL, recalculadas con
excel_eval y escritas con el formato de su celda (formato_excel).

Cómo casan prototipo y bloque:
  - las filas del cuerpo, por posición: los rótulos de la TABLA CA están
    desfasados («Real 2025» en el bloque de junio de 2026), así que el rótulo
    se toma del prototipo, con los años corridos al período que se genera;
  - las columnas, por su encabezado (La Habana, Varadero… Consolidado): así el
    prototipo decide qué polos salen y el bloque puede traer más.

Nada se coloca a ciegas: si el bloque no aparece, o no tiene las filas o las
columnas que pide el prototipo, la tabla sale con un aviso y sin cifras.
"""
from __future__ import annotations

import re
import unicodedata
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from docx.oxml.ns import qn
from openpyxl.utils import get_column_letter

from excel_eval import Err, Libro
from formato_excel import formatear

MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO",
         "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]
TRIMESTRES = ["I TRIMESTRE", "II TRIMESTRE", "III TRIMESTRE", "IV TRIMESTRE"]


def norm(s) -> str:
    """Minúsculas, sin tildes ni espacios de más: para comparar rótulos."""
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", s).strip().lower()


# ─────────────────────────────────────────────────────────────────
# Período
# ─────────────────────────────────────────────────────────────────

@dataclass
class Periodo:
    anio: int
    mes: Optional[int] = None        # 1..12 si es mensual
    trimestre: Optional[int] = None  # 1..4 si es trimestral

    @property
    def es_trimestre(self) -> bool:
        return self.trimestre is not None

    @property
    def nombre(self) -> str:
        """'JUNIO' o 'II TRIMESTRE', como lo escribe el informe."""
        return TRIMESTRES[self.trimestre - 1] if self.es_trimestre else MESES[self.mes - 1]

    @property
    def meses(self) -> List[int]:
        if self.es_trimestre:
            return [3 * (self.trimestre - 1) + i for i in (1, 2, 3)]
        return [self.mes]


# ─────────────────────────────────────────────────────────────────
# Bloques de origen
# ─────────────────────────────────────────────────────────────────

@dataclass
class Bloque:
    """Un bloque de celdas de la TABLA CA o del GLOBAL, ya escrito como lo pinta Excel."""
    origen: str                       # "TABLA CA › hoja › AX106:BE117", para el registro
    cabecera: List[str]               # textos de la fila de encabezado (la 1.ª es el rótulo)
    filas: List[List[str]]            # cuerpo: [rótulo, celda, celda…]
    avisos: List[str] = field(default_factory=list)
    valores: List[List[object]] = field(default_factory=list)  # lo mismo sin formatear (si se leyó de Excel)

    def seleccionar(self, spec: List) -> "Bloque":
        """
        Filas del cuerpo por posición; un elemento ('pct', i, j, fmt) es una fila
        calculada: fila i / fila j × 100, columna a columna (p. ej. la desviación
        del kg por turista-día, que el bloque trimestral no trae).
        """
        filas_n, vals_n = [], []
        for s in spec:
            if isinstance(s, int):
                if s < len(self.filas):
                    filas_n.append(self.filas[s])
                    vals_n.append(self.valores[s] if s < len(self.valores) else [])
                continue
            _, i, j, fmt = s
            fila, vals = [""], [None]
            for a, b in zip(self.valores[i][1:], self.valores[j][1:]):
                if isinstance(a, (int, float)) and isinstance(b, (int, float)) and b:
                    v = a / b * 100
                else:
                    v = Err("#DIV/0!")
                fila.append(formatear(v, fmt))
                vals.append(v)
            filas_n.append(fila)
            vals_n.append(vals)
        return Bloque(self.origen, self.cabecera, filas_n, list(self.avisos), vals_n)


class Fuentes:
    """La TABLA CA (con el GLOBAL resuelto en sus vínculos) y el GLOBAL, para leer bloques."""

    def __init__(self, tabla_ca: Libro, global_: Optional[Libro] = None):
        self.ca = tabla_ca
        self.glob = global_

    # ── lectura de celdas ───────────────────────────────────────

    def texto(self, libro: Libro, hoja: str, fila: int, col: int) -> str:
        h = libro.hoja(hoja)
        v = libro.valor(h, fila, col)
        fmt = libro.f[h].cell(fila, col).number_format
        return formatear(v, fmt)

    def es_error(self, libro: Libro, hoja: str, fila: int, col: int) -> bool:
        return isinstance(libro.valor(libro.hoja(hoja), fila, col), Err)

    # ── bloques del cuadro mensual ─────────────────────────────

    def bloque_mensual(self, titulo: str, mes: int, hoja: str = "TABLAS DE CHEQUEOS MENSUAL",
                       n_filas: Optional[int] = None) -> Optional[Bloque]:
        """
        Un bloque de «TABLAS DE CHEQUEOS MENSUAL»: doce bloques iguales, uno por
        mes, uno al lado del otro. El del mes se reconoce porque la fila de debajo
        del título dice el nombre del mes en la columna del rótulo.
        """
        libro = self.ca
        h = libro.hoja(hoja)
        ws = libro.f[h]
        objetivo = norm(titulo)
        nombre_mes = norm(MESES[mes - 1])
        for fila in ws.iter_rows():
            for celda in fila:
                if not isinstance(celda.value, str) or not norm(celda.value).startswith(objetivo):
                    continue
                r, c = celda.row, celda.column
                if norm(ws.cell(r + 1, c).value) != nombre_mes:
                    continue
                return self._leer_bloque(libro, h, r + 1, c, n_filas)
        return None

    def bloque_trimestral(self, titulo: str, trimestre: int,
                          hoja: str = "TABLAS CHEQUEOS CONSOLIDADAS", n_filas: Optional[int] = None) -> Optional[Bloque]:
        """
        Un bloque de «TABLAS CHEQUEOS CONSOLIDADAS»: cuatro bloques por tabla, uno
        por trimestre, uno al lado del otro bajo una fila «I TRIMESTRE … IV TRIMESTRE».
        La fila de debajo del título lleva los polos (con la primera celda vacía).
        """
        libro = self.ca
        h = libro.hoja(hoja)
        if h is None:
            return None
        ws = libro.f[h]
        objetivo = norm(titulo)
        nombre_t = norm(TRIMESTRES[trimestre - 1])
        # columnas de cada trimestre: la fila de rótulos «X TRIMESTRE» más cercana por encima
        rotulos: Dict[int, List[Tuple[int, str]]] = {}
        for fila in ws.iter_rows():
            for c in fila:
                if isinstance(c.value, str) and re.fullmatch(r"(i|ii|iii|iv) trimestre", norm(c.value)):
                    rotulos.setdefault(c.row, []).append((c.column, norm(c.value)))
        for fila in ws.iter_rows():
            for celda in fila:
                if not isinstance(celda.value, str) or not norm(celda.value).startswith(objetivo):
                    continue
                r, c = celda.row, celda.column
                encima = [k for k in rotulos if k < r]
                if not encima:
                    continue
                filas_t = sorted(rotulos[max(encima)])
                tri = None
                for col_t, nom in filas_t:
                    if col_t <= c:
                        tri = nom
                if tri != nombre_t:
                    continue
                return self._leer_bloque(libro, h, r + 1, c, n_filas)
        return None

    def _leer_bloque(self, libro: Libro, hoja: str, fila_cab: int, col: int,
                     n_filas: Optional[int] = None) -> Bloque:
        """
        Lee hacia la derecha hasta la columna vacía y hacia abajo hasta la fila
        vacía, o exactamente `n_filas` filas si se dice (algunos bloques tienen huecos).
        """
        ws = libro.f[hoja]
        cab = []
        c = col
        while True:
            v = ws.cell(fila_cab, c).value
            if v in (None, "") and c > col:
                break
            cab.append(self.texto(libro, hoja, fila_cab, c))
            c += 1
        ancho = len(cab)
        filas, valores = [], []
        r = fila_cab + 1
        while True:
            crudos = [ws.cell(r, col + i).value for i in range(ancho)]
            if n_filas is None and all(v in (None, "") for v in crudos):
                break
            if n_filas is not None and r > fila_cab + n_filas:
                break
            filas.append([self.texto(libro, hoja, r, col + i) for i in range(ancho)])
            valores.append([libro.valor(hoja, r, col + i) for i in range(ancho)])
            r += 1
        rango = f"{get_column_letter(col)}{fila_cab}:{get_column_letter(col + ancho - 1)}{r - 1}"
        return Bloque(origen=f"TABLA CA › {hoja} › {rango}", cabecera=cab, filas=filas, valores=valores)


# ─────────────────────────────────────────────────────────────────
# Relleno del prototipo (Word)
# ─────────────────────────────────────────────────────────────────

def celdas(tr) -> list:
    """Las <w:tc> de una fila, sin repetir las combinadas en horizontal."""
    return list(tr.iterchildren(qn("w:tc")))


def texto_celda(tc) -> str:
    return "".join(t.text or "" for t in tc.iter(qn("w:t"))).strip()


def poner_texto(tc, texto: str) -> None:
    """Cambia el texto de una celda conservando el formato de su primer fragmento."""
    parrafos = list(tc.iterchildren(qn("w:p")))
    if not parrafos:
        return
    p = parrafos[0]
    for extra in parrafos[1:]:
        tc.remove(extra)
    runs = list(p.iterchildren(qn("w:r")))
    if not runs:
        from docx.oxml import OxmlElement
        r = OxmlElement("w:r")
        p.append(r)
        runs = [r]
    primero = runs[0]
    for r in runs[1:]:
        p.remove(r)
    for hijo in list(primero):
        if hijo.tag != qn("w:rPr"):
            primero.remove(hijo)
    from docx.oxml import OxmlElement
    t = OxmlElement("w:t")
    t.set(qn("xml:space"), "preserve")
    t.text = texto
    primero.append(t)


def filas(tbl) -> list:
    return list(tbl.iterchildren(qn("w:tr")))


_ANIO4 = re.compile(r"\b(20\d\d)\b")
_ANIO2 = re.compile(r"\b(REAL|PLAN|Real|Plan)\s+(\d\d)\b")


def correr_anios(texto: str, desplazamiento: int) -> str:
    """'Real 2025' → 'Real 2026' con desplazamiento 1; también 'REAL 26 -PLAN 26'."""
    if not desplazamiento:
        return texto
    texto = _ANIO4.sub(lambda m: str(int(m.group(1)) + desplazamiento), texto)
    return _ANIO2.sub(lambda m: f"{m.group(1)} {int(m.group(2)) + desplazamiento:02d}", texto)


def poner_periodo(texto: str, periodo: Periodo) -> str:
    """Cambia el mes o el trimestre que lleve el texto por el del período que se genera."""
    nombres = sorted(MESES + TRIMESTRES + ["IIT", "IT", "IIIT", "IVT"], key=len, reverse=True)
    for n in nombres:
        patron = re.compile(r"(?<![A-ZÁÉÍÓÚÑ])" + re.escape(n) + r"(?![A-ZÁÉÍÓÚÑ])", re.IGNORECASE)
        if patron.search(texto):
            return patron.sub(periodo.nombre, texto, count=1)
    return texto


@dataclass
class Relleno:
    xml: object
    avisos: List[str] = field(default_factory=list)
    celdas_escritas: int = 0


# Nombres de polo como aparecen en tablas y bloques → clave común
_POLOS = [
    ("HA", r"\bhabana\b|\b077\b"),
    ("VA", r"\bvaradero\b|\b080\b"),
    ("CA", r"\bcaibarien\b|\bcentro\b|\b082\b"),
    ("CC", r"\bcayo ?coco\b|\b081\b"),
    ("CX", r"\bcayo ?cruz\b|\b0?083\b"),
    ("HO", r"\bholguin\b|\b076\b"),
]


def clave_polo(texto: str) -> Optional[str]:
    t = norm(texto)
    for clave, patron in _POLOS:
        if re.search(patron, t):
            return clave
    m = re.match(r"^(total|suma|consolidado|promedio)\b", t)
    if m:
        return "TOTAL" if m.group(1) == "suma" else m.group(1).upper()
    return None


def clave_columna(texto: str, anio: int) -> str:
    """Encabezado de columna → clave para casar prototipo y bloque."""
    t = norm(texto)
    if re.search(rf"\b{anio - 1}\b", t):
        return "anterior"  # «TOTAL 2025», «Rechazo 2025», «INYECCIONES 2025»…
    return clave_polo(t) or t


def _cambiar_textos(trs, periodo: Periodo, desplaz: int, con_periodo: bool = True) -> None:
    for tr in trs:
        for tc in celdas(tr):
            t = texto_celda(tc)
            nuevo = correr_anios(poner_periodo(t, periodo) if con_periodo else t, desplaz)
            if nuevo != t:
                poner_texto(tc, nuevo)


def rellenar(tbl_xml, bloque: Bloque, periodo: Periodo, anio_prototipo: int, *,
             filas_cabecera: int = 2, filas_modo: str = "posicion", columnas_modo: str = "cabecera",
             fila_nombres: Optional[int] = None, periodo_en_cuerpo: bool = False) -> Relleno:
    """
    Copia el prototipo y escribe en él las cifras del bloque.

    filas_cabecera   cuántas filas del prototipo son título y encabezados (no se tocan
                     sus cifras; sí el período y los años de sus textos)
    filas_modo       'posicion': la fila i del cuerpo es la fila i del bloque;
                     'rotulo': cada fila se busca por el polo que nombra (077, Habana…)
    columnas_modo    'cabecera': cada columna se busca por su encabezado (polo, TOTAL…);
                     'posicion': la columna j es la columna j del bloque
    fila_nombres     fila del prototipo con los nombres de columna (por defecto la última
                     de cabecera)
    """
    tbl = deepcopy(tbl_xml)
    res = Relleno(xml=tbl)
    trs = filas(tbl)
    desplaz = periodo.anio - anio_prototipo
    _cambiar_textos(trs[:filas_cabecera], periodo, desplaz)

    # columnas
    mapa: Dict[int, int] = {}
    if columnas_modo == "posicion":
        mapa = {j: j for j in range(1, len(bloque.cabecera))}
    else:
        fn = filas_cabecera - 1 if fila_nombres is None else fila_nombres
        cab_proto = [clave_columna(texto_celda(tc), periodo.anio) for tc in celdas(trs[fn])]
        cab_bloque = [clave_columna(x, periodo.anio) for x in bloque.cabecera]
        for j, nombre in enumerate(cab_proto):
            if j == 0:
                continue
            if nombre in cab_bloque[1:]:
                mapa[j] = cab_bloque.index(nombre, 1)
            else:
                res.avisos.append(f"la columna «{nombre}» no está en {bloque.origen}")

    # filas
    cuerpo = trs[filas_cabecera:]
    por_rotulo = {}
    if filas_modo == "rotulo":
        for fila_b in bloque.filas:
            k = clave_polo(fila_b[0]) if fila_b else None
            if k and k not in por_rotulo:
                por_rotulo[k] = fila_b
    elif len(cuerpo) > len(bloque.filas):
        res.avisos.append(f"el prototipo pide {len(cuerpo)} filas y {bloque.origen} trae {len(bloque.filas)}")

    for i, tr in enumerate(cuerpo):
        tcs = celdas(tr)
        if not tcs:
            continue
        rot = texto_celda(tcs[0])
        nuevo = correr_anios(poner_periodo(rot, periodo) if periodo_en_cuerpo else rot, desplaz)
        if nuevo != rot:
            poner_texto(tcs[0], nuevo)
        if filas_modo == "rotulo":
            k = clave_polo(rot)
            fila_b = por_rotulo.get(k)
            if fila_b is None and len(tcs) > 1:
                res.avisos.append(f"la fila «{rot}» no está en {bloque.origen}")
        else:
            fila_b = bloque.filas[i] if i < len(bloque.filas) else None
        if len(tcs) == 1:
            continue  # fila de solo rótulo (p. ej. el nombre del polo en transporte)
        for j, tc in enumerate(tcs):
            if j == 0:
                continue
            if fila_b is None or j not in mapa or mapa[j] >= len(fila_b):
                poner_texto(tc, "")
                continue
            poner_texto(tc, fila_b[mapa[j]])
            res.celdas_escritas += 1
    res.avisos.extend(bloque.avisos)
    return res


def rellenar_por_cabecera(tbl_xml, bloque: Bloque, periodo: Periodo, anio_prototipo: int,
                          fila_cabecera: int = 1) -> Relleno:
    """Atajo para las tablas del cuadro mensual: título + una fila de polos."""
    return rellenar(tbl_xml, bloque, periodo, anio_prototipo, filas_cabecera=fila_cabecera + 1)


def ajustar_filas(tbl_xml, n: int, desde: int) -> None:
    """Deja el cuerpo (filas desde `desde`) con n filas, clonando la última o quitando las sobrantes."""
    trs = filas(tbl_xml)
    cuerpo = trs[desde:]
    if not cuerpo:
        return
    while len(cuerpo) > n:
        tbl_xml.remove(cuerpo.pop())
    modelo = cuerpo[-1]
    while len(cuerpo) < n:
        nueva = deepcopy(modelo)
        cuerpo[-1].addnext(nueva)
        cuerpo.append(nueva)
