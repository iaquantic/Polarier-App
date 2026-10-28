# Informe del Consejo — de dónde sale cada dato

Estudio del 2026-10-21. Mapea cada tabla del [[Informe-Consejo-Direccion]] con su origen en el **GLOBAL** y en la **TABLA CA**, para que el informe deje de depender de un DOCX de tablas subido a mano y se genere eligiendo un mes (decisión de Leo, mismo día; ver [[Decisiones]]).

> Sin cifras: el repositorio es público. Aquí solo hay hojas, filas, códigos y fórmulas.

## Cómo se hace hoy (lo que descubrió el estudio)

**El DOCX de tablas que se sube se monta copiando y pegando desde la TABLA CA.** La hoja «TABLAS CHEQUEOS CONSOLIDADAS» lo dice literalmente: *«NO MODIFICAR LAS TABLAS. SOLO COPIAR Y PEGAR EN WORD»*. Por debajo:

1. Cada hoja de polo de la TABLA CA tiene a la derecha unas **tablas laterales** (columnas R–AD, título «TABLAS PARA INFORMES») que suman o promedian **rangos de meses fijos**. Por ejemplo, los costos del trimestre son `SUM(C17:E17)`, es decir, enero a marzo. **Para cambiar de período alguien reapunta esos rangos a mano.**
2. «TABLAS CHEQUEOS CONSOLIDADAS» junta las tablas laterales de los seis polos y el CONSOLIDADO en tablas con el formato del informe.
3. Lo que no sale de ahí (lencería, cuentas, vacantes…) se **teclea** en hojas auxiliares que guardan **solo el período en curso**, sin columna de mes.
4. Todo eso se pega en Word y se sube.

**En la TABLA CA 2026 hay dos montadores, y los dos se usan:**
- **«TABLAS DE CHEQUEOS MENSUAL»** monta el informe **mensual**. Tiene doce bloques, de ENERO a DICIEMBRE, y cada uno lee la columna de su mes en las hojas de polo (junio → columna H). Las etiquetas dicen «Real 2025 / Real 2024», heredadas, pero apuntan a las filas del año actual y del anterior. En la copia de 2025 era una plantilla abandonada; en 2026 la reactivaron.
- **«TABLAS CHEQUEOS CONSOLIDADAS»** monta el **trimestral** y lo acumulado, a través de las tablas laterales.

## Las dos fuentes

### GLOBAL-CP\<aa\>.xlsx — VPS `/data/Polarier/Leslie/`

- Una hoja por polo (`LHCP2026`, `VARCP2026`, `CACP2026`, `CCCP2026`, `CCZCP2026`, `HOLCP2026`) y un **CONSOLIDADO**, que es la suma de las seis. Hay también hojas por trimestre y anual, que leen del CONSOLIDADO.
- **Fila = partida presupuestaria**, identificada por su código en la columna A (`Filas`, de 1 a 207). Las filas «Gastos Totales (Indirectos + Fijos)», «VAB» y «PROMEDIO DE TRABAJADORES» no tienen código.
- **Columnas:** cada mes ocupa tres (PLAN, REAL, Qp). El mes va en la fila 4 y el tipo en la fila 5. Hay además acumulados por trimestre y el año anterior.
- **Ojo:** lo guarda `agente_modelo1.py` con openpyxl, así que **ninguna de sus ~58.000 fórmulas trae valor en caché**. Totales, subtotales, CONSOLIDADO y trimestres salen vacíos con `data_only=True`: hay que evaluarlos. `sync_global_ai.py` y `consejo-direccion/scripts/origen_datos/cruce.py` lo hacen.
- Ya está normalizado en Supabase: **`global_ai`** ([[Generacion-Documentos]], D6). Se sincroniza al terminar cada Modelo 1.

### TABLA CA \<año\>.xlsx — VPS `/data/Polarier/Leslie/CD/`

Hoja por polo (`HABANA`, `VARADERO`, `CAIBARIEN`, `CAYOCOCO`, `CAYOCRUZ`, `HOLGUÍN`) y CONSOLIDADO, con la misma estructura. **Los meses van en las columnas C (enero) a N (diciembre).**

| Filas | Qué hay | Quién lo rellena |
|---|---|---|
| 6–60 | **Año actual.** Turistas-día (TD) plan y real, producción plan y real, prendas procesadas, ingresos (plan, real, alquiler, lavado, otros), costo, gastos, utilidades, VAB, salario, días, horas, trabajadores, productivos, vehículos, km, diésel de transporte, CDT, CDO, consumos de diésel, electricidad y agua, capacidad, calidad, y los ratios (41–60) | El **Agente TABLA CA** al subir el CD del polo ([[Generacion-Documentos]], D2). TD plan (fila 6), en cambio, va tecleado. **Las económicas son vínculos externos al GLOBAL-CP26** (comprobado en la de 2026, ver abajo) |
| 63–115 | **Año anterior**, la misma lista | Se rellena al crear el libro; no se toca |
| 117–179 | Variaciones (real − plan, real / año anterior…) | Fórmulas |
| 181–205 | **Químicos** por producto y sus índices (real, plan, año anterior). En 2026 entraron productos nuevos (BRONCEX, 4x4, PRELAX/LAFF) y los índices bajaron dos filas: real 199, plan 200, año anterior 203 (en 2025 eran 197, 198 y 201) | Agente TABLA CA |
| R–AD | Tablas laterales «TABLAS PARA INFORMES» | Fórmulas con **rangos de meses fijos** |

Hojas auxiliares, **tecleadas a mano y sin mes** (guardan solo un período):

| Hoja | Qué tiene |
|---|---|
| «Montas» | Estado de las montas por habitación y por cliente, y los **faltantes** (columna AD). En 2026, con bloques por trimestre |
| «Rechazo e inyecciones» | El cuaderno de lencería: rechazo, inyecciones, mal uso, tratamientos de desmanche, retiro generado, cantidad de inventarios (con su plan), lencería en uso (columna CI) y estándares de montas por cadena. En 2026, con bloques por trimestre o mes y el período en el título |
| «Datos económicos» | Edades de las cuentas por cobrar y por pagar (a una fecha de corte), necesidad, cubiertos y vacantes de personal, **disponibilidad de vehículos** (filas 27–33), los cálculos del **impacto de la ocupación** (filas 9–12) y la cantidad de inventarios. En 2025 tenía también el presupuesto de transporte, montado con los códigos 130 y 134 del GLOBAL |
| «Energía» | Índices **plan** de diésel, electricidad y agua por polo |

