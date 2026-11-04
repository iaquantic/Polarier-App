// -----------------------------------------------------------------------------
// La tabla de una hoja: mismas columnas, letras, filas y colores que el Excel.
//
// Amarillo se escribe, azul se calcula, gris es referencia. Se mueve con las flechas,
// Intro y Tab, y admite pegar un bloque copiado del Excel. Solo pinta las filas que
// se ven: una hoja puede tener 1000 registros de 23 columnas.
// -----------------------------------------------------------------------------
import { ClipboardEvent, ComponentType, KeyboardEvent, memo, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fmtCelda, tonoDe } from "@/components/audit/control/ui";
import { ColHoja, numeroDeTexto, textoDeFecha, TipoCol, valorDeTexto } from "@/lib/controlHojas";

export interface FilaTabla {
  id: string;
  /** Número de fila del Excel. */
  numero?: number | string | null;
  valores: Record<string, unknown>;
  bloqueada?: boolean;
  /** Tipo de una casilla concreta cuando no es el de su columna. */
  tipos?: Record<string, TipoCol>;
  opciones?: Record<string, readonly string[]>;
  /** Texto gris cuando la casilla está vacía: el último conteo. */
  sugerencias?: Record<string, string>;
}

export interface CambioTabla {
  /** Posición en `filas`. Puede pasar del final al pegar un bloque largo. */
  fila: number;
  key: string;
  valor: unknown;
}

const PATRON_NUM: Partial<Record<TipoCol, RegExp>> = {
  entero: /^\d*$/,
  decimal: /^\d*([.,]\d*)?$/,
  horas: /^\d*([.,:]\d*)?$/,
};

/** Como lo enseña la hoja: «90,00», «1.500». Mientras se edita, sin formato. */
const mostrarNumero = (v: unknown, tipo: TipoCol, editando: boolean): string => {
  if (typeof v !== "number") return "";
  if (editando) return String(Math.round(v * 100) / 100).replace(".", ",");
  if (tipo === "entero") return v.toLocaleString("es-ES", { maximumFractionDigits: 2 });
  return v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const CLASE_TONO: Record<string, string> = { ok: "hx-ok", aviso: "hx-am", mal: "hx-ro" };

const CeldaNumero = ({ valor, tipo, ...p }: CeldaEntradaProps) => {
  const [texto, setTexto] = useState<string | null>(null);
  return (
    <input
      {...p.base}
      inputMode={tipo === "entero" ? "numeric" : "decimal"}
      placeholder={p.sugerencia}
      value={texto ?? mostrarNumero(valor, tipo, false)}
      onFocus={() => setTexto(mostrarNumero(valor, tipo, true))}
      onBlur={() => setTexto(null)}
      onChange={(e) => {
        const t = e.target.value;
        if (!PATRON_NUM[tipo].test(t)) return;
        setTexto(t);
        const n = numeroDeTexto(t, tipo === "horas");
        if (n !== undefined) p.onCambio(n);
      }}
    />
  );
};

/** Fecha y hora se aplican al salir: a medio escribir todavía no son válidas. */
const CeldaAlSalir = ({ valor, tipo, ...p }: CeldaEntradaProps) => {
  const [texto, setTexto] = useState<string | null>(null);
  const visible = tipo === "fecha" ? textoDeFecha(valor as string) : String(valor ?? "");
  return (
    <input
      {...p.base}
      placeholder={p.sugerencia}
      value={texto ?? visible}
      onFocus={() => setTexto(visible)}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        const t = texto ?? visible;
        setTexto(null);
        if (t === visible) return;
        const v = valorDeTexto(tipo, t, p.anio);
        if (v === undefined) {
          p.onRechazo(tipo === "fecha" ? `«${t}» no es una fecha. Escríbela como dd/mm/aaaa.` : `«${t}» no es una hora. Escríbela como 08:30.`);
          return;
        }
        p.onCambio(v);
      }}
    />
  );
};

const CeldaTexto = ({ valor, ...p }: CeldaEntradaProps) => (
  <input {...p.base} placeholder={p.sugerencia} list={p.lista} value={String(valor ?? "")} onChange={(e) => p.onCambio(e.target.value)} />
);

