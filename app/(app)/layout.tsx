import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, LogOut } from "lucide-react";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";
import { Logo } from "@/components/ui/Logo";
import { HeaderNav } from "@/components/layout/HeaderNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const inicial = session.nome.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-white border-b border-neutral-100 shadow-[0_1px_3px_rgba(23,20,16,0.05)] sticky top-0 z-10">
        {/* Mais largo que o conteúdo (max-w-3xl) de propósito: com 5 destinos
            na navegação, ícone + rótulo + logo + avatar + nome não cabem em
            768px — a barra estourava e o "Relatórios" ficava por cima do nome
            do usuário. Os rótulos de texto só aparecem a partir de `lg`, que é
            quando esta barra tem folga de verdade. */}
        {/* `gap-4 lg:gap-6` é a folga MÍNIMA entre a navegação e o bloco do
            usuário. Gap de flex não comprime, então esse respiro sobrevive a
            qualquer nome — antes eram 8px e, com o nome ocupando espaço, a lupa
            encostava no "Caixa". */}
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 lg:gap-6 px-3 py-2.5 sm:px-4">
          {/* min-w-0 deixa este lado encolher (a nav rola por dentro); é o lado
              que cede espaço, e por isso o bloco do usuário nunca o invade. */}
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <Link href="/" className="shrink-0">
              <Logo markClassName="w-8 h-8" textClassName="text-lg hidden lg:inline" />
            </Link>
            <HeaderNav />
          </div>
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <Link
              href="/busca"
              aria-label="Busca"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-neutral-500 hover:text-brand-700 hover:bg-brand-50/60 transition-colors"
            >
              <Search className="w-5 h-5" aria-hidden="true" />
            </Link>
            <Link
              href="/conta"
              className="flex items-center gap-2 pl-1 pr-1 md:pr-3 py-1.5 min-h-[44px] rounded-full hover:bg-neutral-50 transition-colors"
              // Nome COMPLETO aqui: é o que recupera o sobrenome quando o
              // header mostra só o primeiro nome, ou quando ele foi cortado.
              title={`Conta — ${session.nome}`}
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-600 text-white font-display font-bold text-sm shrink-0">
                {inicial}
              </span>
              {/* Nome COMPLETO, cortado com reticências no teto de 120px.
                  Chegou a mostrar só o primeiro nome, mas isso exibe a pessoa
                  errada para quem é chamado pelo segundo — "Maria Eduarda"
                  virava "Maria". Quem garante o layout é o teto de largura junto
                  com o `gap-4 lg:gap-6` do contêiner, não o encurtamento do
                  nome: mesmo um nome enorme trava em 120px e não empurra a
                  navegação. `inline-block` porque `truncate` não corta em
                  elemento inline. O avatar fica fora deste span, então nunca
                  some, e o nome inteiro está no `title` do link. */}
              <span className="hidden lg:inline-block max-w-[7.5rem] truncate align-middle text-sm font-semibold text-neutral-700">
                {session.nome}
              </span>
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Sair"
                title="Sair"
                className="text-sm font-medium text-neutral-400 hover:text-red-600 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
