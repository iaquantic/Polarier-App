import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuditParte from "@/pages/audit/AuditParte";

const DEF = { id: "def", hotel_id: "h1", tipo: "control", nombre: "Parte", schema_version: 1, config: {}, activo: true };
const HOTEL = { id: "h1", nombre: "Hotel de prueba", polo: { nombre: "Polo" } };
const FECHA = "2026-10-05";

const saveSubmission = vi.fn(async (_params: unknown) => ({}));
const refrescar = vi.fn(async (..._args: unknown[]) => undefined);
const getSubmission = vi.fn(async (_def: string, _fecha: string): Promise<unknown> => sub);
const getParteAnterior = vi.fn(async (_def: string, _fecha: string): Promise<unknown> => null);
let sub: Record<string, unknown> | null = null;
let controlMes: Record<string, unknown> | null = null;

vi.mock("@/context/RoleContext", () => ({ useRole: () => ({ hotels: [HOTEL], activeHotel: HOTEL, loading: false }) }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, profile: {} }) }));
vi.mock("@/services/auditControl", () => ({ refrescarResumenMes: (...a: unknown[]) => refrescar(...a) }));
vi.mock("@/services/audit", () => ({
  getDefinicionControl: async () => DEF,
  getSubmission: (d: string, f: string) => getSubmission(d, f),
  getSubmissionById: async () => sub,
  getSubmissionsByMonth: async () => [],
  getPrendas: async () => [
    { id: "p1", codigo: "SP", nombre: "Sábana personal", orden: 1 },
    { id: "p2", codigo: "TB", nombre: "Toalla de baño", orden: 2 },
  ],
  getUbicaciones: async () => [{ id: "u1", nombre: "Piso 24", orden: 1 }],
  getDotacionLenceria: async () => ({ u1: { p1: 10, p2: 5 } }),
  getParteAnterior: (d: string, f: string) => getParteAnterior(d, f),
  getControlMes: async () => controlMes,
  getEventosAbiertos: async () => [],
  getEventosMes: async () => [],
  getAutores: async () => ({ otro: { id: "otro", nombre: "Otra persona", email: null } }),
  saveSubmission: (p: unknown) => saveSubmission(p),
  saveEvento: vi.fn(),
}));

const abrir = async (url = `/auditoria/formularios/parte?fecha=${FECHA}`) => {
  render(
    <MemoryRouter initialEntries={[url]}>
      <AuditParte />
    </MemoryRouter>
  );
  await screen.findByRole("heading", { name: "Parte diario de control" });
};

const paso = (nombre: RegExp) => screen.getByRole("button", { name: nombre });

