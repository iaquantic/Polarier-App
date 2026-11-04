// -----------------------------------------------------------------------------
// Estructura del libro «Modelo Mensual»: sus hojas y sus columnas, una sola vez.
//
// La tabla de la app y el lector del Excel salen de estas mismas definiciones, así
// que no pueden separarse: cada columna tiene aquí su letra y su título reales.
//
// Lo que guarda la app sigue siendo un parte por día con los vales agrupados
// (`ParteData`), porque de ahí leen el dashboard, los informes y la routine. Aquí se
// traduce a las filas planas de la hoja y de vuelta, sin perder nada de cada fila.
// -----------------------------------------------------------------------------
import {
  AREAS,
  CAUSAS,
  CIERRES,
  CONCEPTOS,
  ESTADOS_ACCION,
  ESTADOS_INCIDENCIA,
  FACTURACION,
  FilaLavado,
  FilaProcesado,
  IMPUTABLE,
  MONEDAS,
  Num,
  SI_NO,
  TIPOS_MANTENIMIENTO,
  TURNOS,
} from "@/lib/control";
import type { ParteData, TandaProcesado, ValeLavado } from "@/lib/controlResumen";

export const HOJAS = [
  "Resumen",
  "Datos_mes",
  "Operacion",
  "KPI_calidad",
  "Incidencias",
  "Equipos",
  "Retiros_importes",
  "Acciones",
  "Lavado_detalle",
  "Procesado_detalle",
  "Inventario",
] as const;

export type Hoja = (typeof HOJAS)[number];

const LEYENDA_MES =
  "Amarillo: rellenar o corregir. Azul claro: cálculo automático. Gris: referencia. Vacío: dato pendiente. Escriba 0 solo si ha comprobado que no hubo cantidad.";
const LEYENDA_DETALLE =
  "Amarillo: introducir datos. Azul claro: cálculo automático. Vacío: pendiente. Escriba 0 solo si lo ha comprobado.";

export const TEXTOS_HOJA: Record<Hoja, { titulo: string; instruccion: string; leyenda: string }> = {
  Resumen: {
    titulo: "Polarier  Resumen del informe mensual",
    instruccion: "Esta hoja se actualiza al rellenar las demás. No se escribe aquí.",
    leyenda: LEYENDA_MES,
  },
  Datos_mes: {
    titulo: "Polarier  Datos del informe mensual",
    instruccion: "Empiece aquí. Complete las casillas amarillas de identificación. El mes y el hotel los pone la app; al subir un Excel se comprueba que coincidan.",
    leyenda: LEYENDA_MES,
  },
  Operacion: {
    titulo: "Polarier  Producción y jornada diaria",
    instruccion: "Rellene turistas, entregas y horas reales en B y E:I. C y D se calculan desde Lavado_detalle. En J marque Cerrado cuando todos los vales del día estén completos, o Sin actividad si comprobó que no hubo recepción ni lavado. Horas en decimal: 1 h 30 min = 1.50.",
    leyenda: LEYENDA_MES,
  },
  KPI_calidad: {
    titulo: "Polarier  Indicadores del SLA y calidad",
    instruccion: "Complete B11:C20 con conteos verificados y G11:G20 con el parte o acta que los respalda. Use la misma unidad en favorables y base. D es la meta fija del SLA; E calcula favorables ÷ base; F indica el cumplimiento. H explica qué contar.",
    leyenda: LEYENDA_MES,
  },
  Incidencias: {
    titulo: "Polarier  Incidencias y contingencias",
    instruccion: "Una fila por incidencia en A11:J110. Complete fecha, causa, horas conocidas, impacto, acción, responsable, cierre, estado, imputabilidad y soporte. Si no conoce la duración deje C vacía. K es automático. Agua y electricidad pueden coincidir.",
    leyenda: LEYENDA_MES,
  },
  Equipos: {
    titulo: "Polarier  Estado técnico y mantenimiento",
    instruccion: "A11:J30: una fila por equipo o grupo homogéneo. B: total; C: operativos al cierre; D calcula los fuera de servicio. Describa estado, intervención y pendiente. Desde la fila 38 registre el mantenimiento previsto y ejecutado, una tarea por fila.",
    leyenda: LEYENDA_MES,
  },
  Retiros_importes: {
    titulo: "Polarier  Retiros faltantes mal uso e importes",
    instruccion: "Una fila por hecho en A11:H110 y J11:L110. D: piezas afectadas. G: precio unitario acordado. H: moneda. I calcula cantidad × precio. Marque J Sí solo con conciliación del hotel y documento en K. No repita una misma baja en varios conceptos.",
    leyenda: LEYENDA_MES,
  },
  Acciones: {
    titulo: "Polarier  Acciones de mejora y seguimiento",
    instruccion: "Una fila por medida en A11:H110. Describa la causa, la acción concreta, responsable y plazo. Actualice estado y resultado. I muestra si queda vencida al cierre del mes elegido. Use una referencia al acta o parte en H.",
    leyenda: LEYENDA_MES,
  },
  Lavado_detalle: {
    titulo: "Polarier  Control de lavado por vale",
    instruccion: "Una fila por fecha, vale y prenda. Registre las piezas recibidas una sola vez. En continuaciones, recibidas = 0 y anote el pendiente inicial. Kg es peso real procesado; no se estima con pesos por prenda. Cierre cada día en Operacion, columna J.",
    leyenda: LEYENDA_DETALLE,
  },
  Procesado_detalle: {
    titulo: "Polarier  Control de procesado, manchas y roturas",
    instruccion: "Una fila por fecha, área, vale y prenda. Declare la cantidad que entra a esa etapa. Distribúyala entre conformes, manchas, roturas y pendientes. Las cuatro clases de manchas son excluyentes. Un paso por otra área es un nuevo registro de etapa; no se suman etapas como prendas únicas.",
    leyenda: LEYENDA_DETALLE,
  },
  Inventario: {
    titulo: "Polarier  Inventario de lencería por ubicación",
    instruccion: "Introduzca existencias por fecha y ubicación. Cada nuevo valor sustituye al anterior de ese artículo en esa ubicación. Una casilla vacía conserva el último dato; 0 confirma que no quedan piezas. La tabla al final compara la existencia actual con las prendas pactadas.",
    leyenda: LEYENDA_DETALLE,
  },
};

