// -----------------------------------------------------------------------------
// Formulario unificado de control (Excel «Modelo Mensual»): tipos y fórmulas.
//
// Cada función replica una fórmula de la hoja y lleva la celda en su comentario.
// Son lógica pura: el parte, el cierre, el dashboard y los informes solo leen de
// aquí, igual que `informe.ts` con los informes de antes.
//
// La regla que atraviesa todo el Excel: **vacío no es 0**. Un dato sin rellenar
// es `null` y el indicador dice «Completar»; 0 significa que se comprobó que no
// hubo cantidad. Por eso nada aquí usa `|| 0` sobre un dato de entrada.
//
// Lo único que se aparta de la hoja es `KPI_calidad`, que venía rota (ver
// `resultadoKpi`). `src/test/control.excel.test.ts` contrasta el resto con los
// valores que calculan las fórmulas reales del libro.
// -----------------------------------------------------------------------------

/** Dato numérico que se rellena a mano. `null` = vacío, distinto de 0. */
export type Num = number | null;

export const COMPLETAR = "Completar";
/** Un indicador del mes: la cifra, o el aviso de que falta dato. */
export type Indicador = number | "Completar" | "Revisar";

// -----------------------------------------------------------------------------
// Listas de las validaciones de datos del Excel
// -----------------------------------------------------------------------------
export const AREAS = ["Secado", "Planchado", "Doblado", "Control final"] as const;
export const TURNOS = ["Día", "Noche"] as const;
export const CIERRES = ["Pendiente", "Cerrado", "Sin actividad"] as const;
export const REVISIONES = ["Pendiente", "Validado", "Sin actividad"] as const;
export const CAUSAS = [
  "Agua", "Electricidad", "Vapor", "Gas", "Avería", "Personal", "Lencería", "Calidad", "Otras",
] as const;
export const ESTADOS_INCIDENCIA = ["Abierta", "En seguimiento", "Cerrada"] as const;
export const IMPUTABLE = ["Sí", "No", "Por confirmar"] as const;
export const CONCEPTOS = ["Retiro", "Faltante", "Mal uso", "Otro ajuste"] as const;
export const MONEDAS = ["CUP", "USD", "EUR"] as const;
export const SI_NO = ["Sí", "No"] as const;
export const FACTURACION = ["Pendiente", "Facturado", "Regularizado", "No procede"] as const;
export const TIPOS_MANTENIMIENTO = ["Preventivo", "Correctivo"] as const;
export const ESTADOS_ACCION = ["Pendiente", "En curso", "Cerrada"] as const;

export type Area = (typeof AREAS)[number];
export type Cierre = (typeof CIERRES)[number];
export type Revision = (typeof REVISIONES)[number];

// -----------------------------------------------------------------------------
// Utilidades que imitan a las funciones de Excel
// -----------------------------------------------------------------------------
const esNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/** COUNT(): cuántos de los argumentos son números. */
const contar = (...vs: unknown[]): number => vs.filter(esNum).length;
const vacio = (v: unknown): boolean => v === null || v === undefined || v === "";
const sumar = (vs: unknown[]): number => vs.filter(esNum).reduce((a, b) => a + b, 0);

export const pad2 = (n: number): string => String(n).padStart(2, "0");
/**
 * Hoy en la hora del usuario. `toISOString` da la fecha UTC: en Cuba, a partir de
 * las 8 de la tarde ya sería mañana y el parte caería en el día equivocado.
 */
export const hoyLocal = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
/** Datos_mes!B11: EOMONTH. */
export const diasDelMes = (anio: number, mes: number): number => new Date(anio, mes, 0).getDate();

export interface RangoMes {
  /** Datos_mes!B10 */
  primerDia: string;
  /** Datos_mes!B11 */
  ultimoDia: string;
  dias: number;
}

export const rangoMes = (anio: number, mes: number): RangoMes => {
  const dias = diasDelMes(anio, mes);
  const prefijo = `${anio}-${pad2(mes)}`;
  return { primerDia: `${prefijo}-01`, ultimoDia: `${prefijo}-${pad2(dias)}`, dias };
};

const enMes = (fecha: string | null | undefined, r: RangoMes): boolean =>
  !!fecha && fecha >= r.primerDia && fecha <= r.ultimoDia;

// -----------------------------------------------------------------------------
// Lavado_detalle
// -----------------------------------------------------------------------------
export interface FilaLavado {
  fecha: string | null;
  turno: string;
  vale: string;
  prenda: string;
  /** E: recibidas según DJ */
  recibidas: Num;
  /** F */
  pendiente_inicial: Num;
  /** G */
  lavadas: Num;
  /** H: peso real procesado, nunca estimado con pesos por prenda */
  kg: Num;
  operario: string;
  equipo: string;
  observaciones: string;
}

