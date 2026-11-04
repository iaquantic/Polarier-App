// -----------------------------------------------------------------------------
// Lector del Excel «Modelo Mensual» relleno por el supervisor.
//
// Solo lee las casillas de entrada. Lo calculado se ignora a propósito: las fórmulas
// las vuelve a hacer `control.ts`, igual que al rellenar en la app, así que un libro
// con fórmulas rotas o sin recalcular no cuela ninguna cifra.
//
// Es lógica pura sobre `LectorExcel`: abrir el archivo es cosa de `xlsxLectura.ts`.
// -----------------------------------------------------------------------------
import {
  CIERRES,
  Cierre,
  FilaEquipo,
  FilaLavado,
  FilaProcesado,
  KPIS_SLA,
  Num,
  Revision,
  REVISIONES,
  diasDelMes,
  pad2,
} from "@/lib/control";
import type { ControlMesData, EntradaKpi, Encuesta, HojaRevisada } from "@/lib/controlResumen";
import {
  ColHoja,
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
  fechaDeTexto,
  FILAS,
  filaInventario,
  horaDeTexto,
  LETRAS_PRENDAS,
  HOJAS,
  normalizar,
  numeroDeTexto,
  PRENDAS_HOJA,
  textoDeFecha,
  TITULOS_KPI_SIN_BASE,
} from "@/lib/controlHojas";

/** Lo mínimo que se necesita de un libro: el último valor de una casilla, o `null`. */
export interface LectorExcel {
  hojas: string[];
  celda: (hoja: string, ref: string) => unknown;
}

export interface AvisoExcel {
  hoja: string;
  fila?: number;
  texto: string;
}

export interface FilaExcel<T> {
  fila: number;
  valor: T;
}

export interface EventoExcel {
  fila: number;
  /** `null`: sin fecha válida. */
  fecha: string | null;
  fechaTexto: string;
  data: Record<string, unknown>;
}

export interface ConteoExcel {
  fila: number;
  fecha: string;
  ubicacion: string;
  /** Por nombre de prenda. Solo las casillas con número. */
  valores: Record<string, number>;
  observacion: string;
}

export interface LibroExcel {
  anio: number | null;
  mes: number | null;
  hotel: string;
  /** Problemas de estructura: si hay alguno, el archivo no se puede subir. */
  errores: string[];
  kpiConBase: boolean;
  datos: Partial<ControlMesData["datos"]>;
  sintesis: Partial<ControlMesData["sintesis"]>;
  revision: Partial<Record<HojaRevisada, Revision>>;
  kpis: Record<string, Partial<EntradaKpi>>;
  metas: Record<string, Num>;
  encuestas: { lavado: Partial<Encuesta>; servicio: Partial<Encuesta> };
  controles: Partial<ControlMesData["controles"]>;
  jornadas: FilaExcel<{ fecha: string; turistas?: Num; entregadas?: Num; horas_previstas?: Num; horas_trabajadas?: Num; parada?: Num; observacion?: string; cierre?: Cierre }>[];
  lavado: FilaExcel<FilaLavado>[];
  procesado: FilaExcel<FilaProcesado>[];
  conteos: ConteoExcel[];
  /** Por nombre de prenda. */
  pactadas: Record<string, number>;
  incidencias: EventoExcel[];
  retiros: EventoExcel[];
  mantenimiento: EventoExcel[];
  acciones: EventoExcel[];
  equipos: FilaExcel<Omit<FilaEquipo, "id">>[];
  /** Casillas que no se han podido leer. */
  avisos: AvisoExcel[];
  /** Filas que no pueden entrar. */
  noEntran: AvisoExcel[];
}

const vacio = (v: unknown): boolean => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

const esFecha = (v: unknown): v is Date => Object.prototype.toString.call(v) === "[object Date]";

