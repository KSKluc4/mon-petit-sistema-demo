import "server-only";
import { prisma } from "./prisma";
import type { Autor } from "./autoria";
import type { Prisma } from "@/app/generated/prisma/client";

/**
 * REGISTRO DE ATIVIDADE — a escrita, num lugar só.
 *
 * Complementa os campos de autoria (`lib/autoria.ts`), que resolvem "quem fez
 * isto?" enquanto a linha existe. Aqui ficam os dois casos que uma coluna não
 * resolve: a linha que SOME (exclusão) e a mudança que precisa do ANTES.
 *
 * ── A REGRA QUE NÃO PODE SER AFROUXADA ───────────────────────────────────
 *
 * O registro é gravado na MESMA TRANSAÇÃO da mudança que ele descreve. Se a
 * mudança acontecer e o log falhar, fica um dado alterado sem rastro — que é
 * exatamente o buraco que esta tabela existe para fechar. Por isso
 * `registrarAtividade` recebe o `tx` da transação em curso: passar o `prisma`
 * global funciona e é o jeito errado sempre que houver uma transação por perto.
 *
 * Append-only: não existe função de editar nem de apagar registro, e não deve
 * passar a existir. Um log reescrevível não diz o que aconteceu.
 */

/**
 * As ações registradas. Const e não enum de banco: acrescentar uma é mudança de
 * código, não migration.
 *
 * O que está FORA é decisão, não esquecimento — criar/editar cliente e pet,
 * criar agendamento, criar serviço, padrão do pet e alteração do próprio
 * nome/senha não apagam dado nem mexem em dinheiro, e enchê-lo de ruído é como
 * um log deixa de ser lido.
 */
export const ACOES = {
  CLIENTE_EXCLUIDO: "cliente.excluido",
  PET_EXCLUIDO: "pet.excluido",
  TAXA_ALTERADA: "taxa.alterada",
  AGENDAMENTO_REATIVADO: "agendamento.reativado",
  PAGAMENTO_CORRIGIDO: "pagamento.corrigido",
  ATENDIMENTO_DESFEITO: "atendimento.desfeito",
  // Renomear reetiqueta retroativamente a tabela "Por serviço" do relatório
  // (agrupa por servicoId, exibe o nome ATUAL) — sem isto, um relatório já
  // enviado à contadora deixa de bater com a tela e nada explica por quê.
  SERVICO_RENOMEADO: "servico.renomeado",
  SERVICO_DESATIVADO: "servico.desativado",
  SERVICO_REATIVADO: "servico.reativado",
  // Segurança, não ruído. NUNCA grava a senha, o hash ou qualquer parte deles.
  SENHA_REDEFINIDA: "senha.redefinida",
} as const;

export type Acao = (typeof ACOES)[keyof typeof ACOES];

/** Cliente do Prisma ou uma transação em curso — as duas servem. */
type Executor = Pick<typeof prisma, "registroAtividade">;

export type NovaAtividade = {
  autor: Autor;
  acao: Acao;
  entidade: string;
  /** Nulo quando a entidade deixou de existir e o id não leva a lugar nenhum. */
  entidadeId?: string | null;
  /**
   * A frase pronta, em português, como ela vai aparecer na tela. Escrita aqui e
   * congelada: um registro antigo não passa a ser descrito de outro jeito
   * quando o código muda, e a tela não precisa de um switch para montar texto.
   */
  descricao: string;
  antes?: Prisma.InputJsonValue | null;
  depois?: Prisma.InputJsonValue | null;
};

export async function registrarAtividade(tx: Executor, dados: NovaAtividade): Promise<void> {
  await tx.registroAtividade.create({
    data: {
      usuarioId: dados.autor.id,
      usuarioNome: dados.autor.nome,
      acao: dados.acao,
      entidade: dados.entidade,
      entidadeId: dados.entidadeId ?? null,
      descricao: dados.descricao,
      antes: dados.antes ?? undefined,
      depois: dados.depois ?? undefined,
    },
  });
}

/** Centavos para "R$ 85,00" dentro de uma descrição. */
export function reaisNaDescricao(centavos: number | null): string {
  if (centavos === null) return "sem valor";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100,
  );
}

/** Pontos-base para "3,39%" dentro de uma descrição. Nulo = não configurada. */
export function taxaNaDescricao(bps: number | null): string {
  return bps === null ? "não configurada" : `${(bps / 100).toFixed(2).replace(".", ",")}%`;
}
