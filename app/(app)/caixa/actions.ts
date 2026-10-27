"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { lerCentavos, lerParcelas, registrarRecebimento } from "@/lib/recebimento";

export type PagamentoCaixaState = { error?: string };

/**
 * Dar baixa numa pendência pela lista do Caixa.
 *
 * O valor vem sempre no formulário (pré-preenchido e editável): o cliente pode
 * acertar um valor diferente do combinado, e quem manda no caixa é o que
 * entrou. `registrarRecebimento` é quem grava — inclusive a data do recebimento
 * (regime de caixa) e o snapshot da taxa da forma escolhida.
 */
export async function registrarPagamentoCaixaAction(
  atendimentoId: string,
  _prevState: PagamentoCaixaState,
  formData: FormData,
): Promise<PagamentoCaixaState> {
  const session = await requireSession();

  const { error } = await registrarRecebimento(
    atendimentoId,
    String(formData.get("formaId") ?? ""),
    lerParcelas(formData.get("parcelas")),
    lerCentavos(formData.get("valorTotal")),
    { nome: session.nome, id: session.sub },
  );
  if (error) return { error };

  // O dinheiro entrou hoje: o caixa de hoje, o dashboard e os relatórios mudam.
  revalidatePath("/caixa");
  revalidatePath("/");
  revalidatePath("/relatorios");
  return {};
}
