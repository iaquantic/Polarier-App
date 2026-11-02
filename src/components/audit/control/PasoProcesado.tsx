import { useMemo, useState } from "react";
import { ArrowRight, CheckCheck, MessageSquare, Plus, Trash2, X } from "lucide-react";
import {
  AREAS,
  Area,
  diferenciaProcesado,
  duracionHoras,
  Num,
  RangoMes,
  revisionProcesado,
  totalPMR,
  TURNOS,
} from "@/lib/control";
import {
  declaradasSugeridas,
  filasProcesado,
  LineaProcesado,
  lineaProcesadoVacia,
  lineaTodoConforme,
  ParteData,
  prendasDelVale,
  SIGUIENTE_AREA,
  TandaProcesado,
} from "@/lib/controlResumen";
import {
  Bloque,
  BotonFila,
  BotonSecundario,
  Caja,
  CabeceraTabla,
  Calculado,
  Campo,
  CampoNumero,
  CampoTexto,
  Celda,
  Chip,
  fmtCelda,
  Seg,
  tonoDe,
} from "./ui";

const uid = () => Math.random().toString(36).slice(2, 10);

const PLANTILLA =
  "lg:grid-cols-[1.45fr_.8fr_.8fr_.62fr_.62fr_.62fr_.62fr_.62fr_.75fr_.65fr_.65fr_1.15fr_92px]";

const lineaNueva = (prenda: string, declaradas: Num): LineaProcesado => ({
  id: uid(),
  prenda,
  declaradas,
  conforme: null,
  m_rosa: null,
  m_negra: null,
  m_oxido: null,
  m_otras: null,
  roturas: null,
  pendientes: null,
  observaciones: "",
});

