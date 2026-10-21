# Skill: Business Analysis Patterns

## Identificador
`business-analysis-patterns`

## Propósito
Aplicar los patrones de análisis empresarial exactos detectados en los PDF finales aprobados del Consejo de Dirección de Polarier, para generar texto narrativo coherente con el estilo histórico validado.

## Cuándo aplicar
- Al generar el contenido de cualquier sección del informe mensual.
- Cuando un agente especializado necesita estructurar su análisis.
- Al revisar si el texto generado sigue la estructura narrativa canónica.

---

## Patrón 1: Plan vs Real (comparación triple obligatoria)

**Uso:** Cualquier indicador con columnas Plan y Real en la tabla. Es el patrón más frecuente del informe.

**Estructura:**
1. Dato consolidado real del período.
2. % cumplimiento respecto al plan.
3. Desviación absoluta (con signo).
4. Variación interanual (vs mismo período año anterior).
5. Si la desviación es negativa → pivote "No obstante" + causa.

**Plantilla aprobada:**
> "A nivel consolidado, [indicador] se sitúa en [valor real] [unidad], lo que representa un cumplimiento del [X]% respecto al plan, con una desviación de [±valor] [unidad]. No obstante, [causa de la desviación]. En relación a [año anterior], [indicador] fue [superior/inferior] en [X]%, [causa o contexto]."

**Variante cuando el cumplimiento es positivo:**
> "A nivel consolidado, [indicador] alcanza [valor real] [unidad], representando el [X]% del plan previsto, con una desviación favorable de [+valor] [unidad]. En relación a [año anterior], se evidencia un incremento de [X]%."

---

## Patrón 2: Polo-a-polo con atribución

**Uso:** Siempre que el indicador se desglosa por los 6 polos operativos.

**Polos:** La Habana, Varadero, Caibarién, Cayo Coco, Cayo Cruz, Holguín (+ Consolidado).

**Estructura:**
1. Dato consolidado (apertura obligatoria).
2. Polo de mayor cumplimiento + su valor + su % plan.
3. Polo de menor cumplimiento + su valor + su desviación.
4. Mención del resto: "El resto de los polos se mantiene en rangos [adjetivo]" o lista breve.

**Plantilla aprobada:**
> "A nivel consolidado, [indicador] se sitúa en [valor]. [Polo A] alcanza el mayor cumplimiento con [valor], representando el [X]% del plan. Por su parte, [Polo B] evidencia la mayor desviación negativa con [valor], atribuible a [causa]. El resto de los polos se mantiene en rangos [adecuados / con comportamientos dispares]."

**Regla:** Nunca omitir el polo rezagado. El análisis sin el peor polo viola RULE-002 implícitamente.

---

## Patrón 3: Partidas sobregiradas (Costos)

**Uso:** Sección de Costos, subsección de partidas sobregiradas. Reemplaza el párrafo narrativo por lista estructurada.

**Estructura:**
- Una entrada por cada partida con sobregiro.
- Formato: número de partida + descripción + valor o %.
- Ordenadas por número de partida, no por magnitud.
- RULE-002: todas las partidas sobregiradas aparecen, sin excepción.

**Plantilla aprobada:**
> "Las partidas con comportamiento sobregirado son las siguientes:
> 1. Partida [XX] — [Nombre]: sobregiro de [valor] [unidad], motivado por [causa].
> 2. Partida [XX] — [Nombre]: sobregiro de [valor] [unidad], motivado por [causa].
> [...]"

---

## Patrón 4: Interanual con explicación de variación

**Uso:** Siempre que la tabla incluya columna del año anterior. Obligatorio según RULE-004 y RULE-005.

**Estructura:**
1. Dato año anterior (mismo período).
2. Dato año actual.
3. Variación absoluta y porcentual.
4. Causa de la variación (aunque sea breve).

**Plantilla aprobada:**
> "En relación a [año anterior], [indicador] presenta un [incremento/decremento] del [X]%, pasando de [valor anterior] a [valor actual] [unidad]. Este comportamiento se atribuye a [causa]."

**Nota:** RULE-005 exige explicar incluso el sobregiro interanual: "Debe incluirse el análisis respecto a 2024, donde existió un sobregiro en un 17,48% y dar una breve explicación del motivo."

---

## Patrón 5: Ejercicio de ocupación (análisis prospectivo)

**Uso:** Sección de ingresos o producción, cuando se analiza el impacto hipotético de la ocupación hotelera.

