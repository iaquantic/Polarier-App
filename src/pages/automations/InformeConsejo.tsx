import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownToLine, ChevronDown, ChevronLeft, CircleCheck, CircleMinus, CircleX, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { fechaCorta, getAutomatizacion } from "@/lib/automatizaciones";
import {
  NOMBRES_MES,
  NOMBRES_TRIMESTRE,
  aniosDisponibles,
  construirMeses,
  construirTrimestres,
  enCurso,
  estadoMes,
  estaAtascado,
  mesesVisibles,
  puedeDescargar,
  puedeGenerar,
  type EstadoRequisito,
  type FilaDisponibilidad,
  type InformeConsejo as Informe,
  type MesConsejo,
  type TrimestreConsejo,
} from "@/lib/informeConsejo";
import {
  MigracionPendiente,
  generarInforme,
  getDisponibilidad,
  getFuentes,
  getInformes,
  urlDescarga,
} from "@/services/informeConsejo";

/** Cada cuánto se consulta un informe que se está generando. */
const CONSULTA_MS = 15_000;

const COLOR: Record<EstadoRequisito | "curso" | "error" | "listo", string> = {
  ok: "#1F6B3B",
  listo: "#1F6B3B",
  falta: "var(--neo-danger)",
  error: "var(--neo-danger)",
  sin_comprobar: "var(--neo-text-2)",
  curso: "var(--neo-accent)",
};

const IconoEstado = ({ estado }: { estado: EstadoRequisito }) => {
  const props = { size: 16, strokeWidth: 2.2, style: { color: COLOR[estado] }, className: "shrink-0 mt-[2px]" };
  if (estado === "ok") return <CircleCheck {...props} aria-label="Está" />;
  if (estado === "falta") return <CircleX {...props} aria-label="Falta" />;
  return <CircleMinus {...props} aria-label="Sin comprobar" />;
};

/** «TABLA CA · datos del CD del mes» → «Datos del CD del mes» (el grupo ya lo dice). */
const etiqueta = (requisito: string) => {
  const sin = requisito.replace(/^(GLOBAL|TABLA CA) · /, "");
  return sin.charAt(0).toUpperCase() + sin.slice(1);
};

/** Un mes o un trimestre en la lista, con su clave de estado de pantalla («m6», «t2»). */
type Tarjeta = { tipo: "mes"; clave: string; p: MesConsejo } | { tipo: "trimestre"; clave: string; p: TrimestreConsejo };

const nombreDe = (i: Informe) =>
  `${i.trimestre ? NOMBRES_TRIMESTRE[i.trimestre - 1] : NOMBRES_MES[(i.mes ?? 1) - 1]} ${i.anio}`;

