import Link from "next/link";
import type { EstadoCobranza, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { TicketsLayout } from "@/components/tickets/TicketsLayout";
import { Card, EstadoBadge, SubNav, inputCls, btnCls } from "@/components/cobranzas/ui";
import { requireCobranzasAccess, liquidarCobranza } from "@/lib/expensas/data";
import { ESTADO_LABEL, ESTADOS_ACTIVOS } from "@/lib/expensas/estados";
import { formatARS } from "@/lib/expensas/liquidacion";

export const dynamic = "force-dynamic";

export default async function CobranzasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; consorcio?: string; q?: string }>;
}) {
  await requireCobranzasAccess();
  const sp = await searchParams;

  const where: Prisma.CobranzaExpensasWhereInput = {};
  if (sp.estado && sp.estado in ESTADO_LABEL) where.estado = sp.estado as EstadoCobranza;
  else if (sp.estado !== "todos") where.estado = { in: ESTADOS_ACTIVOS };
  if (sp.consorcio) where.consorcioId = sp.consorcio;
  if (sp.q) {
    where.OR = [
      { code: { contains: sp.q, mode: "insensitive" } },
      { unidad: { identificacion: { contains: sp.q, mode: "insensitive" } } },
      { unidad: { deudores: { some: { deudor: { nombre: { contains: sp.q, mode: "insensitive" } } } } } },
    ];
  }

  const [cobranzas, consorcios, porEstado] = await Promise.all([
    prisma.cobranzaExpensas.findMany({
      where,
      include: {
        consorcio: true,
        unidad: { include: { deudas: true, deudores: { include: { deudor: true } } } },
        pagos: true,
        eventos: { select: { estadoHasta: true, fecha: true } },
        asignadoA: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.consorcio.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.cobranzaExpensas.groupBy({ by: ["estado"], _count: true }),
  ]);

  const filas = cobranzas.map((c) => ({ c, l: liquidarCobranza(c) }));
  const totalCartera = filas.reduce((s, f) => s + f.l.total, 0);
  const alertas = filas.filter((f) => f.l.periodosPrescriptos + f.l.periodosProximosAPrescribir > 0).length;
  const countOf = (e: EstadoCobranza) => porEstado.find((p) => p.estado === e)?._count ?? 0;

  return (
    <TicketsLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Cobranza de expensas</h1>
            <p className="mt-1 text-sm text-slate-500">Expedientes de cobro por unidad funcional o lote</p>
          </div>
          <SubNav active="cobranzas" />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Expedientes listados" value={String(filas.length)} />
          <Stat label="Deuda liquidada (hoy)" value={formatARS(totalCartera)} />
          <Stat label="En ejecución" value={String(countOf("EJECUCION"))} />
          <Stat label="Con alerta de prescripción" value={String(alertas)} warn={alertas > 0} />
        </div>

        <Card>
          <form className="mb-4 flex flex-wrap items-end gap-3">
            <input name="q" defaultValue={sp.q} placeholder="Buscar por código, UF o deudor" className={`${inputCls} max-w-xs`} />
            <select name="estado" defaultValue={sp.estado ?? ""} className={`${inputCls} max-w-[220px]`}>
              <option value="">Activos</option>
              <option value="todos">Todos</option>
              {Object.entries(ESTADO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v} ({countOf(k as EstadoCobranza)})
                </option>
              ))}
            </select>
            <select name="consorcio" defaultValue={sp.consorcio ?? ""} className={`${inputCls} max-w-[240px]`}>
              <option value="">Todos los consorcios</option>
              {consorcios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <button className={btnCls}>Filtrar</button>
          </form>

          {filas.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No hay expedientes. Cargá un consorcio, sus unidades y la deuda, y abrí la cobranza desde la unidad.{" "}
              <Link href="/cobranzas/consorcios" className="text-[#375A7F] underline">
                Ir a consorcios
              </Link>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Consorcio</th>
                    <th className="py-2 pr-3">Unidad</th>
                    <th className="py-2 pr-3">Deudor</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 pr-3 text-right">Períodos</th>
                    <th className="py-2 pr-3 text-right">Total hoy</th>
                    <th className="py-2 pr-3">Prescripción</th>
                    <th className="py-2">Abogado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.map(({ c, l }) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2 pr-3 font-mono text-xs">
                        <Link href={`/cobranzas/${c.id}`} className="text-[#375A7F] hover:underline">
                          {c.code}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{c.consorcio.nombre}</td>
                      <td className="py-2 pr-3">{c.unidad.identificacion}</td>
                      <td className="py-2 pr-3">{c.unidad.deudores.map((d) => d.deudor.nombre).join(", ") || "—"}</td>
                      <td className="py-2 pr-3">
                        <EstadoBadge estado={c.estado} />
                      </td>
                      <td className="py-2 pr-3 text-right">{l.periodos.filter((p) => p.total > 0).length}</td>
                      <td className="py-2 pr-3 text-right font-medium">{formatARS(l.total)}</td>
                      <td className="py-2 pr-3 text-xs">
                        {l.periodosPrescriptos > 0 ? <span className="text-red-700">{l.periodosPrescriptos} prescripto(s)</span> : null}
                        {l.periodosProximosAPrescribir > 0 ? (
                          <span className="ml-1 text-amber-700">{l.periodosProximosAPrescribir} por prescribir</span>
                        ) : null}
                        {l.periodosPrescriptos + l.periodosProximosAPrescribir === 0 ? <span className="text-slate-400">OK</span> : null}
                      </td>
                      <td className="py-2 text-xs text-slate-600">{c.asignadoA?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </TicketsLayout>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${warn ? "border-amber-300" : "border-slate-200"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${warn ? "text-amber-700" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}
