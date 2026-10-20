// Catálogo de automatizaciones.
//
// Una entrada por rama del workflow «Polarier Auto App» de n8n. Es la única
// fuente de verdad: de aquí salen las rutas, la barra lateral, el lobby, la
// validación del fichero y la URL del webhook al que se llama.
//
// Hasta ahora todo entraba por el chat y el nombre del fichero era el contrato
// (`Switch3` enruta por subcadena). Eso sigue funcionando, pero cada
// automatización tiene además su propio trigger, así que aquí se puede avisar
// antes de enviar si el fichero no tiene la pinta que la rama espera.
//
// Ver vault/Automatizaciones.md y vault/Generacion-Documentos.md.

import { FileSpreadsheet, FileStack, Hotel, type LucideIcon } from 'lucide-react';

export interface Automatizacion {
  slug: string;
  nombre: string;
  /** Una línea, para las tarjetas y la barra lateral. */
  descripcion: string;
  icono: LucideIcon;
  /** Path del webhook en n8n (se concatena a la base según prod/test). */
  webhookPath: string;
  /** Extensiones aceptadas, en minúsculas y con punto. */
  extensiones: string[];
  /** Qué espera recibir, en una frase. */
  queSube: string;
  /** Qué devuelve, en una frase. */
  queRecibe: string;
  /** Ejemplos de nombre de fichero válido. */
  ejemplos: string[];
  /**
   * Patrón que debe cumplir el nombre, equivalente al de `Switch3` en n8n.
   * Si no casa, se avisa pero se deja enviar: la rama manda, no la app.
   */
  patron?: RegExp;
}

export const AUTOMATIZACIONES: Automatizacion[] = [
  {
    slug: 'modelo-1',
    nombre: 'Modelo 1',
    descripcion: 'Carga la cuenta de resultados del polo en el GLOBAL',
    icono: FileStack,
    webhookPath: 'd872f8b4-5994-45e8-96d9-cf5c3a82f5b1',
    extensiones: ['.pdf', '.zip', '.rar'],
    queSube: 'El PDF «Ingresos y Gastos» del polo, o un ZIP/RAR con varios.',
    queRecibe: 'El GLOBAL-CP del año actualizado, con el aviso de lo que se ha sobrescrito.',
    ejemplos: ['HOCP202610.pdf', 'VAM-1 octubre.pdf', 'modelo 1 cayo coco.pdf', 'polos-octubre.zip'],
    patron: /^((hol|ho|var|va|ca|ha|lh|cx|ccx|ccz|cc)\s*cp.*|(hol|ho|var|va|ca|ha|lh|cx|ccx|ccz|cc)\s*m\s*[-_.]?\s*(1|i)(?![0-9a-z]).*|.*mod(elo)?\s*[-_.]?\s*(1(?!\d)|i(?![a-z])).*)\.pdf$|\.(zip|rar)$/i,
  },
  {
    slug: 'tabla-ca',
    nombre: 'Tabla CA',
    descripcion: 'Rellena la columna del mes en la TABLA CA del año',
    icono: FileSpreadsheet,
    webhookPath: '375ae1e4-ffc2-4862-a5a2-cb8c6bb18614',
    extensiones: ['.xlsx'],
    queSube: 'El CA del polo y el mes: <POLO>CA<AAAAMM>.xlsx.',
    queRecibe: 'La TABLA CA del año con la columna del mes rellena, y los avisos de la carga.',
    ejemplos: ['CACA202504.xlsx', 'HOCA202601.xlsx', 'VACD202512.xlsx'],
    patron: /^(lh|ha|va|ca|cc|ccx|cx|ccz|hol|ho)\s*c[ad]\s*\d{6}.*\.xlsx$/i,
  },
  {
    slug: 'ocupacion',
    nombre: 'Ocupación',
    descripcion: 'Vuelca la ocupación hotelera por polo',
    icono: Hotel,
    webhookPath: '023e33ed-e085-43a1-b444-40960b4d10de',
    extensiones: ['.xls', '.xlsx'],
    queSube: 'El fichero «Integral…» con la ocupación por provincia.',
    queRecibe: 'La hoja de ocupación actualizada, con las provincias ya traducidas a polo.',
    ejemplos: ['Integral octubre.xls'],
    patron: /integral/i,
  },
];

export const getAutomatizacion = (slug: string | undefined): Automatizacion | undefined =>
  AUTOMATIZACIONES.find((a) => a.slug === slug);

export const extensionDe = (nombre: string): string => {
  const i = nombre.lastIndexOf('.');
  return i === -1 ? '' : nombre.slice(i).toLowerCase();
};

/**
 * Comprueba el fichero contra lo que espera la automatización.
 * - `error`: la extensión no sirve, no se envía.
 * - `aviso`: la extensión vale pero el nombre no casa con el patrón de la rama.
 */
export const revisarArchivo = (
  auto: Automatizacion,
  nombre: string
): { error?: string; aviso?: string } => {
  const ext = extensionDe(nombre);
  if (!auto.extensiones.includes(ext)) {
    return { error: `${auto.nombre} espera ${auto.extensiones.join(', ')} y has elegido ${ext || 'un fichero sin extensión'}.` };
  }
  if (auto.patron && !auto.patron.test(nombre)) {
    return { aviso: `El nombre «${nombre}» no tiene la forma habitual (p. ej. ${auto.ejemplos[0]}). Revísalo antes de enviarlo.` };
  }
  return {};
};

/** Fecha de una ejecución, tal y como la pintan el índice y el detalle. */
export const fechaCorta = (iso: string): string => {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return `hoy, ${hora}`;
  return `${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}, ${hora}`;
};
