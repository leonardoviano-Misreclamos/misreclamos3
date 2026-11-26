import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminOr403, badRequest } from "@/lib/abonos-api";
import { planSchema } from "@/lib/abonos-schemas";

export async function GET() {
  const auth = await adminOr403();
  if ("error" in auth) return auth.error;
  const plans = await prisma.advisoryPlan.findMany({
    orderBy: [{ active: "desc" }, { monthlyFee: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });
  return NextResponse.json({ plans });
}

export async function POST(req: Request) {
  const auth = await adminOr403();
  if ("error" in auth) return auth.error;
  const parsed = planSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  try {
    const plan = await prisma.advisoryPlan.create({ data: parsed.data });
    return NextResponse.json({ plan });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return NextResponse.json({ error: "Ya existe un plan con ese nombre" }, { status: 409 });
    throw e;
  }
}
