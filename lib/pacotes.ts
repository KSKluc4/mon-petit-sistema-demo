import "server-only";
import { prisma } from "./prisma";
import type { Autor } from "./autoria";
import { addDias, dataISODe, diasEntre, hojeISO, intervaloDoDia } from "./datas";
import { resolverFormaETaxa } from "./recebimento";
import { valoresDoPagamento } from "./pagamento";

/**
 * PACOTES DE BANHO pré-pagos. A garantia contra contar o dinheiro duas vezes
 * está no cabeçalho de `Pacote` no schema, e resumida assim:
 *
 *   O valor do pacote vive só em `Pacote.valorTotal`. `PacoteConsumo` não tem
 *   coluna de valor, e nada escreve `Atendimento.valorTotal` a partir de um
 *   pacote. Num atendimento que usa pacote, `valorTotal` é SÓ o extra do dia.
 */

/** 2 ou 4 banhos — o que a cliente vende hoje. */
export const BANHOS_PERMITIDOS = [2, 4] as const;

/** Validade do pacote, em dias corridos a partir da compra. */
export const VALIDADE_DIAS = 30;

/** A partir de quantos dias para vencer o pacote com saldo vira alerta. */
export const DIAS_ALERTA_VENCIMENTO = 7;

/**
 * Status DERIVADO — não existe coluna. Um status gravado precisaria de um job
 * para virar de ATIVO para EXPIRADO no dia certo, e este projeto não tem
 * scheduler nenhum (só o backup no GitHub Actions): o campo ficaria errado
 * entre execuções. Derivado está sempre certo, e nada precisa ser migrado
 * quando um pacote vence.
 *
 * Precedência: cancelado > encerrado > expirado > ativo. Encerrado ganha de
 * expirado porque, se os 4 banhos foram usados, a data deixou de importar.
 */
export type StatusPacote = "ATIVO" | "ENCERRADO" | "EXPIRADO" | "CANCELADO";

export function statusDoPacote(
  pacote: { banhosTotal: number; valorTotal: number; validadeAte: Date },
  usados: number,
  estornado: number,
  agora: Date = new Date(),
): StatusPacote {
  // Estorno de 100% = venda cancelada. Um estorno PARCIAL (se um dia existir)
  // não cancela o pacote: o saldo de banhos continua valendo.
  if (estornado >= pacote.valorTotal) return "CANCELADO";
  if (usados >= pacote.banhosTotal) return "ENCERRADO";
  if (agora > pacote.validadeAte) return "EXPIRADO";
  return "ATIVO";
}

export const STATUS_PACOTE_LABEL: Record<StatusPacote, string> = {
  ATIVO: "Ativo",
  ENCERRADO: "Encerrado",
  EXPIRADO: "Expirado",
  CANCELADO: "Cancelado",
};

export type PacoteComSaldo = {
  id: string;
  petId: string;
  petNome: string;
  banhosTotal: number;
  usados: number;
  restantes: number;
  valorTotal: number;
  /** Quanto já voltou (estorno). Hoje só 0 ou o valor cheio. */
  estornado: number;
  dataCompra: Date;
  validadeAte: Date;
  status: StatusPacote;
  /** Dias até vencer. Negativo quando já venceu. */
  diasParaVencer: number;
  /** Ativo, com saldo, e vencendo em até 7 dias — o que merece aviso. */
  vencendo: boolean;
  formaNome: string | null;
  parcelas: number | null;
  taxaBps: number | null;
  vendidoPor: string;
  /** Nº de cada banho já usado, na ordem — para exibir o histórico. */
  indicesUsados: number[];
};

const INCLUI_SALDO = {
  consumos: { orderBy: { indice: "asc" } },
  estornos: true,
  forma: true,
  pet: true,
} as const;

type PacoteBruto = {
  id: string;
  petId: string;
  banhosTotal: number;
  valorTotal: number;
  dataCompra: Date;
  validadeAte: Date;
  parcelas: number | null;
  taxaBps: number | null;
  vendidoPor: string;
  consumos: { indice: number }[];
  estornos: { valor: number }[];
  forma: { nome: string } | null;
  pet: { nome: string };
};