// -----------------------------------------------------------------------------
// Columnas
// -----------------------------------------------------------------------------
/** `calc`: azul, se calcula. `ref`: gris, referencia que no se edita. El resto, amarillo. */
export type TipoCol =
  | "fecha"
  | "hora"
  | "texto"
  | "entero"
  | "decimal"
  | "horas"
  | "lista"
  | "listaLibre"
  | "calc"
  | "ref";

export interface ColHoja {
  /** Letra real de la columna en el Excel. */
  letra: string;
  /** Título real de la cabecera: el lector exige que coincida. */
  titulo: string;
  key: string;
  tipo: TipoCol;
  ancho: number;
  opciones?: readonly string[];
  /** Alineada a la derecha. */
  der?: boolean;
  /** Decimales al pintar un cálculo. */
  dec?: number;
}

const col = (letra: string, titulo: string, key: string, tipo: TipoCol, ancho: number, extra: Partial<ColHoja> = {}): ColHoja => ({
  letra,
  titulo,
  key,
  tipo,
  ancho,
  der: tipo === "entero" || tipo === "decimal" || tipo === "horas" || tipo === "hora",
  ...extra,
});

/** Lavado_detalle, fila 10. Las prendas las pone el catálogo del hotel al pintar. */
export const COLS_LAVADO: ColHoja[] = [
  col("A", "Fecha", "fecha", "fecha", 96),
  col("B", "Turno", "turno", "listaLibre", 70, { opciones: TURNOS }),
  col("C", "Vale", "vale", "texto", 80),
  col("D", "Prenda", "prenda", "lista", 150),
  col("E", "Recibidas según DJ (pzs)", "recibidas", "entero", 84),
  col("F", "Pendiente inicial (pzs)", "pendiente_inicial", "entero", 84),
  col("G", "Lavadas (pzs)", "lavadas", "entero", 76),
  col("H", "Kg lavados", "kg", "decimal", 76),
  col("I", "Pendiente final (pzs)", "pendiente_final", "calc", 84, { der: true, dec: 0 }),
  col("J", "Operario", "operario", "texto", 120),
  col("K", "Equipo", "equipo", "texto", 100),
  col("L", "Observaciones", "observaciones", "texto", 210),
  col("M", "Revisión del registro", "revision", "calc", 110),
];

