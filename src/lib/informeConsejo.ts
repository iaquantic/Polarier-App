// Informe del Consejo de Dirección: lógica pura del apartado por meses.
//
// La base de datos dice, para cada mes, qué datos hacen falta y si están
// (`disponibilidad_informe_consejo`, migración 013). Aquí se agrupa eso por mes
// y se decide qué enseña la pantalla: si se puede generar, si ya hay informe,
// si se está generando. Reglas y origen de cada dato en
// vault/Informe-Consejo-Origen-Datos.md.

export type EstadoRequisito = 'ok' | 'falta' | 'sin_comprobar';
export type GrupoRequisito = 'global' | 'tabla_ca' | 'tecleado';
export type EstadoInforme = 'pendiente' | 'generando' | 'listo' | 'error';

/** Una fila de `disponibilidad_informe_consejo(anio)`. */
export interface FilaDisponibilidad {
  mes: number;
  grupo: GrupoRequisito;
  orden: number;
  requisito: string;
  polo: string | null;
  estado: EstadoRequisito;
  detalle: string | null;
}

/** Una fila de `consejo_informes`. */
export interface InformeConsejo {
  id: string;
  anio: number;
  mes: number;
  estado: EstadoInforme;
  solicitado_por: string | null;
  solicitado_at: string;
  generado_at: string | null;
  archivo_path: string | null;
  archivo_nombre: string | null;
  error: string | null;
}

export interface ItemRequisito {
  polo: string | null;
  estado: EstadoRequisito;
  detalle: string | null;
}

/** Un requisito con su estado en cada polo (o sin polo, para lo tecleado). */
export interface Requisito {
  requisito: string;
  orden: number;
  items: ItemRequisito[];
  faltan: number;
}

export interface GrupoMes {
  grupo: GrupoRequisito;
  titulo: string;
  requisitos: Requisito[];
  faltan: number;
}

export interface MesConsejo {
  anio: number;
  mes: number;
  nombre: string;
  grupos: GrupoMes[];
  /** Datos comprobables que faltan (lo tecleado no cuenta). */
  faltan: number;
  informe: InformeConsejo | null;
}

export const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const TITULO_GRUPO: Record<GrupoRequisito, string> = {
  global: 'GLOBAL',
  tabla_ca: 'TABLA CA',
  tecleado: 'Tecleado en la TABLA CA',
};

const ORDEN_GRUPO: GrupoRequisito[] = ['global', 'tabla_ca', 'tecleado'];

/** Una generación en marcha que lleva más que esto probablemente murió sin cerrar su fila. */
export const ATASCADO_MS = 2 * 60 * 60 * 1000;

/** Primer año con datos en las dos fuentes. */
export const PRIMER_ANIO = 2025;

/** Años que se pueden elegir: del primero al actual, el más reciente primero. */
export const aniosDisponibles = (hoy: Date): number[] => {
  const out: number[] = [];
  for (let a = hoy.getFullYear(); a >= PRIMER_ANIO; a--) out.push(a);
  return out;
};

/** Meses que se enseñan de un año: hasta el actual, el más reciente primero. */
export const mesesVisibles = (anio: number, hoy: Date): number[] => {
  const ultimo = anio < hoy.getFullYear() ? 12 : anio === hoy.getFullYear() ? hoy.getMonth() + 1 : 0;
  const out: number[] = [];
  for (let m = ultimo; m >= 1; m--) out.push(m);
  return out;
};

export const enCurso = (informe: InformeConsejo | null): boolean =>
  !!informe && (informe.estado === 'pendiente' || informe.estado === 'generando');

export const estaAtascado = (informe: InformeConsejo | null, ahora: Date): boolean =>
  enCurso(informe) && ahora.getTime() - new Date(informe!.solicitado_at).getTime() > ATASCADO_MS;

/** Se puede pedir el informe: no falta nada comprobable y no hay otro en marcha. */
export const puedeGenerar = (mes: MesConsejo, ahora: Date): boolean =>
  mes.faltan === 0 && (!enCurso(mes.informe) || estaAtascado(mes.informe, ahora));

/** Hay un fichero que descargar (aunque se esté regenerando otro encima). */
export const puedeDescargar = (mes: MesConsejo): boolean => !!mes.informe?.archivo_path;

/**
 * Agrupa la disponibilidad de un año por mes, con el informe de cada mes.
 * Devuelve solo los meses pedidos, en ese orden.
 */
export const construirMeses = (
  anio: number,
  meses: number[],
  filas: FilaDisponibilidad[],
  informes: InformeConsejo[]
): MesConsejo[] =>
  meses.map((mes) => {
    const delMes = filas.filter((f) => f.mes === mes);
    const grupos: GrupoMes[] = ORDEN_GRUPO.map((grupo) => {
      const porRequisito = new Map<string, Requisito>();
      delMes
        .filter((f) => f.grupo === grupo)
        .sort((a, b) => a.orden - b.orden)
        .forEach((f) => {
          let r = porRequisito.get(f.requisito);
          if (!r) {
            r = { requisito: f.requisito, orden: f.orden, items: [], faltan: 0 };
            porRequisito.set(f.requisito, r);
          }
          r.items.push({ polo: f.polo, estado: f.estado, detalle: f.detalle });
          if (f.estado === 'falta') r.faltan++;
        });
      const requisitos = [...porRequisito.values()];
      return {
        grupo,
        titulo: TITULO_GRUPO[grupo],
        requisitos,
        faltan: requisitos.reduce((n, r) => n + r.faltan, 0),
      };
    }).filter((g) => g.requisitos.length > 0);
    return {
      anio,
      mes,
      nombre: NOMBRES_MES[mes - 1],
      grupos,
      faltan: grupos.reduce((n, g) => n + g.faltan, 0),
      informe: informes.find((i) => i.anio === anio && i.mes === mes) ?? null,
    };
  });

/** Lo que dice la etiqueta de estado de un mes, y su tono. */
export const estadoMes = (
  mes: MesConsejo,
  ahora: Date
): { texto: string; tono: 'ok' | 'falta' | 'curso' | 'error' | 'listo' } => {
  if (enCurso(mes.informe) && !estaAtascado(mes.informe, ahora)) return { texto: 'Generando…', tono: 'curso' };
  if (mes.informe?.estado === 'error' && !mes.informe.archivo_path) return { texto: 'Falló la generación', tono: 'error' };
  if (puedeDescargar(mes)) return { texto: 'Informe generado', tono: 'listo' };
  if (mes.faltan > 0) return { texto: mes.faltan === 1 ? 'Falta 1 dato' : `Faltan ${mes.faltan} datos`, tono: 'falta' };
  return { texto: 'Listo para generar', tono: 'ok' };
};

/** Nombre del fichero si la rama no lo manda. */
export const nombreArchivoPorDefecto = (anio: number, mes: number): string =>
  `consejo_direccion_${NOMBRES_MES[mes - 1].toUpperCase()}_${anio}.docx`;
