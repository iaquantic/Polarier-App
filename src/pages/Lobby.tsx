import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  FolderOpen,
  Clock,
  Settings,
  ArrowRight,
  Search,
  Moon,
  Sun,
  ClipboardCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useRole } from "@/context/RoleContext";
import { getLatestChat, createChat, Chat } from "@/services/chat";
import { getDocuments } from "@/services/storage";
import ChatInput from "@/components/ChatInput";
import PolarierLogo from "@/components/PolarierLogo";

const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/octet-stream",
];

// ZIP/RAR llegan con file.type vacío o genérico: aceptamos también por extensión.
const ALLOWED_EXTENSIONS = /\.(pdf|xlsx|doc|docx|zip|rar)$/i;

const VALORES = "Excelencia · Proactividad · Innovación · Compromiso · Orientación al Cliente · Responsabilidad Ambiental";

interface GridOption {
  label: string;
  description: string;
  icon: typeof Search;
  action?: "upload";
  path?: string;
}

// Solo aparece a quien tiene algún rol en el módulo (admin o supervisor que además
// usa el chat; un auditor puro nunca llega al lobby).
const auditOption: GridOption = {
  label: "Auditoría",
  description: "Control de almacén del hotel",
  icon: ClipboardCheck,
  path: "/auditoria",
};

const gridOptions: GridOption[] = [
  {
    label: "Analizar documento",
    description: "Sube un archivo y pregúntale",
    icon: Search,
    action: "upload",
  },
  {
    label: "Mis documentos",
    description: "Todo lo que has subido",
    icon: FolderOpen,
    path: "/documents",
  },
  {
    label: "Historial",
    description: "Conversaciones anteriores",
    icon: Clock,
    path: "/history",
  },
  {
    label: "Configuración",
    description: "Perfil y preferencias",
    icon: Settings,
    path: "/settings",
  },
];

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Etiqueta del tipo de fichero: todas iguales, solo cambia el texto.
const fileBadge = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "xlsx" || ext === "xls") return "XLS";
  if (ext === "doc" || ext === "docx") return "DOC";
  if (ext === "pdf" || ext === "zip" || ext === "rar") return ext.toUpperCase();
  return "DOC";
};

