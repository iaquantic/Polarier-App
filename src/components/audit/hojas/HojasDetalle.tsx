import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { diferenciaProcesado, duracionHoras, pendienteFinal, revisionLavado, revisionProcesado, totalPMR } from "@/lib/control";
import { continuacionesDeAyer, declaradasSugeridas, leerParte, lineaTodoConforme, prendasDelVale, SIGUIENTE_AREA } from "@/lib/controlResumen";
import { COLS_LAVADO, COLS_PROCESADO, FilaLavadoHoja, FilaProcesadoHoja, FILAS, textoDeFecha, uid } from "@/lib/controlHojas";
import { getParteAnterior } from "@/services/audit";
import { LibroMes } from "@/hooks/useLibroMes";
import TablaHoja, { CambioTabla, FilaTabla, Mini, Nota } from "./TablaHoja";

export interface PropsHoja {
  libro: LibroMes;
  fechaFiltro: string | null;
  onFechaFiltro: (f: string | null) => void;
}

const LIBRES = 8;

/** Filas vacías del final con su id ya decidido: al escribir en una no pierde el foco. */
export const useFantasmas = (reales: { has: (id: string) => boolean }, n: number): string[] => {
  const pool = useRef<string[]>([]);
  pool.current = pool.current.filter((id) => !reales.has(id));
  while (pool.current.length < n) pool.current.push(uid());
  return pool.current;
};

export const Metricas = ({ items }: { items: { t: string; v: unknown }[] }) => (
  <div className="hx-metricas">
    {items.map((m) => (
      <div key={m.t}>
        <b>{m.t}</b>
        <span>{typeof m.v === "number" ? m.v.toLocaleString("es-ES", { maximumFractionDigits: 2 }) : String(m.v ?? "")}</span>
      </div>
    ))}
  </div>
);

