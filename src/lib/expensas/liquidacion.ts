/**
 * Motor de liquidación de deuda de expensas.
 *
 * Criterios (ver SUPUESTOS en docs/cobranza-expensas.md):
 * - Mora automática al vencimiento de cada período (art. 886 CCyC).
 * - Interés simple, sin capitalización (art. 770 CCyC), a la suma de la tasa
 *   moratoria y la punitoria (TNA %) que fije el reglamento, base 365 días.
 * - Los pagos se imputan primero a intereses y luego a capital (art. 903 CCyC),
 *   comenzando por el período de vencimiento más antiguo.
 * - Prescripción: plazo configurable por consorcio (en meses) contado desde el
 *   vencimiento de cada período. La primera interpelación fehaciente (CD)
 *   suspende el curso por 6 meses, una sola vez (art. 2541 CCyC); la demanda
 *   lo interrumpe (art. 2546 CCyC).
 *
 * Es una función pura: no toca la base de datos.
 */

export type PeriodoInput = {
  id: string;
  periodo: Date; // primer día del mes liquidado
  concepto: string;
  monto: number;
  fechaVencimiento: Date;
};

export type PagoInput = {
  fecha: Date;
  monto: number;
};

export type LiquidacionParams = {
  tasaMoratoriaAnual: number; // %
  tasaPunitoriaAnual: number; // %
  prescripcionMeses: number;
  fechaCorte: Date;
  /** Fecha de la primera carta documento / interpelación fehaciente (suspende 6 meses) */
  fechaInterpelacion?: Date | null;
  /** Fecha de interposición de la demanda ejecutiva (interrumpe) */
  fechaDemanda?: Date | null;
  /** Días de anticipación para alertar prescripción próxima */
  diasAlertaPrescripcion?: number;
};

export type EstadoPrescripcion = "VIGENTE" | "PROXIMA" | "PRESCRIPTA" | "INTERRUMPIDA";

export type PeriodoLiquidado = {
  id: string;
  periodo: Date;
  concepto: string;
  fechaVencimiento: Date;
  capitalOriginal: number;
  capitalPendiente: number;
  interesPendiente: number;
  interesTotalDevengado: number;
  total: number;
  diasMora: number;
  fechaPrescripcion: Date;
  prescripcion: EstadoPrescripcion;
};

export type Liquidacion = {
  fechaCorte: Date;
  tasaTotalAnual: number;
  periodos: PeriodoLiquidado[];
  totalCapital: number;
  totalIntereses: number;
  total: number;
  totalPagado: number;
  saldoAFavor: number;
  /** Total excluyendo períodos prescriptos (lo que es razonable reclamar) */
  totalExigible: number;
  periodosPrescriptos: number;
  periodosProximosAPrescribir: number;
};

const MS_DIA = 24 * 60 * 60 * 1000;

/** Normaliza a medianoche UTC para contar días calendario sin problemas de huso horario. */
export function toUTCDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function diasEntre(desde: Date, hasta: Date): number {
  return Math.round((toUTCDate(hasta).getTime() - toUTCDate(desde).getTime()) / MS_DIA);
}

export function sumarMeses(d: Date, meses: number): Date {
  const base = toUTCDate(d);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + meses;
  const day = base.getUTCDate();
  // Si el día no existe en el mes destino (31/02), se toma el último día del mes.
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, ultimo)));
}

const r2 = (n: number) => Math.round(n * 100) / 100;

type Estado = {
  p: PeriodoInput;
  capital: number;
  interes: number; // devengado y no pagado
  interesTotal: number;
  devengadoHasta: Date;
};

function devengar(e: Estado, hasta: Date, tasaDiaria: number) {
  const desde = e.devengadoHasta > e.p.fechaVencimiento ? e.devengadoHasta : e.p.fechaVencimiento;
  const dias = diasEntre(desde, hasta);
  if (dias <= 0 || e.capital <= 0) {
    if (hasta > e.devengadoHasta) e.devengadoHasta = hasta;
    return;
  }
  const i = e.capital * tasaDiaria * dias;
  e.interes += i;
  e.interesTotal += i;
  e.devengadoHasta = hasta;
}

export function calcularPrescripcion(
  vencimiento: Date,
  params: Pick<LiquidacionParams, "prescripcionMeses" | "fechaCorte" | "fechaInterpelacion" | "fechaDemanda" | "diasAlertaPrescripcion">
): { fecha: Date; estado: EstadoPrescripcion } {
  let fecha = sumarMeses(vencimiento, params.prescripcionMeses);
  // Suspensión por interpelación fehaciente: 6 meses, sólo si se hizo antes de prescribir.
  if (params.fechaInterpelacion) {
    const fi = toUTCDate(params.fechaInterpelacion);
    if (fi >= toUTCDate(vencimiento) && fi < fecha) fecha = sumarMeses(fecha, 6);
  }
  if (params.fechaDemanda) {
    const fd = toUTCDate(params.fechaDemanda);
    if (fd < fecha) return { fecha, estado: "INTERRUMPIDA" };
  }
  const corte = toUTCDate(params.fechaCorte);
  if (corte >= fecha) return { fecha, estado: "PRESCRIPTA" };
  const alerta = params.diasAlertaPrescripcion ?? 90;
  if (diasEntre(corte, fecha) <= alerta) return { fecha, estado: "PROXIMA" };
  return { fecha, estado: "VIGENTE" };
}

