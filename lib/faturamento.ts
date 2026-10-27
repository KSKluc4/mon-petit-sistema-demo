import "server-only";
import { prisma } from "./prisma";
import { dataISODe, diasEntre, hojeISO, intervaloDaSemana, intervaloDoDia, intervaloDoMes } from "./datas";
import { valoresDoPagamento } from "./pagamento";
import { faturamentoPacotesDoIntervalo } from "./pacotes";
import type { Sexo } from "@/app/generated/prisma/client";

// As situações possíveis de um atendimento fechado. Ordem de precedência:
// pacote ganha de tudo (o dinheiro já entrou na venda do pacote), depois sem
// valor — porque valor nulo é "a definir" e nunca R$ 0,00 (CLAUDE.md → "valor
// livre por atendimento").
export type SituacaoAtendimento = "PAGO" | "A_RECEBER" | "SEM_VALOR" | "PACOTE" | "ESTORNADO";

/**
 * A regra de contagem do sistema, num lugar só.
 *
 * Só vira faturamento o atendimento que tem valor definido **e** forma de
 * pagamento registrada. Caixa, Dashboard e Relatórios chamam esta função em vez
 * de repetir o if/else — foi por dividir essa lógica que os três nunca
 * divergiram, e é o motivo de este arquivo existir.
 *
 * `usouPacote` entrou em 03/08/2026 e NÃO é enfeite: sem ele, uma visita de
 * pacote sem extra (forma nula, valor 0) cairia em A_RECEBER e viraria uma
 * pendência ETERNA no Caixa, no Dashboard e na ficha do pet — cobrando um
 * dinheiro que já entrou na venda do pacote.
 *
 * Com extra ainda por pagar, a visita é pendência de verdade (do extra), e por
 * isso o pacote só ganha quando não há extra nenhum.
 */
export function classificarAtendimento(
  valorTotal: number | null,
  formaId: string | null,
  usouPacote = false,
  estornado = false,
): SituacaoAtendimento {
  // Pacote sem extra: nada a receber. O valor do banho está no `Pacote`.
  if (usouPacote && (valorTotal ?? 0) === 0) return "PACOTE";
  // Dinheiro devolvido ao cliente (05/08/2026). Ganha de PAGO porque a tela
  // precisa dizer "devolvido", não "pago" — mas cuidado com o que isto NÃO
  // significa: o atendimento continua entrando na consulta de faturamento pelo
  // valor cheio, e quem tira o dinheiro é a linha de estorno, na data DELA.
  // Ver `estornosAtendimentoDoIntervalo` logo abaixo.
  if (estornado) return "ESTORNADO";
  if (valorTotal === null) return "SEM_VALOR";
  return formaId ? "PAGO" : "A_RECEBER";
}

/**
 * REGIME DE CAIXA — a segunda regra de contagem, decidida em 02/08/2026.
 *
 * O faturamento conta pela data em que o dinheiro ENTROU
 * (`Atendimento.dataRecebimento`), não pela data em que o atendimento foi feito
 * (`Atendimento.data`). As duas só diferem quando o atendimento foi fechado com
 * "Receber depois" e o pagamento veio noutro dia.
 *
 * Por que caixa e não competência: pela competência, receber hoje uma pendência
 * de julho **mudaria retroativamente** o faturamento de julho — e o relatório
 * que já foi exportado e mandado para a contadora deixaria de bater com o
 * sistema, sem nada explicando a diferença. Pelo caixa, período fechado nunca
 * mais muda. O custo é conhecido e está escrito na tela: um atendimento de
 * julho recebido em agosto aparece no faturamento de agosto.
 *
 * O que impede o valor de ser contado duas vezes é a invariante declarada no
 * schema: `formaId != null <=> dataRecebimento != null`. Como o dinheiro
 * tem UMA data só, e toda consulta de faturamento filtra por ela, nenhum
 * atendimento pode cair em dois períodos. **Quem gravar a forma sem
 * gravar `dataRecebimento` (ou o contrário) quebra a conta em silêncio** — os
 * dois campos são sempre escritos juntos, na mesma transação.
 */
