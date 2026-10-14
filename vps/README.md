# Scripts del VPS

Copia versionada de los scripts que el **pythonrunner** ejecuta en el VPS (Easypanel, proyecto `polarierauto`). En el contenedor viven bajo `/data/Polarier/`, con la misma estructura de carpetas que aquí: `vps/Polarier/Leslie/x.py` → `/data/Polarier/Leslie/x.py`, y n8n los lanza con `POST http://polarierauto_pythonrunner:8000/run` y `{"script": "Leslie/x.py", "args": []}`.

**La copia que se ejecuta es la del VPS.** Si cambias un script aquí, súbelo al VPS (hoy, con un workflow sonda de n8n que lo escribe con *Read/Write Files from Disk*) y comprueba el SHA-256: `sync_global_ai.py` lo devuelve en su salida (`script_sha256`).

| Script | Lo usa | Qué hace |
|---|---|---|
| `Polarier/Leslie/sync_global_ai.py` | «Polarier Auto App», al terminar cada Modelo 1 | Normaliza el `GLOBAL-CP<aa>.xlsx` para `global_ai` (ver `supabase/migrations/010_sync_global_ai.sql`). Solo lee. |
| `Polarier/Leslie/CD/agente_ca.py` | «Polarier Auto App», rama `Leslie CD` (agente «Agente TABLA CA») | Herramientas del agente que rellena la `TABLA CA <año>.xlsx` con un CD: `preparar`, `ver_hoja`, `ver_global`, `estado_tabla`, `escribir` (nunca pisa fórmulas, copia en `CD/respaldos/`) y `limpiar`. Importa el `Evaluador` de `sync_global_ai.py`, así que los dos tienen que estar en el VPS. `preparar` devuelve `script_sha256`. Sustituye a `rellenar_ca.py`. |
| `Polarier/Leslie/agente_modelo1.py` | «Polarier Auto App», rama `M1 - *` (agente «Agente Modelo 1»; **pendiente de aplicar**, ver `n8n/agente-modelo1/`) | Herramientas del agente que lleva los PDF de Modelo 1 (sueltos, ZIP o RAR) al `GLOBAL-CP<aa>.xlsx`: `preparar`, `ver_filas`, `ver_pdf`, `ver_global`, `escribir` (copia previa en `Leslie/respaldos_global/`), `verificar` y `cerrar`. Necesita `pypdf` en el runner (o en `Leslie/_vendor/`) e importa el `Evaluador` de `sync_global_ai.py`. Sustituye a `Modelo1.py`. |

El servicio que ejecuta todo esto, el `pythonrunner`, también está versionado en `vps/pythonrunner/`, con su `Dockerfile`, `main.py` y la forma de desplegarlo.

Los demás scripts del VPS (`Leslie/Modelo1.py`, al que sustituirá `agente_modelo1.py`, `Carla/actualizar_general.py`, `Leslie/CD/rellenar_ca.py`) todavía no están versionados aquí; ver `vault/Generacion-Documentos.md`.
