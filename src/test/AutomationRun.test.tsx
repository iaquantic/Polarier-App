import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

// Informe del Consejo: asíncrono. La rama cierra la fila por su cuenta y la
// página la consulta cada 15 s.
const enMarcha: EjecucionAutomatizacion = {
  ...completada,
  id: "run-3",
  slug: "informe-consejo",
  estado: "en_curso",
  archivo_nombre: "Informe JULIO tablas.docx",
  respuesta: null,
  resultado_nombre: null,
  resultado_path: null,
  finished_at: null,
  created_at: new Date().toISOString(),
};

// Lo que devuelve la base para cada id; los tests cambian «run-3» para
// simular que la rama terminó.
const filas = new Map<string, EjecucionAutomatizacion>();
const reiniciarFilas = () => {
  filas.clear();
  for (const e of [completada, fallida, enMarcha]) filas.set(e.id, e);
};
reiniciarFilas();

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", email: "leslie@polarier.com" }, profile: { full_name: "Leslie" } }),
}));
vi.mock("@/services/automatizaciones", () => ({
  getEjecuciones: vi.fn(async (slug: string) => [...filas.values()].filter((e) => e.slug === slug)),
  getEjecucion: vi.fn(async (id: string) => filas.get(id) ?? null),
  ejecutarAutomatizacion: vi.fn(),
  // La descarga pide una URL firmada nueva, porque la vieja caduca.
  archivoDeEjecucion: vi.fn(async (e: EjecucionAutomatizacion) =>
    e.resultado_path
      ? { nombre: e.resultado_nombre, file_path: e.resultado_path, url: `https://supabase.test/${e.resultado_path}?firmada`, ext: "docx", mime: "" }
      : null
  ),
}));

afterEach(() => {
  vi.useRealTimers();
  reiniciarFilas();
});

const pintar = async (ruta = "/automatizaciones/modelo-1") => {
  const { default: AutomationRun } = await import("@/pages/automations/AutomationRun");
  return render(
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

describe("AutomationRun · automatización asíncrona (Informe Consejo de Dirección)", () => {
  const subir = async (container: HTMLElement) => {
    const svc = await import("@/services/automatizaciones");
    vi.mocked(svc.ejecutarAutomatizacion).mockResolvedValue({
      ejecucion: enMarcha,
      texto: "Recibido. Redactando el informe de JULIO 2026.",
      archivo: null,
      enCurso: true,
    });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const docx = new File(["x"], "Informe JULIO tablas.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    fireEvent.change(input, { target: { files: [docx] } });
  };

  it("tras subir el fichero queda en marcha, con el acuse de n8n", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = await pintar("/automatizaciones/informe-consejo");
    await screen.findByRole("button", { name: "Elegir fichero" });

    await subir(container);

    expect(await screen.findByText("En marcha")).toBeInTheDocument();
    expect(screen.getByText(/Redactando el informe de JULIO 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Puedes cerrar esta página/)).toBeInTheDocument();
  });

  it("cuando la rama cierra la fila, enseña el resultado y el informe para descargar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = await pintar("/automatizaciones/informe-consejo");
    await screen.findByRole("button", { name: "Elegir fichero" });
    await subir(container);
    await screen.findByText("En marcha");

    filas.set("run-3", {
      ...enMarcha,
      estado: "completada",
      respuesta: "JULIO 2026 · 40 tablas · 38 análisis",
      resultado_nombre: "consejo_direccion_JULIO_2026.docx",
      resultado_path: "u1/assistant/9-consejo_direccion_JULIO_2026.docx",
    });
    await act(() => vi.advanceTimersByTimeAsync(15_000));

    expect(await screen.findByText("Listo")).toBeInTheDocument();
    expect(screen.getAllByText(/40 tablas · 38 análisis/).length).toBeGreaterThan(0);
    expect(await screen.findByText("consejo_direccion_JULIO_2026.docx")).toBeInTheDocument();
  });

  it("si la rama la cierra con error, enseña el motivo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = await pintar("/automatizaciones/informe-consejo");
    await screen.findByRole("button", { name: "Elegir fichero" });
    await subir(container);
    await screen.findByText("En marcha");

    filas.set("run-3", { ...enMarcha, estado: "error", error: "tabla 40: «CONSUMO DE GAS LICUADO» no se reconoce" });
    await act(() => vi.advanceTimersByTimeAsync(15_000));

    expect(await screen.findByText("No se ha podido procesar")).toBeInTheDocument();
    expect(screen.getAllByText(/CONSUMO DE GAS LICUADO/).length).toBeGreaterThan(0);
  });

  it("una ejecución en marcha abierta del historial se actualiza sola al terminar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await pintar("/automatizaciones/informe-consejo?run=run-3");

    expect(await screen.findByText(/Esta pantalla se actualiza sola/)).toBeInTheDocument();

    filas.set("run-3", {
      ...enMarcha,
      estado: "completada",
      respuesta: "JULIO 2026 · 40 tablas · 38 análisis",
      resultado_nombre: "consejo_direccion_JULIO_2026.docx",
      resultado_path: "u1/assistant/9-consejo_direccion_JULIO_2026.docx",
    });
    await act(() => vi.advanceTimersByTimeAsync(15_000));

    expect(await screen.findByText("Resultado")).toBeInTheDocument();
    expect(await screen.findByText("consejo_direccion_JULIO_2026.docx")).toBeInTheDocument();
  });
});