export type RevisionFila = "" | "Completar" | "Revisar" | "Completo";

/** Lavado_detalle!I11 = IF(COUNT(E:G)<3,"",E+F-G) */
export const pendienteFinal = (f: Pick<FilaLavado, "recibidas" | "pendiente_inicial" | "lavadas">): Num =>
  contar(f.recibidas, f.pendiente_inicial, f.lavadas) < 3
    ? null
    : f.recibidas + f.pendiente_inicial - f.lavadas;

/** Lavado_detalle!M11 */
export const revisionLavado = (f: FilaLavado, r: RangoMes): RevisionFila => {
  const { fecha, turno, vale, prenda, recibidas, pendiente_inicial, lavadas, kg } = f;
  if (
    [fecha, turno, vale, prenda, recibidas, pendiente_inicial, lavadas, kg, f.operario, f.equipo, f.observaciones].every(
      vacio
    )
  ) {
    return "";
  }
  if (
    vacio(fecha) ||
    vacio(turno) ||
    vacio(vale) ||
    vacio(prenda) ||
    contar(recibidas, pendiente_inicial, lavadas, kg) < 4
  ) {
    return "Completar";
  }
  if (
    !enMes(fecha, r) ||
    Math.min(recibidas, pendiente_inicial, lavadas, kg) < 0 ||
    pendienteFinal(f) < 0 ||
    (lavadas === 0 && kg !== 0) ||
    (lavadas > 0 && kg === 0)
  ) {
    return "Revisar";
  }
  return "Completo";
};

export interface TotalesLavado {
  /** Lavado_detalle!B7 */
  piezas: number | "Completar";
  /** Lavado_detalle!E7 */
  kg: number | "Completar";
  /** Lavado_detalle!H7: registros en «Completar» o «Revisar» */
  pendientes: number;
  completos: number;
}

export const totalesLavado = (filas: FilaLavado[], r: RangoMes): TotalesLavado => {
  const revs = filas.map((f) => revisionLavado(f, r));
  const completas = filas.filter((_, i) => revs[i] === "Completo");
  return {
    piezas: completas.length === 0 ? COMPLETAR : sumar(completas.map((f) => f.lavadas)),
    kg: completas.length === 0 ? COMPLETAR : sumar(completas.map((f) => f.kg)),
    pendientes: revs.filter((x) => x === "Completar" || x === "Revisar").length,
    completos: completas.length,
  };
};

// -----------------------------------------------------------------------------
// Procesado_detalle
// -----------------------------------------------------------------------------
export interface FilaProcesado {
  fecha: string | null;
  turno: string;
  area: string;
  equipo: string;
  operarios: string;
  jefe_turno: string;
  vale: string;
  prenda: string;
  /** I */
  declaradas: Num;
  /** J, K: «HH:MM» */
  hora_inicio: string;
  hora_fin: string;
  /** L */
  conforme: Num;
  /** M, N, O, P: excluyentes */
  m_rosa: Num;
  m_negra: Num;
  m_oxido: Num;
  m_otras: Num;
  /** Q */
  roturas: Num;
  /** T */
  pendientes: Num;
  observaciones: string;
}

export type RevisionProcesado = RevisionFila | "Revisar diferencia";

type Cantidades = Pick<
  FilaProcesado,
  "declaradas" | "conforme" | "m_rosa" | "m_negra" | "m_oxido" | "m_otras" | "roturas" | "pendientes"
>;

/** Procesado_detalle!R11 = IF(COUNT(L:Q)<6,"",SUM(L:Q)) */
export const totalPMR = (f: Cantidades): Num => {
  const vs = [f.conforme, f.m_rosa, f.m_negra, f.m_oxido, f.m_otras, f.roturas];
  return contar(...vs) < 6 ? null : sumar(vs);
};

/** Procesado_detalle!S11 = IF(COUNT(I,R,T)<3,"",R+T-I). Positivo sobra, negativo falta. */
export const diferenciaProcesado = (f: Cantidades): Num => {
  const r = totalPMR(f);
  return contar(f.declaradas, r, f.pendientes) < 3 ? null : r + f.pendientes - f.declaradas;
};

const horaAFraccion = (h: string | null | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((h ?? "").trim());
  if (!m) return null;
  return (Number(m[1]) * 60 + Number(m[2])) / (24 * 60);
};

/** Procesado_detalle!U11 = IF(COUNT(J:K)<2,"",MOD(K-J,1)*24). Admite cruzar medianoche. */
export const duracionHoras = (inicio: string, fin: string): Num => {
  const a = horaAFraccion(inicio);
  const b = horaAFraccion(fin);
  if (a === null || b === null) return null;
  const d = b - a;
  return (d - Math.floor(d)) * 24;
};

