// Lo que no se puede contrastar con el Excel: los KPI (su fórmula está rota en el
// libro) y las ayudas que el Excel no tiene. El resto está en control.excel.test.ts.
import { describe, expect, it } from "vitest";
import { cumplimientoKpi, hoyLocal, KPIS_SLA, resultadoKpi } from "@/lib/control";
import {
  construirResumen,
  continuacionesDeAyer,
  ControlMesData,
  controlMesVacio,
  declaradasSugeridas,
  heredarControlMes,
  jornadaVacia,
  leerControlMes,
  leerParte,
  LineaProcesado,
  lineaProcesadoVacia,
  lineaTodoConforme,
  pactadasDeDotacion,
  ParteData,
  parteVacio,
  prendasDelVale,
  sugerenciaKpi,
} from "@/lib/controlResumen";
import { construirDashboardMes } from "@/lib/controlDashboard";
import { revisionProcesado, rangoMes } from "@/lib/control";
import { kpisDe } from "@/services/auditControl";
import type { FormDefinition } from "@/services/audit";

/** Metas inventadas: las reales son del contrato y no van al repositorio. */
const conMetas = (meta: number) => KPIS_SLA.map((k) => ({ ...k, meta }));

const lineaP = (prenda: string, declaradas: number | null, conforme: number | null = null): LineaProcesado => ({
  id: prenda,
  prenda,
  declaradas,
  conforme,
  m_rosa: null,
  m_negra: null,
  m_oxido: null,
  m_otras: null,
  roturas: null,
  pendientes: null,
  observaciones: "",
});

const tanda = (area: string, vale: string, lineas: LineaProcesado[]) => ({
  id: `${area}-${vale}`,
  area,
  vale,
  turno: "Día",
  equipo: "",
  operarios: "",
  jefe_turno: "",
  hora_inicio: "",
  hora_fin: "",
  lineas,
});

const parteConLavado = (): ParteData => ({
  ...parteVacio(),
  lavado: [
    {
      id: "v",
      vale: "V1",
      turno: "Día",
      operario: "",
      equipo: "",
      lineas: [
        { id: "a", prenda: "Sábana", recibidas: 100, pendiente_inicial: 0, lavadas: 90, kg: 70, observaciones: "" },
        { id: "b", prenda: "Toalla", recibidas: 50, pendiente_inicial: 0, lavadas: 50, kg: 30, observaciones: "" },
      ],
    },
  ],
});

describe("KPI del SLA: la fórmula que el Excel perdió", () => {
  it("resultado = cantidad ÷ base, con sus casos de la hoja", () => {
    expect(resultadoKpi(null, 30)).toBe("Completar");
    expect(resultadoKpi(28, null)).toBe("Completar");
    expect(resultadoKpi(31, 30)).toBe("Revisar");
    expect(resultadoKpi(-1, 30)).toBe("Revisar");
    expect(resultadoKpi(0, 0)).toBe("No aplica");
    expect(resultadoKpi(21, 30)).toBeCloseTo(0.7);
  });

  it("cumple justo al llegar a la meta; «No aplica» no cuenta como cumple", () => {
    expect(cumplimientoKpi(0.7, 0.7)).toBe("Cumple");
    expect(cumplimientoKpi(0.69, 0.7)).toBe("No cumple");
    expect(cumplimientoKpi("No aplica", 0.7)).toBe("No aplica");
    expect(cumplimientoKpi("Completar", 0.7)).toBe("Completar");
  });

  it("las metas no están en el repositorio: sin cargar, no se dice si cumple", () => {
    expect(KPIS_SLA).toHaveLength(10);
    expect(KPIS_SLA.every((k) => k.meta === null)).toBe(true);
    expect(cumplimientoKpi(0.9, null)).toBe("Completar");
    const metas = { ciclo: 0.5, disponibilidad_lenceria: "no es un número" };
    const kpis = kpisDe({ config: { metas } } as unknown as FormDefinition);
    expect(kpis.find((k) => k.key === "ciclo")?.meta).toBe(0.5);
    expect(kpis.find((k) => k.key === "disponibilidad_lenceria")?.meta).toBeNull();
    expect(kpisDe(null).every((k) => k.meta === null)).toBe(true);
  });

  it("cuenta cumplidos y evaluados, y sin datos no evalúa", () => {
    const control = controlMesVacio();
    control.kpis = {
      ciclo: { cantidad: 28, base: 30, documento: "" },
      disponibilidad_lenceria: { cantidad: 10, base: 30, documento: "" },
      continuidad: { cantidad: 0, base: 0, documento: "" },
    };
    const r = construirResumen({ anio: 2026, mes: 10, partes: [], control, eventos: [], prendas: [], ubicaciones: [], pactadas: {}, kpis: conMetas(0.6) });
    expect(r.kpisCumplen).toBe(1);
    expect(r.kpisEvaluados).toBe(2);
  });
});

