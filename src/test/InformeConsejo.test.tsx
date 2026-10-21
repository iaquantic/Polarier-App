import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { FilaDisponibilidad, InformeConsejo } from "@/lib/informeConsejo";

// Julio de 2026: se ven de julio a enero.
// - Julio: falta el CD de La Habana.  - Junio: falta la calidad de La Habana.
// - Mayo: completo y con informe.     - Abril y anteriores: completos, sin informe.
const fila = (mes: number, p: Partial<FilaDisponibilidad> = {}): FilaDisponibilidad => ({
  mes, grupo: "global", orden: 1, requisito: "GLOBAL · mes cargado", polo: "La Habana", estado: "ok", detalle: null, ...p,
});
const cd = (mes: number, p: Partial<FilaDisponibilidad> = {}) =>
  fila(mes, { grupo: "tabla_ca", orden: 11, requisito: "TABLA CA · datos del CD del mes", ...p });

const DISPONIBILIDAD: FilaDisponibilidad[] = [1, 2, 3, 4, 5, 6, 7].flatMap((mes) => [
  fila(mes),
  mes === 7 ? cd(mes, { estado: "falta", detalle: "Falta subir su CD de ese mes" })
    : mes === 6 ? cd(mes, { estado: "falta", detalle: "Falta: evaluación de calidad" })
    : cd(mes),
  fila(mes, { grupo: "tecleado", orden: 106, requisito: "Cargos vacantes", polo: null, estado: "sin_comprobar", detalle: "Hoja «Datos económicos»" }),
]);

const MAYO: InformeConsejo = {
  id: "inf-5", anio: 2026, mes: 5, estado: "listo", solicitado_por: "u1",
  solicitado_at: "2026-06-03T09:00:00Z", generado_at: "2026-06-03T09:12:00Z",
  archivo_path: "2026/05/consejo_direccion_MAYO_2026.docx", archivo_nombre: "consejo_direccion_MAYO_2026.docx", error: null,
};

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", email: "usuario@example.com" }, profile: { full_name: "Usuario de prueba" } }),
}));

const servicio = vi.hoisted(() => ({ migracion: false }));
vi.mock("@/services/informeConsejo", () => {
  class MigracionPendiente extends Error {}
  return {
    MigracionPendiente,
    getDisponibilidad: vi.fn(async () => {
      if (servicio.migracion) throw new MigracionPendiente();
      return DISPONIBILIDAD;
    }),
    getInformes: vi.fn(async () => [MAYO]),
    getFuentes: vi.fn(async () => ({ global: "2026-07-14T08:00:00Z", tabla_ca: "2026-07-10T08:00:00Z" })),
    generarInforme: vi.fn(async (anio: number, mes: number) => ({
      ...MAYO, id: `inf-${mes}`, mes, estado: "pendiente", archivo_path: null, generado_at: null, solicitado_at: new Date().toISOString(),
    })),
    urlDescarga: vi.fn(async () => "https://supabase.test/descarga"),
  };
});

const pintar = async () => {
  const { default: InformeConsejo } = await import("@/pages/automations/InformeConsejo");
  render(
    <MemoryRouter initialEntries={["/automatizaciones/informe-consejo"]}>
      <InformeConsejo />
    </MemoryRouter>
  );
};

const tarjeta = async (titulo: string) => (await screen.findByText(titulo)).closest("article") as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-07-15T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  servicio.migracion = false;
});

describe("InformeConsejo · un mes por tarjeta", () => {
  it("enseña los meses del año hasta el actual, el más reciente primero", async () => {
    await pintar();
    await screen.findByText("Julio 2026");
    const titulos = screen.getAllByRole("article").map((a) => within(a).getByText(/2026$/).textContent);
    expect(titulos).toEqual(["Julio 2026", "Junio 2026", "Mayo 2026", "Abril 2026", "Marzo 2026", "Febrero 2026", "Enero 2026"]);
  });

  it("si falta algo, «Generar informe» queda deshabilitado y dice qué falta", async () => {
    await pintar();
    const julio = await tarjeta("Julio 2026");
    expect(within(julio).getByText("Falta 1 dato")).toBeInTheDocument();
    expect(within(julio).getByRole("button", { name: /Generar informe/ })).toBeDisabled();
    // Julio, el más reciente, sale desplegado (en cuanto termina la carga).
    expect(await within(julio).findByText(/La Habana: Falta subir su CD de ese mes/)).toBeInTheDocument();
  });

  it("un mes completo se puede generar", async () => {
    await pintar();
    const abril = await tarjeta("Abril 2026");
    expect(within(abril).getByText("Listo para generar")).toBeInTheDocument();
    const boton = within(abril).getByRole("button", { name: /Generar informe/ });
    expect(boton).toBeEnabled();

    fireEvent.click(boton);
    const svc = await import("@/services/informeConsejo");
    expect(svc.generarInforme).toHaveBeenCalledWith(2026, 4, expect.objectContaining({ id: "u1" }));
    expect(await within(abril).findByText("Generando…")).toBeInTheDocument();
  });

  it("un mes con informe ofrece descargarlo y regenerarlo", async () => {
    await pintar();
    const mayo = await tarjeta("Mayo 2026");
    expect(within(mayo).getByText("Informe generado")).toBeInTheDocument();
    expect(within(mayo).getByRole("button", { name: /Descargar informe/ })).toBeEnabled();
    expect(within(mayo).getByRole("button", { name: /Regenerar/ })).toBeEnabled();
  });

  it("al desplegar un mes enseña cada dato por polo y lo tecleado sin comprobar", async () => {
    await pintar();
    const junio = await tarjeta("Junio 2026");
    fireEvent.click(within(junio).getByRole("button", { name: /Junio 2026/ }));
    expect(await within(junio).findByText(/La Habana: Falta: evaluación de calidad/)).toBeInTheDocument();
    expect(within(junio).getByText(/Tecleado en la TABLA CA · sin comprobar/)).toBeInTheDocument();
    expect(within(junio).getByText("Cargos vacantes")).toBeInTheDocument();
  });

  it("sin la migración 013 lo dice en vez de fallar", async () => {
    servicio.migracion = true;
    await pintar();
    expect(await screen.findByText(/falta aplicar en Supabase la migración 013/)).toBeInTheDocument();
  });
});
