"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { cancelarVendaPacote, venderPacote } from "@/lib/pacotes";
import { lerCentavos, lerParcelas } from "@/lib/recebimento";

export type VenderPacoteState = { error?: string; ok?: boolean };

/**
 * Vende um pacote para o pet. O dinheiro entra no Caixa do dia da venda, pelo
 * valor cheio — regime de caixa, igual ao resto do sistema.
 *
 * A conta em si (validade, taxa, snapshot) mora em `lib/pacotes.ts`; aqui só
 * traduz o formulário.
 */
export async function venderPacoteAction(
  petId: string,
  _prev: VenderPacoteState,
  formData: FormData,
): Promise<VenderPacoteState> {
  const session = await requireSession();

  const { error } = await venderPacote({
    petId,
    banhosTotal: Number(formData.get("banhosTotal") ?? 0),
    valorTotal: lerCentavos(formData.get("valorTotal")),
    formaId: String(formData.get("formaId") ?? ""),
    parcelas: lerParcelas(formData.get("parcelas")),
    observacoes: String(formData.get("observacoes") ?? ""),
    vendidoPor: { nome: session.nome, id: session.sub },
  });
  if (error) return { error };

  revalidatePath(`/pets/${petId}`);
  // A venda é faturamento do dia: Caixa, Dashboard e Relatórios mudam na hora.
  revalidatePath("/caixa");
  revalidatePath("/");
  revalidatePath("/relatorios");
  return { ok: true };
}

export type CancelarPacoteState = { error?: string; ok?: boolean };

/**
 * Cancela uma venda registrada errado — só enquanto nenhum banho foi usado.
 * Grava um estorno de 100% na data da venda, tirando a receita do dia em que
 * ela entrou.
 */
export async function cancelarPacoteAction(
  pacoteId: string,
  petId: string,
  _prev: CancelarPacoteState,
  formData: FormData,
): Promise<CancelarPacoteState> {
  const session = await requireSession();

  const { error } = await cancelarVendaPacote(
    pacoteId,
    { nome: session.nome, id: session.sub },
    String(formData.get("motivo") ?? ""),
  );
  if (error) return { error };

  revalidatePath(`/pets/${petId}`);
  revalidatePath("/caixa");
  revalidatePath("/");
  revalidatePath("/relatorios");
  return { ok: true };
}
