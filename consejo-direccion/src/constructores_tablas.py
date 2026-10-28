"""
Cómo se rellena cada tabla del informe del Consejo (una función por marcador).

Cada constructor recibe las fuentes, el período, los prototipos de su marcador
(una o varias tablas Word de un informe anterior) y el año de ese informe, y
devuelve las tablas rellenas. El origen de cada tabla está documentado en
vault/Informe-Consejo-Origen-Datos.md; aquí solo se lee.

Tres familias:
  - cuadro mensual: bloques de «TABLAS DE CHEQUEOS MENSUAL» (economía, producción, consumos);
  - hojas de polo: filas de la tabla principal de cada polo (RRHH, CDT, CDO,
    satisfacción, ocupación), con el consolidado calculado sobre los polos que salen;
  - bloques tecleados: hojas auxiliares de la TABLA CA (lencería, cuentas,
    vehículos, vacantes), tal como estén. Son «sin comprobar»: no tienen mes.
  - GLOBAL: presupuesto de gastos y de transporte.

Ocho tablas de lencería salen del CD (lenceria_cd.py) cuando preparar recibe la
lencería de Supabase; si no la recibe (pruebas en local), de las hojas tecleadas.
"""
from __future__ import annotations

import re
from typing import Callable, Dict, List, Optional, Tuple

from openpyxl.utils import get_column_letter

from excel_eval import Err
from formato_excel import formatear
from lenceria_cd import CONSTRUCTORES_CD
from tablas_informe import (
    MESES, Bloque, Fuentes, Periodo, Relleno, ajustar_filas, celdas, clave_polo, filas, norm,
    poner_texto, rellenar, texto_celda,
)

HOJAS_POLO = {"HA": "HABANA", "VA": "VARADERO", "CA": "CAIBARIEN", "CC": "CAYOCOCO", "CX": "CAYOCRUZ", "HO": "HOLGUÍN"}
NOMBRE_POLO = {"HA": "La Habana", "VA": "Varadero", "CA": "Caibarién", "CC": "Cayo Coco", "CX": "Cayo Cruz", "HO": "Holguín"}
GLOBAL_POLO = {"HA": "LHCP", "VA": "VARCP", "CA": "CACP", "CC": "CCCP", "CX": "CCZCP", "HO": "HOLCP"}
ORDEN_POLOS = ["HA", "VA", "CA", "CC", "CX", "HO"]


class SinFuente(Exception):
    """El bloque de origen no aparece: la tabla no se puede rellenar."""


# ─────────────────────────────────────────────────────────────────
# Utilidades
# ─────────────────────────────────────────────────────────────────

def polos_del_prototipo(tbl, fila: int) -> List[str]:
    """Qué polos (claves) salen como columnas en la fila `fila` del prototipo."""
    out = []
    for tc in celdas(filas(tbl)[fila]):
        k = clave_polo(texto_celda(tc))
        if k in ORDEN_POLOS:
            out.append(k)
    return out


def fila_por_rotulo(fuentes: Fuentes, hoja: str, patron: str, desde: int = 1, hasta: int = 400) -> int:
    ws = fuentes.ca.f[fuentes.ca.hoja(hoja)]
    rx = re.compile(patron)
    for r in range(desde, hasta + 1):
        if rx.search(norm(ws.cell(r, 1).value)):
            return r
    raise SinFuente(f"no encuentro la fila «{patron}» en la hoja {hoja}")


def col_mes(mes: int) -> int:
    """Columna del mes en las hojas de polo de la TABLA CA: C = enero."""
    return 2 + mes


def num(v) -> Optional[float]:
    if isinstance(v, bool) or v is None or isinstance(v, Err) or isinstance(v, str):
        return None
    return float(v)


def valor_mes(fuentes: Fuentes, hoja: str, fila: int, periodo: Periodo, agregado: str):
    """Valor de una fila de la hoja de polo en el período (suma o media de los meses)."""
    vals = [fuentes.ca.valor(fuentes.ca.hoja(hoja), fila, col_mes(m)) for m in periodo.meses]
    if len(vals) == 1:
        return vals[0]
    nums = [num(v) for v in vals]
    nums = [x for x in nums if x is not None]
    if not nums:
        return None
    if agregado == "suma":
        return sum(nums)
    con_dato = [x for x in nums if x != 0]
    return sum(con_dato) / len(con_dato) if con_dato else 0.0


def dividir(a, b):
    a, b = num(a), num(b)
    if a is None or b in (None, 0):
        return Err("#DIV/0!")
    return a / b


# ─────────────────────────────────────────────────────────────────
# Familia 1: cuadro mensual
# ─────────────────────────────────────────────────────────────────

def _n(spec) -> Optional[int]:
    """Cuántas filas hay que leer para poder aplicar `spec`."""
    if not spec:
        return None
    idx = [s if isinstance(s, int) else max(s[1], s[2]) for s in spec]
    return max(idx) + 1


