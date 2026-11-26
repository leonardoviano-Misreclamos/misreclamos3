"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-[#2C3E50] px-4 py-2 text-sm font-medium text-white hover:bg-[#375A7F]"
    >
      Imprimir / PDF
    </button>
  );
}
