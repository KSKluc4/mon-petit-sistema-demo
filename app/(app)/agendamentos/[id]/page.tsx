import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Scissors,
  PawPrint,
  PackageCheck,
  Ticket,
  Pencil,
  RotateCcw,
  Undo2,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { WhatsappButton } from "@/components/ui/WhatsappButton";
import { STATUS_INFO } from "@/components/agenda/statusInfo";
import { EspecieIcon } from "@/components/agenda/EspecieIcon";
import { AcaoDiscreta } from "@/components/agenda/AcaoDiscreta";
import { EtapaTimeline } from "@/components/agenda/EtapaTimeline";
import { FecharAtendimentoForm } from "@/components/agenda/FecharAtendimentoForm";
import { CancelarAgendamentoForm } from "@/components/agenda/CancelarAgendamentoForm";
import { RegistrarPagamentoForm } from "@/components/agenda/RegistrarPagamentoForm";
import { CorrigirPagamentoForm } from "@/components/agenda/CorrigirPagamentoForm";
import { DevolverDinheiroForm } from "@/components/agenda/DevolverDinheiroForm";
import { calcularRank } from "@/components/agenda/etapaInfo";
import { comAutor } from "@/lib/autoria";
import { formatarParcelas, formatarTaxa, valoresDoPagamento } from "@/lib/pagamento";
import { listarFormasAtivas } from "@/lib/recebimento";
import { pacoteDaVez } from "@/lib/pacotes";
import {
  dataISODe,
  formatCentavos,
  formatDataCurta,
  formatHora,
  hojeISO,
  TIMEZONE,
} from "@/lib/datas";
import { mensagemAgradecimento, mensagemConfirmarHorario, mensagemPetPronto } from "@/lib/whatsapp";
import { formatarTelefone } from "@/lib/telefone";
import { petProntoAction, reativarAgendamentoAction, voltarEtapaAction } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ag = await prisma.agendamento.findUnique({ where: { id }, select: { pet: { select: { nome: true } } } });
  return { title: ag ? ag.pet.nome : "Agendamento" };
}