const InformeConsejo = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const auto = getAutomatizacion("informe-consejo")!;
  const hoy = useMemo(() => new Date(), []);

  const [anio, setAnio] = useState(hoy.getFullYear());
  const [filas, setFilas] = useState<FilaDisponibilidad[]>([]);
  const [informes, setInformes] = useState<Informe[]>([]);
  const [fuentes, setFuentes] = useState<{ global: string | null; tabla_ca: string | null }>({ global: null, tabla_ca: null });
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setFallo(null);
    try {
      const [disp, infs, fts] = await Promise.all([getDisponibilidad(anio), getInformes(anio), getFuentes(anio)]);
      setFilas(disp);
      setInformes(infs);
      setFuentes(fts);
    } catch (e) {
      setFilas([]);
      setFallo(
        e instanceof MigracionPendiente
          ? "Este apartado aún no está listo: falta aplicar en Supabase la migración 013 del informe del Consejo."
          : "No se pudo comprobar qué datos hay. Vuelve a intentarlo en un momento."
      );
    } finally {
      setCargando(false);
    }
  }, [anio]);

  useEffect(() => {
    setAbierto(null);
    cargar();
  }, [cargar]);

  const meses = useMemo(
    () => construirMeses(anio, mesesVisibles(anio, hoy), filas, informes),
    [anio, hoy, filas, informes]
  );
  const trimestres = useMemo(() => construirTrimestres(anio, meses, informes), [anio, meses, informes]);

  // Del más reciente al más antiguo; cada trimestre, justo encima de su último mes.
  const tarjetas = useMemo<Tarjeta[]>(() => {
    const out: Tarjeta[] = [];
    meses.forEach((m) => {
      const t = m.mes % 3 === 0 ? trimestres.find((x) => x.trimestre === m.mes / 3) : undefined;
      if (t) out.push({ tipo: "trimestre", clave: `t${t.trimestre}`, p: t });
      out.push({ tipo: "mes", clave: `m${m.mes}`, p: m });
    });
    return out;
  }, [meses, trimestres]);

  // El mes más reciente, desplegado de entrada.
  useEffect(() => {
    if (abierto === null && meses.length > 0 && !cargando) setAbierto(`m${meses[0].mes}`);
  }, [meses, abierto, cargando]);

  // Mientras haya un informe generándose, se consulta su fila; al cerrarse se avisa.
  const hayEnCurso = informes.some((i) => enCurso(i) && !estaAtascado(i, new Date()));
  const previos = useRef<Informe[]>([]);
  useEffect(() => {
    previos.current.forEach((antes) => {
      const ahora = informes.find((i) => i.id === antes.id);
      if (!ahora || !enCurso(antes) || enCurso(ahora)) return;
      if (ahora.estado === "listo") toast.success(`El informe de ${nombreDe(ahora)} está listo para descargar`);
      if (ahora.estado === "error") toast.error(`No se pudo generar el informe de ${nombreDe(ahora)}`);
    });
    previos.current = informes;
  }, [informes]);

  useEffect(() => {
    if (!hayEnCurso) return;
    const id = window.setInterval(() => {
      getInformes(anio).then(setInformes).catch(() => {});
    }, CONSULTA_MS);
    return () => window.clearInterval(id);
  }, [hayEnCurso, anio]);

  const generar = async (t: Tarjeta) => {
    if (!user) return;
    setPidiendo(t.clave);
    try {
      const periodo = t.tipo === "trimestre" ? { trimestre: t.p.trimestre } : { mes: t.p.mes };
      const informe = await generarInforme(anio, periodo, {
        id: user.id,
        nombre: profile?.full_name || user.user_metadata?.full_name || undefined,
        email: user.email || undefined,
      });
      const mismo = (i: Informe) =>
        i.anio === anio && (t.tipo === "trimestre" ? i.trimestre === t.p.trimestre : i.mes === t.p.mes && !i.trimestre);
      setInformes((prev) => [...prev.filter((i) => !mismo(i)), informe]);
      toast.success(`Generando el informe de ${t.p.nombre} ${anio}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo pedir el informe.");
      getInformes(anio).then(setInformes).catch(() => {});
    } finally {
      setPidiendo(null);
    }
  };

  const descargar = async (t: Tarjeta) => {
    if (!t.p.informe) return;
    setDescargando(t.clave);
    try {
      window.location.assign(await urlDescarga(t.p.informe));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar el informe.");
    } finally {
      setDescargando(null);
    }
  };

  const ahora = new Date();

  return (
    <div className="flex-1 px-4 sm:px-8 pt-4 sm:pt-7 pb-12 safe-bottom">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-5 sm:gap-7">

        <button
          type="button"
          onClick={() => navigate("/automatizaciones")}
          className="neo-raised-sm neo-press neo-accent self-start inline-flex items-center gap-2 pl-3 pr-4 py-2 rounded-full text-[12.5px] font-bold"
        >
          <ChevronLeft size={16} />
          Automatizaciones
        </button>

        <header className="flex items-center gap-4">
          <span className="neo-raised-sm neo-accent w-[52px] h-[52px] rounded-2xl flex items-center justify-center shrink-0">
            <auto.icono size={24} strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <h1 className="neo-strip neo-text text-[22px] sm:text-[28px] font-extrabold tracking-tight rounded-xl">{auto.nombre}</h1>
            <p className="neo-strip neo-text-2 text-[13px] sm:text-[14px] font-medium mt-1.5 px-1 rounded-lg">{auto.descripcion}</p>
          </div>
        </header>

        <div className="neo-chat flex flex-col gap-4 sm:gap-5">

          {/* Año y estado de las fuentes */}
          <section className="neo-raised rounded-[22px] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Año">
              {aniosDisponibles(hoy).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAnio(a)}
                  aria-pressed={a === anio}
                  className={`px-4 py-2 rounded-full text-[13px] font-extrabold neo-press ${
                    a === anio ? "neo-primary" : "neo-white-btn neo-accent"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <p className="neo-text-2 text-[12.5px] font-medium leading-relaxed">
              GLOBAL {fuentes.global ? `actualizado ${fechaCorta(fuentes.global)}` : "sin datos de este año"}
              {" · "}
              TABLA CA {fuentes.tabla_ca ? `actualizada ${fechaCorta(fuentes.tabla_ca)}` : "sin llevar a Supabase todavía"}
            </p>
          </section>

          <p className="neo-strip neo-text-2 text-[13px] font-medium leading-relaxed px-1 rounded-lg">
            Cada mes enseña los datos que necesita el informe. «Generar informe» se habilita cuando no falta ninguno; el de un trimestre, cuando no falta nada en sus tres meses. {auto.duracion}
          </p>

          {cargando && (
            <div className="neo-raised rounded-[22px] p-6 flex items-center gap-3">
              <span
                className="w-[18px] h-[18px] rounded-full border-[2.5px] border-[var(--neo-well)] animate-spin shrink-0"
                style={{ borderTopColor: "var(--neo-accent)" }}
              />
              <span className="neo-accent text-[13.5px] font-extrabold">Comprobando los datos de {anio}…</span>
            </div>
          )}

          {!cargando && fallo && (
            <div className="neo-raised rounded-[22px] p-5 flex flex-col gap-3">
              <p className="text-[13.5px] font-bold" style={{ color: "var(--neo-danger)" }}>{fallo}</p>
              <button
                type="button"
                onClick={cargar}
                className="neo-white-btn neo-press neo-accent self-start inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] font-bold"
              >
                <RefreshCw size={14} />
                Reintentar
              </button>
            </div>
          )}

          {!cargando && !fallo && meses.length === 0 && (
            <p className="neo-text-2 text-[13px] font-medium">No hay meses que enseñar para {anio}.</p>
          )}

          {!cargando && !fallo && tarjetas.map((t) => {
            const m = t.p;
            const estado = estadoMes(m, ahora);
            const generable = puedeGenerar(m, ahora);
            const descargable = puedeDescargar(m);
            const abiertoEste = abierto === t.clave;
            const motivo = m.faltan > 0
              ? `Faltan ${m.faltan} datos de ${m.nombre}`
              : enCurso(m.informe) ? "Ya se está generando" : undefined;
            return (
              <article
                key={t.clave}
                className={`neo-raised rounded-[22px] p-4 sm:p-5 flex flex-col gap-4 ${t.tipo === "trimestre" ? "border-l-4" : ""}`}
                style={t.tipo === "trimestre" ? { borderLeftColor: "var(--neo-accent)" } : undefined}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAbierto(abiertoEste ? "" : t.clave)}
                    aria-expanded={abiertoEste}
                    className="flex items-center gap-3 flex-1 min-w-[200px] text-left"
                  >
                    <ChevronDown
                      size={18}
                      className={`neo-accent shrink-0 transition-transform ${abiertoEste ? "" : "-rotate-90"}`}
                    />
                    <span className="neo-text text-[17px] font-extrabold">{m.nombre} {m.anio}</span>
                    <span
                      className="neo-inset-sm px-2.5 py-1 rounded-full text-[11.5px] font-extrabold"
                      style={{ color: COLOR[estado.tono] }}
                    >
                      {estado.texto}
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {descargable && (
                      <button
                        type="button"
                        onClick={() => descargar(t)}
                        disabled={descargando === t.clave}
                        className="neo-primary neo-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-extrabold disabled:opacity-60"
                      >
                        <ArrowDownToLine size={15} />
                        {descargando === t.clave ? "Preparando…" : "Descargar informe"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => generar(t)}
                      disabled={!generable || pidiendo === t.clave}
                      title={generable ? undefined : motivo}
                      className={`neo-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-extrabold disabled:opacity-45 disabled:cursor-not-allowed ${
                        descargable ? "neo-white-btn neo-accent" : "neo-primary"
                      }`}
                    >
                      <FileText size={15} />
                      {pidiendo === t.clave ? "Pidiendo…" : descargable ? "Regenerar" : "Generar informe"}
                    </button>
                  </div>
                </div>

                {m.informe?.estado === "error" && m.informe.error && (
                  <p className="text-[12.5px] font-semibold leading-relaxed" style={{ color: "var(--neo-danger)" }}>
                    Último intento: {m.informe.error}
                  </p>
                )}
                {estaAtascado(m.informe, ahora) && (
                  <p className="text-[12.5px] font-semibold leading-relaxed" style={{ color: "var(--neo-danger)" }}>
                    Lleva más de dos horas generándose y lo normal es que ya hubiera terminado. Puede que haya fallado sin avisar: puedes volver a pedirlo.
                  </p>
                )}
                {m.informe?.generado_at && descargable && (
                  <p className="neo-text-2 text-[12px] font-medium">Generado {fechaCorta(m.informe.generado_at)}</p>
                )}

                {abiertoEste && t.tipo === "trimestre" && (
                  <div className="neo-inset rounded-[18px] p-4 sm:p-5 flex flex-col gap-3">
                    <p className="neo-text-2 text-[12.5px] font-medium leading-relaxed">
                      El trimestre usa los datos de sus tres meses. El detalle de lo que falta está en cada mes.
                    </p>
                    <ul className="flex flex-col gap-2">
                      {t.p.meses.map((mm) => (
                        <li key={mm.mes} className="flex items-start gap-2">
                          <IconoEstado estado={mm.faltan > 0 ? "falta" : "ok"} />
                          <span className="neo-text text-[13.5px] font-bold leading-snug">
                            {mm.nombre}
                            <span className="neo-text-2 font-medium">
                              {" · "}
                              {mm.faltan === 0 ? "completo" : mm.faltan === 1 ? "falta 1 dato" : `faltan ${mm.faltan} datos`}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {abiertoEste && t.tipo === "mes" && (
                  <div className="neo-inset rounded-[18px] p-4 sm:p-5 flex flex-col gap-5">
                    {t.p.grupos.map((g) => (
                      <section key={g.grupo} className="flex flex-col gap-2.5">
                        <h2 className="neo-text-2 text-[11px] font-extrabold uppercase tracking-[0.12em]">
                          {g.titulo}
                          {g.grupo === "tecleado" ? " · sin comprobar" : g.faltan > 0 ? ` · faltan ${g.faltan}` : " · completo"}
                        </h2>
                        {g.grupo === "tecleado" && (
                          <p className="neo-text-2 text-[12.5px] font-medium leading-relaxed">
                            Estos datos no tienen mes en la TABLA CA: el informe los toma tal como estén al generarlo. No bloquean.
                          </p>
                        )}
                        <ul className="flex flex-col gap-3">
                          {g.requisitos.map((r) => {
                            const peor: EstadoRequisito = r.items.some((i) => i.estado === "falta")
                              ? "falta"
                              : r.items.every((i) => i.estado === "ok") ? "ok" : "sin_comprobar";
                            const conPolo = r.items.filter((i) => i.polo);
                            return (
                              <li key={r.requisito} className="flex flex-col gap-1.5">
                                <div className="flex items-start gap-2">
                                  <IconoEstado estado={peor} />
                                  <span className="neo-text text-[13.5px] font-bold leading-snug">
                                    {etiqueta(r.requisito)}
                                    {g.grupo === "tecleado" && r.items[0]?.detalle && (
                                      <span className="neo-text-2 font-medium"> · {r.items[0].detalle}</span>
                                    )}
                                  </span>
                                </div>
                                {conPolo.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pl-6">
                                    {conPolo.map((i) => (
                                      <span
                                        key={i.polo}
                                        className="neo-white-btn px-2.5 py-1 rounded-lg text-[11.5px] font-bold"
                                        style={{ color: COLOR[i.estado] }}
                                      >
                                        {i.estado === "ok" ? "✓" : "✗"} {i.polo}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {conPolo
                                  .filter((i) => i.estado === "falta" && i.detalle)
                                  .map((i) => (
                                    <p
                                      key={`${i.polo}-detalle`}
                                      className="pl-6 text-[12.5px] font-medium leading-relaxed"
                                      style={{ color: "var(--neo-danger)" }}
                                    >
                                      {i.polo}: {i.detalle}
                                    </p>
                                  ))}
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InformeConsejo;
