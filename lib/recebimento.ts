import "server-only";
import { prisma } from "./prisma";
import { ACOES, reaisNaDescricao, registrarAtividade } from "./atividade";
import type { Autor } from "./autoria";
import { dataISODe, hojeISO } from "./datas";
import { deArtigo } from "./genero";
import { PARCELAS_MAXIMAS } from "./pagamento";

/**
 * A ÚNICA escrita de recebimento do sistema.
 *
 * Três telas dão baixa (Caixa, ficha do agendamento e o fechamento do
 * atendimento), e todas passam por aqui — porque é aqui que a invariante do
 * schema é mantida:
 *
 *     formaId != null  <=>  dataRecebimento != null
 *
 * Se alguma tela gravasse a forma sozinha, o atendimento sairia da lista de
 * pendências (que filtra por forma nula) **sem entrar no faturamento** (que
 * filtra por data de recebimento): o dinheiro sumiria da conta sem deixar
 * rastro. Por isso os campos são escritos juntos, na mesma transação, e por
 * isso esta função não recebe `dataRecebimento` de fora.
 *
 * A TAXA é resolvida AQUI, no servidor, a partir de (forma, parcelas) — nunca
 * vem do cliente. E é gravada como snapshot em `Atendimento.taxaBps`: a dona
 * edita os percentuais quando a maquininha muda, e sem o snapshot isso
 * recalcularia todo o histórico.
 */
/**
 * Resolve forma + parcelas + taxa no SERVIDOR. Compartilhada entre o
 * recebimento de atendimento e a venda de pacote — os dois cobram do mesmo
 * jeito, e um segundo if/else aqui seria o caminho garantido para as duas
 * telas aplicarem taxas diferentes.
 *
 * A taxa NUNCA vem do formulário: senão o cliente escolheria a própria taxa.
 */
export async function resolverFormaETaxa(
  formaId: string,
  parcelasBrutas: number | null,
): Promise<{ error: string } | { forma: { id: string; tipo: string }; parcelas: number; taxaBps: number | null }> {
  if (!formaId) return { error: "Selecione a forma de pagamento." };

  const forma = await prisma.formaPagamento.findUnique({
    where: { id: formaId },
    include: { taxas: true },
  });
  if (!forma) return { error: "Forma de pagamento não encontrada." };
  // Formas legadas existem só para segurar o histórico — não podem ser
  // escolhidas numa venda nova.
  if (!forma.ativo) return { error: "Essa forma de pagamento está desativada." };

  // Só crédito parcela; qualquer outra coisa é sempre 1.
  const parcelas =
    forma.tipo === "CREDITO"
      ? Math.min(Math.max(Math.trunc(parcelasBrutas ?? 1), 1), PARCELAS_MAXIMAS)
      : 1;

  // Nulo aqui significa "forma sem taxa configurada" (a Amex, até a dona
  // informar os percentuais). Fica nulo mesmo — o líquido vira igual ao bruto e
  // a tela diz "não registrada", em vez de afirmar 0%.
  const taxaBps = forma.taxas.find((t) => t.parcelas === parcelas)?.taxaBps ?? null;

  return { forma: { id: forma.id, tipo: forma.tipo }, parcelas, taxaBps };
}

export async function registrarRecebimento(
  atendimentoId: string,
  formaId: string,
  parcelasBrutas: number | null,
  valorInformado: number | null,
  // Quem está dando a baixa. Gravado JUNTO da forma e da data, na mesma
  // transação — as três telas que recebem passam por aqui, então nenhuma
  // precisa lembrar de gravar autoria por conta própria.
  autor: Autor,
): Promise<{ error?: string }> {
  const resolvido = await resolverFormaETaxa(formaId, parcelasBrutas);
  if ("error" in resolvido) return { error: resolvido.error };
  const { forma, parcelas, taxaBps } = resolvido;

  const atendimento = await prisma.atendimento.findUnique({ where: { id: atendimentoId } });
  if (!atendimento) return { error: "Atendimento não encontrado." };

  // Já recebido: não sobrescreve. Dois toques no mesmo botão (ou dois aparelhos
  // no balcão) não podem mudar o dia em que o dinheiro entrou nem a taxa
  // aplicada — isso reescreveria um faturamento já fechado.
  if (atendimento.formaId && atendimento.dataRecebimento) {
    return { error: "Este atendimento já foi recebido." };
  }

  const valorTotal = valorInformado ?? atendimento.valorTotal;
  if (valorTotal === null) {
    return { error: "Informe o valor antes de registrar o recebimento." };
  }

  await prisma.$transaction([
    prisma.atendimento.update({
      where: { id: atendimentoId },
      data: {
        formaId: forma.id,
        parcelas: forma.tipo === "CREDITO" ? parcelas : null,
        taxaBps,
        valorTotal,
        dataRecebimento: new Date(),
        recebidoPor: autor.nome,
        recebidoPorId: autor.id,
      },
    }),
    // Espelha o valor no agendamento só para a ficha não exibir um número
    // diferente do que foi cobrado. Nenhuma conta de faturamento lê este campo.
    prisma.agendamento.update({
      where: { id: atendimento.agendamentoId },
      data: { valorTotal },
    }),
  ]);

  return {};
}

