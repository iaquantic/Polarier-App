import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuditParte from "@/pages/audit/AuditParte";

const DEF = { id: "def", hotel_id: "h1", tipo: "control", nombre: "Parte", schema_version: 1, config: {}, activo: true };
const HOTEL = { id: "h1", nombre: "Hotel de prueba", polo: { nombre: "Polo" } };
const FECHA = "2026-10-05";

const saveSubmission = vi.fn(async (_params: unknown) => ({}));
const refrescar = vi.fn(async (..._args: unknown[]) => undefined);
let sub: Record<string, unknown> | null = null;
let controlMes: Record<string, unknown> | null = null;

vi.mock("@/context/RoleContext", () => ({ useRole: () => ({ hotels: [HOTEL], activeHotel: HOTEL, loading: false }) }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, profile: {} }) }));
vi.mock("@/services/auditControl", () => ({ refrescarResumenMes: (...a: unknown[]) => refrescar(...a) }));
vi.mock("@/services/audit", () => ({
  getDefinicionControl: async () => DEF,
  getSubmission: async () => sub,
  getSubmissionById: async () => sub,
  getSubmissionsByMonth: async () => [],
  getPrendas: async () => [
    { id: "p1", codigo: "SP", nombre: "Sábana personal", orden: 1 },
    { id: "p2", codigo: "TB", nombre: "Toalla de baño", orden: 2 },
  ],
  getUbicaciones: async () => [{ id: "u1", nombre: "Piso 24", orden: 1 }],
  getDotacionLenceria: async () => ({ u1: { p1: 10, p2: 5 } }),
  getParteAnterior: async () => null,
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

describe("AuditParte", () => {
  beforeEach(() => {
    saveSubmission.mockClear();
    refrescar.mockClear();
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
});
