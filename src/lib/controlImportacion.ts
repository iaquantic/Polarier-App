// -----------------------------------------------------------------------------
// Qué haría un Excel subido con los datos del mes, sin tocar nada todavía.
//
// Reglas (decisión de Leo, 2026-11-04):
// - Una casilla o un día vacío en el Excel nunca borra lo que hay en la app.
// - Lavado y procesado: el Excel sustituye solo los días que trae.
// - Jornada, datos del mes, KPI e inventario: casilla a casilla.
// - Incidencias, retiros, acciones y mantenimiento: sustituye las filas del mes si la
//   hoja trae alguna. Lo que no cambia conserva su id, así que subir dos veces el
//   mismo archivo no duplica nada.
// - Lo que no se puede guardar se lista con su fila: nada se descarta en silencio.
// -----------------------------------------------------------------------------
import {
  KPIS_SLA,
  Num,
  rangoMes,
  revisionLavado,
  revisionProcesado,
} from "@/lib/control";
import {
  ControlMesData,
  EntradaKpi,
  leerControlMes,
  ParteData,
  parteVacio,
  TipoEvento,
  UbicacionExtra,
} from "@/lib/controlResumen";
import { EventoExcel, LibroExcel } from "@/lib/controlExcel";
import {
  filasLavadoDeParte,
  filasProcesadoDeParte,
  FilaLavadoHoja,
  FilaProcesadoHoja,
  Hoja,
  normalizar,
  tandasDeFilas,
  uid,
  valesDeFilas,
} from "@/lib/controlHojas";

export interface EventoActual {
  id: string;
  tipo: TipoEvento;
  fecha: string;
  data: Record<string, unknown>;
}

export interface EstadoImportacion {
  anio: number;
  mes: number;
  hotel: string;
  /** Solo los partes de quien sube: los de otra persona no se pueden sustituir. */
  partes: Record<string, ParteData>;
  control: ControlMesData;
  eventos: EventoActual[];
  prendas: { id: string; nombre: string }[];
  ubicaciones: { id: string; nombre: string }[];
  /** Por id de prenda. */
  pactadas: Record<string, Num>;
  /** Por clave de KPI, las del SLA cargadas en el hotel. */
  metas: Record<string, Num>;
  mesValidado: boolean;
}

export interface ResumenHoja {
  hoja: Hoja;
  enExcel: string;
  nuevas: number;
  cambian: number;
  soloApp: number;
  que: string;
}

export interface Problema {
  hoja: string;
  fila?: number;
  texto: string;
}

export interface EventoNuevo {
  tipo: TipoEvento;
  fecha: string;
  data: Record<string, unknown>;
}

export interface PlanImportacion {
  /** Si hay alguno, no se puede seguir. */
  bloqueos: { texto: string; irAMes?: { anio: number; mes: number } }[];
  /** Nombre del hotel que dice el Excel si no parece este: hay que confirmarlo. */
  hotelDistinto: string | null;
  hojas: ResumenHoja[];
  dias: { fecha: string; hoja: Hoja; texto: string }[];
  noEntran: Problema[];
  avisos: Problema[];
  partes: { fecha: string; parte: ParteData }[];
  control: ControlMesData | null;
  eventos: { crear: EventoNuevo[]; borrar: string[] };
  cifras: { dias: number; diasConservados: number; registros: number; sinImportar: number };
  sinCambios: boolean;
}

/** Para comparar contenidos: sin ids, y vacío, nulo o ausente son lo mismo. */
export const huella = (v: unknown): string => {
  const limpiar = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(limpiar);
    if (x && typeof x === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(x).sort()) {
        if (k === "id" || k === "dueno") continue;
        const valor = limpiar((x as Record<string, unknown>)[k]);
        if (valor === null || valor === undefined || valor === "") continue;
        if (typeof valor === "object" && !Array.isArray(valor) && Object.keys(valor).length === 0) continue;
        out[k] = valor;
      }
      return out;
    }
    return x;
  };
  return JSON.stringify(limpiar(v));
};

