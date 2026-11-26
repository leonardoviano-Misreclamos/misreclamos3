import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminOr403, badRequest } from "@/lib/abonos-api";
import { consortiumSchema } from "@/lib/abonos-schemas";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await adminOr403();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = consortiumSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const consortium = await prisma.consortium.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ consortium });
}
