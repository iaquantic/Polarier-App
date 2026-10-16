import { useEffect, useRef, useState } from "react";
import { Paperclip, ArrowRight, Mic, X, Square, Trash2, Play, Pause } from "lucide-react";
import FilePreviewCard, { PendingFile } from "@/components/FilePreviewCard";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { VoiceRecorder } from "capacitor-voice-recorder";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onFileSelect?: (file: File) => void;
  onAudioSend?: (file: File) => void;
  uploading?: boolean;
  disabled?: boolean;
  pendingFile?: PendingFile | null;
  onRemovePendingFile?: () => void;
  onRetryPendingFile?: () => void;
  /** "chat": barra fija al pie del chat. "lobby": barra grande del lobby, sin envoltorio. */
  variant?: "chat" | "lobby";
  placeholder?: string;
  hint?: string;
  autoFocus?: boolean;
}

const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/octet-stream',
];

// ZIP/RAR (y a veces otros) llegan con file.type vacío o genérico:
// aceptamos también por extensión del nombre.
const ALLOWED_EXTENSIONS = /\.(pdf|xlsx|doc|docx|zip|rar)$/i;

const MAX_SECONDS = 120;

// Alturas de las barras que se mueven mientras se graba (solo decorativas).
const WAVE = [8, 14, 22, 30, 18, 11, 26, 34, 20, 13, 9, 17, 28, 32, 24, 15, 10, 19, 27, 33, 21, 12, 8, 16, 25, 30, 18, 11];

const pickAudioMime = (): string => {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
};

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

const base64ToFile = (base64: string, mimeType: string): File => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  const ext = mimeType.includes('aac') ? 'aac' : mimeType.includes('mp4') ? 'm4a' : 'webm';
  return new File([bytes], `audio-${Date.now()}.${ext}`, { type: mimeType });
};

type Phase = "idle" | "recording" | "review";

interface Recorded {
  file: File;
  url: string;
  seconds: number;
}

