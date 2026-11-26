import { notFound } from "next/navigation";
import { Hoja, TablaPeriodos } from "@/components/cobranzas/Documento";
import { requireCobranzasAccess, cargarCobranza, liquidarCobranza, hoyUTC } from "@/lib/expensas/data";
import { formatARS, formatFecha } from "@/lib/expensas/liquidacion";

export const dynamic = "force-dynamic";

export default async function CartaDocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plazo?: string }>;
}) {
  await requireCobranzasAccess();
  const { id } = await params;
  const sp = await searchParams;
  const c = await cargarCobranza(id);
  if (!c) notFound();

  const hoy = hoyUTC();
  const l = liquidarCobranza(c, hoy);
  const plazo = sp.plazo && /^\d{1,2}$/.test(sp.plazo) ? `${sp.plazo} días hábiles` : "5 (cinco) días hábiles";
  const cons = c.consorcio;
  const deudores = c.unidad.deudores;
  const destinatario = deudores[0]?.deudor;

  return (
    <Hoja>
      <div className="mb-6 text-[10pt]">
        <p>
          <strong>Remitente:</strong> {cons.nombre}
          {cons.cuit ? ` — CUIT ${cons.cuit}` : ""}
          {cons.domicilio ? ` — ${cons.domicilio}${cons.localidad ? `, ${cons.localidad}` : ""}` : ""}
        </p>
        <p>
          <strong>Destinatario/s:</strong> {deudores.map((d) => d.deudor.nombre).join(", ") || "__________"}
          {destinatario?.documento ? ` — ${destinatario.documento}` : ""}
        </p>
        <p>
          <strong>Domicilio:</strong> {destinatario?.domicilioNotificacion || destinatario?.domicilioReal || c.unidad.identificacion}
        </p>
        <p>
          <strong>Fecha:</strong> {formatFecha(hoy)}
        </p>
      </div>

      <p className="mb-4 text-justify">
        En mi carácter de letrado apoderado del <strong>{cons.nombre}</strong>, INTIMO a Ud. para que en el plazo perentorio de {plazo} de
        recibida la presente abone la suma de <strong>{formatARS(l.total)}</strong>, adeudada en concepto de expensas comunes correspondientes a
        la <strong>{c.unidad.identificacion}</strong>, comprensiva de {formatARS(l.totalCapital)} de capital y {formatARS(l.totalIntereses)} de
        intereses calculados al día de la fecha conforme reglamento, según el siguiente detalle:
      </p>

      <TablaPeriodos l={l} />

      <p className="mb-4 text-justify">
        Todo ello con más los intereses que se devenguen hasta el efectivo pago. Bajo apercibimiento de expedir el certificado de deuda
        previsto en el art. 2048 del Código Civil y Comercial de la Nación y promover sin más trámite la acción ejecutiva correspondiente, con
        costas a su cargo. La presente vale asimismo como interpelación fehaciente a los efectos del art. 2541 del CCyC.
      </p>
      <p className="mb-4 text-justify">
        El pago podrá efectuarse mediante depósito o transferencia a la cuenta del consorcio, debiendo remitir el comprobante a este estudio.
        Queda Ud. debidamente notificado/a.
      </p>

      <div className="mt-16 w-64 border-t border-black pt-1 text-center text-[10pt]">Firma y aclaración del letrado</div>
    </Hoja>
  );
}
