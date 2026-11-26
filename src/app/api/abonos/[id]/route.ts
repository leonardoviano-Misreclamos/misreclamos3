import { NextResponse } from "next/server";
import { z } from "zod";
import { optNum } from "@/lib/abonos-schemas";
import { prisma } from "@/lib/db";
import { adminOr403, badRequest, dateFromInput } from "@/lib/abonos-api";

const patchSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "CANCELLED"]).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dueDay: optNum(z.number().int().min(1).max(28)),
  monthlyFee: optNum(z.number().nonnegative()),
  includedQueries: optNum(z.number().int().nonnegative()),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await adminOr403();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { endDate, ...rest } = parsed.data;
  // dueDay y monthlyFee no admiten null: se ignoran si vienen vacíos
  if (rest.dueDay == null) delete rest.dueDay;
  if (rest.monthlyFee == null) delete rest.monthlyFee;
  const data: Record<string, unknown> = { ...rest };
  if (endDate !== undefined) data.endDate = endDate ? dateFromInput(endDate) : null;

  // Al cancelar sin fecha de fin, la vigencia termina hoy (no se generan más cuotas)
  if (rest.status === "CANCELLED" && endDate === undefined) {
    const current = await prisma.subscription.findUnique({ where: { id }, select: { endDate: true } });
    if (!current?.endDate) data.endDate = new Date();
  }
  // Los cambios de precio aplican a las cuotas que se generen de ahora en más; las ya emitidas no cambian
  const subscription = await prisma.subscription.update({ where: { id }, data });
  return NextResponse.json({ subscription });
}
