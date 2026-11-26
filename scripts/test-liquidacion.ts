/**
 * Tests del motor de liquidación de expensas.
 * Ejecutar: pnpm test:expensas
 */
import assert from "node:assert/strict";
import { liquidar, calcularPrescripcion, generarCuotas, sumarMeses } from "../src/lib/expensas/liquidacion";

const d = (s: string) => new Date(s + "T00:00:00Z");
let ok = 0;
function test(name: string, fn: () => void) {
  fn();
  ok++;
  console.log("✓", name);
}

test("interés simple al 36% anual por 365 días = 36% del capital", () => {
  const l = liquidar(
    [{ id: "a", periodo: d("2025-01-01"), concepto: "ORDINARIA", monto: 100000, fechaVencimiento: d("2025-01-10") }],
    [],
    { tasaMoratoriaAnual: 36, tasaPunitoriaAnual: 0, prescripcionMeses: 60, fechaCorte: d("2026-01-10") }
  );
  assert.equal(l.periodos[0].diasMora, 365);
  assert.equal(l.totalIntereses, 36000);
  assert.equal(l.total, 136000);
});

test("suma tasa moratoria + punitoria", () => {
  const l = liquidar(
    [{ id: "a", periodo: d("2025-01-01"), concepto: "ORDINARIA", monto: 100000, fechaVencimiento: d("2025-01-10") }],
    [],
    { tasaMoratoriaAnual: 24, tasaPunitoriaAnual: 12, prescripcionMeses: 60, fechaCorte: d("2026-01-10") }
  );
  assert.equal(l.totalIntereses, 36000);
});

test("sin mora antes del vencimiento", () => {
  const l = liquidar(
    [{ id: "a", periodo: d("2026-11-01"), concepto: "ORDINARIA", monto: 50000, fechaVencimiento: d("2026-11-30") }],
    [],
    { tasaMoratoriaAnual: 36, tasaPunitoriaAnual: 0, prescripcionMeses: 60, fechaCorte: d("2026-11-26") }
  );
  assert.equal(l.totalIntereses, 0);
  assert.equal(l.periodos[0].diasMora, 0);
});

test("pago se imputa primero a intereses y luego a capital del período más antiguo (art. 903)", () => {
  const l = liquidar(
    [
      { id: "ene", periodo: d("2025-01-01"), concepto: "ORDINARIA", monto: 100000, fechaVencimiento: d("2025-01-10") },
      { id: "feb", periodo: d("2025-02-01"), concepto: "ORDINARIA", monto: 100000, fechaVencimiento: d("2025-02-10") },
    ],
    // a los 365 días de enero: interés enero = 36.000; febrero = 100000*.36*334/365 = 32.942,47
    [{ fecha: d("2026-01-10"), monto: 136000 }],
    { tasaMoratoriaAnual: 36, tasaPunitoriaAnual: 0, prescripcionMeses: 60, fechaCorte: d("2026-01-10") }
  );
  const ene = l.periodos.find((p) => p.id === "ene")!;
  const feb = l.periodos.find((p) => p.id === "feb")!;
  assert.equal(ene.total, 0);
  assert.equal(feb.capitalPendiente, 100000);
  assert.equal(feb.interesPendiente, 32942.47);
  assert.equal(l.totalPagado, 136000);
});

test("tras pagar capital, deja de devengar interés sobre lo pagado", () => {
  const l = liquidar(
    [{ id: "a", periodo: d("2025-01-01"), concepto: "ORDINARIA", monto: 100000, fechaVencimiento: d("2025-01-10") }],
    // paga el 10/01/2026 interés 36.000 + 50.000 de capital; quedan 50.000 de capital por 365 días más
    [{ fecha: d("2026-01-10"), monto: 86000 }],
    { tasaMoratoriaAnual: 36, tasaPunitoriaAnual: 0, prescripcionMeses: 60, fechaCorte: d("2027-01-10") }
  );
  assert.equal(l.periodos[0].capitalPendiente, 50000);
  assert.equal(l.periodos[0].interesPendiente, 18000);
});

test("pago excedente queda como saldo a favor", () => {
  const l = liquidar(
    [{ id: "a", periodo: d("2025-01-01"), concepto: "ORDINARIA", monto: 1000, fechaVencimiento: d("2025-01-10") }],
    [{ fecha: d("2025-01-05"), monto: 1500 }],
    { tasaMoratoriaAnual: 36, tasaPunitoriaAnual: 0, prescripcionMeses: 60, fechaCorte: d("2025-06-01") }
  );
  assert.equal(l.total, 0);
  assert.equal(l.saldoAFavor, 500);
});

test("prescripción: vigente, próxima y prescripta", () => {
  const venc = d("2024-01-10");
  assert.equal(calcularPrescripcion(venc, { prescripcionMeses: 24, fechaCorte: d("2025-06-01") }).estado, "VIGENTE");
  assert.equal(calcularPrescripcion(venc, { prescripcionMeses: 24, fechaCorte: d("2025-12-01") }).estado, "PROXIMA");
  assert.equal(calcularPrescripcion(venc, { prescripcionMeses: 24, fechaCorte: d("2026-01-10") }).estado, "PRESCRIPTA");
});

test("prescripción: la interpelación fehaciente suspende 6 meses (art. 2541)", () => {
  const r = calcularPrescripcion(d("2024-01-10"), {
    prescripcionMeses: 24,
    fechaCorte: d("2026-03-01"),
    fechaInterpelacion: d("2025-10-01"),
  });
  assert.deepEqual(r.fecha, d("2026-07-10"));
  assert.equal(r.estado, "VIGENTE");
});

test("prescripción: la interpelación posterior al vencimiento del plazo no suspende", () => {
  const r = calcularPrescripcion(d("2022-01-10"), {
    prescripcionMeses: 24,
    fechaCorte: d("2026-03-01"),
    fechaInterpelacion: d("2025-10-01"),
  });
  assert.equal(r.estado, "PRESCRIPTA");
});

test("prescripción: la demanda interrumpe (art. 2546)", () => {
  const r = calcularPrescripcion(d("2024-01-10"), {
    prescripcionMeses: 24,
    fechaCorte: d("2027-01-01"),
    fechaDemanda: d("2025-12-01"),
  });
  assert.equal(r.estado, "INTERRUMPIDA");
});

test("totalExigible excluye períodos prescriptos", () => {
  const l = liquidar(
    [
      { id: "viejo", periodo: d("2020-01-01"), concepto: "ORDINARIA", monto: 1000, fechaVencimiento: d("2020-01-10") },
      { id: "nuevo", periodo: d("2026-01-01"), concepto: "ORDINARIA", monto: 1000, fechaVencimiento: d("2026-01-10") },
    ],
    [],
    { tasaMoratoriaAnual: 0, tasaPunitoriaAnual: 0, prescripcionMeses: 24, fechaCorte: d("2026-02-01") }
  );
  assert.equal(l.total, 2000);
  assert.equal(l.totalExigible, 1000);
  assert.equal(l.periodosPrescriptos, 1);
});

test("sumarMeses ajusta fin de mes", () => {
  assert.deepEqual(sumarMeses(d("2025-01-31"), 1), d("2025-02-28"));
});

test("generarCuotas: la última absorbe el redondeo", () => {
  const c = generarCuotas(1000, 3, d("2026-12-10"));
  assert.equal(c.length, 3);
  assert.equal(c[0].monto, 333.33);
  assert.equal(c[2].monto, 333.34);
  assert.deepEqual(c[2].fechaVencimiento, d("2027-02-10"));
});

console.log(`\n${ok} tests OK`);
