// -----------------------------------------------------------------------------
// Contraste con el Excel.
//
// `fixtures/modeloMensual.json` se generó rellenando una copia del «Modelo Mensual»
// con datos INVENTADOS y calculándola con un motor de hojas de cálculo: `entrada`
// es lo que se tecleó y `esperado` lo que dieron las fórmulas reales del libro. Si
// cambia una fórmula del Excel hay que regenerarlo; si falla aquí sin que el Excel
// haya cambiado, es la app la que se ha separado de la hoja.
//
// Los KPI no están: en el libro su resultado es `#REF!` (ver `resultadoKpi`).
// -----------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/modeloMensual.json";
import {
  celdaDetalle,
  COLUMNAS_OPERACION,
  ConteoUbicacion,
  diferenciaProcesado,
  duracionHoras,
  duracionInformada,
  FilaLavado,
  FilaOperacion,
  FilaProcesado,
  fueraDeServicio,
  importeRetiro,
  pendienteFinal,
  rangoMes,
  resumenAreas,
  resumenInventario,
  revisionConteo,
  revisionLavado,
  revisionProcesado,
  situacionAccion,
  totalConteo,
  totalesAcciones,
  totalesEquipos,
  totalesIncidencias,
  totalesLavado,
  totalesOperacion,
  totalesRetiros,
  totalPMR,
} from "@/lib/control";
import { construirResumen, ParteData, ParteRegistro, jornadaVacia, EventoRegistro, controlMesVacio } from "@/lib/controlResumen";

type Escenario = (typeof fixture.escenarios)[number];
const { prendas, ubicaciones, escenarios } = fixture;

/** Vacío en la hoja es "" o null; en la app es null. Los números, con tolerancia. */
const igual = (obtenido: unknown, esperado: unknown, donde: string) => {
  const norm = (v: unknown) => (v === "" || v === undefined ? null : v);
  const a = norm(obtenido);
  const b = norm(esperado);
  if (typeof a === "number" && typeof b === "number") {
    expect(a, donde).toBeCloseTo(b, 6);
  } else {
    expect(a, donde).toEqual(b);
  }
};

const lista = (obtenidos: unknown[], esperados: unknown[], donde: string) => {
  expect(obtenidos.length, donde).toBe(esperados.length);
  obtenidos.forEach((v, i) => igual(v, esperados[i], `${donde}[${i}]`));
};

const lavado = (e: Escenario) => e.entrada.lavado as unknown as FilaLavado[];
const procesado = (e: Escenario) => e.entrada.procesado as unknown as FilaProcesado[];

