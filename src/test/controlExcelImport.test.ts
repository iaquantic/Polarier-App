import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { jornadaVacia, controlMesVacio, ParteData, parteVacio } from "@/lib/controlResumen";
import {
  fechaDeTexto,
  filaInventario,
  filasLavadoDeParte,
  filasProcesadoDeParte,
  FilaLavadoHoja,
  FilaProcesadoHoja,
  horaDeTexto,
  numeroDeTexto,
  PRENDAS_HOJA,
  repartirUbicaciones,
  tandasDeFilas,
  valesDeFilas,
} from "@/lib/controlHojas";
import { leerFecha, leerHora, leerModeloMensual } from "@/lib/controlExcel";
import { abrirXlsx } from "@/lib/xlsxLectura";
import { EstadoImportacion, huella, planificarImportacion } from "@/lib/controlImportacion";
import { Celdas, lavadoExcel, libroBase, lector } from "./fixtures/libroModelo";

const PRENDAS = PRENDAS_HOJA.map((nombre, i) => ({ id: `p${i}`, nombre }));
const UBICACIONES = [
  { id: "u-piso", nombre: "Piso 24" },
  { id: "u-spa", nombre: "Spa-1" },
];

const estadoBase = (cambios: Partial<EstadoImportacion> = {}): EstadoImportacion => ({
  anio: 2026,
  mes: 11,
  hotel: "Hotel de Prueba",
  partes: {},
  control: controlMesVacio(),
  eventos: [],
  prendas: PRENDAS,
  ubicaciones: UBICACIONES,
  pactadas: {},
  metas: {},
  mesValidado: false,
  ...cambios,
});

const parteCon = (cambios: Partial<ParteData>): ParteData => ({ ...parteVacio(), ...cambios });

describe("lectura de lo escrito", () => {
  it("entiende las fechas de la hoja y rechaza las imposibles", () => {
    expect(fechaDeTexto("02/11/2026")).toBe("2026-11-02");
    expect(fechaDeTexto("2/11/26")).toBe("2026-11-02");
    expect(fechaDeTexto("2/11", 2026)).toBe("2026-11-02");
    expect(fechaDeTexto("31/11/2026")).toBeNull();
    expect(fechaDeTexto("hoy")).toBeNull();
  });

  it("entiende las horas", () => {
    expect(horaDeTexto("8:10")).toBe("08:10");
    expect(horaDeTexto("23:30:00")).toBe("23:30");
    expect(horaDeTexto("25:00")).toBeNull();
  });

  it("distingue coma decimal, puntos de miles y texto que no es número", () => {
    expect(numeroDeTexto("1,50")).toBe(1.5);
    expect(numeroDeTexto("1.50")).toBe(1.5);
    expect(numeroDeTexto("1.500")).toBe(1500);
    expect(numeroDeTexto("1.500,25")).toBe(1500.25);
    expect(numeroDeTexto("1,500.25")).toBe(1500.25);
    expect(numeroDeTexto("")).toBeNull();
    expect(numeroDeTexto("abc")).toBeUndefined();
    expect(numeroDeTexto("1:30", true)).toBe(1.5);
  });

  it("lee fechas y horas de Excel sin correrlas de día", () => {
    expect(leerFecha(new Date(Date.UTC(2026, 10, 2)))).toBe("2026-11-02");
    expect(leerFecha(46328)).toBe("2026-11-02");
    expect(leerFecha("02/11/2026")).toBe("2026-11-02");
    expect(leerHora(new Date(Date.UTC(1899, 11, 30, 8, 10)))).toBe("08:10");
    expect(leerHora(8 / 24 + 10 / 1440)).toBe("08:10");
    expect(leerHora("8:10")).toBe("08:10");
  });
});