const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const parteConDatos = (p: ParteData): boolean =>
  p.lavado.length > 0 ||
  p.procesado.length > 0 ||
  Object.values(p.inventario.conteos).some((f) => Object.values(f ?? {}).some((n) => typeof n === "number")) ||
  ["turistas", "entregadas", "horas_previstas", "horas_trabajadas", "parada"].some(
    (k) => typeof p.jornada[k as keyof typeof p.jornada] === "number"
  ) ||
  !!p.jornada.observacion ||
  p.jornada.cierre !== "Pendiente";

/** ¿El nombre del Excel puede ser este hotel? «Gran Muthu La Habana» y «Gran Muthu Habana» sí. */
const mismoHotel = (a: string, b: string): boolean => {
  const SOBRAN = new Set(["la", "el", "de", "del", "hotel"]);
  const trozos = (s: string) => normalizar(s).split(" ").filter((t) => t && !SOBRAN.has(t));
  const [x, y] = [trozos(a), trozos(b)];
  if (x.length === 0 || y.length === 0) return true;
  const [corto, largo] = x.length <= y.length ? [x, y] : [y, x];
  return corto.every((t) => largo.includes(t));
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const contarDiferencias = (a: unknown[], b: unknown[]) => {
  const comunes = Math.min(a.length, b.length);
  let cambian = 0;
  for (let i = 0; i < comunes; i++) if (huella(a[i]) !== huella(b[i])) cambian++;
  return { cambian, nuevas: Math.max(0, b.length - a.length), quitadas: Math.max(0, a.length - b.length) };
};

export const planificarImportacion = (libro: LibroExcel, e: EstadoImportacion): PlanImportacion => {
  const plan: PlanImportacion = {
    bloqueos: [],
    hotelDistinto: null,
    hojas: [],
    dias: [],
    noEntran: [...libro.noEntran],
    avisos: [...libro.avisos],
    partes: [],
    control: null,
    eventos: { crear: [], borrar: [] },
    cifras: { dias: 0, diasConservados: 0, registros: 0, sinImportar: 0 },
    sinCambios: true,
  };

  for (const texto of libro.errores) plan.bloqueos.push({ texto });
  if (plan.bloqueos.length) return plan;

  if (libro.anio !== e.anio || libro.mes !== e.mes) {
    const nombre = new Date(libro.anio, libro.mes - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    plan.bloqueos.push({ texto: `Este Excel es de ${nombre}.`, irAMes: { anio: libro.anio, mes: libro.mes } });
    return plan;
  }
  if (e.mesValidado) {
    plan.bloqueos.push({ texto: "Este mes está validado. Para subir otro Excel, pon Revisión del mes en Pendiente en la hoja Operacion." });
    return plan;
  }
  if (!mismoHotel(libro.hotel, e.hotel)) plan.hotelDistinto = libro.hotel;

  const rango = rangoMes(e.anio, e.mes);
  const modificados = new Map<string, ParteData>();
  const parteDe = (fecha: string): ParteData => {
    if (!modificados.has(fecha)) modificados.set(fecha, clonar(e.partes[fecha] ?? parteVacio()));
    return modificados.get(fecha);
  };

  // ---------------------------------------------------------------------------
  // Lavado y procesado: el Excel sustituye los días que trae
  // ---------------------------------------------------------------------------
  const tocarDetalle = <F extends { fecha: string }>(
    hoja: Hoja,
    filasExcel: { fila: number; valor: F }[],
    deParte: (fecha: string, p: ParteData) => F[],
    aplicar: (p: ParteData, filas: F[]) => void
  ): ResumenHoja => {
    const porDia = new Map<string, F[]>();
    for (const { valor } of filasExcel) porDia.set(valor.fecha, [...(porDia.get(valor.fecha) ?? []), valor]);
    let nuevas = 0;
    let cambian = 0;
    for (const [fecha, filas] of porDia) {
      const actuales = deParte(fecha, e.partes[fecha] ?? parteVacio());
      if (huella(actuales) === huella(filas)) continue;
      const d = contarDiferencias(actuales, filas);
      nuevas += d.nuevas;
      cambian += d.cambian + d.quitadas;
      if (actuales.length > 0) {
        plan.dias.push({
          fecha,
          hoja,
          texto: `En la app ${plural(actuales.length, "fila", "filas")}, en el Excel ${filasExcel.filter((x) => x.valor.fecha === fecha).length}.`,
        });
      }
      aplicar(parteDe(fecha), filas);
    }
    const soloApp = Object.entries(e.partes)
      .filter(([fecha]) => !porDia.has(fecha))
      .reduce((s, [fecha, p]) => s + deParte(fecha, p).length, 0);
    return {
      hoja,
      enExcel: plural(filasExcel.length, "fila", "filas"),
      nuevas,
      cambian,
      soloApp,
      que: filasExcel.length ? "Por día: el Excel sustituye ese día." : "El Excel no trae filas: no se toca nada.",
    };
  };

  const resumenLavado = tocarDetalle<FilaLavadoHoja>(
    "Lavado_detalle",
    libro.lavado.map(({ fila, valor }) => ({ fila, valor: { ...valor, id: uid(), dueno: null } })),
    (fecha, p) => filasLavadoDeParte(fecha, p, null),
    (p, filas) => {
      p.lavado = valesDeFilas(filas);
    }
  );
  const resumenProcesado = tocarDetalle<FilaProcesadoHoja>(
    "Procesado_detalle",
    libro.procesado.map(({ fila, valor }) => ({ fila, valor: { ...valor, id: uid(), dueno: null } })),
    (fecha, p) => filasProcesadoDeParte(fecha, p, null),
    (p, filas) => {
      p.procesado = tandasDeFilas(filas);
    }
  );

  // ---------------------------------------------------------------------------
  // Operacion: casilla a casilla
  // ---------------------------------------------------------------------------
  const resumenOperacion: ResumenHoja = {
    hoja: "Operacion",
    enExcel: plural(libro.jornadas.length, "día", "días"),
    nuevas: 0,
    cambian: 0,
    soloApp: 0,
    que: "Casilla a casilla. Lo vacío no borra.",
  };
  const fechasJornada = new Set<string>();
  for (const { valor } of libro.jornadas) {
    const { fecha, ...campos } = valor;
    fechasJornada.add(fecha);
    const actual = (e.partes[fecha] ?? parteVacio()).jornada;
    const distinto = Object.entries(campos).some(([k, v]) => actual[k as keyof typeof actual] !== v);
    if (!distinto) continue;
    const habia = !!e.partes[fecha] && huella({ ...actual, cierre: null }) !== "{}";
    if (habia) resumenOperacion.cambian++;
    else resumenOperacion.nuevas++;
    const p = parteDe(fecha);
    p.jornada = { ...p.jornada, ...campos };
  }
  resumenOperacion.soloApp = Object.entries(e.partes).filter(
    ([fecha, p]) => !fechasJornada.has(fecha) && huella({ ...p.jornada, cierre: null }) !== "{}"
  ).length;

  // ---------------------------------------------------------------------------
  // Inventario: casilla a casilla; lo vacío conserva el último dato
  // ---------------------------------------------------------------------------
  const idUbicacion = new Map(e.ubicaciones.map((u) => [normalizar(u.nombre), u.id]));
  const extrasPrevias: UbicacionExtra[] = Object.values(e.partes).flatMap((p) => p.inventario.extra);
  const idExtra = new Map(extrasPrevias.map((x) => [normalizar(x.nombre), x]));
  const idPrenda = new Map(e.prendas.map((p) => [normalizar(p.nombre), p.id]));
  const resumenInventario: ResumenHoja = {
    hoja: "Inventario",
    enExcel: plural(libro.conteos.length, "conteo", "conteos"),
    nuevas: 0,
    cambian: 0,
    soloApp: 0,
    que: "Casilla a casilla. Lo vacío conserva el último dato.",
  };
  const contados = new Set<string>();
  const nombresAparte = new Set<string>();
  const prendasSinCatalogo = new Set<string>();
  for (const c of libro.conteos) {
    const clave = normalizar(c.ubicacion);
    let id = idUbicacion.get(clave);
    let extra: UbicacionExtra | null = null;
    if (!id) {
      extra = idExtra.get(clave) ?? { id: `extra-${clave.replace(/ /g, "-")}`, nombre: c.ubicacion };
      idExtra.set(clave, extra);
      id = extra.id;
      nombresAparte.add(c.ubicacion);
    }
    contados.add(`${c.fecha}|${id}`);
    const actual = e.partes[c.fecha]?.inventario;
    const filaActual = actual?.conteos[id] ?? {};
    const valores: Record<string, Num> = {};
    for (const [prenda, n] of Object.entries(c.valores)) {
      const idP = idPrenda.get(normalizar(prenda));
      if (idP) valores[idP] = n;
      else prendasSinCatalogo.add(prenda);
    }
    const cambiaValor = Object.entries(valores).some(([k, v]) => filaActual[k] !== v);
    const cambiaObs = !!c.observacion && actual?.observaciones[id] !== c.observacion;
    if (!cambiaValor && !cambiaObs) continue;
    if (Object.values(filaActual).some((v) => typeof v === "number")) resumenInventario.cambian++;
    else resumenInventario.nuevas++;
    const p = parteDe(c.fecha);
    p.inventario.conteos[id] = { ...(p.inventario.conteos[id] ?? {}), ...valores };
    if (c.observacion) p.inventario.observaciones[id] = c.observacion;
    if (extra && !p.inventario.extra.some((x) => x.id === extra.id)) p.inventario.extra.push(extra);
  }
  for (const [fecha, p] of Object.entries(e.partes)) {
    for (const [id, fila] of Object.entries(p.inventario.conteos)) {
      if (!contados.has(`${fecha}|${id}`) && Object.values(fila ?? {}).some((v) => typeof v === "number")) {
        resumenInventario.soloApp++;
      }
    }
  }
  for (const nombre of nombresAparte) {
    plan.avisos.push({ hoja: "Inventario", texto: `«${nombre}» no está en el catálogo del hotel: se guarda como ubicación aparte.` });
  }
  for (const prenda of prendasSinCatalogo) {
    plan.noEntran.push({ hoja: "Inventario", texto: `La prenda «${prenda}» no está en el catálogo del hotel: su columna no entra.` });
  }

  // ---------------------------------------------------------------------------
  // Documento del mes: casilla a casilla
  // ---------------------------------------------------------------------------
  const control = leerControlMes(clonar(e.control));
  let cambioControl = false;
  const mezclar = <T extends object>(destino: T, origen: Partial<T>) => {
    let nuevas = 0;
    let cambian = 0;
    for (const [k, v] of Object.entries(origen)) {
      const actual = (destino as Record<string, unknown>)[k];
      if (actual === v) continue;
      if (actual === null || actual === undefined || actual === "") nuevas++;
      else cambian++;
      (destino as Record<string, unknown>)[k] = v;
      cambioControl = true;
    }
    return { nuevas, cambian };
  };

  const datos = mezclar(control.datos, libro.datos);
  const sintesis = mezclar(control.sintesis, libro.sintesis);
  const totalDatos = Object.keys(libro.datos).length + Object.keys(libro.sintesis).length;
  const resumenDatos: ResumenHoja = {
    hoja: "Datos_mes",
    enExcel: plural(totalDatos, "dato", "datos"),
    nuevas: datos.nuevas + sintesis.nuevas,
    cambian: datos.cambian + sintesis.cambian,
    soloApp: 0,
    que: "Rellena lo vacío y cambia lo distinto.",
  };

  const revision = mezclar(control.revision, libro.revision);
  if (libro.revision.operacion === "Validado") {
    plan.avisos.push({ hoja: "Operacion", fila: 7, texto: "El Excel marca Revisión del mes como Validado: el mes quedará bloqueado al subirlo." });
  }

  let kpiNuevas = 0;
  let kpiCambian = 0;
  for (const k of KPIS_SLA) {
    const entrada = libro.kpis[k.key];
    if (!entrada) continue;
    const actual: EntradaKpi = control.kpis[k.key] ?? { cantidad: null, base: null, documento: "" };
    const mezcla = { ...actual, ...entrada };
    if (huella(actual) === huella(mezcla)) continue;
    if (huella(actual) === "{}") kpiNuevas++;
    else kpiCambian++;
    control.kpis = { ...control.kpis, [k.key]: mezcla };
    cambioControl = true;
  }
  const lav = mezclar(control.encuestas.lavado, libro.encuestas.lavado);
  const ser = mezclar(control.encuestas.servicio, libro.encuestas.servicio);
  const cts = mezclar(control.controles, libro.controles);
  const resumenKpi: ResumenHoja = {
    hoja: "KPI_calidad",
    enExcel: plural(Object.keys(libro.kpis).length, "KPI", "KPI"),
    nuevas: kpiNuevas + lav.nuevas + ser.nuevas + cts.nuevas,
    cambian: kpiCambian + lav.cambian + ser.cambian + cts.cambian,
    soloApp: 0,
    que: libro.kpiConBase ? "Cantidad, base, documento, encuestas y controles." : "Cantidad, documento, encuestas y controles: este Excel no trae la base.",
  };
  if (!libro.kpiConBase) {
    plan.avisos.push({
      hoja: "KPI_calidad",
      texto: "Este Excel no trae la columna Base: los KPI entran con su cantidad y siguen en «Completar» hasta poner la base.",
    });
  }
  for (const k of KPIS_SLA) {
    const enExcel = libro.metas[k.key];
    const cargada = e.metas[k.key];
    if (typeof enExcel === "number" && typeof cargada === "number" && Math.abs(enExcel - cargada) > 1e-9) {
      plan.avisos.push({ hoja: "KPI_calidad", texto: `La meta de ${k.nombre} no coincide con la del SLA cargada: se mantiene la cargada.` });
    }
  }

  // Equipos: la lista entera si la hoja trae alguna fila.
  const resumenEquipos: ResumenHoja = {
    hoja: "Equipos",
    enExcel: `${plural(libro.equipos.length, "equipo", "equipos")} y ${plural(libro.mantenimiento.length, "tarea", "tareas")}`,
    nuevas: 0,
    cambian: 0,
    soloApp: 0,
    que: "Equipos y tareas de mantenimiento: si la hoja trae filas, sustituyen a las del mes.",
  };
  if (libro.equipos.length > 0) {
    const nuevos = libro.equipos.map(({ valor }, i) => ({ ...valor, id: control.equipos[i]?.id ?? uid() }));
    if (huella(nuevos) !== huella(control.equipos)) {
      const d = contarDiferencias(control.equipos, nuevos);
      resumenEquipos.nuevas += d.nuevas;
      resumenEquipos.cambian += d.cambian + d.quitadas;
      control.equipos = nuevos;
      cambioControl = true;
    }
  } else {
    resumenEquipos.soloApp += control.equipos.length;
  }
  if (cambioControl || revision.nuevas + revision.cambian > 0) plan.control = control;

  // ---------------------------------------------------------------------------
  // Novedades: las coincidentes se quedan como están
  // ---------------------------------------------------------------------------
  const planEventos = (tipo: TipoEvento, filas: EventoExcel[]) => {
    const actuales = e.eventos.filter((x) => x.tipo === tipo);
    if (filas.length === 0) return { nuevas: 0, cambian: 0, soloApp: actuales.length };
    const libres = [...actuales];
    const crear: EventoNuevo[] = [];
    for (const f of filas) {
      const firma = huella({ fecha: f.fecha, data: f.data });
      const i = libres.findIndex((a) => huella({ fecha: a.fecha, data: a.data }) === firma);
      if (i >= 0) libres.splice(i, 1);
      else crear.push({ tipo, fecha: f.fecha, data: f.data });
    }
    plan.eventos.crear.push(...crear);
    plan.eventos.borrar.push(...libres.map((a) => a.id));
    return {
      nuevas: Math.max(0, crear.length - libres.length),
      cambian: Math.max(crear.length, libres.length) - Math.max(0, crear.length - libres.length),
      soloApp: 0,
    };
  };
  const SUSTITUYEN = "Las del mes se sustituyen por las del Excel.";
  const NO_TRAE = "El Excel no trae filas: no se toca nada.";
  const inc = planEventos("incidencia", libro.incidencias);
  const ret = planEventos("retiro", libro.retiros);
  const acc = planEventos("accion", libro.acciones);
  const man = planEventos("mantenimiento", libro.mantenimiento);
  resumenEquipos.nuevas += man.nuevas;
  resumenEquipos.cambian += man.cambian;
  resumenEquipos.soloApp += man.soloApp;

  // ---------------------------------------------------------------------------
  // Avisos que no cambian nada
  // ---------------------------------------------------------------------------
  for (const [nombre, n] of Object.entries(libro.pactadas)) {
    const id = idPrenda.get(normalizar(nombre));
    const dotacion = id ? e.pactadas[id] : null;
    if (typeof dotacion === "number" && dotacion !== n) {
      plan.avisos.push({
        hoja: "Inventario",
        texto: `Prendas pactadas de ${nombre}: el Excel dice ${n} y la dotación del hotel ${dotacion}. Se mantiene la dotación.`,
      });
    }
  }
  const porRevisar =
    libro.lavado.filter(({ valor }) => ["Revisar", "Completar"].includes(revisionLavado(valor, rango))).length;
  if (porRevisar > 0) {
    plan.avisos.push({ hoja: "Lavado_detalle", texto: `${plural(porRevisar, "fila sale", "filas salen")} como «Revisar» o «Completar». Entran igual y se ven así en la hoja.` });
  }
  const porRevisarP = libro.procesado.filter(({ valor }) =>
    ["Revisar", "Completar", "Revisar diferencia"].includes(revisionProcesado(valor, rango))
  ).length;
  if (porRevisarP > 0) {
    plan.avisos.push({ hoja: "Procesado_detalle", texto: `${plural(porRevisarP, "fila sale", "filas salen")} como «Revisar» o «Completar». Entran igual y se ven así en la hoja.` });
  }

  plan.hojas = [
    resumenDatos,
    resumenOperacion,
    resumenKpi,
    {
      hoja: "Incidencias",
      enExcel: plural(libro.incidencias.length, "fila", "filas"),
      ...inc,
      que: libro.incidencias.length ? SUSTITUYEN : NO_TRAE,
    },
    resumenEquipos,
    {
      hoja: "Retiros_importes",
      enExcel: plural(libro.retiros.length, "fila", "filas"),
      ...ret,
      que: libro.retiros.length ? SUSTITUYEN : NO_TRAE,
    },
    {
      hoja: "Acciones",
      enExcel: plural(libro.acciones.length, "fila", "filas"),
      ...acc,
      que: libro.acciones.length ? SUSTITUYEN : NO_TRAE,
    },
    resumenLavado,
    resumenProcesado,
    resumenInventario,
  ];

  plan.partes = Array.from(modificados, ([fecha, parte]) => ({ fecha, parte })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  plan.dias.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const fechasTocadas = new Set(plan.partes.map((p) => p.fecha));
  plan.cifras = {
    dias: plan.partes.length,
    diasConservados: Object.entries(e.partes).filter(([f, p]) => !fechasTocadas.has(f) && parteConDatos(p)).length,
    registros: libro.lavado.length + libro.procesado.length,
    sinImportar: plan.noEntran.length,
  };
  plan.sinCambios = plan.partes.length === 0 && !plan.control && plan.eventos.crear.length === 0 && plan.eventos.borrar.length === 0;
  return plan;
};
