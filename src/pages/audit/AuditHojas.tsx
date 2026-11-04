import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileText, Loader2, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useRole } from "@/context/RoleContext";
import { hoyLocal, pad2 } from "@/lib/control";
import { HOJAS, Hoja, TEXTOS_HOJA } from "@/lib/controlHojas";
import { buildInformeMes, buildInformeParte } from "@/lib/informeControl";
import { textoGuardado } from "@/hooks/useAutoguardado";
import { LibroMes, useLibroMes } from "@/hooks/useLibroMes";
import { ControlEvento, saveResumenMes, solicitarInformeMensual } from "@/services/audit";
import InformePreview from "@/components/audit/InformePreview";
import { BotonSecundario } from "@/components/audit/control/ui";
import { HojaLavado, HojaProcesado } from "@/components/audit/hojas/HojasDetalle";
import { HojaInventario } from "@/components/audit/hojas/HojaInventario";
import {
  HojaAcciones,
  HojaDatos,
  HojaEquipos,
  HojaIncidencias,
  HojaKpi,
  HojaOperacion,
  HojaResumen,
  HojaRetiros,
  parteParaInforme,
} from "@/components/audit/hojas/HojasMes";
import { Mini } from "@/components/audit/hojas/TablaHoja";
import SubirExcel from "@/components/audit/hojas/SubirExcel";

const claveMes = (anio: number, mes: number) => `${anio}-${pad2(mes)}`;

const eventosParaInforme = (libro: LibroMes): ControlEvento[] =>
  libro.eventos
    .filter((e) => e.fecha || e.tipo === "mantenimiento")
    .map((e) => ({ id: e.clave, hotel_id: libro.hotelId, tipo: e.tipo, fecha: e.fecha, data: e.data, user_id: null, updated_at: "" }));

type Informe = { tipo: "dia"; fecha: string } | { tipo: "mes" };

