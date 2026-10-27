"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { ACOES, registrarAtividade } from "@/lib/atividade";
import { voltarSeguro } from "@/lib/navegacao";
import { prisma } from "@/lib/prisma";
import { PAIS_PADRAO, paraE164, type CodigoPais } from "@/lib/telefone";

export type ClienteFormState = { error?: string };

/**
 * Telefone do formulário -> E.164 para o banco.
 *
 * O formulário manda o texto cru e o país escolhido, e a conversão acontece
 * AQUI, no servidor — o campo escondido do cliente não é fonte de verdade.
 *
 * Se não der para entender o número, guarda o texto como foi digitado em vez de
 * recusar: cadastro rápido é prioridade e a cliente pode ter um número atípico
 * (o aviso já apareceu no formulário). `formatarTelefone()` sabe exibir valor
 * não-E.164 devolvendo o texto cru, então nada quebra por causa disso.
 */
function lerTelefone(formData: FormData): string {
  const bruto = String(formData.get("telefone") ?? "").trim();
  const pais = String(formData.get("telefonePais") ?? "") || PAIS_PADRAO;
  return paraE164(bruto, pais as CodigoPais) ?? bruto;
}

export async function createClienteAction(
  _prevState: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  await requireSession();

  const nome = String(formData.get("nome") ?? "").trim();
  const telefone = lerTelefone(formData);
  const endereco = String(formData.get("endereco") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim();

  if (!nome) return { error: "Informe o nome do cliente." };
  if (!telefone) return { error: "Informe o telefone do cliente." };

  const cliente = await prisma.cliente.create({
    data: { nome, telefone, endereco: endereco || null, observacoes: observacoes || null },
  });

  // Se veio de outro fluxo (ex: novo agendamento), segue direto para o cadastro
  // do pet, carregando o destino de retorno.
  const voltar = voltarSeguro(formData.get("voltar"));
  if (voltar) {
    redirect(`/clientes/${cliente.id}/pets/novo?voltar=${encodeURIComponent(voltar)}`);
  }

  redirect(`/clientes/${cliente.id}`);
}

export async function updateClienteAction(
  clienteId: string,
  _prevState: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  await requireSession();

  const nome = String(formData.get("nome") ?? "").trim();
  const telefone = lerTelefone(formData);
  const endereco = String(formData.get("endereco") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim();

  if (!nome) return { error: "Informe o nome do cliente." };
  if (!telefone) return { error: "Informe o telefone do cliente." };

  await prisma.cliente.update({
    where: { id: clienteId },
    data: { nome, telefone, endereco: endereco || null, observacoes: observacoes || null },
  });

  redirect(`/clientes/${clienteId}`);
}

export async function deleteClienteAction(clienteId: string) {
  const session = await requireSession();

  const petCount = await prisma.pet.count({ where: { clienteId } });
  if (petCount > 0) {
    redirect(`/clientes/${clienteId}?erro=possui-pets`);
  }

  // Lido ANTES de apagar: depois do delete não há de onde tirar o nome, e um
  // registro dizendo "cliente excluído" sem dizer qual não serve para nada.
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) redirect("/clientes");

  // Delete e registro na MESMA transação: o dado sumir sem rastro é justamente
  // o buraco que o registro existe para fechar.
  await prisma.$transaction(async (tx) => {
    await tx.cliente.delete({ where: { id: clienteId } });
    await registrarAtividade(tx, {
      autor: { nome: session.nome, id: session.sub },
      acao: ACOES.CLIENTE_EXCLUIDO,
      entidade: "Cliente",
      // Sem id: a linha não existe mais, e um link para ela levaria a lugar
      // nenhum. O que identifica agora é o conteúdo guardado em `antes`.
      entidadeId: null,
      descricao: `Excluiu o cliente ${cliente.nome}`,
      antes: {
        nome: cliente.nome,
        telefone: cliente.telefone,
        endereco: cliente.endereco,
        observacoes: cliente.observacoes,
      },
    });
  });

  redirect("/clientes");
}
