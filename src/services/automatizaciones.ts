// Lanzar una automatización desde su apartado de la app.
//
// Sube el fichero al bucket `documents` (igual que el chat), deja la ejecución
// anotada en `automation_runs` y llama al webhook propio de esa rama en n8n con
// el MISMO payload que manda el chat, para que los nodos de la rama no tengan
// que cambiar de contrato.

import { supabase } from '@/lib/supabaseClient';
import { uploadDocument } from '@/services/storage';
import { getAutomationWebhookUrl } from '@/lib/n8nMode';
import { interpretarRespuestaN8n, type ArchivoRespuesta } from '@/lib/n8nRespuesta';
import { revisarArchivo, type Automatizacion } from '@/lib/automatizaciones';

export type EstadoEjecucion = 'en_curso' | 'completada' | 'error';

export interface EjecucionAutomatizacion {
  id: string;
  user_id: string;
  slug: string;
  estado: EstadoEjecucion;
  archivo_nombre: string | null;
  archivo_path: string | null;
  respuesta: string | null;
  resultado_nombre: string | null;
  resultado_path: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface ResultadoEjecucion {
  ejecucion: EjecucionAutomatizacion | null;
  /** Texto del agente, sin el marcador del fichero. */
  texto: string | null;
  archivo: ArchivoRespuesta | null;
}

/** Últimas ejecuciones de una automatización (las propias: lo que deja ver la RLS). */
export const getEjecuciones = async (slug: string, limite = 10): Promise<EjecucionAutomatizacion[]> => {
  const { data, error } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('slug', slug)
    .order('created_at', { ascending: false })
    .limit(limite);
  // La sección tiene que funcionar aunque la migración 012 no esté aplicada.
  if (error) return [];
  return (data ?? []) as EjecucionAutomatizacion[];
};

/** Una ejecución concreta, para abrirla desde un enlace (`?run=<id>`). */
export const getEjecucion = async (id: string): Promise<EjecucionAutomatizacion | null> => {
  const { data, error } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  return (data as EjecucionAutomatizacion) ?? null;
};

const anotarInicio = async (
  slug: string,
  userId: string,
  archivo: { file_name: string; file_path: string }
): Promise<EjecucionAutomatizacion | null> => {
  const { data, error } = await supabase
    .from('automation_runs')
    .insert({
      user_id: userId,
      slug,
      estado: 'en_curso',
      archivo_nombre: archivo.file_name,
      archivo_path: archivo.file_path,
    })
    .select()
    .single();
  if (error) return null;
  return data as EjecucionAutomatizacion;
};

const anotarFin = async (
  id: string | undefined,
  campos: Partial<EjecucionAutomatizacion>
): Promise<EjecucionAutomatizacion | null> => {
  if (!id) return null;
  const { data, error } = await supabase
    .from('automation_runs')
    .update({ ...campos, finished_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return null;
  return data as EjecucionAutomatizacion;
};

/**
 * Sube el fichero y dispara la automatización. Lanza si el fichero no sirve o
 * si n8n no responde; en ese caso la ejecución queda anotada como 'error'.
 */
export const ejecutarAutomatizacion = async (
  auto: Automatizacion,
  file: File,
  usuario: { id: string; nombre?: string; email?: string }
): Promise<ResultadoEjecucion> => {
  const { error: motivo } = revisarArchivo(auto, file.name);
  if (motivo) throw new Error(motivo);

  const doc = await uploadDocument(file, null);
  const ejecucion = await anotarInicio(auto.slug, usuario.id, doc);

  const payload = {
    chat_id: null,
    user_id: usuario.id,
    user_name: usuario.nombre ?? null,
    user_email: usuario.email ?? null,
    message: 'Documento subido',
    role: 'user',
    timestamp: new Date().toISOString(),
    automatizacion: auto.slug,
    file: {
      id: doc.id,
      file_name: doc.file_name,
      file_path: doc.file_path,
      mime_type: doc.mime_type,
      size_bytes: doc.size_bytes,
    },
  };

  let res: Response;
  try {
    res = await fetch(getAutomationWebhookUrl(auto.webhookPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // La ejecución se queda en 'en_curso': puede que n8n siga trabajando y lo
    // que se haya caído sea la espera (proxy, red). No la damos por perdida.
    throw new Error(
      'Se perdió la conexión mientras se procesaba. Puede que n8n siga trabajando: revisa el historial dentro de unos minutos.'
    );
  }

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    const mensaje = `n8n respondió ${res.status}${detalle ? `: ${detalle.slice(0, 300)}` : ''}`;
    await anotarFin(ejecucion?.id, { estado: 'error', error: mensaje });
    throw new Error(mensaje);
  }

  const { texto, archivo } = await interpretarRespuestaN8n(res, null);

  const actualizada = await anotarFin(ejecucion?.id, {
    estado: 'completada',
    respuesta: texto,
    resultado_nombre: archivo?.nombre ?? null,
    resultado_path: archivo?.file_path || null,
  });

  return { ejecucion: actualizada ?? ejecucion, texto, archivo };
};
