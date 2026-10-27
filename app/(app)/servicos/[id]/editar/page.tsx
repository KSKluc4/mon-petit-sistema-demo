import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { ServicoForm } from "@/components/servicos/ServicoForm";
import { updateServicoAction } from "../../actions";

export const metadata = { title: "Editar serviço" };

export default async function EditarServicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const servico = await prisma.servico.findUnique({ where: { id } });
  if (!servico) notFound();

  const action = updateServicoAction.bind(null, servico.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar serviço</h1>
      <Card>
        <ServicoForm action={action} defaultValues={servico} submitLabel="Salvar alterações" />
      </Card>
    </div>
  );
}
