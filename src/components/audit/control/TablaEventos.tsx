import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { importeRetiro, RangoMes, situacionAccion, Accion, Retiro } from "@/lib/control";
import { ControlEvento, deleteEvento, TipoEventoControl } from "@/services/audit";
import EventoEditor, { TITULO_EVENTO } from "./EventoEditor";
import { BotonSecundario, Chip, fmtCelda, tonoDe } from "./ui";

const corta = (f: unknown): string =>
  typeof f === "string" && f
    ? new Date(`${f}T00:00:00`).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
    : "—";

type Columna = { titulo: string; ancho: string; celda: (e: ControlEvento, r: RangoMes) => React.ReactNode };
const dato = (e: ControlEvento, k: string) => (e.data as Record<string, unknown>)[k];
const texto = (k: string) => (e: ControlEvento) => fmtCelda(dato(e, k));

const COLUMNAS: Record<TipoEventoControl, Columna[]> = {
  incidencia: [
    { titulo: "Fecha", ancho: ".7fr", celda: (e) => corta(e.fecha) },
    { titulo: "Causa", ancho: ".9fr", celda: texto("causa") },
    { titulo: "Horas", ancho: ".5fr", celda: texto("duracion") },
    { titulo: "Impacto", ancho: "1.8fr", celda: texto("impacto") },
    { titulo: "Acción", ancho: "1.8fr", celda: texto("accion") },
    { titulo: "Responsable", ancho: "1fr", celda: texto("responsable") },
    { titulo: "Cierre", ancho: ".65fr", celda: (e) => corta(dato(e, "fecha_cierre")) },
    { titulo: "Imputable", ancho: ".9fr", celda: texto("imputable") },
    { titulo: "Parte", ancho: ".7fr", celda: texto("parte") },
    { titulo: "Estado", ancho: "1fr", celda: (e) => <Chip tono={tonoDe(dato(e, "estado"))}>{fmtCelda(dato(e, "estado"))}</Chip> },
  ],
  mantenimiento: [
    { titulo: "Tarea", ancho: "1.5fr", celda: texto("tarea") },
    { titulo: "Equipo", ancho: "1fr", celda: texto("equipo") },
    { titulo: "Tipo", ancho: ".85fr", celda: texto("tipo") },
    { titulo: "Planificada", ancho: ".7fr", celda: (e) => corta(dato(e, "fecha_planificada")) },
    { titulo: "Ejecutada", ancho: ".7fr", celda: (e) => corta(dato(e, "fecha_ejecutada")) },
    { titulo: "Trabajo y resultado", ancho: "1.8fr", celda: texto("trabajo") },
    { titulo: "Pendiente", ancho: "1fr", celda: texto("pendiente") },
    { titulo: "Responsable", ancho: "1fr", celda: texto("responsable") },
    { titulo: "Próxima", ancho: ".7fr", celda: (e) => corta(dato(e, "proxima")) },
    { titulo: "Documento", ancho: ".8fr", celda: texto("documento") },
  ],
  retiro: [
    { titulo: "Fecha", ancho: ".65fr", celda: (e) => corta(e.fecha) },
    { titulo: "Concepto", ancho: ".85fr", celda: texto("concepto") },
    { titulo: "Prendas", ancho: "1fr", celda: texto("prendas") },
    { titulo: "Cant.", ancho: ".5fr", celda: texto("cantidad") },
    { titulo: "Causa", ancho: "1.3fr", celda: texto("causa") },
    { titulo: "Responsab.", ancho: ".9fr", celda: texto("responsabilidad") },
    { titulo: "Precio", ancho: ".55fr", celda: texto("precio") },
    { titulo: "Mon.", ancho: ".5fr", celda: texto("moneda") },
    {
      titulo: "Importe",
      ancho: ".7fr",
      celda: (e) => <b className="text-primary">{fmtCelda(importeRetiro(e.data as unknown as Retiro))}</b>,
    },
    { titulo: "Concil.", ancho: ".6fr", celda: (e) => <Chip tono={tonoDe(dato(e, "conciliado"))}>{fmtCelda(dato(e, "conciliado"))}</Chip> },
    { titulo: "Acta", ancho: ".7fr", celda: texto("acta") },
    { titulo: "Facturación", ancho: ".95fr", celda: texto("facturacion") },
  ],
  accion: [
    { titulo: "Acuerdo", ancho: ".65fr", celda: (e) => corta(e.fecha) },
    { titulo: "Origen o problema", ancho: "1.5fr", celda: texto("origen") },
    { titulo: "Acción acordada", ancho: "2fr", celda: texto("accion") },
    { titulo: "Responsable", ancho: "1fr", celda: texto("responsable") },
    { titulo: "Límite", ancho: ".65fr", celda: (e) => corta(dato(e, "fecha_limite")) },
    { titulo: "Estado", ancho: ".9fr", celda: texto("estado") },
    { titulo: "Resultado", ancho: "1.3fr", celda: texto("resultado") },
    { titulo: "Acta", ancho: ".7fr", celda: texto("acta") },
    {
      titulo: "Al cierre",
      ancho: "1fr",
      celda: (e, r) => {
        const s = situacionAccion({ ...(e.data as unknown as Accion), fecha: e.fecha }, r);
        return <Chip tono={tonoDe(s)}>{s || "—"}</Chip>;
      },
    },
  ],
};

