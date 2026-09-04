"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";

/** Auto-opens the print dialog once, plus a manual fallback button. */
export function PrintTrigger({ auto = true }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-pill bg-black px-5 py-3 font-sans text-sm text-white shadow-lg"
    >
      <Printer className="size-4" aria-hidden="true" />
      Print
    </button>
  );
}
