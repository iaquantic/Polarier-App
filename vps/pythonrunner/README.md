# pythonrunner

Servicio `pythonrunner` del proyecto `polarierauto` en Easypanel. Ejecuta los scripts de `/data/Polarier/` que le pide n8n:

```
POST http://polarierauto_pythonrunner:8000/run   {"script": "Leslie/x.py", "args": []}
GET  http://polarierauto_pythonrunner:8000/health
```

**Cómo se despliega:** el servicio se creó con **Source → Upload**: un archivo comprimido con estos tres ficheros, construido con su Dockerfile. Easypanel no deja editar nada de eso desde la interfaz. Para cambiar algo:

1. Edita aquí `Dockerfile`, `requirements.txt` o `main.py`.
2. Rehaz `pythonrunner-upload.zip`, con los tres ficheros en la raíz del ZIP.
3. En Easypanel → `polarierauto` → `pythonrunner` → **Source → Upload**, arrastra el ZIP y pulsa **Deploy**. El runner se reinicia unos segundos: mientras tanto falla todo lo que usa Python (Modelo 1, CD y la sincronización de `global_ai`).
4. Comprueba que arrancó en la pestaña **Console** del servicio (`bsdtar --version`, `python -c "import pypdf"`) o con `Leslie/agente_modelo1.py version`.

**Origen:** `main.py` y el `requirements.txt` original se copiaron del contenedor el 2026-10-14 y se comprobó que eran idénticos byte a byte (SHA-256 `9c3a9519…6911` y `e5fcdedd…5aa7`). El Dockerfile original no estaba en el contenedor; se reconstruyó a partir del registro del último build (agosto de 2026) y de la orden de arranque (`uvicorn main:app --host 0.0.0.0 --port 8000`).

**Cambios respecto al original (2026-10-14):**
- `libarchive-tools` (`bsdtar`), para que el Agente Modelo 1 abra los RAR.
- `pypdf==6.10.2` en `requirements.txt`. Con esto, el wheel suelto de `Leslie/` deja de hacer falta, aunque no estorba.
- Versiones fijadas a las que tenía instaladas el contenedor: antes `pandas`, `requests`, `openpyxl`, `numpy` y `Pillow` iban sin versión, así que cualquier redespliegue traía las últimas.
- `python-docx`, `lxml` y `PyYAML` (2026-10-22), para el informe del Consejo (`Leslie/Consejo/scripts/`), y el tiempo máximo de un script sube de 120 s a 300 s: preparar las tablas recalcula las fórmulas de la TABLA CA y el GLOBAL.
