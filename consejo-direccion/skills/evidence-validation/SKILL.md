# Skill: Evidence Validation

## Identificador
`evidence-validation`

## Propósito
Validar que toda afirmación cuantitativa del informe está respaldada por datos reales de la tabla de entrada, que los cálculos son correctos, que no existe ningún dato inventado o estimado, y que se cumplen todas las reglas correctivas derivadas de las revisiones históricas de la dirección.

## Cuándo aplicar
- Al finalizar la generación de cualquier sección.
- Al ejecutar el comando `audit`.
- Antes de entregar el informe al Consejo de Dirección.

---

## Proceso paso a paso

### Paso 1: Extracción de afirmaciones cuantitativas
Leer el texto de la sección e identificar todas las afirmaciones que contienen:
- Números absolutos (cifras, cantidades).
- Porcentajes.
- Posiciones de ranking (primero, segundo, último, mayor, menor).
- Comparaciones (mayor que, menor que, X% más que).
- Totales y subtotales.

### Paso 2: Mapeo a la tabla de entrada
Para cada afirmación cuantitativa:
- Identificar la columna o fila de la tabla que debe respaldarla.
- Comparar el valor del texto con el valor de la tabla (tolerancia: 0 — coincidencia exacta).
- Registrar: ✓ validado | ✗ discrepancia | ? no encontrado en tabla.

**Regla estricta:** "88,75%" en la tabla → "88,75%" en el texto. No "88,7%", no "89%".

### Paso 3: Verificación aritmética de totales (RULE-009)
Para cada total o subtotal mencionado en el texto:
- Sumar manualmente los componentes desde la tabla.
- Verificar que el total publicado es correcto.
- Registrar como ERROR si el total no cuadra aritméticamente.

### Paso 4: Verificación de cobertura de partidas sobregiradas (RULE-002)
Para la sección de Costos:
- Extraer de la tabla todas las partidas con valor real > plan (sobregiro).
- Confirmar que cada una de ellas aparece en el texto o en la lista de partidas sobregiradas.
- Registrar como ERROR cualquier partida sobregirada ausente del análisis.

### Paso 5: Verificación de comparaciones obligatorias (RULE-003, RULE-004, RULE-005)
Para cada sección con indicadores financieros, verificar que el texto incluye:
- [ ] % cumplimiento respecto al plan.
- [ ] Desviación absoluta respecto al plan.
- [ ] Comparación interanual (vs mismo período año anterior) — si hay columna disponible.

Si la columna interanual no existe en la tabla: marcar con `[dato no disponible: comparación interanual]`.
Si la columna existe pero el texto no la menciona: ERROR.

### Paso 6: Verificación de coherencia lencería (RULE-007, RULE-008)
Para la sección de Lencería:
- Reconciliar el total de piezas con el Informe de Fundamentación (si está disponible).
- Verificar que las prendas de mayor inyección listadas en el texto coinciden exactamente con las de la tabla (no inferir de otros documentos).

### Paso 7: Verificación de coherencia sección-epígrafe (RULE-010)
Para cada sección:
- Confirmar que el contenido del texto pertenece al área temática del epígrafe.
- ERROR si una sección contiene datos o análisis de otra sección (ej.: datos de RRHH en sección de Calidad).

### Paso 8: Verificación de paginación de tablas (RULE-006)
Para cada tabla del documento:
- Verificar que la tabla no está configurada para dividirse entre páginas.
- Advertencia si la tabla tiene más de 20 filas (riesgo de división involuntaria).

### Paso 9: Detección de expresiones prohibidas
Buscar en el texto expresiones que indican datos no respaldados:
- "aproximadamente", "en torno a", "alrededor de", "más o menos"
- "se estima", "se calcula que", "podría ser", "podría indicar"
- "probablemente", "parece que", "al parecer", "prácticamente", "casi"

### Paso 10: Verificación de marcadores de ausencia
Confirmar que los marcadores `[dato no disponible]` y `[requiere revisión]` están correctamente formados y en las posiciones apropiadas.

### Paso 11: Generación del reporte de validación
Producir un reporte con:
- Total de afirmaciones verificadas.
- Afirmaciones validadas correctamente.
- Discrepancias detectadas (con descripción y ubicación).
- Expresiones prohibidas encontradas.
- Partidas sobregiradas no analizadas (si aplica).
- Comparaciones obligatorias ausentes.
- Veredicto final: APROBADO o BLOQUEADO.

---

## Criterios de bloqueo