def mensual(titulo: str, filas_mes: Optional[List] = None, filas_trimestre: Optional[List] = None):
    """
    Bloque del cuadro mensual (mes) o de «TABLAS CHEQUEOS CONSOLIDADAS» (trimestre).
    filas_mes / filas_trimestre: qué filas del bloque van al informe, si no van todas
    en orden (ver Bloque.seleccionar).
    """
    def construir(fu: Fuentes, per: Periodo, protos, anio_proto) -> List[Relleno]:
        spec = filas_trimestre if per.es_trimestre else filas_mes
        if per.es_trimestre:
            b = fu.bloque_trimestral(titulo, per.trimestre, n_filas=_n(spec))
            hoja = "TABLAS CHEQUEOS CONSOLIDADAS"
            if b is not None and b.cabecera and not b.cabecera[0]:
                b.cabecera[0] = per.nombre
        else:
            b = fu.bloque_mensual(titulo, per.mes, n_filas=_n(spec))
            hoja = "TABLAS DE CHEQUEOS MENSUAL"
        if b is None:
            raise SinFuente(f"no encuentro el bloque «{titulo}» de {per.nombre} en {hoja}")
        if spec:
            b = b.seleccionar(spec)
        return [rellenar(protos[0], b, per, anio_proto, filas_cabecera=2)]
    return construir


# ─────────────────────────────────────────────────────────────────
# Familia 2: hojas de polo
# ─────────────────────────────────────────────────────────────────

def _texto(valor, fmt: str) -> str:
    """Como formatear, y con «+%» al final añade el signo sin multiplicar (100.14 → «100.14%»)."""
    if fmt.endswith("+%"):
        t = formatear(valor, fmt[:-2])
        return t if t in ("", "-") else t + "%"
    return formatear(valor, fmt)


def polos_por_meses(fila_actual: str, fila_anterior: Optional[str], *, fmt: str, consolidado: str,
                    agregado: str = "media", crecimiento: Optional[str] = None,
                    consolidado_anterior: Optional[str] = None):
    """
    Tablas con el mes en filas y los polos en columnas (CDT, CDO, salario, trabajadores…).
    fila_actual / fila_anterior: patrón del rótulo en la columna A de la hoja de polo
    (la del año anterior se busca a partir de la fila 62, su bloque).
    consolidado: 'media' (de los polos que salen y tienen dato), 'suma', o 'hoja'
                 (el de la hoja CONSOLIDADO de la TABLA CA).
    crecimiento: formato de la fila de crecimiento (actual / anterior × 100), None si no
                 lleva, o 'auto': «100.14%» o «100.14» según lo escriba el prototipo.
    """
    def construir(fu: Fuentes, per: Periodo, protos, anio_proto) -> List[Relleno]:
        polos = polos_del_prototipo(protos[0], 1)
        cab = ["MES"] + [NOMBRE_POLO[p] for p in polos] + ["Consolidado"]
        fmt_crec = crecimiento
        if crecimiento == "auto":
            ultima = filas(protos[0])[-1]
            muestra = texto_celda(celdas(ultima)[1]) if len(celdas(ultima)) > 1 else ""
            fmt_crec = "0.00+%" if muestra.endswith("%") else "0.00"

        def de_hoja(patron, desde):
            r = fila_por_rotulo(fu, "CONSOLIDADO", patron, desde=desde, hasta=desde + 80)
            v = valor_mes(fu, "CONSOLIDADO", r, per, agregado)
            return 0.0 if v is None else v

        def fila_de(patron, desde):
            vals = []
            for p in polos:
                h = HOJAS_POLO[p]
                r = fila_por_rotulo(fu, h, patron, desde=desde, hasta=desde + 70)
                v = valor_mes(fu, h, r, per, agregado)
                vals.append(0.0 if v is None else v)  # celda vacía: Excel la pintaba como 0
            return vals

        def consolidar(vals, regla):
            nums = [num(v) for v in vals]
            nums = [x for x in nums if x is not None]
            if regla == "suma":
                return sum(nums)
            con = [x for x in nums if x != 0]
            return sum(con) / len(con) if con else Err("#DIV/0!")

        actual = fila_de(fila_actual, 5)
        c_act = de_hoja(fila_actual, 5) if consolidado == "hoja" else consolidar(actual, consolidado)
        filas_b = [[per.nombre] + [_texto(v, fmt) for v in actual] + [_texto(c_act, fmt)]]
        if fila_anterior:
            ant = fila_de(fila_anterior, 62)
            regla_ant = consolidado_anterior or consolidado
            c_ant = de_hoja(fila_anterior, 62) if regla_ant == "hoja" else consolidar(ant, regla_ant)
            filas_b.append([f"{per.nombre} {per.anio - 1}"] + [_texto(v, fmt) for v in ant] + [_texto(c_ant, fmt)])
            if fmt_crec:
                crec = [dividir(a, b) for a, b in zip(actual, ant)]
                crec = [x * 100 if not isinstance(x, Err) else x for x in crec]
                c_crec = dividir(c_act, c_ant)
                c_crec = c_crec * 100 if not isinstance(c_crec, Err) else c_crec
                filas_b.append(["CRECIMIENTO (%)"] + [_texto(v, fmt_crec) for v in crec] + [_texto(c_crec, fmt_crec)])
        b = Bloque(origen="TABLA CA › hojas de polo", cabecera=cab, filas=filas_b)
        return [rellenar(protos[0], b, per, anio_proto, filas_cabecera=2, periodo_en_cuerpo=True)]
    return construir


