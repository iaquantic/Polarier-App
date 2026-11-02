import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { rangoMes, situacionAccion, Accion } from "@/lib/control";
import { ControlEvento, TipoEventoControl } from "@/services/audit";
import EventoEditor, { TITULO_EVENTO } from "./EventoEditor";
import { Bloque, BotonSecundario, Chip, tonoDe } from "./ui";

const fechaCorta = (f: string) =>
  new Date(`${f}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

/** Una línea de texto por novedad: lo que hace falta para reconocerla. */
export const describirEvento = (e: ControlEvento): { titulo: string; detalle: string; estado: string } => {
  const d = e.data as Record<string, any>;
  switch (e.tipo) {
    case "incidencia":
      return {
        titulo: `Incidencia · ${d.causa ?? "Sin causa"}`,
        detalle: [d.impacto, typeof d.duracion === "number" ? `${String(d.duracion).replace(".", ",")} h` : null]
          .filter(Boolean)
          .join(" · "),
        estado: d.estado ?? "Abierta",
      };
    case "accion": {
      const fin = new Date(`${e.fecha}T00:00:00`);
      const situacion = situacionAccion(
        { ...(d as Accion), fecha: e.fecha },
        rangoMes(fin.getFullYear(), fin.getMonth() + 1)
      );
      return {
        titulo: "Acción",
        detalle: [d.accion, d.fecha_limite ? `Vence el ${fechaCorta(d.fecha_limite)}` : null].filter(Boolean).join(" · "),
        estado: situacion || d.estado,
      };
    }
    case "retiro":
      return {
        titulo: d.concepto ?? "Retiro",
        detalle: [d.prendas, typeof d.cantidad === "number" ? `${d.cantidad} pzs` : null].filter(Boolean).join(" · "),
        estado: d.conciliado === "Sí" ? "Conciliado" : "Sin conciliar",
      };
    default:
      return {
        titulo: `Mantenimiento · ${d.tipo ?? ""}`,
        detalle: [d.tarea, d.equipo].filter(Boolean).join(" · "),
        estado: d.fecha_ejecutada ? "Ejecutado" : "Previsto",
      };
  }
};

const TIPOS: TipoEventoControl[] = ["incidencia", "retiro", "mantenimiento", "accion"];

const PasoNovedades = ({
  hotelId,
  fecha,
  eventos,
  onCambio,
  readOnly,
}: {
  hotelId: string;
  fecha: string;
  /** Sin cerrar de cualquier mes, más lo registrado este día. */
  eventos: ControlEvento[];
  onCambio: (e: ControlEvento) => void;
  readOnly?: boolean;
}) => {
  const [nuevo, setNuevo] = useState<TipoEventoControl | null>(null);
  const [editando, setEditando] = useState<ControlEvento | null>(null);

  return (
    <Bloque
      titulo="Novedades"
      ayuda="Solo si ha pasado algo. Se pueden cerrar otro día, así que no dependen del parte de hoy. Se revisan todas juntas en Cierre del mes."
    >
      {!readOnly && (
        <div className="flex flex-wrap gap-2.5">
          {TIPOS.map((t) => (
            <BotonSecundario
              key={t}
              onClick={() => {
                setEditando(null);
                setNuevo(t);
              }}
            >
              <Plus size={15} /> {TITULO_EVENTO[t]}
            </BotonSecundario>
          ))}
        </div>
      )}

      {nuevo && (
        <EventoEditor
          key={nuevo}
          hotelId={hotelId}
          tipo={nuevo}
          fechaInicial={fecha}
          onCancelar={() => setNuevo(null)}
          onGuardado={(e) => {
            setNuevo(null);
            onCambio(e);
          }}
        />
      )}

      {editando && (
        <EventoEditor
          key={editando.id}
          hotelId={hotelId}
          tipo={editando.tipo}
          fechaInicial={editando.fecha}
          evento={editando}
          onCancelar={() => setEditando(null)}
          onGuardado={(e) => {
            setEditando(null);
            onCambio(e);
          }}
        />
      )}

      {eventos.length === 0 ? (
        <p className="text-sm font-medium text-muted-foreground">No hay novedades abiertas.</p>
      ) : (
        <>
          <p className="text-sm font-bold">Abiertas o de este día</p>
          {eventos.map((e) => {
            const { titulo, detalle, estado } = describirEvento(e);
            return (
              <div
                key={e.id}
                className="grid gap-2 grid-cols-[1fr_auto] lg:grid-cols-[1.2fr_3fr_.8fr_auto_auto] items-center rounded-[14px] bg-background/70 ring-1 ring-primary/15 px-3 py-2 text-[13px] font-semibold"
              >
                <span className="font-extrabold">{titulo}</span>
                <span className="col-span-2 lg:col-span-1 order-last lg:order-none text-muted-foreground font-medium">
                  {detalle || "—"}
                </span>
                <span className="hidden lg:inline text-xs text-muted-foreground">Desde el {fechaCorta(e.fecha)}</span>
                <Chip tono={tonoDe(estado)}>{estado}</Chip>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Editar ${titulo}`}
                    onClick={() => {
                      setNuevo(null);
                      setEditando(e);
                    }}
                    className="hidden lg:block p-1.5 text-muted-foreground hover:text-primary"
                  >
                    <Pencil size={15} />
                  </button>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setNuevo(null);
                      setEditando(e);
                    }}
                    className="lg:hidden col-span-2 order-last text-left text-xs font-bold text-primary"
                  >
                    Editar o cerrar
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}
    </Bloque>
  );
};

export default PasoNovedades;
