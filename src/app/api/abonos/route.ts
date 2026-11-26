import { NextResponse } from "next/server";
import { z } from "zod";
import { optNum } from "@/lib/abonos-schemas";
import { prisma } from "@/lib/db";
import { adminOr403, badRequest, dateFromInput } from "@/lib/abonos-api";
import { ensureInstallments } from "@/lib/abonos";

const createSchema = z.object({
  consorcioId: z.string().min(1),
  planId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dueDay: z.coerce.number().int().min(1).max(28).default(10),
  /** Precio pactado distinto al de lista (opcional) */
  monthlyFee: optNum(z.number().nonnegative()),
  includedQueries: optNum(z.number().int().nonnegative()),
  notes: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await adminOr403();
  if ("error" in auth) return auth.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;

  const plan = await prisma.advisoryPlan.findUnique({ where: { id: d.planId } });
  if (!plan) return NextResponse.json({ error: "Plan inexistente" }, { status: 404 });

  const active = await prisma.subscription.count({
    where: { consorcioId: d.consorcioId, status: { in: ["ACTIVE", "SUSPENDED"] } },
  });
  if (active > 0) {
    return NextResponse.json(
      { error: "El consorcio ya tiene un abono vigente. Cancelalo antes de contratar otro." },
      { status: 409 },
    );
  }

  const sub = await prisma.subscription.create({
    data: {
      consorcioId: d.consorcioId,
      planId: d.planId,
      startDate: dateFromInput(d.startDate),
      endDate: d.endDate ? dateFromInput(d.endDate) : null,
      dueDay: d.dueDay,
      monthlyFee: d.monthlyFee ?? plan.monthlyFee,
      includedQueries: d.includedQueries !== undefined && d.includedQueries !== null ? d.includedQueries : plan.includedQueries,
      overageFee: plan.overageFee,
      notes: d.notes || null,
    },
  });
  await ensureInstallments(sub);
  return NextResponse.json({ subscription: sub });
}