export const FILTRO_PAGO = { formaId: { not: null }, valorTotal: { not: null } } as const;

export type ResumoFaturamento = {
  /** O que os clientes pagaram, no período — pela data do recebimento. */
  bruto: number;
  /** O que entra na conta: bruto menos as taxas da maquininha. */
  liquido: number;
  /** Quanto ficou em taxa. */
  taxas: number;
  /** Quantos recebimentos compõem esses totais. */
  qtd: number;
  /**
   * A separação das DUAS fontes de dinheiro do sistema (03/08/2026). `bruto`
   * acima é a soma das duas — elas são disjuntas por construção, então somar
   * não conta nada duas vezes (ver o cabeçalho de `Pacote` no schema).
   */
  brutoAvulso: number;
  /** Vendas de pacote, já descontados os estornos do período. */
  brutoPacotes: number;
  /** Dinheiro devolvido de atendimento no período — já subtraído dos totais. */
  estornadoAvulso: number;
  qtdEstornosAvulso: number;
  /**
   * Quantos recebimentos têm taxa desconhecida (registro anterior ao controle
   * de taxas, ou forma sem taxa configurada). Neles o líquido foi contado igual
   * ao bruto — a tela precisa dizer isso em vez de fingir que a taxa foi zero.
   */
  qtdSemTaxa: number;
};

/**
 * Soma o que entrou de dinheiro no intervalo. Compartilhado entre Caixa,
 * Dashboard e Relatórios para os três nunca divergirem.
 *
 * DUAS FONTES desde 03/08/2026: atendimento avulso e venda de pacote. Elas são
 * disjuntas por construção — o valor do pacote vive só em `Pacote.valorTotal`,
 * e um atendimento que usa pacote carrega no máximo o extra do dia. Por isso
 * somar as duas não conta nada duas vezes.
 *
 * A visita de pacote em si não entra aqui: ela tem `formaId` nulo e é barrada
 * pelo `FILTRO_PAGO`. Ela aparece na CONTAGEM de atendimentos realizados, que é
 * outra conta — serviço prestado sem receita naquele dia.
 */
/**
 * Dinheiro DEVOLVIDO de atendimento no intervalo, pela data do estorno.
 *
 * ── POR QUE SUBTRAIR, E NÃO EXCLUIR O ATENDIMENTO ────────────────────────
 *
 * A tentação é filtrar os atendimentos estornados para fora da consulta de
 * faturamento. Isso estaria ERRADO, e do jeito mais caro: um recebimento de
 * agosto devolvido em setembro sumiria **retroativamente do faturamento de
 * agosto** — o mês que a contadora já recebeu deixaria de bater com o sistema,
 * que é exatamente o modo de falha que o regime de caixa existe para evitar.
 *
 * Então o atendimento continua contando pelo valor cheio na data em que o
 * dinheiro entrou, e o estorno subtrai na data em que o dinheiro saiu. Cada
 * período fica com o que de fato aconteceu nele. Devolver no mesmo dia se anula
 * sozinho; devolver no mês seguinte lança a saída no mês seguinte.
 *
 * É a mesma mecânica de `faturamentoPacotesDoIntervalo`, e por isso a taxa vem
 * junto: o estorno devolve bruto E líquido com a taxa aplicada na venda, senão
 * devolver o dinheiro deixaria a taxa pendurada no relatório.
 */
export async function estornosAtendimentoDoIntervalo(
  inicio: Date,
  fim: Date,
): Promise<{ bruto: number; liquido: number; taxas: number; qtd: number }> {
  const estornos = await prisma.atendimentoEstorno.findMany({
    where: { data: { gte: inicio, lt: fim } },
    select: { valor: true, taxaBps: true },
  });

  let bruto = 0;
  let liquido = 0;
  let taxas = 0;
  for (const e of estornos) {
    const v = valoresDoPagamento(e.valor, e.taxaBps);
    bruto += v.bruto;
    liquido += v.liquido;
    taxas += v.taxa;
  }
  return { bruto, liquido, taxas, qtd: estornos.length };
}