/** De serial de Excel a aaaa-mm-dd. */
const fechaDeSerial = (n: number): string | null => {
  if (!(n > 20000 && n < 80000)) return null;
  const f = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
  return `${f.getUTCFullYear()}-${pad2(f.getUTCMonth() + 1)}-${pad2(f.getUTCDate())}`;
};

/** Fecha de una casilla: `abrirXlsx` da las fechas de Excel como UTC. */
export const leerFecha = (v: unknown): string | null => {
  if (vacio(v)) return null;
  if (esFecha(v)) {
    if (v.getUTCFullYear() < 1900) return null;
    return `${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}`;
  }
  if (typeof v === "number") return fechaDeSerial(v);
  return fechaDeTexto(String(v));
};

/** Hora de una casilla: en Excel es una fracción del día, o una fecha de 1899. */
export const leerHora = (v: unknown): string | null => {
  if (vacio(v)) return null;
  if (esFecha(v)) return `${pad2(v.getUTCHours())}:${pad2(v.getUTCMinutes())}`;
  if (typeof v === "number") {
    const min = Math.round((v - Math.floor(v)) * 24 * 60) % (24 * 60);
    return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
  }
  return horaDeTexto(String(v));
};

export const leerTexto = (v: unknown): string => {
  if (vacio(v)) return "";
  if (esFecha(v)) return textoDeFecha(leerFecha(v));
  if (typeof v === "number" && !Number.isInteger(v)) return String(Math.round(v * 1e6) / 1e6);
  return String(v).trim();
};

/** Número de una casilla; `undefined` si hay algo que no es un número. */
export const leerNumero = (v: unknown, horas = false): Num | undefined => {
  if (vacio(v)) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (esFecha(v)) {
    // Una duración escrita como 1:30 llega como hora.
    return horas && v.getUTCFullYear() < 1900 ? v.getUTCHours() + v.getUTCMinutes() / 60 : undefined;
  }
  return numeroDeTexto(String(v), horas);
};

/** La primera fila de una hoja cuyas cabeceras no son las esperadas, en palabras. */
const comprobarCabeceras = (l: LectorExcel, hoja: string, cols: { letra: string; titulo: string }[], fila: number): string | null => {
  const faltan = cols.filter((c) => normalizar(leerTexto(l.celda(hoja, `${c.letra}${fila}`))) !== normalizar(c.titulo));
  return faltan.length === 0 ? null : `${hoja} no tiene las columnas del Modelo Mensual: falta «${faltan[0].titulo}» en ${faltan[0].letra}${fila}.`;
};

/** Crea el lector de una hoja que anota lo que no entiende. */
const lectorHoja = (l: LectorExcel, hoja: string, anio: number | null, avisos: AvisoExcel[]) => {
  const raw = (col: string, fila: number) => l.celda(hoja, `${col}${fila}`);
  const avisar = (c: ColHoja, fila: number, v: unknown) =>
    avisos.push({ hoja, fila, texto: `«${leerTexto(v)}» en ${c.titulo} no vale: la casilla queda vacía.` });
  return {
    raw,
    /** Valor tipado de una casilla según su columna. */
    leer: (c: ColHoja, fila: number): unknown => {
      const v = raw(c.letra, fila);
      switch (c.tipo) {
        case "entero":
        case "decimal":
        case "horas": {
          const n = leerNumero(v, c.tipo === "horas");
          if (n === undefined) {
            avisar(c, fila, v);
            return null;
          }
          return n;
        }
        case "fecha": {
          const f = leerFecha(v);
          if (f === null && !vacio(v)) avisar(c, fila, v);
          return f;
        }
        case "hora": {
          const h = leerHora(v);
          if (h === null && !vacio(v)) avisar(c, fila, v);
          return h ?? "";
        }
        default:
          return leerTexto(v);
      }
    },
    /** ¿Hay algo escrito en esta fila, sin contar lo calculado? */
    hayDatos: (cols: ColHoja[], fila: number): boolean =>
      cols.some((c) => c.tipo !== "calc" && c.tipo !== "ref" && !vacio(raw(c.letra, fila))),
    anio,
  };
};