def satisfaccion(fu: Fuentes, per: Periodo, protos, anio_proto) -> List[Relleno]:
    """Tres tablas: año en curso, año anterior y la fila suelta de CRECIMIENTO."""
    polos = polos_del_prototipo(protos[0], 1)
    cab = ["MES"] + [NOMBRE_POLO[p] for p in polos] + ["Consolidado"]

    def fila_de(desde):
        out = []
        for p in polos:
            h = HOJAS_POLO[p]
            r = fila_por_rotulo(fu, h, r"^evaluacion calidad", desde=desde, hasta=desde + 70)
            v = valor_mes(fu, h, r, per, "media")
            out.append(0.0 if v is None else v)
        return out

    def media(vals):
        nums = [x for x in (num(v) for v in vals) if x]
        return sum(nums) / len(nums) if nums else Err("#DIV/0!")

    act, ant = fila_de(5), fila_de(62)
    # el consolidado es el de la hoja CONSOLIDADO de la TABLA CA (media de los polos con dato)
    r_act = fila_por_rotulo(fu, "CONSOLIDADO", r"^evaluacion calidad", desde=5, hasta=60)
    r_ant = fila_por_rotulo(fu, "CONSOLIDADO", r"^evaluacion calidad", desde=62, hasta=140)
    c_act = valor_mes(fu, "CONSOLIDADO", r_act, per, "media")
    c_ant = valor_mes(fu, "CONSOLIDADO", r_ant, per, "media")
    fmt = "0.00"
    res = []
    for proto, vals, cons in ((protos[0], act, c_act), (protos[1], ant, c_ant)):
        b = Bloque("TABLA CA › hojas de polo (evaluación de calidad)", cab,
                   [[per.nombre] + [formatear(v, fmt) for v in vals] + [formatear(cons, fmt)]])
        res.append(rellenar(proto, b, per, anio_proto, filas_cabecera=2, periodo_en_cuerpo=True))
    if len(protos) > 2:
        crec = [dividir(a, b) for a, b in zip(act, ant)]
        crec = [x * 100 if not isinstance(x, Err) else x for x in crec]
        cc = dividir(c_act, c_ant)
        cc = cc * 100 if not isinstance(cc, Err) else cc
        b = Bloque("TABLA CA › hojas de polo (crecimiento)", ["CRECIMIENTO"] + [NOMBRE_POLO[p] for p in polos] + ["Consolidado"],
                   [[f"CRECIMIENTO {per.anio}/{per.anio - 1}"] + [formatear(v, fmt) for v in crec] + [formatear(cc, fmt)]])
        res.append(rellenar(protos[2], b, per, anio_proto, filas_cabecera=0, columnas_modo="posicion"))
    return res


