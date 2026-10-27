"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Textarea } from "@/components/ui/Textarea";
import type { ClienteFormState } from "@/app/(app)/clientes/actions";

const initialState: ClienteFormState = {};

interface ClienteFormProps {
  action: (prevState: ClienteFormState, formData: FormData) => Promise<ClienteFormState>;
  defaultValues?: {
    nome: string;
    telefone: string;
    endereco: string | null;
    observacoes: string | null;
  };
  submitLabel?: string;
  voltar?: string;
}

export function ClienteForm({ action, defaultValues, submitLabel = "Salvar", voltar }: ClienteFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {voltar && <input type="hidden" name="voltar" value={voltar} />}
      <Input name="nome" label="Nome *" defaultValue={defaultValues?.nome} required autoFocus />
      <PhoneInput name="telefone" label="Telefone *" defaultValue={defaultValues?.telefone} required />
      <Input name="endereco" label="Endereço" defaultValue={defaultValues?.endereco ?? ""} />
      <Textarea name="observacoes" label="Observações" defaultValue={defaultValues?.observacoes ?? ""} />
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
