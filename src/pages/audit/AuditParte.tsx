import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import { useRole } from "@/context/RoleContext";
import { hoyLocal, Jornada, rangoMes } from "@/lib/control";
import {
  leerControlMes,
  leerParte,
  pactadasDeDotacion,
  ParteData,
  parteVacio,
  totalesParte,
} from "@/lib/controlResumen";
import { buildInformeParte } from "@/lib/informeControl";
import { textoGuardado, useAutoguardado } from "@/hooks/useAutoguardado";
import {
  Autor,
  ControlEvento,
  FormDefinition,
  FormSubmission,
  getAutores,
  getControlMes,
  getDefinicionControl,
  getDotacionLenceria,
  getEventosAbiertos,
  getEventosMes,
  getParteAnterior,
  getPrendas,
  getSubmission,
  getSubmissionById,
  getSubmissionsByMonth,
  getUbicaciones,
  Prenda,
  saveSubmission,
  Ubicacion,
} from "@/services/audit";
import { refrescarResumenMes } from "@/services/auditControl";
import InformePreview from "@/components/audit/InformePreview";
import DiasMes from "@/components/audit/control/DiasMes";
import PasoInventario from "@/components/audit/control/PasoInventario";
import PasoJornada from "@/components/audit/control/PasoJornada";
import PasoLavado from "@/components/audit/control/PasoLavado";
import PasoNovedades from "@/components/audit/control/PasoNovedades";
import PasoProcesado from "@/components/audit/control/PasoProcesado";
import { BotonPrincipal, BotonSecundario, Chip } from "@/components/audit/control/ui";

const PASOS = ["Jornada", "Lavado", "Procesado", "Inventario", "Novedades"] as const;
type Paso = (typeof PASOS)[number];

interface Carga {
  def: FormDefinition;
  sub: FormSubmission | null;
  partesDelMes: FormSubmission[];
  prendas: Prenda[];
  ubicaciones: Ubicacion[];
  dotacion: Record<string, Record<string, number>> | null;
  anterior: ParteData | null;
  mesValidado: boolean;
  eventos: ControlEvento[];
  autorAjeno: Autor | null;
}

/**
 * Parte diario (`/auditoria/formularios/parte`). La fecha va en la URL y el formulario
 * se monta de nuevo por cada día, de modo que cambiar de día guarda lo pendiente del
 * anterior sin arriesgarse a escribirlo en el nuevo.
 */
const AuditParte = () => {
  const [searchParams] = useSearchParams();
  const fecha = searchParams.get("fecha") || hoyLocal();
  const subId = searchParams.get("sub");
  return <ParteDiario key={`${fecha}|${subId ?? ""}`} fecha={fecha} subId={subId} />;
};

