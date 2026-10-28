# Informe del Consejo — lencería por mes desde el CD (diseño)

> **Estado: en producción desde el 2026-10-28.** La app, desde la PR 42 (merge `f1bd772`, `polarierapp` desplegada a las 17:46 UTC). Leo aprobó el diseño con las tres propuestas de abajo, tras leer las respuestas del formulario ([[Informe-Consejo-Origen-Datos]], «Respuestas del 2026-10-28»).
>
> **Puesto en producción el 2026-10-28:**
> - **VPS:** el commit `3d6b90e`, instalado con `Leslie/instalar_consejo.py` (16 ficheros, más el extractor en `Leslie/CD/`).
> - **Supabase:** migración 015 aplicada.
> - **Lencería de mayo de 2026:** cargada a mano con los tres CD de mayo que había en local. Resultado: La Habana con 4 bloques vacíos y Caibarién sin retiro.
> - **n8n «Polarier Auto App»:** versión `e89d2655`.
>   - Rama `CD -`: `CD - Leer lencería`, `CD - Cargar lencería` y `CD - Lencería sin cargar`.
>   - Rama `CON -`: `CON - Leer lencería` y `CON - Preparar lencería`, que pasan `--lenceria-b64` a `preparar`.
>
> **Prueba de punta a punta (mayo de 2026, 2026-10-28, de 17:20 a 17:33 UTC):** `listo`, con 37 tablas.
> - Las ocho de lencería salen del CD (24 filas de `cd_lenceria`); siguen tecleadas solo las siete que no vienen en él.
> - La routine escribió los 47 textos, sin ningún «[dato no disponible]».
> - Los textos dicen qué polo no rellenó cada bloque, por ejemplo «el retiro solo está disponible para Varadero». No se inventan esos datos y avisan de que faltan los kg y el año anterior.
>
> **Desde la 015, un mes solo se genera si sus polos activos tienen la lencería cargada.** Hoy solo mayo de 2026 la tiene: hacen falta los CD de los demás meses.
>
> **Piezas:**
> - `vps/Polarier/Leslie/CD/cd_lenceria.py`, con sus tests en `test_cd_lenceria.py`;
> - `supabase/migrations/015_cd_lenceria.sql`;
> - `consejo-direccion/src/lenceria_cd.py`, con sus tests en `tests/test_lenceria_cd.py`;
> - `preparar_consejo.py --lenceria / --lenceria-b64`;
> - el grupo «Lencería del CD» en la app;
> - `instalar_consejo.py`, que ya baja también el extractor.
>
> **Validación con los CD de mayo de 2026** (La Habana, Varadero y Caibarién) contra el informe de mayo:
>
> | Tabla | Coinciden |
> |---|---|
> | Montas por habitación | 24/24 |
> | Montas por cliente | 23/24 (la que no, Varadero, toalla facial: P25) |
> | Rechazo | 16/16 en Varadero y Caibarién |
> | Desmanche | 30/32; las dos que fallan, por redondeo del % |
> | Retiro | 16/16 |
>
> - **La Habana** sale «—» donde su CD está vacío (P6, P24).
> - **El mal uso no casa con el mensual de mayo.** Según la P2, la cifra buena es la del CD.
> - **Faltantes:** Varadero 8/8, Caibarién 6/8 y La Habana 1/8. Con la regla de la P10 sale otra cosa que lo tecleado en el informe: **hay que confirmarlo con quien prepara la TABLA CA.**
>
> **Lo que apareció al construirlo:**
> - Los códigos de prenda TB y TC significan cosas distintas según el CD.
> - El retiro de Varadero trae el mes en la columna rotulada «2025».
> - Caibarién teclea solo la «Diferencia» de los inventarios.
> - En las montas por cliente de Caibarién, el TOTAL da `#DIV/0!` cuando un solo hotel tiene turistas-día. Se usa ese hotel.

## Por qué