**En 2026 los bloques llevan el período en el título** («RECHAZO DE LENCERÍA PRIMER TRIMESTRE 2026», «TRATAMIENTOS DE DESMANCHE MARZO»…), pero siguen tecleados a mano, no van en una columna por mes y el del período en curso se sobrescribe. **Prueba de ello:** de las tablas de lencería del informe de junio, rechazo, montas y lencería en uso siguen en la hoja; **mal uso, desmanche, retiro y lencería nueva ya no**: sus bloques tienen ahora otro período.

## ¿Viene lo tecleado en el CD? Solo una parte

> **Decisión del 2026-10-22 (Leo):** del CD solo se rellena la **tabla principal** de la TABLA CA, la hoja de cada polo («TABLAS PARA RESUMEN DE INDICADORES…»). Las hojas auxiliares no se cargan desde el CD, aunque parte de sus datos esté en él. Esta sección queda como referencia de origen, no como plan de carga. Ver [[Decisiones]].

El CD que manda cada polo cada mes tiene hojas de lencería, transporte y RRHH que el Agente TABLA CA no lee. Sus títulos prometían casi todo lo que se teclea en las hojas auxiliares, y con las cifras se confirma solo una parte. **Comprobado con valores el 2026-10-21 y corregido el 2026-10-22:** del CD salen las montas, el rechazo, las inyecciones, el desmanche y el retiro, y el mal uso del trimestral. El resto del informe trae cifras que no están en el CD, o que alguien ajusta después.

**Cómo se comprobó:** se cruzaron los CD de mayo de 2026 de La Habana (`HACA2026 mayo.xlsx`), Varadero (`05. VACD - Mayo 2026.xlsx`) y Caibarién (`CACD202605.xlsx`) con la columna de cada polo de las tablas del informe de mayo de 2026. Las cifras se emparejan por **nombre de prenda**, no por posición, porque el CD tiene filas que el informe no lleva («Toalla Bidet»).

| Tabla | Hoja del CD | La Habana | Varadero | Caibarién | Veredicto |
|---|---|---|---|---|---|
| Montas por habitación | 5.Lencería 1, columna del total del polo | ✔ | ✔ | ✔ | **Sale del CD** |
| Montas por cliente | 5.Lencería 1 | ✔ | ✘ | ✔ | Sale del CD, salvo cuando el polo no rellena los TD por hotel |
| Rechazo | Lencería 2, «Resumen de los rechazos», columna SUMA | ✘ bloque vacío | ✔ | ✔ | **Sale del CD** cuando el polo lo rellena |
| Inyecciones | Lencería 2, «Resumen de las inyecciones», columna SUMA | ✔ | (a cero) | (a cero) | **Sale del CD** |
| Mal uso | Lencería 2, «Resumen del mal uso», columna SUMA | ✘ vacío | ✘ en el mensual · ✔ en el trimestral | ✘ en el mensual (el CD casi triplica el informe de mayo) · ✔ en el trimestral | **Sale del CD en el trimestral**; el mensual de mayo trae otras cifras (ver abajo) |
| Desmanche | Lencería 2, «Recuperaciones»: producción = tratadas, y % de recuperación | ✘ vacío | ✔ 8/8 | ✔ 7/7 y total | **Sale del CD** (corregido el 2026-10-22; antes decía «otra escala») |
| Retiro | Lencería 2, «Descartes», columna rotulada «Descarte generado 2025» | ✘ vacío | ✔ 8/8 | ✔ (a cero) | **Sale del CD** (corregido el 2026-10-22). Ojo al rótulo de la columna: dice 2025, pero trae el mes |
| Faltantes | Lencería 2, resultados de inventarios por hotel (inicial, real, diferencia) | ✘ | — | ✘ | **No sale directo**: va por hotel y no se ve la regla |
| Lencería en uso | — | ✘ | ✘ | ✘ | **No está en el CD** |
| Lencería nueva | — | ✘ | ✘ | ✘ | **No está en el CD** |
| Disponibilidad de vehículos | 7.Transporte, estado de cada vehículo | — | — | Casa a medias: los paralizados coinciden, pero el total de vehículos y los que trabajan no | **No sale contando sin más** |
| Vacantes | 9.RRHH, lista de cargos vacantes | — | — | El CD lista decenas de cargos vacantes; el informe, uno o dos «con necesidad ajustada al nivel de servicio» | **Cifra ajustada a mano** |
| Salario medio y trabajadores | 9.RRHH («Salario Medio», «Plantilla Cubierta») | — | — | ✔ | Ya estaban 🟢 por la TABLA CA |

Otras cosas que se vieron:
- **Los nombres de hoja cambian entre polos y meses** («5.Lenceria 1 (2)», «Lencería 2 MAYO», «RRHH mayo», «7. Transporte»). Hay que localizarlas por aproximación, como ya hace el agente con las demás.
- **No todos los polos rellenan todos los bloques** (La Habana dejó vacíos rechazo, mal uso y descarte en mayo). El cargador tendría que distinguir «no rellenado» de «cero».
- En los seis CA de abril de 2025 y los tres CD de mayo de 2026, las hojas de lencería, transporte y RRHH existen siempre, con la misma estructura.

