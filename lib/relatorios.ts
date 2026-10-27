import "server-only";
import { prisma } from "./prisma";
import { addMeses, dataISODe, formatMesAnoCurto, intervaloEntre, primeiroDiaDoMes } from "./datas";
import {
  FILTRO_PAGO,
  classificarAtendimento,
  somarRecebimentos,
  type SituacaoAtendimento,
} from "./faturamento";
import { valoresDoPagamento } from "./pagamento";
import { banhosDePacoteNoIntervalo, faturamentoPacotesDoIntervalo } from "./pacotes";

/**
 * Agregações da tela de Relatórios.
 *
 * Tudo o que a tela mostra, o Excel exporta e o PDF imprime sai de
 * `gerarRelatorio()` — uma chamada só. É de propósito: se a planilha que vai
 * para a contabilidade fosse calculada por outro caminho que não a tela, os
 * dois divergiriam em silêncio, e o número errado só apareceria no fechamento
 * do mês.
 *
 * REGRA DE CONTAGEM (CLAUDE.md → "valor livre por atendimento"):
 * o faturamento e TODAS as tabelas por serviço/pet/forma consideram apenas
 * atendimentos **pagos** (com valor definido E forma de pagamento registrada).
 * Atendimento sem valor é "a definir", nunca R$ 0,00, e fica de fora — aparece
 * como pendência. Cancelado nunca gera Atendimento, então é contado à parte,
 * direto em `Agendamento`.
 *
 * DUAS BASES DE DATA, de propósito (02/08/2026). O relatório faz duas consultas
 * porque o período responde a duas perguntas diferentes, e uma só não fecha as
 * duas:
 *
 *   - `recebidos`  — filtra por `dataRecebimento`. É o DINHEIRO: faturamento,
 *     ticket médio, por serviço, por pet, por forma de pagamento e o gráfico.
 *     Regime de caixa, ver lib/faturamento.ts.
 *   - `realizados` — filtra por `data`. É a OPERAÇÃO: a listagem detalhada e as
 *     pendências do período.
 *
 * Filtrar tudo por `dataRecebimento` faria as pendências desaparecerem do
 * relatório (elas não têm data de recebimento) — sumir com número é tão ruim
 * quanto contar duas vezes. Filtrar tudo por `data` traria de volta o problema
 * que o regime de caixa resolve: relatório fechado mudando depois.
 *
 * Um atendimento pode legitimamente aparecer nas duas listas (feito e recebido
 * no mesmo período) ou só numa (feito em julho, recebido em agosto). O que ele
 * nunca faz é somar no faturamento de dois períodos: o dinheiro tem uma data só.
 */

export type LinhaServico = {
  servicoId: string;
  nome: string;
  // Quantas vezes o serviço foi realizado (conta atendimento combinado também).
  quantidade: number;
  // Recorte com valor conhecido: atendimentos em que este foi o ÚNICO serviço.
  qtdServicoUnico: number;
  faturamentoServicoUnico: number;
  mediaServicoUnico: number | null;
};

export type LinhaPet = {
  petId: string;
  petNome: string;
  tutorNome: string;
  visitas: number;
  total: number;
  ultimaVisita: Date;
};

export type LinhaFormaPagamento = {
  formaId: string;
  nome: string;
  quantidade: number;
  /** O que os clientes pagaram nesta forma. */
  bruto: number;
  /** O que a maquininha ficou. */
  taxa: number;
  /** O que entrou na conta. */
  liquido: number;
  /** Quantos desses recebimentos têm taxa desconhecida (líquido = bruto). */
  qtdSemTaxa: number;
};

export type PontoEvolucao = {
  mesISO: string;
  rotulo: string;
  faturamento: number;
};

