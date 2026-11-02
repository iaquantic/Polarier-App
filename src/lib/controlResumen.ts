// -----------------------------------------------------------------------------
// Formulario unificado: forma de los datos guardados y hoja `Resumen`.
//
// El Excel es un libro por mes. En la app se reparte según cuándo se rellena:
//   - `form_submissions.data` (ParteData): lo del día (jornada, lavado, procesado,
//     inventario). Una fila por día, para no mandar el mes entero en cada guardado.
//   - `control_mes.data` (ControlMesData): lo del mes (datos, KPI, equipos…).
//   - `control_eventos`: incidencias, retiros, mantenimiento y acciones. Van aparte
//     porque se abren un día y se cierran otro.
//
// `construirResumen` junta las tres cosas y calcula la hoja `Resumen`. Es la única
// fuente de cifras del dashboard, de los informes y de la routine del informe
// mensual, que lee la instantánea guardada en `control_mes.resumen`.
// -----------------------------------------------------------------------------
import {
  Accion,
  AREAS,
  celdaDetalle,
  CeldaDetalle,
  Cierre,
  ConteoUbicacion,
  COMPLETAR,
  cumplimientoKpi,
  CumplimientoKpi,
  DefinicionKpi,
  duracionHoras,
  FilaEquipo,
  FilaLavado,
  FilaOperacion,
  FilaProcesado,
  Incidencia,
  Jornada,
  KPIS_SLA,
  Mantenimiento,
  Num,
  RangoMes,
  rangoMes,
  ResultadoKpi,
  resultadoKpi,
  ResumenArea,
  resumenAreas,
  ResumenInventario,
  resumenInventario,
  Retiro,
  Revision,
  revisionLavado,
  revisionProcesado,
  TotalesAcciones,
  totalesAcciones,
  TotalesEquipos,
  totalesEquipos,
  TotalesIncidencias,
  totalesIncidencias,
  TotalesLavado,
  totalesLavado,
  TotalesOperacion,
  totalesOperacion,
  TotalesRetiros,
  totalesRetiros,
  pad2,
  pendienteFinal,
} from "@/lib/control";

// -----------------------------------------------------------------------------
// Parte diario (`form_submissions.data`)
// -----------------------------------------------------------------------------
export interface LineaLavado {
  id: string;
  prenda: string;
  recibidas: Num;
  pendiente_inicial: Num;
  lavadas: Num;
  kg: Num;
  observaciones: string;
}

/** Un vale: lo que en el Excel se repite en cada fila se escribe una sola vez. */
export interface ValeLavado {
  id: string;
  vale: string;
  turno: string;
  operario: string;
  equipo: string;
  lineas: LineaLavado[];
}

export interface LineaProcesado {
  id: string;
  prenda: string;
  declaradas: Num;
  conforme: Num;
  m_rosa: Num;
  m_negra: Num;
  m_oxido: Num;
  m_otras: Num;
  roturas: Num;
  pendientes: Num;
  observaciones: string;
}

/** Un paso de un vale por un área. Horas y personal son los mismos para todas sus prendas. */
export interface TandaProcesado {
  id: string;
  area: string;
  vale: string;
  turno: string;
  equipo: string;
  operarios: string;
  jefe_turno: string;
  hora_inicio: string;
  hora_fin: string;
  lineas: LineaProcesado[];
}

export interface UbicacionExtra {
  id: string;
  nombre: string;
}

export interface InventarioDia {
  /** { ubicacionId: { prendaId: n } }. Una casilla sin clave es «sin conteo nuevo». */
  conteos: Record<string, Record<string, Num>>;
  observaciones: Record<string, string>;
  /** Ubicaciones añadidas a mano ese día, fuera del catálogo. */
  extra: UbicacionExtra[];
}

export interface ParteData {
  jornada: Jornada;
  lavado: ValeLavado[];
  procesado: TandaProcesado[];
  inventario: InventarioDia;
}

export const jornadaVacia = (): Jornada => ({
  turistas: null,
  entregadas: null,
  horas_previstas: null,
  horas_trabajadas: null,
  parada: null,
  observacion: "",
  cierre: "Pendiente",
});

export const parteVacio = (): ParteData => ({
  jornada: jornadaVacia(),
  lavado: [],
  procesado: [],
  inventario: { conteos: {}, observaciones: {}, extra: [] },
});

