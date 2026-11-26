import Link from "next/link";
import { notFound } from "next/navigation";
import { Hoja, TablaPeriodos, importeEnLetras } from "@/components/cobranzas/Documento";
import { requireCobranzasAccess, cargarCobranza, liquidarCobranza, hoyUTC } from "@/lib/expensas/data";
import { formatARS, formatFecha, type Liquidacion } from "@/lib/expensas/liquidacion";

export const dynamic = "force-dynamic";

export default async function CertificadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ corte?: string; prescriptos?: string }>;
}) {
  await requireCobranzasAccess();
  const { id } = await params;
  const sp = await searchParams;
  const c = await cargarCobranza(id);
  if (!c) notFound();

  const corte = sp.corte && /^\d{4}-\d{2}-\d{2}$/.test(sp.corte) ? new Date(sp.corte + "T00:00:00Z") : hoyUTC();
  const full = liquidarCobranza(c, corte);
  const incluirPrescriptos = sp.prescriptos === "1";
  const periodos = incluirPrescriptos ? full.periodos : full.periodos.filter((p) => p.prescripcion !== "PRESCRIPTA");
  const l: Liquidacion = { ...full, periodos };
  const total = periodos.reduce((s, p) => s + p.total, 0);
  const capital = periodos.reduce((s, p) => s + p.capitalPendiente, 0);
  const intereses = periodos.reduce((s, p) => s + p.interesPendiente, 0);

  const cons = c.consorcio;
  const esPH = cons.tipo === "PROPIEDAD_HORIZONTAL";
  const deudores = c.unidad.deudores.map((d) => `${d.deudor.nombre}${d.deudor.documento ? ` (${d.deudor.documento})` : ""}`).join(", ");
  const adm = cons.administradora;

  const aviso = (
    <div className="space-y-2 text-xs">
      {!esPH ? (
        <div className="rounded border border-amber-400 bg-amber-50 p-3 text-amber-900">
          <strong>Conjunto inmobiliario:</strong> verificar si el barrio se adecuó al régimen de propiedad horizontal especial (arts. 2073-2075
          CCyC). Si sigue organizado como asociación civil o sociedad, el carácter de título ejecutivo del certificado es discutido y conviene
          revisar el estatuto y el criterio del fuero antes de ejecutar.
        </div>
      ) : null}
      {full.periodosPrescriptos > 0 ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-900">
          Hay {full.periodosPrescriptos} período(s) que el sistema marca como prescriptos (plazo configurado: {cons.prescripcionMeses} meses).{" "}
          {incluirPrescriptos ? (
            <Link className="underline" href={`?corte=${corte.toISOString().slice(0, 10)}`}>
              Excluirlos
            </Link>
          ) : (
            <>
              Están excluidos.{" "}
              <Link className="underline" href={`?corte=${corte.toISOString().slice(0, 10)}&prescriptos=1`}>
                Incluirlos igual
              </Link>
            </>
          )}
        </div>
      ) : null}
      {l.tasaTotalAnual === 0 ? (
        <div className="rounded border border-amber-400 bg-amber-50 p-3 text-amber-900">El consorcio no tiene tasa de interés configurada.</div>
      ) : null}
    </div>
  );

  return (
    <Hoja aviso={aviso}>
      <h1 className="mb-6 text-center text-[14pt] font-bold uppercase tracking-wide">Certificado de deuda por expensas</h1>
      <p className="mb-4 text-justify">
        {adm ? (
          <>
            {adm.razonSocial}
            {adm.cuit ? `, CUIT ${adm.cuit}` : ""}
            {adm.matricula ? `, matrícula ${adm.matricula}` : ""}, en su carácter de administrador
          </>
        ) : (
          <>El/la que suscribe, en su carácter de administrador/a</>
        )}{" "}
        del <strong>{cons.nombre}</strong>
        {cons.cuit ? `, CUIT ${cons.cuit}` : ""}
        {cons.domicilio ? `, con domicilio en ${cons.domicilio}${cons.localidad ? `, ${cons.localidad}` : ""}` : ""}, CERTIFICA que la{" "}
        <strong>{c.unidad.identificacion}</strong>
        {c.unidad.matricula ? ` (matrícula ${c.unidad.matricula})` : ""}
        {c.unidad.partida ? ` (partida ${c.unidad.partida})` : ""}, cuyo/s titular/es u obligado/s al pago es/son {deudores || "__________"}, adeuda al
        consorcio, al día {formatFecha(corte)}, en concepto de expensas comunes y demás contribuciones, las sumas que se detallan a continuación:
      </p>

      <TablaPeriodos l={l} />

      <p className="mb-4 text-justify">
        Total adeudado: <strong>{formatARS(total)}</strong> (pesos {importeEnLetras(total)}), compuesto por {formatARS(capital)} de capital y{" "}
        {formatARS(intereses)} de intereses
        {l.tasaTotalAnual > 0
          ? ` calculados a la tasa del ${Number(cons.tasaMoratoriaAnual)}% nominal anual${
              Number(cons.tasaPunitoriaAnual) > 0 ? ` más ${Number(cons.tasaPunitoriaAnual)}% nominal anual de interés punitorio` : ""
            } prevista en el reglamento, desde el vencimiento de cada período`
          : ""}
        , sin perjuicio de los intereses que se devenguen hasta el efectivo pago.
      </p>
      <p className="mb-10 text-justify">
        Se expide el presente en los términos del art. 2048, segundo párrafo, del Código Civil y Comercial de la Nación, a los efectos de
        promover la acción ejecutiva correspondiente, en {cons.localidad || "__________"}, a los {corte.getUTCDate()} días del mes de{" "}
        {corte.toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" })} de {corte.getUTCFullYear()}.
      </p>

      <div className="mt-16 grid grid-cols-2 gap-12 text-center text-[10pt]">
        <div>
          <div className="border-t border-black pt-1">Firma y sello del administrador</div>
        </div>
        <div>
          <div className="border-t border-black pt-1">Aprobación del consejo de propietarios (si existe)</div>
        </div>
      </div>
    </Hoja>
  );
}