def ocupacion(tipo: str):
    """
    Impacto de la ocupación sobre los ingresos o los gastos (fórmulas de «Datos
    económicos», recalculadas para el período y los polos del prototipo).
    """
    def construir(fu: Fuentes, per: Periodo, protos, anio_proto) -> List[Relleno]:
        polos = polos_del_prototipo(protos[0], 1)

        def suma_fila(patron, p):
            h = HOJAS_POLO[p]
            r = fila_por_rotulo(fu, h, patron, desde=5, hasta=60)
            return num(valor_mes(fu, h, r, per, "suma")) or 0.0

        datos = {}
        # en el trimestral, el consolidado de ingresos y gastos es el de los seis polos
        # (como el informe del II Trimestre de 2026); en el mensual, el de los que salen
        polos_dinero = ORDEN_POLOS if per.es_trimestre else polos
        for p in sorted(set(polos) | set(polos_dinero), key=ORDEN_POLOS.index):
            datos[p] = {
                "tdp": suma_fila(r"^plan turistas", p), "tdr": suma_fila(r"^real turistas", p),
                "ip": suma_fila(r"^plan ingresos", p), "ir": suma_fila(r"^real ingresos", p),
                "gp": suma_fila(r"^plan gastos totales", p), "gr": suma_fila(r"^real gastos totales", p),
            }
        cons = {k: sum(datos[p][k] for p in polos) for k in ("tdp", "tdr")}
        cons.update({k: sum(datos[p][k] for p in polos_dinero) for k in ("ip", "ir", "gp", "gr")})
        datos["CONSOLIDADO"] = cons
        orden = polos + ["CONSOLIDADO"]
        cab = ["", "U"] + [NOMBRE_POLO[p] for p in polos] + ["Consolidado"]

        def fila(rot, u, fn, fmt):
            return [rot, u] + [formatear(fn(datos[k]), fmt) for k in orden]

        def pct(a, b):
            v = dividir(a, b)
            return v * 100 if not isinstance(v, Err) else v

        if tipo == "ingresos":
            def estim(d):  # incumplimiento × ingreso por TD real
                return (d["tdr"] - d["tdp"]) * d["ir"] / d["tdr"] if d["tdr"] else Err("#DIV/0!")

            def sin_af(d):
                e = estim(d)
                return d["ir"] - e if not isinstance(e, Err) else e
            filas_b = [
                fila("Plan de ocupación", "TD", lambda d: d["tdp"], "#,##0"),
                fila("Ocupación Real", "TD", lambda d: d["tdr"], "#,##0"),
                fila("% Cumplimiento plan de ocupación", "%", lambda d: pct(d["tdr"], d["tdp"]), "0.00"),
                fila("% Cumplimiento plan de ingresos", "%", lambda d: pct(d["ir"], d["ip"]), "0.00"),
                fila("Incumplimiento del plan de ocupación", "TD", lambda d: d["tdr"] - d["tdp"], "#,##0"),
                fila("Estimación del ingreso asociado", "$", estim, "#,##0.00"),
                fila("Estimación del ingreso sin afectación", "$", sin_af, "#,##0.00"),
                fila("Cumplimiento estimado del plan", "%",
                     lambda d: pct(sin_af(d), d["ip"]) if not isinstance(sin_af(d), Err) else sin_af(d), "0.00"),
            ]
        else:
            def dejado(d):  # −incumplimiento × gasto plan por TD plan
                return -(d["tdr"] - d["tdp"]) * d["gp"] / d["tdp"] if d["tdp"] else Err("#DIV/0!")

            def sin_af(d):
                e = dejado(d)
                return d["gr"] + e if not isinstance(e, Err) else e
            filas_b = [
                fila("Plan de ocupación", "TD", lambda d: d["tdp"], "#,##0"),
                fila("Ocupación Real", "TD", lambda d: d["tdr"], "#,##0"),
                fila("% Cumplimiento plan de ocupación", "%", lambda d: pct(d["tdr"], d["tdp"]), "0.00"),
                fila("% Cumplimiento plan de gastos", "%", lambda d: pct(d["gr"], d["gp"]), "0.00"),
                fila("Dejado de gastar estimado", "$", dejado, "#,##0.00"),
                fila("Gasto ejecutado sin afectación", "$", sin_af, "#,##0.00"),
                fila("% Cumplimiento estimado del plan", "%",
                     lambda d: dividir(sin_af(d), d["gp"]) if not isinstance(sin_af(d), Err) else sin_af(d), "0.00%"),
            ]
        b = Bloque("TABLA CA › hojas de polo (ocupación, ingresos y gastos)", cab, filas_b)
        return [rellenar(protos[0], b, per, anio_proto, filas_cabecera=2)]
    return construir


# ─────────────────────────────────────────────────────────────────
# Familia 3: bloques tecleados de las hojas auxiliares
# ─────────────────────────────────────────────────────────────────

def leer_bloque(fu: Fuentes, hoja: str, titulo: str, filas_cabecera: int = 1, desde_col: Optional[int] = None,
                ancho: Optional[int] = None, cab_desde: int = 1, en_columna: Optional[int] = None) -> Bloque:
    """
    Bloque cuyo título está en una celda; `cab_desde` filas más abajo (0 = la del
    propio título) empiezan sus `filas_cabecera` filas de encabezado, y luego el
    cuerpo hasta la primera fila vacía. Toma el primer título que casa empezando
    por arriba: en las hojas auxiliares, el bloque del período en curso.
    desde_col    columna donde empieza el bloque, si no es la del título
    en_columna   buscar el título solo en esa columna
    """
    libro = fu.ca
    h = libro.hoja(hoja)
    if h is None:
        raise SinFuente(f"la TABLA CA no tiene la hoja «{hoja}»")
    ws = libro.f[h]
    objetivo = norm(titulo)
    pos = None
    for fila in ws.iter_rows(max_row=200):
        for c in fila:
            if en_columna and c.column != en_columna:
                continue
            if isinstance(c.value, str) and norm(c.value).startswith(objetivo):
                pos = (c.row, c.column)
                break
        if pos:
            break
    if pos is None:
        raise SinFuente(f"no encuentro el bloque «{titulo}» en la hoja {hoja}")
    r0, c0 = pos
    c0 = desde_col or c0
    cabs = list(range(r0 + cab_desde, r0 + cab_desde + filas_cabecera))
    if ancho is None:
        ancho = 1
        while any(ws.cell(r, c0 + ancho).value not in (None, "") for r in cabs):
            ancho += 1
    cab = [" ".join(t for t in (fu.texto(libro, h, r, c0 + i) for r in cabs) if t) for i in range(ancho)]
    filas_b = []
    r = cabs[-1] + 1
    while any(ws.cell(r, c0 + i).value not in (None, "") for i in range(ancho)):
        filas_b.append([fu.texto(libro, h, r, c0 + i) for i in range(ancho)])
        r += 1
    rango = f"{get_column_letter(c0)}{r0}:{get_column_letter(c0 + ancho - 1)}{r - 1}"
    titulo_real = str(ws.cell(r0, pos[1]).value).strip()
    return Bloque(f"TABLA CA › {h} › {rango} («{titulo_real}»)", cab, filas_b,
                  avisos=[f"tecleado sin mes en la TABLA CA: {h} › «{titulo_real}»"])


