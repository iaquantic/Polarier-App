// Informe del Consejo de Dirección: datos del apartado por meses.
//
// Todo pasa por las funciones de la migración 013: la app nunca lee el GLOBAL
// ni la TABLA CA, solo si cada dato está o falta. Para generar, el servidor
// vuelve a comprobar que no falta nada (`solicitar_informe_consejo`), deja el
// informe en `pendiente` y la app avisa a n8n con su id; la rama lo pasa a
// `generando` y lo cierra con el fichero (o el error) con la service role.

import { supabase } from '@/lib/supabaseClient';
import { getAutomationWebhookUrl } from '@/lib/n8nMode';
import { getAutomatizacion } from '@/lib/automatizaciones';
import {
  nombreArchivoPorDefecto,
  type FilaDisponibilidad,
  type InformeConsejo,
} from '@/lib/informeConsejo';

export const BUCKET_INFORMES_CONSEJO = 'informes-consejo';

/** Error de una tabla o función que aún no existe: la migración 013 no está aplicada. */
const sinMigracion = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === '42883' || e.code === 'PGRST202' || /does not exist|could not find/i.test(e.message ?? ''));

export class MigracionPendiente extends Error {
  constructor() {
    super('Falta aplicar la migración 013 (informe del Consejo) en Supabase.');
  }
}

export const getDisponibilidad = async (anio: number): Promise<FilaDisponibilidad[]> => {
  const { data, error } = await supabase.rpc('disponibilidad_informe_consejo', { p_anio: anio });
  if (sinMigracion(error)) throw new MigracionPendiente();
  if (error) throw new Error(error.message);
  return (data ?? []) as FilaDisponibilidad[];
};

/** Cuándo se actualizó cada fuente del año (null si nunca). */
export const getFuentes = async (anio: number): Promise<{ global: string | null; tabla_ca: string | null }> => {
  const { data, error } = await supabase.rpc('fuentes_informe_consejo', { p_anio: anio });
  if (error) return { global: null, tabla_ca: null };
  const filas = (data ?? []) as { fuente: string; actualizado_at: string | null }[];
  return {
    global: filas.find((f) => f.fuente === 'global')?.actualizado_at ?? null,
    tabla_ca: filas.find((f) => f.fuente === 'tabla_ca')?.actualizado_at ?? null,
  };
};

export const getInformes = async (anio: number): Promise<InformeConsejo[]> => {
  const { data, error } = await supabase.from('consejo_informes').select('*').eq('anio', anio);
  if (error) return [];
  return (data ?? []) as InformeConsejo[];
};

/**
 * Pide el informe de un mes y avisa a n8n. Lanza con un mensaje legible si
 * falta algún dato, si ya hay uno en marcha o si n8n no responde.
 */
export const generarInforme = async (
  anio: number,
  mes: number,
  usuario: { id: string; nombre?: string; email?: string }
): Promise<InformeConsejo> => {
  const { data, error } = await supabase.rpc('solicitar_informe_consejo', { p_anio: anio, p_mes: mes });
  if (sinMigracion(error)) throw new MigracionPendiente();
  if (error) throw new Error(error.message);
  const informe = data as InformeConsejo;

  const auto = getAutomatizacion('informe-consejo');
  const anular = async (motivo: string) => {
    await supabase.rpc('anular_solicitud_informe_consejo', { p_id: informe.id, p_motivo: motivo });
  };

  let res: Response;
  try {
    res = await fetch(getAutomationWebhookUrl(auto!.webhookPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        automatizacion: 'informe-consejo',
        informe_id: informe.id,
        anio,
        mes,
        archivo_nombre: nombreArchivoPorDefecto(anio, mes),
        user_id: usuario.id,
        user_name: usuario.nombre ?? null,
        user_email: usuario.email ?? null,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    const motivo = 'No se pudo avisar a n8n para generar el informe. Comprueba la conexión y vuelve a intentarlo.';
    await anular(motivo);
    throw new Error(motivo);
  }
  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    const motivo = `n8n respondió ${res.status}${detalle ? `: ${detalle.slice(0, 300)}` : ''}`;
    await anular(motivo);
    throw new Error(motivo);
  }
  return informe;
};

/** URL firmada (5 minutos) que descarga el informe con su nombre. */
export const urlDescarga = async (informe: InformeConsejo): Promise<string> => {
  const nombre = informe.archivo_nombre || nombreArchivoPorDefecto(informe.anio, informe.mes);
  const { data, error } = await supabase.storage
    .from(BUCKET_INFORMES_CONSEJO)
    .createSignedUrl(informe.archivo_path!, 300, { download: nombre });
  if (error || !data) throw new Error('No se pudo preparar la descarga del informe.');
  return data.signedUrl;
};
