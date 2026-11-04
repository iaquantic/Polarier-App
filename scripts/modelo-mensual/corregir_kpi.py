# Genera la plantilla corregida del Modelo Mensual: recupera la columna Base de
# KPI_calidad, que se borró del libro y dejó #REF! en sus fórmulas y en Resumen.
#
#   python scripts/modelo-mensual/corregir_kpi.py "Modelo Mensual.xlsx" "Modelo Mensual corregido.xlsx"
#
# Solo mueve la tabla de indicadores (filas 10 a 20): las encuestas y controles de
# debajo siguen en sus celdas. No escribe sobre el original ni añade datos.
import sys
from copy import copy
import openpyxl
from openpyxl.formatting.rule import Rule
from openpyxl.worksheet.cell_range import MultiCellRange

ORIGEN, DESTINO = sys.argv[1], sys.argv[2]
if ORIGEN == DESTINO:
    raise SystemExit("El destino tiene que ser otro archivo: el original no se toca.")

wb = openpyxl.load_workbook(ORIGEN)
ws = wb["KPI_calidad"]
if ws["C10"].value == "Base":
    raise SystemExit("Este libro ya tiene la columna Base.")
if ws["C10"].value != "Meta SLA":
    raise SystemExit(f"KPI_calidad!C10 dice «{ws['C10'].value}»: no es el libro esperado.")


def copiar_estilo(desde, hasta):
    hasta.font = copy(desde.font)
    hasta.fill = copy(desde.fill)
    hasta.border = copy(desde.border)
    hasta.alignment = copy(desde.alignment)
    hasta.number_format = desde.number_format
    hasta.protection = copy(desde.protection)


# C, D, E, F, G pasan a D, E, F, G, H.
for fila in range(10, 21):
    for letra_desde, letra_hasta in zip("GFEDC", "HGFED"):
        desde = ws[f"{letra_desde}{fila}"]
        hasta = ws[f"{letra_hasta}{fila}"]
        hasta.value = desde.value
        copiar_estilo(desde, hasta)
    copiar_estilo(ws[f"B{fila}"], ws[f"C{fila}"])
    ws[f"C{fila}"].value = None
ws["C10"].value = "Base"

for fila in range(11, 21):
    ws[f"E{fila}"].value = (
        f'=IF(COUNT(B{fila}:C{fila})<2,"Completar",IF(OR(B{fila}<0,C{fila}<0,B{fila}>C{fila}),"Revisar",'
        f'IF(C{fila}=0,"No aplica",B{fila}/C{fila})))'
    )
    # Mismo criterio que `cumplimientoKpi` en src/lib/control.ts.
    ws[f"F{fila}"].value = (
        f'=IF(ISNUMBER(E{fila}),IF(ISNUMBER(D{fila}),IF(E{fila}>=D{fila},"Cumple","No cumple"),"Completar"),E{fila})'
    )

# Validación de datos: Base admite lo mismo que Cantidad.
for dv in ws.data_validations.dataValidation:
    if "B11:B20" in str(dv.sqref):
        dv.sqref = MultiCellRange(f"{dv.sqref} C11:C20")

# Los colores de Cumplimiento van una columna a la derecha.
reglas = ws.conditional_formatting._cf_rules
for rango in list(reglas.keys()):
    if str(rango.sqref) == "E11:E20":
        lista = reglas.pop(rango)
        for regla in lista:
            ws.conditional_formatting.add("F11:F20", Rule(**{k: getattr(regla, k) for k in ("type", "operator", "formula", "dxf", "priority", "stopIfTrue", "text")}))

for letra, ancho in {"C": 13, "D": 18, "E": 24, "F": 18, "G": 33, "H": 66}.items():
    ws.column_dimensions[letra].width = ancho

# Resumen lee de las columnas nuevas y deja de tener #REF!.
rs = wb["Resumen"]
for i in range(10):
    fila_r, fila_k = 26 + i, 11 + i
    rs[f"B{fila_r}"].value = f"=KPI_calidad!D{fila_k}"
    rs[f"C{fila_r}"].value = f"=KPI_calidad!E{fila_k}"
    rs[f"D{fila_r}"].value = f"=KPI_calidad!F{fila_k}"
rs["B37"].value = '=COUNTIFS(KPI_calidad!F11:F20,"Cumple")'
rs["D37"].value = '=COUNTIFS(KPI_calidad!F11:F20,"Cumple")+COUNTIFS(KPI_calidad!F11:F20,"No cumple")'
# La escala se borró con la misma columna: «Escala / soporte» pasa a leer el documento.
rs["I26"].value = '=IF(KPI_calidad!D27="","Completar escala",KPI_calidad!D27)'
rs["I27"].value = '=IF(KPI_calidad!D28="","Completar escala",KPI_calidad!D28)'

restantes = [
    f"{h.title}!{c.coordinate}"
    for h in wb.worksheets
    for fila in h.iter_rows()
    for c in fila
    if isinstance(c.value, str) and "#REF!" in c.value
]
if restantes:
    raise SystemExit(f"Quedan referencias rotas: {restantes[:10]}")

# Sin valores guardados: que Excel lo calcule todo al abrirlo.
wb.calculation.fullCalcOnLoad = True
wb.save(DESTINO)
print("Plantilla corregida en", DESTINO)
