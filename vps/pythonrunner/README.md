# pythonrunner

Servicio `pythonrunner` del proyecto `polarierauto` en Easypanel. Ejecuta los scripts de `/data/Polarier/` que le pide n8n:

```
POST http://polarierauto_pythonrunner:8000/run   {"script": "Leslie/x.py", "args": []}
GET  http://polarierauto_pythonrunner:8000/health
```

**Cómo se despliega (desde el 2026-10-23):** la fuente del servicio es **GitHub**: repo `iaquantic/Polarier-App`, rama `informe-consejo/generacion`, ruta `/vps/pythonrunner`, construido con su `Dockerfile` y **sin auto-deploy**. Hasta esa fecha era **Source → Upload** (un ZIP con los tres ficheros), pero el API de Easypanel no deja subir un ZIP, así que se cambió para poder desplegar sin la interfaz. Para cambiar algo:

1. Edita aquí `Dockerfile`, `requirements.txt` o `main.py`, commitea y haz push a la rama del servicio.
2. En Easypanel → `polarierauto` → `pythonrunner` → **Deploy** (o `deploy_service` por el MCP `easypanel`). Construye la punta de la rama en ese momento: Easypanel no acepta un sha. El runner se reinicia unos segundos: mientras tanto falla todo lo que usa Python (Modelo 1, CD y la sincronización de `global_ai`).
3. Comprueba que arrancó en la pestaña **Console** del servicio (`bsdtar --version`, `python -c "import pypdf"`) o con `Leslie/agente_modelo1.py version`.

**Cuando `informe-consejo/generacion` se fusione a `main`:** cambia la rama del servicio a `main` y despliega. Si la rama se borra antes, el siguiente despliegue falla al descargar el código.

`pythonrunner-upload.zip` queda solo como alternativa, por si hubiera que volver a Source → Upload desde la interfaz: rehazlo con los tres ficheros en la raíz.

**Origen:** `main.py` y el `requirements.txt` original se copiaron del contenedor el 2026-10-14 y se comprobó que eran idénticos byte a byte (SHA-256 `9c3a9519…6911` y `e5fcdedd…5aa7`). El Dockerfile original no estaba en el contenedor; se reconstruyó a partir del registro del último build (agosto de 2026) y de la orden de arranque (`uvicorn main:app --host 0.0.0.0 --port 8000`).

**Cambios respecto al original (2026-10-14):**
- `libarchive-tools` (`bsdtar`), para que el Agente Modelo 1 abra los RAR.
- `pypdf==6.10.2` en `requirements.txt`. Con esto, el wheel suelto de `Leslie/` deja de hacer falta, aunque no estorba.
- Versiones fijadas a las que tenía instaladas el contenedor: antes `pandas`, `requests`, `openpyxl`, `numpy` y `Pillow` iban sin versión, así que cualquier redespliegue traía las últimas.
- `python-docx`, `lxml` y `PyYAML` (2026-10-22), para el informe del Consejo (`Leslie/Consejo/scripts/`), y el tiempo máximo de un script sube de 120 s a 300 s: preparar las tablas recalcula las fórmulas de la TABLA CA y el GLOBAL. Desplegado el 2026-10-23.
- `python-dateutil==2.9.0.post0` fijada (2026-10-23): `pandas` la pide sin versión, y el primer despliegue de ese día trajo la 3.0.0, publicada dos días antes. Se vuelve a la que había.
