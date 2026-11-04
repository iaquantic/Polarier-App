# Formulario unificado de control

Sustituye a los tres formularios de auditoría (lencería, producción y cuadrador). Sale del Excel «Modelo Mensual» que Leo pasó el 2026-11-02: 11 hojas, unas 20 000 fórmulas. El Excel no está en el repositorio (es público): esta nota describe su estructura, no sus valores.

**En producción desde el 2026-11-02:** PR 45 fusionado y desplegado, migración `016` aplicada, metas del SLA del Muthu cargadas y prompt de la routine actualizado. Falta probarlo con un usuario real. **El formulario por hojas y la subida del Excel (2026-11-04)** están en la rama `auditoria/formulario-hojas`, con la migración `020` sin aplicar. Las previas se aprobaron en el canvas (filas «Auditoría — formulario unificado» y «formulario igual que el Excel»).

## El formulario es el Excel

**Desde el 2026-11-04 (decisión de Leo):** el formulario tiene las mismas 11 hojas que el libro, con sus nombres, en su orden, con las mismas columnas, letras de columna, números de fila y colores. Amarillo se escribe, azul se calcula y gris es referencia. `src/lib/controlHojas.ts` define hojas y columnas **una sola vez**: la tabla de la app y el lector del Excel salen de ahí, así que no pueden separarse.

Lo que se guarda no cambia: sigue siendo un parte por día. Por eso el dashboard, los informes y la routine no se han tocado.

| Hoja | Dónde se guarda |
|---|---|
| `Operacion`, `Lavado_detalle`, `Procesado_detalle`, `Inventario` (conteos) | `form_submissions.data`, un parte por día |
| `Inventario` (pactadas) | No se teclean: salen de `dotacion_lenceria` |
| `Incidencias`, `Retiros_importes`, `Acciones`, mantenimiento de `Equipos` | `control_eventos` |
| `Datos_mes`, `KPI_calidad`, lista de `Equipos`, revisiones, síntesis | `control_mes.data` |
| `Resumen` | Se calcula; instantánea en `control_mes.resumen` |

**Por qué no un solo documento por mes:** con hasta 1000 registros de lavado y 1000 de procesado, cada guardado mandaría cientos de KB, con mala conexión. La hoja edita filas planas y `useLibroMes` guarda solo los días tocados. Las novedades van aparte porque se abren un día y se cierran otro.

**De filas a parte, sin perder nada:** en el Excel cada fila lleva su turno, operario, equipo y horas, y el parte agrupa por vale. `valesDeFilas` y `tandasDeFilas` solo juntan filas **consecutivas** con la misma cabecera, así que al aplanar salen las mismas filas en el mismo orden aunque un vale cambie de operario entre prendas.

## Pantalla

`/auditoria/formularios?mes=AAAA-MM&hoja=…&fecha=…` (`AuditHojas.tsx`, `components/audit/hojas/`). Las pestañas están abajo, como en Excel. `/auditoria/formularios/parte` y `/cierre` redirigen a su hoja para que no se rompan los enlaces guardados.

- **`TablaHoja`:** flechas, Intro y Tab para moverse, y pegar un bloque copiado del Excel (las columnas calculadas se saltan). Solo pinta las filas que se ven. Al final hay filas libres: al escribir en una, se crea con la fecha de la fila anterior.
- **Se guarda solo** a los 2 s de dejar de escribir y reintenta si no hay conexión. Abrir el mes no crea nada.
- **Una fila siempre tiene fecha del mes:** se guarda en el parte de ese día, así que la tabla rechaza una fecha vacía o de otro mes. Es la única diferencia con la hoja al teclear; en un Excel subido, esas filas se listan como «No entran».
- **Lo de otra persona se ve y no se toca:** una fila es de quien firma el parte. Un día con parte ajeno y sin el propio queda bloqueado, para no crear una copia a nombre de quien mira.
- **Mes validado:** bloquea Operacion, Lavado, Procesado e Inventario y no deja subir un Excel. Se reabre con Revisión del mes en `Operacion`.
- **Móvil:** la misma tabla, con la fecha fija y el resto moviéndose de lado. Las 23 columnas de Procesado son incómodas en un teléfono: para eso está rellenar el Excel y subirlo.