const Libro = ({ clave, hoja, fecha }: { clave: string; hoja: Hoja; fecha: string | null }) => {
  const navigate = useNavigate();
  const [, setSp] = useSearchParams();
  const { activeHotel } = useRole();
  const { user } = useAuth();
  const [anio, mes] = clave.split("-").map(Number);
  const libro = useLibroMes(activeHotel?.id, activeHotel?.nombre ?? "", user?.id ?? null, anio, mes);
  const [subiendo, setSubiendo] = useState(false);
  const [informe, setInforme] = useState<Informe | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [, refrescoHora] = useState(0);

  useEffect(() => {
    const id = setInterval(() => refrescoHora((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const ir = (cambios: { mes?: string; hoja?: Hoja; fecha?: string }) => {
    setSp(
      (sp) => {
        const n = new URLSearchParams(sp);
        if (cambios.mes) n.set("mes", cambios.mes);
        if (cambios.hoja) n.set("hoja", cambios.hoja);
        if (cambios.fecha) n.set("fecha", cambios.fecha);
        if (cambios.mes) n.delete("fecha");
        return n;
      },
      { replace: !!cambios.fecha }
    );
  };

  const moverMes = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1);
    ir({ mes: claveMes(d.getFullYear(), d.getMonth() + 1) });
  };

  const generar = async () => {
    if (!activeHotel) return;
    setPidiendo(true);
    try {
      await libro.guardarAhora();
      const resumen = libro.calcularResumen();
      if (resumen) await saveResumenMes(activeHotel.id, anio, mes, resumen);
      const { disparada } = await solicitarInformeMensual(activeHotel.id, anio, mes);
      toast.success(disparada ? "Informe solicitado. Tarda un par de minutos en escribirse." : "Informe encolado. Se generará en la próxima pasada de la routine.");
      navigate(`/auditoria/historico/${clave}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo solicitar el informe");
    } finally {
      setPidiendo(false);
    }
  };

  if (libro.cargando && !libro.datos) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }
  if (libro.error) {
    return (
      <div className="p-6">
        <div role="alert" className="neo-raised-sm rounded-[18px] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold min-w-0">{libro.error}</p>
          <BotonSecundario onClick={libro.recargar}>Reintentar</BotonSecundario>
        </div>
      </div>
    );
  }
  if (!libro.datos?.def || !activeHotel) {
    return (
      <div className="p-6">
        <p className="neo-raised-sm rounded-[22px] p-5 text-sm text-muted-foreground">El parte diario todavía no está disponible para este hotel.</p>
      </div>
    );
  }

  const nombreMes = new Date(anio, mes - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const textos = TEXTOS_HOJA[hoja];
  const puedeSubir = !libro.hayAjenos && !libro.mesValidado;
  const motivoNoSubir = libro.mesValidado
    ? "El mes está validado. Para subir otro Excel, pon Revisión del mes en Pendiente en la hoja Operacion."
    : "Este mes tiene partes de otra persona: un Excel se sumaría a ellos.";

  const filtro = fecha === "todo" ? null : fecha;
  const proposHoja = {
    libro,
    fechaFiltro: filtro,
    onFechaFiltro: (f: string | null) => ir({ fecha: f ?? "todo" }),
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 pt-3 sm:px-6 sm:pt-6">
      <div className="max-w-[1680px] mx-auto flex flex-col gap-3">
        <header className="neo-primary rounded-[22px] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold">Parte diario de control</h1>
            <p className="text-sm font-medium opacity-80">
              {activeHotel.nombre} ·{" "}
              <span aria-live="polite">
                {libro.hayAjenos ? "Lo de otra persona solo se puede leer · " : ""}
                {textoGuardado(libro.estadoGuardado, libro.ultimo)}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-label="Mes anterior" onClick={() => moverMes(-1)} className="p-2 rounded-full bg-white/20 hover:bg-white/30">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-extrabold capitalize min-w-[140px] text-center">{nombreMes}</span>
            <button type="button" aria-label="Mes siguiente" onClick={() => moverMes(1)} className="p-2 rounded-full bg-white/20 hover:bg-white/30">
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              disabled={!puedeSubir}
              title={puedeSubir ? undefined : motivoNoSubir}
              onClick={() => setSubiendo(true)}
              className="inline-flex items-center gap-1.5 min-h-[40px] text-sm font-extrabold neo-press bg-white text-[#283579] hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed px-4 rounded-full"
            >
              <Upload size={15} aria-hidden /> Subir Excel
            </button>
          </div>
        </header>

        {!puedeSubir && (
          <p className="neo-raised-sm rounded-[18px] px-4 py-2.5 text-sm font-semibold text-muted-foreground">Subir Excel no está disponible: {motivoNoSubir}</p>
        )}

        <section className="hx" aria-label={`Hoja ${hoja}`}>
          <div className="hx-cab">
            <h2 className="hx-tit">{textos.titulo}</h2>
            <button type="button" className="hx-mini sm:hidden mt-1" aria-expanded={ayuda} onClick={() => setAyuda((a) => !a)}>
              {ayuda ? "Ocultar instrucciones" : "Ver instrucciones"}
            </button>
            <p className={`hx-ins ${ayuda ? "" : "hidden sm:block"}`}>{textos.instruccion}</p>
            <p className={`hx-ley ${ayuda ? "" : "hidden sm:block"}`}>{textos.leyenda}</p>
          </div>

          {hoja === "Resumen" && (
            <HojaResumen
              libro={libro}
              acciones={
                <>
                  <Mini onClick={() => setInforme({ tipo: "mes" })}>
                    <FileText size={13} aria-hidden /> Ver el informe del mes
                  </Mini>
                  <Mini disabled={pidiendo} onClick={() => void generar()}>
                    {pidiendo ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Wand2 size={13} aria-hidden />} Generar informe mensual
                  </Mini>
                </>
              }
            />
          )}
          {hoja === "Datos_mes" && <HojaDatos libro={libro} />}
          {hoja === "Operacion" && <HojaOperacion libro={libro} onVerInforme={(f) => setInforme({ tipo: "dia", fecha: f })} />}
          {hoja === "KPI_calidad" && <HojaKpi libro={libro} />}
          {hoja === "Incidencias" && <HojaIncidencias libro={libro} />}
          {hoja === "Equipos" && <HojaEquipos libro={libro} />}
          {hoja === "Retiros_importes" && <HojaRetiros libro={libro} />}
          {hoja === "Acciones" && <HojaAcciones libro={libro} />}
          {hoja === "Lavado_detalle" && <HojaLavado {...proposHoja} />}
          {hoja === "Procesado_detalle" && <HojaProcesado {...proposHoja} />}
          {/* Abre en el día de hoy: el mes entero son más de 400 filas. */}
          {hoja === "Inventario" && <HojaInventario {...proposHoja} fechaFiltro={fecha ? filtro : libro.fechaPorDefecto(null)} />}

          <div className="hx-pestanas" role="tablist" aria-label="Hojas del libro">
            {HOJAS.map((h) => (
              <button key={h} type="button" role="tab" aria-selected={h === hoja} className={`hx-pestana${h === hoja ? " hx-pestana-on" : ""}`} onClick={() => ir({ hoja: h })}>
                {h}
              </button>
            ))}
          </div>
        </section>

      </div>

      <SubirExcel libro={libro} abierto={subiendo} onCerrar={() => setSubiendo(false)} onIrAMes={(a, m) => ir({ mes: claveMes(a, m) })} />

      {informe?.tipo === "dia" && (
        <InformePreview
          informe={buildInformeParte({
            fecha: informe.fecha,
            data: parteParaInforme(libro, informe.fecha),
            hotel: activeHotel.nombre,
            polo: activeHotel.polo?.nombre ?? undefined,
            prendas: libro.datos.prendas,
            ubicaciones: libro.datos.ubicaciones,
            eventos: eventosParaInforme(libro),
          })}
          fecha={informe.fecha}
          onClose={() => setInforme(null)}
        />
      )}
      {informe?.tipo === "mes" && libro.resumen && (
        <InformePreview
          informe={buildInformeMes({
            resumen: libro.resumen,
            hotel: activeHotel.nombre,
            polo: activeHotel.polo?.nombre ?? undefined,
            eventos: eventosParaInforme(libro),
          })}
          fecha={clave}
          onClose={() => setInforme(null)}
        />
      )}
    </div>
  );
};

/** El mes como libro (`/auditoria/formularios?mes=AAAA-MM&hoja=…&fecha=…`). */
const AuditHojas = () => {
  const [sp] = useSearchParams();
  const fecha = sp.get("fecha");
  const clave = sp.get("mes") || (fecha && fecha !== "todo" ? fecha.slice(0, 7) : hoyLocal().slice(0, 7));
  const pedida = sp.get("hoja") as Hoja;
  const hoja: Hoja = HOJAS.includes(pedida) ? pedida : "Lavado_detalle";
  return <Libro key={clave} clave={clave} hoja={hoja} fecha={fecha} />;
};

/** Enlaces antiguos al parte de un día. */
export const RedirigirParte = () => {
  const [sp] = useSearchParams();
  const fecha = sp.get("fecha") ?? hoyLocal();
  return <Navigate replace to={`/auditoria/formularios?mes=${fecha.slice(0, 7)}&hoja=Operacion&fecha=${fecha}`} />;
};

/** Enlaces antiguos al cierre de un mes. */
export const RedirigirCierre = () => {
  const [sp] = useSearchParams();
  return <Navigate replace to={`/auditoria/formularios?mes=${sp.get("mes") ?? hoyLocal().slice(0, 7)}&hoja=Datos_mes`} />;
};

export default AuditHojas;
