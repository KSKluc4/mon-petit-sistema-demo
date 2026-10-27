import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { PetForm } from "@/components/pets/PetForm";
import { voltarSeguro } from "@/lib/navegacao";
import { createPetAction } from "@/app/(app)/pets/actions";

export const metadata = { title: "Novo pet" };

export default async function NovoPetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltar?: string }>;
}) {
  const { id } = await params;
  const { voltar } = await searchParams;
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();

  const action = createPetAction.bind(null, cliente.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Novo pet de {cliente.nome}</h1>
      <Card>
        <PetForm action={action} submitLabel="Cadastrar" voltar={voltarSeguro(voltar) ?? undefined} />
      </Card>
    </div>
  );
}
