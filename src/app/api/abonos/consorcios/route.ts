import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminOr403, badRequest } from "@/lib/abonos-api";
import { normalizePhone } from "@/lib/abonos";
import { consortiumSchema } from "@/lib/abonos-schemas";

const createSchema = consortiumSchema.extend({
  phones: z.array(z.object({ phone: z.string().min(5), name: z.string().optional() })).optional(),
});

export async function GET() {
  const auth = await adminOr403();
  if ("error" in auth) return auth.error;
  const consortia = await prisma.consortium.findMany({
    orderBy: { name: "asc" },
    include: { customers: { select: { id: true, phone: true, name: true } }, subscriptions: true },
  });
  return NextResponse.json({ consortia });
}

export async function POST(req: Request) {
  const auth = await adminOr403();
  if ("error" in auth) return auth.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { phones, ...data } = parsed.data;
  try {
    const consortium = await prisma.$transaction(async (tx) => {
      const c = await tx.consortium.create({ data });
      for (const p of phones ?? []) {
        const phone = normalizePhone(p.phone);
        if (!phone) continue;
        await tx.customer.upsert({
          where: { phone },
          update: { consortiumId: c.id },
          create: { phone, name: p.name || data.name, consortiumId: c.id },
        });
      }
      return c;
    });
    return NextResponse.json({ consortium });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return NextResponse.json({ error: "Ya existe un consorcio con ese CUIT" }, { status: 409 });
    throw e;
  }
}
