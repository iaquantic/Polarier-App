import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, ClipboardList, Loader2, CheckCircle2, Circle } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { getFormDefinitions, getSubmission, getSubmissionsByMonth, FormDefinition, FormSubmission } from "@/services/audit";
import { hoyLocal } from "@/lib/control";
import { leerParte } from "@/lib/controlResumen";
import DiasMes from "@/components/audit/control/DiasMes";

const hoy = () =>
  new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const EstadoParte = ({ estado }: { estado: string }) =>
  estado === "completado" ? (
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
  );

/** Formularios del día (`/auditoria/formularios`). El inicio del módulo es el dashboard. */
const AuditHome = () => {
  const navigate = useNavigate();
  const { activeHotel, loading: roleLoading } = useRole();
  const [defs, setDefs] = useState<FormDefinition[]>([]);
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [partesMes, setPartesMes] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const fechaHoy = hoyLocal();
  const [anio, mes] = fechaHoy.split("-").map(Number);
  const control = defs.find((d) => d.tipo === "control") ?? null;

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
            const sub = await getSubmission(def.id, def.tipo === "control" ? fechaHoy : undefined);
            est[def.id] = sub?.estado ?? "sin_empezar";
          })
        );
        setEstados(est);
        const ctrl = d.find((x) => x.tipo === "control");
        if (ctrl) {
          const subs = await getSubmissionsByMonth(activeHotel.id, anio, mes);
          setPartesMes(subs.filter((s) => s.form_definition_id === ctrl.id));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [activeHotel?.id, fechaHoy, anio, mes]);

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <header className="neo-raised-sm rounded-[22px] px-5 py-4">
          <h1 className="text-lg sm:text-xl font-extrabold text-foreground">Parte diario de control</h1>
          <p className="text-sm font-medium text-muted-foreground capitalize">{hoy()}</p>
        </header>

        {control ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => navigate("/auditoria/formularios/parte")}
                className="flex items-start gap-3 neo-raised-sm neo-press rounded-[20px] p-4 text-left"
              >
                <div className="w-10 h-10 rounded-xl neo-inset-sm flex items-center justify-center shrink-0">
                  <ClipboardList size={20} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-foreground">Parte de hoy</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <EstadoParte estado={estados[control.id]} />
                  </div>
                </div>
              </button>
              <button
                onClick={() => navigate("/auditoria/formularios/cierre")}
                className="flex items-start gap-3 neo-raised-sm neo-press rounded-[20px] p-4 text-left"
              >
                <div className="w-10 h-10 rounded-xl neo-inset-sm flex items-center justify-center shrink-0">
                  <CalendarCheck size={20} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-foreground">Cierre del mes</p>
                  <p className="text-xs font-medium text-muted-foreground mt-1">KPI, equipos, novedades y síntesis</p>
                </div>
              </button>
            </div>
            <DiasMes
              anio={anio}
              mes={mes}
              partes={partesMes.map((p) => ({ fecha: p.fecha, data: leerParte(p.data) }))}
              onElegir={(f) => navigate(`/auditoria/formularios/parte?fecha=${f}`)}
            />
          </>
        ) : defs.length === 0 ? (
          <p className="neo-raised-sm rounded-[22px] p-5 text-sm text-muted-foreground">No hay formularios configurados para este hotel.</p>
        ) : (
          // Sin la migración 016 siguen vivos los formularios de antes.
          <div className="grid gap-3 sm:grid-cols-2">
            {defs.map((def) => (
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
                    <EstadoParte estado={estados[def.id]} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditHome;
