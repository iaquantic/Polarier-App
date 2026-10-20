import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { EjecucionAutomatizacion } from "@/services/automatizaciones";

const completada: EjecucionAutomatizacion = {
  id: "run-1",
  user_id: "u1",
  slug: "modelo-1",
  estado: "completada",
  archivo_nombre: "HOCP202610.pdf",
  archivo_path: "u1/1-HOCP202610.pdf",
  respuesta: "Holguín · Octubre 2026\n146 celdas escritas · 2 avisos",
  resultado_nombre: "GLOBAL-CP26.xlsx",
  resultado_path: "u1/assistant/2-GLOBAL-CP26.xlsx",
  error: null,
  created_at: "2026-10-20T09:42:00Z",
  finished_at: "2026-10-20T09:48:00Z",
};

const fallida: EjecucionAutomatizacion = {
  ...completada,
  id: "run-2",
  estado: "error",
  archivo_nombre: "varadero-septiembre.zip",
  respuesta: null,
  resultado_nombre: null,
  resultado_path: null,
  error: "El lote traía dos PDF del mismo polo y mes.",
};

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", email: "leslie@polarier.com" }, profile: { full_name: "Leslie" } }),
}));
vi.mock("@/services/storage", () => ({
  getSignedDocumentUrl: vi.fn(async (path: string) => `https://supabase.test/${path}?firmada`),
}));
vi.mock("@/services/automatizaciones", () => ({
  getEjecuciones: vi.fn(async () => [completada, fallida]),
  getEjecucion: vi.fn(async (id: string) => [completada, fallida].find((e) => e.id === id) ?? null),
  ejecutarAutomatizacion: vi.fn(),
}));

const pintar = async (ruta = "/automatizaciones/modelo-1") => {
  const { default: AutomationRun } = await import("@/pages/automations/AutomationRun");
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/automatizaciones/:slug" element={<AutomationRun />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("AutomationRun · abrir una ejecución del historial", () => {
  it("al tocar una ejecución enseña su resumen y el fichero que devolvió", async () => {
    await pintar();

    // De entrada, la zona de subida.
    expect(await screen.findByRole("button", { name: "Elegir fichero" })).toBeInTheDocument();

    fireEvent.click(await screen.findByText("HOCP202610.pdf"));

    expect(await screen.findByText("Resultado")).toBeInTheDocument();
    expect(screen.getAllByText(/146 celdas escritas/).length).toBeGreaterThan(0);
    // La descarga pide una URL firmada nueva, porque la vieja caduca.
    expect(await screen.findByText("GLOBAL-CP26.xlsx")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elegir fichero" })).not.toBeInTheDocument();
  });

  it("de una fallida enseña el motivo y no ofrece descarga", async () => {
    await pintar();

    fireEvent.click(await screen.findByText("varadero-septiembre.zip"));

    expect(await screen.findByText("No se pudo procesar")).toBeInTheDocument();
    expect(screen.getAllByText(/dos PDF del mismo polo/).length).toBeGreaterThan(0);
    expect(screen.queryByText("GLOBAL-CP26.xlsx")).not.toBeInTheDocument();
  });

  it("«Volver» devuelve a la zona de subida", async () => {
    await pintar();

    fireEvent.click(await screen.findByText("HOCP202610.pdf"));
    fireEvent.click(await screen.findByRole("button", { name: "Volver" }));

    expect(await screen.findByRole("button", { name: "Elegir fichero" })).toBeInTheDocument();
  });

  it("un enlace ?run=<id> abre esa ejecución directamente", async () => {
    await pintar("/automatizaciones/modelo-1?run=run-1");

    expect(await screen.findByText("Resultado")).toBeInTheDocument();
    expect(screen.getAllByText(/146 celdas escritas/).length).toBeGreaterThan(0);
  });
});
