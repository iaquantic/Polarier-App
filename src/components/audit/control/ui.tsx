// -----------------------------------------------------------------------------
// Piezas comunes del parte diario y del cierre del mes.
//
// Convenio del Excel: blanco para rellenar, azul claro para lo que se calcula solo.
// Las tablas son una sola estructura: filas de tarjeta en móvil y columnas en
// escritorio, cambiando `grid-cols` y mostrando la etiqueta solo en móvil.
// -----------------------------------------------------------------------------
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Num } from "@/lib/control";

const fmtEs = (n: number, dec = 2): string =>
  n.toLocaleString("es-ES", { maximumFractionDigits: dec });

/** Un indicador tal como sale: la cifra formateada, el texto o «—» si está vacío. */
export const fmtCelda = (v: unknown, dec = 2): string => {
  if (typeof v === "number") return fmtEs(v, dec);
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
};

// «1:30» → 1,5 h. El Excel pide 1,50, pero en la lavandería se piensa en reloj.
const parsear = (texto: string, tipo: TipoNumero): Num => {
  const t = texto.trim();
  if (t === "") return null;
  if (tipo === "horas" && t.includes(":")) {
    const [h, m] = t.split(":");
    const horas = Number(h || 0);
    const minutos = Number(m || 0);
    return Number.isFinite(horas) && Number.isFinite(minutos) ? horas + minutos / 60 : null;
  }
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const mostrar = (v: Num, tipo: TipoNumero): string => {
  if (v === null || v === undefined) return "";
  if (tipo === "entero") return String(v);
  return String(Math.round(v * 100) / 100).replace(".", ",");
};

export type TipoNumero = "entero" | "decimal" | "horas";

const PATRON: Record<TipoNumero, RegExp> = {
  entero: /^\d*$/,
  decimal: /^\d*([.,]\d*)?$/,
  horas: /^\d*([.,:]\d*)?$/,
};

export const claseInput =
  "neo-field w-full h-10 rounded-[10px] px-2.5 text-sm font-semibold outline-none border-0 placeholder:text-[#5A6080] placeholder:font-medium focus:ring-2 focus:ring-primary/40 disabled:opacity-70";

/**
 * Número que distingue vacío de 0. Guarda el texto mientras se escribe para no
 * perder la coma de «1,» al reformatear, y no admite negativos: el Excel los
 * rechaza con su validación de datos.
 */
export const CampoNumero = ({
  value,
  onChange,
  tipo = "entero",
  readOnly,
  placeholder,
  etiqueta,
  id,
  className = "",
}: {
  value: Num;
  onChange: (v: Num) => void;
  tipo?: TipoNumero;
  readOnly?: boolean;
  placeholder?: string;
  etiqueta?: string;
  id?: string;
  className?: string;
}) => {
  const [texto, setTexto] = useState(mostrar(value, tipo));
  const editando = useRef(false);

  useEffect(() => {
    if (!editando.current) setTexto(mostrar(value, tipo));
  }, [value, tipo]);

  return (
    <input
      id={id}
      type="text"
      inputMode={tipo === "entero" ? "numeric" : "decimal"}
      aria-label={etiqueta}
      disabled={readOnly}
      value={texto}
      placeholder={placeholder}
      onFocus={() => {
        editando.current = true;
      }}
      onBlur={() => {
        editando.current = false;
        setTexto(mostrar(value, tipo));
      }}
      onChange={(e) => {
        const t = e.target.value;
        if (!PATRON[tipo].test(t)) return;
        setTexto(t);
        onChange(parsear(t, tipo));
      }}
      className={`${claseInput} text-right tabular-nums ${className}`}
    />
  );
};

export const CampoTexto = ({
  value,
  onChange,
  readOnly,
  placeholder,
  etiqueta,
  id,
  tipo = "text",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  etiqueta?: string;
  id?: string;
  tipo?: "text" | "date" | "time";
  className?: string;
}) => (
  <input
    id={id}
    type={tipo}
    aria-label={etiqueta}
    disabled={readOnly}
    value={value ?? ""}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className={`${claseInput} ${className}`}
  />
);

export const CampoAreaTexto = ({
  value,
  onChange,
  readOnly,
  id,
  etiqueta,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  id?: string;
  etiqueta?: string;
}) => (
  <textarea
    id={id}
    aria-label={etiqueta}
    disabled={readOnly}
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value)}
    rows={4}
    className="neo-field w-full rounded-xl p-3 text-sm font-medium leading-relaxed outline-none border-0 resize-y focus:ring-2 focus:ring-primary/40 disabled:opacity-70"
  />
);

