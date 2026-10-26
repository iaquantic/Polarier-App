# Rotación de las claves de Supabase

Proyecto `zongaaygriklqsxzxfgl`. Pendientes T-a15c2a26f0 / A-cdad7adf0d (supervisor de proyectos) y «Rotar la service_role key» en [[Pendientes]].

## Por qué y qué significa «rotar» aquí

La service_role legacy estuvo en claro en el JSON de «Polarier Auto App» y sigue en el historial de versiones de n8n. Es un JWT firmado con el **JWT secret legacy**, válido hasta 2036.

Supabase **ya no deja rotar** las claves legacy (`anon`, `service_role`) ni el JWT secret a secas. La salida es migrar:

1. `service_role` → **secret key** (`sb_secret_…`); `anon` → **publishable key** (`sb_publishable_…`, ya existe: `default`).
2. **Desactivar** las claves legacy (reversible, en Settings → API Keys).
3. **Migrar el JWT secret a signing keys**, rotar y **revocar** el secret legacy. Sin este paso, la service_role filtrada seguiría valiendo como `Authorization: Bearer` (es un JWT bien firmado) aunque la clave esté desactivada como `apikey`.

Las claves nuevas no son JWT: van en la cabecera `apikey`. En `Authorization: Bearer` solo se aceptan si son idénticas a `apikey` (comprobado el 2026-10-26 con la publishable: `apikey` + `Bearer` iguales → 200). La credencial `supabaseApi` de n8n manda la misma clave en las dos cabeceras, así que vale.

## Consumidores (inventario del 2026-10-26)

| Consumidor | Clave hoy | Cambio | Quién |
|---|---|---|---|
| n8n, credencial `supabaseApi` **«Polarier»** (`a0l4Y70xe5eaZYNH`) | service_role legacy | Pegar la `sb_secret_…` en el campo de la clave. No hay que tocar nodos. | Leo |
| Nodos que la usan, todos en «Polarier Auto App»: `HTTP Request`, `HTTP Request8`, `M1 - Descargar`, `CD - Descargar`, `OC - Descargar` (desactivado), `Cargar en global_ai`, `CD - Cargar en tabla_ca_meses`, los `CON - *` (consultar, marcar, guardar, leer, subir, cerrar, error), `Delete a row`, las 3 herramientas `global_ai_*` y `Supabase Vector Store` / `Supabase Vector Store2` | — | Ninguno lleva clave escrita a mano (0 `eyJ`, 0 `sb_secret` en el JSON) ni `Bearer` manual hacia Supabase. **Confirmar en el editor** que llevan «Polarier» y no «Mr. Volant». | — |
| App web (`polarierapp` en Easypanel, Build Arg `VITE_SUPABASE_ANON_KEY`) | anon legacy | Poner la publishable `default` en esa misma variable y **Deploy**. El nombre de la variable no cambia. supabase-js 2.102.1 funciona con ella (probado: REST 200, login falso → «Invalid login credentials»). | Leo / Easypanel |
| App Android (Capacitor) | — | Nada: carga la web remota (`server.url` = dominio de la app), no lleva la clave dentro. | — |
| Edge Function `disparar-informe-mensual` | `SUPABASE_ANON_KEY` del entorno + `verify_jwt` | Código ya adaptado en el repo: lee `SUPABASE_PUBLISHABLE_KEYS` (cae a la anon si no está) y comprueba el JWT con `auth.getUser`, para poder ir con `verify_jwt = false`. Desplegada el 2026-10-26 (versión 6). Para redesplegar: `supabase functions deploy disparar-informe-mensual --no-verify-jwt`. | — |
| Routines de Claude (informe mensual, informe del Consejo) | conector MCP de Supabase (OAuth) | Nada. | — |
| `Postgres account` de n8n (memoria del chat) | contraseña de la base de datos | Nada: no depende de las claves JWT. | — |
| Scripts del VPS (`vps/`), `consejo-direccion/` | ninguna | Nada (no leen claves de Supabase). | — |
| `.env` local de Leo | anon legacy (probable) | Cambiar `VITE_SUPABASE_ANON_KEY` por la publishable. | Leo |
| **Sin revisar:** workflows no legibles por el MCP (`chatbot multimensajes` `XtGbAdBxfI10sC3S`, `My workflow` `pxemOGf2sGwKSjch` y 5 más) | ? | Mirar si alguno apunta a `zongaaygriklqsxzxfgl`: hay que activar «MCP access» en cada uno (tarjeta del workflow o Settings) o mirarlos en el editor. Los únicos activos son esos dos. La credencial «Mr. Volant» (`mtppdy6KLo10esNf`) **ya no es duda** (2026-10-26): no llega a ningún host («incorrect host»), así que no apunta a Polarier. | Leo |

## Cómo saber quién usa todavía las claves legacy

Los logs del gateway marcan cada petición. Con el MCP de Supabase (`query_logs`, ventana máxima 24 h):