export function comSaldo(p: PacoteBruto, agora: Date = new Date()): PacoteComSaldo {
  const usados = p.consumos.length;
  const estornado = p.estornos.reduce((s, e) => s + e.valor, 0);
  const status = statusDoPacote(p, usados, estornado, agora);
  const diasParaVencer = diasEntre(hojeISO(), dataISODe(p.validadeAte));
  return {
    id: p.id,
    petId: p.petId,
    petNome: p.pet.nome,
    banhosTotal: p.banhosTotal,
    usados,
    restantes: Math.max(p.banhosTotal - usados, 0),
    valorTotal: p.valorTotal,
    estornado,
    dataCompra: p.dataCompra,
    validadeAte: p.validadeAte,
    status,
    diasParaVencer,
    vencendo: status === "ATIVO" && diasParaVencer <= DIAS_ALERTA_VENCIMENTO,
    formaNome: p.forma?.nome ?? null,
    parcelas: p.parcelas,
    taxaBps: p.taxaBps,
    vendidoPor: p.vendidoPor,
    indicesUsados: p.consumos.map((c) => c.indice),
  };
}

/** Todos os pacotes do pet, do mais recente ao mais antigo (histórico da ficha). */
export async function listarPacotesDoPet(petId: string): Promise<PacoteComSaldo[]> {
  const pacotes = await prisma.pacote.findMany({
    where: { petId },
    orderBy: { dataCompra: "desc" },
    include: INCLUI_SALDO,
  });
  return pacotes.map((p) => comSaldo(p));
}

/**
 * Os pacotes que ainda podem ser usados, **do mais antigo para o mais novo** —
 * e essa ordem é a regra de consumo.
 *
 * A dona pode ter dois pacotes ativos ao mesmo tempo (decidido em 03/08/2026):
 * bloquear a segunda venda travaria o balcão quando o 5º sábado chega antes de
 * alguém lembrar de vender o pacote novo. Consumir sempre do mais antigo
 * resolve sozinho e é o que protege o cliente — é o pacote que vence primeiro.
 */
export async function pacotesUtilizaveis(petId: string): Promise<PacoteComSaldo[]> {
  const pacotes = await prisma.pacote.findMany({
    where: { petId },
    orderBy: { dataCompra: "asc" },
    include: INCLUI_SALDO,
  });
  return pacotes.map((p) => comSaldo(p)).filter((p) => p.status === "ATIVO");
}

/** O pacote que um banho novo consumiria: o mais antigo ainda ativo. */
export async function pacoteDaVez(petId: string): Promise<PacoteComSaldo | null> {
  return (await pacotesUtilizaveis(petId))[0] ?? null;
}

// --- Venda ---------------------------------------------------------------

/**
 * Vende um pacote. O pagamento é sempre à vista, na compra — não existe
 * "receber depois" de pacote, então `valorTotal`, `formaId` e `dataRecebimento`
 * são NOT NULL e a invariante do dinheiro vale trivialmente.
 *
 * A taxa sai de `resolverFormaETaxa` (a mesma do recebimento de atendimento) e
 * é gravada como SNAPSHOT: a dona edita os percentuais quando a maquininha
 * muda, e sem o snapshot isso recalcularia vendas antigas.
 */
export async function venderPacote(params: {
  petId: string;
  banhosTotal: number;
  valorTotal: number | null;
  formaId: string;
  parcelas: number | null;
  observacoes?: string | null;
  vendidoPor: Autor;
}): Promise<{ error?: string; pacoteId?: string }> {
  const { petId, banhosTotal, valorTotal, formaId, parcelas, observacoes, vendidoPor } = params;

  if (!BANHOS_PERMITIDOS.includes(banhosTotal as (typeof BANHOS_PERMITIDOS)[number])) {
    return { error: "Escolha um pacote de 2 ou 4 banhos." };
  }
  // Pacote é pré-pago: sem valor não há venda. Diferente do atendimento, onde
  // valor nulo é "a definir" — aqui o dinheiro entra agora.
  if (valorTotal === null || valorTotal <= 0) {
    return { error: "Informe o valor do pacote." };
  }

  const pet = await prisma.pet.findUnique({ where: { id: petId } });
  if (!pet) return { error: "Pet não encontrado." };

  const resolvido = await resolverFormaETaxa(formaId, parcelas);
  if ("error" in resolvido) return { error: resolvido.error };

  const agora = new Date();
  // Validade vale até o FIM do 30º dia — quem compra dia 1 pode usar dia 31.
  const validadeAte = intervaloDoDia(addDias(dataISODe(agora), VALIDADE_DIAS)).fim;

  const pacote = await prisma.pacote.create({
    data: {
      petId,
      banhosTotal,
      valorTotal,
      dataCompra: agora,
      validadeAte,
      vendidoPor: vendidoPor.nome,
      vendidoPorId: vendidoPor.id,
      observacoes: observacoes?.trim() || null,
      formaId: resolvido.forma.id,
      parcelas: resolvido.forma.tipo === "CREDITO" ? resolvido.parcelas : null,
      taxaBps: resolvido.taxaBps,
      // Regime de caixa: o dinheiro entrou hoje, e é por esta data que o
      // faturamento conta.
      dataRecebimento: agora,
    },
  });

  return { pacoteId: pacote.id };
}

