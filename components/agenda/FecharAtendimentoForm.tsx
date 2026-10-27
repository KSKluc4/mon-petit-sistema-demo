"use client";

import { useActionState, useState } from "react";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ValorInput } from "@/components/ui/ValorInput";
import {
  finalizarAtendimentoAction,
  type FecharAtendimentoState,
} from "@/app/(app)/agendamentos/actions";
import type { FormaSelecionavel } from "@/lib/pagamento";
import { FormaPagamentoPicker } from "./FormaPagamentoPicker";

const initialState: FecharAtendimentoState = {};

/** O que a tela precisa saber do pacote que este banho vai consumir. */
export type PacoteDoFechamento = {
  proximoBanho: number;
  banhosTotal: number;
};

export function FecharAtendimentoForm({
  agendamentoId,
  valorAtual,
  formas,
  pacote,
}: {
  agendamentoId: string;
  // Centavos definidos no agendamento, ou null quando ficou "a definir".
  valorAtual: number | null;
  formas: FormaSelecionavel[];
  /** Pacote com saldo disponível para este pet, ou null. */
  pacote: PacoteDoFechamento | null;
}) {
  const action = finalizarAtendimentoAction.bind(null, agendamentoId);
  const [state, formAction, pending] = useActionState(action, initialState);
  // Com pacote, o banho já está pago: o campo começa VAZIO e o que se digita
  // ali é só o extra do dia. Sem pacote, segue o valor do agendamento.
  const [usarPacote, setUsarPacote] = useState(pacote !== null);
  const [valor, setValor] = useState<number | null>(pacote ? null : valorAtual);

  // Sem extra não há o que receber — o dinheiro entrou na venda do pacote.
  const temAReceber = !usarPacote || (valor !== null && valor > 0);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm"
    >
      <h2 className="font-display font-bold text-neutral-900">Fechar atendimento</h2>

      {pacote && (
        <div className="flex flex-col gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="usarPacote"
              value="1"
              checked={usarPacote}
              onChange={(e) => setUsarPacote(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-brand-600"
            />
            <span className="flex flex-col">
              <span className="flex items-center gap-1.5 font-semibold text-brand-900">
                <Ticket className="h-4 w-4" aria-hidden="true" />
                Usar o pacote — banho {pacote.proximoBanho} de {pacote.banhosTotal}
              </span>
              <span className="text-sm text-brand-800">
                O banho já foi pago na compra do pacote. Não cobre nada por ele.
              </span>
            </span>
          </label>
        </div>
      )}

      {/* Valor primeiro: a prévia do líquido no seletor depende dele. */}
      <ValorInput
        name="valorTotal"
        label={usarPacote ? "Serviço extra do dia (R$)" : "Total (R$)"}
        value={valor}
        onChange={setValor}
      />
      {usarPacote && (
        <p className="-mt-2 text-sm text-neutral-500">
          Só o que for <strong>além do banho</strong> — desembolo, tosa. Deixe em branco se não
          teve extra.
        </p>
      )}

      {temAReceber ? (
        <>
          <FormaPagamentoPicker formas={formas} valor={valor} />
          {valor === null && !usarPacote && (
            <p className="text-sm text-amber-700 font-medium">
              Valor ainda não definido — preencha para registrar o pagamento.
            </p>
          )}
        </>
      ) : (
        <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Nada a receber hoje: o banho saiu do pacote.
        </p>
      )}

      <Textarea
        name="observacoesAtendimento"
        label="Observações do atendimento"
        placeholder='ex: "Cliente pediu deixar o rabo cheio"'
      />

      {state.error && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          name="acao"
          value="confirmar"
          variant="accent"
          disabled={pending}
          className="w-full"
        >
          {pending ? "Salvando..." : "Confirmar entrega"}
        </Button>
        {temAReceber && (
          <Button
            type="submit"
            name="acao"
            value="depois"
            variant="secondary"
            disabled={pending}
            className="w-full"
          >
            Receber depois
          </Button>
        )}
      </div>
    </form>
  );
}