/** Procesado_detalle!W11 */
export const revisionProcesado = (f: FilaProcesado, r: RangoMes): RevisionProcesado => {
  const { fecha, turno, area, vale, prenda, declaradas, conforme, m_rosa, m_negra, m_oxido, m_otras, roturas, pendientes } = f;
  const cantidades = [declaradas, conforme, m_rosa, m_negra, m_oxido, m_otras, roturas, pendientes];
  if (
    [
      fecha, turno, area, f.equipo, f.operarios, f.jefe_turno, vale, prenda, f.hora_inicio, f.hora_fin,
      f.observaciones, ...cantidades,
    ].every(vacio)
  ) {
    return "";
  }
  if (vacio(fecha) || vacio(turno) || vacio(area) || vacio(vale) || vacio(prenda) || contar(...cantidades) < 8) {
    return "Completar";
  }
  if (!enMes(fecha, r) || Math.min(...cantidades) < 0) return "Revisar";
  return diferenciaProcesado(f) !== 0 ? "Revisar diferencia" : "Completo";
};

const POR_REVISAR: RevisionProcesado[] = ["Completar", "Revisar", "Revisar diferencia"];

export interface ResumenArea {
  area: string;
  /** Resumen!B87: conformes de los registros completos */
  conformes: number | "Completar";
  /** Resumen!C87: las cuatro manchas de los registros completos */
  manchas: number | "Completar";
  /** Resumen!D87 */
  roturas: number | "Completar";
  /** Resumen!B97 */
  completos: number;
  /** Resumen!C97 */
  porRevisar: number;
  /** Resumen!D97 */
  estado: "Sin registros" | "Revisar" | "Registros completos";
  /** Declaradas de los registros completos: base que propone el KPI de calidad. */
  declaradas: number;
}

export const resumenAreas = (filas: FilaProcesado[], r: RangoMes): ResumenArea[] =>
  AREAS.map((area) => {
    const delArea = filas.filter((f) => f.area === area);
    const revs = delArea.map((f) => revisionProcesado(f, r));
    const completas = delArea.filter((_, i) => revs[i] === "Completo");
    const completos = completas.length;
    const porRevisar = revs.filter((x) => POR_REVISAR.includes(x)).length;
    const hay = delArea.length > 0;
    return {
      area,
      conformes: hay ? sumar(completas.map((f) => f.conforme)) : COMPLETAR,
      manchas: hay
        ? sumar(completas.flatMap((f) => [f.m_rosa, f.m_negra, f.m_oxido, f.m_otras]))
        : COMPLETAR,
      roturas: hay ? sumar(completas.map((f) => f.roturas)) : COMPLETAR,
      completos,
      porRevisar,
      estado: completos + porRevisar === 0 ? "Sin registros" : porRevisar > 0 ? "Revisar" : "Registros completos",
      declaradas: sumar(completas.map((f) => f.declaradas)),
    } as ResumenArea;
  });

// -----------------------------------------------------------------------------
// Operacion: una fila por día
// -----------------------------------------------------------------------------
export interface Jornada {
  /** B */
  turistas: Num;
  /** E */
  entregadas: Num;
  /** F */
  horas_previstas: Num;
  /** G */
  horas_trabajadas: Num;
  /** H: «no sumar paradas simultáneas» */
  parada: Num;
  /** I */
  observacion: string;
  /** J */
  cierre: Cierre;
}

export type CeldaDetalle = number | "" | "Revisar detalle" | "Completar detalle";

/**
 * Operacion!C11 (kg) y D11 (piezas recibidas): solo cuentan si el día está
 * cerrado y todos sus registros de lavado están completos.
 */
export const celdaDetalle = (
  cierre: Cierre | null | undefined,
  filasDelDia: FilaLavado[],
  r: RangoMes,
  campo: "kg" | "recibidas"
): CeldaDetalle => {
  const n = filasDelDia.length;
  if (cierre === "Sin actividad") return n > 0 ? "Revisar detalle" : 0;
  if (cierre !== "Cerrado") return "";
  if (n === 0) return "Completar detalle";
  const completas = filasDelDia.filter((f) => revisionLavado(f, r) === "Completo").length;
  if (completas !== n) return "Revisar detalle";
  return sumar(filasDelDia.map((f) => f[campo]));
};

export interface FilaOperacion {
  fecha: string;
  turistas: Num;
  kg: CeldaDetalle;
  recibidas: CeldaDetalle;
  entregadas: Num;
  horas_previstas: Num;
  horas_trabajadas: Num;
  parada: Num;
  observacion: string;
  cierre: Cierre | null;
}

type ColumnaOperacion =
  | "turistas" | "kg" | "recibidas" | "entregadas" | "horas_previstas" | "horas_trabajadas" | "parada";