const ChatInput = ({
  value,
  onChange,
  onSend,
  onFileSelect,
  onAudioSend,
  uploading,
  disabled,
  pendingFile,
  onRemovePendingFile,
  onRetryPendingFile,
  variant = "chat",
  placeholder = "Escribe o graba un audio…",
  hint = "Formatos: PDF, XLSX, DOC, DOCX, ZIP, RAR y notas de voz",
  autoFocus,
}: ChatInputProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const nativeRecordingRef = useRef(false);
  const discardRef = useRef(false);
  const previewRef = useRef<HTMLAudioElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recorded, setRecorded] = useState<Recorded | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);

  const isNative = Capacitor.isNativePlatform();
  const lobby = variant === "lobby";

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_DOC_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.test(file.name)) {
      toast.error("Solo se permiten archivos PDF, XLSX, DOC, DOCX, ZIP y RAR");
      return;
    }
    onFileSelect?.(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // La nota grabada pasa a revisión: se puede escuchar, descartar o enviar.
  const toReview = (file: File) => {
    setRecorded({ file, url: URL.createObjectURL(file), seconds: elapsedRef.current });
    setPreviewPlaying(false);
    setPreviewTime(0);
    setPhase("review");
  };

  const resetToIdle = () => {
    clearTimer();
    elapsedRef.current = 0;
    setElapsed(0);
    setPhase("idle");
  };

  const stopRecording = async () => {
    clearTimer();
    if (isNative && nativeRecordingRef.current) {
      try {
        const result = await VoiceRecorder.stopRecording();
        nativeRecordingRef.current = false;
        const { recordDataBase64, mimeType } = result.value || ({} as any);
        if (recordDataBase64) {
          toReview(base64ToFile(recordDataBase64, mimeType || 'audio/aac'));
        } else {
          resetToIdle();
        }
      } catch (err: any) {
        toast.error(err.message || "Error al detener la grabación");
        nativeRecordingRef.current = false;
        resetToIdle();
      }
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // El intervalo necesita la versión actual de stopRecording.
  const stopRef = useRef(stopRecording);
  stopRef.current = stopRecording;

  const startTimer = () => {
    elapsedRef.current = 0;
    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= MAX_SECONDS) stopRef.current();
    }, 1000);
  };

  const startRecording = async () => {
    if (!onAudioSend) return;

    if (isNative) {
      try {
        const can = await VoiceRecorder.canDeviceVoiceRecord();
        if (!can.value) {
          toast.error("Tu dispositivo no soporta grabación de audio");
          return;
        }
        const perm = await VoiceRecorder.hasAudioRecordingPermission();
        if (!perm.value) {
          const req = await VoiceRecorder.requestAudioRecordingPermission();
          if (!req.value) {
            toast.error("Permiso de micrófono denegado");
            return;
          }
        }
        await VoiceRecorder.startRecording();
        nativeRecordingRef.current = true;
        setPhase("recording");
        startTimer();
      } catch (err: any) {
        toast.error(err.message || "No se pudo iniciar la grabación");
      }
      return;
    }

    // Web
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Tu navegador no soporta grabación de audio");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickAudioMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      discardRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTracks();
        clearTimer();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (discardRef.current || blob.size === 0) {
          resetToIdle();
          return;
        }
        const type = recorder.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        toReview(new File([blob], `audio-${Date.now()}.${ext}`, { type: blob.type }));
      };

      recorder.start();
      setPhase("recording");
      startTimer();
    } catch (err: any) {
      toast.error(err.message || "No se pudo acceder al micrófono");
    }
  };

  const cancelRecording = async () => {
    if (isNative && nativeRecordingRef.current) {
      try {
        await VoiceRecorder.stopRecording();
      } catch {}
      nativeRecordingRef.current = false;
      resetToIdle();
      return;
    }
    chunksRef.current = [];
    discardRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      stopTracks();
      resetToIdle();
    }
  };

  const discardRecorded = () => {
    previewRef.current?.pause();
    if (recorded) URL.revokeObjectURL(recorded.url);
    setRecorded(null);
    resetToIdle();
  };

  const sendRecorded = () => {
    if (!recorded) return;
    previewRef.current?.pause();
    onAudioSend?.(recorded.file);
    URL.revokeObjectURL(recorded.url);
    setRecorded(null);
    resetToIdle();
  };

  const togglePreview = () => {
    const a = previewRef.current;
    if (!a) return;
    if (previewPlaying) {
      a.pause();
      setPreviewPlaying(false);
    } else {
      a.play().then(() => setPreviewPlaying(true)).catch(() => setPreviewPlaying(false));
    }
  };

  // Al salir de la pantalla: micrófono apagado y sin URLs colgando.
  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
      if (nativeRecordingRef.current) VoiceRecorder.stopRecording().catch(() => {});
    };
  }, []);
  useEffect(() => {
    return () => {
      if (recorded) URL.revokeObjectURL(recorded.url);
    };
  }, [recorded]);

  const canSend = !!value.trim() && !disabled;
  const sideBtn = lobby ? "w-11 h-11 sm:w-12 sm:h-12" : "w-11 h-11";
  const mainBtn = lobby ? "w-12 h-12 sm:w-[52px] sm:h-[52px]" : "w-11 h-11 sm:w-12 sm:h-12";
  const bar = `neo-inset flex items-center gap-2 sm:gap-3 rounded-[28px] ${lobby ? "px-2.5 py-2 sm:px-3.5 sm:py-3" : "px-2 py-2 sm:px-3"}`;
  const reviewProgress = recorded && recorded.seconds > 0 ? Math.min(100, (previewTime / recorded.seconds) * 100) : 0;

  const content = (
    <>
      {pendingFile && (
        <div className="mb-3">
          <FilePreviewCard
            pendingFile={pendingFile}
            onRemove={() => onRemovePendingFile?.()}
            onRetry={() => onRetryPendingFile?.()}
          />
        </div>
      )}

      {phase === "recording" && (
        <div className={bar}>
          <button
            type="button"
            onClick={cancelRecording}
            aria-label="Cancelar grabación"
            className={`neo-raised-sm neo-press neo-danger ${sideBtn} rounded-full flex items-center justify-center shrink-0`}
          >
            <X size={19} strokeWidth={2.2} />
          </button>
          <span className="flex items-center gap-2 shrink-0" aria-live="polite">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B3261E] animate-pulse" />
            <span className="neo-text text-sm font-extrabold tabular-nums">{formatTime(elapsed)}</span>
            <span className="sr-only">Grabando</span>
          </span>
          <span className="neo-wave flex-1 min-w-0 flex items-center gap-[3px] h-8 overflow-hidden" aria-hidden="true">
            {WAVE.map((h, i) => (
              <span key={i} className="flex-1 min-w-[2px] rounded-sm bg-[#B3261E]" style={{ height: h }} />
            ))}
          </span>
          <button
            type="button"
            onClick={() => stopRecording()}
            aria-label="Terminar la grabación"
            className={`neo-press ${mainBtn} rounded-full flex items-center justify-center shrink-0 bg-[#B3261E] text-white`}
            style={{ boxShadow: "5px 5px 12px var(--neo-sd), -5px -5px 12px var(--neo-sl)" }}
          >
            <Square size={17} fill="currentColor" />
          </button>
        </div>
      )}

      {phase === "review" && recorded && (
        <div className={bar}>
          <button
            type="button"
            onClick={discardRecorded}
            aria-label="Descartar la nota de voz"
            className={`neo-raised-sm neo-press neo-danger ${sideBtn} rounded-full flex items-center justify-center shrink-0`}
          >
            <Trash2 size={18} />
          </button>
          <div className="neo-raised-sm flex-1 min-w-0 flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4">
            <button
              type="button"
              onClick={togglePreview}
              aria-label={previewPlaying ? "Pausar la nota" : "Escuchar la nota"}
              className="neo-primary neo-press w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ boxShadow: "none" }}
            >
              {previewPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="translate-x-[1px]" />}
            </button>
            <span className="relative flex-1 min-w-0 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--neo-well)" }}>
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${reviewProgress}%`, background: "var(--neo-primary)" }} />
            </span>
            <span className="neo-text text-xs font-extrabold tabular-nums shrink-0">{formatTime(recorded.seconds)}</span>
            <audio
              ref={previewRef}
              src={recorded.url}
              preload="metadata"
              onTimeUpdate={(e) => setPreviewTime(e.currentTarget.currentTime)}
              onEnded={() => {
                setPreviewPlaying(false);
                setPreviewTime(0);
              }}
            />
          </div>
          <button
            type="button"
            onClick={sendRecorded}
            disabled={disabled}
            aria-label="Enviar la nota de voz"
            className={`neo-primary neo-press ${mainBtn} rounded-full flex items-center justify-center shrink-0`}
          >
            <ArrowRight size={20} strokeWidth={2.2} />
          </button>
        </div>
      )}

      {phase === "idle" && (
        <div className={bar}>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.xlsx,.doc,.docx,.zip,.rar"
            className="hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Adjuntar archivo"
            className={`neo-raised-sm neo-press neo-accent ${sideBtn} rounded-full flex items-center justify-center shrink-0`}
          >
            <Paperclip size={19} />
          </button>
          <label htmlFor={`chat-input-${variant}`} className="sr-only">
            {placeholder}
          </label>
          <input
            id={`chat-input-${variant}`}
            type="text"
            autoFocus={autoFocus}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canSend && onSend()}
            disabled={disabled}
            className={`neo-text neo-placeholder flex-1 min-w-0 bg-transparent outline-none px-1 py-2 disabled:opacity-50 ${lobby ? "text-[15px] sm:text-base" : "text-[15px]"}`}
          />
          {onAudioSend && (
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled}
              aria-label="Grabar nota de voz"
              className={`neo-raised-sm neo-press neo-accent ${mainBtn} rounded-full flex items-center justify-center shrink-0`}
            >
              <Mic size={21} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Enviar"
            // En móvil, sin texto, solo se ve el micro: Enviar aparece al escribir.
            className={`neo-primary neo-press ${mainBtn} rounded-full items-center justify-center shrink-0 ${
              onAudioSend && !value.trim() ? "hidden sm:flex" : "flex"
            }`}
          >
            <ArrowRight size={20} strokeWidth={2.2} />
          </button>
        </div>
      )}

      {hint && (
        <p className="text-center mt-2.5">
          <span className="neo-strip neo-text-2 inline-block text-[11px] sm:text-xs font-medium px-3 py-0.5 rounded-lg">
            {phase === "recording" ? "Pulsa el cuadrado para terminar · la X cancela" : hint}
          </span>
        </p>
      )}
    </>
  );

  if (lobby) return <div className="w-full">{content}</div>;

  return (
    <div className="px-3 sm:px-6 pt-2 pb-3 sm:pb-5 safe-bottom">
      <div className="max-w-3xl mx-auto">{content}</div>
    </div>
  );
};

export default ChatInput;
