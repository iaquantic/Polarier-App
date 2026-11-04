// Un libro «Modelo Mensual» mínimo para las pruebas: cabeceras reales, sin datos reales.
import {
  COLS_ACCIONES,
  COLS_ENCUESTAS,
  COLS_EQUIPOS,
  COLS_INCIDENCIAS,
  COLS_KPI,
  COLS_LAVADO,
  COLS_MANTENIMIENTO,
  COLS_OPERACION,
  COLS_PACTADAS,
  COLS_PROCESADO,
  COLS_RETIROS,
  FILAS,
  HOJAS,
  LETRAS_PRENDAS,
  PRENDAS_HOJA,
  TITULOS_KPI_SIN_BASE,
} from "@/lib/controlHojas";
import { LectorExcel } from "@/lib/controlExcel";

export type Celdas = Record<string, Record<string, unknown>>;

export const libroBase = (opciones: { sinBase?: boolean } = {}): Celdas => {
  const c: Celdas = Object.fromEntries(HOJAS.map((h) => [h, {}]));
  const poner = (hoja: string, cols: { letra: string; titulo: string }[], fila: number) => {
    for (const col of cols) c[hoja][`${col.letra}${fila}`] = col.titulo;
  };
  c.Datos_mes.B7 = 11;
  c.Datos_mes.B8 = 2026;
  c.Datos_mes.B9 = "Hotel de Prueba";
  poner("Operacion", COLS_OPERACION, FILAS.cabecera);
  if (opciones.sinBase) {
    poner("KPI_calidad", TITULOS_KPI_SIN_BASE.map((titulo, i) => ({ titulo, letra: "ABCDEFG"[i] })), FILAS.cabecera);
  } else {
    poner("KPI_calidad", COLS_KPI, FILAS.cabecera);
  }
  poner("KPI_calidad", COLS_ENCUESTAS, FILAS.encuestas.cabecera);
  poner("Incidencias", COLS_INCIDENCIAS, FILAS.cabecera);
  poner("Equipos", COLS_EQUIPOS, FILAS.cabecera);
  poner("Equipos", COLS_MANTENIMIENTO, FILAS.mantenimiento.cabecera);
  poner("Retiros_importes", COLS_RETIROS, FILAS.cabecera);
  poner("Acciones", COLS_ACCIONES, FILAS.cabecera);
  poner("Lavado_detalle", COLS_LAVADO, FILAS.cabecera);
  poner("Procesado_detalle", COLS_PROCESADO, FILAS.cabecera);
  poner(
    "Inventario",
    [
      { letra: "A", titulo: "Fecha" },
      { letra: "B", titulo: "Ubicación" },
      ...LETRAS_PRENDAS.map((letra, i) => ({ letra, titulo: PRENDAS_HOJA[i] })),
      { letra: "L", titulo: "Acta / observación" },
    ],
    FILAS.cabecera
  );
  poner("Inventario", COLS_PACTADAS, FILAS.pactadas.cabecera);
  return c;
};

export const lector = (c: Celdas): LectorExcel => ({
  hojas: Object.keys(c),
  celda: (h, r) => c[h]?.[r] ?? null,
});

/** Escribe A, B, C, D, E, F, G, H, J, K, L: lo calculado (I, M) no se teclea. */
export const lavadoExcel = (c: Celdas, fila: number, v: unknown[]) => {
  "ABCDEFGHJKL".split("").forEach((letra, i) => {
    if (v[i] !== undefined) c.Lavado_detalle[`${letra}${fila}`] = v[i];
  });
};
