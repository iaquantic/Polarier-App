#!/usr/bin/env python3
"""
Herramientas del agente "Rellenar TABLA CA" (n8n + Claude).

Sustituye a rellenar_ca.py. En vez de un proceso ciego de principio a fin,
expone operaciones pequeñas que el agente de n8n llama por el pythonrunner:

    POST http://polarierauto_pythonrunner:8000/run
    {"script": "Leslie/CD/agente_ca.py", "args": ["<comando>", "<json>"]}

Comandos (todos reciben un JSON con al menos {"cd": "<nombre del fichero CA>"}):

    preparar        Contexto (polo, año, mes, rutas), extracción de referencia
                    (cada indicador con su celda de origen o su error), avisos
                    deterministas y el estado actual de la tabla.
    ver_hoja        Celdas no vacías de una hoja del CA, con coordenadas Excel.
    ver_global      Filas de la hoja del polo en el GLOBAL (Plan/Real del mes).
    estado_tabla    Valores y fórmulas de la columna del mes en la TABLA CA.
    escribir        Escribe {clave: valor} (y {producto: kg} de químicos) en la
                    columna del mes. Nunca pisa una celda con fórmula y no
                    reescribe las que ya tienen ese mismo valor (sin_cambios).
                    Hace copia de seguridad antes, solo si algo cambia.
    limpiar         Borra el CA ya procesado.

El fichero de entrada se llama <POLO>CA<AAAA><MM>.xlsx (p. ej. CACA202504.xlsx;
el nombre antiguo <POLO>CD<AAAA><MM> también vale). Año y mes salen del nombre.

Dónde está cada dato (mapa validado con los CA de abril de 2025 de los seis
polos contra el bloque «año anterior» de TABLA CA 2026; ver
vault/Generacion-Documentos.md, D2). Las celdas cambian de un CA a otro, las
hojas no: todo se localiza por etiqueta y por la cabecera «Real» de su bloque.

    Producción   «Turistas Días (pax)» y «Producción (Kg)» → Real
                 prendas = fila TOTAL de la tabla diaria, columna «Procesado»
                 capacidad = cap. túnel × uds. túnel + cap. lavadora × uds.
                 químicos por producto = la columna de la tabla «Producto»
                 cuya suma da «Productos Químicos (Kg)» Real
    Economía     «Arrendamiento», «Lavado», «Total» → Real; otros = total − ambos
                 «Costos», «Gastos», «Utilidades», «Gastos Fijos» (contraste)
    RRHH         días, horas promedio, total/promedio de trabajadores,
                 trabajadores productivos, gasto de salario → REAL
    Transporte   según el criterio de la tabla para cada polo (TRANSPORTE)
    SSTT         fila «CONSUMOS» (combustible, electricidad, agua); CDO y CDT
                 del bloque «CDT Equipos Polarier»
    Calidad      «PROMEDIO TOTAL»
    GLOBAL       filas que enlaza la propia tabla: «Costos Directos»,
                 «Gastos Totales (Indirectos + Fijos)», «Utilidades antes de
                 Cargo Fijo», «Utilidades antes de Impuestos», «Salario», «VAB»

Rutas (relativas a este script, así funciona igual en local y en el VPS):
    <CA>                         fichero subido desde la app (lo escribe n8n)
    TABLA CA <año>.xlsx          tabla que se rellena
    ../GLOBAL-CP<aa>.xlsx        GLOBAL vivo de la rama Leslie (o ./GLOBAL-CP<aa>.xlsx)
    respaldos/                   copias de la tabla antes de cada escritura

Toda salida es JSON por stdout. Los errores salen como {"ok": false, "error": ...}
con código 0, para que el agente pueda leerlos y razonar en vez de cortar el flujo.
"""

import hashlib
import json
import re
import shutil
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook

BASE_DIR = Path(__file__).resolve().parent
ENTRADA = BASE_DIR  # n8n deja el CA junto a la tabla, como hacía rellenar_ca.py
RESPALDOS = BASE_DIR / "respaldos"
MAX_RESPALDOS = 15
MAX_FILAS, MAX_COLS = 260, 100  # hay hojas con dimensiones infladas (65536 × 256)

# prefijo del fichero -> (prefijo de hoja en GLOBAL, hoja en TABLA CA, nombre)
POLOS = {
    "LH": ("LHCP", "HABANA", "La Habana"),
    "VA": ("VARCP", "VARADERO", "Varadero"),
    "CA": ("CACP", "CAIBARIEN", "Caibarién"),
    "CC": ("CCCP", "CAYOCOCO", "Cayo Coco"),
    "CCX": ("CCZCP", "CAYOCRUZ", "Cayo Cruz"),
    "HOL": ("HOLCP", "HOLGUIN", "Holguín"),
}
ALIAS_POLO = {"HA": "LH", "CX": "CCX", "CCZ": "CCX", "HO": "HOL"}

# Criterio de la TABLA CA para el transporte, tal como la venían rellenando
# (decisión de Leo, 2026-10-14: mantener la lógica de la tabla):
#   "todos"  km y combustible de la fila TOTALES; propios = vehículos con km > 0;
#            total = propios + alquilados.
#   "carga"  solo camiones y furgonetas (propios y alquilados); km y combustible
#            son la suma de esos vehículos. Fuera autos ligeros y ómnibus.
TRANSPORTE = {"LH": "todos", "VA": "todos", "CC": "todos",
              "CA": "carga", "CCX": "carga", "HOL": "carga"}
MARCAS_CARGA = ["howo", "sinotruk", "hd", "mascott", "jmc", "freightliner", "internacional",
                "international", "hiace", "boxer", "hino", "isuzu", "kamaz", "camion", "furgon"]

MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO",
         "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]

# Claves de la TABLA CA que rellena este proceso (columna A de la hoja del polo).
# "ALQUJLER" va con la errata tal como está escrito en la tabla.
CLAVES = [
    "REAL TURISTAS DÍAS", "REAL PRODUCCIÓN", "PRENDAS PROCESADAS", "REAL INGRESOS",
    "INGRESOS ALQUJLER DE LENCERÍA", "INGRESOS LAVADO", "OTROS INGRESOS",
    "REAL COSTO DE LAVANDERÍA", "REAL GASTOS TOTALES", "UTILIDAD EN OPERACIONES",
    "UTILIDAD NETA", "VALOR AGREGADO BRUTO", "GASTO DE SALARIO", "DÍAS TRABAJADOS",
    "HORAS TRABAJADAS", "PROMEDIO DE TRABAJADORES", "PROM TRAB PRODUCTIVOS DIARIOS",
    "VEHÍCULOS EN USO TOTALES", "DE ELLOS PROPIOS", "KILÓMETROS RECORRIDOS",
    "CONSUMO DIESEL TRANSPORTE", "CDT EQUIPOS", "CDO EQUIPOS",
    "CONSUMO DIESEL PRODUCCIÓN", "CONSUMO ELECTRICIDAD", "CONSUMO AGUA",
    "CAPACIDAD INSTALADA POR HORA", "EVALUACIÓN CALIDAD HOTELES",
]

