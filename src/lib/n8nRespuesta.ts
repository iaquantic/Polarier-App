// Lectura de la respuesta de un webhook de n8n.
//
// Vivía dentro de `sendToN8n` (src/services/chat.ts). Se saca aquí porque la
// sección de Automatizaciones llama a otros webhooks del mismo workflow y
// recibe exactamente lo mismo: un binario, un JSON con texto, o un JSON con
// texto y fichero a la vez (`{ respuesta, archivo: { nombre, mime, base64 } }`).
//
// Devuelve el resultado en dos formas: `mensaje` (el texto con el marcador de
// fichero al final, que es lo que guarda el chat) y `texto` + `archivo` por
// separado, que es lo que necesita el historial de automatizaciones.

import { uploadAssistantBlob } from '@/services/storage';

export interface ArchivoRespuesta {
  nombre: string;
  /** Ruta en el bucket `documents`. Vacía si la subida falló y la URL es efímera. */
  file_path: string;
  url: string;
  ext: string;
  mime: string;
}

export interface RespuestaN8n {
  /** Texto + marcador del fichero (formato que entiende ChatMessage). */
  mensaje: string | null;
  /** Solo el texto, sin marcador. */
  texto: string | null;
  archivo: ArchivoRespuesta | null;
}

const vacia: RespuestaN8n = { mensaje: null, texto: null, archivo: null };

const extFromMime = (mime: string, fileName?: string): string => {
  if (fileName?.includes('.')) return fileName.split('.').pop()!;
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('spreadsheet') || mime.includes('xlsx')) return 'xlsx';
  if (mime.includes('word') || mime.includes('docx')) return 'docx';
  if (mime.includes('zip')) return 'zip';
  return 'file';
};

const componer = (texto: string | null, archivo: ArchivoRespuesta | null): string | null => {
  const marcador = archivo ? `[${archivo.nombre}](${archivo.url}){.file-download|${archivo.ext}}` : null;
  if (texto && marcador) return `${texto}\n\n${marcador}`;
  return marcador ?? texto;
};

// Guarda un binario en Storage. Si la subida falla, cae a una URL efímera para
// que el usuario al menos pueda descargarlo en esta sesión.
const guardarArchivo = async (
  blob: Blob,
  chatId: string | null,
  mime: string,
  nombre: string
): Promise<ArchivoRespuesta> => {
  const ext = extFromMime(mime, nombre);
  try {
    const { signedUrl, file_path } = await uploadAssistantBlob(blob, chatId, mime, nombre);
    return { nombre, file_path, url: signedUrl, ext, mime };
  } catch {
    return { nombre, file_path: '', url: URL.createObjectURL(blob), ext, mime };
  }
};

// Extrae recursivamente el texto de un JSON de n8n.
export const extractTextContent = (data: unknown): string | null => {
  if (typeof data === 'string') return data.trim() || null;
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    return extractTextContent(data[0]);
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    // Audio keys: si n8n devuelve una URL de audio, la convertimos al marker del reproductor
    const audioKeys = ['audio_url', 'audioUrl', 'audio', 'voice_url', 'voiceUrl'];
    for (const key of audioKeys) {
      const val = obj[key];
      if (typeof val === 'string' && val.trim()) {
        return `[Audio](${val.trim()}){.audio-player|audio/mpeg}`;
      }
    }
    // Image keys: URL de imagen → marker de imagen
    const imageKeys = ['image_url', 'imageUrl', 'image', 'picture', 'photo', 'photo_url'];
    for (const key of imageKeys) {
      const val = obj[key];
      if (typeof val === 'string' && val.trim()) {
        return `[Imagen](${val.trim()}){.image|image/png}`;
      }
    }
    // Priority keys for text content
    // 'output' va antes de 'message': el agente de n8n responde en 'output', mientras
    // que 'message' es el campo que la propia app envia con el texto del usuario. Si un
    // nodo arrastra el body original hasta la respuesta, priorizar 'message' devolveria
    // al usuario su propio mensaje en vez de la contestacion.
    const keys = ['respuesta', 'response', 'output', 'message', 'text', 'content', 'result', 'answer', 'reply'];
    for (const key of keys) {
      if (obj[key] && typeof obj[key] === 'string') return (obj[key] as string).trim();
    }
    // Check nested objects in priority keys
    for (const key of keys) {
      if (obj[key] && typeof obj[key] === 'object') {
        const nested = extractTextContent(obj[key]);
        if (nested) return nested;
      }
    }
    // Fallback: first string value found
    for (const val of Object.values(obj)) {
      if (typeof val === 'string' && val.trim().length > 0) return val.trim();
    }
    // Last resort: recurse into first object value
    for (const val of Object.values(obj)) {
      if (typeof val === 'object') {
        const nested = extractTextContent(val);
        if (nested) return nested;
      }
    }
  }
  return null;
};