describe("Ayudas del parte", () => {
  it("«Todo conforme» deja la fila completa y sin diferencia", () => {
    const l = lineaTodoConforme(lineaP("Toalla", 40));
    expect(l).toMatchObject({ conforme: 40, m_rosa: 0, m_negra: 0, m_oxido: 0, m_otras: 0, roturas: 0, pendientes: 0 });
    const fila = { ...l, fecha: "2026-10-05", turno: "Día", area: "Secado", equipo: "", operarios: "", jefe_turno: "", vale: "V1", hora_inicio: "", hora_fin: "" };
    expect(revisionProcesado(fila, rangoMes(2026, 10))).toBe("Completo");
  });

  it("una fila solo es vacía si no se ha escrito ningún resultado", () => {
    expect(lineaProcesadoVacia(lineaP("Toalla", 40))).toBe(true);
    expect(lineaProcesadoVacia(lineaP("Toalla", 40, 40))).toBe(false);
    // 0 es un dato comprobado, no un vacío.
    expect(lineaProcesadoVacia({ ...lineaP("Toalla", 40), roturas: 0 })).toBe(false);
  });

  it("las declaradas vienen de lo lavado y, después, de lo conforme de la etapa anterior", () => {
    const p = parteConLavado();
    expect(declaradasSugeridas(p, "Secado", "V1", "Sábana")).toBe(90);
    p.procesado = [tanda("Secado", "V1", [lineaP("Sábana", 90, 85)])];
    expect(declaradasSugeridas(p, "Planchado", "V1", "Sábana")).toBe(85);
  });

  it("se salta las áreas por las que la prenda no pasó", () => {
    const p = parteConLavado();
    p.procesado = [tanda("Secado", "V1", [lineaP("Toalla", 50, 49)])];
    // Las toallas no se planchan: en Doblado llega lo conforme de Secado.
    expect(declaradasSugeridas(p, "Doblado", "V1", "Toalla")).toBe(49);
  });

  it("un vale lleva a un área las prendas que salieron antes", () => {
    const p = parteConLavado();
    expect(prendasDelVale(p, "Secado", "V1")).toEqual(["Sábana", "Toalla"]);
    expect(prendasDelVale(p, "Secado", "V9")).toEqual([]);
  });

  it("trae de ayer solo lo que quedó pendiente, con recibidas = 0", () => {
    let n = 0;
    const siguiente = () => `id${++n}`;
    const conts = continuacionesDeAyer(parteConLavado(), siguiente);
    expect(conts).toHaveLength(1);
    expect(conts[0].lineas).toHaveLength(1);
    expect(conts[0].lineas[0]).toMatchObject({ prenda: "Sábana", recibidas: 0, pendiente_inicial: 10, lavadas: null, kg: null });
    expect(continuacionesDeAyer(null, siguiente)).toEqual([]);
  });

  it("un mes nuevo hereda lo estable y no lo que es del mes", () => {
    const previo: ControlMesData = {
      ...controlMesVacio(),
      datos: { ...controlMesVacio().datos, representante: "R", cargo: "C", fecha_elaboracion: "2026-10-31", aplicacion_sla: "2026-08-19", personal: 18 },
      kpis: { ciclo: { cantidad: 1, base: 2, documento: "" } },
      sintesis: { logros: "L", dificultades: "D", acuerdos: "A" },
      revision: { operacion: "Validado" },
      equipos: [{ id: "e", nombre: "Lavadoras", total: 4, operativos: 3, estado_causa: "x", intervencion: "Correa", pendiente: "p", responsable: "T", fecha_prevista: null, parte: "OT" }],
    };
    const n = heredarControlMes(previo);
    expect(n.datos).toMatchObject({ representante: "R", cargo: "C", aplicacion_sla: "2026-08-19", personal: 18, fecha_elaboracion: "" });
    expect(n.kpis).toEqual({});
    expect(n.sintesis.logros).toBe("");
    expect(n.revision).toEqual({});
    expect(n.equipos[0]).toMatchObject({ nombre: "Lavadoras", total: 4, operativos: 3, intervencion: "", parte: "" });
  });

  it("las pactadas suman la dotación por prenda", () => {
    expect(pactadasDeDotacion({ u1: { p1: 5, p2: 1 }, u2: { p1: 7 } })).toEqual({ p1: 12, p2: 1 });
    expect(pactadasDeDotacion(null)).toEqual({});
  });

  it("propone conteos de KPI solo cuando hay de dónde sacarlos", () => {
    const base = { equipos: { preventivosEjecutados: 5, preventivosPrevistos: 6 } as any, areas: [] as any[] };
    expect(sugerenciaKpi("preventivo", base)).toEqual({ cantidad: 5, base: 6 });
    expect(sugerenciaKpi("calidad", base)).toBeNull();
    expect(sugerenciaKpi("ciclo", base)).toBeNull();
    expect(sugerenciaKpi("preventivo", { ...base, equipos: { preventivosEjecutados: "Completar", preventivosPrevistos: "Completar" } as any })).toBeNull();
  });

  it("lee sin romperse datos a medias de la base", () => {
    expect(leerParte(null)).toEqual(parteVacio());
    expect(leerParte({ jornada: { turistas: 5 } }).jornada).toEqual({ ...jornadaVacia(), turistas: 5 });
    expect(leerControlMes({ kpis: { x: 1 } }).encuestas.lavado.puntuacion).toBeNull();
  });

  it("hoy es la fecha local, no la UTC", () => {
    expect(hoyLocal(new Date(2026, 10, 2, 23, 30))).toBe("2026-11-02");
  });
});

