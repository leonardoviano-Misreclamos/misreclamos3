"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoCobranza } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { requireCobranzasAccess, siguienteCodigoCobranza, cargarCobranza, liquidarCobranza } from "@/lib/expensas/data";
import { puedeTransicionar, ESTADO_LABEL } from "@/lib/expensas/estados";
import { generarCuotas, sumarMeses, formatARS } from "@/lib/expensas/liquidacion";

// ---------------------------------------------------------------- helpers

const opt = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null));
const num = z.coerce.number();
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .transform((s) => new Date(s + "T00:00:00Z"));
const mes = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Período inválido (AAAA-MM)")
  .transform((s) => new Date(s + "-01T00:00:00Z"));

function form<T extends z.ZodTypeAny>(schema: T, fd: FormData): z.infer<T> {
  const obj: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string") obj[k] = v;
  });
  const r = schema.safeParse(obj);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Datos inválidos: ${msg}`);
  }
  return r.data;
}

async function requireAdminAction() {
  const session = await requireCobranzasAccess();
  if (!isAdmin(session.user)) throw new Error("Sólo administradores pueden modificar consorcios");
  return session;
}

// ---------------------------------------------------------------- administradoras y consorcios

export async function crearAdministradora(fd: FormData) {
  await requireAdminAction();
  const data = form(
    z.object({ razonSocial: z.string().min(2), cuit: opt, matricula: opt, contacto: opt, email: opt, phone: opt }),
    fd
  );
  await prisma.administradora.create({ data });
  revalidatePath("/cobranzas/consorcios");
}

const consorcioSchema = z.object({
  nombre: z.string().min(2),
  tipo: z.enum(["PROPIEDAD_HORIZONTAL", "BARRIO_CERRADO", "COUNTRY", "CLUB_DE_CHACRAS", "OTRO"]),
  cuit: opt,
  domicilio: opt,
  localidad: opt,
  jurisdiccion: z.enum(["CABA", "PBA", "OTRA"]),
  administradoraId: opt,
  tasaMoratoriaAnual: num.min(0).max(500),
  tasaPunitoriaAnual: num.min(0).max(500),
  diaVencimiento: num.int().min(1).max(31),
  prescripcionMeses: num.int().min(1).max(240),
  honorariosExtrajudicialesPct: opt.transform((v) => (v ? Number(v) : null)),
  cantidadUnidades: opt.transform((v) => (v ? parseInt(v, 10) : null)),
  contactoNombre: opt,
  contactoEmail: opt,
  notes: opt,
});

export async function crearConsorcio(fd: FormData) {
  await requireAdminAction();
  const data = form(consorcioSchema, fd);
  if (data.cuit && (await prisma.consorcio.findUnique({ where: { cuit: data.cuit } }))) {
    throw new Error(`Ya existe un consorcio con CUIT ${data.cuit}`);
  }
  const c = await prisma.consorcio.create({ data });
  redirect(`/cobranzas/consorcios/${c.id}`);
}

export async function actualizarConsorcio(id: string, fd: FormData) {
  await requireAdminAction();
  const data = form(consorcioSchema, fd);
  await prisma.consorcio.update({ where: { id }, data });
  revalidatePath(`/cobranzas/consorcios/${id}`);
}

// ---------------------------------------------------------------- unidades y deudores

export async function crearUnidad(consorcioId: string, fd: FormData) {
  await requireCobranzasAccess();
  const data = form(
    z.object({
      identificacion: z.string().min(1),
      porcentual: opt.transform((v) => (v ? Number(v.replace(",", ".")) : null)),
      matricula: opt,
      partida: opt,
      deudorNombre: opt,
      deudorDocumento: opt,
      deudorDomicilio: opt,
      deudorRol: z.enum(["PROPIETARIO", "COPROPIETARIO", "POSEEDOR", "USUFRUCTUARIO", "HEREDERO", "OTRO"]).default("PROPIETARIO"),
    }),
    fd
  );
  const unidad = await prisma.unidadFuncional.create({
    data: {
      consorcioId,
      identificacion: data.identificacion,
      porcentual: data.porcentual,
      matricula: data.matricula,
      partida: data.partida,
    },
  });
  if (data.deudorNombre) {
    await vincularDeudor(unidad.id, {
      nombre: data.deudorNombre,
      documento: data.deudorDocumento,
      domicilioNotificacion: data.deudorDomicilio,
      rol: data.deudorRol,
    });
  }
  revalidatePath(`/cobranzas/consorcios/${consorcioId}`);
}

async function vincularDeudor(
  unidadId: string,
  d: { nombre: string; documento: string | null; domicilioNotificacion: string | null; email?: string | null; phone?: string | null; rol: z.infer<typeof rolSchema> }
) {
  // Reutiliza el deudor si ya existe con el mismo documento
  const existente = d.documento ? await prisma.deudor.findFirst({ where: { documento: d.documento } }) : null;
  const deudor =
    existente ??
    (await prisma.deudor.create({
      data: {
        nombre: d.nombre,
        documento: d.documento,
        domicilioNotificacion: d.domicilioNotificacion,
        email: d.email ?? null,
        phone: d.phone ?? null,
      },
    }));
  await prisma.unidadDeudor.upsert({
    where: { unidadId_deudorId: { unidadId, deudorId: deudor.id } },
    create: { unidadId, deudorId: deudor.id, rol: d.rol },
    update: { rol: d.rol },
  });
}

const rolSchema = z.enum(["PROPIETARIO", "COPROPIETARIO", "POSEEDOR", "USUFRUCTUARIO", "HEREDERO", "OTRO"]);

export async function agregarDeudor(unidadId: string, revalidar: string, fd: FormData) {
  await requireCobranzasAccess();
  const data = form(
    z.object({ nombre: z.string().min(2), documento: opt, domicilioNotificacion: opt, email: opt, phone: opt, rol: rolSchema }),
    fd
  );
  await vincularDeudor(unidadId, data);
  revalidatePath(revalidar);
}

// ---------------------------------------------------------------- deuda

/** Carga uno o varios períodos mensuales consecutivos con el mismo monto. */
export async function cargarDeuda(unidadId: string, revalidar: string, fd: FormData) {
  await requireCobranzasAccess();
  const data = form(
    z.object({
      desde: mes,
      hasta: z.string().optional(),
      monto: num.positive(),
      concepto: z.enum(["ORDINARIA", "EXTRAORDINARIA", "FONDO_RESERVA", "OTRO"]),
      fechaVencimiento: z.string().optional(),
    }),
    fd
  );
  const unidad = await prisma.unidadFuncional.findUniqueOrThrow({ where: { id: unidadId }, include: { consorcio: true } });
  const hasta = data.hasta && /^\d{4}-\d{2}$/.test(data.hasta) ? new Date(data.hasta + "-01T00:00:00Z") : data.desde;
  if (hasta < data.desde) throw new Error("El período 'hasta' es anterior a 'desde'");

  const filas: { unidadId: string; periodo: Date; concepto: typeof data.concepto; monto: number; fechaVencimiento: Date }[] = [];
  for (let p = data.desde; p <= hasta; p = sumarMeses(p, 1)) {
    const venc: Date =
      filas.length === 0 && data.fechaVencimiento && /^\d{4}-\d{2}-\d{2}$/.test(data.fechaVencimiento) && data.desde.getTime() === hasta.getTime()
        ? new Date(data.fechaVencimiento + "T00:00:00Z")
        : venceEn(p, unidad.consorcio.diaVencimiento);
    filas.push({ unidadId, periodo: p, concepto: data.concepto, monto: data.monto, fechaVencimiento: venc });
    if (filas.length > 240) throw new Error("Demasiados períodos");
  }
  await prisma.deudaPeriodo.createMany({ data: filas, skipDuplicates: true });
  revalidatePath(revalidar);
}

function venceEn(periodo: Date, dia: number): Date {
  const y = periodo.getUTCFullYear();
  const m = periodo.getUTCMonth();
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(dia, ultimo)));
}

export async function eliminarDeuda(id: string, revalidar: string) {
  await requireCobranzasAccess();
  await prisma.deudaPeriodo.delete({ where: { id } });
  revalidatePath(revalidar);
}

// ---------------------------------------------------------------- cobranzas

export async function abrirCobranza(unidadId: string) {
  const session = await requireCobranzasAccess();
  const unidad = await prisma.unidadFuncional.findUniqueOrThrow({ where: { id: unidadId } });
  const abierta = await prisma.cobranzaExpensas.findFirst({
    where: { unidadId, estado: { notIn: ["CANCELADA", "ARCHIVADA"] } },
  });
  if (abierta) redirect(`/cobranzas/${abierta.id}`);
  const code = await siguienteCodigoCobranza();
  const c = await prisma.cobranzaExpensas.create({
    data: {
      code,
      consorcioId: unidad.consorcioId,
      unidadId,
      asignadoAId: session.user!.legacy ? null : session.user!.id,
      eventos: {
        create: {
          estadoHasta: "DETECTADA",
          fecha: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z"),
          descripcion: "Apertura del expediente de cobranza",
          createdById: session.user!.id,
        },
      },
    },
  });
  redirect(`/cobranzas/${c.id}`);
}

export async function cambiarEstado(cobranzaId: string, fd: FormData) {
  const session = await requireCobranzasAccess();
  const data = form(
    z.object({
      estado: z.enum([
        "DETECTADA",
        "INTIMACION_EXTRAJUDICIAL",
        "CARTA_DOCUMENTO",
        "CERTIFICADO_DEUDA",
        "EJECUCION",
        "PLAN_DE_PAGO",
        "CANCELADA",
        "ARCHIVADA",
      ]),
      fecha,
      descripcion: opt,
      nroCartaDocumento: opt,
      fechaRecepcion: opt,
      expedienteNumber: opt,
      juzgado: opt,
    }),
    fd
  );
  const c = await cargarCobranza(cobranzaId);
  if (!c) throw new Error("Cobranza inexistente");
  const hasta = data.estado as EstadoCobranza;
  if (!puedeTransicionar(c.estado, hasta)) {
    throw new Error(`No se puede pasar de "${ESTADO_LABEL[c.estado]}" a "${ESTADO_LABEL[hasta]}"`);
  }

  const extra: Record<string, unknown> = {};
  if (hasta === "CARTA_DOCUMENTO") {
    if (data.nroCartaDocumento) extra.nroCartaDocumento = data.nroCartaDocumento;
    if (data.fechaRecepcion) extra.fechaRecepcion = data.fechaRecepcion;
  }
  if (hasta === "CERTIFICADO_DEUDA" || hasta === "EJECUCION") {
    // Congela la liquidación a la fecha del acto, para trazabilidad
    const l = liquidarCobranza(c, data.fecha);
    extra.capital = l.totalCapital;
    extra.intereses = l.totalIntereses;
    extra.total = l.total;
    extra.totalExigible = l.totalExigible;
  }
  if (hasta === "EJECUCION") {
    if (data.expedienteNumber) extra.expedienteNumber = data.expedienteNumber;
    if (data.juzgado) extra.juzgado = data.juzgado;
  }

  await prisma.$transaction([
    prisma.cobranzaExpensas.update({
      where: { id: cobranzaId },
      data: {
        estado: hasta,
        ...(hasta === "EJECUCION"
          ? {
              expedienteNumber: data.expedienteNumber ?? c.expedienteNumber,
              juzgado: data.juzgado ?? c.juzgado,
              fechaInicioJuicio: c.fechaInicioJuicio ?? data.fecha,
            }
          : {}),
      },
    }),
    prisma.cobranzaEvento.create({
      data: {
        cobranzaId,
        estadoDesde: c.estado,
        estadoHasta: hasta,
        fecha: data.fecha,
        descripcion:
          data.descripcion ??
          `${ESTADO_LABEL[hasta]}${typeof extra.total === "number" ? ` — total liquidado ${formatARS(extra.total)}` : ""}`,
        data: Object.keys(extra).length ? (extra as object) : undefined,
        createdById: session.user!.id,
      },
    }),
  ]);
  revalidatePath(`/cobranzas/${cobranzaId}`);
}

export async function agregarNota(cobranzaId: string, fd: FormData) {
  const session = await requireCobranzasAccess();
  const data = form(z.object({ fecha, descripcion: z.string().min(2) }), fd);
  await prisma.cobranzaEvento.create({
    data: { cobranzaId, fecha: data.fecha, descripcion: data.descripcion, createdById: session.user!.id },
  });
  revalidatePath(`/cobranzas/${cobranzaId}`);
}

export async function asignarAbogado(cobranzaId: string, fd: FormData) {
  await requireCobranzasAccess();
  const id = String(fd.get("asignadoAId") || "") || null;
  await prisma.cobranzaExpensas.update({ where: { id: cobranzaId }, data: { asignadoAId: id } });
  revalidatePath(`/cobranzas/${cobranzaId}`);
}

export async function registrarPago(cobranzaId: string, fd: FormData) {
  const session = await requireCobranzasAccess();
  const data = form(z.object({ fecha, monto: num.positive(), medio: opt, notes: opt }), fd);
  await prisma.$transaction([
    prisma.pagoExpensas.create({ data: { cobranzaId, ...data } }),
    prisma.cobranzaEvento.create({
      data: {
        cobranzaId,
        fecha: data.fecha,
        descripcion: `Pago recibido: ${formatARS(data.monto)}${data.medio ? ` (${data.medio})` : ""}`,
        createdById: session.user!.id,
      },
    }),
  ]);
  revalidatePath(`/cobranzas/${cobranzaId}`);
}

export async function crearPlanPago(cobranzaId: string, fd: FormData) {
  const session = await requireCobranzasAccess();
  const data = form(
    z.object({ fechaAcuerdo: fecha, montoTotal: num.positive(), cantidadCuotas: num.int().min(1).max(120), primerVencimiento: fecha, notes: opt }),
    fd
  );
  const c = await prisma.cobranzaExpensas.findUniqueOrThrow({ where: { id: cobranzaId } });
  const cuotas = generarCuotas(data.montoTotal, data.cantidadCuotas, data.primerVencimiento);
  const ops = [
    prisma.planPago.updateMany({ where: { cobranzaId, activo: true }, data: { activo: false } }),
    prisma.planPago.create({
      data: {
        cobranzaId,
        fechaAcuerdo: data.fechaAcuerdo,
        montoTotal: data.montoTotal,
        cantidadCuotas: data.cantidadCuotas,
        notes: data.notes,
        cuotas: { create: cuotas },
      },
    }),
    prisma.cobranzaEvento.create({
      data: {
        cobranzaId,
        estadoDesde: c.estado,
        estadoHasta: "PLAN_DE_PAGO",
        fecha: data.fechaAcuerdo,
        descripcion: `Plan de pago: ${formatARS(data.montoTotal)} en ${data.cantidadCuotas} cuota(s)`,
        createdById: session.user!.id,
      },
    }),
  ];
  if (c.estado !== "PLAN_DE_PAGO") {
    if (!puedeTransicionar(c.estado, "PLAN_DE_PAGO")) throw new Error(`No se puede pasar a plan de pago desde ${ESTADO_LABEL[c.estado]}`);
  }
  await prisma.$transaction([...ops, prisma.cobranzaExpensas.update({ where: { id: cobranzaId }, data: { estado: "PLAN_DE_PAGO" } })]);
  revalidatePath(`/cobranzas/${cobranzaId}`);
}

export async function marcarCuotaPagada(cuotaId: string, fd: FormData) {
  const session = await requireCobranzasAccess();
  const data = form(z.object({ fecha }), fd);
  const cuota = await prisma.cuotaPlan.findUniqueOrThrow({ where: { id: cuotaId }, include: { plan: true } });
  if (cuota.pagadaAt) return;
  const cobranzaId = cuota.plan.cobranzaId;
  await prisma.$transaction([
    prisma.cuotaPlan.update({ where: { id: cuotaId }, data: { pagadaAt: data.fecha } }),
    prisma.pagoExpensas.create({
      data: { cobranzaId, fecha: data.fecha, monto: cuota.monto, medio: `Cuota ${cuota.numero}/${cuota.plan.cantidadCuotas} del plan` },
    }),
    prisma.cobranzaEvento.create({
      data: {
        cobranzaId,
        fecha: data.fecha,
        descripcion: `Pagada cuota ${cuota.numero}/${cuota.plan.cantidadCuotas} (${formatARS(Number(cuota.monto))})`,
        createdById: session.user!.id,
      },
    }),
  ]);
  revalidatePath(`/cobranzas/${cobranzaId}`);
}

export async function actualizarDatosJudiciales(cobranzaId: string, fd: FormData) {
  await requireCobranzasAccess();
  const data = form(z.object({ expedienteNumber: opt, juzgado: opt, fechaInicioJuicio: opt, notes: opt }), fd);
  await prisma.cobranzaExpensas.update({
    where: { id: cobranzaId },
    data: {
      expedienteNumber: data.expedienteNumber,
      juzgado: data.juzgado,
      fechaInicioJuicio: data.fechaInicioJuicio ? new Date(data.fechaInicioJuicio + "T00:00:00Z") : null,
      notes: data.notes,
    },
  });
  revalidatePath(`/cobranzas/${cobranzaId}`);
}
