// -----------------------------------------------------------------------------
// Carga de todo lo que necesita la hoja Resumen de un mes.
//
// Lo usan el cierre, el dashboard y los informes, y cada uno calcula el resumen con
// `construirResumen`. Filtra siempre por hotel: los datos de dos hoteles no se mezclan.
// -----------------------------------------------------------------------------
import {
  ControlEvento,
  ControlMesFila,
  FormDefinition,
  FormSubmission,
  getControlMes,
  getDefinicionControl,
  getDotacionLenceria,
  getEventosMes,
  getPrendas,
  getSubmissionsByMonth,
  getUbicaciones,
  Prenda,
  saveResumenMes,
  Ubicacion,
} from "@/services/audit";
import { DefinicionKpi, KPIS_SLA } from "@/lib/control";
import { construirResumen, leerControlMes, pactadasDeDotacion, ResumenMes } from "@/lib/controlResumen";

export interface DatosMes {
  anio: number;
  mes: number;
  def: FormDefinition | null;
  prendas: Prenda[];
  ubicaciones: Ubicacion[];
  dotacion: Record<string, Record<string, number>> | null;
  /** Solo los partes del formulario unificado; los antiguos tienen otra forma. */
  partes: FormSubmission[];
  fila: ControlMesFila | null;
  eventos: ControlEvento[];
}

export const cargarDatosMes = async (hotelId: string, anio: number, mes: number): Promise<DatosMes> => {
  const [def, prendas, ubicaciones, dotacion, subs, fila, eventos] = await Promise.all([
    getDefinicionControl(hotelId),
    getPrendas(hotelId),
    getUbicaciones(hotelId),
    // Sin dotación, las pactadas salen como «Completar», pero el resto funciona.
    getDotacionLenceria(hotelId).catch(() => null),
    getSubmissionsByMonth(hotelId, anio, mes),
    getControlMes(hotelId, anio, mes),
    getEventosMes(hotelId, anio, mes),
  ]);
  return {
    anio,
    mes,
    def,
    prendas,
    ubicaciones,
    dotacion,
    partes: def ? subs.filter((s) => s.form_definition_id === def.id) : [],
    fila,
    eventos,
  };
};

/** Los KPI con las metas del SLA de este hotel (`config.metas`, fuera del repositorio). */
export const kpisDe = (def: FormDefinition | null): DefinicionKpi[] => {
  const metas = (def?.config?.metas ?? {}) as Record<string, unknown>;
  return KPIS_SLA.map((k) => ({ ...k, meta: typeof metas[k.key] === "number" ? (metas[k.key] as number) : null }));
};

export const resumenDe = (d: DatosMes): ResumenMes =>
  construirResumen({
    anio: d.anio,
    mes: d.mes,
    partes: d.partes,
    control: d.fila ? leerControlMes(d.fila.data) : null,
    eventos: d.eventos,
    prendas: d.prendas,
    ubicaciones: d.ubicaciones,
    pactadas: pactadasDeDotacion(d.dotacion),
    kpis: kpisDe(d.def),
  });

/**
 * Recalcula y guarda la instantánea que lee la routine del informe mensual. Si falla
 * no debe impedir nada: el dato bueno ya está guardado y se recalcula al próximo cierre.
 */
export const refrescarResumenMes = async (hotelId: string, anio: number, mes: number): Promise<void> => {
  try {
    const datos = await cargarDatosMes(hotelId, anio, mes);
    if (datos.def) await saveResumenMes(hotelId, anio, mes, resumenDe(datos));
  } catch (e) {
    console.warn("No se pudo actualizar el resumen del mes:", e);
  }
};
