import { useCallback, useEffect, useRef, useState } from "react";

export type EstadoGuardado = "guardado" | "pendiente" | "guardando" | "error";

const ESPERA_MS = 2000;
const REINTENTO_MS = 8000;

/**
 * Guarda solo unos segundos después del último cambio y reintenta si falla, porque
 * un parte se rellena en varias tandas y a veces con mala conexión.
 *
 * No guarda hasta que hay un cambio real (`marcarCambio`): abrir un día para mirarlo
 * no debe crear un parte vacío a nombre de quien mira.
 */
export const useAutoguardado = <T,>(valor: T, guardar: (v: T) => Promise<void>, activo: boolean) => {
  const [estado, setEstado] = useState<EstadoGuardado>("guardado");
  const [ultimo, setUltimo] = useState<Date | null>(null);
  const sucio = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valorRef = useRef(valor);
  const guardarRef = useRef(guardar);
  // Lo que está saliendo ahora mismo, para esperarlo antes de cambiar de documento.
  const enCurso = useRef<Promise<unknown>>(Promise.resolve());
  valorRef.current = valor;
  guardarRef.current = guardar;

  const limpiar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
  };

  const lanzar = useCallback((v: T) => {
    const salida = guardarRef.current(v);
    enCurso.current = Promise.all([enCurso.current, salida.catch(() => undefined)]);
    return salida;
  }, []);

  const ejecutar = useCallback(async () => {
    limpiar();
    if (!sucio.current) return;
    sucio.current = false;
    setEstado("guardando");
    try {
      await lanzar(valorRef.current);
      setUltimo(new Date());
      // Si se tocó algo mientras se guardaba, queda otra vuelta pendiente.
      setEstado(sucio.current ? "pendiente" : "guardado");
    } catch (e) {
      console.warn("No se pudo guardar:", e);
      sucio.current = true;
      setEstado("error");
      temporizador.current = setTimeout(() => void ejecutar(), REINTENTO_MS);
    }
  }, [lanzar]);

  const marcarCambio = useCallback(() => {
    sucio.current = true;
    setEstado("pendiente");
  }, []);

  useEffect(() => {
    if (!activo || !sucio.current) return;
    limpiar();
    temporizador.current = setTimeout(() => void ejecutar(), ESPERA_MS);
    return limpiar;
  }, [valor, activo, ejecutar]);

  // Al salir de la pantalla no se pierde lo último tecleado.
  useEffect(
    () => () => {
      if (sucio.current) void guardarRef.current(valorRef.current).catch(() => undefined);
    },
    []
  );

  /**
   * Guarda ya, sin esperar. `explicito` es para cuando el valor se acaba de cambiar
   * y React aún no lo ha pintado (cerrar la jornada).
   */
  const guardarAhora = useCallback(async (explicito?: T) => {
    limpiar();
    sucio.current = false;
    setEstado("guardando");
    try {
      await lanzar(explicito ?? valorRef.current);
      setUltimo(new Date());
      setEstado(sucio.current ? "pendiente" : "guardado");
    } catch (e) {
      sucio.current = true;
      setEstado("error");
      temporizador.current = setTimeout(() => void ejecutar(), REINTENTO_MS);
      throw e;
    }
  }, [ejecutar, lanzar]);

  /**
   * Deja guardado lo pendiente antes de pasar a otro documento, esperando también lo
   * que ya estaba saliendo. Si no se puede, lanza el error y lo pendiente sigue aquí.
   */
  const vaciar = useCallback(async () => {
    limpiar();
    await enCurso.current;
    if (sucio.current) await guardarAhora();
  }, [guardarAhora]);

  /** Empieza otro documento, ya cargado: lo que se guarde a partir de aquí es suyo. */
  const reiniciar = useCallback(() => {
    limpiar();
    sucio.current = false;
    setEstado("guardado");
    setUltimo(null);
  }, []);

  return { estado, ultimo, marcarCambio, guardarAhora, vaciar, reiniciar };
};

/** «Guardado hace 5 s». */
export const textoGuardado = (estado: EstadoGuardado, ultimo: Date | null, ahora = Date.now()): string => {
  if (estado === "guardando") return "Guardando…";
  if (estado === "pendiente") return "Cambios sin guardar";
  if (estado === "error") return "Sin conexión: se reintenta solo";
  if (!ultimo) return "Sin cambios";
  const seg = Math.max(0, Math.round((ahora - ultimo.getTime()) / 1000));
  if (seg < 60) return `Guardado hace ${seg} s`;
  return `Guardado a las ${ultimo.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
};
