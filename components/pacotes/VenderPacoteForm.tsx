"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ValorInput } from "@/components/ui/ValorInput";
import { FormaPagamentoPicker } from "@/components/agenda/FormaPagamentoPicker";
import {
  venderPacoteAction,
  type VenderPacoteState,
} from "@/app/(app)/pets/[id]/pacoteActions";
import type { FormaSelecionavel } from "@/lib/pagamento";

const initialState: VenderPacoteState = {};

/** Opções de tamanho. Espelha `BANHOS_PERMITIDOS` do servidor, que é quem valida. */
const TAMANHOS = [2, 4];

export function VenderPacoteForm({
  petId,
  petNome,
  formas,
}: {
  petId: string;
  petNome: string;
  formas: FormaSelecionavel[];
}) {
  const action = venderPacoteAction.bind(null, petId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [banhos, setBanhos] = useState(4);
  // Valor livre, digitado na venda: o preço varia por cachorro, igual ao resto
  // do sistema. Começa em branco de propósito.
  const [valor, setValor] = useState<number | null>(null);

  if (state.ok) {
    return (
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        Pacote de {banhos} banhos vendido para {petNome}. O valor entrou no caixa de hoje.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <div>
        <p className="font-display font-bold text-neutral-900">Vender pacote</p>
        <p className="text-sm text-neutral-500">
          O cliente paga agora, e {petNome} usa os banhos em até 30 dias.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700">Quantos banhos</span>
        <div className="flex gap-2">
          {TAMANHOS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setBanhos(n)}
              className={`min-h-[44px] flex-1 rounded-xl px-4 font-semibold transition-colors ${
                banhos === n
                  ? "bg-brand-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {n} banhos
            </button>
          ))}
        </div>
        <input type="hidden" name="banhosTotal" value={banhos} />
      </div>

      {/* Valor antes da forma: a prévia do líquido no seletor depende dele. */}
      <ValorInput name="valorTotal" label="Valor total do pacote (R$)" value={valor} onChange={setValor} />

      <FormaPagamentoPicker formas={formas} valor={valor} />

      <Textarea name="observacoes" label="Observações (opcional)" placeholder='ex: "promoção de agosto"' />

      {state.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="accent" disabled={pending} className="w-full">
        {pending ? "Registrando..." : "Registrar venda"}
      </Button>
    </form>
  );
}
