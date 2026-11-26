import Link from "next/link";
import type { EstadoCobranza } from "@prisma/client";
import { ESTADO_COLOR, ESTADO_LABEL } from "@/lib/expensas/estados";
import type { EstadoPrescripcion } from "@/lib/expensas/liquidacion";

export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#375A7F] focus:outline-none focus:ring-1 focus:ring-[#375A7F]";
export const btnCls =
  "inline-flex items-center justify-center rounded-lg bg-[#2C3E50] px-4 py-2 text-sm font-medium text-white hover:bg-[#375A7F] transition";
export const btnSecondaryCls =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition";

export function Card({ title, children, actions }: { title?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {title || actions ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function EstadoBadge({ estado }: { estado: EstadoCobranza }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_COLOR[estado]}`}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}

const PRESC: Record<EstadoPrescripcion, string> = {
  VIGENTE: "",
  PROXIMA: "bg-amber-100 text-amber-800",
  PRESCRIPTA: "bg-red-100 text-red-800",
  INTERRUMPIDA: "bg-emerald-50 text-emerald-700",
};
const PRESC_LABEL: Record<EstadoPrescripcion, string> = {
  VIGENTE: "Vigente",
  PROXIMA: "Prescribe pronto",
  PRESCRIPTA: "Prescripta",
  INTERRUMPIDA: "Interrumpida",
};
export function PrescripcionBadge({ estado }: { estado: EstadoPrescripcion }) {
  if (estado === "VIGENTE") return <span className="text-xs text-slate-400">Vigente</span>;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${PRESC[estado]}`}>{PRESC_LABEL[estado]}</span>;
}

export function SubNav({ active }: { active: "cobranzas" | "consorcios" }) {
  const cls = (on: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${on ? "bg-[#2C3E50] text-white" : "text-slate-600 hover:bg-slate-200"}`;
  return (
    <div className="flex gap-2">
      <Link href="/cobranzas" className={cls(active === "cobranzas")}>
        Expedientes
      </Link>
      <Link href="/cobranzas/consorcios" className={cls(active === "consorcios")}>
        Consorcios y barrios
      </Link>
    </div>
  );
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
