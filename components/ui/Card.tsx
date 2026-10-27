import type { ReactNode } from "react";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-[0_1px_2px_rgba(23,20,16,0.04),0_4px_16px_rgba(23,20,16,0.06)] border border-neutral-100 p-5 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
