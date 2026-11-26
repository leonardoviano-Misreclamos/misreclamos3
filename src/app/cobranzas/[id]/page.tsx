import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TicketsLayout } from "@/components/tickets/TicketsLayout";
import { Card, Field, EstadoBadge, PrescripcionBadge, inputCls, btnCls, btnSecondaryCls, hoyISO } from "@/components/cobranzas/ui";
import { requireCobranzasAccess, cargarCobranza, liquidarCobranza, hoyUTC } from "@/lib/expensas/data";
import { ESTADO_LABEL, TRANSICIONES, ROL_DEUDOR_LABEL, TIPO_CONSORCIO_LABEL } from "@/lib/expensas/estados";
import { formatARS, formatFecha, formatPeriodo } from "@/lib/expensas/liquidacion";
import {
  cambiarEstado,
  registrarPago,
  crearPlanPago,
  marcarCuotaPagada,
  agregarDeudor,
  agregarNota,
  asignarAbogado,
  actualizarDatosJudiciales,
  eliminarDeuda,
  cargarDeuda,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function CobranzaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ corte?: string }>;
}) {
  await requireCobranzasAccess();
  const { id } = await params;
  const sp = await searchParams;
  const c = await cargarCobranza(id);
  if (!c) notFound();

  const corte = sp.corte && /^\d{4}-\d{2}-\d{2}$/.test(sp.corte) ? new Date(sp.corte + "T00:00:00Z") : hoyUTC();
  const l = liquidarCobranza(c, corte);
  const abogados = await prisma.agentUser.findMany({
    where: { role: { in: ["ADMIN", "SUPPORT"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const path = `/cobranzas/${id}`;
  const plan = c.planes.find((p) => p.activo);
  const siguientes = TRANSICIONES[c.estado];
  const tasa = l.tasaTotalAnual;

  return (
    <TicketsLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/cobranzas" className="text-xs text-slate-500 hover:underline">
              ← Expedientes
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">{c.code}</h1>
              <EstadoBadge estado={c.estado} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              <Link href={`/cobranzas/consorcios/${c.consorcioId}`} className="hover:underline">
                {c.consorcio.nombre}
              </Link>{" "}
              ({TIPO_CONSORCIO_LABEL[c.consorcio.tipo]}, {c.consorcio.jurisdiccion}) · {c.unidad.identificacion}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`${path}/carta-documento`} className={btnSecondaryCls} target="_blank">
              Modelo de carta documento
            </Link>
            <Link href={`${path}/certificado`} className={btnSecondaryCls} target="_blank">
              Certificado de deuda (art. 2048)
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Capital adeudado" value={formatARS(l.totalCapital)} />
          <Stat label={`Intereses (${tasa}% TNA)`} value={formatARS(l.totalIntereses)} />
          <Stat label="Total" value={formatARS(l.total)} strong />
          <Stat label="Exigible (sin prescriptos)" value={formatARS(l.totalExigible)} warn={l.totalExigible < l.total} />
          <Stat label="Pagado" value={formatARS(l.totalPagado)} />
        </div>

        {tasa === 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            El consorcio no tiene tasa de interés configurada: la liquidación no incluye intereses. Revisá el reglamento y cargala en los datos del consorcio.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card
              title="Liquidación por período"
              actions={
                <form className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Fecha de corte</span>
                  <input type="date" name="corte" defaultValue={corte.toISOString().slice(0, 10)} className={`${inputCls} w-auto py-1`} />
                  <button className={btnSecondaryCls}>Recalcular</button>
                </form>
              }
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Período</th>
                      <th className="py-2 pr-3">Concepto</th>
                      <th className="py-2 pr-3">Vence</th>
                      <th className="py-2 pr-3 text-right">Original</th>
                      <th className="py-2 pr-3 text-right">Capital</th>
                      <th className="py-2 pr-3 text-right">Días</th>
                      <th className="py-2 pr-3 text-right">Interés</th>
                      <th className="py-2 pr-3 text-right">Total</th>
                      <th className="py-2 pr-3">Prescripción</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {l.periodos.map((p) => (
                      <tr key={p.id} className={p.total === 0 ? "text-slate-400" : ""}>
                        <td className="py-1.5 pr-3 capitalize">{formatPeriodo(p.periodo)}</td>
                        <td className="py-1.5 pr-3 text-xs">{p.concepto.toLowerCase().replace("_", " ")}</td>
                        <td className="py-1.5 pr-3 text-xs">{formatFecha(p.fechaVencimiento)}</td>
                        <td className="py-1.5 pr-3 text-right">{formatARS(p.capitalOriginal)}</td>
                        <td className="py-1.5 pr-3 text-right">{formatARS(p.capitalPendiente)}</td>
                        <td className="py-1.5 pr-3 text-right text-xs">{p.diasMora}</td>
                        <td className="py-1.5 pr-3 text-right">{formatARS(p.interesPendiente)}</td>
                        <td className="py-1.5 pr-3 text-right font-medium">{formatARS(p.total)}</td>
                        <td className="py-1.5 pr-3" title={`Prescribe el ${formatFecha(p.fechaPrescripcion)}`}>
                          <PrescripcionBadge estado={p.prescripcion} />
                        </td>
                        <td className="py-1.5 text-right">
                          <form action={eliminarDeuda.bind(null, p.id, path)}>
                            <button className="text-xs text-slate-400 hover:text-red-600" title="Eliminar período">
                              ✕
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {l.saldoAFavor > 0 ? <p className="mt-3 text-sm text-emerald-700">Saldo a favor del deudor: {formatARS(l.saldoAFavor)}</p> : null}
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-[#375A7F]">Agregar períodos</summary>
                <form action={cargarDeuda.bind(null, c.unidadId, path)} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Field label="Desde (mes)">
                    <input name="desde" type="month" required className={inputCls} />
                  </Field>
                  <Field label="Hasta (mes)">
                    <input name="hasta" type="month" className={inputCls} />
                  </Field>
                  <Field label="Monto mensual">
                    <input name="monto" type="number" step="0.01" min="0.01" required className={inputCls} />
                  </Field>
                  <Field label="Concepto">
                    <select name="concepto" className={inputCls}>
                      <option value="ORDINARIA">Ordinaria</option>
                      <option value="EXTRAORDINARIA">Extraordinaria</option>
                      <option value="FONDO_RESERVA">Fondo de reserva</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </Field>
                  <div className="flex items-end">
                    <button className={`${btnCls} w-full`}>Cargar</button>
                  </div>
                </form>
              </details>
            </Card>

            <Card title="Historial">
              <ol className="space-y-3">
                {c.eventos.map((e) => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <span className="w-20 flex-shrink-0 text-xs text-slate-500">{formatFecha(e.fecha)}</span>
                    <div>
                      <div className="text-slate-800">{e.descripcion}</div>
                      {e.estadoHasta && e.estadoDesde ? (
                        <div className="text-[11px] text-slate-400">
                          {ESTADO_LABEL[e.estadoDesde]} → {ESTADO_LABEL[e.estadoHasta]}
                        </div>
                      ) : null}
                      {e.data && typeof e.data === "object" ? <EventoData data={e.data as Record<string, unknown>} /> : null}
                    </div>
                  </li>
                ))}
              </ol>
              <form action={agregarNota.bind(null, id)} className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <input type="date" name="fecha" defaultValue={hoyISO()} className={`${inputCls} w-auto`} />
                <input name="descripcion" required placeholder="Agregar nota o actuación" className={`${inputCls} flex-1`} />
                <button className={btnSecondaryCls}>Agregar</button>
              </form>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Avanzar etapa">
              {siguientes.length === 0 ? (
                <p className="text-sm text-slate-500">Sin transiciones disponibles.</p>
              ) : (
                <form action={cambiarEstado.bind(null, id)} className="space-y-3">
                  <Field label="Nueva etapa">
                    <select name="estado" className={inputCls}>
                      {siguientes
                        .filter((s) => s !== "PLAN_DE_PAGO")
                        .map((s) => (
                          <option key={s} value={s}>
                            {ESTADO_LABEL[s]}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Fecha del acto">
                    <input type="date" name="fecha" defaultValue={hoyISO()} required className={inputCls} />
                  </Field>
                  <Field label="Descripción (opcional)">
                    <input name="descripcion" className={inputCls} />
                  </Field>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-[#375A7F]">Datos de CD / juicio</summary>
                    <div className="mt-2 space-y-2">
                      <Field label="Nº de carta documento">
                        <input name="nroCartaDocumento" className={inputCls} />
                      </Field>
                      <Field label="Fecha de recepción (acuse)">
                        <input type="date" name="fechaRecepcion" className={inputCls} />
                      </Field>
                      <Field label="Nº de expediente">
                        <input name="expedienteNumber" className={inputCls} />
                      </Field>
                      <Field label="Juzgado">
                        <input name="juzgado" className={inputCls} />
                      </Field>
                    </div>
                  </details>
                  <button className={`${btnCls} w-full`}>Registrar</button>
                  <p className="text-[11px] text-slate-400">
                    Al pasar a certificado o ejecución se congela la liquidación a esa fecha en el historial. La primera CD se toma como
                    interpelación fehaciente para la suspensión de la prescripción (art. 2541).
                  </p>
                </form>
              )}
            </Card>

            <Card title="Deudores">
              <ul className="space-y-2 text-sm">
                {c.unidad.deudores.map((d) => (
                  <li key={d.deudorId}>
                    <div className="font-medium">{d.deudor.nombre}</div>
                    <div className="text-xs text-slate-500">
                      {[ROL_DEUDOR_LABEL[d.rol], d.deudor.documento, d.deudor.domicilioNotificacion, d.deudor.email, d.deudor.phone]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </li>
                ))}
                {c.unidad.deudores.length === 0 ? <li className="text-slate-500">Sin deudores cargados.</li> : null}
              </ul>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-[#375A7F]">Agregar deudor</summary>
                <form action={agregarDeudor.bind(null, c.unidadId, path)} className="mt-2 space-y-2">
                  <input name="nombre" required placeholder="Nombre y apellido / razón social" className={inputCls} />
                  <div className="grid grid-cols-2 gap-2">
                    <input name="documento" placeholder="DNI / CUIT" className={inputCls} />
                    <select name="rol" className={inputCls}>
                      {Object.entries(ROL_DEUDOR_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input name="domicilioNotificacion" placeholder="Domicilio de notificación" className={inputCls} />
                  <div className="grid grid-cols-2 gap-2">
                    <input name="email" placeholder="Email" className={inputCls} />
                    <input name="phone" placeholder="Teléfono" className={inputCls} />
                  </div>
                  <button className={`${btnSecondaryCls} w-full`}>Agregar</button>
                </form>
              </details>
            </Card>

            <Card title="Pagos">
              <ul className="space-y-1 text-sm">
                {c.pagos.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span className="text-slate-600">
                      {formatFecha(p.fecha)} {p.medio ? <span className="text-xs text-slate-400">· {p.medio}</span> : null}
                    </span>
                    <span>{formatARS(Number(p.monto))}</span>
                  </li>
                ))}
                {c.pagos.length === 0 ? <li className="text-slate-500">Sin pagos.</li> : null}
              </ul>
              <form action={registrarPago.bind(null, id)} className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <input type="date" name="fecha" defaultValue={hoyISO()} required className={inputCls} />
                <input name="monto" type="number" step="0.01" min="0.01" required placeholder="Monto" className={inputCls} />
                <input name="medio" placeholder="Medio (transferencia…)" className={`${inputCls} col-span-2`} />
                <button className={`${btnSecondaryCls} col-span-2`}>Registrar pago</button>
              </form>
              <p className="mt-2 text-[11px] text-slate-400">Se imputa a intereses y luego a capital, desde el período más antiguo (art. 903).</p>
            </Card>

            <Card title="Plan de pago">
              {plan ? (
                <div className="space-y-2 text-sm">
                  <div className="text-slate-600">
                    Acordado el {formatFecha(plan.fechaAcuerdo)}: {formatARS(Number(plan.montoTotal))} en {plan.cantidadCuotas} cuota(s)
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {plan.cuotas.map((q) => {
                      const vencida = !q.pagadaAt && q.fechaVencimiento < hoyUTC();
                      return (
                        <li key={q.id} className="flex items-center justify-between py-1.5">
                          <span className={vencida ? "text-red-700" : ""}>
                            #{q.numero} · {formatFecha(q.fechaVencimiento)} · {formatARS(Number(q.monto))}
                          </span>
                          {q.pagadaAt ? (
                            <span className="text-xs text-emerald-700">Pagada {formatFecha(q.pagadaAt)}</span>
                          ) : (
                            <form action={marcarCuotaPagada.bind(null, q.id)} className="flex items-center gap-1">
                              <input type="hidden" name="fecha" value={hoyISO()} />
                              <button className="text-xs text-[#375A7F] hover:underline">Marcar pagada hoy</button>
                            </form>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Sin plan vigente.</p>
              )}
              {TRANSICIONES[c.estado].includes("PLAN_DE_PAGO") || c.estado === "PLAN_DE_PAGO" ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-[#375A7F]">{plan ? "Reemplazar plan" : "Acordar plan de pago"}</summary>
                  <form action={crearPlanPago.bind(null, id)} className="mt-2 space-y-2">
                    <Field label="Fecha del acuerdo">
                      <input type="date" name="fechaAcuerdo" defaultValue={hoyISO()} required className={inputCls} />
                    </Field>
                    <Field label="Monto total convenido" hint={`Liquidación a hoy: ${formatARS(l.total)}`}>
                      <input name="montoTotal" type="number" step="0.01" min="0.01" defaultValue={l.total.toFixed(2)} required className={inputCls} />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Cuotas">
                        <input name="cantidadCuotas" type="number" min="1" max="120" defaultValue="6" required className={inputCls} />
                      </Field>
                      <Field label="1er vencimiento">
                        <input type="date" name="primerVencimiento" required className={inputCls} />
                      </Field>
                    </div>
                    <input name="notes" placeholder="Condiciones (caducidad, quita, etc.)" className={inputCls} />
                    <button className={`${btnSecondaryCls} w-full`}>Guardar plan</button>
                  </form>
                </details>
              ) : null}
            </Card>

            <Card title="Datos judiciales y asignación">
              <form action={asignarAbogado.bind(null, id)} className="mb-4 flex gap-2">
                <select name="asignadoAId" defaultValue={c.asignadoAId ?? ""} className={inputCls}>
                  <option value="">Sin asignar</option>
                  {abogados.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <button className={btnSecondaryCls}>Asignar</button>
              </form>
              <form action={actualizarDatosJudiciales.bind(null, id)} className="space-y-2">
                <Field label="Nº de expediente">
                  <input name="expedienteNumber" defaultValue={c.expedienteNumber ?? ""} className={inputCls} />
                </Field>
                <Field label="Juzgado">
                  <input name="juzgado" defaultValue={c.juzgado ?? ""} className={inputCls} />
                </Field>
                <Field label="Fecha de interposición de la demanda" hint="Interrumpe la prescripción (art. 2546)">
                  <input
                    type="date"
                    name="fechaInicioJuicio"
                    defaultValue={c.fechaInicioJuicio ? c.fechaInicioJuicio.toISOString().slice(0, 10) : ""}
                    className={inputCls}
                  />
                </Field>
                <Field label="Notas internas">
                  <textarea name="notes" rows={3} defaultValue={c.notes ?? ""} className={inputCls} />
                </Field>
                <button className={`${btnSecondaryCls} w-full`}>Guardar</button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </TicketsLayout>
  );
}

function Stat({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${warn ? "border-amber-300" : "border-slate-200"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg ${strong ? "font-bold" : "font-semibold"} ${warn ? "text-amber-700" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

const DATA_LABEL: Record<string, string> = {
  nroCartaDocumento: "CD nº",
  fechaRecepcion: "Recibida",
  capital: "Capital",
  intereses: "Intereses",
  total: "Total",
  totalExigible: "Exigible",
  expedienteNumber: "Expte.",
  juzgado: "Juzgado",
};

function EventoData({ data }: { data: Record<string, unknown> }) {
  const items = Object.entries(data).map(([k, v]) => {
    const val = typeof v === "number" ? formatARS(v) : String(v);
    return `${DATA_LABEL[k] ?? k}: ${val}`;
  });
  return <div className="text-[11px] text-slate-500">{items.join(" · ")}</div>;
}