export function liquidar(periodos: PeriodoInput[], pagos: PagoInput[], params: LiquidacionParams): Liquidacion {
  const corte = toUTCDate(params.fechaCorte);
  const tasaTotalAnual = (params.tasaMoratoriaAnual || 0) + (params.tasaPunitoriaAnual || 0);
  const tasaDiaria = tasaTotalAnual / 100 / 365;

  const estados: Estado[] = periodos
    .map((p) => ({
      p: { ...p, fechaVencimiento: toUTCDate(p.fechaVencimiento), periodo: toUTCDate(p.periodo) },
      capital: p.monto,
      interes: 0,
      interesTotal: 0,
      devengadoHasta: toUTCDate(p.fechaVencimiento),
    }))
    .sort(
      (a, b) =>
        a.p.fechaVencimiento.getTime() - b.p.fechaVencimiento.getTime() ||
        a.p.periodo.getTime() - b.p.periodo.getTime()
    );

  const pagosOrdenados = pagos
    .map((p) => ({ ...p, fecha: toUTCDate(p.fecha) }))
    .filter((p) => p.fecha <= corte && p.monto > 0)
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  let saldoAFavor = 0;
  let totalPagado = 0;

  for (const pago of pagosOrdenados) {
    totalPagado += pago.monto;
    let resto = pago.monto + saldoAFavor;
    saldoAFavor = 0;
    for (const e of estados) devengar(e, pago.fecha, tasaDiaria);
    // Sólo se imputa a períodos ya liquidados a la fecha del pago (no a futuros)
    for (const e of estados) {
      if (resto <= 0) break;
      if (e.p.periodo > pago.fecha) continue;
      const aInteres = Math.min(resto, e.interes);
      e.interes -= aInteres;
      resto -= aInteres;
      const aCapital = Math.min(resto, e.capital);
      e.capital -= aCapital;
      resto -= aCapital;
    }
    saldoAFavor = resto;
  }

  for (const e of estados) devengar(e, corte, tasaDiaria);

  const out: PeriodoLiquidado[] = estados.map((e) => {
    const presc = calcularPrescripcion(e.p.fechaVencimiento, params);
    const capitalPendiente = r2(Math.max(0, e.capital));
    const interesPendiente = r2(Math.max(0, e.interes));
    return {
      id: e.p.id,
      periodo: e.p.periodo,
      concepto: e.p.concepto,
      fechaVencimiento: e.p.fechaVencimiento,
      capitalOriginal: r2(e.p.monto),
      capitalPendiente,
      interesPendiente,
      interesTotalDevengado: r2(e.interesTotal),
      total: r2(capitalPendiente + interesPendiente),
      diasMora: capitalPendiente > 0 ? Math.max(0, diasEntre(e.p.fechaVencimiento, corte)) : 0,
      fechaPrescripcion: presc.fecha,
      prescripcion: capitalPendiente + interesPendiente > 0 ? presc.estado : "VIGENTE",
    };
  });

  const totalCapital = r2(out.reduce((s, p) => s + p.capitalPendiente, 0));
  const totalIntereses = r2(out.reduce((s, p) => s + p.interesPendiente, 0));
  const totalExigible = r2(out.filter((p) => p.prescripcion !== "PRESCRIPTA").reduce((s, p) => s + p.total, 0));

  return {
    fechaCorte: corte,
    tasaTotalAnual,
    periodos: out,
    totalCapital,
    totalIntereses,
    total: r2(totalCapital + totalIntereses),
    totalPagado: r2(totalPagado),
    saldoAFavor: r2(saldoAFavor),
    totalExigible,
    periodosPrescriptos: out.filter((p) => p.prescripcion === "PRESCRIPTA").length,
    periodosProximosAPrescribir: out.filter((p) => p.prescripcion === "PROXIMA").length,
  };
}

/** Genera cuotas iguales mensuales; la última absorbe el redondeo. */
export function generarCuotas(montoTotal: number, cantidad: number, primerVencimiento: Date) {
  const base = Math.floor((montoTotal / cantidad) * 100) / 100;
  const cuotas = [];
  for (let i = 0; i < cantidad; i++) {
    const monto = i === cantidad - 1 ? r2(montoTotal - base * (cantidad - 1)) : base;
    cuotas.push({ numero: i + 1, fechaVencimiento: sumarMeses(primerVencimiento, i), monto });
  }
  return cuotas;
}

export function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}

export function formatFecha(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function formatPeriodo(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${MESES[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}