/**
 * CORRIGIR um recebimento digitado errado — o caso comum do balcão: ela digita
 * R$ 85 no lugar de R$ 58 e percebe meio minuto depois.
 *
 * ── POR QUE ISTO NÃO É UM ESTORNO ────────────────────────────────────────
 *
 * Estorno é dinheiro que VOLTOU. Registrar um erro de digitação como estorno
 * faria o sistema afirmar que "R$ 85 entraram e R$ 85 voltaram" — dois fatos
 * que nunca aconteceram, indo para a contabilidade como reais. É a mesma
 * recusa que impede valor nulo de virar R$ 0,00 e taxa nula de virar 0%: o
 * sistema não declara o que não sabe. Aqui ele sabe que só o número estava
 * errado, então conserta o número.
 *
 * ── POR QUE SÓ NO MESMO DIA ──────────────────────────────────────────────
 *
 * Esta função NÃO toca `dataRecebimento` — e é essa linha que a torna segura.
 * O dinheiro continua reconhecido no dia em que entrou; só o valor muda. Como
 * esse dia é hoje, nenhum período já fechado se mexe: o dia corrente ainda não
 * virou relatório.
 *
 * Recebimento de ontem para trás cai no caminho do estorno, pelo mesmo motivo
 * documentado no `PacoteEstorno`: corrigir lá atrás reescreveria um mês que a
 * contadora já recebeu, e esse é o único modo de falha sem conserto depois.
 */
