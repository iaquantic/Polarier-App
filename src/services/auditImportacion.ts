// -----------------------------------------------------------------------------
// Subida del Excel «Modelo Mensual» relleno.
//
// Todo se lee en el navegador y se guarda con la sesión de quien sube, así que la RLS
// de siempre decide lo que puede escribir.
// -----------------------------------------------------------------------------
import { supabase } from "@/lib/supabaseClient";
import { pad2, rangoMes } from "@/lib/control";
import { ControlMesData, totalesParte } from "@/lib/controlResumen";
import { LectorExcel } from "@/lib/controlExcel";
import { abrirXlsx } from "@/lib/xlsxLectura";
import { PlanImportacion } from "@/lib/controlImportacion";
import { deleteEvento, FormDefinition, saveControlMes, saveEvento, saveSubmission } from "@/services/audit";
import { cargarDatosMes, refrescarResumenMes, resumenDe } from "@/services/auditControl";

export const BUCKET_EXCEL = "control-excel";
const MAXIMO_MB = 20;

export const leerArchivoExcel = async (archivo: File): Promise<LectorExcel> => {
  if (!/\.xlsx$/i.test(archivo.name)) {
    throw new Error("Tiene que ser un Excel en formato .xlsx. Si es .xls, guárdalo antes como .xlsx.");
  }
  if (archivo.size > MAXIMO_MB * 1024 * 1024) {
    throw new Error(`El archivo pasa de ${MAXIMO_MB} MB: no parece el Modelo Mensual.`);
  }
  try {
    return abrirXlsx(new Uint8Array(await archivo.arrayBuffer()));
  } catch (e) {
    console.warn("No se pudo abrir el Excel:", e);
    const detalle = e instanceof Error && /1904/.test(e.message) ? e.message : null;
    throw new Error(detalle ?? "No se ha podido abrir este archivo. Comprueba que no tenga contraseña y que se abra bien en Excel.");
  }
};

export interface Importacion {
  id: string;
  archivo_nombre: string;
  archivo_path: string | null;
  created_at: string;
}

/** La última subida del mes. Si la migración 020 no está aplicada, simplemente no hay. */
export const getUltimaImportacion = async (hotelId: string, anio: number, mes: number): Promise<Importacion | null> => {
  const { data, error } = await supabase
    .from("control_importaciones")
    .select("id, archivo_nombre, archivo_path, created_at")
    .eq("hotel_id", hotelId)
    .eq("anio", anio)
    .eq("mes", mes)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("No se pudo leer la última subida:", error.message);
    return null;
  }
  return (data ?? null) as Importacion | null;
};

export const descargarOriginal = async (i: Pick<Importacion, "archivo_path" | "archivo_nombre">): Promise<void> => {
  if (!i.archivo_path) throw new Error("Este Excel no se llegó a guardar.");
  const { data, error } = await supabase.storage.from(BUCKET_EXCEL).download(i.archivo_path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = i.archivo_nombre;
  a.click();
  URL.revokeObjectURL(url);
};

export interface ResultadoImportacion {
  /** Dónde quedó el Excel; `null` si no se pudo guardar el archivo. */
  archivoPath: string | null;
}

/**
 * Aplica un plan ya revisado. Primero guarda el original, y lo nuevo se escribe antes
 * de borrar lo viejo. Si falla a medias no hay nada irreparable: volver a subir el
 * archivo termina el trabajo, porque lo que ya entró no se vuelve a tocar.
 */
export const aplicarImportacion = async (params: {
  hotelId: string;
  def: FormDefinition;
  anio: number;
  mes: number;
  archivo: File;
  plan: PlanImportacion;
  onProgreso?: (texto: string) => void;
}): Promise<ResultadoImportacion> => {
  const { hotelId, def, anio, mes, archivo, plan, onProgreso } = params;
  const rango = rangoMes(anio, mes);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No authenticated user");

  onProgreso?.("Guardando el Excel original…");
  let archivoPath: string | null = null;
  const limpio = archivo.name.replace(/[^\w.-]+/g, "_");
  const ruta = `${hotelId}/${anio}-${pad2(mes)}/${Date.now()}-${limpio}`;
  const subida = await supabase.storage
    .from(BUCKET_EXCEL)
    .upload(ruta, archivo, { contentType: archivo.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  if (subida.error) console.warn("No se pudo guardar el Excel original:", subida.error.message);
  else archivoPath = ruta;

  let hechos = 0;
  for (const { fecha, parte } of plan.partes) {
    onProgreso?.(`Guardando los días (${++hechos} de ${plan.partes.length})…`);
    await saveSubmission({
      hotelId,
      formDefinitionId: def.id,
      fecha,
      estado: parte.jornada.cierre === "Pendiente" ? "borrador" : "completado",
      data: parte as unknown as Record<string, unknown>,
      totales: totalesParte(fecha, parte, rango) as unknown as Record<string, unknown>,
    });
  }

  onProgreso?.("Guardando las novedades…");
  for (const e of plan.eventos.crear) {
    await saveEvento({ hotelId, tipo: e.tipo, fecha: e.fecha, data: e.data });
  }
  for (const id of plan.eventos.borrar) await deleteEvento(id);

  onProgreso?.("Actualizando el resumen del mes…");
  if (plan.control) {
    const datos = await cargarDatosMes(hotelId, anio, mes);
    const conDocumento = { ...datos, fila: { ...(datos.fila ?? {}), data: plan.control } } as unknown as typeof datos;
    await saveControlMes(hotelId, anio, mes, plan.control as ControlMesData, resumenDe(conDocumento));
  } else {
    await refrescarResumenMes(hotelId, anio, mes);
  }

  // Si no se puede dejar constancia, los datos ya están bien: no se da por fallida.
  const { error } = await supabase.from("control_importaciones").insert({
    hotel_id: hotelId,
    anio,
    mes,
    archivo_nombre: archivo.name,
    archivo_path: archivoPath,
    resumen: { hojas: plan.hojas, noEntran: plan.noEntran, avisos: plan.avisos, cifras: plan.cifras },
    user_id: user.id,
  });
  if (error) console.warn("No se pudo registrar la subida:", error.message);

  return { archivoPath };
};
