import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminOr403, badRequest } from "@/lib/abonos-api";
import { planSchema } from "@/lib/abonos-schemas";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await adminOr403();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = planSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  // Cambiar el plan no modifica abonos ya contratados (precio y cupo se copian al contratar)
  const plan = await prisma.advisoryPlan.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ plan });
}
