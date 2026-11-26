"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
const label = "block text-xs font-medium text-slate-600 mb-1";
const btn =
  "inline-flex items-center justify-center rounded-lg bg-[#2196F3] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1976D2] disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50";

function useApi() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "No se pudo guardar");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Error de red");
      return false;
    } finally {
      setLoading(false);
    }
  }
  return { call, loading, error };
}

function formToObject(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  new FormData(form).forEach((v, k) => {
    if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  });
  return out;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h3 className="text-base font-semibold text-slate-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{error}</div>;
}

/* ───────────── Planes ───────────── */

export function CreatePlanForm() {
  const { call, loading, error } = useApi();
  return (
    <Card title="Nuevo plan">
      <ErrorBox error={error} />
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const d = formToObject(f);
          if (await call("/api/abonos/planes", "POST", d)) f.reset();
        }}
      >
        <div>
          <label className={label}>Nombre *</label>
          <input name="name" required className={input} placeholder="Básico / Integral / Premium" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Abono mensual (ARS) *</label>
            <input name="monthlyFee" type="number" step="0.01" min="0" required className={input} />
          </div>
          <div>
            <label className={label}>Consultas/mes</label>
            <input name="includedQueries" type="number" min="0" className={input} placeholder="vacío = ilimitadas" />
          </div>
        </div>
        <div>
          <label className={label}>Precio consulta adicional (ARS)</label>
          <input name="overageFee" type="number" step="0.01" min="0" className={input} />
        </div>
        <div>
          <label className={label}>Qué incluye</label>
          <textarea name="description" rows={3} className={input} placeholder="Consultas por WhatsApp, revisión de reglamento, asistencia a asambleas…" />
        </div>
        <button className={btn} disabled={loading}>{loading ? "Guardando…" : "Crear plan"}</button>
      </form>
    </Card>
  );
}

export function PlanActiveToggle({ id, active }: { id: string; active: boolean }) {
  const { call, loading } = useApi();
  return (
    <button className={btnGhost} disabled={loading} onClick={() => call(`/api/abonos/planes/${id}`, "PATCH", { active: !active })}>
      {active ? "Desactivar" : "Activar"}
    </button>
  );
}

/* ───────────── Consorcios ───────────── */

export function CreateConsortiumForm() {
  const { call, loading, error } = useApi();
  return (
    <Card title="Nuevo consorcio / barrio">
      <ErrorBox error={error} />
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const { phones, ...d } = formToObject(f);
          const phoneList = (phones || "")
            .split(/[\n,;]+/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((phone) => ({ phone }));
          if (await call("/api/abonos/consorcios", "POST", { ...d, phones: phoneList })) f.reset();
        }}
      >
        <div>
          <label className={label}>Nombre *</label>
          <input name="name" required className={input} placeholder="Consorcio Av. Santa Fe 1234 / Barrio Los Robles" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Tipo</label>
            <select name="type" className={input} defaultValue="EDIFICIO">
              <option value="EDIFICIO">Consorcio (PH)</option>
              <option value="BARRIO_CERRADO">Barrio cerrado</option>
              <option value="COUNTRY">Country</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div>
            <label className={label}>CUIT</label>
            <input name="cuit" className={input} placeholder="30-12345678-9" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Domicilio</label>
            <input name="address" className={input} />
          </div>
          <div>
            <label className={label}>Localidad / partido</label>
            <input name="locality" className={input} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Administradora</label>
            <input name="administrator" className={input} />
          </div>
          <div>
            <label className={label}>UF / lotes</label>
            <input name="unitsCount" type="number" min="1" className={input} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Contacto</label>
            <input name="contactName" className={input} />
          </div>
          <div>
            <label className={label}>Email</label>
            <input name="contactEmail" type="email" className={input} />
          </div>
        </div>
        <div>
          <label className={label}>Teléfonos WhatsApp autorizados (uno por línea)</label>
          <textarea name="phones" rows={2} className={input} placeholder={"5491112345678\n5491187654321"} />
          <p className="mt-1 text-[11px] text-slate-500">Las consultas que lleguen desde estos números se imputan al abono del consorcio.</p>
        </div>
        <button className={btn} disabled={loading}>{loading ? "Guardando…" : "Crear consorcio"}</button>
      </form>
    </Card>
  );
}