/** Procesado_detalle, fila 10. */
export const COLS_PROCESADO: ColHoja[] = [
  col("A", "Fecha", "fecha", "fecha", 96),
  col("B", "Turno", "turno", "listaLibre", 70, { opciones: TURNOS }),
  col("C", "Área", "area", "lista", 110, { opciones: AREAS }),
  col("D", "Equipo", "equipo", "texto", 100),
  col("E", "Operarios", "operarios", "texto", 130),
  col("F", "Jefe de turno", "jefe_turno", "texto", 110),
  col("G", "Vale", "vale", "texto", 80),
  col("H", "Prenda", "prenda", "lista", 150),
  col("I", "Declaradas a la etapa (pzs)", "declaradas", "entero", 86),
  col("J", "Hora inicio", "hora_inicio", "hora", 70),
  col("K", "Hora fin", "hora_fin", "hora", 70),
  col("L", "Producción conforme (pzs)", "conforme", "entero", 86),
  col("M", "Mancha rosa / amarilla", "m_rosa", "entero", 76),
  col("N", "Mancha negra", "m_negra", "entero", 66),
  col("O", "Óxido", "m_oxido", "entero", 60),
  col("P", "Otras manchas", "m_otras", "entero", 66),
  col("Q", "Roturas (pzs)", "roturas", "entero", 66),
  col("R", "Total P + M + R", "total", "calc", 70, { der: true, dec: 0 }),
  col("S", "Diferencia (+ sobra / − falta)", "diferencia", "calc", 84, { der: true, dec: 0 }),
  col("T", "Pendientes (pzs)", "pendientes", "entero", 76),
  col("U", "Duración (h)", "duracion", "calc", 66, { der: true }),
  col("V", "Observaciones", "observaciones", "texto", 190),
  col("W", "Revisión del registro", "revision", "calc", 130),
];

/** Operacion, fila 10: una fila por día. */
export const COLS_OPERACION: ColHoja[] = [
  col("A", "Fecha", "fecha", "calc", 96),
  col("B", "Turistas del día", "turistas", "entero", 90),
  col("C", "Kg lavados", "kg", "calc", 110, { der: true }),
  col("D", "Piezas recibidas", "recibidas", "calc", 110, { der: true, dec: 0 }),
  col("E", "Piezas entregadas", "entregadas", "entero", 96),
  col("F", "Horas previstas", "horas_previstas", "horas", 90),
  col("G", "Horas trabajadas", "horas_trabajadas", "horas", 90),
  col("H", "Parada única en h", "parada", "horas", 90),
  col("I", "Observación o parte", "observacion", "texto", 280),
  col("J", "Cierre de lavado", "cierre", "lista", 130, { opciones: CIERRES }),
];

export const COLS_INCIDENCIAS: ColHoja[] = [
  col("A", "Fecha", "fecha", "fecha", 96),
  col("B", "Causa", "causa", "lista", 110, { opciones: CAUSAS }),
  col("C", "Duración en h", "duracion", "horas", 80),
  col("D", "Impacto en el servicio", "impacto", "texto", 210),
  col("E", "Acción adoptada", "accion", "texto", 210),
  col("F", "Responsable", "responsable", "texto", 130),
  col("G", "Fecha de cierre", "fecha_cierre", "fecha", 96),
  col("H", "Estado", "estado", "lista", 120, { opciones: ESTADOS_INCIDENCIA }),
  col("I", "Imputable Polarier", "imputable", "lista", 110, { opciones: IMPUTABLE }),
  col("J", "Parte o acta", "parte", "texto", 110),
  col("K", "Duración informada", "informada", "calc", 90),
];

export const COLS_EQUIPOS: ColHoja[] = [
  col("A", "Equipo o grupo", "nombre", "texto", 170),
  col("B", "Cantidad total", "total", "entero", 80),
  col("C", "Operativos", "operativos", "entero", 80),
  col("D", "Fuera servicio", "fuera", "calc", 80, { der: true, dec: 0 }),
  col("E", "Estado o causa", "estado_causa", "texto", 170),
  col("F", "Intervención del mes", "intervencion", "texto", 180),
  col("G", "Pendiente y recurso", "pendiente", "texto", 170),
  col("H", "Responsable", "responsable", "texto", 120),
  col("I", "Fecha prevista", "fecha_prevista", "fecha", 96),
  col("J", "Parte técnico", "parte", "texto", 110),
];

