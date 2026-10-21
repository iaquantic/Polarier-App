import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowDownToLine, ChevronLeft, ChevronRight, CircleCheck, CircleX, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import FileDownloadCard from "@/components/FileDownloadCard";
import { fechaCorta, getAutomatizacion, revisarArchivo } from "@/lib/automatizaciones";
import type { ArchivoRespuesta } from "@/lib/n8nRespuesta";
import {
  archivoDeEjecucion,
  ejecutarAutomatizacion,
  getEjecucion,
  getEjecuciones,
  type EjecucionAutomatizacion,
} from "@/services/automatizaciones";

// "en_cola": una asíncrona aceptada por n8n, que terminará por su cuenta.
type Fase = "reposo" | "confirmar" | "trabajando" | "en_cola" | "listo" | "error";

/** Cada cuánto se consulta una ejecución asíncrona en marcha. */
const CONSULTA_MS = 15_000;
/** A partir de aquí, una asíncrona en marcha probablemente murió sin cerrar su fila. */
const ATASCADA_MS = 2 * 60 * 60 * 1000;

const formatoTamano = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AutomationRun = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const auto = getAutomatizacion(slug);

  const [fase, setFase] = useState<Fase>("reposo");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [texto, setTexto] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ArchivoRespuesta | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [ejecuciones, setEjecuciones] = useState<EjecucionAutomatizacion[]>([]);
  // Una ejecución pasada abierta desde el historial: enseña el mismo resumen
  // que salió al terminar, con su fichero.
  const [verEjecucion, setVerEjecucion] = useState<EjecucionAutomatizacion | null>(null);
  const [archivoVisto, setArchivoVisto] = useState<ArchivoRespuesta | null>(null);
  const [buscandoArchivo, setBuscandoArchivo] = useState(false);
  // La asíncrona recién lanzada, mientras la rama trabaja.
  const [enCola, setEnCola] = useState<EjecucionAutomatizacion | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [params, setParams] = useSearchParams();

  const refrescarHistorial = useCallback(() => {
    if (!slug) return;
    getEjecuciones(slug, 8).then(setEjecuciones).catch(() => {});
  }, [slug]);

  // El fichero de una ejecución vieja se guarda por su ruta: la URL firmada
  // caduca, así que se pide una nueva al abrirla.
  const abrirEjecucion = useCallback(async (e: EjecucionAutomatizacion) => {
    setVerEjecucion(e);
    setArchivoVisto(null);
    setParams(e.id === params.get("run") ? params : { run: e.id }, { replace: true });
    if (!e.resultado_path) return;
    setBuscandoArchivo(true);
    // Si el fichero ya se borró (la limpieza de documentos antiguos), se
    // enseña el resumen igual, sin descarga.
    setArchivoVisto(await archivoDeEjecucion(e));
    setBuscandoArchivo(false);
  }, [params, setParams]);

  const cerrarEjecucion = () => {
    setVerEjecucion(null);
    setArchivoVisto(null);
    if (params.get("run")) setParams({}, { replace: true });
  };

  useEffect(() => {
    // Al cambiar de automatización, la pantalla vuelve a empezar.
    setFase("reposo");
    setArchivo(null);
    setAviso(null);
    setTexto(null);
    setResultado(null);
    setFallo(null);
    setVerEjecucion(null);
    setArchivoVisto(null);
    setEnCola(null);
    refrescarHistorial();
  }, [slug, refrescarHistorial]);

  // Asíncronas: la rama cierra la fila por su cuenta, así que se consulta la
  // que se está esperando, sea la recién lanzada o una abierta del historial.
  const siguiendo =
    fase === "en_cola" && enCola ? enCola.id
    : auto?.asincrona && verEjecucion?.estado === "en_curso" ? verEjecucion.id
    : null;

  // Lo que hay que hacer al terminar depende de qué se está mirando en ese
  // momento; el intervalo no debe reiniciarse por eso, así que va por ref.
  const alTerminar = useRef<(e: EjecucionAutomatizacion) => void>(() => {});
  alTerminar.current = async (e) => {
    refrescarHistorial();
    if (verEjecucion?.id === e.id) {
      abrirEjecucion(e);
      return;
    }
    setEnCola(null);
    if (e.estado === "completada") {
      setTexto(e.respuesta);
      setResultado(await archivoDeEjecucion(e));
      setFase("listo");
      toast.success(`${auto?.nombre ?? "La automatización"}: terminado`);
    } else {
      setFallo(e.error || "Terminó con error, sin detalle.");
      setFase("error");
      toast.error(`${auto?.nombre ?? "La automatización"}: no se pudo terminar`);
    }
  };

  useEffect(() => {
    if (!siguiendo) return;
    let vivo = true;
    const intervalo = window.setInterval(async () => {
      const e = await getEjecucion(siguiendo).catch(() => null);
      if (vivo && e && e.estado !== "en_curso") alTerminar.current(e);
    }, CONSULTA_MS);
    return () => {
      vivo = false;
      window.clearInterval(intervalo);
    };
  }, [siguiendo]);

  // Entrada por enlace (?run=<id>), que es como llega desde el índice.
  const runParam = params.get("run");
  useEffect(() => {
    if (!runParam || verEjecucion?.id === runParam) return;
    const yaCargada = ejecuciones.find((e) => e.id === runParam);
    if (yaCargada) {
      abrirEjecucion(yaCargada);
      return;
    }
    getEjecucion(runParam).then((e) => { if (e) abrirEjecucion(e); }).catch(() => {});
    // abrirEjecucion cambia con los params, y volver a entrar aquí sería un bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runParam, ejecuciones]);

  if (!auto) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <p className="neo-strip neo-text text-base font-bold px-4 py-2 rounded-xl">Esa automatización no existe.</p>
        <button
          type="button"
          onClick={() => navigate("/automatizaciones")}
          className="neo-raised-sm neo-press neo-accent px-5 py-2.5 rounded-full text-[13px] font-extrabold"
        >
          Ver las que hay
        </button>
      </div>
    );
  }

  const lanzar = async (file: File) => {
    if (!user) return;
    setVerEjecucion(null);
    setArchivoVisto(null);
    if (params.get("run")) setParams({}, { replace: true });
    setFase("trabajando");
    setTexto(null);
    setResultado(null);
    setFallo(null);
    try {
      const res = await ejecutarAutomatizacion(auto, file, {
        id: user.id,
        nombre: profile?.full_name || user.user_metadata?.full_name || undefined,
        email: user.email || undefined,
      });
      setTexto(res.texto);
      if (res.enCurso) {
        setEnCola(res.ejecucion);
        setFase("en_cola");
        return;
      }
      setResultado(res.archivo);
      setFase("listo");
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se ha podido procesar el fichero.";
      setFallo(mensaje);
      setFase("error");
      toast.error(mensaje);
    } finally {
      refrescarHistorial();
    }
  };

  const elegir = (file: File) => {
    const { error, aviso: pega } = revisarArchivo(auto, file.name);
    if (error) {
      toast.error(error);
      return;
    }
    setArchivo(file);
    setAviso(pega ?? null);
    // Un nombre raro no bloquea: manda la rama, no la app. Pero se pregunta antes.
    if (pega) setFase("confirmar");
    else lanzar(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    if (fase === "trabajando") return;
    const file = e.dataTransfer.files?.[0];
    if (file) elegir(file);
  };

  const reiniciar = () => {
    setFase("reposo");
    setArchivo(null);
    setAviso(null);
    setTexto(null);
    setResultado(null);
    setFallo(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const trabajando = fase === "trabajando";

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

        <div className="neo-chat grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 sm:gap-5 items-start">

          {/* ── SUBIDA / ESTADO ── */}
          <section className="neo-raised rounded-[22px] p-5 sm:p-6 flex flex-col gap-5">

            <input
              ref={inputRef}
              type="file"
              accept={auto.extensiones.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) elegir(file);
                if (inputRef.current) inputRef.current.value = "";
              }}
            />

            {/* Una ejecución del historial: el mismo resumen que salió al terminar. */}
            {verEjecucion ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {verEjecucion.estado === "completada" && <CircleCheck size={22} strokeWidth={2.2} style={{ color: "#1F6B3B" }} />}
                    {verEjecucion.estado === "error" && <CircleX size={22} strokeWidth={2.2} style={{ color: "var(--neo-danger)" }} />}
                    <span
                      className="text-[14px] font-extrabold"
                      style={{
                        color:
                          verEjecucion.estado === "completada" ? "#1F6B3B"
                          : verEjecucion.estado === "error" ? "var(--neo-danger)"
                          : "var(--neo-accent)",
                      }}
                    >
                      {verEjecucion.estado === "completada" ? "Resultado"
                        : verEjecucion.estado === "error" ? "No se pudo procesar"
                        : auto.asincrona ? "En marcha"
                        : "Quedó en curso"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={cerrarEjecucion}
                    className="neo-white-btn neo-press neo-accent px-4 py-2 rounded-full text-[12.5px] font-bold"
                  >
                    Volver
                  </button>
                </div>

                <p className="neo-text-2 text-[12.5px] font-semibold">
                  {verEjecucion.archivo_nombre} · {fechaCorta(verEjecucion.created_at)}
                </p>

                <div className="neo-inset rounded-[18px] p-4 sm:p-5">
                  <p className="neo-text text-[13px] font-medium leading-relaxed whitespace-pre-wrap">
                    {verEjecucion.estado === "error"
                      ? verEjecucion.error || "Sin detalle del error."
                      : verEjecucion.estado === "en_curso" && auto.asincrona
                        ? Date.now() - new Date(verEjecucion.created_at).getTime() > ATASCADA_MS
                          ? "Lleva más de dos horas en marcha y lo normal es que ya hubiera terminado. Puede que la rama fallara sin cerrar la ejecución: revísala en n8n."
                          : `${auto.duracion ?? ""} Esta pantalla se actualiza sola cuando termine.`.trim()
                      : verEjecucion.respuesta
                        || (verEjecucion.estado === "en_curso"
                          ? "Se lanzó y la app no llegó a recibir la respuesta. Puede que n8n terminara igualmente: míralo en sus ejecuciones."
                          : "Terminó sin texto de respuesta.")}
                  </p>
                </div>

                {archivoVisto && (
                  <FileDownloadCard url={archivoVisto.url} ext={archivoVisto.ext} label={archivoVisto.nombre} />
                )}
                {buscandoArchivo && <p className="neo-text-2 text-[12.5px] font-medium">Buscando el fichero…</p>}
                {verEjecucion.resultado_path && !archivoVisto && !buscandoArchivo && (
                  <p className="neo-text-2 text-[12.5px] font-medium">
                    El fichero ya no está disponible para descargar.
                  </p>
                )}
              </div>
            ) : (
            <>
            {fase === "reposo" && (
              <div
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={onDrop}
                className={`neo-inset rounded-[18px] px-6 py-9 sm:py-11 flex flex-col items-center text-center gap-3.5 transition-opacity ${
                  arrastrando ? "opacity-80" : ""
                }`}
              >
                <Upload size={32} strokeWidth={1.7} className="neo-accent" />
                <p className="neo-text text-[15px] font-extrabold leading-snug">{auto.queSube}</p>
                <p className="neo-text-2 text-[12.5px] font-medium">
                  {auto.extensiones.map((e) => e.replace(".", "").toUpperCase()).join(", ")} · hasta 50 MB
                </p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="neo-primary neo-press inline-flex items-center gap-2 mt-1 px-6 py-3 rounded-full text-[13.5px] font-extrabold"
                >
                  Elegir fichero
                </button>
              </div>
            )}

            {fase === "confirmar" && archivo && (
              <div className="neo-inset rounded-[18px] p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} strokeWidth={2} style={{ color: "var(--neo-danger)" }} className="shrink-0 mt-0.5" />
                  <p className="neo-text text-[13px] font-medium leading-relaxed">{aviso}</p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => lanzar(archivo)}
                    className="neo-primary neo-press px-5 py-2.5 rounded-full text-[13px] font-extrabold"
                  >
                    Enviarlo igualmente
                  </button>
                  <button
                    type="button"
                    onClick={reiniciar}
                    className="neo-white-btn neo-press neo-accent px-5 py-2.5 rounded-full text-[13px] font-bold"
                  >
                    Elegir otro
                  </button>
                </div>
              </div>
            )}

            {trabajando && (
              <div className="neo-inset rounded-[18px] p-5 flex flex-col gap-4">
                {archivo && (
                  <p className="neo-text text-[13.5px] font-extrabold truncate">
                    {archivo.name} <span className="neo-text-2 font-semibold">· {formatoTamano(archivo.size)}</span>
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <span
                    className="w-[18px] h-[18px] rounded-full border-[2.5px] border-[var(--neo-well)] animate-spin shrink-0"
                    style={{ borderTopColor: "var(--neo-accent)" }}
                  />
                  <span className="neo-accent text-[13.5px] font-extrabold">Procesando…</span>
                </div>
                <p className="neo-text-2 text-[12.5px] font-medium leading-relaxed">
                  Puede tardar unos minutos. No cierres la pestaña: si se corta la espera, la ejecución queda en el historial y n8n puede seguir trabajando.
                </p>
              </div>
            )}

            {fase === "en_cola" && enCola && (
              <div className="neo-inset rounded-[18px] p-5 flex flex-col gap-4">
                <p className="neo-text text-[13.5px] font-extrabold truncate">
                  {enCola.archivo_nombre}
                  {archivo && <span className="neo-text-2 font-semibold"> · {formatoTamano(archivo.size)}</span>}
                </p>
                <div className="flex items-center gap-3">
                  <span
                    className="w-[18px] h-[18px] rounded-full border-[2.5px] border-[var(--neo-well)] animate-spin shrink-0"
                    style={{ borderTopColor: "var(--neo-accent)" }}
                  />
                  <span className="neo-accent text-[13.5px] font-extrabold">En marcha</span>
                </div>
                {texto && <p className="neo-text text-[13px] font-medium leading-relaxed whitespace-pre-wrap">{texto}</p>}
                <p className="neo-text-2 text-[12.5px] font-medium leading-relaxed">
                  {auto.duracion} Puedes cerrar esta página: el resultado quedará en «Últimas ejecuciones». Mientras la tengas abierta, se actualiza sola.
                </p>
              </div>
            )}

            {fase === "listo" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <CircleCheck size={22} strokeWidth={2.2} style={{ color: "#1F6B3B" }} />
                  <span className="text-[14px] font-extrabold" style={{ color: "#1F6B3B" }}>Listo</span>
                </div>
                {texto && (
                  <div className="neo-inset rounded-[18px] p-4 sm:p-5">
                    <p className="neo-text text-[13px] font-medium leading-relaxed whitespace-pre-wrap">{texto}</p>
                  </div>
                )}
                {resultado && (
                  <FileDownloadCard url={resultado.url} ext={resultado.ext} label={resultado.nombre} />
                )}
                {!texto && !resultado && (
                  <p className="neo-text-2 text-[13px] font-medium">Terminó sin devolver nada. Revisa la ejecución en n8n.</p>
                )}
                <p className="neo-text-2 text-[12px] font-medium">
                  {resultado ? "También queda en Mis Documentos." : ""}
                </p>
                <button
                  type="button"
                  onClick={reiniciar}
                  className="neo-white-btn neo-press neo-accent self-start px-5 py-2.5 rounded-full text-[13px] font-bold"
                >
                  Subir otro fichero
                </button>
              </div>
            )}

            {fase === "error" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <CircleX size={22} strokeWidth={2.2} style={{ color: "var(--neo-danger)" }} />
                  <span className="text-[14px] font-extrabold" style={{ color: "var(--neo-danger)" }}>No se ha podido procesar</span>
                </div>
                <div className="neo-inset rounded-[18px] p-4 sm:p-5">
                  <p className="neo-text text-[13px] font-medium leading-relaxed whitespace-pre-wrap">{fallo}</p>
                </div>
                <button
                  type="button"
                  onClick={reiniciar}
                  className="neo-white-btn neo-press neo-accent self-start px-5 py-2.5 rounded-full text-[13px] font-bold"
                >
                  Probar con otro fichero
                </button>
              </div>
            )}

            </>
            )}

            {/* Qué espera y qué devuelve: siempre visible, es el motivo de la sección. */}
            <div className="flex flex-col gap-3.5 pt-1">
              <div className="flex gap-3">
                <span className="neo-inset-sm neo-accent w-[30px] h-[30px] rounded-[10px] flex items-center justify-center shrink-0">
                  <Upload size={14} strokeWidth={2.1} />
                </span>
                <p className="neo-text text-[13px] font-medium leading-relaxed">
                  <strong className="font-extrabold">Qué subes:</strong> {auto.queSube}
                </p>
              </div>
              <div className="flex gap-3">
                <span className="neo-inset-sm neo-accent w-[30px] h-[30px] rounded-[10px] flex items-center justify-center shrink-0">
                  <ArrowDownToLine size={14} strokeWidth={2.1} />
                </span>
                <p className="neo-text text-[13px] font-medium leading-relaxed">
                  <strong className="font-extrabold">Qué recibes:</strong> {auto.queRecibe}
                </p>
              </div>
              <div className="flex gap-3">
                <span className="neo-inset-sm neo-accent w-[30px] h-[30px] rounded-[10px] flex items-center justify-center shrink-0">
                  <AlertTriangle size={14} strokeWidth={2.1} />
                </span>
                <p className="neo-text text-[13px] font-medium leading-relaxed">
                  <strong className="font-extrabold">Nombres válidos:</strong> {auto.ejemplos.join(" · ")}
                </p>
              </div>
            </div>
          </section>

          {/* ── HISTORIAL ── */}
          <section className="neo-raised rounded-[22px] p-5 sm:p-6">
            <h2 className="neo-text-2 text-[11px] font-extrabold uppercase tracking-[0.12em] mb-4">Últimas ejecuciones</h2>
            {ejecuciones.length === 0 ? (
              <p className="neo-text-2 text-[13px] font-medium">Todavía no has lanzado esta automatización.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {ejecuciones.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => abrirEjecucion(e)}
                    aria-current={verEjecucion?.id === e.id ? "true" : undefined}
                    className={`w-full text-left rounded-[14px] p-3.5 transition-shadow ${
                      verEjecucion?.id === e.id ? "neo-raised-sm" : "neo-inset-sm hover:opacity-90"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          background:
                            e.estado === "completada" ? "#1F6B3B" : e.estado === "error" ? "var(--neo-danger)" : "var(--neo-accent)",
                        }}
                      />
                      <span className="neo-text text-[13px] font-extrabold flex-1 min-w-0 truncate">{e.archivo_nombre}</span>
                      <span className="neo-text-2 text-[11.5px] font-bold shrink-0">{fechaCorta(e.created_at)}</span>
                      <ChevronRight size={15} className="neo-accent shrink-0" />
                    </div>
                    {e.estado === "error" ? (
                      <p className="text-[12px] font-medium leading-snug" style={{ color: "var(--neo-danger)" }}>{e.error}</p>
                    ) : e.respuesta ? (
                      <p className="neo-text-2 text-[12px] font-medium leading-snug line-clamp-3 whitespace-pre-wrap">{e.respuesta}</p>
                    ) : (
                      <p className="neo-text-2 text-[12px] font-medium">
                        {e.estado === "en_curso" ? "En curso" : "Sin texto de respuesta"}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AutomationRun;
