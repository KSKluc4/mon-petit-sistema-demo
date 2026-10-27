"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionCookie } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  // O login nunca é sensível a maiúsculas neste sistema (só existem "dono" e
  // "vice") — normaliza pra evitar falso "usuário ou senha inválidos" quando
  // o teclado do celular autocapitaliza a primeira letra do campo. A senha
  // NÃO passa por trim/normalização: espaços no início/fim são parte dela.
  const login = String(formData.get("login") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  if (!login || !senha) {
    return { error: "Preencha usuário e senha." };
  }

  const usuario = await prisma.usuario.findUnique({ where: { login } });
  if (!usuario) {
    return { error: "Usuário ou senha inválidos." };
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) {
    return { error: "Usuário ou senha inválidos." };
  }

  await createSessionCookie({
    sub: usuario.id,
    login: usuario.login,
    nome: usuario.nome,
    sv: usuario.sessionVersion,
  });

  redirect("/");
}
