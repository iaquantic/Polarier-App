// -----------------------------------------------------------------------------
// Formulario unificado → estructura `Informe`.
//
// Parte diario y resumen del mes se traducen al mismo tipo que ya consumen la vista
// previa, el PDF y el envío por correo, para no duplicar ninguno de los tres. Las
// cifras salen tal cual de `controlResumen`: lo pendiente se imprime como «Completar»,
// nunca como 0.
// -----------------------------------------------------------------------------
import type { Informe, InformeCampo, InformeSeccion, InformeTabla } from "@/lib/informe";
import { AREAS, diferenciaProcesado, Num, pendienteFinal, rangoMes, revisionLavado, revisionProcesado, totalConteo, totalPMR } from "@/lib/control";
import { conteosDelParte, filasLavado, leerParte, ParteData, ResumenMes, totalesParte } from "@/lib/controlResumen";
import type { ControlEvento } from "@/services/audit";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const fmt = (v: unknown, dec = 2): string | number => {
  if (typeof v === "number") return v.toLocaleString("es-ES", { maximumFractionDigits: dec });
  if (v === null || v === undefined || v === "") return "";
  return String(v);
};

const pct = (v: unknown): string =>
  typeof v === "number" ? `${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %` : String(v ?? "");

const textoCampo = (v: unknown): string => {
  const f = fmt(v);
  return f === "" ? "—" : String(f);
};

