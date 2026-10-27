"use client";

import { useActionState } from "react";
import { Undo2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import {
  devolverDinheiroAction,
  type DevolverDinheiroState,
} from "@/app/(app)/agendamentos/actions";
import { formatCentavos, formatDataCurta } from "@/lib/datas";
import { deArtigo } from "@/lib/genero";
import type { Sexo } from "@/app/generated/prisma/client";

const initialState: DevolverDinheiroState = {};

/**
 * Painel de "Devolver dinheiro", aberto por `?devolver=1`.
 *
 * É para dinheiro que VOLTOU de verdade para o cliente — não para número
 * digitado errado, que se conserta em "Corrigir pagamento" sem inventar uma
 * devolução que não aconteceu.
 *
 * A tela diz as duas coisas que a dona precisa entender antes de confirmar:
 * a saída entra no caixa de HOJE (regime de caixa, igual ao cancelamento de
 * venda de pacote), e o dia do recebimento original não muda — é isso que
 * mantém intacto um mês que já foi para a contadora.
 */
export function DevolverDinheiroForm({
  atendimentoId,
  agendamentoId,
  valor,
  nomePet,
  sexoPet,
  formaNome,
  dataRecebimento,
}: {
  atendimentoId: string;
  agendamentoId: string;
  valor: number;
  nomePet: string;
  sexoPet: Sexo | null;
  formaNome: string | null;
  dataRecebimento: Date;
}) {
  const action = devolverDinheiroAction.bind(null, atendimentoId, agendamentoId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm"
    >
      <h2 className="flex items-center gap-2 font-display font-bold text-rose-900">
        <Undo2 className="h-5 w-5 shrink-0" aria-hidden="true" />
        Devolver {formatCentavos(valor)} do atendimento {deArtigo(nomePet, sexoPet)}?
      </h2>

      <p className="text-sm text-rose-800">
        Recebido em {formatDataCurta(dataRecebimento)}
        {formaNome && ` por ${formaNome}`}.
      </p>

      <Textarea
        name="motivo"
        label="Motivo (opcional)"
        placeholder='ex: "Cliente reclamou da tosa, devolvido em dinheiro"'
        rows={2}
      />

      <p className="text-sm text-rose-800">
        A devolução entra no caixa de <strong>hoje</strong>. O faturamento do dia em que o pagamento
        entrou não muda — os dois ficam registrados, cada um no seu dia. O atendimento continua no
        histórico do pet, marcado como devolvido.
      </p>

      {state.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" variant="danger" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Salvando..." : "Confirmar devolução"}
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