const CeldaLista = ({ valor, opciones, ...p }: CeldaEntradaProps) => {
  const v = String(valor ?? "");
  // Un valor que no está en la lista (llega de un Excel) se enseña igual: no se pierde.
  const todas = v && !opciones?.includes(v) ? [v, ...(opciones ?? [])] : (opciones ?? []);
  return (
    <select {...p.base} value={v} onChange={(e) => p.onCambio(e.target.value)}>
      <option value="" />
      {todas.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
};

interface CeldaEntradaProps {
  valor: unknown;
  tipo: TipoCol;
  opciones?: readonly string[];
  sugerencia?: string;
  lista?: string;
  anio?: number;
  base: {
    className: string;
    disabled: boolean;
    "aria-label": string;
    "data-f": number;
    "data-c": number;
  };
  onCambio: (v: unknown) => void;
  onRechazo: (mensaje: string) => void;
}

const POR_TIPO: Partial<Record<TipoCol, ComponentType<CeldaEntradaProps>>> = {
  entero: CeldaNumero,
  decimal: CeldaNumero,
  horas: CeldaNumero,
  fecha: CeldaAlSalir,
  hora: CeldaAlSalir,
  lista: CeldaLista,
};

const textoCalculado = (v: unknown, col: ColHoja): string => {
  if (v === null || v === undefined || v === "") return "";
  return typeof v === "number" ? fmtCelda(v, col.dec ?? 2) : String(v);
};

const FilaGrid = memo(function FilaGrid({
  fila,
  indice,
  columnas,
  grid,
  fija,
  activa,
  anio,
  listaId,
  soloLectura,
  onCambio,
  onRechazo,
}: {
  fila: FilaTabla;
  indice: number;
  columnas: ColHoja[];
  grid: string;
  fija?: number;
  activa: boolean;
  anio?: number;
  listaId: string;
  soloLectura?: boolean;
  onCambio: (indice: number, key: string, v: unknown) => void;
  onRechazo: (m: string) => void;
}) {
  return (
    <div role="row" className={`hx-fila${activa ? " hx-activa" : ""}`} style={{ gridTemplateColumns: grid }}>
      {fila.numero !== undefined && (
        <div role="rowheader" className="hx-c hx-num hx-fijo-num">
          {fila.numero}
        </div>
      )}
      {columnas.map((col, c) => {
        const tipo = fila.tipos?.[col.key] ?? col.tipo;
        const valor = fila.valores[col.key];
        const clases = `${col.der ? " hx-der" : ""}${c === fija ? " hx-fija" : ""}`;
        if (tipo === "calc" || tipo === "ref") {
          const tono = CLASE_TONO[tonoDe(valor)] ?? "";
          const texto = textoCalculado(valor, col);
          return (
            <div key={col.key} role="cell" title={texto} className={`hx-c ${tipo === "calc" ? "hx-ca" : "hx-re"} ${tono}${clases}`}>
              {texto}
            </div>
          );
        }
        const Entrada = POR_TIPO[tipo] ?? CeldaTexto;
        const opciones = fila.opciones?.[col.key] ?? col.opciones;
        return (
          <Entrada
            key={col.key}
            valor={valor}
            tipo={tipo}
            opciones={opciones}
            sugerencia={fila.sugerencias?.[col.key]}
            lista={tipo === "listaLibre" ? `${listaId}-${col.key}` : undefined}
            anio={anio}
            base={{
              className: `hx-c hx-in${tipo === "lista" ? " hx-sel" : ""}${clases}`,
              disabled: !!fila.bloqueada || !!soloLectura,
              // En las tablas de rótulo y valor, lo que dice qué es la casilla es el rótulo.
              "aria-label": `${typeof fila.valores.a === "string" ? fila.valores.a : col.titulo}, fila ${fila.numero ?? indice + 1}`,
              "data-f": indice,
              "data-c": c,
            }}
            onCambio={(v) => onCambio(indice, col.key, v)}
            onRechazo={onRechazo}
          />
        );
      })}
    </div>
  );
});

const VENTANA_DESDE = 60;
/** Lo mismo que `.hx-fila > .hx-c` en index.css: con el dedo, filas más altas. */
const altoDeFila = (): number => (window.matchMedia?.("(pointer: coarse)").matches ? 44 : 30);

const TablaHoja = ({
  nombre,
  columnas,
  filas,
  sinCabecera,
  sinLetras,
  fija,
  alto,
  rellenar = true,
  anio,
  soloLectura,
  filaActiva,
  foco,
  onFilaActiva,
  onCambios,
  onRechazo,
}: {
  nombre: string;
  columnas: ColHoja[];
  filas: FilaTabla[];
  sinCabecera?: boolean;
  sinLetras?: boolean;
  /** Columna que se queda fija al moverse de lado. */
  fija?: number;
  /** Alto máximo de la caja con scroll. */
  alto?: string;
  /** Que la última columna ocupe lo que sobre. */
  rellenar?: boolean;
  anio?: number;
  soloLectura?: boolean;
  filaActiva?: string | null;
  /** Lleva el foco a una fila: «+ Añadir fila» baja hasta la primera libre. */
  foco?: { fila: number; vez: number } | null;
  onFilaActiva?: (id: string) => void;
  onCambios?: (cambios: CambioTabla[]) => void;
  onRechazo?: (mensaje: string) => void;
}) => {
  const caja = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [altoCaja, setAltoCaja] = useState(600);
  const ALTO_FILA = useMemo(altoDeFila, []);
  const conNumeros = filas.some((f) => f.numero !== undefined);

  const grid = useMemo(() => {
    const anchos = columnas.map((c, i) => (rellenar && i === columnas.length - 1 ? `minmax(${c.ancho}px, 1fr)` : `${c.ancho}px`));
    return `${conNumeros ? "38px " : ""}${anchos.join(" ")}`;
  }, [columnas, conNumeros, rellenar]);

  useLayoutEffect(() => {
    if (caja.current?.clientHeight) setAltoCaja(caja.current.clientHeight);
  }, [alto]);

  const conVentana = filas.length > VENTANA_DESDE;
  const inicio = conVentana ? Math.max(0, Math.floor(scroll / ALTO_FILA) - 8) : 0;
  const fin = conVentana ? Math.min(filas.length, inicio + Math.ceil(altoCaja / ALTO_FILA) + 16) : filas.length;

  const refsCambio = useRef(onCambios);
  refsCambio.current = onCambios;
  const refsRechazo = useRef(onRechazo);
  refsRechazo.current = onRechazo;

  const alCambiar = useCallback((indice: number, key: string, valor: unknown) => {
    refsCambio.current?.([{ fila: indice, key, valor }]);
  }, []);
  const alRechazar = useCallback((m: string) => refsRechazo.current?.(m), []);

  const enfocar = (f: number, c: number, paso: 1 | -1 = 1) => {
    const raiz = caja.current;
    if (!raiz || f < 0 || f >= filas.length) return;
    const buscar = () => {
      for (let col = c; col >= 0 && col < columnas.length; col += paso) {
        const el = raiz.querySelector<HTMLElement>(`[data-f="${f}"][data-c="${col}"]`);
        if (el && !(el as HTMLInputElement).disabled) {
          el.focus();
          (el as HTMLInputElement).select?.();
          return true;
        }
      }
      return false;
    };
    if (buscar()) return;
    if (conVentana) {
      raiz.scrollTop = Math.max(0, f * ALTO_FILA - altoCaja / 2);
      setScroll(raiz.scrollTop);
      requestAnimationFrame(buscar);
    }
  };

  useEffect(() => {
    if (foco) enfocar(foco.fila, 0);
    // Solo cuando se pide otra vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco?.vez]);

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLInputElement;
    if (!t.dataset?.f) return;
    const f = Number(t.dataset.f);
    const c = Number(t.dataset.c);
    const esSelect = t.tagName === "SELECT";
    if (e.key === "Enter") {
      e.preventDefault();
      t.blur();
      enfocar(f + (e.shiftKey ? -1 : 1), c);
    } else if (e.key === "ArrowDown" && !esSelect) {
      e.preventDefault();
      enfocar(f + 1, c);
    } else if (e.key === "ArrowUp" && !esSelect) {
      e.preventDefault();
      enfocar(f - 1, c);
    } else if (e.key === "ArrowLeft" && (esSelect || t.selectionStart === 0)) {
      e.preventDefault();
      enfocar(f, c - 1, -1);
    } else if (e.key === "ArrowRight" && (esSelect || t.selectionEnd === t.value.length)) {
      e.preventDefault();
      enfocar(f, c + 1, 1);
    }
  };

  const alPegar = (e: ClipboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (!t.dataset?.f || !onCambios) return;
    const texto = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(texto.replace(/\r?\n$/, ""))) return;
    e.preventDefault();
    const f0 = Number(t.dataset.f);
    const c0 = Number(t.dataset.c);
    const cambios: CambioTabla[] = [];
    let rechazados = 0;
    texto
      .replace(/\r/g, "")
      .replace(/\n$/, "")
      .split("\n")
      .forEach((linea, i) => {
        const destino = filas[f0 + i];
        if (destino?.bloqueada) return;
        linea.split("\t").forEach((celda, j) => {
          const col = columnas[c0 + j];
          if (!col) return;
          const tipo = destino?.tipos?.[col.key] ?? col.tipo;
          // Si el bloque trae las columnas calculadas, se saltan: se calculan aquí.
          if (tipo === "calc" || tipo === "ref") return;
          const valor = valorDeTexto(tipo, celda, anio);
          if (valor === undefined) rechazados++;
          else cambios.push({ fila: f0 + i, key: col.key, valor });
        });
      });
    if (cambios.length) onCambios(cambios);
    if (rechazados) onRechazo?.(`${rechazados === 1 ? "Una casilla pegada no valía" : `${rechazados} casillas pegadas no valían`} y se ha dejado como estaba.`);
  };

  const listas = useMemo(() => columnas.filter((c) => c.tipo === "listaLibre"), [columnas]);
  const listaId = `hx-${nombre.replace(/\W/g, "")}`;

  return (
    <div
      ref={caja}
      role="table"
      aria-label={nombre}
      className="hx-scroll"
      style={alto ? { maxHeight: alto } : undefined}
      onScroll={conVentana ? (e) => setScroll(e.currentTarget.scrollTop) : undefined}
      onKeyDown={alTeclear}
      onPaste={alPegar}
      onFocus={(e) => {
        const i = (e.target as HTMLElement).dataset?.f;
        if (i !== undefined && filas[Number(i)]) onFilaActiva?.(filas[Number(i)].id);
      }}
    >
      {listas.map((c) => (
        <datalist key={c.key} id={`${listaId}-${c.key}`}>
          {c.opciones?.map((o) => <option key={o} value={o} />)}
        </datalist>
      ))}
      {!sinCabecera && (
        <div className="hx-cabecera">
          {!sinLetras && (
            <div role="row" className="hx-fila" style={{ gridTemplateColumns: grid }}>
              {conNumeros && <div className="hx-c hx-num hx-fijo-num" />}
              {columnas.map((c, i) => (
                <div key={c.key} className={`hx-c hx-num${i === fija ? " hx-fija" : ""}`}>
                  {c.letra}
                </div>
              ))}
            </div>
          )}
          <div role="row" className="hx-fila" style={{ gridTemplateColumns: grid }}>
            {conNumeros && <div className="hx-c hx-hd hx-fijo-num" />}
            {columnas.map((c, i) => (
              <div key={c.key} role="columnheader" className={`hx-c hx-hd${c.der ? " hx-der" : ""}${i === fija ? " hx-fija" : ""}`}>
                {c.titulo}
              </div>
            ))}
          </div>
        </div>
      )}
      {inicio > 0 && <div style={{ height: inicio * ALTO_FILA }} aria-hidden />}
      {filas.slice(inicio, fin).map((fila, i) => (
        <FilaGrid
          key={fila.id}
          fila={fila}
          indice={inicio + i}
          columnas={columnas}
          grid={grid}
          fija={fija}
          activa={fila.id === filaActiva}
          anio={anio}
          listaId={listaId}
          soloLectura={soloLectura || !onCambios}
          onCambio={alCambiar}
          onRechazo={alRechazar}
        />
      ))}
      {fin < filas.length && <div style={{ height: (filas.length - fin) * ALTO_FILA }} aria-hidden />}
    </div>
  );
};

export default TablaHoja;

/** Botón de las ayudas que hay encima de una tabla: no añaden columnas. */
export const Mini = ({
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
  <button type="button" className="hx-mini" onClick={onClick} disabled={disabled} title={title}>
    {children}
  </button>
);

export const Subtitulo = ({ children }: { children: ReactNode }) => <h3 className="hx-subt">{children}</h3>;
export const Nota = ({ children }: { children: ReactNode }) => <p className="hx-nota">{children}</p>;
