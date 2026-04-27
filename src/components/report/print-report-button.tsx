"use client";

export function triggerPrint(): void {
  window.print();
}

export function PrintReportButton() {
  return (
    <button
      type="button"
      className="rounded-md border border-[#cfc9bb] bg-white px-3 py-2 text-sm font-semibold text-[#3f3b35] transition hover:bg-[#f6f5f1] print:hidden"
      onClick={triggerPrint}
    >
      Download PDF
    </button>
  );
}