**Preguntas abiertas:** el documento [Preguntas sobre la TABLA CA](https://claude.ai/artifact/4nqPFuQhTLTVLPXyZxt62C) es para quien monta la TABLA CA y tiene una columna para la respuesta. Es privado: hay que compartirlo. Cuando lleguen las respuestas, se resumen aquí por número.
- **2026-10-21:** nació con 31 preguntas (P1–P31).
- **2026-10-22:** se redujo a las **5 que siguen abiertas**, con la decisión de cargar desde el CD solo la tabla principal:
  - **P22:** fecha de corte de las cuentas.
  - **P27:** quién rellena las hojas auxiliares y cuándo.
  - **P28:** si el dato de cada mes se guarda o se sobrescribe.
  - **P29:** correcciones a mano en la hoja del polo.
  - **P31:** polos cerrados.

  El documento anota también las ya respondidas al cruzar datos (P1–P2 en parte, P4–P6, P8–P9, P14–P15, P23 y P30 en parte) y las que ya no hacen falta. Se conservan los números originales.
- **2026-10-28: llegaron respondidas las 31** («Preguntas_Informe_Mensual_CD_Corregido.docx», por WhatsApp; no está en el repo). Resumen abajo, en «Respuestas del 2026-10-28».

### Respuestas del 2026-10-28

Muchas respuestas dicen cómo **debería** hacerse («debe», «criterio propuesto»), no cómo se hace hoy. Sin nombres de personas: el repo es público.

**Del CD (lo confirman como fuente):**

| Nº | Tabla | Respuesta |
|---|---|---|
| P1–P2 | Mal uso | Sale de un modelo de control semanal que se consolida al cierre del mes. Su resumen mensual tiene la misma estructura que la tabla de mal uso del CD y se pasa sin tocar las cifras. Las diferencias entre el CD y la TABLA CA se concilian con el modelo de origen. Prometen el modelo como adjunto 1 (no venía) |
| P3, P7 | kg y % de mal uso y retiro | kg = cantidad de cada prenda × su peso unitario del informe logístico (la tabla de pesos llegó el 2026-10-28: `PESOS` en `lenceria_cd.py`). % = kg / producción del mes (mal uso: la total reportada; retiro: kg lavados). El informe con los pesos llegó el 2026-10-28 |
| P4–P5 | Desmanche | Registro diario en lavatín y túnel → cuadro de mando (CM) diario a las UTC → CD. El % del informe y el del CD son el mismo concepto |
| P6 | Retiro | «Descarte» pasó a llamarse «retiro»: es lo mismo. La Habana no rellena bien ese bloque del CD |
| P10 | Faltantes | **Suma de las diferencias negativas** de los hoteles **inventariados en el mes** (hoja «Lencería 2» del CD). Las positivas son sobrantes. Puede ser solo una parte de los hoteles del polo |
| P16–P18 | Vehículos | Entran todos los vehículos que siguen en la contabilidad del polo: carga, personal y administrativos, incluso con la baja en trámite. Las tres categorías las fija el jefe de Transporte por vehículo. **Los polos han cambiado tanto el modelo del CD que ya no es igual en todos: hay que homogeneizarlo.** % AUSA = recibidos / base × 100 |
| P24 | Rechazo de La Habana | Tiene que salir del CD. Si el CD de mayo venía vacío y la TABLA CA lo tenía, alguien lo tecleó a mano en la TABLA CA |
| P25 | Montas por cliente de Varadero | Salen del GSBASE («Amanece Hoteles») y las genera cada polo. La diferencia será un error al teclearlas a mano en la TABLA CA |
| P26 | Otros ficheros | Cada día los polos mandan a las UTC CM, ER, PT y AH (ER y AH salen del GSBASE; CM y PT son manuales). Sus consolidados deben coincidir con el CD y servirle de soporte |
| P29 | Correcciones | Primero se corrige el CD del polo y después se pasa a la TABLA CA |

**De otros informes mensuales (no vienen en el CD):**

| Nº | Tabla | De dónde sale |
|---|---|---|
| P8–P9 | Inventarios realizados | Cada polo lo manda cada mes en un modelo, y en las UTC se hacía el consolidado. Prometen el modelo. El plan lo acuerdan Polarier, Operaciones, AT Comercial y las UTC con Gaviota; vale el plan aprobado para el período |
| P11 | Pérdida por faltantes | La calcula Economía con el coste de cada prenda en el sistema contable (ZUN), que no es un precio único por tipo |
| P12–P13 | Lencería en uso | La que circula (hoteles y lavandería). Economía la da como cantidad teórica, cada mes: total del sistema (ZUN y GSBASE) menos la nueva almacenada, la retirada y la inmovilizada. No sustituye al inventario físico |
| P14–P15 | Lencería nueva | La comunican cada mes los directores de los polos y en las UTC se hacía el consolidado (el `CO ROPA NUEVA`). Prometen el modelo. En la TABLA CA 2026 no tiene sitio: el bloque de «Lencería 2» es el de inyecciones |
| P19–P20 | Vacantes | Informe de Recursos Humanos: plantilla aprobada por Gaviota, cubiertas y necesidad ajustada al nivel de servicio. La necesidad la fijan el director, RRHH y los jefes de área y la aprueba el Consejo de Dirección de la UEB. Cambia al cubrirse o quedar libres plazas, o al revisarse la necesidad |
| P21–P22 | Cuentas por cobrar y por pagar | Reporte de saldos y antigüedad del sistema contable (ZUM). **Fecha de corte: no la dicen claramente.** AT Comercial cierra el mes entre el día 1 y el 5 del siguiente; se entiende que es el último día del mes, disponible tras ese cierre |
| P23 | Plan de los consumos | Modelo M001 aprobado por el GAE, del plan productivo del año; para cada período, el valor aprobado que le toque |
| P30 | Arribos | Los compra AT Comercial; las UTC hacen el reparto por polos, lo aprueba Gaviota y se pone a disposición de los directores |

**Generales:**
- **P27:** las fuentes se actualizan a diario (montas por el GSBASE y Facturación; rechazo e inyecciones por el responsable logístico; energía por el jefe de servicios técnicos y el cuadro de mando) y se consolidan al cierre del mes. Lo controlan los directores técnicos y las UTC.
- **P28:** los datos quedan en los informes diarios, pero **nadie confirma que se guarde el cierre de cada mes ni que las hojas auxiliares de la TABLA CA tengan histórico**. Confirma el problema: un mes pasado no se puede sacar de esas hojas.
- **P31, polos cerrados:** todos los polos tienen contabilidad (gastos), así que salen en las tablas económicas. Los cerrados no lavan, así que todo lo que deriva de lavar va a **0**: productividad, kg lavados y procesados, diésel de producción, mal uso y todo lo logístico.

**El trimestral es la suma de los tres meses, y así se ve de dónde sale cada uno (2026-10-22).** Leo preguntó si el «casi triplica» no sería comparar un mes con un trimestral. No lo era: se comparó el CD de mayo con el informe mensual de mayo. Pero al cruzar con el II Trimestre salió esto:

- **Mal uso, Varadero y Caibarién, 8/8 prendas cada uno:** II Trimestre = bloque «MAL USO» de la TABLA CA 2026 (fila 3, que por tanto es **abril**) + **CD de mayo** + informe de junio. En Caibarién entra solo la columna de un hotel del CD; la otra columna con datos se quedó fuera.
- **El informe mensual de mayo no usó el CD para el mal uso**, ni las cifras que el trimestral sumó para mayo. De dónde salen esas cifras sigue sin saberse.
- **El bloque de la fila 42 de «Rechazo e inyecciones»**, titulado «MAL USO DE LENCERÍA SEGUNDO TRIMESTRE 2025», trae el II Trimestre **de 2026** en La Habana y Caibarién. Los títulos de los bloques no son fiables.
- La Habana no cuadra con esa suma, y su CD de mayo trae el mal uso vacío.

**Conclusión (solo de origen; no se van a cargar, ver la decisión de arriba):** las hojas del CD contienen **6 de las 15 tablas tecleadas**: montas por habitación, montas por cliente, rechazo, inyecciones, desmanche y retiro, más el mal uso tal como lo suma el trimestral. **Salen de otra fuente**, que no se ha visto, o los ajusta quien prepara la TABLA CA:
- el mal uso del mensual;
- inventarios, faltantes, lencería en uso y lencería nueva;
- vehículos, vacantes y cuentas por cobrar y por pagar;
- el plan de los consumos;
- en La Habana, lo que su CD deja vacío.

## Los informes que tributan al CD (revisados el 2026-10-22)

A Leo le pasaron ocho Excel con la idea de que «ahí está el resto de los datos». Se revisaron uno a uno y se cruzaron con la TABLA CA 2025 y 2026 y con los informes de enero de 2025, mayo, junio y el II Trimestre de 2026. Seis son de Caibarién (prefijo `CA`); los otros dos son consolidados de los seis polos.

| Fichero (patrón) | Qué es | Tabla del informe que alimenta | Comprobado |
|---|---|---|---|
| `CACM<aaaammdd>` | **Cuadro de mando operativo** diario, una hoja por día y un RESUMEN que suma los días del mes | **Plan de los consumos** (bloque «Portadores energéticos»: plan de consumo e índice plan de diésel, electricidad y agua) | ✔ **por valores**: los tres índices plan de Caibarién son los de la hoja «Energía» de la TABLA CA 2025 (3/3) |
| | | **Desmanche** (desmanchadas, recuperadas, % recuperado) | Misma estructura que la tabla, y el RESUMEN es la suma de los días (8/8 prendas). No hay informe ni bloque de la TABLA CA del mismo mes para cruzar valores |
| | | Rechazo por causa, vehículos operativos (chapa y estado), plantilla por área | Rechazo ya sale del CD. Vehículos: como con el CD, coinciden los que funcionan, no el total. La plantilla no da la necesidad ni los cubiertos de la tabla de vacantes |
| `CO ROPA NUEVA <mes>` | Ropa nueva por polo (los seis) y por cadena hotelera | **Lencería nueva** | ✔ **parcial por valores**: las cifras de Cayo Coco y Cayo Cruz del fichero están igual en la TABLA CA 2025 y en el informe de enero de 2025. Habana, Varadero y Caibarién vienen a cero en esta copia, y Holguín no casa |
| `INVENTARIOS_GLOBALES` | Inventarios por polo y mes: meta anual, planificados, realizados, conciliados | **Inventarios realizados** | Estructura idéntica (meta anual por polo y total). La copia solo trae enero de 2026, y no hay informe de ese mes |
| `CAMU<aaaamm>` | **Mal uso** semanal por hotel y un acumulado del mes, separado en detectado en la lavandería y por el hotel | **Mal uso** (columna del polo) | Estructura sí. Es de abril de 2026 y solo tiene un hotel relleno; no hay informe de abril |
| `CAAH<aaaammdd>` | Análisis diario por hotel: inventario, pendientes, stock real, montas, envíos, necesidad | **Lencería en uso** (stock real en hotel, total del polo) y montas | Mismo orden de magnitud que la lencería en uso de Caibarién, pero la fecha (septiembre de 2025) no coincide con ningún informe |
| `CAIL<aaaammdd>` | Informe mensual de logística: entregas, montas «solo arrendamiento», recogidas y entregas, ratios de cambio | Montas | ✘ Sus montas de enero de 2025 **no** son las del informe de enero de 2025 (las del informe salen del CD) |
| `CAER<aaaammdd>` | Entrega y recogida diaria por hotel | — | No alimenta ninguna tabla |
| `CATP` | Cálculo de la productividad mensual (plantilla de 2022) | Productividad | Ya sale de la TABLA CA (fila 53) |

**Sigue sin fuente** después de revisarlos: faltantes, cuentas por cobrar y por pagar, vacantes y mando extranjero. El retiro no viene en estos informes, pero sí en el CD (ver «¿Viene lo tecleado en el CD?»).

**Corrección: los arribos sí están en la TABLA CA.** La de 2026 tiene un bloque «Arribos» en «Rechazo e inyecciones» (columnas BY–CF, seis polos), tecleado y sin mes. Sus totales por prenda coinciden con los de la tabla ARRIBOS del informe de enero de 2025 (7/7); el reparto por polo, no.

**Lo que falta para dar por buena la fuente:** los ficheros de un mismo mes que tenga informe (por ejemplo mayo o junio de 2026), y de los tres polos del informe, no solo de Caibarién.

## Mapa tabla a tabla

Leyenda:

- 🟢 **Sale por mes** del GLOBAL o de la TABLA CA. Se puede generar eligiendo el mes.
- 🟡 **Está, pero sin mes:** hoja auxiliar tecleada a mano. Su dato de origen llega en el CD, que hoy no se carga.
- 🔴 **No está** ni en el GLOBAL ni en la TABLA CA.

Columnas de las tablas: «año anterior» es el mismo mes del año anterior. %, diferencias y crecimientos se calculan a partir de las columnas base.

### Economía

| # | Tabla (marcador) | Origen de las columnas base | Cálculo | Estado | Comprobado |
|---|---|---|---|---|---|
| 1 | Cumplimiento del plan de Ingresos (`TABLA_INGRESOS`) | **Plan:** GLOBAL **código 1 «Ventas Totales»** PLAN (= TABLA CA fila 11, vinculada). **Real:** TABLA CA **fila 12 = alquiler + lavado + otros del CD**, que es la que usa el informe; el código 1 REAL del GLOBAL coincidió en enero de 2026. **Año anterior:** TABLA CA fila 69 | % = real / plan; real − plan; real − año anterior; crecimiento = real / año anterior | 🟢 | Valores: **junio de 2026, 40/40**; enero de 2026, 7/7 |
| 2 | Impacto de la ocupación sobre los ingresos (`TABLA_OCUPACION`) | TABLA CA filas 6–7 (TD plan y real) + ingresos de la tabla 1. En la TABLA CA lo calcula «Datos económicos», filas 9–12 | incumplimiento = TD real − TD plan; ingreso estimado del incumplimiento = incumplimiento × (ingreso real / TD real); sin afectación = real + estimación; cumplimiento estimado = sin afectación / plan | 🟢 | Reconstruida exacta con junio de 2026; II Trimestre 28/32 |
| 3 | Presupuesto de gastos (`TABLA_PRESUPUESTO_GASTOS`) | GLOBAL **CONSOLIDADO**, columna del mes, PLAN / REAL / Qp. **La columna «Filas» es el código del GLOBAL** | Entran las partidas con plan o real ≠ 0 | 🟢 | Valores: enero de 2026, 73 de 74 partidas coinciden con esa regla |
| 4 | Cumplimiento del plan de Costos (`TABLA_COSTOS`) | GLOBAL **código 52 «Costos Directos»** (= TABLA CA filas 16–17) | Como la 1 | 🟢 | Valores: diciembre de 2025 y enero de 2026 |
| 5 | Cumplimiento del plan de Gastos (`TABLA_GASTOS`) | GLOBAL fila **«Gastos Totales (Indirectos + Fijos)»** (sin código) (= TABLA CA filas 18–19) | Como la 1 | 🟢 | Valores: diciembre de 2025 |
| 6 | Impacto de la ocupación sobre los gastos (`TABLA_RELACION_GASTOS_OCUPACION`) | TD de la tabla 2 + gastos de la tabla 5 | dejado de gastar = −incumplimiento TD × (gasto **plan** / TD **plan**); ejecutado sin afectación = real + dejado de gastar; % = eso / plan. Usa otra base que la tabla 2 | 🟢 | Reconstruida exacta con junio de 2026 |
| 7 | Cumplimiento del plan de Utilidades (`TABLA_UTILIDADES`) | GLOBAL **código 207 «Utilidades antes de Impuestos»** (= TABLA CA filas 22–23) | Como la 1 | 🟢 | Valores: diciembre de 2025 |
| 8 | Costo y gasto por peso de ingreso (`TABLA_COSTO_POR_PESO`) | Real: TABLA CA filas 47–48 (costo / ingresos, gastos / ingresos). Plan: plan costo / plan ingresos y plan gastos / plan ingresos | Ratios | 🟢 | Fórmulas |
| 9 | Ingresos por turista día (`TABLA_INGRESO_TURISTA_DIA`) | Ingresos (código 1) / TD real (fila 7). Plan: fila 11 / fila 6. Año anterior: fila 69 / fila 64 | Ratios | 🟢 | Valores: año anterior, diciembre de 2025 |
| 10 | Precio de venta del kg lavado (`TABLA_PRECIO_KG`) | Real: fila 45 (ingresos / kg). Plan: fila 11 / fila 8. Año anterior: fila 100 | Ratios | 🟢 | Valores: año anterior, diciembre de 2025 |
| 11 | Edades de las cuentas por cobrar (`TABLA_CXC`) | TABLA CA «Datos económicos», a una fecha de corte. Junio y el II Trimestre usaron la misma, el 31-05-2026. Origen: contabilidad | — | 🟡 sin mes (y no viene en el CD) | Valores: junio de 2026, 28/28 |
| 12 | Edades de las cuentas por pagar (`TABLA_CXP`) | Ídem | — | 🟡 sin mes (y no viene en el CD) | Valores: junio de 2026, 16/18 |

### Producción

| # | Tabla | Origen | Cálculo | Estado | Comprobado |
|---|---|---|---|---|---|
| 13 | Producciones – Productividad (`TABLA_KG_LAVADOS`) | TABLA CA: real fila 9, plan fila 8, año anterior fila 66, prendas procesadas fila 10, productividad fila 53, rendimiento de la capacidad fila 60. Plan también en las filas 1–2 del GLOBAL | % = real / plan; «kg procesados / kg lavados» | 🟢 | Fórmulas; plan por valores (diciembre de 2025) |
| 14 | kg por turista día (`TABLA_KG_TURISTA_DIA`) | Fila 9 / fila 7. Plan: fila 8 / fila 6. Año anterior: fila 66 / fila 64 | Ratios | 🟢 | Fórmulas; TD del año anterior por valores |
| 15 | Consumo de productos químicos (`TABLA_CONSUMO_QUIMICOS`) | Índices de la TABLA CA. En 2026: real fila 199, plan 200, año anterior 203 (en 2025: 197, 198 y 201). Salen de los kg por producto / producción. La etiqueta del índice real dice un año viejo; es el del libro | Ratios | 🟢 | Valores: junio de 2026, 7/7 filas |

### Lencería

| # | Tabla | Origen hoy | Origen real | Estado |
|---|---|---|---|---|
| 16 | Arribos (`TABLA_ARRIBOS`) | «Rechazo e inyecciones», bloque «Arribos», columnas BY–CF (en junio: «No hubo arribos») | Probablemente compras o almacén central; no viene en los informes que tributan al CD | 🟡 (antes 🔴; corregido el 2026-10-22) |
| 17 | Montas por habitación (`TABLA_MONTAS_HABITACION`) | Hoja «Montas», filas 21–28 (junio de 2026: 8/8 filas) | **CD, 5.Lencería 1** (comprobado: 3/3 polos) | 🟡 |
| 18 | Montas por cliente (`TABLA_MONTAS_CLIENTE`) | Hoja «Montas» (junio de 2026: 32/32 celdas) | **CD, 5.Lencería 1** (comprobado: 2/3 polos) | 🟡 |
| 19 | Lencería en uso (`TABLA_LENCERIA_USO`) | «Rechazo e inyecciones», columna CI, filas 3–11 (junio de 2026: 9/9 filas) | **No está en el CD** (0/3). Probablemente el stock real en hotel del análisis diario `CAAH` (sin comprobar por fecha) | 🟡 |
| 20 | Lencería nueva (`TABLA_LENCERIA_NUEVA`) | En 2025, bloque «Ropa nueva» de «Rechazo e inyecciones». **En la de 2026 no están los valores de junio** | **No está en el CD** (0/3). **Informe `CO ROPA NUEVA`** (comprobado en parte por valores) | 🟡 |
| 21 | Rechazo (`TABLA_RECHAZO`) | «Rechazo e inyecciones», filas 28–38 (junio de 2026: 11/11 filas) | **CD, Lencería 2** (comprobado: 2/3 polos; La Habana no lo rellenó) | 🟡 |
| 22 | Mal uso (`TABLA_MAL_USO`) | «Rechazo e inyecciones». Los valores de junio ya no están | **CD, Lencería 2, en el trimestral** (Varadero y Caibarién, 8/8). El mensual de mayo no casa con el CD; candidato: informe semanal `CAMU` (estructura) | 🟡 |
| 23 | Tratamientos de desmanche (`TABLA_DESMANCHE`) | «Rechazo e inyecciones». Los valores de junio ya no están | **CD, Lencería 2, «Recuperaciones»** (comprobado en mayo: Varadero y Caibarién; La Habana vacío). El cuadro de mando `CACM` lo trae por días | 🟡 |
| 24 | Retiro generado (`TABLA_RETIRO`) | «Rechazo e inyecciones». Los valores de junio ya no están | **CD, Lencería 2, «Descartes»** (comprobado en mayo: Varadero 8/8, Caibarién a cero; La Habana vacío) | 🟡 |
| 25 | Inyecciones (`TABLA_INYECCIONES`) | «Rechazo e inyecciones». Junio estaba a cero: no se puede verificar | **CD, Lencería 2** (comprobado con La Habana en mayo) | 🟡 |
| 26 | Inventarios realizados (`TABLA_INVENTARIOS`) | «Rechazo e inyecciones» y «Datos económicos» (cantidad y plan) | **Informe `INVENTARIOS_GLOBALES`** (estructura idéntica; el CD trae los resultados por hotel) | 🟡 |
| 27 | Faltantes detectados (`TABLA_FALTANTES`) | Hoja «Montas», columna AD (con los de 2025). Junio estaba a cero: no se puede verificar | **No sale directo del CD** (diferencias por hotel; no se ve la regla) | 🟡 |

### Servicios técnicos

| # | Tabla | Origen | Cálculo | Estado |
|---|---|---|---|---|
| 28 | Diésel por kg lavado (`TABLA_DIESEL`) | Real: fila 57 (fila 36 / fila 9). Año anterior: fila 112. **Plan: hoja «Energía»** (índice plan, tecleado; lo trae el cuadro de mando `CACM`, comprobado por valores con Caibarién en 2025) | Ratio | 🟢 real · 🟡 plan. Junio de 2026: 7/7 filas |
| 29 | Electricidad por kg (`TABLA_ELECTRICIDAD`) | Filas 58 / 113 + «Energía» | Ídem | 🟢 · 🟡 plan. Junio de 2026: 7/7 |
| 30 | Agua por kg (`TABLA_AGUA`) | Filas 59 / 114 + «Energía» | Ídem | 🟢 · 🟡 plan. Junio de 2026: 7/7 |
| 31 | CDT de equipos (`TABLA_CDT`) | Fila 34; año anterior fila 89 | Media de los polos con actividad | 🟢. Junio de 2026: 3/3 filas |
| 32 | CDO de equipos (`TABLA_CDO`) | Fila 35; año anterior fila 90 | Ídem | 🟢. Junio de 2026: 3/3 |

### Transporte, calidad y RRHH

| # | Tabla | Origen | Estado |
|---|---|---|---|
| 33 | Presupuesto del transporte (`TABLA_PRESUPUESTO_TRANSPORTE`) | GLOBAL, hoja de cada polo: **código 130 «Partes, Piezas y Agregados»** y **código 134 «Servicios p/ mtto transp. terrestre»**, PLAN y REAL del mes. Comprobado por valores en diciembre de 2025 y en junio de 2026 (17/31 celdas; el resto son porcentajes y ceros) | 🟢 |
| 34 | Disponibilidad de vehículos (`TABLA_DISPONIBILIDAD_VEHICULOS`) | TABLA CA 2026, **«Datos económicos», filas 27–33** (junio de 2026: 7/7 filas). Tecleada, sin mes | 🟡 (el CD, 7.Transporte, trae el estado de cada vehículo, pero contarlo no da la tabla) |
| 35 | Satisfacción del cliente: año actual, año anterior y crecimiento (`TABLA_SATISFACCION`) | Fila 40; año anterior fila 95. En la hoja consolidada, filas 285, 304 y 315 (junio de 2026: las tres) | 🟢 |
| 36 | Salario medio (`TABLA_SALARIO`) | Fila 52. Junio de 2026, hoja consolidada fila 264; diciembre de 2025, 74/84 | 🟢 |
| 37 | Promedio de trabajadores (`TABLA_TRABAJADORES`) | Fila 28 (junio de 2026, exacta). Coincide con los «cargos cubiertos» de la tabla de vacantes. El GLOBAL también la tiene, sin código | 🟢 |
| 38 | Cargos vacantes (`TABLA_VACANTES`) | «Datos económicos», filas 3–9 (junio de 2026: 4/4 filas) | 🟡 (cifra ajustada a mano; el CD, 9.RRHH, solo lista los cargos vacantes) |
| 39 | Mando extranjero (`TABLA_MANDO_EXTRANJERO`) | — | 🔴 (subsección opcional) |

### Recuento

- 🟢 **22 tablas** salen ya por mes: toda la economía salvo las cuentas, toda la producción, consumos (salvo su plan), CDT, CDO, presupuesto de transporte, satisfacción, salario y trabajadores.
- 🟡 **16 tablas** están en la TABLA CA tecleadas sin mes: toda la lencería (con faltantes y, desde el 2026-10-22, arribos), cuentas por cobrar y pagar, disponibilidad de vehículos y vacantes, más el plan de los consumos. **6 salen del CD** (montas ×2, rechazo, inyecciones, desmanche y retiro), más el mal uso del trimestral; ver «¿Viene lo tecleado en el CD?».
- 🔴 **1 tabla** no está en ninguna de las dos fuentes: el mando extranjero, que es una subsección opcional. Los arribos estaban aquí hasta el 2026-10-22, cuando apareció su bloque en la TABLA CA 2026.
- De las tecleadas, los informes que tributan al CD explican el plan de los consumos (por valores), la lencería nueva (en parte, por valores), y el desmanche, el mal uso y los inventarios (por estructura). Ver «Los informes que tributan al CD».

Corregido el 2026-10-21 con los ficheros de 2026: la disponibilidad de vehículos y los faltantes sí están en la TABLA CA. Antes figuraban como 🔴.

## Trimestres

Las tablas laterales de la TABLA CA agregan así, y conviene mantenerlo para que un informe nuevo se pueda comparar con los antiguos:

- **Se suman** los flujos: ingresos, costos, gastos, utilidades, kg y TD.
- **Se promedian los ratios mensuales:** costo y gasto por peso, venta y costo por kg, índices de consumo, productividad, CDT y CDO. Ojo: el **plan** del precio por kg se calcula como cociente de sumas, y el real como media de cocientes. No es lo mismo; hay que decidir si se mantiene.

## Lo que hace falta para «Generar informe» con comprobación de datos

- **GLOBAL:** se puede consultar ya desde la app, en `global_ai`. Un mes de un polo cuenta como cargado si el código 1 tiene plan o real (regla de D6). Hace falta el mes del año en curso y el mismo mes del anterior.
- **TABLA CA:** solo existe como xlsx en el VPS. Para que la app diga qué falta hay que sincronizarla a Supabase, como `global_ai`, o preguntar a n8n. Las 28 filas de un polo y mes se rellenan cuando se sube su CD.
- **Lo que está sin mes (🟡)** no se puede comprobar ni generar por mes tal como está. Que el Agente TABLA CA cargue las hojas de lencería del CD resuelve las montas, el rechazo y las inyecciones. **Para las otras 11 hay que averiguar de dónde salen** antes de decidir cómo entran por mes.
- **Polos cerrados:** en 2026 Cayo Coco, Cayo Cruz y Holguín están cerrados. Algunas tablas los muestran a cero y otras solo enseñan los polos con actividad. Hay que fijar la regla para que «falta» no salte por un polo cerrado.

## Comprobación por mes (montada el 2026-10-21)

Lo que enseña el apartado de la app ([[Automatizaciones]], «Informe del Consejo: por meses»). Lo calcula `disponibilidad_informe_consejo(anio)` (migración 013, [[Supabase]]).

| Grupo | Qué se pide | A quién | Bloquea |
|---|---|---|---|
| GLOBAL | El mes cargado (tiene filas en `global_ai`) | Los seis polos: las tablas económicas los llevan siempre | Sí |
| TABLA CA · datos del CD del mes | TD real, producción, prendas, ingresos, trabajadores, CDT, CDO, diésel, electricidad, agua, calidad y químicos | Polos operativos ese mes | Sí |
| TABLA CA · plan del mes | TD plan y producción plan | Polos operativos | Sí |
| TABLA CA · mismo mes del año anterior | TD, producción e ingresos del bloque «año anterior» | Polos operativos | Sí |
| Tecleado | Montas, lencería, rechazo y demás, cuentas, vehículos, vacantes, plan de consumos | — | No: «sin comprobar» (decisión de Leo) |

**Polo operativo:** el GLOBAL tiene ventas de lavandería (código 33) ese mes; si el GLOBAL aún no trae el mes, cuenta el anterior. Con datos de 2026 salen La Habana, Varadero y Caibarién todo el año; Cayo Coco hasta febrero; Holguín hasta marzo; Cayo Cruz enero, febrero y abril. **Si el polo no tiene turistas-día ese mes** (venta residual de un polo que cerró), solo se le piden los ingresos de su CD.

**De dónde sale la TABLA CA en Supabase:** `vps/Polarier/Leslie/CD/sync_tabla_ca.py` lee la TABLA CA del año e imprime, por mes × polo × indicador, si el dato está. La función `sync_tabla_ca_meses()` lo carga. Mismo patrón que `sync_global_ai.py` ([[Generacion-Documentos]], D6). Lo delicado son las fórmulas:
- Los vínculos al GLOBAL cuentan si la celda del GLOBAL tiene número o si la caché trae un número distinto de 0. El 0 en caché es lo que deja Excel en los meses sin cargar.
- Las sumas sobre celdas vacías no cuentan; por eso los ingresos del CD se miran en alquiler, lavado y otros, no en el total.

Probado con la copia local de la TABLA CA 2026 y simulado en la base de datos: enero a mayo completos; en junio falta la calidad de La Habana; julio pide los CD de los polos abiertos; agosto y septiembre, además, el GLOBAL de Cayo Cruz y de Varadero.

**Estado (2026-10-21):** la pantalla está hecha y la migración 013 **aplicada** (registrada como `informe_consejo`).

`sync_tabla_ca.py` está en el VPS, en `/data/Polarier/Leslie/CD/`, con SHA-256 `b7b96c19…3a41`, el mismo que el del repo. La primera carga de la TABLA CA 2026 dejó 1.224 filas en `tabla_ca_meses`. El GLOBAL se encontró y no quedó ningún vínculo sin resolver. Se hizo con un flujo temporal de n8n, ejecución 555, que ya está archivado. El script llegó al flujo a través de una tabla temporal de Supabase, ya borrada.

Disponibilidad real después de la carga:
- **Enero, marzo, abril y mayo:** completos.
- **Febrero:** a Cayo Coco le faltan la calidad y los químicos.
- **Junio:** a La Habana le falta la calidad; a Caibarién, las prendas y los consumos.
- **Julio a septiembre:** faltan los CD de los polos abiertos, y en agosto y septiembre también el GLOBAL de Cayo Cruz y de Varadero.
- **Octubre a diciembre:** falta el GLOBAL.

**Resincronización tras cada Tabla CA (en producción desde el 2026-10-21, versión `6d5308c2` de «Polarier Auto App»).** Después de `CD - Responder` van dos nodos nuevos. Como el usuario ya tiene su respuesta, no le hacen esperar:
- `CD - Resumir para Supabase` ejecuta en el pythonrunner `Leslie/CD/sync_tabla_ca.py`. Le pasa `TABLA CA <año>.xlsx`, con el año que da `CD - Preparar`, la misma ruta que lee `CD - Leer tabla`.
- `CD - Cargar en tabla_ca_meses` llama a la RPC `sync_tabla_ca_meses` con la credencial «Polarier».

Funciona igual que `Normalizar GLOBAL` → `Cargar en global_ai`. Se probó con un flujo temporal que imitaba `CD - Preparar` (ejecución 556, 1.224 filas), ya archivado. Si el agente falla, la rama acaba en `CD - Error` y no resincroniza: la tabla se queda como estaba hasta la siguiente carga buena.

Falta: la rama de n8n que genera el informe.

## Verificación con los ficheros de 2026 (VPS, 2026-10-21)

Se trajeron del VPS `GLOBAL-CP26.xlsx` y `TABLA CA 2026.xlsx` con un flujo temporal de n8n, de solo lectura y disparador manual, que se archivó al terminar. Con ellos se cruzaron las tablas de **junio de 2026** y del **II Trimestre de 2026**:

- **Celda a celda:** ingresos 40/40, gastos 47/49, utilidades 47/49, precio del kg 28/28, cuentas por cobrar 28/28, montas por cliente 32/32. En el II Trimestre: ingresos 43/46, gastos 48/49, utilidades 46/49 y TD 20/20, desde «TABLAS CHEQUEOS CONSOLIDADAS»; el presupuesto, desde la hoja «2do. Trimestre» del GLOBAL.
- **Fila a fila**, para las tablas de enteros pequeños o fracciones, donde una celda suelta casa con cualquier cosa: montas por habitación 8/8, lencería en uso 9/9, rechazo 11/11, químicos 7/7, diésel, electricidad y agua 7/7, CDT y CDO 3/3, vehículos 7/7, vacantes 4/4; satisfacción, salario y trabajadores exactos.
- **Lo que no casa:** mal uso, desmanche, retiro y lencería nueva de junio, porque esos bloques ya contienen otro período. Inyecciones y faltantes de junio estaban a cero, así que no son verificables.

**Lo que hay en cada fichero hoy:**

| Fichero | Meses cargados |
|---|---|
| GLOBAL-CP26 | Hasta **septiembre** en La Habana, Caibarién y el consolidado; julio en Varadero. Los polos cerrados tienen huecos |
| TABLA CA 2026 | Indicadores de los polos abiertos hasta **junio**; faltan los CD de julio en adelante. Los polos cerrados, solo enero y febrero. Gastos y utilidades llegan a julio porque son vínculos al GLOBAL |

**Las filas económicas de la TABLA CA 2026 son vínculos externos al GLOBAL-CP26:**

| Fila de la TABLA CA | Fila del GLOBAL |
|---|---|
| Plan de producción | fila 1 |
| Real de producción | fila 2 |
| Plan de ingresos | código 1 |
| Costo | fila 49 (código 52) |
| Gastos | fila 188 |
| Utilidad en operaciones | fila 179 (código 196) |
| Utilidad neta | fila 186 (código 207) |
| VAB | fila 189 |
| Salario | fila 99 (código 109) |

Solo se refrescan cuando alguien abre el libro en Excel con el GLOBAL accesible. **Para automatizar, la economía se debe leer directamente del GLOBAL** (`global_ai`), y de la TABLA CA solo lo que viene del CD.

El libro tiene además vínculos a TABLAS CA antiguas y a una ruta de OneDrive personal: restos que no afectan a las tablas del informe.

## Límites del estudio

- La economía, la producción, los consumos, CDT, CDO, RRHH, cuentas, vehículos y la mitad de la lencería están verificados con valores de 2026. Mal uso, desmanche, retiro, lencería nueva, inyecciones, faltantes e inventarios **solo por estructura**: sus valores de junio ya no están, o eran ceros.
- El cruce con el CD se hizo con **un solo mes** (mayo de 2026) y tres polos, porque son los únicos CD de 2026 disponibles en local. Lo que no casa puede deberse también a que el informe de mayo se preparara con datos corregidos después del CD.
- Los scripts para repetirlo están en `consejo-direccion/scripts/origen_datos/`. `vectores.py` busca filas enteras.