/** Equipos, fila 37. */
export const COLS_MANTENIMIENTO: ColHoja[] = [
  col("A", "Tarea", "tarea", "texto", 170),
  col("B", "Equipo", "equipo", "texto", 120),
  col("C", "Tipo", "tipo", "lista", 110, { opciones: TIPOS_MANTENIMIENTO }),
  col("D", "Fecha planificada", "fecha_planificada", "fecha", 96),
  col("E", "Fecha ejecutada", "fecha_ejecutada", "fecha", 96),
  col("F", "Trabajo y resultado", "trabajo", "texto", 190),
  col("G", "Pendiente", "pendiente", "texto", 140),
  col("H", "Responsable", "responsable", "texto", 120),
  col("I", "Próxima fecha", "proxima", "fecha", 96),
  col("J", "Documento", "documento", "texto", 110),
];

export const COLS_RETIROS: ColHoja[] = [
  col("A", "Fecha", "fecha", "fecha", 96),
  col("B", "Concepto", "concepto", "lista", 100, { opciones: CONCEPTOS }),
  col("C", "Tipo de Prendas", "prendas", "texto", 150),
  col("D", "Cantidad prendas", "cantidad", "entero", 80),
  col("E", "Causa del hecho", "causa", "texto", 180),
  col("F", "Responsabilidad", "responsabilidad", "texto", 130),
  col("G", "Precio unitario", "precio", "decimal", 80),
  col("H", "Moneda", "moneda", "lista", 76, { opciones: MONEDAS }),
  col("I", "Importe", "importe", "calc", 90, { der: true }),
  col("J", "Conciliado", "conciliado", "lista", 80, { opciones: SI_NO }),
  col("K", "Acta o soporte", "acta", "texto", 110),
  col("L", "Facturación", "facturacion", "lista", 120, { opciones: FACTURACION }),
];

export const COLS_ACCIONES: ColHoja[] = [
  col("A", "Fecha de acuerdo", "fecha", "fecha", 96),
  col("B", "Origen o problema", "origen", "texto", 190),
  col("C", "Acción acordada", "accion", "texto", 220),
  col("D", "Responsable", "responsable", "texto", 130),
  col("E", "Fecha límite", "fecha_limite", "fecha", 96),
  col("F", "Estado", "estado", "lista", 100, { opciones: ESTADOS_ACCION }),
  col("G", "Resultado o avance", "resultado", "texto", 190),
  col("H", "Acta o evidencia", "acta", "texto", 110),
  col("I", "Situación al cierre", "situacion", "calc", 110),
];

/** KPI_calidad, fila 10, con la columna Base que recupera la plantilla corregida. */
export const COLS_KPI: ColHoja[] = [
  col("A", "Indicador", "nombre", "ref", 240),
  col("B", "Cantidad que se cumple", "cantidad", "decimal", 96),
  col("C", "Base", "base", "decimal", 80),
  col("D", "Meta SLA", "meta", "ref", 70, { der: true }),
  col("E", "Resultado", "resultado", "calc", 90, { der: true }),
  col("F", "Cumplimiento", "cumplimiento", "calc", 100),
  col("G", "Documento o registro", "documento", "texto", 190),
  col("H", "Cómo llenar los conteos", "como", "ref", 420),
];

/** KPI_calidad en un Excel antiguo: sin Base, con todo lo demás una letra antes. */
export const TITULOS_KPI_SIN_BASE = [
  "Indicador",
  "Cantidad que se cumple",
  "Meta SLA",
  "Resultado",
  "Cumplimiento",
  "Documento o registro",
  "Cómo llenar los conteos",
];

/** KPI_calidad, fila 26. */
export const COLS_ENCUESTAS: ColHoja[] = [
  col("A", "Aspecto", "aspecto", "ref", 150),
  col("B", "Puntuación media", "puntuacion", "decimal", 100),
  col("C", "Encuestas", "encuestas", "entero", 90),
  col("D", "Documento", "documento", "texto", 190),
  col("E", "Observación", "observacion", "texto", 300),
];

/** Inventario, fila 10: las columnas C a J son las ocho prendas del catálogo. */
export const LETRAS_PRENDAS = ["C", "D", "E", "F", "G", "H", "I", "J"];
export const PRENDAS_HOJA = [
  "Sábana personal",
  "Sábana king",
  "Funda de almohada",
  "Toalla de baño",
  "Toalla de mano",
  "Toalla alfombra",
  "Toalla facial",
  "Toalla de piscina",
];

