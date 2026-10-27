"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ACOES, registrarAtividade, taxaNaDescricao } from "@/lib/atividade";
import { prisma } from "@/lib/prisma";

export type TaxasFormState = { error?: string; salvo?: boolean };

/**
 * Percentual digitado ("3,39", "3.39", "") para pontos-base (339).
 *
 * String vazia vira NULO, não zero: "não configurada" e "zero por cento" são
 * coisas diferentes — a Amex nasce nula até a dona informar os valores, e um 0
 * ali afirmaria que a taxa é zero. Mesmo princípio de `valorTotal` nulo nunca
 * virar R$ 0,00.
 */
function lerBps(bruto: FormDataEntryValue | null): number | null | undefined {
  const texto = String(bruto ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto.replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0 || numero > 100) return undefined; // inválido
  return Math.round(numero * 100);
}

/**
 * Salva os percentuais da tela de taxas.
 *
 * Só mexe na TABELA de taxas — nunca nos atendimentos já registrados. O
 * `Atendimento.taxaBps` é um snapshot do dia da venda justamente para que
 * mudar a taxa hoje não recalcule o histórico (ver lib/recebimento.ts).
 */
export async function salvarTaxasAction(
  _prevState: TaxasFormState,
  formData: FormData,
): Promise<TaxasFormState> {
  const session = await requireSession();

  const taxas = await prisma.taxaFormaPagamento.findMany({
    include: { forma: true },
  });

  // O `antes` é guardado junto porque esta linha é SOBRESCRITA no lugar: sem o
  // registro, o percentual antigo fica irrecuperável. Os atendimentos guardam o
  // snapshot deles (`Atendimento.taxaBps`), mas a tabela, não — então "por que
  // o líquido de setembro está diferente?" viraria pergunta sem resposta.
  const atualizacoes: {
    id: string;
    taxaBps: number | null;
    antes: number | null;
    formaNome: string;
    parcelas: number;
  }[] = [];
  for (const taxa of taxas) {
    // Forma legada não aparece na tela; ignora qualquer coisa que venha por ela.
    if (taxa.forma.legado) continue;
    const campo = formData.get(`taxa-${taxa.id}`);
    // Campo ausente = a tela não mostrou esta linha; não mexe.
    if (campo === null) continue;
    const bps = lerBps(campo);
    if (bps === undefined) {
      return { error: `Percentual inválido em ${taxa.forma.nome}. Use algo como 3,39.` };
    }
    if (bps !== taxa.taxaBps) {
      atualizacoes.push({
        id: taxa.id,
        taxaBps: bps,
        antes: taxa.taxaBps,
        formaNome: taxa.forma.nome,
        parcelas: taxa.parcelas,
      });
    }
  }

  if (atualizacoes.length > 0) {
    // Update e registro na mesma transação — o percentual antigo só existe aqui.
    await prisma.$transaction(async (tx) => {
      for (const u of atualizacoes) {
        await tx.taxaFormaPagamento.update({
          where: { id: u.id },
          data: { taxaBps: u.taxaBps },
        });
        const emQuantasVezes = u.parcelas > 1 ? ` em ${u.parcelas}x` : "";
        await registrarAtividade(tx, {
          autor: { nome: session.nome, id: session.sub },
          acao: ACOES.TAXA_ALTERADA,
          entidade: "TaxaFormaPagamento",
          entidadeId: u.id,
          descricao:
            `Alterou a taxa de ${u.formaNome}${emQuantasVezes}: ` +
            `${taxaNaDescricao(u.antes)} → ${taxaNaDescricao(u.taxaBps)}`,
          antes: { taxaBps: u.antes },
          depois: { taxaBps: u.taxaBps },
        });
      }
    });
  }

  // As telas de pagamento leem as taxas para a prévia do líquido.
  revalidatePath("/formas-pagamento");
  revalidatePath("/caixa");
  return { salvo: true };
}
