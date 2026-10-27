import { Card } from "@/components/ui/Card";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { voltarSeguro } from "@/lib/navegacao";
import { createClienteAction } from "../actions";

export const metadata = { title: "Novo cliente" };

export default async function NovoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ voltar?: string }>;
}) {
  const { voltar } = await searchParams;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Novo cliente</h1>
      <Card>
        <ClienteForm
          action={createClienteAction}
          submitLabel="Cadastrar"
          voltar={voltarSeguro(voltar) ?? undefined}
        />
      </Card>
    </div>
  );
}
