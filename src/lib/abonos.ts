/**
 * Abonos de asesoramiento jurídico a consorcios / barrios cerrados / countries.
 *
 * SUPUESTOS (v1, a validar con el estudio):
 *  - Las fechas se calculan en hora de Argentina (UTC-3, sin horario de verano).
 *  - El cupo de consultas se cuenta por MES CALENDARIO (no por período de facturación) y
 *    cada ticket nuevo que entra por WhatsApp desde un teléfono del consorcio es UNA consulta.
 *    El abogado puede excluir un ticket del cupo (countsAgainstQuota = false).
 *  - Las cuotas se generan automáticamente (sin cron) al abrir el módulo: una por mes desde el
 *    mes de inicio hasta el mes actual (o hasta endDate). El primer mes se cobra completo.
 *  - Un abono SUSPENDIDO sigue devengando cuotas y recibiendo consultas (se marcan en pantalla);
 *    uno CANCELADO deja de generar cuotas y no imputa consultas nuevas.
 *  - No se calculan intereses moratorios sobre cuotas vencidas en esta versión.
 *  - Las consultas excedentes se informan (cantidad x precio adicional) pero no se facturan solas.
 */
import type { Installment, Prisma, Subscription } from "@prisma/client";
import { prisma } from "@/lib/db";

const AR_OFFSET_MS = -3 * 60 * 60 * 1000;

/** Fecha "de pared" en Argentina como componentes */
function arParts(d: Date) {
  const local = new Date(d.getTime() + AR_OFFSET_MS);
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, day: local.getUTCDate() };
}

/** Instante UTC correspondiente a las 00:00 hs de Argentina del día dado */
function arMidnight(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day) - AR_OFFSET_MS);
}

export function periodOf(d: Date): string {
  const { y, m } = arParts(d);
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function parsePeriod(period: string): { y: number; m: number } {
  const [y, m] = period.split("-").map(Number);
  return { y, m };
}

export function nextPeriod(period: string): string {
  const { y, m } = parsePeriod(period);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** [inicio, fin) del mes calendario en hora argentina */
export function periodRange(period: string): { from: Date; to: Date } {
  const { y, m } = parsePeriod(period);
  const n = parsePeriod(nextPeriod(period));
  return { from: arMidnight(y, m, 1), to: arMidnight(n.y, n.m, 1) };
}

export function dueDateFor(period: string, dueDay: number): Date {
  const { y, m } = parsePeriod(period);
  const day = Math.min(Math.max(dueDay, 1), 28);
  // Vence al final del día indicado (23:59:59 AR)
  return new Date(arMidnight(y, m, day).getTime() + 24 * 60 * 60 * 1000 - 1000);
}

export function periodLabel(period: string): string {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const { y, m } = parsePeriod(period);
  return `${meses[m - 1]} ${y}`;
}

export type InstallmentState = "PAID" | "WAIVED" | "OVERDUE" | "PENDING";

export function installmentState(inst: Pick<Installment, "status" | "dueDate">, now = new Date()): InstallmentState {
  if (inst.status === "PAID") return "PAID";
  if (inst.status === "WAIVED") return "WAIVED";
  return inst.dueDate.getTime() < now.getTime() ? "OVERDUE" : "PENDING";
}

export function daysOverdue(inst: Pick<Installment, "status" | "dueDate">, now = new Date()): number {
  if (installmentState(inst, now) !== "OVERDUE") return 0;
  return Math.floor((now.getTime() - inst.dueDate.getTime()) / (24 * 60 * 60 * 1000));
}

export const installmentStateLabels: Record<InstallmentState, string> = {
  PAID: "Pagada",
  WAIVED: "Bonificada",
  OVERDUE: "Vencida",
  PENDING: "A vencer",
};

export const subscriptionStatusLabels: Record<Subscription["status"], string> = {
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  CANCELLED: "Cancelado",
};

export const consortiumTypeLabels = {
  EDIFICIO: "Consorcio (PH)",
  BARRIO_CERRADO: "Barrio cerrado",
  COUNTRY: "Country",
  OTRO: "Otro",
} as const;

/** Normaliza teléfono al formato que llega de BuilderBot (solo dígitos, ej. 5491112345678) */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Genera las cuotas faltantes de un abono hasta el mes actual (idempotente).
 */
export async function ensureInstallments(
  sub: Pick<Subscription, "id" | "startDate" | "endDate" | "status" | "monthlyFee" | "dueDay">,
  now = new Date(),
): Promise<void> {
  const current = periodOf(now);
  let last = current;
  if (sub.endDate) {
    const endP = periodOf(sub.endDate);
    if (endP < last) last = endP;
  }
  const first = periodOf(sub.startDate);
  if (first > last) return;

  const existing = await prisma.installment.findMany({
    where: { subscriptionId: sub.id },
    select: { period: true },
  });
  const have = new Set(existing.map((e) => e.period));

  // Un abono cancelado sin endDate no sigue generando cuotas nuevas más allá de las ya creadas
  if (sub.status === "CANCELLED" && !sub.endDate) return;

  const toCreate: Prisma.InstallmentCreateManyInput[] = [];
  for (let p = first; p <= last; p = nextPeriod(p)) {
    if (!have.has(p)) {
      toCreate.push({
        subscriptionId: sub.id,
        period: p,
        amount: sub.monthlyFee,
        dueDate: dueDateFor(p, sub.dueDay),
      });
    }
    if (toCreate.length > 240) break; // salvaguarda (20 años)
  }
  if (toCreate.length) {
    await prisma.installment.createMany({ data: toCreate, skipDuplicates: true });
  }
}

export async function ensureAllInstallments(now = new Date()): Promise<void> {
  const subs = await prisma.subscription.findMany({
    where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
    select: { id: true, startDate: true, endDate: true, status: true, monthlyFee: true, dueDay: true },
  });
  for (const s of subs) await ensureInstallments(s, now);
}

/**
 * Abono vigente al que se imputa una consulta de este cliente (teléfono), o null.
 */
export async function findSubscriptionForCustomer(customerId: string, now = new Date()) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { consortiumId: true },
  });
  if (!customer?.consortiumId) return null;
  return prisma.subscription.findFirst({
    where: {
      consortiumId: customer.consortiumId,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: { startDate: "desc" },
  });
}

