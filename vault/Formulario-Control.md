# Formulario unificado de control

Sustituye a los tres formularios de auditoría (lencería, producción y cuadrador). Sale del Excel «Modelo Mensual» que Leo pasó el 2026-11-02: 11 hojas, unas 20 000 fórmulas. El Excel no está en el repositorio (es público): esta nota describe su estructura, no sus valores.

Implementado en la rama `auditoria/formulario-unificado`. Las previas se aprobaron en el canvas (fila «Auditoría — formulario unificado»).

## Cómo se reparte el Excel

El Excel es un libro por mes. En la app se reparte según **cuándo se rellena cada cosa**:

| Hoja | En la app | Dónde se guarda |
|---|---|---|
| `Operacion` | Parte diario → Jornada | `form_submissions.data.jornada` |
| `Lavado_detalle` | Parte diario → Lavado | `form_submissions.data.lavado` |
| `Procesado_detalle` | Parte diario → Procesado | `form_submissions.data.procesado` |
| `Inventario` (conteos) | Parte diario → Inventario | `form_submissions.data.inventario` |
| `Inventario` (pactadas) | No se teclean: salen de la dotación | `dotacion_lenceria` |
| `Incidencias`, `Retiros_importes`, `Acciones`, mantenimiento de `Equipos` | Parte → Novedades, y Cierre del mes | `control_eventos` |
| `Datos_mes`, `KPI_calidad`, lista de `Equipos`, revisiones, síntesis | Cierre del mes | `control_mes.data` |
| `Resumen` | Dashboard e informes | Se calcula; instantánea en `control_mes.resumen` |

**Por qué no un solo documento por mes:** con hasta 1000 registros de lavado y 1000 de procesado, cada guardado mandaría cientos de KB, con mala conexión. Por eso el parte es una fila por día. Las novedades van aparte porque se abren un día y se cierran otro, y esa actualización no puede depender del parte de aquel día.

## Pantallas

- **`/auditoria/formularios`:** tarjetas «Parte de hoy» y «Cierre del mes», más el calendario del mes.
- **`/auditoria/formularios/parte?fecha=`** (`AuditParte.tsx`): cinco pasos. Pestañas en escritorio; en móvil, «2 de 5» y Anterior/Siguiente. Guarda solo a los 2 s de dejar de escribir y reintenta si no hay conexión (`useAutoguardado`). Abrir un día para mirarlo no crea ningún parte.
- **`/auditoria/formularios/cierre?mes=`** (`AuditCierre.tsx`): lo que no se rellena a diario.
- **`/auditoria`:** `DashboardMensual`. El dashboard antiguo (`DashboardControl`) sigue a un enlace para los meses rellenados con los formularios de antes.

## Lo que le ahorra trabajo al supervisor

- Turno, operario y equipo se escriben una vez **por vale**, no por cada prenda. Un vale nuevo copia los del anterior.
- **«Todo conforme»:** cada fila de procesado son 8 números en el Excel. Escribe conforme = declaradas y el resto a 0. No estima nada: son los ceros que habría que teclear. No se ofrece en una fila ya completa, porque pisaría las excepciones anotadas.
- **Declaradas automáticas:** las de un área salen de lo conforme de la última etapa por la que pasó esa prenda (las toallas no se planchan), o de lo lavado si es la primera.
- **«Pasar este vale a…»** abre la siguiente área con sus prendas y declaradas.
- **«Traer pendientes de ayer»:** crea las continuaciones (recibidas = 0 y pendiente inicial).
- **Inventario:** en gris, el último conteo de cada casilla (o la dotación si aún no hay). Solo se escribe lo contado hoy.
- **Un mes nuevo** hereda del anterior los datos del SLA y la lista de equipos.
- **En móvil** las filas completas se pliegan a su resumen. Las horas admiten `1:30` además de `1,50`.

## Fórmulas

Están en `src/lib/control.ts`, función a función y con la celda en cada comentario, y `construirResumen` (`src/lib/controlResumen.ts`) monta la hoja `Resumen`. Es la **única** fuente de cifras: dashboard, informes y routine no recalculan nada.

**La regla que atraviesa todo: vacío no es 0.** Un dato sin rellenar es `null` y el indicador dice «Completar».

