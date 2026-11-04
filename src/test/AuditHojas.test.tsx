import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuditHojas, { RedirigirCierre, RedirigirParte } from "@/pages/audit/AuditHojas";
import { HOJAS } from "@/lib/controlHojas";
import { lavadoExcel, lector, libroBase } from "./fixtures/libroModelo";

const DEF = {
  id: "def",
  hotel_id: "h1",
  tipo: "control",
  nombre: "Parte",
  schema_version: 1,
  config: { ubicaciones_hoja: ["Piso 24"] },
  activo: true,
};
const HOTEL = { id: "h1", nombre: "Hotel de prueba", polo: { nombre: "Polo" } };

const saveSubmission = vi.fn(async (_p: unknown) => ({}));
const saveControlMes = vi.fn(async (..._a: unknown[]) => undefined);
const saveResumenMes = vi.fn(async (..._a: unknown[]) => undefined);
const saveEvento = vi.fn(async (p: Record<string, unknown>) => ({ ...p, id: p.id ?? "ev-nuevo" }));
const toastError = vi.fn();
let partes: Record<string, unknown>[] = [];
let controlMes: Record<string, unknown> | null = null;

vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/context/RoleContext", () => ({ useRole: () => ({ hotels: [HOTEL], activeHotel: HOTEL, loading: false }) }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "yo" }, profile: {} }) }));
vi.mock("@/services/audit", () => ({
  getDefinicionControl: async () => DEF,
  getPrendas: async () => [
    { id: "p1", codigo: "SP", nombre: "Sábana personal", orden: 1 },
    { id: "p2", codigo: "TB", nombre: "Toalla de baño", orden: 2 },
  ],
  getUbicaciones: async () => [
    { id: "u1", nombre: "Piso 24", orden: 1 },
    { id: "u2", nombre: "Innova", orden: 2 },
  ],
  getDotacionLenceria: async () => ({ u1: { p1: 10, p2: 5 } }),
  getSubmissionsByMonth: async () => partes,
  getControlMes: async () => controlMes,
  getControlMesAnterior: async () => null,
  getEventosMes: async () => [],
  getEventosAbiertos: async () => [],
  getParteAnterior: async () => null,
  saveSubmission: (p: unknown) => saveSubmission(p),
  saveControlMes: (...a: unknown[]) => saveControlMes(...a),
  saveResumenMes: (...a: unknown[]) => saveResumenMes(...a),
  saveEvento: (p: Record<string, unknown>) => saveEvento(p),
  deleteEvento: vi.fn(),
  solicitarInformeMensual: vi.fn(),
}));

const leerArchivoExcel = vi.fn();
const aplicarImportacion = vi.fn(async (_p: unknown) => ({ archivoPath: "h1/ruta.xlsx" }));
vi.mock("@/services/auditImportacion", () => ({
  leerArchivoExcel: (f: File) => leerArchivoExcel(f),
  aplicarImportacion: (p: unknown) => aplicarImportacion(p),
  getUltimaImportacion: async () => null,
  descargarOriginal: vi.fn(),
}));

const parte = (fecha: string, user_id: string, data: Record<string, unknown> = {}) => ({
  id: `s-${fecha}-${user_id}`,
  user_id,
  hotel_id: "h1",
  form_definition_id: "def",
  fecha,
  estado: "borrador",
  data,
  totales: {},
  updated_at: "2026-11-01T00:00:00Z",
});

const vale = (id: string, vale: string, operario: string, prenda = "Toalla de baño") => ({
  id: `v-${id}`,
  vale,
  turno: "Día",
  operario,
  equipo: "L1",
  lineas: [{ id, prenda, recibidas: 10, pendiente_inicial: 0, lavadas: 10, kg: 5, observaciones: "" }],
});

const Ruta = () => {
  const l = useLocation();
  return <span data-testid="ruta">{l.pathname + l.search}</span>;
};