export const COLUMNAS_OPERACION: ColumnaOperacion[] = [
  "turistas", "kg", "recibidas", "entregadas", "horas_previstas", "horas_trabajadas", "parada",
];

export interface TotalesOperacion {
  /** Fila 45 */
  total: Record<ColumnaOperacion, number | "Completar">;
  /** Fila 46 */
  diasConDato: Record<ColumnaOperacion, number>;
  /** Fila 47 */
  diasPorCompletar: Record<ColumnaOperacion, number>;
  /** Operacion!B49 */
  kgPorTurista: number | "Completar" | "No aplica";
  /** Resumen!B20 */
  balance: number | "Completar";
}

/** Operacion, filas 45 a 49, y Resumen!B20. */
export const totalesOperacion = (
  filas: FilaOperacion[],
  dias: number,
  revision: Revision
): TotalesOperacion => {
  const total = {} as TotalesOperacion["total"];
  const diasConDato = {} as TotalesOperacion["diasConDato"];
  const diasPorCompletar = {} as TotalesOperacion["diasPorCompletar"];
  for (const c of COLUMNAS_OPERACION) {
    const vals = filas.map((f) => f[c]).filter((v): v is number => esNum(v) && v >= 0);
    diasConDato[c] = vals.length;
    diasPorCompletar[c] = dias - vals.length;
    total[c] = vals.length === 0 ? (revision === "Sin actividad" ? 0 : COMPLETAR) : sumar(vals);
  }
  const faltanTD = diasPorCompletar.turistas > 0 || diasPorCompletar.kg > 0;
  const kgPorTurista = faltanTD
    ? COMPLETAR
    : total.turistas === 0
      ? "No aplica"
      : (total.kg as number) / (total.turistas as number);
  const balance =
    diasPorCompletar.recibidas > 0 || diasPorCompletar.entregadas > 0
      ? COMPLETAR
      : (total.entregadas as number) - (total.recibidas as number);
  return { total, diasConDato, diasPorCompletar, kgPorTurista, balance };
};

// -----------------------------------------------------------------------------
// KPI_calidad
// -----------------------------------------------------------------------------
export interface DefinicionKpi {
  key: string;
  nombre: string;
  /** Meta del SLA, en tanto por uno (C11:C20). `null` si el hotel no la tiene cargada. */
  meta: number | null;
  /** Texto de «Cómo llenar los conteos» (G11:G20), partido en sus dos conteos. */
  cantidad: string;
  base: string;
}

/**
 * Los diez indicadores del SLA. Las metas son del contrato de cada hotel y el
 * repositorio es público, así que aquí no hay ninguna: viven en
 * `form_definitions.config.metas` ({ [key]: tanto por uno }) y las pone `kpisDe`.
 */
export const KPIS_SLA: DefinicionKpi[] = [
  { key: "ciclo", nombre: "Tiempo de ciclo del servicio", meta: null, cantidad: "Ciclos dentro del plazo del SLA, o del ampliado solo con contingencia documentada", base: "Ciclos evaluados del mes" },
  { key: "disponibilidad_lenceria", nombre: "Disponibilidad de lencería", meta: null, cantidad: "Controles diarios con cobertura de las montas y servicios acordados", base: "Controles diarios evaluables. Documentar faltantes y exclusiones" },
  { key: "continuidad", nombre: "Continuidad operativa", meta: null, cantidad: "Días evaluables sin interrupción imputable a Polarier", base: "Días evaluables. Documentar y conciliar las causas externas antes de excluirlas" },
  { key: "calidad", nombre: "Calidad del procesado", meta: null, cantidad: "Piezas conformes en el control", base: "Piezas inspeccionadas, con igual alcance. No usar la encuesta como sustituto" },
  { key: "programacion", nombre: "Cumplimiento de programación", meta: null, cantidad: "Recogidas y entregas en el horario acordado", base: "Recogidas y entregas programadas evaluables" },
  { key: "disponibilidad_equipos", nombre: "Disponibilidad técnica de equipos", meta: null, cantidad: "Horas-equipo disponibles", base: "Horas-equipo requeridas evaluables. Misma base y equipos. Excluir solo causas ajenas documentadas" },
  { key: "preventivo", nombre: "Mantenimiento preventivo", meta: null, cantidad: "Tareas preventivas ejecutadas de las previstas para el mes", base: "Tareas preventivas previstas para el mes" },
  { key: "inventarios", nombre: "Control de inventarios", meta: null, cantidad: "Inventarios y conciliaciones realizados con registro", base: "Controles previstos para el mes" },
  { key: "incidencias", nombre: "Gestión de incidencias", meta: null, cantidad: "Casos que cumplen registro, análisis, seguimiento y cierre según el criterio acordado", base: "Casos evaluables del mes" },
  { key: "informes", nombre: "Emisión de informes de gestión", meta: null, cantidad: "Informes entregados conforme al plazo acordado", base: "Informes que debían entregarse en el mes" },
];

