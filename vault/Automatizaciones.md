# Automatizaciones (sección de la app)

Sección nueva (2026-10-20) que **saca del chat el disparo de los documentos**. Cada proceso tiene su apartado: dice qué fichero espera, lo revisa antes de enviarlo y llama al **trigger propio de su rama** en n8n. El chat conversacional no cambia, y subir un fichero por el chat sigue funcionando igual.

> Por qué: el nombre del fichero era el único contrato ([[Generacion-Documentos]], regla 1). La gente no sabía qué mandar, un nombre mal puesto se iba a la rama equivocada sin aviso y todas las automatizaciones se mezclaban en la misma conversación.

## Qué hay

| Automatización | slug | Espera | Rama de n8n | Webhook (path) |
|---|---|---|---|---|
| Modelo 1 | `modelo-1` | PDF «Ingresos y Gastos», o ZIP/RAR con varios | `M1 - *` (Agente Modelo 1) | `d872f8b4-5994-45e8-96d9-cf5c3a82f5b1` |
| Tabla CA | `tabla-ca` | `<POLO>CA<AAAAMM>.xlsx` (también el antiguo `CD`) | `CD - *` (Agente TABLA CA) | `375ae1e4-ffc2-4862-a5a2-cb8c6bb18614` |
| Ocupación | `ocupacion` | fichero `Integral…` | `Extract from File1 → …` | `023e33ed-e085-43a1-b444-40960b4d10de` |

El detalle de qué hace cada rama está en [[Generacion-Documentos]] (D1, D2, D4). Fuera quedan, a propósito, la rama **Carla / COMU** (rota por decisión) y la **base de conocimiento** (`Informe`), que sigue solo por el chat.

## Cómo está montado en n8n

Los triggers nuevos viven **dentro del mismo workflow** «Polarier Auto App» (`BQoya6xrMaF1UAkU`), para no duplicar la lógica de las ramas.

El problema a sortear era que todos los nodos de rama referencian `$('Webhook')` **por nombre**, y una ejecución que arranque en otro trigger revienta esa expresión. Solución:

```
WH Modelo 1  →  M1 - Descargar  ─┐
                                 ├→  M1 - Entrada  →  M1 - Guardar → …
Webhook (chat) → … → Switch3[1][3] ┘
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
- `Switch3` y la rama de chat quedan **intactos**.

## Cómo está montado en la app

- **Catálogo:** `src/lib/automatizaciones.ts`. Una entrada por automatización (slug, nombre, qué sube, qué recibe, extensiones, ejemplos, patrón del nombre y `webhookPath`). De ahí salen rutas, barra lateral, lobby y validación. Añadir una = añadir una entrada.
- **URL:** `getAutomationWebhookUrl(path)` en `src/lib/n8nMode.ts`, con `VITE_N8N_WEBHOOK_BASE(_TEST)`. Respeta `VITE_N8N_MODE`. Si la variable no está, deduce la base recortando la URL del chat.
- **Servicio:** `src/services/automatizaciones.ts` → `ejecutarAutomatizacion()`: revisa el fichero, lo sube al bucket `documents` (`chat_id` nulo), anota la ejecución, llama al webhook con **el mismo payload que el chat** (más `automatizacion: <slug>`) e interpreta la respuesta.
- **Respuesta:** `src/lib/n8nRespuesta.ts`, extraída de `sendToN8n`. La usan chat y automatizaciones: binario, `{respuesta, archivo:{base64}}`, texto, o una URL suelta.
- **Historial:** tabla `automation_runs` (migración `012`), RLS personal. Estados `en_curso`, `completada`, `error`. Si la espera se corta (timeout del proxy) la fila se queda en `en_curso`: n8n puede seguir trabajando, así que no se da por perdida.

## Validación del nombre: avisa, no bloquea

`revisarArchivo()` distingue dos casos:
- **Error** (no se envía): la extensión no es de las que procesa esa rama.
- **Aviso** (se puede enviar igual): la extensión vale pero el nombre no casa con el patrón de `Switch3`. Manda la rama, no la app: el patrón de la app es una copia y puede quedarse corta.

Los patrones del catálogo son **copia de los de `Switch3`**. Si cambias uno en n8n, cambia el otro.

## Si la descarga falla

Probado el 2026-10-20: cuando `M1/CD - Descargar` no encuentra el fichero, la ejecución moría sin pasar por ningún `Respond to Webhook` y quien llamaba recibía un **200 con el cuerpo vacío**. Ahora esos nodos sacan el error por su segunda salida hacia `M1 - Error` / `CD - Error`, que responden con el texto de siempre.

Ojo: ese texto viaja con **HTTP 200**, como en el chat. La app lo pinta como resultado, no como error. Se dejó así a propósito: con un código de error el chat no enseñaría nada.

## Estado (2026-10-20)

- Workflow **publicado** (versión `f29a4861`). Las tres URL de producción responden.
- Migración `012` **aplicada**.
- **Falta**: `VITE_N8N_WEBHOOK_BASE(_TEST)` en Easypanel + Rebuild, y probar las tres ramas con ficheros reales por los dos caminos.
