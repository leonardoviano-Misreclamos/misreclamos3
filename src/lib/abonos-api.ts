import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { isAdmin, sessionOptions, type SessionData, type SessionUser } from "@/lib/auth";

/** Devuelve el usuario si es ADMIN, o una respuesta 403 */
export async function adminOr403(): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || !isAdmin(session.user)) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { user: session.user };
}

export function badRequest(details: unknown) {
  return NextResponse.json({ error: "Formato inválido", details }, { status: 400 });
}

/** "2026-12-01" -> Date a las 12:00 AR (evita corrimientos de día por zona horaria) */
export function dateFromInput(s: string): Date {
  return new Date(`${s}T12:00:00-03:00`);
}