describe("filas de hoja y parte del día", () => {
  const fila = (cambios: Partial<FilaLavadoHoja>): FilaLavadoHoja => ({
    id: Math.random().toString(36),
    dueno: null,
    fecha: "2026-11-02",
    turno: "Día",
    vale: "V1",
    prenda: "Sábana personal",
    recibidas: 10,
    pendiente_inicial: 0,
    lavadas: 10,
    kg: 5,
    operario: "A",
    equipo: "L1",
    observaciones: "",
    ...cambios,
  });

  it("un vale puede cambiar de operario entre prendas sin perder ninguna fila", () => {
    const filas = [
      fila({ prenda: "Sábana personal" }),
      fila({ prenda: "Funda de almohada" }),
      fila({ prenda: "Toalla de baño", operario: "B" }),
      fila({ prenda: "Toalla de mano" }),
    ];
    const parte = parteCon({ lavado: valesDeFilas(filas) });
    expect(parte.lavado).toHaveLength(3);
    expect(filasLavadoDeParte("2026-11-02", parte, null)).toEqual(filas);
  });

  it("procesado conserva horas y personal de cada fila", () => {
    const base: FilaProcesadoHoja = {
      id: "a",
      dueno: null,
      fecha: "2026-11-02",
      turno: "Día",
      area: "Secado",
      equipo: "S1",
      operarios: "D",
      jefe_turno: "J",
      vale: "V1",
      prenda: "Funda de almohada",
      declaradas: 10,
      hora_inicio: "08:10",
      hora_fin: "09:40",
      conforme: 10,
      m_rosa: 0,
      m_negra: 0,
      m_oxido: 0,
      m_otras: 0,
      roturas: 0,
      pendientes: 0,
      observaciones: "",
    };
    const filas = [base, { ...base, id: "b", hora_fin: "10:00" }];
    const parte = parteCon({ procesado: tandasDeFilas(filas) });
    expect(parte.procesado).toHaveLength(2);
    expect(filasProcesadoDeParte("2026-11-02", parte, null)).toEqual(filas);
  });

  it("no guarda una fila con solo la fecha", () => {
    expect(valesDeFilas([fila({ turno: "", vale: "", prenda: "", recibidas: null, pendiente_inicial: null, lavadas: null, kg: null, operario: "", equipo: "" })])).toEqual([]);
  });

  it("reparte las ubicaciones fijas de la hoja y deja las demás para las filas libres", () => {
    const { fijas, libres } = repartirUbicaciones(
      [{ nombre: "Innova" }, { nombre: "Spa-1" }, { nombre: "Piso 24" }],
      ["Piso 24", "Spa 1"]
    );
    expect(fijas.map((u) => u.nombre)).toEqual(["Piso 24", "Spa-1"]);
    expect(libres.map((u) => u.nombre)).toEqual(["Innova"]);
    expect(repartirUbicaciones([{ nombre: "A" }], undefined).fijas).toHaveLength(1);
  });
});

