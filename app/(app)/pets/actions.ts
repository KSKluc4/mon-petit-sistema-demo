"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ACOES, registrarAtividade } from "@/lib/atividade";
import { voltarSeguro } from "@/lib/navegacao";
import { prisma } from "@/lib/prisma";
import { uploadPetPhoto } from "@/lib/storage";
import { Especie, Sexo, type Prisma } from "@/app/generated/prisma/client";

export type PetFormState = { error?: string; success?: boolean };

function resolveDataNascimento(
  modoIdade: string,
  dataNascimentoRaw: string,
  idadeAnosRaw: string,
): Date | null {
  if (modoIdade === "aproximada") {
    if (!idadeAnosRaw) return null;
    const anos = Number(idadeAnosRaw.replace(",", "."));
    if (Number.isNaN(anos) || anos < 0) return null;
    const data = new Date();
    data.setDate(data.getDate() - Math.round(anos * 365.25));
    return data;
  }
  if (!dataNascimentoRaw) return null;
  const data = new Date(dataNascimentoRaw);
  return Number.isNaN(data.getTime()) ? null : data;
}

function parsePeso(pesoRaw: string): number | null {
  if (!pesoRaw) return null;
  const peso = Number(pesoRaw.replace(",", "."));
  return Number.isNaN(peso) ? null : peso;
}

async function extractPetFields(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const especie = String(formData.get("especie") ?? "");
  const raca = String(formData.get("raca") ?? "").trim();
  const sexo = String(formData.get("sexo") ?? "");
  const modoIdade = String(formData.get("modoIdade") ?? "data");
  const dataNascimentoRaw = String(formData.get("dataNascimento") ?? "");
  const idadeAnosRaw = String(formData.get("idadeAnos") ?? "");
  const pesoRaw = String(formData.get("pesoKg") ?? "");
  const observacoes = String(formData.get("observacoes") ?? "").trim();
  const fotoFile = formData.get("foto");

  if (!nome) return { error: "Informe o nome do pet." } as const;
  if (especie !== Especie.CAO && especie !== Especie.GATO) {
    return { error: "Selecione a espécie." } as const;
  }
  if (!raca) return { error: "Informe a raça." } as const;
  if (sexo !== Sexo.MACHO && sexo !== Sexo.FEMEA) {
    return { error: "Selecione o sexo." } as const;
  }

  let fotoUrl: string | undefined;
  if (fotoFile instanceof File && fotoFile.size > 0) {
    fotoUrl = await uploadPetPhoto(fotoFile);
  }

  return {
    data: {
      nome,
      especie: especie as Especie,
      raca,
      sexo: sexo as Sexo,
      dataNascimento: resolveDataNascimento(modoIdade, dataNascimentoRaw, idadeAnosRaw),
      pesoKg: parsePeso(pesoRaw),
      observacoes: observacoes || null,
      fotoUrl,
    },
  };
}

export async function createPetAction(
  clienteId: string,
  _prevState: PetFormState,
  formData: FormData,
): Promise<PetFormState> {
  await requireSession();

  const result = await extractPetFields(formData);
  if ("error" in result) return { error: result.error };

  const pet = await prisma.pet.create({
    data: { ...result.data, clienteId },
  });

  // Retorna ao fluxo de origem (ex: novo agendamento) com o pet já selecionado.
  const voltar = voltarSeguro(formData.get("voltar"));
  if (voltar) {
    redirect(`${voltar}${voltar.includes("?") ? "&" : "?"}petId=${pet.id}`);
  }

  redirect(`/pets/${pet.id}`);
}

export async function updatePetAction(
  petId: string,
  _prevState: PetFormState,
  formData: FormData,
): Promise<PetFormState> {
  await requireSession();

  const result = await extractPetFields(formData);
  if ("error" in result) return { error: result.error };

  // fotoUrl fica undefined quando nenhuma foto nova foi enviada — o Prisma
  // ignora campos undefined no update, preservando a foto atual.
  const data: Prisma.PetUpdateInput = { ...result.data };

  await prisma.pet.update({ where: { id: petId }, data });

  redirect(`/pets/${petId}`);
}

export async function deletePetAction(petId: string) {
  const session = await requireSession();

  const agendamentosCount = await prisma.agendamento.count({ where: { petId } });
  if (agendamentosCount > 0) {
    redirect(`/pets/${petId}?erro=possui-agendamentos`);
  }

  // Lido antes de apagar, com o tutor junto: depois do delete não sobra nada
  // que responda "qual pet era esse, de quem?".
  const pet = await prisma.pet.findUnique({ where: { id: petId }, include: { cliente: true } });
  if (!pet) redirect("/clientes");

  await prisma.$transaction(async (tx) => {
    await tx.pet.delete({ where: { id: petId } });
    await registrarAtividade(tx, {
      autor: { nome: session.nome, id: session.sub },
      acao: ACOES.PET_EXCLUIDO,
      entidade: "Pet",
      entidadeId: null,
      descricao: `Excluiu o pet ${pet.nome}, de ${pet.cliente.nome}`,
      antes: {
        nome: pet.nome,
        especie: pet.especie,
        raca: pet.raca,
        sexo: pet.sexo,
        observacoes: pet.observacoes,
        padraoPet: pet.padraoPet,
        tutorId: pet.clienteId,
        tutorNome: pet.cliente.nome,
      },
    });
  });

  redirect(`/clientes/${pet.clienteId}`);
}

export async function updatePadraoPetAction(
  petId: string,
  _prevState: PetFormState,
  formData: FormData,
): Promise<PetFormState> {
  await requireSession();

  const padraoPet = String(formData.get("padraoPet") ?? "").trim();

  await prisma.pet.update({ where: { id: petId }, data: { padraoPet: padraoPet || null } });

  revalidatePath(`/pets/${petId}`);
  return { success: true };
}
