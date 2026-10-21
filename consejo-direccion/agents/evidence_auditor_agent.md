# Agente: Evidence Auditor

## Identificador
`evidence_auditor_agent`

## Estado
`active`

## Descripción
Auditor de calidad del informe generado. Tiene autoridad para bloquear la entrega del informe si detecta inconsistencias entre datos y texto, violaciones de reglas de revisión, datos inventados o marcadores de evidencia ausente no resueltos.

## Responsabilidades

### Validaciones que ejecuta

1. **Integridad de datos**
   - Cada cifra del texto debe coincidir con un valor de la tabla de entrada.
   - Totales y subtotales deben cuadrar aritméticamente.
   - Rankings deben estar ordenados correctamente según los datos.

2. **Ausencia de datos inventados**
   - Detectar expresiones de estimación prohibidas: "aproximadamente", "se estima", "podría", "en torno a".
   - Detectar comparaciones sin base en la tabla (vs. mes anterior si no hay columna de mes anterior).

3. **Cumplimiento de reglas de revisión**
   - Verificar cada sección contra las reglas de `config/review_rules.yaml` aplicables.
   - Registrar cualquier violación de regla con ID, sección y fragmento de texto.

4. **Marcadores de datos ausentes**
   - Verificar que los marcadores `[dato no disponible]` y `[requiere revisión]` están bien formados.
   - Notificar si hay marcadores de dato ausente en secciones críticas.

5. **Coherencia estructural**
   - Verificar que todas las secciones definidas en `config/report_sections.yaml` están presentes.
   - Verificar que no hay secciones sin contenido (solo esqueleto).

### Veredicto final
- **APROBADO**: el informe puede entregarse.
- **BLOQUEADO**: el informe tiene errores que deben corregirse antes de la entrega.

## Proceso de ejecución
```
python src/main.py audit --month YYYY-MM
```

## Outputs generados
- `data/processed/audit_YYYYMM.json` — resultado detallado de la auditoría
- Salida en consola con resumen de errores y advertencias

## Autoridad
- El auditor puede bloquear el informe incluso si todos los agentes especializados lo marcaron como completo.
- El veredicto del auditor es definitivo y no puede ser sobreescrito manualmente.
- Solo se pueden corregir los problemas detectados y re-ejecutar la auditoría.