export async function faturamentoDoIntervalo(inicio: Date, fim: Date): Promise<ResumoFaturamento> {
  const [recebimentos, pacotes, estornos] = await Promise.all([
    prisma.atendimento.findMany({
      // Um agendamento cancelado não chega a gerar Atendimento, mas o filtro
      // deixa a regra explícita e protege registros antigos/inconsistentes.
      //
      // Atendimento estornado NÃO é excluído aqui, de propósito — quem tira o
      // dinheiro é a consulta de estornos, na data da devolução. Ver o
      // cabeçalho de `estornosAtendimentoDoIntervalo`.
      where: {
        dataRecebimento: { gte: inicio, lt: fim },
        agendamento: { status: { not: "CANCELADO" } },
        ...FILTRO_PAGO,
      },
      select: { valorTotal: true, taxaBps: true },
    }),
    faturamentoPacotesDoIntervalo(inicio, fim),
    estornosAtendimentoDoIntervalo(inicio, fim),
  ]);

  const avulso = somarRecebimentos(recebimentos);
  return {
    bruto: avulso.bruto + pacotes.bruto - estornos.bruto,
    liquido: avulso.liquido + pacotes.liquido - estornos.liquido,
    taxas: avulso.taxas + pacotes.taxas - estornos.taxas,
    qtd: avulso.qtd + pacotes.qtd,
    qtdSemTaxa: avulso.qtdSemTaxa + pacotes.qtdSemTaxa,
    brutoAvulso: avulso.bruto - estornos.bruto,
    brutoPacotes: pacotes.bruto,
    estornadoAvulso: estornos.bruto,
    qtdEstornosAvulso: estornos.qtd,
  };
}

/** Bruto/líquido/taxas de uma lista de recebimentos. Um lugar só, para as três
 *  telas não arredondarem diferente. */
export function somarRecebimentos(
  recebimentos: { valorTotal: number | null; taxaBps: number | null }[],
): ResumoFaturamento {
  let bruto = 0;
  let liquido = 0;
  let taxas = 0;
  let qtdSemTaxa = 0;
  for (const r of recebimentos) {
    const v = valoresDoPagamento(r.valorTotal, r.taxaBps);
    bruto += v.bruto;
    liquido += v.liquido;
    taxas += v.taxa;
    if (v.taxaDesconhecida) qtdSemTaxa++;
  }
  // Sozinha, esta função só enxerga a fonte "avulso" — quem junta as duas é
  // `faturamentoDoIntervalo`. Por isso `brutoPacotes` e os estornos saem
  // zerados aqui: ela soma a lista que recebeu, sem consultar nada.
  return {
    bruto,
    liquido,
    taxas,
    qtd: recebimentos.length,
    qtdSemTaxa,
    brutoAvulso: bruto,
    brutoPacotes: 0,
    estornadoAvulso: 0,
    qtdEstornosAvulso: 0,
  };
}

export function faturamentoDoDia(dataISO: string): Promise<ResumoFaturamento> {
  const { inicio, fim } = intervaloDoDia(dataISO);
  return faturamentoDoIntervalo(inicio, fim);
}

// Semana corrente: segunda a domingo.
export function faturamentoDaSemana(dataISO: string): Promise<ResumoFaturamento> {
  const { inicio, fim } = intervaloDaSemana(dataISO);
  return faturamentoDoIntervalo(inicio, fim);
}

// Mês corrente: dia 1 até o fim do dia informado.
export function faturamentoDoMes(dataISO: string): Promise<ResumoFaturamento> {
  const { inicio, fim } = intervaloDoMes(dataISO);
  return faturamentoDoIntervalo(inicio, fim);
}

