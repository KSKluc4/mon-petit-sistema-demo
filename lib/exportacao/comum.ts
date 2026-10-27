import { TIMEZONE } from "../datas";
import type { SituacaoAtendimento } from "../faturamento";

// Compartilhado entre o Excel e o PDF para os dois arquivos nunca discordarem
// num rótulo ou num arredondamento.

export const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  CREDITO: "Crédito",
  DEBITO: "Débito",
  OUTRO: "Outro",
};

export const SITUACAO_LABEL: Record<SituacaoAtendimento, string> = {
  PAGO: "Pago (no faturamento)",
  A_RECEBER: "A receber",
  SEM_VALOR: "Sem valor definido",
  // O banho saiu de um pacote pré-pago: serviço prestado, receita já contada no
  // dia em que o pacote foi vendido. Não é pendência nem faturamento daqui.
  PACOTE: "Pago no pacote",
  // O dinheiro foi devolvido ao cliente. O recebimento original continua
  // contando no período em que entrou — quem o desfaz é a linha de devolução,
  // na data DELA. Por isso "devolvido" e não "cancelado": nada foi apagado.
  ESTORNADO: "Devolvido ao cliente",
};

// Centavos (como o banco guarda) para reais (como a planilha soma).
export function reais(centavos: number): number {
  return centavos / 100;
}

// "01/08/2026" no fuso da loja — o servidor roda em UTC na Vercel, então
// formatar sem fixar o fuso jogaria atendimento do fim da noite para o dia
// seguinte.
export function dataLocal(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

// "R$ 1.234,56" para o PDF, que imprime texto e não célula numérica.
export function moeda(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100,
  );
}
