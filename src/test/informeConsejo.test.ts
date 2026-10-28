import { describe, expect, it } from "vitest";
import {
  aniosDisponibles,
  construirMeses,
  construirTrimestres,
  estadoMes,
  estaAtascado,
  mesesVisibles,
  nombreArchivoInforme,
  puedeDescargar,
  puedeGenerar,
  type FilaDisponibilidad,
  type InformeConsejo,
} from "@/lib/informeConsejo";

const HOY = new Date("2026-07-15T10:00:00Z");

const fila = (mes: number, p: Partial<FilaDisponibilidad>): FilaDisponibilidad => ({
  mes,
  grupo: "global",
  orden: 1,
  requisito: "GLOBAL · mes cargado",
  polo: "La Habana",
  estado: "ok",
  detalle: null,
  ...p,
});

const informe = (mes: number, p: Partial<InformeConsejo> = {}): InformeConsejo => ({
  id: `inf-${mes}`,
  anio: 2026,
  mes,
  estado: "listo",
  solicitado_por: "u1",
  solicitado_at: "2026-07-01T09:00:00Z",
  generado_at: "2026-07-01T09:12:00Z",
  archivo_path: `2026/0${mes}/consejo.docx`,
  archivo_nombre: "consejo.docx",
  error: null,
  ...p,
});

describe("meses y años que se enseñan", () => {
  it("del año en curso, hasta el mes actual y el más reciente primero", () => {
    expect(mesesVisibles(2026, HOY)).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });

  it("de un año pasado, los doce; de uno futuro, ninguno", () => {
    expect(mesesVisibles(2025, HOY)).toHaveLength(12);
    expect(mesesVisibles(2027, HOY)).toEqual([]);
  });

  it("los años van del actual al primero con datos", () => {
    expect(aniosDisponibles(HOY)).toEqual([2026, 2025]);
  });
});

describe("construirMeses", () => {
  const filas: FilaDisponibilidad[] = [
    fila(6, { polo: "La Habana" }),
    fila(6, { polo: "Varadero" }),
    fila(6, { grupo: "tabla_ca", orden: 11, requisito: "TABLA CA · datos del CD del mes", polo: "La Habana", estado: "falta", detalle: "Falta: evaluación de calidad" }),
    fila(6, { grupo: "tabla_ca", orden: 12, requisito: "TABLA CA · datos del CD del mes", polo: "Varadero" }),
    fila(6, { grupo: "tecleado", orden: 100, requisito: "Cargos vacantes", polo: null, estado: "sin_comprobar", detalle: "Hoja «Datos económicos»" }),
    fila(5, { polo: "La Habana" }),
  ];

  it("agrupa por mes, grupo y requisito, con un item por polo", () => {
    const [junio] = construirMeses(2026, [6], filas, []);
    expect(junio.nombre).toBe("Junio");
    expect(junio.grupos.map((g) => g.grupo)).toEqual(["global", "tabla_ca", "tecleado"]);
    const cd = junio.grupos[1].requisitos[0];
    expect(cd.items.map((i) => i.polo)).toEqual(["La Habana", "Varadero"]);
    expect(cd.faltan).toBe(1);
  });

  it("lo tecleado no cuenta como dato que falta", () => {
    const [junio] = construirMeses(2026, [6], filas, []);
    expect(junio.faltan).toBe(1);
  });

  it("la lencería del CD va entre la TABLA CA y lo tecleado, y sus avisos no bloquean", () => {
    const conLenceria = [
      ...filas,
      fila(6, { grupo: "cd_lenceria", orden: 51, requisito: "CD · lencería del mes", polo: "La Habana", detalle: "Sin rellenar en el CD: rechazo" }),
      fila(6, { grupo: "cd_lenceria", orden: 53, requisito: "CD · lencería del mes", polo: "Caibarién", estado: "falta", detalle: "Falta cargar la lencería de su CD de ese mes" }),
    ];
    const [junio] = construirMeses(2026, [6], conLenceria, []);
    expect(junio.grupos.map((g) => g.grupo)).toEqual(["global", "tabla_ca", "cd_lenceria", "tecleado"]);
    expect(junio.grupos[2].titulo).toBe("Lencería del CD");
    expect(junio.grupos[2].faltan).toBe(1);
    expect(junio.faltan).toBe(2);
  });

  it("pone a cada mes su informe, si lo tiene", () => {
    const [junio, mayo] = construirMeses(2026, [6, 5], filas, [informe(5)]);
    expect(junio.informe).toBeNull();
    expect(mayo.informe?.id).toBe("inf-5");
  });
});