const abrir = async (url = "/auditoria/formularios?mes=2026-11&hoja=Lavado_detalle") => {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/auditoria/formularios" element={<><AuditHojas /><Ruta /></>} />
        <Route path="/auditoria/formularios/parte" element={<RedirigirParte />} />
        <Route path="/auditoria/formularios/cierre" element={<RedirigirCierre />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByRole("tablist", { name: "Hojas del libro" });
};

const casilla = (titulo: string, fila: number) => screen.getByLabelText(`${titulo}, fila ${fila}`) as HTMLInputElement;
const escribir = (titulo: string, fila: number, valor: string) => {
  const c = casilla(titulo, fila);
  fireEvent.focus(c);
  fireEvent.change(c, { target: { value: valor } });
  fireEvent.blur(c);
};
const esperarGuardado = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });
};
const guardados = () => saveSubmission.mock.calls.map(([p]) => p as { fecha: string; estado: string; data: { lavado: { vale: string; operario: string; lineas: unknown[] }[]; procesado: unknown[]; jornada: { cierre: string; turistas: number | null }; inventario: { conteos: Record<string, Record<string, number>>; extra: unknown[] } } });

describe("AuditHojas", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"], shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-11-04T12:00:00"));
    partes = [];
    controlMes = null;
    saveSubmission.mockClear();
    saveControlMes.mockClear();
    saveResumenMes.mockClear();
    saveEvento.mockClear();
    toastError.mockClear();
    leerArchivoExcel.mockReset();
    aplicarImportacion.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("enseña las once hojas con sus nombres y en el orden del Excel", async () => {
    await abrir();
    const pestanas = within(screen.getByRole("tablist")).getAllByRole("tab").map((t) => t.textContent);
    expect(pestanas).toEqual([...HOJAS]);
    expect(HOJAS).toHaveLength(11);
  });

  it("cada hoja tiene las columnas del Excel, con su letra y en su orden", async () => {
    await abrir();
    const titulos = screen.getAllByRole("columnheader").map((c) => c.textContent).filter(Boolean);
    expect(titulos).toEqual([
      "Fecha", "Turno", "Vale", "Prenda", "Recibidas según DJ (pzs)", "Pendiente inicial (pzs)", "Lavadas (pzs)",
      "Kg lavados", "Pendiente final (pzs)", "Operario", "Equipo", "Observaciones", "Revisión del registro",
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "Procesado_detalle" }));
    expect(screen.getAllByRole("columnheader").map((c) => c.textContent).filter(Boolean)).toHaveLength(23);
  });

  it("no guarda nada solo por abrir el mes", async () => {
    await abrir();
    await esperarGuardado();
    expect(saveSubmission).not.toHaveBeenCalled();
    expect(saveControlMes).not.toHaveBeenCalled();
  });

  it("al escribir en una fila libre le pone fecha y la guarda en el parte de ese día", async () => {
    await abrir();
    escribir("Vale", 11, "V1");
    expect(casilla("Fecha", 11).value).toBe("04/11/2026");
    // No pierde la fila al convertirse en real.
    expect(casilla("Vale", 11).value).toBe("V1");
    await esperarGuardado();
    const [g] = guardados();
    expect(g.fecha).toBe("2026-11-04");
    expect(g.data.lavado[0].vale).toBe("V1");
  });

  it("cada fila conserva su operario aunque sea del mismo vale", async () => {
    partes = [parte("2026-11-02", "yo", { lavado: [vale("a", "V1", "Ana"), vale("b", "V1", "Bea", "Sábana personal")] })];
    await abrir();
    expect(casilla("Operario", 11).value).toBe("Ana");
    expect(casilla("Operario", 12).value).toBe("Bea");
    escribir("Observaciones", 12, "Nota");
    await esperarGuardado();
    const [g] = guardados();
    expect(g.data.lavado.map((v) => v.operario)).toEqual(["Ana", "Bea"]);
  });

  it("calcula lo azul como la hoja y distingue vacío de 0", async () => {
    await abrir();
    escribir("Recibidas según DJ (pzs)", 11, "10");
    escribir("Pendiente inicial (pzs)", 11, "0");
    escribir("Lavadas (pzs)", 11, "12");
    const fila = casilla("Vale", 11).closest('[role="row"]') as HTMLElement;
    const calculadas = within(fila).getAllByRole("cell").map((c) => c.textContent);
    // Lavó más de lo recibido, y aún falta el resto de la fila.
    expect(calculadas).toEqual(["-2", "Completar"]);
    expect(casilla("Pendiente inicial (pzs)", 11).value).toBe("0");
    expect(casilla("Kg lavados", 11).value).toBe("");
  });

  it("rechaza una fecha de otro mes o vacía: la fila se guarda en su día", async () => {
    partes = [parte("2026-11-02", "yo", { lavado: [vale("a", "V1", "Ana")] })];
    await abrir();
    escribir("Fecha", 11, "01/12/2026");
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("noviembre"));
    expect(casilla("Fecha", 11).value).toBe("02/11/2026");
    escribir("Fecha", 11, "");
    expect(toastError).toHaveBeenLastCalledWith(expect.stringContaining("no puede quedar vacía"));
    escribir("Fecha", 11, "mañana");
    expect(toastError).toHaveBeenLastCalledWith(expect.stringContaining("no es una fecha"));
    await esperarGuardado();
    expect(saveSubmission).not.toHaveBeenCalled();
  });

  it("mover una fila de día guarda los dos días", async () => {
    partes = [parte("2026-11-02", "yo", { lavado: [vale("a", "V1", "Ana")] })];
    await abrir();
    escribir("Fecha", 11, "03/11/2026");
    await esperarGuardado();
    const porFecha = Object.fromEntries(guardados().map((g) => [g.fecha, g.data.lavado.length]));
    expect(porFecha).toEqual({ "2026-11-02": 0, "2026-11-03": 1 });
  });

  it("pega un bloque copiado del Excel, saltando las columnas calculadas", async () => {
    await abrir();
    const c = casilla("Fecha", 11);
    fireEvent.paste(c, {
      clipboardData: {
        getData: () =>
          "02/11/2026\tDía\tV1\tToalla de baño\t10\t0\t10\t5,5\t0\tAna\tL1\tNota\tCompleto\n03/11/2026\tNoche\tV2\tSábana personal\t1\t0\t1\t2\t0\tBea\tL2\t\tCompleto\n",
      },
    });
    expect(casilla("Vale", 12).value).toBe("V2");
    await esperarGuardado();
    const porFecha = Object.fromEntries(guardados().map((g) => [g.fecha, g.data.lavado]));
    expect(porFecha["2026-11-02"][0]).toMatchObject({ vale: "V1", operario: "Ana", lineas: [{ kg: 5.5, observaciones: "Nota" }] });
    expect(porFecha["2026-11-03"][0]).toMatchObject({ vale: "V2", turno: "Noche" });
  });

  it("borrar una fila la quita de su día", async () => {
    partes = [parte("2026-11-02", "yo", { lavado: [vale("a", "V1", "Ana"), vale("b", "V2", "Bea")] })];
    await abrir();
    fireEvent.focus(casilla("Vale", 11));
    fireEvent.click(screen.getByRole("button", { name: "Borrar la fila elegida" }));
    await esperarGuardado();
    expect(guardados()[0].data.lavado.map((v) => v.vale)).toEqual(["V2"]);
  });

  it("Todo conforme escribe los ceros de la fila elegida", async () => {
    await abrir("/auditoria/formularios?mes=2026-11&hoja=Procesado_detalle");
    escribir("Declaradas a la etapa (pzs)", 11, "40");
    fireEvent.focus(casilla("Declaradas a la etapa (pzs)", 11));
    fireEvent.click(screen.getByRole("button", { name: "Todo conforme en la fila elegida" }));
    expect(casilla("Producción conforme (pzs)", 11).value).toBe("40");
    expect(casilla("Roturas (pzs)", 11).value).toBe("0");
  });

  it("cerrar un día en Operacion lo cuenta en el mes y actualiza el resumen", async () => {
    partes = [parte("2026-11-02", "yo", { lavado: [vale("a", "V1", "Ana")] })];
    await abrir("/auditoria/formularios?mes=2026-11&hoja=Operacion");
    fireEvent.change(casilla("Cierre de lavado", 12), { target: { value: "Cerrado" } });
    await esperarGuardado();
    const g = guardados().find((x) => x.fecha === "2026-11-02");
    expect(g.estado).toBe("completado");
    expect(g.data.lavado).toHaveLength(1);
    expect(saveResumenMes).toHaveBeenCalled();
    const fila = casilla("Cierre de lavado", 12).closest('[role="row"]') as HTMLElement;
    expect(within(fila).getAllByRole("cell").map((c) => c.textContent)).toContain("5");
  });

  it("un día sin tocar no aparece como cerrado ni pendiente", async () => {
    await abrir("/auditoria/formularios?mes=2026-11&hoja=Operacion");
    expect(casilla("Cierre de lavado", 11).value).toBe("");
  });

  it("los partes de otra persona se ven sin poder tocarlos, y no se puede subir un Excel", async () => {
    partes = [parte("2026-11-02", "otro", { lavado: [vale("a", "V1", "Ana")], jornada: { turistas: 600, cierre: "Pendiente" } })];
    await abrir();
    expect(casilla("Vale", 11).value).toBe("V1");
    expect(casilla("Vale", 11)).toBeDisabled();
    expect(screen.getByRole("button", { name: /Subir Excel/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "Operacion" }));
    expect(casilla("Turistas del día", 12).value).toBe("600");
    expect(casilla("Turistas del día", 12)).toBeDisabled();
    expect(casilla("Turistas del día", 13)).not.toBeDisabled();
  });

  it("un mes validado no deja tocar los días, pero sí reabrirlo", async () => {
    controlMes = { data: { revision: { operacion: "Validado" } }, resumen: {} };
    await abrir("/auditoria/formularios?mes=2026-11&hoja=Operacion");
    expect(casilla("Turistas del día", 11)).toBeDisabled();
    expect(screen.getByRole("button", { name: /Subir Excel/ })).toBeDisabled();
    const revision = screen.getByLabelText("Revisión del mes, fila 7") as HTMLSelectElement;
    fireEvent.change(revision, { target: { value: "Pendiente" } });
    expect(casilla("Turistas del día", 11)).not.toBeDisabled();
  });

  it("una incidencia nueva se inserta una vez y después se actualiza", async () => {
    await abrir("/auditoria/formularios?mes=2026-11&hoja=Incidencias");
    fireEvent.change(casilla("Causa", 11), { target: { value: "Agua" } });
    await esperarGuardado();
    expect(saveEvento).toHaveBeenCalledTimes(1);
    expect(saveEvento.mock.calls[0][0]).toMatchObject({ id: undefined, tipo: "incidencia", fecha: "2026-11-04", data: { causa: "Agua" } });
    escribir("Responsable", 11, "Ana");
    await esperarGuardado();
    expect(saveEvento).toHaveBeenCalledTimes(2);
    expect(saveEvento.mock.calls[1][0]).toMatchObject({ id: "ev-nuevo" });
  });

  it("KPI_calidad tiene la columna Base y calcula el resultado", async () => {
    await abrir("/auditoria/formularios?mes=2026-11&hoja=KPI_calidad");
    expect(screen.getAllByRole("columnheader").map((c) => c.textContent)).toContain("Base");
    escribir("Cantidad que se cumple", 11, "3");
    escribir("Base", 11, "4");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    const fila = casilla("Base", 11).closest('[role="row"]') as HTMLElement;
    expect(within(fila).getAllByRole("cell").map((c) => c.textContent)).toContain("75 %");
    await esperarGuardado();
    expect(saveControlMes).toHaveBeenCalled();
  });

  it("pegar varias casillas en KPI_calidad no pierde ninguna", async () => {
    await abrir("/auditoria/formularios?mes=2026-11&hoja=KPI_calidad");
    fireEvent.paste(casilla("Cantidad que se cumple", 11), { clipboardData: { getData: () => "28\t30\n23\t30\n" } });
    await esperarGuardado();
    const documento = saveControlMes.mock.calls[0][3] as { kpis: Record<string, { cantidad: number; base: number }> };
    expect(documento.kpis.ciclo).toMatchObject({ cantidad: 28, base: 30 });
    expect(documento.kpis.disponibilidad_lenceria).toMatchObject({ cantidad: 23, base: 30 });
  });

  it("Inventario tiene una fila por ubicación fija y filas libres para el resto", async () => {
    await abrir("/auditoria/formularios?mes=2026-11&hoja=Inventario&fecha=2026-11-03");
    const fijas = screen.getByText("Piso 24");
    expect(fijas).toBeInTheDocument();
    // Fila real del Excel: el día 3 empieza en la 41.
    expect(casilla("Acta / observación", 41)).toBeInTheDocument();
    // En gris, lo que dice la dotación si aún no hay conteo.
    expect(casilla("Sábana personal", 41).placeholder).toBe("10");
    escribir("Sábana personal", 41, "7");
    await esperarGuardado();
    expect(guardados()[0].data.inventario.conteos.u1).toEqual({ p1: 7 });
    // Una fila libre pide primero la ubicación.
    fireEvent.focus(casilla("Sábana personal", 42));
    escribir("Sábana personal", 42, "1");
    expect(toastError).toHaveBeenCalledWith("Elige antes la ubicación de esta fila.");
    fireEvent.change(casilla("Ubicación", 42), { target: { value: "Innova" } });
    escribir("Sábana personal", 42, "1");
    await esperarGuardado();
    expect(guardados().pop().data.inventario.conteos.u2).toEqual({ p1: 1 });
  });

  it("Datos_mes guarda los datos del mes y la síntesis", async () => {
    await abrir("/auditoria/formularios?mes=2026-11&hoja=Datos_mes");
    escribir("Representante que informa", 12, "Representante A");
    fireEvent.change(screen.getByLabelText("Logros y resultados relevantes"), { target: { value: "Bien" } });
    await esperarGuardado();
    const documento = saveControlMes.mock.calls[0][3] as { datos: { representante: string }; sintesis: { logros: string } };
    expect(documento.datos.representante).toBe("Representante A");
    expect(documento.sintesis.logros).toBe("Bien");
  });

  it("Resumen no deja escribir y enseña los resultados", async () => {
    await abrir("/auditoria/formularios?mes=2026-11&hoja=Resumen");
    const hoja = screen.getByRole("region", { name: "Hoja Resumen" });
    expect(within(hoja).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(hoja).getByText("Producción lavada")).toBeInTheDocument();
    expect(within(hoja).getByText("Matriz de resultados del SLA")).toBeInTheDocument();
  });

  it("cambia de hoja y de mes en la URL", async () => {
    await abrir();
    fireEvent.click(screen.getByRole("tab", { name: "Operacion" }));
    expect(screen.getByTestId("ruta").textContent).toContain("hoja=Operacion");
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    await waitFor(() => expect(screen.getByTestId("ruta").textContent).toContain("mes=2026-12"));
  });

  it("los enlaces antiguos llevan a su hoja", async () => {
    await abrir("/auditoria/formularios/parte?fecha=2026-11-02");
    expect(screen.getByRole("tab", { name: "Operacion" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("ruta").textContent).toContain("fecha=2026-11-02");
  });

  describe("subir el Excel", () => {
    const elegirArchivo = async () => {
      fireEvent.click(screen.getByRole("button", { name: /Subir Excel/ }));
      const input = (await screen.findByLabelText("Excel del mes")) as HTMLInputElement;
      const archivo = new File(["x"], "noviembre.xlsx");
      await act(async () => {
        fireEvent.change(input, { target: { files: [archivo] } });
        await vi.advanceTimersByTimeAsync(10);
      });
      return archivo;
    };

    it("explica por qué no vale un archivo que no es el modelo, sin cambiar nada", async () => {
      leerArchivoExcel.mockResolvedValue({ hojas: ["Hoja1"], celda: () => null });
      await abrir();
      await elegirArchivo();
      expect(await screen.findByRole("alert")).toHaveTextContent("no es el Modelo Mensual");
      expect(aplicarImportacion).not.toHaveBeenCalled();
    });

    it("enseña lo que hará, no cambia nada hasta confirmar y después recarga el mes", async () => {
      const c = libroBase();
      lavadoExcel(c, 11, ["02/11/2026", "Día", "V9", "Toalla de baño", 10, 0, 10, 5, "Ana", "L1"]);
      lavadoExcel(c, 12, ["01/12/2026", "Día", "V9", "Toalla de baño", 10, 0, 10, 5, "Ana", "L1"]);
      leerArchivoExcel.mockResolvedValue(lector(c));
      partes = [parte("2026-11-03", "yo", { lavado: [vale("a", "APP", "Bea")] })];
      await abrir();
      const archivo = await elegirArchivo();
      const dialogo = await screen.findByRole("dialog");
      await within(dialogo).findByText("Revisa antes de actualizar");
      const tabla = within(dialogo).getByRole("table", { name: "Cambios por hoja" });
      const lavado = within(tabla).getByText("Lavado_detalle").closest('[role="row"]') as HTMLElement;
      expect(within(lavado).getAllByRole("cell").map((x) => x.textContent).slice(1, 5)).toEqual(["1 fila", "1", "0", "1"]);
      expect(within(dialogo).getByText(/La fecha 01\/12\/2026 no es de este mes/)).toBeInTheDocument();
      expect(aplicarImportacion).not.toHaveBeenCalled();

      fireEvent.click(within(dialogo).getByRole("button", { name: "Actualizar el mes sin esa fila" }));
      await within(dialogo).findByText("Mes actualizado");
      const llamada = aplicarImportacion.mock.calls[0][0] as { archivo: File; anio: number; mes: number; plan: { partes: { fecha: string }[] } };
      expect(llamada.archivo).toBe(archivo);
      expect(llamada.plan.partes.map((p) => p.fecha)).toEqual(["2026-11-02"]);

      partes = [...partes, parte("2026-11-02", "yo", { lavado: [vale("z", "V9", "Ana")] })];
      fireEvent.click(within(dialogo).getByRole("button", { name: "Ver las hojas" }));
      expect(await screen.findByDisplayValue("V9")).toBeInTheDocument();
    });

    it("pide confirmar si el Excel parece de otro hotel", async () => {
      const c = libroBase();
      c.Datos_mes.B9 = "Otro Resort";
      c.Operacion.B11 = 100;
      leerArchivoExcel.mockResolvedValue(lector(c));
      await abrir();
      await elegirArchivo();
      const dialogo = await screen.findByRole("dialog");
      const actualizar = await within(dialogo).findByRole("button", { name: "Actualizar el mes" });
      expect(actualizar).toBeDisabled();
      fireEvent.click(within(dialogo).getByRole("checkbox"));
      expect(actualizar).not.toBeDisabled();
    });

    it("un Excel de otro mes ofrece ir a él", async () => {
      const c = libroBase();
      c.Datos_mes.B7 = 10;
      leerArchivoExcel.mockResolvedValue(lector(c));
      await abrir();
      await elegirArchivo();
      const dialogo = await screen.findByRole("dialog");
      fireEvent.click(await within(dialogo).findByRole("button", { name: "Ir a ese mes" }));
      await waitFor(() => expect(screen.getByTestId("ruta").textContent).toContain("mes=2026-10"));
    });

    it("un archivo que no se puede abrir lo dice y deja elegir otro", async () => {
      leerArchivoExcel.mockRejectedValue(new Error("No se ha podido abrir este archivo."));
      await abrir();
      await elegirArchivo();
      expect(await screen.findByRole("alert")).toHaveTextContent("No se ha podido abrir");
      expect(screen.getByLabelText("Excel del mes")).toBeInTheDocument();
    });
  });
});
