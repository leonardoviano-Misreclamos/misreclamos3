import Link from "next/link";

const tabs = [
  { href: "/abonos", label: "Abonos y vencimientos" },
  { href: "/abonos/consorcios", label: "Consorcios" },
  { href: "/abonos/planes", label: "Planes" },
];

export function AbonosNav({ active }: { active: string }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            active === t.href ? "border-[#2196F3] text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function StatePill({ state }: { state: "PAID" | "WAIVED" | "OVERDUE" | "PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED" }) {
  const map: Record<string, [string, string]> = {
    PAID: ["Pagada", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
    WAIVED: ["Bonificada", "bg-slate-100 text-slate-600 ring-slate-200"],
    OVERDUE: ["Vencida", "bg-red-50 text-red-700 ring-red-200"],
    PENDING: ["A vencer", "bg-amber-50 text-amber-700 ring-amber-200"],
    ACTIVE: ["Activo", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
    SUSPENDED: ["Suspendido", "bg-amber-50 text-amber-700 ring-amber-200"],
    CANCELLED: ["Cancelado", "bg-slate-100 text-slate-600 ring-slate-200"],
  };
  const [text, cls] = map[state];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>{text}</span>;
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "red" | "green" }) {
  const color = tone === "red" ? "text-red-700" : tone === "green" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}
