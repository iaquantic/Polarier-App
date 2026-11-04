// -----------------------------------------------------------------------------
// Lectura de un .xlsx, y nada más: valores de casillas, sin fórmulas ni formatos.
//
// Un .xlsx es un zip de XML y aquí solo hace falta `<c>`: no se interpreta nada de lo
// demás (tablas, formato condicional, validaciones), que es lo que hace fallar a otras
// librerías según qué programa guardó el archivo.
// -----------------------------------------------------------------------------
import { strFromU8, unzipSync } from "fflate";
import type { LectorExcel } from "@/lib/controlExcel";

const MS_DIA = 86400000;
const EPOCA = Date.UTC(1899, 11, 30);

/** De una fórmula de Excel se lee el último valor calculado; un error cuenta como vacío. */
type Valor = string | number | boolean | Date | null;

const hijos = (padre: Element, nombre: string): Element[] =>
  Array.from(padre.getElementsByTagNameNS("*", nombre));

const hijoDirecto = (padre: Element, nombre: string): Element | undefined =>
  Array.from(padre.children).find((c) => c.localName === nombre);

/** Formatos de número internos de Excel que son fechas u horas. */
const FECHAS_INTERNAS = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 34, 35, 36, 50, 51, 52, 53, 54, 57, 58]);
const HORAS_INTERNAS = new Set([18, 19, 20, 21, 32, 33, 45, 46, 47]);

type Tiempo = "fecha" | "hora" | null;

const tiempoDeCodigo = (codigo: string): Tiempo => {
  // Fuera lo que va entre comillas y corchetes, y las secciones de color.
  const c = codigo.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "").toLowerCase();
  if (/[yd]/.test(c)) return "fecha";
  if (/[hs]/.test(c)) return "hora";
  return null;
};

const leerEstilos = (doc: Document | null): Tiempo[] => {
  if (!doc) return [];
  const propios = new Map<number, Tiempo>();
  for (const n of hijos(doc.documentElement, "numFmt")) {
    propios.set(Number(n.getAttribute("numFmtId")), tiempoDeCodigo(n.getAttribute("formatCode") ?? ""));
  }
  const xfs = hijos(doc.documentElement, "cellXfs")[0];
  if (!xfs) return [];
  return Array.from(xfs.children)
    .filter((x) => x.localName === "xf")
    .map((x) => {
      const id = Number(x.getAttribute("numFmtId") ?? 0);
      if (propios.has(id)) return propios.get(id);
      if (FECHAS_INTERNAS.has(id)) return "fecha";
      if (HORAS_INTERNAS.has(id)) return "hora";
      return null;
    });
};

/** Texto de un `<si>` o `<is>`, sin la guía fonética (`<rPh>`). */
const textoDe = (el: Element): string =>
  hijos(el, "t")
    .filter((t) => t.parentElement?.localName !== "rPh")
    .map((t) => t.textContent ?? "")
    .join("");

const letraAColumna = (c: string): number => c.split("").reduce((a, x) => a * 26 + x.charCodeAt(0) - 64, 0);

const columnaALetra = (n: number): string => {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - m - 1) / 26);
  }
  return s;
};

const rutaDe = (base: string, destino: string): string => {
  if (destino.startsWith("/")) return destino.slice(1);
  const partes = base.split("/").slice(0, -1);
  for (const p of destino.split("/")) {
    if (p === "..") partes.pop();
    else if (p !== ".") partes.push(p);
  }
  return partes.join("/");
};

