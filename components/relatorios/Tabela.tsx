import type { ReactNode } from "react";

/**
 * Tabela de relatório legível no celular.
 *
 * A saída é rolagem horizontal com a PRIMEIRA COLUNA FIXA: no celular ela
 * mantém à vista o que identifica a linha (o serviço, o pet) enquanto os
 * números passam por baixo. Cards empilhados foram descartados porque estas
 * tabelas existem para comparar linhas entre si — em card, comparar exige
 * rolar a tela inteira.
 *
 * A célula fixa precisa de fundo opaco próprio, senão o conteúdo que rola passa
 * por baixo dela.
 */

export const THEAD = "text-left text-xs font-semibold uppercase tracking-wide text-neutral-500";
export const TH = "px-3 py-2 whitespace-nowrap";
export const TD = "px-3 py-2.5 whitespace-nowrap text-sm text-neutral-900";
export const TD_NUM = `${TD} text-right tabular-nums`;
export const TH_NUM = `${TH} text-right`;

// Primeira coluna: fixa na rolagem horizontal.
export const FIXA_TH = `${TH} sticky left-0 z-10 bg-neutral-50`;
export const FIXA_TD = `${TD} sticky left-0 z-10 bg-white group-even/linha:bg-neutral-50/60`;

export function TabelaScroll({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0 sm:rounded-2xl sm:border sm:border-neutral-100">
      <table className="w-full min-w-max border-collapse bg-white">{children}</table>
    </div>
  );
}

export function SecaoRelatorio({
  titulo,
  descricao,
  children,
  acao,
}: {
  titulo: string;
  descricao?: ReactNode;
  children: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-neutral-900">{titulo}</h2>
          {descricao && <div className="text-sm text-neutral-500">{descricao}</div>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function SemDados({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">{children}</p>;
}