export type ResultadoKpi = number | "Completar" | "Revisar" | "No aplica";
export type CumplimientoKpi = "Cumple" | "No cumple" | "Completar" | "Revisar" | "No aplica";

/**
 * KPI_calidad!D11, restaurando la base que el libro perdió.
 *
 * La hoja trae `IF(COUNT(B11:B11)<2,"Completar",IF(OR(B11<0,#REF!<0,B11>#REF!),
 * "Revisar",IF(#REF!=0,"No aplica",B11/#REF!)))`: se borró la columna de la base
 * y `#REF!` es donde estaba. Así que siempre decía «Completar». Decisión de Leo
 * (2026-11-02): recuperar la base, que es lo que describen las instrucciones de
 * la propia hoja («favorables ÷ base»).
 */
export const resultadoKpi = (cantidad: Num, base: Num): ResultadoKpi => {
  if (contar(cantidad, base) < 2) return COMPLETAR;
  if (cantidad < 0 || base < 0 || cantidad > base) return "Revisar";
  if (base === 0) return "No aplica";
  return cantidad / base;
};

/**
 * Cumplimiento frente a la meta. `Resumen!B37` y `D37` cuentan estos textos, que
 * la hoja dejó de producir al cambiar la columna por `B*100/C` (por eso daban 0).
 */
export const cumplimientoKpi = (resultado: ResultadoKpi, meta: number | null): CumplimientoKpi => {
  if (typeof resultado !== "number") return resultado;
  if (meta === null) return COMPLETAR;
  return resultado >= meta ? "Cumple" : "No cumple";
};

// -----------------------------------------------------------------------------
// Incidencias
// -----------------------------------------------------------------------------
export interface Incidencia {
  fecha: string | null;
  causa: string;
  duracion: Num;
  impacto: string;
  accion: string;
  responsable: string;
  fecha_cierre: string | null;
  estado: string;
  imputable: string;
  parte: string;
}

/** Incidencias!K11 */
export const duracionInformada = (i: Pick<Incidencia, "fecha" | "duracion">): "" | "Sí" | "No" =>
  vacio(i.fecha) ? "" : esNum(i.duracion) ? "Sí" : "No";

export interface TotalesIncidencias {
  /** B113 */
  registradas: number | "Completar";
  /** B114 */
  cerradas: number | "Completar";
  /** B115 */
  horasAgua: number | "Completar";
  /** B116 */
  horasElectricidad: number | "Completar";
}

export const totalesIncidencias = (
  items: Incidencia[],
  r: RangoMes,
  revision: Revision
): TotalesIncidencias => {
  const sinDatos = revision === "Sin actividad" ? 0 : COMPLETAR;
  const delMes = items.filter((i) => enMes(i.fecha, r));
  const conFecha = items.filter((i) => !vacio(i.fecha));
  const registradas = conFecha.length === 0 ? sinDatos : delMes.length;
  const horasPor = (causa: string) => {
    const de = delMes.filter((i) => i.causa === causa);
    return de.filter((i) => duracionInformada(i) === "Sí").length === 0
      ? sinDatos
      : sumar(de.map((i) => i.duracion));
  };
  return {
    registradas,
    cerradas:
      typeof registradas === "number" ? delMes.filter((i) => i.estado === "Cerrada").length : COMPLETAR,
    horasAgua: horasPor("Agua"),
    horasElectricidad: horasPor("Electricidad"),
  };
};

// -----------------------------------------------------------------------------
// Equipos: estado al cierre y mantenimiento
// -----------------------------------------------------------------------------
export interface FilaEquipo {
  id: string;
  nombre: string;
  total: Num;
  operativos: Num;
  estado_causa: string;
  intervencion: string;
  pendiente: string;
  responsable: string;
  fecha_prevista: string | null;
  parte: string;
}

export interface Mantenimiento {
  tarea: string;
  equipo: string;
  tipo: string;
  fecha_planificada: string | null;
  fecha_ejecutada: string | null;
  trabajo: string;
  pendiente: string;
  responsable: string;
  proxima: string | null;
  documento: string;
}

/** Equipos!D11 */
export const fueraDeServicio = (e: Pick<FilaEquipo, "total" | "operativos">): number | "" | "Revisar" => {
  if (contar(e.total, e.operativos) < 2) return "";
  return e.operativos > e.total ? "Revisar" : e.total - e.operativos;
};

export interface TotalesEquipos {
  /** B33 */
  total: number | "Completar";
  /** D33 */
  operativos: number | "Completar";
  /** F33 */
  fueraServicio: Indicador;
  /** B89 */
  preventivosPrevistos: number | "Completar";
  /** D89 */
  preventivosEjecutados: number | "Completar";
}

