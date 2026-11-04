import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Accion,
  CIERRES,
  Cierre,
  duracionInformada,
  FilaEquipo,
  fueraDeServicio,
  importeRetiro,
  Jornada,
  Num,
  REVISIONES,
  Retiro,
  Revision,
  situacionAccion,
} from "@/lib/control";
import { ControlMesData, EntradaKpi, Encuesta, HojaRevisada, leerParte, sugerenciaKpi } from "@/lib/controlResumen";
import {
  ColHoja,
  COLS_ACCIONES,
  COLS_ENCUESTAS,
  COLS_EQUIPOS,
  COLS_INCIDENCIAS,
  COLS_KPI,
  COLS_MANTENIMIENTO,
  COLS_OPERACION,
  COLS_RETIROS,
  FILAS,
  TipoCol,
  textoDeFecha,
  uid,
} from "@/lib/controlHojas";
import { fechaDeEvento, FilaEvento, LibroMes } from "@/hooks/useLibroMes";
import { TipoEventoControl } from "@/services/audit";
import { fmtCelda } from "@/components/audit/control/ui";
import TablaHoja, { CambioTabla, FilaTabla, Mini, Nota, Subtitulo } from "./TablaHoja";
import { errorFecha, useFantasmas } from "./HojasDetalle";

const pct = (v: unknown): string =>
  typeof v === "number" ? `${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %` : String(v ?? "");

const NOTA_REVISION = "Validado: registros revisados y completos. Sin actividad: se comprobó que no hubo hechos que registrar.";

const COLS_REVISION: ColHoja[] = [
  { letra: "A", titulo: "", key: "a", tipo: "ref", ancho: 160 },
  { letra: "B", titulo: "", key: "b", tipo: "lista", ancho: 150, opciones: REVISIONES },
  { letra: "C", titulo: "", key: "c", tipo: "ref", ancho: 640 },
];

const FilaRevision = ({ libro, hoja }: { libro: LibroMes; hoja: HojaRevisada }) => (
  <TablaHoja
    nombre="Revisión del mes"
    sinCabecera
    columnas={COLS_REVISION}
    filas={[{ id: "b7", numero: 7, valores: { a: "Revisión del mes", b: libro.control.revision[hoja] ?? "Pendiente", c: NOTA_REVISION } }]}
    onCambios={([c]) => {
      if (c) libro.editarControl({ revision: { ...libro.control.revision, [hoja]: (c.valor || "Pendiente") as Revision } });
    }}
  />
);

/** Una tabla de rótulo y valor, sin cabecera, como los pies de las hojas. */
const TablaPares = ({
  nombre,
  filas,
  desde,
  ancho = 200,
  columna = "A",
}: {
  nombre: string;
  filas: [string, unknown, number?][];
  desde?: number;
  ancho?: number;
  columna?: "A" | "F";
}) => {
  const valor = columna === "A" ? "B" : "G";
  return (
    <TablaHoja
      nombre={nombre}
      sinCabecera
      rellenar={false}
      columnas={[
        { letra: columna, titulo: "", key: "a", tipo: "ref", ancho },
        { letra: valor, titulo: "", key: "b", tipo: "calc", ancho: 110, der: true },
      ]}
      filas={filas.map(([a, b, dec], i) => ({
        id: a,
        numero: desde === undefined ? undefined : desde + i,
        valores: { a, b: typeof b === "number" ? fmtCelda(b, dec ?? 2) : b },
      }))}
    />
  );
};

// -----------------------------------------------------------------------------
// Datos_mes
// -----------------------------------------------------------------------------
const COLS_DATOS: ColHoja[] = [
  { letra: "A", titulo: "Dato", key: "a", tipo: "ref", ancho: 300 },
  { letra: "B", titulo: "Valor", key: "b", tipo: "texto", ancho: 340 },
];

