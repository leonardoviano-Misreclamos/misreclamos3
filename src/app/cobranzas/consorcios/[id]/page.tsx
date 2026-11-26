import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { TicketsLayout } from "@/components/tickets/TicketsLayout";
import { Card, Field, EstadoBadge, SubNav, inputCls, btnCls, btnSecondaryCls } from "@/components/cobranzas/ui";
import { ConsorcioFields } from "@/components/cobranzas/ConsorcioFields";
import { requireCobranzasAccess, liquidarCobranza } from "@/lib/expensas/data";
import { TIPO_CONSORCIO_LABEL, ROL_DEUDOR_LABEL } from "@/lib/expensas/estados";
import { formatARS } from "@/lib/expensas/liquidacion";
import { actualizarConsorcio, crearUnidad, cargarDeuda, abrirCobranza } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ConsorcioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCobranzasAccess();
  const admin = isAdmin(session.user);
  const { id } = await params;

  const [consorcio, administradoras] = await Promise.all([
    prisma.consorcio.findUnique({
      where: { id },
      include: {
        administradora: true,
        unidades: {
          orderBy: { identificacion: "asc" },
          include: {
            deudores: { include: { deudor: true } },
            deudas: true,
            cobranzas: {
              where: { estado: { notIn: ["CANCELADA", "ARCHIVADA"] } },
              include: { pagos: true, eventos: { select: { estadoHasta: true, fecha: true } } },
            },
          },
        },
      },
    }),
    prisma.administradora.findMany({ orderBy: { razonSocial: "asc" } }),
  ]);
  if (!consorcio) notFound();

  const path = `/cobranzas/consorcios/${id}`;
  const unidades = consorcio.unidades.map((u) => {
    const cob = u.cobranzas[0];
    const l = liquidarCobranza({
      consorcio,
      unidad: u,
      pagos: cob?.pagos ?? [],
      eventos: cob?.eventos ?? [],
      fechaInicioJuicio: cob?.fechaInicioJuicio ?? null,
    });
    return { u, cob, l };
  });
  const totalDeuda = unidades.reduce((s, x) => s + x.l.total, 0);

  return (
    <TicketsLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/cobranzas/consorcios" className="text-xs text-slate-500 hover:underline">
              ← Consorcios
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">{consorcio.nombre}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {TIPO_CONSORCIO_LABEL[consorcio.tipo]} · {consorcio.jurisdiccion}
              {consorcio.administradora ? ` · Adm. ${consorcio.administradora.razonSocial}` : ""} · Interés{" "}
              {Number(consorcio.tasaMoratoriaAnual) + Number(consorcio.tasaPunitoriaAnual)}% TNA · Deuda total hoy{" "}
              <strong>{formatARS(totalDeuda)}</strong>
            </p>
          </div>
          <SubNav active="consorcios" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title={`Unidades (${unidades.length})`}>
              {unidades.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Cargá la primera unidad funcional o lote.</p>
              ) : (
                <div className="space-y-4">
                  {unidades.map(({ u, cob, l }) => (
                    <div key={u.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{u.identificacion}</div>
                          <div className="text-xs text-slate-500">
                            {u.deudores.length
                              ? u.deudores.map((d) => `${d.deudor.nombre} (${ROL_DEUDOR_LABEL[d.rol]})`).join(", ")
                              : "Sin deudor cargado"}
                            {u.porcentual ? ` · ${Number(u.porcentual)}%` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{formatARS(l.total)}</div>
                          <div className="text-[11px] text-slate-500">
                            {l.periodos.filter((p) => p.total > 0).length} período(s) · capital {formatARS(l.totalCapital)}
                          </div>
                          {l.periodosPrescriptos + l.periodosProximosAPrescribir > 0 ? (
                            <div className="text-[11px] text-amber-700">Alerta de prescripción</div>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {cob ? (
                          <Link href={`/cobranzas/${cob.id}`} className={btnSecondaryCls}>
                            Ver expediente {cob.code} <span className="ml-2"><EstadoBadge estado={cob.estado} /></span>
                          </Link>
                        ) : (
                          <form action={abrirCobranza.bind(null, u.id)}>
                            <button className={btnSecondaryCls} disabled={l.total <= 0}>
                              Abrir cobranza
                            </button>
                          </form>
                        )}
                        <details className="w-full">
                          <summary className="cursor-pointer text-xs text-[#375A7F]">Cargar deuda</summary>
                          <form action={cargarDeuda.bind(null, u.id, path)} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Nueva unidad / lote">
              <form action={crearUnidad.bind(null, id)} className="space-y-3">
                <Field label="Identificación *">
                  <input name="identificacion" required placeholder="UF 12 - 3° B / Lote 145" className={inputCls} />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Porcentual">
                    <input name="porcentual" className={inputCls} />
                  </Field>
                  <Field label="Matrícula">
                    <input name="matricula" className={inputCls} />
                  </Field>
                  <Field label="Partida">
                    <input name="partida" className={inputCls} />
                  </Field>
                </div>
                <div className="border-t border-slate-100 pt-3 text-xs font-medium text-slate-500">Deudor (opcional)</div>
                <Field label="Nombre">
                  <input name="deudorNombre" className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="DNI / CUIT">
                    <input name="deudorDocumento" className={inputCls} />
                  </Field>
                  <Field label="Rol (art. 2050)">
                    <select name="deudorRol" className={inputCls}>
                      {Object.entries(ROL_DEUDOR_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Domicilio de notificación">
                  <input name="deudorDomicilio" className={inputCls} />
                </Field>
                <button className={`${btnCls} w-full`}>Agregar unidad</button>
              </form>
            </Card>

            {admin ? (
              <Card title="Datos del consorcio">
                <form action={actualizarConsorcio.bind(null, id)} className="space-y-4">
                  <ConsorcioFields
                    administradoras={administradoras}
                    d={{
                      ...consorcio,
                      tasaMoratoriaAnual: String(consorcio.tasaMoratoriaAnual),
                      tasaPunitoriaAnual: String(consorcio.tasaPunitoriaAnual),
                      abonoMensual: consorcio.abonoMensual != null ? String(consorcio.abonoMensual) : null,
                      honorariosExtrajudicialesPct:
                        consorcio.honorariosExtrajudicialesPct != null ? String(consorcio.honorariosExtrajudicialesPct) : null,
                    }}
                  />
                  <button className={`${btnCls} w-full`}>Guardar cambios</button>
                </form>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </TicketsLayout>
  );
}
