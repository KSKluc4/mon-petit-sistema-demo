import "server-only";
import ExcelJS from "exceljs";
import { formatarAutor } from "../autoria";
import { formatDataISO } from "../datas";
import type { Periodo } from "../periodos";
import type { Relatorio } from "../relatorios";
import { SITUACAO_LABEL, dataLocal, reais } from "./comum";

const MOEDA = 'R$ #,##0.00';
const AZUL = "FF189A9A"; // brand-600, a cor da marca

function cabecalho(planilha: ExcelJS.Worksheet, colunas: Partial<ExcelJS.Column>[]) {
  planilha.columns = colunas;
  const linha = planilha.getRow(1);
  linha.font = { bold: true, color: { argb: "FFFFFFFF" } };
  linha.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  linha.alignment = { vertical: "middle" };
  linha.height = 20;
  planilha.views = [{ state: "frozen", ySplit: 1 }];
}

/**
 * Planilha do período, uma aba por seção da tela.
 *
 * Valores vão como NÚMERO em reais com formato de moeda, nunca como texto:
 * a contabilidade precisa poder somar e filtrar as colunas. O sistema guarda
 * centavos (Int), então a conversão acontece aqui, num lugar só (`reais`).
 */
export async function montarXlsx(rel: Relatorio, periodo: Periodo): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mon Petit";
  wb.created = new Date();

  // --- Resumo ---
  const resumo = wb.addWorksheet("Resumo");
  cabecalho(resumo, [
    { header: "Indicador", key: "k", width: 42 },
    { header: "Valor", key: "v", width: 20 },
  ]);
  const linhasResumo: [string, string | number, boolean?][] = [
    ["Período", periodo.rotulo],
    ["De", formatDataISO(rel.inicioISO)],
    ["Até", formatDataISO(rel.fimISO)],
    ["", ""],
    ["Faturamento BRUTO (recebido no período)", reais(rel.resumo.faturamento), true],
    ["Taxas de maquininha", reais(rel.resumo.totalTaxas), true],
    ["Faturamento LÍQUIDO (entra na conta)", reais(rel.resumo.faturamentoLiquido), true],
    ["Recebimentos sem taxa registrada", rel.resumo.qtdSemTaxa],
    ["Quantidade de recebimentos", rel.resumo.qtdAtendimentos],
    ["Ticket médio", rel.resumo.ticketMedio === null ? "—" : reais(rel.resumo.ticketMedio), true],
    ["Atendimentos cancelados", rel.resumo.cancelados],
    ["", ""],
    ["COMPOSIÇÃO DO FATURAMENTO", ""],
    ["Recebido de atendimentos feitos fora do período (qtd.)", rel.resumo.qtdRecebidoDeForaDoPeriodo],
    [
      "Recebido de atendimentos feitos fora do período (valor)",
      reais(rel.resumo.recebidoDeForaDoPeriodo),
      true,
    ],
    ["Atendimentos realizados no período (qtd.)", rel.resumo.qtdRealizados],
    ["", ""],
    ["PENDÊNCIAS (fora do faturamento)", ""],
    ["Atendimentos a receber (qtd.)", rel.resumo.qtdAReceber],
    ["Atendimentos a receber (valor)", reais(rel.resumo.totalAReceber), true],
    ["Atendimentos sem valor definido", rel.resumo.qtdSemValor],
    ["", ""],
    ["AS DUAS FONTES DE RECEITA", ""],
    ["Receita de atendimento", reais(rel.resumo.faturamentoAvulso), true],
    ["Venda de pacotes", reais(rel.resumo.faturamentoPacotes), true],
    ["Pacotes vendidos (qtd.)", rel.resumo.qtdPacotesVendidos],
    ["Vendas canceladas (qtd.)", rel.resumo.qtdEstornos],
    ["Vendas canceladas (valor já descontado)", reais(rel.resumo.totalEstornado), true],
    ["Dinheiro devolvido a cliente (qtd.)", rel.resumo.qtdEstornosAvulso],
    // Pela data da DEVOLUÇÃO: o recebimento original continua contando no
    // período em que entrou, então esta linha pode não ter par aqui dentro.
    [
      "Dinheiro devolvido a cliente (valor já descontado)",
      reais(rel.resumo.totalEstornadoAvulso),
      true,
    ],
    ["Banhos de pacote usados (sem receita no período)", rel.resumo.banhosDePacote],
    ["", ""],
    ["RECONCILIAÇÃO POR SERVIÇO", ""],
    ["Atendimentos com 1 serviço (qtd.)", rel.porServico.qtdServicoUnico],
    ["Atendimentos com 1 serviço (valor)", reais(rel.porServico.totalServicoUnico), true],
    ["Atendimentos combinados (qtd.)", rel.porServico.qtdCombinado],
    ["Atendimentos combinados (valor)", reais(rel.porServico.totalCombinado), true],
    // Fecha contra o BRUTO de atendimento, e não contra a receita exibida: uma
    // devolução pode ser de atendimento de outro período e não pertence a
    // serviço nenhum daqui. Ver o comentário em `gerarRelatorio`.
    [
      "Total em atendimentos (antes de devoluções)",
      reais(rel.resumo.faturamentoAvulsoBruto),
      true,
    ],
  ];
  for (const [k, v, moeda] of linhasResumo) {
    const linha = resumo.addRow({ k, v });
    if (moeda && typeof v === "number") linha.getCell("v").numFmt = MOEDA;
    if (k === k.toUpperCase() && k !== "") linha.font = { bold: true };
  }
  resumo.getRow(6).font = { bold: true, size: 12 };

  // Regra de contagem junto do número, para ninguém interpretar errado.
  resumo.addRow({});
  resumo.addRow({
    k: "Como os números são contados",
  }).font = { bold: true };
  for (const texto of [
    "Só atendimentos pagos (valor definido + forma de pagamento registrada).",
    "REGIME DE CAIXA: o faturamento conta pela data em que o dinheiro foi RECEBIDO.",
    "Um atendimento feito em julho e pago em agosto conta no faturamento de agosto —",
    "é o que garante que um período já fechado não mude de valor depois de enviado.",
    "A aba 'Atendimentos' vai pela data do ATENDIMENTO e inclui o que está em aberto,",
    "então a soma dela não bate com o faturamento: são recortes diferentes de propósito.",
    "BRUTO é o que o cliente pagou; LÍQUIDO é o que entra na conta depois da taxa da",
    "maquininha. A taxa é a que valia NO DIA da venda — mudar o percentual depois não",
    "recalcula pagamento antigo.",
    "PACOTES: a venda conta no dia em que foi VENDIDA, pelo valor cheio. Os banhos usados",
    "depois aparecem com valor zero e situação 'Pago no pacote' — serviço prestado cujo",
    "dinheiro já foi contado na venda. É assim que o mesmo banho não conta duas vezes.",
    "A reconciliação por serviço fecha com a receita de ATENDIMENTO, não com o total:",
    "venda de pacote não passa por serviço nenhum.",
    "Recebimento 'sem taxa registrada' é anterior ao controle de taxas (ou de forma ainda",
    "sem percentual cadastrado): ali o líquido foi contado igual ao bruto, então o líquido",
    "total é o MÁXIMO possível. Taxa desconhecida fica em branco, nunca como 0%.",
    "Atendimento sem valor é 'a definir' — nunca conta como R$ 0,00.",
    "Cancelado não entra no faturamento; é contado à parte, pela data do agendamento.",
    "O valor é livre por atendimento: em atendimento com vários serviços o sistema não",
    "sabe quanto foi de cada um, então esse valor não é rateado entre os serviços.",
  ]) {
    resumo.addRow({ k: texto });
  }

  // --- Por serviço ---
  const servicos = wb.addWorksheet("Por serviço");
  cabecalho(servicos, [
    { header: "Serviço", key: "nome", width: 28 },
    { header: "Qtd. realizada", key: "qtd", width: 15 },
    { header: "Qtd. como serviço único", key: "qtdUnico", width: 24 },
    { header: "Faturamento atribuível", key: "fat", width: 22 },
    { header: "Valor médio", key: "media", width: 16 },
  ]);
  for (const l of rel.porServico.linhas) {
    const linha = servicos.addRow({
      nome: l.nome,
      qtd: l.quantidade,
      qtdUnico: l.qtdServicoUnico,
      fat: l.qtdServicoUnico > 0 ? reais(l.faturamentoServicoUnico) : "—",
      media: l.mediaServicoUnico === null ? "—" : reais(l.mediaServicoUnico),
    });
    linha.getCell("fat").numFmt = MOEDA;
    linha.getCell("media").numFmt = MOEDA;
  }
  servicos.addRow({});
  servicos.addRow({
    nome: "Faturamento atribuível = só atendimentos em que o serviço foi o único realizado.",
  }).font = { italic: true };

  // --- Por cliente / pet ---
  const pets = wb.addWorksheet("Por cliente");
  cabecalho(pets, [
    { header: "Pet", key: "pet", width: 22 },
    { header: "Tutor", key: "tutor", width: 28 },
    { header: "Visitas", key: "visitas", width: 11 },
    { header: "Total gasto", key: "total", width: 16 },
    { header: "Última visita", key: "ultima", width: 15 },
  ]);
  for (const l of rel.porPet) {
    const linha = pets.addRow({
      pet: l.petNome,
      tutor: l.tutorNome,
      visitas: l.visitas,
      total: reais(l.total),
      ultima: dataLocal(l.ultimaVisita),
    });
    linha.getCell("total").numFmt = MOEDA;
  }

  // --- Forma de pagamento ---
  const formas = wb.addWorksheet("Forma de pagamento");
  cabecalho(formas, [
    { header: "Forma de pagamento", key: "forma", width: 26 },
    { header: "Qtd.", key: "qtd", width: 11 },
    { header: "Bruto", key: "bruto", width: 16 },
    { header: "Taxa", key: "taxa", width: 16 },
    { header: "Líquido", key: "liquido", width: 16 },
    { header: "Sem taxa registrada", key: "semTaxa", width: 20 },
  ]);
  for (const l of rel.porFormaPagamento) {
    const linha = formas.addRow({
      forma: l.nome,
      qtd: l.quantidade,
      bruto: reais(l.bruto),
      taxa: reais(l.taxa),
      liquido: reais(l.liquido),
      semTaxa: l.qtdSemTaxa || "",
    });
    for (const c of ["bruto", "taxa", "liquido"]) linha.getCell(c).numFmt = MOEDA;
    if (l.qtdSemTaxa > 0) {
      linha.getCell("semTaxa").font = { color: { argb: "FF92400E" }, bold: true };
    }
  }
  const totalFormas = formas.addRow({
    forma: "Total",
    qtd: rel.resumo.qtdAtendimentos,
    bruto: reais(rel.resumo.faturamento),
    taxa: reais(rel.resumo.totalTaxas),
    liquido: reais(rel.resumo.faturamentoLiquido),
    semTaxa: rel.resumo.qtdSemTaxa || "",
  });
  totalFormas.font = { bold: true };
  for (const c of ["bruto", "taxa", "liquido"]) totalFormas.getCell(c).numFmt = MOEDA;

  // --- Atendimentos (detalhado) ---
  // Aqui entram TODOS os atendimentos do período, inclusive os pendentes, com a
  // coluna Situação dizendo quais compõem o faturamento. É a aba que permite à
  // contabilidade refazer a conta por fora.
  const detalhe = wb.addWorksheet("Atendimentos");
  cabecalho(detalhe, [
    { header: "Data do atendimento", key: "data", width: 20 },
    { header: "Pet", key: "pet", width: 20 },
    { header: "Tutor", key: "tutor", width: 26 },
    { header: "Serviços", key: "servicos", width: 34 },
    { header: "Valor bruto", key: "valor", width: 14 },
    { header: "Taxa %", key: "taxaPct", width: 10 },
    { header: "Taxa", key: "taxa", width: 14 },
    { header: "Líquido", key: "liquido", width: 14 },
    { header: "Forma de pagamento", key: "forma", width: 24 },
    { header: "Parcelas", key: "parcelas", width: 11 },
    { header: "Data do recebimento", key: "recebimento", width: 20 },
    { header: "Situação", key: "situacao", width: 22 },
    { header: "Pacote", key: "pacote", width: 16 },
    // Duas colunas, e não uma: quem atendeu e quem recebeu costumam ser pessoas
    // diferentes. Existem para a contabilidade perguntar à pessoa certa quando
    // uma linha não fecha, em vez de perguntar "quem fez isso?" para os dois.
    { header: "Atendeu", key: "responsavel", width: 18 },
    { header: "Recebeu", key: "recebidoPor", width: 18 },
  ]);
  for (const l of rel.detalhado) {
    const linha = detalhe.addRow({
      data: dataLocal(l.data),
      pet: l.petNome,
      tutor: l.tutorNome,
      servicos: l.servicos,
      valor:
        l.situacao === "PACOTE"
          ? // Zero de verdade: esta visita não custou nada além do pacote. Vai
            // como NÚMERO para a coluna continuar somável.
            0
          : l.valorTotal === null
            ? "A definir"
            : reais(l.valorTotal),
      // Taxa em fração (0,0339) com formato de porcentagem: assim a contadora
      // pode multiplicar a coluna, o que não daria para fazer com texto "3,39%".
      taxaPct: l.situacao === "PAGO" && l.taxaBps !== null ? l.taxaBps / 10000 : "",
      taxa: l.situacao === "PAGO" && l.taxaBps !== null ? reais(l.taxa) : "",
      liquido: l.situacao === "PAGO" ? reais(l.liquido) : "",
      forma: l.formaNome ?? "—",
      parcelas: l.parcelas && l.parcelas > 1 ? `${l.parcelas}x` : l.formaNome ? "à vista" : "",
      // A coluna que permite à contabilidade refazer a conta: é por esta data
      // que o faturamento é somado, e ela pode cair fora do período.
      recebimento:
        l.dataRecebimento === null
          ? "Em aberto"
          : dataLocal(l.dataRecebimento) + (l.recebidoForaDoPeriodo ? " (fora do período)" : ""),
      situacao: SITUACAO_LABEL[l.situacao],
      // "Banho 2 de 4" quando saiu de pacote. Coluna própria (e não junto dos
      // serviços) para a contabilidade poder filtrar o que foi pré-pago.
      pacote: l.pacoteRotulo ?? "",
      responsavel: formatarAutor(l.responsavel),
      // Vazio quando não houve recebimento (conta em aberto): ali não existe
      // quem receber, e "anterior ao registro" seria falso.
      recebidoPor: l.dataRecebimento === null ? "" : formatarAutor(l.recebidoPor),
    });
    if (l.valorTotal !== null || l.situacao === "PACOTE") linha.getCell("valor").numFmt = MOEDA;
    if (l.situacao === "PAGO") {
      linha.getCell("liquido").numFmt = MOEDA;
      if (l.taxaBps !== null) {
        linha.getCell("taxa").numFmt = MOEDA;
        linha.getCell("taxaPct").numFmt = "0.00%";
      } else {
        // Taxa desconhecida: as células de taxa ficam VAZIAS em vez de 0, para
        // ninguém somar um zero que não foi afirmado. O líquido em âmbar avisa
        // que ali ele é igual ao bruto por falta de dado.
        linha.getCell("liquido").font = { color: { argb: "FF92400E" } };
      }
    }
    // Pendência em âmbar, para saltar aos olhos na conferência.
    if (l.situacao !== "PAGO") {
      linha.getCell("situacao").font = { color: { argb: "FF92400E" }, bold: true };
    }
    // Recebido noutro período: azul, porque não é pendência nem compõe o
    // faturamento desta planilha.
    if (l.recebidoForaDoPeriodo) {
      linha.getCell("recebimento").font = { color: { argb: "FF0369A1" }, bold: true };
    }
  }
  detalhe.autoFilter = { from: "A1", to: { row: 1, column: 13 } };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
