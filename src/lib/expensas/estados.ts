import type { EstadoCobranza } from "@prisma/client";

export const ESTADO_LABEL: Record<EstadoCobranza, string> = {
  DETECTADA: "Deuda detectada",
  INTIMACION_EXTRAJUDICIAL: "Intimación extrajudicial",
  CARTA_DOCUMENTO: "Carta documento",
  CERTIFICADO_DEUDA: "Certificado de deuda (art. 2048)",
  EJECUCION: "Ejecución judicial",
  PLAN_DE_PAGO: "Plan de pago",
  CANCELADA: "Cancelada",
  ARCHIVADA: "Archivada",
};

export const ESTADO_COLOR: Record<EstadoCobranza, string> = {
  DETECTADA: "bg-slate-100 text-slate-700",
  INTIMACION_EXTRAJUDICIAL: "bg-sky-100 text-sky-800",
  CARTA_DOCUMENTO: "bg-amber-100 text-amber-800",
  CERTIFICADO_DEUDA: "bg-orange-100 text-orange-800",
  EJECUCION: "bg-red-100 text-red-800",
  PLAN_DE_PAGO: "bg-violet-100 text-violet-800",
  CANCELADA: "bg-emerald-100 text-emerald-800",
  ARCHIVADA: "bg-slate-200 text-slate-600",
};

/**
 * Transiciones permitidas. El circuito habitual es
 * detectada → intimación → CD → certificado → ejecución, con salida a plan de pago
 * o cancelación en cualquier momento. Se permite saltear la intimación simple
 * (ir directo a CD) y volver de plan de pago a la etapa siguiente si se incumple.
 */
export const TRANSICIONES: Record<EstadoCobranza, EstadoCobranza[]> = {
  DETECTADA: ["INTIMACION_EXTRAJUDICIAL", "CARTA_DOCUMENTO", "PLAN_DE_PAGO", "CANCELADA", "ARCHIVADA"],
  INTIMACION_EXTRAJUDICIAL: ["CARTA_DOCUMENTO", "PLAN_DE_PAGO", "CANCELADA", "ARCHIVADA"],
  CARTA_DOCUMENTO: ["CERTIFICADO_DEUDA", "PLAN_DE_PAGO", "CANCELADA", "ARCHIVADA"],
  CERTIFICADO_DEUDA: ["EJECUCION", "PLAN_DE_PAGO", "CANCELADA", "ARCHIVADA"],
  EJECUCION: ["PLAN_DE_PAGO", "CANCELADA", "ARCHIVADA"],
  PLAN_DE_PAGO: ["CARTA_DOCUMENTO", "CERTIFICADO_DEUDA", "EJECUCION", "CANCELADA", "ARCHIVADA"],
  CANCELADA: ["ARCHIVADA"],
  ARCHIVADA: ["DETECTADA"],
};

export function puedeTransicionar(desde: EstadoCobranza, hasta: EstadoCobranza): boolean {
  return TRANSICIONES[desde].includes(hasta);
}

export const ESTADOS_ACTIVOS: EstadoCobranza[] = [
  "DETECTADA",
  "INTIMACION_EXTRAJUDICIAL",
  "CARTA_DOCUMENTO",
  "CERTIFICADO_DEUDA",
  "EJECUCION",
  "PLAN_DE_PAGO",
];

export const TIPO_CONSORCIO_LABEL = {
  PROPIEDAD_HORIZONTAL: "Propiedad horizontal",
  BARRIO_CERRADO: "Barrio cerrado",
  COUNTRY: "Country / club de campo",
  CLUB_DE_CHACRAS: "Club de chacras",
  OTRO: "Otro",
} as const;

export const ROL_DEUDOR_LABEL = {
  PROPIETARIO: "Propietario",
  COPROPIETARIO: "Copropietario",
  POSEEDOR: "Poseedor",
  USUFRUCTUARIO: "Usufructuario",
  HEREDERO: "Heredero",
  OTRO: "Otro",
} as const;