/** Normaliza lo leído de la base: los partes viejos o a medias no rompen el formulario. */
export const leerParte = (data: unknown): ParteData => {
  const d = (data ?? {}) as Partial<ParteData>;
  const inv = (d.inventario ?? {}) as Partial<InventarioDia>;
  return {
    jornada: { ...jornadaVacia(), ...(d.jornada ?? {}) },
    lavado: Array.isArray(d.lavado) ? d.lavado : [],
    procesado: Array.isArray(d.procesado) ? d.procesado : [],
    inventario: {
      conteos: inv.conteos ?? {},
      observaciones: inv.observaciones ?? {},
      extra: Array.isArray(inv.extra) ? inv.extra : [],
    },
  };
};

/** El parte en filas de `Lavado_detalle`. */
export const filasLavado = (fecha: string, parte: ParteData): FilaLavado[] =>
  parte.lavado.flatMap((v) =>
    v.lineas.map((l) => ({
      fecha,
      turno: v.turno,
      vale: v.vale,
      prenda: l.prenda,
      recibidas: l.recibidas,
      pendiente_inicial: l.pendiente_inicial,
      lavadas: l.lavadas,
      kg: l.kg,
      operario: v.operario,
      equipo: v.equipo,
      observaciones: l.observaciones,
    }))
  );

/** El parte en filas de `Procesado_detalle`. */
export const filasProcesado = (fecha: string, parte: ParteData): FilaProcesado[] =>
  parte.procesado.flatMap((t) =>
    t.lineas.map((l) => ({
      fecha,
      turno: t.turno,
      area: t.area,
      equipo: t.equipo,
      operarios: t.operarios,
      jefe_turno: t.jefe_turno,
      vale: t.vale,
      prenda: l.prenda,
      declaradas: l.declaradas,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      conforme: l.conforme,
      m_rosa: l.m_rosa,
      m_negra: l.m_negra,
      m_oxido: l.m_oxido,
      m_otras: l.m_otras,
      roturas: l.roturas,
      pendientes: l.pendientes,
      observaciones: l.observaciones,
    }))
  );

/** El parte en filas de `Inventario`: solo las ubicaciones con algo escrito ese día. */
export const conteosDelParte = (fecha: string, parte: ParteData): ConteoUbicacion[] =>
  Object.entries(parte.inventario.conteos)
    .filter(([, valores]) => Object.values(valores ?? {}).some((v) => typeof v === "number"))
    .map(([ubicacion, valores]) => ({
      fecha,
      ubicacion,
      valores,
      observacion: parte.inventario.observaciones[ubicacion],
    }));

// -----------------------------------------------------------------------------
// Totales de un parte (`form_submissions.totales`)
// -----------------------------------------------------------------------------
const sumaNum = (vs: Num[]): number => vs.reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);

export interface TotalesParte {
  kg: number;
  /** Piezas recibidas; el nombre es el que ya entiende `audit_daily`. */
  declaracion: number;
  /** Piezas lavadas. */
  produccion: number;
  pendientes: number;
  turistas: Num;
  entregadas: Num;
  horas_previstas: Num;
  horas_trabajadas: Num;
  parada: Num;
  conforme: number;
  m_rosa: number;
  m_negra: number;
  m_oxido: number;
  m_varias: number;
  roturas: number;
  registros_lavado: number;
  por_revisar_lavado: number;
  registros_procesado: number;
  por_revisar_procesado: number;
  ubicaciones_contadas: number;
  cierre: Cierre;
}

/**
 * Totales tal como están en pantalla, aunque el día siga abierto: son los que
 * pintan la barra del día. Las cifras oficiales del mes salen de `construirResumen`,
 * que solo cuenta los días cerrados con todos sus registros completos.
 */