export default async function AgendamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    fechar?: string;
    cancelar?: string;
    corrigir?: string;
    devolver?: string;
    erro?: string;
  }>;
}) {
  const { id } = await params;
  const { fechar, cancelar, corrigir, devolver, erro } = await searchParams;

  const ag = await prisma.agendamento.findUnique({
    where: { id },
    include: {
      pet: { include: { cliente: true } },
      servicos: { include: { servico: true } },
      atendimento: {
        include: {
          forma: true,
          // Diz se este atendimento saiu de um pacote — muda o que a ficha
          // mostra no lugar do valor ("Pago no pacote", e qual banho foi).
          consumoPacote: { include: { pacote: { select: { banhosTotal: true } } } },
          // Dinheiro já devolvido: troca o painel de pagamento pelo aviso e
          // tira os botões de corrigir/devolver.
          estornos: true,
        },
      },
    },
  });
  if (!ag) notFound();

  // O pacote que um banho novo consumiria: o mais antigo ainda ativo. Consultado
  // na hora de fechar, não no agendamento — entre marcar e atender ele pode ter
  // acabado ou vencido.
  const pacoteDisponivel = ag.status === "PRONTO" ? await pacoteDaVez(ag.petId) : null;

  // O seletor de forma precisa do catálogo com as taxas de hoje.
  const formas = (await listarFormasAtivas()).map((f) => ({
    id: f.id,
    nome: f.nome,
    tipo: f.tipo,
    rotulo: f.rotulo,
    taxas: f.taxas.map((t) => ({ parcelas: t.parcelas, taxaBps: t.taxaBps })),
  }));

  const info = STATUS_INFO[ag.status];
  const dataISO = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(ag.dataHora);
  const rank = calcularRank(ag.status);
  const mostrarFechamento = fechar === "1" && ag.status === "PRONTO";
  // Editar e cancelar só existem enquanto o atendimento está em aberto —
  // depois de entregue, nenhum dos dois aparece.
  const emAberto = ag.status === "AGENDADO" || ag.status === "PRONTO";
  const mostrarCancelamento = cancelar === "1" && emAberto;

  // --- Correção e devolução de um pagamento já registrado (05/08/2026) ---
  const at = ag.atendimento;
  const estornado = (at?.estornos.length ?? 0) > 0;
  const pago = at !== null && at !== undefined && at.dataRecebimento !== null && !estornado;
  // Corrigir só no MESMO DIA: depois disso, mudar o valor recalcularia um
  // período possivelmente já fechado. O servidor reconfere — este cálculo só
  // decide se o botão aparece.
  const recebidoHoje = at?.dataRecebimento != null && dataISODe(at.dataRecebimento) === hojeISO();
  const mostrarCorrecao = corrigir === "1" && pago && recebidoHoje;
  const mostrarDevolucao = devolver === "1" && pago && (at?.valorTotal ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {ag.pet.fotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ag.pet.fotoUrl}
              alt={ag.pet.nome}
              className="w-12 h-12 rounded-full object-cover border border-neutral-200 shrink-0"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-neutral-900 truncate flex items-center gap-1.5">
              <EspecieIcon especie={ag.pet.especie} className="w-5 h-5 text-brand-600 shrink-0" />
              {ag.pet.nome}
            </h1>
            <p className="text-neutral-500 text-sm">
              {formatDataCurta(ag.dataHora)} às {formatHora(ag.dataHora)}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${info.badge}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
          {info.label}
        </span>
      </div>

      {ag.pet.observacoes && (
        <div className="rounded-2xl bg-amber-100 border border-amber-300 px-4 py-3 text-sm text-amber-900 font-medium flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {ag.pet.observacoes}
        </div>
      )}
      {ag.pet.padraoPet && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 flex gap-2">
          <Scissors className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          Padrão do pet: {ag.pet.padraoPet}
        </div>
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-neutral-500">Tutor</p>
          <Link href={`/clientes/${ag.pet.clienteId}`} className="font-medium text-neutral-900 underline">
            {ag.pet.cliente.nome}
          </Link>
          <p className="text-neutral-500">{formatarTelefone(ag.pet.cliente.telefone)}</p>
        </div>

        <div className="border-t border-neutral-100 pt-3 flex flex-col gap-1.5">
          <p className="text-sm text-neutral-500">Serviços</p>
          {ag.servicos.map((s) => (
            <div key={s.id} className="flex justify-between text-sm">
              <span className="text-neutral-900">{s.servico.nome}</span>
              {/* Valor por serviço só existe em agendamentos antigos, de quando
                  o cadastro de serviço ainda tinha preço. */}
              {s.valorCobrado !== null && (
                <span className="text-neutral-600 tabular-nums">{formatCentavos(s.valorCobrado)}</span>
              )}
            </div>
          ))}
          <div className="flex justify-between font-bold text-neutral-900 border-t border-neutral-100 pt-2 mt-1">
            <span>Total</span>
            {ag.valorTotal === null ? (
              <span className="text-amber-600">Valor a definir</span>
            ) : (
              <span className="tabular-nums">{formatCentavos(ag.valorTotal)}</span>
            )}
          </div>
        </div>

        {ag.observacoes && (
          <div className="border-t border-neutral-100 pt-3 text-sm">
            <p className="text-neutral-500">Observações</p>
            <p className="text-neutral-900">{ag.observacoes}</p>
          </div>
        )}
      </Card>

      {ag.status === "CANCELADO" ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3">
          <div className="text-sm text-rose-800">
            <p className="font-semibold">Atendimento cancelado.</p>
            {ag.motivoCancelamento && <p className="mt-1">Motivo: {ag.motivoCancelamento}</p>}
            <p className="mt-1 text-rose-700">
              O horário está livre e nada foi lançado no caixa.
            </p>
          </div>
          {/* Cliente remarcar no mesmo dia é comum — reativar devolve o
              agendamento para o começo do fluxo. */}
          <form action={reativarAgendamentoAction.bind(null, ag.id)}>
            <Button type="submit" variant="secondary" className="w-full">
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Reativar agendamento
            </Button>
          </form>
        </div>
      ) : (
        <EtapaTimeline rank={rank} />
      )}

      {mostrarCancelamento && (
        <CancelarAgendamentoForm
          agendamentoId={ag.id}
          nomePet={ag.pet.nome}
          sexoPet={ag.pet.sexo}
          hora={formatHora(ag.dataHora)}
        />
      )}

      {/* Editar e cancelar: botões de verdade, mas em tom secundário
          (contorno). A ação-hero da tela continua sendo o próximo passo do
          atendimento, o botão laranja logo abaixo. */}
      {emAberto && !mostrarCancelamento && (
        <div className="flex flex-col gap-2">
          <ButtonLink href={`/agendamentos/${ag.id}/editar`} variant="secondary" className="w-full">
            <Pencil className="w-4 h-4" aria-hidden="true" /> Editar agendamento
          </ButtonLink>
          {/* A confirmação (com pet, horário e motivo) fica no painel aberto
              por `?cancelar=1` — nada é cancelado só com este toque. */}
          <ButtonLink
            href={`/agendamentos/${ag.id}?cancelar=1`}
            variant="secondary"
            className="w-full"
          >
            <XCircle className="w-4 h-4" aria-hidden="true" /> Cancelar agendamento
          </ButtonLink>
        </div>
      )}

      {/* Botão principal: sempre o próximo passo do fluxo, em laranja — o
          elemento mais chamativo da tela. Só existem dois. */}
      {ag.status === "AGENDADO" && !mostrarCancelamento && (
        <form action={petProntoAction.bind(null, ag.id)}>
          <Button type="submit" variant="accent" className="w-full">
            <PawPrint className="w-4 h-4" aria-hidden="true" /> Pet pronto
          </Button>
        </form>
      )}

      {ag.status === "PRONTO" && !mostrarFechamento && !mostrarCancelamento && (
        <ButtonLink href={`/agendamentos/${ag.id}?fechar=1`} variant="accent" className="w-full">
          <PackageCheck className="w-4 h-4" aria-hidden="true" /> Entregue
        </ButtonLink>
      )}

      {mostrarFechamento && (
        <FecharAtendimentoForm
          agendamentoId={ag.id}
          valorAtual={ag.valorTotal}
          formas={formas}
          pacote={
            pacoteDisponivel
              ? {
                  proximoBanho: pacoteDisponivel.usados + 1,
                  banhosTotal: pacoteDisponivel.banhosTotal,
                }
              : null
          }
        />
      )}

      {/* Recusa do "Voltar uma etapa" num atendimento pago. A mensagem diz o
          que FAZER, não só que não pode — sem isso ela fica sem saída na tela,
          já que editar atendimento finalizado é bloqueado. */}
      {erro === "pago" && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Esse atendimento já foi pago, então ele não pode ser desfeito — o registro do dinheiro
            precisa continuar existindo. Para mudar o valor ou a forma, use{" "}
            <strong>Corrigir pagamento</strong>. Se você devolveu o dinheiro ao cliente, use{" "}
            <strong>Devolver dinheiro</strong>.
          </p>
        </div>
      )}

      {mostrarCorrecao && at && (
        <CorrigirPagamentoForm
          atendimentoId={at.id}
          agendamentoId={ag.id}
          valorAtual={at.valorTotal}
          formaAtualId={at.formaId}
          formas={formas}
        />
      )}

      {mostrarDevolucao && at?.dataRecebimento && (
        <DevolverDinheiroForm
          atendimentoId={at.id}
          agendamentoId={ag.id}
          valor={at.valorTotal ?? 0}
          nomePet={ag.pet.nome}
          sexoPet={ag.pet.sexo}
          formaNome={at.forma?.nome ?? null}
          dataRecebimento={at.dataRecebimento}
        />
      )}

      {ag.status === "FINALIZADO" && ag.atendimento && (
        <Card className="flex flex-col gap-1 text-sm">
          {/* Dinheiro devolvido: o card continua mostrando o que foi cobrado (o
              recebimento existiu e conta no dia dele), mas com o selo dizendo
              que voltou — e em que dia, que pode ser outro. */}
          {estornado && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
              <Undo2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Dinheiro devolvido ao cliente</strong> em{" "}
                {formatDataCurta(ag.atendimento.estornos[0].data)} por{" "}
                {ag.atendimento.estornos[0].feitoPor}
                {ag.atendimento.estornos[0].motivo && ` · ${ag.atendimento.estornos[0].motivo}`}
              </span>
            </div>
          )}
          {ag.atendimento.consumoPacote && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-brand-900">
              <Ticket className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="font-semibold">
                Banho {ag.atendimento.consumoPacote.indice} de{" "}
                {ag.atendimento.consumoPacote.pacote.banhosTotal} — pago no pacote
              </span>
            </div>
          )}
          <p className="text-neutral-500">
            {ag.atendimento.consumoPacote ? "Serviço extra" : "Pagamento"}
          </p>
          <p className="font-medium text-neutral-900">
            {ag.atendimento.forma ? (
              <>
                {ag.atendimento.forma.nome}
                {formatarParcelas(ag.atendimento.parcelas) && (
                  <span className="text-neutral-500">
                    {" "}
                    · {formatarParcelas(ag.atendimento.parcelas)}
                  </span>
                )}
              </>
            ) : ag.atendimento.consumoPacote && (ag.atendimento.valorTotal ?? 0) === 0 ? (
              // Sem extra não há nada a receber: o dinheiro entrou na venda do
              // pacote. Dizer "A receber" aqui mandaria cobrar de novo.
              "Nada a mais neste dia"
            ) : (
              "A receber"
            )}
          </p>
          <p className="text-neutral-500 mt-2">Valor</p>
          {ag.atendimento.consumoPacote && (ag.atendimento.valorTotal ?? 0) === 0 ? (
            <p className="font-medium text-brand-700">Sem serviço extra</p>
          ) : ag.atendimento.valorTotal === null ? (
            <p className="font-medium text-amber-600">Valor a definir</p>
          ) : (
            (() => {
              const v = valoresDoPagamento(ag.atendimento.valorTotal, ag.atendimento.taxaBps);
              return (
                <>
                  <p className="font-medium text-neutral-900 tabular-nums">
                    {formatCentavos(v.bruto)} <span className="text-neutral-500">bruto</span>
                  </p>
                  {ag.atendimento.forma &&
                    (v.taxaDesconhecida ? (
                      <p className="text-amber-700">
                        Taxa não registrada — este pagamento é anterior ao controle de taxas.
                      </p>
                    ) : (
                      <p className="text-neutral-600 tabular-nums">
                        taxa {formatCentavos(v.taxa)}{" "}
                        <span className="text-neutral-400">
                          ({formatarTaxa(ag.atendimento.taxaBps)})
                        </span>{" "}
                        · líquido{" "}
                        <strong className="text-neutral-900">{formatCentavos(v.liquido)}</strong>
                      </p>
                    ))}
                </>
              );
            })()
          )}
          {ag.atendimento.observacoes && (
            <>
              <p className="text-neutral-500 mt-2">Observações do atendimento</p>
              <p className="text-neutral-900">{ag.atendimento.observacoes}</p>
            </>
          )}

          {/* Quem fez o quê. São duas pessoas diferentes no caso comum: quem
              entregou o pet de manhã pode não ser quem recebeu à tarde. */}
          <div className="mt-2 flex flex-col gap-0.5 border-t border-neutral-100 pt-2 text-neutral-500">
            <p>
              {comAutor("Finalizado por", ag.atendimento.responsavel)} ·{" "}
              {formatDataCurta(ag.atendimento.data)}
            </p>
            {ag.atendimento.dataRecebimento && (
              <p>
                {comAutor("Recebido por", ag.atendimento.recebidoPor)} ·{" "}
                {formatDataCurta(ag.atendimento.dataRecebimento)}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* As duas saídas de um pagamento já registrado. Secundárias: a tela não
          tem mais ação-hero depois de entregue.

          "Corrigir pagamento" só no mesmo dia — depois disso mudar o valor
          recalcularia um período possivelmente já fechado, e o caminho passa a
          ser a devolução, que é datada pelo dia em que o dinheiro saiu. */}
      {pago && !mostrarCorrecao && !mostrarDevolucao && (
        <div className="flex flex-col gap-2">
          {recebidoHoje && (
            <ButtonLink
              href={`/agendamentos/${ag.id}?corrigir=1`}
              variant="secondary"
              className="w-full"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" /> Corrigir pagamento
            </ButtonLink>
          )}
          {(at?.valorTotal ?? 0) > 0 && (
            <ButtonLink
              href={`/agendamentos/${ag.id}?devolver=1`}
              variant="secondary"
              className="w-full"
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" /> Devolver dinheiro
            </ButtonLink>
          )}
        </div>
      )}

      {/* O painel de cobrança some quando o banho saiu do pacote e não houve
          extra: ali não há nada a receber, e oferecer o formulário mandaria
          cobrar de novo um dinheiro que já entrou na venda do pacote. Com
          extra em aberto ele continua aparecendo — a dívida do extra é real. */}
      {ag.status === "FINALIZADO" &&
        ag.atendimento &&
        !ag.atendimento.formaId &&
        !(ag.atendimento.consumoPacote && (ag.atendimento.valorTotal ?? 0) === 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-3">
          <p className="text-sm text-amber-800 font-medium">
            {ag.atendimento.valorTotal === null
              ? "Valor a definir — informe o valor para registrar o pagamento."
              : "Pagamento ainda não registrado."}
          </p>
          <RegistrarPagamentoForm
            atendimentoId={ag.atendimento.id}
            agendamentoId={ag.id}
            valorAtual={ag.atendimento.valorTotal}
            formas={formas}
          />
        </div>
      )}

      {/* Uma mensagem por momento do fluxo: confirmar enquanto agendado, avisar
          quando pronto, agradecer depois de entregue. Cancelado não dispara
          mensagem nenhuma. */}
      {(ag.status === "AGENDADO" || ag.status === "PRONTO" || ag.status === "FINALIZADO") && (
        <div className="flex flex-col gap-2">
          {ag.status === "AGENDADO" && (
            <WhatsappButton
              telefone={ag.pet.cliente.telefone}
              mensagem={mensagemConfirmarHorario(ag.pet.cliente.nome, ag.pet.nome, ag.pet.sexo, dataISO, formatHora(ag.dataHora))}
            >
              Confirmar horário
            </WhatsappButton>
          )}
          {(ag.status === "PRONTO" || ag.status === "FINALIZADO") && (
            <WhatsappButton
              telefone={ag.pet.cliente.telefone}
              mensagem={mensagemPetPronto(ag.pet.cliente.nome, ag.pet.nome, ag.pet.sexo)}
            >
              Pet pronto
            </WhatsappButton>
          )}
          {ag.status === "FINALIZADO" && (
            <WhatsappButton
              telefone={ag.pet.cliente.telefone}
              mensagem={mensagemAgradecimento(ag.pet.cliente.nome, ag.pet.nome, ag.pet.sexo)}
            >
              Agradecimento
            </WhatsappButton>
          )}
        </div>
      )}

      {/* Corrige toque errado. Continua discreto e longe dos botões grandes,
          para não virar toque acidental no celular. */}
      {rank > 0 && (
        <div className="flex items-center">
          <AcaoDiscreta
            action={voltarEtapaAction.bind(null, ag.id)}
            // Só avisa quando há algo a perder de verdade. Num atendimento pago
            // este botão não apaga mais nada — ele recusa e explica o caminho
            // (ver `voltarEtapaAction`), então prometer perda aqui seria mentira.
            confirmMessage={
              ag.status === "FINALIZADO" && !pago && !estornado
                ? "Isso desfaz a finalização e apaga o registro deste atendimento. Continuar?"
                : undefined
            }
          >
            ‹ Voltar uma etapa
          </AcaoDiscreta>
        </div>
      )}

      <div className="flex gap-3">
        <ButtonLink href={`/agenda?data=${dataISO}`} variant="secondary">
          ‹ Voltar à agenda
        </ButtonLink>
        <ButtonLink href={`/pets/${ag.petId}`} variant="secondary">
          Ficha do pet
        </ButtonLink>
      </div>
    </div>
  );
}