/** Inventario, fila 482. */
export const COLS_PACTADAS: ColHoja[] = [
  col("A", "Artículo", "prenda", "ref", 170),
  col("B", "Prendas pactadas (pzs)", "pactadas", "ref", 86, { der: true }),
  col("C", "Primera existencia registrada", "primera", "calc", 96, { der: true, dec: 0 }),
  col("D", "Existencia actual (pzs)", "actual", "calc", 86, { der: true, dec: 0 }),
  col("E", "Variación neta (pzs)", "variacion", "calc", 80, { der: true, dec: 0 }),
  col("F", "Sobrantes (pzs)", "sobrantes", "calc", 76, { der: true, dec: 0 }),
  col("G", "Faltantes (pzs)", "faltantes", "calc", 76, { der: true, dec: 0 }),
  col("H", "Ubicaciones con dato", "ubicaciones", "calc", 86, { der: true }),
  col("I", "Primer dato", "primer", "calc", 96),
  col("J", "Último dato", "ultimo", "calc", 96),
  col("K", "Resultado", "resultado", "calc", 130),
];

// -----------------------------------------------------------------------------
// Rangos de filas del libro
// -----------------------------------------------------------------------------
export const FILAS = {
  cabecera: 10,
  operacion: { desde: 11, hasta: 41 },
  kpi: { desde: 11, hasta: 20 },
  encuestas: { cabecera: 26, lavado: 27, servicio: 28 },
  controles: { reprocesos: 30, reclamaciones: 31, danos: 32 },
  incidencias: { desde: 11, hasta: 110 },
  equipos: { desde: 11, hasta: 30 },
  mantenimiento: { cabecera: 37, desde: 38, hasta: 87 },
  retiros: { desde: 11, hasta: 110 },
  acciones: { desde: 11, hasta: 110 },
  lavado: { desde: 11, hasta: 1010 },
  procesado: { desde: 11, hasta: 1010 },
  /** 15 filas por día: 14 de conteo y la cabecera que repite la hoja. */
  inventario: { desde: 11, hasta: 475, porDia: 15, conteos: 14 },
  pactadas: { cabecera: 482, desde: 483, hasta: 490 },
} as const;

/** Fila real de un conteo en la hoja Inventario. */
export const filaInventario = (dia: number, posicion: number): number =>
  FILAS.inventario.desde + (dia - 1) * FILAS.inventario.porDia + posicion;

// -----------------------------------------------------------------------------
// Lectura de lo que se escribe: en la tabla, al pegar y en el Excel
// -----------------------------------------------------------------------------
const pad = (n: number): string => String(n).padStart(2, "0");

const fechaValida = (a: number, m: number, d: number): string | null => {
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
    ? `${a}-${pad(m)}-${pad(d)}`
    : null;
};