export const totalesParte = (fecha: string, parte: ParteData, rango: RangoMes): TotalesParte => {
  const lav = filasLavado(fecha, parte);
  const proc = filasProcesado(fecha, parte);
  const revsLav = lav.map((f) => revisionLavado(f, rango));
  const revsProc = proc.map((f) => revisionProcesado(f, rango));
  return {
    kg: sumaNum(lav.map((f) => f.kg)),
    declaracion: sumaNum(lav.map((f) => f.recibidas)),
    produccion: sumaNum(lav.map((f) => f.lavadas)),
    pendientes: sumaNum(lav.map((f) => pendienteFinal(f))),
    turistas: parte.jornada.turistas,
    entregadas: parte.jornada.entregadas,
    horas_previstas: parte.jornada.horas_previstas,
    horas_trabajadas: parte.jornada.horas_trabajadas,
    parada: parte.jornada.parada,
    conforme: sumaNum(proc.map((f) => f.conforme)),
    m_rosa: sumaNum(proc.map((f) => f.m_rosa)),
    m_negra: sumaNum(proc.map((f) => f.m_negra)),
    m_oxido: sumaNum(proc.map((f) => f.m_oxido)),
    m_varias: sumaNum(proc.map((f) => f.m_otras)),
    roturas: sumaNum(proc.map((f) => f.roturas)),
    registros_lavado: lav.length,
    por_revisar_lavado: revsLav.filter((r) => r === "Completar" || r === "Revisar").length,
    registros_procesado: proc.length,
    por_revisar_procesado: revsProc.filter(
      (r) => r === "Completar" || r === "Revisar" || r === "Revisar diferencia"
    ).length,
    ubicaciones_contadas: conteosDelParte(fecha, parte).length,
    cierre: parte.jornada.cierre,
  };
};

// -----------------------------------------------------------------------------
// Documento del mes (`control_mes.data`)
// -----------------------------------------------------------------------------
export interface EntradaKpi {
  cantidad: Num;
  base: Num;
  documento: string;
}

export interface Encuesta {
  puntuacion: Num;
  encuestas: Num;
  documento: string;
  observacion: string;
}

/** Las hojas que tienen «Revisión del mes» declarada a mano. */
export type HojaRevisada = "operacion" | "kpi" | "incidencias" | "equipos" | "retiros" | "acciones";

export interface ControlMesData {
  datos: {
    representante: string;
    cargo: string;
    fecha_elaboracion: string;
    aplicacion_sla: string;
    fin_estabilizacion: string;
    acta: string;
    turnos: string;
    personal: Num;
  };
  revision: Partial<Record<HojaRevisada, Revision>>;
  kpis: Record<string, EntradaKpi>;
  encuestas: { lavado: Encuesta; servicio: Encuesta };
  controles: { reprocesos: Num; reclamaciones: Num; danos: Num; criterio: string };
  equipos: FilaEquipo[];
  sintesis: { logros: string; dificultades: string; acuerdos: string };
}

const encuestaVacia = (): Encuesta => ({ puntuacion: null, encuestas: null, documento: "", observacion: "" });

export const controlMesVacio = (): ControlMesData => ({
  datos: {
    representante: "",
    cargo: "",
    fecha_elaboracion: "",
    aplicacion_sla: "",
    fin_estabilizacion: "",
    acta: "",
    turnos: "",
    personal: null,
  },
  revision: {},
  kpis: {},
  encuestas: { lavado: encuestaVacia(), servicio: encuestaVacia() },
  controles: { reprocesos: null, reclamaciones: null, danos: null, criterio: "" },
  equipos: [],
  sintesis: { logros: "", dificultades: "", acuerdos: "" },
});

export const leerControlMes = (data: unknown): ControlMesData => {
  const base = controlMesVacio();
  const d = (data ?? {}) as Partial<ControlMesData>;
  return {
    datos: { ...base.datos, ...(d.datos ?? {}) },
    revision: d.revision ?? {},
    kpis: d.kpis ?? {},
    encuestas: {
      lavado: { ...base.encuestas.lavado, ...(d.encuestas?.lavado ?? {}) },
      servicio: { ...base.encuestas.servicio, ...(d.encuestas?.servicio ?? {}) },
    },
    controles: { ...base.controles, ...(d.controles ?? {}) },
    equipos: Array.isArray(d.equipos) ? d.equipos : [],
    sintesis: { ...base.sintesis, ...(d.sintesis ?? {}) },
  };
};

/**
 * Lo que un mes nuevo hereda del anterior para no volver a teclearlo: los datos
 * estables del SLA y la lista de equipos («solo cambia lo que haya variado»).
 * Lo que es del mes (fecha de elaboración, conteos, síntesis) arranca vacío.
 */
