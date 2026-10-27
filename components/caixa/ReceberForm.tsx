"use client";

import { useActionState, useState } from "react";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ValorInput } from "@/components/ui/ValorInput";
import { FormaPagamentoPicker } from "@/components/agenda/FormaPagamentoPicker";
import { registrarPagamentoCaixaAction, type PagamentoCaixaState } from "@/app/(app)/caixa/actions";
import type { FormaSelecionavel } from "@/lib/pagamento";

const initialState: PagamentoCaixaState = {};

/**
 * Dar baixa numa pendência, direto na lista do Caixa.
 *
 * Fechado por padrão: a lista existe para ser lida de relance ("quem me deve o
 * quê"), e vários seletores de pagamento abertos ao mesmo tempo viram ruído.
 * Abre com um toque em "Receber".
 *
 * O valor vem preenchido mas continua editável mesmo quando já existe — o
 * cliente pode acertar diferente do combinado, e o que vale para o caixa é o
 * que entrou.
 */
export function ReceberForm({
  atendimentoId,
  valorAtual,
  formas,
  children,
}: {
  atendimentoId: string;
  valorAtual: number | null;
  formas: FormaSelecionavel[];
  // Ações que dividem a linha com "Receber" enquanto ele está fechado (o botão
  // de cobrar no WhatsApp). Ficam com o formulário para o painel aberto poder
  // ocupar a largura toda sem elas do lado.
  children?: React.ReactNode;
}) {
  const action = registrarPagamentoCaixaAction.bind(null, atendimentoId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState<number | null>(valorAtual);
  const [formaEscolhida, setFormaEscolhida] = useState("");

  if (!aberto) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="accent"
          onClick={() => setAberto(true)}
          className="w-full sm:w-auto"
        >
          <HandCoins className="h-4 w-4" aria-hidden="true" /> Receber
        </Button>
        {children}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl bg-neutral-50 p-3">
      <ValorInput
        name="valorTotal"
        label="Valor recebido (R$)"
        value={valor}
        onChange={setValor}
        id={`valor-${atendimentoId}`}
      />

      <FormaPagamentoPicker
        formas={formas}
        valor={valor}
        onSelecionar={(id) => setFormaEscolhida(id ?? "")}
      />

      {state.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          variant="accent"
          // Sem forma escolhida o recebimento não existe: é ela que separa
          // "pago" de "a receber".
          disabled={pending || !formaEscolhida || valor === null}
          className="flex-1"
        >
          {pending ? "Salvando..." : "Confirmar recebimento"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setAberto(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
