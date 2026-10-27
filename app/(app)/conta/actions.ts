"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { ACOES, registrarAtividade } from "@/lib/atividade";
import { createSessionCookie, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AtualizarNomeState = { error?: string; success?: boolean };

export async function atualizarNomeAction(
  _prevState: AtualizarNomeState,
  formData: FormData,
): Promise<AtualizarNomeState> {
  const session = await requireSession();

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) {
    return { error: "Informe o nome." };
  }

  await prisma.usuario.update({ where: { id: session.sub }, data: { nome } });

  // Re-assina o cookie com o nome novo — sem isso, saudação e responsável no
  // histórico continuariam usando o nome antigo até o próximo login.
  await createSessionCookie({ sub: session.sub, login: session.login, nome, sv: session.sv });
  revalidatePath("/", "layout");

  return { success: true };
}

export type AlterarSenhaState = { error?: string; success?: boolean };

export async function alterarSenhaAction(
  _prevState: AlterarSenhaState,
  formData: FormData,
): Promise<AlterarSenhaState> {
  const session = await requireSession();

  const senhaAtual = String(formData.get("senhaAtual") ?? "");
  const novaSenha = String(formData.get("novaSenha") ?? "");
  const confirmarSenha = String(formData.get("confirmarSenha") ?? "");

  if (!senhaAtual || !novaSenha || !confirmarSenha) {
    return { error: "Preencha todos os campos." };
  }
  if (novaSenha.length < 8) {
    return { error: "A nova senha deve ter pelo menos 8 caracteres." };
  }
  if (novaSenha !== confirmarSenha) {
    return { error: "A confirmação não bate com a nova senha." };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: session.sub } });
  if (!usuario) {
    return { error: "Usuário não encontrado." };
  }

  const senhaAtualValida = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!senhaAtualValida) {
    return { error: "Senha atual incorreta." };
  }

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  await prisma.usuario.update({ where: { id: usuario.id }, data: { senhaHash } });

  return { success: true };
}

export type RedefinirSenhaOutroState = { error?: string; success?: boolean; nomeOutro?: string };

// Redefine a senha do OUTRO usuário do sistema (só existem 2) — pensado como
// recuperação de senha no dia a dia, sem serviço de e-mail. Exige a senha de
// quem está logado como confirmação de identidade (proteção contra alguém
// mexer num aparelho destravado). Ao trocar, invalida qualquer sessão já
// aberta do outro usuário incrementando Usuario.sessionVersion.
export async function redefinirSenhaOutroAction(
  outroUsuarioId: string,
  _prevState: RedefinirSenhaOutroState,
  formData: FormData,
): Promise<RedefinirSenhaOutroState> {
  const session = await requireSession();

  if (outroUsuarioId === session.sub) {
    return { error: "Não é possível redefinir a própria senha por aqui." };
  }

  const senhaPropria = String(formData.get("senhaPropria") ?? "");
  const novaSenha = String(formData.get("novaSenhaOutro") ?? "");
  const confirmarSenha = String(formData.get("confirmarSenhaOutro") ?? "");

  if (!senhaPropria || !novaSenha || !confirmarSenha) {
    return { error: "Preencha todos os campos." };
  }
  if (novaSenha.length < 8) {
    return { error: "A nova senha deve ter pelo menos 8 caracteres." };
  }
  if (novaSenha !== confirmarSenha) {
    return { error: "A confirmação não bate com a nova senha." };
  }

  const [euMesmo, outroUsuario] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: session.sub } }),
    prisma.usuario.findUnique({ where: { id: outroUsuarioId } }),
  ]);
  if (!euMesmo) {
    return { error: "Usuário não encontrado." };
  }
  if (!outroUsuario) {
    return { error: "O outro usuário não foi encontrado." };
  }

  const senhaPropriaValida = await bcrypt.compare(senhaPropria, euMesmo.senhaHash);
  if (!senhaPropriaValida) {
    return { error: "Sua senha está incorreta." };
  }

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: outroUsuario.id },
      data: { senhaHash, sessionVersion: { increment: 1 } },
    });
    // Nada da senha entra aqui — nem ela, nem o hash, nem pedaço. Sem antes/
    // depois: o fato que importa é quem redefiniu de quem. A queda da sessão
    // vai na frase porque é o efeito que o outro sente sem entender.
    // `Usuario` não tem sexo, então a frase evita "dela"/"dele".
    await registrarAtividade(tx, {
      autor: { nome: session.nome, id: session.sub },
      acao: ACOES.SENHA_REDEFINIDA,
      entidade: "Usuario",
      entidadeId: outroUsuario.id,
      descricao:
        `Redefiniu a senha de ${outroUsuario.nome} — ` +
        `quem estava conectado com essa conta foi desconectado`,
    });
  });

  return { success: true, nomeOutro: outroUsuario.nome };
}
