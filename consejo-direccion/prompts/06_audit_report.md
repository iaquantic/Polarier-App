# Prompt 06 — Auditoría del informe generado

## Cuándo usar
Después de generar el informe (Prompt 05), o cuando se quiere verificar un informe ya existente.

## Prerequisitos
- `data/output/informe_YYYYMM.md` existe.
- `data/processed/table_YYYYMM.json` existe (tabla del mes procesada).
- `config/review_rules.yaml` con reglas cargadas.

## Instrucción para Claude Code

Audita el informe de Consejo de Dirección de [YYYY-MM] y determina si puede entregarse.

### Verificación 1: Integridad numérica

Para cada número que aparezca en el informe:
1. Identificar a qué columna y fila de la tabla corresponde.
2. Comparar el valor del texto con el valor de la tabla.
3. Si hay discrepancia: registrar como ERROR con localización exacta.
4. Si el número no puede mapearse a la tabla: registrar como ADVERTENCIA.

### Verificación 2: Cálculos derivados

Para cada desviación, porcentaje o ranking mencionado:
1. Recalcular usando los datos de la tabla.
2. Verificar que el resultado del texto coincide.
3. Tolerancia: ±0.1% para porcentajes, ±1 unidad para enteros.

### Verificación 3: Expresiones prohibidas

Buscar y reportar todas las ocurrencias de:
- "aproximadamente", "en torno a", "alrededor de"
- "se estima", "se calcula", "se supone"
- "podría", "probablemente", "parece que"
- "es importante destacar", "cabe señalar", "como se puede ver"

### Verificación 4: Cumplimiento de reglas de revisión

Para cada regla en `config/review_rules.yaml`:
1. Si la regla tiene `severity: error`: verificar activamente que no se viola.
2. Si la regla tiene `severity: advertencia`: verificar y registrar si se detecta.
3. Reportar sección y fragmento de texto donde se produce cada violación.

### Verificación 5: Completitud del informe

1. Verificar que todas las secciones de `config/report_sections.yaml` están presentes.
2. Verificar que ninguna sección contiene solo el texto de esqueleto (sin contenido real).
3. Verificar que los marcadores `[dato no disponible]` están correctamente formados.

### Verificación 6: Coherencia interna

1. Si el mismo indicador aparece en varias secciones, verificar que los valores son consistentes.
2. Si hay totales y subtotales, verificar que los subtotales suman el total.

### Reporte final de auditoría

Mostrar:
```
=== AUDITORÍA DEL INFORME [MES] ===

ERRORES (bloquean entrega):
  [ERROR 1]: [descripción + sección + fragmento]
  [ERROR 2]: ...

ADVERTENCIAS (deben revisarse):
  [WARN 1]: [descripción]

ESTADÍSTICAS:
  Cifras verificadas: X
  Cifras validadas correctamente: X
  Reglas verificadas: X
  Reglas cumplidas: X

VEREDICTO: APROBADO / BLOQUEADO
```

Guardar el reporte en `data/processed/audit_YYYYMM.json`.

## Restricciones
- No modificar el informe durante la auditoría.
- No aprobar el informe si hay errores de categoría "error".
- El veredicto es definitivo hasta que se corrijan los problemas y se re-audite.
