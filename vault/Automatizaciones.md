# Automatizaciones (sección de la app)

Sección nueva (2026-10-20) que **saca del chat el disparo de los documentos**. Cada proceso tiene su apartado: dice qué fichero espera, lo revisa antes de enviarlo y llama al **trigger propio de su rama** en n8n.

**Cada automatización entra por un solo sitio: su trigger.** El chat conversacional sigue igual (texto, audio, imágenes, base de conocimiento), pero si alguien sube ahí un Modelo 1, un CA o un Integral, el chat ya no lo procesa: responde diciendo en qué apartado subirlo.

> Por qué: el nombre del fichero era el único contrato ([[Generacion-Documentos]], regla 1). La gente no sabía qué mandar, un nombre mal puesto se iba a la rama equivocada sin aviso y todas las automatizaciones se mezclaban en la misma conversación.

## Qué hay

| Automatización | slug | Espera | Rama de n8n | Webhook (path) |
|---|---|---|---|---|
| Modelo 1 | `modelo-1` | PDF «Ingresos y Gastos», o ZIP/RAR con varios | `M1 - *` (Agente Modelo 1) | `d872f8b4-5994-45e8-96d9-cf5c3a82f5b1` |
| Tabla CA | `tabla-ca` | el **CD**: `<POLO>CD<AAAAMM>.xlsx` (el patrón acepta también `CA`) | `CD - *` (Agente TABLA CA) | `375ae1e4-ffc2-4862-a5a2-cb8c6bb18614` |
| Ocupación | `ocupacion` | fichero `Integral…` | `Extract from File1 → …` | `023e33ed-e085-43a1-b444-40960b4d10de` |
| Informe Consejo de Dirección | `informe-consejo` | Hoy, `Informe MES tablas.docx`. **En rediseño:** sin subida, con selector de mes y comprobación de datos ([[Informe-Consejo-Origen-Datos]]) | **por montar** — asíncrona, ver abajo | `acb55dbd-290c-4c7b-a5d2-6858ce77649b` |

El detalle de qué hace cada rama está en [[Generacion-Documentos]] (D1, D2, D4). Fuera quedan, a propósito, la rama **Carla / COMU** (rota por decisión) y la **base de conocimiento** (`Informe`), que sigue solo por el chat.

## Cómo está montado en n8n

Los triggers nuevos viven **dentro del mismo workflow** «Polarier Auto App» (`BQoya6xrMaF1UAkU`), para no duplicar la lógica de las ramas.

El problema a sortear era que todos los nodos de rama referencian `$('Webhook')` **por nombre**, y una ejecución que arranque en otro trigger revienta esa expresión. Solución:

```
WH Modelo 1  →  M1 - Descargar  →  M1 - Entrada  →  M1 - Guardar → …

Webhook (chat) → … → Switch3[1][3] →  Aviso Modelo 1 →  Responder aviso
```

- `WH <rama>`: Webhook POST con `responseMode: responseNode`.
- `<rama> - Descargar`: copia de `HTTP Request8` (Supabase Storage, credencial `supabaseApi` «Polarier», `responseFormat: file`).
- `<rama> - Entrada`: nodo **Code** que deja el `body` normalizado venga de donde venga, conservando el binario:

```js
let body = null;
try { body = $('Webhook').first().json.body; } catch (e) { body = null; }
if (!body) { try { body = $('WH Modelo 1').first().json.body; } catch (e) { body = null; } }
return $input.all().map(item => ({ json: { body }, binary: item.binary }));
```

- En los nodos de la rama, `$('Webhook')` pasó a `$('M1 - Entrada')` / `$('CD - Entrada')`. Son: `M1 - Guardar`, `M1 - Preparar`, `Agente Modelo 1`, `CD - Guardar`, `CD - Preparar`, `Agente TABLA CA`, `CD - Limpiar` y las cuatro herramientas `ver_hoja_cd`, `ver_global`, `estado_tabla`, `escribir_tabla`. **Si añades un nodo a una rama, referencia el nodo de entrada, nunca `Webhook`.**
- **Ocupación no necesita entrada**: ningún nodo de esa rama referencia el webhook, así que `OC - Descargar` entra directo en `Extract from File1`.
- Los `Respond to Webhook` de cada rama responden al trigger que arrancó la ejecución: sirven para los dos caminos sin tocarlos.
- **`Switch3` ya no alimenta ninguna rama de documentos.** Sus salidas «Modelo 1», «Comprimido», «Leslie CA» y «Raydel» (Integral) van a un `Aviso *` (Set con el campo `Aviso`) y de ahí a `Responder aviso`, que contesta en el chat: *«Este fichero ya no se procesa desde el chat. Súbelo en Automatizaciones → …»*. Las salidas «Carla» y la del agente de chat no se tocaron.
- Los nodos `* - Entrada` leen primero su trigger y dejan la lectura del `Webhook` del chat como reserva, por si algún día se vuelve a conectar `Switch3` a la rama.

## Cómo está montado en la app

