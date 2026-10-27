"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ValorInput } from "@/components/ui/ValorInput";
import {
  registrarPagamentoAction,
  type RegistrarPagamentoState,
} from "@/app/(app)/agendamentos/actions";
import type { FormaSelecionavel } from "@/lib/pagamento";
import { FormaPagamentoPicker } from "./FormaPagamentoPicker";

const initialState: RegistrarPagamentoState = {};

// Fechamento tardio na ficha do agendamento ("Receber depois"). O valor vem
// preenchido mas continua editável — o cliente pode acertar diferente.
export function RegistrarPagamentoForm({
  atendimentoId,
  agendamentoId,
  valorAtual,
  formas,
}: {
  atendimentoId: string;
  agendamentoId: string;
  valorAtual: number | null;
  formas: FormaSelecionavel[];
}) {
  const action = registrarPagamentoAction.bind(null, atendimentoId, agendamentoId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [valor, setValor] = useState<number | null>(valorAtual);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <ValorInput name="valorTotal" label="Valor recebido (R$)" value={valor} onChange={setValor} />

      <FormaPagamentoPicker formas={formas} valor={valor} />

      {state.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Salvando..." : "Registrar pagamento"}
      </Button>
    </form>
  );
}