describe("Varios partes del mismo día", () => {
  const conJornada = (j: Partial<ParteData["jornada"]>): ParteData => ({ ...parteVacio(), jornada: { ...jornadaVacia(), ...j } });

  it("los turistas no se suman; un día con alguien abierto sigue abierto", () => {
    const r = construirResumen({
      anio: 2026,
      mes: 10,
      partes: [
        { fecha: "2026-10-03", data: conJornada({ turistas: 600, cierre: "Cerrado" }), updated_at: "2026-10-03T10:00:00Z" },
        { fecha: "2026-10-03", data: conJornada({ turistas: 610, cierre: "Pendiente" }), updated_at: "2026-10-03T20:00:00Z" },
      ],
      control: null,
      eventos: [],
      prendas: [],
      ubicaciones: [],
      pactadas: {},
    });
    const fila = r.filasOperacion[2];
    expect(fila.turistas).toBe(610);
    expect(fila.cierre).toBe("Pendiente");
    expect(r.operacion.total.turistas).toBe(610);
  });

  it("dos personas contando lo mismo el mismo día es un duplicado", () => {
    const inv = (n: number): ParteData => ({ ...parteVacio(), inventario: { conteos: { u1: { p1: n } }, observaciones: {}, extra: [] } });
    const r = construirResumen({
      anio: 2026,
      mes: 10,
      partes: [{ fecha: "2026-10-03", data: inv(5) }, { fecha: "2026-10-03", data: inv(6) }],
      control: null,
      eventos: [],
      prendas: [{ id: "p1", nombre: "Sábana" }],
      ubicaciones: [{ id: "u1", nombre: "Piso" }],
      pactadas: { p1: 5 },
    });
    expect(r.inventario.articulos[0].resultado).toBe("Revisar duplicados");
    expect(r.inventario.articulos[0].prenda).toBe("Sábana");
  });
});

