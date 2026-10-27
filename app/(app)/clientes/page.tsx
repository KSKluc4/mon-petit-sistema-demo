import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatarTelefone } from "@/lib/telefone";

export const metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { pets: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Clientes</h1>

      <ButtonLink href="/clientes/novo" variant="accent" className="w-full">
        + Novo cliente
      </ButtonLink>

      {clientes.length === 0 ? (
        <EmptyState message="Nenhum cliente cadastrado ainda." />
      ) : (
        <div className="flex flex-col gap-2">
          {clientes.map((cliente) => (
            <Link key={cliente.id} href={`/clientes/${cliente.id}`}>
              <Card className="flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div>
                  <p className="font-semibold text-neutral-900">{cliente.nome}</p>
                  <p className="text-sm text-neutral-500">{formatarTelefone(cliente.telefone)}</p>
                </div>
                <span className="text-sm font-medium text-brand-700 bg-brand-50 rounded-full px-3 py-1 whitespace-nowrap">
                  {cliente._count.pets} {cliente._count.pets === 1 ? "pet" : "pets"}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