export const totalesEquipos = (
  equipos: Pick<FilaEquipo, "total" | "operativos">[],
  mant: Mantenimiento[],
  r: RangoMes,
  revision: Revision
): TotalesEquipos => {
  const sinDatos = revision === "Sin actividad" ? 0 : COMPLETAR;
  const totales = equipos.map((e) => e.total).filter(esNum);
  const operativos = equipos.map((e) => e.operativos).filter(esNum);
  const total = totales.length === 0 ? sinDatos : sumar(totales);
  const oper = operativos.length === 0 ? sinDatos : sumar(operativos);
  const planificadas = mant.filter((m) => !vacio(m.fecha_planificada));
  const preventivos = mant.filter((m) => enMes(m.fecha_planificada, r) && m.tipo === "Preventivo");
  const previstos = planificadas.length === 0 ? sinDatos : preventivos.length;
  return {
    total,
    operativos: oper,
    fueraServicio: equipos.some((e) => fueraDeServicio(e) === "Revisar")
      ? "Revisar"
      : typeof total === "number" && typeof oper === "number"
        ? total - oper
        : COMPLETAR,
    preventivosPrevistos: previstos,
    preventivosEjecutados:
      typeof previstos === "number"
        ? preventivos.filter((m) => !vacio(m.fecha_ejecutada) && m.fecha_ejecutada <= r.ultimoDia).length
        : COMPLETAR,
  };
};

// -----------------------------------------------------------------------------
// Retiros_importes
// -----------------------------------------------------------------------------
export interface Retiro {
  fecha: string | null;
  concepto: string;
  prendas: string;
  cantidad: Num;
  causa: string;
  responsabilidad: string;
  precio: Num;
  moneda: string;
  conciliado: string;
  acta: string;
  facturacion: string;
}

/** Retiros_importes!I11 = IF(COUNT(D,G)<2,"",D*G) */
export const importeRetiro = (x: Pick<Retiro, "cantidad" | "precio">): Num =>
  contar(x.cantidad, x.precio) < 2 ? null : x.cantidad * x.precio;

export interface FilaConciliacion {
  clave: string;
  calculado: number | "Completar";
  conciliado: number | "Completar";
  sinConciliar: number | "Completar";
}

const filaConciliacion = (
  clave: string,
  hayBase: boolean,
  sinDatos: number | "Completar",
  items: Retiro[],
  valor: (x: Retiro) => unknown
): FilaConciliacion => {
  const calculado = !hayBase ? sinDatos : sumar(items.map(valor));
  const conciliado =
    typeof calculado === "number"
      ? sumar(items.filter((x) => x.conciliado === "Sí" && !vacio(x.acta)).map(valor))
      : COMPLETAR;
  return {
    clave,
    calculado,
    conciliado,
    sinConciliar:
      typeof calculado === "number" && typeof conciliado === "number" ? calculado - conciliado : COMPLETAR,
  };
};

export interface TotalesRetiros {
  /** Filas 114 a 116: las monedas nunca se suman entre sí */
  porMoneda: FilaConciliacion[];
  /** Filas 123 a 125: «Otro ajuste» no sale en el resumen de la hoja */
  porConcepto: FilaConciliacion[];
}

export const totalesRetiros = (items: Retiro[], r: RangoMes, revision: Revision): TotalesRetiros => {
  const sinDatos = revision === "Sin actividad" ? 0 : COMPLETAR;
  const delMes = items.filter((x) => enMes(x.fecha, r));
  const hayImportes = items.some((x) => esNum(importeRetiro(x)));
  const hayCantidades = items.some((x) => esNum(x.cantidad));
  return {
    porMoneda: MONEDAS.map((m) =>
      filaConciliacion(m, hayImportes, sinDatos, delMes.filter((x) => x.moneda === m), importeRetiro)
    ),
    porConcepto: (["Retiro", "Faltante", "Mal uso"] as const).map((c) =>
      filaConciliacion(c, hayCantidades, sinDatos, delMes.filter((x) => x.concepto === c), (x) => x.cantidad)
    ),
  };
};

// -----------------------------------------------------------------------------
// Acciones
// -----------------------------------------------------------------------------
export interface Accion {
  fecha: string | null;
  origen: string;
  accion: string;
  responsable: string;
  fecha_limite: string | null;
  estado: string;
  resultado: string;
  acta: string;
}

export type SituacionAccion = "" | "Cerrada" | "Vencida" | "En plazo" | "Completar plazo";

/** Acciones!I11: la situación se refiere al cierre del mes, no a la fecha de hoy. */
export const situacionAccion = (a: Accion, r: RangoMes): SituacionAccion => {
  if (vacio(a.accion)) return "";
  if (a.estado === "Cerrada") return "Cerrada";
  if (vacio(a.fecha_limite)) return "Completar plazo";
  return a.fecha_limite < r.ultimoDia ? "Vencida" : "En plazo";
};

