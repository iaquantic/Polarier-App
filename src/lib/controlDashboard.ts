// -----------------------------------------------------------------------------
// Dashboard del formulario unificado.
//
// Los indicadores son los de la hoja Resumen, ya calculados en `construirResumen`.
// Aquí se añade lo que la hoja no tiene y un dashboard sí necesita: la serie diaria
// y los avisos de «Qué vigilar».
//
// Un día se juzga en kg contra la mediana del mes con los mismos umbrales y la misma
// regla que `dashboard.ts`: un día sin cerrar suma pero no se clasifica como
// desviación. OJO: la misma clasificación está en la vista `audit_mes_dias` (SQL),
// que alimenta el informe mensual. Si cambia aquí, hay que cambiarla allí.
// -----------------------------------------------------------------------------
import { clasificarDia, EstadoDia, fmtNum } from "@/lib/dashboard";
import { Cierre, FilaOperacion } from "@/lib/control";
import { filasLavado, leerParte, ParteRegistro, ResumenMes } from "@/lib/controlResumen";

export interface DiaSerie {
  dia: number;
  fecha: string;
  etiqueta: string;
  fechaLarga: string;
  futuro: boolean;
  /** Kg registrados ese día, aunque siga abierto. Null si no hay parte. */
  kg: number | null;
  recibidas: number | null;
  entregadas: number | null;
  cierre: Cierre | null;
  estado: EstadoDia;
  /** Variación frente al día típico, en %. */
  desvio: number | null;
}

export interface AlertaControl {
  id: string;
  severidad: "alta" | "media" | "info";
  titulo: string;
  detalle: string;
  accion?: string;
  /** Si es de un día concreto, para poder abrir su parte. */
  fecha?: string;
}

export interface DashboardMes {
  resumen: ResumenMes;
  dias: DiaSerie[];
  mediana: number;
  alertas: AlertaControl[];
  hayDatos: boolean;
}