export function PhoneManager({
  consortiumId,
  phones,
}: {
  consortiumId: string;
  phones: { id: string; phone: string; name: string | null }[];
}) {
  const { call, loading, error } = useApi();
  return (
    <div>
      <ErrorBox error={error} />
      <ul className="mb-3 divide-y divide-slate-100">
        {phones.length === 0 ? <li className="py-2 text-sm text-slate-500">Sin teléfonos vinculados</li> : null}
        {phones.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              <span className="font-mono">{p.phone}</span>
              {p.name ? <span className="ml-2 text-slate-500">{p.name}</span> : null}
            </span>
            <button
              className={btnGhost}
              disabled={loading}
              onClick={() => call(`/api/abonos/consorcios/${consortiumId}/telefonos?customerId=${p.id}`, "DELETE")}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          if (await call(`/api/abonos/consorcios/${consortiumId}/telefonos`, "POST", formToObject(f))) f.reset();
        }}
      >
        <input name="phone" required placeholder="5491112345678" className={`${input} flex-1 min-w-[10rem]`} />
        <input name="name" placeholder="Nombre (opcional)" className={`${input} flex-1 min-w-[8rem]`} />
        <button className={btn} disabled={loading}>Agregar</button>
      </form>
    </div>
  );
}

/* ───────────── Abonos ───────────── */

export function CreateSubscriptionForm({
  consortia,
  plans,
  defaultConsortiumId,
}: {
  consortia: { id: string; name: string }[];
  plans: { id: string; name: string; monthlyFee: string; includedQueries: number | null }[];
  defaultConsortiumId?: string;
}) {
  const { call, loading, error } = useApi();
  const today = new Date().toISOString().slice(0, 10);
  if (plans.length === 0) {
    return (
      <Card title="Nuevo abono">
        <p className="text-sm text-slate-600">Primero creá al menos un plan en <Link className="text-indigo-600 underline" href="/abonos/planes">Planes</Link>.</p>
      </Card>
    );
  }
  if (consortia.length === 0) {
    return (
      <Card title="Nuevo abono">
        <p className="text-sm text-slate-600">Primero cargá un consorcio en <Link className="text-indigo-600 underline" href="/abonos/consorcios">Consorcios</Link>.</p>
      </Card>
    );
  }
  return (
    <Card title="Nuevo abono">
      <ErrorBox error={error} />
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          if (await call("/api/abonos", "POST", formToObject(f))) f.reset();
        }}
      >
        <div>
          <label className={label}>Consorcio *</label>
          <select name="consortiumId" required className={input} defaultValue={defaultConsortiumId ?? ""}>
            <option value="" disabled>Elegir…</option>
            {consortia.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Plan *</label>
          <select name="planId" required className={input} defaultValue="">
            <option value="" disabled>Elegir…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — ${Number(p.monthlyFee).toLocaleString("es-AR")} / {p.includedQueries ?? "∞"} consultas
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Inicio *</label>
            <input name="startDate" type="date" required defaultValue={today} className={input} />
          </div>
          <div>
            <label className={label}>Fin (opcional)</label>
            <input name="endDate" type="date" className={input} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>Vence el día</label>
            <input name="dueDay" type="number" min="1" max="28" defaultValue={10} className={input} />
          </div>
          <div>
            <label className={label}>Precio pactado</label>
            <input name="monthlyFee" type="number" step="0.01" min="0" className={input} placeholder="= plan" />
          </div>
          <div>
            <label className={label}>Consultas</label>
            <input name="includedQueries" type="number" min="0" className={input} placeholder="= plan" />
          </div>
        </div>
        <button className={btn} disabled={loading}>{loading ? "Guardando…" : "Contratar abono"}</button>
      </form>
    </Card>
  );
}

