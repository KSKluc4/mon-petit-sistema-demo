import Link from "next/link";
import { History } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PeriodoFiltro } from "@/components/relatorios/PeriodoFiltro";
import { TipoFiltro } from "@/components/atividade/TipoFiltro";
import { listarLinhaDoTempo } from "@/lib/linhaDoTempo";
import { lerCategorias } from "@/lib/eventos";
import { resolverPeriodo } from "@/lib/periodos";
import { formatDataCurta, formatHora } from "@/lib/datas";

export const metadata = { title: "Atividade" };

/**
 * `/atividade` — quem fez o quê, numa lista só.
 *
 * Alcançada por `/conta` → Configurações da loja, **não pelo header**: a
 * navegação está no teto medido de 5 destinos, e um sexto quebra uma largura
 * que já foi consertada duas vezes (CLAUDE.md → Design).
 *
 * Período e tipo moram na URL, como no Relatórios: o recorte pode ser
 * recarregado, salvo ou mandado para a outra pessoa.
 */
export default async function AtividadePage({
  searchParams,
}: {
  searchParams: Promise<{ atalho?: string; de?: string; ate?: string; tipos?: string }>;
}) {
  const { atalho, de, ate, tipos } = await searchParams;
  const periodo = resolverPeriodo({ atalho, de, ate });
  const categorias = lerCategorias(tipos);
  const eventos = await listarLinhaDoTempo(periodo.inicioISO, periodo.fimISO, categorias);

  // Agrupa por dia: "o que aconteceu na terça" é a pergunta real, e uma lista
  // corrida de datas repetidas obriga a pessoa a fazer esse agrupamento de
  // cabeça enquanto procura.
  const porDia = new Map<string, typeof eventos>();
  for (const e of eventos) {
    const dia = formatDataCurta(e.quando);
    porDia.set(dia, [...(porDia.get(dia) ?? []), e]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-neutral-900">
          <History className="h-5 w-5 text-brand-600" aria-hidden="true" />
          Atividade
        </h1>
        <p className="text-neutral-500">Quem fez o quê, do mais recente para o mais antigo.</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
        <p>
          Aqui ficam as ações que <strong>apagam dado ou mexem em dinheiro</strong>: exclusões,
          mudança de taxa, correção e devolução de pagamento, venda e cancelamento de pacote,
          reativação de agendamento e finalização desfeita — e também serviço renomeado,
          desativado ou reativado e senha redefinida.
        </p>
        <p className="mt-1 text-neutral-500">
          Atendimento fechado e pagamento recebido não entram — acontecem o tempo todo e esconderiam
          o que se está procurando. Quem atendeu e quem recebeu aparece na ficha e no Caixa.
        </p>
      </div>

      <PeriodoFiltro periodo={periodo} basePath="/atividade" />
      <TipoFiltro ativos={categorias} />

      {eventos.length === 0 ? (
        <EmptyState message="Nada registrado neste período." />
      ) : (
        <div className="flex flex-col gap-4">
          {[...porDia.entries()].map(([dia, doDia]) => (
            <section key={dia} className="flex flex-col gap-2">
              <h2 className="font-display text-sm font-bold text-neutral-500">{dia}</h2>
              {doDia.map((e) => (
                <Card key={e.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    {/* Quem primeiro, em negrito: a frase inteira é "Ana
                        devolveu R$ 85,00 do atendimento da Mila". */}
                    <p className="text-neutral-900">
                      <strong className="font-semibold">{e.quem}</strong>{" "}
                      {minuscula(e.texto)}
                    </p>
                    <span className="shrink-0 text-sm tabular-nums text-neutral-400">
                      {formatHora(e.quando)}
                    </span>
                  </div>
                  {e.observacao && (
                    <p className="text-sm text-neutral-500 italic">“{e.observacao}”</p>
                  )}
                  {e.link && (
                    <Link
                      href={e.link}
                      className="w-fit text-sm font-medium text-brand-700 underline"
                    >
                      Ver
                    </Link>
                  )}
                </Card>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * As descrições foram escritas começando com maiúscula ("Alterou a taxa..."),
 * porque nasceram para ser lidas sozinhas. Aqui elas vêm depois do nome de quem
 * fez, então a inicial desce — "Ana alterou a taxa...".
 *
 * Só a PRIMEIRA letra, e só quando a segunda é minúscula: assim uma descrição
 * que comece com sigla ou nome próprio não é estragada.
 */
function minuscula(texto: string): string {
  if (texto.length < 2) return texto.toLowerCase();
  const segunda = texto[1];
  if (segunda !== segunda.toLowerCase()) return texto;
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}
