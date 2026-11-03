import { describe, expect, it, vi } from "vitest";
import { construirResumen, controlMesVacio, jornadaVacia, ParteData, parteVacio } from "@/lib/controlResumen";
import { buildInformeMes, buildInformeParte } from "@/lib/informeControl";
import { buildInformeMensual, seccionesDelReporte } from "@/lib/informeMensual";
import { construirInformePdf } from "@/lib/informePdf";
import type { MonthlyReport } from "@/services/audit";

vi.mock("@/assets/polarier-logo.png", () => ({ default: "" }));

const PRENDAS = [{ id: "p1", nombre: "Sábana personal" }];
const UBIC = [{ id: "u1", nombre: "Piso 24" }];

const parte: ParteData = {
  ...parteVacio(),
  jornada: { ...jornadaVacia(), turistas: 600, entregadas: 1500, horas_previstas: 16, horas_trabajadas: 15.5, parada: 0.5, cierre: "Cerrado" },
  lavado: [
    {
      id: "v",
      vale: "V-1",
      turno: "Día",
      operario: "",
      equipo: "",
      lineas: [{ id: "l", prenda: "Sábana personal", recibidas: 120, pendiente_inicial: 0, lavadas: 100, kg: 75.5, observaciones: "" }],
    },
  ],
  procesado: [
    {
      id: "t",
      area: "Secado",
      vale: "V-1",
      turno: "Día",
      equipo: "",
      operarios: "",
      jefe_turno: "",
      hora_inicio: "08:00",
      hora_fin: "09:00",
      lineas: [{ id: "x", prenda: "Sábana personal", declaradas: 100, conforme: 96, m_rosa: 1, m_negra: 1, m_oxido: 0, m_otras: 0, roturas: 1, pendientes: 1, observaciones: "" }],
    },
  ],
  inventario: { conteos: { u1: { p1: 41 } }, observaciones: {}, extra: [] },
};

const resumen = () =>
  construirResumen({
    anio: 2026,
    mes: 11,
    partes: [{ fecha: "2026-11-02", data: parte }],
    control: controlMesVacio(),
    eventos: [],
    prendas: PRENDAS,
    ubicaciones: UBIC,
    pactadas: { p1: 100 },
  });

describe("Informe del parte diario", () => {
  const informe = buildInformeParte({ fecha: "2026-11-02", data: parte, hotel: "Hotel", prendas: PRENDAS, ubicaciones: UBIC });

  it("trae jornada, lavado, procesado por área e inventario de ese día", () => {
    expect(informe.titulo).toBe("Parte diario de control");
    expect(informe.estado).toBe("Cerrado");
    expect(informe.campos.find((c) => c.label === "Turistas del día")?.valor).toBe("600");
    expect(informe.tablas.map((t) => t.titulo)).toEqual(["Lavado por vale", "Procesado · Secado", "Inventario contado hoy"]);
  });

  it("calcula en cada fila: pendiente final y manchas sumadas", () => {
    const [lavado, procesado, inventario] = informe.tablas;
    expect(lavado.filas[0]).toContain("20"); // pendiente final 120 + 0 - 100
    expect(procesado.filas[0][4]).toBe("2"); // manchas
    expect(inventario.filas[0][0]).toBe("Piso 24");
  });

  it("sin datos no inventa tablas", () => {
    const vacio = buildInformeParte({ fecha: "2026-11-02", data: null, hotel: "Hotel", prendas: PRENDAS, ubicaciones: UBIC });
    expect(vacio.tablas).toEqual([]);
    expect(vacio.estado).toBe("Pendiente de cerrar");
    expect(vacio.campos.find((c) => c.label === "Turistas del día")?.valor).toBe("—");
  });
});

describe("Informe del mes", () => {
  it("lo pendiente sale como «Completar», nunca como 0", () => {
    const i = buildInformeMes({ resumen: resumen(), hotel: "Hotel" });
    const prod = i.tablas.find((t) => t.titulo === "Producción y jornada registradas");
    expect(prod?.filas.find((f) => f[0] === "Kg por turista día")?.[1]).toBe("Completar");
    expect(prod?.filas.find((f) => f[0] === "Producción lavada")?.[1]).toBe("75,5");
    expect(prod?.filas.find((f) => f[0] === "Producción lavada")?.[3]).toBe("29 días");
    expect(i.estado).toBe("Parcial: faltan 29 días");
    const calidad = i.tablas.find((t) => t.titulo === "Calidad percibida y controles");
    expect(calidad?.filas[0][0]).toBe("Completar");
    expect(i.campos.find((c) => c.label === "Representante")?.valor).toBe("Completar");
  });

  it("las cabeceras solo usan caracteres que la Helvetica del PDF sabe pintar", () => {
    const i = buildInformeMes({ resumen: resumen(), hotel: "Hotel" });
    for (const c of i.tablas.flatMap((t) => t.columnas)) expect(c).toMatch(/^[ -ÿ—–]*$/);
  });

  it("tiene las tablas de la hoja Resumen y el texto cierra el documento", () => {
    const analisis = [{ titulo: "Análisis", bloques: [{ tipo: "parrafo" as const, texto: "Texto de la routine" }] }];
    const i = buildInformeMes({ resumen: resumen(), hotel: "Hotel", analisis });
    expect(i.tablas.map((t) => t.titulo)).toEqual(
      expect.arrayContaining([
        "Matriz de resultados del SLA",
        "Importes por moneda",
        "Piezas por concepto",
        "Seguimiento de acciones",
        "Revisión declarada de los registros",
      ])
    );
    expect(i.textoAlFinal).toBe(true);
    expect(i.secciones?.map((s) => s.titulo)).toEqual([
      "Logros y resultados",
      "Dificultades e impacto",
      "Acuerdos y conclusión",
      "Análisis",
    ]);
    expect(i.secciones?.[0].bloques[0].texto).toBe("Completar en Cierre del mes.");
  });

  it("se puede construir en PDF, con el texto al final", async () => {
    const doc = await construirInformePdf(buildInformeMes({ resumen: resumen(), hotel: "Hotel" }));
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const diario = await construirInformePdf(
      buildInformeParte({ fecha: "2026-11-02", data: parte, hotel: "Hotel", prendas: PRENDAS, ubicaciones: UBIC })
    );
    expect(diario.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  }, 20000);

  it("el análisis de la routine se reutiliza sin cambiar el informe antiguo", () => {
    const reporte = {
      anio: 2026,
      mes: 10,
      estado: "listo",
      resumen: { analisis: "# Título\n\n## Volumen\n\nTexto.", valoraciones: ["Una"] },
      metricas: {},
    } as unknown as MonthlyReport;
    expect(seccionesDelReporte(reporte).map((s) => s.titulo)).toEqual(["Volumen", "Valoraciones"]);
    expect(seccionesDelReporte(null)).toEqual([]);
    expect(buildInformeMensual({ reporte, hotel: "H" })?.secciones?.map((s) => s.titulo)).toEqual(["Volumen", "Valoraciones"]);
  });
});