export const heredarControlMes = (anterior: ControlMesData | null): ControlMesData => {
  const nuevo = controlMesVacio();
  if (!anterior) return nuevo;
  const { representante, cargo, aplicacion_sla, fin_estabilizacion, acta, turnos, personal } = anterior.datos;
  nuevo.datos = { ...nuevo.datos, representante, cargo, aplicacion_sla, fin_estabilizacion, acta, turnos, personal };
  nuevo.controles.criterio = anterior.controles.criterio;
  nuevo.equipos = anterior.equipos.map((e) => ({ ...e, intervencion: "", parte: "" }));
  return nuevo;
};

// -----------------------------------------------------------------------------
// Novedades (`control_eventos`)
// -----------------------------------------------------------------------------
export type TipoEvento = "incidencia" | "retiro" | "mantenimiento" | "accion";

export interface EventoRegistro<T = Record<string, unknown>> {
  id: string;
  tipo: TipoEvento;
  fecha: string;
  data: T;
}

const deTipo = <T,>(eventos: EventoRegistro[], tipo: TipoEvento, conFecha = true): T[] =>
  eventos
    .filter((e) => e.tipo === tipo)
    .map((e) => ({ ...(e.data as object), ...(conFecha ? { fecha: e.fecha } : {}) }) as unknown as T);

// -----------------------------------------------------------------------------
// Partes del mes: una fila por día, aunque firmen varias personas
// -----------------------------------------------------------------------------
export interface ParteRegistro {
  fecha: string;
  data: unknown;
  updated_at?: string;
}

const CAMPOS_JORNADA = ["turistas", "entregadas", "horas_previstas", "horas_trabajadas", "parada"] as const;

/**
 * El Excel tiene una sola fila por día, y la app un parte por persona y día. Los
 * registros de lavado y procesado se suman porque son hechos distintos; los datos
 * de la jornada no (los turistas son los mismos), así que manda el parte más
 * reciente que los traiga. Si alguien sigue con el día abierto, el día está abierto.
 */
const combinarJornadas = (partes: { parte: ParteData; updated_at?: string }[]): Jornada => {
  const ordenados = [...partes].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  const j = jornadaVacia();
  for (const campo of CAMPOS_JORNADA) {
    j[campo] = ordenados.map((p) => p.parte.jornada[campo]).find((v) => typeof v === "number") ?? null;
  }
  j.observacion = ordenados.map((p) => p.parte.jornada.observacion).find(Boolean) ?? "";
  const cierres = partes.map((p) => p.parte.jornada.cierre);
  j.cierre = cierres.includes("Pendiente")
    ? "Pendiente"
    : cierres.includes("Cerrado")
      ? "Cerrado"
      : "Sin actividad";
  return j;
};

// -----------------------------------------------------------------------------
// Hoja Resumen
// -----------------------------------------------------------------------------
export interface FilaKpi extends DefinicionKpi {
  cantidadValor: Num;
  baseValor: Num;
  documento: string;
  resultado: ResultadoKpi;
  cumplimiento: CumplimientoKpi;
}

export interface FilaRevision {
  hoja: string;
  estado: string;
  detalle: string;
}

export interface ArticuloResumen {
  prenda: string;
  /** Resumen!B59 */
  pactadas: number | "Completar";
  /** Resumen!C59 */
  actuales: number | "Completar";
  /** Resumen!D59: saldo (+ sobran / − faltan) */
  saldo: number | "Completar";
}

export interface ResumenMes {
  anio: number;
  mes: number;
  rango: RangoMes;
  filasOperacion: FilaOperacion[];
  operacion: TotalesOperacion;
  /** Lo que llevan los indicadores que la hoja no da hasta completar el mes. */
  parcial: { kgPorTurista: number | null; balance: number | null };
  lavado: TotalesLavado;
  areas: ResumenArea[];
  /** Procesado_detalle!B7 y E7 */
  procesado: { completos: number; pendientes: number };
  inventario: ResumenInventario;
  articulos: ArticuloResumen[];
  kpis: FilaKpi[];
  /** Resumen!B37 */
  kpisCumplen: number;
  /** Resumen!D37 */
  kpisEvaluados: number;
  calidad: {
    lavado: Encuesta;
    servicio: Encuesta;
    reprocesos: Num;
    reclamaciones: Num;
    danos: Num;
    criterio: string;
  };
  incidencias: TotalesIncidencias;
  equipos: TotalesEquipos;
  retiros: TotalesRetiros;
  acciones: TotalesAcciones;
  datos: ControlMesData["datos"];
  /** Resumen!F12:G19 */
  revision: FilaRevision[];
  sintesis: ControlMesData["sintesis"];
  /** Resumen!F87:H89 */
  registros: { lavado: string; procesado: string };
}