# Filas del GLOBAL que enlaza la propia tabla (=[2]<HOJA>!$G$49, $G$188...).
GLOBAL_FILAS = {
    "REAL COSTO DE LAVANDERÍA": "costos directos",
    "REAL GASTOS TOTALES": "gastos totales (indirectos + fijos)",
    "UTILIDAD EN OPERACIONES": "utilidades antes de cargo fijo",
    "UTILIDAD NETA": "utilidades antes de impuestos",
    "GASTO DE SALARIO": "salario",
    "VALOR AGREGADO BRUTO": "vab",
}


# ----------------------------------------------------------------- utilidades

def sin_tildes(s):
    s = unicodedata.normalize("NFKD", str(s))
    return "".join(c for c in s if not unicodedata.combining(c))


def clave_norm(s):
    """Normaliza una clave de la tabla: sin tildes, minúsculas, espacios simples."""
    return re.sub(r"\s+", " ", sin_tildes(s).strip().lower())


def etiqueta_norm(s):
    """Normaliza una etiqueta del CA: además quita '(P51)'-style y ':' final."""
    t = re.sub(r"\((?:p\d[^)]*)\)", "", clave_norm(s))
    return t.strip().rstrip(":").strip()


def compacto(s):
    """Normalización agresiva para nombres de hoja: sin tildes ni separadores."""
    return re.sub(r"[^a-z]", "", sin_tildes(s).strip().lower())


