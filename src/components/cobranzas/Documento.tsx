import type { Liquidacion } from "@/lib/expensas/liquidacion";
import { formatARS, formatFecha, formatPeriodo } from "@/lib/expensas/liquidacion";
import { PrintButton } from "./PrintButton";

/** Contenedor A4 para documentos imprimibles. El texto es editable antes de imprimir. */
export function Hoja({ children, aviso }: { children: React.ReactNode; aviso?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-4 px-4 print:hidden">
        <p className="text-xs text-slate-600">Podés editar el texto haciendo clic sobre él antes de imprimir o guardar como PDF.</p>
        <PrintButton />
      </div>
      {aviso ? <div className="mx-auto mb-4 max-w-[210mm] px-4 print:hidden">{aviso}</div> : null}
      <article
        contentEditable
        suppressContentEditableWarning
        className="mx-auto min-h-[297mm] max-w-[210mm] bg-white px-[20mm] py-[18mm] font-serif text-[12pt] leading-relaxed text-black shadow-lg outline-none print:shadow-none"
      >
        {children}
      </article>
    </div>
  );
}

export function TablaPeriodos({ l }: { l: Liquidacion }) {
  const filas = l.periodos.filter((p) => p.total > 0);
  return (
    <table className="my-4 w-full border-collapse text-[10pt]">
      <thead>
        <tr className="border-b border-black text-left">
          <th className="py-1">Período</th>
          <th className="py-1">Concepto</th>
          <th className="py-1">Vencimiento</th>
          <th className="py-1 text-right">Capital</th>
          <th className="py-1 text-right">Intereses</th>
          <th className="py-1 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((p) => (
          <tr key={p.id} className="border-b border-slate-300">
            <td className="py-0.5 capitalize">{formatPeriodo(p.periodo)}</td>
            <td className="py-0.5 lowercase">{p.concepto.replace("_", " ")}</td>
            <td className="py-0.5">{formatFecha(p.fechaVencimiento)}</td>
            <td className="py-0.5 text-right">{formatARS(p.capitalPendiente)}</td>
            <td className="py-0.5 text-right">{formatARS(p.interesPendiente)}</td>
            <td className="py-0.5 text-right">{formatARS(p.total)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-black font-bold">
          <td colSpan={3} className="py-1">
            Totales
          </td>
          <td className="py-1 text-right">{formatARS(filas.reduce((s, p) => s + p.capitalPendiente, 0))}</td>
          <td className="py-1 text-right">{formatARS(filas.reduce((s, p) => s + p.interesPendiente, 0))}</td>
          <td className="py-1 text-right">{formatARS(filas.reduce((s, p) => s + p.total, 0))}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/** Convierte un importe a letras (pesos), para el certificado. */
export function importeEnLetras(n: number): string {
  const entero = Math.floor(n);
  const cent = Math.round((n - entero) * 100);
  return `${numeroALetras(entero)} con ${String(cent).padStart(2, "0")}/100`;
}

const U = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const D = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const C = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function menorMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  let s = C[c];
  if (r > 0) {
    const t = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " y " + U[r % 10] : "");
    s = (s ? s + " " : "") + t;
  }
  return s;
}

export function numeroALetras(n: number): string {
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (millones) partes.push(millones === 1 ? "un millón" : `${numeroALetras(millones).replace(/uno$/, "un")} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${menorMil(miles).replace(/uno$/, "un")} mil`);
  if (resto) partes.push(menorMil(resto));
  return partes.join(" ");
}