const PasoProcesado = ({
  fecha,
  rango,
  parte,
  prendas,
  onChange,
  readOnly,
}: {
  fecha: string;
  rango: RangoMes;
  parte: ParteData;
  prendas: string[];
  onChange: (tandas: TandaProcesado[]) => void;
  readOnly?: boolean;
}) => {
  const [area, setArea] = useState<Area>("Secado");
  const [notas, setNotas] = useState<Record<string, boolean>>({});
  // En móvil, una fila completa se pliega a su resumen: quedan a la vista las pendientes.
  const [desplegadas, setDesplegadas] = useState<Record<string, boolean>>({});
  const tandas = parte.procesado;

  const delArea = tandas.filter((t) => t.area === area);

  const setTanda = (id: string, cambio: Partial<TandaProcesado>) =>
    onChange(tandas.map((t) => (t.id === id ? { ...t, ...cambio } : t)));

  const setLinea = (t: TandaProcesado, id: string, cambio: Partial<LineaProcesado>) =>
    setTanda(t.id, { lineas: t.lineas.map((l) => (l.id === id ? { ...l, ...cambio } : l)) });

  /** Abre el vale en un área con las prendas y declaradas que trae de la etapa anterior. */
  const anadirTanda = (destino: string, vale: string, base?: TandaProcesado) => {
    const ultima = base ?? tandas.filter((t) => t.area === destino).slice(-1)[0];
    const lineas = vale
      ? prendasDelVale(parte, destino, vale).map((p) => lineaNueva(p, declaradasSugeridas(parte, destino, vale, p)))
      : [];
    onChange([
      ...tandas,
      {
        id: uid(),
        area: destino,
        vale,
        turno: ultima?.turno ?? "Día",
        equipo: base ? "" : (ultima?.equipo ?? ""),
        operarios: base ? "" : (ultima?.operarios ?? ""),
        jefe_turno: ultima?.jefe_turno ?? "",
        hora_inicio: "",
        hora_fin: "",
        lineas,
      },
    ]);
    setArea(destino as Area);
  };

  // Vales del día que aún no han pasado por esta área: lo normal es seguirlos.
  const valesSinPasar = useMemo(() => {
    const todos = Array.from(new Set(parte.lavado.map((v) => v.vale).filter(Boolean)));
    return todos.filter((v) => !delArea.some((t) => t.vale === v));
  }, [parte.lavado, delArea]);

  const contar = (a: string) => tandas.filter((t) => t.area === a).reduce((s, t) => s + t.lineas.length, 0);
  const etiquetasArea = AREAS.map((a) => `${a} · ${contar(a)}`);

  return (
    <Bloque
      titulo="Procesado por área"
      ayuda="Las declaradas llegan solas de la etapa anterior. «Todo conforme» cubre el caso normal con un toque y solo se teclean las excepciones. Las manchas son excluyentes. Las áreas no se suman: una prenda pasa por varias."
    >
      <Seg
        etiqueta="Área"
        opciones={etiquetasArea}
        valor={`${area} · ${contar(area)}`}
        onChange={(x) => setArea(x.split(" · ")[0] as Area)}
        className="self-start"
      />

      {delArea.length === 0 && (
        <p className="text-sm font-medium text-muted-foreground">Sin registros de {area.toLowerCase()} este día.</p>
      )}

      {delArea.map((t) => {
        const filas = filasProcesado(fecha, { ...parte, procesado: [t] });
        const revs = filas.map((f) => revisionProcesado(f, rango));
        const dur = duracionHoras(t.hora_inicio, t.hora_fin);
        const siguiente = SIGUIENTE_AREA[t.area];
        const restantes = prendas.filter((p) => !t.lineas.some((l) => l.prenda === p));
        const vacias = t.lineas.filter((l) => lineaProcesadoVacia(l) && l.declaradas !== null).length;
        return (
          <Caja key={t.id} alerta={revs.includes("Revisar diferencia") || revs.includes("Revisar")}>
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4 lg:grid-cols-[.8fr_1.05fr_1fr_1.1fr_1.1fr_1.05fr_1.05fr_.7fr_auto] items-end">
              <Campo label="Vale" htmlFor={`tv-${t.id}`}>
                <CampoTexto id={`tv-${t.id}`} value={t.vale} readOnly={readOnly} onChange={(x) => setTanda(t.id, { vale: x })} />
              </Campo>
              <Campo label="Turno">
                <Seg etiqueta="Turno" opciones={TURNOS} valor={t.turno as (typeof TURNOS)[number]} readOnly={readOnly} onChange={(x) => setTanda(t.id, { turno: x })} />
              </Campo>
              <Campo label="Equipo" htmlFor={`te-${t.id}`}>
                <CampoTexto id={`te-${t.id}`} value={t.equipo} readOnly={readOnly} onChange={(x) => setTanda(t.id, { equipo: x })} />
              </Campo>
              <Campo label="Operarios" htmlFor={`to-${t.id}`}>
                <CampoTexto id={`to-${t.id}`} value={t.operarios} readOnly={readOnly} onChange={(x) => setTanda(t.id, { operarios: x })} />
              </Campo>
              <Campo label="Jefe de turno" htmlFor={`tj-${t.id}`}>
                <CampoTexto id={`tj-${t.id}`} value={t.jefe_turno} readOnly={readOnly} onChange={(x) => setTanda(t.id, { jefe_turno: x })} />
              </Campo>
              <Campo label="Inicio" htmlFor={`ti-${t.id}`}>
                <CampoTexto id={`ti-${t.id}`} tipo="time" value={t.hora_inicio} readOnly={readOnly} onChange={(x) => setTanda(t.id, { hora_inicio: x })} />
              </Campo>
              <Campo label="Fin" htmlFor={`tf-${t.id}`}>
                <CampoTexto id={`tf-${t.id}`} tipo="time" value={t.hora_fin} readOnly={readOnly} onChange={(x) => setTanda(t.id, { hora_fin: x })} />
              </Campo>
              <Campo label="Duración (h)">
                <Calculado>{fmtCelda(dur)}</Calculado>
              </Campo>
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Quitar el vale ${t.vale} de ${t.area}`}
                  onClick={() => onChange(tandas.filter((x) => x.id !== t.id))}
                  className="p-2 rounded-full text-muted-foreground hover:text-destructive justify-self-end"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {t.lineas.length > 0 && (
              <CabeceraTabla
                plantilla={PLANTILLA}
                columnas={["Prenda", "Declaradas", "Conforme", "Rosa / amar.", "Negra", "Óxido", "Otras", "Roturas", "Total P+M+R", "Pend.", "Dif.", "Revisión", ""]}
              />
            )}

            {t.lineas.map((l) => {
              const fila = filasProcesado(fecha, { ...parte, procesado: [{ ...t, lineas: [l] }] })[0];
              const rev = revisionProcesado(fila, rango);
              const total = totalPMR(l);
              const dif = diferenciaProcesado(l);
              const setN = (campo: keyof LineaProcesado) => (x: Num) => setLinea(t, l.id, { [campo]: x });
              const verNota = notas[l.id] || !!l.observaciones;
              const plegada = rev === "Completo" && !desplegadas[l.id];
              const claseCampo = plegada ? "hidden lg:block" : "";
              const num = (campo: keyof LineaProcesado, nombre: string) => (
                <Celda label={nombre} className={claseCampo}>
                  <CampoNumero
                    etiqueta={`${nombre}, ${l.prenda}`}
                    value={l[campo] as Num}
                    readOnly={readOnly}
                    onChange={setN(campo)}
                  />
                </Celda>
              );
              return (
                <div key={l.id} className="flex flex-col gap-1 rounded-xl p-2 lg:p-0 bg-card/60 lg:bg-transparent">
                  <div className={`grid gap-1.5 grid-cols-3 items-end lg:items-center lg:px-2.5 ${PLANTILLA}`}>
                    <button
                      type="button"
                      tabIndex={rev === "Completo" ? 0 : -1}
                      onClick={() => setDesplegadas((d) => ({ ...d, [l.id]: !d[l.id] }))}
                      className="order-[-2] lg:order-none col-span-3 lg:col-span-1 flex items-center justify-between gap-2 min-w-0 text-left lg:cursor-default"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-bold truncate">{l.prenda}</span>
                        {plegada && (
                          <span className="lg:hidden block text-xs font-semibold text-muted-foreground">
                            {l.conforme} conformes de {l.declaradas}
                          </span>
                        )}
                      </span>
                      <span className="lg:hidden">
                        <Chip tono={tonoDe(rev)}>{rev}</Chip>
                      </span>
                    </button>
                    {num("declaradas", "Declaradas")}
                    {num("conforme", "Conforme")}
                    {num("m_rosa", "Rosa / amar.")}
                    {num("m_negra", "Negra")}
                    {num("m_oxido", "Óxido")}
                    {num("m_otras", "Otras")}
                    {num("roturas", "Roturas")}
                    <Celda label="Total P+M+R" className={claseCampo}>
                      <Calculado>{total ?? "—"}</Calculado>
                    </Celda>
                    {num("pendientes", "Pendientes")}
                    <Celda label="Diferencia" className={claseCampo}>
                      <Calculado tono={typeof dif === "number" && dif !== 0 ? "mal" : undefined}>{dif ?? "—"}</Calculado>
                    </Celda>
                    <div className="hidden lg:block">
                      <Chip tono={tonoDe(rev)}>{rev === "Revisar diferencia" ? "Revisar dif." : rev}</Chip>
                    </div>
                    {!readOnly && (
                      <div className="order-[-1] lg:order-none col-span-3 lg:col-span-1 flex items-center justify-end gap-0.5">
                        {/* En una fila completa pisaría las excepciones ya anotadas. */}
                        {rev !== "Completo" && (
                          <button
                            type="button"
                            title="Todo conforme: conforme = declaradas y el resto a 0"
                            aria-label={`Todo conforme, ${l.prenda}`}
                            disabled={l.declaradas === null}
                            onClick={() => setLinea(t, l.id, lineaTodoConforme(l))}
                            className="inline-flex items-center gap-1 h-9 px-2 mr-auto lg:mr-0 rounded-full bg-primary/10 text-primary text-xs font-extrabold disabled:opacity-40"
                          >
                            <CheckCheck size={15} />
                            <span className="lg:hidden">Todo conforme</span>
                          </button>
                        )}
                        <button
                          type="button"
                          title="Observaciones"
                          aria-label={`Observaciones, ${l.prenda}`}
                          onClick={() => setNotas((n) => ({ ...n, [l.id]: !n[l.id] }))}
                          className={`p-1.5 rounded-full ${l.observaciones ? "text-primary" : "text-muted-foreground"}`}
                        >
                          <MessageSquare size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Quitar ${l.prenda}`}
                          onClick={() => setTanda(t.id, { lineas: t.lineas.filter((x) => x.id !== l.id) })}
                          className="p-1.5 rounded-full text-muted-foreground hover:text-destructive"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                  {typeof dif === "number" && dif !== 0 && (
                    <p className="text-xs font-semibold text-destructive lg:px-2.5">
                      Conforme, manchas, roturas y pendientes suman {dif > 0 ? `${dif} de más` : `${-dif} de menos`} frente a lo declarado.
                    </p>
                  )}
                  {verNota && (
                    <div className="lg:px-2.5">
                      <CampoTexto
                        etiqueta={`Observaciones de ${l.prenda}`}
                        placeholder="Observaciones"
                        value={l.observaciones}
                        readOnly={readOnly}
                        onChange={(x) => setLinea(t, l.id, { observaciones: x })}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {!readOnly && (
              <div className="flex flex-wrap items-center gap-1.5">
                {vacias > 0 && (
                  <BotonFila
                    onClick={() =>
                      setTanda(t.id, {
                        lineas: t.lineas.map((l) =>
                          lineaProcesadoVacia(l) && l.declaradas !== null ? lineaTodoConforme(l) : l
                        ),
                      })
                    }
                  >
                    <CheckCheck size={13} /> Todo conforme en las filas vacías ({vacias})
                  </BotonFila>
                )}
                {siguiente && t.vale && (
                  <BotonFila onClick={() => anadirTanda(siguiente, t.vale, t)}>
                    <ArrowRight size={13} /> Pasar este vale a {siguiente}
                  </BotonFila>
                )}
                {restantes.map((p) => (
                  <BotonFila
                    key={p}
                    onClick={() =>
                      setTanda(t.id, {
                        lineas: [...t.lineas, lineaNueva(p, declaradasSugeridas(parte, t.area, t.vale, p))],
                      })
                    }
                  >
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
          {valesSinPasar.map((v) => (
            <BotonSecundario key={v} onClick={() => anadirTanda(area, v)}>
              <Plus size={15} /> {v} a {area}
            </BotonSecundario>
          ))}
          <BotonSecundario onClick={() => anadirTanda(area, "")}>
            <Plus size={15} /> Otro vale en {area}
          </BotonSecundario>
        </div>
      )}
    </Bloque>
  );
};

export default PasoProcesado;