// --- Pendências ---
//
// Pendência NÃO tem recorte de dia, de propósito. Antes de 02/08/2026 o Caixa
// só listava as pendências do dia que estava na tela, então uma conta em aberto
// desde julho ficava invisível a menos que alguém navegasse de volta até a data
// exata — era o jeito garantido de nunca mais ser cobrada. Toda pendência
// aberta aparece em toda visita ao Caixa, até alguém dar baixa.

export type Pendencia = {
  atendimentoId: string;
  agendamentoId: string;
  petId: string;
  petNome: string;
  // A mensagem de cobrança cita o pet pelo nome, então precisa concordar gênero
  // (CLAUDE.md → "Concordância de gênero").
  petSexo: Sexo;
  tutorNome: string;
  telefone: string;
  servicos: string;
  valorTotal: number | null;
  data: Date;
  // Há quantos dias está em aberto, contados no fuso da loja.
  diasEmAberto: number;
};

// Todas as pendências em aberto, da mais antiga para a mais recente — a ordem
// de cobrança. `formaId: null` é a definição de "em aberto" e cobre os
// dois casos: valor definido esperando pagamento e valor ainda a definir.
export async function listarPendencias(): Promise<Pendencia[]> {
  const abertos = await prisma.atendimento.findMany({
    where: {
      formaId: null,
      agendamento: { status: { not: "CANCELADO" } },
    },
    orderBy: { data: "asc" },
    include: {
      // Vem junto para o filtro abaixo: visita de pacote sem extra também tem
      // `formaId` nulo, mas não é pendência.
      consumoPacote: { select: { id: true } },
      agendamento: { include: { pet: { include: { cliente: true } } } },
    },
  });

  const hoje = hojeISO();
  // Tira as visitas pagas pelo pacote. Quem decide é `classificarAtendimento`, e
  // não um `if` repetido aqui — dois lugares definindo o que é pendência é como
  // Caixa e Relatório passam a divergir. Sem este filtro, todo banho de pacote
  // viraria uma cobrança eterna no Caixa.
  const pendentes = abertos.filter(
    (a) => classificarAtendimento(a.valorTotal, a.formaId, a.consumoPacote !== null) !== "PACOTE",
  );

  return pendentes.map((a) => ({
    atendimentoId: a.id,
    agendamentoId: a.agendamentoId,
    petId: a.agendamento.pet.id,
    petNome: a.agendamento.pet.nome,
    petSexo: a.agendamento.pet.sexo,
    tutorNome: a.agendamento.pet.cliente.nome,
    telefone: a.agendamento.pet.cliente.telefone,
    servicos: a.servicosRealizados,
    valorTotal: a.valorTotal,
    data: a.data,
    diasEmAberto: diasEntre(dataISODe(a.data), hoje),
  }));
}

export type ResumoPendencias = {
  // Com valor definido, só esperando o pagamento — dá para somar.
  qtdAReceber: number;
  totalAReceber: number;
  // Sem valor definido: existe a pendência, mas o total dela é desconhecido.
  // Contado à parte de propósito, para nunca virar R$ 0,00 no total acima.
  qtdSemValor: number;
  // Dias da pendência mais antiga — é o número que justifica o alerta.
  diasMaisAntiga: number;
};

export function resumirPendencias(pendencias: Pendencia[]): ResumoPendencias {
  const aReceber = pendencias.filter((p) => p.valorTotal !== null);
  return {
    qtdAReceber: aReceber.length,
    totalAReceber: aReceber.reduce((s, p) => s + (p.valorTotal ?? 0), 0),
    qtdSemValor: pendencias.length - aReceber.length,
    diasMaisAntiga: pendencias.reduce((max, p) => Math.max(max, p.diasEmAberto), 0),
  };
}

// Atalho para quem só precisa dos números (Dashboard).
export async function resumoPendencias(): Promise<ResumoPendencias> {
  return resumirPendencias(await listarPendencias());
}
