import { Field, inputCls } from "./ui";
import { TIPO_CONSORCIO_LABEL } from "@/lib/expensas/estados";

type Defaults = {
  nombre?: string;
  tipo?: string;
  cuit?: string | null;
  domicilio?: string | null;
  localidad?: string | null;
  jurisdiccion?: string;
  administradoraId?: string | null;
  tasaMoratoriaAnual?: string | number;
  tasaPunitoriaAnual?: string | number;
  diaVencimiento?: number;
  prescripcionMeses?: number;
  abonoMensual?: string | number | null;
  honorariosExtrajudicialesPct?: string | number | null;
  notes?: string | null;
};

export function ConsorcioFields({
  administradoras,
  d = {},
}: {
  administradoras: { id: string; razonSocial: string }[];
  d?: Defaults;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Nombre *">
          <input name="nombre" required defaultValue={d.nombre} className={inputCls} placeholder="Consorcio Av. Santa Fe 1234 / Barrio Los Robles" />
        </Field>
      </div>
      <Field label="Tipo">
        <select name="tipo" defaultValue={d.tipo ?? "PROPIEDAD_HORIZONTAL"} className={inputCls}>
          {Object.entries(TIPO_CONSORCIO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Jurisdicción">
        <select name="jurisdiccion" defaultValue={d.jurisdiccion ?? "CABA"} className={inputCls}>
          <option value="CABA">CABA</option>
          <option value="PBA">Provincia de Buenos Aires</option>
          <option value="OTRA">Otra</option>
        </select>
      </Field>
      <Field label="CUIT">
        <input name="cuit" defaultValue={d.cuit ?? ""} className={inputCls} />
      </Field>
      <Field label="Administradora">
        <select name="administradoraId" defaultValue={d.administradoraId ?? ""} className={inputCls}>
          <option value="">— Sin administradora / autoadministrado —</option>
          {administradoras.map((a) => (
            <option key={a.id} value={a.id}>
              {a.razonSocial}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Domicilio">
        <input name="domicilio" defaultValue={d.domicilio ?? ""} className={inputCls} />
      </Field>
      <Field label="Localidad / partido">
        <input name="localidad" defaultValue={d.localidad ?? ""} className={inputCls} />
      </Field>
      <Field label="Interés moratorio (TNA %)" hint="Según reglamento o asamblea">
        <input name="tasaMoratoriaAnual" type="number" step="0.001" min="0" defaultValue={String(d.tasaMoratoriaAnual ?? 0)} className={inputCls} />
      </Field>
      <Field label="Interés punitorio (TNA %)" hint="Se suma al moratorio">
        <input name="tasaPunitoriaAnual" type="number" step="0.001" min="0" defaultValue={String(d.tasaPunitoriaAnual ?? 0)} className={inputCls} />
      </Field>
      <Field label="Día de vencimiento">
        <input name="diaVencimiento" type="number" min="1" max="31" defaultValue={d.diaVencimiento ?? 10} className={inputCls} />
      </Field>
      <Field label="Alerta de prescripción (meses)" hint="24 = criterio art. 2562 inc. c; 60 = art. 2560">
        <input name="prescripcionMeses" type="number" min="1" max="240" defaultValue={d.prescripcionMeses ?? 24} className={inputCls} />
      </Field>
      <Field label="Abono mensual asesoramiento ($)">
        <input name="abonoMensual" type="number" step="0.01" min="0" defaultValue={d.abonoMensual != null ? String(d.abonoMensual) : ""} className={inputCls} />
      </Field>
      <Field label="Honorarios extrajudiciales (%)">
        <input
          name="honorariosExtrajudicialesPct"
          type="number"
          step="0.01"
          min="0"
          defaultValue={d.honorariosExtrajudicialesPct != null ? String(d.honorariosExtrajudicialesPct) : ""}
          className={inputCls}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notas">
          <textarea name="notes" rows={2} defaultValue={d.notes ?? ""} className={inputCls} />
        </Field>
      </div>
    </div>
  );
}
