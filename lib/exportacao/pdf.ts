import "server-only";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Periodo } from "../periodos";
import type { Relatorio } from "../relatorios";
import { SITUACAO_LABEL, dataLocal, moeda } from "./comum";

const BRAND: [number, number, number] = [24, 154, 154]; // brand-600
const CINZA: [number, number, number] = [110, 110, 110];
const MARGEM = 14;

/**
 * Versão para imprimir ou mandar para a contadora.
 *
 * jsPDF + autoTable: o autoTable cuida sozinho de quebra de página e de repetir
 * o cabeçalho da tabela, que é justo o que a listagem de atendimentos precisa
 * quando o mês é cheio. Nada de Chromium — isto roda numa function da Vercel.
 */
export async function montarPdf(rel: Relatorio, periodo: Periodo): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const larguraPagina = doc.internal.pageSize.getWidth();

  // --- Cabeçalho da marca ---
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, larguraPagina, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Mon Petit", MARGEM, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Pet Shop — Campo Largo/PR", MARGEM, 18.5);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório do período", larguraPagina - MARGEM, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(periodo.rotulo, larguraPagina - MARGEM, 18.5, { align: "right" });

  let y = 34;
  doc.setTextColor(30, 30, 30);

  // --- Resumo em blocos ---
  // Bruto, taxas e líquido em destaque: é a resposta de "quanto realmente caiu
  // na conta", que é o motivo desta seção existir.
  const resumoCards: [string, string][] = [
    ["Bruto", moeda(rel.resumo.faturamento)],
    ["Taxas", `- ${moeda(rel.resumo.totalTaxas)}`],
    ["Líquido", moeda(rel.resumo.faturamentoLiquido)],
    // Mesmo rótulo da tela e da planilha: são recebimentos, não atendimentos.
    ["  de atendimento", moeda(rel.resumo.faturamentoAvulso)],
    ["  de venda de pacote", moeda(rel.resumo.faturamentoPacotes)],
    ["Recebimentos", String(rel.resumo.qtdAtendimentos)],
    ["Ticket médio", rel.resumo.ticketMedio === null ? "—" : moeda(rel.resumo.ticketMedio)],
    ["Cancelados", String(rel.resumo.cancelados)],
  ];
  const largura = (larguraPagina - MARGEM * 2 - 5 * 2) / 6;
  resumoCards.forEach(([rotulo, valor], i) => {
    const x = MARGEM + i * (largura + 2);
    doc.setFillColor(244, 246, 246);
    doc.roundedRect(x, y, largura, 18, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(...CINZA);
    doc.text(rotulo.toUpperCase(), x + 2.5, y + 6);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(valor, x + 2.5, y + 13.5);
    doc.setFont("helvetica", "normal");
  });
  y += 24;

  // --- Regra de contagem ---
  doc.setFontSize(7.5);
  doc.setTextColor(...CINZA);
  const nota =
    "Faturamento: apenas atendimentos pagos (valor definido + forma de pagamento registrada), pela DATA DO " +
    "RECEBIMENTO — regime de caixa. Um atendimento feito num mês e pago no seguinte conta no mês em que foi pago, " +
    "e por isso um período já fechado não muda de valor depois. A tabela 'Atendimentos do período' vai pela data " +
    "do atendimento e inclui o que ainda está em aberto, então a soma dela não precisa bater com o faturamento. " +
    "Atendimento sem valor não conta como R$ 0,00 e fica fora do faturamento. Cancelados não entram no faturamento " +
    "e são contados pela data do agendamento. BRUTO é o que o cliente pagou; LÍQUIDO é o que entra na conta depois " +
    "da taxa da maquininha, sempre pela taxa que valia NO DIA da venda.";
  const linhasNota = doc.splitTextToSize(nota, larguraPagina - MARGEM * 2);
  doc.text(linhasNota, MARGEM, y);
  y += linhasNota.length * 3.4 + 3;

  if (rel.resumo.qtdPacotesVendidos > 0 || rel.resumo.banhosDePacote > 0) {
    const notaPacote = doc.splitTextToSize(
      `PACOTES: ${rel.resumo.qtdPacotesVendidos} vendido(s) neste período, ` +
        `${moeda(rel.resumo.faturamentoPacotes)}. A venda conta no dia em que foi VENDIDA, pelo valor cheio. ` +
        `${rel.resumo.banhosDePacote} banho(s) de pacote foram usados aqui: aparecem na listagem com valor ` +
        "zero e situação 'Pago no pacote' — serviço prestado cujo dinheiro já foi contado na venda. " +
        "É assim que o mesmo banho não conta duas vezes.",
      larguraPagina - MARGEM * 2,
    );
    doc.text(notaPacote, MARGEM, y);
    y += notaPacote.length * 3.4 + 3;
  }

  // Devolução de dinheiro: só aparece quando houve. Precisa dizer a data que
  // vale, senão a contadora procura o par no mesmo período e não acha.
  if (rel.resumo.qtdEstornosAvulso > 0) {
    const notaDevolucao = doc.splitTextToSize(
      `DINHEIRO DEVOLVIDO: ${rel.resumo.qtdEstornosAvulso} devolução(ões), ` +
        `${moeda(rel.resumo.totalEstornadoAvulso)}, já descontado(s) do faturamento acima. ` +
        "A devolução conta no dia em que o dinheiro SAIU, não no dia do recebimento — então o " +
        "atendimento original pode estar num período anterior, que não muda. O atendimento " +
        "continua na listagem, com situação 'Devolvido ao cliente'.",
      larguraPagina - MARGEM * 2,
    );
    doc.text(notaDevolucao, MARGEM, y);
    y += notaDevolucao.length * 3.4 + 3;
  }

  if (rel.resumo.qtdSemTaxa > 0) {
    doc.setTextColor(146, 64, 14);
    const aviso = doc.splitTextToSize(
      `${rel.resumo.qtdSemTaxa} recebimento(s) sem taxa registrada (anteriores ao controle de taxas, ou forma sem ` +
        "percentual cadastrado): neles o líquido foi contado igual ao bruto, então o líquido acima é o máximo possível.",
      larguraPagina - MARGEM * 2,
    );
    doc.text(aviso, MARGEM, y);
    doc.setTextColor(...CINZA);
    y += aviso.length * 3.4 + 2;
  }

  if (rel.resumo.qtdRecebidoDeForaDoPeriodo > 0) {
    doc.setTextColor(3, 105, 161);
    doc.text(
      `Do faturamento acima, ${moeda(rel.resumo.recebidoDeForaDoPeriodo)} ` +
        `(${rel.resumo.qtdRecebidoDeForaDoPeriodo} atendimento(s)) são de atendimentos feitos fora deste período.`,
      MARGEM,
      y,
    );
    doc.setTextColor(...CINZA);
    y += 4.5;
  }

  if (rel.resumo.qtdAReceber > 0 || rel.resumo.qtdSemValor > 0) {
    doc.setTextColor(146, 64, 14);
    doc.setFont("helvetica", "bold");
    const pend = [
      rel.resumo.qtdAReceber > 0
        ? `${rel.resumo.qtdAReceber} a receber (${moeda(rel.resumo.totalAReceber)})`
        : null,
      rel.resumo.qtdSemValor > 0 ? `${rel.resumo.qtdSemValor} sem valor definido` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    doc.text(`Pendências fora do faturamento: ${pend}`, MARGEM, y);
    doc.setFont("helvetica", "normal");
    y += 5;
  }

  const opcoesBase = {
    theme: "striped" as const,
    headStyles: { fillColor: BRAND, textColor: 255, fontSize: 8.5, fontStyle: "bold" as const },
    bodyStyles: { fontSize: 8.5, textColor: 40 },
    alternateRowStyles: { fillColor: [248, 249, 249] as [number, number, number] },
    margin: { left: MARGEM, right: MARGEM },
  };

  function titulo(texto: string, posY: number): number {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(texto, MARGEM, posY);
    doc.setFont("helvetica", "normal");
    return posY + 2;
  }

  // --- Por serviço ---
  y = titulo("Por serviço", y + 4);
  autoTable(doc, {
    ...opcoesBase,
    startY: y + 2,
    head: [["Serviço", "Qtd.", "Como único", "Faturamento atribuível", "Valor médio"]],
    body: rel.porServico.linhas.map((l) => [
      l.nome,
      String(l.quantidade),
      String(l.qtdServicoUnico),
      l.qtdServicoUnico > 0 ? moeda(l.faturamentoServicoUnico) : "—",
      l.mediaServicoUnico === null ? "—" : moeda(l.mediaServicoUnico),
    ]),
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  doc.setFontSize(7.5);
  doc.setTextColor(...CINZA);
  const notaServico = doc.splitTextToSize(
    "O serviço não tem preço no sistema: o valor é livre por atendimento. Num atendimento com vários " +
      "serviços não há como saber quanto foi de cada um, então o valor não é rateado — a coluna " +
      "'Faturamento atribuível' soma apenas os atendimentos em que aquele serviço foi o único realizado. " +
      `Serviço único: ${moeda(rel.porServico.totalServicoUnico)} (${rel.porServico.qtdServicoUnico}) + ` +
      `combinados: ${moeda(rel.porServico.totalCombinado)} (${rel.porServico.qtdCombinado}) = ` +
      `${moeda(rel.resumo.faturamentoAvulsoBruto)} (o total em ATENDIMENTOS antes de devoluções — ` +
      "venda de pacote não passa por serviço nenhum, e o dinheiro devolvido sai na data da " +
      "devolução, que pode ser de outro período; os dois ficam fora desta conta).",
    larguraPagina - MARGEM * 2,
  );
  doc.text(notaServico, MARGEM, y);
  y += notaServico.length * 3.4 + 4;

  // --- Forma de pagamento ---
  y = titulo("Por forma de pagamento", y);
  autoTable(doc, {
    ...opcoesBase,
    startY: y + 2,
    head: [["Forma", "Qtd.", "Bruto", "Taxa", "Líquido"]],
    body: rel.porFormaPagamento.map((l) => [
      l.nome + (l.qtdSemTaxa > 0 ? ` (${l.qtdSemTaxa} s/ taxa)` : ""),
      String(l.quantidade),
      moeda(l.bruto),
      l.taxa === 0 ? "—" : `- ${moeda(l.taxa)}`,
      moeda(l.liquido),
    ]),
    foot: [
      [
        "Total",
        String(rel.resumo.qtdAtendimentos),
        moeda(rel.resumo.faturamento),
        `- ${moeda(rel.resumo.totalTaxas)}`,
        moeda(rel.resumo.faturamentoLiquido),
      ],
    ],
    footStyles: { fillColor: [236, 238, 238], textColor: 20, fontStyle: "bold", fontSize: 8.5 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // --- Por cliente / pet ---
  y = titulo("Por cliente / pet", y);
  autoTable(doc, {
    ...opcoesBase,
    startY: y + 2,
    head: [["Pet", "Tutor", "Visitas", "Total gasto", "Última visita"]],
    body: rel.porPet.map((l) => [
      l.petNome,
      l.tutorNome,
      String(l.visitas),
      moeda(l.total),
      dataLocal(l.ultimaVisita),
    ]),
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // --- Atendimentos do período ---
  y = titulo("Atendimentos do período", y);
  autoTable(doc, {
    ...opcoesBase,
    startY: y + 2,
    head: [
      ["Data", "Pet", "Tutor", "Serviços", "Bruto", "Líquido", "Pagamento", "Recebido em", "Situação", "Pacote"],
    ],
    body: rel.detalhado.map((l) => [
      dataLocal(l.data),
      l.petNome,
      l.tutorNome,
      l.servicos,
      l.situacao === "PACOTE" ? moeda(0) : l.valorTotal === null ? "A definir" : moeda(l.valorTotal),
      // Asterisco = líquido igual ao bruto por falta de taxa registrada.
      l.situacao !== "PAGO" ? "—" : moeda(l.liquido) + (l.taxaBps === null ? " *" : ""),
      l.formaNome
        ? l.formaNome + (l.parcelas && l.parcelas > 1 ? ` ${l.parcelas}x` : "")
        : "—",
      l.situacao === "PACOTE"
        ? "—"
        : l.dataRecebimento === null
          ? "em aberto"
          : dataLocal(l.dataRecebimento) + (l.recebidoForaDoPeriodo ? " (fora do período)" : ""),
      SITUACAO_LABEL[l.situacao],
      l.pacoteRotulo ?? "",
    ]),
    bodyStyles: { fontSize: 7, textColor: 40 },
    headStyles: { ...opcoesBase.headStyles, fontSize: 7 },
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
  });

  if (rel.detalhado.some((l) => l.situacao === "PAGO" && l.taxaBps === null)) {
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    doc.setFontSize(7);
    doc.setTextColor(...CINZA);
    doc.text("* líquido igual ao bruto: taxa não registrada neste pagamento.", MARGEM, y);
  }

  // --- Rodapé em todas as páginas ---
  const paginas = doc.getNumberOfPages();
  const geradoEm = dataLocal(new Date());
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    const alturaPagina = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.setFont("helvetica", "normal");
    doc.text(`Mon Petit · ${periodo.rotulo} · gerado em ${geradoEm}`, MARGEM, alturaPagina - 8);
    doc.text(`Página ${i} de ${paginas}`, larguraPagina - MARGEM, alturaPagina - 8, {
      align: "right",
    });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