export async function corrigirRecebimento(
  atendimentoId: string,
  formaId: string,
  parcelasBrutas: number | null,
  valorInformado: number | null,
  autor: Autor,
): Promise<{ error?: string }> {
  const atendimento = await prisma.atendimento.findUnique({
    where: { id: atendimentoId },
    include: {
      estornos: { select: { id: true } },
      forma: { select: { nome: true } },
      // Só para a descrição do registro citar o pet pelo nome: "do atendimento
      // da Mila" diz muito mais do que um id no meio de uma lista.
      agendamento: { include: { pet: { select: { nome: true, sexo: true } } } },
    },
  });
  if (!atendimento) return { error: "Atendimento não encontrado." };

  // Sem recebimento não há o que corrigir: quem registra a primeira vez é
  // `registrarRecebimento`, e ele é que mantém a invariante.
  if (!atendimento.formaId || !atendimento.dataRecebimento) {
    return { error: "Este atendimento ainda não foi recebido." };
  }
  if (atendimento.estornos.length > 0) {
    return { error: "O dinheiro deste atendimento já foi devolvido." };
  }
  if (dataISODe(atendimento.dataRecebimento) !== hojeISO()) {
    return {
      error:
        "Este pagamento é de outro dia e não pode mais ser alterado — mudar o valor agora recalcularia um período já fechado. Se você devolveu o dinheiro, use “Devolver dinheiro”.",
    };
  }

  if (valorInformado === null) {
    return { error: "Informe o valor do atendimento." };
  }

  const resolvido = await resolverFormaETaxa(formaId, parcelasBrutas);
  if ("error" in resolvido) return { error: resolvido.error };
  const { forma, parcelas, taxaBps } = resolvido;

  const formaNova = await prisma.formaPagamento.findUnique({
    where: { id: forma.id },
    select: { nome: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.atendimento.update({
      where: { id: atendimentoId },
      data: {
        formaId: forma.id,
        parcelas: forma.tipo === "CREDITO" ? parcelas : null,
        // Taxa re-resolvida no servidor a partir de (forma, parcelas) — nunca
        // vem do formulário, senão o cliente escolheria a própria taxa. O
        // snapshot é reescrito porque a forma pode ter mudado na correção.
        taxaBps,
        valorTotal: valorInformado,
        // `dataRecebimento` fica de fora DE PROPÓSITO. Ver o cabeçalho.
        //
        // `recebidoPor` também: quem recebeu o dinheiro foi quem recebeu, e uma
        // correção feita pela outra pessoa não muda esse fato. Quem corrigiu é
        // outro evento — e é este registro aqui embaixo.
      },
    });
    await tx.agendamento.update({
      where: { id: atendimento.agendamentoId },
      data: { valorTotal: valorInformado },
    });
    // O antes→depois é o ponto: "corrigiu o pagamento" não ajuda ninguém;
    // "R$ 85,00 → R$ 58,00" responde a pergunta que fez alguém abrir a tela.
    await registrarAtividade(tx, {
      autor,
      acao: ACOES.PAGAMENTO_CORRIGIDO,
      entidade: "Atendimento",
      entidadeId: atendimentoId,
      descricao:
        `Corrigiu o pagamento do atendimento ` +
        `${deArtigo(atendimento.agendamento.pet.nome, atendimento.agendamento.pet.sexo)}: ` +
        `${reaisNaDescricao(atendimento.valorTotal)} → ${reaisNaDescricao(valorInformado)}` +
        (atendimento.formaId !== forma.id
          ? `, ${atendimento.forma?.nome ?? "sem forma"} → ${formaNova?.nome ?? "—"}`
          : ""),
      antes: {
        valorTotal: atendimento.valorTotal,
        formaId: atendimento.formaId,
        formaNome: atendimento.forma?.nome ?? null,
        parcelas: atendimento.parcelas,
        taxaBps: atendimento.taxaBps,
      },
      depois: {
        valorTotal: valorInformado,
        formaId: forma.id,
        formaNome: formaNova?.nome ?? null,
        parcelas: forma.tipo === "CREDITO" ? parcelas : null,
        taxaBps,
      },
    });
  });

  return {};
}

/**
 * DEVOLVER o dinheiro ao cliente. Grava uma linha nova em vez de mexer no
 * recebimento original — mesma disciplina do `PacoteEstorno`.
 *
 * A `data` é a de HOJE, o dia em que o dinheiro saiu, nunca a do recebimento:
 * devolver no mesmo dia se anula sozinho; devolver no mês seguinte deixa
 * intacto o mês que a contadora já recebeu.
 *
 * Isto substitui o `atendimento.deleteMany` que o "Voltar uma etapa" fazia até
 * 05/08/2026, e que apagava o recebimento junto — mudando o faturamento de um
 * período fechado sem deixar rastro nenhum.
 */
export async function estornarRecebimento(
  atendimentoId: string,
  autor: Autor,
  motivo?: string | null,
): Promise<{ error?: string }> {
  const atendimento = await prisma.atendimento.findUnique({
    where: { id: atendimentoId },
    include: { estornos: { select: { id: true } } },
  });
  if (!atendimento) return { error: "Atendimento não encontrado." };

  if (!atendimento.formaId || !atendimento.dataRecebimento) {
    return { error: "Este atendimento não tem pagamento registrado — não há o que devolver." };
  }
  // Dois toques no botão não podem devolver duas vezes.
  if (atendimento.estornos.length > 0) {
    return { error: "O dinheiro deste atendimento já foi devolvido." };
  }
  // Visita de pacote sem extra: o dinheiro entrou na venda do pacote, e é lá
  // que ele se cancela (`cancelarVendaPacote`). Aqui não há valor nenhum.
  if (!atendimento.valorTotal || atendimento.valorTotal <= 0) {
    return { error: "Este atendimento não tem valor a devolver." };
  }

  await prisma.atendimentoEstorno.create({
    data: {
      atendimentoId,
      valor: atendimento.valorTotal,
      // Hoje, e não `atendimento.dataRecebimento`: ver o cabeçalho.
      data: new Date(),
      // Snapshot da taxa da venda, para o líquido voltar junto com o bruto.
      taxaBps: atendimento.taxaBps,
      formaId: atendimento.formaId,
      motivo: motivo?.trim() || null,
      feitoPor: autor.nome,
      feitoPorId: autor.id,
    },
  });

  return {};
}

// Centavos vindos de um formulário. String vazia = "não informado" (null), não
// zero: valor nulo é "a definir" e nunca R$ 0,00 (CLAUDE.md).
export function lerCentavos(bruto: FormDataEntryValue | null): number | null {
  const texto = String(bruto ?? "").trim();
  if (!texto) return null;
  const centavos = Number(texto);
  if (!Number.isInteger(centavos) || centavos < 0) return null;
  return centavos;
}

/** Parcelas vindas do formulário. Fora da faixa vira "à vista". */
export function lerParcelas(bruto: FormDataEntryValue | null): number {
  const n = Number(String(bruto ?? "").trim());
  if (!Number.isInteger(n) || n < 1 || n > PARCELAS_MAXIMAS) return 1;
  return n;
}

/** As formas que o seletor mostra, já com as taxas, na ordem de exibição. */
export function listarFormasAtivas() {
  return prisma.formaPagamento.findMany({
    where: { ativo: true },
    include: { taxas: true },
    orderBy: { ordem: "asc" },
  });
}