export type LinhaDetalhada = {
  id: string;
  data: Date;
  petNome: string;
  tutorNome: string;
  servicos: string;
  valorTotal: number | null;
  /** Nome da forma escolhida, ou null enquanto o atendimento está em aberto. */
  formaNome: string | null;
  parcelas: number | null;
  taxaBps: number | null;
  taxa: number;
  liquido: number;
  situacao: SituacaoAtendimento;
  /** "Banho 2 de 4" quando a visita saiu de um pacote; nulo quando foi avulsa. */
  pacoteRotulo: string | null;
  /** Quem finalizou o atendimento. */
  responsavel: string;
  /** Quem deu a baixa. Nulo = em aberto, ou anterior ao registro de autoria. */
  recebidoPor: string | null;
  // Quando o dinheiro entrou. Nulo enquanto a conta está aberta.
  dataRecebimento: Date | null;
  // Pago, mas o dinheiro entrou FORA deste período — a linha aparece na
  // listagem (o atendimento foi feito aqui) e não compõe o faturamento daqui.
  // Sem esta marca a listagem visivelmente não somaria o número do topo da tela.
  recebidoForaDoPeriodo: boolean;
};

export type Relatorio = {
  inicioISO: string;
  fimISO: string;
  resumo: {
    /**
     * Recebido no período (regime de caixa), pelo BRUTO — o que os clientes
     * pagaram. É este o número que as tabelas por serviço e por pet atribuem, e
     * é contra ele que a reconciliação do rateio fecha: a taxa é um custo da
     * maquininha, não pertence a um serviço.
     */
    faturamento: number;
    /** O mesmo período pelo LÍQUIDO: o que efetivamente entrou na conta. */
    faturamentoLiquido: number;
    /** Quanto ficou em taxa de maquininha no período. */
    totalTaxas: number;
    /**
     * Recebimentos cuja taxa é desconhecida (anteriores ao controle de taxas,
     * ou forma sem taxa cadastrada). Neles o líquido foi contado igual ao
     * bruto, então o líquido do período é um limite SUPERIOR enquanto houver
     * algum. A tela precisa dizer isso.
     */
    qtdSemTaxa: number;
    qtdAtendimentos: number;
    ticketMedio: number | null;
    cancelados: number;
    // Pendências: ficam fora do faturamento, mostradas separadamente. Contadas
    // entre os atendimentos REALIZADOS no período.
    qtdAReceber: number;
    totalAReceber: number;
    qtdSemValor: number;
    // Atendimentos realizados no período, pagos ou não — a base da listagem.
    qtdRealizados: number;
    // Quanto do faturamento veio de atendimento feito FORA do período (quase
    // sempre uma pendência antiga paga aqui). É a linha que explica a diferença
    // entre "o que rendeu" e "o que foi feito" e fecha a reconciliação.
    recebidoDeForaDoPeriodo: number;
    qtdRecebidoDeForaDoPeriodo: number;

    // --- Pacotes (03/08/2026) ---
    // `faturamento` acima é a soma das duas fontes. Elas são disjuntas por
    // construção, então somar não conta nada duas vezes — ver o cabeçalho de
    // `Pacote` no schema.
    /**
     * Receita de atendimento avulso (e de extras cobrados junto do pacote), já
     * descontado o que foi devolvido no período. É o número exibido.
     */
    faturamentoAvulso: number;
    /**
     * O mesmo, ANTES das devoluções. É contra ele que o rateio por serviço
     * fecha e é ele que o ticket médio divide — as linhas de estorno não estão
     * em `pagos` e podem ser de outro período. Ver o comentário na função.
     */
    faturamentoAvulsoBruto: number;
    /** Venda de pacotes no período, já descontados os estornos. */
    faturamentoPacotes: number;
    qtdPacotesVendidos: number;
    /** Cancelamentos de venda de PACOTE que caíram neste período. */
    totalEstornado: number;
    qtdEstornos: number;
    /**
     * Dinheiro devolvido de ATENDIMENTO no período, pela data da devolução.
     * Já subtraído de `faturamento`/`faturamentoAvulso`, e mostrado numa linha
     * própria porque é a diferença entre o rateio (bruto) e o card (líquido).
     */
    totalEstornadoAvulso: number;
    qtdEstornosAvulso: number;
    /**
     * Banhos de pacote consumidos no período: serviço prestado SEM receita no
     * dia (o dinheiro entrou quando o pacote foi vendido). Sem este número o mês
     * parece mais fraco do que foi.
     */
    banhosDePacote: number;
  };
  porServico: {
    linhas: LinhaServico[];
    // Reconciliação: único + combinado sempre fecha com
    // `resumo.faturamentoAvulsoBruto` — NÃO com `resumo.faturamento`, que soma
    // venda de pacote (não passa por serviço) e já desconta devolução (que pode
    // ser de outro período).
    qtdServicoUnico: number;
    totalServicoUnico: number;
    qtdCombinado: number;
    totalCombinado: number;
  };
  porPet: LinhaPet[];
  porFormaPagamento: LinhaFormaPagamento[];
  evolucao: PontoEvolucao[];
  detalhado: LinhaDetalhada[];
};