Las respuestas dicen que la lencería del informe sale del CD de cada polo, que se corrige primero el CD y que las diferencias que vimos son cifras tecleadas a mano en la TABLA CA (P2, P4–P6, P10, P24, P25, P29). Y la P28 confirma que las hojas auxiliares de la TABLA CA no guardan histórico. Hoy el informe lee esas hojas, así que un mes pasado sale con lo tecleado más tarde.

**Respeta la decisión del 2026-10-22:** la TABLA CA no se toca. Lo del CD se guarda aparte, en Supabase, solo para el informe.

## Qué entra (fase 1)

| Tabla del informe | Bloque del CD | Qué se guarda por prenda |
|---|---|---|
| Montas por habitación | «5.Lencería 1», «ESTADO DE LAS MONTAS POR HABITACIÓN» | El índice de la columna TOTAL del polo |
| Montas por cliente | «5.Lencería 1», «ESTADO DE LAS MONTAS POR CLIENTE» | Ídem, más los TD totales y promedio del bloque |
| Rechazo | «Lencería 2», «RESUMEN DE LOS RECHAZOS POR TIPO DE PRENDA» | La columna SUMA |
| Mal uso | «Lencería 2», «RESUMEN DEL MAL USO» | La columna SUMA, sin tocar (P2) |
| Inyecciones | «Lencería 2», «RESUMEN DE LAS INYECCIONES» | La columna SUMA |
| Desmanche | «Lencería 2», «RECUPERACIONES DE LENCERÍA» | Tratadas («Producción»), recuperadas y % |
| Retiro | «Lencería 2», «DESCARTES», «Descarte generado en el mes» | La cantidad (P6: descarte = retiro) |
| Faltantes | «Lencería 2», «Resultados de los inventarios realizados» | Suma de las diferencias **negativas** de los hoteles inventariados en el mes (P10); los sobrantes, aparte. También el «Importe», por si es la pérdida (ver abajo) |

**Fuera de la fase 1, porque no vienen en el CD:** lencería en uso, lencería nueva, inventarios realizados, arribos, cuentas por cobrar y por pagar, vacantes y plan de los consumos. Siguen como hoy, tecleadas y sin mes, hasta que lleguen los modelos que prometieron y haya un canal por mes. **Vehículos** tampoco: los polos han cambiado su hoja de transporte (P17) y hay que homogeneizarla primero.

**Los CD no son iguales en todos los polos** (comprobado con los de mayo de 2026):
- **Caibarién y Varadero** siguen el modelo.
- **La Habana** usa otros títulos («RESUMEN DE LOS RECHAZOS DE LENCERÍA MENSUAL», «RESUMEN DEL DESCARTE POR HOTELES», «RESUMEN INYECCIONES POR HOTELES») y parte el desmanche en «sin remojo» y «con remojo».
- Los nombres de hoja también cambian: «5.Lenceria 1 (2)», «Lencería 2 MAYO».
- Las prendas van por nombre («Sabana Personal») en unos bloques y por código en otros: SP, SK, F, ALF, TC = toalla de baño, TM = toalla de cara, TF, TB, TP.

## Cómo

```
App «Tabla CA» (sube el CD) → n8n rama CD - (como hoy: TABLA CA + tabla_ca_meses)
                                 └─ nuevo: CD - Leer lencería (pythonrunner) → CD - Cargar lencería (Supabase)
App «Informe del Consejo» → disponibilidad (mira también cd_lenceria)
n8n rama CON - → nuevo: CON - Leer lencería (Supabase) → preparar_consejo.py --cd-lenceria-b64 …
```

1. **Tabla `cd_lenceria`** (migración 015): una fila por año, mes, polo y bloque.
   - Columnas: `estado` (`ok`, `vacio` o `no_encontrado`), `valores` (jsonb, prenda → medida → valor), `fichero`, `hoja`, `rango`, `avisos` y `cargado_at`.
   - Lectura: autenticados, como `tabla_ca_meses`. Escritura: solo n8n con la service role.
   - **Vacío no es cero:** un bloque sin rellenar queda en `vacio`, no a ceros. Pasa con La Habana (P6, P24).