describe.each(escenarios.map((e) => [e.entrada.nombre, e] as const))("Excel, escenario %s", (_n, e) => {
  const { entrada: en, esperado: x } = e;
  const r = rangoMes(en.anio, en.mes);
  const rev = en.revision as Record<string, "Pendiente" | "Validado" | "Sin actividad">;

  it("Lavado_detalle", () => {
    lista(lavado(e).map((f) => pendienteFinal(f)), x.lavado.I, "I");
    lista(lavado(e).map((f) => revisionLavado(f, r)), x.lavado.M, "M");
    const t = totalesLavado(lavado(e), r);
    igual(t.piezas, x.lavado.B7, "B7");
    igual(t.kg, x.lavado.E7, "E7");
    igual(t.pendientes, x.lavado.H7, "H7");
  });

  it("Procesado_detalle", () => {
    lista(procesado(e).map((f) => totalPMR(f)), x.procesado.R, "R");
    lista(procesado(e).map((f) => diferenciaProcesado(f)), x.procesado.S, "S");
    lista(procesado(e).map((f) => duracionHoras(f.hora_inicio, f.hora_fin)), x.procesado.U, "U");
    lista(procesado(e).map((f) => revisionProcesado(f, r)), x.procesado.W, "W");
  });

  it("Operacion", () => {
    const fechas = x.operacion.A.filter(Boolean) as string[];
    expect(fechas.length).toBe(r.dias);
    const filas: FilaOperacion[] = fechas.map((fecha) => {
      const j = (en.jornadas as Record<string, any>)[fecha] ?? null;
      const lav = lavado(e).filter((f) => f.fecha === fecha);
      return {
        fecha,
        turistas: j?.turistas ?? null,
        kg: celdaDetalle(j?.cierre, lav, r, "kg"),
        recibidas: celdaDetalle(j?.cierre, lav, r, "recibidas"),
        entregadas: j?.entregadas ?? null,
        horas_previstas: j?.horas_previstas ?? null,
        horas_trabajadas: j?.horas_trabajadas ?? null,
        parada: j?.parada ?? null,
        observacion: "",
        cierre: j?.cierre ?? null,
      };
    });
    lista(filas.map((f) => f.kg), x.operacion.C.slice(0, r.dias), "C");
    lista(filas.map((f) => f.recibidas), x.operacion.D.slice(0, r.dias), "D");

    const t = totalesOperacion(filas, r.dias, rev.operacion);
    lista(COLUMNAS_OPERACION.map((c) => t.total[c]), x.operacion.f45, "fila 45");
    lista(COLUMNAS_OPERACION.map((c) => t.diasConDato[c]), x.operacion.f46, "fila 46");
    lista(COLUMNAS_OPERACION.map((c) => t.diasPorCompletar[c]), x.operacion.f47, "fila 47");
    igual(t.kgPorTurista, x.operacion.B49, "B49");
    igual(t.balance, x.resumen.B20, "Resumen!B20");
  });

  it("Incidencias", () => {
    const items = en.incidencias as any[];
    lista(items.map(duracionInformada), x.incidencias.K, "K");
    const t = totalesIncidencias(items, r, rev.incidencias);
    igual(t.registradas, x.incidencias.B113, "B113");
    igual(t.cerradas, x.incidencias.B114, "B114");
    igual(t.horasAgua, x.incidencias.B115, "B115");
    igual(t.horasElectricidad, x.incidencias.B116, "B116");
  });

  it("Equipos", () => {
    const eq = en.equipos as any[];
    lista(eq.map(fueraDeServicio), x.equipos.D, "D");
    const t = totalesEquipos(eq, en.mantenimiento as any[], r, rev.equipos);
    igual(t.total, x.equipos.B33, "B33");
    igual(t.operativos, x.equipos.D33, "D33");
    igual(t.fueraServicio, x.equipos.F33, "F33");
    igual(t.preventivosPrevistos, x.equipos.B89, "B89");
    igual(t.preventivosEjecutados, x.equipos.D89, "D89");
  });

  it("Retiros_importes", () => {
    const items = en.retiros as any[];
    lista(items.map(importeRetiro), x.retiros.I, "I");
    const t = totalesRetiros(items, r, rev.retiros);
    t.porMoneda.forEach((f, i) =>
      lista([f.calculado, f.conciliado, f.sinConciliar], x.retiros.moneda[i], `moneda ${f.clave}`)
    );
    t.porConcepto.forEach((f, i) =>
      lista([f.calculado, f.conciliado, f.sinConciliar], x.retiros.concepto[i], `concepto ${f.clave}`)
    );
  });

  it("Acciones", () => {
    const items = en.acciones as any[];
    lista(items.map((a) => situacionAccion(a, r)), x.acciones.I, "I");
    const t = totalesAcciones(items, r, rev.acciones);
    igual(t.delMes, x.acciones.B113, "B113");
    igual(t.cerradas, x.acciones.B114, "B114");
    igual(t.vencidas, x.acciones.B115, "B115");
  });

  it("Inventario", () => {
    const conteos = en.conteos as unknown as ConteoUbicacion[];
    const repetida = (c: ConteoUbicacion) =>
      conteos.filter((o) => o.fecha === c.fecha && o.ubicacion === c.ubicacion).length > 1;
    lista(conteos.map((c) => revisionConteo(c, prendas, repetida(c))), x.inventario.M, "M");
    lista(conteos.map((c) => totalConteo(c, prendas)), x.inventario.K, "K");

    const t = resumenInventario(conteos, prendas, ubicaciones, en.pactadas as any);
    igual(t.ubicaciones, x.inventario.E7, "E7");
    igual(t.estado, x.inventario.H7, "H7");
    igual(t.ultimoDato, x.inventario.B7, "B7");
    igual(t.existencia, x.resumen.B50, "Resumen!B50");
    igual(t.pactadas, x.resumen.B51, "Resumen!B51");
    igual(t.faltantes, x.resumen.B52, "Resumen!B52");
    igual(t.sobrantes, x.resumen.B53, "Resumen!B53");
    t.articulos.forEach((a, i) => {
      const f = x.inventario.articulos[i];
      const donde = `fila ${483 + i}`;
      igual(a.prenda, f.A, `${donde} A`);
      igual(a.pactadas, f.B, `${donde} B`);
      igual(a.primera, f.C, `${donde} C`);
      igual(a.actual, f.D, `${donde} D`);
      igual(a.variacion, f.E, `${donde} E`);
      igual(a.sobrantes, f.F, `${donde} F`);
      igual(a.faltantes, f.G, `${donde} G`);
      igual(`${a.ubicacionesConDato} de ${a.ubicacionesTotal}`, f.H, `${donde} H`);
      igual(a.primerDato, f.I, `${donde} I`);
      igual(a.ultimoDato, f.J, `${donde} J`);
      igual(a.resultado, f.K, `${donde} K`);
    });
  });

  it("Resumen por área", () => {
    const areas = resumenAreas(procesado(e), r);
    areas.forEach((a, i) => {
      lista([a.conformes, a.manchas, a.roturas], x.resumen.areas[i], `área ${a.area}`);
      lista([a.completos, a.porRevisar, a.estado], x.resumen.rev[i], `revisión ${a.area}`);
    });
  });

  // Todo junto, por el camino de la app: partes del día + documento del mes + novedades.
  it("Resumen completo a partir de los partes", () => {
    const partes: ParteRegistro[] = [];
    const fechas = new Set<string>([
      ...lavado(e).map((f) => f.fecha),
      ...procesado(e).map((f) => f.fecha),
      ...Object.keys(en.jornadas),
      ...(en.conteos as any[]).map((c) => c.fecha),
    ] as string[]);
    const nuevaParte = (fecha: string): ParteData => ({
      jornada: (en.jornadas as Record<string, any>)[fecha] ?? jornadaVacia(),
      lavado: lavado(e)
        .filter((f) => f.fecha === fecha)
        .map((f, i) => ({
          id: `v${i}`,
          vale: f.vale,
          turno: f.turno,
          operario: f.operario,
          equipo: f.equipo,
          lineas: [{ ...f, id: `l${i}` }],
        })),
      procesado: procesado(e)
        .filter((f) => f.fecha === fecha)
        .map((f, i) => ({ ...f, id: `t${i}`, lineas: [{ ...f, id: `p${i}` }] })),
      inventario: { conteos: {}, observaciones: {}, extra: [] },
    });
    for (const fecha of fechas) {
      const parte = nuevaParte(fecha);
      const delDia = (en.conteos as unknown as ConteoUbicacion[]).filter((c) => c.fecha === fecha);
      const vistos = new Set<string>();
      const repetidos: ConteoUbicacion[] = [];
      for (const c of delDia) {
        if (vistos.has(c.ubicacion)) repetidos.push(c);
        else {
          vistos.add(c.ubicacion);
          parte.inventario.conteos[c.ubicacion] = c.valores;
        }
      }
      partes.push({ fecha, data: parte });
      // Mismo sitio y fecha en otro parte: dos personas contaron lo mismo.
      for (const c of repetidos) {
        const otro: ParteData = {
          jornada: parte.jornada,
          lavado: [],
          procesado: [],
          inventario: { conteos: { [c.ubicacion]: c.valores }, observaciones: {}, extra: [] },
        };
        partes.push({ fecha, data: otro });
      }
    }
    const control = controlMesVacio();
    control.revision = rev as any;
    control.datos = { ...control.datos, ...en.datos };
    control.equipos = en.equipos as any;
    const evento = (tipo: EventoRegistro["tipo"]) => (d: any): EventoRegistro => ({
      id: "x",
      tipo,
      fecha: d.fecha ?? d.fecha_planificada,
      data: d,
    });
    const res = construirResumen({
      anio: en.anio,
      mes: en.mes,
      partes,
      control,
      eventos: [
        ...(en.incidencias as any[]).map(evento("incidencia")),
        ...(en.mantenimiento as any[]).map(evento("mantenimiento")),
        ...(en.retiros as any[]).map(evento("retiro")),
        ...(en.acciones as any[]).map(evento("accion")),
      ],
      prendas: prendas.map((p) => ({ id: p, nombre: p })),
      ubicaciones: ubicaciones.map((u) => ({ id: u, nombre: u })),
      pactadas: en.pactadas as any,
    });
    const z = x.resumen;
    igual(res.operacion.total.kg, z.B12, "B12 producción");
    igual(res.operacion.total.turistas, z.B13, "B13 ocupación");
    igual(res.operacion.total.recibidas, z.B14, "B14 recibida");
    igual(res.operacion.total.entregadas, z.B15, "B15 entregada");
    igual(res.operacion.total.horas_previstas, z.B16, "B16");
    igual(res.operacion.total.horas_trabajadas, z.B17, "B17");
    igual(res.operacion.total.parada, z.B18, "B18");
    igual(res.operacion.kgPorTurista, z.B19, "B19");
    igual(res.operacion.balance, z.B20, "B20");
    igual(`${res.operacion.diasPorCompletar.kg} días`, z.D12, "D12");

    igual(res.incidencias.registradas, z.B41, "B41");
    igual(res.incidencias.cerradas, z.B42, "B42");
    igual(res.incidencias.horasAgua, z.B43, "B43");
    igual(res.incidencias.horasElectricidad, z.B44, "B44");
    igual(res.equipos.total, z.G41, "G41");
    igual(res.equipos.operativos, z.G42, "G42");
    igual(res.equipos.fueraServicio, z.G43, "G43");
    igual(res.equipos.preventivosPrevistos, z.G44, "G44");
    igual(res.equipos.preventivosEjecutados, z.G45, "G45");

    igual(res.inventario.existencia, z.B50, "B50");
    igual(res.inventario.estado, z.B54, "B54");
    res.articulos.forEach((a, i) => lista([a.pactadas, a.actuales, a.saldo], z.articulos[i], `artículo ${a.prenda}`));

    igual(res.retiros.porMoneda[0].calculado, z.G51, "G51");
    igual(res.retiros.porMoneda[1].conciliado, z.H52, "H52");
    igual(res.retiros.porMoneda[2].sinConciliar, z.I53, "I53");
    igual(res.retiros.porConcepto[0].calculado, z.G56, "G56");
    igual(res.retiros.porConcepto[1].calculado, z.G57, "G57");
    igual(res.retiros.porConcepto[2].calculado, z.G58, "G58");
    igual(res.acciones.delMes, z.G61, "G61");
    igual(res.acciones.cerradas, z.G62, "G62");
    igual(res.acciones.vencidas, z.G63, "G63");

    igual(res.revision[0].estado, z.G12, "G12");
    igual(res.revision[1].estado, z.G13, "G13");
    igual(res.revision[2].estado, z.G14, "G14");
    igual(res.revision[3].estado, z.G15, "G15");
    igual(res.revision[4].estado, z.G16, "G16");
    igual(res.revision[5].estado, z.G17, "G17");
    igual(res.revision[6].estado, z.G18, "G18");
    igual(res.revision[7].estado, z.G19, "G19");

    igual(res.registros.lavado, z.G87, "G87");
    igual(res.lavado.pendientes, z.H87, "H87");
    igual(res.registros.procesado, z.G89, "G89");
    igual(res.procesado.pendientes, z.H89, "H89");
  });
});
