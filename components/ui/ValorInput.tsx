"use client";

import { digitosParaCentavos, formatValorEditavel } from "@/lib/datas";

interface ValorInputProps {
  // Nome do campo enviado no form: centavos, ou "" quando em branco.
  name?: string;
  label?: string;
  // Centavos, ou null para "valor a definir" (campo em branco).
  value: number | null;
  onChange: (centavos: number | null) => void;
  autoFocus?: boolean;
  id?: string;
  className?: string;
}

// Campo de dinheiro do sistema: nunca vem preenchido sozinho, abre teclado
// numérico no celular e formata em R$ 0,00 conforme os dígitos são digitados.
export function ValorInput({
  name,
  label = "Valor (R$)",
  value,
  onChange,
  autoFocus,
  id,
  className,
}: ValorInputProps) {
  const inputId = id ?? name ?? "valor";

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
        {label}
      </label>
      <div className="flex items-center gap-2 min-h-[44px] rounded-2xl border border-neutral-200 bg-white px-4 transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
        <span className="text-base font-semibold text-neutral-500 shrink-0">R$</span>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoFocus={autoFocus}
          value={formatValorEditavel(value)}
          onChange={(e) => onChange(digitosParaCentavos(e.target.value))}
          placeholder="0,00"
          className="flex-1 min-w-0 bg-transparent py-2 text-base text-neutral-900 tabular-nums placeholder:text-neutral-400 focus:outline-none"
        />
      </div>
      {name && <input type="hidden" name={name} value={value === null ? "" : value} />}
    </div>
  );
}