describe("leerModeloMensual", () => {
  it("rechaza un archivo que no es el modelo", () => {
    const libro = leerModeloMensual({ hojas: ["Hoja1"], celda: () => null });
    expect(libro.errores[0]).toMatch(/no es el Modelo Mensual/);
  });

  it("rechaza columnas cambiadas y dice cuál falta", () => {
    const c = libroBase();
    delete c.Lavado_detalle.H10;
    expect(leerModeloMensual(lector(c)).errores[0]).toContain("Kg lavados");
  });

  it("lee cada fila con lo suyo e ignora lo calculado", () => {
    const c = libroBase();
    lavadoExcel(c, 11, [new Date(Date.UTC(2026, 10, 2)), "Día", 1024, "Toalla de baño", 140, 12, 152, 92.7, "Op A", "Lav 1", "Nota"]);
    c.Lavado_detalle.I11 = 999;
    c.Lavado_detalle.M11 = "Completo";
    const libro = leerModeloMensual(lector(c));
    expect(libro.errores).toEqual([]);
    expect(libro.lavado).toHaveLength(1);
    expect(libro.lavado[0].valor).toMatchObject({ fecha: "2026-11-02", vale: "1024", kg: 92.7, operario: "Op A", observaciones: "Nota" });
    expect(libro.lavado[0].valor).not.toHaveProperty("pendiente_final");
  });

  it("una fila solo con fórmulas no cuenta como fila", () => {
    const c = libroBase();
    c.Lavado_detalle.M12 = "";
    c.Incidencias.K11 = "No";
    const libro = leerModeloMensual(lector(c));
    expect(libro.lavado).toEqual([]);
    expect(libro.incidencias).toEqual([]);
  });

  it("lista las filas sin fecha o de otro mes en vez de perderlas en silencio", () => {
    const c = libroBase();
    lavadoExcel(c, 11, ["01/12/2026", "Día", "V1", "Toalla de baño", 1, 0, 1, 1]);
    lavadoExcel(c, 12, [undefined, "Día", "V2", "Toalla de baño", 1, 0, 1, 1]);
    const libro = leerModeloMensual(lector(c));
    expect(libro.lavado).toEqual([]);
    expect(libro.noEntran.map((p) => p.fila)).toEqual([11, 12]);
    expect(libro.noEntran[0].texto).toContain("01/12/2026");
    expect(libro.noEntran[1].texto).toContain("No tiene fecha");
  });

  it("avisa de lo que no entiende sin inventarse un número", () => {
    const c = libroBase();
    lavadoExcel(c, 11, ["02/11/2026", "Día", "V1", "Toalla de baño", "muchas", 0, 1, 1]);
    const libro = leerModeloMensual(lector(c));
    expect(libro.lavado[0].valor.recibidas).toBeNull();
    expect(libro.avisos[0]).toMatchObject({ hoja: "Lavado_detalle", fila: 11 });
    expect(libro.avisos[0].texto).toContain("muchas");
  });

  it("toma la fecha de Operacion e Inventario por su posición, porque A es una fórmula", () => {
    const c = libroBase();
    c.Operacion.B12 = 612;
    c.Operacion.J12 = "Cerrado";
    const fila = filaInventario(3, 0);
    c.Inventario[`B${fila}`] = "Piso 24";
    c.Inventario[`C${fila}`] = 10;
    const libro = leerModeloMensual(lector(c));
    expect(libro.jornadas[0].valor).toEqual({ fecha: "2026-11-02", turistas: 612, cierre: "Cerrado" });
    expect(libro.conteos[0]).toMatchObject({ fecha: "2026-11-03", ubicacion: "Piso 24", valores: { "Sábana personal": 10 } });
  });

  it("el día 31 de un mes de 30 no entra", () => {
    const c = libroBase();
    c.Operacion.B41 = 1;
    const fila = filaInventario(31, 0);
    c.Inventario[`B${fila}`] = "Piso 24";
    c.Inventario[`C${fila}`] = 1;
    const libro = leerModeloMensual(lector(c));
    expect(libro.jornadas).toEqual([]);
    expect(libro.conteos).toEqual([]);
    expect(libro.noEntran).toHaveLength(2);
  });

  it("no elige entre dos conteos del mismo sitio el mismo día", () => {
    const c = libroBase();
    const [a, b] = [filaInventario(5, 0), filaInventario(5, 1)];
    c.Inventario[`B${a}`] = "Piso 25";
    c.Inventario[`C${a}`] = 10;
    c.Inventario[`B${b}`] = "piso 25";
    c.Inventario[`C${b}`] = 11;
    const libro = leerModeloMensual(lector(c));
    expect(libro.conteos).toEqual([]);
    expect(libro.noEntran[0].texto).toContain(`Filas ${a} y ${b}`);
  });

  it("un conteo sin ubicación no entra", () => {
    const c = libroBase();
    c.Inventario[`C${filaInventario(1, 12)}`] = 3;
    const libro = leerModeloMensual(lector(c));
    expect(libro.conteos).toEqual([]);
    expect(libro.noEntran[0].texto).toContain("falta la ubicación");
  });

  it("lee KPI con base y también el Excel antiguo sin ella", () => {
    const con = libroBase();
    con.KPI_calidad.B11 = 28;
    con.KPI_calidad.C11 = 30;
    con.KPI_calidad.D11 = 0.55;
    con.KPI_calidad.G11 = "Doc";
    const a = leerModeloMensual(lector(con));
    expect(a.kpiConBase).toBe(true);
    expect(a.kpis.ciclo).toEqual({ cantidad: 28, base: 30, documento: "Doc" });
    expect(a.metas.ciclo).toBe(0.55);

    const sin = libroBase({ sinBase: true });
    sin.KPI_calidad.B11 = 28;
    sin.KPI_calidad.C11 = 0.55;
    sin.KPI_calidad.F11 = "Doc";
    const b = leerModeloMensual(lector(sin));
    expect(b.errores).toEqual([]);
    expect(b.kpiConBase).toBe(false);
    expect(b.kpis.ciclo).toEqual({ cantidad: 28, documento: "Doc" });
    expect(b.metas.ciclo).toBe(0.55);
  });

  it("lee las celdas combinadas de Datos_mes y las novedades", () => {
    const c = libroBase();
    c.Datos_mes.B12 = "Representante A";
    c.Datos_mes.B14 = new Date(Date.UTC(2026, 10, 30));
    c.Datos_mes.B19 = 18;
    c.Datos_mes.A22 = "Logros";
    c.Incidencias.A11 = "02/11/2026";
    c.Incidencias.B11 = "Agua";
    c.Equipos.A38 = "Correas";
    c.Equipos.C38 = "Correctivo";
    c.Equipos.E38 = "03/11/2026";
    const libro = leerModeloMensual(lector(c));
    expect(libro.datos).toEqual({ representante: "Representante A", fecha_elaboracion: "2026-11-30", personal: 18 });
    expect(libro.sintesis).toEqual({ logros: "Logros" });
    expect(libro.incidencias[0]).toMatchObject({ fecha: "2026-11-02", data: { causa: "Agua" } });
    expect(libro.incidencias[0].data).not.toHaveProperty("fecha");
    // Un correctivo sin planificar va por la fecha de ejecución.
    expect(libro.mantenimiento[0].fecha).toBe("2026-11-03");
  });
});

