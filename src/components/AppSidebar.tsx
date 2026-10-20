import { MessageSquare, FolderOpen, Clock, Settings, LogOut, Sun, Moon, ClipboardCheck, Workflow, ChevronDown } from "lucide-react";
import PolarierLogo from "@/components/PolarierLogo";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useRole } from "@/context/RoleContext";
import { useEffect, useState } from "react";
import { getChats, Chat } from "@/services/chat";
import { AUTOMATIZACIONES } from "@/lib/automatizaciones";

const navItems = [
  { label: "Chat", icon: MessageSquare, path: "/chat" },
  { label: "Mis Documentos", icon: FolderOpen, path: "/documents" },
  { label: "Historial", icon: Clock, path: "/history" },
  { label: "Configuración", icon: Settings, path: "/settings" },
];

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const AppSidebar = ({ isOpen, onClose }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { hasAuditAccess } = useRole();
  const [chats, setChats] = useState<Chat[]>([]);
  // El submenú se abre solo cuando estás dentro de la sección, y se puede
  // plegar a mano sin salir de ella.
  const enAutomatizaciones = location.pathname.startsWith("/automatizaciones");
  const [autosOpen, setAutosOpen] = useState(enAutomatizaciones);

  useEffect(() => {
    if (enAutomatizaciones) setAutosOpen(true);
  }, [enAutomatizaciones]);

  const refreshChats = () => getChats().then(setChats).catch(() => {});

  useEffect(() => {
    refreshChats();
  }, [location.pathname]);

  useEffect(() => {
    window.addEventListener('chat-title-updated', refreshChats);
    return () => window.removeEventListener('chat-title-updated', refreshChats);
  }, []);

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const userEmail = user?.email ?? "";
  const userName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || userEmail.split("@")[0];
  const userInitial = userName?.charAt(0).toUpperCase() || "U";

  // Barra lateral blanca en relieve (diseño neoformista, ámbito .neo-chat). En escritorio
  // flota con margen sobre el fondo; en móvil es un cajón que entra por la izquierda.
  const itemClass = (active: boolean) =>
    `relative flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-sm w-full text-left transition-colors ${
      active ? "neo-inset-sm neo-accent font-extrabold" : "neo-text font-bold hover:bg-[var(--neo-well)]"
    }`;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`neo-chat neo-raised fixed lg:static top-0 left-0 z-50 h-screen-dvh lg:h-auto lg:my-4 lg:ml-4 w-[272px] shrink-0 flex flex-col rounded-r-[28px] lg:rounded-[28px] transition-transform duration-200 safe-top safe-bottom ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <button onClick={() => navigate("/lobby")} className="px-6 pt-6 pb-5 flex items-center hover:opacity-80 transition-opacity" aria-label="Ir al inicio">
          <PolarierLogo tone="azul" className="h-[30px]" />
        </button>

        <nav className="flex-1 flex flex-col gap-1.5 px-3 overflow-y-auto min-h-0">
          {/* Auditoría: solo para quien tiene algún rol en el módulo. Un auditor
              puro nunca llega a este sidebar (vive en AuditLayout); esto es la
              puerta de entrada de administradores y supervisores, que además
              usan el chat y aterrizan en el lobby. */}
          {hasAuditAccess && (
            <button onClick={() => handleNav("/auditoria")} className={itemClass(false)}>
              <ClipboardCheck size={18} className="neo-accent" />
              <span>Auditoría</span>
            </button>
          )}

          {/* Automatizaciones: un apartado por rama de n8n. El chat sigue
              aceptando ficheros, pero aquí se sabe qué pide cada proceso. */}
          <button
            onClick={() => setAutosOpen((v) => !v)}
            aria-expanded={autosOpen}
            className={itemClass(enAutomatizaciones)}
          >
            <Workflow size={18} className="neo-accent" />
            <span className="flex-1">Automatizaciones</span>
            <ChevronDown
              size={15}
              className={`neo-accent transition-transform ${autosOpen ? "" : "-rotate-90"}`}
            />
          </button>

          {autosOpen && (
            <div className="flex flex-col gap-0.5 ml-[26px] pl-3 border-l-2 border-[var(--neo-well)]">
              {AUTOMATIZACIONES.map((auto) => {
                const active = location.pathname === `/automatizaciones/${auto.slug}`;
                return (
                  <button
                    key={auto.slug}
                    onClick={() => handleNav(`/automatizaciones/${auto.slug}`)}
                    aria-current={active ? "page" : undefined}
                    className={`text-left text-[13px] px-3 py-2 rounded-xl transition-colors ${
                      active
                        ? "neo-inset-sm neo-accent font-extrabold"
                        : "neo-text-2 font-semibold hover:bg-[var(--neo-well)]"
                    }`}
                  >
                    {auto.nombre}
                  </button>
                );
              })}
            </div>
          )}

          {navItems.map((item) => {
            const active = location.pathname === item.path || (item.path === "/chat" && location.pathname.startsWith("/chat"));
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

          {/* Chat list */}
          {chats.length > 0 && (
            <div className="mt-4 flex flex-col gap-1">
              <p className="neo-text-2 text-[11px] font-extrabold uppercase tracking-[0.12em] px-3.5 pb-1.5">Conversaciones</p>
              {chats.slice(0, 10).map((chat) => {
                const active = location.pathname === `/chat/${chat.id}`;
                return (
                  <button
                    key={chat.id}
                    onClick={() => handleNav(`/chat/${chat.id}`)}
                    className={`w-full text-left text-[13px] px-3.5 py-2 rounded-xl truncate transition-colors ${
                      active ? "neo-inset-sm neo-accent font-bold" : "neo-text font-semibold hover:bg-[var(--neo-well)]"
                    }`}
                  >
                    {chat.title}
                  </button>
                );
              })}
            </div>
          )}
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
    </>
  );
};

export default AppSidebar;
