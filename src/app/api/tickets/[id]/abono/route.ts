import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sessionOptions, type SessionData } from "@/lib/auth";
import { ticketAccessibleByUser } from "@/lib/ticket-scope";

const schema = z.object({ countsAgainstQuota: z.boolean() });

/** El abogado del ticket (o un admin) puede excluir la consulta del cupo del abono */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  if (!(await ticketAccessibleByUser(session.user, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  const ticket = await prisma.ticket.update({
    where: { id },
    data: { countsAgainstQuota: parsed.data.countsAgainstQuota },
    select: { id: true, countsAgainstQuota: true },
  });
  return NextResponse.json({ ticket });
}
