import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { liquidar, type Liquidacion } from "./liquidacion";

/** Cobranzas: administradores y abogados del estudio. Corresponsales, no (por ahora). */
export async function requireCobranzasAccess() {
  const session = await requireSession();
  if (session.user!.role === "CORRESPONDENT") redirect("/tickets");
  return session;
}

/** Fecha de hoy como medianoche UTC (las fechas de deuda se guardan como DATE). */
export function hoyUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export async function cargarCobranza(id: string) {
  return prisma.cobranzaExpensas.findUnique({
    where: { id },
    include: {
      consorcio: { include: { administradora: true } },
      unidad: {
        include: {
          deudores: { include: { deudor: true } },
          deudas: { orderBy: { periodo: "asc" } },
        },
      },
      asignadoA: true,
      eventos: { orderBy: [{ fecha: "desc" }, { createdAt: "desc" }] },
      pagos: { orderBy: { fecha: "asc" } },
      planes: { include: { cuotas: { orderBy: { numero: "asc" } } }, orderBy: { createdAt: "desc" } },
    },
  });
}

export type CobranzaCompleta = NonNullable<Awaited<ReturnType<typeof cargarCobranza>>>;

type ParaLiquidar = {
  consorcio: { tasaMoratoriaAnual: unknown; tasaPunitoriaAnual: unknown; prescripcionMeses: number };
  unidad: { deudas: { id: string; periodo: Date; concepto: string; monto: unknown; fechaVencimiento: Date }[] };
  pagos: { fecha: Date; monto: unknown }[];
  eventos: { estadoHasta: string | null; fecha: Date }[];
  fechaInicioJuicio: Date | null;
};

export function liquidarCobranza(c: ParaLiquidar, fechaCorte: Date = hoyUTC()): Liquidacion {
  const primeraCD = c.eventos
    .filter((e) => e.estadoHasta === "CARTA_DOCUMENTO")
    .map((e) => e.fecha)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return liquidar(
    c.unidad.deudas.map((d) => ({
      id: d.id,
      periodo: d.periodo,
      concepto: d.concepto,
      monto: Number(d.monto),
      fechaVencimiento: d.fechaVencimiento,
    })),
    c.pagos.map((p) => ({ fecha: p.fecha, monto: Number(p.monto) })),
    {
      tasaMoratoriaAnual: Number(c.consorcio.tasaMoratoriaAnual),
      tasaPunitoriaAnual: Number(c.consorcio.tasaPunitoriaAnual),
      prescripcionMeses: c.consorcio.prescripcionMeses,
      fechaCorte,
      fechaInterpelacion: primeraCD ?? null,
      fechaDemanda: c.fechaInicioJuicio,
    }
  );
}

export async function siguienteCodigoCobranza(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.cobranzaExpensas.count({ where: { code: { startsWith: `EXP-${year}-` } } });
  return `EXP-${year}-${String(count + 1).padStart(4, "0")}`;
}