export const AreaTexto = ({
  titulo,
  valor,
  onChange,
  deshabilitado,
}: {
  titulo: string;
  valor: string;
  onChange: (v: string) => void;
  deshabilitado?: boolean;
}) => (
  <div>
    <Subtitulo>{titulo}</Subtitulo>
    <textarea className="hx-area" aria-label={titulo} placeholder="Completar" value={valor ?? ""} disabled={deshabilitado} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export const HojaDatos = ({ libro }: { libro: LibroMes }) => {
  const { control, rango, anio, mes } = libro;
  const setS = (cambio: Partial<ControlMesData["sintesis"]>) => libro.editarControl({ sintesis: { ...control.sintesis, ...cambio } });
  const d = control.datos;

  const filas: { key?: keyof ControlMesData["datos"]; a: string; b: unknown; tipo: TipoCol }[] = [
    { a: "Mes en número del 1 al 12", b: mes, tipo: "calc" },
    { a: "Año", b: String(anio), tipo: "calc" },
    { a: "Hotel", b: libro.nombreHotel, tipo: "calc" },
    { a: "Primer día del mes", b: textoDeFecha(rango.primerDia), tipo: "calc" },
    { a: "Último día del mes", b: textoDeFecha(rango.ultimoDia), tipo: "calc" },
    { key: "representante", a: "Representante que informa", b: d.representante, tipo: "texto" },
    { key: "cargo", a: "Cargo", b: d.cargo, tipo: "texto" },
    { key: "fecha_elaboracion", a: "Fecha de elaboración", b: d.fecha_elaboracion, tipo: "fecha" },
    { key: "aplicacion_sla", a: "Fecha de aplicación del SLA", b: d.aplicacion_sla, tipo: "fecha" },
    { key: "fin_estabilizacion", a: "Fin de la estabilización", b: d.fin_estabilizacion, tipo: "fecha" },
    { key: "acta", a: "Acta de puesta en marcha", b: d.acta, tipo: "texto" },
    { key: "turnos", a: "Turnos y horarios acordados", b: d.turnos, tipo: "texto" },
    { key: "personal", a: "Personal efectivo del mes", b: d.personal, tipo: "entero" },
  ];

  return (
    <div className="hx-bloques">
      <TablaHoja
        nombre="Datos del mes"
        sinCabecera
        anio={anio}
        rellenar={false}
        columnas={COLS_DATOS}
        filas={filas.map((f, i) => ({
          id: f.a,
          numero: 7 + i,
          valores: { a: f.a, b: f.b },
          tipos: { b: f.tipo },
        }))}
        onCambios={(cs) => {
          const cambio: Record<string, unknown> = {};
          for (const c of cs) {
            const f = filas[c.fila];
            if (f?.key) cambio[f.key] = f.tipo === "fecha" ? (c.valor ?? "") : c.valor;
          }
          libro.editarControl({ datos: { ...control.datos, ...cambio } });
        }}
        onRechazo={(m) => toast.error(m)}
      />
      <AreaTexto titulo="Logros y resultados relevantes" valor={control.sintesis.logros} onChange={(x) => setS({ logros: x })} />
      <AreaTexto titulo="Dificultades y efecto en el servicio" valor={control.sintesis.dificultades} onChange={(x) => setS({ dificultades: x })} />
      <AreaTexto titulo="Acuerdos con el hotel y conclusión del mes" valor={control.sintesis.acuerdos} onChange={(x) => setS({ acuerdos: x })} />
      <Nota>Escriba argumentos breves y concretos. Identifique qué ocurrió, su efecto y lo acordado. No duplique aquí las listas de incidencias o acciones.</Nota>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Operacion
// -----------------------------------------------------------------------------
const COLS_TOTALES_OPERACION: ColHoja[] = [
  { letra: "A", titulo: "Concepto", key: "a", tipo: "ref", ancho: 150 },
  ...["turistas", "kg", "recibidas", "entregadas", "horas_previstas", "horas_trabajadas", "parada"].map(
    (key, i): ColHoja => ({
      letra: "BCDEFGH"[i],
      titulo: ["Turistas días", "Kg lavados", "Piezas recibidas", "Piezas entregadas", "Horas previstas", "Horas trabajadas", "Parada única en h"][i],
      key,
      tipo: "calc",
      ancho: 96,
      der: true,
    })
  ),
  { letra: "I", titulo: "Observación", key: "i", tipo: "ref", ancho: 300 },
];

export const HojaOperacion = ({ libro, onVerInforme }: { libro: LibroMes; onVerInforme: (fecha: string) => void }) => {
  const r = libro.resumen;
  const [activa, setActiva] = useState<string | null>(null);

  const filas: FilaTabla[] = (r?.filasOperacion ?? []).map((f, i) => {
    const editable = libro.diaEditable(f.fecha);
    const propia = libro.jornadas[f.fecha];
    const j: Partial<Jornada> & { cierre?: Cierre | null } = editable ? (propia ?? {}) : f;
    return {
      id: f.fecha,
      numero: FILAS.operacion.desde + i,
      bloqueada: !editable,
      valores: {
        fecha: textoDeFecha(f.fecha),
        turistas: j.turistas ?? null,
        kg: f.kg,
        recibidas: f.recibidas,
        entregadas: j.entregadas ?? null,
        horas_previstas: j.horas_previstas ?? null,
        horas_trabajadas: j.horas_trabajadas ?? null,
        parada: j.parada ?? null,
        observacion: j.observacion ?? "",
        // Un día sin parte no ha dicho nada todavía: la casilla se queda vacía, como en la hoja.
        cierre: editable ? (propia?.cierre ?? "") : (f.cierre ?? ""),
      },
    };
  });

  const alCambiar = (cambios: CambioTabla[]) => {
    const dias = r?.filasOperacion ?? [];
    const lista = cambios
      .filter((c) => dias[c.fila])
      .map((c) => ({
        fecha: dias[c.fila].fecha,
        cambio: { [c.key]: c.key === "cierre" ? (c.valor || "Pendiente") : c.valor } as Partial<Jornada>,
      }));
    if (lista.length) libro.editarJornadas(lista);
  };

  const fechaInforme = activa ?? libro.fechaPorDefecto(null);
  const t = r?.operacion;
  const fila = (nombre: string, d: Record<string, unknown>, nota: string) => ({
    id: nombre,
    valores: { a: nombre, ...d, i: nota },
  });

  return (
    <>
      <div className="hx-acciones">
        <Mini onClick={() => onVerInforme(fechaInforme)}>Ver el informe del {textoDeFecha(fechaInforme).slice(0, 5)}</Mini>
      </div>
      <div className="hx-bloques">
        <FilaRevision libro={libro} hoja="operacion" />
        {libro.mesValidado && <Nota>El mes está validado y sus días no se pueden editar. Para corregirlo, pon Revisión del mes en Pendiente.</Nota>}
        <TablaHoja
          nombre="Jornada diaria"
          columnas={COLS_OPERACION.map((c) => (c.key === "cierre" ? { ...c, opciones: CIERRES } : c))}
          filas={filas}
          fija={0}
          alto="62vh"
          filaActiva={activa}
          onFilaActiva={setActiva}
          onCambios={alCambiar}
          onRechazo={(m) => toast.error(m)}
        />
        <div>
          <Subtitulo>Totales registrados y cobertura de datos</Subtitulo>
          {t && (
            <TablaHoja
              nombre="Totales de la jornada"
              columnas={COLS_TOTALES_OPERACION}
              filas={[
                { ...fila("Total informado", t.total, "Los totales son parciales mientras falten días."), numero: 45 },
                { ...fila("Días con dato", t.diasConDato, "Escriba 0 en días sin actividad comprobada."), numero: 46 },
                { ...fila("Días por completar", t.diasPorCompletar, "El mes completo exige todas las fechas aplicables."), numero: 47 },
              ]}
            />
          )}
        </div>
        <TablaPares nombre="Kg por turista día" desde={49} ancho={150} filas={[["Kg por turista día", t?.kgPorTurista, 3]]} />
        <Nota>Las piezas recibidas se registran una sola vez en Lavado_detalle. Las entregas al hotel se informan en E.</Nota>
      </div>
    </>
  );
};

// -----------------------------------------------------------------------------
// KPI_calidad
// -----------------------------------------------------------------------------
export const HojaKpi = ({ libro }: { libro: LibroMes }) => {
  const { control, resumen: r } = libro;
  const setKpi = (key: string, cambio: Partial<EntradaKpi>) =>
    libro.editarControl({
      kpis: { ...control.kpis, [key]: { ...(control.kpis[key] ?? { cantidad: null, base: null, documento: "" }), ...cambio } },
    });

  const kpis = r?.kpis ?? [];
  const filas: FilaTabla[] = kpis.map((k, i) => ({
    id: k.key,
    numero: FILAS.kpi.desde + i,
    valores: {
      nombre: k.nombre,
      cantidad: k.cantidadValor,
      base: k.baseValor,
      meta: k.meta === null ? "Sin cargar" : pct(k.meta),
      resultado: pct(k.resultado),
      cumplimiento: k.cumplimiento,
      documento: k.documento,
      como: `B: ${k.cantidad}. C: ${k.base}.`,
    },
  }));

  const sugerencias = r
    ? kpis.flatMap((k) => {
        const s = sugerenciaKpi(k.key, r);
        return s && (s.cantidad !== k.cantidadValor || s.base !== k.baseValor) ? [{ k, s }] : [];
      })
    : [];

  return (
    <div className="hx-bloques">
      <FilaRevision libro={libro} hoja="kpi" />
      <div>
        <TablaHoja
          nombre="Indicadores del SLA"
          columnas={COLS_KPI}
          filas={filas}
          fija={0}
          rellenar={false}
          onCambios={(cs) => {
            const nuevos = { ...control.kpis };
            for (const c of cs) {
              const k = kpis[c.fila];
              if (k) nuevos[k.key] = { ...(nuevos[k.key] ?? { cantidad: null, base: null, documento: "" }), [c.key]: c.valor };
            }
            libro.editarControl({ kpis: nuevos });
          }}
          onRechazo={(m) => toast.error(m)}
        />
        {kpis.some((k) => k.meta === null) && <Nota>Este hotel todavía no tiene cargadas las metas de su SLA: sin ellas no se puede decir si un indicador cumple.</Nota>}
        <Nota>Estas razones organizan los datos del criterio del SLA. B no puede superar C. Una base igual a 0 muestra No aplica. No se calcula un índice global porque el SLA no establece su ponderación.</Nota>
        {sugerencias.length > 0 && (
          <div className="hx-acciones hx-acciones-sueltas">
            {sugerencias.map(({ k, s }) => (
              <Mini key={k.key} onClick={() => setKpi(k.key, { cantidad: s.cantidad, base: s.base })}>
                {k.nombre}: usar lo registrado ({fmtCelda(s.cantidad)} de {fmtCelda(s.base)})
              </Mini>
            ))}
          </div>
        )}
      </div>
      <div>
        <Subtitulo>Encuestas de satisfacción del hotel</Subtitulo>
        <TablaHoja
          nombre="Encuestas"
          columnas={COLS_ENCUESTAS}
          filas={(["lavado", "servicio"] as const).map((a, i) => ({
            id: a,
            numero: FILAS.encuestas.lavado + i,
            valores: { aspecto: a === "lavado" ? "Lavado" : "Servicio", ...control.encuestas[a] },
          }))}
          onCambios={(cs) => {
            const nuevas = { ...control.encuestas };
            for (const c of cs) {
              const a = c.fila === 0 ? "lavado" : "servicio";
              nuevas[a] = { ...nuevas[a], [c.key]: c.valor } as Encuesta;
            }
            libro.editarControl({ encuestas: nuevas });
          }}
          onRechazo={(m) => toast.error(m)}
        />
      </div>
      <div>
        <TablaHoja
          nombre="Controles"
          sinCabecera
          rellenar={false}
          columnas={[
            { letra: "A", titulo: "", key: "a", tipo: "ref", ancho: 230 },
            { letra: "B", titulo: "", key: "b", tipo: "entero", ancho: 120, der: true },
          ]}
          filas={(
            [
              ["reprocesos", "Reprocesos en piezas"],
              ["reclamaciones", "Reclamaciones recibidas"],
              ["danos", "Daños imputables en piezas"],
            ] as const
          ).map(([key, a], i) => ({ id: key, numero: FILAS.controles.reprocesos + i, valores: { a, b: control.controles[key] } }))}
          onCambios={(cs) => {
            const claves = ["reprocesos", "reclamaciones", "danos"] as const;
            const nuevos = { ...control.controles };
            for (const c of cs) if (claves[c.fila]) nuevos[claves[c.fila]] = c.valor as Num;
            libro.editarControl({ controles: nuevos });
          }}
        />
        <Nota>Introduzca 0 si comprobó que no hubo casos. Documente los hechos en Incidencias. La cantidad de encuestas y su escala deben acompañar las puntuaciones.</Nota>
      </div>
      <AreaTexto
        titulo="Criterio acordado con el hotel"
        valor={control.controles.criterio}
        onChange={(x) => libro.editarControl({ controles: { ...control.controles, criterio: x } })}
      />
    </div>
  );
};

// -----------------------------------------------------------------------------
// Novedades: Incidencias, mantenimiento, Retiros_importes y Acciones
// -----------------------------------------------------------------------------
const TablaEventos = ({
  libro,
  tipo,
  nombre,
  columnas,
  desde,
  calcular,
  filaActiva,
  onFilaActiva,
}: {
  libro: LibroMes;
  tipo: TipoEventoControl;
  nombre: string;
  columnas: ColHoja[];
  desde: number;
  calcular?: (e: FilaEvento) => Record<string, unknown>;
  filaActiva: string | null;
  onFilaActiva: (clave: string) => void;
}) => {
  const delTipo = useMemo(() => libro.eventos.filter((e) => e.tipo === tipo), [libro.eventos, tipo]);
  const claves = useMemo(() => new Set(delTipo.map((e) => e.clave)), [delTipo]);
  const fantasmas = useFantasmas(claves, 4);
  const filas: FilaTabla[] = [
    ...delTipo.map((e, i) => ({
      id: e.clave,
      numero: desde + i,
      valores: { ...e.data, fecha: e.fecha, ...(calcular?.(e) ?? {}) },
    })),
    ...fantasmas.map((id, i) => ({ id, numero: desde + delTipo.length + i, valores: {} })),
  ];

  const alCambiar = (cambios: CambioTabla[]) => {
    const porClave = new Map<string, { clave: string; tipo: TipoEventoControl; fecha?: string | null; data: Record<string, unknown> }>();
    for (const c of cambios) {
      const clave = filas[c.fila]?.id ?? uid();
      const actual = porClave.get(clave) ?? { clave, tipo, data: {} };
      const existente = delTipo.find((e) => e.clave === clave);
      const datos = { ...(existente?.data ?? {}), ...actual.data, [c.key]: c.valor };
      const decide =
        tipo === "mantenimiento"
          ? c.key === "fecha_planificada" || c.key === "fecha_ejecutada"
          : c.key === "fecha";
      if (decide) {
        const fecha = tipo === "mantenimiento" ? fechaDeEvento(tipo, null, existente || c.key === "fecha_planificada" ? datos : { ...datos, fecha_planificada: libro.fechaPorDefecto(null) }) : (c.valor as string);
        const error = errorFecha(libro, fecha);
        if (error) {
          toast.error(error);
          continue;
        }
      }
      if (c.key === "fecha") actual.fecha = c.valor as string;
      else actual.data = { ...actual.data, [c.key]: c.valor };
      porClave.set(clave, actual);
    }
    if (porClave.size) libro.editarEventos([...porClave.values()]);
  };

  return (
    <TablaHoja
      nombre={nombre}
      columnas={columnas}
      filas={filas}
      fija={0}
      rellenar={false}
      anio={libro.anio}
      filaActiva={filaActiva}
      onFilaActiva={onFilaActiva}
      onCambios={alCambiar}
      onRechazo={(m) => toast.error(m)}
    />
  );
};

const BorrarElegida = ({ libro, clave }: { libro: LibroMes; clave: string | null }) => (
  <Mini disabled={!clave || !libro.eventos.some((e) => e.clave === clave)} onClick={() => clave && libro.borrarEvento(clave)}>
    Borrar la fila elegida
  </Mini>
);

const AbiertasAntes = ({ libro, tipo }: { libro: LibroMes; tipo: "incidencia" | "accion" }) => {
  const abiertas = libro.abiertasAntes.filter((e) => e.tipo === tipo);
  if (abiertas.length === 0) return null;
  const meses = Array.from(new Set(abiertas.map((e) => e.fecha.slice(0, 7)))).sort();
  return (
    <Nota>
      Siguen abiertas {abiertas.length} de meses anteriores. Se cierran en la hoja de su mes:{" "}
      {meses.map((m, i) => (
        <span key={m}>
          {i > 0 && ", "}
          <Link to={`/auditoria/formularios?mes=${m}&hoja=${tipo === "incidencia" ? "Incidencias" : "Acciones"}`}>{m}</Link>
        </span>
      ))}
      .
    </Nota>
  );
};

export const HojaIncidencias = ({ libro }: { libro: LibroMes }) => {
  const [activa, setActiva] = useState<string | null>(null);
  const t = libro.resumen?.incidencias;
  return (
    <>
      <div className="hx-acciones">
        <BorrarElegida libro={libro} clave={activa} />
      </div>
      <div className="hx-bloques">
        <FilaRevision libro={libro} hoja="incidencias" />
        <div>
          <TablaEventos
            libro={libro}
            tipo="incidencia"
            nombre="Incidencias"
            columnas={COLS_INCIDENCIAS}
            desde={FILAS.incidencias.desde}
            calcular={(e) => ({ informada: duracionInformada({ ...e.data, fecha: e.fecha } as never) })}
            filaActiva={activa}
            onFilaActiva={setActiva}
          />
          <AbiertasAntes libro={libro} tipo="incidencia" />
        </div>
        <TablaPares
          nombre="Totales de incidencias"
          desde={113}
          filas={[
            ["Incidencias del mes", t?.registradas, 0],
            ["Cerradas del mes", t?.cerradas, 0],
            ["Horas por agua", t?.horasAgua],
            ["Horas por electricidad", t?.horasElectricidad],
          ]}
        />
        <Nota>Los totales por causa incluyen solo duraciones informadas y pueden solaparse. Para horas únicas utilice H del diario Operacion.</Nota>
      </div>
    </>
  );
};

export const HojaEquipos = ({ libro }: { libro: LibroMes }) => {
  const [activaE, setActivaE] = useState<string | null>(null);
  const [activaM, setActivaM] = useState<string | null>(null);
  const { control, resumen: r } = libro;
  const ids = useMemo(() => new Set(control.equipos.map((e) => e.id)), [control.equipos]);
  const fantasmas = useFantasmas(ids, 4);
  const filas: FilaTabla[] = [
    ...control.equipos.map((e, i) => ({
      id: e.id,
      numero: FILAS.equipos.desde + i,
      valores: { ...e, fuera: fueraDeServicio(e) },
    })),
    ...fantasmas.map((id, i) => ({ id, numero: FILAS.equipos.desde + control.equipos.length + i, valores: {} })),
  ];
  const alCambiar = (cambios: CambioTabla[]) => {
    let equipos = [...control.equipos];
    for (const c of cambios) {
      const id = filas[c.fila]?.id ?? uid();
      const i = equipos.findIndex((e) => e.id === id);
      if (i >= 0) {
        equipos[i] = { ...equipos[i], [c.key]: c.valor };
      } else {
        equipos = [
          ...equipos,
          { id, nombre: "", total: null, operativos: null, estado_causa: "", intervencion: "", pendiente: "", responsable: "", fecha_prevista: null, parte: "", [c.key]: c.valor } as FilaEquipo,
        ];
      }
    }
    libro.editarControl({ equipos });
  };
  const t = r?.equipos;
  return (
    <>
      <div className="hx-acciones">
        <Mini disabled={!activaE || !ids.has(activaE)} onClick={() => libro.editarControl({ equipos: control.equipos.filter((e) => e.id !== activaE) })}>
          Borrar el equipo elegido
        </Mini>
        <BorrarElegida libro={libro} clave={activaM} />
      </div>
      <div className="hx-bloques">
        <FilaRevision libro={libro} hoja="equipos" />
        <TablaHoja
          nombre="Equipos"
          columnas={COLS_EQUIPOS}
          filas={filas}
          fija={0}
          rellenar={false}
          anio={libro.anio}
          filaActiva={activaE}
          onFilaActiva={setActivaE}
          onCambios={alCambiar}
          onRechazo={(m) => toast.error(m)}
        />
        <TablaHoja
          nombre="Totales de equipos"
          sinCabecera
          rellenar={false}
          columnas={[
            { letra: "A", titulo: "", key: "a", tipo: "ref", ancho: 170 },
            { letra: "B", titulo: "", key: "b", tipo: "calc", ancho: 80, der: true },
            { letra: "C", titulo: "", key: "c", tipo: "ref", ancho: 110 },
            { letra: "D", titulo: "", key: "d", tipo: "calc", ancho: 80, der: true },
            { letra: "E", titulo: "", key: "e", tipo: "ref", ancho: 130 },
            { letra: "F", titulo: "", key: "f", tipo: "calc", ancho: 80, der: true },
          ]}
          filas={[{ id: "t", numero: 33, valores: { a: "Equipos totales", b: t?.total, c: "Operativos", d: t?.operativos, e: "Fuera de servicio", f: t?.fueraServicio } }]}
        />
        <div>
          <Subtitulo>Mantenimiento preventivo y correctivo</Subtitulo>
          <TablaEventos
            libro={libro}
            tipo="mantenimiento"
            nombre="Mantenimiento"
            columnas={COLS_MANTENIMIENTO}
            desde={FILAS.mantenimiento.desde}
            filaActiva={activaM}
            onFilaActiva={setActivaM}
          />
        </div>
        <TablaHoja
          nombre="Totales de mantenimiento"
          sinCabecera
          rellenar={false}
          columnas={[
            { letra: "A", titulo: "", key: "a", tipo: "ref", ancho: 170 },
            { letra: "B", titulo: "", key: "b", tipo: "calc", ancho: 80, der: true },
            { letra: "C", titulo: "", key: "c", tipo: "ref", ancho: 180 },
            { letra: "D", titulo: "", key: "d", tipo: "calc", ancho: 80, der: true },
          ]}
          filas={[{ id: "t", numero: 89, valores: { a: "Preventivos previstos", b: t?.preventivosPrevistos, c: "Ejecutados de los previstos", d: t?.preventivosEjecutados } }]}
        />
        <Nota>Los equipos operativos al cierre no equivalen a la disponibilidad técnica durante todo el mes.</Nota>
      </div>
    </>
  );
};

export const HojaRetiros = ({ libro }: { libro: LibroMes }) => {
  const [activa, setActiva] = useState<string | null>(null);
  const r = libro.resumen?.retiros;
  const cols = (titulos: string[]): ColHoja[] => [
    { letra: "A", titulo: titulos[0], key: "clave", tipo: "ref", ancho: 110 },
    { letra: "B", titulo: titulos[1], key: "calculado", tipo: "calc", ancho: 110, der: true },
    { letra: "C", titulo: titulos[2], key: "conciliado", tipo: "calc", ancho: 110, der: true },
    { letra: "D", titulo: titulos[3], key: "sinConciliar", tipo: "calc", ancho: 110, der: true },
  ];
  return (
    <>
      <div className="hx-acciones">
        <BorrarElegida libro={libro} clave={activa} />
      </div>
      <div className="hx-bloques">
        <FilaRevision libro={libro} hoja="retiros" />
        <TablaEventos
          libro={libro}
          tipo="retiro"
          nombre="Retiros"
          columnas={COLS_RETIROS}
          desde={FILAS.retiros.desde}
          calcular={(e) => ({ importe: importeRetiro(e.data as unknown as Retiro) })}
          filaActiva={activa}
          onFilaActiva={setActiva}
        />
        <div>
          <Subtitulo>Importes por moneda</Subtitulo>
          <TablaHoja
            nombre="Importes por moneda"
            rellenar={false}
            columnas={cols(["Moneda", "Importe calculado", "Conciliado con acta", "Sin conciliar"])}
            filas={(r?.porMoneda ?? []).map((f, i) => ({ id: f.clave, numero: 114 + i, valores: { ...f } }))}
          />
          <Nota>No sumar monedas diferentes. Cantidades de retiros o mal uso no implican automáticamente un cobro.</Nota>
        </div>
        <div>
          <Subtitulo>Cantidades registradas por concepto</Subtitulo>
          <TablaHoja
            nombre="Cantidades por concepto"
            rellenar={false}
            columnas={cols(["Concepto", "Piezas registradas", "Conciliadas con acta", "Sin conciliar"])}
            filas={(r?.porConcepto ?? []).map((f, i) => ({ id: f.clave, numero: 123 + i, valores: { ...f } }))}
          />
        </div>
      </div>
    </>
  );
};

export const HojaAcciones = ({ libro }: { libro: LibroMes }) => {
  const [activa, setActiva] = useState<string | null>(null);
  const t = libro.resumen?.acciones;
  return (
    <>
      <div className="hx-acciones">
        <BorrarElegida libro={libro} clave={activa} />
      </div>
      <div className="hx-bloques">
        <FilaRevision libro={libro} hoja="acciones" />
        <div>
          <TablaEventos
            libro={libro}
            tipo="accion"
            nombre="Acciones"
            columnas={COLS_ACCIONES}
            desde={FILAS.acciones.desde}
            calcular={(e) => ({ situacion: situacionAccion({ ...(e.data as unknown as Accion), fecha: e.fecha }, libro.rango) })}
            filaActiva={activa}
            onFilaActiva={setActiva}
          />
          <AbiertasAntes libro={libro} tipo="accion" />
        </div>
        <TablaPares
          nombre="Totales de acciones"
          desde={113}
          filas={[
            ["Acciones del mes", t?.delMes, 0],
            ["Cerradas", t?.cerradas, 0],
            ["Vencidas al cierre", t?.vencidas, 0],
          ]}
        />
        <Nota>Incluya las medidas ejecutadas durante el mes y las que queden pendientes. Una acción solo se marca Cerrada con resultado verificable y soporte.</Nota>
      </div>
    </>
  );
};

// -----------------------------------------------------------------------------
// Resumen: solo lectura
// -----------------------------------------------------------------------------
const fila4 = (titulos: string[], anchos: number[], desde: string): ColHoja[] =>
  titulos.map((titulo, i) => ({
    letra: String.fromCharCode(desde.charCodeAt(0) + i),
    titulo,
    key: `c${i}`,
    tipo: i === 0 ? "ref" : "calc",
    ancho: anchos[i],
    der: i > 0 && !["Cumplimiento", "Estado", "Referencia", "Unidad", "Dónde rellenar", "Detalle", "Revisión", "Escala / soporte"].includes(titulo),
  }));

const aFilas = (nombre: string, filas: unknown[][], desde?: number): FilaTabla[] =>
  filas.map((v, i) => ({
    id: `${nombre}-${i}`,
    numero: desde === undefined ? undefined : desde + i,
    valores: Object.fromEntries(v.map((x, j) => [`c${j}`, typeof x === "number" ? fmtCelda(x) : x])),
  }));

export const HojaResumen = ({ libro, acciones }: { libro: LibroMes; acciones: React.ReactNode }) => {
  const r = libro.resumen;
  if (!r) return null;
  const o = r.operacion.total;
  const faltan = r.operacion.diasPorCompletar;
  const dias = (n: number) => `${n} días`;
  const c = r.calidad;

  return (
    <>
      <div className="hx-acciones">{acciones}</div>
      <div className="hx-bloques hx-dos">
        <TablaHoja
          rellenar={false}
          nombre="Cabecera"
          sinCabecera
          columnas={fila4(["", ""], [150, 330], "A")}
          filas={aFilas("cab", [
            ["Hotel", libro.nombreHotel],
            ["Representante", r.datos.representante || "Completar"],
          ], 7)}
        />
        <TablaHoja
          rellenar={false}
          nombre="Mes"
          sinCabecera
          columnas={fila4(["", ""], [150, 330], "F")}
          filas={aFilas("mes", [["Mes y año", new Date(r.anio, r.mes - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" })]], 7)}
        />
        <div>
          <Subtitulo>Producción y jornada registradas</Subtitulo>
          <TablaHoja
            rellenar={false}
            nombre="Producción y jornada"
            columnas={fila4(["Indicador", "Resultado", "Unidad", "Falta completar"], [230, 100, 100, 100], "A")}
            filas={aFilas("prod", [
              ["Producción lavada", o.kg, "kg", dias(faltan.kg)],
              ["Ocupación acumulada", o.turistas, "turistas días", dias(faltan.turistas)],
              ["Ropa recibida", o.recibidas, "piezas", dias(faltan.recibidas)],
              ["Ropa entregada", o.entregadas, "piezas", dias(faltan.entregadas)],
              ["Jornada prevista", o.horas_previstas, "h", dias(faltan.horas_previstas)],
              ["Tiempo trabajado", o.horas_trabajadas, "h", dias(faltan.horas_trabajadas)],
              ["Parada única", o.parada, "h", dias(faltan.parada)],
              ["Kg por turista día", typeof r.operacion.kgPorTurista === "number" ? fmtCelda(r.operacion.kgPorTurista, 3) : r.operacion.kgPorTurista, "kg/TD", ""],
              ["Balance entregadas menos recibidas", r.operacion.balance, "piezas", ""],
            ], 12)}
          />
          <Nota>Los días pendientes distinguen un total parcial de uno completo.</Nota>
        </div>
        <div>
          <Subtitulo>Revisión declarada de los registros</Subtitulo>
          <TablaHoja
            rellenar={false}
            nombre="Revisión declarada"
            columnas={fila4(["Hoja", "Revisión", "Detalle"], [170, 110, 300], "F")}
            filas={aFilas("rev", r.revision.map((x) => [x.hoja, x.estado, x.detalle]), 12)}
          />
        </div>
        <div>
          <Subtitulo>Matriz de resultados del SLA</Subtitulo>
          <TablaHoja
            rellenar={false}
            nombre="Matriz del SLA"
            columnas={fila4(["KPI", "Meta", "Resultado", "Cumplimiento"], [230, 70, 90, 110], "A")}
            filas={aFilas("sla", r.kpis.map((k) => [k.nombre, k.meta === null ? "Sin cargar" : pct(k.meta), pct(k.resultado), k.cumplimiento]), 26)}
          />
          <TablaHoja
            rellenar={false}
            nombre="KPI que cumplen"
            sinCabecera
            columnas={fila4(["", "", "", ""], [230, 70, 90, 110], "A")}
            filas={aFilas("kp", [["KPI que cumplen", r.kpisCumplen, "KPI evaluados", r.kpisEvaluados]], 37)}
          />
        </div>
        <div>
          <Subtitulo>Calidad percibida y controles</Subtitulo>
          <TablaHoja
            rellenar={false}
            nombre="Calidad percibida"
            columnas={fila4(["Concepto", "Resultado", "Unidad", "Escala / soporte"], [190, 100, 80, 160], "F")}
            filas={aFilas("cal", [
              ["Valoración del lavado", c.lavado.puntuacion ?? "Completar", "puntos", c.lavado.documento],
              ["Valoración del servicio", c.servicio.puntuacion ?? "Completar", "puntos", c.servicio.documento],
              ["Reprocesos", c.reprocesos ?? "Completar", "piezas", ""],
              ["Reclamaciones", c.reclamaciones ?? "Completar", "casos", ""],
              ["Daños imputables", c.danos ?? "Completar", "piezas", ""],
              ["Encuestas de lavado", c.lavado.encuestas ?? "Completar", "", ""],
              ["Encuestas de servicio", c.servicio.encuestas ?? "Completar", "", ""],
            ], 26)}
          />
        </div>
        <div>
          <Subtitulo>Incidencias del mes</Subtitulo>
          <TablaPares
            nombre="Incidencias del mes"
            desde={41}
            ancho={230}
            filas={[
              ["Incidencias registradas", r.incidencias.registradas, 0],
              ["Incidencias cerradas", r.incidencias.cerradas, 0],
              ["Agua horas informadas", r.incidencias.horasAgua],
              ["Electricidad horas informadas", r.incidencias.horasElectricidad],
            ]}
          />
        </div>
        <div>
          <Subtitulo>Estado técnico y mantenimiento</Subtitulo>
          <TablaPares
            nombre="Estado técnico"
            desde={41}
            ancho={230}
            columna="F"
            filas={[
              ["Equipos totales", r.equipos.total, 0],
              ["Equipos operativos", r.equipos.operativos, 0],
              ["Equipos fuera de servicio", r.equipos.fueraServicio, 0],
              ["Preventivos previstos", r.equipos.preventivosPrevistos, 0],
              ["Preventivos ejecutados", r.equipos.preventivosEjecutados, 0],
            ]}
          />
        </div>
        <div>
          <Subtitulo>Inventario y diferencias</Subtitulo>
          <TablaPares
            nombre="Inventario y diferencias"
            desde={50}
            ancho={230}
            filas={[
              ["Existencia actual registrada", r.inventario.existencia, 0],
              ["Prendas pactadas", r.inventario.pactadas, 0],
              ["Faltantes vs pactado", r.inventario.faltantes, 0],
              ["Sobrantes vs pactado", r.inventario.sobrantes, 0],
              ["Estado del inventario", r.inventario.estado],
            ]}
          />
        </div>
        <div>
          <Subtitulo>Importes por moneda</Subtitulo>
          <TablaHoja
            rellenar={false}
            nombre="Importes"
            columnas={fila4(["Moneda", "Calculado", "Conciliado", "Sin conciliar"], [110, 100, 100, 100], "F")}
            filas={aFilas("imp", r.retiros.porMoneda.map((x) => [x.clave, x.calculado, x.conciliado, x.sinConciliar]), 51)}
          />
          <TablaHoja
            rellenar={false}
            nombre="Piezas"
            columnas={fila4(["Concepto", "Piezas registradas", "Conciliadas", "Sin conciliar"], [110, 100, 100, 100], "F")}
            filas={aFilas("pie", r.retiros.porConcepto.map((x) => [x.clave, x.calculado, x.conciliado, x.sinConciliar]), 56)}
          />
        </div>
        <div>
          <Subtitulo>Existencias frente a prendas pactadas</Subtitulo>
          <TablaHoja
            rellenar={false}
            nombre="Existencias"
            columnas={fila4(["Artículo", "Pactadas", "Actuales", "Saldo (+ / −)"], [190, 90, 90, 100], "A")}
            filas={aFilas("art", r.articulos.map((a) => [a.prenda, a.pactadas, a.actuales, a.saldo]), 59)}
          />
        </div>
        <div>
          <Subtitulo>Seguimiento de acciones</Subtitulo>
          <TablaPares
            nombre="Seguimiento de acciones"
            desde={61}
            ancho={230}
            columna="F"
            filas={[
              ["Acciones del mes", r.acciones.delMes, 0],
              ["Acciones cerradas", r.acciones.cerradas, 0],
              ["Acciones vencidas al cierre", r.acciones.vencidas, 0],
            ]}
          />
        </div>
        <div className="hx-ancha">
          <Subtitulo>Síntesis del mes para el informe</Subtitulo>
          <TablaHoja
            rellenar={false}
            nombre="Síntesis"
            sinCabecera
            columnas={fila4(["", ""], [190, 680], "A")}
            filas={aFilas("sin", [
              ["Logros y resultados", r.sintesis.logros || "Completar"],
              ["Dificultades e impacto", r.sintesis.dificultades || "Completar"],
              ["Acuerdos y conclusión", r.sintesis.acuerdos || "Completar"],
            ])}
          />
        </div>
        <div>
          <Subtitulo>Control del procesado por área</Subtitulo>
          <TablaHoja
            rellenar={false}
            nombre="Control por área"
            columnas={fila4(["Área", "Conformes (pzs)", "Manchas (pzs)", "Roturas (pzs)"], [130, 100, 100, 100], "A")}
            filas={aFilas("area", r.areas.map((a) => [a.area, a.conformes, a.manchas, a.roturas]), 87)}
          />
        </div>
        <div>
          <Subtitulo>Estado de los registros incorporados</Subtitulo>
          <TablaHoja
            rellenar={false}
            nombre="Registros incorporados"
            columnas={fila4(["Origen", "Estado", "Por revisar", "Referencia"], [170, 130, 80, 170], "F")}
            filas={aFilas("reg", [
              ["Control de lavado", r.registros.lavado, r.lavado.pendientes, "Ver Lavado_detalle"],
              ["Conteo de lencería", r.inventario.estado, "", "Ver Inventario"],
              ["Control de procesado", r.registros.procesado, r.procesado.pendientes, "Ver Procesado_detalle"],
            ], 87)}
          />
        </div>
        <div>
          <Subtitulo>Revisión del procesado por área</Subtitulo>
          <TablaHoja
            rellenar={false}
            nombre="Revisión por área"
            columnas={fila4(["Área", "Registros completos", "Por revisar", "Estado"], [130, 100, 100, 130], "A")}
            filas={aFilas("revA", r.areas.map((a) => [a.area, a.completos, a.porRevisar, a.porRevisar > 0 ? "Revisar" : a.completos === 0 ? "Completar" : "Completo"]), 97)}
          />
        </div>
      </div>
    </>
  );
};

/** Para el informe del día: el parte propio o, si es de otra persona, el suyo. */
export const parteParaInforme = (libro: LibroMes, fecha: string) => {
  const ajeno = !libro.diaEditable(fecha) ? libro.ajenos.find((s) => s.fecha === fecha) : null;
  return ajeno ? leerParte(ajeno.data) : libro.parteDelDia(fecha);
};
