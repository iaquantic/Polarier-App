import { useEffect, useMemo, useRef } from "react";
import { hoyLocal, pad2, rangoMes } from "@/lib/control";
import { leerParte, ParteRegistro } from "@/lib/controlResumen";

export type EstadoDiaMes = "cerrado" | "sin_actividad" | "pendiente" | "sin_parte" | "futuro";

const CLASE: Record<EstadoDiaMes, string> = {
  cerrado: "neo-primary",
  sin_actividad: "bg-muted-foreground text-background",
  pendiente: "bg-amber-100 text-amber-900 ring-[1.5px] ring-inset ring-amber-600",
  sin_parte: "bg-red-100 text-red-900 ring-[1.5px] ring-inset ring-red-600",
  futuro: "text-muted-foreground ring-1 ring-inset ring-primary/25",
};

const LEYENDA: [EstadoDiaMes, string][] = [
  ["cerrado", "Cerrado"],
  ["sin_actividad", "Sin actividad"],
  ["pendiente", "Pendiente"],
  ["sin_parte", "Sin parte"],
];

/**
 * El mes de un vistazo: qué días faltan por completar. Es la cobertura que el
 * Excel cuenta en «Días por completar», y sirve de atajo para ir a cualquier día.
 */
const DiasMes = ({
  anio,
  mes,
  partes,
  seleccion,
  onElegir,
}: {
  anio: number;
  mes: number;
  partes: ParteRegistro[];
  seleccion?: string;
  onElegir: (fecha: string) => void;
}) => {
  const hoy = hoyLocal();
  const dias = useMemo(() => {
    const { dias: n } = rangoMes(anio, mes);
    return Array.from({ length: n }, (_, i) => {
      const fecha = `${anio}-${pad2(mes)}-${pad2(i + 1)}`;
      const delDia = partes.filter((p) => p.fecha === fecha).map((p) => leerParte(p.data).jornada.cierre);
      let estado: EstadoDiaMes;
      if (fecha > hoy) estado = "futuro";
      else if (delDia.length === 0) estado = fecha === hoy ? "pendiente" : "sin_parte";
      else if (delDia.includes("Pendiente")) estado = "pendiente";
      else estado = delDia.includes("Cerrado") ? "cerrado" : "sin_actividad";
      return { n: i + 1, fecha, estado };
    });
  }, [anio, mes, partes, hoy]);

  // En móvil es una sola fila que se desliza: que se vea el día abierto.
  const elegido = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    elegido.current?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [seleccion]);

  const conDato = dias.filter((d) => d.estado === "cerrado" || d.estado === "sin_actividad").length;
  const nombreMes = new Date(anio, mes - 1, 1)
    .toLocaleDateString("es-ES", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());

  return (
    <section aria-label="Días del mes" className="neo-raised-sm rounded-[22px] px-4 py-3.5 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-sm font-extrabold">
          {nombreMes}: {conDato} de {dias.length} días con dato
        </p>
        <div className="hidden sm:flex flex-wrap gap-3">
          {LEYENDA.map(([e, t]) => (
            <span key={e} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <i className={`inline-block w-3 h-3 rounded ${CLASE[e]}`} />
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto sm:flex-wrap sm:overflow-visible p-1 -m-1">
        {dias.map((d) => (
          <button
            key={d.n}
            ref={d.fecha === seleccion ? elegido : undefined}
            type="button"
            disabled={d.estado === "futuro"}
            aria-label={`Día ${d.n}: ${d.estado.replace("_", " ")}`}
            aria-current={d.fecha === seleccion ? "date" : undefined}
            onClick={() => onElegir(d.fecha)}
            className={`shrink-0 w-[30px] h-[30px] rounded-[9px] text-[11.5px] font-extrabold transition-transform ${CLASE[d.estado]} ${
              d.fecha === seleccion ? "outline outline-[2.5px] outline-offset-1 outline-primary" : ""
            } ${d.estado === "futuro" ? "cursor-not-allowed" : "neo-press"}`}
          >
            {d.n}
          </button>
        ))}
      </div>
    </section>
  );
};

export default DiasMes;