def tecleado(hoja: str, titulo: str, *, filas_cabecera_bloque: int = 1, filas_cabecera_proto: int = 2,
             filas_modo: str = "posicion", columnas_modo: str = "cabecera", desde_col: Optional[int] = None,
             cab_desde: int = 1, en_columna: Optional[int] = None):
    def construir(fu: Fuentes, per: Periodo, protos, anio_proto) -> List[Relleno]:
        b = leer_bloque(fu, hoja, titulo, filas_cabecera_bloque, desde_col, cab_desde=cab_desde, en_columna=en_columna)
        return [rellenar(protos[0], b, per, anio_proto, filas_cabecera=filas_cabecera_proto,
                         filas_modo=filas_modo, columnas_modo=columnas_modo)]
    return construir


def inyecciones(fu: Fuentes, per: Periodo, protos, anio_proto) -> List[Relleno]:
    """Va partida en dos tablas de Word: título + encabezado, y el cuerpo."""
    b = leer_bloque(fu, "Rechazo e inyecciones", "INYECCIONES DE LENCER")
    primera = rellenar(protos[0], Bloque(b.origen, b.cabecera, []), per, anio_proto, filas_cabecera=2)
    res = [primera]
    if len(protos) > 1:
        # la segunda no tiene encabezado: sus columnas son las de la primera
        nombres = [texto_celda(tc) for tc in celdas(filas(protos[0])[1])]
        from tablas_informe import clave_columna
        cab_b = [clave_columna(x, per.anio) for x in b.cabecera]
        idx = [0] + [cab_b.index(clave_columna(n, per.anio), 1) if clave_columna(n, per.anio) in cab_b[1:] else None
                     for n in nombres[1:]]
        filas_b = [[f[i] if i is not None and i < len(f) else "" for i in idx] for f in b.filas]
        segunda = rellenar(protos[1], Bloque(b.origen, nombres, filas_b), per, anio_proto,
                           filas_cabecera=0, columnas_modo="posicion")
        segunda.avisos = []  # el aviso de «tecleado» ya va en la primera
        res.append(segunda)
    res[0].avisos.extend(b.avisos)
    return res


