import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TicketsLayout } from "@/components/tickets/TicketsLayout";
import { AbonosNav, StatePill } from "@/components/abonos/AbonosNav";
import { CreateConsortiumForm } from "@/components/abonos/forms";
import { consortiumTypeLabels } from "@/lib/abonos";

export const dynamic = "force-dynamic";

export default async function ConsorciosPage() {
  await requireAdmin();
  const consortia = await prisma.consorcio.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { customers: true } },
      administradora: { select: { razonSocial: true } },
      subscriptions: {
        where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
        include: { plan: { select: { name: true } } },
        take: 1,
      },
    },
  });

  const administradoras = await prisma.administradora.findMany({
    select: { id: true, razonSocial: true },
    orderBy: { razonSocial: "asc" },
  });

  return (
    <TicketsLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Abonos de asesoramiento</h1>
          <p className="mt-1 text-sm text-slate-500">Consorcios, barrios cerrados y countries clientes, con sus teléfonos autorizados.</p>
        </div>
        <AbonosNav active="/abonos/consorcios" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <CreateConsortiumForm administradoras={administradoras} />
          </div>
          <div className="lg:col-span-2 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Consorcio</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Administradora</th>
                  <th className="px-4 py-2">Teléfonos</th>
                  <th className="px-4 py-2">Abono</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {consortia.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Todavía no hay consorcios.</td></tr>
                ) : null}
                {consortia.map((c) => {
                  const sub = c.subscriptions[0];
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-slate-900">{c.nombre}</div>
                        <div className="text-xs text-slate-500">{[c.domicilio, c.localidad].filter(Boolean).join(", ")}{c.cuit ? ` · CUIT ${c.cuit}` : ""}</div>
                      </td>
                      <td className="px-4 py-2">{consortiumTypeLabels[c.tipo]}</td>
                      <td className="px-4 py-2">{c.administradora?.razonSocial ?? "—"}</td>
                      <td className="px-4 py-2">{c._count.customers}</td>
                      <td className="px-4 py-2">
                        {sub ? (
                          <Link href={`/abonos/${sub.id}`} className="inline-flex items-center gap-2 text-indigo-700 hover:underline">
                            {sub.plan.name} <StatePill state={sub.status} />
                          </Link>
                        ) : (
                          <Link href={`/abonos?consorcio=${c.id}`} className="text-xs text-indigo-700 hover:underline">Contratar abono</Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </TicketsLayout>
  );
}
