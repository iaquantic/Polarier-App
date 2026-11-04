// -----------------------------------------------------------------------------
// Piezas comunes de las pantallas del formulario de control.
// -----------------------------------------------------------------------------
import type { ReactNode } from "react";

const fmtEs = (n: number, dec = 2): string =>
  n.toLocaleString("es-ES", { maximumFractionDigits: dec });

/** Un indicador tal como sale: la cifra formateada, el texto o «—» si está vacío. */
export const fmtCelda = (v: unknown, dec = 2): string => {
  if (typeof v === "number") return fmtEs(v, dec);
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
};

export type Tono = "ok" | "aviso" | "mal" | "info" | "gris";

const CLASE_TONO: Record<Tono, string> = {
  ok: "bg-emerald-100 text-emerald-900",
  aviso: "bg-amber-100 text-amber-900",
  mal: "bg-red-100 text-red-900",
  info: "bg-primary/10 text-primary",
  gris: "bg-muted text-muted-foreground",
};

export const Chip = ({ tono, children, title }: { tono: Tono; children: ReactNode; title?: string }) => (
  <span
    title={title}
    className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap ${CLASE_TONO[tono]}`}
  >
    {children}
  </span>
);

/** De los textos de estado de las hojas a su color. El texto va siempre visible. */
export const tonoDe = (estado: unknown): Tono => {
  switch (estado) {
    case "Completo":
    case "Cumple":
    case "Conforme":
    case "Validado":
    case "Informado":
    case "Cerrada":
    case "Cerrado":
    case "Actualizado":
    case "Registros completos":
    case "En plazo":
    case "Sí":
      return "ok";
    case "Revisar":
    case "Revisar diferencia":
    case "Revisar detalle":
    case "Revisar duplicado":
    case "Revisar duplicados":
    case "Revisar cantidades":
    case "Revisar pactadas":
    case "No cumple":
    case "Vencida":
    case "Faltante":
      return "mal";
    case "Completar":
    case "Completar detalle":
    case "Completar plazo":
    case "Completar pactadas":
    case "Completar / revisar":
    case "Pendiente":
    case "Parcial":
    case "Sobrante":
    case "Abierta":
    case "En seguimiento":
    case "En curso":
    case "No":
    case "Por confirmar":
      return "aviso";
    default:
      return "gris";
  }
};

export const BotonSecundario = ({
  children,
  onClick,
  disabled,
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`neo-raised-sm neo-press neo-accent inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-full px-4 text-sm font-bold ${className}`}
  >
    {children}
  </button>
);
