import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  CAUSAS,
  CONCEPTOS,
  ESTADOS_ACCION,
  ESTADOS_INCIDENCIA,
  FACTURACION,
  IMPUTABLE,
  importeRetiro,
  MONEDAS,
  Num,
  SI_NO,
  TIPOS_MANTENIMIENTO,
} from "@/lib/control";
import { ControlEvento, saveEvento, TipoEventoControl } from "@/services/audit";
import {
  BotonPrincipal,
  BotonSecundario,
  Calculado,
  Campo,
  CampoNumero,
  CampoTexto,
  Caja,
  fmtCelda,
  Seg,
  TipoNumero,
} from "./ui";

interface CampoEvento {
  key: string;
  label: string;
  tipo: "texto" | "fecha" | "opciones" | TipoNumero;
  ancho?: 2;
  placeholder?: string;
  opciones?: readonly string[];
}

/** Las columnas de cada hoja, en su orden. La fecha del hecho es la primera. */
export const CAMPOS_EVENTO: Record<TipoEventoControl, CampoEvento[]> = {
  incidencia: [
    { key: "fecha", label: "Fecha", tipo: "fecha" },
    { key: "causa", label: "Causa", tipo: "opciones", opciones: CAUSAS, ancho: 2 },
    { key: "duracion", label: "Duración en h", tipo: "horas", placeholder: "Si se conoce" },
    { key: "impacto", label: "Impacto en el servicio", tipo: "texto", ancho: 2 },
    { key: "accion", label: "Acción adoptada", tipo: "texto", ancho: 2 },
    { key: "responsable", label: "Responsable", tipo: "texto" },
    { key: "estado", label: "Estado", tipo: "opciones", opciones: ESTADOS_INCIDENCIA, ancho: 2 },
    { key: "fecha_cierre", label: "Fecha de cierre", tipo: "fecha" },
    { key: "imputable", label: "Imputable a Polarier", tipo: "opciones", opciones: IMPUTABLE, ancho: 2 },
    { key: "parte", label: "Parte o acta", tipo: "texto" },
  ],
  retiro: [
    { key: "fecha", label: "Fecha", tipo: "fecha" },
    { key: "concepto", label: "Concepto", tipo: "opciones", opciones: CONCEPTOS, ancho: 2 },
    { key: "prendas", label: "Tipo de prendas", tipo: "texto" },
    { key: "cantidad", label: "Cantidad de prendas", tipo: "entero" },
    { key: "causa", label: "Causa del hecho", tipo: "texto", ancho: 2 },
    { key: "responsabilidad", label: "Responsabilidad", tipo: "texto" },
    { key: "precio", label: "Precio unitario", tipo: "decimal", placeholder: "Vacío si está pendiente" },
    { key: "moneda", label: "Moneda", tipo: "opciones", opciones: MONEDAS },
    { key: "conciliado", label: "Conciliado", tipo: "opciones", opciones: SI_NO },
    { key: "acta", label: "Acta o soporte", tipo: "texto" },
    { key: "facturacion", label: "Facturación", tipo: "opciones", opciones: FACTURACION, ancho: 2 },
  ],
  mantenimiento: [
    { key: "tarea", label: "Tarea", tipo: "texto", ancho: 2 },
    { key: "equipo", label: "Equipo", tipo: "texto" },
    { key: "tipo", label: "Tipo", tipo: "opciones", opciones: TIPOS_MANTENIMIENTO },
    { key: "fecha_planificada", label: "Fecha planificada", tipo: "fecha" },
    { key: "fecha_ejecutada", label: "Fecha ejecutada", tipo: "fecha" },
    { key: "trabajo", label: "Trabajo y resultado", tipo: "texto", ancho: 2 },
    { key: "pendiente", label: "Pendiente", tipo: "texto" },
    { key: "responsable", label: "Responsable", tipo: "texto" },
    { key: "proxima", label: "Próxima fecha", tipo: "fecha" },
    { key: "documento", label: "Documento", tipo: "texto" },
  ],
  accion: [
    { key: "fecha", label: "Fecha de acuerdo", tipo: "fecha" },
    { key: "origen", label: "Origen o problema", tipo: "texto", ancho: 2 },
    { key: "accion", label: "Acción acordada", tipo: "texto", ancho: 2 },
    { key: "responsable", label: "Responsable", tipo: "texto" },
    { key: "fecha_limite", label: "Fecha límite", tipo: "fecha" },
    { key: "estado", label: "Estado", tipo: "opciones", opciones: ESTADOS_ACCION, ancho: 2 },
    { key: "resultado", label: "Resultado o avance", tipo: "texto", ancho: 2 },
    { key: "acta", label: "Acta o evidencia", tipo: "texto" },
  ],
};

