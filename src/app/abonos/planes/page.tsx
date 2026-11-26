import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TicketsLayout } from "@/components/tickets/TicketsLayout";
import { AbonosNav } from "@/components/abonos/AbonosNav";
import { CreatePlanForm, PlanActiveToggle } from "@/components/abonos/forms";
import { formatARS } from "@/lib/abonos";

export const dynamic = "force-dynamic";

export default async function PlanesPage() {
  await requireAdmin();
  const plans = await prisma.advisoryPlan.findMany({
    orderBy: [{ active: "desc" }, { monthlyFee: "asc" }],
    include: { _count: { select: { subscriptions: { where: { status: { in: ["ACTIVE", "SUSPENDED"] } } } } } },
  });

  return (
    <TicketsLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Abonos de asesoramiento</h1>
          <p className="mt-1 text-sm text-slate-500">Catálogo de planes. Cambiar un plan no modifica los abonos ya contratados.</p>
        </div>
        <AbonosNav active="/abonos/planes" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <CreatePlanForm />
          </div>
          <div className="lg:col-span-2 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Plan</th>
                  <th className="px-4 py-2">Mensual</th>
                  <th className="px-4 py-2">Consultas/mes</th>
                  <th className="px-4 py-2">Adicional</th>
                  <th className="px-4 py-2">Abonos vigentes</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Todavía no hay planes.</td></tr>
                ) : null}
                {plans.map((p) => (
                  <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      {p.description ? <div className="text-xs text-slate-500 whitespace-pre-line">{p.description}</div> : null}
                    </td>
                    <td className="px-4 py-2">{formatARS(p.monthlyFee)}</td>
                    <td className="px-4 py-2">{p.includedQueries ?? "Ilimitadas"}</td>
                    <td className="px-4 py-2">{formatARS(p.overageFee)}</td>
                    <td className="px-4 py-2">{p._count.subscriptions}</td>
                    <td className="px-4 py-2 text-right"><PlanActiveToggle id={p.id} active={p.active} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </TicketsLayout>
  );
}