/**
 * Cancela uma venda registrada errado. Só enquanto NENHUM banho foi consumido —
 * depois disso o serviço já foi prestado e devolver vira estorno parcial, que
 * é outra decisão (ainda não tomada pela dona).
 *
 * Grava um `PacoteEstorno` de 100% em vez de um flag no pacote: assim o estorno
 * parcial, se um dia existir, é a mesma linha com valor menor — sem um segundo
 * mecanismo de "dinheiro que voltou" para reconciliar.
 *
 * A data do estorno é a de HOJE, não a da venda — REGIME DE CAIXA, a mesma
 * regra do resto do sistema: relatório já fechado não muda retroativamente.
 * Cancelar no mesmo dia continua se anulando sozinho (venda e estorno caem no
 * mesmo dia); cancelar no mês seguinte deixa o mês da venda como a contadora
 * já recebeu e lança a devolução no mês corrente, que é onde o dinheiro
 * efetivamente saiu.
 *
 * O vínculo com a venda original fica no `pacoteId` — nada se perde de rastro.
 */
export async function cancelarVendaPacote(
  pacoteId: string,
  feitoPor: Autor,
  motivo?: string | null,
): Promise<{ error?: string }> {
  const pacote = await prisma.pacote.findUnique({
    where: { id: pacoteId },
    include: INCLUI_SALDO,
  });
  if (!pacote) return { error: "Pacote não encontrado." };

  if (pacote.consumos.length > 0) {
    return {
      error: "Este pacote já teve banho usado. Só dá para cancelar antes do primeiro banho.",
    };
  }
  // Dois toques no botão não podem estornar duas vezes.
  if (pacote.estornos.length > 0) return { error: "Esta venda já foi cancelada." };

  await prisma.pacoteEstorno.create({
    data: {
      pacoteId,
      valor: pacote.valorTotal,
      // Hoje, e não `pacote.dataRecebimento`: ver o cabeçalho acima.
      data: new Date(),
      taxaBps: pacote.taxaBps,
      formaId: pacote.formaId,
      motivo: motivo?.trim() || null,
      feitoPor: feitoPor.nome,
      feitoPorId: feitoPor.id,
    },
  });

  return {};
}

// --- Consumo -------------------------------------------------------------

/** Erro sinalizando que o banho não pôde sair do pacote. */
export class PacoteIndisponivelError extends Error {}

/**
 * Consome um banho do pacote DENTRO de uma transação já aberta, junto da
 * criação do atendimento — as duas coisas acontecem ou nenhuma acontece.
 *
 * `indice` é calculado aqui (`usados + 1`) e não no agendamento: a cliente
 * marca vários sábados de uma vez, e numerar antes renumeraria tudo quando uma
 * visita acontecesse fora de ordem. Quem torna isso seguro contra dois toques
 * simultâneos é o `@@unique([pacoteId, indice])` — se dois fecharem o mesmo
 * banho ao mesmo tempo, o segundo estoura e a transação inteira volta atrás.
 */
