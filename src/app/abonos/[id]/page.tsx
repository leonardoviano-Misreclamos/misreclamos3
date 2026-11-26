import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TicketsLayout } from "@/components/tickets/TicketsLayout";
import { AbonosNav, Kpi, StatePill } from "@/components/abonos/AbonosNav";
import { InstallmentActions, PhoneManager, QuotaToggle, SubscriptionStatusActions } from "@/components/abonos/forms";
import {
  consortiumTypeLabels,
  daysOverdue,
  ensureInstallments,
  formatARS,
  installmentState,
  periodLabel,
  periodOf,
  periodRange,
  quotaSummary,
} from "@/lib/abonos";
import { statusLabels } from "@/lib/tickets";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "—";

export default async function AbonoDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { periodo } = await searchParams;
  const now = new Date();

  const base = await prisma.subscription.findUnique({ where: { id } });
  if (!base) notFound();
  await ensureInstallments(base, now);

  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: {
      plan: true,
      consorcio: { include: { administradora: { select: { razonSocial: true } }, customers: { select: { id: true, phone: true, name: true }, orderBy: { createdAt: "asc" } } } },
      installments: { orderBy: { period: "desc" } },
    },
  });
  if (!sub) notFound();

  const period = periodo && /^\d{4}-\d{2}$/.test(periodo) ? periodo : periodOf(now);
  const { from, to } = periodRange(period);
  const tickets = await prisma.ticket.findMany({
    where: { subscriptionId: id, createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, title: true, status: true, createdAt: true, legalType: true, countsAgainstQuota: true, contactName: true },
  });
  const q = quotaSummary(tickets.filter((t) => t.countsAgainstQuota).length, sub.includedQueries);
  const overdue = sub.installments.filter((i) => installmentState(i, now) === "OVERDUE");
  const debt = overdue.reduce((a, i) => a + Number(i.amount), 0);
  const periods = Array.from(new Set([periodOf(now), ...sub.installments.map((i) => i.period)])).sort().reverse();
  const c = sub.consorcio;

  return (
    <TicketsLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/abonos" className="text-sm text-slate-500 hover:text-slate-700">← Abonos</Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{c.nombre}</h1>
            <StatePill state={sub.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {consortiumTypeLabels[c.tipo]}
            {c.cuit ? ` · CUIT ${c.cuit}` : ""}
            {c.administradora ? ` · Adm. ${c.administradora.razonSocial}` : ""}
            {c.cantidadUnidades ? ` · ${c.cantidadUnidades} UF/lotes` : ""}
            {c.domicilio ? ` · ${[c.domicilio, c.localidad].filter(Boolean).join(", ")}` : ""}
            {` · ${c.jurisdiccion}`}
          </p>
        </div>
        <AbonosNav active="" />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Plan" value={sub.plan.name} hint={`${formatARS(sub.monthlyFee)} / mes · vence día ${sub.dueDay}`} />
          <Kpi
            label={`Consultas ${periodLabel(period)}`}
            value={q.label}
            hint={q.overage ? `+${q.overage} excedente(s) · ${formatARS(Number(sub.overageFee ?? 0) * q.overage)}` : q.remaining != null ? `${q.remaining} disponible(s)` : undefined}
            tone={q.overage ? "red" : undefined}
          />
          <Kpi label="Deuda vencida" value={formatARS(debt)} hint={`${overdue.length} cuota(s)`} tone={debt ? "red" : "green"} />
          <Kpi label="Vigencia" value={fmtDate(sub.startDate)} hint={sub.endDate ? `hasta ${fmtDate(sub.endDate)}` : "sin plazo"} />
        </div>

        <SubscriptionStatusActions id={sub.id} status={sub.status} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <h2 className="px-4 pt-4 text-base font-semibold text-slate-900">Cuotas</h2>
              <table className="mt-2 min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Período</th>
                    <th className="px-4 py-2">Importe</th>
                    <th className="px-4 py-2">Vence</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2">Pago</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sub.installments.map((i) => {
                    const st = installmentState(i, now);
                    return (
                      <tr key={i.id} className="align-top">
                        <td className="px-4 py-2 font-medium">{periodLabel(i.period)}</td>
                        <td className="px-4 py-2">{formatARS(i.amount)}</td>
                        <td className="px-4 py-2">
                          {fmtDate(i.dueDate)}
                          {st === "OVERDUE" ? <div className="text-xs text-red-700">{daysOverdue(i, now)} días</div> : null}
                        </td>
                        <td className="px-4 py-2"><StatePill state={st} /></td>
                        <td className="px-4 py-2 text-xs text-slate-600">
                          {i.status === "PAID" ? (
                            <>
                              {fmtDate(i.paidAt)} · {formatARS(i.paidAmount)}
                              <div>{[i.paymentMethod, i.paymentRef, i.invoiceNumber && `Fact. ${i.invoiceNumber}`].filter(Boolean).join(" · ")}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <InstallmentActions id={i.id} status={i.status} amount={i.amount.toString()} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">Consultas por WhatsApp</h2>
                <div className="flex flex-wrap gap-1">
                  {periods.slice(0, 6).map((p) => (
                    <Link
                      key={p}
                      href={`/abonos/${sub.id}?periodo=${p}`}
                      className={`rounded-md px-2 py-0.5 text-xs ${p === period ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      {periodLabel(p)}
                    </Link>
                  ))}
                </div>
              </div>
              {tickets.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Sin consultas en {periodLabel(period)}.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {tickets.map((t) => (
                    <li key={t.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${t.countsAgainstQuota ? "" : "opacity-60"}`}>
                      <div className="min-w-0">
                        <Link href={`/tickets/${t.id}`} className="font-medium text-indigo-700 hover:underline">#{t.code}</Link>
                        <span className="ml-2 text-slate-800">{t.title}</span>
                        <div className="text-xs text-slate-500">
                          {fmtDate(t.createdAt)} · {t.contactName} · {t.legalType ?? "Sin caso"} · {statusLabels[t.status]}
                          {t.countsAgainstQuota ? "" : " · no descuenta cupo"}
                        </div>
                      </div>
                      <span className="text-xs text-slate-500"><QuotaToggle ticketId={t.id} counts={t.countsAgainstQuota} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-1 text-base font-semibold text-slate-900">Teléfonos autorizados</h2>
              <p className="mb-3 text-xs text-slate-500">Las consultas nuevas que entren por WhatsApp desde estos números se imputan a este abono.</p>
              <PhoneManager consorcioId={c.id} phones={c.customers} />
            </section>
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 text-sm">
              <h2 className="mb-2 text-base font-semibold text-slate-900">Contacto</h2>
              <div className="text-slate-700">{c.contactoNombre ?? "—"}</div>
              <div className="text-slate-500">{c.contactoEmail ?? ""}</div>
              {c.notes ? <p className="mt-2 whitespace-pre-line text-slate-600">{c.notes}</p> : null}
              {sub.plan.description ? (
                <>
                  <h3 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-500">Incluye</h3>
                  <p className="whitespace-pre-line text-slate-600">{sub.plan.description}</p>
                </>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </TicketsLayout>
  );
}
