import { describe, it, expect, vi, beforeEach } from "vitest";

// La capa de respuesta guarda los ficheros en Storage; aquí nos interesa qué
// devuelve, no la subida.
vi.mock("@/services/storage", () => ({
  uploadAssistantBlob: vi.fn(async (_blob: Blob, _chatId: string | null, mimeType: string, originalName?: string) => ({
    id: "doc-1",
    file_path: `uid/assistant/${originalName ?? "archivo"}`,
    signedUrl: `https://supabase.test/${originalName ?? "archivo"}`,
    mime_type: mimeType,
    fileName: originalName ?? "archivo",
  })),
}));

import { interpretarRespuestaN8n, extractTextContent } from "@/lib/n8nRespuesta";

const respuesta = (body: BodyInit, headers: Record<string, string>) =>
  new Response(body, { status: 200, headers });

describe("extractTextContent", () => {
  it("prefiere 'respuesta' y luego 'output' sobre 'message'", () => {
    expect(extractTextContent({ message: "lo que escribió el usuario", output: "la contestación" })).toBe("la contestación");
    expect(extractTextContent({ respuesta: "texto", output: "otro" })).toBe("texto");
  });

  it("baja al primer elemento de un array", () => {
    expect(extractTextContent([{ output: "hola" }])).toBe("hola");
  });

  it("devuelve null si no hay nada", () => {
    expect(extractTextContent({})).toBeNull();
    expect(extractTextContent(null)).toBeNull();
  });
});

describe("interpretarRespuestaN8n", () => {
  beforeEach(() => vi.clearAllMocks());

  it("un binario se guarda y vuelve como marcador de descarga", async () => {
    const res = respuesta(new Blob(["x"]), {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="GLOBAL-CP26.xlsx"',
    });
    const { mensaje, texto, archivo } = await interpretarRespuestaN8n(res, null);
    expect(archivo?.nombre).toBe("GLOBAL-CP26.xlsx");
    expect(archivo?.ext).toBe("xlsx");
    expect(texto).toBeNull();
    expect(mensaje).toBe("[GLOBAL-CP26.xlsx](https://supabase.test/GLOBAL-CP26.xlsx){.file-download|xlsx}");
  });

  it("texto y fichero a la vez (el agente de la TABLA CA)", async () => {
    const body = JSON.stringify({
      respuesta: "TABLA CA 2026 · Caibarién · abril\nSin avisos.",
      archivo: { nombre: "TABLA CA 2026.xlsx", mime: "application/vnd.ms-excel", base64: btoa("x") },
    });
    const { mensaje, texto, archivo } = await interpretarRespuestaN8n(respuesta(body, { "content-type": "application/json" }), null);
    expect(texto).toContain("Sin avisos.");
    expect(archivo?.nombre).toBe("TABLA CA 2026.xlsx");
    // El marcador va en su propia línea al final: es lo que ChatMessage sabe pintar.
    expect(mensaje?.endsWith("[TABLA CA 2026.xlsx](https://supabase.test/TABLA CA 2026.xlsx){.file-download|xlsx}")).toBe(true);
    expect(mensaje?.split("\n\n").length).toBeGreaterThan(1);
  });

  it("un 200 con cuerpo vacío no revienta", async () => {
    const { mensaje, archivo } = await interpretarRespuestaN8n(respuesta("", { "content-type": "application/json" }), null);
    expect(mensaje).toBeNull();
    expect(archivo).toBeNull();
  });

  it("texto plano pasa tal cual", async () => {
    const { mensaje, texto } = await interpretarRespuestaN8n(respuesta("Hecho", { "content-type": "text/plain" }), null);
    expect(mensaje).toBe("Hecho");
    expect(texto).toBe("Hecho");
  });
});