describe("qué se puede hacer con un mes", () => {
  const completo = (inf: InformeConsejo | null) => construirMeses(2026, [5], [fila(5, {})], inf ? [inf] : [])[0];

  it("si falta algo, no se genera", () => {
    const [mes] = construirMeses(2026, [6], [fila(6, { estado: "falta" })], []);
    expect(puedeGenerar(mes, HOY)).toBe(false);
    expect(estadoMes(mes, HOY)).toEqual({ texto: "Falta 1 dato", tono: "falta" });
  });

  it("si no falta nada, se genera", () => {
    const mes = completo(null);
    expect(puedeGenerar(mes, HOY)).toBe(true);
    expect(estadoMes(mes, HOY).texto).toBe("Listo para generar");
  });

  it("con informe, se descarga y se puede regenerar", () => {
    const mes = completo(informe(5));
    expect(puedeDescargar(mes)).toBe(true);
    expect(puedeGenerar(mes, HOY)).toBe(true);
    expect(estadoMes(mes, HOY).texto).toBe("Informe generado");
  });

  it("mientras se genera no se pide otro, salvo que lleve más de dos horas", () => {
    const reciente = completo(informe(5, { estado: "generando", solicitado_at: "2026-07-15T09:30:00Z", archivo_path: null }));
    expect(puedeGenerar(reciente, HOY)).toBe(false);
    expect(estadoMes(reciente, HOY).texto).toBe("Generando…");

    const viejo = completo(informe(5, { estado: "pendiente", solicitado_at: "2026-07-15T07:00:00Z", archivo_path: null }));
    expect(estaAtascado(viejo.informe, HOY)).toBe(true);
    expect(puedeGenerar(viejo, HOY)).toBe(true);
  });

  it("un intento fallido sin fichero anterior se marca como fallido", () => {
    const mes = completo(informe(5, { estado: "error", archivo_path: null, error: "n8n respondió 500" }));
    expect(estadoMes(mes, HOY)).toEqual({ texto: "Falló la generación", tono: "error" });
    expect(puedeGenerar(mes, HOY)).toBe(true);
  });
});

describe("trimestres", () => {
  const filas = [1, 2, 3, 4, 5, 6].map((m) => fila(m, m === 5 ? { estado: "falta" } : {}));
  const meses = construirMeses(2026, mesesVisibles(2026, HOY), filas, []);

  it("salen los que ya tienen su último mes en pantalla, el más reciente primero", () => {
    expect(construirTrimestres(2026, meses, []).map((t) => t.trimestre)).toEqual([2, 1]);
  });

  it("lo que falta en cualquiera de sus meses cuenta para el trimestre", () => {
    const [segundo, primero] = construirTrimestres(2026, meses, []);
    expect(segundo.faltan).toBe(1);
    expect(puedeGenerar(segundo, HOY)).toBe(false);
    expect(puedeGenerar(primero, HOY)).toBe(true);
  });

  it("el informe de un trimestre no se confunde con el de un mes", () => {
    const delTrimestre = informe(0, { id: "t1", mes: null, trimestre: 1 });
    const [, primero] = construirTrimestres(2026, meses, [delTrimestre, informe(3)]);
    expect(primero.informe?.id).toBe("t1");
    const [marzo] = construirMeses(2026, [3], filas, [delTrimestre, informe(3)]);
    expect(marzo.informe?.id).toBe("inf-3");
  });

  it("nombre del fichero por defecto", () => {
    expect(nombreArchivoInforme(informe(0, { mes: null, trimestre: 2, archivo_nombre: null })))
      .toBe("consejo_direccion_II_TRIMESTRE_2026.docx");
    expect(nombreArchivoInforme(informe(6, { archivo_nombre: null }))).toBe("consejo_direccion_JUNIO_2026.docx");
  });
});
