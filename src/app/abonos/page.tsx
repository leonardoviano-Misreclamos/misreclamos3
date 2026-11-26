import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TicketsLayout } from "@/components/tickets/TicketsLayout";
import { AbonosNav, Kpi, StatePill } from "@/components/abonos/AbonosNav";
import { CreateSubscriptionForm } from "@/components/abonos/forms";
import {
  daysOverdue,
  ensureAllInstallments,
  formatARS,
  installmentState,
  periodLabel,
  periodOf,
  periodRange,
  quotaSummary,
} from "@/lib/abonos";

export const dynamic = "force-dynamic";

export default async function AbonosPage({ searchParams }: { searchParams: Promise<{ consorcio?: string }> }) {
  await requireAdmin();
  const { consorcio } = await searchParams;
  const now = new Date();
  await ensureAllInstallments(now);

  const period = periodOf(now);
  const { from, to } = periodRange(period);
  const in15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  const [subs, overdue, upcoming, paidThisMonth, consortia, plans, usage] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
      include: {
        consortium: { select: { id: true, name: true } },
        plan: { select: { name: true } },
        installments: { where: { period } },
      },
      orderBy: { consortium: { name: "asc" } },
    }),
    prisma.installment.findMany({
      where: { status: "PENDING", dueDate: { lt: now } },
      include: { subscription: { include: { consortium: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.installment.findMany({
      where: { status: "PENDING", dueDate: { gte: now, lte: in15 } },
      include: { subscription: { include: { consortium: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.installment.aggregate({
      where: { status: "PAID", paidAt: { gte: from, lt: to } },
      _sum: { paidAmount: true },
    }),
    prisma.consortium.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.advisoryPlan.findMany({ where: { active: true }, orderBy: { monthlyFee: "asc" } }),
    prisma.ticket.groupBy({
      by: ["subscriptionId"],
      where: { subscriptionId: { not: null }, countsAgainstQuota: true, createdAt: { gte: from, lt: to } },
      _count: { _all: true },
    }),
  ]);

  const usageMap = new Map(usage.map((u) => [u.subscriptionId, u._count._all]));
  const overdueBySub = new Map<string, number>();
  for (const o of overdue) overdueBySub.set(o.subscriptionId, (overdueBySub.get(o.subscriptionId) ?? 0) + Number(o.amount));
  const overdueTotal = overdue.reduce((a, o) => a + Number(o.amount), 0);
  const mrr = subs.filter((s) => s.status === "ACTIVE").reduce((a, s) => a + Number(s.monthlyFee), 0);
  const queriesThisMonth = usage.reduce((a, u) => a + u._count._all, 0);

  return (
    <TicketsLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Abonos de asesoramiento</h1>
          <p className="mt-1 text-sm text-slate-500">
            Abonos vigentes, consultas del mes ({periodLabel(period)}) y control de vencimientos y pagos.
          </p>
        </div>
        <AbonosNav active="/abonos" />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Abonos vigentes" value={String(subs.length)} hint={`${formatARS(mrr)} / mes (activos)`} />
          <Kpi label="Cobrado este mes" value={formatARS(Number(paidThisMonth._sum.paidAmount ?? 0))} tone="green" />
          <Kpi label="Deuda vencida" value={formatARS(overdueTotal)} hint={`${overdue.length} cuota(s)`} tone={overdue.length ? "red" : undefined} />
          <Kpi label="Consultas del mes" value={String(queriesThisMonth)} hint="por WhatsApp, imputadas a abonos" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <h2 className="px-4 pt-4 text-base font-semibold text-slate-900">Abonos vigentes</h2>
              <table className="mt-2 min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Consorcio</th>
                    <th className="px-4 py-2">Plan</th>
                    <th className="px-4 py-2">Consultas mes</th>
                    <th className="px-4 py-2">Cuota {periodLabel(period)}</th>
                    <th className="px-4 py-2">Deuda vencida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subs.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Todavía no hay abonos contratados.</td></tr>
                  ) : null}
                  {subs.map((s) => {
                    const q = quotaSummary(usageMap.get(s.id) ?? 0, s.includedQueries);
                    const inst = s.installments[0];
                    const debt = overdueBySub.get(s.id) ?? 0;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <Link href={`/abonos/${s.id}`} className="font-medium text-indigo-700 hover:underline">{s.consortium.name}</Link>
                          {s.status !== "ACTIVE" ? <span className="ml-2"><StatePill state={s.status} /></span> : null}
                        </td>
                        <td className="px-4 py-2">{s.plan.name}<div className="text-xs text-slate-500">{formatARS(s.monthlyFee)}</div></td>
                        <td className="px-4 py-2">
                          <span className={q.overage ? "font-semibold text-red-700" : ""}>{q.label}</span>
                          {q.overage ? <div className="text-xs text-red-700">+{q.overage} excedente(s)</div> : null}
                        </td>
                        <td className="px-4 py-2">{inst ? <StatePill state={installmentState(inst, now)} /> : "—"}</td>
                        <td className={`px-4 py-2 ${debt ? "font-semibold text-red-700" : "text-slate-400"}`}>{debt ? formatARS(debt) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Cuotas vencidas impagas</h2>
              {overdue.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No hay cuotas vencidas.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {overdue.map((o) => (
                    <li key={o.id} className="flex items-center justify-between py-2">
                      <Link href={`/abonos/${o.subscriptionId}`} className="text-indigo-700 hover:underline">
                        {o.subscription.consortium.name} · {periodLabel(o.period)}
                      </Link>
                      <span className="text-red-700">
                        {formatARS(o.amount)} · {daysOverdue(o, now)} días
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Vencen en los próximos 15 días</h2>
              {upcoming.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Nada por vencer.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {upcoming.map((o) => (
                    <li key={o.id} className="flex items-center justify-between py-2">
                      <Link href={`/abonos/${o.subscriptionId}`} className="text-indigo-700 hover:underline">
                        {o.subscription.consortium.name} · {periodLabel(o.period)}
                      </Link>
                      <span className="text-slate-700">
                        {formatARS(o.amount)} · {o.dueDate.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="lg:col-span-1">
            <CreateSubscriptionForm
              consortia={consortia}
              plans={plans.map((p) => ({ id: p.id, name: p.name, monthlyFee: p.monthlyFee.toString(), includedQueries: p.includedQueries }))}
              defaultConsortiumId={consorcio}
            />
          </div>
        </div>
      </div>
    </TicketsLayout>
  );
}