const Lobby = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { hasAuditAccess } = useRole();
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [latestChat, setLatestChat] = useState<Chat | null>(null);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const userName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Usuario";
  const userInitials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w.charAt(0).toUpperCase())
      .join("") || "U";

  useEffect(() => {
    getLatestChat().then(setLatestChat).catch(() => {});
    getDocuments()
      .then((docs) => setRecentDocs(docs.slice(0, 4)))
      .catch(() => {});
  }, []);

  const startChatWith = async (state: { initialMessage?: string; initialFile?: File }) => {
    if (sending) return;
    setSending(true);
    try {
      const chat = await createChat("Nueva conversación");
      navigate(`/chat/${chat.id}`, { state });
    } catch {
      setSending(false);
    }
  };

  const handleSend = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    startChatWith({ initialMessage: trimmed });
  };

  // El chat ya sabe tratar un audio que llega como fichero inicial (lo sube y lo
  // manda a n8n como nota de voz), así que la nota grabada aquí va por el mismo camino.
  const handleFile = (file: File) => startChatWith({ initialFile: file });

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_DOC_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.test(file.name)) {
      alert("Solo se permiten archivos PDF, XLSX, DOC, DOCX, ZIP y RAR");
      return;
    }
    handleFile(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleGridClick = (opt: GridOption) => {
    if (opt.action === "upload") {
      fileRef.current?.click();
    } else if (opt.path) {
      navigate(opt.path);
    }
  };

  return (
    <div className="neo-ground polarier-pattern min-h-screen-dvh overflow-y-auto safe-top safe-bottom">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.xlsx,.doc,.docx,.zip,.rar"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="max-w-[980px] mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-14 flex flex-col gap-7 sm:gap-10">
        {/* ── BARRA SUPERIOR ── */}
        <header className="flex items-center justify-between gap-3">
          <span className="neo-raised-sm inline-flex items-center rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5">
            <PolarierLogo className="h-6 sm:h-[30px]" />
          </span>
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              className="neo-raised-sm neo-press neo-accent w-11 h-11 sm:w-[46px] sm:h-[46px] rounded-full flex items-center justify-center"
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              type="button"
              onClick={() => navigate("/settings")}
              aria-label="Tu perfil"
              className="neo-raised-sm neo-press flex items-center gap-2.5 rounded-full p-1.5 sm:pr-4"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <span className="neo-primary w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-extrabold" style={{ boxShadow: "none" }}>
                  {userInitials}
                </span>
              )}
              <span className="neo-text hidden sm:inline text-[13px] font-bold max-w-[160px] truncate">{userName}</span>
            </button>
          </div>
        </header>

        {/* ── HERO ── */}
        <section className="flex flex-col items-center text-center gap-2.5 sm:gap-3.5 pt-1 sm:pt-4">
          <p
            className="neo-strip neo-accent text-[10px] sm:text-xs leading-relaxed px-3 sm:px-4 py-1 sm:py-1.5 rounded-full max-w-[320px] sm:max-w-[640px]"
            style={{ fontFamily: "'Poppins', sans-serif", fontStyle: "italic", fontWeight: 400 }}
          >
            {VALORES}
          </p>
          <h1 className="neo-strip neo-text text-[27px] sm:text-[42px] leading-tight font-extrabold tracking-tight px-3 rounded-2xl">
            ¿Qué quieres hacer hoy?
          </h1>
          <p className="neo-strip neo-text-2 text-[13px] sm:text-[15px] font-medium px-3 py-0.5 rounded-xl">
            Analiza documentos, dicta una nota o pregunta lo que necesites
          </p>
        </section>

        {/* ── INPUT PRINCIPAL ── */}
        <section className="w-full">
          <ChatInput
            variant="lobby"
            value={query}
            onChange={setQuery}
            onSend={handleSend}
            onFileSelect={handleFile}
            onAudioSend={handleFile}
            disabled={sending}
            uploading={sending}
            autoFocus
            placeholder="Escribe o dicta tu pregunta…"
            hint="Enter para enviar · Micro para dictar · PDF, XLSX, DOC, DOCX, ZIP y RAR"
          />
        </section>

        {/* ── ACCESOS ── */}
        <section className={`grid grid-cols-2 gap-3.5 sm:gap-5 ${hasAuditAccess ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
          {(hasAuditAccess ? [auditOption, ...gridOptions] : gridOptions).map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => handleGridClick(opt)}
              className={`neo-raised neo-press flex items-center sm:items-start sm:flex-col gap-3 p-3.5 sm:p-5 rounded-[20px] sm:rounded-[22px] text-left ${
                opt === auditOption ? "col-span-2 sm:col-span-1" : ""
              }`}
            >
              <span className="neo-inset-sm neo-accent w-[38px] h-[38px] sm:w-11 sm:h-11 rounded-xl sm:rounded-[14px] flex items-center justify-center shrink-0">
                <opt.icon size={19} strokeWidth={1.9} />
              </span>
              <span className="min-w-0">
                <span className="neo-text block text-[12.5px] sm:text-sm font-extrabold leading-tight">{opt.label}</span>
                <span className="neo-text-2 hidden sm:block text-xs font-medium leading-snug mt-1.5">{opt.description}</span>
              </span>
            </button>
          ))}
        </section>

        {/* ── CONTINUAR DONDE LO DEJASTE ── */}
        {latestChat && (
          <section className="flex flex-col items-start gap-2.5 sm:gap-3.5">
            <h2 className="neo-strip neo-text-2 text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.12em] px-3 py-1 rounded-lg">
              Continuar donde lo dejaste
            </h2>
            <button
              type="button"
              onClick={() => navigate(`/chat/${latestChat.id}`)}
              className="neo-raised neo-press w-full flex items-center justify-between gap-4 px-4 py-3.5 sm:px-[22px] sm:py-[18px] rounded-[20px] sm:rounded-[22px] text-left"
            >
              <span className="flex items-center gap-3 sm:gap-4 min-w-0">
                <span className="neo-inset-sm neo-accent w-[38px] h-[38px] sm:w-11 sm:h-11 rounded-xl sm:rounded-[14px] flex items-center justify-center shrink-0">
                  <MessageSquare size={19} strokeWidth={1.9} />
                </span>
                <span className="min-w-0">
                  <span className="neo-text block text-[13px] sm:text-[15px] font-extrabold truncate">
                    {latestChat.title || "Sin título"}
                  </span>
                  <span className="neo-text-2 block text-[11px] sm:text-xs font-medium mt-0.5">
                    {new Date(latestChat.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </span>
                </span>
              </span>
              <span className="neo-raised-sm neo-accent hidden sm:inline-flex items-center gap-2 px-[18px] py-2.5 rounded-full text-[13px] font-extrabold shrink-0">
                Continuar <ArrowRight size={16} />
              </span>
              <ArrowRight size={18} className="neo-accent sm:hidden shrink-0" />
            </button>
          </section>
        )}

        {/* ── DOCUMENTOS RECIENTES ── */}
        {recentDocs.length > 0 && (
          <section className="flex flex-col gap-2.5 sm:gap-3.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="neo-strip neo-text-2 text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.12em] px-3 py-1 rounded-lg">
                Documentos recientes
              </h2>
              <button
                type="button"
                onClick={() => navigate("/documents")}
                className="neo-strip neo-accent text-xs font-bold px-3 py-1 rounded-lg hover:underline"
              >
                Ver todos
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5">
              {recentDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="neo-raised flex flex-col items-start gap-2 sm:gap-2.5 p-3.5 sm:p-[18px] rounded-[18px] sm:rounded-[20px] min-w-0"
                >
                  <span className="neo-primary inline-flex items-center justify-center w-[30px] h-[30px] sm:w-[34px] sm:h-[34px] rounded-[9px] sm:rounded-[10px] text-[9px] sm:text-[10px] font-extrabold tracking-wide" style={{ boxShadow: "none" }}>
                    {fileBadge(doc.file_name)}
                  </span>
                  <p className="neo-text text-[11.5px] sm:text-[13px] font-bold leading-snug truncate max-w-full">{doc.file_name}</p>
                  <p className="neo-text-2 text-[10px] sm:text-[11px] font-medium">{formatFileSize(doc.size_bytes)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Lobby;
