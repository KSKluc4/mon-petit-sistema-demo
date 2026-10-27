import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { updateClienteAction } from "../../actions";

export const metadata = { title: "Editar cliente" };

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();

  const action = updateClienteAction.bind(null, cliente.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar cliente</h1>
      <Card>
        <ClienteForm action={action} defaultValues={cliente} submitLabel="Salvar alterações" />
      </Card>
    </div>
  );
}