**Están contrastadas con el propio Excel** (`src/test/control.excel.test.ts`). `scripts/modelo-mensual/` rellena una copia del libro con datos inventados, la calcula con un motor de hojas de cálculo (HyperFormula) y deja entradas y resultados en `src/test/fixtures/modeloMensual.json`. Hay cuatro escenarios: casos límite, mes completo, «Sin actividad» y sin empezar. Si cambian las fórmulas del Excel, hay que regenerarlo.

## Lo que se apartó del Excel, y por qué

1. **KPI (decisión de Leo, 2026-11-02).** En `KPI_calidad` se borró la columna de la base: `D11:D20` quedaron en `#REF!` (siempre «Completar»), `E` pasó a `B*100/C` y `Resumen!B37`/`D37`, que cuentan los textos «Cumple» y «No cumple», dan siempre 0. También `Resumen!I26:I27`. Se recuperó la base que describen las instrucciones de la propia hoja: resultado = cantidad ÷ base, y cumple si llega a la meta.
2. **Las metas del SLA no están en el código.** Son del contrato y el repositorio es público: viven en `form_definitions.config.metas` (`{ clave: tanto por uno }`), por hotel, y se cargan fuera de las migraciones. Sin ellas, el KPI dice «Completar» y el cierre lo avisa.
3. **Las ubicaciones son las del catálogo (16), no las 11 de la hoja**, porque la dotación incluye las otras 5.
4. **Los partes de días pasados se pueden editar** hasta validar el mes (decisión de Leo). Con la regla de antes, un día olvidado nunca se podría completar y el mes nunca llegaría a dar «Kg por turista día». «Validar el mes» es poner «Jornada y lavado» en Validado, que es la «Revisión del mes» de `Operacion`.
5. **Solo las 8 prendas de la hoja** (decisión de Leo): la mantelería deja de registrarse. Los pesos por prenda del Cuadrador desaparecen: los kg se teclean, como pide el Excel.

## Rarezas del Excel que se respetan

- «Horas por agua» y «Horas por electricidad» salen como «Completar» en un mes sin incidencias de esa causa, salvo que la revisión de Incidencias diga «Sin actividad».
- «Otro ajuste» no sale en el resumen de piezas por concepto.

## Dashboard

- **Se quita «avance hacia la dotación»:** las piezas lavadas de un mes pueden superar de sobra el stock del hotel, así que el porcentaje no decía nada. Se compara lo que compara el Excel: existencias frente a pactadas.
- **Un día se juzga en kg** contra la mediana del mes, con los umbrales de siempre (0,5 / 0,75 / 1,5) y la misma regla: un día sin cerrar suma pero no se clasifica como desviación. Esa clasificación sigue duplicada en `audit_mes_dias`: **cambia una, cambia la otra**.
- Los días abiertos se pintan en gris con lo tecleado, pero **no cuentan en los totales**: como en el Excel, solo cuenta un día cerrado con todos sus registros completos.

## Limitaciones conocidas

- **Varios supervisores en un hotel.** El parte sigue siendo uno por persona y día. Los registros se suman; los datos de jornada (los turistas son los mismos) los pone el parte más reciente. Pero la RLS de la 008 hace que un supervisor solo vea sus partes, así que su dashboard y la instantánea que él guarde solo cuentan los suyos. Hoy hay un solo auditor por hotel. Si llega un segundo, habrá que abrir la lectura de partes entre supervisores del hotel.
- **Sin conexión:** el autoguardado reintenta mientras la pantalla siga abierta. Si se cierra sin haber recuperado la conexión, se pierde lo último.

## Puesta en marcha

El orden importa:

1. **Desplegar el frontend.** Sin la migración sigue ofreciendo los formularios de antes, así que no se nota nada. Al revés no vale: la app antigua no sabe abrir el parte nuevo y se quedaría sin los tres formularios, que la migración desactiva.
2. Aplicar `supabase/migrations/016_control_mensual.sql`. A partir de aquí la app ofrece el parte nuevo.
3. Cargar las metas del SLA del hotel en `form_definitions.config.metas`.
4. Actualizar el prompt de la routine (ver [[Routine-Informe-Mensual]]).

Ver también [[Modulo-Auditoria]], [[Referencias-Formularios]], [[Decisiones]].
