import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { PetForm } from "@/components/pets/PetForm";
import { updatePetAction } from "../../actions";

export const metadata = { title: "Editar pet" };

export default async function EditarPetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pet = await prisma.pet.findUnique({ where: { id } });
  if (!pet) notFound();

  const action = updatePetAction.bind(null, pet.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar {pet.nome}</h1>
      <Card>
        <PetForm
          action={action}
          submitLabel="Salvar alterações"
          defaultValues={{
            nome: pet.nome,
            especie: pet.especie,
            raca: pet.raca,
            sexo: pet.sexo,
            dataNascimento: pet.dataNascimento ? pet.dataNascimento.toISOString().slice(0, 10) : undefined,
            pesoKg: pet.pesoKg?.toString(),
            observacoes: pet.observacoes ?? "",
            fotoUrl: pet.fotoUrl,
          }}
        />
      </Card>
    </div>
  );
}
