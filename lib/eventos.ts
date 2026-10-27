/**
 * Categorias de evento da tela de Atividade.
 *
 * Sem "server-only", e é por isso que este arquivo existe separado de
 * `lib/linhaDoTempo.ts`: o filtro de tipo é componente de CLIENTE e precisa da
 * mesma lista que o servidor usa para consultar. Um `import "server-only"` no
 * caminho quebra o build inteiro — mesma razão de `lib/periodos.ts` estar fora
 * da regra.
 */

/**
 * Agrupamento do filtro. Quatro, e não nove, para não virar várias linhas de
 * botão no celular.
 *
 * "Acesso" existe porque nenhuma das outras três diz a verdade sobre uma senha
 * redefinida. Enfiá-la em Exclusões obrigaria quem procura "quem trocou minha
 * senha?" a adivinhar onde ela mora — e esta tela existe para eliminar
 * adivinhação. Categoria que mente é pior que categoria a mais.
 *
 * Se as pílulas não couberem numa linha, quem rola é a linha (TipoFiltro), não
 * a página — mesmo padrão da nav do header. Apertar o padding até caber
 * quebraria o alvo de toque de 44px.
 */
export type CategoriaEvento = "dinheiro" | "exclusao" | "agenda" | "acesso";

export const CATEGORIAS: { id: CategoriaEvento; label: string }[] = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "exclusao", label: "Exclusões" },
  { id: "agenda", label: "Agenda" },
  { id: "acesso", label: "Acesso" },
];

/**
 * A categoria de cada ação do registro de atividade. O critério é de onde
 * nasce a pergunta de quem está investigando:
 * - renomear serviço → Dinheiro, como a taxa: é cadastro que muda como o
 *   dinheiro aparece no relatório já enviado à contadora;
 * - desativar/reativar serviço → Agenda: o efeito sentido é o serviço sumir
 *   (ou voltar) na tela de agendar — histórico e relatório não mudam;
 * - redefinir senha → Acesso: a pergunta é "quem trocou minha senha / por que
 *   fui desconectado?", e é aí que ela é procurada.
 */
export const CATEGORIA_DA_ACAO: Record<string, CategoriaEvento> = {
  "cliente.excluido": "exclusao",
  "pet.excluido": "exclusao",
  "senha.redefinida": "acesso",
  "taxa.alterada": "dinheiro",
  "pagamento.corrigido": "dinheiro",
  "servico.renomeado": "dinheiro",
  "agendamento.reativado": "agenda",
  "atendimento.desfeito": "agenda",
  "servico.desativado": "agenda",
  "servico.reativado": "agenda",
};

/** Lê as categorias do parâmetro `?tipos=dinheiro,agenda`. Vazio = tudo. */
export function lerCategorias(bruto: string | undefined): CategoriaEvento[] {
  if (!bruto) return [];
  const validas = CATEGORIAS.map((c) => c.id) as string[];
  return bruto
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is CategoriaEvento => validas.includes(s));
}