export function SubscriptionStatusActions({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" | "CANCELLED" }) {
  const { call, loading, error } = useApi();
  const [confirmCancel, setConfirmCancel] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ErrorBox error={error} />
      {status === "ACTIVE" ? (
        <button className={btnGhost} disabled={loading} onClick={() => call(`/api/abonos/${id}`, "PATCH", { status: "SUSPENDED" })}>
          Suspender
        </button>
      ) : null}
      {status === "SUSPENDED" ? (
        <button className={btnGhost} disabled={loading} onClick={() => call(`/api/abonos/${id}`, "PATCH", { status: "ACTIVE" })}>
          Reactivar
        </button>
      ) : null}
      {status !== "CANCELLED" ? (
        confirmCancel ? (
          <>
            <span className="text-xs text-red-700">¿Cancelar el abono desde hoy?</span>
            <button
              className={`${btnGhost} ring-red-300 text-red-700`}
              disabled={loading}
              onClick={() => call(`/api/abonos/${id}`, "PATCH", { status: "CANCELLED" })}
            >
              Sí, cancelar
            </button>
            <button className={btnGhost} onClick={() => setConfirmCancel(false)}>No</button>
          </>
        ) : (
          <button className={btnGhost} onClick={() => setConfirmCancel(true)}>Cancelar abono</button>
        )
      ) : null}
    </div>
  );
}

/* ───────────── Cuotas ───────────── */

export function InstallmentActions({
  id,
  status,
  amount,
}: {
  id: string;
  status: "PENDING" | "PAID" | "WAIVED";
  amount: string;
}) {
  const { call, loading, error } = useApi();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  if (status !== "PENDING") {
    return (
      <button className={btnGhost} disabled={loading} onClick={() => call(`/api/abonos/cuotas/${id}`, "PATCH", { action: "reopen" })}>
        Reabrir
      </button>
    );
  }
  if (!open) {
    return (
      <div className="flex gap-1.5">
        <button className={btnGhost} onClick={() => setOpen(true)}>Registrar pago</button>
        <button className={btnGhost} disabled={loading} onClick={() => call(`/api/abonos/cuotas/${id}`, "PATCH", { action: "waive" })}>
          Bonificar
        </button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await call(`/api/abonos/cuotas/${id}`, "PATCH", { action: "pay", ...formToObject(e.currentTarget) })) setOpen(false);
      }}
    >
      <ErrorBox error={error} />
      <div>
        <label className={label}>Fecha</label>
        <input name="paidAt" type="date" defaultValue={today} className={`${input} w-36`} />
      </div>
      <div>
        <label className={label}>Importe</label>
        <input name="paidAmount" type="number" step="0.01" defaultValue={Number(amount)} className={`${input} w-28`} />
      </div>
      <div>
        <label className={label}>Medio</label>
        <select name="paymentMethod" className={`${input} w-36`} defaultValue="Transferencia">
          <option>Transferencia</option>
          <option>Efectivo</option>
          <option>Cheque</option>
          <option>Mercado Pago</option>
          <option>Otro</option>
        </select>
      </div>
      <div>
        <label className={label}>Comprobante</label>
        <input name="paymentRef" className={`${input} w-32`} />
      </div>
      <div>
        <label className={label}>Factura</label>
        <input name="invoiceNumber" className={`${input} w-32`} placeholder="C 0001-…" />
      </div>
      <button className={btn} disabled={loading}>Guardar</button>
      <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancelar</button>
    </form>
  );
}

/* ───────────── Ticket ───────────── */

export function QuotaToggle({ ticketId, counts }: { ticketId: string; counts: boolean }) {
  const { call, loading } = useApi();
  return (
    <button
      className="underline decoration-dotted hover:text-slate-900 disabled:opacity-50"
      disabled={loading}
      onClick={() => call(`/api/tickets/${ticketId}/abono`, "PATCH", { countsAgainstQuota: !counts })}
      title="Excluir/incluir esta consulta del cupo mensual del abono"
    >
      {counts ? "no descontar del cupo" : "descontar del cupo"}
    </button>
  );
}