El informe se bloquea (veredicto BLOQUEADO) si:
- Cualquier número del texto no coincide exactamente con la tabla.
- Se detecta cualquier expresión de estimación o dato inventado.
- Hay comparaciones sin columna de referencia en la tabla.
- Los marcadores de ausencia están malformados.
- Un total aritmético no cuadra (RULE-009).
- Una partida sobregirada no aparece en el análisis de Costos (RULE-002).
- La comparación interanual está ausente cuando la columna existe (RULE-004/RULE-005).
- El contenido de una sección no corresponde a su epígrafe (RULE-010).

---

## Restricciones
- La validación no puede omitirse bajo ninguna circunstancia.
- No aprobar el informe con advertencias no resueltas en secciones críticas.
- El veredicto del auditor no puede modificarse manualmente.

## Outputs esperados
- `data/processed/audit_YYYYMM.json` — reporte de validación detallado
- Veredicto: APROBADO o BLOQUEADO

---

## Reglas extraídas de revisiones históricas

### RULE-001 — ESTRUCTURA [obligatorio]
**Regla:** Incluir "Arribos de Lencería" como primer punto de la sección de Lencería.
**Fuente:** informe_202412_draft.docx
**Verificación:** La sección de Lencería comienza con el subsección de Arribos antes de Inyecciones.

### RULE-002 — DATOS [error — bloquea]
**Regla:** Todas las partidas de costos sobregiradas deben analizarse. No omitir ninguna aunque el sobregiro sea pequeño.
**Fuente:** informe_202412_draft.docx
**Verificación:** Extraer de la tabla todas las filas donde Real > Plan en sección de Costos y confirmar que cada una está mencionada en el texto.

### RULE-003 — DATOS [obligatorio]
**Regla:** Los costos deben incluir su % de cumplimiento respecto al plan en el texto (ej.: "los costos con respecto al plan se comportaron a un 64,73%").
**Fuente:** informe_202412_draft.docx
**Verificación:** La sección de Costos contiene una frase con "% respecto al plan" o "comportaron a un X%".

### RULE-004 — DATOS [obligatorio]
**Regla:** Los costos deben incluir comparación interanual indicando si fueron superiores o inferiores por polo, con explicación breve.
**Fuente:** informe_202412_draft.docx
**Verificación:** La sección de Costos menciona comparación vs año anterior para al menos el consolidado.

### RULE-005 — DATOS [obligatorio]
**Regla:** El análisis interanual debe incluir, si existe, el sobregiro respecto al año anterior con su porcentaje y causa.
**Fuente:** informe_202412_draft.docx
**Verificación:** Si la tabla muestra sobregiro interanual, el texto lo cuantifica y explica.

### RULE-006 — MAQUETACION [advertencia]
**Regla:** Las tablas no deben dividirse entre páginas (la última fila no puede quedar en página siguiente).
**Fuente:** informe_202412_draft.docx
**Verificación:** Revisar propiedades de tabla en DOCX; activar "keep together" si el agente de diseño lo permite.

### RULE-007 — COHERENCIA [error — bloquea]
**Regla:** Los datos de lencería deben reconciliarse con el Informe de Fundamentación antes de publicar. Si hay discrepancia, investigar y resolver — no publicar el dato sin verificar.
**Fuente:** informe_202412_draft.docx
**Verificación:** El total de piezas de lencería coincide con el Informe de Fundamentación, o hay nota explícita de discrepancia investigada.

### RULE-008 — COHERENCIA [error — bloquea]
**Regla:** Las prendas con mayores inyecciones listadas en el texto deben coincidir exactamente con las de la tabla (en nombre y en orden descendente).
**Fuente:** informe_202412_draft.docx
**Verificación:** Las prendas listadas en el texto son las mismas que encabezan la columna de inyecciones en la tabla, en el mismo orden.

### RULE-009 — DATOS [error — bloquea]
**Regla:** Verificar aritméticamente todos los totales publicados. Un total que no cuadra indica error en la tabla de entrada o en el análisis.
**Fuente:** informe_202412_draft.docx
**Verificación:** Sumar componentes desde la tabla y confirmar que coinciden con el total del texto.

### RULE-010 — ESTRUCTURA [error — bloquea]
**Regla:** El contenido de cada sección debe corresponder al epígrafe de esa sección. No mezclar contenido de áreas distintas.
**Fuente:** informe_202412_draft.docx
**Verificación:** Leer el epígrafe y confirmar que cada párrafo del texto pertenece temáticamente a ese epígrafe.

### RULE-011 — DATOS [obligatorio]
**Regla:** Antes de generar el informe, confirmar con la fuente (Taimi u otro responsable) que la tabla de entrada es la versión actualizada definitiva.
**Fuente:** informe_202501_draft.docx
**Verificación:** El archivo de tabla de entrada corresponde a la versión más reciente proporcionada por el usuario.
