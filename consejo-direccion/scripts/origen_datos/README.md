# Origen de los datos del informe

Scripts del estudio que mapea cada tabla del informe del Consejo con su origen en el GLOBAL y en la TABLA CA. El resultado está en `vault/Informe-Consejo-Origen-Datos.md`.

1. `extraer_informe.py <informe.docx> <tablas.json>` vuelca las tablas de un informe (o de un DOCX de tablas) a JSON.
2. `cruce.py <tablas.json> <cruce.json> <GLOBAL.xlsx> <TABLA CA.xlsx> [...]` busca cada cifra en las celdas de los libros. Los GLOBAL guardados con openpyxl no traen valores de fórmulas en caché, así que el script los evalúa: `SUM`, aritmética y referencias entre hojas, que es todo lo que usan.
3. `detalle.py <cruce.json> [posiciones]` resume, fila a fila, de qué hoja y fila salen las cifras.
4. `vectores.py <tablas.json> <posiciones> <libros...>` busca filas enteras del informe como secuencia de valores. Sirve para las tablas de enteros pequeños o fracciones, donde una celda suelta casa con cualquier cosa. Se ejecuta con `PYTHONPATH` apuntando a esta carpeta, porque importa `cruce.py`.

Ejecutar con `py -3 -P`. Los ficheros de datos (informes, GLOBAL, TABLA CA) nunca van en el repo: es público.

Para cruzar con el CD de un polo:

5. `cruce_cd2.py <tablas.json> <polo> <posiciones> <CD.xlsx>` empareja **por nombre de prenda** (o por la fila del polo) la columna de ese polo en cada tabla del informe con las columnas del CD. Necesita `PYTHONPATH` en esta carpeta.
6. `volcar_hoja.py <libro.xlsx> <hoja> [filas] [columnas]` vuelca una hoja como rejilla compacta para ver cómo está montada.