const ParteDiario = ({ fecha, subId }: { fecha: string; subId: string | null }) => {
  const navigate = useNavigate();
  const { activeHotel } = useRole();
  const { user } = useAuth();

  const [anio, mes] = fecha.split("-").map(Number);
  const rango = useMemo(() => rangoMes(anio, mes), [anio, mes]);

  const [carga, setCarga] = useState<Carga | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sinFormulario, setSinFormulario] = useState(false);
  const [parte, setParte] = useState<ParteData>(parteVacio);
  const [horasComoAyer, setHorasComoAyer] = useState(false);
  const [eventos, setEventos] = useState<ControlEvento[]>([]);
  const [paso, setPaso] = useState<Paso>("Jornada");
  const [informeOpen, setInformeOpen] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [, refrescoHora] = useState(0);
  const cierreGuardado = useRef<string>("Pendiente");

  useEffect(() => {
    if (!activeHotel) return;
    let vivo = true;
    (async () => {
      setCargando(true);
      try {
        const def = await getDefinicionControl(activeHotel.id);
        if (!def) {
          if (vivo) setSinFormulario(true);
          return;
        }
        const [sub, subsMes, prendas, ubicaciones, dotacion, previo, fila, abiertos, delMes] = await Promise.all([
          subId ? getSubmissionById(subId) : getSubmission(def.id, fecha),
          getSubmissionsByMonth(activeHotel.id, anio, mes),
          getPrendas(activeHotel.id),
          getUbicaciones(activeHotel.id),
          getDotacionLenceria(activeHotel.id).catch(() => null),
          getParteAnterior(def.id, fecha),
          getControlMes(activeHotel.id, anio, mes),
          getEventosAbiertos(activeHotel.id),
          getEventosMes(activeHotel.id, anio, mes),
        ]);
        if (!vivo) return;
        const ajeno = sub && user && sub.user_id !== user.id ? sub.user_id : null;
        const autorAjeno = ajeno ? ((await getAutores([ajeno]))[ajeno] ?? null) : null;
        const anterior = previo ? leerParte(previo.data) : null;
        const inicial = sub ? leerParte(sub.data) : parteVacio();
        if (!sub && anterior?.jornada.horas_previstas != null) {
          inicial.jornada.horas_previstas = anterior.jornada.horas_previstas;
          setHorasComoAyer(true);
        }
        setParte(inicial);
        cierreGuardado.current = inicial.jornada.cierre;
        const deHoy = delMes.filter((e) => e.fecha === fecha);
        setEventos([...abiertos, ...deHoy.filter((e) => !abiertos.some((a) => a.id === e.id))]);
        setCarga({
          def,
          sub,
          // El parte que se está editando va aparte: si no, se contaría dos veces.
          partesDelMes: subsMes.filter((s) => s.form_definition_id === def.id && s.id !== sub?.id),
          prendas,
          ubicaciones,
          dotacion,
          anterior,
          mesValidado: leerControlMes(fila?.data).revision.operacion === "Validado",
          eventos: abiertos,
          autorAjeno,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error cargando el parte");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [activeHotel?.id, fecha, subId, user?.id, anio, mes]);

  // Un parte ajeno nunca se edita (guardarlo crearía una copia a nombre de quien
  // mira) y un mes validado ya está cerrado. El futuro todavía no se puede rellenar.
  const motivoSoloLectura = !carga
    ? null
    : carga.autorAjeno
      ? `Este parte lo firma ${carga.autorAjeno.nombre}. Solo quien lo rellenó puede modificarlo.`
      : fecha > hoyLocal()
        ? "Este día todavía no ha llegado."
        : carga.mesValidado
          ? "El mes está validado. Para corregirlo, vuelve «Jornada y lavado» a Pendiente en Cierre del mes."
          : null;
  const readOnly = motivoSoloLectura !== null;

  const guardar = async (p: ParteData) => {
    if (!activeHotel || !carga) return;
    await saveSubmission({
      hotelId: activeHotel.id,
      formDefinitionId: carga.def.id,
      fecha,
      estado: p.jornada.cierre === "Pendiente" ? "borrador" : "completado",
      data: p as unknown as Record<string, unknown>,
      totales: totalesParte(fecha, p, rango) as unknown as Record<string, unknown>,
    });
    // Un día abierto no cuenta en el mes: el Resumen que lee la routine solo cambia al
    // cerrarlo, al reabrirlo o al corregir uno ya cerrado.
    if (p.jornada.cierre !== "Pendiente" || cierreGuardado.current !== "Pendiente") {
      void refrescarResumenMes(activeHotel.id, anio, mes);
    }
    cierreGuardado.current = p.jornada.cierre;
  };

  const { estado, ultimo, marcarCambio, guardarAhora } = useAutoguardado(parte, guardar, !readOnly && !!carga);

  // Que «hace 5 s» avance sin depender de otro render.
  useEffect(() => {
    const id = setInterval(() => refrescoHora((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const cambiar = (cambio: Partial<ParteData>) => {
    marcarCambio();
    setParte((p) => ({ ...p, ...cambio }));
  };
  const cambiarJornada = (cambio: Partial<Jornada>) => {
    marcarCambio();
    setParte((p) => ({ ...p, jornada: { ...p.jornada, ...cambio } }));
  };

  const t = useMemo(() => totalesParte(fecha, parte, rango), [fecha, parte, rango]);
  const abiertas = eventos.filter((e) => (e.data as { estado?: string }).estado !== "Cerrada").length;
  const nombresPrenda = useMemo(() => (carga?.prendas ?? []).map((p) => p.nombre), [carga?.prendas]);

  const resumenPaso: Record<Paso, string> = {
    Jornada: parte.jornada.cierre,
    Lavado: `${parte.lavado.length} ${parte.lavado.length === 1 ? "vale" : "vales"}${
      t.por_revisar_lavado ? ` · ${t.por_revisar_lavado} por revisar` : ""
    }`,
    Procesado: `${t.registros_procesado} registros${t.por_revisar_procesado ? ` · ${t.por_revisar_procesado} por revisar` : ""}`,
    Inventario: `${t.ubicaciones_contadas} contadas hoy`,
    Novedades: `${abiertas} ${abiertas === 1 ? "abierta" : "abiertas"}`,
  };

  const cerrar = async () => {
    setConfirmarCierre(false);
    marcarCambio();
    const cerrado: ParteData = { ...parte, jornada: { ...parte.jornada, cierre: "Cerrado" } };
    setParte(cerrado);
    try {
      await guardarAhora(cerrado);
      toast.success("Jornada cerrada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cerrar la jornada");
    }
  };

  const guardarBorrador = async () => {
    marcarCambio();
    try {
      await guardarAhora();
      toast.success("Guardado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    }
  };

  const porCorregir = t.por_revisar_lavado + t.por_revisar_procesado;
  const textoPorCorregir = [
    t.por_revisar_lavado ? `${t.por_revisar_lavado} de Lavado` : null,
    t.por_revisar_procesado ? `${t.por_revisar_procesado} de Procesado` : null,
  ]
    .filter(Boolean)
    .join(" y ");

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (sinFormulario || !carga || !activeHotel) {
    return (
      <div className="p-6">
        <p className="neo-raised-sm rounded-[22px] p-5 text-sm text-muted-foreground">
          El parte diario todavía no está disponible para este hotel.
        </p>
      </div>
    );
  }

  const fechaLarga = new Date(`${fecha}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const indice = PASOS.indexOf(paso);
  const irAFecha = (f: string) => navigate(`/auditoria/formularios/parte?fecha=${f}`);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-4">
        <header className="neo-primary rounded-[22px] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold">Parte diario de control</h1>
            <p className="text-sm font-medium opacity-80">
              {activeHotel.nombre} · {fechaLarga}
              {carga.autorAjeno && <> · Rellenado por {carga.autorAjeno.nombre}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {readOnly ? (
              <span title={motivoSoloLectura ?? undefined} className="flex items-center gap-1.5 text-xs font-bold bg-white/20 px-3 py-1.5 rounded-full">
                <Eye size={14} /> Solo lectura
              </span>
            ) : (
              <span aria-live="polite" className="text-xs font-bold bg-white/20 px-3 py-1.5 rounded-full">
                {textoGuardado(estado, ultimo)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setInformeOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold neo-press bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full"
            >
              <FileText size={14} /> Ver informe del día
            </button>
          </div>
        </header>

        {readOnly && (
          <p className="neo-raised-sm rounded-[18px] px-4 py-2.5 text-sm font-semibold text-muted-foreground">
            {motivoSoloLectura}
          </p>
        )}

        <DiasMes
          anio={anio}
          mes={mes}
          partes={
            carga.sub || ultimo || estado !== "guardado"
              ? [...carga.partesDelMes, { fecha, data: parte }]
              : carga.partesDelMes
          }
          seleccion={fecha}
          onElegir={irAFecha}
        />

        {/* Pasos: pestañas en escritorio; en móvil, «2 de 5» y Anterior/Siguiente abajo. */}
        <nav aria-label="Pasos del parte" className="neo-raised-sm rounded-[22px] p-2 hidden sm:flex gap-1.5">
          {PASOS.map((p, i) => (
            <button
              key={p}
              type="button"
              aria-current={p === paso ? "step" : undefined}
              onClick={() => setPaso(p)}
              className={`flex-1 min-w-0 text-left rounded-2xl px-3.5 py-2.5 transition-colors ${
                p === paso ? "neo-primary" : "hover:bg-[var(--neo-well)]"
              }`}
            >
              <b className="block text-[13px] font-extrabold truncate">
                {i + 1} · {p}
              </b>
              <span className={`block text-[11px] font-semibold truncate ${p === paso ? "opacity-80" : "text-muted-foreground"}`}>
                {resumenPaso[p]}
              </span>
            </button>
          ))}
        </nav>
        <div className="sm:hidden neo-raised-sm rounded-[20px] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-extrabold">
              {indice + 1} de {PASOS.length} · {paso}
            </p>
            <span className="text-[11px] font-semibold text-muted-foreground">{resumenPaso[paso]}</span>
          </div>
          <div aria-hidden className="flex gap-1 mt-2">
            {PASOS.map((p, i) => (
              <i key={p} className={`flex-1 h-1.5 rounded-full ${i <= indice ? "bg-primary" : "bg-primary/20"}`} />
            ))}
          </div>
        </div>

        {paso === "Jornada" && (
          <PasoJornada
            fecha={fecha}
            rango={rango}
            parte={parte}
            horasComoAyer={horasComoAyer}
            readOnly={readOnly}
            onChange={cambiarJornada}
          />
        )}
        {paso === "Lavado" && (
          <PasoLavado
            fecha={fecha}
            rango={rango}
            parte={parte}
            prendas={nombresPrenda}
            anterior={carga.anterior}
            readOnly={readOnly}
            onChange={(lavado) => cambiar({ lavado })}
          />
        )}
        {paso === "Procesado" && (
          <PasoProcesado
            fecha={fecha}
            rango={rango}
            parte={parte}
            prendas={nombresPrenda}
            readOnly={readOnly}
            onChange={(procesado) => cambiar({ procesado })}
          />
        )}
        {paso === "Inventario" && (
          <PasoInventario
            fecha={fecha}
            parte={parte}
            partesDelMes={carga.partesDelMes}
            prendas={carga.prendas}
            ubicaciones={carga.ubicaciones}
            dotacion={carga.dotacion}
            pactadas={pactadasDeDotacion(carga.dotacion)}
            readOnly={readOnly}
            onChange={(inventario) => cambiar({ inventario })}
          />
        )}
        {paso === "Novedades" && (
          <PasoNovedades
            hotelId={activeHotel.id}
            fecha={fecha}
            eventos={eventos}
            readOnly={!!carga.autorAjeno}
            onCambio={(e) => {
              setEventos((prev) =>
                prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [e, ...prev]
              );
              void refrescarResumenMes(activeHotel.id, anio, mes);
            }}
          />
        )}

        <div className="neo-raised-sm rounded-[22px] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:hidden w-full">
            <BotonSecundario className="flex-1" disabled={indice === 0} onClick={() => setPaso(PASOS[indice - 1])}>
              <ArrowLeft size={15} /> Anterior
            </BotonSecundario>
            <BotonSecundario className="flex-1" disabled={indice === PASOS.length - 1} onClick={() => setPaso(PASOS[indice + 1])}>
              Siguiente <ArrowRight size={15} />
            </BotonSecundario>
          </div>
          <p className="text-xs font-bold text-muted-foreground min-w-0 flex-1 basis-56">
            {parte.jornada.cierre === "Cerrado" ? (
              <Chip tono={porCorregir ? "mal" : "ok"}>
                {porCorregir ? `Cerrada con ${porCorregir} por revisar` : "Jornada cerrada"}
              </Chip>
            ) : porCorregir ? (
              `Para cerrar: ${textoPorCorregir} por corregir`
            ) : (
              "Al terminar el día, cierra la jornada para que cuente en el mes."
            )}
          </p>
          {!readOnly && (
            <div className="flex flex-wrap gap-2.5">
              <BotonSecundario onClick={guardarBorrador}>
                <Save size={15} /> Guardar borrador
              </BotonSecundario>
              {parte.jornada.cierre !== "Cerrado" && (
                <BotonPrincipal
                  onClick={() => {
                    if (porCorregir || t.registros_lavado === 0) setConfirmarCierre(true);
                    else void cerrar();
                  }}
                >
                  <CheckCircle2 size={16} /> Cerrar jornada
                </BotonPrincipal>
              )}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmarCierre} onOpenChange={setConfirmarCierre}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar la jornada así?</AlertDialogTitle>
            <AlertDialogDescription>
              {t.registros_lavado === 0
                ? "Este día no tiene ningún vale de lavado. Si no hubo actividad, marca «Sin actividad» en Jornada; si cierras así, el día se queda en «Completar detalle» y no cuenta en el mes."
                : `Quedan ${textoPorCorregir} por corregir. Los kg y las piezas de este día no contarán en el mes hasta que estén completos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir corrigiendo</AlertDialogCancel>
            <AlertDialogAction onClick={() => void cerrar()}>Cerrar igualmente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {informeOpen && (
        <InformePreview
          informe={buildInformeParte({
            fecha,
            data: parte,
            hotel: activeHotel.nombre,
            polo: activeHotel.polo?.nombre ?? undefined,
            prendas: carga.prendas,
            ubicaciones: carga.ubicaciones,
            eventos,
          })}
          fecha={fecha}
          onClose={() => setInformeOpen(false)}
        />
      )}
    </div>
  );
};

export default AuditParte;
