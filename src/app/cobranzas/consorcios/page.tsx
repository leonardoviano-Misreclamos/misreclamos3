import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { TicketsLayout } from "@/components/tickets/TicketsLayout";
import { Card, Field, SubNav, inputCls, btnCls } from "@/components/cobranzas/ui";
import { ConsorcioFields } from "@/components/cobranzas/ConsorcioFields";
import { requireCobranzasAccess } from "@/lib/expensas/data";
import { TIPO_CONSORCIO_LABEL } from "@/lib/expensas/estados";
import { crearAdministradora, crearConsorcio } from "../actions";

export const dynamic = "force-dynamic";

export default async function ConsorciosPage() {
  const session = await requireCobranzasAccess();
  const admin = isAdmin(session.user);

  const [consorcios, administradoras] = await Promise.all([
    prisma.consorcio.findMany({
      include: {
        administradora: true,
        _count: { select: { unidades: true, cobranzas: { where: { estado: { notIn: ["CANCELADA", "ARCHIVADA"] } } } } },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.administradora.findMany({ orderBy: { razonSocial: "asc" }, include: { _count: { select: { consorcios: true } } } }),
  ]);

  return (
    <TicketsLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Consorcios y barrios</h1>
            <p className="mt-1 text-sm text-slate-500">Clientes del servicio de cobranza y asesoramiento</p>
          </div>
          <SubNav active="consorcios" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title={`Consorcios (${consorcios.length})`}>
              {consorcios.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Todavía no cargaste ningún consorcio.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-2 pr-3">Nombre</th>
                        <th className="py-2 pr-3">Tipo</th>
                        <th className="py-2 pr-3">Administradora</th>
                        <th className="py-2 pr-3 text-right">Unidades</th>
                        <th className="py-2 text-right">Cobranzas activas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {consorcios.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-2 pr-3">
                            <Link href={`/cobranzas/consorcios/${c.id}`} className="font-medium text-[#375A7F] hover:underline">
                              {c.nombre}
                            </Link>
                            <div className="text-xs text-slate-400">
                              {[c.localidad, c.jurisdiccion].filter(Boolean).join(" · ")}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-xs">{TIPO_CONSORCIO_LABEL[c.tipo]}</td>
                          <td className="py-2 pr-3 text-xs">{c.administradora?.razonSocial ?? "—"}</td>
                          <td className="py-2 pr-3 text-right">{c._count.unidades}</td>
                          <td className="py-2 text-right">{c._count.cobranzas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title={`Administradoras (${administradoras.length})`}>
              {administradoras.length === 0 ? (
                <p className="text-sm text-slate-500">Sin administradoras cargadas.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {administradoras.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2">
                      <div>
                        <div className="font-medium text-slate-800">{a.razonSocial}</div>
                        <div className="text-xs text-slate-500">
                          {[a.cuit && `CUIT ${a.cuit}`, a.matricula && `Mat. ${a.matricula}`, a.contacto, a.email, a.phone]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">{a._count.consorcios} consorcio(s)</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {admin ? (
            <div className="space-y-6">
              <Card title="Nuevo consorcio / barrio">
                <form action={crearConsorcio} className="space-y-4">
                  <ConsorcioFields administradoras={administradoras} />
                  <button className={`${btnCls} w-full`}>Crear</button>
                </form>
              </Card>
              <Card title="Nueva administradora">
                <form action={crearAdministradora} className="space-y-3">
                  <Field label="Razón social *">
                    <input name="razonSocial" required className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CUIT">
                      <input name="cuit" className={inputCls} />
                    </Field>
                    <Field label="Matrícula RPA">
                      <input name="matricula" className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Contacto">
                    <input name="contacto" className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Email">
                      <input name="email" type="email" className={inputCls} />
                    </Field>
                    <Field label="Teléfono">
                      <input name="phone" className={inputCls} />
                    </Field>
                  </div>
                  <button className={`${btnCls} w-full`}>Agregar</button>
                </form>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </TicketsLayout>
  );
}
