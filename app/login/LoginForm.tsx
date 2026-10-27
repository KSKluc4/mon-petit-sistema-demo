"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [mostrarAjuda, setMostrarAjuda] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <Input
          name="login"
          label="Usuário"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
        />
        <Input name="senha" type="password" label="Senha" autoComplete="current-password" required />
        {state.error && (
          <p className="text-sm text-red-600 font-medium" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full mt-2">
          {pending ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMostrarAjuda((v) => !v)}
        className="text-sm text-neutral-400 hover:text-brand-700 text-center transition-colors"
      >
        Esqueci minha senha
      </button>

      {mostrarAjuda && (
        <p className="text-sm text-neutral-600 bg-neutral-50 rounded-2xl p-4">
          Peça para o outro usuário do sistema entrar e ir em{" "}
          <strong className="text-neutral-900">Conta → Redefinir senha do outro usuário</strong>. Não há
          recuperação por e-mail.
        </p>
      )}
    </div>
  );
}
