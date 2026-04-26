"use client";

export function triggerPrint(): void {
  window.print();
}

export function PrintReportButton() {
  return (
    <button
      type="button"
      className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 print:hidden"
      onClick={triggerPrint}
    >
      Download PDF
    </button>
  );
}
