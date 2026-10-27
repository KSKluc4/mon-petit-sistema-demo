import { Card } from "@/components/ui/Card";
import { ServicoForm } from "@/components/servicos/ServicoForm";
import { createServicoAction } from "../actions";

export const metadata = { title: "Novo serviço" };

export default function NovoServicoPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Novo serviço</h1>
      <Card>
        <ServicoForm action={createServicoAction} submitLabel="Cadastrar" />
      </Card>
    </div>
  );
}
