import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { hoyLocal, Jornada, Num, rangoMes } from "@/lib/control";
import {
  construirResumen,
  ControlMesData,
  controlMesVacio,
  EventoRegistro,
  heredarControlMes,
  InventarioDia,
  jornadaVacia,
  leerControlMes,
  leerParte,
  pactadasDeDotacion,
  ParteData,
  ResumenMes,
  totalesParte,
} from "@/lib/controlResumen";
import {
  filaLavadoNueva,
  filaProcesadoNueva,
  FilaLavadoHoja,
  FilaProcesadoHoja,
  filasLavadoDeParte,
  filasProcesadoDeParte,
  tandasDeFilas,
  uid,
  valesDeFilas,
} from "@/lib/controlHojas";
import { useAutoguardado } from "@/hooks/useAutoguardado";
import {
  ControlEvento,
  deleteEvento,
  FormSubmission,
  getControlMesAnterior,
  getEventosAbiertos,
  saveControlMes,
  saveEvento,
  saveResumenMes,
  saveSubmission,
  TipoEventoControl,
} from "@/services/audit";
import { cargarDatosMes, DatosMes, kpisDe } from "@/services/auditControl";

export interface FilaEvento {
  /** Estable aunque el evento todavía no tenga id en la base. */
  clave: string;
  tipo: TipoEventoControl;
  fecha: string | null;
  data: Record<string, unknown>;
}

interface Estado {
  lavado: FilaLavadoHoja[];
  procesado: FilaProcesadoHoja[];
  /** Solo lo propio, por fecha. Lo de otra persona está en `ajenos`. */
  jornadas: Record<string, Jornada>;
  inventarios: Record<string, InventarioDia>;
  control: ControlMesData;
  eventos: FilaEvento[];
}

const inventarioVacio = (): InventarioDia => ({ conteos: {}, observaciones: {}, extra: [] });

const eventoAFila = (e: ControlEvento): FilaEvento => ({ clave: e.id, tipo: e.tipo, fecha: e.fecha, data: e.data ?? {} });

/** El mantenimiento se reparte por la planificada; un correctivo sin planificar, por la de ejecución. */
export const fechaDeEvento = (tipo: TipoEventoControl, fecha: string | null, data: Record<string, unknown>): string | null =>
  tipo === "mantenimiento"
    ? ((data.fecha_planificada as string) || (data.fecha_ejecutada as string) || null)
    : fecha;

const parteDe = (e: Estado, fecha: string, miId: string | null): ParteData => ({
  jornada: e.jornadas[fecha] ?? jornadaVacia(),
  lavado: valesDeFilas(e.lavado.filter((f) => f.fecha === fecha && f.dueno === miId)),
  procesado: tandasDeFilas(e.procesado.filter((f) => f.fecha === fecha && f.dueno === miId)),
  inventario: e.inventarios[fecha] ?? inventarioVacio(),
});

/**
 * Un mes abierto como libro: las filas de cada hoja en memoria, y lo que se guarda
 * sigue siendo un parte por día. Solo se escribe lo que ha cambiado: cada guardado
 * manda los días tocados, no el mes entero, porque hay hasta 2000 registros.
 */
