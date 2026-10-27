import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Ticket, Undo2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { PadraoPetForm } from "@/components/pets/PadraoPetForm";
import { WhatsappButton } from "@/components/ui/WhatsappButton";
import { EspecieIcon } from "@/components/agenda/EspecieIcon";
import { comAutor } from "@/lib/autoria";
import { formatCentavos, formatDataCurta } from "@/lib/datas";
import { mensagemAgradecimento } from "@/lib/whatsapp";
import { listarPacotesDoPet } from "@/lib/pacotes";
import { listarFormasAtivas } from "@/lib/recebimento";
import { PacotesDoPet } from "@/components/pacotes/PacotesDoPet";
import { VenderPacoteForm } from "@/components/pacotes/VenderPacoteForm";
import { deletePetAction } from "../actions";

const ESPECIE_LABEL: Record<string, string> = { CAO: "Cão", GATO: "Gato" };
const SEXO_LABEL: Record<string, string> = { MACHO: "Macho", FEMEA: "Fêmea" };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pet = await prisma.pet.findUnique({ where: { id }, select: { nome: true } });
  return { title: pet ? pet.nome : "Pet" };
}

function calcularIdade(data: Date | null): string | null {
  if (!data) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - data.getFullYear();
  const diffMes = hoje.getMonth() - data.getMonth();
  if (diffMes < 0 || (diffMes === 0 && hoje.getDate() < data.getDate())) {
    anos--;
  }
  if (anos < 1) {
    let meses = (hoje.getFullYear() - data.getFullYear()) * 12 + (hoje.getMonth() - data.getMonth());
    if (hoje.getDate() < data.getDate()) meses--;
    meses = Math.max(meses, 0);
    return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  }
  return `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

export default async function PetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; erro?: string }>;
}) {
  const { id } = await params;
  const { tab, erro } = await searchParams;
  const abaAtiva =
    tab === "padrao"
      ? "padrao"
      : tab === "historico"
        ? "historico"
        : tab === "pacotes"
          ? "pacotes"
          : "dados";

  const pet = await prisma.pet.findUnique({ where: { id }, include: { cliente: true } });
  if (!pet) notFound();

  const idade = calcularIdade(pet.dataNascimento);

  const [atendimentos, emAbertoDoPet, pacotes, formasBrutas] = await Promise.all([
    abaAtiva === "historico"
      ? prisma.atendimento.findMany({
          where: { agendamento: { petId: id } },
          orderBy: { data: "desc" },
          include: {
            // Sem isto o histórico marcaria todo banho de pacote como
            // "em aberto — receber no Caixa": forma nula, mas nada a cobrar.
            consumoPacote: { include: { pacote: { select: { banhosTotal: true } } } },
            // Dinheiro devolvido: o valor continua na linha (o recebimento
            // existiu e conta no dia dele), mas com o selo dizendo que voltou.
            estornos: { orderBy: { data: "asc" } },
          },
        })
      : Promise.resolve([]),
    // Contado sempre, em qualquer aba: um valor em aberto não pode depender de
    // alguém lembrar de abrir a aba Histórico para aparecer.
    prisma.atendimento.count({
      where: {
        agendamento: { petId: id, status: { not: "CANCELADO" } },
        formaId: null,
        // Banho de pacote sem extra também tem forma nula, mas NÃO está em
        // aberto: o dinheiro entrou na venda do pacote. Sem esta linha o banner
        // mandaria cobrar de novo — a mesma armadilha das pendências do Caixa.
        OR: [{ consumoPacote: { is: null } }, { valorTotal: { gt: 0 } }],
      },
    }),
    listarPacotesDoPet(id),
    listarFormasAtivas(),
  ]);

  // O seletor de pagamento da venda precisa do catálogo com as taxas de hoje.
  const formas = formasBrutas.map((f) => ({
    id: f.id,
    nome: f.nome,
    tipo: f.tipo,
    rotulo: f.rotulo,
    taxas: f.taxas.map((t) => ({ parcelas: t.parcelas, taxaBps: t.taxaBps })),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">{pet.nome}</h1>
          <p className="text-sm text-neutral-500">
            Tutor:{" "}
            <Link href={`/clientes/${pet.clienteId}`} className="underline">
              {pet.cliente.nome}
            </Link>
          </p>
        </div>
        {pet.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pet.fotoUrl}
            alt={pet.nome}
            className="w-16 h-16 rounded-full object-cover border border-neutral-200 shrink-0"
          />
        ) : (
          <span className="flex items-center justify-center w-16 h-16 rounded-full bg-brand-50 text-brand-600 shrink-0">
            <EspecieIcon especie={pet.especie} className="w-7 h-7" />
          </span>
        )}
      </div>

      {pet.observacoes && (
        <div className="rounded-2xl bg-amber-100 border border-amber-300 px-4 py-3 text-sm text-amber-900 font-medium flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {pet.observacoes}
        </div>
      )}

      {emAbertoDoPet > 0 && (
        <Link
          href="/caixa"
          className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">
            {emAbertoDoPet === 1
              ? "1 atendimento deste pet está em aberto."
              : `${emAbertoDoPet} atendimentos deste pet estão em aberto.`}
          </span>
          <span className="font-semibold">Receber</span>
        </Link>
      )}

      <WhatsappButton
        telefone={pet.cliente.telefone}
        mensagem={mensagemAgradecimento(pet.cliente.nome, pet.nome, pet.sexo)}
      >
        Agradecimento
      </WhatsappButton>

      {erro === "possui-agendamentos" && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Não é possível excluir: este pet possui agendamentos cadastrados.
        </div>
      )}

      {/* 4 pílulas não cabem em 390px. Quem rola é a barra, não a página —
          mesmo padrão da navegação do header. */}
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href={`/pets/${pet.id}?tab=dados`}
          className={`shrink-0 px-4 py-2 min-h-[44px] flex items-center rounded-full text-sm font-semibold transition-colors ${
            abaAtiva === "dados" ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          Dados
        </Link>
        <Link
          href={`/pets/${pet.id}?tab=padrao`}
          className={`shrink-0 px-4 py-2 min-h-[44px] flex items-center rounded-full text-sm font-semibold transition-colors ${
            abaAtiva === "padrao" ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          Padrão do Pet
        </Link>
        <Link
          href={`/pets/${pet.id}?tab=historico`}
          className={`shrink-0 px-4 py-2 min-h-[44px] flex items-center rounded-full text-sm font-semibold transition-colors ${
            abaAtiva === "historico" ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          Histórico
        </Link>
        <Link
          href={`/pets/${pet.id}?tab=pacotes`}
          className={`shrink-0 px-4 py-2 min-h-[44px] flex items-center rounded-full text-sm font-semibold transition-colors ${
            abaAtiva === "pacotes" ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          Pacotes
        </Link>
      </div>

      {abaAtiva === "dados" ? (
        <Card className="flex flex-col gap-1 text-sm">
          <Row label="Espécie" value={ESPECIE_LABEL[pet.especie]} />
          <Row label="Raça" value={pet.raca} />
          <Row label="Sexo" value={SEXO_LABEL[pet.sexo]} />
          <Row label="Idade" value={idade ?? "Não informada"} />
          <Row label="Peso" value={pet.pesoKg ? `${pet.pesoKg} kg` : "Não informado"} />
          {pet.observacoes && <Row label="Observações" value={pet.observacoes} />}

          <div className="flex gap-3 mt-4">
            <ButtonLink href={`/pets/${pet.id}/editar`} variant="secondary">
              Editar
            </ButtonLink>
            <DeleteButton
              action={deletePetAction.bind(null, pet.id)}
              confirmMessage={`Excluir o pet ${pet.nome}? Essa ação não pode ser desfeita.`}
            />
          </div>
        </Card>
      ) : abaAtiva === "padrao" ? (
        <Card>
          <PadraoPetForm petId={pet.id} defaultValue={pet.padraoPet ?? ""} />
        </Card>
      ) : abaAtiva === "pacotes" ? (
        <div className="flex flex-col gap-4">
          <PacotesDoPet pacotes={pacotes} petId={pet.id} />
          <VenderPacoteForm petId={pet.id} petNome={pet.nome} formas={formas} />
        </div>
      ) : (
        <Card className="flex flex-col">
          {atendimentos.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-6">
              Nenhum atendimento registrado ainda.
            </p>
          ) : (
            atendimentos.map((at) => {
              // Em aberto = fechado com "Receber depois" e ainda não recebido.
              // Precisa aparecer aqui: quem abre a ficha do pet no balcão é
              // quem tem a chance de cobrar antes de o cliente ir embora.
              const doPacote = at.consumoPacote !== null;
              const semExtra = doPacote && (at.valorTotal ?? 0) === 0;
              const emAberto = at.formaId === null && !semExtra;
              // Devolvido não volta a ser pendência: o dinheiro saiu, não há o
              // que cobrar. `emAberto` já é falso aqui (a forma continua
              // gravada), então os dois selos não competem.
              const estornado = at.estornos.length > 0;
              return (
                <div
                  key={at.id}
                  className="flex flex-col gap-1 py-3 border-b border-neutral-100 last:border-0"
                >
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-semibold text-neutral-900">{formatDataCurta(at.data)}</span>
                    {semExtra ? (
                      <span className="text-sm font-semibold text-brand-700">Pago no pacote</span>
                    ) : at.valorTotal === null ? (
                      <span className="text-sm font-semibold text-amber-600">Valor a definir</span>
                    ) : (
                      <span className="font-bold text-neutral-900 tabular-nums">
                        {formatCentavos(at.valorTotal)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-700">{at.servicosRealizados}</p>
                  {at.consumoPacote && (
                    <p className="flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                      <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                      Banho {at.consumoPacote.indice} de {at.consumoPacote.pacote.banhosTotal}
                    </p>
                  )}
                  {estornado && (
                    <p className="flex w-fit items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Devolvido em {formatDataCurta(at.estornos[0].data)} por{" "}
                      {at.estornos[0].feitoPor}
                    </p>
                  )}
                  {emAberto ? (
                    <Link
                      href="/caixa"
                      className="flex w-fit items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 hover:bg-amber-200"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      Em aberto — receber no Caixa
                    </Link>
                  ) : (
                    at.dataRecebimento &&
                    // Só quando as datas diferem: repetir "recebido em" igual à
                    // data do atendimento em toda linha seria só ruído.
                    formatDataCurta(at.dataRecebimento) !== formatDataCurta(at.data) && (
                      <p className="text-xs text-neutral-500">
                        Recebido em {formatDataCurta(at.dataRecebimento)}
                      </p>
                    )
                  )}
                  <p className="text-sm text-neutral-500">
                    {comAutor("Atendeu:", at.responsavel)}
                    {at.dataRecebimento && (
                      <> · {comAutor("recebeu:", at.recebidoPor)}</>
                    )}
                  </p>
                  {at.observacoes && (
                    <p className="text-sm text-neutral-500 italic">“{at.observacoes}”</p>
                  )}
                </div>
              );
            })
          )}
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-neutral-100 last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-900 font-medium text-right">{value}</span>
    </div>
  );
}