export interface TotalesAcciones {
  /** B113 */
  delMes: number | "Completar";
  /** B114 */
  cerradas: number | "Completar";
  /** B115 */
  vencidas: number | "Completar";
}

export const totalesAcciones = (items: Accion[], r: RangoMes, revision: Revision): TotalesAcciones => {
  const conFecha = items.filter((a) => !vacio(a.fecha));
  const delMes = items.filter((a) => enMes(a.fecha, r));
  const n = conFecha.length === 0 ? (revision === "Sin actividad" ? 0 : COMPLETAR) : delMes.length;
  const hay = typeof n === "number";
  return {
    delMes: n,
    cerradas: hay ? delMes.filter((a) => a.estado === "Cerrada").length : COMPLETAR,
    vencidas: hay ? delMes.filter((a) => situacionAccion(a, r) === "Vencida").length : COMPLETAR,
  };
};

// -----------------------------------------------------------------------------
// Inventario
// -----------------------------------------------------------------------------
/** Una fila de la hoja: los conteos de una ubicación en una fecha. */
export interface ConteoUbicacion {
  fecha: string;
  ubicacion: string;
  /** Vacío = sin conteo nuevo (conserva el anterior). 0 = se comprobó que no hay. */
  valores: Record<string, Num>;
  observacion?: string;
}

export type RevisionConteo = "" | "Sin conteo" | "Parcial" | "Completo" | "Revisar" | "Revisar duplicado";

/** Inventario!K11 */
export const totalConteo = (c: Pick<ConteoUbicacion, "valores">, prendas: string[]): Num => {
  const vs = prendas.map((p) => c.valores[p]);
  return contar(...vs) === 0 ? null : sumar(vs);
};

/** Inventario!M11. `duplicada`: hay otra fila con la misma fecha y ubicación. */
export const revisionConteo = (
  c: Pick<ConteoUbicacion, "valores">,
  prendas: string[],
  duplicada = false
): RevisionConteo => {
  if (duplicada) return "Revisar duplicado";
  const vs = prendas.map((p) => c.valores[p]).filter(esNum);
  if (vs.length === 0) return "Sin conteo";
  if (Math.min(...vs) < 0) return "Revisar";
  return vs.length < prendas.length ? "Parcial" : "Completo";
};

export type ResultadoArticulo =
  | "Revisar duplicados"
  | "Revisar cantidades"
  | "Sin datos"
  | "Conteo parcial"
  | "Completar pactadas"
  | "Revisar pactadas"
  | "Faltante"
  | "Sobrante"
  | "Conforme";

export interface ArticuloInventario {
  /** A483 */
  prenda: string;
  /** B483 */
  pactadas: Num;
  /** C483 */
  primera: Num;
  /** D483 */
  actual: Num;
  /** E483 */
  variacion: Num;
  /** F483 */
  sobrantes: Num;
  /** G483 */
  faltantes: Num;
  /** H483: «n de m» */
  ubicacionesConDato: number;
  ubicacionesTotal: number;
  /** I483 */
  primerDato: string | null;
  /** J483 */
  ultimoDato: string | null;
  /** K483 */
  resultado: ResultadoArticulo;
}

export interface ResumenInventario {
  articulos: ArticuloInventario[];
  /** H7 */
  estado: "Sin datos" | "Completar / revisar" | "Actualizado";
  /** B7 */
  ultimoDato: string | null;
  /** E7 */
  ubicaciones: number;
  /** Resumen!B50 */
  existencia: number | "Completar";
  /** Resumen!B51 */
  pactadas: number | "Completar";
  /** Resumen!B52 */
  faltantes: number | "Completar";
  /** Resumen!B53 */
  sobrantes: number | "Completar";
  /** Último conteo por ubicación y prenda: los de gris del parte. */
  ultimoPorUbicacion: Record<string, Record<string, number>>;
}

/**
 * Inventario, filas 483 a 490, H7 y Resumen!B50:B53.
 *
 * Las existencias de días distintos no se suman: por ubicación y artículo manda
 * el último conteo válido, y una casilla vacía conserva el anterior.
 *
 * `ubicaciones` son todas las que se esperan (E7 cuenta las de la hoja tengan o
 * no dato): sin un dato de cada una, el artículo se queda en «Conteo parcial».
 */
