import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, ClipboardList, Clock, LayoutDashboard, LogOut, Sun, Moon } from "lucide-react";
import PolarierLogo from "@/components/PolarierLogo";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useRole } from "@/context/RoleContext";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/auditoria" },
  { label: "Formularios de Control", icon: ClipboardList, path: "/auditoria/formularios" },
  { label: "Histórico", icon: Clock, path: "/auditoria/historico" },
];

/**
 * Layout dedicado al auditor: navegación reducida (formularios + histórico),
 * sin chat ni documentos. Mismo diseño que el chat: mosaico Polarier de fondo,
 * barra lateral blanca en relieve y contenido en el ámbito .neo-audit
 * (vault/Diseno-Neoformista.md). Solo lo ve el auditor puro: quien además usa
 * el chat recorre el módulo dentro de AppLayout (desplegable «Auditoría»).
 */
const AuditLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { activeHotel } = useRole();

  const handleNav = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const userEmail = user?.email ?? "";
  const userName = profile?.full_name || userEmail.split("@")[0];
  const userInitial = userName?.charAt(0).toUpperCase() || "U";

  const itemClass = (active: boolean) =>
    `relative flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-sm w-full text-left transition-colors ${
      active ? "neo-inset-sm neo-accent font-extrabold" : "neo-text font-bold hover:bg-[var(--neo-well)]"
    }`;

  return (
    <div className="polarier-pattern flex h-screen-dvh w-full overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`neo-chat neo-raised fixed lg:static top-0 left-0 z-50 h-screen-dvh lg:h-auto lg:my-4 lg:ml-4 w-[272px] shrink-0 flex flex-col rounded-r-[28px] lg:rounded-[28px] transition-transform duration-200 safe-top safe-bottom ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-6 pt-6 pb-4 flex items-center">
          <PolarierLogo tone="azul" className="h-[30px]" />
        </div>

        {activeHotel && (
          <div className="neo-inset-sm mx-3 mb-4 rounded-2xl px-4 py-3">
            {activeHotel.polo?.nombre && (
              <>
                <p className="neo-text-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">Polo turístico</p>
                <p className="neo-text text-[13px] font-bold truncate mb-2">{activeHotel.polo.nombre}</p>
              </>
            )}
            <p className="neo-text-2 text-[10px] font-extrabold uppercase tracking-[0.12em]">Hotel</p>
            <p className="neo-accent text-[13px] font-extrabold truncate">{activeHotel.nombre}</p>
          </div>
        )}

        <nav className="flex-1 flex flex-col gap-1.5 px-3 overflow-y-auto min-h-0">
          {navItems.map((item) => {
            // "Formularios de Control" queda marcado también al rellenar un parte
            // (`/auditoria/formulario/:defId`, en singular).
            const active =
              item.path === "/auditoria"
                ? location.pathname === "/auditoria"
                : item.path === "/auditoria/formularios"
                  ? location.pathname.startsWith("/auditoria/formulario")
                  : location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                <item.icon size={18} className="neo-accent" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-4 pt-4 pb-5 flex flex-col gap-3.5">
          <div className="flex items-center gap-3 min-w-0 px-1">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-[38px] h-[38px] rounded-full object-cover shrink-0" />
            ) : (
              <div className="neo-primary w-[38px] h-[38px] rounded-full flex items-center justify-center text-[13px] font-extrabold shrink-0" style={{ boxShadow: "none" }}>
                {userInitial}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="neo-text text-[13px] font-extrabold truncate">{userName}</span>
              <span className="neo-text-2 text-[11px] font-medium truncate">{userEmail}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2.5">
            <button
              onClick={handleLogout}
              className="neo-white-btn neo-press neo-accent flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-bold"
            >
              <LogOut size={16} />
              <span>Cerrar sesión</span>
            </button>
            <button
              onClick={toggleTheme}
              className="neo-white-btn neo-press neo-accent w-11 h-11 rounded-full flex items-center justify-center"
              title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
              aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </aside>

      <div className="neo-audit flex-1 flex flex-col h-screen-dvh overflow-hidden min-w-0">
        <div className="lg:hidden flex items-center px-4 pt-3 safe-top">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            className="neo-raised-sm neo-press neo-accent w-11 h-11 rounded-full flex items-center justify-center"
          >
            <Menu size={20} />
          </button>
        </div>
        <main className="flex-1 flex flex-col overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AuditLayout;