const elegirDia = (n: number) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Día ${n}:`) }));
const turistas = () => screen.getByLabelText("Turistas del día") as HTMLInputElement;
const contenido = () => document.querySelector("[aria-busy]") as HTMLElement;

/** Lo que recibe `saveSubmission`, para mirar en qué día y con qué datos se guardó. */
type Guardado = { fecha: string; data: { jornada: { turistas: number | null } } };

const parteCon = (fecha: string, n: number) => ({
  id: `s-${fecha}`,
  user_id: "u1",
  fecha,
  estado: "borrador",
  data: { jornada: { turistas: n } },
});

/** Una promesa que se resuelve a mano, para ver la pantalla mientras algo sigue cargando. */
const pendiente = <T,>() => {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
};

describe("AuditParte", () => {
  beforeEach(() => {
    saveSubmission.mockReset();
    saveSubmission.mockImplementation(async () => ({}));
    refrescar.mockClear();
    getSubmission.mockReset();
    getSubmission.mockImplementation(async () => sub);
    getParteAnterior.mockReset();
    getParteAnterior.mockImplementation(async () => null);
    sub = null;
    controlMes = null;
    vi.useRealTimers();
  });

  it("abrir un día para mirarlo no crea un parte vacío", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await abrir();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(saveSubmission).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("guarda solo unos segundos después de cambiar algo, sin confundir vacío con 0", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await abrir();
    fireEvent.change(screen.getByLabelText("Turistas del día"), { target: { value: "612" } });
    expect(saveSubmission).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    expect(saveSubmission).toHaveBeenCalledTimes(1);
    const args = saveSubmission.mock.calls[0][0] as { data: any; estado: string; totales: any };
    expect(args.estado).toBe("borrador");
    expect(args.data.jornada.turistas).toBe(612);
    expect(args.data.jornada.entregadas).toBeNull();
    expect(args.totales.turistas).toBe(612);
    vi.useRealTimers();
  });

  it("acepta horas de reloj y las guarda en decimal", async () => {
    await abrir();
    const campo = screen.getByLabelText("Horas trabajadas");
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: "1:30" } });
    fireEvent.blur(campo);
    expect((campo as HTMLInputElement).value).toBe("1,5");
  });

  it("no deja teclear negativos ni letras", async () => {
    await abrir();
    const campo = screen.getByLabelText("Turistas del día") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "-5" } });
    expect(campo.value).toBe("");
    fireEvent.change(campo, { target: { value: "abc" } });
    expect(campo.value).toBe("");
  });

  it("recorre un vale: añadir prenda, ver el aviso y arrastrarlo a Procesado con «Todo conforme»", async () => {
    await abrir();
    fireEvent.click(paso(/2 · Lavado/));
    fireEvent.click(screen.getByRole("button", { name: /Añadir vale/ }));
    fireEvent.change(screen.getByLabelText("Vale"), { target: { value: "V-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Sábana personal/ }));
    fireEvent.change(screen.getByLabelText("Recibidas, Sábana personal"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Lavadas, Sábana personal"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Kg, Sábana personal"), { target: { value: "80,5" } });
    expect(screen.getByText("Se han lavado más piezas de las recibidas más las pendientes.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lavadas, Sábana personal"), { target: { value: "100" } });
    expect(screen.queryByText("Se han lavado más piezas de las recibidas más las pendientes.")).toBeNull();

    fireEvent.click(paso(/3 · Procesado/));
    fireEvent.click(screen.getByRole("button", { name: /V-1 a Secado/ }));
    const declaradas = screen.getByLabelText("Declaradas, Sábana personal") as HTMLInputElement;
    expect(declaradas.value).toBe("100");
    fireEvent.click(screen.getByRole("button", { name: "Todo conforme, Sábana personal" }));
    expect((screen.getByLabelText("Conforme, Sábana personal") as HTMLInputElement).value).toBe("100");
    expect(screen.getAllByText("Completo").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Pasar este vale a Planchado/ }));
    expect((screen.getByLabelText("Declaradas, Sábana personal") as HTMLInputElement).value).toBe("100");
  });

  it("el inventario enseña la dotación en gris y vacío no es conteo", async () => {
    await abrir();
    fireEvent.click(paso(/4 · Inventario/));
    const celda = screen.getByLabelText("Piso 24, Sábana personal") as HTMLInputElement;
    expect(celda.placeholder).toBe("10");
    expect(celda.value).toBe("");
    expect(screen.getAllByText("Sin conteo").length).toBeGreaterThan(0);
    fireEvent.change(celda, { target: { value: "0" } });
    // 0 es un conteo comprobado.
    expect(celda.value).toBe("0");
    expect(screen.getAllByText("Parcial").length).toBeGreaterThan(0);
  });

  it("cerrar con registros por corregir pide confirmación y guarda como completado", async () => {
    sub = {
      id: "s1",
      user_id: "u1",
      fecha: FECHA,
      estado: "borrador",
      data: {
        lavado: [
          {
            id: "v",
            vale: "V-1",
            turno: "Día",
            operario: "",
            equipo: "",
            lineas: [{ id: "l", prenda: "Sábana personal", recibidas: 100, pendiente_inicial: 0, lavadas: 100, kg: null, observaciones: "" }],
          },
        ],
      },
    };
    await abrir();
    fireEvent.click(screen.getByRole("button", { name: /Cerrar jornada/ }));
    expect(await screen.findByText(/Quedan 1 de Lavado por corregir/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar igualmente" }));
    await waitFor(() => expect(saveSubmission).toHaveBeenCalled());
    const args = saveSubmission.mock.calls[saveSubmission.mock.calls.length - 1][0] as { estado: string; data: any };
    expect(args.estado).toBe("completado");
    expect(args.data.jornada.cierre).toBe("Cerrado");
    await waitFor(() => expect(refrescar).toHaveBeenCalledWith("h1", 2026, 10));
  });

  it("un parte de otra persona se abre en solo lectura y sin botones de guardar", async () => {
    sub = { id: "s2", user_id: "otro", fecha: FECHA, estado: "completado", data: {} };
    await abrir(`/auditoria/formularios/parte?fecha=${FECHA}&sub=s2`);
    expect(await screen.findByText("Solo lectura")).toBeInTheDocument();
    expect(screen.getByText(/Rellenado por Otra persona/)).toBeInTheDocument();
    expect(screen.getByLabelText("Turistas del día")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Guardar borrador/ })).toBeNull();
  });

  it("con el mes validado no se puede tocar, aunque el parte sea propio", async () => {
    controlMes = { data: { revision: { operacion: "Validado" } } };
    await abrir();
    expect(await screen.findByText(/El mes está validado/)).toBeInTheDocument();
    expect(screen.getByLabelText("Turistas del día")).toBeDisabled();
  });

  it("un día futuro no se puede rellenar", async () => {
    await abrir("/auditoria/formularios/parte?fecha=2099-01-01");
    expect(await screen.findByText("Este día todavía no ha llegado.")).toBeInTheDocument();
    expect(screen.getByLabelText("Turistas del día")).toBeDisabled();
  });

  describe("al cambiar de día", () => {
    it("el marco sigue en pantalla y el contenido anterior se atenúa hasta que llega el nuevo", async () => {
      const dia6 = pendiente<unknown>();
      getSubmission.mockImplementation(async (_d, f) => (f === "2026-10-06" ? dia6.promesa : parteCon(f, 100)));
      await abrir();
      const titulo = screen.getByRole("heading", { name: "Parte diario de control" });
      const selector = screen.getByRole("region", { name: "Días del mes" });
      const pestanas = screen.getByRole("navigation", { name: "Pasos del parte" });

      elegirDia(6);

      await waitFor(() => expect(getSubmission).toHaveBeenCalledWith("def", "2026-10-06"));
      // El día elegido se marca al momento, y lo anterior sigue a la vista sin poder tocarse.
      expect(screen.getByRole("button", { name: /^Día 6:/ })).toHaveAttribute("aria-current", "date");
      expect(screen.getByText(/6 de octubre de 2026/)).toBeInTheDocument();
      expect(screen.getByText("Cargando…")).toBeInTheDocument();
      expect(turistas().value).toBe("100");
      expect(contenido()).toHaveAttribute("aria-busy", "true");
      expect(contenido()).toHaveAttribute("inert");

      await act(async () => dia6.resolver(parteCon("2026-10-06", 200)));

      await waitFor(() => expect(turistas().value).toBe("200"));
      expect(contenido()).toHaveAttribute("aria-busy", "false");
      expect(contenido()).not.toHaveAttribute("inert");
      // Los mismos nodos: no se ha remontado nada del marco.
      expect(titulo.isConnected).toBe(true);
      expect(selector.isConnected).toBe(true);
      expect(pestanas.isConnected).toBe(true);
    });

    it("no pierde el paso en el que se estaba", async () => {
      await abrir();
      fireEvent.click(paso(/2 · Lavado/));
      expect(screen.getByRole("button", { name: /Añadir vale/ })).toBeInTheDocument();
      elegirDia(6);
      await waitFor(() => expect(contenido()).toHaveAttribute("aria-busy", "false"));
      expect(paso(/2 · Lavado/)).toHaveAttribute("aria-current", "step");
      expect(screen.getByRole("button", { name: /Añadir vale/ })).toBeInTheDocument();
    });

    it("una respuesta antigua no pisa el día elegido después", async () => {
      const dia6 = pendiente<unknown>();
      const dia7 = pendiente<unknown>();
      getSubmission.mockImplementation(async (_d, f) => {
        if (f === "2026-10-06") return dia6.promesa;
        if (f === "2026-10-07") return dia7.promesa;
        return parteCon(f, 100);
      });
      await abrir();

      elegirDia(6);
      await waitFor(() => expect(getSubmission).toHaveBeenCalledWith("def", "2026-10-06"));
      elegirDia(7);
      await waitFor(() => expect(getSubmission).toHaveBeenCalledWith("def", "2026-10-07"));

      await act(async () => dia7.resolver(parteCon("2026-10-07", 700)));
      await waitFor(() => expect(turistas().value).toBe("700"));

      await act(async () => dia6.resolver(parteCon("2026-10-06", 600)));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(turistas().value).toBe("700");
      expect(screen.getByRole("button", { name: /^Día 7:/ })).toHaveAttribute("aria-current", "date");
    });

    it("volver al día en pantalla antes de que llegue el otro no pierde lo tecleado", async () => {
      const dia6 = pendiente<unknown>();
      getSubmission.mockImplementation(async (_d, f) => (f === "2026-10-06" ? dia6.promesa : parteCon(f, 100)));
      await abrir();
      fireEvent.change(turistas(), { target: { value: "150" } });

      elegirDia(6);
      await waitFor(() => expect(getSubmission).toHaveBeenCalledWith("def", "2026-10-06"));
      elegirDia(5);

      await waitFor(() => expect(contenido()).toHaveAttribute("aria-busy", "false"));
      expect(turistas().value).toBe("150");
      await act(async () => dia6.resolver(parteCon("2026-10-06", 600)));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(turistas().value).toBe("150");
    });

    it("guarda lo pendiente en su día antes de leer el nuevo, y nada en el nuevo", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const guardado = pendiente<unknown>();
      saveSubmission.mockImplementationOnce(() => guardado.promesa as Promise<object>);
      await abrir();
      fireEvent.change(turistas(), { target: { value: "612" } });

      // Antes de que salte el autoguardado.
      elegirDia(6);

      await waitFor(() => expect(saveSubmission).toHaveBeenCalledTimes(1));
      const args = saveSubmission.mock.calls[0][0] as Guardado;
      expect(args.fecha).toBe(FECHA);
      expect(args.data.jornada.turistas).toBe(612);
      // Hasta que no esté guardado no se pide el día nuevo: su mes tiene que incluirlo.
      expect(getSubmission).not.toHaveBeenCalledWith("def", "2026-10-06");

      await act(async () => guardado.resolver({}));
      await waitFor(() => expect(getSubmission).toHaveBeenCalledWith("def", "2026-10-06"));
      await waitFor(() => expect(contenido()).toHaveAttribute("aria-busy", "false"));
      expect(turistas().value).toBe("");
      // El «Guardado hace…» era del día anterior: el nuevo sigue sin parte.
      expect(screen.getByText("Sin cambios")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Día 6: sin parte" })).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      expect(saveSubmission).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("espera al guardado que ya estaba saliendo antes de leer el día nuevo", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const guardado = pendiente<unknown>();
      saveSubmission.mockImplementationOnce(() => guardado.promesa as Promise<object>);
      await abrir();
      fireEvent.change(turistas(), { target: { value: "612" } });
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });
      expect(saveSubmission).toHaveBeenCalledTimes(1);

      elegirDia(6);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(getSubmission).not.toHaveBeenCalledWith("def", "2026-10-06");

      await act(async () => guardado.resolver({}));
      await waitFor(() => expect(getSubmission).toHaveBeenCalledWith("def", "2026-10-06"));
      expect(saveSubmission).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("si falla el guardado que ya estaba saliendo, lo repite en su día antes de pasar", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const guardado = pendiente<unknown>();
      saveSubmission.mockImplementationOnce(() => guardado.promesa as Promise<object>);
      await abrir();
      fireEvent.change(turistas(), { target: { value: "612" } });
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      elegirDia(6);
      await act(async () => guardado.rechazar(new Error("sin conexión")));

      await waitFor(() => expect(contenido()).toHaveAttribute("aria-busy", "false"));
      const llamadas = saveSubmission.mock.calls.map((c) => c[0] as Guardado);
      expect(llamadas.map((c) => c.fecha)).toEqual([FECHA, FECHA]);
      expect(llamadas[1].data.jornada.turistas).toBe(612);
      vi.useRealTimers();
    });

    it("mientras carga no se puede cambiar nada, ni se guarda en ningún día", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const dia6 = pendiente<unknown>();
      getSubmission.mockImplementation(async (_d, f) => (f === "2026-10-06" ? dia6.promesa : parteCon(f, 100)));
      await abrir();

      elegirDia(6);
      await waitFor(() => expect(getSubmission).toHaveBeenCalledWith("def", "2026-10-06"));
      fireEvent.change(turistas(), { target: { value: "999" } });
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(saveSubmission).not.toHaveBeenCalled();

      await act(async () => dia6.resolver(parteCon("2026-10-06", 200)));
      await waitFor(() => expect(turistas().value).toBe("200"));
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(saveSubmission).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("lo que se intente teclear mientras carga no se guarda al volver al día en pantalla", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const dia6 = pendiente<unknown>();
      getSubmission.mockImplementation(async (_d, f) => (f === "2026-10-06" ? dia6.promesa : parteCon(f, 100)));
      await abrir();

      elegirDia(6);
      await waitFor(() => expect(getSubmission).toHaveBeenCalledWith("def", "2026-10-06"));
      fireEvent.change(turistas(), { target: { value: "999" } });
      elegirDia(5);
      await waitFor(() => expect(contenido()).toHaveAttribute("aria-busy", "false"));
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(saveSubmission).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("un editor abierto en un día no pasa al siguiente", async () => {
      await abrir();
      fireEvent.click(paso(/5 · Novedades/));
      fireEvent.click(screen.getByRole("button", { name: /Incidencia/ }));
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();

      elegirDia(6);

      await waitFor(() => expect(contenido()).toHaveAttribute("aria-busy", "false"));
      expect(paso(/5 · Novedades/)).toHaveAttribute("aria-current", "step");
      expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    });

    it("lo que se teclea después de llegar se guarda en el día nuevo", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await abrir();
      elegirDia(6);
      await waitFor(() => expect(contenido()).toHaveAttribute("aria-busy", "false"));
      fireEvent.change(turistas(), { target: { value: "42" } });
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });
      expect(saveSubmission).toHaveBeenCalledTimes(1);
      const args = saveSubmission.mock.calls[0][0] as Guardado;
      expect(args.fecha).toBe("2026-10-06");
      expect(args.data.jornada.turistas).toBe(42);
      vi.useRealTimers();
    });

    it("si no se puede guardar lo pendiente, no pasa de día ni lo pierde", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      saveSubmission.mockImplementationOnce(async () => {
        throw new Error("sin conexión");
      });
      await abrir();
      fireEvent.change(turistas(), { target: { value: "612" } });

      elegirDia(6);

      expect(await screen.findByRole("alert")).toHaveTextContent("No se han podido guardar los cambios del día anterior.");
      expect(getSubmission).not.toHaveBeenCalledWith("def", "2026-10-06");
      expect(turistas().value).toBe("612");
      expect(contenido()).toHaveAttribute("aria-busy", "true");

      // Al reintentar con conexión, se guarda en su día y entonces pasa al nuevo.
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      await waitFor(() => expect(contenido()).toHaveAttribute("aria-busy", "false"));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(turistas().value).toBe("");
      const fechas = saveSubmission.mock.calls.map((c) => (c[0] as Guardado).fecha);
      expect(fechas).toEqual([FECHA, FECHA]);
    });

    it("si no se puede guardar y se vuelve a ese día, lo pendiente se guarda solo", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      saveSubmission.mockImplementationOnce(async () => {
        throw new Error("sin conexión");
      });
      await abrir();
      fireEvent.change(turistas(), { target: { value: "612" } });

      elegirDia(6);
      await screen.findByRole("alert");
      elegirDia(5);
      await waitFor(() => expect(contenido()).toHaveAttribute("aria-busy", "false"));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(turistas().value).toBe("612");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      const fechas = saveSubmission.mock.calls.map((c) => (c[0] as Guardado).fecha);
      expect(fechas).toEqual([FECHA, FECHA]);
      vi.useRealTimers();
    });

    it("si no se puede guardar y sigue en espera, reintenta solo en su día y no en el nuevo", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      saveSubmission.mockImplementationOnce(async () => {
        throw new Error("sin conexión");
      });
      await abrir();
      fireEvent.change(turistas(), { target: { value: "612" } });

      elegirDia(6);
      await screen.findByRole("alert");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8500);
      });
      const fechas = saveSubmission.mock.calls.map((c) => (c[0] as Guardado).fecha);
      expect(fechas).toEqual([FECHA, FECHA]);

      // Ya guardado, reintentar pasa de día sin volver a escribir nada.
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      await waitFor(() => expect(contenido()).toHaveAttribute("aria-busy", "false"));
      expect(saveSubmission).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it("si no se puede abrir el día, sigue el anterior a la vista y se puede volver a él", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      getSubmission.mockImplementation(async (_d, f) => {
        if (f === "2026-10-06") throw new Error("sin conexión");
        return parteCon(f, 100);
      });
      await abrir();

      elegirDia(6);

      expect(await screen.findByRole("alert")).toHaveTextContent("No se ha podido abrir este día.");
      expect(turistas().value).toBe("100");
      expect(contenido()).toHaveAttribute("aria-busy", "true");

      elegirDia(5);
      await waitFor(() => expect(contenido()).toHaveAttribute("aria-busy", "false"));
      expect(screen.queryByRole("alert")).toBeNull();
      fireEvent.change(turistas(), { target: { value: "150" } });
      expect(turistas().value).toBe("150");
    });

    it("si la primera carga falla, ofrece reintentar en vez de decir que no hay parte", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      getSubmission.mockImplementationOnce(async () => {
        throw new Error("sin conexión");
      });
      render(
        <MemoryRouter initialEntries={[`/auditoria/formularios/parte?fecha=${FECHA}`]}>
          <AuditParte />
        </MemoryRouter>
      );
      expect(await screen.findByRole("alert")).toHaveTextContent("No se ha podido abrir este día.");
      expect(screen.queryByText(/todavía no está disponible/)).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      expect(await screen.findByRole("heading", { name: "Parte diario de control" })).toBeInTheDocument();
    });

    it("no arrastra «como ayer» a un día que ya tiene parte", async () => {
      getParteAnterior.mockImplementation(async () => ({ data: { jornada: { horas_previstas: 8 } } }));
      getSubmission.mockImplementation(async (_d, f) => (f === "2026-10-06" ? parteCon(f, 200) : null));
      await abrir();
      expect(screen.getByLabelText("Horas previstas (como ayer)")).toBeInTheDocument();
      elegirDia(6);
      await waitFor(() => expect(turistas().value).toBe("200"));
      expect(screen.queryByLabelText("Horas previstas (como ayer)")).toBeNull();
      expect(screen.getByLabelText("Horas previstas")).toBeInTheDocument();
    });
  });
});