/** Las novedades del mes de un tipo, con todas las columnas de su hoja. */
const TablaEventos = ({
  hotelId,
  tipo,
  eventos,
  fechaInicial,
  rango,
  onCambio,
  onBorrado,
  readOnly,
}: {
  hotelId: string;
  tipo: TipoEventoControl;
  eventos: ControlEvento[];
  fechaInicial: string;
  rango: RangoMes;
  onCambio: (e: ControlEvento) => void;
  onBorrado: (id: string) => void;
  readOnly?: boolean;
}) => {
  const [nuevo, setNuevo] = useState(false);
  const [editando, setEditando] = useState<ControlEvento | null>(null);
  const columnas = COLUMNAS[tipo];
  const plantilla = { gridTemplateColumns: `${columnas.map((c) => c.ancho).join(" ")} ${readOnly ? "" : "60px"}` };

  const borrar = async (e: ControlEvento) => {
    try {
      await deleteEvento(e.id);
      onBorrado(e.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar");
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {eventos.length > 0 && (
        <div className="overflow-x-auto">
          <div className="min-w-[900px] flex flex-col">
            <div className="grid gap-1.5 polarier-head rounded-xl px-2.5 py-2" style={plantilla}>
              {columnas.map((c) => (
                <span key={c.titulo} className="text-[10.5px] font-extrabold leading-tight">
                  {c.titulo}
                </span>
              ))}
              {!readOnly && <span />}
            </div>
            {eventos.map((e) => (
              <div
                key={e.id}
                className="grid gap-1.5 items-center px-2.5 py-1.5 text-[12.5px] font-semibold tabular-nums border-b border-primary/10"
                style={plantilla}
              >
                {columnas.map((c) => (
                  <span key={c.titulo} className="min-w-0 break-words">
                    {c.celda(e, rango)}
                  </span>
                ))}
                {!readOnly && (
                  <span className="flex justify-end gap-0.5">
                    <button
                      type="button"
                      aria-label="Editar"
                      onClick={() => {
                        setNuevo(false);
                        setEditando(e);
                      }}
                      className="p-1 text-muted-foreground hover:text-primary"
                    >
                      <Pencil size={14} />
                    </button>
                    <button type="button" aria-label="Borrar" onClick={() => void borrar(e)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 size={14} />
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {editando && (
        <EventoEditor
          key={editando.id}
          hotelId={hotelId}
          tipo={tipo}
          fechaInicial={editando.fecha}
          evento={editando}
          onCancelar={() => setEditando(null)}
          onGuardado={(e) => {
            setEditando(null);
            onCambio(e);
          }}
        />
      )}
      {nuevo && (
        <EventoEditor
          hotelId={hotelId}
          tipo={tipo}
          fechaInicial={fechaInicial}
          onCancelar={() => setNuevo(false)}
          onGuardado={(e) => {
            setNuevo(false);
            onCambio(e);
          }}
        />
      )}
      {!readOnly && !nuevo && (
        <BotonSecundario className="self-start" onClick={() => setNuevo(true)}>
          <Plus size={15} /> {TITULO_EVENTO[tipo]}
        </BotonSecundario>
      )}
    </div>
  );
};

export default TablaEventos;
