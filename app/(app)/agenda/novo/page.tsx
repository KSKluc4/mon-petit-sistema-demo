import { prisma } from "@/lib/prisma";
import { comSaldo } from "@/lib/pacotes";
import { dataISOValida, hojeISO } from "@/lib/datas";
import { getHorariosOcupadosAction } from "@/app/(app)/agendamentos/actions";
import {
  NovoAgendamentoForm,
  type PetBusca,
  type ServicoOpcao,
} from "@/components/agenda/NovoAgendamentoForm";

export const metadata = { title: "Novo agendamento" };

export default async function NovoAgendamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; petId?: string }>;
}) {
  const { data, petId } = await searchParams;
  const dataPadrao = data && dataISOValida(data) ? data : hojeISO();

  const [petsDb, servicosDb, horariosOcupados] = await Promise.all([
    prisma.pet.findMany({
      orderBy: { nome: "asc" },
      include: {
        cliente: { select: { nome: true } },
        // Saldo de pacote de cada pet: é o que faz o formulário oferecer
        // "usar o pacote" assim que o pet é escolhido.
        pacotes: {
          orderBy: { dataCompra: "asc" },
          include: {
            consumos: { orderBy: { indice: "asc" } },
            estornos: true,
            forma: true,
            pet: true,
          },
        },
      },
    }),
    prisma.servico.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    getHorariosOcupadosAction(dataPadrao),
  ]);

  const pets: PetBusca[] = petsDb.map((p) => {
    // O banho sai sempre do pacote MAIS ANTIGO ainda ativo — a mesma regra do
    // fechamento, aqui só para mostrar o saldo certo.
    const ativo = p.pacotes.map((pc) => comSaldo(pc)).find((pc) => pc.status === "ATIVO") ?? null;
    return {
      id: p.id,
      nome: p.nome,
      especie: p.especie,
      fotoUrl: p.fotoUrl,
      observacoes: p.observacoes,
      padraoPet: p.padraoPet,
      tutor: p.cliente.nome,
      pacote: ativo ? { restantes: ativo.restantes, banhosTotal: ativo.banhosTotal } : null,
    };
  });

  const servicos: ServicoOpcao[] = servicosDb.map((s) => ({ id: s.id, nome: s.nome }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Novo agendamento</h1>
      <NovoAgendamentoForm
        pets={pets}
        servicos={servicos}
        dataPadrao={dataPadrao}
        horariosOcupadosIniciais={horariosOcupados}
        petIdInicial={petId}
      />
    </div>
  );
}
