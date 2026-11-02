import { celdaDetalle, CIERRES, Jornada, RangoMes } from "@/lib/control";
import { filasLavado, ParteData, totalesParte } from "@/lib/controlResumen";
import { Bloque, Calculado, Campo, CampoNumero, CampoTexto, fmtCelda, Seg } from "./ui";

const PasoJornada = ({
  fecha,
  rango,
  parte,
  horasComoAyer,
  onChange,
  readOnly,
}: {
  fecha: string;
  rango: RangoMes;
  parte: ParteData;
  /** Las horas previstas se han traído del día anterior. */
  horasComoAyer: boolean;
  onChange: (cambio: Partial<Jornada>) => void;
  readOnly?: boolean;
}) => {
  const j = parte.jornada;
  const t = totalesParte(fecha, parte, rango);
  const lav = filasLavado(fecha, parte);
  // Lo oficial de Operacion!C y D; mientras el día está abierto se enseña lo que va.
  const celda = (campo: "kg" | "recibidas", parcial: number) => {
    const c = celdaDetalle(j.cierre, lav, rango, campo);
    if (c !== "") return fmtCelda(c);
    return lav.length === 0 ? "—" : `${fmtCelda(parcial)} parcial`;
  };

  return (
    <Bloque
      titulo="Jornada"
      ayuda="Blanco es para rellenar. Azul claro se calcula solo. Las horas admiten decimal o reloj: 1,50 o 1:30. Vacío significa pendiente: escribe 0 solo si has comprobado que no hubo cantidad."
    >
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Campo label="Turistas del día" htmlFor="j-turistas">
          <CampoNumero id="j-turistas" value={j.turistas} readOnly={readOnly} onChange={(x) => onChange({ turistas: x })} />
        </Campo>
        <Campo label="Piezas entregadas" htmlFor="j-entregadas">
          <CampoNumero id="j-entregadas" value={j.entregadas} readOnly={readOnly} onChange={(x) => onChange({ entregadas: x })} />
        </Campo>
        <Campo label={horasComoAyer ? "Horas previstas (como ayer)" : "Horas previstas"} htmlFor="j-previstas">
          <CampoNumero id="j-previstas" tipo="horas" value={j.horas_previstas} readOnly={readOnly} onChange={(x) => onChange({ horas_previstas: x })} />
        </Campo>
        <Campo label="Horas trabajadas" htmlFor="j-trabajadas">
          <CampoNumero id="j-trabajadas" tipo="horas" value={j.horas_trabajadas} readOnly={readOnly} onChange={(x) => onChange({ horas_trabajadas: x })} />
        </Campo>
        <Campo label="Parada única (h)" htmlFor="j-parada">
          <CampoNumero id="j-parada" tipo="horas" value={j.parada} readOnly={readOnly} onChange={(x) => onChange({ parada: x })} />
        </Campo>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-[1fr_1fr_2.2fr]">
        <Campo label="Kg lavados (desde Lavado)">
          <Calculado>{celda("kg", t.kg)}</Calculado>
        </Campo>
        <Campo label="Piezas recibidas (desde Lavado)">
          <Calculado>{celda("recibidas", t.declaracion)}</Calculado>
        </Campo>
        <Campo label="Observación o parte" htmlFor="j-obs" className="col-span-2 lg:col-span-1">
          <CampoTexto id="j-obs" placeholder="Opcional" value={j.observacion} readOnly={readOnly} onChange={(x) => onChange({ observacion: x })} />
        </Campo>
      </div>
      <div className="neo-inset-sm rounded-2xl p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-sm font-bold">Cierre de lavado</p>
          <p className="text-xs font-medium text-muted-foreground leading-relaxed">
            Los kg y piezas del día solo cuentan en el mes cuando la jornada está cerrada y todos sus registros están
            completos. «Sin actividad» es que se comprobó que no hubo recepción ni lavado.
          </p>
        </div>
        <Seg
          etiqueta="Cierre de lavado"
          opciones={CIERRES}
          valor={j.cierre}
          readOnly={readOnly}
          onChange={(x) => onChange({ cierre: x })}
          className="bg-card"
        />
      </div>
    </Bloque>
  );
};

export default PasoJornada;