export interface ConstruirResumenParams {
  anio: number;
  mes: number;
  partes: ParteRegistro[];
  control: ControlMesData | null;
  eventos: EventoRegistro[];
  /** Prendas del catálogo. El inventario va por id y aquí se traduce a nombres. */
  prendas: { id: string; nombre: string }[];
  ubicaciones: { id: string; nombre: string }[];
  /** Prendas pactadas por id de prenda; salen de `dotacion_lenceria`. */
  pactadas: Record<string, Num>;
  kpis?: DefinicionKpi[];
}

export const construirResumen = (p: ConstruirResumenParams): ResumenMes => {
  const { anio, mes } = p;
  const rango = rangoMes(anio, mes);
  const control = p.control ?? controlMesVacio();
  const rev = (h: HojaRevisada): Revision => control.revision[h] ?? "Pendiente";

  const leidos = p.partes.map((x) => ({
    fecha: x.fecha,
    parte: leerParte(x.data),
    updated_at: x.updated_at,
  }));

  const todasLavado = leidos.flatMap((x) => filasLavado(x.fecha, x.parte));
  const todasProcesado = leidos.flatMap((x) => filasProcesado(x.fecha, x.parte));

  // Operacion: una fila por cada día del mes, haya parte o no.
  const filasOperacion: FilaOperacion[] = Array.from({ length: rango.dias }, (_, i) => {
    const fecha = `${anio}-${pad2(mes)}-${pad2(i + 1)}`;
    const delDia = leidos.filter((x) => x.fecha === fecha);
    const j = delDia.length ? combinarJornadas(delDia) : null;
    const lav = todasLavado.filter((f) => f.fecha === fecha);
    const cierre = j?.cierre ?? null;
    return {
      fecha,
      turistas: j?.turistas ?? null,
      kg: celdaDetalle(cierre, lav, rango, "kg"),
      recibidas: celdaDetalle(cierre, lav, rango, "recibidas"),
      entregadas: j?.entregadas ?? null,
      horas_previstas: j?.horas_previstas ?? null,
      horas_trabajadas: j?.horas_trabajadas ?? null,
      parada: j?.parada ?? null,
      observacion: j?.observacion ?? "",
      cierre,
    };
  });
  const operacion = totalesOperacion(filasOperacion, rango.dias, rev("operacion"));
  const { total } = operacion;

  const parcial = {
    kgPorTurista:
      typeof total.kg === "number" && typeof total.turistas === "number" && total.turistas > 0
        ? total.kg / total.turistas
        : null,
    balance:
      typeof total.entregadas === "number" && typeof total.recibidas === "number"
        ? total.entregadas - total.recibidas
        : null,
  };

  const areas = resumenAreas(todasProcesado, rango);
  const procesado = {
    completos: areas.reduce((s, a) => s + a.completos, 0),
    pendientes: areas.reduce((s, a) => s + a.porRevisar, 0),
  };
  const lavado = totalesLavado(todasLavado, rango);

  // Inventario: por ids (dos ubicaciones podrían llamarse igual) y nombres al final.
  const extras = leidos.flatMap((x) => x.parte.inventario.extra);
  const nombreUbicacion = new Map([...p.ubicaciones, ...extras].map((u) => [u.id, u.nombre]));
  const nombrePrenda = new Map(p.prendas.map((x) => [x.id, x.nombre]));
  const conteos = leidos.flatMap((x) => conteosDelParte(x.fecha, x.parte));
  const inventarioPorId = resumenInventario(
    conteos,
    p.prendas.map((x) => x.id),
    Array.from(nombreUbicacion.keys()),
    p.pactadas
  );
  const inventario: ResumenInventario = {
    ...inventarioPorId,
    articulos: inventarioPorId.articulos.map((a) => ({ ...a, prenda: nombrePrenda.get(a.prenda) ?? a.prenda })),
  };
  const articulos: ArticuloResumen[] = inventario.articulos.map((a) => ({
    prenda: a.prenda,
    pactadas: a.pactadas ?? COMPLETAR,
    actuales: a.actual ?? COMPLETAR,
    saldo:
      typeof a.sobrantes === "number" && typeof a.faltantes === "number"
        ? a.sobrantes - a.faltantes
        : COMPLETAR,
  }));

  // KPI.
  const kpis: FilaKpi[] = (p.kpis ?? KPIS_SLA).map((def) => {
    const e = control.kpis[def.key] ?? { cantidad: null, base: null, documento: "" };
    const resultado = resultadoKpi(e.cantidad, e.base);
    return {
      ...def,
      cantidadValor: e.cantidad,
      baseValor: e.base,
      documento: e.documento ?? "",
      resultado,
      cumplimiento: cumplimientoKpi(resultado, def.meta),
    };
  });
  const kpisCumplen = kpis.filter((k) => k.cumplimiento === "Cumple").length;
  const kpisEvaluados = kpisCumplen + kpis.filter((k) => k.cumplimiento === "No cumple").length;

  // Novedades.
  const incidencias = totalesIncidencias(deTipo<Incidencia>(p.eventos, "incidencia"), rango, rev("incidencias"));
  const mantenimiento = deTipo<Mantenimiento>(p.eventos, "mantenimiento", false);
  const equipos = totalesEquipos(control.equipos, mantenimiento, rango, rev("equipos"));
  const retiros = totalesRetiros(deTipo<Retiro>(p.eventos, "retiro"), rango, rev("retiros"));
  const acciones = totalesAcciones(deTipo<Accion>(p.eventos, "accion"), rango, rev("acciones"));

  // Resumen!G12
  const { representante, cargo, fecha_elaboracion } = control.datos;
  const datosEstado = representante && cargo && fecha_elaboracion ? "Informado" : COMPLETAR;

  const revision: FilaRevision[] = [
    { hoja: "Datos del mes", estado: datosEstado, detalle: "Representante, cargo y fecha" },
    {
      hoja: "Jornada y lavado",
      estado: rev("operacion"),
      detalle:
        operacion.diasPorCompletar.turistas > 0
          ? `${operacion.diasPorCompletar.turistas === 1 ? "Falta 1 día" : `Faltan ${operacion.diasPorCompletar.turistas} días`}. Los totales son parciales`
          : "Todos los días con dato",
    },
    {
      hoja: "Indicadores del SLA",
      estado: rev("kpi"),
      detalle: `${kpis.filter((k) => k.resultado !== COMPLETAR).length} de ${kpis.length} con datos`,
    },
    { hoja: "Incidencias", estado: rev("incidencias"), detalle: "" },
    { hoja: "Equipos", estado: rev("equipos"), detalle: "" },
    { hoja: "Inventario", estado: inventario.estado, detalle: "Se calcula de los conteos" },
    { hoja: "Retiros e importes", estado: rev("retiros"), detalle: "" },
    { hoja: "Acciones", estado: rev("acciones"), detalle: "" },
  ];

  return {
    anio,
    mes,
    rango,
    filasOperacion,
    operacion,
    parcial,
    lavado,
    areas,
    procesado,
    inventario,
    articulos,
    kpis,
    kpisCumplen,
    kpisEvaluados,
    calidad: {
      lavado: control.encuestas.lavado,
      servicio: control.encuestas.servicio,
      reprocesos: control.controles.reprocesos,
      reclamaciones: control.controles.reclamaciones,
      danos: control.controles.danos,
      criterio: control.controles.criterio,
    },
    incidencias,
    equipos,
    retiros,
    acciones,
    datos: control.datos,
    revision,
    sintesis: control.sintesis,
    registros: {
      // Resumen!G87
      lavado: lavado.pendientes > 0 ? "Revisar" : lavado.completos === 0 ? "Sin registros" : "Registros completos",
      // Resumen!G89
      procesado:
        procesado.pendientes > 0 ? "Revisar" : procesado.completos === 0 ? "Sin registros" : "Registros completos",
    },
  };
};

