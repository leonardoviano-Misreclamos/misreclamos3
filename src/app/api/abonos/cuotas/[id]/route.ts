import { NextResponse } from "next/server";
import { z } from "zod";
import { optNum } from "@/lib/abonos-schemas";
import { prisma } from "@/lib/db";
import { adminOr403, badRequest, dateFromInput } from "@/lib/abonos-api";

const schema = z.object({
  action: z.enum(["pay", "waive", "reopen", "edit"]),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paidAmount: optNum(z.number().nonnegative()),
  paymentMethod: z.string().optional().nullable(),
  paymentRef: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  amount: optNum(z.number().nonnegative()),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await adminOr403();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  const inst = await prisma.installment.findUnique({ where: { id } });
  if (!inst) return NextResponse.json({ error: "Cuota inexistente" }, { status: 404 });

  let data: Record<string, unknown>;
  switch (d.action) {
    case "pay":
      data = {
        status: "PAID",
        paidAt: d.paidAt ? dateFromInput(d.paidAt) : new Date(),
        paidAmount: d.paidAmount ?? inst.amount,
        paymentMethod: d.paymentMethod || null,
        paymentRef: d.paymentRef || null,
        invoiceNumber: d.invoiceNumber ?? inst.invoiceNumber,
        notes: d.notes ?? inst.notes,
      };
      break;
    case "waive":
      data = { status: "WAIVED", notes: d.notes ?? inst.notes };
      break;
    case "reopen":
      data = { status: "PENDING", paidAt: null, paidAmount: null, paymentMethod: null, paymentRef: null };
      break;
    case "edit":
      data = {
        ...(d.amount != null ? { amount: d.amount } : {}),
        ...(d.invoiceNumber !== undefined ? { invoiceNumber: d.invoiceNumber } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
      };
      break;
  }
  const installment = await prisma.installment.update({ where: { id }, data });
  return NextResponse.json({ installment });
}
