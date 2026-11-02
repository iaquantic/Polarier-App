import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileText, Loader2, Plus, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/context/RoleContext";
import {
  FilaEquipo,
  fueraDeServicio,
  hoyLocal,
  Num,
  pad2,
  rangoMes,
  Revision,
  REVISIONES,
} from "@/lib/control";
import {
  construirResumen,
  ControlMesData,
  controlMesVacio,
  EntradaKpi,
  EventoRegistro,
  heredarControlMes,
  HojaRevisada,
  leerControlMes,
  pactadasDeDotacion,
  sugerenciaKpi,
} from "@/lib/controlResumen";
import { buildInformeMes } from "@/lib/informeControl";
import { textoGuardado, useAutoguardado } from "@/hooks/useAutoguardado";
import {
  ControlEvento,
  getControlMesAnterior,
  saveControlMes,
  saveResumenMes,
  solicitarInformeMensual,
} from "@/services/audit";
import { cargarDatosMes, DatosMes, kpisDe, refrescarResumenMes } from "@/services/auditControl";
import InformePreview from "@/components/audit/InformePreview";
import TablaEventos from "@/components/audit/control/TablaEventos";
import {
  Bloque,
  BotonFila,
  BotonPrincipal,
  BotonSecundario,
  Caja,
  CabeceraTabla,
  Calculado,
  Campo,
  CampoAreaTexto,
  CampoNumero,
  CampoTexto,
  Celda,
  Chip,
  fmtCelda,
  Seg,
  tonoDe,
  Totales,
} from "@/components/audit/control/ui";

const uid = () => Math.random().toString(36).slice(2, 10);

const pct = (v: unknown): string =>
  typeof v === "number" ? `${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %` : String(v ?? "");

const claveMes = (anio: number, mes: number) => `${anio}-${pad2(mes)}`;

/** Lo que no se rellena a diario (`/auditoria/formularios/cierre?mes=AAAA-MM`). */
const AuditCierre = () => {
  const [sp] = useSearchParams();
  const hoy = hoyLocal();
  const clave = sp.get("mes") || hoy.slice(0, 7);
  return <CierreMes key={clave} clave={clave} />;
};

