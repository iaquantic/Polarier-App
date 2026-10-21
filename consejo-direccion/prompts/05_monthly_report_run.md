# Prompt 05 — Generación del informe mensual

## Cuándo usar
Cada mes, cuando está disponible el DOCX de tablas del período.

---

## Flujo completo paso a paso

### Paso 1 — Preparar los archivos de entrada

1. Colocar el DOCX de tablas del mes en:
   ```
   data/input/mes_actual/Informe MES tablas.docx
   ```
   Ejemplo: `Informe JUNIO tablas.docx`

   > Solo debe haber un DOCX en esa carpeta. Reemplazar el del mes anterior.

2. Crear el JSON de análisis en:
   ```
   data/processed/analisis_{mes}_{año}.json
   ```
   Ejemplo: `analisis_junio_2026.json`

   Estructura del JSON:
   ```json
   {
     "mes": "JUNIO",
     "año": "2026",
     "sections": {
       "INTRO_ECONOMIA": "...",
       "ANALISIS_INGRESOS": "...",
       "ANALISIS_OCUPACION": "...",
       ...
       "SECCION_VALORACION": "...",
       "SECCION_RIESGOS": "...",
       "SECCION_CONCLUSIONES": "..."
     }
   }
   ```

   Para generar los textos de análisis, usar los agentes en `agents/active/`
   y la skill `council-report-writing`. Ver estructura de claves en
   `data/processed/analisis_marzo_2026.json` como referencia.

### Paso 2 — Ejecutar el generador

Desde la raíz del proyecto:
```
py -3 scripts/generate_report.py
```

El script detecta automáticamente el DOCX de entrada y el JSON de análisis,
infiere el mes y el año, y genera el informe en:
```
data/output/consejo_direccion_{MES}_{AÑO}.docx
```

### Paso 3 — Verificar el resultado

- Abrir el DOCX generado en Word y revisar que:
  - El encabezado muestra el mes y año correctos.
  - Todas las tablas del DOCX de entrada aparecen en el informe.
  - Los textos de análisis están completos y sin marcadores `{...}` visibles.
  - Las secciones de valoración, riesgos y conclusiones están presentes.

---

## Estructura de claves del JSON de análisis

| Clave | Descripción |
|---|---|
| `INTRO_ECONOMIA` | Párrafo de apertura de la sección económica (H1) |
| `INTRO_PRODUCCION` | Párrafo de apertura de la sección de producción (H1) |
| `INTRO_LENCERIA` | Párrafo de apertura de la sección de lencería (H1) |
| `INTRO_SERVICIOS_TECNICOS` | Párrafo de apertura de servicios técnicos (H1) |
| `INTRO_TRANSPORTE` | Párrafo de apertura de la sección de transporte (H1) |
| `INTRO_CALIDAD` | Párrafo de apertura de la sección de calidad (H1) |
| `INTRO_RRHH` | Párrafo de apertura de recursos humanos (H1) |
| `ANALISIS_INGRESOS` | Análisis de cumplimiento del plan de ingresos |
| `ANALISIS_OCUPACION` | Análisis de la relación ingresos / ocupación |
| `ANALISIS_PRESUPUESTO_GASTOS` | Ejecución del presupuesto, partidas sobregiradas y subejecuciones |
| `ANALISIS_COSTOS` | Costos directos por polo |
| `ANALISIS_GASTOS` | Gastos indirectos por polo |
| `ANALISIS_RELACION_GASTOS_OCUPACION` | Relación gastos / ocupación |
| `ANALISIS_UTILIDADES` | Utilidades del período |
| `ANALISIS_COSTO_POR_PESO` | Costo y gasto por peso de ingreso |
| `ANALISIS_INGRESO_TURISTA_DIA` | Ingresos por turista día |
| `ANALISIS_PRECIO_KG` | Precio de venta del kg lavado |
| `ANALISIS_CXC` | Cuentas por cobrar |
| `ANALISIS_CXP` | Cuentas por pagar |
| `ANALISIS_KG_LAVADOS` | Kilogramos lavados |
| `ANALISIS_KG_TURISTA_DIA` | Kg lavados por turista día |
| `ANALISIS_CONSUMO_QUIMICOS` | Consumo de productos químicos |
| `ANALISIS_ARRIBOS` | Arribos de lencería nueva |
| `ANALISIS_MONTAS_HABITACION` | Montas de lencería por habitación |
| `ANALISIS_MONTAS_CLIENTE` | Montas de lencería por cliente |
| `ANALISIS_LENCERIA_USO` | Inventario de lencería en uso |
| `ANALISIS_LENCERIA_NUEVA` | Inventario de lencería nueva |
| `ANALISIS_RECHAZO` | Rechazo de lencería |
| `ANALISIS_MAL_USO` | Mal uso de lencería |
| `ANALISIS_DESMANCHE` | Desmanche y recuperación |
| `ANALISIS_RETIRO` | Retiro de lencería |
| `ANALISIS_INYECCIONES` | Inyecciones de lencería al circuito |
| `ANALISIS_FALTANTES` | Faltantes detectados en inventarios |
| `ANALISIS_INVENTARIOS` | Ejecución del plan de inventarios |
| `ANALISIS_DIESEL` | Consumo de diésel |
| `ANALISIS_ELECTRICIDAD` | Consumo de electricidad |
| `ANALISIS_AGUA` | Consumo de agua |
| `ANALISIS_CDT` | Coeficiente de disponibilidad técnica |
| `ANALISIS_CDO` | Coeficiente de disponibilidad operacional |
| `ANALISIS_INVERSIONES` | Ejecución del presupuesto de inversiones |
| `ANALISIS_PRESUPUESTO_TRANSPORTE` | Ejecución del presupuesto de transporte |
| `ANALISIS_DISPONIBILIDAD_VEHICULOS` | Disponibilidad de la flota de vehículos |
| `ANALISIS_SATISFACCION` | Resultados de encuestas de satisfacción, **incluida la comparación con el año anterior** (tablas del año en curso, del anterior y fila de crecimiento, que van juntas) |
| `ANALISIS_MANDO_EXTRANJERO` | Listado nominal del mando extranjero. Solo si el DOCX trae esa tabla (No. / Nombre y Apellidos / Cargo); si no, la subsección se elimina |
| `ANALISIS_SALARIO` | Salario medio por trabajador |
| `ANALISIS_TRABAJADORES` | Promedio de trabajadores |
| `ANALISIS_VACANTES` | Resumen de cargos vacantes |
| `SECCION_VALORACION` | Valoración sintetizada de la administración |
| `SECCION_RIESGOS` | Riesgos identificados del período |
| `SECCION_CONCLUSIONES` | Conclusiones y acciones prioritarias |

---

## Si el DOCX de entrada cambia de estructura

No hay que tocar nada si faltan tablas o vienen en otro orden: el script reconoce
cada tabla por su título (`config/table_markers.yaml`), no por su posición.

Si trae una tabla que no reconoce, se detiene antes de crear el informe y dice cuál.
En ese caso, añadir su patrón en `config/table_markers.yaml` (y su marcador en la
plantilla maestra si es una tabla nueva) y volver a ejecutar.

## Restricciones absolutas
- No inventar ningún dato.
- No generar cifras que no estén en las tablas del DOCX de entrada.
- Usar `[dato no disponible]` para indicadores sin datos — esas subsecciones
  se eliminan automáticamente del informe.