// Respuesta JSON con texto y fichero a la vez (p. ej. el agente de la TABLA CA:
// `{ respuesta, archivo: { nombre, mime, base64 } }`).
export const archivoAdjunto = async (json: unknown, chatId: string | null): Promise<ArchivoRespuesta | null> => {
  const archivo = (json as { archivo?: { nombre?: string; mime?: string; base64?: string } } | null)?.archivo;
  if (!archivo?.base64) return null;
  try {
    const bin = atob(archivo.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const mime = archivo.mime || 'application/octet-stream';
    const nombre = archivo.nombre || 'archivo';
    return guardarArchivo(new Blob([bytes], { type: mime }), chatId, mime, nombre);
  } catch {
    return null;
  }
};

// Una respuesta que es solo una URL: se descarga y se guarda como fichero.
const resolverUrl = async (texto: string | null, chatId: string | null): Promise<RespuestaN8n> => {
  if (!texto || !/^https?:\/\/\S+$/.test(texto.trim())) return { mensaje: texto, texto, archivo: null };
  try {
    const fileRes = await fetch(texto.trim());
    if (!fileRes.ok) return { mensaje: texto, texto, archivo: null };
    const fileCt = fileRes.headers.get('content-type') || 'application/octet-stream';
    const blob = await fileRes.blob();
    const nombre = nombreDeRespuesta(fileRes, texto.trim().split('/').pop()?.split('?')[0] || 'archivo');
    if (fileCt.startsWith('audio/') || fileCt.startsWith('image/')) {
      const archivo = await guardarArchivo(blob, chatId, fileCt, nombre);
      const tipo = fileCt.startsWith('audio/') ? 'audio-player' : 'image';
      const etiqueta = fileCt.startsWith('audio/') ? 'Audio' : 'Imagen';
      return { mensaje: `[${etiqueta}](${archivo.url}){.${tipo}|${archivo.mime}}`, texto: null, archivo };
    }
    const archivo = await guardarArchivo(blob, chatId, fileCt, nombre);
    return { mensaje: componer(null, archivo), texto: null, archivo };
  } catch {
    return { mensaje: texto, texto, archivo: null };
  }
};

const nombreDeRespuesta = (res: Response, porDefecto: string): string => {
  const disposition = res.headers.get('content-disposition') || '';
  const nameMatch = disposition.match(/filename[^;=\n]*=["']?([^"';\n]+)["']?/i);
  return nameMatch?.[1]?.trim() || porDefecto;
};

/**
 * Interpreta la respuesta de un webhook de n8n (binario, JSON o texto).
 * `chatId` es opcional: las automatizaciones no van asociadas a ninguna conversación.
 */
export const interpretarRespuestaN8n = async (
  res: Response,
  chatId: string | null = null
): Promise<RespuestaN8n> => {
  const contentType = res.headers.get('content-type') || '';

  // Audio → marker del reproductor.
  if (contentType.startsWith('audio/') || contentType.startsWith('image/')) {
    const blob = await res.blob();
    const esAudio = contentType.startsWith('audio/');
    const archivo = await guardarArchivo(blob, chatId, contentType, nombreDeRespuesta(res, esAudio ? 'audio' : 'imagen'));
    const tipo = esAudio ? 'audio-player' : 'image';
    const etiqueta = esAudio ? 'Audio' : 'Imagen';
    return { mensaje: `[${etiqueta}](${archivo.url}){.${tipo}|${archivo.mime}}`, texto: null, archivo };
  }

  // Fichero (PDF, XLSX, DOCX, ZIP…) → se guarda y se devuelve su marcador.
  if (contentType.includes('application/pdf') ||
      contentType.includes('application/vnd') ||
      contentType.includes('application/zip') ||
      contentType.includes('application/octet-stream')) {
    const blob = await res.blob();
    const nombre = nombreDeRespuesta(res, `archivo.${extFromMime(contentType)}`);
    const archivo = await guardarArchivo(blob, chatId, contentType, nombre);
    return { mensaje: componer(null, archivo), texto: null, archivo };
  }

  // Leemos el cuerpo como texto primero: así una respuesta 200 con cuerpo
  // vacío (o content-type json sin body) no revienta en res.json().
  const rawText = await res.text();
  const trimmed = rawText.trim();
  if (!trimmed) return vacia;

  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(trimmed);
      const texto = extractTextContent(json);
      const archivo = await archivoAdjunto(json, chatId);
      if (archivo) return { mensaje: componer(texto, archivo), texto, archivo };
      return resolverUrl(texto, chatId);
    } catch {
      // content-type dice json pero el cuerpo no lo es: tratarlo como texto
      return resolverUrl(trimmed, chatId);
    }
  }
  return resolverUrl(trimmed, chatId);
};
