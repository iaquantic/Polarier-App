import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Num, revisionConteo, totalConteo } from "@/lib/control";
import { leerParte } from "@/lib/controlResumen";
import {
  ColHoja,
  COLS_PACTADAS,
  FILAS,
  filaInventario,
  LETRAS_PRENDAS,
  normalizar,
  PRENDAS_HOJA,
  repartirUbicaciones,
  textoDeFecha,
  uid,
} from "@/lib/controlHojas";
import TablaHoja, { CambioTabla, FilaTabla, Mini, Nota, Subtitulo } from "./TablaHoja";
import { FiltroFecha, Metricas, PropsHoja } from "./HojasDetalle";

interface MetaFila {
  fecha: string;
  ubicacion: string;
  /** Posición entre las filas libres de ese día; `null` en las fijas. */
  libre: number | null;
}

/** Hoja Inventario: 14 filas por día, las ubicaciones fijas y las libres, como en el Excel. */
export const HojaInventario = ({ libro, fechaFiltro, onFechaFiltro }: PropsHoja) => {
  const { prendas: catalogoPrendas, ubicaciones, dotacion, def } = libro.datos;
  // Por día, lo elegido en cada fila libre antes de que tenga ningún conteo.
  const [elegidas, setElegidas] = useState<Record<string, string[]>>({});
  const [huecos, setHuecos] = useState<Record<string, number>>({});
  const [otra, setOtra] = useState("");

  const { fijas, libres } = useMemo(
    () => repartirUbicaciones(ubicaciones, def?.config?.ubicaciones_hoja),
    [def?.config?.ubicaciones_hoja, ubicaciones]
  );

  // Las columnas C a J son las prendas de la hoja, en su orden.
  const prendas = useMemo(() => {
    const porNombre = new Map(catalogoPrendas.map((p) => [normalizar(p.nombre), p]));
    const enOrden = PRENDAS_HOJA.map((n) => porNombre.get(normalizar(n))).filter(Boolean);
    return enOrden.length === catalogoPrendas.length ? enOrden : catalogoPrendas;
  }, [catalogoPrendas]);
  const idsPrenda = useMemo(() => prendas.map((p) => p.id), [prendas]);

  const columnas: ColHoja[] = useMemo(
    () => [
      { letra: "A", titulo: "Fecha", key: "fecha", tipo: "calc", ancho: 96 },
      { letra: "B", titulo: "Ubicación", key: "ubicacion", tipo: "ref", ancho: 190 },
      ...prendas.map(
        (p, i): ColHoja => ({ letra: LETRAS_PRENDAS[i] ?? "", titulo: p.nombre, key: `p:${p.id}`, tipo: "entero", ancho: 76, der: true })
      ),
      { letra: "K", titulo: "Total piezas", key: "total", tipo: "calc", ancho: 76, der: true, dec: 0 },
      { letra: "L", titulo: "Acta / observación", key: "observacion", tipo: "texto", ancho: 190 },
      { letra: "M", titulo: "Revisión del conteo", key: "revision", tipo: "calc", ancho: 110 },
    ],
    [prendas]
  );

  // Lo de otra persona se ve pero no se toca.
  const ajenosPorDia = useMemo(() => {
    const m = new Map<string, ReturnType<typeof leerParte>["inventario"][]>();
    for (const s of libro.ajenos) m.set(s.fecha, [...(m.get(s.fecha) ?? []), leerParte(s.data).inventario]);
    return m;
  }, [libro.ajenos]);

  const fuenteDe = (fecha: string) => {
    const propio = libro.inventarios[fecha] ?? { conteos: {}, observaciones: {}, extra: [] };
    if (libro.diaEditable(fecha) || !ajenosPorDia.has(fecha)) return propio;
    const conteos: Record<string, Record<string, Num>> = {};
    const observaciones: Record<string, string> = {};
    const extra = [...propio.extra];
    for (const inv of ajenosPorDia.get(fecha)) {
      for (const [u, f] of Object.entries(inv.conteos)) conteos[u] = { ...(conteos[u] ?? {}), ...f };
      Object.assign(observaciones, inv.observaciones);
      extra.push(...inv.extra);
    }
    return { conteos, observaciones, extra };
  };

  // En gris, el último conteo de cada casilla antes de ese día, o la dotación si aún no hay.
  const historial = useMemo(() => {
    const h = new Map<string, { fecha: string; v: number }[]>();
    const anotar = (fecha: string, conteos: Record<string, Record<string, Num>>) => {
      for (const [u, fila] of Object.entries(conteos)) {
        for (const [p, v] of Object.entries(fila ?? {})) {
          if (typeof v !== "number") continue;
          const k = `${u}|${p}`;
          h.set(k, [...(h.get(k) ?? []), { fecha, v }]);
        }
      }
    };
    for (const [fecha, inv] of Object.entries(libro.inventarios)) anotar(fecha, inv.conteos);
    for (const [fecha, invs] of ajenosPorDia) for (const inv of invs) anotar(fecha, inv.conteos);
    for (const lista of h.values()) lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return h;
  }, [ajenosPorDia, libro.inventarios]);

  const sugerencia = (fecha: string, ubicacion: string, prenda: string): string | undefined => {
    const previos = (historial.get(`${ubicacion}|${prenda}`) ?? []).filter((x) => x.fecha < fecha);
    const v = previos.length ? previos[previos.length - 1].v : dotacion?.[ubicacion]?.[prenda];
    return typeof v === "number" ? String(v) : undefined;
  };

  const dias = useMemo(() => {
    const todos = Array.from({ length: libro.rango.dias }, (_, i) => i + 1);
    return fechaFiltro ? todos.filter((d) => Number(fechaFiltro.slice(8)) === d) : todos;
  }, [fechaFiltro, libro.rango.dias]);

  const { filas, metas } = useMemo(() => {
    const filas: FilaTabla[] = [];
    const metas: MetaFila[] = [];
    const posLibres = FILAS.inventario.conteos - fijas.length;
    for (const dia of dias) {
      const fecha = `${libro.rango.primerDia.slice(0, 8)}${String(dia).padStart(2, "0")}`;
      const fuente = fuenteDe(fecha);
      const bloqueada = !libro.diaEditable(fecha);
      const conDatos = Object.entries(fuente.conteos)
        .filter(([id, f]) => !fijas.some((u) => u.id === id) && Object.values(f ?? {}).some((v) => typeof v === "number"))
        .map(([id]) => id);
      const nombreLibre = new Map([...libres, ...fuente.extra].map((u) => [u.id, u.nombre]));
      const lista = Array.from(new Set([...(elegidas[fecha] ?? []), ...conDatos]));
      const numLibres = Math.max(posLibres, lista.length) + (huecos[fecha] ?? 0);

      const fila = (ubicacion: string, nombre: string, pos: number, libre: number | null) => {
        const valoresU = fuente.conteos[ubicacion] ?? {};
        const conteo = { valores: valoresU };
        const valores: Record<string, unknown> = {
          fecha: textoDeFecha(fecha),
          ubicacion: nombre,
          total: totalConteo(conteo, idsPrenda),
          observacion: fuente.observaciones[ubicacion] ?? "",
          revision: ubicacion || Object.keys(valoresU).length ? revisionConteo(conteo, idsPrenda) : "",
        };
        const sugerencias: Record<string, string> = {};
        for (const id of idsPrenda) {
          valores[`p:${id}`] = valoresU[id] ?? null;
          if (ubicacion) {
            const s = sugerencia(fecha, ubicacion, id);
            if (s !== undefined) sugerencias[`p:${id}`] = s;
          }
        }
        filas.push({
          id: `${fecha}|${libre === null ? ubicacion : `L${libre}`}`,
          numero: pos < FILAS.inventario.conteos ? filaInventario(dia, pos) : "",
          bloqueada,
          valores,
          sugerencias,
          ...(libre === null
            ? {}
            : {
                tipos: { ubicacion: "lista" as const },
                opciones: {
                  ubicacion: Array.from(
                    new Set([
                      ...libres.map((u) => u.nombre),
                      ...lista.map((id) => nombreLibre.get(id)).filter(Boolean),
                    ])
                  ).filter((n) => n === nombre || !lista.some((id) => nombreLibre.get(id) === n)),
                },
              }),
        });
        metas.push({ fecha, ubicacion, libre });
      };

      fijas.forEach((u, pos) => fila(u.id, u.nombre, pos, null));
      for (let i = 0; i < numLibres; i++) {
        const id = lista[i] ?? "";
        fila(id, id ? (nombreLibre.get(id) ?? "") : "", fijas.length + i, i);
      }
    }
    return { filas, metas };
    // `fuenteDe` y `sugerencia` solo dependen de lo que está en la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajenosPorDia, dias, elegidas, fijas, historial, huecos, idsPrenda, libres, libro.diaEditable, libro.inventarios, libro.rango.primerDia]);

  const alCambiar = (cambios: CambioTabla[]) => {
    const aplicar: Parameters<typeof libro.editarInventarios>[0] = [];
    for (const c of cambios) {
      const meta = metas[c.fila];
      if (!meta) continue;
      if (c.key === "ubicacion") {
        if (meta.libre === null) continue;
        const fuente = fuenteDe(meta.fecha);
        const u = [...libres, ...fuente.extra].find((x) => x.nombre === c.valor);
        const previa = filas[c.fila].valores;
        if (meta.ubicacion && Object.values(fuente.conteos[meta.ubicacion] ?? {}).some((v) => typeof v === "number")) {
          toast.error(`Esta fila ya tiene conteos de ${String(previa.ubicacion)}: bórralos antes de cambiarla de ubicación.`);
          continue;
        }
        const base = [...(elegidas[meta.fecha] ?? [])];
        const lista = Array.from(new Set([...base, ...Object.keys(fuente.conteos).filter((id) => !fijas.some((x) => x.id === id) && Object.values(fuente.conteos[id] ?? {}).some((v) => typeof v === "number"))]));
        lista[meta.libre] = u?.id ?? "";
        setElegidas((e) => ({ ...e, [meta.fecha]: lista.filter(Boolean) }));
        continue;
      }
      if (!meta.ubicacion) {
        toast.error("Elige antes la ubicación de esta fila.");
        continue;
      }
      if (c.key === "observacion") {
        aplicar.push({ fecha: meta.fecha, ubicacion: meta.ubicacion, observacion: String(c.valor ?? "") });
      } else if (c.key.startsWith("p:")) {
        aplicar.push({ fecha: meta.fecha, ubicacion: meta.ubicacion, prenda: c.key.slice(2), valor: c.valor as Num });
      }
    }
    if (aplicar.length) libro.editarInventarios(aplicar);
  };

  const fechaActual = fechaFiltro;
  const anadirOtra = () => {
    const nombre = otra.trim();
    if (!nombre || !fechaActual) return;
    const existente = [...libres, ...fuenteDe(fechaActual).extra].find((u) => normalizar(u.nombre) === normalizar(nombre));
    const id = existente?.id ?? `extra-${uid()}`;
    if (!existente) {
      libro.editarInventarios([{ fecha: fechaActual, ubicacion: id, extra: { id, nombre } }]);
    }
    setElegidas((e) => ({ ...e, [fechaActual]: [...(e[fechaActual] ?? []), id] }));
    setOtra("");
  };

  const r = libro.resumen?.inventario;

  return (
    <>
      <div className="hx-acciones">
        <FiltroFecha libro={libro} valor={fechaFiltro} onChange={onFechaFiltro} />
        <Mini
          disabled={!fechaActual || !libro.diaEditable(fechaActual)}
          onClick={() => fechaActual && setHuecos((h) => ({ ...h, [fechaActual]: (h[fechaActual] ?? 0) + 1 }))}
        >
          + Fila libre en este día
        </Mini>
        <label className="hx-mini">
          Otra ubicación:&nbsp;
          <input
            aria-label="Nombre de otra ubicación"
            value={otra}
            disabled={!fechaActual || !libro.diaEditable(fechaActual)}
            onChange={(e) => setOtra(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") anadirOtra();
            }}
          />
        </label>
        <Mini disabled={!otra.trim() || !fechaActual} onClick={anadirOtra}>
          Añadir
        </Mini>
      </div>
      <div className="hx-bloques">
        <Metricas
          items={[
            { t: "Último dato", v: textoDeFecha(r?.ultimoDato) },
            { t: "Ubicaciones", v: r?.ubicaciones },
            { t: "Estado", v: r?.estado },
          ]}
        />
        <div>
          <TablaHoja
            nombre="Inventario"
            columnas={columnas}
            filas={filas}
            fija={0}
            alto="62vh"
            rellenar={false}
            anio={libro.anio}
            onCambios={alCambiar}
            onRechazo={(m) => toast.error(m)}
          />
          <Nota>
            {libres.length > 0
              ? `Ubicaciones fijas y filas libres por día, como en el Excel. En las libres se eligen las de la dotación que la hoja no trae: ${libres.map((u) => u.nombre).join(", ")}.`
              : "Una fila por ubicación y día."}{" "}
            En gris, el último conteo. Vacío conserva el dato anterior y 0 confirma que no quedan piezas.
          </Nota>
        </div>
        <div>
          <Subtitulo>Existencia actual y comparación con las prendas pactadas</Subtitulo>
          <TablaHoja
            nombre="Prendas pactadas"
            columnas={COLS_PACTADAS}
            filas={(r?.articulos ?? []).map((a, i) => ({
              id: a.prenda,
              numero: FILAS.pactadas.desde + i,
              valores: {
                prenda: a.prenda,
                pactadas: a.pactadas,
                primera: a.primera,
                actual: a.actual,
                variacion: a.variacion,
                sobrantes: a.sobrantes,
                faltantes: a.faltantes,
                ubicaciones: `${a.ubicacionesConDato} de ${a.ubicacionesTotal}`,
                primer: textoDeFecha(a.primerDato),
                ultimo: textoDeFecha(a.ultimoDato),
                resultado: a.resultado,
              },
            }))}
            fija={0}
            rellenar={false}
          />
          <Nota>Las pactadas salen de la dotación del hotel y aquí no se editan. Si un Excel trae otras, se avisa y no se cambian.</Nota>
        </div>
      </div>
    </>
  );
};
