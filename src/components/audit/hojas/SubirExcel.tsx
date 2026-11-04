import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Chip } from "@/components/audit/control/ui";
import { leerModeloMensual } from "@/lib/controlExcel";
import { textoDeFecha } from "@/lib/controlHojas";
import { EstadoImportacion, planificarImportacion, PlanImportacion } from "@/lib/controlImportacion";
import { LibroMes } from "@/hooks/useLibroMes";
import { leerParte, pactadasDeDotacion, ParteData } from "@/lib/controlResumen";
import { kpisDe } from "@/services/auditControl";
import {
  aplicarImportacion,
  descargarOriginal,
  getUltimaImportacion,
  Importacion,
  leerArchivoExcel,
} from "@/services/auditImportacion";

type Paso = "elegir" | "leyendo" | "revisar" | "aplicando" | "hecho";

/** Lo mío de este mes tal como se guardaría, que es sobre lo que actúa el Excel. */
const estadoDe = (libro: LibroMes): EstadoImportacion => {
  const partes: Record<string, ParteData> = {};
  for (const fecha of new Set([
    ...Object.keys(libro.jornadas),
    ...Object.keys(libro.inventarios),
    ...libro.lavado.filter((f) => f.dueno === libro.miId).map((f) => f.fecha),
    ...libro.procesado.filter((f) => f.dueno === libro.miId).map((f) => f.fecha),
  ])) {
    partes[fecha] = leerParte(libro.parteDelDia(fecha));
  }
  const metas: Record<string, number | null> = {};
  for (const k of kpisDe(libro.datos.def)) metas[k.key] = k.meta;
  return {
    anio: libro.anio,
    mes: libro.mes,
    hotel: libro.nombreHotel,
    partes,
    control: libro.control,
    eventos: libro.eventos
      .filter((e) => libro.eventoGuardado(e.clave))
      .map((e) => ({ id: libro.eventoGuardado(e.clave), tipo: e.tipo, fecha: e.fecha, data: e.data })),
    prendas: libro.datos.prendas,
    ubicaciones: libro.datos.ubicaciones,
    pactadas: pactadasDeDotacion(libro.datos.dotacion),
    metas,
    mesValidado: libro.mesValidado,
  };
};

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const SubirExcel = ({
  libro,
  abierto,
  onCerrar,
  onIrAMes,
}: {
  libro: LibroMes;
  abierto: boolean;
  onCerrar: () => void;
  onIrAMes: (anio: number, mes: number) => void;
}) => {
  const [paso, setPaso] = useState<Paso>("elegir");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [plan, setPlan] = useState<PlanImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hotelConfirmado, setHotelConfirmado] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [ultima, setUltima] = useState<Importacion | null>(null);
  const [encima, setEncima] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto || !libro.hotelId) return;
    setPaso("elegir");
    setArchivo(null);
    setPlan(null);
    setError(null);
    setHotelConfirmado(false);
    void getUltimaImportacion(libro.hotelId, libro.anio, libro.mes).then(setUltima);
  }, [abierto, libro.anio, libro.hotelId, libro.mes]);

  const elegir = async (f: File | undefined) => {
    if (!f) return;
    setArchivo(f);
    setError(null);
    setPaso("leyendo");
    try {
      // Lo que se esté escribiendo tiene que estar guardado antes de comparar.
      await libro.guardarAhora();
      const lector = await leerArchivoExcel(f);
      const leido = leerModeloMensual(lector);
      setPlan(planificarImportacion(leido, estadoDe(libro)));
      setPaso("revisar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido leer el archivo.");
      setPaso("elegir");
    }
  };

  const aplicar = async () => {
    if (!plan || !archivo || !libro.hotelId || !libro.datos.def) return;
    setPaso("aplicando");
    try {
      const { archivoPath } = await aplicarImportacion({
        hotelId: libro.hotelId,
        def: libro.datos.def,
        anio: libro.anio,
        mes: libro.mes,
        archivo,
        plan,
        onProgreso: setProgreso,
      });
      setUltima({ id: "", archivo_nombre: archivo.name, archivo_path: archivoPath, created_at: new Date().toISOString() });
      setPaso("hecho");
    } catch (err) {
      console.warn("La subida se quedó a medias:", err);
      setError(
        `${err instanceof Error ? err.message : "Se ha cortado"}. Lo que ya entró está guardado: vuelve a subir el mismo archivo para terminar.`
      );
      setPaso("elegir");
      libro.recargar();
    }
  };

  const cerrar = () => {
    if (paso === "aplicando") return;
    const huboCambios = paso === "hecho";
    onCerrar();
    if (huboCambios) libro.recargar();
  };

  const bloqueo = plan?.bloqueos[0];
  const pendienteHotel = !!plan?.hotelDistinto && !hotelConfirmado;
  const nombreMes = new Date(libro.anio, libro.mes - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto !bg-[#FAEFD4] !text-[#0E1333] [&>button]:text-[#0E1333]">
        <DialogHeader>
          <DialogTitle>
            {paso === "hecho" ? "Mes actualizado" : paso === "revisar" && !bloqueo ? "Revisa antes de actualizar" : "Subir el Excel del mes"}
          </DialogTitle>
          <DialogDescription className="!text-[#454B6B]">
            {libro.nombreHotel} · <span className="capitalize">{nombreMes}</span>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p role="alert" className="hx-alerta hx-alerta-mal">
            {error}
          </p>
        )}

        {paso === "elegir" && (
          <div className="flex flex-col gap-4">
            <div
              className={`hx-soltar${encima ? " hx-soltar-encima" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setEncima(true);
              }}
              onDragLeave={() => setEncima(false)}
              onDrop={(e) => {
                e.preventDefault();
                setEncima(false);
                void elegir(e.dataTransfer.files?.[0]);
              }}
            >
              <Upload size={22} aria-hidden />
              <p className="text-sm font-extrabold">Suelta aquí el Excel relleno</p>
              <p className="text-xs font-medium">Modelo Mensual, en .xlsx</p>
              <button type="button" className="hx-btn hx-btn-pri" onClick={() => input.current?.click()}>Elegir archivo</button>
              <input
                ref={input}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-label="Excel del mes"
                className="hidden"
                onChange={(e) => {
                  void elegir(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <ul className="hx-lista">
              <li>Se leen solo las casillas de entrada. Las fórmulas las recalcula la app, igual que al rellenar aquí.</li>
              <li>Antes de cambiar nada verás qué entra, qué cambia y qué no se puede importar.</li>
              <li>Una casilla o un día vacío en el Excel nunca borra lo que ya hay en la app.</li>
              <li>El archivo original queda guardado con el mes.</li>
            </ul>
            {ultima && (
              <p className="text-xs font-semibold">
                Último Excel subido: {ultima.archivo_nombre}, el {fechaHora(ultima.created_at)}.{" "}
                {ultima.archivo_path && (
                  <button type="button" className="underline font-bold" onClick={() => void descargarOriginal(ultima).catch((e) => toast.error(e.message))}>
                    Descargar
                  </button>
                )}
              </p>
            )}
          </div>
        )}

        {(paso === "leyendo" || paso === "aplicando") && (
          <div className="flex items-center gap-3 py-8 justify-center" aria-live="polite">
            <Loader2 size={20} className="animate-spin" aria-hidden />
            <p className="text-sm font-bold">{paso === "leyendo" ? `Leyendo ${archivo?.name ?? "el archivo"}…` : progreso || "Guardando…"}</p>
          </div>
        )}

        {paso === "revisar" && bloqueo && (
          <div className="flex flex-col gap-3">
            <p role="alert" className="hx-alerta hx-alerta-mal">
              {bloqueo.texto} No se ha cambiado nada.
            </p>
            {plan.bloqueos.slice(1).map((b) => (
              <p key={b.texto} className="hx-alerta hx-alerta-mal">
                {b.texto}
              </p>
            ))}
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" className="hx-btn" onClick={() => setPaso("elegir")}>Elegir otro archivo</button>
              {bloqueo.irAMes && (
                <button
                  type="button"
                  className="hx-btn hx-btn-pri"
                  onClick={() => {
                    onCerrar();
                    onIrAMes(bloqueo.irAMes.anio, bloqueo.irAMes.mes);
                  }}
                >
                  Ir a ese mes
                </button>
              )}
            </div>
          </div>
        )}

        {paso === "revisar" && plan && !bloqueo && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-bold mr-1.5">{archivo?.name}</span>
              <Chip tono="ok">11 hojas reconocidas</Chip>
              {plan.hotelDistinto ? <Chip tono="mal">Otro hotel</Chip> : <Chip tono="ok">Hotel correcto</Chip>}
              <Chip tono="ok">
                <span className="capitalize">{nombreMes}</span>
              </Chip>
              {plan.noEntran.length > 0 && <Chip tono="mal">{plan.noEntran.length === 1 ? "1 fila no entra" : `${plan.noEntran.length} filas no entran`}</Chip>}
              {plan.avisos.length > 0 && <Chip tono="aviso">{plan.avisos.length === 1 ? "1 aviso" : `${plan.avisos.length} avisos`}</Chip>}
            </div>

            {plan.hotelDistinto && (
              <label className="hx-alerta hx-alerta-mal flex items-start gap-2">
                <input type="checkbox" className="mt-0.5" checked={hotelConfirmado} onChange={(e) => setHotelConfirmado(e.target.checked)} />
                <span>
                  El Excel dice «{plan.hotelDistinto}» y estás en «{libro.nombreHotel}». Confirmo que este Excel es de este hotel.
                </span>
              </label>
            )}

            <div className="hx-tabla-simple" role="table" aria-label="Cambios por hoja">
              <div className="hx-ts-fila hx-ts-cab" role="row">
                <span role="columnheader">Hoja</span>
                <span role="columnheader" className="text-right">En el Excel</span>
                <span role="columnheader" className="text-right">Nuevas</span>
                <span role="columnheader" className="text-right">Cambian</span>
                <span role="columnheader" className="text-right">Solo en la app, se conservan</span>
                <span role="columnheader">Qué se hará</span>
              </div>
              {plan.hojas.map((h) => (
                <div key={h.hoja} className="hx-ts-fila" role="row">
                  <b role="cell">{h.hoja}</b>
                  <span role="cell" className="text-right">{h.enExcel}</span>
                  <span role="cell" className="text-right">{h.nuevas}</span>
                  <span role="cell" className="text-right">{h.cambian}</span>
                  <span role="cell" className="text-right">{h.soloApp}</span>
                  <span role="cell" className="hx-ts-nota">{h.que}</span>
                </div>
              ))}
            </div>

            {plan.dias.length > 0 && (
              <div>
                <h3 className="hx-subt">Días en los que el Excel sustituye lo que había</h3>
                <ul className="hx-lista">
                  {plan.dias.map((d) => (
                    <li key={`${d.fecha}-${d.hoja}`}>
                      <b>{textoDeFecha(d.fecha)}</b>, {d.hoja}: {d.texto}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plan.noEntran.length > 0 && (
              <div>
                <h3 className="hx-subt hx-subt-mal">No entran: corrige el Excel y vuelve a subirlo, o sigue sin ellas</h3>
                <ul className="hx-lista">
                  {plan.noEntran.map((p, i) => (
                    <li key={i}>
                      <b>
                        {p.hoja}
                        {p.fila ? `, fila ${p.fila}` : ""}
                      </b>
                      : {p.texto}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plan.avisos.length > 0 && (
              <div>
                <h3 className="hx-subt">Avisos: se importan, pero conviene mirarlos</h3>
                <ul className="hx-lista">
                  {plan.avisos.map((p, i) => (
                    <li key={i}>
                      <b>
                        {p.hoja}
                        {p.fila ? `, fila ${p.fila}` : ""}
                      </b>
                      : {p.texto}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <p className="text-sm font-medium flex-1 basis-64">
                {plan.sinCambios ? "Este Excel no cambia nada: la app ya tiene lo mismo." : "Aún no ha cambiado nada."}
              </p>
              <button type="button" className="hx-btn" onClick={cerrar}>Cancelar</button>
              <button type="button" className="hx-btn hx-btn-pri" disabled={plan.sinCambios || pendienteHotel} onClick={() => void aplicar()}>
                {plan.noEntran.length > 0
                  ? `Actualizar el mes sin ${plan.noEntran.length === 1 ? "esa fila" : `esas ${plan.noEntran.length} filas`}`
                  : "Actualizar el mes"}
              </button>
            </div>
          </div>
        )}

        {paso === "hecho" && plan && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium">Las hojas, el dashboard y el informe ya usan estos datos.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                [plan.cifras.dias, "días actualizados"],
                [plan.cifras.diasConservados, "días conservados de la app"],
                [plan.cifras.registros, "registros de detalle"],
                [plan.cifras.sinImportar, "filas sin importar"],
              ].map(([n, t]) => (
                <div key={t} className="hx-cifra">
                  <b>{n}</b>
                  <span>{t}</span>
                </div>
              ))}
            </div>
            {!ultima?.archivo_path && (
              <p className="hx-alerta hx-alerta-aviso">Los datos están guardados, pero el archivo original no se ha podido guardar. Consérvalo tú.</p>
            )}
            <div className="flex flex-wrap justify-end gap-2.5">
              {ultima?.archivo_path && (
                <button type="button" className="hx-btn" onClick={() => void descargarOriginal(ultima).catch((e) => toast.error(e.message))}>
                  Descargar el original
                </button>
              )}
              <button type="button" className="hx-btn hx-btn-pri" onClick={cerrar}>Ver las hojas</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubirExcel;
