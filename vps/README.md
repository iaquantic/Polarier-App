# Scripts del VPS

Copia versionada de los scripts que el **pythonrunner** ejecuta en el VPS (Easypanel, proyecto `polarierauto`). En el contenedor viven bajo `/data/Polarier/`, con la misma estructura de carpetas que aquí: `vps/Polarier/Leslie/x.py` → `/data/Polarier/Leslie/x.py`, y n8n los lanza con `POST http://polarierauto_pythonrunner:8000/run` y `{"script": "Leslie/x.py", "args": []}`.

**La copia que se ejecuta es la del VPS.** Si cambias un script aquí, súbelo al VPS (hoy, con un workflow sonda de n8n que lo escribe con *Read/Write Files from Disk*) y comprueba el SHA-256: `sync_global_ai.py` lo devuelve en su salida (`script_sha256`).

| Script | Lo usa | Qué hace |
|---|---|---|
| `Polarier/Leslie/sync_global_ai.py` | «Polarier Auto App», al terminar cada Modelo 1 | Normaliza el `GLOBAL-CP<aa>.xlsx` para `global_ai` (ver `supabase/migrations/010_sync_global_ai.sql`). Solo lee. |

Los demás scripts del VPS (`Leslie/Modelo1.py`, `Carla/actualizar_general.py`, `Leslie/CD/rellenar_ca.py`) todavía no están versionados aquí; ver `vault/Generacion-Documentos.md`.
