import { describe, it, expect } from "vitest";
import { AUTOMATIZACIONES, getAutomatizacion, revisarArchivo } from "@/lib/automatizaciones";

describe("catálogo de automatizaciones", () => {
  it("no repite slugs ni paths de webhook", () => {
    const slugs = AUTOMATIZACIONES.map((a) => a.slug);
    const paths = AUTOMATIZACIONES.map((a) => a.webhookPath);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("cada automatización trae lo que la página necesita contar", () => {
    for (const a of AUTOMATIZACIONES) {
      expect(a.nombre).toBeTruthy();
      expect(a.descripcion).toBeTruthy();
      expect(a.queSube).toBeTruthy();
      expect(a.queRecibe).toBeTruthy();
      // La mensual (informe del Consejo) no sube fichero: no tiene extensiones ni ejemplos.
      if (a.modo === "mensual") continue;
      expect(a.extensiones.length).toBeGreaterThan(0);
      expect(a.ejemplos.length).toBeGreaterThan(0);
      // Las extensiones se comparan tal cual contra el final del nombre.
      for (const ext of a.extensiones) expect(ext).toBe(ext.toLowerCase());
    }
  });

  it("los ejemplos de cada una pasan su propia revisión", () => {
    for (const a of AUTOMATIZACIONES) {
      for (const ejemplo of a.ejemplos) {
        expect(revisarArchivo(a, ejemplo), `${a.slug} · ${ejemplo}`).toEqual({});
      }
    }
  });
});

describe("revisarArchivo", () => {
  const modelo1 = getAutomatizacion("modelo-1")!;
  const tablaCa = getAutomatizacion("tabla-ca")!;

  it("rechaza una extensión que la rama no procesa", () => {
    const { error } = revisarArchivo(modelo1, "HOCP202610.docx");
    expect(error).toContain("Modelo 1");
  });

  it("deja pasar con aviso un nombre raro pero con la extensión correcta", () => {
    const { error, aviso } = revisarArchivo(modelo1, "octubre.pdf");
    expect(error).toBeUndefined();
    expect(aviso).toContain("octubre.pdf");
  });

  it("acepta los nombres que Switch3 enruta a Modelo 1", () => {
    for (const nombre of ["CXCP202610.pdf", "VAM-1 octubre.pdf", "HOMODELO1.pdf", "lote.ZIP"]) {
      expect(revisarArchivo(modelo1, nombre).aviso, nombre).toBeUndefined();
    }
  });

  it("acepta el CD, que es lo que se manda, y también el prefijo CA", () => {
    expect(revisarArchivo(tablaCa, "CACD202504.xlsx").aviso).toBeUndefined();
    expect(revisarArchivo(tablaCa, "VACA202512.xlsx").aviso).toBeUndefined();
  });

  it("avisa si el CD no lleva año y mes", () => {
    expect(revisarArchivo(tablaCa, "caibarien.xlsx").aviso).toBeTruthy();
  });
});

describe("Informe Consejo de Dirección en el catálogo", () => {
  const consejo = getAutomatizacion("informe-consejo")!;

  it("va por meses y es asíncrono: no sube fichero, la rama cierra el informe por su cuenta", () => {
    expect(consejo.modo).toBe("mensual");
    expect(consejo.asincrona).toBe(true);
    expect(consejo.extensiones).toEqual([]);
  });
});
