import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { EspecieIcon } from "@/components/agenda/EspecieIcon";
import { formatarTelefone } from "@/lib/telefone";
import { deleteClienteAction } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { id }, select: { nome: true } });
  return { title: cliente ? cliente.nome : "Cliente" };
}

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { pets: { orderBy: { nome: "asc" } } },
  });
  if (!cliente) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">{cliente.nome}</h1>
        <p className="text-neutral-500 text-sm">{formatarTelefone(cliente.telefone)}</p>
      </div>

      {erro === "possui-pets" && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Não é possível excluir: este cliente ainda tem pets cadastrados. Exclua os pets primeiro.
        </div>
      )}

      <Card className="flex flex-col gap-3 text-sm">
        {cliente.endereco && <Row label="Endereço" value={cliente.endereco} />}
        {cliente.observacoes && <Row label="Observações" value={cliente.observacoes} />}
        <div className="flex gap-3 mt-1">
          <ButtonLink href={`/clientes/${cliente.id}/editar`} variant="secondary">
            Editar
          </ButtonLink>
          <DeleteButton
            action={deleteClienteAction.bind(null, cliente.id)}
            confirmMessage={`Excluir o cliente ${cliente.nome}? Essa ação não pode ser desfeita.`}
          />
        </div>
      </Card>

      <h2 className="font-bold text-neutral-900 mt-2">Pets</h2>
      <ButtonLink href={`/clientes/${cliente.id}/pets/novo`} variant="accent" className="w-full">
        + Novo pet
      </ButtonLink>

      {cliente.pets.length === 0 ? (
        <EmptyState message="Nenhum pet cadastrado ainda." />
      ) : (
        <div className="flex flex-col gap-2">
          {cliente.pets.map((pet) => (
            <Link key={pet.id} href={`/pets/${pet.id}`}>
              <Card className="flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all">
                {pet.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pet.fotoUrl}
                    alt=""
                    className="w-11 h-11 rounded-full object-cover border border-neutral-200 shrink-0"
                  />
                ) : (
                  <span className="flex items-center justify-center w-11 h-11 rounded-full bg-brand-50 text-brand-600 shrink-0">
                    <EspecieIcon especie={pet.especie} className="w-5 h-5" />
                  </span>
                )}
                <div>
                  <p className="font-semibold text-neutral-900">{pet.nome}</p>
                  <p className="text-sm text-neutral-500">{pet.raca}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-neutral-500 text-xs">{label}</span>
      <span className="text-neutral-900">{value}</span>
    </div>
  );
}
