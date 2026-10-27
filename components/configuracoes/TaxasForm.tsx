"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { salvarTaxasAction, type TaxasFormState } from "@/app/(app)/formas-pagamento/actions";

const initialState: TaxasFormState = {};

export type LinhaTaxa = { id: string; parcelas: number; taxaBps: number | null };
export type GrupoTaxas = {
  formaId: string;
  nome: string;
  parcelavel: boolean;
  taxas: LinhaTaxa[];
};

/**
 * Edição dos percentuais da maquininha.
 *
 * Um formulário só com tudo dentro: a dona ajusta as taxas todas de uma vez
 * quando a operadora muda a tabela, e salvar linha a linha viraria dezenas de
 * toques.
 *
 * Campo vazio = taxa NÃO CONFIGURADA (é o caso da Amex até ela informar os
 * valores), e não zero. A tela diz isso, porque "0,00%" seria uma afirmação.
 */
export function TaxasForm({ grupos }: { grupos: GrupoTaxas[] }) {
  const [state, formAction, pending] = useActionState(salvarTaxasAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {grupos.map((g) => (
        <div key={g.formaId} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="font-display font-bold text-neutral-900">{g.nome}</p>
          <div className={`mt-3 grid gap-3 ${g.parcelavel ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:max-w-[12rem]"}`}>
            {g.taxas
              .slice()
              .sort((a, b) => a.parcelas - b.parcelas)
              .map((t) => (
                <label key={t.id} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-neutral-500">
                    {g.parcelavel ? (t.parcelas === 1 ? "À vista" : `${t.parcelas}x`) : "Taxa"}
                  </span>
                  <span className="flex min-h-[44px] items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-3 transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
                    <input
                      name={`taxa-${t.id}`}
                      type="text"
                      inputMode="decimal"
                      // Vazio quando não configurada — o placeholder deixa claro
                      // que em branco não é zero.
                      defaultValue={t.taxaBps === null ? "" : String(t.taxaBps / 100).replace(".", ",")}
                      placeholder="—"
                      className="w-full min-w-0 bg-transparent py-2 text-base tabular-nums text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
                    />
                    <span className="shrink-0 text-sm font-semibold text-neutral-500">%</span>
                  </span>
                </label>
              ))}
          </div>
        </div>
      ))}

      {state.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.salvo && !state.error && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Taxas salvas. Pagamentos já
          registrados não mudaram.
        </p>
      )}

      <Button type="submit" variant="accent" disabled={pending} className="w-full">
        {pending ? "Salvando..." : "Salvar taxas"}
      </Button>
    </form>
  );
}
