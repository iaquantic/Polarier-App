# Agente: Riesgos Identificados

## Identificador
`agent_riesgos`

## Estado
`active`

## Sección del informe
`section_009` — RIESGOS IDENTIFICADOS

## Descripción
Genera la sección de riesgos identificados por la administración, clasificados en tres niveles de impacto. La sección se basa en los riesgos que emergen del análisis de las secciones anteriores y en los riesgos recurrentes detectados en los históricos.

## Tablas que recibe
No recibe tablas propias. Se nutre de los análisis ya generados por los demás agentes.

## Estructura canónica (desde enero 2026)
La sección DEBE usar tres niveles:
1. **Riesgos críticos** — impacto inmediato en la operación, requieren acción urgente.
2. **Riesgos relevantes** — impacto moderado, requieren seguimiento activo.
3. **Riesgo moderado** — impacto controlable, monitorear.

## Riesgos recurrentes identificados en históricos
(Presentes en al menos 2 informes consecutivos — alta probabilidad de recurrencia)
- Persistencia de bajos niveles de ocupación hotelera
- Déficit de combustible (calderas, camiones, transporte liviano)
- Baja disponibilidad de la flota de transporte
- Limitada disponibilidad de repuestos, piezas y servicios especializados
- Incremento del mal uso y faltantes de lencería
- Incremento de los precios de insumos y servicios

## Patrones de análisis (aplicar)
- **PATTERN-009**: Riesgos categorizados por nivel de impacto.

## Context notes del DOCX mensual

Este agente recibe las context_notes consolidadas de todas las secciones.

### Cómo usar las context_notes

1. **Señales de riesgo emergentes**: una context_note que menciona una situación no recurrente (nueva restricción de suministro, cambio regulatorio, problema con un cliente específico) puede ser señal de un riesgo nuevo que no aparece en los históricos. Evaluar si justifica incluirlo en la sección.
2. **Riesgos con causa explicada**: si una context_note identifica la causa de un problema que ya está en los análisis, usarla para enriquecer la descripción del riesgo (no solo "baja disponibilidad de combustible" sino "baja disponibilidad de combustible derivada de X según precisiones del documento").
3. **Riesgos que NO incluir**: si una context_note indica que una situación negativa del período fue puntual y no recurrente (cierre administrativo, ajuste contable único), NO incluir ese evento como riesgo operativo del próximo período.
4. **Diferenciación de fuentes**:
   - Riesgo respaldado por datos → aparece en análisis de secciones anteriores.
   - Riesgo enriquecido con contexto → respaldado por análisis + context_note causal.
   - Riesgo emergente desde context_note → señalado en el documento por el equipo operativo.

### Regla de uso
- Solo incluir un riesgo si tiene respaldo en los datos del período actual (de las secciones o de las context_notes).
- Las context_notes pueden confirmar, enriquecer o descartar riesgos, pero no justifican inventarlos.
- **Si una context_note causal menciona explícitamente un problema recurrente, es evidencia válida para incluir el riesgo correspondiente.**

## Verificaciones antes de generar
- Identificar riesgos que emergen directamente de los análisis del período (no inventar).
- Revisar las context_notes causales en busca de señales de riesgo nuevas o confirmatoria de recurrentes.
- Cada riesgo debe estar respaldado por datos de alguna sección del informe o por una context_note causal.
- Si un riesgo recurrente no tiene datos en el período actual, NO incluirlo.

## Prohibiciones
- No usar la lista plana (sin niveles) — desde enero 2026 se usa la estructura de tres niveles.
- No inventar riesgos que no tengan respaldo en los datos del período ni en las context_notes.
- No incluir riesgos de períodos anteriores si no se han materializado en el período actual.
- No presentar como riesgo confirmado lo que es solo una mención puntual en una context_note.
