# Skill: PDF Final Report Analysis

## Identificador
`pdf-final-report-analysis`

## Propósito
Analizar los PDF finales aprobados del Consejo de Dirección para extraer la estructura canónica del informe, los patrones de análisis recurrentes, el vocabulario ejecutivo validado y las métricas que siempre aparecen.

## Cuándo aplicar
- Al incorporar nuevos PDF finales al sistema.
- Al ejecutar el comando `discover`.
- Cuando se desea actualizar los patrones de análisis con nuevos documentos.

---

## Proceso paso a paso

### Paso 1: Extracción de texto con metadatos
Usar PyMuPDF para extraer texto con información de formato (tamaño de fuente, posición, página).
Procesar página por página para mantener el orden correcto.

### Paso 2: Detección de secciones
Aplicar la skill `document-structure-mining` para identificar la jerarquía de secciones.
La estructura canónica detectada en los históricos es:

| Orden | Sección | Epígrafe canónico |
|---|---|---|
| 1 | Economía / Ingresos | "Cumplimiento del Plan de Ingresos" |
| 2 | Producción | "Producción" |
| 3 | Lencería | "Lencería" |
| 4 | Servicios Técnicos | "Servicios Técnicos" |
| 5 | Transporte | "Transporte" |
| 6 | Gestión de la Calidad | "Gestión de la Calidad" |
| 7 | Recursos Humanos | "Recursos Humanos" |
| 8 | Valoración Sintetizada | "Valoración Sintetizada" |
| 9 | Riesgos | "Riesgos" |
| 10 | Conclusiones | "Conclusiones y Acciones" |

### Paso 3: Análisis de métricas
Buscar en el texto:
- Patrones numéricos: porcentajes, cifras absolutas, unidades.
- Referencias a plan, presupuesto, meta, objetivo.
- Monedas: CUP, MLC, USD.
- Unidades físicas: kg, ton, litros, unidades, servicios, piezas, prendas.

### Paso 4: Detección de patrones comparativos
Identificar frases que expresan:
- Comparación plan vs real.
- Comparación vs mes anterior.
- Comparación vs mismo mes año anterior.
- Desviaciones absolutas y porcentuales.

### Paso 5: Análisis de estructura narrativa por sección
Para cada sección, identificar si sigue alguno de estos patrones (ver `business-analysis-patterns`):
- Patrón 1: Plan vs Real (comparación triple).
- Patrón 2: Polo-a-polo con atribución.
- Patrón 3: Partidas sobregiradas (lista numerada).
- Patrón 4: Interanual con explicación.
- Patrón 5: Ejercicio de ocupación (prospectivo).
- Patrón 6: Lencería (Arribos + Inyecciones).
- Patrón 7: CDT/CDO (Servicios Técnicos).
- Patrón 8: Valoración Sintetizada (5–6 párrafos + "En conjunto").
- Patrón 9: Conclusiones (3–6 acciones en infinitivo).

### Paso 6: Extracción de vocabulario ejecutivo

**Vocabulario de alta frecuencia detectado en históricos:**

| Término / Frase | Contexto de uso |
|---|---|
| se sitúa en | Dato actual de cualquier indicador |
| alcanza un X% | Cumplimiento o participación |
| representa un cumplimiento del | % plan en ingresos o costos |
| se comportó a un X% | % plan en costos |
| evidenciando | Conector de consecuencia directa |
| evidencia | Verbo de análisis de tendencia |
| a nivel consolidado | Apertura de párrafo consolidado |
| de manera consolidada | Variante de apertura consolidada |
| desviación negativa | Incumplimiento del plan |
| desviación favorable | Superación del plan |
| sobregiro | Costos que superan el plan |
| partidas sobregiradas | Subsección de costos |
| potenciación de ingresos | Estrategia de incremento de ingresos |
| ingresos dejados de percibir | Ingreso potencial no realizado |
| montas de lencería | Procesamiento de ropa (kg o unidades) |
| inyecciones de lencería | Incorporación de prendas nuevas al ciclo |
| arribos de lencería | Recepción de prendas de proveedor |
| prendas | Artículos de lencería (tipo) |
| piezas | Artículos de lencería (cantidad) |
| CDT | Costo Directo de Trabajo |
| CDO | Costo Directo de Operaciones |
| No obstante | Pivote principal de contraste |
| Sin embargo | Contraste fuerte |
| A pesar de | Concesivo ante logros parciales |
| Por su parte | Cambio de polo o sub-indicador |
| En contraste | Comparación directa entre polos |
| Si bien | Concesión inicial antes del análisis |
| En conjunto | Apertura del párrafo final de Valoración |
| en el período analizado | Referencia temporal del informe |
| en relación a [año] | Comparación interanual |
| motivado por | Causa de desviación |
| atribuible a | Causa de resultado |
| lo que se traduce en | Consecuencia de un indicador |
| carácter analítico y prospectivo | Calificador del ejercicio de ocupación |
| Informe de Fundamentación | Documento de referencia para lencería |
| Taimi | Responsable de lencería (fuente de datos) |
| polo | Unidad operativa territorial |
| consolidado | Suma de todos los polos |

### Paso 7: Guardado de resultados
Actualizar `config/analysis_patterns.yaml` con los patrones detectados.
Guardar ejemplos en `data/extracted/pattern_examples.json`.

---

## Patrones de frecuencia detectados en históricos

### Plan vs Real (comparación triple)
- Frecuencia: presente en TODAS las secciones con datos financieros
- Señal de detección: columnas "Plan" y "Real" en la misma tabla
- Variante positiva: "representando el X% del plan previsto, con una desviación favorable"
- Variante negativa: "No obstante, el cumplimiento se sitúa en X%, con desviación de -Y"

### Polo-a-polo con atribución
- Frecuencia: presente en todas las secciones con desglose territorial
- Señal: tabla con filas por polo (La Habana, Varadero, Caibarién, Cayo Coco, Cayo Cruz, Holguín)
- Siempre nombra el polo líder Y el polo rezagado. Nunca omite el peor.

### Partidas sobregiradas
- Frecuencia: presente en sección de Costos cuando hay partidas con Real > Plan
- Formato: lista numerada, no párrafo
- Todas las partidas sobregiradas se incluyen sin excepción

### Comparación interanual
- Frecuencia: obligatoria si la tabla tiene columna del año anterior
- Señal: columna "2024" o "Año anterior" o "Real año anterior"
- Cuantifica siempre: %, absoluto, y causa

### Pivote "No obstante"
- Frecuencia: al menos una vez por sección con datos mixtos
- Posición: inmediatamente después del primer dato positivo o de contexto
- Nunca se usa para introducir solo datos positivos

### Cierre "En conjunto"
- Frecuencia: siempre en la sección Valoración Sintetizada
- Posición: párrafo final de la sección
- Patrón: "En conjunto, el período analizado evidencia [evaluación global]."

---

## Restricciones
- Solo analizar PDF en `data/historical/final_pdfs/`.
- No analizar PDF de borradores ni de otras fuentes.
- Si un PDF está escaneado (sin texto extraíble), registrar advertencia.

## Outputs esperados
- `config/analysis_patterns.yaml` (actualizado)
- `data/extracted/pattern_examples.json`
- `data/extracted/pdf_metrics.json`
