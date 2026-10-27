"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { updatePadraoPetAction, type PetFormState } from "@/app/(app)/pets/actions";

const initialState: PetFormState = {};

export function PadraoPetForm({ petId, defaultValue }: { petId: string; defaultValue: string }) {
  const action = updatePadraoPetAction.bind(null, petId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Textarea
        name="padraoPet"
        label="Padrão do Pet"
        rows={6}
        defaultValue={defaultValue}
        placeholder='ex: "Máquina 7 no corpo, tesoura na cabeça, rabo cheio, não usar perfume"'
      />
      {state.error && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-600 font-medium" role="status">
          Salvo!
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
