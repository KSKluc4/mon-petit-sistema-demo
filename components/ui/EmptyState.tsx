import type { ReactNode } from "react";

// Silhueta simples de cachorro + gato, nas cores da marca — usada nos estados
// vazios das listas em vez de uma tela em branco.
function PetSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true">
      <ellipse cx="80" cy="108" rx="70" ry="8" className="fill-brand-100" />
      {/* Cachorro */}
      <g className="fill-brand-300">
        <ellipse cx="55" cy="72" rx="26" ry="22" />
        <circle cx="90" cy="55" r="18" />
        <ellipse cx="76" cy="38" rx="7" ry="12" transform="rotate(-25 76 38)" />
        <ellipse cx="104" cy="38" rx="7" ry="12" transform="rotate(25 104 38)" />
        <circle cx="98" cy="52" r="2.4" className="fill-brand-800" />
        <circle cx="84" cy="52" r="2.4" className="fill-brand-800" />
      </g>
      {/* Gato */}
      <g className="fill-accent-300">
        <ellipse cx="112" cy="80" rx="20" ry="17" />
        <circle cx="130" cy="65" r="14" />
        <path d="M120 55 L124 42 L131 54 Z" />
        <path d="M142 55 L146 42 L149 56 Z" />
        <circle cx="135" cy="64" r="1.8" className="fill-accent-800" />
        <circle cx="125" cy="64" r="1.8" className="fill-accent-800" />
      </g>
    </svg>
  );
}

interface EmptyStateProps {
  message: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ message, action, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-4 py-12 text-center ${className ?? ""}`}>
      <PetSilhouette className="w-40 h-auto" />
      <p className="text-neutral-500 max-w-xs">{message}</p>
      {action}
    </div>
  );
}