const revisionDe = (v: unknown): Revision | undefined => {
  const t = leerTexto(v);
  return (REVISIONES as readonly string[]).includes(t) ? (t as Revision) : undefined;
};

const sinCalculos = (cols: ColHoja[]) => cols.filter((c) => c.tipo !== "calc" && c.tipo !== "ref");

const leerEventos = (
  l: LectorExcel,
  hoja: string,
  cols: ColHoja[],
  desde: number,
  hasta: number,
  anio: number | null,
  avisos: AvisoExcel[],
  fechaDe: (d: Record<string, unknown>) => unknown
): EventoExcel[] => {
  const h = lectorHoja(l, hoja, anio, avisos);
  const out: EventoExcel[] = [];
  const entrada = sinCalculos(cols);
  for (let fila = desde; fila <= hasta; fila++) {
    if (!h.hayDatos(cols, fila)) continue;
    const data: Record<string, unknown> = {};
    for (const c of entrada) data[c.key] = h.leer(c, fila);
    const fecha = (fechaDe(data) as string | null) ?? null;
    const { fecha: _f, ...resto } = data;
    const crudo = cols.find((c) => c.key === "fecha");
    out.push({ fila, fecha, fechaTexto: crudo ? leerTexto(h.raw(crudo.letra, fila)) : "", data: resto });
  }
  return out;
};

