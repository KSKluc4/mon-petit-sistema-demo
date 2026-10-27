"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { ACOES, reaisNaDescricao, registrarAtividade } from "@/lib/atividade";
import { prisma } from "@/lib/prisma";
import {
  dataHoraLocal,
  dataISOValida,
  formatDiaMes,
  formatHora,
  horaValida,
  intervaloDoDia,
} from "@/lib/datas";
import {
  corrigirRecebimento,
  estornarRecebimento,
  lerParcelas,
  registrarRecebimento,
} from "@/lib/recebimento";
import { PacoteIndisponivelError, consumirBanhoNaTransacao, pacoteDaVez } from "@/lib/pacotes";
import { Prisma } from "@/app/generated/prisma/client";

export type AgendamentoFormState = { error?: string };

// O valor é livre por atendimento: o formulário manda centavos já validados
// pela máscara, e string vazia significa "valor a definir" (nulo).
function lerValorTotal(formData: FormData): number | null {
  const bruto = String(formData.get("valorTotal") ?? "").trim();
  if (!bruto) return null;
  const centavos = Number(bruto);
  if (!Number.isInteger(centavos) || centavos < 0) return null;
  return centavos;
}

export async function createAgendamentoAction(
  _prevState: AgendamentoFormState,
  formData: FormData,
): Promise<AgendamentoFormState> {
  await requireSession();

  const petId = String(formData.get("petId") ?? "");
  const data = String(formData.get("data") ?? "");
  const hora = String(formData.get("hora") ?? "");
  const servicoIds = formData.getAll("servicoIds").map(String);
  const valorTotal = lerValorTotal(formData);
  const observacoes = String(formData.get("observacoes") ?? "").trim();

  if (!petId) return { error: "Selecione o pet." };
  if (!dataISOValida(data)) return { error: "Informe uma data válida." };
  if (!horaValida(hora)) return { error: "Informe um horário válido." };
  if (servicoIds.length === 0) return { error: "Selecione pelo menos 1 serviço." };

  const pet = await prisma.pet.findUnique({ where: { id: petId } });
  if (!pet) return { error: "Pet não encontrado." };

  const servicos = await prisma.servico.findMany({ where: { id: { in: servicoIds } } });
  if (servicos.length !== servicoIds.length) {
    return { error: "Serviço inválido selecionado." };
  }

  // Marcação de pacote: INTENÇÃO, não reserva de saldo. Serve para a agenda
  // identificar a visita e para o fechamento já vir com a opção ligada. Quem
  // decide de verdade é o fechamento, que reconfere o saldo na hora — entre
  // marcar e atender o pacote pode acabar ou vencer.
  const pacoteMarcado = formData.get("usarPacote") === "1" ? await pacoteDaVez(petId) : null;

  // Sem valor informado o agendamento é salvo como "valor a definir" — quem
  // atender preenche na entrega.
  await prisma.agendamento.create({
    data: {
      dataHora: dataHoraLocal(data, hora),
      petId,
      valorTotal,
      pacoteId: pacoteMarcado?.id ?? null,
      observacoes: observacoes || null,
      servicos: {
        // Serviço não tem mais preço próprio: só o total do atendimento vale.
        create: servicos.map((s) => ({ servicoId: s.id })),
      },
    },
  });

  redirect(`/agenda?data=${data}`);
}

