import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  /** Burbuja del usuario (rellena con el color principal) o del asistente (superficie). */
  sender: "user" | "bot";
}

const SPEEDS = [1, 1.5, 2];

const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

const AudioPlayer = ({ src, sender }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () => setDuration(a.duration);
    const onTime = () => setCurrent(a.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
      a.currentTime = 0;
    };
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("durationchange", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("durationchange", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const cycleSpeed = () => {
    const a = audioRef.current;
    if (!a) return;
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
    a.playbackRate = next;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const v = parseFloat(e.target.value);
    a.currentTime = (v / 100) * duration;
    setCurrent(a.currentTime);
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const display = playing || current > 0 ? current : duration;

  // Sobre la burbuja del usuario los controles usan el color "sobre principal";
  // sobre la del asistente (blanca), el de acento, que lee bien en ambos temas.
  const ink = sender === "user" ? "var(--neo-on-primary)" : "var(--neo-accent)";
  const paper = sender === "user" ? "var(--neo-primary)" : "#FFFFFF";

  return (
    <div className="flex items-center gap-3 min-w-[220px] sm:min-w-[270px] max-w-xs">
      <button
        onClick={togglePlay}
        className="neo-press w-9 h-9 sm:w-[38px] sm:h-[38px] rounded-full flex items-center justify-center shrink-0"
        style={{ background: ink, color: paper }}
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="translate-x-[1px]" />}
      </button>

      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div className="relative h-1.5 w-full">
          <div className="absolute inset-0 rounded-full opacity-25" style={{ background: ink }} />
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress}%`, background: ink }} />
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Progreso"
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow pointer-events-none transition-[left]"
            style={{ left: `calc(${progress}% - 6px)`, background: ink }}
          />
        </div>
      </div>

      <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: ink }}>
        {formatTime(display)}
      </span>

      <button
        onClick={cycleSpeed}
        className="text-[11px] font-extrabold rounded-full px-2 py-0.5 shrink-0"
        style={{ color: ink, boxShadow: `inset 0 0 0 1.5px ${ink}` }}
        aria-label="Cambiar velocidad"
      >
        {speed}×
      </button>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
};

export default AudioPlayer;