export async function consumirBanhoNaTransacao(
  tx: Pick<typeof prisma, "pacote" | "pacoteConsumo">,
  pacoteId: string,
  atendimentoId: string,
  agora: Date = new Date(),
): Promise<{ indice: number; banhosTotal: number }> {
  const pacote = await tx.pacote.findUnique({
    where: { id: pacoteId },
    include: { consumos: true, estornos: true },
  });
  if (!pacote) throw new PacoteIndisponivelError("Pacote não encontrado.");

  const usados = pacote.consumos.length;
  const estornado = pacote.estornos.reduce((s, e) => s + e.valor, 0);
  const status = statusDoPacote(pacote, usados, estornado, agora);
  if (status !== "ATIVO") {
    throw new PacoteIndisponivelError(
      status === "EXPIRADO"
        ? "O pacote venceu."
        : status === "ENCERRADO"
          ? "O pacote já acabou."
          : "A venda deste pacote foi cancelada.",
    );
  }

  const indice = usados + 1;
  await tx.pacoteConsumo.create({ data: { pacoteId, atendimentoId, indice } });
  return { indice, banhosTotal: pacote.banhosTotal };
}

// --- Dinheiro ------------------------------------------------------------

export type ResumoPacotes = {
  /** Vendas de pacote no período, valor cheio. */
  bruto: number;
  liquido: number;
  taxas: number;
  qtd: number;
  qtdSemTaxa: number;
  /** Estornos no período — já subtraídos dos três primeiros. */
  estornado: number;
  qtdEstornos: number;
};

/**
 * Receita de pacotes num intervalo, pela data do recebimento (regime de caixa,
 * igual ao atendimento), menos os estornos que caem no mesmo intervalo.
 */
export async function faturamentoPacotesDoIntervalo(
  inicio: Date,
  fim: Date,
): Promise<ResumoPacotes> {
  const [vendas, estornos] = await Promise.all([
    prisma.pacote.findMany({
      where: { dataRecebimento: { gte: inicio, lt: fim } },
      select: { valorTotal: true, taxaBps: true },
    }),
    prisma.pacoteEstorno.findMany({
      where: { data: { gte: inicio, lt: fim } },
      select: { valor: true, taxaBps: true },
    }),
  ]);

  let bruto = 0;
  let liquido = 0;
  let taxas = 0;
  let qtdSemTaxa = 0;
  for (const v of vendas) {
    const val = valoresDoPagamento(v.valorTotal, v.taxaBps);
    bruto += val.bruto;
    liquido += val.liquido;
    taxas += val.taxa;
    if (val.taxaDesconhecida) qtdSemTaxa++;
  }
  // O estorno devolve bruto E líquido, com a taxa que foi aplicada na venda —
  // senão cancelar uma venda deixaria a taxa dela pendurada no relatório.
  let estornado = 0;
  for (const e of estornos) {
    const val = valoresDoPagamento(e.valor, e.taxaBps);
    bruto -= val.bruto;
    liquido -= val.liquido;
    taxas -= val.taxa;
    estornado += val.bruto;
  }

  return {
    bruto,
    liquido,
    taxas,
    qtd: vendas.length,
    qtdSemTaxa,
    estornado,
    qtdEstornos: estornos.length,
  };
}

/**
 * Quantos banhos de pacote foram consumidos no período. É serviço prestado sem
 * receita naquele dia — a dona precisa enxergar isso separado, senão o mês
 * parece mais fraco do que foi.
 *
 * Conta pela data do ATENDIMENTO (quando o banho aconteceu), não pela venda.
 */
export async function banhosDePacoteNoIntervalo(inicio: Date, fim: Date): Promise<number> {
  return prisma.pacoteConsumo.count({
    where: {
      atendimento: {
        data: { gte: inicio, lt: fim },
        agendamento: { status: { not: "CANCELADO" } },
      },
    },
  });
}

/** Pacotes ativos vencendo com saldo — o alerta da ficha e do dashboard. */
export async function pacotesVencendo(): Promise<PacoteComSaldo[]> {
  const limite = intervaloDoDia(addDias(hojeISO(), DIAS_ALERTA_VENCIMENTO)).fim;
  const pacotes = await prisma.pacote.findMany({
    where: { validadeAte: { lte: limite, gte: new Date() } },
    orderBy: { validadeAte: "asc" },
    include: INCLUI_SALDO,
  });
  return pacotes.map((p) => comSaldo(p)).filter((p) => p.status === "ATIVO");
}