def num(v):
    """Convierte a float si es numérico; None en cualquier otro caso."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return None if v != v else float(v)  # descarta NaN
    try:
        return float(str(v).replace(",", ".").strip())
    except ValueError:
        return None


def limpio(v):
    """Valor listo para JSON: enteros sin .0, floats redondeados, texto tal cual."""
    if isinstance(v, float):
        if v != v:
            return None
        return int(v) if v.is_integer() else round(v, 6)
    if isinstance(v, datetime):
        return v.isoformat()
    return v


def coord(r, c):
    """(fila, columna) 0-based -> 'C7'."""
    letras = ""
    c += 1
    while c:
        c, resto = divmod(c - 1, 26)
        letras = chr(65 + resto) + letras
    return f"{letras}{r + 1}"


def letra(c):
    """Columna 0-based -> 'C'."""
    return coord(0, c)[:-1]


def salir(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False, default=str))
    sys.stdout.write("\n")
    sys.exit(0)


class ErrorAgente(Exception):
    pass


# ------------------------------------------------------------------ contexto

def contexto(nombre_cd):
    nombre_cd = str(nombre_cd or "").strip()
    if not nombre_cd or "/" in nombre_cd or "\\" in nombre_cd or ".." in nombre_cd:
        raise ErrorAgente(f"Nombre de fichero no válido: {nombre_cd!r}")

    m = re.match(r"^([A-Za-z]+?)C[AD][\s_\-]*(\d{4})[\s_\-]*(\d{2})", nombre_cd, re.IGNORECASE)
    if not m:
        raise ErrorAgente(
            f"El nombre '{nombre_cd}' no sigue el patrón <POLO>CA<AAAA><MM>.xlsx "
            "(p. ej. CACA202504.xlsx)."
        )
    prefijo = m.group(1).upper()
    prefijo = ALIAS_POLO.get(prefijo, prefijo)
    if prefijo not in POLOS:
        raise ErrorAgente(
            f"Prefijo de polo '{m.group(1)}' desconocido. Válidos: CA, CC, CX, HA, HO, VA "
            "(también LH, CCX, HOL)."
        )
    anio, mes_num = int(m.group(2)), int(m.group(3))
    if not 1 <= mes_num <= 12:
        raise ErrorAgente(f"Mes '{m.group(3)}' fuera de rango en '{nombre_cd}'.")

    global_cp, hoja_tabla, nombre_polo = POLOS[prefijo]
    aa = str(anio)[-2:]
    # Mismo orden que agente_modelo1.py: el GLOBAL vivo está en Leslie/; los de
    # años cerrados, en «Leslie Global <año>/» (dentro de Leslie/ o al lado).
    # La copia de CD/ va la última: es antigua.
    candidatos_global = [BASE_DIR.parent / f"GLOBAL-CP{aa}.xlsx",
                         BASE_DIR.parent / f"Leslie Global {anio}" / f"GLOBAL-CP{aa}.xlsx",
                         BASE_DIR.parent.parent / f"Leslie Global {anio}" / f"GLOBAL-CP{aa}.xlsx",
                         BASE_DIR / f"GLOBAL-CP{aa}.xlsx"]
    ruta_global = next((p for p in candidatos_global if p.exists()), candidatos_global[0])

    return {
        "cd": nombre_cd,
        "ruta_cd": ENTRADA / nombre_cd,
        "polo": nombre_polo,
        "prefijo": prefijo,
        "anio": anio,
        "mes_num": mes_num,
        "mes": MESES[mes_num - 1],
        "hoja_global": f"{global_cp}{anio}",
        "hoja_tabla": hoja_tabla,
        "criterio_transporte": TRANSPORTE[prefijo],
        "ruta_global": ruta_global,
        "ruta_tabla": BASE_DIR / f"TABLA CA {anio}.xlsx",
    }


def contexto_publico(ctx):
    out = {k: v for k, v in ctx.items() if not k.startswith("ruta_")}
    for k in ("ruta_cd", "ruta_global", "ruta_tabla"):
        out[k.replace("ruta_", "existe_")] = ctx[k].exists()
        out[k.replace("ruta_", "fichero_")] = ctx[k].name
    return out


# ----------------------------------------------------------------- lectura CA

def abrir_cd(ctx):
    if not ctx["ruta_cd"].exists():
        raise ErrorAgente(f"No encuentro el fichero '{ctx['cd']}' en la carpeta del script.")
    return load_workbook(ctx["ruta_cd"], data_only=True, read_only=True)


def hoja_fuzzy(wb, clave):
    k = compacto(clave)
    coincidencias = [s for s in wb.sheetnames if k in compacto(s)]
    if not coincidencias:
        raise ErrorAgente(f"No hay hoja para '{clave}'. Hojas del CA: {wb.sheetnames}")
    return sorted(coincidencias, key=len)[0]


def rejilla(ws):
    return [list(fila) for fila in ws.iter_rows(max_row=MAX_FILAS, max_col=MAX_COLS, values_only=True)]


class Hoja:
    """Rejilla de una hoja del CA con búsqueda por etiqueta y cabecera."""

    def __init__(self, wb, clave):
        self.nombre = hoja_fuzzy(wb, clave)
        self.g = rejilla(wb[self.nombre])

    def v(self, r, c):
        if 0 <= r < len(self.g) and 0 <= c < len(self.g[r]):
            return self.g[r][c]
        return None

    def ref(self, r, c):
        return f"{self.nombre}!{coord(r, c)}"

    def buscar(self, *etiquetas, empieza=False):
        """Celdas de texto cuya etiqueta normalizada es (o empieza por) alguna dada."""
        objs = [etiqueta_norm(e) for e in etiquetas]
        hallados = []
        for r, fila in enumerate(self.g):
            for c, x in enumerate(fila):
                if isinstance(x, str) and x.strip():
                    t = etiqueta_norm(x)
                    if any(t == o or (empieza and t.startswith(o)) for o in objs):
                        hallados.append((r, c))
        return hallados

    def es_total(self, r, hasta_col):
        return any(isinstance(x, str) and etiqueta_norm(x) in ("total", "totales")
                   for x in self.g[r][:hasta_col]) if r < len(self.g) else False

    def col_cabecera(self, r, c, cabecera, ancho=6, arriba=80):
        """Columna con la cabecera dada (p. ej. 'Real') encima de (r, c) y a su derecha."""
        objetivo = etiqueta_norm(cabecera)
        for rr in range(r - 1, max(r - arriba, -1), -1):
            for cc in range(c + 1, c + 1 + ancho):
                x = self.v(rr, cc)
                if isinstance(x, str) and etiqueta_norm(x) == objetivo:
                    return cc
        return None

    def valor(self, *etiquetas, cabecera="real", empieza=False):
        """(valor, celda) de la columna `cabecera` en la fila de la etiqueta."""
        for (r, c) in self.buscar(*etiquetas, empieza=empieza):
            cc = self.col_cabecera(r, c, cabecera)
            if cc is not None and num(self.v(r, cc)) is not None:
                return num(self.v(r, cc)), self.ref(r, cc)
        raise ErrorAgente(f"No encuentro '{etiquetas[0]}' con columna '{cabecera}' en {self.nombre}")

    def a_la_derecha(self, *etiquetas, empieza=True, ancho=4):
        """Primer número a la derecha de la etiqueta."""
        for (r, c) in self.buscar(*etiquetas, empieza=empieza):
            for cc in range(c + 1, c + 1 + ancho):
                x = num(self.v(r, cc))
                if x is not None:
                    return x, self.ref(r, cc)
        raise ErrorAgente(f"No encuentro un número junto a '{etiquetas[0]}' en {self.nombre}")


def es_carga(marca, modelo):
    t = clave_norm(f"{marca or ''} {modelo or ''}")
    return any(re.search(rf"(^|[^a-z]){k}", t) for k in MARCAS_CARGA)


def extraer_transporte(T, criterio):
    """Vehículos propios y alquilados de la hoja Transporte y los cuatro indicadores."""
    cab = next(((r, c) for (r, c) in T.buscar("Km")), None)
    if cab is None:
        raise ErrorAgente(f"No encuentro la cabecera 'Km' en {T.nombre}")
    r0, ck = cab
    fila_cab = [etiqueta_norm(x) if isinstance(x, str) else "" for x in T.g[r0]]

    # combustible: 'Comb'; si no hay, la sub-columna 'Real' de 'Consumo' (litros)
    cc = next((c for c in range(ck + 1, ck + 3) if fila_cab[c:c + 1] == ["comb"]), None)
    if cc is None:
        cons = next((c for c in range(ck + 1, ck + 3) if fila_cab[c:c + 1] == ["consumo"]), None)
        if cons is not None:
            for c in range(cons, cons + 3):
                if any(isinstance(T.v(rr, c), str) and etiqueta_norm(T.v(rr, c)) == "real"
                       for rr in (r0 + 1, r0 + 2)):
                    cc = c
                    break
    marca_c = max((c for c in range(ck) if fila_cab[c] == "marca"), default=None)
    modelo_c = max((c for c in range(ck) if fila_cab[c] == "modelo"), default=None)

    # TOTALES de la tabla de propios: se busca solo junto a ella (en La Habana el
    # bloque de alquilados, a la izquierda, tiene su propio TOTALES más arriba)
    desde_col = max(0, (marca_c if marca_c is not None else ck) - 3)
    propios, fila_total = [], None
    for r in range(r0 + 1, len(T.g)):
        if any(isinstance(T.v(r, c), str) and etiqueta_norm(T.v(r, c)) in ("total", "totales")
               for c in range(desde_col, ck)):
            fila_total = r
            break
        km = num(T.v(r, ck)) or 0
        if km > 0:
            propios.append({"marca": T.v(r, marca_c) if marca_c is not None else None,
                            "modelo": T.v(r, modelo_c) if modelo_c is not None else None,
                            "km": limpio(km), "comb": limpio(num(T.v(r, cc)) if cc is not None else None),
                            "fila": r + 1})

    # alquilados: bloque con 'ALQUILADOS' en el texto; su columna 'Marca'
    alquilados = []
    bloque = next(((r, c) for r, fila in enumerate(T.g) for c, x in enumerate(fila)
                   if isinstance(x, str) and "alquilados" in clave_norm(x) and "resumen" in clave_norm(x)), None)
    if bloque:
        rb, cb = bloque
        cab_m = next(((r, c) for r in range(rb, min(rb + 4, len(T.g))) for c in range(cb, cb + 3)
                      if isinstance(T.v(r, c), str) and etiqueta_norm(T.v(r, c)) == "marca"), None)
        if cab_m:
            rm, cm = cab_m
            for r in range(rm + 1, len(T.g)):
                m = T.v(r, cm)
                if not isinstance(m, str) or not m.strip():
                    continue
                if etiqueta_norm(m) in ("total", "totales"):
                    break
                if etiqueta_norm(m).startswith("no se entregaron"):
                    break
                alquilados.append({"marca": m.strip(), "modelo": T.v(r, cm + 1), "fila": r + 1})

    if criterio == "carga":
        usados = [p for p in propios if es_carga(p["marca"], p["modelo"])]
        alq = [a for a in alquilados if es_carga(a["marca"], a["modelo"])]
        km = sum(p["km"] for p in usados)
        comb = round(sum(p["comb"] or 0 for p in usados), 2)
        origen_km = f"suma de {len(usados)} vehículos de carga ({T.nombre})"
    else:
        usados, alq = propios, alquilados
        if fila_total is None:
            raise ErrorAgente(f"No encuentro la fila TOTALES de {T.nombre}")
        km = num(T.v(fila_total, ck))
        comb = num(T.v(fila_total, cc)) if cc is not None else None
        origen_km = T.ref(fila_total, ck)
    return {
        "KILÓMETROS RECORRIDOS": (km, origen_km),
        "CONSUMO DIESEL TRANSPORTE": (comb, T.ref(fila_total, cc) if criterio != "carga" and cc is not None else origen_km),
        "DE ELLOS PROPIOS": (len(usados), f"propios con km > 0 ({'solo carga' if criterio == 'carga' else 'todos'})"),
        "VEHÍCULOS EN USO TOTALES": (len(usados) + len(alq), f"{len(usados)} propios + {len(alq)} alquilados"),
    }, {"criterio": criterio, "propios_con_km": propios, "alquilados": alquilados,
        "excluidos": [" ".join(str(x) for x in (p["marca"], p["modelo"]) if x)
                      for p in propios + alquilados if criterio == "carga" and not es_carga(p["marca"], p["modelo"])]}


def extraer_quimicos(P, kg_quimicos):
    """{producto: kg} de la tabla 'Producto' de la hoja Producción. La columna buena
    es la que suma 'Productos Químicos (Kg)' Real (en los CA de 2025 lleva la
    cabecera 'Teórico'; la de al lado es la del mes anterior)."""
    cab = P.buscar("Producto")
    if not cab:
        raise ErrorAgente(f"No encuentro la tabla 'Producto' en {P.nombre}")
    r0, c0 = cab[0]
    productos = []
    for r in range(r0 + 1, min(r0 + 40, len(P.g))):
        nombre = P.v(r, c0)
        if isinstance(nombre, str) and nombre.strip():
            if etiqueta_norm(nombre).startswith("total"):
                break
            productos.append((r, nombre.strip()))
        elif productos and all(P.v(r, c) is None for c in range(c0, c0 + 3)):
            continue
    candidatas = {}
    for c in range(c0 + 2, c0 + 4):
        candidatas[c] = round(sum(num(P.v(r, c)) or 0 for r, _ in productos), 2)
    # la más cercana, si queda a menos de un 2 % (en La Habana, abril de 2025, la
    # buena suma 2529 frente a 2531 declarados)
    elegida = None
    if kg_quimicos:
        c, s = min(candidatas.items(), key=lambda cs: abs(cs[1] - kg_quimicos))
        if abs(s - kg_quimicos) <= kg_quimicos * 0.02:
            elegida = c
    if elegida is None:
        raise ErrorAgente(
            f"Ninguna columna de la tabla 'Producto' suma los {kg_quimicos} kg de 'Productos Químicos (Kg)': "
            + ", ".join(f"{letra(c)}={s}" for c, s in candidatas.items()))
    nota = "" if abs(candidatas[elegida] - kg_quimicos) <= 0.5 else f"; suma {candidatas[elegida]}, no {limpio(kg_quimicos)}"
    return {n: limpio(num(P.v(r, elegida)) or 0) for r, n in productos}, f"{P.nombre}!{letra(elegida)}{nota}"


def extraccion_cd(ctx):
    """Cada indicador por separado: si uno falla se anota el error y se sigue."""
    valores, errores, detalle = {}, {}, {}

    def poner(clave, valor, origen):
        valores[clave] = {"valor": limpio(valor), "origen": origen}

    def intentar(claves, fn):
        try:
            fn()
        except Exception as e:  # el agente decide qué hacer con el hueco
            for k in claves:
                errores[k] = f"{type(e).__name__}: {e}"

    wb = abrir_cd(ctx)
    hojas = {}

    def H(clave):
        if clave not in hojas:
            hojas[clave] = Hoja(wb, clave)
        return hojas[clave]

    # --- Producción
    intentar(["REAL TURISTAS DÍAS"], lambda: poner("REAL TURISTAS DÍAS", *H("produccion").valor("Turistas Días (pax)", "Turistas Días")))
    intentar(["REAL PRODUCCIÓN"], lambda: poner("REAL PRODUCCIÓN", *H("produccion").valor("Producción (Kg)")))

    def prendas():
        # la tabla diaria (Día | Lavatín | Túnel | Total | Plan | ... | Procesado);
        # hay otro «PROCESADO» en la tabla por hotel, que no es este
        P = H("produccion")
        for (r0, cp) in P.buscar("Procesado"):
            c_dia = next((c for c in range(cp) if isinstance(P.v(r0, c), str) and etiqueta_norm(P.v(r0, c)) == "dia"), None)
            if c_dia is None:
                continue
            for r in range(r0 + 1, min(r0 + 45, len(P.g))):
                if any(isinstance(P.v(r, c), str) and etiqueta_norm(P.v(r, c)) == "total" for c in range(c_dia, cp)):
                    if num(P.v(r, cp)) is not None:
                        return poner("PRENDAS PROCESADAS", num(P.v(r, cp)), f"{P.ref(r, cp)} (fila TOTAL, columna 'Procesado')")
                    break
        raise ErrorAgente("No encuentro la fila TOTAL de la columna 'Procesado'")
    intentar(["PRENDAS PROCESADAS"], prendas)

    def capacidad():
        P = H("produccion")
        ct, o1 = P.a_la_derecha("Capacidad túnel lavado")
        ut, o2 = P.a_la_derecha("Unidades Túnel")
        cl, o3 = P.a_la_derecha("Capacidad lavadora")
        ul, o4 = P.a_la_derecha("Unidades Lavadora")
        poner("CAPACIDAD INSTALADA POR HORA", ct * ut + cl * ul, f"{o1}×{o2} + {o3}×{o4}")
    intentar(["CAPACIDAD INSTALADA POR HORA"], capacidad)

    def quimicos():
        P = H("produccion")
        kg, origen = P.valor("Productos Químicos (Kg)")
        detalle["quimicos"], col = extraer_quimicos(P, kg)
        detalle["quimicos_origen"] = f"{col} (suma {limpio(kg)} kg = {origen})"
    try:
        quimicos()
    except Exception as e:
        detalle["quimicos_error"] = f"{type(e).__name__}: {e}"

    # --- Economía
    def ingresos():
        # bloque «Desagregación de los ingresos»: Arrendamiento, Lavado, ... Total
        E = H("economia")
        alq = E.valor("Arrendamiento")
        r0, c0 = E.buscar("Arrendamiento")[0]
        col_real = E.col_cabecera(r0, c0, "real")

        def debajo(etq):
            for r in range(r0, min(r0 + 20, len(E.g))):
                if isinstance(E.v(r, c0), str) and etiqueta_norm(E.v(r, c0)) == etq and num(E.v(r, col_real)) is not None:
                    return num(E.v(r, col_real)), E.ref(r, col_real)
            raise ErrorAgente(f"No encuentro '{etq}' bajo 'Arrendamiento' en {E.nombre}")
        lav = debajo("lavado")
        tot = debajo("total")
        poner("INGRESOS ALQUJLER DE LENCERÍA", *alq)
        poner("INGRESOS LAVADO", *lav)
        poner("REAL INGRESOS", tot[0], f"{tot[1]} ('Total' de la desagregación de ingresos)")
        poner("OTROS INGRESOS", round(tot[0] - alq[0] - lav[0], 2), "total − alquiler − lavado (desagregación de ingresos)")
    intentar(["INGRESOS ALQUJLER DE LENCERÍA", "INGRESOS LAVADO", "REAL INGRESOS", "OTROS INGRESOS"], ingresos)

    contraste = {}

    def economia_contraste():
        E = H("economia")
        for clave, etq in [("REAL COSTO DE LAVANDERÍA", "Costos"), ("REAL GASTOS TOTALES", "Gastos"),
                           ("UTILIDAD NETA", "Utilidades"), ("GASTO DE SALARIO", "Salario")]:
            try:
                contraste[clave] = E.valor(etq)
            except ErrorAgente:
                pass
        try:
            un, gf = E.valor("Utilidades"), E.valor("Gastos Fijos")
            contraste["UTILIDAD EN OPERACIONES"] = (round(un[0] + gf[0], 2), f"utilidades {un[1]} + gastos fijos {gf[1]}")
        except ErrorAgente:
            pass
    intentar([], economia_contraste)

    # --- RRHH
    def rrhh(clave, *etiquetas):
        intentar([clave], lambda: poner(clave, *H("rrhh").valor(*etiquetas)))

    rrhh("DÍAS TRABAJADOS", "Días trabajados")
    rrhh("HORAS TRABAJADAS", "Horas Promedio Trabajadas")
    rrhh("PROMEDIO DE TRABAJADORES", "Promedio de trabajadores", "Total Trabajadores")
    rrhh("PROM TRAB PRODUCTIVOS DIARIOS", "Trabajadores Productivos")
    try:
        contraste.setdefault("GASTO DE SALARIO", H("rrhh").valor("Gasto de Salario"))
        contraste["GASTO DE SALARIO (RRHH)"] = H("rrhh").valor("Gasto de Salario")
    except Exception:
        pass

    # --- Transporte
    def transporte():
        res, det = extraer_transporte(H("transporte"), ctx["criterio_transporte"])
        detalle["transporte"] = det
        for k, (v, o) in res.items():
            poner(k, v, o)
    intentar(["KILÓMETROS RECORRIDOS", "CONSUMO DIESEL TRANSPORTE", "DE ELLOS PROPIOS", "VEHÍCULOS EN USO TOTALES"], transporte)

    # --- SSTT
    def consumos():
        S = H("sstt")
        r, c = S.buscar("Consumos")[0]
        for etq, clave in [("combustible (l)", "CONSUMO DIESEL PRODUCCIÓN"),
                           ("electricidad (kw)", "CONSUMO ELECTRICIDAD"), ("agua (m3)", "CONSUMO AGUA")]:
            col = next((cc for rr in range(r - 1, max(r - 4, -1), -1) for cc in range(c + 1, c + 6)
                        if isinstance(S.v(rr, cc), str) and etiqueta_norm(S.v(rr, cc)) == etq), None)
            if col is None or num(S.v(r, col)) is None:
                errores[clave] = f"No encuentro la columna '{etq}' de la fila CONSUMOS en {S.nombre}"
            else:
                poner(clave, num(S.v(r, col)), f"{S.ref(r, col)} (fila CONSUMOS)")
    intentar(["CONSUMO DIESEL PRODUCCIÓN", "CONSUMO ELECTRICIDAD", "CONSUMO AGUA"], consumos)

    def cdo_cdt():
        S = H("sstt")
        pct = lambda x: round(x * 100 if x <= 1.5 else x, 2)  # unos CA lo dan en tanto por uno
        r, c = S.buscar("PROMEDIO")[0]
        cdo = next(((rr, num(S.v(rr, c))) for rr in range(r + 1, r + 6) if num(S.v(rr, c)) is not None), None)
        if cdo is None:
            raise ErrorAgente("No encuentro el CDO bajo 'PROMEDIO'")
        poner("CDO EQUIPOS", pct(cdo[1]), f"{S.ref(cdo[0], c)} (primer valor bajo 'PROMEDIO')")
        v, o = S.a_la_derecha("CDT", empieza=False, ancho=2)
        poner("CDT EQUIPOS", pct(v), f"{o} (a la derecha de 'CDT')")
    intentar(["CDO EQUIPOS", "CDT EQUIPOS"], cdo_cdt)

    # --- Calidad
    def calidad():
        v, o = H("calidad").a_la_derecha("PROMEDIO TOTAL", empieza=False, ancho=3)
        poner("EVALUACIÓN CALIDAD HOTELES", round(v, 2), o)
    intentar(["EVALUACIÓN CALIDAD HOTELES"], calidad)

    wb.close()
    detalle["contraste_economia"] = {k: {"valor": limpio(v), "origen": o} for k, (v, o) in contraste.items()}
    return valores, errores, detalle, contraste


# ---------------------------------------------------------------- GLOBAL

def _evaluador_global():
    """Evaluador de fórmulas de sync_global_ai.py (carpeta padre, ya en el VPS).
    Modelo1.py guarda el GLOBAL con openpyxl y eso borra los valores calculados,
    así que leer con data_only daría las fórmulas vacías."""
    try:
        if str(BASE_DIR.parent) not in sys.path:
            sys.path.insert(0, str(BASE_DIR.parent))
        from sync_global_ai import Evaluador, columnas_meses
        return Evaluador, columnas_meses
    except Exception:
        return None, None


def filas_global(ctx):
    """Filas de la hoja del polo en el GLOBAL con Plan y Real del mes.
    Devuelve (filas, letra de la columna Real, si las fórmulas se evaluaron)."""
    if not ctx["ruta_global"].exists():
        aa = str(ctx["anio"])[-2:]
        raise ErrorAgente(f"No existe GLOBAL-CP{aa}.xlsx en el servidor (se busca en Leslie/ y en "
                          f"'Leslie Global {ctx['anio']}/'). Sin él no se puede contrastar el GLOBAL ni sacar el VAB.")
    Evaluador, columnas_meses = _evaluador_global()
    wb = load_workbook(ctx["ruta_global"], data_only=Evaluador is None)
    if ctx["hoja_global"] not in wb.sheetnames:
        raise ErrorAgente(f"El GLOBAL no tiene la hoja {ctx['hoja_global']}. Hojas: {wb.sheetnames}")
    ws = wb[ctx["hoja_global"]]

    cab = next((r for r in range(1, 21) if str(ws.cell(r, 1).value or "").strip() == "Filas"), None)
    if cab is None:
        raise ErrorAgente("No encuentro la fila de cabecera 'Filas' en el GLOBAL.")

    if Evaluador:
        cols = columnas_meses(ws).get(ctx["mes_num"])
        if not cols:
            raise ErrorAgente(f"No encuentro las columnas PLAN/REAL de {ctx['mes']} en el GLOBAL.")
        c_plan, c_real = cols[0], cols[1]
        ev = Evaluador(ws)

        def leer(r, c):
            try:
                return ev.excel(r, c)
            except ValueError:  # fórmula que el evaluador no soporta
                return None
    else:
        c_plan = next((c for c in range(1, ws.max_column + 1)
                       if str(ws.cell(cab, c).value or "").strip().upper() == ctx["mes"]), None)
        if c_plan is None:
            raise ErrorAgente(f"No encuentro la columna {ctx['mes']} en la cabecera del GLOBAL.")
        c_real = c_plan + 1

        def leer(r, c):
            return num(ws.cell(r, c).value)

    filas = []
    for r in range(cab + 2, ws.max_row + 1):
        codigo, titulo = ws.cell(r, 1).value, ws.cell(r, 2).value
        if codigo is None and titulo is None:
            continue
        filas.append({
            "excel_fila": r,
            "fila": limpio(num(codigo)) if num(codigo) is not None else codigo,
            "titulo": titulo,
            "plan": limpio(leer(r, c_plan)),
            "real": limpio(leer(r, c_real)),
        })
    wb.close()
    return filas, letra(c_real - 1), Evaluador is not None


def extraccion_global(ctx):
    """Las seis filas del GLOBAL que enlaza la propia tabla, columna Real del mes."""
    valores, errores = {}, {}
    try:
        filas, col_real, evaluado = filas_global(ctx)
    except Exception as e:
        msg = f"{type(e).__name__}: {e}"
        for k in GLOBAL_FILAS:
            errores[k] = msg
        return valores, errores, None

    hoja = ctx["hoja_global"]
    # Un mes sin cargar no tiene datos aunque sus fórmulas den 0 (misma regla que
    # sync_global_ai.py: cuenta como cargado si 'Ventas Totales' tiene plan o real).
    ventas = next((f for f in filas if f["fila"] == 1), None)
    if ventas is not None and not ventas["real"] and not ventas["plan"]:
        msg = (f"El mes {ctx['mes']} no está cargado en {hoja} ('Ventas Totales' vacía): "
               "falta subir el PDF CP de ese mes.")
        return valores, {k: msg for k in GLOBAL_FILAS}, msg

    for clave, titulo in GLOBAL_FILAS.items():
        hit = next((f for f in filas if f["titulo"] is not None and clave_norm(f["titulo"]) == titulo), None)
        if hit is None:
            errores[clave] = f"El GLOBAL no tiene la fila '{titulo}'"
        elif hit["real"] is None:
            errores[clave] = f"{hoja}!{col_real}{hit['excel_fila']} ('{str(hit['titulo']).strip()}') está vacía"
        else:
            valores[clave] = {"valor": hit["real"],
                              "origen": f"{hoja}!{col_real}{hit['excel_fila']} ('{str(hit['titulo']).strip()}', Real)"}

    avisos = []
    if not evaluado:
        avisos.append("No se pudo cargar el evaluador de sync_global_ai.py: el GLOBAL se leyó con los valores "
                      "guardados, que faltan en las celdas con fórmula si se guardó sin recalcular.")
    return valores, errores, " ".join(avisos) or None


# ---------------------------------------------------------------- TABLA CA

def abrir_tabla(ctx, solo_valores):
    if not ctx["ruta_tabla"].exists():
        raise ErrorAgente(f"No existe '{ctx['ruta_tabla'].name}' en el servidor.")
    return load_workbook(ctx["ruta_tabla"], data_only=solo_valores)


def hoja_tabla(wb, ctx):
    objetivo = compacto(ctx["hoja_tabla"])
    for s in wb.sheetnames:
        if compacto(s) == objetivo:
            return wb[s]
    raise ErrorAgente(f"La tabla no tiene hoja para {ctx['polo']} ({ctx['hoja_tabla']}). Hojas: {wb.sheetnames}")


def columnas_meses_tabla(ws, r):
    cols = {}
    for c in range(1, ws.max_column + 1):
        v = ws.cell(r, c).value
        if v is None:
            continue
        n = clave_norm(v).upper()
        n = "SEPTIEMBRE" if n == "SETIEMBRE" else n
        if n in MESES and n not in cols:
            cols[n] = c
    return cols


def mapa_tabla(ws, ctx):
    """Fila de cabecera, columna de cada mes y filas de las claves del año actual
    (de la cabecera hacia abajo hasta la primera clave repetida, que marca el
    comienzo del bloque del año anterior). La etiqueta de la cabecera («AÑO
    ACTUAL (2025)») no se mira: en TABLA CA 2026 sigue diciendo 2025."""
    cab = None
    for r in range(1, min(ws.max_row, 20) + 1):
        if any(v is not None and clave_norm(v) == "enero" for v in
               (ws.cell(r, c).value for c in range(1, min(ws.max_column, 30) + 1))):
            cab = r
            break
    if cab is None:
        raise ErrorAgente("No encuentro la fila de cabecera con los meses en la tabla.")
    cols_mes = columnas_meses_tabla(ws, cab)
    if ctx["mes"] not in cols_mes:
        raise ErrorAgente(f"La cabecera de la tabla no tiene la columna {ctx['mes']}.")

    filas, vistos = {}, set()
    for r in range(cab + 1, ws.max_row + 1):
        v = ws.cell(r, 1).value
        if v is None or not str(v).strip():
            continue
        k = clave_norm(v)
        if k in vistos:
            break
        vistos.add(k)
        filas[k] = (r, str(v).strip())
    return cab, cols_mes, filas


def mapa_quimicos(ws):
    """Bloque «CONSUMO DE PRODUCTOS QUÍMICOS»: {producto normalizado: (fila, etiqueta)}
    hasta la fila TOTAL, y las columnas de sus meses. None si la hoja no lo tiene."""
    inicio = next((r for r in range(1, ws.max_row + 1)
                   if clave_norm(ws.cell(r, 1).value or "").startswith("consumo de productos quimicos")), None)
    if inicio is None:
        return None, {}, {}
    cols = columnas_meses_tabla(ws, inicio)
    productos = {}
    for r in range(inicio + 1, min(inicio + 40, ws.max_row + 1)):
        v = ws.cell(r, 1).value
        if v is None or not str(v).strip():
            continue
        if clave_norm(v) == "total":
            break
        productos[compacto(v)] = (r, str(v).strip())
    return inicio, cols, productos


def estado_tabla(ctx, meses_previos=3):
    wb_f = abrir_tabla(ctx, solo_valores=False)
    wb_v = abrir_tabla(ctx, solo_valores=True)
    ws_f, ws_v = hoja_tabla(wb_f, ctx), hoja_tabla(wb_v, ctx)
    cab, cols_mes, filas = mapa_tabla(ws_f, ctx)
    c_mes = cols_mes[ctx["mes"]]
    previos = [m for m in MESES[:ctx["mes_num"] - 1] if m in cols_mes][-meses_previos:]

    def fila_estado(r, etiqueta, cols):
        c = cols[ctx["mes"]]
        bruto = ws_f.cell(r, c).value
        formula = isinstance(bruto, str) and bruto.startswith("=")
        return {
            "clave": etiqueta,
            "fila": r,
            "celda": coord(r - 1, c - 1),
            "unidad": ws_f.cell(r, 2).value,
            "es_formula": formula,
            "formula": bruto if formula else None,
            "valor_actual": limpio(ws_v.cell(r, c).value),
            "meses_previos": {m: limpio(ws_v.cell(r, cols[m]).value) for m in previos if m in cols},
        }

    objetivo = {clave_norm(k) for k in CLAVES}
    estado = [fila_estado(r, etq, cols_mes) for k, (r, etq) in filas.items() if k in objetivo]

    _, cols_q, productos = mapa_quimicos(ws_f)
    quimicos = ([fila_estado(r, etq, cols_q) for _, (r, etq) in productos.items()]
                if productos and ctx["mes"] in cols_q else [])
    return {
        "hoja": ws_f.title,
        "fila_cabecera": cab,
        "columna_mes": letra(c_mes - 1),
        "filas": estado,
        "quimicos": quimicos,
        "claves_sin_fila": [k for k in CLAVES if clave_norm(k) not in filas],
        "nota": "valor_actual de una fórmula es el último valor que guardó Excel; "
                "puede estar vacío o desfasado si el fichero se guardó sin recalcular.",
    }


def respaldar(ctx):
    RESPALDOS.mkdir(exist_ok=True)
    sello = datetime.now().strftime("%Y%m%d-%H%M%S")
    destino = RESPALDOS / f"{ctx['ruta_tabla'].stem} {sello}.xlsx"
    shutil.copy2(ctx["ruta_tabla"], destino)
    copias = sorted(RESPALDOS.glob(f"{ctx['ruta_tabla'].stem} *.xlsx"))
    for vieja in copias[:-MAX_RESPALDOS]:
        vieja.unlink(missing_ok=True)
    return destino.name


def escribir(ctx, valores, quimicos=None):
    valores = valores or {}
    quimicos = quimicos or {}
    if not isinstance(valores, dict) or not isinstance(quimicos, dict) or not (valores or quimicos):
        raise ErrorAgente("'valores' ({clave: número}) y/o 'quimicos' ({producto: kg}) deben ser objetos y no ir los dos vacíos.")
    permitidas = {clave_norm(k) for k in CLAVES}

    wb = abrir_tabla(ctx, solo_valores=False)
    ws = hoja_tabla(wb, ctx)
    _, cols_mes, filas = mapa_tabla(ws, ctx)
    escritas, omitidas, sin_cambios = [], [], []

    def poner(r, c, etiqueta, valor):
        v = num(valor)
        if v is None:
            omitidas.append({"clave": etiqueta, "motivo": f"valor no numérico: {valor!r}"})
            return
        cell = ws.cell(r, c)
        if isinstance(cell.value, str) and cell.value.startswith("="):
            omitidas.append({"clave": etiqueta, "motivo": f"la celda {cell.coordinate} tiene fórmula ({cell.value}); no se pisa"})
            return
        anterior = cell.value
        # mismo valor que ya tiene la celda: no se reescribe (re-subir un CA no
        # cuenta como cambio). Una celda vacía sí se escribe, aunque sea con 0.
        previo = num(anterior)
        if previo is not None and abs(previo - v) <= 1e-9 * max(1.0, abs(v)):
            sin_cambios.append({"clave": etiqueta, "celda": cell.coordinate, "valor": limpio(v)})
            return
        cell.value = int(v) if v.is_integer() else v
        escritas.append({"clave": etiqueta, "celda": cell.coordinate, "anterior": limpio(anterior), "nuevo": limpio(v)})

    c_mes = cols_mes[ctx["mes"]]
    for clave, valor in valores.items():
        k = clave_norm(clave)
        if k not in permitidas:
            omitidas.append({"clave": clave, "motivo": "no es una de las claves que rellena este proceso"})
        elif k not in filas:
            omitidas.append({"clave": clave, "motivo": "no existe esa fila en la hoja"})
        else:
            r, etiqueta = filas[k]
            poner(r, c_mes, etiqueta, valor)

    if quimicos:
        _, cols_q, productos = mapa_quimicos(ws)
        if not productos or ctx["mes"] not in cols_q:
            omitidas.extend({"clave": f"químico {p}", "motivo": "la hoja no tiene bloque de productos químicos"} for p in quimicos)
        else:
            for producto, kg in quimicos.items():
                hit = productos.get(compacto(producto))
                if hit is None:
                    omitidas.append({"clave": f"químico {producto}", "motivo": "ese producto no tiene fila en la tabla"})
                else:
                    poner(hit[0], cols_q[ctx["mes"]], f"químico {hit[1]}", kg)

    respaldo = None
    if escritas:
        respaldo = respaldar(ctx)
        wb.save(ctx["ruta_tabla"])
    return {"escritas": escritas, "sin_cambios": sin_cambios, "omitidas": omitidas, "respaldo": respaldo,
            "hoja": ws.title, "mes": ctx["mes"],
            "nota": None if escritas else "Nada que escribir: la tabla no se ha guardado ni respaldado."}


# ---------------------------------------------------------------- avisos

def avisos_deterministas(ctx, valores, detalle, contraste, tabla):
    """Comprobaciones que no dependen del criterio del agente."""
    avisos = []
    filas = {clave_norm(f["clave"]): f for f in (tabla or {}).get("filas", [])}

    def previo(clave):
        f = filas.get(clave_norm(clave))
        if not f or not f["meses_previos"]:
            return None
        return list(f["meses_previos"].values())[-1]

    # SSTT copiado del mes anterior (pasó en Caibarién, abril de 2025)
    consumos = ["CONSUMO DIESEL PRODUCCIÓN", "CONSUMO ELECTRICIDAD", "CONSUMO AGUA"]
    if all(k in valores and valores[k]["valor"] is not None for k in consumos):
        prev = [previo(k) for k in consumos]
        if all(p is not None for p in prev) and all(
                abs(valores[k]["valor"] - p) < 0.5 for k, p in zip(consumos, prev)):
            avisos.append("Los tres consumos de SSTT son idénticos a los del mes anterior en la tabla: "
                          "probablemente la hoja SSTT del CA no se actualizó.")
    # capacidad instalada: casi constante; un cambio merece revisión
    cap = valores.get("CAPACIDAD INSTALADA POR HORA", {}).get("valor")
    p = previo("CAPACIDAD INSTALADA POR HORA")
    if cap is not None and p not in (None, 0) and abs(cap - p) > 0.5:
        avisos.append(f"La capacidad instalada calculada ({cap}) cambia frente al mes anterior ({p}).")
    # coherencias internas
    v = {k: x["valor"] for k, x in valores.items()}
    if (v.get("DE ELLOS PROPIOS") or 0) > (v.get("VEHÍCULOS EN USO TOTALES") or 0):
        avisos.append("Hay más vehículos propios que en uso totales.")
    for k in ("CDT EQUIPOS", "CDO EQUIPOS"):
        if v.get(k) is not None and not 0 <= v[k] <= 100:
            avisos.append(f"{k} fuera de 0-100: {v[k]}.")
    if v.get("EVALUACIÓN CALIDAD HOTELES") is not None and not 0 <= v["EVALUACIÓN CALIDAD HOTELES"] <= 5:
        avisos.append("La evaluación de calidad no está entre 0 y 5.")
    if v.get("HORAS TRABAJADAS") is not None and v["HORAS TRABAJADAS"] > 24:
        avisos.append("Horas trabajadas por encima de 24.")
    # GLOBAL frente al CA
    for k, (cv, co) in contraste.items():
        gv = valores.get(k, {}).get("valor")
        if gv is not None and cv is not None and abs(gv - cv) > max(1, abs(gv) * 0.001):
            avisos.append(f"{k}: GLOBAL {gv} y CA {limpio(cv)} ({co}) no coinciden.")
    if detalle.get("transporte", {}).get("excluidos"):
        avisos.append("Transporte con criterio 'carga': fuera " + ", ".join(detalle["transporte"]["excluidos"]) + ".")
    return avisos


# ---------------------------------------------------------------- volcados

def ver_hoja(ctx, hoja, desde=1, hasta=None, max_celdas=1500):
    wb = abrir_cd(ctx)
    nombre = hoja_fuzzy(wb, hoja)
    g = rejilla(wb[nombre])
    wb.close()
    hasta = min(hasta or len(g), len(g))
    lineas, total = [], 0
    for r in range(max(desde, 1) - 1, hasta):
        partes = []
        for c, v in enumerate(g[r]):
            if v is None or (isinstance(v, str) and not v.strip()):
                continue
            partes.append(f"{coord(r, c)}={limpio(v)}")
        if partes:
            lineas.append(" | ".join(partes))
            total += len(partes)
        if total >= max_celdas:
            lineas.append(f"... (cortado en la fila {r + 1}; pide 'desde': {r + 2} para seguir)")
            break
    return {"hoja": nombre, "filas_totales": len(g), "celdas": "\n".join(lineas)}


def ver_global(ctx, buscar_txt=None):
    filas, col_real, _ = filas_global(ctx)
    if buscar_txt:
        b = clave_norm(buscar_txt)
        filas = [f for f in filas if f["titulo"] is not None and b in clave_norm(f["titulo"])]
    return {"hoja": ctx["hoja_global"], "mes": ctx["mes"], "columna_real": col_real,
            "filas": [f for f in filas if f["titulo"] is not None][:400]}


# ---------------------------------------------------------------- comandos

def cmd_preparar(ctx, _):
    pub = contexto_publico(ctx)
    wb = abrir_cd(ctx)
    pub["hojas_cd"] = wb.sheetnames
    wb.close()

    v_cd, e_cd, detalle, contraste = extraccion_cd(ctx)
    v_gl, e_gl, aviso_global = extraccion_global(ctx)
    valores, errores = {**v_cd}, {**e_cd}
    # Las seis cifras económicas salen del GLOBAL (es lo que enlaza la tabla).
    # Si el GLOBAL no las tiene, se usa el CA, salvo el VAB, que el CA no trae.
    for k in GLOBAL_FILAS:
        if k in v_gl:
            valores[k] = v_gl[k]
        elif k in contraste and k != "VALOR AGREGADO BRUTO":
            cv, co = contraste[k]
            valores[k] = {"valor": limpio(cv), "origen": f"{co} (CA; el GLOBAL no lo da: {e_gl.get(k)})"}
        else:
            errores[k] = e_gl.get(k, "sin dato")
    try:
        tabla = estado_tabla(ctx)
    except Exception as e:
        tabla = {"error": f"{type(e).__name__}: {e}"}

    return {
        "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "contexto": pub,
        "extraccion": {"valores": valores, "errores": errores,
                       "quimicos": detalle.get("quimicos"),
                       "quimicos_origen": detalle.get("quimicos_origen") or detalle.get("quimicos_error"),
                       "transporte": detalle.get("transporte"),
                       "contraste_economia_ca": detalle.get("contraste_economia")},
        "avisos": avisos_deterministas(ctx, valores, detalle,
                                       {k: x for k, x in contraste.items() if k in v_gl}, tabla),
        "aviso_global": aviso_global,
        "tabla": tabla,
    }


COMANDOS = {
    "preparar": cmd_preparar,
    "ver_hoja": lambda ctx, a: ver_hoja(ctx, a.get("hoja", ""), int(a.get("desde") or 1),
                                        int(a["hasta"]) if a.get("hasta") else None),
    "ver_global": lambda ctx, a: ver_global(ctx, a.get("buscar")),
    "estado_tabla": lambda ctx, a: estado_tabla(ctx, int(a.get("meses_previos") or 3)),
    "escribir": lambda ctx, a: escribir(ctx, a.get("valores"), a.get("quimicos")),
    "limpiar": lambda ctx, a: {"borrado": (ctx["ruta_cd"].unlink(missing_ok=True) or True)},
}


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2 or sys.argv[1] not in COMANDOS:
        salir({"ok": False, "error": f"Uso: agente_ca.py <{'|'.join(COMANDOS)}> '<json>'"})
    try:
        args = json.loads(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].strip() else {}
        if isinstance(args, str):  # el agente a veces manda el JSON doblemente serializado
            args = json.loads(args)
        for k in ("valores", "quimicos"):
            if isinstance(args.get(k), str):
                args[k] = json.loads(args[k]) if args[k].strip() else {}
        ctx = contexto(args.get("cd"))
        salir({"ok": True, **COMANDOS[sys.argv[1]](ctx, args)})
    except ErrorAgente as e:
        salir({"ok": False, "error": str(e)})
    except Exception as e:
        salir({"ok": False, "error": f"{type(e).__name__}: {e}"})


if __name__ == "__main__":
    main()
