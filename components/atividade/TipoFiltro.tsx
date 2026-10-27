"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIAS, type CategoriaEvento } from "@/lib/eventos";

/**
 * Filtro por tipo de evento, para quem já sabe o que procura estreitar a lista.
 *
 * Quatro pílulas e não nove: nove tipos viravam três linhas de botão no
 * celular, justo na tela em que se está procurando alguma coisa. O agrupamento
 * responde a pergunta que a pessoa realmente faz — "mexeram no dinheiro",
 * "apagaram alguma coisa", "mexeram na agenda", "mexeram no acesso".
 *
 * QUEBRA em duas linhas no celular, de propósito — não rola na horizontal.
 * Chegou a rolar, como a nav do header e as abas do pet, e em 390px a pílula
 * "Acesso" ficava inteira fora da tela sem nada indicando que existia: justo a
 * que foi criada para ser encontrada por quem procura "quem trocou minha
 * senha?". Linha que rola serve para NAVEGAÇÃO, que se aprende uma vez; isto é
 * um FILTRO numa tela de investigação, aberta raramente, por alguém que não
 * sabe quais opções existem — a opção tem que estar à vista. Cinco pílulas em
 * duas linhas é aceitável; nove em três era o que não cabia. Apertar o padding
 * até caber numa linha quebraria o alvo de toque de 44px.
 *
 * Vive na URL, como o período: o recorte pode ser recarregado ou mandado para
 * a outra pessoa ("olha aqui o que aconteceu").
 */
export function TipoFiltro({ ativos }: { ativos: CategoriaEvento[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function alternar(id: CategoriaEvento) {
    const params = new URLSearchParams(searchParams.toString());
    const novos = ativos.includes(id) ? ativos.filter((c) => c !== id) : [...ativos, id];
    // Todos marcados é o mesmo que nenhum marcado ("tudo"), e sem o parâmetro
    // a URL fica mais limpa para compartilhar.
    if (novos.length === 0 || novos.length === CATEGORIAS.length) params.delete("tipos");
    else params.set("tipos", novos.join(","));
    router.push(`/atividade?${params}`);
  }

  function limpar() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tipos");
    router.push(`/atividade?${params}`);
  }

  const tudo = ativos.length === 0;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={limpar}
        aria-pressed={tudo}
        className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
          tudo
            ? "bg-brand-600 text-white"
            : "bg-neutral-100 text-neutral-700 hover:bg-brand-50 hover:text-brand-700"
        }`}
      >
        Tudo
      </button>
      {CATEGORIAS.map(({ id, label }) => {
        const ativo = ativos.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => alternar(id)}
            aria-pressed={ativo}
            className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
              ativo
                ? "bg-brand-600 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-brand-50 hover:text-brand-700"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