export const FiltroFecha = ({
  libro,
  valor,
  onChange,
  conTodo = true,
}: {
  libro: LibroMes;
  valor: string | null;
  onChange: (f: string | null) => void;
  conTodo?: boolean;
}) => (
  <label className="hx-mini">
    Fecha:&nbsp;
    <select aria-label="Filtrar por fecha" value={valor ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      {conTodo && <option value="">todo el mes</option>}
      {Array.from({ length: libro.rango.dias }, (_, i) => {
        const f = `${libro.rango.primerDia.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
        return (
          <option key={f} value={f}>
            {textoDeFecha(f)}
          </option>
        );
      })}
    </select>
  </label>
);

/** Una fecha nueva tiene que ser de este mes: se guarda en el parte de ese día. */
export const errorFecha = (libro: LibroMes, valor: unknown): string | null => {
  const nombre = new Date(libro.anio, libro.mes - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  if (!valor) return "La fecha no puede quedar vacía: cada fila se guarda en su día.";
  if ((valor as string) < libro.rango.primerDia || (valor as string) > libro.rango.ultimoDia) return `La fecha tiene que ser de ${nombre}.`;
  return null;
};

export const HojaLavado = ({ libro, fechaFiltro, onFechaFiltro }: PropsHoja) => {
  const [activa, setActiva] = useState<string | null>(null);
  const [foco, setFoco] = useState<{ fila: number; vez: number } | null>(null);
  const cache = useRef(new WeakMap<FilaLavadoHoja, FilaTabla>());
  const columnas = useMemo(
    () => COLS_LAVADO.map((c) => (c.key === "prenda" ? { ...c, opciones: libro.datos.prendas.map((p) => p.nombre) } : c)),
    [libro.datos.prendas]
  );

  const visibles = useMemo(
    () => (fechaFiltro ? libro.lavado.filter((f) => f.fecha === fechaFiltro) : libro.lavado),
    [fechaFiltro, libro.lavado]
  );
  const ids = useMemo(() => new Set(libro.lavado.map((f) => f.id)), [libro.lavado]);
  const fantasmas = useFantasmas(ids, LIBRES);
  const ultimaFecha = visibles[visibles.length - 1]?.fecha ?? fechaFiltro;

  const numeros = useMemo(() => new Map(libro.lavado.map((f, i) => [f.id, FILAS.lavado.desde + i])), [libro.lavado]);
  const filas: FilaTabla[] = useMemo(() => {
    const bloqueo = libro.mesValidado;
    const reales = visibles.map((f) => {
      const previa = cache.current.get(f);
      const numero = numeros.get(f.id);
      const bloqueada = bloqueo || f.dueno !== libro.miId;
      if (previa && previa.numero === numero && previa.bloqueada === bloqueada) return previa;
      const nueva: FilaTabla = {
        id: f.id,
        numero,
        bloqueada,
        valores: { ...f, pendiente_final: pendienteFinal(f), revision: revisionLavado(f, libro.rango) },
      };
      cache.current.set(f, nueva);
      return nueva;
    });
    return [
      ...reales,
      ...fantasmas.map((id, i) => ({ id, numero: FILAS.lavado.desde + libro.lavado.length + i, bloqueada: bloqueo, valores: {} })),
    ];
  }, [fantasmas, libro.lavado.length, libro.mesValidado, libro.miId, libro.rango, numeros, visibles]);

  const alCambiar = (cambios: CambioTabla[]) => {
    const porId = new Map<string, Partial<FilaLavadoHoja>>();
    for (const c of cambios) {
      const id = filas[c.fila]?.id ?? uid();
      if (c.key === "fecha") {
        const error = errorFecha(libro, c.valor);
        if (error) {
          toast.error(error);
          continue;
        }
      }
      porId.set(id, { ...porId.get(id), [c.key]: c.valor });
    }
    libro.editarLavado(Array.from(porId, ([id, cambio]) => ({ id, cambio })), ultimaFecha);
  };

  const traerPendientes = async () => {
    const fecha = fechaFiltro ?? libro.fechaPorDefecto(null);
    if (!libro.datos.def) return;
    try {
      const previo = await getParteAnterior(libro.datos.def.id, fecha);
      const vales = continuacionesDeAyer(previo ? leerParte(previo.data) : null, uid);
      const delDia = libro.lavado.filter((f) => f.fecha === fecha);
      const nuevas = vales.flatMap((v) =>
        v.lineas
          .filter((l) => !delDia.some((f) => f.vale === v.vale && f.prenda === l.prenda && f.recibidas === 0))
          .map((l) => ({
            id: l.id,
            cambio: {
              fecha,
              turno: v.turno,
              vale: v.vale,
              prenda: l.prenda,
              recibidas: 0,
              pendiente_inicial: l.pendiente_inicial,
              operario: v.operario,
              equipo: v.equipo,
            },
          }))
      );
      if (nuevas.length === 0) {
        toast.info("No quedó nada pendiente de antes de este día.");
        return;
      }
      libro.editarLavado(nuevas, fecha);
      toast.success(`${nuevas.length === 1 ? "Añadida 1 fila" : `Añadidas ${nuevas.length} filas`} con lo pendiente`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo traer lo pendiente");
    }
  };

  const filaElegida = libro.lavado.find((f) => f.id === activa);
  const lectura = libro.mesValidado;

  return (
    <>
      <div className="hx-acciones">
        <Mini disabled={lectura} onClick={() => setFoco((v) => ({ fila: visibles.length, vez: (v?.vez ?? 0) + 1 }))}>
          + Añadir fila
        </Mini>
        <Mini disabled={lectura || !filaElegida || filaElegida.dueno !== libro.miId} onClick={() => activa && libro.borrarLavado(activa)}>
          Borrar la fila elegida
        </Mini>
        <Mini disabled={lectura} onClick={() => void traerPendientes()}>
          Traer pendientes de ayer
        </Mini>
        <FiltroFecha libro={libro} valor={fechaFiltro} onChange={onFechaFiltro} />
      </div>
      <div className="hx-bloques">
        <Metricas
          items={[
            { t: "Piezas lavadas", v: libro.resumen?.lavado.piezas },
            { t: "Kg lavados", v: libro.resumen?.lavado.kg },
            { t: "Registros pendientes", v: libro.resumen?.lavado.pendientes },
          ]}
        />
        <div>
          <TablaHoja
            nombre="Lavado_detalle"
            columnas={columnas}
            filas={filas}
            fija={0}
            alto="62vh"
            rellenar={false}
            anio={libro.anio}
            filaActiva={activa}
            foco={foco}
            onFilaActiva={setActiva}
            onCambios={alCambiar}
            onRechazo={(m) => toast.error(m)}
          />
          <Nota>
            Capacidad del Excel: 1 000 registros por mes. Cada fila guarda su turno, operario y equipo, como en la hoja. Se puede pegar un bloque copiado del Excel.
          </Nota>
        </div>
      </div>
    </>
  );
};

export const HojaProcesado = ({ libro, fechaFiltro, onFechaFiltro }: PropsHoja) => {
  const [activa, setActiva] = useState<string | null>(null);
  const [foco, setFoco] = useState<{ fila: number; vez: number } | null>(null);
  const cache = useRef(new WeakMap<FilaProcesadoHoja, FilaTabla>());
  const columnas = useMemo(
    () => COLS_PROCESADO.map((c) => (c.key === "prenda" ? { ...c, opciones: libro.datos.prendas.map((p) => p.nombre) } : c)),
    [libro.datos.prendas]
  );
  const visibles = useMemo(
    () => (fechaFiltro ? libro.procesado.filter((f) => f.fecha === fechaFiltro) : libro.procesado),
    [fechaFiltro, libro.procesado]
  );
  const ids = useMemo(() => new Set(libro.procesado.map((f) => f.id)), [libro.procesado]);
  const fantasmas = useFantasmas(ids, LIBRES);
  const ultimaFecha = visibles[visibles.length - 1]?.fecha ?? fechaFiltro;
  const numeros = useMemo(() => new Map(libro.procesado.map((f, i) => [f.id, FILAS.procesado.desde + i])), [libro.procesado]);

  const filas: FilaTabla[] = useMemo(() => {
    const bloqueo = libro.mesValidado;
    const reales = visibles.map((f) => {
      const previa = cache.current.get(f);
      const numero = numeros.get(f.id);
      const bloqueada = bloqueo || f.dueno !== libro.miId;
      if (previa && previa.numero === numero && previa.bloqueada === bloqueada) return previa;
      const nueva: FilaTabla = {
        id: f.id,
        numero,
        bloqueada,
        valores: {
          ...f,
          total: totalPMR(f),
          diferencia: diferenciaProcesado(f),
          duracion: duracionHoras(f.hora_inicio, f.hora_fin),
          revision: revisionProcesado(f, libro.rango),
        },
      };
      cache.current.set(f, nueva);
      return nueva;
    });
    return [
      ...reales,
      ...fantasmas.map((id, i) => ({ id, numero: FILAS.procesado.desde + libro.procesado.length + i, bloqueada: bloqueo, valores: {} })),
    ];
  }, [fantasmas, libro.mesValidado, libro.miId, libro.procesado.length, libro.rango, numeros, visibles]);

  const alCambiar = (cambios: CambioTabla[]) => {
    const porId = new Map<string, Partial<FilaProcesadoHoja>>();
    for (const c of cambios) {
      const id = filas[c.fila]?.id ?? uid();
      if (c.key === "fecha") {
        const error = errorFecha(libro, c.valor);
        if (error) {
          toast.error(error);
          continue;
        }
      }
      porId.set(id, { ...porId.get(id), [c.key]: c.valor });
    }
    libro.editarProcesado(Array.from(porId, ([id, cambio]) => ({ id, cambio })), ultimaFecha);
  };

  const elegida = libro.procesado.find((f) => f.id === activa);
  const mia = !!elegida && elegida.dueno === libro.miId && !libro.mesValidado;

  const todoConforme = () => {
    if (!elegida) return;
    if (typeof elegida.declaradas !== "number") {
      toast.error("Escribe antes las declaradas de esta fila.");
      return;
    }
    const { id: _id, ...resto } = lineaTodoConforme({ ...elegida, id: elegida.id });
    libro.editarProcesado([{ id: elegida.id, cambio: resto }]);
  };

  /** Abre el vale en la siguiente área con las prendas y declaradas de la etapa anterior. */
  const pasarVale = () => {
    if (!elegida) return;
    const destino = SIGUIENTE_AREA[elegida.area];
    if (!destino) {
      toast.info("Esta fila ya está en la última área.");
      return;
    }
    const parte = libro.parteDelDia(elegida.fecha);
    const prendas = prendasDelVale(parte, destino, elegida.vale);
    const nuevas = (prendas.length ? prendas : [elegida.prenda]).map((prenda) => ({
      id: uid(),
      cambio: {
        fecha: elegida.fecha,
        turno: elegida.turno,
        area: destino,
        jefe_turno: elegida.jefe_turno,
        vale: elegida.vale,
        prenda,
        declaradas: declaradasSugeridas(parte, destino, elegida.vale, prenda),
      },
    }));
    libro.editarProcesado(nuevas, elegida.fecha);
    toast.success(`Vale ${elegida.vale || "sin número"} pasado a ${destino}`);
  };

  const lectura = libro.mesValidado;

  return (
    <>
      <div className="hx-acciones">
        <Mini disabled={lectura} onClick={() => setFoco((v) => ({ fila: visibles.length, vez: (v?.vez ?? 0) + 1 }))}>
          + Añadir fila
        </Mini>
        <Mini disabled={!mia} onClick={() => activa && libro.borrarProcesado(activa)}>
          Borrar la fila elegida
        </Mini>
        <Mini disabled={!mia} onClick={todoConforme} title="Escribe conforme = declaradas y los ceros que habría que teclear">
          Todo conforme en la fila elegida
        </Mini>
        <Mini disabled={!mia} onClick={pasarVale}>
          Pasar el vale a otra área
        </Mini>
        <FiltroFecha libro={libro} valor={fechaFiltro} onChange={onFechaFiltro} />
      </div>
      <div className="hx-bloques">
        <Metricas
          items={[
            { t: "Registros completos", v: libro.resumen?.procesado.completos },
            { t: "Registros pendientes", v: libro.resumen?.procesado.pendientes },
          ]}
        />
        <div>
          <TablaHoja
            nombre="Procesado_detalle"
            columnas={columnas}
            filas={filas}
            fija={0}
            alto="62vh"
            rellenar={false}
            anio={libro.anio}
            filaActiva={activa}
            foco={foco}
            onFilaActiva={setActiva}
            onCambios={alCambiar}
            onRechazo={(m) => toast.error(m)}
          />
          <Nota>Diferencia = producción conforme + manchas + roturas + pendientes − declaradas. Los resultados se presentan por área en Resumen.</Nota>
        </div>
      </div>
    </>
  );
};