/** Abre el archivo. Lanza si no es un .xlsx legible: un Excel con contraseña no es un zip. */
export const abrirXlsx = (datos: Uint8Array): LectorExcel => {
  const zip = unzipSync(datos, { filter: (f) => /\.(xml|rels)$/i.test(f.name) });
  const parser = new DOMParser();
  const xml = (ruta: string): Document | null => {
    const parte = zip[ruta];
    if (!parte) return null;
    const doc = parser.parseFromString(strFromU8(parte), "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error(`XML no válido en ${ruta}`);
    return doc;
  };

  // El libro: normalmente xl/workbook.xml, pero lo dice el paquete.
  const raiz = xml("_rels/.rels");
  const relLibro = raiz && hijos(raiz.documentElement, "Relationship").find((r) => /\/officeDocument$/.test(r.getAttribute("Type") ?? ""));
  const rutaLibro = relLibro ? rutaDe("", relLibro.getAttribute("Target") ?? "") : "xl/workbook.xml";
  const libro = xml(rutaLibro);
  if (!libro) throw new Error("No hay libro en el archivo");

  const pr = hijos(libro.documentElement, "workbookPr")[0];
  if (["1", "true"].includes(pr?.getAttribute("date1904") ?? "")) {
    throw new Error("Este Excel usa el calendario de 1904. Desactívalo en las opciones de Excel y vuelve a guardarlo.");
  }

  const rutaRels = `${rutaLibro.split("/").slice(0, -1).join("/")}/_rels/${rutaLibro.split("/").pop()}.rels`;
  const rels = new Map<string, string>();
  const relsDoc = xml(rutaRels);
  if (relsDoc) {
    for (const r of hijos(relsDoc.documentElement, "Relationship")) {
      rels.set(r.getAttribute("Id") ?? "", rutaDe(rutaLibro, r.getAttribute("Target") ?? ""));
    }
  }

  const hojas = new Map<string, string>();
  for (const s of hijos(libro.documentElement, "sheet")) {
    const id = s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? s.getAttribute("r:id");
    const ruta = rels.get(id ?? "");
    if (ruta) hojas.set(s.getAttribute("name") ?? "", ruta);
  }

  const rutaPorTipo = (tipo: RegExp): string | undefined => {
    if (!relsDoc) return undefined;
    const r = hijos(relsDoc.documentElement, "Relationship").find((x) => tipo.test(x.getAttribute("Type") ?? ""));
    return r ? rutaDe(rutaLibro, r.getAttribute("Target") ?? "") : undefined;
  };

  const docCadenas = xml(rutaPorTipo(/\/sharedStrings$/) ?? "xl/sharedStrings.xml");
  const cadenas = docCadenas ? hijos(docCadenas.documentElement, "si").map(textoDe) : [];
  const tiempos = leerEstilos(xml(rutaPorTipo(/\/styles$/) ?? "xl/styles.xml"));

  const leerCelda = (c: Element): Valor => {
    const tipo = c.getAttribute("t") ?? "n";
    if (tipo === "inlineStr") {
      const is = hijoDirecto(c, "is");
      return is ? textoDe(is) : null;
    }
    const v = hijoDirecto(c, "v")?.textContent ?? null;
    if (v === null || v === "") return null;
    if (tipo === "s") return cadenas[Number(v)] ?? null;
    if (tipo === "str") return v;
    if (tipo === "b") return v === "1";
    if (tipo === "e") return null;
    if (tipo === "d") return new Date(v);
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const tiempo = tiempos[Number(c.getAttribute("s") ?? -1)];
    if (tiempo === "fecha" && n >= 1) return new Date(EPOCA + Math.round(n * MS_DIA));
    // Una hora se da como un instante de 1899: nadie la confundirá con una fecha.
    if (tiempo === "hora" || tiempo === "fecha") return new Date(EPOCA + Math.round((n - Math.floor(n)) * MS_DIA));
    return n;
  };

  const cache = new Map<string, Map<string, Valor>>();
  const hoja = (nombre: string): Map<string, Valor> | null => {
    const hecha = cache.get(nombre);
    if (hecha) return hecha;
    const ruta = hojas.get(nombre);
    const doc = ruta ? xml(ruta) : null;
    if (!doc) return null;
    const celdas = new Map<string, Valor>();
    let fila = 0;
    for (const f of hijos(doc.documentElement, "row")) {
      fila = Number(f.getAttribute("r") ?? fila + 1);
      let columna = 0;
      for (const c of Array.from(f.children)) {
        if (c.localName !== "c") continue;
        const ref = c.getAttribute("r");
        // `r` es opcional: sin él, la casilla es la siguiente a la anterior.
        columna = ref ? letraAColumna(ref.replace(/\d+$/, "")) : columna + 1;
        const valor = leerCelda(c);
        if (valor !== null) celdas.set(`${columnaALetra(columna)}${fila}`, valor);
      }
    }
    cache.set(nombre, celdas);
    return celdas;
  };

  return {
    hojas: Array.from(hojas.keys()),
    celda: (nombre, ref) => hoja(nombre)?.get(ref) ?? null,
  };
};