export async function gerarRelatorio(inicioISO: string, fimISO: string): Promise<Relatorio> {
  const { inicio, fim } = intervaloEntre(inicioISO, fimISO);

  // O gráfico olha 12 meses para trás a partir do mês final do período, então
  // precisa de uma janela própria, mais larga que a do relatório.
  const mesInicialEvolucao = addMeses(primeiroDiaDoMes(fimISO), -11);
  const inicioEvolucao = intervaloEntre(mesInicialEvolucao, fimISO).inicio;

  const incluiPetEServicos = {
    forma: true,
    // Precisa vir junto: é o que distingue uma visita paga pelo pacote de um
    // atendimento avulso de graça — e o que a tira do rateio por serviço.
    consumoPacote: { include: { pacote: { select: { banhosTotal: true } } } },
    // Só para a listagem poder dizer "devolvido" em vez de "pago". NÃO muda a
    // conta do faturamento: quem tira o dinheiro é a linha de estorno, na data
    // dela (ver `estornosAtendimentoDoIntervalo`).
    estornos: { select: { id: true, data: true, valor: true } },
    agendamento: {
      include: {
        pet: { include: { cliente: true } },
        servicos: { include: { servico: true } },
      },
    },
  } as const;

  const [
    recebidos,
    realizados,
    cancelados,
    recebimentosEvolucao,
    pacotes,
    banhosDePacote,
    evolucaoPacotes,
    pacotesPorForma,
    estornosPorForma,
    estornosAtendimento,
    evolucaoEstornosAtendimento,
  ] = await Promise.all([
    // O DINHEIRO do período: filtra por data de recebimento. Alimenta o
    // faturamento e todas as tabelas agregadas.
    prisma.atendimento.findMany({
      where: {
        dataRecebimento: { gte: inicio, lt: fim },
        agendamento: { status: { not: "CANCELADO" } },
        ...FILTRO_PAGO,
      },
      orderBy: { dataRecebimento: "asc" },
      include: incluiPetEServicos,
    }),
    // A OPERAÇÃO do período: filtra pela data do atendimento. Alimenta a
    // listagem detalhada e as pendências — que não têm data de recebimento e
    // sumiriam da tela se dependessem da consulta acima.
    prisma.atendimento.findMany({
      where: { data: { gte: inicio, lt: fim }, agendamento: { status: { not: "CANCELADO" } } },
      orderBy: { data: "asc" },
      include: incluiPetEServicos,
    }),
    // Cancelado não gera Atendimento, então a data que existe é a do
    // agendamento — base de data diferente do resto da tela, dito lá também.
    prisma.agendamento.count({
      where: { dataHora: { gte: inicio, lt: fim }, status: "CANCELADO" },
    }),
    prisma.atendimento.findMany({
      where: {
        dataRecebimento: { gte: inicioEvolucao, lt: fim },
        agendamento: { status: { not: "CANCELADO" } },
        ...FILTRO_PAGO,
      },
      select: { dataRecebimento: true, valorTotal: true },
    }),
    // A segunda fonte de dinheiro: venda de pacote, já líquida dos estornos.
    faturamentoPacotesDoIntervalo(inicio, fim),
    // Serviço prestado sem receita no dia — conta à parte, nunca no faturamento.
    banhosDePacoteNoIntervalo(inicio, fim),
    // O gráfico de 12 meses precisa das duas fontes, senão contradiz os cards
    // logo acima dele na mesma tela — foi por isso que ele já tinha migrado
    // para a data de recebimento em 02/08/2026.
    prisma.pacote.findMany({
      where: { dataRecebimento: { gte: inicioEvolucao, lt: fim } },
      select: { dataRecebimento: true, valorTotal: true },
    }),
    // Venda de pacote passa pela MESMA maquininha, então entra na tabela "por
    // forma de pagamento" junto com os atendimentos. Sem isto, a soma das
    // linhas daria o avulso enquanto a linha de Total daria o faturamento
    // inteiro — a tabela não fecharia consigo mesma.
    prisma.pacote.findMany({
      where: { dataRecebimento: { gte: inicio, lt: fim } },
      select: { valorTotal: true, taxaBps: true, forma: true },
    }),
    prisma.pacoteEstorno.findMany({
      where: { data: { gte: inicio, lt: fim } },
      select: { valor: true, taxaBps: true, forma: true },
    }),
    // Dinheiro DEVOLVIDO de atendimento no período (05/08/2026). Filtra pela
    // data do estorno, não pela do recebimento original: devolver em setembro
    // um recebimento de agosto tem que sair de SETEMBRO, senão o mês que a
    // contadora já recebeu mudaria sozinho.
    prisma.atendimentoEstorno.findMany({
      where: { data: { gte: inicio, lt: fim } },
      select: { valor: true, taxaBps: true, forma: true },
    }),
    // O gráfico precisa da janela larga, e pela mesma data do estorno.
    prisma.atendimentoEstorno.findMany({
      where: { data: { gte: inicioEvolucao, lt: fim } },
      select: { data: true, valor: true },
    }),
  ]);

  const detalhado: LinhaDetalhada[] = realizados.map((a) => {
    const v = valoresDoPagamento(a.valorTotal, a.taxaBps);
    return {
      id: a.id,
      data: a.data,
      petNome: a.agendamento.pet.nome,
      tutorNome: a.agendamento.pet.cliente.nome,
      // Aqui vale o snapshot histórico (`servicosRealizados`): é o que foi feito
      // naquele dia, com os nomes da época. As tabelas agregadas abaixo usam a
      // relação, que é outro caso — ver o comentário em `porServico`.
      servicos: a.servicosRealizados,
      valorTotal: a.valorTotal,
      formaNome: a.forma?.nome ?? null,
      parcelas: a.parcelas,
      taxaBps: a.taxaBps,
      // Só faz sentido falar de taxa/líquido no que foi pago.
      taxa: a.formaId ? v.taxa : 0,
      liquido: a.formaId ? v.liquido : 0,
      situacao: classificarAtendimento(
        a.valorTotal,
        a.formaId,
        a.consumoPacote !== null,
        a.estornos.length > 0,
      ),
      pacoteRotulo: a.consumoPacote
        ? `Banho ${a.consumoPacote.indice} de ${a.consumoPacote.pacote.banhosTotal}`
        : null,
      responsavel: a.responsavel,
      recebidoPor: a.recebidoPor,
      dataRecebimento: a.dataRecebimento,
      recebidoForaDoPeriodo:
        a.dataRecebimento !== null && (a.dataRecebimento < inicio || a.dataRecebimento >= fim),
    };
  });

  // Tudo o que é dinheiro sai daqui — já filtrado como pago na consulta.
  const pagos = recebidos;

  // Bruto, líquido e taxas do período — pela mesma função que o Caixa usa.
  const totais = somarRecebimentos(pagos);
  // Dinheiro devolvido no período, pela mesma função, para os arredondamentos
  // baterem com os do recebimento que ele desfaz.
  const totaisEstornoAvulso = somarRecebimentos(
    estornosAtendimento.map((e) => ({ valorTotal: e.valor, taxaBps: e.taxaBps })),
  );
  // AVULSO: só o dinheiro que passou por atendimento. É contra ESTE número que
  // o rateio por serviço fecha e que o ticket médio divide — a venda de pacote
  // não pertence a nenhum serviço nem a nenhum atendimento, e jogá-la aqui faria
  // o "combinado" (calculado por diferença) absorver dinheiro de pacote como se
  // tivesse vindo de um atendimento com vários serviços.
  // DOIS números, e a diferença entre eles não é descuido.
  //
  // O BRUTO é o que entrou por atendimento no período, e é a base de tudo que
  // se reparte a partir de `pagos`: o rateio por serviço (que fecha por
  // diferença) e o ticket médio (que divide por `pagos.length`). Tem que ser
  // bruto porque as linhas de estorno NÃO estão em `pagos` — e podem nem
  // pertencer a este período, já que a devolução é datada pelo dia em que o
  // dinheiro saiu.
  //
  // O LÍQUIDO DE DEVOLUÇÕES é o que sobrou, e é o que os cards mostram.
  //
  // A mesma assimetria já existe para pacote (`pacotes.bruto` vem descontado
  // dos estornos dele); lá ela é invisível porque venda de pacote não alimenta
  // o rateio. Atendimento alimenta — por isso aqui os dois números precisam
  // existir separados. Unificá-los faria uma devolução virar "combinado"
  // negativo na tabela por serviço.
  const faturamentoAvulsoBruto = totais.bruto;
  const faturamentoAvulso = faturamentoAvulsoBruto - totaisEstornoAvulso.bruto;
  // O que a dona chama de faturamento do período: as duas fontes somadas. Elas
  // são disjuntas por construção, então a soma não conta nada duas vezes.
  const faturamento = faturamentoAvulso + pacotes.bruto;
  const aReceber = detalhado.filter((l) => l.situacao === "A_RECEBER");
  const semValor = detalhado.filter((l) => l.situacao === "SEM_VALOR");

  // Recebimentos cujo ATENDIMENTO caiu fora do período: entram no faturamento
  // daqui e não aparecem na listagem de atendimentos (que é por data de
  // atendimento). É a diferença que precisa estar escrita na tela.
  //
  // Testa os dois lados do intervalo, espelhando `recebidoForaDoPeriodo` acima.
  // Só `< inicio` deixaria de fora o atendimento com data futura — raro, mas aí
  // o box de reconciliação não fecharia e ninguém saberia por quê.
  const foraDoPeriodo = pagos.filter((a) => a.data < inicio || a.data >= fim);

  // --- Por serviço ---
  // Agrupa pelo `servicoId` da relação, e não pelo texto de
  // `servicosRealizados`: renomear um serviço não mexe no histórico (CLAUDE.md),
  // então agrupar pelo texto quebraria "Banho" em duas linhas depois de uma
  // renomeação — justo o tipo de coisa que faz o número não fechar com o
  // contador. O rótulo exibido é o nome ATUAL do serviço.
  const porServicoMap = new Map<string, LinhaServico>();
  let qtdServicoUnico = 0;
  let totalServicoUnico = 0;

  for (const a of pagos) {
    const servicos = a.agendamento.servicos;
    const servicoUnico = servicos.length === 1;
    if (servicoUnico) {
      qtdServicoUnico++;
      totalServicoUnico += a.valorTotal ?? 0;
    }

    for (const { servico } of servicos) {
      const linha = porServicoMap.get(servico.id) ?? {
        servicoId: servico.id,
        nome: servico.nome,
        quantidade: 0,
        qtdServicoUnico: 0,
        faturamentoServicoUnico: 0,
        mediaServicoUnico: null,
      };
      linha.quantidade++;
      if (servicoUnico) {
        linha.qtdServicoUnico++;
        linha.faturamentoServicoUnico += a.valorTotal ?? 0;
      }
      porServicoMap.set(servico.id, linha);
    }
  }

  const linhasServico = [...porServicoMap.values()]
    .map((l) => ({
      ...l,
      mediaServicoUnico: l.qtdServicoUnico > 0 ? Math.round(l.faturamentoServicoUnico / l.qtdServicoUnico) : null,
    }))
    // Faturamento primeiro, como pedido. Como muita linha pode ficar sem valor
    // atribuível (atendimento combinado), a quantidade desempata — senão a
    // tabela ficaria em ordem aleatória justo onde ela ainda informa algo.
    .sort(
      (a, b) =>
        b.faturamentoServicoUnico - a.faturamentoServicoUnico ||
        b.quantidade - a.quantidade ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );

  // --- Por pet ---
  const porPetMap = new Map<string, LinhaPet>();
  for (const a of pagos) {
    const pet = a.agendamento.pet;
    const linha = porPetMap.get(pet.id) ?? {
      petId: pet.id,
      petNome: pet.nome,
      tutorNome: pet.cliente.nome,
      visitas: 0,
      total: 0,
      ultimaVisita: a.data,
    };
    linha.visitas++;
    linha.total += a.valorTotal ?? 0;
    if (a.data > linha.ultimaVisita) linha.ultimaVisita = a.data;
    porPetMap.set(pet.id, linha);
  }
  const porPet = [...porPetMap.values()].sort(
    (a, b) => b.total - a.total || a.petNome.localeCompare(b.petNome, "pt-BR"),
  );

  // --- Por forma de pagamento ---
  // Agrupa pela FORMA (a relação), com bruto, taxa e líquido de cada uma — é a
  // tabela que responde "quanto caiu de cada bandeira". A ordem é a do cadastro
  // (`ordem`), não a do volume, para dois meses ficarem comparáveis lado a lado.
  const porFormaMap = new Map<string, LinhaFormaPagamento>();
  // `ordem` fica FORA da linha: ela é critério de ordenação, não coluna da
  // tabela, e guardá-la dentro obrigaria a removê-la de novo no final.
  const ordemDaForma = new Map<string, number>();
  // As TRÊS coisas que passam pela maquininha: atendimento pago, venda de
  // pacote e o estorno de uma venda cancelada (com sinal negativo). Sem o
  // pacote aqui, a soma das linhas daria o avulso e a linha de Total daria o
  // faturamento inteiro — a tabela não fecharia consigo mesma.
  const movimentos = [
    ...pagos.map((a) => ({ forma: a.forma, valor: a.valorTotal, taxaBps: a.taxaBps, sinal: 1 })),
    ...pacotesPorForma.map((p) => ({
      forma: p.forma,
      valor: p.valorTotal,
      taxaBps: p.taxaBps,
      sinal: 1,
    })),
    ...estornosPorForma.map((e) => ({
      forma: e.forma,
      valor: e.valor,
      taxaBps: e.taxaBps,
      sinal: -1,
    })),
    // A QUARTA coisa: dinheiro devolvido de atendimento. Volta pela mesma forma
    // por onde entrou. Sem esta linha a tabela somaria o bruto enquanto o Total
    // mostra o líquido de devoluções — e não fecharia consigo mesma.
    ...estornosAtendimento.map((e) => ({
      forma: e.forma,
      valor: e.valor,
      taxaBps: e.taxaBps,
      sinal: -1,
    })),
  ];
  for (const m of movimentos) {
    if (!m.forma) continue;
    const v = valoresDoPagamento(m.valor, m.taxaBps);
    const linha = porFormaMap.get(m.forma.id) ?? {
      formaId: m.forma.id,
      nome: m.forma.nome,
      quantidade: 0,
      bruto: 0,
      taxa: 0,
      liquido: 0,
      qtdSemTaxa: 0,
    };
    linha.quantidade += m.sinal;
    linha.bruto += v.bruto * m.sinal;
    linha.taxa += v.taxa * m.sinal;
    linha.liquido += v.liquido * m.sinal;
    if (v.taxaDesconhecida && m.sinal > 0) linha.qtdSemTaxa++;
    porFormaMap.set(m.forma.id, linha);
    ordemDaForma.set(m.forma.id, m.forma.ordem);
  }
  const porFormaPagamento: LinhaFormaPagamento[] = [...porFormaMap.values()].sort(
    (a, b) => (ordemDaForma.get(a.formaId) ?? 0) - (ordemDaForma.get(b.formaId) ?? 0),
  );

  // --- Evolução (12 meses) ---
  // Pela data de RECEBIMENTO, igual aos cards acima. Se este gráfico contasse
  // pela data do atendimento, ele contradiria o faturamento na mesma tela.
  const porMes = new Map<string, number>();
  // As DUAS fontes, pelo mesmo critério de data — senão o gráfico contradiz os
  // cards logo acima, que somam as duas.
  for (const a of [...recebimentosEvolucao, ...evolucaoPacotes]) {
    if (!a.dataRecebimento) continue;
    // Bucket pelo mês NO FUSO DA LOJA: um recebimento do dia 31 às 22h local é
    // 01 do mês seguinte em UTC, e cairia no mês errado sem isso.
    const mesISO = primeiroDiaDoMes(dataISODe(a.dataRecebimento));
    porMes.set(mesISO, (porMes.get(mesISO) ?? 0) + (a.valorTotal ?? 0));
  }
  // As devoluções descem do mês em que o dinheiro SAIU — chave `data`, não
  // `dataRecebimento`. Sem esta volta o gráfico contradiria os cards da mesma
  // tela, que já vêm líquidos de devolução.
  for (const e of evolucaoEstornosAtendimento) {
    const mesISO = primeiroDiaDoMes(dataISODe(e.data));
    porMes.set(mesISO, (porMes.get(mesISO) ?? 0) - e.valor);
  }
  const evolucao: PontoEvolucao[] = Array.from({ length: 12 }, (_, i) => {
    const mesISO = addMeses(mesInicialEvolucao, i);
    return { mesISO, rotulo: formatMesAnoCurto(mesISO), faturamento: porMes.get(mesISO) ?? 0 };
  });

  return {
    inicioISO,
    fimISO,
    resumo: {
      faturamento,
      // Líquido e taxas também somam as duas fontes: a venda de pacote passa
      // pela mesma maquininha e tem a mesma taxa.
      // Líquido e taxas descem junto com o bruto: a devolução leva embora a
      // taxa que foi aplicada na venda, senão ela ficaria pendurada aqui.
      faturamentoLiquido: totais.liquido + pacotes.liquido - totaisEstornoAvulso.liquido,
      totalTaxas: totais.taxas + pacotes.taxas - totaisEstornoAvulso.taxas,
      qtdSemTaxa: totais.qtdSemTaxa + pacotes.qtdSemTaxa,
      qtdAtendimentos: pagos.length,
      // Ticket do ATENDIMENTO: divide o avulso, não o total. Uma venda de
      // pacote não é um atendimento — somá-la aqui inflaria o ticket com um
      // dinheiro que não tem atendimento no denominador.
      //
      // Pelo BRUTO: o denominador (`pagos`) não conhece as devoluções, e uma
      // devolução de outro período deflacionaria um ticket que não é dela.
      ticketMedio: pagos.length > 0 ? Math.round(faturamentoAvulsoBruto / pagos.length) : null,
      cancelados,
      qtdAReceber: aReceber.length,
      totalAReceber: aReceber.reduce((s, l) => s + (l.valorTotal ?? 0), 0),
      qtdSemValor: semValor.length,
      qtdRealizados: realizados.length,
      recebidoDeForaDoPeriodo: foraDoPeriodo.reduce((s, a) => s + (a.valorTotal ?? 0), 0),
      qtdRecebidoDeForaDoPeriodo: foraDoPeriodo.length,

      faturamentoAvulso,
      faturamentoAvulsoBruto,
      faturamentoPacotes: pacotes.bruto,
      qtdPacotesVendidos: pacotes.qtd,
      totalEstornado: pacotes.estornado,
      qtdEstornos: pacotes.qtdEstornos,
      totalEstornadoAvulso: totaisEstornoAvulso.bruto,
      qtdEstornosAvulso: estornosAtendimento.length,
      banhosDePacote,
    },
    porServico: {
      linhas: linhasServico,
      qtdServicoUnico,
      totalServicoUnico,
      // Por diferença, e não somando de novo: assim único + combinado fecha
      // exatamente com o faturamento avulso BRUTO, sempre.
      //
      // Contra o avulso, e não contra o total: venda de pacote não passa por
      // serviço nenhum, então incluí-la aqui faria o "combinado" absorver
      // dinheiro de pacote como se tivesse saído de um atendimento.
      //
      // E contra o BRUTO, não contra o exibido: as devoluções não estão em
      // `pagos` e podem ser de outro período — descontá-las aqui faria uma
      // devolução aparecer como "combinado" negativo, que é um número que não
      // existe. A tela mostra a devolução numa linha própria.
      qtdCombinado: pagos.length - qtdServicoUnico,
      totalCombinado: faturamentoAvulsoBruto - totalServicoUnico,
    },
    porPet,
    porFormaPagamento,
    evolucao,
    detalhado,
  };
}
