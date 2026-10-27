"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Users, Scissors, Wallet, BarChart3 } from "lucide-react";

const ITEMS = [
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/servicos", label: "Serviços", icon: Scissors },
  { href: "/caixa", label: "Caixa", icon: Wallet },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

export function HeaderNav() {
  const pathname = usePathname();

  return (
    // No celular os 5 destinos não cabem lado a lado. Quem rola é a NAV, não a
    // página — apertar o padding até caber quebraria o alvo de toque de 44px, e
    // página rolando na horizontal é bem pior do que uma barra deslizável. O
    // último item fica meio visível na borda, que é a pista de que dá pra
    // arrastar. A barra de rolagem em si fica escondida.
    <nav className="flex items-center gap-0.5 md:gap-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`text-sm font-semibold px-2.5 md:px-3 py-2 min-h-[44px] shrink-0 flex items-center gap-1.5 rounded-full transition-colors ${
              active ? "bg-brand-50 text-brand-700" : "text-neutral-500 hover:text-brand-700 hover:bg-brand-50/60"
            }`}
          >
            <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
            {/* Rótulos a partir de `md` (768px). Estiveram em `lg` enquanto o
                nome do usuário tinha largura livre e empurrava a navegação;
                com o nome limitado ao primeiro e com teto de largura, sobrou
                espaço no tablet. O wordmark e o nome seguem em `lg` — são eles
                que não cabem junto com os 5 rótulos abaixo de 1024px. */}
            <span className="hidden md:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