**Ayudas, encima de la tabla, sin añadir columnas:** «Todo conforme» en la fila elegida (escribe conforme = declaradas y los ceros que habría que teclear), «Pasar el vale a otra área» (con sus prendas y declaradas), «Traer pendientes de ayer», «Usar lo registrado» en los KPI, y en Inventario el último conteo en gris (o la dotación si aún no hay). Un mes nuevo hereda del anterior los datos del SLA y la lista de equipos.

## Subir el Excel relleno

Botón **Subir Excel** (`SubirExcel.tsx`). Tres pasos: elegir el archivo, revisar qué hará, y confirmar. Hasta confirmar no cambia nada.

- **Lectura:** `xlsxLectura.ts` abre el .xlsx en el navegador y `controlExcel.ts` lee **solo las casillas de entrada**. Lo calculado se ignora: las fórmulas las rehace `control.ts`, así que un libro con fórmulas rotas no cuela ninguna cifra. Exige las hojas y cabeceras del modelo; si no coinciden, rechaza el archivo y dice qué falta.
- **Por qué un lector propio:** `exceljs` falla con los libros que tienen tablas de Excel si no los guardó el propio Excel, y pesa casi 1 MB. Solo hace falta el valor de cada casilla.
- **Reglas de la mezcla (decisión de Leo, `controlImportacion.ts`):**
  - Una casilla o un día vacío en el Excel **nunca borra** lo que hay en la app.
  - `Lavado_detalle` y `Procesado_detalle`: el Excel sustituye solo los días que trae.
  - `Operacion`, `Datos_mes`, `KPI_calidad` e `Inventario`: casilla a casilla.
  - Novedades y lista de equipos: sustituyen a las del mes si la hoja trae filas. Las iguales conservan su id, así que subir dos veces el mismo archivo no cambia nada.
- **No entran, y se listan con su fila:** filas sin fecha o de otro mes, dos conteos del mismo sitio el mismo día, y conteos sin ubicación. Lo que no se entiende en una casilla queda vacío y se avisa.
- **No se tocan, solo se avisa:** las pactadas (mandan las de la dotación) y las metas del SLA (mandan las cargadas). Una ubicación desconocida se guarda aparte y se avisa.
- **Se rechaza:** otro mes (ofrece ir a él) y mes validado. Si el hotel no parece el mismo, hay que confirmarlo. No se puede subir si el mes tiene partes de otra persona, porque se sumarían.
- **Original:** cada archivo se guarda en el bucket privado `control-excel` y queda constancia en `control_importaciones`. Si no se puede guardar el archivo, los datos entran igual y se avisa.
- **Si se corta a medias:** lo escrito queda bien y volver a subir el mismo archivo termina el trabajo.

**Plantilla corregida:** `scripts/modelo-mensual/corregir_kpi.py` recupera la columna Base en `KPI_calidad` y quita los `#REF!` de esa hoja y de `Resumen`, sin mover encuestas ni controles. Un Excel antiguo sin Base también se puede subir: los KPI entran con su cantidad y quedan en «Completar» hasta poner la base en la app.

## Fórmulas

Están en `src/lib/control.ts`, función a función y con la celda en cada comentario, y `construirResumen` (`src/lib/controlResumen.ts`) monta la hoja `Resumen`. Es la **única** fuente de cifras: dashboard, informes y routine no recalculan nada.

**La regla que atraviesa todo: vacío no es 0.** Un dato sin rellenar es `null` y el indicador dice «Completar».

