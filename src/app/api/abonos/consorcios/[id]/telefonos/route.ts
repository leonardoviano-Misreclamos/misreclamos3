import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminOr403, badRequest } from "@/lib/abonos-api";
import { normalizePhone } from "@/lib/abonos";

const schema = z.object({ phone: z.string().min(5), name: z.string().optional() });

/** Vincula un teléfono (cliente) al consorcio: sus consultas por WhatsApp se imputarán al abono */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await adminOr403();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const phone = normalizePhone(parsed.data.phone);
  const consorcio = await prisma.consorcio.findUnique({ where: { id }, select: { nombre: true } });
  if (!consorcio) return NextResponse.json({ error: "Consorcio inexistente" }, { status: 404 });
  const existing = await prisma.customer.findUnique({ where: { phone }, select: { consorcioId: true } });
  if (existing?.consorcioId && existing.consorcioId !== id) {
    return NextResponse.json({ error: "Ese teléfono ya está vinculado a otro consorcio" }, { status: 409 });
  }
  const customer = await prisma.customer.upsert({
    where: { phone },
    update: { consorcioId: id, ...(parsed.data.name ? { name: parsed.data.name } : {}) },
    create: { phone, name: parsed.data.name || consorcio.nombre, consorcioId: id },
  });
  return NextResponse.json({ customer });
}

/** Desvincula un teléfono del consorcio (no borra el cliente ni sus tickets) */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await adminOr403();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const customerId = new URL(req.url).searchParams.get("customerId");
  if (!customerId) return badRequest("customerId requerido");
  await prisma.customer.updateMany({ where: { id: customerId, consorcioId: id }, data: { consorcioId: null } });
  return NextResponse.json({ ok: true });
}
