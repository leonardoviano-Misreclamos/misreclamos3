import { z } from "zod";

/** Número opcional: "" / null / undefined -> undefined o null (no 0) */
export const optNum = (inner: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().pipe(inner).optional().nullable());

export const planSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  monthlyFee: z.coerce.number().nonnegative(),
  includedQueries: optNum(z.number().int().nonnegative()),
  overageFee: optNum(z.number().nonnegative()),
  active: z.boolean().optional(),
});

const opt = z.string().trim().optional().nullable().transform((v) => (v ? v : null));

export const consortiumSchema = z.object({
  nombre: z.string().trim().min(1),
  tipo: z.enum(["PROPIEDAD_HORIZONTAL", "BARRIO_CERRADO", "COUNTRY", "CLUB_DE_CHACRAS", "OTRO"]).default("PROPIEDAD_HORIZONTAL"),
  jurisdiccion: z.enum(["CABA", "PBA", "OTRA"]).default("CABA"),
  cuit: opt,
  domicilio: opt,
  localidad: opt,
  cantidadUnidades: optNum(z.number().int().positive()),
  administradoraId: opt,
  contactoNombre: opt,
  contactoEmail: opt,
  notes: opt,
});
