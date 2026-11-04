import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  CalendarDays,
  Clock,
  Coins,
  Droplets,
  Eye,
  Layers,
  ListChecks,
  Loader2,
  ShieldCheck,
  Shirt,
  Smile,
  Users,
  Weight,
  Wrench,
} from "lucide-react";
import polarierLogo from "@/assets/polarier-logo.png";
import { useRole } from "@/context/RoleContext";
import {
  FormSubmission,
  getSubmissionHistory,
  getDefinicionControl,
} from "@/services/audit";
import { cargarDatosMes, resumenDe } from "@/services/auditControl";
import { hoyLocal } from "@/lib/control";
import { COLOR_ESTADO, ETIQUETA_ESTADO, etiquetaMes, mesesDisponibles } from "@/lib/dashboard";
import { AlertaControl, construirDashboardMes, DashboardMes, DiaSerie } from "@/lib/controlDashboard";
import { Chip, fmtCelda, tonoDe } from "@/components/audit/control/ui";
import { AlertaCard, Kpi, Panel } from "@/components/audit/DashboardControl";

// -----------------------------------------------------------------------------
// Dashboard del formulario unificado: la hoja Resumen del Excel más la serie diaria
// y los avisos. Las cifras vienen de `construirResumen`; aquí solo se pintan, y lo
// pendiente se enseña como «Completar», no como 0. Un dashboard por hotel y por mes.
// -----------------------------------------------------------------------------

// Paleta de marcas comprobada contra la superficie del módulo (contraste y daltonismo).
const AZUL_MARCA = "#4552A8";
const AMBAR_MARCA = "#C07A10";
const ROJO_MARCA = "#B3261E";

const pct = (v: unknown): string =>
  typeof v === "number" ? `${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %` : String(v ?? "");

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.35)",
} as const;

