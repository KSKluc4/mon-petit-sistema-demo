import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatHora, TIMEZONE } from "@/lib/datas";
import { getHorariosOcupadosAction } from "@/app/(app)/agendamentos/actions";
import { EditarAgendamentoForm } from "@/components/agenda/EditarAgendamentoForm";
import type { ServicoOpcao } from "@/components/agenda/CamposAgendamento";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ag = await prisma.agendamento.findUnique({
    where: { id },
    select: { pet: { select: { nome: true } } },
  });
  return { title: ag ? `Editar — ${ag.pet.nome}` : "Editar agendamento" };
}

export default async function EditarAgendamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ag = await prisma.agendamento.findUnique({
    where: { id },
    include: {
      pet: { include: { cliente: { select: { nome: true } } } },
      servicos: { select: { servicoId: true } },
    },
  });
  if (!ag) notFound();

  // Editar só faz sentido enquanto o atendimento está em aberto. Finalizado é
  // histórico; cancelado precisa ser reativado antes (o botão fica na ficha).
  if (ag.status === "FINALIZADO" || ag.status === "CANCELADO") {
    redirect(`/agendamentos/${id}`);
  }

  const dataISO = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(ag.dataHora);

  // Os serviços inativos que já estavam neste agendamento continuam na lista,
  // senão salvar a edição os removeria sem ninguém pedir.
  const servicosDb = await prisma.servico.findMany({
    where: {
      OR: [{ ativo: true }, { id: { in: ag.servicos.map((s) => s.servicoId) } }],
    },
    orderBy: { nome: "asc" },
  });
  const horariosOcupados = await getHorariosOcupadosAction(dataISO, id);

  const servicos: ServicoOpcao[] = servicosDb.map((s) => ({ id: s.id, nome: s.nome }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar agendamento</h1>
      <EditarAgendamentoForm
        agendamentoId={ag.id}
        servicos={servicos}
        pet={{
          id: ag.pet.id,
          nome: ag.pet.nome,
          especie: ag.pet.especie,
          fotoUrl: ag.pet.fotoUrl,
          observacoes: ag.pet.observacoes,
          padraoPet: ag.pet.padraoPet,
          tutor: ag.pet.cliente.nome,
        }}
        dataInicial={dataISO}
        horaInicial={formatHora(ag.dataHora)}
        servicosIniciais={ag.servicos.map((s) => s.servicoId)}
        valorInicial={ag.valorTotal}
        observacoesInicial={ag.observacoes ?? ""}
        horariosOcupadosIniciais={horariosOcupados}
      />
    </div>
  );
}
