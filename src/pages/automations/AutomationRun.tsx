import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowDownToLine, ChevronLeft, CircleCheck, CircleX, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import FileDownloadCard from "@/components/FileDownloadCard";
import { fechaCorta, getAutomatizacion, revisarArchivo } from "@/lib/automatizaciones";
import type { ArchivoRespuesta } from "@/lib/n8nRespuesta";
import {
  ejecutarAutomatizacion,
  getEjecuciones,
  type EjecucionAutomatizacion,
} from "@/services/automatizaciones";

type Fase = "reposo" | "confirmar" | "trabajando" | "listo" | "error";

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
  const inputRef = useRef<HTMLInputElement>(null);

  const refrescarHistorial = useCallback(() => {
    if (!slug) return;
    getEjecuciones(slug, 8).then(setEjecuciones).catch(() => {});
  }, [slug]);

  useEffect(() => {
    // Al cambiar de automatización, la pantalla vuelve a empezar.
    setFase("reposo");
    setArchivo(null);
    setAviso(null);
    setTexto(null);
    setResultado(null);
    setFallo(null);
    refrescarHistorial();
  }, [slug, refrescarHistorial]);

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
                  <div key={e.id} className="neo-inset-sm rounded-[14px] p-3.5">
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
                  </div>
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
