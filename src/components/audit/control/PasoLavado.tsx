import { useMemo, useState } from "react";
import { History, Plus, Trash2, X } from "lucide-react";
import { Num, pendienteFinal, RangoMes, revisionLavado, TURNOS } from "@/lib/control";
import { continuacionesDeAyer, filasLavado, LineaLavado, ParteData, totalesParte, ValeLavado } from "@/lib/controlResumen";
import {
  BotonFila,
  BotonSecundario,
  Bloque,
  Caja,
  CabeceraTabla,
  Calculado,
  Campo,
  CampoNumero,
  CampoTexto,
  Celda,
  Chip,
  Seg,
  tonoDe,
  Totales,
} from "./ui";

const uid = () => Math.random().toString(36).slice(2, 10);

const PLANTILLA = "lg:grid-cols-[1.7fr_.85fr_.85fr_.85fr_.85fr_.85fr_1.5fr_1.05fr_28px]";

/** Por qué una fila no está completa, en palabras: el Excel solo dice «Revisar». */
const motivo = (l: LineaLavado): string | null => {
  const pf = pendienteFinal(l);
  if (typeof pf === "number" && pf < 0) return "Se han lavado más piezas de las recibidas más las pendientes.";
  if (l.lavadas === 0 && typeof l.kg === "number" && l.kg !== 0) return "Hay kg sin piezas lavadas.";
  if (typeof l.lavadas === "number" && l.lavadas > 0 && l.kg === 0) return "Hay piezas lavadas sin kg.";
  return null;
};

