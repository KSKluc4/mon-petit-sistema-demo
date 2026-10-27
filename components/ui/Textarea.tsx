import type { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export function Textarea({ label, error, id, name, className, rows = 3, ...props }: TextareaProps) {
  const textareaId = id ?? name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={textareaId} className="text-sm font-medium text-neutral-700">
        {label}
      </label>
      <textarea
        id={textareaId}
        name={name}
        rows={rows}
        className={`rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 ${className ?? ""}`}
        {...props}
      />
      {error && <span className="text-sm text-red-600 font-medium">{error}</span>}
    </div>
  );
}