/**
 * Conteos que se pueden proponer desde lo registrado, sin escribirlos por su
 * cuenta: el KPI lo declara quien tiene los documentos.
 */
export const sugerenciaKpi = (
  key: string,
  r: Pick<ResumenMes, "equipos" | "areas">
): { cantidad: number; base: number } | null => {
  if (key === "preventivo") {
    const { preventivosEjecutados: e, preventivosPrevistos: p } = r.equipos;
    return typeof e === "number" && typeof p === "number" && p > 0 ? { cantidad: e, base: p } : null;
  }
  if (key === "calidad") {
    const a = r.areas.find((x) => x.area === "Control final");
    return a && typeof a.conformes === "number" && a.declaradas > 0
      ? { cantidad: a.conformes, base: a.declaradas }
      : null;
  }
  return null;
};

/** Prendas pactadas (Inventario!B483:B490): la dotación del hotel sumada por prenda. */
export const pactadasDeDotacion = (
  dotacion: Record<string, Record<string, number>> | null | undefined
): Record<string, Num> => {
  const pactadas: Record<string, Num> = {};
  for (const fila of Object.values(dotacion ?? {})) {
    for (const [prenda, n] of Object.entries(fila ?? {})) {
      pactadas[prenda] = ((pactadas[prenda] as number) ?? 0) + (Number(n) || 0);
    }
  }
  return pactadas;
};

