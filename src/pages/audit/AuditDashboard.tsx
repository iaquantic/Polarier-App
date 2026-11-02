import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import DashboardControl from "@/components/audit/DashboardControl";
import DashboardMensual from "@/components/audit/DashboardMensual";
import { useRole } from "@/context/RoleContext";
import { getDefinicionControl } from "@/services/audit";

/**
 * Pantalla de inicio del módulo de auditoría (`/auditoria`): el dashboard de
 * control del hotel activo. Es lo primero que ve un auditor al entrar.
 *
 * Sale el del formulario unificado si el hotel ya lo tiene (migración 016). El
 * anterior sigue a un toque para consultar los meses rellenados con los tres
 * formularios de antes, cuyos partes tienen otra forma.
 */
const AuditDashboard = () => {
  const { activeHotel } = useRole();
  const [hayControl, setHayControl] = useState<boolean | null>(null);
  const [verAntiguo, setVerAntiguo] = useState(false);

  useEffect(() => {
    if (!activeHotel) return;
    getDefinicionControl(activeHotel.id)
      .then((d) => setHayControl(!!d))
      .catch(() => setHayControl(false));
  }, [activeHotel?.id]);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {hayControl === null ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : hayControl && !verAntiguo ? (
          <DashboardMensual onVerAntiguo={() => setVerAntiguo(true)} />
        ) : (
          <>
            <DashboardControl />
            {hayControl && (
              <button
                type="button"
                onClick={() => setVerAntiguo(false)}
                className="mt-4 text-xs font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Volver al dashboard del parte diario
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AuditDashboard;