const mediana = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const fechaLarga = (f: string): string =>
  new Date(`${f}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

const num = (n: number): number => (Number.isFinite(n) ? n : 0);

const MIN_DIAS_REFERENCIA = 3;

/** «el 14 y el 21» */
const listaDias = (dias: number[]): string => {
  const t = dias.map((d) => `el ${d}`);
  if (t.length <= 1) return t.join("");
  return `${t.slice(0, -1).join(", ")} y ${t[t.length - 1]}`;
};

export const construirDashboardMes = (params: {
  resumen: ResumenMes;
  partes: ParteRegistro[];
  hoy: string;
}): DashboardMes => {
  const { resumen, partes, hoy } = params;

  const dias0 = resumen.filasOperacion.map((f: FilaOperacion, i) => {
    const delDia = partes.filter((p) => p.fecha === f.fecha);
    const filas = delDia.flatMap((p) => filasLavado(f.fecha, leerParte(p.data)));
    const hay = delDia.length > 0;
    const kg = hay ? filas.reduce((s, x) => s + num(x.kg ?? 0), 0) : null;
    const recibidas = hay ? filas.reduce((s, x) => s + num(x.recibidas ?? 0), 0) : null;
    return {
      dia: i + 1,
      fecha: f.fecha,
      etiqueta: String(i + 1),
      fechaLarga: fechaLarga(f.fecha),
      futuro: f.fecha > hoy,
      kg,
      recibidas,
      entregadas: f.entregadas,
      cierre: f.cierre,
    };
  });

  // Los días abiertos cuentan para la mediana, igual que en `audit_mes_dias`.
  const med = mediana(dias0.map((d) => d.kg).filter((k): k is number => typeof k === "number" && k > 0));

  const dias: DiaSerie[] = dias0.map((d) => ({
    ...d,
    estado: clasificarDia(d.kg ?? 0, med, d.cierre === "Pendiente"),
    desvio: med > 0 && d.kg ? (d.kg / med - 1) * 100 : null,
  }));

  return {
    resumen,
    dias,
    mediana: med,
    alertas: detectarAlertas(resumen, dias, med, hoy),
    hayDatos: partes.length > 0,
  };
};

const detectarAlertas = (r: ResumenMes, dias: DiaSerie[], med: number, hoy: string): AlertaControl[] => {
  const alertas: AlertaControl[] = [];

  for (const k of r.kpis) {
    if (k.cumplimiento !== "No cumple" || typeof k.resultado !== "number") continue;
    alertas.push({
      id: `kpi-${k.key}`,
      severidad: "alta",
      titulo: `${k.nombre} no cumple`,
      detalle: `${(k.resultado * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} % frente a una meta del ${(k.meta * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %.`,
      accion: "Revisa el conteo y el documento que lo respalda, y anota la causa en Incidencias o Acciones.",
    });
  }

  // Días que se salen de lo normal: solo los cerrados y con referencia suficiente.
  const conDatos = dias.filter((d) => (d.kg ?? 0) > 0).length;
  if (conDatos >= MIN_DIAS_REFERENCIA && med > 0) {
    for (const d of dias) {
      if (d.estado === "muy_bajo" || d.estado === "bajo") {
        const caida = Math.round((1 - (d.kg as number) / med) * 100);
        alertas.push({
          id: `bajo-${d.fecha}`,
          severidad: d.estado === "muy_bajo" ? "alta" : "media",
          fecha: d.fecha,
          titulo: `Día ${d.dia}: ${caida} % por debajo de lo habitual`,
          detalle: `El ${d.fechaLarga} se lavaron ${fmtNum(d.kg as number)} kg, frente a los ${fmtNum(med)} del día típico del mes.`,
          accion: "Revisa si hubo parada de máquina, turno incompleto o vales anotados en otro día.",
        });
      } else if (d.estado === "alto") {
        alertas.push({
          id: `pico-${d.fecha}`,
          severidad: "info",
          fecha: d.fecha,
          titulo: `Día ${d.dia}: pico de producción`,
          detalle: `El ${d.fechaLarga} se lavaron ${fmtNum(d.kg as number)} kg, un ${Math.round(((d.kg as number) / med - 1) * 100)} % por encima del día típico (${fmtNum(med)}).`,
          accion: "Confirma que no se haya duplicado un vale ni sumado producción de otra jornada.",
        });
      }
    }
  }

  // Cobertura: los días pasados sin cerrar no cuentan en los totales del mes.
  const pasados = dias.filter((d) => d.fecha < hoy);
  const pendientes = pasados.filter((d) => d.cierre === "Pendiente").map((d) => d.dia);
  const sinParte = pasados.filter((d) => d.cierre === null).map((d) => d.dia);
  if (pendientes.length + sinParte.length > 0) {
    const partes: string[] = [];
    if (pendientes.length) partes.push(`${pendientes.length === 1 ? "sigue pendiente" : "siguen pendientes"} ${listaDias(pendientes)}`);
    if (sinParte.length) partes.push(`no ${sinParte.length === 1 ? "tiene" : "tienen"} parte ${listaDias(sinParte)}`);
    const n = pendientes.length + sinParte.length;
    alertas.push({
      id: "dias-sin-cerrar",
      severidad: "media",
      titulo: `${n} ${n === 1 ? "día pasado" : "días pasados"} sin cerrar`,
      detalle: `${partes.join(" y ").replace(/^./, (c) => c.toUpperCase())}. No cuentan en los totales del mes.`,
      accion: "Abre cada día en el parte y ciérralo, o márcalo como «Sin actividad» si se comprobó que no la hubo.",
    });
  }

  // Cerrados que el Excel deja en «Revisar detalle» o «Completar detalle».
  const sinContar = r.filasOperacion.filter((f) => typeof f.kg === "string" && f.kg !== "");
  if (sinContar.length > 0) {
    const n = sinContar.length;
    alertas.push({
      id: "dias-por-revisar",
      severidad: "media",
      titulo: `${n} ${n === 1 ? "jornada cerrada" : "jornadas cerradas"} con registros por revisar`,
      detalle: `${listaDias(sinContar.map((f) => Number(f.fecha.slice(8)))).replace(/^./, (c) => c.toUpperCase())}: sus kg y piezas no cuentan en el mes hasta completar los registros de lavado.`,
      fecha: n === 1 ? sinContar[0].fecha : undefined,
    });
  }

  for (const a of r.inventario.articulos) {
    if (a.resultado === "Faltante") {
      alertas.push({
        id: `faltante-${a.prenda}`,
        severidad: "media",
        titulo: `Faltan ${fmtNum(a.faltantes as number)} de ${a.prenda.toLowerCase()}`,
        detalle: `Existencia actual ${fmtNum(a.actual as number)} frente a ${fmtNum(a.pactadas as number)} pactadas.`,
        accion: "Busca roturas, bajas o partidas en tránsito sin anotar.",
      });
    } else if (a.resultado === "Sobrante") {
      alertas.push({
        id: `sobrante-${a.prenda}`,
        severidad: "info",
        titulo: `Sobran ${fmtNum(a.sobrantes as number)} de ${a.prenda.toLowerCase()}`,
        detalle: `Existencia actual ${fmtNum(a.actual as number)} frente a ${fmtNum(a.pactadas as number)} pactadas.`,
        accion: "Comprueba si alguna ubicación se contó dos veces.",
      });
    } else if (a.resultado === "Revisar duplicados") {
      alertas.push({
        id: `duplicado-${a.prenda}`,
        severidad: "media",
        titulo: `Conteo duplicado de ${a.prenda.toLowerCase()}`,
        detalle: "Hay dos conteos de la misma ubicación en la misma fecha, y no se puede saber cuál vale.",
      });
    }
  }

  if (typeof r.acciones.vencidas === "number" && r.acciones.vencidas > 0) {
    alertas.push({
      id: "acciones-vencidas",
      severidad: "media",
      titulo: `${r.acciones.vencidas} ${r.acciones.vencidas === 1 ? "acción vencida" : "acciones vencidas"} al cierre`,
      detalle:
        r.acciones.vencidas === 1
          ? "Tiene la fecha límite pasada y sigue sin cerrar."
          : "Tienen la fecha límite pasada y siguen sin cerrar.",
      accion: "Actualiza su estado y resultado en Cierre del mes.",
    });
  }

  if (typeof r.equipos.fueraServicio === "number" && r.equipos.fueraServicio > 0) {
    alertas.push({
      id: "equipos-fuera",
      severidad: "info",
      titulo: `${r.equipos.fueraServicio} ${r.equipos.fueraServicio === 1 ? "equipo" : "equipos"} fuera de servicio`,
      detalle: "Según el estado declarado al cierre en Cierre del mes.",
    });
  }

  for (const m of r.retiros.porMoneda) {
    if (typeof m.sinConciliar === "number" && m.sinConciliar > 0) {
      alertas.push({
        id: `sin-conciliar-${m.clave}`,
        severidad: "info",
        titulo: `${m.sinConciliar.toLocaleString("es-ES", { maximumFractionDigits: 2 })} ${m.clave} sin conciliar`,
        detalle: "Solo cuenta como conciliado lo marcado como tal y con acta o soporte.",
      });
    }
  }

  if (r.procesado.pendientes > 0) {
    alertas.push({
      id: "procesado-por-revisar",
      severidad: "info",
      titulo: `${r.procesado.pendientes} ${r.procesado.pendientes === 1 ? "registro" : "registros"} de procesado por revisar`,
      detalle: "No se incluyen en las cifras por área hasta quedar completos.",
    });
  }

  const peso = { alta: 0, media: 1, info: 2 } as const;
  return alertas.sort((a, b) => peso[a.severidad] - peso[b.severidad]);
};
