// Mensagens prontas do WhatsApp — tudo centralizado aqui para ser fácil de ajustar.
//
// As três concordam gênero pelo `sexo` do pet (ver lib/genero.ts). Sem o sexo,
// a frase é REFORMULADA para não precisar de gênero, em vez de cair no
// masculino: mandar "O Mila já está prontinho" para a dona da cadela é pior do
// que uma frase um pouco mais seca.
import { addDias, formatCentavos, hojeISO } from "./datas";
import { comArtigoMaiusculo, deArtigo } from "./genero";
import { paraE164 } from "./telefone";
import { somenteDigitos } from "./texto";
import type { Sexo } from "@/app/generated/prisma/client";

function formatDataISOCurta(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

// "hoje", "amanhã" ou "no dia DD/MM", conforme a distância da data do agendamento.
export function descreverDia(dataISO: string): string {
  const hoje = hojeISO();
  if (dataISO === hoje) return "hoje";
  if (dataISO === addDias(hoje, 1)) return "amanhã";
  return `no dia ${formatDataISOCurta(dataISO)}`;
}

// "do Thor" · "da Mila" · "de Mila"
export function mensagemConfirmarHorario(
  tutor: string,
  pet: string,
  sexo: Sexo | null,
  dataISO: string,
  hora: string,
): string {
  return `Olá, ${tutor}! Confirmando o horário ${deArtigo(pet, sexo)} ${descreverDia(dataISO)} às ${hora} aqui na Mon Petit. Podemos confirmar? 🐾`;
}

export function mensagemPetPronto(tutor: string, pet: string, sexo: Sexo | null): string {
  if (sexo === "MACHO") {
    return `Oi, ${tutor}! O ${pet} já está prontinho e pode ser retirado. 🛁🐾 Até já!`;
  }
  if (sexo === "FEMEA") {
    return `Oi, ${tutor}! A ${pet} já está prontinha e pode ser retirada. 🛁🐾 Até já!`;
  }
  // Sem o sexo não dá para usar "prontinho/prontinha" nem "retirado/retirada":
  // a frase é reescrita com verbo no infinitivo, que não flexiona.
  return `Oi, ${tutor}! Já pode vir buscar ${pet}. 🛁🐾 Até já!`;
}

export function mensagemAgradecimento(tutor: string, pet: string, sexo: Sexo | null): string {
  // "um amor" é invariável, então só o artigo muda — e some quando não há sexo
  // ("Mila foi um amor" continua natural).
  return `Obrigado pela visita, ${tutor}! ${comArtigoMaiusculo(pet, sexo)} foi um amor. 💚 Qualquer coisa estamos à disposição. — Pet Shop Mon Petit`;
}

/**
 * Cobrança de um atendimento em aberto ("Receber depois" que ainda não foi pago).
 *
 * Tom deliberadamente leve: é uma loja de bairro cobrando cliente conhecido, e
 * uma mensagem dura custa mais do que o valor em aberto. Por isso "quando
 * puder", nada de "pendência", nada de prazo.
 *
 * Sem valor definido a frase muda em vez de exibir R$ 0,00 — valor nulo é
 * "a definir" e não pode virar zero em texto nenhum (CLAUDE.md).
 */
export function mensagemCobranca(
  tutor: string,
  pet: string,
  sexo: Sexo | null,
  dataAtendimento: string,
  valorTotal: number | null,
): string {
  const atendimento = `do atendimento ${deArtigo(pet, sexo)} no dia ${dataAtendimento}`;
  if (valorTotal === null) {
    return `Olá, ${tutor}! Passando para lembrar ${atendimento}, que ficou para acertar depois. Quando puder, é só dar um retorno aqui. Obrigado! 🐾`;
  }
  return `Olá, ${tutor}! Passando para lembrar do valor em aberto ${atendimento}: ${formatCentavos(valorTotal)}. Quando puder, é só acertar aqui na Mon Petit. Obrigado! 🐾`;
}

/**
 * Formato aceito pelo wa.me: só dígitos, já com o código do país.
 *
 * Antes isto prefixava `55` fixo e exigia 10–11 dígitos, então um número do
 * Canadá virava `551416...` — link inválido. Agora o país sai do próprio
 * telefone (guardado em E.164), e o DDI nunca é chutado.
 *
 * Devolve null quando não dá para chegar num E.164 — é isso, e não o
 * comprimento, que faz o botão aparecer desabilitado. Assim número estrangeiro
 * válido nunca cai no estado desabilitado, e linha legada não-normalizada
 * ainda cai (não temos como saber o país dela).
 */
export function normalizarTelefoneWhatsapp(telefone: string | null | undefined): string | null {
  const e164 = paraE164(telefone ?? "");
  return e164 ? somenteDigitos(e164) : null;
}

export function linkWhatsapp(telefone: string | null | undefined, mensagem: string): string | null {
  const numero = normalizarTelefoneWhatsapp(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
