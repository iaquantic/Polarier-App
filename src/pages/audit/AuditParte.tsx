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
  /** Identifica el día cargado: hotel, fecha, parte concreto y quién mira. */
  clave: string;
  hotelId: string;
  fecha: string;
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
 * Parte diario (`/auditoria/formularios/parte`). La URL dice qué día se ha pedido, pero
 * lo que se ve y se guarda es siempre el día ya cargado (`carga`). Al elegir otro, el
 * marco se queda y el contenido anterior se atenúa sin poder tocarse; solo se sustituye
 * cuando lo pendiente de ese día está guardado y el nuevo ha llegado entero.
 */
const AuditParte = () => {
  const [searchParams] = useSearchParams();
  const fechaPedida = searchParams.get("fecha") || hoyLocal();
  const subId = searchParams.get("sub");
  const navigate = useNavigate();
  const { activeHotel } = useRole();
  const { user } = useAuth();

  const [carga, setCarga] = useState<Carga | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [sinFormulario, setSinFormulario] = useState(false);
  const [parte, setParte] = useState<ParteData>(parteVacio);
  const [horasComoAyer, setHorasComoAyer] = useState(false);
  const [eventos, setEventos] = useState<ControlEvento[]>([]);
  const [paso, setPaso] = useState<Paso>("Jornada");
  const [informeOpen, setInformeOpen] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [, refrescoHora] = useState(0);
  const cierreGuardado = useRef<string>("Pendiente");

  const clave = `${activeHotel?.id}|${fechaPedida}|${subId ?? ""}|${user?.id}`;
  const cambiando = carga?.clave !== clave;
  // Todo lo que se calcula o se guarda sale del día en pantalla, no del que se ha pedido.
  const fecha = carga?.fecha ?? fechaPedida;
  const [anio, mes] = fecha.split("-").map(Number);
  const rango = useMemo(() => rangoMes(anio, mes), [anio, mes]);

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
    if (!carga) return;
    await saveSubmission({
      hotelId: carga.hotelId,
      formDefinitionId: carga.def.id,
      fecha,
      estado: p.jornada.cierre === "Pendiente" ? "borrador" : "completado",
      data: p as unknown as Record<string, unknown>,
      totales: totalesParte(fecha, p, rango) as unknown as Record<string, unknown>,
    });
    // Un día abierto no cuenta en el mes: el Resumen que lee la routine solo cambia al
    // cerrarlo, al reabrirlo o al corregir uno ya cerrado.
    if (p.jornada.cierre !== "Pendiente" || cierreGuardado.current !== "Pendiente") {
      void refrescarResumenMes(carga.hotelId, anio, mes);
    }
    cierreGuardado.current = p.jornada.cierre;
  };

  const { estado, ultimo, marcarCambio, guardarAhora, vaciar, reiniciar } = useAutoguardado(
    parte,
    guardar,
    !readOnly && !!carga && !cambiando
  );

  useEffect(() => {
    setErrorCarga(null);
    setSinFormulario(false);
    setInformeOpen(false);
    setConfirmarCierre(false);
    // Volver al día que sigue en pantalla, antes de que llegue el otro, no pide nada.
    if (!activeHotel || carga?.clave === clave) return;
    let vivo = true;
    const [anioPedido, mesPedido] = fechaPedida.split("-").map(Number);
    (async () => {
      let aviso = "No se han podido guardar los cambios del día anterior.";
      try {
        // Primero lo pendiente: lo que se lea ahora ya tiene que incluirlo.
        await vaciar();
        if (!vivo) return;
        aviso = "No se ha podido abrir este día.";
        const def = carga?.hotelId === activeHotel.id ? carga.def : await getDefinicionControl(activeHotel.id);
        if (!vivo) return;
        if (!def) {
          setSinFormulario(true);
          setCarga(null);
          reiniciar();
          return;
        }
        const [sub, subsMes, prendas, ubicaciones, dotacion, previo, fila, abiertos, delMes] = await Promise.all([
          subId ? getSubmissionById(subId) : getSubmission(def.id, fechaPedida),
          getSubmissionsByMonth(activeHotel.id, anioPedido, mesPedido),
          getPrendas(activeHotel.id),
          getUbicaciones(activeHotel.id),
          getDotacionLenceria(activeHotel.id).catch(() => null),
          getParteAnterior(def.id, fechaPedida),
          getControlMes(activeHotel.id, anioPedido, mesPedido),
          getEventosAbiertos(activeHotel.id),
          getEventosMes(activeHotel.id, anioPedido, mesPedido),
        ]);
        if (!vivo) return;
        const ajeno = sub && user && sub.user_id !== user.id ? sub.user_id : null;
        const autorAjeno = ajeno ? ((await getAutores([ajeno]))[ajeno] ?? null) : null;
        if (!vivo) return;
        const anterior = previo ? leerParte(previo.data) : null;
        const inicial = sub ? leerParte(sub.data) : parteVacio();
        const comoAyer = !sub && anterior?.jornada.horas_previstas != null;
        if (comoAyer) inicial.jornada.horas_previstas = anterior.jornada.horas_previstas;
        // Todo de golpe: el parte y el día al que pertenece cambian en el mismo render.
        reiniciar();
        setHorasComoAyer(comoAyer);
        setParte(inicial);
        cierreGuardado.current = inicial.jornada.cierre;
        const deHoy = delMes.filter((e) => e.fecha === fechaPedida);
        setEventos([...abiertos, ...deHoy.filter((e) => !abiertos.some((a) => a.id === e.id))]);
        setCarga({
          clave,
          hotelId: activeHotel.id,
          fecha: fechaPedida,
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
        console.warn("No se pudo cambiar de día:", err);
        if (vivo) setErrorCarga(aviso);
      }
    })();
    return () => {
      vivo = false;
    };
    // `clave` ya recoge hotel, fecha, parte y usuario. `carga` se lee al pedir otro día,
    // pero que llegue no debe relanzar nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, intento]);

  // Que «hace 5 s» avance sin depender de otro render.
  useEffect(() => {
    const id = setInterval(() => refrescoHora((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const cambiar = (cambio: Partial<ParteData>) => {
    if (cambiando) return;
    marcarCambio();
    setParte((p) => ({ ...p, ...cambio }));
  };
  const cambiarJornada = (cambio: Partial<Jornada>) => {
    if (cambiando) return;
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
    if (cambiando) return;
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
    if (cambiando) return;
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

  const avisoError = errorCarga && (
    <div role="alert" className="neo-raised-sm rounded-[18px] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold min-w-0">{errorCarga}</p>
      <BotonSecundario onClick={() => setIntento((n) => n + 1)}>Reintentar</BotonSecundario>
    </div>
  );

  if (sinFormulario) {
    return (
      <div className="p-6">
        <p className="neo-raised-sm rounded-[22px] p-5 text-sm text-muted-foreground">
          El parte diario todavía no está disponible para este hotel.
        </p>
      </div>
    );
  }

  // Solo la primera vez: después, el día anterior sigue en pantalla mientras llega el nuevo.
  if (!carga || !activeHotel) {
    return errorCarga ? (
      <div className="p-6">{avisoError}</div>
    ) : (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  // Con un poco de retraso, como `.parte-dia`: si el día llega enseguida, no llega a atenuarse.
  const atenuado = cambiando ? "opacity-50 transition-opacity duration-150 delay-100 motion-reduce:transition-none" : "";
  const fechaLarga = new Date(`${fechaPedida}T00:00:00`).toLocaleDateString("es-ES", {
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
            {/* En móvil, una línea para cada cosa: si no, según lo largo que sea el nombre del día, la
                cabecera ocupa una línea más o menos y todo lo de abajo salta al cambiar de día. */}
            <p className="text-sm font-medium opacity-80">
              <span className="block sm:inline">
                {activeHotel.nombre}
                <span className="hidden sm:inline"> · </span>
              </span>
              <span className="block sm:inline">{fechaLarga}</span>
              {!cambiando && carga.autorAjeno && (
                <span className="block sm:inline">
                  <span className="hidden sm:inline"> · </span>Rellenado por {carga.autorAjeno.nombre}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {cambiando ? (
              <span aria-live="polite" className="text-xs font-bold bg-white/20 px-3 py-1.5 rounded-full">
                {errorCarga ? "Sin cargar" : "Cargando…"}
              </span>
            ) : readOnly ? (
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
              disabled={cambiando}
              onClick={() => setInformeOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold neo-press bg-white/20 hover:bg-white/30 disabled:opacity-60 px-3 py-1.5 rounded-full"
            >
              <FileText size={14} /> Ver informe del día
            </button>
          </div>
        </header>

        <DiasMes
          anio={anio}
          mes={mes}
          partes={
            carga.sub || ultimo || estado !== "guardado"
              ? [...carga.partesDelMes, { fecha, data: parte }]
              : carga.partesDelMes
          }
          seleccion={fechaPedida}
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
              <span
                className={`block text-[11px] font-semibold truncate ${p === paso ? "" : "text-muted-foreground"} ${
                  atenuado || (p === paso ? "opacity-80" : "")
                }`}
              >
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
            <span className={`text-[11px] font-semibold text-muted-foreground ${atenuado}`}>{resumenPaso[paso]}</span>
          </div>
          <div aria-hidden className="flex gap-1 mt-2">
            {PASOS.map((p, i) => (
              <i key={p} className={`flex-1 h-1.5 rounded-full ${i <= indice ? "bg-primary" : "bg-primary/20"}`} />
            ))}
          </div>
        </div>

        {avisoError}

        {/* Lo único que cambia con el día. Mientras llega el nuevo se ve el anterior, sin poder tocarlo. */}
        <div key={carga.clave} aria-busy={cambiando} {...(cambiando ? { inert: "" } : {})} className="parte-dia flex flex-col gap-4">
          {readOnly && (
            <p className="neo-raised-sm rounded-[18px] px-4 py-2.5 text-sm font-semibold text-muted-foreground">
              <span>{motivoSoloLectura}</span>
            </p>
          )}

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
              hotelId={carga.hotelId}
              fecha={fecha}
              eventos={eventos}
              readOnly={!!carga.autorAjeno}
              onCambio={(e) => {
                setEventos((prev) =>
                  prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [e, ...prev]
                );
                void refrescarResumenMes(carga.hotelId, anio, mes);
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