describe("planificarImportacion", () => {
  const conLavado = (fila: number, fecha: string, vale: string) => {
    const c = libroBase();
    lavadoExcel(c, fila, [fecha, "Día", vale, "Toalla de baño", 10, 0, 10, 5, "Op", "Eq"]);
    return c;
  };

  it("bloquea otro mes y ofrece ir a él", () => {
    const c = libroBase();
    c.Datos_mes.B7 = 10;
    const plan = planificarImportacion(leerModeloMensual(lector(c)), estadoBase());
    expect(plan.bloqueos[0].irAMes).toEqual({ anio: 2026, mes: 10 });
  });

  it("bloquea un mes validado", () => {
    const plan = planificarImportacion(leerModeloMensual(lector(libroBase())), estadoBase({ mesValidado: true }));
    expect(plan.bloqueos[0].texto).toContain("validado");
  });

  it("acepta otra forma de escribir el hotel y pide confirmar si parece otro", () => {
    const c = libroBase();
    c.Datos_mes.B9 = "Gran Muthu La Habana";
    expect(planificarImportacion(leerModeloMensual(lector(c)), estadoBase({ hotel: "Gran Muthu Habana" })).hotelDistinto).toBeNull();
    expect(planificarImportacion(leerModeloMensual(lector(c)), estadoBase({ hotel: "Otro Hotel" })).hotelDistinto).toBe("Gran Muthu La Habana");
  });

  it("no cambia nada hasta que se aplique y conserva los días que el Excel no trae", () => {
    const parte3 = parteCon({
      lavado: [{ id: "v", vale: "APP", turno: "Día", operario: "", equipo: "", lineas: [{ id: "l", prenda: "Toalla de baño", recibidas: 1, pendiente_inicial: 0, lavadas: 1, kg: 1, observaciones: "" }] }],
    });
    const estado = estadoBase({ partes: { "2026-11-03": parte3 } });
    const copia = JSON.stringify(estado);
    const plan = planificarImportacion(leerModeloMensual(lector(conLavado(11, "02/11/2026", "V1"))), estado);
    expect(JSON.stringify(estado)).toBe(copia);
    expect(plan.partes.map((p) => p.fecha)).toEqual(["2026-11-02"]);
    expect(plan.cifras.diasConservados).toBe(1);
    expect(plan.hojas.find((h) => h.hoja === "Lavado_detalle")).toMatchObject({ nuevas: 1, soloApp: 1 });
  });

  it("sustituye un día que el Excel trae y lo avisa", () => {
    const parte = parteCon({
      lavado: [{ id: "v", vale: "APP", turno: "Día", operario: "", equipo: "", lineas: [
        { id: "a", prenda: "Toalla de baño", recibidas: 1, pendiente_inicial: 0, lavadas: 1, kg: 1, observaciones: "" },
        { id: "b", prenda: "Toalla de mano", recibidas: 1, pendiente_inicial: 0, lavadas: 1, kg: 1, observaciones: "" },
      ] }],
    });
    const plan = planificarImportacion(
      leerModeloMensual(lector(conLavado(11, "02/11/2026", "V1"))),
      estadoBase({ partes: { "2026-11-02": parte } })
    );
    expect(plan.dias[0]).toMatchObject({ fecha: "2026-11-02", hoja: "Lavado_detalle" });
    expect(plan.dias[0].texto).toBe("En la app 2 filas, en el Excel 1.");
    expect(plan.partes[0].parte.lavado[0].vale).toBe("V1");
  });

  it("lo vacío no borra: jornada y conteos se mezclan casilla a casilla", () => {
    const parte = parteCon({
      jornada: { ...jornadaVacia(), turistas: 600, entregadas: 100, observacion: "De la app" },
      inventario: { conteos: { "u-piso": { p0: 5, p1: 6 } }, observaciones: {}, extra: [] },
    });
    const c = libroBase();
    c.Operacion.B12 = 650;
    const fila = filaInventario(2, 0);
    c.Inventario[`B${fila}`] = "Piso 24";
    c.Inventario[`C${fila}`] = 9;
    const plan = planificarImportacion(leerModeloMensual(lector(c)), estadoBase({ partes: { "2026-11-02": parte } }));
    const p = plan.partes[0].parte;
    expect(p.jornada).toMatchObject({ turistas: 650, entregadas: 100, observacion: "De la app" });
    expect(p.inventario.conteos["u-piso"]).toEqual({ p0: 9, p1: 6 });
  });

  it("casa los nombres de ubicación aunque cambie la forma de escribirlos y guarda aparte los desconocidos", () => {
    const c = libroBase();
    const [a, b] = [filaInventario(1, 0), filaInventario(1, 1)];
    c.Inventario[`B${a}`] = "Spa 1";
    c.Inventario[`C${a}`] = 1;
    c.Inventario[`B${b}`] = "Azotea";
    c.Inventario[`C${b}`] = 2;
    const plan = planificarImportacion(leerModeloMensual(lector(c)), estadoBase());
    const inv = plan.partes[0].parte.inventario;
    expect(inv.conteos["u-spa"]).toEqual({ p0: 1 });
    expect(inv.extra[0].nombre).toBe("Azotea");
    expect(inv.conteos[inv.extra[0].id]).toEqual({ p0: 2 });
    expect(plan.avisos.some((x) => x.texto.includes("Azotea"))).toBe(true);
  });

  it("subir dos veces el mismo archivo no cambia nada", () => {
    const c = conLavado(11, "02/11/2026", "V1");
    c.Operacion.B12 = 650;
    c.Datos_mes.B12 = "Rep";
    c.Incidencias.A11 = "02/11/2026";
    c.Incidencias.B11 = "Agua";
    c.Equipos.A11 = "Lavadoras";
    c.Equipos.B11 = 4;
    const libro = leerModeloMensual(lector(c));
    const primera = planificarImportacion(libro, estadoBase());
    expect(primera.sinCambios).toBe(false);
    const estado = estadoBase({
      partes: Object.fromEntries(primera.partes.map((p) => [p.fecha, p.parte])),
      control: primera.control,
      eventos: primera.eventos.crear.map((e, i) => ({ id: `e${i}`, ...e })),
    });
    const segunda = planificarImportacion(libro, estado);
    expect(segunda.sinCambios).toBe(true);
    expect(segunda.eventos).toEqual({ crear: [], borrar: [] });
  });

  it("las novedades del mes se sustituyen solo si la hoja trae filas", () => {
    const actual = { id: "viejo", tipo: "incidencia" as const, fecha: "2026-11-01", data: { causa: "Gas" } };
    const vacio = planificarImportacion(leerModeloMensual(lector(libroBase())), estadoBase({ eventos: [actual] }));
    expect(vacio.eventos).toEqual({ crear: [], borrar: [] });
    expect(vacio.hojas.find((h) => h.hoja === "Incidencias").soloApp).toBe(1);

    const c = libroBase();
    c.Incidencias.A11 = "02/11/2026";
    c.Incidencias.B11 = "Agua";
    const plan = planificarImportacion(leerModeloMensual(lector(c)), estadoBase({ eventos: [actual] }));
    expect(plan.eventos.borrar).toEqual(["viejo"]);
    expect(plan.eventos.crear[0]).toMatchObject({ tipo: "incidencia", fecha: "2026-11-02" });
  });

  it("no toca la dotación ni las metas: solo avisa", () => {
    const c = libroBase();
    c.Inventario.A483 = "Sábana personal";
    c.Inventario.B483 = 520;
    c.KPI_calidad.D11 = 0.65;
    const plan = planificarImportacion(
      leerModeloMensual(lector(c)),
      estadoBase({ pactadas: { p0: 515 }, metas: { ciclo: 0.55 } })
    );
    expect(plan.avisos.some((a) => a.texto.includes("520") && a.texto.includes("515"))).toBe(true);
    expect(plan.avisos.some((a) => a.texto.includes("Tiempo de ciclo"))).toBe(true);
    expect(plan.control).toBeNull();
  });

  it("avisa si un Excel antiguo no trae la base", () => {
    const plan = planificarImportacion(leerModeloMensual(lector(libroBase({ sinBase: true }))), estadoBase());
    expect(plan.avisos.some((a) => a.texto.includes("columna Base"))).toBe(true);
  });

  it("no confunde datos iguales con cambios aunque falten claves vacías", () => {
    expect(huella({ a: 1, b: "", c: null, id: "x" })).toBe(huella({ a: 1 }));
  });
});

// Contra el Excel real, que no está en el repositorio (es público). Para ejecutarlo:
// MODELO_MENSUAL_XLSX="ruta/al/Modelo Mensual.xlsx" bunx vitest run src/test/controlExcelImport.test.ts
const REAL = process.env.MODELO_MENSUAL_XLSX;
describe.skipIf(!REAL || !existsSync(REAL))("el Modelo Mensual real", () => {
  it("reconoce todas sus hojas y columnas", async () => {
    const libro = leerModeloMensual(abrirXlsx(new Uint8Array(readFileSync(REAL))));
    expect(libro.errores).toEqual([]);
    expect(libro.mes).toBeGreaterThan(0);
  }, 60000);
});