```sql
select log_attributes['request.headers.user_agent'] as ua,
       log_attributes['request.sb.jwt.apikey.payload.role'] as legacy_role,
       log_attributes['request.sb.apikey.apikey.prefix'] as new_key_prefix,
       count(*) as n, max(timestamp) as ultimo
from logs where source = 'edge_logs'
group by ua, legacy_role, new_key_prefix order by ultimo desc
```

`legacy_role` relleno = clave legacy (`anon` o `service_role`); `new_key_prefix` relleno = clave nueva. El 2026-10-26 la única fila legacy era `n8n` con `service_role` (iat 2026-04-01).

## Orden seguro

Cada paso es reversible salvo borrar una clave; ninguno exige parar la app.

1. **Supabase → Settings → API Keys → «Publishable and secret API keys».** Crear una secret key con nombre `n8n` (una por backend, para poder rotarlas por separado). Copiarla solo al paso 2.
2. **n8n → Credentials → «Polarier»:** pegar la `sb_secret_…`, guardar (n8n prueba la conexión). Comprobar: una ejecución que toque Supabase sale `success` (por ejemplo, abrir un documento o lanzar Modelo 1 / TABLA CA desde la app) y en los logs aparece `n8n` con `new_key_prefix = sb_secret_…`.
3. **Edge Function:** desplegar la versión del repo con `verify_jwt = false`. Comprobar: sin sesión responde `401 Sesión no válida`; con sesión, «Generar informe» en la app sigue funcionando.
4. **Easypanel → `polarierapp` → Environment:** `VITE_SUPABASE_ANON_KEY` = publishable `default` → **Deploy**. Comprobar: el bundle publicado contiene `sb_publishable_` y ya no la anon legacy; login, chat y auditoría funcionan.
5. Cambiar el `.env` local y revisar los workflows no legibles y «Mr. Volant».
6. Volver a lanzar la consulta de logs: **ninguna fila con `legacy_role`**.
7. **Settings → API Keys → desactivar `anon` y `service_role` legacy.** Comprobar: una petición con la service_role antigua como `apikey` → 401; app y n8n siguen bien.
8. **Settings → JWT Keys → «Migrate JWT secret»**, luego **«Rotate keys»** a la clave asimétrica (ECC P-256) en standby. Las sesiones abiertas no se cierran. Si el botón no aparece, el proyecto ya está migrado: mirar en `…/auth/v1/.well-known/jwks.json` y en los logs (`request.sb.jwt.authorization.payload.algorithm`) si las sesiones ya van en ES256.
9. Pasada al menos **1 h 15 min** (caducidad de los access token), **revocar** el JWT secret legacy («Previously used» → *Revoke*). Comprobar: la service_role antigua como `Bearer` (con la publishable de `apikey`) → 401. Aquí queda cerrada la exposición.
10. Marcar el pendiente en [[Pendientes]] y en el supervisor, con las pruebas.

## Resultado (2026-10-26, hecho con Leo)

| Paso | Hora UTC | Comprobación |
|---|---|---|
| Edge Function desplegada (versión 6, `verify_jwt = false`) | 17:36 | Sin sesión → 401 «Sesión no válida»; en los logs, la función ya llama con la publishable (`SUPABASE_PUBLISHABLE_KEYS` existe). |
| Secret key `n8n` en la credencial «Polarier» | 17:49 | Sonda temporal en n8n (ejecución 578, `success`, archivada): REST, listado de Storage y nodo Supabase con 1 elemento cada uno; los logs muestran `n8n` con `sb_secret_`. |
| `polarierapp`: publishable en `VITE_SUPABASE_ANON_KEY` + Deploy | 17:54 | El bundle `index-CBqmCOD2.js` lleva la publishable y no la anon; 93 peticiones con sesión desde el navegador, 0 errores. |
| Revisión de 7 días de logs | — | Con claves legacy solo aparecían la app, n8n, pruebas con `curl` y una petición suelta de `node` (20-oct 00:47, service_role) sin identificar. |
| Claves legacy desactivadas | 18:01:34 | La anon antigua como `apikey` → 401 «Legacy API keys are disabled». |
| Secreto JWT HS256 revocado | ~18:06 | **No hizo falta migrar ni rotar:** el proyecto ya tenía la clave ECC P-256 (`kid 206a0c8f…`) como clave en uso, y las sesiones ya iban firmadas con ella. Un JWT HS256 como `Bearer` → 401 PGRST301 (REST) y «signature verification failed» (Storage). La sesión de Leo (ES256) sigue dando 200. |

La service_role filtrada ya no sirve ni como `apikey` ni como `Bearer`.

## Qué puede romperse

- Un consumidor olvidado con la clave legacy deja de funcionar en el paso 7: se reactivan las claves legacy desde el mismo panel y se arregla.
- El paso 8 rompe cualquier función con `verify_jwt = true`: por eso el paso 3 va antes.
- La secret key devuelve 401 si la petición parece venir de un navegador (`User-Agent`). n8n manda `User-Agent: n8n`, así que no le afecta.
