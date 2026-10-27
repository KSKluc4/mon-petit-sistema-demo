"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { RedefinirSenhaOutroState } from "./actions";

const initialState: RedefinirSenhaOutroState = {};

interface ResetarSenhaOutroFormProps {
  action: (prevState: RedefinirSenhaOutroState, formData: FormData) => Promise<RedefinirSenhaOutroState>;
  nomeOutro: string;
}

export function ResetarSenhaOutroForm({ action, nomeOutro }: ResetarSenhaOutroFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-neutral-600">
        Defina uma nova senha para <strong className="text-neutral-900">{nomeOutro}</strong>. Ela vai precisar
        entrar de novo com a senha nova.
      </p>
      <Input
        name="novaSenhaOutro"
        type="password"
        label={`Nova senha para ${nomeOutro}`}
        autoComplete="new-password"
        required
        minLength={8}
      />
      <Input
        name="confirmarSenhaOutro"
        type="password"
        label="Confirmar nova senha"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <div className="border-t border-neutral-100 pt-4 flex flex-col gap-1.5">
        <Input
          name="senhaPropria"
          type="password"
          label="Sua senha (confirme que é você)"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-700 font-medium" role="status">
          Senha de {state.nomeOutro} redefinida com sucesso.
        </p>
      )}
      <Button type="submit" variant="danger" disabled={pending} className="w-full mt-2">
        {pending ? "Salvando..." : `Redefinir senha de ${nomeOutro}`}
      </Button>
    </form>
  );
}