/** Consultas imputadas al cupo en un mes calendario */
export async function quotaUsage(subscriptionId: string, period: string): Promise<number> {
  const { from, to } = periodRange(period);
  return prisma.ticket.count({
    where: { subscriptionId, countsAgainstQuota: true, createdAt: { gte: from, lt: to } },
  });
}

export function quotaSummary(used: number, included: number | null) {
  if (included == null) return { used, included: null, remaining: null, overage: 0, label: `${used} / ilimitadas` };
  const overage = Math.max(0, used - included);
  return {
    used,
    included,
    remaining: Math.max(0, included - used),
    overage,
    label: `${used} / ${included}`,
  };
}

/**
 * Datos para mostrar el estado de abono en un ticket.
 */
export async function ticketAbonoInfo(ticket: { id: string; subscriptionId: string | null; createdAt: Date; countsAgainstQuota: boolean }) {
  if (!ticket.subscriptionId) return null;
  const sub = await prisma.subscription.findUnique({
    where: { id: ticket.subscriptionId },
    include: { consortium: { select: { id: true, name: true } }, plan: { select: { name: true } } },
  });
  if (!sub) return null;
  const period = periodOf(ticket.createdAt);
  const used = await quotaUsage(sub.id, period);
  const overdue = await prisma.installment.count({
    where: { subscriptionId: sub.id, status: "PENDING", dueDate: { lt: new Date() } },
  });
  return {
    subscriptionId: sub.id,
    consortiumId: sub.consortium.id,
    consortiumName: sub.consortium.name,
    planName: sub.plan.name,
    status: sub.status,
    period,
    quota: quotaSummary(used, sub.includedQueries),
    countsAgainstQuota: ticket.countsAgainstQuota,
    overdueInstallments: overdue,
  };
}

export function formatARS(value: Prisma.Decimal | number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value.toString());
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
}