export const resumenInventario = (
  conteos: ConteoUbicacion[],
  prendas: string[],
  ubicaciones: string[],
  pactadas: Record<string, Num>
): ResumenInventario => {
  const repeticiones = new Map<string, number>();
  for (const c of conteos) {
    const k = `${c.fecha}|${c.ubicacion}`;
    repeticiones.set(k, (repeticiones.get(k) ?? 0) + 1);
  }
  const duplicada = (c: ConteoUbicacion) => (repeticiones.get(`${c.fecha}|${c.ubicacion}`) ?? 0) > 1;
  const validos = conteos.filter((c) => !vacio(c.fecha) && !vacio(c.ubicacion));
  const universo = Array.from(new Set([...ubicaciones, ...validos.map((c) => c.ubicacion)]));
  const totalUbic = universo.length;

  const ultimoPorUbicacion: Record<string, Record<string, number>> = {};

  const articulos: ArticuloInventario[] = prendas.map((prenda) => {
    const pact = pactadas[prenda] ?? null;
    const negativos = validos.some((c) => esNum(c.valores[prenda]) && c.valores[prenda] < 0);
    const conDato = validos.filter((c) => esNum(c.valores[prenda]) && c.valores[prenda] >= 0);

    let primeraSum = 0;
    let actualSum = 0;
    let ubicConDato = 0;
    let hayDuplicadoUltimo = false;
    let hayDuplicadoPrimero = false;
    let hayPrimera = false;

    for (const u of universo) {
      const deU = conDato.filter((c) => c.ubicacion === u);
      if (deU.length === 0) continue;
      const fechas = deU.map((c) => c.fecha).sort();
      const ultimas = deU.filter((c) => c.fecha === fechas[fechas.length - 1]);
      const primeras = deU.filter((c) => c.fecha === fechas[0]);
      if (ultimas.some(duplicada)) {
        hayDuplicadoUltimo = true;
      } else {
        actualSum += ultimas[0].valores[prenda];
        ubicConDato += 1;
        (ultimoPorUbicacion[u] ??= {})[prenda] = ultimas[0].valores[prenda];
      }
      if (primeras.some(duplicada)) {
        hayDuplicadoPrimero = true;
      } else {
        primeraSum += primeras[0].valores[prenda];
        hayPrimera = true;
      }
    }

    const primera = !hayPrimera || hayDuplicadoPrimero ? null : primeraSum;
    const actual = ubicConDato === 0 || hayDuplicadoUltimo ? null : actualSum;
    const calculable = contar(pact, actual) === 2 && ubicConDato >= totalUbic && !negativos;

    const fechas = conDato.map((c) => c.fecha).sort();

    let resultado: ResultadoArticulo;
    if (hayDuplicadoUltimo) resultado = "Revisar duplicados";
    else if (negativos) resultado = "Revisar cantidades";
    else if (ubicConDato === 0) resultado = "Sin datos";
    else if (ubicConDato < totalUbic) resultado = "Conteo parcial";
    else if (!esNum(pact)) resultado = "Completar pactadas";
    else if (pact < 0 || Math.floor(pact) !== pact) resultado = "Revisar pactadas";
    else if (actual < pact) resultado = "Faltante";
    else if (actual > pact) resultado = "Sobrante";
    else resultado = "Conforme";

    return {
      prenda,
      pactadas: pact,
      primera,
      actual,
      variacion: contar(primera, actual) === 2 ? actual - primera : null,
      sobrantes: calculable ? Math.max(actual - pact, 0) : null,
      faltantes: calculable ? Math.max(pact - actual, 0) : null,
      ubicacionesConDato: ubicConDato,
      ubicacionesTotal: totalUbic,
      primerDato: fechas[0] ?? null,
      ultimoDato: fechas[fechas.length - 1] ?? null,
      resultado,
    };
  });

  const PENDIENTES: ResultadoArticulo[] = [
    "Sin datos", "Conteo parcial", "Revisar duplicados", "Revisar cantidades", "Completar pactadas", "Revisar pactadas",
  ];
  const estado: ResumenInventario["estado"] = articulos.every((a) => a.actual === null)
    ? "Sin datos"
    : articulos.some((a) => PENDIENTES.includes(a.resultado))
      ? "Completar / revisar"
      : "Actualizado";

  // Resumen!B50:B53: si falta el dato de un solo artículo, «Completar».
  const sumaSiTodos = (campo: "actual" | "pactadas" | "faltantes" | "sobrantes"): number | "Completar" =>
    articulos.every((a) => esNum(a[campo])) ? sumar(articulos.map((a) => a[campo])) : COMPLETAR;

  const todasLasFechas = articulos.map((a) => a.ultimoDato).filter(Boolean).sort() as string[];

  return {
    articulos,
    estado,
    ultimoDato: todasLasFechas[todasLasFechas.length - 1] ?? null,
    ubicaciones: totalUbic,
    existencia: sumaSiTodos("actual"),
    pactadas: sumaSiTodos("pactadas"),
    faltantes: sumaSiTodos("faltantes"),
    sobrantes: sumaSiTodos("sobrantes"),
    ultimoPorUbicacion,
  };
};
