import { describe, expect, it, vi } from "vitest";
import { construirInformePdf } from "@/lib/informePdf";
import type { Informe } from "@/lib/informe";
import { buildInformeMensual } from "@/lib/informeMensual";
import type { MonthlyReport } from "@/services/audit";

const largo = Array.from({ length: 12 }, (_, i) =>
  `**Sección ${i + 1}**\n\n` + "Texto de relleno bastante largo para forzar varias líneas y algún salto de página. ".repeat(6)
).join("\n\n");

const rep = {
  id: "r", hotel_id: "h", user_id: "u", anio: 2026, mes: 8, estado: "listo",
  resumen: { analisis: "## Título\n\n" + largo, valoraciones: ["Una.", "Dos.", "Tres."] },
  metricas: { totalPartes: 4, diasConParte: 4, diasMes: 31, porFormulario: [{ tipo: "lenceria", partes: 1, total: 0, kg: 0 }] },
  generado_at: null, solicitado_at: null, created_at: "", updated_at: "",
} as unknown as MonthlyReport;

// Nota: en jsdom la imagen del logo no dispara onload/onerror, así que este test
// espera al temporizador de `cargarLogo` (3 s) y sale con el PDF sin logo. Eso es
// justo lo que se quiere comprobar: que no se cuelga.
describe("PDF del informe mensual", () => {
  it("se construye y pagina sin romperse", async () => {
    const informe = buildInformeMensual({ reporte: rep, hotel: "Gran Muthu Habana", polo: "La Habana" })!;
    const doc = await construirInformePdf(informe);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(doc.output("datauristring")).toContain("base64,");
  });
});

// Sin carga de imágenes, para no esperar el temporizador del logo en cada vuelta.
class ImagenRota {
  onerror?: () => void;
  set src(_v: string) {
    this.onerror?.();
  }
}

describe("Cortes de página del PDF", () => {
  it("el título de una tabla nunca se queda solo al pie", async () => {
    vi.stubGlobal("Image", ImagenRota);
    for (let filas = 1; filas <= 45; filas++) {
      const informe: Informe = {
        titulo: "T",
        hotel: "H",
        fechaLabel: "F",
        estado: "E",
        campos: [],
        tablas: [
          { titulo: "Relleno", columnas: ["A"], filas: Array.from({ length: filas }, () => ["x"]) },
          { titulo: "TITULOB", columnas: ["CABECERAB"], filas: [["y"]] },
        ],
      };
      const doc = await construirInformePdf(informe);
      const paginas = Array.from((doc.internal as unknown as { pages: string[][] }).pages, (p) => (p ?? []).join(" "));
      const conTitulo = paginas.findIndex((p) => p.includes("(TITULOB)"));
      expect(paginas[conTitulo], `${filas} filas`).toContain("(CABECERAB)");
    }
    vi.unstubAllGlobals();
  });
});
