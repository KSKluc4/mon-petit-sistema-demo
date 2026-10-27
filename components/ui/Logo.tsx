// Patinha sólida, bem proporcionada, sobre um círculo laranja claro — um
// único detalhe de cor (o badge), a pata inteira em teal. Funciona tanto em
// 32px (favicon) quanto em 80px (login): formas grandes, sem detalhes finos.
function PawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="currentColor" className="text-accent-100" />
      <g fill="currentColor" className="text-brand-600">
        <ellipse cx="27" cy="43" rx="8.5" ry="10.5" />
        <ellipse cx="41.5" cy="30" rx="9.5" ry="12" />
        <ellipse cx="58.5" cy="30" rx="9.5" ry="12" />
        <ellipse cx="73" cy="43" rx="8.5" ry="10.5" />
        <path d="M50 51c10 0 18 7.5 18 15.5S62 80 50 80s-18-6-18-13.5S40 51 50 51Z" />
      </g>
    </svg>
  );
}

interface LogoProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  withText?: boolean;
}

export function Logo({ className, markClassName = "w-8 h-8", textClassName = "text-xl", withText = true }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <PawMark className={markClassName} />
      {withText && (
        <span className={`font-display font-extrabold tracking-tight text-brand-800 ${textClassName}`}>
          Mon Petit
        </span>
      )}
    </span>
  );
}

// Padrão sutil de patinhas repetidas — usado como textura de fundo (login).
export function PawPattern({ className }: { className?: string }) {
  const paw = (x: number, y: number, rotate: number) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${rotate}) scale(0.14)`} fill="currentColor">
      <ellipse cx="27" cy="43" rx="8.5" ry="10.5" />
      <ellipse cx="41.5" cy="30" rx="9.5" ry="12" />
      <ellipse cx="58.5" cy="30" rx="9.5" ry="12" />
      <ellipse cx="73" cy="43" rx="8.5" ry="10.5" />
      <path d="M50 51c10 0 18 7.5 18 15.5S62 80 50 80s-18-6-18-13.5S40 51 50 51Z" />
    </g>
  );

  const paws = [];
  const rows = 8;
  const cols = 6;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * 90 + (row % 2 === 0 ? 0 : 45);
      const y = row * 80;
      paws.push(paw(x, y, (row + col) % 2 === 0 ? -18 : 12));
    }
  }

  return (
    <svg className={className} viewBox="0 0 480 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {paws}
    </svg>
  );
}
