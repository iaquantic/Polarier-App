import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  insert: vi.fn(),
  borrarFilas: vi.fn(),
  filasDelChat: [] as { id: string; file_path: string }[],
}));

vi.mock("@/lib/supabaseClient", () => {
  // Las consultas de supabase-js se encadenan y se resuelven al hacer await.
  const consulta = (resultado: unknown) => {
    const q: Record<string, unknown> = {
      eq: () => q,
      in: () => q,
      then: (ok: (r: unknown) => unknown) => ok(resultado),
    };
    return q;
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
      storage: { from: () => ({ upload: h.upload, remove: h.remove }) },
      from: () => ({
        select: () => consulta({ data: h.filasDelChat, error: null }),
        delete: () => {
          h.borrarFilas();
          return consulta({ error: null });
        },
        insert: () => ({ select: () => ({ single: h.insert }) }),
      }),
    },
  };
});

import { deleteDocument, deleteDocumentsByChat, uploadDocument } from "@/services/storage";

const FALLO_STORAGE = new Error("Storage no responde");

beforeEach(() => {
  vi.clearAllMocks();
  h.upload.mockResolvedValue({ error: null });
  h.remove.mockResolvedValue({ data: [], error: null });
  h.filasDelChat = [
    { id: "d1", file_path: "u1/1-a.pdf" },
    { id: "d2", file_path: "u1/assistant/2-b.xlsx" },
  ];
});

describe("deleteDocument", () => {
  it("borra el archivo y después la fila", async () => {
    await deleteDocument("d1", "u1/1-a.pdf");
    expect(h.remove).toHaveBeenCalledWith(["u1/1-a.pdf"]);
    expect(h.borrarFilas).toHaveBeenCalledTimes(1);
  });

  it("si Storage falla, avisa y deja la fila", async () => {
    h.remove.mockResolvedValue({ data: null, error: FALLO_STORAGE });
    await expect(deleteDocument("d1", "u1/1-a.pdf")).rejects.toBe(FALLO_STORAGE);
    expect(h.borrarFilas).not.toHaveBeenCalled();
  });
});

describe("deleteDocumentsByChat", () => {
  it("borra los archivos del chat y después sus filas", async () => {
    await deleteDocumentsByChat("c1");
    expect(h.remove).toHaveBeenCalledWith(["u1/1-a.pdf", "u1/assistant/2-b.xlsx"]);
    expect(h.borrarFilas).toHaveBeenCalledTimes(1);
  });

  it("si Storage falla, avisa y deja las filas", async () => {
    h.remove.mockResolvedValue({ data: null, error: FALLO_STORAGE });
    await expect(deleteDocumentsByChat("c1")).rejects.toBe(FALLO_STORAGE);
    expect(h.borrarFilas).not.toHaveBeenCalled();
  });
});

describe("uploadDocument", () => {
  const archivo = new File(["x"], "a b.pdf", { type: "application/pdf" });

  it("deja el archivo cuando la fila se crea", async () => {
    h.insert.mockResolvedValue({ data: { id: "d1" }, error: null });
    await expect(uploadDocument(archivo)).resolves.toEqual({ id: "d1" });
    expect(h.remove).not.toHaveBeenCalled();
  });

  it("si la fila no se crea, borra el archivo recién subido y avisa", async () => {
    const falloInsert = new Error("insert rechazado");
    h.insert.mockResolvedValue({ data: null, error: falloInsert });
    await expect(uploadDocument(archivo)).rejects.toBe(falloInsert);
    const [ruta] = h.upload.mock.calls[0];
    expect(ruta).toMatch(/^u1\/\d+-a_b\.pdf$/);
    expect(h.remove).toHaveBeenCalledWith([ruta]);
  });

  it("si la subida falla no intenta crear la fila", async () => {
    h.upload.mockResolvedValue({ error: FALLO_STORAGE });
    await expect(uploadDocument(archivo)).rejects.toBe(FALLO_STORAGE);
    expect(h.insert).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
  });
});
