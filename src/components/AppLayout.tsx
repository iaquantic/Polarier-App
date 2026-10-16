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
    // En el chat, el mosaico Polarier hace de fondo de toda la pantalla y la barra
    // lateral flota sobre él; el resto de páginas conservan su fondo.
    <div className={`flex h-screen-dvh w-full overflow-hidden ${isChat ? "polarier-pattern" : "bg-background"}`}>
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col h-screen-dvh overflow-hidden">
        {/* Mobile header — oculto en /chat porque Chat.tsx tiene su propio header con botón */}
        {!isChat && (
          <div className="lg:hidden flex items-center px-4 py-3 border-b border-border bg-card safe-top">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <Menu size={22} />
            </button>
          </div>
        )}
        <main className="flex-1 flex flex-col overflow-y-auto">
          <Outlet context={{ openSidebar: () => setSidebarOpen(true) } satisfies LayoutContext} />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
