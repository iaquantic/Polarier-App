import { FileText, FileSpreadsheet, File, X, RotateCcw, Check, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export type FileUploadStatus = "pending" | "uploading" | "uploaded" | "error";

export interface PendingFile {
  file: File;
  status: FileUploadStatus;
  progress: number;
  error?: string;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText size={20} className="text-red-500" />;
  if (ext === "xlsx" || ext === "xls") return <FileSpreadsheet size={20} className="text-green-600" />;
  if (ext === "doc" || ext === "docx") return <FileText size={20} className="text-blue-500" />;
  return <File size={20} className="neo-text-2" />;
};

const statusLabel: Record<FileUploadStatus, string> = {
  pending: "Pendiente",
  uploading: "Subiendo...",
  uploaded: "Subido",
  error: "Error",
};

interface Props {
  pendingFile: PendingFile;
  onRemove: () => void;
  onRetry: () => void;
}

const FilePreviewCard = ({ pendingFile, onRemove, onRetry }: Props) => {
  const { file, status, progress, error } = pendingFile;

  return (
    <div className="neo-raised-sm flex items-center gap-3 rounded-2xl px-3.5 py-2.5 max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex-shrink-0">{getFileIcon(file.name)}</div>

      <div className="flex-1 min-w-0">
        <p className="neo-text text-sm font-bold truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs neo-text-2">{formatSize(file.size)}</span>
          <span className="text-xs neo-text-2">·</span>
          <span
            className={`text-xs font-medium ${
              status === "error"
                ? "text-destructive"
                : status === "uploaded"
                ? "text-green-600"
                : "neo-text-2"
            }`}
          >
            {statusLabel[status]}
          </span>
        </div>

        {status === "uploading" && (
          <Progress value={progress} className="h-1 mt-1.5" />
        )}
      </div>

      <div className="flex-shrink-0 flex items-center gap-1">
        {status === "uploading" && (
          <>
            <Loader2 size={16} className="neo-text-2 animate-spin" />
            <button onClick={onRemove} title="Cancelar" className="neo-text-2 hover:text-foreground transition-colors ml-1">
              <X size={16} />
            </button>
          </>
        )}
        {status === "uploaded" && <Check size={16} className="text-green-600" />}
        {status === "error" && (
          <>
            <button onClick={onRetry} className="neo-text-2 hover:text-foreground transition-colors">
              <RotateCcw size={16} />
            </button>
            <button onClick={onRemove} className="neo-text-2 hover:text-foreground transition-colors ml-1">
              <X size={16} />
            </button>
          </>
        )}
        {status === "pending" && (
          <button onClick={onRemove} className="neo-text-2 hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default FilePreviewCard;