export const TITULO_EVENTO: Record<TipoEventoControl, string> = {
  incidencia: "Incidencia",
  retiro: "Retiro, faltante o mal uso",
  mantenimiento: "Mantenimiento",
  accion: "Acción de mejora",
};

// Lo que abre cada tipo por defecto. Solo se preselecciona lo que es el caso normal.
const INICIAL: Record<TipoEventoControl, Record<string, unknown>> = {
  incidencia: { estado: "Abierta", imputable: "Por confirmar" },
  retiro: { conciliado: "No", facturacion: "Pendiente" },
  mantenimiento: { tipo: "Preventivo" },
  accion: { estado: "Pendiente" },
};

/**
 * Alta o edición de una novedad. Se guarda sola, aparte del parte del día: una
 * incidencia que se cierra una semana después no depende de ese parte.
 */
const EventoEditor = ({
  hotelId,
  tipo,
  fechaInicial,
  evento,
  onGuardado,
  onCancelar,
}: {
  hotelId: string;
  tipo: TipoEventoControl;
  fechaInicial: string;
  evento?: ControlEvento | null;
  onGuardado: (e: ControlEvento) => void;
  onCancelar: () => void;
}) => {
  const [valores, setValores] = useState<Record<string, unknown> & { fecha?: string; fecha_planificada?: string; fecha_ejecutada?: string }>(() =>
    evento
      ? { ...evento.data, fecha: evento.fecha }
      : { ...INICIAL[tipo], ...(tipo === "mantenimiento" ? { fecha_planificada: fechaInicial } : { fecha: fechaInicial }) }
  );
  const [guardando, setGuardando] = useState(false);

  const set = (key: string, v: unknown) => setValores((x) => ({ ...x, [key]: v }));

  const guardar = async () => {
    // Mantenimiento se reparte por la planificada, como cuenta la hoja; un
    // correctivo sin planificar va por la de ejecución.
    const fecha =
      tipo === "mantenimiento"
        ? valores.fecha_planificada || valores.fecha_ejecutada || fechaInicial
        : valores.fecha || fechaInicial;
    const { fecha: _f, ...data } = valores;
    setGuardando(true);
    try {
      const guardado = await saveEvento({ id: evento?.id, hotelId, tipo, fecha, data });
      toast.success(`${TITULO_EVENTO[tipo]} guardada`);
      onGuardado(guardado);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const importe = tipo === "retiro" ? importeRetiro({ cantidad: (valores.cantidad ?? null) as Num, precio: (valores.precio ?? null) as Num }) : null;

  return (
    <Caja>
      <p className="text-sm font-extrabold">
        {evento ? "Editar" : "Nueva"}: {TITULO_EVENTO[tipo].toLowerCase()}
      </p>
      <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-4">
        {CAMPOS_EVENTO[tipo].map((c) => {
          const id = `ev-${tipo}-${c.key}`;
          const clase = c.ancho === 2 ? "col-span-2" : "";
          if (c.tipo === "opciones") {
            return (
              <Campo key={c.key} label={c.label} className={clase}>
                <Seg etiqueta={c.label} opciones={c.opciones} valor={valores[c.key] as string} onChange={(x) => set(c.key, x)} />
              </Campo>
            );
          }
          if (c.tipo === "texto" || c.tipo === "fecha") {
            return (
              <Campo key={c.key} label={c.label} htmlFor={id} className={clase}>
                <CampoTexto
                  id={id}
                  tipo={c.tipo === "fecha" ? "date" : "text"}
                  value={(valores[c.key] ?? "") as string}
                  onChange={(x) => set(c.key, x)}
                />
              </Campo>
            );
          }
          return (
            <Campo key={c.key} label={c.label} htmlFor={id} className={clase}>
              <CampoNumero
                id={id}
                tipo={c.tipo as TipoNumero}
                placeholder={c.placeholder}
                value={(valores[c.key] ?? null) as Num}
                onChange={(x) => set(c.key, x)}
              />
            </Campo>
          );
        })}
        {tipo === "retiro" && (
          <Campo label="Importe">
            <Calculado>{fmtCelda(importe)}</Calculado>
          </Campo>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2.5">
        <BotonSecundario onClick={onCancelar}>Cancelar</BotonSecundario>
        <BotonPrincipal onClick={guardar} disabled={guardando}>
          {guardando && <Loader2 size={15} className="animate-spin" />}
          Guardar
        </BotonPrincipal>
      </div>
    </Caja>
  );
};

export default EventoEditor;