/** dd/mm/aaaa, como en la hoja. Sin año, el del mes abierto; también admite aaaa-mm-dd. */
export const fechaDeTexto = (texto: string, anioPorDefecto?: number): string | null => {
  const t = texto.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return fechaValida(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(t);
  if (!m) return null;
  const anio = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : anioPorDefecto;
  return anio ? fechaValida(anio, Number(m[2]), Number(m[1])) : null;
};

export const textoDeFecha = (iso: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

/** «8:10» → «08:10». */
export const horaDeTexto = (texto: string): string | null => {
  const m = /^(\d{1,2})[:.](\d{2})(?::\d{2})?$/.exec(texto.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
};

/**
 * Número tal como llega de una hoja o del teclado. La coma es decimal; un punto solo
 * es de miles si deja grupos exactos de tres («1.500»). Devuelve `undefined` si el
 * texto no es un número, para no confundirlo con una casilla vacía.
 */
export const numeroDeTexto = (texto: string, horas = false): Num | undefined => {
  const t = texto.replace(/\s/g, "");
  if (t === "") return null;
  if (horas && t.includes(":")) {
    const [h, m] = t.split(":");
    const hh = Number(h || 0);
    const mm = Number(m || 0);
    return Number.isFinite(hh) && Number.isFinite(mm) ? hh + mm / 60 : undefined;
  }
  let limpio = t;
  if (t.includes(",") && t.includes(".")) {
    limpio = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (t.includes(",")) {
    limpio = t.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    limpio = t.replace(/\./g, "");
  }
  const n = Number(limpio);
  return Number.isFinite(n) ? n : undefined;
};

/** El valor que le corresponde a una columna a partir de un texto; `undefined` si no vale. */
export const valorDeTexto = (tipo: TipoCol, texto: string, anio?: number): unknown => {
  const t = texto.trim();
  switch (tipo) {
    case "entero":
    case "decimal":
      return numeroDeTexto(t);
    case "horas":
      return numeroDeTexto(t, true);
    case "fecha":
      return t === "" ? null : (fechaDeTexto(t, anio) ?? undefined);
    case "hora":
      return t === "" ? "" : (horaDeTexto(t) ?? undefined);
    default:
      return t;
  }
};

/** Para comparar nombres del Excel y del catálogo: «Spa-1» y «spa 1» son lo mismo. */
export const normalizar = (s: unknown): string =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// -----------------------------------------------------------------------------
// Filas de la hoja <-> parte del día
// -----------------------------------------------------------------------------
export const uid = (): string => Math.random().toString(36).slice(2, 10);

export interface FilaLavadoHoja extends FilaLavado {
  id: string;
  /** Quién firma el parte del que sale. Solo se edita lo propio. */
  dueno: string | null;
}

export interface FilaProcesadoHoja extends FilaProcesado {
  id: string;
  dueno: string | null;
}

export const filasLavadoDeParte = (fecha: string, parte: ParteData, dueno: string | null): FilaLavadoHoja[] =>
  parte.lavado.flatMap((v) =>
    v.lineas.map((l) => ({
      id: l.id,
      dueno,
      fecha,
      turno: v.turno ?? "",
      vale: v.vale ?? "",
      prenda: l.prenda ?? "",
      recibidas: l.recibidas ?? null,
      pendiente_inicial: l.pendiente_inicial ?? null,
      lavadas: l.lavadas ?? null,
      kg: l.kg ?? null,
      operario: v.operario ?? "",
      equipo: v.equipo ?? "",
      observaciones: l.observaciones ?? "",
    }))
  );

export const filasProcesadoDeParte = (fecha: string, parte: ParteData, dueno: string | null): FilaProcesadoHoja[] =>
  parte.procesado.flatMap((t) =>
    t.lineas.map((l) => ({
      id: l.id,
      dueno,
      fecha,
      turno: t.turno ?? "",
      area: t.area ?? "",
      equipo: t.equipo ?? "",
      operarios: t.operarios ?? "",
      jefe_turno: t.jefe_turno ?? "",
      vale: t.vale ?? "",
      prenda: l.prenda ?? "",
      declaradas: l.declaradas ?? null,
      hora_inicio: t.hora_inicio ?? "",
      hora_fin: t.hora_fin ?? "",
      conforme: l.conforme ?? null,
      m_rosa: l.m_rosa ?? null,
      m_negra: l.m_negra ?? null,
      m_oxido: l.m_oxido ?? null,
      m_otras: l.m_otras ?? null,
      roturas: l.roturas ?? null,
      pendientes: l.pendientes ?? null,
      observaciones: l.observaciones ?? "",
    }))
  );

const CLAVES_LAVADO: (keyof FilaLavado)[] = [
  "turno", "vale", "prenda", "recibidas", "pendiente_inicial", "lavadas", "kg", "operario", "equipo", "observaciones",
];
const CLAVES_PROCESADO: (keyof FilaProcesado)[] = [
  "turno", "area", "equipo", "operarios", "jefe_turno", "vale", "prenda", "declaradas", "hora_inicio", "hora_fin",
  "conforme", "m_rosa", "m_negra", "m_oxido", "m_otras", "roturas", "pendientes", "observaciones",
];

const sinDatos = (f: object, claves: string[]): boolean =>
  claves.every((k) => {
    const v = (f as Record<string, unknown>)[k];
    return v === null || v === undefined || v === "";
  });

/** Una fila con solo la fecha no es un registro: no se guarda. */
export const filaLavadoVacia = (f: FilaLavado): boolean => sinDatos(f, CLAVES_LAVADO);
export const filaProcesadoVacia = (f: FilaProcesado): boolean => sinDatos(f, CLAVES_PROCESADO);

/**
 * Agrupa solo filas consecutivas con la misma cabecera: al aplanar salen las mismas
 * filas en el mismo orden, aunque un vale cambie de operario de una prenda a otra.
 */
export const valesDeFilas = (filas: FilaLavadoHoja[]): ValeLavado[] => {
  const vales: ValeLavado[] = [];
  for (const f of filas) {
    if (filaLavadoVacia(f)) continue;
    const ultimo = vales[vales.length - 1];
    const linea = {
      id: f.id,
      prenda: f.prenda,
      recibidas: f.recibidas,
      pendiente_inicial: f.pendiente_inicial,
      lavadas: f.lavadas,
      kg: f.kg,
      observaciones: f.observaciones,
    };
    if (ultimo && ultimo.vale === f.vale && ultimo.turno === f.turno && ultimo.operario === f.operario && ultimo.equipo === f.equipo) {
      ultimo.lineas.push(linea);
    } else {
      vales.push({ id: `v-${f.id}`, vale: f.vale, turno: f.turno, operario: f.operario, equipo: f.equipo, lineas: [linea] });
    }
  }
  return vales;
};

export const tandasDeFilas = (filas: FilaProcesadoHoja[]): TandaProcesado[] => {
  const tandas: TandaProcesado[] = [];
  for (const f of filas) {
    if (filaProcesadoVacia(f)) continue;
    const u = tandas[tandas.length - 1];
    const linea = {
      id: f.id,
      prenda: f.prenda,
      declaradas: f.declaradas,
      conforme: f.conforme,
      m_rosa: f.m_rosa,
      m_negra: f.m_negra,
      m_oxido: f.m_oxido,
      m_otras: f.m_otras,
      roturas: f.roturas,
      pendientes: f.pendientes,
      observaciones: f.observaciones,
    };
    const misma =
      u &&
      u.area === f.area &&
      u.vale === f.vale &&
      u.turno === f.turno &&
      u.equipo === f.equipo &&
      u.operarios === f.operarios &&
      u.jefe_turno === f.jefe_turno &&
      u.hora_inicio === f.hora_inicio &&
      u.hora_fin === f.hora_fin;
    if (misma) {
      u.lineas.push(linea);
    } else {
      tandas.push({
        id: `t-${f.id}`,
        area: f.area,
        vale: f.vale,
        turno: f.turno,
        equipo: f.equipo,
        operarios: f.operarios,
        jefe_turno: f.jefe_turno,
        hora_inicio: f.hora_inicio,
        hora_fin: f.hora_fin,
        lineas: [linea],
      });
    }
  }
  return tandas;
};

export const filaLavadoNueva = (id: string, fecha: string, dueno: string | null): FilaLavadoHoja => ({
  id,
  dueno,
  fecha,
  turno: "",
  vale: "",
  prenda: "",
  recibidas: null,
  pendiente_inicial: null,
  lavadas: null,
  kg: null,
  operario: "",
  equipo: "",
  observaciones: "",
});

export const filaProcesadoNueva = (id: string, fecha: string, dueno: string | null): FilaProcesadoHoja => ({
  id,
  dueno,
  fecha,
  turno: "",
  area: "",
  equipo: "",
  operarios: "",
  jefe_turno: "",
  vale: "",
  prenda: "",
  declaradas: null,
  hora_inicio: "",
  hora_fin: "",
  conforme: null,
  m_rosa: null,
  m_negra: null,
  m_oxido: null,
  m_otras: null,
  roturas: null,
  pendientes: null,
  observaciones: "",
});

/**
 * Ubicaciones fijas de la hoja Inventario, en su orden, según `config.ubicaciones_hoja`
 * de cada hotel. Las demás del catálogo van en las filas libres. Sin esa lista, todas
 * son fijas: un hotel nuevo no se queda sin poder contar nada.
 */
export const repartirUbicaciones = <T extends { nombre: string }>(
  catalogo: T[],
  nombresHoja: unknown
): { fijas: T[]; libres: T[] } => {
  if (!Array.isArray(nombresHoja) || nombresHoja.length === 0) return { fijas: catalogo, libres: [] };
  const claves = nombresHoja.map(normalizar);
  const fijas = claves.flatMap((c) => catalogo.filter((u) => normalizar(u.nombre) === c));
  return { fijas, libres: catalogo.filter((u) => !fijas.includes(u)) };
};
