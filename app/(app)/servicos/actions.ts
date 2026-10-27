"use server";

import { redirect } from "next/navigation";
import { ACOES, registrarAtividade } from "@/lib/atividade";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ServicoFormState = { error?: string };

export async function createServicoAction(
  _prevState: ServicoFormState,
  formData: FormData,
): Promise<ServicoFormState> {
  await requireSession();

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Informe o nome do serviço." };

  const existente = await prisma.servico.findUnique({ where: { nome } });
  if (existente) return { error: "Já existe um serviço com esse nome." };

  await prisma.servico.create({ data: { nome } });
  redirect("/servicos");
}

export async function updateServicoAction(
  servicoId: string,
  _prevState: ServicoFormState,
  formData: FormData,
): Promise<ServicoFormState> {
  const session = await requireSession();

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Informe o nome do serviço." };

  const existente = await prisma.servico.findUnique({ where: { nome } });
  if (existente && existente.id !== servicoId) {
    return { error: "Já existe um serviço com esse nome." };
  }

  // Renomear não mexe no histórico: cada Atendimento guarda os nomes dos
  // serviços realizados em texto (Atendimento.servicosRealizados). Mas a
  // tabela "Por serviço" do relatório exibe o nome ATUAL — por isso o nome
  // antigo é registrado, na mesma transação, e só existe ali depois do update.
  const encontrado = await prisma.$transaction(async (tx) => {
    const atual = await tx.servico.findUnique({ where: { id: servicoId } });
    if (!atual) return false;
    // Salvar sem mudar o nome não é evento: não vira ruído no registro.
    if (atual.nome === nome) return true;
    await tx.servico.update({ where: { id: servicoId }, data: { nome } });
    await registrarAtividade(tx, {
      autor: { nome: session.nome, id: session.sub },
      acao: ACOES.SERVICO_RENOMEADO,
      entidade: "Servico",
      entidadeId: servicoId,
      descricao: `Alterou o nome do serviço: ${atual.nome} → ${nome}`,
      antes: { nome: atual.nome },
      depois: { nome },
    });
    return true;
  });
  if (!encontrado) return { error: "Serviço não encontrado." };

  redirect("/servicos");
}

// Em vez de excluir (perderia o nome usado em atendimentos antigos), desativa —
// some da tela de novo agendamento mas segue aparecendo nos históricos.
export async function toggleAtivoServicoAction(servicoId: string, ativoAtual: boolean) {
  const session = await requireSession();
  const ativo = !ativoAtual;
  await prisma.$transaction(async (tx) => {
    const servico = await tx.servico.update({ where: { id: servicoId }, data: { ativo } });
    await registrarAtividade(tx, {
      autor: { nome: session.nome, id: session.sub },
      acao: ativo ? ACOES.SERVICO_REATIVADO : ACOES.SERVICO_DESATIVADO,
      entidade: "Servico",
      entidadeId: servicoId,
      descricao: `${ativo ? "Reativou" : "Desativou"} o serviço ${servico.nome}`,
    });
  });
  redirect("/servicos");
}
