import { AlertTriangle, Ticket, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  dataISODe,
  dataISOValida,
  formatCentavos,
  formatDataCurta,
  formatDataExtenso,
  hojeISO,
  intervaloDoDia,
} from "@/lib/datas";
import { DiaNav } from "@/components/agenda/DiaNav";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PendenciaCard } from "@/components/caixa/PendenciaCard";
import { FILTRO_PAGO, listarPendencias, resumirPendencias, somarRecebimentos } from "@/lib/faturamento";
import { comAutor } from "@/lib/autoria";
import { formatarParcelas, formatarTaxa, valoresDoPagamento } from "@/lib/pagamento";
import { listarFormasAtivas } from "@/lib/recebimento";

export const metadata = { title: "Caixa" };

export default async function CaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data } = await searchParams;
  const dataISO = data && dataISOValida(data) ? data : hojeISO();
  const { inicio, fim } = intervaloDoDia(dataISO);

  const [
    recebimentos,
    pendencias,
    formas,
    pacotesVendidos,
    estornos,
    estornosAtendimento,
    banhosDePacote,
  ] = await Promise.all([
    // REGIME DE CAIXA: o dia é filtrado pela data em que o dinheiro entrou, não
    // pela data do atendimento. Um banho do dia 28 recebido hoje aparece no
    // caixa de HOJE — ver lib/faturamento.ts.
    prisma.atendimento.findMany({
      where: {
        dataRecebimento: { gte: inicio, lt: fim },
        agendamento: { status: { not: "CANCELADO" } },
        ...FILTRO_PAGO,
      },
      orderBy: { dataRecebimento: "asc" },
      include: { forma: true, agendamento: { include: { pet: { include: { cliente: true } } } } },
    }),
    // Pendências não têm recorte de dia: aparecem em toda visita ao Caixa, em
    // qualquer data, até alguém dar baixa.
    listarPendencias(),
    listarFormasAtivas(),
    // A SEGUNDA fonte de dinheiro do dia: venda de pacote, pelo valor cheio.
    prisma.pacote.findMany({
      where: { dataRecebimento: { gte: inicio, lt: fim } },
      orderBy: { dataRecebimento: "asc" },
      include: { forma: true, pet: { include: { cliente: true } } },
    }),
    // Venda cancelada tira o valor do caixa do dia em que ela entrou.
    prisma.pacoteEstorno.findMany({
      where: { data: { gte: inicio, lt: fim } },
      include: { forma: true, pacote: { include: { pet: true } } },
    }),
    // Dinheiro devolvido de atendimento, pela data da DEVOLUÇÃO — pode cair num
    // dia diferente do recebimento original, e é isso que mantém o dia de
    // ontem intacto quando a devolução acontece hoje.
    prisma.atendimentoEstorno.findMany({
      where: { data: { gte: inicio, lt: fim } },
      include: {
        forma: true,
        atendimento: {
          include: { agendamento: { include: { pet: { include: { cliente: true } } } } },
        },
      },
    }),
    // Banhos de pacote FEITOS hoje: serviço prestado sem receita no dia (o
    // dinheiro entrou na venda). Aparecem na lista, nunca no total.
    prisma.atendimento.findMany({
      where: {
        data: { gte: inicio, lt: fim },
        agendamento: { status: { not: "CANCELADO" } },
        consumoPacote: { isNot: null },
      },
      orderBy: { data: "asc" },
      include: {
        consumoPacote: { include: { pacote: { select: { banhosTotal: true } } } },
        agendamento: { include: { pet: { include: { cliente: true } } } },
      },
    }),
  ]);

  const totaisAvulso = somarRecebimentos(recebimentos);
  // As duas fontes somadas — disjuntas por construção, então somar não conta
  // nada duas vezes (ver o cabeçalho de `Pacote` no schema).
  const totaisPacotes = somarRecebimentos(
    pacotesVendidos.map((p) => ({ valorTotal: p.valorTotal, taxaBps: p.taxaBps })),
  );
  const totaisEstorno = somarRecebimentos(
    estornos.map((e) => ({ valorTotal: e.valor, taxaBps: e.taxaBps })),
  );
  // Devolução de atendimento: mesma mecânica do cancelamento de venda, e pela
  // mesma função, para os arredondamentos baterem com os do recebimento que ela
  // desfaz.
  const totaisEstornoAtendimento = somarRecebimentos(
    estornosAtendimento.map((e) => ({ valorTotal: e.valor, taxaBps: e.taxaBps })),
  );
  const totais = {
    bruto:
      totaisAvulso.bruto +
      totaisPacotes.bruto -
      totaisEstorno.bruto -
      totaisEstornoAtendimento.bruto,
    liquido:
      totaisAvulso.liquido +
      totaisPacotes.liquido -
      totaisEstorno.liquido -
      totaisEstornoAtendimento.liquido,
    taxas:
      totaisAvulso.taxas +
      totaisPacotes.taxas -
      totaisEstorno.taxas -
      totaisEstornoAtendimento.taxas,
    qtd: totaisAvulso.qtd + totaisPacotes.qtd,
    qtdSemTaxa: totaisAvulso.qtdSemTaxa + totaisPacotes.qtdSemTaxa,
  };
  const resumo = resumirPendencias(pendencias);

  // Quebra por forma, com bruto e líquido de cada. Ordem do cadastro, para o
  // resumo não reordenar sozinho conforme o dia vai enchendo.
  const porForma = new Map<string, { nome: string; ordem: number; bruto: number; liquido: number; qtd: number }>();
  // Venda de pacote passa pela MESMA maquininha, então entra no mesmo resumo.
  // O estorno entra com sinal negativo, para a quebra por forma continuar
  // batendo com o total do dia depois de um cancelamento.
  const movimentosDeForma = [
    ...recebimentos.map((a) => ({ forma: a.forma, valor: a.valorTotal, taxaBps: a.taxaBps, sinal: 1 })),
    ...pacotesVendidos.map((p) => ({ forma: p.forma, valor: p.valorTotal, taxaBps: p.taxaBps, sinal: 1 })),
    ...estornos.map((e) => ({ forma: e.forma, valor: e.valor, taxaBps: e.taxaBps, sinal: -1 })),
    ...estornosAtendimento.map((e) => ({
      forma: e.forma,
      valor: e.valor,
      taxaBps: e.taxaBps,
      sinal: -1,
    })),
  ];
  for (const m of movimentosDeForma) {
    if (!m.forma) continue;
    const v = valoresDoPagamento(m.valor, m.taxaBps);
    const linha = porForma.get(m.forma.id) ?? {
      nome: m.forma.nome,
      ordem: m.forma.ordem,
      bruto: 0,
      liquido: 0,
      qtd: 0,
    };
    linha.bruto += v.bruto * m.sinal;
    linha.liquido += v.liquido * m.sinal;
    linha.qtd += m.sinal;
    porForma.set(m.forma.id, linha);
  }
  const linhasForma = [...porForma.entries()]
    .map(([id, l]) => ({ id, ...l }))
    .sort((a, b) => a.ordem - b.ordem);

  const formasSelecionaveis = formas.map((f) => ({
    id: f.id,
    nome: f.nome,
    tipo: f.tipo,
    rotulo: f.rotulo,
    taxas: f.taxas.map((t) => ({ parcelas: t.parcelas, taxaBps: t.taxaBps })),
  }));

  return (
    <div className="flex flex-col gap-4 pb-64">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Caixa</h1>
        <p className="text-neutral-500">{formatDataExtenso(dataISO)}</p>
      </div>

      <DiaNav dataISO={dataISO} basePath="/caixa" />

      {/* Pendências primeiro, e fora do recorte do dia: é o que não pode
          escapar. Antes esta lista só mostrava as do dia na tela, então uma
          conta antiga só reaparecia se alguém navegasse até a data exata. */}
      {pendencias.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div>
              <h2 className="font-display font-bold text-amber-900">A receber</h2>
              <p className="text-xs text-amber-800">
                Todas as pendências em aberto, de qualquer data — não só as deste dia.
              </p>
            </div>
            <div className="text-right">
              <span className="font-display text-2xl font-extrabold tabular-nums text-amber-900">
                {formatCentavos(resumo.totalAReceber)}
              </span>
              {resumo.qtdSemValor > 0 && (
                <p className="text-xs text-amber-800">+ {resumo.qtdSemValor} sem valor definido</p>
              )}
            </div>
          </div>

          {resumo.diasMaisAntiga >= 30 && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />A mais antiga está
              aberta há {resumo.diasMaisAntiga} dias.
            </p>
          )}

          {pendencias.map((p) => (
            <PendenciaCard key={p.atendimentoId} pendencia={p} formas={formasSelecionaveis} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        {pendencias.length > 0 && (
          <h2 className="font-display font-bold text-neutral-900">Recebido neste dia</h2>
        )}
        {recebimentos.length === 0 &&
        pacotesVendidos.length === 0 &&
        estornos.length === 0 &&
        estornosAtendimento.length === 0 ? (
          <EmptyState message="Nenhum pagamento recebido neste dia." />
        ) : (
          recebimentos.map((a) => {
            const v = valoresDoPagamento(a.valorTotal, a.taxaBps);
            const parcelas = formatarParcelas(a.parcelas);
            // Recebimento atrasado: o atendimento é de outro dia. Precisa estar
            // dito na linha, senão o caixa parece ter um atendimento que não
            // aconteceu hoje.
            const atrasado = a.dataRecebimento
              ? dataISODe(a.dataRecebimento) !== dataISODe(a.data)
              : false;
            return (
              <Card key={a.id} className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-neutral-900">
                      {a.agendamento.pet.nome}
                    </p>
                    <p className="truncate text-sm text-neutral-500">
                      {a.agendamento.pet.cliente.nome}
                    </p>
                    <p className="text-sm text-neutral-600">{a.servicosRealizados}</p>
                    {/* Quem deu a baixa. É a pergunta que aparece quando um
                        valor no caixa parece errado. */}
                    <p className="text-xs text-neutral-500">
                      {comAutor("recebido por", a.recebidoPor)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display font-bold tabular-nums text-neutral-900">
                      {formatCentavos(v.bruto)}
                    </p>
                    <p className="text-xs text-neutral-500">bruto</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-neutral-100 pt-1.5">
                  <p className="text-sm text-neutral-500">
                    {a.forma?.nome ?? "—"}
                    {parcelas && <span className="text-neutral-400"> · {parcelas}</span>}
                    {atrasado && (
                      <span className="ml-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                        atendimento de {formatDataCurta(a.data)}
                      </span>
                    )}
                  </p>
                  {v.taxaDesconhecida ? (
                    <p className="text-sm text-amber-700">taxa não registrada</p>
                  ) : (
                    <p className="text-sm text-neutral-600 tabular-nums">
                      taxa {formatCentavos(v.taxa)}{" "}
                      <span className="text-neutral-400">({formatarTaxa(a.taxaBps)})</span> · líquido{" "}
                      <strong className="text-neutral-900">{formatCentavos(v.liquido)}</strong>
                    </p>
                  )}
                </div>
              </Card>
            );
          })
        )}

        {/* Venda de pacote: dinheiro do dia, pelo valor cheio. Fica na mesma
            lista dos outros recebimentos porque, para o caixa, é a mesma
            coisa — só a origem muda. */}
        {pacotesVendidos.map((p) => {
          const v = valoresDoPagamento(p.valorTotal, p.taxaBps);
          const parcelas = formatarParcelas(p.parcelas);
          return (
            <Card key={p.id} className="flex flex-col gap-1 border-brand-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-neutral-900">
                    <Ticket className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    {p.pet.nome}
                  </p>
                  <p className="truncate text-sm text-neutral-500">{p.pet.cliente.nome}</p>
                  <p className="text-sm font-medium text-brand-700">
                    Pacote de {p.banhosTotal} banhos
                  </p>
                  <p className="text-xs text-neutral-500">
                    {comAutor("vendido por", p.vendidoPor)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display font-bold tabular-nums text-neutral-900">
                    {formatCentavos(v.bruto)}
                  </p>
                  <p className="text-xs text-neutral-500">bruto</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-neutral-100 pt-1.5">
                <p className="text-sm text-neutral-500">
                  {p.forma?.nome ?? "—"}
                  {parcelas && <span className="text-neutral-400"> · {parcelas}</span>}
                </p>
                {v.taxaDesconhecida ? (
                  <p className="text-sm text-amber-700">taxa não registrada</p>
                ) : (
                  <p className="text-sm text-neutral-600 tabular-nums">
                    taxa {formatCentavos(v.taxa)}{" "}
                    <span className="text-neutral-400">({formatarTaxa(p.taxaBps)})</span> · líquido{" "}
                    <strong className="text-neutral-900">{formatCentavos(v.liquido)}</strong>
                  </p>
                )}
              </div>
            </Card>
          );
        })}

        {/* Cancelamento de venda: sai do caixa do dia do CANCELAMENTO (regime
            de caixa), e por isso pode aparecer num dia diferente do da venda.
            A data da venda vai na linha para o vínculo ficar visível. */}
        {estornos.map((e) => (
          <Card key={e.id} className="flex items-start justify-between gap-3 border-rose-200 bg-rose-50">
            <div className="min-w-0">
              <p className="truncate font-semibold text-rose-900">
                Venda cancelada — {e.pacote.pet.nome}
              </p>
              <p className="text-sm text-rose-700">
                pacote de {e.pacote.banhosTotal} banhos, vendido em{" "}
                {formatDataCurta(e.pacote.dataRecebimento)}
              </p>
              <p className="text-sm text-rose-700">
                por {e.feitoPor}
                {e.motivo && ` · ${e.motivo}`}
              </p>
            </div>
            <p className="shrink-0 font-display font-bold tabular-nums text-rose-900">
              − {formatCentavos(e.valor)}
            </p>
          </Card>
        ))}

        {/* Dinheiro devolvido ao cliente. Sai do caixa do dia da DEVOLUÇÃO, que
            pode não ser o do recebimento — por isso a data do atendimento vai
            na linha, igual ao cancelamento de venda logo acima. */}
        {estornosAtendimento.map((e) => (
          <Card
            key={e.id}
            className="flex items-start justify-between gap-3 border-rose-200 bg-rose-50"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-rose-900">
                Dinheiro devolvido — {e.atendimento.agendamento.pet.nome}
              </p>
              <p className="text-sm text-rose-700">
                {e.atendimento.servicosRealizados} · atendimento de{" "}
                {formatDataCurta(e.atendimento.data)}
              </p>
              <p className="text-sm text-rose-700">
                por {e.feitoPor}
                {e.motivo && ` · ${e.motivo}`}
              </p>
            </div>
            <p className="shrink-0 font-display font-bold tabular-nums text-rose-900">
              − {formatCentavos(e.valor)}
            </p>
          </Card>
        ))}
      </section>

      {/* Banhos de pacote feitos hoje: serviço prestado, receita já contada no
          dia da venda. Ficam FORA do total do dia de propósito — mas precisam
          aparecer, senão um dia cheio de pacote parece um dia vazio. */}
      {banhosDePacote.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display font-bold text-neutral-900">
            Banhos de pacote neste dia
          </h2>
          <p className="-mt-1 text-sm text-neutral-500">
            Já pagos na compra do pacote — não entram no total abaixo.
          </p>
          {banhosDePacote.map((a) => (
            <Card key={a.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-neutral-900">
                  {a.agendamento.pet.nome}
                </p>
                <p className="truncate text-sm text-neutral-500">
                  {a.agendamento.pet.cliente.nome} · {a.servicosRealizados}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                Banho {a.consumoPacote?.indice} de {a.consumoPacote?.pacote.banhosTotal}
              </span>
            </Card>
          ))}
        </section>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-br from-brand-600 to-brand-800 px-4 py-3 shadow-[0_-4px_16px_rgba(16,127,127,0.25)]">
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {/* Quebra por forma, com os dois números — é a resposta para "quanto
              caiu de cada bandeira". */}
          {linhasForma.length > 0 && (
            <div className="flex flex-col gap-0.5 border-b border-brand-500/40 pb-1.5">
              {linhasForma.map((l) => (
                <div key={l.id} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-brand-100">
                    {l.nome} <span className="text-brand-200">({l.qtd})</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-brand-100">
                    {formatCentavos(l.bruto)} <span className="text-brand-200">→</span>{" "}
                    <strong className="text-white">{formatCentavos(l.liquido)}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Rótulos sem ambiguidade: cada linha diz o que é. */}
          <div className="flex items-baseline justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-brand-100">
              <Wallet className="h-4 w-4" aria-hidden="true" /> Bruto do dia
            </span>
            <span className="font-display text-xl font-bold tabular-nums text-brand-50">
              {formatCentavos(totais.bruto)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-brand-100">Taxas</span>
            <span className="text-base font-bold tabular-nums text-brand-50">
              − {formatCentavos(totais.taxas)}
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t border-brand-500/40 pt-1">
            <span className="text-sm font-semibold text-white">Líquido do dia (entra na conta)</span>
            <span className="font-display text-3xl font-extrabold tabular-nums text-white">
              {formatCentavos(totais.liquido)}
            </span>
          </div>

          {totais.qtdSemTaxa > 0 && (
            <p className="text-xs text-accent-200">
              {totais.qtdSemTaxa}{" "}
              {totais.qtdSemTaxa === 1 ? "recebimento sem taxa registrada" : "recebimentos sem taxa registrada"}
              {" "}— contam com líquido igual ao bruto.
            </p>
          )}

          {/* As duas linhas abaixo têm recorte DIFERENTE do total acima (que é
              do dia): pendência não tem data de corte. Por isso o rótulo diz
              "no total" — sem isso os números pareceriam não fechar. */}
          {resumo.totalAReceber > 0 && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-accent-200">A receber no total</span>
              <span className="text-base font-bold tabular-nums text-accent-200">
                {formatCentavos(resumo.totalAReceber)}
              </span>
            </div>
          )}
          {resumo.qtdSemValor > 0 && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-accent-200">Sem valor definido</span>
              <span className="text-base font-bold tabular-nums text-accent-200">
                {resumo.qtdSemValor} {resumo.qtdSemValor === 1 ? "atendimento" : "atendimentos"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
