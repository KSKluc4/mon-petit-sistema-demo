"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { atualizarNomeAction, type AtualizarNomeState } from "./actions";

const initialState: AtualizarNomeState = {};

export function EditarNomeForm({ nomeAtual }: { nomeAtual: string }) {
  const [state, formAction, pending] = useActionState(atualizarNomeAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="nome" label="Nome" defaultValue={nomeAtual} required />
      {state.error && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-700 font-medium" role="status">
          Nome atualizado com sucesso.
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full mt-2">
        {pending ? "Salvando..." : "Salvar nome"}
      </Button>
    </form>
  );
}