describe("Dashboard del mes", () => {
  const dia = (kg: number, cierre: ParteData["jornada"]["cierre"]): ParteData => ({
    ...parteVacio(),
    jornada: { ...jornadaVacia(), turistas: 100, entregadas: 10, horas_previstas: 16, horas_trabajadas: 16, parada: 0, cierre },
    lavado: [
      { id: "v", vale: "V", turno: "Día", operario: "", equipo: "", lineas: [{ id: "l", prenda: "Sábana", recibidas: 10, pendiente_inicial: 0, lavadas: 10, kg, observaciones: "" }] },
    ],
  });

  const montar = (partes: { fecha: string; data: ParteData }[], control: ControlMesData | null = null) =>
    construirDashboardMes({
      resumen: construirResumen({ anio: 2026, mes: 10, partes, control, eventos: [], prendas: [], ubicaciones: [], pactadas: {}, kpis: conMetas(0.9) }),
      partes,
      hoy: "2026-10-31",
    });

  const octubre = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;

  it("clasifica contra la mediana y un día abierto no se juzga", () => {
    const partes = [
      { fecha: octubre(1), data: dia(800, "Cerrado") },
      { fecha: octubre(2), data: dia(800, "Cerrado") },
      { fecha: octubre(3), data: dia(800, "Cerrado") },
      { fecha: octubre(4), data: dia(300, "Cerrado") },
      { fecha: octubre(5), data: dia(500, "Cerrado") },
      { fecha: octubre(6), data: dia(1300, "Cerrado") },
      { fecha: octubre(7), data: dia(100, "Pendiente") },
    ];
    const d = montar(partes);
    const estado = (n: number) => d.dias[n - 1].estado;
    expect(d.mediana).toBe(800);
    expect(estado(1)).toBe("normal");
    expect(estado(4)).toBe("muy_bajo");
    expect(estado(5)).toBe("bajo");
    expect(estado(6)).toBe("alto");
    expect(estado(7)).toBe("borrador");
    expect(d.alertas.find((a) => a.id === `bajo-${octubre(4)}`)?.severidad).toBe("alta");
    expect(d.alertas.find((a) => a.id === `bajo-${octubre(5)}`)?.severidad).toBe("media");
    expect(d.alertas.some((a) => a.id === `bajo-${octubre(7)}`)).toBe(false);
  });

  it("sin tres días de referencia no avisa de días flojos", () => {
    const d = montar([{ fecha: octubre(1), data: dia(800, "Cerrado") }, { fecha: octubre(2), data: dia(100, "Cerrado") }]);
    expect(d.alertas.some((a) => a.id.startsWith("bajo-"))).toBe(false);
  });

  it("avisa de los días pasados sin cerrar y de los KPI que no cumplen, primero lo urgente", () => {
    const control = controlMesVacio();
    control.kpis = { disponibilidad_lenceria: { cantidad: 26, base: 30, documento: "" } };
    const d = montar([{ fecha: octubre(1), data: dia(800, "Cerrado") }, { fecha: octubre(2), data: dia(100, "Pendiente") }], control);
    expect(d.alertas[0].id).toBe("kpi-disponibilidad_lenceria");
    const dias = d.alertas.find((a) => a.id === "dias-sin-cerrar");
    expect(dias?.titulo).toBe("29 días pasados sin cerrar");
    expect(dias?.detalle).toContain("Sigue pendiente el 2");
  });

  it("una jornada cerrada con registros incompletos no cuenta y avisa", () => {
    const mala = dia(800, "Cerrado");
    mala.lavado[0].lineas[0].kg = null;
    const d = montar([{ fecha: octubre(1), data: mala }]);
    expect(d.resumen.filasOperacion[0].kg).toBe("Revisar detalle");
    expect(d.alertas.some((a) => a.id === "dias-por-revisar")).toBe(true);
  });
});
