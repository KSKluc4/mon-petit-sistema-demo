import type { Sexo } from "@/app/generated/prisma/client";

/**
 * Concordância de gênero nos textos que citam o pet pelo nome.
 *
 * Antes tudo era masculino fixo, então uma cadela virava "do Mila" e "O Mila
 * foi um amor" — a mensagem chegava errada no WhatsApp da cliente.
 *
 * Sem "server-only": o formulário de cancelamento (componente de cliente) e as
 * mensagens do WhatsApp usam as mesmas funções.
 *
 * **Quando o sexo é `null`, não se chuta masculino: a frase é reformulada para
 * não precisar de gênero** (some o artigo). Hoje `Pet.sexo` é NOT NULL e o
 * formulário obriga a escolha, então esse caminho não acontece na prática —
 * ele existe para o dia em que o campo virar opcional, e para não deixar a
 * decisão de "o que fazer sem sexo" espalhada por aí.
 */

/** "o Thor" · "a Mila" · "Mila" (sem artigo quando o sexo é desconhecido). */
export function comArtigo(nome: string, sexo: Sexo | null): string {
  if (sexo === "MACHO") return `o ${nome}`;
  if (sexo === "FEMEA") return `a ${nome}`;
  return nome;
}

/** Igual a `comArtigo`, com a inicial maiúscula: "O Thor" · "A Mila" · "Mila". */
export function comArtigoMaiusculo(nome: string, sexo: Sexo | null): string {
  const texto = comArtigo(nome, sexo);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Contração de + artigo: "do Thor" · "da Mila" · "de Mila". */
export function deArtigo(nome: string, sexo: Sexo | null): string {
  if (sexo === "MACHO") return `do ${nome}`;
  if (sexo === "FEMEA") return `da ${nome}`;
  return `de ${nome}`;
}
