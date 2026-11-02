import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Num, resumenInventario, revisionConteo, totalConteo } from "@/lib/control";
import { conteosDelParte, InventarioDia, ParteData, ParteRegistro, leerParte } from "@/lib/controlResumen";
import {
  Bloque,
  BotonSecundario,
  Caja,
  CabeceraTabla,
  Calculado,
  CampoNumero,
  CampoTexto,
  Celda,
  Chip,
  fmtCelda,
  tonoDe,
} from "./ui";

const uid = () => Math.random().toString(36).slice(2, 10);

const NOMBRES_CORTOS: Record<string, string> = {
  "Sábana personal": "Sáb. personal",
  "Sábana king": "Sáb. king",
  "Funda de almohada": "Funda",
  "Toalla de baño": "T. baño",
  "Toalla de mano": "T. mano",
  "Toalla alfombra": "T. alfombra",
  "Toalla facial": "T. facial",
  "Toalla de piscina": "T. piscina",
};
const corto = (n: string) => NOMBRES_CORTOS[n] ?? n;

const PasoInventario = ({
  fecha,
  parte,
  partesDelMes,
  prendas,
  ubicaciones,
  dotacion,
  pactadas,
  onChange,
  readOnly,
}: {
  fecha: string;
  parte: ParteData;
  /** Los partes del mes, sin el de hoy: de ellos sale el último conteo de cada casilla. */
  partesDelMes: ParteRegistro[];
  prendas: { id: string; nombre: string }[];
  ubicaciones: { id: string; nombre: string }[];
  dotacion: Record<string, Record<string, number>> | null;
  pactadas: Record<string, Num>;
  onChange: (inv: InventarioDia) => void;
  readOnly?: boolean;
}) => {
  const inv = parte.inventario;
  const [abierta, setAbierta] = useState<string | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  const idsPrenda = prendas.map((p) => p.id);
  const previos = partesDelMes.filter((p) => p.fecha < fecha).map((p) => ({ fecha: p.fecha, parte: leerParte(p.data) }));
  const extrasPrevias = previos.flatMap((p) => p.parte.inventario.extra);
  const todasUbicaciones = [
    ...ubicaciones,
    ...extrasPrevias.filter((e) => !ubicaciones.some((u) => u.id === e.id)),
    ...inv.extra.filter((e) => !extrasPrevias.some((x) => x.id === e.id) && !ubicaciones.some((u) => u.id === e.id)),
  ];
  const nombrePrenda = new Map(prendas.map((p) => [p.id, p.nombre]));

  const conteosPrevios = previos.flatMap((p) => conteosDelParte(p.fecha, p.parte));
  const anterior = resumenInventario(conteosPrevios, idsPrenda, [], {}).ultimoPorUbicacion;

  // Otros partes del mismo día (otra persona) también cuentan para la comparación.
  const delMismoDia = partesDelMes
    .filter((p) => p.fecha === fecha)
    .flatMap((p) => conteosDelParte(p.fecha, leerParte(p.data)));
  const resumen = resumenInventario(
    [...conteosPrevios, ...delMismoDia, ...conteosDelParte(fecha, parte)],
    idsPrenda,
    todasUbicaciones.map((u) => u.id),
    pactadas
  );

  const setCelda = (ubicacion: string, prenda: string, valor: Num) => {
    const fila = { ...(inv.conteos[ubicacion] ?? {}) };
    if (valor === null) delete fila[prenda];
    else fila[prenda] = valor;
    onChange({ ...inv, conteos: { ...inv.conteos, [ubicacion]: fila } });
  };

  const plantilla = "lg:grid-cols-[1.7fr_repeat(8,minmax(0,.72fr))_.72fr_.95fr]";

  // Las primeras visibles y las contadas hoy; el resto a un toque, para no obligar
  // a recorrer las 16 ubicaciones si hoy solo se ha contado una.
  const VISIBLES = 5;
  const conDatoHoy = (id: string) =>
    Object.values(inv.conteos[id] ?? {}).some((v) => typeof v === "number");
  const mostradas = verTodas
    ? todasUbicaciones
    : todasUbicaciones.filter((u, i) => i < VISIBLES || conDatoHoy(u.id) || u.id === abierta);
  const ocultas = todasUbicaciones.length - mostradas.length;

  return (
    <Bloque
      titulo="Inventario por ubicación"
      ayuda="En gris, el último conteo. Escribe solo lo que hayas contado hoy: vacío conserva el dato anterior y 0 confirma que no quedan piezas."
    >
      <CabeceraTabla
        plantilla={plantilla}
        columnas={["Ubicación", ...prendas.map((p) => corto(p.nombre)), "Total hoy", "Conteo"]}
      />

      {mostradas.map((u) => {
        const valores = inv.conteos[u.id] ?? {};
        const rev = revisionConteo({ valores }, idsPrenda);
        const total = totalConteo({ valores }, idsPrenda);
        const abiertaMovil = abierta === u.id;
        const esExtra = inv.extra.some((e) => e.id === u.id);
        return (
          <div key={u.id} className="rounded-xl bg-card/60 lg:bg-transparent p-2 lg:p-0">
            <div className={`grid gap-1.5 grid-cols-2 items-center lg:px-2.5 ${plantilla}`}>
              <div className="col-span-2 lg:col-span-1 flex items-center justify-between gap-2 min-w-0">
                {esExtra && !readOnly ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <CampoTexto
                      etiqueta="Nombre de la ubicación"
                      placeholder="Nombre de la ubicación"
                      value={u.nombre}
                      onChange={(nombre) =>
                        onChange({ ...inv, extra: inv.extra.map((e) => (e.id === u.id ? { ...e, nombre } : e)) })
                      }
                    />
                    <button
                      type="button"
                      aria-label={`Quitar ${u.nombre}`}
                      onClick={() => {
                        const { [u.id]: _c, ...conteos } = inv.conteos;
                        onChange({ ...inv, conteos, extra: inv.extra.filter((e) => e.id !== u.id) });
                      }}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAbierta(abiertaMovil ? null : u.id)}
                    className="flex items-center gap-1.5 text-sm font-bold text-left min-h-[40px] lg:min-h-0 lg:cursor-default min-w-0"
                  >
                    <ChevronDown
                      size={15}
                      className={`lg:hidden shrink-0 transition-transform ${abiertaMovil ? "rotate-180" : ""}`}
                    />
                    <span className="truncate">{u.nombre}</span>
                  </button>
                )}
                <span className="lg:hidden">
                  <Chip tono={rev === "Sin conteo" ? "gris" : tonoDe(rev)}>{rev}</Chip>
                </span>
              </div>
              {prendas.map((p) => {
                const previo = anterior[u.id]?.[p.id] ?? dotacion?.[u.id]?.[p.id];
                return (
                  <Celda key={p.id} label={p.nombre} className={abiertaMovil ? "" : "hidden lg:block"}>
                    <CampoNumero
                      etiqueta={`${u.nombre}, ${p.nombre}`}
                      value={typeof valores[p.id] === "number" ? valores[p.id] : null}
                      placeholder={previo !== undefined ? String(previo) : undefined}
                      readOnly={readOnly}
                      onChange={(x) => setCelda(u.id, p.id, x)}
                    />
                  </Celda>
                );
              })}
              <Celda label="Total hoy" className={abiertaMovil ? "" : "hidden lg:block"}>
                <Calculado>{total ?? "—"}</Calculado>
              </Celda>
              <div className="hidden lg:block">
                <Chip tono={rev === "Sin conteo" ? "gris" : tonoDe(rev)}>{rev}</Chip>
              </div>
            </div>
            {abiertaMovil && (
              <div className="mt-1.5 lg:hidden">
                <CampoTexto
                  etiqueta={`Acta u observación, ${u.nombre}`}
                  placeholder="Acta u observación"
                  value={inv.observaciones[u.id] ?? ""}
                  readOnly={readOnly}
                  onChange={(x) => onChange({ ...inv, observaciones: { ...inv.observaciones, [u.id]: x } })}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2.5">
        {ocultas > 0 && (
          <BotonSecundario onClick={() => setVerTodas(true)}>Ver las otras {ocultas} ubicaciones</BotonSecundario>
        )}
        {!readOnly && (
          <BotonSecundario
            onClick={() => {
              const id = uid();
              onChange({ ...inv, extra: [...inv.extra, { id, nombre: "" }] });
              setAbierta(id);
            }}
          >
            <Plus size={15} /> Añadir ubicación
          </BotonSecundario>
        )}
      </div>

      <Caja>
        <p className="text-sm font-bold">
          Existencia actual frente a las prendas pactadas{" "}
          <span className="font-medium text-muted-foreground">(salen de la dotación del hotel, no se teclean)</span>
        </p>
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid gap-1.5 polarier-head rounded-xl px-2.5 py-2 grid-cols-[1.7fr_.85fr_.95fr_.95fr_.8fr_.8fr_.8fr_.95fr_1.15fr]">
              {["Artículo", "Pactadas", "Primera exist.", "Exist. actual", "Variación", "Sobrantes", "Faltantes", "Ubicaciones", "Resultado"].map((c) => (
                <span key={c} className="text-[10.5px] font-extrabold leading-tight">
                  {c}
                </span>
              ))}
            </div>
            {resumen.articulos.map((a) => (
              <div
                key={a.prenda}
                className="grid gap-1.5 items-center px-2.5 py-1 text-[12.5px] font-bold tabular-nums grid-cols-[1.7fr_.85fr_.95fr_.95fr_.8fr_.8fr_.8fr_.95fr_1.15fr] border-b border-primary/10"
              >
                <span className="truncate">{nombrePrenda.get(a.prenda)}</span>
                <span>{fmtCelda(a.pactadas)}</span>
                <span>{fmtCelda(a.primera)}</span>
                <span>{fmtCelda(a.actual)}</span>
                <span>{typeof a.variacion === "number" && a.variacion > 0 ? `+${a.variacion}` : fmtCelda(a.variacion)}</span>
                <span>{fmtCelda(a.sobrantes)}</span>
                <span>{fmtCelda(a.faltantes)}</span>
                <span>
                  {a.ubicacionesConDato} de {a.ubicacionesTotal}
                </span>
                <span>
                  <Chip tono={a.resultado === "Conteo parcial" || a.resultado === "Sin datos" ? "gris" : tonoDe(a.resultado)}>
                    {a.resultado}
                  </Chip>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Caja>
    </Bloque>
  );
};

export default PasoInventario;