/** Lee el libro entero. Si faltan hojas o columnas, `errores` lo dice y lo demás no se lee. */
export const leerModeloMensual = (l: LectorExcel): LibroExcel => {
  const libro: LibroExcel = {
    anio: null,
    mes: null,
    hotel: "",
    errores: [],
    kpiConBase: true,
    datos: {},
    sintesis: {},
    revision: {},
    kpis: {},
    metas: {},
    encuestas: { lavado: {}, servicio: {} },
    controles: {},
    jornadas: [],
    lavado: [],
    procesado: [],
    conteos: [],
    pactadas: {},
    incidencias: [],
    retiros: [],
    mantenimiento: [],
    acciones: [],
    equipos: [],
    avisos: [],
    noEntran: [],
  };

  const faltan = HOJAS.filter((h) => !l.hojas.includes(h));
  if (faltan.length) {
    libro.errores.push(`Este archivo no es el Modelo Mensual: falta la hoja ${faltan.join(", ")}.`);
    return libro;
  }

  // KPI_calidad admite las dos versiones: la corregida con Base y la antigua sin ella.
  const conBase = comprobarCabeceras(l, "KPI_calidad", COLS_KPI, FILAS.cabecera) === null;
  const sinBase =
    comprobarCabeceras(
      l,
      "KPI_calidad",
      TITULOS_KPI_SIN_BASE.map((titulo, i) => ({ titulo, letra: "ABCDEFG"[i] })),
      FILAS.cabecera
    ) === null;
  libro.kpiConBase = conBase;

  const comprobaciones = [
    comprobarCabeceras(l, "Operacion", COLS_OPERACION, FILAS.cabecera),
    conBase || sinBase ? null : comprobarCabeceras(l, "KPI_calidad", COLS_KPI, FILAS.cabecera),
    comprobarCabeceras(l, "KPI_calidad", COLS_ENCUESTAS, FILAS.encuestas.cabecera),
    comprobarCabeceras(l, "Incidencias", COLS_INCIDENCIAS, FILAS.cabecera),
    comprobarCabeceras(l, "Equipos", COLS_EQUIPOS, FILAS.cabecera),
    comprobarCabeceras(l, "Equipos", COLS_MANTENIMIENTO, FILAS.mantenimiento.cabecera),
    comprobarCabeceras(l, "Retiros_importes", COLS_RETIROS, FILAS.cabecera),
    comprobarCabeceras(l, "Acciones", COLS_ACCIONES, FILAS.cabecera),
    comprobarCabeceras(l, "Lavado_detalle", COLS_LAVADO, FILAS.cabecera),
    comprobarCabeceras(l, "Procesado_detalle", COLS_PROCESADO, FILAS.cabecera),
    comprobarCabeceras(
      l,
      "Inventario",
      [
        { letra: "A", titulo: "Fecha" },
        { letra: "B", titulo: "Ubicación" },
        ...LETRAS_PRENDAS.map((letra, i) => ({ letra, titulo: PRENDAS_HOJA[i] })),
        { letra: "L", titulo: "Acta / observación" },
      ],
      FILAS.cabecera
    ),
    comprobarCabeceras(l, "Inventario", COLS_PACTADAS.slice(0, 2), FILAS.pactadas.cabecera),
  ].filter((x): x is string => !!x);
  if (comprobaciones.length) {
    libro.errores.push(...comprobaciones);
    return libro;
  }

  // ---------------------------------------------------------------------------
  // Datos_mes
  // ---------------------------------------------------------------------------
  const dm = (ref: string) => l.celda("Datos_mes", ref);
  const mes = leerNumero(dm("B7"));
  const anio = leerNumero(dm("B8"));
  libro.mes = typeof mes === "number" && mes >= 1 && mes <= 12 ? mes : null;
  libro.anio = typeof anio === "number" && anio >= 1900 ? anio : null;
  libro.hotel = leerTexto(dm("B9"));
  if (libro.mes === null || libro.anio === null) {
    libro.errores.push("Datos_mes no dice de qué mes es: revisa B7 y B8.");
    return libro;
  }
  const dias = diasDelMes(libro.anio, libro.mes);
  const prefijo = `${libro.anio}-${pad2(libro.mes)}-`;
  const delMes = (f: string | null) => !!f && f.startsWith(prefijo);

  const dmTexto = (ref: string) => leerTexto(dm(ref));
  const dmFecha = (ref: string, titulo: string): string => {
    const v = dm(ref);
    const f = leerFecha(v);
    if (f === null && !vacio(v)) libro.avisos.push({ hoja: "Datos_mes", texto: `«${leerTexto(v)}» en ${titulo} no es una fecha.` });
    return f ?? "";
  };
  const asignar = <T extends object>(destino: T, clave: keyof T, valor: unknown) => {
    if (valor !== "" && valor !== null && valor !== undefined) destino[clave] = valor as T[keyof T];
  };
  asignar(libro.datos, "representante", dmTexto("B12"));
  asignar(libro.datos, "cargo", dmTexto("B13"));
  asignar(libro.datos, "fecha_elaboracion", dmFecha("B14", "Fecha de elaboración"));
  asignar(libro.datos, "aplicacion_sla", dmFecha("B15", "Fecha de aplicación del SLA"));
  asignar(libro.datos, "fin_estabilizacion", dmFecha("B16", "Fin de la estabilización"));
  asignar(libro.datos, "acta", dmTexto("B17"));
  asignar(libro.datos, "turnos", dmTexto("B18"));
  const personal = leerNumero(dm("B19"));
  if (personal === undefined) libro.avisos.push({ hoja: "Datos_mes", texto: `«${dmTexto("B19")}» en Personal efectivo no es un número.` });
  else asignar(libro.datos, "personal", personal);
  // Son celdas combinadas: el valor está en la primera.
  asignar(libro.sintesis, "logros", dmTexto("A22"));
  asignar(libro.sintesis, "dificultades", dmTexto("A26"));
  asignar(libro.sintesis, "acuerdos", dmTexto("A30"));

  // ---------------------------------------------------------------------------
  // Revisión del mes
  // ---------------------------------------------------------------------------
  const REVISADAS: [string, HojaRevisada][] = [
    ["Operacion", "operacion"],
    ["KPI_calidad", "kpi"],
    ["Incidencias", "incidencias"],
    ["Equipos", "equipos"],
    ["Retiros_importes", "retiros"],
    ["Acciones", "acciones"],
  ];
  for (const [hoja, clave] of REVISADAS) {
    const v = l.celda(hoja, "B7");
    const r = revisionDe(v);
    if (r) libro.revision[clave] = r;
    else if (!vacio(v)) libro.avisos.push({ hoja, fila: 7, texto: `«${leerTexto(v)}» no es una Revisión del mes válida.` });
  }

  // ---------------------------------------------------------------------------
  // Operacion: la fecha es de la fila, porque A es una fórmula
  // ---------------------------------------------------------------------------
  const op = lectorHoja(l, "Operacion", libro.anio, libro.avisos);
  for (let fila = FILAS.operacion.desde; fila <= FILAS.operacion.hasta; fila++) {
    const dia = fila - FILAS.operacion.desde + 1;
    if (!op.hayDatos(COLS_OPERACION, fila)) continue;
    if (dia > dias) {
      libro.noEntran.push({ hoja: "Operacion", fila, texto: `Este mes no tiene día ${dia}.` });
      continue;
    }
    const valor: LibroExcel["jornadas"][number]["valor"] = { fecha: `${prefijo}${pad2(dia)}` };
    for (const c of COLS_OPERACION) {
      if (c.tipo === "calc") continue;
      if (c.key === "cierre") {
        const v = leerTexto(op.raw(c.letra, fila));
        if ((CIERRES as readonly string[]).includes(v)) valor.cierre = v as Cierre;
        else if (v) libro.avisos.push({ hoja: "Operacion", fila, texto: `«${v}» no es un Cierre de lavado válido: no se cambia.` });
      } else if (!vacio(op.raw(c.letra, fila))) {
        const leido = op.leer(c, fila);
        if (leido !== null && leido !== "") (valor as Record<string, unknown>)[c.key] = leido;
      }
    }
    libro.jornadas.push({ fila, valor });
  }

  // ---------------------------------------------------------------------------
  // KPI_calidad
  // ---------------------------------------------------------------------------
  const kp = (ref: string) => l.celda("KPI_calidad", ref);
  const numKpi = (ref: string, titulo: string): Num | undefined => {
    const v = kp(ref);
    const n = leerNumero(v);
    if (n === undefined) libro.avisos.push({ hoja: "KPI_calidad", texto: `«${leerTexto(v)}» en ${titulo} (${ref}) no es un número.` });
    return n;
  };
  const [letraBase, letraMeta, letraDoc] = conBase ? ["C", "D", "G"] : [null, "C", "F"];
  KPIS_SLA.forEach((k, i) => {
    const fila = FILAS.kpi.desde + i;
    const entrada: Partial<EntradaKpi> = {};
    const cantidad = numKpi(`B${fila}`, k.nombre);
    if (typeof cantidad === "number") entrada.cantidad = cantidad;
    if (letraBase) {
      const base = numKpi(`${letraBase}${fila}`, k.nombre);
      if (typeof base === "number") entrada.base = base;
    }
    const doc = leerTexto(kp(`${letraDoc}${fila}`));
    if (doc) entrada.documento = doc;
    if (Object.keys(entrada).length) libro.kpis[k.key] = entrada;
    const meta = leerNumero(kp(`${letraMeta}${fila}`));
    if (typeof meta === "number") libro.metas[k.key] = meta;
  });

  const encuesta = (fila: number, nombre: string): Partial<Encuesta> => {
    const e: Partial<Encuesta> = {};
    const p = numKpi(`B${fila}`, `Puntuación de ${nombre}`);
    if (typeof p === "number") e.puntuacion = p;
    const n = numKpi(`C${fila}`, `Encuestas de ${nombre}`);
    if (typeof n === "number") e.encuestas = n;
    const d = leerTexto(kp(`D${fila}`));
    if (d) e.documento = d;
    const o = leerTexto(kp(`E${fila}`));
    if (o) e.observacion = o;
    return e;
  };
  libro.encuestas.lavado = encuesta(FILAS.encuestas.lavado, "lavado");
  libro.encuestas.servicio = encuesta(FILAS.encuestas.servicio, "servicio");
  for (const [clave, fila, titulo] of [
    ["reprocesos", FILAS.controles.reprocesos, "Reprocesos"],
    ["reclamaciones", FILAS.controles.reclamaciones, "Reclamaciones"],
    ["danos", FILAS.controles.danos, "Daños imputables"],
  ] as const) {
    const n = numKpi(`B${fila}`, titulo);
    if (typeof n === "number") libro.controles[clave] = n;
  }
  asignar(libro.controles, "criterio", leerTexto(kp("B35")));

  // ---------------------------------------------------------------------------
  // Novedades
  // ---------------------------------------------------------------------------
  const conFecha = (d: Record<string, unknown>) => d.fecha;
  libro.incidencias = leerEventos(l, "Incidencias", COLS_INCIDENCIAS, FILAS.incidencias.desde, FILAS.incidencias.hasta, libro.anio, libro.avisos, conFecha);
  libro.retiros = leerEventos(l, "Retiros_importes", COLS_RETIROS, FILAS.retiros.desde, FILAS.retiros.hasta, libro.anio, libro.avisos, conFecha);
  libro.acciones = leerEventos(l, "Acciones", COLS_ACCIONES, FILAS.acciones.desde, FILAS.acciones.hasta, libro.anio, libro.avisos, conFecha);
  libro.mantenimiento = leerEventos(
    l,
    "Equipos",
    COLS_MANTENIMIENTO,
    FILAS.mantenimiento.desde,
    FILAS.mantenimiento.hasta,
    libro.anio,
    libro.avisos,
    // Se reparte por la planificada, como cuenta la hoja; un correctivo sin planificar, por la de ejecución.
    (d) => d.fecha_planificada || d.fecha_ejecutada
  );

  const eq = lectorHoja(l, "Equipos", libro.anio, libro.avisos);
  for (let fila = FILAS.equipos.desde; fila <= FILAS.equipos.hasta; fila++) {
    if (!eq.hayDatos(COLS_EQUIPOS, fila)) continue;
    const e: Record<string, unknown> = {};
    for (const c of sinCalculos(COLS_EQUIPOS)) e[c.key] = eq.leer(c, fila);
    libro.equipos.push({ fila, valor: e as unknown as Omit<FilaEquipo, "id"> });
  }

  // ---------------------------------------------------------------------------
  // Lavado y procesado
  // ---------------------------------------------------------------------------
  const lav = lectorHoja(l, "Lavado_detalle", libro.anio, libro.avisos);
  for (let fila = FILAS.lavado.desde; fila <= FILAS.lavado.hasta; fila++) {
    if (!lav.hayDatos(COLS_LAVADO, fila)) continue;
    const f: Record<string, unknown> = {};
    for (const c of sinCalculos(COLS_LAVADO)) f[c.key] = lav.leer(c, fila);
    libro.lavado.push({ fila, valor: f as unknown as FilaLavado });
  }
  const pro = lectorHoja(l, "Procesado_detalle", libro.anio, libro.avisos);
  for (let fila = FILAS.procesado.desde; fila <= FILAS.procesado.hasta; fila++) {
    if (!pro.hayDatos(COLS_PROCESADO, fila)) continue;
    const f: Record<string, unknown> = {};
    for (const c of sinCalculos(COLS_PROCESADO)) f[c.key] = pro.leer(c, fila);
    libro.procesado.push({ fila, valor: f as unknown as FilaProcesado });
  }

  const separar = <T extends { fecha: string | null }>(hoja: string, filas: FilaExcel<T>[]): FilaExcel<T>[] =>
    filas.filter(({ fila, valor }) => {
      if (delMes(valor.fecha)) return true;
      libro.noEntran.push({
        hoja,
        fila,
        texto: valor.fecha
          ? `La fecha ${textoDeFecha(valor.fecha)} no es de este mes.`
          : "No tiene fecha, y sin fecha no se sabe a qué día pertenece.",
      });
      return false;
    });
  libro.lavado = separar("Lavado_detalle", libro.lavado);
  libro.procesado = separar("Procesado_detalle", libro.procesado);

  const separarEventos = (hoja: string, filas: EventoExcel[]): EventoExcel[] =>
    filas.filter((e) => {
      if (delMes(e.fecha)) return true;
      libro.noEntran.push({
        hoja,
        fila: e.fila,
        texto: e.fecha
          ? `La fecha ${textoDeFecha(e.fecha)} no es de este mes.`
          : "No tiene fecha, y sin fecha no se sabe a qué mes pertenece.",
      });
      return false;
    });
  libro.incidencias = separarEventos("Incidencias", libro.incidencias);
  libro.retiros = separarEventos("Retiros_importes", libro.retiros);
  libro.acciones = separarEventos("Acciones", libro.acciones);
  libro.mantenimiento = separarEventos("Equipos", libro.mantenimiento);

  // ---------------------------------------------------------------------------
  // Inventario: bloques por día con su fecha por posición, porque A es una fórmula
  // ---------------------------------------------------------------------------
  const inv = (ref: string) => l.celda("Inventario", ref);
  const crudos: ConteoExcel[] = [];
  for (let dia = 1; dia <= 31; dia++) {
    for (let pos = 0; pos < FILAS.inventario.conteos; pos++) {
      const fila = filaInventario(dia, pos);
      const valores: Record<string, number> = {};
      PRENDAS_HOJA.forEach((prenda, i) => {
        const v = inv(`${LETRAS_PRENDAS[i]}${fila}`);
        const n = leerNumero(v);
        if (n === undefined) libro.avisos.push({ hoja: "Inventario", fila, texto: `«${leerTexto(v)}» en ${prenda} no es un número: la casilla queda vacía.` });
        else if (n !== null) valores[prenda] = n;
      });
      const observacion = leerTexto(inv(`L${fila}`));
      if (Object.keys(valores).length === 0 && !observacion) continue;
      const ubicacion = leerTexto(inv(`B${fila}`));
      if (dia > dias) {
        libro.noEntran.push({ hoja: "Inventario", fila, texto: `Este mes no tiene día ${dia}.` });
      } else if (!ubicacion) {
        libro.noEntran.push({ hoja: "Inventario", fila, texto: "Tiene conteos pero falta la ubicación." });
      } else {
        crudos.push({ fila, fecha: `${prefijo}${pad2(dia)}`, ubicacion, valores, observacion });
      }
    }
  }
  // Dos filas del mismo sitio el mismo día: la app guarda una, y elegir sería inventar.
  const porClave = new Map<string, ConteoExcel[]>();
  for (const c of crudos) {
    const k = `${c.fecha}|${normalizar(c.ubicacion)}`;
    porClave.set(k, [...(porClave.get(k) ?? []), c]);
  }
  for (const grupo of porClave.values()) {
    if (grupo.length === 1) {
      libro.conteos.push(grupo[0]);
    } else {
      libro.noEntran.push({
        hoja: "Inventario",
        fila: grupo[0].fila,
        texto: `Filas ${grupo.map((g) => g.fila).join(" y ")}: dos conteos de ${grupo[0].ubicacion} el ${textoDeFecha(grupo[0].fecha)}. Deja uno.`,
      });
    }
  }
  libro.conteos.sort((a, b) => a.fila - b.fila);

  PRENDAS_HOJA.forEach((_, i) => {
    const fila = FILAS.pactadas.desde + i;
    const prenda = leerTexto(inv(`A${fila}`)) || PRENDAS_HOJA[i];
    const n = leerNumero(inv(`B${fila}`));
    if (typeof n === "number") libro.pactadas[prenda] = n;
  });

  return libro;
};
