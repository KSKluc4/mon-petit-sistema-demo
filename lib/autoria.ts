/**
 * Quem fez cada ação — o par (nome, id) e como ele é exibido.
 *
 * ── POR QUE O NOME É SNAPSHOT E O ID VAI JUNTO ───────────────────────────
 *
 * O NOME é congelado no momento da ação: a pessoa pode se renomear em /conta
 * (`atualizarNomeAction`), e um histórico que passa a dizer outra coisa depois
 * do fato deixa de ser histórico. Mesmo princípio do `taxaBps` snapshot.
 *
 * O ID vai junto porque o nome sozinho não desempata: `atualizarNomeAction`
 * não valida unicidade, então dois usuários podem em tese carregar o mesmo
 * nome de exibição — e aí a autoria vira exatamente a adivinhação que ela
 * existe para evitar.
 *
 * Não é FK: `Usuario` nunca é apagado (são 2 contas, sem tela de gestão), e uma
 * relação de verdade exigiria uma back-relation em `Usuario` para cada campo de
 * autoria do sistema, sem ganho nenhum.
 */

/** Quem está fazendo a ação. Sai direto da sessão: `session.nome` + `session.sub`. */
export type Autor = { nome: string; id: string };

/**
 * Como um campo de autoria aparece na tela.
 *
 * Nulo significa **"anterior ao registro de autoria"** — o registro é de antes
 * de 05/08/2026, quando o campo passou a ser gravado. NUNCA "sem responsável":
 * isso afirmaria que ninguém fez, quando a verdade é que ninguém anotou. É a
 * mesma recusa que impede valor nulo de virar R$ 0,00 e taxa nula de virar 0%.
 */
export const AUTOR_DESCONHECIDO = "anterior ao registro de autoria";

export function formatarAutor(nome: string | null | undefined): string {
  return nome?.trim() || AUTOR_DESCONHECIDO;
}

/** "Recebido por Ana" / "Recebido por (anterior ao registro de autoria)". */
export function comAutor(prefixo: string, nome: string | null | undefined): string {
  const autor = nome?.trim();
  return autor ? `${prefixo} ${autor}` : `${prefixo} — ${AUTOR_DESCONHECIDO}`;
}
