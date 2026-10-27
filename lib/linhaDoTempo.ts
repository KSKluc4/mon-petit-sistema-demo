import "server-only";
import { prisma } from "./prisma";
import { AUTOR_DESCONHECIDO } from "./autoria";
import { intervaloEntre } from "./datas";
import { deArtigo, comArtigo } from "./genero";
import { reaisNaDescricao } from "./atividade";
import { CATEGORIA_DA_ACAO, type CategoriaEvento } from "./eventos";

/**
 * A LINHA DO TEMPO da tela `/atividade` — uma lista só, de quatro fontes.
 *
 * ── POR QUE JUNTAR ───────────────────────────────────────────────────────
 *
 * Quem abre esta tela está INVESTIGANDO ("sumiu um valor do caixa de terça") e
 * não sabe de antemão em qual mecanismo a resposta mora. Duas telas — uma para
 * o `RegistroAtividade` e outra para as devoluções — obrigariam a pessoa a
 * adivinhar onde procurar, que é exatamente o que a rastreabilidade existe
 * para eliminar.
 *
 * As quatro fontes:
 *
 *   RegistroAtividade   o que não deixa linha própria (exclusões, taxa...)
 *   AtendimentoEstorno  dinheiro devolvido ao cliente
 *   Pacote              venda de pacote
 *   PacoteEstorno       cancelamento de venda
 *
 * As três últimas JÁ têm linha própria com autor, e não são duplicadas no
 * `RegistroAtividade` — elas são lidas de onde estão. Duplicar criaria duas
 * fontes podendo discordar sobre o mesmo fato.
 *
 * ── O QUE FICA DE FORA, E POR QUÊ ────────────────────────────────────────
 *
 * Recebimento e finalização de atendimento NÃO entram. Eles acontecem em todo
 * atendimento — encheriam a lista a ponto de esconder justamente o evento raro
 * que alguém veio procurar. Quem fez cada um está na ficha e no Caixa (item de
 * autoria), que é onde essa pergunta nasce. Mesmo critério que manteve
 * criar/editar cliente fora do registro de atividade.
 */

export type Evento = {
  id: string;
  quando: Date;
  /** Nome de quem fez, já resolvido: nunca vazio, nunca "sem responsável". */
  quem: string;
  /** A frase, em português, pronta para ler. Sem jargão de sistema. */
  texto: string;
  /** Motivo/observação que a pessoa escreveu, quando houve. */
  observacao: string | null;
  categoria: CategoriaEvento;
  /** Para onde ir ver, quando ainda existe algo para ver. */
  link: string | null;
};

export async function listarLinhaDoTempo(
  inicioISO: string,
  fimISO: string,
  categorias: CategoriaEvento[],
): Promise<Evento[]> {
  const { inicio, fim } = intervaloEntre(inicioISO, fimISO);
  const quer = (c: CategoriaEvento) => categorias.length === 0 || categorias.includes(c);

  const [registros, devolucoes, vendas, cancelamentos] = await Promise.all([
    prisma.registroAtividade.findMany({
      where: { criadoEm: { gte: inicio, lt: fim } },
      orderBy: { criadoEm: "desc" },
    }),
    quer("dinheiro")
      ? prisma.atendimentoEstorno.findMany({
          where: { criadoEm: { gte: inicio, lt: fim } },
          include: {
            atendimento: {
              include: { agendamento: { include: { pet: true } } },
            },
          },
        })
      : Promise.resolve([]),
    quer("dinheiro")
      ? prisma.pacote.findMany({
          where: { dataCompra: { gte: inicio, lt: fim } },
          include: { pet: true },
        })
      : Promise.resolve([]),
    quer("dinheiro")
      ? prisma.pacoteEstorno.findMany({
          where: { criadoEm: { gte: inicio, lt: fim } },
          include: { pacote: { include: { pet: true } } },
        })
      : Promise.resolve([]),
  ]);

  const eventos: Evento[] = [];

  for (const r of registros) {
    const categoria = CATEGORIA_DA_ACAO[r.acao] ?? "agenda";
    if (!quer(categoria)) continue;
    eventos.push({
      id: `reg-${r.id}`,
      quando: r.criadoEm,
      quem: r.usuarioNome || AUTOR_DESCONHECIDO,
      // A descrição foi escrita e congelada no momento do fato — já vem pronta
      // e já traz o antes→depois quando ele existe.
      texto: r.descricao,
      observacao: null,
      categoria,
      // Só linka o que ainda existe. Exclusão não tem para onde levar.
      link: r.entidadeId && r.entidade === "Agendamento" ? `/agendamentos/${r.entidadeId}` : null,
    });
  }

  for (const e of devolucoes) {
    const pet = e.atendimento.agendamento.pet;
    eventos.push({
      id: `dev-${e.id}`,
      quando: e.criadoEm,
      quem: e.feitoPor || AUTOR_DESCONHECIDO,
      texto: `Devolveu ${reaisNaDescricao(e.valor)} do atendimento ${deArtigo(pet.nome, pet.sexo)}`,
      observacao: e.motivo,
      categoria: "dinheiro",
      link: `/agendamentos/${e.atendimento.agendamentoId}`,
    });
  }

  for (const p of vendas) {
    eventos.push({
      id: `pac-${p.id}`,
      quando: p.dataCompra,
      quem: p.vendidoPor || AUTOR_DESCONHECIDO,
      texto:
        `Vendeu um pacote de ${p.banhosTotal} banhos para ${comArtigo(p.pet.nome, p.pet.sexo)} ` +
        `por ${reaisNaDescricao(p.valorTotal)}`,
      observacao: p.observacoes,
      categoria: "dinheiro",
      link: `/pets/${p.petId}?tab=pacotes`,
    });
  }

  for (const c of cancelamentos) {
    const pet = c.pacote.pet;
    eventos.push({
      id: `pce-${c.id}`,
      quando: c.criadoEm,
      quem: c.feitoPor || AUTOR_DESCONHECIDO,
      texto:
        `Cancelou a venda do pacote ${deArtigo(pet.nome, pet.sexo)} e devolveu ` +
        `${reaisNaDescricao(c.valor)}`,
      observacao: c.motivo,
      categoria: "dinheiro",
      link: `/pets/${c.pacote.petId}?tab=pacotes`,
    });
  }

  // Do mais recente para o mais antigo: quem investiga começa por "o que
  // aconteceu por último".
  return eventos.sort((a, b) => b.quando.getTime() - a.quando.getTime());
}