def desmanche(fu: Fuentes, per: Periodo, protos, anio_proto) -> List[Relleno]:
    """Dos niveles de encabezado: polo y, debajo, Trat. / Cant. Rec. / %Rec."""
    libro = fu.ca
    h = libro.hoja("Rechazo e inyecciones")
    ws = libro.f[h]
    pos = None
    for fila in ws.iter_rows(max_row=60):
        for c in fila:
            if isinstance(c.value, str) and norm(c.value).startswith("tratamientos de desmanche"):
                # la fila de polos va una o dos filas por debajo del título
                for d in (1, 2, 3):
                    n_polos = sum(1 for k in range(1, 20)
                                  if clave_polo(str(ws.cell(c.row + d, c.column + k).value or "")) in ORDEN_POLOS)
                    if n_polos >= 2:
                        pos = (c.row, c.column, c.row + d)
                        break
                if pos:
                    break
        if pos:
            break
    if pos is None:
        raise SinFuente("no encuentro el bloque de tratamientos de desmanche en «Rechazo e inyecciones»")
    r0, c0, fila_polos = pos
    fila_sub = fila_polos + 1
    # columnas del bloque: (clave de grupo, subcolumna) → índice de columna
    grupos = {}
    grupo = None
    c = c0 + 1
    while c < c0 + 40:
        g = ws.cell(fila_polos, c).value
        s = ws.cell(fila_sub, c).value
        if g not in (None, ""):
            grupo = "anterior" if re.search(rf"\b{per.anio - 1}\b", norm(g)) else (clave_polo(str(g)) or norm(g))
        if s in (None, "") and g in (None, ""):
            break
        if grupo and s:
            sub = "trat" if norm(s).startswith("trat") else ("pct" if "%" in str(s) else "cant")
            grupos[(grupo, sub)] = c
        c += 1
    # el cuerpo empieza en la fila que tiene la primera prenda
    r = fila_sub + 1
    tbl_proto = protos[0]
    trs = filas(tbl_proto)
    # encabezados del prototipo: fila 1 grupos (con celdas combinadas), fila 2 subcolumnas
    proto_grupos = []
    for tc in celdas(trs[1]):
        span = tc.find(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}gridSpan")
        n = int(span.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val")) if span is not None else 1
        t = texto_celda(tc)
        k = "anterior" if re.search(rf"\b{anio_proto - 1}\b", norm(t)) else (clave_polo(t) or norm(t))
        proto_grupos.extend([k] * n)
    subs = []
    for tc in celdas(trs[2]):
        t = norm(texto_celda(tc))
        subs.append("trat" if t.startswith("trat") else ("pct" if "%" in t else ("cant" if t else "")))
    columnas = list(zip(proto_grupos, subs))
    filas_b = []
    while any(ws.cell(r, c0 + i).value not in (None, "") for i in range(0, 6)):
        fila_txt = [fu.texto(libro, h, r, c0)]
        for j, (g, s) in enumerate(columnas):
            if j == 0:
                continue
            col = grupos.get((g, s))
            fila_txt.append(fu.texto(libro, h, r, col) if col else "")
        filas_b.append(fila_txt)
        r += 1
    titulo_real = str(ws.cell(r0, c0).value).strip()
    b = Bloque(f"TABLA CA › {h} › {get_column_letter(c0)}{r0} («{titulo_real}»)",
               ["Lencería"] + [f"{g}/{s}" for g, s in columnas[1:]], filas_b,
               avisos=[f"tecleado sin mes en la TABLA CA: {h} › «{titulo_real}»"])
    return [rellenar(tbl_proto, b, per, anio_proto, filas_cabecera=3, columnas_modo="posicion")]


def inventarios(fu: Fuentes, per: Periodo, protos, anio_proto) -> List[Relleno]:
    """
    En la TABLA CA va traspuesto (polos en columnas) y sin plan anual ni acumulado:
    solo se rellenan las columnas que existen; las demás quedan vacías con aviso.
    """
    libro = fu.ca
    h = libro.hoja("Rechazo e inyecciones")
    ws = libro.f[h]
    pos = None
    for fila in ws.iter_rows(max_row=40):
        for c in fila:
            if isinstance(c.value, str) and norm(c.value).startswith("cant. inventarios"):
                pos = (c.row, c.column)
                break
        if pos:
            break
    if pos is None:
        raise SinFuente("no encuentro «Cant. Inventarios» en «Rechazo e inyecciones»")
    r0, c0 = pos
    cols_polo = {}
    for k in range(1, 9):
        p = clave_polo(str(ws.cell(r0, c0 + k).value or ""))
        if p:
            cols_polo[p] = c0 + k
    filas_dato = {}
    for r in range(r0 + 1, r0 + 8):
        t = norm(ws.cell(r, c0).value)
        if t.startswith("realizados") and str(per.anio - 1) in t:
            filas_dato["anterior"] = r
        elif t.startswith("realizados"):
            filas_dato["realizados"] = r
        elif t.startswith("conciliados"):
            filas_dato["conciliados"] = r
    trs = filas(protos[0])
    nombres = [norm(texto_celda(tc)) for tc in celdas(trs[1])]
    clave_col = []
    for n in nombres:
        if str(anio_proto - 1) in n:
            clave_col.append("anterior")
        elif n.startswith("realizados"):
            clave_col.append("realizados")
        elif n.startswith("conciliados"):
            clave_col.append("conciliados")
        else:
            clave_col.append(None)
    avisos = [f"tecleado sin mes en la TABLA CA: {h} › «Cant. Inventarios»"]
    faltan = [texto_celda(tc) for tc, k in zip(celdas(trs[1]), clave_col) if k is None][1:]
    if faltan:
        avisos.append("sin dato en la TABLA CA para: " + ", ".join(faltan))
    filas_b = []
    for p in ORDEN_POLOS + ["TOTAL"]:
        fila_txt = [NOMBRE_POLO.get(p, "Total")]
        for k in clave_col[1:]:
            if k is None or k not in filas_dato:
                fila_txt.append("")
            elif p == "TOTAL":
                tot = sum(num(libro.valor(h, filas_dato[k], c)) or 0 for c in cols_polo.values())
                fila_txt.append(formatear(tot, "#,##0"))
            else:
                c = cols_polo.get(p)
                fila_txt.append(fu.texto(libro, h, filas_dato[k], c) if c else "")
        filas_b.append(fila_txt)
    b = Bloque(f"TABLA CA › {h} › «Cant. Inventarios»", [""] + nombres[1:], filas_b, avisos)
    return [rellenar(protos[0], b, per, anio_proto, filas_cabecera=2, filas_modo="rotulo", columnas_modo="posicion")]


# ─────────────────────────────────────────────────────────────────
# Familia 4: GLOBAL
# ─────────────────────────────────────────────────────────────────

_ACUMULADO_T = {
    1: r"^acumulado (1 ?er ?t|1 ?t|i ?t|1er trimestre|primer)",
    2: r"^acumulado (2 ?do ?t|2 ?t|ii ?t|2do trimestre|segundo)",
    3: r"^acumulado (3 ?er ?t|3 ?t|iii ?t|3er trimestre|tercer)",
    4: r"^acumulado (4 ?to ?t|4 ?t|iv ?t|4to trimestre|cuarto)",
}


def _columnas_periodo(ws, per: Periodo) -> Optional[Dict[str, int]]:
    """Columnas PLAN / REAL / Qp del mes, o del «ACUMULADO nT» del trimestre."""
    if per.es_trimestre:
        rx = re.compile(_ACUMULADO_T[per.trimestre])
        for c in range(1, ws.max_column + 1):
            if rx.search(norm(ws.cell(4, c).value)):
                return _columnas_global(ws, str(ws.cell(4, c).value))
        return None
    return _columnas_global(ws, MESES[per.mes - 1])


def _columnas_global(ws, mes_nombre: str) -> Optional[Dict[str, int]]:
    """Columnas PLAN / REAL / Qp de un mes en una hoja del GLOBAL (mes en la fila 4)."""
    for c in range(1, ws.max_column + 1):
        if norm(ws.cell(4, c).value) == norm(mes_nombre):
            out = {}
            for k in range(0, 4):
                t = norm(ws.cell(5, c + k).value)
                if t.startswith("plan") and "plan" not in out:  # algunas hojas: «PLAN (Qp)»
                    out["plan"] = c + k
                elif t == "real" and "real" not in out:
                    out["real"] = c + k
                elif t == "qp" and "qp" not in out:
                    out["qp"] = c + k
            return out
    return None


def _fila_codigo(ws, codigo: int) -> Optional[int]:
    for r in range(6, ws.max_row + 1):
        v = ws.cell(r, 1).value
        if isinstance(v, (int, float)) and int(v) == codigo:
            return r
    return None


def _hoja_global(G, prefijo: str, anio: int) -> Optional[str]:
    return G.hoja(f"{prefijo}{anio}")


def presupuesto_gastos(fu: Fuentes, per: Periodo, protos, anio_proto) -> List[Relleno]:
    """GLOBAL › CONSOLIDADO: las partidas con plan o real distinto de cero."""
    G = fu.glob
    if G is None:
        raise SinFuente("falta el GLOBAL")
    h = G.hoja("CONSOLIDADO")
    ws = G.f[h]
    cols = _columnas_periodo(ws, per)
    if not cols or "plan" not in cols or "real" not in cols:
        raise SinFuente(f"el CONSOLIDADO del GLOBAL no tiene el mes {per.nombre}")
    filas_b = []
    for r in range(6, ws.max_row + 1):
        codigo = ws.cell(r, 1).value
        if not isinstance(codigo, (int, float)):
            continue
        plan, real = G.valor(h, r, cols["plan"]), G.valor(h, r, cols["real"])
        p, rl = num(plan) or 0.0, num(real) or 0.0
        if p == 0 and rl == 0:
            continue
        qp = "N/P" if p == 0 else formatear(rl / p, "0%")
        filas_b.append([str(int(codigo)), str(ws.cell(r, 2).value or "").strip(),
                        formatear(p, "#,##0.00"), formatear(rl, "#,##0.00"), qp])
    if not filas_b:
        raise SinFuente(f"el CONSOLIDADO del GLOBAL no tiene cifras de {per.nombre}")
    from copy import deepcopy
    tbl = deepcopy(protos[0])
    ajustar_filas(tbl, len(filas_b), 2)
    b = Bloque(f"GLOBAL › CONSOLIDADO › {per.nombre}", ["Filas", "Partida", "PLAN", "REAL", "Qp"],
               [[f[0]] + f[1:] for f in filas_b])
    res = rellenar(tbl, b, per, anio_proto, filas_cabecera=2, columnas_modo="posicion")
    # la primera columna (código) también viene del GLOBAL
    for tr, f in zip(filas(res.xml)[2:], filas_b):
        poner_texto(celdas(tr)[0], f[0])
    return [res]


def presupuesto_transporte(fu: Fuentes, per: Periodo, protos, anio_proto) -> List[Relleno]:
    """GLOBAL, hoja de cada polo: códigos 130 (partes y piezas) y 134 (mantenimiento)."""
    G = fu.glob
    if G is None:
        raise SinFuente("falta el GLOBAL")
    totales = {130: [0.0, 0.0], 134: [0.0, 0.0]}
    filas_b = []
    trs = filas(protos[0])
    for tr in trs[1:]:
        tcs = celdas(tr)
        rot = texto_celda(tcs[0])
        p = clave_polo(rot)
        if len(tcs) == 1:
            filas_b.append([rot])
            polo_actual = p if p in ORDEN_POLOS else "TOTAL"
            continue
        codigo = 130 if "pieza" in norm(rot) else 134
        if polo_actual == "TOTAL":
            pl, rl = totales[codigo]
        else:
            h = _hoja_global(G, GLOBAL_POLO[polo_actual], per.anio)
            if h is None:
                raise SinFuente(f"el GLOBAL no tiene la hoja {GLOBAL_POLO[polo_actual]}{per.anio}")
            ws = G.f[h]
            cols = _columnas_periodo(ws, per)
            r = _fila_codigo(ws, codigo)
            pl = num(G.valor(h, r, cols["plan"])) or 0.0 if r and cols else 0.0
            rl = num(G.valor(h, r, cols["real"])) or 0.0 if r and cols else 0.0
            totales[codigo][0] += pl
            totales[codigo][1] += rl
        filas_b.append([rot, formatear(pl, "#,##0.00"), formatear(rl, "#,##0.00"),
                        formatear(rl / pl if pl else 0, "0%")])
    b = Bloque(f"GLOBAL › hojas de polo › códigos 130 y 134 › {per.nombre}",
               ["Descripción", "Plan", "Real", "%"], filas_b)
    return [rellenar(protos[0], b, per, anio_proto, filas_cabecera=1, columnas_modo="posicion")]


# ─────────────────────────────────────────────────────────────────
# Registro
# ─────────────────────────────────────────────────────────────────

CONSTRUCTORES: Dict[str, Callable] = {
    "TABLA_INGRESOS": mensual("Cumplimiento del plan de Ingresos"),
    "TABLA_OCUPACION": ocupacion("ingresos"),
    "TABLA_PRESUPUESTO_GASTOS": presupuesto_gastos,
    "TABLA_COSTOS": mensual("Cumplimiento del plan de Costos"),
    "TABLA_GASTOS": mensual("Cumplimiento del plan de Gastos"),
    "TABLA_RELACION_GASTOS_OCUPACION": ocupacion("gastos"),
    "TABLA_UTILIDADES": mensual("Cumplimiento del plan de Utilidades"),
    "TABLA_COSTO_POR_PESO": mensual("Costo y gasto por Peso"),
    "TABLA_INGRESO_TURISTA_DIA": mensual("Ingresos por turista d", filas_mes=[4, 5, 6, 9, 10],
                                         filas_trimestre=[6, 5, 15, 9, 10]),
    "TABLA_PRECIO_KG": mensual("Precios de Venta del kilogramo"),
    "TABLA_CXC": tecleado("Datos económicos", "EDADES DE LAS CUENTAS POR CO", filas_cabecera_bloque=2, cab_desde=0,
                          filas_cabecera_proto=3, filas_modo="rotulo", columnas_modo="posicion", desde_col=11),
    "TABLA_CXP": tecleado("Datos económicos", "EDADES DE LAS CUENTAS POR PA", filas_cabecera_bloque=2, cab_desde=0,
                          filas_cabecera_proto=3, filas_modo="rotulo", columnas_modo="posicion", desde_col=11),
    "TABLA_KG_LAVADOS": mensual("Producciones - Productividad"),
    "TABLA_KG_TURISTA_DIA": mensual("kg x Turista d",
                                    filas_trimestre=[1, 2, 3, 4, ("pct", 2, 4, "0.00"), 0, 5]),
    "TABLA_CONSUMO_QUIMICOS": mensual("Consumo Producto Qu"),
    "TABLA_MONTAS_HABITACION": tecleado("Montas", "ESTADO DE LAS MONTAS POR HABITACION", desde_col=1),
    "TABLA_MONTAS_CLIENTE": tecleado("Montas", "ESTADO DE LAS MONTAS POR CLIENTE", desde_col=10),
    "TABLA_LENCERIA_USO": tecleado("Rechazo e inyecciones", "LENCERIA EN USO"),
    "TABLA_LENCERIA_NUEVA": tecleado("Rechazo e inyecciones", "LENCERIA", cab_desde=0, en_columna=92),
    "TABLA_RECHAZO": tecleado("Rechazo e inyecciones", "RECHAZO DE LENCER"),
    "TABLA_MAL_USO": tecleado("Rechazo e inyecciones", "MAL USO"),
    "TABLA_DESMANCHE": desmanche,
    "TABLA_RETIRO": tecleado("Rechazo e inyecciones", "RETIRO GENERADO"),
    "TABLA_INYECCIONES": inyecciones,
    "TABLA_INVENTARIOS": inventarios,
    "TABLA_FALTANTES": tecleado("Montas", "TOTAL DE FALTANTES DETECTADOS"),
    "TABLA_DIESEL": mensual("Consumo por kg lavados - Diesel"),
    "TABLA_ELECTRICIDAD": mensual("Consumo por kg lavados - Electricidad"),
    "TABLA_AGUA": mensual("Consumo por kg lavados - Agua"),
    "TABLA_CDT": polos_por_meses(r"^cdt equipos", r"^cdt equipos", fmt="0.00", consolidado="media",
                                 crecimiento="auto"),
    "TABLA_CDO": polos_por_meses(r"^cdo equipos", r"^cdo equipos", fmt="0.00", consolidado="media",
                                 crecimiento="auto"),
    "TABLA_PRESUPUESTO_TRANSPORTE": presupuesto_transporte,
    "TABLA_DISPONIBILIDAD_VEHICULOS": tecleado("Datos económicos", "Disponibilidad de veh", filas_cabecera_bloque=2,
                                               filas_cabecera_proto=3, filas_modo="rotulo", columnas_modo="posicion"),
    "TABLA_SATISFACCION": satisfaccion,
    "TABLA_SALARIO": polos_por_meses(r"^salario medio", None, fmt="#,##0.00", consolidado="hoja"),
    "TABLA_TRABAJADORES": polos_por_meses(r"^promedio de trabajadores", None, fmt="#,##0", consolidado="suma"),
    "TABLA_VACANTES": tecleado("Datos económicos", "Centros productivos", cab_desde=0,
                               filas_cabecera_proto=1, filas_modo="rotulo", columnas_modo="posicion"),
}


def _desde_cd(marcador: str, tecleada: Callable) -> Callable:
    """La tabla sale de la lencería del CD si preparar la tiene; si no, de la hoja tecleada."""
    del_cd = CONSTRUCTORES_CD[marcador]

    def construir(fu: Fuentes, per: Periodo, protos, anio_proto) -> List[Relleno]:
        if getattr(fu, "lenceria", None) is not None:
            return del_cd(fu, per, protos, anio_proto)
        return tecleada(fu, per, protos, anio_proto)
    return construir


for _m in CONSTRUCTORES_CD:
    CONSTRUCTORES[_m] = _desde_cd(_m, CONSTRUCTORES[_m])