const fechaLarga = (f: string): string =>
  new Date(`${f}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const fechaCorta = (f: unknown): string =>
  typeof f === "string" && f
    ? new Date(`${f}T00:00:00`).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
    : "";

const fechaCompleta = (f: unknown): string =>
  typeof f === "string" && f
    ? new Date(`${f}T00:00:00`).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

// -----------------------------------------------------------------------------
// Parte diario
// -----------------------------------------------------------------------------
export const buildInformeParte = (params: {
  fecha: string;
  data: ParteData | unknown;
  hotel: string;
  polo?: string;
  prendas: { id: string; nombre: string }[];
  ubicaciones: { id: string; nombre: string }[];
  eventos?: ControlEvento[];
}): Informe => {
  const { fecha, hotel, polo, prendas, ubicaciones, eventos = [] } = params;
  const parte = leerParte(params.data);
  const [anio, mes] = fecha.split("-").map(Number);
  const rango = rangoMes(anio, mes);
  const t = totalesParte(fecha, parte, rango);
  const j = parte.jornada;

  const campos: InformeCampo[] = [
    { label: "Turistas del día", valor: textoCampo(j.turistas) },
    { label: "Kg lavados", valor: textoCampo(t.kg) },
    { label: "Piezas recibidas", valor: textoCampo(t.declaracion) },
    { label: "Piezas entregadas", valor: textoCampo(j.entregadas) },
    { label: "Horas trabajadas / previstas", valor: `${textoCampo(j.horas_trabajadas)} / ${textoCampo(j.horas_previstas)}` },
    { label: "Parada única (h)", valor: textoCampo(j.parada) },
  ];
  if (j.observacion) campos.push({ label: "Observación", valor: j.observacion });

  const tablas: InformeTabla[] = [];

  const filasLav = filasLavado(fecha, parte);
  if (filasLav.length > 0) {
    tablas.push({
      titulo: "Lavado por vale",
      columnas: ["Vale", "Prenda", "Turno", "Recibidas", "Pend. inicial", "Lavadas", "Kg", "Pend. final", "Revisión"],
      filas: filasLav.map((f) => [
        f.vale, f.prenda, f.turno, fmt(f.recibidas), fmt(f.pendiente_inicial), fmt(f.lavadas), fmt(f.kg),
        fmt(pendienteFinal(f)), revisionLavado(f, rango),
      ]),
      total: ["Total", "", "", fmt(t.declaracion), "", fmt(t.produccion), fmt(t.kg), fmt(t.pendientes), ""],
    });
  }

  for (const area of AREAS) {
    const tandas = parte.procesado.filter((x) => x.area === area);
    if (tandas.length === 0) continue;
    const filas = tandas.flatMap((x) =>
      x.lineas.map((l) => {
        const fila = {
          ...l,
          fecha,
          turno: x.turno,
          area: x.area,
          equipo: x.equipo,
          operarios: x.operarios,
          jefe_turno: x.jefe_turno,
          vale: x.vale,
          hora_inicio: x.hora_inicio,
          hora_fin: x.hora_fin,
        };
        const manchas: Num[] = [l.m_rosa, l.m_negra, l.m_oxido, l.m_otras];
        return [
          x.vale, l.prenda, fmt(l.declaradas), fmt(l.conforme),
          manchas.every((m) => m === null) ? "" : fmt(manchas.reduce((a: number, b) => a + (b ?? 0), 0)),
          fmt(l.roturas), fmt(totalPMR(l)), fmt(l.pendientes), fmt(diferenciaProcesado(l)),
          revisionProcesado(fila, rango),
        ] as (string | number)[];
      })
    );
    tablas.push({
      titulo: `Procesado · ${area}`,
      columnas: ["Vale", "Prenda", "Declaradas", "Conforme", "Manchas", "Roturas", "Total P+M+R", "Pend.", "Dif.", "Revisión"],
      filas,
    });
  }

  const conteos = conteosDelParte(fecha, parte);
  if (conteos.length > 0) {
    const nombres = new Map([...ubicaciones, ...parte.inventario.extra].map((u) => [u.id, u.nombre]));
    const ids = prendas.map((p) => p.id);
    tablas.push({
      titulo: "Inventario contado hoy",
      columnas: ["Ubicación", ...prendas.map((p) => p.nombre), "Total"],
      filas: conteos.map((c) => [
        nombres.get(c.ubicacion) ?? c.ubicacion,
        ...ids.map((id) => fmt(c.valores[id])),
        fmt(totalConteo(c, ids)),
      ]),
    });
  }

  const novedades = eventos.filter((e) => e.fecha === fecha);
  if (novedades.length > 0) {
    tablas.push({
      titulo: "Novedades del día",
      columnas: ["Tipo", "Detalle", "Estado"],
      filas: novedades.map((e) => {
        const d = e.data as Record<string, unknown>;
        return [
          e.tipo === "accion" ? "Acción" : e.tipo.charAt(0).toUpperCase() + e.tipo.slice(1),
          String(d.impacto ?? d.accion ?? d.concepto ?? d.tarea ?? ""),
          String(d.estado ?? d.conciliado ?? ""),
        ];
      }),
    });
  }

  return {
    titulo: "Parte diario de control",
    hotel,
    polo,
    fechaLabel: fechaLarga(fecha),
    estado: j.cierre === "Cerrado" ? "Cerrado" : j.cierre === "Sin actividad" ? "Sin actividad" : "Pendiente de cerrar",
    campos,
    tablas,
  };
};

// -----------------------------------------------------------------------------
// Resumen del mes (hoja Resumen)
// -----------------------------------------------------------------------------
export const tablasResumenMes = (r: ResumenMes, eventos: ControlEvento[] = []): InformeTabla[] => {
  const { operacion: o } = r;
  const dias = (c: keyof typeof o.diasPorCompletar) =>
    o.diasPorCompletar[c] === 1 ? "1 día" : `${o.diasPorCompletar[c]} días`;

  const tablas: InformeTabla[] = [
    {
      titulo: "Producción y jornada registradas",
      columnas: ["Indicador", "Resultado", "Unidad", "Falta completar"],
      filas: [
        ["Producción lavada", fmt(o.total.kg), "kg", dias("kg")],
        ["Ocupación acumulada", fmt(o.total.turistas), "turistas días", dias("turistas")],
        ["Ropa recibida", fmt(o.total.recibidas), "piezas", dias("recibidas")],
        ["Ropa entregada", fmt(o.total.entregadas), "piezas", dias("entregadas")],
        ["Jornada prevista", fmt(o.total.horas_previstas), "h", dias("horas_previstas")],
        ["Tiempo trabajado", fmt(o.total.horas_trabajadas), "h", dias("horas_trabajadas")],
        ["Parada única", fmt(o.total.parada), "h", dias("parada")],
        ["Kg por turista día", fmt(o.kgPorTurista), "kg/TD", ""],
        ["Balance entregadas menos recibidas", fmt(o.balance), "piezas", ""],
      ],
    },
    {
      titulo: "Matriz de resultados del SLA",
      columnas: ["KPI", "Cantidad", "Base", "Meta", "Resultado", "Cumplimiento"],
      filas: r.kpis.map((k) => [k.nombre, fmt(k.cantidadValor), fmt(k.baseValor), pct(k.meta), pct(k.resultado), k.cumplimiento]),
      total: ["KPI que cumplen / evaluados", "", "", "", "", `${r.kpisCumplen} de ${r.kpisEvaluados}`],
    },
    {
      titulo: "Calidad percibida y controles",
      columnas: ["Lavado", "Encuestas", "Servicio", "Encuestas", "Reprocesos", "Reclamaciones", "Daños imputables"],
      filas: [
        [
          fmt(r.calidad.lavado.puntuacion) || "Completar",
          fmt(r.calidad.lavado.encuestas) || "Completar",
          fmt(r.calidad.servicio.puntuacion) || "Completar",
          fmt(r.calidad.servicio.encuestas) || "Completar",
          fmt(r.calidad.reprocesos) || "Completar",
          fmt(r.calidad.reclamaciones) || "Completar",
          fmt(r.calidad.danos) || "Completar",
        ],
      ],
    },
    {
      titulo: "Incidencias y estado técnico",
      columnas: ["Concepto", "Resultado", "Concepto", "Resultado"],
      filas: [
        ["Incidencias registradas", fmt(r.incidencias.registradas), "Equipos totales", fmt(r.equipos.total)],
        ["Incidencias cerradas", fmt(r.incidencias.cerradas), "Equipos operativos", fmt(r.equipos.operativos)],
        ["Horas por agua", fmt(r.incidencias.horasAgua), "Equipos fuera de servicio", fmt(r.equipos.fueraServicio)],
        ["Horas por electricidad", fmt(r.incidencias.horasElectricidad), "Preventivos previstos", fmt(r.equipos.preventivosPrevistos)],
        ["", "", "Preventivos ejecutados", fmt(r.equipos.preventivosEjecutados)],
      ],
    },
    {
      titulo: `Existencias frente a prendas pactadas · ${r.inventario.estado}`,
      columnas: ["Artículo", "Pactadas", "Actuales", "Saldo (+ / −)"],
      filas: r.articulos.map((a) => [a.prenda, fmt(a.pactadas), fmt(a.actuales), fmt(a.saldo)]),
      total: ["Total", fmt(r.inventario.pactadas), fmt(r.inventario.existencia), ""],
      extras: [["Faltantes / sobrantes", "", fmt(r.inventario.faltantes), fmt(r.inventario.sobrantes)]],
    },
    {
      titulo: "Importes por moneda",
      columnas: ["Moneda", "Calculado", "Conciliado", "Sin conciliar"],
      filas: r.retiros.porMoneda.map((f) => [f.clave, fmt(f.calculado), fmt(f.conciliado), fmt(f.sinConciliar)]),
    },
    {
      titulo: "Piezas por concepto",
      columnas: ["Concepto", "Piezas registradas", "Conciliadas", "Sin conciliar"],
      filas: r.retiros.porConcepto.map((f) => [f.clave, fmt(f.calculado), fmt(f.conciliado), fmt(f.sinConciliar)]),
    },
    {
      titulo: "Control del procesado por área (no se suman entre áreas)",
      columnas: ["Área", "Conformes", "Manchas", "Roturas", "Registros completos", "Por revisar", "Estado"],
      filas: r.areas.map((a) => [a.area, fmt(a.conformes), fmt(a.manchas), fmt(a.roturas), fmt(a.completos), fmt(a.porRevisar), a.estado]),
    },
    {
      titulo: "Seguimiento de acciones",
      columnas: ["Acciones del mes", "Cerradas", "Vencidas al cierre"],
      filas: [[fmt(r.acciones.delMes), fmt(r.acciones.cerradas), fmt(r.acciones.vencidas)]],
    },
  ];

  const incidencias = eventos.filter((e) => e.tipo === "incidencia");
  if (incidencias.length > 0) {
    tablas.push({
      titulo: "Detalle de incidencias",
      columnas: ["Fecha", "Causa", "Horas", "Impacto", "Imputable", "Estado"],
      filas: incidencias.map((e) => {
        const d = e.data as Record<string, unknown>;
        return [fechaCorta(e.fecha), String(d.causa ?? ""), fmt(d.duracion), String(d.impacto ?? ""), String(d.imputable ?? ""), String(d.estado ?? "")];
      }),
    });
  }

  tablas.push({
    titulo: "Revisión declarada de los registros",
    columnas: ["Hoja", "Revisión", "Detalle"],
    filas: r.revision.map((x) => [x.hoja, x.estado, x.detalle]),
  });

  return tablas;
};

export const seccionesSintesis = (r: ResumenMes): InformeSeccion[] => {
  const parrafo = (titulo: string, texto: string): InformeSeccion => ({
    titulo,
    bloques: [{ tipo: "parrafo", texto: texto?.trim() || "Completar en Cierre del mes." }],
  });
  return [
    parrafo("Logros y resultados", r.sintesis.logros),
    parrafo("Dificultades e impacto", r.sintesis.dificultades),
    parrafo("Acuerdos y conclusión", r.sintesis.acuerdos),
  ];
};

/**
 * Informe del mes. Las tablas y la síntesis salen de los datos, así que está
 * disponible sin la IA; `analisis` es lo que redacta la routine, si lo hay.
 */
export const buildInformeMes = (params: {
  resumen: ResumenMes;
  hotel: string;
  polo?: string;
  eventos?: ControlEvento[];
  analisis?: InformeSeccion[];
}): Informe => {
  const { resumen: r, hotel, polo, eventos = [], analisis = [] } = params;
  const operacionCompleta = r.operacion.diasPorCompletar.kg === 0;
  const campos: InformeCampo[] = [
    { label: "Representante", valor: r.datos.representante || "Completar" },
    { label: "Cargo", valor: r.datos.cargo || "Completar" },
    { label: "Elaborado el", valor: r.datos.fecha_elaboracion ? fechaCompleta(r.datos.fecha_elaboracion) : "Completar" },
    { label: "Personal efectivo", valor: textoCampo(r.datos.personal) },
    { label: "Aplicación del SLA", valor: r.datos.aplicacion_sla ? fechaCompleta(r.datos.aplicacion_sla) : "—" },
    { label: "Turnos", valor: r.datos.turnos || "—" },
  ];
  return {
    titulo: "Informe mensual de control",
    hotel,
    polo,
    fechaLabel: `${NOMBRES_MES[r.mes - 1]} ${r.anio}`,
    estado: operacionCompleta ? "Mes completo" : `Parcial: faltan ${r.operacion.diasPorCompletar.kg} días`,
    campos,
    tablas: tablasResumenMes(r, eventos),
    secciones: [...seccionesSintesis(r), ...analisis],
    textoAlFinal: true,
  };
};
