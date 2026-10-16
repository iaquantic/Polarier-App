import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Loader2, CheckCircle2, Circle } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { getFormDefinitions, getSubmission, FormDefinition } from "@/services/audit";

const hoy = () =>
  new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Formularios del día (`/auditoria/formularios`). El inicio del módulo es el dashboard. */
const AuditHome = () => {
  const navigate = useNavigate();
  const { activeHotel, loading: roleLoading } = useRole();
  const [defs, setDefs] = useState<FormDefinition[]>([]);
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeHotel) return;
    (async () => {
      setLoading(true);
      try {
        const d = await getFormDefinitions(activeHotel.id);
        setDefs(d);
        const est: Record<string, string> = {};
        await Promise.all(
          d.map(async (def) => {
            const sub = await getSubmission(def.id);
            est[def.id] = sub?.estado ?? "sin_empezar";
          })
        );
        setEstados(est);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeHotel?.id]);

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <header className="neo-raised-sm rounded-[22px] px-5 py-4 mb-6">
          <h1 className="text-lg sm:text-xl font-extrabold text-foreground">Formularios de Control</h1>
          <p className="text-sm font-medium text-muted-foreground capitalize">{hoy()}</p>
        </header>

        {defs.length === 0 ? (
          <p className="neo-raised-sm rounded-[22px] p-5 text-sm text-muted-foreground">No hay formularios configurados para este hotel.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {defs.map((def) => {
              const estado = estados[def.id];
              const done = estado === "completado";
              return (
                <button
                  key={def.id}
                  onClick={() => navigate(`/auditoria/formulario/${def.id}`)}
                  className="flex items-start gap-3 neo-raised-sm neo-press rounded-[20px] p-4 text-left"
                >
                  <div className="w-10 h-10 rounded-xl neo-inset-sm flex items-center justify-center shrink-0">
                    <ClipboardList size={20} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-foreground">{def.nombre}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {done ? (
                        <>
                          <CheckCircle2 size={14} className="text-green-500" />
                          <span className="text-xs text-green-600">Completado</span>
                        </>
                      ) : estado === "borrador" ? (
                        <>
                          <Circle size={14} className="text-amber-500" />
                          <span className="text-xs text-amber-600">En progreso</span>
                        </>
                      ) : (
                        <>
                          <Circle size={14} className="text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Sin empezar</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditHome;
