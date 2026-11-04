# Contraste con el Excel «Modelo Mensual»

Genera `src/test/fixtures/modeloMensual.json`, que usa `src/test/control.excel.test.ts` para comprobar que `src/lib/control.ts` da lo mismo que las fórmulas reales del libro.

El Excel no está en el repositorio, porque es público. Los escenarios de `rellenar.py` son **inventados**: no pongas ahí cifras reales.

Hay que regenerarlo si cambian las fórmulas del Excel:

```bash
pip install openpyxl
npm i --no-save hyperformula
python scripts/modelo-mensual/rellenar.py "ruta/al/Modelo Mensual.xlsx" libro.json
node scripts/modelo-mensual/calcular.cjs libro.json src/test/fixtures/modeloMensual.json
```

Tras regenerarlo, borra `libro.json`: lleva dentro el libro entero.

## Plantilla corregida

`corregir_kpi.py` genera la copia que se reparte a los supervisores: recupera la columna Base de `KPI_calidad` y quita los `#REF!` de esa hoja y de `Resumen`. No toca el original.

```bash
pip install openpyxl
python scripts/modelo-mensual/corregir_kpi.py "Modelo Mensual.xlsx" "Modelo Mensual corregido.xlsx"
```

Para comprobar que la app reconoce un libro, sus hojas y sus columnas, sin subir nada:

```bash
MODELO_MENSUAL_XLSX="ruta/al/libro.xlsx" bunx vitest run src/test/controlExcelImport.test.ts
```