2. **Extractor `vps/Polarier/Leslie/CD/cd_lenceria.py leer <CD>`**, junto al agente de la TABLA CA.
   - Localiza hojas y bloques por título (con las variantes de arriba), las columnas por cabecera (SUMA, TOTAL, Producción…) y las filas por prenda.
   - Devuelve JSON con la celda de origen y los avisos.
   - No escribe en ningún fichero.
   - Tests con libros inventados.
3. **Rama `CD -` de n8n:** dos nodos después de `CD - Cargar en tabla_ca_meses`, ya respondida la app, así que no retrasan ni cambian la respuesta del agente. Si fallan, la TABLA CA queda cargada igual y el fallo se ve en la ejecución.
4. **Disponibilidad** (`disponibilidad_informe_consejo`): un grupo nuevo, «CD · lencería», por polo activo. Los polos cerrados no cuentan: lo logístico va a 0 (P31).
5. **`preparar_consejo.py`:** las ocho tablas pasan a leer de `cd_lenceria` (n8n se lo pasa en base64, como el análisis a `montar`). Dejan de ser «tecleadas», y la routine ya no tiene que avisar de que pueden ser de otro período.
   - TOTAL: suma de los polos; en las montas, promedio.
   - Trimestre: suma de los tres meses. Las montas se promedian y el % de desmanche se recalcula con las sumas.
6. **Recarga de meses pasados:** el mismo extractor sobre una carpeta de CD, sin pasar por el agente de la TABLA CA (no la toca), y carga en Supabase. Hacen falta los CD: **no los guardamos**. Solo hay uno en Storage (julio de Varadero), y en este PC los tres de mayo de 2026. Los que se suban desde ahora por Automatizaciones quedan en el bucket `documents`.

## Lo que la fase 1 no puede rellenar todavía

- ~~kg y % de rechazo, mal uso y retiro~~ **Resuelto el 2026-10-28.** Llegó la tabla de pesos por pieza (P3, P7), que está en `PESOS` de `consejo-direccion/src/lenceria_cd.py`. kg = cantidad × peso; % = kg / kg lavados del mes (fila «REAL PRODUCCIÓN» del polo en la TABLA CA). Con mayo de 2026 los % coinciden con el informe y los kg difieren hasta un 2 %; quizá la TABLA CA usa pesos con más decimales. La toalla bidet no tiene peso y no cuenta en los kg.
- **Pérdida económica de los faltantes:** la calcula Economía con el sistema contable (P11). El CD trae un «Importe» por hotel. Hay que confirmar si es esa pérdida, y en qué moneda.
- **Columna del año anterior** («TOTAL 2025»): saldría de los CD del mismo mes de 2025. Sin ellos, en blanco con aviso.

## Decisiones que necesito

1. **Un bloque vacío en el CD de un polo activo:** ¿bloquea la generación («falta») o solo avisa? *Propuesta:* que el CD no esté cargado es «falta»; un bloque vacío dentro de un CD cargado es aviso, sale «—» en la tabla y el texto dice que no hay dato.
2. **Columna del año anterior mientras no haya CD de 2025:** ¿en blanco o se sigue leyendo lo tecleado? *Propuesta:* en blanco con aviso; lo tecleado no tiene mes.
3. **¿Quién reúne los CD de 2026** (enero a septiembre, de los polos activos) para la recarga, y los de 2025 si se quiere el año anterior?

## Cómo se comprobaría

- **Tests del extractor** con libros inventados: los dos modelos de CD, nombres de hoja con sufijos, bloques vacíos y `#DIV/0!`.
- **Contra el informe de mayo de 2026,** con los tres CD de mayo.
  - Lo esperado según el estudio: montas por habitación 3/3, por cliente 2/3, rechazo 2/3 y desmanche y retiro de Varadero y Caibarién.
  - Las diferencias deberían ser las que explican P24 y P25, cifras tecleadas a mano.
- **Una generación de mayo de punta a punta** con las tablas nuevas, como la del 2026-10-23.