- **Catálogo:** `src/lib/automatizaciones.ts`. Una entrada por automatización (slug, nombre, qué sube, qué recibe, extensiones, ejemplos, patrón del nombre y `webhookPath`). De ahí salen rutas, barra lateral, lobby y validación. Añadir una = añadir una entrada.
- **URL:** `getAutomationWebhookUrl(path)` en `src/lib/n8nMode.ts`, con `VITE_N8N_WEBHOOK_BASE(_TEST)`. Respeta `VITE_N8N_MODE`. Si la variable no está, deduce la base recortando la URL del chat.
- **Servicio:** `src/services/automatizaciones.ts` → `ejecutarAutomatizacion()`: revisa el fichero, lo sube al bucket `documents` (`chat_id` nulo), anota la ejecución, llama al webhook con **el mismo payload que el chat** (más `automatizacion: <slug>`) e interpreta la respuesta.
- **Respuesta:** `src/lib/n8nRespuesta.ts`, extraída de `sendToN8n`. La usan chat y automatizaciones: binario, `{respuesta, archivo:{base64}}`, texto, o una URL suelta.
- **Historial:** tabla `automation_runs` (migración `012`), RLS personal. Cada ejecución del listado se puede **abrir**: enseña el mismo resumen que salió al terminar, con su fichero. Como la URL firmada caduca, al abrirla se pide una nueva a partir de `resultado_path`; si el fichero ya se borró, se ve el resumen sin descarga. Desde el índice se entra con `?run=<id>`. Estados `en_curso`, `completada`, `error`. Si la espera se corta (timeout del proxy) la fila se queda en `en_curso`: n8n puede seguir trabajando, así que no se da por perdida.

## Automatizaciones asíncronas (2026-10-21)

Las tres primeras contestan en segundos o en un par de minutos, y la app espera la respuesta del webhook. El [[Informe-Consejo-Direccion]] tarda minutos en redactar ~50 análisis, más de lo que aguanta la espera del proxy. Para esas, `asincrona: true` en el catálogo cambia el contrato:

1. La app sube el fichero, crea la fila de `automation_runs` en `en_curso` y llama al webhook con el mismo payload de siempre, **más `run_id`** (el id de esa fila). Si no consigue crear la fila, no llama: sin ella no habría por dónde recoger el resultado.
2. **La respuesta HTTP es solo el acuse de recibo.** Su texto, si lo trae, se enseña mientras espera («Recibido…»), pero no cierra nada.
3. **La rama cierra la fila ella misma**, con la service role (credencial `supabaseApi` «Polarier»), tanto si termina como si falla:
   - bien: `estado='completada'`, `respuesta` (resumen corto), `resultado_nombre`, `resultado_path` y `finished_at`;
   - mal: `estado='error'`, `error` (el motivo, legible para quien subió el fichero) y `finished_at`. **También los fallos tempranos van por aquí**, no por el acuse: la fila es la única fuente de verdad.
4. El fichero resultante va al bucket `documents` en `<user_id>/assistant/<timestamp>-<nombre>`, que es donde lo deja la app (`uploadDocument`, rol `assistant`), con su fila en la tabla `documents` (`role='assistant'`, `chat_id` nulo). Así el usuario puede pedir la URL firmada y el fichero sale en «Mis Documentos».
5. La página consulta la fila **cada 15 s** mientras la tenga abierta, como `AuditMonth`. Sirve tanto para la recién lanzada como para una «En marcha» abierta del historial. Al cerrarse, enseña el resultado o el motivo. Se puede cerrar la pestaña: el resultado queda en el historial.

Si una asíncrona lleva **más de dos horas** en `en_curso`, la página avisa de que probablemente la rama murió sin cerrar la fila. Es el único caso que la app no puede distinguir por sí sola.

## Validación del nombre: avisa, no bloquea

`revisarArchivo()` distingue dos casos:
- **Error** (no se envía): la extensión no es de las que procesa esa rama.
- **Aviso** (se puede enviar igual): la extensión vale pero el nombre no casa con el patrón de `Switch3`. Manda la rama, no la app: el patrón de la app es una copia y puede quedarse corta.

Los patrones del catálogo son **copia de los de `Switch3`**. Si cambias uno en n8n, cambia el otro.

## Si la descarga falla

Probado el 2026-10-20: cuando `M1/CD - Descargar` no encuentra el fichero, la ejecución moría sin pasar por ningún `Respond to Webhook` y quien llamaba recibía un **200 con el cuerpo vacío**. Ahora esos nodos sacan el error por su segunda salida hacia `M1 - Error` / `CD - Error`, que responden con el texto de siempre.

Ojo: ese texto viaja con **HTTP 200**, como en el chat. La app lo pinta como resultado, no como error. Se dejó así a propósito: con un código de error el chat no enseñaría nada.

## Estado (2026-10-20)

- Workflow **publicado** (versión `032b9758`). Las tres URL de producción responden.
- Comprobado con datos fijados (`test_workflow`, ejecuciones 532–534): un CP, un CA y un Integral subidos **por el chat** salen por `Switch3` 1, 5 y 2, dan el aviso correcto y **no ejecutan ninguna rama**.
- Comprobado contra producción (ejecución 524): el trigger propio entra, autentica contra Supabase Storage y descarga. **La vuelta completa con un fichero real está sin probar**: lo primero que hay que mirar en la primera subida de verdad es que `M1 - Entrada` entrega `body` y el binario.
- Migración `012` **aplicada**.
- **Falta**: `VITE_N8N_WEBHOOK_BASE(_TEST)` en Easypanel + Rebuild, y probar las tres ramas con ficheros reales por los dos caminos.
