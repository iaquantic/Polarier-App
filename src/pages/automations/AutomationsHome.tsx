import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Info } from "lucide-react";
import { AUTOMATIZACIONES, fechaCorta } from "@/lib/automatizaciones";
import { getEjecuciones, type EjecucionAutomatizacion } from "@/services/automatizaciones";

// Índice de la sección: una tarjeta por automatización y las últimas ejecuciones
// de todas juntas. Lo que ve cada tarjeta sale del catálogo, no de aquí.

const ESTADO = {
  en_curso: { texto: "En curso", color: "var(--neo-accent)" },
  completada: { texto: "Completada", color: "#1F6B3B" },
  error: { texto: "Error", color: "var(--neo-danger)" },
} as const;

const AutomationsHome = () => {
  const navigate = useNavigate();
  const [ejecuciones, setEjecuciones] = useState<EjecucionAutomatizacion[]>([]);

  useEffect(() => {
    // Las últimas de cada una, mezcladas y recortadas: así el índice resume la
    // actividad sin pedir una consulta nueva a la base de datos.
    Promise.all(AUTOMATIZACIONES.map((a) => getEjecuciones(a.slug, 5)))
      .then((listas) =>
        setEjecuciones(
          listas
            .flat()
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 6)
        )
      )
      .catch(() => {});
  }, []);

  const nombreDe = (slug: string) => AUTOMATIZACIONES.find((a) => a.slug === slug)?.nombre ?? slug;

  return (
    <div className="flex-1 px-4 sm:px-8 pt-4 sm:pt-7 pb-12 safe-bottom">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-7 sm:gap-9">

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="neo-strip neo-text text-[26px] sm:text-[32px] font-extrabold tracking-tight rounded-2xl">
              Automatizaciones
            </h1>
            <p className="neo-strip neo-text-2 text-[13px] sm:text-[14.5px] font-medium leading-relaxed max-w-[620px] mt-2 px-1 rounded-xl">
              Cada proceso tiene su apartado: sube el fichero que te pide, o elige el mes, y recibe el documento. No hace falta acertar con el nombre en el chat.
            </p>
          </div>
          <span className="neo-raised-sm neo-accent hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold">
            <Info size={15} />
            {AUTOMATIZACIONES.length} automatizaciones activas
          </span>
        </header>

        {/* Del índice para abajo, superficies claras (ámbito .neo-chat), como en el lobby. */}
        <section className="neo-chat grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {AUTOMATIZACIONES.map((auto) => (
            <button
              key={auto.slug}
              type="button"
              onClick={() => navigate(`/automatizaciones/${auto.slug}`)}
              className="neo-raised neo-press flex flex-col items-start gap-3.5 p-5 sm:p-6 rounded-[22px] text-left"
            >
              <span className="neo-inset-sm neo-accent w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0">
                <auto.icono size={21} strokeWidth={1.9} />
              </span>
              <span className="neo-text text-[17px] font-extrabold leading-tight">{auto.nombre}</span>
              <span className="neo-text-2 text-[13px] font-medium leading-relaxed">{auto.descripcion}</span>
              <span className="flex flex-wrap gap-1.5">
                {(auto.modo === "mensual" ? ["Por mes"] : auto.extensiones.map((ext) => ext.replace(".", "").toUpperCase())).map((chip) => (
                  <span
                    key={chip}
                    className="neo-inset-sm neo-text-2 px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wide"
                  >
                    {chip.toUpperCase()}
                  </span>
                ))}
              </span>
              <span className="neo-text-2 text-[11.5px] font-semibold">
                {auto.modo === "mensual" ? "Elige el mes y genera el informe" : `Ejemplo: ${auto.ejemplos[0]}`}
              </span>
            </button>
          ))}
        </section>

        {ejecuciones.length > 0 && (
          <section className="neo-chat flex flex-col gap-3">
            <h2 className="neo-strip neo-text-2 text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.12em] px-3 py-1 rounded-lg self-start">
              Últimas ejecuciones
            </h2>
            <div className="neo-raised rounded-[22px] px-5 sm:px-6">
              {ejecuciones.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => navigate(`/automatizaciones/${e.slug}?run=${e.id}`)}
                  className={`w-full text-left flex flex-wrap items-center gap-x-4 gap-y-1 py-3.5 hover:opacity-80 transition-opacity ${
                    i < ejecuciones.length - 1 ? "border-b border-[var(--neo-well)]" : ""
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: ESTADO[e.estado]?.color ?? "var(--neo-accent)" }}
                  />
                  <span className="neo-text text-[13px] font-extrabold w-[100px] shrink-0">{nombreDe(e.slug)}</span>
                  <span className="neo-text-2 text-[13px] font-semibold flex-1 min-w-0 truncate">{e.archivo_nombre}</span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: ESTADO[e.estado]?.color ?? "var(--neo-accent)" }}
                  >
                    {ESTADO[e.estado]?.texto ?? e.estado}
                  </span>
                  <span className="neo-text-2 text-xs font-semibold w-[120px] text-right">{fechaCorta(e.created_at)}</span>
                  <ChevronRight size={15} className="neo-accent shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default AutomationsHome;
