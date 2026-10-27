"use client";

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { buttonClass } from "./Button";

interface DeleteButtonProps {
  action: (formData: FormData) => void | Promise<void>;
  confirmMessage: string;
  children?: ReactNode;
}

export function DeleteButton({ action, confirmMessage, children = "Excluir" }: DeleteButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className={buttonClass("danger")}>
        <Trash2 className="w-4 h-4" aria-hidden="true" />
        {children}
      </button>
    </form>
  );
}