**Están contrastadas con el propio Excel** (`src/test/control.excel.test.ts`). `scripts/modelo-mensual/` rellena una copia del libro con datos inventados, la calcula con un motor de hojas de cálculo (HyperFormula) y deja entradas y resultados en `src/test/fixtures/modeloMensual.json`. Hay cuatro escenarios: casos límite, mes completo, «Sin actividad» y sin empezar. Si cambian las fórmulas del Excel, hay que regenerarlo.

## Lo que se apartó del Excel, y por qué

1. **KPI (decisión de Leo, 2026-11-02).** En `KPI_calidad` se borró la columna de la base: `D11:D20` quedaron en `#REF!` (siempre «Completar»), `E` pasó a `B*100/C` y `Resumen!B37`/`D37`, que cuentan los textos «Cumple» y «No cumple», dan siempre 0. También `Resumen!I26:I27`. Se recuperó la base que describen las instrucciones de la propia hoja: resultado = cantidad ÷ base, y cumple si llega a la meta. La plantilla corregida hace lo mismo en el Excel, con las columnas que ya decían sus instrucciones.
2. **Las metas del SLA no están en el código.** Son del contrato y el repositorio es público: viven en `form_definitions.config.metas` (`{ clave: tanto por uno }`), por hotel, y se cargan fuera de las migraciones. Sin ellas, el KPI dice «Completar» y el cierre lo avisa.
3. **Son 16 ubicaciones, no 11:** la dotación incluye 5 que la hoja no trae. La hoja tiene 11 fijas y 3 filas libres por día, y las otras 5 se eligen en esas filas libres (`config.ubicaciones_hoja` dice cuáles son fijas). La app admite más filas libres si hacen falta; en el Excel, las 5 se reparten entre días, porque un valor nuevo sustituye al anterior de esa ubicación. Sin un dato de cada una, el artículo se queda en «Conteo parcial».
4. **Los partes de días pasados se pueden editar** hasta validar el mes (decisión de Leo). Con la regla de antes, un día olvidado nunca se podría completar y el mes nunca llegaría a dar «Kg por turista día». «Validar el mes» es poner «Jornada y lavado» en Validado, que es la «Revisión del mes» de `Operacion`.
5. **Solo las 8 prendas de la hoja** (decisión de Leo): la mantelería deja de registrarse. Los pesos por prenda del Cuadrador desaparecen: los kg se teclean, como pide el Excel.
6. **Las pactadas no se editan en la hoja:** salen de la dotación, que es fija (decisión de Leo, 2026-10-19). Tampoco la Meta SLA.
7. **«Escala / soporte» de `Resumen`:** esa escala se borró con la columna de la base, así que la plantilla corregida y la app enseñan el documento de la encuesta.

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
- **Quitar una fila del Excel no la borra de la app:** lo vacío nunca borra, así que se borra en la app.
- **El Excel no se descarga con lo de la app:** se sube, pero no se genera desde aquí. Quien alterne, ve en el Excel solo lo suyo.

## Puesta en marcha

El orden importa:

1. **Desplegar el frontend.** Sin la migración sigue ofreciendo los formularios de antes, así que no se nota nada. Al revés no vale: la app antigua no sabe abrir el parte nuevo y se quedaría sin los tres formularios, que la migración desactiva.
2. Aplicar `supabase/migrations/016_control_mensual.sql`. A partir de aquí la app ofrece el parte nuevo.
3. Cargar las metas del SLA del hotel en `form_definitions.config.metas`.
4. Actualizar el prompt de la routine (ver [[Routine-Informe-Mensual]]).

**Formulario por hojas:** primero `supabase/migrations/020_formulario_por_hojas.sql` (solo añade; la app anterior no usa nada de ella), después desplegar el frontend, y repartir la plantilla corregida a los supervisores. Sin la `020` las hojas funcionan, pero con las 16 ubicaciones como fijas y sin guardar el Excel original.

Ver también [[Modulo-Auditoria]], [[Referencias-Formularios]], [[Decisiones]].