const PasoLavado = ({
  fecha,
  rango,
  parte,
  prendas,
  onChange,
  readOnly,
  anterior,
}: {
  fecha: string;
  rango: RangoMes;
  parte: ParteData;
  prendas: string[];
  onChange: (vales: ValeLavado[]) => void;
  readOnly?: boolean;
  /** El parte del día anterior, para traer lo que quedó pendiente. */
  anterior: ParteData | null;
}) => {
  const { lavado: vales } = parte;
  // En móvil, una fila completa se pliega a su resumen: quedan a la vista las pendientes.
  const [desplegadas, setDesplegadas] = useState<Record<string, boolean>>({});
  const totales = totalesParte(fecha, parte, rango);

  const continuaciones = useMemo(() => continuacionesDeAyer(anterior, uid), [anterior]);
  const prendasPendientes = continuaciones.reduce((s, v) => s + v.lineas.length, 0);

  const setVale = (id: string, cambio: Partial<ValeLavado>) =>
    onChange(vales.map((v) => (v.id === id ? { ...v, ...cambio } : v)));

  const setLinea = (vale: ValeLavado, id: string, cambio: Partial<LineaLavado>) =>
    setVale(vale.id, { lineas: vale.lineas.map((l) => (l.id === id ? { ...l, ...cambio } : l)) });

  // Turno, operario y equipo suelen repetirse: el vale nuevo copia los del último.
  const anadirVale = () => {
    const ultimo = vales[vales.length - 1];
    onChange([
      ...vales,
      {
        id: uid(),
        vale: "",
        turno: ultimo?.turno ?? "Día",
        operario: ultimo?.operario ?? "",
        equipo: ultimo?.equipo ?? "",
        lineas: [],
      },
    ]);
  };

  const anadirLinea = (vale: ValeLavado, prenda: string) =>
    setVale(vale.id, {
      lineas: [
        ...vale.lineas,
        { id: uid(), prenda, recibidas: null, pendiente_inicial: 0, lavadas: null, kg: null, observaciones: "" },
      ],
    });

  return (
    <Bloque
      titulo="Lavado por vale"
      ayuda="Turno, operario y equipo se escriben una vez por vale, no por cada prenda. Solo aparecen las prendas que traiga el vale. En continuaciones, recibidas = 0 y se anota el pendiente inicial."
      extra={
        <Totales
          items={[
            { label: "Lavadas", valor: totales.produccion },
            { label: "Kg", valor: totales.kg },
            { label: "Por revisar", valor: totales.por_revisar_lavado },
          ]}
        />
      }
    >
      {vales.length === 0 && (
        <p className="text-sm font-medium text-muted-foreground">Todavía no hay vales. Añade el primero.</p>
      )}

      {vales.map((v) => {
        const revs = filasLavado(fecha, { ...parte, lavado: [v] }).map((f) => revisionLavado(f, rango));
        const malos = revs.filter((r) => r === "Revisar" || r === "Completar").length;
        const restantes = prendas.filter((p) => !v.lineas.some((l) => l.prenda === p));
        return (
          <Caja key={v.id} alerta={revs.includes("Revisar")}>
            <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-[1fr_1.1fr_1.6fr_1.6fr_auto] items-end">
              <Campo label="Vale" htmlFor={`vale-${v.id}`}>
                <CampoTexto id={`vale-${v.id}`} value={v.vale} readOnly={readOnly} onChange={(x) => setVale(v.id, { vale: x })} />
              </Campo>
              <Campo label="Turno">
                <Seg
                  etiqueta="Turno"
                  opciones={TURNOS}
                  valor={v.turno as (typeof TURNOS)[number]}
                  readOnly={readOnly}
                  onChange={(x) => setVale(v.id, { turno: x })}
                />
              </Campo>
              <Campo label="Operario" htmlFor={`op-${v.id}`}>
                <CampoTexto id={`op-${v.id}`} value={v.operario} readOnly={readOnly} onChange={(x) => setVale(v.id, { operario: x })} />
              </Campo>
              <Campo label="Equipo" htmlFor={`eq-${v.id}`}>
                <CampoTexto id={`eq-${v.id}`} value={v.equipo} readOnly={readOnly} onChange={(x) => setVale(v.id, { equipo: x })} />
              </Campo>
              <div className="col-span-2 lg:col-span-1 flex items-center justify-between lg:justify-end gap-2 lg:pb-1.5">
                {v.lineas.length > 0 && (
                  <Chip tono={malos ? "mal" : "ok"}>{malos ? `${malos} por revisar` : "Completo"}</Chip>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Quitar el vale ${v.vale}`}
                    onClick={() => onChange(vales.filter((x) => x.id !== v.id))}
                    className="p-2 rounded-full text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {v.lineas.length > 0 && (
              <CabeceraTabla
                plantilla={PLANTILLA}
                columnas={["Prenda", "Recibidas DJ", "Pend. inicial", "Lavadas", "Kg lavados", "Pend. final", "Observaciones", "Revisión", ""]}
              />
            )}

            {v.lineas.map((l) => {
              const fila = filasLavado(fecha, { ...parte, lavado: [{ ...v, lineas: [l] }] })[0];
              const rev = revisionLavado(fila, rango);
              const pf = pendienteFinal(l);
              const setN = (campo: keyof LineaLavado) => (x: Num) => setLinea(v, l.id, { [campo]: x });
              const porque = motivo(l);
              const plegada = rev === "Completo" && !desplegadas[l.id];
              const claseCampo = plegada ? "hidden lg:block" : "";
              return (
                <div key={l.id} className="flex flex-col gap-1 rounded-xl p-2 lg:p-0 bg-card/60 lg:bg-transparent">
                  <div className={`grid gap-1.5 grid-cols-2 items-end lg:items-center lg:px-2.5 ${PLANTILLA}`}>
                    <button
                      type="button"
                      tabIndex={rev === "Completo" ? 0 : -1}
                      onClick={() => setDesplegadas((d) => ({ ...d, [l.id]: !d[l.id] }))}
                      className="col-span-2 lg:col-span-1 flex items-center justify-between gap-2 min-w-0 text-left lg:cursor-default"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-bold truncate">{l.prenda}</span>
                        {plegada && (
                          <span className="lg:hidden block text-xs font-semibold text-muted-foreground">
                            {l.lavadas} lavadas · {String(l.kg).replace(".", ",")} kg
                          </span>
                        )}
                      </span>
                      <span className="lg:hidden">
                        <Chip tono={tonoDe(rev)}>{rev}</Chip>
                      </span>
                    </button>
                    <Celda label="Recibidas DJ" className={claseCampo}>
                      <CampoNumero etiqueta={`Recibidas, ${l.prenda}`} value={l.recibidas} readOnly={readOnly} onChange={setN("recibidas")} />
                    </Celda>
                    <Celda label="Pend. inicial" className={claseCampo}>
                      <CampoNumero etiqueta={`Pendiente inicial, ${l.prenda}`} value={l.pendiente_inicial} readOnly={readOnly} onChange={setN("pendiente_inicial")} />
                    </Celda>
                    <Celda label="Lavadas" className={claseCampo}>
                      <CampoNumero etiqueta={`Lavadas, ${l.prenda}`} value={l.lavadas} readOnly={readOnly} onChange={setN("lavadas")} />
                    </Celda>
                    <Celda label="Kg lavados" className={claseCampo}>
                      <CampoNumero etiqueta={`Kg, ${l.prenda}`} tipo="decimal" value={l.kg} readOnly={readOnly} onChange={setN("kg")} />
                    </Celda>
                    <Celda label="Pend. final" className={claseCampo}>
                      <Calculado tono={typeof pf === "number" && pf < 0 ? "mal" : undefined}>{pf ?? "—"}</Calculado>
                    </Celda>
                    <Celda label="Observaciones" className={`col-span-2 lg:col-span-1 ${claseCampo}`}>
                      <CampoTexto etiqueta={`Observaciones, ${l.prenda}`} value={l.observaciones} readOnly={readOnly} onChange={(x) => setLinea(v, l.id, { observaciones: x })} />
                    </Celda>
                    <div className="hidden lg:block">
                      <Chip tono={tonoDe(rev)}>{rev}</Chip>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label={`Quitar ${l.prenda}`}
                        onClick={() => setVale(v.id, { lineas: v.lineas.filter((x) => x.id !== l.id) })}
                        className="hidden lg:flex items-center justify-center text-muted-foreground hover:text-destructive"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  {porque && <p className="text-xs font-semibold text-destructive lg:px-2.5">{porque}</p>}
                  {!readOnly && !plegada && (
                    <button
                      type="button"
                      onClick={() => setVale(v.id, { lineas: v.lineas.filter((x) => x.id !== l.id) })}
                      className="lg:hidden self-start text-xs font-bold text-muted-foreground py-1"
                    >
                      Quitar esta prenda
                    </button>
                  )}
                </div>
              );
            })}

            {!readOnly && restantes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Añadir prenda:</span>
                {restantes.map((p) => (
                  <BotonFila key={p} onClick={() => anadirLinea(v, p)}>
                    <Plus size={12} /> {p}
                  </BotonFila>
                ))}
              </div>
            )}
          </Caja>
        );
      })}

      {!readOnly && (
        <div className="flex flex-wrap gap-2.5">
          <BotonSecundario onClick={anadirVale}>
            <Plus size={15} /> Añadir vale{vales.length > 0 ? " (copia turno, operario y equipo)" : ""}
          </BotonSecundario>
          {prendasPendientes > 0 && (
            <BotonSecundario onClick={() => onChange([...vales, ...continuaciones])}>
              <History size={15} /> Traer pendientes de ayer ({prendasPendientes}{" "}
              {prendasPendientes === 1 ? "prenda" : "prendas"})
            </BotonSecundario>
          )}
        </div>
      )}
    </Bloque>
  );
};

export default PasoLavado;
