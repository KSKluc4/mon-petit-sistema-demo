"use client";

import type { ReactNode } from "react";

interface AcaoDiscretaProps {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  confirmMessage?: string;
  tom?: "neutro" | "perigo";
}

export function AcaoDiscreta({ action, children, confirmMessage, tom = "neutro" }: AcaoDiscretaProps) {
  return (
    <form
      action={action}
      onSubmit={
        confirmMessage
          ? (e) => {
              if (!confirm(confirmMessage)) e.preventDefault();
            }
          : undefined
      }
    >
      <button
        type="submit"
        className={`min-h-[44px] rounded-xl px-3 text-sm font-medium transition-colors ${
          tom === "perigo"
            ? "text-neutral-500 hover:bg-red-50 hover:text-red-600"
            : "text-neutral-500 hover:bg-brand-50 hover:text-brand-700"
        }`}
      >
        {children}
      </button>
    </form>
  );
}
