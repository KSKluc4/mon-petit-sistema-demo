import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarX2,
  Info,
  Landmark,
  Percent,
  Receipt,
  Ticket,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { formatCentavos, formatDataCurta } from "@/lib/datas";
import { resolverPeriodo } from "@/lib/periodos";
import { gerarRelatorio } from "@/lib/relatorios";
import { formatarParcelas, formatarTaxa } from "@/lib/pagamento";
import { PeriodoFiltro } from "@/components/relatorios/PeriodoFiltro";
import { BotoesExportar } from "@/components/relatorios/BotoesExportar";
import { GraficoEvolucao } from "@/components/relatorios/GraficoEvolucao";
import { TabelaPets } from "@/components/relatorios/TabelaPets";
import {
  FIXA_TD,
  FIXA_TH,
  SecaoRelatorio,
  SemDados,
  TD,
  TD_NUM,
  TH,
  TH_NUM,
  THEAD,
  TabelaScroll,
} from "@/components/relatorios/Tabela";

export const metadata = { title: "Relatórios" };

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ atalho?: string; de?: string; ate?: string }>;
}) {
  await requireSession();
  const params = await searchParams;
  const periodo = resolverPeriodo(params);
  const rel = await gerarRelatorio(periodo.inicioISO, periodo.fimISO);
  const { resumo, porServico } = rel;

  // Mesmo período nos botões de exportar — o arquivo sai igual à tela.
  const query = new URLSearchParams(
    periodo.atalho ? { atalho: periodo.atalho } : { de: periodo.inicioISO, ate: periodo.fimISO },
  ).toString();

  const temPendencia = resumo.qtdAReceber > 0 || resumo.qtdSemValor > 0;

  const cards = [
    {
      label: "Faturamento bruto",
      valor: formatCentavos(resumo.faturamento),
      icone: BadgeDollarSign,
      cor: "bg-brand-600",
      fundo: "bg-brand-50",
      texto: "text-brand-800",
    },
    {
      label: "Líquido (entra na conta)",
      valor: formatCentavos(resumo.faturamentoLiquido),
      icone: Landmark,
      cor: "bg-emerald-600",
      fundo: "bg-emerald-50",
      texto: "text-emerald-900",
    },
    {
      label: "Taxas",
      valor: formatCentavos(resumo.totalTaxas),
      icone: Percent,
      cor: "bg-amber-500",
      fundo: "bg-amber-50",
      texto: "text-amber-900",
    },
    {
      // "Recebimentos", não "Atendimentos": este número conta os pagamentos que
      // entraram no período, e um deles pode ser de atendimento de outro mês.
      // O card fica ao lado da listagem "7 atendimentos feitos neste período" —
      // com o mesmo rótulo, os dois pareceriam se contradizer.
      label: "Recebimentos",
      valor: String(resumo.qtdAtendimentos),
      icone: Receipt,
      cor: "bg-sky-500",
      fundo: "bg-sky-50",
      texto: "text-sky-800",
    },
    {
      label: "Ticket médio",
      valor: resumo.ticketMedio === null ? "—" : formatCentavos(resumo.ticketMedio),
      icone: TrendingUp,
      cor: "bg-emerald-500",
      fundo: "bg-emerald-50",
      texto: "text-emerald-800",
    },
    {
      label: "Cancelados",
      valor: String(resumo.cancelados),
      icone: CalendarX2,
      cor: "bg-rose-500",
      fundo: "bg-rose-50",
      texto: "text-rose-800",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-neutral-900">Relatórios</h1>
        <p className="text-neutral-500">Fechamento do período e números para a contabilidade</p>
      </div>

      <PeriodoFiltro periodo={periodo} />

      {/* Pedido explícito: deixar na tela o que está sendo contado, para ela
          conferir antes de mandar para a contadora. */}
      <div className="flex gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">O que está sendo contado</p>
          <p>
            O faturamento conta só atendimentos <strong>pagos</strong> (com valor definido e forma
            de pagamento registrada), pela <strong>data em que o dinheiro entrou</strong> — regime
            de caixa. Um banho feito em julho e pago em agosto conta no faturamento de{" "}
            <strong>agosto</strong>. É o que faz um período já fechado nunca mais mudar de valor
            depois de enviado à contabilidade.
          </p>
          <p>
            A <strong>listagem de atendimentos</strong> no fim da página é a outra metade: ela vai
            pela data em que o atendimento foi <strong>feito</strong>, e por isso inclui o que ainda
            está em aberto. Atendimento sem valor ou não pago fica fora do faturamento e aparece
            como pendência. Cancelado nunca entra no faturamento; o contador de cancelados usa a
            data do agendamento, porque um cancelamento não gera atendimento.
          </p>
          <p>
            <strong>Pacotes</strong> entram no faturamento no dia em que foram{" "}
            <strong>vendidos</strong>, pelo valor cheio. Os banhos usados depois aparecem na
            listagem com valor zero e a marca <em>Pago no pacote</em>: são serviço prestado, e o
            dinheiro deles já foi contado na venda. É assim que o mesmo banho não conta duas vezes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(({ label, valor, icone: Icone, cor, fundo, texto }) => (
          <div key={label} className={`flex flex-col gap-2 rounded-2xl ${fundo} px-4 py-4 shadow-sm`}>
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${cor} text-white`}>
              <Icone className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className={`font-display text-2xl font-extrabold tabular-nums ${texto}`}>{valor}</span>
            <span className={`text-sm font-semibold ${texto}`}>{label}</span>
          </div>
        ))}
      </div>

      {temPendencia && (
        <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Pendências do período (fora do faturamento acima)</p>
            <p className="mt-0.5 text-xs">
              Atendimentos <strong>feitos</strong> neste período que ainda não foram recebidos.
              Entram no faturamento do dia em que forem pagos, não neste.
            </p>
            <ul className="mt-1 list-inside list-disc">
              {resumo.qtdAReceber > 0 && (
                <li>
                  {resumo.qtdAReceber} atendimento{resumo.qtdAReceber > 1 ? "s" : ""} a receber —{" "}
                  <strong>{formatCentavos(resumo.totalAReceber)}</strong> (valor definido, pagamento
                  não registrado)
                </li>
              )}
              {resumo.qtdSemValor > 0 && (
                <li>
                  {resumo.qtdSemValor} atendimento{resumo.qtdSemValor > 1 ? "s" : ""} sem valor
                  definido
                </li>
              )}
            </ul>
            <p className="mt-1.5 text-xs">
              Para dar baixa, use <strong>Caixa → A receber</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Fecha a conta entre "o que rendeu" e "o que foi feito". Sem esta linha,
          um faturamento maior que a soma da listagem pareceria erro. */}
      <div className="flex flex-col gap-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
        <p className="font-semibold text-neutral-900">Como o faturamento se compõe</p>
        <dl className="grid gap-1 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-neutral-500">Recebido no período</dt>
            <dd className="font-bold tabular-nums text-neutral-900">
              {formatCentavos(resumo.faturamento)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">
              Dos quais, de atendimentos fora do período ({resumo.qtdRecebidoDeForaDoPeriodo})
            </dt>
            <dd className="font-semibold tabular-nums">
              {formatCentavos(resumo.recebidoDeForaDoPeriodo)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">
              Atendimentos feitos no período ({resumo.qtdRealizados})
            </dt>
            <dd className="font-semibold tabular-nums">
              {resumo.qtdAReceber + resumo.qtdSemValor} ainda em aberto
            </dd>
          </div>
        </dl>

        {/* As DUAS fontes de receita. Sem esta linha, o faturamento não bateria
            com a soma dos atendimentos e pareceria erro — a venda de pacote não
            passa por atendimento nenhum. */}
        <dl className="mt-2 grid gap-1 border-t border-neutral-200 pt-2 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-neutral-500">Receita de atendimento</dt>
            <dd className="font-semibold tabular-nums text-neutral-900">
              {formatCentavos(resumo.faturamentoAvulso)}
              {/* Sem esta marca a tabela "Por serviço" logo abaixo não somaria
                  este número: o rateio fecha contra o BRUTO, porque uma
                  devolução pode ser de atendimento de outro período e não
                  pertence a serviço nenhum daqui. */}
              {resumo.qtdEstornosAvulso > 0 && (
                <span className="ml-1 text-xs font-normal text-rose-700">
                  (já sem {formatCentavos(resumo.totalEstornadoAvulso)} de{" "}
                  {resumo.qtdEstornosAvulso}{" "}
                  {resumo.qtdEstornosAvulso === 1 ? "devolução" : "devoluções"})
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">
              Venda de pacotes ({resumo.qtdPacotesVendidos})
            </dt>
            <dd className="font-semibold tabular-nums text-neutral-900">
              {formatCentavos(resumo.faturamentoPacotes)}
              {resumo.qtdEstornos > 0 && (
                <span className="ml-1 text-xs font-normal text-rose-700">
                  (já sem {formatCentavos(resumo.totalEstornado)} de {resumo.qtdEstornos}{" "}
                  {resumo.qtdEstornos === 1 ? "cancelamento" : "cancelamentos"})
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Banhos de pacote usados</dt>
            <dd className="font-semibold tabular-nums text-neutral-900">
              {resumo.banhosDePacote}
              <span className="ml-1 text-xs font-normal text-neutral-500">
                sem receita neste período
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {resumo.banhosDePacote > 0 && (
        <p className="flex gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <Ticket className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>
              {resumo.banhosDePacote}{" "}
              {resumo.banhosDePacote === 1 ? "banho saiu" : "banhos saíram"} de pacote
            </strong>{" "}
            neste período. É serviço prestado que <strong>não</strong> gera receita no dia — o
            dinheiro entrou quando o pacote foi vendido. Eles contam entre os atendimentos
            realizados, nunca no faturamento.
          </span>
        </p>
      )}

      <BotoesExportar query={query} />

      <SecaoRelatorio
        titulo="Evolução do faturamento"
        descricao="Os 12 meses até o fim do período selecionado — serve para ver sazonalidade e crescimento."
      >
        <GraficoEvolucao pontos={rel.evolucao} />
      </SecaoRelatorio>

      <SecaoRelatorio
        titulo="Por serviço"
        descricao="Quantas vezes cada serviço foi realizado no período."
      >
        {porServico.linhas.length === 0 ? (
          <SemDados>Nenhum serviço realizado em atendimento pago neste período.</SemDados>
        ) : (
          <>
            <TabelaScroll>
              <thead className={THEAD}>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className={FIXA_TH} scope="col">
                    Serviço
                  </th>
                  <th className={TH_NUM} scope="col">
                    Qtd.
                  </th>
                  <th className={TH_NUM} scope="col">
                    Faturamento atribuível
                  </th>
                  <th className={TH_NUM} scope="col">
                    Valor médio
                  </th>
                </tr>
              </thead>
              <tbody>
                {porServico.linhas.map((l) => (
                  <tr
                    key={l.servicoId}
                    className="group/linha border-b border-neutral-100 last:border-0 even:bg-neutral-50/60"
                  >
                    <td className={`${FIXA_TD} font-semibold`}>{l.nome}</td>
                    <td className={TD_NUM}>{l.quantidade}</td>
                    <td className={TD_NUM}>
                      {l.qtdServicoUnico === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <>
                          <span className="font-semibold">
                            {formatCentavos(l.faturamentoServicoUnico)}
                          </span>
                          <span className="ml-1 text-xs text-neutral-500">
                            ({l.qtdServicoUnico} de {l.quantidade})
                          </span>
                        </>
                      )}
                    </td>
                    <td className={TD_NUM}>
                      {l.mediaServicoUnico === null ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        formatCentavos(l.mediaServicoUnico)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TabelaScroll>

            {/* A explicação do rateio — a decisão de produto mais delicada
                desta tela, e ela precisa estar visível junto da tabela. */}
            <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <p>
                <strong>Por que o faturamento não é dividido entre os serviços.</strong> No sistema o
                serviço não tem preço: o valor é único e livre por atendimento. Num atendimento de
                Banho + Tosa existe um total só, e o sistema nunca soube quanto foi de cada um —
                dividir seria inventar número, e ele iria para a contabilidade como se fosse real.
                Por isso a coluna <em>Faturamento atribuível</em> só soma os atendimentos em que
                aquele serviço foi o <strong>único</strong> realizado; a coluna <em>Qtd.</em> conta
                todas as vezes, inclusive as combinadas.
              </p>
              <dl className="grid gap-1 border-t border-neutral-200 pt-2 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-neutral-500">
                    Serviço único ({porServico.qtdServicoUnico})
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {formatCentavos(porServico.totalServicoUnico)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">
                    Combinados ({porServico.qtdCombinado})
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {formatCentavos(porServico.totalCombinado)}
                  </dd>
                </div>
                <div>
                  {/* O rateio fecha contra a receita de ATENDIMENTO, e pelo
                      BRUTO — não contra o faturamento do topo da tela. Venda de
                      pacote não passa por serviço nenhum, e uma devolução pode
                      ser de atendimento de outro período. Mostrar o total daqui
                      faria três números que visivelmente não somam. */}
                  <dt className="text-xs text-neutral-500">Total em atendimentos</dt>
                  <dd className="font-bold tabular-nums text-neutral-900">
                    {formatCentavos(resumo.faturamentoAvulsoBruto)}
                  </dd>
                </div>
              </dl>
              {(resumo.faturamentoPacotes !== 0 || resumo.qtdEstornosAvulso > 0) && (
                <p className="text-xs text-neutral-500">
                  Fora desta conta: venda de pacote (não passa por serviço)
                  {resumo.qtdEstornosAvulso > 0 &&
                    " e o dinheiro devolvido, que sai na data da devolução"}
                  . Por isso este total é menor que o faturamento no topo da tela.
                </p>
              )}
            </div>
          </>
        )}
      </SecaoRelatorio>

      <SecaoRelatorio titulo="Por cliente / pet" descricao="Toque no cabeçalho para reordenar.">
        {rel.porPet.length === 0 ? (
          <SemDados>Nenhum atendimento pago neste período.</SemDados>
        ) : (
          <TabelaPets
            linhas={rel.porPet.map((l) => ({
              petId: l.petId,
              petNome: l.petNome,
              tutorNome: l.tutorNome,
              visitas: l.visitas,
              total: l.total,
              totalTexto: formatCentavos(l.total),
              ultimaVisitaTexto: formatDataCurta(l.ultimaVisita),
              ultimaVisitaMs: l.ultimaVisita.getTime(),
            }))}
          />
        )}
      </SecaoRelatorio>

      <SecaoRelatorio
        titulo="Por forma de pagamento"
        descricao="Bruto é o que o cliente pagou; líquido é o que entra na conta depois da taxa da maquininha."
      >
        {rel.porFormaPagamento.length === 0 ? (
          <SemDados>Nenhum pagamento registrado neste período.</SemDados>
        ) : (
          <>
            <TabelaScroll>
              <thead className={THEAD}>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className={FIXA_TH} scope="col">
                    Forma
                  </th>
                  <th className={TH_NUM} scope="col">
                    Qtd.
                  </th>
                  <th className={TH_NUM} scope="col">
                    Bruto
                  </th>
                  <th className={TH_NUM} scope="col">
                    Taxa
                  </th>
                  <th className={TH_NUM} scope="col">
                    Líquido
                  </th>
                </tr>
              </thead>
              <tbody>
                {rel.porFormaPagamento.map((l) => (
                  <tr
                    key={l.formaId}
                    className="group/linha border-b border-neutral-100 last:border-0 even:bg-neutral-50/60"
                  >
                    <td className={`${FIXA_TD} font-semibold`}>
                      {l.nome}
                      {l.qtdSemTaxa > 0 && (
                        <span className="ml-1 text-xs font-normal text-amber-700">
                          ({l.qtdSemTaxa} sem taxa registrada)
                        </span>
                      )}
                    </td>
                    <td className={TD_NUM}>{l.quantidade}</td>
                    <td className={TD_NUM}>{formatCentavos(l.bruto)}</td>
                    <td className={TD_NUM}>
                      {l.taxa === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <span className="text-amber-700">− {formatCentavos(l.taxa)}</span>
                      )}
                    </td>
                    <td className={`${TD_NUM} font-semibold`}>{formatCentavos(l.liquido)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-neutral-300 bg-neutral-50">
                  <td className={`${FIXA_TD} bg-neutral-50 font-bold`}>Total</td>
                  <td className={`${TD_NUM} font-bold`}>{resumo.qtdAtendimentos}</td>
                  <td className={`${TD_NUM} font-bold`}>{formatCentavos(resumo.faturamento)}</td>
                  <td className={`${TD_NUM} font-bold text-amber-700`}>
                    − {formatCentavos(resumo.totalTaxas)}
                  </td>
                  <td className={`${TD_NUM} font-bold`}>
                    {formatCentavos(resumo.faturamentoLiquido)}
                  </td>
                </tr>
              </tbody>
            </TabelaScroll>

            {resumo.qtdSemTaxa > 0 && (
              <p className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {resumo.qtdSemTaxa}{" "}
                  {resumo.qtdSemTaxa === 1 ? "recebimento não tem" : "recebimentos não têm"} taxa
                  registrada (pagamentos anteriores ao controle de taxas, ou forma ainda sem
                  percentual cadastrado). Neles o líquido foi contado igual ao bruto, então{" "}
                  <strong>o líquido acima é o máximo possível</strong> — o real pode ser um pouco
                  menor.{" "}
                  <Link href="/formas-pagamento" className="font-semibold underline">
                    Cadastrar as taxas
                  </Link>
                  .
                </span>
              </p>
            )}
          </>
        )}
      </SecaoRelatorio>

      <SecaoRelatorio
        titulo="Atendimentos do período"
        descricao={`${rel.detalhado.length} atendimento${rel.detalhado.length === 1 ? "" : "s"} feito${rel.detalhado.length === 1 ? "" : "s"} neste período, pagos ou não. Pela data do atendimento — o faturamento acima é pela data do recebimento, então as duas somas não precisam bater.`}
      >
        {rel.detalhado.length === 0 ? (
          <SemDados>Nenhum atendimento registrado neste período.</SemDados>
        ) : (
          <TabelaScroll>
            <thead className={THEAD}>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className={FIXA_TH} scope="col">
                  Data
                </th>
                <th className={TH} scope="col">
                  Pet
                </th>
                <th className={TH} scope="col">
                  Tutor
                </th>
                <th className={TH} scope="col">
                  Serviços
                </th>
                <th className={TH_NUM} scope="col">
                  Bruto
                </th>
                <th className={TH_NUM} scope="col">
                  Líquido
                </th>
                <th className={TH} scope="col">
                  Pagamento
                </th>
                <th className={TH} scope="col">
                  Recebido em
                </th>
              </tr>
            </thead>
            <tbody>
              {rel.detalhado.map((l) => (
                <tr
                  key={l.id}
                  className="group/linha border-b border-neutral-100 last:border-0 even:bg-neutral-50/60"
                >
                  <td className={`${FIXA_TD} font-semibold`}>{formatDataCurta(l.data)}</td>
                  <td className={TD}>{l.petNome}</td>
                  <td className={TD}>{l.tutorNome}</td>
                  <td className={TD}>
                    {l.servicos}
                    {l.pacoteRotulo && (
                      <span className="ml-1.5 whitespace-nowrap rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                        {l.pacoteRotulo}
                      </span>
                    )}
                  </td>
                  <td className={TD_NUM}>
                    {l.situacao === "PACOTE" ? (
                      <span className="text-brand-700">Pago no pacote</span>
                    ) : l.valorTotal === null ? (
                      <span className="text-amber-600">A definir</span>
                    ) : (
                      formatCentavos(l.valorTotal)
                    )}
                  </td>
                  <td className={TD_NUM}>
                    {l.situacao !== "PAGO" ? (
                      <span className="text-neutral-400">—</span>
                    ) : l.taxaBps === null ? (
                      <span className="text-amber-600" title="taxa não registrada">
                        {formatCentavos(l.liquido)}*
                      </span>
                    ) : (
                      formatCentavos(l.liquido)
                    )}
                  </td>
                  <td className={TD}>
                    {l.formaNome ? (
                      <>
                        {l.formaNome}
                        {formatarParcelas(l.parcelas) && (
                          <span className="text-neutral-500"> · {formatarParcelas(l.parcelas)}</span>
                        )}
                        {l.taxaBps !== null && l.taxaBps > 0 && (
                          <span className="text-neutral-400"> ({formatarTaxa(l.taxaBps)})</span>
                        )}
                      </>
                    ) : l.situacao === "PACOTE" ? (
                      <span className="text-brand-700">Pacote</span>
                    ) : (
                      <span className="text-amber-600">A receber</span>
                    )}
                  </td>
                  <td className={TD}>
                    {l.situacao === "PACOTE" ? (
                      <span className="text-neutral-400">—</span>
                    ) : l.dataRecebimento === null ? (
                      <span className="text-amber-600">em aberto</span>
                    ) : (
                      <>
                        {formatDataCurta(l.dataRecebimento)}
                        {/* Recebido noutro período: a linha está aqui porque o
                            atendimento foi feito aqui, mas o dinheiro contou
                            noutro mês. Sem a marca, a coluna Valor não somaria
                            o faturamento do topo e pareceria erro. */}
                        {l.recebidoForaDoPeriodo && (
                          <span className="ml-1 text-xs text-sky-700">(fora do período)</span>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TabelaScroll>
        )}
      </SecaoRelatorio>
    </div>
  );
}
