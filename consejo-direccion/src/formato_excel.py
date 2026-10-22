"""
Escribe un número como lo enseña Excel con el formato de su celda.

Las tablas del informe se copiaban de la TABLA CA a Word, así que cada cifra
salía con el formato de su celda: «1,234,567.89», «42.16», «50%», «-» para un
cero en formato contable. Aquí se reproduce eso para los formatos que usan la
TABLA CA y el GLOBAL; no es un intérprete completo de formatos de Excel.

Los errores (#DIV/0!…) salen como «-»: en un informe del Consejo un error de
Excel no aporta nada y el que lo genere lo verá en la lista de avisos.
"""
from __future__ import annotations

import math
import re
from typing import Optional

from excel_eval import Err


def _redondear(x: float, dec: int) -> float:
    q = 10 ** dec
    return math.floor(abs(x) * q + 0.5) / q * (1 if x >= 0 else -1)


def _numero(x: float, dec: int, miles: bool) -> str:
    x = _redondear(x, dec)
    if x == 0:
        x = 0.0  # sin «-0.00»
    s = f"{abs(x):,.{dec}f}" if miles else f"{abs(x):.{dec}f}"
    return ("-" if x < 0 else "") + s


def _seccion(fmt: str, valor: float) -> str:
    """Excel admite 'positivo;negativo;cero;texto'. Devuelve la sección que toca."""
    partes = re.split(r";(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", fmt)
    if len(partes) == 1:
        return partes[0]
    if valor > 0 or (valor == 0 and len(partes) < 3):
        return partes[0]
    if valor < 0:
        return partes[1]
    return partes[2]


def formatear(valor, fmt: Optional[str] = "General") -> str:
    """Texto de una celda como la pinta Excel. Vacía → ''."""
    if valor is None:
        return ""
    if isinstance(valor, Err):
        return "-"
    if isinstance(valor, bool):
        return "VERDADERO" if valor else "FALSO"
    if isinstance(valor, str):
        return valor.strip()
    if hasattr(valor, "strftime"):
        return valor.strftime("%d/%m/%Y")
    x = float(valor)
    if math.isnan(x) or math.isinf(x):
        return "-"
    fmt = fmt or "General"
    if fmt == "General":
        if float(x).is_integer():
            return str(int(x))
        return _numero(x, 2, False) if abs(x) < 1e15 else str(x)
    sec = _seccion(fmt, x)
    negativo_explicito = ";" in fmt and x < 0  # la sección negativa ya trae su signo
    limpio = re.sub(r'"[^"]*"', lambda m: m.group(0) if m.group(0) == '"-"' else "", sec)
    limpio = re.sub(r"_.", "", limpio)          # _- _€ : espacios de alineación
    limpio = re.sub(r"\\.", "", limpio)         # \- \  : literales escapados
    limpio = limpio.replace("*", "").replace("?", "").strip()
    if x == 0 and '"-"' in limpio:
        return "-"
    porcentaje = "%" in limpio
    if porcentaje:
        x = x * 100
    m = re.search(r"[#0][#0,]*(?:\.(0+))?", limpio)
    dec = len(m.group(1)) if m and m.group(1) else 0
    miles = bool(m and "," in m.group(0))
    s = _numero(abs(x) if negativo_explicito else x, dec, miles)
    if negativo_explicito:
        s = "-" + s
    return s + ("%" if porcentaje else "")