const TooltipDia = ({ active, payload }: { active?: boolean; payload?: { payload?: DiaSerie }[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as DiaSerie;
  return (
    <div style={tooltipStyle} className="px-3 py-2 text-xs">
      <p className="font-bold capitalize border-b border-border pb-1 mb-1">{d.fechaLarga}</p>
      {d.cierre === "Sin actividad" ? (
        <p>Sin actividad</p>
      ) : d.kg === null ? (
        <p>{d.futuro ? "Aún no ha llegado" : "Sin parte"}</p>
      ) : (
        <>
          <p>
            <b className="tabular-nums">{fmtCelda(d.kg, 1)}</b> kg{" "}
            <span className="text-muted-foreground">({ETIQUETA_ESTADO[d.estado]})</span>
          </p>
          {d.desvio !== null && (
            <p className="text-muted-foreground">
              {d.desvio >= 0 ? "+" : ""}
              {Math.round(d.desvio)} % frente al día típico
            </p>
          )}
        </>
      )}
    </div>
  );
};

const Mini = ({ items, columnas = 4 }: { items: { label: string; valor: unknown; dec?: number }[]; columnas?: number }) => (
  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
    {items.map((x) => {
      const texto = fmtCelda(x.valor, x.dec);
      const pendiente = typeof x.valor !== "number";
      return (
        <div key={x.label} className="rounded-xl bg-background/70 ring-1 ring-primary/15 px-2.5 py-2 min-w-0">
          <b className={`block font-extrabold tabular-nums truncate ${pendiente ? "text-xs py-1 text-amber-800" : "text-[17px] text-primary"}`}>
            {texto}
          </b>
          <span className="block text-[10.5px] font-bold leading-tight text-muted-foreground">{x.label}</span>
        </div>
      );
    })}
  </div>
);

const FilaTabla = ({
  celdas,
  plantilla,
  cabecera,
}: {
  celdas: React.ReactNode[];
  plantilla: string;
  cabecera?: boolean;
}) => (
  <div
    className={`grid gap-2 items-center py-1.5 tabular-nums ${
      cabecera
        ? "text-[10.5px] font-extrabold text-muted-foreground border-b-[1.5px] border-primary/30"
        : "text-[12.5px] font-semibold border-b border-primary/10"
    }`}
    style={{ gridTemplateColumns: plantilla }}
  >
    {celdas.map((c, i) => (
      <div
        key={i}
        className={`min-w-0 ${i > 0 && typeof c !== "object" ? "text-right" : ""} ${
          c === "Completar" ? "text-[10.5px] font-bold text-amber-800" : ""
        }`}
      >
        {c}
      </div>
    ))}
  </div>
);

const DashboardMensual = ({ onVerAntiguo }: { onVerAntiguo?: () => void }) => {
  const navigate = useNavigate();
  const { hotels, activeHotel, loading: roleLoading } = useRole();
  const [hotelId, setHotelId] = useState("");
  const [mesClave, setMesClave] = useState(hoyLocal().slice(0, 7));
  const [dash, setDash] = useState<DashboardMes | null>(null);
  const [historico, setHistorico] = useState<FormSubmission[]>([]);
  const [hayAntiguos, setHayAntiguos] = useState(false);
  const [loading, setLoading] = useState(true);

  const hotel = hotels.find((h) => h.id === hotelId) ?? activeHotel ?? null;

  useEffect(() => {
    if (activeHotel) setHotelId((prev) => prev || activeHotel.id);
  }, [activeHotel?.id]);

  useEffect(() => {
    if (!hotel) return;
    let vivo = true;
    (async () => {
      const [def, h] = await Promise.all([getDefinicionControl(hotel.id), getSubmissionHistory(hotel.id, 500)]);
      if (!vivo) return;
      const propios = def ? h.filter((s) => s.form_definition_id === def.id) : [];
      setHistorico(propios);
      setHayAntiguos(propios.length < h.length);
    })().catch((e) => console.warn(e));
    return () => {
      vivo = false;
    };
  }, [hotel?.id]);

  useEffect(() => {
    if (!hotel) return;
    const [anio, mes] = mesClave.split("-").map(Number);
    let vivo = true;
    (async () => {
      setLoading(true);
      try {
        const datos = await cargarDatosMes(hotel.id, anio, mes);
        if (!vivo) return;
        setDash(construirDashboardMes({ resumen: resumenDe(datos), partes: datos.partes, hoy: hoyLocal() }));
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [hotel?.id, mesClave]);

  const meses = useMemo(() => mesesDisponibles(historico), [historico]);
  const [anio, mes] = mesClave.split("-").map(Number);

  if (roleLoading || !hotel || (loading && !dash)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }
  if (!dash) return null;

  const { resumen: r, dias, mediana, alertas } = dash;
  const { operacion: o } = r;
  const faltan = o.diasPorCompletar.kg;
  const textoFaltan = faltan > 0 ? `Faltan ${faltan} días` : "Mes completo";

  const abrirDia = (a: AlertaControl) =>
    a.fecha ? () => navigate(`/auditoria/formularios?mes=${a.fecha.slice(0, 7)}&hoja=Operacion&fecha=${a.fecha}`) : undefined;

  const plantillaKpi = "minmax(0,2.1fr) .5fr .7fr minmax(0,1.5fr) 1.05fr";
  const plantillaArea = "minmax(0,1fr) minmax(52px,.8fr) minmax(52px,.7fr) minmax(52px,.7fr) minmax(0,1fr) 1fr";
  const plantillaInv = "minmax(0,1.4fr) .65fr .65fr minmax(0,1.4fr) .6fr";
  const plantillaConc = "repeat(4,minmax(0,1fr))";

  const maxSaldo = Math.max(1, ...r.articulos.map((a) => (typeof a.saldo === "number" ? Math.abs(a.saldo) : 0)));

  return (
    <div className="space-y-4">
      <div
        className="rounded-[22px] polarier-band px-5 py-4 border-b-4 border-accent flex flex-wrap items-center justify-between gap-4"
        style={{ boxShadow: "5px 5px 12px var(--neo-sd), -5px -5px 12px var(--neo-sl)" }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <img src={polarierLogo} alt="Polarier" className="h-9 shrink-0" />
          <div className="h-9 w-px bg-white/25 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight">Dashboard de control</h2>
            <p className="text-xs text-white/70 truncate">
              {hotel.polo?.nombre ? `${hotel.polo.nombre} · ` : ""}
              {hotel.nombre}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
            {o.diasConDato.kg} de {r.rango.dias} días con dato{faltan > 0 ? ": cifras parciales" : ""}
          </span>
          {hotels.length > 1 && (
            <select
              aria-label="Hotel"
              value={hotelId}
              onChange={(e) => setHotelId(e.target.value)}
              className="h-9 rounded-full bg-accent text-accent-foreground px-3 text-xs font-bold outline-none"
            >
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nombre}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Mes"
            value={mesClave}
            onChange={(e) => setMesClave(e.target.value)}
            className="h-9 rounded-full bg-accent text-accent-foreground px-3 text-xs font-bold outline-none"
          >
            {meses.map((m) => (
              <option key={m.clave} value={m.clave}>
                {etiquetaMes(m.anio, m.mes)}
              </option>
            ))}
          </select>
          {loading && <Loader2 className="animate-spin text-white/70" size={16} />}
        </div>
      </div>

      {!dash.hayDatos ? (
        <div className="neo-raised-sm rounded-[22px] p-8 text-center">
          <CalendarDays className="mx-auto text-accent mb-3" size={28} />
          <p className="text-sm font-medium text-foreground">Sin partes en {etiquetaMes(anio, mes)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            En cuanto se guarde el primer parte de ese mes, aquí se verán sus indicadores.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi icon={Weight} label="Producción lavada" valor={fmtCelda(o.total.kg, 0)} pie={`kg · ${textoFaltan}`} />
            <Kpi icon={Users} label="Ocupación acumulada" valor={fmtCelda(o.total.turistas, 0)} pie={`turistas días · Faltan ${o.diasPorCompletar.turistas}`} />
            <Kpi
              icon={Layers}
              label="Kg por turista día"
              valor={fmtCelda(o.kgPorTurista)}
              tono={typeof o.kgPorTurista === "number" ? "neutro" : "aviso"}
              pie={r.parcial.kgPorTurista !== null && typeof o.kgPorTurista !== "number" ? `Parcial hasta hoy: ${fmtCelda(r.parcial.kgPorTurista)}` : "kg/TD"}
            />
            <Kpi icon={Shirt} label="Ropa recibida" valor={fmtCelda(o.total.recibidas, 0)} pie={`piezas · Faltan ${o.diasPorCompletar.recibidas}`} />
            <Kpi icon={Shirt} label="Ropa entregada" valor={fmtCelda(o.total.entregadas, 0)} pie={`piezas · Faltan ${o.diasPorCompletar.entregadas}`} />
            <Kpi
              icon={ArrowDownUp}
              label="Balance"
              valor={fmtCelda(o.balance, 0)}
              tono={typeof o.balance === "number" ? "neutro" : "aviso"}
              pie={r.parcial.balance !== null && typeof o.balance !== "number" ? `Parcial hasta hoy: ${fmtCelda(r.parcial.balance, 0)}` : "entregadas − recibidas"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.75fr_1fr] items-start">
            <Panel
              titulo="Kg lavados por día"
              icon={BarChart3}
              extra={mediana > 0 ? <span className="text-xs opacity-80">Mediana del mes: {fmtCelda(mediana, 0)} kg</span> : undefined}
            >
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dias} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="etiqueta" interval={0} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<TooltipDia />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                    {mediana > 0 && <ReferenceLine y={mediana} stroke="hsl(var(--foreground))" strokeDasharray="4 4" strokeOpacity={0.55} />}
                    <Bar
                      dataKey="kg"
                      radius={[4, 4, 0, 0]}
                      className="cursor-pointer"
                      onClick={(d: { fecha?: string; futuro?: boolean }) => {
                        if (d?.fecha && !d.futuro) navigate(`/auditoria/formularios?mes=${d.fecha.slice(0, 7)}&hoja=Operacion&fecha=${d.fecha}`);
                      }}
                    >
                      {dias.map((d) => (
                        <Cell key={d.fecha} fill={COLOR_ESTADO[d.estado]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                {(["normal", "bajo", "muy_bajo", "alto", "borrador"] as const).map((e) => (
                  <span key={e} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <i className="inline-block w-3 h-3 rounded" style={{ background: COLOR_ESTADO[e] }} />
                    {e === "borrador" ? "Sin cerrar" : ETIQUETA_ESTADO[e]}
                  </span>
                ))}
              </div>
            </Panel>

            <Panel titulo="Qué vigilar" icon={AlertTriangle} extra={<span className="text-xs opacity-80">{alertas.length} avisos</span>}>
              {alertas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada fuera de lo normal este mes.</p>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {alertas.map((a) => (
                    <AlertaCard key={a.id} a={a} onClick={abrirDia(a)} />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr] items-start">
            <Panel
              titulo="Matriz de resultados del SLA"
              icon={ShieldCheck}
              extra={<span className="text-xs opacity-80">{r.kpisCumplen} cumplen de {r.kpisEvaluados} evaluados · Sin índice global</span>}
            >
              <FilaTabla cabecera plantilla={plantillaKpi} celdas={["KPI", "Meta", "Resultado", <span key="b">Frente a la meta (línea)</span>, <span key="c">Cumplimiento</span>]} />
              {r.kpis.map((k) => {
                const valor = typeof k.resultado === "number" ? Math.min(1, k.resultado) * 100 : 0;
                return (
                  <FilaTabla
                    key={k.key}
                    plantilla={plantillaKpi}
                    celdas={[
                      <span key="n">{k.nombre}</span>,
                      pct(k.meta),
                      pct(k.resultado),
                      <div key="b" role="img" aria-label={`${k.nombre}: resultado ${pct(k.resultado)}, meta ${pct(k.meta)}`} className="relative h-2 rounded bg-muted">
                        <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${valor}%`, background: k.cumplimiento === "No cumple" ? ROJO_MARCA : AZUL_MARCA }} />
                        {k.meta !== null && (
                          <div className="absolute -top-[3px] -bottom-[3px] w-0.5 bg-foreground" style={{ left: `${k.meta * 100}%` }} />
                        )}
                      </div>,
                      <Chip key="c" tono={tonoDe(k.cumplimiento)}>{k.cumplimiento}</Chip>,
                    ]}
                  />
                );
              })}
            </Panel>

            <div className="space-y-4 min-w-0">
              <Panel titulo="Piezas recibidas y entregadas por día" icon={ArrowDownUp}>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dias.filter((d) => !d.futuro)} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} minTickGap={12} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Día ${l}`} />
                      <Line type="monotone" dataKey="recibidas" name="Recibidas" stroke={AZUL_MARCA} strokeWidth={2} dot={false} connectNulls={false} />
                      <Line type="monotone" dataKey="entregadas" name="Entregadas" stroke={AMBAR_MARCA} strokeWidth={2} dot={false} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: AZUL_MARCA }} />Recibidas: {fmtCelda(o.total.recibidas, 0)}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: AMBAR_MARCA }} />Entregadas: {fmtCelda(o.total.entregadas, 0)}</span>
                </div>
              </Panel>
              <Panel titulo="Jornada" icon={Clock} extra={<span className="text-xs opacity-80">Sin sumar paradas simultáneas</span>}>
                <Mini
                  columnas={3}
                  items={[
                    { label: "Horas previstas", valor: o.total.horas_previstas, dec: 1 },
                    { label: "Horas trabajadas", valor: o.total.horas_trabajadas, dec: 1 },
                    { label: "Parada única", valor: o.total.parada, dec: 1 },
                  ]}
                />
              </Panel>
              <Panel titulo="Calidad percibida y controles" icon={Smile}>
                <Mini
                  columnas={3}
                  items={[
                    { label: `Lavado (${fmtCelda(r.calidad.lavado.encuestas)} encuestas)`, valor: r.calidad.lavado.puntuacion ?? "Completar", dec: 1 },
                    { label: `Servicio (${fmtCelda(r.calidad.servicio.encuestas)} encuestas)`, valor: r.calidad.servicio.puntuacion ?? "Completar", dec: 1 },
                    { label: "Reprocesos (pzs)", valor: r.calidad.reprocesos ?? "Completar" },
                    { label: "Reclamaciones", valor: r.calidad.reclamaciones ?? "Completar" },
                    { label: "Daños imputables", valor: r.calidad.danos ?? "Completar" },
                  ]}
                />
              </Panel>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <Panel titulo="Control del procesado por área" icon={Layers} extra={<span className="text-xs opacity-80">No se suman: una prenda pasa por varias áreas</span>}>
              <FilaTabla cabecera plantilla={plantillaArea} celdas={["Área", "Conformes", "Manchas", "Roturas", <span key="r">Rechazo</span>, <span key="e">Registros</span>]} />
              {r.areas.map((a) => {
                const c = typeof a.conformes === "number" ? a.conformes : 0;
                const m = typeof a.manchas === "number" ? a.manchas : 0;
                const ro = typeof a.roturas === "number" ? a.roturas : 0;
                const total = c + m + ro;
                const rechazo = total > 0 ? ((m + ro) / total) * 100 : null;
                return (
                  <FilaTabla
                    key={a.area}
                    plantilla={plantillaArea}
                    celdas={[
                      <b key="n">{a.area}</b>,
                      fmtCelda(a.conformes, 0),
                      fmtCelda(a.manchas, 0),
                      fmtCelda(a.roturas, 0),
                      <div key="r" className="flex items-center gap-1.5">
                        <div className="relative h-2 flex-1 rounded bg-muted">
                          <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, (rechazo ?? 0) * 20)}%`, background: AMBAR_MARCA }} />
                        </div>
                        <span className="text-[11px]">{rechazo === null ? "—" : `${rechazo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`}</span>
                      </div>,
                      <Chip key="e" tono={a.estado === "Sin registros" ? "gris" : tonoDe(a.estado)}>
                        {a.porRevisar > 0 ? `${a.porRevisar} por revisar` : a.estado === "Registros completos" ? "Completos" : a.estado}
                      </Chip>,
                    ]}
                  />
                );
              })}
            </Panel>

            <Panel titulo="Existencias frente a prendas pactadas" icon={Shirt} extra={<span className="text-xs opacity-80">Estado: {r.inventario.estado}</span>}>
              <FilaTabla cabecera plantilla={plantillaInv} celdas={["Artículo", "Pactadas", "Actuales", <span key="b" className="block text-center">Faltan · Sobran</span>, "Saldo"]} />
              {r.articulos.map((a) => {
                const ancho = typeof a.saldo === "number" ? (Math.abs(a.saldo) / maxSaldo) * 48 : 0;
                const negativo = typeof a.saldo === "number" && a.saldo < 0;
                return (
                  <FilaTabla
                    key={a.prenda}
                    plantilla={plantillaInv}
                    celdas={[
                      <span key="n">{a.prenda}</span>,
                      fmtCelda(a.pactadas),
                      fmtCelda(a.actuales),
                      <div key="b" role="img" aria-label={`${a.prenda}: saldo ${fmtCelda(a.saldo)}`} className="relative h-2.5">
                        <div className="absolute left-1/2 -top-0.5 -bottom-0.5 w-px bg-muted-foreground/60" />
                        <div
                          className="absolute top-0 bottom-0 rounded"
                          style={{
                            left: negativo ? `${50 - ancho}%` : "50%",
                            width: `${ancho}%`,
                            background: negativo ? ROJO_MARCA : AMBAR_MARCA,
                          }}
                        />
                      </div>,
                      typeof a.saldo === "number" && a.saldo > 0 ? `+${a.saldo}` : fmtCelda(a.saldo),
                    ]}
                  />
                );
              })}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3 items-start">
            <Panel titulo="Incidencias del mes" icon={Droplets}>
              <Mini
                columnas={2}
                items={[
                  { label: "Registradas", valor: r.incidencias.registradas },
                  { label: "Cerradas", valor: r.incidencias.cerradas },
                  { label: "Horas de agua", valor: r.incidencias.horasAgua },
                  { label: "Horas de electricidad", valor: r.incidencias.horasElectricidad },
                ]}
              />
            </Panel>
            <Panel titulo="Estado técnico" icon={Wrench}>
              <Mini
                columnas={2}
                items={[
                  { label: "Equipos", valor: r.equipos.total },
                  { label: "Operativos", valor: r.equipos.operativos },
                  { label: "Fuera de servicio", valor: r.equipos.fueraServicio },
                  {
                    label: "Preventivos ejecutados",
                    valor:
                      typeof r.equipos.preventivosEjecutados === "number" && typeof r.equipos.preventivosPrevistos === "number"
                        ? `${r.equipos.preventivosEjecutados} de ${r.equipos.preventivosPrevistos}`
                        : "Completar",
                  },
                ]}
              />
            </Panel>
            <Panel titulo="Seguimiento de acciones" icon={ListChecks}>
              <Mini
                columnas={3}
                items={[
                  { label: "Del mes", valor: r.acciones.delMes },
                  { label: "Cerradas", valor: r.acciones.cerradas },
                  { label: "Vencidas al cierre", valor: r.acciones.vencidas },
                ]}
              />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <Panel titulo="Importes y piezas" icon={Coins} extra={<span className="text-xs opacity-80">Las monedas no se suman</span>}>
              <FilaTabla cabecera plantilla={plantillaConc} celdas={["Moneda", "Calculado", "Conciliado", "Sin conciliar"]} />
              {r.retiros.porMoneda.map((x) => (
                <FilaTabla key={x.clave} plantilla={plantillaConc} celdas={[<b key="k">{x.clave}</b>, fmtCelda(x.calculado), fmtCelda(x.conciliado), fmtCelda(x.sinConciliar)]} />
              ))}
              <div className="h-2" />
              <FilaTabla cabecera plantilla={plantillaConc} celdas={["Concepto", "Piezas", "Conciliadas", "Sin conciliar"]} />
              {r.retiros.porConcepto.map((x) => (
                <FilaTabla key={x.clave} plantilla={plantillaConc} celdas={[<b key="k">{x.clave}</b>, fmtCelda(x.calculado), fmtCelda(x.conciliado), fmtCelda(x.sinConciliar)]} />
              ))}
            </Panel>
            <Panel titulo="Revisión declarada de los registros" icon={Eye}>
              {r.revision.map((x) => (
                <FilaTabla
                  key={x.hoja}
                  plantilla="minmax(0,1.3fr) minmax(0,1.5fr) auto"
                  celdas={[
                    <b key="h">{x.hoja}</b>,
                    <span key="d" className="text-[11.5px] font-medium text-muted-foreground">{x.detalle}</span>,
                    <Chip key="e" tono={tonoDe(x.estado)}>{x.estado}</Chip>,
                  ]}
                />
              ))}
            </Panel>
          </div>
        </>
      )}

      {hayAntiguos && onVerAntiguo && (
        <button type="button" onClick={onVerAntiguo} className="text-xs font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Ver el dashboard de los formularios anteriores
        </button>
      )}
    </div>
  );
};

export default DashboardMensual;
