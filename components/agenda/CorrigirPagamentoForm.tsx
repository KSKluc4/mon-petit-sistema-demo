"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ValorInput } from "@/components/ui/ValorInput";
import {
  corrigirPagamentoAction,
  type CorrigirPagamentoState,
} from "@/app/(app)/agendamentos/actions";
import type { FormaSelecionavel } from "@/lib/pagamento";
import { FormaPagamentoPicker } from "./FormaPagamentoPicker";

const initialState: CorrigirPagamentoState = {};

/**
 * Painel de "Corrigir pagamento", aberto por `?corrigir=1` — mesmo padrão do
 * fechamento (`?fechar=1`) e do cancelamento (`?cancelar=1`).
 *
 * Existe para o caso comum do balcão: ela digita R$ 85 no lugar de R$ 58 e
 * percebe meio minuto depois. O caminho antigo era voltar etapa e refazer o
 * fechamento inteiro — e isso APAGAVA o recebimento (ver `voltarEtapaAction`).
 *
 * Os campos já vêm preenchidos com o que está gravado, então o conserto comum
 * é digitar o valor certo e confirmar. A forma vem junto porque o erro também
 * pode ser nela (marcou Pix quando foi Visa débito), e é por isso que o botão
 * não se chama "Corrigir valor".
 *
 * Só aparece no MESMO DIA do recebimento; o servidor reconfere
 * (`corrigirRecebimento`), então o botão sumir não é a proteção.
 */
export function CorrigirPagamentoForm({
  atendimentoId,
  agendamentoId,
  valorAtual,
  formaAtualId,
  formas,
}: {
  atendimentoId: string;
  agendamentoId: string;
  valorAtual: number | null;
  formaAtualId: string | null;
  formas: FormaSelecionavel[];
}) {
  const action = corrigirPagamentoAction.bind(null, atendimentoId, agendamentoId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [valor, setValor] = useState<number | null>(valorAtual);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 shadow-sm"
    >
      <h2 className="flex items-center gap-2 font-display font-bold text-brand-900">
        <Pencil className="h-5 w-5 shrink-0" aria-hidden="true" />
        Corrigir o pagamento
      </h2>

      <p className="text-sm text-brand-900">
        Use quando o valor ou a forma foram digitados errado. O dinheiro continua contado no dia de
        hoje — nada é devolvido ao cliente.
      </p>

      <ValorInput name="valorTotal" label="Valor correto (R$)" value={valor} onChange={setValor} />

      <FormaPagamentoPicker formas={formas} valor={valor} formaInicial={formaAtualId ?? undefined} />

      {state.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Salvando..." : "Salvar correção"}
        </Button>
        <ButtonLink
          href={`/agendamentos/${agendamentoId}`}
          variant="secondary"
          className="w-full sm:w-auto"
        >
          Voltar
        </ButtonLink>
      </div>
    </form>
  );
}
