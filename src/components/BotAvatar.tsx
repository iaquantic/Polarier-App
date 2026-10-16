// Símbolo de Polarier. Toma el color del texto (currentColor): en el chat va dentro
// de un círculo en relieve con el color de acento del tema.
const BotAvatar = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 188.54 238.99"
    className={className}
    fill="currentColor"
    aria-hidden="true"
  >
    <g>
      <polygon points="103.13 167.64 135.36 154.06 188.54 228.91 153.77 238.99 103.13 167.64" />
      <polygon points="118.94 67.95 143.05 0 110.83 13.58 95.31 57.35 118.94 67.95" />
      <polygon points="32.22 38.59 0 52.17 50.61 123.52 26.53 191.47 57.07 182.63 82.84 109.94 32.22 38.59" />
    </g>
  </svg>
);

/** Círculo en relieve con el símbolo de Polarier, junto a cada mensaje del asistente. */
export const BotBadge = ({ size = "md" }: { size?: "sm" | "md" }) => (
  <span
    className={`neo-raised-sm neo-accent rounded-full flex items-center justify-center shrink-0 ${
      size === "sm" ? "w-[34px] h-[34px]" : "w-[34px] h-[34px] sm:w-10 sm:h-10"
    }`}
  >
    <BotAvatar className="w-[15px] h-[19px] sm:w-[17px] sm:h-[21px]" />
  </span>
);

export default BotAvatar;