/** Etiqueta + campo. */
export const Campo = ({
  label,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={`min-w-0 ${className}`}>
    <label htmlFor={htmlFor} className="block text-[11px] font-bold text-muted-foreground mb-1">
      {label}
    </label>
    {children}
  </div>
);

/** Celda de lo que se calcula solo (azul claro en el Excel). */
export const Calculado = ({
  children,
  tono,
  className = "",
}: {
  children: ReactNode;
  tono?: "mal";
  className?: string;
}) => (
  <span
    className={`flex items-center justify-end h-10 rounded-[10px] px-2.5 text-sm font-extrabold tabular-nums ${
      tono === "mal" ? "bg-red-100 text-red-800" : "bg-[#DCE3F7] text-[#30397F]"
    } ${className}`}
  >
    {children}
  </span>
);

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

/** Selector de pocas opciones, siempre a la vista: un toque en vez de un desplegable. */
export const Seg = <T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
  readOnly,
  className = "",
}: {
  opciones: readonly T[];
  valor: T | "" | null | undefined;
  onChange: (v: T) => void;
  etiqueta: string;
  readOnly?: boolean;
  className?: string;
}) => (
  <div
    role="group"
    aria-label={etiqueta}
    className={`inline-flex flex-wrap gap-0.5 p-1 rounded-full neo-inset-sm ${className}`}
  >
    {opciones.map((o) => (
      <button
        key={o}
        type="button"
        disabled={readOnly}
        aria-pressed={valor === o}
        onClick={() => onChange(o)}
        className={`min-h-[36px] px-3 rounded-full text-xs font-bold transition-colors disabled:cursor-not-allowed ${
          valor === o ? "neo-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {o}
      </button>
    ))}
  </div>
);

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

export const BotonPrincipal = ({
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
    className={`neo-primary neo-press inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-full px-5 text-sm font-extrabold ${className}`}
  >
    {children}
  </button>
);

/** Botón pequeño dentro de una fila: «Todo conforme», añadir prenda… */
export const BotonFila = ({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="inline-flex items-center justify-center gap-1 min-h-[34px] rounded-full bg-primary/10 text-primary px-3 text-xs font-extrabold hover:bg-primary/15 transition-colors disabled:opacity-50"
  >
    {children}
  </button>
);

/** Sección en relieve con título, ayuda y totales a la derecha. */
export const Bloque = ({
  titulo,
  ayuda,
  extra,
  children,
}: {
  titulo: string;
  ayuda?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}) => (
  <section className="neo-raised-sm rounded-[22px] p-4 sm:p-5 flex flex-col gap-3.5 min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-extrabold text-foreground">{titulo}</h2>
        {ayuda && <p className="text-xs font-medium text-muted-foreground leading-relaxed mt-0.5">{ayuda}</p>}
      </div>
      {extra}
    </div>
    {children}
  </section>
);

/** Totales pegados al título de un bloque. */
export const Totales = ({ items }: { items: { label: string; valor: unknown; dec?: number }[] }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-muted-foreground">
    {items.map((t) => (
      <span key={t.label}>
        {t.label} <b className="text-sm font-extrabold text-primary tabular-nums">{fmtCelda(t.valor, t.dec)}</b>
      </span>
    ))}
  </div>
);

/** Caja interior (un vale, una tanda, un mes). */
export const Caja = ({
  children,
  alerta,
  className = "",
}: {
  children: ReactNode;
  alerta?: boolean;
  className?: string;
}) => (
  <div
    className={`rounded-[18px] p-3 sm:p-3.5 flex flex-col gap-2.5 bg-background/70 ${
      alerta ? "ring-[1.5px] ring-destructive/60" : "ring-1 ring-primary/15"
    } ${className}`}
  >
    {children}
  </div>
);

/** Cabecera de tabla: azul en claro, amarilla en oscuro. Solo en escritorio. */
export const CabeceraTabla = ({ columnas, plantilla }: { columnas: string[]; plantilla: string }) => (
  <div className={`hidden lg:grid gap-1.5 items-center polarier-head rounded-xl px-2.5 py-2 ${plantilla}`}>
    {columnas.map((c, i) => (
      <span key={`${c}-${i}`} className="text-[10.5px] font-extrabold leading-tight">
        {c}
      </span>
    ))}
  </div>
);

/** Una celda de tabla: en móvil lleva su etiqueta encima. */
export const Celda = ({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={`min-w-0 ${className}`}>
    <span className="lg:hidden block text-[11px] font-bold text-muted-foreground mb-1">{label}</span>
    {children}
  </div>
);
