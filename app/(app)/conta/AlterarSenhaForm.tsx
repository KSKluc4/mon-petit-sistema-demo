"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { alterarSenhaAction, type AlterarSenhaState } from "./actions";

const initialState: AlterarSenhaState = {};

export function AlterarSenhaForm() {
  const [state, formAction, pending] = useActionState(alterarSenhaAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <Input name="senhaAtual" type="password" label="Senha atual" autoComplete="current-password" required />
      <Input name="novaSenha" type="password" label="Nova senha" autoComplete="new-password" required minLength={8} />
      <Input
        name="confirmarSenha"
        type="password"
        label="Confirmar nova senha"
        autoComplete="new-password"
        required
        minLength={8}
      />
      {state.error && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-700 font-medium" role="status">
          Senha alterada com sucesso.
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full mt-2">
        {pending ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}