// -----------------------------------------------------------------------------
// Ayudas del parte
// -----------------------------------------------------------------------------
export const SIGUIENTE_AREA: Record<string, string | null> = {
  Secado: "Planchado",
  Planchado: "Doblado",
  Doblado: "Control final",
  "Control final": null,
};

/**
 * Declaradas de una prenda de un vale al entrar en un área: lo conforme de la
 * última etapa anterior por la que pasó, o lo lavado si es la primera. Una prenda
 * no pasa por todas las áreas (las toallas no se planchan), de ahí mirar hacia atrás.
 */
export const declaradasSugeridas = (
  parte: ParteData,
  area: string,
  vale: string,
  prenda: string
): Num => {
  const orden = AREAS as readonly string[];
  const anteriores = orden.slice(0, orden.indexOf(area)).reverse();
  for (const a of anteriores) {
    const linea = parte.procesado
      .filter((t) => t.area === a && t.vale === vale)
      .flatMap((t) => t.lineas)
      .find((l) => l.prenda === prenda);
    if (linea && typeof linea.conforme === "number") return linea.conforme;
  }
  const lavado = parte.lavado
    .filter((v) => v.vale === vale)
    .flatMap((v) => v.lineas)
    .find((l) => l.prenda === prenda);
  return lavado?.lavadas ?? null;
};

/** Prendas que un vale lleva a un área: las que salieron de la etapa anterior. */
export const prendasDelVale = (parte: ParteData, area: string, vale: string): string[] => {
  const orden = AREAS as readonly string[];
  const anteriores = orden.slice(0, orden.indexOf(area));
  const nombres = [
    ...parte.lavado.filter((v) => v.vale === vale).flatMap((v) => v.lineas.map((l) => l.prenda)),
    ...parte.procesado
      .filter((t) => t.vale === vale && anteriores.includes(t.area))
      .flatMap((t) => t.lineas.map((l) => l.prenda)),
  ];
  return Array.from(new Set(nombres.filter(Boolean)));
};

/**
 * «Todo conforme»: el caso normal de una fila, que en el Excel son 8 números.
 * No tiene que ver con estimar nada: escribe los ceros que de todas formas habría
 * que teclear, y cuadra con lo declarado.
 */
export const lineaTodoConforme = (l: LineaProcesado): LineaProcesado => ({
  ...l,
  conforme: l.declaradas,
  m_rosa: 0,
  m_negra: 0,
  m_oxido: 0,
  m_otras: 0,
  roturas: 0,
  pendientes: 0,
});

export const lineaProcesadoVacia = (l: LineaProcesado): boolean =>
  [l.conforme, l.m_rosa, l.m_negra, l.m_oxido, l.m_otras, l.roturas, l.pendientes].every((v) => v === null);

/** Vales de ayer con pendiente final: las continuaciones de hoy («recibidas = 0»). */
export const continuacionesDeAyer = (anterior: ParteData | null, nuevoId: () => string): ValeLavado[] => {
  if (!anterior) return [];
  return anterior.lavado
    .map((v) => ({
      ...v,
      id: nuevoId(),
      lineas: v.lineas
        .map((l) => ({ l, pendiente: pendienteFinal(l) }))
        .filter((x) => typeof x.pendiente === "number" && x.pendiente > 0)
        .map(({ l, pendiente }) => ({
          id: nuevoId(),
          prenda: l.prenda,
          recibidas: 0,
          pendiente_inicial: pendiente,
          lavadas: null,
          kg: null,
          observaciones: "",
        })),
    }))
    .filter((v) => v.lineas.length > 0);
};

export { duracionHoras };
export type { CeldaDetalle };
