import { useCallback } from "react";
import { Download } from "lucide-react";

// Tarjeta de descarga de un fichero devuelto por n8n. Vivía dentro de
// ChatMessage; se saca aquí porque la sección de Automatizaciones muestra el
// mismo resultado fuera de una conversación.

const withDownloadParam = (url: string, fileName: string) => {
  try {
    const u = new URL(url);
    u.searchParams.set("download", fileName);
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}download=${encodeURIComponent(fileName)}`;
  }
};

// Etiqueta del tipo de fichero: todas iguales (color principal), solo cambia el texto.
const badgeFor = (ext: string) => {
  const e = ext.toLowerCase();
  if (e === "xlsx" || e === "xls") return "XLS";
  if (e === "docx" || e === "doc") return "DOC";
  return e.slice(0, 3).toUpperCase() || "DOC";
};

interface FileDownloadCardProps {
  url: string;
  ext: string;
  label: string;
  /** Dentro de una burbuja rellena con el color principal (mensaje del usuario). */
  onPrimary?: boolean;
}

const FileDownloadCard = ({ url, ext, label, onPrimary }: FileDownloadCardProps) => {
  const handleDownload = useCallback(() => {
    const downloadUrl = withDownloadParam(url, label);
    window.open(downloadUrl, "_system");
  }, [url, label]);

  return (
    <button
      type="button"
      onClick={handleDownload}
      className={`flex items-center gap-3 w-full min-w-[220px] max-w-[320px] rounded-2xl py-2.5 pl-3 pr-2.5 text-left group ${
        onPrimary ? "bg-white/10" : "neo-inset-sm"
      }`}
    >
      <span
        className={`w-[38px] h-[38px] rounded-[11px] flex items-center justify-center shrink-0 text-[10px] font-extrabold tracking-wide ${
          onPrimary ? "bg-white text-[var(--neo-primary)]" : "neo-primary"
        }`}
        style={onPrimary ? undefined : { boxShadow: "none" }}
      >
        {badgeFor(ext)}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-[13px] font-bold truncate leading-tight ${onPrimary ? "" : "neo-text"}`}>{label}</span>
        <span className={`block text-[11px] font-semibold uppercase mt-0.5 ${onPrimary ? "opacity-80" : "neo-text-2"}`}>{ext}</span>
      </span>
      <span className="neo-raised-sm neo-accent w-10 h-10 rounded-full flex items-center justify-center shrink-0 group-active:scale-95 transition-transform">
        <Download size={17} strokeWidth={2.1} />
      </span>
    </button>
  );
};

export default FileDownloadCard;
