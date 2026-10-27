"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  cancelarPacoteAction,
  type CancelarPacoteState,
} from "@/app/(app)/pets/[id]/pacoteActions";

const initialState: CancelarPacoteState = {};

export function CancelarPacoteForm({
  pacoteId,
  petId,
  dataVenda,
}: {
  pacoteId: string;
  petId: string;
  /** Dia em que a venda foi registrada, já formatado — para rastreabilidade. */
  dataVenda: string;
}) {
  const action = cancelarPacoteAction.bind(null, pacoteId, petId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [aberto, setAberto] = useState(false);

  if (state.ok) {
    return (
      <p className="text-sm font-medium text-neutral-500">Venda cancelada.</p>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="self-start text-sm font-medium text-neutral-500 underline hover:text-red-600"
      >
        Cancelar venda
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-900">
        A devolução entra no caixa de <strong>hoje</strong>, não no dia da venda. O faturamento de{" "}
        {dataVenda} <strong>não muda</strong> — se já foi para a contabilidade, continua valendo.
      </p>
      <p className="text-sm text-red-900">
        Cancelada no mesmo dia, a venda e a devolução se anulam sozinhas. Só dá para cancelar
        enquanto nenhum banho foi usado.
      </p>

      <Input name="motivo" label="Motivo (opcional)" placeholder='ex: "valor digitado errado"' />

      {state.error && (
        <p className="text-sm font-medium text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={pending} className="flex-1">
          {pending ? "Cancelando..." : "Confirmar cancelamento"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setAberto(false)} className="flex-1">
          Voltar
        </Button>
      </div>
    </form>
  );
}