const CierreMes = ({ clave }: { clave: string }) => {
  const navigate = useNavigate();
  const { activeHotel } = useRole();
  const [anio, mes] = clave.split("-").map(Number);
  const rango = useMemo(() => rangoMes(anio, mes), [anio, mes]);

  const [datos, setDatos] = useState<DatosMes | null>(null);
  const [control, setControl] = useState<ControlMesData>(controlMesVacio);
  const [eventos, setEventos] = useState<ControlEvento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [informeOpen, setInformeOpen] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [, refrescoHora] = useState(0);

  useEffect(() => {
    if (!activeHotel) return;
    let vivo = true;
    (async () => {
      setCargando(true);
      try {
        const d = await cargarDatosMes(activeHotel.id, anio, mes);
        if (!vivo) return;
        setDatos(d);
        setEventos(d.eventos);
        if (d.fila && Object.keys(d.fila.data ?? {}).length > 0) {
          setControl(leerControlMes(d.fila.data));
        } else {
          // Mes nuevo: hereda del último mes lo que no cambia. No se guarda hasta
          // que alguien toque algo, igual que un parte sin empezar.
          const previo = await getControlMesAnterior(activeHotel.id, anio, mes).catch(() => null);
          if (vivo) setControl(heredarControlMes(previo ? leerControlMes(previo.data) : null));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error cargando el mes");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [activeHotel?.id, anio, mes]);

  const calcularResumen = (c: ControlMesData, evs: ControlEvento[]) =>
    datos
      ? construirResumen({
          anio,
          mes,
          partes: datos.partes,
          control: c,
          eventos: evs as unknown as EventoRegistro[],
          prendas: datos.prendas,
          ubicaciones: datos.ubicaciones,
          pactadas: pactadasDeDotacion(datos.dotacion),
          kpis: kpisDe(datos.def),
        })
      : null;

  // El Resumen va con cada guardado: lo lee la routine, que también dispara sola el
  // día 1 de cada mes, sin que nadie haya pulsado «Generar».
  const guardar = async (c: ControlMesData) => {
    if (activeHotel) await saveControlMes(activeHotel.id, anio, mes, c, calcularResumen(c, eventos));
  };
  const { estado, ultimo, marcarCambio, guardarAhora } = useAutoguardado(control, guardar, !!datos);

  useEffect(() => {
    const id = setInterval(() => refrescoHora((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const cambiar = (cambio: Partial<ControlMesData>) => {
    marcarCambio();
    setControl((c) => ({ ...c, ...cambio }));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resumen = useMemo(() => calcularResumen(control, eventos), [datos, control, eventos, anio, mes]);

  const delTipo = (t: ControlEvento["tipo"]) => eventos.filter((e) => e.tipo === t);
  const actualizarResumenGuardado = () => {
    if (activeHotel) void refrescarResumenMes(activeHotel.id, anio, mes);
  };
  const alCambiarEvento = (e: ControlEvento) => {
    setEventos((prev) => (prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [...prev, e]));
    actualizarResumenGuardado();
  };
  const alBorrarEvento = (id: string) => {
    setEventos((prev) => prev.filter((x) => x.id !== id));
    actualizarResumenGuardado();
  };

  const moverMes = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1);
    navigate(`/auditoria/formularios/cierre?mes=${claveMes(d.getFullYear(), d.getMonth() + 1)}`);
  };

  const generar = async () => {
    if (!activeHotel || !resumen) return;
    setPidiendo(true);
    try {
      marcarCambio();
      await guardarAhora();
      await saveResumenMes(activeHotel.id, anio, mes, resumen);
      const { disparada } = await solicitarInformeMensual(activeHotel.id, anio, mes);
      toast.success(
        disparada
          ? "Informe solicitado. Tarda un par de minutos en escribirse."
          : "Informe encolado. Se generará en la próxima pasada de la routine."
      );
      navigate(`/auditoria/historico/${clave}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo solicitar el informe");
    } finally {
      setPidiendo(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (!datos?.def || !resumen || !activeHotel) {
    return (
      <div className="p-6">
        <p className="neo-raised-sm rounded-[22px] p-5 text-sm text-muted-foreground">
          El cierre del mes todavía no está disponible para este hotel.
        </p>
      </div>
    );
  }

  const nombreMes = new Date(anio, mes - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const fechaEvento = hoyLocal() >= rango.primerDia && hoyLocal() <= rango.ultimoDia ? hoyLocal() : rango.ultimoDia;
  const rev = (h: HojaRevisada): Revision => control.revision[h] ?? "Pendiente";
  const setRev = (h: HojaRevisada, v: Revision) => cambiar({ revision: { ...control.revision, [h]: v } });

  const setKpi = (key: string, cambio: Partial<EntradaKpi>) =>
    cambiar({
      kpis: {
        ...control.kpis,
        [key]: { ...(control.kpis[key] ?? { cantidad: null, base: null, documento: "" }), ...cambio },
      },
    });

  const setEquipo = (id: string, cambio: Partial<FilaEquipo>) =>
    cambiar({ equipos: control.equipos.map((e) => (e.id === id ? { ...e, ...cambio } : e)) });

  const filasRevision: { hoja: HojaRevisada; nombre: string; detalle: string }[] = [
    {
      hoja: "operacion",
      nombre: "Jornada y lavado",
      detalle:
        resumen.operacion.diasPorCompletar.kg > 0
          ? `${resumen.operacion.diasPorCompletar.kg === 1 ? "Falta 1 día" : `Faltan ${resumen.operacion.diasPorCompletar.kg} días`} por cerrar. Validarlo bloquea los partes del mes.`
          : "Todos los días con dato. Validarlo bloquea los partes del mes.",
    },
    {
      hoja: "kpi",
      nombre: "Indicadores del SLA",
      detalle: `${resumen.kpis.filter((k) => k.resultado !== "Completar").length} de ${resumen.kpis.length} con datos.`,
    },
    {
      hoja: "incidencias",
      nombre: "Incidencias",
      detalle: `${delTipo("incidencia").length} registradas, ${
        delTipo("incidencia").filter((e) => (e.data as { estado?: string }).estado !== "Cerrada").length
      } abiertas.`,
    },
    {
      hoja: "equipos",
      nombre: "Equipos",
      detalle: `${control.equipos.length} equipos o grupos, ${fmtCelda(resumen.equipos.preventivosPrevistos)} preventivos previstos.`,
    },
    {
      hoja: "retiros",
      nombre: "Retiros e importes",
      detalle: `${delTipo("retiro").length} hechos.`,
    },
    {
      hoja: "acciones",
      nombre: "Acciones",
      detalle: `${fmtCelda(resumen.acciones.delMes)} acciones, ${fmtCelda(resumen.acciones.vencidas)} vencidas.`,
    },
  ];

  const plantillaKpi = "lg:grid-cols-[2.3fr_.85fr_.75fr_.6fr_.75fr_1.05fr_1fr]";
  const plantillaEquipo = "lg:grid-cols-[1.35fr_.5fr_.6fr_.55fr_1.2fr_1.2fr_1.2fr_.9fr_1.2fr_.7fr_24px]";

  const faltan: string[] = [];
  if (resumen.operacion.diasPorCompletar.kg > 0) {
    const n = resumen.operacion.diasPorCompletar.kg;
    faltan.push(`${n} ${n === 1 ? "día" : "días"} de Jornada`);
  }
  const kpisFaltan = resumen.kpis.filter((k) => k.resultado === "Completar").length;
  if (kpisFaltan > 0) faltan.push(`${kpisFaltan} KPI`);
  if (!control.sintesis.logros && !control.sintesis.dificultades && !control.sintesis.acuerdos) faltan.push("la síntesis");

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-4">
        <header className="neo-primary rounded-[22px] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold">
              Cierre del mes · {nombreMes.replace(/^./, (c) => c.toUpperCase())}
            </h1>
            <p className="text-sm font-medium opacity-80">{activeHotel.nombre} · Lo que no se rellena a diario</p>
          </div>
          <div className="flex items-center gap-2">
            <span aria-live="polite" className="text-xs font-bold bg-white/20 px-3 py-1.5 rounded-full">
              {textoGuardado(estado, ultimo)}
            </span>
            <button type="button" aria-label="Mes anterior" onClick={() => moverMes(-1)} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30">
              <ChevronLeft size={16} />
            </button>
            <button type="button" aria-label="Mes siguiente" onClick={() => moverMes(1)} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30">
              <ChevronRight size={16} />
            </button>
          </div>
        </header>

        <Bloque
          titulo="Revisión de los registros"
          ayuda="Declaración del representante. No sustituye comprobar los documentos del mes. «Sin actividad» significa que se comprobó que no hubo hechos que registrar."
        >
          {filasRevision.map((f) => (
            <div
              key={f.hoja}
              className="grid gap-2 lg:gap-3 grid-cols-1 lg:grid-cols-[1.1fr_2fr_auto] items-center rounded-[14px] bg-background/70 ring-1 ring-primary/15 px-3 py-2"
            >
              <span className="text-sm font-bold">{f.nombre}</span>
              <span className="text-xs font-medium text-muted-foreground">{f.detalle}</span>
              <Seg etiqueta={`Revisión de ${f.nombre}`} opciones={REVISIONES} valor={rev(f.hoja)} onChange={(v) => setRev(f.hoja, v)} />
            </div>
          ))}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground px-1">
            <span>
              Datos del mes: <Chip tono={tonoDe(resumen.revision[0].estado)}>{resumen.revision[0].estado}</Chip>
            </span>
            <span>
              Inventario (se calcula de los conteos):{" "}
              <Chip tono={tonoDe(resumen.inventario.estado)}>{resumen.inventario.estado}</Chip>
            </span>
          </div>
        </Bloque>

        <Bloque titulo="Datos del mes">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Campo label="Representante que informa" htmlFor="d-rep">
              <CampoTexto id="d-rep" value={control.datos.representante} onChange={(x) => cambiar({ datos: { ...control.datos, representante: x } })} />
            </Campo>
            <Campo label="Cargo" htmlFor="d-cargo">
              <CampoTexto id="d-cargo" value={control.datos.cargo} onChange={(x) => cambiar({ datos: { ...control.datos, cargo: x } })} />
            </Campo>
            <Campo label="Fecha de elaboración" htmlFor="d-fecha">
              <CampoTexto id="d-fecha" tipo="date" value={control.datos.fecha_elaboracion} onChange={(x) => cambiar({ datos: { ...control.datos, fecha_elaboracion: x } })} />
            </Campo>
            <Campo label="Personal efectivo del mes" htmlFor="d-personal">
              <CampoNumero id="d-personal" value={control.datos.personal} onChange={(x) => cambiar({ datos: { ...control.datos, personal: x } })} />
            </Campo>
            <Campo label="Fecha de aplicación del SLA" htmlFor="d-sla">
              <CampoTexto id="d-sla" tipo="date" value={control.datos.aplicacion_sla} onChange={(x) => cambiar({ datos: { ...control.datos, aplicacion_sla: x } })} />
            </Campo>
            <Campo label="Fin de la estabilización" htmlFor="d-estab">
              <CampoTexto id="d-estab" tipo="date" value={control.datos.fin_estabilizacion} onChange={(x) => cambiar({ datos: { ...control.datos, fin_estabilizacion: x } })} />
            </Campo>
            <Campo label="Acta de puesta en marcha" htmlFor="d-acta">
              <CampoTexto id="d-acta" value={control.datos.acta} onChange={(x) => cambiar({ datos: { ...control.datos, acta: x } })} />
            </Campo>
            <Campo label="Turnos y horarios acordados" htmlFor="d-turnos">
              <CampoTexto id="d-turnos" value={control.datos.turnos} onChange={(x) => cambiar({ datos: { ...control.datos, turnos: x } })} />
            </Campo>
          </div>
        </Bloque>

        <Bloque
          titulo="Indicadores del SLA"
          ayuda="Meta fija del SLA. Una base igual a 0 muestra «No aplica», que no cuenta como «Cumple». No se calcula un índice global porque el SLA no establece su ponderación."
          extra={<Totales items={[{ label: "Cumplen", valor: resumen.kpisCumplen }, { label: "Evaluados", valor: resumen.kpisEvaluados }]} />}
        >
          <CabeceraTabla plantilla={plantillaKpi} columnas={["Indicador", "Cantidad que se cumple", "Base", "Meta", "Resultado", "Cumplimiento", "Documento"]} />
          {resumen.kpis.some((k) => k.meta === null) && (
            <p className="text-xs font-semibold text-amber-800">
              Este hotel todavía no tiene cargadas las metas de su SLA: sin ellas no se puede decir si un indicador cumple.
            </p>
          )}
          {resumen.kpis.map((k) => {
            const sugerida = sugerenciaKpi(k.key, resumen);
            const yaUsada = sugerida && sugerida.cantidad === k.cantidadValor && sugerida.base === k.baseValor;
            return (
              <div key={k.key} className={`grid gap-1.5 grid-cols-2 items-end lg:items-center rounded-xl p-2 lg:py-1 bg-card/60 lg:bg-transparent lg:px-2.5 ${plantillaKpi}`}>
                <div className="col-span-2 lg:col-span-1 min-w-0">
                  <span className="text-sm font-bold">{k.nombre}</span>
                  <p className="text-[10.5px] font-medium text-muted-foreground leading-snug">
                    {k.cantidad} / {k.base}
                  </p>
                  {sugerida && !yaUsada && (
                    <BotonFila onClick={() => setKpi(k.key, { cantidad: sugerida.cantidad, base: sugerida.base })}>
                      Usar lo registrado: {fmtCelda(sugerida.cantidad)} de {fmtCelda(sugerida.base)}
                    </BotonFila>
                  )}
                </div>
                <Celda label="Cantidad que se cumple">
                  <CampoNumero etiqueta={`Cantidad que se cumple, ${k.nombre}`} tipo="decimal" value={k.cantidadValor} onChange={(x) => setKpi(k.key, { cantidad: x })} />
                </Celda>
                <Celda label="Base">
                  <CampoNumero etiqueta={`Base, ${k.nombre}`} tipo="decimal" value={k.baseValor} onChange={(x) => setKpi(k.key, { base: x })} />
                </Celda>
                <Celda label="Meta">
                  <span className="flex items-center justify-end h-10 text-sm font-bold">{k.meta === null ? "—" : pct(k.meta)}</span>
                </Celda>
                <Celda label="Resultado">
                  <Calculado className="text-xs">{pct(k.resultado)}</Calculado>
                </Celda>
                <Celda label="Cumplimiento">
                  <Chip tono={tonoDe(k.cumplimiento)}>{k.cumplimiento}</Chip>
                </Celda>
                <Celda label="Documento o registro" className="col-span-2 lg:col-span-1">
                  <CampoTexto etiqueta={`Documento, ${k.nombre}`} value={k.documento} onChange={(x) => setKpi(k.key, { documento: x })} />
                </Celda>
              </div>
            );
          })}
        </Bloque>

        <Bloque titulo="Calidad percibida y controles" ayuda="Introduce 0 si comprobaste que no hubo casos. La cantidad de encuestas y su escala deben acompañar las puntuaciones.">
          <div className="grid gap-3.5 lg:grid-cols-[1.4fr_1fr]">
            <Caja>
              {(["lavado", "servicio"] as const).map((a) => {
                const e = control.encuestas[a];
                const set = (cambio: Partial<typeof e>) =>
                  cambiar({ encuestas: { ...control.encuestas, [a]: { ...e, ...cambio } } });
                return (
                  <div key={a} className="grid gap-2 grid-cols-2 lg:grid-cols-[.7fr_.8fr_.7fr_1fr_1.4fr] items-end">
                    <span className="col-span-2 lg:col-span-1 text-sm font-bold capitalize lg:pb-2.5">{a}</span>
                    <Campo label="Puntuación media">
                      <CampoNumero etiqueta={`Puntuación, ${a}`} tipo="decimal" value={e.puntuacion} onChange={(x) => set({ puntuacion: x })} />
                    </Campo>
                    <Campo label="Encuestas">
                      <CampoNumero etiqueta={`Encuestas, ${a}`} value={e.encuestas} onChange={(x) => set({ encuestas: x })} />
                    </Campo>
                    <Campo label="Documento">
                      <CampoTexto etiqueta={`Documento, ${a}`} value={e.documento} onChange={(x) => set({ documento: x })} />
                    </Campo>
                    <Campo label="Observación">
                      <CampoTexto etiqueta={`Observación, ${a}`} value={e.observacion} onChange={(x) => set({ observacion: x })} />
                    </Campo>
                  </div>
                );
              })}
            </Caja>
            <Caja>
              <div className="grid gap-2.5 grid-cols-3">
                <Campo label="Reprocesos (pzs)" htmlFor="q-rep">
                  <CampoNumero id="q-rep" value={control.controles.reprocesos} onChange={(x) => cambiar({ controles: { ...control.controles, reprocesos: x } })} />
                </Campo>
                <Campo label="Reclamaciones" htmlFor="q-recl">
                  <CampoNumero id="q-recl" value={control.controles.reclamaciones} onChange={(x) => cambiar({ controles: { ...control.controles, reclamaciones: x } })} />
                </Campo>
                <Campo label="Daños imputables (pzs)" htmlFor="q-danos">
                  <CampoNumero id="q-danos" value={control.controles.danos} onChange={(x) => cambiar({ controles: { ...control.controles, danos: x } })} />
                </Campo>
              </div>
              <Campo label="Criterio acordado con el hotel" htmlFor="q-crit">
                <CampoTexto id="q-crit" value={control.controles.criterio} onChange={(x) => cambiar({ controles: { ...control.controles, criterio: x } })} />
              </Campo>
            </Caja>
          </div>
        </Bloque>

        <Bloque
          titulo="Estado técnico y mantenimiento"
          ayuda="La lista de equipos se copia del mes anterior: solo se cambia lo que haya variado. Los operativos al cierre no equivalen a la disponibilidad técnica de todo el mes."
          extra={
            <Totales
              items={[
                { label: "Total", valor: resumen.equipos.total },
                { label: "Operativos", valor: resumen.equipos.operativos },
                { label: "Fuera de servicio", valor: resumen.equipos.fueraServicio },
              ]}
            />
          }
        >
          {control.equipos.length > 0 && (
            <CabeceraTabla
              plantilla={plantillaEquipo}
              columnas={["Equipo o grupo", "Total", "Operativos", "Fuera serv.", "Estado o causa", "Intervención del mes", "Pendiente y recurso", "Responsable", "Fecha prevista", "Parte técnico", ""]}
            />
          )}
          {control.equipos.map((e) => {
            const fuera = fueraDeServicio(e);
            return (
              <div key={e.id} className={`grid gap-1.5 grid-cols-3 items-end lg:items-center rounded-xl p-2 lg:py-0.5 bg-card/60 lg:bg-transparent lg:px-2.5 ${plantillaEquipo}`}>
                <Celda label="Equipo o grupo" className="col-span-3 lg:col-span-1">
                  <CampoTexto etiqueta="Equipo o grupo" value={e.nombre} onChange={(x) => setEquipo(e.id, { nombre: x })} />
                </Celda>
                <Celda label="Total">
                  <CampoNumero etiqueta={`Total, ${e.nombre}`} value={e.total} onChange={(x: Num) => setEquipo(e.id, { total: x })} />
                </Celda>
                <Celda label="Operativos">
                  <CampoNumero etiqueta={`Operativos, ${e.nombre}`} value={e.operativos} onChange={(x: Num) => setEquipo(e.id, { operativos: x })} />
                </Celda>
                <Celda label="Fuera serv.">
                  <Calculado tono={fuera === "Revisar" ? "mal" : undefined} className="text-xs">
                    {fuera === "" ? "—" : fuera}
                  </Calculado>
                </Celda>
                <Celda label="Estado o causa" className="col-span-3 lg:col-span-1">
                  <CampoTexto etiqueta={`Estado, ${e.nombre}`} value={e.estado_causa} onChange={(x) => setEquipo(e.id, { estado_causa: x })} />
                </Celda>
                <Celda label="Intervención del mes" className="col-span-3 lg:col-span-1">
                  <CampoTexto etiqueta={`Intervención, ${e.nombre}`} value={e.intervencion} onChange={(x) => setEquipo(e.id, { intervencion: x })} />
                </Celda>
                <Celda label="Pendiente y recurso" className="col-span-3 lg:col-span-1">
                  <CampoTexto etiqueta={`Pendiente, ${e.nombre}`} value={e.pendiente} onChange={(x) => setEquipo(e.id, { pendiente: x })} />
                </Celda>
                <Celda label="Responsable">
                  <CampoTexto etiqueta={`Responsable, ${e.nombre}`} value={e.responsable} onChange={(x) => setEquipo(e.id, { responsable: x })} />
                </Celda>
                <Celda label="Fecha prevista">
                  <CampoTexto etiqueta={`Fecha prevista, ${e.nombre}`} tipo="date" value={e.fecha_prevista ?? ""} onChange={(x) => setEquipo(e.id, { fecha_prevista: x || null })} />
                </Celda>
                <Celda label="Parte técnico">
                  <CampoTexto etiqueta={`Parte técnico, ${e.nombre}`} value={e.parte} onChange={(x) => setEquipo(e.id, { parte: x })} />
                </Celda>
                <button
                  type="button"
                  aria-label={`Quitar ${e.nombre}`}
                  onClick={() => cambiar({ equipos: control.equipos.filter((x) => x.id !== e.id) })}
                  className="flex items-center justify-center h-10 text-muted-foreground hover:text-destructive"
                >
                  <X size={15} />
                </button>
              </div>
            );
          })}
          <BotonSecundario
            className="self-start"
            onClick={() =>
              cambiar({
                equipos: [
                  ...control.equipos,
                  { id: uid(), nombre: "", total: null, operativos: null, estado_causa: "", intervencion: "", pendiente: "", responsable: "", fecha_prevista: null, parte: "" },
                ],
              })
            }
          >
            <Plus size={15} /> Añadir equipo o grupo
          </BotonSecundario>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
            <p className="text-sm font-bold">Mantenimiento del mes</p>
            <Totales
              items={[
                { label: "Preventivos previstos", valor: resumen.equipos.preventivosPrevistos },
                { label: "Ejecutados", valor: resumen.equipos.preventivosEjecutados },
              ]}
            />
          </div>
          <TablaEventos hotelId={activeHotel.id} tipo="mantenimiento" eventos={delTipo("mantenimiento")} fechaInicial={fechaEvento} rango={rango} onCambio={alCambiarEvento} onBorrado={alBorrarEvento} />
        </Bloque>

        <Bloque
          titulo="Incidencias del mes"
          ayuda="Las horas por causa pueden coincidir: no se suman para obtener el tiempo único de parada, que está en Jornada."
          extra={
            <Totales
              items={[
                { label: "Registradas", valor: resumen.incidencias.registradas },
                { label: "Cerradas", valor: resumen.incidencias.cerradas },
                { label: "Agua", valor: resumen.incidencias.horasAgua },
                { label: "Electricidad", valor: resumen.incidencias.horasElectricidad },
              ]}
            />
          }
        >
          <TablaEventos hotelId={activeHotel.id} tipo="incidencia" eventos={delTipo("incidencia")} fechaInicial={fechaEvento} rango={rango} onCambio={alCambiarEvento} onBorrado={alBorrarEvento} />
        </Bloque>

        <Bloque
          titulo="Retiros, faltantes, mal uso e importes"
          ayuda="El importe es cantidad × precio. Las monedas nunca se suman entre sí. Solo cuenta como conciliado si está marcado y tiene acta. Si el precio está pendiente, déjalo vacío."
        >
          <TablaEventos hotelId={activeHotel.id} tipo="retiro" eventos={delTipo("retiro")} fechaInicial={fechaEvento} rango={rango} onCambio={alCambiarEvento} onBorrado={alBorrarEvento} />
          <div className="grid gap-3.5 lg:grid-cols-2">
            {[
              { titulo: "Moneda", filas: resumen.retiros.porMoneda, cols: ["Calculado", "Conciliado", "Sin conciliar"] },
              { titulo: "Concepto", filas: resumen.retiros.porConcepto, cols: ["Piezas", "Conciliadas", "Sin conciliar"] },
            ].map((g) => (
              <Caja key={g.titulo}>
                <div className="grid grid-cols-4 gap-1.5 polarier-head rounded-xl px-2.5 py-2">
                  {[g.titulo, ...g.cols].map((c) => (
                    <span key={c} className="text-[10.5px] font-extrabold">
                      {c}
                    </span>
                  ))}
                </div>
                {g.filas.map((f) => (
                  <div key={f.clave} className="grid grid-cols-4 gap-1.5 px-2.5 text-[12.5px] font-semibold tabular-nums">
                    <b>{f.clave}</b>
                    <span>{fmtCelda(f.calculado)}</span>
                    <span>{fmtCelda(f.conciliado)}</span>
                    <span>{fmtCelda(f.sinConciliar)}</span>
                  </div>
                ))}
              </Caja>
            ))}
          </div>
        </Bloque>

        <Bloque
          titulo="Acciones de mejora"
          ayuda="Una acción solo se marca Cerrada con resultado verificable y soporte. La situación se refiere al cierre del mes, no a la fecha de hoy."
          extra={
            <Totales
              items={[
                { label: "Del mes", valor: resumen.acciones.delMes },
                { label: "Cerradas", valor: resumen.acciones.cerradas },
                { label: "Vencidas al cierre", valor: resumen.acciones.vencidas },
              ]}
            />
          }
        >
          <TablaEventos hotelId={activeHotel.id} tipo="accion" eventos={delTipo("accion")} fechaInicial={fechaEvento} rango={rango} onCambio={alCambiarEvento} onBorrado={alBorrarEvento} />
        </Bloque>

        <Bloque
          titulo="Síntesis del mes para el informe"
          ayuda="Argumentos breves: qué ocurrió, su efecto y lo acordado. No hace falta repetir aquí las listas de incidencias o acciones."
        >
          <div className="grid gap-3.5 lg:grid-cols-3">
            <Campo label="Logros y resultados relevantes" htmlFor="s-logros">
              <CampoAreaTexto id="s-logros" value={control.sintesis.logros} onChange={(x) => cambiar({ sintesis: { ...control.sintesis, logros: x } })} />
            </Campo>
            <Campo label="Dificultades y efecto en el servicio" htmlFor="s-dif">
              <CampoAreaTexto id="s-dif" value={control.sintesis.dificultades} onChange={(x) => cambiar({ sintesis: { ...control.sintesis, dificultades: x } })} />
            </Campo>
            <Campo label="Acuerdos con el hotel y conclusión del mes" htmlFor="s-acu">
              <CampoAreaTexto id="s-acu" value={control.sintesis.acuerdos} onChange={(x) => cambiar({ sintesis: { ...control.sintesis, acuerdos: x } })} />
            </Campo>
          </div>
        </Bloque>

        <div className="neo-raised-sm rounded-[22px] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold text-muted-foreground min-w-0 flex-1 basis-56">
            {faltan.length > 0
              ? `Falta: ${faltan.join(", ")}. Se puede generar igual: lo pendiente sale como «Completar».`
              : "Todo informado."}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <BotonSecundario onClick={() => setInformeOpen(true)}>
              <FileText size={15} /> Ver resumen
            </BotonSecundario>
            <BotonPrincipal onClick={generar} disabled={pidiendo}>
              {pidiendo ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
              Generar informe mensual
            </BotonPrincipal>
          </div>
        </div>
      </div>

      {informeOpen && (
        <InformePreview
          informe={buildInformeMes({
            resumen,
            hotel: activeHotel.nombre,
            polo: activeHotel.polo?.nombre ?? undefined,
            eventos,
          })}
          fecha={clave}
          onClose={() => setInformeOpen(false)}
        />
      )}
    </div>
  );
};

export default AuditCierre;
