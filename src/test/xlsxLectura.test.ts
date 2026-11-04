import { strToU8 as aBytes, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { leerFecha, leerHora, leerModeloMensual, leerNumero, leerTexto } from "@/lib/controlExcel";
import { abrirXlsx } from "@/lib/xlsxLectura";
import { libroBase } from "./fixtures/libroModelo";

// En jsdom, TextEncoder da un Uint8Array de otro «realm» y fflate no lo reconoce.
const strToU8 = (s: string) => Uint8Array.from(aBytes(s));

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const NS_R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const NS_REL = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
const T = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** Un .xlsx a mano: lo justo para probar cada forma de guardar una casilla. */
const paquete = (opciones: { rutasAbsolutas?: boolean; workbookPr?: string; prefijo?: boolean; hojaXml?: string } = {}) => {
  const destino = (r: string) => (opciones.rutasAbsolutas ? `/xl/${r}` : r);
  const hoja =
    opciones.hojaXml ??
    `<worksheet ${NS}><sheetData>
      <row r="1">
        <c r="A1" t="s"><v>0</v></c>
        <c r="B1" t="s"><v>1</v></c>
        <c r="C1" t="inlineStr"><is><t>En línea</t></is></c>
        <c r="D1" t="str"><f>A1</f><v>Calculado</v></c>
        <c r="E1" t="b"><v>1</v></c>
        <c r="F1" t="e"><v>#REF!</v></c>
        <c r="G1"><f>1+1</f><v>2</v></c>
        <c r="H1"><v>92.7</v></c>
        <c r="I1" s="1"><v>46328</v></c>
        <c r="J1" s="2"><v>0.34027777777777779</v></c>
        <c r="K1" s="3"><v>46328.5</v></c>
        <c r="L1" s="4"><v>0.0625</v></c>
        <c r="M1" s="5"><v>1500</v></c>
      </row>
      <row r="3"><c t="inlineStr"><is><t>sin r</t></is></c><c><v>7</v></c></row>
    </sheetData></worksheet>`;
  return zipSync({
    "_rels/.rels": strToU8(`<Relationships ${NS_REL}><Relationship Id="rId1" Type="${T}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<workbook ${NS} ${NS_R}>${opciones.workbookPr ?? ""}<sheets><sheet name="Hoja uno" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships ${NS_REL}>
        <Relationship Id="rId1" Type="${T}/worksheet" Target="${destino("worksheets/sheet1.xml")}"/>
        <Relationship Id="rId2" Type="${T}/sharedStrings" Target="${destino("sharedStrings.xml")}"/>
        <Relationship Id="rId3" Type="${T}/styles" Target="${destino("styles.xml")}"/>
      </Relationships>`
    ),
    "xl/sharedStrings.xml": strToU8(
      `<sst ${NS}><si><t>Hola</t></si><si><r><t>Texto </t></r><r><t>enriquecido</t></r><rPh sb="0" eb="1"><t>guía</t></rPh></si></sst>`
    ),
    "xl/styles.xml": strToU8(
      `<styleSheet ${NS}>
        <numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="[$-409]h:mm;@"/></numFmts>
        <cellXfs count="6"><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="165"/><xf numFmtId="22"/><xf numFmtId="20"/><xf numFmtId="3"/></cellXfs>
      </styleSheet>`
    ),
    "xl/worksheets/sheet1.xml": strToU8(hoja),
  });
};

describe("abrirXlsx", () => {
  it("lee cada forma de guardar una casilla", () => {
    const l = abrirXlsx(paquete());
    expect(l.hojas).toEqual(["Hoja uno"]);
    const c = (r: string) => l.celda("Hoja uno", r);
    expect(c("A1")).toBe("Hola");
    expect(c("B1")).toBe("Texto enriquecido");
    expect(c("C1")).toBe("En línea");
    expect(c("D1")).toBe("Calculado");
    expect(c("E1")).toBe(true);
    expect(c("F1")).toBeNull();
    expect(c("G1")).toBe(2);
    expect(c("H1")).toBe(92.7);
    expect(c("M1")).toBe(1500);
    expect(c("Z9")).toBeNull();
    expect(l.celda("Otra", "A1")).toBeNull();
  });

  it("reconoce fechas y horas por su formato, y no se corren de día", () => {
    const l = abrirXlsx(paquete());
    expect(leerFecha(l.celda("Hoja uno", "I1"))).toBe("2026-11-02");
    expect(leerTexto(l.celda("Hoja uno", "I1"))).toBe("02/11/2026");
    expect(leerHora(l.celda("Hoja uno", "J1"))).toBe("08:10");
    expect(leerFecha(l.celda("Hoja uno", "K1"))).toBe("2026-11-02");
    // 1:30 tecleado en una casilla de horas es 1,5, no 0,0625.
    expect(leerNumero(l.celda("Hoja uno", "L1"), true)).toBe(1.5);
    // Y una hora no pasa por una fecha.
    expect(leerFecha(l.celda("Hoja uno", "J1"))).toBeNull();
  });

  it("entiende las casillas sin referencia", () => {
    const l = abrirXlsx(paquete());
    expect(l.celda("Hoja uno", "A3")).toBe("sin r");
    expect(l.celda("Hoja uno", "B3")).toBe(7);
  });

  it("abre los archivos con rutas absolutas, como los que guardan otros programas", () => {
    const l = abrirXlsx(paquete({ rutasAbsolutas: true }));
    expect(l.celda("Hoja uno", "A1")).toBe("Hola");
  });

  it("entiende el XML con prefijo de espacio de nombres", () => {
    const l = abrirXlsx(
      paquete({
        hojaXml: `<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="2"><x:c r="B2"><x:v>5</x:v></x:c></x:row></x:sheetData></x:worksheet>`,
      })
    );
    expect(l.celda("Hoja uno", "B2")).toBe(5);
  });

  it("rechaza el calendario de 1904 en vez de correr todas las fechas cuatro años", () => {
    expect(() => abrirXlsx(paquete({ workbookPr: '<workbookPr date1904="1"/>' }))).toThrow(/1904/);
  });

  it("falla con lo que no es un .xlsx", () => {
    expect(() => abrirXlsx(strToU8("esto no es un zip"))).toThrow();
  });

  it("un libro sin las hojas del modelo se rechaza con su mensaje", () => {
    expect(leerModeloMensual(abrirXlsx(paquete())).errores[0]).toMatch(/no es el Modelo Mensual/);
  });

  it("lee un Modelo Mensual entero al pasar por el archivo", () => {
    const celdas = libroBase();
    const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const hojas = Object.keys(celdas);
    const celda = (ref: string, v: unknown) =>
      typeof v === "number" ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${escapar(String(v))}</t></is></c>`;
    const columna = (ref: string) => ref.replace(/\d+$/, "").split("").reduce((a, x) => a * 26 + x.charCodeAt(0) - 64, 0);
    const xmlHoja = (c: Record<string, unknown>) => {
      const filas = new Map<number, [string, unknown][]>();
      for (const [ref, v] of Object.entries(c)) {
        const n = Number(ref.replace(/^\D+/, ""));
        filas.set(n, [...(filas.get(n) ?? []), [ref, v]]);
      }
      const cuerpo = [...filas.keys()]
        .sort((a, b) => a - b)
        .map((n) => `<row r="${n}">${filas.get(n).sort((a, b) => columna(a[0]) - columna(b[0])).map(([r, v]) => celda(r, v)).join("")}</row>`)
        .join("");
      return `<worksheet ${NS}><sheetData>${cuerpo}</sheetData></worksheet>`;
    };
    celdas.Lavado_detalle.A11 = 46328;
    celdas.Lavado_detalle.C11 = "V&1";
    celdas.Lavado_detalle.H11 = 92.7;
    const archivos: Record<string, Uint8Array> = {
      "_rels/.rels": strToU8(`<Relationships ${NS_REL}><Relationship Id="rId1" Type="${T}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
      "xl/workbook.xml": strToU8(`<workbook ${NS} ${NS_R}><sheets>${hojas.map((h, i) => `<sheet name="${h}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8(`<Relationships ${NS_REL}>${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${T}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`),
    };
    hojas.forEach((h, i) => {
      archivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(xmlHoja(celdas[h]));
    });
    const libro = leerModeloMensual(abrirXlsx(zipSync(archivos)));
    expect(libro.errores).toEqual([]);
    expect(libro.anio).toBe(2026);
    expect(libro.lavado[0].valor).toMatchObject({ fecha: "2026-11-02", vale: "V&1", kg: 92.7 });
  });
});
