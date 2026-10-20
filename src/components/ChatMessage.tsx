import { useState } from "react";
import { X } from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";
import FileDownloadCard from "@/components/FileDownloadCard";
import { BotBadge } from "@/components/BotAvatar";

interface ChatMessageProps {
  sender: "bot" | "user";
  text: string;
  time: string;
}

type Parsed =
  | { kind: "text"; text: string }
  | { kind: "audio"; url: string; mime: string }
  | { kind: "image"; url: string; mime: string }
  | { kind: "file"; url: string; ext: string; label: string; text?: string };

const FILE_MARKER = /\[([^\]\n]+)\]\(([^)\s]+)\)\{\.file-download\|([^}\n]+)\}$/;

const parseMessage = (raw: string): Parsed => {
  const audioMatch = raw.match(/^\[([^\]]+)\]\(([^)]+)\)\{\.audio-player\|([^}]+)\}$/);
  if (audioMatch) {
    return { kind: "audio", url: audioMatch[2], mime: audioMatch[3] };
  }
  const imageMatch = raw.match(/^\[([^\]]+)\]\(([^)]+)\)\{\.image\|([^}]+)\}$/);
  if (imageMatch) {
    return { kind: "image", url: imageMatch[2], mime: imageMatch[3] };
  }
  // Fichero, solo o al final de un texto (p. ej. el resumen del agente de la
  // TABLA CA seguido de la tabla actualizada): el marcador va en su propia línea.
  const fileMatch = raw.match(FILE_MARKER);
  if (fileMatch && (fileMatch.index === 0 || raw[fileMatch.index - 1] === "\n")) {
    const text = raw.slice(0, fileMatch.index).trim();
    return { kind: "file", label: fileMatch[1], url: fileMatch[2], ext: fileMatch[3], ...(text && { text }) };
  }
  return { kind: "text", text: raw };
};

const ImageThumb = ({ url }: { url: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block rounded-lg overflow-hidden max-w-[260px] sm:max-w-xs hover:opacity-90 transition-opacity"
      >
        <img src={url} alt="Imagen" className="w-full h-auto object-cover" loading="lazy" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
          <img
            src={url}
            alt="Imagen ampliada"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

const Time = ({ time, align }: { time: string; align: "left" | "right" }) => (
  <span className={`neo-strip neo-text-2 inline-block text-[11px] font-semibold px-2 py-px rounded-md mt-1.5 ${align === "right" ? "self-end" : "self-start"}`}>
    {time}
  </span>
);

// Burbujas: el asistente en superficie en relieve; el usuario, rellena con el color principal.
const BOT_BUBBLE = "neo-raised-sm neo-text rounded-[6px_22px_22px_22px]";
const USER_BUBBLE = "neo-primary rounded-[22px_22px_6px_22px]";

const ChatMessage = ({ sender, text, time }: ChatMessageProps) => {
  const parsed = parseMessage(text);

  // Audio: burbuja compacta con el reproductor.
  if (parsed.kind === "audio") {
    if (sender === "bot") {
      return (
        <div className="flex items-start gap-3 max-w-2xl">
          <BotBadge />
          <div className="flex flex-col min-w-0">
            <div className={`${BOT_BUBBLE} px-2.5 py-2`}>
              <AudioPlayer src={parsed.url} sender="bot" />
            </div>
            <Time time={time} align="left" />
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-end max-w-2xl ml-auto">
        <div className={`${USER_BUBBLE} px-2.5 py-2`}>
          <AudioPlayer src={parsed.url} sender="user" />
        </div>
        <Time time={time} align="right" />
      </div>
    );
  }

  const onPrimary = sender === "user";
  let body: JSX.Element;
  if (parsed.kind === "file") {
    const card = <FileDownloadCard url={parsed.url} ext={parsed.ext} label={parsed.label} onPrimary={onPrimary} />;
    body = parsed.text ? (
      <div className="space-y-3.5">
        <span className="whitespace-pre-wrap block">{parsed.text}</span>
        {card}
      </div>
    ) : card;
  } else if (parsed.kind === "image") {
    body = <ImageThumb url={parsed.url} />;
  } else {
    body = <span className="whitespace-pre-wrap">{parsed.text}</span>;
  }

  const bubblePadding =
    parsed.kind === "image" ? "p-1.5" :
    parsed.kind === "file" && !parsed.text ? "p-2.5" :
    "px-4 py-3 sm:px-[18px] sm:py-4";

  if (sender === "bot") {
    return (
      <div className="flex items-start gap-2.5 sm:gap-3 max-w-2xl">
        <BotBadge />
        <div className="flex flex-col min-w-0">
          <div className={`${BOT_BUBBLE} text-[13px] sm:text-sm leading-relaxed font-medium ${bubblePadding}`}>
            {body}
          </div>
          <Time time={time} align="left" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end max-w-2xl ml-auto">
      <div className={`${USER_BUBBLE} text-[13px] sm:text-sm leading-relaxed font-medium text-left ${bubblePadding}`}>
        {body}
      </div>
      <Time time={time} align="right" />
    </div>
  );
};

export default ChatMessage;