**Señal de activación:** presencia de datos de ocupación real vs capacidad instalada.

**Plantilla aprobada:**
> "Este ejercicio tiene un carácter analítico y prospectivo. De haber alcanzado una ocupación del [X]%, el sistema hubiera generado ingresos adicionales de [valor] [unidad], lo que [impacto]."

**Regla:** Siempre aclarar el carácter analítico/prospectivo. Nunca presentar como dato real.

---

## Patrón 6: Lencería — Arribos e Inyecciones

**Uso:** Sección de Lencería. Dos subsecciones diferenciadas.

**Arribos:**
- Listar número de cargas, procedencia (Caribbean, otros), total de piezas.
- RULE-007: reconciliar con el Informe de Fundamentación antes de publicar.
- Estructura: "En el período, arribaron [N] cargas con un total de [X] piezas, procedentes de [origen]."

**Inyecciones:**
- Listar las 3 prendas de mayor inyección por nombre (no "las principales").
- RULE-008: la lista debe coincidir exactamente con la tabla (Toallas de Baño, Toallas de Cara, Fundas — no Toallas de Piscina si la tabla no lo indica).
- Estructura: "Las prendas con mayores inyecciones son [Prenda A] con [X] piezas, [Prenda B] con [Y] piezas y [Prenda C] con [Z] piezas."

---

## Patrón 7: Servicios Técnicos — CDT/CDO

**Uso:** Sección de Servicios Técnicos.

**Estructura:**
- Presentar CDT (Costo Directo de Trabajo) y CDO (Costo Directo de Operaciones) por separado.
- Para cada uno: valor real, % plan, desviación.
- Luego análisis consolidado del servicio.

**Plantilla aprobada:**
> "El CDT del período se sitúa en [valor], representando el [X]% del plan. El CDO alcanza [valor], con un comportamiento [favorable/desfavorable] de [±X]% respecto al plan previsto. No obstante, [causa o implicación]."

---

## Patrón 8: Valoración Sintetizada

**Uso:** Sección "Valoración Sintetizada" — síntesis ejecutiva del período.

**Estructura:**
- 5–6 párrafos temáticos, sin sub-epígrafes internos.
- Secuencia estándar: Ingresos → Costos → Lencería → Servicios → RRHH/Calidad.
- Cada párrafo: 2–3 frases. Más evaluativo que descriptivo.
- Cierre obligatorio: párrafo final comienza con "En conjunto, …"

**Plantilla de cierre:**
> "En conjunto, el período analizado evidencia [evaluación global]. Los aspectos de mayor atención son [áreas críticas], en tanto que [aspectos positivos] constituyen fortalezas sostenidas."

---

## Patrón 9: Conclusiones y Acciones

**Uso:** Sección final "Conclusiones".

**Estructura:**
- 3–6 párrafos breves, sin sub-epígrafes.
- Cada párrafo = una conclusión o acción con justificación.
- Verbos en infinitivo para acciones recomendadas: "Revisar", "Garantizar", "Continuar", "Evaluar".
- No repetir cifras ya presentadas en secciones anteriores.

---

## Proceso de aplicación

### Paso 1: Identificar el patrón requerido
Revisar el tipo de sección y los datos disponibles. Consultar la tabla anterior para seleccionar el patrón correcto.

### Paso 2: Verificar disponibilidad de datos
Confirmar que todos los valores necesarios para el patrón seleccionado están en la tabla de entrada. Si falta alguno: `[dato no disponible: nombre_columna]`.

### Paso 3: Redactar desde la plantilla aprobada
Sustituir los valores en la plantilla. No añadir narrativa fuera de la estructura.

### Paso 4: Verificar coherencia numérica
Todos los números en el texto deben coincidir exactamente con la tabla. RULE-009: verificar aritméticamente los totales antes de escribirlos.

### Paso 5: Verificar cobertura de partidas (sección Costos)
Si la sección es Costos: confirmar que todas las partidas sobregiradas están en la lista.

---

## Restricciones
- No mezclar patrones en un mismo párrafo sin que la estructura lo exija.
- No usar el Patrón 4 (interanual) si no hay columna del año anterior en la tabla.
- Siempre verificar que la desviación calculada es aritméticamente correcta (RULE-009).
- El contenido de una sección debe corresponder al epígrafe de esa sección (RULE-010).

## Outputs esperados
- Texto narrativo estructurado listo para cada marcador `{ANALISIS_*}` del informe.
