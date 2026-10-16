import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import AppSidebar from "./AppSidebar";

export interface LayoutContext {
  openSidebar: () => void;
}

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isChat = location.pathname.startsWith("/chat");

  return (
    // El mosaico Polarier es el fondo de todas las pestañas del menú y la barra lateral
    // flota sobre él. Fuera del chat, el contenido va en el ámbito .neo-ground, que
    // ajusta los tokens de shadcn para que esas páginas se lean sobre el mosaico.
    <div className="polarier-pattern flex h-screen-dvh w-full overflow-hidden">
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col h-screen-dvh overflow-hidden">
        {/* Mobile header — oculto en /chat porque Chat.tsx tiene su propio header con botón */}
        {!isChat && (
          <div className="neo-ground lg:hidden flex items-center px-4 pt-3 safe-top">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
              className="neo-raised-sm neo-press neo-accent w-11 h-11 rounded-full flex items-center justify-center"
            >
              <Menu size={20} />
            </button>
          </div>
        )}
        <main className={`flex-1 flex flex-col overflow-y-auto ${isChat ? "" : "neo-ground"}`}>
          <Outlet context={{ openSidebar: () => setSidebarOpen(true) } satisfies LayoutContext} />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