// Horários já ocupados num dia (para o aviso discreto de conflito no formulário).
// Cancelado não ocupa horário — é isso que faz o cancelamento liberar a vaga.
// `ignorarId` existe para a edição: o próprio agendamento não pode aparecer
// como conflito consigo mesmo.
export async function getHorariosOcupadosAction(
  dataISO: string,
  ignorarId?: string,
): Promise<string[]> {
  await requireSession();
  if (!dataISOValida(dataISO)) return [];

  const { inicio, fim } = intervaloDoDia(dataISO);
  const agendamentos = await prisma.agendamento.findMany({
    where: {
      dataHora: { gte: inicio, lt: fim },
      status: { not: "CANCELADO" },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
    select: { dataHora: true },
  });
  return agendamentos.map((a) => formatHora(a.dataHora));
}

// Editar um agendamento que ainda não foi finalizado. Não permite trocar o pet:
// para isso, cancela-se este e cria-se outro.
export async function updateAgendamentoAction(
  agendamentoId: string,
  _prevState: AgendamentoFormState,
  formData: FormData,
): Promise<AgendamentoFormState> {
  await requireSession();

  const data = String(formData.get("data") ?? "");
  const hora = String(formData.get("hora") ?? "");
  const servicoIds = [...new Set(formData.getAll("servicoIds").map(String))];
  const valorTotal = lerValorTotal(formData);
  const observacoes = String(formData.get("observacoes") ?? "").trim();

  if (!dataISOValida(data)) return { error: "Informe uma data válida." };
  if (!horaValida(hora)) return { error: "Informe um horário válido." };
  if (servicoIds.length === 0) return { error: "Selecione pelo menos 1 serviço." };

  const ag = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    include: { servicos: true },
  });
  if (!ag) return { error: "Agendamento não encontrado." };
  if (ag.status === "FINALIZADO") {
    return { error: "Atendimento já finalizado — não dá mais para editar." };
  }
  if (ag.status === "CANCELADO") {
    return { error: "Agendamento cancelado. Reative antes de editar." };
  }

  const servicos = await prisma.servico.findMany({ where: { id: { in: servicoIds } } });
  if (servicos.length !== servicoIds.length) {
    return { error: "Serviço inválido selecionado." };
  }

  // Mexe só no que mudou: assim o valorCobrado dos serviços mantidos (snapshot
  // de preço dos agendamentos antigos) não se perde numa reescrita cega.
  const atuais = new Set(ag.servicos.map((s) => s.servicoId));
  const novos = new Set(servicoIds);
  const remover = ag.servicos.filter((s) => !novos.has(s.servicoId)).map((s) => s.id);
  const adicionar = servicoIds.filter((id) => !atuais.has(id));

  await prisma.$transaction([
    ...(remover.length
      ? [prisma.agendamentoServico.deleteMany({ where: { id: { in: remover } } })]
      : []),
    ...(adicionar.length
      ? [
          prisma.agendamentoServico.createMany({
            data: adicionar.map((servicoId) => ({ agendamentoId, servicoId })),
          }),
        ]
      : []),
    prisma.agendamento.update({
      where: { id: agendamentoId },
      data: {
        dataHora: dataHoraLocal(data, hora),
        valorTotal,
        observacoes: observacoes || null,
      },
    }),
  ]);

  revalidatePath(`/agendamentos/${agendamentoId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
  redirect(`/agendamentos/${agendamentoId}`);
}

export type SugestaoValor = {
  // true = mesma combinação de serviços; false = último atendimento do pet.
  mesmaCombinacao: boolean;
  valor: number;
  servicos: string;
  diaMes: string;
};

// Sugestão do último valor cobrado deste pet, para o atendente não ter que
// lembrar de cabeça. Nunca preenche sozinho — quem decide é o toque no botão.
export async function getSugestaoValorAction(
  petId: string,
  servicoIds: string[],
): Promise<SugestaoValor | null> {
  await requireSession();
  if (!petId) return null;

  const atendimentos = await prisma.atendimento.findMany({
    where: {
      valorTotal: { not: null },
      agendamento: { petId, status: "FINALIZADO" },
    },
    orderBy: { data: "desc" },
    take: 20,
    include: { agendamento: { select: { servicos: { select: { servicoId: true } } } } },
  });
  if (atendimentos.length === 0) return null;

  const chave = (ids: string[]) => [...new Set(ids)].sort().join("|");
  const alvo = chave(servicoIds);
  const exato = alvo
    ? atendimentos.find((a) => chave(a.agendamento.servicos.map((s) => s.servicoId)) === alvo)
    : undefined;

  // Sem combinação idêntica, cai para o atendimento mais recente do pet.
  const escolhido = exato ?? atendimentos[0];
  return {
    mesmaCombinacao: Boolean(exato),
    valor: escolhido.valorTotal!,
    servicos: escolhido.servicosRealizados,
    diaMes: formatDiaMes(escolhido.data),
  };
}

// --- Tela de atendimento: botões de um toque que avançam o fluxo. ---
// Só restam dois passos (Pet pronto → Entregue): a cliente pediu para tirar as
// etapas intermediárias, que ninguém marcava no meio do banho.

// Pet pronto para retirada. O dashboard e a agenda passam a mostrá-lo em
// amarelo, e é aqui que o botão de WhatsApp "Pet pronto" aparece.
export async function petProntoAction(agendamentoId: string) {
  await requireSession();
  await prisma.agendamento.update({
    where: { id: agendamentoId },
    data: { status: "PRONTO" },
  });
  revalidatePath(`/agendamentos/${agendamentoId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
  redirect(`/agendamentos/${agendamentoId}`);
}

// Cancelar: só antes de finalizar. O motivo é opcional.
export async function cancelarAgendamentoAction(agendamentoId: string, formData: FormData) {
  await requireSession();

  const motivo = String(formData.get("motivo") ?? "").trim();

  const ag = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    select: { status: true },
  });
  if (!ag || (ag.status !== "AGENDADO" && ag.status !== "PRONTO")) {
    redirect(`/agendamentos/${agendamentoId}`);
  }

  await prisma.agendamento.update({
    where: { id: agendamentoId },
    data: {
      status: "CANCELADO",
      motivoCancelamento: motivo || null,
    },
  });

  revalidatePath(`/agendamentos/${agendamentoId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
  redirect(`/agendamentos/${agendamentoId}`);
}

// Cliente remarcou no mesmo dia é comum: desfaz o cancelamento e devolve o
// agendamento para AGENDADO, do começo do fluxo. O motivo do cancelamento sai
// junto — ele descrevia um cancelamento que não vale mais.
export async function reativarAgendamentoAction(agendamentoId: string) {
  const session = await requireSession();

  const ag = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    select: { status: true, motivoCancelamento: true, pet: { select: { nome: true } } },
  });
  if (!ag || ag.status !== "CANCELADO") {
    redirect(`/agendamentos/${agendamentoId}`);
  }

  // Reativar APAGA o motivo do cancelamento — o único rastro de que houve um.
  // Sem este registro, "por que isto foi cancelado em julho?" fica sem resposta
  // depois que alguém reativa.
  await prisma.$transaction(async (tx) => {
    await tx.agendamento.update({
      where: { id: agendamentoId },
      data: { status: "AGENDADO", motivoCancelamento: null },
    });
    await registrarAtividade(tx, {
      autor: { nome: session.nome, id: session.sub },
      acao: ACOES.AGENDAMENTO_REATIVADO,
      entidade: "Agendamento",
      entidadeId: agendamentoId,
      descricao:
        `Reativou o agendamento de ${ag.pet.nome}` +
        (ag.motivoCancelamento ? `, cancelado por: “${ag.motivoCancelamento}”` : ""),
      antes: { status: "CANCELADO", motivoCancelamento: ag.motivoCancelamento },
      depois: { status: "AGENDADO", motivoCancelamento: null },
    });
  });

  revalidatePath(`/agendamentos/${agendamentoId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
  redirect(`/agendamentos/${agendamentoId}`);
}

/**
 * Corrige um toque errado: desfaz um degrau do fluxo. Se o atendimento já
 * estava FINALIZADO, apaga o registro de histórico criado por ele.
 *
 * ── O QUE MUDOU EM 05/08/2026, E POR QUÊ ─────────────────────────────────
 *
 * Este delete não olhava o pagamento. Um toque aqui num atendimento já pago
 * levava embora `valorTotal`, `formaId`, `taxaBps` e `dataRecebimento` juntos:
 * o recebimento sumia do Caixa, o faturamento de um período possivelmente já
 * fechado mudava sozinho, e não sobrava linha nenhuma dizendo que existiu. Era
 * o modo de falha que o regime de caixa existe para evitar, alcançável por um
 * toque atrás de um `confirm()`.
 *
 * Hoje: sem pagamento, apaga como sempre (é o caminho rápido de corrigir um
 * toque errado, e nenhum registro de dinheiro se perde). Com pagamento,
 * recusa e manda para a ferramenta certa — corrigir o número, ou registrar a
 * devolução. O banco reforça isso por conta própria: a FK de
 * `AtendimentoEstorno` é `ON DELETE RESTRICT`.
 */
export async function voltarEtapaAction(agendamentoId: string) {
  const session = await requireSession();

  const ag = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    include: {
      pet: { select: { nome: true } },
      atendimento: {
        select: {
          id: true,
          dataRecebimento: true,
          valorTotal: true,
          servicosRealizados: true,
          responsavel: true,
          observacoes: true,
          estornos: { select: { id: true } },
        },
      },
    },
  });
  if (!ag) return;

  if (ag.status === "FINALIZADO") {
    const at = ag.atendimento;
    // A recusa vai por querystring porque esta ação é um form simples, sem
    // estado de erro — a ficha lê o parâmetro e mostra o aviso com o que fazer.
    if (at && (at.dataRecebimento !== null || at.estornos.length > 0)) {
      redirect(`/agendamentos/${agendamentoId}?erro=pago`);
    }

    // Não há dinheiro a perder aqui, mas o registro de histórico SOME — e some
    // é a palavra: sem este log, "sumiu um atendimento da ficha da Mila" não
    // teria onde ser investigado.
    await prisma.$transaction(async (tx) => {
      await tx.atendimento.deleteMany({ where: { agendamentoId } });
      await tx.agendamento.update({
        where: { id: agendamentoId },
        data: { status: "PRONTO" },
      });
      if (at) {
        await registrarAtividade(tx, {
          autor: { nome: session.nome, id: session.sub },
          acao: ACOES.ATENDIMENTO_DESFEITO,
          entidade: "Agendamento",
          entidadeId: agendamentoId,
          descricao:
            `Desfez a finalização do atendimento de ${ag.pet.nome} ` +
            `(${at.servicosRealizados}, ${reaisNaDescricao(at.valorTotal)}), sem pagamento registrado`,
          antes: {
            servicosRealizados: at.servicosRealizados,
            valorTotal: at.valorTotal,
            responsavel: at.responsavel,
            observacoes: at.observacoes,
          },
        });
      }
    });
  } else if (ag.status === "PRONTO") {
    await prisma.agendamento.update({ where: { id: agendamentoId }, data: { status: "AGENDADO" } });
  }

  revalidatePath(`/agendamentos/${agendamentoId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
  revalidatePath("/caixa");
  redirect(`/agendamentos/${agendamentoId}`);
}

export type FecharAtendimentoState = { error?: string };

// Ao tocar em "Entregue": registra o Atendimento (histórico) e finaliza o
// agendamento. "Receber depois" finaliza sem forma de pagamento definida.
export async function finalizarAtendimentoAction(
  agendamentoId: string,
  _prevState: FecharAtendimentoState,
  formData: FormData,
): Promise<FecharAtendimentoState> {
  const session = await requireSession();

  const acao = String(formData.get("acao") ?? "confirmar");
  const formaId = String(formData.get("formaId") ?? "");
  const valorTotal = lerValorTotal(formData);
  const observacoesAtendimento = String(formData.get("observacoesAtendimento") ?? "").trim();

  const ag = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    include: { servicos: { include: { servico: true } } },
  });
  if (!ag) return { error: "Agendamento não encontrado." };

  // O banho sai do pacote? A intenção vem do formulário, mas quem decide QUAL
  // pacote é o servidor, e sempre o mais antigo ainda ativo — entre agendar e
  // atender o pacote pode ter acabado, vencido ou sido cancelado.
  const querPacote = formData.get("usarPacote") === "1";
  const pacote = querPacote ? await pacoteDaVez(ag.petId) : null;
  if (querPacote && !pacote) {
    return {
      error:
        "Este pet não tem mais pacote com saldo — o anterior acabou ou venceu. Feche cobrando o valor, ou venda um pacote novo na ficha do pet.",
    };
  }

  // Com pacote, o valor digitado é SÓ o extra do dia (desembolo, tosa...), e
  // vazio significa que não houve extra — zero de verdade, não "a definir".
  // NUNCA recebe o valor do pacote: é essa ausência que impede o dinheiro de
  // ser contado duas vezes (ver o cabeçalho de `Pacote` no schema).
  const valorFinal = pacote ? (valorTotal ?? 0) : valorTotal;
  // Só há o que receber se houver extra. Sem extra, o pagamento já aconteceu na
  // venda do pacote e não se pede forma nenhuma.
  const temAReceber = valorFinal !== null && valorFinal > 0;

  if (acao === "confirmar" && temAReceber && !formaId) {
    return { error: "Selecione a forma de pagamento, ou toque em “Receber depois”." };
  }
  // "Receber depois" pode ficar sem valor; marcar como pago, não.
  if (acao === "confirmar" && !pacote && valorTotal === null) {
    return { error: "Informe o valor do atendimento antes de registrar o pagamento." };
  }

  const servicosRealizados = ag.servicos.map((s) => s.servico.nome).join(" + ") || "—";

  // O Atendimento nasce SEM pagamento nos dois caminhos. Quando é para receber
  // agora, a baixa vem logo abaixo por `registrarRecebimento` — a mesma função
  // das outras duas telas, que é quem resolve a taxa e mantém a invariante
  // `formaId != null <=> dataRecebimento != null`. Duplicar a escrita aqui era
  // justamente o jeito de as duas divergirem.
  //
  // O atendimento e o consumo do banho nascem na MESMA transação: um banho
  // consumido sem atendimento (ou o contrário) desencontraria o saldo do
  // histórico, e não haveria como saber qual dos dois está certo.
  let atendimento: { id: string };
  try {
    atendimento = await prisma.$transaction(async (tx) => {
      const criado = await tx.atendimento.create({
        data: {
          agendamentoId,
          servicosRealizados,
          valorTotal: valorFinal,
          responsavel: session.nome,
          responsavelId: session.sub,
          observacoes: observacoesAtendimento || null,
        },
      });
      if (pacote) await consumirBanhoNaTransacao(tx, pacote.id, criado.id);
      await tx.agendamento.update({
        where: { id: agendamentoId },
        data: { status: "FINALIZADO", valorTotal: valorFinal },
      });
      return criado;
    });
  } catch (e) {
    // Dois aparelhos fechando o último banho ao mesmo tempo: o
    // `@@unique([pacoteId, indice])` derruba o segundo e a transação inteira
    // volta atrás — nada foi gravado pela metade. Melhor pedir para refazer do
    // que consumir um banho que não existia.
    if (e instanceof PacoteIndisponivelError) return { error: `${e.message} Feche cobrando o valor.` };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Esse banho do pacote acabou de ser usado noutro aparelho. Abra de novo a ficha." };
    }
    throw e;
  }

  if (acao === "confirmar" && temAReceber) {
    const { error } = await registrarRecebimento(
      atendimento.id,
      formaId,
      lerParcelas(formData.get("parcelas")),
      valorFinal,
      { nome: session.nome, id: session.sub },
    );
    // O atendimento já está criado e finalizado; se a baixa falhar, ele fica
    // como "a receber" e a própria ficha permite registrar de novo. Melhor do
    // que perder o fechamento inteiro por causa da forma de pagamento.
    if (error) return { error };
  }

  // Dashboard e caixa somam pelo Atendimento — precisam refletir na hora.
  revalidatePath("/");
  revalidatePath("/caixa");
  revalidatePath("/relatorios");
  redirect(`/agendamentos/${agendamentoId}`);
}

export type RegistrarPagamentoState = { error?: string };

// Preenche a forma de pagamento depois, para atendimentos fechados como
// "Receber depois". Se o atendimento ficou sem valor, ele vem junto aqui.
export async function registrarPagamentoAction(
  atendimentoId: string,
  agendamentoId: string,
  _prevState: RegistrarPagamentoState,
  formData: FormData,
): Promise<RegistrarPagamentoState> {
  const session = await requireSession();

  const { error } = await registrarRecebimento(
    atendimentoId,
    String(formData.get("formaId") ?? ""),
    lerParcelas(formData.get("parcelas")),
    lerValorTotal(formData),
    { nome: session.nome, id: session.sub },
  );
  if (error) return { error };

  revalidatePath(`/agendamentos/${agendamentoId}`);
  revalidatePath("/");
  revalidatePath("/caixa");
  revalidatePath("/relatorios");
  redirect(`/agendamentos/${agendamentoId}`);
}

export type CorrigirPagamentoState = { error?: string };

/**
 * "Corrigir pagamento" — o caso comum: valor (ou forma) digitado errado e
 * percebido no mesmo dia. Edita o recebimento em cima, sem inventar uma
 * devolução que não aconteceu. A regra do mesmo dia e o porquê estão em
 * `corrigirRecebimento` (lib/recebimento.ts).
 */
export async function corrigirPagamentoAction(
  atendimentoId: string,
  agendamentoId: string,
  _prevState: CorrigirPagamentoState,
  formData: FormData,
): Promise<CorrigirPagamentoState> {
  const session = await requireSession();

  const { error } = await corrigirRecebimento(
    atendimentoId,
    String(formData.get("formaId") ?? ""),
    lerParcelas(formData.get("parcelas")),
    lerValorTotal(formData),
    { nome: session.nome, id: session.sub },
  );
  if (error) return { error };

  revalidatePath(`/agendamentos/${agendamentoId}`);
  revalidatePath("/");
  revalidatePath("/caixa");
  revalidatePath("/relatorios");
  redirect(`/agendamentos/${agendamentoId}`);
}

export type DevolverDinheiroState = { error?: string };

/**
 * "Devolver dinheiro" — o dinheiro voltou de verdade para o cliente. Grava uma
 * linha de estorno datada de HOJE; o recebimento original continua contando no
 * período em que entrou. Ver `estornarRecebimento`.
 */
export async function devolverDinheiroAction(
  atendimentoId: string,
  agendamentoId: string,
  _prevState: DevolverDinheiroState,
  formData: FormData,
): Promise<DevolverDinheiroState> {
  const session = await requireSession();

  const { error } = await estornarRecebimento(
    atendimentoId,
    { nome: session.nome, id: session.sub },
    String(formData.get("motivo") ?? ""),
  );
  if (error) return { error };

  revalidatePath(`/agendamentos/${agendamentoId}`);
  revalidatePath("/");
  revalidatePath("/caixa");
  revalidatePath("/relatorios");
  redirect(`/agendamentos/${agendamentoId}`);
}
