interface RadioPillsProps {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
}

// Grupo de botões grandes para seleção única (ex: espécie, sexo) — renderizado
// com <input type="radio"> nativo e estilizado via peer, sem JS necessário.
export function RadioPills({ name, options, defaultValue, required = true }: RadioPillsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map((opt) => {
        const id = `${name}-${opt.value}`;
        return (
          <div key={opt.value}>
            <input
              type="radio"
              id={id}
              name={name}
              value={opt.value}
              defaultChecked={defaultValue === opt.value}
              className="peer sr-only"
              required={required}
            />
            <label
              htmlFor={id}
              className="flex w-full items-center justify-center text-center min-h-[44px] rounded-2xl border-2 border-neutral-200 px-4 font-semibold text-neutral-600 cursor-pointer select-none transition-all peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-800 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 hover:border-neutral-300"
            >
              {opt.label}
            </label>
          </div>
        );
      })}
    </div>
  );
}
