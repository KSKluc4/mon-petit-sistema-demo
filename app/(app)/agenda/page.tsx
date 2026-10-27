import Link from "next/link";
import { Plus, Ticket } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { dataISOValida, formatDataExtenso, formatHora, hojeISO, intervaloDoDia } from "@/lib/datas";
import { DiaNav } from "@/components/agenda/DiaNav";
import { STATUS_INFO } from "@/components/agenda/statusInfo";
import { EspecieIcon } from "@/components/agenda/EspecieIcon";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Agenda" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data } = await searchParams;
  const dataISO = data && dataISOValida(data) ? data : hojeISO();
  const { inicio, fim } = intervaloDoDia(dataISO);

  const agendamentos = await prisma.agendamento.findMany({
    where: { dataHora: { gte: inicio, lt: fim } },
    orderBy: { dataHora: "asc" },
    include: {
      pet: { include: { cliente: true } },
      servicos: { include: { servico: true } },
      // Duas fontes para a marca de pacote: a INTENÇÃO enquanto o atendimento
      // está em aberto, e o CONSUMO depois de fechado (que é o fato). O
      // consumo ganha, porque é o que de fato aconteceu.
      atendimento: {
        select: { consumoPacote: { include: { pacote: { select: { banhosTotal: true } } } } },
      },
    },
  });

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Agenda</h1>
        <p className="text-neutral-500">{formatDataExtenso(dataISO)}</p>
      </div>

      <DiaNav dataISO={dataISO} />

      {agendamentos.length === 0 ? (
        <EmptyState
          message="Nenhum agendamento neste dia."
          action={<ButtonLink href={`/agenda/novo?data=${dataISO}`} variant="accent">+ Novo agendamento</ButtonLink>}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {agendamentos.map((ag) => {
            const info = STATUS_INFO[ag.status];
            // Cancelado continua visível no dia (o horário está livre, mas
            // saber que houve um cancelamento ali importa), só que apagado e
            // com o horário riscado, para não competir com o que é real.
            const cancelado = ag.status === "CANCELADO";
            return (
              <Link key={ag.id} href={`/agendamentos/${ag.id}`}>
                <div
                  className={`rounded-2xl border-l-4 ${info.card} px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${
                    cancelado ? "opacity-60" : ""
                  }`}
                >
                  <span
                    className={`text-2xl font-display font-bold text-neutral-900 tabular-nums shrink-0 ${
                      cancelado ? "line-through decoration-2 text-neutral-500" : ""
                    }`}
                  >
                    {formatHora(ag.dataHora)}
                  </span>
                  {ag.pet.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ag.pet.fotoUrl}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-white shadow-sm shrink-0"
                    />
                  ) : (
                    <span className="flex items-center justify-center w-10 h-10 rounded-full bg-white/70 text-neutral-500 shrink-0">
                      <EspecieIcon especie={ag.pet.especie} className="w-5 h-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 basis-40">
                    <p
                      className={`font-semibold text-neutral-900 truncate ${
                        cancelado ? "line-through" : ""
                      }`}
                    >
                      {ag.pet.nome}
                    </p>
                    <p className="text-sm text-neutral-600 truncate">
                      {ag.servicos.map((s) => s.servico.nome).join(" + ") || "Sem serviços"}
                    </p>
                    <p className="text-sm text-neutral-500 truncate">{ag.pet.cliente.nome}</p>
                  </div>
                  {(() => {
                    const consumo = ag.atendimento?.consumoPacote;
                    if (!consumo && !ag.pacoteId) return null;
                    return (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-800">
                        <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                        {consumo
                          ? `Banho ${consumo.indice} de ${consumo.pacote.banhosTotal}`
                          : "Pacote"}
                      </span>
                    );
                  })()}
                  <span
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${info.badge}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
                    {info.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Link
        href={`/agenda/novo?data=${dataISO}`}
        className="fixed bottom-6 right-6 z-20 flex items-center justify-center min-h-[56px] gap-2 rounded-full bg-accent-700 px-6 text-base font-display font-bold text-white shadow-lg hover:bg-accent-800 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all"
      >
        <Plus className="w-5 h-5" aria-hidden="true" />
        Novo agendamento
      </Link>
    </div>
  );
}
