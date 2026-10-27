import type { TipoPagamento } from "@/app/generated/prisma/client";

/**
 * Bruto, taxa e líquido — a conta que decide quanto realmente cai na conta.
 *
 * Sem "server-only": o formulário de fechamento mostra o líquido antes de
 * confirmar, e precisa da mesma conta que o Caixa e o Relatório fazem.
 *
 * A taxa vem em PONTOS-BASE (339 = 3,39%), inteiro pelo mesmo motivo que
 * dinheiro é centavo: ponto flutuante não entra em conta que vai para a
 * contabilidade.
 */

export const PARCELAS_MAXIMAS = 4;

/**
 * O que o seletor precisa saber de uma forma. Tipo próprio (e não o do Prisma)
 * porque isto atravessa a fronteira servidor → componente de cliente.
 */
export type FormaSelecionavel = {
  id: string;
  nome: string;
  tipo: TipoPagamento;
  rotulo: string;
  taxas: { parcelas: number; taxaBps: number | null }[];
};

/** A taxa de uma forma para um dado parcelamento. Nula = não configurada. */
export function taxaDaForma(forma: FormaSelecionavel, parcelas: number): number | null {
  return forma.taxas.find((t) => t.parcelas === parcelas)?.taxaBps ?? null;
}

export type ValoresPagamento = {
  /** O que o cliente pagou. É sempre o valor digitado. */
  bruto: number;
  /** Quanto a maquininha ficou. Zero quando não há taxa. */
  taxa: number;
  /** O que entra na conta: bruto - taxa. */
  liquido: number;
  /**
   * `true` quando a taxa é DESCONHECIDA (pagamento anterior ao controle de
   * taxas, ou forma ainda não configurada). Nesse caso líquido = bruto, mas a
   * tela precisa dizer "não registrada" em vez de "0,00%" — senão desconhecido
   * vira uma afirmação falsa.
   */
  taxaDesconhecida: boolean;
};

/**
 * A ÚNICA conta de líquido do sistema. Fechamento, Caixa, Dashboard, Relatórios
 * e as exportações chamam esta função — é o mesmo motivo de
 * `classificarAtendimento` existir: dois arredondamentos diferentes fariam o
 * fechamento do mês não bater com a soma das linhas.
 *
 * O líquido é DERIVADO, nunca guardado. `valorTotal` é editável na hora de
 * receber (o cliente pode acertar outro valor), e um líquido gravado viraria um
 * segundo número para manter em sincronia.
 */
export function valoresDoPagamento(
  valorTotal: number | null,
  taxaBps: number | null | undefined,
): ValoresPagamento {
  const bruto = valorTotal ?? 0;
  if (taxaBps === null || taxaBps === undefined) {
    return { bruto, taxa: 0, liquido: bruto, taxaDesconhecida: true };
  }
  // Arredonda ao centavo, uma vez só, aqui.
  const taxa = Math.round((bruto * taxaBps) / 10000);
  return { bruto, taxa, liquido: bruto - taxa, taxaDesconhecida: false };
}

/** "3,39%" · "—" quando a taxa não é conhecida. */
export function formatarTaxa(taxaBps: number | null | undefined): string {
  if (taxaBps === null || taxaBps === undefined) return "—";
  return `${(taxaBps / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

/** "à vista" · "2x" — usado ao lado da forma no histórico e nos relatórios. */
export function formatarParcelas(parcelas: number | null | undefined): string | null {
  if (!parcelas || parcelas <= 1) return null;
  return `${parcelas}x`;
}

/** Só crédito parcela; o resto é sempre à vista. */
export function permiteParcelamento(tipo: TipoPagamento): boolean {
  return tipo === "CREDITO";
}

export const TIPO_LABEL: Record<TipoPagamento, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  DEBITO: "Débito",
  CREDITO: "Crédito",
};

// Ordem dos grupos no seletor: do mais usado no balcão para o menos.
export const ORDEM_TIPOS: TipoPagamento[] = ["DINHEIRO", "PIX", "DEBITO", "CREDITO"];
