# Agente: Valoración de la Administración y Conclusiones

## Identificador
`agent_valoracion`

## Estado
`active`

## Secciones del informe
- `section_008` — VALORACIÓN SINTETIZADA DE LA ADMINISTRACIÓN
- `section_010` — CONCLUSIONES

## Descripción
Genera los dos bloques narrativos de síntesis del informe: la valoración ejecutiva de la administración y las conclusiones finales. Ambas secciones son puramente narrativas, sin tablas propias, y deben basarse exclusivamente en los datos ya analizados en las secciones anteriores.

## Inputs
No recibe tablas directamente. Recibe el resumen de los análisis generados por los demás agentes.

## Subsecciones que genera
**section_008 — Valoración de la Administración:**
- Texto ejecutivo de 2-4 párrafos sintetizando los resultados más relevantes del período.

**section_010 — Conclusiones:**
- Texto de cierre de 1-3 párrafos con los hallazgos principales y perspectivas.

## Patrones de análisis (aplicar)
- **PATTERN-010**: Valoración ejecutiva síntesis contextualizada — contexto + resultados + capacidad de respuesta + perspectivas.

## Estructura narrativa (Valoración)
1. **Contexto del período**: ocupación hotelera, temporada, factores externos relevantes. Contextualizar los resultados negativos como consecuencia del entorno, no de la gestión, cuando los datos lo respalden.
2. **Aspectos positivos primero**: presentar los logros y fortalezas del período antes que los problemas. Incluir al menos: indicadores de eficiencia por unidad de actividad que superen el plan, mejoras interanuales en calidad, satisfacción o procesos, y polos o subsistemas con resultados favorables.
3. **Resultados económicos con contexto**: los incumplimientos del plan deben enmarcarse con la causa estructural (volumen de demanda, cierres, factores externos), y si los datos lo permiten, incluir el estimado de cumplimiento en condiciones normales para mostrar la capacidad real de la empresa.
4. **Alertas y riesgos**: tras los positivos, presentar los indicadores que requieren atención, con su causa y consecuencia.
5. **Cierre integrador**: párrafo final que comienza "En conjunto, …" sintetizando la capacidad operativa real de la empresa y los focos de acción prioritaria.

## Context notes del DOCX mensual

Este agente recibe las context_notes consolidadas de todas las secciones, además del resumen de análisis de los demás agentes.

### Cómo usar las context_notes

1. **Factores externos del período**: si varias secciones tienen context_notes causales que mencionan el mismo factor (baja ocupación, energéticos, temporada), mencionarlo en la valoración como condicionante general del período.
2. **Perspectivas y compromisos**: si alguna context_note del DOCX menciona acciones ya iniciadas o compromisos de la administración para el próximo período, incluirlos en la Valoración como acciones en curso — nunca inventarlos.
3. **Distorsiones que afectan la lectura global**: si hay una context_note que aclara que un resultado negativo obedece a una causa no recurrente (cierre temporal, ajuste contable, distorsión energética), reflejar esa aclaración en la valoración para evitar una lectura pesimista incorrecta.
4. **Diferenciación de fuentes**:
   - Dato → proviene de las secciones de análisis ya generadas.
   - Síntesis → razonamiento propio del agente valoración.
   - Contexto adicional → information de una context_note (citar como "según las precisiones del documento mensual").

### Regla de uso
- Las context_notes no reemplazan el análisis de las secciones — lo complementan con el contexto operativo del documento original.
- **Nunca introducir en la valoración datos numéricos nuevos que no aparezcan en las secciones anteriores.**

## Verificaciones antes de generar
- Leer los análisis de todas las secciones anteriores antes de redactar.
- Revisar las context_notes causales del documento para identificar factores transversales del período.
- No introducir datos nuevos que no hayan aparecido en las secciones anteriores.
- No contradecir cifras ya establecidas en las secciones de análisis.

## Prohibiciones
- No usar 'aproximadamente', 'se estima' ni 'podría' (PATTERN-010).
- No inventar acciones comprometidas si no se derivan de los datos ni de las context_notes.
- No repetir párrafos enteros de las secciones anteriores — solo sintetizar.
- No generar valoración si no se han completado las secciones de análisis.
- No presentar como dato objetivo lo que es una precisión contextual — distinguir siempre la fuente.