export const useLibroMes = (hotelId: string | undefined, nombreHotel: string, miId: string | null, anio: number, mes: number) => {
  const rango = useMemo(() => rangoMes(anio, mes), [anio, mes]);
  const [datos, setDatos] = useState<DatosMes | null>(null);
  const [ajenos, setAjenos] = useState<FormSubmission[]>([]);
  const [propias, setPropias] = useState<Set<string>>(new Set());
  const [estado, setEstado] = useState<Estado>({ lavado: [], procesado: [], jornadas: {}, inventarios: {}, control: controlMesVacio(), eventos: [] });
  const [abiertasAntes, setAbiertasAntes] = useState<ControlEvento[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const datosRef = useRef(datos);
  datosRef.current = datos;
  const ajenosRef = useRef(ajenos);
  ajenosRef.current = ajenos;

  const fechasSucias = useRef(new Set<string>());
  const controlSucio = useRef(false);
  const eventosSucios = useRef(new Set<string>());
  const eventosBorrados = useRef(new Set<string>());
  const idsEvento = useRef(new Map<string, string>());
  const cierres = useRef<Record<string, string>>({});
  const cola = useRef<Promise<unknown>>(Promise.resolve());

  const calcularResumen = useCallback(
    (e: Estado): ResumenMes | null => {
      const d = datosRef.current;
      if (!d) return null;
      const fechas = new Set<string>([
        ...Object.keys(e.jornadas),
        ...Object.keys(e.inventarios),
        ...e.lavado.filter((f) => f.dueno === miId).map((f) => f.fecha),
        ...e.procesado.filter((f) => f.dueno === miId).map((f) => f.fecha),
      ]);
      return construirResumen({
        anio,
        mes,
        partes: [
          ...Array.from(fechas, (fecha) => ({ fecha, data: parteDe(e, fecha, miId) })),
          ...ajenosRef.current,
        ],
        control: e.control,
        eventos: e.eventos.map((x) => ({
          id: x.clave,
          tipo: x.tipo,
          fecha: x.fecha,
          data: x.data,
        })) as unknown as EventoRegistro[],
        prendas: d.prendas,
        ubicaciones: d.ubicaciones,
        pactadas: pactadasDeDotacion(d.dotacion),
        kpis: kpisDe(d.def),
      });
    },
    [anio, mes, miId]
  );

  const volcar = useCallback(async () => {
    const d = datosRef.current;
    if (!d?.def || !hotelId) return;
    const e = estadoRef.current;
    const fechas = [...fechasSucias.current];
    const claves = [...eventosSucios.current];
    const borrados = [...eventosBorrados.current];
    const conControl = controlSucio.current;
    fechasSucias.current.clear();
    eventosSucios.current.clear();
    eventosBorrados.current.clear();
    controlSucio.current = false;
    const hechas = new Set<string>();
    const clavesHechas = new Set<string>();
    const borradosHechos = new Set<string>();
    let resumenAlDia = false;
    try {
      let mesCambia = claves.length > 0 || borrados.length > 0;
      for (const fecha of fechas) {
        const p = parteDe(e, fecha, miId);
        await saveSubmission({
          hotelId,
          formDefinitionId: d.def.id,
          fecha,
          estado: p.jornada.cierre === "Pendiente" ? "borrador" : "completado",
          data: p as unknown as Record<string, unknown>,
          totales: totalesParte(fecha, p, rango) as unknown as Record<string, unknown>,
        });
        hechas.add(fecha);
        // Un día abierto no cuenta en el mes: el Resumen solo cambia al cerrarlo, al
        // reabrirlo o al corregir uno ya cerrado.
        if (p.jornada.cierre !== "Pendiente" || (cierres.current[fecha] ?? "Pendiente") !== "Pendiente") mesCambia = true;
        cierres.current[fecha] = p.jornada.cierre;
      }
      for (const clave of claves) {
        const ev = e.eventos.find((x) => x.clave === clave);
        if (!ev) {
          clavesHechas.add(clave);
          continue;
        }
        const fecha = fechaDeEvento(ev.tipo, ev.fecha, ev.data);
        if (!fecha) {
          clavesHechas.add(clave);
          continue;
        }
        const guardado = await saveEvento({ id: idsEvento.current.get(clave), hotelId, tipo: ev.tipo, fecha, data: ev.data });
        idsEvento.current.set(clave, guardado.id);
        clavesHechas.add(clave);
      }
      for (const id of borrados) {
        await deleteEvento(id);
        borradosHechos.add(id);
      }
      if (conControl) {
        // El Resumen va con el documento: lo lee la routine, también sin que nadie pulse «Generar».
        await saveControlMes(hotelId, anio, mes, e.control, calcularResumen(e));
        resumenAlDia = true;
      } else if (mesCambia) {
        await saveResumenMes(hotelId, anio, mes, calcularResumen(e));
        resumenAlDia = true;
      }
    } catch (err) {
      for (const f of fechas) if (!hechas.has(f)) fechasSucias.current.add(f);
      for (const c of claves) if (!clavesHechas.has(c)) eventosSucios.current.add(c);
      for (const b of borrados) if (!borradosHechos.has(b)) eventosBorrados.current.add(b);
      if (conControl && !resumenAlDia) controlSucio.current = true;
      throw err;
    }
  }, [anio, calcularResumen, hotelId, mes, miId, rango]);

  // Uno detrás de otro: si no, un evento nuevo podría insertarse dos veces.
  const guardar = useCallback(async () => {
    const tarea = cola.current.catch(() => undefined).then(() => volcar());
    cola.current = tarea;
    await tarea;
  }, [volcar]);

  const { estado: estadoGuardado, ultimo, marcarCambio, guardarAhora, reiniciar } = useAutoguardado(estado, guardar, !!datos?.def);

  useEffect(() => {
    if (!hotelId) return;
    let vivo = true;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const d = await cargarDatosMes(hotelId, anio, mes);
        if (!vivo) return;
        const ordenadas = [...d.partes].sort((a, b) => a.fecha.localeCompare(b.fecha));
        const mias = ordenadas.filter((s) => s.user_id === miId);
        const otras = ordenadas.filter((s) => s.user_id !== miId);
        const leidas = ordenadas.map((s) => ({ s, parte: leerParte(s.data) }));
        let control = controlMesVacio();
        if (d.fila && Object.keys(d.fila.data ?? {}).length > 0) {
          control = leerControlMes(d.fila.data);
        } else {
          // Mes nuevo: hereda del último lo que no cambia. No se guarda hasta que alguien toque algo.
          const previo = await getControlMesAnterior(hotelId, anio, mes).catch(() => null);
          control = heredarControlMes(previo ? leerControlMes(previo.data) : null);
        }
        const abiertos = await getEventosAbiertos(hotelId).catch(() => [] as ControlEvento[]);
        if (!vivo) return;
        const jornadas: Record<string, Jornada> = {};
        const inventarios: Record<string, InventarioDia> = {};
        cierres.current = {};
        for (const { s, parte } of leidas) {
          if (s.user_id !== miId) continue;
          jornadas[s.fecha] = parte.jornada;
          inventarios[s.fecha] = parte.inventario;
          cierres.current[s.fecha] = parte.jornada.cierre;
        }
        idsEvento.current = new Map(d.eventos.map((x) => [x.id, x.id]));
        fechasSucias.current.clear();
        controlSucio.current = false;
        eventosSucios.current.clear();
        eventosBorrados.current.clear();
        reiniciar();
        datosRef.current = d;
        ajenosRef.current = otras;
        setDatos(d);
        setAjenos(otras);
        setPropias(new Set(mias.map((s) => s.fecha)));
        setAbiertasAntes(abiertos.filter((x) => x.fecha < rango.primerDia));
        setEstado({
          lavado: leidas.flatMap(({ s, parte }) => filasLavadoDeParte(s.fecha, parte, s.user_id)),
          procesado: leidas.flatMap(({ s, parte }) => filasProcesadoDeParte(s.fecha, parte, s.user_id)),
          jornadas,
          inventarios,
          control,
          eventos: d.eventos.map(eventoAFila),
        });
      } catch (err) {
        console.warn("No se pudo abrir el mes:", err);
        if (vivo) setError("No se ha podido abrir este mes.");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
    // `reiniciar` es estable y `rango` sale de anio y mes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, miId, anio, mes, intento]);

  // Que teclear no espere a recalcular el mes entero.
  const estadoDiferido = useDeferredValue(estado);
  const resumen = useMemo(
    () => (datos ? calcularResumen(estadoDiferido) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [datos, ajenos, estadoDiferido, calcularResumen]
  );

  const mesValidado = estado.control.revision.operacion === "Validado";
  const hayAjenos = ajenos.length > 0;

  /** Un día se edita si no hay un parte de otra persona o si ya tengo el mío. */
  const diaEditable = useCallback(
    (fecha: string) => !mesValidado && (propias.has(fecha) || !ajenos.some((s) => s.fecha === fecha)),
    [ajenos, mesValidado, propias]
  );

  const tocarFechas = useCallback(
    (...fechas: (string | null | undefined)[]) => {
      marcarCambio();
      for (const f of fechas) if (f) fechasSucias.current.add(f);
      setPropias((p) => {
        const nuevas = fechas.filter((f): f is string => !!f && !p.has(f));
        return nuevas.length ? new Set([...p, ...nuevas]) : p;
      });
    },
    [marcarCambio]
  );

  /** Fecha para una fila nueva: la que se pide, hoy si es de este mes, o el último día. */
  const fechaPorDefecto = useCallback(
    (pedida?: string | null) => {
      if (pedida) return pedida;
      const hoy = hoyLocal();
      return hoy >= rango.primerDia && hoy <= rango.ultimoDia ? hoy : rango.ultimoDia;
    },
    [rango]
  );

  /** Aplica un cambio ya: varias ediciones seguidas se apoyan en la anterior, no en lo último pintado. */
  const actualizar = useCallback((fn: (e: Estado) => Estado) => {
    const siguiente = fn(estadoRef.current);
    estadoRef.current = siguiente;
    setEstado(siguiente);
  }, []);

  const editarLavado = useCallback(
    (cambios: { id: string; cambio: Partial<FilaLavadoHoja> }[], fechaNueva?: string | null) => {
      const lavado = [...estadoRef.current.lavado];
      const tocadas: (string | null | undefined)[] = [];
      for (const { id, cambio } of cambios) {
        const i = lavado.findIndex((f) => f.id === id);
        if (i >= 0) {
          tocadas.push(lavado[i].fecha, cambio.fecha);
          lavado[i] = { ...lavado[i], ...cambio };
        } else {
          const nueva = { ...filaLavadoNueva(id, fechaPorDefecto(fechaNueva), miId), ...cambio };
          tocadas.push(nueva.fecha);
          lavado.push(nueva);
        }
      }
      tocarFechas(...tocadas);
      actualizar((e) => ({ ...e, lavado }));
    },
    [actualizar, fechaPorDefecto, miId, tocarFechas]
  );

  const editarProcesado = useCallback(
    (cambios: { id: string; cambio: Partial<FilaProcesadoHoja> }[], fechaNueva?: string | null) => {
      const procesado = [...estadoRef.current.procesado];
      const tocadas: (string | null | undefined)[] = [];
      for (const { id, cambio } of cambios) {
        const i = procesado.findIndex((f) => f.id === id);
        if (i >= 0) {
          tocadas.push(procesado[i].fecha, cambio.fecha);
          procesado[i] = { ...procesado[i], ...cambio };
        } else {
          const nueva = { ...filaProcesadoNueva(id, fechaPorDefecto(fechaNueva), miId), ...cambio };
          tocadas.push(nueva.fecha);
          procesado.push(nueva);
        }
      }
      tocarFechas(...tocadas);
      actualizar((e) => ({ ...e, procesado }));
    },
    [actualizar, fechaPorDefecto, miId, tocarFechas]
  );

  const borrarLavado = useCallback(
    (id: string) => {
      const fila = estadoRef.current.lavado.find((f) => f.id === id);
      if (!fila) return;
      tocarFechas(fila.fecha);
      actualizar((e) => ({ ...e, lavado: e.lavado.filter((f) => f.id !== id) }));
    },
    [actualizar, tocarFechas]
  );

  const borrarProcesado = useCallback(
    (id: string) => {
      const fila = estadoRef.current.procesado.find((f) => f.id === id);
      if (!fila) return;
      tocarFechas(fila.fecha);
      actualizar((e) => ({ ...e, procesado: e.procesado.filter((f) => f.id !== id) }));
    },
    [actualizar, tocarFechas]
  );

  const editarJornadas = useCallback(
    (cambios: { fecha: string; cambio: Partial<Jornada> }[]) => {
      tocarFechas(...cambios.map((c) => c.fecha));
      actualizar((e) => {
        const jornadas = { ...e.jornadas };
        for (const { fecha, cambio } of cambios) jornadas[fecha] = { ...(jornadas[fecha] ?? jornadaVacia()), ...cambio };
        return { ...e, jornadas };
      });
    },
    [actualizar, tocarFechas]
  );

  const editarInventarios = useCallback(
    (cambios: { fecha: string; ubicacion: string; prenda?: string; valor?: Num; observacion?: string; extra?: { id: string; nombre: string } }[]) => {
      tocarFechas(...cambios.map((c) => c.fecha));
      actualizar((e) => {
        const inventarios = { ...e.inventarios };
        for (const c of cambios) {
          const inv = inventarios[c.fecha] ?? inventarioVacio();
          const fila = { ...(inv.conteos[c.ubicacion] ?? {}) };
          if (c.prenda) {
            if (c.valor === null || c.valor === undefined) delete fila[c.prenda];
            else fila[c.prenda] = c.valor;
          }
          inventarios[c.fecha] = {
            conteos: c.prenda ? { ...inv.conteos, [c.ubicacion]: fila } : inv.conteos,
            observaciones: c.observacion !== undefined ? { ...inv.observaciones, [c.ubicacion]: c.observacion } : inv.observaciones,
            extra: c.extra && !inv.extra.some((x) => x.id === c.extra.id) ? [...inv.extra, c.extra] : inv.extra,
          };
        }
        return { ...e, inventarios };
      });
    },
    [actualizar, tocarFechas]
  );

  const editarControl = useCallback(
    (cambio: Partial<ControlMesData>) => {
      marcarCambio();
      controlSucio.current = true;
      actualizar((e) => ({ ...e, control: { ...e.control, ...cambio } }));
    },
    [actualizar, marcarCambio]
  );

  const editarEventos = useCallback(
    (cambios: { clave: string; tipo: TipoEventoControl; fecha?: string | null; data?: Record<string, unknown> }[], fechaNueva?: string | null) => {
      marcarCambio();
      for (const c of cambios) eventosSucios.current.add(c.clave);
      actualizar((e) => {
        const eventos = [...e.eventos];
        for (const c of cambios) {
          const i = eventos.findIndex((x) => x.clave === c.clave);
          if (i >= 0) {
            eventos[i] = {
              ...eventos[i],
              ...(c.fecha !== undefined ? { fecha: c.fecha } : {}),
              data: { ...eventos[i].data, ...(c.data ?? {}) },
            };
          } else {
            const base = fechaPorDefecto(fechaNueva);
            eventos.push({
              clave: c.clave,
              tipo: c.tipo,
              fecha: c.fecha ?? (c.tipo === "mantenimiento" ? null : base),
              data: { ...(c.tipo === "mantenimiento" ? { fecha_planificada: base } : {}), ...(c.data ?? {}) },
            });
          }
        }
        return { ...e, eventos };
      });
    },
    [actualizar, fechaPorDefecto, marcarCambio]
  );

  const borrarEvento = useCallback(
    (clave: string) => {
      marcarCambio();
      eventosSucios.current.delete(clave);
      const id = idsEvento.current.get(clave);
      if (id) eventosBorrados.current.add(id);
      idsEvento.current.delete(clave);
      actualizar((e) => ({ ...e, eventos: e.eventos.filter((x) => x.clave !== clave) }));
    },
    [actualizar, marcarCambio]
  );

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  return {
    cargando,
    error,
    recargar,
    anio,
    mes,
    rango,
    nombreHotel,
    hotelId,
    datos,
    ajenos,
    abiertasAntes,
    miId,
    lavado: estado.lavado,
    procesado: estado.procesado,
    jornadas: estado.jornadas,
    inventarios: estado.inventarios,
    control: estado.control,
    eventos: estado.eventos,
    resumen,
    mesValidado,
    hayAjenos,
    diaEditable,
    fechaPorDefecto,
    editarLavado,
    editarProcesado,
    borrarLavado,
    borrarProcesado,
    editarJornadas,
    editarInventarios,
    editarControl,
    editarEventos,
    borrarEvento,
    /** Id en la base de un evento ya guardado. */
    eventoGuardado: useCallback((clave: string) => idsEvento.current.get(clave) ?? null, []),
    /** El parte de un día tal como se guardaría. */
    parteDelDia: useCallback((fecha: string) => parteDe(estadoRef.current, fecha, miId), [miId]),
    estadoGuardado,
    ultimo,
    guardarAhora,
    calcularResumen: useCallback(() => calcularResumen(estadoRef.current), [calcularResumen]),
    nuevoId: uid,
  };
};

export type LibroMes = ReturnType<typeof useLibroMes>;
