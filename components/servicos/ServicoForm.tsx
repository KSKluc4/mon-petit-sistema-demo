"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ServicoFormState } from "@/app/(app)/servicos/actions";

const initialState: ServicoFormState = {};

interface ServicoFormProps {
  action: (prevState: ServicoFormState, formData: FormData) => Promise<ServicoFormState>;
  defaultValues?: { nome: string };
  submitLabel?: string;
}

// Serviço não tem preço: o valor é livre e definido em cada atendimento.
export function ServicoForm({ action, defaultValues, submitLabel = "Salvar" }: ServicoFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="nome" label="Nome *" defaultValue={defaultValues?.nome} required autoFocus />
      {state.error && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full mt-2">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
